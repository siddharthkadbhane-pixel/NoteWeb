import React, { useEffect, useState, useRef } from 'react';
import { HashRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Navigation/Sidebar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { supabase } from './supabase/config';
import { ShieldAlert, Send, RefreshCw, UploadCloud } from 'lucide-react';
import { leavePresence } from './services/presence';

// Import NoteWeb Pages
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Login } from './pages/Login';
import { Categories } from './pages/Categories';
import { Feed } from './pages/Feed';
import { Upload } from './pages/Upload';
import { Profile } from './pages/Profile';
import { Admin } from './pages/Admin';
import { Chat } from './pages/Chat';
import { Leaderboard } from './pages/Leaderboard';
import { Feedback } from './pages/Feedback';
import { Quests } from './pages/Quests';
import { FloatingThemeToggle } from './components/Navigation/FloatingThemeToggle';
import { InteractiveBackground } from './components/ui/InteractiveBackground';
import { ScreenshotProtection } from './components/ScreenshotProtection';
import { PageWrapper } from './components/ui/PageWrapper';
import { LocalErrorBoundary } from './components/LocalErrorBoundary';

// System Notifications Helper
const showSystemNotification = (title: string, body: string) => {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/logo.png',
        });
      } catch (err) {
        console.warn('Failed to show standard notification, attempting service worker fallback:', err);
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(title, {
              body,
              icon: '/logo.png',
            });
          }).catch(swErr => {
            console.error('Service worker notification failed:', swErr);
          });
        }
      }
    }
  }
};

export const ChatNotificationListener: React.FC = () => {
  const { user } = useAuth();
  const { info } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  
  const locationRef = useRef(location);
  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    if (!user) return;

    // Request system notification permission on first interaction
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        const handleGesture = () => {
          Notification.requestPermission().then((permission) => {
            console.log('[NoteWeb Notifications] System notification permission status:', permission);
          });
          window.removeEventListener('click', handleGesture);
          window.removeEventListener('touchstart', handleGesture);
        };
        window.addEventListener('click', handleGesture);
        window.addEventListener('touchstart', handleGesture);
      }
    }

    let channel: any = null;
    try {
      if (typeof supabase.channel === 'function') {
        console.log('[NoteWeb Notifications] Initializing global chats channel subscription...');
        
        channel = supabase
          .channel('public:chats_global_notifications')
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'chats' },
            (payload: any) => {
              console.log('[NoteWeb Notifications] Realtime chats insert:', payload);
              if (payload.new) {
                const senderId = payload.new.sender_id || payload.new.sender_uid;
                if (senderId !== user.uid) {
                  const senderName = payload.new.sender_name || 'Classmate';
                  const messageText = payload.new.message || payload.new.content || 'Sent a message';
                  
                  const currentPath = locationRef.current.pathname;
                  const isBackground = typeof document !== 'undefined' && document.visibilityState === 'hidden';
                  
                  if (currentPath !== '/chat') {
                    info(
                      `💬 ${senderName}: "${messageText.substring(0, 45)}${messageText.length > 45 ? '...' : ''}"`,
                      5500,
                      () => navigate('/chat')
                    );
                  }
                  
                  if (currentPath !== '/chat' || isBackground) {
                    showSystemNotification(`💬 ${senderName}`, messageText);
                  }
                }
              }
            }
          )
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'direct_messages' },
            async (payload: any) => {
              console.log('[NoteWeb Notifications] Realtime DM insert:', payload);
              if (payload.new && payload.new.recipient_id === user.uid) {
                const senderId = payload.new.sender_id;
                
                // Do not notify if we are already viewing this chat thread and app is focused
                const currentPath = locationRef.current.pathname;
                const params = new URLSearchParams(locationRef.current.search);
                const activeDm = params.get('dm');
                const isBackground = typeof document !== 'undefined' && document.visibilityState === 'hidden';
                const isViewingActiveDm = currentPath === '/chat' && activeDm === senderId;
                
                if (isViewingActiveDm && !isBackground) {
                  return; 
                }
                
                let senderName = 'Classmate';
                try {
                  const { data } = await supabase.from('profiles').select('display_name,username').eq('id', senderId).single();
                  if (data) {
                    senderName = data.display_name || data.username || 'Classmate';
                  }
                } catch {}
                
                const messageText = payload.new.message || 'Sent an attachment';
                
                if (currentPath !== '/chat' || activeDm !== senderId) {
                  info(
                    `✉️ DM from ${senderName}: "${messageText.substring(0, 45)}${messageText.length > 45 ? '...' : ''}"`,
                    6000,
                    () => navigate(`/chat?dm=${senderId}`)
                  );
                }
                
                showSystemNotification(`✉️ DM from ${senderName}`, messageText);
              }
            }
          )
          .on(
            'broadcast',
            { event: 'message' },
            (response: any) => {
              console.log('[NoteWeb Notifications] Realtime P2P chat broadcast:', response);
              if (response?.payload) {
                const msg = response.payload;
                if (msg.sender_uid !== user.uid) {
                  const senderName = msg.sender_name || 'Classmate';
                  const messageText = msg.content || 'Sent an image or message';
                  const currentPath = locationRef.current.pathname;
                  const isBackground = typeof document !== 'undefined' && document.visibilityState === 'hidden';
                  
                  if (currentPath !== '/chat') {
                    info(
                      `💬 ${senderName}: "${messageText.substring(0, 45)}${messageText.length > 45 ? '...' : ''}"`,
                      5500,
                      () => navigate('/chat')
                    );
                  }
                  
                  if (currentPath !== '/chat' || isBackground) {
                    showSystemNotification(`💬 ${senderName}`, messageText);
                  }
                }
              }
            }
          )
          .subscribe();
      }
    } catch (err) {
      console.warn("Global notification channel subscription failed:", err);
    }

    return () => {
      if (channel) {
        try {
          if (typeof supabase.removeChannel === 'function') {
            supabase.removeChannel(channel);
          } else {
            channel.unsubscribe();
          }
        } catch (e) {}
      }
    };
  }, [user, info, navigate]);


  return null;
};

