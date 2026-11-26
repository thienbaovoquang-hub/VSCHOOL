import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Bell,
  Calendar,
  Lock,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  History,
  Image as ImageIcon,
  Pause,
  Play,
  Send,
  Mail,
  Phone,
  MapPin,
} from '../icons/UiIcons';
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
  SystemSettings,
  Teacher,
  TimetableEntry,
  UserProfile,
} from '../../types';
import { WindowState } from '../../types/window';
import { APP_REGISTRY, SUPER_APP_ORDER } from '../../data/appRegistry';
import { canAccessSuperApp, DEFAULT_PERMISSIONS } from '../../utils/rbac';
import { resolveSlideshowConfig } from '../../utils/slideshowDefaults';
import { resolveSystemBranding } from '../../utils/branding';
import { resolveSystemFooter } from '../../utils/footerConfig';
import { SystemBrandMark } from '../common/SystemBrandMark';

export interface RecentAppEntry {
  appId: SuperAppId;
  openedAt: string;
}

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
  systemSettings?: SystemSettings;
  recentApps?: RecentAppEntry[];
  onOpenStartMenu?: () => void;
  onOpenApp: (appId: SuperAppId, tabId?: string) => void;
}

function formatRelativeTimeVi(isoString: string, nowMs: number): string {
  const ts = new Date(isoString).getTime();
  if (!Number.isFinite(ts)) return 'vừa xong';
  const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000));
  if (diffSec < 45) return 'vừa xong';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  return new Date(ts).toLocaleDateString('vi-VN');
}

