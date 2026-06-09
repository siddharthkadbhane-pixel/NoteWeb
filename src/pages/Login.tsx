import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabase/config';
import { 
  User, GraduationCap, ShieldCheck, ArrowRight, 
  Check, Camera, Upload, X, Eye, EyeOff, Lock,
  ChevronLeft, Sparkles, Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { renderAvatar } from '../utils/avatar';

// Pre-defined Cartoon/Anime Avatars
const EMOJIS = ['🦊', '🤖', '🥷', '🧑‍💻', '🧙‍♂️', '🦄', '🐱', '🐼', '🦁', '🐯', '🐸', '🐙', '🦖', '🦕', '🐝', '🍕'];
const GRADIENTS = [
  { name: 'Sunset Flame',  cls: 'from-amber-500 via-orange-500 to-rose-600' },
  { name: 'Nebula Dusk',   cls: 'from-purple-600 via-pink-500 to-indigo-600' },
  { name: 'Emerald Wave',  cls: 'from-teal-400 via-emerald-500 to-cyan-500' },
  { name: 'Electric Blue', cls: 'from-blue-500 via-indigo-600 to-indigo-700' },
  { name: 'Rose Quartz',   cls: 'from-rose-400 via-fuchsia-500 to-pink-600' },
  { name: 'Cyber Abyss',   cls: 'from-gray-800 via-slate-900 to-zinc-950' },
];

// Admin registration setup token (configurable via environment, defaults to secure backup)
const ADMIN_REGISTRATION_TOKEN = import.meta.env.VITE_ADMIN_REGISTRATION_TOKEN || 'Whitephantom';

type Step = 'login' | 'register';
type Role = 'student' | 'admin';

export const Login: React.FC = () => {
  const { loginWithUsername, registerUser, loginAsGuest } = useAuth();
  const { success, error: toastError } = useToast();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/';

  /* ── Step & Role State ── */
  const [step, setStep] = useState<Step>('login');
  const [selectedRole, setSelectedRole] = useState<Role>('student');
  const [isLoading, setIsLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  /* ── Admin verify ── */
  const [adminPass, setAdminPass] = useState('');
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [adminPassError, setAdminPassError] = useState('');

  /* ── Username login ── */
  const [username, setUsername] = useState('');

  /* ── Registration fields ── */
  const [regName,   setRegName]   = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regYear,   setRegYear]   = useState('1');
  const [regBranch, setRegBranch] = useState('cse');
  const [regEmail,  setRegEmail]  = useState('');
  const [regCgpa,   setRegCgpa]   = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  /* ── Photo / Avatar ── */
  const [avatarMode, setAvatarMode] = useState<'emoji' | 'photo'>('emoji');
  const [selectedEmoji,    setSelectedEmoji]    = useState(EMOJIS[0]!);
  const [selectedGradient, setSelectedGradient] = useState(GRADIENTS[0]!.cls);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoDragging, setPhotoDragging] = useState(false);

  // Dynamic branch list state
  const [dbBranches, setDbBranches] = useState<any[]>([]);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const { data } = await supabase.from('branches').select('id,name');
        if (data && data.length > 0) {
          const blacklistIds = ['bse', 'cs', 'mgt', 'm', 'math', 'mathematics', 'basic-science', 'computer-science'];
          const blacklistNames = [
            'basic science & eng',
            'basic science',
            'basic sciences',
            'computer science',
            'mathematics',
            'management & humanities'
          ];
          
          let filtered = data.filter((b: any) => {
            if (blacklistIds.includes(b.id)) return false;
            if (blacklistNames.includes(b.name.trim().toLowerCase())) return false;
            return true;
          });

          // Deduplicate by name case-insensitive
          const seenNames = new Set<string>();
          filtered = filtered.filter((b: any) => {
            const normName = b.name.trim().toLowerCase();
            if (normName.includes('electronics') || normName.includes('comm')) {
              if (b.id !== 'ece' && filtered.some((o: any) => o.id === 'ece')) {
                return false;
              }
            }
            if (seenNames.has(normName)) {
              return false;
            }
            seenNames.add(normName);
            return true;
          });

          setDbBranches(filtered);
        }
      } catch (err) {
        console.warn("Failed to fetch branches for registration selector:", err);
      }
    };
    fetchBranches();
  }, []);


  /* ─────────────────────────────────────────── Helpers */
  const bg = isDark
    ? 'bg-[#0D0D14]/95 border-white/[0.08] text-slate-100'
    : 'bg-white/98 border-slate-200/90 text-slate-800';

  const inputCls = `w-full rounded-xl px-4 py-3 text-sm font-medium outline-none transition-all border
    ${isDark
      ? 'bg-white/[0.03] border-white/[0.08] text-slate-100 placeholder-slate-600 focus:border-indigo-500/60 focus:bg-white/[0.05]'
      : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-400 focus:bg-white'
    }`;

  const labelCls = `block text-[11px] font-black uppercase tracking-wider mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`;

  const selectCls = `w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none transition-all border
    ${isDark
      ? 'bg-slate-900 border-white/[0.08] text-white focus:border-indigo-500/60'
      : 'bg-white border-slate-200 text-slate-800 focus:border-indigo-400'
    }`;

  /* ─────────────────────────────────────────── Photo upload */
  const compressProfileImage = (base64Str: string, maxWidth = 150, maxHeight = 150, quality = 0.75): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(base64Str);
        }
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  const handlePhotoFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toastError('Please select an image file');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toastError('Photo must be under 25 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const rawBase64 = e.target?.result as string;
      try {
        const compressed = await compressProfileImage(rawBase64);
        setPhotoDataUrl(compressed);
      } catch (err) {
        setPhotoDataUrl(rawBase64);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlePhotoFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setPhotoDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handlePhotoFile(file);
  };

  /* ── State variables for the two columns ── */
  const [studentUsername, setStudentUsername] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [showStudentPassword, setShowStudentPassword] = useState(false);

  /* ─────────────────────────────────────────── Actions */
  const handleAdminVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim().replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    if (!cleanUsername) {
      setAdminPassError('Admin username is required');
      return;
    }
    setAdminPassError('');
    setIsLoading(true);
    setSelectedRole('admin');
    setUsername(cleanUsername);

    // Enforce admin username whitelist check
    const whitelistStr = import.meta.env.VITE_ADMIN_EMAILS || 'admin@college.edu,sid_phantom,siddharth';
    const whitelist = whitelistStr.split(',').map((u: string) => u.trim().toLowerCase());
    if (!whitelist.includes(cleanUsername)) {
      setAdminPassError('This username is not authorized to access the Admin Gate.');
      setIsLoading(false);
      return;
    }

    try {
      // Attempt login with username and passcode as password
      await loginWithUsername(cleanUsername, adminPass);
      success(`Welcome back, Administrator ${cleanUsername}! 👑`);
      navigate(from, { replace: true });
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        // If profile doesn't exist, they can register ONLY if the admin passcode matches the registration token
        if (adminPass === ADMIN_REGISTRATION_TOKEN) {
          setStep('register');
          setRegPassword(adminPass); // Store it for registration submit
          success("New Admin passcode verified! Let's build your administrator profile.");
        } else {
          setAdminPassError('Incorrect admin token or password. Please try again.');
        }
      } else {
        setAdminPassError(err.message || 'Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = studentUsername.trim().replace(/[^a-zA-Z0-9_]/g, '');
    if (!cleanUsername) {
      setFormErrors({ studentUsername: 'Username is required' });
      return;
    }
    if (!studentPassword) {
      setFormErrors({ studentPassword: 'Password is required' });
      return;
    }
    setFormErrors({});
    setIsLoading(true);
    setSelectedRole('student');
    setUsername(cleanUsername);
    try {
      await loginWithUsername(cleanUsername.toLowerCase(), studentPassword);
      success(`Welcome back, ${cleanUsername}! 🎉`);
      navigate(from, { replace: true });
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        setUsername(cleanUsername);
        setRegPassword(studentPassword); // Prefill for registration setup
        setStep('register');
        success("New username! Let's build your profile.");
      } else {
        toastError(err.message || 'Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const validateRegForm = () => {
    const errors: Record<string, string> = {};
    if (!regName.trim()) errors.name = 'Full name is required';
    if (!regMobile.trim()) {
      errors.mobile = 'Mobile number is required';
    } else if (!/^\+?\d{10,12}$/.test(regMobile.replace(/[\s-]/g, ''))) {
      errors.mobile = 'Enter a valid 10–12 digit number';
    }
    if (regEmail.trim() && !/\S+@\S+\.\S+/.test(regEmail)) {
      errors.email = 'Enter a valid email address';
    }
    if (regCgpa.trim()) {
      const n = parseFloat(regCgpa);
      if (isNaN(n) || n < 0 || n > 10) errors.cgpa = 'CGPA must be 0–10';
    }
    if (!regPassword || regPassword.length < 6) {
      errors.password = 'Password must be at least 6 characters long';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const buildPhotoURL = (): string => {
    if (avatarMode === 'photo' && photoDataUrl) return photoDataUrl;
    return `${selectedEmoji}|${selectedGradient}`;
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRegForm()) return;
    setIsLoading(true);

    // Enforce admin username/email whitelist check during registration
    if (selectedRole === 'admin') {
      const whitelistStr = import.meta.env.VITE_ADMIN_EMAILS || 'admin@college.edu,sid_phantom,siddharth';
      const whitelist = whitelistStr.split(',').map((u: string) => u.trim().toLowerCase());
      const cleanUsername = username.trim().toLowerCase();
      const cleanEmail = regEmail.trim().toLowerCase();

      const isUsernameWhitelisted = whitelist.includes(cleanUsername);
      const isEmailWhitelisted = cleanEmail ? whitelist.includes(cleanEmail) : false;

      if (!isUsernameWhitelisted && !isEmailWhitelisted) {
        toastError('This account (username/email) is not authorized for Administrator registration.');
        setIsLoading(false);
        return;
      }
    }

    try {
      await registerUser({
        username: username.trim().toLowerCase(),
        displayName: regName,
        mobileNo: regMobile,
        year: regYear,
        branch: regBranch,
        email: regEmail,
        cgpa: regCgpa,
        photoURL: buildPhotoURL(),
        // Admin role is assigned only if admin password was verified
        role: selectedRole === 'admin' ? 'admin' : 'student',
        setupComplete: true,
      }, regPassword);
      success(`Welcome to NoteWeb, ${regName}! 🎉`);
      navigate(from, { replace: true });
    } catch (err: any) {
      toastError(err.message || 'Registration failed. Try a different username.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestClick = () => {
    loginAsGuest();
    success('Browsing as Guest 👤');
    navigate('/');
  };

  /* ─────────────────────────────────────────── Avatar preview */
  const AvatarPreview = () => {
    if (avatarMode === 'photo' && photoDataUrl) {
      return (
        <img
          src={photoDataUrl}
          alt="Profile"
          className="w-20 h-20 rounded-2xl object-cover border-2 border-indigo-500/50 shadow-xl"
        />
      );
    }
    return renderAvatar(`${selectedEmoji}|${selectedGradient}`, 'w-20 h-20 text-4xl');
  };

  /* ─────────────────────────────────────────── Render */
  return (
    <div className="w-full min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 relative overflow-hidden py-8">
      {/* Background glows */}
      <div className={`absolute top-1/4 left-1/4 w-80 h-80 rounded-full blur-3xl animate-pulse pointer-events-none ${isDark ? 'bg-indigo-600/10' : 'bg-indigo-600/5'}`} />
      <div className={`absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-3xl animate-pulse pointer-events-none ${isDark ? 'bg-purple-600/10' : 'bg-purple-600/5'}`} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`w-full ${step === 'login' ? 'max-w-4xl' : 'max-w-lg'} z-10 transition-all duration-500`}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center shadow-xl shadow-purple-600/25">
              <span className="font-extrabold text-white text-xl">N</span>
            </div>
            <span className="text-2xl font-black bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">NoteWeb</span>
          </div>
          <h1 className={`text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Campus Portal</h1>
          <p className={`mt-1.5 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Share resources, earn XP points, and connect with peer engineers
          </p>
        </div>

        {/* Card */}
        <div className={`rounded-3xl border backdrop-blur-2xl shadow-2xl p-6 sm:p-8 transition-all duration-500 ${bg}`}>
          <AnimatePresence mode="wait">

            {/* ══════ STEP 1: DUAL-COLUMN LOGIN ══════ */}
            {step === 'login' && (
              <motion.div
                key="login-dual"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
                  
                  {/* LEFT COLUMN: Student Section */}
                  <div className={`flex flex-col justify-between p-6 rounded-2xl border-2 transition-all duration-300 ${
                    isDark
                      ? 'bg-indigo-950/5 border-indigo-500/10 hover:border-indigo-500/30'
                      : 'bg-indigo-50/20 border-indigo-100 hover:border-indigo-400/40 shadow-sm'
                  }`}>
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
                          <GraduationCap className="w-5.5 h-5.5 text-white" />
                        </div>
                        <div className="text-left">
                          <h3 className={`text-base font-black ${isDark ? 'text-slate-100' : 'text-indigo-950'}`}>Student Entrance</h3>
                          <span className={`text-[10px] font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>BROWSE & UPLOAD NOTES</span>
                        </div>
                      </div>
                      <p className={`text-xs mb-5 font-medium leading-relaxed text-left ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        Unlock notes library, download PDFs, view categories, and chat in real-time with classmates.
                      </p>
                    </div>

                    <form onSubmit={handleStudentSubmit} className="space-y-4 text-left">
                      <div>
                        <label className={labelCls}>Your Username</label>
                        <div className="relative">
                          <User className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                          <input
                            type="text"
                            value={studentUsername}
                            onChange={(e) => setStudentUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                            placeholder="e.g. sid_phantom"
                            className={inputCls + " pl-10"}
                          />
                        </div>
                        {formErrors.studentUsername && (
                          <p className="mt-1 text-xs text-rose-500 font-semibold">{formErrors.studentUsername}</p>
                        )}
                      </div>

                      <div>
                        <label className={labelCls}>Your Password</label>
                        <div className="relative">
                          <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                          <input
                            type={showStudentPassword ? 'text' : 'password'}
                            value={studentPassword}
                            onChange={(e) => setStudentPassword(e.target.value)}
                            placeholder="Enter password..."
                            className={inputCls + " pl-10 pr-10"}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowStudentPassword(!showStudentPassword)}
                            className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700'}`}
                          >
                            {showStudentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {formErrors.studentPassword && (
                          <p className="mt-1 text-xs text-rose-500 font-semibold">{formErrors.studentPassword}</p>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 rounded-xl font-black text-sm text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-115 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                      >
                        {isLoading && selectedRole === 'student' ? (
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <><ArrowRight className="w-4 h-4" /> Enter Campus</>
                        )}
                      </button>
                    </form>
                  </div>

                  {/* RIGHT COLUMN: Admin Section */}
                  <div className={`flex flex-col justify-between p-6 rounded-2xl border-2 transition-all duration-300 ${
                    isDark ? 'bg-rose-950/5 border-rose-500/10 hover:border-rose-500/30' : 'bg-rose-50/20 border-rose-100 hover:border-rose-400/40 shadow-sm'
                  }`}>
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-orange-500 flex items-center justify-center shadow-md shadow-rose-500/20">
                          <ShieldCheck className="w-5.5 h-5.5 text-white" />
                        </div>
                        <div className="text-left">
                          <h3 className={`text-base font-black ${isDark ? 'text-slate-100' : 'text-rose-955'}`}>Admin Gate</h3>
                          <span className="text-[10px] font-bold text-rose-500 dark:text-rose-400">
                            ENTER PASSCODE TO UNLOCK
                          </span>
                        </div>
                      </div>
                      <p className={`text-xs mb-5 font-medium leading-relaxed text-left ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        Elevated workspace to moderate pending resources, view user presence, and prune accounts.
                      </p>
                    </div>

                    {/* Admin Passcode Gate */}
                    <form onSubmit={handleAdminVerify} className="space-y-4 text-left">
                      <div>
                        <label className={labelCls}>Admin Username</label>
                        <div className="relative">
                          <User className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => { setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()); setAdminPassError(''); }}
                            placeholder="e.g. admin_siddharth"
                            className={inputCls + " pl-10"}
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className={labelCls}>Admin Gate Password</label>
                        <div className="relative">
                          <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                          <input
                            type={showAdminPass ? 'text' : 'password'}
                            value={adminPass}
                            onChange={(e) => { setAdminPass(e.target.value); setAdminPassError(''); }}
                            placeholder="Enter admin passcode..."
                            className={inputCls + " pl-10 pr-10"}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowAdminPass(!showAdminPass)}
                            className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700'}`}
                          >
                            {showAdminPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {adminPassError && (
                          <p className="mt-1 text-xs text-rose-500 font-semibold">{adminPassError}</p>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 rounded-xl font-black text-sm text-white bg-gradient-to-r from-rose-600 to-orange-500 hover:brightness-115 shadow-lg shadow-rose-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                      >
                        {isLoading && selectedRole === 'admin' ? (
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <><Lock className="w-4 h-4" /> Admin Access</>
                        )}
                      </button>
                    </form>
                  </div>

                </div>

                {/* Divider */}
                <div className="relative flex items-center justify-center my-6">
                  <hr className={`w-full ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`} />
                  <span className={`absolute px-3 text-xs font-bold ${isDark ? 'bg-[#0D0D14] text-slate-500' : 'bg-white text-slate-400'}`}>OR</span>
                </div>

                {/* Guest Mode */}
                <button
                  onClick={handleGuestClick}
                  className={`
                    w-full py-3 rounded-xl border border-dashed text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer
                    ${isDark
                      ? 'border-indigo-500/20 bg-indigo-500/[0.02] text-indigo-400 hover:bg-indigo-500/5 hover:border-indigo-500/30'
                      : 'border-indigo-300 bg-indigo-50/50 text-indigo-600 hover:bg-indigo-100/60'
                    }
                  `}
                >
                  👤 Continue as Guest (Read-Only Mode)
                </button>
              </motion.div>
            )}

            {/* ══════ STEP 2: REGISTER (PROFILE SETUP) ══════ */}
            {step === 'register' && (
              <motion.form
                key="register"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                onSubmit={handleRegisterSubmit}
                className="space-y-5 text-left"
              >
                <button
                  type="button"
                  onClick={() => setStep('login')}
                  className={`flex items-center gap-1.5 text-xs font-bold mb-2 cursor-pointer ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'} transition-colors`}
                >
                  <ChevronLeft className="w-4 h-4" /> Back to Login
                </button>

                {/* Header info */}
                <div className={`flex items-start gap-3 p-3.5 rounded-2xl border ${isDark ? 'bg-indigo-500/5 border-indigo-500/15 text-indigo-200' : 'bg-indigo-50 border-indigo-200/80 text-indigo-700'}`}>
                  <Info className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed">
                    Setting up a new <strong>{selectedRole}</strong> profile for username:{' '}
                    <code className={`px-1.5 py-0.5 rounded font-mono text-[11px] ${isDark ? 'bg-indigo-600/30 text-white' : 'bg-indigo-100 text-indigo-800'}`}>{username}</code>
                  </p>
                </div>

                {/* ── PROFILE PHOTO SECTION ── */}
                <div className={`rounded-2xl border p-4 ${isDark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-slate-200/80 bg-slate-50/60'}`}>
                  <div className="flex items-center gap-2 mb-3 text-left">
                    <Camera className={`w-4 h-4 ${isDark ? 'text-indigo-400' : 'text-indigo-500'}`} />
                    <h4 className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Profile Photo</h4>
                  </div>

                  {/* Mode Tabs */}
                  <div className={`flex rounded-xl p-0.5 mb-4 border ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-100 border-slate-200'}`}>
                    {(['emoji', 'photo'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setAvatarMode(mode)}
                        className={`flex-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          avatarMode === mode
                            ? 'bg-indigo-600 text-white shadow'
                            : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {mode === 'emoji' ? <><Sparkles className="w-3.5 h-3.5" /> Cartoon Avatar</> : <><Upload className="w-3.5 h-3.5" /> Upload Photo</>}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col md:flex-row items-center gap-5">
                    {/* Preview */}
                    <div className="flex flex-col items-center gap-2 flex-shrink-0">
                      <AvatarPreview />
                      <span className={`text-[9px] font-black uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Preview</span>
                    </div>

                    {avatarMode === 'emoji' ? (
                      /* Emoji + Gradient pickers */
                      <div className="flex-1 w-full space-y-3">
                        <div>
                          <span className={`block text-[9px] font-black uppercase tracking-wider mb-1.5 text-left ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>1. Choose Emoji</span>
                          <div className="grid grid-cols-8 gap-1.5">
                            {EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => setSelectedEmoji(emoji)}
                                className={`w-7 h-7 flex items-center justify-center rounded-lg text-base transition-all cursor-pointer active:scale-90 ${
                                  selectedEmoji === emoji
                                    ? 'bg-indigo-600/40 border-2 border-indigo-500 scale-110'
                                    : isDark
                                      ? 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.07]'
                                      : 'bg-white border border-slate-200 hover:bg-indigo-50'
                                }`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className={`block text-[9px] font-black uppercase tracking-wider mb-1.5 text-left ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>2. Choose Color</span>
                          <div className="grid grid-cols-6 gap-1.5">
                            {GRADIENTS.map((grad) => (
                              <button
                                key={grad.name}
                                type="button"
                                onClick={() => setSelectedGradient(grad.cls)}
                                title={grad.name}
                                className={`h-7 rounded-lg bg-gradient-to-tr ${grad.cls} flex items-center justify-center border-2 transition-all cursor-pointer ${
                                  selectedGradient === grad.cls ? 'border-white scale-105 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'
                                }`}
                              >
                                {selectedGradient === grad.cls && <Check className="w-3 h-3 text-white" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Photo upload zone */
                      <div className="flex-1 w-full">
                        <input
                          id="photo-file-input"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handlePhotoInputChange}
                        />
                        {photoDataUrl ? (
                          <div className="flex flex-col items-center gap-3">
                            <img
                              src={photoDataUrl}
                              alt="Preview"
                              className="w-28 h-28 rounded-2xl object-cover border-2 border-indigo-500/50 shadow-xl"
                            />
                            <div className="flex gap-2">
                              <label
                                htmlFor="photo-file-input"
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-black flex items-center gap-1.5 border transition-all cursor-pointer ${isDark ? 'border-white/[0.08] text-slate-300 hover:bg-white/[0.05]' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                              >
                                <Camera className="w-3.5 h-3.5" /> Change
                              </label>
                              <button
                                type="button"
                                onClick={() => setPhotoDataUrl(null)}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-black border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" /> Remove
                              </button>
                            </div>
                          </div>
                        ) : (
                          <label
                            htmlFor="photo-file-input"
                            onDragOver={(e) => { e.preventDefault(); setPhotoDragging(true); }}
                            onDragLeave={() => setPhotoDragging(false)}
                            onDrop={handleDrop}
                            className={`
                              relative flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all
                              ${photoDragging
                                ? 'border-indigo-500 bg-indigo-500/10'
                                : isDark
                                  ? 'border-white/[0.10] bg-white/[0.02] hover:border-indigo-500/50 hover:bg-indigo-500/[0.04]'
                                  : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50'
                              }
                            `}
                          >
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-100'}`}>
                              <Upload className="w-6 h-6 text-indigo-500" />
                            </div>
                            <div className="text-center">
                              <p className={`text-sm font-black ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                Tap to Upload Photo
                              </p>
                              <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                or drag & drop · JPG, PNG, WEBP · Max 5MB
                              </p>
                            </div>
                            <p className={`text-[10px] font-bold px-3 py-1.5 rounded-full border ${isDark ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-indigo-50 border-indigo-200 text-indigo-600'}`}>
                              📱 Works like Instagram / WhatsApp
                            </p>
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── PERSONAL INFO ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Full Name *</label>
                    <input type="text" placeholder="e.g. Sid Kadbhane" value={regName} onChange={(e) => setRegName(e.target.value)} className={inputCls} />
                    {formErrors.name && <p className="mt-1 text-xs text-rose-500 font-semibold">{formErrors.name}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Mobile Number *</label>
                    <input type="tel" placeholder="e.g. +91 9876543210" value={regMobile} onChange={(e) => setRegMobile(e.target.value)} className={inputCls} />
                    {formErrors.mobile && <p className="mt-1 text-xs text-rose-500 font-semibold">{formErrors.mobile}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Engineering Branch</label>
                    <select value={regBranch} onChange={(e) => setRegBranch(e.target.value)} className={selectCls}>
                      {dbBranches.length > 0 ? (
                        dbBranches.map((b) => (
                          <option key={b.id} value={b.id} className="bg-slate-900 text-white light-mode:bg-white light-mode:text-slate-850 font-semibold">
                            {b.name}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="cse" className="bg-slate-900 text-white light-mode:bg-white light-mode:text-slate-800 font-semibold">💻 Computer Science & Engineering (CSE)</option>
                          <option value="aiml" className="bg-slate-900 text-white light-mode:bg-white light-mode:text-slate-800 font-semibold">🧠 AI & Machine Learning (AI & ML)</option>
                          <option value="ds" className="bg-slate-900 text-white light-mode:bg-white light-mode:text-slate-800 font-semibold">📊 Data Science (DS)</option>
                          <option value="ece" className="bg-slate-900 text-white light-mode:bg-white light-mode:text-slate-800 font-semibold">🔌 Electronics & Communication (ECE)</option>
                          <option value="mechanical" className="bg-slate-900 text-white light-mode:bg-white light-mode:text-slate-800 font-semibold">⚙️ Mechanical Engineering</option>
                          <option value="civil" className="bg-slate-900 text-white light-mode:bg-white light-mode:text-slate-800 font-semibold">🏗️ Civil Engineering</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Class Year</label>
                    <select value={regYear} onChange={(e) => setRegYear(e.target.value)} className={selectCls}>
                      <option value="1" className="bg-slate-900 text-white light-mode:bg-white light-mode:text-slate-800 font-semibold">🎓 1st Year (Freshman)</option>
                      <option value="2" className="bg-slate-900 text-white light-mode:bg-white light-mode:text-slate-800 font-semibold">🎓 2nd Year (Sophomore)</option>
                      <option value="3" className="bg-slate-900 text-white light-mode:bg-white light-mode:text-slate-800 font-semibold">🎓 3rd Year (Junior)</option>
                      <option value="4" className="bg-slate-900 text-white light-mode:bg-white light-mode:text-slate-800 font-semibold">🎓 4th Year (Senior)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Email <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>(Optional)</span></label>
                    <input type="email" placeholder="you@college.edu" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className={inputCls} />
                    {formErrors.email && <p className="mt-1 text-xs text-rose-500 font-semibold">{formErrors.email}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>CGPA <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>(Optional)</span></label>
                    <input type="text" placeholder="e.g. 9.15" value={regCgpa} onChange={(e) => setRegCgpa(e.target.value.replace(/[^0-9.]/g, ''))} className={inputCls} />
                    {formErrors.cgpa && <p className="mt-1 text-xs text-rose-500 font-semibold">{formErrors.cgpa}</p>}
                  </div>
                </div>

                <div className="w-full">
                  <label className={labelCls}>Set Password (At least 6 characters) *</label>
                  <div className="relative">
                    <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Create a strong password..."
                      className={inputCls + " pl-10 pr-10"}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700'}`}
                    >
                      {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {formErrors.password && <p className="mt-1 text-xs text-rose-500 font-semibold">{formErrors.password}</p>}
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setStep('login')}
                    className={`flex-1 py-3 rounded-xl border text-sm font-bold transition-all active:scale-[0.98] cursor-pointer ${isDark ? 'border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]' : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`flex-[2] py-3 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60 ${
                      selectedRole === 'admin'
                        ? 'bg-gradient-to-r from-rose-600 to-orange-500 shadow-rose-500/20 hover:brightness-110'
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 shadow-indigo-500/20 hover:brightness-110'
                    }`}
                  >
                    {isLoading ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <><Check className="w-4 h-4" /> Complete Registration</>
                    )}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
