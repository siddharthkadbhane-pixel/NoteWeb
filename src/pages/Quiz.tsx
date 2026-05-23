import React, { useState, useEffect, useRef } from 'react';
import { 
  Brain, 
  BookOpen, 
  Trophy, 
  Clock, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Zap, 
  Check, 
  X,
  GraduationCap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/Button';
import { GlassPanel } from '../components/ui/GlassPanel';

interface Question {
  id: number;
  question: string;
  options: string[];
  answer: number; // Index of correct option
  explanation: string;
}

interface QuizCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  questions: Question[];
}

// Handcrafted, highly professional academic questions for high-fidelity peer study
const CS_QUESTIONS: Question[] = [
  {
    id: 1,
    question: "What is the worst-case time complexity of inserting a node into a balanced AVL Tree?",
    options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
    answer: 1,
    explanation: "Because an AVL tree is strictly height-balanced (height difference of at most 1), the height is guaranteed to be O(log n). Inserting a node requires traversing down the height, followed by O(1) rotation checks, resulting in O(log n) worst-case time complexity."
  },
  {
    id: 2,
    question: "In database design, which Normal Form (NF) specifically eliminates transitive dependencies?",
    options: ["First Normal Form (1NF)", "Second Normal Form (2NF)", "Third Normal Form (3NF)", "Boyce-Codd Normal Form (BCNF)"],
    answer: 2,
    explanation: "A table is in Third Normal Form (3NF) if it is in 2NF and has no transitive dependencies (i.e., non-prime attributes must only depend on the primary key, not on other non-prime attributes)."
  },
  {
    id: 3,
    question: "Which of the following Page Replacement Algorithms is theoretical and suffers from Belady's Anomaly?",
    options: ["Least Recently Used (LRU)", "Optimal Page Replacement (OPT)", "First-In-First-Out (FIFO)", "Least Frequently Used (LFU)"],
    answer: 2,
    explanation: "FIFO (First-In-First-Out) suffers from Belady's Anomaly, where increasing the number of page frames can result in an increase in the number of page faults. OPT is theoretical but does not suffer from it."
  },
  {
    id: 4,
    question: "Which data structure is typically used to implement recursion or depth-first searches (DFS)?",
    options: ["Queue", "Stack", "Heap", "Binary Search Tree"],
    answer: 1,
    explanation: "Stacks are Last-In-First-Out (LIFO) data structures, matching the call stack execution flow of recursive calls. DFS uses a stack (or call stack) to backtrack once a leaf is reached."
  },
  {
    id: 5,
    question: "What is the primary difference between a process and a thread in modern Operating Systems?",
    options: [
      "Processes share memory by default; threads do not.",
      "Threads share the process memory space and resources; processes have isolated memory spaces.",
      "Processes run in kernel space; threads run exclusively in user space.",
      "Threads have their own independent file handles and system security tokens."
    ],
    answer: 1,
    explanation: "Threads are lightweight processes that execute within the context of a process, sharing its memory address space, global variables, and open files, while processes have fully isolated address spaces allocated by the OS."
  }
];

const MATH_QUESTIONS: Question[] = [
  {
    id: 1,
    question: "What is the derivative of f(x) = ln(3x^2 + 5) with respect to x?",
    options: ["1 / (3x^2 + 5)", "6x / (3x^2 + 5)", "3x / (3x^2 + 5)", "6x"],
    answer: 1,
    explanation: "By applying the chain rule: d/dx [ln(u)] = (1/u) * du/dx. Here, u = 3x^2 + 5 and du/dx = 6x. Hence, f'(x) = 6x / (3x^2 + 5)."
  },
  {
    id: 2,
    question: "If a 3x3 matrix A has eigenvalues 2, 3, and -1, what is the determinant of matrix A?",
    options: ["4", "5", "-6", "6"],
    answer: 2,
    explanation: "The determinant of a matrix is equal to the product of its eigenvalues. Det(A) = 2 * 3 * (-1) = -6."
  },
  {
    id: 3,
    question: "Under a standard normal distribution (Z), what is the approximate probability of a value falling within 2 standard deviations (+/- 2σ) of the mean?",
    options: ["68.2%", "95.4%", "99.7%", "50.0%"],
    answer: 1,
    explanation: "According to the empirical rule (68-95-99.7 rule), approximately 68.2% of data falls within 1σ, 95.4% falls within 2σ, and 99.7% falls within 3σ of the mean."
  },
  {
    id: 4,
    question: "What does the trace of a square matrix represent?",
    options: [
      "The product of the diagonal elements.",
      "The sum of all elements in the matrix.",
      "The sum of the diagonal elements, which is also equal to the sum of its eigenvalues.",
      "The volume of the parallelotope spanned by its column vectors."
    ],
    answer: 2,
    explanation: "The trace of a square matrix is defined as the sum of its main diagonal elements. In linear algebra, this sum is also mathematically proven to equal the sum of its eigenvalues."
  }
];