export const DesktopScreen: React.FC<DesktopScreenProps> = ({
  currentUser,
  windows,
  announcements,
  events,
  compactMode = false,
  customPermissions = DEFAULT_PERMISSIONS,
  systemSettings,
  recentApps = [],
  onOpenStartMenu,
  onOpenApp,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const launcherSectionRef = useRef<HTMLElement | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [slideIndex, setSlideIndex] = useState(0);
  const [isSlideshowHovered, setIsSlideshowHovered] = useState(false);
  const [isSlideshowPaused, setIsSlideshowPaused] = useState(false);

  const slideshow = useMemo(() => resolveSlideshowConfig(systemSettings), [systemSettings]);
  const slides = slideshow.images;
  const safeSlideIndex = slides.length > 0 ? slideIndex % slides.length : 0;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (slideIndex >= slides.length && slides.length > 0) {
      setSlideIndex(0);
    }
  }, [slideIndex, slides.length]);

  useEffect(() => {
    if (!slideshow.autoPlay || isSlideshowPaused || isSlideshowHovered || slides.length <= 1) {
      return;
    }
    const intervalMs = slideshow.intervalSeconds * 1000;
    const timer = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % slides.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [slideshow.autoPlay, slideshow.intervalSeconds, isSlideshowPaused, isSlideshowHovered, slides.length]);

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

  const branding = useMemo(() => resolveSystemBranding(systemSettings), [systemSettings]);
  const footerConfig = useMemo(() => resolveSystemFooter(systemSettings), [systemSettings]);
  const schoolName = systemSettings?.schoolName || `Trường THPT ${branding.appName}`;
  const academicYear = systemSettings?.academicYear || '2026 - 2027';
  const canManageSlideshow = currentUser.role === 'admin' || currentUser.role === 'principal';

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

  const recentAnnouncements = visibleAnnouncements.slice(0, 3);
  const recentEvents = events.slice(0, 2);

  const effectiveRecentApps = useMemo(() => {
    if (recentApps.length > 0) return recentApps.slice(0, 3);
    const openFallback: RecentAppEntry[] = SUPER_APP_ORDER.filter((id) => windows[id]?.isOpen)
      .slice(0, 3)
      .map((appId) => ({ appId, openedAt: now.toISOString() }));
    return openFallback;
  }, [recentApps, windows, now]);

  const primaryRecent = effectiveRecentApps[0] || null;
  const secondaryRecent = effectiveRecentApps.slice(1, 3);
  const activeSlide = slides[safeSlideIndex] || slides[0];

  const handlePrevSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (slides.length <= 1) return;
    setSlideIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleNextSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (slides.length <= 1) return;
    setSlideIndex((prev) => (prev + 1) % slides.length);
  };

  const scrollToHomepageTop = (e: React.MouseEvent) => {
    e.stopPropagation();
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuickLinksApps = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenStartMenu) {
      onOpenStartMenu();
      return;
    }
    launcherSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const effectiveFooterLogo = footerConfig.logoUrl || branding.logoUrl || null;

  return (
    <div
      ref={scrollContainerRef}
      data-testid="desktop-screen"
      className="h-full w-full overflow-y-auto select-none"
    >
      <div className="min-h-full px-4 pt-20 pb-8 sm:px-6 lg:px-8 sm:pt-24 lg:pb-12">
        <div className="w-full max-w-[1380px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
          {/* LEFT COLUMN (7/12): 10-APP CRYSTAL MATRIX + RECENT ACTIVITY */}
          <div className="lg:col-span-7 flex flex-col gap-4 lg:gap-5 min-w-0">
            {/* 10 Super Apps Unified Compact Glass Launcher */}
            <section
              ref={launcherSectionRef}
              aria-label="Ứng dụng của bạn"
              data-testid="desktop-grid"
              className="rounded-[24px] liquid-glass-panel p-4 sm:p-5"
            >
              <div
                className={`grid grid-cols-3 sm:grid-cols-5 ${
                  compactMode ? 'gap-1' : 'gap-1.5 sm:gap-2'
                }`}
              >
                {SUPER_APP_ORDER.map((appId) => {
                  const meta = APP_REGISTRY[appId];
                  const IconComp = meta.icon;
                  const allowed = canAccessSuperApp(currentUser, appId, customPermissions);

                  return (
                    <button
                      key={appId}
                      type="button"
                      data-testid={`desktop-app-${appId}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenApp(appId);
                      }}
                      title={`${meta.title} — ${meta.subtitle}`}
                      className={`group flex flex-col items-center justify-start rounded-2xl px-1.5 ${
                        compactMode ? 'py-1.5' : 'py-2 sm:py-2.5'
                      } min-h-[44px] hover:bg-white/25 dark:hover:bg-white/10 transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                        !allowed ? 'opacity-55' : ''
                      }`}
                    >
                      <div className="relative">
                        <IconComp
                          className={`${
                            compactMode
                              ? 'w-10 h-10 sm:w-11 sm:h-11'
                              : 'w-12 h-12 sm:w-14 sm:h-14'
                          } transition-transform duration-150 group-hover:scale-105`}
                        />
                        {!allowed && (
                          <span
                            aria-label="Hạn chế theo vai trò"
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-900/85 backdrop-blur-sm text-white flex items-center justify-center shadow"
                          >
                            <Lock className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>

                      <span className="mt-1.5 text-[11px] sm:text-xs font-semibold text-slate-800 dark:text-slate-100 text-center leading-tight line-clamp-2">
                        {meta.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Recent Activity Glass Bar */}
            <section
              aria-label="Hoạt động gần đây"
              className="rounded-[24px] liquid-glass-panel p-4 sm:px-5 sm:py-4"
            >
              <div className="flex items-center justify-between mb-3 gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl ui-icon-chip flex items-center justify-center">
                    <History className="w-4 h-4" />
                  </div>
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Hoạt động gần đây
                  </h2>
                </div>
                {secondaryRecent.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {secondaryRecent.map((entry) => {
                      const meta = APP_REGISTRY[entry.appId];
                      return (
                        <button
                          key={entry.appId}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenApp(entry.appId);
                          }}
                          className="px-2.5 py-1 rounded-xl glass-subsurface hover:bg-white/35 dark:hover:bg-slate-800/65 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {meta.shortTitle}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {primaryRecent ? (
                (() => {
                  const meta = APP_REGISTRY[primaryRecent.appId];
                  const RecentIcon = meta.icon;
                  return (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenApp(primaryRecent.appId);
                      }}
                      className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl glass-subsurface hover:bg-white/32 dark:hover:bg-slate-800/55 transition-colors text-left cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <RecentIcon className="w-10 h-10 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-200 truncate">
                            Tiếp tục làm việc với{' '}
                            <span className="font-bold text-slate-900 dark:text-white">
                              {meta.title}
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {formatRelativeTimeVi(primaryRecent.openedAt, now.getTime())}
                          </p>
                        </div>
                      </div>
                      <span className="w-8 h-8 rounded-xl ui-icon-chip flex items-center justify-center shrink-0 group-hover:translate-x-0.5 transition-transform">
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    </button>
                  );
                })()
              ) : (
                <p className="py-2 text-xs text-slate-600 dark:text-slate-300">
                  Chọn một ứng dụng phía trên để bắt đầu làm việc — các ứng dụng mở gần đây sẽ hiển thị tại đây.
                </p>
              )}
            </section>
          </div>

          {/* RIGHT COLUMN (5/12): GLASS SLIDESHOW + NOTIFICATIONS + ACTIVITIES */}
          <div className="lg:col-span-5 flex flex-col gap-4 lg:gap-5 min-w-0">
            {/* School Showcase Glass Frame */}
            <section
              aria-label="Giới thiệu nhà trường"
              data-testid="school-slideshow"
              onMouseEnter={() => setIsSlideshowHovered(true)}
              onMouseLeave={() => setIsSlideshowHovered(false)}
              className="relative overflow-hidden rounded-[28px] liquid-glass-panel h-[248px] sm:h-[274px] lg:h-[288px] group"
            >
              {slides.map((slide, idx) => (
                <img
                  key={slide.id}
                  src={slide.url}
                  alt={slide.caption || schoolName}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${
                    idx === safeSlideIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                />
              ))}

              {/* Measured Flat Scrim for >=4.5:1 Contrast */}
              <div className="absolute inset-0 bg-slate-950/45 pointer-events-none" />

              {/* Top Glass HUD Strip */}
              <div className="relative z-10 flex items-start justify-between gap-3 p-4 sm:p-5 text-white">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-sky-100 tracking-wide">
                    Năm học {academicYear}
                  </p>
                  <h2 className="text-base sm:text-lg font-bold tracking-tight truncate drop-shadow-xs mt-0.5">
                    {schoolName}
                  </h2>
                </div>

                <div className="flex flex-col items-end shrink-0 text-right px-3 py-1.5 rounded-2xl bg-slate-950/40 backdrop-blur-sm border border-white/20">
                  <span className="font-mono-tabular text-lg sm:text-xl font-bold leading-none tracking-tight">
                    {formattedTime}
                  </span>
                  <span className="text-[10px] text-white/85 capitalize mt-1">
                    {formattedDate}
                  </span>
                </div>
              </div>

              {/* Bottom Caption & Controls */}
              <div className="absolute inset-x-0 bottom-0 z-10 p-4 sm:p-5 flex flex-col gap-3">
                <div className="flex items-end justify-between gap-3">
                  <p className="text-xs sm:text-[13px] font-medium text-white/95 line-clamp-2 leading-snug drop-shadow-xs min-w-0 flex-1">
                    {activeSlide?.caption || 'Học tốt · Sống đẹp · Tỏa sáng'}
                  </p>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {canManageSlideshow && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenApp('admin', 'settings');
                        }}
                        title="Quản lý ảnh slideshow trong Cài đặt"
                        className="h-7 px-2.5 rounded-full bg-white/20 hover:bg-white/35 backdrop-blur-sm border border-white/35 text-white text-[11px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <ImageIcon className="w-3 h-3" />
                        <span className="hidden sm:inline">Ảnh</span>
                      </button>
                    )}
                    {slides.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsSlideshowPaused((prev) => !prev);
                          }}
                          aria-label={isSlideshowPaused ? 'Tiếp tục trình chiếu' : 'Tạm dừng trình chiếu'}
                          title={isSlideshowPaused ? 'Tiếp tục' : 'Tạm dừng'}
                          className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/35 backdrop-blur-sm border border-white/35 text-white flex items-center justify-center transition-colors cursor-pointer"
                        >
                          {isSlideshowPaused || !slideshow.autoPlay ? (
                            <Play className="w-3 h-3" />
                          ) : (
                            <Pause className="w-3 h-3" />
                          )}
                        </button>
                        <button
                          type="button"
                          data-testid="slideshow-prev-btn"
                          onClick={handlePrevSlide}
                          aria-label="Ảnh trước"
                          className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/35 backdrop-blur-sm border border-white/35 text-white flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          data-testid="slideshow-next-btn"
                          onClick={handleNextSlide}
                          aria-label="Ảnh tiếp theo"
                          className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/35 backdrop-blur-sm border border-white/35 text-white flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {slides.length > 1 && (
                  <div className="flex items-center justify-center gap-1.5" role="tablist" aria-label="Chọn ảnh giới thiệu">
                    {slides.map((slide, idx) => (
                      <button
                        key={slide.id}
                        type="button"
                        role="tab"
                        aria-selected={idx === safeSlideIndex}
                        aria-label={`Ảnh ${idx + 1}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSlideIndex(idx);
                        }}
                        className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                          idx === safeSlideIndex
                            ? 'w-6 bg-white shadow-xs'
                            : 'w-1.5 bg-white/45 hover:bg-white/75'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Announcements Glass Feed (Clean Hairline Rows, Zero Inner Boxes) */}
            <section
              aria-label="Thông báo mới"
              className="rounded-[24px] liquid-glass-panel p-4 sm:p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl ui-icon-chip flex items-center justify-center">
                    <Bell className="w-4 h-4" />
                  </div>
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Thông báo
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenApp('communication', 'announcements');
                  }}
                  className="text-xs font-semibold text-sky-700 dark:text-sky-300 hover:text-indigo-700 dark:hover:text-white inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>Xem tất cả</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {recentAnnouncements.length === 0 ? (
                <p className="py-4 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                  Chưa có thông báo mới
                </p>
              ) : (
                <div className="divide-y divide-slate-900/8 dark:divide-white/10">
                  {recentAnnouncements.map((ann) => (
                    <button
                      key={ann.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenApp('communication', 'announcements');
                      }}
                      className="w-full text-left py-2.5 first:pt-1 last:pb-1 hover:bg-white/35 dark:hover:bg-white/5 px-2 -mx-2 rounded-xl transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-sky-700 dark:text-sky-300 truncate">
                          {ann.category || ann.authorName || 'Nhà trường'}
                        </span>
                        <span className="shrink-0 tabular-nums">{ann.publishedAt}</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate mt-0.5 group-hover:text-sky-700 dark:group-hover:text-sky-300 transition-colors">
                        {ann.title}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* School Activities / Events Glass Feed */}
            <section
              aria-label="Hoạt động nhà trường"
              className="rounded-[24px] liquid-glass-panel p-4 sm:p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl ui-icon-chip flex items-center justify-center">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Hoạt động &amp; Sự kiện
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenApp('communication', 'events');
                  }}
                  className="text-xs font-semibold text-sky-700 dark:text-sky-300 hover:text-indigo-700 dark:hover:text-white inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>Xem tất cả</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {recentEvents.length === 0 ? (
                <div className="flex items-center justify-between gap-3 py-2">
                  <p className="text-xs sm:text-[13px] italic text-slate-700 dark:text-sky-200 leading-relaxed">
                    “Tri thức là chìa khóa mở ra cánh cửa tương lai.”
                  </p>
                  <Send className="w-4 h-4 text-sky-600 dark:text-sky-300 shrink-0" />
                </div>
              ) : (
                <div className="divide-y divide-slate-900/8 dark:divide-white/10">
                  {recentEvents.map((evt) => (
                    <button
                      key={evt.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenApp('communication', 'events');
                      }}
                      className="w-full text-left py-2.5 first:pt-1 last:pb-1 hover:bg-white/35 dark:hover:bg-white/5 px-2 -mx-2 rounded-xl transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate group-hover:text-sky-700 dark:group-hover:text-sky-300 transition-colors">
                          {evt.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 tabular-nums">
                          {evt.date} · {evt.location}
                        </p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* Translucent Frosted Glass Footer */}
      {footerConfig.visible && (
        <footer
          data-testid="homepage-footer"
          aria-label="Thông tin chân trang"
          className="w-full bg-white/55 dark:bg-slate-900/62 backdrop-blur-sm border-t border-white/55 dark:border-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
        >
          <div className="w-full max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-10">
              <div className="md:col-span-5 space-y-3 min-w-0">
                <SystemBrandMark
                  branding={{
                    appName: footerConfig.title,
                    logoUrl: effectiveFooterLogo,
                  }}
                  size="header"
                />
                {footerConfig.description && (
                  <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed max-w-md">
                    {footerConfig.description}
                  </p>
                )}
              </div>

              <div className="md:col-span-3 space-y-3">
                <h3 className="text-[13px] font-bold text-slate-900 dark:text-white">
                  Liên kết nhanh
                </h3>
                <ul className="space-y-2 text-xs sm:text-[13px] text-slate-600 dark:text-slate-300">
                  <li>
                    <button
                      type="button"
                      data-testid="footer-link-home"
                      onClick={scrollToHomepageTop}
                      className="hover:text-sky-700 dark:hover:text-sky-300 hover:underline underline-offset-4 transition-colors cursor-pointer text-left"
                    >
                      Trang chủ
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      data-testid="footer-link-apps"
                      onClick={handleQuickLinksApps}
                      className="hover:text-sky-700 dark:hover:text-sky-300 hover:underline underline-offset-4 transition-colors cursor-pointer text-left"
                    >
                      Ứng dụng
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      data-testid="footer-link-school"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenApp('school');
                      }}
                      className="hover:text-sky-700 dark:hover:text-sky-300 hover:underline underline-offset-4 transition-colors cursor-pointer text-left"
                    >
                      Thông tin nhà trường
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      data-testid="footer-link-communication"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenApp('communication', 'announcements');
                      }}
                      className="hover:text-sky-700 dark:hover:text-sky-300 hover:underline underline-offset-4 transition-colors cursor-pointer text-left"
                    >
                      Thông báo &amp; Sự kiện
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      data-testid="footer-link-schedule"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenApp('learning', 'timetable');
                      }}
                      className="hover:text-sky-700 dark:hover:text-sky-300 hover:underline underline-offset-4 transition-colors cursor-pointer text-left"
                    >
                      Lịch học &amp; Thời khóa biểu
                    </button>
                  </li>
                </ul>
              </div>

              <div className="md:col-span-4 space-y-3 min-w-0">
                <h3 className="text-[13px] font-bold text-slate-900 dark:text-white">
                  Liên hệ &amp; Kết nối
                </h3>

                <div className="space-y-2 text-xs sm:text-[13px] text-slate-600 dark:text-slate-300">
                  {footerConfig.contactEmail && (
                    <a
                      href={`mailto:${footerConfig.contactEmail}`}
                      onClick={(e) => e.stopPropagation()}
                      data-testid="footer-contact-email"
                      className="flex items-center gap-2 hover:text-sky-700 dark:hover:text-sky-300 transition-colors min-w-0"
                    >
                      <Mail className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                      <span className="truncate">{footerConfig.contactEmail}</span>
                    </a>
                  )}

                  {footerConfig.contactPhone && (
                    <a
                      href={`tel:${footerConfig.contactPhone.replace(/[^+\d]/g, '')}`}
                      onClick={(e) => e.stopPropagation()}
                      data-testid="footer-contact-phone"
                      className="flex items-center gap-2 hover:text-sky-700 dark:hover:text-sky-300 transition-colors tabular-nums"
                    >
                      <Phone className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                      <span>{footerConfig.contactPhone}</span>
                    </a>
                  )}

                  {footerConfig.contactAddress && (
                    <p
                      data-testid="footer-contact-address"
                      className="flex items-start gap-2 text-slate-600 dark:text-slate-400"
                    >
                      <MapPin className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
                      <span>{footerConfig.contactAddress}</span>
                    </p>
                  )}
                </div>

                {(footerConfig.facebookUrl || footerConfig.instagramUrl) && (
                  <div className="pt-1 flex flex-wrap items-center gap-2">
                    {footerConfig.facebookUrl && (
                      <a
                        href={footerConfig.facebookUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Facebook"
                        data-testid="footer-social-facebook"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-slate-800/75 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-sky-400 transition-colors"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400 shrink-0" aria-hidden="true">
                          <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.3-.1-2.2 0-3.8 1.4-3.8 3.9v2.3H8v3h2.4V21h3.1z" />
                        </svg>
                        <span>Facebook</span>
                      </a>
                    )}
                    {footerConfig.instagramUrl && (
                      <a
                        href={footerConfig.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Instagram"
                        data-testid="footer-social-instagram"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-slate-800/75 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-rose-500 dark:hover:text-pink-400 transition-colors"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-rose-500 dark:text-pink-400 shrink-0" aria-hidden="true">
                          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                        </svg>
                        <span>Instagram</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {(footerConfig.copyright || footerConfig.ownershipStatement) && (
              <div className="mt-7 pt-5 border-t border-slate-900/10 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400 text-center sm:text-left">
                <span>{footerConfig.copyright}</span>
                {footerConfig.ownershipStatement && (
                  <span>{footerConfig.ownershipStatement}</span>
                )}
              </div>
            )}
          </div>
        </footer>
      )}
    </div>
  );
};
