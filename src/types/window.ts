import type React from 'react';
import type { AppAction, AppModuleId, SuperAppId } from './index';

export type WindowSnapPosition =
  | 'none'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'maximized';

export interface AppTabDefinition {
  id: string;
  label: string;
  iconName: string;
  permissionModule: AppModuleId;
  requiredAction?: AppAction;
}

export interface AppMetadata {
  id: SuperAppId;
  title: string;
  shortTitle: string;
  subtitle: string;
  accentGradient: string;
  accentHex: string;
  softSurface: string;
  icon: React.FC<{ className?: string; size?: number }>;
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  minHeight: number;
  defaultTab: string;
  inlineTitlebarTabs?: boolean;
  tabs: AppTabDefinition[];
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowState {
  windowId: string;
  id: SuperAppId;
  appId: SuperAppId;
  title: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  isActive: boolean;
  zIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  snapPosition: WindowSnapPosition;
  prevBounds?: WindowBounds;
  activeTab: string;
}

export interface SnapPreviewZone {
  x: number;
  y: number;
  width: number;
  height: number;
  position: WindowSnapPosition;
}
