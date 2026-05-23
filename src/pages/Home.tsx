import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { 
  Gamepad2, 
  Trophy, 
  ArrowRight,
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Award,
  BookMarked,
  Clock,
  Copy,
  Download,
  Trash2,
  AlignLeft,
  ChevronRight,
  Smile
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../supabase/config';

interface TriviaQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

const ACADEMIC_TRIVIA: TriviaQuestion[] = [
  {
    question: "Which scheduling algorithm is non-preemptive and selects the process with the shortest execution time first?",
    options: ["Round Robin (RR)", "Shortest Job First (SJF)", "First Come First Served (FCFS)", "Priority Scheduling"],
    answer: 1,
    explanation: "Shortest Job First (SJF) can be preemptive or non-preemptive. In its non-preemptive version, once a process gets CPU execution, it does not release it until it completes, choosing the one with the shortest burst time first."
  },
  {
    question: "What is the primary objective of Database Normalization?",
    options: ["To increase storage size", "To eliminate data redundancy and prevent anomalies", "To speed up search times exclusively", "To create foreign keys automatically"],
    answer: 1,
    explanation: "Normalization organizes columns and tables to ensure database dependencies are properly enforced. This eliminates duplicate data (redundancy) and avoids update, insertion, and deletion anomalies."
  },
  {
    question: "Which theorem state that the path integral of a magnetic field around any closed loop is equal to μ₀ times the total current passing through the loop?",
    options: ["Gauss's Law", "Faraday's Law of Induction", "Ampere's Circuital Law", "Lenz's Law"],
    answer: 2,
    explanation: "Ampere's Law relates the integrated magnetic field around a closed loop to the electric current passing through the loop, formulated as ∮B·dl = μ₀I."
  },
  {
    question: "What is the complexity of searching for an element in a perfectly balanced Binary Search Tree (BST)?",
    options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
    answer: 1,
    explanation: "In a perfectly balanced BST, search cuts the search space in half at each node step. Thus, the time complexity is proportional to the tree height, which is O(log n)."
  }
];

const HANDCRAFTED_QUOTES = [
  { text: "First, solve the problem. Then, write the code.", author: "John Johnson" },
  { text: "Simplicity is the soul of efficiency.", author: "Austin Freeman" },
  { text: "The best way to predict the future is to invent it.", author: "Alan Kay" },
  { text: "Make it simple, but significant.", author: "Don Draper" },
  { text: "Science is what we understand well enough to explain to a computer.", author: "Donald Knuth" },
  { text: "Coding is not just writing lines of code; it is designing architectures of thought.", author: "Handcrafted Dev" }
];

export const Home: React.FC = () => {
  const { user, userProfile, isGuest } = useAuth();
  const { success, error, info } = useToast();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  // Greeting and Quotes
  const [activeQuote, setActiveQuote] = useState(HANDCRAFTED_QUOTES[0]!);
  const [stats, setStats] = useState({ notesCount: 0, quizCount: 5, score: 0 });

  // Scratch Notepad States
  const [noteText, setNoteText] = useState(() => {
    return localStorage.getItem('noteweb_scratchpad_note') || '';
  });
  const [noteTheme, setNoteTheme] = useState<'obsidian' | 'cyber' | 'crimson' | 'emerald'>('obsidian');
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('base');

  // Pomodoro Focus Clock States
  const [timeRemaining, setTimeRemaining] = useState(1500); // 25m in seconds
  const [timerDuration, setTimerDuration] = useState(1500);
  const [timerActive, setTimerActive] = useState(false);
  const [timerMode, setTimerMode] = useState<'focus' | 'short' | 'long'>('focus');
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Daily Trivia Arena States
  const [triviaIndex, setTriviaIndex] = useState(0);
  const [selectedTriviaOption, setSelectedTriviaOption] = useState<number | null>(null);
  const [triviaAnswered, setTriviaAnswered] = useState(false);
  const [triviaPointsEarned, setTriviaPointsEarned] = useState(0);

  // 1. Fetch Dynamic Note Stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { count, error: countErr } = await supabase
          .from('notes')
          .select('*', { count: 'exact', head: true });
        
        if (!countErr && count !== null) {
          setStats(prev => ({ ...prev, notesCount: count }));
        }
      } catch (err) {
        console.warn('Failed to fetch real-time note counts:', err);
      }
    };
    fetchStats();

    // Select random motivator quote on load
    const randIdx = Math.floor(Math.random() * HANDCRAFTED_QUOTES.length);
    setActiveQuote(HANDCRAFTED_QUOTES[randIdx]!);
  }, []);

  // 2. Notepad Auto-Saver
  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNoteText(val);
    localStorage.setItem('noteweb_scratchpad_note', val);
  };

  const clearNotepad = () => {
    setNoteText('');
    localStorage.removeItem('noteweb_scratchpad_note');
    info('Notepad cleared');
  };

  const copyNotepadToClipboard = () => {
    if (!noteText.trim()) {
      error('Notepad is empty');
      return;
    }
    navigator.clipboard.writeText(noteText);
    success('Notepad text copied to clipboard!');
  };

  const downloadNotepadText = () => {
    if (!noteText.trim()) {
      error('Notepad is empty');
      return;
    }
    const element = document.createElement("a");
    const file = new Blob([noteText], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `Noteweb_ScratchNote_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    success('Scratch note downloaded successfully!');
  };

  // 3. Pomodoro sound synthesizer (Web Audio API)
  const synthSound = (type: 'tick' | 'bell' | 'start') => {
    if (!audioEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (type === 'tick') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.015, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      } else if (type === 'start') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(640, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'bell') {
        // Double harmony bell
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5 note
        gain1.gain.setValueAtTime(0.12, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(783.99, ctx.currentTime + 0.1); // G5 note
        gain2.gain.setValueAtTime(0.12, ctx.currentTime + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 1.4);
        osc2.stop(ctx.currentTime + 1.6);
      }
    } catch (e) {
      console.warn('Web Audio synthesis blocked:', e);
    }
  };

  // 4. Pomodoro Clock Timer Logic
  useEffect(() => {
    let interval: any = null;
    if (timerActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Timer expired!
            setTimerActive(false);
            synthSound('bell');
            setCompletedPomodoros(c => c + 1);
            
            if (timerMode === 'focus') {
              success('Excellent! Focus session completed. Take a break!');
            } else {
              info('Break completed! Ready to focus?');
            }
            return 0;
          }
          // Make subtle metronome tick every 10 seconds to indicate active state
          if (prev % 10 === 0) {
            synthSound('tick');
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeRemaining, timerMode]);

  const toggleTimer = () => {
    if (!timerActive) {
      synthSound('start');
    }
    setTimerActive(!timerActive);
  };

  const resetTimer = () => {
    setTimerActive(false);
    setTimeRemaining(timerDuration);
  };

  const switchTimerMode = (mode: 'focus' | 'short' | 'long') => {
    setTimerActive(false);
    setTimerMode(mode);
    let dur = 1500; // 25m
    if (mode === 'short') dur = 300; // 5m
    if (mode === 'long') dur = 900; // 15m
    setTimerDuration(dur);
    setTimeRemaining(dur);
  };

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  // Calculate percentage elapsed for the circular dial
  const percentageCompleted = ((timerDuration - timeRemaining) / timerDuration) * 100;
  const strokeDashoffset = 282.6 - (282.6 * percentageCompleted) / 100;

  // 5. Daily Trivia Click Handler
  const handleTriviaAnswer = (optIdx: number) => {
    if (triviaAnswered) return;
    setSelectedTriviaOption(optIdx);
    setTriviaAnswered(true);
    
    const activeQ = ACADEMIC_TRIVIA[triviaIndex]!;
    if (optIdx === activeQ.answer) {
      synthSound('bell');
      setTriviaPointsEarned(prev => prev + 10);
      success('Correct! You gained +10 Study Points!');
    } else {
      synthSound('tick');
      error('Incorrect answer. Review explanation!');
    }
  };

  const nextTriviaQuestion = () => {
    setSelectedTriviaOption(null);
    setTriviaAnswered(false);
    setTriviaIndex(prev => (prev + 1) % ACADEMIC_TRIVIA.length);
  };

  // Profile metadata display
  const studentName = isGuest ? 'Guest Student' : (userProfile?.displayName || user?.displayName || 'Student');
  const studentYear = isGuest ? 'Year 1' : (userProfile?.year ? `Year ${userProfile.year}` : 'Active Student');
  const studentBranch = isGuest ? 'General' : (userProfile?.branch ? userProfile.branch.toUpperCase() : 'CSE');

  // Notebook visual backgrounds
  const notepadStyles = {
    obsidian: {
      bg: 'bg-[#05050A]/60 text-slate-100 border-[#00F2FE]/25 focus-within:border-[#00F2FE]/50',
      textarea: 'bg-transparent text-slate-100 placeholder-slate-600',
      accentColor: 'text-[#00F2FE]'
    },
    cyber: {
      bg: 'bg-[#0E0616]/75 text-purple-100 border-[#7F00FF]/30 focus-within:border-[#7F00FF]/60',
      textarea: 'bg-transparent text-purple-100 placeholder-purple-800',
      accentColor: 'text-[#7F00FF]'
    },
    crimson: {
      bg: 'bg-[#0F0307]/75 text-rose-100 border-[#FF007F]/20 focus-within:border-[#FF007F]/50',
      textarea: 'bg-transparent text-rose-100 placeholder-rose-900',
      accentColor: 'text-[#FF007F]'
    },
    emerald: {
      bg: 'bg-[#020B06]/75 text-emerald-100 border-[#00FF87]/25 focus-within:border-[#00FF87]/50',
      textarea: 'bg-transparent text-emerald-100 placeholder-emerald-800',
      accentColor: 'text-[#00FF87]'
    }
  };

  const currentNotepadStyle = notepadStyles[noteTheme];

  const fontSizeClasses = {
    sm: 'text-xs',
    base: 'text-sm font-medium',
    lg: 'text-base font-semibold'
  };

  return (
    <div className={`min-h-screen w-full relative py-6 px-3 sm:px-6 lg:px-8 flex flex-col justify-start items-center overflow-x-hidden text-left ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
      
      {/* Background ambient glows */}
      <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-purple-600/5 rounded-full pointer-events-none blur-3xl" />
      <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-[#00F2FE]/5 rounded-full pointer-events-none blur-3xl" />

      <div className="max-w-7xl mx-auto z-10 relative flex flex-col gap-8 w-full">
        
        {/* Workspace Title Block */}
        <div className={`flex flex-col gap-2.5 border-b pb-5 ${isDark ? 'border-white/[0.06]' : 'border-slate-200/80'}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border ${isDark ? 'bg-[#00F2FE]/10 border-[#00F2FE]/25 text-[#00F2FE]' : 'bg-indigo-50 border-indigo-200 text-indigo-600'}`}>
              <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Active Workspace Desk
            </span>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border ${isDark ? 'text-slate-500 bg-white/[0.02] border-white/[0.04]' : 'text-slate-400 bg-slate-100/80 border-slate-200/60'}`}>
              <Clock className="w-3 h-3" /> Auto-saved Desk
            </span>
          </div>
          
          <h1 className={`text-3xl font-black tracking-tight leading-none mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Welcome back, <span className="bg-gradient-to-r from-[#00F2FE] via-[#7F00FF] to-[#FF007F] bg-clip-text text-transparent">{studentName}</span>
          </h1>
          <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Manage notes, trigger timer bursts, study daily trivia concept teasers, and coordinate library modules.
          </p>
        </div>

        {/* ─────────────────────────────────────────────────────────────
           DESK WORKSPACE DUAL-PANEL SYSTEM
           ───────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ==========================================================
             LEFT SIDE: STUDY TOOLS COCKPIT (Notepad & Pomodoro Timer)
             ========================================================== */}
          <div className="lg:col-span-5 flex flex-col gap-6 w-full">
            
            {/* WIDGET 1: AESTHETIC INTERACTIVE NOTEPAD */}
            <div className={`rounded-3xl border p-5 flex flex-col gap-4 shadow-xl backdrop-blur-2xl transition-all duration-300 relative overflow-hidden ${isDark ? currentNotepadStyle.bg : 'bg-white/90 border-slate-200/80 text-slate-800 focus-within:border-indigo-300'}`}>
              
              {/* Notepad Glow Backdrop Decoration */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-tr from-white/[0.01] to-white/[0.03] blur-xl pointer-events-none" />

              {/* Notepad Header Panel */}
              <div className={`flex items-center justify-between border-b pb-3 z-10 ${isDark ? 'border-white/[0.04]' : 'border-slate-200/60'}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-slate-100 border-slate-200'}`}>
                    <AlignLeft className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                  </div>
                  <div>
                    <h3 className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Study Scratchpad</h3>
                    <p className={`text-[9px] font-bold mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Stored in local cache</p>
                  </div>
                </div>

                {/* Theme presets togglers */}
                <div className="flex items-center gap-1 bg-white/[0.02] border border-white/[0.05] p-1 rounded-xl">
                  {(['obsidian', 'cyber', 'crimson', 'emerald'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setNoteTheme(t)}
                      className={`w-3.5 h-3.5 rounded-full border transition-all active:scale-75 ${
                        t === 'obsidian' ? 'bg-[#00F2FE] border-[#00F2FE]/40' :
                        t === 'cyber' ? 'bg-[#7F00FF] border-[#7F00FF]/40' :
                        t === 'crimson' ? 'bg-[#FF007F] border-[#FF007F]/40' :
                        'bg-[#00FF87] border-[#00FF87]/40'
                      } ${noteTheme === t ? 'ring-2 ring-white/60 scale-110' : 'scale-90 opacity-60'}`}
                      title={`${t.toUpperCase()} note theme`}
                    />
                  ))}
                </div>
              </div>

              {/* Editor Text Area */}
              <textarea
                value={noteText}
                onChange={handleNoteChange}
                placeholder="Jot down quick lecture summaries, formulas, lists, or questions here. It auto-saves instantly..."
                className={`w-full h-48 focus:outline-none resize-none font-medium leading-relaxed ${fontSizeClasses[fontSize]} ${isDark ? currentNotepadStyle.textarea : 'bg-transparent text-slate-800 placeholder-slate-400'}`}
              />

              {/* Editor Controls Bar */}
              <div className={`flex flex-wrap items-center justify-between gap-3 pt-3 border-t z-10 ${isDark ? 'border-white/[0.04]' : 'border-slate-200/60'}`}>
                {/* Font Size Preset Toggles */}
                <div className="flex items-center gap-1.5 bg-white/[0.02] border border-white/[0.04] p-0.5 rounded-lg text-[9px] font-bold text-slate-400">
                  {(['sm', 'base', 'lg'] as const).map(sz => (
                    <button
                      key={sz}
                      onClick={() => setFontSize(sz)}
                      className={`px-2 py-1 rounded transition-all capitalize ${
                        fontSize === sz ? 'bg-white/5 text-white shadow' : 'hover:text-slate-300'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>

                {/* Operations tools */}
                <div className="flex items-center gap-1.5">
                  {/* Clipboard tool */}
                  <button
                    onClick={copyNotepadToClipboard}
                    className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] hover:text-white transition-all active:scale-90 text-slate-400"
                    title="Copy note text to clipboard"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {/* Download tool */}
                  <button
                    onClick={downloadNotepadText}
                    className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] hover:text-white transition-all active:scale-90 text-slate-400"
                    title="Download scratch note as TXT file"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  {/* Wipe tool */}
                  <button
                    onClick={clearNotepad}
                    className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 transition-all active:scale-90 text-slate-400"
                    title="Clear notepad text"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </div>

            {/* WIDGET 2: HIGH-FIDELITY POMODORO FOCUS TIMER */}
            <div className={`rounded-3xl border p-5 flex flex-col gap-4 shadow-xl backdrop-blur-2xl relative overflow-hidden premium-border-glow ${isDark ? 'border-white/5 bg-[#05050A]/60' : 'border-slate-200/80 bg-white/90'}`}>
              
              {/* Radiant Inner Glow Deco */}
              <div className="absolute -bottom-10 -right-10 w-28 h-28 bg-[#7F00FF]/5 blur-3xl pointer-events-none" />

              {/* Timer Header */}
              <div className={`flex items-center justify-between border-b pb-3 z-10 ${isDark ? 'border-white/[0.04]' : 'border-slate-200/60'}`}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <h3 className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Focus Commander</h3>
                    <p className={`text-[9px] font-bold mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Pomodoro cycle interval</p>
                  </div>
                </div>

                {/* Sound alert switch */}
                <button
                  onClick={() => setAudioEnabled(!audioEnabled)}
                  className={`p-1.5 rounded-lg border transition-all ${
                    audioEnabled 
                      ? 'bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20' 
                      : 'bg-white/[0.01] border-white/[0.05] text-slate-500'
                  }`}
                  title={audioEnabled ? 'Sound cues active' : 'Sound cues muted'}
                >
                  {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Timer Main Panel */}
              <div className="flex flex-col sm:flex-row items-center gap-6 py-2.5 justify-center z-10">
                
                {/* Circular Gauge Clock Block */}
                <div className="relative w-28 h-28 flex items-center justify-center flex-shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    {/* Ring track */}
                    <circle
                      cx="56"
                      cy="56"
                      r="45"
                      className={`${isDark ? 'stroke-slate-800/40' : 'stroke-slate-200'} fill-none`}
                      strokeWidth="5"
                    />
                    {/* Active ring indicator dial */}
                    <circle
                      cx="56"
                      cy="56"
                      r="45"
                      className="stroke-purple-500 fill-none transition-all duration-1000 ease-linear"
                      strokeWidth="5"
                      strokeDasharray="282.6"
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                    />
                  </svg>
                  {/* Centered digits display */}
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className={`text-xl font-black font-mono tracking-tight leading-none ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      {formatTime(timeRemaining)}
                    </span>
                    <span className="text-[7.5px] font-black uppercase text-purple-400 tracking-wider mt-1 block">
                      {timerMode}
                    </span>
                  </div>
                </div>

                {/* Timer Controls & Mode presets */}
                <div className="flex flex-col gap-3 flex-1 w-full text-center sm:text-left">
                  {/* Preset modes selector */}
                  <div className={`grid grid-cols-3 gap-1.5 p-1 rounded-xl border ${
                    isDark 
                      ? 'bg-white/[0.02] border-white/[0.04]' 
                      : 'bg-slate-100/50 border-slate-200/60'
                  }`}>
                    {(['focus', 'short', 'long'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => switchTimerMode(mode)}
                        className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                          timerMode === mode 
                            ? (isDark 
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/20' 
                                : 'bg-purple-100 text-purple-700 border border-purple-200/60'
                              ) 
                            : (isDark 
                                ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.02] border border-transparent' 
                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 border border-transparent'
                              )
                        }`}
                      >
                        {mode === 'focus' ? 'Focus 25' : mode === 'short' ? 'Short 5' : 'Long 15'}
                      </button>
                    ))}
                  </div>

                  {/* Operation Buttons */}
                  <div className="flex items-center justify-center sm:justify-start gap-2.5">
                    <button
                      onClick={toggleTimer}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl font-black text-xs transition-all active:scale-95 cursor-pointer ${
                        timerActive 
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20' 
                          : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg'
                      }`}
                    >
                      {timerActive ? (
                        <>
                          <Pause className="w-3.5 h-3.5" /> Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" /> Start Focus
                        </>
                      )}
                    </button>

                    <button
                      onClick={resetTimer}
                      className={`p-2.5 rounded-xl border transition-all active:scale-90 cursor-pointer ${
                        isDark 
                          ? 'border-white/[0.04] bg-white/[0.01] text-slate-400 hover:text-white hover:bg-white/5' 
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-800 hover:bg-slate-100'
                      }`}
                      title="Reset focus clock"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Stats note */}
                  <div className="text-[9px] font-bold text-slate-500 flex items-center justify-center sm:justify-start gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Completed Pomodoros: {completedPomodoros}</span>
                  </div>
                </div>

              </div>

            </div>

          </div>

          {/* ==========================================================
             RIGHT SIDE: INTERACTIVE HUB (Teaser Game & Library Nexus)
             ========================================================== */}
          <div className="lg:col-span-7 flex flex-col gap-6 w-full">
            
            {/* WIDGET 3: STUDENT GREETING & RANK BADGE PANEL */}
            <div className={`rounded-3xl border p-6 shadow-xl backdrop-blur-2xl flex flex-col sm:flex-row items-center sm:justify-between gap-6 relative overflow-hidden premium-border-glow ${isDark ? 'border-white/5 bg-gradient-to-tr from-[#05050A]/70 via-[#0B0F19]/40 to-[#05050A]/70' : 'border-slate-200/80 bg-gradient-to-tr from-white/95 to-indigo-50/60'}`}>
              
              {/* Dynamic decorative visual neon particle line overlay */}
              <div className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b from-[#00F2FE] via-[#7F00FF] to-[#FF007F]" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#00F2FE]/5 blur-3xl pointer-events-none" />

              <div className="space-y-2.5 z-10 flex-1">
                <div className={`flex items-center gap-1.5 text-[9px] font-black tracking-wider uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <Award className="w-3.5 h-3.5 text-amber-400" /> Student Profile Standing
                </div>
                <h3 className={`text-xl font-black leading-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  Academic Rank Dashboard
                </h3>
                <div className={`flex flex-wrap items-center gap-4 text-xs font-semibold mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <span className={`px-2.5 py-1 rounded border ${isDark ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-slate-100/80 border-slate-200/60'}`}>
                    Branch: <strong className={isDark ? 'text-white' : 'text-slate-800'}>{studentBranch}</strong>
                  </span>
                  <span className={`px-2.5 py-1 rounded border ${isDark ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-slate-100/80 border-slate-200/60'}`}>
                    Standing: <strong className={isDark ? 'text-white' : 'text-slate-800'}>{studentYear}</strong>
                  </span>
                </div>
                
                {/* Quote */}
                <div className={`border-t pt-3 mt-3 ${isDark ? 'border-white/[0.04]' : 'border-slate-200/60'}`}>
                  <p className={`text-xs italic font-medium ${isDark ? 'text-indigo-200' : 'text-indigo-600'}`}>
                    "{activeQuote.text}"
                  </p>
                  <span className={`text-[9px] font-bold block mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    — {activeQuote.author}
                  </span>
                </div>
              </div>

              {/* Dynamic Points Pod Counter */}
              <div className="w-full sm:w-auto p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex sm:flex-col items-center justify-between sm:justify-center gap-2.5 z-10 flex-shrink-0">
                <div className="text-left sm:text-center">
                  <span className="text-[9px] font-black tracking-wider uppercase text-slate-500 block">Total points</span>
                  <span className="text-2xl font-black text-white tracking-tight mt-0.5 block">
                    {stats.score + triviaPointsEarned + (isGuest ? 0 : (userProfile?.points || 0))} Pts
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-lg flex-shrink-0 animate-pulse">
                  <Trophy className="w-5 h-5" />
                </div>
              </div>

            </div>

            {/* WIDGET 4: CAMPUS ACADEMIC TRIVIA ARENA (FULLY INTERACTIVE) */}
            <div className={`rounded-3xl border p-6 shadow-xl backdrop-blur-2xl flex flex-col gap-4 relative overflow-hidden premium-border-glow ${isDark ? 'border-white/5 bg-[#05050A]/60' : 'border-slate-200/80 bg-white/90'}`}>
              
              {/* Backlit background glow */}
              <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-tr from-[#00FF87]/5 to-[#60EFFF]/5 blur-3xl pointer-events-none" />

              {/* Trivia Header */}
              <div className={`flex items-center justify-between border-b pb-3 z-10 ${isDark ? 'border-white/[0.04]' : 'border-slate-200/60'}`}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Gamepad2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                  </div>
                  <div>
                    <h3 className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Daily Brain Teaser</h3>
                    <p className={`text-[9px] font-bold mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Solve trivia to earn points</p>
                  </div>
                </div>

                <span className="text-[9px] font-black tracking-wider uppercase text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">
                  TRIVIA ARENA
                </span>
              </div>

              {/* Game Question Block */}
              <div className="space-y-4 py-1 z-10">
                
                {/* Question */}
                <div>
                  <span className={`text-[9px] font-black tracking-widest block uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Question #{triviaIndex + 1}</span>
                  <h4 className={`text-sm sm:text-base font-extrabold leading-relaxed mt-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {ACADEMIC_TRIVIA[triviaIndex]!.question}
                  </h4>
                </div>

                {/* Interactive Options list */}
                <div className="flex flex-col gap-2.5">
                  {ACADEMIC_TRIVIA[triviaIndex]!.options.map((opt, idx) => {
                    const isSelected = selectedTriviaOption === idx;
                    const isCorrect = idx === ACADEMIC_TRIVIA[triviaIndex]!.answer;
                    
                    let buttonStyle = "bg-white/[0.01] border-white/[0.04] text-slate-300 hover:bg-white/[0.03] hover:text-slate-100";
                    if (triviaAnswered) {
                      if (isCorrect) {
                        buttonStyle = "bg-[#00FF87]/5 border-[#00FF87]/30 text-[#00FF87] shadow-[0_0_12px_rgba(0,255,135,0.06)]";
                      } else if (isSelected) {
                        buttonStyle = "bg-rose-500/5 border-rose-500/30 text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.06)]";
                      } else {
                        buttonStyle = "bg-white/[0.01] border-white/[0.04] text-slate-500 opacity-60";
                      }
                    } else if (isSelected) {
                      buttonStyle = "bg-[#00F2FE]/10 border-[#00F2FE]/40 text-[#00F2FE] scale-[1.01]";
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => handleTriviaAnswer(idx)}
                        disabled={triviaAnswered}
                        className={`w-full text-left p-3.5 rounded-2xl border text-xs font-bold leading-normal transition-all duration-300 active:scale-[0.99] flex items-center justify-between gap-3 ${buttonStyle}`}
                      >
                        <span className="flex-1">{opt}</span>
                        {/* Status checks */}
                        {triviaAnswered && isCorrect && <span className="text-[10px] font-black uppercase text-emerald-400 flex items-center gap-0.5">✔ Correct</span>}
                        {triviaAnswered && isSelected && !isCorrect && <span className="text-[10px] font-black uppercase text-rose-400 flex items-center gap-0.5">✘ Wrong</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Explanation block visible on answered */}
                <AnimatePresence>
                  {triviaAnswered && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] text-[11px] leading-relaxed text-slate-400"
                    >
                      <strong className="text-slate-300 block mb-1">Concepts Explanation:</strong>
                      {ACADEMIC_TRIVIA[triviaIndex]!.explanation}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Next button */}
                {triviaAnswered && (
                  <div className="flex items-center justify-end pt-2">
                    <Button
                      onClick={nextTriviaQuestion}
                      variant="primary"
                      size="sm"
                      rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                    >
                      Next Question
                    </Button>
                  </div>
                )}

              </div>

            </div>

            {/* WIDGET 5: QUICK BRANCHES EXPLORER NAVIGATION PANEL */}
            <div className={`rounded-3xl border p-6 shadow-xl backdrop-blur-2xl flex flex-col gap-4 relative overflow-hidden premium-border-glow ${isDark ? 'border-white/5 bg-[#05050A]/60' : 'border-slate-200/80 bg-white/90'}`}>
              
              <div className={`flex items-center justify-between border-b pb-3 z-10 ${isDark ? 'border-white/[0.04]' : 'border-slate-200/60'}`}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                    <BookMarked className="w-4 h-4 text-sky-400" />
                  </div>
                  <div>
                    <h3 className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Curriculum Branches</h3>
                    <p className={`text-[9px] font-bold mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Browse notes by department</p>
                  </div>
                </div>

                <button
                  onClick={() => navigate('/categories')}
                  className="inline-flex items-center gap-1 text-[10px] font-black text-slate-400 hover:text-white transition-colors"
                >
                  View All <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {/* Grid of branches */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 z-10">
                
                {/* CS Branch */}
                <div 
                  onClick={() => navigate('/feed', { state: { branchFilter: 'computers' } })}
                  className={`p-3.5 rounded-2xl border hover:border-sky-300/50 transition-all cursor-pointer group active:scale-95 ${isDark ? 'bg-white/[0.01] border-white/[0.04] hover:bg-[#00F2FE]/5' : 'bg-slate-50/80 border-slate-200/60 hover:bg-sky-50'}`}
                >
                  <span className="text-[8px] font-black uppercase text-sky-500 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded">CS Branch</span>
                  <h4 className={`text-xs font-extrabold mt-2 group-hover:text-sky-500 ${isDark ? 'text-white' : 'text-slate-800'}`}>Computer Science</h4>
                  <span className={`text-[9px] font-medium mt-1 block ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Data Structures & DBMS</span>
                </div>

                {/* Math Branch */}
                <div 
                  onClick={() => navigate('/feed', { state: { branchFilter: 'maths' } })}
                  className={`p-3.5 rounded-2xl border hover:border-purple-300/50 transition-all cursor-pointer group active:scale-95 ${isDark ? 'bg-white/[0.01] border-white/[0.04] hover:bg-[#7F00FF]/5' : 'bg-slate-50/80 border-slate-200/60 hover:bg-purple-50'}`}
                >
                  <span className="text-[8px] font-black uppercase text-purple-500 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">M Branch</span>
                  <h4 className={`text-xs font-extrabold mt-2 group-hover:text-purple-500 ${isDark ? 'text-white' : 'text-slate-800'}`}>Mathematics</h4>
                  <span className={`text-[9px] font-medium mt-1 block ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Calculus & Algebra</span>
                </div>

                {/* Science Branch */}
                <div 
                  onClick={() => navigate('/feed', { state: { branchFilter: 'science' } })}
                  className={`p-3.5 rounded-2xl border hover:border-rose-300/50 transition-all cursor-pointer group active:scale-95 ${isDark ? 'bg-white/[0.01] border-white/[0.04] hover:bg-rose-500/5' : 'bg-slate-50/80 border-slate-200/60 hover:bg-rose-50'}`}
                >
                  <span className="text-[8px] font-black uppercase text-rose-500 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded">BSE Branch</span>
                  <h4 className={`text-xs font-extrabold mt-2 group-hover:text-rose-500 ${isDark ? 'text-white' : 'text-slate-800'}`}>Basic Sciences</h4>
                  <span className={`text-[9px] font-medium mt-1 block ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Physics & Mechanics</span>
                </div>

              </div>

              {/* Feed CTA panel */}
              <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 mt-2.5 pt-4 border-t text-[10px] font-bold z-10 ${isDark ? 'border-white/[0.04] text-slate-500' : 'border-slate-200/60 text-slate-400'}`}>
                <span className="flex items-center gap-1.5"><Smile className="w-3.5 h-3.5 text-indigo-400 animate-bounce" /> Library catalog: {stats.notesCount} verified uploads</span>
                <button
                  onClick={() => navigate('/feed')}
                  className={`transition-colors flex items-center gap-0.5 group active:scale-95 ${isDark ? 'text-indigo-400 hover:text-white' : 'text-indigo-600 hover:text-indigo-800'}`}
                >
                  Go to Library Feed <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-all" />
                </button>
              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
};

export default Home;
