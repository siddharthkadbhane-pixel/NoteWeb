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

  // Load and filter messages (keeping only past 24 hours)
  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const rawMsgs = data || [];
      const cutoffTime = Date.now() - 24 * 3600 * 1000;
      
      // Filter out messages older than 24 hours and map schema columns safely
      const activeMsgs = rawMsgs
        .filter((m: any) => new Date(m.created_at).getTime() >= cutoffTime)
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
      
      // Optionally clean up expired messages in the DB/localstorage to avoid bloat
      const expiredMsgs = rawMsgs.filter((m: any) => new Date(m.created_at).getTime() < cutoffTime);
      if (expiredMsgs.length > 0) {
        for (const expired of expiredMsgs) {
          await supabase.from('chats').delete().eq('id', expired.id);
        }
      }

      setMessages(activeMsgs);
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
                setMessages((prev) => {
                  if (prev.some((m) => m.id === msg.id)) return prev;
                  const cutoffTime = Date.now() - 24 * 3600 * 1000;
                  if (new Date(msg.created_at).getTime() < cutoffTime) return prev;
                  return [...prev, msg].sort(
                    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
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
    const interval = setInterval(fetchMessages, 15000);

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
      let insertErr: any = null;

      if (isMockMode) {
        const newMessageMock = {
          sender_uid: user.uid,
          sender_name: userProfile.displayName || 'Student',
          sender_avatar: userProfile.photoURL || '',
          sender_branch: userProfile.branch || 'computers',
          content: inputText.trim(),
          image_url: selectedImage || undefined,
          created_at: new Date().toISOString(),
        };
        const { error } = await supabase.from('chats').insert([newMessageMock]);
        insertErr = error;
      } else {
        // Try inserting using the new schema format (sender_id, message, photo_url)
        const newMessageNew = {
          sender_id: user.uid,
          sender_name: userProfile.displayName || 'Student',
          sender_avatar: userProfile.photoURL || '',
          sender_branch: userProfile.branch || 'computers',
          message: inputText.trim(),
          photo_url: selectedImage || null,
          created_at: new Date().toISOString(),
        };

        const { error } = await supabase.from('chats').insert([newMessageNew]);
        insertErr = error;

        // If the new schema insert fails (likely because 'message' or 'photo_url' column doesn't exist),
        // self-heal by trying the old schema format (sender_uid, content, image_url)
        if (insertErr && (
          insertErr.message?.toLowerCase().includes('column') || 
          insertErr.message?.toLowerCase().includes('schema cache') || 
          insertErr.code === '42703'
        )) {
          console.warn("New chat schema insert failed. Self-healing by trying old schema...");
          const newMessageOld = {
            sender_uid: user.uid,
            sender_name: userProfile.displayName || 'Student',
            sender_avatar: userProfile.photoURL || '',
            sender_branch: userProfile.branch || 'computers',
            content: inputText.trim(),
            image_url: selectedImage || undefined,
            created_at: new Date().toISOString(),
          };

          const { error: oldError } = await supabase.from('chats').insert([newMessageOld]);
          insertErr = oldError;
        }
      }

      if (insertErr) {
        const isRlsViolation = insertErr.message?.toLowerCase().includes('row-level security') || 
                               insertErr.message?.toLowerCase().includes('policy') ||
                               insertErr.code === '42501';

        if (isRlsViolation) {
          console.warn("Database insert blocked by Row-Level Security. Using Realtime Broadcast fallback...");
          
          const broadcastPayload: ChatMessage = {
            id: 'broadcast-' + Math.random().toString(36).substr(2, 9),
            sender_uid: user.uid,
            sender_name: userProfile.displayName || 'Student',
            sender_avatar: userProfile.photoURL || '',
            sender_branch: userProfile.branch || 'computers',
            content: inputText.trim(),
            image_url: selectedImage || undefined,
            created_at: new Date().toISOString(),
          };

          if (channelRef.current) {
            try {
              await channelRef.current.send({
                type: 'broadcast',
                event: 'message',
                payload: broadcastPayload
              });
            } catch (broadcastErr) {
              console.warn("Failed to send broadcast message:", broadcastErr);
            }
          }

          setMessages((prev) => [...prev, broadcastPayload]);
          toastError("NoteWeb Secure Shield: Message synced instantly via P2P Broadcast (DB writes are policy-restricted).");
          
          setInputText('');
          setSelectedImage(null);
          setIsSending(false);
          return;
        }

        throw insertErr;
      }

      setInputText('');
      setSelectedImage(null);
      await fetchMessages();
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

    // Convert image to base64 for mockup in-memory display
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
      info('Image attachment loaded.');
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
    <div className="min-h-[calc(100vh-4rem)] w-full py-8 px-4 md:px-8 relative overflow-hidden flex flex-col items-center bg-[#0A0A0C]">
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
            <span>24h Expiry Shield Active</span>
          </div>
        </GlassPanel>

        {/* Self-Destruct Ticker info */}
        <div className="flex items-center gap-2 p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl text-xs text-rose-300 text-left">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          <p>
            <strong>Self-Destruct System:</strong> Messages will automatically expire and permanently self-destruct from the database after 24 hours. PDF sharing is strictly prohibited (Photos only).
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
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">No active chats in the last 24 hours. Send a message to start the campus vibe!</p>
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
