import React, { useEffect, useState } from 'react';
import { ShieldCheck, Cloud, RefreshCw, AlertCircle, Lock, LogOut } from 'lucide-react';
import { signInWithGoogleAccount, disconnectGoogleWorkspace } from '../../services/googleAuth';

interface LoginScreenProps {
  authError?: string | null;
  lockedAccountEmail?: string | null;
  signedInEmail?: string | null;
  isRetrying?: boolean;
  onRetrySignedInSession?: () => void;
  onSignOutAndSwitch?: () => Promise<void> | void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
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

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    setIsLoading(true);
    try {
      await signInWithGoogleAccount();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('popup-closed-by-user') || msg.includes('cancelled-popup-request')) {
        setLocalError('Bạn đã đóng cửa sổ đăng nhập Google. Vui lòng thử lại.');
      } else if (msg.includes('popup-blocked')) {
        setLocalError('Trình duyệt đang chặn cửa sổ bật lên. Vui lòng cho phép popup để đăng nhập Google.');
      } else if (msg.includes('network-request-failed')) {
        setLocalError('Không thể kết nối máy chủ xác thực. Vui lòng kiểm tra đường truyền mạng.');
      } else {
        setLocalError(msg || 'Đăng nhập Google thất bại. Vui lòng thử lại.');
      }
    } finally {
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
        await disconnectGoogleWorkspace({ signOutFirebase: true });
      }
    } catch {
      // Ignore sign-out errors
    } finally {
      setIsLoading(false);
    }
  };

  const effectiveError = localError || authError;
  const busy = isLoading || isRetrying;

  return (
    <div
      data-testid="login-screen"
      className="min-h-screen w-full relative overflow-hidden flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-sky-50 via-indigo-50/70 to-teal-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950"
    >
      <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-sky-300/30 dark:bg-sky-600/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-indigo-300/30 dark:bg-indigo-600/15 blur-3xl" />

      <div className="relative z-10 w-full max-w-md rounded-3xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 shadow-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/25">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              SchoolHub Cloud
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Hệ điều hành Quản trị Trường học Đồng bộ Trực tuyến
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-sky-50/80 dark:bg-sky-950/35 border border-sky-200/70 dark:border-sky-800/60 p-4 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200">
              Dữ liệu học sinh, nhân sự, thời khóa biểu, thư viện và thi đua được lưu trữ tập trung trên Cloud Firestore và đồng bộ thời gian thực.
            </p>
          </div>
        </div>

        {lockedAccountEmail && (
          <div
            data-testid="locked-account-banner"
            className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 p-4 space-y-2"
          >
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-bold">
              <Lock className="w-4 h-4 shrink-0" />
              <span>Tài khoản đang bị tạm khóa</span>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-200/90 leading-relaxed">
              Tài khoản <span className="font-semibold">{lockedAccountEmail}</span> hiện chưa được kích hoạt hoặc đã bị quản trị viên khóa quyền truy cập.
            </p>
            <button
              type="button"
              onClick={handleSwitchAccount}
              disabled={busy}
              className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200 hover:underline cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Đăng xuất để chọn tài khoản Google khác
            </button>
          </div>
        )}

        {effectiveError && !lockedAccountEmail && (
          <div
            data-testid="login-error-banner"
            className="rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 p-3.5 space-y-2.5"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1 space-y-1">
                {signedInEmail && (
                  <p className="text-[11px] font-semibold text-rose-800 dark:text-rose-200 truncate">
                    Tài khoản: {signedInEmail}
                  </p>
                )}
                <p className="text-xs text-rose-700 dark:text-rose-200 leading-relaxed">{effectiveError}</p>
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors disabled:opacity-60 cursor-pointer"
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-700 text-rose-700 dark:text-rose-200 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Đăng xuất &amp; chọn tài khoản khác</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            data-testid="google-signin-button"
            onClick={handleGoogleSignIn}
            disabled={busy}
            className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm shadow-lg transition-all flex items-center justify-center gap-2.5 disabled:opacity-60 cursor-pointer"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Đang xác thực với Google...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
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
                <span>Đăng nhập bằng tài khoản Google</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 leading-relaxed">
            {devAdminMode
              ? 'Tài khoản Google đăng nhập hợp lệ được cấp quyền Quản trị viên mặc định.'
              : 'Áp dụng phân quyền RBAC theo vai trò được cấp hoặc lời mời email.'}
          </p>
        </div>
      </div>
    </div>
  );
};
