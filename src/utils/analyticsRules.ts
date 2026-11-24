import {
  AcademicRecord,
  AttendanceRecord,
  Book,
  BorrowTransaction,
  FeedbackReport,
  SchoolClass,
  Student,
} from '../types';
import { classifyAcademicTier } from './academicRules';

export interface DashboardTrendPoint {
  date: string;
  label: string;
  attendanceRate: number;
  libraryBorrows: number;
}

export function computeDashboardTrends(
  attendanceRecords: AttendanceRecord[],
  borrowTransactions: BorrowTransaction[]
): DashboardTrendPoint[] {
  const dateSet = new Set<string>();
  for (const rec of attendanceRecords) {
    if (rec.date) dateSet.add(rec.date);
  }
  for (const trans of borrowTransactions) {
    if (trans.borrowDate) dateSet.add(trans.borrowDate);
  }

  const sortedDates = Array.from(dateSet).sort().slice(-7);
  if (sortedDates.length === 0) return [];

  return sortedDates.map((date) => {
    const dayAttendance = attendanceRecords.filter((r) => r.date === date);
    const presentCount = dayAttendance.filter(
      (r) => r.status === 'present' || r.status === 'late'
    ).length;
    const attendanceRate =
      dayAttendance.length > 0
        ? Math.round((presentCount / dayAttendance.length) * 1000) / 10
        : 0;

    const libraryBorrows = borrowTransactions.filter(
      (t) => t.borrowDate === date
    ).length;

    const parts = date.split('-');
    const label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : date;

    return {
      date,
      label,
      attendanceRate,
      libraryBorrows,
    };
  });
}

export interface GradeDistributionItem {
  grade: string;
  count: number;
  color: string;
}

export interface CategoryBorrowItem {
  name: string;
  value: number;
  color: string;
}

export interface ReportsSummary {
  totalStudents: number;
  totalClasses: number;
  totalBooks: number;
  totalBookCopies: number;
  totalBorrows: number;
  activeBorrows: number;
  overdueBorrows: number;
  highAchieverRate: number;
  highAchieverCount: number;
  evaluatedStudentsCount: number;
  attendanceRate: number;
  resolvedFeedbackCount: number;
  totalFeedbackCount: number;
  feedbackResolutionRate: number;
  gradeDistribution: GradeDistributionItem[];
  categoryBorrows: CategoryBorrowItem[];
  executiveSummaryText: string;
}

const CATEGORY_COLORS = ['#0ea5e9', '#14b8a6', '#8b5cf6', '#f43f5e', '#f59e0b'];

