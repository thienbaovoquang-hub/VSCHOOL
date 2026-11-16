import type { GoogleSyncErrorCode } from '../../types';

export interface ClassifiedGoogleApiError {
  errorCode: GoogleSyncErrorCode;
  friendlyMessage: string;
  isAuthError: boolean;
  technicalReason?: string;
}

/**
 * Classifies raw Google REST API HTTP status & JSON payloads into actionable Vietnamese diagnostics.
 * Shared between Express backend (server/googleRoutes.ts) and unit tests.
 */
export function classifyGoogleApiError(
  status: number,
  rawBody: string,
  context?: { serviceLabel?: string; sheetName?: string }
): ClassifiedGoogleApiError {
  let reason = '';
  let apiMessage = '';

  try {
    const parsed = JSON.parse(rawBody) as {
      error?: {
        message?: string;
        status?: string;
        errors?: Array<{ reason?: string; message?: string }>;
      };
    };
    apiMessage = parsed?.error?.message || '';
    reason = parsed?.error?.errors?.[0]?.reason || parsed?.error?.status || '';
  } catch {
    apiMessage = rawBody;
  }

  const combined = `${reason} ${apiMessage} ${rawBody}`.toLowerCase();
  const serviceLabel = context?.serviceLabel || 'Google Sheets API';

  if (
    status === 401 ||
    reason.toLowerCase() === 'unauthenticated' ||
    combined.includes('invalid credentials') ||
    combined.includes('invalid_token') ||
    combined.includes('token has been expired')
  ) {
    return {
      errorCode: 'TOKEN_EXPIRED',
      friendlyMessage:
        'Phiên kết nối Google đã hết hạn hoặc bị thu hồi. Vui lòng nhấn "Kết nối lại Google" để cấp quyền mới.',
      isAuthError: true,
      technicalReason: apiMessage || reason || `HTTP ${status}`,
    };
  }

  if (
    combined.includes('accessnotconfigured') ||
    combined.includes('has not been used in project') ||
    combined.includes('is disabled') ||
    combined.includes('api has not been used')
  ) {
    return {
      errorCode: 'API_DISABLED',
      friendlyMessage: `${serviceLabel} chưa được kích hoạt trên dự án Google Cloud. Vui lòng bật Google Sheets API, Google Docs API và Google Drive API trong Google Cloud Console rồi thử lại.`,
      isAuthError: false,
      technicalReason: apiMessage || reason || `HTTP ${status}`,
    };
  }

  if (
    status === 403 ||
    reason.toLowerCase() === 'permission_denied' ||
    combined.includes('insufficient') ||
    combined.includes('the caller does not have permission')
  ) {
    return {
      errorCode: 'PERMISSION_DENIED',
      friendlyMessage:
        'Tài khoản Google hiện tại không có quyền đọc/chỉnh sửa bảng tính này hoặc thiếu scope truy cập. Hãy chia sẻ tệp cho đúng tài khoản Google hoặc chọn lại tệp qua Google Picker.',
      isAuthError: false,
      technicalReason: apiMessage || reason || `HTTP ${status}`,
    };
  }

  if (status === 404 || reason.toLowerCase() === 'not_found' || combined.includes('requested entity was not found')) {
    return {
      errorCode: 'SPREADSHEET_NOT_FOUND',
      friendlyMessage:
        'Không tìm thấy bảng tính Google này trên Drive (tệp có thể đã bị xóa hoặc chuyển vào thùng rác).',
      isAuthError: false,
      technicalReason: apiMessage || reason || `HTTP ${status}`,
    };
  }

  if (combined.includes('unable to parse range')) {
    const sheetInfo = context?.sheetName ? ` "${context.sheetName}"` : '';
    return {
      errorCode: 'SHEET_NOT_FOUND',
      friendlyMessage: `Không tìm thấy tab/trang tính${sheetInfo} trong bảng tính Google. Vui lòng chọn đúng tên tab dữ liệu.`,
      isAuthError: false,
      technicalReason: apiMessage || reason || `HTTP ${status}`,
    };
  }

  return {
    errorCode: 'UNKNOWN_ERROR',
    friendlyMessage: apiMessage || `Lỗi từ Google API (HTTP ${status}). Vui lòng thử lại sau.`,
    isAuthError: false,
    technicalReason: apiMessage || reason || `HTTP ${status}`,
  };
}
