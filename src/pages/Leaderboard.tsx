import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/config';
import { useAuth } from '../context/AuthContext';
import { renderAvatar } from './Login';
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
  computers: 'CSE',
  electronics: 'ECE',
  mechanical: 'Mech/Civil',
  maths: 'Maths',
  science: 'Sciences',
  management: 'Humanities'
};

export const Leaderboard: React.FC = () => {
  const { user } = useAuth();
  
  const [usersList, setUsersList] = useState<LeaderboardUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'points' | 'uploads' | 'cgpa'>('points');
  const [isLoading, setIsLoading] = useState(true);

  const fetchLeaderboardData = async () => {
    setIsLoading(true);
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
          branch: p.branch || 'computers',
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
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboardData();
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
    <div className="min-h-screen w-full py-12 px-4 md:px-8 relative overflow-hidden bg-[#0A0A0C]">
      {/* Background visual accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse" />

      <div className="max-w-5xl mx-auto z-10 relative flex flex-col gap-8">
        
        {/* Title Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-4 shadow-lg shadow-indigo-500/5">
            <Trophy className="w-6 h-6 animate-bounce-slow" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            Campus Leaderboard
            <Sparkles className="w-5 h-5 text-amber-400" />
          </h2>
          <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
            Explore academic rankings, verify contributions, and see who is topping NoteWeb XP standouts!
          </p>
        </div>

        {/* Podium Top 3 Section */}
        {!isLoading && podiumTop3.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-8 max-w-3xl mx-auto w-full">
            
            {/* Podium 2nd Place (Silver) */}
            {podiumTop3[1] && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="order-2 md:order-1 flex flex-col items-center"
              >
                <GlassPanel className="w-full bg-[#121218]/40 border-slate-400/20 p-5 rounded-2xl flex flex-col items-center relative overflow-hidden">
                  <div className="absolute top-2 right-2 text-slate-400 font-extrabold text-sm">#2</div>
                  <div className="relative">
                    {renderAvatar(podiumTop3[1].photoURL, "w-16 h-16 text-3xl")}
                    <span className="absolute -bottom-1 -right-1 flex items-center justify-center w-6 h-6 bg-slate-400 border border-white text-white rounded-full text-xs font-bold shadow">🥈</span>
                  </div>
                  <h4 className="font-extrabold text-white text-sm mt-3 truncate w-full text-center">{podiumTop3[1].displayName}</h4>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">{BRANCH_LABELS[podiumTop3[1].branch]}</span>
                  <span className="text-sm font-bold text-slate-300 mt-2 bg-slate-400/10 px-3 py-1 rounded-full border border-slate-400/20">
                    {getMetricString(podiumTop3[1])}
                  </span>
                </GlassPanel>
                <div className="hidden md:block w-24 h-12 bg-slate-400/15 border-t border-slate-400/30 rounded-t-xl mt-1.5 flex items-center justify-center font-extrabold text-slate-400">II</div>
              </motion.div>
            )}

            {/* Podium 1st Place (Gold) */}
            {podiumTop3[0] && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="order-1 md:order-2 flex flex-col items-center scale-105"
              >
                <GlassPanel className="w-full bg-[#121218]/50 border-amber-400/30 p-6 rounded-3xl flex flex-col items-center relative overflow-hidden shadow-xl shadow-amber-400/5">
                  <div className="absolute top-2 right-2 text-amber-400 font-extrabold text-sm">#1</div>
                  <div className="relative">
                    {renderAvatar(podiumTop3[0].photoURL, "w-20 h-20 text-4xl")}
                    <span className="absolute -bottom-1 -right-1 flex items-center justify-center w-7 h-7 bg-amber-400 border border-white text-white rounded-full text-sm font-bold shadow">👑</span>
                  </div>
                  <h4 className="font-extrabold text-white text-base mt-3 truncate w-full text-center">{podiumTop3[0].displayName}</h4>
                  <span className="text-[10px] text-amber-300 font-semibold uppercase tracking-wider mt-0.5">{BRANCH_LABELS[podiumTop3[0].branch]}</span>
                  <span className="text-base font-black text-amber-400 mt-3 bg-amber-400/10 px-4 py-1.5 rounded-full border border-amber-400/20">
                    {getMetricString(podiumTop3[0])}
                  </span>
                </GlassPanel>
                <div className="hidden md:block w-28 h-20 bg-amber-400/15 border-t border-amber-400/30 rounded-t-xl mt-1.5 flex items-center justify-center font-extrabold text-amber-400">I</div>
              </motion.div>
            )}

            {/* Podium 3rd Place (Bronze) */}
            {podiumTop3[2] && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="order-3 flex flex-col items-center"
              >
                <GlassPanel className="w-full bg-[#121218]/40 border-amber-700/20 p-5 rounded-2xl flex flex-col items-center relative overflow-hidden">
                  <div className="absolute top-2 right-2 text-amber-700 font-extrabold text-sm">#3</div>
                  <div className="relative">
                    {renderAvatar(podiumTop3[2].photoURL, "w-16 h-16 text-3xl")}
                    <span className="absolute -bottom-1 -right-1 flex items-center justify-center w-6 h-6 bg-amber-700 border border-white text-white rounded-full text-xs font-bold shadow">🥉</span>
                  </div>
                  <h4 className="font-extrabold text-white text-sm mt-3 truncate w-full text-center">{podiumTop3[2].displayName}</h4>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">{BRANCH_LABELS[podiumTop3[2].branch]}</span>
                  <span className="text-sm font-bold text-amber-700 mt-2 bg-amber-700/10 px-3 py-1 rounded-full border border-amber-700/20">
                    {getMetricString(podiumTop3[2])}
                  </span>
                </GlassPanel>
                <div className="hidden md:block w-24 h-8 bg-amber-700/15 border-t border-amber-700/30 rounded-t-xl mt-1.5 flex items-center justify-center font-extrabold text-amber-700">III</div>
              </motion.div>
            )}

          </div>
        )}

        {/* Filter Controls Panel */}
        <GlassPanel className="bg-[#121218]/30 border border-white/[0.08] p-5 rounded-2xl flex flex-col md:flex-row items-center gap-4 text-left">
          
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
              className="w-full md:w-44 bg-slate-900 border border-white/[0.08] text-white rounded-xl py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-bold"
            >
              <option value="all">🌐 All Departments</option>
              <option value="computers">💻CSE CSE</option>
              <option value="electronics">🔌 ECE</option>
              <option value="mechanical">⚙️ Mech/Civil</option>
              <option value="maths">📐 Maths</option>
              <option value="science">🔬 Sciences</option>
              <option value="management">📊 Humanities</option>
            </select>

            {/* Search Input */}
            <div className="relative w-full md:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="text"
                placeholder="Search peers by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1A1A24]/60 border border-white/[0.08] text-white rounded-xl py-2.5 pl-9 pr-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-bold placeholder:text-slate-500"
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
            <div className="p-8 text-center text-slate-500 font-bold text-xs">
              No matching records found for current filters.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              
              {/* Leaderboard Row Header */}
              <div className="px-5 py-2 flex items-center text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
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
                return (
                  <GlassPanel
                    key={peer.uid}
                    className={`px-5 py-3.5 flex items-center border hover:border-white/10 ${
                      isMe 
                        ? 'bg-indigo-600/10 border-indigo-500/30 shadow shadow-indigo-600/5' 
                        : 'bg-[#121218]/30 border-white/[0.04]'
                    }`}
                  >
                    {/* Rank Badge */}
                    <span className="w-12 text-sm font-extrabold text-slate-400">
                      #{rankNum}
                    </span>

                    {/* Student Info */}
                    <div className="flex-1 pl-4 flex items-center gap-3 min-w-0">
                      {renderAvatar(peer.photoURL, "w-9 h-9 text-lg")}
                      <div className="min-w-0">
                        <span className="font-extrabold text-white text-xs leading-none flex items-center gap-1.5">
                          {peer.displayName}
                          {isMe && <span className="text-[8px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">YOU</span>}
                        </span>
                        <span className="block text-[10px] text-slate-500 font-semibold mt-0.5">@{peer.username}</span>
                      </div>
                    </div>

                    {/* Class Year */}
                    <span className="w-24 text-center text-xs font-bold text-slate-400">
                      {peer.year} Year
                    </span>

                    {/* Department tag */}
                    <div className="w-28 flex justify-center">
                      <span className="text-[10px] font-extrabold tracking-wider px-2 py-0.5 rounded-full border border-white/[0.04] bg-white/[0.02] text-slate-400">
                        {BRANCH_LABELS[peer.branch] || 'CSE'}
                      </span>
                    </div>

                    {/* CGPA */}
                    <span className="w-20 text-center text-xs font-extrabold text-slate-400">
                      {peer.cgpa > 0 ? peer.cgpa.toFixed(2) : 'N/A'}
                    </span>

                    {/* Sorted score metric */}
                    <div className="w-24 text-right">
                      <span className="text-xs font-extrabold text-white flex items-center justify-end gap-1.5">
                        {sortBy === 'points' && <Award className="w-3.5 h-3.5 text-indigo-400" />}
                        {sortBy === 'uploads' && <BookOpen className="w-3.5 h-3.5 text-indigo-400" />}
                        {sortBy === 'cgpa' && <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />}
                        {getMetricString(peer)}
                      </span>
                    </div>

                  </GlassPanel>
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
