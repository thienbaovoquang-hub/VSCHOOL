import React from 'react';
import { Trash2, X } from 'lucide-react';

interface BulkSelectionBarProps {
  totalVisibleCount: number;
  selectedCount: number;
  allVisibleSelected: boolean;
  canDelete?: boolean;
  entityLabel?: string;
  showSelectAll?: boolean;
  isDeleting?: boolean;
  testIdPrefix?: string;
  onToggleSelectAll: () => void;
  onClearSelection: () => void;
  onRequestBulkDelete: () => void;
}

export const BulkSelectionBar: React.FC<BulkSelectionBarProps> = ({
  totalVisibleCount,
  selectedCount,
  allVisibleSelected,
  canDelete = false,
  entityLabel = 'mục',
  showSelectAll = true,
  isDeleting = false,
  testIdPrefix = 'bulk',
  onToggleSelectAll,
  onClearSelection,
  onRequestBulkDelete,
}) => {
  if (!canDelete || totalVisibleCount === 0) return null;
  if (!showSelectAll && selectedCount === 0) return null;

  return (
    <div
      data-testid={`${testIdPrefix}-selection-bar`}
      className={`flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-2xl border text-xs transition-all backdrop-blur-md ${
        selectedCount > 0
          ? 'bg-rose-500/12 dark:bg-rose-950/35 border-rose-400/45 dark:border-rose-500/35'
          : 'glass-subsurface'
      }`}
    >
      <div className="flex items-center gap-3">
        {showSelectAll && (
          <label className="inline-flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={onToggleSelectAll}
              data-testid={`${testIdPrefix}-select-all`}
              className="w-3.5 h-3.5 rounded border-slate-400 dark:border-slate-500 text-sky-600 focus:ring-sky-500 cursor-pointer"
            />
            <span>
              Chọn tất cả đang hiển thị ({totalVisibleCount})
            </span>
          </label>
        )}

        {selectedCount > 0 && (
          <span className="font-bold text-rose-700 dark:text-rose-300 font-mono-tabular">
            Đã chọn {selectedCount} {entityLabel}
          </span>
        )}
      </div>

      {selectedCount > 0 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClearSelection}
            disabled={isDeleting}
            data-testid={`${testIdPrefix}-clear-selection`}
            className="px-2.5 py-1.5 rounded-xl glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/75 text-slate-700 dark:text-slate-200 font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <X className="w-3.5 h-3.5" />
            <span>Bỏ chọn</span>
          </button>
          <button
            type="button"
            onClick={onRequestBulkDelete}
            disabled={isDeleting}
            data-testid={`${testIdPrefix}-delete-selected`}
            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>
              {isDeleting ? 'Đang xóa...' : `Xóa đã chọn (${selectedCount})`}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
