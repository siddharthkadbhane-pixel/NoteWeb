import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  ExternalLink,
  Calendar,
  User,
  GraduationCap,
  Lock,
  Trash2,
  Wifi,
  WifiOff,
  Sparkles,
  HelpCircle,
  Send,
  Check,
  X,
  BookOpen,
  MessageSquare,
  Award,
  RefreshCw,
  Volume2,
  Play,
  Pause,
  Square
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { GlassPanel } from '../components/ui/GlassPanel';
import { Skeleton } from '../components/ui/Skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { TiltCard } from '../components/ui/TiltCard';
import { SparkleBurst } from '../components/ui/SparkleBurst';
import { openPdfDocument } from '../utils/pdfDb';
import { incrementQuestProgress } from '../utils/quests';
import {
  generateFlashcards,
  generateQuiz,
  askGeminiQna
} from '../services/gemini';
import type { Flashcard, QuizQuestion } from '../services/gemini';

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
  let branch = n.branch || '';
  let category = n.category || '';

  // Self-heal subjects on the fly
  const text = `${n.subject || ''} ${n.description || ''} ${n.file_name || n.fileName || ''}`.toLowerCase();
  const words = text.split(/[^a-z0-9]+/);

  if (text.includes('discrete math') || text.includes('discrete mathematics') || words.includes('dm')) {
    branch = 'cse';
    category = 'cse-discrete';
  } else if (text.includes('internet of things') || words.includes('iot')) {
    if (text.includes('ece') || text.includes('electronics') || branch === 'ece') {
      branch = 'ece';
      category = 'ece-iot';
    } else {
      branch = 'cse';
      category = 'cse-iot';
    }
  } else if (text.includes('data structures') || words.includes('dsa') || text.includes('binary tree')) {
    branch = 'cse';
    category = 'cse-dsa';
  } else if (text.includes('linear algebra') || text.includes('calculus') || text.includes('engineering mathematics') || (text.includes('math') && !words.includes('discrete'))) {
    branch = 'cse';
    category = 'cse-engmath';
  }

  return {
    id: n.id,
    subject: n.subject || '',
    branch: branch,
    category: category,
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

  // Ref to track active realtime note channel for broadcasting events (like note toggles)
  const channelRef = useRef<any>(null);

  // Ref to track if we have a fresh optimistic note to bypass loading skeleton
  const hasOptimisticRef = useRef(!!location.state?.newNote);
  useEffect(() => {
    if (location.state?.newNote) {
      hasOptimisticRef.current = true;
    }
  }, [location.state]);

  // Always-fresh ref to user so stale closures (polling interval, realtime handlers) can read it
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // Search & Filter state
  const [feedType, setFeedType] = useState<'notes' | 'papers'>('notes');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSemester, setSelectedSemester] = useState<string>('all');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');
  const [realtimeSynced, setRealtimeSynced] = useState(false);

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; branchId: string; name: string; description?: string }[]>([]);

  useEffect(() => {
    const targetBranch = location.state?.branch || location.state?.branchFilter;
    if (targetBranch) {
      setSelectedBranch(targetBranch);
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

        const blacklistIds = ['bse', 'cs', 'mgt', 'm', 'math', 'mathematics', 'basic-science', 'computer-science'];
        const blacklistNames = [
          'basic science & eng',
          'basic science',
          'basic sciences',
          'computer science',
          'mathematics',
          'management & humanities'
        ];

        const defaultBranchesList = [
          { id: 'cse', name: 'Computer Science & Engineering' },
          { id: 'aiml', name: 'AI & Machine Learning' },
          { id: 'ds', name: 'Data Science' },
          { id: 'mechanical', name: 'Mechanical Engineering' },
          { id: 'civil', name: 'Civil Engineering' },
          { id: 'ece', name: 'Electronics & Comm Eng' }
        ];

        let branchesList = (branchesData || []).map((b: any) => ({
          id: b.id,
          name: b.name
        }));

        // Merge standard default branches
        for (const db of defaultBranchesList) {
          if (!branchesList.some((b: any) => b.id === db.id)) {
            branchesList.push(db);
          }
        }

        // Filter blacklists
        branchesList = branchesList.filter((b: any) => {
          if (blacklistIds.includes(b.id)) return false;
          if (blacklistNames.includes(b.name.trim().toLowerCase())) return false;
          return true;
        });

        // Deduplicate by name case-insensitive
        const seenNames = new Set<string>();
        branchesList = branchesList.filter((b: any) => {
          const normName = b.name.trim().toLowerCase();
          if (normName.includes('electronics') || normName.includes('comm')) {
            if (b.id !== 'ece' && branchesList.some((o: any) => o.id === 'ece')) {
              return false;
            }
          }
          if (seenNames.has(normName)) {
            return false;
          }
          seenNames.add(normName);
          return true;
        });

        const activeBranchIds = new Set(branchesList.map((b: any) => b.id));

        const defaultCategoriesList = [
          // CSE
          { id: 'cse-dsa', branchId: 'cse', name: 'Data Structures & Algorithms' },
          { id: 'cse-dbms', branchId: 'cse', name: 'Database Management Systems' },
          { id: 'cse-os', branchId: 'cse', name: 'Operating Systems' },
          { id: 'cse-webdev', branchId: 'cse', name: 'Web Development' },
          { id: 'cse-discrete', branchId: 'cse', name: 'Discrete Mathematics' },
          { id: 'cse-engmath', branchId: 'cse', name: 'Engineering Mathematics' },
          { id: 'cse-engphysics', branchId: 'cse', name: 'Engineering Physics' },
          { id: 'cse-engchemistry', branchId: 'cse', name: 'Engineering Chemistry' },
          { id: 'cse-basics', branchId: 'cse', name: 'Basic Electrical & Electronics' },
          { id: 'cse-pps', branchId: 'cse', name: 'Programming for Problem Solving' },
          { id: 'cse-english', branchId: 'cse', name: 'Technical English' },
          { id: 'cse-oop', branchId: 'cse', name: 'Object-Oriented Programming' },
          { id: 'cse-coa', branchId: 'cse', name: 'Computer Organization & Architecture' },
          { id: 'cse-networks', branchId: 'cse', name: 'Computer Networks' },
          { id: 'cse-software', branchId: 'cse', name: 'Software Engineering' },
          { id: 'cse-compiler', branchId: 'cse', name: 'Compiler Design' },
          { id: 'cse-automata', branchId: 'cse', name: 'Formal Languages & Automata Theory' },
          { id: 'cse-cloud', branchId: 'cse', name: 'Cloud Computing & Cyber Security' },
          { id: 'cse-distributed', branchId: 'cse', name: 'Distributed Systems' },
          { id: 'cse-iot', branchId: 'cse', name: 'Internet of Things (IoT)' },
          { id: 'cse-entrepreneurship', branchId: 'cse', name: 'Entrepreneurship' },
          { id: 'cse-project', branchId: 'cse', name: 'Capstone Project' },

          // AI/ML
          { id: 'aiml-ml', branchId: 'aiml', name: 'Artificial Intelligence & Machine Learning' },
          { id: 'aiml-dl', branchId: 'aiml', name: 'Deep Learning' },
          { id: 'aiml-nlp', branchId: 'aiml', name: 'Natural Language Processing' },

          // Data Science
          { id: 'ds-analytics', branchId: 'ds', name: 'Data Analytics' },
          { id: 'ds-stats', branchId: 'ds', name: 'Probability & Statistics' },
          { id: 'ds-bigdata', branchId: 'ds', name: 'Big Data Analytics' },

          // Mechanical
          { id: 'mechanical-thermo', branchId: 'mechanical', name: 'Thermodynamics' },
          { id: 'mechanical-fluid', branchId: 'mechanical', name: 'Fluid Mechanics' },
          { id: 'mechanical-cad', branchId: 'mechanical', name: 'CAD & Manufacturing' },

          // Civil
          { id: 'civil-structures', branchId: 'civil', name: 'Structural Analysis' },
          { id: 'civil-survey', branchId: 'civil', name: 'Surveying' },
          { id: 'civil-geotech', branchId: 'civil', name: 'Geotechnical Engineering' },

          // ECE
          { id: 'ece-microprocessors', branchId: 'ece', name: 'Microprocessors & Embedded Systems' },
          { id: 'ece-digital', branchId: 'ece', name: 'Digital Electronics' },
          { id: 'ece-signals', branchId: 'ece', name: 'Signals & Systems' },
          { id: 'ece-iot', branchId: 'ece', name: 'Internet of Things (IoT)' }
        ];

        let categoriesList = (categoriesData || []).map((c: any) => ({
          id: c.id,
          branchId: c.branch_id || c.branchId,
          name: c.name,
          description: c.description
        }));

        // Merge standard default categories
        for (const dc of defaultCategoriesList) {
          if (!categoriesList.some((c: any) => c.id === dc.id)) {
            categoriesList.push(dc);
          }
        }

        // Keep only categories belonging to active branches
        categoriesList = categoriesList.filter((c: any) => activeBranchIds.has(c.branchId));

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
    if (!silent && !hasOptimisticRef.current) setIsLoading(true);
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

      const merged = [...fetched];
      console.log(`[NoteWeb Feed] Total notes loaded from database: ${merged.length}`);

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

        // Inject local uploader likes persistence safety net
        try {
          const localLikesStr = localStorage.getItem('noteweb-local-likes');
          let localLikes: Record<string, boolean> = {};
          if (localLikesStr) {
            try { localLikes = JSON.parse(localLikesStr); } catch { }
          }
          const currentUserId = userRef.current?.uid;
          if (currentUserId) {
            deduped.forEach((n) => {
              if (localLikes[n.id] && !n.likes.includes(currentUserId)) {
                n.likes.push(currentUserId);
                n.likesCount += 1;
              }
            });
          }
        } catch (e) {
          console.warn("Failed to merge local uploader likes:", e);
        }

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
      hasOptimisticRef.current = false;
    }
  }, [sortBy]);



  useEffect(() => {
    fetchNotes();

    // 1. Set up Realtime subscription — uses SAME channel name as Upload.tsx broadcast
    let channel: any = null;
    try {
      if (typeof supabase.channel === 'function') {
        channel = supabase.channel('public:notes');  // MUST match the channel Upload.tsx broadcasts on
        channelRef.current = channel;
        channel
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
          .on(
            'broadcast',
            { event: 'like-note' },
            (response: any) => {
              console.log('[NoteWeb Broadcast] Like event received:', response);
              if (response?.payload) {
                const { noteId, likes, likesCount } = response.payload;
                setNotes((prev) =>
                  prev.map((n) =>
                    n.id === noteId
                      ? {
                        ...n,
                        likes: likes || n.likes,
                        likesCount: likesCount !== undefined ? likesCount : n.likesCount
                      }
                      : n
                  )
                );
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
      channelRef.current = null;
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
    const DEPT_KEYWORDS: Record<string, string[]> = {
      aiml: ['machine learning', 'deep learning', 'neural network', 'artificial intelligence', 'ai/ml', 'intelligence'],
      ds: ['data science', 'data analytics', 'big data', 'statistics', 'tableau', 'predictive model'],
      ece: ['microprocessor', 'embedded system', 'circuits', 'electronics', 'signals & systems', 'semiconductor', 'diode', 'transistor'],
      mechanical: ['thermodynamics', 'fluid mechanics', 'cad', 'mechanical engineering', 'gear', 'turbine'],
      civil: ['structural analysis', 'surveying', 'geotechnical', 'civil engineering', 'concrete', 'beam']
    };

    const CATEGORY_KEYWORDS: Record<string, string[]> = {
      'cse-dsa': ['dsa', 'data structure', 'algorithm', 'algo', 'graph', 'tree', 'stack', 'queue', 'array', 'sorting', 'searching', 'linked list'],
      'cse-dbms': ['dbms', 'database', 'sql', 'query', 'normalization', 'nosql', 'relational', 'schema'],
      'cse-os': ['operating system', 'os', 'cpu scheduling', 'process', 'thread', 'semaphore', 'deadlock', 'memory management', 'paging'],
      'cse-webdev': ['web', 'html', 'css', 'javascript', 'react', 'node', 'express', 'frontend', 'backend', 'fullstack', 'api'],
      'cse-discrete': ['discrete mathematics', 'discrete math', 'graphs', 'set theory', 'logic', 'combinatorics', 'probability', 'relations'],
      'cse-engmath': ['engineering mathematics', 'calculus', 'linear algebra', 'matrices', 'differential equations', 'integration'],
      'cse-engphysics': ['engineering physics', 'optics', 'quantum', 'laser', 'fiber optics', 'electromagnetism'],
      'cse-engchemistry': ['engineering chemistry', 'water technology', 'electrochemistry', 'spectroscopy', 'polymers'],
      'cse-basics': ['basic electrical', 'electronics', 'ac circuits', 'dc circuits', 'transformers', 'semiconductors'],
      'cse-pps': ['programming for problem solving', 'c programming', 'loops', 'arrays', 'functions', 'pointers'],
      'cse-english': ['technical english', 'communication skills', 'grammar', 'vocabulary'],
      'cse-oop': ['object-oriented programming', 'oop', 'java', 'c++', 'classes', 'objects', 'inheritance', 'polymorphism', 'encapsulation'],
      'cse-coa': ['computer organization', 'architecture', 'coa', 'cpu', 'memory hierarchy', 'io interface', 'pipelining'],
      'cse-networks': ['computer networks', 'networking', 'tcp/ip', 'osi model', 'routing', 'switching', 'http', 'dns'],
      'cse-software': ['software engineering', 'sdlc', 'agile', 'uml', 'testing', 'design patterns'],
      'cse-compiler': ['compiler design', 'compiler', 'lexical analysis', 'parsing', 'code generation', 'optimization'],
      'cse-automata': ['automata', 'flat', 'toc', 'finite automata', 'cfg', 'pda', 'turing machine'],
      'cse-cloud': ['cloud computing', 'cyber security', 'aws', 'virtualization', 'cryptography', 'network security', 'firewall'],
      'cse-distributed': ['distributed systems', 'concurrency', 'consensus', 'raft', 'mapreduce', 'distributed databases'],
      'cse-iot': ['internet of things', 'iot', 'sensors', 'actuators', 'smart devices', 'raspberry pi', 'node-red'],
      'cse-entrepreneurship': ['entrepreneurship', 'business plan', 'startup', 'marketing', 'finance'],
      'cse-project': ['capstone project', 'project report', 'internship', 'industrial training'],

      'aiml-ml': ['ai', 'ml', 'machine learning', 'artificial intelligence', 'neural network', 'deep learning', 'nlp', 'cnn', 'rnn', 'supervised', 'regression', 'classification'],
      'ds-analytics': ['data analytics', 'data science', 'analytics', 'statistics', 'dataframe', 'pandas', 'numpy', 'visualization', 'tableau', 'r programming'],
      'ece-microprocessors': ['microprocessor', 'embedded', '8085', '8086', 'arduino', 'microcontroller', 'assembly', 'interfacing'],
      'ece-digital': ['digital electronics', 'logic gate', 'boolean algebra', 'flip flop', 'multiplexer', 'combinational', 'sequential'],
      'ece-signals': ['signals', 'systems', 'fourier', 'laplace', 'z-transform', 'lti system', 'continuous time', 'discrete time'],
      'ece-iot': ['internet of things', 'iot', 'sensors', 'actuators', 'smart devices', 'raspberry pi', 'node-red'],

      'mechanical-thermo': ['thermodynamics', 'entropy', 'carnot', 'heat engine', 'laws of thermodynamics', 'enthalpy'],
      'mechanical-fluid': ['fluid', 'bernoulli', 'viscosity', 'hydraulics', 'flow', 'buoyancy'],
      'mechanical-cad': ['mechanical', 'gear', 'engine', 'turbine', 'thermodynamics', 'fluid mechanics', 'fluid dynamics', 'cad', 'robotics', 'materials', 'kinematics', 'aerodynamics'],

      'civil-structures': ['structural', 'truss', 'beam', 'concrete', 'steel design', 'bending moment', 'shear force'],
      'civil-survey': ['surveying', 'geology', 'leveling', 'mapping', 'compass'],
      'civil-geotech': ['geotechnical', 'soil mechanics', 'foundation engineering', 'clay', 'silt', 'rock mechanics']
    };

    let result = [...notes];

    // Filter by Feed Type (Notes vs PYQ Papers)
    if (feedType === 'notes') {
      result = result.filter(n => !n.subject.startsWith('[QP -'));
    } else {
      result = result.filter(n => n.subject.startsWith('[QP -'));
    }

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

    // Semester Range Filter (Supports both range matching and legacy single semester numbers)
    if (selectedSemester !== 'all') {
      result = result.filter((n) => {
        const sem = n.semester;
        if (selectedSemester === '1/2') return sem === '1/2' || sem === '1' || sem === '2';
        if (selectedSemester === '3/4') return sem === '3/4' || sem === '3' || sem === '4';
        if (selectedSemester === '5/6') return sem === '5/6' || sem === '5' || sem === '6';
        if (selectedSemester === '7/8') return sem === '7/8' || sem === '7' || sem === '8';
        return sem === selectedSemester;
      });
    }

    // Branch Filter
    if (selectedBranch !== 'all') {
      const bId = selectedBranch.toLowerCase();
      // Get the full branch name for more flexible matching
      const matchedBranch = branches.find(b => b.id.toLowerCase() === bId);
      const branchNameWords = matchedBranch
        ? matchedBranch.name.toLowerCase().split(/\s+/).filter(w => w.length > 3)
        : [];

      result = result.filter((n: any) => {
        // 1. Check if category prefix matches branch (most reliable auto-routing for legacy defaults)
        if (n.category && n.category.toLowerCase().startsWith(bId)) {
          return true;
        }

        // 2. Self-heal legacy branch defaults ('cse'):
        // If a note defaulted to 'cse' but has keywords for another department, dynamically re-route it
        if (n.branch && n.branch.toLowerCase() === 'cse') {
          const sub = n.subject.toLowerCase();
          const desc = (n.description || '').toLowerCase();
          const textToSearch = `${sub} ${desc}`;

          let actualBranch = 'cse';
          for (const [deptId, keywords] of Object.entries(DEPT_KEYWORDS)) {
            if (keywords.some(k => textToSearch.includes(k))) {
              actualBranch = deptId;
              break;
            }
          }
          return actualBranch === bId;
        }

        // 3. Strict branch match for all other branch assignments
        if (n.branch && n.branch.trim() !== '') {
          // Direct branch ID match
          if (n.branch.toLowerCase() === bId) {
            return true;
          }
          // Branch name match
          if (branchNameWords.length > 0 && branchNameWords.every(w => n.branch.toLowerCase().includes(w))) {
            return true;
          }
          return false; // Stop checking and fail if branch was set but didn't match
        }

        // 4. Legacy compatibility for notes with no branch and no category prefix: fuzzy keyword check
        const sub = n.subject.toLowerCase();
        const desc = (n.description || '').toLowerCase();
        const textToSearch = `${sub} ${desc}`;

        if (bId === 'cse') return textToSearch.includes('computer') || textToSearch.includes('algo') || textToSearch.includes('software') || textToSearch.includes('web') || textToSearch.includes('programming') || textToSearch.includes('code') || textToSearch.includes('javascript') || textToSearch.includes('python');
        if (bId === 'aiml') return textToSearch.includes('ai') || textToSearch.includes('machine') || textToSearch.includes('learning') || textToSearch.includes('intelligence') || textToSearch.includes('robotic') || textToSearch.includes('deep');
        if (bId === 'ds') return textToSearch.includes('data') || textToSearch.includes('analytic') || textToSearch.includes('statistic') || textToSearch.includes('predictive') || textToSearch.includes('visual');
        if (bId === 'civil') return textToSearch.includes('civil') || textToSearch.includes('concrete') || textToSearch.includes('structure') || textToSearch.includes('surveying') || textToSearch.includes('geotech');
        if (bId === 'ece') return textToSearch.includes('circuit') || textToSearch.includes('semiconductor') || textToSearch.includes('diode') || textToSearch.includes('electronics') || textToSearch.includes('arduino') || textToSearch.includes('voltage') || textToSearch.includes('vlsi') || textToSearch.includes('signal');
        if (bId === 'mechanical') return textToSearch.includes('mechanical') || textToSearch.includes('machine') || textToSearch.includes('gear') || textToSearch.includes('cad') || textToSearch.includes('thermodynamics') || textToSearch.includes('engine') || textToSearch.includes('fluid');

        return false;
      });
    }

    // Subject Category Filter
    if (selectedCategory !== 'all') {
      const cat = selectedCategory.toLowerCase();
      // Find the matched category (case-insensitive ID match)
      const matchedCat = categories.find(c => c.id.toLowerCase() === cat);

      result = result.filter((n: any) => {
        // If note has a category set, use strict matching only
        if (n.category && n.category.trim() !== '') {
          // Direct category attribute match (ID comparison)
          if (n.category.toLowerCase() === cat) {
            return true;
          }
          // Match by category name stored in note
          if (matchedCat && n.category.toLowerCase() === matchedCat.name.toLowerCase()) {
            return true;
          }
          return false; // Do not do fuzzy fallback if category is explicitly set!
        }

        // Fallback for legacy note documents (without category) — keyword match
        const sub = n.subject.toLowerCase();
        const desc = (n.description || '').toLowerCase();
        const textToSearch = `${sub} ${desc}`;

        // Match using specific category keywords
        const keywords = CATEGORY_KEYWORDS[cat];
        if (keywords) {
          return keywords.some(keyword => textToSearch.includes(keyword));
        }

        // Dynamic match using the category label as keyword
        if (matchedCat) {
          const labelWords = matchedCat.name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          if (labelWords.length > 0) {
            return labelWords.every(word => textToSearch.includes(word));
          }
          // If all words in category name are short, try the full name
          return textToSearch.includes(matchedCat.name.toLowerCase());
        }

        return false;
      });
    }

    setFilteredNotes(result);
  }, [notes, searchQuery, selectedSemester, selectedBranch, selectedCategory, categories, branches, feedType]);

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

    if (!hasLiked) {
      try {
        incrementQuestProgress('like-note', 1);
      } catch (e) {
        console.warn('Failed to increment like-note quest progress:', e);
      }
    }

    // Optimistically update local state immediately for instant feedback
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

    // Save to local likes storage for persistence
    try {
      const localLikesStr = localStorage.getItem('noteweb-local-likes');
      let localLikes: Record<string, boolean> = {};
      if (localLikesStr) {
        try { localLikes = JSON.parse(localLikesStr); } catch { }
      }
      if (hasLiked) {
        delete localLikes[noteId];
      } else {
        localLikes[noteId] = true;
      }
      localStorage.setItem('noteweb-local-likes', JSON.stringify(localLikes));
    } catch (e) {
      console.warn("Failed to save local like:", e);
    }

    // Broadcast the like event to other students in real-time
    if (channelRef.current) {
      try {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'like-note',
          payload: { noteId, likes: nextLikes, likesCount: nextLikesCount }
        });
      } catch (broadcastErr) {
        console.warn("Failed to broadcast like event:", broadcastErr);
      }
    }

    // Attempt to persist in Supabase DB (graceful fallback if blocked by RLS)
    try {
      const { error: err } = await supabase
        .from('notes')
        .update({
          likes: nextLikes,
          likes_count: nextLikesCount
        })
        .eq('id', noteId);

      if (err) {
        if (err.message?.includes('column') || err.code === '42703') {
          console.warn('[NoteWeb Feed] likes_count column missing, trying camelCase likesCount...');
          const { error: camelErr } = await supabase
            .from('notes')
            .update({
              likes: nextLikes,
              likesCount: nextLikesCount
            })
            .eq('id', noteId);
          if (camelErr) {
            console.warn('[NoteWeb Feed] CamelCase like update also failed (RLS blocked). Synced via P2P.');
          }
        } else {
          console.warn('[NoteWeb Feed] DB like update blocked by RLS/policy. Synced via P2P Broadcast.');
        }
      }
    } catch (e) {
      console.warn('[NoteWeb Feed] DB update failed. Synced via P2P Broadcast:', e);
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

  // AI Note Companion modal state
  const [activeAiNote, setActiveAiNote] = useState<NoteDocument | null>(null);
  const [aiCompanionTab, setAiCompanionTab] = useState<'podcast' | 'flashcards' | 'quiz' | 'qna'>('podcast');

  // Speech Synthesis state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speechRate, setSpeechRate] = useState<number>(1);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleCloseAiCompanion = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
    setActiveAiNote(null);
  };

  const startSpeech = (textToRead: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn("Speech synthesis not supported on this platform/browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = textToRead
      .replace(/###/g, '')
      .replace(/##/g, '')
      .replace(/#/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/- \[ \]/g, '')
      .replace(/- \[x\]/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = speechRate;

    const voices = window.speechSynthesis.getVoices();
    const premiumVoice = voices.find(
      voice => voice.name.includes('Google') || voice.name.includes('Natural') || voice.name.includes('Microsoft Zira')
    );
    if (premiumVoice) utterance.voice = premiumVoice;

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };
    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
    setIsPaused(false);
  };

  const pauseSpeech = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  const resumeSpeech = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  };

  const stopSpeech = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
  };

  const handleSpeedChange = (rate: number) => {
    setSpeechRate(rate);
    if (isPlaying) {
      // Restart speech with new rate if currently playing
      startSpeech(activeAiNote?.summary || `${activeAiNote?.subject}. ${activeAiNote?.description}`);
    }
  };
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Flashcards state
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});

  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [submittedQuiz, setSubmittedQuiz] = useState(false);

  // Q&A chat history state
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'model'; text: string }>>([]);
  const [chatInput, setChatInput] = useState('');

  const handleOpenAiCompanion = (note: NoteDocument) => {
    setActiveAiNote(note);
    setAiCompanionTab('podcast');
    setAiError(null);
    setFlashcards([]);
    setFlippedCards({});
    setQuizQuestions([]);
    setSelectedAnswers({});
    setSubmittedQuiz(false);
    setChatHistory([]);
    setChatInput('');
  };

  const handleTabChange = async (tab: 'podcast' | 'flashcards' | 'quiz' | 'qna') => {
    setAiCompanionTab(tab);
    setAiError(null);

    if (!activeAiNote) return;

    if (tab === 'flashcards' && flashcards.length === 0) {
      setAiLoading(true);
      try {
        const data = await generateFlashcards(activeAiNote.subject, activeAiNote.description, activeAiNote.summary);
        setFlashcards(data);
      } catch (err: any) {
        setAiError(err.message || 'Failed to load study flashcards.');
      } finally {
        setAiLoading(false);
      }
    } else if (tab === 'quiz' && quizQuestions.length === 0) {
      setAiLoading(true);
      try {
        const data = await generateQuiz(activeAiNote.subject, activeAiNote.description, activeAiNote.summary);
        setQuizQuestions(data);
        setSelectedAnswers({});
        setSubmittedQuiz(false);
      } catch (err: any) {
        setAiError(err.message || 'Failed to load study quiz.');
      } finally {
        setAiLoading(false);
      }
    }
  };

  const handleToggleFlipCard = (index: number) => {
    setFlippedCards(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleSelectAnswer = (questionIndex: number, optionIndex: number) => {
    if (submittedQuiz) return;
    setSelectedAnswers(prev => ({
      ...prev,
      [questionIndex]: optionIndex
    }));
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeAiNote) return;

    const userMsg = chatInput.trim();
    setChatInput('');

    const nextHistory = [...chatHistory, { role: 'user' as const, text: userMsg }];
    setChatHistory(nextHistory);
    setAiLoading(true);

    try {
      incrementQuestProgress('ask-ai', 1);
    } catch (e) {
      console.warn('Failed to increment ask-ai quest progress:', e);
    }

    try {
      const reply = await askGeminiQna(
        activeAiNote.subject,
        activeAiNote.description,
        activeAiNote.summary || '',
        userMsg,
        chatHistory
      );
      setChatHistory(prev => [...prev, { role: 'model' as const, text: reply }]);
    } catch (err: any) {
      setAiError(err.message || 'Error getting AI response.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleDeleteCategory = async (catId: string, catName: string) => {
    const isConfirmed = window.confirm(`Are you absolutely sure you want to permanently delete the subject category "${catName}"? This cannot be undone.`);
    if (!isConfirmed) return;

    try {
      const { error: err } = await supabase
        .from('categories')
        .delete()
        .eq('id', catId);

      if (err) throw err;

      setCategories((prev) => prev.filter((c) => c.id !== catId));
      if (selectedCategory === catId) {
        setSelectedCategory('all');
      }
      success(`Category "${catName}" has been successfully deleted.`);
    } catch (e: any) {
      console.error("Failed to delete category:", e);
      error("Failed to delete category: " + e.message);
    }
  };

  const handleDeleteNote = async (noteId: string, pdfPath: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this note?")) return;
    try {
      const isLocalNote = String(noteId).startsWith('optimistic-');

      if (!isLocalNote) {
        if (pdfPath && pdfPath !== 'external-link' && !pdfPath.startsWith('cloudinary:')) {
          const { error: storageErr } = await supabase.storage.from('notes').remove([pdfPath]);
          if (storageErr) console.warn("Storage PDF delete warning:", storageErr);
        }

        const { error: err } = await supabase
          .from('notes')
          .delete()
          .eq('id', noteId);

        if (err) throw err;
      }

      // Also delete from local synchronization cache to prevent background restore
      try {
        const storedNotesStr = localStorage.getItem('noteweb-broadcasted-notes');
        const myUploadsStr = localStorage.getItem('noteweb-my-uploads');
        const noteToDelete = notes.find((n) => String(n.id) === String(noteId));

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
          } catch { }
        }
        if (myUploadsStr) {
          try {
            const myUploads = JSON.parse(myUploadsStr);
            if (Array.isArray(myUploads)) {
              const filtered = myUploads.filter((n: any) =>
                String(n.id) !== String(noteId) &&
                !(noteToDelete && (n.subject === noteToDelete.subject || (n.file_name && n.file_name === noteToDelete.fileName)))
              );
              if (filtered.length > 0) {
                localStorage.setItem('noteweb-my-uploads', JSON.stringify(filtered));
              } else {
                localStorage.removeItem('noteweb-my-uploads');
              }
            }
          } catch { }
        }
      } catch (cacheErr) {
        console.warn("Failed to clear note from migration cache:", cacheErr);
      }

      // Pure database deletion complete, updating state directly.

      setNotes((prev) => prev.filter((n) => String(n.id) !== String(noteId)));
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
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold flex-shrink-0 ${realtimeSynced
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-slate-500/10 border-white/10 text-slate-500'
                }`}>
                {realtimeSynced ? (
                  <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" /><Wifi className="w-3 h-3" /> Live</>
                ) : (
                  <><WifiOff className="w-3 h-3" /> Syncing...</>
                )}
              </div>

              {/* Manual Sync / Refresh Button */}
              <button
                onClick={() => fetchNotes(false)}
                disabled={isLoading}
                className="flex items-center justify-center p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] active:scale-95 border border-white/[0.08] hover:border-indigo-500/40 text-slate-400 hover:text-white transition-all cursor-pointer shadow-md shadow-black/5 disabled:opacity-50"
                title="Sync Library Notes"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Segment & Sorting controls */}
          <div className="flex items-center gap-4 flex-wrap self-start md:self-auto">
            {/* Notes vs PYQ Papers */}
            <div className="flex items-center gap-1 glass-panel p-1 rounded-xl border border-white/[0.08] light-mode:border-slate-900/10">
              <button
                onClick={() => setFeedType('notes')}
                className={`px-4.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${feedType === 'notes' ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10' : 'text-slate-400 hover:text-slate-200 light-mode:text-slate-600 light-mode:hover:text-slate-905'}`}
              >
                Study Notes
              </button>
              <button
                onClick={() => setFeedType('papers')}
                className={`px-4.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${feedType === 'papers' ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10' : 'text-slate-400 hover:text-slate-200 light-mode:text-slate-600 light-mode:hover:text-slate-905'}`}
              >
                PYQ Papers
              </button>
            </div>

            {/* Sorting */}
            <div className="flex items-center gap-1 glass-panel p-1 rounded-xl border border-white/[0.08] light-mode:border-slate-900/10">
              <button
                onClick={() => setSortBy('recent')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${sortBy === 'recent' ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10' : 'text-slate-400 hover:text-slate-200 light-mode:text-slate-600 light-mode:hover:text-slate-905'}`}
              >
                Recent
              </button>
              <button
                onClick={() => setSortBy('popular')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${sortBy === 'popular' ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10' : 'text-slate-400 hover:text-slate-200 light-mode:text-slate-600 light-mode:hover:text-slate-905'}`}
              >
                Popular
              </button>
            </div>
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* Left Column Filters Sidebar */}
          <div className="lg:col-span-1 flex flex-col gap-6 text-left">
            <GlassPanel className="p-5 flex flex-col gap-6">
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
                    .filter((c) => selectedBranch === 'all' || c.branchId?.toLowerCase() === selectedBranch.toLowerCase())
                    .map((cat) => (
                      <div key={cat.id} className="relative group/cat flex items-center justify-between w-full">
                        <button
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`
                            w-full text-left px-3.5 py-2.5 text-xs font-semibold rounded-xl border transition-all duration-200 flex-shrink-0 pr-8
                            ${selectedCategory === cat.id
                              ? 'bg-indigo-600/15 border-indigo-500/40 text-indigo-400'
                              : 'border-white/[0.05] bg-white/[0.01] text-slate-400 hover:border-white/10 hover:text-slate-200 light-mode:border-slate-900/10 light-mode:hover:bg-slate-900/[0.02]'}
                          `}
                        >
                          {cat.name}
                        </button>
                        {userProfile?.role === 'admin' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCategory(cat.id, cat.name);
                            }}
                            className="absolute right-2 p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-all cursor-pointer opacity-0 group-hover/cat:opacity-100 focus:opacity-100"
                            title={`Delete Category "${cat.name}"`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              {/* Semester Filter */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 pl-1">
                  Semester Range
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => setSelectedSemester('all')}
                    className={`
                      col-span-2 text-center py-2 text-xs font-semibold rounded-xl border transition-all duration-200
                      ${selectedSemester === 'all'
                        ? 'bg-indigo-600/15 border-indigo-500/40 text-indigo-400'
                        : 'border-white/[0.05] bg-white/[0.01] text-slate-400 hover:border-white/10 hover:text-slate-200 light-mode:border-slate-900/10 light-mode:hover:bg-slate-900/[0.02]'}
                    `}
                  >
                    All Semesters
                  </button>
                  {['1/2', '3/4', '5/6', '7/8'].map((sem) => (
                    <button
                      key={sem}
                      onClick={() => setSelectedSemester(sem)}
                      className={`
                        text-center py-2 text-[10px] font-black rounded-xl border transition-all duration-200
                        ${selectedSemester === sem
                          ? 'bg-indigo-600/15 border-indigo-500/40 text-indigo-400'
                          : 'border-white/[0.05] bg-white/[0.01] text-slate-400 hover:border-white/10 hover:text-slate-200 light-mode:border-slate-900/10 light-mode:hover:bg-slate-900/[0.02]'}
                      `}
                    >
                      Sem {sem}
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
                    <GlassPanel key={i} className="min-h-[290px] flex flex-col justify-between">
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
                          className="w-full h-full"
                        >
                          <TiltCard className="glass-card premium-border-glow hover:shadow-xl flex flex-col justify-between text-left min-h-[290px] h-full p-5 group relative w-full">
                            {/* Shimmer hovering glow border effect */}
                            <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                            {/* Top row */}
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
                                {note.subject.startsWith('[QP -') ? (
                                  <div className="flex flex-col items-start gap-1.5 text-left">
                                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-500/5">
                                      📄 {note.subject.match(/^\[QP - ([^\]]+)\]/)?.[1] || 'Question Paper'}
                                    </span>
                                    <h3 className="font-extrabold text-base text-white group-hover:text-indigo-400 transition-colors duration-300 truncate light-mode:text-slate-900 w-full">
                                      {note.subject.replace(/^\[QP - [^\]]+\] /, '')}
                                    </h3>
                                  </div>
                                ) : (
                                  <h3 className="font-extrabold text-base text-white group-hover:text-indigo-400 transition-colors duration-300 truncate light-mode:text-slate-900">
                                    {note.subject}
                                  </h3>
                                )}

                                <div className="flex items-center gap-1 text-[11px] text-slate-500 font-semibold mt-1 text-left">
                                  <GraduationCap className="w-3.5 h-3.5" /> {note.subject.startsWith('[QP -') ? 'Exam Board Syllabus' : `Prof. ${note.teacher}`}
                                </div>
                                <p className="text-xs text-slate-400 light-mode:text-slate-500 leading-relaxed line-clamp-2 mt-2 text-left">
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
                                <SparkleBurst>
                                  <button
                                    onClick={() => handleLikeToggle(note.id, note.likes)}
                                    className={`
                                      p-2 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all active:scale-90 cursor-pointer
                                      ${isLiked
                                        ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 shadow-md shadow-indigo-600/10'
                                        : 'text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10'}
                                    `}
                                    title="Like Note"
                                  >
                                    <ThumbsUp className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                                    <span>{note.likesCount || 0}</span>
                                  </button>
                                </SparkleBurst>

                                {/* Bookmark toggle */}
                                <SparkleBurst>
                                  <button
                                    onClick={() => handleBookmarkToggle(note.id)}
                                    className={`
                                      p-2 rounded-lg flex items-center text-xs font-bold transition-all active:scale-90 cursor-pointer
                                      ${isBookmarked
                                        ? 'bg-purple-600/20 border border-purple-500/30 text-purple-400 shadow-md shadow-purple-600/10'
                                        : 'text-slate-400 hover:text-purple-400 hover:bg-purple-500/10'}
                                    `}
                                    title="Bookmark Note"
                                  >
                                    <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
                                  </button>
                                </SparkleBurst>

                                {/* AI Companion button */}
                                <button
                                  onClick={() => handleOpenAiCompanion(note)}
                                  className="p-2 rounded-lg flex items-center gap-1 text-xs font-extrabold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:text-white hover:bg-indigo-600 hover:border-indigo-500 transition-all duration-200 cursor-pointer active:scale-90 shadow-sm shadow-indigo-600/10"
                                  title="AI Note Companion"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">AI Study</span>
                                </button>
                              </div>

                              <div className="flex items-center gap-2">
                                {/* View PDF download */}
                                <button
                                  onClick={() => openPdfDocument(note.pdfUrl || 'db-base64-fetch', note.pdfPath || '', note.id)}
                                  className="inline-flex items-center justify-center p-2 rounded-lg border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/5 light-mode:border-slate-900/10 light-mode:text-slate-600 light-mode:hover:text-slate-900 transition-all duration-200 cursor-pointer active:scale-95"
                                  title={note.pdfPath === 'external-link' ? "Open Cloud Shared Document" : "Open PDF Document"}
                                >
                                  {note.pdfPath === 'external-link' ? (
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  ) : (
                                    <Download className="w-3.5 h-3.5" />
                                  )}
                                </button>

                                {/* Delete note button */}
                                {user && userProfile && (note.uploadedBy === user.uid || userProfile.role === 'admin') && (
                                  <button
                                    onClick={() => handleDeleteNote(note.id, note.pdfPath)}
                                    className="inline-flex items-center justify-center p-2 rounded-lg border border-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all duration-200 cursor-pointer active:scale-95"
                                    title="Delete Note"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </TiltCard>
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

      {/* SLIDING AI STUDY COMPANION PANEL (AnimatePresence) */}
      <AnimatePresence>
        {activeAiNote && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseAiCompanion}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Sliding Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full max-w-xl h-full bg-[#0D0D10]/95 border-l border-white/[0.08] light-mode:bg-white light-mode:border-slate-200 shadow-2xl p-6 md:p-8 flex flex-col justify-between overflow-y-auto text-left z-10"
            >
              <div>
                {/* Close Button */}
                <button
                  onClick={handleCloseAiCompanion}
                  className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 light-mode:hover:bg-slate-900/5 transition-all active:scale-90"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Hero Header */}
                <div className="flex items-start gap-4 mb-6 pr-8">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 shadow-lg shadow-indigo-600/5 flex-shrink-0 animate-pulse">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white light-mode:text-slate-900 tracking-tight leading-tight mb-1">
                      {activeAiNote.subject}
                    </h3>
                    <p className="text-[10px] font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 inline-block uppercase">
                      Gemini 2.5 Study Companion
                    </p>
                  </div>
                </div>

                {/* Tab selections */}
                <div className="flex items-center gap-1.5 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl mb-6 light-mode:bg-slate-900/[0.02]">
                  <button
                    onClick={() => handleTabChange('podcast')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${aiCompanionTab === 'podcast'
                        ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10'
                        : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    Podcast
                  </button>
                  <button
                    onClick={() => handleTabChange('flashcards')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${aiCompanionTab === 'flashcards'
                        ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10'
                        : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Flashcards
                  </button>
                  <button
                    onClick={() => handleTabChange('quiz')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${aiCompanionTab === 'quiz'
                        ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10'
                        : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    Recall Quiz
                  </button>
                  <button
                    onClick={() => handleTabChange('qna')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${aiCompanionTab === 'qna'
                        ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10'
                        : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Ask AI
                  </button>
                </div>

                {/* Main Content Area */}
                <div className="min-h-[400px]">
                  {aiLoading && (
                    <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
                      <div className="relative w-12 h-12">
                        <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20" />
                        <div className="absolute inset-0 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                      </div>
                      <p className="text-xs font-bold text-indigo-400 animate-pulse uppercase tracking-wider">
                        Gemini is thinking...
                      </p>
                    </div>
                  )}

                  {!aiLoading && aiError && (
                    <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-400 text-xs font-medium text-center">
                      ⚠️ {aiError}
                    </div>
                  )}

                  {!aiLoading && !aiError && (
                    <div>
                      {/* PODCAST TAB */}
                      {aiCompanionTab === 'podcast' && (
                        <div className="space-y-6 text-left pl-1 pr-1">
                          <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                            🎙️ Listen to your personalized AI-generated Note summary
                          </p>

                          {/* Sound studio card */}
                          <div className="p-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] light-mode:bg-slate-900/[0.02] light-mode:border-slate-200 relative overflow-hidden flex flex-col items-center justify-center text-center">
                            <div className="absolute top-0 right-0 w-32 h-32 rounded-full filter blur-3xl opacity-10 bg-indigo-500" />

                            {/* Visualizer Disk */}
                            <motion.div
                              animate={isPlaying && !isPaused ? { rotate: 360 } : {}}
                              transition={{ repeat: Infinity, duration: 10, ease: 'linear' }}
                              className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center relative shadow-lg shadow-indigo-500/20 mb-6"
                            >
                              <div className="w-8 h-8 rounded-full bg-[#0D0D10] border border-white/10 flex items-center justify-center text-indigo-400">
                                <Volume2 className="w-4 h-4 animate-bounce" />
                              </div>

                              {/* Audio waves */}
                              {isPlaying && !isPaused && (
                                <div className="absolute -inset-2 rounded-full border border-indigo-400/40 animate-ping opacity-30 pointer-events-none" />
                              )}
                            </motion.div>

                            <h4 className="text-base font-extrabold text-white light-mode:text-slate-900 mb-1">
                              {isPlaying ? (isPaused ? 'Podcast Paused' : 'Playing AI Summary Podcast...') : 'Ready to Broadcast'}
                            </h4>
                            <p className="text-xs text-slate-400 light-mode:text-slate-500 mb-6 max-w-sm">
                              Generated utilizing Google Gemini 2.5. Reads aloud the core checklist and learnings.
                            </p>

                            {/* Audio Controls */}
                            <div className="flex items-center gap-4 mb-6">
                              {!isPlaying ? (
                                <button
                                  onClick={() => startSpeech(activeAiNote.summary || `${activeAiNote.subject}. ${activeAiNote.description}`)}
                                  className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20 hover:scale-105 active:scale-95 transition-all animate-bounce cursor-pointer"
                                >
                                  <Play className="w-5 h-5 fill-current ml-0.5" />
                                </button>
                              ) : (
                                <>
                                  {isPaused ? (
                                    <button
                                      onClick={resumeSpeech}
                                      className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                    >
                                      <Play className="w-5 h-5 fill-current ml-0.5" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={pauseSpeech}
                                      className="w-12 h-12 rounded-full bg-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-600/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                    >
                                      <Pause className="w-5 h-5 fill-current" />
                                    </button>
                                  )}

                                  <button
                                    onClick={stopSpeech}
                                    className="w-12 h-12 rounded-full bg-rose-600/20 border border-rose-500/30 text-rose-400 flex items-center justify-center hover:bg-rose-600 hover:text-white active:scale-95 transition-all cursor-pointer"
                                  >
                                    <Square className="w-4 h-4 fill-current" />
                                  </button>
                                </>
                              )}
                            </div>

                            {/* Speed selector */}
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">Speed:</span>
                              {([1, 1.25, 1.5] as const).map((rate) => (
                                <button
                                  key={rate}
                                  onClick={() => handleSpeedChange(rate)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${speechRate === rate
                                      ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-400'
                                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                                    }`}
                                >
                                  {rate}x
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Written Summary Outline */}
                          <div className="space-y-3">
                            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 light-mode:text-slate-600 pl-1">
                              Written Summary Outline
                            </h5>
                            <div className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.01] light-mode:bg-slate-900/[0.01] light-mode:border-slate-200 text-slate-300 light-mode:text-slate-700 text-xs leading-relaxed space-y-4 max-h-[300px] overflow-y-auto">
                              {activeAiNote.summary ? (
                                <div className="prose prose-invert prose-xs max-w-none text-left">
                                  {activeAiNote.summary.split('\n').map((line, lIdx) => {
                                    if (line.startsWith('###')) {
                                      return (
                                        <h4 key={lIdx} className="text-sm font-black text-white mt-4 first:mt-0 mb-2 light-mode:text-slate-900">
                                          {line.replace('###', '').trim()}
                                        </h4>
                                      );
                                    }
                                    if (line.startsWith('- **') || line.startsWith('- **')) {
                                      const parts = line.replace('- ', '').split('**:');
                                      return (
                                        <p key={lIdx} className="mb-2">
                                          <strong className="text-indigo-400 font-extrabold">{parts[0]}**:</strong>
                                          {parts[1]}
                                        </p>
                                      );
                                    }
                                    if (line.startsWith('- [ ]') || line.startsWith('- [x]')) {
                                      return (
                                        <div key={lIdx} className="flex items-center gap-2 my-1.5 pl-1">
                                          <input
                                            type="checkbox"
                                            readOnly
                                            checked={line.includes('[x]')}
                                            className="w-3.5 h-3.5 rounded border-white/[0.1] bg-white/[0.05] text-indigo-500 accent-indigo-500 pointer-events-none"
                                          />
                                          <span className={line.includes('[x]') ? 'line-through text-slate-500' : ''}>
                                            {line.replace('- [ ]', '').replace('- [x]', '').trim()}
                                          </span>
                                        </div>
                                      );
                                    }
                                    return <p key={lIdx} className="my-1">{line}</p>;
                                  })}
                                </div>
                              ) : (
                                <p className="text-center text-slate-500 py-4 font-medium italic">
                                  No AI summary compiled for this note yet.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* FLASHCARDS TAB */}
                      {aiCompanionTab === 'flashcards' && (
                        <div className="space-y-4">
                          <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider text-left pl-1">
                            💡 Click on any card below to flip it and view the study answer!
                          </p>
                          <div className="grid grid-cols-1 gap-4">
                            {flashcards.map((fc, idx) => {
                              const isFlipped = !!flippedCards[idx];
                              return (
                                <div
                                  key={idx}
                                  className="perspective-1000 w-full min-h-[140px] cursor-pointer"
                                  onClick={() => handleToggleFlipCard(idx)}
                                >
                                  <div className={`relative w-full h-full min-h-[140px] transition-all duration-500 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>

                                    {/* FRONT SIDE (Question) */}
                                    <div className="absolute inset-0 w-full h-full p-6 rounded-2xl border bg-indigo-600/10 border-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.05)] light-mode:bg-indigo-50/80 light-mode:border-indigo-200 backface-hidden flex flex-col justify-center text-left">
                                      <div className="absolute top-0 right-0 w-24 h-24 rounded-full filter blur-xl opacity-20 bg-indigo-400" />
                                      <div className="z-10 relative">
                                        <span className="text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-indigo-500/20 text-indigo-400">
                                          Question {idx + 1}
                                        </span>
                                        <h4 className="text-sm font-extrabold mt-3 leading-relaxed text-white light-mode:text-slate-900">
                                          {fc.front}
                                        </h4>
                                      </div>
                                    </div>

                                    {/* BACK SIDE (Answer) */}
                                    <div className="absolute inset-0 w-full h-full p-6 rounded-2xl border bg-purple-600/10 border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.1)] light-mode:bg-purple-50/80 light-mode:border-purple-200 rotate-y-180 backface-hidden flex flex-col justify-center text-left">
                                      <div className="absolute top-0 right-0 w-24 h-24 rounded-full filter blur-xl opacity-20 bg-purple-400" />
                                      <div className="z-10 relative">
                                        <span className="text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-purple-500/20 text-purple-400">
                                          Answer/Explanation
                                        </span>
                                        <h4 className="text-sm font-extrabold mt-3 leading-relaxed text-purple-300 light-mode:text-purple-900">
                                          {fc.back}
                                        </h4>
                                      </div>
                                    </div>

                                  </div>
                                </div>
                              );
                            })}

                          </div>
                        </div>
                      )}

                      {/* PRACTICE QUIZ TAB */}
                      {aiCompanionTab === 'quiz' && (
                        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
                          <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider text-left pl-1">
                            ❓ Answer the questions below to test your understanding!
                          </p>
                          {quizQuestions.map((q, qIdx) => {
                            const selectedOpt = selectedAnswers[qIdx];
                            const hasAnswered = selectedOpt !== undefined;

                            return (
                              <GlassPanel key={qIdx} className="p-5 flex flex-col gap-4 bg-[#141419]/50 border border-white/5">
                                <h4 className="text-sm font-extrabold text-white light-mode:text-slate-900 leading-relaxed text-left flex items-start gap-2">
                                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-[10px] font-extrabold mt-0.5">
                                    {qIdx + 1}
                                  </span>
                                  {q.question}
                                </h4>

                                <div className="grid grid-cols-1 gap-2">
                                  {q.options.map((opt, oIdx) => {
                                    const isSelected = selectedOpt === oIdx;
                                    const isCorrect = q.answerIndex === oIdx;

                                    let optionStyle = 'border-white/5 bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.02] text-slate-300 light-mode:border-slate-200 light-mode:bg-slate-50/50 light-mode:text-slate-800';
                                    if (hasAnswered) {
                                      if (isSelected) {
                                        optionStyle = isCorrect
                                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 shadow-md shadow-emerald-500/5'
                                          : 'border-rose-500/40 bg-rose-500/10 text-rose-400 shadow-md shadow-rose-500/5';
                                      } else if (isCorrect) {
                                        optionStyle = 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400';
                                      } else {
                                        optionStyle = 'border-white/5 bg-white/[0.01] opacity-40 text-slate-500';
                                      }
                                    }

                                    return (
                                      <button
                                        key={oIdx}
                                        disabled={hasAnswered}
                                        onClick={() => handleSelectAnswer(qIdx, oIdx)}
                                        className={`w-full text-left px-4 py-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all active:scale-[0.99] ${optionStyle}`}
                                      >
                                        <span>{opt}</span>
                                        {hasAnswered && isCorrect && <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 ml-2" />}
                                        {hasAnswered && isSelected && !isCorrect && <X className="w-4 h-4 text-rose-400 flex-shrink-0 ml-2" />}
                                      </button>
                                    );
                                  })}
                                </div>

                                {hasAnswered && (
                                  <div className={`p-3.5 rounded-xl border text-left text-[11px] leading-relaxed ${selectedOpt === q.answerIndex
                                      ? 'bg-emerald-500/5 border-emerald-500/15 text-emerald-400/90'
                                      : 'bg-rose-500/5 border-rose-500/15 text-rose-400/90'
                                    }`}>
                                    <span className="font-extrabold uppercase text-[9px] tracking-wider block mb-1">
                                      {selectedOpt === q.answerIndex ? '🎉 Correct Answer!' : '❌ Incorrect Answer'}
                                    </span>
                                    <strong>Explanation:</strong> {q.rationale}
                                  </div>
                                )}
                              </GlassPanel>
                            );
                          })}
                        </div>
                      )}

                      {/* ASK GEMINI Q&A CHAT */}
                      {aiCompanionTab === 'qna' && (
                        <div className="flex flex-col gap-4 h-[55vh] justify-between">
                          <div className="flex-grow overflow-y-auto space-y-3.5 pr-1 max-h-[42vh] scrollbar-thin">
                            {chatHistory.length === 0 ? (
                              <div className="flex flex-col items-center justify-center h-48 text-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                                  <MessageSquare className="w-5 h-5" />
                                </div>
                                <div>
                                  <h5 className="text-xs font-bold text-white light-mode:text-slate-800">Ask anything about this note!</h5>
                                  <p className="text-[10px] text-slate-500 max-w-[280px] mt-1 mx-auto leading-relaxed">
                                    Gemini 2.5 Flash will analyze the note title, description, and summary to answer any doubts.
                                  </p>
                                </div>
                              </div>
                            ) : (
                              chatHistory.map((msg, mIdx) => (
                                <div
                                  key={mIdx}
                                  className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed text-left border ${msg.role === 'user'
                                      ? 'bg-indigo-600 border-indigo-500 text-white shadow shadow-indigo-600/10'
                                      : 'bg-white/[0.03] border-white/5 text-slate-200 light-mode:bg-slate-100 light-mode:border-slate-200 light-mode:text-slate-800'
                                    }`}>
                                    {/* Handle formatted output */}
                                    <div className="whitespace-pre-line font-medium">{msg.text}</div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>

                          {/* Input Bar */}
                          <form onSubmit={handleSendChat} className="flex gap-2 border-t border-white/[0.06] pt-3">
                            <input
                              type="text"
                              value={chatInput}
                              onChange={(e) => setChatInput(e.target.value)}
                              placeholder="Ask Gemini a study question..."
                              className="flex-grow py-2.5 px-4 glass-input text-xs bg-slate-950/80 text-white rounded-xl focus:border-indigo-500 focus:outline-none transition-colors border border-white/[0.08]"
                            />
                            <button
                              type="submit"
                              disabled={!chatInput.trim()}
                              className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-900 disabled:text-slate-600 text-white rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 flex-shrink-0"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Slider Footer Panel */}
              <div className="mt-8 pt-4 border-t border-white/[0.06] light-mode:border-slate-200 flex flex-col gap-3 flex-shrink-0">
                <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 uppercase tracking-wider pl-1">
                  <span>Note Study Mode</span>
                  <Award className="w-4 h-4 text-yellow-500" />
                </div>
                <button
                  onClick={() => openPdfDocument(activeAiNote.pdfUrl || 'db-base64-fetch', activeAiNote.pdfPath || '', activeAiNote.id)}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 text-white flex items-center justify-center font-extrabold text-xs gap-1.5 shadow-lg shadow-indigo-600/10 active:scale-[0.98] transition-all"
                >
                  {activeAiNote.pdfPath === 'external-link' ? (
                    <>
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open Shared Cloud Document
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      Open Full PDF Document
                    </>
                  )}
                </button>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
export default Feed;
