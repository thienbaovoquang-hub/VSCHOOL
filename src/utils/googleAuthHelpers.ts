export type GooglePopupFlowKind = 'signin' | 'workspace';

export interface GooglePopupErrorInfo {
  code: string;
  message: string;
  isCancellation: boolean;
}

export function extractFirebaseAuthCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const codeVal = (err as { code?: unknown }).code;
    if (typeof codeVal === 'string' && codeVal.trim()) {
      return codeVal.trim();
    }
  }
  const msg = err instanceof Error ? err.message : String(err || '');
  const match = msg.match(/\((auth\/[a-z0-9-]+)\)/i);
  if (match) {
    return match[1].toLowerCase();
  }
  if (msg.includes('Pending promise was never set')) {
    return 'auth/internal-error';
  }
  return '';
}

export function classifyGooglePopupError(err: unknown): GooglePopupErrorInfo {
  const code = extractFirebaseAuthCode(err);
  const rawMessage = err instanceof Error ? err.message : String(err || '');
  const lower = rawMessage.toLowerCase();

  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    lower.includes('popup-closed-by-user') ||
    lower.includes('cancelled-popup-request')
  ) {
    return {
      code: code || 'auth/popup-closed-by-user',
      isCancellation: true,
      message: 'Bạn đã đóng cửa sổ đăng nhập Google. Vui lòng thử lại.',
    };
  }

  if (code === 'auth/popup-blocked' || lower.includes('popup-blocked')) {
    return {
      code: 'auth/popup-blocked',
      isCancellation: false,
      message:
        'Trình duyệt đang chặn cửa sổ bật lên. Vui lòng cho phép popup để đăng nhập Google.',
    };
  }

  if (code === 'auth/unauthorized-domain' || lower.includes('unauthorized-domain')) {
    return {
      code: 'auth/unauthorized-domain',
      isCancellation: false,
      message:
        'Tên miền hiện tại chưa được cấp quyền đăng nhập Google trong Firebase Auth (unauthorized-domain). Vui lòng mở ứng dụng qua URL triển khai hợp lệ hoặc thêm tên miền vào Authorized domains.',
    };
  }

  if (code === 'auth/web-storage-unsupported' || lower.includes('web-storage-unsupported')) {
    return {
      code: 'auth/web-storage-unsupported',
      isCancellation: false,
      message:
        'Trình duyệt đang chặn cookie hoặc bộ nhớ phiên bên thứ ba cần thiết cho cửa sổ đăng nhập Google. Vui lòng bật cookie cho trang này hoặc thử mở ở tab mới.',
    };
  }

  if (code === 'auth/popup-already-open' || lower.includes('popup-already-open')) {
    return {
      code: 'auth/popup-already-open',
      isCancellation: false,
      message:
        'Một cửa sổ đăng nhập Google khác đang mở. Vui lòng hoàn tất hoặc đóng cửa sổ đó trước khi thử lại.',
    };
  }

  if (code === 'auth/network-request-failed' || lower.includes('network-request-failed')) {
    return {
      code: 'auth/network-request-failed',
      isCancellation: false,
      message: 'Không thể kết nối máy chủ xác thực. Vui lòng kiểm tra đường truyền mạng.',
    };
  }

  if (
    code === 'auth/internal-error' ||
    lower.includes('pending promise was never set')
  ) {
    return {
      code: 'auth/internal-error',
      isCancellation: false,
      message: 'Phiên cửa sổ đăng nhập Google gặp gián đoạn tạm thời. Vui lòng thử lại.',
    };
  }

  return {
    code: code || 'unknown',
    isCancellation: false,
    message: rawMessage || 'Đăng nhập Google thất bại. Vui lòng thử lại.',
  };
}

export interface SingleFlightPopupRunner {
  run: <T>(kind: GooglePopupFlowKind, fn: () => Promise<T>) => Promise<T>;
  isInFlight: () => boolean;
  getActiveKind: () => GooglePopupFlowKind | null;
}

/**
 * Ensures at most ONE Firebase `signInWithPopup` / `PopupOperation` executes at a time.
 * Calling `signInWithPopup` concurrently in Firebase Auth v13.2.0 triggers
 * `PopupOperation.currentPopupAction.cancel()`, which races with `_originValidation`
 * and throws `INTERNAL ASSERTION FAILED: Pending promise was never set`.
 */
export function createSingleFlightPopupRunner(): SingleFlightPopupRunner {
  let activeKind: GooglePopupFlowKind | null = null;
  let activePromise: Promise<unknown> | null = null;

  return {
    run<T>(kind: GooglePopupFlowKind, fn: () => Promise<T>): Promise<T> {
      if (activePromise) {
        if (activeKind === kind) {
          return activePromise as Promise<T>;
        }
        const conflictError = new Error(
          'Firebase: Error (auth/popup-already-open).'
        ) as Error & { code?: string };
        conflictError.code = 'auth/popup-already-open';
        return Promise.reject(conflictError);
      }

      activeKind = kind;
      let rawPromise: Promise<T>;
      try {
        rawPromise = Promise.resolve(fn());
      } catch (syncErr) {
        rawPromise = Promise.reject(syncErr);
      }

      const promise = rawPromise.finally(() => {
        if (activePromise === promise) {
          activePromise = null;
          activeKind = null;
        }
      });

      activePromise = promise;
      return promise;
    },
    isInFlight(): boolean {
      return activePromise !== null;
    },
    getActiveKind(): GooglePopupFlowKind | null {
      return activeKind;
    },
  };
}
