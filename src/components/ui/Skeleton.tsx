import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'rect' | 'circle';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rect',
  width,
  height,
  className = '',
  style,
  ...props
}) => {
  const getShapeClass = () => {
    switch (variant) {
      case 'circle': return 'rounded-full';
      case 'text': return 'rounded h-3 w-3/4';
      default: return 'rounded-xl';
    }
  };

  return (
    <div
      className={`
        bg-white/[0.04] light-mode:bg-slate-900/[0.04] animate-pulse
        ${getShapeClass()}
        ${className}
      `}
      style={{
        width: width,
        height: height,
        ...style
      }}
      {...props}
    />
  );
};
