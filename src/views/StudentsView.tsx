import React, { useMemo, useState } from 'react';
import {
  Users, Search, Plus, Upload, Eye, Trash2,
  CreditCard, Award, Pencil, CalendarCheck, BookOpen, Layers
} from '../components/icons/UiIcons';
import {
  AcademicRecord,
  AttendanceRecord,
  BorrowTransaction,
  DataSourceConfig,
  DataSourceGroupKey,
  DataSourceMethod,
  ExportHistoryRecord,
  ImportHistoryRecord,
  ImportModuleKey,
  PermissionMatrix,
  SchoolClass,
  SchoolEvent,
  Student,
  StudentLeaveRequest,
  SystemSettings,
  Teacher,
  UserProfile,
} from '../types';
import { LiquidCard } from '../components/common/LiquidCard';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { BulkSelectionBar } from '../components/shared/BulkSelectionBar';
import { PresetClassesModal } from '../components/shared/PresetClassesModal';
import { CompactDataToolbar } from '../components/importExport/CompactDataToolbar';
import { DataSourceButton } from '../components/dataSources/DataSourceButton';
import { DataSourceModal } from '../components/dataSources/DataSourceModal';
import type {
  DataSourceExistingData,
  DataSourceRuntimeContext,
  GroupValidationResult,
} from '../utils/dataSources/templateEngine';
import { UnifiedManualFormModal } from '../components/importExport/UnifiedManualFormModal';
import { ExcelImportDialog } from '../components/importExport/ExcelImportDialog';
import { ExcelExportDialog } from '../components/importExport/ExcelExportDialog';
import { getSchemaByKey } from '../utils/importExport/schemas';
import { generateTemplateWorkbookBuffer, triggerBinaryDownload } from '../utils/importExport/excelEngine';
import type { ValidationDbContext } from '../utils/importExport/validator';
import { resolveCatalogOptions } from '../utils/catalogs/catalogRegistry';
import {
  DEFAULT_PERMISSIONS,
  filterStudentsByScope,
  hasPermission,
} from '../utils/rbac';
import { calculateAttendanceRate, classifyAcademicTier } from '../utils/academicRules';
import {
  areAllVisibleSelected,
  pruneStaleSelectedIds,
  toggleSelectAllVisible,
  toggleSelectedId,
} from '../utils/bulkSelection';

interface StudentsViewProps {
  students: Student[];
  classes?: SchoolClass[];
  teachers?: Teacher[];
  currentUser: UserProfile;
  customPermissions?: PermissionMatrix;
  validationContext?: ValidationDbContext;
  systemSettings?: SystemSettings;
  onSaveSettings?: (s: SystemSettings) => Promise<void> | void;
  onAddClass?: (c: SchoolClass) => void;
  onCreateClassesOnWeb?: (newClasses: SchoolClass[]) => Promise<void> | void;
  borrowTransactions: BorrowTransaction[];
  academicRecords?: AcademicRecord[];
  attendanceRecords?: AttendanceRecord[];
  schoolEvents?: SchoolEvent[];
  leaveRequests?: StudentLeaveRequest[];
  dataSourceConfigs?: DataSourceConfig[];
  isAdmin?: boolean;
  dataSourceRuntimeContext?: DataSourceRuntimeContext;
  dataSourceExistingData?: DataSourceExistingData;
  onSaveDataSourceConfig?: (cfg: DataSourceConfig) => Promise<void>;
  onDeleteDataSourceConfig?: (id: string) => Promise<void>;
  onCommitNormalizedGroupData?: (
    groupKey: DataSourceGroupKey,
    validation: GroupValidationResult,
    sourceMeta: { method: DataSourceMethod; sourceName: string }
  ) => Promise<{ createdCount: number; updatedCount: number }>;
  onAddStudent: (student: Student) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (studentId: string) => void;
  onDeleteStudents?: (studentIds: string[]) => Promise<void> | void;
  onUnifiedImportCommit?: (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => Promise<void> | void;
  onLogExport?: (record: ExportHistoryRecord) => Promise<void> | void;
  topLeftSlot?: React.ReactNode;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  students,
  classes = [],
  teachers = [],
  currentUser,
  customPermissions = DEFAULT_PERMISSIONS,
  validationContext,
  systemSettings,
  onSaveSettings,
  onAddClass,
  onCreateClassesOnWeb,
  borrowTransactions,
  academicRecords = [],
  attendanceRecords = [],
  schoolEvents = [],
  leaveRequests = [],
  dataSourceConfigs = [],
  isAdmin = false,
  dataSourceRuntimeContext,
  dataSourceExistingData,
  onSaveDataSourceConfig,
  onDeleteDataSourceConfig,
  onCommitNormalizedGroupData,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onDeleteStudents,
  onUnifiedImportCommit,
  onLogExport,
  topLeftSlot,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [profileTab, setProfileTab] = useState<'overview' | 'academic' | 'attendance' | 'library' | 'activities' | 'admin'>('overview');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [pendingDeleteStudent, setPendingDeleteStudent] = useState<Student | null>(null);
  const [pendingBulkDeleteIds, setPendingBulkDeleteIds] = useState<string[] | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isDataSourceOpen, setIsDataSourceOpen] = useState(false);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const effectiveContext: ValidationDbContext = useMemo(
    () =>
      validationContext ?? {
        classes,
        teachers,
        students,
      },
    [validationContext, classes, teachers, students]
  );

