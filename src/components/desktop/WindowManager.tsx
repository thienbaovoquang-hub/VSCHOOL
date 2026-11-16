import React from 'react';
import { SuperAppId } from '../../types';
import { WindowState, WindowSnapPosition, SnapPreviewZone } from '../../types/window';
import { SUPER_APP_ORDER } from '../../data/appRegistry';
import { AppWindow } from './AppWindow';

interface WindowManagerProps {
  windows: Record<SuperAppId, WindowState>;
  activeWindowId: SuperAppId | null;
  snapPreview: SnapPreviewZone | null;
  onFocusWindow: (appId: SuperAppId) => void;
  onCloseWindow: (appId: SuperAppId) => void;
  onMinimizeWindow: (appId: SuperAppId) => void;
  onToggleMaximize: (appId: SuperAppId) => void;
  onSnapWindow: (appId: SuperAppId, snap: WindowSnapPosition) => void;
  onUpdateBounds: (appId: SuperAppId, bounds: { x: number; y: number; width: number; height: number }) => void;
  onCheckSnapPreview: (clientX: number, clientY: number) => void;
  onClearSnapPreview: () => void;
  renderAppContent: (appId: SuperAppId, activeTab: string) => React.ReactNode;
}

export const WindowManager: React.FC<WindowManagerProps> = ({
  windows,
  activeWindowId,
  snapPreview,
  onFocusWindow,
  onCloseWindow,
  onMinimizeWindow,
  onToggleMaximize,
  onSnapWindow,
  onUpdateBounds,
  onCheckSnapPreview,
  onClearSnapPreview,
  renderAppContent,
}) => {
  const openWindows = SUPER_APP_ORDER.map((id) => windows[id]).filter((w) => w && w.isOpen);

  return (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
      {/* Snap Preview Overlay */}
      {snapPreview && (
        <div
          style={{
            left: `${snapPreview.x + 6}px`,
            top: `${snapPreview.y + 6}px`,
            width: `${Math.max(0, snapPreview.width - 12)}px`,
            height: `${Math.max(0, snapPreview.height - 12)}px`,
          }}
          className="absolute rounded-2xl win11-snap-preview z-[9990]"
        />
      )}

      {/* Open App Windows */}
      {openWindows.map((win) => (
        <div key={win.windowId} className="pointer-events-auto">
          <AppWindow
            windowState={win}
            isActive={activeWindowId === win.appId}
            onFocus={() => onFocusWindow(win.appId)}
            onClose={() => onCloseWindow(win.appId)}
            onMinimize={() => onMinimizeWindow(win.appId)}
            onToggleMaximize={() => onToggleMaximize(win.appId)}
            onSnap={(snap) => onSnapWindow(win.appId, snap)}
            onUpdateBounds={(bounds) => onUpdateBounds(win.appId, bounds)}
            onDragMove={(cx, cy) => onCheckSnapPreview(cx, cy)}
            onDragEnd={() => {
              if (snapPreview && snapPreview.position !== 'none') {
                onSnapWindow(win.appId, snapPreview.position);
              }
              onClearSnapPreview();
            }}
          >
            {renderAppContent(win.appId, win.activeTab)}
          </AppWindow>
        </div>
      ))}
    </div>
  );
};
