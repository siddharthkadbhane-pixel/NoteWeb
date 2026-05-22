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
import { ScreenshotProtection } from './components/ScreenshotProtection';

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <ScreenshotProtection>
            <Router>
              <div className="min-h-screen min-h-[100dvh] bg-[#0A0A0C] text-[#E4E4E7] light-mode:bg-[#F8F9FA] light-mode:text-[#1E293B] transition-colors duration-300 flex overscroll-y-none">
                {/* Collapsible, responsive Frosted glass sidebar */}
                <Sidebar />
                
                {/* Main Content Area: Responsive offsets for mobile topbar and desktop sidebar */}
                <main className="flex-1 min-w-0 pt-16 lg:pt-0 pl-0 lg:pl-64 transition-all duration-300 pb-safe">
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

