import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LIBRARY_POLICY,
  checkBorrowEligibility,
  calculateDueDate,
  checkIsOverdue,
  generateBookCopiesForBook,
  canRenewTransaction,
  applyLibrarianDueDateEdit,
  sanitizeScanInput,
  isDuplicateScan,
  computeInventoryAuditDiff,
} from './libraryRules';
import type { Book, BookCopy, BorrowTransaction } from '../types';

test('Students borrow limits respect configurable per-group LibraryPolicyConfig and legacy overrides', () => {
  const result1 = checkBorrowEligibility('student', 2);
  assert.equal(result1.eligible, true);
  assert.equal(result1.maxAllowed, 3);

  const result2 = checkBorrowEligibility('student', 3);
  assert.equal(result2.eligible, false);
  assert.match(result2.reason || '', /Đã đạt giới hạn/);

  const custom = checkBorrowEligibility('student', 3, false, { maxBorrowLimit: 5, defaultLoanDays: 21 });
  assert.equal(custom.eligible, true);
  assert.equal(custom.maxAllowed, 5);
  assert.equal(custom.loanDays, 21);

  const policyOverride = structuredClone(DEFAULT_LIBRARY_POLICY);
  policyOverride.student.maxBooks = 6;
  policyOverride.student.loanDays = 10;
  policyOverride.student.reborrowCooldownDays = 3;

  const withPolicy = checkBorrowEligibility(
    'student',
    5,
    false,
    { libraryPolicy: policyOverride },
    '2026-10-19',
    new Date('2026-10-20T00:00:00Z')
  );
  assert.equal(withPolicy.eligible, false);
  assert.match(withPolicy.reason || '', /nghỉ mượn lại/);
});

test('Overdue books block new loans regardless of quota', () => {
  const result = checkBorrowEligibility('student', 1, true);
  assert.equal(result.eligible, false);
  assert.match(result.reason || '', /sách quá hạn/);
});

test('calculateDueDate correctly advances date by loanDays', () => {
  const baseDate = new Date('2026-10-01T00:00:00.000Z');
  const due = calculateDueDate(baseDate, 14);
  assert.equal(due, '2026-10-15');
});

test('checkIsOverdue detects overdue date correctly', () => {
  const refDate = new Date('2026-10-20T00:00:00.000Z');
  const pastDue = checkIsOverdue('2026-10-15', refDate);
  assert.equal(pastDue.isOverdue, true);
  assert.equal(pastDue.daysOverdue, 5);

  const futureDue = checkIsOverdue('2026-10-25', refDate);
  assert.equal(futureDue.isOverdue, false);
  assert.equal(futureDue.daysOverdue, 0);
});

test('generateBookCopiesForBook creates physical copies up to totalCopies', () => {
  const book: Book = {
    id: 'BOK-001',
    isbn: '978-604',
    title: 'Toán nâng cao',
    author: 'TG',
    category: 'Toán học',
    publisher: 'GD',
    publishYear: 2025,
    totalCopies: 3,
    availableCopies: 3,
    shelfLocation: 'Kệ A1',
    coverUrl: '',
    description: '',
  };
  const copies = generateBookCopiesForBook(book, []);
  assert.equal(copies.length, 3);
  assert.equal(copies[0].copyBarcode, 'BOK-001-C01');
  assert.equal(copies[2].copyBarcode, 'BOK-001-C03');
});

test('canRenewTransaction respects policy maxRenewals, maxDays, and reservation queue', () => {
  const tx: BorrowTransaction = {
    id: 'TX-1',
    transactionCode: 'LIB-1',
    studentId: 'S1',
    studentName: 'An',
    studentCode: 'STU-1',
    borrowerRole: 'student',
    bookId: 'B1',
    bookTitle: 'Toán',
    copyBarcode: 'B1-C01',
    borrowDate: '2026-10-01',
    dueDate: '2026-10-15',
    status: 'borrowed',
    renewCount: 0,
  };
  const ok = canRenewTransaction(tx, [], new Date('2026-10-10T00:00:00Z'));
  assert.equal(ok.allowed, true);
  assert.equal(ok.newDueDate, '2026-10-22');

  const blockedByQueue = canRenewTransaction(
    tx,
    [
      {
        id: 'R1',
        bookId: 'B1',
        bookTitle: 'Toán',
        studentId: 'S2',
        studentName: 'Bình',
        studentCode: 'STU-2',
        reservedAt: '2026-10-09',
        pickupDeadline: '2026-10-16',
        status: 'pending',
      },
    ],
    new Date('2026-10-10T00:00:00Z')
  );
  assert.equal(blockedByQueue.allowed, false);
});

