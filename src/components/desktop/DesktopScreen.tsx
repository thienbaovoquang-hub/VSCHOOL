import React, { useState, useEffect, useMemo } from 'react';
import {
  Bell, Calendar, BookOpen, Users, Wrench, Sparkles, Lock,
  ArrowUpRight, Clock, ClipboardList
} from 'lucide-react';
import {
  Announcement,
  BorrowTransaction,
  Book,
  FacilityAsset,
  MaintenanceRequest,
  PermissionMatrix,
  SchoolClass,
  SchoolEvent,
  Student,
  SuperAppId,
  Survey,
  Teacher,
  TimetableEntry,
  UserProfile,
} from '../../types';
import { WindowState } from '../../types/window';
import { APP_REGISTRY, SUPER_APP_ORDER } from '../../data/appRegistry';
import { canAccessSuperApp, DEFAULT_PERMISSIONS, formatUserRolesLabel } from '../../utils/rbac';

interface DesktopScreenProps {
  currentUser: UserProfile;
  windows: Record<SuperAppId, WindowState>;
  activeWindowId: SuperAppId | null;
  students: Student[];
  teachers: Teacher[];
  classes: SchoolClass[];
  books: Book[];
  borrowTransactions: BorrowTransaction[];
  announcements: Announcement[];
  events: SchoolEvent[];
  surveys: Survey[];
  facilities: FacilityAsset[];
  maintenance: MaintenanceRequest[];
  timetable: TimetableEntry[];
  compactMode?: boolean;
  customPermissions?: PermissionMatrix;
  onOpenApp: (appId: SuperAppId, tabId?: string) => void;
  onContextMenuApp: (e: React.MouseEvent, appId: SuperAppId) => void;
}

