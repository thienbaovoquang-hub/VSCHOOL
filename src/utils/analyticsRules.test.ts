import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDashboardTrends, computeReportsSummary } from './analyticsRules';
import {
  AcademicRecord,
  AttendanceRecord,
  Book,
  BorrowTransaction,
  FeedbackReport,
  SchoolClass,
  Student,
} from '../types';

test('computeDashboardTrends returns empty array when no records exist', () => {
  const result = computeDashboardTrends([], []);
  assert.deepEqual(result, []);
});

test('computeDashboardTrends aggregates attendance rates and library borrows by date', () => {
  const attendance: AttendanceRecord[] = [
    {
      id: 'A1',
      date: '2026-11-10',
      classId: 'CLS-11A1',
      className: '11A1',
      studentId: 'S1',
      studentName: 'An',
      studentCode: 'STU-1',
      status: 'present',
      recordedBy: 'Admin',
    },
    {
      id: 'A2',
      date: '2026-11-10',
      classId: 'CLS-11A1',
      className: '11A1',
      studentId: 'S2',
      studentName: 'Bình',
      studentCode: 'STU-2',
      status: 'absent_unexcused',
      recordedBy: 'Admin',
    },
  ];

  const borrows: BorrowTransaction[] = [
    {
      id: 'L1',
      transactionCode: 'LIB-1',
      studentId: 'S1',
      studentName: 'An',
      studentCode: 'STU-1',
      bookId: 'B1',
      bookTitle: 'Toán',
      copyBarcode: 'BAR-1',
      borrowDate: '2026-11-10',
      dueDate: '2026-11-24',
      status: 'borrowed',
    },
    {
      id: 'L2',
      transactionCode: 'LIB-2',
      studentId: 'S2',
      studentName: 'Bình',
      studentCode: 'STU-2',
      bookId: 'B1',
      bookTitle: 'Toán',
      copyBarcode: 'BAR-2',
      borrowDate: '2026-11-11',
      dueDate: '2026-11-25',
      status: 'borrowed',
    },
  ];

  const trends = computeDashboardTrends(attendance, borrows);
  assert.equal(trends.length, 2);
  assert.equal(trends[0].label, '10/11');
  assert.equal(trends[0].attendanceRate, 50);
  assert.equal(trends[0].libraryBorrows, 1);
  assert.equal(trends[1].label, '11/11');
  assert.equal(trends[1].attendanceRate, 0);
  assert.equal(trends[1].libraryBorrows, 1);
});

test('computeReportsSummary computes real metrics accurately without fake defaults', () => {
  const students: Student[] = [
    {
      id: 'S1',
      studentCode: 'STU-1',
      fullName: 'An',
      className: '11A1',
      classId: 'CLS-11A1',
      grade: 11,
      rfidCardId: 'RFID-1',
      dateOfBirth: '2010-01-01',
      gender: 'Nam',
      parentPhone: '0900',
      status: 'Đang học',
      address: 'HN',
      gpa: 9.2,
    },
    {
      id: 'S2',
      studentCode: 'STU-2',
      fullName: 'Bình',
      className: '11A1',
      classId: 'CLS-11A1',
      grade: 11,
      rfidCardId: 'RFID-2',
      dateOfBirth: '2010-02-02',
      gender: 'Nữ',
      parentPhone: '0901',
      status: 'Đang học',
      address: 'HN',
      gpa: 7.0,
    },
  ];

  const classes: SchoolClass[] = [
    {
      id: 'CLS-11A1',
      code: '11A1',
      name: 'Lớp 11A1',
      grade: 11,
      academicYear: '2026-2027',
      homeroomTeacherId: 'T1',
      homeroomTeacherName: 'Cô Lan',
      room: 'B301',
      studentCount: 2,
    },
  ];

  const books: Book[] = [
    {
      id: 'B1',
      isbn: '978-1',
      title: 'Toán',
      author: 'A',
      category: 'Toán học',
      publisher: 'GD',
      publishYear: 2025,
      totalCopies: 5,
      availableCopies: 4,
      shelfLocation: 'Kệ A1',
      coverUrl: '',
      description: '',
    },
  ];

  const academicRecords: AcademicRecord[] = [
    {
      id: 'AR1',
      studentId: 'S1',
      studentName: 'An',
      studentCode: 'STU-1',
      classId: 'CLS-11A1',
      className: '11A1',
      subjectId: 'TOAN',
      subjectName: 'Toán học',
      semester: 'HK1',
      scoreRegular: [9, 9.5],
      scoreMidterm: 9,
      scoreFinal: 9.5,
      averageScore: 9.3,
    },
    {
      id: 'AR2',
      studentId: 'S2',
      studentName: 'Bình',
      studentCode: 'STU-2',
      classId: 'CLS-11A1',
      className: '11A1',
      subjectId: 'TOAN',
      subjectName: 'Toán học',
      semester: 'HK1',
      scoreRegular: [7, 7],
      scoreMidterm: 7,
      scoreFinal: 7,
      averageScore: 7.0,
    },
  ];

  const feedbacks: FeedbackReport[] = [
    {
      id: 'F1',
      reportCode: 'FB-1',
      title: 'Đèn hỏng',
      category: 'Cơ sở vật chất',
      content: 'Hỏng',
      location: 'B301',
      priority: 'medium',
      isAnonymous: true,
      studentId: 'ANON',
      studentName: 'Ẩn danh',
      studentClass: '11A1',
      status: 'resolved',
      createdAt: '2026-11-10T00:00:00Z',
      updatedAt: '2026-11-10T00:00:00Z',
    },
    {
      id: 'F2',
      reportCode: 'FB-2',
      title: 'Quạt kêu',
      category: 'Cơ sở vật chất',
      content: 'Kêu',
      location: 'B302',
      priority: 'low',
      isAnonymous: false,
      studentId: 'S1',
      studentName: 'An',
      studentClass: '11A1',
      status: 'submitted',
      createdAt: '2026-11-11T00:00:00Z',
      updatedAt: '2026-11-11T00:00:00Z',
    },
  ];

  const summary = computeReportsSummary({
    students,
    classes,
    books,
    borrowTransactions: [],
    academicRecords,
    attendanceRecords: [],
    feedbacks,
  });

  assert.equal(summary.totalStudents, 2);
  assert.equal(summary.totalClasses, 1);
  assert.equal(summary.highAchieverCount, 1);
  assert.equal(summary.highAchieverRate, 50);
  assert.equal(summary.feedbackResolutionRate, 50);
  assert.equal(summary.gradeDistribution[0].count, 1); // Xuất sắc
  assert.equal(summary.gradeDistribution[2].count, 1); // Khá
});
