import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase, isMockMode } from '../supabase/config';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { renderAvatar } from '../utils/avatar';
import { incrementQuestProgress } from '../utils/quests';
import { motion } from 'framer-motion';
import { moderateChatMessage } from '../services/gemini';
import { GlassPanel } from '../components/ui/GlassPanel';
import { subscribeToPresenceChanges } from '../services/presence';
import type { OnlineUser } from '../services/presence';

import { 
  Send, 
  Image as ImageIcon, 
  Trash2, 
  Clock, 
  AlertTriangle,
  MessageSquare,
  Lock,
  X,
  Edit,
  Search,
  Users,
  MessageCircle,
  ChevronLeft,
  UserCheck,
  Phone,
  Video,
  Pin,
  PinOff,
  Star,
  Plus,
  Shield,
  ShieldAlert,
  VolumeX,
  Volume2,
  Smile,
  Eye,
  EyeOff,
  Paintbrush,
  BarChart2,
  Paperclip,
  Download,
  PhoneOff,
  Mic,
  MicOff,
  VideoOff,
  FileText,
  Quote,
  Check,
  MoreVertical
} from 'lucide-react';

const BAD_WORDS = [
  'abuse', 'fuck', 'shit', 'asshole', 'bitch', 'crap', 'cunt', 'dick', 'bastard', 'vulgar', 
  'ass', 'dumb', 'idiot', 'stupid', 'slut', 'whore', 'piss'
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
  starred?: boolean;
}

interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  message: string;
  photo_url?: string;
  created_at: string;
  is_read: boolean;
  reply_to?: {
    id: string;
    senderName: string;
    content: string;
  };
  reactions?: Record<string, string[]>; // emoji -> list of sender_uids
  shared_note_id?: string;
  is_vanish?: boolean;
  is_view_once?: boolean;
  poll_data?: {
    question: string;
    options: string[];
    votes: Record<string, string[]>; // optionIndex -> list of sender_uids
  };
}

