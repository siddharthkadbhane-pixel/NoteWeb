import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  adminOnly = false 
}) => {
  const { user, userProfile, loading, isAdmin, isGuest } = useAuth();
  const { error } = useToast();
  const location = useLocation();

  // Track if auth has resolved at least once.
  // After the first resolution we NEVER show the loading spinner again —
  // this prevents the blank screen on second/subsequent navigations where
  // Supabase's onAuthStateChange briefly re-fires and sets loading=true.
  const initialDoneRef = useRef(false);
  if (!loading) {
    initialDoneRef.current = true;
  }

  useEffect(() => {
    if (!loading && isGuest) {
      error('Student account required to upload notes or view profiles.');
    }
  }, [isGuest, loading, error]);

  // Only block on the very first load, never on revisits
  if (loading && !initialDoneRef.current) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0A0A0C] transition-colors duration-300">
        <div className="relative flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20 animate-pulse">
            <span className="font-extrabold text-white text-2xl">N</span>
          </div>
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="text-sm font-semibold text-slate-400 tracking-wider uppercase animate-pulse">
            Loading NoteWeb...
          </span>
        </div>
      </div>
    );
  }

  // If still loading but we've seen a valid user before, render children optimistically
  // (avoids blank screen flash when auth briefly re-checks)
  if (loading && initialDoneRef.current) {
    if (!user || isGuest) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
    // Auth was valid before — show content immediately
    return <>{children}</>;
  }

  // Redirect to login if not logged in at all, or if trying to access protected content in guest mode
  if (!user || isGuest) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && !isAdmin) {
    console.warn(`[NoteWeb Security Alert] Unauthorized attempt to access admin view!`, {
      authenticated: !!user,
      userEmail: user?.email || 'N/A',
      uid: user?.uid || 'N/A',
      role: userProfile?.role || 'guest/none',
      isAdmin,
      isGuest,
      timestamp: new Date().toISOString()
    });
    error('Access Denied: Admin privileges required.');
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
