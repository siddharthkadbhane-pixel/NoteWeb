import React, { useState } from 'react';
import { Sparkles, X, Brain, CheckSquare, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabase/config';
import { extractTextFromPdf } from '../../services/pdf';
import { summarizeNotes } from '../../services/gemini';
import { useToast } from '../../context/ToastContext';
import { Button } from '../ui/Button';

interface AISummaryProps {
  noteId: string;
  pdfUrl: string;
  existingSummary?: string;
  isOpen: boolean;
  onClose: () => void;
  onSummaryUpdated?: (newSummary: string) => void;
}

export const AISummary: React.FC<AISummaryProps> = ({
  noteId,
  pdfUrl,
  existingSummary,
  isOpen,
  onClose,
  onSummaryUpdated
}) => {
  const { success, error } = useToast();
  const [summary, setSummary] = useState<string | undefined>(existingSummary);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerateSummary = async () => {
    setIsLoading(true);
    try {
      success("Initializing AI Assistant... Downloading PDF text layers.");
      
      // Fetch the PDF from URL as a Blob
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error("Could not download note PDF file.");
      
      const blob = await response.blob();
      const file = new File([blob], "temp_note.pdf", { type: "application/pdf" });
      
      // Extract text
      const extractedText = await extractTextFromPdf(file);
      
      // Summarize
      success("Analyzing notes and generating summary...");
      const aiSummaryText = await summarizeNotes(extractedText);
      
      // Save to Supabase
      const { error: updateErr } = await supabase
        .from('notes')
        .update({ summary: aiSummaryText })
        .eq('id', noteId);
        
      if (updateErr) throw updateErr;

      setSummary(aiSummaryText);
      if (onSummaryUpdated) {
        onSummaryUpdated(aiSummaryText);
      }
      
      success("AI Summary generated and saved!");
    } catch (e: any) {
      console.error(e);
      error("Failed to generate AI summary: " + (e.message || "Unknown error"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-lg z-50 glass-panel border-l border-white/[0.08] bg-[#0A0A0C]/95 p-6 flex flex-col gap-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] light-mode:bg-white/95"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                  <Brain className="w-5 h-5 animate-pulse" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-bold text-white light-mode:text-slate-900 flex items-center gap-1.5">
                    Gemini AI Summarizer <Sparkles className="w-4 h-4 text-purple-400" />
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Instant study guides and key formulas</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/5 transition-all light-mode:text-slate-600 light-mode:hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 text-left">
              {isLoading ? (
                <div className="h-64 flex flex-col items-center justify-center gap-4 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                  <span className="text-sm font-semibold tracking-wider uppercase animate-pulse">
                    Extracting & Summarizing Notes...
                  </span>
                </div>
              ) : summary ? (
                <div className="prose prose-invert max-w-none text-slate-300 light-mode:text-slate-700 light-mode:prose-slate">
                  {/* Process markdown highlights */}
                  <div className="space-y-4 leading-relaxed text-sm">
                    {summary.split('\n').map((line, idx) => {
                      if (line.startsWith('### ')) {
                        return <h3 key={idx} className="text-base font-extrabold text-white light-mode:text-slate-900 mt-6 mb-2 border-b border-white/5 pb-1 flex items-center gap-2">{line.replace('### ', '')}</h3>;
                      }
                      if (line.startsWith('#### ')) {
                        return <h4 key={idx} className="text-sm font-bold text-indigo-400 light-mode:text-indigo-600 mt-5 mb-2 flex items-center gap-1.5">{line.replace('#### ', '')}</h4>;
                      }
                      if (line.startsWith('- **') || line.startsWith('* **')) {
                        const match = line.match(/^[-*]\s+\*\*(.*?)\*\*:(.*)/);
                        if (match) {
                          return (
                            <div key={idx} className="pl-4 border-l-2 border-indigo-500/40 my-2">
                              <span className="font-semibold text-slate-100 light-mode:text-slate-900">{match[1]}:</span>
                              <span>{match[2]}</span>
                            </div>
                          );
                        }
                      }
                      if (line.startsWith('- [ ] ')) {
                        return (
                          <div key={idx} className="flex items-start gap-2.5 my-1.5 pl-2">
                            <CheckSquare className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                            <span className="text-xs font-medium">{line.replace('- [ ] ', '')}</span>
                          </div>
                        );
                      }
                      if (line.startsWith('- ') || line.startsWith('* ')) {
                        return (
                          <div key={idx} className="flex items-start gap-2.5 my-1.5 pl-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2 flex-shrink-0" />
                            <span>{line.replace(/^[-*]\s+/, '')}</span>
                          </div>
                        );
                      }
                      return <p key={idx} className="my-1">{line}</p>;
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center gap-6">
                  <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
                    <Brain className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white light-mode:text-slate-900">No Summary Available</h4>
                    <p className="text-xs text-slate-500 max-w-xs mt-1">
                      This note doesn't have an AI summary yet. Let our AI read the PDF and compile the key concepts for you!
                    </p>
                  </div>
                  <Button
                    onClick={handleGenerateSummary}
                    variant="primary"
                    leftIcon={<Sparkles className="w-4 h-4" />}
                  >
                    Generate AI Summary
                  </Button>
                </div>
              )}
            </div>

            {/* Footer */}
            {summary && (
              <div className="border-t border-white/[0.08] pt-4 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Powered by Gemini 2.5 Flash</span>
                <Button
                  onClick={handleGenerateSummary}
                  variant="secondary"
                  size="sm"
                  leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                  disabled={isLoading}
                >
                  Regenerate
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
