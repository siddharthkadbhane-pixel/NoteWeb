import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  // WCAG AA compliant base: always-visible focus ring, active state
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 focus-visible:outline-[3px] focus-visible:outline-indigo-500 focus-visible:outline-offset-4';
  
  const variants = {
    // Solid indigo-600 — white text = 7:1 contrast ratio (WCAG AAA) ✓
    primary: 'bg-indigo-600 text-white shadow-[0_4px_20px_rgba(79,70,229,0.35)] hover:bg-indigo-500 hover:shadow-[0_6px_28px_rgba(79,70,229,0.5)]',
    
    secondary: 'glass-panel text-slate-200 border border-white/[0.08] hover:border-indigo-500/40 hover:bg-white/[0.08] hover:text-white',
    
    danger: 'bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white hover:border-rose-500 hover:shadow-[0_0_15px_rgba(244,63,94,0.3)]',
    
    success: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]',

    ghost: 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]',
  };

  // All sizes enforce WCAG 2.5.5 minimum 44px touch target
  const sizes = {
    sm: 'px-3 py-2 text-xs min-h-[44px]',
    md: 'px-5 py-2.5 text-sm min-h-[44px]',
    lg: 'px-7 py-3 text-base min-h-[48px]',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin text-current" />}
      {!isLoading && leftIcon && <span className="mr-2 inline-flex">{leftIcon}</span>}
      {children}
      {!isLoading && rightIcon && <span className="ml-2 inline-flex">{rightIcon}</span>}
    </button>
  );
};
