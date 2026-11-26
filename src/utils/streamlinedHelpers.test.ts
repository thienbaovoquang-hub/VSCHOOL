import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveAppTabAlias,
  filterUnifiedStudents,
  buildUnifiedHRRecords,
  filterUnifiedHRRecords,
  filterLibraryCirculation,
} from './streamlinedHelpers';
import type { BookReservation, BorrowTransaction, SchoolClass } from '../types';

test('resolveAppTabAlias maps removed/legacy tabs cleanly to streamlined tabs', () => {
  assert.equal(resolveAppTabAlias('admin', 'catalogs'), 'overview');
  assert.equal(resolveAppTabAlias('admin', 'logs'), 'overview');
  assert.equal(resolveAppTabAlias('admin', 'users'), 'users');

  assert.equal(resolveAppTabAlias('school', 'students'), 'students-classes');
  assert.equal(resolveAppTabAlias('school', 'classes'), 'students-classes');
  assert.equal(resolveAppTabAlias('school', 'years'), 'students-classes');
  assert.equal(resolveAppTabAlias('school', 'teachers'), 'staff-hr');
  assert.equal(resolveAppTabAlias('school', 'staff'), 'staff-hr');
  assert.equal(resolveAppTabAlias('school', 'emulation'), 'emulation');
  assert.equal(resolveAppTabAlias('school', 'rules'), 'emulation');
  assert.equal(resolveAppTabAlias('school', 'violations'), 'emulation');
  assert.equal(resolveAppTabAlias('school', 'rankings'), 'emulation');
  assert.equal(resolveAppTabAlias('school', 'competitions'), 'emulation');

  assert.equal(resolveAppTabAlias('learning', 'attendance'), 'timetable');
  assert.equal(resolveAppTabAlias('learning', 'grades'), 'timetable');
  assert.equal(resolveAppTabAlias('learning', 'schedule'), 'schedule');

  assert.equal(resolveAppTabAlias('library', 'copies'), 'catalog');
  assert.equal(resolveAppTabAlias('library', 'borrow'), 'circulation');
  assert.equal(resolveAppTabAlias('library', 'return'), 'circulation');
  assert.equal(resolveAppTabAlias('library', 'renew'), 'circulation');
  assert.equal(resolveAppTabAlias('library', 'reservations'), 'circulation');
  assert.equal(resolveAppTabAlias('library', 'overdue'), 'circulation');

  assert.equal(resolveAppTabAlias('services', 'feedback'), 'surveys');
  assert.equal(resolveAppTabAlias('services', 'support'), 'surveys');
  assert.equal(resolveAppTabAlias('services', 'leave'), 'leave');

  assert.equal(resolveAppTabAlias('subjects', 'subjects'), 'overview');
  assert.equal(resolveAppTabAlias('subjects', 'lingo'), 'english');
  assert.equal(resolveAppTabAlias('subjects', 'mathbuddy'), 'math');
  assert.equal(resolveAppTabAlias('subjects', 'physics'), 'physics');
  assert.equal(resolveAppTabAlias('subjects', 'ly'), 'physics');
  assert.equal(resolveAppTabAlias('subjects', 'vatly'), 'physics');
  assert.equal(resolveAppTabAlias('subjects', 'chemistry'), 'chemistry');
  assert.equal(resolveAppTabAlias('subjects', 'hoa'), 'chemistry');
  assert.equal(resolveAppTabAlias('subjects', 'hoahoc'), 'chemistry');
  assert.equal(resolveAppTabAlias('subjects', 'chemilab'), 'chemistry');
  assert.equal(resolveAppTabAlias('subjects', 'literature'), 'literature');
  assert.equal(resolveAppTabAlias('subjects', 'van'), 'literature');
  assert.equal(resolveAppTabAlias('subjects', 'nguvan'), 'literature');
  assert.equal(resolveAppTabAlias('subjects', 'ngu-van'), 'literature');
  assert.equal(resolveAppTabAlias('subjects', 'trangvan'), 'literature');
  assert.equal(resolveAppTabAlias('subjects', 'trang-van'), 'literature');
  assert.equal(resolveAppTabAlias('subjects', 'vanhien'), 'literature');
  assert.equal(resolveAppTabAlias('subjects', 'van-hien'), 'literature');
  assert.equal(resolveAppTabAlias('subjects', 'history'), 'history');
  assert.equal(resolveAppTabAlias('subjects', 'su'), 'history');
  assert.equal(resolveAppTabAlias('subjects', 'lichsu'), 'history');
  assert.equal(resolveAppTabAlias('subjects', 'lich-su'), 'history');
  assert.equal(resolveAppTabAlias('subjects', 'suky'), 'history');
  assert.equal(resolveAppTabAlias('subjects', 'su-ky'), 'history');
  assert.equal(resolveAppTabAlias('subjects', 'geography'), 'geography');
  assert.equal(resolveAppTabAlias('subjects', 'dia'), 'geography');
  assert.equal(resolveAppTabAlias('subjects', 'dialy'), 'geography');
  assert.equal(resolveAppTabAlias('subjects', 'dia-ly'), 'geography');
  assert.equal(resolveAppTabAlias('subjects', 'atlat'), 'geography');

  assert.equal(resolveAppTabAlias('analytics', 'dashboard'), 'dashboard');
  assert.equal(resolveAppTabAlias('analytics', 'ai-assistant'), 'dashboard');
  assert.equal(resolveAppTabAlias('ai-assistant', 'chat'), 'chat');
  assert.equal(resolveAppTabAlias('ai-assistant', 'copilot'), 'chat');
  assert.equal(resolveAppTabAlias('ai-assistant', 'ai-assistant'), 'chat');
  assert.equal(resolveAppTabAlias('ai-assistant', 'prompts'), 'prompts');
  assert.equal(resolveAppTabAlias('ai-assistant', 'suggestions'), 'prompts');
});

