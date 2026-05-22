import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, ShieldAlert } from 'lucide-react';

export const ScreenshotProtection: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile } = useAuth();
  const [isBlurred, setIsBlurred] = useState(false);

  const username = userProfile?.username || 'Guest';

  useEffect(() => {
    // 1. Tab Focus & Visibility change handlers
    const handleBlur = () => setIsBlurred(true);
    const handleFocus = () => setIsBlurred(false);
    
    const handleVisibilityChange = () => {
      if (document.hidden || document.visibilityState === 'hidden') {
        setIsBlurred(true);
      } else {
        setIsBlurred(false);
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 2. Prevent print shortcut (Ctrl+P) and PrintScreen key
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Ctrl + P
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        alert('NoteWeb Security: Printing/PDF Saving is strictly prohibited.');
      }
      
      // Block PrintScreen key
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        navigator.clipboard.writeText(''); // Clear clipboard immediately
        alert('NoteWeb Security: Screenshots are protected. Clipboard cleared.');
      }
    };

    // 3. Block text copying globally
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      alert('NoteWeb Security: Copying note text is strictly prohibited.');
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('copy', handleCopy);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('copy', handleCopy);
    };
  }, []);

  return (
    <div className="relative min-h-screen w-full select-none">
      {/* 1. Global Print Shield Styling */}
      <style>{`
        @media print {
          body {
            display: none !important;
          }
        }
        ::selection {
          background: transparent !important;
          color: inherit !important;
        }
      `}</style>

      {/* 2. Main app content */}
      <div className={`transition-all duration-300 ${isBlurred ? 'filter blur-2xl scale-[0.98] pointer-events-none' : ''}`}>
        {children}
      </div>

      {/* 3. Translucent Rotating Watermarks Grid Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden opacity-[0.03] select-none grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-y-24 gap-x-12">
        {Array.from({ length: 48 }).map((_, i) => (
          <div
            key={i}
            className="text-[10px] sm:text-xs font-black uppercase text-white transform -rotate-[25deg] whitespace-nowrap"
          >
            {username} • NOTEWEB SECURE
          </div>
        ))}
      </div>

      {/* 4. Glassmorphic Screen Shield Overlay */}
      {isBlurred && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-3xl animate-fade-in p-6 text-center select-none">
          <div className="relative mb-6">
            {/* Pulsing ring glowing accents */}
            <div className="absolute inset-0 rounded-3xl bg-indigo-600/30 blur-xl animate-pulse scale-125" />
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-indigo-700 flex items-center justify-center border border-white/10 shadow-2xl relative">
              <Lock className="w-9 h-9 text-white animate-bounce" />
            </div>
          </div>
          
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-indigo-400 animate-pulse" /> NoteWeb Shield Active
          </h2>
          <p className="text-sm font-semibold text-slate-400 max-w-sm mt-3 leading-relaxed">
            Screen capture is locked. Please click inside the browser window to restore access to study notes library.
          </p>
        </div>
      )}
    </div>
  );
};
