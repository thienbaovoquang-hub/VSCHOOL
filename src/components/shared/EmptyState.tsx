import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="py-12 px-4 text-center flex flex-col items-center justify-center rounded-2xl bg-white/55 dark:bg-slate-800/45 border border-slate-200/70 dark:border-slate-700/70">
      <div className="w-12 h-12 rounded-2xl bg-sky-500/12 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 stroke-[1.6]" />
      </div>
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-4">
        {description}
      </p>
      {action}
    </div>
  );
};
