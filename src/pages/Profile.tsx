import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { renderAvatar } from '../utils/avatar';
import { 
  User, 
  UploadCloud, 
  Bookmark, 
  Trash2, 
  Eye, 
  Edit2, 
  FileText, 
  BookOpen, 
  ShieldCheck,
  CheckCircle,
  Trophy,
  Award,
  Zap
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

const BRANCH_LABELS: Record<string, string> = {
  computers: 'Computer Science (CSE)',
  electronics: 'Electronics & Comm (ECE)',
  mechanical: 'Mechanical & Civil',
  maths: 'Mathematics',
  science: 'Basic Science & Eng',
  management: 'Management & Humanities'
};

const YEAR_LABELS: Record<string, string> = {
  '1': '1st Year (Freshman)',
  '2': '2nd Year (Sophomore)',
  '3': '3rd Year (Junior)',
  '4': '4th Year (Senior)'
};

const EMOJIS = ['🦊', '🤖', '🥷', '🧑‍💻', '🧙‍♂️', '🦄', '🐱', '🐼', '🦁', '🐯', '🐸', '🐙', '🦖', '🦕', '🐝', '🍕'];
const GRADIENTS = [
  { name: 'Sunset Flame', class: 'from-amber-500 via-orange-500 to-rose-600' },
  { name: 'Nebula Dusk', class: 'from-purple-600 via-pink-500 to-indigo-600' },
  { name: 'Emerald Wave', class: 'from-teal-400 via-emerald-500 to-cyan-500' },
  { name: 'Electric Blue', class: 'from-blue-500 via-indigo-600 to-indigo-700' },
  { name: 'Rose Quartz', class: 'from-rose-400 via-fuchsia-500 to-pink-600' },
  { name: 'Cyber Abyss', class: 'from-gray-800 via-slate-900 to-zinc-950' }
];

export const Profile: React.FC = () => {
  const { user, userProfile, toggleBookmark, updatePoints, updateFullProfile } = useAuth();
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<'uploads' | 'bookmarks'>('uploads');
  const [myUploads, setMyUploads] = useState<NoteDocument[]>([]);
  const [myBookmarks, setMyBookmarks] = useState<NoteDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Profile Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editBranch, setEditBranch] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editCgpa, setEditCgpa] = useState('');
  const [editEmail, setEditEmail] = useState('');
  
  // Custom Avatar Builder states
  const [selectedEmoji, setSelectedEmoji] = useState(EMOJIS[0]);
  const [selectedGradient, setSelectedGradient] = useState(GRADIENTS[0].class);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Daily check-in status
  const [checkinCooldown, setCheckinCooldown] = useState<string | null>(null);

  // Quests status tracking state to trigger visual re-render
  const [questsClaimed, setQuestsClaimed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (userProfile) {
      setEditName(userProfile.displayName || '');
      setEditMobile(userProfile.mobileNo || '');
      setEditBranch(userProfile.branch || 'computers');
      setEditYear(userProfile.year || '1');
      setEditCgpa(userProfile.cgpa || '');
      setEditEmail(userProfile.email || '');
      
      if (userProfile.photoURL?.includes('|')) {
        const [emo, grad] = userProfile.photoURL.split('|');
        setSelectedEmoji(emo);
        setSelectedGradient(grad);
      }
    }
  }, [userProfile, isEditing]);

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

  const checkDailyCooldown = () => {
    if (!user) return;
    const lastCheckin = localStorage.getItem(`noteweb-daily-checkin-${user.uid}`);
    if (lastCheckin) {
      const diff = Date.now() - parseInt(lastCheckin);
      const remaining = 24 * 3600 * 1000 - diff;
      if (remaining > 0) {
        const hours = Math.floor(remaining / 3600000);
        const mins = Math.floor((remaining % 3600000) / 60000);
        setCheckinCooldown(`${hours}h ${mins}m`);
      } else {
        setCheckinCooldown(null);
      }
    } else {
      setCheckinCooldown(null);
    }
  };

  const loadQuestStatus = () => {
    if (!user) return;
    const status: Record<string, boolean> = {
      first_upload: localStorage.getItem(`noteweb-quest-${user.uid}-first_upload`) === 'true',
      bookmark_trio: localStorage.getItem(`noteweb-quest-${user.uid}-bookmark_trio`) === 'true',
      popular_writer: localStorage.getItem(`noteweb-quest-${user.uid}-popular_writer`) === 'true',
    };
    setQuestsClaimed(status);
  };

  useEffect(() => {
    fetchMyData();
    checkDailyCooldown();
    loadQuestStatus();
  }, [user, userProfile?.bookmarks]);

  // Periodic check-in countdown update
  useEffect(() => {
    const timer = setInterval(checkDailyCooldown, 30000);
    return () => clearInterval(timer);
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      error("Profile name cannot be blank!");
      return;
    }
    if (!editMobile.trim() || !/^\+?\d{10,12}$/.test(editMobile.replace(/[\s-]/g, ''))) {
      error("Enter a valid 10-12 digit mobile number");
      return;
    }
    if (editCgpa.trim()) {
      const cgNum = parseFloat(editCgpa);
      if (isNaN(cgNum) || cgNum < 0 || cgNum > 10) {
        error("CGPA must be between 0 and 10");
        return;
      }
    }

    setIsSavingProfile(true);
    try {
      const avatarPayload = `${selectedEmoji}|${selectedGradient}`;
      await updateFullProfile({
        displayName: editName.trim(),
        mobileNo: editMobile.trim(),
        branch: editBranch,
        year: editYear,
        cgpa: editCgpa,
        email: editEmail,
        photoURL: avatarPayload
      });
      success("Profile details and custom avatar saved successfully!");
      setIsEditing(false);
    } catch (err: any) {
      error("Failed to save profile details: " + err.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleClaimDaily = async () => {
    if (!user) return;
    try {
      await updatePoints(20);
      localStorage.setItem(`noteweb-daily-checkin-${user.uid}`, Date.now().toString());
      checkDailyCooldown();
      success("Daily Check-In Claimed! +20 XP awarded.");
    } catch (e) {
      error("Failed to claim daily check-in");
    }
  };

  const handleClaimQuest = async (questId: string, xpAmt: number) => {
    if (!user) return;
    try {
      await updatePoints(xpAmt);
      localStorage.setItem(`noteweb-quest-${user.uid}-${questId}`, 'true');
      loadQuestStatus();
      success(`Quest Completed! +${xpAmt} XP awarded.`);
    } catch (e) {
      error("Failed to claim quest rewards");
    }
  };

  const handleDeleteNote = async (noteId: string, pdfPath: string) => {
    const isConfirmed = window.confirm("Are you absolutely sure you want to delete this note document? This action is permanent.");
    if (!isConfirmed) return;

    try {
      if (pdfPath) {
        await supabase.storage.from('notes').remove([pdfPath]);
      }
      const { error: dbErr } = await supabase.from('notes').delete().eq('id', noteId);
      if (dbErr) throw dbErr;
      
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

  const totalLikesReceived = myUploads.reduce((acc, note) => acc + (note.likesCount || 0), 0);
  
  const getFormatDate = (timestamp: any) => {
    if (!timestamp) return 'Recent';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Quests configuration
  const quests = [
    {
      id: 'first_upload',
      title: 'First Scholar Upload',
      description: 'Upload your first engineering study note',
      reward: 100,
      isMet: myUploads.length > 0,
      progressText: `${myUploads.length > 0 ? 1 : 0}/1 Upload`
    },
    {
      id: 'bookmark_trio',
      title: 'Bookmark Collector',
      description: 'Add 3 or more note bookmarks to your stash',
      reward: 50,
      isMet: (userProfile?.bookmarks?.length || 0) >= 3,
      progressText: `${Math.min(userProfile?.bookmarks?.length || 0, 3)}/3 Saved`
    },
    {
      id: 'popular_writer',
      title: 'Star Academician',
      description: 'Accumulate 5 or more likes on your shared notes',
      reward: 150,
      isMet: totalLikesReceived >= 5,
      progressText: `${totalLikesReceived}/5 Likes`
    }
  ];

  return (
    <div className="min-h-screen w-full py-12 px-4 md:px-8 relative overflow-hidden bg-[#0A0A0C]">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse" />

      <div className="max-w-6xl mx-auto z-10 relative flex flex-col gap-8">
        
        {/* User profile card banner */}
        <GlassPanel className="bg-[#121218]/40 p-8 shadow-2xl relative overflow-hidden border border-white/[0.08] rounded-3xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-6 text-left z-10 relative">
            {renderAvatar(userProfile?.photoURL || '', "w-24 h-24 text-5xl")}
            
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-3xl font-extrabold text-white tracking-tight">
                  {userProfile?.displayName || 'Student'}
                </h2>
                {userProfile?.role === 'admin' ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <ShieldCheck className="w-3.5 h-3.5" /> ADMINISTRATOR
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    🎓 STUDENT USER
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-slate-400">@{userProfile?.username}</p>
              
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-semibold text-slate-500">
                <span>📚 Branch: {BRANCH_LABELS[userProfile?.branch || ''] || 'General'}</span>
                <span>🎓 Class: {YEAR_LABELS[userProfile?.year || ''] || 'N/A'}</span>
                {userProfile?.cgpa && <span>📐 CGPA: {userProfile.cgpa}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 z-10 relative self-start lg:self-auto">
            <Button
              onClick={() => setIsEditing(!isEditing)}
              variant="secondary"
              leftIcon={<Edit2 className="w-4 h-4" />}
            >
              {isEditing ? 'Cancel Edit' : 'Edit Profile & Avatar'}
            </Button>
          </div>
        </GlassPanel>

        {/* Live profile edit sheet with avatar builder */}
        {isEditing && (
          <GlassPanel glowBorder className="bg-slate-950/40 p-6 text-left w-full border border-white/[0.08] rounded-2xl">
            <form onSubmit={handleUpdateProfile} className="space-y-5">
              <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-400" /> Edit Profile Details
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Display Name"
                  placeholder="Your Full Name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  icon={<User className="w-4 h-4" />}
                  required
                />

                <Input
                  label="Mobile Number"
                  placeholder="e.g. +91 9876543210"
                  value={editMobile}
                  onChange={(e) => setEditMobile(e.target.value)}
                  required
                />

                <Input
                  label="Email (Optional)"
                  placeholder="you@college.edu"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">Branch</label>
                  <select
                    value={editBranch}
                    onChange={(e) => setEditBranch(e.target.value)}
                    className="w-full bg-slate-900 border border-white/[0.08] text-white rounded-xl py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold"
                  >
                    <option value="computers">💻 CSE</option>
                    <option value="electronics">🔌 ECE</option>
                    <option value="mechanical">⚙️ Mech & Civil</option>
                    <option value="maths">📐 Maths</option>
                    <option value="science">🔬 Basic Sciences</option>
                    <option value="management">📊 Humanities</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">Year</label>
                  <select
                    value={editYear}
                    onChange={(e) => setEditYear(e.target.value)}
                    className="w-full bg-slate-900 border border-white/[0.08] text-white rounded-xl py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold"
                  >
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </div>

                <Input
                  label="CGPA (Optional)"
                  placeholder="e.g. 9.5"
                  value={editCgpa}
                  onChange={(e) => setEditCgpa(e.target.value.replace(/[^0-9.]/g, ''))}
                />
              </div>

              {/* LIVE AVATAR BUILDER */}
              <div className="border border-white/[0.06] rounded-xl p-4 bg-slate-950/20">
                <span className="block text-xs font-bold text-slate-200 mb-3 uppercase tracking-wider">Update Cartoon Avatar Theme</span>
                <div className="flex flex-col md:flex-row items-center gap-6">
                  {renderAvatar(`${selectedEmoji}|${selectedGradient}`, "w-20 h-20 text-4xl")}
                  
                  <div className="flex-1 w-full space-y-3">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 mb-1">Pick Avatar Emoji</span>
                      <div className="flex flex-wrap gap-1">
                        {EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setSelectedEmoji(emoji)}
                            className={`w-7 h-7 flex items-center justify-center rounded-lg text-base transition-transform active:scale-95 ${
                              selectedEmoji === emoji ? 'bg-indigo-600/30 border border-indigo-500 scale-105' : 'bg-slate-900 border border-white/[0.04]'
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 mb-1">Pick Gradient Style</span>
                      <div className="flex flex-wrap gap-1">
                        {GRADIENTS.map((grad) => (
                          <button
                            key={grad.name}
                            type="button"
                            onClick={() => setSelectedGradient(grad.class)}
                            title={grad.name}
                            className={`w-6 h-6 rounded-lg bg-gradient-to-tr ${grad.class} flex items-center justify-center border ${
                              selectedGradient === grad.class ? 'border-white scale-105' : 'border-transparent opacity-85'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSavingProfile}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  Save Profile Settings
                </Button>
              </div>
            </form>
          </GlassPanel>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Gamified Points XP Dashboard */}
          <GlassPanel className="p-6 bg-gradient-to-br from-indigo-900/10 via-slate-900/30 to-purple-900/10 border-indigo-500/10 text-left flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1.5 text-indigo-400">
                  <Award className="w-5 h-5" />
                  <span className="text-xs font-extrabold uppercase tracking-widest">XP Points Badge</span>
                </div>
                <Zap className="w-5 h-5 text-amber-400 animate-pulse" />
              </div>
              
              <div className="mt-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current Balance</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-300">
                    {userProfile?.points || 0}
                  </h3>
                  <span className="text-sm font-extrabold text-amber-400">XP</span>
                </div>
              </div>

              <div className="mt-4 p-3 bg-white/[0.02] border border-white/[0.04] rounded-2xl">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  <span>College Standing:</span>
                  <span className="text-white ml-auto">
                    {(userProfile?.points || 0) > 300 ? '⭐ Elite Scholar' : (userProfile?.points || 0) > 100 ? '📘 Active Member' : '🌱 New Contributor'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/[0.05]">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-white">Daily Check-In</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Claim +20 XP once every 24 hours</p>
                </div>
                {checkinCooldown ? (
                  <button
                    disabled
                    className="px-3.5 py-1.5 rounded-xl border border-white/[0.06] bg-slate-900 text-slate-500 font-extrabold text-xs"
                  >
                    Cooldown: {checkinCooldown}
                  </button>
                ) : (
                  <button
                    onClick={handleClaimDaily}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 font-extrabold text-xs transition-all cursor-pointer shadow-lg shadow-orange-500/20 active:scale-95"
                  >
                    Claim +20 XP
                  </button>
                )}
              </div>
            </div>
          </GlassPanel>

          {/* Gamified Mini Quests & Tasks Hub */}
          <GlassPanel className="p-6 bg-slate-900/25 border-white/[0.06] lg:col-span-2 text-left flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-indigo-400 mb-4">
                <Trophy className="w-5 h-5 text-indigo-400" />
                <span className="text-xs font-extrabold uppercase tracking-widest">Active Quests & Tasks</span>
              </div>

              <div className="space-y-3 mt-4">
                {quests.map((quest) => {
                  const claimed = questsClaimed[quest.id];
                  return (
                    <div 
                      key={quest.id} 
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                        claimed 
                          ? 'bg-slate-950/20 border-white/[0.03] opacity-60' 
                          : quest.isMet 
                            ? 'bg-emerald-500/[0.03] border-emerald-500/20 shadow-md' 
                            : 'bg-white/[0.01] border-white/[0.05]'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className={`text-xs font-bold ${claimed ? 'text-slate-500 line-through' : 'text-white'}`}>
                            {quest.title}
                          </h4>
                          <span className="text-[10px] font-extrabold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/15">
                            +{quest.reward} XP
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">{quest.description}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-slate-400">{quest.progressText}</span>
                        {claimed ? (
                          <div className="flex items-center gap-1 text-[10px] font-extrabold text-slate-400 bg-slate-900/40 border border-white/[0.06] px-2.5 py-1 rounded-xl">
                            <CheckCircle className="w-3.5 h-3.5 text-slate-400" /> Claimed
                          </div>
                        ) : quest.isMet ? (
                          <button
                            onClick={() => handleClaimQuest(quest.id, quest.reward)}
                            className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] transition-all cursor-pointer active:scale-95 shadow-md shadow-emerald-600/15"
                          >
                            Claim Reward
                          </button>
                        ) : (
                          <div className="text-[10px] font-extrabold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-xl border border-indigo-500/15">
                            In Progress
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </GlassPanel>
        </div>

        {/* Contributions and Bookmarks section */}
        <div className="flex items-center gap-3 border-b border-white/[0.05] pb-1 mt-4">
          <button
            onClick={() => setActiveTab('uploads')}
            className={`
              px-5 py-3 text-sm font-bold border-b-2 transition-all relative flex items-center gap-2
              ${activeTab === 'uploads' 
                ? 'border-indigo-500 text-white' 
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
                ? 'border-indigo-500 text-white' 
                : 'border-transparent text-slate-400 hover:text-slate-200'}
            `}
          >
            <Bookmark className="w-4 h-4" /> Bookmarks ({myBookmarks.length})
          </button>
        </div>

        {/* Tab content listings */}
        <div className="text-left">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} height={80} className="w-full rounded-2xl" />
              ))}
            </div>
          ) : activeTab === 'uploads' ? (
            myUploads.length > 0 ? (
              <div className="flex flex-col gap-4">
                {myUploads.map((note) => (
                  <GlassPanel 
                    key={note.id} 
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-white/[0.05] bg-[#121218]/30 hover:border-white/10"
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/10 mt-1 flex-shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 text-left">
                        <h4 className="font-bold text-white leading-snug truncate">
                          {note.subject}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 text-[11px] mt-1.5 font-medium">
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
                          className="p-2 rounded-lg border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer active:scale-95"
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
              <GlassPanel className="h-64 flex flex-col items-center justify-center text-center gap-4 bg-[#121218]/15">
                <div className="w-12 h-12 rounded-full bg-slate-950 border border-white/5 flex items-center justify-center text-slate-500">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-white">No contributions yet</h4>
                  <p className="text-xs text-slate-500 max-w-xs mt-1">
                    You haven't uploaded any study notes yet. Click the contribution link in navigation to share!
                  </p>
                </div>
              </GlassPanel>
            )
          ) : (
            myBookmarks.length > 0 ? (
              <div className="flex flex-col gap-4">
                {myBookmarks.map((note) => (
                  <GlassPanel 
                    key={note.id} 
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-white/[0.05] bg-[#121218]/30 hover:border-white/10"
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/10 mt-1 flex-shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 text-left">
                        <h4 className="font-bold text-white leading-snug truncate">
                          {note.subject}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 text-[11px] mt-1.5 font-medium">
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
                        className="p-2 rounded-lg border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer active:scale-95"
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
              <GlassPanel className="h-64 flex flex-col items-center justify-center text-center gap-4 bg-[#121218]/15">
                <div className="w-12 h-12 rounded-full bg-slate-950 border border-white/5 flex items-center justify-center text-slate-500">
                  <Bookmark className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-white">No bookmarks saved</h4>
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
