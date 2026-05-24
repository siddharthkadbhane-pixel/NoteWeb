import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Code, 
  Binary, 
  Atom, 
  Compass, 
  Settings, 
  Cpu, 
  ArrowRight,
  TrendingUp,
  Plus,
  X,
  BookOpen,
  Sparkles,
  Grid,
  ChevronRight,
  Bookmark
} from 'lucide-react';
import { GlassPanel } from '../components/ui/GlassPanel';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase/config';
import { useToast } from '../context/ToastContext';

interface BranchType {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  shadowColor: string;
  notesCount: string; // Abbr code (e.g. CS, ME)
}

interface CategoryType {
  id: string;
  branchId: string;
  name: string;
  description: string;
}

const defaultBranches: BranchType[] = [
  {
    id: 'cse',
    name: 'Computer Science & Engineering (CSE)',
    description: 'Data Structures, Algorithms, Software Engineering, Web Dev, Databases, and operating systems.',
    icon: 'code',
    color: 'from-[#00F2FE] to-[#4FACFE]',
    shadowColor: 'rgba(0, 242, 254, 0.25)',
    notesCount: 'CSE'
  },
  {
    id: 'aiml',
    name: 'AI & Machine Learning (AI & ML)',
    description: 'Neural Networks, Deep Learning, Computer Vision, Natural Language Processing, and Robotics.',
    icon: 'sparkles',
    color: 'from-[#7F00FF] to-[#E100FF]',
    shadowColor: 'rgba(127, 0, 255, 0.25)',
    notesCount: 'AI&ML'
  },
  {
    id: 'ds',
    name: 'Data Science (DS)',
    description: 'Data Analytics, Statistical Learning, Big Data Processing, Predictive Modeling, and Visualization.',
    icon: 'binary',
    color: 'from-[#00FF87] to-[#60EFFF]',
    shadowColor: 'rgba(0, 255, 135, 0.25)',
    notesCount: 'DS'
  },
  {
    id: 'mechanical',
    name: 'Mechanical Engineering',
    description: 'Thermodynamics, Solid Mechanics, Fluid Dynamics, CAD Design, and Automobile Systems.',
    icon: 'settings',
    color: 'from-[#F35555] to-[#FEB47B]',
    shadowColor: 'rgba(243, 85, 85, 0.25)',
    notesCount: 'ME'
  },
  {
    id: 'civil',
    name: 'Civil Engineering',
    description: 'Structural Analysis, Geotechnical engineering, Surveying, and Environmental infrastructure.',
    icon: 'compass',
    color: 'from-[#FF0844] to-[#FFB199]',
    shadowColor: 'rgba(255, 8, 68, 0.25)',
    notesCount: 'CE'
  },
  {
    id: 'ece',
    name: 'Electronics & Communication (ECE)',
    description: 'Microprocessors, VLSI design, Signal processing, Communication systems, and analog hardware.',
    icon: 'cpu',
    color: 'from-[#00FF87] to-[#60EFFF]',
    shadowColor: 'rgba(0, 255, 135, 0.25)',
    notesCount: 'ECE'
  }
];


