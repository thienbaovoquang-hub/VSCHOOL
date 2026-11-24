import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar, CheckCircle2, AlertCircle, Plus, Pencil, Trash2, Users, GraduationCap, CalendarDays, Clock, Layers
} from 'lucide-react';
import {
  AcademicYearConfig,
  ExportHistoryRecord,
  ImportHistoryRecord,
  ImportModuleKey,
  PermissionMatrix,
  SchoolClass,
  SchoolRoom,
  SystemSettings,
  Teacher,
  TimetableEntry,
  UserProfile,
} from '../types';
import { LiquidCard } from '../components/common/LiquidCard';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { ModuleDataActions } from '../components/importExport/ModuleDataActions';
import type { ValidationDbContext } from '../utils/importExport/validator';
import { resolveCatalogOptions } from '../utils/catalogs/catalogRegistry';
import { detectTimetableConflicts, TimetableConflict } from '../utils/academicRules';
import { DEFAULT_PERMISSIONS, hasPermission } from '../utils/rbac';

interface TimetableViewProps {
  timetable: TimetableEntry[];
  classes: SchoolClass[];
  teachers?: Teacher[];
  rooms?: SchoolRoom[];
  academicYears?: AcademicYearConfig[];
  systemSettings?: SystemSettings;
  currentUser: UserProfile;
  customPermissions?: PermissionMatrix;
  validationContext?: ValidationDbContext;
  onAddEntry?: (entry: TimetableEntry) => void;
  onUpdateEntry?: (entry: TimetableEntry) => void;
  onDeleteEntry?: (entryId: string) => void;
  onUnifiedImportCommit?: (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => Promise<void> | void;
  onLogExport?: (record: ExportHistoryRecord) => Promise<void> | void;
  extraToolbarActions?: React.ReactNode;
}

const DAYS = [
  { day: 2, label: 'Thứ Hai', short: 'T2' },
  { day: 3, label: 'Thứ Ba', short: 'T3' },
  { day: 4, label: 'Thứ Tư', short: 'T4' },
  { day: 5, label: 'Thứ Năm', short: 'T5' },
  { day: 6, label: 'Thứ Sáu', short: 'T6' },
  { day: 7, label: 'Thứ Bảy', short: 'T7' },
];

const PERIODS = [
  { period: 1, time: '07:15 - 08:00' },
  { period: 2, time: '08:05 - 08:50' },
  { period: 3, time: '09:05 - 09:50' },
  { period: 4, time: '09:55 - 10:40' },
  { period: 5, time: '10:45 - 11:30' },
];

export const TimetableView: React.FC<TimetableViewProps> = ({
  timetable,
  classes,
  teachers = [],
  rooms = [],
  academicYears = [],
  systemSettings,
  currentUser,
  customPermissions = DEFAULT_PERMISSIONS,
  validationContext,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onUnifiedImportCommit,
  onLogExport,
  extraToolbarActions,
}) => {
  const isTeacherRole =
    currentUser.role === 'homeroom_teacher' || currentUser.role === 'subject_teacher';

  const defaultClass = useMemo(() => {
    if (currentUser.role === 'student' && currentUser.className) {
      const found = classes.find(
        (c) => c.code === currentUser.className || c.id === currentUser.classId
      );
      if (found) return found.id;
    }
    return classes[0]?.id || '';
  }, [classes, currentUser.role, currentUser.className, currentUser.classId]);

  const defaultTeacher = useMemo(() => {
    if (teachers.length === 0) return '';
    const matched = teachers.find(
      (t) =>
        t.id === currentUser.linkedProfileId ||
        (t.email && t.email.toLowerCase() === currentUser.email.toLowerCase()) ||
        t.fullName.toLowerCase() === currentUser.displayName.toLowerCase()
    );
    return matched?.id || teachers[0]?.id || '';
  }, [teachers, currentUser.linkedProfileId, currentUser.email, currentUser.displayName]);

  const [scopeMode, setScopeMode] = useState<'school' | 'grade' | 'class' | 'teacher'>(
    isTeacherRole && teachers.length > 0 ? 'teacher' : 'class'
  );
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<number>(10);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('all');
  const [selectedSemester, setSelectedSemester] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const jsDay = new Date().getDay(); // 0=Sun, 1=Mon..6=Sat
    const vnDay = jsDay === 0 ? 2 : jsDay + 1;
    return vnDay >= 2 && vnDay <= 7 ? vnDay : 2;
  });

  const [selectedClassId, setSelectedClassId] = useState<string>(defaultClass);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(defaultTeacher);

  useEffect(() => {
    if (defaultClass && (!selectedClassId || !classes.some((c) => c.id === selectedClassId))) {
      setSelectedClassId(defaultClass);
    }
  }, [defaultClass, classes, selectedClassId]);

  useEffect(() => {
    if (defaultTeacher && (!selectedTeacherId || !teachers.some((t) => t.id === selectedTeacherId))) {
      setSelectedTeacherId(defaultTeacher);
    }
  }, [defaultTeacher, teachers, selectedTeacherId]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);
  const [slotToAdd, setSlotToAdd] = useState<{ day: number; period: number }>({ day: 2, period: 1 });
  const [modalClassId, setModalClassId] = useState<string>(defaultClass);
  const [newSubject, setNewSubject] = useState('Toán học');
  const [newTeacher, setNewTeacher] = useState('');
  const [newTeacherId, setNewTeacherId] = useState('');
  const [newRoom, setNewRoom] = useState('');
  const [conflictErrors, setConflictErrors] = useState<TimetableConflict[]>([]);

  const canCreate = hasPermission(currentUser.role, 'timetable', 'create', customPermissions);
  const canEdit = hasPermission(currentUser.role, 'timetable', 'edit', customPermissions);
  const canDelete = hasPermission(currentUser.role, 'timetable', 'delete', customPermissions);
  const canExport = hasPermission(currentUser.role, 'timetable', 'export', customPermissions);

  const selectedClass = classes.find((c) => c.id === selectedClassId) || classes[0];
  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId) || teachers[0];

  const availableYears = useMemo(() => {
    const set = new Set<string>();
    if (systemSettings?.academicYear) set.add(systemSettings.academicYear);
    academicYears.forEach((y) => y.name && set.add(y.name));
    timetable.forEach((t) => t.academicYear && set.add(t.academicYear));
    return Array.from(set);
  }, [academicYears, systemSettings?.academicYear, timetable]);

  const availableGrades = useMemo(() => {
    const set = new Set<number>([10, 11, 12]);
    classes.forEach((c) => c.grade && set.add(c.grade));
    return Array.from(set).sort((a, b) => a - b);
  }, [classes]);

  const scopedYearAndSemEntries = useMemo(() => {
    return timetable.filter((t) => {
      if (selectedAcademicYear !== 'all' && t.academicYear && t.academicYear !== selectedAcademicYear) {
        return false;
      }
      if (selectedSemester !== 'all' && t.semester && t.semester !== selectedSemester) {
        return false;
      }
      return true;
    });
  }, [timetable, selectedAcademicYear, selectedSemester]);

  const activeEntries = useMemo(() => {
    if (scopeMode === 'school') {
      return scopedYearAndSemEntries;
    }
    if (scopeMode === 'grade') {
      const gradeClassIds = new Set(
        classes.filter((c) => c.grade === selectedGradeFilter).map((c) => c.id)
      );
      const gradeClassCodes = new Set(
        classes.filter((c) => c.grade === selectedGradeFilter).map((c) => c.code.toLowerCase())
      );
      return scopedYearAndSemEntries.filter(
        (t) =>
          t.grade === selectedGradeFilter ||
          gradeClassIds.has(t.classId) ||
          gradeClassCodes.has(t.className.toLowerCase())
      );
    }
    if (scopeMode === 'teacher' && selectedTeacher) {
      return scopedYearAndSemEntries.filter(
        (t) =>
          t.teacherId === selectedTeacher.id ||
          t.teacherName.trim().toLowerCase() === selectedTeacher.fullName.trim().toLowerCase()
      );
    }
    if (selectedClass) {
      return scopedYearAndSemEntries.filter(
        (t) => t.classId === selectedClass.id || t.className === selectedClass.code
      );
    }
    return [];
  }, [
    scopeMode,
    scopedYearAndSemEntries,
    classes,
    selectedGradeFilter,
    selectedTeacher,
    selectedClass,
  ]);

  const activeConflictsCount = useMemo(() => {
    let count = 0;
    for (const item of activeEntries) {
      if (detectTimetableConflicts(item, timetable).length > 0) count++;
    }
    return count;
  }, [activeEntries, timetable]);

  const getEntriesForSlot = (day: number, period: number) =>
    activeEntries.filter((t) => t.dayOfWeek === day && t.period === period);

  const effectiveContext: ValidationDbContext = useMemo(
    () =>
      validationContext ?? {
        classes,
        teachers,
        rooms,
        timetable,
      },
    [validationContext, classes, teachers, rooms, timetable]
  );

  const subjectOptions = useMemo(() => {
    const base = resolveCatalogOptions({ catalogId: 'teacher_subject', runtime: effectiveContext });
    const list = base.map((o) => ({ value: o.value, label: o.label }));
    if (!list.some((x) => x.value === 'Sinh hoạt lớp')) {
      list.push({ value: 'Sinh hoạt lớp', label: 'Sinh hoạt lớp' });
    }
    return list;
  }, [effectiveContext]);

  const safeCommitImport = async (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => {
    if (onUnifiedImportCommit) {
      await onUnifiedImportCommit(moduleKey, entitiesToSave, historyRecord);
    } else if (onAddEntry) {
      entitiesToSave.forEach((e) => onAddEntry(e as unknown as TimetableEntry));
    }
  };

  const openAddSlot = (day: number, period: number) => {
    if (!canCreate) return;
    setEditingEntry(null);
    setSlotToAdd({ day, period });
    const targetCls = selectedClass || classes[0];
    setModalClassId(targetCls?.id || '');
    if (scopeMode === 'teacher' && selectedTeacher) {
      setNewSubject(selectedTeacher.subject || 'Toán học');
      setNewTeacherId(selectedTeacher.id);
      setNewTeacher(selectedTeacher.fullName);
    } else {
      setNewSubject('Toán học');
      setNewTeacherId(teachers[0]?.id || '');
      setNewTeacher(teachers[0]?.fullName || '');
    }
    setNewRoom(targetCls?.room || rooms[0]?.name || 'Phòng 101');
    setConflictErrors([]);
    setIsModalOpen(true);
  };

  const openEditSlot = (entry: TimetableEntry) => {
    if (!canEdit) return;
    setEditingEntry(entry);
    setSlotToAdd({ day: entry.dayOfWeek, period: entry.period });
    setModalClassId(entry.classId || selectedClass?.id || classes[0]?.id || '');
    setNewSubject(entry.subject);
    setNewTeacherId(entry.teacherId || '');
    setNewTeacher(entry.teacherName);
    setNewRoom(entry.room);
    setConflictErrors([]);
    setIsModalOpen(true);
  };

  const handleSaveSlot = (e: React.FormEvent) => {
    e.preventDefault();
    const targetClass = classes.find((c) => c.id === modalClassId) || selectedClass;
    if (!targetClass || !newSubject) return;

    const matchedTeacher = teachers.find((t) => t.id === newTeacherId || t.fullName === newTeacher);
    const candidate: TimetableEntry = {
      id: editingEntry
        ? editingEntry.id
        : `TT-${targetClass.code}-D${slotToAdd.day}-P${slotToAdd.period}-${Date.now()}`,
      classId: targetClass.id,
      className: targetClass.code,
      dayOfWeek: slotToAdd.day,
      period: slotToAdd.period,
      subject: newSubject,
      teacherId: matchedTeacher?.id || newTeacherId || undefined,
      teacherName: matchedTeacher?.fullName || newTeacher.trim() || 'Chưa phân công',
      room: newRoom.trim() || targetClass.room,
    };

    const conflicts = detectTimetableConflicts(candidate, timetable);
    if (conflicts.length > 0) {
      setConflictErrors(conflicts);
      return;
    }

    if (editingEntry && onUpdateEntry) {
      onUpdateEntry(candidate);
    } else if (onAddEntry) {
      onAddEntry(candidate);
    }
    setIsModalOpen(false);
    setEditingEntry(null);
    setConflictErrors([]);
  };

  const currentDayInfo = DAYS.find((d) => d.day === selectedDay) || DAYS[0];

  return (
    <div className="space-y-4">
      <div className="liquid-glass-panel rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
        {/* Scope toggle: Toàn trường | Theo Khối | Theo Lớp | Theo Giáo viên */}
          <div className="glass-pill-tray inline-flex flex-wrap text-xs font-semibold">
            <button
              type="button"
              data-testid="timetable-scope-school"
              onClick={() => setScopeMode('school')}
              className={`px-2.5 py-1.5 rounded-xl inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                scopeMode === 'school'
                  ? 'glass-pill-tab-active'
                  : 'glass-pill-tab'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Toàn trường
            </button>
            <button
              type="button"
              data-testid="timetable-scope-grade"
              onClick={() => setScopeMode('grade')}
              className={`px-2.5 py-1.5 rounded-xl inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                scopeMode === 'grade'
                  ? 'glass-pill-tab-active'
                  : 'glass-pill-tab'
              }`}
            >
              Theo khối
            </button>
            <button
              type="button"
              data-testid="timetable-scope-class"
              onClick={() => setScopeMode('class')}
              className={`px-2.5 py-1.5 rounded-xl inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                scopeMode === 'class'
                  ? 'glass-pill-tab-active'
                  : 'glass-pill-tab'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" /> Theo lớp
            </button>
            {teachers.length > 0 && (
              <button
                type="button"
                data-testid="timetable-scope-teacher"
                onClick={() => setScopeMode('teacher')}
                className={`px-2.5 py-1.5 rounded-xl inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                  scopeMode === 'teacher'
                    ? 'glass-pill-tab-active'
                    : 'glass-pill-tab'
                }`}
              >
                <Users className="w-3.5 h-3.5" /> Theo giáo viên
              </button>
            )}
          </div>

          {/* View mode toggle: Tuần | Ngày */}
          <div className="glass-pill-tray inline-flex text-xs font-semibold">
            <button
              type="button"
              data-testid="timetable-mode-week"
              onClick={() => setViewMode('week')}
              className={`px-2.5 py-1.5 rounded-xl inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                viewMode === 'week'
                  ? 'glass-pill-tab-active'
                  : 'glass-pill-tab'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> Tuần
            </button>
            <button
              type="button"
              data-testid="timetable-mode-day"
              onClick={() => setViewMode('day')}
              className={`px-2.5 py-1.5 rounded-xl inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                viewMode === 'day'
                  ? 'glass-pill-tab-active'
                  : 'glass-pill-tab'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" /> Ngày
            </button>
          </div>

          {/* Entity & Year/Semester selectors */}
          {scopeMode === 'grade' && (
            <select
              aria-label="Chọn khối"
              value={selectedGradeFilter}
              onChange={(e) => setSelectedGradeFilter(Number(e.target.value))}
              className="glass-subsurface rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              {availableGrades.map((g) => (
                <option key={g} value={g}>
                  Khối {g}
                </option>
              ))}
            </select>
          )}

          {scopeMode === 'class' && classes.length > 0 && (
            <select
              aria-label="Chọn lớp học"
              value={selectedClass?.id || ''}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="glass-subsurface rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {scopeMode === 'teacher' && teachers.length > 0 && (
            <select
              aria-label="Chọn giáo viên"
              value={selectedTeacher?.id || ''}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="glass-subsurface rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName} ({t.subject})
                </option>
              ))}
            </select>
          )}

          <select
            aria-label="Lọc theo năm học"
            value={selectedAcademicYear}
            onChange={(e) => setSelectedAcademicYear(e.target.value)}
            className="glass-subsurface rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            <option value="all">Mọi năm học</option>
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>

          <select
            aria-label="Lọc theo học kỳ"
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            className="glass-subsurface rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            <option value="all">Cả năm / Mọi kỳ</option>
            <option value="HK1">Học kỳ 1 (HK1)</option>
            <option value="HK2">Học kỳ 2 (HK2)</option>
          </select>

        </div>
        {(classes.length > 0 || extraToolbarActions) && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {classes.length > 0 && (
              <ModuleDataActions
                moduleKey="timetable"
                context={effectiveContext}
                currentUser={currentUser}
                allRecords={timetable as unknown as Record<string, unknown>[]}
                filteredRecords={activeEntries as unknown as Record<string, unknown>[]}
                canCreate={canCreate}
                canImport={canCreate}
                canExport={canExport}
                createLabel="Thêm tiết"
                onManualSave={async (entity) => {
                  onAddEntry?.(entity as unknown as TimetableEntry);
                }}
                onCommitImport={safeCommitImport}
                onLogExport={onLogExport}
              />
            )}
            {extraToolbarActions}
          </div>
        )}
      </div>

      {classes.length === 0 ? (
        <div className="liquid-glass-panel py-12 text-center flex flex-col items-center justify-center p-8 rounded-3xl">
          <div className="w-12 h-12 rounded-2xl glass-subsurface text-sky-600 dark:text-sky-400 flex items-center justify-center mb-3">
            <Calendar className="w-6 h-6 stroke-1" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Chưa có lớp học để xếp lịch</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mt-1">
            Hãy thêm lớp học trong ứng dụng Nhà trường trước khi xếp thời khóa biểu.
          </p>
        </div>
      ) : (
        <>
          {/* Compact Context Summary Header */}
          <LiquidCard className="p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              {scopeMode === 'school' ? (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-sky-500 text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
                    ALL
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Thời khóa biểu Toàn trường</h3>
                    <p className="text-slate-600 dark:text-slate-300">
                      Hiển thị <strong className="text-slate-900 dark:text-white font-mono-tabular">{activeEntries.length}</strong> tiết giảng dạy trên {classes.length} lớp
                    </p>
                  </div>
                </div>
              ) : scopeMode === 'grade' ? (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-500 text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
                    K{selectedGradeFilter}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Thời khóa biểu Khối {selectedGradeFilter}</h3>
                    <p className="text-slate-600 dark:text-slate-300">
                      <strong className="text-slate-900 dark:text-white font-mono-tabular">{activeEntries.length}</strong> tiết thuộc các lớp Khối {selectedGradeFilter}
                    </p>
                  </div>
                </div>
              ) : scopeMode === 'class' && selectedClass ? (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-400 to-indigo-500 text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
                    {selectedClass.code}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{selectedClass.name}</h3>
                    <p className="text-slate-600 dark:text-slate-300">
                      GVCN: <strong className="text-slate-900 dark:text-white">{selectedClass.homeroomTeacherName}</strong> · {selectedClass.room}
                    </p>
                  </div>
                </div>
              ) : selectedTeacher ? (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
                    GV
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{selectedTeacher.fullName}</h3>
                    <p className="text-slate-600 dark:text-slate-300">
                      Môn: <strong className="text-slate-900 dark:text-white">{selectedTeacher.subject}</strong> · <span className="font-mono-tabular">{activeEntries.length}</span> tiết/tuần
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                {scopeMode === 'class' && selectedClass && (
                  <>
                    <Badge variant="blue">Lớp {selectedClass.code}</Badge>
                    <Badge variant="mint">{selectedClass.academicYear}</Badge>
                  </>
                )}
                {scopeMode === 'teacher' && selectedTeacher && (
                  <Badge variant="purple">{selectedTeacher.subject}</Badge>
                )}
                {activeConflictsCount === 0 ? (
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Không xung đột
                  </span>
                ) : (
                  <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold inline-flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {activeConflictsCount} xung đột
                  </span>
                )}
              </div>
            </div>
          </LiquidCard>

          {viewMode === 'week' ? (
            <div className="glass-table-shell">
              <div className="overflow-x-auto">
                <table className="w-full text-center text-xs border-collapse">
                  <thead>
                    <tr className="glass-table-head border-b border-white/25 dark:border-white/10">
                      <th className="py-2.5 px-3 w-28 text-left border-r border-white/20 dark:border-white/10">
                        Tiết / Giờ
                      </th>
                      {DAYS.map((d) => (
                        <th
                          key={d.day}
                          className="py-2.5 px-3 border-r border-white/20 dark:border-white/10 last:border-r-0 min-w-[130px]"
                        >
                          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">{d.label}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/25 dark:divide-white/10">
                    {PERIODS.map((p) => (
                      <tr key={p.period} className="glass-table-row">
                        <td className="py-2.5 px-3 text-left bg-white/20 dark:bg-white/[0.03] border-r border-white/20 dark:border-white/10">
                          <p className="font-bold text-slate-900 dark:text-slate-100 text-xs">Tiết {p.period}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">{p.time}</p>
                        </td>

                        {DAYS.map((d) => {
                          const slotEntries = getEntriesForSlot(d.day, p.period);
                          const entry = slotEntries[0];
                          const isMultiScope = scopeMode === 'school' || scopeMode === 'grade';
                          return (
                            <td
                              key={d.day}
                              className="py-2 px-2 border-r border-white/20 dark:border-white/10 last:border-r-0 align-top h-20"
                            >
                              {isMultiScope && slotEntries.length > 0 ? (
                                <div className="space-y-1 text-left max-h-36 overflow-y-auto pr-0.5">
                                  {slotEntries.map((item) => (
                                    <div
                                      key={item.id}
                                      className="px-2 py-1 rounded-lg glass-subsurface text-[11px]"
                                    >
                                      <span className="font-bold text-sky-700 dark:text-sky-300">{item.className}</span>
                                      <span className="text-slate-800 dark:text-slate-200"> · {item.subject}</span>
                                      <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                        {item.teacherName} ({item.room})
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : entry ? (
                                <div className="p-2 rounded-xl glass-subsurface shadow-2xs text-left h-full flex flex-col justify-between group/slot hover:ring-1 hover:ring-sky-400/50 transition-all">
                                  <div className="flex items-start justify-between gap-1">
                                    <div className="min-w-0">
                                      <p className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate">
                                        {entry.subject}
                                      </p>
                                      <p className="text-[10px] text-slate-600 dark:text-slate-400 truncate mt-0.5">
                                        {scopeMode === 'teacher' ? `Lớp ${entry.className}` : entry.teacherName}
                                      </p>
                                    </div>
                                    {(canEdit || canDelete) && (
                                      <div className="flex items-center gap-0.5 opacity-0 group-hover/slot:opacity-100 transition-opacity shrink-0">
                                        {canEdit && (
                                          <button
                                            type="button"
                                            onClick={() => openEditSlot(entry)}
                                            aria-label={`Sửa tiết ${entry.subject}`}
                                            className="p-1 rounded text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer"
                                          >
                                            <Pencil className="w-3 h-3" />
                                          </button>
                                        )}
                                        {canDelete && onDeleteEntry && (
                                          <button
                                            type="button"
                                            onClick={() => onDeleteEntry(entry.id)}
                                            aria-label={`Xóa tiết ${entry.subject}`}
                                            className="p-1 rounded text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-mono text-sky-700 dark:text-sky-300 mt-1 truncate">
                                    {entry.room}
                                  </span>
                                </div>
                              ) : canCreate ? (
                                <button
                                  type="button"
                                  onClick={() => openAddSlot(d.day, p.period)}
                                  className="w-full h-full min-h-[56px] rounded-xl border border-dashed border-white/40 dark:border-white/15 hover:border-sky-400/60 hover:bg-sky-500/10 text-slate-400 dark:text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 flex items-center justify-center transition-colors text-[10px] cursor-pointer"
                                  title="Thêm tiết học"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <div className="w-full h-full min-h-[56px] flex items-center justify-center text-slate-400 dark:text-slate-600 text-[11px]">
                                  —
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Day Selector Strip */}
              <div className="glass-pill-tray inline-flex flex-wrap items-center gap-1">
                {DAYS.map((d) => {
                  const dayCount = activeEntries.filter((e) => e.dayOfWeek === d.day).length;
                  const active = selectedDay === d.day;
                  return (
                    <button
                      key={d.day}
                      type="button"
                      onClick={() => setSelectedDay(d.day)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                        active
                          ? 'glass-pill-tab-active'
                          : 'glass-pill-tab'
                      }`}
                    >
                      <span>{d.label}</span>
                      <span className={`font-mono-tabular text-[10px] px-1.5 py-0.2 rounded-full ${active ? 'bg-white/25 text-white' : 'bg-black/10 dark:bg-white/10 text-slate-700 dark:text-slate-300'}`}>
                        {dayCount}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Single-Day 5-Period Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {PERIODS.map((p) => {
                  const slotEntries = getEntriesForSlot(currentDayInfo.day, p.period);
                  const entry = slotEntries[0];
                  return (
                    <LiquidCard key={p.period} className="p-4 flex flex-col justify-between gap-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-sky-700 dark:text-sky-300 inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Tiết {p.period}
                        </span>
                        <span className="font-mono-tabular text-[11px] text-slate-400">{p.time}</span>
                      </div>

                      {entry ? (
                        <>
                          <div>
                            <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                              {entry.subject}
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {scopeMode === 'teacher' ? `Lớp ${entry.className}` : entry.teacherName}
                            </p>
                          </div>
                          <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between text-xs">
                            <Badge variant="blue" size="sm">{entry.room}</Badge>
                            {(canEdit || canDelete) && (
                              <div className="flex items-center gap-1">
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => openEditSlot(entry)}
                                    aria-label={`Sửa tiết ${entry.subject}`}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-sky-500/10 cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {canDelete && onDeleteEntry && (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteEntry(entry.id)}
                                    aria-label={`Xóa tiết ${entry.subject}`}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="py-3 flex items-center justify-between">
                          <span className="text-xs text-slate-400">Trống tiết</span>
                          {canCreate && (
                            <button
                              type="button"
                              onClick={() => openAddSlot(currentDayInfo.day, p.period)}
                              className="px-2.5 py-1 rounded-lg bg-sky-500/12 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" /> Thêm
                            </button>
                          )}
                        </div>
                      )}
                    </LiquidCard>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Add / Edit Entry Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingEntry(null);
            setConflictErrors([]);
          }}
          title={`${editingEntry ? 'Cập nhật' : 'Thêm'} Tiết học: Thứ ${slotToAdd.day} - Tiết ${slotToAdd.period}`}
          description={`Lớp: ${classes.find((c) => c.id === modalClassId)?.name || selectedClass?.name || ''}`}
          maxWidth="md"
        >
          <form onSubmit={handleSaveSlot} className="space-y-3.5 text-xs">
            {conflictErrors.length > 0 && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" /> Phát hiện xung đột lịch giảng dạy:
                </p>
                {conflictErrors.map((c, idx) => (
                  <p key={idx} className="text-[11px] leading-relaxed">• {c.message}</p>
                ))}
              </div>
            )}

            {(scopeMode === 'teacher' || editingEntry) && classes.length > 0 && (
              <div>
                <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">Lớp học *</label>
                <select
                  value={modalClassId}
                  onChange={(e) => {
                    setModalClassId(e.target.value);
                    setConflictErrors([]);
                  }}
                  className="w-full px-3 py-2 rounded-xl glass-subsurface text-slate-900 dark:text-slate-100"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.room})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">Môn học *</label>
              <select
                value={newSubject}
                onChange={(e) => {
                  setNewSubject(e.target.value);
                  setConflictErrors([]);
                }}
                className="w-full px-3 py-2 rounded-xl glass-subsurface text-slate-900 dark:text-slate-100"
              >
                {subjectOptions.map((sub) => (
                  <option key={sub.value} value={sub.value}>
                    {sub.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">Giáo viên phụ trách</label>
              {teachers.length > 0 ? (
                <select
                  value={newTeacherId}
                  onChange={(e) => {
                    const t = teachers.find((x) => x.id === e.target.value);
                    setNewTeacherId(e.target.value);
                    setNewTeacher(t?.fullName || '');
                    setConflictErrors([]);
                  }}
                  className="w-full px-3 py-2 rounded-xl glass-subsurface text-slate-900 dark:text-slate-100"
                >
                  <option value="">Chưa phân công</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName} ({t.subject})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Họ và tên giáo viên..."
                  value={newTeacher}
                  onChange={(e) => {
                    setNewTeacher(e.target.value);
                    setConflictErrors([]);
                  }}
                  className="w-full px-3 py-2 rounded-xl glass-subsurface text-slate-900 dark:text-slate-100"
                />
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">Phòng học</label>
              {rooms.length > 0 ? (
                <select
                  value={newRoom}
                  onChange={(e) => {
                    setNewRoom(e.target.value);
                    setConflictErrors([]);
                  }}
                  className="w-full px-3 py-2 rounded-xl glass-subsurface text-slate-900 dark:text-slate-100"
                >
                  <option value={selectedClass?.room || ''}>{selectedClass?.room || 'Phòng mặc định'}</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name} ({r.building})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={newRoom}
                  onChange={(e) => {
                    setNewRoom(e.target.value);
                    setConflictErrors([]);
                  }}
                  className="w-full px-3 py-2 rounded-xl glass-subsurface text-slate-900 dark:text-slate-100"
                />
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-2 rounded-xl glass-subsurface text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold shadow-xs cursor-pointer"
              >
                Lưu Tiết Học
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
