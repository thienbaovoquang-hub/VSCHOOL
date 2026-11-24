import {
  Book,
  BookCopy,
  BookReservation,
  BorrowTransaction,
  InventoryAudit,
  LibraryBorrowerGroup,
  LibraryPolicyConfig,
  LibraryRolePolicy,
  LibraryTransactionHistoryEntry,
  SystemSettings,
  UserRole,
} from '../types';

export const DEFAULT_LIBRARY_POLICY: LibraryPolicyConfig = {
  student: {
    group: 'student',
    label: 'Học sinh',
    loanDays: 14,
    maxDays: 30,
    maxBooks: 3,
    maxRenewals: 1,
    renewDays: 7,
    reborrowCooldownDays: 0,
    allowOverdueRenewal: false,
    overdueFinePerDay: 2000,
  },
  teacher: {
    group: 'teacher',
    label: 'Giáo viên',
    loanDays: 30,
    maxDays: 60,
    maxBooks: 10,
    maxRenewals: 2,
    renewDays: 14,
    reborrowCooldownDays: 0,
    allowOverdueRenewal: false,
    overdueFinePerDay: 0,
  },
  staff: {
    group: 'staff',
    label: 'Nhân viên & Quản lý',
    loanDays: 21,
    maxDays: 45,
    maxBooks: 8,
    maxRenewals: 2,
    renewDays: 10,
    reborrowCooldownDays: 0,
    allowOverdueRenewal: false,
    overdueFinePerDay: 0,
  },
};

export const BORROW_LIMITS: Record<UserRole, number> = {
  student: DEFAULT_LIBRARY_POLICY.student.maxBooks,
  homeroom_teacher: DEFAULT_LIBRARY_POLICY.teacher.maxBooks,
  subject_teacher: DEFAULT_LIBRARY_POLICY.teacher.maxBooks,
  admin: DEFAULT_LIBRARY_POLICY.staff.maxBooks,
  principal: DEFAULT_LIBRARY_POLICY.staff.maxBooks,
  librarian: DEFAULT_LIBRARY_POLICY.staff.maxBooks,
  counselor: DEFAULT_LIBRARY_POLICY.staff.maxBooks,
  staff: DEFAULT_LIBRARY_POLICY.staff.maxBooks,
};

export const LOAN_PERIOD_DAYS: Record<UserRole, number> = {
  student: DEFAULT_LIBRARY_POLICY.student.loanDays,
  homeroom_teacher: DEFAULT_LIBRARY_POLICY.teacher.loanDays,
  subject_teacher: DEFAULT_LIBRARY_POLICY.teacher.loanDays,
  admin: DEFAULT_LIBRARY_POLICY.staff.loanDays,
  principal: DEFAULT_LIBRARY_POLICY.staff.loanDays,
  librarian: DEFAULT_LIBRARY_POLICY.staff.loanDays,
  counselor: DEFAULT_LIBRARY_POLICY.staff.loanDays,
  staff: DEFAULT_LIBRARY_POLICY.staff.loanDays,
};

export function getBorrowerPolicyGroup(role: UserRole): LibraryBorrowerGroup {
  if (role === 'student') return 'student';
  if (role === 'homeroom_teacher' || role === 'subject_teacher') return 'teacher';
  return 'staff';
}

export function getEffectiveLibraryPolicy(
  role: UserRole,
  settings?: Partial<Pick<SystemSettings, 'libraryPolicy' | 'defaultLoanDays' | 'maxBorrowLimit'>>
): LibraryRolePolicy {
  const group = getBorrowerPolicyGroup(role);
  const configured = settings?.libraryPolicy?.[group];
  const base = configured
    ? { ...DEFAULT_LIBRARY_POLICY[group], ...configured }
    : { ...DEFAULT_LIBRARY_POLICY[group] };

  // Backward compatibility if legacy global overrides exist without explicit per-group config
  if (!settings?.libraryPolicy && role === 'student') {
    if (settings?.maxBorrowLimit && settings.maxBorrowLimit > 0) {
      base.maxBooks = settings.maxBorrowLimit;
    }
    if (settings?.defaultLoanDays && settings.defaultLoanDays > 0) {
      base.loanDays = settings.defaultLoanDays;
    }
  }

  return base;
}

export interface BorrowEligibility {
  eligible: boolean;
  reason?: string;
  maxAllowed: number;
  currentBorrowedCount: number;
  loanDays: number;
  policy: LibraryRolePolicy;
}

