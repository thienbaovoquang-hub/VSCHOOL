import React, { useState, useMemo } from 'react';
import ExcelJS from 'exceljs';
import {
  Sparkles, CalendarDays, Send, Plus, MapPin, Clock, CheckCircle2, Bell,
  Users, Download, ChevronLeft, ChevronRight, List, Calendar
} from 'lucide-react';
import {
  Announcement,
  ExportHistoryRecord,
  ImportHistoryRecord,
  ImportModuleKey,
  PermissionMatrix,
  SchoolEvent,
  UserProfile,
} from '../../types';
import { AppWindowShell } from '../shared/AppWindowShell';
import { EmptyState } from '../shared/EmptyState';
import { LiquidCard } from '../common/LiquidCard';
import { Badge } from '../common/Badge';
import { ModuleDataActions } from '../importExport/ModuleDataActions';
import { UnifiedManualFormModal } from '../importExport/UnifiedManualFormModal';
import { triggerBinaryDownload } from '../../utils/importExport/excelEngine';
import type { ValidationDbContext } from '../../utils/importExport/validator';
import { resolveCatalogOptions } from '../../utils/catalogs/catalogRegistry';
import { AnnouncementsView } from '../../views/AnnouncementsView';
import { DEFAULT_PERMISSIONS, hasPermission } from '../../utils/rbac';

