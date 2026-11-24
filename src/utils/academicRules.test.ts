import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSubjectGPA,
  classifyAcademicTier,
  calculateAttendanceRate,
  validateScore,
  detectTimetableConflicts,
  reconcileLeaveToAttendance,
} from './academicRules';

test('calculateSubjectGPA accurately calculates weighted Vietnamese high school average', () => {
  const gpa = calculateSubjectGPA({
    scoreRegular: [8, 9],
    scoreMidterm: 8.5,
    scoreFinal: 9.0
  });
  assert.equal(gpa, 8.7);
});

test('calculateSubjectGPA supports configurable grade weights', () => {
  const gpa = calculateSubjectGPA(
    { scoreRegular: [8], scoreMidterm: 9, scoreFinal: 10 },
    { regularWeight: 1, midtermWeight: 1, finalWeight: 2 }
  );
  // (8*1 + 9*1 + 10*2) / (1 + 1 + 2) = 37 / 4 = 9.25 -> 9.3
  assert.equal(gpa, 9.3);
});

test('validateScore rejects out-of-range scores and clamps safely', () => {
  assert.equal(validateScore(8.55).value, 8.6);
  assert.equal(validateScore(8.55).valid, true);
  assert.equal(validateScore(11).valid, false);
  assert.equal(validateScore(11).value, 10);
  assert.equal(validateScore(-2).valid, false);
  assert.equal(validateScore(-2).value, 0);
});

test('classifyAcademicTier accurately determines student honors level', () => {
  assert.equal(classifyAcademicTier(9.2, 8.5), 'Xuất sắc');
  assert.equal(classifyAcademicTier(8.4, 7.0), 'Giỏi');
  assert.equal(classifyAcademicTier(7.2, 6.0), 'Khá');
  assert.equal(classifyAcademicTier(5.5, 4.0), 'Trung bình');
  assert.equal(classifyAcademicTier(4.2, 3.0), 'Chưa đạt');
});

test('calculateAttendanceRate computes percentage and triggers warning when under 80%', () => {
  const good = calculateAttendanceRate(45, 50);
  assert.equal(good.ratePercentage, 90);
  assert.equal(good.isWarning, false);

  const warned = calculateAttendanceRate(38, 50);
  assert.equal(warned.ratePercentage, 76);
  assert.equal(warned.isWarning, true);
  assert.match(warned.statusLabel, /Cảnh báo/);
});

test('detectTimetableConflicts flags class, teacher, and room overlaps', () => {
  const existing = [
    {
      id: 'TT-1',
      classId: 'CLS-11A1',
      className: '11A1',
      dayOfWeek: 2,
      period: 1,
      subject: 'Toán học',
      teacherName: 'Thầy Minh',
      room: 'B301',
    },
  ];
  const conflictTeacherAndRoom = detectTimetableConflicts(
    {
      id: 'TT-2',
      classId: 'CLS-11A2',
      className: '11A2',
      dayOfWeek: 2,
      period: 1,
      subject: 'Toán học',
      teacherName: 'Thầy Minh',
      room: 'B301',
    },
    existing
  );
  assert.equal(conflictTeacherAndRoom.length, 2);
  assert.ok(conflictTeacherAndRoom.some((c) => c.type === 'teacher'));
  assert.ok(conflictTeacherAndRoom.some((c) => c.type === 'room'));

  const noConflict = detectTimetableConflicts(
    {
      id: 'TT-3',
      classId: 'CLS-11A2',
      className: '11A2',
      dayOfWeek: 2,
      period: 2,
      subject: 'Ngữ văn',
      teacherName: 'Cô Lan',
      room: 'B302',
    },
    existing
  );
  assert.equal(noConflict.length, 0);
});

test('reconcileLeaveToAttendance creates absent_excused records across approved date range', () => {
  const records = reconcileLeaveToAttendance(
    {
      id: 'LV-1',
      requestCode: 'DON-001',
      studentId: 'STU-1',
      studentName: 'Nguyễn An',
      studentCode: 'STU-2026-0001',
      className: '11A1',
      type: 'Nghỉ ốm',
      fromDate: '2026-11-10',
      toDate: '2026-11-12',
      reason: 'Sốt cao',
      status: 'approved',
      createdAt: '2026-11-09T08:00:00Z',
    },
    'Cô Chủ Nhiệm'
  );
  assert.equal(records.length, 3);
  assert.equal(records[0].date, '2026-11-10');
  assert.equal(records[2].date, '2026-11-12');
  assert.equal(records[0].status, 'absent_excused');
});
