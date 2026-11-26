import React, { useMemo, useState } from 'react';
import {
  School, Users, UserCheck, MapPin, ArrowRight, Plus, Pencil, Trash2, ArrowLeftRight, Archive, RotateCcw
} from '../components/icons/UiIcons';
import {
  ClassPlacement,
  ExportHistoryRecord,
  ImportHistoryRecord,
  ImportModuleKey,
  PermissionMatrix,
  SchoolClass,
  SchoolRoom,
  Student,
  SystemSettings,
  Teacher,
  UserProfile,
} from '../types';
import { LiquidCard } from '../components/common/LiquidCard';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { PresetClassesModal } from '../components/shared/PresetClassesModal';
import { BulkSelectionBar } from '../components/shared/BulkSelectionBar';
import { CompactDataToolbar } from '../components/importExport/CompactDataToolbar';
import { UnifiedManualFormModal } from '../components/importExport/UnifiedManualFormModal';
import { ExcelImportDialog } from '../components/importExport/ExcelImportDialog';
import { ExcelExportDialog } from '../components/importExport/ExcelExportDialog';
import { ModuleDataActions } from '../components/importExport/ModuleDataActions';
import { getSchemaByKey } from '../utils/importExport/schemas';
import { generateTemplateWorkbookBuffer, triggerBinaryDownload } from '../utils/importExport/excelEngine';
import type { ValidationDbContext } from '../utils/importExport/validator';
import { DEFAULT_PERMISSIONS, hasPermission } from '../utils/rbac';
import {
  areAllVisibleSelected,
  pruneStaleSelectedIds,
  toggleSelectAllVisible,
  toggleSelectedId,
} from '../utils/bulkSelection';

interface ClassesViewProps {
  classes: SchoolClass[];
  students: Student[];
  teachers?: Teacher[];
  rooms?: SchoolRoom[];
  classPlacements?: ClassPlacement[];
  currentUser: UserProfile;
  customPermissions?: PermissionMatrix;
  validationContext?: ValidationDbContext;
  systemSettings?: SystemSettings;
  onSaveSettings?: (settings: SystemSettings) => Promise<void> | void;
  onCreateClassesOnWeb?: (newClasses: SchoolClass[]) => Promise<void> | void;
  onAddClass?: (newClass: SchoolClass) => void;
  onUpdateClass?: (updatedClass: SchoolClass) => void;
  onDeleteClass?: (classId: string) => void;
  onDeleteClasses?: (classIds: string[]) => Promise<void> | void;
  onUnifiedImportCommit?: (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => Promise<void> | void;
  onLogExport?: (record: ExportHistoryRecord) => Promise<void> | void;
  topLeftSlot?: React.ReactNode;
}

export const ClassesView: React.FC<ClassesViewProps> = ({
  classes,
  students,
  teachers = [],
  rooms = [],
  classPlacements = [],
  currentUser,
  customPermissions = DEFAULT_PERMISSIONS,
  validationContext,
  systemSettings,
  onSaveSettings,
  onCreateClassesOnWeb,
  onAddClass,
  onUpdateClass,
  onDeleteClass,
  onDeleteClasses,
  onUnifiedImportCommit,
  onLogExport,
  topLeftSlot,
}) => {
  const [selectedClass, setSelectedClass] = useState<SchoolClass | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [showPlacementPanel, setShowPlacementPanel] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SchoolClass | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingBulkDeleteIds, setPendingBulkDeleteIds] = useState<string[] | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const effectiveContext: ValidationDbContext = useMemo(
    () =>
      validationContext ?? {
        classes,
        teachers,
        rooms,
        students,
      },
    [validationContext, classes, teachers, rooms, students]
  );

  const canCreate = hasPermission(currentUser.role, 'classes', 'create', customPermissions) && !!onAddClass;
  const canEdit = hasPermission(currentUser.role, 'classes', 'edit', customPermissions) && !!onUpdateClass;
  const canDelete = hasPermission(currentUser.role, 'classes', 'delete', customPermissions) && Boolean(onDeleteClass || onDeleteClasses);
  const canExport = hasPermission(currentUser.role, 'classes', 'export', customPermissions);

