import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  Globe,
  RefreshCw,
  Upload,
} from '../icons/UiIcons';
import type {
  AcademicYearConfig,
  ExportHistoryRecord,
  FacilityActivityLog,
  FacilityAsset,
  SchoolClass,
  SchoolRoom,
  SystemSettings,
  UserProfile,
} from '../../types';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import {
  parseUploadedSpreadsheet,
  triggerBinaryDownload,
} from '../../utils/importExport/excelEngine';
import {
  buildFacilitiesGoogleSheetsTsv,
  createFacilityActivityLog,
  filterClassesForFacilities,
  filterFacilitiesByScope,
  generateClassFacilitiesWorkbookBuffer,
  parseAndValidateClassFacilitiesWorkbook,
  parseDelimitedSpreadsheetText,
  parseGoogleSheetsUrlToCsvUrl,
  type ClassFacilityImportPreview,
} from '../../utils/facilitiesEngine';

interface ClassFacilitiesExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  academicYears: AcademicYearConfig[];
  selectedAcademicYear: string;
  selectedGrade: string;
  selectedClassId: string;
  classes: SchoolClass[];
  rooms: SchoolRoom[];
  facilities: FacilityAsset[];
  systemSettings?: SystemSettings;
  canEdit: boolean;
  onCommitBatch: (entities: FacilityAsset[]) => Promise<void>;
  onLogFacilityActivity?: (entry: FacilityActivityLog) => Promise<void>;
  onLogExport?: (record: ExportHistoryRecord) => Promise<void> | void;
}

