import React from 'react';
import { Sun, Moon, Minimize2, Maximize2, Shield, Settings, X } from 'lucide-react';
import { SuperAppId, UserProfile } from '../../types';
import { ROLE_DEFINITIONS } from '../../utils/rbac';

interface QuickSettingsPopoverProps {
  isOpen: boolean;
  darkMode: boolean;
  compactMode: boolean;
  currentUser: UserProfile;
  onToggleDarkMode: () => void;
  onToggleCompactMode: () => void;
  onOpenStartRoles: () => void;
  onOpenSystemSettings: (appId: SuperAppId, tabId: string) => void;
  onClose: () => void;
}

export const QuickSettingsPopover: React.FC<QuickSettingsPopoverProps> = ({
  isOpen,
  darkMode,
  compactMode,
  currentUser,
  onToggleDarkMode,
  onToggleCompactMode,
  onOpenStartRoles,
  onOpenSystemSettings,
  onClose,
}) => {
  if (!isOpen) return null;

  const roleLabel = ROLE_DEFINITIONS[currentUser.role]?.label || currentUser.role || 'Thành viên';

  return (
    <div
      role="dialog"
      aria-label="Cài đặt nhanh"
      data-testid="quick-settings"
      className="fixed bottom-15 right-3 z-50 w-[300px] rounded-3xl win11-acrylic p-4 flex flex-col gap-3 select-none"
    >
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 dark:border-slate-700/70">
        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
          Cài đặt nhanh
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng cài đặt nhanh"
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          data-testid="toggle-dark-mode"
          onClick={onToggleDarkMode}
          className={`p-3 rounded-2xl border flex flex-col items-start gap-2 transition-colors cursor-pointer ${
            darkMode
              ? 'bg-sky-500/20 border-sky-400/50 text-sky-300'
              : 'bg-white/75 border-slate-200/70 text-slate-700 hover:bg-white'
          }`}
        >
          {darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-500" />}
          <span className="text-xs font-semibold">{darkMode ? 'Giao diện tối' : 'Giao diện sáng'}</span>
        </button>

        <button
          type="button"
          data-testid="toggle-compact-mode"
          onClick={onToggleCompactMode}
          className={`p-3 rounded-2xl border flex flex-col items-start gap-2 transition-colors cursor-pointer ${
            compactMode
              ? 'bg-sky-500/20 border-sky-400/50 text-sky-700 dark:text-sky-300'
              : 'bg-white/75 dark:bg-slate-800/70 border-slate-200/70 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800'
          }`}
        >
          {compactMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          <span className="text-xs font-semibold">{compactMode ? 'Mật độ gọn' : 'Tiêu chuẩn'}</span>
        </button>
      </div>

      <div className="p-3 rounded-2xl bg-white/60 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
            {currentUser.displayName}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
            <Shield className="w-3 h-3 text-sky-500 shrink-0" />
            {roleLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenStartRoles();
          }}
          className="px-2.5 py-1.5 rounded-xl bg-sky-500/12 text-sky-600 dark:text-sky-400 text-[11px] font-semibold hover:bg-sky-500/20 shrink-0 cursor-pointer"
        >
          Tài khoản
        </button>
      </div>

      {(currentUser.role === 'admin' || currentUser.role === 'principal') && (
        <button
          type="button"
          onClick={() => {
            onOpenSystemSettings('admin', 'settings');
            onClose();
          }}
          className="w-full py-2 px-3 rounded-xl bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 border border-slate-200/60 dark:border-slate-700/60 cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Cài đặt hệ thống</span>
        </button>
      )}
    </div>
  );
};
