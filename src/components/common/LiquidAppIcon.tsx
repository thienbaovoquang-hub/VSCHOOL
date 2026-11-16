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
  size = 'md'
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
      className="group relative w-full flex flex-col items-center justify-start text-center cursor-pointer p-1 rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/80 active:scale-95 active:translate-y-0.5"
    >
      {/* Icon Capsule Container with Liquid Glass Sheen */}
      <div className="relative shrink-0">
        <div
          className={`${iconSizeClasses} rounded-[15px] flex items-center justify-center transition-all duration-200 ease-out transform group-hover:-translate-y-1 group-hover:scale-105 group-hover:shadow-[0_8px_18px_-2px_rgba(59,130,246,0.28),0_2px_6px_rgba(147,197,253,0.35)] group-hover:ring-2 group-hover:ring-sky-300/80`}
        >
          <IconComponent className="w-full h-full drop-shadow-2xs transition-transform duration-200 group-hover:scale-[1.02]" />
        </div>

        {/* Live data badge when count > 0 */}
        {typeof count === 'number' && count > 0 && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 min-w-4 text-[9.5px] font-bold tabular-nums rounded-full bg-blue-600/95 backdrop-blur-xs text-white border border-white/80 shadow-2xs flex items-center justify-center transition-transform group-hover:scale-110 leading-none">
            {count}
          </span>
        )}

        {/* Static highlight badge dot without distracting pulse */}
        {highlight && (
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-white" />
        )}
      </div>

      {/* Label with clean typography & comfortable width */}
      <span className="mt-1 text-center text-[10.5px] sm:text-[11px] font-medium text-slate-700 group-hover:text-blue-700 transition-colors duration-150 leading-[1.25] max-w-[105px] line-clamp-2">
        {label}
      </span>
    </button>
  );
};
