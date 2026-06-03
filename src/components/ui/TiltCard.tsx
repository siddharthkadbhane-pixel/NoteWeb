import React, { useRef, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
}

export const TiltCard: React.FC<TiltCardProps> = ({ children, className = '', glowColor = 'rgba(99, 102, 241, 0.25)' }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  // Springs for smooth organic movement
  const x = useSpring(0, { stiffness: 220, damping: 20 });
  const y = useSpring(0, { stiffness: 220, damping: 20 });

  const rotateX = useTransform(y, [-0.5, 0.5], [10, -10]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-10, 10]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const bounds = cardRef.current.getBoundingClientRect();
    
    // Calculate normalized relative coordinates from -0.5 to 0.5
    const relX = (e.clientX - bounds.left) / bounds.width - 0.5;
    const relY = (e.clientY - bounds.top) / bounds.height - 0.5;
    
    x.set(relX);
    y.set(relY);

    // Save absolute coordinates for the glow spotlight
    setCoords({
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top
    });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
      }}
      className={`relative rounded-3xl transition-all duration-200 cursor-pointer overflow-hidden ${className}`}
    >
      {/* Moving Highlight Spotlight Glow */}
      {isHovered && (
        <div
          className="absolute pointer-events-none rounded-full transition-opacity duration-300"
          style={{
            width: '280px',
            height: '280px',
            background: `radial-gradient(circle, ${glowColor} 0%, rgba(0,0,0,0) 80%)`,
            left: coords.x - 140,
            top: coords.y - 140,
            zIndex: 1,
          }}
        />
      )}
      
      {/* Premium subtle glassmorphic outline */}
      <div className="absolute inset-0 rounded-3xl border border-white/10 pointer-events-none z-10" />

      {/* Internal Content (preserve 3D space) */}
      <div style={{ transform: 'translateZ(10px)' }} className="relative z-10 w-full h-full">
        {children}
      </div>
    </motion.div>
  );
};

export default TiltCard;
