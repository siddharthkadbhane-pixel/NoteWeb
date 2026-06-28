import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { useLocation } from 'react-router-dom';

export const FloatingThemeToggle: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();

  if (location.pathname === '/chat') {
    return null;
  }

  return (
    <motion.button
      onClick={toggleTheme}
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={{ scale: 1.12, y: -2 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className={`
        fixed bottom-20 lg:bottom-6 right-6 z-[9999]
        w-12 h-12 rounded-full border flex items-center justify-center
        shadow-[0_12px_40px_rgba(0,0,0,0.45)] cursor-pointer backdrop-blur-xl
        transition-all duration-300 select-none
        ${isDark
          ? 'bg-[#070710]/85 border-white/[0.08] text-amber-400 hover:border-amber-400/40 hover:shadow-[0_12px_40px_rgba(251,191,36,0.15)]'
          : 'bg-white/90 border-slate-200 text-indigo-600 hover:border-indigo-500/40 hover:shadow-[0_12px_40px_rgba(99,102,241,0.15)]'
        }
      `}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      <motion.div
        key={isDark ? 'dark' : 'light'}
        initial={{ rotate: -90, scale: 0.8, opacity: 0 }}
        animate={{ rotate: 0, scale: 1, opacity: 1 }}
        exit={{ rotate: 90, scale: 0.8, opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        {isDark ? (
          <Sun className="w-5 h-5 text-amber-400" />
        ) : (
          <Moon className="w-5 h-5 text-indigo-600" />
        )}
      </motion.div>
    </motion.button>
  );
};

export default FloatingThemeToggle;