  const canCreate = hasPermission(currentUser.role, 'students', 'create', customPermissions);
  const canEdit = hasPermission(currentUser.role, 'students', 'edit', customPermissions);
  const canDelete = hasPermission(currentUser.role, 'students', 'delete', customPermissions);
  const canExport = hasPermission(currentUser.role, 'students', 'export', customPermissions);

  const scopedStudents = useMemo(
    () => filterStudentsByScope(students, currentUser, teachers),
    [students, currentUser, teachers]
  );

  const gradeOptions = useMemo(
    () => resolveCatalogOptions({ catalogId: 'student_grade', runtime: effectiveContext }),
    [effectiveContext]
  );

  const classOptions = useMemo(() => {
    const parentVal = selectedGrade === 'all' ? undefined : String(selectedGrade);
    const resolved = resolveCatalogOptions({
      catalogId: 'school_class',
      parentValue: parentVal,
      runtime: effectiveContext,
    });
    const map = new Map<string, string>();
    resolved.forEach((opt) => map.set(opt.value, opt.label));
    scopedStudents.forEach((s) => {
      if (s.className && (selectedGrade === 'all' || s.grade === selectedGrade)) {
        if (!map.has(s.className)) map.set(s.className, `Lớp ${s.className}`);
      }
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'vi'))
      .map(([value, label]) => ({ value, label }));
  }, [effectiveContext, scopedStudents, selectedGrade]);

  const handleGradeFilterChange = (raw: string) => {
    const nextGrade: number | 'all' = raw === 'all' ? 'all' : Number(raw);
    setSelectedGrade(nextGrade);
    if (nextGrade !== 'all' && selectedClass !== 'all') {
      const validForGrade = resolveCatalogOptions({
        catalogId: 'school_class',
        parentValue: String(nextGrade),
        runtime: effectiveContext,
      }).some((o) => o.value === selectedClass);
      const hasStudentInGrade = scopedStudents.some(
        (s) => s.grade === nextGrade && s.className === selectedClass
      );
      if (!validForGrade && !hasStudentInGrade) {
        setSelectedClass('all');
      }
    }
  };

  // Compute live GPA & attendance rate for each student from real records
  const studentMetricsMap = useMemo(() => {
    const map = new Map<string, { gpa: number | null; attendanceRate: number | null; totalAtt: number; presentAtt: number; excusedAtt: number; unexcusedAtt: number }>();
    for (const s of scopedStudents) {
      const sGrades = academicRecords.filter(
        (r) => r.studentId === s.id || r.studentCode === s.studentCode
      );
      const validAvg = sGrades.length > 0
        ? Math.round((sGrades.reduce((sum, g) => sum + g.averageScore, 0) / sGrades.length) * 10) / 10
        : (typeof s.gpa === 'number' ? s.gpa : null);

      const sAtt = attendanceRecords.filter(
        (a) => a.studentId === s.id || a.studentCode === s.studentCode
      );
      const presentAtt = sAtt.filter((a) => a.status === 'present' || a.status === 'late').length;
      const excusedAtt = sAtt.filter((a) => a.status === 'absent_excused').length;
      const unexcusedAtt = sAtt.filter((a) => a.status === 'absent_unexcused').length;
      const rate = sAtt.length > 0
        ? calculateAttendanceRate(presentAtt, sAtt.length).ratePercentage
        : (typeof s.attendanceRate === 'number' ? s.attendanceRate : null);

      map.set(s.id, {
        gpa: validAvg,
        attendanceRate: rate,
        totalAtt: sAtt.length,
        presentAtt,
        excusedAtt,
        unexcusedAtt,
      });
    }
    return map;
  }, [scopedStudents, academicRecords, attendanceRecords]);

