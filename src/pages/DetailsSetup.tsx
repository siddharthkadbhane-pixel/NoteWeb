import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Check, Sparkles, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { GlassPanel } from '../components/ui/GlassPanel';
import { motion } from 'framer-motion';

// Curated high-fidelity Unsplash preset student avatars
const AVATAR_PRESETS = [
  {
    id: 'avatar1',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    label: 'Academic Pioneer'
  },
  {
    id: 'avatar2',
    url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80',
    label: 'Innovator Student'
  },
  {
    id: 'avatar3',
    url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
    label: 'Creative Thinker'
  },
  {
    id: 'avatar4',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    label: 'Tech Scholar'
  },
  {
    id: 'avatar5',
    url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80',
    label: 'Global Learner'
  },
  {
    id: 'avatar6',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
    label: 'Explorer'
  },
  {
    id: 'avatar7',
    url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
    label: 'Analytical Mind'
  },
  {
    id: 'avatar8',
    url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&q=80',
    label: 'Future Leader'
  }
];

export const DetailsSetup: React.FC = () => {
  const { userProfile, updateProfileDetails } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [displayName, setDisplayName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_PRESETS[0].url);
  const [inputError, setInputError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect back to original route or Feed
  const from = (location.state as any)?.from?.pathname || '/feed';

  useEffect(() => {
    if (userProfile?.displayName) {
      // Prefill with display name if it's not a generic 'Student' template
      if (userProfile.displayName !== 'Student' && !userProfile.displayName.startsWith('Student +91')) {
        setDisplayName(userProfile.displayName);
      }
    }
    if (userProfile?.photoURL) {
      setSelectedAvatar(userProfile.photoURL);
    }
  }, [userProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setInputError('Please enter your full name');
      return;
    }
    if (displayName.trim().length < 3) {
      setInputError('Name must be at least 3 characters long');
      return;
    }
    setInputError('');
    setIsSubmitting(true);

    try {
      await updateProfileDetails(displayName.trim(), selectedAvatar);
      success('Profile details configured successfully! Welcome aboard.');
      navigate(from, { replace: true });
    } catch (err: any) {
      console.error(err);
      error(err.message || 'Failed to complete profile onboarding.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 relative overflow-hidden py-12">
      {/* Background ambient glowing accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 glow-indigo rounded-full pointer-events-none blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 glow-pink rounded-full pointer-events-none blur-3xl animate-pulse" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-2xl z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-4 animate-bounce">
            <Sparkles className="w-3.5 h-3.5" />
            Complete Your Student Profile
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight text-white light-mode:text-slate-900">
            Welcome to <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">NoteWeb</span>
          </h2>
          <p className="mt-2.5 text-sm text-slate-400 light-mode:text-slate-500 font-medium max-w-md mx-auto">
            Choose your premium student avatar and set a display name to customize your learning space and share notes.
          </p>
        </div>

        <GlassPanel glowBorder className="bg-[#16161D]/30 light-mode:bg-white/85 p-8 lg:p-10 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Display Name Input */}
            <div className="space-y-2">
              <Input
                label="Full Name / Display Name"
                type="text"
                placeholder="E.g., Sidharth Kadbhane"
                icon={<User className="w-4 h-4" />}
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (inputError) setInputError('');
                }}
                error={inputError}
                autoFocus
                required
              />
              <p className="text-[11px] text-slate-500 font-semibold leading-relaxed pl-1">
                * This name will be visible to other students when you contribute notes or share summaries.
              </p>
            </div>

            {/* Avatar Selector Grid */}
            <div className="space-y-4">
              <label className="block text-xs font-extrabold text-slate-300 light-mode:text-slate-700 uppercase tracking-wider pl-1">
                Select Your Avatar Profile
              </label>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {AVATAR_PRESETS.map((avatar) => {
                  const isSelected = selectedAvatar === avatar.url;
                  return (
                    <motion.div
                      key={avatar.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedAvatar(avatar.url)}
                      className={`
                        relative cursor-pointer rounded-2xl p-2.5 flex flex-col items-center gap-2.5 border transition-all duration-300
                        ${isSelected 
                          ? 'bg-indigo-500/10 border-indigo-500 shadow-lg shadow-indigo-500/15 light-mode:bg-indigo-50/50' 
                          : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/20 light-mode:bg-slate-900/[0.02] light-mode:border-slate-900/[0.06] light-mode:hover:bg-slate-900/[0.04]'}
                      `}
                    >
                      {/* Avatar Image Circle */}
                      <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-slate-700/50 shadow-inner flex-shrink-0">
                        <img 
                          src={avatar.url} 
                          alt={avatar.label} 
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-indigo-600/20 flex items-center justify-center backdrop-blur-[1px]">
                            <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white shadow shadow-indigo-600/30">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Avatar Label */}
                      <span className={`text-[10px] font-bold text-center tracking-wide truncate w-full ${isSelected ? 'text-indigo-400 light-mode:text-indigo-600' : 'text-slate-400 light-mode:text-slate-500'}`}>
                        {avatar.label}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Glowing Action Button */}
            <div className="pt-4 border-t border-white/[0.06] light-mode:border-slate-900/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-indigo-500 shadow-md shadow-indigo-500/10 flex-shrink-0">
                  <img src={selectedAvatar} alt="Selected profile preview" className="w-full h-full object-cover" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Live Preview</p>
                  <p className="text-sm font-extrabold text-slate-200 light-mode:text-slate-800 truncate max-w-[200px]">
                    {displayName.trim() || 'Your Name'}
                  </p>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full sm:w-auto px-8 py-3.5 font-bold shadow-lg shadow-indigo-600/20"
                isLoading={isSubmitting}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Complete Onboarding & Explore
              </Button>
            </div>

          </form>
        </GlassPanel>
      </motion.div>
    </div>
  );
};

export default DetailsSetup;
