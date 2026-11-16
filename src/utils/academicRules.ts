import { GradeWeightConfig, StudentLeaveRequest, AttendanceRecord, TimetableEntry } from '../types';

export interface SubjectScores {
  scoreRegular: number[]; // Hệ số 1 mặc định
  scoreMidterm: number;   // Hệ số 2 mặc định
  scoreFinal: number;     // Hệ số 3 mặc định
}

export const DEFAULT_GRADE_WEIGHTS: GradeWeightConfig = {
  regularWeight: 1,
  midtermWeight: 2,
  finalWeight: 3,
};

export function validateScore(raw: number): { valid: boolean; value: number; error?: string } {
  if (!Number.isFinite(raw)) {
    return { valid: false, value: 0, error: 'Điểm không hợp lệ' };
  }
  if (raw < 0 || raw > 10) {
    return {
      valid: false,
      value: Math.min(10, Math.max(0, Math.round(raw * 10) / 10)),
      error: 'Điểm số phải nằm trong khoảng từ 0.0 đến 10.0',
    };
  }
  return { valid: true, value: Math.round(raw * 10) / 10 };
}

export function calculateSubjectGPA(
  scores: SubjectScores,
  weights: GradeWeightConfig = DEFAULT_GRADE_WEIGHTS
): number {
  const regW = weights.regularWeight > 0 ? weights.regularWeight : 1;
  const midW = weights.midtermWeight > 0 ? weights.midtermWeight : 2;
  const finW = weights.finalWeight > 0 ? weights.finalWeight : 3;

  const regularScores = scores.scoreRegular.length > 0 ? scores.scoreRegular : [0];
  const regularSum = regularScores.reduce((acc, curr) => acc + curr * regW, 0);
  const regularDenominator = regularScores.length * regW;

  const totalNumerator = regularSum + scores.scoreMidterm * midW + scores.scoreFinal * finW;
  const totalDenominator = regularDenominator + midW + finW;

  const gpa = totalNumerator / totalDenominator;
  return Math.round(gpa * 10) / 10;
}

export type AcademicTier = 'Xuất sắc' | 'Giỏi' | 'Khá' | 'Trung bình' | 'Chưa đạt';

export function classifyAcademicTier(overallGPA: number, minSubjectGPA: number = overallGPA): AcademicTier {
  if (overallGPA >= 9.0 && minSubjectGPA >= 8.0) {
    return 'Xuất sắc';
  }
  if (overallGPA >= 8.0 && minSubjectGPA >= 6.5) {
    return 'Giỏi';
  }
  if (overallGPA >= 6.5 && minSubjectGPA >= 5.0) {
    return 'Khá';
  }
  if (overallGPA >= 5.0 && minSubjectGPA >= 3.5) {
    return 'Trung bình';
  }
  return 'Chưa đạt';
}

export function calculateAttendanceRate(presentDays: number, totalDays: number): {
  ratePercentage: number;
  isWarning: boolean;
  statusLabel: string;
} {
  if (totalDays <= 0) {
    return { ratePercentage: 100, isWarning: false, statusLabel: 'Chưa có dữ liệu' };
  }
  const rate = Math.round((presentDays / totalDays) * 100);
  const isWarning = rate < 80;
  let statusLabel = 'Chuyên cần tốt';
  if (rate < 80) statusLabel = 'Cảnh báo vắng nhiều';
  else if (rate < 90) statusLabel = 'Cần lưu ý chuyên cần';

  return {
    ratePercentage: rate,
    isWarning,
    statusLabel
  };
}

export interface TimetableConflict {
  type: 'class' | 'teacher' | 'room';
  message: string;
  conflictingEntry: TimetableEntry;
}

export function detectTimetableConflicts(
  candidate: TimetableEntry,
  existing: TimetableEntry[]
): TimetableConflict[] {
  const conflicts: TimetableConflict[] = [];
  const norm = (v?: string) => (v || '').trim().toLowerCase();
  const candidateTeacher = norm(candidate.teacherName);
  const candidateRoom = norm(candidate.room);

  for (const item of existing) {
    if (item.id === candidate.id) continue;
    if (item.dayOfWeek !== candidate.dayOfWeek || item.period !== candidate.period) continue;

    if (item.classId === candidate.classId || norm(item.className) === norm(candidate.className)) {
      conflicts.push({
        type: 'class',
        message: `Lớp ${item.className} đã có tiết ${item.subject} vào Thứ ${item.dayOfWeek}, Tiết ${item.period}.`,
        conflictingEntry: item,
      });
    }

    if (
      candidateTeacher &&
      candidateTeacher !== 'chưa phân công' &&
      norm(item.teacherName) === candidateTeacher
    ) {
      conflicts.push({
        type: 'teacher',
        message: `Giáo viên ${item.teacherName} đang dạy lớp ${item.className} vào Thứ ${item.dayOfWeek}, Tiết ${item.period}.`,
        conflictingEntry: item,
      });
    }

    if (candidateRoom && norm(item.room) === candidateRoom) {
      conflicts.push({
        type: 'room',
        message: `Phòng học ${item.room} đang được lớp ${item.className} sử dụng vào Thứ ${item.dayOfWeek}, Tiết ${item.period}.`,
        conflictingEntry: item,
      });
    }
  }

  return conflicts;
}

export function reconcileLeaveToAttendance(
  leave: StudentLeaveRequest,
  reviewerName: string
): AttendanceRecord[] {
  if (leave.status !== 'approved') return [];
  const start = new Date(`${leave.fromDate}T00:00:00Z`);
  const end = new Date(`${leave.toDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return [];
  }

  const generated: AttendanceRecord[] = [];
  const cursor = new Date(start);
  let guard = 0;
  while (cursor <= end && guard < 31) {
    const dateStr = cursor.toISOString().split('T')[0];
    generated.push({
      id: `ATT-${dateStr}-${leave.studentId}`,
      date: dateStr,
      classId: `CLS-${leave.className}`,
      className: leave.className,
      studentId: leave.studentId,
      studentName: leave.studentName,
      studentCode: leave.studentCode,
      status: 'absent_excused',
      reason: `Đơn ${leave.type} (${leave.requestCode}): ${leave.reason}`,
      recordedBy: reviewerName,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }
  return generated;
}
