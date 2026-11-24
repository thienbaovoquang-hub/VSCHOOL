import React, { useMemo } from 'react';
import {
  Bell,
  Settings,
  X,
  Home,
  LayoutGrid,
} from 'lucide-react';
import {
  PermissionMatrix,
  SuperAppId,
  SystemBrandingConfig,
  UserProfile,
} from '../../types';
import { WindowState } from '../../types/window';
import { APP_REGISTRY } from '../../data/appRegistry';
import { SystemBrandMark } from '../common/SystemBrandMark';
import { DEFAULT_SYSTEM_BRANDING, normalizeBrandName } from '../../utils/branding';
import { DEFAULT_PERMISSIONS } from '../../utils/rbac';
import { resolveTopBarAppState } from '../../utils/topBarNavigation';
import { ScrollableTabTray } from './ScrollableTabTray';

interface TaskbarProps {
  currentUser: UserProfile;
  branding?: SystemBrandingConfig;
  customPermissions?: PermissionMatrix;
  windows: Record<SuperAppId, WindowState>;
  activeWindowId: SuperAppId | null;
  unreadNotifications: number;
  isStartMenuOpen: boolean;
  isNotificationOpen: boolean;
  isQuickSettingsOpen: boolean;
  onToggleStartMenu: () => void;
  onSelectTab: (appId: SuperAppId, tabId: string) => void;
  onCloseWindow: (appId: SuperAppId) => void;
  onToggleNotifications: () => void;
  onToggleQuickSettings: () => void;
  onGoHome: () => void;
}

