import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RefreshCw,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import type {
  ErrorPolicy,
  ImportExecutionResult,
  ImportHistoryRecord,
  ImportMode,
  ImportModuleKey,
  ImportPreviewReport,
  UserProfile,
} from '../../types';
import { getSchemaByKey } from '../../utils/importExport/schemas';
import {
  validateImportWorkbook,
  type ParsedWorkbookData,
  type ValidationDbContext,
} from '../../utils/importExport/validator';
import {
  generateErrorReportBuffer,
  generateTemplateWorkbookBuffer,
  parseUploadedSpreadsheet,
  triggerBinaryDownload,
} from '../../utils/importExport/excelEngine';
import { buildImportExecutionPlan } from '../../utils/importExport/processor';
import { parseWordDocxTable } from '../../utils/documentExporter';

interface ExcelImportDialogProps {
  isOpen: boolean;
  moduleKey: ImportModuleKey;
  context: ValidationDbContext;
  existingRecords: Record<string, unknown>[];
  currentUser: UserProfile;
  onClose: () => void;
  onCommitImport: (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord,
    extraSheets?: Record<string, Record<string, unknown>[]>
  ) => Promise<void> | void;
}

export const ExcelImportDialog: React.FC<ExcelImportDialogProps> = ({
  isOpen,
  moduleKey,
  context,
  existingRecords,
  currentUser,
  onClose,
  onCommitImport,
}) => {
  const schema = useMemo(() => getSchemaByKey(moduleKey), [moduleKey]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsedWorkbook, setParsedWorkbook] = useState<ParsedWorkbookData | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('only_add');
  const [errorPolicy, setErrorPolicy] = useState<ErrorPolicy>('only_valid');
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'errors'>('all');
  const [parseError, setParseError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [executionResult, setExecutionResult] = useState<ImportExecutionResult | null>(null);
  const [lastReportSnapshot, setLastReportSnapshot] = useState<ImportPreviewReport | null>(null);

  const previewReport: ImportPreviewReport | null = useMemo(() => {
    if (!parsedWorkbook) return null;
    return validateImportWorkbook(schema, parsedWorkbook, context, existingRecords, importMode);
  }, [parsedWorkbook, schema, context, existingRecords, importMode]);

  if (!isOpen) return null;

  const resetUpload = () => {
    setParsedWorkbook(null);
    setParseError(null);
    setExecutionResult(null);
    setLastReportSnapshot(null);
    setPreviewFilter('all');
  };

  const handleClose = () => {
    resetUpload();
    onClose();
  };

  const handleDownloadTemplate = async () => {
    setIsBusy(true);
    try {
      const bytes = await generateTemplateWorkbookBuffer(schema, context);
      triggerBinaryDownload(
        bytes,
        schema.templateFileName,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleFile = async (file: File) => {
    setParseError(null);
    setExecutionResult(null);
    setIsBusy(true);
    try {
      const isWord = file.name.toLowerCase().endsWith('.docx');
      const parsed = isWord
        ? await parseWordDocxTable(file)
        : await parseUploadedSpreadsheet(file);
      setParsedWorkbook(parsed);
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : 'Không thể đọc tệp Word (.docx) hoặc Excel/CSV.'
      );
      setParsedWorkbook(null);
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmCommit = async () => {
    if (!previewReport) return;
    setIsBusy(true);
    try {
      const plan = buildImportExecutionPlan({
        report: previewReport,
        mode: importMode,
        errorPolicy,
        context,
        existingRecords,
        extra: {
          actorName: currentUser.displayName,
          actorRole: currentUser.role,
          gradeWeights: context.systemSettings?.gradeWeights,
          extraSheets: previewReport.extraSheetRows,
        },
      });
      setLastReportSnapshot(previewReport);
      if (!plan.result.aborted && plan.entitiesToSave.length > 0) {
        await onCommitImport(
          moduleKey,
          plan.entitiesToSave,
          plan.historyRecord,
          previewReport.extraSheetRows
        );
      }
      setExecutionResult(plan.result);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDownloadErrorReport = async () => {
    const target = lastReportSnapshot || previewReport;
    if (!target) return;
    const bytes = await generateErrorReportBuffer(target);
    triggerBinaryDownload(
      bytes,
      `BAO_CAO_LOI_${schema.key.toUpperCase()}_${new Date().toISOString().split('T')[0]}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  };

  const validTotal = previewReport
    ? previewReport.validCreateCount + previewReport.validUpdateCount
    : 0;
  const errorTotal = previewReport
    ? previewReport.invalidCount + previewReport.duplicateCount
    : 0;

  const canConfirmImport =
    Boolean(previewReport) &&
    previewReport!.headerErrors.length === 0 &&
    validTotal > 0 &&
    !(errorPolicy === 'abort_on_error' && errorTotal > 0);

  const filteredRows = (previewReport?.rows || []).filter((r) => {
    if (previewFilter === 'valid') return r.status === 'valid_create' || r.status === 'valid_update';
    if (previewFilter === 'errors') return r.status === 'invalid' || r.status === 'duplicate';
    return true;
  });

  const displayFields = schema.fields.slice(0, 6);

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Nhập dữ liệu — ${schema.title}`}
      className="fixed inset-0 z-[10010] flex items-center justify-center p-2 sm:p-4 bg-slate-950/55 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-5xl max-h-[90dvh] flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl border border-slate-200/80 dark:border-white/15 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid={`excel-import-dialog-${moduleKey}`}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200/70 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-2.5 bg-slate-50/70 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-start sm:items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <FileSpreadsheet size={18} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
                  Nhập dữ liệu — {schema.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
                  Hỗ trợ Excel (.xlsx, .xls, .csv) và Word (.docx) · Dữ liệu hiện tại luôn được bảo toàn
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Đóng cửa sổ"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/60 cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {schema.migrationWarning && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/25 border border-amber-200 dark:border-amber-700/50 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{schema.migrationWarning}</span>
                </div>
              )}

              {schema.key === 'announcements' && (
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/25 border border-blue-200 dark:border-blue-700/50 flex items-start gap-2.5 text-xs text-blue-800 dark:text-blue-300">
                  <ShieldCheck size={16} className="shrink-0 mt-0.5" />
                  <span>
                    Thông báo nhập từ tệp mặc định lưu ở trạng thái <strong>Nháp (draft)</strong> để tránh gửi thông báo hàng loạt ngoài ý muốn.
                  </span>
                </div>
              )}

              {/* STEP 7 RESULT SCREEN */}
              {executionResult ? (
                <div className="space-y-4" data-testid="import-result-panel">
                  <div
                    className={`p-5 rounded-2xl border ${
                      executionResult.aborted
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40'
                        : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {executionResult.aborted ? (
                        <AlertCircle size={22} className="text-red-600 dark:text-red-400 shrink-0" />
                      ) : (
                        <CheckCircle2 size={22} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                      )}
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {executionResult.aborted
                            ? 'Đã hủy nhập dữ liệu theo chính sách an toàn'
                            : 'Hoàn tất nhập dữ liệu vào hệ thống'}
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          Tệp: <span className="font-semibold">{executionResult.fileName}</span> · Đã ghi Lịch sử Import & Audit Log.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                      <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-white/10">
                        <div className="text-[11px] text-slate-500">Thêm mới</div>
                        <div className="text-lg font-bold font-mono-tabular text-emerald-600">
                          {executionResult.createdCount}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-white/10">
                        <div className="text-[11px] text-slate-500">Cập nhật</div>
                        <div className="text-lg font-bold font-mono-tabular text-blue-600">
                          {executionResult.updatedCount}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-white/10">
                        <div className="text-[11px] text-slate-500">Lỗi / Trùng</div>
                        <div className="text-lg font-bold font-mono-tabular text-red-600">
                          {executionResult.failedCount}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-white/10">
                        <div className="text-[11px] text-slate-500">Bỏ qua</div>
                        <div className="text-lg font-bold font-mono-tabular text-slate-600 dark:text-slate-300">
                          {executionResult.skippedCount}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {executionResult.issues.length > 0 && (
                        <button
                          type="button"
                          onClick={handleDownloadErrorReport}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all cursor-pointer"
                        >
                          <Download size={14} />
                          <span>Tải báo cáo lỗi (.xlsx)</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={resetUpload}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                      >
                        <RefreshCw size={14} />
                        <span>Nhập tệp khác</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              ) : !previewReport ? (
                /* STEPS 1 - 3: TEMPLATE & UPLOAD */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        Tải tệp mẫu chuẩn &amp; Điền dữ liệu
                      </span>
                      <span className="text-[11px] font-mono-tabular text-slate-500">v{schema.version}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      File mẫu Excel gồm sheet <strong>DATA</strong> (đánh dấu <span className="text-red-500 font-bold">*</span> các cột bắt buộc), sheet <strong>HUONG_DAN</strong> và danh mục thả xuống. Nếu dùng Word (<strong>.docx</strong>), hãy đặt bảng dữ liệu có hàng tiêu đề cột khớp chuẩn bên dưới.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {schema.fields.slice(0, 8).map((f) => (
                        <span
                          key={f.key}
                          className={`px-2 py-0.5 rounded-md text-[11px] border ${
                            f.required
                              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700/40 font-semibold'
                              : 'bg-white/70 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
                          }`}
                        >
                          {f.header}
                        </span>
                      ))}
                      {schema.fields.length > 8 && (
                        <span className="px-2 py-0.5 text-[11px] text-slate-500">
                          +{schema.fields.length - 8} cột
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      disabled={isBusy}
                      data-testid="dialog-download-template"
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-white border border-slate-300/80 dark:border-white/15 text-xs font-bold transition-all cursor-pointer"
                    >
                      <Download size={15} className="text-emerald-600" />
                      <span>Tải tệp mẫu ({schema.templateFileName})</span>
                    </button>
                  </div>

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) handleFile(f);
                    }}
                    className={`p-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center gap-3 transition-all ${
                      isDragging
                        ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-900/20'
                        : 'border-slate-300 dark:border-white/15 bg-slate-50/50 dark:bg-slate-800/30'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Upload size={20} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-white">
                        Chọn tệp Excel (.xlsx, .xls, .csv) hoặc Word (.docx)
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Kéo thả file vào đây hoặc chọn từ máy tính để xem trước &amp; kiểm tra lỗi
                      </p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv,.docx"
                      className="hidden"
                      data-testid="excel-file-input"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFile(f);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                    >
                      {isBusy ? 'Đang đọc tệp...' : 'Chọn tệp từ máy tính'}
                    </button>
                    {parseError && (
                      <p className="text-xs text-red-600 dark:text-red-400 font-medium">{parseError}</p>
                    )}
                  </div>
                </div>
              ) : (
                /* STEPS 4 - 6: VALIDATION & PREVIEW */
                <div className="space-y-4" data-testid="import-preview-panel">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-white/10">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Chế độ xử lý bản ghi trùng khóa
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setImportMode('only_add')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            importMode === 'only_add'
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                          }`}
                        >
                          Chỉ thêm mới (Mặc định)
                        </button>
                        {schema.allowUpdate && (
                          <button
                            type="button"
                            onClick={() => setImportMode('update_existing')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                              importMode === 'update_existing'
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                            }`}
                          >
                            Cập nhật bản ghi hiện có (Ô trống giữ nguyên)
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Chính sách khi có dòng lỗi
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setErrorPolicy('only_valid')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            errorPolicy === 'only_valid'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                          }`}
                        >
                          Bỏ qua dòng lỗi, nhập dòng hợp lệ
                        </button>
                        <button
                          type="button"
                          onClick={() => setErrorPolicy('abort_on_error')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            errorPolicy === 'abort_on_error'
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                          }`}
                        >
                          Hủy toàn bộ nếu có lỗi
                        </button>
                      </div>
                    </div>
                  </div>

                  {previewReport.headerErrors.length > 0 && (
                    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/25 border border-red-200 dark:border-red-700/50 text-xs text-red-700 dark:text-red-300 space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertCircle size={15} /> Cấu trúc tệp chưa khớp mẫu chuẩn:
                      </div>
                      {previewReport.headerErrors.map((err, i) => (
                        <div key={i}>• {err}</div>
                      ))}
                    </div>
                  )}

                  {previewReport.unrecognizedHeaders.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 text-xs text-amber-800 dark:text-amber-300">
                      Cột không thuộc schema sẽ được bỏ qua: {previewReport.unrecognizedHeaders.join(', ')}
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-white/10">
                      <div className="text-[11px] text-slate-500">Tổng số dòng</div>
                      <div className="text-lg font-bold font-mono-tabular text-slate-900 dark:text-white">
                        {previewReport.totalRows}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-900/20 border border-emerald-200/70 dark:border-emerald-700/30">
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-300">Hợp lệ sẵn sàng nhập</div>
                      <div className="text-lg font-bold font-mono-tabular text-emerald-700 dark:text-emerald-300">
                        {validTotal}
                        {previewReport.validUpdateCount > 0 && (
                          <span className="text-xs font-normal ml-1">
                            ({previewReport.validCreateCount} mới · {previewReport.validUpdateCount} cập nhật)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-red-50/70 dark:bg-red-900/20 border border-red-200/70 dark:border-red-700/30">
                      <div className="text-[11px] text-red-700 dark:text-red-300">Lỗi định dạng / nghiệp vụ</div>
                      <div className="text-lg font-bold font-mono-tabular text-red-700 dark:text-red-300">
                        {previewReport.invalidCount}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-900/20 border border-amber-200/70 dark:border-amber-700/30">
                      <div className="text-[11px] text-amber-700 dark:text-amber-300">Trùng lặp</div>
                      <div className="text-lg font-bold font-mono-tabular text-amber-700 dark:text-amber-300">
                        {previewReport.duplicateCount}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {(
                        [
                          { id: 'all', label: `Tất cả (${previewReport.totalRows})` },
                          { id: 'valid', label: `Hợp lệ (${validTotal})` },
                          { id: 'errors', label: `Lỗi & Trùng (${errorTotal})` },
                        ] as const
                      ).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setPreviewFilter(t.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            previewFilter === t.id
                              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      {errorTotal > 0 && (
                        <button
                          type="button"
                          onClick={handleDownloadErrorReport}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/40 text-xs font-semibold cursor-pointer"
                        >
                          <Download size={13} /> Tải file lỗi
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={resetUpload}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                      >
                        Chọn tệp khác
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200/80 dark:border-white/10 overflow-x-auto max-h-64">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 font-bold">Dòng</th>
                          <th className="px-3 py-2 font-bold">Trạng thái</th>
                          {displayFields.map((f) => (
                            <th key={f.key} className="px-3 py-2 font-bold whitespace-nowrap">
                              {f.label}
                            </th>
                          ))}
                          <th className="px-3 py-2 font-bold">Chi tiết kiểm tra / Thay đổi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70 dark:divide-white/5">
                        {filteredRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={displayFields.length + 3}
                              className="px-4 py-8 text-center text-slate-400"
                            >
                              Không có dòng dữ liệu nào trong bộ lọc này.
                            </td>
                          </tr>
                        ) : (
                          filteredRows.slice(0, 100).map((row) => {
                            const badgeMap = {
                              valid_create: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                              valid_update: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
                              duplicate: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
                              invalid: 'bg-red-500/15 text-red-700 dark:text-red-300',
                              skipped: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
                            };
                            const labelMap = {
                              valid_create: 'Thêm mới',
                              valid_update: 'Cập nhật',
                              duplicate: 'Trùng lặp',
                              invalid: 'Lỗi',
                              skipped: 'Bỏ qua',
                            };
                            return (
                              <tr key={row.rowNumber} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                                <td className="px-3 py-2 font-mono-tabular text-slate-500">{row.rowNumber}</td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${badgeMap[row.status]}`}>
                                    {labelMap[row.status]}
                                  </span>
                                </td>
                                {displayFields.map((f) => (
                                  <td key={f.key} className="px-3 py-2 max-w-[160px] truncate text-slate-800 dark:text-slate-200">
                                    {String(row.normalizedData[f.key] ?? '')}
                                  </td>
                                ))}
                                <td className="px-3 py-2 min-w-[220px]">
                                  {row.issues.length > 0 ? (
                                    <div className="space-y-0.5">
                                      {row.issues.map((iss, idx) => (
                                        <div
                                          key={idx}
                                          className={`text-[11px] ${
                                            iss.severity === 'error'
                                              ? 'text-red-600 dark:text-red-400'
                                              : 'text-amber-600 dark:text-amber-400'
                                          }`}
                                        >
                                          • {iss.message}
                                        </div>
                                      ))}
                                    </div>
                                  ) : row.diffs && row.diffs.length > 0 ? (
                                    <div className="text-[11px] text-blue-600 dark:text-blue-400 space-y-0.5">
                                      {row.diffs.slice(0, 3).map((d, idx) => (
                                        <div key={idx}>
                                          {d.label}: <span className="line-through opacity-60">{d.before}</span> →{' '}
                                          <span className="font-semibold">{d.after}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                                      Hợp lệ
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 dark:border-white/10">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {errorPolicy === 'abort_on_error' && errorTotal > 0
                        ? 'Đang bật chế độ "Hủy toàn bộ nếu có lỗi" — sửa tệp hoặc chuyển chính sách để nhập dòng hợp lệ.'
                        : `Sẵn sàng ghi ${validTotal} bản ghi hợp lệ vào database.`}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleClose}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        disabled={!canConfirmImport || isBusy}
                        onClick={handleConfirmCommit}
                        data-testid="btn-confirm-import"
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all cursor-pointer"
                      >
                        <CheckCircle2 size={15} />
                        <span>
                          {isBusy ? 'Đang lưu...' : `Xác nhận nhập ${validTotal} bản ghi hợp lệ`}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
