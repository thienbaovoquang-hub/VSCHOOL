import React, { useRef, useState } from 'react';
import { Search, Power, Shield, LogIn, Settings, Lock } from '../icons/UiIcons';
import { PermissionMatrix, SuperAppId, SystemBrandingConfig, UserProfile } from '../../types';
import { APP_REGISTRY, SUPER_APP_ORDER } from '../../data/appRegistry';
import { DEFAULT_BRAND_NAME, normalizeBrandName } from '../../utils/branding';
import {
  signOutGoogleAccount,
  signInWithGoogleAccount,
} from '../../services/googleAuth';
import { classifyGooglePopupError } from '../../utils/googleAuthHelpers';
import {
  canAccessSuperApp,
  DEFAULT_PERMISSIONS,
  formatUserRolesLabel,
  userHasRole,
} from '../../utils/rbac';

interface StartMenuProps {
  currentUser: UserProfile;
  branding?: SystemBrandingConfig;
  customPermissions?: PermissionMatrix;
  isOpen: boolean;
  onClose: () => void;
  onOpenApp: (appId: SuperAppId, tabId?: string) => void;
  onBeforeAccountChange?: () => void;
}

export const StartMenu: React.FC<StartMenuProps> = ({
  currentUser,
  branding,
  customPermissions = DEFAULT_PERMISSIONS,
  isOpen,
  onClose,
  onOpenApp,
  onBeforeAccountChange,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [accountActionError, setAccountActionError] = useState<string | null>(null);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);
  const switchingRef = useRef(false);

  if (!isOpen) return null;

  const allApps = SUPER_APP_ORDER.map((id) => APP_REGISTRY[id]);
  const filteredApps = allApps.filter(
    (app) =>
      app.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.tabs.some((t) => t.label.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSwitchGoogleAccount = async () => {
    if (switchingRef.current) return;
    switchingRef.current = true;
    setAccountActionError(null);
    setIsSwitchingAccount(true);
    try {
      await signInWithGoogleAccount();
      onBeforeAccountChange?.();
      setShowAccountMenu(false);
      onClose();
    } catch (err) {
      const classified = classifyGooglePopupError(err);
      setAccountActionError(
        classified.isCancellation
          ? 'Đã hủy chọn tài khoản Google.'
          : classified.message
      );
    } finally {
      switchingRef.current = false;
      setIsSwitchingAccount(false);
    }
  };

  const handleSignOut = async () => {
    setAccountActionError(null);
    setIsSwitchingAccount(true);
    try {
      onBeforeAccountChange?.();
      await signOutGoogleAccount();
      setShowAccountMenu(false);
      onClose();
    } catch (err) {
      console.error('Sign Out error:', err);
      setAccountActionError('Không thể đăng xuất. Vui lòng thử lại.');
    } finally {
      setIsSwitchingAccount(false);
    }
  };

  const roleLabel = formatUserRolesLabel(currentUser);
  const brandName = normalizeBrandName(branding?.appName || DEFAULT_BRAND_NAME);

  return (
    <div
      role="dialog"
      aria-label="Start Menu"
      data-testid="start-menu"
      className="fixed top-[74px] sm:top-[78px] left-3 sm:left-5 z-50 w-[480px] max-w-[calc(100vw-24px)] max-h-[calc(100dvh-92px)] overflow-y-auto rounded-[26px] win11-acrylic p-5 flex flex-col gap-4 select-none"
    >
      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Tìm ứng dụng hoặc tính năng..."
          className="w-full h-10 pl-10 pr-4 rounded-2xl glass-subsurface text-xs text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
          autoFocus
        />
      </div>

      {/* Pinned Super Apps */}
      <div>
        <div className="flex items-center justify-between mb-2.5 px-1">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
            {searchTerm ? 'Kết quả' : `${SUPER_APP_ORDER.length} Ứng dụng ${brandName}`}
          </span>
          <span className="text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400">
            {filteredApps.length} ứng dụng
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {filteredApps.map((app) => {
            const IconComp = app.icon;
            const allowed = canAccessSuperApp(currentUser, app.id, customPermissions);

            return (
              <button
                key={app.id}
                type="button"
                data-testid={`start-app-${app.id}`}
                onClick={() => {
                  onOpenApp(app.id);
                  onClose();
                }}
                className={`relative p-2.5 rounded-2xl border border-transparent hover:border-white/70 dark:hover:border-white/15 hover:bg-white/55 dark:hover:bg-slate-800/55 transition-all flex flex-col items-center text-center gap-1.5 group cursor-pointer ${
                  !allowed ? 'opacity-55' : ''
                }`}
              >
                <div className="relative">
                  <IconComp className="w-12 h-12 group-hover:scale-105 transition-transform" />
                  {!allowed && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-900/90 text-white border border-white/25 flex items-center justify-center">
                      <Lock className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 line-clamp-2 leading-tight">
                  {app.shortTitle}
                </span>
              </button>
            );
          })}
        </div>

        {filteredApps.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            Không tìm thấy ứng dụng phù hợp
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {!searchTerm && (
        <div className="pt-3 border-t border-slate-900/10 dark:border-white/10 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              onOpenApp('library', 'circulation');
              onClose();
            }}
            className="px-3 py-2.5 rounded-xl glass-subsurface hover:bg-white/70 dark:hover:bg-slate-800/70 text-left transition-all cursor-pointer"
          >
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Quầy Mượn RFID &amp; Barcode</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Quét thẻ &amp; cấp phiếu mượn nhanh</p>
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenApp('ai-assistant', 'chat');
              onClose();
            }}
            className="px-3 py-2.5 rounded-xl glass-subsurface hover:bg-white/70 dark:hover:bg-slate-800/70 text-left transition-all cursor-pointer"
          >
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Trợ lý {brandName} AI</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Hỏi đáp &amp; hướng dẫn học đường</p>
          </button>
        </div>
      )}

      {/* Authenticated Account Footer */}
      <div className="pt-3 border-t border-slate-900/10 dark:border-white/10 flex items-center justify-between relative">
        <button
          type="button"
          data-testid="start-account-menu-btn"
          onClick={() => setShowAccountMenu((prev) => !prev)}
          className="flex items-center gap-2.5 p-1.5 pr-3 rounded-2xl hover:bg-white/55 dark:hover:bg-slate-800/55 transition-colors text-left cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-white/40">
            {currentUser.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt={currentUser.displayName} className="w-full h-full object-cover" />
            ) : currentUser.displayName ? (
              currentUser.displayName.charAt(0).toUpperCase()
            ) : (
              'U'
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 dark:text-slate-50 truncate max-w-[190px]">
              {currentUser.displayName}
            </p>
            <p className="text-[10px] text-slate-600 dark:text-slate-300 flex items-center gap-1 truncate">
              <Shield className="w-2.5 h-2.5 text-sky-500 shrink-0" />
              <span>{roleLabel}</span>
            </p>
          </div>
        </button>

        {showAccountMenu && (
          <div className="absolute bottom-13 left-0 z-50 p-3.5 rounded-2xl deep-glass w-72 space-y-2.5">
            <div className="px-1">
              <p className="text-xs font-bold text-slate-900 dark:text-slate-50 truncate">
                {currentUser.displayName}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                {currentUser.email}
              </p>
              <p className="text-[10px] text-sky-700 dark:text-sky-300 mt-0.5 font-semibold">
                {roleLabel}
              </p>
            </div>
            {accountActionError && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 px-1 leading-snug">
                {accountActionError}
              </p>
            )}
            <button
              type="button"
              onClick={handleSwitchGoogleAccount}
              disabled={isSwitchingAccount}
              className="w-full py-2 px-3 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 text-sky-700 dark:text-sky-300 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60 transition-colors cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{isSwitchingAccount ? 'Đang chuyển tài khoản...' : 'Đổi tài khoản Google'}</span>
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          {userHasRole(currentUser, ['admin', 'principal']) && (
            <button
              type="button"
              onClick={() => {
                onOpenApp('admin', 'settings');
                onClose();
              }}
              aria-label="Cài đặt hệ thống"
              title="Cài đặt hệ thống"
              className="w-9 h-9 rounded-xl ui-icon-chip flex items-center justify-center transition-all cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            data-testid="start-signout-btn"
            onClick={handleSignOut}
            disabled={isSwitchingAccount}
            aria-label="Đăng xuất"
            title="Đăng xuất"
            className="w-9 h-9 rounded-xl ui-icon-chip hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center disabled:opacity-60 transition-all cursor-pointer"
          >
            <Power className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
