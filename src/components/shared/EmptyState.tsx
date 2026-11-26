import React from 'react';
import { LucideIcon } from '../icons/UiIcons';

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
    <div className="py-12 px-4 text-center flex flex-col items-center justify-center rounded-[22px] glass-subsurface">
      <div className="w-12 h-12 rounded-2xl ui-icon-chip flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 stroke-[1.9]" />
      </div>
      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">{title}</h3>
      <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mt-1 mb-4 leading-relaxed">
        {description}
      </p>
      {action}
    </div>
  );
};
