import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Navigation/Sidebar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { supabase } from './supabase/config';
import { ShieldAlert, Send, RefreshCw } from 'lucide-react';
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
import { FloatingThemeToggle } from './components/Navigation/FloatingThemeToggle';
import { InteractiveBackground } from './components/ui/InteractiveBackground';
import { ScreenshotProtection } from './components/ScreenshotProtection';

export const ChatNotificationListener: React.FC = () => {
  const { user } = useAuth();
  const { info } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

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
              if (location.pathname !== '/chat' && payload.new) {
                const senderId = payload.new.sender_id || payload.new.sender_uid;
                if (senderId !== user.uid) {
                  const senderName = payload.new.sender_name || 'Classmate';
                  const messageText = payload.new.message || payload.new.content || 'Sent a message';
                  
                  info(
                    `💬 ${senderName}: "${messageText.substring(0, 45)}${messageText.length > 45 ? '...' : ''}"`,
                    5500,
                    () => navigate('/chat')
                  );
                }
              }
            }
          )
          .on(
            'broadcast',
            { event: 'message' },
            (response: any) => {
              console.log('[NoteWeb Notifications] Realtime P2P chat broadcast:', response);
              if (location.pathname !== '/chat' && response?.payload) {
                const msg = response.payload;
                if (msg.sender_uid !== user.uid) {
                  const senderName = msg.sender_name || 'Classmate';
                  const messageText = msg.content || 'Sent an image or message';
                  
                  info(
                    `💬 ${senderName}: "${messageText.substring(0, 45)}${messageText.length > 45 ? '...' : ''}"`,
                    5500,
                    () => navigate('/chat')
                  );
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
  }, [user, location.pathname, info, navigate]);

  return null;
};

// Fetch current user IP address with multiple public API fallbacks & offline mocks
const fetchUserIp = async (): Promise<string> => {
  try {
    const res = await fetch('https://api.seeip.org/jsonip', { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) return data.ip;
    }
  } catch {}
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) return data.ip;
    }
  } catch {}
  
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
  const [loading, setLoading] = useState(true);

  const checkIpStatus = async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    }
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
      if (isInitial) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    checkIpStatus(true); // Initial check with visible loading screen

    // Setup periodic watchdog checking IP/hardware status silently every 10 seconds in the background
    const interval = setInterval(() => checkIpStatus(false), 10000);

    // Listen for storage changes (clearing block) across browser tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'noteweb-db-blocked_ips') {
        checkIpStatus(false);
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
            checkIpStatus(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020204] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Verifying secure IP credentials...</span>
        </div>
      </div>
    );
  }

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
                onClick={() => checkIpStatus(true)}
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

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <IpBlockGuard>
            <ScreenshotProtection>
              <Router>
                <ChatNotificationListener />
                <div className="min-h-screen min-h-[100dvh] transition-colors duration-300 flex relative overflow-x-hidden bg-[#F4F4F6] text-[#0F172A] dark:bg-[#020204] dark:text-[#E2E8F0]">
                {/* Particle Network Background */}
                <InteractiveBackground />

                {/* Sidebar/Navigation */}
                <Sidebar />

                {/* Fixed Floating Theme Toggle Button */}
                <FloatingThemeToggle />

                {/* Main Content: pt-14 for mobile top bar, pb-24 for bottom nav, lg:pl-20 for desktop dock */}
                <main className="flex-1 min-w-0 pt-14 lg:pt-0 pb-24 lg:pb-6 lg:pl-20 px-0 transition-all duration-300 z-10 relative w-full">
                  <Routes>
                    {/* Publicly Accessible Routes */}
                    <Route path="/" element={<Home />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/categories" element={<Categories />} />
                    <Route path="/feed" element={<Feed />} />

                    {/* Protected Student Features */}
                    <Route
                      path="/upload"
                      element={
                        <ProtectedRoute>
                          <Upload />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/profile"
                      element={
                        <ProtectedRoute>
                          <Profile />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/profile/:uid"
                      element={
                        <ProtectedRoute>
                          <Profile />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/chat"
                      element={
                        <ProtectedRoute>
                          <Chat />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/leaderboard"
                      element={
                        <ProtectedRoute>
                          <Leaderboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/feedback"
                      element={
                        <ProtectedRoute>
                          <Feedback />
                        </ProtectedRoute>
                      }
                    />

                    {/* Protected Admin Controls */}
                    <Route
                      path="/admin"
                      element={
                        <ProtectedRoute adminOnly>
                          <Admin />
                        </ProtectedRoute>
                      }
                    />
                  </Routes>
                </main>
              </div>
              </Router>
            </ScreenshotProtection>
          </IpBlockGuard>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;

