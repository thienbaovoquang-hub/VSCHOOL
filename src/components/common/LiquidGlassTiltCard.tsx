import React, { useRef, useEffect } from 'react';

interface LiquidGlassTiltCardProps {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  glowColor?: string;
  tiltMaxAngle?: number;
  onClick?: () => void;
  ariaLabel?: string;
}

export const LiquidGlassTiltCard: React.FC<LiquidGlassTiltCardProps> = ({
  children,
  className = '',
  contentClassName = '',
  glowColor = 'rgba(244, 191, 203, 0.45)',
  tiltMaxAngle = 4,
  onClick,
  ariaLabel
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const auraRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const reducedMotionRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotionRef.current || !cardRef.current) return;
    const clientX = e.clientX;
    const clientY = e.clientY;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      const card = cardRef.current;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -tiltMaxAngle;
      const rotateY = ((x - centerX) / centerX) * tiltMaxAngle;

      card.style.transition = 'transform 0.08s ease-out, box-shadow 0.25s ease';
      card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.015, 1.015, 1.015)`;

      if (glareRef.current) {
        glareRef.current.style.opacity = '1';
        glareRef.current.style.background = `radial-gradient(circle 190px at ${x}px ${y}px, rgba(255, 255, 255, 0.65), rgba(244, 191, 203, 0.2) 40%, rgba(221, 235, 250, 0.12) 70%, transparent 100%)`;
      }
    });
  };

  const handleMouseEnter = () => {
    if (auraRef.current && !reducedMotionRef.current) {
      auraRef.current.style.opacity = '0.75';
    }
  };

  const handleMouseLeave = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (cardRef.current) {
      cardRef.current.style.transition = 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s ease';
      cardRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    }
    if (glareRef.current) {
      glareRef.current.style.opacity = '0';
    }
    if (auraRef.current) {
      auraRef.current.style.opacity = '0';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative rounded-[22px] liquid-crystal-card overflow-hidden tilt-card-container ${
        onClick ? 'cursor-pointer active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500' : ''
      } ${className}`}
    >
      {/* Dynamic Specular Water Reflection updated via rAF with zero React re-renders */}
      <div
        ref={glareRef}
        className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-200"
      />

      {/* Top curved waterdrop specular sheen */}
      <div className="specular-sheen" />

      {/* Subtle border glow aura when hovered */}
      <div
        ref={auraRef}
        className="pointer-events-none absolute -inset-px rounded-[20px] sm:rounded-[22px] opacity-0 blur-xs transition-opacity duration-300"
        style={{
          boxShadow: `0 0 20px 2px ${glowColor}, inset 0 0 15px rgba(255,255,255,0.6)`
        }}
      />

      {/* Content slot with natural height */}
      <div className={`relative z-20 w-full tilt-inner ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
};
