import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppSkeleton } from './ui/AppSkeleton';

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
    return <AppSkeleton />;
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
