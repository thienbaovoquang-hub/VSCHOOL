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
  className = ''
}) => {
  const variantStyles = {
    blue: 'bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-300/40 dark:border-sky-500/30',
    purple: 'bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-300/40 dark:border-purple-500/30',
    aqua: 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-300/40 dark:border-teal-500/30',
    mint: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-300/40 dark:border-emerald-500/30',
    peach: 'bg-amber-500/15 text-amber-900 dark:text-amber-300 border-amber-300/40 dark:border-amber-500/30',
    pink: 'bg-pink-500/15 text-pink-800 dark:text-pink-300 border-pink-300/40 dark:border-pink-500/30',
    amber: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-300/40 dark:border-amber-500/30',
    emerald: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-300/40 dark:border-emerald-500/30',
    gray: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-300/30 dark:border-slate-600/40'
  };

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5 rounded-full',
    md: 'text-xs px-2.5 py-1 rounded-lg font-medium'
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 border backdrop-blur-sm transition-colors whitespace-nowrap shrink-0 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
};
