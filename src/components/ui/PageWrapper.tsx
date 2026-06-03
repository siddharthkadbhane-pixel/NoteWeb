import React from 'react';
import { useLocation } from 'react-router-dom';

interface PageWrapperProps {
  children: React.ReactNode;
}

export const PageWrapper: React.FC<PageWrapperProps> = ({ children }) => {
  const location = useLocation();
  
  // Synchronous check without importing @capacitor/core to prevent bundler errors on laptop/web
  const isNative = typeof window !== 'undefined' && (
    typeof (window as any).Capacitor !== 'undefined' || 
    /android|iphone|ipad|ipod|capacitor/i.test(navigator.userAgent)
  );

  return (
    <div
      key={location.key}
      className={isNative ? 'page-wrapper-native' : 'page-wrapper-web'}
      style={{ transform: 'translateZ(0)', willChange: 'transform' }}
    >
      {children}
      <style>{`
        /* Native Android: NO animations at all - instant rendering for 100% stability and zero freezes */
        .page-wrapper-native {
          opacity: 1 !important;
          transform: none !important;
          animation: none !important;
          will-change: auto !important;
        }

        /* Web browser: gentle fade + slide (safe on desktop/web) */
        .page-wrapper-web {
          animation: pageTransitionWeb 0.22s ease-out forwards;
          will-change: opacity, transform;
        }
        @keyframes pageTransitionWeb {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
    </div>
  );
};

export default PageWrapper;

