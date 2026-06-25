import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { subscribeToPresenceChanges } from '../services/presence';
import type { OnlineUser } from '../services/presence';
import { 
  Shield,
  ShieldAlert, 
  Check, 
  X, 
  Trash2, 
  User, 
  FileText, 
  ShieldCheck, 
  Users, 
  FileSearch, 
  BookOpen,
  Wifi,
  WifiOff,
  Monitor,
  Smartphone,
  Tablet,
  Clock,
  RefreshCw,
  Activity,
  Star
} from 'lucide-react';
import { GlassPanel } from '../components/ui/GlassPanel';
import { Skeleton } from '../components/ui/Skeleton';
import { openPdfDocument } from '../utils/pdfDb';
import { renderAvatar } from '../utils/avatar';

interface NoteDocument {
  id: string;
  subject: string;
  semester: string;
  teacher: string;
  description: string;
  pdfUrl: string;
  pdfPath: string;
  fileName: string;
  uploadedBy: string;
  uploaderName: string;
  uploaderEmail: string;
  createdAt: any;
  status: 'pending' | 'approved' | 'rejected';
}

interface UserProfile {
  uid: string;
  username?: string;
  email: string;
  displayName: string;
  role: 'student' | 'admin';
  createdAt: any;
}

interface FeedbackItem {
  id: string;
  user_id: string;
  display_name: string;
  photo_url: string;
  department: string;
  rating: number;
  comment: string;
  created_at: string;
}

const mapDbNoteToNoteDocument = (n: any): NoteDocument => {
  return {
    id: n.id,
    subject: n.subject || '',
    semester: n.semester || '',
    teacher: n.teacher || 'General / Unknown',
    description: n.description || '',
    pdfUrl: n.pdf_url || n.pdfUrl || '',
    pdfPath: n.pdf_path || n.pdfPath || '',
    fileName: n.file_name || n.fileName || '',
    uploadedBy: n.uploaded_by || n.uploadedBy || '',
    uploaderName: n.uploader_name || n.uploaderName || 'Anonymous Student',
    uploaderEmail: n.uploader_email || n.uploaderEmail || '',
    createdAt: n.created_at || n.createdAt || new Date().toISOString(),
    status: n.status || 'pending',
  };
};

const mapDbProfileToUserProfile = (p: any): UserProfile => {
  return {
    uid: p.id || p.uid || '',
    username: p.username || '',
    email: p.email || '',
    displayName: p.display_name || p.displayName || '',
    role: p.role || 'student',
    createdAt: p.created_at || p.createdAt || new Date().toISOString(),
  };
};

const BRANCH_LABELS: Record<string, string> = {
  cse: 'Computer Science & Engineering',
  aiml: 'AI & Machine Learning',
  ds: 'Data Science',
  mechanical: 'Mechanical Engineering',
  civil: 'Civil Engineering',
  ece: 'Electronics & Comm Eng'
};

const getTime = (val: any) => {
  if (!val) return 0;
  if (val.seconds) return val.seconds * 1000;
  return new Date(val).getTime();
};

const getDeviceIcon = (deviceInfo: string) => {
  if (deviceInfo.toLowerCase().includes('mobile')) return <Smartphone className="w-4 h-4" />;
  if (deviceInfo.toLowerCase().includes('tablet')) return <Tablet className="w-4 h-4" />;
  return <Monitor className="w-4 h-4" />;
};

const getRelativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
};