interface DMContact {
  uid: string;
  displayName: string;
  photoURL: string;
  branch: string;
  username: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

interface UserProfile {
  id: string;
  uid?: string;
  username: string;
  display_name?: string;
  displayName?: string;
  photo_url?: string;
  photoURL?: string;
  branch: string;
  year?: string;
  role?: string;
}

interface ChatTheme {
  name: string;
  containerClass: string;
  style?: React.CSSProperties;
  myBubbleClass: string;
  otherBubbleClass: string;
  previewBg: string;
  previewStyle?: React.CSSProperties;
}

const CHAT_THEMES: ChatTheme[] = [
  {
    name: 'Default',
    containerClass: '',
    myBubbleClass: 'bg-indigo-600 border-indigo-500 text-white shadow shadow-indigo-600/10',
    otherBubbleClass: 'bg-[#181824]/80 border-white/[0.04] text-slate-200 rounded-bl-none',
    previewBg: 'bg-slate-900 border border-white/5'
  },
  {
    name: 'Midnight Nebula',
    containerClass: 'bg-gradient-to-br from-slate-950 via-indigo-950/40 to-purple-950/30 border-purple-500/20',
    myBubbleClass: 'bg-purple-650 border-purple-600 text-white shadow shadow-purple-600/25',
    otherBubbleClass: 'bg-indigo-950/60 border-purple-500/20 text-purple-200 shadow-sm rounded-bl-none',
    previewBg: 'bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950'
  },
  {
    name: 'Emerald Canopy',
    containerClass: 'bg-gradient-to-br from-slate-950 via-emerald-950/35 to-slate-900 border-emerald-500/20',
    myBubbleClass: 'bg-emerald-650 border-emerald-600 text-white shadow shadow-emerald-600/25',
    otherBubbleClass: 'bg-emerald-950/50 border-emerald-500/20 text-emerald-250 shadow-sm rounded-bl-none',
    previewBg: 'bg-gradient-to-br from-teal-950 via-emerald-950 to-slate-950'
  },
  {
    name: 'Sunset Ember',
    containerClass: 'bg-gradient-to-br from-slate-950 via-rose-950/30 to-orange-950/20 border-rose-500/20',
    myBubbleClass: 'bg-rose-650 border-rose-600 text-white shadow shadow-rose-600/25',
    otherBubbleClass: 'bg-rose-950/40 border-rose-500/20 text-rose-250 shadow-sm rounded-bl-none',
    previewBg: 'bg-gradient-to-br from-rose-950 via-orange-950 to-slate-950'
  },
  {
    name: 'Tokyo Neon',
    containerClass: 'border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]',
    style: {
      backgroundImage: `linear-gradient(to right, rgba(6, 182, 212, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(6, 182, 212, 0.04) 1px, transparent 1px)`,
      backgroundSize: '36px 36px',
      backgroundColor: '#040408'
    },
    myBubbleClass: 'bg-cyan-950/40 border border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(34,211,238,0.2)]',
    otherBubbleClass: 'bg-fuchsia-950/40 border border-fuchsia-500/40 text-fuchsia-200 shadow-[0_0_10px_rgba(217,70,239,0.15)] rounded-bl-none',
    previewBg: 'bg-black border border-cyan-500/20',
    previewStyle: {
      backgroundImage: `linear-gradient(to right, rgba(6, 182, 212, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(6, 182, 212, 0.04) 1px, transparent 1px)`,
      backgroundSize: '15px 15px',
      backgroundColor: '#040408'
    }
  },
  {
    name: 'Oceanic Abyss',
    containerClass: 'bg-gradient-to-br from-slate-950 via-blue-950/40 to-cyan-950/20 border-blue-500/20',
    myBubbleClass: 'bg-blue-600 border-blue-550 text-white shadow shadow-blue-650/20',
    otherBubbleClass: 'bg-sky-950/50 border-sky-500/20 text-sky-200 shadow-sm rounded-bl-none',
    previewBg: 'bg-gradient-to-br from-blue-950 via-cyan-950 to-slate-950'
  },
  {
    name: 'Sakura Spring',
    containerClass: 'bg-gradient-to-br from-slate-950 via-pink-950/30 to-purple-950/25 border-pink-500/20',
    myBubbleClass: 'bg-pink-650 border-pink-500 text-white shadow shadow-pink-650/20',
    otherBubbleClass: 'bg-pink-950/40 border-pink-500/20 text-pink-250 shadow-sm rounded-bl-none',
    previewBg: 'bg-gradient-to-br from-rose-950/90 via-pink-900/40 to-slate-950'
  },
  {
    name: 'Carbon Stealth',
    containerClass: 'bg-gradient-to-br from-zinc-950 via-neutral-900/20 to-black border-zinc-800',
    myBubbleClass: 'bg-zinc-800 border-zinc-700 text-zinc-100 shadow shadow-black/40',
    otherBubbleClass: 'bg-zinc-900/80 border-zinc-805/80 text-zinc-300 shadow-sm rounded-bl-none',
    previewBg: 'bg-gradient-to-br from-zinc-900 via-neutral-950 to-black'
  },
  {
    name: 'Golden Desert',
    containerClass: 'bg-gradient-to-br from-slate-950 via-amber-950/30 to-yellow-950/20 border-amber-500/20',
    myBubbleClass: 'bg-amber-600 border-amber-500 text-white shadow shadow-amber-650/25',
    otherBubbleClass: 'bg-amber-950/50 border-amber-500/20 text-amber-250 shadow-sm rounded-bl-none',
    previewBg: 'bg-gradient-to-br from-amber-950 via-yellow-950 to-slate-950'
  },
  {
    name: 'Cosmic Constellation',
    containerClass: 'border-indigo-500/25',
    style: {
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Ccircle cx='10' cy='20' r='1' fill='%23ffffff' opacity='0.35'/%3E%3Ccircle cx='60' cy='35' r='1.5' fill='%23ffffff' opacity='0.55'/%3E%3Ccircle cx='95' cy='15' r='1' fill='%23ffffff' opacity='0.45'/%3E%3Ccircle cx='35' cy='85' r='1.2' fill='%23ffffff' opacity='0.65'/%3E%3Ccircle cx='80' cy='95' r='1.5' fill='%23ffffff' opacity='0.35'/%3E%3Ccircle cx='110' cy='75' r='1' fill='%23ffffff' opacity='0.4'/%3E%3Ccircle cx='15' cy='105' r='1.3' fill='%23ffffff' opacity='0.5'/%3E%3Cpath d='M10 20 L60 35 L95 15' stroke='rgba(255,255,255,0.06)' stroke-width='0.5' fill='none'/%3E%3Cpath d='M35 85 L80 95 L110 75' stroke='rgba(255,255,255,0.06)' stroke-width='0.5' fill='none'/%3E%3Cpath d='M15 105 L35 85' stroke='rgba(255,255,255,0.06)' stroke-width='0.5' fill='none'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'repeat',
      backgroundColor: '#050510'
    },
    myBubbleClass: 'bg-indigo-650/90 border-indigo-500 text-white shadow shadow-indigo-650/20',
    otherBubbleClass: 'bg-indigo-950/70 border-indigo-800/40 text-indigo-200 shadow-sm rounded-bl-none',
    previewBg: 'bg-indigo-950',
    previewStyle: {
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 120 120'%3E%3Ccircle cx='10' cy='20' r='1' fill='%23ffffff' opacity='0.35'/%3E%3Ccircle cx='60' cy='35' r='1.5' fill='%23ffffff' opacity='0.55'/%3E%3Ccircle cx='95' cy='15' r='1' fill='%23ffffff' opacity='0.45'/%3E%3Ccircle cx='35' cy='85' r='1.2' fill='%23ffffff' opacity='0.65'/%3E%3Ccircle cx='80' cy='95' r='1.5' fill='%23ffffff' opacity='0.35'/%3E%3Cpath d='M10 20 L60 35 L95 15' stroke='rgba(255,255,255,0.06)' stroke-width='0.5' fill='none'/%3E%3Cpath d='M35 85 L80 95' stroke='rgba(255,255,255,0.06)' stroke-width='0.5' fill='none'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'repeat',
      backgroundColor: '#050510'
    }
  },
  {
    name: 'Study Vibe',
    containerClass: 'border-amber-700/20 text-slate-805',
    style: {
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 36 36'%3E%3Crect width='36' height='36' fill='%23FDFBF7'/%3E%3Cpath d='M0 36 L36 36 M36 0 L36 36' stroke='rgba(139,92,26,0.035)' stroke-width='0.8' fill='none'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'repeat',
      color: '#1e293b'
    },
    myBubbleClass: 'bg-amber-600 border-amber-500 text-white shadow shadow-amber-600/20',
    otherBubbleClass: 'bg-stone-100/90 border-stone-200 text-stone-800 shadow-sm rounded-bl-none',
    previewBg: 'bg-[#FDFBF7]',
    previewStyle: {
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 36 36'%3E%3Crect width='36' height='36' fill='%23FDFBF7'/%3E%3Cpath d='M0 36 L36 36 M36 0 L36 36' stroke='rgba(139,92,26,0.035)' stroke-width='0.8' fill='none'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'repeat'
    }
  }
];

export const Chat: React.FC = () => {
  const { user, userProfile, isGuest, updatePoints } = useAuth();
  const { isDark } = useTheme();
  const { error: toastError, info, success: toastSuccess } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [isLargeScreen, setIsLargeScreen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isNative = typeof window !== 'undefined' && (
    typeof (window as any).Capacitor !== 'undefined' || 
    /android|iphone|ipad|ipod|capacitor/i.test(navigator.userAgent)
  );

  const showMobileUI = isNative || !isLargeScreen;
  
  // Tab control: 'global' | 'dm'
  const [activeTab, setActiveTab] = useState<'global' | 'dm'>('global');
  
  // Mobile UI navigation for DM: 'list' | 'chat'
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // Global Chat States
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  // DM States
  const [dmContacts, setDmContacts] = useState<DMContact[]>([]);
  const [selectedDmUser, setSelectedDmUser] = useState<UserProfile | null>(null);
  const [dmMessages, setDmMessages] = useState<DirectMessage[]>([]);
  
  // Search Users
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Common Input States
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  // Advanced Messaging Upgrades State Hooks
  const [pinnedUids, setPinnedUids] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('noteweb-pinned-chats');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [mutedUids, setMutedUids] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('noteweb-muted-chats');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [blockedUids, setBlockedUids] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('noteweb-blocked-chats');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [chatThemes, setChatThemes] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('noteweb-chat-themes');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const [vanishMode, setVanishMode] = useState<boolean>(false);
  const [isViewOnceSelected, setIsViewOnceSelected] = useState<boolean>(false);
  
  // Mobile dropdown state hooks
  const [showAttachmentMenu, setShowAttachmentMenu] = useState<boolean>(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState<boolean>(false);
  
  // View once state tracking
  const [viewOnceTimer, setViewOnceTimer] = useState<Record<string, number>>({});
  const [viewOnceViewing, setViewOnceViewing] = useState<Record<string, boolean>>({});
  const [viewOnceRevealed, setViewOnceRevealed] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('noteweb-viewed-once-messages');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Star and Reply
  const [replyingTo, setReplyingTo] = useState<DirectMessage | null>(null);
  const [isStarDrawerOpen, setIsStarDrawerOpen] = useState(false);
  const [starredMessages, setStarredMessages] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('noteweb-starred-messages');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Note Sharing picker
  const [isNoteShareModalOpen, setIsNoteShareModalOpen] = useState(false);
  const [searchNoteQuery, setSearchNoteQuery] = useState('');
  const [noteSearchResults, setNoteSearchResults] = useState<any[]>([]);

  // Poll
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  // WebRTC Calling
  const [callState, setCallState] = useState<'idle' | 'calling' | 'incoming' | 'connected'>('idle');
  const [callerProfile, setCallerProfile] = useState<any>(null);
  const [callType, setCallType] = useState<'voice' | 'video'>('video');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<any>(null);
  const channelDmRef = useRef<any>(null);
  
  // Realtime Presence & Typing States
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [partnerIsTyping, setPartnerIsTyping] = useState(false);
  const [myTypingState, setMyTypingState] = useState(false);
  const typingTimeoutRef = useRef<any>(null);

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
          id: String(m.id),
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

  // Fetch DM Contacts List
  const fetchDmContacts = async () => {
    if (!user) return;
    try {
      // 1. Fetch DMs related to me
      const { data: dms, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`sender_id.eq.${user.uid},recipient_id.eq.${user.uid}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rawDms: DirectMessage[] = (dms || []).map((m: any) => ({
        id: String(m.id),
        sender_id: m.sender_id,
        recipient_id: m.recipient_id,
        message: m.message,
        photo_url: m.photo_url || undefined,
        created_at: m.created_at,
        is_read: m.is_read !== undefined ? m.is_read : true
      }));

      // 2. Extract unique classmate UIDs
      const partnerUids = Array.from(
        new Set(
          rawDms.map((m) => (m.sender_id === user.uid ? m.recipient_id : m.sender_id))
        )
      ).filter(Boolean);

      if (partnerUids.length === 0) {
        setDmContacts([]);
        return;
      }

      // 3. Fetch profiles for these partners
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .in('id', partnerUids);

      if (pErr) throw pErr;

      const profileList: UserProfile[] = (profiles || []).map((p: any) => ({
        id: p.id || p.uid,
        username: p.username || '',
        displayName: p.display_name || p.displayName || 'Campus Classmate',
        photoURL: p.photo_url || p.photoURL || '',
        branch: p.branch || 'cse',
        year: p.year || '1',
        role: p.role || 'student'
      }));

      // 4. Map DMs details to each contact
      const contacts: DMContact[] = profileList
        .filter((p) => !blockedUids.includes(p.id)) // Filter out blocked users
        .map((p) => {
          const partnerDms = rawDms.filter(
            (m) => m.sender_id === p.id || m.recipient_id === p.id
          );
          const lastDm = partnerDms[0]; // ordered desc, so first is latest
          const unreadCount = partnerDms.filter(
            (m) => m.sender_id === p.id && !m.is_read
          ).length;

          return {
            uid: p.id,
            displayName: p.displayName || 'Classmate',
            photoURL: p.photoURL || '',
            branch: p.branch,
            username: p.username,
            lastMessage: lastDm ? (lastDm.photo_url ? '📷 Shared a photo' : lastDm.message) : 'No messages',
            lastMessageTime: lastDm ? lastDm.created_at : new Date().toISOString(),
            unreadCount: unreadCount
          };
        });

      // Sort contacts by pinned first, then by latest message time
      contacts.sort((a, b) => {
        const aPinned = pinnedUids.includes(a.uid);
        const bPinned = pinnedUids.includes(b.uid);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      });
      setDmContacts(contacts);
    } catch (e) {
      console.error('Error fetching DM contacts:', e);
    }
  };

  // Fetch DM messages for the selected user
  const fetchDmMessages = async (partnerId: string) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`and(sender_id.eq.${user.uid},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${user.uid})`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const messagesList = (data || []).map((m: any) => ({
        id: String(m.id),
        sender_id: m.sender_id,
        recipient_id: m.recipient_id,
        message: m.message,
        photo_url: m.photo_url || undefined,
        created_at: m.created_at,
        is_read: m.is_read !== undefined ? m.is_read : true,
        reply_to: m.reply_to || undefined,
        reactions: m.reactions || {},
        shared_note_id: m.shared_note_id || undefined,
        is_vanish: m.is_vanish || false,
        is_view_once: m.is_view_once || false,
        poll_data: m.poll_data || undefined
      }));

      setDmMessages(messagesList);

      // Mark unread messages as read
      const unreadIds = messagesList
        .filter((m: DirectMessage) => m.sender_id === partnerId && !m.is_read)
        .map((m: DirectMessage) => m.id);

      if (unreadIds.length > 0) {
        // Perform non-blocking database update
        const numIds = unreadIds.map((id: string) => {
          const num = parseInt(id, 10);
          return isNaN(num) ? id : num;
        });

        const query = supabase.from('direct_messages').update({ is_read: true });
        
        // Handle both UUID/bigint support
        if (typeof numIds[0] === 'number') {
          await query.in('id', numIds);
        } else {
          await query.in('id', unreadIds);
        }

        // Refresh contacts list to reflect zero unread badge
        fetchDmContacts();
      }
    } catch (e) {
      console.error('Error fetching DM messages:', e);
    }
  };

  // Initialize selected profile from URL search query (?dm=uid)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const dmUid = params.get('dm');
    
    if (dmUid && user) {
      setActiveTab('dm');
      setMobileView('chat');
      
      const loadTargetUserProfile = async () => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', dmUid)
            .single();
          
          if (error) throw error;
          if (data) {
            const profile: UserProfile = {
              id: data.id || data.uid,
              username: data.username || '',
              displayName: data.display_name || data.displayName || 'Classmate',
              photoURL: data.photo_url || data.photoURL || '',
              branch: data.branch || 'cse',
              year: data.year || '1',
              role: data.role || 'student'
            };
            setSelectedDmUser(profile);
            fetchDmMessages(profile.id);
          }
        } catch (e) {
          console.warn("Failed to load url target profile:", e);
          // Fallback
          setSelectedDmUser({
            id: dmUid,
            username: 'student_' + dmUid.substring(0, 5),
            displayName: 'Classmate',
            branch: 'cse'
          });
        }
      };
      
      loadTargetUserProfile();
    }
  }, [location.search, user]);

  // Subscribe to channels and poll fallback
  useEffect(() => {
    setIsLoading(true);
    fetchMessages();
    fetchDmContacts();

    // 1. Setup Global chats channel
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

    const playBubbleSound = () => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } catch {}
    };

    // 2. Setup Direct Messages Realtime Channel
    let channelDm: any = null;
    try {
      if (typeof supabase.channel === 'function') {
        channelDm = supabase
          .channel('public:direct_messages_sync')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'direct_messages' },
            (payload: any) => {
              console.log('Realtime change in direct_messages:', payload);
              const newRow = payload.new;
              
              if (payload.eventType === 'INSERT' && newRow) {
                const isFromMe = newRow.sender_id === user?.uid;
                const isBlocked = blockedUids.includes(newRow.sender_id);
                const isMuted = mutedUids.includes(newRow.sender_id);
                
                if (!isFromMe && !isBlocked) {
                  if (!isMuted) {
                    playBubbleSound();
                    if (!selectedDmUser || selectedDmUser.id !== newRow.sender_id) {
                      info(`💬 Message received from a classmate!`);
                    }
                  }
                }
              }

              fetchDmContacts();
              
              if (selectedDmUser) {
                const partnerId = selectedDmUser.id;
                if (newRow && (
                  (newRow.sender_id === user?.uid && newRow.recipient_id === partnerId) ||
                  (newRow.sender_id === partnerId && newRow.recipient_id === user?.uid)
                )) {
                  fetchDmMessages(partnerId);
                }
              }
            }
          )
          .on(
            'broadcast',
            { event: 'typing' },
            (response: any) => {
              const { sender_id, recipient_id, is_typing } = response.payload || {};
              if (recipient_id === user?.uid && sender_id === selectedDmUser?.id) {
                setPartnerIsTyping(is_typing);
              }
            }
          )
          .on(
            'broadcast',
            { event: 'screenshot' },
            (response: any) => {
              const { recipient_id } = response.payload || {};
              if (recipient_id === user?.uid) {
                toastError(`⚠️ [Privacy Alert] classmate took a screenshot or minimized/blurred the chat window!`);
              }
            }
          )
          .on(
            'broadcast',
            { event: 'call:offer' },
            async (response: any) => {
              const { sender_id, recipient_id, sdp, callType: cType, callerName, callerAvatar } = response.payload || {};
              if (recipient_id === user?.uid) {
                if (callState !== 'idle') {
                  // busy signal
                  channelDm.send({
                    type: 'broadcast',
                    event: 'call:hangup',
                    payload: { sender_id: user?.uid || '', recipient_id: sender_id }
                  });
                  return;
                }
                setCallerProfile({ id: sender_id, displayName: callerName, photoURL: callerAvatar });
                setCallType(cType);
                setCallState('incoming');
                (window as any)._incomingSdpOffer = sdp;
              }
            }
          )
          .on(
            'broadcast',
            { event: 'call:answer' },
            async (response: any) => {
              const { recipient_id, sdp } = response.payload || {};
              if (recipient_id === user?.uid && pcRef.current) {
                try {
                  await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
                  setCallState('connected');
                } catch (err) {
                  console.error("Failed to set remote call description:", err);
                }
              }
            }
          )
          .on(
            'broadcast',
            { event: 'call:ice-candidate' },
            async (response: any) => {
              const { recipient_id, candidate } = response.payload || {};
              if (recipient_id === user?.uid && pcRef.current) {
                try {
                  await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {
                  console.warn("Failed to add ICE candidate:", err);
                }
              }
            }
          )
          .on(
            'broadcast',
            { event: 'call:hangup' },
            (response: any) => {
              const { recipient_id } = response.payload || {};
              if (recipient_id === user?.uid) {
                handleEndCallLocally();
                info("The call has ended.");
              }
            }
          )
          .subscribe();

        channelDmRef.current = channelDm;
      }
    } catch (dmErr) {
      console.warn("Direct Messages Realtime subscription failed:", dmErr);
    }

    // 3. Fallback polling for backup (every 6 seconds)
    const interval = setInterval(() => {
      fetchMessages();
      fetchDmContacts();
      if (selectedDmUser) {
        fetchDmMessages(selectedDmUser.id);
      }
    }, 6000);

    return () => {
      clearInterval(interval);
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch {}
      }
      if (channelDmRef.current) {
        try {
          supabase.removeChannel(channelDmRef.current);
        } catch {}
      }
    };
  }, [selectedDmUser?.id, user?.uid, blockedUids, mutedUids, callState]);

  // Register Realtime Presence listener
  useEffect(() => {
    const unsubscribe = subscribeToPresenceChanges((users) => {
      if (user) {
        setOnlineUsers(users.filter((u) => u.uid !== user.uid));
      } else {
        setOnlineUsers(users);
      }
    });
    return () => {
      unsubscribe();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [user?.uid]);

  // Auto-scroll to message feed bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, dmMessages, activeTab]);

  // Handle Search users
  const handleSearchUsers = async (val: string) => {
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`display_name.ilike.%${val}%,username.ilike.%${val}%`)
        .limit(15);

      if (error) throw error;

      let profiles: UserProfile[] = (data || []).map((p: any) => ({
        id: p.id || p.uid,
        username: p.username || '',
        displayName: p.display_name || p.displayName || 'Classmate',
        photoURL: p.photo_url || p.photoURL || '',
        branch: p.branch || 'cse',
        year: p.year || '1'
      })).filter((p: UserProfile) => p.id !== user?.uid); // exclude self

      // Sort search results: show names/usernames starting with search term first
      const lowerVal = val.toLowerCase();
      profiles.sort((a, b) => {
        const aName = (a.displayName ?? '').toLowerCase();
        const aUser = a.username.toLowerCase();
        const bName = (b.displayName ?? '').toLowerCase();
        const bUser = b.username.toLowerCase();

        const aStarts = aName.startsWith(lowerVal) || aUser.startsWith(lowerVal);
        const bStarts = bName.startsWith(lowerVal) || bUser.startsWith(lowerVal);

        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // If both start with it or both don't, sort alphabetically
        return (a.displayName ?? '').localeCompare(b.displayName ?? '');
      });

      // Keep only top 10 results
      setSearchResults(profiles.slice(0, 10));
    } catch (e) {
      console.error("Peer search failed:", e);
    } finally {
      setIsSearching(false);
    }
  };

  // ════════════════════════════════════════════════════════════
  // ADVANCED MESSAGING IMPLEMENTATION HANDLERS (PHASES 2, 3, & 4)
  // ════════════════════════════════════════════════════════════

  // WebRTC End Call Cleanup Helper
  const handleEndCallLocally = () => {
    setCallState('idle');
    setCallerProfile(null);
    setIsMicMuted(false);
    setIsCameraOff(false);
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
      setRemoteStream(null);
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    (window as any)._incomingSdpOffer = null;
  };

  // WebRTC Initiator
  const startWebRtcCall = async (type: 'voice' | 'video') => {
    if (!selectedDmUser || !user) return;
    try {
      setCallType(type);
      setCallState('calling');
      setCallerProfile(selectedDmUser);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === 'video',
        audio: true
      });
      setLocalStream(stream);

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        if (event.candidate && channelDmRef.current) {
          channelDmRef.current.send({
            type: 'broadcast',
            event: 'call:ice-candidate',
            payload: {
              sender_id: user.uid,
              recipient_id: selectedDmUser.id,
              candidate: event.candidate
            }
          });
        }
      };

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (channelDmRef.current) {
        channelDmRef.current.send({
          type: 'broadcast',
          event: 'call:offer',
          payload: {
            sender_id: user.uid,
            recipient_id: selectedDmUser.id,
            sdp: offer,
            callType: type,
            callerName: userProfile?.displayName || 'Classmate',
            callerAvatar: userProfile?.photoURL || ''
          }
        });
      }
    } catch (err: any) {
      toastError("Failed to initiate call: " + err.message);
      handleEndCallLocally();
    }
  };

  // WebRTC Answer
  const acceptIncomingCall = async () => {
    if (!callerProfile || !user) return;
    try {
      const incomingOffer = (window as any)._incomingSdpOffer;
      if (!incomingOffer) throw new Error("No incoming call request metadata found.");

      setCallState('connected');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: callType === 'video',
        audio: true
      });
      setLocalStream(stream);

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        if (event.candidate && channelDmRef.current) {
          channelDmRef.current.send({
            type: 'broadcast',
            event: 'call:ice-candidate',
            payload: {
              sender_id: user.uid,
              recipient_id: callerProfile.id,
              candidate: event.candidate
            }
          });
        }
      };

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (channelDmRef.current) {
        channelDmRef.current.send({
          type: 'broadcast',
          event: 'call:answer',
          payload: {
            sender_id: user.uid,
            recipient_id: callerProfile.id,
            sdp: answer
          }
        });
      }
    } catch (err: any) {
      toastError("Failed to accept call: " + err.message);
      handleEndCallLocally();
    }
  };

  const declineIncomingCall = () => {
    if (callerProfile && channelDmRef.current) {
      channelDmRef.current.send({
        type: 'broadcast',
        event: 'call:hangup',
        payload: {
          sender_id: user?.uid,
          recipient_id: callerProfile.id
        }
      });
    }
    handleEndCallLocally();
  };

  const endActiveCall = () => {
    if (callerProfile && channelDmRef.current) {
      channelDmRef.current.send({
        type: 'broadcast',
        event: 'call:hangup',
        payload: {
          sender_id: user?.uid,
          recipient_id: callerProfile.id
        }
      });
    }
    handleEndCallLocally();
  };

  // Video Ref Auto-Attachers
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callState]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callState]);

  // Vanish Mode cleanup effect
  useEffect(() => {
    return () => {
      if (selectedDmUser && user) {
        const partnerId = selectedDmUser.id;
        const deleteVanishMsgs = async () => {
          try {
            await supabase
              .from('direct_messages')
              .delete()
              .eq('is_vanish', true)
              .or(`and(sender_id.eq.${user.uid},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${user.uid})`);
          } catch(e) {
            console.warn("Vanish mode cleanup error:", e);
          }
        };
        deleteVanishMsgs();
      }
    };
  }, [selectedDmUser?.id, user?.uid]);

  // Screenshot alert focus/blur effect
  useEffect(() => {
    if (activeTab !== 'dm' || !selectedDmUser || !user) return;

    const handleWindowBlur = () => {
      if (channelDmRef.current) {
        channelDmRef.current.send({
          type: 'broadcast',
          event: 'screenshot',
          payload: {
            sender_id: user.uid,
            recipient_id: selectedDmUser.id
          }
        });
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || (e.metaKey && e.shiftKey && e.key === 'S') || (e.ctrlKey && e.key === 'p')) {
        handleWindowBlur();
      }
    };

    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTab, selectedDmUser?.id, user?.uid]);

  // PIN, MUTE, BLOCK handlers
  const handleTogglePin = (partnerId: string) => {
    let updated;
    if (pinnedUids.includes(partnerId)) {
      updated = pinnedUids.filter(id => id !== partnerId);
    } else {
      updated = [...pinnedUids, partnerId];
    }
    setPinnedUids(updated);
    localStorage.setItem('noteweb-pinned-chats', JSON.stringify(updated));
    fetchDmContacts();
    toastSuccess(pinnedUids.includes(partnerId) ? "Chat unpinned." : "Chat pinned to top.");
  };

  const handleToggleMute = (partnerId: string) => {
    let updated;
    if (mutedUids.includes(partnerId)) {
      updated = mutedUids.filter(id => id !== partnerId);
    } else {
      updated = [...mutedUids, partnerId];
    }
    setMutedUids(updated);
    localStorage.setItem('noteweb-muted-chats', JSON.stringify(updated));
    toastSuccess(mutedUids.includes(partnerId) ? "Notifications unmuted." : "Notifications muted (DND).");
  };

  const handleToggleBlock = (partnerId: string) => {
    const confirmText = blockedUids.includes(partnerId)
      ? "Are you sure you want to unblock this classmate?"
      : "Are you sure you want to block this classmate? You won't see their chats or receive their messages.";
    if (!window.confirm(confirmText)) return;

    let updated;
    if (blockedUids.includes(partnerId)) {
      updated = blockedUids.filter(id => id !== partnerId);
      toastSuccess("Classmate unblocked.");
    } else {
      updated = [...blockedUids, partnerId];
      setSelectedDmUser(null);
      setMobileView('list');
      toastSuccess("Classmate blocked.");
    }
    setBlockedUids(updated);
    localStorage.setItem('noteweb-blocked-chats', JSON.stringify(updated));
    fetchDmContacts();
  };

  // STAR MESSAGES (Lounge + DMs)
  const handleToggleStar = (msg: any) => {
    const isDM = !!msg.sender_id;
    const msgId = msg.id;
    const exists = starredMessages.some(m => m.id === msgId);
    let updated;
    if (exists) {
      updated = starredMessages.filter(m => m.id !== msgId);
      toastSuccess("Message unstarred.");
    } else {
      updated = [...starredMessages, {
        id: msgId,
        sender_name: isDM ? (msg.sender_id === user?.uid ? 'You' : (selectedDmUser?.displayName || 'Classmate')) : msg.sender_name,
        sender_avatar: isDM ? (msg.sender_id === user?.uid ? userProfile?.photoURL : selectedDmUser?.photoURL) : msg.sender_avatar,
        content: isDM ? msg.message : msg.content,
        photo_url: isDM ? msg.photo_url : msg.image_url,
        created_at: msg.created_at,
        isDM,
        partnerId: isDM ? (msg.sender_id === user?.uid ? msg.recipient_id : msg.sender_id) : undefined
      }];
      toastSuccess("Message starred locally.");
    }
    setStarredMessages(updated);
    localStorage.setItem('noteweb-starred-messages', JSON.stringify(updated));
  };

  // EMOJI REACTIONS
  const handleAddReaction = async (msgId: string, emoji: string) => {
    if (!user) return;
    try {
      const msg = dmMessages.find(m => m.id === msgId);
      if (!msg) return;

      const currentReactions = msg.reactions || {};
      const emojiReactedUids = currentReactions[emoji] || [];
      let updatedUids;
      if (emojiReactedUids.includes(user.uid)) {
        updatedUids = emojiReactedUids.filter(id => id !== user.uid);
      } else {
        updatedUids = [...emojiReactedUids, user.uid];
      }

      const updatedReactions = {
        ...currentReactions,
        [emoji]: updatedUids
      };

      if (updatedUids.length === 0) {
        delete updatedReactions[emoji];
      }

      setDmMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions: updatedReactions } : m));

      await supabase
        .from('direct_messages')
        .update({ reactions: updatedReactions })
        .eq('id', msgId);

      if (channelDmRef.current && selectedDmUser) {
        channelDmRef.current.send({
          type: 'broadcast',
          event: 'reaction-changed',
          payload: {
            msgId,
            reactions: updatedReactions,
            recipient_id: selectedDmUser.id
          }
        });
      }
    } catch (e: any) {
      console.error("Failed to add reaction:", e);
    }
  };

  // NOTE SEARCH AND ATTACH
  const handleSearchNotes = async (val: string) => {
    setSearchNoteQuery(val);
    if (!val.trim()) {
      setNoteSearchResults([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .ilike('subject', `%${val}%`)
        .eq('status', 'approved')
        .limit(10);
      if (error) throw error;
      setNoteSearchResults(data || []);
    } catch (e) {
      console.warn("Notes query failed:", e);
    }
  };

  const handleShareNoteMessage = async (note: any) => {
    if (!selectedDmUser || !user) return;
    try {
      const tempDmId = `dm-temp-${Date.now()}`;
      const dmPayload: DirectMessage = {
        id: tempDmId,
        sender_id: user.uid,
        recipient_id: selectedDmUser.id,
        message: `📚 Shared Study Note: ${note.subject}`,
        created_at: new Date().toISOString(),
        is_read: false,
        shared_note_id: note.id,
        reactions: {}
      };

      setDmMessages((prev) => [...prev, dmPayload]);
      setIsNoteShareModalOpen(false);
      setSearchNoteQuery('');
      setNoteSearchResults([]);

      const dbPayload = {
        sender_id: user.uid,
        recipient_id: selectedDmUser.id,
        message: dmPayload.message,
        created_at: dmPayload.created_at,
        is_read: false,
        shared_note_id: note.id,
        reactions: {}
      };

      const { data, error } = await supabase.from('direct_messages').insert([dbPayload]).select();
      if (error) throw error;
      if (data && data[0]) {
        setDmMessages(prev => prev.map(m => m.id === tempDmId ? { ...m, id: String(data[0].id) } : m));
      }
      fetchDmContacts();
    } catch(e: any) {
      toastError("Failed to share note: " + e.message);
    }
  };

  // POLL CREATION AND VOTING
  const handleCreatePollMessage = async () => {
    if (!selectedDmUser || !user) return;
    const cleanOptions = pollOptions.filter(o => o.trim() !== '');
    if (!pollQuestion.trim() || cleanOptions.length < 2) {
      toastError("Please enter a question and at least 2 options.");
      return;
    }

    try {
      const tempDmId = `dm-temp-${Date.now()}`;
      const pollData = {
        question: pollQuestion.trim(),
        options: cleanOptions,
        votes: cleanOptions.reduce((acc, _, idx) => {
          acc[String(idx)] = [];
          return acc;
        }, {} as Record<string, string[]>)
      };

      const dmPayload: DirectMessage = {
        id: tempDmId,
        sender_id: user.uid,
        recipient_id: selectedDmUser.id,
        message: `📊 Poll: ${pollQuestion.trim()}`,
        created_at: new Date().toISOString(),
        is_read: false,
        poll_data: pollData,
        reactions: {}
      };

      setDmMessages((prev) => [...prev, dmPayload]);
      setIsPollModalOpen(false);
      setPollQuestion('');
      setPollOptions(['', '']);

      const dbPayload = {
        sender_id: user.uid,
        recipient_id: selectedDmUser.id,
        message: dmPayload.message,
        created_at: dmPayload.created_at,
        is_read: false,
        poll_data: pollData,
        reactions: {}
      };

      const { data, error } = await supabase.from('direct_messages').insert([dbPayload]).select();
      if (error) throw error;
      if (data && data[0]) {
        setDmMessages(prev => prev.map(m => m.id === tempDmId ? { ...m, id: String(data[0].id) } : m));
      }
      fetchDmContacts();
    } catch (e: any) {
      toastError("Failed to create poll: " + e.message);
    }
  };

  const handleCastPollVote = async (msgId: string, optionIdx: number) => {
    if (!user) return;
    try {
      const msg = dmMessages.find(m => m.id === msgId);
      if (!msg || !msg.poll_data) return;

      const currentVotes = { ...msg.poll_data.votes };
      const optKey = String(optionIdx);

      // Remove user from all option votes first
      Object.keys(currentVotes).forEach(key => {
        currentVotes[key] = (currentVotes[key] || []).filter(uid => uid !== user.uid);
      });

      // Add vote
      currentVotes[optKey] = [...(currentVotes[optKey] || []), user.uid];

      const updatedPollData = {
        ...msg.poll_data,
        votes: currentVotes
      };

      setDmMessages(prev => prev.map(m => m.id === msgId ? { ...m, poll_data: updatedPollData } : m));

      await supabase
        .from('direct_messages')
        .update({ poll_data: updatedPollData })
        .eq('id', msgId);

      if (channelDmRef.current && selectedDmUser) {
        channelDmRef.current.send({
          type: 'broadcast',
          event: 'poll-vote-cast',
          payload: {
            msgId,
            poll_data: updatedPollData,
            recipient_id: selectedDmUser.id
          }
        });
      }
    } catch(e: any) {
      console.warn("Failed to cast vote:", e);
    }
  };

  const emitTypingStatus = (isTyping: boolean) => {
    if (!channelDmRef.current || !user || !selectedDmUser) return;
    try {
      channelDmRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          sender_id: user.uid,
          recipient_id: selectedDmUser.id,
          is_typing: isTyping
        }
      });
    } catch (err) {
      console.warn("Failed to broadcast typing status:", err);
    }
  };

  const handleInputChange = (val: string) => {
    setInputText(val);
    
    if (activeTab === 'dm' && selectedDmUser) {
      if (!myTypingState) {
        setMyTypingState(true);
        emitTypingStatus(true);
      }
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      typingTimeoutRef.current = setTimeout(() => {
        setMyTypingState(false);
        emitTypingStatus(false);
      }, 2500);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      toastError("Guest accounts are read-only. Please log in to chat.");
      return;
    }
    if (!inputText.trim() && !selectedImage) return;
    if (!user || !userProfile) return;

    setIsSending(true);
    
    // Profanity screening
    const hasBadWords = containsBadWords(inputText.trim());
    const inputContent = inputText.trim();

    try {
      if (activeTab === 'global') {
        // Global message flow
        const tempMsgId = `broadcast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const msgPayload: ChatMessage = {
          id: tempMsgId,
          sender_uid: user.uid,
          sender_name: userProfile.displayName || 'Student',
          sender_avatar: userProfile.photoURL || '',
          sender_branch: userProfile.branch || 'cse',
          content: inputContent,
          image_url: selectedImage || undefined,
          created_at: new Date().toISOString(),
        };

        if (hasBadWords) {
          const detected = BAD_WORDS.filter(w => new RegExp(`\\b${w}\\b`, 'i').test(inputText.toLowerCase())).join(', ');
          try {
            await supabase.from('flagged_chats').insert([{
              sender_id: user.uid,
              sender_name: userProfile.displayName || 'Student',
              message: inputContent,
              bad_words: detected,
              created_at: msgPayload.created_at
            }]);
          } catch {}
        }

        // Optimistic append
        setMessages((prev) => [...prev, msgPayload]);
        setInputText('');
        setSelectedImage(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        
        try {
          incrementQuestProgress('send-chat', 1);
        } catch (e) {
          console.warn('Failed to increment send-chat quest progress:', e);
        }

        // Broadcast realtime P2P
        if (channelRef.current) {
          await channelRef.current.send({
            type: 'broadcast',
            event: 'message',
            payload: msgPayload
          });
        }

        // Local storage backup
        const storedBroadcastsStr = localStorage.getItem('noteweb-broadcasted-chats');
        let storedBroadcasts: ChatMessage[] = [];
        if (storedBroadcastsStr) {
          try { storedBroadcasts = JSON.parse(storedBroadcastsStr); } catch {}
        }
        storedBroadcasts.push(msgPayload);
        localStorage.setItem('noteweb-broadcasted-chats', JSON.stringify(storedBroadcasts));

        // Background db save
        const saveToDatabase = async () => {
          try {
            const dbPayload = {
              sender_id: user.uid,
              sender_name: userProfile.displayName || 'Student',
              sender_avatar: userProfile.photoURL || '',
              sender_branch: userProfile.branch || 'cse',
              message: inputContent,
              photo_url: selectedImage || null,
              created_at: msgPayload.created_at,
            };

            const { data } = await supabase.from('chats').insert([dbPayload]).select();
            
            if (data && data[0]) {
              const realId = String(data[0].id);
              setMessages((prev) => prev.map((m) => m.id === tempMsgId ? { ...m, id: realId } : m));
              runAiModeration(realId, inputContent, 'chats', 'message');
            }
          } catch (dbErr) {
            console.warn("Global chat background save skipped:", dbErr);
          }
        };

        saveToDatabase();
      } else {
        // DM private message flow
        if (!selectedDmUser) return;
        const targetId = selectedDmUser.id;

        const tempDmId = `dm-temp-${Date.now()}`;
        const dmPayload: DirectMessage = {
          id: tempDmId,
          sender_id: user.uid,
          recipient_id: targetId,
          message: inputContent,
          photo_url: selectedImage || undefined,
          created_at: new Date().toISOString(),
          is_read: false,
          reply_to: replyingTo ? { 
            id: replyingTo.id, 
            senderName: replyingTo.sender_id === user.uid ? 'You' : (selectedDmUser.displayName || 'Classmate'), 
            content: replyingTo.message 
          } : undefined,
          is_vanish: vanishMode,
          is_view_once: isViewOnceSelected && !!selectedImage,
          reactions: {}
        };

        // Optimistic UI updates
        setDmMessages((prev) => [...prev, dmPayload]);
        setInputText('');
        setSelectedImage(null);
        setReplyingTo(null);
        setIsViewOnceSelected(false);
        if (fileInputRef.current) fileInputRef.current.value = '';

        try {
          incrementQuestProgress('send-chat', 1);
        } catch (e) {
          console.warn('Failed to increment send-chat quest progress:', e);
        }

        // Write DM to Supabase database
        const dbPayload = {
          sender_id: user.uid,
          recipient_id: targetId,
          message: inputContent,
          photo_url: dmPayload.photo_url || null,
          created_at: dmPayload.created_at,
          is_read: false,
          reply_to: dmPayload.reply_to || null,
          is_vanish: dmPayload.is_vanish,
          is_view_once: dmPayload.is_view_once,
          reactions: {}
        };

        const { data, error: dbErr } = await supabase.from('direct_messages').insert([dbPayload]).select();
        
        if (dbErr) throw dbErr;

        if (data && data[0]) {
          const realId = String(data[0].id);
          setDmMessages((prev) => prev.map((m) => m.id === tempDmId ? { ...m, id: realId } : m));
          
          // Trigger DM AI Moderation
          runAiModeration(realId, inputContent, 'direct_messages', 'message');
        }

        // Fetch contacts again to update snippet
        fetchDmContacts();

        // 🚀 Mock Auto-Reply trigger in Mock Mode for enhanced demo UX
        if (isMockMode) {
          setTimeout(async () => {
            const mockResponses = [
              "Achaa, understood! I am checking my DSA notes now.",
              "Sure, let me check and get back to you.",
              "Yes! AVL Trees insertion can be tricky, check AVL_Trees_Lec4.pdf uploader.",
              "Hey there! I am offline right now, will message you back soon.",
              "Nice study streak you have there! Keep studying."
            ];
            const randReply = mockResponses[Math.floor(Math.random() * mockResponses.length)];
            
            const replyPayload = {
              sender_id: targetId,
              recipient_id: user.uid,
              message: randReply,
              created_at: new Date().toISOString(),
              is_read: false
            };
            
            await supabase.from('direct_messages').insert([replyPayload]);
            fetchDmMessages(targetId);
            fetchDmContacts();
            
            info(`💬 Message received from ${selectedDmUser.displayName}!`);
          }, 2000);
        }
      }
    } catch (e: any) {
      console.error(e);
      toastError('Failed to send message: ' + e.message);
    } finally {
      setIsSending(false);
    }
  };

  // AI Moderation background task
  const runAiModeration = async (realId: string, messageText: string, table: string, contentField: string) => {
    try {
      const modResult = await moderateChatMessage(messageText, userProfile?.displayName || 'Student');
      if (modResult.isToxic) {
        console.log(`[AI Chat Moderator] Message flagged on ${table} (Toxicity Score: ${modResult.toxicityScore}%): ${modResult.explanation}`);
        const redactedText = '🚫 [Message redacted by AI Moderator for community safety]';

        if (table === 'chats') {
          setMessages((prev) =>
            prev.map((m) => m.id === realId ? { ...m, content: redactedText } : m)
          );
        } else {
          setDmMessages((prev) =>
            prev.map((m) => m.id === realId ? { ...m, message: redactedText } : m)
          );
        }

        // Update database table
        await supabase
          .from(table)
          .update({ [contentField]: redactedText })
          .eq('id', realId);

        // Deduct points
        try {
          await updatePoints(-20);
          toastError(`⚠️ AI Moderator redacted your message! Penalty: -20 XP.`);
        } catch {}

        // Broadcast to other tabs/channels
        if (table === 'chats' && channelRef.current) {
          await channelRef.current.send({
            type: 'broadcast',
            event: 'edit-message',
            payload: { id: realId, content: redactedText }
          });
        }
      }
    } catch (err) {
      console.warn("AI Moderation handler error:", err);
    }
  };

  const handleDeleteChat = async (msgId: string) => {
    const isConfirmed = window.confirm("Are you sure you want to permanently delete this message?");
    if (!isConfirmed) return;

    try {
      const table = activeTab === 'global' ? 'chats' : 'direct_messages';
      
      const { error: dbErr } = await supabase
        .from(table)
        .delete()
        .eq('id', msgId);

      if (dbErr) {
        const numId = parseInt(msgId, 10);
        if (!isNaN(numId)) {
          await supabase.from(table).delete().eq('id', numId);
        }
      }

      if (activeTab === 'global') {
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
        // Broadcast deletion
        if (channelRef.current) {
          try {
            await channelRef.current.send({
              type: 'broadcast',
              event: 'delete-message',
              payload: { id: msgId }
            });
          } catch {}
        }
      } else {
        setDmMessages((prev) => prev.filter((m) => m.id !== msgId));
        fetchDmContacts();
      }

      info("Message deleted successfully.");
    } catch (e: any) {
      toastError("Failed to delete message: " + e.message);
    }
  };

  const handleEditMessage = async (msgId: string, newContent: string) => {
    if (isGuest) return;
    if (!newContent.trim()) return;

    try {
      const table = activeTab === 'global' ? 'chats' : 'direct_messages';
      const updateField = activeTab === 'global' ? 'message' : 'message';

      await supabase
        .from(table)
        .update({ [updateField]: newContent.trim() })
        .eq('id', msgId);

      if (activeTab === 'global') {
        setMessages((prev) =>
          prev.map((m) => m.id === msgId ? { ...m, content: newContent.trim() } : m)
        );
        // Broadcast edits
        if (channelRef.current) {
          try {
            await channelRef.current.send({
              type: 'broadcast',
              event: 'edit-message',
              payload: { id: msgId, content: newContent.trim() }
            });
          } catch {}
        }
      } else {
        setDmMessages((prev) =>
          prev.map((m) => m.id === msgId ? { ...m, message: newContent.trim() } : m)
        );
        fetchDmContacts();
      }

      info("Message edited successfully.");
    } catch (e: any) {
      toastError("Failed to edit message: " + e.message);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      toastError('PDF sharing is strictly restricted in chat rooms. Photos only!');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      toastError('Invalid file type! Share image formats only.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Str = reader.result as string;
      try {
        info('Compressing image for fast delivery...');
        const compressed = await compressImage(base64Str);
        setSelectedImage(compressed);
        toastSuccess('Image compressed successfully.');
      } catch (err) {
        setSelectedImage(base64Str);
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
      return 'Recent';
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

  // Open Chat thread with a searched user
  const handleStartDmChat = (peerProfile: UserProfile) => {
    setSelectedDmUser(peerProfile);
    setSearchQuery('');
    setSearchResults([]);
    setMobileView('chat');
    fetchDmMessages(peerProfile.id);
  };

  // View once countdown trigger
  const startViewOnceTimer = (msgId: string) => {
    setViewOnceViewing(prev => ({ ...prev, [msgId]: true }));
    setViewOnceTimer(prev => ({ ...prev, [msgId]: 5 }));
    
    const interval = setInterval(() => {
      setViewOnceTimer(prev => {
        const rem = prev[msgId] - 1;
        if (rem <= 0) {
          clearInterval(interval);
          const updatedRevealed = [...viewOnceRevealed, msgId];
          setViewOnceRevealed(updatedRevealed);
          localStorage.setItem('noteweb-viewed-once-messages', JSON.stringify(updatedRevealed));
          setViewOnceViewing(v => ({ ...v, [msgId]: false }));
          
          // Background delete from DB
          supabase.from('direct_messages').delete().eq('id', msgId).then(() => {});
        }
        return { ...prev, [msgId]: rem };
      });
    }, 1000);
  };

  const getThemeClasses = () => {
    const roomId = activeTab === 'dm' && selectedDmUser ? selectedDmUser.id : 'global';
    const themeName = chatThemes[roomId] || 'Default';
    const mappedName = themeName === 'Midnight Purple' ? 'Midnight Nebula' : 
                       themeName === 'Sunset Crimson' ? 'Sunset Ember' :
                       themeName === 'Cyberpunk Neon' ? 'Tokyo Neon' :
                       themeName === 'Emerald Forest' ? 'Emerald Canopy' : themeName;
    const found = CHAT_THEMES.find(t => t.name === mappedName);
    return found ? found.containerClass : '';
  };

  const getThemeStyle = () => {
    const roomId = activeTab === 'dm' && selectedDmUser ? selectedDmUser.id : 'global';
    const themeName = chatThemes[roomId] || 'Default';
    const mappedName = themeName === 'Midnight Purple' ? 'Midnight Nebula' : 
                       themeName === 'Sunset Crimson' ? 'Sunset Ember' :
                       themeName === 'Cyberpunk Neon' ? 'Tokyo Neon' :
                       themeName === 'Emerald Forest' ? 'Emerald Canopy' : themeName;
    const found = CHAT_THEMES.find(t => t.name === mappedName);
    return found ? found.style : undefined;
  };

  const getMyBubbleTheme = () => {
    const roomId = activeTab === 'dm' && selectedDmUser ? selectedDmUser.id : 'global';
    const themeName = chatThemes[roomId] || 'Default';
    const mappedName = themeName === 'Midnight Purple' ? 'Midnight Nebula' : 
                       themeName === 'Sunset Crimson' ? 'Sunset Ember' :
                       themeName === 'Cyberpunk Neon' ? 'Tokyo Neon' :
                       themeName === 'Emerald Forest' ? 'Emerald Canopy' : themeName;
    const found = CHAT_THEMES.find(t => t.name === mappedName);
    return found ? found.myBubbleClass : 'bg-indigo-600 border-indigo-500 text-white';
  };

  const getOtherBubbleTheme = () => {
    const roomId = activeTab === 'dm' && selectedDmUser ? selectedDmUser.id : 'global';
    const themeName = chatThemes[roomId] || 'Default';
    const mappedName = themeName === 'Midnight Purple' ? 'Midnight Nebula' : 
                       themeName === 'Sunset Crimson' ? 'Sunset Ember' :
                       themeName === 'Cyberpunk Neon' ? 'Tokyo Neon' :
                       themeName === 'Emerald Forest' ? 'Emerald Canopy' : themeName;
    const found = CHAT_THEMES.find(t => t.name === mappedName);
    if (found && found.name !== 'Default') {
      return found.otherBubbleClass;
    }
    return isDark
      ? 'bg-[#181824]/80 border-white/[0.04] text-slate-200 rounded-bl-none'
      : 'bg-slate-50 border-slate-200 text-slate-800 rounded-bl-none shadow-sm';
  };

  // ─────────────────────────────────────────────────────────────
  // MOBILE UI — WhatsApp-style native layout (only on mobile/native)
  // ─────────────────────────────────────────────────────────────
  if (showMobileUI) {
    // Shared message renderer for both global + DM tabs
    const renderMobileMessages = (msgList: any[]) => (
      <>
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-xs font-bold">
            🔐 Loading messages...
          </div>
        ) : msgList.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-6">
            <div className="w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-2xl">💬</div>
            <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>No messages yet</p>
            <p className="text-[11px] text-slate-500">Send a message to start the conversation!</p>
          </div>
        ) : (
          msgList.map((msg: any) => {
            const isMe = activeTab === 'global' ? msg.sender_uid === user?.uid : msg.sender_id === user?.uid;
            const senderUid = activeTab === 'global' ? msg.sender_uid : msg.sender_id;
            const senderName = activeTab === 'global' ? msg.sender_name : (isMe ? 'You' : selectedDmUser?.displayName);
            const senderAvatar = activeTab === 'global' ? msg.sender_avatar : (isMe ? userProfile?.photoURL : selectedDmUser?.photoURL);
            const senderBranch = activeTab === 'global' ? msg.sender_branch : (isMe ? userProfile?.branch : selectedDmUser?.branch);
            const messageContent = activeTab === 'global' ? msg.content : msg.message;
            const imageUrl = activeTab === 'global' ? msg.image_url : msg.photo_url;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                onDoubleClick={() => activeTab === 'dm' && handleAddReaction(msg.id, '❤️')}
                className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar - small on mobile */}
                <div
                  onClick={() => senderUid && navigate(`/profile/${senderUid}`)}
                  className="flex-shrink-0 cursor-pointer active:scale-90 transition-transform"
                >
                  {renderAvatar(senderAvatar || '', 'w-7 h-7 text-sm')}
                </div>

                {/* Bubble */}
                <div className={`max-w-[75%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Sender name (only in global) */}
                  {activeTab === 'global' && (
                    <span
                      onClick={() => senderUid && navigate(`/profile/${senderUid}`)}
                      className={`text-[10px] font-extrabold px-1 cursor-pointer ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                    >
                      {senderName} {getBranchIcon(senderBranch || 'cse')}
                    </span>
                  )}

                  {/* Reply preview */}
                  {msg.reply_to && (
                    <div className="mb-1 px-2.5 py-1.5 rounded-xl bg-black/20 border-l-4 border-indigo-500 text-[10px] text-slate-300 w-full">
                      <span className="block text-[9px] font-black text-indigo-400 mb-0.5">↩ {msg.reply_to.senderName}</span>
                      <span className="truncate block">{msg.reply_to.content}</span>
                    </div>
                  )}

                  {/* Message content bubble */}
                  <div
                    className={`px-3 py-2 rounded-2xl text-[13px] font-medium leading-relaxed break-words relative ${
                      isMe
                        ? getMyBubbleTheme() + ' rounded-br-sm'
                        : getOtherBubbleTheme() + ' rounded-bl-sm'
                    }`}
                    style={{ maxWidth: '100%' }}
                  >
                    {editingMsgId === msg.id ? (
                      <div className="flex flex-col gap-2 min-w-[180px]">
                        <input
                          type="text"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="w-full py-1.5 px-2 rounded-lg bg-black/25 text-white text-xs border border-white/20 focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { handleEditMessage(msg.id, editingText); setEditingMsgId(null); }
                            if (e.key === 'Escape') setEditingMsgId(null);
                          }}
                        />
                        <div className="flex gap-2 justify-end text-[10px]">
                          <button onClick={() => setEditingMsgId(null)} className="px-2 py-1 rounded bg-white/10 text-white font-bold cursor-pointer">Cancel</button>
                          <button onClick={() => { handleEditMessage(msg.id, editingText); setEditingMsgId(null); }} className="px-2 py-1 rounded bg-indigo-500 text-white font-bold cursor-pointer">Save</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {messageContent}

                        {/* View Once */}
                        {msg.is_view_once && imageUrl && (
                          <div className="mt-2">
                            {viewOnceRevealed.includes(msg.id) ? (
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 p-2 bg-black/30 rounded-xl">
                                <EyeOff className="w-3.5 h-3.5 text-rose-500" /> View Once expired
                              </div>
                            ) : viewOnceViewing[msg.id] ? (
                              <div className="relative rounded-xl overflow-hidden">
                                <img src={imageUrl} alt="View Once" className="max-h-48 w-full object-cover select-none" />
                                <div className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded bg-black/60 text-white text-[9px] font-bold animate-pulse">
                                  {viewOnceTimer[msg.id] || 5}s
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => startViewOnceTimer(msg.id)} className="flex items-center gap-2 text-[11px] text-indigo-300 font-bold p-2 bg-indigo-600/10 rounded-xl border border-indigo-500/20 w-full cursor-pointer">
                                <Eye className="w-4 h-4 animate-pulse" /> Tap to View Once
                              </button>
                            )}
                          </div>
                        )}

                        {/* Standard image */}
                        {!msg.is_view_once && imageUrl && (
                          <div onClick={() => setZoomedImage(imageUrl || null)} className="mt-2 rounded-xl overflow-hidden border border-white/10 cursor-zoom-in active:scale-[0.98] transition-all">
                            <img src={imageUrl} alt="Attachment" className="max-h-48 w-full object-cover select-none" />
                          </div>
                        )}

                        {/* Shared note */}
                        {msg.shared_note_id && (
                          <div className={`mt-2 p-2.5 rounded-xl border flex flex-col gap-1.5 ${isDark ? 'bg-slate-900/80 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
                            <div className="flex items-center gap-1.5 text-indigo-400 text-[11px] font-bold">
                              <FileText className="w-4 h-4" /> Shared Study Note
                            </div>
                            <a href={`/notes?noteId=${msg.shared_note_id}`} target="_blank" rel="noopener noreferrer" className="py-1 px-2.5 rounded-lg bg-indigo-600 text-white font-extrabold text-[10px] text-center cursor-pointer">
                              View PDF Notes
                            </a>
                          </div>
                        )}

                        {/* Poll */}
                        {msg.poll_data && (
                          <div className={`mt-2 p-2.5 rounded-xl border flex flex-col gap-1.5 ${isDark ? 'bg-slate-900/60 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                            <h5 className="text-[11px] font-black flex items-center gap-1.5"><BarChart2 className="w-3.5 h-3.5 text-indigo-400" />{msg.poll_data.question}</h5>
                            <div className="space-y-1">
                              {msg.poll_data.options.map((opt: string, optIdx: number) => {
                                const votesList = msg.poll_data.votes[String(optIdx)] || [];
                                const totalVotes = Object.values(msg.poll_data.votes).reduce((acc: number, list: any) => acc + (list || []).length, 0);
                                const pct = totalVotes > 0 ? Math.round((votesList.length / totalVotes) * 100) : 0;
                                const hasVoted = votesList.includes(user?.uid || '');
                                return (
                                  <button key={optIdx} onClick={() => handleCastPollVote(msg.id, optIdx)}
                                    className={`w-full text-left p-1.5 rounded-lg border text-[10px] relative overflow-hidden cursor-pointer ${hasVoted ? 'border-indigo-500 bg-indigo-600/10 text-white font-bold' : isDark ? 'border-white/5 bg-white/[0.02] text-slate-400' : 'border-slate-200 bg-white text-slate-700'}`}>
                                    <div className="absolute left-0 top-0 bottom-0 bg-indigo-500/10" style={{ width: `${pct}%` }} />
                                    <div className="flex justify-between relative z-10"><span>{opt}</span><span className="text-[9px] text-slate-400">{pct}%</span></div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Reactions */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5 px-1">
                      {Object.entries(msg.reactions).map(([emoji, uids]) => {
                        const uidsList = uids as string[];
                        const hasReacted = uidsList.includes(user?.uid || '');
                        return (
                          <button key={emoji} onClick={() => handleAddReaction(msg.id, emoji)}
                            className={`px-1.5 py-0.5 rounded-full border text-[10px] font-bold flex items-center gap-0.5 cursor-pointer ${hasReacted ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300' : isDark ? 'bg-slate-900/60 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                            {emoji} {uidsList.length}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Message time + actions row */}
                  <div className={`flex items-center gap-2 px-1 mt-0.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <span className="text-[9px] text-slate-500 font-bold">
                      {formatTime(msg.created_at)}
                      {activeTab === 'dm' && isMe && <span className="ml-1">{msg.is_read ? ' ✓✓' : ' ✓'}</span>}
                    </span>
                    {/* Quick action buttons */}
                    <div className="flex items-center gap-1 opacity-60">
                      {activeTab === 'dm' && (
                        <button onClick={() => setReplyingTo(msg)} className="p-1 rounded-lg bg-white/10 text-slate-400 active:bg-indigo-600/20 active:text-white cursor-pointer">
                          <Quote className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions for own messages */}
                {isMe && (
                  <div className="flex flex-col gap-1.5 flex-shrink-0 self-end mb-1 opacity-60">
                    <button onClick={() => { setEditingMsgId(msg.id); setEditingText(messageContent); }} className="p-1 rounded-lg bg-white/10 text-slate-400 cursor-pointer active:bg-indigo-600 active:text-white">
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDeleteChat(msg.id)} className="p-1 rounded-lg bg-rose-500/10 text-rose-400 cursor-pointer active:bg-rose-500 active:text-white">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {!isMe && userProfile?.role === 'admin' && (
                  <button onClick={() => handleDeleteChat(msg.id)} className="p-1 rounded-lg bg-rose-500/10 text-rose-400 cursor-pointer self-end mb-1 flex-shrink-0 opacity-0 group-hover:opacity-100">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </>
    );

    // ── Mobile Input Bar (shared for global + DM) ──
    const MobileInputBar = () => (
      <div className={`flex-shrink-0 border-t px-3 py-2 ${isDark ? 'border-white/[0.06] bg-[#0D0D14]' : 'border-slate-200 bg-white'}`}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}>
        {/* Reply preview */}
        {activeTab === 'dm' && replyingTo && selectedDmUser && (
          <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl mb-2 ${isDark ? 'bg-indigo-950/40 border border-indigo-500/20' : 'bg-indigo-50 border border-indigo-200'}`}>
            <div className="flex-1 min-w-0">
              <span className="block text-[9px] font-black text-indigo-400 uppercase">↩ {replyingTo.sender_id === user?.uid ? 'You' : selectedDmUser.displayName}</span>
              <p className={`text-[10px] truncate ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{replyingTo.message}</p>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-1 text-slate-400 cursor-pointer flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Image preview */}
        {selectedImage && (
          <div className={`flex items-center gap-2 p-2 rounded-xl mb-2 ${isDark ? 'bg-slate-950/50 border border-white/[0.06]' : 'bg-slate-100 border border-slate-200'}`}>
            <img src={selectedImage} alt="Attachment" className="w-10 h-10 rounded-lg object-cover border border-white/10 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="block text-[10px] font-bold text-emerald-400">Ready to send</span>
              {activeTab === 'dm' && (
                <label className="flex items-center gap-1.5 cursor-pointer mt-0.5">
                  <input type="checkbox" checked={isViewOnceSelected} onChange={(e) => setIsViewOnceSelected(e.target.checked)} className="w-3 h-3 rounded" />
                  <span className="text-[9px] text-slate-400 font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> View Once</span>
                </label>
              )}
            </div>
            <button onClick={removeSelectedImage} className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 cursor-pointer flex-shrink-0 active:bg-rose-500 active:text-white">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Quick replies - horizontal scroll */}
        {!isGuest && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none mb-2 pb-0.5">
            {['👍 Sure!', '📚 Library', 'Kal class?', 'Got it!', 'Check notes', '🧠 Study?'].map(r => (
              <button key={r} onClick={() => setInputText(r)}
                className={`px-2.5 py-1 rounded-full border text-[10px] font-bold whitespace-nowrap flex-shrink-0 cursor-pointer active:scale-95 ${isDark ? 'border-white/[0.06] bg-white/[0.02] text-slate-400 active:bg-indigo-600/20 active:text-indigo-300' : 'border-slate-200 bg-slate-100 text-slate-600 active:bg-slate-200'}`}>
                {r}
              </button>
            ))}
          </div>
        )}

        {isGuest ? (
          <div className={`py-3 px-4 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-2 ${isDark ? 'bg-slate-950/40 border-white/[0.04] text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
            <Lock className="w-3.5 h-3.5" /> Guest Mode — Register to send messages
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <input type="file" accept="image/*" onChange={handleImageSelect} ref={fileInputRef} className="hidden" />

            {/* Attachment + dropdown */}
            <div className="relative flex-shrink-0">
              <button type="button" onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                className={`w-10 h-10 rounded-xl border flex items-center justify-center cursor-pointer active:scale-90 ${isDark ? 'border-white/[0.08] bg-[#1A1A24] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                <Plus className={`w-5 h-5 transition-transform duration-200 ${showAttachmentMenu ? 'rotate-45' : ''}`} />
              </button>
              {showAttachmentMenu && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowAttachmentMenu(false)} />
                  <div className={`absolute bottom-12 left-0 rounded-2xl border p-2 flex flex-col gap-1 z-30 shadow-2xl min-w-[160px] ${isDark ? 'bg-[#0E0E14] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
                    <button type="button" onClick={() => { setShowAttachmentMenu(false); fileInputRef.current?.click(); }}
                      className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold text-left cursor-pointer ${isDark ? 'hover:bg-white/5 text-slate-300' : 'hover:bg-slate-100 text-slate-700'}`}>
                      <ImageIcon className="w-4 h-4 text-indigo-400" /> Attach Photo
                    </button>
                    {activeTab === 'dm' && selectedDmUser && (
                      <>
                        <button type="button" onClick={() => { setShowAttachmentMenu(false); setIsNoteShareModalOpen(true); }}
                          className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold text-left cursor-pointer ${isDark ? 'hover:bg-white/5 text-slate-300' : 'hover:bg-slate-100 text-slate-700'}`}>
                          <Paperclip className="w-4 h-4 text-sky-400" /> Share Notes
                        </button>
                        <button type="button" onClick={() => { setShowAttachmentMenu(false); setIsPollModalOpen(true); }}
                          className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold text-left cursor-pointer ${isDark ? 'hover:bg-white/5 text-slate-300' : 'hover:bg-slate-100 text-slate-700'}`}>
                          <BarChart2 className="w-4 h-4 text-purple-400" /> Create Poll
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Text input */}
            <input
              type="text"
              placeholder={activeTab === 'global' ? 'Message the lounge...' : `Message ${selectedDmUser?.displayName || ''}...`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className={`flex-1 min-w-0 h-10 px-4 rounded-2xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500 ${isDark ? 'bg-[#1A1A24] border-white/[0.08] text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
            />

            {/* Send button */}
            <button type="submit" disabled={isSending || (!inputText.trim() && !selectedImage)}
              className="w-10 h-10 flex-shrink-0 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center disabled:opacity-40 cursor-pointer active:scale-90 shadow-lg shadow-indigo-600/25">
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    );

    // ── MOBILE: DM Contact List Screen ──
    if (activeTab === 'dm' && mobileView === 'list') {
      return (
        <div className={`fixed inset-0 flex flex-col ${isDark ? 'bg-[#0A0A10] text-[#E2E8F0]' : 'bg-[#F3F5FA] text-slate-800'}`}>

          {/* Header */}
          <div className={`flex-shrink-0 flex items-center justify-between px-4 pb-3 border-b ${isDark ? 'border-white/[0.06] bg-[#0D0D14]' : 'border-slate-200 bg-white'}`}
            style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('/')}
                className={`w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer active:scale-90 ${isDark ? 'border-white/10 bg-white/[0.04] text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className={`text-sm font-black leading-none ${isDark ? 'text-white' : 'text-slate-800'}`}>Messages</h1>
                <span className="text-[9px] text-slate-500 font-bold block mt-0.5">{onlineUsers.length} online</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Switch to global */}
              <button onClick={() => { setActiveTab('global'); navigate('/chat', { replace: true }); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black border cursor-pointer active:scale-95 ${isDark ? 'border-white/[0.08] text-slate-300 bg-white/[0.03]' : 'border-slate-200 text-slate-600 bg-slate-50'}`}>
                <Users className="w-3.5 h-3.5" /> Lounge
              </button>
            </div>
          </div>

          {/* Online stories strip */}
          {onlineUsers.length > 0 && (
            <div className={`flex-shrink-0 flex items-center gap-4 px-4 py-3 border-b overflow-x-auto scrollbar-none ${isDark ? 'border-white/[0.04] bg-[#0D0D14]/60' : 'border-slate-100 bg-white/80'}`}>
              {onlineUsers.map(online => (
                <button key={online.uid} onClick={() => { setSelectedDmUser({ id: online.uid, displayName: online.displayName, photoURL: online.photoURL, username: online.displayName.toLowerCase().replace(/ /g, '_'), branch: 'cse' }); setMobileView('chat'); fetchDmMessages(online.uid); }}
                  className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer active:scale-90">
                  <div className="relative">
                    {renderAvatar(online.photoURL || '', 'w-12 h-12 text-xl border-2 border-emerald-500')}
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0D0D14]" />
                  </div>
                  <span className="text-[9px] font-semibold text-slate-400 max-w-[48px] truncate">{online.displayName.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          )}

          {/* Search bar */}
          <div className={`flex-shrink-0 px-4 py-2 border-b ${isDark ? 'border-white/[0.04] bg-[#0D0D14]/40' : 'border-slate-100 bg-white/60'}`}>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="text" placeholder="Search classmates..." value={searchQuery} onChange={(e) => handleSearchUsers(e.target.value)}
                className={`w-full h-9 pl-9 pr-3 rounded-xl border text-sm font-medium placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isDark ? 'bg-white/[0.05] border-white/[0.08] text-white' : 'bg-slate-100 border-slate-200 text-slate-800'}`} />
            </div>
          </div>

          {/* Contact list / search results */}
          <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}>
            {searchQuery.trim() !== '' ? (
              <div className="p-3 space-y-2">
                <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Search Results</span>
                {isSearching ? (
                  <p className="text-xs text-slate-500 text-center py-6 font-bold">Searching...</p>
                ) : searchResults.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6 font-bold">No classmates found</p>
                ) : searchResults.map(peer => (
                  <button key={peer.id} onClick={() => handleStartDmChat(peer)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left cursor-pointer active:scale-[0.98] ${isDark ? 'border-white/[0.06] bg-white/[0.02] active:bg-indigo-600/10' : 'border-slate-200 bg-white active:bg-indigo-50'}`}>
                    {renderAvatar(peer.photoURL || '', 'w-11 h-11 text-xl')}
                    <div className="flex-1 min-w-0">
                      <span className={`block text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{peer.displayName}</span>
                      <span className="block text-xs text-slate-500">@{peer.username} · {peer.branch?.toUpperCase()}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : dmContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center gap-3 py-20 px-6">
                <MessageSquare className="w-12 h-12 text-slate-600" />
                <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-700'}`}>No conversations yet</p>
                <p className="text-xs text-slate-500">Search a classmate above to start a private chat!</p>
              </div>
            ) : (
              <div className="py-1">
                {dmContacts.map(contact => {
                  const isPinned = pinnedUids.includes(contact.uid);
                  const isOnline = onlineUsers.some(u => u.uid === contact.uid);
                  return (
                    <button key={contact.uid} onClick={() => { setSelectedDmUser({ id: contact.uid, displayName: contact.displayName, photoURL: contact.photoURL, username: contact.username, branch: contact.branch }); setMobileView('chat'); fetchDmMessages(contact.uid); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 border-b cursor-pointer active:scale-[0.98] text-left transition-colors ${isDark ? 'border-white/[0.04] active:bg-white/[0.04]' : 'border-slate-100 active:bg-slate-50'}`}>
                      {/* Avatar with online dot */}
                      <div className="relative flex-shrink-0">
                        {renderAvatar(contact.photoURL, 'w-12 h-12 text-xl')}
                        {isOnline
                          ? <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#0A0A10]" />
                          : <span className="absolute -bottom-0.5 -right-0.5 text-sm">{getBranchIcon(contact.branch)}</span>
                        }
                        {isPinned && <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-indigo-600 border border-indigo-500 flex items-center justify-center"><Pin className="w-2 h-2 text-white" /></span>}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{contact.displayName}</span>
                          <span className="text-[10px] text-slate-500 flex-shrink-0 ml-2">{formatTime(contact.lastMessageTime)}</span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">{contact.lastMessage}</p>
                      </div>
                      {/* Unread badge */}
                      {contact.unreadCount > 0 && (
                        <span className="flex-shrink-0 min-w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center px-1 animate-pulse">{contact.unreadCount}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }

    // ── MOBILE: Global Lounge Screen ──
    if (activeTab === 'global') {
      return (
        <div className={`fixed inset-0 flex flex-col ${isDark ? 'bg-[#0A0A10] text-[#E2E8F0]' : 'bg-[#F3F5FA] text-slate-800'} ${getThemeClasses()}`}
          style={{ ...getThemeStyle() }}>

          {/* Header */}
          <div className={`flex-shrink-0 flex items-center justify-between px-4 pb-3 border-b ${isDark ? 'border-white/[0.06] bg-[#0D0D14]/80' : 'border-slate-200 bg-white/90'}`}
            style={{ backdropFilter: 'blur(12px)', paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('/')}
                className={`w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer active:scale-90 ${isDark ? 'border-white/10 bg-white/[0.04] text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="w-8 h-8 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-base flex-shrink-0">💬</div>
              <div>
                <h1 className={`text-xs font-black leading-none ${isDark ? 'text-white' : 'text-slate-800'}`}>Campus Lounge</h1>
                <span className="text-[9px] text-slate-500 font-bold block mt-0.5">{onlineUsers.length} online</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setIsThemeModalOpen(true)} className={`w-8 h-8 rounded-xl border flex items-center justify-center cursor-pointer active:scale-90 ${isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                <Paintbrush className="w-4 h-4" />
              </button>
              <button onClick={() => { setActiveTab('dm'); setMobileView('list'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black border cursor-pointer active:scale-95 ${isDark ? 'border-white/[0.08] text-slate-300 bg-white/[0.03]' : 'border-slate-200 text-slate-600 bg-slate-50'}`}>
                <MessageCircle className="w-3.5 h-3.5" />
                DMs
                {dmContacts.reduce((a, c) => a + c.unreadCount, 0) > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
              </button>
            </div>
          </div>

          {/* Lounge notice */}
          <div className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b text-[10px] ${isDark ? 'border-white/[0.04] text-rose-400/70 bg-rose-500/5' : 'border-rose-100 text-rose-600 bg-rose-50'}`}>
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Messages expire in 7 days · No PDFs · Be respectful</span>
          </div>

          {/* Messages area */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3" style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
            {renderMobileMessages(messages)}
          </div>

          <MobileInputBar />

          {/* Shared modals */}
          {zoomedImage && (
            <div onClick={() => setZoomedImage(null)} className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
              <button onClick={() => setZoomedImage(null)} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white z-50 cursor-pointer active:scale-90"><X className="w-5 h-5" /></button>
              <img src={zoomedImage} alt="Zoomed" className="max-w-full max-h-[80vh] object-contain rounded-2xl select-none" />
            </div>
          )}
          {isThemeModalOpen && (
            <div className="fixed inset-0 z-50 flex items-end">
              <div onClick={() => setIsThemeModalOpen(false)} className="absolute inset-0 bg-black/60" />
              <div className={`w-full rounded-t-3xl border-t p-5 flex flex-col gap-4 relative z-10 max-h-[70vh] ${isDark ? 'bg-[#0E0E14] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-sm text-indigo-400 flex items-center gap-2"><Paintbrush className="w-4 h-4" /> Chat Theme</h3>
                  <button onClick={() => setIsThemeModalOpen(false)} className="p-1.5 rounded-xl cursor-pointer active:scale-90 text-slate-400"><X className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-3 gap-3 overflow-y-auto">
                  {CHAT_THEMES.map(themeItem => {
                    const currentRoomId = 'global';
                    const currentTheme = chatThemes[currentRoomId] || 'Default';
                    const isSelected = currentTheme === themeItem.name;
                    return (
                      <button key={themeItem.name} onClick={() => { const updated = { ...chatThemes, [currentRoomId]: themeItem.name }; setChatThemes(updated); localStorage.setItem('noteweb-chat-themes', JSON.stringify(updated)); toastSuccess(`${themeItem.name} applied!`); setIsThemeModalOpen(false); }}
                        className={`p-2 rounded-2xl border text-left cursor-pointer active:scale-95 ${isSelected ? 'border-indigo-500 ring-1 ring-indigo-500/30' : isDark ? 'border-white/[0.05] bg-white/[0.02]' : 'border-slate-200 bg-slate-50'}`}>
                        <div className={`h-14 rounded-xl mb-1.5 ${themeItem.previewBg}`} style={themeItem.previewStyle} />
                        <span className={`text-[10px] font-black truncate block ${isSelected ? 'text-indigo-400' : isDark ? 'text-slate-300' : 'text-slate-700'}`}>{themeItem.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // ── MOBILE: DM Chat Screen ──
    return (
      <div className={`fixed inset-0 flex flex-col ${isDark ? 'bg-[#0A0A10] text-[#E2E8F0]' : 'bg-[#F3F5FA] text-slate-800'} ${getThemeClasses()}`}
        style={{ ...getThemeStyle() }}>

        {/* DM Chat Header */}
        <div className={`flex-shrink-0 flex items-center gap-2 px-3 pb-3 border-b ${isDark ? 'border-white/[0.06] bg-[#0D0D14]/80' : 'border-slate-200 bg-white/90'}`}
          style={{ backdropFilter: 'blur(12px)', paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
          {/* Back button */}
          <button onClick={() => { setMobileView('list'); setSelectedDmUser(null); navigate('/chat', { replace: true }); }}
            className={`w-9 h-9 flex-shrink-0 rounded-xl border flex items-center justify-center cursor-pointer active:scale-90 ${isDark ? 'border-white/10 bg-white/[0.04] text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* User info — tappable to profile */}
          <div onClick={() => selectedDmUser && navigate(`/profile/${selectedDmUser.id}`)} className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer active:opacity-70">
            <div className="relative flex-shrink-0">
              {renderAvatar(selectedDmUser?.photoURL || '', 'w-9 h-9 text-lg')}
              {onlineUsers.some(u => u.uid === selectedDmUser?.id) && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0D0D14]" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className={`text-sm font-black leading-none truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {selectedDmUser?.displayName} <span className="text-sm">{getBranchIcon(selectedDmUser?.branch || 'cse')}</span>
              </h2>
              <span className="text-[10px] mt-0.5 block">
                {partnerIsTyping
                  ? <span className="text-indigo-400 font-bold italic animate-pulse">typing...</span>
                  : onlineUsers.some(u => u.uid === selectedDmUser?.id)
                    ? <span className="text-emerald-400 font-bold">● Active now</span>
                    : <span className="text-slate-500">@{selectedDmUser?.username}</span>
                }
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => startWebRtcCall('voice')} className={`w-8 h-8 rounded-xl border flex items-center justify-center cursor-pointer active:scale-90 ${isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}><Phone className="w-4 h-4" /></button>
            <button onClick={() => startWebRtcCall('video')} className={`w-8 h-8 rounded-xl border flex items-center justify-center cursor-pointer active:scale-90 ${isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}><Video className="w-4 h-4" /></button>

            {/* Three-dot menu */}
            <div className="relative">
              <button type="button" onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                className={`w-8 h-8 rounded-xl border flex items-center justify-center cursor-pointer active:scale-90 ${showHeaderMenu ? 'border-indigo-500 bg-indigo-600/20 text-indigo-400' : isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                <MoreVertical className="w-4 h-4" />
              </button>
              {showHeaderMenu && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowHeaderMenu(false)} />
                  <div className={`absolute right-0 top-10 rounded-2xl border p-2 flex flex-col gap-1 z-30 shadow-2xl min-w-[190px] ${isDark ? 'bg-[#0E0E14] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
                    {[
                      { icon: <Paintbrush className="w-4 h-4 text-indigo-400" />, label: 'Personalize Theme', action: () => { setShowHeaderMenu(false); setIsThemeModalOpen(true); } },
                      { icon: <Star className="w-4 h-4 text-amber-400" />, label: 'Starred Messages', action: () => { setShowHeaderMenu(false); setIsStarDrawerOpen(true); } },
                      { icon: <ShieldAlert className="w-4 h-4 text-rose-400" />, label: vanishMode ? 'Disable Vanish' : 'Vanish Mode', action: () => { setShowHeaderMenu(false); setVanishMode(!vanishMode); toastSuccess(!vanishMode ? 'Vanish Mode on' : 'Vanish Mode off'); } },
                      { icon: mutedUids.includes(selectedDmUser?.id || '') ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-rose-400" />, label: mutedUids.includes(selectedDmUser?.id || '') ? 'Unmute' : 'Mute', action: () => { setShowHeaderMenu(false); handleToggleMute(selectedDmUser?.id || ''); } },
                      { icon: <Shield className="w-4 h-4 text-rose-400" />, label: 'Block Classmate', action: () => { setShowHeaderMenu(false); handleToggleBlock(selectedDmUser?.id || ''); }, danger: true },
                    ].map(item => (
                      <button key={item.label} type="button" onClick={item.action}
                        className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold text-left cursor-pointer ${item.danger ? 'text-rose-400 hover:bg-rose-500/10' : isDark ? 'hover:bg-white/5 text-slate-300' : 'hover:bg-slate-100 text-slate-700'}`}>
                        {item.icon} {item.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3" style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
          {renderMobileMessages(dmMessages)}
        </div>

        <MobileInputBar />

        {/* Shared Modals - Lightbox */}
        {zoomedImage && (
          <div onClick={() => setZoomedImage(null)} className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
            <button onClick={() => setZoomedImage(null)} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white z-50 cursor-pointer active:scale-90"><X className="w-5 h-5" /></button>
            <img src={zoomedImage} alt="Zoomed" className="max-w-full max-h-[80vh] object-contain rounded-2xl select-none" />
          </div>
        )}

        {/* Starred drawer */}
        {isStarDrawerOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div onClick={() => setIsStarDrawerOpen(false)} className="absolute inset-0 bg-black/60" />
            <div className={`w-full rounded-t-3xl border-t p-5 relative z-10 max-h-[75vh] flex flex-col ${isDark ? 'bg-[#0E0E12] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-sm flex items-center gap-2"><Star className="w-4 h-4 text-amber-400 fill-current" /> Starred Messages</h3>
                <button onClick={() => setIsStarDrawerOpen(false)} className="p-1.5 rounded-xl text-slate-400 cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {starredMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center gap-2 py-12">
                    <Star className="w-8 h-8 text-slate-600" />
                    <p className="text-xs text-slate-400 font-bold">No starred messages yet</p>
                  </div>
                ) : starredMessages.map(msg => (
                  <div key={msg.id} className={`p-3 rounded-2xl border relative ${isDark ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-slate-50 border-slate-200'}`}>
                    <button onClick={() => handleToggleStar(msg)} className="absolute top-2 right-2 p-1 text-amber-400 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                    <div className="flex items-center gap-2 mb-1.5">
                      {renderAvatar(msg.sender_avatar || '', 'w-6 h-6 text-xs')}
                      <span className="text-[10px] font-black">{msg.sender_name}</span>
                      <span className="text-[8px] text-slate-500 ml-auto">{formatTime(msg.created_at)}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed break-words">{msg.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Theme picker bottom sheet */}
        {isThemeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end">
            <div onClick={() => setIsThemeModalOpen(false)} className="absolute inset-0 bg-black/60" />
            <div className={`w-full rounded-t-3xl border-t p-5 flex flex-col gap-4 relative z-10 max-h-[70vh] ${isDark ? 'bg-[#0E0E14] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-black text-sm text-indigo-400 flex items-center gap-2"><Paintbrush className="w-4 h-4" /> Chat Theme</h3>
                <button onClick={() => setIsThemeModalOpen(false)} className="p-1.5 rounded-xl cursor-pointer active:scale-90 text-slate-400"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-3 gap-3 overflow-y-auto">
                {CHAT_THEMES.map(themeItem => {
                  const currentRoomId = selectedDmUser ? selectedDmUser.id : 'global';
                  const currentTheme = chatThemes[currentRoomId] || 'Default';
                  const isSelected = currentTheme === themeItem.name;
                  return (
                    <button key={themeItem.name} onClick={() => { const updated = { ...chatThemes, [currentRoomId]: themeItem.name }; setChatThemes(updated); localStorage.setItem('noteweb-chat-themes', JSON.stringify(updated)); toastSuccess(`${themeItem.name} applied!`); setIsThemeModalOpen(false); }}
                      className={`p-2 rounded-2xl border text-left cursor-pointer active:scale-95 ${isSelected ? 'border-indigo-500 ring-1 ring-indigo-500/30' : isDark ? 'border-white/[0.05] bg-white/[0.02]' : 'border-slate-200 bg-slate-50'}`}>
                      <div className={`h-14 rounded-xl mb-1.5 ${themeItem.previewBg}`} style={themeItem.previewStyle} />
                      <span className={`text-[10px] font-black truncate block ${isSelected ? 'text-indigo-400' : isDark ? 'text-slate-300' : 'text-slate-700'}`}>{themeItem.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Note share modal */}
        {isNoteShareModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end">
            <div onClick={() => { setIsNoteShareModalOpen(false); setSearchNoteQuery(''); setNoteSearchResults([]); }} className="absolute inset-0 bg-black/60" />
            <div className={`w-full rounded-t-3xl border-t p-5 flex flex-col gap-4 relative z-10 max-h-[70vh] ${isDark ? 'bg-[#0E0E14] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-black text-sm text-indigo-400 flex items-center gap-2"><Paperclip className="w-4 h-4" /> Share Study Notes</h3>
                <button onClick={() => { setIsNoteShareModalOpen(false); setSearchNoteQuery(''); setNoteSearchResults([]); }} className="p-1.5 rounded-xl cursor-pointer text-slate-400"><X className="w-4 h-4" /></button>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="text" placeholder="Search notes by subject..." value={searchNoteQuery} onChange={(e) => handleSearchNotes(e.target.value)}
                  className={`w-full h-10 pl-9 pr-3 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isDark ? 'bg-white/[0.05] border-white/[0.08] text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'}`} />
              </div>
              <div className="flex-1 overflow-y-auto space-y-2">
                {searchNoteQuery.trim() === '' ? (
                  <p className="text-center py-6 text-slate-500 text-xs font-bold">Type subject name to search notes</p>
                ) : noteSearchResults.length === 0 ? (
                  <p className="text-center py-6 text-slate-500 text-xs font-bold">No notes found</p>
                ) : noteSearchResults.map(note => (
                  <button key={note.id} onClick={() => handleShareNoteMessage(note)}
                    className={`w-full p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer text-left active:scale-[0.98] ${isDark ? 'border-white/[0.06] bg-white/[0.02] active:bg-indigo-600/10' : 'border-slate-200 bg-slate-50 active:bg-indigo-50'}`}>
                    <div className="min-w-0">
                      <span className={`block text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{note.subject}</span>
                      <span className="text-xs text-slate-500">{note.branch?.toUpperCase()} · {note.professor || 'Unknown'}</span>
                    </div>
                    <span className="px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 text-[10px] font-black flex-shrink-0">Share</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Poll modal */}
        {isPollModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end">
            <div onClick={() => { setIsPollModalOpen(false); setPollQuestion(''); setPollOptions(['', '']); }} className="absolute inset-0 bg-black/60" />
            <div className={`w-full rounded-t-3xl border-t p-5 flex flex-col gap-4 relative z-10 ${isDark ? 'bg-[#0E0E14] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-black text-sm text-indigo-400 flex items-center gap-2"><BarChart2 className="w-4 h-4" /> Create Poll</h3>
                <button onClick={() => { setIsPollModalOpen(false); setPollQuestion(''); setPollOptions(['', '']); }} className="p-1.5 rounded-xl cursor-pointer text-slate-400"><X className="w-4 h-4" /></button>
              </div>
              <input type="text" placeholder="Poll question..." value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)}
                className={`w-full h-10 px-3.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isDark ? 'bg-white/[0.05] border-white/[0.08] text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800'}`} />
              <div className="space-y-2">
                {pollOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input type="text" placeholder={`Option ${idx + 1}`} value={opt} onChange={(e) => { const u = [...pollOptions]; u[idx] = e.target.value; setPollOptions(u); }}
                      className={`flex-1 h-10 px-3.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isDark ? 'bg-white/[0.05] border-white/[0.08] text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800'}`} />
                    {pollOptions.length > 2 && <button type="button" onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))} className="p-2 rounded-xl bg-rose-500/10 text-rose-400 cursor-pointer active:bg-rose-500 active:text-white"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                ))}
                {pollOptions.length < 4 && <button type="button" onClick={() => setPollOptions([...pollOptions, ''])} className="text-[11px] font-black text-indigo-400 flex items-center gap-1 cursor-pointer"><Plus className="w-3.5 h-3.5" /> Add Option</button>}
              </div>
              <button type="button" onClick={handleCreatePollMessage} className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm cursor-pointer active:scale-95 shadow-lg flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Send Poll
              </button>
            </div>
          </div>
        )}

        {/* WebRTC Call overlay */}
        {callState !== 'idle' && (
          <div className="fixed inset-0 z-50 bg-[#07070A]/95 flex flex-col items-center justify-center p-6 text-white text-center">
            <div className="absolute w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
            <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-xs">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{callType === 'video' ? '📽️ Video Call' : '📞 Voice Call'}</span>
              <h2 className="text-xl font-black">{callState === 'incoming' ? 'Incoming...' : callState === 'calling' ? 'Calling...' : 'Connected'}</h2>
              <div className="relative w-52 h-52 rounded-3xl overflow-hidden border border-white/10 bg-slate-900/60 flex items-center justify-center">
                {callState === 'connected' && callType === 'video' && remoteStream && !isCameraOff
                  ? <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  : <div className="flex flex-col items-center gap-2">
                      {renderAvatar(callerProfile?.photoURL || '', 'w-24 h-24 text-3xl border-4 border-indigo-500/30 animate-pulse')}
                      <span className="font-bold text-sm">{callerProfile?.displayName || 'Classmate'}</span>
                    </div>
                }
                {callState === 'connected' && callType === 'video' && localStream && (
                  <div className="absolute bottom-2 right-2 w-16 h-24 rounded-xl overflow-hidden border border-white/20 bg-black/60">
                    {!isCameraOff ? <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[9px] text-slate-500">Cam Off</div>}
                  </div>
                )}
              </div>
              {callState === 'incoming' ? (
                <div className="flex items-center gap-8">
                  <button onClick={declineIncomingCall} className="w-14 h-14 rounded-full bg-rose-600 text-white flex items-center justify-center cursor-pointer active:scale-90 shadow-lg shadow-rose-600/30"><PhoneOff className="w-6 h-6" /></button>
                  <button onClick={acceptIncomingCall} className="w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center cursor-pointer active:scale-95 shadow-lg shadow-emerald-600/30 animate-bounce"><Phone className="w-6 h-6" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  {callState === 'connected' && (
                    <>
                      <button onClick={() => { if (localStream) { localStream.getAudioTracks().forEach(t => { t.enabled = !t.enabled; }); setIsMicMuted(!isMicMuted); } }} className={`w-12 h-12 rounded-full border flex items-center justify-center cursor-pointer active:scale-90 ${isMicMuted ? 'bg-rose-600/20 border-rose-500 text-rose-400' : 'bg-white/10 border-white/10 text-white'}`}>{isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}</button>
                      {callType === 'video' && <button onClick={() => { if (localStream) { localStream.getVideoTracks().forEach(t => { t.enabled = !t.enabled; }); setIsCameraOff(!isCameraOff); } }} className={`w-12 h-12 rounded-full border flex items-center justify-center cursor-pointer active:scale-90 ${isCameraOff ? 'bg-rose-600/20 border-rose-500 text-rose-400' : 'bg-white/10 border-white/10 text-white'}`}>{isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}</button>}
                    </>
                  )}
                  <button onClick={endActiveCall} className="w-14 h-14 rounded-full bg-rose-600 text-white flex items-center justify-center cursor-pointer active:scale-90 shadow-lg shadow-rose-600/30"><PhoneOff className="w-6 h-6" /></button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
  // ─────────────────────────────────────────────────────────────
  // PC UI — Original layout below (untouched)
  // ─────────────────────────────────────────────────────────────
  return (
    <div className={`w-full py-2 px-2 md:py-6 md:px-8 relative overflow-hidden flex flex-col items-center transition-colors duration-300 ${
      isDark ? 'bg-transparent text-[#E2E8F0]' : 'bg-transparent text-slate-800'
    } h-[calc(100vh-4rem)] max-h-[750px]`}>
      
      {/* Background accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse" />

      <div className="w-full max-w-5xl flex-1 flex flex-col gap-2 md:gap-4 z-10 relative h-full overflow-hidden min-h-0">
        
        {/* Toggle navigation header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex p-1 bg-white/[0.02] border border-white/[0.04] rounded-2xl flex-1 sm:flex-initial">
            <button
              onClick={() => {
                setActiveTab('global');
                // Remove parameter from URL securely
                navigate('/chat', { replace: true });
              }}
              className={`flex-1 py-2 px-3 sm:px-6 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
                activeTab === 'global' ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="truncate">Campus Lounge</span>
            </button>
            <button
              onClick={() => setActiveTab('dm')}
              className={`flex-1 py-2 px-3 sm:px-6 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
                activeTab === 'dm' ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="truncate">Private DMs</span>
              {dmContacts.reduce((acc, c) => acc + c.unreadCount, 0) > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse flex-shrink-0" />
              )}
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-xl text-xs font-bold flex-shrink-0">
            <Clock className="w-3.5 h-3.5" />
            <span>7d Auto Expiry</span>
          </div>
        </div>

        {/* Lounge banner warning */}
        {activeTab === 'global' && (
          <div className={`flex items-center gap-2 p-2.5 border rounded-xl text-xs text-left ${isDark ? 'bg-rose-500/5 border-rose-500/10 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700 font-medium'}`}>
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-rose-450" />
            <p className="leading-tight">
              <strong>Lounge:</strong> Messages expire in 7 days. No PDFs. Be respectful.
            </p>
          </div>
        )}

        {/* Chat layout grid */}
        <div className="flex-1 min-h-0 flex gap-2 md:gap-4 overflow-hidden relative">
          
          {/* DM LIST SIDEBAR (Only visible when activeTab === 'dm') */}
          {activeTab === 'dm' && (
            <GlassPanel className={`w-full md:w-80 rounded-2xl md:rounded-3xl p-3 md:p-4 flex-col gap-3 md:gap-4 border ${isDark ? 'bg-[#121218]/45 border-white/[0.08]' : 'bg-white border-slate-200/80 shadow-md'} ${
              mobileView === 'chat' && selectedDmUser ? 'hidden md:flex' : 'flex'
            }`}>
              
              {/* Users search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search classmate to DM..."
                  value={searchQuery}
                  onChange={(e) => handleSearchUsers(e.target.value)}
                  className={`w-full border rounded-xl py-2 pl-9 pr-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-semibold placeholder:text-slate-600 ${isDark ? 'bg-[#1A1A24]/60 border-white/[0.08] text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                />
              </div>

              {/* Search results drawer overlay */}
              {searchQuery.trim() !== '' && (
                <div className={`flex-1 overflow-y-auto space-y-2 border-t pt-2 ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
                  <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest text-left pl-1 mb-2">Search Results</span>
                  {isSearching ? (
                    <div className="text-xs text-slate-500 font-bold p-3 text-center">Searching peers...</div>
                  ) : searchResults.length === 0 ? (
                    <div className="text-xs text-slate-500 font-bold p-3 text-center">No classmates found</div>
                  ) : (
                    searchResults.map((peer) => (
                      <button
                        key={peer.id}
                        onClick={() => handleStartDmChat(peer)}
                        className={`w-full p-2.5 rounded-xl flex items-center gap-3 border text-left cursor-pointer transition-all ${
                          isDark ? 'border-white/[0.04] bg-[#161622]/40 hover:bg-indigo-600/10' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'
                        }`}
                      >
                        {renderAvatar(peer.photoURL || '', "w-8 h-8 text-md")}
                        <div className="flex-1 min-w-0">
                          <span className={`block text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{peer.displayName}</span>
                          <span className="block text-[10px] text-slate-500">@{peer.username}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Contacts List */}
              {searchQuery.trim() === '' && (
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  
                  {/* Active Bubbles scrollbar */}
                  {onlineUsers.length > 0 && (
                    <div className="flex flex-col gap-2 text-left border-b pb-3 mb-2 border-white/[0.06] light-mode:border-slate-200">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-1">Online Now</span>
                      <div className="flex items-center gap-3 overflow-x-auto pb-1.5 scrollbar-none horizontal-scroll-list">
                        {onlineUsers.map((online) => (
                          <button
                            key={online.uid}
                            onClick={() => {
                              setSelectedDmUser({
                                id: online.uid,
                                displayName: online.displayName,
                                photoURL: online.photoURL,
                                username: online.displayName.toLowerCase().replace(/ /g, '_'),
                                branch: 'cse'
                              });
                              setMobileView('chat');
                              fetchDmMessages(online.uid);
                            }}
                            className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-all group"
                          >
                            <div className="relative">
                              {renderAvatar(online.photoURL || '', "w-10 h-10 text-lg border-2 border-indigo-500/20 group-hover:border-indigo-500/60 transition-all")}
                              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#121218] animate-pulse" />
                            </div>
                            <span className="text-[9px] font-semibold max-w-[50px] truncate text-slate-400 group-hover:text-white transition-colors">{online.displayName.split(' ')[0]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest text-left pl-1 mb-2">Active Chats</span>
                  {dmContacts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-slate-500 py-12">
                      <MessageSquare className="w-8 h-8 text-slate-600 animate-pulse" />
                      <span className="text-[11px] font-extrabold text-slate-500">No private chats yet.</span>
                      <span className="text-[9px] text-slate-600 max-w-[180px]">Find classmates on Leaderboard or search them above to DM!</span>
                    </div>
                  ) : (
                    dmContacts.map((contact) => {
                      const isSelected = selectedDmUser?.id === contact.uid;
                      const isContactOnline = onlineUsers.some(u => u.uid === contact.uid);
                      const isPinned = pinnedUids.includes(contact.uid);
                      return (
                        <div key={contact.uid} className="relative group/contact">
                          <button
                            onClick={() => {
                              setSelectedDmUser({
                                id: contact.uid,
                                displayName: contact.displayName,
                                photoURL: contact.photoURL,
                                username: contact.username,
                                branch: contact.branch
                              });
                              setMobileView('chat');
                              fetchDmMessages(contact.uid);
                            }}
                            className={`w-full p-3 pr-12 rounded-2xl flex items-center gap-3 border text-left transition-all cursor-pointer relative ${
                              isSelected 
                                ? 'bg-indigo-600 border-indigo-500 text-white' 
                                : isDark 
                                  ? 'bg-[#181822]/40 border-white/[0.04] text-slate-300 hover:bg-[#1A1A24]/75' 
                                  : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                            }`}
                          >
                            <div className="relative">
                              {renderAvatar(contact.photoURL, "w-10 h-10 text-xl")}
                              {isContactOnline ? (
                                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-555 border-2 border-[#121218]" />
                              ) : (
                                <span className="absolute -bottom-1 -right-1 text-xs">{getBranchIcon(contact.branch)}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className={`text-xs font-extrabold truncate ${isSelected ? 'text-white' : isDark ? 'text-white' : 'text-slate-805'}`}>{contact.displayName}</span>
                                <span className={`text-[8px] font-bold ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>{formatTime(contact.lastMessageTime)}</span>
                              </div>
                              <p className={`text-[10px] truncate mt-0.5 ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                                {contact.lastMessage}
                              </p>
                            </div>
                            
                            {/* Unread bubble count */}
                            {contact.unreadCount > 0 && !isSelected && (
                              <span className="absolute right-10 top-1/2 -translate-y-1/2 min-w-4 h-4 rounded-full bg-rose-500 text-white font-extrabold text-[9px] flex items-center justify-center px-1 animate-pulse">
                                {contact.unreadCount}
                              </span>
                            )}

                            {/* Pin chat button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleTogglePin(contact.uid);
                              }}
                              className={`absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg opacity-0 group-hover/contact:opacity-100 transition-all active:scale-90 ${
                                isPinned 
                                  ? 'opacity-100 text-indigo-400' 
                                  : isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-750'
                              }`}
                              title={isPinned ? "Unpin chat" : "Pin chat to top"}
                            >
                              {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                            </button>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </GlassPanel>
          )}

          {/* CHAT AREA (Main Display) */}
          <GlassPanel className={`flex-1 min-w-0 flex-col p-3 md:p-6 rounded-2xl md:rounded-3xl border ${isDark ? 'bg-[#121218]/45 border-white/[0.08]' : 'bg-white border-slate-200/80 shadow-md'} ${
            activeTab === 'dm' && (!selectedDmUser || mobileView === 'list') ? 'hidden md:flex' : 'flex'
          }`}>
            
            {activeTab === 'global' && (
              <div className={`flex flex-row items-center justify-between gap-2 pb-2.5 border-b mb-2.5 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 flex-shrink-0 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-base">
                    💬
                  </div>
                  <div className="min-w-0">
                    <h4 className={`text-xs font-black leading-none truncate ${isDark ? 'text-white' : 'text-slate-805'}`}>
                      Campus Lounge
                    </h4>
                    <span className="text-[9px] text-slate-500 mt-0.5 block leading-none">
                      {onlineUsers.length} online
                    </span>
                  </div>
                </div>
                
                {/* Advanced Action Bar for Global Chat */}
                <div className="flex items-center gap-1.5 justify-end flex-shrink-0">
                  {/* Wallpaper Theme Picker */}
                  <button
                    onClick={() => setIsThemeModalOpen(true)}
                    className={`p-2 rounded-xl transition-all cursor-pointer active:scale-95 border ${
                      isDark ? 'border-white/10 hover:bg-white/5 text-slate-350' : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                    }`}
                    title="Select lounge theme"
                  >
                    <Paintbrush className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'dm' && selectedDmUser && (
              <div className={`flex flex-row items-center justify-between gap-2 pb-2.5 border-b mb-2.5 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <button
                    onClick={() => {
                      setMobileView('list');
                      setSelectedDmUser(null);
                      // Clear the URL parameter cleanly
                      navigate('/chat', { replace: true });
                    }}
                    className={`p-1.5 rounded-xl border md:hidden flex-shrink-0 active:scale-95 cursor-pointer ${isDark ? 'border-white/10 bg-white/5 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div 
                    onClick={() => navigate(`/profile/${selectedDmUser.id}`)}
                    className="flex items-center gap-2 text-left cursor-pointer hover:scale-[1.01] transition-all min-w-0"
                  >
                    {renderAvatar(selectedDmUser.photoURL || '', "w-8 h-8 text-base flex-shrink-0")}
                    <div className="min-w-0">
                      <h4 className={`text-xs font-black flex items-center gap-1 leading-none truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        <span className="truncate">{selectedDmUser.displayName}</span>
                        <span className="text-[10px] flex-shrink-0">{getBranchIcon(selectedDmUser.branch)}</span>
                      </h4>
                      <span className="text-[9px] text-slate-500 mt-0.5 block">
                        {partnerIsTyping ? (
                          <span className="text-indigo-400 font-extrabold italic animate-pulse">typing...</span>
                        ) : onlineUsers.some(u => u.uid === selectedDmUser.id) ? (
                          <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" /> Active
                          </span>
                        ) : (
                          `@${selectedDmUser.username}`
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Advanced Action Bar */}
                <div className="flex items-center gap-1.5 justify-end relative">
                  {/* Call Actions */}
                  <button
                    onClick={() => startWebRtcCall('voice')}
                    className={`p-2 rounded-xl transition-all cursor-pointer active:scale-95 border ${
                      isDark ? 'border-white/10 hover:bg-white/5 text-slate-350' : 'border-slate-200 hover:bg-slate-100 text-slate-655'
                    }`}
                    title="Start voice call"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => startWebRtcCall('video')}
                    className={`p-2 rounded-xl transition-all cursor-pointer active:scale-95 border ${
                      isDark ? 'border-white/10 hover:bg-white/5 text-slate-355' : 'border-slate-200 hover:bg-slate-100 text-slate-655'
                    }`}
                    title="Start video call"
                  >
                    <Video className="w-4 h-4" />
                  </button>

                  {/* Dropdown Menu Toggle for other settings */}
                  <div className="relative flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                      className={`p-2 rounded-xl transition-all cursor-pointer active:scale-95 border ${
                        showHeaderMenu
                          ? 'border-indigo-500 bg-indigo-650/20 text-indigo-400'
                          : isDark ? 'border-white/10 hover:bg-white/5 text-slate-300' : 'border-slate-200 hover:bg-slate-50 text-slate-705'
                      }`}
                      title="More chat settings"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {showHeaderMenu && (
                      <>
                        {/* Backdrop blocker */}
                        <div 
                          className="fixed inset-0 z-20 cursor-default" 
                          onClick={() => setShowHeaderMenu(false)} 
                        />
                        
                        <div className={`absolute right-0 top-full mt-2 rounded-2xl border p-2 flex flex-col gap-1 z-30 shadow-2xl min-w-[190px] animate-in fade-in slide-in-from-top-2 ${
                          isDark ? 'bg-[#0E0E14] border-white/[0.08]' : 'bg-white border-slate-200'
                        }`}>
                          {/* Wallpaper Theme Picker */}
                          <button
                            type="button"
                            onClick={() => {
                              setShowHeaderMenu(false);
                              setIsThemeModalOpen(true);
                            }}
                            className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold transition-all text-left ${
                              isDark ? 'hover:bg-white/5 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            <Paintbrush className="w-4 h-4 text-indigo-455" />
                            <span>Personalize Theme</span>
                          </button>

                          {/* Starred Drawer Folder */}
                          <button
                            type="button"
                            onClick={() => {
                              setShowHeaderMenu(false);
                              setIsStarDrawerOpen(true);
                            }}
                            className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold transition-all text-left ${
                              isDark ? 'hover:bg-white/5 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            <Star className="w-4 h-4 text-amber-400" />
                            <span>Starred Messages</span>
                          </button>

                          {/* Vanish Mode Switcher */}
                          <button
                            type="button"
                            onClick={() => {
                              setShowHeaderMenu(false);
                              setVanishMode(!vanishMode);
                              toastSuccess(!vanishMode ? "Vanish Mode activated! Messages will delete when closing chat." : "Vanish Mode deactivated.");
                            }}
                            className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold transition-all text-left ${
                              vanishMode 
                                ? 'bg-indigo-600/10 text-indigo-400' 
                                : isDark ? 'hover:bg-white/5 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            <ShieldAlert className="w-4 h-4 text-rose-400" />
                            <span>{vanishMode ? "Disable Vanish" : "Vanish Mode"}</span>
                          </button>

                          {/* Local Mute Chat */}
                          <button
                            type="button"
                            onClick={() => {
                              setShowHeaderMenu(false);
                              handleToggleMute(selectedDmUser.id);
                            }}
                            className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold transition-all text-left ${
                              mutedUids.includes(selectedDmUser.id) 
                                ? 'bg-rose-600/10 text-rose-455' 
                                : isDark ? 'hover:bg-white/5 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            {mutedUids.includes(selectedDmUser.id) ? (
                              <><Volume2 className="w-4 h-4 text-emerald-450" /><span>Unmute Notifications</span></>
                            ) : (
                              <><VolumeX className="w-4 h-4 text-rose-455" /><span>Mute Notifications</span></>
                            )}
                          </button>

                          {/* Local Block Chat */}
                          <button
                            type="button"
                            onClick={() => {
                              setShowHeaderMenu(false);
                              handleToggleBlock(selectedDmUser.id);
                            }}
                            className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold transition-all text-left text-rose-455 hover:bg-rose-500/10`}
                          >
                            <Shield className="w-4 h-4" />
                            <span>Block Classmate</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Direct Messages - Empty Slate Prompt */}
            {activeTab === 'dm' && !selectedDmUser ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-slate-500 py-16">
                <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <UserCheck className="w-8 h-8" />
                </div>
                <div>
                  <h4 className={`font-black text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>Select a Classmate</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">Click on a classmate from search or the sidebar contacts to start a secure private discussion room.</p>
                </div>
              </div>
            ) : (
              /* Scrollable Message Timeline area */
              <div 
                className={`flex-1 min-h-0 overflow-y-auto space-y-3 pr-0.5 p-2 transition-all rounded-xl ${
                  (activeTab === 'global' || (activeTab === 'dm' && selectedDmUser)) ? getThemeClasses() : ''
                }`}
                style={(activeTab === 'global' || (activeTab === 'dm' && selectedDmUser)) ? getThemeStyle() : undefined}
              >
                {isLoading ? (
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs font-bold">
                    🔐 Accessing secure keys...
                  </div>
                ) : (activeTab === 'global' ? messages.length === 0 : dmMessages.length === 0) ? (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-slate-500 py-16">
                    <div className="w-12 h-12 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center text-indigo-400 text-xl">💬</div>
                    <div>
                      <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>Empty Room...</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">Send a message or a photo to start the chat vibe!</p>
                    </div>
                  </div>
                ) : (
                  (activeTab === 'global' ? messages : dmMessages).map((msg: any) => {
                    const isMe = activeTab === 'global' 
                      ? msg.sender_uid === user?.uid 
                      : msg.sender_id === user?.uid;
                    
                    const senderUid = activeTab === 'global' ? msg.sender_uid : msg.sender_id;
                    const senderName = activeTab === 'global' ? msg.sender_name : (isMe ? 'You' : selectedDmUser?.displayName);
                    const senderAvatar = activeTab === 'global' ? msg.sender_avatar : (isMe ? userProfile?.photoURL : selectedDmUser?.photoURL);
                    const senderBranch = activeTab === 'global' ? msg.sender_branch : (isMe ? userProfile?.branch : selectedDmUser?.branch);
                    const messageContent = activeTab === 'global' ? msg.content : msg.message;
                    const imageUrl = activeTab === 'global' ? msg.image_url : msg.photo_url;

                    return (
                      <motion.div 
                        key={msg.id}
                        initial={{ opacity: 0, scale: 0.85, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                        onDoubleClick={() => {
                          if (activeTab === 'dm') {
                            handleAddReaction(msg.id, '❤️');
                          }
                        }}
                        className={`flex items-end gap-3 ${isMe ? 'flex-row-reverse text-right' : 'text-left'}`}
                      >
                        {/* Avatar */}
                        <div 
                          onClick={() => senderUid && navigate(`/profile/${senderUid}`)} 
                          className="flex-shrink-0 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                        >
                          {renderAvatar(senderAvatar || '', "w-9 h-9 text-lg")}
                        </div>

                        {/* Chat Bubble */}
                         <div className="max-w-[80%] sm:max-w-[70%] space-y-1 min-w-0">
                          {/* Name Header */}
                          <div className={`flex items-center gap-1.5 text-[10px] font-extrabold tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'} ${isMe ? 'justify-end' : ''}`}>
                            <span 
                              onClick={() => senderUid && navigate(`/profile/${senderUid}`)} 
                              className="hover:text-indigo-500 transition-colors cursor-pointer"
                            >
                              {senderName}
                            </span>
                            <span>{getBranchIcon(senderBranch || 'cse')}</span>
                          </div>

                          {/* Content Card with edit/delete control for sender, and delete button for admin */}
                          <div className="flex items-center gap-2 group/msg w-full relative">
                            {/* Hover controls for emoji reactions, star, and reply */}
                            <div className={`flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-all duration-205 flex-shrink-0 ${isMe ? 'order-first mr-1' : 'order-last ml-1'}`}>
                              {activeTab === 'dm' && (
                                <>
                                  <button
                                    onClick={() => setReplyingTo(msg)}
                                    className="p-1 rounded-lg bg-white/10 hover:bg-indigo-600 text-slate-350 hover:text-white transition-all cursor-pointer active:scale-90"
                                    title="Reply to message"
                                  >
                                    <Quote className="w-3.5 h-3.5" />
                                  </button>
                                  
                                  {/* Fast reaction picker hover dropdown */}
                                  <div className="relative group/react">
                                    <button
                                      className="p-1 rounded-lg bg-white/10 hover:bg-indigo-600 text-slate-350 hover:text-white transition-all cursor-pointer"
                                      title="React"
                                    >
                                      <Smile className="w-3.5 h-3.5" />
                                    </button>
                                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 rounded-xl bg-slate-900 border border-white/10 p-1 flex gap-1 hidden group-hover/react:flex z-40 shadow-2xl">
                                      {['❤️', '👍', '😂', '😮', '😢', '🙏'].map(emoji => (
                                        <button
                                          key={emoji}
                                          onClick={() => handleAddReaction(msg.id, emoji)}
                                          className="text-xs hover:scale-125 transition-all p-1 cursor-pointer"
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </>
                              )}
                              
                              <button
                                onClick={() => handleToggleStar(msg)}
                                className={`p-1 rounded-lg bg-white/10 hover:bg-amber-500 text-slate-300 hover:text-white transition-all cursor-pointer active:scale-90 ${
                                  starredMessages.some(m => m.id === msg.id) ? 'text-amber-400 fill-current' : ''
                                }`}
                                title="Star message locally"
                              >
                                  <Star className="w-3.5 h-3.5" />
                              </button>

                              {isMe && (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingMsgId(msg.id);
                                      setEditingText(messageContent);
                                    }}
                                    className="p-1 rounded-lg bg-white/10 hover:bg-indigo-600 text-slate-355 hover:text-white transition-all cursor-pointer active:scale-90"
                                    title="Edit message"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteChat(msg.id)}
                                    className="p-1 rounded-lg bg-rose-550/15 hover:bg-rose-500 text-rose-400 hover:text-white transition-all cursor-pointer active:scale-90"
                                    title="Delete message"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>

                            <div className={`p-3.5 rounded-2xl border text-xs font-medium leading-relaxed break-words text-left flex-1 ${
                              isMe 
                                ? getMyBubbleTheme() + ' rounded-br-none shadow shadow-indigo-600/10' 
                                : getOtherBubbleTheme()
                            }`}>
                              {/* Quoted reply render */}
                              {msg.reply_to && (
                                <div className="mb-2.5 p-2 rounded-lg bg-black/20 border-l-4 border-indigo-550 text-[10px] text-slate-300 text-left truncate flex flex-col gap-0.5">
                                  <span className="font-extrabold text-[9px] text-indigo-400">Replying to {msg.reply_to.senderName}</span>
                                  <span>{msg.reply_to.content}</span>
                                </div>
                              )}

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
                                  {messageContent}
                                  
                                  {/* View Once Media card */}
                                  {msg.is_view_once && imageUrl && (
                                    <div className="mt-2.5 max-w-xs text-left">
                                      {viewOnceRevealed.includes(msg.id) ? (
                                        <div className="p-3 border border-white/10 rounded-xl bg-black/45 text-slate-400 text-[10px] flex items-center gap-2">
                                          <EyeOff className="w-4 h-4 text-rose-500" />
                                          <span>📷 View Once image expired</span>
                                        </div>
                                      ) : viewOnceViewing[msg.id] ? (
                                        <div className="relative rounded-xl overflow-hidden border border-white/10 shadow-lg bg-black/40">
                                          <img 
                                            src={imageUrl} 
                                            alt="View Once attachment" 
                                            className="max-h-60 w-full object-cover select-none"
                                          />
                                          <div className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur text-white text-[9px] font-bold flex items-center gap-1 animate-pulse">
                                            <Clock className="w-3 h-3 text-indigo-450" />
                                            <span>Self destructs in {viewOnceTimer[msg.id] || 5}s</span>
                                          </div>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => startViewOnceTimer(msg.id)}
                                          className="p-3 border border-indigo-500/20 rounded-xl bg-indigo-600/10 hover:bg-indigo-650/20 text-indigo-300 text-[10px] flex items-center gap-2 font-bold transition-all active:scale-98 cursor-pointer"
                                        >
                                          <Eye className="w-4 h-4 animate-pulse" />
                                          <span>📷 Tap to View Once (5 seconds)</span>
                                        </button>
                                      )}
                                    </div>
                                  )}

                                  {/* Standard attachment image */}
                                  {!msg.is_view_once && imageUrl && (
                                    <div 
                                      onClick={() => setZoomedImage(imageUrl || null)}
                                      className="mt-2.5 rounded-xl overflow-hidden border border-white/10 max-w-xs shadow-lg bg-black/40 cursor-zoom-in hover:opacity-90 active:scale-[0.99] transition-all"
                                      title="Click to zoom in"
                                    >
                                      <img 
                                        src={imageUrl} 
                                        alt="Shared attachment" 
                                        className="max-h-60 w-full object-cover select-none"
                                      />
                                    </div>
                                  )}

                                  {/* shared note card uploader link */}
                                  {msg.shared_note_id && (
                                    <div className={`mt-2.5 p-3 rounded-xl border text-left flex flex-col gap-2 ${
                                      isDark ? 'bg-slate-900/80 border-white/10' : 'bg-slate-100 border-slate-250 shadow-sm'
                                    }`}>
                                      <div className="flex items-center gap-2 text-indigo-400">
                                        <FileText className="w-5 h-5 flex-shrink-0" />
                                        <span className="text-xs font-black text-slate-250 light-mode:text-slate-800 truncate">Shared Study Note</span>
                                      </div>
                                      <div className="text-[10px] text-slate-400 light-mode:text-slate-600">
                                        Open this uploader notes attachment directly in the study player.
                                      </div>
                                      <a
                                        href={`/notes?noteId=${msg.shared_note_id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="py-1.5 px-3 rounded-lg bg-indigo-650 hover:bg-indigo-755 text-white font-extrabold text-[10px] text-center transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow shadow-indigo-600/10 cursor-pointer"
                                      >
                                        <Download className="w-3.5 h-3.5" /> View PDF Notes
                                      </a>
                                    </div>
                                  )}

                                  {/* Campus Study Poll card */}
                                  {msg.poll_data && (
                                    <div className={`mt-2.5 p-3 rounded-xl border text-left flex flex-col gap-2 min-w-[200px] ${
                                      isDark ? 'bg-slate-900/60 border-white/10' : 'bg-slate-50 border-slate-200'
                                    }`}>
                                      <h5 className="text-[11px] font-black text-slate-200 light-mode:text-slate-800 flex items-center gap-1.5">
                                        <BarChart2 className="w-4 h-4 text-indigo-400" />
                                        {msg.poll_data.question}
                                      </h5>
                                      <div className="space-y-1.5 mt-2">
                                        {msg.poll_data.options.map((opt: string, optIdx: number) => {
                                          const votesList = msg.poll_data.votes[String(optIdx)] || [];
                                          const totalVotes = Object.values(msg.poll_data.votes).reduce((acc: number, list: any) => acc + (list || []).length, 0);
                                          const pct = totalVotes > 0 ? Math.round((votesList.length / totalVotes) * 100) : 0;
                                          const hasVoted = votesList.includes(user?.uid || '');

                                          return (
                                            <button
                                              key={optIdx}
                                              type="button"
                                              onClick={() => handleCastPollVote(msg.id, optIdx)}
                                              className={`w-full text-left p-2 rounded-lg border text-[10px] relative overflow-hidden transition-all active:scale-98 cursor-pointer ${
                                                hasVoted 
                                                  ? 'border-indigo-500 bg-indigo-605/10 text-white font-extrabold' 
                                                  : isDark ? 'border-white/[0.04] bg-white/[0.02] text-slate-350 hover:bg-white/5' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                                              }`}
                                            >
                                              <div 
                                                className="absolute left-0 top-0 bottom-0 bg-indigo-500/10 transition-all duration-300"
                                                style={{ width: `${pct}%` }}
                                              />
                                              <div className="flex justify-between items-center relative z-10">
                                                <span>{opt}</span>
                                                <span className="text-[9px] text-slate-400 font-bold">{votesList.length} votes ({pct}%)</span>
                                              </div>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>

                            {!isMe && userProfile?.role === 'admin' && (
                              <button
                                onClick={() => handleDeleteChat(msg.id)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-455 hover:text-white transition-all opacity-0 group-hover/msg:opacity-100 cursor-pointer flex-shrink-0 active:scale-95 border border-rose-500/20"
                                title="Delete message"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Message Reactions display row */}
                          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                            <div className="flex items-center gap-1 mt-1.5 flex-wrap justify-start">
                              {Object.entries(msg.reactions).map(([emoji, uids]) => {
                                const uidsList = uids as string[];
                                const hasReacted = uidsList.includes(user?.uid || '');
                                return (
                                  <button
                                    key={emoji}
                                    onClick={() => handleAddReaction(msg.id, emoji)}
                                    className={`px-2 py-0.5 rounded-full border text-[9px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-90 ${
                                      hasReacted 
                                        ? 'bg-indigo-650/30 border-indigo-500 text-indigo-300' 
                                        : isDark ? 'bg-slate-900/60 border-white/5 text-slate-400 hover:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                                  >
                                    <span>{emoji}</span>
                                    <span>{uidsList.length}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Time footer */}
                          <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest px-1">
                            {formatTime(msg.created_at)}
                            {activeTab === 'dm' && isMe && (
                              <span className="ml-1.5">
                                {msg.is_read ? '✓✓ Read' : '✓ Sent'}
                              </span>
                            )}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Selected Image preview bar */}
            {selectedImage && selectedDmUser && (
              <div className={`p-3 border rounded-2xl mb-4 flex items-center justify-between gap-4 ${isDark ? 'bg-slate-950/50 border-white/[0.06]' : 'bg-slate-100 border-slate-200'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-lg overflow-hidden border ${isDark ? 'border-white/10 bg-black/50' : 'border-slate-250 bg-white'}`}>
                    <img src={selectedImage} alt="Attachment Thumbnail" className="w-full h-full object-cover" />
                  </div>
                  <div className="text-left">
                    <span className={`block text-xs font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Attachment Loaded</span>
                    <span className="block text-[9px] text-emerald-450 font-semibold uppercase tracking-wider">Ready to send</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {/* View Once checkbox option */}
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={isViewOnceSelected}
                      onChange={(e) => setIsViewOnceSelected(e.target.checked)}
                      className="rounded border-white/20 bg-slate-950/50 text-indigo-650 focus:ring-indigo-500 focus:ring-offset-0 w-3.5 h-3.5"
                    />
                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" /> View Once
                    </span>
                  </label>
                  
                  <button 
                    onClick={removeSelectedImage}
                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white transition-all active:scale-95 cursor-pointer"
                    title="Remove attachment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Quick Reply Smart Chips */}
            {!isGuest && (activeTab === 'global' || selectedDmUser) && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none horizontal-scroll-list text-left mt-1.5">
                {["👍 Bhej raha hu", "Got it!", "In library 📚", "Kal class?", "Check notes", "Study? 🧠"].map((reply) => (
                  <button
                    key={reply}
                    type="button"
                    onClick={() => setInputText(reply)}
                    className={`px-2.5 py-1 rounded-full border text-[9px] sm:text-[10px] font-extrabold whitespace-nowrap cursor-pointer transition-all active:scale-95 flex-shrink-0 ${
                      isDark 
                        ? 'bg-[#1b1b26]/50 border-white/[0.06] text-slate-400 hover:text-white hover:border-indigo-500/40 hover:bg-indigo-600/10' 
                        : 'bg-slate-100 border-slate-200 text-slate-650 hover:bg-slate-200 hover:text-slate-800'
                    }`}
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}

            {/* Replying-to Preview Banner */}
            {activeTab === 'dm' && replyingTo && selectedDmUser && (
              <div className={`p-2.5 border rounded-2xl mb-2 flex items-center justify-between gap-3 text-left animate-fade-in ${
                isDark ? 'bg-indigo-950/30 border-indigo-550/20 text-[#E2E8F0]' : 'bg-indigo-50 border-indigo-200 text-slate-800'
              }`}>
                <div className="flex-1 min-w-0">
                  <span className="block text-[9px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Replying to {replyingTo.sender_id === user?.uid ? 'You' : selectedDmUser.displayName}</span>
                  <p className={`text-[10px] truncate ${isDark ? 'text-slate-300' : 'text-slate-650'}`}>{replyingTo.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="p-1 rounded-lg hover:bg-black/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Footer controls input form bar */}
            {(activeTab === 'global' || selectedDmUser) && (
              <form 
                onSubmit={handleSendMessage}
                className={`mt-2 pt-2.5 border-t flex items-center gap-1.5 sm:gap-2 relative ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}
              >
                {isGuest ? (
                  <div className={`w-full py-3 border rounded-2xl text-xs font-semibold text-slate-505 flex items-center justify-center gap-1.5 ${isDark ? 'bg-slate-950/40 border-white/[0.04]' : 'bg-slate-100 border-slate-200'}`}>
                    <Lock className="w-3.5 h-3.5" /> Guest Mode: Access is Read-Only. Register to send messages.
                  </div>
                ) : (
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      ref={fileInputRef}
                      className="hidden"
                    />
                    {/* Attachment trigger menu toggle for mobile/desktop */}
                    <div className="relative flex items-center">
                      {/* Mobile collapsed plus button */}
                      <button
                        type="button"
                        onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                        className={`sm:hidden p-2.5 rounded-xl border transition-all active:scale-95 cursor-pointer ${isDark ? 'border-white/[0.08] bg-[#1A1A24]/60 text-slate-455 hover:text-white hover:bg-white/5' : 'border-slate-200 bg-slate-50 text-slate-505 hover:text-slate-800 hover:bg-slate-100'}`}
                        title="Add attachments"
                      >
                        <Plus className={`w-5 h-5 transition-transform duration-200 ${showAttachmentMenu ? 'rotate-45' : ''}`} />
                      </button>

                      {/* Desktop inline menu */}
                      <div className="hidden sm:flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className={`p-3 rounded-2xl border transition-all active:scale-95 cursor-pointer ${isDark ? 'border-white/[0.08] bg-[#1A1A24]/60 text-slate-450 hover:text-white hover:bg-white/5' : 'border-slate-200 bg-slate-50 text-slate-505 hover:text-slate-800 hover:bg-slate-100'}`}
                          title="Attach Photo"
                        >
                          <ImageIcon className="w-5 h-5" />
                        </button>

                        {activeTab === 'dm' && selectedDmUser && (
                          <>
                            <button
                              type="button"
                              onClick={() => setIsNoteShareModalOpen(true)}
                              className={`p-3 rounded-2xl border transition-all active:scale-95 cursor-pointer ${isDark ? 'border-white/[0.08] bg-[#1A1A24]/60 text-slate-450 hover:text-white hover:bg-white/5' : 'border-slate-200 bg-slate-50 text-slate-505 hover:text-slate-800 hover:bg-slate-100'}`}
                              title="Share study notes"
                            >
                              <Paperclip className="w-5 h-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsPollModalOpen(true)}
                              className={`p-3 rounded-2xl border transition-all active:scale-95 cursor-pointer ${isDark ? 'border-white/[0.08] bg-[#1A1A24]/60 text-slate-450 hover:text-white hover:bg-white/5' : 'border-slate-200 bg-slate-50 text-slate-505 hover:text-slate-800 hover:bg-slate-100'}`}
                              title="Create study poll"
                            >
                              <BarChart2 className="w-5 h-5" />
                            </button>
                          </>
                        )}
                      </div>

                      {/* Mobile floating dropdown list */}
                      {showAttachmentMenu && (
                        <>
                          {/* Backdrop overlay */}
                          <div 
                            className="fixed inset-0 z-20 cursor-default" 
                            onClick={() => setShowAttachmentMenu(false)} 
                          />
                          <div className={`absolute bottom-full mb-3 left-0 rounded-2xl border p-2 flex flex-col gap-1 z-30 shadow-2xl min-w-[150px] animate-in fade-in slide-in-from-bottom-2 ${
                            isDark ? 'bg-[#0E0E14] border-white/[0.08]' : 'bg-white border-slate-200'
                          }`}>
                            <button
                              type="button"
                              onClick={() => {
                                setShowAttachmentMenu(false);
                                fileInputRef.current?.click();
                              }}
                              className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold transition-all text-left ${
                                isDark ? 'hover:bg-white/5 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                              }`}
                            >
                              <ImageIcon className="w-4 h-4 text-indigo-400" />
                              <span>Attach Photo</span>
                            </button>

                            {activeTab === 'dm' && selectedDmUser && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowAttachmentMenu(false);
                                    setIsNoteShareModalOpen(true);
                                  }}
                                  className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold transition-all text-left ${
                                    isDark ? 'hover:bg-white/5 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  <Paperclip className="w-4 h-4 text-sky-400" />
                                  <span>Share Notes</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowAttachmentMenu(false);
                                    setIsPollModalOpen(true);
                                  }}
                                  className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold transition-all text-left ${
                                    isDark ? 'hover:bg-white/5 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  <BarChart2 className="w-4 h-4 text-purple-400" />
                                  <span>Create Poll</span>
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    <input
                      type="text"
                      placeholder={activeTab === 'global' ? "Share update..." : `Message ${selectedDmUser?.displayName || ''}...`}
                      value={inputText}
                      onChange={(e) => handleInputChange(e.target.value)}
                      className={`flex-1 min-w-0 border rounded-xl py-2.5 px-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-semibold placeholder:text-slate-600 ${isDark ? 'bg-[#1A1A24]/60 border-white/[0.08] text-white' : 'bg-slate-50 border-slate-200 text-slate-850'}`}
                    />

                    <button
                      type="submit"
                      disabled={isSending || (!inputText.trim() && !selectedImage)}
                      className="p-2.5 sm:p-3 rounded-xl flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white transition-all disabled:opacity-50 disabled:hover:bg-indigo-600 cursor-pointer shadow-lg shadow-indigo-600/10 active:scale-95"
                    >
                      <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </>
                )}
              </form>
            )}
          </GlassPanel>
        </div>
      </div>

      {/* Lightbox Zoom modal */}
      {zoomedImage && (
        <div 
          onClick={() => setZoomedImage(null)}
          className="fixed inset-0 bg-[#0A0A0C]/90 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-zoom-out animate-fade-in text-left"
        >
          <button 
            onClick={() => setZoomedImage(null)}
            className="absolute top-4 right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer active:scale-95 z-50 border border-white/10"
            title="Close Lightbox"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="max-w-[90vw] max-h-[85vh] relative flex flex-col items-center justify-center text-center animate-scale-up"
          >
            <img 
              src={zoomedImage} 
              alt="Zoomed attachment" 
              className="max-w-full max-h-[75vh] object-contain rounded-2xl border border-white/10 shadow-2xl select-none"
            />
            <div className="flex items-center gap-2 mt-4 px-4 py-2 bg-slate-900/85 border border-white/[0.08] backdrop-blur rounded-2xl">
              <a 
                href={zoomedImage} 
                download={`attachment_${Date.now()}.jpg`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-all active:scale-95 shadow-md"
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

      {/* Starred Messages Local Drawer */}
      {isStarDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            onClick={() => setIsStarDrawerOpen(false)}
            className="absolute inset-0 bg-[#0A0A0C]/60 backdrop-blur-sm transition-opacity" 
          />
          {/* Panel */}
          <GlassPanel className={`w-full max-w-md h-full flex flex-col p-6 border-l shadow-2xl relative z-10 ${
            isDark ? 'bg-[#0E0E12]/95 border-white/[0.08] text-[#E2E8F0]' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center justify-between border-b pb-4 mb-4 border-white/10 light-mode:border-slate-100">
              <h3 className="text-sm font-black flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400 fill-current animate-pulse" />
                Starred Messages (Offline Safe)
              </h3>
              <button
                onClick={() => setIsStarDrawerOpen(false)}
                className={`p-1.5 rounded-lg border cursor-pointer active:scale-90 ${
                  isDark ? 'border-white/10 hover:bg-white/5 text-slate-400' : 'border-slate-200 hover:bg-slate-50 text-slate-500'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {starredMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-slate-500 py-12">
                  <Star className="w-8 h-8 text-slate-650" />
                  <span className="text-xs font-black text-slate-400">No starred messages</span>
                  <span className="text-[10px] text-slate-500 max-w-[200px]">Hover any message bubble and click the star icon to save it here for reference.</span>
                </div>
              ) : (
                starredMessages.map((msg) => (
                  <div 
                    key={msg.id}
                    className={`p-3.5 border rounded-2xl flex flex-col gap-2 relative text-left ${
                      isDark ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <button
                      onClick={() => handleToggleStar(msg)}
                      className="absolute top-2 right-2 p-1.5 rounded-lg text-amber-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer"
                      title="Unstar message"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    
                    <div className="flex items-center gap-2">
                      {renderAvatar(msg.sender_avatar || '', "w-7 h-7 text-xs")}
                      <div className="min-w-0">
                        <span className="block text-[10px] font-black leading-none">{msg.sender_name}</span>
                        <span className="text-[8px] text-slate-505 mt-0.5 block">{formatTime(msg.created_at)}</span>
                      </div>
                      {msg.isDM && (
                        <span className="text-[8px] font-black bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded ml-auto">Private DM</span>
                      )}
                    </div>

                    <p className="text-[11px] font-medium leading-relaxed break-words mt-1">{msg.content}</p>

                    {msg.photo_url && (
                      <div className="rounded-xl overflow-hidden border border-white/10 max-h-40 bg-black/40">
                        <img src={msg.photo_url} alt="Starred attachment" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </GlassPanel>
        </div>
      )}

      {/* Share Note Picker Modal */}
      {isNoteShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => {
              setIsNoteShareModalOpen(false);
              setSearchNoteQuery('');
              setNoteSearchResults([]);
            }}
            className="absolute inset-0 bg-[#0A0A0C]/65 backdrop-blur-sm" 
          />
          <GlassPanel className={`w-full max-w-md p-6 border shadow-2xl relative z-10 rounded-3xl ${
            isDark ? 'bg-[#0E0E12]/95 border-white/[0.08] text-[#E2E8F0]' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 mb-4 border-white/10 light-mode:border-slate-100">
              <h3 className="text-sm font-black flex items-center gap-2 text-indigo-400">
                <Paperclip className="w-4 h-4" />
                Share Study Notes
              </h3>
              <button
                onClick={() => {
                  setIsNoteShareModalOpen(false);
                  setSearchNoteQuery('');
                  setNoteSearchResults([]);
                }}
                className={`p-1.5 rounded-lg border cursor-pointer active:scale-90 ${
                  isDark ? 'border-white/10 hover:bg-white/5 text-slate-400' : 'border-slate-200 hover:bg-slate-50 text-slate-505'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-505 absolute left-3 top-3.5" />
                <input
                  type="text"
                  placeholder="Search notes by subject name..."
                  value={searchNoteQuery}
                  onChange={(e) => handleSearchNotes(e.target.value)}
                  className={`w-full border rounded-xl py-2.5 pl-9 pr-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-semibold placeholder:text-slate-650 ${isDark ? 'bg-[#1A1A24]/60 border-white/[0.08] text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {searchNoteQuery.trim() === '' ? (
                  <div className="text-center py-6 text-slate-500 text-[11px] font-bold">
                    Type a subject name above to search approved notes
                  </div>
                ) : noteSearchResults.length === 0 ? (
                  <div className="text-center py-6 text-slate-505 text-[11px] font-bold">
                    No approved notes found. Try another subject.
                  </div>
                ) : (
                  noteSearchResults.map((note) => (
                    <button
                      key={note.id}
                      onClick={() => handleShareNoteMessage(note)}
                      className={`w-full p-3 rounded-xl border text-left flex items-center justify-between gap-3 cursor-pointer transition-all ${
                        isDark ? 'border-white/[0.04] bg-[#161622]/40 hover:bg-indigo-600/10' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className={`block text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-850'}`}>{note.subject}</span>
                        <span className="block text-[9px] text-slate-500 mt-0.5">Branch: {note.branch.toUpperCase()} • Professor: {note.professor || 'Unknown'}</span>
                      </div>
                      <span className="px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[9px] font-black flex-shrink-0">
                        Share Card
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </GlassPanel>
        </div>
      )}

      {/* Campus Study Poll Builder Modal */}
      {isPollModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => {
              setIsPollModalOpen(false);
              setPollQuestion('');
              setPollOptions(['', '']);
            }}
            className="absolute inset-0 bg-[#0A0A0C]/65 backdrop-blur-sm" 
          />
          <GlassPanel className={`w-full max-w-md p-6 border shadow-2xl relative z-10 rounded-3xl ${
            isDark ? 'bg-[#0E0E12]/95 border-white/[0.08] text-[#E2E8F0]' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 mb-4 border-white/10 light-mode:border-slate-100">
              <h3 className="text-sm font-black flex items-center gap-2 text-indigo-400">
                <BarChart2 className="w-4 h-4" />
                Create Campus Study Poll
              </h3>
              <button
                onClick={() => {
                  setIsPollModalOpen(false);
                  setPollQuestion('');
                  setPollOptions(['', '']);
                }}
                className={`p-1.5 rounded-lg border cursor-pointer active:scale-90 ${
                  isDark ? 'border-white/10 hover:bg-white/5 text-slate-400' : 'border-slate-200 hover:bg-slate-50 text-slate-505'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-left">
              <div>
                <label className="block text-[10px] font-black text-slate-405 uppercase tracking-widest mb-1.5">Poll Question</label>
                <input
                  type="text"
                  placeholder="e.g., Which topic do you want to revise tonight?"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  className={`w-full border rounded-xl py-2.5 px-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-semibold placeholder:text-slate-650 ${isDark ? 'bg-[#1A1A24]/60 border-white/[0.08] text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-black text-slate-405 uppercase tracking-widest">Options (Min 2, Max 4)</label>
                  {pollOptions.length < 4 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions([...pollOptions, ''])}
                      className="text-[10px] font-black text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add Option
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder={`Option ${idx + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const updated = [...pollOptions];
                          updated[idx] = e.target.value;
                          setPollOptions(updated);
                        }}
                        className={`flex-1 border rounded-xl py-2.5 px-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-semibold placeholder:text-slate-600 ${isDark ? 'bg-[#1A1A24]/60 border-white/[0.08] text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setPollOptions(pollOptions.filter((_, oIdx) => oIdx !== idx))}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white transition-all active:scale-95 cursor-pointer"
                          title="Remove option"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreatePollMessage}
                className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-all cursor-pointer shadow-lg shadow-indigo-600/10 active:scale-95 mt-2 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Send Poll Card
              </button>
            </div>
          </GlassPanel>
        </div>
      )}

      {/* WebRTC Video/Voice calling overlay */}
      {callState !== 'idle' && (
        <div className="fixed inset-0 z-50 bg-[#07070A]/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-white text-center">
          {/* Animated Glowing Ring Backdrop */}
          <div className="absolute w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-75" />

          {/* Caller/Recipient Profile Section */}
          <div className="relative z-10 max-w-sm w-full flex flex-col items-center gap-6 flex-1 justify-center">
            
            {/* Call State Title */}
            <div className="space-y-1">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                {callType === 'video' ? '📽️ Secure Video Call' : '📞 Secure Audio Call'}
              </span>
              <h2 className="text-xl font-black text-white">
                {callState === 'incoming' ? 'Incoming request...' : callState === 'calling' ? 'Calling classmate...' : 'Connected'}
              </h2>
            </div>

            {/* Avatar & Video Elements */}
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900/60 flex items-center justify-center">
              
              {/* Remote Video Stream (Main screen when connected and type is video) */}
              {callState === 'connected' && callType === 'video' && remoteStream && !isCameraOff ? (
                <video 
                  ref={remoteVideoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover"
                />
              ) : (
                /* Avatar display for incoming, calling or voice call */
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    {renderAvatar(callerProfile?.photoURL || '', "w-28 h-28 text-4xl border-4 border-indigo-500/30 animate-pulse")}
                    <span className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-indigo-600 border-2 border-slate-950 flex items-center justify-center text-[10px]">
                      {callType === 'video' ? '📽️' : '📞'}
                    </span>
                  </div>
                  <div className="text-center mt-2">
                    <h3 className="font-extrabold text-sm">{callerProfile?.displayName || 'Classmate'}</h3>
                    <p className="text-[10px] text-slate-400">P2P Encrypted Signal</p>
                  </div>
                </div>
              )}

              {/* Local Video Preview (Mini window in bottom-right corner when connected and type is video) */}
              {callState === 'connected' && callType === 'video' && localStream && (
                <div className="absolute bottom-3 right-3 w-20 h-28 sm:w-24 sm:h-36 rounded-2xl overflow-hidden border border-white/20 shadow-lg bg-black/60">
                  {!isCameraOff ? (
                    <video 
                      ref={localVideoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-900 text-[10px] text-slate-505 font-bold">Cam Off</div>
                  )}
                </div>
              )}
            </div>

            {/* Subtext info */}
            {callState === 'calling' && (
              <p className="text-[10px] font-bold text-slate-500 italic animate-pulse">Waiting for peer to accept...</p>
            )}

            {/* Interaction Buttons Container */}
            <div className="flex flex-col gap-4 w-full mt-4 items-center">
              
              {/* Incoming call buttons */}
              {callState === 'incoming' ? (
                <div className="flex items-center gap-6 justify-center w-full">
                  <button
                    onClick={declineIncomingCall}
                    className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center cursor-pointer transition-all active:scale-90 shadow-lg shadow-rose-600/30"
                    title="Decline Call"
                  >
                    <PhoneOff className="w-6 h-6" />
                  </button>
                  <button
                    onClick={acceptIncomingCall}
                    className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-lg shadow-emerald-600/30 animate-bounce"
                    title="Accept Call"
                  >
                    <Phone className="w-6 h-6" />
                  </button>
                </div>
              ) : (
                /* Outgoing or Connected Call buttons */
                <div className="flex items-center gap-4 justify-center">
                  {callState === 'connected' && (
                    <>
                      {/* Mic Mute Toggle */}
                      <button
                        onClick={() => {
                          if (localStream) {
                            localStream.getAudioTracks().forEach(track => {
                              track.enabled = !track.enabled;
                            });
                            setIsMicMuted(!isMicMuted);
                            info(!isMicMuted ? "Microphone muted" : "Microphone unmuted");
                          }
                        }}
                        className={`w-12 h-12 rounded-full border flex items-center justify-center cursor-pointer transition-all active:scale-90 ${
                          isMicMuted 
                            ? 'bg-rose-600/20 border-rose-500 text-rose-400' 
                            : 'bg-white/10 border-white/10 hover:bg-white/20 text-white'
                        }`}
                        title={isMicMuted ? "Unmute Mic" : "Mute Mic"}
                      >
                        {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      </button>

                      {/* Video Camera Toggle */}
                      {callType === 'video' && (
                        <button
                          onClick={() => {
                            if (localStream) {
                              localStream.getVideoTracks().forEach(track => {
                                track.enabled = !track.enabled;
                              });
                              setIsCameraOff(!isCameraOff);
                              info(!isCameraOff ? "Camera turned off" : "Camera turned on");
                            }
                          }}
                          className={`w-12 h-12 rounded-full border flex items-center justify-center cursor-pointer transition-all active:scale-90 ${
                            isCameraOff 
                              ? 'bg-rose-600/20 border-rose-500 text-rose-400' 
                              : 'bg-white/10 border-white/10 hover:bg-white/20 text-white'
                        }`}
                        title={isCameraOff ? "Turn Video On" : "Turn Video Off"}
                      >
                        {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                      </button>
                    )}
                  </>
                )}

                  {/* Hang Up Button */}
                  <button
                    onClick={endActiveCall}
                    className="w-14 h-14 rounded-full bg-rose-650 hover:bg-rose-755 text-white flex items-center justify-center cursor-pointer transition-all active:scale-90 shadow-lg shadow-rose-650/30"
                    title="End Call"
                  >
                    <PhoneOff className="w-6 h-6" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Visual Theme Picker Modal */}
      {isThemeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setIsThemeModalOpen(false)}
            className="absolute inset-0 bg-[#0A0A0C]/70 backdrop-blur-md" 
          />
          <GlassPanel className={`w-full max-w-xl p-6 border shadow-2xl relative z-10 rounded-3xl ${
            isDark ? 'bg-[#0E0E12]/98 border-white/[0.08] text-[#E2E8F0]' : 'bg-white border-slate-205 text-slate-805'
          }`}>
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3.5 mb-4 border-white/10 light-mode:border-slate-100">
              <h3 className="text-sm font-black flex items-center gap-2 text-indigo-400">
                <Paintbrush className="w-4 h-4" />
                Personalize Chat Theme
              </h3>
              <button
                onClick={() => setIsThemeModalOpen(false)}
                className={`p-1.5 rounded-lg border cursor-pointer active:scale-90 ${
                  isDark ? 'border-white/10 hover:bg-white/5 text-slate-400' : 'border-slate-200 hover:bg-slate-50 text-slate-505'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[10px] text-slate-500 text-left mb-4 font-semibold leading-relaxed">
              Customize wallpaper backgrounds and message bubble colors. Custom themes are saved locally for this chat room ({
                activeTab === 'global' ? 'Campus Lounge' : (selectedDmUser?.displayName || 'Classmate')
              }).
            </p>

            {/* Grid of themes */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 max-h-[350px] overflow-y-auto pr-1">
              {CHAT_THEMES.map((themeItem) => {
                const currentRoomId = activeTab === 'dm' && selectedDmUser ? selectedDmUser.id : 'global';
                const currentTheme = chatThemes[currentRoomId] || 'Default';
                const isSelected = 
                  currentTheme === themeItem.name ||
                  (themeItem.name === 'Midnight Nebula' && currentTheme === 'Midnight Purple') ||
                  (themeItem.name === 'Sunset Ember' && currentTheme === 'Sunset Crimson') ||
                  (themeItem.name === 'Tokyo Neon' && currentTheme === 'Cyberpunk Neon') ||
                  (themeItem.name === 'Emerald Canopy' && currentTheme === 'Emerald Forest');

                return (
                  <button
                    key={themeItem.name}
                    onClick={() => {
                      const updated = { ...chatThemes, [currentRoomId]: themeItem.name };
                      setChatThemes(updated);
                      localStorage.setItem('noteweb-chat-themes', JSON.stringify(updated));
                      toastSuccess(`${themeItem.name} theme applied!`);
                    }}
                    className={`group/theme-card p-2 rounded-2xl border text-left flex flex-col gap-2 transition-all cursor-pointer relative active:scale-95 ${
                      isSelected 
                        ? 'border-indigo-500 bg-indigo-500/5 ring-1 ring-indigo-500/30' 
                        : isDark
                          ? 'border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05]'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80 shadow-sm'
                    }`}
                  >
                    {/* Visual Preview */}
                    <div 
                      className={`h-16 w-full rounded-xl relative overflow-hidden flex flex-col p-1.5 justify-between ${themeItem.previewBg}`}
                      style={themeItem.previewStyle}
                    >
                      {/* Mini visual bubbles */}
                      <div className="flex flex-col gap-1 w-full text-[6px]">
                        {/* Other (receiver) mini bubble */}
                        <div className={`px-1.5 py-0.5 rounded-lg max-w-[70%] self-start border flex items-center leading-none ${themeItem.otherBubbleClass}`}>
                          Hello!
                        </div>
                        {/* My (sender) mini bubble */}
                        <div className={`px-1.5 py-0.5 rounded-lg max-w-[70%] self-end border flex items-center leading-none ${themeItem.myBubbleClass}`}>
                          Hey there!
                        </div>
                      </div>

                      {/* Selected tick badge */}
                      {isSelected && (
                        <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-indigo-650 text-white flex items-center justify-center shadow-lg border border-indigo-400">
                          <Check className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>

                    {/* Theme metadata */}
                    <div className="flex items-center justify-between px-1">
                      <span className={`text-[10px] font-black truncate ${
                        isSelected 
                          ? 'text-indigo-400' 
                          : isDark ? 'text-slate-200' : 'text-slate-805'
                      }`}>
                        {themeItem.name}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 mt-5 border-t pt-3.5 border-white/10 light-mode:border-slate-100">
              <button
                type="button"
                onClick={() => setIsThemeModalOpen(false)}
                className="px-4 py-2 text-[10px] font-black rounded-xl bg-indigo-600 hover:bg-indigo-700 transition-all font-semibold text-white cursor-pointer active:scale-95 shadow-md shadow-indigo-600/10"
              >
                Done
              </button>
            </div>
          </GlassPanel>
        </div>
      )}
    </div>
  );
};

export default Chat;