test('applyLibrarianDueDateEdit requires valid reason, updates status, and appends immutable audit history', () => {
  const tx: BorrowTransaction = {
    id: 'TX-OVER',
    transactionCode: 'LIB-OVER',
    studentId: 'S1',
    studentName: 'An',
    studentCode: 'STU-1',
    bookId: 'B1',
    bookTitle: 'Văn học',
    copyBarcode: 'B1-C02',
    borrowDate: '2026-10-01',
    dueDate: '2026-10-10',
    status: 'overdue',
  };

  const missingReason = applyLibrarianDueDateEdit({
    transaction: tx,
    newDueDate: '2026-10-28',
    reason: ' ',
    changedBy: 'Thủ thư Lan',
    changedByRole: 'librarian',
    referenceDate: new Date('2026-10-20T00:00:00Z'),
  });
  assert.equal(missingReason.valid, false);

  const earlierThanBorrow = applyLibrarianDueDateEdit({
    transaction: tx,
    newDueDate: '2026-09-25',
    reason: 'Điều chỉnh ngày',
    changedBy: 'Thủ thư Lan',
    changedByRole: 'librarian',
    referenceDate: new Date('2026-10-20T00:00:00Z'),
  });
  assert.equal(earlierThanBorrow.valid, false);

  const edited = applyLibrarianDueDateEdit({
    transaction: tx,
    newDueDate: '2026-10-28',
    reason: 'Học sinh tham gia thi học sinh giỏi cấp tỉnh',
    changedBy: 'Thủ thư Lan',
    changedByRole: 'librarian',
    referenceDate: new Date('2026-10-20T00:00:00Z'),
  });
  assert.equal(edited.valid, true);
  assert.equal(edited.updatedTransaction?.dueDate, '2026-10-28');
  assert.equal(edited.updatedTransaction?.status, 'borrowed');
  assert.equal(edited.historyEntry?.oldDueDate, '2026-10-10');
  assert.equal(edited.historyEntry?.newDueDate, '2026-10-28');
  assert.equal(edited.historyEntry?.actionType, 'due_date_edited');
});

test('sanitizeScanInput and isDuplicateScan guard HID scanner inputs', () => {
  assert.equal(sanitizeScanInput('  rfid-0012\r\n '), 'RFID-0012');
  assert.equal(isDuplicateScan('RFID-0012', { code: 'RFID-0012', timestampMs: 1000 }, 1500), true);
  assert.equal(isDuplicateScan('RFID-0012', { code: 'RFID-0012', timestampMs: 1000 }, 3000), false);
});

test('computeInventoryAuditDiff reconciles scanned barcodes against expected physical copies', () => {
  const copies: BookCopy[] = [
    { id: 'C1', bookId: 'B1', copyBarcode: 'B1-C01', rfidTag: 'TAG-1', status: 'available', condition: 'Tốt', updatedAt: '2026-10-01' },
    { id: 'C2', bookId: 'B1', copyBarcode: 'B1-C02', rfidTag: 'TAG-2', status: 'borrowed', condition: 'Tốt', updatedAt: '2026-10-01' },
  ];
  const diff = computeInventoryAuditDiff(copies, ['TAG-1', 'UNKNOWN-99']);
  assert.equal(diff.totalCopiesExpected, 2);
  assert.equal(diff.matchedCount, 1);
  assert.deepEqual(diff.missingBarcodes, ['B1-C02']);
  assert.deepEqual(diff.unknownBarcodes, ['UNKNOWN-99']);
});
