import React, { useState, useMemo, useRef } from 'react';
import {
  BookOpen,
  ScanLine,
  BookPlus,
  BookCheck,
  Bookmark,
  Clock,
  Search,
  Plus,
  CreditCard,
  Barcode,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Trash2,
  Usb,
  Eye,
  XCircle,
  LayoutDashboard,
  Layers,
  Calendar,
  ArrowRight,
  Download,
  History,
  ClipboardCheck,
} from 'lucide-react';
import {
  Book,
  BookCopy,
  BookReservation,
  BorrowTransaction,
  DataSourceConfig,
  DataSourceGroupKey,
  DataSourceMethod,
  ExportHistoryRecord,
  ImportHistoryRecord,
  ImportModuleKey,
  InventoryAudit,
  LibraryRenewalRequest,
  LibraryTransactionHistoryEntry,
  PermissionMatrix,
  StaffMember,
  Student,
  SystemSettings,
  Teacher,
  UserProfile,
  UserRole,
} from '../../types';
import { AppWindowShell } from '../shared/AppWindowShell';
import { EmptyState } from '../shared/EmptyState';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { BulkSelectionBar } from '../shared/BulkSelectionBar';
import { LiquidCard } from '../common/LiquidCard';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { ModuleDataActions } from '../importExport/ModuleDataActions';
import { DataSourceButton } from '../dataSources/DataSourceButton';
import { DataSourceModal } from '../dataSources/DataSourceModal';
import type {
  DataSourceExistingData,
  DataSourceRuntimeContext,
  GroupValidationResult,
} from '../../utils/dataSources/templateEngine';
import { LibraryPolicySettingsPanel } from '../library/LibraryPolicySettingsPanel';
import { LibraryDueDateModal } from '../library/LibraryDueDateModal';
import { LibraryRenewalsPanel } from '../library/LibraryRenewalsPanel';
import type { ValidationDbContext } from '../../utils/importExport/validator';
import { resolveCatalogOptions } from '../../utils/catalogs/catalogRegistry';
import {
  canRenewTransaction,
  checkBorrowEligibility,
  checkIsOverdue,
  computeInventoryAuditDiff,
  getDaysRemaining,
  getEffectiveLibraryPolicy,
  isDuplicateScan,
  sanitizeScanInput,
} from '../../utils/libraryRules';
import {
  filterLibraryCirculation,
  type CirculationStatusFilter,
} from '../../utils/streamlinedHelpers';
import { DEFAULT_PERMISSIONS, hasPermission, userHasRole } from '../../utils/rbac';
import { exportToExcel } from '../../firebase/services';
import {
  areAllVisibleSelected,
  pruneStaleSelectedIds,
  toggleSelectAllVisible,
  toggleSelectedId,
} from '../../utils/bulkSelection';
import confetti from 'canvas-confetti';