export const Admin: React.FC = () => {
  const { user: currentAuthUser } = useAuth();
  const { success, error, info } = useToast();

  const [activeTab, setActiveTab] = useState<'moderation' | 'notes' | 'users' | 'online' | 'feedback' | 'flagged' | 'blocked_ips'>('moderation');
  const [pendingNotes, setPendingNotes] = useState<NoteDocument[]>([]);
  const [allNotes, setAllNotes] = useState<NoteDocument[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [flaggedChats, setFlaggedChats] = useState<any[]>([]);
  const [blockedIps, setBlockedIps] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Subscribe to presence changes
  useEffect(() => {
    const unsubscribe = subscribeToPresenceChanges((users) => {
      setOnlineUsers(users);
      setRealtimeConnected(true);
    });
    return unsubscribe;
  }, []);

  // Force re-render every 30s for relative time displays
  useEffect(() => {
    const interval = setInterval(() => setRealtimeConnected(c => c), 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchModerationData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      console.log(`[NoteWeb Admin Log] Fetching admin dashboard data... (silent mode: ${silent})`);
      // 1. Fetch Pending Notes
      const { data: pendingData, error: pendingErr } = await supabase
        .from('notes')
        .select('*')
        .eq('status', 'pending');
        
      if (pendingErr) throw pendingErr;
      
      const pending = (pendingData || []).map(mapDbNoteToNoteDocument);
      pending.sort((a: NoteDocument, b: NoteDocument) => getTime(b.createdAt) - getTime(a.createdAt));
      setPendingNotes(pending);

      // 2. Fetch All Notes
      const { data: allData, error: allErr } = await supabase
        .from('notes')
        .select('*');
        
      if (allErr) throw allErr;
      
      const all = (allData || []).map(mapDbNoteToNoteDocument);
      all.sort((a: NoteDocument, b: NoteDocument) => getTime(b.createdAt) - getTime(a.createdAt));
      setAllNotes(all);

      // 3. Fetch Users
      const { data: usersData, error: usersErr } = await supabase
        .from('profiles')
        .select('*');
        
      if (usersErr) throw usersErr;
      
      const users = (usersData || []).map(mapDbProfileToUserProfile);
      
      // Deduplicate users list by lowercased username or email to prevent mock/real duplicate accounts
      const uniqueUsersMap = new Map<string, UserProfile>();
      users.forEach((usr) => {
        const key = (usr.username || usr.email || usr.displayName || usr.uid).toLowerCase();
        const existing = uniqueUsersMap.get(key);
        if (!existing) {
          uniqueUsersMap.set(key, usr);
        } else {
          // Prefer the real authenticated account (non-mock ID)
          const existingIsMock = existing.uid.startsWith('mock-');
          const newIsMock = usr.uid.startsWith('mock-');
          if (existingIsMock && !newIsMock) {
            uniqueUsersMap.set(key, usr);
          } else if (!existingIsMock && !newIsMock) {
            // If both are real, keep the one with the latest createdAt
            if (new Date(usr.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
              uniqueUsersMap.set(key, usr);
            }
          }
        }
      });
      
      setUsersList(Array.from(uniqueUsersMap.values()));

      // 4. Fetch Feedbacks
      let fetchedFeedbacks: FeedbackItem[] = [];
      try {
        const { data: feedbackData, error: feedbackErr } = await supabase
          .from('feedbacks')
          .select('*');
          
        if (!feedbackErr && feedbackData) {
          fetchedFeedbacks = feedbackData as FeedbackItem[];
        }
      } catch (err) {
        console.warn("Failed to fetch feedbacks from Supabase:", err);
      }
      
      const localFeedbacksStr = localStorage.getItem('noteweb-db-feedbacks');
      if (localFeedbacksStr) {
        try {
          const localFeedbacks = JSON.parse(localFeedbacksStr);
          if (Array.isArray(localFeedbacks)) {
            const existingIds = new Set(fetchedFeedbacks.map(f => f.id));
            localFeedbacks.forEach((f: any) => {
              if (f && f.id && !existingIds.has(f.id)) {
                fetchedFeedbacks.push(f);
              }
            });
          }
        } catch {}
      }
      fetchedFeedbacks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setFeedbacks(fetchedFeedbacks);

      // 5. Fetch Flagged Chats
      let fetchedFlagged: any[] = [];
      try {
        const { data: dbFlagged, error: flaggedErr } = await supabase
          .from('flagged_chats')
          .select('*');
        if (!flaggedErr && dbFlagged) {
          fetchedFlagged = dbFlagged;
        }
      } catch (e) {
        console.warn("Failed to fetch flagged_chats from Supabase:", e);
      }

      const localFlaggedStr = localStorage.getItem('noteweb-flagged-chats');
      if (localFlaggedStr) {
        try {
          const localFlagged = JSON.parse(localFlaggedStr);
          if (Array.isArray(localFlagged)) {
            const existingIds = new Set(fetchedFlagged.map(f => f.id));
            localFlagged.forEach((f: any) => {
              if (f && f.id && !existingIds.has(f.id)) {
                fetchedFlagged.push(f);
              }
            });
          }
        } catch {}
      }
      fetchedFlagged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setFlaggedChats(fetchedFlagged);
      
      // 6. Fetch Blocked IPs
      let fetchedBlockedIps: any[] = [];
      try {
        const { data: dbBlocked, error: blockedErr } = await supabase
          .from('blocked_ips')
          .select('*');
        if (!blockedErr && dbBlocked) {
          fetchedBlockedIps = dbBlocked;
        }
      } catch (e) {
        console.warn("Failed to fetch blocked_ips from Supabase:", e);
      }

      const localBlockedStr = localStorage.getItem('noteweb-db-blocked_ips');
      if (localBlockedStr) {
        try {
          const localBlocked = JSON.parse(localBlockedStr);
          if (Array.isArray(localBlocked)) {
            const existingIds = new Set(fetchedBlockedIps.map(b => b.id));
            localBlocked.forEach((b: any) => {
              if (b && b.id && !existingIds.has(b.id)) {
                fetchedBlockedIps.push(b);
              }
            });
          }
        } catch {}
      }
      fetchedBlockedIps.sort((a, b) => new Date(b.blocked_at).getTime() - new Date(a.blocked_at).getTime());
      setBlockedIps(fetchedBlockedIps);

      setLastRefresh(new Date());

      console.log(`[NoteWeb Admin Log] Dashboard data loaded. Pending: ${pending.length}, Total: ${all.length}, Users: ${users.length}, Feedbacks: ${fetchedFeedbacks.length}, Flagged: ${fetchedFlagged.length}, Blocked IPs: ${fetchedBlockedIps.length}`);
    } catch (e: any) {
      console.error("[NoteWeb Admin Log] Failed to load dashboard data:", e);
      error("Failed to load admin panel data: " + e.message);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchModerationData();

    let channelProfiles: any = null;
    let channelNotes: any = null;
    let channelFeedbacks: any = null;
    let channelBlockedIps: any = null;
    let channelBroadcastFeedbacks: any = null;

    try {
      if (typeof supabase.channel === 'function') {
        console.log('[NoteWeb Admin Realtime] Subscribing to Supabase Realtime changes...');
        
        channelProfiles = supabase
          .channel('public:profiles_admin')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'profiles' },
            (payload: any) => {
              console.log('[NoteWeb Admin Realtime] profiles table change detected:', payload);
              fetchModerationData(true);
              setRealtimeConnected(true);
            }
          )
          .subscribe((status: any) => {
            console.log('[NoteWeb Admin Realtime] profiles channel status:', status);
            if (status === 'SUBSCRIBED') setRealtimeConnected(true);
          });

        channelNotes = supabase
          .channel('public:notes_admin')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'notes' },
            (payload: any) => {
              console.log('[NoteWeb Admin Realtime] notes table change detected:', payload);
              fetchModerationData(true);
              setRealtimeConnected(true);
            }
          )
          .subscribe((status: any) => {
            console.log('[NoteWeb Admin Realtime] notes channel status:', status);
            if (status === 'SUBSCRIBED') setRealtimeConnected(true);
          });

        channelFeedbacks = supabase
          .channel('public:feedbacks_admin')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'feedbacks' },
            (payload: any) => {
              console.log('[NoteWeb Admin Realtime] feedbacks table change detected:', payload);
              fetchModerationData(true);
              setRealtimeConnected(true);
            }
          )
          .subscribe((status: any) => {
            console.log('[NoteWeb Admin Realtime] feedbacks channel status:', status);
            if (status === 'SUBSCRIBED') setRealtimeConnected(true);
          });

        channelBlockedIps = supabase
          .channel('public:blocked_ips_admin')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'blocked_ips' },
            (payload: any) => {
              console.log('[NoteWeb Admin Realtime] blocked_ips table change detected:', payload);
              fetchModerationData(true);
            }
          )
          .subscribe();

        // P2P Pushing Broadcast listener for Feedbacks
        channelBroadcastFeedbacks = supabase.channel('public:feedbacks');
        channelBroadcastFeedbacks.on('broadcast', { event: 'new-feedback' }, (response: any) => {
          console.log('[NoteWeb Admin Broadcast] Realtime peer feedback received:', response);
          if (response?.payload) {
            setFeedbacks((prev) => {
              const exists = prev.some(f => f.id === response.payload.id);
              if (exists) return prev;
              const next = [response.payload, ...prev];
              next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              return next;
            });
          }
        }).subscribe();

        // P2P Broadcast listener for Chat flagging & deletion
        const channelBroadcastChats = supabase.channel('public:chats');
        channelBroadcastChats
          .on('broadcast', { event: 'flagged-chat' }, (response: any) => {
            console.log('[NoteWeb Admin Broadcast] Flagged chat received:', response);
            if (response?.payload) {
              setFlaggedChats((prev) => {
                const exists = prev.some(f => f.id === response.payload.id);
                if (exists) return prev;
                const next = [response.payload, ...prev];
                next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                return next;
              });
              info(`⚠️ Profanity Alert: User "${response.payload.sender_name}" typed a flagged word!`);
            }
          })
          .on('broadcast', { event: 'delete-message' }, (response: any) => {
            if (response?.payload?.id) {
              setFlaggedChats((prev) => prev.filter(f => f.chat_id !== response.payload.id));
            }
          })
          .subscribe();
      }
    } catch (err) {
      console.warn("[NoteWeb Admin Realtime] Realtime subscriptions failed:", err);
    }

    // Listen for storage changes to sync flagged chats across admin tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'noteweb-flagged-chats') {
        const stored = localStorage.getItem('noteweb-flagged-chats');
        if (stored) {
          try {
            setFlaggedChats(JSON.parse(stored));
          } catch {}
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Auto-refresh every 15 seconds silently
    const refreshInterval = setInterval(() => fetchModerationData(true), 15000);

    return () => {
      clearInterval(refreshInterval);
      window.removeEventListener('storage', handleStorageChange);
      if (channelProfiles) {
        try { channelProfiles.unsubscribe(); } catch (e) {}
      }
      if (channelNotes) {
        try { channelNotes.unsubscribe(); } catch (e) {}
      }
      if (channelFeedbacks) {
        try { channelFeedbacks.unsubscribe(); } catch (e) {}
      }
      if (channelBlockedIps) {
        try { channelBlockedIps.unsubscribe(); } catch (e) {}
      }
      if (channelBroadcastFeedbacks) {
        try { channelBroadcastFeedbacks.unsubscribe(); } catch (e) {}
      }
    };
  }, []);

  // Moderate Note
  const handleModerate = async (noteId: string, action: 'approved' | 'rejected') => {
    try {
      const { error: updateErr } = await supabase
        .from('notes')
        .update({ status: action })
        .eq('id', noteId);
        
      if (updateErr) throw updateErr;
      
      success(action === 'approved' ? "Notes published to feed!" : "Notes submission rejected.");
      
      setPendingNotes((prev) => prev.filter((n) => n.id !== noteId));
      setAllNotes((prev) => prev.map((n) => n.id === noteId ? { ...n, status: action } : n));
    } catch (e: any) {
      console.error(e);
      error("Moderation failed: " + e.message);
    }
  };

  const handleDeleteNote = async (noteId: string, pdfPath: string) => {
    const isConfirmed = window.confirm("Are you absolutely sure you want to delete this notes document? This cannot be undone.");
    if (!isConfirmed) return;

    try {
      const isLocalNote = String(noteId).startsWith('optimistic-');

      if (!isLocalNote) {
        if (pdfPath && pdfPath !== 'external-link' && !pdfPath.startsWith('cloudinary:')) {
          const { error: storageErr } = await supabase.storage.from('notes').remove([pdfPath]);
          if (storageErr) console.warn("Storage PDF delete warning:", storageErr);
        }

        const { error: deleteErr } = await supabase
          .from('notes')
          .delete()
          .eq('id', noteId);
          
        if (deleteErr) throw deleteErr;
      }
      
      // Also delete from local synchronization cache to prevent background restore
      try {
        const storedNotesStr = localStorage.getItem('noteweb-broadcasted-notes');
        const myUploadsStr = localStorage.getItem('noteweb-my-uploads');
        const noteToDelete = allNotes.find((n) => String(n.id) === String(noteId)) || 
                             pendingNotes.find((n) => String(n.id) === String(noteId));
        
        if (storedNotesStr) {
          try {
            const localNotes = JSON.parse(storedNotesStr);
            if (Array.isArray(localNotes)) {
              const filtered = localNotes.filter((n: any) => 
                String(n.id) !== String(noteId) && 
                !(noteToDelete && (n.subject === noteToDelete.subject || (n.file_name && n.file_name === noteToDelete.fileName)))
              );
              if (filtered.length > 0) {
                localStorage.setItem('noteweb-broadcasted-notes', JSON.stringify(filtered));
              } else {
                localStorage.removeItem('noteweb-broadcasted-notes');
              }
            }
          } catch {}
        }
        if (myUploadsStr) {
          try {
            const myUploadsList = JSON.parse(myUploadsStr);
            if (Array.isArray(myUploadsList)) {
              const filtered = myUploadsList.filter((n: any) => 
                String(n.id) !== String(noteId) && 
                !(noteToDelete && (n.subject === noteToDelete.subject || (n.file_name && n.file_name === noteToDelete.fileName)))
              );
              if (filtered.length > 0) {
                localStorage.setItem('noteweb-my-uploads', JSON.stringify(filtered));
              } else {
                localStorage.removeItem('noteweb-my-uploads');
              }
            }
          } catch {}
        }
      } catch (cacheErr) {
        console.warn("Failed to clear note from migration cache:", cacheErr);
      }

      // Database purge completed, updating states directly.

      success("Notes document permanently deleted.");
      setAllNotes((prev) => prev.filter((n) => String(n.id) !== String(noteId)));
      setPendingNotes((prev) => prev.filter((n) => String(n.id) !== String(noteId)));
    } catch (e: any) {
      console.error(e);
      error("Purge failed: " + e.message);
    }
  };

  const handleDeleteFeedback = async (feedbackId: string) => {
    const isConfirmed = window.confirm("Are you absolutely sure you want to permanently delete this feedback review? This cannot be undone.");
    if (!isConfirmed) return;

    try {
      const { error: deleteErr } = await supabase
        .from('feedbacks')
        .delete()
        .eq('id', feedbackId);
        
      if (deleteErr) throw deleteErr;
      
      // Remove from local storage fallback cache
      try {
        const storedFeedbacksStr = localStorage.getItem('noteweb-db-feedbacks');
        if (storedFeedbacksStr) {
          const storedFeedbacks = JSON.parse(storedFeedbacksStr);
          if (Array.isArray(storedFeedbacks)) {
            const filtered = storedFeedbacks.filter((f: any) => f.id !== feedbackId);
            localStorage.setItem('noteweb-db-feedbacks', JSON.stringify(filtered));
          }
        }
      } catch (cacheErr) {
        console.warn("Failed to clear feedback from local cache:", cacheErr);
      }

      success("Feedback review permanently deleted.");
      setFeedbacks((prev) => prev.filter((f) => f.id !== feedbackId));
    } catch (e: any) {
      console.error(e);
      error("Feedback deletion failed: " + e.message);
    }
  };

  const handleRoleToggle = async (targetUid: string, currentRole: 'student' | 'admin') => {
    if (targetUid === currentAuthUser?.uid) {
      info("Self-demotion safeguard: You cannot modify your own administrative role!");
      return;
    }

    const nextRole = currentRole === 'admin' ? 'student' : 'admin';
    const isConfirmed = window.confirm(`Are you sure you want to change this user's role to '${nextRole}'?`);
    if (!isConfirmed) return;

    try {
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ role: nextRole })
        .eq('id', targetUid);
        
      if (updateErr) throw updateErr;
      
      success(`User role elevated/changed to ${nextRole}!`);
      setUsersList((prev) => prev.map((u) => u.uid === targetUid ? { ...u, role: nextRole } : u));
    } catch (e: any) {
      console.error(e);
      error("Failed to alter user privileges");
    }
  };

  const handleRemoveUser = async (targetUid: string, displayName: string) => {
    if (targetUid === currentAuthUser?.uid) {
      info("Self-removal safeguard: You cannot remove your own administrative account!");
      return;
    }

    const isConfirmed = window.confirm(`Are you absolutely sure you want to permanently remove user "${displayName}"? This will also cascade delete all notes uploaded by this user!`);
    if (!isConfirmed) return;

    try {
      // 1. Fetch the user's last detected IP address and hardware fingerprint before deleting their profile
      let userIp = '';
      let userHwId = '';
      try {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('last_ip, lastIp, hardware_id, hardwareId')
          .eq('id', targetUid)
          .single();
        if (profileRow) {
          userIp = profileRow.last_ip || profileRow.lastIp || '';
          userHwId = profileRow.hardware_id || profileRow.hardwareId || '';
        }
      } catch (ipErr) {
        console.warn("Could not retrieve user IP before pruning:", ipErr);
      }

      // If we found an IP or HW fingerprint, add it to the blocked database
      if (userIp || userHwId) {
        const blockId = userIp || `hw-blocked-${targetUid}`;
        try {
          await supabase.from('blocked_ips').insert([
            {
              id: blockId,
              blocked_at: new Date().toISOString(),
              reason: `Account '${displayName}' pruned by admin`,
              status: 'blocked',
              hardware_id: userHwId
            }
          ]);
        } catch (blockErr) {
          console.warn("Failed to insert IP into Supabase blocked_ips:", blockErr);
        }
        
        // Also save to local storage block list database fallback
        try {
          const blockedStr = localStorage.getItem('noteweb-db-blocked_ips');
          let blockedList: any[] = [];
          if (blockedStr) {
            try { blockedList = JSON.parse(blockedStr); } catch {}
          }
          if (!blockedList.some((entry: any) => entry.id === blockId)) {
            blockedList.push({
              id: blockId,
              blocked_at: new Date().toISOString(),
              reason: `Account '${displayName}' pruned by admin`,
              status: 'blocked',
              hardware_id: userHwId
            });
            localStorage.setItem('noteweb-db-blocked_ips', JSON.stringify(blockedList));
            window.dispatchEvent(new StorageEvent('storage', { key: 'noteweb-db-blocked_ips' }));
          }
        } catch (lsErr) {
          console.warn("Failed to block IP in mock localStorage:", lsErr);
        }
      }

      const { data: userNotes, error: fetchNotesErr } = await supabase
        .from('notes')
        .select('*')
        .eq('uploaded_by', targetUid);

      if (!fetchNotesErr && userNotes && userNotes.length > 0) {
        const pathsToPurge = userNotes
          .map((n: any) => n.pdf_path || n.pdfPath)
          .filter((p: string) => !!p && p !== 'external-link' && !p.startsWith('cloudinary:'));
        if (pathsToPurge.length > 0) {
          await supabase.storage.from('notes').remove(pathsToPurge);
        }
      }

      const { error: deleteNotesErr } = await supabase
        .from('notes')
        .delete()
        .eq('uploaded_by', targetUid);

      if (deleteNotesErr) throw deleteNotesErr;

      const { error: deleteProfileErr } = await supabase
        .from('profiles')
        .delete()
        .eq('id', targetUid);

      if (deleteProfileErr) throw deleteProfileErr;

      // User profiles and uploads successfully deleted from Supabase.

      success(`User "${displayName}" and their uploads have been permanently removed!`);

      setUsersList((prev) => prev.filter((u) => u.uid !== targetUid));
      setAllNotes((prev) => prev.filter((n) => n.uploadedBy !== targetUid));
      setPendingNotes((prev) => prev.filter((n) => n.uploadedBy !== targetUid));
      fetchModerationData(true);
    } catch (e: any) {
      console.error(e);
      error("Failed to remove user: " + e.message);
    }
  };

  const handleBlockUser = async (targetUid: string, displayName: string) => {
    if (targetUid === currentAuthUser?.uid) {
      info("Self-block safeguard: You cannot ban your own administrative account!");
      return;
    }

    const isConfirmed = window.confirm(`Are you absolutely sure you want to BLOCK & BAN "${displayName}"? This will permanently blacklist their IP address and browser hardware fingerprint, disconnect them immediately, and delete their profile.`);
    if (!isConfirmed) return;

    try {
      // 1. Fetch user IP and Hardware Fingerprint from profiles table
      let userIp = '';
      let userHwId = '';
      try {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('last_ip, lastIp, hardware_id, hardwareId')
          .eq('id', targetUid)
          .single();
        if (profileRow) {
          userIp = profileRow.last_ip || profileRow.lastIp || '';
          userHwId = profileRow.hardware_id || profileRow.hardwareId || '';
        }
      } catch (ipErr) {
        console.warn("Could not retrieve user credentials before banning:", ipErr);
      }

      // Fallback: If no IP stashed, try to find in online users
      if (!userIp) {
        const session = onlineUsers.find(u => u.uid === targetUid);
        if (session) {
          userIp = localStorage.getItem('noteweb-detected-ip') || '';
        }
      }

      const blockedAt = new Date().toISOString();
      const reason = `Banned by administrator (IP & Hardware ID)`;

      // Write to supabase blocked_ips table
      if (userIp || userHwId) {
        const ipKey = userIp || `hw-blocked-${targetUid}`;
        try {
          await supabase.from('blocked_ips').insert([
            {
              id: ipKey,
              blocked_at: blockedAt,
              reason,
              status: 'blocked',
              hardware_id: userHwId
            }
          ]);
        } catch (blockErr) {
          console.warn("Failed to block user in Supabase:", blockErr);
        }

        // Write to mock localStorage blocked_ips database
        try {
          const blockedStr = localStorage.getItem('noteweb-db-blocked_ips');
          let blockedList: any[] = [];
          if (blockedStr) {
            try { blockedList = JSON.parse(blockedStr); } catch {}
          }
          blockedList = blockedList.filter((item: any) => item.id !== ipKey);
          blockedList.push({
            id: ipKey,
            blocked_at: blockedAt,
            reason,
            status: 'blocked',
            hardware_id: userHwId
          });
          localStorage.setItem('noteweb-db-blocked_ips', JSON.stringify(blockedList));
          
          // Force active tabs to reload/check by dispatching storage event
          window.dispatchEvent(new StorageEvent('storage', { key: 'noteweb-db-blocked_ips' }));
        } catch (lsErr) {
          console.warn("Failed to block user in local storage mockup:", lsErr);
        }
      }

      // 2. Cascade delete their profile so their active session watchdog triggers immediate logout
      const { error: deleteProfileErr } = await supabase
        .from('profiles')
        .delete()
        .eq('id', targetUid);

      if (deleteProfileErr) throw deleteProfileErr;

      // Delete from mock/local profile stash
      try {
        localStorage.removeItem(`noteweb-profile-${targetUid}`);
      } catch {}

      success(`User "${displayName}" has been completely blocked and banned!`);
      
      // Update UI lists
      setUsersList((prev) => prev.filter((u) => u.uid !== targetUid));
      fetchModerationData(true);
    } catch (e: any) {
      console.error(e);
      error("Failed to execute device block: " + e.message);
    }
  };

  const handleUpdateIpStatus = async (ip: string, status: 'blocked' | 'approved_by_admin' | 'deleted') => {
    try {
      if (status === 'deleted') {
        const isConfirmed = window.confirm(`Are you sure you want to permanently remove IP "${ip}" from the access control database?`);
        if (!isConfirmed) return;
        
        await supabase.from('blocked_ips').delete().eq('id', ip);
        
        // Local storage update fallback
        try {
          const blockedStr = localStorage.getItem('noteweb-db-blocked_ips');
          if (blockedStr) {
            const blockedList = JSON.parse(blockedStr);
            if (Array.isArray(blockedList)) {
              const filtered = blockedList.filter((item: any) => item.id !== ip);
              localStorage.setItem('noteweb-db-blocked_ips', JSON.stringify(filtered));
            }
          }
        } catch {}
        
        setBlockedIps(prev => prev.filter(b => b.id !== ip));
        success(`IP Address "${ip}" removed from database.`);
      } else {
        const actionText = status === 'approved_by_admin' ? 'approve and grant access to' : 'block';
        const isConfirmed = window.confirm(`Are you sure you want to ${actionText} IP "${ip}"?`);
        if (!isConfirmed) return;

        await supabase.from('blocked_ips').update({ status }).eq('id', ip);
        
        // Local storage update fallback
        try {
          const blockedStr = localStorage.getItem('noteweb-db-blocked_ips');
          if (blockedStr) {
            const blockedList = JSON.parse(blockedStr);
            if (Array.isArray(blockedList)) {
              const updated = blockedList.map((item: any) => 
                item.id === ip ? { ...item, status } : item
              );
              localStorage.setItem('noteweb-db-blocked_ips', JSON.stringify(updated));
            }
          }
        } catch {}

        setBlockedIps(prev => prev.map(b => b.id === ip ? { ...b, status } : b));
        success(`IP Address "${ip}" status updated to ${status}.`);
      }
      fetchModerationData(true);
    } catch (e: any) {
      console.error("Failed to update IP status:", e);
      error("Failed to update IP access status: " + e.message);
    }
  };

  const handleDeleteFlaggedChat = async (flaggedId: string, chatId: string) => {
    const isConfirmed = window.confirm("Are you sure you want to permanently delete this chat message and clear this notification?");
    if (!isConfirmed) return;

    try {
      // 1. Delete the chat message from chats table
      await supabase.from('chats').delete().eq('id', chatId);

      // 2. Broadcast the delete message event
      try {
        const channel = supabase.channel('public:chats');
        await new Promise<void>((resolve) => {
          channel.subscribe(async (status: any) => {
            if (status === 'SUBSCRIBED') {
              await channel.send({
                type: 'broadcast',
                event: 'delete-message',
                payload: { id: chatId }
              });
              resolve();
            } else {
              resolve();
            }
          });
          setTimeout(resolve, 1000);
        });
      } catch (e) {
        console.warn(e);
      }

      // 3. Delete flagged notification from Supabase
      try {
        await supabase.from('flagged_chats').delete().eq('id', flaggedId);
      } catch (e) {}

      // 4. Update state and localStorage
      setFlaggedChats((prev) => prev.filter((f) => f.id !== flaggedId));
      
      const localFlaggedStr = localStorage.getItem('noteweb-flagged-chats');
      if (localFlaggedStr) {
        try {
          const localFlagged = JSON.parse(localFlaggedStr);
          if (Array.isArray(localFlagged)) {
            const filtered = localFlagged.filter((f: any) => f.id !== flaggedId);
            localStorage.setItem('noteweb-flagged-chats', JSON.stringify(filtered));
          }
        } catch {}
      }

      // Also clean from local broadcast chat cache
      try {
        const storedChatsStr = localStorage.getItem('noteweb-broadcasted-chats');
        if (storedChatsStr) {
          const storedChats = JSON.parse(storedChatsStr);
          if (Array.isArray(storedChats)) {
            const filtered = storedChats.filter((c: any) => c.id !== chatId);
            localStorage.setItem('noteweb-broadcasted-chats', JSON.stringify(filtered));
          }
        }
      } catch {}

      success("Flagged message deleted and notification cleared.");
    } catch (e: any) {
      console.error(e);
      error("Failed to delete flagged message: " + e.message);
    }
  };

  const handleClearFlaggedNotification = async (flaggedId: string) => {
    try {
      // Delete flagged notification from Supabase
      try {
        await supabase.from('flagged_chats').delete().eq('id', flaggedId);
      } catch (e) {}

      // Update state and localStorage
      setFlaggedChats((prev) => prev.filter((f) => f.id !== flaggedId));
      
      const localFlaggedStr = localStorage.getItem('noteweb-flagged-chats');
      if (localFlaggedStr) {
        try {
          const localFlagged = JSON.parse(localFlaggedStr);
          if (Array.isArray(localFlagged)) {
            const filtered = localFlagged.filter((f: any) => f.id !== flaggedId);
            localStorage.setItem('noteweb-flagged-chats', JSON.stringify(filtered));
          }
        } catch {}
      }

      success("Notification dismissed.");
    } catch (e: any) {
      console.error(e);
      error("Failed to dismiss notification: " + e.message);
    }
  };

  const getFormatDate = (timestamp: any) => {
    if (!timestamp) return 'Recent';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Group online users by uid (same user on multiple devices)
  const onlineByUid = onlineUsers.reduce<Record<string, OnlineUser[]>>((acc, u) => {
    if (!acc[u.uid]) acc[u.uid] = [];
    acc[u.uid].push(u);
    return acc;
  }, {});

  const uniqueOnlineCount = Object.keys(onlineByUid).length;

  return (
    <div className="min-h-screen w-full py-12 px-4 md:px-8 relative overflow-hidden">
      {/* Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 glow-indigo rounded-full pointer-events-none blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 glow-purple rounded-full pointer-events-none blur-3xl" />

      <div className="max-w-6xl mx-auto z-10 relative flex flex-col gap-8">
        
        {/* Banner */}
        <div className="text-left border-b border-white/[0.05] pb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h1 className="text-4xl font-extrabold tracking-tight text-white light-mode:text-slate-900 flex items-center gap-3">
              <ShieldAlert className="w-9 h-9 text-indigo-500 flex-shrink-0 animate-pulse" /> NoteWeb Control Center
            </h1>
            {/* Live connection status indicator */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${
              realtimeConnected 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-slate-500/10 border-white/10 text-slate-500'
            }`}>
              {realtimeConnected ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  <Wifi className="w-3.5 h-3.5" /> Live Sync Active
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" /> Connecting...
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <p className="text-slate-400 light-mode:text-slate-500 font-medium text-sm">
              Secure admin workspace to moderate uploads, purge spams, and manage student privileges.
            </p>
            <button
              onClick={() => fetchModerationData(true)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-400 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refreshed {getRelativeTime(lastRefresh.toISOString())}
            </button>
          </div>
        </div>

        {/* Admin Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-white/[0.05] pb-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('moderation')}
            className={`
              px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 flex-shrink-0
              ${activeTab === 'moderation' 
                ? 'border-indigo-500 text-white light-mode:text-indigo-600' 
                : 'border-transparent text-slate-400 hover:text-slate-200'}
            `}
          >
            <FileSearch className="w-4 h-4" /> Moderation ({pendingNotes.length})
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`
              px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 flex-shrink-0
              ${activeTab === 'notes' 
                ? 'border-indigo-500 text-white light-mode:text-indigo-600' 
                : 'border-transparent text-slate-400 hover:text-slate-200'}
            `}
          >
            <BookOpen className="w-4 h-4" /> Library ({allNotes.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`
              px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 flex-shrink-0
              ${activeTab === 'users' 
                ? 'border-indigo-500 text-white light-mode:text-indigo-600' 
                : 'border-transparent text-slate-400 hover:text-slate-200'}
            `}
          >
            <Users className="w-4 h-4" /> All Users ({usersList.length})
          </button>
          <button
            onClick={() => setActiveTab('online')}
            className={`
              px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 flex-shrink-0
              ${activeTab === 'online' 
                ? 'border-emerald-500 text-emerald-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'}
            `}
          >
            <Activity className="w-4 h-4" />
            Online Now
            {uniqueOnlineCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-extrabold animate-pulse">
                {onlineUsers.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('feedback')}
            className={`
              px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 flex-shrink-0
              ${activeTab === 'feedback' 
                ? 'border-indigo-500 text-indigo-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'}
            `}
          >
            <Star className="w-4 h-4 text-amber-400" />
            Reviews
            {feedbacks.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-extrabold">
                {feedbacks.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('flagged')}
            className={`
              px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 flex-shrink-0
              ${activeTab === 'flagged' 
                ? 'border-rose-500 text-rose-500 font-extrabold' 
                : 'border-transparent text-slate-400 hover:text-slate-200'}
            `}
          >
            <ShieldAlert className="w-4 h-4 text-rose-500 animate-pulse" />
            Flagged Chats
            {flaggedChats.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-black animate-pulse">
                {flaggedChats.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('blocked_ips')}
            className={`
              px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 flex-shrink-0
              ${activeTab === 'blocked_ips' 
                ? 'border-indigo-500 text-white light-mode:text-indigo-600' 
                : 'border-transparent text-slate-400 hover:text-slate-200'}
            `}
          >
            <Shield className="w-4 h-4 text-indigo-400" />
            IP Access Control
            {blockedIps.filter(ip => ip.status === 'pending_approval').length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[10px] font-black animate-pulse ml-1.5">
                {blockedIps.filter(ip => ip.status === 'pending_approval').length}
              </span>
            )}
          </button>
        </div>

        {/* Main Workspace Panels */}
        <div className="text-left">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} height={80} className="w-full" />
              ))}
            </div>
          ) : activeTab === 'online' ? (
            /* ===== ONLINE NOW TAB ===== */
            <div className="flex flex-col gap-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <GlassPanel className="p-5 text-center bg-emerald-500/5 border border-emerald-500/10">
                  <div className="text-3xl font-extrabold text-emerald-400">{uniqueOnlineCount}</div>
                  <div className="text-xs font-semibold text-slate-400 mt-1">Users Online</div>
                </GlassPanel>
                <GlassPanel className="p-5 text-center bg-indigo-500/5 border border-indigo-500/10">
                  <div className="text-3xl font-extrabold text-indigo-400">{onlineUsers.length}</div>
                  <div className="text-xs font-semibold text-slate-400 mt-1">Active Sessions</div>
                </GlassPanel>
                <GlassPanel className="p-5 text-center bg-purple-500/5 border border-purple-500/10">
                  <div className="text-3xl font-extrabold text-purple-400">
                    {onlineUsers.filter(u => u.role === 'admin').length}
                  </div>
                  <div className="text-xs font-semibold text-slate-400 mt-1">Admins Online</div>
                </GlassPanel>
              </div>

              {uniqueOnlineCount === 0 ? (
                <GlassPanel className="h-64 flex flex-col items-center justify-center text-center gap-4 bg-[#16161D]/10">
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center text-slate-400">
                    <Wifi className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white light-mode:text-slate-800">Presence Initializing...</h4>
                    <p className="text-xs text-slate-500 max-w-xs mt-1">
                      Connecting to live presence channel. Users will appear here as they log in across devices and browsers.
                    </p>
                  </div>
                </GlassPanel>
              ) : (
                <div className="flex flex-col gap-4">
                  {Object.entries(onlineByUid).map(([uid, sessions]) => {
                    const primary = sessions[0];
                    const isCurrentUser = uid === currentAuthUser?.uid;
                    return (
                      <GlassPanel
                        key={uid}
                        className={`p-5 flex flex-col md:flex-row md:items-start justify-between gap-4 border ${
                          primary.role === 'admin' 
                            ? 'border-amber-500/20 bg-amber-500/[0.03]' 
                            : 'border-white/[0.05] bg-[#16161D]/20'
                        } hover:border-white/10`}
                      >
                        <div className="flex items-start gap-4 min-w-0">
                          {/* Avatar */}
                          <div className="relative flex-shrink-0">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${
                              primary.role === 'admin' 
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            }`}>
                              <User className="w-5 h-5" />
                            </div>
                            {/* Online pulse dot */}
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0A0A0C] animate-pulse" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-white leading-snug light-mode:text-slate-900">
                                {primary.displayName || 'Anonymous'}
                              </h4>
                              {isCurrentUser && (
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
                                  You
                                </span>
                              )}
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                                primary.role === 'admin' 
                                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                                  : 'bg-slate-500/10 border-white/5 text-slate-400'
                              }`}>
                                {primary.role.toUpperCase()}
                              </span>
                            </div>
                            <div className="text-slate-500 text-xs mt-0.5 truncate max-w-xs">{primary.email}</div>
                            
                            {/* Active sessions list */}
                            <div className="flex flex-col gap-1.5 mt-2.5">
                              {sessions.map((session) => (
                                <div key={session.deviceId} className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                                  <span className="flex items-center gap-1.5 text-indigo-400">
                                    {getDeviceIcon(session.deviceInfo)}
                                    {session.deviceInfo}
                                  </span>
                                  <span className="text-slate-600">·</span>
                                  <Clock className="w-3 h-3 text-slate-600" />
                                  <span>Online {getRelativeTime(session.onlineSince)}</span>
                                  <span className="text-slate-600">·</span>
                                  <span className="text-slate-500">Seen {getRelativeTime(session.lastSeen)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Session count badge */}
                        <div className="flex items-center gap-2 self-start md:self-auto flex-shrink-0">
                          {sessions.length > 1 && (
                            <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center gap-1">
                              <Monitor className="w-3 h-3" />
                              {sessions.length} devices
                            </span>
                          )}
                          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                            Live
                          </span>
                        </div>
                      </GlassPanel>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === 'moderation' ? (
            // Moderation panel
            pendingNotes.length > 0 ? (
              <div className="flex flex-col gap-4">
                {pendingNotes.map((note) => (
                  <GlassPanel 
                    key={note.id} 
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-white/[0.05] bg-[#16161D]/20 hover:border-white/10"
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/10 mt-1 flex-shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 text-left">
                        <h4 className="font-bold text-white leading-snug truncate light-mode:text-slate-900">
                          {note.subject}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 text-xs mt-1.5 font-medium">
                          <span>Semester {note.semester}</span>
                          <span>•</span>
                          <span>Prof. {note.teacher}</span>
                          <span>•</span>
                          <span>Uploader: {note.uploaderName} ({note.uploaderEmail})</span>
                          <span>•</span>
                          <span>Uploaded {getFormatDate(note.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start md:self-auto ml-[60px] md:ml-0">
                      <button
                        onClick={() => openPdfDocument(note.pdfUrl || 'db-base64-fetch', note.pdfPath || '', note.id)}
                        className="px-4 py-2 rounded-lg border border-white/[0.08] text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 light-mode:border-slate-900/10 light-mode:text-slate-600 light-mode:hover:text-slate-900 cursor-pointer"
                      >
                        {note.pdfPath === 'external-link' ? 'Open Shared Link' : 'Preview PDF'}
                      </button>

                      <button
                        onClick={() => handleModerate(note.id, 'approved')}
                        className="p-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all active:scale-95"
                        title="Approve Note"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleModerate(note.id, 'rejected')}
                        className="p-2 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all active:scale-95"
                        title="Reject Note"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </GlassPanel>
                ))}
              </div>
            ) : (
              <GlassPanel className="h-64 flex flex-col items-center justify-center text-center gap-4 bg-[#16161D]/10">
                <div className="w-12 h-12 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center text-indigo-400">
                  <ShieldCheck className="w-6 h-6 animate-bounce" />
                </div>
                <div>
                  <h4 className="font-bold text-white light-mode:text-slate-800">Clear queue!</h4>
                  <p className="text-xs text-slate-500 max-w-xs mt-1">
                    No pending note uploads require moderation at this time. Excellent!
                  </p>
                </div>
              </GlassPanel>
            )
          ) : activeTab === 'notes' ? (
            // Manage Library tab
            allNotes.length > 0 ? (
              <div className="flex flex-col gap-4">
                {allNotes.map((note) => (
                  <GlassPanel 
                    key={note.id} 
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-white/[0.05] bg-[#16161D]/20 hover:border-white/10"
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/10 mt-1 flex-shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 text-left">
                        <h4 className="font-bold text-white leading-snug truncate light-mode:text-slate-900">
                          {note.subject}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 text-xs mt-1.5 font-medium">
                          <span>Semester {note.semester}</span>
                          <span>•</span>
                          <span>Prof. {note.teacher}</span>
                          <span>•</span>
                          <span>Uploader: {note.uploaderName}</span>
                          <span>•</span>
                          <span>{getFormatDate(note.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3.5 self-start md:self-auto ml-[60px] md:ml-0">
                      <span className={`
                        text-[10px] font-extrabold tracking-wider px-2.5 py-1 rounded-full border
                        ${note.status === 'approved' && 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}
                        ${note.status === 'pending' && 'bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse'}
                        ${note.status === 'rejected' && 'bg-rose-500/10 border-rose-500/20 text-rose-400'}
                      `}>
                        {note.status.toUpperCase()}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openPdfDocument(note.pdfUrl || 'db-base64-fetch', note.pdfPath || '', note.id)}
                          className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 light-mode:border-slate-900/10 cursor-pointer"
                        >
                          {note.pdfPath === 'external-link' ? 'Open Link' : 'Preview'}
                        </button>

                        <button
                          onClick={() => handleDeleteNote(note.id, note.pdfPath)}
                          className="p-2 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all active:scale-95"
                          title="Purge Document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </GlassPanel>
                ))}
              </div>
            ) : (
              <GlassPanel className="h-64 flex flex-col items-center justify-center text-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-slate-500">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-200">Library is empty</h4>
                  <p className="text-xs text-slate-500 max-w-xs mt-1">
                    No notes exist in the library yet. Start by contributing!
                  </p>
                </div>
              </GlassPanel>
            )
          ) : activeTab === 'users' ? (
            // Users list tab
            usersList.length > 0 ? (
              <div className="flex flex-col gap-4">
                {usersList.map((usr) => {
                  const isOnline = onlineUsers.some(o => o.uid === usr.uid);
                  const userSessions = onlineByUid[usr.uid] || [];
                  return (
                    <GlassPanel 
                      key={usr.uid} 
                      className={`p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border transition-all duration-300 ${
                        isOnline
                          ? 'border-emerald-500/20 bg-emerald-500/[0.02]'
                          : 'border-white/[0.05] bg-[#16161D]/20'
                      } hover:border-white/10`}
                    >
                      <div className="flex items-start gap-4 min-w-0">
                        <div className="relative flex-shrink-0">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center border mt-1 ${
                            isOnline
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : 'bg-indigo-500/10 border-indigo-500/10 text-indigo-400'
                          }`}>
                            <User className="w-5 h-5" />
                          </div>
                          {/* Online indicator */}
                          <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#0A0A0C] ${
                            isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                          }`} />
                        </div>
                        <div className="min-w-0 text-left">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-white leading-snug truncate light-mode:text-slate-900">
                              {usr.displayName}
                            </h4>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                              isOnline
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                : 'bg-slate-500/10 border-white/5 text-slate-400'
                            }`}>
                              {isOnline ? 'ONLINE' : 'OFFLINE'}
                            </span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                              usr.role === 'admin' 
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                                : 'bg-slate-500/10 border-white/5 text-slate-400'
                            }`}>
                              {usr.role.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 text-xs mt-1.5 font-medium">
                            <span>Email: {usr.email}</span>
                            <span>•</span>
                            <span>Registered {getFormatDate(usr.createdAt)}</span>
                          </div>

                          {/* List of active devices if online */}
                          {isOnline && userSessions.length > 0 && (
                            <div className="flex flex-col gap-1 mt-2.5">
                              {userSessions.map((session) => (
                                <div key={session.deviceId} className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                                  <span className="flex items-center gap-1 text-indigo-400">
                                    {getDeviceIcon(session.deviceInfo)}
                                    {session.deviceInfo}
                                  </span>
                                  <span className="text-slate-600">·</span>
                                  <Clock className="w-3 h-3 text-slate-600" />
                                  <span>Active {getRelativeTime(session.onlineSince)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3.5 self-start md:self-auto ml-[60px] md:ml-0">
                        <button
                          onClick={() => handleRoleToggle(usr.uid, usr.role)}
                          className={`
                            px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95
                            ${usr.role === 'admin' 
                              ? 'border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white' 
                              : 'border border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-white'}
                          `}
                        >
                          {usr.role === 'admin' ? 'Demote' : 'Elevate'}
                        </button>

                        {usr.uid !== currentAuthUser?.uid && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleBlockUser(usr.uid, usr.displayName)}
                              className="p-2 rounded-lg border border-rose-500/30 bg-rose-500/15 text-rose-500 hover:bg-rose-600 hover:text-white transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                              title="Block & Ban Device (IP + Hardware Fingerprint)"
                            >
                              <ShieldAlert className="w-4 h-4" />
                            </button>
                            
                            <button
                              onClick={() => handleRemoveUser(usr.uid, usr.displayName)}
                              className="p-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                              title="Remove Student Profile"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </GlassPanel>
                  );
                })}
              </div>
            ) : (
              <GlassPanel className="h-64 flex flex-col items-center justify-center text-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-slate-500">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-200">No users found</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Wait... how are you reading this if no users exist? Excellent!
                  </p>
                </div>
              </GlassPanel>
            )
          ) : activeTab === 'flagged' ? (
            /* ===== FLAGGED CHATS TAB ===== */
            flaggedChats.length > 0 ? (
              <div className="flex flex-col gap-4">
                {flaggedChats.map((f) => (
                  <GlassPanel 
                    key={f.id} 
                    className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-4 border border-rose-500/10 bg-rose-500/[0.02] hover:border-rose-500/20"
                  >
                    <div className="flex items-start gap-4 min-w-0 text-left">
                      <div className="flex-shrink-0">
                        {renderAvatar(f.sender_avatar, "w-11 h-11 text-lg")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h4 className="font-bold text-white leading-none light-mode:text-slate-950">
                            {f.sender_name}
                          </h4>
                          <span className="text-[10px] font-extrabold tracking-wider px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-500 uppercase">
                            Flagged Message
                          </span>
                          <span className="text-[10px] font-extrabold tracking-wider px-2 py-0.5 rounded border border-white/[0.06] bg-white/[0.02] text-slate-400">
                            Department: {f.sender_branch?.toUpperCase() || 'CSE'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                            Vulgar Words: {f.bad_word_detected}
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold ml-1">
                            {getRelativeTime(f.created_at)}
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 font-semibold leading-relaxed mt-3 break-words bg-rose-500/[0.03] border border-rose-500/15 p-3.5 rounded-2xl max-w-2xl">
                          "{f.content}"
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 self-start md:self-auto flex-shrink-0 ml-[60px] md:ml-0">
                      <button
                        onClick={() => handleClearFlaggedNotification(f.id)}
                        className="px-4 py-2 rounded-xl border border-white/[0.08] text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Dismiss Notification"
                      >
                        <Check className="w-4 h-4 text-emerald-400" /> Dismiss
                      </button>
                      <button
                        onClick={() => handleDeleteFlaggedChat(f.id, f.chat_id)}
                        className="px-4 py-2 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                        title="Delete Message & Clear"
                      >
                        <Trash2 className="w-4 h-4" /> Purge Chat
                      </button>
                    </div>
                  </GlassPanel>
                ))}
              </div>
            ) : (
              <GlassPanel className="h-64 flex flex-col items-center justify-center text-center gap-4 bg-[#16161D]/10 border-dashed border-white/5">
                <div className="w-12 h-12 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center text-rose-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-white light-mode:text-slate-800">Clean Lounge!</h4>
                  <p className="text-xs text-slate-500 max-w-xs mt-1">
                    No vulgar or flagged chat logs detected. The campus chat room is safe and respectful!
                  </p>
                </div>
              </GlassPanel>
            )
          ) : activeTab === 'blocked_ips' ? (
            /* ===== IP ACCESS CONTROL TAB ===== */
            blockedIps.length > 0 ? (
              <div className="flex flex-col gap-4 text-left">
                <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                  <h4 className="text-xs font-black uppercase text-indigo-400 tracking-wider">IP Restrictive Database</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Below is the list of blocked IP addresses mapped when accounts are removed/pruned by administrators. 
                    Blocked users can submit Access Requests which will appear here as "Pending Review" for approval.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {blockedIps.map((b) => {
                    const isPending = b.status === 'pending_approval';
                    const isApproved = b.status === 'approved_by_admin';
                    
                    return (
                      <GlassPanel 
                        key={b.id} 
                        className={`p-5 flex flex-col justify-between gap-4 border transition-all ${
                          isPending 
                            ? 'border-indigo-500/25 bg-indigo-500/[0.02] shadow-[0_0_12px_rgba(99,102,241,0.05)]' 
                            : isApproved 
                              ? 'border-emerald-500/15 bg-emerald-500/[0.01]' 
                              : 'border-rose-500/15 bg-rose-500/[0.01]'
                        }`}
                      >
                        <div className="space-y-3 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-white text-sm font-mono tracking-tight bg-slate-900 px-2.5 py-1 rounded-lg border border-white/[0.05]">
                              🌐 {b.id}
                            </span>
                            {isPending ? (
                              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 animate-pulse">
                                Pending Review
                              </span>
                            ) : isApproved ? (
                              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                Approved / Active
                              </span>
                            ) : (
                              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                Blocked / Restricted
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-400 space-y-1.5 mt-2.5">
                            <p className="font-semibold"><span className="text-slate-500">Blocked on:</span> {new Date(b.blocked_at).toLocaleString()}</p>
                            {b.reason && <p className="font-semibold"><span className="text-slate-500">Reason:</span> {b.reason}</p>}
                            {b.request_statement && (
                              <div className="mt-3 p-3 bg-white/[0.03] border border-white/[0.05] rounded-xl text-[11px] text-indigo-200">
                                <span className="block text-[9px] font-black uppercase text-indigo-400 tracking-wider mb-1">Access Request Statement:</span>
                                "{b.request_statement}"
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 border-t border-white/[0.04] pt-3.5 mt-1.5 flex-wrap">
                          {!isApproved ? (
                            <button
                              onClick={() => handleUpdateIpStatus(b.id, 'approved_by_admin')}
                              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                            >
                              <Check className="w-3.5 h-3.5" /> Approve Access
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateIpStatus(b.id, 'blocked')}
                              className="px-3.5 py-1.5 rounded-lg bg-rose-600/20 border border-rose-500/30 text-rose-400 hover:bg-rose-600 hover:text-white font-extrabold text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                            >
                              <X className="w-3.5 h-3.5" /> Revoke Access / Block
                            </button>
                          )}
                          <button
                            onClick={() => handleUpdateIpStatus(b.id, 'deleted')}
                            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white font-extrabold text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 active:scale-95 border border-white/[0.05] ml-auto"
                            title="Remove from blocklist database"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete Entry
                          </button>
                        </div>
                      </GlassPanel>
                    );
                  })}
                </div>
              </div>
            ) : (
              <GlassPanel className="h-64 flex flex-col items-center justify-center text-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-slate-500">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-200">No Blocked IPs found</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Excellent! All students are currently allowed access.
                  </p>
                </div>
              </GlassPanel>
            )
          ) : (
            /* ===== FEEDBACKS/REVIEWS TAB ===== */
            (() => {
              const totalFeedbacks = feedbacks.length;
              const ratingCounts = [0, 0, 0, 0, 0]; // 1 to 5 stars
              let sumRatings = 0;
              
              feedbacks.forEach((f) => {
                const r = Math.round(f.rating);
                if (r >= 1 && r <= 5) {
                  ratingCounts[r - 1]++;
                  sumRatings += f.rating;
                }
              });

              const avgRating = totalFeedbacks > 0 ? (sumRatings / totalFeedbacks).toFixed(1) : '0.0';
              
              const getPercentage = (count: number) => {
                if (totalFeedbacks === 0) return 0;
                return Math.round((count / totalFeedbacks) * 100);
              };

              return (
                <div className="flex flex-col gap-6">
                  {/* Google Play Store-Style rating metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                    
                    {/* Average Rating Big Box */}
                    <GlassPanel className="p-6 md:col-span-4 flex flex-col items-center justify-center text-center bg-white/[0.01] border border-white/[0.04]">
                      <h3 className="text-6xl font-black text-white tracking-tight leading-none mb-2">
                        {avgRating}
                      </h3>
                      <div className="flex items-center gap-1.5 mb-2">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const floatAvg = parseFloat(avgRating);
                          const isFilled = star <= floatAvg;
                          const isHalf = !isFilled && (star - 0.5 <= floatAvg);
                          return (
                            <Star 
                              key={star} 
                              className={`w-5 h-5 ${
                                isFilled 
                                  ? 'fill-amber-400 text-amber-400 filter drop-shadow-[0_0_4px_rgba(245,158,11,0.3)]' 
                                  : isHalf 
                                    ? 'fill-amber-400/50 text-amber-400/50' 
                                    : 'text-slate-700'
                              }`} 
                            />
                          );
                        })}
                      </div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {totalFeedbacks} Ratings
                      </span>
                    </GlassPanel>

                    {/* Google Play Store Star Distribution Bars */}
                    <GlassPanel className="p-6 md:col-span-8 flex flex-col justify-center gap-2.5 bg-white/[0.01] border border-white/[0.04]">
                      {[5, 4, 3, 2, 1].map((stars) => {
                        const count = ratingCounts[stars - 1];
                        const pct = getPercentage(count);
                        return (
                          <div key={stars} className="flex items-center gap-3 w-full text-xs font-bold">
                            <span className="w-3 text-slate-400 text-right">{stars}</span>
                            <div className="flex-1 h-3 bg-slate-950/80 border border-white/5 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(245,158,11,0.2)]" 
                                style={{ width: `${pct}%` }} 
                              />
                            </div>
                            <span className="w-12 text-slate-500 text-right">{count} ({pct}%)</span>
                          </div>
                        );
                      })}
                    </GlassPanel>

                  </div>

                  {/* Reviews Feed List */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-extrabold text-white pl-1 flex items-center gap-2 mt-2">
                      <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                      Detailed User Reviews
                    </h3>

                    {totalFeedbacks === 0 ? (
                      <GlassPanel className="h-64 flex flex-col items-center justify-center text-center gap-4 bg-[#16161D]/10">
                        <div className="w-12 h-12 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center text-amber-400">
                          <Star className="w-6 h-6 animate-pulse" />
                        </div>
                        <div>
                          <h4 className="font-bold text-white light-mode:text-slate-800">No evaluations yet</h4>
                          <p className="text-xs text-slate-500 max-w-xs mt-1">
                            No student ratings or reviews have been posted to this instance yet. Leave a feedback to get started!
                          </p>
                        </div>
                      </GlassPanel>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {feedbacks.map((f) => (
                          <GlassPanel 
                            key={f.id} 
                            className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-4 border border-white/[0.04] bg-[#16161D]/20 hover:border-white/10"
                          >
                            <div className="flex items-start gap-4 min-w-0 text-left">
                              {/* Avatar */}
                              <div className="flex-shrink-0">
                                {renderAvatar(f.photo_url, "w-11 h-11 text-lg")}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <h4 className="font-bold text-white leading-none light-mode:text-slate-950">
                                    {f.display_name}
                                  </h4>
                                  <span className="text-[10px] font-extrabold tracking-wider px-2 py-0.5 rounded-full border border-white/[0.06] bg-white/[0.02] text-slate-400">
                                    {BRANCH_LABELS[f.department] || f.department || 'CSE'}
                                  </span>
                                </div>

                                {/* Stars */}
                                <div className="flex items-center gap-1 mt-2">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star 
                                      key={star} 
                                      className={`w-3.5 h-3.5 ${
                                        star <= f.rating 
                                          ? 'fill-amber-400 text-amber-400 filter drop-shadow-[0_0_3px_rgba(245,158,11,0.3)]' 
                                          : 'text-slate-700'
                                      }`} 
                                    />
                                  ))}
                                  <span className="text-[10px] text-slate-500 font-semibold ml-2">
                                    {getRelativeTime(f.created_at)}
                                  </span>
                                </div>

                                {/* Comment */}
                                <p className="text-xs text-slate-300 font-medium leading-relaxed mt-3 break-words whitespace-pre-wrap">
                                  {f.comment ? f.comment : (
                                    <span className="text-slate-500 italic font-normal text-[11px]">
                                      Rated {f.rating} star{f.rating === 1 ? '' : 's'} (no descriptive comments shared)
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>

                            {/* Actions (Purge feedback) */}
                            <div className="flex items-center gap-2 self-end md:self-auto flex-shrink-0 ml-[60px] md:ml-0">
                              <button
                                onClick={() => handleDeleteFeedback(f.id)}
                                className="p-2 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                                title="Delete Review"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </GlassPanel>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
};
export default Admin;
