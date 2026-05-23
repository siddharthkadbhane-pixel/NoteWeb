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
  Gamepad2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { renderAvatar } from '../../utils/avatar';

export const Sidebar: React.FC = () => {
  const { user, userProfile, isAdmin, isGuest, logout, isMockMode } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { success, error } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [isLauncherOpen, setIsLauncherOpen] = useState(false);

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
    { to: '/categories', label: 'Branches', icon: <Grid className="w-4 h-4" /> },
    { to: '/upload', label: 'Upload', icon: <UploadCloud className="w-4 h-4" /> },
    { to: '/quiz', label: 'Quiz Arena', icon: <Gamepad2 className="w-4 h-4 text-purple-400" /> },
    { to: '/chat', label: 'Campus Chat', icon: <MessageSquare className="w-4 h-4 text-indigo-400" />, protected: true },
    { to: '/leaderboard', label: 'Rankings', icon: <Trophy className="w-4 h-4 text-amber-400" />, protected: true },
    { to: '/profile', label: 'Dashboard', icon: <User className="w-4 h-4" />, protected: true },
    { to: '/admin', label: 'Admin', icon: <ShieldAlert className="w-4 h-4 text-rose-400" />, protected: true, adminOnly: true },
  ];

  const visibleItems = navItems.filter(item => {
    if (item.adminOnly) return isAdmin && !isGuest;
    if (item.protected) return !!user && !isGuest;
    return true;
  });

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────
         DESKTOP NAV: RETRACTABLE LEFT COMMANDER DOCK (lg and up)
         ───────────────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex fixed left-5 top-6 bottom-6 w-16 hover:w-60 rounded-3xl glass-panel border border-white/5 light-mode:border-slate-200/60 bg-[#05050A]/80 light-mode:bg-white/80 z-50 flex flex-col justify-between py-5 px-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] light-mode:shadow-[0_20px_50px_rgba(15,23,42,0.06)] premium-border-glow select-none group transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
        
        {/* Brand Logo & Icon Pod */}
        <div className="w-full flex items-center justify-start pl-2 gap-3.5 border-b border-white/[0.04] light-mode:border-slate-200/40 pb-4 flex-shrink-0">
          <Link to="/" className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#00F2FE] via-[#7F00FF] to-[#FF007F] flex items-center justify-center shadow-lg shadow-purple-600/20 flex-shrink-0 cursor-pointer active:scale-95 transition-all">
            <span className="font-extrabold text-white text-xs">N</span>
          </Link>
          <span className="opacity-0 translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto transition-all duration-300 delay-75 text-base font-black bg-gradient-to-r from-white via-[#E2E8F0] to-slate-400 light-mode:from-slate-800 light-mode:to-slate-600 bg-clip-text text-transparent tracking-tight">
            NoteWeb
          </span>
        </div>

        {/* Nav Items List - Scrollable when links overflow screen height */}
        <nav className="flex-1 flex flex-col gap-1.5 py-4 px-0.5 overflow-y-auto overflow-x-hidden scrollbar-none items-center group-hover:items-stretch">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `
                flex items-center w-10 group-hover:w-full h-10 rounded-2xl font-bold transition-all duration-300 relative group/item
                ${isActive 
                  ? 'bg-gradient-to-r from-[#00F2FE]/15 to-[#7F00FF]/5 light-mode:from-[#00F2FE]/20 light-mode:to-[#7F00FF]/10 text-white light-mode:text-[#7F00FF] border border-white/10 light-mode:border-slate-200/50 shadow-[0_4px_12px_rgba(0,242,254,0.06)]' 
                  : 'text-slate-400 light-mode:text-slate-500 hover:text-slate-100 light-mode:hover:text-slate-850 hover:bg-white/[0.02] light-mode:hover:bg-slate-900/[0.02] border border-transparent'}
              `}
            >
              <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 group-hover/item:scale-110 transition-transform duration-300">
                {item.icon}
              </div>
              <span className="opacity-0 translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto transition-all duration-300 delay-75 text-[11px] tracking-wide truncate pr-4">
                {item.label}
              </span>
              
              {/* Subtle hover indicator dot */}
              <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-[#00F2FE] opacity-0 group-hover/item:opacity-100 transition-all duration-300 pointer-events-none shadow-[0_0_8px_rgba(0,242,254,0.8)]" />
            </NavLink>
          ))}
        </nav>

        {/* System Controls Panel */}
        <div className="w-full flex flex-col gap-3 items-center justify-center border-t border-white/[0.04] light-mode:border-slate-200/40 pt-4 flex-shrink-0">
          {/* Theme Toggler Button */}
          <button
            onClick={toggleTheme}
            className="w-10 group-hover:w-full h-10 rounded-2xl border border-white/[0.04] light-mode:border-slate-200/50 bg-white/[0.01] light-mode:bg-slate-500/5 flex items-center justify-start pl-[12px] group-hover:px-3 text-slate-400 light-mode:text-slate-500 hover:text-white light-mode:hover:text-slate-900 hover:bg-white/5 light-mode:hover:bg-slate-900/5 hover:border-white/10 light-mode:hover:border-slate-300 transition-all cursor-pointer active:scale-95 gap-3.5 flex-shrink-0"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <div className="flex-shrink-0">
              {isDark ? <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" /> : <Moon className="w-4 h-4 text-indigo-400" />}
            </div>
            <span className="opacity-0 translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto transition-all duration-300 delay-75 text-[10px] font-bold text-slate-300 light-mode:text-slate-700 truncate tracking-wide">
              {isDark ? 'Light Desk' : 'Dark Desk'}
            </span>
          </button>

          {/* Sync status badge */}
          <div 
            className="w-10 group-hover:w-full h-8 rounded-2xl border border-white/[0.04] light-mode:border-slate-200/50 bg-white/[0.01] light-mode:bg-slate-500/5 flex items-center justify-start pl-[17px] group-hover:px-3.5 gap-3.5 text-slate-400 light-mode:text-slate-500 transition-all duration-300 flex-shrink-0 select-none cursor-default"
            title={!isMockMode ? 'Sync Status: Live Synced' : 'Sync Status: Local Cache'}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${!isMockMode ? 'bg-[#00FF87]' : 'bg-[#F59E0B]'} animate-pulse flex-shrink-0`} />
            <span className="opacity-0 translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto transition-all duration-300 delay-75 text-[8px] font-black tracking-wider uppercase text-slate-400 light-mode:text-slate-500 truncate">
              {!isMockMode ? 'LIVE' : 'CACHE'}
            </span>
          </div>

          {/* User Profile Capsule */}
          {user || isGuest ? (
            <div className="w-10 group-hover:w-full rounded-2xl border border-white/[0.05] light-mode:border-slate-200/60 bg-white/[0.01] light-mode:bg-slate-500/5 p-1 flex items-center gap-2.5 overflow-hidden transition-all duration-300">
              <div 
                className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center bg-white/[0.03] light-mode:bg-slate-900/5 active:scale-95 transition-transform cursor-pointer" 
                onClick={() => navigate('/profile')}
              >
                {isGuest ? (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#7F00FF] to-[#FF007F] flex items-center justify-center text-white font-extrabold text-[9px]">GS</div>
                ) : (
                  renderAvatar(userProfile?.photoURL || '', "w-8 h-8 text-xs rounded-xl border border-white/10 light-mode:border-slate-200/50")
                )}
              </div>
              <div className="opacity-0 translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto transition-all duration-300 delay-75 min-w-0 flex-1 flex items-center justify-between">
                <div className="min-w-0 flex flex-col text-left">
                  <span className="text-[10px] font-black text-slate-200 light-mode:text-slate-800 truncate">
                    {isGuest ? 'Guest' : (userProfile?.displayName || user?.displayName || 'Student')}
                  </span>
                  <span className="text-[8px] text-slate-500 light-mode:text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    {isGuest ? 'Guest' : (userProfile?.role || 'Student')}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all active:scale-90 flex-shrink-0 mr-1"
                  title={isGuest ? 'Exit Guest Session' : 'Sign Out'}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <Link
              to="/login"
              className="w-10 group-hover:w-full h-10 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 text-white flex items-center justify-center px-3 text-xs active:scale-95 transition-all flex-shrink-0"
              title="Sign In"
            >
              <User className="w-4 h-4 flex-shrink-0 text-white" />
              <span className="opacity-0 translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto transition-all duration-300 delay-75 font-bold tracking-wide truncate ml-2">
                Sign In
              </span>
            </Link>
          )}
        </div>
      </aside>

      {/* ─────────────────────────────────────────────────────────────
         MOBILE NAV: FLOATING BOTTOM PILL BAR & LAUNCHER (lg and under)
         ───────────────────────────────────────────────────────────── */}
      
      {/* Brand logo Top Bar - Fixed mini banner */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 glass-panel border-b border-white/[0.08] light-mode:border-slate-200/60 px-5 flex items-center justify-between z-40 bg-[#05050A]/90 light-mode:bg-white/90 select-none">
        <Link to="/" className="flex items-center gap-2.5 active:scale-95 transition-transform">
          <div className="w-7.5 h-7.5 rounded-xl bg-gradient-to-tr from-[#00F2FE] via-[#7F00FF] to-[#FF007F] flex items-center justify-center shadow">
            <span className="font-extrabold text-white text-[10px]">N</span>
          </div>
          <span className="text-base font-black text-white light-mode:text-slate-800 tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">NoteWeb</span>
        </Link>
        
        <div className="flex items-center gap-2">
          {/* Active status light */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/[0.05] light-mode:border-slate-200 bg-white/[0.02] light-mode:bg-slate-500/5">
            <span className={`w-1.5 h-1.5 rounded-full ${!isMockMode ? 'bg-[#00FF87]' : 'bg-[#F59E0B]'} animate-pulse`} />
            <span className="text-[8px] font-black text-slate-400 light-mode:text-slate-500 uppercase tracking-wider">
              {!isMockMode ? 'LIVE' : 'CACHE'}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile Floating Bottom Navigation capsule pill */}
      <nav className="lg:hidden fixed bottom-5 left-4 right-4 h-16 rounded-2xl border border-white/10 light-mode:border-slate-200 bg-[#05050A]/85 light-mode:bg-white/90 backdrop-blur-xl z-45 flex items-center justify-around px-2 shadow-[0_15px_30px_rgba(0,0,0,0.55)] light-mode:shadow-[0_15px_30px_rgba(15,23,42,0.06)] select-none">
        
        {/* Home tab link */}
        <NavLink 
          to="/" 
          className={({ isActive }) => `
            flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all duration-300 relative
            ${isActive ? 'text-[#00F2FE] light-mode:text-[#7F00FF] scale-110' : 'text-slate-400 light-mode:text-slate-500 active:scale-90'}
          `}
        >
          <HomeIcon className="w-5 h-5" />
          <span className="text-[8px] font-extrabold tracking-wider mt-0.5">Home</span>
          {location.pathname === '/' && (
            <span className="absolute bottom-0 w-1 h-1 rounded-full bg-[#00F2FE] light-mode:bg-[#7F00FF] shadow-[0_0_8px_rgba(0,242,254,0.8)]" />
          )}
        </NavLink>

        {/* Library tab link */}
        <NavLink 
          to="/feed" 
          className={({ isActive }) => `
            flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all duration-300 relative
            ${isActive ? 'text-[#00F2FE] light-mode:text-[#7F00FF] scale-110' : 'text-slate-400 light-mode:text-slate-500 active:scale-90'}
          `}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[8px] font-extrabold tracking-wider mt-0.5">Library</span>
          {location.pathname === '/feed' && (
            <span className="absolute bottom-0 w-1 h-1 rounded-full bg-[#00F2FE] light-mode:bg-[#7F00FF] shadow-[0_0_8px_rgba(0,242,254,0.8)]" />
          )}
        </NavLink>

        {/* Upload tab link */}
        <NavLink 
          to="/upload" 
          className={({ isActive }) => `
            flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all duration-300 relative
            ${isActive ? 'text-[#00F2FE] light-mode:text-[#7F00FF] scale-110' : 'text-slate-400 light-mode:text-slate-500 active:scale-90'}
          `}
        >
          <UploadCloud className="w-5 h-5" />
          <span className="text-[8px] font-extrabold tracking-wider mt-0.5">Upload</span>
          {location.pathname === '/upload' && (
            <span className="absolute bottom-0 w-1 h-1 rounded-full bg-[#00F2FE] light-mode:bg-[#7F00FF] shadow-[0_0_8px_rgba(0,242,254,0.8)]" />
          )}
        </NavLink>

        {/* Quiz Arena tab link */}
        <NavLink 
          to="/quiz" 
          className={({ isActive }) => `
            flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all duration-300 relative
            ${isActive ? 'text-purple-400 light-mode:text-[#7F00FF] scale-110' : 'text-slate-400 light-mode:text-slate-500 active:scale-90'}
          `}
        >
          <Gamepad2 className="w-5 h-5 animate-pulse" />
          <span className="text-[8px] font-extrabold tracking-wider mt-0.5 text-purple-400 light-mode:text-[#7F00FF]">Quiz</span>
          {location.pathname === '/quiz' && (
            <span className="absolute bottom-0 w-1 h-1 rounded-full bg-purple-400 light-mode:bg-[#7F00FF] shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
          )}
        </NavLink>

        {/* Commander launcher trigger tab */}
        <button 
          onClick={() => setIsLauncherOpen(!isLauncherOpen)}
          className={`
            flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all duration-300 relative
            ${isLauncherOpen ? 'text-[#FF007F] light-mode:text-[#7F00FF] scale-110 animate-pulse' : 'text-slate-400 light-mode:text-slate-500 active:scale-90'}
          `}
        >
          {isLauncherOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          <span className="text-[8px] font-extrabold tracking-wider mt-0.5 text-[#FF007F] light-mode:text-slate-500">More</span>
        </button>
      </nav>

      {/* Interactive mobile overlays */}
      <AnimatePresence>
        {isLauncherOpen && (
          <>
            {/* Soft dark glass overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/75 backdrop-blur-md z-40"
              onClick={() => setIsLauncherOpen(false)}
            />
            {/* Floating pop-up visual commander console grid */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 260 }}
              className="lg:hidden fixed bottom-24 left-4 right-4 max-h-[70vh] rounded-3xl border border-white/10 light-mode:border-slate-200 bg-[#0A0A0F]/95 light-mode:bg-white/95 backdrop-blur-2xl z-50 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.65)] light-mode:shadow-[0_20px_50px_rgba(15,23,42,0.06)] overflow-y-auto flex flex-col gap-6"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/[0.05] light-mode:border-slate-200 pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-[#00F2FE] via-[#7F00FF] to-[#FF007F] flex items-center justify-center shadow">
                    <span className="font-extrabold text-white text-[9px]">N</span>
                  </div>
                  <span className="text-sm font-black text-white light-mode:text-slate-800">Commander Panel</span>
                </div>
                <button
                  onClick={() => setIsLauncherOpen(false)}
                  className="p-1.5 rounded-lg border border-white/[0.08] light-mode:border-slate-200 text-slate-400 light-mode:text-slate-600 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Grid Layout of Other Pages */}
              <div className="grid grid-cols-3 gap-3">
                {/* Branches */}
                <button 
                  onClick={() => { navigate('/categories'); setIsLauncherOpen(false); }}
                  className="p-4 rounded-2xl bg-white/[0.02] light-mode:bg-slate-100 border border-white/[0.04] light-mode:border-slate-200/80 active:bg-white/[0.05] active:scale-95 transition-all flex flex-col items-center justify-center gap-2 text-center text-slate-300 light-mode:text-slate-700"
                >
                  <Grid className="w-5 h-5 text-sky-400" />
                  <span className="text-[9px] font-black uppercase tracking-wider">Branches</span>
                </button>

                {/* Campus Chat */}
                {user && !isGuest && (
                  <button 
                    onClick={() => { navigate('/chat'); setIsLauncherOpen(false); }}
                    className="p-4 rounded-2xl bg-white/[0.02] light-mode:bg-slate-100 border border-white/[0.04] light-mode:border-slate-200/80 active:bg-white/[0.05] active:scale-95 transition-all flex flex-col items-center justify-center gap-2 text-center text-slate-300 light-mode:text-slate-700"
                  >
                    <MessageSquare className="w-5 h-5 text-indigo-400" />
                    <span className="text-[9px] font-black uppercase tracking-wider">Lounge</span>
                  </button>
                )}

                {/* Rankings */}
                {user && !isGuest && (
                  <button 
                    onClick={() => { navigate('/leaderboard'); setIsLauncherOpen(false); }}
                    className="p-4 rounded-2xl bg-white/[0.02] light-mode:bg-slate-100 border border-white/[0.04] light-mode:border-slate-200/80 active:bg-white/[0.05] active:scale-95 transition-all flex flex-col items-center justify-center gap-2 text-center text-slate-300 light-mode:text-slate-700"
                  >
                    <Trophy className="w-5 h-5 text-amber-400" />
                    <span className="text-[9px] font-black uppercase tracking-wider">Rankings</span>
                  </button>
                )}

                {/* Dashboard (Profile) */}
                {user && !isGuest && (
                  <button 
                    onClick={() => { navigate('/profile'); setIsLauncherOpen(false); }}
                    className="p-4 rounded-2xl bg-white/[0.02] light-mode:bg-slate-100 border border-white/[0.04] light-mode:border-slate-200/80 active:bg-white/[0.05] active:scale-95 transition-all flex flex-col items-center justify-center gap-2 text-center text-slate-300 light-mode:text-slate-700"
                  >
                    <User className="w-5 h-5 text-teal-400" />
                    <span className="text-[9px] font-black uppercase tracking-wider">Profile</span>
                  </button>
                )}

                {/* Admin Area */}
                {isAdmin && !isGuest && (
                  <button 
                    onClick={() => { navigate('/admin'); setIsLauncherOpen(false); }}
                    className="p-4 rounded-2xl bg-[#FF007F]/5 light-mode:bg-[#FF007F]/10 border border-[#FF007F]/20 active:scale-95 transition-all flex flex-col items-center justify-center gap-2 text-center text-rose-300 light-mode:text-rose-700"
                  >
                    <ShieldAlert className="w-5 h-5 text-[#FF007F]" />
                    <span className="text-[9px] font-black uppercase tracking-wider">Admin</span>
                  </button>
                )}

                {/* About Stack */}
                <button 
                  onClick={() => { navigate('/about'); setIsLauncherOpen(false); }}
                  className="p-4 rounded-2xl bg-white/[0.02] light-mode:bg-slate-100 border border-white/[0.04] light-mode:border-slate-200/80 active:bg-white/[0.05] active:scale-95 transition-all flex flex-col items-center justify-center gap-2 text-center text-slate-300 light-mode:text-slate-700"
                >
                  <Info className="w-5 h-5 text-slate-400" />
                  <span className="text-[9px] font-black uppercase tracking-wider">About</span>
                </button>
              </div>

              {/* Quick Actions Panel */}
              <div className="flex flex-col gap-3.5 border-t border-white/[0.05] light-mode:border-slate-200 pt-4">
                <div className="flex items-center justify-between">
                  {/* Theme Switcher Toggle button */}
                  <button
                    onClick={toggleTheme}
                    className="flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl bg-white/[0.02] light-mode:bg-slate-100 border border-white/[0.04] light-mode:border-slate-200 text-[11px] font-bold text-slate-300 light-mode:text-slate-700 active:scale-98 transition-transform cursor-pointer"
                  >
                    {isDark ? (
                      <>
                        <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" />
                        <span>Light Theme</span>
                      </>
                    ) : (
                      <>
                        <Moon className="w-4 h-4 text-indigo-400" />
                        <span>Dark Theme</span>
                      </>
                    )}
                  </button>

                  <div className="w-3" />

                  {/* Sync status label */}
                  <div className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.02] light-mode:bg-slate-100 border border-white/[0.04] light-mode:border-slate-200 text-[10px] font-bold text-slate-400 light-mode:text-slate-500 select-none">
                    <span className={`w-1.5 h-1.5 rounded-full ${!isMockMode ? 'bg-[#00FF87]' : 'bg-[#F59E0B]'} animate-pulse`} />
                    <span className="uppercase tracking-wider">
                      {!isMockMode ? 'LIVE SYNCED' : 'LOCAL CACHE'}
                    </span>
                  </div>
                </div>

                {/* User section or Sign in button */}
                {user || isGuest ? (
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] light-mode:bg-slate-100 border border-white/[0.05] light-mode:border-slate-200">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                        {isGuest ? (
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#7F00FF] to-[#FF007F] flex items-center justify-center text-white font-extrabold text-[9px]">GS</div>
                        ) : (
                          renderAvatar(userProfile?.photoURL || '', "w-8 h-8 rounded-xl")
                        )}
                      </div>
                      <div className="min-w-0 flex flex-col text-left">
                        <span className="text-xs font-black text-slate-200 light-mode:text-slate-800 truncate">
                          {isGuest ? 'Guest Student' : (userProfile?.displayName || user?.displayName || 'Student')}
                        </span>
                        <span className="text-[8px] text-slate-500 light-mode:text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                          {isGuest ? 'Guest' : (userProfile?.role || 'Student')}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => { handleLogout(); setIsLauncherOpen(false); }}
                      className="p-2 px-3 rounded-lg text-slate-400 light-mode:text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log out</span>
                    </button>
                  </div>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setIsLauncherOpen(false)}
                    className="w-full inline-flex items-center justify-center p-3.5 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg text-xs"
                  >
                    Sign In
                  </Link>
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
