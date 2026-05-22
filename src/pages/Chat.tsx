import React, { useState, useEffect, useRef } from 'react';
import { supabase, isMockMode } from '../supabase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { renderAvatar } from '../utils/avatar';
import { GlassPanel } from '../components/ui/GlassPanel';

import { 
  Send, 
  Image as ImageIcon, 
  Trash2, 
  Clock, 
  AlertTriangle,
  MessageSquare,
  Lock
} from 'lucide-react';

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
  const { user, userProfile, isGuest } = useAuth();
  const { error: toastError, info } = useToast();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

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
    if (!dateStr) return 1716300000000;
    const t = new Date(dateStr).getTime();
    return isNaN(t) ? 1716300000000 : t;
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
        sender_branch: userProfile.branch || 'computers',
        content: inputText.trim(),
        image_url: selectedImage || undefined,
        created_at: new Date().toISOString(),
      };

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
              sender_branch: userProfile.branch || 'computers',
              content: msgPayload.content,
              image_url: msgPayload.image_url || undefined,
              created_at: msgPayload.created_at,
            };
            await supabase.from('chats').insert([newMessageMock]);
          } else {
            // New schema format — no custom id, let the DB assign a real UUID
            const newMessageNew = {
              sender_id: user.uid,
              sender_name: userProfile.displayName || 'Student',
              sender_avatar: userProfile.photoURL || '',
              sender_branch: userProfile.branch || 'computers',
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
                sender_branch: userProfile.branch || 'computers',
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
              }
            } else if (insertedRows && insertedRows[0]) {
              // Replace temp broadcast message with the real DB-assigned ID
              const realId = insertedRows[0].id;
              setMessages((prev) => prev.map((m) =>
                m.id === tempMsgId ? { ...m, id: realId } : m
              ));
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
      case 'computers': return '💻';
      case 'electronics': return '🔌';
      case 'mechanical': return '⚙️';
      case 'maths': return '📐';
      case 'science': return '🔬';
      default: return '📚';
    }
  };

  return (
    <div className="min-h-[calc(100dvh-4rem)] w-full py-8 px-4 md:px-8 relative overflow-hidden flex flex-col items-center bg-[#0A0A0C]">
      {/* Visual background accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse" />

      <div className="w-full max-w-4xl flex-1 flex flex-col gap-4 z-10 relative">
        
        {/* Chat Warning Banner */}
        <GlassPanel className="p-4 bg-[#121218]/45 border border-white/[0.08] rounded-2xl flex items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                Campus Chat Lounge
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  LIVE FEED
                </span>
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Connect and coordinate with fellow engineers across all college departments</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-xl text-xs font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>7d Expiry Shield Active</span>
          </div>
        </GlassPanel>

        {/* Self-Destruct Ticker info */}
        <div className="flex items-center gap-2 p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl text-xs text-rose-300 text-left">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          <p>
            <strong>Self-Destruct System:</strong> Messages will automatically expire and permanently self-destruct from the database after 7 days. PDF sharing is strictly prohibited (Photos only).
          </p>
        </div>

        {/* Chat window body */}
        <GlassPanel className="flex-1 min-h-[400px] bg-[#121218]/30 border border-white/[0.08] rounded-3xl p-6 flex flex-col justify-between overflow-hidden relative">
          
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
                  <h4 className="font-bold text-white text-sm">Quiet Room...</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">No active chats in the last 7 days. Send a message to start the campus vibe!</p>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender_uid === user?.uid;
                return (
                  <div 
                    key={msg.id}
                    className={`flex items-end gap-3 ${isMe ? 'flex-row-reverse text-right' : 'text-left'}`}
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {renderAvatar(msg.sender_avatar, "w-9 h-9 text-lg")}
                    </div>

                    {/* Chat Bubble */}
                    <div className="max-w-[70%] space-y-1">
                      {/* Name Header */}
                      <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-400 tracking-wider">
                        <span>{msg.sender_name}</span>
                        <span>{getBranchIcon(msg.sender_branch)}</span>
                      </div>

                      {/* Content Card */}
                      <div className={`p-3.5 rounded-2xl border text-xs font-medium leading-relaxed break-words text-left ${
                        isMe 
                          ? 'bg-indigo-600 border-indigo-500 text-white rounded-br-none shadow-md shadow-indigo-600/10' 
                          : 'bg-[#181824]/80 border-white/[0.04] text-slate-200 rounded-bl-none'
                      }`}>
                        {msg.content}

                        {/* Attached Image inside Bubble */}
                        {msg.image_url && (
                          <div className="mt-2.5 rounded-xl overflow-hidden border border-white/10 max-w-xs shadow-lg bg-black/40">
                            <img 
                              src={msg.image_url} 
                              alt="Shared attachment" 
                              className="max-h-60 w-full object-cover select-none"
                            />
                          </div>
                        )}
                      </div>

                      {/* Time footer */}
                      <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest px-1">
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Image preview drawer */}
          {selectedImage && (
            <div className="p-3 bg-slate-950/50 border border-white/[0.06] rounded-2xl mb-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 bg-black/50">
                  <img src={selectedImage} alt="Attachment Thumbnail" className="w-full h-full object-cover" />
                </div>
                <div className="text-left">
                  <span className="block text-xs font-bold text-white">Attachment Loaded</span>
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
            className="mt-4 pt-4 border-t border-white/[0.06] flex items-center gap-2 relative"
          >
            {isGuest ? (
              <div className="w-full py-3 bg-slate-950/40 border border-white/[0.04] rounded-2xl text-xs font-semibold text-slate-500 flex items-center justify-center gap-1.5">
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
                  className="p-3 rounded-2xl border border-white/[0.08] bg-[#1A1A24]/60 text-slate-400 hover:text-white hover:bg-white/5 transition-all active:scale-95 cursor-pointer"
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
                  className="flex-1 bg-[#1A1A24]/60 border border-white/[0.08] text-white rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-semibold placeholder:text-slate-500"
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
    </div>
  );
};

export default Chat;
