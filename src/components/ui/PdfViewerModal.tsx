import React, { useState, useEffect, useRef } from 'react';
import { X, ExternalLink, Maximize2, Minimize2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
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
  const [isFullscreen, setIsFullscreen] = useState(false);

  // PDF.js State
  const [pdf, setPdf] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [renderError, setRenderError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);

  // Disable scrolling on body when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Load PDF Document
  useEffect(() => {
    let active = true;
    const loadPdf = async () => {
      setLoading(true);
      setRenderError(null);
      try {
        const pdfjsLib = await import('pdfjs-dist');
        const PDFJS_VERSION = '5.7.284';
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

        let arrayBuffer: ArrayBuffer;
        if (url.startsWith('blob:')) {
          const res = await fetch(url);
          arrayBuffer = await res.arrayBuffer();
        } else if (url.startsWith('data:application/pdf;base64,')) {
          const base64Str = url.substring('data:application/pdf;base64,'.length);
          const binaryStr = atob(base64Str);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          arrayBuffer = bytes.buffer;
        } else {
          // Remote HTTP URL - Try fetching with CORS
          const res = await fetch(url);
          if (!res.ok) throw new Error("CORS or network error fetching remote PDF.");
          arrayBuffer = await res.arrayBuffer();
        }

        if (!active) return;

        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        const loadedPdf = await loadingTask.promise;
        
        if (active) {
          setPdf(loadedPdf);
          setNumPages(loadedPdf.numPages);
          setPageNum(1);
          setLoading(false);
        }
      } catch (err: any) {
        console.warn("[PdfViewerModal] Failed to load PDF via PDF.js, falling back to Iframe viewer:", err.message);
        if (active) {
          setRenderError(err.message || "Dynamic canvas rendering not supported.");
          setLoading(false);
        }
      }
    };

    loadPdf();
    return () => {
      active = false;
    };
  }, [url]);

  // Render Page to Canvas
  useEffect(() => {
    if (!pdf) return;
    let active = true;

    const renderPage = async () => {
      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const page = await pdf.getPage(pageNum);
        if (!active) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        const viewport = page.getViewport({ scale });
        
        // Handle High DPI / Retina screens for sharp text
        const dpr = window.devicePixelRatio || 1;
        canvas.width = viewport.width * dpr;
        canvas.height = viewport.height * dpr;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        context.scale(dpr, dpr);

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error("[PdfViewerModal] Page render error:", err);
        }
      }
    };

    renderPage();
    return () => {
      active = false;
    };
  }, [pdf, pageNum, scale]);

  const handleNextPage = () => {
    if (pageNum < numPages) setPageNum(prev => prev + 1);
  };

  const handlePrevPage = () => {
    if (pageNum > 1) setPageNum(prev => prev - 1);
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.75));

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md transition-all duration-300 ${isFullscreen ? 'p-0' : 'p-4 md:p-6'}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className={`w-full h-full flex flex-col relative transition-all duration-300 ${isFullscreen ? 'max-w-full' : 'max-w-5xl'}`}
      >
        <GlassPanel 
          className={`w-full h-full flex flex-col border overflow-hidden transition-all duration-300 ${
            isFullscreen ? 'rounded-none border-none' : 'rounded-3xl'
          } ${
            isDark ? 'bg-[#0D0D14]/95 border-white/[0.08] text-white' : 'bg-white/98 border-slate-200 text-slate-800'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] light-mode:border-slate-200">
            <div className="flex flex-col text-left max-w-[50%]">
              <span className={`text-[10px] font-black uppercase tracking-wider ${isDark ? 'text-indigo-400' : 'text-indigo-650'}`}>
                In-App PDF Reader
              </span>
              <h3 className="text-sm font-extrabold truncate w-full" title={title}>
                {title}
              </h3>
            </div>

            <div className="flex items-center gap-1.5 md:gap-2">
              {/* Zoom Buttons (only visible if using Canvas render) */}
              {!renderError && pdf && (
                <div className="flex items-center gap-1 border-r border-white/10 pr-2 mr-2">
                  <button
                    onClick={zoomOut}
                    className={`p-1.5 rounded-lg border transition-all active:scale-95 flex items-center justify-center ${
                      isDark ? 'border-white/5 bg-white/[0.02] text-slate-400 hover:text-white' : 'border-slate-200 bg-slate-50 text-slate-500'
                    }`}
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    onClick={zoomIn}
                    className={`p-1.5 rounded-lg border transition-all active:scale-95 flex items-center justify-center ${
                      isDark ? 'border-white/5 bg-white/[0.02] text-slate-400 hover:text-white' : 'border-slate-200 bg-slate-50 text-slate-500'
                    }`}
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Fullscreen Toggle */}
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className={`p-2 rounded-xl border transition-all active:scale-95 flex items-center justify-center ${
                  isDark 
                    ? 'border-white/[0.08] bg-white/[0.02] text-slate-400 hover:text-white hover:bg-white/5' 
                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

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
                title="Open in browser"
              >
                <ExternalLink className="w-4 h-4" />
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
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Viewport content */}
          <div className="flex-1 bg-[#0A0A0E] relative w-full h-full overflow-auto flex items-start justify-center p-4">
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 z-20">
                <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest animate-pulse">
                  Loading PDF Document...
                </span>
              </div>
            )}

            {renderError ? (
              // Ultimate Fallback: iframe (if CORS blocked the direct ArrayBuffer fetch)
              <iframe
                src={url}
                className="w-full h-full border-none relative z-10"
                title={title}
                onLoad={() => setLoading(false)}
              />
            ) : (
              // Crisp Canvas Rendering
              <div className="shadow-2xl border border-white/5 rounded-lg overflow-hidden bg-white mx-auto my-2">
                <canvas ref={canvasRef} className="max-w-full block" />
              </div>
            )}
          </div>

          {/* Canvas Footer controls */}
          {!renderError && pdf && (
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-t border-white/[0.06] bg-black/20 text-slate-400">
              <button
                onClick={handlePrevPage}
                disabled={pageNum <= 1}
                className="px-3.5 py-1.5 rounded-xl border border-white/5 hover:border-white/10 bg-white/[0.02] hover:bg-white/[0.04] text-xs font-bold disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center gap-1 active:scale-95 cursor-pointer text-white"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              
              <span className="text-xs font-black text-slate-300">
                Page {pageNum} of {numPages}
              </span>

              <button
                onClick={handleNextPage}
                disabled={pageNum >= numPages}
                className="px-3.5 py-1.5 rounded-xl border border-white/5 hover:border-white/10 bg-white/[0.02] hover:bg-white/[0.04] text-xs font-bold disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center gap-1 active:scale-95 cursor-pointer text-white"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </GlassPanel>
      </motion.div>
    </div>
  );
};
