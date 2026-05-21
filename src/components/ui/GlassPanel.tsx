import React from 'react';

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  glowBorder?: boolean;
  hoverEffect?: boolean;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  glowBorder = false,
  hoverEffect = false,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`
        glass-panel rounded-2xl p-6
        ${glowBorder ? 'animated-border-glow' : ''}
        ${hoverEffect ? 'hover:bg-white/[0.06] light-mode:hover:bg-slate-900/[0.05] transition-all duration-300' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};
