import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'blue' | 'purple' | 'aqua' | 'mint' | 'peach' | 'pink' | 'amber' | 'emerald' | 'gray';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'blue',
  size = 'md',
  className = '',
}) => {
  const variantStyles = {
    blue: 'bg-sky-500/15 text-sky-800 dark:text-sky-200 border-sky-400/35 dark:border-sky-400/30',
    purple: 'bg-purple-500/15 text-purple-800 dark:text-purple-200 border-purple-400/35 dark:border-purple-400/30',
    aqua: 'bg-teal-500/15 text-teal-800 dark:text-teal-200 border-teal-400/35 dark:border-teal-400/30',
    mint: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-400/35 dark:border-emerald-400/30',
    peach: 'bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-400/35 dark:border-amber-400/30',
    pink: 'bg-pink-500/15 text-pink-800 dark:text-pink-200 border-pink-400/35 dark:border-pink-400/30',
    amber: 'bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-400/35 dark:border-amber-400/30',
    emerald: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-400/35 dark:border-emerald-400/30',
    gray: 'bg-slate-500/12 text-slate-700 dark:text-slate-200 border-slate-400/30 dark:border-white/15',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 rounded-lg font-medium',
    md: 'text-xs px-2.5 py-1 rounded-xl font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 border transition-colors whitespace-nowrap shrink-0 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
};
