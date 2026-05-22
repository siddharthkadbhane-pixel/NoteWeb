import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
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
  BookOpen
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

export const Admin: React.FC = () => {
  const { user: currentAuthUser } = useAuth();
  const { success, error, info } = useToast();

  const [activeTab, setActiveTab] = useState<'moderation' | 'notes' | 'users'>('moderation');
  const [pendingNotes, setPendingNotes] = useState<NoteDocument[]>([]);
  const [allNotes, setAllNotes] = useState<NoteDocument[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

      console.log(`[NoteWeb Admin Log] Dashboard data loaded successfully. Pending notes: ${pending.length}, Total notes: ${all.length}, Users: ${users.length}`);
    } catch (e: any) {
      console.error("[NoteWeb Admin Log] Failed to load dashboard data:", e);
      error("Failed to load admin panel data: " + e.message);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchModerationData();

    // 1. Set up Realtime subscriptions for profiles and notes
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
              console.log('[NoteWeb Admin Realtime] profiles table change detected across session:', payload);
              fetchModerationData(true);
            }
          )
          .subscribe((status: any) => {
            console.log('[NoteWeb Admin Realtime] profiles channel status:', status);
          });

        channelNotes = supabase
          .channel('public:notes_admin')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'notes' },
            (payload: any) => {
              console.log('[NoteWeb Admin Realtime] notes table change detected across session:', payload);
              fetchModerationData(true);
            }
          )
          .subscribe((status: any) => {
            console.log('[NoteWeb Admin Realtime] notes channel status:', status);
          });
      } else {
        console.warn('[NoteWeb Admin Realtime] Supabase channel is not a function');
      }
    } catch (err) {
      console.warn("[NoteWeb Admin Realtime] Realtime subscriptions failed on Admin Panel:", err);
    }

    return () => {
      console.log('[NoteWeb Admin Realtime] Cleaning up Realtime subscriptions...');
      if (channelProfiles) {
        try {
          channelProfiles.unsubscribe();
        } catch (e) {
          console.warn("Failed to unsubscribe profiles admin channel:", e);
        }
      }
      if (channelNotes) {
        try {
          channelNotes.unsubscribe();
        } catch (e) {
          console.warn("Failed to unsubscribe notes admin channel:", e);
        }
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
      
      // Hot update states
      setPendingNotes((prev) => prev.filter((n) => n.id !== noteId));
      setAllNotes((prev) => prev.map((n) => n.id === noteId ? { ...n, status: action } : n));
    } catch (e: any) {
      console.error(e);
      error("Moderation failed: " + e.message);
    }
  };

  // Delete Note Admin side
  const handleDeleteNote = async (noteId: string, pdfPath: string) => {
    const isConfirmed = window.confirm("Are you absolutely sure you want to delete this notes document? This cannot be undone.");
    if (!isConfirmed) return;

    try {
      // 1. Delete PDF from Storage
      if (pdfPath) {
        const { error: storageErr } = await supabase.storage.from('notes').remove([pdfPath]);
        if (storageErr) {
          console.warn("Storage PDF delete returned warning/error: ", storageErr);
        }
      }

      // 2. Delete Supabase Database Row
      const { error: deleteErr } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId);
        
      if (deleteErr) throw deleteErr;
      
      success("Notes document permanently deleted.");
      
      // Update local states
      setAllNotes((prev) => prev.filter((n) => n.id !== noteId));
      setPendingNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (e: any) {
      console.error(e);
      error("Purge failed: " + e.message);
    }
  };

  // Update User Role Toggle
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
      // 1. Fetch notes uploaded by the user to optionally purge from storage if they have pdfPath
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

      // 2. Delete notes uploaded by user
      const { error: deleteNotesErr } = await supabase
        .from('notes')
        .delete()
        .eq('uploaded_by', targetUid);

      if (deleteNotesErr) throw deleteNotesErr;

      // 3. Delete user profile
      const { error: deleteProfileErr } = await supabase
        .from('profiles')
        .delete()
        .eq('id', targetUid);

      if (deleteProfileErr) throw deleteProfileErr;

      success(`User "${displayName}" and their uploads have been permanently removed!`);

      // Update local states
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

  return (
    <div className="min-h-screen w-full py-12 px-4 md:px-8 relative overflow-hidden">
      {/* Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 glow-indigo rounded-full pointer-events-none blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 glow-purple rounded-full pointer-events-none blur-3xl" />

      <div className="max-w-6xl mx-auto z-10 relative flex flex-col gap-8">
        
        {/* Banner */}
        <div className="text-left border-b border-white/[0.05] pb-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-white light-mode:text-slate-900 flex items-center gap-3">
            <ShieldAlert className="w-9 h-9 text-indigo-500 flex-shrink-0 animate-pulse" /> NoteWeb Control Center
          </h1>
          <p className="text-slate-400 light-mode:text-slate-500 font-medium text-sm mt-2">
            Secure admin workspace to moderate uploads, purge spams, and manage student privileges.
          </p>
        </div>

        {/* Admin Navigation Tabs */}
        <div className="flex items-center gap-3 border-b border-white/[0.05] pb-1">
          <button
            onClick={() => setActiveTab('moderation')}
            className={`
              px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2
              ${activeTab === 'moderation' 
                ? 'border-indigo-500 text-white light-mode:text-indigo-600' 
                : 'border-transparent text-slate-400 hover:text-slate-200'}
            `}
          >
            <FileSearch className="w-4 h-4" /> Moderation Pool ({pendingNotes.length})
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`
              px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2
              ${activeTab === 'notes' 
                ? 'border-indigo-500 text-white light-mode:text-indigo-600' 
                : 'border-transparent text-slate-400 hover:text-slate-200'}
            `}
          >
            <BookOpen className="w-4 h-4" /> Manage Library ({allNotes.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`
              px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2
              ${activeTab === 'users' 
                ? 'border-indigo-500 text-white light-mode:text-indigo-600' 
                : 'border-transparent text-slate-400 hover:text-slate-200'}
            `}
          >
            <Users className="w-4 h-4" /> Users Directory ({usersList.length})
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
                {usersList.map((usr) => (
                  <GlassPanel 
                    key={usr.uid} 
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-white/[0.05] bg-[#16161D]/20 hover:border-white/10"
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/10 mt-1 flex-shrink-0">
                        <User className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 text-left">
                        <h4 className="font-bold text-white leading-snug truncate light-mode:text-slate-900">
                          {usr.displayName}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 text-xs mt-1.5 font-medium">
                          <span>Email: {usr.email}</span>
                          <span>•</span>
                          <span>Registered {getFormatDate(usr.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3.5 self-start md:self-auto ml-[60px] md:ml-0">
                      <span className={`
                        text-[10px] font-extrabold tracking-wider px-2.5 py-1 rounded-full border
                        ${usr.role === 'admin' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-slate-500/10 border-white/5 text-slate-400'}
                      `}>
                        {usr.role.toUpperCase()}
                      </span>

                      <button
                        onClick={() => handleRoleToggle(usr.uid, usr.role)}
                        className={`
                          px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95
                          ${usr.role === 'admin' 
                            ? 'border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white' 
                            : 'border border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-white'}
                        `}
                      >
                        {usr.role === 'admin' ? 'Demote to Student' : 'Elevate to Admin'}
                      </button>

                      {usr.uid !== currentAuthUser?.uid && (
                        <button
                          onClick={() => handleRemoveUser(usr.uid, usr.displayName)}
                          className="p-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all active:scale-95 flex items-center justify-center"
                          title="Remove Student Profile"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </GlassPanel>
                ))}
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