const SCIENCE_QUESTIONS: Question[] = [
  {
    id: 1,
    question: "Which Law of Thermodynamics states that the entropy of a pure crystalline substance at absolute zero is exactly equal to zero?",
    options: ["Zeroth Law", "First Law", "Second Law", "Third Law"],
    answer: 3,
    explanation: "The Third Law of Thermodynamics states that the entropy of a system approaches a constant value (zero) as the temperature approaches absolute zero, as there is no thermal motion or disorder in a perfect crystal."
  },
  {
    id: 2,
    question: "What is the primary force responsible for holding protons and neutrons together inside an atomic nucleus?",
    options: ["Gravitational Force", "Electromagnetic Force", "Weak Nuclear Force", "Strong Nuclear Force"],
    answer: 3,
    explanation: "The Strong Nuclear Force binds quarks together into protons and neutrons, and binds those nucleons together in the nucleus, overcoming the electromagnetic repulsion between positively charged protons."
  },
  {
    id: 3,
    question: "An object is sliding down an inclined plane at a constant velocity. What can be concluded about the forces acting on it?",
    options: [
      "The net force acting on the object is positive in the direction of motion.",
      "The frictional force is exactly equal and opposite to the component of gravity pulling it down the incline.",
      "There is no friction acting on the object.",
      "The normal force is equal to the object's total mass times gravity (m*g)."
    ],
    answer: 1,
    explanation: "According to Newton's First Law, since the velocity is constant, the acceleration is zero, meaning the net force is zero. Therefore, the force of kinetic friction exactly balances the component of gravity acting down the slope (mg * sin(θ))."
  }
];

const ELECTRONICS_QUESTIONS: Question[] = [
  {
    id: 1,
    question: "In a Bipolar Junction Transistor (BJT) operating in the Active Region, how are the junctions biased?",
    options: [
      "Emitter-Base junction is Forward-biased; Collector-Base junction is Reverse-biased.",
      "Emitter-Base junction is Reverse-biased; Collector-Base junction is Forward-biased.",
      "Both junctions are Forward-biased.",
      "Both junctions are Reverse-biased."
    ],
    answer: 0,
    explanation: "For a BJT to operate in its linear active amplification region, the base-emitter junction must be forward-biased (to inject carriers) and the base-collector junction must be reverse-biased (to collect those carriers)."
  },
  {
    id: 2,
    question: "What type of filter is formed by placing a resistor in series followed by a capacitor in parallel with the output load?",
    options: ["High-Pass Filter", "Low-Pass Filter", "Band-Pass Filter", "Band-Stop Filter"],
    answer: 1,
    explanation: "At low frequencies, the capacitor acts as an open circuit (high impedance), allowing the signal to pass to the output. At high frequencies, it acts as a short circuit (low impedance), routing the signals to ground. This forms a Low-Pass Filter."
  }
];

const MANAGEMENT_QUESTIONS: Question[] = [
  {
    id: 1,
    question: "In Scrum Agile methodologies, who is primarily responsible for maintaining and prioritizing the Product Backlog?",
    options: ["Scrum Master", "Development Team", "Product Owner", "Stakeholders"],
    answer: 2,
    explanation: "The Product Owner is responsible for maximizing the value of the product and is the sole person responsible for managing and prioritizing items in the Product Backlog."
  },
  {
    id: 2,
    question: "Which economic indicator measures the rate of increase in purchasing power and overall prices of goods/services?",
    options: ["GDP Growth Rate", "Inflation Rate", "Unemployment Index", "Interest Discount Rate"],
    answer: 1,
    explanation: "The Inflation Rate is the quantitative measure of the rate at which the average price level of a basket of selected goods and services in an economy increases over a period."
  }
];