export const DesktopScreen: React.FC<DesktopScreenProps> = ({
  currentUser,
  windows,
  activeWindowId,
  students,
  teachers,
  classes,
  books,
  borrowTransactions,
  announcements,
  events,
  surveys,
  facilities,
  maintenance,
  timetable,
  compactMode = false,
  customPermissions = DEFAULT_PERMISSIONS,
  onOpenApp,
  onContextMenuApp,
}) => {
  const [selectedAppId, setSelectedAppId] = useState<SuperAppId | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const hour = now.getHours();
  const greeting =
    hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

  const formattedDate = now.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const formattedTime = now.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const roleLabel = formatUserRolesLabel(currentUser);

  const visibleAnnouncements = useMemo(
    () =>
      announcements.filter(
        (a) =>
          !a.status ||
          a.status === 'published' ||
          (a.status === 'draft' && a.authorName === currentUser.displayName)
      ),
    [announcements, currentUser.displayName]
  );

  // Role-personalized 3 compact widgets (uniform size, minimal text, actionable)
  const quickWidgets = useMemo(() => {
    const activeLoans = borrowTransactions.filter((t) => t.status === 'borrowed' || t.status === 'overdue').length;
    const openMaintenance = maintenance.filter((m) => m.status !== 'completed').length;
    const activeSurveys = surveys.filter((s) => s.status === 'active').length;

    switch (currentUser.role) {
      case 'student':
        return [
          {
            label: 'Tiết học',
            value: timetable.length,
            sub: 'Thời khóa biểu',
            icon: Calendar,
            accent: 'text-violet-600 dark:text-violet-400 bg-violet-500/12',
            appId: 'learning' as SuperAppId,
            tabId: 'timetable',
          },
          {
            label: 'Sách đang mượn',
            value: activeLoans,
            sub: `${books.length} đầu sách`,
            icon: BookOpen,
            accent: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/12',
            appId: 'library' as SuperAppId,
            tabId: 'catalog',
          },
          {
            label: 'Khảo sát mở',
            value: activeSurveys,
            sub: `${visibleAnnouncements.length} thông báo`,
            icon: ClipboardList,
            accent: 'text-pink-600 dark:text-pink-400 bg-pink-500/12',
            appId: 'services' as SuperAppId,
            tabId: 'surveys',
          },
        ];
      case 'librarian':
        return [
          {
            label: 'Đầu sách',
            value: books.length,
            sub: 'Danh mục thư viện',
            icon: BookOpen,
            accent: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/12',
            appId: 'library' as SuperAppId,
            tabId: 'catalog',
          },
          {
            label: 'Đang mượn',
            value: activeLoans,
            sub: 'RFID & Barcode',
            icon: Clock,
            accent: 'text-sky-600 dark:text-sky-400 bg-sky-500/12',
            appId: 'library' as SuperAppId,
            tabId: 'circulation',
          },
          {
            label: 'Thông báo',
            value: visibleAnnouncements.length,
            sub: 'Bản tin trường',
            icon: Bell,
            accent: 'text-orange-600 dark:text-orange-400 bg-orange-500/12',
            appId: 'communication' as SuperAppId,
            tabId: 'announcements',
          },
        ];
      case 'staff':
        return [
          {
            label: 'Thiết bị',
            value: facilities.length,
            sub: 'Tài sản trường',
            icon: Wrench,
            accent: 'text-teal-600 dark:text-teal-400 bg-teal-500/12',
            appId: 'facilities' as SuperAppId,
            tabId: 'equipment',
          },
          {
            label: 'Cần bảo trì',
            value: openMaintenance,
            sub: 'Báo hỏng & sửa chữa',
            icon: Wrench,
            accent: 'text-amber-600 dark:text-amber-400 bg-amber-500/12',
            appId: 'facilities' as SuperAppId,
            tabId: 'maintenance',
          },
          {
            label: 'Thông báo',
            value: visibleAnnouncements.length,
            sub: 'Truyền thông',
            icon: Bell,
            accent: 'text-orange-600 dark:text-orange-400 bg-orange-500/12',
            appId: 'communication' as SuperAppId,
            tabId: 'announcements',
          },
        ];
      case 'admin':
        return [
          {
            label: 'Học sinh',
            value: students.length,
            sub: `${classes.length} lớp · ${teachers.length} GV`,
            icon: Users,
            accent: 'text-sky-600 dark:text-sky-400 bg-sky-500/12',
            appId: 'school' as SuperAppId,
            tabId: 'students-classes',
          },
          {
            label: 'Khảo sát mở',
            value: activeSurveys,
            sub: `${openMaintenance} phiếu bảo trì`,
            icon: ClipboardList,
            accent: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/12',
            appId: 'services' as SuperAppId,
            tabId: 'surveys',
          },
          {
            label: 'Thư viện',
            value: books.length,
            sub: `${activeLoans} lượt đang mượn`,
            icon: BookOpen,
            accent: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/12',
            appId: 'library' as SuperAppId,
            tabId: 'catalog',
          },
        ];
      default:
        return [
          {
            label: 'Học sinh',
            value: students.length,
            sub: `${classes.length} lớp học`,
            icon: Users,
            accent: 'text-sky-600 dark:text-sky-400 bg-sky-500/12',
            appId: 'school' as SuperAppId,
            tabId: 'students-classes',
          },
          {
            label: 'Lịch dạy & học',
            value: timetable.length,
            sub: 'Thời khóa biểu',
            icon: Calendar,
            accent: 'text-violet-600 dark:text-violet-400 bg-violet-500/12',
            appId: 'learning' as SuperAppId,
            tabId: 'timetable',
          },
          {
            label: 'Thông báo',
            value: visibleAnnouncements.length,
            sub: `${events.length} sự kiện`,
            icon: Bell,
            accent: 'text-orange-600 dark:text-orange-400 bg-orange-500/12',
            appId: 'communication' as SuperAppId,
            tabId: 'announcements',
          },
        ];
    }
  }, [
    currentUser.role,
    students.length,
    classes.length,
    teachers.length,
    books.length,
    borrowTransactions,
    visibleAnnouncements.length,
    events.length,
    surveys,
    facilities.length,
    maintenance,
    timetable.length,
  ]);

  const recentAnnouncements = visibleAnnouncements.slice(0, 3);
  const recentEvents = events.slice(0, 3);

  return (
    <div
      data-testid="desktop-screen"
      onClick={() => setSelectedAppId(null)}
      className="h-full w-full overflow-y-auto md:overflow-hidden px-4 py-3 sm:px-6 lg:px-8 lg:py-5 flex items-center justify-center select-none"
    >
      <div className="w-full max-w-[1440px] h-full min-h-0 grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-6 items-center">
        {/* LEFT HALF (50% width): EXPANDED 8 DESKTOP APP GRID */}
        <section
          aria-label="Ứng dụng Desktop"
          data-testid="desktop-grid"
          className="md:col-span-6 h-full min-h-0 flex flex-col justify-center"
        >
          <div className="liquid-glass-panel rounded-3xl p-5 lg:p-7 w-full md:h-[516px] lg:h-[524px] max-h-full flex flex-col justify-between">
            <div className="flex items-center justify-between px-1 mb-3 shrink-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Ứng dụng SchoolHub (8)
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden lg:inline">
                Nhấp để mở ứng dụng
              </span>
            </div>

            <div className={`flex-1 min-h-0 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-4 content-center ${compactMode ? 'gap-2.5 lg:gap-3.5' : 'gap-3 lg:gap-4'}`}>
              {SUPER_APP_ORDER.map((appId) => {
                const meta = APP_REGISTRY[appId];
                const IconComp = meta.icon;
                const win = windows[appId];
                const isSelected = selectedAppId === appId;
                const isRunning = Boolean(win?.isOpen);
                const isFocused = activeWindowId === appId && !win?.isMinimized;
                const allowed = canAccessSuperApp(currentUser, appId, customPermissions);

                return (
                  <button
                    key={appId}
                    type="button"
                    data-testid={`desktop-app-${appId}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAppId(appId);
                      onOpenApp(appId);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenApp(appId);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedAppId(appId);
                      onContextMenuApp(e, appId);
                    }}
                    title={`${meta.title} — ${meta.subtitle}`}
                    className={`group relative flex flex-col items-center justify-center rounded-2xl px-2.5 ${
                      compactMode ? 'py-3 lg:py-4' : 'py-4 lg:py-6'
                    } transition-all cursor-pointer focus:outline-none ${
                      isSelected
                        ? 'bg-white/85 dark:bg-slate-800/85 ring-2 ring-sky-400/70 shadow-sm'
                        : 'bg-white/25 dark:bg-slate-800/25 hover:bg-white/65 dark:hover:bg-slate-800/60 border border-white/40 dark:border-slate-700/40'
                    } ${!allowed ? 'opacity-60' : ''}`}
                  >
                    <div className="relative">
                      <IconComp
                        className={`${
                          compactMode
                            ? 'w-12 h-12 lg:w-14 lg:h-14'
                            : 'w-14 h-14 lg:w-16 lg:h-16 xl:w-[70px] xl:h-[70px]'
                        } drop-shadow-sm transition-transform duration-200 group-hover:scale-105 group-hover:-translate-y-0.5`}
                      />
                      {!allowed && (
                        <span
                          aria-label="Hạn chế theo vai trò"
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-800/85 text-white flex items-center justify-center shadow"
                        >
                          <Lock className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>

                    <span className="mt-2.5 text-xs lg:text-[13px] font-semibold text-slate-800 dark:text-slate-100 text-center leading-tight line-clamp-2 min-h-[32px] flex items-center">
                      {meta.title}
                    </span>

                    <span className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500 hidden xl:block truncate max-w-full">
                      {meta.tabs.length} tính năng
                    </span>

                    {/* Running Indicator */}
                    <span
                      className={`mt-1.5 h-1 rounded-full transition-all ${
                        isFocused
                          ? 'w-5 bg-sky-500'
                          : isRunning
                          ? 'w-2 bg-slate-400 dark:bg-slate-500'
                          : 'w-0 bg-transparent'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* RIGHT HALF (50% width): NARROWED WELCOME BANNER + COMPACT WIDGETS + RECENT INFO */}
        <section
          aria-label="Thông tin tổng quan"
          className="md:col-span-6 h-full min-h-0 flex flex-col justify-center gap-3 lg:gap-4"
        >
          {/* 1. Compact Welcome Banner */}
          <div className="relative overflow-hidden rounded-3xl p-5 lg:px-6 lg:py-5 h-[116px] lg:h-[132px] shrink-0 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white shadow-lg flex items-center justify-between">
            {/* Abstract Glass Orbs */}
            <div className="pointer-events-none absolute -right-10 -top-12 w-52 h-52 rounded-full bg-white/15 blur-xl" />
            <div className="pointer-events-none absolute right-16 -bottom-16 w-40 h-40 rounded-full bg-cyan-300/20 blur-lg" />

            <div className="relative z-10 min-w-0 pr-3">
              <div className="flex items-center gap-2 text-xs text-sky-100 font-medium truncate">
                <span>{greeting}</span>
                <span>·</span>
                <span className="truncate">{roleLabel}</span>
              </div>
              <h1 className="text-lg lg:text-2xl font-extrabold tracking-tight truncate mt-0.5">
                {currentUser.displayName}
              </h1>
              <p className="text-xs text-sky-100/90 mt-1 capitalize truncate">
                {formattedDate}
              </p>
            </div>

            <div className="relative z-10 flex flex-col items-end shrink-0">
              <span className="font-mono-tabular text-2xl lg:text-3xl font-bold tracking-tight">
                {formattedTime}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenApp('analytics', 'ai-assistant');
                }}
                className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/18 hover:bg-white/28 border border-white/25 text-[11px] font-semibold transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                <span>Trợ lý AI</span>
              </button>
            </div>
          </div>

          {/* 2. 3 Compact Uniform Quick Widgets */}
          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3 gap-3 shrink-0">
            {quickWidgets.map((w) => {
              const WIcon = w.icon;
              return (
                <button
                  key={w.label}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenApp(w.appId, w.tabId);
                  }}
                  className="liquid-glass-panel rounded-2xl px-3.5 py-3 h-[84px] lg:h-[92px] flex items-center justify-between text-left hover:-translate-y-0.5 transition-transform cursor-pointer group"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                      {w.label}
                    </p>
                    <p className="font-mono-tabular text-xl lg:text-2xl font-extrabold text-slate-800 dark:text-white leading-tight mt-0.5">
                      {w.value}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                      {w.sub}
                    </p>
                  </div>
                  <div className={`w-9 h-9 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center shrink-0 ${w.accent} group-hover:scale-105 transition-transform`}>
                    <WIcon className="w-4 h-4 lg:w-5 lg:h-5" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* 3. Compact Recent Information Area (2 columns on lg+, no overflow) */}
          <div className="liquid-glass-panel rounded-3xl p-4 lg:p-5 flex-1 min-h-0 max-h-[268px] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
            {/* Left: Announcements */}
            <div className="flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2.5 shrink-0">
                <h2 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-orange-500" />
                  <span>Thông báo mới</span>
                </h2>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenApp('communication', 'announcements');
                  }}
                  className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                >
                  <span>Mở</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>

              <div className="flex-1 min-h-0 space-y-2 overflow-hidden">
                {recentAnnouncements.length === 0 ? (
                  <div className="h-full rounded-2xl border border-dashed border-slate-300/70 dark:border-slate-700 flex flex-col items-center justify-center text-center p-3">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Chưa có thông báo
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      Mở Truyền thông để đăng tin mới
                    </p>
                  </div>
                ) : (
                  recentAnnouncements.map((ann) => (
                    <button
                      key={ann.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenApp('communication', 'announcements');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl bg-white/60 dark:bg-slate-800/60 hover:bg-white/90 dark:hover:bg-slate-800 border border-white/70 dark:border-slate-700/60 transition-colors cursor-pointer"
                    >
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {ann.title}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        {ann.category} · {ann.publishedAt}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Right: Upcoming Events & Activity */}
            <div className="flex flex-col min-h-0 sm:border-l sm:border-slate-200/60 dark:sm:border-slate-700/60 sm:pl-4">
              <div className="flex items-center justify-between mb-2.5 shrink-0">
                <h2 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-sky-500" />
                  <span>Sự kiện & Hoạt động</span>
                </h2>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenApp('communication', 'events');
                  }}
                  className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                >
                  <span>Mở</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>

              <div className="flex-1 min-h-0 space-y-2 overflow-hidden">
                {recentEvents.length === 0 ? (
                  <div className="h-full rounded-2xl border border-dashed border-slate-300/70 dark:border-slate-700 flex flex-col items-center justify-center text-center p-3">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Chưa có sự kiện sắp tới
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      Lịch hoạt động hiển thị tại đây
                    </p>
                  </div>
                ) : (
                  recentEvents.map((evt) => (
                    <button
                      key={evt.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenApp('communication', 'events');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl bg-white/60 dark:bg-slate-800/60 hover:bg-white/90 dark:hover:bg-slate-800 border border-white/70 dark:border-slate-700/60 transition-colors cursor-pointer"
                    >
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {evt.title}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        {evt.date} · {evt.location}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
