import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  icon,
  className = '',
  id,
  type = 'text',
  ...props
}, ref) => {
  const inputId = id || `input-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <div className="w-full flex flex-col gap-1.5 text-left">
      {label && (
        <label 
          htmlFor={inputId} 
          className="text-xs font-semibold uppercase tracking-wider text-slate-400 light-mode:text-slate-500 pl-1"
        >
          {label}
        </label>
      )}
      
      <div className="relative w-full">
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 light-mode:text-slate-500 flex items-center justify-center pointer-events-none">
            {icon}
          </div>
        )}
        
        <input
          ref={ref}
          id={inputId}
          type={type}
          className={`
            w-full py-3 px-4 glass-input text-sm
            ${icon ? 'pl-11' : ''}
            ${error ? 'border-rose-500/50 focus:border-rose-500/80 focus:ring-rose-500/20' : ''}
            ${className}
          `}
          {...props}
        />
      </div>
      
      {error && (
        <span className="text-xs font-medium text-rose-400 light-mode:text-rose-500 pl-1">
          {error}
        </span>
      )}
      
      {!error && helperText && (
        <span className="text-xs text-slate-500 light-mode:text-slate-400 pl-1">
          {helperText}
        </span>
      )}
    </div>
  );
});

Input.displayName = 'Input';
