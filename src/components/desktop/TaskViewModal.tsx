import React, { useEffect } from 'react';
import { X, Layers, Maximize2 } from 'lucide-react';
import { SuperAppId } from '../../types';
import { WindowState } from '../../types/window';
import { APP_REGISTRY, SUPER_APP_ORDER } from '../../data/appRegistry';

interface TaskViewModalProps {
  isOpen: boolean;
  windows: Record<SuperAppId, WindowState>;
  onClose: () => void;
  onFocusWindow: (appId: SuperAppId) => void;
  onCloseWindow: (appId: SuperAppId) => void;
}

export const TaskViewModal: React.FC<TaskViewModalProps> = ({
  isOpen,
  windows,
  onClose,
  onFocusWindow,
  onCloseWindow,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const openWindows = SUPER_APP_ORDER.map((id) => windows[id]).filter((w) => w && w.isOpen);

  return (
    <div
      data-testid="task-view-modal"
      onClick={onClose}
      className="fixed inset-0 z-[99990] bg-slate-900/45 backdrop-blur-2xl flex flex-col items-center justify-center p-6 select-none"
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-5xl flex flex-col gap-5">
        <div className="flex items-center justify-between text-white border-b border-white/20 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/15">
              <Layers className="w-5 h-5 text-sky-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Task View</h2>
              <p className="text-xs text-sky-100/80">
                {openWindows.length > 0
                  ? `${openWindows.length} cửa sổ đang mở`
                  : 'Chưa có cửa sổ nào đang mở'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng Task View"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {openWindows.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center text-white/80">
            <Layers className="w-10 h-10 text-sky-300 mb-3" />
            <p className="text-sm font-semibold">Không gian làm việc đang trống</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-h-[65vh] overflow-y-auto p-1">
            {openWindows.map((win) => {
              const meta = APP_REGISTRY[win.appId];
              const AppIcon = meta.icon;
              const activeTabMeta = meta.tabs.find((t) => t.id === win.activeTab);

              return (
                <div
                  key={win.windowId}
                  className="group rounded-2xl win11-acrylic p-4 shadow-xl hover:scale-[1.02] transition-transform flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onFocusWindow(win.appId);
                        onClose();
                      }}
                      className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer flex-1"
                    >
                      <AppIcon className="w-7 h-7 shrink-0" />
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                        {meta.title}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onCloseWindow(win.appId)}
                      aria-label={`Đóng ${meta.title}`}
                      className="p-1 rounded-lg hover:bg-rose-500 hover:text-white text-slate-400 cursor-pointer shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onFocusWindow(win.appId);
                      onClose();
                    }}
                    className="h-24 w-full text-left rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 p-3 flex flex-col justify-between cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-[11px] w-full">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        Tab: {activeTabMeta?.label || meta.shortTitle}
                      </span>
                      {win.isMinimized && (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
                          Thu nhỏ
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-sky-600 dark:text-sky-400 font-semibold w-full">
                      <span className="font-mono-tabular text-slate-400">
                        {win.width}×{win.height}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        Chuyển tới <Maximize2 className="w-3 h-3" />
                      </span>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
