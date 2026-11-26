import React, { useMemo, useState } from 'react';
import {
  Briefcase,
  CalendarRange,
  CheckCircle2,
  GraduationCap,
  Mail,
  Pencil,
  Phone,
  Plus,
  School,
  Search,
  Trash2,
  UserCheck,
  Users,
} from '../icons/UiIcons';
import {
  AcademicRecord,
  AcademicYearConfig,
  AttendanceRecord,
  BorrowTransaction,
  ClassPlacement,
  Competition,
  CompetitionAward,
  CompetitionCriterion,
  CompetitionParticipant,
  CompetitionScore,
  DataSourceConfig,
  DataSourceGroupKey,
  DataSourceMethod,
  EmulationAppeal,
  EmulationPeriod,
  EmulationRecord,
  EmulationSnapshot,
  EmulationTitleConfig,
  ExportHistoryRecord,
  ImportHistoryRecord,
  ImportModuleKey,
  PermissionMatrix,
  RuleCategory,
  RuleCriterion,
  RuleDocument,
  RuleVersion,
  SchoolClass,
  SchoolEvent,
  SchoolRoom,
  ScoreTransferRecord,
  StaffMember,
  Student,
  StudentLeaveRequest,
  SystemSettings,
  Teacher,
  TeachingAssignment,
  UserProfile,
} from '../../types';
import { AppWindowShell } from '../shared/AppWindowShell';
import { EmptyState } from '../shared/EmptyState';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { BulkSelectionBar } from '../shared/BulkSelectionBar';
import { LiquidCard } from '../common/LiquidCard';
import { Badge } from '../common/Badge';
import { StudentsView } from '../../views/StudentsView';
import { StaffView } from '../../views/StaffView';
import { ClassesView } from '../../views/ClassesView';
import { ModuleDataActions } from '../importExport/ModuleDataActions';
import { UnifiedManualFormModal } from '../importExport/UnifiedManualFormModal';
import { EmulationHubView } from '../emulation/EmulationHubView';
import { DataSourceButton } from '../dataSources/DataSourceButton';
import { DataSourceModal } from '../dataSources/DataSourceModal';
import type {
  DataSourceExistingData,
  DataSourceRuntimeContext,
  GroupValidationResult,
} from '../../utils/dataSources/templateEngine';
import type { ValidationDbContext } from '../../utils/importExport/validator';
import { DEFAULT_PERMISSIONS, hasPermission } from '../../utils/rbac';
import {
  areAllVisibleSelected,
  partitionPrefixedKeys,
  pruneStaleSelectedIds,
  toggleSelectAllVisible,
  toggleSelectedId,
} from '../../utils/bulkSelection';
import {
  buildUnifiedHRRecords,
  filterUnifiedHRRecords,
  filterUnifiedStudents,
  type UnifiedHRGroup,
} from '../../utils/streamlinedHelpers';

