import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Sparkle {
  id: string;
  x: number;
  y: number;
  size: number;
  color: string;
}

interface SparkleProps {
  children: React.ReactNode;
  active?: boolean;
}

const COLORS = ['#FF007F', '#7F00FF', '#00F2FE', '#FFDD00', '#00FF66'];

export const SparkleBurst: React.FC<SparkleProps> = ({ children, active = false }) => {
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);

  const trigger = useCallback(() => {
    const newSparkles = Array.from({ length: 12 }).map((_, idx) => {
      const angle = (idx * 30 + Math.random() * 15) * (Math.PI / 180);
      const distance = 40 + Math.random() * 45;
      return {
        id: `sparkle-${Date.now()}-${idx}-${Math.random()}`,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        size: 6 + Math.random() * 8,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      };
    });
    setSparkles((prev) => [...prev, ...newSparkles]);
    // Auto prune sparkles after 800ms
    setTimeout(() => {
      setSparkles((prev) => prev.slice(newSparkles.length));
    }, 850);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    trigger();
  };

  return (
    <div className="relative inline-block" onClick={handleClick}>
      {children}
      <AnimatePresence>
        {sparkles.map((sp) => (
          <motion.span
            key={sp.id}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
            animate={{ x: sp.x, y: sp.y, scale: [0, 1.2, 0.4, 0], opacity: [1, 1, 0.6, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.75, ease: 'easeOut' }}
            className="absolute pointer-events-none rounded-full"
            style={{
              width: sp.size,
              height: sp.size,
              backgroundColor: sp.color,
              boxShadow: `0 0 8px ${sp.color}`,
              top: '50%',
              left: '50%',
              marginTop: -sp.size / 2,
              marginLeft: -sp.size / 2,
              zIndex: 30,
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default SparkleBurst;
