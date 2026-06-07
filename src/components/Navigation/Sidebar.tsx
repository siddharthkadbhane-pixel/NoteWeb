import React, { useState } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Home as HomeIcon, 
  BookOpen, 
  Grid, 
  UploadCloud, 
  User, 
  ShieldAlert, 
  Info, 
  LogOut, 
  Moon, 
  Sun, 
  Menu, 
  X,
  MessageSquare,
  Trophy,
  Star,
  Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { renderAvatar } from '../../utils/avatar';
import { playTapSound } from '../../utils/sounds';

export const NoteWebLogo: React.FC<{ sizeClass?: string; isMobile?: boolean }> = ({ sizeClass = "w-9 h-9", isMobile = false }) => {
  return (
    <div className={`relative ${sizeClass} flex-shrink-0 flex items-center justify-center group/logo`}>
      {/* Outer pulsing glow */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-[#00F2FE] via-[#7F00FF] to-[#FF007F] opacity-40 blur-[8px] animate-pulse" />
      
      {/* Inner premium container */}
      <div className={`absolute inset-0 rounded-xl bg-[#0F0F1A]/90 border border-white/20 backdrop-blur-md flex items-center justify-center shadow-inner group-hover/logo:rotate-6 transition-transform duration-500 ${isMobile ? 'scale-90' : ''}`}>
        <svg viewBox="0 0 100 100" className="w-5.5 h-5.5 drop-shadow-[0_0_6px_rgba(127,0,255,0.7)]">
          <defs>
            <linearGradient id="logoGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00F2FE" />
              <stop offset="50%" stopColor="#9d4edd" />
              <stop offset="100%" stopColor="#FF007F" />
            </linearGradient>
          </defs>
          {/* Futuristic sharp ribbon letter "N" and "W" */}
          <path
            d="M26,74 L26,26 L48,56 L70,26 L70,74"
            fill="none"
            stroke="url(#logoGrad)"
            strokeWidth="13"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Centered glowing premium core */}
          <circle cx="48" cy="28" r="6" fill="#00F2FE" className="animate-ping" />
          <circle cx="48" cy="28" r="4.5" fill="#FFF" />
        </svg>
      </div>
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const { user, userProfile, isAdmin, isGuest, logout, isMockMode } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { success, error } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [isLauncherOpen, setIsLauncherOpen] = useState(false);

  const [isLargeScreen, setIsLargeScreen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isNative = typeof window !== 'undefined' && (
    typeof (window as any).Capacitor !== 'undefined' || 
    /android|iphone|ipad|ipod|capacitor/i.test(navigator.userAgent)
  );

  const showMobileUI = isNative || !isLargeScreen;

  const handleLogout = async () => {
    try {
      await logout();
      success(isGuest ? 'Exited guest session successfully' : 'Logged out successfully');
      navigate('/login');
    } catch (e) {
      error(isGuest ? 'Failed to exit guest session' : 'Failed to log out');
    }
  };

  const navItems = [
    { to: '/', label: 'Home', icon: <HomeIcon className="w-4 h-4" /> },
    { to: '/feed', label: 'Library', icon: <BookOpen className="w-4 h-4" /> },
    { to: '/categories', label: 'Departments', icon: <Grid className="w-4 h-4" /> },
    { to: '/upload', label: 'Upload', icon: <UploadCloud className="w-4 h-4" /> },
    { to: '/chat', label: 'Campus Chat', icon: <MessageSquare className="w-4 h-4 text-indigo-400" />, protected: true },
    { to: '/quests', label: 'Daily Quests', icon: <Target className="w-4 h-4 text-[#00F2FE]" />, protected: true },
    { to: '/leaderboard', label: 'Rankings', icon: <Trophy className="w-4 h-4 text-amber-400" />, protected: true },
    { to: '/profile', label: 'Dashboard', icon: <User className="w-4 h-4" />, protected: true },
    { to: '/feedback', label: 'Feedback', icon: <Star className="w-4 h-4 text-amber-400" />, protected: true },
    { to: '/admin', label: 'Admin', icon: <ShieldAlert className="w-4 h-4 text-rose-400" />, protected: true, adminOnly: true },
  ];

  const visibleItems = navItems.filter(item => {
    if (item.adminOnly) return isAdmin && !isGuest;
    if (item.protected) return !!user && !isGuest;
    return true;
  });

  return (
    <>
      {/* ════════════════════════════════════════════════════════════
         DESKTOP: RETRACTABLE LEFT COMMANDER DOCK (lg+)
         ════════════════════════════════════════════════════════════ */}
      {!showMobileUI && (
        <aside
          className={`
            hidden lg:flex fixed left-4 top-4 bottom-4 w-14 hover:w-56
            rounded-2xl border z-50 flex-col justify-between py-4 px-2
            shadow-[0_20px_60px_rgba(0,0,0,0.6)]
            group transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
            select-none overflow-hidden
            ${isDark
              ? 'bg-[#070710]/90 border-white/[0.06] backdrop-blur-2xl'
              : 'bg-white/45 border-white/60 backdrop-blur-3xl shadow-[0_20px_60px_rgba(15,23,42,0.06)]'
            }
          `}
        >
          {/* Brand Logo */}
          <div className={`flex items-center gap-3 px-1.5 pb-3 mb-1 border-b flex-shrink-0 ${isDark ? 'border-white/[0.05]' : 'border-slate-200/60'}`}>
            <Link to="/" className="active:scale-95 transition-all flex-shrink-0">
              <NoteWebLogo sizeClass="w-9 h-9" />
            </Link>
            <span className={`
              opacity-0 translate-x-2 pointer-events-none whitespace-nowrap
              group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto
              transition-all duration-300 delay-75
              text-sm font-black tracking-tight
              ${isDark ? 'text-white' : 'text-slate-800'}
            `}>
              NoteWeb
            </span>
          </div>

          {/* Nav Links */}
          <nav className="flex-1 flex flex-col gap-1 py-2 overflow-y-auto overflow-x-hidden scrollbar-none">
            {visibleItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={playTapSound}
                className={({ isActive }) => `
                  flex items-center h-9 rounded-xl font-semibold transition-all duration-200 relative overflow-hidden
                  ${isActive
                    ? isDark
                      ? 'bg-gradient-to-r from-[#00F2FE]/10 to-[#7F00FF]/5 text-white border border-white/10'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200/70'
                    : isDark
                      ? 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.03] border border-transparent'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/80 border border-transparent'
                  }
                `}
              >
                <div className="w-9 h-9 flex items-center justify-center flex-shrink-0">
                  {item.icon}
                </div>
                <span className="opacity-0 translate-x-2 whitespace-nowrap pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto transition-all duration-200 delay-75 text-[11px] tracking-wide pr-3">
                  {item.label}
                </span>
              </NavLink>
            ))}
          </nav>

          {/* Bottom Controls */}
          <div className={`flex flex-col gap-2 border-t pt-3 flex-shrink-0 ${isDark ? 'border-white/[0.05]' : 'border-slate-200/60'}`}>
            
            {/* Theme Toggle */}
            <button
              onClick={() => { playTapSound(); toggleTheme(); }}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className={`
                flex items-center h-9 w-full rounded-xl transition-all cursor-pointer active:scale-95 gap-3
                ${isDark
                  ? 'text-slate-400 hover:text-amber-400 hover:bg-white/[0.03] border border-transparent hover:border-white/5'
                  : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100/80 border border-transparent'
                }
              `}
            >
              <div className="w-9 h-9 flex items-center justify-center flex-shrink-0">
                {isDark
                  ? <Sun className="w-4 h-4 text-amber-400" />
                  : <Moon className="w-4 h-4 text-indigo-500" />
                }
              </div>
              <span className={`
                opacity-0 translate-x-2 whitespace-nowrap pointer-events-none
                group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto
                transition-all duration-200 delay-75 text-[10px] font-bold tracking-wide truncate pr-3
                ${isDark ? 'text-slate-300' : 'text-slate-600'}
              `}>
                {isDark ? 'Light Mode' : 'Dark Mode'}
              </span>
            </button>

            {/* Sync dot */}
            <div
              className={`flex items-center h-8 rounded-xl gap-3 ${isDark ? '' : ''}`}
              title={!isMockMode ? 'Live Synced' : 'Local Cache'}
            >
              <div className="w-9 h-9 flex items-center justify-center flex-shrink-0">
                <span className={`w-2 h-2 rounded-full ${!isMockMode ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
              </div>
              <span className={`
                opacity-0 translate-x-2 whitespace-nowrap pointer-events-none
                group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto
                transition-all duration-200 delay-75 text-[9px] font-black tracking-wider uppercase
                ${isDark ? 'text-slate-500' : 'text-slate-400'}
              `}>
                {!isMockMode ? 'Live Synced' : 'Local Cache'}
              </span>
            </div>

            {/* User / Sign In */}
            {user || isGuest ? (
              <div className={`flex items-center gap-2 p-1 rounded-xl border overflow-hidden ${isDark ? 'border-white/[0.05]' : 'border-slate-200/80 bg-slate-50/50'}`}>
                <div
                  className="w-8 h-8 min-w-[2rem] rounded-lg flex-shrink-0 flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                  onClick={() => { playTapSound(); navigate('/profile'); }}
                >
                  {isGuest
                    ? <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#7F00FF] to-[#FF007F] flex items-center justify-center text-white font-bold text-[9px]">GS</div>
                    : renderAvatar(userProfile?.photoURL || '', `w-8 h-8 text-xs rounded-lg border ${isDark ? 'border-white/10' : 'border-slate-200'}`)
                  }
                </div>
                <div className={`
                  opacity-0 translate-x-2 pointer-events-none
                  group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto
                  transition-all duration-200 delay-75 min-w-0 flex-1 flex items-center justify-between pr-1
                `}>
                  <div className="min-w-0 flex flex-col text-left">
                    <span className={`text-[10px] font-black truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {isGuest ? 'Guest' : (userProfile?.displayName || user?.displayName || 'Student')}
                    </span>
                    <span className={`text-[8px] font-bold uppercase tracking-wider mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {isGuest ? 'Guest' : (userProfile?.role || 'Student')}
                    </span>
                  </div>
                  <button
                    onClick={() => { playTapSound(); handleLogout(); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all active:scale-90 flex-shrink-0"
                    title={isGuest ? 'Exit Guest' : 'Sign Out'}
                  >
                    <LogOut className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <Link
                to="/login"
                className="flex items-center h-9 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 text-white active:scale-95 transition-all overflow-hidden"
                title="Sign In"
              >
                <div className="w-9 h-9 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="opacity-0 translate-x-2 whitespace-nowrap pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto transition-all duration-200 delay-75 font-bold text-xs pr-3">
                  Sign In
                </span>
              </Link>
            )}
          </div>
        </aside>
      )}

      {/* ════════════════════════════════════════════════════════════
         MOBILE: TOP BAR + FLOATING BOTTOM NAV + LAUNCHER OVERLAY
         ════════════════════════════════════════════════════════════ */}
      
      {/* Mobile Top Bar */}
      {showMobileUI && (
        <div className={`
          fixed top-0 left-0 right-0 h-14 px-4 flex items-center justify-between z-50 border-b
          ${isDark
            ? 'bg-[#070710]/90 border-white/[0.06] backdrop-blur-2xl'
            : 'bg-white/45 border-white/60 backdrop-blur-3xl'
          }
        `}>
          <Link to="/" className="flex items-center gap-2 active:scale-95 transition-transform">
            <NoteWebLogo sizeClass="w-7.5 h-7.5" isMobile />
            <span className={`text-sm font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>NoteWeb</span>
          </Link>
          
          <div className="flex items-center gap-2">
            {/* Theme toggle - always visible in top bar on mobile */}
            <button
              onClick={toggleTheme}
              className={`
                w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-90 cursor-pointer
                ${isDark
                  ? 'bg-white/[0.04] border border-white/[0.08] text-amber-400 hover:bg-white/[0.08]'
                  : 'bg-slate-100 border border-slate-200 text-indigo-500 hover:bg-slate-200'
                }
              `}
              title={isDark ? 'Light Mode' : 'Dark Mode'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Sync dot */}
            <div className={`
              flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider
              ${isDark
                ? 'bg-white/[0.03] border border-white/[0.05] text-slate-400'
                : 'bg-slate-100 border border-slate-200 text-slate-500'
              }
            `}>
              <span className={`w-1.5 h-1.5 rounded-full ${!isMockMode ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse flex-shrink-0`} />
              {!isMockMode ? 'LIVE' : 'CACHE'}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Floating Bottom Nav Pill */}
      {showMobileUI && (
        <nav className={`
          fixed bottom-4 left-3 right-3 h-16 rounded-2xl border z-50
          flex items-center justify-around px-2
          shadow-[0_12px_30px_rgba(0,0,0,0.4)]
          ${isDark
            ? 'bg-[#07070F]/90 border-white/[0.08] backdrop-blur-2xl'
            : 'bg-white/45 border-white/60 backdrop-blur-3xl shadow-[0_12px_30px_rgba(15,23,42,0.06)]'
          }
        `}>
          {/* Home */}
          <NavLink to="/" end onClick={playTapSound} className={({ isActive }) => `flex flex-col items-center justify-center gap-0.5 w-12 h-12 rounded-xl transition-all ${isActive ? 'scale-110' : 'active:scale-90'} ${isActive ? (isDark ? 'text-[#00F2FE]' : 'text-indigo-600') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
            <HomeIcon className="w-5 h-5" />
            <span className="text-[8px] font-black tracking-wide">Home</span>
            {location.pathname === '/' && <span className={`w-1 h-1 rounded-full ${isDark ? 'bg-[#00F2FE]' : 'bg-indigo-500'}`} />}
          </NavLink>

          {/* Library */}
          <NavLink to="/feed" onClick={playTapSound} className={({ isActive }) => `flex flex-col items-center justify-center gap-0.5 w-12 h-12 rounded-xl transition-all ${isActive ? 'scale-110' : 'active:scale-90'} ${isActive ? (isDark ? 'text-[#00F2FE]' : 'text-indigo-600') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
            <BookOpen className="w-5 h-5" />
            <span className="text-[8px] font-black tracking-wide">Library</span>
            {location.pathname === '/feed' && <span className={`w-1 h-1 rounded-full ${isDark ? 'bg-[#00F2FE]' : 'bg-indigo-500'}`} />}
          </NavLink>

          {/* Upload */}
          <NavLink to="/upload" onClick={playTapSound} className={({ isActive }) => `flex flex-col items-center justify-center gap-0.5 w-12 h-12 rounded-xl transition-all ${isActive ? 'scale-110' : 'active:scale-90'} ${isActive ? (isDark ? 'text-[#00F2FE]' : 'text-indigo-600') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
            <UploadCloud className="w-5 h-5" />
            <span className="text-[8px] font-black tracking-wide">Upload</span>
            {location.pathname === '/upload' && <span className={`w-1 h-1 rounded-full ${isDark ? 'bg-[#00F2FE]' : 'bg-indigo-500'}`} />}
          </NavLink>

          {/* Quests */}
          {user && !isGuest && (
            <NavLink to="/quests" onClick={playTapSound} className={({ isActive }) => `flex flex-col items-center justify-center gap-0.5 w-12 h-12 rounded-xl transition-all ${isActive ? 'scale-110' : 'active:scale-90'} ${isActive ? (isDark ? 'text-[#00F2FE]' : 'text-indigo-600') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
              <Target className="w-5 h-5" />
              <span className="text-[8px] font-black tracking-wide">Quests</span>
              {location.pathname === '/quests' && <span className={`w-1 h-1 rounded-full ${isDark ? 'bg-[#00F2FE]' : 'bg-indigo-500'}`} />}
            </NavLink>
          )}

          {/* More launcher */}
          <button
            onClick={() => { playTapSound(); setIsLauncherOpen(!isLauncherOpen); }}
            className={`flex flex-col items-center justify-center gap-0.5 w-12 h-12 rounded-xl transition-all cursor-pointer ${isLauncherOpen ? 'scale-110 text-[#FF007F]' : (isDark ? 'text-slate-400 active:scale-90' : 'text-slate-500 active:scale-90')}`}
          >
            {isLauncherOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            <span className="text-[8px] font-black tracking-wide">More</span>
          </button>
        </nav>
      )}

      {/* Mobile Commander Launcher Overlay */}
      {showMobileUI && (
        <AnimatePresence>
          {isLauncherOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                onClick={() => setIsLauncherOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.97 }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className={`
                  fixed bottom-24 left-3 right-3 rounded-2xl border z-50
                  p-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-y-auto max-h-[65vh] flex flex-col gap-5
                  ${isDark
                    ? 'bg-[#09090F]/98 border-white/[0.08] backdrop-blur-2xl'
                    : 'bg-white/98 border-slate-200/90 backdrop-blur-2xl'
                  }
                `}
              >
                {/* Header */}
                <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-200/80'}`}>
                  <div className="flex items-center gap-2">
                    <NoteWebLogo sizeClass="w-6.5 h-6.5" isMobile />
                    <span className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Commander Panel</span>
                  </div>
                  <button
                    onClick={() => setIsLauncherOpen(false)}
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
