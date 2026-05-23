import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { Sidebar } from './components/Navigation/Sidebar';
import { ProtectedRoute } from './components/ProtectedRoute';

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
import { FloatingThemeToggle } from './components/Navigation/FloatingThemeToggle';
import { InteractiveBackground } from './components/ui/InteractiveBackground';
import { ScreenshotProtection } from './components/ScreenshotProtection';

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <ScreenshotProtection>
            <Router>
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