// Safe fetch with manual AbortController timeout for maximum compatibility across older WebViews
const fetchWithTimeout = async (url: string, ms = 1500): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
};

// Fetch current user IP address with multiple public API fallbacks & offline mocks
const fetchUserIp = async (): Promise<string> => {
  try {
    const res = await fetchWithTimeout('https://api.seeip.org/jsonip', 1500);
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) return data.ip;
    }
  } catch (err) {
    console.warn("fetchUserIp seeip fallback triggered:", err);
  }
  try {
    const res = await fetchWithTimeout('https://api.ipify.org?format=json', 1500);
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) return data.ip;
    }
  } catch (err) {
    console.warn("fetchUserIp ipify fallback triggered:", err);
  }
  
  // High-fidelity offline mockup IP Address
  let mockIp = localStorage.getItem('noteweb-detected-ip');
  if (!mockIp) {
    const rand = () => Math.floor(Math.random() * 254) + 1;
    mockIp = `192.168.1.${rand()}`;
    localStorage.setItem('noteweb-detected-ip', mockIp);
  }
  return mockIp;
};

const getHardwareId = (): string => {
  if (typeof window === 'undefined') return '';
  let hwId = localStorage.getItem('noteweb-hardware-id');
  if (!hwId) {
    const randStr = () => Math.random().toString(36).substring(2, 15);
    const canvasFp = typeof HTMLCanvasElement !== 'undefined' ? 'canvas' : 'no-canvas';
    hwId = `hw-${randStr()}-${randStr()}-${Date.now().toString(36)}-${canvasFp}`;
    localStorage.setItem('noteweb-hardware-id', hwId);
  }
  return hwId;
};

interface IpBlockGuardProps {
  children: React.ReactNode;
}

