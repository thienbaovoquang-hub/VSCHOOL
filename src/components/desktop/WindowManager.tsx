import React from 'react';
import { PermissionMatrix, SuperAppId, UserProfile } from '../../types';
import { WindowState } from '../../types/window';
import { APP_REGISTRY } from '../../data/appRegistry';
import { DEFAULT_PERMISSIONS } from '../../utils/rbac';
import { resolveTopBarAppState } from '../../utils/topBarNavigation';

interface WindowManagerProps {
  windows: Record<SuperAppId, WindowState>;
  activeWindowId: SuperAppId | null;
  currentUser?: UserProfile;
  customPermissions?: PermissionMatrix;
  renderAppContent: (appId: SuperAppId, activeTab: string) => React.ReactNode;
}

export const WindowManager: React.FC<WindowManagerProps> = ({
  windows,
  activeWindowId,
  currentUser,
  customPermissions = DEFAULT_PERMISSIONS,
  renderAppContent,
}) => {
  if (!activeWindowId) return null;
  const activeWin = windows[activeWindowId];
  if (!activeWin || !activeWin.isOpen || activeWin.isMinimized) return null;

  const meta = APP_REGISTRY[activeWin.appId];
  const topBarState = currentUser
    ? resolveTopBarAppState({
        user: currentUser,
        windows,
        activeWindowId,
        customPermissions,
      })
    : null;
  const hasMobileSubTabs = Boolean(topBarState && topBarState.tabs.length > 0);

  return (
    <section
      aria-label={`Ứng dụng ${meta.title}`}
      data-testid={`window-${activeWin.appId}`}
      className={`fixed inset-0 z-20 flex flex-col overflow-hidden bg-white/52 dark:bg-slate-950/64 backdrop-blur-3xl text-slate-900 dark:text-slate-100 ${
        hasMobileSubTabs ? 'pt-[118px] md:pt-[78px]' : 'pt-[74px] sm:pt-[78px]'
      }`}
    >
      <div className="glass-window-body flex-1 min-h-0 flex flex-col overflow-hidden">
        {renderAppContent(activeWin.appId, activeWin.activeTab)}
      </div>
    </section>
  );
};
