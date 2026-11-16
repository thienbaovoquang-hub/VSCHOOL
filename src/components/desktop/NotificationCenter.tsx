import React from 'react';
import { Bell, CheckCheck, ArrowRight, X } from 'lucide-react';
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
      className="fixed bottom-15 right-3 z-50 w-[340px] max-w-[calc(100vw-24px)] rounded-3xl win11-acrylic p-4 flex flex-col gap-3 select-none"
    >
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 dark:border-slate-700/70">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-sky-500" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
            Thông báo ({unreadCount})
          </span>
        </div>

        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 px-2 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Đã đọc</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng thông báo"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto space-y-2 pr-0.5">
        {notifications.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
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
              className={`w-full text-left p-2.5 rounded-2xl border transition-colors cursor-pointer group ${
                n.read
                  ? 'bg-white/40 dark:bg-slate-800/40 border-transparent opacity-75'
                  : 'bg-white/85 dark:bg-slate-800/85 border-sky-200/70 dark:border-sky-800/50 shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-1">
                  {n.title}
                </p>
                <span className="text-[10px] text-slate-400 shrink-0">{n.time}</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                {n.message}
              </p>
              <div className="mt-1 flex items-center justify-end text-[10px] font-semibold text-sky-600 dark:text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity">
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
