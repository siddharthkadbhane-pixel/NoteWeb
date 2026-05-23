import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Sparkles, ArrowRight, Info, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { GlassPanel } from '../components/ui/GlassPanel';
import { motion, AnimatePresence } from 'framer-motion';
import { renderAvatar } from '../utils/avatar';

// Pre-defined Cartoon/Anime Avatars
const EMOJIS = ['🦊', '🤖', '🥷', '🧑‍💻', '🧙‍♂️', '🦄', '🐱', '🐼', '🦁', '🐯', '🐸', '🐙', '🦖', '🦕', '🐝', '🍕'];
const GRADIENTS = [
  { name: 'Sunset Flame', class: 'from-amber-500 via-orange-500 to-rose-600' },
  { name: 'Nebula Dusk', class: 'from-purple-600 via-pink-500 to-indigo-600' },
  { name: 'Emerald Wave', class: 'from-teal-400 via-emerald-500 to-cyan-500' },
  { name: 'Electric Blue', class: 'from-blue-500 via-indigo-600 to-indigo-700' },
  { name: 'Rose Quartz', class: 'from-rose-400 via-fuchsia-500 to-pink-600' },
  { name: 'Cyber Abyss', class: 'from-gray-800 via-slate-900 to-zinc-950' }
];

export const Login: React.FC = () => {
  const { loginWithUsername, registerUser, loginAsGuest } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Registration Form States
  const [regName, setRegName] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regYear, setRegYear] = useState('1');
  const [regBranch, setRegBranch] = useState('computers');
  const [regEmail, setRegEmail] = useState('');
  const [regCgpa, setRegCgpa] = useState('');
  
  // Custom Avatar Builder States
  const [selectedEmoji, setSelectedEmoji] = useState(EMOJIS[0]);
  const [selectedGradient, setSelectedGradient] = useState(GRADIENTS[0].class);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const from = (location.state as any)?.from?.pathname || '/';

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setFormErrors({ username: 'Username is required' });
      return;
    }
    setFormErrors({});
    setIsLoading(true);

    try {
      await loginWithUsername(username);
      success(`Welcome back, ${username}!`);
      navigate(from, { replace: true });
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('not found')) {
        setIsRegistering(true);
        success('Username not found. Let\'s create your account!');
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
      errors.mobile = 'Enter a valid 10-12 digit mobile number';
    }
    
    if (regEmail.trim() && !/\S+@\S+\.\S+/.test(regEmail)) {
      errors.email = 'Enter a valid email address';
    }

    if (regCgpa.trim()) {
      const cgpaNum = parseFloat(regCgpa);
      if (isNaN(cgpaNum) || cgpaNum < 0 || cgpaNum > 10) {
        errors.cgpa = 'CGPA must be between 0 and 10';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRegForm()) return;
    setIsLoading(true);

    try {
      const avatarPayload = `${selectedEmoji}|${selectedGradient}`;
      await registerUser({
        username: username.trim().toLowerCase(),
        displayName: regName,
        mobileNo: regMobile,
        year: regYear,
        branch: regBranch,
        email: regEmail,
        cgpa: regCgpa,
        photoURL: avatarPayload,
        role: 'student'
      });
      success(`Welcome to NoteWeb, ${regName}!`);
      navigate(from, { replace: true });
    } catch (err: any) {
      console.error(err);
      toastError(err.message || 'Registration failed. Try a different username.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestClick = () => {
    loginAsGuest();
    success('Logged in as Guest!');
    navigate('/');
  };

  return (
    <div className="w-full flex items-center justify-center px-4 relative overflow-hidden py-12">
      {/* Decorative background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-lg z-10"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center shadow-xl shadow-purple-600/20">
              <span className="font-extrabold text-white text-xl">N</span>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">NoteWeb</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white light-mode:text-slate-800">Campus Portal</h2>
          <p className="mt-2 text-sm text-slate-400 light-mode:text-slate-500">
            Share resources, earn XP points, and connect with peer engineers
          </p>
        </div>

        {/* Card */}
        <GlassPanel glowBorder className="bg-[#12121A]/50 light-mode:bg-white/80 p-8 shadow-2xl backdrop-blur-xl border border-white/[0.08] light-mode:border-slate-200/50">
          <AnimatePresence mode="wait">
            {!isRegistering ? (
              /* USERNAME LOGIN FORM */
              <motion.form
                key="login-username"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                onSubmit={handleLoginSubmit}
                className="space-y-5 text-left"
              >
                <Input
                  label="Username"
                  type="text"
                  placeholder="e.g. sid_phantom"
                  icon={<User className="w-4 h-4" />}
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  error={formErrors.username}
                  required
                />
                <p className="text-[10px] text-slate-400 font-medium">
                  💡 No password needed! Instantly log in using your university username. If it's your first time, we'll set up your beautiful avatar!
                </p>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full py-3"
                  isLoading={isLoading}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Access Dashboard
                </Button>

                <div className="relative flex items-center justify-center my-4">
                  <span className="absolute px-3 bg-[#12121A] light-mode:bg-white text-xs text-slate-500 font-bold">OR</span>
                  <hr className="w-full border-white/[0.06] light-mode:border-slate-200" />
                </div>

                <button
                  type="button"
                  onClick={handleGuestClick}
                  className="w-full py-2.5 rounded-xl border border-dashed border-indigo-500/20 bg-indigo-500/[0.02] text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/5 hover:border-indigo-500/30 transition-all font-bold text-xs flex items-center justify-center gap-1.5 active:scale-[0.98]"
                >
                  👤 Continue as Guest (Read-Only Mode)
                </button>
              </motion.form>
            ) : (
              /* REGISTRATION AND AVATAR BUILDER */
              <motion.form
                key="register-form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                onSubmit={handleRegisterSubmit}
                className="space-y-5 text-left"
              >
                <div className="flex items-center gap-3 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl mb-4">
                  <Info className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <p className="text-xs text-indigo-200 light-mode:text-indigo-700">
                    Setting up a new student profile for: <code className="text-white light-mode:text-slate-800 bg-indigo-600/30 light-mode:bg-indigo-500/10 px-1.5 py-0.5 rounded">{username}</code>
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Full Name"
                    type="text"
                    placeholder="e.g. Sid Kadbhane"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    error={formErrors.name}
                    required
                  />

                  <Input
                    label="Mobile Number"
                    type="tel"
                    placeholder="e.g. +91 9876543210"
                    value={regMobile}
                    onChange={(e) => setRegMobile(e.target.value)}
                    error={formErrors.mobile}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 light-mode:text-slate-600 mb-1.5 uppercase tracking-wider">Engineering Branch</label>
                    <select
                      value={regBranch}
                      onChange={(e) => setRegBranch(e.target.value)}
                      className="w-full bg-slate-900 light-mode:bg-white border border-white/[0.08] light-mode:border-slate-200 text-white light-mode:text-slate-800 rounded-xl py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold"
                    >
                      <option value="computers">💻 Computer Science (CSE)</option>
                      <option value="electronics">🔌 Electronics & Comm (ECE)</option>
                      <option value="mechanical">⚙️ Mechanical & Civil</option>
                      <option value="maths">📐 Mathematics</option>
                      <option value="science">🔬 Basic Science & Eng</option>
                      <option value="management">📊 Management & Humanities</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 light-mode:text-slate-600 mb-1.5 uppercase tracking-wider">Class Year</label>
                    <select
                      value={regYear}
                      onChange={(e) => setRegYear(e.target.value)}
                      className="w-full bg-slate-900 light-mode:bg-white border border-white/[0.08] light-mode:border-slate-200 text-white light-mode:text-slate-800 rounded-xl py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold"
                    >
                      <option value="1">🎓 1st Year (Freshman)</option>
                      <option value="2">🎓 2nd Year (Sophomore)</option>
                      <option value="3">🎓 3rd Year (Junior)</option>
                      <option value="4">🎓 4th Year (Senior)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Email Address (Optional)"
                    type="email"
                    placeholder="you@college.edu"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    error={formErrors.email}
                  />

                  <Input
                    label="CGPA (Optional)"
                    type="text"
                    placeholder="e.g. 9.15"
                    value={regCgpa}
                    onChange={(e) => setRegCgpa(e.target.value.replace(/[^0-9.]/g, ''))}
                    error={formErrors.cgpa}
                  />
                </div>

                {/* Avatar Builder Panel */}
                <div className="border border-white/[0.08] light-mode:border-slate-200/60 rounded-2xl p-4 bg-slate-950/30 light-mode:bg-slate-100/50">
                  <h4 className="text-xs font-bold text-slate-200 light-mode:text-slate-700 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    Anime & Cartoon Avatar Builder
                  </h4>
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    {/* Visual Preview */}
                    <div className="flex flex-col items-center gap-2">
                      {renderAvatar(`${selectedEmoji}|${selectedGradient}`, "w-20 h-20 text-4xl")}
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Your Profile Badge</span>
                    </div>

                    <div className="flex-1 w-full space-y-4">
                      {/* Emoji Selector */}
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 mb-1.5">1. CHOOSE CARTOON EMOJI</span>
                        <div className="grid grid-cols-8 gap-1.5">
                          {EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => setSelectedEmoji(emoji)}
                              className={`w-7 h-7 flex items-center justify-center rounded-lg text-lg transition-transform active:scale-95 ${
                                selectedEmoji === emoji 
                                  ? 'bg-indigo-600/30 border border-indigo-500 scale-110' 
                                  : 'bg-slate-900 light-mode:bg-white border border-white/[0.04] light-mode:border-slate-200 hover:bg-slate-800 light-mode:hover:bg-slate-50 text-slate-300 light-mode:text-slate-700'
                              }`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Gradient Selector */}
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 mb-1.5">2. CHOOSE COLOR THEME</span>
                        <div className="grid grid-cols-6 gap-1.5">
                          {GRADIENTS.map((grad) => (
                            <button
                              key={grad.name}
                              type="button"
                              onClick={() => setSelectedGradient(grad.class)}
                              title={grad.name}
                              className={`h-6 rounded-lg bg-gradient-to-tr ${grad.class} flex items-center justify-center border transition-all ${
                                selectedGradient === grad.class ? 'border-white scale-105 shadow-md shadow-white/10' : 'border-transparent opacity-75 hover:opacity-100'
                              }`}
                            >
                              {selectedGradient === grad.class && <Check className="w-3 h-3 text-white" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setIsRegistering(false);
                      setFormErrors({});
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    className="flex-[2] py-3 bg-gradient-to-r from-indigo-600 to-purple-600"
                    isLoading={isLoading}
                  >
                    Complete Registration
                  </Button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </GlassPanel>
      </motion.div>
    </div>
  );
};

export default Login;
