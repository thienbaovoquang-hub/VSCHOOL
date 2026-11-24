import React, { useMemo, useState } from 'react';
import {
  CalendarDays, Clock, MapPin, Users, Plus, Search, CheckCircle2, Sparkles, Pencil, Trash2
} from 'lucide-react';
import {
  AcademicYearConfig,
  AfternoonScheduleEntry,
  DataSourceConfig,
  DataSourceGroupKey,
  DataSourceMethod,
  ExportHistoryRecord,
  ImportHistoryRecord,
  ImportModuleKey,
  PermissionMatrix,
  SchoolClass,
  SchoolEvent,
  SchoolRoom,
  Student,
  SystemSettings,
  Teacher,
  TimetableEntry,
  UserProfile,
} from '../../types';
import { AppWindowShell } from '../shared/AppWindowShell';
import { EmptyState } from '../shared/EmptyState';
import { LiquidCard } from '../common/LiquidCard';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { ModuleDataActions } from '../importExport/ModuleDataActions';
import { UnifiedManualFormModal } from '../importExport/UnifiedManualFormModal';
import { DataSourceButton } from '../dataSources/DataSourceButton';
import { DataSourceModal } from '../dataSources/DataSourceModal';
import type {
  DataSourceExistingData,
  DataSourceRuntimeContext,
  GroupValidationResult,
} from '../../utils/dataSources/templateEngine';
import type { ValidationDbContext } from '../../utils/importExport/validator';
import { TimetableView } from '../../views/TimetableView';
import { DEFAULT_PERMISSIONS, hasPermission } from '../../utils/rbac';

