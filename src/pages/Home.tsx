import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Gamepad2, 
  UploadCloud, 
  Trophy, 
  ArrowRight
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { GlassPanel } from '../components/ui/GlassPanel';
import { motion } from 'framer-motion';

export const Home: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <UploadCloud className="w-6 h-6 text-indigo-400" />,
      title: 'Active Peer Sharing',
      description: 'Instantly contribute and access verified student notes, handwritten exam papers, and syllabus guides.'
    },
    {
      icon: <Gamepad2 className="w-6 h-6 text-purple-400" />,
      title: 'Campus Quiz Arena',
      description: 'Compete in gamified, timed study arenas across Computer Science, Calculus, Physics, and Management.'
    },
    {
      icon: <Trophy className="w-6 h-6 text-pink-400" />,
      title: 'Podium Rankings',
      description: 'Gain study XP dynamically by uploading notes or completing quizzes, and climb the campus Leaderboard!'
    }
  ];

  return (
    <div className="min-h-screen w-full relative overflow-x-hidden py-12 px-4 md:px-8 flex flex-col justify-center items-center">
      {/* Background glowing gradients */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/5 rounded-full pointer-events-none blur-3xl opacity-30" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/5 rounded-full pointer-events-none blur-3xl opacity-30" />
      
      {/* Subtle geometric floating panels */}
      <div className="absolute top-1/4 left-1/12 w-16 h-16 rounded-2xl bg-indigo-500/5 border border-white/[0.03] animate-float pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/12 w-20 h-20 rounded-full bg-purple-500/5 border border-white/[0.03] animate-float pointer-events-none" style={{ animationDelay: '2.5s' }} />

      <div className="max-w-6xl mx-auto z-10 relative flex flex-col gap-20 w-full">
        
        {/* HERO SECTION */}
        <section className="flex flex-col lg:flex-row items-center gap-12 text-left py-8">
          <div className="flex-1 space-y-6">
            
            {/* New Campus Badge */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 text-xs font-bold"
            >
              <Trophy className="w-3.5 h-3.5 animate-pulse text-amber-400" />
              <span>Campus Quiz Arena & Live Sync is Active</span>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-none text-white light-mode:text-slate-900"
            >
              The Collaborative{' '}
              <span className="text-gradient-primary">Study Nexus</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-base sm:text-lg text-slate-400 light-mode:text-slate-500 leading-relaxed max-w-xl font-medium"
            >
              Share premium class materials, engage in real-time chat with fellow students, and challenge yourself in the Quiz Arena to build master-level academic streaks. Crafted by students, for students.
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
                Explore Notes Library
              </Button>
              
              <Button
                onClick={() => navigate('/quiz')}
                variant="secondary"
                size="lg"
                leftIcon={<Gamepad2 className="w-5 h-5 text-purple-400" />}
              >
                Enter Quiz Arena
              </Button>
            </motion.div>
          </div>

          {/* Right visual card deck (staggered mockups showing Quiz features) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 20 }}
            className="flex-1 w-full flex items-center justify-center relative lg:pl-8"
          >
            <div className="w-[320px] sm:w-[360px] h-[340px] relative">
              
              {/* Back Card */}
              <div className="absolute top-4 left-6 w-full h-[280px] glass-panel border border-white/5 bg-slate-900/40 rounded-2xl opacity-40 -rotate-3 blur-[1px] pointer-events-none" />
              
              {/* Main Card: Sleek Quiz Arena scorecard mockup */}
              <GlassPanel glowBorder className="absolute top-0 left-0 w-full h-[280px] p-6 flex flex-col justify-between text-left shadow-2xl relative bg-slate-950/40">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                      <Gamepad2 className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1 animate-pulse">
                      <Trophy className="w-3 h-3" /> MATCH COMPLETED
                    </span>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-bold text-white leading-tight">Data Structures Practice</h3>
                    <p className="text-[11px] text-slate-500 font-semibold mt-1">Difficulty: Medium • Computer Science</p>
                    
                    {/* Live score indicator */}
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <span className="text-[9px] text-slate-500 font-bold block uppercase">Score</span>
                        <span className="text-sm font-black text-white">+280 XP</span>
                      </div>
                      <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <span className="text-[9px] text-slate-500 font-bold block uppercase">Peak Streak</span>
                        <span className="text-sm font-black text-white">4 Streak</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/[0.05]">
                  <span className="text-[10px] font-bold text-slate-500">Rankings updated dynamically</span>
                  <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1 cursor-pointer hover:text-indigo-300 transition-colors" onClick={() => navigate('/quiz')}>
                    Play Arena <ArrowRight className="w-3.5 h-3.5" />
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
              Unlock Your Academic Edge
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-semibold leading-relaxed">
              Experience a premium, unified student ecosystem built with cutting-edge frontends and real-time synchronizations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {features.map((feat, idx) => (
              <GlassPanel 
                key={idx} 
                hoverEffect
                className="p-6 border border-white/[0.05] bg-[#16161D]/15 flex flex-col justify-between gap-6"
              >
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center">
                    {feat.icon}
                  </div>
                  <h3 className="font-extrabold text-lg text-white light-mode:text-slate-900">{feat.title}</h3>
                  <p className="text-xs text-slate-400 light-mode:text-slate-500 leading-relaxed font-semibold">
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
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Academic Files Shared</p>
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
