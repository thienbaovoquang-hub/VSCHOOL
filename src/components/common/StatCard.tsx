import React from 'react';
import { LucideIcon } from '../icons/UiIcons';
import { LiquidCard } from './LiquidCard';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  gradient?: 'blue-cyan' | 'cyan-mint' | 'purple-blue' | 'pink-lavender' | 'peach-pink';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  gradient = 'blue-cyan',
}) => {
  const solidStyles = {
    'blue-cyan': 'bg-sky-600 text-white shadow-sky-500/20',
    'cyan-mint': 'bg-teal-600 text-white shadow-teal-500/20',
    'purple-blue': 'bg-indigo-600 text-white shadow-indigo-500/20',
    'pink-lavender': 'bg-pink-600 text-white shadow-pink-500/20',
    'peach-pink': 'bg-orange-600 text-white shadow-orange-500/20',
  };

  return (
    <LiquidCard glow="blue" className="flex flex-col justify-between h-full group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">{title}</p>
          <h3 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50 mt-1 tracking-tight font-mono-tabular">
            {value}
          </h3>
          {subtitle && (
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        <div
          className={`w-11 h-11 rounded-2xl ${solidStyles[gradient]} flex items-center justify-center shadow-lg shrink-0 ring-1 ring-white/30 transition-transform duration-300 group-hover:scale-105`}
        >
          <Icon className="w-5 h-5 stroke-[1.9]" />
        </div>
      </div>

      {trend && (
        <div className="mt-4 pt-3 border-t border-slate-900/10 dark:border-white/10 flex items-center text-xs">
          <span
            className={`font-semibold font-mono-tabular mr-1.5 ${
              trend.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {trend.isPositive ? '↑' : '↓'} {trend.value}
          </span>
          <span className="text-slate-500 dark:text-slate-400">so với tháng trước</span>
        </div>
      )}
    </LiquidCard>
  );
};