interface CommunicationAppProps {
  activeTab: string;
  currentUser: UserProfile;
  customPermissions?: PermissionMatrix;
  validationContext?: ValidationDbContext;
  announcements: Announcement[];
  events: SchoolEvent[];
  onSelectTab: (tabId: string) => void;
  onCreateAnnouncement: (ann: Announcement) => Promise<void>;
  onUpdateAnnouncement: (ann: Announcement) => Promise<void>;
  onSaveEvent: (evt: SchoolEvent) => void;
  onUnifiedImportCommit?: (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => Promise<void> | void;
  onLogExport?: (record: ExportHistoryRecord) => Promise<void> | void;
}

export const CommunicationApp: React.FC<CommunicationAppProps> = ({
  activeTab,
  currentUser,
  customPermissions = DEFAULT_PERMISSIONS,
  validationContext = {},
  announcements,
  events,
  onSelectTab,
  onCreateAnnouncement,
  onUpdateAnnouncement,
  onSaveEvent,
  onUnifiedImportCommit,
  onLogExport,
}) => {
  const canCreate = hasPermission(currentUser.role, 'announcements', 'create', customPermissions);
  const canEdit = hasPermission(currentUser.role, 'announcements', 'edit', customPermissions);

  const [isAddEventOpen, setIsAddEventOpen] = useState(false);

  // Calendar view state
  const [calendarViewMode, setCalendarViewMode] = useState<'month' | 'list'>('month');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDayStr, setSelectedDayStr] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Dispatch composer state
  const [dispatchTitle, setDispatchTitle] = useState('');
  const [dispatchContent, setDispatchContent] = useState('');
  const [dispatchAudience, setDispatchAudience] = useState<Announcement['targetAudience']>('Toàn trường');
  const [dispatchCategory, setDispatchCategory] = useState<Announcement['category']>('Toàn trường');
  const [dispatchPriority, setDispatchPriority] = useState<Announcement['priority']>('normal');
  const [dispatchStatus, setDispatchStatus] = useState<'published' | 'draft'>('published');
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);

  const announcementCategoryOptions = useMemo(
    () => resolveCatalogOptions({ catalogId: 'announcement_category', runtime: validationContext }),
    [validationContext]
  );

  const announcementAudienceOptions = useMemo(
    () => resolveCatalogOptions({ catalogId: 'announcement_audience', runtime: validationContext }),
    [validationContext]
  );

  const calendarItems = useMemo(() => {
    const evtItems = events.map((e) => ({
      id: `evt-${e.id}`,
      date: e.date,
      title: e.title,
      subtitle: `${e.time} · ${e.location}`,
      kind: 'Sự kiện' as const,
    }));
    const pinnedAnns = announcements
      .filter((a) => (a.status || 'published') === 'published' && (a.isPinned || a.priority === 'urgent'))
      .map((a) => ({
        id: `ann-${a.id}`,
        date: a.publishedAt.slice(0, 10),
        title: a.title,
        subtitle: `${a.category} · ${a.targetAudience}`,
        kind: 'Thông báo' as const,
      }));
    return [...evtItems, ...pinnedAnns].sort((a, b) => a.date.localeCompare(b.date));
  }, [events, announcements]);

  const monthGridDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startWeekday = (firstDay.getDay() + 6) % 7; // Mon=0 .. Sun=6
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ dateStr: string; dayNum: number } | null> = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      cells.push({ dateStr: `${year}-${mStr}-${dStr}`, dayNum: d });
    }
    return cells;
  }, [calendarMonth]);

  const handleExportEventRegistrations = async (evt: SchoolEvent) => {
    const regIds = evt.registeredUserIds || [];
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SchoolHub Export Engine';
    const ws = wb.addWorksheet('DANG_KY_SU_KIEN');
    ws.columns = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Sự kiện', key: 'title', width: 32 },
      { header: 'Ngày tổ chức', key: 'date', width: 15 },
      { header: 'Mã / ID Người đăng ký', key: 'userId', width: 28 },
    ];
    regIds.forEach((uid, idx) => {
      ws.addRow({ stt: idx + 1, title: evt.title, date: evt.date, userId: uid });
    });
    const buffer = await wb.xlsx.writeBuffer();
    const fileName = `Danh_sach_Dang_ky_${evt.id}.xlsx`;
    triggerBinaryDownload(
      new Uint8Array(buffer as ArrayBuffer),
      fileName,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    if (onLogExport) {
      await onLogExport({
        id: `EXP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        moduleKey: 'events',
        moduleTitle: `Đăng ký sự kiện: ${evt.title}`,
        appId: 'communication',
        format: 'xlsx',
        scope: 'selected',
        rowCount: regIds.length,
        columnCount: 4,
        fileName,
        actorName: currentUser.displayName,
        actorRole: currentUser.role,
        timestamp: new Date().toISOString(),
      });
    }
  };

  const handleToggleEventRegister = (evt: SchoolEvent) => {
    const list = evt.registeredUserIds || [];
    const already = list.includes(currentUser.id);
    if (!already && evt.capacity && list.length >= evt.capacity) return;
    const nextList = already ? list.filter((id) => id !== currentUser.id) : [...list, currentUser.id];
    onSaveEvent({
      ...evt,
      registeredUserIds: nextList,
    });
  };

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchTitle.trim() || !dispatchContent.trim()) return;
    await onCreateAnnouncement({
      id: `ANN-${Date.now()}`,
      title: dispatchTitle.trim(),
      content: dispatchContent.trim(),
      category: dispatchCategory,
      targetAudience: dispatchAudience,
      isPinned: dispatchPriority !== 'normal',
      priority: dispatchPriority,
      status: dispatchStatus,
      readByIds: [currentUser.id],
      authorName: currentUser.displayName,
      authorRole: currentUser.role,
      publishedAt: new Date().toISOString(),
    });
    setDispatchTitle('');
    setDispatchContent('');
    setDispatchSuccess(
      dispatchStatus === 'published'
        ? 'Đã phát hành thông báo thành công!'
        : 'Đã lưu bản nháp thông báo.'
    );
    setTimeout(() => setDispatchSuccess(null), 3000);
  };

  const selectedDayItems = calendarItems.filter((item) => item.date === selectedDayStr);

  return (
    <AppWindowShell
      appId="communication"
      activeTab={activeTab}
      userRole={currentUser.role}
      userProfile={currentUser}
      customPermissions={customPermissions}
      onSelectTab={onSelectTab}
    >
      {(tabId) => (
        <>
          {tabId === 'announcements' && (
            <AnnouncementsView
              announcements={announcements}
              currentUser={currentUser}
              customPermissions={customPermissions}
              validationContext={validationContext}
              onCreateAnnouncement={onCreateAnnouncement}
              onUpdateAnnouncement={onUpdateAnnouncement}
              onUnifiedImportCommit={onUnifiedImportCommit}
              onLogExport={onLogExport}
            />
          )}

          {tabId === 'events' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-orange-500" />
                    Sự kiện & Hoạt động Ngoại khóa
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Đăng ký tham gia hội thảo, cuộc thi học thuật, thể thao và phong trào Đoàn - Đội
                  </p>
                </div>

                {onUnifiedImportCommit ? (
                  <ModuleDataActions
                    moduleKey="events"
                    context={validationContext}
                    currentUser={currentUser}
                    allRecords={events as unknown as Record<string, unknown>[]}
                    canCreate={canCreate}
                    canImport={canCreate}
                    canExport={canCreate || events.length > 0}
                    createLabel="Tạo Sự kiện"
                    onManualSave={(entity) => onSaveEvent(entity as unknown as SchoolEvent)}
                    onCommitImport={(key, items, hist) => onUnifiedImportCommit(key, items, hist)}
                    onLogExport={onLogExport}
                  />
                ) : (
                  canCreate && (
                    <button
                      type="button"
                      onClick={() => setIsAddEventOpen(true)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Tạo Sự kiện Mới
                    </button>
                  )
                )}
              </div>

              {events.length === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  title="Chưa có sự kiện nào"
                  description="Tạo sự kiện học thuật, thể thao hoặc hoạt động ngoại khóa để hiển thị lên Desktop."
                  action={
                    canCreate ? (
                      <button
                        type="button"
                        onClick={() => setIsAddEventOpen(true)}
                        className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> Tạo sự kiện đầu tiên
                      </button>
                    ) : null
                  }
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {events.map((evt) => {
                    const regIds = evt.registeredUserIds || [];
                    const isRegistered = regIds.includes(currentUser.id);
                    const isFull = Boolean(evt.capacity && regIds.length >= evt.capacity);
                    return (
                      <LiquidCard key={evt.id} className="p-4 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="amber" size="sm">{evt.category}</Badge>
                          <Badge variant="mint" size="sm">
                            {evt.status === 'upcoming' ? 'Sắp diễn ra' : evt.status === 'ongoing' ? 'Đang diễn ra' : 'Đã kết thúc'}
                          </Badge>
                        </div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{evt.title}</h3>
                        <p className="text-xs text-slate-600 dark:text-slate-300">{evt.description}</p>
                        <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                          <div className="flex flex-wrap gap-3">
                            <span className="inline-flex items-center gap-1 font-mono-tabular">
                              <Clock className="w-3.5 h-3.5 text-orange-500" /> {evt.date} · {evt.time}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-sky-500" /> {evt.location}
                            </span>
                            <span className="inline-flex items-center gap-1 font-mono-tabular">
                              <Users className="w-3.5 h-3.5 text-emerald-500" /> {regIds.length}
                              {evt.capacity ? `/${evt.capacity}` : ''} ĐK
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {evt.status !== 'completed' && (
                              <button
                                type="button"
                                disabled={!isRegistered && isFull}
                                onClick={() => handleToggleEventRegister(evt)}
                                className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer disabled:opacity-40 ${
                                  isRegistered
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-sky-600 text-white'
                                }`}
                              >
                                {isRegistered ? 'Đã đăng ký' : isFull ? 'Đã đủ chỗ' : 'Đăng ký'}
                              </button>
                            )}
                            {canCreate && (
                              <button
                                type="button"
                                onClick={() => void handleExportEventRegistrations(evt)}
                                title="Xuất danh sách đăng ký"
                                className="p-1 rounded-lg text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-700 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </LiquidCard>
                    );
                  })}
                </div>
              )}

              <UnifiedManualFormModal
                isOpen={isAddEventOpen}
                moduleKey="events"
                context={validationContext}
                existingRecords={events as unknown as Record<string, unknown>[]}
                currentUser={currentUser}
                onClose={() => setIsAddEventOpen(false)}
                onSave={(entity) => {
                  onSaveEvent(entity as unknown as SchoolEvent);
                  setIsAddEventOpen(false);
                }}
              />
            </div>
          )}

          {tabId === 'calendar' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-sky-600" />
                    Lịch Hoạt động Tổng hợp
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Đồng bộ theo lịch tháng và dòng thời gian các sự kiện, thông báo quan trọng
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-white/70 dark:bg-slate-800/70 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setCalendarViewMode('month')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer ${
                      calendarViewMode === 'month' ? 'bg-sky-600 text-white' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" /> Lịch tháng
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarViewMode('list')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer ${
                      calendarViewMode === 'list' ? 'bg-sky-600 text-white' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" /> Danh sách
                  </button>
                </div>
              </div>

              {calendarViewMode === 'month' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <LiquidCard className="lg:col-span-8 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() =>
                          setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                        }
                        className="p-1.5 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 capitalize">
                        {calendarMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
                      </h3>
                      <button
                        type="button"
                        onClick={() =>
                          setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                        }
                        className="p-1.5 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400 pb-1">
                      {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
                        <div key={d}>{d}</div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                      {monthGridDays.map((cell, idx) => {
                        if (!cell) return <div key={`empty-${idx}`} className="h-14" />;
                        const dayItems = calendarItems.filter((i) => i.date === cell.dateStr);
                        const isSelected = selectedDayStr === cell.dateStr;
                        return (
                          <button
                            key={cell.dateStr}
                            type="button"
                            onClick={() => setSelectedDayStr(cell.dateStr)}
                            className={`h-14 p-1.5 rounded-xl border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-sky-500/15 border-sky-400 text-sky-700 dark:text-sky-300'
                                : 'bg-white/50 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/60 hover:bg-white/80'
                            }`}
                          >
                            <span className="text-xs font-mono-tabular font-bold">{cell.dayNum}</span>
                            {dayItems.length > 0 && (
                              <span className="text-[10px] font-semibold px-1 rounded bg-orange-500/15 text-orange-600 dark:text-orange-300 truncate">
                                {dayItems.length} hoạt động
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </LiquidCard>

                  <LiquidCard className="lg:col-span-4 p-4 space-y-3">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      Ngày {selectedDayStr}
                    </h3>
                    {selectedDayItems.length === 0 ? (
                      <p className="text-xs text-slate-400 py-6 text-center">
                        Không có sự kiện hay thông báo nào trong ngày này.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {selectedDayItems.map((item) => (
                          <div
                            key={item.id}
                            className="p-3 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 space-y-1 text-xs"
                          >
                            <Badge variant={item.kind === 'Sự kiện' ? 'amber' : 'blue'} size="sm">
                              {item.kind}
                            </Badge>
                            <p className="font-bold text-slate-800 dark:text-slate-100">{item.title}</p>
                            <p className="text-slate-500 dark:text-slate-400">{item.subtitle}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </LiquidCard>
                </div>
              ) : calendarItems.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="Lịch hoạt động đang trống"
                  description="Khi có sự kiện hoặc thông báo ghim quan trọng, lịch trình sẽ tự động hiển thị theo thứ tự ngày."
                />
              ) : (
                <div className="space-y-2.5">
                  {calendarItems.map((item) => (
                    <LiquidCard key={item.id} className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="px-3 py-1.5 rounded-xl bg-sky-500/12 text-sky-700 dark:text-sky-300 font-mono-tabular text-xs font-bold shrink-0">
                          {item.date}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{item.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>
                      <Badge variant={item.kind === 'Sự kiện' ? 'amber' : 'blue'} size="sm">
                        {item.kind}
                      </Badge>
                    </LiquidCard>
                  ))}
                </div>
              )}
            </div>
          )}

          {tabId === 'dispatch' && (
            <div className="max-w-3xl space-y-5">
              <div>
                <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Send className="w-5 h-5 text-orange-500" />
                  Soạn & Quản lý Phát hành Thông báo
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Lưu bản nháp, phát hành lên Desktop Widget hoặc thu hồi thông báo đã gửi
                </p>
              </div>

              <LiquidCard className="p-5">
                <form onSubmit={handleDispatch} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold mb-1">Tiêu đề thông báo *</label>
                    <input
                      type="text"
                      required
                      value={dispatchTitle}
                      onChange={(e) => setDispatchTitle(e.target.value)}
                      placeholder="VD: Lịch tập trung chuẩn bị Khai giảng"
                      className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">Chuyên mục</label>
                      <select
                        value={dispatchCategory}
                        onChange={(e) =>
                          setDispatchCategory(e.target.value as Announcement['category'])
                        }
                        className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                      >
                        {announcementCategoryOptions.map((opt) => (
                          <option key={opt.id} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Đối tượng nhận</label>
                      <select
                        value={dispatchAudience}
                        onChange={(e) =>
                          setDispatchAudience(e.target.value as Announcement['targetAudience'])
                        }
                        className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                      >
                        {announcementAudienceOptions.map((opt) => (
                          <option key={opt.id} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Mức độ ưu tiên</label>
                      <select
                        value={dispatchPriority}
                        onChange={(e) =>
                          setDispatchPriority(e.target.value as Announcement['priority'])
                        }
                        className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                      >
                        <option value="normal">Bình thường</option>
                        <option value="important">Quan trọng (Ghim)</option>
                        <option value="urgent">Khẩn cấp</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Chế độ gửi</label>
                      <select
                        value={dispatchStatus}
                        onChange={(e) => setDispatchStatus(e.target.value as 'published' | 'draft')}
                        className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                      >
                        <option value="published">Phát hành ngay</option>
                        <option value="draft">Lưu bản nháp</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Nội dung chi tiết *</label>
                    <textarea
                      rows={4}
                      required
                      value={dispatchContent}
                      onChange={(e) => setDispatchContent(e.target.value)}
                      className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  {dispatchSuccess && (
                    <div className="p-3 rounded-xl bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> {dispatchSuccess}
                    </div>
                  )}
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Bell className="w-4 h-4" /> {dispatchStatus === 'published' ? 'Phát hành ngay' : 'Lưu bản nháp'}
                  </button>
                </form>
              </LiquidCard>

              {canEdit && announcements.length > 0 && (
                <LiquidCard className="p-4 space-y-2.5 text-xs">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Quản lý trạng thái bản tin ({announcements.length})
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {announcements.slice(0, 8).map((ann) => {
                      const st = ann.status || 'published';
                      return (
                        <div
                          key={ann.id}
                          className="p-2.5 rounded-xl bg-white/60 dark:bg-slate-800/60 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{ann.title}</p>
                            <p className="text-[11px] text-slate-400">
                              {ann.targetAudience} · Đã đọc: {ann.readByIds?.length || 0}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant={st === 'published' ? 'mint' : st === 'draft' ? 'amber' : 'gray'} size="sm">
                              {st === 'published' ? 'Đã đăng' : st === 'draft' ? 'Nháp' : 'Đã thu hồi'}
                            </Badge>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateAnnouncement({
                                  ...ann,
                                  status: st === 'published' ? 'recalled' : 'published',
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-700 font-semibold cursor-pointer"
                            >
                              {st === 'published' ? 'Thu hồi' : 'Phát hành'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </LiquidCard>
              )}
            </div>
          )}
        </>
      )}
    </AppWindowShell>
  );
};
