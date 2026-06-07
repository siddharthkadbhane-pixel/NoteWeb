import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { GlassPanel } from '../components/ui/GlassPanel';
import { motion } from 'framer-motion';
import { 
  Trophy, 
  Sparkles, 
  MessageSquare, 
  ThumbsUp, 
  UploadCloud, 
  RefreshCw, 
  Calendar, 
  CheckCircle2, 
  Flame, 
  Target, 
  ChevronRight,
  BookOpen,
  Check
} from 'lucide-react';
import { getDailyQuests, claimQuestReward, restartQuests, type Quest } from '../utils/quests';
import { playSuccessSound } from '../utils/sounds';

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

export const Quests: React.FC = () => {
  const { user, userProfile, updatePoints, isGuest } = useAuth();
  const { isDark } = useTheme();
  const { success, error, info } = useToast();
  const navigate = useNavigate();

  const [questsList, setQuestsList] = useState<Quest[]>([]);
  const [timeLeft, setTimeLeft] = useState<string>('00h 00m 00s');
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // Compute countdown timer until local midnight (hour and minute precision to prevent ticking anxiety)
  const updateCountdown = () => {
    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const diff = tomorrow.getTime() - now.getTime();
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    const format = (num: number) => String(num).padStart(2, '0');
    setTimeLeft(`${format(hours)}h ${format(minutes)}m`);
  };

  // Sync data & event listener
  useEffect(() => {
    if (!user) return;
    
    // Load initial quests
    setQuestsList(getDailyQuests(user.uid));
    
    // Handle updates across pages
    const handleUpdate = () => {
      setQuestsList(getDailyQuests(user.uid));
    };

    window.addEventListener('noteweb-quests-updated', handleUpdate);
    
    // Timer running
    updateCountdown();
    const interval = setInterval(updateCountdown, 30000); // Update every 30 seconds

    return () => {
      window.removeEventListener('noteweb-quests-updated', handleUpdate);
      clearInterval(interval);
    };
  }, [user]);

  const handleClaimReward = async (questId: string) => {
    if (isGuest) {
      info('Guest accounts cannot claim quest rewards.');
      return;
    }
    
    setClaimingId(questId);
    try {
      const targetQuest = questsList.find(q => q.id === questId);
      const xpReward = targetQuest ? targetQuest.xpReward : 0;

      await claimQuestReward(questId, updatePoints);
      
      playSuccessSound();
      success(`Claimed +${xpReward} XP reward! Great work! 🚀`);
      
      if (user) {
        setQuestsList(getDailyQuests(user.uid));
      }
    } catch (err: any) {
      error(err.message || 'Failed to claim reward');
    } finally {
      setClaimingId(null);
    }
  };

  const handleRestartQuests = () => {
    if (!user) return;
    const confirmReset = window.confirm('Are you sure you want to restart all daily quests? This will reset all checklist progress back to 0 so you can do them again to earn more points.');
    if (!confirmReset) return;
    
    const resetList = restartQuests(user.uid);
    setQuestsList(resetList);
    success('Daily quests restarted successfully! Earn more points! 🚀');
  };

  const getQuestIcon = (id: string) => {
    switch (id) {
      case 'daily-login':
        return <Calendar className="w-5 h-5 text-orange-400" />;
      case 'read-notes':
        return <BookOpen className="w-5 h-5 text-sky-400" />;
      case 'send-chat':
        return <MessageSquare className="w-5 h-5 text-indigo-400" />;
      case 'like-note':
        return <ThumbsUp className="w-5 h-5 text-pink-400" />;
      case 'ask-ai':
        return <Sparkles className="w-5 h-5 text-purple-400" />;
      case 'upload-note':
        return <UploadCloud className="w-5 h-5 text-emerald-400" />;
      default:
        return <Target className="w-5 h-5 text-indigo-400" />;
    }
  };

  const getQuestColor = (id: string) => {
    switch (id) {
      case 'daily-login':
        return 'from-orange-500/10 to-amber-500/5 border-orange-500/20 glow-orange';
      case 'read-notes':
        return 'from-sky-500/10 to-blue-500/5 border-sky-500/20 glow-sky';
      case 'send-chat':
        return 'from-indigo-500/10 to-purple-500/5 border-indigo-500/20 glow-indigo';
      case 'like-note':
        return 'from-pink-500/10 to-rose-500/5 border-pink-500/20 glow-pink';
      case 'ask-ai':
        return 'from-purple-500/10 to-fuchsia-500/5 border-purple-500/20 glow-purple';
      case 'upload-note':
        return 'from-emerald-500/10 to-teal-500/5 border-emerald-500/20 glow-emerald';
      default:
        return 'from-indigo-500/10 to-blue-500/5 border-indigo-500/20';
    }
  };

  const getQuestRedirect = (id: string) => {
    switch (id) {
      case 'read-notes':
      case 'like-note':
      case 'ask-ai':
        return '/feed';
      case 'send-chat':
        return '/chat';
      case 'upload-note':
        return '/upload';
      default:
        return '/';
    }
  };

  const getQuestRedirectLabel = (id: string) => {
    switch (id) {
      case 'read-notes':
      case 'like-note':
      case 'ask-ai':
        return 'Go to Library';
      case 'send-chat':
        return 'Go to Lounge';
      case 'upload-note':
        return 'Go to Upload';
      default:
        return 'Navigate';
    }
  };

  const points = userProfile?.points || 0;
  const levelDetails = getXPLevel(points);
  const progressPercent = getXPProgress(points);

  return (
    <div className="w-full py-8 px-4 md:px-8 relative overflow-hidden text-left">
      {/* Background glow visual accents */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse pointer-events-none" />
      
      <div className="max-w-4xl mx-auto z-10 relative flex flex-col gap-8">
        
        {/* Header Section */}
        <div className="text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-6 border-b border-white/[0.05] pb-6">
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-4 shadow-lg shadow-indigo-500/5">
              <Trophy className="w-6 h-6 animate-bounce-slow" />
            </div>
            <h2 className={`text-3xl font-extrabold tracking-tight flex items-center justify-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              Daily Quests & Tasks
              <Sparkles className="w-5 h-5 text-amber-400" />
            </h2>
            <p className={`mt-2 text-sm max-w-lg ${isDark ? 'text-slate-400' : 'text-slate-650'}`}>
              Complete daily academic activities to earn bonus XP points and rise higher on the campus leaderboard ranks!
            </p>
          </div>

          {/* Reset Timer PNL */}
          <GlassPanel className="p-4 px-6 rounded-2xl flex flex-col items-center md:items-end justify-center bg-[#101018]/40 border border-white/[0.06] text-center md:text-right">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-550 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
              Resetting In
            </span>
            <span className="text-xl font-mono font-black text-rose-400 mt-1">
              {timeLeft}
            </span>
          </GlassPanel>
        </div>

        {/* Dashboard XP Progress panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Level standing card */}
          <GlassPanel className="md:col-span-2 p-6 rounded-3xl border border-white/[0.06] bg-gradient-to-br from-[#0F0F1A]/80 to-[#070710]/95 flex flex-col justify-between shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Current Standing</span>
                <span className={`text-2xl font-black mt-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {userProfile?.displayName || 'Student'}
                </span>
                <span className={`text-[10px] font-semibold tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-500'} mt-0.5`}>
                  @{userProfile?.username || 'username'}
                </span>
              </div>
              
              <div className={`px-4 py-1.5 rounded-xl border bg-gradient-to-r ${levelDetails.color} font-extrabold text-xs shadow-lg shadow-black/25 flex items-center justify-center`}>
                {levelDetails.badge}
              </div>
            </div>

            <div className="mt-8">
              <div className="flex justify-between items-end text-xs mb-2">
                <span className={`font-black tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>Level Progress</span>
                <span className="font-extrabold text-indigo-400">{points} XP Total</span>
              </div>
              
              {/* Progress bar container */}
              <div className={`w-full h-3.5 border rounded-full p-[2px] overflow-hidden ${isDark ? 'bg-slate-950/80 border-white/5' : 'bg-slate-100 border-slate-300'}`}>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-[#00F2FE] via-[#7F00FF] to-[#FF007F] rounded-full shadow-[0_0_12px_rgba(127,0,255,0.4)]"
                />
              </div>
              
              <p className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-500'} mt-2.5 text-right`}>
                {progressPercent}% completed towards the next level rank
              </p>
            </div>
          </GlassPanel>

          {/* Quick stats panel */}
          <GlassPanel className="p-6 rounded-3xl border border-white/[0.06] bg-[#0E0E15]/50 flex flex-col justify-between shadow-xl">
            <div className="flex flex-col text-left">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Total Completed</span>
              <span className={`text-4xl font-black mt-2 font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {questsList.filter(q => q.claimed || q.completed).length} / {questsList.length}
              </span>
              <p className={`text-[11px] font-semibold leading-relaxed mt-2 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                Complete all daily tasks to optimize your leaderboard rankings standouts.
              </p>
            </div>

            <div className={`mt-6 p-3 bg-white/[0.02] border border-white/[0.04] rounded-2xl flex items-center justify-between text-left`}>
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-500 animate-pulse" />
                <span className={`text-xs font-black uppercase ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Attendance Streak</span>
              </div>
              <span className={`text-sm font-black font-mono ${isDark ? 'text-white' : 'text-slate-850'}`}>
                {questsList.find(q => q.id === 'daily-login')?.claimed ? '1 Day' : '0 Days'}
              </span>
            </div>
          </GlassPanel>

        </div>

        {/* Quests Checklist Title */}
        <div className="flex items-center justify-between text-left mt-4 pb-2 border-b border-white/[0.04]">
          <h3 className={`text-base font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-750'}`}>
            Today's Checklist
          </h3>
          <span className={`text-xs font-bold ${isDark ? 'text-slate-550' : 'text-slate-500'}`}>
            Daily resets occur at 00:00 midnight
          </span>
        </div>

        {/* Quests Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left">
          {questsList.map((quest) => {
            const isCompleted = quest.completed;
            const isClaimed = quest.claimed;
            const isClaimable = isCompleted && !isClaimed;
            
            return (
              <GlassPanel 
                key={quest.id}
                className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between gap-4 select-none
                  ${getQuestColor(quest.id)}
                  ${isClaimed 
                    ? 'opacity-65 border-white/[0.02] bg-white/[0.01]' 
                    : isCompleted 
                      ? 'border-emerald-500/25 bg-emerald-500/[0.02] shadow-[0_0_15px_rgba(16,185,129,0.04)]' 
                      : 'hover:scale-[1.015]'
                  }
                `}
              >
                {/* Top Info */}
                <div className="flex gap-3.5 items-start">
                  <div className={`p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex-shrink-0 flex items-center justify-center`}>
                    {getQuestIcon(quest.id)}
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col text-left">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={`text-sm font-extrabold truncate ${isDark ? 'text-white' : 'text-slate-800'} ${isClaimed ? 'line-through text-slate-500' : ''}`}>
                        {quest.title}
                      </h4>
                      <span className={`text-[10px] font-black tracking-wide px-2 py-0.5 rounded-md border flex-shrink-0
                        ${isClaimed 
                          ? 'border-slate-800 text-slate-550 bg-slate-900/40' 
                          : 'border-indigo-500/30 text-indigo-400 bg-indigo-500/10'
                        }
                      `}>
                        +{quest.xpReward} XP
                      </span>
                    </div>
                    
                    <p className={`text-[11px] font-semibold leading-relaxed mt-1 ${isClaimed ? 'text-slate-550' : (isDark ? 'text-slate-450' : 'text-slate-550')}`}>
                      {quest.description}
                    </p>
                  </div>
                </div>

                {/* Bottom Bar: Progress & Action Button */}
                <div className="flex items-center justify-between gap-4 border-t border-white/[0.04] pt-3.5 mt-1">
                  
                  {/* Progress Indicator */}
                  <div className="flex flex-col gap-1 items-start">
                    <span className={`text-[9px] font-black uppercase tracking-wider ${isClaimed ? 'text-slate-550' : (isDark ? 'text-slate-500' : 'text-slate-555')}`}>Progress</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-black font-mono ${isClaimed ? 'text-slate-500' : (isCompleted ? 'text-emerald-400' : (isDark ? 'text-slate-300' : 'text-slate-700'))}`}>
                        {quest.progress} / {quest.maxProgress}
                      </span>
                      {isCompleted && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </div>
                  </div>

                  {/* Button Trigger */}
                  {isClaimed ? (
                    <div className={`px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5`}>
                      <Check className="w-3.5 h-3.5" />
                      Claimed
                    </div>
                  ) : isClaimable ? (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleClaimReward(quest.id)}
                      disabled={claimingId === quest.id}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-[10px] uppercase tracking-widest shadow-lg shadow-orange-500/20 cursor-pointer transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                    >
                      {claimingId === quest.id ? (
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>Claim Reward</>
                      )}
                    </motion.button>
                  ) : (
                    <button
                      onClick={() => navigate(getQuestRedirect(quest.id))}
                      className={`px-3.5 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer hover:bg-white/[0.04] active:scale-95 flex items-center justify-center gap-1
                        ${isDark 
                          ? 'border-white/[0.08] text-slate-350 bg-white/[0.02]' 
                          : 'border-slate-200 text-slate-700 bg-slate-50'
                        }
                      `}
                    >
                      <span>{getQuestRedirectLabel(quest.id)}</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}

                </div>

              </GlassPanel>
            );
          })}
        </div>

        {/* Manual Reset bottom button */}
        <div className="flex justify-center mt-6">
          <button
            onClick={handleRestartQuests}
            className={`px-5 py-3 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2
              ${isDark 
                ? 'border-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]' 
                : 'border-slate-200 text-slate-550 hover:text-slate-800 hover:bg-slate-100'
              }
            `}
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
            Restart Daily Quests
          </button>
        </div>

      </div>
    </div>
  );
};

export default Quests;
