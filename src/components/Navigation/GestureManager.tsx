import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Home, 
  BookOpen, 
  UploadCloud, 
  MessageSquare, 
  User, 
  Trophy, 
  Target, 
  Moon, 
  Sun, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  ArrowLeft, 
  Command, 
  Sparkles 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { playTapSound, playSuccessSound, playHoverSound } from '../../utils/sounds';

interface GestureManagerProps {
  children: React.ReactNode;
}

export const GestureManager: React.FC<GestureManagerProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isGuest } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  // Route/Tab switcher configuration
  const mainTabs = [
    '/',
    '/feed',
    '/upload',
    ...(user && !isGuest ? ['/chat'] : []),
    '/profile'
  ];

  // Gesture detection states
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const [touchStartTime, setTouchStartTime] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [swipeType, setSwipeType] = useState<'none' | 'back' | 'tab-prev' | 'tab-next'>('none');
  const [isSwipeIgnored, setIsSwipeIgnored] = useState(false);

  // Pull to Refresh states
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshState, setRefreshState] = useState<'idle' | 'pulling' | 'threshold' | 'refreshing'>('idle');
  const pullStartRef = useRef<number | null>(null);

  // Command Palette states
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState('');
  const [paletteIndex, setPaletteIndex] = useState(0);


  // Helper: check if we are on one of the main tabs
  const isMainTab = mainTabs.includes(location.pathname);

  // Sound play wrappers
  const playHover = () => {
    try { playHoverSound(); } catch {}
  };
  const playSuccess = () => {
    try { playSuccessSound(); } catch {}
  };
  const playTap = () => {
    try { playTapSound(); } catch {}
  };

  // Keyboard and Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Open Command Palette (Ctrl+K or Cmd+K)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        playTap();
        setIsPaletteOpen(prev => !prev);
        setPaletteSearch('');
        setPaletteIndex(0);
      }

      // 2. Escape to close
      if (e.key === 'Escape' && isPaletteOpen) {
        e.preventDefault();
        setIsPaletteOpen(false);
      }

      // 3. Tab switching keys: Alt+N (next), Alt+P (prev)
      if (e.altKey && (e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        if (!isMainTab) return;
        const currIdx = mainTabs.indexOf(location.pathname);
        if (currIdx === -1) return;

        let nextIdx = currIdx;
        if (e.key.toLowerCase() === 'n') {
          nextIdx = (currIdx + 1) % mainTabs.length;
        } else {
          nextIdx = (currIdx - 1 + mainTabs.length) % mainTabs.length;
        }
        playTap();
        navigate(mainTabs[nextIdx]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaletteOpen, location.pathname, user, isGuest]);

  // Touch handlers for Swipes and Pull-to-refresh
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStartX(touch.clientX);
    setTouchStartY(touch.clientY);
    setTouchStartTime(Date.now());
    setIsSwipeIgnored(false);
    setSwipeType('none');
    setDragOffset(0);

    // 1. Check if start inside horizontal scroll area
    const target = e.target as HTMLElement;
    if (target.closest('.horizontal-scroll-list, .overflow-x-auto, [data-horizontal-scroll], input, textarea, select')) {
      setIsSwipeIgnored(true);
      return;
    }

    // 2. Pull to refresh detection (only if at absolute top)
    if (window.scrollY === 0 && refreshState === 'idle') {
      pullStartRef.current = touch.clientY;
      setRefreshState('pulling');
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isSwipeIgnored) return;
    const touch = e.touches[0];
    const diffX = touch.clientX - touchStartX;
    const diffY = touch.clientY - touchStartY;
    const isHorizontal = Math.abs(diffX) > Math.abs(diffY) * 1.5;

    // 1. Handle Pull to refresh drag
    if (pullStartRef.current !== null && diffY > 0 && Math.abs(diffX) < diffY) {
      const distance = Math.min((touch.clientY - pullStartRef.current) * 0.45, 140);
      setPullDistance(distance);
      if (distance > 95) {
        if (refreshState !== 'threshold') {
          setRefreshState('threshold');
          playHover();
        }
      } else {
        setRefreshState('pulling');
      }
      // Prevent browser default pull-to-refresh if possible
      if (e.cancelable) e.preventDefault();
      return;
    }

    // 2. Handle swipe gestures
    if (isHorizontal && Math.abs(diffX) > 15) {
      setDragOffset(diffX);

      // Edge swipe back (swipe right from left edge) - ONLY if NOT on main tabs to prevent history-back hijacking of tab switches
      if (diffX > 0 && touchStartX < 50 && !isMainTab) {
        setSwipeType('back');
      } 
      // Main tab swiping
      else if (isMainTab) {
        const currIdx = mainTabs.indexOf(location.pathname);
        if (diffX < 0 && currIdx < mainTabs.length - 1) {
          setSwipeType('tab-next');
        } else if (diffX > 0 && currIdx > 0) {
          setSwipeType('tab-prev');
        }
      }
    }
  };

  const handleTouchEnd = () => {
    // 1. Resolve Pull to refresh
    if (pullStartRef.current !== null) {
      pullStartRef.current = null;
      if (refreshState === 'threshold') {
        setRefreshState('refreshing');
        playSuccess();
        setTimeout(() => {
          window.location.reload();
        }, 1100);
      } else {
        setRefreshState('idle');
        setPullDistance(0);
      }
    }

    if (isSwipeIgnored) return;

    // 2. Resolve Swipe Gestures
    const diffTime = Date.now() - touchStartTime;
    const absDrag = Math.abs(dragOffset);
    const speed = absDrag / diffTime; // pixels per ms

    // Fast swipe (velocity > 0.35 px/ms) or long swipe (distance > 110px)
    const isGestureTriggered = absDrag > 110 || (absDrag > 45 && speed > 0.35);

    if (isGestureTriggered) {
      if (swipeType === 'back') {
        playTap();
        navigate(-1);
      } else if (swipeType === 'tab-next' && isMainTab) {
        const currIdx = mainTabs.indexOf(location.pathname);
        if (currIdx < mainTabs.length - 1) {
          playTap();
          navigate(mainTabs[currIdx + 1]);
        }
      } else if (swipeType === 'tab-prev' && isMainTab) {
        const currIdx = mainTabs.indexOf(location.pathname);
        if (currIdx > 0) {
          playTap();
          navigate(mainTabs[currIdx - 1]);
        }
      }
    }

    // Reset touch variables
    setDragOffset(0);
    setSwipeType('none');
  };

  // Trackpad scroll-up pull-to-refresh and horizontal back/forward navigation helper
  useEffect(() => {
    let lastWheelSwipe = 0;

    const handleWheel = (e: WheelEvent) => {
      // 1. Two-finger horizontal wheel swipe to switch tabs (if not in horizontal list)
      if (Math.abs(e.deltaX) > 60 && isMainTab) {
        const now = Date.now();
        if (now - lastWheelSwipe < 900) return;
        
        const target = e.target as HTMLElement;
        if (target.closest('.horizontal-scroll-list, .overflow-x-auto, [data-horizontal-scroll]')) {
          return;
        }

        const currIdx = mainTabs.indexOf(location.pathname);
        if (e.deltaX > 60 && currIdx < mainTabs.length - 1) {
          playTap();
          navigate(mainTabs[currIdx + 1]);
          lastWheelSwipe = now;
        } else if (e.deltaX < -60 && currIdx > 0) {
          playTap();
          navigate(mainTabs[currIdx - 1]);
          lastWheelSwipe = now;
        }
      }

      // 2. Trackpad / Mouse Scroll down for pull-to-refresh
      if (window.scrollY === 0 && e.deltaY < -40 && refreshState === 'idle') {
        setRefreshState('pulling');
        setPullDistance(50);
        playHover();
        
        setTimeout(() => {
          setRefreshState('threshold');
          setPullDistance(95);
        }, 200);

        setTimeout(() => {
          setRefreshState('refreshing');
          playSuccess();
          setTimeout(() => {
            window.location.reload();
          }, 1100);
        }, 600);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [location.pathname, refreshState, user, isGuest]);

  // Command palette choices list
  const paletteItems = [
    { name: 'Home Dashboard', path: '/', icon: <Home className="w-4 h-4 text-sky-400" />, desc: 'Go to home dashboard' },
    { name: 'Notes Library', path: '/feed', icon: <BookOpen className="w-4 h-4 text-emerald-400" />, desc: 'Search and read study notes' },
    { name: 'Upload Notes', path: '/upload', icon: <UploadCloud className="w-4 h-4 text-purple-400" />, desc: 'Publish notes or exam papers' },
    ...(user && !isGuest ? [
      { name: 'Campus Chat Lounge', path: '/chat', icon: <MessageSquare className="w-4 h-4 text-indigo-400" />, desc: 'Chat with college mates' },
      { name: 'Rankings & Leaderboard', path: '/leaderboard', icon: <Trophy className="w-4 h-4 text-amber-400" />, desc: 'Check study points leaderboard' },
      { name: 'Daily Quests', path: '/quests', icon: <Target className="w-4 h-4 text-[#00F2FE]" />, desc: 'Collect XP points and credits' },
      { name: 'My Profile Panel', path: '/profile', icon: <User className="w-4 h-4 text-teal-400" />, desc: 'Manage your profile and notes' },
    ] : []),
    { name: 'Toggle Dark / Light Theme', action: 'theme', icon: isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />, desc: 'Switch visual look' },
    { name: 'Reload Cache & Sync', action: 'reload', icon: <RefreshCw className="w-4 h-4 text-slate-400 animate-spin-slow" />, desc: 'Force reload application cache' },
  ];

  // Filter command palette options based on input
  const filteredPaletteItems = paletteItems.filter(item => 
    item.name.toLowerCase().includes(paletteSearch.toLowerCase()) ||
    item.desc.toLowerCase().includes(paletteSearch.toLowerCase())
  );

  // Keyboard navigation within command palette
  useEffect(() => {
    if (!isPaletteOpen) return;
    
    const handlePaletteKeys = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        playHover();
        setPaletteIndex(prev => (prev + 1) % filteredPaletteItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        playHover();
        setPaletteIndex(prev => (prev - 1 + filteredPaletteItems.length) % filteredPaletteItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredPaletteItems[paletteIndex];
        if (selected) {
          triggerPaletteAction(selected);
        }
      }
    };

    window.addEventListener('keydown', handlePaletteKeys);
    return () => window.removeEventListener('keydown', handlePaletteKeys);
  }, [isPaletteOpen, filteredPaletteItems, paletteIndex]);

  const triggerPaletteAction = (item: typeof paletteItems[0]) => {
    playTap();
    setIsPaletteOpen(false);
    if ('path' in item && item.path) {
      navigate(item.path);
    } else if ('action' in item) {
      if (item.action === 'theme') {
        toggleTheme();
      } else if (item.action === 'reload') {
        window.location.reload();
      }
    }
  };

  return (
    <div 
      className="relative w-full min-h-screen"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 1. Pull to Refresh Visual Ring */}
      {refreshState !== 'idle' && (
        <div 
          className="fixed left-0 right-0 flex justify-center z-[9999] pointer-events-none transition-all duration-150"
          style={{ 
            top: `${Math.min(pullDistance, 110)}px`, 
            opacity: Math.min(pullDistance / 60, 1),
            transform: `translateY(-40px) scale(${Math.min(pullDistance / 90, 1)})`
          }}
        >
          <div className="glass-panel border border-white/20 dark:border-white/10 p-3 rounded-full flex items-center gap-2.5 shadow-[0_8px_32px_rgba(99,102,241,0.25)] bg-[#070710]/85 backdrop-blur-md text-white px-5">
            <motion.div 
              animate={refreshState === 'refreshing' ? { rotate: 360 } : { rotate: pullDistance * 3.5 }}
              transition={refreshState === 'refreshing' ? { repeat: Infinity, duration: 0.8, ease: 'linear' } : { duration: 0 }}
            >
              <RefreshCw className="w-4 h-4 text-indigo-400" />
            </motion.div>
            <span className="text-[10px] font-black tracking-wider uppercase text-slate-200">
              {refreshState === 'pulling' && 'Pull to Sync'}
              {refreshState === 'threshold' && 'Release to Reload'}
              {refreshState === 'refreshing' && 'Refreshing...'}
            </span>
          </div>
        </div>
      )}

      {/* 2. Edge Swipe Back Chevron Indicator */}
      <AnimatePresence>
        {swipeType === 'back' && dragOffset > 15 && (
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="fixed left-0 top-1/2 -translate-y-1/2 z-[9999] pointer-events-none"
            style={{ 
              transform: `translateY(-50%) scale(${Math.min(dragOffset / 90, 1.35)})`,
              opacity: Math.min(dragOffset / 70, 0.95)
            }}
          >
            <div className="h-28 w-12 rounded-r-3xl bg-gradient-to-r from-indigo-500/20 to-purple-600/35 border-y border-r border-white/15 flex items-center justify-center backdrop-blur-md shadow-2xl pl-1">
              <ArrowLeft className="w-5 h-5 text-white animate-pulse" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Horizontal Tab Swipe chevron overlays */}
      <AnimatePresence>
        {swipeType === 'tab-next' && dragOffset < -20 && (
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            className="fixed right-2 top-1/2 -translate-y-1/2 z-[9999] pointer-events-none flex flex-col items-center gap-1"
          >
            <div className="w-12 h-12 rounded-full glass-panel border border-white/20 bg-indigo-500/10 flex items-center justify-center text-indigo-400 animate-bounce">
              <ChevronRight className="w-5 h-5" />
            </div>
            <span className="text-[8px] font-black tracking-widest text-slate-400 bg-black/60 px-2 py-0.5 rounded-full uppercase">Next Tab</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {swipeType === 'tab-prev' && dragOffset > 20 && (
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="fixed left-2 top-1/2 -translate-y-1/2 z-[9999] pointer-events-none flex flex-col items-center gap-1"
          >
            <div className="w-12 h-12 rounded-full glass-panel border border-white/20 bg-indigo-500/10 flex items-center justify-center text-indigo-400 animate-bounce">
              <ChevronLeft className="w-5 h-5" />
            </div>
            <span className="text-[8px] font-black tracking-widest text-slate-400 bg-black/60 px-2 py-0.5 rounded-full uppercase">Prev Tab</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Ctrl+K Command Palette Modal */}
      <AnimatePresence>
        {isPaletteOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/75 backdrop-blur-md z-[99990]"
              onClick={() => setIsPaletteOpen(false)}
            />

            {/* Main Modal Panel */}
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.96 }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-lg mx-auto p-4 z-[99999]"
            >
              <div className="glass-panel border border-white/10 dark:border-white/5 rounded-3xl overflow-hidden shadow-[0_24px_70px_rgba(99,102,241,0.25)] bg-[#070710]/95 backdrop-blur-2xl text-white flex flex-col">
                
                {/* Search Bar Input */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06] bg-white/[0.01]">
                  <Search className="w-5 h-5 text-indigo-400 animate-pulse flex-shrink-0" />
                  <input
                    type="text"
                    value={paletteSearch}
                    onChange={(e) => {
                      setPaletteSearch(e.target.value);
                      setPaletteIndex(0);
                    }}
                    placeholder="Search shortcuts, pages, and actions..."
                    className="flex-1 bg-transparent border-none outline-none text-sm placeholder-slate-500 font-medium text-slate-100 pr-4"
                    autoFocus
                  />
                  <div className="flex items-center gap-1 text-[9px] font-black uppercase bg-white/[0.04] border border-white/[0.08] text-slate-400 px-2 py-1 rounded-lg">
                    <Command className="w-2.5 h-2.5" />
                    <span>K</span>
                  </div>
                </div>

                {/* Content list */}
                <div className="max-h-[350px] overflow-y-auto p-2.5 space-y-1 scrollbar-none">
                  {filteredPaletteItems.length > 0 ? (
                    filteredPaletteItems.map((item, idx) => {
                      const isFocused = idx === paletteIndex;
                      return (
                        <button
                          key={item.name}
                          onClick={() => triggerPaletteAction(item)}
                          onMouseEnter={() => {
                            setPaletteIndex(idx);
                          }}
                          className={`
                            w-full flex items-center justify-between p-3.5 rounded-2xl text-left transition-all duration-150 cursor-pointer
                            ${isFocused 
                              ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/20 border border-indigo-500/30 text-white shadow-md shadow-indigo-600/5 translate-x-1.5' 
                              : 'border border-transparent text-slate-400 hover:text-slate-200'
                            }
                          `}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className={`p-2 rounded-xl border transition-colors ${isFocused ? 'bg-indigo-500/25 border-indigo-400/40 text-white' : 'bg-white/[0.02] border-white/[0.05]'}`}>
                              {item.icon}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-black tracking-wide text-slate-200">{item.name}</h4>
                              <p className="text-[10px] text-slate-500 mt-0.5 truncate">{item.desc}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {isFocused && (
                              <span className="text-[9px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full tracking-wider animate-pulse flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5" />
                                <span>Go</span>
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="py-8 text-center text-slate-500 flex flex-col items-center justify-center gap-2.5">
                      <HelpCircleIcon className="w-8 h-8 text-slate-600 animate-bounce" />
                      <span className="text-xs font-semibold">No shortcut actions match "{paletteSearch}"</span>
                    </div>
                  )}
                </div>

                {/* Footer hints */}
                <div className="px-5 py-3 border-t border-white/[0.05] bg-white/[0.02] flex items-center justify-between text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-4">
                    <span>↑↓ to navigate</span>
                    <span>⏎ to select</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="bg-white/[0.04] border border-white/[0.08] px-1.5 py-0.5 rounded">esc</span>
                    <span>to close</span>
                  </div>
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main app contents */}
      {children}
    </div>
  );
};

// Internal local fallback component if help circle is not available
const HelpCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
