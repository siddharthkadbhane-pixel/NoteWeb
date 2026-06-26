import React, { useState, useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { GlassPanel } from './GlassPanel';

interface PdfViewerModalProps {
  url: string;
  title: string;
  onClose: () => void;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({ url, title, onClose }) => {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);

  // Disable scrolling on body when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 md:p-6">
      {/* Backdrop motion wrapper */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className="w-full h-full max-w-5xl flex flex-col relative"
      >
        <GlassPanel 
          className={`w-full h-full flex flex-col border rounded-3xl overflow-hidden ${
            isDark ? 'bg-[#0D0D14]/95 border-white/[0.08] text-white' : 'bg-white/98 border-slate-200 text-slate-800'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] light-mode:border-slate-200">
            <div className="flex flex-col text-left max-w-[70%]">
              <span className={`text-[10px] font-black uppercase tracking-wider ${isDark ? 'text-indigo-400' : 'text-indigo-650'}`}>
                In-App PDF Reader
              </span>
              <h3 className="text-sm font-extrabold truncate w-full" title={title}>
                {title}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              {/* External open fallback */}
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={`p-2 rounded-xl border transition-all active:scale-95 flex items-center justify-center ${
                  isDark 
                    ? 'border-white/[0.08] bg-white/[0.02] text-slate-400 hover:text-white hover:bg-white/5' 
                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
                title="Open in new tab"
              >
                <ExternalLink className="w-4.5 h-4.5" />
              </a>

              {/* Close Button */}
              <button
                onClick={onClose}
                className={`p-2 rounded-xl border transition-all active:scale-95 flex items-center justify-center ${
                  isDark 
                    ? 'border-white/[0.08] bg-white/[0.02] text-slate-400 hover:text-white hover:bg-white/5' 
                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
                title="Close Viewer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* Iframe View */}
          <div className="flex-1 bg-slate-950/20 relative w-full h-full">
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest animate-pulse">
                  Loading PDF Document...
                </span>
              </div>
            )}
            <iframe
              src={url}
              className="w-full h-full border-none relative z-10"
              title={title}
              onLoad={() => setLoading(false)}
            />
          </div>
        </GlassPanel>
      </motion.div>
    </div>
  );
};
