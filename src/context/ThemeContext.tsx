import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default to 'dark' mode as standard premium, fallback to localStorage
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('noteweb-theme');
    if (saved === 'light') return 'light';
    return 'dark'; // Dark mode is default
  });

  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;

    if (theme === 'light') {
      body.classList.add('light-mode');
      body.classList.remove('dark');
      html.setAttribute('data-theme', 'light');
      // Force meta theme-color update on mobile browsers
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) metaThemeColor.setAttribute('content', '#F8F9FA');
      localStorage.setItem('noteweb-theme', 'light');
    } else {
      body.classList.remove('light-mode');
      body.classList.add('dark');
      html.setAttribute('data-theme', 'dark');
      html.removeAttribute('data-theme'); // Remove to let CSS defaults take over
      html.setAttribute('data-theme', 'dark');
      // Force meta theme-color update on mobile browsers
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) metaThemeColor.setAttribute('content', '#0A0A0C');
      localStorage.setItem('noteweb-theme', 'dark');
    }
  }, [theme]);

  // Re-apply theme on visibility change (handles mobile browser cache restoration)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const savedTheme = localStorage.getItem('noteweb-theme') as Theme || 'dark';
        const body = document.body;
        const html = document.documentElement;
        if (savedTheme === 'light') {
          body.classList.add('light-mode');
          body.classList.remove('dark');
          html.setAttribute('data-theme', 'light');
        } else {
          body.classList.remove('light-mode');
          body.classList.add('dark');
          html.setAttribute('data-theme', 'dark');
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
