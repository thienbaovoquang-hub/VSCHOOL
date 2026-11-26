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
  Trophy, Layers, RefreshCw, Sliders, Languages, Calculator, Atom, FlaskConical, Feather, Landmark, Compass,
  Zap, Cpu,
} from '../icons/UiIcons';
import { PermissionMatrix, SuperAppId, UserProfile, UserRole } from '../../types';
import { APP_REGISTRY } from '../../data/appRegistry';
import { DEFAULT_PERMISSIONS, getAllowedTabsForApp } from '../../utils/rbac';

export const TAB_ICONS: Record<string, React.FC<{ className?: string }>> = {
  LayoutDashboard, Users, Shield, Settings, History,
  GraduationCap, UserCheck, Briefcase, School, CalendarRange,
  Calendar, ClipboardCheck, Award, FileText, FolderOpen,
  BookOpen, ScanLine, BookPlus, BookCheck, Bookmark, Clock,
  ClipboardList, MessageSquare, AlertTriangle, HeartHandshake, FileCheck,
  Bell, Sparkles, CalendarDays, Send,
  LayoutGrid, DoorOpen, Monitor, AlertCircle, Wrench,
  PieChart, BarChart3, BrainCircuit, Bot, Database, LifeBuoy,
  Trophy, Layers, RefreshCw, Sliders, Languages, Calculator, Atom, FlaskConical, Feather, Landmark, Compass,
  Zap, Cpu,
};

interface AppWindowShellProps {
  appId: SuperAppId;
  activeTab: string;
  userRole: UserRole;
  userProfile?: UserProfile;
  customPermissions?: PermissionMatrix;
  contentClassName?: string;
  hideTabBar?: boolean;
  onSelectTab: (tabId: string) => void;
  children: (resolvedTabId: string) => React.ReactNode;
}

export const AppWindowShell: React.FC<AppWindowShellProps> = ({
  appId,
  activeTab,
  userRole,
  userProfile,
  customPermissions = DEFAULT_PERMISSIONS,
  contentClassName,
  children,
}) => {
  const meta = APP_REGISTRY[appId];
  const allowedTabs = getAllowedTabsForApp(userProfile || userRole, appId, customPermissions);

  if (allowedTabs.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center">
        <div className="w-14 h-14 rounded-2xl glass-subsurface text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
          <Lock className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Quyền truy cập bị giới hạn
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mt-1">
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
      <div className={contentClassName || 'flex-1 min-h-0 overflow-y-auto px-4 pb-6 pt-2 sm:px-6 lg:px-8'}>
        {children(resolvedTab)}
      </div>
    </div>
  );
};
