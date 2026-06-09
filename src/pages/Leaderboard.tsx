import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/config';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { renderAvatar } from '../utils/avatar';
import { GlassPanel } from '../components/ui/GlassPanel';
import { Skeleton } from '../components/ui/Skeleton';
import { motion } from 'framer-motion';
import { 
  Trophy, 
  Search, 
  BookOpen, 
  Award, 
  GraduationCap,
  Sparkles,
  ArrowUp
} from 'lucide-react';

interface LeaderboardUser {
  uid: string;
  username: string;
  displayName: string;
  branch: string;
  year: string;
  cgpa: number;
  points: number;
  photoURL: string;
  uploadsCount: number;
}

const BRANCH_LABELS: Record<string, string> = {
  cse: 'CSE',
  aiml: 'AI & ML',
  ds: 'DS',
  mechanical: 'Mechanical',
  civil: 'Civil',
  ece: 'ECE'
};

const getXPLevel = (points: number) => {
  if (points >= 1000) return { badge: '👑 Level 5', color: 'from-amber-400 to-orange-500 text-amber-300 border-amber-500/30' };
  if (points >= 500) return { badge: '🌟 Level 4', color: 'from-fuchsia-500 to-purple-600 text-fuchsia-300 border-fuchsia-500/30' };
  if (points >= 250) return { badge: '📚 Level 3', color: 'from-blue-500 to-indigo-600 text-blue-300 border-blue-500/30' };
  if (points >= 100) return { badge: '📖 Level 2', color: 'from-emerald-500 to-teal-600 text-emerald-300 border-emerald-500/30' };
  return { badge: '🌱 Level 1', color: 'from-slate-500 to-slate-600 text-slate-400 border-white/5' };
};

const getXPProgress = (points: number) => {
  if (points >= 1000) return 100;
  if (points >= 500) return Math.min(100, Math.round(((points - 500) / 500) * 100));
  if (points >= 250) return Math.min(100, Math.round(((points - 250) / 250) * 100));
  if (points >= 100) return Math.min(100, Math.round(((points - 100) / 150) * 100));
  return Math.min(100, Math.round((points / 100) * 100));
};

