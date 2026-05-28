import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isMockMode } from '../supabase/config';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { renderAvatar } from '../utils/avatar';
import { motion } from 'framer-motion';
import { moderateChatMessage } from '../services/gemini';

import { 
  Send, 
  Image as ImageIcon, 
  Trash2, 
  Clock, 
  AlertTriangle,
  MessageSquare,
  Lock,
  X,
  Edit
} from 'lucide-react';

const BAD_WORDS = [
  'abuse', 'fuck', 'shit', 'asshole', 'bitch', 'crap', 'cunt', 'dick', 'bastard', 'vulgar', 
  'ass', 'dumb', 'idiot', 'stupid', 'slut', 'whore', 'piss', 'vulgar'
];

export const containsBadWords = (text: string): boolean => {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return BAD_WORDS.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(lowerText);
  });
};

const compressImage = (base64Str: string, maxWidth = 400, maxHeight = 400, quality = 0.6): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};


interface ChatMessage {
  id: string;
  sender_uid: string;
  sender_name: string;
  sender_avatar: string;
  sender_branch: string;
  content: string;
  image_url?: string;
  created_at: string;
}

export const Chat: React.FC = () => {
  const { user, userProfile, isGuest, updatePoints } = useAuth();
  const { isDark } = useTheme();
  const { error: toastError, info } = useToast();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<any>(null);

  const getSafeTime = (dateStr: any, id?: string) => {
    if (id && id.startsWith('broadcast-')) {
      const parts = id.split('-');
      if (parts.length >= 2) {
        const parsedTime = parseInt(parts[1], 10);
        if (!isNaN(parsedTime) && parsedTime > 0) {
          return parsedTime;
        }
      }
    }
    if (!dateStr) return Date.now();
    const t = new Date(dateStr).getTime();
    return isNaN(t) ? Date.now() : t;
  };

  // Load and filter messages (keeping only past 7 days)
  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const rawMsgs = data || [];
      const cutoffTime = Date.now() - 7 * 24 * 3600 * 1000;
      
      // Filter out messages older than 7 days and map schema columns safely
      const activeMsgs = rawMsgs
        .filter((m: any) => getSafeTime(m.created_at, m.id) >= cutoffTime)
        .map((m: any) => ({
          id: m.id,
          sender_uid: m.sender_id || m.sender_uid || '',
          sender_name: m.sender_name || '',
          sender_avatar: m.sender_avatar || '',
          sender_branch: m.sender_branch || '',
          content: m.message || m.content || '',
          image_url: m.photo_url || m.image_url || undefined,
          created_at: m.created_at || new Date().toISOString(),
        }));

      // Get broadcasted messages from localStorage
      const storedBroadcastsStr = localStorage.getItem('noteweb-broadcasted-chats');
      let storedBroadcasts: ChatMessage[] = [];
      if (storedBroadcastsStr) {
        try {
          storedBroadcasts = JSON.parse(storedBroadcastsStr);
        } catch {}
      }
      
      // Filter out broadcasts older than 7 days
      const activeBroadcasts = storedBroadcasts.filter(
        (m) => getSafeTime(m.created_at, m.id) >= cutoffTime
      );
      
      // Save active ones back to localStorage
      if (activeBroadcasts.length !== storedBroadcasts.length) {
        localStorage.setItem('noteweb-broadcasted-chats', JSON.stringify(activeBroadcasts));
      }

      setMessages((prev) => {
        // Find all local broadcasted messages currently in state
        const localBroadcasts = prev.filter(
          (m) => m.id.startsWith('broadcast-') && getSafeTime(m.created_at, m.id) >= cutoffTime
        );
        
        // Merge activeBroadcasts and localBroadcasts
        const allBroadcasts = [...localBroadcasts];
        for (const b of activeBroadcasts) {
          if (!allBroadcasts.some((m) => m.id === b.id)) {
            allBroadcasts.push(b);
          }
        }
        
        // Merge everything with the newly fetched database messages
        const merged = [...activeMsgs] as ChatMessage[];
        for (const b of allBroadcasts) {
          // Check if this broadcast is already represented in activeMsgs by comparing sender, content and approximate time
          const isRepresented = activeMsgs.some((m: any) => {
            if (m.id === b.id) return true;
            // Match approximate timestamp (+/- 5 minutes) and sender + content
            const timeDiff = Math.abs(getSafeTime(m.created_at, m.id) - getSafeTime(b.created_at, b.id));
            return (
              m.sender_uid === b.sender_uid &&
              m.content === b.content &&
              timeDiff < 300000
            );
          });
          
          if (!isRepresented) {
            merged.push(b);
          }
        }
        
        return merged.sort((a, b) => getSafeTime(a.created_at, a.id) - getSafeTime(b.created_at, b.id));
      });
    } catch (e) {
      console.error('Error fetching chat messages:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchMessages();

    // 1. Set up Realtime subscription for chats table postgres events and broadcast events
    let channel: any = null;
    try {
      if (typeof supabase.channel === 'function') {
        channel = supabase
          .channel('public:chats')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'chats' },
            () => {
              console.log('Realtime change in chats table, refetching...');
              fetchMessages();
            }
          )
          .on(
            'broadcast',
            { event: 'message' },
            (response: any) => {
              console.log('Broadcast received in chats channel:', response);
              if (response?.payload) {
                const msg = response.payload;
                
                // Save to localStorage
                const storedBroadcastsStr = localStorage.getItem('noteweb-broadcasted-chats');
                let storedBroadcasts: ChatMessage[] = [];
                if (storedBroadcastsStr) {
                  try {
                    storedBroadcasts = JSON.parse(storedBroadcastsStr);
                  } catch {}
                }
                if (!storedBroadcasts.some((m) => m.id === msg.id)) {
                  storedBroadcasts.push(msg);
                  localStorage.setItem('noteweb-broadcasted-chats', JSON.stringify(storedBroadcasts));
                }

                 setMessages((prev) => {
                  if (prev.some((m) => m.id === msg.id)) return prev;
                  const cutoffTime = Date.now() - 7 * 24 * 3600 * 1000;
                  if (getSafeTime(msg.created_at, msg.id) < cutoffTime) return prev;
                  return [...prev, msg].sort(
                    (a, b) => getSafeTime(a.created_at, a.id) - getSafeTime(b.created_at, b.id)
                  );
                });
              }
            }
          )
          .on(
            'broadcast',
            { event: 'delete-message' },
            (response: any) => {
              if (response?.payload?.id) {
                setMessages((prev) => prev.filter((m) => m.id !== response.payload.id));
              }
            }
          )
          .on(
            'broadcast',
            { event: 'edit-message' },
            (response: any) => {
              if (response?.payload?.id && response?.payload?.content) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === response.payload.id
                      ? { ...m, content: response.payload.content }
                      : m
                  )
                );
              }
            }
          )
          .subscribe();
        
        channelRef.current = channel;
      }
    } catch (err) {
      console.warn("Realtime subscription failed on Chat:", err);
    }

    // 2. Keep a passive 15-second polling fallback to save CPU and network bandwidth
    // 8-second polling for better real-time coverage as fallback
    const interval = setInterval(fetchMessages, 8000);

    return () => {
      clearInterval(interval);
      if (channel) {
        try {
          if (typeof supabase.removeChannel === 'function') {
            supabase.removeChannel(channel);
          } else {
            channel.unsubscribe();
          }
        } catch (e) {
          console.warn("Failed to unsubscribe chats channel:", e);
        }
      }
      channelRef.current = null;
    };
  }, []);

  // Auto-scroll to the bottom of the feed
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      toastError("Guest accounts are read-only. Please log in to chat.");
      return;
    }
    if (!inputText.trim() && !selectedImage) return;
    if (!user || !userProfile) return;

    setIsSending(true);
    try {
      const tempMsgId = `broadcast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      
      const msgPayload: ChatMessage = {
        id: tempMsgId,
        sender_uid: user.uid,
        sender_name: userProfile.displayName || 'Student',
        sender_avatar: userProfile.photoURL || '',
        sender_branch: userProfile.branch || 'cse',
        content: inputText.trim(),
        image_url: selectedImage || undefined,
        created_at: new Date().toISOString(),
      };

      // Bad words detection
      const hasBadWords = containsBadWords(inputText.trim());
      if (hasBadWords) {
        const detected = BAD_WORDS.filter(w => new RegExp(`\\b${w}\\b`, 'i').test(inputText.toLowerCase())).join(', ');
        const flaggedPayload = {
          id: `flagged-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          chat_id: tempMsgId,
          sender_uid: user.uid,
          sender_name: userProfile.displayName || 'Student',
          sender_avatar: userProfile.photoURL || '',
          sender_branch: userProfile.branch || 'cse',
          content: inputText.trim(),
          bad_word_detected: detected,
          created_at: new Date().toISOString()
        };

        // Save flagged message to localStorage
        const storedFlaggedStr = localStorage.getItem('noteweb-flagged-chats');
        let storedFlagged = [];
        if (storedFlaggedStr) {
          try { storedFlagged = JSON.parse(storedFlaggedStr); } catch {}
        }
        storedFlagged.push(flaggedPayload);
        localStorage.setItem('noteweb-flagged-chats', JSON.stringify(storedFlagged));

        // Trigger a custom storage event for other tabs to detect
        window.dispatchEvent(new Event('storage'));

        // Try non-blocking insert into flagged_chats table in Supabase
        try {
          await supabase.from('flagged_chats').insert([{
            sender_id: user.uid,
            sender_name: userProfile.displayName || 'Student',
            message: inputText.trim(),
            bad_words: detected,
            created_at: flaggedPayload.created_at
          }]);
        } catch (dbFlagErr) {
          console.warn("Flagged chat database insert skipped:", dbFlagErr);
        }

        // Send a broadcast notification for real-time admin flashing
        if (channelRef.current) {
          try {
            await channelRef.current.send({
              type: 'broadcast',
              event: 'flagged-chat',
              payload: flaggedPayload
            });
          } catch (broadcastErr) {
            console.warn("Failed to broadcast profanity alert:", broadcastErr);
          }
        }
      }

      // 1. Optimistic UI update: show message immediately
      setMessages((prev) => {
        if (prev.some((m) => m.id === msgPayload.id)) return prev;
        return [...prev, msgPayload];
      });

      // Clear input fields immediately
      setInputText('');
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // 2. P2P Broadcast instantly
      if (channelRef.current) {
        try {
          await channelRef.current.send({
            type: 'broadcast',
            event: 'message',
            payload: msgPayload
          });
          console.log("Real-time chat message broadcasted successfully!");
        } catch (broadcastErr) {
          console.warn("Failed to send chat broadcast:", broadcastErr);
        }
      }

      // 3. Save to localStorage backup
      const storedBroadcastsStr = localStorage.getItem('noteweb-broadcasted-chats');
      let storedBroadcasts: ChatMessage[] = [];
      if (storedBroadcastsStr) {
        try {
          storedBroadcasts = JSON.parse(storedBroadcastsStr);
        } catch {}
      }
      if (!storedBroadcasts.some((m) => m.id === msgPayload.id)) {
        storedBroadcasts.push(msgPayload);
        localStorage.setItem('noteweb-broadcasted-chats', JSON.stringify(storedBroadcasts));
      }

      // Trigger background AI moderation
      const runAiModeration = async (realId: any, messageText: string) => {
        try {
          const modResult = await moderateChatMessage(messageText, userProfile.displayName || 'Student');
          if (modResult.isToxic) {
            console.log(`[AI Chat Moderator] Message flagged for toxicity (Score: ${modResult.toxicityScore}%): ${modResult.explanation}`);
            
            // 1. Redact message locally for instant UI update
            setMessages((prev) =>
              prev.map((m) =>
                m.id === realId || m.id === tempMsgId
                  ? { ...m, content: '🚫 [Message redacted by AI Moderator for community safety]' }
                  : m
              )
            );
            
            // 2. Update Supabase DB to redact message content
            if (!isMockMode) {
              await supabase
                .from('chats')
                .update({ message: '🚫 [Message redacted by AI Moderator for community safety]' })
                .eq('id', realId);
            } else {
              await supabase
                .from('chats')
                .update({ content: '🚫 [Message redacted by AI Moderator for community safety]' })
                .eq('id', realId);
            }
            
            // 3. Log to flagged_chats table in Supabase
            try {
              await supabase.from('flagged_chats').insert([{
                sender_id: user.uid,
                sender_name: userProfile.displayName || 'Student',
                message: messageText,
                bad_words: modResult.explanation || 'AI Moderated Toxicity',
                created_at: new Date().toISOString()
              }]);
            } catch (flagErr) {
              console.warn("Failed to insert into flagged_chats:", flagErr);
            }

            // 4. Broadcast the edited/redacted message to other active chatters instantly
            if (channelRef.current) {
              await channelRef.current.send({
                type: 'broadcast',
                event: 'edit-message',
                payload: { id: realId, content: '🚫 [Message redacted by AI Moderator for community safety]' }
              });
            }

            // 5. Deduct 20 points from sender profile as community penalty!
            try {
              await updatePoints(-20);
              toastError(`⚠️ AI Moderator redacted your message! Penalty: -20 XP.`);
            } catch (ptsErr) {
              console.warn("Failed to deduct points:", ptsErr);
            }
          }
        } catch (err) {
          console.warn("[AI Moderator] Chat moderation error:", err);
        }
      };

      // 4. Asynchronously perform background database save to keep it non-blocking
      // IMPORTANT: Do NOT pass a custom 'id' — let the DB auto-generate the real UUID.
      // This prevents ID conflicts and duplicate messages when postgres_changes fires.
      const saveToDatabase = async () => {
        try {
          if (isMockMode) {
            const newMessageMock = {
              sender_uid: user.uid,
              sender_name: userProfile.displayName || 'Student',
              sender_avatar: userProfile.photoURL || '',
              sender_branch: userProfile.branch || 'cse',
              content: msgPayload.content,
              image_url: msgPayload.image_url || undefined,
              created_at: msgPayload.created_at,
            };
            await supabase.from('chats').insert([newMessageMock]);
            runAiModeration(tempMsgId, msgPayload.content);
          } else {
            // New schema format — no custom id, let the DB assign a real UUID
            const newMessageNew = {
              sender_id: user.uid,
              sender_name: userProfile.displayName || 'Student',
              sender_avatar: userProfile.photoURL || '',
              sender_branch: userProfile.branch || 'cse',
              message: msgPayload.content,
              photo_url: msgPayload.image_url || null,
              created_at: msgPayload.created_at,
            };
            const { data: insertedRows, error: newErr } = await supabase.from('chats').insert([newMessageNew]).select();
            
            if (newErr && (
              newErr.message?.toLowerCase().includes('column') || 
              newErr.message?.toLowerCase().includes('schema cache') || 
              newErr.code === '42703'
            )) {
              console.warn("New chat schema background insert failed. Trying old schema...");
              const newMessageOld = {
                sender_uid: user.uid,
                sender_name: userProfile.displayName || 'Student',
                sender_avatar: userProfile.photoURL || '',
                sender_branch: userProfile.branch || 'cse',
                content: msgPayload.content,
                image_url: msgPayload.image_url || undefined,
                created_at: msgPayload.created_at,
              };
              const { data: oldRows } = await supabase.from('chats').insert([newMessageOld]).select();
              // Replace temp broadcast message with the real DB row ID to prevent duplicates
              if (oldRows && oldRows[0]) {
                const realId = oldRows[0].id;
                setMessages((prev) => prev.map((m) =>
                  m.id === tempMsgId ? { ...m, id: realId } : m
                ));
                runAiModeration(realId, msgPayload.content);
              }
            } else if (insertedRows && insertedRows[0]) {
              // Replace temp broadcast message with the real DB-assigned ID
              const realId = insertedRows[0].id;
              setMessages((prev) => prev.map((m) =>
                m.id === tempMsgId ? { ...m, id: realId } : m
              ));
              runAiModeration(realId, msgPayload.content);
            }
          }
        } catch (dbErr: any) {
          console.warn("Background chat save failed (non-blocking):", dbErr);
        }
      };

      saveToDatabase();
    } catch (e: any) {
      console.error(e);
      toastError('Failed to send message: ' + e.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteChat = async (msgId: string) => {
    const isConfirmed = window.confirm("Are you sure you want to permanently delete this chat message?");
    if (!isConfirmed) return;

    try {
      // 1. Delete from Supabase Database
      const { error: dbErr } = await supabase
        .from('chats')
        .delete()
        .eq('id', msgId);

      if (dbErr) {
        const numId = parseInt(msgId, 10);
        if (!isNaN(numId)) {
          await supabase.from('chats').delete().eq('id', numId);
        }
      }

      // 2. Broadcast deletion instantly to other connected clients
      if (channelRef.current) {
        try {
          await channelRef.current.send({
            type: 'broadcast',
            event: 'delete-message',
            payload: { id: msgId }
          });
        } catch (e) {
          console.warn("Failed to broadcast delete action:", e);
        }
      }

      // 3. Update local state
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      
      // 4. Remove from local broadcast storage
      try {
        const storedStr = localStorage.getItem('noteweb-broadcasted-chats');
        if (storedStr) {
          const stored = JSON.parse(storedStr);
          if (Array.isArray(stored)) {
            const filtered = stored.filter((m: any) => m.id !== msgId);
            localStorage.setItem('noteweb-broadcasted-chats', JSON.stringify(filtered));
          }
        }
      } catch (cacheErr) {
        console.warn("Failed to clear chat from local broadcast cache:", cacheErr);
      }

      info("Message deleted successfully.");
    } catch (e: any) {
      console.error(e);
      toastError("Failed to delete chat message: " + e.message);
    }
  };

  const handleEditMessage = async (msgId: string, newContent: string) => {
    if (isGuest) return;
    if (!newContent.trim()) return;

    try {
      // 1. Update in Supabase Database (if not a temporary broadcast message)
      if (!msgId.startsWith('broadcast-')) {
        const { error: dbErr } = await supabase
          .from('chats')
          .update({ message: newContent.trim() })
          .eq('id', msgId);
        
        if (dbErr) {
          // Try camelCase fallback
          await supabase
            .from('chats')
            .update({ content: newContent.trim() })
            .eq('id', msgId);
        }
      }

      // 2. Broadcast edited message instantly to other connected clients
      if (channelRef.current) {
        try {
          await channelRef.current.send({
            type: 'broadcast',
            event: 'edit-message',
            payload: { id: msgId, content: newContent.trim() }
          });
        } catch (e) {
          console.warn("Failed to broadcast edit action:", e);
        }
      }

      // 3. Update local state
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, content: newContent.trim() } : m))
      );

      // 4. Update in local broadcast storage
      try {
        const storedStr = localStorage.getItem('noteweb-broadcasted-chats');
        if (storedStr) {
          const stored = JSON.parse(storedStr);
          if (Array.isArray(stored)) {
            const updated = stored.map((m: any) =>
              m.id === msgId ? { ...m, content: newContent.trim() } : m
            );
            localStorage.setItem('noteweb-broadcasted-chats', JSON.stringify(updated));
          }
        }
      } catch (cacheErr) {
        console.warn("Failed to update edited chat in local broadcast cache:", cacheErr);
      }

      info("Message edited successfully.");
    } catch (e: any) {
      console.error(e);
      toastError("Failed to edit chat message: " + e.message);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Strict validation
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      toastError('PDF sharing is strictly restricted in chat room. Photos only!');
      // Flash a standard red input flash
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      toastError('Invalid file type! You can only share image formats (JPG, PNG, WEBP).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Convert image to base64 and compress for mockup in-memory display
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Str = reader.result as string;
      try {
        info('Compressing image for instant real-time delivery...');
        const compressed = await compressImage(base64Str);
        setSelectedImage(compressed);
        info('Image compressed successfully.');
      } catch (err) {
        setSelectedImage(base64Str);
        console.error("Compression failed, using raw image:", err);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return '10:00 AM';
    }
  };

  const getBranchIcon = (branch: string) => {
    switch (branch) {
      case 'cse': return '💻';
      case 'aiml': return '🧠';
      case 'ds': return '📊';
      case 'ece': return '🔌';
      case 'mechanical': return '⚙️';
      case 'civil': return '🏗️';
      default: return '📚';
    }
  };

  return (
    <div className={`min-h-[calc(100dvh-4rem)] w-full py-8 px-4 md:px-8 relative overflow-hidden flex flex-col items-center transition-colors duration-300 ${isDark ? 'bg-[#0A0A0C] text-[#E2E8F0]' : 'bg-slate-50 text-slate-800'}`}>
      {/* Visual background accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse" />

      <div className="w-full max-w-4xl flex-1 flex flex-col gap-4 z-10 relative">
        
        {/* Chat Warning Banner */}
        <GlassPanel className={`p-4 border rounded-2xl flex items-center justify-between gap-3 text-left ${isDark ? 'bg-[#121218]/45 border-white/[0.08]' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-sm font-bold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                Campus Chat Lounge
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  LIVE FEED
                </span>
              </h3>
              <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Connect and coordinate with fellow engineers across all college departments</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-xl text-xs font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>7d Expiry Shield Active</span>
          </div>
        </GlassPanel>

        {/* Self-Destruct Ticker info */}
        <div className={`flex items-center gap-2 p-3 border rounded-xl text-xs text-left ${isDark ? 'bg-rose-500/5 border-rose-500/10 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700 font-medium'}`}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-450" />
          <p>
            <strong>Self-Destruct System:</strong> Messages will automatically expire and permanently self-destruct from the database after 7 days. PDF sharing is strictly prohibited (Photos only).
          </p>
        </div>

        {/* Chat window body */}
        <GlassPanel className={`flex-1 min-h-[400px] rounded-3xl p-6 flex flex-col justify-between overflow-hidden relative border ${isDark ? 'bg-[#121218]/30 border-white/[0.08]' : 'bg-white border-slate-200/80 shadow-md'}`}>
          
          {/* Scrollable messages zone */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 max-h-[500px]">
            {isLoading ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs font-bold">
                🔐 Accessing campus feed secure layer...
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-slate-500 py-16">
                <div className="w-12 h-12 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center text-indigo-400 text-xl">💬</div>
                <div>
                  <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>Quiet Room...</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">No active chats in the last 7 days. Send a message to start the campus vibe!</p>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender_uid === user?.uid;
                return (
                  <motion.div 
                    key={msg.id}
                    initial={{ opacity: 0, scale: 0.85, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    className={`flex items-end gap-3 ${isMe ? 'flex-row-reverse text-right' : 'text-left'}`}
                  >
                    {/* Avatar */}
                    <div 
                      onClick={() => msg.sender_uid && navigate(`/profile/${msg.sender_uid}`)} 
                      className="flex-shrink-0 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                    >
                      {renderAvatar(msg.sender_avatar, "w-9 h-9 text-lg")}
                    </div>

                    {/* Chat Bubble */}
                    <div className="max-w-[70%] space-y-1">
                      {/* Name Header */}
                      <div className={`flex items-center gap-1.5 text-[10px] font-extrabold tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'} ${isMe ? 'justify-end' : ''}`}>
                        <span 
                          onClick={() => msg.sender_uid && navigate(`/profile/${msg.sender_uid}`)} 
                          className="hover:text-indigo-500 transition-colors cursor-pointer"
                        >
                          {msg.sender_name}
                        </span>
                        <span>{getBranchIcon(msg.sender_branch)}</span>
                        {userProfile?.role === 'admin' && (
                          <span className="text-[8px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-455 border border-amber-500/30">
                            ADMIN
                          </span>
                        )}
                      </div>

                      {/* Content Card with edit/delete control for sender, and delete button for admin */}
                      <div className="flex items-center gap-2 group/msg w-full relative">
                        {isMe && (
                          <div className="flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-all duration-200 flex-shrink-0">
                            {/* Edit Button */}
                            <button
                              onClick={() => {
                                setEditingMsgId(msg.id);
                                setEditingText(msg.content);
                              }}
                              className="p-1.5 rounded-lg bg-white/10 hover:bg-indigo-600 text-slate-350 hover:text-white transition-all cursor-pointer active:scale-95 border border-white/10"
                              title="Edit message"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            {/* Delete Button */}
                            <button
                              onClick={() => handleDeleteChat(msg.id)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white transition-all cursor-pointer active:scale-95 border border-rose-500/20"
                              title="Delete message"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        <div className={`p-3.5 rounded-2xl border text-xs font-medium leading-relaxed break-words text-left flex-1 ${
                          isMe 
                            ? 'bg-indigo-600 border-indigo-500 text-white rounded-br-none shadow shadow-indigo-600/10' 
                            : isDark
                              ? 'bg-[#181824]/80 border-white/[0.04] text-slate-200 rounded-bl-none'
                              : 'bg-slate-50 border-slate-200 text-slate-800 rounded-bl-none shadow-sm'
                        }`}>
                          {editingMsgId === msg.id ? (
                            <div className="flex flex-col gap-2 min-w-[200px]">
                              <input
                                type="text"
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                className="w-full py-1.5 px-3 rounded-lg bg-black/25 text-white text-xs border border-white/20 focus:outline-none focus:border-indigo-400"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleEditMessage(msg.id, editingText);
                                    setEditingMsgId(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingMsgId(null);
                                  }
                                }}
                              />
                              <div className="flex justify-end gap-1.5 text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => setEditingMsgId(null)}
                                  className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-all font-bold text-white cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleEditMessage(msg.id, editingText);
                                    setEditingMsgId(null);
                                  }}
                                  className="px-2 py-1 rounded bg-indigo-500 hover:bg-indigo-400 transition-all font-bold text-white cursor-pointer"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {msg.content}
                              
                              {/* Attached Image inside Bubble */}
                              {msg.image_url && (
                                <div 
                                  onClick={() => setZoomedImage(msg.image_url || null)}
                                  className="mt-2.5 rounded-xl overflow-hidden border border-white/10 max-w-xs shadow-lg bg-black/40 cursor-zoom-in hover:opacity-90 active:scale-[0.99] transition-all"
                                  title="Click to zoom in"
                                >
                                  <img 
                                    src={msg.image_url} 
                                    alt="Shared attachment" 
                                    className="max-h-60 w-full object-cover select-none"
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {!isMe && userProfile?.role === 'admin' && (
                          <button
                            onClick={() => handleDeleteChat(msg.id)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white transition-all opacity-0 group-hover/msg:opacity-100 cursor-pointer flex-shrink-0 active:scale-95 border border-rose-500/20"
                            title="Delete message"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Time footer */}
                      <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest px-1">
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                  </motion.div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Image preview drawer */}
          {selectedImage && (
            <div className={`p-3 border rounded-2xl mb-4 flex items-center justify-between gap-4 ${isDark ? 'bg-slate-950/50 border-white/[0.06]' : 'bg-slate-100 border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-lg overflow-hidden border ${isDark ? 'border-white/10 bg-black/50' : 'border-slate-250 bg-white'}`}>
                  <img src={selectedImage} alt="Attachment Thumbnail" className="w-full h-full object-cover" />
                </div>
                <div className="text-left">
                  <span className={`block text-xs font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Attachment Loaded</span>
                  <span className="block text-[9px] text-emerald-400 font-semibold uppercase tracking-wider">Ready to upload</span>
                </div>
              </div>
              <button 
                onClick={removeSelectedImage}
                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white transition-all active:scale-95 cursor-pointer"
                title="Remove attachment"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Footer controls input bar */}
          <form 
            onSubmit={handleSendMessage}
            className={`mt-4 pt-4 border-t flex items-center gap-2 relative ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}
          >
            {isGuest ? (
              <div className={`w-full py-3 border rounded-2xl text-xs font-semibold text-slate-500 flex items-center justify-center gap-1.5 ${isDark ? 'bg-slate-950/40 border-white/[0.04]' : 'bg-slate-100 border-slate-200'}`}>
                <Lock className="w-3.5 h-3.5" /> Guest Mode: Access is Read-Only. Register to join the chat.
              </div>
            ) : (
              <>
                {/* Photo Attach Trigger */}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  ref={fileInputRef}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-3 rounded-2xl border transition-all active:scale-95 cursor-pointer ${isDark ? 'border-white/[0.08] bg-[#1A1A24]/60 text-slate-400 hover:text-white hover:bg-white/5' : 'border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
                  title="Attach Photo"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>

                {/* Input text */}
                <input
                  type="text"
                  placeholder="Share a study update, ask a question..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className={`flex-1 border rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-semibold placeholder:text-slate-500 ${isDark ? 'bg-[#1A1A24]/60 border-white/[0.08] text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                />

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSending || (!inputText.trim() && !selectedImage)}
                  className="p-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all disabled:opacity-50 disabled:hover:bg-indigo-600 cursor-pointer shadow-lg shadow-indigo-600/10 active:scale-95"
                >
                  <Send className="w-5 h-5" />
                </button>
              </>
            )}
          </form>
        </GlassPanel>
      </div>

      {/* Lightbox Image Modal */}
      {zoomedImage && (
        <div 
          onClick={() => setZoomedImage(null)}
          className="fixed inset-0 bg-[#0A0A0C]/90 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-zoom-out animate-fade-in text-left"
        >
          {/* Close button */}
          <button 
            onClick={() => setZoomedImage(null)}
            className="absolute top-4 right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer active:scale-95 z-50 border border-white/10"
            title="Close Lightbox"
          >
            <X className="w-6 h-6" />
          </button>
          
          {/* Fullscreen image container */}
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="max-w-[90vw] max-h-[85vh] relative flex flex-col items-center justify-center text-center animate-scale-up"
          >
            <img 
              src={zoomedImage} 
              alt="Zoomed attachment" 
              className="max-w-full max-h-[75vh] object-contain rounded-2xl border border-white/10 shadow-2xl select-none"
            />
            {/* Action Bar */}
            <div className="flex items-center gap-2 mt-4 px-4 py-2 bg-slate-900/85 border border-white/[0.08] backdrop-blur rounded-2xl">
              <a 
                href={zoomedImage} 
                download={`attachment_${Date.now()}.jpg`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-all active:scale-95 shadow-md shadow-indigo-600/15"
              >
                Open in New Tab
              </a>
              <button 
                onClick={() => setZoomedImage(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 font-extrabold text-xs transition-all active:scale-95 border border-white/10"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
