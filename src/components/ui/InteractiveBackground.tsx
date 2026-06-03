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
  phase: number; // Twinkle phase offset
  speed: number; // Twinkle speed modulation
}

interface ShootingStar {
  x: number;
  y: number;
  dx: number;
  dy: number;
  length: number;
  speed: number;
  opacity: number;
  width: number;
}

interface ClickRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  opacity: number;
}

// Precise mobile platform check (ignores Electron / Touchscreen Laptops)
const isNativeMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const ua = window.navigator.userAgent.toLowerCase();
  const isMobileOS = ua.includes('android') || 
                     ua.includes('iphone') || 
                     ua.includes('ipad') || 
                     ua.includes('ipod');
                     
  if (isMobileOS) return true;
  
  if ((window as any).Capacitor) {
    const platform = (window as any).Capacitor.getPlatform?.();
    if (platform === 'android' || platform === 'ios') {
      return true;
    }
  }
  return false;
};

// Check WebGL/Gpu context to prevent severe lag on software-rendering fallback
const isGpuSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || (canvas as any).getContext('experimental-webgl');
    return !!gl;
  } catch (e) {
    return false;
  }
};

export const InteractiveBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { isDark } = useTheme();

  // Skip entirely on mobile / Capacitor native builds to prevent crashes and free the JS thread.
  if (isNativeMobile()) return null;

  const gpuSupported = isGpuSupported();

  useEffect(() => {
    if (!gpuSupported) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Optimized particle density config for better CPU/GPU performance
    const particleCount = Math.min(40, Math.floor((width * height) / 32000));
    const particles: Particle[] = [];
    const maxDistance = 100;

    // Premium Effects States
    const shootingStars: ShootingStar[] = [];
    const clickRipples: ClickRipple[] = [];

    // Mouse coordinates with Parallax targets
    const mouse = {
      x: -9999,
      y: -9999,
      targetX: -9999,
      targetY: -9999,
      active: false,
      radius: 230,
      parallaxX: 0,
      parallaxY: 0,
      targetParallaxX: 0,
      targetParallaxY: 0,
    };

    // Initialize 3D particles with twinkling
    for (let i = 0; i < particleCount; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const z = Math.random() * 200 - 100;
      particles.push({
        x,
        y,
        z,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        vz: (Math.random() - 0.5) * 0.2,
        ox: x,
        oy: y,
        oz: z,
        phase: Math.random() * Math.PI * 2,
        speed: 0.007 + Math.random() * 0.012,
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

      // Compute Parallax targets
      mouse.targetParallaxX = (e.clientX - window.innerWidth / 2) * 0.045;
      mouse.targetParallaxY = (e.clientY - window.innerHeight / 2) * 0.045;
    };

    const handleMouseLeave = () => {
      mouse.targetX = -9999;
      mouse.targetY = -9999;
      mouse.active = false;
      mouse.targetParallaxX = 0;
      mouse.targetParallaxY = 0;
    };

    // Trigger HUGE epic shockwave ripple on click
    const handleMouseClick = (e: MouseEvent) => {
      clickRipples.push({
        x: e.clientX,
        y: e.clientY,
        radius: 0,
        maxRadius: 300 + Math.random() * 120, // MASSIVE wave radius (300px - 420px)
        speed: 4.8, // travels slightly faster to cover huge area dynamically
        opacity: 0.9, // brighter core opacity
      });
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('mousedown', handleMouseClick);

    // Initial center cursor values
    mouse.x = window.innerWidth / 2;
    mouse.y = window.innerHeight / 2;

    const render = () => {
      // Interpolate coordinates & Parallax tilt
      if (mouse.active) {
        mouse.x += (mouse.targetX - mouse.x) * 0.06;
        mouse.y += (mouse.targetY - mouse.y) * 0.06;
      } else {
        mouse.x = -9999;
        mouse.y = -9999;
      }
      mouse.parallaxX += (mouse.targetParallaxX - mouse.parallaxX) * 0.05;
      mouse.parallaxY += (mouse.targetParallaxY - mouse.parallaxY) * 0.05;

      ctx.clearRect(0, 0, width, height);

      // 1. Spawn and Draw Shooting Stars (occasional cosmic drifts)
      if (Math.random() < 0.0035 && shootingStars.length < 2) {
        const startSide = Math.random() > 0.5;
        shootingStars.push({
          x: startSide ? Math.random() * width * 0.6 : 0,
          y: startSide ? 0 : Math.random() * height * 0.5,
          dx: 4.5 + Math.random() * 3,
          dy: 2.2 + Math.random() * 2,
          length: 70 + Math.random() * 100,
          speed: 9 + Math.random() * 6,
          opacity: 1,
          width: 0.9 + Math.random() * 1.1,
        });
      }

      // Update and Draw active shooting stars
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i]!;
        s.x += s.dx * s.speed * 0.2;
        s.y += s.dy * s.speed * 0.2;
        s.opacity -= 0.015;

        if (s.opacity <= 0 || s.x > width || s.y > height) {
          shootingStars.splice(i, 1);
          continue;
        }

        const starGrad = ctx.createLinearGradient(s.x, s.y, s.x - s.dx * s.length * 0.1, s.y - s.dy * s.length * 0.1);
        if (isDark) {
          starGrad.addColorStop(0, `rgba(0, 242, 254, ${s.opacity})`);
          starGrad.addColorStop(0.3, `rgba(127, 0, 255, ${s.opacity * 0.6})`);
          starGrad.addColorStop(1, 'rgba(0,0,0,0)');
        } else {
          starGrad.addColorStop(0, `rgba(99, 102, 241, ${s.opacity})`);
          starGrad.addColorStop(1, 'rgba(0,0,0,0)');
        }

        ctx.strokeStyle = starGrad;
        ctx.lineWidth = s.width;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.dx * s.length * 0.1, s.y - s.dy * s.length * 0.1);
        ctx.stroke();
      }

      // 2. Process Mouse Click Shockwave Ripples (expanding rings that push particles)
      for (let i = clickRipples.length - 1; i >= 0; i--) {
        const r = clickRipples[i]!;
        r.radius += r.speed;
        r.opacity -= 0.013; // decays slightly slower to stay visible across massive screen distance

        if (r.opacity <= 0) {
          clickRipples.splice(i, 1);
          continue;
        }

        // Draw soft expanding shockwave halo
        ctx.strokeStyle = isDark 
          ? `rgba(0, 242, 254, ${r.opacity * 0.24})` 
          : `rgba(99, 102, 241, ${r.opacity * 0.16})`;
        ctx.lineWidth = 2.0; // thicker, more visible lines
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 3. Draw Mouse Ambient Aura Glow
      if (mouse.active) {
        const mouseGlow = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, mouse.radius * 1.15);
        if (isDark) {
          mouseGlow.addColorStop(0, 'rgba(127, 0, 255, 0.09)'); 
          mouseGlow.addColorStop(0.45, 'rgba(0, 242, 254, 0.03)'); 
          mouseGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else {
          mouseGlow.addColorStop(0, 'rgba(99, 102, 241, 0.045)');
          mouseGlow.addColorStop(0.5, 'rgba(147, 51, 234, 0.015)');
          mouseGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        }
        ctx.fillStyle = mouseGlow;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, mouse.radius * 1.15, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Update & Project Particles (incorporating Parallax tilt)
      particles.forEach((p) => {
        // Drift movement
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        // Dynamic 3D rotation simulation
        const cosY = Math.cos(0.00025);
        const sinY = Math.sin(0.00025);
        const rx = p.z * sinY + (p.x - width / 2) * cosY + width / 2;
        const rz = p.z * cosY - (p.x - width / 2) * sinY;
        p.x = rx;
        p.z = rz;

        // Boundary checks
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
        if (p.z < -100 || p.z > 100) p.vz *= -1;

        // Shockwave Ripple Force (pushes nodes outward kinetic bounce)
        clickRipples.forEach((r) => {
          const dx = p.x - r.x;
          const dy = p.y - r.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          // If particle lies inside the massive expanding shockwave ring
          if (dist > 0 && Math.abs(dist - r.radius) < 35) {
            const force = (1 - Math.abs(dist - r.radius) / 35) * r.opacity * 9.5; // much stronger force
            p.x += (dx / dist) * force;
            p.y += (dy / dist) * force;
          }
        });

        // Interactive mouse pull
        if (mouse.active) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < mouse.radius) {
            const force = (mouse.radius - dist) / mouse.radius;
            p.x += (dx / dist) * force * 1.1;
            p.y += (dy / dist) * force * 1.1;
          }
        }

        // Project 3D coordinates onto 2D viewport + apply Parallax tilt offsets
        const scale = 295 / (295 + p.z);
        const parallaxScale = (p.z + 100) / 200 * 0.6;
        const projX = (p.x - width / 2) * scale + width / 2 + mouse.parallaxX * parallaxScale;
        const projY = (p.y - height / 2) * scale + height / 2 + mouse.parallaxY * parallaxScale;
        
        // Cache projected coordinates to avoid redundant O(N^2) math operations in line loops
        (p as any).projX = projX;
        (p as any).projY = projY;
        
        // Modulate twinkling opacity & size
        p.phase += p.speed;
        const twinkle = Math.sin(p.phase) * 0.28 + 0.72; // Cycles between 0.44 and 1.00
        const projSize = Math.max(1.3, (p.z + 100) * 0.02 * scale * twinkle); // slightly larger base scale

        // ULTRA-COLORFUL DEPTH PALETTE: Graded across four gorgeous, highly saturated cosmic spectrums
        let pColor = '';
        if (p.z > 40) {
          // Foreground: Hyper Vibrant Saturated Neon Cyan
          pColor = isDark ? `rgba(0, 242, 254, ${0.75 * twinkle})` : `rgba(6, 182, 212, ${0.60 * twinkle})`;
        } else if (p.z < -40) {
          // Background: Intense Cosmic Hot Pink/Magenta
          pColor = isDark ? `rgba(255, 0, 150, ${0.68 * twinkle})` : `rgba(236, 72, 153, ${0.50 * twinkle})`;
        } else if (p.z > -10 && p.z < 10) {
          // Core Midground: Bright Electric Amber Gold
          pColor = isDark ? `rgba(255, 170, 0, ${0.72 * twinkle})` : `rgba(245, 158, 11, ${0.58 * twinkle})`;
        } else {
          // General Midground: Deep Rich Saturated Royal Purple
          pColor = isDark ? `rgba(139, 92, 246, ${0.70 * twinkle})` : `rgba(99, 102, 241, ${0.54 * twinkle})`;
        }

        // Draw particle node with MASSIVE Glowing Halo Bloom
        ctx.beginPath();
        ctx.arc(projX, projY, projSize, 0, Math.PI * 2);
        
        // Increased gradient outer radius multiplier to 3.8 for intense soft neon glowing halo!
        const gradient = ctx.createRadialGradient(projX, projY, 0, projX, projY, projSize * 3.8);
        gradient.addColorStop(0, pColor);
        gradient.addColorStop(0.3, pColor.replace(/[\d.]+\)$/, `${0.35 * twinkle})`)); // glowing midground gradient
        gradient.addColorStop(0.65, pColor.replace(/[\d.]+\)$/, `${0.1 * twinkle})`));
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      // 5. Draw Constellation Vector Lines & Moving Neural Light Pulses
      const pulseTimeOffset = (Date.now() * 0.0016) % 1; 

      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i]!;
        const px1 = (p1 as any).projX;
        const py1 = (p1 as any).projY;

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j]!;
          const px2 = (p2 as any).projX;
          const py2 = (p2 as any).projY;

          const dx = px1 - px2;
          const dy = py1 - py2;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDistance) {
            ctx.beginPath();
            ctx.moveTo(px1, py1);
            ctx.lineTo(px2, py2);

            const avgZ = (p1.z + p2.z) / 2;
            const depthFade = (avgZ + 100) / 200;
            let baseAlpha = (1 - dist / maxDistance) * 0.05 * depthFade;

            let lineColor = isDark ? `rgba(139, 92, 246, ${baseAlpha})` : `rgba(99, 102, 241, ${baseAlpha})`;
            let lineGlowActive = false;

            if (mouse.active) {
              const mx = (px1 + px2) / 2;
              const my = (py1 + py2) / 2;
              const mdx = mouse.x - mx;
              const mdy = mouse.y - my;
              const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
              
              if (mdist < mouse.radius * 0.85) {
                lineGlowActive = true;
                const interactBoost = (1 - mdist / (mouse.radius * 0.85)) * 0.6;
                lineColor = isDark
                  ? `rgba(0, 242, 254, ${baseAlpha + interactBoost * 0.14})`
                  : `rgba(99, 102, 241, ${baseAlpha + interactBoost * 0.08})`;
              }
            }

            ctx.strokeStyle = lineColor;
            ctx.lineWidth = Math.max(0.4, (1 - dist / maxDistance) * 0.8 * (avgZ + 100) * 0.005);
            ctx.stroke();

            // Futuristic "Neural Pulse Packet"
            if (lineGlowActive && dist > 35) {
              const pulseX = px1 + (px2 - px1) * pulseTimeOffset;
              const pulseY = py1 + (py2 - py1) * pulseTimeOffset;
              
              ctx.beginPath();
              ctx.arc(pulseX, pulseY, 1.35, 0, Math.PI * 2);
              ctx.fillStyle = isDark ? 'rgba(0, 242, 254, 0.9)' : 'rgba(99, 102, 241, 0.75)';
              ctx.fill();
            }
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
      window.removeEventListener('mousedown', handleMouseClick);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isDark, gpuSupported]);

  return (
    <>
      {/* Floating Organic Liquid Blobs Container - z-index set to 1, mix-blend-mode: normal to prevent Electron compositor blackouts */}
      <div className="liquid-blob-container" style={{ zIndex: 1 }}>
        <div className="liquid-blob liquid-blob-1" style={{ mixBlendMode: 'normal' }} />
        <div className="liquid-blob liquid-blob-2" style={{ mixBlendMode: 'normal' }} />
        <div className="liquid-blob liquid-blob-3" style={{ mixBlendMode: 'normal' }} />
      </div>

      {/* 3D Neural Constellation Canvas - z-index set to 1, mix-blend-mode: normal */}
      {gpuSupported && (
        <canvas
          ref={canvasRef}
          className="fixed inset-0 pointer-events-none z-[1] opacity-80 select-none overflow-hidden"
          style={{ mixBlendMode: 'normal' }}
        />
      )}
    </>
  );
};
