import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { 
  Home, 
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
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';

export const Sidebar: React.FC = () => {
  const { user, userProfile, isAdmin, isGuest, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { success, error } = useToast();
  const navigate = useNavigate();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

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
    { to: '/', label: 'Home', icon: <Home className="w-5 h-5" /> },
    { to: '/feed', label: 'Browse Notes', icon: <BookOpen className="w-5 h-5" /> },
    { to: '/categories', label: 'Branches', icon: <Grid className="w-5 h-5" /> },
    { to: '/upload', label: 'Upload Notes', icon: <UploadCloud className="w-5 h-5" /> },
    { to: '/profile', label: 'My Dashboard', icon: <User className="w-5 h-5" />, protected: true },
    { to: '/admin', label: 'Admin Panel', icon: <ShieldAlert className="w-5 h-5 animate-pulse text-amber-400" />, protected: true, adminOnly: true },
    { to: '/about', label: 'About', icon: <Info className="w-5 h-5" /> },
  ];

  const visibleItems = navItems.filter(item => {
    if (item.adminOnly) return isAdmin && !isGuest;
    if (item.protected) return !!user && !isGuest;
    return true;
  });

  const getInitials = (name: string) => {
    return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'NH';
  };

  return (
    <>
      {/* Mobile Topbar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 glass-panel border-b border-white/[0.08] px-4 flex items-center justify-between z-40 bg-slate-950/80 light-mode:bg-white/90">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">NoteWeb</span>
        </Link>
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-400 hover:text-white light-mode:hover:text-slate-900 transition-colors"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button 
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="p-2 rounded-xl text-slate-400 hover:text-white light-mode:hover:text-slate-900 transition-colors"
          >
            {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Main Sidebar */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-50
        glass-panel border-r border-white/[0.08] bg-[#0A0A0C]/90 light-mode:bg-white/95
        flex flex-col transition-all duration-300
        lg:translate-x-0
        ${isCollapsed ? 'w-20' : 'w-64'}
        ${isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
        ${isMobileOpen ? 'pt-6' : 'pt-0'}
      `}>
        {/* Sidebar Header */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-white/[0.05]">
          <Link 
            to="/" 
            onClick={() => setIsMobileOpen(false)}
            className="flex items-center gap-3 select-none"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-600/30">
              <span className="font-extrabold text-white text-base">N</span>
            </div>
            {!isCollapsed && (
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent transition-all duration-200">
                NoteWeb
              </span>
            )}
          </Link>
          
          {/* Collapse Button (Desktop Only) */}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex p-1.5 rounded-lg border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/5 light-mode:border-slate-900/10 light-mode:text-slate-600 light-mode:hover:text-slate-900 transition-all active:scale-95"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 px-4 py-6 flex flex-col gap-1.5 overflow-y-auto">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsMobileOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 group relative
                ${isActive 
                  ? 'bg-gradient-to-r from-indigo-500/15 via-purple-500/15 to-pink-500/5 text-white border-l-4 border-indigo-500 shadow-[inset_0_0_12px_rgba(99,102,241,0.08)] light-mode:text-indigo-600 light-mode:from-indigo-50/70 light-mode:to-indigo-50/30' 
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.03] pl-[18px] light-mode:text-slate-500 light-mode:hover:text-slate-800 light-mode:hover:bg-slate-900/[0.03]'}
              `}
            >
              <div className="flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                {item.icon}
              </div>
              {(!isCollapsed || isMobileOpen) && (
                <span className="font-medium text-sm tracking-wide">{item.label}</span>
              )}
              {isCollapsed && !isMobileOpen && (
                <div className="absolute left-20 bg-[#16161D] border border-white/10 text-white rounded-lg px-2 py-1 text-xs opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-50">
                  {item.label}
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/[0.05] flex flex-col gap-3">
          {/* Theme Toggle (Desktop Only) */}
          <button
            onClick={toggleTheme}
            className={`
              w-full hidden lg:flex items-center gap-4 px-4 py-3 rounded-xl
              text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]
              light-mode:text-slate-500 light-mode:hover:text-slate-800 light-mode:hover:bg-slate-900/[0.03]
              transition-all duration-200
            `}
          >
            {isDark ? (
              <>
                <Sun className="w-5 h-5 text-amber-400 flex-shrink-0 animate-spin-slow" />
                {!isCollapsed && <span className="text-sm font-medium">Light Mode</span>}
              </>
            ) : (
              <>
                <Moon className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                {!isCollapsed && <span className="text-sm font-medium">Dark Mode</span>}
              </>
            )}
          </button>

          {/* User Account / Login State */}
          {user || isGuest ? (
            <div className={`
              flex items-center gap-3 p-2 rounded-xl bg-white/[0.02] border border-white/[0.05]
              ${isCollapsed ? 'justify-center' : 'justify-between'}
            `}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-md flex-shrink-0">
                  {isGuest ? (
                    <span className="font-extrabold text-white text-xs">GS</span>
                  ) : userProfile?.photoURL ? (
                    <img 
                      src={userProfile.photoURL} 
                      alt="Avatar" 
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    getInitials(userProfile?.displayName || user?.displayName || '')
                  )}
                </div>
                {!isCollapsed && (
                  <div className="min-w-0 flex flex-col text-left">
                    <span className="text-sm font-semibold text-slate-200 truncate light-mode:text-slate-800">
                      {isGuest ? 'Guest Student' : (userProfile?.displayName || user?.displayName || 'Student')}
                    </span>
                    <span className="text-xs text-slate-500 truncate lowercase font-medium">
                      {isGuest ? 'Guest Mode' : (userProfile?.role || 'Student')}
                    </span>
                  </div>
                )}
              </div>
              {!isCollapsed && (
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200 active:scale-95 flex-shrink-0"
                  title={isGuest ? 'Exit Guest' : 'Logout'}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              onClick={() => setIsMobileOpen(false)}
              className={`
                w-full inline-flex items-center justify-center p-3 rounded-xl font-semibold
                bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg text-sm
                hover:shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300
                ${isCollapsed ? 'h-10 w-10 p-0 overflow-hidden' : ''}
              `}
            >
              {isCollapsed ? <User className="w-5 h-5" /> : 'Sign In'}
            </Link>
          )}
        </div>
      </aside>
    </>
  );
};