export function checkBorrowEligibility(
  role: UserRole,
  activeBorrowedCount: number,
  hasOverdueBooks: boolean = false,
  settingsOverride?: Partial<Pick<SystemSettings, 'maxBorrowLimit' | 'defaultLoanDays' | 'libraryPolicy'>>,
  recentReturnedSameBookDate?: string,
  referenceDate: Date = new Date()
): BorrowEligibility {
  const policy = getEffectiveLibraryPolicy(role, settingsOverride);
  const maxAllowed = Math.max(1, policy.maxBooks);
  const loanDays = Math.max(1, Math.min(policy.loanDays, policy.maxDays || policy.loanDays));

  if (hasOverdueBooks) {
    return {
      eligible: false,
      reason: 'Tài khoản đang có sách quá hạn chưa hoàn trả. Vui lòng trả sách trước khi mượn mới.',
      maxAllowed,
      currentBorrowedCount: activeBorrowedCount,
      loanDays,
      policy,
    };
  }

  if (activeBorrowedCount >= maxAllowed) {
    return {
      eligible: false,
      reason: `Đã đạt giới hạn mượn tối đa (${maxAllowed} cuốn) cho nhóm ${policy.label}.`,
      maxAllowed,
      currentBorrowedCount: activeBorrowedCount,
      loanDays,
      policy,
    };
  }

  if (policy.reborrowCooldownDays > 0 && recentReturnedSameBookDate) {
    const returned = new Date(`${recentReturnedSameBookDate}T00:00:00Z`);
    if (!Number.isNaN(returned.getTime())) {
      const diffDays = Math.floor((referenceDate.getTime() - returned.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < policy.reborrowCooldownDays) {
        return {
          eligible: false,
          reason: `Cần chờ hết thời gian nghỉ mượn lại (${policy.reborrowCooldownDays} ngày, còn ${policy.reborrowCooldownDays - diffDays} ngày).`,
          maxAllowed,
          currentBorrowedCount: activeBorrowedCount,
          loanDays,
          policy,
        };
      }
    }
  }

  return {
    eligible: true,
    maxAllowed,
    currentBorrowedCount: activeBorrowedCount,
    loanDays,
    policy,
  };
}

export function calculateDueDate(borrowDate: Date, loanDays: number): string {
  const due = new Date(borrowDate);
  due.setDate(due.getDate() + loanDays);
  return due.toISOString().split('T')[0];
}

export function checkIsOverdue(
  dueDateStr: string,
  referenceDate: Date = new Date()
): { isOverdue: boolean; daysOverdue: number } {
  const dueDate = new Date(dueDateStr);
  if (Number.isNaN(dueDate.getTime())) {
    return { isOverdue: false, daysOverdue: 0 };
  }
  const refDay = new Date(referenceDate.toISOString().split('T')[0]);
  const dueDay = new Date(dueDateStr.split('T')[0]);
  const diffTime = refDay.getTime() - dueDay.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return { isOverdue: true, daysOverdue: diffDays };
  }
  return { isOverdue: false, daysOverdue: 0 };
}

export function getDaysRemaining(dueDateStr: string, referenceDate: Date = new Date()): number {
  const refDay = new Date(referenceDate.toISOString().split('T')[0]);
  const dueDay = new Date(dueDateStr.split('T')[0]);
  if (Number.isNaN(dueDay.getTime())) return 0;
  return Math.floor((dueDay.getTime() - refDay.getTime()) / (1000 * 60 * 60 * 24));
}

export function generateBookCopiesForBook(
  book: Book,
  existingCopies: BookCopy[]
): BookCopy[] {
  const forBook = existingCopies.filter((c) => c.bookId === book.id);
  const missingCount = Math.max(0, book.totalCopies - forBook.length);
  if (missingCount === 0) return [];

  const now = new Date().toISOString();
  const created: BookCopy[] = [];
  for (let i = 0; i < missingCount; i++) {
    const seq = forBook.length + i + 1;
    const suffix = String(seq).padStart(2, '0');
    const barcode = `${book.id}-C${suffix}`;
    created.push({
      id: `COPY-${barcode}`,
      bookId: book.id,
      copyBarcode: barcode,
      rfidTag: `TAG-${book.id.replace(/[^A-Z0-9]/gi, '').slice(-6)}-${suffix}`,
      status: 'available',
      condition: 'Tốt',
      updatedAt: now,
    });
  }
  return created;
}

export function canRenewTransaction(
  tx: BorrowTransaction,
  reservations: BookReservation[],
  referenceDate: Date = new Date(),
  settings?: Partial<Pick<SystemSettings, 'libraryPolicy' | 'defaultLoanDays' | 'maxBorrowLimit'>>
): { allowed: boolean; reason?: string; newDueDate?: string; renewDays?: number } {
  if (tx.status !== 'borrowed' && tx.status !== 'overdue') {
    return { allowed: false, reason: 'Chỉ có thể gia hạn phiếu đang mượn.' };
  }
  const policy = getEffectiveLibraryPolicy(tx.borrowerRole || 'student', settings);
  const overdueCheck = checkIsOverdue(tx.dueDate, referenceDate);

  if (overdueCheck.isOverdue && !policy.allowOverdueRenewal) {
    return { allowed: false, reason: 'Sách đã quá hạn trả, không thể gia hạn theo chính sách hiện hành.' };
  }
  if ((tx.renewCount ?? 0) >= policy.maxRenewals) {
    return {
      allowed: false,
      reason: `Mỗi lượt mượn chỉ được gia hạn tối đa ${policy.maxRenewals} lần (${policy.label}).`,
    };
  }
  const hasWaitingQueue = reservations.some(
    (r) => r.bookId === tx.bookId && (r.status === 'pending' || r.status === 'ready')
  );
  if (hasWaitingQueue) {
    return { allowed: false, reason: 'Đầu sách đang có người đặt giữ chỗ, không thể gia hạn.' };
  }

  const renewDays = Math.max(1, policy.renewDays);
  const nextDue = calculateDueDate(new Date(`${tx.dueDate}T00:00:00Z`), renewDays);
  const borrowDateObj = new Date(`${tx.borrowDate}T00:00:00Z`);
  const nextDueObj = new Date(`${nextDue}T00:00:00Z`);
  const totalDays = Math.floor((nextDueObj.getTime() - borrowDateObj.getTime()) / (1000 * 60 * 60 * 24));

  if (policy.maxDays > 0 && totalDays > policy.maxDays) {
    const cappedDue = calculateDueDate(borrowDateObj, policy.maxDays);
    if (cappedDue <= tx.dueDate) {
      return {
        allowed: false,
        reason: `Đã chạm tổng thời gian mượn tối đa (${policy.maxDays} ngày).`,
      };
    }
    return { allowed: true, newDueDate: cappedDue, renewDays };
  }

  return { allowed: true, newDueDate: nextDue, renewDays };
}

