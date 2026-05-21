import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Info, 
  ShieldCheck, 
  Brain, 
  Sparkles, 
  ArrowRight,
  Code2,
  Lock,
  Layers,
  Heart
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { GlassPanel } from '../components/ui/GlassPanel';

export const About: React.FC = () => {
  const navigate = useNavigate();

  const steps = [
    {
      icon: <Layers className="w-5 h-5 text-indigo-400" />,
      title: 'Step 1: Notes Upload',
      description: 'Students drop text-based PDF lecture notes, specifying subjects, semesters, and teachers.'
    },
    {
      icon: <Brain className="w-5 h-5 text-purple-400" />,
      title: 'Step 2: PDF Parsing',
      description: 'Our client-side extractor parses text blocks from the PDF pages directly in the browser using Web Workers.'
    },
    {
      icon: <Sparkles className="w-5 h-5 text-pink-400" />,
      title: 'Step 3: Gemini Analysis',
      description: 'Gemini 2.5 Flash reviews the content, generating clean markdown study summaries and questions in seconds.'
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
      title: 'Step 4: Moderation & Live Feed',
      description: 'Administrators review the notes to guarantee quality and approve them, caching the AI summaries.'
    }
  ];

  return (
    <div className="min-h-screen w-full py-12 px-4 md:px-8 relative overflow-hidden">
      {/* Accent glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 glow-indigo rounded-full pointer-events-none blur-3xl opacity-20" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 glow-purple rounded-full pointer-events-none blur-3xl opacity-20" />

      <div className="max-w-4xl mx-auto z-10 relative flex flex-col gap-12">
        
        {/* Header */}
        <div className="text-left border-b border-white/[0.05] pb-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-white light-mode:text-slate-900 flex items-center gap-3">
            <Info className="w-9 h-9 text-indigo-500 flex-shrink-0" /> About NoteWeb
          </h1>
          <p className="text-slate-400 light-mode:text-slate-500 font-medium text-sm mt-2">
            Learn more about the technology stack, security architectures, and advanced AI integration parsing our library.
          </p>
        </div>

        {/* Brand Mission */}
        <section className="text-left space-y-4 leading-relaxed">
          <h2 className="text-xl font-bold text-white light-mode:text-slate-950">Our Mission</h2>
          <p className="text-sm text-slate-400 light-mode:text-slate-600 font-medium">
            In colleges, high-quality, structured learning resources are often scattered across messaging groups, local drives, or email chains. NoteWeb provides a central, frosted glass library where students can share materials, bookmark study guides, rate lecture summaries, and leverage state-of-the-art Generative AI to boost their study yields.
          </p>
        </section>

        {/* How It Works Timeline */}
        <section className="space-y-6 text-left">
          <h2 className="text-xl font-bold text-white light-mode:text-slate-950">How NoteWeb Works</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {steps.map((step, idx) => (
              <GlassPanel 
                key={idx} 
                className="p-5 flex items-start gap-4 bg-[#16161D]/20 border-white/[0.05]"
              >
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/5 flex items-center justify-center flex-shrink-0">
                  {step.icon}
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm light-mode:text-slate-900">{step.title}</h4>
                  <p className="text-xs text-slate-400 light-mode:text-slate-500 mt-1.5 leading-relaxed font-medium">
                    {step.description}
                  </p>
                </div>
              </GlassPanel>
            ))}
          </div>
        </section>

        {/* Technology Stack Grid */}
        <section className="space-y-6 text-left">
          <h2 className="text-xl font-bold text-white light-mode:text-slate-950">Technology Framework</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <GlassPanel className="p-5 text-center flex flex-col items-center justify-between gap-4 bg-white/[0.01]">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                <Code2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white light-mode:text-slate-900">React + TS + Vite</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Speedy bundler speeds and types safety for responsive visual renderings.
                </p>
              </div>
            </GlassPanel>

            <GlassPanel className="p-5 text-center flex flex-col items-center justify-between gap-4 bg-white/[0.01]">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white light-mode:text-slate-900">Supabase Cloud</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Robust row-level security, lightning-fast PostgreSQL database, and CDN-backed storage buckets.
                </p>
              </div>
            </GlassPanel>

            <GlassPanel className="p-5 text-center flex flex-col items-center justify-between gap-4 bg-white/[0.01]">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-400 border border-pink-500/20">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white light-mode:text-slate-900">Google Gemini API</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  State of the art 2.5 Flash LLM parsing academic documents with absolute precision.
                </p>
              </div>
            </GlassPanel>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="mt-4 pt-6 border-t border-white/[0.05] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Heart className="w-4 h-4 text-rose-500 fill-current animate-pulse" /> Shared open-source education platform
          </div>
          <Button
            onClick={() => navigate('/feed')}
            variant="primary"
            size="md"
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Start Browsing Notes
          </Button>
        </section>

      </div>
    </div>
  );
};
export default About;
