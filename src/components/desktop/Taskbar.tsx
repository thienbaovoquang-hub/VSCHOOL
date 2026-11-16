import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Bell, SlidersHorizontal, Layers, X, Minus, ExternalLink, Cloud, CloudOff, RefreshCw, AlertTriangle
} from 'lucide-react';
import { SuperAppId, SyncConnectionState, UserProfile } from '../../types';
import { WindowState } from '../../types/window';
import { APP_REGISTRY, SUPER_APP_ORDER } from '../../data/appRegistry';

interface TaskbarProps {
  currentUser: UserProfile;
  windows: Record<SuperAppId, WindowState>;
  activeWindowId: SuperAppId | null;
  pinnedApps: SuperAppId[];
  unreadNotifications: number;
  syncState?: SyncConnectionState;
  isStartMenuOpen: boolean;
  isNotificationOpen: boolean;
  isQuickSettingsOpen: boolean;
  onToggleStartMenu: () => void;
  onOpenSearch: () => void;
  onOpenTaskView: () => void;
  onTaskbarAppClick: (appId: SuperAppId) => void;
  onFocusWindow: (appId: SuperAppId) => void;
  onMinimizeWindow: (appId: SuperAppId) => void;
  onCloseWindow: (appId: SuperAppId) => void;
  onToggleNotifications: () => void;
  onToggleQuickSettings: () => void;
  onShowDesktop: () => void;
}

