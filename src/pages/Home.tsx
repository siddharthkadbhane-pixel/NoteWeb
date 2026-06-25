// Diagnostic: Verify local git tracking
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { 
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
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../supabase/config';
import { callAiChatCompletion } from '../services/gemini';

// Academic trivia was successfully removed to make room for our premium AI Study Planner roadmap widget.

const HANDCRAFTED_QUOTES = [
  { text: "First, solve the problem. Then, write the code.", author: "John Johnson" },
  { text: "Simplicity is the soul of efficiency.", author: "Austin Freeman" },
  { text: "The best way to predict the future is to invent it.", author: "Alan Kay" },
  { text: "Make it simple, but significant.", author: "Don Draper" },
  { text: "Science is what we understand well enough to explain to a computer.", author: "Donald Knuth" },
  { text: "Coding is not just writing lines of code; it is designing architectures of thought.", author: "Handcrafted Dev" }
];

export const Home: React.FC = () => {
  const { user, userProfile, isGuest, updatePoints } = useAuth();
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

  // AI Exam Study Planner States
  const [plannerSubj, setPlannerSubj] = useState('');
  const [plannerTime, setPlannerTime] = useState('3 Days');
  const [plannerGoal, setPlannerGoal] = useState('Score A+');
  const [plannerLoading, setPlannerLoading] = useState(false);
  
  const [activePlanSubj, setActivePlanSubj] = useState(() => {
    return localStorage.getItem('noteweb-study-plan-subject') || '';
  });
  const [studyPlan, setStudyPlan] = useState<any[] | null>(() => {
    const saved = localStorage.getItem('noteweb-study-plan');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return null;
  });
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('noteweb-study-plan-progress');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return {};
  });

  const [branches, setBranches] = useState<any[]>([]);

  // 1. Fetch Dynamic Note Stats & Branches
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

    const fetchBranches = async () => {
      try {
        const { data, error } = await supabase.from('branches').select('*');
        if (error) throw error;
        
        const blacklistIds = ['bse', 'cs', 'mgt', 'm', 'math', 'mathematics', 'basic-science', 'computer-science'];
        const blacklistNames = [
          'basic science & eng',
          'basic science',
          'basic sciences',
          'computer science',
          'mathematics',
          'management & humanities'
        ];
        
        let filtered = (data || []).filter((b: any) => {
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

        // Sort by custom order
        const coreOrder = ['cse', 'aiml', 'ds', 'ece', 'mechanical', 'civil'];
        filtered.sort((a: any, b: any) => {
          const indexA = coreOrder.indexOf(a.id);
          const indexB = coreOrder.indexOf(b.id);
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;
          return a.name.localeCompare(b.name);
        });

        setBranches(filtered);
      } catch (err) {
        console.warn('Failed to fetch dynamic branches in Home:', err);
        setBranches([
          { id: 'cse', name: 'Computer Science & Engineering', notes_count: 'CSE', description: 'Data Structures, Algorithms, Software Engineering, Web Dev, Databases, and operating systems.' },
          { id: 'aiml', name: 'AI & Machine Learning', notes_count: 'AI&ML', description: 'Neural Networks, Deep Learning, Computer Vision, NLP, and Robotics.' },
          { id: 'ds', name: 'Data Science', notes_count: 'DS', description: 'Data analytics, statistical learning, visualization, big data processing, and predictive models.' }
        ]);
      }
    };

    fetchStats();
    fetchBranches();

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

  // AI Study Plan Helpers
  const generateMockPlan = (subj: string, time: string) => {
    return [
      {
        title: "Foundations & High-Yield Analysis",
        duration: "Phase 1 (Preparation)",
        tasks: [
          `Summarize core formulas, theorems, and definitions in ${subj}`,
          `Find the top 3 highest-weight notes in NoteWeb's curriculum library`,
          `Draft a 1-page visual cheatsheet mapping out weak concepts`
        ]
      },
      {
        title: "Practice & Active Recall Review",
        duration: "Phase 2 (Problem Solving)",
        tasks: [
          `Solve 5 standard university past-exam questions on ${subj}`,
          `Explain the core mechanism of the most complex topic to a peer`,
          `Join a Study Room in the NoteWeb Chat to ask fellow students for feedback`
        ]
      },
      {
        title: "Simulated Exam & Mental Polish",
        duration: "Phase 3 (Final Polish)",
        tasks: [
          `Run a ${time} mock exam timer using the Focus Commander widget`,
          `Complete a deep self-review of mistakes using AI academic summaries`,
          `Claim your quests in NoteWeb Profile and take a deep breath before the exam!`
        ]
      }
    ];
  };

  const generateAiStudyPlan = async (subject: string, timeframe: string, goal: string): Promise<any[]> => {
    const systemInstruction = "You are NoteWeb's expert AI Study Planner. Your task is to generate customized, action-oriented study roadmaps.";
    
    const prompt = `Generate a customized exam preparation study roadmap for the subject: "${subject}", with a timeframe of "${timeframe}" and a target goal of "${goal}".
Format your response as a strict raw JSON array of exactly 3 phases. Do not wrap in markdown code blocks (e.g. do not write \`\`\`json), and include absolutely no explanations or introductory sentences. Return only the raw JSON.
Each phase object MUST have exactly these keys:
- "title": Short title of the study phase (e.g. "Phase 1: Concepts & Core Formulas")
- "duration": Duration or timeframe chunk (e.g. "Day 1" or "First 4 Hours")
- "tasks": Array of exactly 3 specific, checkable, action-oriented task strings (e.g. ["Revise AVL tree balancing", "Solve 5 past equations on calculus", "Summarize Lecture 3 notes"]).

Example raw format:
[
  {
    "title": "Phase 1 Title",
    "duration": "Day 1",
    "tasks": ["Task 1", "Task 2", "Task 3"]
  }
]`;

    const generatedText = await callAiChatCompletion(systemInstruction, prompt);
    const cleanedText = generatedText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const parsed = JSON.parse(cleanedText);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    throw new Error('Invalid JSON array structure returned from AI');
  };

  // AI Study Plan Generation Handler
  const handleGenerateStudyPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plannerSubj.trim()) {
      info("Please enter a subject name first!");
      return;
    }

    setPlannerLoading(true);
    try {
      let plan: any[] = [];
      try {
        plan = await generateAiStudyPlan(plannerSubj, plannerTime, plannerGoal);
      } catch (err) {
        console.warn("[NoteWeb AI Planner] API call failed or missing key, generating fallback mockup...", err);
        // Quick 1000ms delay to make the AI animation feel organic
        await new Promise(r => setTimeout(r, 1000));
        plan = generateMockPlan(plannerSubj, plannerTime);
      }

      setStudyPlan(plan);
      setActivePlanSubj(plannerSubj);
      setCompletedTasks({});
      
      localStorage.setItem('noteweb-study-plan', JSON.stringify(plan));
      localStorage.setItem('noteweb-study-plan-subject', plannerSubj);
      localStorage.setItem('noteweb-study-plan-progress', JSON.stringify({}));
      
      success(`AI Study Roadmap generated for ${plannerSubj}!`);
    } catch (err: any) {
      console.error(err);
      error("Failed to generate study plan: " + err.message);
    } finally {
      setPlannerLoading(false);
    }
  };

  const handleToggleTask = (phaseIdx: number, taskIdx: number) => {
    const taskKey = `${phaseIdx}-${taskIdx}`;
    const nextCompleted = {
      ...completedTasks,
      [taskKey]: !completedTasks[taskKey]
    };
    setCompletedTasks(nextCompleted);
    localStorage.setItem('noteweb-study-plan-progress', JSON.stringify(nextCompleted));

    // Award minor point bonus for completing tasks!
    if (!completedTasks[taskKey]) {
      synthSound('bell');
      success("Task Completed! +5 study points awarded!");
      if (!isGuest && userProfile) {
        try {
          updatePoints(5);
        } catch (e) {}
      }
    } else {
      synthSound('tick');
    }
  };

  const handleClearStudyPlan = () => {
    if (!window.confirm("Are you sure you want to delete your active study plan?")) return;
    setStudyPlan(null);
    setActivePlanSubj('');
    setCompletedTasks({});
    localStorage.removeItem('noteweb-study-plan');
    localStorage.removeItem('noteweb-study-plan-subject');
    localStorage.removeItem('noteweb-study-plan-progress');
    info("Study plan cleared.");
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
    <>
      {/* Skip-to-content link for keyboard users */}
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <div
        id="main-content"
        role="main"
        className={`min-h-screen w-full relative py-6 px-3 sm:px-6 lg:px-8 flex flex-col justify-start items-center overflow-x-hidden text-left ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
      >
      
      {/* Background ambient glows */}
      <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-purple-600/5 rounded-full pointer-events-none blur-3xl" />
      <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-[#00F2FE]/5 rounded-full pointer-events-none blur-3xl" />

      <div className="max-w-7xl mx-auto z-10 relative flex flex-col gap-8 w-full">

        {/* ── FULL-WIDTH HERO — CONVERSION CLARITY (DesignMeter Critical Fix) ── */}
        <section
          aria-labelledby="hero-heading"
          className={`rounded-3xl border p-6 sm:p-8 lg:p-10 flex flex-col items-center text-center gap-6 relative overflow-hidden ${isDark ? 'bg-indigo-600/[0.06] border-indigo-500/15' : 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200/60'}`}
        >
          {/* Background glow accent */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-indigo-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center gap-4 max-w-3xl">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black tracking-wider uppercase border ${isDark ? 'bg-[#00F2FE]/10 border-[#00F2FE]/25 text-[#00F2FE]' : 'bg-indigo-100 border-indigo-200 text-indigo-700'}`}>
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> Academic Study Platform
            </span>

            <h1 id="hero-heading" className={`heading-display ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Study Smarter with{' '}
              <span className="bg-gradient-to-r from-[#00F2FE] via-[#7F00FF] to-[#FF007F] bg-clip-text text-transparent">AI-Powered Notes</span>
            </h1>

            <p className={`text-sm sm:text-base font-medium leading-relaxed prose-readable mx-auto ${isDark ? 'text-muted-accessible' : 'text-slate-600'}`}>
              Access peer-verified college notes, generate custom study roadmaps with Gemini AI, and stay focused with a built-in Pomodoro timer — all in one platform.
            </p>

            {/* Feature badges */}
            <div className="flex flex-wrap justify-center gap-2 mt-1" role="list" aria-label="Key features">
              {[
                { label: '📚 Notes Library', color: isDark ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' : 'bg-sky-50 border-sky-200 text-sky-700' },
                { label: '🤖 AI Study Planner', color: isDark ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-purple-50 border-purple-200 text-purple-700' },
                { label: '⏱ Focus Timer', color: isDark ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-indigo-50 border-indigo-200 text-indigo-700' },
              ].map(f => (
                <span key={f.label} role="listitem" className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold border ${f.color}`}>{f.label}</span>
              ))}
            </div>

            {/* Primary CTAs */}
            <div className="flex flex-col sm:flex-row items-center gap-3 mt-2 w-full sm:w-auto">
              <button
                onClick={() => navigate('/feed')}
                aria-label="Browse the notes library"
                className="cta-hero group"
              >
                Browse Notes Library <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
              </button>
              {isGuest && (
                <button
                  onClick={() => navigate('/login')}
                  aria-label="Sign up or log in"
                  className="cta-secondary"
                >
                  Sign Up — It's Free
                </button>
              )}
            </div>

            {/* Social proof */}
            <p className={`text-xs font-semibold flex items-center gap-1.5 ${isDark ? 'text-muted-accessible' : 'text-slate-500'}`}>
              <Smile className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
              {stats.notesCount} verified notes uploaded by students
            </p>
          </div>
        </section>

        {/* Workspace Context Bar */}
        <div className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 border-b pb-5 ${isDark ? 'border-white/[0.06]' : 'border-slate-200/80'}`}>
          <div className="flex-1 min-w-0">
            <h2 className={`text-xl sm:text-2xl font-black tracking-tight leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Welcome back, <span className="bg-gradient-to-r from-[#00F2FE] via-[#7F00FF] to-[#FF007F] bg-clip-text text-transparent">{studentName}</span>
            </h2>
            <p className={`text-sm font-medium leading-relaxed mt-1 ${isDark ? 'text-muted-accessible' : 'text-slate-500'}`}>
              Manage notes, run focus sessions, generate AI study roadmaps, and browse your curriculum library.
            </p>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border self-start ${isDark ? 'text-muted-accessible bg-white/[0.02] border-white/[0.04]' : 'text-slate-500 bg-slate-100/80 border-slate-200/60'}`}>
            <Clock className="w-3 h-3" aria-hidden="true" /> Auto-saved Desk
          </span>
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
            <div className={`rounded-3xl border p-6 flex flex-col gap-4 shadow-xl backdrop-blur-2xl transition-all duration-300 relative overflow-hidden ${isDark ? currentNotepadStyle.bg : 'glass-panel text-slate-800 focus-within:border-indigo-300'}`}>
              
              {/* Notepad Glow Backdrop Decoration */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-tr from-white/[0.01] to-white/[0.03] blur-xl pointer-events-none" />

              {/* Notepad Header Panel */}
              <div className={`flex items-center justify-between border-b pb-3 z-10 ${isDark ? 'border-white/[0.04]' : 'border-slate-200/60'}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-slate-100 border-slate-200'}`}>
                    <AlignLeft className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                  </div>
                  <div>
                    <h3 className={`text-sm sm:text-base font-black uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Study Scratchpad</h3>
                    <p className="text-xs font-semibold mt-0.5 text-muted-accessible">Stored in local cache</p>
                  </div>
                </div>

                {/* Theme presets togglers */}
                <div className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.05] p-1.5 rounded-xl" role="group" aria-label="Note colour theme">
                  {(['obsidian', 'cyber', 'crimson', 'emerald'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNoteTheme(t)}
                      aria-label={`Switch to ${t} note theme`}
                      aria-pressed={noteTheme === t}
                      className={`w-6 h-6 rounded-full border transition-all active:scale-75 tap-target-compact tap-target-expanded ${
                        t === 'obsidian' ? 'bg-[#00F2FE] border-[#00F2FE]/40' :
                        t === 'cyber' ? 'bg-[#7F00FF] border-[#7F00FF]/40' :
                        t === 'crimson' ? 'bg-[#FF007F] border-[#FF007F]/40' :
                        'bg-[#00FF87] border-[#00FF87]/40'
                      } ${noteTheme === t ? 'ring-2 ring-white/60 scale-110' : 'scale-90 opacity-60'}`}
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
                <div className="flex items-center gap-1.5 bg-white/[0.02] border border-white/[0.04] p-0.5 rounded-lg text-xs font-bold text-muted-accessible" role="group" aria-label="Font size">
                  {(['sm', 'base', 'lg'] as const).map(sz => (
                    <button
                      key={sz}
                      onClick={() => setFontSize(sz)}
                      aria-label={`Font size ${sz}`}
                      aria-pressed={fontSize === sz}
                      className={`px-2.5 py-1 rounded transition-all capitalize ${
                        fontSize === sz ? 'bg-white/5 text-white shadow' : 'hover:text-slate-300'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>

                {/* Operations tools */}
                <div className="flex items-center gap-1.5" role="toolbar" aria-label="Notepad actions">
                  <button
                    onClick={copyNotepadToClipboard}
                    aria-label="Copy note text to clipboard"
                    className="btn-icon tap-target-compact"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={downloadNotepadText}
                    aria-label="Download scratch note as TXT file"
                    className="btn-icon tap-target-compact"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={clearNotepad}
                    aria-label="Clear all notepad text"
                    className="btn-icon btn-icon-danger tap-target-compact"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>

            {/* WIDGET 2: HIGH-FIDELITY POMODORO FOCUS TIMER */}
            <div className="glass-panel rounded-3xl p-6 flex flex-col gap-4 shadow-xl relative overflow-hidden premium-border-glow">
              
              {/* Radiant Inner Glow Deco */}
              <div className="absolute -bottom-10 -right-10 w-28 h-28 bg-[#7F00FF]/5 blur-3xl pointer-events-none" />

              {/* Timer Header */}
              <div className={`flex items-center justify-between border-b pb-3 z-10 ${isDark ? 'border-white/[0.04]' : 'border-slate-200/60'}`}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <h3 className={`text-sm sm:text-base font-black uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Focus Commander</h3>
                    <p className="text-xs font-semibold mt-0.5 text-muted-accessible">Pomodoro cycle interval</p>
                  </div>
                </div>

                {/* Sound alert switch */}
                <button
                  onClick={() => setAudioEnabled(!audioEnabled)}
                  aria-label={audioEnabled ? 'Mute timer sound cues' : 'Enable timer sound cues'}
                  aria-pressed={audioEnabled}
                  className={`p-2.5 rounded-lg border transition-all ${
                    audioEnabled 
                      ? 'bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20' 
                      : 'bg-white/[0.01] border-white/[0.05] text-slate-500'
                  }`}
                >
                  {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
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
                    <span className="text-xs font-black uppercase text-purple-400 tracking-wider mt-1 block">
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
                        className={`py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
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
                      aria-label={timerActive ? 'Pause focus timer' : 'Start focus timer'}
                      className={`flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-sm transition-all active:scale-95 cursor-pointer min-h-[48px] ${
                        timerActive 
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20' 
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg'
                      }`}
                    >
                      {timerActive ? (
                        <>
                          <Pause className="w-4 h-4" /> Pause Timer
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current" /> Start Focus
                        </>
                      )}
                    </button>

                    <button
                      onClick={resetTimer}
                      aria-label="Reset focus timer to start"
                      className={`p-3 rounded-xl border transition-all active:scale-90 cursor-pointer min-h-[48px] ${
                        isDark 
                          ? 'border-white/[0.04] bg-white/[0.01] text-slate-400 hover:text-white hover:bg-white/5' 
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Stats note */}
                  <div className="text-xs font-semibold text-muted-accessible flex items-center justify-center sm:justify-start gap-1.5" role="status" aria-live="polite">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
                    <span>Sessions completed: {completedPomodoros}</span>
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
            <div className="glass-panel rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-6 relative overflow-hidden premium-border-glow">
              
              {/* Dynamic decorative visual neon particle line overlay */}
              <div className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b from-[#00F2FE] via-[#7F00FF] to-[#FF007F]" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#00F2FE]/5 blur-3xl pointer-events-none" />

              <div className="space-y-2.5 z-10 flex-1">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-accessible">
                  <Award className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" /> Student Profile Standing
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

              {/* Dynamic Points Pod Counter & Streak Pod Counter */}
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto flex-shrink-0">
                <div className="w-full sm:w-32 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex sm:flex-col items-center justify-between sm:justify-center gap-2.5 z-10">
                  <div className="text-left sm:text-center">
                    <span className="text-xs font-black tracking-wider uppercase text-label-accessible block">Total points</span>
                    <span className={`text-2xl font-black tracking-tight mt-0.5 block ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      {stats.score + (isGuest ? 0 : (userProfile?.points || 0))} Pts
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-lg flex-shrink-0 animate-pulse">
                    <Trophy className="w-5 h-5" />
                  </div>
                </div>

                {!isGuest && user && (
                  <div className="w-full sm:w-32 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex sm:flex-col items-center justify-between sm:justify-center gap-2.5 z-10">
                    <div className="text-left sm:text-center">
                      <span className="text-xs font-black tracking-wider uppercase text-label-accessible block">Study Streak</span>
                      <span className="text-2xl font-black text-amber-500 tracking-tight mt-0.5 block">
                        {localStorage.getItem(`noteweb-study-streak-${user.uid}`) || '0'} Days
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-red-500 flex items-center justify-center text-white shadow-lg flex-shrink-0 animate-pulse text-xl">
                      🔥
                    </div>
                  </div>
                )}
              </div>


            </div>

            {/* WIDGET 4: CAMPUS AI STUDY ROADMAP & EXAM PLANNER (AI-POWERED NEW FEATURE) */}
            <div className="glass-panel rounded-3xl p-6 shadow-xl flex flex-col gap-5 relative overflow-hidden premium-border-glow">
              
              {/* Backlit background glow */}
              <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-tr from-purple-500/5 to-indigo-500/5 blur-3xl pointer-events-none" />

              {/* Header */}
              <div className={`flex items-center justify-between border-b pb-3.5 z-10 ${isDark ? 'border-white/[0.04]' : 'border-slate-200/60'}`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className={`text-sm sm:text-base font-black uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>AI Study Planner</h3>
                    <p className="text-xs font-semibold mt-0.5 text-muted-accessible">Enter a subject — get a custom Gemini roadmap</p>
                  </div>
                </div>

                <span className="text-xs font-black tracking-wider uppercase text-purple-500 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1.5 rounded-lg">
                  AI POWERED
                </span>
              </div>

              {/* Main Panel Content */}
              <div className="z-10">
                {!studyPlan ? (
                  /* ================= FORM MODE ================= */
                  <form onSubmit={handleGenerateStudyPlan} className="flex flex-col gap-4 text-left" aria-label="AI Study Planner form">
                    {/* Step indicator */}
                    <div className={`flex items-center gap-2.5 p-3 rounded-xl text-xs font-semibold ${isDark ? 'bg-purple-500/5 border border-purple-500/15 text-purple-300' : 'bg-purple-50 border border-purple-200 text-purple-700'}`}>
                      <span className="step-badge" aria-hidden="true">1</span>
                      <span>Choose your subject &amp; timeframe, then click <strong>Generate</strong> — it takes under 5 seconds.</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="label-xs text-muted-accessible" htmlFor="planner-subject">
                        What exam are you studying for?
                      </label>
                      <input
                        id="planner-subject"
                        type="text"
                        value={plannerSubj}
                        onChange={(e) => setPlannerSubj(e.target.value)}
                        placeholder="e.g. Data Structures, Linear Algebra, Basic Sciences..."
                        maxLength={50}
                        aria-required="true"
                        aria-describedby="planner-subject-hint"
                        className={`w-full px-4 py-3 min-h-[48px] rounded-2xl border text-sm font-medium leading-normal transition-all outline-none focus:scale-[1.01] ${
                          isDark 
                            ? 'bg-white/[0.01] border-white/[0.04] text-white placeholder-slate-500 focus:border-purple-500/40 focus:bg-[#08080E]' 
                            : 'bg-slate-50/80 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-purple-500/50 focus:bg-white'
                        }`}
                      />
                      <p id="planner-subject-hint" className="text-xs text-muted-accessible">Type any subject name or pick a tag below.</p>
                      {/* Quick Subject Tags */}
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {['Data Structures', 'Database Systems', 'Linear Algebra', 'Operating Systems', 'Computer Networks'].map((sub) => (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => setPlannerSubj(sub)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer tap-target-compact ${
                              plannerSubj === sub
                                ? 'bg-purple-600 text-white border-purple-600'
                                : isDark
                                  ? 'bg-white/[0.02] border-white/[0.06] text-slate-300 hover:bg-white/[0.05]'
                                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {sub}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quick Timeframe & Goal Presets */}
                    <div className="flex flex-col gap-1.5 mt-0.5">
                      <span className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-label-accessible' : 'text-slate-500'}`}>
                        Quick Presets
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: '🔥 1-Day Cram', time: '1 Day', goal: 'Pass Exam' },
                          { label: '🚀 3-Day Sprint', time: '3 Days', goal: 'Score A+' },
                          { label: '📖 1-Week Pace', time: '1 Week', goal: 'Score A+' }
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              setPlannerTime(preset.time);
                              setPlannerGoal(preset.goal);
                            }}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer tap-target-compact ${
                              plannerTime === preset.time && plannerGoal === preset.goal
                                ? 'bg-indigo-600 text-white border-indigo-650 dark:bg-indigo-600 dark:border-indigo-600'
                                : isDark
                                  ? 'bg-white/[0.02] border-white/[0.06] text-slate-300 hover:bg-white/[0.05]'
                                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      {/* Timeframe Selector */}
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="planner-timeframe" className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-label-accessible' : 'text-slate-500'}`}>
                          Custom Timeframe
                        </label>
                        <select
                          id="planner-timeframe"
                          value={plannerTime}
                          onChange={(e) => setPlannerTime(e.target.value)}
                          className={`w-full px-4 py-3 rounded-2xl border text-xs font-bold leading-normal transition-all outline-none cursor-pointer ${
                            isDark 
                              ? 'bg-[#0A0A0F] border-white/[0.04] text-white focus:border-purple-500/40' 
                              : 'bg-slate-50/80 border-slate-200 text-slate-700 focus:border-purple-500/50'
                          }`}
                        >
                          <option value="1 Day">1 Day (Cramming)</option>
                          <option value="3 Days">3 Days (Sprint)</option>
                          <option value="1 Week">1 Week (Paced)</option>
                          <option value="2 Weeks">2 Weeks (Deep Dive)</option>
                        </select>
                      </div>

                      {/* Goal Selector */}
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="planner-goal" className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-label-accessible' : 'text-slate-500'}`}>
                          Custom Goal
                        </label>
                        <select
                          id="planner-goal"
                          value={plannerGoal}
                          onChange={(e) => setPlannerGoal(e.target.value)}
                          className={`w-full px-4 py-3 rounded-2xl border text-xs font-bold leading-normal transition-all outline-none cursor-pointer ${
                            isDark 
                              ? 'bg-[#0A0A0F] border-white/[0.04] text-white focus:border-purple-500/40' 
                              : 'bg-slate-50/80 border-slate-200 text-slate-700 focus:border-purple-500/50'
                          }`}
                        >
                          <option value="Score A+">Aiming for top grade (A+)</option>
                          <option value="Pass Exam">Secure passing grade</option>
                          <option value="Quick Review">Just a quick syllabus recap</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={plannerLoading}
                      aria-disabled={plannerLoading}
                      className="cta-primary w-full"
                    >
                      {plannerLoading ? (
                        <span role="status" aria-live="polite" className="flex items-center gap-2">
                          <Clock className="w-4 h-4 animate-spin" aria-hidden="true" />
                          Generating roadmap…
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4" aria-hidden="true" />
                          Generate My Study Roadmap
                        </span>
                      )}
                    </button>
                  </form>
                ) : (
                  /* ================= STUDY PLAN ACTIVE MODE ================= */
                  <div className="flex flex-col gap-4 text-left">
                    
                    {/* Roadmap Summary Banner */}
                    <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
                      isDark 
                        ? 'bg-white/[0.01] border-white/[0.04]' 
                        : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="min-w-0">
                        <span className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-label-accessible' : 'text-slate-400'}`}>Active Study Roadmap</span>
                        <h4 className={`text-sm font-extrabold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{activePlanSubj}</h4>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-xs font-black text-purple-500 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md uppercase tracking-wide">
                          {plannerTime}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="flex items-center justify-between text-xs font-bold text-label-accessible mb-1.5">
                        <span>PLAN COMPLETION PROGRESS</span>
                        <span className="text-purple-400 font-black">
                          {Math.round(
                            (Object.values(completedTasks).filter(Boolean).length / (studyPlan.length * 3)) * 100
                          )}%
                        </span>
                      </div>
                      <div className={`h-2.5 rounded-full overflow-hidden w-full ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
                        <motion.div
                          className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500"
                          initial={{ width: 0 }}
                          animate={{ 
                            width: `${(Object.values(completedTasks).filter(Boolean).length / (studyPlan.length * 3)) * 100}%` 
                          }}
                          transition={{ duration: 0.4 }}
                        />
                      </div>
                    </div>

                    {/* Interactive Phases Timeline */}
                    <div className="flex flex-col gap-4 mt-1 relative pl-3.5 border-l border-purple-500/20">
                      {studyPlan.map((phase: any, phaseIdx: number) => (
                        <div key={phaseIdx} className="relative flex flex-col gap-2">
                          
                          {/* Circle timeline bullet */}
                          <span className={`absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full border-2 border-purple-500 ${
                            isDark ? 'bg-[#05050A]' : 'bg-white'
                          }`} />

                          {/* Phase Header */}
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <h5 className={`text-xs font-black tracking-wide ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                              {phase.title}
                            </h5>
                            <span className={`text-xs font-extrabold px-1.5 py-0.5 rounded ${
                              isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {phase.duration}
                            </span>
                          </div>

                          {/* Phase Task Checkboxes */}
                          <div className="flex flex-col gap-1.5 ml-0.5">
                            {phase.tasks.map((task: string, taskIdx: number) => {
                              const isChecked = !!completedTasks[`${phaseIdx}-${taskIdx}`];
                              return (
                                <div 
                                  key={taskIdx}
                                  onClick={() => handleToggleTask(phaseIdx, taskIdx)}
                                  className={`flex items-start gap-2.5 p-2 rounded-xl border transition-all duration-300 cursor-pointer ${
                                    isChecked 
                                      ? 'opacity-55 border-emerald-500/20 bg-emerald-500/[0.01]' 
                                      : (isDark 
                                          ? 'border-transparent bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/5' 
                                          : 'border-transparent bg-slate-50/50 hover:bg-slate-100 hover:border-slate-200'
                                        )
                                  }`}
                                >
                                  {/* Custom Checkbox circle */}
                                  <span className={`w-5 h-5 rounded-full flex-shrink-0 border flex items-center justify-center text-[9px] transition-all mt-0.5 ${
                                    isChecked 
                                      ? 'bg-emerald-500 border-emerald-500 text-white font-extrabold shadow-[0_0_8px_rgba(16,185,129,0.3)]' 
                                      : 'border-slate-400/50 hover:border-purple-500'
                                  }`}>
                                    {isChecked && "✔"}
                                  </span>
                                  <span className={`text-xs font-bold leading-snug transition-all ${
                                    isChecked 
                                      ? 'line-through text-slate-500' 
                                      : (isDark ? 'text-slate-300' : 'text-slate-700')
                                  }`}>
                                    {task}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                        </div>
                      ))}
                    </div>

                    {/* Bottom Reset action */}
                    <div className="flex items-center justify-between gap-4 mt-1.5 pt-3.5 border-t border-dashed border-slate-500/20">
                      <span className="text-xs font-semibold text-muted-accessible">
                        ✅ Each completed task awards +5 Study Points!
                      </span>
                      <button
                        onClick={handleClearStudyPlan}
                        aria-label="Clear active study plan"
                        className={`text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 min-h-[36px] px-2 ${
                          isDark ? 'text-slate-500 hover:text-rose-400' : 'text-slate-400 hover:text-rose-500'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Clear Plan
                      </button>
                    </div>

                  </div>
                )}
              </div>

            </div>

            {/* WIDGET 5: QUICK BRANCHES EXPLORER NAVIGATION PANEL */}
            <div className={`rounded-3xl border p-6 shadow-xl backdrop-blur-2xl flex flex-col gap-4 relative overflow-hidden premium-border-glow ${isDark ? 'border-white/5 bg-[#05050A]/60' : 'glass-panel border-white/60'}`}>
              
              <div className={`flex items-center justify-between border-b pb-3 z-10 ${isDark ? 'border-white/[0.04]' : 'border-slate-200/60'}`}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                    <BookMarked className="w-4 h-4 text-sky-400" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className={`text-sm sm:text-base font-black uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Curriculum Branches</h3>
                    <p className="text-xs font-semibold mt-0.5 text-muted-accessible">Browse notes by department</p>
                  </div>
                </div>

                <button
                  onClick={() => navigate('/categories')}
                  aria-label="View all curriculum branches"
                  className="inline-flex items-center gap-1 text-xs font-bold text-muted-accessible hover:text-white transition-colors min-h-[44px] px-2"
                >
                  View All <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>

              {/* Grid of branches */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 z-10">
                {branches.map((b) => {
                  let borderHoverCls = 'hover:border-indigo-300/50 hover:bg-indigo-500/5';
                  let badgeCls = 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20';
                  let textHoverCls = 'group-hover:text-indigo-500';

                  if (b.id === 'cse') {
                    borderHoverCls = 'hover:border-sky-300/50 hover:bg-[#00F2FE]/5';
                    badgeCls = 'text-sky-500 bg-sky-500/10 border-sky-500/20';
                    textHoverCls = 'group-hover:text-sky-500';
                  } else if (b.id === 'aiml') {
                    borderHoverCls = 'hover:border-purple-300/50 hover:bg-[#7F00FF]/5';
                    badgeCls = 'text-purple-500 bg-purple-500/10 border-purple-500/20';
                    textHoverCls = 'group-hover:text-purple-500';
                  } else if (b.id === 'ds') {
                    borderHoverCls = 'hover:border-rose-300/50 hover:bg-rose-500/5';
                    badgeCls = 'text-rose-500 bg-rose-500/10 border-rose-500/20';
                    textHoverCls = 'group-hover:text-rose-500';
                  } else if (b.id === 'ece') {
                    borderHoverCls = 'hover:border-emerald-300/50 hover:bg-[#00FF87]/5';
                    badgeCls = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
                    textHoverCls = 'group-hover:text-emerald-500';
                  } else if (b.id === 'mechanical') {
                    borderHoverCls = 'hover:border-amber-300/50 hover:bg-[#F35555]/5';
                    badgeCls = 'text-amber-500 bg-amber-500/10 border-amber-500/20';
                    textHoverCls = 'group-hover:text-amber-500';
                  } else if (b.id === 'civil') {
                    borderHoverCls = 'hover:border-orange-300/50 hover:bg-[#FF0844]/5';
                    badgeCls = 'text-orange-500 bg-orange-500/10 border-orange-500/20';
                    textHoverCls = 'group-hover:text-orange-500';
                  }

                  const shortDesc = b.description 
                    ? (b.description.split(',')[0] + ' & ' + (b.description.split(',')[1] || 'Syllabus')).slice(0, 32)
                    : 'Curriculum syllabus subjects';

                  return (
                    <div 
                      key={b.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate('/feed', { state: { branchFilter: b.id } })}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate('/feed', { state: { branchFilter: b.id } })}
                      aria-label={`Browse ${b.name} notes`}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer group active:scale-95 min-h-[80px] ${isDark ? 'bg-white/[0.01] border-white/[0.04] ' + borderHoverCls : 'bg-slate-50/80 border-slate-200/60 ' + borderHoverCls}`}
                    >
                      <span className={`text-xs font-black uppercase border px-1.5 py-0.5 rounded ${badgeCls}`}>
                        {b.notes_count || b.notesCount || b.id.toUpperCase()}
                      </span>
                      <h4 className={`text-xs font-extrabold mt-2 ${textHoverCls} ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {b.name}
                      </h4>
                      <span className={`text-xs font-medium mt-1 block text-muted-accessible`}>
                        {shortDesc}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Feed CTA panel */}
              <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 mt-2.5 pt-4 border-t z-10 ${isDark ? 'border-white/[0.04]' : 'border-slate-200/60'}`}>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-accessible">
                  <Smile className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
                  Library catalog: {stats.notesCount} verified uploads
                </span>
                <button
                  onClick={() => navigate('/feed')}
                  aria-label="Go to the full Notes Library feed"
                  className="cta-hero group"
                >
                  Go to Library <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                </button>
              </div>

            </div>

          </div>

        </div>

      </div>
      </div>
    </>
  );
};

export default Home;
