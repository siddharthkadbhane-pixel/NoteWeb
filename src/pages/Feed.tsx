import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Search, 
  ThumbsUp, 
  Bookmark, 
  FileText, 
  Filter, 
  Download,
  Calendar,
  User,
  GraduationCap,
  Lock,
  Trash2,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { GlassPanel } from '../components/ui/GlassPanel';
import { Skeleton } from '../components/ui/Skeleton';
import { motion, AnimatePresence } from 'framer-motion';
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
  fileSize: number;
  uploadedBy: string;
  uploaderName: string;
  uploaderEmail: string;
  createdAt: any;
  status: 'pending' | 'approved' | 'rejected';
  likes: string[];
  likesCount: number;
  bookmarksCount: number;
  summary?: string;
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
    uploaderEmail: n.uploader_email || n.uploaderEmail || '',
    createdAt: n.created_at || n.createdAt || new Date().toISOString(),
    status: n.status || 'pending',
    likes: n.likes || [],
    likesCount: n.likes_count !== undefined ? n.likes_count : (n.likesCount || 0),
    bookmarksCount: n.bookmarks_count !== undefined ? n.bookmarks_count : (n.bookmarksCount || 0),
    summary: n.summary || undefined
  };
};

export const Feed: React.FC = () => {
  const { user, userProfile, toggleBookmark, isGuest } = useAuth();
  const { success, error, info } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const showPaywall = isGuest || !user;

  const [notes, setNotes] = useState<NoteDocument[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<NoteDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Track optimistically-injected note IDs so we can merge them properly on real fetch
  const optimisticIdsRef = useRef<Set<string>>(new Set());

  // Always-fresh ref to user so stale closures (polling interval, realtime handlers) can read it
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSemester, setSelectedSemester] = useState<string>('all');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');
  const [realtimeSynced, setRealtimeSynced] = useState(false);

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; branchId: string; name: string; description?: string }[]>([]);

  useEffect(() => {
    if (location.state?.branch) {
      setSelectedBranch(location.state.branch);
    }
    if (location.state?.category) {
      setSelectedCategory(location.state.category);
    }

    // OPTIMISTIC UI: If Upload.tsx passed a freshly-uploaded note via router state,
    // inject it INSTANTLY into the list — before the DB fetch even starts.
    // This gives 0ms latency visibility of the uploaded file.
    if (location.state?.newNote) {
      const optimisticNote = mapDbNoteToNoteDocument(location.state.newNote);
      optimisticIdsRef.current.add(optimisticNote.id);
      setNotes((prev) => {
        if (prev.some((n) => n.id === optimisticNote.id)) return prev;
        return [optimisticNote, ...prev];
      });
      // Clear the router state so back/forward nav doesn't re-inject
      window.history.replaceState({ ...window.history.state, usr: { ...location.state, newNote: null } }, '');
    }
  }, [location.state]);

  // Fetch branches and categories dynamically
  useEffect(() => {
    const fetchFiltersData = async () => {
      try {
        const { data: branchesData } = await supabase.from('branches').select('*');
        const { data: categoriesData } = await supabase.from('categories').select('*');

        let branchesList = (branchesData || []).map((b: any) => ({
          id: b.id,
          name: b.name
        }));

        let categoriesList = (categoriesData || []).map((c: any) => ({
          id: c.id,
          branchId: c.branch_id || c.branchId,
          name: c.name,
          description: c.description
        }));

        if (branchesList.length === 0) {
          branchesList = [
            { id: 'computers', name: 'Computer Science' },
            { id: 'maths', name: 'Mathematics' },
            { id: 'science', name: 'Basic Science & Eng' },
            { id: 'electronics', name: 'Electronics & Comm' },
            { id: 'mechanical', name: 'Mechanical & Civil' },
            { id: 'management', name: 'Management & Humanities' }
          ];
        }

        if (categoriesList.length === 0) {
          categoriesList = [
            { id: 'computers-dsa', branchId: 'computers', name: 'Data Structures & Algorithms' },
            { id: 'computers-dbms', branchId: 'computers', name: 'Database Management Systems' },
            { id: 'computers-os', branchId: 'computers', name: 'Operating Systems' },
            { id: 'computers-webdev', branchId: 'computers', name: 'Web Development' }
          ];
        }

        setBranches(branchesList);
        setCategories(categoriesList);
      } catch (e) {
        console.error("Error loading filters in Feed:", e);
      }
    };
    fetchFiltersData();
  }, []);

  const handleBranchChange = (branchId: string) => {
    setSelectedBranch(branchId);
    setSelectedCategory('all');
  };

  // Diagnostics

  // Diagnostic: tracks last fetch error for display in empty state
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch all notes — always reads fresh user from userRef to avoid stale closures
  const fetchNotes = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    const currentUser = userRef.current;
    try {
      let fetched: NoteDocument[] = [];

      // Query 1: Fetch ALL approved notes using select('*') to avoid column-name mismatches
      const { data: approvedData, error: approvedErr } = await supabase
        .from('notes')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (approvedErr) {
        // Fallback: try ordering by createdAt (camelCase schema)
        console.warn('[NoteWeb Feed] snake_case query failed:', approvedErr.message, '— retrying without order...');
        const { data: fallbackData, error: fallbackErr } = await supabase
          .from('notes')
          .select('*')
          .eq('status', 'approved');
        
        if (fallbackErr) {
          // Last resort: fetch ALL notes regardless of status
          console.warn('[NoteWeb Feed] status filter query failed:', fallbackErr.message, '— fetching all notes...');
          const { data: allData, error: allErr } = await supabase.from('notes').select('*');
          if (allErr) throw allErr;
          fetched = (allData || []).map(mapDbNoteToNoteDocument);
        } else {
          fetched = (fallbackData || []).map(mapDbNoteToNoteDocument);
        }
      } else {
        fetched = (approvedData || []).map(mapDbNoteToNoteDocument);
      }

      console.log(`[NoteWeb Feed] Fetched ${fetched.length} approved notes from DB`);

      // Query 2: If logged in, also fetch own notes so student sees their uploads immediately
      if (currentUser && currentUser.uid && currentUser.uid !== 'guest-user-noteweb') {
        try {
          const { data: ownData, error: ownErr } = await supabase
            .from('notes')
            .select('*')
            .eq('uploaded_by', currentUser.uid);
          
          if (ownErr) {
            // Try camelCase column fallback
            const { data: ownCamelData, error: ownCamelErr } = await supabase
              .from('notes')
              .select('*')
              .eq('uploadedBy', currentUser.uid);
            
            if (!ownCamelErr && ownCamelData) {
              const mappedOwn = ownCamelData.map(mapDbNoteToNoteDocument);
              for (const own of mappedOwn) {
                if (!fetched.some((n) => n.id === own.id)) fetched.push(own);
              }
              console.log(`[NoteWeb Feed] Fetched ${ownCamelData.length} own notes (camelCase fallback)`);
            } else {
              console.warn('[NoteWeb Feed] Own notes query failed (both snake + camel):', ownErr?.message);
            }
          } else if (ownData) {
            const mappedOwn = ownData.map(mapDbNoteToNoteDocument);
            for (const own of mappedOwn) {
              if (!fetched.some((n) => n.id === own.id)) fetched.push(own);
            }
            console.log(`[NoteWeb Feed] Fetched ${ownData.length} own notes for user ${currentUser.uid}`);
          }
        } catch (ownCatchErr: any) {
          console.warn('[NoteWeb Feed] Own notes fetch threw:', ownCatchErr?.message);
        }
      }

      // Get broadcasted notes from localStorage (RLS-blocked uploads)
      const storedNotesStr = localStorage.getItem('noteweb-broadcasted-notes');
      let storedNotes: any[] = [];
      if (storedNotesStr) {
        try { storedNotes = JSON.parse(storedNotesStr); } catch {}
      }
      
      // Auto-pruning self-healing cache: If we successfully fetched approved notes from the database,
      // any stored note in broadcast cache that has been approved but is no longer in the DB approved list
      // has been permanently deleted or unapproved by the admin. We should prune it to prevent old data from lingering.
      let finalStoredNotes = [...storedNotes];
      if (fetched.length > 0 && storedNotes.length > 0) {
        const activeApprovedIds = new Set(fetched.map((n) => n.id));
        finalStoredNotes = storedNotes.filter((sn: any) => {
          // If it was already approved but isn't in DB's approved list, it was deleted
          if (sn.status === 'approved') {
            return activeApprovedIds.has(sn.id);
          }
          return true; // Keep pending ones for local uploader preview
        });

        if (finalStoredNotes.length !== storedNotes.length) {
          localStorage.setItem('noteweb-broadcasted-notes', JSON.stringify(finalStoredNotes));
          console.log(`[NoteWeb Feed] Cleaned up ${storedNotes.length - finalStoredNotes.length} deleted/stale notes from local broadcast cache`);
        }
      }

      const merged = [...fetched];
      for (const sn of finalStoredNotes) {
        const mappedSn = mapDbNoteToNoteDocument(sn);
        if (!merged.some((n) => n.id === mappedSn.id)) {
          merged.push(mappedSn);
        }
      }

      if (finalStoredNotes.length > 0) {
        console.log(`[NoteWeb Feed] Merged ${finalStoredNotes.length} broadcasted notes from localStorage`);
      }

      console.log(`[NoteWeb Feed] Total after merge: ${merged.length} notes`);

      // Merge optimistic notes — keep any that haven't arrived from DB yet
      setNotes((prev) => {
        const prevOptimistic = prev.filter((n) => {
          if (!optimisticIdsRef.current.has(n.id)) return false;
          
          // Replace optimistic note once the real DB row arrives
          const isAlreadyInDb = merged.some((m) => {
            if (m.id === n.id) return true;
            const timeDiff = Math.abs(new Date(m.createdAt).getTime() - new Date(n.createdAt).getTime());
            return (
              m.subject.toLowerCase() === n.subject.toLowerCase() &&
              m.uploadedBy === n.uploadedBy &&
              timeDiff < 300000  // 5 minute window
            );
          });
          return !isAlreadyInDb;
        });

        const combined = [...prevOptimistic, ...merged];
        const seen = new Set<string>();
        const deduped = combined.filter((n) => {
          if (seen.has(n.id)) return false;
          seen.add(n.id);
          return true;
        });
        sortNotes(deduped, sortBy);
        return deduped;
      });

      setFetchError(null);
    } catch (e: any) {
      console.error('[NoteWeb Feed] fetchNotes threw:', e);
      setFetchError(e.message || 'Unknown fetch error');
      // Always show error — even on silent polls — so user can diagnose
      error('Could not load notes: ' + (e.message || 'Check console for details'));
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [sortBy]);



  useEffect(() => {
    fetchNotes();

    // 1. Set up Realtime subscription — uses SAME channel name as Upload.tsx broadcast
    let channel: any = null;
    try {
      if (typeof supabase.channel === 'function') {
        channel = supabase
          .channel('public:notes')  // MUST match the channel Upload.tsx broadcasts on
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notes' },
            (payload: any) => {
              console.log('[NoteWeb Realtime] New note inserted:', payload.new?.subject);
              setRealtimeSynced(true);
              fetchNotes(true);
              // Toast for new approved notes from other users — use ref to avoid stale closure
              if (payload.new && payload.new.uploaded_by !== userRef.current?.uid && payload.new.status === 'approved') {
                info(`📄 New note: "${payload.new.subject}" just appeared!`);
              }
            }
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'notes' },
            (payload: any) => {
              console.log('[NoteWeb Realtime] Note updated:', payload.new?.id);
              setRealtimeSynced(true);
              fetchNotes(true);
            }
          )
          .on(
            'postgres_changes',
            { event: 'DELETE', schema: 'public', table: 'notes' },
            (payload: any) => {
              console.log('[NoteWeb Realtime] Note deleted:', payload.old?.id);
              setRealtimeSynced(true);
              if (payload.old?.id) {
                setNotes(prev => prev.filter(n => n.id !== payload.old.id));
                
                // Remove from local broadcast cache
                try {
                  const storedNotesStr = localStorage.getItem('noteweb-broadcasted-notes');
                  if (storedNotesStr) {
                    const storedNotes = JSON.parse(storedNotesStr);
                    if (Array.isArray(storedNotes)) {
                      const filtered = storedNotes.filter((n: any) => n.id !== payload.old.id);
                      localStorage.setItem('noteweb-broadcasted-notes', JSON.stringify(filtered));
                    }
                  }
                } catch (e) {
                  console.warn('[NoteWeb Realtime] Failed to remove deleted note from broadcast cache:', e);
                }
              }
            }
          )
          .on(
            'broadcast',
            { event: 'new-note' },
            (response: any) => {
              console.log('[NoteWeb Broadcast] New note broadcast received:', response);
              if (response?.payload) {
                const newNote = response.payload;
                
                // Save to localStorage for persistence across refreshes
                const storedNotesStr = localStorage.getItem('noteweb-broadcasted-notes');
                let storedNotes: any[] = [];
                if (storedNotesStr) {
                  try { storedNotes = JSON.parse(storedNotesStr); } catch {}
                }
                if (!storedNotes.some((n: any) => n.id === newNote.id)) {
                  storedNotes.push(newNote);
                  localStorage.setItem('noteweb-broadcasted-notes', JSON.stringify(storedNotes));
                }
                
                const mappedNote = mapDbNoteToNoteDocument(newNote);
                setNotes((prev) => {
                  if (prev.some((n) => n.id === mappedNote.id)) return prev;
                  const updated = [mappedNote, ...prev];
                  const sorted = [...updated];
                  sortNotes(sorted, sortBy);
                  return sorted;
                });
              }
            }
          )
          .subscribe((status: string) => {
            console.log('[NoteWeb Realtime] Feed channel status:', status);
            if (status === 'SUBSCRIBED') setRealtimeSynced(true);
          });
      }
    } catch (err) {
      console.warn("Realtime subscription failed on Feed:", err);
    }

    // 2. Listen for upload signal from Upload.tsx via localStorage — cross-tab sync
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'noteweb-last-upload') {
        console.log('[NoteWeb] Upload signal detected via localStorage, refetching...');
        fetchNotes(true);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // 3. Passive 5-second polling as bulletproof cross-device sync safety net
    const interval = setInterval(() => {
      fetchNotes(true);
    }, 5000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      if (channel) {
        try { channel.unsubscribe(); } catch (e) {
          console.warn("Failed to unsubscribe notes channel:", e);
        }
      }
    };
  }, [fetchNotes]);  // Re-run when fetchNotes is recreated (also triggers on user login since userRef updates)

  // Handle Sort triggers
  const sortNotes = (items: NoteDocument[], criteria: 'recent' | 'popular') => {
    if (criteria === 'recent') {
      items.sort((a, b) => {
        const getSafeTime = (val: any) => {
          if (!val) return 0;
          const t = new Date(val).getTime();
          return isNaN(t) ? 0 : t;
        };
        const timeA = getSafeTime(a.createdAt);
        const timeB = getSafeTime(b.createdAt);
        return timeB - timeA;
      });
    } else {
      items.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    }
  };

  useEffect(() => {
    const sorted = [...notes];
    sortNotes(sorted, sortBy);
    setNotes(sorted);
  }, [sortBy]);

  // Main filter cascades
  useEffect(() => {
    let result = [...notes];

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (n) =>
          n.subject.toLowerCase().includes(q) ||
          n.teacher.toLowerCase().includes(q) ||
          n.description.toLowerCase().includes(q)
      );
    }

    // Semester
    if (selectedSemester !== 'all') {
      result = result.filter((n) => n.semester === selectedSemester);
    }

    // Branch Filter
    if (selectedBranch !== 'all') {
      const bId = selectedBranch.toLowerCase();
      result = result.filter((n: any) => {
        // Direct branch match
        if (n.branch && n.branch.toLowerCase() === bId) {
          return true;
        }
        // Legacy compatibility: check if category contains branch keyword or if notes category attribute matches the branch ID
        if (n.category && n.category.toLowerCase().startsWith(bId)) {
          return true;
        }
        const sub = n.subject.toLowerCase();
        const desc = (n.description || '').toLowerCase();
        const textToSearch = `${sub} ${desc}`;
        
        if (bId === 'computers') return textToSearch.includes('computer') || textToSearch.includes('data') || textToSearch.includes('algo') || textToSearch.includes('software') || textToSearch.includes('web') || textToSearch.includes('programming') || textToSearch.includes('code') || textToSearch.includes('javascript') || textToSearch.includes('python');
        if (bId === 'maths') return textToSearch.includes('math') || textToSearch.includes('calculus') || textToSearch.includes('algebra') || textToSearch.includes('discrete') || textToSearch.includes('geometry') || textToSearch.includes('matrix');
        if (bId === 'science') return textToSearch.includes('physics') || textToSearch.includes('chemistry') || textToSearch.includes('biology') || textToSearch.includes('science') || textToSearch.includes('space') || textToSearch.includes('lab');
        if (bId === 'electronics') return textToSearch.includes('circuit') || textToSearch.includes('semiconductor') || textToSearch.includes('diode') || textToSearch.includes('electronics') || textToSearch.includes('arduino') || textToSearch.includes('voltage');
        if (bId === 'mechanical') return textToSearch.includes('mechanical') || textToSearch.includes('machine') || textToSearch.includes('gear') || textToSearch.includes('cad') || textToSearch.includes('thermodynamics') || textToSearch.includes('engine');
        if (bId === 'management') return textToSearch.includes('management') || textToSearch.includes('business') || textToSearch.includes('marketing') || textToSearch.includes('finance') || textToSearch.includes('strategy') || textToSearch.includes('economics');
        
        return false;
      });
    }

    // Subject Category Filter
    if (selectedCategory !== 'all') {
      const cat = selectedCategory.toLowerCase();
      result = result.filter((n: any) => {
        // Direct category attribute match
        if (n.category && n.category.toLowerCase() === cat) {
          return true;
        }
        
        // Fallback for legacy note documents
        const sub = n.subject.toLowerCase();
        const desc = (n.description || '').toLowerCase();
        const textToSearch = `${sub} ${desc}`;
        
        // Dynamic match using the category label as keyword
        const matchedCat = categories.find(c => c.id === cat);
        if (matchedCat) {
          const labelWords = matchedCat.name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          if (labelWords.length > 0) {
            return labelWords.some(word => textToSearch.includes(word));
          }
        }

        return false;
      });
    }

    setFilteredNotes(result);
  }, [notes, searchQuery, selectedSemester, selectedBranch, selectedCategory, categories]);

  // Like Toggle Handler
  const handleLikeToggle = async (noteId: string, currentLikes: string[]) => {
    if (!user) {
      info("Please sign in to like notes!");
      return;
    }

    const hasLiked = currentLikes.includes(user.uid);
    const nextLikes = hasLiked
      ? currentLikes.filter((uid) => uid !== user.uid)
      : [...currentLikes, user.uid];
    const nextLikesCount = nextLikes.length;

    try {
      const { error: err } = await supabase
        .from('notes')
        .update({
          likes: nextLikes,
          likes_count: nextLikesCount
        })
        .eq('id', noteId);

      if (err) throw err;

      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId
            ? {
                ...n,
                likes: nextLikes,
                likesCount: nextLikesCount
              }
            : n
        )
      );
    } catch (e) {
      console.error(e);
      error("Failed to update like status");
    }
  };

  // Global bookmark syncer toggle wrapper
  const handleBookmarkToggle = async (noteId: string) => {
    if (!user) {
      info("Please sign in to bookmark notes!");
      return;
    }
    try {
      await toggleBookmark(noteId);
      success(userProfile?.bookmarks.includes(noteId) ? 'Bookmark removed' : 'Bookmark added');
    } catch (e) {
      error("Bookmark syncer failed");
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this note?")) return;
    try {
      const { error: err } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId);

      if (err) throw err;

      // Remove from local broadcast cache
      try {
        const storedNotesStr = localStorage.getItem('noteweb-broadcasted-notes');
        if (storedNotesStr) {
          const storedNotes = JSON.parse(storedNotesStr);
          if (Array.isArray(storedNotes)) {
            const filtered = storedNotes.filter((n: any) => n.id !== noteId);
            localStorage.setItem('noteweb-broadcasted-notes', JSON.stringify(filtered));
          }
        }
      } catch (cacheErr) {
        console.warn("Failed to clear note from local broadcast cache:", cacheErr);
      }

      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      success("Note deleted successfully!");
    } catch (e: any) {
      console.error(e);
      error("Failed to delete note: " + e.message);
    }
  };

  const getFormatDate = (timestamp: any) => {
    if (!timestamp) return 'Recent';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="min-h-screen w-full py-12 px-4 md:px-8 relative overflow-hidden">
      {/* Background glowing accents */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 glow-indigo rounded-full pointer-events-none blur-3xl" />
      <div className="absolute bottom-1/4 left-1/4 w-96 h-96 glow-purple rounded-full pointer-events-none blur-3xl" />

      <div className="max-w-7xl mx-auto z-10 relative flex flex-col gap-8">
        
        {/* Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.05] pb-6">
          <div className="text-left">
            <h1 className="text-4xl font-extrabold tracking-tight text-white light-mode:text-slate-900">
              Browse Notes Feed
            </h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <p className="text-slate-400 light-mode:text-slate-500 font-medium text-sm">
                Explore college lecture summaries, formulas, and resources shared by peers.
              </p>
              {/* Live Sync Indicator */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold flex-shrink-0 ${
                realtimeSynced
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-slate-500/10 border-white/10 text-slate-500'
              }`}>
                {realtimeSynced ? (
                  <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" /><Wifi className="w-3 h-3" /> Live</>
                ) : (
                  <><WifiOff className="w-3 h-3" /> Syncing...</>
                )}
              </div>
            </div>
          </div>
          
          {/* Sorting controls */}
          <div className="flex items-center gap-2 self-start md:self-auto glass-panel p-1.5 rounded-xl border border-white/[0.08]">
            <button
              onClick={() => setSortBy('recent')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${sortBy === 'recent' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Recent Uploads
            </button>
            <button
              onClick={() => setSortBy('popular')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${sortBy === 'popular' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Most Liked
            </button>
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Left Column Filters Sidebar */}
          <div className="lg:col-span-1 flex flex-col gap-6 text-left">
            <GlassPanel className="p-5 flex flex-col gap-6 bg-[#16161D]/30 light-mode:bg-white/70">
              <div className="flex items-center justify-between border-b border-white/[0.05] pb-3">
                <h3 className="font-bold text-slate-200 light-mode:text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wider">
                  <Filter className="w-4 h-4 text-indigo-400" /> Filters
                </h3>
              </div>

              {/* Search input */}
              <Input
                label="Search"
                placeholder="Subject or Teacher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={<Search className="w-4 h-4" />}
              />

              {/* Branch Filter */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 pl-1">
                  Curriculum Branch
                </span>
                <select
                  value={selectedBranch}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  className="w-full py-2.5 px-3.5 glass-input text-xs bg-[#16161D]/50 text-slate-200 light-mode:bg-white light-mode:text-slate-800 rounded-xl border border-white/[0.08] font-semibold"
                >
                  <option value="all" className="bg-slate-950 text-slate-200">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id} className="bg-slate-950 text-slate-200">
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category list */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 pl-1">
                  Subject Category
                </span>
                <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1 select-none scrollbar-thin">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`
                      w-full text-left px-3.5 py-2.5 text-xs font-semibold rounded-xl border transition-all duration-200 flex-shrink-0
                      ${selectedCategory === 'all' 
                        ? 'bg-indigo-600/15 border-indigo-500/40 text-indigo-400' 
                        : 'border-white/[0.05] bg-white/[0.01] text-slate-400 hover:border-white/10 hover:text-slate-200 light-mode:border-slate-900/10 light-mode:hover:bg-slate-900/[0.02]'}
                    `}
                  >
                    All Subjects
                  </button>
                  {categories
                    .filter((c) => selectedBranch === 'all' || c.branchId === selectedBranch)
                    .map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`
                          w-full text-left px-3.5 py-2.5 text-xs font-semibold rounded-xl border transition-all duration-200 flex-shrink-0
                          ${selectedCategory === cat.id 
                            ? 'bg-indigo-600/15 border-indigo-500/40 text-indigo-400' 
                            : 'border-white/[0.05] bg-white/[0.01] text-slate-400 hover:border-white/10 hover:text-slate-200 light-mode:border-slate-900/10 light-mode:hover:bg-slate-900/[0.02]'}
                        `}
                      >
                        {cat.name}
                      </button>
                    ))}
                </div>
              </div>

              {/* Semester Filter */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 pl-1">
                  Semester
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    onClick={() => setSelectedSemester('all')}
                    className={`
                      col-span-4 text-center py-2 text-xs font-semibold rounded-xl border transition-all duration-200
                      ${selectedSemester === 'all' 
                        ? 'bg-indigo-600/15 border-indigo-500/40 text-indigo-400' 
                        : 'border-white/[0.05] bg-white/[0.01] text-slate-400 hover:border-white/10 hover:text-slate-200 light-mode:border-slate-900/10 light-mode:hover:bg-slate-900/[0.02]'}
                    `}
                  >
                    All Semesters
                  </button>
                  {['1', '2', '3', '4', '5', '6', '7', '8'].map((sem) => (
                    <button
                      key={sem}
                      onClick={() => setSelectedSemester(sem)}
                      className={`
                        text-center py-2 text-xs font-bold rounded-xl border transition-all duration-200
                        ${selectedSemester === sem 
                          ? 'bg-indigo-600/15 border-indigo-500/40 text-indigo-400' 
                          : 'border-white/[0.05] bg-white/[0.01] text-slate-400 hover:border-white/10 hover:text-slate-200 light-mode:border-slate-900/10 light-mode:hover:bg-slate-900/[0.02]'}
                      `}
                    >
                      S{sem}
                    </button>
                  ))}
                </div>
              </div>
            </GlassPanel>
          </div>

          {/* Right Column Notes Grid */}
          <div className="lg:col-span-3 flex flex-col gap-6 relative min-h-[450px]">
            <div className={`flex flex-col gap-6 w-full h-full ${showPaywall ? 'blur-[12px] pointer-events-none select-none' : ''}`}>
              {isLoading ? (
                // Loader Cards
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[1, 2, 3, 4].map((i) => (
                    <GlassPanel key={i} className="h-60 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Skeleton variant="circle" width={32} height={32} />
                          <Skeleton variant="rect" width={60} height={18} />
                        </div>
                        <Skeleton variant="text" />
                        <Skeleton variant="text" width="60%" />
                      </div>
                      <div className="flex gap-2">
                        <Skeleton variant="rect" className="flex-1" height={36} />
                        <Skeleton variant="rect" className="flex-1" height={36} />
                      </div>
                    </GlassPanel>
                  ))}
                </div>
              ) : filteredNotes.length > 0 ? (
                <motion.div 
                  layout
                  className="grid grid-cols-1 md:grid-cols-2 gap-6"
                >
                  <AnimatePresence>
                    {filteredNotes.map((note) => {
                      const isLiked = user ? note.likes.includes(user.uid) : false;
                      const isBookmarked = userProfile?.bookmarks.includes(note.id) || false;

                      return (
                        <motion.div
                          key={note.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.3 }}
                          className="glass-card premium-border-glow hover:scale-[1.01] hover:shadow-xl duration-300 flex flex-col justify-between text-left h-[260px] p-5 group relative"
                        >
                          {/* Shimmer hovering glow border effect */}
                          <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />                           {/* Top row */}
                          <div className="space-y-3 z-10 relative">
                            <div className="flex items-start justify-between gap-3">
                              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/10 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                                <FileText className="w-5 h-5" />
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                  Sem {note.semester}
                                </span>
                                {note.status === 'pending' && (
                                  <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.2)] animate-pulse">
                                    Under Review
                                  </span>
                                )}
                                {note.status === 'rejected' && (
                                  <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-[0_0_8px_rgba(244,63,94,0.2)]">
                                    Rejected
                                  </span>
                                )}

                              </div>
                            </div>

                            <div>
                              <h3 className="font-extrabold text-base text-white group-hover:text-indigo-400 transition-colors duration-300 truncate light-mode:text-slate-900">
                                {note.subject}
                              </h3>
                              <div className="flex items-center gap-1 text-[11px] text-slate-500 font-semibold mt-1">
                                <GraduationCap className="w-3.5 h-3.5" /> Prof. {note.teacher}
                              </div>
                              <p className="text-xs text-slate-400 light-mode:text-slate-500 leading-relaxed line-clamp-2 mt-2">
                                {note.description}
                              </p>
                            </div>
                          </div>

                          {/* Middle metadata details */}
                          <div className="flex items-center justify-between border-t border-white/[0.04] pt-3 text-[10px] font-medium text-slate-500 z-10 relative mt-4">
                            <span 
                              onClick={() => note.uploadedBy && navigate(`/profile/${note.uploadedBy}`)}
                              className="flex items-center gap-1 truncate max-w-[130px] hover:text-indigo-400 cursor-pointer transition-colors duration-200"
                            >
                              <User className="w-3 h-3 flex-shrink-0 text-indigo-500" /> {note.uploaderName}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 flex-shrink-0" /> {getFormatDate(note.createdAt)}
                            </span>
                          </div>

                          {/* Bottom Actions Row */}
                          <div className="flex items-center justify-between gap-3 border-t border-white/[0.04] pt-3 z-10 relative">
                            <div className="flex items-center gap-1">
                              {/* Like toggle */}
                              <button
                                onClick={() => handleLikeToggle(note.id, note.likes)}
                                className={`
                                  p-2 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all active:scale-90
                                  ${isLiked 
                                    ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 shadow-md shadow-indigo-600/10' 
                                    : 'text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10'}
                                `}
                                title="Like Note"
                              >
                                <ThumbsUp className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                                <span>{note.likesCount || 0}</span>
                              </button>

                              {/* Bookmark toggle */}
                              <button
                                onClick={() => handleBookmarkToggle(note.id)}
                                className={`
                                  p-2 rounded-lg flex items-center text-xs font-bold transition-all active:scale-90
                                  ${isBookmarked 
                                    ? 'bg-purple-600/20 border border-purple-500/30 text-purple-400 shadow-md shadow-purple-600/10' 
                                    : 'text-slate-400 hover:text-purple-400 hover:bg-purple-500/10'}
                                `}
                                title="Bookmark Note"
                              >
                                <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* View PDF download */}
                              <button
                                onClick={() => openPdfDocument(note.pdfUrl || 'db-base64-fetch', note.pdfPath || '', note.id)}
                                className="inline-flex items-center justify-center p-2 rounded-lg border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/5 light-mode:border-slate-900/10 light-mode:text-slate-600 light-mode:hover:text-slate-900 transition-all duration-200 cursor-pointer active:scale-95"
                                title="Open PDF Document"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete note button */}
                              {user && userProfile && (note.uploadedBy === user.uid || userProfile.role === 'admin') && (
                                <button
                                  onClick={() => handleDeleteNote(note.id)}
                                  className="inline-flex items-center justify-center p-2 rounded-lg border border-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all duration-200 cursor-pointer active:scale-95"
                                  title="Delete Note"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </motion.div>
              ) : (
                // Empty state with Refresh button and diagnostics
                <GlassPanel className="h-auto min-h-64 flex flex-col items-center justify-center gap-4 text-center bg-[#16161D]/20 p-8">
                  <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center border border-white/5 text-slate-500">
                    <Search className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white light-mode:text-slate-800">
                      {fetchError ? '⚠️ Could not load notes' : 'No notes found'}
                    </h3>
                    {fetchError ? (
                      <p className="text-xs text-rose-400 max-w-sm mt-1 mx-auto leading-relaxed font-mono break-all">
                        {fetchError}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 max-w-sm mt-1 mx-auto leading-relaxed">
                        {notes.length > 0
                          ? "Notes exist but are hidden by filters. Try clearing them."
                          : "No approved notes in the library yet. Upload your own to start!"}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Button
                      onClick={() => fetchNotes(false)}
                      variant="primary"
                      size="sm"
                    >
                      🔄 Refresh Notes
                    </Button>
                    <Button
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedSemester('all');
                        setSelectedBranch('all');
                        setSelectedCategory('all');
                      }}
                      variant="secondary"
                      size="sm"
                    >
                      Clear Filters
                    </Button>
                  </div>
                  {notes.length > 0 && filteredNotes.length === 0 && (
                    <p className="text-[11px] text-slate-600 mt-1">
                      {notes.length} note{notes.length !== 1 ? 's' : ''} loaded but hidden by current filters
                    </p>
                  )}
                </GlassPanel>
              )}
            </div>

            {showPaywall && (
              <div className="absolute inset-0 flex items-center justify-center p-6 z-20 bg-[#0A0A0C]/40 light-mode:bg-white/40 backdrop-blur-[1px] rounded-3xl">
                <GlassPanel glowBorder className="max-w-md p-8 text-center bg-[#111116]/90 border border-indigo-500/20 shadow-2xl relative light-mode:bg-white/95">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-xl shadow-purple-600/30 mx-auto mb-6 animate-bounce">
                    <Lock className="w-7 h-7 text-white" />
                  </div>
                  
                  <h3 className="text-2xl font-extrabold text-white light-mode:text-slate-900 tracking-tight">Unlock NoteWeb Library</h3>
                  <p className="text-xs text-slate-400 light-mode:text-slate-500 font-semibold leading-relaxed mt-3 mb-6">
                    Guests can view subject categories, but reading AI summaries, viewing PDF documents, bookmarking, and downloading study notes requires a student account. Register or sign in today!
                  </p>

                  <div className="flex flex-col gap-3">
                    <Link to="/register" className="w-full">
                      <Button variant="primary" className="w-full py-3">
                        Create Free Student Account
                      </Button>
                    </Link>
                    <Link to="/login" className="w-full">
                      <Button variant="secondary" className="w-full py-3">
                        Sign In to Your Account
                      </Button>
                    </Link>
                    <Link to="/" className="w-full mt-2">
                      <button className="text-xs font-extrabold text-slate-400 hover:text-white light-mode:text-slate-600 light-mode:hover:text-slate-900 transition-colors">
                        Go Back to Home
                      </button>
                    </Link>
                  </div>
                </GlassPanel>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};
export default Feed;
