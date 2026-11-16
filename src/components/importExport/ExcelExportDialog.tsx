import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckSquare,
  Download,
  FileSpreadsheet,
  Square,
  X,
} from 'lucide-react';
import type {
  ExportHistoryRecord,
  ExportRequestOptions,
  ImportModuleKey,
  UserProfile,
} from '../../types';
import { getSchemaByKey } from '../../utils/importExport/schemas';
import {
  exportRecordsToBuffer,
  triggerBinaryDownload,
} from '../../utils/importExport/excelEngine';
import { exportRecordsToDocx } from '../../utils/documentExporter';

interface ExcelExportDialogProps {
  isOpen: boolean;
  moduleKey: ImportModuleKey;
  allRecords: Record<string, unknown>[];
  filteredRecords: Record<string, unknown>[];
  selectedRecords?: Record<string, unknown>[];
  currentUser: UserProfile;
  schoolName?: string;
  onClose: () => void;
  onLogExport?: (record: ExportHistoryRecord) => void | Promise<void>;
}

type FileFormatType = 'xlsx' | 'docx' | 'csv';

export const ExcelExportDialog: React.FC<ExcelExportDialogProps> = ({
  isOpen,
  moduleKey,
  allRecords,
  filteredRecords,
  selectedRecords = [],
  currentUser,
  schoolName = 'Trường THPT SchoolHub',
  onClose,
  onLogExport,
}) => {
  const schema = useMemo(() => getSchemaByKey(moduleKey), [moduleKey]);
  const exportableFields = useMemo(
    () => schema.fields.filter((f) => !f.sensitive),
    [schema]
  );

  const [format, setFormat] = useState<FileFormatType>('xlsx');
  const [scope, setScope] = useState<ExportRequestOptions['scope']>('filtered');
  const [templateCompatible, setTemplateCompatible] = useState(true);
  const [selectedFieldKeys, setSelectedFieldKeys] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedFieldKeys(exportableFields.map((f) => f.key));
    if (selectedRecords.length > 0) setScope('selected');
    else if (filteredRecords.length !== allRecords.length) setScope('filtered');
    else setScope('all');
  }, [isOpen, exportableFields, selectedRecords.length, filteredRecords.length, allRecords.length]);

  if (!isOpen) return null;

  const targetRecords =
    scope === 'selected' && selectedRecords.length > 0
      ? selectedRecords
      : scope === 'filtered'
      ? filteredRecords
      : allRecords;

  const toggleField = (key: string) => {
    setSelectedFieldKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleExport = async () => {
    if (selectedFieldKeys.length === 0) return;
    setIsExporting(true);
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const baseName = schema.templateFileName.replace('_TEMPLATE.xlsx', '');

      if (format === 'docx') {
        const fileName = `EXPORT_${baseName}_${dateStr}.docx`;
        await exportRecordsToDocx({
          schoolName,
          schema,
          records: targetRecords,
          selectedFieldKeys,
          templateCompatible,
          fileName,
        });
        if (onLogExport) {
          await onLogExport({
            id: `EXP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            moduleKey: schema.key,
            moduleTitle: schema.title,
            appId: schema.appId,
            format: 'docx',
            scope,
            rowCount: targetRecords.length,
            columnCount: selectedFieldKeys.length,
            fileName,
            actorName: currentUser.displayName,
            actorRole: currentUser.role,
            timestamp: new Date().toISOString(),
          });
        }
        onClose();
        return;
      }

      const ext = format === 'csv' ? 'csv' : 'xlsx';
      const fileName = `EXPORT_${baseName}_${dateStr}.${ext}`;
      const bytes = await exportRecordsToBuffer(schema, targetRecords, {
        format,
        scope,
        selectedFieldKeys,
        templateCompatible,
        fileName,
      });
      const mime =
        format === 'csv'
          ? 'text/csv;charset=utf-8;'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      triggerBinaryDownload(bytes, fileName, mime);

      if (onLogExport) {
        await onLogExport({
          id: `EXP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          moduleKey: schema.key,
          moduleTitle: schema.title,
          appId: schema.appId,
          format,
          scope,
          rowCount: targetRecords.length,
          columnCount: selectedFieldKeys.length,
          fileName,
          actorName: currentUser.displayName,
          actorRole: currentUser.role,
          timestamp: new Date().toISOString(),
        });
      }
      onClose();
    } finally {
      setIsExporting(false);
    }
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Xuất dữ liệu — ${schema.title}`}
      className="fixed inset-0 z-[10010] flex items-center justify-center p-2 sm:p-4 bg-slate-950/55 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90dvh] flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl border border-slate-200/80 dark:border-white/15 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid={`excel-export-dialog-${moduleKey}`}
      >
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200/70 dark:border-white/10 flex items-center justify-between gap-2.5 bg-slate-50/70 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
                Xuất dữ liệu — {schema.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
                Tải tệp Excel (.xlsx), Word (.docx) hoặc CSV trực tiếp về máy
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/60 cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
              1. Phạm vi bản ghi xuất
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border text-left transition-all cursor-pointer ${
                  scope === 'all'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10'
                }`}
              >
                <div>Tất cả</div>
                <div className="text-[11px] opacity-80 font-mono-tabular">{allRecords.length} bản ghi</div>
              </button>
              <button
                type="button"
                onClick={() => setScope('filtered')}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border text-left transition-all cursor-pointer ${
                  scope === 'filtered'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10'
                }`}
              >
                <div>Theo bộ lọc hiện tại</div>
                <div className="text-[11px] opacity-80 font-mono-tabular">{filteredRecords.length} bản ghi</div>
              </button>
              <button
                type="button"
                disabled={selectedRecords.length === 0}
                onClick={() => setScope('selected')}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border text-left transition-all disabled:opacity-45 cursor-pointer ${
                  scope === 'selected'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10'
                }`}
              >
                <div>Dòng đã chọn</div>
                <div className="text-[11px] opacity-80 font-mono-tabular">{selectedRecords.length} bản ghi</div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                2. Định dạng tệp tải về
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  data-testid="export-format-xlsx"
                  onClick={() => setFormat('xlsx')}
                  className={`py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                    format === 'xlsx'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10'
                  }`}
                >
                  Excel (.xlsx)
                </button>
                <button
                  type="button"
                  data-testid="export-format-docx"
                  onClick={() => setFormat('docx')}
                  className={`py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                    format === 'docx'
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10'
                  }`}
                >
                  Word (.docx)
                </button>
                <button
                  type="button"
                  data-testid="export-format-csv"
                  onClick={() => setFormat('csv')}
                  className={`py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                    format === 'csv'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10'
                  }`}
                >
                  CSV
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                3. Tương thích nhập lại
              </label>
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={templateCompatible}
                  onChange={(e) => setTemplateCompatible(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>Giữ tiêu đề cột chuẩn để có thể nhập lại</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Chọn cột dữ liệu ({selectedFieldKeys.length}/{exportableFields.length})
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedFieldKeys(exportableFields.map((f) => f.key))}
                  className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Chọn tất cả
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFieldKeys([])}
                  className="text-[11px] font-semibold text-slate-500 hover:underline cursor-pointer"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-white/10">
              {exportableFields.map((f) => {
                const checked = selectedFieldKeys.includes(f.key);
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => toggleField(f.key)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-all border cursor-pointer ${
                      checked
                        ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white border-blue-300 dark:border-blue-600/50'
                        : 'bg-transparent text-slate-500 border-transparent hover:bg-white/50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {checked ? (
                      <CheckSquare size={14} className="text-blue-600 shrink-0" />
                    ) : (
                      <Square size={14} className="text-slate-400 shrink-0" />
                    )}
                    <span className="truncate">{f.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 dark:border-white/10">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Sẽ xuất <strong>{targetRecords.length}</strong> bản ghi ·{' '}
              <strong>{selectedFieldKeys.length}</strong> cột
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isExporting || selectedFieldKeys.length === 0}
                onClick={handleExport}
                data-testid="btn-confirm-export"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <Download size={15} />
                <span>{isExporting ? 'Đang xuất...' : 'Tải tệp xuống ngay'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
