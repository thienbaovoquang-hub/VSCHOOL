import React from 'react';
import { Sun, Moon, Minimize2, Maximize2, Shield, Settings, Image as ImageIcon, CloudSun, X } from '../icons/UiIcons';
import { SuperAppId, UserProfile } from '../../types';
import { ROLE_DEFINITIONS, userHasRole } from '../../utils/rbac';

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
      className="fixed top-[74px] sm:top-[78px] right-3 sm:right-5 z-50 w-[308px] rounded-[24px] win11-acrylic p-4 flex flex-col gap-3 select-none"
    >
      <div className="flex items-center justify-between pb-2 border-b border-slate-900/10 dark:border-white/10">
        <span className="text-xs font-bold text-slate-900 dark:text-slate-50">
          Cài đặt nhanh
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng cài đặt nhanh"
          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          data-testid="toggle-dark-mode"
          onClick={onToggleDarkMode}
          className={`p-3 rounded-2xl border flex flex-col items-start gap-2 transition-all cursor-pointer ${
            darkMode
              ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
              : 'glass-subsurface text-slate-800 hover:bg-white/75'
          }`}
        >
          {darkMode ? <Moon className="w-4 h-4 text-sky-300" /> : <Sun className="w-4 h-4 text-amber-500" />}
          <span className="text-xs font-semibold whitespace-nowrap">
            {darkMode ? 'Giao diện tối' : 'Giao diện sáng'}
          </span>
        </button>

        <button
          type="button"
          data-testid="toggle-compact-mode"
          onClick={onToggleCompactMode}
          className={`p-3 rounded-2xl border flex flex-col items-start gap-2 transition-all cursor-pointer ${
            compactMode
              ? 'bg-sky-500/20 border-sky-400/50 text-sky-800 dark:text-sky-200'
              : 'glass-subsurface text-slate-800 dark:text-slate-100 hover:bg-white/75 dark:hover:bg-slate-800/75'
          }`}
        >
          {compactMode ? <Minimize2 className="w-4 h-4 text-sky-500" /> : <Maximize2 className="w-4 h-4" />}
          <span className="text-xs font-semibold whitespace-nowrap">
            {compactMode ? 'Mật độ gọn' : 'Tiêu chuẩn'}
          </span>
        </button>
      </div>

      <div className="p-3 rounded-2xl glass-subsurface flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-900 dark:text-slate-50 truncate">
            {currentUser.displayName}
          </p>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate flex items-center gap-1 mt-0.5">
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
          className="px-2.5 py-1.5 rounded-xl bg-sky-500/15 border border-sky-400/30 text-sky-700 dark:text-sky-300 text-[11px] font-semibold hover:bg-sky-500/25 transition-colors shrink-0 cursor-pointer whitespace-nowrap"
        >
          Tài khoản
        </button>
      </div>

      {userHasRole(currentUser, ['admin', 'principal']) && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            data-testid="quick-open-wallpaper-settings"
            onClick={() => {
              onOpenSystemSettings('admin', 'settings');
              onClose();
            }}
            className="py-2 px-2.5 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-slate-800/75 text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap"
          >
            <span className="w-6 h-6 rounded-lg ui-icon-chip flex items-center justify-center shrink-0">
              <ImageIcon className="w-3.5 h-3.5" />
            </span>
            <span>Hình nền web</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenSystemSettings('admin', 'settings');
              onClose();
            }}
            className="py-2 px-2.5 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-slate-800/75 text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap"
          >
            <span className="w-6 h-6 rounded-lg ui-icon-chip flex items-center justify-center shrink-0">
              <Settings className="w-3.5 h-3.5" />
            </span>
            <span>Cài đặt</span>
          </button>
          <button
            type="button"
            data-testid="quick-open-weather-settings"
            onClick={() => {
              onOpenSystemSettings('admin', 'settings');
              onClose();
            }}
            className="col-span-2 py-2 px-2.5 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-slate-800/75 text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap"
          >
            <span className="w-6 h-6 rounded-lg ui-icon-chip flex items-center justify-center shrink-0">
              <CloudSun className="w-3.5 h-3.5" />
            </span>
            <span>Đổi link thời tiết</span>
          </button>
        </div>
      )}
    </div>
  );
};
