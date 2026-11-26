import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Upload,
  X,
} from '../icons/UiIcons';
import type {
  DataSourceConfig,
  DataSourceGroupKey,
  DataSourceMethod,
} from '../../types';
import {
  DATA_SOURCE_GROUP_SPECS,
  applySourceConfiguration,
  createConfigDocId,
} from '../../utils/dataSources/groupSpecs';
import {
  type DataSourceExistingData,
  type DataSourceRuntimeContext,
  type GroupValidationResult,
  buildGroupTemplatePlan,
  generateGroupWorkbookBuffer,
  parseExcelWorkbookToGroupTabs,
  validateAndNormalizeGroupData,
} from '../../utils/dataSources/templateEngine';

interface DataSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupKey: DataSourceGroupKey;
  allConfigs: DataSourceConfig[];
  runtimeContext: DataSourceRuntimeContext;
  existingData: DataSourceExistingData;
  currentUserEmail?: string;
  currentUserName: string;
  onSaveConfig: (config: DataSourceConfig) => Promise<void>;
  onDeleteConfig?: (id: string) => Promise<void>;
  onCommitNormalizedGroupData: (
    groupKey: DataSourceGroupKey,
    validation: GroupValidationResult,
    sourceMeta: { method: DataSourceMethod; sourceName: string }
  ) => Promise<{ createdCount: number; updatedCount: number }>;
}

