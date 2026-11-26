import React from 'react';
import { Plus, Download, Upload } from '../icons/UiIcons';

interface CompactDataToolbarProps {
  title?: string;
  canCreate?: boolean;
  canImport?: boolean;
  canExport?: boolean;
  createLabel?: string;
  onManualAdd?: () => void;
  onDownloadTemplate?: () => void;
  onOpenImport?: () => void;
  onOpenExport?: () => void;
  selectedCount?: number;
  extraActions?: React.ReactNode;
}

export const CompactDataToolbar: React.FC<CompactDataToolbarProps> = ({
  canCreate = false,
  canImport = false,
  canExport = false,
  createLabel = 'Thêm mới',
  onManualAdd,
  onOpenImport,
  onOpenExport,
  selectedCount = 0,
  extraActions,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canCreate && onManualAdd && (
        <button
          type="button"
          onClick={onManualAdd}
          data-testid="btn-manual-add"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus size={15} />
          <span>{createLabel}</span>
        </button>
      )}

      {canImport && onOpenImport && (
        <button
          type="button"
          onClick={onOpenImport}
          data-testid="btn-open-import"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 transition-all whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Upload size={14} />
          <span>Nhập dữ liệu</span>
        </button>
      )}

      {canExport && onOpenExport && (
        <button
          type="button"
          onClick={onOpenExport}
          data-testid="btn-open-export"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download size={14} className="text-blue-600 dark:text-blue-400" />
          <span>
            Xuất dữ liệu{selectedCount > 0 ? ` (${selectedCount})` : ''}
          </span>
        </button>
      )}

      {extraActions}
    </div>
  );
};
