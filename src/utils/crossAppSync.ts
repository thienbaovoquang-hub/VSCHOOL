import {
  FacilityAsset,
  FeedbackReport,
  MaintenanceRequest,
  UserProfile,
} from '../types';

export function formatDateTimeSafe(value?: string | null): string {
  if (!value) return 'Chưa rõ';
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
  return value;
}

export function formatDateSafe(value?: string | null): string {
  if (!value) return 'Chưa rõ';
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('vi-VN');
  }
  return value;
}

export function createMaintenanceFromFeedback(
  report: FeedbackReport,
  existingCount: number = 0
): MaintenanceRequest | null {
  if (report.category !== 'Cơ sở vật chất') return null;

  const seq = String(existingCount + 1).padStart(3, '0');
  const id = `MNT-${Date.now()}-${seq}`;
  return {
    id,
    requestCode: `MNT-FB-${seq}`,
    assetName: report.title,
    roomLocation: report.location || 'Chưa xác định vị trí',
    reportedBy: report.isAnonymous ? 'Phản ánh ẩn danh' : report.studentName,
    reporterRole: 'Học sinh / Phản ánh CSVC',
    issueDescription: `[Từ phiếu ${report.reportCode}] ${report.content}`,
    priority: report.priority,
    status: 'reported',
    linkedFeedbackId: report.id,
    reportedAt: report.createdAt || new Date().toISOString(),
  };
}

export function syncAssetAfterMaintenance(
  assets: FacilityAsset[],
  request: MaintenanceRequest
): FacilityAsset | null {
  const matched =
    (request.assetId && assets.find((a) => a.id === request.assetId)) ||
    assets.find(
      (a) =>
        a.name.toLowerCase() === request.assetName.toLowerCase() &&
        a.roomLocation.toLowerCase() === request.roomLocation.toLowerCase()
    );
  if (!matched) return null;

  const today = new Date().toISOString().split('T')[0];
  if (request.status === 'completed') {
    return {
      ...matched,
      condition: 'Tốt',
      status: 'Đang sử dụng',
      lastInspected: today,
    };
  }
  if (request.status === 'in_repair' || request.status === 'assigned') {
    return {
      ...matched,
      condition: 'Cần bảo trì',
      status: 'Đang sửa chữa',
      lastInspected: today,
    };
  }
  return {
    ...matched,
    condition: 'Hỏng hóc',
    status: 'Đang sửa chữa',
    lastInspected: today,
  };
}

export function isUserActive(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  return user.status !== 'locked' && user.status !== 'disabled';
}

export function validateBackupPayload(raw: unknown): {
  valid: boolean;
  error?: string;
  collectionsCount: number;
} {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'Định dạng JSON sao lưu không hợp lệ.', collectionsCount: 0 };
  }
  const obj = raw as Record<string, unknown>;
  const dataObj =
    obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)
      ? (obj.data as Record<string, unknown>)
      : obj;

  const knownKeys = [
    'students',
    'teachers',
    'staffMembers',
    'classes',
    'academicYears',
    'books',
    'bookCopies',
    'borrowTransactions',
    'surveys',
    'feedbacks',
    'leaveRequests',
    'announcements',
    'schoolEvents',
    'timetable',
    'attendance',
    'academicRecords',
    'assignments',
    'learningMaterials',
    'facilities',
    'rooms',
    'maintenance',
    'supportTickets',
  ];

  const found = knownKeys.filter((k) => Array.isArray(dataObj[k]));
  if (found.length === 0) {
    return {
      valid: false,
      error: 'Không tìm thấy dữ liệu SchoolHub hợp lệ trong file sao lưu.',
      collectionsCount: 0,
    };
  }
  return { valid: true, collectionsCount: found.length };
}