export const Taskbar: React.FC<TaskbarProps> = ({
  currentUser,
  branding,
  customPermissions = DEFAULT_PERMISSIONS,
  windows,
  activeWindowId,
  unreadNotifications,
  isStartMenuOpen,
  isNotificationOpen,
  isQuickSettingsOpen,
  onToggleStartMenu,
  onSelectTab,
  onCloseWindow,
  onToggleNotifications,
  onToggleQuickSettings,
  onGoHome,
}) => {
  const activeTopBarApp = useMemo(
    () =>
      resolveTopBarAppState({
        user: currentUser,
        windows,
        activeWindowId,
        customPermissions,
      }),
    [currentUser, windows, activeWindowId, customPermissions]
  );

  const isAppOpen = Boolean(activeTopBarApp);
  const activeMeta = activeTopBarApp ? APP_REGISTRY[activeTopBarApp.appId] : null;
  const ActiveAppIcon = activeMeta?.icon;
  const isHomeActive = !isAppOpen;

  const resolvedBranding = branding || DEFAULT_SYSTEM_BRANDING;
  const brandName = normalizeBrandName(resolvedBranding.appName);

  const renderAppTabsTray = (testIdPrefix: string) => {
    if (!activeTopBarApp || !activeMeta || activeTopBarApp.tabs.length === 0) return null;

    return (
      <ScrollableTabTray
        appId={activeTopBarApp.appId}
        appTitle={activeMeta.title}
        tabs={activeTopBarApp.tabs}
        activeTab={activeTopBarApp.activeTab}
        testIdPrefix={testIdPrefix}
        onSelectTab={onSelectTab}
      />
    );
  };

  return (
    <div className="fixed top-2.5 sm:top-3 inset-x-0 z-50 px-3 sm:px-5 pointer-events-none select-none">
      <div className="mx-auto w-full max-w-[1440px] flex flex-col items-center">
        <header
          aria-label={`Thanh điều hướng ${brandName}`}
          data-testid="taskbar"
          data-mode={isAppOpen ? 'app-fullscreen' : 'home'}
          className={`pointer-events-auto h-[52px] sm:h-14 w-full rounded-full flex items-center justify-between gap-1 sm:gap-3 px-1.5 sm:px-3 transition-all duration-200 ${
            isAppOpen
              ? 'floating-pill-topbar floating-pill-topbar--elevated'
              : 'floating-pill-topbar'
          }`}
        >
          {/* Zone 1: Brand Lockup + Primary Navigation */}
          <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0 min-w-0">
            <button
              type="button"
              onClick={onGoHome}
              data-testid="header-brand-lockup"
              className="flex items-center text-left rounded-full pl-1 pr-1.5 sm:pl-1.5 sm:pr-2.5 py-1 hover:bg-white/50 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              title={`Về Trang chủ ${brandName}`}
            >
              <SystemBrandMark
                branding={resolvedBranding}
                size="header"
                subtitle="Smart School OS"
                showSubtitle={!isAppOpen}
                subtitleClassName="hidden lg:block"
              />
            </button>

            <div className="hidden sm:block w-px h-5 bg-slate-900/10 dark:bg-white/12 mx-0.5 shrink-0" />

            <nav aria-label="Điều hướng chính" className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              <button
                type="button"
                data-testid="taskbar-home-btn"
                onClick={onGoHome}
                aria-label="Trang chủ"
                title="Trang chủ"
                className={`w-8 h-8 sm:w-auto sm:h-9 px-0 sm:px-3.5 rounded-full flex items-center justify-center gap-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  isHomeActive && !isStartMenuOpen
                    ? 'glass-pill-tab-active'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-white/55 dark:hover:bg-white/10'
                }`}
              >
                <Home className="w-3.5 h-3.5 shrink-0" />
                <span className={isAppOpen ? 'hidden lg:inline' : 'hidden sm:inline'}>
                  Trang chủ
                </span>
              </button>

              <button
                type="button"
                data-testid="taskbar-start-btn"
                onClick={onToggleStartMenu}
                aria-label="Ứng dụng"
                title="Danh sách ứng dụng"
                className={`w-8 h-8 sm:w-auto sm:h-9 px-0 sm:px-3.5 rounded-full flex items-center justify-center gap-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  isStartMenuOpen
                    ? 'glass-pill-tab-active'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-white/55 dark:hover:bg-white/10'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
                <span className={isAppOpen ? 'hidden lg:inline' : 'hidden sm:inline'}>
                  Ứng dụng
                </span>
              </button>
            </nav>
          </div>

          {/* Zone 2: Active App Option Tabs (Promoted into Top Pill Bar on md+) */}
          <div className="hidden md:flex min-w-0 flex-1 items-center justify-center gap-2.5 px-1 overflow-hidden">
            {isAppOpen && activeMeta && ActiveAppIcon && (
              <>
                <div className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full glass-subsurface shrink-0">
                  <ActiveAppIcon className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                    {activeMeta.shortTitle}
                  </span>
                </div>
                {renderAppTabsTray('app')}
              </>
            )}
          </div>

          {/* Zone 3: Utility Controls + User Avatar + Close Fullscreen App */}
          <div className="flex items-center justify-end gap-0.5 sm:gap-1.5 shrink-0">
            <button
              type="button"
              data-testid="taskbar-notifications-btn"
              onClick={onToggleNotifications}
              aria-label="Trung tâm thông báo"
              title="Thông báo"
              className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                isNotificationOpen
                  ? 'glass-subsurface text-sky-700 dark:text-sky-300 shadow-xs'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-white/55 dark:hover:bg-white/10'
              }`}
            >
              <Bell className="w-4 h-4" />
              {unreadNotifications > 0 && (
                <span className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white/90 dark:ring-slate-900" />
              )}
            </button>

            <button
              type="button"
              data-testid="taskbar-quicksettings-btn"
              onClick={onToggleQuickSettings}
              aria-label="Cài đặt nhanh"
              title="Cài đặt nhanh"
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                isQuickSettingsOpen
                  ? 'glass-subsurface text-sky-700 dark:text-sky-300 shadow-xs'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-white/55 dark:hover:bg-white/10'
              }`}
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onToggleStartMenu}
              title={currentUser.displayName}
              aria-label="Tài khoản người dùng"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 text-white font-bold text-xs flex items-center justify-center ring-2 ring-white/75 dark:ring-white/20 shadow-sm hover:ring-sky-400 transition-all cursor-pointer overflow-hidden shrink-0"
            >
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.displayName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : currentUser.displayName ? (
                currentUser.displayName.charAt(0).toUpperCase()
              ) : (
                'U'
              )}
            </button>

            {activeTopBarApp && activeMeta && (
              <button
                type="button"
                data-testid={`close-fullscreen-${activeTopBarApp.appId}`}
                onClick={() => onCloseWindow(activeTopBarApp.appId)}
                aria-label={`Đóng ${activeMeta.title}`}
                title={`Đóng ${activeMeta.title} và về Trang chủ`}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-rose-500 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* Mobile (< md) floating pill option tabs bar when an app is open full-screen */}
        {isAppOpen && activeTopBarApp && activeTopBarApp.tabs.length > 0 && (
          <div className="md:hidden pointer-events-auto mt-2 max-w-full flex items-center justify-center">
            {renderAppTabsTray('mobile-app')}
          </div>
        )}
      </div>
    </div>
  );
};
