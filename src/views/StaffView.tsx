import React, { useMemo, useState } from 'react';
import {
  GraduationCap, Search, Phone, Mail, Plus, UserCheck, Pencil, Trash2, BookOpenCheck
} from 'lucide-react';
import {
  ExportHistoryRecord,
  ImportHistoryRecord,
  ImportModuleKey,
  PermissionMatrix,
  SchoolClass,
  Teacher,
  TeachingAssignment,
  UserProfile,
} from '../types';
import { LiquidCard } from '../components/common/LiquidCard';
import { Badge } from '../components/common/Badge';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { CompactDataToolbar } from '../components/importExport/CompactDataToolbar';
import { UnifiedManualFormModal } from '../components/importExport/UnifiedManualFormModal';
import { ExcelImportDialog } from '../components/importExport/ExcelImportDialog';
import { ExcelExportDialog } from '../components/importExport/ExcelExportDialog';
import { ModuleDataActions } from '../components/importExport/ModuleDataActions';
import { getSchemaByKey } from '../utils/importExport/schemas';
import { generateTemplateWorkbookBuffer, triggerBinaryDownload } from '../utils/importExport/excelEngine';
import type { ValidationDbContext } from '../utils/importExport/validator';
import { resolveCatalogOptions } from '../utils/catalogs/catalogRegistry';
import { DEFAULT_PERMISSIONS, hasPermission } from '../utils/rbac';

