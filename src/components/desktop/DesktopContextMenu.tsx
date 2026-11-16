import React, { useEffect, useRef } from 'react';
import { Play, Pin, PinOff, X, Minus } from 'lucide-react';
import { SuperAppId } from '../../types';
import { APP_REGISTRY } from '../../data/appRegistry';

export interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  appId: SuperAppId | null;
}

interface DesktopContextMenuProps {
  state: ContextMenuState;
  isPinned: boolean;
  isRunning: boolean;
  onClose: () => void;
  onOpenApp: (appId: SuperAppId) => void;
  onTogglePin: (appId: SuperAppId) => void;
  onCloseApp?: (appId: SuperAppId) => void;
  onMinimizeApp?: (appId: SuperAppId) => void;
}

export const DesktopContextMenu: React.FC<DesktopContextMenuProps> = ({
  state,
  isPinned,
  isRunning,
  onClose,
  onOpenApp,
  onTogglePin,
  onCloseApp,
  onMinimizeApp,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (state.isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [state.isOpen, onClose]);

  if (!state.isOpen || !state.appId) return null;
  const meta = APP_REGISTRY[state.appId];
  if (!meta) return null;
  const AppIcon = meta.icon;

  const menuWidth = 224;
  const menuHeight = 200;
  const clampedX = Math.min(state.x, window.innerWidth - menuWidth - 12);
  const clampedY = Math.min(state.y, window.innerHeight - menuHeight - 60);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: `${clampedX}px`,
        top: `${clampedY}px`,
        zIndex: 99999,
      }}
      className="w-56 p-1.5 rounded-2xl win11-acrylic text-slate-800 dark:text-slate-100 text-xs select-none"
    >
      <div className="flex items-center gap-2.5 px-2.5 py-2 border-b border-slate-200/60 dark:border-slate-700/60 mb-1">
        <AppIcon className="w-6 h-6 shrink-0" />
        <div className="flex flex-col min-w-0">
          <span className="font-bold truncate">{meta.title}</span>
          <span className="text-[10px] text-slate-400 truncate">{meta.tabs.length} tính năng</span>
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => {
            onOpenApp(state.appId!);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left font-medium hover:bg-sky-500/10 hover:text-sky-600 dark:hover:text-sky-400 transition-colors cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 text-sky-500" />
          <span>Mở cửa sổ</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onTogglePin(state.appId!);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left font-medium hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {isPinned ? (
            <>
              <PinOff className="w-3.5 h-3.5 text-amber-500" />
              <span>Bỏ ghim Taskbar</span>
            </>
          ) : (
            <>
              <Pin className="w-3.5 h-3.5 text-sky-500" />
              <span>Ghim vào Taskbar</span>
            </>
          )}
        </button>

        {isRunning && onMinimizeApp && (
          <button
            type="button"
            onClick={() => {
              onMinimizeApp(state.appId!);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left font-medium hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5 text-slate-500" />
            <span>Thu nhỏ</span>
          </button>
        )}

        {isRunning && onCloseApp && (
          <button
            type="button"
            onClick={() => {
              onCloseApp(state.appId!);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left font-medium hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Đóng cửa sổ</span>
          </button>
        )}
      </div>
    </div>
  );
};
