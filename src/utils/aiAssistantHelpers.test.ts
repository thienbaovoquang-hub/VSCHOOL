import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAiAssistantContextSummary,
  createWelcomeAssistantMessage,
  getAssistantPromptCatalog,
  getAssistantQuickChips,
} from './aiAssistantHelpers';
import type { UserProfile } from '../types';

const studentUser: UserProfile = {
  id: 'STU-1',
  email: 'an@school.edu.vn',
  displayName: 'Nguyễn Minh An',
  role: 'student',
  className: '11A1',
  studentCode: 'HS-01',
};

const adminUser: UserProfile = {
  id: 'ADM-1',
  email: 'admin@school.edu.vn',
  displayName: 'Quản trị viên',
  role: 'admin',
};

const sampleInput = {
  students: [
    {
      id: 'STU-1',
      studentCode: 'HS-01',
      fullName: 'Nguyễn Minh An',
      classId: 'C1',
      className: '11A1',
      grade: 11,
      rfidCardId: 'RF-1',
      dateOfBirth: '2009-01-01',
      gender: 'Nam' as const,
      parentPhone: '0901',
      status: 'Đang học' as const,
      address: 'HN',
    },
    {
      id: 'STU-2',
      studentCode: 'HS-02',
      fullName: 'Trần Bình',
      classId: 'C2',
      className: '10A1',
      grade: 10,
      rfidCardId: 'RF-2',
      dateOfBirth: '2010-01-01',
      gender: 'Nam' as const,
      parentPhone: '0902',
      status: 'Đang học' as const,
      address: 'HN',
    },
  ],
  teachers: [
    {
      id: 'TCH-1',
      fullName: 'Cô Lan',
      subject: 'Toán',
      email: 'lan@school.edu.vn',
      phone: '0911',
      isHomeroom: true,
      homeroomClassName: '11A1',
      assignedClasses: ['11A1'],
      status: 'Đang công tác' as const,
      role: 'homeroom_teacher' as const,
    },
  ],
  classes: [
    {
      id: 'C1',
      code: '11A1',
      name: '11A1',
      grade: 11,
      academicYear: '2026-2027',
      room: 'A101',
      homeroomTeacherId: 'TCH-1',
      homeroomTeacherName: 'Cô Lan',
      studentCount: 1,
    },
    {
      id: 'C2',
      code: '10A1',
      name: '10A1',
      grade: 10,
      academicYear: '2026-2027',
      room: 'A102',
      homeroomTeacherId: 'TCH-1',
      homeroomTeacherName: 'Cô Lan',
      studentCount: 1,
    },
  ],
  books: [
    {
      id: 'B1',
      title: 'Giải tích 11',
      author: 'Bộ GD',
      category: 'Toán học',
      isbn: '978-1',
      rfidTag: 'TAG-1',
      totalCopies: 5,
      availableCopies: 4,
      shelfLocation: 'Kệ A1',
      publisher: 'NXB Giáo dục',
      publishYear: 2025,
      coverUrl: '',
      description: 'Sách tham khảo Toán 11',
    },
  ],
  borrowTransactions: [
    {
      id: 'TX-1',
      transactionCode: 'PM-1',
      studentId: 'STU-1',
      studentName: 'Nguyễn Minh An',
      studentCode: 'HS-01',
      bookId: 'B1',
      bookTitle: 'Giải tích 11',
      copyBarcode: 'BC-1',
      borrowDate: '2026-11-01',
      dueDate: '2026-11-20',
      status: 'borrowed' as const,
    },
    {
      id: 'TX-2',
      transactionCode: 'PM-2',
      studentId: 'STU-2',
      studentName: 'Trần Bình',
      studentCode: 'HS-02',
      bookId: 'B1',
      bookTitle: 'Giải tích 11',
      copyBarcode: 'BC-2',
      borrowDate: '2026-10-01',
      dueDate: '2026-10-10',
      status: 'overdue' as const,
    },
  ],
  academicRecords: [
    {
      id: 'AR-1',
      studentId: 'STU-1',
      studentName: 'Nguyễn Minh An',
      studentCode: 'HS-01',
      classId: 'C1',
      className: '11A1',
      subjectId: 'MATH',
      subjectName: 'Toán',
      semester: 'HK1' as const,
      scoreRegular: [9, 8.5],
      scoreMidterm: 8.5,
      scoreFinal: 9,
      averageScore: 8.8,
    },
  ],
  feedbacks: [],
  announcements: [
    {
      id: 'ANN-1',
      title: 'Thông báo tuần 10',
      content: 'Lịch sinh hoạt chào cờ',
      category: 'Toàn trường' as const,
      targetAudience: 'Toàn trường' as const,
      authorName: 'BGH',
      authorRole: 'Ban Giám hiệu',
      publishedAt: '2026-11-10',
      isPinned: true,
      priority: 'normal' as const,
      status: 'published' as const,
    },
  ],
  facilities: [
    {
      id: 'FAC-1',
      code: 'TS-01',
      name: 'Máy chiếu A101',
      category: 'Thiết bị trình chiếu' as const,
      roomLocation: 'A101',
      quantity: 1,
      condition: 'Tốt' as const,
      status: 'Đang sử dụng' as const,
      lastInspected: '2026-11-01',
    },
  ],
  maintenance: [
    {
      id: 'M-1',
      requestCode: 'BT-01',
      assetName: 'Đèn LED',
      roomLocation: 'Tầng 2',
      reportedBy: 'Kỹ thuật',
      reporterRole: 'staff',
      issueDescription: 'Kiểm tra đèn hành lang',
      priority: 'medium' as const,
      status: 'reported' as const,
      reportedAt: '2026-11-10',
    },
  ],
  externalDatasets: [
    {
      id: 'EXT-1',
      code: 'WB_LIT',
      name: 'Tỷ lệ biết chữ',
      category: 'education',
      sourceName: 'worldbank',
      value: 96,
      unit: '%',
    },
  ],
};