test('filterUnifiedStudents filters across academicYear, grade, classId, and search', () => {
  const classes: SchoolClass[] = [
    { id: 'C1', code: '10A1', name: '10A1', grade: 10, academicYear: '2026-2027', room: 'A101', homeroomTeacherId: 'T1', homeroomTeacherName: 'Thầy A', studentCount: 1 },
    { id: 'C2', code: '11A1', name: '11A1', grade: 11, academicYear: '2025-2026', room: 'B201', homeroomTeacherId: 'T2', homeroomTeacherName: 'Cô B', studentCount: 1 },
  ];
  const students = [
    { id: 'S1', studentCode: 'HS01', fullName: 'Nguyễn Minh An', classId: 'C1', className: '10A1', grade: 10, rfidCardId: 'RF01', dateOfBirth: '2010-01-01', gender: 'Nam' as const, parentPhone: '0901', status: 'Đang học' as const, address: 'HN' },
    { id: 'S2', studentCode: 'HS02', fullName: 'Trần Thu Hà', classId: 'C2', className: '11A1', grade: 11, rfidCardId: 'RF02', dateOfBirth: '2009-02-02', gender: 'Nữ' as const, parentPhone: '0902', status: 'Đang học' as const, address: 'HN' },
  ];

  assert.equal(filterUnifiedStudents({ students, classes, academicYear: '2026-2027' }).length, 1);
  assert.equal(filterUnifiedStudents({ students, classes, grade: '11' })[0].id, 'S2');
  assert.equal(filterUnifiedStudents({ students, classes, search: 'RF01' })[0].id, 'S1');
});

test('buildUnifiedHRRecords & filterUnifiedHRRecords separate BGH, teachers, and staff cleanly', () => {
  const teachers = [
    { id: 'T1', fullName: 'Cô Hiệu Trưởng', subject: 'Quản lý', email: 'ht@edu', phone: '091', isHomeroom: false, assignedClasses: [], status: 'Đang công tác' as const, role: 'principal' as const },
    { id: 'T2', fullName: 'Thầy Toán', subject: 'Toán', email: 'toan@edu', phone: '092', isHomeroom: true, homeroomClassName: '10A1', assignedClasses: ['10A1'], status: 'Đang công tác' as const, role: 'homeroom_teacher' as const },
  ];
  const staff = [
    { id: 'NV1', staffCode: 'NV-01', fullName: 'Anh Kỹ Thuật', department: 'Cơ sở vật chất', position: 'Kỹ thuật viên', email: 'kt@edu', phone: '093', status: 'Đang công tác' as const },
  ];
  const unified = buildUnifiedHRRecords(teachers, staff);
  assert.equal(unified.length, 3);
  assert.equal(filterUnifiedHRRecords({ records: unified, groupFilter: 'bgh' }).length, 1);
  assert.equal(filterUnifiedHRRecords({ records: unified, groupFilter: 'teacher' }).length, 1);
  assert.equal(filterUnifiedHRRecords({ records: unified, groupFilter: 'staff', search: 'Kỹ thuật' }).length, 1);
});

test('filterLibraryCirculation isolates active borrowed, overdue, reserved, and returned records', () => {
  const transactions: BorrowTransaction[] = [
    { id: 'TX1', transactionCode: 'PM-1', studentId: 'S1', studentName: 'An', studentCode: 'HS01', bookId: 'B1', bookTitle: 'Toán', copyBarcode: 'BC1', borrowDate: '2026-11-01', dueDate: '2026-11-20', status: 'borrowed' },
    { id: 'TX2', transactionCode: 'PM-2', studentId: 'S2', studentName: 'Bình', studentCode: 'HS02', bookId: 'B2', bookTitle: 'Văn', copyBarcode: 'BC2', borrowDate: '2026-10-01', dueDate: '2026-10-10', status: 'overdue' },
    { id: 'TX3', transactionCode: 'PM-3', studentId: 'S1', studentName: 'An', studentCode: 'HS01', bookId: 'B3', bookTitle: 'Anh', copyBarcode: 'BC3', borrowDate: '2026-09-01', dueDate: '2026-09-10', returnDate: '2026-09-08', status: 'returned' },
  ];
  const reservations: BookReservation[] = [
    { id: 'R1', bookId: 'B1', bookTitle: 'Toán', studentId: 'S1', studentName: 'An', studentCode: 'HS01', reservedAt: '2026-11-12', pickupDeadline: '2026-11-15', status: 'pending' },
  ];
  const isTxOverdue = (tx: BorrowTransaction) => tx.status === 'overdue';

  assert.equal(filterLibraryCirculation({ transactions, reservations, statusFilter: 'all', search: '', isTxOverdue }).transactions.length, 2);
  assert.equal(filterLibraryCirculation({ transactions, reservations, statusFilter: 'all', search: '', isTxOverdue }).reservations.length, 1);
  assert.equal(filterLibraryCirculation({ transactions, reservations, statusFilter: 'overdue', search: '', isTxOverdue }).transactions[0].id, 'TX2');
  assert.equal(filterLibraryCirculation({ transactions, reservations, statusFilter: 'returned', search: '', isTxOverdue }).transactions[0].id, 'TX3');
  assert.equal(filterLibraryCirculation({ transactions, reservations, statusFilter: 'reserved', search: '', isTxOverdue }).reservations.length, 1);
});