interface LibraryAppProps {
  activeTab: string;
  currentUser: UserProfile;
  customPermissions?: PermissionMatrix;
  validationContext?: ValidationDbContext;
  books: Book[];
  bookCopies: BookCopy[];
  transactions: BorrowTransaction[];
  reservations: BookReservation[];
  renewalRequests?: LibraryRenewalRequest[];
  transactionHistory?: LibraryTransactionHistoryEntry[];
  inventoryAudits: InventoryAudit[];
  students: Student[];
  teachers: Teacher[];
  staffMembers: StaffMember[];
  systemSettings: SystemSettings;
  dataSourceConfigs?: DataSourceConfig[];
  isAdmin?: boolean;
  dataSourceRuntimeContext?: DataSourceRuntimeContext;
  dataSourceExistingData?: DataSourceExistingData;
  onSaveDataSourceConfig?: (cfg: DataSourceConfig) => Promise<void>;
  onDeleteDataSourceConfig?: (id: string) => Promise<void>;
  onCommitNormalizedGroupData?: (
    groupKey: DataSourceGroupKey,
    validation: GroupValidationResult,
    sourceMeta: { method: DataSourceMethod; sourceName: string }
  ) => Promise<{ createdCount: number; updatedCount: number }>;
  onSelectTab: (tabId: string) => void;
  onSaveSettings?: (settings: SystemSettings) => Promise<void> | void;
  onBorrowBook: (
    borrower: { id: string; fullName: string; code: string; role: UserRole },
    book: Book,
    copyBarcode: string,
    copyId?: string
  ) => Promise<void>;
  onReturnBook: (
    transactionId: string,
    conditionOnReturn?: BorrowTransaction['conditionOnReturn'],
    fineAmount?: number
  ) => Promise<void>;
  onRenewBook: (transactionId: string, newDueDate: string) => Promise<void>;
  onSubmitRenewalRequest?: (req: LibraryRenewalRequest) => Promise<void> | void;
  onApproveRenewalRequest?: (req: LibraryRenewalRequest) => Promise<void> | void;
  onRejectRenewalRequest?: (req: LibraryRenewalRequest, note: string) => Promise<void> | void;
  onEditDueDate?: (transactionId: string, newDueDate: string, reason: string) => Promise<void> | void;
  onAddBook: (book: Book) => void;
  onDeleteBook: (bookId: string) => void;
  onDeleteBooks?: (bookIds: string[]) => Promise<void> | void;
  onImportBooks: (books: Book[]) => void;
  onSaveBookCopy: (copy: BookCopy) => void;
  onSaveReservation: (res: BookReservation) => void;
  onSaveInventoryAudit: (audit: InventoryAudit) => void;
  onUnifiedImportCommit?: (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => Promise<void> | void;
  onLogExport?: (record: ExportHistoryRecord) => Promise<void> | void;
}

export const LibraryApp: React.FC<LibraryAppProps> = ({
  activeTab,
  currentUser,
  customPermissions = DEFAULT_PERMISSIONS,
  validationContext,
  books,
  bookCopies,
  transactions,
  reservations,
  renewalRequests = [],
  transactionHistory = [],
  inventoryAudits,
  students,
  teachers,
  staffMembers,
  systemSettings,
  dataSourceConfigs = [],
  isAdmin = false,
  dataSourceRuntimeContext,
  dataSourceExistingData,
  onSaveDataSourceConfig,
  onDeleteDataSourceConfig,
  onCommitNormalizedGroupData,
  onSelectTab,
  onSaveSettings,
  onBorrowBook,
  onReturnBook,
  onRenewBook,
  onSubmitRenewalRequest,
  onApproveRenewalRequest,
  onRejectRenewalRequest,
  onEditDueDate,
  onAddBook,
  onDeleteBook,
  onDeleteBooks,
  onImportBooks,
  onSaveBookCopy,
  onSaveReservation,
  onSaveInventoryAudit,
  onUnifiedImportCommit,
  onLogExport,
}) => {
  const canManageCatalog = hasPermission(currentUser, 'library', 'approve', customPermissions);
  const canCheckout = hasPermission(currentUser, 'library', 'create', customPermissions);
  const canDelete = hasPermission(currentUser, 'library', 'delete', customPermissions);
  const canExportLibrary =
    hasPermission(currentUser, 'library', 'export', customPermissions) || canManageCatalog;
  const canMigrateBorrowHistory =
    canManageCatalog && userHasRole(currentUser, ['admin', 'librarian', 'principal']);
  const isPureStudent =
    userHasRole(currentUser, 'student') &&
    !userHasRole(currentUser, ['admin', 'librarian', 'principal', 'homeroom_teacher', 'subject_teacher', 'staff']);

  const effectiveContext: ValidationDbContext = useMemo(
    () =>
      validationContext ?? {
        books,
        bookCopies,
        borrowTransactions: transactions,
        students,
        teachers,
        staffMembers,
        systemSettings,
      },
    [validationContext, books, bookCopies, transactions, students, teachers, staffMembers, systemSettings]
  );

  const bookCategoryOptions = useMemo(
    () => resolveCatalogOptions({ catalogId: 'book_category', runtime: effectiveContext }),
    [effectiveContext]
  );

  const copyStatusOptions = useMemo(
    () =>
      resolveCatalogOptions({ catalogId: 'book_copy_status', runtime: effectiveContext }).filter(
        (o) => o.value !== 'borrowed'
      ),
    [effectiveContext]
  );

  const txStatusOptions = useMemo(
    () => resolveCatalogOptions({ catalogId: 'library_transaction_status', runtime: effectiveContext }),
    [effectiveContext]
  );

  const returnConditionOptions = useMemo(
    () => resolveCatalogOptions({ catalogId: 'book_return_condition', runtime: effectiveContext }),
    [effectiveContext]
  );

  const safeCommitImport = async (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => {
    if (onUnifiedImportCommit) {
      await onUnifiedImportCommit(moduleKey, entitiesToSave, historyRecord);
      return;
    }
    if (moduleKey === 'books') {
      onImportBooks(entitiesToSave as unknown as Book[]);
    } else if (moduleKey === 'book_copies') {
      entitiesToSave.forEach((c) => onSaveBookCopy(c as unknown as BookCopy));
    } else if (moduleKey === 'inventory_audits') {
      entitiesToSave.forEach((a) => onSaveInventoryAudit(a as unknown as InventoryAudit));
    }
  };

  // Catalog state
  const [bookSearch, setBookSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewingBookCopies, setViewingBookCopies] = useState<Book | null>(null);
  const [pendingDeleteBook, setPendingDeleteBook] = useState<Book | null>(null);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [pendingBulkBookIds, setPendingBulkBookIds] = useState<string[] | null>(null);
  const [isBulkDeletingBooks, setIsBulkDeletingBooks] = useState(false);
  const [isBooksDataSourceOpen, setIsBooksDataSourceOpen] = useState(false);

  // Borrow Counter Mode: manual vs integrated RFID/Barcode
  const [borrowMode, setBorrowMode] = useState<'manual' | 'rfid'>('manual');
  const [scannedRfid, setScannedRfid] = useState('');
  const [identifiedBorrower, setIdentifiedBorrower] = useState<{
    id: string;
    fullName: string;
    code: string;
    subtitle: string;
    role: UserRole;
  } | null>(null);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [identifiedBook, setIdentifiedBook] = useState<Book | null>(null);
  const [identifiedCopy, setIdentifiedCopy] = useState<BookCopy | null>(null);
  const [rfidError, setRfidError] = useState<string | null>(null);
  const [rfidSuccess, setRfidSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannerStatus, setScannerStatus] = useState<string>(
    'HID Keyboard-Wedge sẵn sàng (hỗ trợ đầu đọc USB/RFID)'
  );
  const lastScanRef = useRef<{ code: string; timestampMs: number } | null>(null);

  const webSerialSupported = typeof navigator !== 'undefined' && 'serial' in navigator;

  // Manual Borrow Form state
  const [borrowerType, setBorrowerType] = useState<'student' | 'teacher' | 'staff'>('student');
  const [borrowPersonId, setBorrowPersonId] = useState('');
  const [borrowBookId, setBorrowBookId] = useState('');
  const [borrowMessage, setBorrowMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Unified Circulation Desk state
  const [circulationFilter, setCirculationFilter] = useState<CirculationStatusFilter>('all');
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [isRenewalsModalOpen, setIsRenewalsModalOpen] = useState(false);
  const [isInventoryAuditOpen, setIsInventoryAuditOpen] = useState(false);

  // Return search & modal & Due-date edit modal
  const [returnSearch, setReturnSearch] = useState('');
  const [returnActionTx, setReturnActionTx] = useState<BorrowTransaction | null>(null);
  const [returnCondition, setReturnCondition] =
    useState<NonNullable<BorrowTransaction['conditionOnReturn']>>('Tốt');
  const [returnFine, setReturnFine] = useState(0);
  const [renewFeedback, setRenewFeedback] = useState<{ id: string; ok: boolean; msg: string } | null>(null);
  const [editingDueDateTx, setEditingDueDateTx] = useState<BorrowTransaction | null>(null);

  // History filter
  const [historyFilter, setHistoryFilter] = useState<'all' | 'borrowed' | 'returned' | 'overdue' | 'lost'>('all');

  // Reservation modal
  const [isReserveOpen, setIsReserveOpen] = useState(false);
  const [reserveBookId, setReserveBookId] = useState('');
  const [reserveStudentId, setReserveStudentId] = useState('');

  // Inventory Audit state
  const [auditInputCode, setAuditInputCode] = useState('');
  const [auditScannedCodes, setAuditScannedCodes] = useState<string[]>([]);
  const [auditNotes, setAuditNotes] = useState('');

  const filteredBooks = useMemo(
    () =>
      books.filter((b) => {
        const q = bookSearch.toLowerCase();
        const matchText =
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          b.isbn.toLowerCase().includes(q);
        const matchCat = selectedCategory === 'all' || b.category === selectedCategory;
        return matchText && matchCat;
      }),
    [books, bookSearch, selectedCategory]
  );

  const effectiveSelectedBookIds = useMemo(
    () => pruneStaleSelectedIds(selectedBookIds, books.map((b) => b.id)),
    [selectedBookIds, books]
  );
  const visibleBookIds = useMemo(() => filteredBooks.map((b) => b.id), [filteredBooks]);

  const handleConfirmBulkDeleteBooks = async () => {
    if (!pendingBulkBookIds || pendingBulkBookIds.length === 0) return;
    setIsBulkDeletingBooks(true);
    try {
      if (onDeleteBooks) {
        await onDeleteBooks(pendingBulkBookIds);
      } else {
        for (const id of pendingBulkBookIds) await onDeleteBook(id);
      }
      const deletedSet = new Set(pendingBulkBookIds);
      setSelectedBookIds((prev) => prev.filter((id) => !deletedSet.has(id)));
      if (viewingBookCopies && deletedSet.has(viewingBookCopies.id)) {
        setViewingBookCopies(null);
      }
    } finally {
      setIsBulkDeletingBooks(false);
      setPendingBulkBookIds(null);
    }
  };

  const allActiveLoans = useMemo(
    () => transactions.filter((t) => t.status !== 'returned' && t.status !== 'lost'),
    [transactions]
  );

  const overdueTransactions = useMemo(
    () =>
      allActiveLoans.filter(
        (t) => t.status === 'overdue' || checkIsOverdue(t.dueDate).isOverdue
      ),
    [allActiveLoans]
  );

  const filteredCirculation = useMemo(
    () =>
      filterLibraryCirculation({
        transactions,
        reservations,
        statusFilter: circulationFilter,
        search: returnSearch,
        isTxOverdue: (tx) => tx.status === 'overdue' || checkIsOverdue(tx.dueDate).isOverdue,
      }),
    [transactions, reservations, circulationFilter, returnSearch]
  );

  const activeReservationsCount = useMemo(
    () => reservations.filter((r) => r.status === 'pending' || r.status === 'ready').length,
    [reservations]
  );

  const myLoans = useMemo(
    () =>
      allActiveLoans.filter(
        (t) =>
          t.studentId === currentUser.id ||
          t.studentId === currentUser.linkedProfileId ||
          (currentUser.studentCode && t.studentCode === currentUser.studentCode)
      ),
    [allActiveLoans, currentUser]
  );

  const pendingRenewalsCount = useMemo(
    () => renewalRequests.filter((r) => r.status === 'pending').length,
    [renewalRequests]
  );

  const handleScanRfid = (rfidInput: string) => {
    setScannedRfid(rfidInput);
    setRfidError(null);
    setRfidSuccess(null);
    const cleaned = sanitizeScanInput(rfidInput);
    if (!cleaned) {
      setIdentifiedBorrower(null);
      return;
    }

    const stu = students.find(
      (s) =>
        sanitizeScanInput(s.rfidCardId) === cleaned ||
        sanitizeScanInput(s.studentCode) === cleaned
    );
    if (stu) {
      setIdentifiedBorrower({
        id: stu.id,
        fullName: stu.fullName,
        code: stu.studentCode,
        subtitle: `${stu.studentCode} · Lớp ${stu.className}`,
        role: 'student',
      });
      return;
    }

    // Teachers matched by ID, Email, or Full Name (no teacherCode)
    const tch = teachers.find(
      (t) =>
        sanitizeScanInput(t.id) === cleaned ||
        sanitizeScanInput(t.email) === cleaned ||
        sanitizeScanInput(t.fullName) === cleaned
    );
    if (tch) {
      setIdentifiedBorrower({
        id: tch.id,
        fullName: tch.fullName,
        code: tch.email || tch.id,
        subtitle: `Giáo viên · ${tch.subject}`,
        role: tch.role,
      });
      return;
    }

    const stf = staffMembers.find((m) => sanitizeScanInput(m.staffCode) === cleaned);
    if (stf) {
      setIdentifiedBorrower({
        id: stf.id,
        fullName: stf.fullName,
        code: stf.staffCode,
        subtitle: `${stf.staffCode} · ${stf.department}`,
        role: 'staff',
      });
      return;
    }

    setIdentifiedBorrower(null);
    setRfidError(`Không tìm thấy bạn đọc với mã RFID / định danh "${rfidInput}".`);
  };

  const handleScanBarcode = (barcodeInput: string) => {
    setScannedBarcode(barcodeInput);
    setRfidError(null);
    setRfidSuccess(null);
    const cleaned = sanitizeScanInput(barcodeInput);
    if (!cleaned) {
      setIdentifiedBook(null);
      setIdentifiedCopy(null);
      return;
    }

    if (isDuplicateScan(cleaned, lastScanRef.current, Date.now(), 600)) {
      return;
    }
    lastScanRef.current = { code: cleaned, timestampMs: Date.now() };

    const matchedCopy = bookCopies.find(
      (c) =>
        sanitizeScanInput(c.copyBarcode) === cleaned ||
        (c.rfidTag && sanitizeScanInput(c.rfidTag) === cleaned)
    );
    if (matchedCopy) {
      const parentBook = books.find((b) => b.id === matchedCopy.bookId) || null;
      setIdentifiedCopy(matchedCopy);
      setIdentifiedBook(parentBook);
      if (matchedCopy.status !== 'available') {
        setRfidError(
          `Bản sao "${matchedCopy.copyBarcode}" hiện ở trạng thái "${matchedCopy.status}", không thể cho mượn.`
        );
      }
      return;
    }

    const foundBook = books.find(
      (b) =>
        sanitizeScanInput(b.isbn) === cleaned ||
        sanitizeScanInput(b.id) === cleaned
    );
    if (foundBook) {
      const firstAvailCopy = bookCopies.find(
        (c) => c.bookId === foundBook.id && c.status === 'available'
      );
      setIdentifiedBook(foundBook);
      setIdentifiedCopy(firstAvailCopy || null);
    } else {
      setIdentifiedBook(null);
      setIdentifiedCopy(null);
      setRfidError(`Không tìm thấy sách hoặc bản sao với mã "${barcodeInput}".`);
    }
  };

  const handleConnectWebSerial = async () => {
    if (!webSerialSupported) {
      setScannerStatus(
        'Trình duyệt không hỗ trợ Web Serial API — hãy dùng đầu đọc USB chế độ HID Keyboard-Wedge.'
      );
      return;
    }
    try {
      const navWithSerial = navigator as Navigator & {
        serial: { requestPort: () => Promise<{ open: (opts: { baudRate: number }) => Promise<void> }> };
      };
      const port = await navWithSerial.serial.requestPort();
      await port.open({ baudRate: 9600 });
      setScannerStatus('Đã kết nối cổng Serial 9600 baud (sẵn sàng nhận dữ liệu).');
    } catch {
      setScannerStatus('Chưa chọn cổng Serial hoặc người dùng đã hủy kết nối.');
    }
  };

  const executeBorrow = async (
    borrower: { id: string; fullName: string; code: string; role: UserRole },
    book: Book,
    preferredCopy?: BookCopy | null
  ) => {
    const activeTrans = transactions.filter(
      (t) => t.studentId === borrower.id && t.status !== 'returned' && t.status !== 'lost'
    );
    const hasOverdue = activeTrans.some((t) => checkIsOverdue(t.dueDate).isOverdue);

    const recentSameBookReturned = transactions
      .filter((t) => t.studentId === borrower.id && t.bookId === book.id && t.status === 'returned' && t.returnDate)
      .sort((a, b) => (b.returnDate || '').localeCompare(a.returnDate || ''))[0]?.returnDate;

    const eligibility = checkBorrowEligibility(
      borrower.role,
      activeTrans.length,
      hasOverdue,
      systemSettings,
      recentSameBookReturned
    );

    if (!eligibility.eligible) {
      return { ok: false, msg: eligibility.reason || 'Không đủ điều kiện mượn sách.' };
    }
    if (book.availableCopies <= 0) {
      return { ok: false, msg: `Đầu sách "${book.title}" đã hết bản sao khả dụng trên kệ.` };
    }
    if (preferredCopy && preferredCopy.status !== 'available') {
      return { ok: false, msg: `Bản sao "${preferredCopy.copyBarcode}" không khả dụng.` };
    }

    const availCopy =
      preferredCopy || bookCopies.find((c) => c.bookId === book.id && c.status === 'available');
    const copyCode =
      availCopy?.copyBarcode ||
      `BAR-${book.id.slice(-4)}-${String(activeTrans.length + 1).padStart(3, '0')}`;

    await onBorrowBook(borrower, book, copyCode, availCopy?.id);
    confetti({ particleCount: 50, spread: 55, origin: { y: 0.7 } });
    return {
      ok: true,
      msg: `Đã lập phiếu mượn "${book.title}" (${copyCode}) cho ${borrower.fullName}. Hạn ${eligibility.loanDays} ngày (${eligibility.policy.label}).`,
    };
  };

  const handleConfirmRfidBorrow = async () => {
    if (!identifiedBorrower || !identifiedBook) return;
    setIsProcessing(true);
    try {
      const res = await executeBorrow(identifiedBorrower, identifiedBook, identifiedCopy);
      if (res.ok) {
        setRfidSuccess(res.msg);
        setIdentifiedBook(null);
        setIdentifiedCopy(null);
        setScannedBarcode('');
      } else {
        setRfidError(res.msg);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualBorrow = async (e: React.FormEvent) => {
    e.preventDefault();
    let borrower: { id: string; fullName: string; code: string; role: UserRole } | null = null;
    if (borrowerType === 'student') {
      const stu = students.find((s) => s.id === borrowPersonId);
      if (stu) borrower = { id: stu.id, fullName: stu.fullName, code: stu.studentCode, role: 'student' };
    } else if (borrowerType === 'teacher') {
      const tch = teachers.find((t) => t.id === borrowPersonId);
      if (tch) borrower = { id: tch.id, fullName: tch.fullName, code: tch.email || tch.id, role: tch.role };
    } else {
      const stf = staffMembers.find((m) => m.id === borrowPersonId);
      if (stf) borrower = { id: stf.id, fullName: stf.fullName, code: stf.staffCode, role: 'staff' };
    }

    const bk = books.find((b) => b.id === borrowBookId);
    if (!borrower || !bk) return;
    setIsProcessing(true);
    try {
      const res = await executeBorrow(borrower, bk);
      setBorrowMessage({ type: res.ok ? 'ok' : 'err', text: res.msg });
      if (res.ok) {
        setBorrowBookId('');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const openReturnDialog = (tx: BorrowTransaction) => {
    const over = checkIsOverdue(tx.dueDate);
    const policy = getEffectiveLibraryPolicy(tx.borrowerRole || 'student', systemSettings);
    setReturnActionTx(tx);
    setReturnCondition('Tốt');
    setReturnFine(over.isOverdue ? over.daysOverdue * (policy.overdueFinePerDay || 0) : 0);
  };

  const handleConfirmReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnActionTx) return;
    await onReturnBook(returnActionTx.id, returnCondition, returnFine);
    setReturnActionTx(null);
  };

  const handleRenewTransaction = async (tx: BorrowTransaction) => {
    const check = canRenewTransaction(tx, reservations, new Date(), systemSettings);
    if (!check.allowed || !check.newDueDate) {
      setRenewFeedback({ id: tx.id, ok: false, msg: check.reason || 'Không thể gia hạn.' });
      return;
    }
    await onRenewBook(tx.id, check.newDueDate);
    setRenewFeedback({ id: tx.id, ok: true, msg: `Đã gia hạn đến ${check.newDueDate}.` });
  };

  const handleCreateReservation = (e: React.FormEvent) => {
    e.preventDefault();
    const book = books.find((b) => b.id === reserveBookId);
    const stu =
      students.find((s) => s.id === reserveStudentId) ||
      (isPureStudent
        ? {
            id: currentUser.id,
            fullName: currentUser.displayName,
            studentCode: currentUser.studentCode || 'STU-SELF',
          }
        : undefined);
    if (!book || !stu) return;

    const pickup = new Date();
    pickup.setDate(pickup.getDate() + 3);
    onSaveReservation({
      id: `RES-${Date.now()}`,
      bookId: book.id,
      bookTitle: book.title,
      studentId: stu.id,
      studentName: stu.fullName,
      studentCode: stu.studentCode,
      reservedAt: new Date().toISOString().split('T')[0],
      pickupDeadline: pickup.toISOString().split('T')[0],
      status: 'pending',
    });
    setIsReserveOpen(false);
    setReserveBookId('');
  };

  const handleAddAuditBarcode = (e: React.FormEvent) => {
    e.preventDefault();
    const code = sanitizeScanInput(auditInputCode);
    if (!code) return;
    if (!auditScannedCodes.includes(code)) {
      setAuditScannedCodes((prev) => [code, ...prev]);
    }
    setAuditInputCode('');
  };

  const auditDiff = useMemo(
    () => computeInventoryAuditDiff(bookCopies, auditScannedCodes),
    [bookCopies, auditScannedCodes]
  );

  const handleSaveAuditSession = () => {
    const audit: InventoryAudit = {
      id: `AUD-${Date.now()}`,
      auditCode: `KK-${new Date().getFullYear()}-${String(inventoryAudits.length + 1).padStart(3, '0')}`,
      date: new Date().toISOString().split('T')[0],
      conductedBy: currentUser.displayName,
      totalBooks: books.length,
      totalCopiesExpected: auditDiff.totalCopiesExpected,
      scannedBarcodes: auditScannedCodes,
      matchedCount: auditDiff.matchedCount,
      missingBarcodes: auditDiff.missingBarcodes,
      notes: auditNotes.trim() || undefined,
      status: 'completed',
    };
    onSaveInventoryAudit(audit);
    setAuditScannedCodes([]);
    setAuditNotes('');
  };

  const filteredHistory = transactions.filter((t) => {
    const overdue = t.status !== 'returned' && t.status !== 'lost' && checkIsOverdue(t.dueDate).isOverdue;
    if (historyFilter === 'all') return true;
    if (historyFilter === 'overdue') return t.status === 'overdue' || overdue;
    return t.status === historyFilter;
  });

  const copiesForViewingBook = viewingBookCopies
    ? bookCopies.filter((c) => c.bookId === viewingBookCopies.id)
    : [];

  const manualSelectedBorrowerPolicy = useMemo(() => {
    if (borrowerType === 'student') return getEffectiveLibraryPolicy('student', systemSettings);
    if (borrowerType === 'teacher') return getEffectiveLibraryPolicy('subject_teacher', systemSettings);
    return getEffectiveLibraryPolicy('staff', systemSettings);
  }, [borrowerType, systemSettings]);

  const handleExportOverdueExcel = () => {
    const rows = overdueTransactions.map((tx) => {
      const over = checkIsOverdue(tx.dueDate);
      const pol = getEffectiveLibraryPolicy(tx.borrowerRole || 'student', systemSettings);
      return {
        'Mã phiếu': tx.transactionCode,
        'Mã bản sao': tx.copyBarcode,
        'Bạn đọc': tx.studentName,
        'Nhóm': pol.label,
        'Tên sách': tx.bookTitle,
        'Ngày mượn': tx.borrowDate,
        'Hạn trả': tx.dueDate,
        'Số ngày quá hạn': over.daysOverdue,
        'Phí dự kiến (VNĐ)': over.daysOverdue * pol.overdueFinePerDay,
      };
    });
    exportToExcel(rows, `Sach_Qua_Han_${new Date().toISOString().split('T')[0]}`, 'QuaHan');
  };

  return (
    <AppWindowShell
      appId="library"
      activeTab={activeTab}
      userRole={currentUser.role}
      userProfile={currentUser}
      customPermissions={customPermissions}
      onSelectTab={onSelectTab}
    >
      {(tabId) => (
        <>
          {/* 1. TỔNG QUAN */}
          {tabId === 'overview' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-end gap-2">
                {canCheckout && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTab('circulation');
                      setIsBorrowModalOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold shadow-sm inline-flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <BookPlus className="w-4 h-4" /> Tạo phiếu mượn
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onSelectTab('circulation')}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white text-xs font-bold shadow-sm inline-flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <ScanLine className="w-4 h-4" /> Quầy Mượn &amp; Trả
                </button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  {
                    label: 'Đầu sách',
                    value: books.length,
                    tone: 'text-emerald-600',
                    onClick: () => onSelectTab('catalog'),
                  },
                  {
                    label: 'Bản sao vật lý',
                    value: bookCopies.length,
                    tone: 'text-sky-600',
                    onClick: () => onSelectTab('catalog'),
                  },
                  {
                    label: 'Đang mượn',
                    value: allActiveLoans.length,
                    tone: 'text-indigo-600',
                    onClick: () => {
                      setCirculationFilter('borrowed');
                      onSelectTab('circulation');
                    },
                  },
                  {
                    label: 'Quá hạn',
                    value: overdueTransactions.length,
                    tone: 'text-rose-600',
                    onClick: () => {
                      setCirculationFilter('overdue');
                      onSelectTab('circulation');
                    },
                  },
                  {
                    label: 'Chờ gia hạn',
                    value: pendingRenewalsCount,
                    tone: 'text-amber-600',
                    onClick: () => {
                      onSelectTab('circulation');
                      setIsRenewalsModalOpen(true);
                    },
                  },
                ].map((kpi) => (
                  <button
                    key={kpi.label}
                    type="button"
                    onClick={kpi.onClick}
                    className="text-left cursor-pointer group"
                  >
                    <LiquidCard className="p-3.5 hover:border-sky-300/80 transition-colors">
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>{kpi.label}</span>
                        <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </p>
                      <p className={`font-mono-tabular text-2xl font-extrabold mt-1 ${kpi.tone}`}>
                        {kpi.value}
                      </p>
                    </LiquidCard>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <LiquidCard className="lg:col-span-7 p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      Chính sách mượn trả hiện hành
                    </h3>
                    {canManageCatalog && (
                      <button
                        type="button"
                        onClick={() => onSelectTab('settings')}
                        className="text-sky-600 dark:text-sky-400 font-semibold hover:underline cursor-pointer"
                      >
                        Cấu hình chính sách
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {(['student', 'teacher', 'staff'] as const).map((g) => {
                      const roleForGroup: UserRole =
                        g === 'student' ? 'student' : g === 'teacher' ? 'subject_teacher' : 'staff';
                      const pol = getEffectiveLibraryPolicy(roleForGroup, systemSettings);
                      return (
                        <div
                          key={g}
                          className="p-3 rounded-xl glass-subsurface space-y-1"
                        >
                          <p className="font-bold text-slate-800 dark:text-slate-100">{pol.label}</p>
                          <p className="text-slate-600 dark:text-slate-300">
                            Tối đa: <strong className="font-mono-tabular">{pol.maxBooks}</strong> cuốn
                          </p>
                          <p className="text-slate-600 dark:text-slate-300">
                            Hạn: <strong className="font-mono-tabular">{pol.loanDays}</strong> ngày
                          </p>
                          <p className="text-slate-600 dark:text-slate-300">
                            Gia hạn: <strong className="font-mono-tabular">{pol.maxRenewals}</strong> lần (+{pol.renewDays}d)
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </LiquidCard>

                <LiquidCard className="lg:col-span-5 p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      {canManageCatalog ? 'Cảnh báo quá hạn gần nhất' : 'Sách bạn đang mượn'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setCirculationFilter(canManageCatalog ? 'overdue' : 'borrowed');
                        onSelectTab('circulation');
                      }}
                      className="text-sky-600 dark:text-sky-400 font-semibold hover:underline cursor-pointer"
                    >
                      Mở quầy lưu thông
                    </button>
                  </div>
                  {(canManageCatalog ? overdueTransactions : myLoans).length === 0 ? (
                    <p className="text-slate-500 dark:text-slate-400 py-5 text-center">
                      {canManageCatalog
                        ? 'Hiện không có giao dịch quá hạn nào.'
                        : 'Bạn hiện không có sách đang mượn.'}
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {(canManageCatalog ? overdueTransactions : myLoans).slice(0, 5).map((tx) => {
                        const over = checkIsOverdue(tx.dueDate);
                        const rem = getDaysRemaining(tx.dueDate);
                        return (
                          <div
                            key={tx.id}
                            className="p-2.5 rounded-xl glass-subsurface flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 dark:text-slate-100 truncate">
                                {tx.bookTitle}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {tx.studentName} · Hạn {tx.dueDate}
                              </p>
                            </div>
                            <Badge variant={over.isOverdue ? 'pink' : 'blue'} size="sm">
                              {over.isOverdue ? `Trễ ${over.daysOverdue}d` : `Còn ${rem}d`}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </LiquidCard>
              </div>
            </div>
          )}

          {/* 2. DANH MỤC SÁCH (+ Bản sao & Kiểm kê Modal) */}
          {tabId === 'catalog' && (
            <div className="space-y-4">
              <div className="liquid-glass-panel rounded-2xl p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={bookSearch}
                      onChange={(e) => setBookSearch(e.target.value)}
                      placeholder="Tìm tên sách, tác giả, ISBN..."
                      className="w-full glass-subsurface rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                  </div>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="glass-subsurface rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 outline-none"
                  >
                    <option value="all">Tất cả thể loại</option>
                    {bookCategoryOptions.map((opt) => (
                      <option key={opt.id} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canManageCatalog && (
                    <button
                      type="button"
                      data-testid="btn-open-inventory-audit"
                      onClick={() => setIsInventoryAuditOpen(true)}
                      className="px-3 py-1.5 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 hover:border-emerald-400 cursor-pointer whitespace-nowrap transition-colors"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Kiểm kê kho ({bookCopies.length})
                    </button>
                  )}
                  <ModuleDataActions
                    moduleKey="books"
                    context={effectiveContext}
                    currentUser={currentUser}
                    allRecords={books as unknown as Record<string, unknown>[]}
                    filteredRecords={filteredBooks as unknown as Record<string, unknown>[]}
                    canCreate={canManageCatalog}
                    canImport={canManageCatalog}
                    canExport={canExportLibrary}
                    createLabel="Thêm đầu sách"
                    onManualSave={async (entity) => {
                      onAddBook(entity as unknown as Book);
                    }}
                    onCommitImport={safeCommitImport}
                    onLogExport={onLogExport}
                  />
                  {isAdmin && onSaveDataSourceConfig && (
                    <DataSourceButton
                      groupKey="books"
                      config={dataSourceConfigs.find((c) => c.groupKey === 'books')}
                      isAdmin={isAdmin}
                      onClick={() => setIsBooksDataSourceOpen(true)}
                    />
                  )}
                </div>
              </div>

              {isAdmin && onSaveDataSourceConfig && onCommitNormalizedGroupData && (
                <DataSourceModal
                  isOpen={isBooksDataSourceOpen}
                  onClose={() => setIsBooksDataSourceOpen(false)}
                  groupKey="books"
                  allConfigs={dataSourceConfigs}
                  runtimeContext={
                    dataSourceRuntimeContext ?? {
                      classes: [],
                      academicYears: [],
                      rooms: [],
                      systemSettings,
                    }
                  }
                  existingData={
                    dataSourceExistingData ?? {
                      students,
                      teachers,
                      staffMembers,
                      timetable: [],
                      afternoonSchedules: [],
                      books,
                      facilities: [],
                    }
                  }
                  currentUserEmail={currentUser.email}
                  currentUserName={currentUser.displayName}
                  onSaveConfig={onSaveDataSourceConfig}
                  onDeleteConfig={onDeleteDataSourceConfig}
                  onCommitNormalizedGroupData={onCommitNormalizedGroupData}
                />
              )}

              <BulkSelectionBar
                totalVisibleCount={filteredBooks.length}
                selectedCount={effectiveSelectedBookIds.length}
                allVisibleSelected={areAllVisibleSelected(effectiveSelectedBookIds, visibleBookIds)}
                canDelete={canDelete}
                entityLabel="đầu sách"
                showSelectAll={true}
                isDeleting={isBulkDeletingBooks}
                testIdPrefix="books-bulk"
                onToggleSelectAll={() =>
                  setSelectedBookIds((prev) => toggleSelectAllVisible(prev, visibleBookIds))
                }
                onClearSelection={() => setSelectedBookIds([])}
                onRequestBulkDelete={() => setPendingBulkBookIds(effectiveSelectedBookIds)}
              />

              {filteredBooks.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title="Kho sách thư viện hiện đang trống"
                  description="Thêm đầu sách mới hoặc Import Excel để hệ thống tự động sinh mã bản sao BookCopy."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredBooks.map((book) => {
                    const copyCount = bookCopies.filter((c) => c.bookId === book.id).length;
                    const isSelected = effectiveSelectedBookIds.includes(book.id);
                    return (
                      <LiquidCard
                        key={book.id}
                        className={`p-3.5 flex gap-3 transition-all ${
                          isSelected ? 'ring-2 ring-sky-500/75 bg-sky-500/10' : ''
                        }`}
                      >
                        <div className="w-16 h-24 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-2 flex flex-col justify-between shrink-0 shadow-xs">
                          <BookOpen className="w-4 h-4 opacity-90" />
                          <span className="text-[10px] font-bold line-clamp-3 leading-tight">
                            {book.title}
                          </span>
                        </div>
                        <div className="flex flex-col justify-between flex-1 min-w-0">
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {canDelete && (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() =>
                                      setSelectedBookIds((prev) => toggleSelectedId(prev, book.id))
                                    }
                                    aria-label={`Chọn sách ${book.title}`}
                                    className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500 shrink-0 cursor-pointer"
                                  />
                                )}
                                <Badge variant="blue" size="sm">{book.category}</Badge>
                              </div>
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => setPendingDeleteBook(book)}
                                  aria-label={`Xóa sách ${book.title}`}
                                  className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/15 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm line-clamp-2">
                              {book.title}
                            </h4>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 truncate">
                              {book.author}
                            </p>
                            <p className="text-[10px] font-mono-tabular text-slate-500 dark:text-slate-400 mt-0.5">
                              ISBN: {book.isbn}
                            </p>
                          </div>
                          <div className="pt-2 border-t border-white/35 dark:border-white/10 flex items-center justify-between gap-1 text-[11px]">
                            <button
                              type="button"
                              onClick={() => setViewingBookCopies(book)}
                              className="text-sky-600 dark:text-sky-400 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" /> {copyCount} bản sao
                            </button>
                            <Badge variant={book.availableCopies > 0 ? 'mint' : 'pink'} size="sm">
                              Còn {book.availableCopies}/{book.totalCopies}
                            </Badge>
                          </div>
                        </div>
                      </LiquidCard>
                    );
                  })}
                </div>
              )}

              {/* View Physical BookCopies Modal */}
              <Modal
                isOpen={Boolean(viewingBookCopies)}
                onClose={() => setViewingBookCopies(null)}
                title={viewingBookCopies ? `Bản sao vật lý — ${viewingBookCopies.title}` : ''}
                maxWidth="2xl"
              >
                {viewingBookCopies && (
                  <div className="space-y-3 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <p className="text-slate-500 dark:text-slate-400">
                        Mỗi cuốn sách có mã vạch (Barcode) và thẻ RFID riêng phục vụ kiểm kê và mượn trả chính xác.
                      </p>
                      <ModuleDataActions
                        moduleKey="book_copies"
                        context={effectiveContext}
                        currentUser={currentUser}
                        allRecords={bookCopies as unknown as Record<string, unknown>[]}
                        filteredRecords={copiesForViewingBook as unknown as Record<string, unknown>[]}
                        canCreate={canManageCatalog}
                        canImport={canManageCatalog}
                        canExport={canExportLibrary}
                        createLabel="Thêm bản sao"
                        onManualSave={async (entity) => {
                          onSaveBookCopy(entity as unknown as BookCopy);
                        }}
                        onCommitImport={safeCommitImport}
                        onLogExport={onLogExport}
                      />
                    </div>
                    {copiesForViewingBook.length === 0 ? (
                      <p className="py-6 text-center text-slate-400">
                        Chưa có bản sao chi tiết nào được khởi tạo cho đầu sách này.
                      </p>
                    ) : (
                      <div className="glass-table-shell overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="glass-table-head">
                            <tr>
                              <th className="px-3 py-2">Barcode bản sao</th>
                              <th className="px-3 py-2">RFID Tag</th>
                              <th className="px-3 py-2">Tình trạng</th>
                              <th className="px-3 py-2">Trạng thái</th>
                              {canManageCatalog && <th className="px-3 py-2 text-right">Cập nhật</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/25 dark:divide-white/10">
                            {copiesForViewingBook.map((cp) => (
                              <tr key={cp.id} className="glass-table-row">
                                <td className="px-3 py-2 font-mono-tabular font-semibold text-slate-800 dark:text-slate-100">{cp.copyBarcode}</td>
                                <td className="px-3 py-2 font-mono-tabular text-slate-500 dark:text-slate-400">{cp.rfidTag || '---'}</td>
                                <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{cp.condition}</td>
                                <td className="px-3 py-2">
                                  <Badge
                                    variant={cp.status === 'available' ? 'mint' : cp.status === 'borrowed' ? 'blue' : 'pink'}
                                    size="sm"
                                  >
                                    {cp.status}
                                  </Badge>
                                </td>
                                {canManageCatalog && (
                                  <td className="px-3 py-2 text-right">
                                    <select
                                      value={cp.status}
                                      onChange={(e) =>
                                        onSaveBookCopy({
                                          ...cp,
                                          status: e.target.value as BookCopy['status'],
                                          updatedAt: new Date().toISOString(),
                                        })
                                      }
                                      className="glass-subsurface rounded-lg px-2 py-1 text-[11px] text-slate-800 dark:text-slate-100 outline-none"
                                    >
                                      {copyStatusOptions.map((opt) => (
                                        <option key={opt.id} value={opt.value}>
                                          {opt.label}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </Modal>

              {/* Inventory Audit & Copies Modal */}
              <Modal
                isOpen={isInventoryAuditOpen}
                onClose={() => setIsInventoryAuditOpen(false)}
                title="Kiểm kê Kho & Bản sao Vật lý"
                maxWidth="2xl"
              >
                <div className="space-y-4 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="blue">{books.length} đầu sách</Badge>
                      <Badge variant="mint">{bookCopies.length} bản sao</Badge>
                      <Badge variant="pink">
                        {bookCopies.filter((c) => c.status === 'damaged' || c.status === 'lost').length} hỏng/mất
                      </Badge>
                    </div>
                    <ModuleDataActions
                      moduleKey="inventory_audits"
                      context={effectiveContext}
                      currentUser={currentUser}
                      allRecords={inventoryAudits as unknown as Record<string, unknown>[]}
                      canCreate={canManageCatalog}
                      canImport={canManageCatalog}
                      canExport={canExportLibrary}
                      createLabel="Thêm biên bản"
                      onManualSave={async (entity) => {
                        onSaveInventoryAudit(entity as unknown as InventoryAudit);
                      }}
                      onCommitImport={safeCommitImport}
                      onLogExport={onLogExport}
                    />
                  </div>

                  <form onSubmit={handleAddAuditBarcode} className="flex gap-2">
                    <input
                      type="text"
                      value={auditInputCode}
                      onChange={(e) => setAuditInputCode(e.target.value)}
                      placeholder="Quét hoặc nhập mã bản sao / RFID tag..."
                      className="flex-1 glass-subsurface rounded-xl px-3 py-2 font-mono-tabular text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-sm cursor-pointer"
                    >
                      Ghi nhận
                    </button>
                  </form>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 rounded-xl glass-subsurface">
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Kỳ vọng</p>
                      <p className="font-mono-tabular text-base font-extrabold text-slate-800 dark:text-slate-100">{auditDiff.totalCopiesExpected}</p>
                    </div>
                    <div className="p-2.5 rounded-xl glass-subsurface bg-emerald-500/12 border-emerald-400/35 text-emerald-700 dark:text-emerald-300">
                      <p className="text-[10px]">Đã khớp</p>
                      <p className="font-mono-tabular text-base font-extrabold">{auditDiff.matchedCount}</p>
                    </div>
                    <div className="p-2.5 rounded-xl glass-subsurface bg-rose-500/12 border-rose-400/35 text-rose-700 dark:text-rose-300">
                      <p className="text-[10px]">Chưa thấy</p>
                      <p className="font-mono-tabular text-base font-extrabold">{auditDiff.missingBarcodes.length}</p>
                    </div>
                  </div>

                  {auditScannedCodes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {auditScannedCodes.map((c) => (
                        <span
                          key={c}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg glass-subsurface bg-sky-500/12 text-sky-700 dark:text-sky-300 font-mono-tabular text-[11px]"
                        >
                          {c}
                          <button
                            type="button"
                            onClick={() => setAuditScannedCodes((prev) => prev.filter((x) => x !== c))}
                            className="hover:text-rose-600 cursor-pointer"
                          >
                            <XCircle className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={auditNotes}
                      onChange={(e) => setAuditNotes(e.target.value)}
                      placeholder="Ghi chú biên bản kiểm kê..."
                      className="flex-1 glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none"
                    />
                    <button
                      type="button"
                      disabled={bookCopies.length === 0 || !canManageCatalog}
                      onClick={handleSaveAuditSession}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-sm disabled:opacity-40 cursor-pointer whitespace-nowrap"
                    >
                      Chốt biên bản
                    </button>
                  </div>

                  {inventoryAudits.length > 0 && (
                    <div className="pt-2 border-t border-white/40 dark:border-white/10 space-y-2 max-h-48 overflow-y-auto">
                      <p className="font-bold text-slate-700 dark:text-slate-200">
                        Biên bản đã lưu ({inventoryAudits.length})
                      </p>
                      {inventoryAudits.map((aud) => (
                        <div
                          key={aud.id}
                          className="p-2.5 rounded-xl glass-subsurface flex items-center justify-between gap-2"
                        >
                          <div>
                            <span className="font-mono-tabular font-bold text-emerald-700 dark:text-emerald-300">
                              {aud.auditCode}
                            </span>
                            <span className="text-slate-600 dark:text-slate-300 ml-2">
                              Khớp {aud.matchedCount}/{aud.totalCopiesExpected} · Thiếu {aud.missingBarcodes.length}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400">{aud.date}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Modal>

              <ConfirmDialog
                isOpen={Boolean(pendingDeleteBook)}
                title="Xác nhận xóa đầu sách"
                message={`Bạn có chắc muốn xóa đầu sách "${pendingDeleteBook?.title}" khỏi danh mục thư viện?`}
                confirmLabel="Xóa đầu sách"
                onConfirm={() => {
                  if (pendingDeleteBook) onDeleteBook(pendingDeleteBook.id);
                  setPendingDeleteBook(null);
                }}
                onCancel={() => setPendingDeleteBook(null)}
              />

              <ConfirmDialog
                isOpen={Boolean(pendingBulkBookIds && pendingBulkBookIds.length > 0)}
                title="Xác nhận xóa hàng loạt đầu sách"
                message={`Bạn có chắc muốn xóa ${pendingBulkBookIds?.length || 0} đầu sách đã chọn khỏi danh mục thư viện?`}
                confirmLabel={`Xóa ${pendingBulkBookIds?.length || 0} đầu sách`}
                onConfirm={() => {
                  void handleConfirmBulkDeleteBooks();
                }}
                onCancel={() => setPendingBulkBookIds(null)}
              />
            </div>
          )}

          {/* 3. QUẦY MƯỢN & TRẢ THỐNG NHẤT */}
          {tabId === 'circulation' && (
            <div className="space-y-4">
              {/* Unified Circulation Action, Filter & Search Row */}
              <div className="liquid-glass-panel rounded-2xl p-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="glass-pill-tray inline-flex flex-wrap rounded-xl p-1 gap-0.5 text-xs font-semibold">
                  {[
                    { id: 'all' as CirculationStatusFilter, label: `Tất cả (${allActiveLoans.length})` },
                    {
                      id: 'borrowed' as CirculationStatusFilter,
                      label: `Đang mượn (${allActiveLoans.length - overdueTransactions.length})`,
                    },
                    { id: 'reserved' as CirculationStatusFilter, label: `Đặt giữ (${activeReservationsCount})` },
                    { id: 'overdue' as CirculationStatusFilter, label: `Quá hạn (${overdueTransactions.length})` },
                    {
                      id: 'returned' as CirculationStatusFilter,
                      label: `Đã trả (${transactions.filter((t) => t.status === 'returned').length})`,
                    },
                  ].map((pill) => (
                    <button
                      key={pill.id}
                      type="button"
                      data-testid={`circulation-filter-${pill.id}`}
                      onClick={() => setCirculationFilter(pill.id)}
                      className={`px-2.5 py-1.5 rounded-lg cursor-pointer transition-all font-mono-tabular whitespace-nowrap ${
                        circulationFilter === pill.id
                          ? pill.id === 'overdue'
                            ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-sm'
                            : 'glass-pill-tab-active'
                          : 'glass-pill-tab'
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 flex-1 sm:flex-initial justify-end">
                  <div className="relative w-full sm:w-52">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={returnSearch}
                      onChange={(e) => setReturnSearch(e.target.value)}
                      placeholder="Tìm mã phiếu, bạn đọc, sách..."
                      className="w-full glass-subsurface rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/40"
                    />
                  </div>
                  {canCheckout && (
                    <button
                      type="button"
                      data-testid="btn-open-borrow-modal"
                      onClick={() => {
                        setBorrowMessage(null);
                        setRfidError(null);
                        setRfidSuccess(null);
                        setIsBorrowModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold shadow-sm inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all"
                    >
                      <BookPlus className="w-3.5 h-3.5" /> Tạo phiếu mượn
                    </button>
                  )}
                  <button
                    type="button"
                    data-testid="btn-open-reserve-modal"
                    onClick={() => setIsReserveOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-sky-600 hover:from-teal-600 hover:to-sky-700 text-white text-xs font-bold shadow-sm inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all"
                  >
                    <Bookmark className="w-3.5 h-3.5" /> Đặt giữ sách
                  </button>
                  <button
                    type="button"
                    data-testid="btn-open-renewals-drawer"
                    onClick={() => setIsRenewalsModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    Gia hạn
                    {pendingRenewalsCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono-tabular text-[10px] font-bold">
                        {pendingRenewalsCount}
                      </span>
                    )}
                  </button>
                  {canExportLibrary && overdueTransactions.length > 0 && (
                    <button
                      type="button"
                      onClick={handleExportOverdueExcel}
                      className="px-3 py-1.5 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /> Xuất quá hạn
                    </button>
                  )}
                </div>
              </div>

              {renewFeedback && (
                <div
                  className={`p-3 rounded-xl glass-subsurface text-xs flex items-center gap-2 ${
                    renewFeedback.ok
                      ? 'bg-emerald-500/12 border-emerald-400/35 text-emerald-700 dark:text-emerald-300'
                      : 'bg-rose-500/12 border-rose-400/35 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {renewFeedback.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  <span>{renewFeedback.msg}</span>
                </div>
              )}

              {/* Reservations Section (when 'reserved' or when 'all' has active reservations) */}
              {(circulationFilter === 'reserved' ||
                (circulationFilter === 'all' && filteredCirculation.reservations.length > 0)) && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                    <span className="inline-flex items-center gap-1.5">
                      <Bookmark className="w-4 h-4 text-teal-600" />
                      Phiếu đặt giữ sách ({filteredCirculation.reservations.length})
                    </span>
                  </div>
                  {filteredCirculation.reservations.length === 0 ? (
                    <EmptyState
                      icon={Bookmark}
                      title="Chưa có yêu cầu đặt giữ"
                      description="Bạn đọc hoặc thủ thư có thể đăng ký giữ sách trước khi tới quầy nhận."
                    />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {filteredCirculation.reservations.map((res) => (
                        <LiquidCard key={res.id} className="p-3.5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                              {res.bookTitle}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {res.studentName} ({res.studentCode}) · Hạn nhận: {res.pickupDeadline}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <Badge
                              variant={
                                res.status === 'ready'
                                  ? 'mint'
                                  : res.status === 'fulfilled'
                                  ? 'blue'
                                  : res.status === 'cancelled' || res.status === 'expired'
                                  ? 'gray'
                                  : 'amber'
                              }
                            >
                              {res.status === 'pending'
                                ? 'Chờ giữ sách'
                                : res.status === 'ready'
                                ? 'Sẵn sàng nhận'
                                : res.status === 'fulfilled'
                                ? 'Đã nhận'
                                : res.status === 'expired'
                                ? 'Hết hạn'
                                : 'Đã hủy'}
                            </Badge>
                            <div className="flex items-center gap-2">
                              {canManageCatalog && res.status === 'pending' && (
                                <button
                                  type="button"
                                  onClick={() => onSaveReservation({ ...res, status: 'ready' })}
                                  className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                                >
                                  Báo sẵn sàng
                                </button>
                              )}
                              {canManageCatalog && res.status === 'ready' && (
                                <button
                                  type="button"
                                  onClick={() => onSaveReservation({ ...res, status: 'fulfilled' })}
                                  className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                                >
                                  Đã giao sách
                                </button>
                              )}
                              {(canManageCatalog || res.studentId === currentUser.id) &&
                                (res.status === 'pending' || res.status === 'ready') && (
                                  <button
                                    type="button"
                                    onClick={() => onSaveReservation({ ...res, status: 'cancelled' })}
                                    className="text-[11px] font-semibold text-rose-500 hover:underline cursor-pointer"
                                  >
                                    Hủy
                                  </button>
                                )}
                            </div>
                          </div>
                        </LiquidCard>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Active / Filtered Transactions Table */}
              {circulationFilter !== 'reserved' && (
                filteredCirculation.transactions.length === 0 ? (
                  <EmptyState
                    icon={BookCheck}
                    title="Không có giao dịch phù hợp"
                    description="Thay đổi bộ lọc trạng thái hoặc tạo phiếu mượn mới bằng nút phía trên."
                  />
                ) : (
                  <div className="glass-table-shell">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="glass-table-head">
                          <tr>
                            <th className="px-4 py-2.5">Mã phiếu / Bản sao</th>
                            <th className="px-4 py-2.5">Bạn đọc</th>
                            <th className="px-4 py-2.5">Tên sách</th>
                            <th className="px-4 py-2.5">Hạn / Ngày trả</th>
                            <th className="px-4 py-2.5">Trạng thái</th>
                            <th className="px-4 py-2.5 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/25 dark:divide-white/10">
                          {filteredCirculation.transactions.map((tr) => {
                            const isActive = tr.status !== 'returned' && tr.status !== 'lost';
                            const over = isActive ? checkIsOverdue(tr.dueDate) : { isOverdue: false, daysOverdue: 0 };
                            const elig = isActive
                              ? canRenewTransaction(tr, reservations, new Date(), systemSettings)
                              : { allowed: false, renewDays: 0 };
                            const pol = getEffectiveLibraryPolicy(tr.borrowerRole || 'student', systemSettings);
                            const estFine = over.isOverdue ? over.daysOverdue * pol.overdueFinePerDay : 0;

                            return (
                              <tr key={tr.id} className="glass-table-row">
                                <td className="px-4 py-2.5 font-mono-tabular">
                                  <p className="font-semibold text-sky-700 dark:text-sky-300">{tr.transactionCode}</p>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{tr.copyBarcode}</p>
                                </td>
                                <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-100">
                                  {tr.studentName}
                                  <p className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                                    {tr.studentCode} · {pol.label}
                                  </p>
                                </td>
                                <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">{tr.bookTitle}</td>
                                <td className="px-4 py-2.5 font-mono-tabular text-slate-700 dark:text-slate-200">
                                  {tr.returnDate ? `Trả: ${tr.returnDate}` : tr.dueDate}
                                  {(tr.renewCount ?? 0) > 0 && (
                                    <span className="block text-[10px] text-indigo-600 dark:text-indigo-400">
                                      Gia hạn {tr.renewCount} lần
                                    </span>
                                  )}
                                  {estFine > 0 && (
                                    <span className="block text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                                      Phí dự kiến: {estFine.toLocaleString('vi-VN')} đ
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5">
                                  <Badge
                                    variant={
                                      tr.status === 'returned' ? 'mint' : over.isOverdue ? 'pink' : 'blue'
                                    }
                                    size="sm"
                                  >
                                    {tr.status === 'returned'
                                      ? 'Đã trả'
                                      : over.isOverdue
                                      ? `Quá hạn ${over.daysOverdue}d`
                                      : 'Đang mượn'}
                                  </Badge>
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  {isActive ? (
                                    <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                                      {canManageCatalog && (
                                        <button
                                          type="button"
                                          onClick={() => setEditingDueDateTx(tr)}
                                          className="px-2.5 py-1 rounded-lg glass-subsurface bg-indigo-500/12 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                                        >
                                          <Calendar className="w-3 h-3" /> Sửa hạn
                                        </button>
                                      )}
                                      {elig.allowed && (
                                        <button
                                          type="button"
                                          onClick={() => handleRenewTransaction(tr)}
                                          className="px-2.5 py-1 rounded-lg glass-subsurface bg-sky-500/12 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                                        >
                                          <RefreshCw className="w-3 h-3" /> +{elig.renewDays}d
                                        </button>
                                      )}
                                      {canManageCatalog && (
                                        <button
                                          type="button"
                                          onClick={() => openReturnDialog(tr)}
                                          className="px-3 py-1 rounded-lg glass-subsurface bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                                        >
                                          <RotateCcw className="w-3.5 h-3.5" /> Trả sách
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-500 dark:text-slate-400">Hoàn tất</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              )}

              {/* Create Borrow Modal (Manual + RFID/Barcode) */}
              <Modal
                isOpen={isBorrowModalOpen}
                onClose={() => setIsBorrowModalOpen(false)}
                title="Tạo Phiếu Mượn Sách"
                maxWidth="2xl"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="glass-pill-tray inline-flex rounded-xl p-1 gap-1 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setBorrowMode('manual')}
                        className={`px-3 py-1.5 rounded-lg cursor-pointer inline-flex items-center gap-1.5 transition-all ${
                          borrowMode === 'manual'
                            ? 'glass-pill-tab-active'
                            : 'glass-pill-tab'
                        }`}
                      >
                        <BookPlus className="w-3.5 h-3.5" /> Lập phiếu trực tiếp
                      </button>
                      <button
                        type="button"
                        onClick={() => setBorrowMode('rfid')}
                        className={`px-3 py-1.5 rounded-lg cursor-pointer inline-flex items-center gap-1.5 transition-all ${
                          borrowMode === 'rfid'
                            ? 'glass-pill-tab-active'
                            : 'glass-pill-tab'
                        }`}
                      >
                        <ScanLine className="w-3.5 h-3.5" /> Quét RFID / Barcode
                      </button>
                    </div>
                  </div>

                  {books.length === 0 ? (
                    <EmptyState
                      icon={BookPlus}
                      title="Cần có dữ liệu sách"
                      description="Vui lòng bổ sung danh mục đầu sách trước khi tạo phiếu mượn."
                    />
                  ) : borrowMode === 'manual' ? (
                    <form onSubmit={handleManualBorrow} className="space-y-3.5 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Nhóm bạn đọc</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'student' as const, label: `Học sinh (${students.length})` },
                            { id: 'teacher' as const, label: `Giáo viên (${teachers.length})` },
                            { id: 'staff' as const, label: `Nhân viên (${staffMembers.length})` },
                          ].map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setBorrowerType(opt.id);
                                setBorrowPersonId('');
                              }}
                              className={`py-2 px-3 rounded-xl font-semibold cursor-pointer transition-all ${
                                borrowerType === opt.id
                                  ? 'glass-pill-tab-active'
                                  : 'glass-subsurface text-slate-700 dark:text-slate-200 hover:bg-white/75 dark:hover:bg-white/10'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                          Chính sách nhóm <strong>{manualSelectedBorrowerPolicy.label}</strong>: Tối đa{' '}
                          <strong className="font-mono-tabular">{manualSelectedBorrowerPolicy.maxBooks}</strong> cuốn · Hạn{' '}
                          <strong className="font-mono-tabular">{manualSelectedBorrowerPolicy.loanDays}</strong> ngày.
                        </p>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Chọn Bạn đọc *</label>
                        <select
                          required
                          value={borrowPersonId}
                          onChange={(e) => setBorrowPersonId(e.target.value)}
                          className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none"
                        >
                          <option value="">-- Chọn bạn đọc --</option>
                          {borrowerType === 'student' &&
                            students.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.fullName} ({s.studentCode} - Lớp {s.className})
                              </option>
                            ))}
                          {borrowerType === 'teacher' &&
                            teachers.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.fullName} (GV {t.subject}{t.email ? ` · ${t.email}` : ''})
                              </option>
                            ))}
                          {borrowerType === 'staff' &&
                            staffMembers.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.fullName} ({m.staffCode} - {m.department})
                              </option>
                            ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Chọn Sách khả dụng *</label>
                        <select
                          required
                          value={borrowBookId}
                          onChange={(e) => setBorrowBookId(e.target.value)}
                          className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none"
                        >
                          <option value="">-- Chọn đầu sách --</option>
                          {books.map((b) => (
                            <option key={b.id} value={b.id} disabled={b.availableCopies <= 0}>
                              {b.title} (Còn {b.availableCopies}/{b.totalCopies})
                            </option>
                          ))}
                        </select>
                      </div>

                      {borrowMessage && (
                        <div
                          className={`p-3 rounded-xl glass-subsurface text-xs ${
                            borrowMessage.type === 'ok'
                              ? 'bg-emerald-500/12 border-emerald-400/35 text-emerald-700 dark:text-emerald-300'
                              : 'bg-rose-500/12 border-rose-400/35 text-rose-700 dark:text-rose-300'
                          }`}
                        >
                          {borrowMessage.text}
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-2 border-t border-white/40 dark:border-white/10">
                        <button
                          type="button"
                          onClick={() => setIsBorrowModalOpen(false)}
                          className="px-4 py-2 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer transition-colors"
                        >
                          Đóng
                        </button>
                        <button
                          type="submit"
                          disabled={!borrowPersonId || !borrowBookId || isProcessing || !canCheckout}
                          className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold shadow-sm disabled:opacity-40 cursor-pointer transition-all"
                        >
                          Xác nhận Cấp phiếu mượn
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-3 text-xs">
                      <div className="p-2.5 rounded-xl glass-subsurface flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                          <Usb className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                          <span>{scannerStatus}</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleConnectWebSerial}
                          className="px-2.5 py-1 rounded-lg glass-subsurface bg-sky-500/12 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-semibold shrink-0 cursor-pointer transition-colors"
                        >
                          {webSerialSupported ? 'Kết nối Serial' : 'Kiểm tra Serial'}
                        </button>
                      </div>

                      <div className="space-y-2.5 p-3.5 rounded-xl glass-subsurface">
                        <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 text-sky-500" />
                          1. Quét Thẻ RFID / Định danh Bạn đọc
                        </p>
                        <input
                          type="text"
                          value={scannedRfid}
                          onChange={(e) => handleScanRfid(e.target.value)}
                          placeholder="Quét thẻ RFID, mã HS/NV hoặc email/họ tên Giáo viên..."
                          className="w-full glass-subsurface rounded-xl px-3 py-2 font-mono-tabular text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/40"
                        />
                        {identifiedBorrower && (
                          <div className="p-2.5 rounded-xl glass-subsurface bg-sky-500/12 border-sky-400/40 flex items-center justify-between">
                            <div>
                              <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                                {identifiedBorrower.fullName}
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              </p>
                              <p className="text-[11px] text-slate-600 dark:text-slate-300">{identifiedBorrower.subtitle}</p>
                            </div>
                            <Badge variant="aqua">
                              {
                                transactions.filter(
                                  (t) =>
                                    t.studentId === identifiedBorrower.id &&
                                    t.status !== 'returned' &&
                                    t.status !== 'lost'
                                ).length
                              }
                              /
                              {checkBorrowEligibility(identifiedBorrower.role, 0, false, systemSettings).maxAllowed}
                            </Badge>
                          </div>
                        )}
                      </div>

                      <div
                        className={`space-y-2.5 p-3.5 rounded-xl glass-subsurface ${
                          !identifiedBorrower ? 'opacity-60 pointer-events-none' : ''
                        }`}
                      >
                        <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          <Barcode className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                          2. Quét Mã vạch Bản sao / ISBN Sách
                        </p>
                        <input
                          type="text"
                          disabled={!identifiedBorrower}
                          value={scannedBarcode}
                          onChange={(e) => handleScanBarcode(e.target.value)}
                          placeholder="Nhập mã bản sao (VD: BOK-...-C01), tag RFID hoặc ISBN..."
                          className="w-full glass-subsurface rounded-xl px-3 py-2 font-mono-tabular text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-teal-500/40"
                        />
                        {identifiedBook && (
                          <div className="p-2.5 rounded-xl glass-subsurface bg-emerald-500/12 border-emerald-400/40 flex items-center justify-between">
                            <div className="min-w-0 pr-2">
                              <p className="font-bold text-slate-800 dark:text-slate-100 truncate">
                                {identifiedBook.title}
                              </p>
                              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                                {identifiedBook.author}
                                {identifiedCopy && ` · Bản sao: ${identifiedCopy.copyBarcode}`}
                              </p>
                            </div>
                            <Badge variant="mint">
                              Còn {identifiedBook.availableCopies}/{identifiedBook.totalCopies}
                            </Badge>
                          </div>
                        )}
                      </div>

                      {rfidError && (
                        <div className="p-2.5 rounded-xl glass-subsurface bg-rose-500/12 border-rose-400/40 text-rose-700 dark:text-rose-300 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>{rfidError}</span>
                        </div>
                      )}
                      {rfidSuccess && (
                        <div className="p-2.5 rounded-xl glass-subsurface bg-emerald-500/12 border-emerald-400/40 text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>{rfidSuccess}</span>
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-2 border-t border-white/40 dark:border-white/10">
                        <button
                          type="button"
                          onClick={() => setIsBorrowModalOpen(false)}
                          className="px-4 py-2 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer transition-colors"
                        >
                          Đóng
                        </button>
                        <button
                          type="button"
                          disabled={!identifiedBorrower || !identifiedBook || isProcessing}
                          onClick={handleConfirmRfidBorrow}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold shadow-sm disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          {isProcessing ? 'Đang xử lý...' : 'Xác nhận Mượn Sách'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Modal>

              {/* Renewals Drawer / Modal */}
              <Modal
                isOpen={isRenewalsModalOpen}
                onClose={() => setIsRenewalsModalOpen(false)}
                title="Yêu cầu Gia hạn Sách"
                maxWidth="2xl"
              >
                <LibraryRenewalsPanel
                  currentUser={currentUser}
                  transactions={transactions}
                  reservations={reservations}
                  renewalRequests={renewalRequests}
                  systemSettings={systemSettings}
                  canApprove={canManageCatalog}
                  onSubmitRenewalRequest={async (req) => {
                    if (onSubmitRenewalRequest) await onSubmitRenewalRequest(req);
                  }}
                  onApproveRenewalRequest={async (req) => {
                    if (onApproveRenewalRequest) await onApproveRenewalRequest(req);
                  }}
                  onRejectRenewalRequest={async (req, note) => {
                    if (onRejectRenewalRequest) await onRejectRenewalRequest(req, note);
                  }}
                  onDirectRenew={handleRenewTransaction}
                  onOpenDueDateEdit={(tx) => setEditingDueDateTx(tx)}
                />
              </Modal>

              {/* Reservation Modal */}
              <Modal
                isOpen={isReserveOpen}
                onClose={() => setIsReserveOpen(false)}
                title="Đặt giữ Sách Thư viện"
                maxWidth="md"
              >
                <form onSubmit={handleCreateReservation} className="space-y-3 text-xs">
                  {!isPureStudent && (
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Học sinh *</label>
                      <select
                        required
                        value={reserveStudentId}
                        onChange={(e) => setReserveStudentId(e.target.value)}
                        className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none"
                      >
                        <option value="">-- Chọn học sinh --</option>
                        {students.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.fullName} ({s.studentCode})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Chọn đầu sách *</label>
                    <select
                      required
                      value={reserveBookId}
                      onChange={(e) => setReserveBookId(e.target.value)}
                      className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none"
                    >
                      <option value="">-- Chọn sách --</option>
                      {books.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title} ({b.author})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-3 border-t border-white/40 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => setIsReserveOpen(false)}
                      className="px-4 py-2 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer transition-colors"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-bold shadow-sm cursor-pointer transition-all"
                    >
                      Xác nhận đặt giữ
                    </button>
                  </div>
                </form>
              </Modal>
            </div>
          )}

          {/* 4. LỊCH SỬ GIAO DỊCH & NHẬT KÝ HẠN TRẢ */}
          {tabId === 'history' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <select
                  value={historyFilter}
                  onChange={(e) => setHistoryFilter(e.target.value as typeof historyFilter)}
                  className="glass-subsurface rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none"
                >
                  <option value="all">Tất cả trạng thái</option>
                  {txStatusOptions.map((opt) => (
                    <option key={opt.id} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ModuleDataActions
                  moduleKey="borrow_migration"
                  context={effectiveContext}
                  currentUser={currentUser}
                  allRecords={transactions as unknown as Record<string, unknown>[]}
                  filteredRecords={filteredHistory as unknown as Record<string, unknown>[]}
                  canCreate={false}
                  canImport={canMigrateBorrowHistory}
                  canExport={canExportLibrary}
                  onCommitImport={safeCommitImport}
                  onLogExport={onLogExport}
                />
              </div>

              {filteredHistory.length === 0 ? (
                <EmptyState
                  icon={Clock}
                  title="Chưa có lịch sử giao dịch"
                  description="Các lượt mượn trả qua quầy lưu thông sẽ hiển thị tại đây."
                />
              ) : (
                <div className="glass-table-shell">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="glass-table-head">
                        <tr>
                          <th className="px-4 py-2.5">Mã giao dịch</th>
                          <th className="px-4 py-2.5">Bạn đọc</th>
                          <th className="px-4 py-2.5">Sách</th>
                          <th className="px-4 py-2.5">Ngày mượn</th>
                          <th className="px-4 py-2.5">Hạn / Ngày trả</th>
                          <th className="px-4 py-2.5">Trạng thái</th>
                          {canManageCatalog && <th className="px-4 py-2.5 text-right">Hạn trả</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/25 dark:divide-white/10">
                        {filteredHistory.map((tr) => {
                          const over =
                            tr.status !== 'returned' &&
                            tr.status !== 'lost' &&
                            checkIsOverdue(tr.dueDate).isOverdue;
                          const isActive = tr.status !== 'returned' && tr.status !== 'lost';
                          return (
                            <tr key={tr.id} className="glass-table-row">
                              <td className="px-4 py-2.5 font-mono-tabular font-semibold text-sky-700 dark:text-sky-300">
                                {tr.transactionCode}
                              </td>
                              <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-100">
                                {tr.studentName}
                              </td>
                              <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">{tr.bookTitle}</td>
                              <td className="px-4 py-2.5 font-mono-tabular text-slate-600 dark:text-slate-300">{tr.borrowDate}</td>
                              <td className="px-4 py-2.5 font-mono-tabular text-slate-700 dark:text-slate-200">
                                {tr.returnDate ? `Trả: ${tr.returnDate}` : `Hạn: ${tr.dueDate}`}
                              </td>
                              <td className="px-4 py-2.5">
                                <Badge
                                  variant={
                                    tr.status === 'returned'
                                      ? 'mint'
                                      : tr.status === 'lost' || over
                                      ? 'pink'
                                      : 'blue'
                                  }
                                  size="sm"
                                >
                                  {tr.status === 'returned'
                                    ? 'Đã trả'
                                    : tr.status === 'lost'
                                    ? 'Báo mất'
                                    : over
                                    ? 'Quá hạn'
                                    : 'Đang mượn'}
                                </Badge>
                              </td>
                              {canManageCatalog && (
                                <td className="px-4 py-2.5 text-right">
                                  {isActive ? (
                                    <button
                                      type="button"
                                      onClick={() => setEditingDueDateTx(tr)}
                                      className="px-2.5 py-1 rounded-lg glass-subsurface bg-indigo-500/12 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-semibold cursor-pointer transition-colors"
                                    >
                                      Sửa hạn trả
                                    </button>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Immutable Due-Date & Renewal Audit Trail */}
              <div className="glass-table-shell">
                <div className="px-4 py-3 border-b border-white/35 dark:border-white/10 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-indigo-500" />
                    Nhật ký Gia hạn &amp; Điều chỉnh Hạn trả ({transactionHistory.length})
                  </h3>
                </div>
                {transactionHistory.length === 0 ? (
                  <p className="p-5 text-center text-xs text-slate-500 dark:text-slate-400">
                    Chưa có bản ghi điều chỉnh hạn trả hoặc duyệt gia hạn nào.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="glass-table-head">
                        <tr>
                          <th className="px-4 py-2">Thời điểm</th>
                          <th className="px-4 py-2">Phiếu · Sách</th>
                          <th className="px-4 py-2">Loại thao tác</th>
                          <th className="px-4 py-2">Hạn cũ → Hạn mới</th>
                          <th className="px-4 py-2">Người thực hiện</th>
                          <th className="px-4 py-2">Lý do</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/25 dark:divide-white/10">
                        {transactionHistory.map((h) => (
                          <tr key={h.id} className="glass-table-row">
                            <td className="px-4 py-2 font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400">
                              {new Date(h.changedAt).toLocaleString('vi-VN')}
                            </td>
                            <td className="px-4 py-2">
                              <span className="font-mono-tabular font-semibold text-sky-600 dark:text-sky-400">{h.transactionCode}</span>
                              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                                {h.bookTitle} ({h.borrowerName})
                              </p>
                            </td>
                            <td className="px-4 py-2">
                              <Badge
                                variant={h.actionType === 'due_date_edited' ? 'amber' : 'mint'}
                                size="sm"
                              >
                                {h.actionType === 'due_date_edited'
                                  ? 'Sửa hạn trả'
                                  : h.actionType === 'renew_approved'
                                  ? 'Duyệt gia hạn'
                                  : h.actionType}
                              </Badge>
                            </td>
                            <td className="px-4 py-2 font-mono-tabular text-slate-700 dark:text-slate-200">
                              {h.oldDueDate || '—'} → <strong>{h.newDueDate || '—'}</strong>
                            </td>
                            <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-100">{h.changedBy}</td>
                            <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{h.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. CÀI ĐẶT CHÍNH SÁCH */}
          {tabId === 'settings' && (
            <LibraryPolicySettingsPanel
              systemSettings={systemSettings}
              currentUser={currentUser}
              canEdit={canManageCatalog}
              onSaveSettings={async (nextSettings) => {
                if (onSaveSettings) await onSaveSettings(nextSettings);
              }}
            />
          )}

          {/* Shared Modals */}
          <Modal
            isOpen={Boolean(returnActionTx)}
            onClose={() => setReturnActionTx(null)}
            title="Xác nhận Trả sách & Tình trạng Bản sao"
            maxWidth="md"
          >
            {returnActionTx && (
              <form onSubmit={handleConfirmReturnSubmit} className="space-y-3 text-xs">
                <div className="p-3 rounded-xl glass-subsurface space-y-1">
                  <p className="font-bold text-slate-800 dark:text-slate-100">{returnActionTx.bookTitle}</p>
                  <p className="text-slate-600 dark:text-slate-300">
                    Bạn đọc: {returnActionTx.studentName} · Bản sao: <span className="font-mono-tabular">{returnActionTx.copyBarcode}</span>
                  </p>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Tình trạng sách khi trả</label>
                  <select
                    value={returnCondition}
                    onChange={(e) =>
                      setReturnCondition(
                        e.target.value as NonNullable<BorrowTransaction['conditionOnReturn']>
                      )
                    }
                    className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none"
                  >
                    {returnConditionOptions.map((opt) => (
                      <option key={opt.id} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Phí phạt quá hạn / bồi thường (VNĐ)</label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={returnFine}
                    onChange={(e) => setReturnFine(Number(e.target.value) || 0)}
                    className="w-full glass-subsurface rounded-xl px-3 py-2 font-mono-tabular text-slate-800 dark:text-slate-100 outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t border-white/40 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setReturnActionTx(null)}
                    className="px-4 py-2 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold shadow-sm cursor-pointer transition-all"
                  >
                    Hoàn tất Trả sách
                  </button>
                </div>
              </form>
            )}
          </Modal>

          <LibraryDueDateModal
            transaction={editingDueDateTx}
            currentUser={currentUser}
            onClose={() => setEditingDueDateTx(null)}
            onConfirm={async (txId, newDueDate, reason) => {
              if (onEditDueDate) {
                await onEditDueDate(txId, newDueDate, reason);
              }
            }}
          />
        </>
      )}
    </AppWindowShell>
  );
};
