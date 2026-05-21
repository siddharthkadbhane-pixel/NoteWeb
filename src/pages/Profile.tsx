import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  User, 
  UploadCloud, 
  ThumbsUp, 
  Bookmark, 
  Trash2, 
  Eye, 
  Edit2, 
  FileText, 
  BookOpen, 
  ShieldCheck
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { GlassPanel } from '../components/ui/GlassPanel';
import { Skeleton } from '../components/ui/Skeleton';

interface NoteDocument {
  id: string;
  subject: string;
  semester: string;
  teacher: string;
  description: string;
  pdfUrl: string;
  pdfPath: string;
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  uploaderName: string;
  createdAt: any;
  status: 'pending' | 'approved' | 'rejected';
  likesCount: number;
  branch?: string;
  category?: string;
}

const mapDbNoteToNoteDocument = (n: any): NoteDocument => {
  return {
    id: n.id,
    subject: n.subject || '',
    branch: n.branch || '',
    category: n.category || '',
    semester: n.semester || '',
    teacher: n.teacher || 'General / Unknown',
    description: n.description || '',
    pdfUrl: n.pdf_url || n.pdfUrl || '',
    pdfPath: n.pdf_path || n.pdfPath || '',
    fileName: n.file_name || n.fileName || '',
    fileSize: n.file_size || n.fileSize || 0,
    uploadedBy: n.uploaded_by || n.uploadedBy || '',
    uploaderName: n.uploader_name || n.uploaderName || 'Anonymous Student',
    createdAt: n.created_at || n.createdAt || new Date().toISOString(),
    status: n.status || 'pending',
    likesCount: n.likes_count !== undefined ? n.likes_count : (n.likesCount || 0)
  };
};

