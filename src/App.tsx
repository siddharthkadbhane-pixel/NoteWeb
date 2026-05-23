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
import { Quiz } from './pages/Quiz';
import { InteractiveBackground } from './components/ui/InteractiveBackground';
import { ScreenshotProtection } from './components/ScreenshotProtection';

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <ScreenshotProtection>
            <Router>
              <div className="min-h-screen min-h-[100dvh] bg-[#0A0A0C] text-[#E4E4E7] light-mode:bg-[#F8F9FA] light-mode:text-[#1E293B] transition-colors duration-300 flex relative overflow-x-hidden">
                {/* 3D Geometric Floating Particle Network Background */}
                <InteractiveBackground />

                {/* Collapsible, responsive Frosted glass sidebar */}
                <Sidebar />
                
                {/* Main Content Area: Adjusted spacing for floating left dock (desktop) & bottom nav pill (mobile) */}
                <main className="flex-1 min-w-0 pt-20 lg:pt-8 pb-28 lg:pb-8 lg:pl-28 px-4 md:px-8 transition-all duration-300 pb-safe z-10 relative">
                  <Routes>
                    {/* Publicly Accessible Routes */}
                    <Route path="/" element={<Home />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/categories" element={<Categories />} />
                    <Route path="/feed" element={<Feed />} />
                    <Route path="/quiz" element={<Quiz />} />

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

