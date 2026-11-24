import { APP_REGISTRY } from '../data/appRegistry';
import type { PermissionMatrix, SuperAppId, UserProfile } from '../types';
import type { AppTabDefinition, WindowState } from '../types/window';
import { canAccessSuperApp, DEFAULT_PERMISSIONS, getAllowedTabsForApp } from './rbac';
import { resolveAppTabAlias } from './streamlinedHelpers';

export interface ActiveTopBarAppState {
  appId: SuperAppId;
  activeTab: string;
  tabs: AppTabDefinition[];
}

/**
 * Returns the currently visible full-screen app (if any), or null when on Home.
 */
export function getVisibleActiveApp(
  windows: Record<SuperAppId, WindowState>,
  activeWindowId: SuperAppId | null
): WindowState | null {
  if (!activeWindowId) return null;
  const win = windows[activeWindowId];
  if (!win || !win.isOpen || win.isMinimized) return null;
  return win;
}

/**
 * Resolves the RBAC-filtered option tabs and active tab ID to display in the top bar
 * when a Super App is open in full-screen mode.
 */
export function resolveTopBarAppState(params: {
  user: UserProfile;
  windows: Record<SuperAppId, WindowState>;
  activeWindowId: SuperAppId | null;
  customPermissions?: PermissionMatrix;
}): ActiveTopBarAppState | null {
  const { user, windows, activeWindowId, customPermissions = DEFAULT_PERMISSIONS } = params;
  const activeWin = getVisibleActiveApp(windows, activeWindowId);
  if (!activeWin) return null;

  if (!canAccessSuperApp(user, activeWin.appId, customPermissions)) {
    return {
      appId: activeWin.appId,
      activeTab: activeWin.activeTab,
      tabs: [],
    };
  }

  const allowedTabs = getAllowedTabsForApp(user, activeWin.appId, customPermissions);
  const meta = APP_REGISTRY[activeWin.appId];
  const normalizedTab = resolveAppTabAlias(activeWin.appId, activeWin.activeTab || meta.defaultTab);
  const activeTab = allowedTabs.some((t) => t.id === normalizedTab)
    ? normalizedTab
    : (allowedTabs[0]?.id ?? normalizedTab);

  return {
    appId: activeWin.appId,
    activeTab,
    tabs: allowedTabs,
  };
}

export interface TabScrollState {
  canScrollLeft: boolean;
  canScrollRight: boolean;
  hasOverflow: boolean;
  maxScrollLeft: number;
}

/**
 * Computes horizontal overflow and scroll boundary flags for the top-bar tab tray.
 */
export function computeTabScrollState(params: {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
  tolerance?: number;
}): TabScrollState {
  const { scrollLeft, scrollWidth, clientWidth, tolerance = 2 } = params;
  const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
  const hasOverflow = maxScrollLeft > tolerance;
  const clampedScrollLeft = Math.max(0, Math.min(scrollLeft, maxScrollLeft));

  return {
    canScrollLeft: hasOverflow && clampedScrollLeft > tolerance,
    canScrollRight: hasOverflow && clampedScrollLeft < maxScrollLeft - tolerance,
    hasOverflow,
    maxScrollLeft,
  };
}

export interface DragScrollResult {
  nextScrollLeft: number;
  dragDistance: number;
  isDragging: boolean;
}

/**
 * Computes next horizontal scroll position and click-vs-drag classification during pointer drag.
 */
export function computeNextDragScroll(params: {
  startX: number;
  currentX: number;
  startScrollLeft: number;
  maxScrollLeft: number;
  dragThresholdPx?: number;
}): DragScrollResult {
  const {
    startX,
    currentX,
    startScrollLeft,
    maxScrollLeft,
    dragThresholdPx = 5,
  } = params;
  const deltaX = currentX - startX;
  const dragDistance = Math.abs(deltaX);
  const isDragging = dragDistance > dragThresholdPx;
  const safeMax = Math.max(0, maxScrollLeft);
  const nextScrollLeft = Math.max(0, Math.min(startScrollLeft - deltaX, safeMax));

  return {
    nextScrollLeft,
    dragDistance,
    isDragging,
  };
}

/**
 * Computes target scrollLeft when clicking left/right overflow chevron buttons.
 */
export function computeStepScrollTarget(params: {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
  direction: 'left' | 'right';
  stepRatio?: number;
}): number {
  const {
    scrollLeft,
    clientWidth,
    scrollWidth,
    direction,
    stepRatio = 0.65,
  } = params;
  const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
  const stepPx = Math.max(120, Math.round(clientWidth * stepRatio));
  const rawTarget = direction === 'right' ? scrollLeft + stepPx : scrollLeft - stepPx;
  return Math.max(0, Math.min(rawTarget, maxScrollLeft));
}