export const Profile: React.FC = () => {
  const { user, userProfile, updateProfileDetails, toggleBookmark } = useAuth();
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<'uploads' | 'bookmarks'>('uploads');
  const [myUploads, setMyUploads] = useState<NoteDocument[]>([]);
  const [myBookmarks, setMyBookmarks] = useState<NoteDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Profile Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(userProfile?.displayName || user?.displayName || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const fetchMyData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // 1. Fetch My Uploads
      const { data: uploadsData, error: uploadsErr } = await supabase
        .from('notes')
        .select('*')
        .eq('uploaded_by', user.uid);
      
      if (uploadsErr) throw uploadsErr;

      const uploads = (uploadsData || []).map(mapDbNoteToNoteDocument);
      uploads.sort((a: NoteDocument, b: NoteDocument) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMyUploads(uploads);

      // 2. Fetch My Bookmarks
      if (userProfile?.bookmarks && userProfile.bookmarks.length > 0) {
        const { data: bookmarksData, error: bookmarksErr } = await supabase
          .from('notes')
          .select('*')
          .in('id', userProfile.bookmarks);
        
        if (bookmarksErr) throw bookmarksErr;

        const bookmarks = (bookmarksData || []).map(mapDbNoteToNoteDocument);
        bookmarks.sort((a: NoteDocument, b: NoteDocument) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setMyBookmarks(bookmarks);
      } else {
        setMyBookmarks([]);
      }
    } catch (e: any) {
      console.error(e);
      error("Failed to load user dashboard data: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyData();
  }, [userProfile?.bookmarks]);

  // Edit Profile Name
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      error("Profile name cannot be blank!");
      return;
    }
    
    setIsSavingProfile(true);
    try {
      await updateProfileDetails(editName.trim());
      success("Profile details updated successfully!");
      setIsEditing(false);
    } catch (err: any) {
      error("Failed to save profile: " + err.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Delete Notes Uploader side
  const handleDeleteNote = async (noteId: string, pdfPath: string) => {
    const isConfirmed = window.confirm("Are you absolutely sure you want to delete this note document? This action is permanent.");
    if (!isConfirmed) return;

    try {
      // 1. Delete PDF from Storage
      if (pdfPath) {
        const { error: storageErr } = await supabase.storage
          .from('notes')
          .remove([pdfPath]);
        if (storageErr) {
          console.warn("Storage PDF already deleted or not found: ", storageErr);
        }
      }

      // 2. Delete Supabase Document
      const { error: dbErr } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId);
      
      if (dbErr) throw dbErr;
      
      // Update local states
      setMyUploads((prev) => prev.filter((n) => n.id !== noteId));
      success("Notes document purged successfully!");
    } catch (e: any) {
      console.error(e);
      error("Purge failed: " + e.message);
    }
  };

  const handleUnbookmark = async (noteId: string) => {
    try {
      await toggleBookmark(noteId);
      setMyBookmarks((prev) => prev.filter((n) => n.id !== noteId));
      success("Bookmark removed successfully");
    } catch (e) {
      error("Unbookmark failed");
    }
  };

  // Calculated Stats
  const totalLikesReceived = myUploads.reduce((acc, note) => acc + (note.likesCount || 0), 0);
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
        
        {/* User profile card banner */}
        <GlassPanel className="bg-[#16161D]/40 light-mode:bg-white/90 p-8 shadow-2xl relative overflow-hidden border border-white/[0.08] rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent pointer-events-none" />
          
          <div className="flex items-center gap-5 text-left z-10 relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center text-white font-extrabold text-2xl shadow-xl shadow-purple-600/30">
              {userProfile?.displayName ? userProfile.displayName[0].toUpperCase() : 'S'}
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-white light-mode:text-slate-900 leading-none">
                  {userProfile?.displayName || user?.displayName || 'Student'}
                </h2>
                {userProfile?.role === 'admin' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <ShieldCheck className="w-3.5 h-3.5" /> ADMIN ACCESS
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 font-medium">{user?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 z-10 relative">
            <Button
              onClick={() => setIsEditing(!isEditing)}
              variant="secondary"
              leftIcon={<Edit2 className="w-4 h-4" />}
            >
              Edit Name
            </Button>
          </div>
        </GlassPanel>

        {/* Edit profile dialog sheet */}
        {isEditing && (
          <GlassPanel glowBorder className="bg-slate-950/40 p-6 max-w-md mr-auto text-left w-full">
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <Input
                label="Modify Display Name"
                placeholder="Name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                icon={<User className="w-4 h-4" />}
                required
              />
              <div className="flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isSavingProfile}
                >
                  Save Profile
                </Button>
              </div>
            </form>
          </GlassPanel>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <GlassPanel className="p-6 bg-indigo-500/5 border-indigo-500/10 text-left flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Notes Contributed</span>
              <h3 className="text-3xl font-extrabold text-white light-mode:text-slate-900 mt-2">{myUploads.length}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <UploadCloud className="w-6 h-6" />
            </div>
          </GlassPanel>

          <GlassPanel className="p-6 bg-purple-500/5 border-purple-500/10 text-left flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Likes Received</span>
              <h3 className="text-3xl font-extrabold text-white light-mode:text-slate-900 mt-2">{totalLikesReceived}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
              <ThumbsUp className="w-6 h-6" />
            </div>
          </GlassPanel>

          <GlassPanel className="p-6 bg-pink-500/5 border-pink-500/10 text-left flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bookmarks Saved</span>
              <h3 className="text-3xl font-extrabold text-white light-mode:text-slate-900 mt-2">
                {userProfile?.bookmarks ? userProfile.bookmarks.length : 0}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-400">
              <Bookmark className="w-6 h-6" />
            </div>
          </GlassPanel>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-3 border-b border-white/[0.05] pb-1">
          <button
            onClick={() => setActiveTab('uploads')}
            className={`
              px-5 py-3 text-sm font-bold border-b-2 transition-all relative flex items-center gap-2
              ${activeTab === 'uploads' 
                ? 'border-indigo-500 text-white light-mode:text-indigo-600' 
                : 'border-transparent text-slate-400 hover:text-slate-200'}
            `}
          >
            <BookOpen className="w-4 h-4" /> My Contributions ({myUploads.length})
          </button>
          <button
            onClick={() => setActiveTab('bookmarks')}
            className={`
              px-5 py-3 text-sm font-bold border-b-2 transition-all relative flex items-center gap-2
              ${activeTab === 'bookmarks' 
                ? 'border-indigo-500 text-white light-mode:text-indigo-600' 
                : 'border-transparent text-slate-400 hover:text-slate-200'}
            `}
          >
            <Bookmark className="w-4 h-4" /> Bookmarks ({myBookmarks.length})
          </button>
        </div>

        {/* Tab contents */}
        <div className="text-left">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} height={80} className="w-full" />
              ))}
            </div>
          ) : activeTab === 'uploads' ? (
            myUploads.length > 0 ? (
              <div className="flex flex-col gap-4">
                {myUploads.map((note) => (
                  <GlassPanel 
                    key={note.id} 
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-white/[0.05] bg-[#16161D]/20 hover:border-white/10"
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/10 mt-1 flex-shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 text-left">
                        <h4 className="font-bold text-white leading-snug light-mode:text-slate-900 group-hover:text-indigo-400 transition-colors truncate">
                          {note.subject}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 text-xs mt-1.5 font-medium">
                          <span>Semester {note.semester}</span>
                          <span>•</span>
                          <span>Prof. {note.teacher}</span>
                          <span>•</span>
                          <span>Uploaded {getFormatDate(note.createdAt)}</span>
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
                        <a
                          href={note.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/5 light-mode:border-slate-900/10 transition-all cursor-pointer active:scale-95"
                          title="View PDF"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => handleDeleteNote(note.id, note.pdfPath)}
                          className="p-2 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all active:scale-95"
                          title="Delete Note"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </GlassPanel>
                ))}
              </div>
            ) : (
              <GlassPanel className="h-64 flex flex-col items-center justify-center text-center gap-4 bg-[#16161D]/10">
                <div className="w-12 h-12 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center text-slate-500">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-white light-mode:text-slate-800">No contributions yet</h4>
                  <p className="text-xs text-slate-500 max-w-xs mt-1">
                    You haven't uploaded any study notes yet. Click the contribution link in navigation to share!
                  </p>
                </div>
              </GlassPanel>
            )
          ) : (
            // Bookmarks tab
            myBookmarks.length > 0 ? (
              <div className="flex flex-col gap-4">
                {myBookmarks.map((note) => (
                  <GlassPanel 
                    key={note.id} 
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-white/[0.05] bg-[#16161D]/20 hover:border-white/10"
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/10 mt-1 flex-shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 text-left">
                        <h4 className="font-bold text-white leading-snug light-mode:text-slate-900 truncate">
                          {note.subject}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 text-xs mt-1.5 font-medium">
                          <span>Semester {note.semester}</span>
                          <span>•</span>
                          <span>Prof. {note.teacher}</span>
                          <span>•</span>
                          <span>Uploader: {note.uploaderName}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start md:self-auto ml-[60px] md:ml-0">
                      <a
                        href={note.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/5 light-mode:border-slate-900/10 transition-all cursor-pointer active:scale-95"
                        title="View PDF"
                      >
                        <Eye className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handleUnbookmark(note.id)}
                        className="p-2 rounded-lg border border-white/[0.08] text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all active:scale-95"
                        title="Remove Bookmark"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </GlassPanel>
                ))}
              </div>
            ) : (
              <GlassPanel className="h-64 flex flex-col items-center justify-center text-center gap-4 bg-[#16161D]/10">
                <div className="w-12 h-12 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center text-slate-500">
                  <Bookmark className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-white light-mode:text-slate-800">No bookmarks saved</h4>
                  <p className="text-xs text-slate-500 max-w-xs mt-1">
                    You haven't bookmarked any notes. Explore the public feed page and hit bookmark to collect them!
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
export default Profile;
