import React, { useMemo, useState } from 'react';
import {
  Database, ShieldAlert, Layers, CheckCircle2, FileSpreadsheet, ExternalLink
} from 'lucide-react';
import type {
  ExportHistoryRecord,
  ExternalDatasetRecord,
  ImportHistoryRecord,
  ImportModuleKey,
  ImportModuleSchema,
  PermissionMatrix,
  SuperAppId,
  UserProfile,
  Book,
  Student,
  Teacher,
} from '../types';
import { LiquidCard } from '../components/common/LiquidCard';
import { Badge } from '../components/common/Badge';
import { ModuleDataActions } from '../components/importExport/ModuleDataActions';
import { ImportExportHistoryTable } from '../components/importExport/ImportExportHistoryTable';
import { MODULE_SCHEMAS } from '../utils/importExport/schemas';
import {
  extractExistingRecordsForModule,
  type ValidationDbContext,
} from '../utils/importExport/validator';
import { DEFAULT_PERMISSIONS, hasPermission } from '../utils/rbac';

interface DataCenterViewProps {
  currentUser: UserProfile;
  customPermissions?: PermissionMatrix;
  validationContext?: ValidationDbContext;
  importHistory?: ImportHistoryRecord[];
  exportHistory?: ExportHistoryRecord[];
  externalDatasets?: ExternalDatasetRecord[];
  onUnifiedImportCommit?: (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => Promise<void> | void;
  onLogExport?: (record: ExportHistoryRecord) => Promise<void> | void;
  onOpenTargetApp?: (appId: SuperAppId, tabId?: string) => void;
  onImportStudents?: (students: Student[]) => void;
  onImportBooks?: (books: Book[]) => void;
  onImportTeachers?: (teachers: Teacher[]) => void;
}

const APP_LABELS: Record<SuperAppId, string> = {
  admin: '01. Quản trị',
  school: '02. Nhà trường',
  learning: '03. Lịch học',
  library: '04. Thư viện',
  services: '05. Dịch vụ HS',
  communication: '06. Truyền thông',
  facilities: '07. Cơ sở vật chất',
  analytics: '08. Phân tích & AI',
  subjects: '09. Học tập theo môn',
};

const APP_ORDER: SuperAppId[] = [
  'admin',
  'school',
  'learning',
  'library',
  'services',
  'communication',
  'facilities',
  'analytics',
  'subjects',
];

export const DataCenterView: React.FC<DataCenterViewProps> = ({
  currentUser,
  customPermissions = DEFAULT_PERMISSIONS,
  validationContext = {},
  importHistory = [],
  exportHistory = [],
  externalDatasets = [],
  onUnifiedImportCommit,
  onLogExport,
  onOpenTargetApp,
}) => {
  const [appFilter, setAppFilter] = useState<'all' | SuperAppId>('all');
  const [selectedKey, setSelectedKey] = useState<ImportModuleKey>('students');

  const allSchemas = useMemo(() => Object.values(MODULE_SCHEMAS), []);

  const canImportSchema = (schema: ImportModuleSchema): boolean => {
    if (schema.key === 'borrow_migration') {
      return currentUser.role === 'admin' || currentUser.role === 'librarian';
    }
    if (schema.key === 'feedback_migration') {
      return currentUser.role === 'admin' || currentUser.role === 'principal';
    }
    if (schema.key === 'leave_migration') {
      return (
        currentUser.role === 'admin' ||
        currentUser.role === 'principal' ||
        currentUser.role === 'homeroom_teacher'
      );
    }
    if (schema.key === 'external_datasets') {
      return (
        currentUser.role === 'admin' ||
        currentUser.role === 'principal' ||
        currentUser.role === 'staff' ||
        hasPermission(currentUser.role, 'reports', 'edit', customPermissions)
      );
    }
    return (
      hasPermission(currentUser.role, schema.permissionModule, 'edit', customPermissions) ||
      hasPermission(currentUser.role, schema.permissionModule, 'create', customPermissions)
    );
  };

  const canExportSchema = (schema: ImportModuleSchema): boolean => {
    return (
      canImportSchema(schema) ||
      hasPermission(currentUser.role, schema.permissionModule, 'view', customPermissions)
    );
  };

  const visibleSchemas = useMemo(() => {
    return allSchemas.filter((s) => {
      if (appFilter !== 'all' && s.appId !== appFilter) return false;
      return canExportSchema(s);
    });
  }, [allSchemas, appFilter, currentUser.role, customPermissions]);

  const activeSchema: ImportModuleSchema = useMemo(() => {
    return (
      visibleSchemas.find((s) => s.key === selectedKey) ||
      visibleSchemas[0] ||
      MODULE_SCHEMAS.students
    );
  }, [visibleSchemas, selectedKey]);

  const getModuleRecords = (key: ImportModuleKey): Record<string, unknown>[] => {
    if (key === 'external_datasets') return externalDatasets;
    if (key === 'survey_questions') {
      return (validationContext.surveys || []).map((s) => ({
        ...s,
        questionText: s.questions?.[0]?.text || '',
        questionType: s.questions?.[0]?.type || 'rating',
        optionsText: (s.questions?.[0]?.options || []).join('; '),
      }));
    }
    return extractExistingRecordsForModule(key, validationContext);
  };

  const activeRecords = useMemo(
    () => getModuleRecords(activeSchema.key),
    [activeSchema.key, validationContext, externalDatasets]
  );

  const handleCommit = async (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => {
    if (onUnifiedImportCommit) {
      await onUnifiedImportCommit(moduleKey, entitiesToSave, historyRecord);
    }
  };

  return (
    <div className="space-y-5" data-testid="unified-data-center">
      {/* App Filter Pills */}
      <div className="glass-pill-tray flex flex-wrap items-center gap-1 p-1 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setAppFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            appFilter === 'all' ? 'glass-pill-tab-active' : 'glass-pill-tab'
          }`}
        >
          Tất cả ({allSchemas.filter(canExportSchema).length})
        </button>
        {APP_ORDER.map((appId) => {
          const count = allSchemas.filter((s) => s.appId === appId && canExportSchema(s)).length;
          if (count === 0) return null;
          return (
            <button
              key={appId}
              type="button"
              onClick={() => {
                setAppFilter(appId);
                const first = allSchemas.find((s) => s.appId === appId && canExportSchema(s));
                if (first) setSelectedKey(first.key);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                appFilter === appId ? 'glass-pill-tab-active' : 'glass-pill-tab'
              }`}
            >
              {APP_LABELS[appId]} ({count})
            </button>
          );
        })}
      </div>

      {/* Main Split: Left Module List + Right Action Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <LiquidCard className="lg:col-span-5 p-3 space-y-1.5 max-h-[420px] overflow-y-auto">
          <div className="px-2 py-1 text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> Chọn phân hệ dữ liệu
          </div>
          {visibleSchemas.map((schema) => {
            const isSelected = activeSchema.key === schema.key;
            const count = getModuleRecords(schema.key).length;
            return (
              <button
                key={schema.key}
                type="button"
                onClick={() => setSelectedKey(schema.key)}
                data-testid={`datacenter-module-${schema.key}`}
                className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'bg-sky-500/15 border-sky-400/60 text-sky-950 dark:text-sky-100 shadow-xs'
                    : 'glass-subsurface border-transparent hover:border-white/50 dark:hover:border-white/20 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold truncate">{schema.title}</span>
                    {schema.migrationOnly && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                        Kiểm soát
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                    {APP_LABELS[schema.appId]} · {schema.fields.length} cột chuẩn
                  </p>
                </div>
                <span className="font-mono-tabular text-[11px] font-bold px-2 py-0.5 rounded-lg glass-subsurface text-slate-700 dark:text-slate-200 shrink-0">
                  {count}
                </span>
              </button>
            );
          })}
        </LiquidCard>

        <LiquidCard className="lg:col-span-7 p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="blue" size="sm">{APP_LABELS[activeSchema.appId]}</Badge>
                  <span className="font-mono-tabular text-[11px] text-slate-400">
                    {activeSchema.templateFileName} · v{activeSchema.version}
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1.5">
                  {activeSchema.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {activeSchema.subtitle}
                </p>
              </div>

              {onOpenTargetApp && (
                <button
                  type="button"
                  onClick={() => onOpenTargetApp(activeSchema.appId)}
                  className="px-2.5 py-1.5 rounded-xl glass-subsurface text-[11px] font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <ExternalLink className="w-3 h-3" /> Mở ứng dụng
                </button>
              )}
            </div>

            {activeSchema.migrationWarning && (
              <div className="p-3 rounded-xl glass-subsurface bg-amber-500/12 border-amber-400/40 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{activeSchema.migrationWarning}</span>
              </div>
            )}

            {/* Unified Action Bar */}
            <div className="p-4 rounded-2xl glass-subsurface space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Thao tác Dữ liệu Chuẩn hóa ({activeRecords.length} bản ghi hiện có)
                </span>
                <ModuleDataActions
                  moduleKey={activeSchema.key}
                  context={validationContext}
                  currentUser={currentUser}
                  allRecords={activeRecords}
                  filteredRecords={activeRecords}
                  canCreate={false}
                  canImport={canImportSchema(activeSchema)}
                  canExport={canExportSchema(activeSchema)}
                  onCommitImport={(key, items, hist) => handleCommit(key, items, hist)}
                  onLogExport={onLogExport}
                />
              </div>

              <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>
                  Hồ sơ tư vấn tâm lý được bảo mật tuyệt đối và không bao giờ đưa vào luồng import/export hàng loạt.
                </span>
              </div>
            </div>

            {/* Schema Column Preview */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                Cấu trúc cột trong file mẫu ({activeSchema.fields.length} cột)
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {activeSchema.fields.map((f) => (
                  <span
                    key={f.key}
                    className={`px-2 py-1 rounded-lg text-[11px] font-medium border ${
                      f.required
                        ? 'bg-sky-500/12 border-sky-400/40 text-sky-900 dark:text-sky-200'
                        : 'glass-subsurface text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {f.header}
                  </span>
                ))}
              </div>
            </div>

            {/* External Verified Reference Datasets Preview when active */}
            {activeSchema.key === 'external_datasets' && externalDatasets.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/35 dark:border-white/10">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Dữ liệu tham chiếu đã nhập ({externalDatasets.length})
                </p>
                <div className="glass-table-shell max-h-40 overflow-y-auto">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="glass-table-head">
                        <tr>
                          <th className="px-3 py-2">Mã chỉ số</th>
                          <th className="px-3 py-2">Tên chỉ tiêu</th>
                          <th className="px-3 py-2">Giá trị</th>
                          <th className="px-3 py-2">Nguồn xác minh</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/25 dark:divide-white/10">
                        {externalDatasets.slice(0, 10).map((row, idx) => (
                          <tr key={idx} className="glass-table-row">
                            <td className="px-3 py-1.5 font-mono-tabular font-semibold">{String(row.code || '')}</td>
                            <td className="px-3 py-1.5">{String(row.name || '')}</td>
                            <td className="px-3 py-1.5 font-mono-tabular">{String(row.value || '')}</td>
                            <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300">{String(row.notes || '')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </LiquidCard>
      </div>

      {/* Audit / Import & Export History Table */}
      <LiquidCard className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            Lịch sử Import / Export Toàn hệ thống
          </h3>
          <span className="text-[11px] text-slate-400">
            Ghi nhận tự động mọi lượt nhập/xuất kèm số dòng &amp; người thao tác
          </span>
        </div>
        <ImportExportHistoryTable
          importHistory={importHistory}
          exportHistory={exportHistory}
        />
      </LiquidCard>
    </div>
  );
};
