import { HashRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Navigation/Sidebar';
import { ProtectedRoute } from './components/ProtectedRoute';

// Import NoteWeb Pages
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Categories } from './pages/Categories';
import { Feed } from './pages/Feed';
import { Upload } from './pages/Upload';
import { Profile } from './pages/Profile';
import { Admin } from './pages/Admin';
import { DetailsSetup } from './pages/DetailsSetup';

// Onboarding Filter to force new students to set up their name & avatar
const OnboardingFilter: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userProfile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <>{children}</>;

  if (
    user && 
    userProfile && 
    userProfile.setupComplete === false && 
    location.pathname !== '/setup-profile' &&
    location.pathname !== '/login' &&
    location.pathname !== '/register'
  ) {
    return <Navigate to="/setup-profile" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <Router>
            <div className="min-h-screen bg-[#0A0A0C] text-[#E4E4E7] light-mode:bg-[#F8F9FA] light-mode:text-[#1E293B] transition-colors duration-300 flex">
              {/* Collapsible, responsive Frosted glass sidebar */}
              <Sidebar />
              
              {/* Main Content Area: Responsive offsets for mobile topbar and desktop sidebar */}
              <main className="flex-1 min-w-0 pt-16 lg:pt-0 pl-0 lg:pl-64 transition-all duration-300">
                <OnboardingFilter>
                  <Routes>
                    {/* Publicly Accessible Routes */}
                    <Route path="/" element={<Home />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/categories" element={<Categories />} />
                    <Route path="/feed" element={<Feed />} />

                    {/* Onboarding setup route */}
                    <Route 
                      path="/setup-profile" 
                      element={
                        <ProtectedRoute>
                          <DetailsSetup />
                        </ProtectedRoute>
                      } 
                    />

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
                </OnboardingFilter>
              </main>
            </div>
          </Router>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;