interface SchoolManagementAppProps {
  activeTab: string;
  currentUser: UserProfile;
  customPermissions?: PermissionMatrix;
  students: Student[];
  teachers: Teacher[];
  staffMembers: StaffMember[];
  classes: SchoolClass[];
  rooms: SchoolRoom[];
  academicYears: AcademicYearConfig[];
  classPlacements?: ClassPlacement[];
  teachingAssignments?: TeachingAssignment[];
  validationContext?: ValidationDbContext;
  borrowTransactions: BorrowTransaction[];
  academicRecords: AcademicRecord[];
  attendanceRecords: AttendanceRecord[];
  schoolEvents: SchoolEvent[];
  leaveRequests: StudentLeaveRequest[];
  systemSettings: SystemSettings;
  ruleDocuments?: RuleDocument[];
  ruleVersions?: RuleVersion[];
  ruleCategories?: RuleCategory[];
  ruleCriteria?: RuleCriterion[];
  emulationRecords?: EmulationRecord[];
  emulationAppeals?: EmulationAppeal[];
  emulationPeriods?: EmulationPeriod[];
  emulationSnapshots?: EmulationSnapshot[];
  emulationTitleConfigs?: EmulationTitleConfig[];
  competitions?: Competition[];
  competitionCriteria?: CompetitionCriterion[];
  competitionParticipants?: CompetitionParticipant[];
  competitionScores?: CompetitionScore[];
  competitionAwards?: CompetitionAward[];
  scoreTransfers?: ScoreTransferRecord[];
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
  onSelectTab: (tabId: string) => void;
  onSaveSettings?: (s: SystemSettings) => Promise<void> | void;
  onAddStudent: (s: Student) => void;
  onUpdateStudent: (s: Student) => void;
  onDeleteStudent: (id: string) => void;
  onDeleteStudents?: (ids: string[]) => Promise<void> | void;
  onAddTeacher: (t: Teacher) => void;
  onUpdateTeacher: (t: Teacher) => void;
  onDeleteTeacher: (id: string) => void;
  onDeleteTeachers?: (ids: string[]) => Promise<void> | void;
  onSaveStaffMember: (m: StaffMember) => void;
  onDeleteStaffMember: (id: string) => void;
  onDeleteStaffMembers?: (ids: string[]) => Promise<void> | void;
  onAddClass: (c: SchoolClass) => void;
  onUpdateClass: (c: SchoolClass) => void;
  onDeleteClass: (id: string) => void;
  onDeleteClasses?: (ids: string[]) => Promise<void> | void;
  onCreateClassesOnWeb?: (newClasses: SchoolClass[]) => Promise<void> | void;
  onSaveAcademicYear: (y: AcademicYearConfig) => void;
  onSaveRuleDocument?: (doc: RuleDocument) => Promise<void> | void;
  onSaveRuleVersion?: (ver: RuleVersion) => Promise<void> | void;
  onSaveRuleCategory?: (cat: RuleCategory) => Promise<void> | void;
  onSaveRuleCriterion?: (crit: RuleCriterion) => Promise<void> | void;
  onDeleteRuleCriterion?: (id: string) => Promise<void> | void;
  onDeleteRuleCriteria?: (ids: string[]) => Promise<void> | void;
  onSaveEmulationRecord?: (rec: EmulationRecord) => Promise<void> | void;
  onSaveEmulationAppeal?: (appeal: EmulationAppeal) => Promise<void> | void;
  onSaveEmulationPeriod?: (period: EmulationPeriod) => Promise<void> | void;
  onSaveEmulationSnapshot?: (snap: EmulationSnapshot) => Promise<void> | void;
  onSaveTitleConfig?: (cfg: EmulationTitleConfig) => Promise<void> | void;
  onDeleteTitleConfig?: (id: string) => Promise<void> | void;
  onSaveCompetition?: (comp: Competition) => Promise<void> | void;
  onSaveCompetitionCriterion?: (crit: CompetitionCriterion) => Promise<void> | void;
  onDeleteCompetitionCriterion?: (id: string) => Promise<void> | void;
  onSaveCompetitionParticipant?: (part: CompetitionParticipant) => Promise<void> | void;
  onSaveCompetitionScore?: (score: CompetitionScore) => Promise<void> | void;
  onSaveCompetitionAward?: (award: CompetitionAward) => Promise<void> | void;
  onSaveScoreTransfer?: (transfer: ScoreTransferRecord) => Promise<void> | void;
  onUnifiedImportCommit?: (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => Promise<void> | void;
  onLogExport?: (record: ExportHistoryRecord) => Promise<void> | void;
}

const noop = () => {};

type StudentsClassesMode = 'overview' | 'students' | 'classes' | 'years';
type StaffHrMode = 'directory' | 'teachers' | 'staff';

export const SchoolManagementApp: React.FC<SchoolManagementAppProps> = ({
  activeTab,
  currentUser,
  customPermissions = DEFAULT_PERMISSIONS,
  students,
  teachers,
  staffMembers,
  classes,
  rooms,
  academicYears,
  classPlacements = [],
  teachingAssignments = [],
  validationContext,
  borrowTransactions,
  academicRecords,
  attendanceRecords,
  schoolEvents,
  leaveRequests,
  systemSettings,
  ruleDocuments = [],
  ruleVersions = [],
  ruleCategories = [],
  ruleCriteria = [],
  emulationRecords = [],
  emulationAppeals = [],
  emulationPeriods = [],
  emulationSnapshots = [],
  emulationTitleConfigs = [],
  competitions = [],
  competitionCriteria = [],
  competitionParticipants = [],
  competitionScores = [],
  competitionAwards = [],
  scoreTransfers = [],
  dataSourceConfigs = [],
  isAdmin = false,
  dataSourceRuntimeContext,
  dataSourceExistingData,
  onSaveDataSourceConfig,
  onDeleteDataSourceConfig,
  onCommitNormalizedGroupData,
  onSelectTab,
  onSaveSettings = noop,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onDeleteStudents,
  onAddTeacher,
  onUpdateTeacher,
  onDeleteTeacher,
  onDeleteTeachers,
  onSaveStaffMember,
  onDeleteStaffMember,
  onDeleteStaffMembers,
  onAddClass,
  onUpdateClass,
  onDeleteClass,
  onDeleteClasses,
  onCreateClassesOnWeb,
  onSaveAcademicYear,
  onSaveRuleDocument = noop,
  onSaveRuleVersion = noop,
  onSaveRuleCategory = noop,
  onSaveRuleCriterion = noop,
  onDeleteRuleCriterion = noop,
  onDeleteRuleCriteria,
  onSaveEmulationRecord = noop,
  onSaveEmulationAppeal = noop,
  onSaveEmulationPeriod = noop,
  onSaveEmulationSnapshot = noop,
  onSaveTitleConfig = noop,
  onDeleteTitleConfig = noop,
  onSaveCompetition = noop,
  onSaveCompetitionCriterion = noop,
  onDeleteCompetitionCriterion = noop,
  onSaveCompetitionParticipant = noop,
  onSaveCompetitionScore = noop,
  onSaveCompetitionAward = noop,
  onSaveScoreTransfer = noop,
  onUnifiedImportCommit,
  onLogExport,
}) => {
  const [scMode, setScMode] = useState<StudentsClassesMode>('students');
  const [scYearFilter, setScYearFilter] = useState<string>('all');
  const [scGradeFilter, setScGradeFilter] = useState<string>('all');
  const [scClassFilter, setScClassFilter] = useState<string>('all');
  const [scSearch, setScSearch] = useState('');

  const [hrMode, setHrMode] = useState<StaffHrMode>('directory');
  const [hrGroupFilter, setHrGroupFilter] = useState<UnifiedHRGroup>('all');
  const [hrStatusFilter, setHrStatusFilter] = useState<string>('all');
  const [hrSearch, setHrSearch] = useState('');

  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [pendingDeleteStaff, setPendingDeleteStaff] = useState<StaffMember | null>(null);

  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [pendingDeleteTeacher, setPendingDeleteTeacher] = useState<Teacher | null>(null);

  const [isYearModalOpen, setIsYearModalOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYearConfig | null>(null);

  const [selectedHrKeys, setSelectedHrKeys] = useState<string[]>([]);
  const [pendingBulkHrKeys, setPendingBulkHrKeys] = useState<string[] | null>(null);
  const [isBulkDeletingHr, setIsBulkDeletingHr] = useState(false);

  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [pendingBulkStaffIds, setPendingBulkStaffIds] = useState<string[] | null>(null);
  const [isBulkDeletingStaff, setIsBulkDeletingStaff] = useState(false);
  const [isStaffDataSourceOpen, setIsStaffDataSourceOpen] = useState(false);

  const effectiveContext: ValidationDbContext = useMemo(
    () =>
      validationContext ?? {
        classes,
        academicYears,
        rooms,
        teachers,
        students,
        staffMembers,
      },
    [validationContext, classes, academicYears, rooms, teachers, students, staffMembers]
  );

  const canCreateStaff = hasPermission(currentUser, 'staff', 'create', customPermissions);
  const canEditStaff = hasPermission(currentUser, 'staff', 'edit', customPermissions);
  const canDeleteStaff = hasPermission(currentUser, 'staff', 'delete', customPermissions);
  const canExportStaff = hasPermission(currentUser, 'staff', 'export', customPermissions);
  const canCreateYear = hasPermission(currentUser, 'classes', 'create', customPermissions);
  const canEditYear = hasPermission(currentUser, 'classes', 'edit', customPermissions);
  const canExportYear = hasPermission(currentUser, 'classes', 'export', customPermissions);

  const unifiedOverviewStudents = useMemo(
    () =>
      filterUnifiedStudents({
        students,
        classes,
        academicYear: scYearFilter,
        grade: scGradeFilter,
        classId: scClassFilter,
        search: scSearch,
      }),
    [students, classes, scYearFilter, scGradeFilter, scClassFilter, scSearch]
  );

  const allHrRecords = useMemo(
    () => buildUnifiedHRRecords(teachers, staffMembers),
    [teachers, staffMembers]
  );

  const filteredHrRecords = useMemo(
    () =>
      filterUnifiedHRRecords({
        records: allHrRecords,
        groupFilter: hrGroupFilter,
        statusFilter: hrStatusFilter,
        search: hrSearch,
      }),
    [allHrRecords, hrGroupFilter, hrStatusFilter, hrSearch]
  );

  const allHrKeys = useMemo(
    () => allHrRecords.map((r) => `${r.source}:${r.id}`),
    [allHrRecords]
  );
  const effectiveSelectedHrKeys = useMemo(
    () => pruneStaleSelectedIds(selectedHrKeys, allHrKeys),
    [selectedHrKeys, allHrKeys]
  );
  const visibleHrKeys = useMemo(
    () => filteredHrRecords.map((r) => `${r.source}:${r.id}`),
    [filteredHrRecords]
  );

  const effectiveSelectedStaffIds = useMemo(
    () => pruneStaleSelectedIds(selectedStaffIds, staffMembers.map((m) => m.id)),
    [selectedStaffIds, staffMembers]
  );
  const allStaffIds = useMemo(() => staffMembers.map((m) => m.id), [staffMembers]);

  const handleConfirmBulkDeleteHr = async () => {
    if (!pendingBulkHrKeys || pendingBulkHrKeys.length === 0) return;
    setIsBulkDeletingHr(true);
    try {
      const { primaryIds: teacherIds, secondaryIds: staffIds } = partitionPrefixedKeys(
        pendingBulkHrKeys,
        'teacher:',
        'staff:'
      );
      if (teacherIds.length > 0) {
        if (onDeleteTeachers) {
          await onDeleteTeachers(teacherIds);
        } else {
          for (const id of teacherIds) await onDeleteTeacher(id);
        }
      }
      if (staffIds.length > 0) {
        if (onDeleteStaffMembers) {
          await onDeleteStaffMembers(staffIds);
        } else {
          for (const id of staffIds) await onDeleteStaffMember(id);
        }
      }
      const deletedSet = new Set(pendingBulkHrKeys);
      setSelectedHrKeys((prev) => prev.filter((k) => !deletedSet.has(k)));
    } finally {
      setIsBulkDeletingHr(false);
      setPendingBulkHrKeys(null);
    }
  };

  const handleConfirmBulkDeleteStaff = async () => {
    if (!pendingBulkStaffIds || pendingBulkStaffIds.length === 0) return;
    setIsBulkDeletingStaff(true);
    try {
      if (onDeleteStaffMembers) {
        await onDeleteStaffMembers(pendingBulkStaffIds);
      } else {
        for (const id of pendingBulkStaffIds) await onDeleteStaffMember(id);
      }
      const deletedSet = new Set(pendingBulkStaffIds);
      setSelectedStaffIds((prev) => prev.filter((id) => !deletedSet.has(id)));
    } finally {
      setIsBulkDeletingStaff(false);
      setPendingBulkStaffIds(null);
    }
  };

  const openCreateStaff = () => {
    setEditingStaff(null);
    setIsStaffModalOpen(true);
  };

  const openEditStaff = (member: StaffMember) => {
    setEditingStaff(member);
    setIsStaffModalOpen(true);
  };

  const openCreateTeacher = () => {
    setEditingTeacher(null);
    setIsTeacherModalOpen(true);
  };

  const openEditTeacher = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setIsTeacherModalOpen(true);
  };

  const openCreateYear = () => {
    setEditingYear(null);
    setIsYearModalOpen(true);
  };

  const openEditYear = (yr: AcademicYearConfig) => {
    setEditingYear(yr);
    setIsYearModalOpen(true);
  };

  const handleFallbackCommit = async (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => {
    if (onUnifiedImportCommit) {
      await onUnifiedImportCommit(moduleKey, entitiesToSave, historyRecord);
      return;
    }
    if (moduleKey === 'staff') {
      entitiesToSave.forEach((e) => onSaveStaffMember(e as unknown as StaffMember));
    } else if (moduleKey === 'academic_years') {
      entitiesToSave.forEach((e) => onSaveAcademicYear(e as unknown as AcademicYearConfig));
    }
  };

  const currentAcademicYear =
    academicYears.find((y) => y.status === 'Đang diễn ra') || academicYears[0];

  return (
    <AppWindowShell
      appId="school"
      activeTab={activeTab}
      userRole={currentUser.role}
      userProfile={currentUser}
      customPermissions={customPermissions}
      onSelectTab={onSelectTab}
    >
      {(tabId) => (
        <>
          {tabId === 'students-classes' && (() => {
            const scModeSwitcher = (
              <div
                className="glass-pill-tray inline-flex items-center gap-1 p-1 rounded-2xl text-xs font-semibold overflow-x-auto scrollbar-none max-w-full"
                role="group"
                aria-label="Chế độ Học sinh & Lớp học"
              >
                {(
                  [
                    { id: 'students', label: `Học sinh (${students.length})` },
                    { id: 'classes', label: `Lớp học (${classes.length})` },
                    { id: 'overview', label: 'Tra cứu tổng hợp' },
                    { id: 'years', label: `Niên khóa (${academicYears.length})` },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`sc-mode-${item.id}`}
                    onClick={() => setScMode(item.id)}
                    className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      scMode === item.id ? 'glass-pill-tab-active' : 'glass-pill-tab'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            );

            return (
            <div className="space-y-4">
              {scMode === 'overview' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {scModeSwitcher}
                    {currentAcademicYear && (
                      <Badge variant="aqua" size="sm">
                        {currentAcademicYear.name} · {currentAcademicYear.currentSemester}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <LiquidCard className="p-4">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tổng học sinh</p>
                      <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 font-mono-tabular">
                        {students.length}
                      </p>
                    </LiquidCard>
                    <LiquidCard className="p-4">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tổng lớp học</p>
                      <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 font-mono-tabular">
                        {classes.length}
                      </p>
                    </LiquidCard>
                    <LiquidCard className="p-4">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">GV chủ nhiệm</p>
                      <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 font-mono-tabular">
                        {classes.filter((c) => Boolean(c.homeroomTeacherName)).length}
                      </p>
                    </LiquidCard>
                    <LiquidCard className="p-4">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Niên khóa hiện hành</p>
                      <p className="text-sm font-extrabold text-sky-700 dark:text-sky-300 mt-2 font-mono-tabular">
                        {currentAcademicYear ? `${currentAcademicYear.name} (${currentAcademicYear.currentSemester})` : systemSettings.academicYear}
                      </p>
                    </LiquidCard>
                  </div>

                  <LiquidCard className="p-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 text-xs">
                      <div className="sm:col-span-5 relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={scSearch}
                          onChange={(e) => setScSearch(e.target.value)}
                          placeholder="Tra cứu nhanh học sinh, mã STU, RFID, lớp..."
                          className="w-full glass-subsurface rounded-xl pl-9 pr-3 py-2 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <select
                          value={scYearFilter}
                          onChange={(e) => setScYearFilter(e.target.value)}
                          className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                        >
                          <option value="all">Mọi niên khóa</option>
                          {academicYears.map((y) => (
                            <option key={y.id} value={y.name}>
                              {y.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <select
                          value={scGradeFilter}
                          onChange={(e) => setScGradeFilter(e.target.value)}
                          className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                        >
                          <option value="all">Mọi khối</option>
                          <option value="10">Khối 10</option>
                          <option value="11">Khối 11</option>
                          <option value="12">Khối 12</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <select
                          value={scClassFilter}
                          onChange={(e) => setScClassFilter(e.target.value)}
                          className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                        >
                          <option value="all">Mọi lớp</option>
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </LiquidCard>

                  <div className="glass-table-shell">
                    {unifiedOverviewStudents.length === 0 ? (
                      <EmptyState
                        icon={Users}
                        title="Không tìm thấy dữ liệu phù hợp"
                        description="Thử thay đổi bộ lọc niên khóa, khối, lớp hoặc chuyển sang mục Học sinh / Lớp học để quản lý chi tiết."
                      />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="glass-table-head">
                            <tr>
                              <th className="px-4 py-3">Mã STU</th>
                              <th className="px-4 py-3">Họ tên</th>
                              <th className="px-4 py-3">Lớp / Khối</th>
                              <th className="px-4 py-3">RFID</th>
                              <th className="px-4 py-3">Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody>
                            {unifiedOverviewStudents.slice(0, 40).map((s) => (
                              <tr key={s.id} className="glass-table-row">
                                <td className="px-4 py-2.5 font-mono-tabular font-semibold text-sky-700 dark:text-sky-300">
                                  {s.studentCode}
                                </td>
                                <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-slate-100">
                                  {s.fullName}
                                </td>
                                <td className="px-4 py-2.5">
                                  {s.className} (K{s.grade})
                                </td>
                                <td className="px-4 py-2.5 font-mono-tabular text-teal-700 dark:text-teal-300">
                                  {s.rfidCardId}
                                </td>
                                <td className="px-4 py-2.5">
                                  <Badge variant={s.status === 'Đang học' ? 'mint' : 'gray'} size="sm">
                                    {s.status}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {scMode === 'students' && (
                <StudentsView
                  students={students}
                  classes={classes}
                  teachers={teachers}
                  currentUser={currentUser}
                  customPermissions={customPermissions}
                  validationContext={effectiveContext}
                  systemSettings={systemSettings}
                  onSaveSettings={onSaveSettings}
                  onAddClass={onAddClass}
                  onCreateClassesOnWeb={onCreateClassesOnWeb}
                  borrowTransactions={borrowTransactions}
                  academicRecords={academicRecords}
                  attendanceRecords={attendanceRecords}
                  schoolEvents={schoolEvents}
                  leaveRequests={leaveRequests}
                  dataSourceConfigs={dataSourceConfigs}
                  isAdmin={isAdmin}
                  dataSourceRuntimeContext={dataSourceRuntimeContext}
                  dataSourceExistingData={dataSourceExistingData}
                  onSaveDataSourceConfig={onSaveDataSourceConfig}
                  onDeleteDataSourceConfig={onDeleteDataSourceConfig}
                  onCommitNormalizedGroupData={onCommitNormalizedGroupData}
                  onAddStudent={onAddStudent}
                  onUpdateStudent={onUpdateStudent}
                  onDeleteStudent={onDeleteStudent}
                  onDeleteStudents={onDeleteStudents}
                  onUnifiedImportCommit={onUnifiedImportCommit}
                  onLogExport={onLogExport}
                  topLeftSlot={scModeSwitcher}
                />
              )}

              {scMode === 'classes' && (
                <ClassesView
                  classes={classes}
                  students={students}
                  teachers={teachers}
                  rooms={rooms}
                  classPlacements={classPlacements}
                  currentUser={currentUser}
                  customPermissions={customPermissions}
                  validationContext={effectiveContext}
                  systemSettings={systemSettings}
                  onSaveSettings={onSaveSettings}
                  onAddClass={onAddClass}
                  onCreateClassesOnWeb={onCreateClassesOnWeb}
                  onUpdateClass={onUpdateClass}
                  onDeleteClass={onDeleteClass}
                  onDeleteClasses={onDeleteClasses}
                  onUnifiedImportCommit={onUnifiedImportCommit}
                  onLogExport={onLogExport}
                  topLeftSlot={scModeSwitcher}
                />
              )}

              {scMode === 'years' && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {scModeSwitcher}
                    <ModuleDataActions
                      moduleKey="academic_years"
                      context={effectiveContext}
                      currentUser={currentUser}
                      allRecords={academicYears as unknown as Record<string, unknown>[]}
                      canCreate={canCreateYear}
                      canImport={canCreateYear}
                      canExport={canExportYear}
                      createLabel="Khởi tạo Năm học"
                      onManualSave={async (entity) => {
                        onSaveAcademicYear(entity as unknown as AcademicYearConfig);
                      }}
                      onCommitImport={handleFallbackCommit}
                      onLogExport={onLogExport}
                    />
                  </div>

                  {academicYears.length === 0 ? (
                    <EmptyState
                      icon={CalendarRange}
                      title="Chưa cấu hình niên khóa"
                      description="Khởi tạo năm học và học kỳ để đồng bộ thời khóa biểu và lớp học."
                      action={
                        canCreateYear ? (
                          <button
                            type="button"
                            onClick={openCreateYear}
                            className="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-4 h-4" /> Tạo năm học đầu tiên
                          </button>
                        ) : null
                      }
                    />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {academicYears.map((yr) => (
                        <LiquidCard key={yr.id} className="p-5 flex items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">{yr.name}</h3>
                              <Badge variant={yr.status === 'Đang diễn ra' ? 'mint' : yr.status === 'Sắp tới' ? 'blue' : 'gray'}>
                                {yr.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              Học kỳ hiện hành: <strong>{yr.currentSemester}</strong>
                            </p>
                            <p className="text-[11px] font-mono-tabular text-slate-400 mt-0.5">
                              {yr.startDate} → {yr.endDate}
                            </p>
                          </div>
                          {canEditYear && (
                            <div className="flex flex-col items-end gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  onSaveAcademicYear({
                                    ...yr,
                                    currentSemester: yr.currentSemester === 'HK1' ? 'HK2' : 'HK1',
                                  })
                                }
                                className="px-3 py-1.5 rounded-xl bg-sky-500/12 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Đổi sang {yr.currentSemester === 'HK1' ? 'HK2' : 'HK1'}
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditYear(yr)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" /> Chỉnh sửa
                              </button>
                            </div>
                          )}
                        </LiquidCard>
                      ))}
                    </div>
                  )}

                  <UnifiedManualFormModal
                    isOpen={isYearModalOpen}
                    moduleKey="academic_years"
                    context={effectiveContext}
                    existingRecords={academicYears as unknown as Record<string, unknown>[]}
                    initialValues={editingYear ? (editingYear as unknown as Record<string, unknown>) : undefined}
                    editingRecordId={editingYear?.id}
                    currentUser={currentUser}
                    onClose={() => {
                      setIsYearModalOpen(false);
                      setEditingYear(null);
                    }}
                    onSave={async (entity) => {
                      onSaveAcademicYear(entity as unknown as AcademicYearConfig);
                    }}
                  />
                </div>
              )}
            </div>
            );
          })()}

          {tabId === 'staff-hr' && (() => {
            const hrModeSwitcher = (
              <div
                className="glass-pill-tray inline-flex items-center gap-1 p-1 rounded-2xl text-xs font-semibold overflow-x-auto scrollbar-none"
                role="group"
                aria-label="Chế độ Nhân sự"
              >
                {(
                  [
                    { id: 'directory', label: `Danh bạ Tổng hợp (${allHrRecords.length})` },
                    { id: 'teachers', label: `Giáo viên & Phân công (${teachers.length})` },
                    { id: 'staff', label: `Nhân viên HC (${staffMembers.length})` },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`hr-mode-${item.id}`}
                    onClick={() => setHrMode(item.id)}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      hrMode === item.id ? 'glass-pill-tab-active' : 'glass-pill-tab'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            );

            return (
            <div className="space-y-4">
              {hrMode === 'directory' && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {hrModeSwitcher}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {canCreateStaff && (
                      <>
                        <button
                          type="button"
                          onClick={openCreateTeacher}
                          className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-sm whitespace-nowrap shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" /> Thêm Giáo viên
                        </button>
                        <button
                          type="button"
                          onClick={openCreateStaff}
                          className="px-3.5 py-2 rounded-xl glass-subsurface text-slate-800 dark:text-slate-100 font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" /> Thêm Nhân viên
                        </button>
                      </>
                    )}
                    {isAdmin && onSaveDataSourceConfig && (
                      <DataSourceButton
                        groupKey="staff"
                        config={dataSourceConfigs.find((c) => c.groupKey === 'staff')}
                        isAdmin={isAdmin}
                        onClick={() => setIsStaffDataSourceOpen(true)}
                      />
                    )}
                  </div>
                </div>
              )}

              {isAdmin && onSaveDataSourceConfig && onCommitNormalizedGroupData && (
                <DataSourceModal
                  isOpen={isStaffDataSourceOpen}
                  onClose={() => setIsStaffDataSourceOpen(false)}
                  groupKey="staff"
                  allConfigs={dataSourceConfigs}
                  runtimeContext={
                    dataSourceRuntimeContext ?? {
                      classes,
                      academicYears,
                      rooms,
                      systemSettings,
                    }
                  }
                  existingData={
                    dataSourceExistingData ?? {
                      students,
                      teachers,
                      staffMembers,
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

              {hrMode === 'directory' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <LiquidCard className="p-4">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tổng nhân sự</p>
                      <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 font-mono-tabular">
                        {allHrRecords.length}
                      </p>
                    </LiquidCard>
                    <LiquidCard className="p-4">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Ban Giám hiệu</p>
                      <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 mt-1 font-mono-tabular">
                        {allHrRecords.filter((r) => r.roleGroup === 'bgh').length}
                      </p>
                    </LiquidCard>
                    <LiquidCard className="p-4">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Giáo viên</p>
                      <p className="text-2xl font-extrabold text-sky-600 dark:text-sky-400 mt-1 font-mono-tabular">
                        {allHrRecords.filter((r) => r.roleGroup === 'teacher').length}
                      </p>
                    </LiquidCard>
                    <LiquidCard className="p-4">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Nhân viên HC</p>
                      <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 font-mono-tabular">
                        {allHrRecords.filter((r) => r.roleGroup === 'staff').length}
                      </p>
                    </LiquidCard>
                  </div>

                  <LiquidCard className="p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
                    <div className="glass-pill-tray p-1 rounded-xl inline-flex flex-wrap items-center gap-1">
                      {(
                        [
                          { id: 'all', label: 'Tất cả' },
                          { id: 'bgh', label: 'BGH' },
                          { id: 'teacher', label: 'Giáo viên' },
                          { id: 'staff', label: 'Nhân viên' },
                        ] as const
                      ).map((grp) => (
                        <button
                          key={grp.id}
                          type="button"
                          onClick={() => setHrGroupFilter(grp.id)}
                          className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-all ${
                            hrGroupFilter === grp.id ? 'glass-pill-tab-active' : 'glass-pill-tab'
                          }`}
                        >
                          {grp.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 flex-1 lg:max-w-md">
                      <div className="relative flex-1 min-w-[180px]">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={hrSearch}
                          onChange={(e) => setHrSearch(e.target.value)}
                          placeholder="Tìm theo tên, bộ môn, phòng ban, lớp CN..."
                          className="w-full glass-subsurface rounded-xl pl-9 pr-3 py-2 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <select
                        value={hrStatusFilter}
                        onChange={(e) => setHrStatusFilter(e.target.value)}
                        className="glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                      >
                        <option value="all">Mọi trạng thái</option>
                        <option value="Đang công tác">Đang công tác</option>
                        <option value="Nghỉ phép">Nghỉ phép</option>
                      </select>
                    </div>
                  </LiquidCard>

                  <BulkSelectionBar
                    totalVisibleCount={filteredHrRecords.length}
                    selectedCount={effectiveSelectedHrKeys.length}
                    allVisibleSelected={areAllVisibleSelected(effectiveSelectedHrKeys, visibleHrKeys)}
                    canDelete={canDeleteStaff}
                    entityLabel="nhân sự"
                    showSelectAll={false}
                    isDeleting={isBulkDeletingHr}
                    testIdPrefix="hr-directory-bulk"
                    onToggleSelectAll={() =>
                      setSelectedHrKeys((prev) => toggleSelectAllVisible(prev, visibleHrKeys))
                    }
                    onClearSelection={() => setSelectedHrKeys([])}
                    onRequestBulkDelete={() => setPendingBulkHrKeys(effectiveSelectedHrKeys)}
                  />

                  <div className="glass-table-shell">
                    {filteredHrRecords.length === 0 ? (
                      <EmptyState
                        icon={GraduationCap}
                        title="Không có nhân sự phù hợp"
                        description="Thử thay đổi bộ lọc nhóm nhân sự hoặc từ khóa tìm kiếm."
                      />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="glass-table-head">
                            <tr>
                              {canDeleteStaff && (
                                <th className="pl-4 pr-2 py-3 w-8">
                                  <input
                                    type="checkbox"
                                    checked={areAllVisibleSelected(effectiveSelectedHrKeys, visibleHrKeys)}
                                    onChange={() =>
                                      setSelectedHrKeys((prev) => toggleSelectAllVisible(prev, visibleHrKeys))
                                    }
                                    aria-label="Chọn tất cả nhân sự đang hiển thị"
                                    className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500 cursor-pointer"
                                  />
                                </th>
                              )}
                              <th className="px-4 py-3">Nhân sự</th>
                              <th className="px-4 py-3">Vai trò</th>
                              <th className="px-4 py-3">Bộ môn / Phòng ban</th>
                              <th className="px-4 py-3">Liên hệ</th>
                              <th className="px-4 py-3">Trạng thái</th>
                              {(canEditStaff || canDeleteStaff) && <th className="px-4 py-3 text-right">Thao tác</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredHrRecords.map((rec) => {
                              const rowKey = `${rec.source}:${rec.id}`;
                              const isSelected = effectiveSelectedHrKeys.includes(rowKey);
                              return (
                              <tr
                                key={`${rec.source}-${rec.id}`}
                                className={`glass-table-row ${
                                  isSelected ? 'bg-sky-500/12 dark:bg-sky-400/12' : ''
                                }`}
                              >
                                {canDeleteStaff && (
                                  <td className="pl-4 pr-2 py-3">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() =>
                                        setSelectedHrKeys((prev) => toggleSelectedId(prev, rowKey))
                                      }
                                      aria-label={`Chọn nhân sự ${rec.fullName}`}
                                      className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500 cursor-pointer"
                                    />
                                  </td>
                                )}
                                <td className="px-4 py-3">
                                  <p className="font-bold text-slate-800 dark:text-slate-100">{rec.fullName}</p>
                                  <p className="text-[10px] font-mono-tabular text-slate-400">{rec.code}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge
                                    variant={rec.roleGroup === 'bgh' ? 'purple' : rec.roleGroup === 'teacher' ? 'blue' : 'aqua'}
                                    size="sm"
                                  >
                                    {rec.roleLabel}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                                  {rec.departmentOrSubject}
                                </td>
                                <td className="px-4 py-3 text-[11px] text-slate-500 dark:text-slate-400">
                                  <p>{rec.email || '—'}</p>
                                  <p className="font-mono-tabular">{rec.phone || '—'}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge variant={rec.status === 'Đang công tác' ? 'mint' : 'amber'} size="sm">
                                    {rec.status}
                                  </Badge>
                                </td>
                                {(canEditStaff || canDeleteStaff) && (
                                  <td className="px-4 py-3 text-right whitespace-nowrap">
                                    <div className="inline-flex items-center gap-1">
                                      {canEditStaff && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (rec.source === 'teacher') {
                                              const t = teachers.find((x) => x.id === rec.id);
                                              if (t) openEditTeacher(t);
                                            } else {
                                              const m = staffMembers.find((x) => x.id === rec.id);
                                              if (m) openEditStaff(m);
                                            }
                                          }}
                                          className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 cursor-pointer"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      {canDeleteStaff && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (rec.source === 'teacher') {
                                              const t = teachers.find((x) => x.id === rec.id);
                                              if (t) setPendingDeleteTeacher(t);
                                            } else {
                                              const m = staffMembers.find((x) => x.id === rec.id);
                                              if (m) setPendingDeleteStaff(m);
                                            }
                                          }}
                                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {hrMode === 'teachers' && (
                <StaffView
                  teachers={teachers}
                  classes={classes}
                  teachingAssignments={teachingAssignments}
                  currentUser={currentUser}
                  customPermissions={customPermissions}
                  validationContext={effectiveContext}
                  onAddTeacher={onAddTeacher}
                  onUpdateTeacher={onUpdateTeacher}
                  onDeleteTeacher={onDeleteTeacher}
                  onDeleteTeachers={onDeleteTeachers}
                  onUnifiedImportCommit={onUnifiedImportCommit}
                  onLogExport={onLogExport}
                  topLeftSlot={
                    <div className="flex flex-wrap items-center gap-2">
                      {hrModeSwitcher}
                      {isAdmin && onSaveDataSourceConfig && (
                        <DataSourceButton
                          groupKey="staff"
                          config={dataSourceConfigs.find((c) => c.groupKey === 'staff')}
                          isAdmin={isAdmin}
                          onClick={() => setIsStaffDataSourceOpen(true)}
                        />
                      )}
                    </div>
                  }
                />
              )}

              {hrMode === 'staff' && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {hrModeSwitcher}
                    <div className="flex flex-wrap items-center gap-2">
                      <ModuleDataActions
                        moduleKey="staff"
                        context={effectiveContext}
                        currentUser={currentUser}
                        allRecords={staffMembers as unknown as Record<string, unknown>[]}
                        canCreate={canCreateStaff}
                        canImport={canCreateStaff}
                        canExport={canExportStaff}
                        createLabel="Thêm Nhân viên"
                        onManualSave={async (entity) => {
                          onSaveStaffMember(entity as unknown as StaffMember);
                        }}
                        onCommitImport={handleFallbackCommit}
                        onLogExport={onLogExport}
                      />
                      {isAdmin && onSaveDataSourceConfig && (
                        <DataSourceButton
                          groupKey="staff"
                          config={dataSourceConfigs.find((c) => c.groupKey === 'staff')}
                          isAdmin={isAdmin}
                          onClick={() => setIsStaffDataSourceOpen(true)}
                        />
                      )}
                    </div>
                  </div>

                  <BulkSelectionBar
                    totalVisibleCount={staffMembers.length}
                    selectedCount={effectiveSelectedStaffIds.length}
                    allVisibleSelected={areAllVisibleSelected(effectiveSelectedStaffIds, allStaffIds)}
                    canDelete={canDeleteStaff}
                    entityLabel="nhân viên"
                    showSelectAll={true}
                    isDeleting={isBulkDeletingStaff}
                    testIdPrefix="staff-members-bulk"
                    onToggleSelectAll={() =>
                      setSelectedStaffIds((prev) => toggleSelectAllVisible(prev, allStaffIds))
                    }
                    onClearSelection={() => setSelectedStaffIds([])}
                    onRequestBulkDelete={() => setPendingBulkStaffIds(effectiveSelectedStaffIds)}
                  />

                  {staffMembers.length === 0 ? (
                    <EmptyState
                      icon={Briefcase}
                      title="Chưa có hồ sơ nhân viên"
                      description="Thêm nhân sự khối văn phòng, y tế, bảo trì hoặc bảo vệ để quản lý phân công trực."
                      action={
                        canCreateStaff ? (
                          <button
                            type="button"
                            onClick={openCreateStaff}
                            className="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-4 h-4" /> Thêm nhân viên đầu tiên
                          </button>
                        ) : null
                      }
                    />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {staffMembers.map((member) => {
                        const isSelected = effectiveSelectedStaffIds.includes(member.id);
                        return (
                        <LiquidCard
                          key={member.id}
                          className={`p-4 space-y-3 transition-all ${
                            isSelected ? 'ring-2 ring-sky-500/70 bg-sky-50/40 dark:bg-sky-950/20' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 min-w-0">
                              {canDeleteStaff && (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() =>
                                    setSelectedStaffIds((prev) => toggleSelectedId(prev, member.id))
                                  }
                                  aria-label={`Chọn nhân viên ${member.fullName}`}
                                  className="mt-1 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500 shrink-0 cursor-pointer"
                                />
                              )}
                              <div className="min-w-0">
                                <span className="text-[11px] font-mono-tabular text-sky-600 dark:text-sky-400 font-bold">
                                  {member.staffCode}
                                </span>
                                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5 truncate">
                                  {member.fullName}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{member.position}</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <Badge variant="aqua" size="sm">{member.department}</Badge>
                              <Badge variant={member.status === 'Đang công tác' ? 'mint' : 'amber'} size="sm">
                                {member.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                            <p className="flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-slate-400" /> {member.email}
                            </p>
                            <p className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-slate-400" /> {member.phone}
                            </p>
                          </div>
                          {(canEditStaff || canDeleteStaff) && (
                            <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-end gap-2">
                              {canEditStaff && (
                                <button
                                  type="button"
                                  onClick={() => openEditStaff(member)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Pencil className="w-3 h-3" /> Sửa
                                </button>
                              )}
                              {canDeleteStaff && (
                                <button
                                  type="button"
                                  onClick={() => setPendingDeleteStaff(member)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" /> Xóa
                                </button>
                              )}
                            </div>
                          )}
                        </LiquidCard>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <UnifiedManualFormModal
                isOpen={isStaffModalOpen}
                moduleKey="staff"
                context={effectiveContext}
                existingRecords={staffMembers as unknown as Record<string, unknown>[]}
                initialValues={
                  editingStaff
                    ? (editingStaff as unknown as Record<string, unknown>)
                    : { staffCode: `STF-2026-${String(staffMembers.length + 1).padStart(3, '0')}` }
                }
                editingRecordId={editingStaff?.id}
                currentUser={currentUser}
                onClose={() => {
                  setIsStaffModalOpen(false);
                  setEditingStaff(null);
                }}
                onSave={async (entity) => {
                  onSaveStaffMember(entity as unknown as StaffMember);
                }}
              />

              <UnifiedManualFormModal
                isOpen={isTeacherModalOpen}
                moduleKey="teachers"
                context={effectiveContext}
                existingRecords={teachers as unknown as Record<string, unknown>[]}
                initialValues={
                  editingTeacher ? (editingTeacher as unknown as Record<string, unknown>) : undefined
                }
                editingRecordId={editingTeacher?.id}
                currentUser={currentUser}
                onClose={() => {
                  setIsTeacherModalOpen(false);
                  setEditingTeacher(null);
                }}
                onSave={async (entity, isEdit) => {
                  const payload = entity as unknown as Teacher;
                  if (isEdit) onUpdateTeacher(payload);
                  else onAddTeacher(payload);
                }}
              />

              <ConfirmDialog
                isOpen={Boolean(pendingDeleteStaff)}
                title="Xác nhận xóa nhân viên"
                message={`Bạn có chắc muốn xóa hồ sơ nhân viên "${pendingDeleteStaff?.fullName}"?`}
                confirmLabel="Xóa hồ sơ"
                onConfirm={() => {
                  if (pendingDeleteStaff) onDeleteStaffMember(pendingDeleteStaff.id);
                  setPendingDeleteStaff(null);
                }}
                onCancel={() => setPendingDeleteStaff(null)}
              />

              <ConfirmDialog
                isOpen={Boolean(pendingDeleteTeacher)}
                title="Xác nhận xóa giáo viên"
                message={`Bạn có chắc muốn xóa hồ sơ giáo viên "${pendingDeleteTeacher?.fullName}"?`}
                confirmLabel="Xóa hồ sơ"
                onConfirm={() => {
                  if (pendingDeleteTeacher) onDeleteTeacher(pendingDeleteTeacher.id);
                  setPendingDeleteTeacher(null);
                }}
                onCancel={() => setPendingDeleteTeacher(null)}
              />

              <ConfirmDialog
                isOpen={Boolean(pendingBulkHrKeys && pendingBulkHrKeys.length > 0)}
                title="Xác nhận xóa hàng loạt nhân sự"
                message={`Bạn có chắc muốn xóa ${pendingBulkHrKeys?.length || 0} nhân sự đã chọn khỏi danh bạ? Thao tác này không thể hoàn tác.`}
                confirmLabel={`Xóa ${pendingBulkHrKeys?.length || 0} nhân sự`}
                onConfirm={() => {
                  void handleConfirmBulkDeleteHr();
                }}
                onCancel={() => setPendingBulkHrKeys(null)}
              />

              <ConfirmDialog
                isOpen={Boolean(pendingBulkStaffIds && pendingBulkStaffIds.length > 0)}
                title="Xác nhận xóa hàng loạt nhân viên"
                message={`Bạn có chắc muốn xóa ${pendingBulkStaffIds?.length || 0} nhân viên hành chính đã chọn?`}
                confirmLabel={`Xóa ${pendingBulkStaffIds?.length || 0} nhân viên`}
                onConfirm={() => {
                  void handleConfirmBulkDeleteStaff();
                }}
                onCancel={() => setPendingBulkStaffIds(null)}
              />
            </div>
            );
          })()}

          {tabId === 'emulation' && (
            <EmulationHubView
              currentUser={currentUser}
              customPermissions={customPermissions}
              systemSettings={systemSettings}
              validationContext={effectiveContext}
              students={students}
              classes={classes}
              ruleDocuments={ruleDocuments}
              ruleVersions={ruleVersions}
              ruleCategories={ruleCategories}
              ruleCriteria={ruleCriteria}
              emulationRecords={emulationRecords}
              emulationAppeals={emulationAppeals}
              emulationPeriods={emulationPeriods}
              emulationSnapshots={emulationSnapshots}
              emulationTitleConfigs={emulationTitleConfigs}
              competitions={competitions}
              competitionCriteria={competitionCriteria}
              competitionParticipants={competitionParticipants}
              competitionScores={competitionScores}
              competitionAwards={competitionAwards}
              scoreTransfers={scoreTransfers}
              onSaveSettings={onSaveSettings}
              onSaveRuleDocument={onSaveRuleDocument}
              onSaveRuleVersion={onSaveRuleVersion}
              onSaveRuleCategory={onSaveRuleCategory}
              onSaveRuleCriterion={onSaveRuleCriterion}
              onDeleteRuleCriterion={onDeleteRuleCriterion}
              onDeleteRuleCriteria={onDeleteRuleCriteria}
              onSaveEmulationRecord={onSaveEmulationRecord}
              onSaveEmulationAppeal={onSaveEmulationAppeal}
              onSaveEmulationPeriod={onSaveEmulationPeriod}
              onSaveEmulationSnapshot={onSaveEmulationSnapshot}
              onSaveTitleConfig={onSaveTitleConfig}
              onDeleteTitleConfig={onDeleteTitleConfig}
              onSaveCompetition={onSaveCompetition}
              onSaveCompetitionCriterion={onSaveCompetitionCriterion}
              onDeleteCompetitionCriterion={onDeleteCompetitionCriterion}
              onSaveCompetitionParticipant={onSaveCompetitionParticipant}
              onSaveCompetitionScore={onSaveCompetitionScore}
              onSaveCompetitionAward={onSaveCompetitionAward}
              onSaveScoreTransfer={onSaveScoreTransfer}
              onUnifiedImportCommit={onUnifiedImportCommit}
              onLogExport={onLogExport}
            />
          )}
        </>
      )}
    </AppWindowShell>
  );
};