export const Leaderboard: React.FC = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  
  const [usersList, setUsersList] = useState<LeaderboardUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'points' | 'uploads' | 'cgpa'>('points');
  const [isLoading, setIsLoading] = useState(true);

  // Dynamic branch list state
  const [dbBranches, setDbBranches] = useState<any[]>([]);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const { data } = await supabase.from('branches').select('id,name');
        if (data && data.length > 0) {
          const blacklistIds = ['bse', 'cs', 'mgt', 'm', 'math', 'mathematics', 'basic-science', 'computer-science'];
          const blacklistNames = [
            'basic science & eng',
            'basic science',
            'basic sciences',
            'computer science',
            'mathematics',
            'management & humanities'
          ];
          
          let filtered = data.filter((b: any) => {
            if (blacklistIds.includes(b.id)) return false;
            if (blacklistNames.includes(b.name.trim().toLowerCase())) return false;
            return true;
          });

          // Deduplicate by name case-insensitive
          const seenNames = new Set<string>();
          filtered = filtered.filter((b: any) => {
            const normName = b.name.trim().toLowerCase();
            if (normName.includes('electronics') || normName.includes('comm')) {
              if (b.id !== 'ece' && filtered.some((o: any) => o.id === 'ece')) {
                return false;
              }
            }
            if (seenNames.has(normName)) {
              return false;
            }
            seenNames.add(normName);
            return true;
          });

          setDbBranches(filtered);
        }
      } catch (err) {
        console.warn("Failed to fetch branches for leaderboard selector:", err);
      }
    };
    fetchBranches();
  }, []);

  const getBranchLabel = (branchId: string) => {
    if (!branchId) return 'General';
    const found = dbBranches.find(b => b.id === branchId);
    if (found) return found.name;
    return BRANCH_LABELS[branchId] || branchId.toUpperCase();
  };

  const fetchLeaderboardData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      // 1. Fetch profiles
      const { data: profiles, error: pErr } = await supabase.from('profiles').select('*');
      if (pErr) throw pErr;

      // 2. Fetch notes to count uploads per user
      const { data: notes, error: nErr } = await supabase.from('notes').select('*');
      if (nErr) throw nErr;

      const rawProfiles = profiles || [];
      const rawNotes = notes || [];

      // Combine in memory
      const aggregated: LeaderboardUser[] = rawProfiles.map((p: any) => {
        const uid = p.id || p.uid;
        const uploads = rawNotes.filter((n: any) => n.uploaded_by === uid || n.uploadedBy === uid).length;
        
        return {
          uid: uid,
          username: p.username || '',
          displayName: p.display_name || p.displayName || 'Student',
          branch: p.branch || 'cse',
          year: p.year || '1',
          cgpa: p.cgpa ? parseFloat(p.cgpa) : 0,
          points: p.points !== undefined ? Number(p.points) : 0,
          photoURL: p.photo_url || p.photoURL || '',
          uploadsCount: uploads
        };
      });

      setUsersList(aggregated);
    } catch (e) {
      console.error('Leaderboard fetch failed:', e);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboardData();

    // 1. Set up Realtime subscriptions for profiles and notes
    let channelProfiles: any = null;
    let channelNotes: any = null;

    try {
      if (typeof supabase.channel === 'function') {
        channelProfiles = supabase
          .channel('public:profiles_leaderboard')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'profiles' },
            () => {
              console.log('Realtime change in profiles table, updating leaderboard silently...');
              fetchLeaderboardData(true);
            }
          )
          .subscribe();

        channelNotes = supabase
          .channel('public:notes_leaderboard')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'notes' },
            () => {
              console.log('Realtime change in notes table, updating leaderboard silently...');
              fetchLeaderboardData(true);
            }
          )
          .subscribe();
      }
    } catch (err) {
      console.warn("Realtime subscriptions failed on Leaderboard:", err);
    }

    return () => {
      if (channelProfiles) {
        try {
          channelProfiles.unsubscribe();
        } catch (e) {
          console.warn("Failed to unsubscribe profiles leaderboard channel:", e);
        }
      }
      if (channelNotes) {
        try {
          channelNotes.unsubscribe();
        } catch (e) {
          console.warn("Failed to unsubscribe notes leaderboard channel:", e);
        }
      }
    };
  }, []);

  // Filtered & Sorted list
  const getFilteredAndSorted = () => {
    let result = [...usersList];

    // Branch filter
    if (branchFilter !== 'all') {
      result = result.filter(u => u.branch === branchFilter);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u => 
        u.displayName.toLowerCase().includes(q) || 
        u.username.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'points') {
        return b.points - a.points;
      } else if (sortBy === 'uploads') {
        return b.uploadsCount - a.uploadsCount;
      } else {
        return b.cgpa - a.cgpa;
      }
    });

    return result;
  };

  const processedList = getFilteredAndSorted();

  // Top 3 Podium elements
  const podiumTop3 = processedList.slice(0, 3);
  // List elements (Rank 4 onwards)
  const remainderList = processedList.slice(3);

  const getMetricString = (u: LeaderboardUser) => {
    if (sortBy === 'points') return `${u.points} XP`;
    if (sortBy === 'uploads') return `${u.uploadsCount} Note${u.uploadsCount === 1 ? '' : 's'}`;
    return `CGPA: ${u.cgpa.toFixed(2)}`;
  };

  return (
    <div className="w-full py-8 px-4 md:px-8 relative overflow-hidden">
      {/* Background visual accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse" />

      <div className="max-w-5xl w-full mx-auto z-10 relative flex flex-col gap-8">
        
        {/* Title Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-4 shadow-lg shadow-indigo-500/5">
            <Trophy className="w-6 h-6 animate-bounce-slow" />
          </div>
          <h2 className={`text-3xl font-extrabold tracking-tight flex items-center justify-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            Campus Leaderboard
            <Sparkles className="w-5 h-5 text-amber-400" />
          </h2>
          <p className={`mt-2 text-sm max-w-md mx-auto ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Explore academic rankings, verify contributions, and see who is topping NoteWeb XP standouts!
          </p>
        </div>

        {/* Podium Top 3 Section */}
        {!isLoading && podiumTop3.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-8 max-w-3xl mx-auto w-full mb-4">
            
            {/* Podium 2nd Place (Silver) */}
            {podiumTop3[1] && (() => {
              const level = getXPLevel(podiumTop3[1].points);
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="order-2 md:order-1 flex flex-col items-center w-full"
                >
                  {/* Floating User details above pedestal (No enclosing card!) */}
                  <div className="flex flex-col items-center mb-3 text-center">
                    <span className="text-slate-400 font-extrabold text-[10px] uppercase tracking-wider bg-slate-400/10 px-3 py-1 rounded-full border border-slate-400/20 mb-2">🥈 2nd Place</span>
                    <div 
                      onClick={() => podiumTop3[1]?.uid && navigate(`/profile/${podiumTop3[1].uid}`)} 
                      className="flex flex-col items-center hover:scale-105 transition-transform duration-200 cursor-pointer"
                    >
                      <div className="relative">
                        {renderAvatar(podiumTop3[1].photoURL, "w-16 h-16 text-3xl")}
                        <span className="absolute -bottom-1 -right-1 flex items-center justify-center w-6 h-6 bg-slate-400 border-2 border-[#0A0A0C] text-white rounded-full text-xs font-bold shadow-lg shadow-black/40">🥈</span>
                      </div>
                      <h4 className={`font-extrabold text-sm mt-3 hover:text-indigo-400 transition-colors duration-200 ${isDark ? 'text-white' : 'text-slate-800'}`}>{podiumTop3[1].displayName}</h4>
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>{getBranchLabel(podiumTop3[1].branch)}</span>
                    
                    {/* XP Level Badge */}
                    <span className={`text-[9px] font-extrabold tracking-wider px-2 py-0.5 rounded border bg-gradient-to-r ${level.color} mt-2 shadow-sm`}>
                      {level.badge}
                    </span>

                    <span className={`text-xs font-bold mt-2.5 border px-3 py-0.5 rounded-full ${isDark ? 'text-slate-400 bg-white/5 border-white/[0.04]' : 'text-slate-700 bg-slate-100 border-slate-200'}`}>
                      {getMetricString(podiumTop3[1])}
                    </span>
                  </div>
                  
                  {/* Pedestal Step */}
                  <div className={`hidden md:flex w-28 h-16 border-t-2 border-x rounded-t-2xl items-center justify-center font-black text-base ${isDark ? 'from-slate-300/15 to-slate-400/5 bg-gradient-to-b border-slate-300/20 text-slate-300 shadow-[0_0_15px_rgba(203,213,225,0.06)]' : 'bg-slate-100 border-slate-300 text-slate-600 shadow-[0_4px_10px_rgba(0,0,0,0.05)]'}`}>II</div>
                </motion.div>
              );
            })()}

            {/* Podium 1st Place (Gold) */}
            {podiumTop3[0] && (() => {
              const level = getXPLevel(podiumTop3[0].points);
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="order-1 md:order-2 flex flex-col items-center scale-105 w-full relative z-20"
                >
                  {/* Glowing halo behind gold */}
                  <div className="absolute inset-0 bg-amber-400/5 rounded-full blur-2xl pointer-events-none" />
                  
                  {/* Floating User details above pedestal (No enclosing card!) */}
                  <div className="flex flex-col items-center mb-3 text-center">
                    <span className="text-amber-400 font-extrabold text-[10px] uppercase tracking-wider bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20 mb-2 animate-pulse">👑 1st Place</span>
                    <div 
                      onClick={() => podiumTop3[0]?.uid && navigate(`/profile/${podiumTop3[0].uid}`)} 
                      className="flex flex-col items-center hover:scale-105 transition-transform duration-200 cursor-pointer"
                    >
                      <div className="relative">
                        {renderAvatar(podiumTop3[0].photoURL, "w-20 h-20 text-4xl")}
                        <span className="absolute -bottom-1 -right-1 flex items-center justify-center w-8 h-8 bg-amber-400 border-2 border-[#0A0A0C] text-white rounded-full text-base font-bold shadow-lg shadow-black/40">👑</span>
                      </div>
                      <h4 className={`font-extrabold text-base mt-3 hover:text-indigo-400 transition-colors duration-200 ${isDark ? 'text-white' : 'text-slate-800'}`}>{podiumTop3[0].displayName}</h4>
                    </div>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider mt-0.5 ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>{getBranchLabel(podiumTop3[0].branch)}</span>
                    
                    {/* XP Level Badge */}
                    <span className={`text-[10px] font-extrabold tracking-widest px-2.5 py-0.5 rounded border bg-gradient-to-r ${level.color} mt-2 shadow-[0_0_8px_rgba(245,158,11,0.1)]`}>
                      {level.badge}
                    </span>

                    <span className={`text-sm font-black mt-2.5 border px-4 py-1 rounded-full ${isDark ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' : 'text-amber-700 bg-amber-50 border-amber-250'}`}>
                      {getMetricString(podiumTop3[0])}
                    </span>
                  </div>

                  {/* Pedestal Step */}
                  <div className={`hidden md:flex w-32 h-28 border-t-2 border-x rounded-t-2xl items-center justify-center font-black text-lg ${isDark ? 'from-amber-400/20 to-amber-500/5 bg-gradient-to-b border-amber-400/30 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.1)]' : 'bg-amber-100 border-amber-300 text-amber-700 shadow-[0_4px_10px_rgba(0,0,0,0.05)]'}`}>I</div>
                </motion.div>
              );
            })()}

            {/* Podium 3rd Place (Bronze) */}
            {podiumTop3[2] && (() => {
              const level = getXPLevel(podiumTop3[2].points);
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="order-3 flex flex-col items-center w-full"
                >
                  {/* Floating User details above pedestal (No enclosing card!) */}
                  <div className="flex flex-col items-center mb-3 text-center">
                    <span className="text-amber-700 font-extrabold text-[10px] uppercase tracking-wider bg-amber-700/10 px-3 py-1 rounded-full border border-amber-700/20 mb-2">🥉 3rd Place</span>
                    <div 
                      onClick={() => podiumTop3[2]?.uid && navigate(`/profile/${podiumTop3[2].uid}`)} 
                      className="flex flex-col items-center hover:scale-105 transition-transform duration-200 cursor-pointer"
                    >
                      <div className="relative">
                        {renderAvatar(podiumTop3[2].photoURL, "w-16 h-16 text-3xl")}
                        <span className="absolute -bottom-1 -right-1 flex items-center justify-center w-6 h-6 bg-amber-700 border-2 border-[#0A0A0C] text-white rounded-full text-xs font-bold shadow-lg shadow-black/40">🥉</span>
                      </div>
                      <h4 className={`font-extrabold text-sm mt-3 hover:text-indigo-400 transition-colors duration-200 ${isDark ? 'text-white' : 'text-slate-800'}`}>{podiumTop3[2].displayName}</h4>
                    </div>
                    <span className={`text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>{getBranchLabel(podiumTop3[2].branch)}</span>
                    
                    {/* XP Level Badge */}
                    <span className={`text-[9px] font-extrabold tracking-wider px-2 py-0.5 rounded border bg-gradient-to-r ${level.color} mt-2 shadow-sm`}>
                      {level.badge}
                    </span>

                    <span className={`text-xs font-bold mt-2.5 border px-3 py-0.5 rounded-full ${isDark ? 'text-slate-400 bg-white/5 border-white/[0.04]' : 'text-amber-700 bg-amber-50 border-amber-200'}`}>
                      {getMetricString(podiumTop3[2])}
                    </span>
                  </div>

                  {/* Pedestal Step */}
                  <div className={`hidden md:flex w-24 h-8 border-t-2 border-x rounded-t-2xl items-center justify-center font-black text-sm ${isDark ? 'from-amber-700/15 to-amber-800/5 bg-gradient-to-b border-amber-700/20 text-amber-700 shadow-[0_0_10px_rgba(180,83,9,0.04)]' : 'bg-amber-100/50 border-amber-300 text-amber-800 shadow-[0_4px_10px_rgba(0,0,0,0.05)]'}`}>III</div>
                </motion.div>
              );
            })()}

          </div>
        )}

        {/* Filter Controls Panel */}
        <GlassPanel className="bg-[#121218]/30 light-mode:bg-white/60 border border-white/[0.08] light-mode:border-slate-200/50 p-5 rounded-2xl flex flex-col md:flex-row items-center gap-4 text-left">
          
          {/* Metric Sort Tabs */}
          <div className="flex-1 w-full flex items-center gap-1 p-1 bg-white/[0.02] border border-white/[0.04] rounded-xl">
            <button
              onClick={() => setSortBy('points')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                sortBy === 'points' ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              XP Points
            </button>
            <button
              onClick={() => setSortBy('uploads')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                sortBy === 'uploads' ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Notes Uploaded
            </button>
            <button
              onClick={() => setSortBy('cgpa')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                sortBy === 'cgpa' ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Academic CGPA
            </button>
          </div>

          <div className="w-full md:w-auto flex flex-col md:flex-row items-center gap-3">
            {/* Department Dropdown */}
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className={`w-full md:w-44 border text-white rounded-xl py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-bold ${isDark ? 'bg-slate-900 border-white/[0.08] text-white' : 'bg-white border-slate-200 text-slate-800'}`}
            >
              <option value="all" className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-850'}>🌐 All Departments</option>
              {dbBranches.length > 0 ? (
                dbBranches.map((b) => (
                  <option key={b.id} value={b.id} className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-850'}>
                    {b.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="cse" className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-850'}>💻 CSE</option>
                  <option value="aiml" className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-850'}>🧠 AI & ML</option>
                  <option value="ds" className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-850'}>📊 DS</option>
                  <option value="ece" className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-850'}>🔌 ECE</option>
                  <option value="mechanical" className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-850'}>⚙️ Mechanical</option>
                  <option value="civil" className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-850'}>🏗️ Civil</option>
                </>
              )}
            </select>

            {/* Search Input */}
            <div className="relative w-full md:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="text"
                placeholder="Search peers by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full border rounded-xl py-2.5 pl-9 pr-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-bold placeholder:text-slate-500 ${isDark ? 'bg-[#1A1A24]/60 border-white/[0.08] text-white' : 'bg-white border-slate-200 text-slate-800'}`}
              />
            </div>
          </div>

        </GlassPanel>

        {/* Remainder Rankings List */}
        <div className="text-left space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} height={60} className="w-full rounded-xl" />
              ))}
            </div>
          ) : processedList.length === 0 ? (
            <div className={`p-8 text-center font-bold text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              No matching records found for current filters.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              
              {/* Leaderboard Row Header */}
              <div className={`px-5 py-2 flex items-center text-[10px] font-extrabold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                <span className="w-12">Rank</span>
                <span className="flex-1 pl-4">Student</span>
                <span className="w-24 text-center">Class</span>
                <span className="w-28 text-center">Department</span>
                <span className="w-20 text-center">CGPA</span>
                <span className="w-24 text-right">Score</span>
              </div>

              {/* Rows */}
              {remainderList.map((peer, idx) => {
                const isMe = peer.uid === user?.uid;
                const rankNum = idx + 4;
                const level = getXPLevel(peer.points);
                const progressPct = getXPProgress(peer.points);
                
                return (
                  <motion.div
                    key={peer.uid}
                    layout
                    transition={{ type: 'spring', stiffness: 220, damping: 25 }}
                    className="w-full"
                  >
                    <GlassPanel
                      className={`px-5 py-3.5 flex items-center border hover:scale-[1.005] duration-200 ${
                        isMe 
                          ? isDark 
                            ? 'bg-indigo-600/10 border-indigo-500/30 text-white shadow shadow-indigo-950/10' 
                            : 'bg-indigo-50 border-indigo-250 text-indigo-900 shadow shadow-indigo-100/50' 
                          : isDark 
                            ? 'bg-[#121218]/30 border-white/[0.04] text-white' 
                            : 'bg-white border-slate-100 shadow-sm text-slate-800'
                      }`}
                    >
                      {/* Rank Badge */}
                      <span className={`w-12 text-sm font-extrabold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        #{rankNum}
                      </span>

                      {/* Student Info */}
                      <div 
                        onClick={() => peer.uid && navigate(`/profile/${peer.uid}`)} 
                        className="flex-1 pl-4 flex items-center gap-3 min-w-0 hover:translate-x-0.5 transition-transform duration-200 cursor-pointer group"
                      >
                        {renderAvatar(peer.photoURL, "w-9 h-9 text-lg")}
                        <div className="min-w-0 text-left">
                          <span className={`font-extrabold text-xs leading-none flex items-center gap-1.5 group-hover:text-indigo-500 transition-colors ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            {peer.displayName}
                            {isMe && <span className="text-[8px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-500 border border-indigo-500/30 font-extrabold">YOU</span>}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`block text-[10px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>@{peer.username}</span>
                            <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded border bg-gradient-to-r ${level.color}`}>
                              {level.badge}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Class Year */}
                      <span className={`w-24 text-center text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {peer.year} Year
                      </span>

                      {/* Department tag */}
                      <div className="w-28 flex justify-center">
                        <span className={`text-[10px] font-extrabold tracking-wider px-2 py-0.5 rounded-full border ${isDark ? 'border-white/[0.04] bg-white/[0.02] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                          {getBranchLabel(peer.branch)}
                        </span>
                      </div>

                      {/* CGPA */}
                      <span className={`w-20 text-center text-xs font-extrabold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {peer.cgpa > 0 ? peer.cgpa.toFixed(2) : 'N/A'}
                      </span>

                      {/* Sorted score metric + Level Progress Bar */}
                      <div className="w-24 flex flex-col items-end gap-1 pl-2">
                        <span className={`text-xs font-extrabold flex items-center justify-end gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                          {sortBy === 'points' && <Award className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />}
                          {sortBy === 'uploads' && <BookOpen className="w-3.5 h-3.5 text-indigo-400" />}
                          {sortBy === 'cgpa' && <ArrowUp className="w-3.5 h-3.5 text-indigo-400 animate-bounce-slow" />}
                          {getMetricString(peer)}
                        </span>
                        {sortBy === 'points' && (
                          <div className={`w-16 h-1 border rounded-full overflow-hidden ${isDark ? 'bg-slate-950/80 border-white/5' : 'bg-slate-200 border-slate-300'}`} title={`${progressPct}% towards next level`}>
                            <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${progressPct}%` }} />
                          </div>
                        )}
                      </div>
                    </GlassPanel>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Leaderboard;
