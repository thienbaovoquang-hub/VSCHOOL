import React from 'react';
import { Database } from '../icons/UiIcons';
import type { DataSourceConfig, DataSourceGroupKey } from '../../types';

interface DataSourceButtonProps {
  groupKey: DataSourceGroupKey;
  config?: DataSourceConfig;
  isAdmin: boolean;
  onClick: () => void;
  className?: string;
}

export const DataSourceButton: React.FC<DataSourceButtonProps> = ({
  groupKey,
  config,
  isAdmin,
  onClick,
  className = '',
}) => {
  if (!isAdmin) return null;

  const isConfigured = Boolean(config && config.status !== 'unconfigured');
  const dotColor =
    !isConfigured
      ? 'bg-slate-400'
      : config?.status === 'error'
        ? 'bg-rose-500'
        : config?.status === 'syncing'
          ? 'bg-amber-500'
          : 'bg-emerald-500';

  const statusText = !isConfigured
    ? 'Chưa kết nối tệp Excel'
    : `Excel · ${config?.sourceName}`;

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`data-source-btn-${groupKey}`}
      title={statusText}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${className}`}
    >
      <Database className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
      <span>Nguồn dữ liệu</span>
      {isConfigured && (
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`}
          aria-hidden="true"
        />
      )}
    </button>
  );
};