export function applyLibrarianDueDateEdit(params: {
  transaction: BorrowTransaction;
  newDueDate: string;
  reason: string;
  changedBy: string;
  changedByRole: UserRole;
  referenceDate?: Date;
}): {
  valid: boolean;
  error?: string;
  updatedTransaction?: BorrowTransaction;
  historyEntry?: LibraryTransactionHistoryEntry;
} {
  const { transaction, newDueDate, reason, changedBy, changedByRole, referenceDate = new Date() } = params;

  if (transaction.status === 'returned' || transaction.status === 'lost') {
    return { valid: false, error: 'Không thể chỉnh sửa hạn trả cho giao dịch đã hoàn tất.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDueDate)) {
    return { valid: false, error: 'Ngày hạn trả mới phải đúng định dạng YYYY-MM-DD.' };
  }
  if (newDueDate < transaction.borrowDate) {
    return { valid: false, error: 'Hạn trả mới không được sớm hơn ngày mượn sách.' };
  }
  const cleanReason = reason.trim();
  if (cleanReason.length < 3) {
    return { valid: false, error: 'Vui lòng nhập lý do điều chỉnh hạn trả (tối thiểu 3 ký tự).' };
  }
  if (newDueDate === transaction.dueDate) {
    return { valid: false, error: 'Hạn trả mới trùng với hạn trả hiện tại.' };
  }

  const overdueResult = checkIsOverdue(newDueDate, referenceDate);
  const nextStatus: BorrowTransaction['status'] = overdueResult.isOverdue ? 'overdue' : 'borrowed';
  const nowIso = new Date().toISOString();

  const historyEntry: LibraryTransactionHistoryEntry = {
    id: `LTH-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    transactionId: transaction.id,
    transactionCode: transaction.transactionCode,
    bookTitle: transaction.bookTitle,
    borrowerName: transaction.studentName,
    actionType: 'due_date_edited',
    oldDueDate: transaction.dueDate,
    newDueDate,
    changedBy,
    changedByRole,
    changedAt: nowIso,
    reason: cleanReason,
  };

  const updatedTransaction: BorrowTransaction = {
    ...transaction,
    dueDate: newDueDate,
    status: nextStatus,
    dueDateHistory: [historyEntry, ...(transaction.dueDateHistory || [])],
  };

  return {
    valid: true,
    updatedTransaction,
    historyEntry,
  };
}

export function sanitizeScanInput(raw: string): string {
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .toUpperCase();
}

export function isDuplicateScan(
  code: string,
  lastScan: { code: string; timestampMs: number } | null,
  nowMs: number,
  windowMs: number = 1500
): boolean {
  if (!lastScan) return false;
  return lastScan.code === code && nowMs - lastScan.timestampMs < windowMs;
}

export function computeInventoryAuditDiff(
  copies: BookCopy[],
  scannedBarcodes: string[]
): Pick<InventoryAudit, 'totalCopiesExpected' | 'matchedCount' | 'missingBarcodes'> & {
  unknownBarcodes: string[];
} {
  const expectedCopies = copies.filter((c) => c.status !== 'lost');
  const scannedSet = new Set(scannedBarcodes.map(sanitizeScanInput).filter(Boolean));
  const expectedMap = new Map<string, BookCopy>();
  for (const c of expectedCopies) {
    expectedMap.set(sanitizeScanInput(c.copyBarcode), c);
    if (c.rfidTag) {
      expectedMap.set(sanitizeScanInput(c.rfidTag), c);
    }
  }

  const matchedIds = new Set<string>();
  const unknownBarcodes: string[] = [];

  for (const code of scannedSet) {
    const found = expectedMap.get(code);
    if (found) {
      matchedIds.add(found.id);
    } else {
      unknownBarcodes.push(code);
    }
  }

  const missingBarcodes = expectedCopies
    .filter((c) => !matchedIds.has(c.id))
    .map((c) => c.copyBarcode);

  return {
    totalCopiesExpected: expectedCopies.length,
    matchedCount: matchedIds.size,
    missingBarcodes,
    unknownBarcodes,
  };
}