test('buildAiAssistantContextSummary isolates student scope from school-wide counts', () => {
  const studentCtx = buildAiAssistantContextSummary({
    currentUser: studentUser,
    ...sampleInput,
  });

  assert.equal(studentCtx.studentsCount, 1);
  assert.equal(studentCtx.teachersCount, 0);
  assert.equal(studentCtx.classesCount, 1);
  assert.equal(studentCtx.activeLoans, 1);
  assert.equal(studentCtx.overdueLoans, 0);
  assert.equal(studentCtx.facilitiesCount, 0);
  assert.equal(studentCtx.openMaintenance, 0);
  assert.equal(studentCtx.externalBenchmarksCount, 0);
  assert.equal(studentCtx.ownGradesCount, 1);
  assert.equal(studentCtx.ownAvgScore, 8.8);
  assert.equal(studentCtx.roleSummaryText.includes('WB_LIT'), false);
  assert.equal(studentCtx.roleSummaryText.includes('Bảo trì'), false);
});

test('buildAiAssistantContextSummary provides full operational metrics for admin', () => {
  const adminCtx = buildAiAssistantContextSummary({
    currentUser: adminUser,
    ...sampleInput,
  });

  assert.equal(adminCtx.studentsCount, 2);
  assert.equal(adminCtx.teachersCount, 1);
  assert.equal(adminCtx.classesCount, 2);
  assert.equal(adminCtx.activeLoans, 2);
  assert.equal(adminCtx.overdueLoans, 1);
  assert.equal(adminCtx.facilitiesCount, 1);
  assert.equal(adminCtx.openMaintenance, 1);
  assert.equal(adminCtx.externalBenchmarksCount, 1);
  assert.equal(adminCtx.roleSummaryText.includes('Tỷ lệ biết chữ'), true);
});

test('getAssistantPromptCatalog filters management prompts away from pure students', () => {
  const studentPrompts = getAssistantPromptCatalog('student');
  const adminPrompts = getAssistantPromptCatalog('admin');

  assert.ok(studentPrompts.length >= 6);
  assert.equal(studentPrompts.some((p) => p.category === 'management'), false);
  assert.ok(adminPrompts.some((p) => p.category === 'management'));
  assert.ok(adminPrompts.length > studentPrompts.length);

  assert.ok(getAssistantQuickChips('student').length >= 3);
  assert.ok(getAssistantQuickChips('principal').length >= 3);

  const welcome = createWelcomeAssistantMessage(studentUser);
  assert.equal(welcome.id, 'welcome');
  assert.equal(welcome.sender, 'assistant');
  assert.ok(welcome.text.includes(studentUser.displayName));
});