  const filteredStudents = scopedStudents.filter((s) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      s.fullName.toLowerCase().includes(q) ||
      s.studentCode.toLowerCase().includes(q) ||
      s.rfidCardId.toLowerCase().includes(q);
    const matchesGrade = selectedGrade === 'all' || s.grade === selectedGrade;
    const matchesClass = selectedClass === 'all' || s.className === selectedClass;
    return matchesSearch && matchesGrade && matchesClass;
  });

  const effectiveSelectedIds = useMemo(
    () => pruneStaleSelectedIds(selectedIds, scopedStudents.map((s) => s.id)),
    [selectedIds, scopedStudents]
  );

  const visibleStudentIds = useMemo(
    () => filteredStudents.map((s) => s.id),
    [filteredStudents]
  );

  const selectedRecords = useMemo(
    () => scopedStudents.filter((s) => effectiveSelectedIds.includes(s.id)),
    [scopedStudents, effectiveSelectedIds]
  );

  const handleConfirmBulkDelete = async () => {
    if (!pendingBulkDeleteIds || pendingBulkDeleteIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      if (onDeleteStudents) {
        await onDeleteStudents(pendingBulkDeleteIds);
      } else {
        for (const id of pendingBulkDeleteIds) {
          await onDeleteStudent(id);
        }
      }
      const deletedSet = new Set(pendingBulkDeleteIds);
      setSelectedIds((prev) => prev.filter((id) => !deletedSet.has(id)));
      if (selectedStudent && deletedSet.has(selectedStudent.id)) {
        setSelectedStudent(null);
      }
    } finally {
      setIsBulkDeleting(false);
      setPendingBulkDeleteIds(null);
    }
  };

  const handleDownloadTemplate = async () => {
    const schema = getSchemaByKey('students');
    const bytes = await generateTemplateWorkbookBuffer(schema, effectiveContext);
    triggerBinaryDownload(
      bytes,
      schema.templateFileName,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  };

  const openAddModal = () => {
    setEditingStudent(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setIsAddModalOpen(true);
  };

  const handleSaveUnifiedManual = async (entity: Record<string, unknown>, isEdit: boolean) => {
    const payload = entity as unknown as Student;
    if (isEdit) {
      onUpdateStudent(payload);
      if (selectedStudent?.id === payload.id) setSelectedStudent(payload);
    } else {
      onAddStudent(payload);
    }
    setEditingStudent(null);
  };

  const handleFallbackImportCommit = async (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => {
    if (onUnifiedImportCommit) {
      await onUnifiedImportCommit(moduleKey, entitiesToSave, historyRecord);
      return;
    }
    for (const item of entitiesToSave) {
      const stu = item as unknown as Student;
      const exists = students.some((s) => s.id === stu.id);
      if (exists) onUpdateStudent(stu);
      else onAddStudent(stu);
    }
  };

  const selectedMetrics = selectedStudent ? studentMetricsMap.get(selectedStudent.id) : undefined;
  const selectedStudentGrades = useMemo(
    () =>
      selectedStudent
        ? academicRecords.filter(
            (r) => r.studentId === selectedStudent.id || r.studentCode === selectedStudent.studentCode
          )
        : [],
    [selectedStudent, academicRecords]
  );
  const selectedStudentAttendance = useMemo(
    () =>
      selectedStudent
        ? attendanceRecords.filter(
            (a) => a.studentId === selectedStudent.id || a.studentCode === selectedStudent.studentCode
          )
        : [],
    [selectedStudent, attendanceRecords]
  );
  const selectedStudentEvents = useMemo(
    () =>
      selectedStudent
        ? schoolEvents.filter((ev) => ev.registeredUserIds?.includes(selectedStudent.id))
        : [],
    [selectedStudent, schoolEvents]
  );
  const selectedStudentLeaves = useMemo(
    () =>
      selectedStudent
        ? leaveRequests.filter(
            (lr) => lr.studentId === selectedStudent.id || lr.studentCode === selectedStudent.studentCode
          )
        : [],
    [selectedStudent, leaveRequests]
  );

  return (
    <div className="space-y-5">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {topLeftSlot ?? <span />}
        <CompactDataToolbar
          canCreate={canCreate}
          canImport={canCreate}
          canExport={canExport}
          createLabel="Thêm Học sinh"
          selectedCount={selectedRecords.length}
          onManualAdd={openAddModal}
          onDownloadTemplate={handleDownloadTemplate}
          onOpenImport={() => setIsImportModalOpen(true)}
          onOpenExport={() => setIsExportModalOpen(true)}
          extraActions={
            (canCreate && systemSettings && onSaveSettings) || (isAdmin && onSaveDataSourceConfig) ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {canCreate && systemSettings && onSaveSettings && (
                  <button
                    type="button"
                    onClick={() => setIsPresetModalOpen(true)}
                    data-testid="students-preset-classes-btn"
                    className="px-3 py-1.5 rounded-xl glass-subsurface text-xs font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-500/12 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    title="Cài đặt trước danh sách lớp dùng chung cho Sheet tab & Drop-down Excel"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Lớp cài đặt trước ({(systemSettings.presetClasses || []).length})</span>
                  </button>
                )}
                {isAdmin && onSaveDataSourceConfig && (
                  <DataSourceButton
                    groupKey="students"
                    config={dataSourceConfigs.find((c) => c.groupKey === 'students')}
                    isAdmin={isAdmin}
                    onClick={() => setIsDataSourceOpen(true)}
                  />
                )}
              </div>
            ) : undefined
          }
        />
      </div>

      {isAdmin && onSaveDataSourceConfig && onCommitNormalizedGroupData && (
        <DataSourceModal
          isOpen={isDataSourceOpen}
          onClose={() => setIsDataSourceOpen(false)}
          groupKey="students"
          allConfigs={dataSourceConfigs}
          runtimeContext={
            dataSourceRuntimeContext ?? {
              classes,
              academicYears: [],
              rooms: [],
            }
          }
          existingData={
            dataSourceExistingData ?? {
              students,
              teachers,
              staffMembers: [],
              timetable: [],
              afternoonSchedules: [],
              books: [],
              facilities: [],
            }
          }
          currentUserEmail={currentUser.email}
          currentUserName={currentUser.displayName}
          onSaveConfig={onSaveDataSourceConfig}
          onDeleteConfig={onDeleteDataSourceConfig}
          onCommitNormalizedGroupData={onCommitNormalizedGroupData}
        />
      )}

      {/* Filter and Search Bar */}
      <LiquidCard className="p-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên học sinh, mã STU, mã RFID..."
              className="w-full glass-subsurface rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={selectedGrade}
              onChange={(e) => handleGradeFilterChange(e.target.value)}
              className="w-full glass-subsurface rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
            >
              <option value="all">Tất cả Khối lớp</option>
              {gradeOptions.map((g) => (
                <option key={g.id} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full glass-subsurface rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
            >
              <option value="all">Tất cả các Lớp</option>
              {classOptions.map((cOpt) => (
                <option key={cOpt.value} value={cOpt.value}>
                  {cOpt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </LiquidCard>

      {/* Bulk Selection Bar */}
      <BulkSelectionBar
        totalVisibleCount={filteredStudents.length}
        selectedCount={effectiveSelectedIds.length}
        allVisibleSelected={areAllVisibleSelected(effectiveSelectedIds, visibleStudentIds)}
        canDelete={canDelete}
        entityLabel="học sinh"
        showSelectAll={false}
        isDeleting={isBulkDeleting}
        testIdPrefix="students-bulk"
        onToggleSelectAll={() =>
          setSelectedIds((prev) => toggleSelectAllVisible(prev, visibleStudentIds))
        }
        onClearSelection={() => setSelectedIds([])}
        onRequestBulkDelete={() => setPendingBulkDeleteIds(effectiveSelectedIds)}
      />

      {/* Student Table */}
      <div className="glass-table-shell">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="glass-table-head">
              <tr>
                <th className="pl-4 pr-2 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={areAllVisibleSelected(effectiveSelectedIds, visibleStudentIds)}
                    onChange={() =>
                      setSelectedIds((prev) => toggleSelectAllVisible(prev, visibleStudentIds))
                    }
                    aria-label="Chọn tất cả học sinh đang lọc"
                  />
                </th>
                <th className="px-3 py-3">Học sinh</th>
                <th className="px-3 py-3">Mã STU</th>
                <th className="px-3 py-3">Lớp</th>
                <th className="px-3 py-3">Mã Thẻ RFID</th>
                <th className="px-3 py-3">GPA</th>
                <th className="px-3 py-3">Chuyên cần</th>
                <th className="px-3 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => {
                const metrics = studentMetricsMap.get(student.id);
                const isSelected = effectiveSelectedIds.includes(student.id);
                return (
                  <tr key={student.id} className={`glass-table-row group ${isSelected ? 'bg-sky-500/12 dark:bg-sky-400/12' : ''}`}>
                    <td className="pl-4 pr-2 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() =>
                          setSelectedIds((prev) => toggleSelectedId(prev, student.id))
                        }
                        aria-label={`Chọn ${student.fullName}`}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-sky-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {student.fullName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm truncate">
                            {student.fullName}
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                            {student.gender} · {student.dateOfBirth}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs font-semibold text-sky-800 dark:text-sky-300 tabular-nums whitespace-nowrap">
                      {student.studentCode}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{student.className}</span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="font-mono text-[11px] text-teal-700 dark:text-teal-300 inline-flex items-center gap-1 tabular-nums">
                        <CreditCard className="w-3 h-3 shrink-0" />
                        {student.rfidCardId}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-800 dark:text-slate-200 tabular-nums whitespace-nowrap">
                      {metrics?.gpa !== null && metrics?.gpa !== undefined ? (
                        <span
                          className={
                            metrics.gpa >= 9.0
                              ? 'text-purple-600 dark:text-purple-400 font-bold'
                              : metrics.gpa >= 8.0
                              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                              : 'text-slate-700 dark:text-slate-200'
                          }
                        >
                          {metrics.gpa.toFixed(1)} / 10
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-normal">Chưa có điểm</span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {metrics?.attendanceRate !== null && metrics?.attendanceRate !== undefined ? (
                        <div className="flex items-center gap-2">
                          <div className="w-14 h-1.5 bg-slate-900/10 dark:bg-white/15 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${metrics.attendanceRate}%` }}
                            />
                          </div>
                          <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px] tabular-nums">
                            {metrics.attendanceRate}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">Chưa điểm danh</span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <Badge
                        variant={
                          student.status === 'Đang học'
                            ? 'mint'
                            : student.status === 'Tạm dừng học'
                            ? 'amber'
                            : 'gray'
                        }
                        size="sm"
                      >
                        {student.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStudent(student);
                            setProfileTab('overview');
                          }}
                          aria-label={`Xem hồ sơ ${student.fullName}`}
                          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors cursor-pointer"
                          title="Xem học bạ & hồ sơ chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openEditModal(student)}
                            aria-label={`Chỉnh sửa ${student.fullName}`}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                            title="Chỉnh sửa hồ sơ"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}

                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setPendingDeleteStudent(student)}
                            aria-label={`Xóa học sinh ${student.fullName}`}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Xóa hồ sơ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {scopedStudents.length === 0 ? (
            <div className="py-14 px-4 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-3 border border-sky-100 dark:border-sky-800/50">
                <Users className="w-7 h-7 stroke-1" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Chưa có dữ liệu học sinh</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1 mb-5">
                Cơ sở dữ liệu học sinh trong phạm vi của bạn hiện đang trống. Hãy thêm học sinh hoặc nhập từ Excel.
              </p>
              {canCreate && (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={openAddModal}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-md shadow-sky-500/20 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Thêm học sinh đầu tiên
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(true)}
                    className="px-4 py-2 rounded-xl glass-subsurface hover:bg-white/80 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Nhập từ Excel (.xlsx)
                  </button>
                </div>
              )}
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-12 text-center text-slate-600 dark:text-slate-300 text-xs">
              Không tìm thấy học sinh nào phù hợp với bộ lọc hiện tại.
            </div>
          ) : null}
        </div>
      </div>

      {/* Detail Modal with 6 Real Data Tabs */}
      {selectedStudent && (
        <Modal
          isOpen={!!selectedStudent}
          onClose={() => setSelectedStudent(null)}
          title={`Hồ sơ Học bạ: ${selectedStudent.fullName}`}
          description={`Mã học sinh: ${selectedStudent.studentCode} · Lớp ${selectedStudent.className}`}
          maxWidth="3xl"
        >
          <div className="space-y-4">
            <div className="glass-pill-tray flex items-center gap-1 overflow-x-auto text-xs font-semibold scrollbar-none">
              {[
                { id: 'overview', label: '1. Tổng quan' },
                { id: 'academic', label: '2. Học tập' },
                { id: 'attendance', label: '3. Chuyên cần' },
                { id: 'library', label: '4. Thư viện' },
                { id: 'activities', label: '5. Hoạt động & Đơn từ' },
                { id: 'admin', label: '6. Hành chính' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setProfileTab(tab.id as typeof profileTab)}
                  className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                    profileTab === tab.id
                      ? 'glass-pill-tab-active'
                      : 'glass-pill-tab'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {profileTab === 'overview' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl glass-subsurface">
                    <p className="text-slate-500 dark:text-slate-400">Họ và tên</p>
                    <p className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-0.5">{selectedStudent.fullName}</p>
                  </div>
                  <div className="p-3 rounded-xl glass-subsurface">
                    <p className="text-slate-500 dark:text-slate-400">Mã định danh</p>
                    <p className="font-mono font-bold text-sky-700 dark:text-sky-300 text-sm mt-0.5">{selectedStudent.studentCode}</p>
                  </div>
                  <div className="p-3 rounded-xl glass-subsurface">
                    <p className="text-slate-500 dark:text-slate-400">Lớp học hiện tại</p>
                    <p className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-0.5">{selectedStudent.className}</p>
                  </div>
                  <div className="p-3 rounded-xl glass-subsurface">
                    <p className="text-slate-500 dark:text-slate-400">Mã Thẻ RFID</p>
                    <p className="font-mono font-bold text-teal-700 dark:text-teal-300 text-sm mt-0.5">{selectedStudent.rfidCardId}</p>
                  </div>
                  <div className="p-3 rounded-xl glass-subsurface">
                    <p className="text-slate-500 dark:text-slate-400">Hạnh kiểm</p>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm mt-0.5">{selectedStudent.conduct || 'Chưa đánh giá'}</p>
                  </div>
                  <div className="p-3 rounded-xl glass-subsurface">
                    <p className="text-slate-500 dark:text-slate-400">Trạng thái học vụ</p>
                    <p className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-0.5">{selectedStudent.status}</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl glass-subsurface bg-sky-500/10 border-sky-400/30 flex items-start gap-3">
                  <Award className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-slate-100">Tổng hợp hồ sơ thực tế</h4>
                    <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                      {selectedMetrics?.gpa !== null && selectedMetrics?.gpa !== undefined
                        ? `GPA tích lũy hiện tại: ${selectedMetrics.gpa.toFixed(1)}/10 (${classifyAcademicTier(selectedMetrics.gpa)}).`
                        : 'Chưa có điểm môn học được nhập trong kỳ.'}{' '}
                      {selectedMetrics?.attendanceRate !== null && selectedMetrics?.attendanceRate !== undefined
                        ? `Tỷ lệ chuyên cần ghi nhận: ${selectedMetrics.attendanceRate}% (${selectedMetrics.presentAtt}/${selectedMetrics.totalAtt} buổi).`
                        : 'Chưa có dữ liệu điểm danh.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {profileTab === 'academic' && (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl glass-subsurface flex items-center justify-between">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">Điểm trung bình tích lũy (GPA):</span>
                  <span className="text-base font-extrabold text-sky-700 dark:text-sky-300 tabular-nums">
                    {selectedMetrics?.gpa !== null && selectedMetrics?.gpa !== undefined
                      ? `${selectedMetrics.gpa.toFixed(1)} / 10`
                      : 'Chưa có dữ liệu'}
                  </span>
                </div>
                <div className="p-3 rounded-xl glass-subsurface">
                  <p className="font-bold text-slate-800 dark:text-slate-100 mb-2">Bảng điểm các môn học đã nhập:</p>
                  {selectedStudentGrades.length > 0 ? (
                    <div className="space-y-1.5">
                      {selectedStudentGrades.map((row) => (
                        <div
                          key={row.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-1.5 border-b border-white/40 dark:border-white/10 last:border-0"
                        >
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {row.subjectName} ({row.semester})
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                            TX: [{row.scoreRegular.join(', ')}] · GK: {row.scoreMidterm} · CK: {row.scoreFinal}
                          </span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            ĐTB: {row.averageScore.toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center gap-1.5">
                      <BookOpen className="w-6 h-6 stroke-1" />
                      <span>Chưa có điểm số nào được giáo viên nhập cho học sinh này.</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {profileTab === 'attendance' && (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl glass-subsurface bg-emerald-500/10 border-emerald-400/30 flex items-center justify-between">
                  <span className="font-bold text-emerald-900 dark:text-emerald-200">Tỷ lệ Chuyên cần ghi nhận:</span>
                  <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-300 tabular-nums">
                    {selectedMetrics?.attendanceRate !== null && selectedMetrics?.attendanceRate !== undefined
                      ? `${selectedMetrics.attendanceRate}%`
                      : 'Chưa có dữ liệu'}
                  </span>
                </div>
                <div className="p-3 rounded-xl glass-subsurface">
                  <p className="font-bold text-slate-800 dark:text-slate-100 mb-2">Chi tiết điểm danh thực tế:</p>
                  {selectedStudentAttendance.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-slate-600 dark:text-slate-300 tabular-nums">
                        Tổng buổi: <strong>{selectedMetrics?.totalAtt}</strong> · Có mặt/Đi muộn:{' '}
                        <strong className="text-emerald-600 dark:text-emerald-400">{selectedMetrics?.presentAtt}</strong> · Vắng có phép:{' '}
                        <strong className="text-sky-600 dark:text-sky-400">{selectedMetrics?.excusedAtt}</strong> · Vắng không phép:{' '}
                        <strong className="text-rose-600 dark:text-rose-400">{selectedMetrics?.unexcusedAtt}</strong>
                      </p>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {selectedStudentAttendance.slice(0, 15).map((att) => (
                          <div key={att.id} className="flex items-center justify-between py-1 border-b border-white/40 dark:border-white/10 last:border-0">
                            <span className="font-mono text-slate-600 dark:text-slate-300">{att.date}</span>
                            <span className="text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{att.reason || 'Điểm danh lớp'}</span>
                            <Badge
                              variant={
                                att.status === 'present'
                                  ? 'mint'
                                  : att.status === 'late'
                                  ? 'amber'
                                  : att.status === 'absent_excused'
                                  ? 'blue'
                                  : 'pink'
                              }
                              size="sm"
                            >
                              {att.status === 'present'
                                ? 'Có mặt'
                                : att.status === 'late'
                                ? 'Đi muộn'
                                : att.status === 'absent_excused'
                                ? 'Vắng có phép'
                                : 'Vắng KP'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center gap-1.5">
                      <CalendarCheck className="w-6 h-6 stroke-1" />
                      <span>Chưa có buổi điểm danh nào được lưu cho học sinh này.</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {profileTab === 'library' && (
              <div className="space-y-3 text-xs">
                <p className="font-bold text-slate-800 dark:text-slate-100">Lịch sử mượn trả Thư viện RFID:</p>
                {borrowTransactions.filter(
                  (t) => t.studentId === selectedStudent.id || t.studentCode === selectedStudent.studentCode
                ).length > 0 ? (
                  <div className="space-y-2">
                    {borrowTransactions
                      .filter((t) => t.studentId === selectedStudent.id || t.studentCode === selectedStudent.studentCode)
                      .map((trans) => (
                        <div
                          key={trans.id}
                          className="p-3 rounded-xl glass-subsurface flex items-center justify-between"
                        >
                          <div>
                            <p className="font-bold text-slate-900 dark:text-slate-100">{trans.bookTitle}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              {trans.transactionCode} · Bản sao: {trans.copyBarcode} · Hạn trả: {trans.dueDate}
                            </p>
                          </div>
                          <Badge
                            variant={
                              trans.status === 'borrowed'
                                ? 'blue'
                                : trans.status === 'overdue' || trans.status === 'lost'
                                ? 'pink'
                                : 'mint'
                            }
                          >
                            {trans.status === 'borrowed'
                              ? 'Đang mượn'
                              : trans.status === 'overdue'
                              ? 'Quá hạn'
                              : trans.status === 'lost'
                              ? 'Báo mất'
                              : 'Đã trả'}
                          </Badge>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-500 dark:text-slate-400 glass-subsurface rounded-xl">
                    Chưa có giao dịch mượn sách nào trong kỳ.
                  </div>
                )}
              </div>
            )}

            {profileTab === 'activities' && (
              <div className="space-y-3 text-xs">
                <p className="font-bold text-slate-800 dark:text-slate-100">Sự kiện đã đăng ký &amp; Đơn xin phép:</p>
                {selectedStudentEvents.length === 0 && selectedStudentLeaves.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 dark:text-slate-400 glass-subsurface rounded-xl">
                    Chưa có sự kiện ngoại khóa hoặc đơn từ nào được ghi nhận.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedStudentEvents.map((ev) => (
                      <div key={ev.id} className="p-3 rounded-xl glass-subsurface">
                        <p className="font-bold text-slate-900 dark:text-slate-100">{ev.title}</p>
                        <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                          {ev.date} · {ev.time} · {ev.location}
                        </p>
                      </div>
                    ))}
                    {selectedStudentLeaves.map((lr) => (
                      <div key={lr.id} className="p-3 rounded-xl glass-subsurface flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-slate-100">{lr.type} ({lr.fromDate} → {lr.toDate})</p>
                          <p className="text-slate-500 dark:text-slate-400">{lr.reason}</p>
                        </div>
                        <Badge variant={lr.status === 'approved' ? 'mint' : lr.status === 'rejected' ? 'pink' : 'amber'}>
                          {lr.status === 'approved' ? 'Đã duyệt' : lr.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {profileTab === 'admin' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl glass-subsurface">
                  <p className="text-slate-500 dark:text-slate-400">Họ tên Phụ huynh / Giám hộ</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                    {selectedStudent.parentName
                      ? `${selectedStudent.parentName} (${selectedStudent.parentRelation || 'Phụ huynh'})`
                      : 'Chưa cập nhật'}
                  </p>
                </div>
                <div className="p-3 rounded-xl glass-subsurface">
                  <p className="text-slate-500 dark:text-slate-400">Số điện thoại liên hệ Phụ huynh</p>
                  <p className="font-semibold text-sky-700 dark:text-sky-300 mt-0.5 tabular-nums">
                    {selectedStudent.parentPhone || 'Chưa cập nhật'}
                  </p>
                </div>
                <div className="p-3 rounded-xl glass-subsurface">
                  <p className="text-slate-500 dark:text-slate-400">Email liên hệ &amp; Niên khóa</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
                    {selectedStudent.email || 'Chưa có email'} · {selectedStudent.academicYear || '2026 - 2027'}
                  </p>
                </div>
                <div className="p-3 rounded-xl glass-subsurface">
                  <p className="text-slate-500 dark:text-slate-400">Địa chỉ thường trú</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
                    {selectedStudent.address || 'Chưa cập nhật'}
                  </p>
                </div>
                {selectedStudent.notes && (
                  <div className="sm:col-span-2 p-3 rounded-xl glass-subsurface">
                    <p className="text-slate-500 dark:text-slate-400">Ghi chú hồ sơ</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
                      {selectedStudent.notes}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Unified Manual Add / Edit Modal (100% synced with Excel Schema) */}
      <UnifiedManualFormModal
        isOpen={isAddModalOpen}
        moduleKey="students"
        context={effectiveContext}
        existingRecords={students as unknown as Record<string, unknown>[]}
        initialValues={
          editingStudent
            ? (editingStudent as unknown as Record<string, unknown>)
            : {
                studentCode: `STU-2026-${String(students.length + 101).padStart(4, '0')}`,
                rfidCardId: `RFID-${Math.floor(100000 + Math.random() * 900000)}`,
                className: classes[0]?.name || '',
                grade: classes[0]?.grade || 10,
                academicYear: effectiveContext.systemSettings?.academicYear || '2026 - 2027',
              }
        }
        editingRecordId={editingStudent?.id}
        currentUser={currentUser}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingStudent(null);
        }}
        onSave={handleSaveUnifiedManual}
      />

      {/* Unified 7-Step Excel Import Dialog */}
      <ExcelImportDialog
        isOpen={isImportModalOpen}
        moduleKey="students"
        context={effectiveContext}
        existingRecords={students as unknown as Record<string, unknown>[]}
        currentUser={currentUser}
        onClose={() => setIsImportModalOpen(false)}
        onCommitImport={handleFallbackImportCommit}
      />

      {/* Unified Scoped Excel/CSV Export Dialog */}
      <ExcelExportDialog
        isOpen={isExportModalOpen}
        moduleKey="students"
        context={effectiveContext}
        allRecords={scopedStudents as unknown as Record<string, unknown>[]}
        filteredRecords={filteredStudents as unknown as Record<string, unknown>[]}
        selectedRecords={selectedRecords as unknown as Record<string, unknown>[]}
        currentUser={currentUser}
        onClose={() => setIsExportModalOpen(false)}
        onLogExport={onLogExport}
      />

      <ConfirmDialog
        isOpen={Boolean(pendingDeleteStudent)}
        title="Xóa hồ sơ học sinh"
        message={
          pendingDeleteStudent
            ? `Xác nhận xóa học sinh ${pendingDeleteStudent.fullName} (${pendingDeleteStudent.studentCode}) khỏi hệ thống?`
            : ''
        }
        confirmLabel="Xóa hồ sơ"
        onConfirm={() => {
          if (pendingDeleteStudent) {
            onDeleteStudent(pendingDeleteStudent.id);
            setSelectedIds((prev) => prev.filter((id) => id !== pendingDeleteStudent.id));
          }
          setPendingDeleteStudent(null);
        }}
        onCancel={() => setPendingDeleteStudent(null)}
      />

      <ConfirmDialog
        isOpen={Boolean(pendingBulkDeleteIds && pendingBulkDeleteIds.length > 0)}
        title="Xác nhận xóa nhiều học sinh"
        message={
          pendingBulkDeleteIds
            ? `Bạn có chắc muốn xóa ${pendingBulkDeleteIds.length} hồ sơ học sinh đã chọn khỏi hệ thống? Thao tác này không thể hoàn tác.`
            : ''
        }
        confirmLabel={`Xóa ${pendingBulkDeleteIds?.length || 0} học sinh`}
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