  const grades = [10, 11, 12];

  const effectiveSelectedIds = useMemo(
    () => pruneStaleSelectedIds(selectedIds, classes.map((c) => c.id)),
    [selectedIds, classes]
  );
  const visibleClassIds = useMemo(
    () => classes.filter((c) => grades.includes(c.grade)).map((c) => c.id),
    [classes]
  );
  const selectedRecords = useMemo(
    () => classes.filter((c) => effectiveSelectedIds.includes(c.id)),
    [classes, effectiveSelectedIds]
  );

  const handleConfirmBulkDelete = async () => {
    if (!pendingBulkDeleteIds || pendingBulkDeleteIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      if (onDeleteClasses) {
        await onDeleteClasses(pendingBulkDeleteIds);
      } else if (onDeleteClass) {
        for (const id of pendingBulkDeleteIds) {
          await onDeleteClass(id);
        }
      }
      const deletedSet = new Set(pendingBulkDeleteIds);
      setSelectedIds((prev) => prev.filter((id) => !deletedSet.has(id)));
    } finally {
      setIsBulkDeleting(false);
      setPendingBulkDeleteIds(null);
    }
  };

  const getStudentsInClass = (classCode: string) =>
    students.filter((s) => s.className === classCode || s.classId === `CLS-${classCode}`);

  const openCreateModal = () => {
    setEditingClass(null);
    setIsModalOpen(true);
  };

  const openEditModal = (cls: SchoolClass) => {
    setEditingClass(cls);
    setIsModalOpen(true);
  };

  const handleSaveManual = async (entity: Record<string, unknown>, isEdit: boolean) => {
    const payload = entity as unknown as SchoolClass;
    if (isEdit && onUpdateClass) onUpdateClass(payload);
    else if (onAddClass) onAddClass(payload);
    setEditingClass(null);
  };

