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
        /* Premium, hardware-accelerated page transitions for native mobile app */
        .page-wrapper-native {
          animation: pageTransitionNative 0.32s cubic-bezier(0.32, 0.94, 0.6, 1) forwards;
          will-change: transform, opacity;
          transform: translate3d(0, 0, 0);
          backface-visibility: hidden;
          perspective: 1000px;
        }

        /* Premium, hardware-accelerated page transitions for web browser */
        .page-wrapper-web {
          animation: pageTransitionWeb 0.28s cubic-bezier(0.33, 1, 0.68, 1) forwards;
          will-change: transform, opacity;
          transform: translate3d(0, 0, 0);
          backface-visibility: hidden;
          perspective: 1000px;
        }

        @keyframes pageTransitionNative {
          from { 
            opacity: 0; 
            transform: translate3d(0, 16px, 0); 
          }
          to { 
            opacity: 1; 
            transform: translate3d(0, 0, 0); 
          }
        }

        @keyframes pageTransitionWeb {
          from { 
            opacity: 0; 
            transform: translate3d(0, 10px, 0) scale(0.99); 
          }
          to { 
            opacity: 1; 
            transform: translate3d(0, 0, 0) scale(1); 
          }
        }
      `}</style>
    </div>
  );
};

export default PageWrapper;

