import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/config';
import { Lock, Eye, EyeOff, ShieldCheck, ArrowRight, ChevronLeft } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { GlassPanel } from '../components/ui/GlassPanel';

export const ResetPassword: React.FC = () => {
  const { success, error: toastError } = useToast();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    // Check if the user is authenticated (meaning they clicked the recovery link and Supabase logged them in)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toastError('No active recovery session found. Please request a new password reset link.');
        navigate('/login');
      } else {
        setHasSession(true);
      }
    };
    checkSession();
  }, [navigate, toastError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toastError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      toastError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      success('Password reset successfully! You can now log in.');
      navigate('/login');
    } catch (err: any) {
      toastError(err.message || 'Failed to update password.');
    } finally {
      setIsLoading(false);
    }
  };

  const bg = isDark
    ? 'bg-[#0D0D14]/95 border-white/[0.08] text-slate-100'
    : 'bg-white/98 border-slate-200/90 text-slate-800';

  const inputCls = `w-full rounded-xl px-4 py-3 text-sm font-medium outline-none transition-all border
    ${isDark
      ? 'bg-white/[0.03] border-white/[0.08] text-slate-100 placeholder-slate-600 focus:border-indigo-500/60 focus:bg-white/[0.05]'
      : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-400 focus:bg-white'
    }`;

  const labelCls = `block text-[11px] font-black uppercase tracking-wider mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`;

  if (!hasSession) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center py-12 px-4 relative overflow-hidden bg-transparent">
        <div className="w-8 h-8 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center py-12 px-4 relative overflow-hidden bg-transparent">
      {/* Glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 glow-indigo rounded-full pointer-events-none blur-3xl opacity-20" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 glow-purple rounded-full pointer-events-none blur-3xl opacity-20" />

      <div className="w-full max-w-md relative z-10">
        <GlassPanel className={`p-8 text-center border shadow-2xl rounded-3xl ${bg}`}>
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 mx-auto mb-6">
            <ShieldCheck className="w-6 h-6" />
          </div>

          <h2 className="text-2xl font-black tracking-tight mb-2">Reset Password</h2>
          <p className="text-xs text-slate-500 mb-6 font-semibold">
            Choose a new, strong password for your NoteWeb account.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <label className={labelCls}>New Password</label>
              <div className="relative">
                <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters..."
                  className={inputCls + " pl-10 pr-10"}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className={labelCls}>Confirm New Password</label>
              <div className="relative">
                <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password..."
                  className={inputCls + " pl-10 pr-10"}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-300 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl font-black text-sm text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><ArrowRight className="w-4 h-4" /> Save New Password</>
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full py-3 text-xs font-extrabold text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" /> Back to Login
            </button>
          </form>
        </GlassPanel>
      </div>
    </div>
  );
};
