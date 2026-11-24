import type {
  BorrowTransaction,
  BookReservation,
  SchoolClass,
  StaffMember,
  Student,
  SuperAppId,
  Teacher,
} from '../types';
import { APP_REGISTRY } from '../data/appRegistry';

const TAB_ALIASES: Record<SuperAppId, Record<string, string>> = {
  admin: {
    overview: 'overview',
    users: 'users',
    permissions: 'permissions',
    settings: 'settings',
    catalogs: 'overview',
    logs: 'overview',
  },
  school: {
    'students-classes': 'students-classes',
    students: 'students-classes',
    classes: 'students-classes',
    years: 'students-classes',
    'staff-hr': 'staff-hr',
    teachers: 'staff-hr',
    staff: 'staff-hr',
    emulation: 'emulation',
    rules: 'emulation',
    violations: 'emulation',
    rankings: 'emulation',
    competitions: 'emulation',
  },
  learning: {
    timetable: 'timetable',
    schedule: 'schedule',
    attendance: 'timetable',
    grades: 'timetable',
    assignments: 'timetable',
    materials: 'timetable',
  },
  library: {
    overview: 'overview',
    catalog: 'catalog',
    copies: 'catalog',
    circulation: 'circulation',
    borrow: 'circulation',
    return: 'circulation',
    renew: 'circulation',
    reservations: 'circulation',
    overdue: 'circulation',
    history: 'history',
    settings: 'settings',
  },
  services: {
    surveys: 'surveys',
    feedback: 'surveys',
    reports: 'surveys',
    support: 'surveys',
    counseling: 'counseling',
    leave: 'leave',
  },
  communication: {
    announcements: 'announcements',
    events: 'events',
    calendar: 'calendar',
    dispatch: 'dispatch',
  },
  facilities: {
    overview: 'overview',
    rooms: 'rooms',
    equipment: 'equipment',
    broken: 'broken',
    maintenance: 'maintenance',
  },
  analytics: {
    dashboard: 'dashboard',
    reports: 'reports',
    'ai-analysis': 'ai-analysis',
    'ai-assistant': 'ai-assistant',
    data: 'data',
  },
  subjects: {
    overview: 'overview',
    subjects: 'overview',
    english: 'english',
    lingo: 'english',
    math: 'math',
    toan: 'math',
    mathbuddy: 'math',
    physics: 'physics',
    ly: 'physics',
    vatly: 'physics',
    'vat-ly': 'physics',
    chemistry: 'chemistry',
    hoa: 'chemistry',
    hoahoc: 'chemistry',
    'hoa-hoc': 'chemistry',
    chemilab: 'chemistry',
    literature: 'literature',
    van: 'literature',
    nguvan: 'literature',
    'ngu-van': 'literature',
    trangvan: 'literature',
    'trang-van': 'literature',
    vanhien: 'literature',
    'van-hien': 'literature',
    history: 'history',
    su: 'history',
    lichsu: 'history',
    'lich-su': 'history',
    suky: 'history',
    'su-ky': 'history',
    geography: 'geography',
    dia: 'geography',
    dialy: 'geography',
    'dia-ly': 'geography',
    atlat: 'geography',
    atlas: 'geography',
  },
};

export function resolveAppTabAlias(appId: SuperAppId, tabId?: string): string {
  const meta = APP_REGISTRY[appId];
  if (!meta) return tabId || 'overview';
  if (!tabId) return meta.defaultTab;
  const mapped = TAB_ALIASES[appId]?.[tabId];
  if (mapped) return mapped;
  return meta.tabs.some((t) => t.id === tabId) ? tabId : meta.defaultTab;
}

export function filterUnifiedStudents(params: {
  students: Student[];
  classes: SchoolClass[];
  academicYear?: string;
  grade?: string;
  classId?: string;
  search?: string;
}): Student[] {
  const { students, classes, academicYear = 'all', grade = 'all', classId = 'all', search = '' } = params;
  const q = search.trim().toLowerCase();

  const matchingYearClassIds =
    academicYear === 'all'
      ? null
      : new Set(classes.filter((c) => c.academicYear === academicYear).map((c) => c.id));
  const matchingYearClassNames =
    academicYear === 'all'
      ? null
      : new Set(classes.filter((c) => c.academicYear === academicYear).map((c) => c.name));

  return students.filter((s) => {
    if (matchingYearClassIds && matchingYearClassNames) {
      const inYear = matchingYearClassIds.has(s.classId) || matchingYearClassNames.has(s.className);
      if (!inYear) return false;
    }
    if (grade !== 'all' && String(s.grade) !== grade) {
      return false;
    }
    if (classId !== 'all' && s.classId !== classId && s.className !== classId) {
      return false;
    }
    if (!q) return true;
    return (
      s.fullName.toLowerCase().includes(q) ||
      s.studentCode.toLowerCase().includes(q) ||
      (s.rfidCardId || '').toLowerCase().includes(q) ||
      s.className.toLowerCase().includes(q)
    );
  });
}

export type UnifiedHRGroup = 'all' | 'bgh' | 'teacher' | 'staff';