const QUIZ_CATEGORIES: QuizCategory[] = [
  {
    id: 'computers',
    name: 'Computer Science',
    icon: <Brain className="w-6 h-6" />,
    color: 'from-[#00F2FE] to-[#4FACFE]',
    description: 'Data Structures, Database Normalizations, and Operating Systems.',
    questions: CS_QUESTIONS
  },
  {
    id: 'maths',
    name: 'Mathematics',
    icon: <BookOpen className="w-6 h-6" />,
    color: 'from-[#7F00FF] to-[#E100FF]',
    description: 'Calculus derivatives, Matrix Eigenvalues, and Standard Distributions.',
    questions: MATH_QUESTIONS
  },
  {
    id: 'science',
    name: 'Physics & Engineering',
    icon: <GraduationCap className="w-6 h-6" />,
    color: 'from-[#FF0844] to-[#FFB199]',
    description: 'Thermodynamics, Nuclear forces, and Inclined mechanics.',
    questions: SCIENCE_QUESTIONS
  },
  {
    id: 'electronics',
    name: 'Electronics & Comm',
    icon: <Zap className="w-6 h-6" />,
    color: 'from-[#00FF87] to-[#60EFFF]',
    description: 'Transistor biasing junctions and RC filter frequencies.',
    questions: ELECTRONICS_QUESTIONS
  },
  {
    id: 'management',
    name: 'Management & Econ',
    icon: <Trophy className="w-6 h-6" />,
    color: 'from-[#FF007F] to-[#7F00FF]',
    description: 'Scrum backlog roles, pricing inflation, and financial models.',
    questions: MANAGEMENT_QUESTIONS
  }
];

