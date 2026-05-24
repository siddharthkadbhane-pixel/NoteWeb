import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  onClick?: () => void;
}

interface ToastContextType {
  show: (message: string, type?: ToastType, duration?: number, onClick?: () => void) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number, onClick?: () => void) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((message: string, type: ToastType = 'info', duration = 4000, onClick?: () => void) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message, duration, onClick }]);

    setTimeout(() => {
      remove(id);
    }, duration);
  }, [remove]);

  const success = useCallback((message: string, duration?: number) => show(message, 'success', duration), [show]);
  const error = useCallback((message: string, duration?: number) => show(message, 'error', duration), [show]);
  const info = useCallback((message: string, duration?: number, onClick?: () => void) => show(message, 'info', duration, onClick), [show]);

  return (
    <ToastContext.Provider value={{ show, success, error, info }}>
      {children}
      {/* Toast Portal Container */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-md w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, y: -10, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.9, transition: { duration: 0.2 } }}
              className={`pointer-events-auto ${toast.onClick ? 'cursor-pointer select-none active:scale-[0.98] transition-transform' : ''}`}
              onClick={() => {
                if (toast.onClick) {
                  toast.onClick();
                  remove(toast.id);
                }
              }}
            >
              <div className="glass-panel backdrop-blur-md rounded-xl p-4 flex items-start gap-3 border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.15)] bg-slate-900/80 light-mode:bg-white/90">
                {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />}
                {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />}
                {toast.type === 'info' && <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />}

                <div className="flex-1 text-sm font-medium text-slate-200 light-mode:text-slate-800">
                  {toast.message}
                </div>

                <button
                  onClick={() => remove(toast.id)}
                  className="text-slate-400 hover:text-white light-mode:text-slate-500 light-mode:hover:text-slate-800 transition-colors p-0.5 rounded-lg hover:bg-white/5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
