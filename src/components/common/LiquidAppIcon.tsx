import React from 'react';

interface LiquidAppIconProps {
  label: string;
  icon: React.FC<{ className?: string; size?: number }>;
  onClick: () => void;
  count?: number;
  highlight?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const LiquidAppIcon: React.FC<LiquidAppIconProps> = ({
  label,
  icon: IconComponent,
  onClick,
  count,
  highlight,
  size = 'md',
}) => {
  const iconSizeClasses = {
    sm: 'w-[40px] h-[40px] sm:w-[44px] sm:h-[44px]',
    md: 'w-[46px] h-[46px] sm:w-[50px] sm:h-[50px]',
    lg: 'w-[56px] h-[56px] sm:w-[60px] sm:h-[60px]',
  }[size];

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full flex flex-col items-center justify-start text-center cursor-pointer p-1.5 rounded-2xl transition-all duration-200 hover:bg-white/35 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80 active:scale-95"
    >
      <div className="relative shrink-0">
        <div
          className={`${iconSizeClasses} rounded-[15px] flex items-center justify-center transition-all duration-200 ease-out transform group-hover:-translate-y-1 group-hover:scale-105 group-hover:shadow-[0_10px_22px_-4px_rgba(14,165,233,0.28)]`}
        >
          <IconComponent className="w-full h-full drop-shadow-2xs transition-transform duration-200 group-hover:scale-[1.02]" />
        </div>

        {typeof count === 'number' && count > 0 && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 min-w-4 text-[9.5px] font-bold font-mono-tabular rounded-full bg-sky-600/95 backdrop-blur-xs text-white border border-white/80 shadow-2xs flex items-center justify-center transition-transform group-hover:scale-110 leading-none">
            {count}
          </span>
        )}

        {highlight && (
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-white dark:ring-slate-900" />
        )}
      </div>

      <span className="mt-1.5 text-center text-[10.5px] sm:text-[11px] font-semibold text-slate-800 dark:text-slate-100 group-hover:text-sky-700 dark:group-hover:text-sky-300 transition-colors duration-150 leading-[1.25] max-w-[105px] line-clamp-2">
        {label}
      </span>
    </button>
  );
};
