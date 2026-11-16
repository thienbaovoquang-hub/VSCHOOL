import React from 'react';
import { LucideIcon } from 'lucide-react';
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
  gradient = 'blue-cyan'
}) => {
  const gradientStyles = {
    'blue-cyan': 'from-sky-500 to-cyan-400 text-white shadow-sky-500/20',
    'cyan-mint': 'from-teal-400 to-emerald-400 text-white shadow-teal-500/20',
    'purple-blue': 'from-indigo-500 to-sky-400 text-white shadow-indigo-500/20',
    'pink-lavender': 'from-pink-400 to-purple-400 text-white shadow-pink-500/20',
    'peach-pink': 'from-orange-400 to-pink-400 text-white shadow-orange-500/20'
  };

  return (
    <LiquidCard glow="blue" className="flex flex-col justify-between h-full group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1 tracking-tight font-mono-tabular">{value}</h3>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${gradientStyles[gradient]} flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110`}>
          <Icon className="w-5 h-5 stroke-[2.2]" />
        </div>
      </div>

      {trend && (
        <div className="mt-4 pt-3 border-t border-slate-200/50 dark:border-slate-700/60 flex items-center text-xs">
          <span className={`font-semibold mr-1.5 ${trend.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {trend.isPositive ? '↑' : '↓'} {trend.value}
          </span>
          <span className="text-slate-400 dark:text-slate-500">so với tháng trước</span>
        </div>
      )}
    </LiquidCard>
  );
};