interface LearningAppProps {
  activeTab: string;
  currentUser: UserProfile;
  customPermissions?: PermissionMatrix;
  validationContext?: ValidationDbContext;
  students: Student[];
  teachers: Teacher[];
  classes: SchoolClass[];
  rooms: SchoolRoom[];
  academicYears?: AcademicYearConfig[];
  systemSettings?: SystemSettings;
  timetable: TimetableEntry[];
  afternoonSchedules?: AfternoonScheduleEntry[];
  schoolEvents?: SchoolEvent[];
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
  onAddTimetableEntry: (entry: TimetableEntry) => void;
  onUpdateTimetableEntry: (entry: TimetableEntry) => void;
  onDeleteTimetableEntry: (entryId: string) => void;
  onSaveAfternoonSchedule?: (entry: AfternoonScheduleEntry) => Promise<void> | void;
  onDeleteAfternoonSchedule?: (entryId: string) => Promise<void> | void;
  onSaveSchoolEvent?: (evt: SchoolEvent) => void;
  onUnifiedImportCommit?: (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => Promise<void> | void;
  onLogExport?: (record: ExportHistoryRecord) => Promise<void> | void;
}

export const LearningApp: React.FC<LearningAppProps> = ({
  activeTab,
  currentUser,
  customPermissions = DEFAULT_PERMISSIONS,
  validationContext,
  students,
  teachers,
  classes,
  rooms,
  academicYears = [],
  systemSettings,
  timetable,
  afternoonSchedules = [],
  schoolEvents = [],
  dataSourceConfigs = [],
  isAdmin = false,
  dataSourceRuntimeContext,
  dataSourceExistingData,
  onSaveDataSourceConfig,
  onDeleteDataSourceConfig,
  onCommitNormalizedGroupData,
  onSelectTab,
  onAddTimetableEntry,
  onUpdateTimetableEntry,
  onDeleteTimetableEntry,
  onSaveAfternoonSchedule,
  onDeleteAfternoonSchedule,
  onSaveSchoolEvent,
  onUnifiedImportCommit,
  onLogExport,
}) => {
  const canCreateSchedule =
    hasPermission(currentUser.role, 'timetable', 'create', customPermissions) ||
    hasPermission(currentUser.role, 'announcements', 'create', customPermissions);
  const canExportSchedule =
    hasPermission(currentUser.role, 'timetable', 'export', customPermissions) || canCreateSchedule;

  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'upcoming' | 'ongoing' | 'completed'>('all');
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [isAddScheduleOpen, setIsAddScheduleOpen] = useState(false);
  const [isDataSourceOpen, setIsDataSourceOpen] = useState(false);
  const [scheduleSubMode, setScheduleSubMode] = useState<'afternoon' | 'events'>('afternoon');
  const [afternoonDayFilter, setAfternoonDayFilter] = useState<number | 'all'>('all');
  const [editingAfternoon, setEditingAfternoon] = useState<AfternoonScheduleEntry | null>(null);
  const [isAfternoonModalOpen, setIsAfternoonModalOpen] = useState(false);
  const [afternoonForm, setAfternoonForm] = useState({
    dayOfWeek: 2,
    className: 'Toàn trường',
    startTime: '14:00',
    endTime: '15:30',
    activity: '',
    location: '',
    coordinator: '',
    notes: '',
  });

  const effectiveContext: ValidationDbContext = useMemo(
    () =>
      validationContext ?? {
        classes,
        teachers,
        rooms,
        students,
        timetable,
      },
    [validationContext, classes, teachers, rooms, students, timetable]
  );

  const filteredEvents = useMemo(() => {
    const q = scheduleSearch.trim().toLowerCase();
    return [...schoolEvents]
      .filter((evt) => {
        if (scheduleFilter !== 'all' && evt.status !== scheduleFilter) return false;
        if (!q) return true;
        return (
          evt.title.toLowerCase().includes(q) ||
          evt.location.toLowerCase().includes(q) ||
          evt.category.toLowerCase().includes(q) ||
          (evt.description || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [schoolEvents, scheduleFilter, scheduleSearch]);

  const handleToggleEventRegister = (evt: SchoolEvent) => {
    if (!onSaveSchoolEvent) return;
    const list = evt.registeredUserIds || [];
    const already = list.includes(currentUser.id);
    if (!already && evt.capacity && list.length >= evt.capacity) return;
    onSaveSchoolEvent({
      ...evt,
      registeredUserIds: already ? list.filter((id) => id !== currentUser.id) : [...list, currentUser.id],
    });
  };

  return (
    <AppWindowShell
      appId="learning"
      activeTab={activeTab}
      userRole={currentUser.role}
      userProfile={currentUser}
      customPermissions={customPermissions}
      onSelectTab={onSelectTab}
    >
      {(tabId) => (
        <>
          {isAdmin && onSaveDataSourceConfig && onCommitNormalizedGroupData && (
            <DataSourceModal
              isOpen={isDataSourceOpen}
              onClose={() => setIsDataSourceOpen(false)}
              groupKey="learning"
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
                  staffMembers: [],
                  timetable,
                  afternoonSchedules,
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

          {tabId === 'timetable' && (
            <div className="space-y-4">
              <TimetableView
                classes={classes}
                teachers={teachers}
                rooms={rooms}
                academicYears={academicYears}
                systemSettings={systemSettings}
                timetable={timetable}
                currentUser={currentUser}
                customPermissions={customPermissions}
                validationContext={effectiveContext}
                onAddEntry={onAddTimetableEntry}
                onUpdateEntry={onUpdateTimetableEntry}
                onDeleteEntry={onDeleteTimetableEntry}
                onUnifiedImportCommit={onUnifiedImportCommit}
                onLogExport={onLogExport}
                extraToolbarActions={
                  isAdmin && onSaveDataSourceConfig ? (
                    <DataSourceButton
                      groupKey="learning"
                      config={dataSourceConfigs.find((c) => c.groupKey === 'learning')}
                      isAdmin={isAdmin}
                      onClick={() => setIsDataSourceOpen(true)}
                    />
                  ) : undefined
                }
              />
            </div>
          )}

          {tabId === 'schedule' && (
            <div className="space-y-4">
              <div className="liquid-glass-panel rounded-2xl p-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="glass-pill-tray inline-flex text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setScheduleSubMode('afternoon')}
                      className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all whitespace-nowrap ${
                        scheduleSubMode === 'afternoon'
                          ? 'glass-pill-tab-active'
                          : 'glass-pill-tab'
                      }`}
                    >
                      Buổi chiều ({afternoonSchedules.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleSubMode('events')}
                      className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all whitespace-nowrap ${
                        scheduleSubMode === 'events'
                          ? 'glass-pill-tab-active'
                          : 'glass-pill-tab'
                      }`}
                    >
                      Kế hoạch trường ({schoolEvents.length})
                    </button>
                  </div>

                  {scheduleSubMode === 'afternoon' && (
                    <div className="glass-pill-tray inline-flex flex-wrap gap-0.5 text-xs">
                      {(['all', 2, 3, 4, 5, 6, 7] as const).map((day) => (
                        <button
                          key={String(day)}
                          type="button"
                          title={day === 'all' ? 'Tất cả thứ' : `Thứ ${day}`}
                          onClick={() => setAfternoonDayFilter(day)}
                          className={`px-2.5 py-1.5 rounded-xl font-semibold cursor-pointer transition-all whitespace-nowrap ${
                            afternoonDayFilter === day
                              ? 'glass-pill-tab-active'
                              : 'glass-pill-tab'
                          }`}
                        >
                          {day === 'all' ? 'Tất cả' : `T${day}`}
                        </button>
                      ))}
                    </div>
                  )}

                  {scheduleSubMode === 'events' && (
                    <div className="glass-pill-tray inline-flex flex-wrap text-xs font-semibold">
                      {[
                        { id: 'all' as const, label: `Tất cả (${schoolEvents.length})` },
                        { id: 'upcoming' as const, label: 'Sắp diễn ra' },
                        { id: 'ongoing' as const, label: 'Đang diễn ra' },
                        { id: 'completed' as const, label: 'Đã kết thúc' },
                      ].map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setScheduleFilter(f.id)}
                          className={`px-2.5 py-1.5 rounded-xl cursor-pointer transition-all whitespace-nowrap ${
                            scheduleFilter === f.id
                              ? 'glass-pill-tab-active'
                              : 'glass-pill-tab'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {scheduleSubMode === 'events' && (
                    <div className="relative w-44 sm:w-52">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={scheduleSearch}
                        onChange={(e) => setScheduleSearch(e.target.value)}
                        placeholder="Tìm lịch, địa điểm..."
                        className="w-full glass-subsurface rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  )}

                  {scheduleSubMode === 'afternoon' && canCreateSchedule && onSaveAfternoonSchedule && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAfternoon(null);
                        setAfternoonForm({
                          dayOfWeek: 2,
                          className: 'Toàn trường',
                          startTime: '14:00',
                          endTime: '15:30',
                          activity: '',
                          location: '',
                          coordinator: '',
                          notes: '',
                        });
                        setIsAfternoonModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm lịch chiều
                    </button>
                  )}

                  {scheduleSubMode === 'events' && onUnifiedImportCommit && onSaveSchoolEvent ? (
                    <ModuleDataActions
                      moduleKey="events"
                      context={effectiveContext}
                      currentUser={currentUser}
                      allRecords={schoolEvents as unknown as Record<string, unknown>[]}
                      filteredRecords={filteredEvents as unknown as Record<string, unknown>[]}
                      canCreate={canCreateSchedule}
                      canImport={canCreateSchedule}
                      canExport={canExportSchedule || schoolEvents.length > 0}
                      createLabel="Thêm lịch"
                      onManualSave={async (entity) => {
                        onSaveSchoolEvent(entity as unknown as SchoolEvent);
                      }}
                      onCommitImport={(key, items, hist) => onUnifiedImportCommit(key, items, hist)}
                      onLogExport={onLogExport}
                    />
                  ) : (
                    scheduleSubMode === 'events' &&
                    canCreateSchedule &&
                    onSaveSchoolEvent && (
                      <button
                        type="button"
                        onClick={() => setIsAddScheduleOpen(true)}
                        className="px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-4 h-4" /> Thêm lịch
                      </button>
                    )
                  )}

                  {isAdmin && onSaveDataSourceConfig && (
                    <DataSourceButton
                      groupKey="learning"
                      config={dataSourceConfigs.find((c) => c.groupKey === 'learning')}
                      isAdmin={isAdmin}
                      onClick={() => setIsDataSourceOpen(true)}
                    />
                  )}
                </div>
              </div>

              {scheduleSubMode === 'afternoon' && (
                <div className="space-y-3">

                  {afternoonSchedules.filter(
                    (a) => afternoonDayFilter === 'all' || a.dayOfWeek === afternoonDayFilter
                  ).length === 0 ? (
                    <EmptyState
                      icon={Clock}
                      title="Chưa có lịch buổi chiều"
                      description="Đồng bộ sheet ThoiGianBieu_BuoiChieu từ Nguồn dữ liệu Excel hoặc thêm lịch phụ đạo, CLB buổi chiều."
                    />
                  ) : (
                    <div className="glass-table-shell">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="glass-table-head">
                            <tr>
                              <th className="px-4 py-2.5">Thứ / Giờ</th>
                              <th className="px-4 py-2.5">Phạm vi lớp</th>
                              <th className="px-4 py-2.5">Hoạt động</th>
                              <th className="px-4 py-2.5">Địa điểm</th>
                              <th className="px-4 py-2.5">Phụ trách</th>
                              {canCreateSchedule && <th className="px-4 py-2.5 text-right">Thao tác</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/25 dark:divide-white/10">
                            {afternoonSchedules
                              .filter(
                                (a) => afternoonDayFilter === 'all' || a.dayOfWeek === afternoonDayFilter
                              )
                              .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
                              .map((item) => (
                                <tr key={item.id} className="glass-table-row">
                                  <td className="px-4 py-2.5 font-mono-tabular whitespace-nowrap">
                                    <span className="font-bold text-teal-700 dark:text-teal-300">
                                      Thứ {item.dayOfWeek}
                                    </span>{' '}
                                    · {item.startTime}–{item.endTime}
                                  </td>
                                  <td className="px-4 py-2.5 font-semibold text-slate-800 dark:text-slate-200">
                                    {item.className || 'Toàn trường'}
                                  </td>
                                  <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-slate-100">
                                    {item.activity}
                                    {item.notes && (
                                      <span className="block text-[11px] font-normal text-slate-500 dark:text-slate-400">
                                        {item.notes}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                                    {item.location || '—'}
                                  </td>
                                  <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                                    {item.coordinator || '—'}
                                  </td>
                                  {canCreateSchedule && (
                                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                      <div className="inline-flex items-center gap-1">
                                        {onSaveAfternoonSchedule && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingAfternoon(item);
                                              setAfternoonForm({
                                                dayOfWeek: item.dayOfWeek,
                                                className: item.className || 'Toàn trường',
                                                startTime: item.startTime,
                                                endTime: item.endTime,
                                                activity: item.activity,
                                                location: item.location || '',
                                                coordinator: item.coordinator || '',
                                                notes: item.notes || '',
                                              });
                                              setIsAfternoonModalOpen(true);
                                            }}
                                            aria-label={`Sửa ${item.activity}`}
                                            className="p-1.5 rounded-lg text-sky-600 dark:text-sky-400 hover:bg-sky-500/15 cursor-pointer transition-colors"
                                          >
                                            <Pencil className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                        {onDeleteAfternoonSchedule && (
                                          <button
                                            type="button"
                                            onClick={() => void onDeleteAfternoonSchedule(item.id)}
                                            aria-label={`Xóa ${item.activity}`}
                                            className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 cursor-pointer transition-colors"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {scheduleSubMode === 'events' && (
                <>

              {filteredEvents.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="Chưa có lịch trình phù hợp"
                  description="Thêm kế hoạch sinh hoạt, lịch kiểm tra tập trung hoặc hoạt động ngoại khóa để hiển thị theo dòng thời gian."
                  action={
                    canCreateSchedule && onSaveSchoolEvent ? (
                      <button
                        type="button"
                        onClick={() => setIsAddScheduleOpen(true)}
                        className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> Tạo lịch đầu tiên
                      </button>
                    ) : null
                  }
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredEvents.map((evt) => {
                    const regIds = evt.registeredUserIds || [];
                    const isRegistered = regIds.includes(currentUser.id);
                    const isFull = Boolean(evt.capacity && regIds.length >= evt.capacity);
                    return (
                      <LiquidCard key={evt.id} className="p-4 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="purple" size="sm">
                            <Sparkles className="w-3 h-3 mr-1 inline" />
                            {evt.category}
                          </Badge>
                          <Badge
                            variant={
                              evt.status === 'upcoming'
                                ? 'mint'
                                : evt.status === 'ongoing'
                                ? 'blue'
                                : 'gray'
                            }
                            size="sm"
                          >
                            {evt.status === 'upcoming'
                              ? 'Sắp diễn ra'
                              : evt.status === 'ongoing'
                              ? 'Đang diễn ra'
                              : 'Đã kết thúc'}
                          </Badge>
                        </div>

                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          {evt.title}
                        </h3>
                        {evt.description && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                            {evt.description}
                          </p>
                        )}

                        <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <div className="flex flex-wrap gap-3">
                            <span className="inline-flex items-center gap-1 font-mono-tabular font-semibold text-violet-700 dark:text-violet-300">
                              <Clock className="w-3.5 h-3.5" /> {evt.date} · {evt.time}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-sky-500" /> {evt.location}
                            </span>
                            <span className="inline-flex items-center gap-1 font-mono-tabular">
                              <Users className="w-3.5 h-3.5 text-emerald-500" /> {regIds.length}
                              {evt.capacity ? `/${evt.capacity}` : ''}
                            </span>
                          </div>

                          {onSaveSchoolEvent && evt.status !== 'completed' && (
                            <button
                              type="button"
                              disabled={!isRegistered && isFull}
                              onClick={() => handleToggleEventRegister(evt)}
                              className={`px-2.5 py-1 rounded-lg font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-40 ${
                                isRegistered
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-violet-600 text-white'
                              }`}
                            >
                              {isRegistered ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3" /> Đã tham gia
                                </>
                              ) : isFull ? (
                                'Đã đủ'
                              ) : (
                                'Tham gia'
                              )}
                            </button>
                          )}
                        </div>
                      </LiquidCard>
                    );
                  })}
                </div>
              )}

              {onSaveSchoolEvent && (
                <UnifiedManualFormModal
                  isOpen={isAddScheduleOpen}
                  moduleKey="events"
                  context={effectiveContext}
                  existingRecords={schoolEvents as unknown as Record<string, unknown>[]}
                  currentUser={currentUser}
                  onClose={() => setIsAddScheduleOpen(false)}
                  onSave={(entity) => {
                    onSaveSchoolEvent(entity as unknown as SchoolEvent);
                    setIsAddScheduleOpen(false);
                  }}
                />
              )}

                </>
              )}

              {isAfternoonModalOpen && onSaveAfternoonSchedule && (
                <Modal
                  isOpen={isAfternoonModalOpen}
                  onClose={() => {
                    setIsAfternoonModalOpen(false);
                    setEditingAfternoon(null);
                  }}
                  title={editingAfternoon ? 'Cập nhật lịch buổi chiều' : 'Thêm lịch buổi chiều'}
                  maxWidth="md"
                >
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!afternoonForm.activity.trim()) return;
                      await onSaveAfternoonSchedule({
                        ...(editingAfternoon || {}),
                        id: editingAfternoon?.id || `AFT-${Date.now()}`,
                        academicYear: systemSettings?.academicYear || academicYears[0]?.name || '2026 - 2027',
                        dayOfWeek: afternoonForm.dayOfWeek,
                        className: afternoonForm.className.trim() || 'Toàn trường',
                        startTime: afternoonForm.startTime,
                        endTime: afternoonForm.endTime,
                        activity: afternoonForm.activity.trim(),
                        location: afternoonForm.location.trim(),
                        coordinator: afternoonForm.coordinator.trim(),
                        notes: afternoonForm.notes.trim(),
                      });
                      setIsAfternoonModalOpen(false);
                      setEditingAfternoon(null);
                    }}
                    className="space-y-3 text-xs"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">Thứ *</label>
                        <select
                          value={afternoonForm.dayOfWeek}
                          onChange={(e) => setAfternoonForm({ ...afternoonForm, dayOfWeek: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl glass-subsurface"
                        >
                          {[2, 3, 4, 5, 6, 7].map((d) => (
                            <option key={d} value={d}>Thứ {d}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Lớp / Phạm vi</label>
                        <input
                          type="text"
                          value={afternoonForm.className}
                          onChange={(e) => setAfternoonForm({ ...afternoonForm, className: e.target.value })}
                          placeholder="Toàn trường hoặc 10A1"
                          className="w-full px-3 py-2 rounded-xl glass-subsurface"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">Giờ bắt đầu *</label>
                        <input
                          type="text"
                          value={afternoonForm.startTime}
                          onChange={(e) => setAfternoonForm({ ...afternoonForm, startTime: e.target.value })}
                          placeholder="14:00"
                          className="w-full px-3 py-2 rounded-xl glass-subsurface font-mono-tabular"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Giờ kết thúc *</label>
                        <input
                          type="text"
                          value={afternoonForm.endTime}
                          onChange={(e) => setAfternoonForm({ ...afternoonForm, endTime: e.target.value })}
                          placeholder="15:30"
                          className="w-full px-3 py-2 rounded-xl glass-subsurface font-mono-tabular"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Hoạt động *</label>
                      <input
                        type="text"
                        required
                        value={afternoonForm.activity}
                        onChange={(e) => setAfternoonForm({ ...afternoonForm, activity: e.target.value })}
                        placeholder="Bồi dưỡng HSG Toán / CLB Tiếng Anh..."
                        className="w-full px-3 py-2 rounded-xl glass-subsurface"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">Địa điểm</label>
                        <input
                          type="text"
                          value={afternoonForm.location}
                          onChange={(e) => setAfternoonForm({ ...afternoonForm, location: e.target.value })}
                          placeholder="Phòng 201 / Sân trường"
                          className="w-full px-3 py-2 rounded-xl glass-subsurface"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Người phụ trách</label>
                        <input
                          type="text"
                          value={afternoonForm.coordinator}
                          onChange={(e) => setAfternoonForm({ ...afternoonForm, coordinator: e.target.value })}
                          placeholder="Họ tên giáo viên"
                          className="w-full px-3 py-2 rounded-xl glass-subsurface"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsAfternoonModalOpen(false)}
                        className="px-3 py-2 rounded-xl glass-subsurface cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold cursor-pointer"
                      >
                        Lưu lịch chiều
                      </button>
                    </div>
                  </form>
                </Modal>
              )}
            </div>
          )}
        </>
      )}
    </AppWindowShell>
  );
};
