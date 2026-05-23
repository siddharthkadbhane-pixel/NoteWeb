import React, { useEffect, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  ox: number; // original X
  oy: number; // original Y
  oz: number; // original Z
}

export const InteractiveBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { isDark } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Dynamic particle configuration based on viewport width
    const particleCount = Math.min(65, Math.floor((width * height) / 22000));
    const particles: Particle[] = [];
    const maxDistance = 110;

    // Mouse interactive coordinates
    const mouse = {
      x: -9999,
      y: -9999,
      targetX: -9999,
      targetY: -9999,
      active: false,
      radius: 180,
    };

    // Initialize 3D particles
    for (let i = 0; i < particleCount; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const z = Math.random() * 200 - 100; // 3D depth field (-100 to 100)
      particles.push({
        x,
        y,
        z,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        vz: (Math.random() - 0.5) * 0.3,
        ox: x,
        oy: y,
        oz: z,
      });
    }

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      mouse.active = true;
    };

    const handleMouseLeave = () => {
      mouse.targetX = -9999;
      mouse.targetY = -9999;
      mouse.active = false;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    // Easing for mouse lag effect (making interactions look organic and buttery)
    mouse.x = window.innerWidth / 2;
    mouse.y = window.innerHeight / 2;

    const render = () => {
      // Smooth interpolation for mouse coordinates
      if (mouse.active) {
        mouse.x += (mouse.targetX - mouse.x) * 0.08;
        mouse.y += (mouse.targetY - mouse.y) * 0.08;
      } else {
        mouse.x = -9999;
        mouse.y = -9999;
      }

      ctx.clearRect(0, 0, width, height);

      // Color scheme adjustments based on Active Theme (Dark Mode / Light Mode)
      const baseDotColor = isDark ? 'rgba(99, 102, 241, 0.45)' : 'rgba(79, 70, 229, 0.25)'; // Indigo
      const altDotColor = isDark ? 'rgba(168, 85, 247, 0.4)' : 'rgba(147, 51, 234, 0.2)'; // Purple
      const lineColor = isDark ? 'rgba(99, 102, 241, 0.045)' : 'rgba(79, 70, 229, 0.03)';

      // 1. Update and Project 3D Particles
      particles.forEach((p) => {
        // Subtle drift movement
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        // Dynamic 3D rotation simulation around Y and X axis over time
        const cosY = Math.cos(0.0005);
        const sinY = Math.sin(0.0005);
        const rx = p.z * sinY + (p.x - width / 2) * cosY + width / 2;
        const rz = p.z * cosY - (p.x - width / 2) * sinY;
        p.x = rx;
        p.z = rz;

        // Boundary checks
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
        if (p.z < -120 || p.z > 120) p.vz *= -1;

        // Interactive gravity: cursor pull effect
        if (mouse.active) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < mouse.radius) {
            const force = (mouse.radius - dist) / mouse.radius;
            p.x += (dx / dist) * force * 1.5;
            p.y += (dy / dist) * force * 1.5;
          }
        }

        // Project 3D coordinates onto 2D viewport perspective
        const scale = 260 / (260 + p.z); // Perspective scale factor
        const projX = (p.x - width / 2) * scale + width / 2;
        const projY = (p.y - height / 2) * scale + height / 2;
        const projSize = Math.max(1, (p.z + 120) * 0.015 * scale);

        // Draw particle node
        ctx.beginPath();
        ctx.arc(projX, projY, projSize, 0, Math.PI * 2);
        
        // Alternate colors dynamically to create a multi-color nebular depth
        const gradient = ctx.createRadialGradient(projX, projY, 0, projX, projY, projSize * 2.5);
        const c1 = p.z > 0 ? baseDotColor : altDotColor;
        gradient.addColorStop(0, c1);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      // 2. Draw Vector Connections / Geometric Constellation lines
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i]!;
        const s1 = 260 / (260 + p1.z);
        const x1 = (p1.x - width / 2) * s1 + width / 2;
        const y1 = (p1.y - height / 2) * s1 + height / 2;

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j]!;
          const s2 = 260 / (260 + p2.z);
          const x2 = (p2.x - width / 2) * s2 + width / 2;
          const y2 = (p2.y - height / 2) * s2 + height / 2;

          const dx = x1 - x2;
          const dy = y1 - y2;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // If close enough, bridge them with a vector line
          if (dist < maxDistance) {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);

            // If mouse is close to the connection, light up the vector path
            let currentLineColor = lineColor;
            if (mouse.active) {
              const mx = (x1 + x2) / 2;
              const my = (y1 + y2) / 2;
              const mdx = mouse.x - mx;
              const mdy = mouse.y - my;
              const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
              if (mdist < mouse.radius * 0.8) {
                const interactAlpha = (1 - mdist / (mouse.radius * 0.8)) * 0.85;
                currentLineColor = isDark
                  ? `rgba(139, 92, 246, ${0.045 + interactAlpha * 0.1})` // glowing violet
                  : `rgba(99, 102, 241, ${0.03 + interactAlpha * 0.06})`;
              }
            }

            ctx.strokeStyle = currentLineColor;
            ctx.lineWidth = Math.max(0.3, (1 - dist / maxDistance) * 0.95);
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 opacity-80 select-none overflow-hidden"
      style={{ mixBlendMode: 'screen' }}
    />
  );
};
