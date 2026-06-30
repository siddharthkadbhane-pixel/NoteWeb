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

  // Initialize transition overlay states on mount based on loading status
  const [isOverlaying, setIsOverlaying] = React.useState(loading);
  const [opacityClass, setOpacityClass] = React.useState(loading ? 'opacity-100' : 'opacity-0');

  // Track if auth has resolved at least once.
  // After the first resolution we NEVER show the loading spinner again
  const initialDoneRef = useRef(false);
  if (!loading) {
    initialDoneRef.current = true;
  }

  useEffect(() => {
    if (!loading) {
      // Begin skeleton fade out
      setOpacityClass('opacity-0');
      const timer = setTimeout(() => {
        setIsOverlaying(false);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [loading]);

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
  if (loading && initialDoneRef.current) {
    if (!user || isGuest) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
    return <>{children}</>;
  }

  // Redirect to login if not logged in at all, or if trying to access protected content in guest mode
  if (!loading && (!user || isGuest)) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && !isAdmin && !loading) {
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

  // Render cross-fade loader overlay if active
  if (isOverlaying) {
    return (
      <div className="relative w-full h-full">
        <div className="animate-fade-in">
          {children}
        </div>
        <div className={`fixed inset-0 z-50 transition-opacity duration-350 ease-out ${opacityClass} pointer-events-none`}>
          <AppSkeleton />
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
