import React from 'react';
import type { SystemBrandingConfig } from '../../types';
import { DEFAULT_SYSTEM_BRANDING, splitBrandWordmark } from '../../utils/branding';

export type BrandMarkSize = 'sm' | 'header' | 'hero' | 'preview' | 'login';

interface SystemBrandMarkProps {
  branding?: SystemBrandingConfig | null;
  size?: BrandMarkSize;
  subtitle?: string;
  showSubtitle?: boolean;
  className?: string;
  subtitleClassName?: string;
}

const SIZE_STYLES: Record<
  BrandMarkSize,
  {
    gap: string;
    logoBox: string;
    title: string;
    subtitle: string;
  }
> = {
  sm: {
    gap: 'gap-2',
    logoBox: 'w-8 h-8',
    title: 'text-sm font-extrabold tracking-tight',
    subtitle: 'text-[10px] font-medium',
  },
  header: {
    gap: 'gap-2.5',
    logoBox: 'w-9 h-9 sm:w-10 sm:h-10',
    title: 'text-base sm:text-lg font-extrabold tracking-tight',
    subtitle: 'text-[10px] font-medium',
  },
  hero: {
    gap: 'gap-3',
    logoBox: 'w-11 h-11 sm:w-12 sm:h-12',
    title: 'text-xl sm:text-2xl font-extrabold tracking-tight',
    subtitle: 'text-xs font-medium',
  },
  preview: {
    gap: 'gap-3.5',
    logoBox: 'w-12 h-12',
    title: 'text-xl sm:text-2xl font-extrabold tracking-tight',
    subtitle: 'text-xs font-medium',
  },
  login: {
    gap: 'gap-3.5',
    logoBox: 'w-13 h-13',
    title: 'text-2xl font-extrabold tracking-tight',
    subtitle: 'text-xs font-medium',
  },
};

export const DefaultBrandLogoSvg: React.FC<{ className?: string }> = ({
  className = 'w-10 h-10',
}) => {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="2"
        y="2"
        width="96"
        height="96"
        rx="26"
        fill="#EFF6FF"
        stroke="rgba(148, 163, 184, 0.28)"
        strokeWidth="2"
      />
      {/* Stylized V (Red) */}
      <path
        d="M20 30L34 69C35.2 72.3 39.8 72.3 41 69L55 30"
        stroke="#E11D48"
        strokeWidth="10.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Stylized S (Blue) */}
      <path
        d="M78 34.5C75.5 30.8 70.5 29 65.5 29C58.8 29 54 32.8 54 38.2C54 44.2 59.8 46.8 66.8 49C74.2 51.4 79.5 54.4 79.5 61.2C79.5 67.5 73.6 71.5 65.8 71.5C59.8 71.5 54.5 69.2 51.8 65.2"
        stroke="#0284C7"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const SystemBrandMark: React.FC<SystemBrandMarkProps> = ({
  branding,
  size = 'header',
  subtitle,
  showSubtitle = Boolean(subtitle),
  className = '',
  subtitleClassName = '',
}) => {
  const resolved = branding || DEFAULT_SYSTEM_BRANDING;
  const wordmark = splitBrandWordmark(resolved.appName);
  const style = SIZE_STYLES[size];

  return (
    <div className={`inline-flex items-center ${style.gap} min-w-0 ${className}`}>
      <div
        className={`${style.logoBox} shrink-0 rounded-2xl flex items-center justify-center overflow-hidden shadow-xs`}
      >
        {resolved.logoUrl ? (
          <img
            src={resolved.logoUrl}
            alt={wordmark.fullName}
            className="w-full h-full object-contain rounded-2xl bg-white/80 dark:bg-slate-800/80"
          />
        ) : (
          <DefaultBrandLogoSvg className="w-full h-full" />
        )}
      </div>

      <div className="min-w-0 leading-none">
        <div className={`${style.title} whitespace-nowrap truncate`}>
          {wordmark.isVschool ? (
            <>
              <span className="text-rose-600 dark:text-rose-400">
                {wordmark.prefix}
              </span>
              <span className="text-sky-600 dark:text-sky-400">
                {wordmark.suffix}
              </span>
            </>
          ) : (
            <span className="text-slate-900 dark:text-slate-100">
              {wordmark.fullName}
            </span>
          )}
        </div>

        {showSubtitle && subtitle && (
          <span
            className={`block ${style.subtitle} text-slate-500 dark:text-slate-400 whitespace-nowrap truncate mt-0.5 ${subtitleClassName}`}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};
