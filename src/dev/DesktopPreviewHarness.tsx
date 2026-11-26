import React, { useEffect, useRef, useState } from 'react';
import { DesktopScreen } from '../components/desktop/DesktopScreen';
import { Taskbar } from '../components/desktop/Taskbar';
import { StartMenu } from '../components/desktop/StartMenu';
import { WindowManager } from '../components/desktop/WindowManager';
import { AIAssistantApp } from '../components/apps/AIAssistantApp';
import { AnalyticsAIApp } from '../components/apps/AnalyticsAIApp';
import { WebWallpaperBackdrop } from '../components/common/WebWallpaperBackdrop';
import { useWindowManager } from '../hooks/useWindowManager';
import { DEFAULT_SYSTEM_SETTINGS } from '../firebase/services';
import { APP_REGISTRY } from '../data/appRegistry';
import { canAccessSuperApp, DEFAULT_PERMISSIONS, getAllowedTabsForApp } from '../utils/rbac';
import { resolveAppTabAlias } from '../utils/streamlinedHelpers';
import { DEFAULT_SYSTEM_BRANDING } from '../utils/branding';
import { DEFAULT_SYSTEM_WALLPAPER } from '../utils/wallpaper';
import type { SuperAppId, UserProfile, UserRole } from '../types';

function makePreviewUser(roleParam: string | null): UserProfile {
  const role: UserRole = roleParam === 'student' ? 'student' : 'admin';
  if (role === 'student') {
    return {
      id: 'dev-stu-1',
      email: 'an.student@schoolhub.edu.vn',
      displayName: 'Nguyễn Minh An',
      role: 'student',
      className: '11A1',
      studentCode: 'HS-11A1-01',
      schoolId: 'schoolhub_main',
      status: 'active',
    };
  }
  return {
    id: 'dev-admin-1',
    email: 'admin@schoolhub.edu.vn',
    displayName: 'Quản trị viên Demo',
    role: 'admin',
    schoolId: 'schoolhub_main',
    status: 'active',
  };
}

export function DesktopPreviewHarness() {
  const params = new URLSearchParams(window.location.search);
  const currentUser = makePreviewUser(params.get('role'));
  const initialDark = params.get('theme') === 'dark';

  const [darkMode, setDarkMode] = useState(initialDark);
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const {
    windows,
    activeWindowId,
    openWindow,
    closeWindow,
    minimizeAll,
    setWindowTab,
  } = useWindowManager(workspaceRef);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    const appParam = params.get('app') as SuperAppId | null;
    const tabParam = params.get('tab') || undefined;
    if (appParam && APP_REGISTRY[appParam]) {
      openWindow(appParam, tabParam);
    }
    // Run once on mount for ?app=...&tab=...
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenApp = (appId: SuperAppId, tabId?: string) => {
    setIsStartMenuOpen(false);
    if (!canAccessSuperApp(currentUser, appId, DEFAULT_PERMISSIONS)) return;
    const allowedTabs = getAllowedTabsForApp(currentUser, appId, DEFAULT_PERMISSIONS);
    let resolvedTab = tabId ? resolveAppTabAlias(appId, tabId) : undefined;
    if (resolvedTab && !allowedTabs.some((t) => t.id === resolvedTab)) {
      resolvedTab = allowedTabs[0]?.id;
    } else if (!resolvedTab) {
      resolvedTab = allowedTabs[0]?.id;
    }
    openWindow(appId, resolvedTab);
  };

  const renderAppContent = (appId: SuperAppId, activeTab: string) => {
    if (appId === 'ai-assistant') {
      return (
        <AIAssistantApp
          activeTab={activeTab}
          currentUser={currentUser}
          customPermissions={DEFAULT_PERMISSIONS}
          externalDatasets={[]}
          students={[]}
          teachers={[]}
          classes={[]}
          books={[]}
          borrowTransactions={[]}
          academicRecords={[]}
          feedbacks={[]}
          announcements={[]}
          facilities={[]}
          maintenance={[]}
          onSelectTab={(tab) => setWindowTab('ai-assistant', tab)}
          onOpenTargetApp={handleOpenApp}
        />
      );
    }
    if (appId === 'analytics') {
      return (
        <AnalyticsAIApp
          activeTab={activeTab}
          currentUser={currentUser}
          customPermissions={DEFAULT_PERMISSIONS}
          students={[]}
          teachers={[]}
          classes={[]}
          books={[]}
          borrowTransactions={[]}
          academicRecords={[]}
          feedbacks={[]}
          announcements={[]}
          facilities={[]}
          maintenance={[]}
          onSelectTab={(tab) => setWindowTab('analytics', tab)}
          onImportStudents={() => {}}
          onImportBooks={() => {}}
          onImportTeachers={() => {}}
          onOpenTargetApp={handleOpenApp}
        />
      );
    }
    const meta = APP_REGISTRY[appId];
    return (
      <div className="p-6 text-sm text-slate-700 dark:text-slate-200">
        {meta.title} ({activeTab})
      </div>
    );
  };

  return (
    <div className="h-[100dvh] w-screen overflow-hidden text-slate-800 dark:text-slate-100 relative flex flex-col font-sans">
      <WebWallpaperBackdrop wallpaper={DEFAULT_SYSTEM_WALLPAPER} />
      <Taskbar
        currentUser={currentUser}
        branding={DEFAULT_SYSTEM_BRANDING}
        customPermissions={DEFAULT_PERMISSIONS}
        windows={windows}
        activeWindowId={activeWindowId}
        unreadNotifications={0}
        isStartMenuOpen={isStartMenuOpen}
        isNotificationOpen={false}
        isQuickSettingsOpen={false}
        isWeatherOpen={false}
        onToggleStartMenu={() => setIsStartMenuOpen((prev) => !prev)}
        onSelectTab={setWindowTab}
        onCloseWindow={closeWindow}
        onToggleNotifications={() => {}}
        onToggleQuickSettings={() => setDarkMode((prev) => !prev)}
        onToggleWeather={() => {}}
        onGoHome={() => {
          setIsStartMenuOpen(false);
          minimizeAll();
        }}
      />

      <main ref={workspaceRef} className="flex-1 min-h-0 relative overflow-hidden">
        <DesktopScreen
          currentUser={currentUser}
          windows={windows}
          activeWindowId={activeWindowId}
          students={[]}
          teachers={[]}
          classes={[]}
          books={[]}
          borrowTransactions={[]}
          announcements={[]}
          events={[]}
          surveys={[]}
          facilities={[]}
          maintenance={[]}
          timetable={[]}
          customPermissions={DEFAULT_PERMISSIONS}
          systemSettings={DEFAULT_SYSTEM_SETTINGS}
          onOpenStartMenu={() => setIsStartMenuOpen(true)}
          onOpenApp={handleOpenApp}
        />

        <WindowManager
          windows={windows}
          activeWindowId={activeWindowId}
          currentUser={currentUser}
          customPermissions={DEFAULT_PERMISSIONS}
          renderAppContent={renderAppContent}
        />

        <StartMenu
          currentUser={currentUser}
          branding={DEFAULT_SYSTEM_BRANDING}
          customPermissions={DEFAULT_PERMISSIONS}
          isOpen={isStartMenuOpen}
          onClose={() => setIsStartMenuOpen(false)}
          onOpenApp={handleOpenApp}
        />
      </main>
    </div>
  );
}

export default DesktopPreviewHarness;
