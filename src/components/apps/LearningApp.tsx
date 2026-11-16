import React, { useMemo, useState } from 'react';
import {
  CalendarDays, Clock, MapPin, Users, Plus, Search, CheckCircle2, Sparkles
} from 'lucide-react';
import {
  ExportHistoryRecord,
  ImportHistoryRecord,
  ImportModuleKey,
  PermissionMatrix,
  SchoolClass,
  SchoolEvent,
  SchoolRoom,
  Student,
  Teacher,
  TimetableEntry,
  UserProfile,
} from '../../types';
import { AppWindowShell } from '../shared/AppWindowShell';
import { EmptyState } from '../shared/EmptyState';
import { LiquidCard } from '../common/LiquidCard';
import { Badge } from '../common/Badge';
import { ModuleDataActions } from '../importExport/ModuleDataActions';
import { UnifiedManualFormModal } from '../importExport/UnifiedManualFormModal';
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
  timetable: TimetableEntry[];
  schoolEvents?: SchoolEvent[];
  onSelectTab: (tabId: string) => void;
  onAddTimetableEntry: (entry: TimetableEntry) => void;
  onUpdateTimetableEntry: (entry: TimetableEntry) => void;
  onDeleteTimetableEntry: (entryId: string) => void;
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
  timetable,
  schoolEvents = [],
  onSelectTab,
  onAddTimetableEntry,
  onUpdateTimetableEntry,
  onDeleteTimetableEntry,
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
          {tabId === 'timetable' && (
            <TimetableView
              classes={classes}
              teachers={teachers}
              rooms={rooms}
              timetable={timetable}
              currentUser={currentUser}
              customPermissions={customPermissions}
              validationContext={effectiveContext}
              onAddEntry={onAddTimetableEntry}
              onUpdateEntry={onUpdateTimetableEntry}
              onDeleteEntry={onDeleteTimetableEntry}
              onUnifiedImportCommit={onUnifiedImportCommit}
              onLogExport={onLogExport}
            />
          )}

          {tabId === 'schedule' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    Thời Gian Biểu &amp; Kế Hoạch Trường
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Lịch thi, sinh hoạt chuyên đề, ngoại khóa và mốc thời gian quan trọng toàn trường
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {onUnifiedImportCommit && onSaveSchoolEvent ? (
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
                    canCreateSchedule &&
                    onSaveSchoolEvent && (
                      <button
                        type="button"
                        onClick={() => setIsAddScheduleOpen(true)}
                        className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> Thêm lịch
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Filter Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="inline-flex flex-wrap rounded-xl bg-white/75 dark:bg-slate-800/75 border border-slate-200 dark:border-slate-700 p-0.5 text-xs font-semibold">
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
                      className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                        scheduleFilter === f.id
                          ? 'bg-violet-600 text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={scheduleSearch}
                    onChange={(e) => setScheduleSearch(e.target.value)}
                    placeholder="Tìm lịch, địa điểm..."
                    className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

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
            </div>
          )}
        </>
      )}
    </AppWindowShell>
  );
};
