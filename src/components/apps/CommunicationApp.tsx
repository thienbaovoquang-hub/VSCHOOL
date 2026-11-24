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
              <div className="flex flex-wrap items-center justify-end gap-2">
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
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer transition-all"
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
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
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
                        <div className="pt-2 border-t border-white/35 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
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
                                className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer disabled:opacity-40 transition-colors ${
                                  isRegistered
                                    ? 'glass-subsurface bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-xs'
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
                                className="p-1.5 rounded-lg glass-subsurface text-slate-600 dark:text-slate-300 hover:bg-white/75 dark:hover:bg-white/10 cursor-pointer transition-colors"
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
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="glass-pill-tray flex items-center gap-1 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setCalendarViewMode('month')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-all ${
                      calendarViewMode === 'month' ? 'glass-pill-tab-active' : 'glass-pill-tab'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" /> Lịch tháng
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarViewMode('list')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-all ${
                      calendarViewMode === 'list' ? 'glass-pill-tab-active' : 'glass-pill-tab'
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
                        className="p-1.5 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-white/10 cursor-pointer transition-colors"
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
                        className="p-1.5 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-white/10 cursor-pointer transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-500 dark:text-slate-400 pb-1">
                      {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
                        <div key={d}>{d}</div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1.5">
                      {monthGridDays.map((cell, idx) => {
                        if (!cell) return <div key={`empty-${idx}`} className="h-14" />;
                        const dayItems = calendarItems.filter((i) => i.date === cell.dateStr);
                        const isSelected = selectedDayStr === cell.dateStr;
                        return (
                          <button
                            key={cell.dateStr}
                            type="button"
                            onClick={() => setSelectedDayStr(cell.dateStr)}
                            className={`h-14 p-1.5 rounded-xl text-left flex flex-col justify-between transition-all cursor-pointer ${
                              isSelected
                                ? 'glass-subsurface bg-sky-500/20 border-sky-400/70 text-sky-800 dark:text-sky-200 ring-1 ring-sky-400/40'
                                : 'glass-subsurface hover:bg-white/70 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <span className="text-xs font-mono-tabular font-bold">{cell.dayNum}</span>
                            {dayItems.length > 0 && (
                              <span className="text-[10px] font-semibold px-1.5 rounded bg-orange-500/18 text-orange-700 dark:text-orange-300 truncate">
                                {dayItems.length} hoạt động
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </LiquidCard>

                  <LiquidCard className="lg:col-span-4 p-4 space-y-3">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono-tabular">
                      Ngày {selectedDayStr}
                    </h3>
                    {selectedDayItems.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
                        Không có sự kiện hay thông báo nào trong ngày này.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {selectedDayItems.map((item) => (
                          <div
                            key={item.id}
                            className="p-3 rounded-xl glass-subsurface space-y-1 text-xs"
                          >
                            <Badge variant={item.kind === 'Sự kiện' ? 'amber' : 'blue'} size="sm">
                              {item.kind}
                            </Badge>
                            <p className="font-bold text-slate-800 dark:text-slate-100">{item.title}</p>
                            <p className="text-slate-600 dark:text-slate-300">{item.subtitle}</p>
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
                        <div className="px-3 py-1.5 rounded-xl glass-subsurface bg-sky-500/12 text-sky-700 dark:text-sky-300 font-mono-tabular text-xs font-bold shrink-0">
                          {item.date}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{item.title}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
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
              <LiquidCard className="p-5">
                <form onSubmit={handleDispatch} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Tiêu đề thông báo *</label>
                    <input
                      type="text"
                      required
                      value={dispatchTitle}
                      onChange={(e) => setDispatchTitle(e.target.value)}
                      placeholder="VD: Lịch tập trung chuẩn bị Khai giảng"
                      className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/40"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Chuyên mục</label>
                      <select
                        value={dispatchCategory}
                        onChange={(e) =>
                          setDispatchCategory(e.target.value as Announcement['category'])
                        }
                        className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none"
                      >
                        {announcementCategoryOptions.map((opt) => (
                          <option key={opt.id} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Đối tượng nhận</label>
                      <select
                        value={dispatchAudience}
                        onChange={(e) =>
                          setDispatchAudience(e.target.value as Announcement['targetAudience'])
                        }
                        className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none"
                      >
                        {announcementAudienceOptions.map((opt) => (
                          <option key={opt.id} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Mức độ ưu tiên</label>
                      <select
                        value={dispatchPriority}
                        onChange={(e) =>
                          setDispatchPriority(e.target.value as Announcement['priority'])
                        }
                        className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none"
                      >
                        <option value="normal">Bình thường</option>
                        <option value="important">Quan trọng (Ghim)</option>
                        <option value="urgent">Khẩn cấp</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Chế độ gửi</label>
                      <select
                        value={dispatchStatus}
                        onChange={(e) => setDispatchStatus(e.target.value as 'published' | 'draft')}
                        className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none"
                      >
                        <option value="published">Phát hành ngay</option>
                        <option value="draft">Lưu bản nháp</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Nội dung chi tiết *</label>
                    <textarea
                      rows={4}
                      required
                      value={dispatchContent}
                      onChange={(e) => setDispatchContent(e.target.value)}
                      className="w-full glass-subsurface rounded-xl p-3 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-orange-500/40"
                    />
                  </div>
                  {dispatchSuccess && (
                    <div className="p-3 rounded-xl glass-subsurface bg-emerald-500/12 border-emerald-400/35 text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> {dispatchSuccess}
                    </div>
                  )}
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white font-bold shadow-sm inline-flex items-center gap-1.5 cursor-pointer transition-all"
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
                          className="p-2.5 rounded-xl glass-subsurface flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{ann.title}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
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
                              className="px-2.5 py-1 rounded-lg glass-subsurface hover:bg-white/75 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer transition-colors"
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
