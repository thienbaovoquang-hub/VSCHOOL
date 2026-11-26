import React from 'react';
import { Bell, CheckCheck, ArrowRight, X } from '../icons/UiIcons';
import { NotificationItem, SuperAppId } from '../../types';

interface NotificationCenterProps {
  isOpen: boolean;
  notifications: NotificationItem[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onOpenTarget: (appId: SuperAppId, tabId?: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  notifications,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onOpenTarget,
}) => {
  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div
      role="dialog"
      aria-label="Trung tâm thông báo"
      data-testid="notification-center"
      className="fixed top-[74px] sm:top-[78px] right-3 sm:right-5 z-50 w-[348px] max-w-[calc(100vw-24px)] rounded-[24px] win11-acrylic p-4 flex flex-col gap-3 select-none"
    >
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-900/10 dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[10px] ui-icon-chip flex items-center justify-center">
            <Bell className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-slate-900 dark:text-slate-50 font-mono-tabular">
            Thông báo ({unreadCount})
          </span>
        </div>

        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="text-[11px] font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/15 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Đã đọc</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng thông báo"
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-h-76 overflow-y-auto space-y-2 pr-0.5">
        {notifications.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
            Chưa có thông báo mới.
          </div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                onMarkRead(n.id);
                onOpenTarget(n.appId, n.tabId);
                onClose();
              }}
              className={`w-full text-left p-3 rounded-2xl transition-all cursor-pointer group ${
                n.read
                  ? 'glass-subsurface opacity-70 hover:opacity-100'
                  : 'glass-subsurface border-sky-400/50 dark:border-sky-400/35 bg-white/65 dark:bg-sky-950/30'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-50 line-clamp-1">
                  {n.title}
                </p>
                <span className="text-[10px] font-mono-tabular text-slate-500 dark:text-slate-400 shrink-0">
                  {n.time}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5 leading-relaxed">
                {n.message}
              </p>
              <div className="mt-1.5 flex items-center justify-end text-[10px] font-semibold text-sky-700 dark:text-sky-300 opacity-0 group-hover:opacity-100 transition-opacity">
                <span>Mở ứng dụng</span>
                <ArrowRight className="w-3 h-3 ml-0.5" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