export function computeReportsSummary(params: {
  students: Student[];
  classes: SchoolClass[];
  books: Book[];
  borrowTransactions: BorrowTransaction[];
  academicRecords: AcademicRecord[];
  attendanceRecords: AttendanceRecord[];
  feedbacks: FeedbackReport[];
}): ReportsSummary {
  const {
    students,
    classes,
    books,
    borrowTransactions,
    academicRecords,
    attendanceRecords,
    feedbacks,
  } = params;

  // 1. Academic tier distribution from academicRecords (fallback to student.gpa if no detailed records)
  const tierCounts: Record<string, number> = {
    'Xuất sắc': 0,
    'Giỏi': 0,
    'Khá': 0,
    'Trung bình': 0,
    'Chưa đạt': 0,
  };

  if (academicRecords.length > 0) {
    const byStudent = new Map<string, number[]>();
    for (const rec of academicRecords) {
      const arr = byStudent.get(rec.studentId) || [];
      arr.push(rec.averageScore);
      byStudent.set(rec.studentId, arr);
    }
    for (const scores of byStudent.values()) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const minScore = Math.min(...scores);
      const tier = classifyAcademicTier(avg, minScore);
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    }
  } else {
    for (const stu of students) {
      if (typeof stu.gpa === 'number' && stu.gpa > 0) {
        const tier = classifyAcademicTier(stu.gpa);
        tierCounts[tier] = (tierCounts[tier] || 0) + 1;
      }
    }
  }

  const evaluatedStudentsCount = Object.values(tierCounts).reduce((a, b) => a + b, 0);
  const highAchieverCount = tierCounts['Xuất sắc'] + tierCounts['Giỏi'];
  const highAchieverRate =
    evaluatedStudentsCount > 0
      ? Math.round((highAchieverCount / evaluatedStudentsCount) * 1000) / 10
      : 0;

  const gradeDistribution: GradeDistributionItem[] = [
    { grade: 'Xuất sắc', count: tierCounts['Xuất sắc'], color: '#8b5cf6' },
    { grade: 'Giỏi', count: tierCounts['Giỏi'], color: '#0ea5e9' },
    { grade: 'Khá', count: tierCounts['Khá'], color: '#14b8a6' },
    { grade: 'Trung bình', count: tierCounts['Trung bình'], color: '#f59e0b' },
  ];

  // 2. Library category borrow counts
  const bookCategoryById = new Map<string, string>();
  for (const b of books) {
    bookCategoryById.set(b.id, b.category || 'Khác');
  }

  const borrowByCat = new Map<string, number>();
  for (const tr of borrowTransactions) {
    const cat = bookCategoryById.get(tr.bookId) || 'Khác';
    borrowByCat.set(cat, (borrowByCat.get(cat) || 0) + 1);
  }

  const categoryBorrows: CategoryBorrowItem[] = Array.from(borrowByCat.entries()).map(
    ([name, value], idx) => ({
      name,
      value,
      color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
    })
  );

  // 3. Attendance rate
  const attendancePresent = attendanceRecords.filter(
    (r) => r.status === 'present' || r.status === 'late'
  ).length;
  const attendanceRate =
    attendanceRecords.length > 0
      ? Math.round((attendancePresent / attendanceRecords.length) * 1000) / 10
      : 0;

  // 4. Library active & overdue
  const activeBorrows = borrowTransactions.filter((t) => t.status !== 'returned').length;
  const todayStr = new Date().toISOString().split('T')[0];
  const overdueBorrows = borrowTransactions.filter(
    (t) => t.status !== 'returned' && t.dueDate < todayStr
  ).length;

  // 5. Feedback resolution rate
  const resolvedFeedbackCount = feedbacks.filter(
    (f) => f.status === 'resolved' || f.status === 'closed'
  ).length;
  const totalFeedbackCount = feedbacks.length;
  const feedbackResolutionRate =
    totalFeedbackCount > 0
      ? Math.round((resolvedFeedbackCount / totalFeedbackCount) * 1000) / 10
      : 0;

  const totalBookCopies = books.reduce((sum, b) => sum + (b.totalCopies || 0), 0);

  const summaryLines: string[] = [
    `BÁO CÁO TỔNG HỢP DỮ LIỆU THỰC TẾ SCHOOLHUB:`,
    `1. Quy mô đào tạo: Hiện quản lý ${students.length} học sinh thuộc ${classes.length} lớp học.`,
    evaluatedStudentsCount > 0
      ? `2. Học lực: ${highAchieverRate}% (${highAchieverCount}/${evaluatedStudentsCount} học sinh có điểm) đạt mức Giỏi và Xuất sắc.`
      : `2. Học lực: Chưa có bản ghi điểm số để xếp loại học lực.`,
    attendanceRecords.length > 0
      ? `3. Chuyên cần: Tỷ lệ có mặt đạt ${attendanceRate}% trên tổng số ${attendanceRecords.length} lượt điểm danh.`
      : `3. Chuyên cần: Chưa ghi nhận dữ liệu điểm danh theo ngày.`,
    `4. Thư viện RFID: Kho có ${books.length} đầu sách (${totalBookCopies} bản), ${borrowTransactions.length} lượt mượn (${activeBorrows} đang mượn, ${overdueBorrows} quá hạn).`,
    totalFeedbackCount > 0
      ? `5. Phản ánh học đường: Đã giải quyết ${resolvedFeedbackCount}/${totalFeedbackCount} phiếu (${feedbackResolutionRate}%).`
      : `5. Phản ánh học đường: Chưa có phiếu phản ánh tồn đọng.`,
  ];

  return {
    totalStudents: students.length,
    totalClasses: classes.length,
    totalBooks: books.length,
    totalBookCopies,
    totalBorrows: borrowTransactions.length,
    activeBorrows,
    overdueBorrows,
    highAchieverRate,
    highAchieverCount,
    evaluatedStudentsCount,
    attendanceRate,
    resolvedFeedbackCount,
    totalFeedbackCount,
    feedbackResolutionRate,
    gradeDistribution,
    categoryBorrows,
    executiveSummaryText: summaryLines.join('\n'),
  };
}