export const ClassFacilitiesExcelModal: React.FC<ClassFacilitiesExcelModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  academicYears,
  selectedAcademicYear,
  selectedGrade,
  selectedClassId,
  classes,
  rooms,
  facilities,
  systemSettings,
  canEdit,
  onCommitBatch,
  onLogFacilityActivity,
  onLogExport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [modeTab, setModeTab] = useState<'import' | 'export'>(canEdit ? 'import' : 'export');
  const [exportScope, setExportScope] = useState<'all' | 'grade' | 'class'>(
    selectedClassId && selectedClassId !== 'all'
      ? 'class'
      : selectedGrade && selectedGrade !== 'all'
      ? 'grade'
      : 'all'
  );
  const [yearScope, setYearScope] = useState<string>(selectedAcademicYear || '2026 - 2027');
  const [gradeScope, setGradeScope] = useState<string>(selectedGrade === 'all' ? '10' : selectedGrade);
  const [classScopeId, setClassScopeId] = useState<string>(
    selectedClassId && selectedClassId !== 'all' ? selectedClassId : classes.find((c) => c.status !== 'inactive')?.id || ''
  );

  const [fallbackClassId, setFallbackClassId] = useState<string>(
    selectedClassId && selectedClassId !== 'all' ? selectedClassId : ''
  );
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [preview, setPreview] = useState<ClassFacilityImportPreview | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const activeClasses = useMemo(
    () =>
      filterClassesForFacilities({
        classes,
        academicYear: yearScope === 'all' ? undefined : yearScope,
        includeInactive: false,
      }),
    [classes, yearScope]
  );

  const availableGrades = useMemo(() => {
    const gSet = new Set<number>();
    activeClasses.forEach((c) => gSet.add(c.grade));
    if (gSet.size === 0) [10, 11, 12].forEach((g) => gSet.add(g));
    return Array.from(gSet).sort((a, b) => a - b);
  }, [activeClasses]);

  const scopedExportFacilities = useMemo(
    () =>
      filterFacilitiesByScope({
        facilities,
        classes,
        academicYear: yearScope,
        grade: exportScope === 'grade' ? gradeScope : 'all',
        classId: exportScope === 'class' ? classScopeId : 'all',
      }),
    [facilities, classes, yearScope, exportScope, gradeScope, classScopeId]
  );

  const handleDownloadWorkbook = async (templateMode: boolean) => {
    setIsBusy(true);
    setStatusMessage(null);
    try {
      const bytes = await generateClassFacilitiesWorkbookBuffer({
        classes,
        facilities,
        rooms,
        academicYear: yearScope,
        systemSettings,
        scope: templateMode ? 'all' : exportScope,
        grade: Number(gradeScope) || undefined,
        classId: classScopeId || undefined,
        templateMode,
      });
      const fileSlug = templateMode
        ? `Mau_ThietBi_TheoLop_${yearScope.replace(/\s+/g, '')}.xlsx`
        : exportScope === 'class'
        ? `ThietBi_Lop_${classes.find((c) => c.id === classScopeId)?.name || 'Lop'}.xlsx`
        : exportScope === 'grade'
        ? `ThietBi_Khoi_${gradeScope}.xlsx`
        : `ThietBi_ToanTruong_${yearScope.replace(/\s+/g, '')}.xlsx`;
      triggerBinaryDownload(
        bytes,
        fileSlug,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      if (!templateMode && onLogExport) {
        await onLogExport({
          id: `EXP-FAC-${Date.now()}`,
          moduleKey: 'facilities',
          moduleTitle: 'Cơ sở vật chất theo lớp',
          appId: 'facilities',
          format: 'xlsx',
          scope: exportScope === 'all' ? 'all' : 'filtered',
          rowCount: scopedExportFacilities.length,
          columnCount: 13,
          fileName: fileSlug,
          actorName: currentUser.displayName,
          actorRole: currentUser.role,
          timestamp: new Date().toISOString(),
        });
      }
      setStatusMessage({
        type: 'success',
        text: templateMode
          ? `Đã tải file mẫu (${activeClasses.length} sheet lớp đang hoạt động + HUONG_DAN + DANH_MUC).`
          : `Đã xuất ${scopedExportFacilities.length} thiết bị ra file Excel.`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể tạo file Excel.',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleCopyGoogleSheetsTsv = async () => {
    const tsv = buildFacilitiesGoogleSheetsTsv(scopedExportFacilities, classes);
    try {
      await navigator.clipboard.writeText(tsv);
      setStatusMessage({
        type: 'success',
        text: `Đã sao chép ${scopedExportFacilities.length} dòng chuẩn Google Sheets — dán (Ctrl+V) trực tiếp vào bảng tính.`,
      });
    } catch {
      const bytes = new TextEncoder().encode('\uFEFF' + tsv);
      triggerBinaryDownload(bytes, 'ThietBi_GoogleSheets.tsv', 'text/tab-separated-values;charset=utf-8');
      setStatusMessage({
        type: 'success',
        text: 'Đã tải tệp TSV tương thích để mở trực tiếp bằng Google Sheets.',
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsBusy(true);
    setStatusMessage(null);
    try {
      const parsed = await parseUploadedSpreadsheet(file);
      const nextPreview = parseAndValidateClassFacilitiesWorkbook({
        parsedWorkbook: parsed,
        classes,
        existingFacilities: facilities,
        rooms,
        targetAcademicYear: yearScope,
        fallbackClassId: fallbackClassId || undefined,
      });
      setPreview(nextPreview);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không đọc được tệp bảng tính.',
      });
    } finally {
      setIsBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFetchGoogleSheet = async () => {
    const csvUrl = parseGoogleSheetsUrlToCsvUrl(googleSheetUrl);
    if (!csvUrl) {
      setStatusMessage({
        type: 'error',
        text: 'Liên kết Google Sheets chưa đúng định dạng (cần link chia sẻ công khai docs.google.com/spreadsheets/d/...).',
      });
      return;
    }
    setIsBusy(true);
    setStatusMessage(null);
    try {
      const res = await fetch(csvUrl);
      if (!res.ok) {
        throw new Error(`Không tải được dữ liệu (HTTP ${res.status}). Hãy bật chia sẻ "Bất kỳ ai có đường liên kết đều có thể xem".`);
      }
      const csvText = await res.text();
      if (/<!doctype html|<html/i.test(csvText.slice(0, 200))) {
        throw new Error('Trang Google Sheets chưa mở quyền xem công khai hoặc yêu cầu đăng nhập.');
      }
      const parsed = parseDelimitedSpreadsheetText(csvText, 'GoogleSheets');
      const nextPreview = parseAndValidateClassFacilitiesWorkbook({
        parsedWorkbook: parsed,
        classes,
        existingFacilities: facilities,
        rooms,
        targetAcademicYear: yearScope,
        fallbackClassId: fallbackClassId || undefined,
      });
      setPreview(nextPreview);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể đọc Google Sheets từ URL.',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleParsePastedText = () => {
    if (!pastedText.trim()) return;
    setStatusMessage(null);
    const parsed = parseDelimitedSpreadsheetText(pastedText, 'GoogleSheets');
    const nextPreview = parseAndValidateClassFacilitiesWorkbook({
      parsedWorkbook: parsed,
      classes,
      existingFacilities: facilities,
      rooms,
      targetAcademicYear: yearScope,
      fallbackClassId: fallbackClassId || undefined,
    });
    setPreview(nextPreview);
  };

  const handleConfirmImport = async () => {
    if (!preview || preview.entitiesToSave.length === 0) return;
    setIsBusy(true);
    setStatusMessage(null);
    try {
      await onCommitBatch(preview.entitiesToSave);
      if (onLogFacilityActivity) {
        const entry = createFacilityActivityLog({
          logType: 'equipment_update',
          summary: `Nhập ${preview.entitiesToSave.length} thiết bị (${preview.validCreateCount} mới, ${preview.validUpdateCount} cập nhật) cho ${preview.matchedSheets.length} lớp`,
          actorName: currentUser.displayName,
          actorRole: currentUser.role,
          details: preview.matchedSheets.join(', '),
        });
        await onLogFacilityActivity(entry);
      }
      setStatusMessage({
        type: 'success',
        text: `Đã đồng bộ an toàn ${preview.entitiesToSave.length} thiết bị (${preview.validCreateCount} thêm mới, ${preview.validUpdateCount} cập nhật).`,
      });
      setPreview(null);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi khi lưu dữ liệu vào SchoolHub.',
      });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nhập / Xuất Thiết bị theo lớp (Excel & Google Sheets)"
      description="Tự động khớp năm học và danh sách lớp thực tế · Chỉ cập nhật đúng thiết bị của đúng lớp."
      maxWidth="4xl"
    >
      <div className="space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-700/70">
          <div className="inline-flex rounded-xl p-1 glass-subsurface gap-1">
            {canEdit && (
              <button
                type="button"
                onClick={() => setModeTab('import')}
                className={`px-3.5 py-1.5 rounded-lg font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  modeTab === 'import'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60'
                }`}
              >
                Nhập Excel / Google Sheets
              </button>
            )}
            <button
              type="button"
              onClick={() => setModeTab('export')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-colors cursor-pointer whitespace-nowrap ${
                modeTab === 'export'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60'
              }`}
            >
              Tải mẫu & Xuất theo Lớp / Khối / Trường
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="font-semibold text-slate-600 dark:text-slate-300" htmlFor="excel-year-select">
              Năm học:
            </label>
            <select
              id="excel-year-select"
              value={yearScope}
              onChange={(e) => setYearScope(e.target.value)}
              className="glass-subsurface rounded-xl px-2.5 py-1.5 font-semibold text-slate-800 dark:text-slate-100"
            >
              <option value="all">Tất cả năm học</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.name}>
                  {y.name}
                </option>
              ))}
              {!academicYears.some((y) => y.name === yearScope) && yearScope !== 'all' && (
                <option value={yearScope}>{yearScope}</option>
              )}
            </select>
          </div>
        </div>

        {statusMessage && (
          <div
            className={`p-3 rounded-xl flex items-start gap-2 border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/12 border-emerald-400/35 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-500/12 border-rose-400/35 text-rose-800 dark:text-rose-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {modeTab === 'export' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl glass-subsurface space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    1. Tải file mẫu Excel chuẩn theo từng lớp
                  </h4>
                  <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                    Tự động sinh <strong>{activeClasses.length} sheet</strong> ứng với từng lớp đang hoạt động ({yearScope === 'all' ? 'toàn trường' : yearScope}), kèm sheet <strong>HUONG_DAN</strong> và <strong>DANH_MUC</strong>. Lớp ngừng hoạt động tự động được loại trừ.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void handleDownloadWorkbook(true)}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Tải mẫu theo lớp (.xlsx)
                </button>
              </div>
            </div>

            <div className="p-4 rounded-2xl glass-subsurface space-y-3">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                2. Xuất dữ liệu cơ sở vật chất thực tế
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Phạm vi xuất
                  </label>
                  <select
                    value={exportScope}
                    onChange={(e) => setExportScope(e.target.value as 'all' | 'grade' | 'class')}
                    className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                  >
                    <option value="all">Toàn trường (Mỗi lớp 1 sheet)</option>
                    <option value="grade">Theo Khối lớp</option>
                    <option value="class">Theo Lớp cụ thể</option>
                  </select>
                </div>
                {exportScope === 'grade' && (
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Chọn Khối
                    </label>
                    <select
                      value={gradeScope}
                      onChange={(e) => setGradeScope(e.target.value)}
                      className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                    >
                      {availableGrades.map((g) => (
                        <option key={g} value={String(g)}>
                          Khối {g}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {exportScope === 'class' && (
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Chọn Lớp
                    </label>
                    <select
                      value={classScopeId}
                      onChange={(e) => setClassScopeId(e.target.value)}
                      className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                    >
                      {activeClasses.map((c) => (
                        <option key={c.id} value={c.id}>
                          Lớp {c.name} ({c.room})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <span className="text-slate-600 dark:text-slate-300 font-semibold">
                  Số thiết bị sẽ xuất: <strong className="text-slate-900 dark:text-white">{scopedExportFacilities.length}</strong>
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleCopyGoogleSheetsTsv()}
                    className="px-3.5 py-2 rounded-xl glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-100 font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Copy className="w-3.5 h-3.5" /> Sao chép Google Sheets
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleDownloadWorkbook(false)}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-4 h-4" /> Xuất Excel (.xlsx)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {modeTab === 'import' && canEdit && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Upload Excel / CSV */}
              <div className="p-4 rounded-2xl glass-subsurface space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    Tải lên Excel (.xlsx / .csv)
                  </h4>
                  <button
                    type="button"
                    onClick={() => void handleDownloadWorkbook(true)}
                    className="text-[11px] font-bold text-teal-700 dark:text-teal-300 hover:underline cursor-pointer"
                  >
                    Tải file mẫu
                  </button>
                </div>
                <p className="text-slate-600 dark:text-slate-300">
                  Mỗi sheet khớp đúng tên/mã lớp (VD: 10A1, 10A2). Hệ thống tự loại trừ sheet HUONG_DAN và DANH_MUC.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Upload className="w-3.5 h-3.5" /> Chọn tệp Excel
                  </button>
                  <select
                    value={fallbackClassId}
                    onChange={(e) => setFallbackClassId(e.target.value)}
                    aria-label="Lớp mặc định nếu file 1 sheet"
                    className="glass-subsurface rounded-xl px-2.5 py-2 text-slate-800 dark:text-slate-100 max-w-[190px]"
                  >
                    <option value="">-- Khớp lớp theo tên sheet --</option>
                    {activeClasses.map((c) => (
                      <option key={c.id} value={c.id}>
                        Gán vào lớp {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Google Sheets Link or Paste */}
              <div className="p-4 rounded-2xl glass-subsurface space-y-2.5">
                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  Nhập từ Google Sheets
                </h4>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={googleSheetUrl}
                    onChange={(e) => setGoogleSheetUrl(e.target.value)}
                    placeholder="Dán URL Google Sheets công khai..."
                    className="flex-1 min-w-0 glass-subsurface rounded-xl px-3 py-1.5 text-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    disabled={isBusy || !googleSheetUrl.trim()}
                    onClick={() => void handleFetchGoogleSheet()}
                    className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Đọc Sheet
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Hoặc sao chép vùng bảng tính từ Google Sheets (gồm dòng tiêu đề) và dán tại đây..."
                  className="w-full glass-subsurface rounded-xl px-3 py-1.5 text-slate-800 dark:text-slate-100"
                />
                {pastedText.trim() && (
                  <button
                    type="button"
                    onClick={handleParsePastedText}
                    className="px-3 py-1.5 rounded-xl glass-subsurface font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-500/10 cursor-pointer"
                  >
                    Kiểm tra dữ liệu vừa dán
                  </button>
                )}
              </div>
            </div>

            {preview && (
              <div className="space-y-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="mint" size="sm">Thêm mới: {preview.validCreateCount}</Badge>
                    <Badge variant="blue" size="sm">Cập nhật: {preview.validUpdateCount}</Badge>
                    <Badge variant={preview.invalidCount > 0 ? 'pink' : 'gray'} size="sm">
                      Lỗi: {preview.invalidCount}
                    </Badge>
                    <Badge variant={preview.duplicateCount > 0 ? 'amber' : 'gray'} size="sm">
                      Trùng lặp: {preview.duplicateCount}
                    </Badge>
                  </div>
                  <button
                    type="button"
                    disabled={isBusy || preview.entitiesToSave.length === 0}
                    onClick={() => void handleConfirmImport()}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Xác nhận nhập ({preview.entitiesToSave.length} dòng hợp lệ)
                  </button>
                </div>

                {(preview.unknownClassSheets.length > 0 || preview.inactiveClassSheets.length > 0) && (
                  <div className="p-2.5 rounded-xl bg-amber-500/12 border border-amber-400/35 text-amber-900 dark:text-amber-200 space-y-1">
                    {preview.unknownClassSheets.length > 0 && (
                      <p>Sheet không khớp mã lớp đang có: <strong>{preview.unknownClassSheets.join(', ')}</strong></p>
                    )}
                    {preview.inactiveClassSheets.length > 0 && (
                      <p>Sheet thuộc lớp đã ngừng hoạt động: <strong>{preview.inactiveClassSheets.join(', ')}</strong></p>
                    )}
                  </div>
                )}

                <div className="max-h-60 overflow-y-auto overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/70">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold">
                      <tr>
                        <th className="px-3 py-2">Sheet / Dòng</th>
                        <th className="px-3 py-2">Lớp</th>
                        <th className="px-3 py-2">Thiết bị</th>
                        <th className="px-3 py-2">Trạng thái</th>
                        <th className="px-3 py-2">Chi tiết kiểm tra</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/60">
                      {preview.rows.slice(0, 80).map((r, idx) => (
                        <tr key={`${r.sheetName}-${r.rowNumber}-${idx}`}>
                          <td className="px-3 py-2 font-mono-tabular whitespace-nowrap">
                            {r.sheetName} #{r.rowNumber}
                          </td>
                          <td className="px-3 py-2 font-semibold whitespace-nowrap">{r.className}</td>
                          <td className="px-3 py-2">{r.entity?.name || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <Badge
                              variant={
                                r.status === 'valid_create'
                                  ? 'mint'
                                  : r.status === 'valid_update'
                                  ? 'blue'
                                  : r.status === 'duplicate'
                                  ? 'amber'
                                  : 'pink'
                              }
                              size="sm"
                            >
                              {r.status === 'valid_create'
                                ? 'Thêm mới'
                                : r.status === 'valid_update'
                                ? 'Cập nhật'
                                : r.status === 'duplicate'
                                ? 'Trùng lặp'
                                : 'Lỗi'}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">
                            {r.errors.length > 0 ? (
                              <span className="text-rose-700 dark:text-rose-300 font-medium">
                                {r.errors.join(' · ')}
                              </span>
                            ) : (
                              <span className="text-slate-600 dark:text-slate-300">
                                {r.diffs.join(' · ')}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
