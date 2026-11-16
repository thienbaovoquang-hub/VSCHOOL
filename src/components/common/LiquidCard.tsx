import React from 'react';

interface LiquidCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  glow?: 'blue' | 'purple' | 'aqua' | 'peach' | 'none';
  variant?: 'card' | 'panel' | 'deep';
}

export const LiquidCard: React.FC<LiquidCardProps> = ({
  children,
  className = '',
  glow = 'none',
  variant = 'card',
  ...props
}) => {
  const glowClasses = {
    none: '',
    blue: 'hover:shadow-[0_16px_36px_rgba(142,216,255,0.22)]',
    purple: 'hover:shadow-[0_16px_36px_rgba(220,214,255,0.25)]',
    aqua: 'hover:shadow-[0_16px_36px_rgba(167,243,224,0.22)]',
    peach: 'hover:shadow-[0_16px_36px_rgba(255,220,203,0.25)]'
  };

  const variantClass = {
    card: 'liquid-glass-panel rounded-2xl p-5 text-slate-800 dark:text-slate-100',
    panel: 'liquid-glass-panel rounded-3xl p-6 text-slate-800 dark:text-slate-100',
    deep: 'deep-glass rounded-3xl p-6 border border-white/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-100'
  }[variant];

  return (
    <div
      className={`${variantClass} ${glowClasses[glow]} relative overflow-hidden ${className}`}
      {...props}
    >
      {/* Top subtle liquid glass light refraction line */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent pointer-events-none" />
      {children}
    </div>
  );
};