const IpBlockGuard: React.FC<IpBlockGuardProps> = ({ children }) => {
  const [ip, setIp] = useState('');
  const [status, setStatus] = useState<'blocked' | 'pending_approval' | 'approved_by_admin' | 'none'>('none');
  const [blockedEntry, setBlockedEntry] = useState<any | null>(null);
  const [statement, setStatement] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const checkIpStatus = async () => {
    try {
      const userIp = await fetchUserIp();
      setIp(userIp);
      const hwId = getHardwareId();
      
      // Query blocked_ips database table for BOTH IP and Hardware fingerprint
      let dbData = null;
      try {
        const { data, error } = await supabase
          .from('blocked_ips')
          .select('*')
          .or(`id.eq.${userIp},hardware_id.eq.${hwId}`);
        if (error) {
          console.warn("Supabase IP lookup warning:", error);
        }
        dbData = data;
      } catch (err) {
        console.warn("Offline/DB check failed, using mock fallbacks:", err);
      }

      let entry = dbData && dbData.find((item: any) => item.id === userIp || (item.hardware_id && item.hardware_id === hwId));
      
      // Local storage fallback for mock/offline configurations
      if (!entry) {
        try {
          const blockedStr = localStorage.getItem('noteweb-db-blocked_ips');
          if (blockedStr) {
            const blockedList = JSON.parse(blockedStr);
            if (Array.isArray(blockedList)) {
              entry = blockedList.find((item: any) => item.id === userIp || (item.hardware_id && item.hardware_id === hwId));
            }
          }
        } catch {}
      }

      if (entry) {
        setBlockedEntry(entry);
        setStatus(entry.status || 'blocked');

        // FORCE LOGOUT AND REMOVE PRESENCE IMMEDIATELY IF BLOCKED/PENDING
        if (entry.status === 'blocked' || entry.status === 'pending_approval') {
          try {
            localStorage.removeItem('noteweb-mock-uid');
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && (key.startsWith('noteweb-profile-') || key === 'noteweb-is-guest')) {
                keysToRemove.push(key);
              }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
            await leavePresence();
          } catch {}
        }
      } else {
        setBlockedEntry(null);
        setStatus('none');
      }
    } catch (e) {
      console.warn("Failed to verify secure IP credentials:", e);
    } finally {
      // Silently completed IP check
    }
  };

  useEffect(() => {
    checkIpStatus(); // Initial check with visible loading screen

    // Setup periodic watchdog checking IP/hardware status silently every 5 minutes in the background
    const interval = setInterval(() => checkIpStatus(), 300000);

    // Listen for storage changes (clearing block) across browser tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'noteweb-db-blocked_ips') {
        checkIpStatus();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Listen to real-time additions/deletions to the blocked_ips table
    let channel: any = null;
    try {
      channel = supabase
        .channel('public:blocked_ips_guard')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'blocked_ips' },
          () => {
            console.log('[IpBlockGuard] Real-time IP table change detected, refreshing...');
            checkIpStatus();
          }
        )
        .subscribe();
    } catch (err) {
      console.warn("Failed to subscribe to realtime blocked_ips:", err);
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, []);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statement.trim()) return;
    
    setIsSubmitting(true);
    try {
      const hwId = getHardwareId();
      const updatedEntry = {
        id: ip,
        blocked_at: blockedEntry?.blocked_at || new Date().toISOString(),
        reason: blockedEntry?.reason || 'Account pruned by administrator',
        status: 'pending_approval',
        request_statement: statement.trim(),
        hardware_id: hwId
      };

      // Write to database
      try {
        await supabase.from('blocked_ips').upsert([updatedEntry]);
      } catch (dbErr) {
        console.warn("Failed to write access request to Supabase:", dbErr);
      }

      // Write to mock local storage database
      try {
        const blockedStr = localStorage.getItem('noteweb-db-blocked_ips');
        let blockedList: any[] = [];
        if (blockedStr) {
          try { blockedList = JSON.parse(blockedStr); } catch {}
        }
        blockedList = blockedList.filter((item: any) => item.id !== ip);
        blockedList.push(updatedEntry);
        localStorage.setItem('noteweb-db-blocked_ips', JSON.stringify(blockedList));
      } catch (cacheErr) {
        console.warn("Failed to save access request to local storage:", cacheErr);
      }

      setBlockedEntry(updatedEntry);
      setStatus('pending_approval');
    } catch (err) {
      console.error("Failed to submit IP request:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Global loading splash removed to run verification silently in background

  if (status === 'blocked' || status === 'pending_approval') {
    return (
      <div className="min-h-screen w-full bg-[#020204] flex items-center justify-center px-4 relative overflow-hidden py-12 text-white">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="max-w-md w-full glass-panel border border-rose-500/20 rounded-3xl p-8 text-center relative z-10 shadow-[0_0_50px_rgba(244,63,94,0.1)]">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-500 to-red-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-rose-500/30 animate-pulse">
            <ShieldAlert className="w-9 h-9 text-white" />
          </div>

          <h2 className="text-2xl font-black tracking-tight text-white uppercase font-black">Restricted Access</h2>
          <p className="text-slate-400 text-xs font-bold tracking-widest mt-1.5 uppercase bg-rose-500/10 border border-rose-500/20 rounded-full py-1 px-4 inline-block font-mono">
            🌐 IP: {ip}
          </p>

          <p className="text-xs text-slate-400 mt-4 leading-relaxed text-left bg-white/[0.02] border border-white/[0.04] p-4 rounded-2xl">
            College administration has restricted your device IP address from accessing NoteWeb resources. 
            This block generally occurs when an account is removed/pruned due to lounge chat violations or policy breaches.
          </p>

          {status === 'blocked' ? (
            <form onSubmit={handleSubmitRequest} className="mt-6 space-y-4 text-left">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 pl-1">
                  Access Renewal Statement
                </label>
                <textarea
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  placeholder="Explain why your access should be restored (e.g. academic collaboration, misidentified device)..."
                  className="w-full h-24 bg-white/[0.03] border border-white/[0.08] focus:border-indigo-500 focus:bg-white/[0.05] rounded-xl p-3 text-xs outline-none transition-all placeholder-slate-600 font-semibold text-slate-100"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl font-black text-xs text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><Send className="w-3.5 h-3.5" /> Submit Request for Admin Review</>
                )}
              </button>
            </form>
          ) : (
            <div className="mt-6 space-y-4 text-left">
              <div className="p-4 bg-indigo-500/5 border border-indigo-500/15 rounded-2xl text-left">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  ⏳ ACCESS REQUEST SUBMITTED
                </h4>
                <p className="text-[11px] text-indigo-250 mt-2 leading-relaxed font-semibold">
                  Your access request is currently pending college administrator approval. Please wait for an admin to approve your request.
                </p>
                {blockedEntry?.request_statement && (
                  <div className="mt-3 p-3 bg-white/[0.03] border border-white/[0.04] rounded-xl text-[10px] text-slate-400 font-mono italic">
                    "{blockedEntry.request_statement}"
                  </div>
                )}
              </div>

              <button
                onClick={() => checkIpStatus()}
                className="w-full py-3 rounded-xl font-black text-xs text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer animate-pulse"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Check Approval Status
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// Synchronously add native-platform class on file load to prevent any heavy layout/blur render frames on mobile devices
if (typeof window !== 'undefined') {
  const ua = navigator.userAgent.toLowerCase();
  
  // Genuinely detect mobile platforms (Android/iOS) to apply mobile platform optimizations
  const isMobileNative = ua.includes('android') || 
                         ua.includes('iphone') || 
                         ua.includes('ipad') || 
                         ua.includes('ipod');
                         
  let isCapacitorMobile = false;
  if (typeof (window as any).Capacitor !== 'undefined') {
    const platform = (window as any).Capacitor.getPlatform?.();
    if (platform === 'android' || platform === 'ios') {
      isCapacitorMobile = true;
    }
  }

  if (isMobileNative || isCapacitorMobile) {
    document.body.classList.add('native-platform');
  }
}

export const GlobalDesktopControls: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [showDragOverlay, setShowDragOverlay] = useState(false);
  const dragCounter = useRef(0);

  // 1. Full-Window Drag & Drop Overlay
  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    if (!user || user.uid === 'guest-user-noteweb') return; // Only for logged in students
    
    dragCounter.current++;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setShowDragOverlay(true);
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setShowDragOverlay(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setShowDragOverlay(false);
    dragCounter.current = 0;

    if (!user || user.uid === 'guest-user-noteweb') return;

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const droppedFile = files[0];
      if (droppedFile.type === 'application/pdf') {
        // Redirect to upload page and pass the file
        navigate('/upload', { state: { droppedFile } });
      }
    }
  };

  useEffect(() => {
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    
    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [user]);

  // 2. Trackpad / Mouse Scroll horizontal conversion
  useEffect(() => {
    const handleHorizontalWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      const container = target.closest('.horizontal-scroll-list, .overflow-x-auto, [data-horizontal-scroll]') as HTMLElement;
      if (container) {
        e.preventDefault();
        container.scrollLeft += e.deltaY * 0.8; // Smooth horizontal scaling
      }
    };
    window.addEventListener('wheel', handleHorizontalWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleHorizontalWheel);
  }, []);

  // 3. Two-finger trackpad history navigation (Disabled to prevent accidental back/forward navigation when scrolling)
  /*
  useEffect(() => {
    let lastSwipe = 0;
    const handleTouchpadSwipe = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > 65) {
        const now = Date.now();
        if (now - lastSwipe < 1200) return;
        
        if (e.deltaX > 65) {
          window.history.forward();
          lastSwipe = now;
        } else if (e.deltaX < -65) {
          window.history.back();
          lastSwipe = now;
        }
      }
    };
    window.addEventListener('wheel', handleTouchpadSwipe, { passive: true });
    return () => window.removeEventListener('wheel', handleTouchpadSwipe);
  }, []);
  */

  // 4. Escape key global listener
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.dispatchEvent(new CustomEvent('close-noteweb-modals'));
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <>
      {children}

      {/* Global Drag & Drop Overlay */}
      {showDragOverlay && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#07070F]/85 backdrop-blur-md text-white border-4 border-dashed border-indigo-500/50 m-6 rounded-3xl animate-in fade-in zoom-in duration-200">
          <div className="w-24 h-24 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-6 shadow-[0_0_50px_rgba(99,102,241,0.2)]">
            <UploadCloud className="w-12 h-12 animate-bounce" />
          </div>
          <h2 className="text-3xl font-black tracking-tight mb-2">Drop your PDF anywhere!</h2>
          <p className="text-sm font-semibold text-slate-400 max-w-xs text-center leading-relaxed">
            Release the file anywhere on screen to prepare your study notes uploader instantly 🚀
          </p>
        </div>
      )}
    </>
  );
};

