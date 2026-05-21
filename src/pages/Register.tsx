import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, User, UserPlus, ArrowRight, Phone, KeyRound, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { GlassPanel } from '../components/ui/GlassPanel';
import { motion, AnimatePresence } from 'framer-motion';

export const Register: React.FC = () => {
  const { signup, signInWithGoogle, signInWithPhone, confirmPhoneOtp, loginAsGuest, updateProfileDetails } = useAuth();
  const { success, error: toastError, info } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [authMethod, setAuthMethod] = useState<'email' | 'mobile'>('email');

  // Common states
  const [displayName, setDisplayName] = useState('');

  // Email states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Mobile states
  const [phoneNumber, setPhoneNumber] = useState('+91 ');
  const [otpCode, setOtpCode] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  const [errors, setErrors] = useState<{
    displayName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    phone?: string;
    otp?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);

  // Detect if we are running in Mock Mode
  const isMockMode = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('mock');

  // Redirect back to the page the user was trying to access, or default to Home
  const from = (location.state as any)?.from?.pathname || '/';

  const validateEmailForm = () => {
    const newErrors: typeof errors = {};
    
    if (!displayName.trim()) {
      newErrors.displayName = 'Full name is required';
    } else if (displayName.trim().length < 2) {
      newErrors.displayName = 'Name must be at least 2 characters';
    }

    if (!email) {
      newErrors.email = 'Email address is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmailForm()) return;

    setIsLoading(true);
    try {
      await signup(email, password, displayName);
      success('Account created successfully! Welcome to NoteWeb.');
      navigate(from, { replace: true });
    } catch (err: any) {
      console.error(err);
      let errMsg = 'Failed to create account. Please try again.';
      if (err.code === 'auth/email-already-in-use') {
        errMsg = 'An account with this email address already exists.';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = 'The email address is invalid.';
      } else if (err.code === 'auth/weak-password') {
        errMsg = 'The password is too weak. Please choose a stronger password.';
      }
      toastError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSubmit = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
      success('Signed in successfully with Google account!');
      navigate(from, { replace: true });
    } catch (err: any) {
      console.error(err);
      toastError(err.message || 'Google authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};
    if (!displayName.trim()) {
      newErrors.displayName = 'Full name is required';
    }
    if (!phoneNumber || phoneNumber.trim().length < 8) {
      newErrors.phone = 'Please enter a valid phone number with country code (e.g. +91 98765 43210)';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setIsLoading(true);

    try {
      const result = await signInWithPhone(phoneNumber);
      setConfirmationResult(result);
      setIsOtpSent(true);
      
      if (isMockMode) {
        success('Mock SMS OTP sent! Use verification code: 123456');
        info('Testing tip: Any 6-digit input works, but enter 123456 for a successful boot!');
      } else {
        success('Verification code sent to your mobile number!');
      }
    } catch (err: any) {
      console.error(err);
      toastError(err.message || 'Failed to dispatch verification code. Ensure your number includes country code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setErrors({ otp: 'Verification code must be exactly 6 digits' });
      return;
    }
    setErrors({});
    setIsLoading(true);

    try {
      if (isMockMode) {
        await confirmationResult.confirm(otpCode);
      } else {
        await confirmPhoneOtp(confirmationResult, otpCode);
      }

      if (displayName.trim()) {
        try {
          await updateProfileDetails(displayName.trim());
        } catch (nameErr) {
          console.warn("Failed to set display name:", nameErr);
        }
      }

      success('Mobile number verified successfully! Welcome to NoteWeb.');
      navigate(from, { replace: true });
    } catch (err: any) {
      console.error(err);
      toastError(err.message || 'Incorrect verification code. Please request a new one.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestClick = () => {
    loginAsGuest();
    success('Welcome! Logged in under Guest session.');
    navigate('/');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 relative overflow-hidden py-12">
      {/* Background glowing accents */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 glow-purple rounded-full pointer-events-none blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 left-1/4 w-96 h-96 glow-indigo rounded-full pointer-events-none blur-3xl animate-pulse" />

      {/* Hidden recaptcha element */}
      <div id="recaptcha-container"></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-3 mb-4 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-xl shadow-purple-600/20 group-hover:scale-105 transition-transform duration-300">
              <span className="font-extrabold text-white text-xl">N</span>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">NoteWeb</span>
          </Link>
          <h2 className="text-3xl font-extrabold tracking-tight text-white light-mode:text-slate-900">Create Account</h2>
          <p className="mt-2 text-sm text-slate-400 light-mode:text-slate-500 font-medium">
            Join thousands of college students sharing resources today
          </p>
        </div>

        {/* Card */}
        <GlassPanel glowBorder className="bg-[#16161D]/30 light-mode:bg-white/85 p-8 shadow-2xl">
          
          {/* Method Selection Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl mb-6 light-mode:bg-slate-900/[0.03] light-mode:border-slate-900/[0.06]">
            <button
              onClick={() => {
                setAuthMethod('email');
                setErrors({});
              }}
              className={`
                flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-all duration-300
                ${authMethod === 'email' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15' 
                  : 'text-slate-400 hover:text-slate-200'}
              `}
            >
              <Mail className="w-3.5 h-3.5" />
              Email SignUp
            </button>
            <button
              onClick={() => {
                setAuthMethod('mobile');
                setErrors({});
              }}
              className={`
                flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-all duration-300
                ${authMethod === 'mobile' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15' 
                  : 'text-slate-400 hover:text-slate-200'}
              `}
            >
              <Phone className="w-3.5 h-3.5" />
              Mobile OTP
            </button>
          </div>

          <AnimatePresence mode="wait">
            {authMethod === 'email' ? (
              /* EMAIL SIGN UP FORM */
              <motion.form
                key="email-signup"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleEmailSubmit}
                className="space-y-4 text-left"
              >
                <Input
                  label="Full Name"
                  type="text"
                  placeholder="Alex Johnson"
                  icon={<User className="w-4 h-4" />}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  error={errors.displayName}
                  autoComplete="name"
                  required
                />

                <Input
                  label="Email Address"
                  type="email"
                  placeholder="you@college.edu"
                  icon={<Mail className="w-4 h-4" />}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={errors.email}
                  autoComplete="email"
                  required
                />

                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  icon={<Lock className="w-4 h-4" />}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={errors.password}
                  autoComplete="new-password"
                  required
                />

                <Input
                  label="Confirm Password"
                  type="password"
                  placeholder="••••••••"
                  icon={<Lock className="w-4 h-4" />}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={errors.confirmPassword}
                  autoComplete="new-password"
                  required
                />

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full py-3"
                  isLoading={isLoading}
                  rightIcon={<UserPlus className="w-4 h-4" />}
                >
                  Register Account
                </Button>
              </motion.form>
            ) : (
              /* MOBILE SIGN UP + OTP FORM */
              <motion.div
                key="mobile-signup"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="text-left"
              >
                {!isOtpSent ? (
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <Input
                      label="Full Name"
                      type="text"
                      placeholder="Alex Johnson"
                      icon={<User className="w-4 h-4" />}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      error={errors.displayName}
                      required
                    />

                    <Input
                      label="Mobile Number"
                      type="tel"
                      placeholder="+91 98765 43210"
                      icon={<Phone className="w-4 h-4" />}
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      error={errors.phone}
                      required
                    />
                    <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                      * Enter your active mobile number including country code (e.g. +91 for India, +1 for US). Supabase requires country parameters to forward OTP SMS securely.
                    </p>
                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full py-3"
                      isLoading={isLoading}
                      rightIcon={<ArrowRight className="w-4 h-4" />}
                    >
                      Request Verification OTP
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-3 mb-2 flex items-center justify-between">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-semibold text-slate-400">Name: <b className="text-slate-200">{displayName}</b></span>
                        <span className="text-[11px] font-semibold text-slate-400">Number: <b className="text-slate-200">{phoneNumber}</b></span>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setIsOtpSent(false)} 
                        className="text-[11px] font-extrabold text-indigo-400 hover:text-indigo-300 transition-colors align-self-start"
                      >
                        Change
                      </button>
                    </div>
                    <Input
                      label="Verification Code (OTP)"
                      type="text"
                      maxLength={6}
                      placeholder="Enter 6-digit OTP"
                      icon={<KeyRound className="w-4 h-4" />}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      error={errors.otp}
                      required
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full py-3"
                      isLoading={isLoading}
                      rightIcon={<UserPlus className="w-4 h-4" />}
                    >
                      Verify & Create Account
                    </Button>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Social Sign-In Divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/[0.06] light-mode:border-slate-900/[0.06]" />
            </div>
            <span className="relative px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-[#16161D]/5 bg-[#1a1b24] light-mode:bg-[#F8F9FA]">
              Or continue with
            </span>
          </div>

          {/* Google Access Button */}
          <button
            onClick={handleGoogleSubmit}
            disabled={isLoading}
            className="w-full h-11 rounded-xl border border-white/[0.08] bg-white/[0.02] text-slate-200 flex items-center justify-center font-bold text-xs hover:bg-white/[0.05] hover:border-white/20 hover:text-white transition-all active:scale-[0.98] disabled:opacity-50 light-mode:border-slate-900/10 light-mode:bg-slate-900/[0.02] light-mode:text-slate-700 light-mode:hover:bg-slate-900/[0.04]"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2 text-indigo-500" />
            ) : (
              <svg className="w-4 h-4 mr-2.5" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5.04c1.62 0 3.08.56 4.22 1.65l3.15-3.15C17.45 1.84 14.93 1 12 1 7.37 1 3.4 3.66 1.44 7.55l3.77 2.92C6.18 7.22 8.86 5.04 12 5.04z"
                />
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.47h6.44c-.28 1.47-1.11 2.71-2.36 3.55l3.66 2.84c2.14-1.97 3.39-4.87 3.39-8.5z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.21 14.78c-.24-.72-.37-1.49-.37-2.28s.13-1.56.37-2.28L1.44 7.3C.52 9.12 0 11.16 0 13.3c0 2.14.52 4.18 1.44 6L5.21 14.78z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.66-2.84c-1.01.68-2.31 1.09-4.3 1.09-3.14 0-5.82-2.18-6.77-5.43L1.44 16.3C3.4 20.19 7.37 23 12 23z"
                />
              </svg>
            )}
            Google account sign up
          </button>

          {/* Guest Access Link */}
          <div className="mt-4">
            <button
              onClick={handleGuestClick}
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl border border-dashed border-indigo-500/20 bg-indigo-500/[0.02] text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/5 hover:border-indigo-500/30 transition-all font-bold text-xs flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-50"
            >
              <User className="w-3.5 h-3.5" />
              Continue as Guest (Read-Only)
            </button>
            <p className="text-[9px] text-slate-500 font-semibold leading-relaxed mt-1.5 text-center">
              * Guest mode lets you browse the home page & subject branches, but blocks access to note details, downloads, and AI summaries.
            </p>
          </div>

          {/* Footer inside card */}
          <div className="mt-6 text-center border-t border-white/[0.05] pt-5 light-mode:border-slate-900/[0.05]">
            <p className="text-xs text-slate-400 light-mode:text-slate-500 font-medium">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-bold text-indigo-400 hover:text-indigo-300 light-mode:text-indigo-600 light-mode:hover:text-indigo-500 inline-flex items-center gap-0.5 transition-colors group"
              >
                Sign in instead <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </p>
          </div>
        </GlassPanel>
      </motion.div>
    </div>
  );
};

export default Register;