  const handleDownloadTemplate = async () => {
    const schema = getSchemaByKey('classes');
    const bytes = await generateTemplateWorkbookBuffer(schema, effectiveContext);
    triggerBinaryDownload(
      bytes,
      schema.templateFileName,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  };

  const handleCommit = async (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => {
    if (onUnifiedImportCommit) {
      await onUnifiedImportCommit(moduleKey, entitiesToSave, historyRecord);
      return;
    }
    if (moduleKey === 'classes') {
      for (const item of entitiesToSave) {
        const cls = item as unknown as SchoolClass;
        if (classes.some((x) => x.id === cls.id) && onUpdateClass) onUpdateClass(cls);
        else if (onAddClass) onAddClass(cls);
      }
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {topLeftSlot ?? <span />}
        <CompactDataToolbar
          canCreate={canCreate}
          canImport={canCreate}
          canExport={canExport}
          createLabel="Thêm lớp"
          selectedCount={selectedRecords.length}
          onManualAdd={openCreateModal}
          onDownloadTemplate={handleDownloadTemplate}
          onOpenImport={() => setIsImportOpen(true)}
          onOpenExport={() => setIsExportOpen(true)}
          extraActions={
            <div className="flex flex-wrap items-center gap-2">
              {canCreate && systemSettings && onSaveSettings && (
                <button
                  type="button"
                  onClick={() => setIsPresetModalOpen(true)}
                  data-testid="open-preset-classes-btn"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass-subsurface text-sky-700 dark:text-sky-300 text-xs font-semibold hover:bg-white/75 dark:hover:bg-white/10 transition-all whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <School size={14} />
                  <span>
                    Lớp cài đặt trước ({(systemSettings.presetClasses || []).length})
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowPlacementPanel((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  showPlacementPanel
                    ? 'glass-pill-tab-active'
                    : 'glass-subsurface text-slate-700 dark:text-slate-200 hover:bg-white/75 dark:hover:bg-white/10'
                }`}
              >
                <ArrowLeftRight size={14} />
                <span>Phân lớp / Chuyển lớp ({classPlacements.length})</span>
              </button>
            </div>
          }
        />
      </div>

      {showPlacementPanel && (
        <LiquidCard className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Phân lớp & Chuyển lớp Học sinh (Bảo toàn lịch sử các năm học)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Xếp lớp đầu năm hoặc chuyển lớp cho học sinh — bảo lưu lịch sử phân lớp qua từng niên khóa
              </p>
            </div>
            <ModuleDataActions
              moduleKey="class_placements"
              context={effectiveContext}
              currentUser={currentUser}
              allRecords={classPlacements as unknown as Record<string, unknown>[]}
              canCreate={hasPermission(currentUser.role, 'students', 'edit', customPermissions)}
              canImport={hasPermission(currentUser.role, 'students', 'edit', customPermissions)}
              canExport={canExport}
              createLabel="Phân lớp mới"
              onManualSave={async (entity) => {
                await handleCommit('class_placements', [entity], {
                  id: `IMP-PLC-${Date.now()}`,
                  moduleKey: 'class_placements',
                  moduleTitle: 'Phân lớp & Chuyển lớp Học sinh',
                  appId: 'school',
                  fileName: 'MANUAL_ENTRY',
                  mode: 'only_add',
                  errorPolicy: 'only_valid',
                  totalRows: 1,
                  successCount: 1,
                  createdCount: 1,
                  updatedCount: 0,
                  failedCount: 0,
                  skippedCount: 0,
                  actorName: currentUser.displayName,
                  actorRole: currentUser.role,
                  status: 'completed',
                  timestamp: new Date().toISOString(),
                });
              }}
              onCommitImport={handleCommit}
              onLogExport={onLogExport}
            />
          </div>

          {classPlacements.length > 0 ? (
            <div className="glass-table-shell overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="glass-table-head">
                  <tr>
                    <th className="px-3.5 py-2.5">Học sinh</th>
                    <th className="px-3.5 py-2.5">Lớp</th>
                    <th className="px-3.5 py-2.5">Năm học</th>
                    <th className="px-3.5 py-2.5">Hình thức</th>
                    <th className="px-3.5 py-2.5">Ngày hiệu lực</th>
                  </tr>
                </thead>
                <tbody>
                  {classPlacements.slice(0, 20).map((pl) => (
                    <tr key={pl.id} className="glass-table-row">
                      <td className="px-3.5 py-2.5 font-semibold">{pl.studentName} ({pl.studentCode})</td>
                      <td className="px-3.5 py-2.5">{pl.className}</td>
                      <td className="px-3.5 py-2.5 font-mono-tabular">{pl.academicYear}</td>
                      <td className="px-3.5 py-2.5">{pl.placementType}</td>
                      <td className="px-3.5 py-2.5 font-mono-tabular">{pl.effectiveDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">Chưa có quyết định phân lớp nào.</p>
          )}
        </LiquidCard>
      )}

      {classes.length === 0 ? (
        <div className="py-14 text-center flex flex-col items-center justify-center p-8 rounded-3xl liquid-glass-panel">
          <div className="w-14 h-14 rounded-2xl glass-subsurface text-sky-600 dark:text-sky-400 flex items-center justify-center mb-3">
            <School className="w-7 h-7 stroke-1" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Chưa có lớp học nào được tạo</h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mt-1 mb-5">
            Khởi tạo các lớp học theo khối 10, 11, 12 để phân bổ học sinh và xếp lịch thời khóa biểu.
          </p>
          {canCreate && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={openCreateModal}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Thêm lớp học đầu tiên
              </button>
              {systemSettings && onSaveSettings && (
                <button
                  type="button"
                  onClick={() => setIsPresetModalOpen(true)}
                  className="px-4 py-2 rounded-xl glass-subsurface text-sky-700 dark:text-sky-300 text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <School className="w-4 h-4" /> Cài đặt lớp sẵn cho Excel
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <BulkSelectionBar
            totalVisibleCount={visibleClassIds.length}
            selectedCount={effectiveSelectedIds.length}
            allVisibleSelected={areAllVisibleSelected(effectiveSelectedIds, visibleClassIds)}
            canDelete={canDelete}
            entityLabel="lớp học"
            showSelectAll={true}
            isDeleting={isBulkDeleting}
            testIdPrefix="classes-bulk"
            onToggleSelectAll={() =>
              setSelectedIds((prev) => toggleSelectAllVisible(prev, visibleClassIds))
            }
            onClearSelection={() => setSelectedIds([])}
            onRequestBulkDelete={() => setPendingBulkDeleteIds(effectiveSelectedIds)}
          />

          {grades.map((grade) => {
          const gradeClasses = classes.filter((c) => c.grade === grade);
          if (gradeClasses.length === 0) return null;

          return (
            <div key={grade} className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/40 dark:border-white/10 pb-2">
                <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm tracking-tight">
                  Khối {grade} · <span className="font-mono-tabular text-sky-600 dark:text-sky-400">{gradeClasses.length} lớp</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {gradeClasses.map((cls) => {
                  const studentCount = getStudentsInClass(cls.code).length;
                  const isSelected = effectiveSelectedIds.includes(cls.id);
                  const isInactive = cls.status === 'inactive';
                  return (
                    <LiquidCard
                      key={cls.id}
                      className={`p-4 flex flex-col justify-between group transition-all ${
                        isSelected ? 'ring-2 ring-sky-500/70 bg-sky-50/40 dark:bg-sky-950/20' : ''
                      } ${isInactive ? 'opacity-75 bg-slate-100/70 dark:bg-slate-900/50' : ''}`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            {canDelete && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() =>
                                  setSelectedIds((prev) => toggleSelectedId(prev, cls.id))
                                }
                                aria-label={`Chọn lớp ${cls.code}`}
                                className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500 cursor-pointer"
                              />
                            )}
                            <span className="font-mono text-xs font-bold text-sky-700 dark:text-sky-300">
                              {cls.code}
                            </span>
                            {isInactive && (
                              <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                                · Ngừng sử dụng
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono mr-0.5">
                              <MapPin className="w-3 h-3 text-teal-600 dark:text-teal-400" /> {cls.room}
                            </span>
                            {canEdit && onUpdateClass && (
                              <button
                                type="button"
                                data-testid={`toggle-archive-class-${cls.code}`}
                                onClick={() =>
                                  onUpdateClass({
                                    ...cls,
                                    status: isInactive ? 'active' : 'inactive',
                                  })
                                }
                                aria-label={isInactive ? `Khôi phục lớp ${cls.code}` : `Ngừng sử dụng lớp ${cls.code}`}
                                title={isInactive ? 'Khôi phục lớp sử dụng lại' : 'Ngừng sử dụng (lưu trữ, giữ nguyên lịch sử học sinh)'}
                                className={`p-1 rounded-lg cursor-pointer transition-colors ${
                                  isInactive
                                    ? 'text-emerald-600 hover:bg-emerald-500/10'
                                    : 'text-slate-400 hover:text-amber-600 dark:hover:text-amber-400'
                                }`}
                              >
                                {isInactive ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => openEditModal(cls)}
                                aria-label={`Sửa lớp ${cls.code}`}
                                className="p-1 rounded-lg text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => setPendingDelete(cls)}
                                aria-label={`Xóa lớp ${cls.code}`}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-snug">
                          {cls.name}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-2">
                          <UserCheck className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                          <span>
                            GVCN: <strong className="text-slate-700 dark:text-slate-200">{cls.homeroomTeacherName}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-200/50 dark:border-slate-700/50 mt-4 flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 tabular-nums">
                          <Users className="w-3.5 h-3.5 text-slate-400" /> Sĩ số:{' '}
                          <strong className="text-slate-800 dark:text-slate-100">{studentCount}</strong>
                        </span>

                        <button
                          type="button"
                          onClick={() => setSelectedClass(cls)}
                          className="px-3 py-1.5 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-white/10 text-sky-700 dark:text-sky-300 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          Danh sách lớp <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </LiquidCard>
                  );
                })}
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* Class Students Modal */}
      {selectedClass && (
        <Modal
          isOpen={!!selectedClass}
          onClose={() => setSelectedClass(null)}
          title={`Danh sách Học sinh: ${selectedClass.name}`}
          description={`Giáo viên chủ nhiệm: ${selectedClass.homeroomTeacherName} · ${selectedClass.room}`}
          maxWidth="2xl"
        >
          <div className="space-y-3 text-xs">
            <div className="glass-table-shell overflow-x-auto">
              <table className="w-full text-left">
                <thead className="glass-table-head">
                  <tr>
                    <th className="px-3.5 py-2.5">Học sinh</th>
                    <th className="px-3.5 py-2.5">Mã STU</th>
                    <th className="px-3.5 py-2.5">Mã Thẻ RFID</th>
                    <th className="px-3.5 py-2.5">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {getStudentsInClass(selectedClass.code).map((s) => (
                    <tr key={s.id} className="glass-table-row">
                      <td className="px-3.5 py-2.5 font-bold text-slate-900 dark:text-slate-100">{s.fullName}</td>
                      <td className="px-3.5 py-2.5 font-mono text-sky-700 dark:text-sky-300">{s.studentCode}</td>
                      <td className="px-3.5 py-2.5 font-mono text-teal-700 dark:text-teal-300">{s.rfidCardId}</td>
                      <td className="px-3.5 py-2.5">
                        <Badge variant="mint" size="sm">{s.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {getStudentsInClass(selectedClass.code).length === 0 && (
                <div className="py-6 text-center text-slate-400 dark:text-slate-500">
                  Chưa có học sinh nào trong lớp này.
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      <UnifiedManualFormModal
        isOpen={isModalOpen}
        moduleKey="classes"
        context={effectiveContext}
        existingRecords={classes as unknown as Record<string, unknown>[]}
        initialValues={editingClass ? (editingClass as unknown as Record<string, unknown>) : undefined}
        editingRecordId={editingClass?.id}
        currentUser={currentUser}
        onClose={() => {
          setIsModalOpen(false);
          setEditingClass(null);
        }}
        onSave={handleSaveManual}
      />

      <ExcelImportDialog
        isOpen={isImportOpen}
        moduleKey="classes"
        context={effectiveContext}
        existingRecords={classes as unknown as Record<string, unknown>[]}
        currentUser={currentUser}
        onClose={() => setIsImportOpen(false)}
        onCommitImport={handleCommit}
      />

      <ExcelExportDialog
        isOpen={isExportOpen}
        moduleKey="classes"
        context={effectiveContext}
        allRecords={classes as unknown as Record<string, unknown>[]}
        filteredRecords={classes as unknown as Record<string, unknown>[]}
        selectedRecords={selectedRecords as unknown as Record<string, unknown>[]}
        currentUser={currentUser}
        onClose={() => setIsExportOpen(false)}
        onLogExport={onLogExport}
      />

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        title="Xóa lớp học"
        message={pendingDelete ? `Xác nhận xóa ${pendingDelete.name} (${pendingDelete.code}) khỏi hệ thống?` : ''}
        confirmLabel="Xóa lớp"
        onConfirm={() => {
          if (pendingDelete && onDeleteClass) {
            onDeleteClass(pendingDelete.id);
            setSelectedIds((prev) => prev.filter((id) => id !== pendingDelete.id));
          }
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        isOpen={Boolean(pendingBulkDeleteIds && pendingBulkDeleteIds.length > 0)}
        title="Xác nhận xóa nhiều lớp học"
        message={
          pendingBulkDeleteIds
            ? `Bạn có chắc muốn xóa ${pendingBulkDeleteIds.length} lớp học đã chọn khỏi hệ thống?`
            : ''
        }
        confirmLabel={`Xóa ${pendingBulkDeleteIds?.length || 0} lớp`}
        onConfirm={() => {
          void handleConfirmBulkDelete();
        }}
        onCancel={() => setPendingBulkDeleteIds(null)}
      />
      {systemSettings && onSaveSettings && (
        <PresetClassesModal
          isOpen={isPresetModalOpen}
          onClose={() => setIsPresetModalOpen(false)}
          systemSettings={systemSettings}
          existingClasses={classes}
          onSaveSettings={onSaveSettings}
          onCreateClassesOnWeb={
            onCreateClassesOnWeb ||
            (onAddClass
              ? async (newClasses) => {
                  for (const cls of newClasses) {
                    onAddClass(cls);
                  }
                }
              : undefined)
          }
        />
      )}
    </div>
  );
};
