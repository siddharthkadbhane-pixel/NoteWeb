import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { subscribeToPresenceChanges } from '../services/presence';
import type { OnlineUser } from '../services/presence';
import { 
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
  Activity
} from 'lucide-react';
import { GlassPanel } from '../components/ui/GlassPanel';
import { Skeleton } from '../components/ui/Skeleton';
import { openPdfDocument } from '../utils/pdfDb';

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
  email: string;
  displayName: string;
  role: 'student' | 'admin';
  createdAt: any;
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
    email: p.email || '',
    displayName: p.display_name || p.displayName || '',
    role: p.role || 'student',
    createdAt: p.created_at || p.createdAt || new Date().toISOString(),
  };
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

  const [activeTab, setActiveTab] = useState<'moderation' | 'notes' | 'users' | 'online'>('moderation');
  const [pendingNotes, setPendingNotes] = useState<NoteDocument[]>([]);
  const [allNotes, setAllNotes] = useState<NoteDocument[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
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
      setUsersList(users);
      setLastRefresh(new Date());

      console.log(`[NoteWeb Admin Log] Dashboard data loaded. Pending: ${pending.length}, Total: ${all.length}, Users: ${users.length}`);
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
      }
    } catch (err) {
      console.warn("[NoteWeb Admin Realtime] Realtime subscriptions failed:", err);
    }

    // Auto-refresh every 15 seconds silently
    const refreshInterval = setInterval(() => fetchModerationData(true), 15000);

    return () => {
      clearInterval(refreshInterval);
      if (channelProfiles) {
        try { channelProfiles.unsubscribe(); } catch (e) {}
      }
      if (channelNotes) {
        try { channelNotes.unsubscribe(); } catch (e) {}
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
      if (pdfPath) {
        const { error: storageErr } = await supabase.storage.from('notes').remove([pdfPath]);
        if (storageErr) console.warn("Storage PDF delete warning:", storageErr);
      }

      const { error: deleteErr } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId);
        
      if (deleteErr) throw deleteErr;
      
      success("Notes document permanently deleted.");
      setAllNotes((prev) => prev.filter((n) => n.id !== noteId));
      setPendingNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (e: any) {
      console.error(e);
      error("Purge failed: " + e.message);
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
      const { data: userNotes, error: fetchNotesErr } = await supabase
        .from('notes')
        .select('*')
        .eq('uploaded_by', targetUid);

      if (!fetchNotesErr && userNotes && userNotes.length > 0) {
        const pathsToPurge = userNotes
          .map((n: any) => n.pdf_path || n.pdfPath)
          .filter((p: string) => !!p);
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

      success(`User "${displayName}" and their uploads have been permanently removed!`);

      setUsersList((prev) => prev.filter((u) => u.uid !== targetUid));
      setAllNotes((prev) => prev.filter((n) => n.uploadedBy !== targetUid));
      setPendingNotes((prev) => prev.filter((n) => n.uploadedBy !== targetUid));
    } catch (e: any) {
      console.error(e);
      error("Failed to remove user: " + e.message);
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
                        Preview PDF
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
                          Preview
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
          ) : (
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
                                  <Clock className="w-3 h-3 text-slate-650" />
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
                          <button
                            onClick={() => handleRemoveUser(usr.uid, usr.displayName)}
                            className="p-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                            title="Remove Student Profile"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
          )}
        </div>
      </div>
    </div>
  );
};
export default Admin;
