import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  Search, 
  UploadCloud, 
  Brain, 
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/Button';
import { GlassPanel } from '../components/ui/GlassPanel';
import { motion } from 'framer-motion';

export const Home: React.FC = () => {
  const { user, isGuest } = useAuth();
  const { error } = useToast();
  const navigate = useNavigate();

  const features = [
    {
      icon: <UploadCloud className="w-6 h-6 text-indigo-400" />,
      title: 'Easy PDF Sharing',
      description: 'Upload and distribute your lecture slides, handwritten notes, and mock tests with ease.'
    },
    {
      icon: <Search className="w-6 h-6 text-purple-400" />,
      title: 'Advanced Filtering',
      description: 'Find exactly what you need by searching subjects, professors, or sorting by specific semesters.'
    },
    {
      icon: <Brain className="w-6 h-6 text-pink-400" />,
      title: 'Gemini AI Summaries',
      description: 'Generate concise revision checklists and math derivations from long PDFs instantly.'
    }
  ];

  return (
    <div className="min-h-screen w-full relative overflow-hidden py-12 px-4 md:px-8 flex flex-col justify-center items-center">
      {/* Background radial glowing gradients */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] glow-purple rounded-full pointer-events-none blur-3xl opacity-30" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] glow-indigo rounded-full pointer-events-none blur-3xl opacity-30" />
      
      {/* Animated geometric background particles */}
      <div className="absolute top-1/4 left-1/10 w-24 h-24 rounded-3xl bg-indigo-500/5 border border-indigo-500/10 animate-float pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/10 w-32 h-32 rounded-full bg-purple-500/5 border border-purple-500/10 animate-float pointer-events-none" style={{ animationDelay: '2s' }} />

      <div className="max-w-6xl mx-auto z-10 relative flex flex-col gap-20 w-full">
        
        {/* HERO SECTION */}
        <section className="flex flex-col lg:flex-row items-center gap-12 text-left py-8">
          <div className="flex-1 space-y-6">
            
            {/* Pulsing AI Badge */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-400 text-xs font-bold"
            >
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>Now Powered by Google Gemini AI 2.5 Flash</span>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-none text-white light-mode:text-slate-900"
            >
              The Modern Library for{' '}
              <span className="text-gradient-primary">Note Sharing</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-base sm:text-lg text-slate-400 light-mode:text-slate-500 leading-relaxed max-w-xl font-medium"
            >
              Connect with classmates, share premium lecture materials, and study faster using personalized AI-driven notes summaries. Built for college students, by college students.
            </motion.p>
            
            {/* Call to actions */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap items-center gap-4 pt-2"
            >
              <Button
                onClick={() => navigate('/feed')}
                variant="primary"
                size="lg"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Explore Notes Feed
              </Button>
              
              <Button
                onClick={() => {
                  if (isGuest) {
                    error('Guest session is read-only. Please create a student account to contribute notes.');
                    navigate('/register');
                  } else if (!user) {
                    navigate('/register');
                  } else {
                    navigate('/upload');
                  }
                }}
                variant="secondary"
                size="lg"
                leftIcon={<UploadCloud className="w-5 h-5" />}
              >
                Contribute Notes
              </Button>
            </motion.div>
          </div>

          {/* Right visual card deck (staggered mockups) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 20 }}
            className="flex-1 w-full flex items-center justify-center relative lg:pl-8"
          >
            <div className="w-[320px] sm:w-[360px] h-[340px] relative">
              
              {/* Back Card */}
              <div className="absolute top-4 left-6 w-full h-[280px] glass-panel border border-white/5 bg-slate-900/40 rounded-2xl opacity-40 -rotate-3 blur-[1px] pointer-events-none" />
              
              {/* Main Card */}
              <GlassPanel glowBorder className="absolute top-0 left-0 w-full h-[280px] p-6 flex flex-col justify-between text-left shadow-2xl relative">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/30">
                      <Brain className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1 animate-pulse">
                      <Sparkles className="w-3 h-3" /> AI ACTIVE
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white leading-tight">Data Structures Notes</h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-1">S3 Computer Science • Dr. Priya Sen</p>
                    <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                      Detailed breakdowns of AVL Trees, Red-Black Trees balancing rotations, and hash collisions resolution.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/[0.05]">
                  <span className="text-[10px] font-bold text-slate-500">NoteWeb AI summary available</span>
                  <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1">
                    Try AI Summary <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </GlassPanel>
            </div>
          </motion.div>
        </section>

        {/* FEATURES GRID SECTION */}
        <section className="space-y-12">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-3xl font-extrabold text-white light-mode:text-slate-950">
              Why Study with NoteWeb?
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
              We leverage cloud infrastructures and Generative AI to provide the ultimate study deck.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {features.map((feat, idx) => (
              <GlassPanel 
                key={idx} 
                hoverEffect
                className="p-6 border border-white/[0.05] bg-[#16161D]/20 flex flex-col justify-between gap-6"
              >
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/5 flex items-center justify-center">
                    {feat.icon}
                  </div>
                  <h3 className="font-extrabold text-lg text-white light-mode:text-slate-900">{feat.title}</h3>
                  <p className="text-xs text-slate-400 light-mode:text-slate-500 leading-relaxed font-medium">
                    {feat.description}
                  </p>
                </div>
              </GlassPanel>
            ))}
          </div>
        </section>

        {/* STATS SECTION */}
        <section className="rounded-2xl border border-indigo-500/10 bg-indigo-500/5 light-mode:border-indigo-500/5 p-8 flex flex-col md:flex-row items-center justify-around gap-8 text-center">
          <div className="space-y-1">
            <h3 className="text-4xl font-black text-white light-mode:text-indigo-600">10k+</h3>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">PDF Notes Uploaded</p>
          </div>
          <div className="w-px h-12 bg-white/[0.08] hidden md:block" />
          <div className="space-y-1">
            <h3 className="text-4xl font-black text-white light-mode:text-indigo-600">5k+</h3>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Students</p>
          </div>
          <div className="w-px h-12 bg-white/[0.08] hidden md:block" />
          <div className="space-y-1">
            <h3 className="text-4xl font-black text-white light-mode:text-indigo-600">100%</h3>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Free Open Access</p>
          </div>
        </section>

      </div>
    </div>
  );
};
export default Home;
