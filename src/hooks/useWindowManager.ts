import { useState, useCallback, useRef, useEffect } from 'react';
import type React from 'react';
import { SuperAppId } from '../types';
import { WindowState, WindowSnapPosition, SnapPreviewZone } from '../types/window';
import { APP_REGISTRY, SUPER_APP_ORDER } from '../data/appRegistry';
import {
  calculateSnapBounds,
  detectSnapZone,
  clampWindowBounds,
  computeCascadePosition,
} from '../utils/windowRules';
import { resolveAppTabAlias } from '../utils/streamlinedHelpers';

export function useWindowManager(workspaceRef: React.RefObject<HTMLDivElement | null>) {
  const [windows, setWindows] = useState<Record<SuperAppId, WindowState>>(() => {
    const initial: Partial<Record<SuperAppId, WindowState>> = {};
    SUPER_APP_ORDER.forEach((appId, index) => {
      const meta = APP_REGISTRY[appId];
      initial[appId] = {
        windowId: `win-${appId}`,
        id: appId,
        appId,
        title: meta.title,
        isOpen: false,
        isMinimized: false,
        isMaximized: false,
        isActive: false,
        zIndex: 20 + index,
        x: 64 + (index % 5) * 32,
        y: 36 + (index % 5) * 28,
        width: meta.defaultWidth,
        height: meta.defaultHeight,
        snapPosition: 'none',
        activeTab: meta.defaultTab,
      };
    });
    return initial as Record<SuperAppId, WindowState>;
  });

  const [activeWindowId, setActiveWindowId] = useState<SuperAppId | null>(null);
  const [snapPreview, setSnapPreview] = useState<SnapPreviewZone | null>(null);
  const nextZIndexRef = useRef<number>(60);

  const getWorkspaceSize = useCallback(() => {
    if (workspaceRef.current) {
      return {
        width: Math.max(320, workspaceRef.current.clientWidth),
        height: Math.max(300, workspaceRef.current.clientHeight),
      };
    }
    return {
      width: typeof window !== 'undefined' ? window.innerWidth : 1440,
      height: typeof window !== 'undefined' ? Math.max(360, window.innerHeight - 52) : 848,
    };
  }, [workspaceRef]);

  // Keep open/maximized/snapped windows fitted if viewport resizes
  useEffect(() => {
    const handleResize = () => {
      const workspace = getWorkspaceSize();
      setWindows((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const id of SUPER_APP_ORDER) {
          const w = next[id];
          if (!w.isOpen) continue;
          if (w.isMaximized || w.snapPosition !== 'none') {
            const b = calculateSnapBounds(w.isMaximized ? 'maximized' : w.snapPosition, workspace);
            if (b.width !== w.width || b.height !== w.height || b.x !== w.x || b.y !== w.y) {
              next[id] = { ...w, ...b };
              changed = true;
            }
          } else {
            const meta = APP_REGISTRY[id];
            const clamped = clampWindowBounds(
              { x: w.x, y: w.y, width: w.width, height: w.height },
              workspace,
              { width: Math.min(meta.minWidth, workspace.width), height: Math.min(meta.minHeight, workspace.height) }
            );
            if (clamped.x !== w.x || clamped.y !== w.y || clamped.width !== w.width || clamped.height !== w.height) {
              next[id] = { ...w, ...clamped };
              changed = true;
            }
          }
        }
        return changed ? next : prev;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getWorkspaceSize]);

  const syncIsActiveFlags = (
    map: Record<SuperAppId, WindowState>,
    targetActive: SuperAppId | null
  ): Record<SuperAppId, WindowState> => {
    const updated = { ...map };
    for (const id of SUPER_APP_ORDER) {
      updated[id] = { ...updated[id], isActive: id === targetActive && updated[id].isOpen && !updated[id].isMinimized };
    }
    return updated;
  };

  const openWindow = useCallback(
    (appId: SuperAppId, initialTab?: string) => {
      const meta = APP_REGISTRY[appId];
      if (!meta) return;

      const normalizedInitialTab = initialTab ? resolveAppTabAlias(appId, initialTab) : undefined;
      const targetTab =
        normalizedInitialTab && meta.tabs.some((t) => t.id === normalizedInitialTab)
          ? normalizedInitialTab
          : undefined;
      const newZ = ++nextZIndexRef.current;
      const workspace = getWorkspaceSize();

      setWindows((prev) => {
        const current = prev[appId];
        if (current && current.isOpen) {
          const updated: Record<SuperAppId, WindowState> = {
            ...prev,
            [appId]: {
              ...current,
              isMinimized: false,
              zIndex: newZ,
              activeTab: targetTab ?? current.activeTab,
            },
          };
          return syncIsActiveFlags(updated, appId);
        }

        const openCount = (Object.values(prev) as WindowState[]).filter((w) => w.isOpen).length;
        const initialPos = computeCascadePosition(openCount, workspace, {
          width: meta.defaultWidth,
          height: meta.defaultHeight,
        });
        const maxBounds = calculateSnapBounds('maximized', workspace);

        const updated: Record<SuperAppId, WindowState> = {
          ...prev,
          [appId]: {
            ...current,
            isOpen: true,
            isMinimized: false,
            isMaximized: true,
            snapPosition: 'maximized',
            prevBounds: initialPos,
            x: maxBounds.x,
            y: maxBounds.y,
            width: maxBounds.width,
            height: maxBounds.height,
            zIndex: newZ,
            activeTab: targetTab ?? current.activeTab ?? meta.defaultTab,
          },
        };
        return syncIsActiveFlags(updated, appId);
      });

      setActiveWindowId(appId);
    },
    [getWorkspaceSize]
  );

  const setWindowTab = useCallback((appId: SuperAppId, tabId: string) => {
    const normalizedTab = resolveAppTabAlias(appId, tabId);
    setWindows((prev) => {
      const current = prev[appId];
      if (!current || current.activeTab === normalizedTab) return prev;
      return {
        ...prev,
        [appId]: {
          ...current,
          activeTab: normalizedTab,
        },
      };
    });
  }, []);

  const closeWindow = useCallback((appId: SuperAppId) => {
    let nextActive: SuperAppId | null = null;
    setWindows((prev) => {
      const updated: Record<SuperAppId, WindowState> = {
        ...prev,
        [appId]: {
          ...prev[appId],
          isOpen: false,
          isMinimized: false,
          isMaximized: false,
          isActive: false,
          snapPosition: 'none',
        },
      };
      const remaining = (Object.values(updated) as WindowState[])
        .filter((w) => w.isOpen && !w.isMinimized)
        .sort((a, b) => b.zIndex - a.zIndex);
      nextActive = remaining.length > 0 ? remaining[0].appId : null;
      return syncIsActiveFlags(updated, nextActive);
    });
    setActiveWindowId(nextActive);
  }, []);

  const minimizeWindow = useCallback((appId: SuperAppId) => {
    let nextActive: SuperAppId | null = null;
    setWindows((prev) => {
      const updated: Record<SuperAppId, WindowState> = {
        ...prev,
        [appId]: {
          ...prev[appId],
          isMinimized: true,
          isActive: false,
        },
      };
      const remaining = (Object.values(updated) as WindowState[])
        .filter((w) => w.isOpen && !w.isMinimized)
        .sort((a, b) => b.zIndex - a.zIndex);
      nextActive = remaining.length > 0 ? remaining[0].appId : null;
      return syncIsActiveFlags(updated, nextActive);
    });
    setActiveWindowId(nextActive);
  }, []);

  const focusWindow = useCallback((appId: SuperAppId) => {
    const newZ = ++nextZIndexRef.current;
    setWindows((prev) => {
      const current = prev[appId];
      if (!current || !current.isOpen) return prev;
      const updated: Record<SuperAppId, WindowState> = {
        ...prev,
        [appId]: {
          ...current,
          isMinimized: false,
          zIndex: newZ,
        },
      };
      return syncIsActiveFlags(updated, appId);
    });
    setActiveWindowId(appId);
  }, []);

  const toggleMaximize = useCallback(
    (appId: SuperAppId) => {
      const workspace = getWorkspaceSize();
      const newZ = ++nextZIndexRef.current;

      setWindows((prev) => {
        const current = prev[appId];
        if (!current) return prev;

        if (current.isMaximized || current.snapPosition === 'maximized') {
          const meta = APP_REGISTRY[appId];
          const restoreBounds = current.prevBounds || {
            x: 64,
            y: 40,
            width: Math.min(meta.defaultWidth, workspace.width - 40),
            height: Math.min(meta.defaultHeight, workspace.height - 40),
          };
          const clamped = clampWindowBounds(restoreBounds, workspace, {
            width: Math.min(meta.minWidth, workspace.width),
            height: Math.min(meta.minHeight, workspace.height),
          });
          const updated: Record<SuperAppId, WindowState> = {
            ...prev,
            [appId]: {
              ...current,
              isMaximized: false,
              snapPosition: 'none',
              ...clamped,
              zIndex: newZ,
            },
          };
          return syncIsActiveFlags(updated, appId);
        }

        const updated: Record<SuperAppId, WindowState> = {
          ...prev,
          [appId]: {
            ...current,
            isMaximized: true,
            snapPosition: 'maximized',
            prevBounds:
              current.snapPosition === 'none'
                ? { x: current.x, y: current.y, width: current.width, height: current.height }
                : current.prevBounds,
            x: 0,
            y: 0,
            width: workspace.width,
            height: workspace.height,
            zIndex: newZ,
          },
        };
        return syncIsActiveFlags(updated, appId);
      });

      setActiveWindowId(appId);
    },
    [getWorkspaceSize]
  );

  const snapWindow = useCallback(
    (appId: SuperAppId, snap: WindowSnapPosition) => {
      const workspace = getWorkspaceSize();
      const bounds = calculateSnapBounds(snap, workspace);
      const newZ = ++nextZIndexRef.current;

      setWindows((prev) => {
        const current = prev[appId];
        if (!current) return prev;
        const updated: Record<SuperAppId, WindowState> = {
          ...prev,
          [appId]: {
            ...current,
            isOpen: true,
            isMinimized: false,
            isMaximized: snap === 'maximized',
            snapPosition: snap,
            prevBounds:
              current.snapPosition === 'none'
                ? { x: current.x, y: current.y, width: current.width, height: current.height }
                : current.prevBounds,
            ...bounds,
            zIndex: newZ,
          },
        };
        return syncIsActiveFlags(updated, appId);
      });

      setActiveWindowId(appId);
    },
    [getWorkspaceSize]
  );

  const updateWindowBounds = useCallback(
    (appId: SuperAppId, bounds: { x: number; y: number; width: number; height: number }) => {
      const workspace = getWorkspaceSize();
      const meta = APP_REGISTRY[appId];
      const clamped = clampWindowBounds(bounds, workspace, {
        width: Math.min(meta.minWidth, workspace.width),
        height: Math.min(meta.minHeight, workspace.height),
      });

      setWindows((prev) => ({
        ...prev,
        [appId]: {
          ...prev[appId],
          snapPosition: 'none',
          isMaximized: false,
          x: clamped.x,
          y: clamped.y,
          width: clamped.width,
          height: clamped.height,
        },
      }));
    },
    [getWorkspaceSize]
  );

  const minimizeAll = useCallback(() => {
    setWindows((prev) => {
      const updated = { ...prev };
      for (const id of SUPER_APP_ORDER) {
        if (updated[id].isOpen) {
          updated[id] = { ...updated[id], isMinimized: true, isActive: false };
        }
      }
      return updated;
    });
    setActiveWindowId(null);
  }, []);

  const closeAllWindows = useCallback(() => {
    setWindows((prev) => {
      const updated = { ...prev };
      for (const id of SUPER_APP_ORDER) {
        const meta = APP_REGISTRY[id];
        updated[id] = {
          ...updated[id],
          isOpen: false,
          isMinimized: false,
          isMaximized: false,
          isActive: false,
          snapPosition: 'none',
          activeTab: meta.defaultTab,
        };
      }
      return updated;
    });
    setActiveWindowId(null);
    setSnapPreview(null);
  }, []);

  const restoreAll = useCallback(() => {
    let topId: SuperAppId | null = null;
    let maxZ = -1;
    setWindows((prev) => {
      const updated = { ...prev };
      for (const id of SUPER_APP_ORDER) {
        if (updated[id].isOpen) {
          updated[id] = { ...updated[id], isMinimized: false };
          if (updated[id].zIndex > maxZ) {
            maxZ = updated[id].zIndex;
            topId = id;
          }
        }
      }
      return syncIsActiveFlags(updated, topId);
    });
    setActiveWindowId(topId);
  }, []);

  const checkSnapPreview = useCallback(
    (clientX: number, clientY: number) => {
      const rect = workspaceRef.current?.getBoundingClientRect();
      const workspace = getWorkspaceSize();
      const localCursor = rect
        ? { x: clientX - rect.left, y: clientY - rect.top }
        : { x: clientX, y: clientY };

      const detected = detectSnapZone(localCursor, workspace, 28);
      if (detected === 'none') {
        setSnapPreview(null);
      } else {
        const bounds = calculateSnapBounds(detected, workspace);
        setSnapPreview({ ...bounds, position: detected });
      }
    },
    [getWorkspaceSize, workspaceRef]
  );

  const clearSnapPreview = useCallback(() => {
    setSnapPreview(null);
  }, []);

  return {
    windows,
    activeWindowId,
    snapPreview,
    openWindow,
    setWindowTab,
    closeWindow,
    minimizeWindow,
    toggleMaximize,
    focusWindow,
    snapWindow,
    updateWindowBounds,
    minimizeAll,
    restoreAll,
    closeAllWindows,
    checkSnapPreview,
    clearSnapPreview,
  };
}
