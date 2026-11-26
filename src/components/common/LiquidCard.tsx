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
    blue: 'hover:shadow-[0_18px_40px_rgba(14,165,233,0.16)]',
    purple: 'hover:shadow-[0_18px_40px_rgba(129,140,248,0.16)]',
    aqua: 'hover:shadow-[0_18px_40px_rgba(20,184,166,0.16)]',
    peach: 'hover:shadow-[0_18px_40px_rgba(249,115,22,0.16)]',
  };

  const variantClass = {
    card: 'liquid-glass-panel rounded-[22px] p-5 text-slate-900 dark:text-slate-100',
    panel: 'liquid-glass-panel rounded-[26px] p-6 text-slate-900 dark:text-slate-100',
    deep: 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 shadow-xl rounded-[26px] p-6 text-slate-900 dark:text-slate-100',
  }[variant];

  return (
    <div
      className={`${variantClass} ${glowClasses[glow]} relative overflow-hidden ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