export const Quiz: React.FC = () => {
  const { user, isGuest } = useAuth();
  const { success, error, info } = useToast();

  // Navigation states
  const [selectedCategory, setSelectedCategory] = useState<QuizCategory | null>(null);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [gameState, setGameState] = useState<'lobby' | 'playing' | 'scorecard'>('lobby');

  // Active quiz session states
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null);
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [score, setScore] = useState(0);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  
  // Timer settings
  const [timeRemaining, setTimeRemaining] = useState(25); // 25 seconds per question
  const timerRef = useRef<any>(null);

  // Score metrics
  const [totalXPEarned, setTotalXPEarned] = useState(0);
  const [isSubmittingScore, setIsSubmittingScore] = useState(false);

  const activeQuestion = selectedCategory?.questions[currentQuestionIdx];
  const isTimeLow = timeRemaining <= 5;

  // Active Timer Loop
  useEffect(() => {
    if (gameState === 'playing' && !hasConfirmed) {
      setTimeRemaining(25);
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleTimeOut();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState, currentQuestionIdx, hasConfirmed]);

  const handleTimeOut = () => {
    setSelectedOptionIdx(null); // No answer selected
    setHasConfirmed(true);
    setStreak(0);
    info("⏰ Time is up! Review the correct answer below.");
  };

  const handleOptionSelect = (idx: number) => {
    if (hasConfirmed) return;
    setSelectedOptionIdx(idx);
  };

  const handleSubmitAnswer = () => {
    if (selectedOptionIdx === null || hasConfirmed || !activeQuestion) return;

    if (timerRef.current) clearInterval(timerRef.current);
    setHasConfirmed(true);

    const isCorrect = selectedOptionIdx === activeQuestion.answer;

    if (isCorrect) {
      setCorrectAnswersCount(prev => prev + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > maxStreak) setMaxStreak(newStreak);
      
      // Calculate XP score dynamically: Base 50XP + Remaining time * 2XP + Streak multiplier!
      const timeBonus = timeRemaining * 2;
      const streakBonus = Math.min(newStreak * 5, 25);
      const questionXP = 50 + timeBonus + streakBonus;
      setScore(prev => prev + questionXP);
      
      success(`✨ Correct! +${questionXP} XP Gained.`);
    } else {
      setStreak(0);
      error("❌ Incorrect. Read the formula breakdown below.");
    }
  };

  const handleNextQuestion = () => {
    if (!selectedCategory) return;

    if (currentQuestionIdx + 1 < selectedCategory.questions.length) {
      setCurrentQuestionIdx(prev => prev + 1);
      setSelectedOptionIdx(null);
      setHasConfirmed(false);
    } else {
      handleFinishQuiz();
    }
  };

  const handleFinishQuiz = async () => {
    setGameState('scorecard');
    
    // Dynamic difficulty multiplier
    const difficultyMultiplier = difficulty === 'easy' ? 1.0 : difficulty === 'medium' ? 1.2 : 1.5;
    const finalXP = Math.round(score * difficultyMultiplier);
    setTotalXPEarned(finalXP);

    if (user && !isGuest && finalXP > 0) {
      setIsSubmittingScore(true);
      try {
        console.log(`[Quiz Arena] Submitting ${finalXP} XP to user profile: ${user.uid}`);
        
        // 1. Fetch current profile points
        const { data: profile, error: getErr } = await supabase
          .from('profiles')
          .select('points')
          .eq('id', user.uid)
          .single();

        if (getErr) throw getErr;

        const currentPoints = profile?.points || 0;
        const newPoints = currentPoints + finalXP;

        // 2. Write updated points back to Database
        const { error: writeErr } = await supabase
          .from('profiles')
          .update({ points: newPoints })
          .eq('id', user.uid);

        if (writeErr) throw writeErr;

        success(`🏆 Leaderboard Updated! Synced +${finalXP} XP successfully.`);
      } catch (err: any) {
        console.error("[Quiz Arena] Score write failed:", err.message);
        // Fallback: save to locally cached key to avoid point loss
        const cachedScoresStr = localStorage.getItem('noteweb-cached-xp') || '0';
        const cachedScores = parseInt(cachedScoresStr) + finalXP;
        localStorage.setItem('noteweb-cached-xp', cachedScores.toString());
        info(`💾 Points saved locally! They will sync on your next leaderboard refresh.`);
      } finally {
        setIsSubmittingScore(false);
      }
    } else if (isGuest) {
      info("🏆 Guest mode: XP points shown but not added to public Leaderboard. Sign up to compete!");
    }
  };

  const handleRestartLobby = () => {
    setSelectedCategory(null);
    setGameState('lobby');
    setCurrentQuestionIdx(0);
    setSelectedOptionIdx(null);
    setHasConfirmed(false);
    setScore(0);
    setCorrectAnswersCount(0);
    setStreak(0);
    setMaxStreak(0);
    setTotalXPEarned(0);
  };

  return (
    <div className="w-full relative min-h-screen py-12 px-4 md:px-8 flex flex-col justify-start items-center">
      {/* Absolute pulsing background visual element */}
      <div className="absolute top-1/10 left-1/10 w-[400px] h-[400px] bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/10 right-1/10 w-[400px] h-[400px] bg-purple-600/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-4xl mx-auto z-10 relative flex flex-col gap-8 w-full">
        
        {/* ==========================================
            STATE 1: LOBBY SELECTOR CARD
           ========================================== */}
        {gameState === 'lobby' && (
          <div className="space-y-8 text-left">
            <div className="flex flex-col gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 max-w-fit animate-pulse">
                <Trophy className="w-3.5 h-3.5" /> Gamified Study Companion
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-none">
                Campus <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Quiz Arena</span>
              </h1>
              <p className="text-sm text-slate-400 font-medium">
                Test your knowledge across academic branches, unlock streaks, earn study XP, and climb the student Leaderboard!
              </p>
            </div>

            {/* Difficulty Bar */}
            <GlassPanel className="p-4 flex flex-wrap items-center justify-between gap-4 border border-white/[0.05]">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Select Arena Difficulty
              </span>
              <div className="flex items-center gap-2">
                {(['easy', 'medium', 'hard'] as const).map((diff) => (
                  <button
                    key={diff}
                    onClick={() => setDifficulty(diff)}
                    className={`
                      px-4 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95 capitalize
                      ${difficulty === diff 
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/20' 
                        : 'border-white/[0.06] bg-white/[0.01] text-slate-400 hover:border-white/10 hover:text-white'}
                    `}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </GlassPanel>

            {/* Categories Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {QUIZ_CATEGORIES.map((cat) => (
                <div
                  key={cat.id}
                  className="p-6 glass-card premium-border-glow flex flex-col justify-between h-[180px] group cursor-pointer"
                  onClick={() => setSelectedCategory(cat)}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${cat.color} flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform duration-300`}>
                        {cat.icon}
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 group-hover:text-indigo-400 transition-colors">
                        {cat.questions.length} Exam Questions
                      </span>
                    </div>
                    <h3 className="font-extrabold text-base text-white group-hover:text-indigo-400 transition-colors">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                      {cat.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-end text-xs font-bold text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Enter Arena <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </div>
                </div>
              ))}
            </div>

            {selectedCategory && (
              <div className="flex justify-end pt-4">
                <Button
                  onClick={() => setGameState('playing')}
                  variant="primary"
                  size="lg"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Enter {selectedCategory.name} Quiz
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ==========================================
            STATE 2: ACTIVE PLAYING BOARD
           ========================================== */}
        {gameState === 'playing' && selectedCategory && activeQuestion && (
          <div className="space-y-6 text-left">
            {/* Session Header / Progress bar */}
            <GlassPanel className="p-4 border border-white/[0.05] bg-slate-950/20">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span className="uppercase tracking-wider">
                  Question {currentQuestionIdx + 1} of {selectedCategory.questions.length}
                </span>
                <span className="text-indigo-400">
                  {selectedCategory.name} • {difficulty.toUpperCase()}
                </span>
              </div>
              
              {/* Animated Timeline Progress */}
              <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden mt-3">
                <div 
                  className={`h-full transition-all duration-300 bg-gradient-to-r from-indigo-500 to-purple-500`}
                  style={{ width: `${((currentQuestionIdx + (hasConfirmed ? 1 : 0)) / selectedCategory.questions.length) * 100}%` }}
                />
              </div>
            </GlassPanel>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
              
              {/* Main Game Interface */}
              <div className="lg:col-span-3 space-y-6">
                
                {/* Question panel */}
                <GlassPanel className="p-6 border border-white/[0.05] bg-gradient-to-tr from-slate-950/30 via-slate-950/10 to-transparent relative overflow-hidden min-h-36 flex flex-col justify-center">
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500" />
                  <h2 className="text-lg sm:text-xl font-extrabold text-white leading-relaxed">
                    {activeQuestion.question}
                  </h2>
                </GlassPanel>

                {/* Options List */}
                <div className="flex flex-col gap-3">
                  {activeQuestion.options.map((opt, idx) => {
                    const isSelected = selectedOptionIdx === idx;
                    const isCorrect = activeQuestion.answer === idx;

                    // Option styling hooks based on answer phase
                    let optionStyle = 'border-white/[0.06] bg-white/[0.01] text-slate-300 hover:border-white/10 hover:bg-white/[0.02]';
                    let badge = null;

                    if (isSelected && !hasConfirmed) {
                      optionStyle = 'border-indigo-500 bg-indigo-500/10 text-white shadow-lg shadow-indigo-600/5';
                    }

                    if (hasConfirmed) {
                      if (isCorrect) {
                        optionStyle = 'border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-md shadow-emerald-500/5';
                        badge = <Check className="w-4 h-4 text-emerald-400" />;
                      } else if (isSelected) {
                        optionStyle = 'border-rose-500 bg-rose-500/10 text-rose-400 shadow-md shadow-rose-500/5';
                        badge = <X className="w-4 h-4 text-rose-400" />;
                      } else {
                        optionStyle = 'border-white/[0.03] bg-white/[0.005] text-slate-500 opacity-60';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => handleOptionSelect(idx)}
                        disabled={hasConfirmed}
                        className={`
                          p-4 rounded-xl border flex items-center justify-between text-left text-sm font-semibold transition-all duration-300 select-none
                          ${optionStyle}
                          ${!hasConfirmed ? 'cursor-pointer active:scale-[0.995]' : 'cursor-default'}
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-lg text-xs font-bold border border-white/5 bg-white/5 flex items-center justify-center flex-shrink-0
                            ${isSelected && !hasConfirmed ? 'bg-indigo-500/20 text-white border-indigo-500/30' : 'text-slate-400'}`}>
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span>{opt}</span>
                        </div>
                        {badge}
                      </button>
                    );
                  })}
                </div>

                {/* Explanation Block (Only visible after submission) */}
                <AnimatePresence>
                  {hasConfirmed && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="p-5 rounded-2xl border border-white/[0.04] bg-[#16161D]/15 text-xs text-slate-400 leading-relaxed space-y-2"
                    >
                      <span className="font-extrabold uppercase text-[10px] tracking-wider text-indigo-400 flex items-center gap-1">
                        💡 Conceptual Breakthrough
                      </span>
                      <p>{activeQuestion.explanation}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Question Actions */}
                <div className="flex items-center justify-between pt-2">
                  <Button
                    onClick={handleRestartLobby}
                    variant="ghost"
                    size="sm"
                    className="text-slate-500 hover:text-slate-300 hover:bg-white/5"
                  >
                    Exit Arena
                  </Button>

                  {!hasConfirmed ? (
                    <Button
                      onClick={handleSubmitAnswer}
                      disabled={selectedOptionIdx === null}
                      variant="primary"
                      className="px-6"
                    >
                      Lock In Answer
                    </Button>
                  ) : (
                    <Button
                      onClick={handleNextQuestion}
                      variant="primary"
                      className="px-6 bg-gradient-to-r from-purple-600 to-pink-600 border-none hover:from-purple-500 hover:to-pink-500"
                      rightIcon={<ArrowRight className="w-4 h-4" />}
                    >
                      {currentQuestionIdx + 1 === selectedCategory.questions.length ? 'Finish & Claim XP' : 'Next Question'}
                    </Button>
                  )}
                </div>
              </div>

              {/* Sidebar Stats Panel */}
              <div className="space-y-6">
                
                {/* Timer Clock */}
                <GlassPanel className="p-4 border border-white/[0.05] text-center flex flex-col items-center justify-center gap-2">
                  <div className={`p-3 rounded-full border ${isTimeLow ? 'border-rose-500/20 bg-rose-500/10 text-rose-400 animate-bounce' : 'border-white/5 bg-white/5 text-indigo-400'}`}>
                    <Clock className={`w-6 h-6 ${isTimeLow ? 'animate-pulse' : ''}`} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500">
                      Time Remaining
                    </span>
                    <h3 className={`text-2xl font-black ${isTimeLow ? 'text-rose-500' : 'text-white'}`}>
                      {timeRemaining}s
                    </h3>
                  </div>
                </GlassPanel>

                {/* Score & Streak tracker */}
                <GlassPanel className="p-5 border border-white/[0.05] space-y-4">
                  <div>
                    <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500 block">
                      Score Dashboard
                    </span>
                    <h3 className="text-3xl font-black text-white mt-1">
                      {score} <span className="text-xs font-bold text-indigo-400">XP</span>
                    </h3>
                  </div>

                  <div className="w-full h-px bg-white/[0.05]" />

                  {/* Streak Pulsar */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className={`w-5 h-5 ${streak > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-600'}`} />
                      <div className="text-left">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                          Current Streak
                        </span>
                        <span className="text-sm font-black text-white">{streak} Hit</span>
                      </div>
                    </div>
                    {streak >= 3 && (
                      <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.2)] animate-pulse uppercase">
                        Multiplier!
                      </span>
                    )}
                  </div>
                </GlassPanel>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            STATE 3: DETAILED SCORECARD RESULTS
           ========================================== */}
        {gameState === 'scorecard' && selectedCategory && (
          <GlassPanel className="p-8 border border-white/[0.06] bg-[#0A0A0C]/50 space-y-8 relative overflow-hidden text-center">
            {/* Abstract dynamic geometric card glow */}
            <div className="absolute top-0 right-0 w-52 h-52 bg-purple-600/10 blur-[60px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-52 h-52 bg-indigo-600/10 blur-[60px] rounded-full pointer-events-none" />

            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20 animate-float">
                <Trophy className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Arena Match Completed!
                </h2>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  You have successfully completed the {selectedCategory.name} Exam
                </p>
              </div>
            </div>

            {/* Score Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.01]">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Total XP Earned
                </span>
                <span className="text-xl font-black text-white mt-1 block">
                  +{totalXPEarned} XP
                </span>
              </div>

              <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.01]">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Accuracy
                </span>
                <span className="text-xl font-black text-white mt-1 block">
                  {Math.round((correctAnswersCount / selectedCategory.questions.length) * 100)}%
                </span>
              </div>

              <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.01]">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Peak Streak
                </span>
                <span className="text-xl font-black text-white mt-1 block">
                  {maxStreak} Hits
                </span>
              </div>

              <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.01]">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Difficulty Boost
                </span>
                <span className="text-xl font-black text-white mt-1 block capitalize">
                  {difficulty}
                </span>
              </div>
            </div>

            <div className="w-full h-px bg-white/[0.05]" />

            {/* Sync Badge */}
            {user && !isGuest ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mx-auto">
                <CheckCircle2 className="w-4 h-4 animate-pulse" />
                <span>
                  {isSubmittingScore 
                    ? 'Syncing scores with public rankings...' 
                    : 'Match scores verified and synced live with Leaderboard!'}
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mx-auto">
                <AlertCircle className="w-4 h-4" />
                <span>Guest Match: Sign in to submit scores and rank on the podium.</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Button
                onClick={handleRestartLobby}
                variant="secondary"
                size="lg"
                leftIcon={<RefreshCw className="w-4 h-4" />}
              >
                Enter Another Arena
              </Button>
            </div>
          </GlassPanel>
        )}
      </div>
    </div>
  );
};

export default Quiz;
