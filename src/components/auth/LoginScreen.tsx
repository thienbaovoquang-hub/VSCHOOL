import React, { useEffect, useRef, useState } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Lock,
  LogOut,
  Layers,
  Cloud,
  Bot,
  Sun,
  Moon,
} from '../icons/UiIcons';
import { signInWithGoogleAccount, signOutGoogleAccount } from '../../services/googleAuth';
import { classifyGooglePopupError } from '../../utils/googleAuthHelpers';
import type { SystemBrandingConfig, SystemWallpaperConfig } from '../../types';
import { SystemBrandMark } from '../common/SystemBrandMark';
import { WebWallpaperBackdrop } from '../common/WebWallpaperBackdrop';
import { readCachedSystemBranding } from '../../utils/branding';
import { readCachedSystemWallpaper } from '../../utils/wallpaper';

interface LoginScreenProps {
  branding?: SystemBrandingConfig;
  wallpaper?: SystemWallpaperConfig;
  authError?: string | null;
  lockedAccountEmail?: string | null;
  signedInEmail?: string | null;
  isRetrying?: boolean;
  onRetrySignedInSession?: () => void;
  onSignOutAndSwitch?: () => Promise<void> | void;
}

const HIGHLIGHTS = [
  {
    icon: Layers,
    title: '01. Không gian đa cửa sổ',
    description: 'Vận hành song song quản trị, lịch học, thư viện số và bảng thi đua trên cùng một màn hình.',
  },
  {
    icon: Cloud,
    title: '02. Đồng bộ Cloud Firestore',
    description: 'Hồ sơ học sinh, nhân sự và phân quyền RBAC cập nhật tức thì trên mọi thiết bị.',
  },
  {
    icon: Bot,
    title: '03. Trợ lý AI tích hợp theo môn',
    description: 'Giải bài từng bước, đọc ảnh đề bài và gợi ý học tập cho Tiếng Anh, Toán, Lý, Hóa, Văn, Sử, Địa.',
  },
];