export const Taskbar: React.FC<TaskbarProps> = ({
  currentUser,
  windows,
  activeWindowId,
  pinnedApps,
  unreadNotifications,
  syncState = 'synced',
  isStartMenuOpen,
  isNotificationOpen,
  isQuickSettingsOpen,
  onToggleStartMenu,
  onOpenSearch,
  onOpenTaskView,
  onTaskbarAppClick,
  onFocusWindow,
  onMinimizeWindow,
  onCloseWindow,
  onToggleNotifications,
  onToggleQuickSettings,
  onShowDesktop,
}) => {
  const [time, setTime] = useState(() => new Date());
  const [hoveredApp, setHoveredApp] = useState<SuperAppId | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = String(time.getHours()).padStart(2, '0');
  const minutes = String(time.getMinutes()).padStart(2, '0');
  const dateStr = `${String(time.getDate()).padStart(2, '0')}/${String(time.getMonth() + 1).padStart(2, '0')}/${time.getFullYear()}`;

  // Combine pinned apps + any currently open app not pinned (keeps deterministic order)
  const dockApps = useMemo(() => {
    const openIds = SUPER_APP_ORDER.filter((id) => windows[id]?.isOpen);
    const merged: SuperAppId[] = [];
    for (const id of pinnedApps) {
      if (!merged.includes(id)) merged.push(id);
    }
    for (const id of openIds) {
      if (!merged.includes(id)) merged.push(id);
    }
    return merged;
  }, [pinnedApps, windows]);

  const openCount = SUPER_APP_ORDER.filter((id) => windows[id]?.isOpen).length;

  return (
    <footer
      aria-label="Thanh tác vụ Windows 11"
      data-testid="taskbar"
      className="h-12 lg:h-[52px] w-full win11-taskbar shrink-0 relative z-40 flex items-center justify-between px-2.5 sm:px-4 select-none"
    >
      {/* Left spacer on desktop so main controls truly center like Windows 11 */}
      <div className="hidden md:flex items-center gap-2 w-56 shrink-0">
        <span className="text-[11px] font-bold tracking-tight text-slate-500 dark:text-slate-400">
          SchoolHub Cloud
        </span>
        <span
          data-testid="taskbar-sync-status"
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold ${
            syncState === 'synced'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : syncState === 'syncing' || syncState === 'connecting'
                ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300'
                : syncState === 'offline'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
          }`}
          title="Trạng thái đồng bộ Cloud Firestore"
        >
          {syncState === 'synced' && <Cloud className="w-3 h-3" />}
          {(syncState === 'syncing' || syncState === 'connecting') && (
            <RefreshCw className="w-3 h-3 animate-spin" />
          )}
          {syncState === 'offline' && <CloudOff className="w-3 h-3" />}
          {(syncState === 'error' || syncState === 'conflict') && (
            <AlertTriangle className="w-3 h-3" />
          )}
          <span>
            {syncState === 'synced'
              ? 'Đồng bộ'
              : syncState === 'syncing' || syncState === 'connecting'
                ? 'Đang tải'
                : syncState === 'offline'
                  ? 'Ngoại tuyến'
                  : syncState === 'conflict'
                    ? 'Xung đột'
                    : 'Lỗi đồng bộ'}
          </span>
        </span>
        {openCount > 0 && (
          <span className="text-[11px] font-mono-tabular text-sky-600 dark:text-sky-400">
            · {openCount}
          </span>
        )}
      </div>

      {/* Center Dock: Start + Search + Task View + Pinned/Running Apps */}
      <div className="min-w-0 flex-1 flex items-center justify-center gap-1 sm:gap-1.5 mx-1 sm:mx-auto overflow-hidden">
        {/* Start */}
        <button
          type="button"
          data-testid="taskbar-start-btn"
          onClick={onToggleStartMenu}
          aria-label="Start Menu"
          title="Bắt đầu"
          className={`w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
            isStartMenuOpen
              ? 'bg-sky-500/15 ring-1 ring-sky-400/50 scale-95'
              : 'hover:bg-white/70 dark:hover:bg-slate-800/70'
          }`}
        >
          <div className="grid grid-cols-2 gap-0.5 w-4 h-4">
            <div className="rounded-[2px] bg-sky-500" />
            <div className="rounded-[2px] bg-cyan-400" />
            <div className="rounded-[2px] bg-blue-600" />
            <div className="rounded-[2px] bg-indigo-500" />
          </div>
        </button>

        {/* Search */}
        <button
          type="button"
          data-testid="taskbar-search-btn"
          onClick={onOpenSearch}
          aria-label="Tìm kiếm (Ctrl+K)"
          title="Tìm kiếm (Ctrl+K)"
          className="h-8 w-8 sm:w-auto sm:h-9 sm:px-3 shrink-0 rounded-xl flex items-center justify-center gap-1.5 bg-white/60 dark:bg-slate-800/60 hover:bg-white/90 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 text-slate-600 dark:text-slate-300 text-xs transition-colors cursor-pointer"
        >
          <Search className="w-3.5 h-3.5 text-sky-500" />
          <span className="hidden lg:inline text-[11px] font-medium">Tìm kiếm</span>
        </button>

        {/* Task View */}
        <button
          type="button"
          data-testid="taskbar-taskview-btn"
          onClick={onOpenTaskView}
          aria-label="Task View"
          title="Task View — Xem các cửa sổ"
          className="hidden sm:flex w-9 h-9 shrink-0 rounded-xl items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
        >
          <Layers className="w-4 h-4" />
        </button>

        {dockApps.length > 0 && (
          <div className="w-px h-5 bg-slate-300/70 dark:bg-slate-700 mx-0.5 shrink-0" />
        )}

        {/* Running & Pinned Apps */}
        <div className="min-w-0 flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5" data-testid="taskbar-running-apps">
          {dockApps.map((appId) => {
            const meta = APP_REGISTRY[appId];
            const AppIcon = meta.icon;
            const win = windows[appId];
            const isOpen = Boolean(win?.isOpen);
            const isMinimized = Boolean(win?.isMinimized);
            const isActive = activeWindowId === appId && isOpen && !isMinimized;
            const activeTabMeta = meta.tabs.find((t) => t.id === win?.activeTab);

            return (
              <div
                key={appId}
                className="relative shrink-0"
                onMouseEnter={() => setHoveredApp(appId)}
                onMouseLeave={() => setHoveredApp(null)}
              >
                <button
                  type="button"
                  data-testid={`taskbar-app-${appId}`}
                  data-state={isActive ? 'active' : isMinimized ? 'minimized' : isOpen ? 'background' : 'closed'}
                  onClick={() => onTaskbarAppClick(appId)}
                  aria-label={meta.title}
                  className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                    isActive
                      ? 'bg-white/90 dark:bg-slate-800 ring-1 ring-sky-400/60 shadow-xs'
                      : isOpen
                      ? 'bg-white/55 dark:bg-slate-800/55 hover:bg-white/80 dark:hover:bg-slate-800'
                      : 'hover:bg-white/60 dark:hover:bg-slate-800/60 opacity-85 hover:opacity-100'
                  } ${isMinimized ? 'opacity-65' : ''}`}
                >
                  <AppIcon className="w-5 h-5 sm:w-6 sm:h-6" />

                  {/* Windows 11 Running Indicator */}
                  {isOpen && (
                    <span
                      className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 rounded-full transition-all ${
                        isActive
                          ? 'w-4 bg-sky-500'
                          : isMinimized
                          ? 'w-1.5 bg-amber-400'
                          : 'w-2 bg-slate-400 dark:bg-slate-500'
                      }`}
                    />
                  )}
                </button>

                {/* Hover Preview / Tooltip */}
                {hoveredApp === appId && (
                  <div className="hidden sm:block absolute bottom-12 left-1/2 -translate-x-1/2 z-50">
                    {isOpen ? (
                      <div className="w-56 p-2.5 rounded-2xl win11-acrylic text-left shadow-xl">
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
                          <div className="flex items-center gap-2 min-w-0">
                            <AppIcon className="w-5 h-5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                {meta.title}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {activeTabMeta?.label || meta.shortTitle}
                                {isMinimized ? ' · Thu nhỏ' : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onMinimizeWindow(appId);
                                setHoveredApp(null);
                              }}
                              title="Thu nhỏ"
                              className="p-1 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-500 cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onCloseWindow(appId);
                                setHoveredApp(null);
                              }}
                              title="Đóng"
                              className="p-1 rounded-lg hover:bg-rose-500 hover:text-white text-slate-500 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onFocusWindow(appId);
                            setHoveredApp(null);
                          }}
                          className="mt-2 w-full py-1.5 rounded-xl bg-sky-500/12 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Hiển thị cửa sổ</span>
                        </button>
                      </div>
                    ) : (
                      <div className="px-2.5 py-1 rounded-lg bg-slate-900/90 text-white text-[11px] font-medium whitespace-nowrap shadow-md">
                        {meta.title}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right System Tray */}
      <div className="flex items-center justify-end gap-0.5 sm:gap-1.5 md:w-48 shrink-0">
        {/* Notification Center */}
        <button
          type="button"
          data-testid="taskbar-notifications-btn"
          onClick={onToggleNotifications}
          aria-label="Trung tâm thông báo"
          title="Thông báo"
          className={`relative w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
            isNotificationOpen
              ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/70'
          }`}
        >
          <Bell className="w-4 h-4" />
          {unreadNotifications > 0 && (
            <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
              {unreadNotifications > 9 ? '9+' : unreadNotifications}
            </span>
          )}
        </button>

        {/* Quick Settings */}
        <button
          type="button"
          data-testid="taskbar-quicksettings-btn"
          onClick={onToggleQuickSettings}
          aria-label="Cài đặt nhanh"
          title="Cài đặt nhanh"
          className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
            isQuickSettingsOpen
              ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/70'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>

        {/* Clock & Date */}
        <button
          type="button"
          onClick={onToggleNotifications}
          title={dateStr}
          className="hidden sm:flex flex-col items-end justify-center px-1.5 py-0.5 rounded-lg hover:bg-white/60 dark:hover:bg-slate-800/60 cursor-pointer"
        >
          <span className="font-mono-tabular text-[11px] font-bold text-slate-800 dark:text-slate-100 leading-none">
            {hours}:{minutes}
          </span>
          <span className="font-mono-tabular text-[10px] text-slate-500 dark:text-slate-400 leading-none mt-0.5">
            {dateStr}
          </span>
        </button>

        {/* User Avatar */}
        <button
          type="button"
          onClick={onToggleStartMenu}
          title={currentUser.displayName}
          aria-label="Tài khoản người dùng"
          className="w-7 h-7 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shadow-xs hover:ring-2 hover:ring-sky-400/60 transition-all cursor-pointer"
        >
          {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'}
        </button>

        {/* Show Desktop Strip */}
        <button
          type="button"
          data-testid="taskbar-show-desktop"
          onClick={onShowDesktop}
          aria-label="Hiện Desktop"
          title="Thu nhỏ tất cả cửa sổ (Hiện Desktop)"
          className="w-1.5 h-7 ml-0.5 rounded-xs border-l border-slate-300/80 dark:border-slate-600 hover:bg-sky-400/40 transition-colors cursor-pointer"
        />
      </div>
    </footer>
  );
};