const defaultCategories: CategoryType[] = [
  // CS Branch Subjects
  { id: 'cse-dsa', branchId: 'cse', name: 'Data Structures & Algorithms', description: 'Arrays, Linked Lists, Stacks, Queues, Trees, Graphs, sorting and searching algorithms.' },
  { id: 'cse-dbms', branchId: 'cse', name: 'Database Management Systems', description: 'Relational databases, SQL queries, normalization, transactions, and indexing.' },
  { id: 'cse-os', branchId: 'cse', name: 'Operating Systems', description: 'Processes, threads, CPU scheduling, memory management, file systems, and concurrency.' },
  { id: 'cse-webdev', branchId: 'cse', name: 'Web Development', description: 'HTML, CSS, JavaScript, React, Node.js, REST APIs, and modern full-stack engineering.' },
  
  // AI & ML
  { id: 'aiml-ml', branchId: 'aiml', name: 'Artificial Intelligence & Machine Learning', description: 'Supervised/unsupervised learning, regression, classification, clustering, neural networks.' },
  
  // Data Science
  { id: 'ds-analytics', branchId: 'ds', name: 'Data Analytics', description: 'Exploratory data analysis, statistical tests, data wrangling, and descriptive metrics.' },
  
  // Electronics Branch Subjects
  { id: 'ece-microprocessors', branchId: 'ece', name: 'Microprocessors & Embedded Systems', description: '8085/8086 architectures, assembly programming, interfacing, and microcontrollers like Arduino.' },
  { id: 'ece-digital', branchId: 'ece', name: 'Digital Electronics', description: 'Number systems, logic gates, Boolean algebra, combinational and sequential logic circuits.' },
  { id: 'ece-signals', branchId: 'ece', name: 'Signals & Systems', description: 'Signals & Systems, continuous & discrete time signals, Fourier transform, Laplace transform.' },
  
  // Mechanical Branch Subjects
  { id: 'mechanical-thermo', branchId: 'mechanical', name: 'Thermodynamics', description: 'Laws of thermodynamics, heat engines, entropy, pure substances, and power cycles.' },
  { id: 'mechanical-fluid', branchId: 'mechanical', name: 'Fluid Mechanics', description: 'Fluid properties, pressure, flow kinematics, Bernoulli equation, and dimensional analysis.' },

  // Civil Branch Subjects
  { id: 'civil-structures', branchId: 'civil', name: 'Structural Analysis', description: 'Trusses, beams, columns, bending moments, shear forces, and stress analysis.' }
];

const gradientPresets = [
  { id: 'from-blue-500 to-indigo-500', name: 'Indigo Dream', shadowColor: 'rgba(59, 130, 246, 0.3)' },
  { id: 'from-purple-500 to-pink-500', name: 'Orchid Pink', shadowColor: 'rgba(168, 85, 247, 0.3)' },
  { id: 'from-amber-500 to-orange-500', name: 'Warm Amber', shadowColor: 'rgba(245, 158, 11, 0.3)' },
  { id: 'from-emerald-500 to-teal-500', name: 'Teal Mint', shadowColor: 'rgba(16, 185, 129, 0.3)' },
  { id: 'from-rose-500 to-pink-500', name: 'Rose Sunset', shadowColor: 'rgba(244, 63, 94, 0.3)' },
  { id: 'from-cyan-500 to-blue-500', name: 'Cyber Cyan', shadowColor: 'rgba(6, 182, 212, 0.3)' },
  { id: 'from-fuchsia-500 to-purple-500', name: 'Vibrant Purple', shadowColor: 'rgba(217, 70, 239, 0.3)' },
  { id: 'from-lime-500 to-emerald-500', name: 'Lime Fusion', shadowColor: 'rgba(132, 204, 22, 0.3)' }
];

const iconPresets = [
  { id: 'code', label: 'Programming', icon: <Code className="w-5 h-5" /> },
  { id: 'binary', label: 'Mathematics', icon: <Binary className="w-5 h-5" /> },
  { id: 'atom', label: 'Applied Science', icon: <Atom className="w-5 h-5" /> },
  { id: 'cpu', label: 'Electronics', icon: <Cpu className="w-5 h-5" /> },
  { id: 'settings', label: 'Engineering', icon: <Settings className="w-5 h-5" /> },
  { id: 'compass', label: 'Management', icon: <Compass className="w-5 h-5" /> },
  { id: 'sparkles', label: 'Special', icon: <Sparkles className="w-5 h-5" /> },
  { id: 'book-open', label: 'General', icon: <BookOpen className="w-5 h-5" /> }
];

