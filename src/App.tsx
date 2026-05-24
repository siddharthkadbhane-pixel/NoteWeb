import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Navigation/Sidebar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { supabase } from './supabase/config';

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

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
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
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;

