import React from 'react';
import {
  LayoutDashboard, Users, Shield, Settings, History,
  GraduationCap, UserCheck, Briefcase, School, CalendarRange,
  Calendar, ClipboardCheck, Award, FileText, FolderOpen,
  BookOpen, ScanLine, BookPlus, BookCheck, Bookmark, Clock,
  ClipboardList, MessageSquare, AlertTriangle, HeartHandshake, FileCheck,
  Bell, Sparkles, CalendarDays, Send,
  LayoutGrid, DoorOpen, Monitor, AlertCircle, Wrench,
  PieChart, BarChart3, BrainCircuit, Bot, Database, Lock, LifeBuoy,
  Trophy, Layers, RefreshCw, Sliders,
} from 'lucide-react';
import { PermissionMatrix, SuperAppId, UserProfile, UserRole } from '../../types';
import { APP_REGISTRY } from '../../data/appRegistry';
import { DEFAULT_PERMISSIONS, getAllowedTabsForApp } from '../../utils/rbac';

const TAB_ICONS: Record<string, React.FC<{ className?: string }>> = {
  LayoutDashboard, Users, Shield, Settings, History,
  GraduationCap, UserCheck, Briefcase, School, CalendarRange,
  Calendar, ClipboardCheck, Award, FileText, FolderOpen,
  BookOpen, ScanLine, BookPlus, BookCheck, Bookmark, Clock,
  ClipboardList, MessageSquare, AlertTriangle, HeartHandshake, FileCheck,
  Bell, Sparkles, CalendarDays, Send,
  LayoutGrid, DoorOpen, Monitor, AlertCircle, Wrench,
  PieChart, BarChart3, BrainCircuit, Bot, Database, LifeBuoy,
  Trophy, Layers, RefreshCw, Sliders,
};

interface AppWindowShellProps {
  appId: SuperAppId;
  activeTab: string;
  userRole: UserRole;
  userProfile?: UserProfile;
  customPermissions?: PermissionMatrix;
  onSelectTab: (tabId: string) => void;
  children: (resolvedTabId: string) => React.ReactNode;
}

export const AppWindowShell: React.FC<AppWindowShellProps> = ({
  appId,
  activeTab,
  userRole,
  userProfile,
  customPermissions = DEFAULT_PERMISSIONS,
  onSelectTab,
  children,
}) => {
  const meta = APP_REGISTRY[appId];
  const allowedTabs = getAllowedTabsForApp(userProfile || userRole, appId, customPermissions);

  if (allowedTabs.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
          <Lock className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
          Quyền truy cập bị giới hạn
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
          Vai trò hiện tại không có quyền mở các tính năng trong {meta.title}.
        </p>
      </div>
    );
  }

  const resolvedTab = allowedTabs.some((t) => t.id === activeTab)
    ? activeTab
    : allowedTabs[0].id;

  return (
    <div className="h-full w-full flex flex-col min-h-0">
      {/* Level 2: Liquid Glass Pill Navigation Bar */}
      <div className="shrink-0 px-3 sm:px-5 pt-2.5 pb-2 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/35 dark:bg-slate-900/35">
        <nav
          aria-label={`Tính năng ${meta.title}`}
          data-testid={`app-tabs-${appId}`}
          role="tablist"
          className="glass-pill-tray inline-flex max-w-full items-center gap-1 p-1 rounded-2xl overflow-x-auto scrollbar-none flex-nowrap"
        >
          {allowedTabs.map((tab) => {
            const isActive = resolvedTab === tab.id;
            const IconComp = TAB_ICONS[tab.iconName] || LayoutDashboard;

            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`app-tab-${appId}-${tab.id}`}
                onClick={() => onSelectTab(tab.id)}
                aria-selected={isActive}
                role="tab"
                className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'glass-pill-tab-active'
                    : 'glass-pill-tab'
                }`}
              >
                <IconComp className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Level 3: Scrollable Workspace Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
        {children(resolvedTab)}
      </div>
    </div>
  );
};