export const Categories: React.FC = () => {
  const navigate = useNavigate();
  const { success, error } = useToast();

  const [branches, setBranches] = useState<BranchType[]>([]);
  const [categories, setCategories] = useState<CategoryType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Drawer & Modal states
  const [selectedBranch, setSelectedBranch] = useState<BranchType | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creatorMode, setCreatorMode] = useState<'branch' | 'category'>('category');

  // Form states for Branch
  const [newBranchTitle, setNewBranchTitle] = useState('');
  const [newBranchDescription, setNewBranchDescription] = useState('');
  const [newBranchBadge, setNewBranchBadge] = useState('');
  const [selectedGradient, setSelectedGradient] = useState(gradientPresets[0].id);
  const [selectedIcon, setSelectedIcon] = useState('book-open');

  // Form states for Category (Subject)
  const [selectedParentBranchId, setSelectedParentBranchId] = useState('');
  const [newCategoryTitle, setNewCategoryTitle] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const dbToBranch = (row: any): BranchType => {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      icon: row.icon,
      color: row.color,
      shadowColor: row.shadow_color || row.shadowColor || '',
      notesCount: row.notes_count || row.notesCount || ''
    };
  };

  const branchToDb = (b: BranchType): any => {
    return {
      id: b.id,
      name: b.name,
      description: b.description,
      icon: b.icon,
      color: b.color,
      shadow_color: b.shadowColor,
      notes_count: b.notesCount
    };
  };

  const dbToCategory = (row: any): CategoryType => {
    return {
      id: row.id,
      branchId: row.branch_id || row.branchId || '',
      name: row.name,
      description: row.description
    };
  };

  const categoryToDb = (c: CategoryType): any => {
    return {
      id: c.id,
      branch_id: c.branchId,
      name: c.name,
      description: c.description
    };
  };

  const fetchBranchesAndCategories = async () => {
    setIsLoading(true);
    try {
      const { data: branchesData, error: branchesErr } = await supabase.from('branches').select('*');
      const { data: categoriesData, error: categoriesErr } = await supabase.from('categories').select('*');

      if (branchesErr) throw branchesErr;
      if (categoriesErr) throw categoriesErr;

      let loadedBranches: BranchType[] = (branchesData || []).map(dbToBranch);
      let loadedCategories: CategoryType[] = (categoriesData || []).map(dbToCategory);

      // Seed / load branches
      if (loadedBranches.length === 0) {
        for (const branch of defaultBranches) {
          const dbVal = branchToDb(branch);
          await supabase.from('branches').insert([dbVal]);
          loadedBranches.push(branch);
        }
      } else {
        // Automatically align existing branches with new department names and badges
        for (const branch of defaultBranches) {
          const dbVal = branchToDb(branch);
          await supabase.from('branches').update({
            name: dbVal.name,
            description: dbVal.description,
            icon: dbVal.icon,
            color: dbVal.color,
            shadow_color: dbVal.shadow_color,
            notes_count: dbVal.notes_count
          }).eq('id', dbVal.id);
        }
        // Re-retrieve to ensure local state has updated data
        const { data: updatedBranchesData } = await supabase.from('branches').select('*');
        if (updatedBranchesData && updatedBranchesData.length > 0) {
          loadedBranches = updatedBranchesData.map(dbToBranch);
        }
      }

      // Seed / load categories (subjects)
      if (loadedCategories.length === 0) {
        for (const cat of defaultCategories) {
          const dbVal = categoryToDb(cat);
          await supabase.from('categories').insert([dbVal]);
          loadedCategories.push(cat);
        }
      }

      // Sort branches by standard order
      const coreOrder = ['cse', 'aiml', 'ds', 'ece', 'mechanical', 'civil'];
      loadedBranches.sort((a, b) => {
        const indexA = coreOrder.indexOf(a.id);
        const indexB = coreOrder.indexOf(b.id);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.name.localeCompare(b.name);
      });

      setBranches(loadedBranches);
      setCategories(loadedCategories);

      if (loadedBranches.length > 0) {
        setSelectedParentBranchId(loadedBranches[0].id);
      }
    } catch (e: any) {
      console.error("Error fetching branches & categories:", e);
      setBranches(defaultBranches);
      setCategories(defaultCategories);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBranchesAndCategories();
  }, []);

  const handleSubjectClick = (catId: string, branchId: string) => {
    navigate(`/feed`, { state: { category: catId, branch: branchId } });
  };

  const getBranchIcon = (iconName: string) => {
    switch (iconName?.toLowerCase()) {
      case 'code': return <Code className="w-6 h-6" />;
      case 'binary': return <Binary className="w-6 h-6" />;
      case 'atom': return <Atom className="w-6 h-6" />;
      case 'cpu': return <Cpu className="w-6 h-6" />;
      case 'settings': return <Settings className="w-6 h-6" />;
      case 'compass': return <Compass className="w-6 h-6" />;
      case 'sparkles': return <Sparkles className="w-6 h-6 animate-pulse text-yellow-300" />;
      default: return <BookOpen className="w-6 h-6" />;
    }
  };

  // Branch creation submit
  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchTitle.trim()) {
      error("Please enter a branch title.");
      return;
    }
    if (!newBranchBadge.trim()) {
      error("Specify a brief abbreviation (e.g. CS, ME).");
      return;
    }

    setIsSubmitting(true);
    const slug = newBranchTitle.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    if (!slug) {
      error("Invalid branch title.");
      setIsSubmitting(false);
      return;
    }

    if (branches.some(b => b.id === slug)) {
      error(`A curriculum branch with ID "${slug}" already exists!`);
      setIsSubmitting(false);
      return;
    }

    const matchedPreset = gradientPresets.find(p => p.id === selectedGradient);
    const shadowColor = matchedPreset ? matchedPreset.shadowColor : 'rgba(99, 102, 241, 0.3)';

    const newBranch: BranchType = {
      id: slug,
      name: newBranchTitle.trim(),
      description: newBranchDescription.trim() || 'Custom department branch covering technical syllabus.',
      icon: selectedIcon,
      color: selectedGradient,
      shadowColor: shadowColor,
      notesCount: newBranchBadge.toUpperCase().slice(0, 6)
    };

    try {
      const dbVal = branchToDb(newBranch);
      const { error: insertErr } = await supabase.from('branches').insert([dbVal]);
      if (insertErr) throw insertErr;

      success(`Successfully created academic branch: "${newBranch.name}"!`);
      setIsModalOpen(false);

      // Reset
      setNewBranchTitle('');
      setNewBranchDescription('');
      setNewBranchBadge('');
      setSelectedGradient(gradientPresets[0].id);
      setSelectedIcon('book-open');

      fetchBranchesAndCategories();
    } catch (err: any) {
      console.error(err);
      error("Failed to save branch: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Category creation submit
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryTitle.trim()) {
      error("Subject name is required.");
      return;
    }
    if (!selectedParentBranchId) {
      error("Please select a parent curriculum branch.");
      return;
    }

    setIsSubmitting(true);
    const slug = `${selectedParentBranchId}-${newCategoryTitle.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')}`;

    if (categories.some(c => c.id === slug)) {
      error(`A subject named "${newCategoryTitle}" already exists under this branch!`);
      setIsSubmitting(false);
      return;
    }

    const newCat: CategoryType = {
      id: slug,
      branchId: selectedParentBranchId,
      name: newCategoryTitle.trim(),
      description: newCategoryDescription.trim() || 'Curriculum syllabus subject containing student note files.'
    };

    try {
      const dbVal = categoryToDb(newCat);
      const { error: insertErr } = await supabase.from('categories').insert([dbVal]);
      if (insertErr) throw insertErr;

      success(`Successfully registered subject "${newCat.name}" under branch!`);
      
      // Update selected branch drawer view if active
      if (selectedBranch && selectedBranch.id === selectedParentBranchId) {
        setSelectedBranch(null); // Force close to refresh or let them open again
      }

      setIsModalOpen(false);

      // Reset
      setNewCategoryTitle('');
      setNewCategoryDescription('');

      fetchBranchesAndCategories();
    } catch (err: any) {
      console.error(err);
      error("Failed to save subject: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.06 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } }
  };

  return (
    <div className="min-h-screen w-full py-12 px-4 md:px-8 relative overflow-hidden">
      {/* Accent glows */}
      <div className="absolute top-1/3 left-1/3 w-96 h-96 glow-indigo rounded-full pointer-events-none blur-3xl opacity-30" />
      <div className="absolute bottom-1/3 right-1/3 w-96 h-96 glow-pink rounded-full pointer-events-none blur-3xl opacity-30" />

      <div className="max-w-6xl mx-auto z-10 relative">
        {/* Title Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/[0.05] pb-6 mb-12">
          <div className="text-left">
            <h1 className="text-4xl font-extrabold tracking-tight text-white light-mode:text-slate-900 mb-2">
              Academic Departments
            </h1>
            <p className="text-slate-400 light-mode:text-slate-500 font-medium text-sm">
              Explore syllabus folders. Click any academic department to access subject-specific lecture notes and summaries.
            </p>
          </div>
          
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 text-white font-extrabold text-sm self-start md:self-auto shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" /> Create Category / Department
          </button>
        </div>

        {/* Loader State */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <GlassPanel key={i} className="h-[240px] flex flex-col justify-between p-6">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-900/50 animate-pulse" />
                  <div className="h-6 w-32 bg-slate-900/50 rounded animate-pulse" />
                  <div className="h-10 w-full bg-slate-900/50 rounded animate-pulse" />
                </div>
                <div className="h-6 w-24 bg-slate-900/50 rounded animate-pulse mt-4" />
              </GlassPanel>
            ))}
          </div>
        ) : (
          /* Branches Grid */
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {branches.map((branch) => {
              const subjectsCount = categories.filter(c => c.branchId === branch.id).length;
              return (
                <motion.div
                  key={branch.id}
                  variants={itemVariants}
                  onClick={() => setSelectedBranch(branch)}
                  className="group cursor-pointer text-left glass-card premium-border-glow hover:scale-[1.02] hover:shadow-2xl duration-300 flex flex-col justify-between p-6 relative h-[240px] overflow-hidden"
                  style={{
                    boxShadow: `0 4px 30px ${branch.shadowColor || 'rgba(0,0,0,0.2)'}`
                  }}
                >
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-transparent via-transparent to-white/[0.02] pointer-events-none" />
                  
                  <div className="space-y-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${branch.color} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      {getBranchIcon(branch.icon)}
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-bold text-white light-mode:text-slate-950 group-hover:text-indigo-400 transition-colors duration-300">
                        {branch.name}
                      </h3>
                      <p className="text-xs text-slate-400 light-mode:text-slate-500 mt-2 leading-relaxed line-clamp-3">
                        {branch.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.05]">
                    <span className="text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 light-mode:bg-indigo-50/50">
                      {branch.notesCount} • {subjectsCount} {subjectsCount === 1 ? 'SUBJECT' : 'SUBJECTS'}
                    </span>
                    
                    <span className="text-indigo-400 font-semibold text-xs flex items-center gap-1 group-hover:translate-x-1 transition-transform duration-300">
                      View Subjects <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Footer Banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-12 text-left"
        >
          <GlassPanel className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-indigo-500/20 bg-indigo-500/5 light-mode:border-indigo-500/10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-white light-mode:text-slate-900">Missing your department or subject?</h4>
                <p className="text-xs text-slate-500 max-w-lg mt-0.5 leading-relaxed">
                  NoteWeb operates dynamically. Create a custom category branch or register subjects under existing departments to keep folders comprehensive!
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-5 py-2.5 rounded-xl font-bold bg-indigo-600 text-white text-xs hover:brightness-110 shadow-lg shadow-indigo-600/20 flex items-center gap-2 self-start md:self-auto active:scale-95 transition-transform"
            >
              Add Dynamic Folder <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </GlassPanel>
        </motion.div>
      </div>

      {/* SLAIDING SUBJECT DRAWER (AnimatePresence) */}
      <AnimatePresence>
        {selectedBranch && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedBranch(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Sliding Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full max-w-lg h-full bg-[#0D0D10]/95 border-l border-white/[0.08] light-mode:bg-white light-mode:border-slate-200 shadow-2xl p-6 md:p-8 flex flex-col justify-between overflow-y-auto text-left z-10"
            >
              <div>
                {/* Close Button */}
                <button
                  onClick={() => setSelectedBranch(null)}
                  className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 light-mode:hover:bg-slate-900/5 transition-all active:scale-90"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Branch Hero Info inside panel */}
                <div className="flex items-start gap-4 mb-8 pr-8">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${selectedBranch.color} flex items-center justify-center text-white shadow-lg flex-shrink-0`}>
                    {getBranchIcon(selectedBranch.icon)}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white light-mode:text-slate-900 tracking-tight leading-tight mb-1.5">
                      {selectedBranch.name}
                    </h3>
                    <p className="text-[10px] font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 inline-block uppercase">
                      Syllabus Catalog Folder
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-400 light-mode:text-slate-500 leading-relaxed mb-6 bg-white/[0.01] border border-white/[0.05] p-3 rounded-xl light-mode:bg-slate-50">
                  {selectedBranch.description}
                </p>

                {/* Subjects Header */}
                <h4 className="text-xs font-black uppercase text-slate-300 light-mode:text-slate-600 tracking-wider pl-1 mb-4 flex items-center gap-2">
                  <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
                  Curriculum Subjects ({categories.filter(c => c.branchId === selectedBranch.id).length})
                </h4>

                {/* Subject Cards Stack */}
                <div className="space-y-3.5 max-h-[50vh] overflow-y-auto pr-1">
                  {categories.filter(c => c.branchId === selectedBranch.id).length === 0 ? (
                    <div className="text-center py-10 rounded-2xl border border-dashed border-white/5 bg-white/[0.01] p-6">
                      <BookOpen className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                      <p className="text-xs font-semibold text-slate-400">No subjects registered yet</p>
                      <button
                        onClick={() => {
                          setSelectedParentBranchId(selectedBranch.id);
                          setCreatorMode('category');
                          setIsModalOpen(true);
                        }}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-bold mt-2 inline-flex items-center gap-1"
                      >
                        Add First Subject <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    categories.filter(c => c.branchId === selectedBranch.id).map((sub) => (
                      <motion.div
                        key={sub.id}
                        whileHover={{ scale: 1.01, x: 2 }}
                        onClick={() => handleSubjectClick(sub.id, selectedBranch.id)}
                        className="group flex items-center justify-between p-4 rounded-xl border border-white/[0.05] bg-[#141419]/50 hover:bg-[#1a1a24] hover:border-indigo-500/30 cursor-pointer transition-all duration-300 light-mode:bg-slate-50 light-mode:border-slate-200 light-mode:hover:bg-slate-100"
                      >
                        <div className="text-left pr-4 min-w-0">
                          <h5 className="text-sm font-extrabold text-white light-mode:text-slate-800 group-hover:text-indigo-400 transition-colors leading-tight">
                            {sub.name}
                          </h5>
                          <p className="text-[11px] text-slate-400 light-mode:text-slate-500 mt-1.5 leading-relaxed line-clamp-2">
                            {sub.description}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                      </motion.div>
                    ))
                  )}
                </div>
              </div>

              {/* Drawer footer action */}
              <div className="mt-8 pt-4 border-t border-white/[0.06] light-mode:border-slate-200 flex flex-col gap-3">
                <button
                  onClick={() => {
                    setSelectedParentBranchId(selectedBranch.id);
                    setCreatorMode('category');
                    setIsModalOpen(true);
                  }}
                  className="w-full h-11 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 hover:text-indigo-300 flex items-center justify-center font-bold text-xs gap-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Subject Category to this Branch
                </button>
                <button
                  onClick={() => navigate('/upload')}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 text-white flex items-center justify-center font-bold text-xs gap-1.5 shadow-lg shadow-indigo-600/10 active:scale-[0.98] transition-all"
                >
                  Upload Notes under {selectedBranch.name}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DUAL ACTION CREATION MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-md"
            />

            {/* Premium glass modal body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto z-10 glass-panel border border-white/10 p-6 md:p-8 bg-[#111116]/95 rounded-3xl text-left"
            >
              {/* Close Button */}
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 active:scale-90 transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Toggle Mode Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl mb-6">
                <button
                  type="button"
                  onClick={() => setCreatorMode('category')}
                  className={`
                    flex-1 py-2 rounded-lg text-xs font-bold transition-all
                    ${creatorMode === 'category' 
                      ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10' 
                      : 'text-slate-400 hover:text-slate-200'}
                  `}
                >
                  Create Subject Category
                </button>
                <button
                  type="button"
                  onClick={() => setCreatorMode('branch')}
                  className={`
                    flex-1 py-2 rounded-lg text-xs font-bold transition-all
                    ${creatorMode === 'branch' 
                      ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10' 
                      : 'text-slate-400 hover:text-slate-200'}
                  `}
                >
                  Create Academic Department
                </button>
              </div>

              {creatorMode === 'branch' ? (
                /* CREATE BRANCH FORM */
                <form onSubmit={handleCreateBranch} className="space-y-5">
                  <div className="flex items-center gap-2.5 mb-2 pl-1">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                      <Grid className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-white text-sm">Create Academic Department</h4>
                      <p className="text-[10px] text-slate-500">Register new high-level college divisions.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-1">
                        Department Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Artificial Intelligence & Machine Learning"
                        value={newBranchTitle}
                        onChange={(e) => setNewBranchTitle(e.target.value)}
                        required
                        className="w-full py-2.5 px-4 glass-input text-sm bg-slate-950/80 text-white rounded-xl focus:border-indigo-500 focus:outline-none transition-colors border border-white/[0.08]"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-1">
                        Code Badge
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. AI&ML"
                        value={newBranchBadge}
                        onChange={(e) => setNewBranchBadge(e.target.value)}
                        maxLength={6}
                        required
                        className="w-full py-2.5 px-4 glass-input text-sm bg-[#0A0A0F] text-white rounded-xl focus:border-indigo-500 focus:outline-none transition-colors border border-white/[0.08] uppercase"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-1">
                      Department Description
                    </label>
                    <textarea
                      placeholder="Outline topics covered under this academic department..."
                      value={newBranchDescription}
                      onChange={(e) => setNewBranchDescription(e.target.value)}
                      rows={3}
                      className="w-full py-2.5 px-4 glass-input text-sm bg-slate-950/80 text-white rounded-xl focus:border-indigo-500 focus:outline-none transition-colors border border-white/[0.08] resize-none"
                    />
                  </div>

                  {/* Preset Icon Selector */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-1">
                      Select Department Icon
                    </span>
                    <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                      {iconPresets.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedIcon(item.id)}
                          className={`
                            aspect-square flex items-center justify-center rounded-xl border transition-all active:scale-90
                            ${selectedIcon === item.id 
                              ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400 shadow shadow-indigo-600/10' 
                              : 'border-white/[0.08] bg-white/[0.01] text-slate-400 hover:border-white/20 hover:text-slate-200'}
                          `}
                        >
                          {item.icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preset Gradients Selector */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-1">
                      Select Card Gradient
                    </span>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {gradientPresets.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setSelectedGradient(preset.id)}
                          className={`
                            p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold text-white transition-all active:scale-95
                            ${selectedGradient === preset.id 
                              ? 'border-white/60 bg-white/10 shadow scale-[1.01]' 
                              : 'border-white/[0.08] bg-white/[0.01] hover:border-white/20'}
                          `}
                        >
                          <div className={`w-3.5 h-3.5 rounded-full bg-gradient-to-tr ${preset.id} shadow`} />
                          <span className="text-[10px] truncate max-w-[70px] font-semibold">{preset.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-white/[0.05]">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      disabled={isSubmitting}
                      className="px-5 py-2 rounded-xl font-bold bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/10 text-xs transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:brightness-110 text-xs transition-transform active:scale-95"
                    >
                      {isSubmitting ? 'Saving...' : 'Register Department'}
                    </button>
                  </div>
                </form>
              ) : (
                /* CREATE CATEGORY (SUBJECT) FORM */
                <form onSubmit={handleCreateCategory} className="space-y-5">
                  <div className="flex items-center gap-2.5 mb-2 pl-1">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                      <Bookmark className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-white text-sm">Add Subject Category</h4>
                      <p className="text-[10px] text-slate-500">Insert curriculum syllabus folders under existing departments.</p>
                    </div>
                  </div>

                  {/* Parent Department selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-1">
                      Parent Department
                    </label>
                    <select
                      value={selectedParentBranchId}
                      onChange={(e) => setSelectedParentBranchId(e.target.value)}
                      className="w-full py-2.5 px-4 glass-input text-sm bg-[#0A0A0F] text-white rounded-xl focus:border-indigo-500 focus:outline-none transition-colors border border-white/[0.08]"
                    >
                      {branches.map(b => (
                        <option key={b.id} value={b.id} className="bg-[#111116] text-white">
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Subject Name */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-1">
                      Subject Title
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Data Communication Networks"
                      value={newCategoryTitle}
                      onChange={(e) => setNewCategoryTitle(e.target.value)}
                      required
                      className="w-full py-2.5 px-4 glass-input text-sm bg-slate-950/80 text-white rounded-xl focus:border-indigo-500 focus:outline-none transition-colors border border-white/[0.08]"
                    />
                  </div>

                  {/* Subject Description */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-1">
                      Subject Overview / Topics
                    </label>
                    <textarea
                      placeholder="List primary chapters or curriculum syllabus covered by these notes..."
                      value={newCategoryDescription}
                      onChange={(e) => setNewCategoryDescription(e.target.value)}
                      rows={3}
                      className="w-full py-2.5 px-4 glass-input text-sm bg-slate-950/80 text-white rounded-xl focus:border-indigo-500 focus:outline-none transition-colors border border-white/[0.08] resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-white/[0.05]">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      disabled={isSubmitting}
                      className="px-5 py-2 rounded-xl font-bold bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/10 text-xs transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:brightness-110 text-xs transition-transform active:scale-95"
                    >
                      {isSubmitting ? 'Saving...' : 'Add Subject Category'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Categories;
