import type { UserProfile, UserRole } from '../types';
import { DEFAULT_SCHOOL_ID, normalizeSchoolId } from './syncEngine';

export type AuthPhase =
  | 'checking_auth'
  | 'loading_profile'
  | 'loading_permissions'
  | 'loading_app'
  | 'authenticated'
  | 'signed_out'
  | 'access_denied'
  | 'error';

export const AUTH_PHASE_LABELS: Record<
  AuthPhase,
  { title: string; detail: string }
> = {
  checking_auth: {
    title: 'Đang kiểm tra đăng nhập...',
    detail: 'Đang xác minh phiên xác thực Firebase Auth.',
  },
  loading_profile: {
    title: 'Đang tải hồ sơ người dùng...',
    detail: 'Đang kiểm tra và đồng bộ hồ sơ tài khoản trên Cloud Firestore.',
  },
  loading_permissions: {
    title: 'Đang tải quyền truy cập...',
    detail: 'Đang xác định vai trò, chế độ DEVELOPMENT_ADMIN_MODE và phạm vi trường học.',
  },
  loading_app: {
    title: 'Đang tải ứng dụng SchoolHub...',
    detail: 'Đang khởi tạo không gian làm việc Desktop và kênh đồng bộ thời gian thực.',
  },
  authenticated: {
    title: 'Đăng nhập thành công',
    detail: 'Phiên làm việc SchoolHub Cloud đã sẵn sàng.',
  },
  signed_out: {
    title: 'Chưa đăng nhập',
    detail: 'Vui lòng đăng nhập bằng tài khoản Google để tiếp tục.',
  },
  access_denied: {
    title: 'Không có quyền truy cập',
    detail: 'Tài khoản chưa được kích hoạt, bị khóa hoặc không đủ quyền truy cập hệ thống.',
  },
  error: {
    title: 'Lỗi kết nối hoặc máy chủ',
    detail: 'Không thể hoàn tất khởi tạo phiên làm việc. Vui lòng thử lại hoặc đổi tài khoản.',
  },
};

export function isAuthLoadingPhase(phase: AuthPhase): boolean {
  return (
    phase === 'checking_auth' ||
    phase === 'loading_profile' ||
    phase === 'loading_permissions' ||
    phase === 'loading_app'
  );
}

export class AuthTimeoutError extends Error {
  constructor(message = 'Quá thời gian chờ phản hồi từ máy chủ xác thực / Firestore.') {
    super(message);
    this.name = 'AuthTimeoutError';
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new AuthTimeoutError(timeoutMessage));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
}

const VALID_ROLES = new Set<UserRole>([
  'admin',
  'principal',
  'homeroom_teacher',
  'subject_teacher',
  'librarian',
  'counselor',
  'staff',
  'student',
]);

export function normalizeUserRoleSafe(
  rawRole: unknown,
  fallbackRole: UserRole = 'student'
): UserRole {
  if (typeof rawRole === 'string') {
    const cleaned = rawRole.trim().toLowerCase() as UserRole;
    if (VALID_ROLES.has(cleaned)) {
      return cleaned;
    }
  }
  return fallbackRole;
}

export function normalizeUserStatusSafe(
  rawStatus: unknown
): 'active' | 'locked' | 'disabled' {
  if (rawStatus === 'locked' || rawStatus === 'disabled' || rawStatus === 'active') {
    return rawStatus;
  }
  if (typeof rawStatus === 'string') {
    const lower = rawStatus.trim().toLowerCase();
    if (lower === 'locked' || lower === 'disabled' || lower === 'active') {
      return lower;
    }
  }
  return 'active';
}

export function normalizeUserProfileSafe(
  raw: Partial<UserProfile> & { id: string },
  fallback?: {
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
    fallbackRole?: UserRole;
  }
): UserProfile {
  const email = String(raw.email || fallback?.email || '').trim();
  const candidateRawName = typeof raw.displayName === 'string' ? raw.displayName.trim() : '';
  const candidateFallbackName =
    typeof fallback?.displayName === 'string' ? fallback.displayName.trim() : '';
  const emailPrefix = email ? email.split('@')[0].trim() : '';
  const displayName =
    (candidateRawName || candidateFallbackName || emailPrefix || 'Người dùng SchoolHub').slice(
      0,
      100
    ) || 'Người dùng SchoolHub';
  const role = normalizeUserRoleSafe(raw.role, fallback?.fallbackRole || 'student');
  const status = normalizeUserStatusSafe(raw.status);
  const schoolId = normalizeSchoolId(raw.schoolId || DEFAULT_SCHOOL_ID);

  const secondaryRoles = Array.isArray(raw.secondaryRoles)
    ? Array.from(
        new Set(
          raw.secondaryRoles
            .map((r) => normalizeUserRoleSafe(r, role))
            .filter((r) => r !== role && VALID_ROLES.has(r))
        )
      )
    : undefined;

  const validVersion =
    typeof raw.version === 'number' &&
    Number.isInteger(raw.version) &&
    raw.version >= 1 &&
    raw.version <= 1000000
      ? raw.version
      : 1;

  return {
    ...raw,
    id: raw.id,
    email,
    displayName,
    role,
    ...(raw.preDevRole ? { preDevRole: normalizeUserRoleSafe(raw.preDevRole, 'student') } : {}),
    ...(secondaryRoles && secondaryRoles.length > 0 ? { secondaryRoles } : {}),
    status,
    schoolId,
    version: validVersion,
    ...(raw.avatarUrl || fallback?.photoURL
      ? { avatarUrl: raw.avatarUrl || fallback?.photoURL || undefined }
      : {}),
  };
}

export function hasAccountIdentityChanged(
  prevUid: string | null | undefined,
  nextUid: string | null | undefined
): boolean {
  return (prevUid || null) !== (nextUid || null);
}

export function classifyAuthFailure(err: unknown): {
  kind: 'access_denied' | 'error';
  message: string;
} {
  let rawMessage = err instanceof Error ? err.message : String(err);

  // Unwrap structured JSON errors emitted by handleFirestoreError
  if (rawMessage.startsWith('{') && rawMessage.endsWith('}')) {
    try {
      const parsed = JSON.parse(rawMessage) as { error?: string; path?: string };
      if (parsed.error) {
        rawMessage = parsed.path ? `${parsed.error} (${parsed.path})` : parsed.error;
      }
    } catch {
      // Keep original message
    }
  }

  const lower = rawMessage.toLowerCase();

  if (
    lower.includes('permission-denied') ||
    lower.includes('missing or insufficient permissions')
  ) {
    return {
      kind: 'access_denied',
      message:
        'Quy tắc bảo mật Firestore từ chối đọc hoặc khởi tạo hồ sơ tài khoản này. Vui lòng kiểm tra trạng thái xác thực email và quyền truy cập trên máy chủ.',
    };
  }

  if (err instanceof AuthTimeoutError || lower.includes('quá thời gian')) {
    return {
      kind: 'error',
      message:
        rawMessage ||
        'Kết nối tới máy chủ xác thực / Cloud Firestore bị quá thời gian chờ. Vui lòng thử lại.',
    };
  }

  if (
    lower.includes('offline') ||
    lower.includes('unavailable') ||
    lower.includes('network-request-failed') ||
    lower.includes('failed to fetch')
  ) {
    return {
      kind: 'error',
      message:
        'Không thể kết nối tới Cloud Firestore hoặc máy chủ xác thực (mất mạng hoặc kết nối bị gián đoạn).',
    };
  }

  return {
    kind: 'error',
    message: `Không thể khởi tạo phiên làm việc: ${rawMessage}`,
  };
}