export interface UnifiedStaffRecord {
  id: string;
  source: 'teacher' | 'staff';
  fullName: string;
  code: string;
  roleGroup: Exclude<UnifiedHRGroup, 'all'>;
  roleLabel: string;
  departmentOrSubject: string;
  email: string;
  phone: string;
  status: string;
  isHomeroom?: boolean;
  homeroomClassName?: string;
  assignedClasses?: string[];
}

export function buildUnifiedHRRecords(
  teachers: Teacher[],
  staffMembers: StaffMember[]
): UnifiedStaffRecord[] {
  const teacherRecords: UnifiedStaffRecord[] = teachers.map((t) => {
    const isBgh = t.role === 'principal' || t.role === 'admin';
    return {
      id: t.id,
      source: 'teacher',
      fullName: t.fullName,
      code: t.id,
      roleGroup: isBgh ? 'bgh' : 'teacher',
      roleLabel: isBgh ? 'Ban Giám hiệu' : t.isHomeroom ? `GVCN ${t.homeroomClassName || ''}`.trim() : 'Giáo viên',
      departmentOrSubject: t.subject,
      email: t.email || '',
      phone: t.phone || '',
      status: t.status,
      isHomeroom: t.isHomeroom,
      homeroomClassName: t.homeroomClassName,
      assignedClasses: t.assignedClasses || [],
    };
  });

  const staffRecords: UnifiedStaffRecord[] = staffMembers.map((m) => ({
    id: m.id,
    source: 'staff',
    fullName: m.fullName,
    code: m.staffCode,
    roleGroup: 'staff',
    roleLabel: m.position || 'Nhân viên',
    departmentOrSubject: m.department,
    email: m.email || '',
    phone: m.phone || '',
    status: m.status,
  }));

  return [...teacherRecords, ...staffRecords];
}

export function filterUnifiedHRRecords(params: {
  records: UnifiedStaffRecord[];
  groupFilter?: UnifiedHRGroup;
  departmentFilter?: string;
  statusFilter?: string;
  search?: string;
}): UnifiedStaffRecord[] {
  const {
    records,
    groupFilter = 'all',
    departmentFilter = 'all',
    statusFilter = 'all',
    search = '',
  } = params;
  const q = search.trim().toLowerCase();

  return records.filter((rec) => {
    if (groupFilter !== 'all' && rec.roleGroup !== groupFilter) return false;
    if (departmentFilter !== 'all' && rec.departmentOrSubject !== departmentFilter) return false;
    if (statusFilter !== 'all' && rec.status !== statusFilter) return false;
    if (!q) return true;
    return (
      rec.fullName.toLowerCase().includes(q) ||
      rec.code.toLowerCase().includes(q) ||
      rec.departmentOrSubject.toLowerCase().includes(q) ||
      rec.email.toLowerCase().includes(q) ||
      (rec.homeroomClassName || '').toLowerCase().includes(q)
    );
  });
}

export type CirculationStatusFilter = 'all' | 'borrowed' | 'reserved' | 'overdue' | 'returned';

export function filterLibraryCirculation(params: {
  transactions: BorrowTransaction[];
  reservations: BookReservation[];
  statusFilter: CirculationStatusFilter;
  search: string;
  isTxOverdue: (tx: BorrowTransaction) => boolean;
}): {
  transactions: BorrowTransaction[];
  reservations: BookReservation[];
} {
  const { transactions, reservations, statusFilter, search, isTxOverdue } = params;
  const q = search.trim().toLowerCase();

  const matchesSearchTx = (tx: BorrowTransaction) => {
    if (!q) return true;
    return (
      tx.studentName.toLowerCase().includes(q) ||
      tx.studentCode.toLowerCase().includes(q) ||
      tx.bookTitle.toLowerCase().includes(q) ||
      tx.transactionCode.toLowerCase().includes(q) ||
      tx.copyBarcode.toLowerCase().includes(q)
    );
  };

  const matchesSearchRes = (res: BookReservation) => {
    if (!q) return true;
    return (
      res.studentName.toLowerCase().includes(q) ||
      res.studentCode.toLowerCase().includes(q) ||
      res.bookTitle.toLowerCase().includes(q)
    );
  };

  const filteredTx = transactions.filter((tx) => {
    if (!matchesSearchTx(tx)) return false;
    const isActive = tx.status !== 'returned' && tx.status !== 'lost';
    const overdue = isActive && isTxOverdue(tx);

    if (statusFilter === 'reserved') return false;
    if (statusFilter === 'borrowed') return isActive && !overdue;
    if (statusFilter === 'overdue') return overdue;
    if (statusFilter === 'returned') return tx.status === 'returned';
    return isActive; // 'all' defaults to active loans in circulation desk alongside active reservations
  });

  const filteredRes = reservations.filter((res) => {
    if (!matchesSearchRes(res)) return false;
    const activeRes = res.status === 'pending' || res.status === 'ready';
    if (statusFilter === 'reserved') return true;
    if (statusFilter === 'all') return activeRes;
    return false;
  });

  return { transactions: filteredTx, reservations: filteredRes };
}