function formatDateTimeVi(iso?: string): string {
  if (!iso) return 'Chưa đồng bộ';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Chưa đồng bộ';
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function statusLabel(status?: DataSourceConfig['status']): {
  label: string;
  textClass: string;
} {
  switch (status) {
    case 'synced':
    case 'connected':
      return { label: 'Đã đồng bộ', textClass: 'text-emerald-600 dark:text-emerald-400' };
    case 'syncing':
      return { label: 'Đang đồng bộ', textClass: 'text-amber-600 dark:text-amber-400' };
    case 'error':
      return { label: 'Có lỗi', textClass: 'text-rose-600 dark:text-rose-400' };
    default:
      return { label: 'Chưa thiết lập', textClass: 'text-slate-500 dark:text-slate-400' };
  }
}

export const DataSourceModal: React.FC<DataSourceModalProps> = ({
  isOpen,
  onClose,
  groupKey,
  allConfigs,
  runtimeContext,
  existingData,
  currentUserName,
  onSaveConfig,
  onDeleteConfig,
  onCommitNormalizedGroupData,
}) => {
  const spec = DATA_SOURCE_GROUP_SPECS[groupKey];
  const existingConfig = useMemo(
    () => allConfigs.find((c) => c.groupKey === groupKey),
    [allConfigs, groupKey]
  );

  const [isBusy, setIsBusy] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [excelValidation, setExcelValidation] = useState<{
    fileName: string;
    result: GroupValidationResult;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStatusFeedback(null);
    setExcelValidation(null);
  }, [isOpen, groupKey]);

  if (!isOpen) return null;

  const isConfigured = Boolean(existingConfig && existingConfig.status !== 'unconfigured');

  const handleDownloadTemplate = async () => {
    setIsBusy(true);
    setStatusFeedback(null);
    try {
      const bytes = await generateGroupWorkbookBuffer(groupKey, runtimeContext, existingData);
      const blob = new Blob([bytes.buffer as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${spec.defaultFileName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusFeedback({
        type: 'success',
        message: `Đã tải tệp mẫu ${spec.defaultFileName}.xlsx kèm danh sách Sheet tab và Drop-down list.`,
      });
    } catch (err) {
      setStatusFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Không thể tạo tệp mẫu Excel.',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleExcelFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsBusy(true);
    setStatusFeedback(null);
    setExcelValidation(null);
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseExcelWorkbookToGroupTabs(buf, file.name);
      const validation = validateAndNormalizeGroupData(
        groupKey,
        parsed.tabs,
        runtimeContext,
        existingData
      );
      setExcelValidation({ fileName: file.name, result: validation });
      if (!validation.valid) {
        setStatusFeedback({
          type: 'error',
          message: `Phát hiện ${validation.summary.errorCount} lỗi dữ liệu trong tệp ${file.name}. Vui lòng kiểm tra và sửa lại.`,
        });
      }
    } catch (err) {
      setStatusFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Không thể đọc tệp Excel (.xlsx).',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleCommitExcel = async () => {
    if (!excelValidation || !excelValidation.result.valid) return;
    setIsBusy(true);
    setStatusFeedback(null);
    try {
      const commitRes = await onCommitNormalizedGroupData(groupKey, excelValidation.result, {
        method: 'excel',
        sourceName: excelValidation.fileName,
      });

      const plan = buildGroupTemplatePlan(groupKey, runtimeContext, existingData);
      const colStructure: Record<string, string[]> = {};
      plan.dataTabs.forEach((t) => {
        colStructure[t.tabName] = t.columns.map((c) => c.header);
      });

      const { savedConfig } = applySourceConfiguration(allConfigs, {
        groupKey,
        activeMethod: 'excel',
        sourceName: excelValidation.fileName,
        sheetTabs: plan.dataTabs.map((t) => t.tabName),
        columnStructure: colStructure,
        syncMode: 'manual',
        syncIntervalMinutes: 15,
        status: 'synced',
        lastSyncAt: new Date().toISOString(),
        lastSyncMessage: `Thêm mới ${commitRes.createdCount}, cập nhật ${commitRes.updatedCount}`,
        lastRowCount: excelValidation.result.summary.validRows,
        lastCreatedCount: commitRes.createdCount,
        lastUpdatedCount: commitRes.updatedCount,
        configuredBy: currentUserName,
      });

      await onSaveConfig(savedConfig);
      setExcelValidation(null);
      setStatusFeedback({
        type: 'success',
        message: `Đã đồng bộ từ ${excelValidation.fileName} (Thêm ${commitRes.createdCount}, cập nhật ${commitRes.updatedCount}).`,
      });
    } catch (err) {
      setStatusFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Lỗi lưu dữ liệu từ Excel.',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleDisconnectSource = async () => {
    if (!existingConfig || !onDeleteConfig) return;
    setIsBusy(true);
    try {
      await onDeleteConfig(existingConfig.id || createConfigDocId(groupKey));
      setStatusFeedback({
        type: 'info',
        message: 'Đã xóa thông tin tệp Excel đã liên kết. Dữ liệu hiện có trong SchoolHub vẫn được giữ nguyên.',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const statusMeta = statusLabel(existingConfig?.status);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="data-source-modal-title"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleExcelFileSelected}
        className="hidden"
      />

      <div className="w-full max-w-xl rounded-[26px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
          <div>
            <h2
              id="data-source-modal-title"
              className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Nguồn dữ liệu Excel · {spec.title}</span>
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              {spec.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {statusFeedback && (
            <div
              className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs ${
                statusFeedback.type === 'error'
                  ? 'bg-rose-50/90 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                  : statusFeedback.type === 'success'
                    ? 'bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                    : 'glass-subsurface text-slate-700 dark:text-slate-300'
              }`}
            >
              {statusFeedback.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{statusFeedback.message}</span>
            </div>
          )}

          {/* CONFIGURED EXCEL SUMMARY */}
          {isConfigured && existingConfig && (
            <div
              data-testid="configured-source-card"
              className="rounded-xl glass-subsurface p-4 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Tên tệp Excel gần nhất</div>
                  <div className="mt-1 font-semibold text-slate-900 dark:text-white truncate">
                    {existingConfig.sourceName}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500 dark:text-slate-400">Phương thức</div>
                  <div className="mt-1 font-semibold text-slate-900 dark:text-white">
                    Excel (.xlsx)
                  </div>
                </div>

                <div>
                  <div className="text-slate-500 dark:text-slate-400">Trạng thái</div>
                  <div className={`mt-1 font-semibold ${statusMeta.textClass}`}>
                    {statusMeta.label}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500 dark:text-slate-400">Thời điểm đồng bộ gần nhất</div>
                  <div className="mt-1 font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                    {formatDateTimeVi(existingConfig.lastSyncAt)}
                  </div>
                </div>
              </div>

              {existingConfig.lastError && (
                <div className="text-xs text-rose-700 dark:text-rose-300 glass-subsurface bg-rose-500/12 border-rose-400/40 rounded-lg px-3 py-2">
                  {existingConfig.lastError}
                </div>
              )}

              <div className="pt-2.5 border-t border-white/35 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isBusy}
                    data-testid="sync-now-btn"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
                    <span>Nhập tệp .xlsx mới</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    disabled={isBusy}
                    data-testid="download-template-btn"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl glass-subsurface text-slate-700 dark:text-slate-200 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải mẫu Excel (.xlsx)</span>
                  </button>
                </div>

                {onDeleteConfig && (
                  <button
                    type="button"
                    onClick={handleDisconnectSource}
                    disabled={isBusy}
                    className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    Đặt lại nguồn
                  </button>
                )}
              </div>
            </div>
          )}

          {/* GUIDE & EXCEL UPLOAD SETUP */}
          {!isConfigured && (
            <div className="space-y-4">
              <div className="rounded-xl glass-subsurface p-3.5 space-y-1.5">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Cấu trúc mẫu Excel chuẩn · {spec.title}
                </div>
                <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1 list-disc pl-4">
                  {spec.guideSteps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3 rounded-xl glass-subsurface p-4">
                <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Tải mẫu &amp; Nhập dữ liệu Excel (.xlsx)</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Tệp mẫu bao gồm các Sheet tab được phân tách rõ ràng cùng Drop-down list sẵn có cho các cột phân loại.
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    disabled={isBusy}
                    data-testid="download-template-btn"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl glass-subsurface text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>Tải tệp mẫu chuẩn (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isBusy}
                    data-testid="upload-excel-btn"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Chọn tệp .xlsx để kiểm tra</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* EXCEL VALIDATION & COMMIT PREVIEW */}
          {excelValidation && (
            <div
              data-testid="excel-validation-preview"
              className="rounded-xl glass-subsurface p-4 space-y-3"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-900 dark:text-white truncate">
                  Kiểm tra tệp: {excelValidation.fileName}
                </span>
                <span className="tabular-nums text-slate-600 dark:text-slate-300 shrink-0">
                  {excelValidation.result.summary.validRows}/{excelValidation.result.summary.totalRows} dòng hợp lệ
                </span>
              </div>

              {excelValidation.result.issues.length > 0 ? (
                <div className="max-h-40 overflow-y-auto rounded-lg glass-subsurface bg-rose-500/10 border-rose-400/40 p-2.5 space-y-1.5 text-xs">
                  {excelValidation.result.issues.slice(0, 20).map((issue, idx) => (
                    <div key={idx} className="text-rose-700 dark:text-rose-300">
                      <strong>
                        {issue.sheetName} · Dòng {issue.rowNumber} ({issue.header}):
                      </strong>{' '}
                      {issue.message}
                    </div>
                  ))}
                  {excelValidation.result.issues.length > 20 && (
                    <div className="text-rose-600 dark:text-rose-300 font-medium">
                      Và {excelValidation.result.issues.length - 20} lỗi khác...
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-emerald-700 dark:text-emerald-300 glass-subsurface bg-emerald-500/10 border-emerald-400/40 rounded-lg px-3 py-2">
                  Dữ liệu hợp lệ: thêm mới {excelValidation.result.summary.createCount}, cập nhật{' '}
                  {excelValidation.result.summary.updateCount}. Dữ liệu cũ không nằm trong tệp được giữ nguyên.
                </div>
              )}

              {excelValidation.result.autoClassesToCreate &&
                excelValidation.result.autoClassesToCreate.length > 0 && (
                  <div
                    data-testid="ds-auto-classes-banner"
                    className="rounded-lg glass-subsurface bg-sky-500/12 border-sky-400/40 px-3 py-2 text-xs text-sky-800 dark:text-sky-200"
                  >
                    Tự động khởi tạo{' '}
                    <strong>{excelValidation.result.autoClassesToCreate.length} lớp mới</strong>{' '}
                    trên web:{' '}
                    <span className="font-mono font-semibold">
                      {excelValidation.result.autoClassesToCreate.join(', ')}
                    </span>
                  </div>
                )}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setExcelValidation(null)}
                  className="px-3 py-1.5 rounded-lg glass-subsurface text-xs text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Hủy
                </button>
                {excelValidation.result.valid && (
                  <button
                    type="button"
                    data-testid="commit-excel-btn"
                    onClick={handleCommitExcel}
                    disabled={isBusy}
                    className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium cursor-pointer"
                  >
                    {isBusy ? 'Đang lưu...' : 'Xác nhận nhập & lưu nguồn Excel'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