interface StaffViewProps {
  teachers: Teacher[];
  classes?: SchoolClass[];
  teachingAssignments?: TeachingAssignment[];
  currentUser: UserProfile;
  customPermissions?: PermissionMatrix;
  validationContext?: ValidationDbContext;
  onAddTeacher: (teacher: Teacher) => void;
  onUpdateTeacher?: (teacher: Teacher) => void;
  onDeleteTeacher?: (teacherId: string) => void;
  onUnifiedImportCommit?: (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => Promise<void> | void;
  onLogExport?: (record: ExportHistoryRecord) => Promise<void> | void;
}

export const StaffView: React.FC<StaffViewProps> = ({
  teachers,
  classes = [],
  teachingAssignments = [],
  currentUser,
  customPermissions = DEFAULT_PERMISSIONS,
  validationContext,
  onAddTeacher,
  onUpdateTeacher,
  onDeleteTeacher,
  onUnifiedImportCommit,
  onLogExport,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [showTeachingAssignments, setShowTeachingAssignments] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Teacher | null>(null);

  const effectiveContext: ValidationDbContext = useMemo(
    () =>
      validationContext ?? {
        classes,
        teachers,
      },
    [validationContext, classes, teachers]
  );

  const departmentOptions = useMemo(
    () => resolveCatalogOptions({ catalogId: 'teacher_department', runtime: effectiveContext }),
    [effectiveContext]
  );

  const subjectOptions = useMemo(() => {
    const resolved = resolveCatalogOptions({
      catalogId: 'teacher_subject',
      parentValue: departmentFilter === 'all' ? undefined : departmentFilter,
      runtime: effectiveContext,
    });
    const map = new Map<string, string>();
    resolved.forEach((opt) => map.set(opt.value, opt.label));
    if (departmentFilter === 'all') {
      teachers.forEach((t) => {
        if (t.subject && !map.has(t.subject)) map.set(t.subject, t.subject);
      });
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [effectiveContext, departmentFilter, teachers]);

  const handleDepartmentFilterChange = (nextDept: string) => {
    setDepartmentFilter(nextDept);
    if (nextDept !== 'all' && subjectFilter !== 'all') {
      const valid = resolveCatalogOptions({
        catalogId: 'teacher_subject',
        parentValue: nextDept,
        runtime: effectiveContext,
      }).some((o) => o.value === subjectFilter);
      if (!valid) {
        setSubjectFilter('all');
      }
    }
  };

  const canCreate = hasPermission(currentUser.role, 'staff', 'create', customPermissions);
  const canEdit = hasPermission(currentUser.role, 'staff', 'edit', customPermissions);
  const canDelete = hasPermission(currentUser.role, 'staff', 'delete', customPermissions);
  const canExport = hasPermission(currentUser.role, 'staff', 'export', customPermissions);

  const allowedSubjectsForDept = useMemo(() => {
    if (departmentFilter === 'all') return null;
    return new Set(
      resolveCatalogOptions({
        catalogId: 'teacher_subject',
        parentValue: departmentFilter,
        runtime: effectiveContext,
      }).map((o) => o.value.toLowerCase())
    );
  }, [departmentFilter, effectiveContext]);

  const filteredTeachers = teachers.filter((t) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      t.fullName.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q);
    const matchesDept =
      departmentFilter === 'all' ||
      t.department === departmentFilter ||
      Boolean(allowedSubjectsForDept?.has((t.subject || '').toLowerCase()));
    const matchesSubject = subjectFilter === 'all' || t.subject === subjectFilter;
    return matchesSearch && matchesDept && matchesSubject;
  });

  const openCreateModal = () => {
    setEditingTeacher(null);
    setIsModalOpen(true);
  };

  const openEditModal = (t: Teacher) => {
    setEditingTeacher(t);
    setIsModalOpen(true);
  };

  const handleSaveManual = async (entity: Record<string, unknown>, isEdit: boolean) => {
    const payload = entity as unknown as Teacher;
    if (isEdit && onUpdateTeacher) onUpdateTeacher(payload);
    else onAddTeacher(payload);
    setEditingTeacher(null);
  };

  const handleDownloadTemplate = async () => {
    const schema = getSchemaByKey('teachers');
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
    if (moduleKey === 'teachers') {
      for (const item of entitiesToSave) {
        const t = item as unknown as Teacher;
        if (teachers.some((x) => x.id === t.id) && onUpdateTeacher) onUpdateTeacher(t);
        else onAddTeacher(t);
      }
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            Đội ngũ Giáo viên & Phân công Giảng dạy
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Danh bạ nhà giáo, phân công bộ môn chuyên môn, lớp giảng dạy và giáo viên chủ nhiệm
          </p>
        </div>

        <CompactDataToolbar
          canCreate={canCreate}
          canImport={canCreate}
          canExport={canExport}
          createLabel="Thêm Giáo viên"
          onManualAdd={openCreateModal}
          onDownloadTemplate={handleDownloadTemplate}
          onOpenImport={() => setIsImportOpen(true)}
          onOpenExport={() => setIsExportOpen(true)}
          extraActions={
            <button
              type="button"
              onClick={() => setShowTeachingAssignments((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap shrink-0 ${
                showTeachingAssignments
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10'
              }`}
            >
              <BookOpenCheck size={14} />
              <span>Phân công GV ({teachingAssignments.length})</span>
            </button>
          }
        />
      </div>

      {showTeachingAssignments && (
        <LiquidCard className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Bảng Phân công Giảng dạy theo Lớp & Học kỳ
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Quản lý thủ công, tải mẫu, nhập Excel và xuất danh sách phân công giáo viên
              </p>
            </div>
            <ModuleDataActions
              moduleKey="teaching_assignments"
              context={effectiveContext}
              currentUser={currentUser}
              allRecords={teachingAssignments as unknown as Record<string, unknown>[]}
              canCreate={canCreate}
              canImport={canCreate}
              canExport={canExport}
              createLabel="Phân công mới"
              onManualSave={async (entity) => {
                await handleCommit('teaching_assignments', [entity], {
                  id: `IMP-MAN-${Date.now()}`,
                  moduleKey: 'teaching_assignments',
                  moduleTitle: 'Phân công Giảng dạy',
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

          {teachingAssignments.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-2 font-bold">Giáo viên</th>
                    <th className="px-3 py-2 font-bold">Lớp</th>
                    <th className="px-3 py-2 font-bold">Môn học</th>
                    <th className="px-3 py-2 font-bold">Năm học</th>
                    <th className="px-3 py-2 font-bold">Học kỳ</th>
                    <th className="px-3 py-2 font-bold">Vai trò</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {teachingAssignments.slice(0, 20).map((ta) => (
                    <tr key={ta.id}>
                      <td className="px-3 py-2 font-semibold">{ta.teacherName}</td>
                      <td className="px-3 py-2">{ta.className}</td>
                      <td className="px-3 py-2">{ta.subject}</td>
                      <td className="px-3 py-2 font-mono-tabular">{ta.academicYear}</td>
                      <td className="px-3 py-2">{ta.semester}</td>
                      <td className="px-3 py-2">{ta.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Chưa có bản ghi phân công giảng dạy nào.</p>
          )}
        </LiquidCard>
      )}

      {/* Filter and Search Bar */}
      <LiquidCard className="p-3.5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên giáo viên, email, bộ môn..."
              className="w-full bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <select
              value={departmentFilter}
              onChange={(e) => handleDepartmentFilterChange(e.target.value)}
              className="bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-200 w-full sm:w-auto"
            >
              <option value="all">Tất cả Tổ chuyên môn</option>
              {departmentOptions.map((dept) => (
                <option key={dept.id} value={dept.value}>
                  {dept.label}
                </option>
              ))}
            </select>

            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-200 w-full sm:w-auto"
            >
              <option value="all">Tất cả Bộ môn</option>
              {subjectOptions.map((sub) => (
                <option key={sub.value} value={sub.value}>
                  {sub.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </LiquidCard>

      {/* Teachers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTeachers.map((teacher) => (
          <LiquidCard key={teacher.id} className="p-4 flex flex-col justify-between group">
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-400 to-indigo-500 text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                    {teacher.fullName.charAt(teacher.fullName.lastIndexOf(' ') + 1) || 'T'}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">
                      {teacher.fullName}
                    </h3>
                    <p className="text-[11px] text-sky-700 dark:text-sky-300 font-semibold">
                      {teacher.subject}
                    </p>
                  </div>
                </div>

                {(canEdit || canDelete) && (
                  <div className="flex items-center gap-1 shrink-0">
                    {canEdit && onUpdateTeacher && (
                      <button
                        type="button"
                        onClick={() => openEditModal(teacher)}
                        aria-label={`Sửa ${teacher.fullName}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canDelete && onDeleteTeacher && (
                      <button
                        type="button"
                        onClick={() => setPendingDelete(teacher)}
                        aria-label={`Xóa ${teacher.fullName}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5 text-xs pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                {teacher.isHomeroom && (
                  <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300 font-semibold">
                    <UserCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>Chủ nhiệm lớp {teacher.homeroomClassName}</span>
                  </div>
                )}
                {teacher.assignedClasses && teacher.assignedClasses.length > 0 && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Lớp dạy: <span className="font-semibold text-slate-700 dark:text-slate-200">{teacher.assignedClasses.join(', ')}</span>
                  </p>
                )}
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{teacher.email}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 tabular-nums">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{teacher.phone || 'Chưa cập nhật'}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between text-[11px]">
              <Badge variant={teacher.status === 'Đang công tác' ? 'mint' : 'amber'} size="sm">
                {teacher.status}
              </Badge>
              <span className="text-slate-400 dark:text-slate-500 font-medium">Niên khóa 2026-2027</span>
            </div>
          </LiquidCard>
        ))}
      </div>

      {filteredTeachers.length === 0 && (
        <div className="py-14 text-center flex flex-col items-center justify-center p-8 rounded-3xl bg-white/60 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-700/80">
          <div className="w-14 h-14 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-3">
            <GraduationCap className="w-7 h-7 stroke-1" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Chưa có hồ sơ giáo viên</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-5">
            Danh bạ cán bộ, giáo viên hiện đang trống hoặc không khớp bộ lọc.
          </p>
          {canCreate && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white text-xs font-semibold shadow-md flex items-center gap-2 hover:opacity-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Thêm giáo viên đầu tiên
            </button>
          )}
        </div>
      )}

      <UnifiedManualFormModal
        isOpen={isModalOpen}
        moduleKey="teachers"
        context={effectiveContext}
        existingRecords={teachers as unknown as Record<string, unknown>[]}
        initialValues={
          editingTeacher
            ? (editingTeacher as unknown as Record<string, unknown>)
            : undefined
        }
        editingRecordId={editingTeacher?.id}
        currentUser={currentUser}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTeacher(null);
        }}
        onSave={handleSaveManual}
      />

      <ExcelImportDialog
        isOpen={isImportOpen}
        moduleKey="teachers"
        context={effectiveContext}
        existingRecords={teachers as unknown as Record<string, unknown>[]}
        currentUser={currentUser}
        onClose={() => setIsImportOpen(false)}
        onCommitImport={handleCommit}
      />

      <ExcelExportDialog
        isOpen={isExportOpen}
        moduleKey="teachers"
        allRecords={teachers as unknown as Record<string, unknown>[]}
        filteredRecords={filteredTeachers as unknown as Record<string, unknown>[]}
        currentUser={currentUser}
        onClose={() => setIsExportOpen(false)}
        onLogExport={onLogExport}
      />

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        title="Xóa hồ sơ giáo viên"
        message={
          pendingDelete
            ? `Xác nhận xóa hồ sơ giáo viên ${pendingDelete.fullName} (${pendingDelete.subject})?`
            : ''
        }
        confirmLabel="Xóa hồ sơ"
        onConfirm={() => {
          if (pendingDelete && onDeleteTeacher) {
            onDeleteTeacher(pendingDelete.id);
          }
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};