export const LoginScreen: React.FC<LoginScreenProps> = ({
  branding,
  wallpaper,
  authError,
  lockedAccountEmail,
  signedInEmail,
  isRetrying = false,
  onRetrySignedInSession,
  onSignOutAndSwitch,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [devAdminMode, setDevAdminMode] = useState<boolean>(true);
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  const signingInRef = useRef(false);

  useEffect(() => {
    let active = true;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 3500) : null;
    fetch('/api/system/auth-mode', {
      cache: 'no-store',
      ...(controller ? { signal: controller.signal } : {}),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { developmentAdminMode?: boolean } | null) => {
        if (active && typeof data?.developmentAdminMode === 'boolean') {
          setDevAdminMode(data.developmentAdminMode);
        }
      })
      .catch(() => {
        // Keep safe dev default indicator
      })
      .finally(() => {
        if (timer !== null) clearTimeout(timer);
      });
    return () => {
      active = false;
      if (timer !== null) clearTimeout(timer);
      controller?.abort();
    };
  }, []);

  const handleToggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('schoolhub_dark_mode', String(next));
    } catch {
      // Ignore storage failure
    }
  };

  const handleGoogleSignIn = async () => {
    if (signingInRef.current) return;
    signingInRef.current = true;
    setLocalError(null);
    setIsLoading(true);
    try {
      await signInWithGoogleAccount();
    } catch (err: unknown) {
      const classified = classifyGooglePopupError(err);
      setLocalError(classified.message);
    } finally {
      signingInRef.current = false;
      setIsLoading(false);
    }
  };

  const handleSwitchAccount = async () => {
    setLocalError(null);
    setIsLoading(true);
    try {
      if (onSignOutAndSwitch) {
        await onSignOutAndSwitch();
      } else {
        await signOutGoogleAccount();
      }
    } catch {
      // Ignore sign-out errors
    } finally {
      setIsLoading(false);
    }
  };

  const effectiveError = localError || authError;
  const busy = isLoading || isRetrying;
  const resolvedBranding = branding || readCachedSystemBranding();
  const resolvedWallpaper = wallpaper || readCachedSystemWallpaper();

  return (
    <div
      data-testid="login-screen"
      className="min-h-screen w-full relative overflow-y-auto overflow-x-hidden flex items-center justify-center p-4 sm:p-6 lg:p-10"
    >
      {/* Layered Atmospheric Glass / Custom Web Wallpaper Backdrop */}
      <WebWallpaperBackdrop wallpaper={resolvedWallpaper} />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-[14%] right-[12%] w-52 h-52 rounded-full border border-white/55 dark:border-white/12 bg-white/18 dark:bg-white/5 backdrop-blur-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)] hidden lg:block"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed bottom-[12%] left-[10%] w-40 h-40 rounded-full border border-white/50 dark:border-white/10 bg-sky-200/20 dark:bg-sky-400/10 backdrop-blur-sm hidden lg:block"
      />

      {/* Main Frosted Glass Portal Container */}
      <div className="relative z-10 w-full max-w-5xl rounded-[32px] win11-acrylic overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Specular top catchlight */}
        <div className="pointer-events-none absolute top-0 inset-x-0 h-px bg-white/80 dark:bg-white/20 z-20" />

        {/* Left Column: Architectural Glass Overview */}
        <section className="order-2 lg:order-1 lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-between gap-6 border-t lg:border-t-0 lg:border-r border-white/55 dark:border-white/12 bg-white/45 dark:bg-slate-900/50">
          <div className="space-y-5">
            <div className="hidden lg:flex items-center justify-between gap-4">
              <SystemBrandMark
                branding={resolvedBranding}
                size="hero"
                subtitle="Hệ điều hành Quản trị Trường học"
                showSubtitle
              />
            </div>

            <div className="space-y-2.5 max-w-xl">
              <h1 className="text-xl sm:text-3xl lg:text-[34px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.18] [text-wrap:balance]">
                Không gian quản trị &amp; học tập đồng bộ thời gian thực
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Quản lý học sinh, thời khóa biểu, thư viện số, thi đua và không gian tự học 7 môn tích hợp AI trên một nền tảng kính mờ thống nhất.
              </p>
            </div>

            {/* Clean Hairline Feature List (no nested box clutter) */}
            <div className="divide-y divide-slate-900/8 dark:divide-white/10 border-t border-slate-900/8 dark:border-white/10">
              {HIGHLIGHTS.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="py-3.5 flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-[14px] ui-icon-chip flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-[18px] h-[18px]" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-100">
                        {item.title}
                      </h2>
                      <p className="text-xs text-slate-600 dark:text-slate-300/90 mt-0.5 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Cloud Firestore Realtime</span>
            <span aria-hidden="true">·</span>
            <span>Phân quyền RBAC</span>
            <span aria-hidden="true">·</span>
            <span>Hỗ trợ đa vai trò</span>
          </div>
        </section>

        {/* Right Column: Elevated Frosted Auth Panel */}
        <section className="order-1 lg:order-2 lg:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-center gap-5 bg-white/35 dark:bg-slate-950/35">
          {/* Mobile Brand Header (above-the-fold on phones) */}
          <div className="flex lg:hidden items-center justify-between gap-3 pb-4 border-b border-slate-900/8 dark:border-white/10">
            <SystemBrandMark
              branding={resolvedBranding}
              size="sm"
              subtitle="Hệ điều hành Trường học"
              showSubtitle
            />
            <button
              type="button"
              data-testid="login-theme-toggle-mobile"
              onClick={handleToggleTheme}
              aria-label={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
              title={isDark ? 'Giao diện sáng' : 'Giao diện tối'}
              className="w-10 h-10 rounded-[14px] ui-icon-chip flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">
                Cổng xác thực nội bộ
              </p>
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-0.5">
                Đăng nhập tài khoản
              </h2>
            </div>
            <button
              type="button"
              data-testid="login-theme-toggle"
              onClick={handleToggleTheme}
              aria-label={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
              title={isDark ? 'Giao diện sáng' : 'Giao diện tối'}
              className="hidden lg:inline-flex w-10 h-10 rounded-[14px] ui-icon-chip items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl glass-subsurface p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl ui-icon-chip flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                Dữ liệu học sinh, nhân sự, thời khóa biểu, thư viện và thi đua được lưu trữ tập trung trên Cloud Firestore và đồng bộ thời gian thực.
              </p>
            </div>

            {lockedAccountEmail && (
              <div
                data-testid="locked-account-banner"
                className="rounded-2xl bg-amber-500/12 dark:bg-amber-500/15 backdrop-blur-sm border border-amber-400/45 dark:border-amber-400/30 p-4 space-y-2"
              >
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 text-xs font-bold">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>Tài khoản đang bị tạm khóa</span>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-200/90 leading-relaxed">
                  Tài khoản <span className="font-semibold">{lockedAccountEmail}</span> hiện chưa được kích hoạt hoặc đã bị quản trị viên khóa quyền truy cập.
                </p>
                <button
                  type="button"
                  onClick={handleSwitchAccount}
                  disabled={busy}
                  className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200 hover:underline cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" /> Đăng xuất để chọn tài khoản Google khác
                </button>
              </div>
            )}

            {effectiveError && !lockedAccountEmail && (
              <div
                data-testid="login-error-banner"
                className="rounded-2xl bg-rose-500/12 dark:bg-rose-500/15 backdrop-blur-sm border border-rose-400/45 dark:border-rose-400/30 p-3.5 space-y-2.5"
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1 space-y-1">
                    {signedInEmail && (
                      <p className="text-[11px] font-semibold text-rose-800 dark:text-rose-200 truncate">
                        Tài khoản: {signedInEmail}
                      </p>
                    )}
                    <p className="text-xs text-rose-800 dark:text-rose-200 leading-relaxed">{effectiveError}</p>
                  </div>
                </div>
                {(onRetrySignedInSession || signedInEmail) && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {onRetrySignedInSession && signedInEmail && (
                      <button
                        type="button"
                        data-testid="retry-auth-session-btn"
                        onClick={onRetrySignedInSession}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                        <span>Thử lại tải hồ sơ</span>
                      </button>
                    )}
                    {signedInEmail && (
                      <button
                        type="button"
                        data-testid="error-switch-account-btn"
                        onClick={handleSwitchAccount}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-subsurface text-rose-800 dark:text-rose-200 text-xs font-semibold hover:bg-white/75 dark:hover:bg-slate-800/75 transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Đăng xuất &amp; chọn tài khoản khác</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-900/8 dark:border-white/10">
            <button
              type="button"
              data-testid="google-signin-button"
              onClick={handleGoogleSignIn}
              disabled={busy}
              className="w-full py-3.5 px-5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm shadow-[0_12px_24px_-8px_rgba(2,132,199,0.45)] transition-all duration-150 flex items-center justify-center gap-2.5 disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang xác thực với Google...</span>
                </>
              ) : (
                <>
                  <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 shadow-2xs">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="#EA4335"
                        d="M12 5c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0 7.39 0 3.41 2.66 1.52 6.53l3.68 2.85C6.08 6.72 8.8 5 12 5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.7 2.87c2.16-2 3.72-4.94 3.72-8.69z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.2 14.62c-.22-.66-.35-1.36-.35-2.12s.13-1.46.35-2.12L1.52 7.53C.55 9.48 0 11.67 0 14s.55 4.52 1.52 6.47l3.68-2.85z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.7-2.87c-1.08.72-2.45 1.16-4.23 1.16-3.2 0-5.92-1.72-6.8-4.38l-3.68 2.85C3.41 21.34 7.39 24 12 24z"
                      />
                    </svg>
                  </span>
                  <span>Đăng nhập bằng tài khoản Google</span>
                </>
              )}
            </button>

            <p className="text-xs text-center text-slate-600 dark:text-slate-300/90 leading-relaxed">
              {devAdminMode
                ? 'Tài khoản Google đăng nhập hợp lệ được cấp quyền Quản trị viên mặc định.'
                : 'Áp dụng phân quyền RBAC theo vai trò được cấp hoặc lời mời email.'}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};