function App() {
  const [isLargeScreen, setIsLargeScreen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);

  useEffect(() => {
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

  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <IpBlockGuard>
            <ScreenshotProtection>
              <Router>
                <GlobalDesktopControls>
                  <ChatNotificationListener />
                  {/* Particle Network Background */}
                  <InteractiveBackground />
                  <div className="min-h-screen min-h-[100dvh] transition-colors duration-300 flex relative z-10 overflow-x-hidden bg-transparent text-[#0F172A] dark:text-[#E2E8F0]">
                    {/* Sidebar/Navigation */}
                    <Sidebar />

                {/* Fixed Floating Theme Toggle Button */}
                <FloatingThemeToggle />

                {/* Main Content: pt-14/safe-area for mobile top bar, pb-24 for bottom nav, lg:pl-20 for desktop dock */}
                <main 
                  className={`flex-1 min-w-0 px-0 transition-all duration-300 z-10 relative w-full ${showMobileUI ? 'pb-24' : 'pt-0 pb-6 pl-20'}`}
                  style={{
                    paddingTop: showMobileUI ? 'calc(env(safe-area-inset-top, 0px) + 3.5rem)' : undefined
                  }}
                >
                  <Routes>
                    {/* Publicly Accessible Routes */}
                    <Route path="/" element={<PageWrapper><Home /></PageWrapper>} />
                    <Route path="/about" element={<PageWrapper><About /></PageWrapper>} />
                    <Route path="/login" element={<PageWrapper><Login /></PageWrapper>} />
                    <Route path="/categories" element={<PageWrapper><Categories /></PageWrapper>} />
                    <Route path="/feed" element={<PageWrapper><Feed /></PageWrapper>} />

                    <Route
                      path="/upload"
                      element={
                        <ProtectedRoute>
                          <LocalErrorBoundary fallbackTitle="Upload Section Render Crash">
                            <PageWrapper><Upload /></PageWrapper>
                          </LocalErrorBoundary>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/profile"
                      element={
                        <ProtectedRoute>
                          <PageWrapper><Profile /></PageWrapper>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/profile/:uid"
                      element={
                        <ProtectedRoute>
                          <PageWrapper><Profile /></PageWrapper>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/chat"
                      element={
                        <ProtectedRoute>
                          <PageWrapper><Chat /></PageWrapper>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/leaderboard"
                      element={
                        <ProtectedRoute>
                          <PageWrapper><Leaderboard /></PageWrapper>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/quests"
                      element={
                        <ProtectedRoute>
                          <PageWrapper><Quests /></PageWrapper>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/feedback"
                      element={
                        <ProtectedRoute>
                          <PageWrapper><Feedback /></PageWrapper>
                        </ProtectedRoute>
                      }
                    />

                    {/* Protected Admin Controls */}
                    <Route
                      path="/admin"
                      element={
                        <ProtectedRoute adminOnly>
                          <PageWrapper><Admin /></PageWrapper>
                        </ProtectedRoute>
                      }
                    />
                  </Routes>
                </main>
              </div>
                </GlobalDesktopControls>
              </Router>
            </ScreenshotProtection>
          </IpBlockGuard>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;

