import {
  AcademicRecord,
  AppAction,
  AppModuleId,
  FeedbackReport,
  PermissionMatrix,
  Student,
  StudentLeaveRequest,
  SuperAppId,
  Teacher,
  UserProfile,
  UserRole,
} from '../types';
import { APP_REGISTRY } from '../data/appRegistry';
import type { AppTabDefinition } from '../types/window';

export interface RoleInfo {
  role: UserRole;
  label: string;
  badgeColor: string;
  description: string;
}

export const ROLE_DEFINITIONS: Record<UserRole, RoleInfo> = {
  admin: {
    role: 'admin',
    label: 'Quản trị viên Hệ thống',
    badgeColor: 'bg-red-500/15 text-red-700 border-red-300/40',
    description: 'Quản trị cấu hình kỹ thuật, người dùng và phân quyền hệ thống',
  },
  principal: {
    role: 'principal',
    label: 'Ban Giám hiệu',
    badgeColor: 'bg-purple-500/15 text-purple-700 border-purple-300/40',
    description: 'Điều hành chuyên môn toàn trường, phê duyệt nội quy, thi đua, thông báo và báo cáo',
  },
  homeroom_teacher: {
    role: 'homeroom_teacher',
    label: 'Giáo viên Chủ nhiệm',
    badgeColor: 'bg-blue-500/15 text-blue-700 border-blue-300/40',
    description: 'Quản lý học sinh lớp chủ nhiệm, chuyên cần, thi đua lớp và phối hợp phụ huynh',
  },
  subject_teacher: {
    role: 'subject_teacher',
    label: 'Giáo viên Bộ môn',
    badgeColor: 'bg-emerald-500/15 text-emerald-700 border-emerald-300/40',
    description: 'Nhập điểm môn học phụ trách, điểm danh tiết học và ghi nhận thi đua',
  },
  librarian: {
    role: 'librarian',
    label: 'Thủ thư Thư viện',
    badgeColor: 'bg-amber-500/15 text-amber-700 border-amber-300/40',
    description: 'Quản lý ấn phẩm, chính sách mượn trả, gia hạn và kiểm kê RFID/Barcode',
  },
  counselor: {
    role: 'counselor',
    label: 'Chuyên viên Tư vấn Tâm lý',
    badgeColor: 'bg-teal-500/15 text-teal-700 border-teal-300/40',
    description: 'Tiếp nhận hồ sơ tư vấn tâm lý, học tập, hướng nghiệp và bảo mật thông tin',
  },
  staff: {
    role: 'staff',
    label: 'Cán bộ Cơ sở vật chất',
    badgeColor: 'bg-orange-500/15 text-orange-700 border-orange-300/40',
    description: 'Quản lý tài sản thiết bị, xử lý bảo trì sửa chữa phòng học',
  },
  student: {
    role: 'student',
    label: 'Học sinh',
    badgeColor: 'bg-sky-500/15 text-sky-700 border-sky-300/40',
    description: 'Xem điểm, thời khóa biểu, thư viện, bảng thi đua cá nhân/lớp và khiếu nại',
  },
};

export const DEFAULT_PERMISSIONS: PermissionMatrix = {
  admin: {
    dashboard: ['view', 'export'],
    students: ['view', 'create', 'edit', 'delete', 'export'],
    staff: ['view', 'create', 'edit', 'delete', 'export'],
    classes: ['view', 'create', 'edit', 'delete', 'export'],
    timetable: ['view', 'create', 'edit', 'delete', 'export'],
    library: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
    surveys: ['view', 'create', 'edit', 'delete', 'export'],
    feedback: ['view', 'edit', 'delete', 'approve', 'export'],
    counseling: [],
    academic: ['view', 'create', 'edit', 'delete', 'export'],
    announcements: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
    facilities: ['view', 'create', 'edit', 'delete', 'export'],
    reports: ['view', 'export'],
    datacenter: ['view', 'create', 'edit', 'export'],
    permissions: ['view', 'edit', 'approve'],
    emulation: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
    rules: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
  },
  principal: {
    dashboard: ['view', 'export'],
    students: ['view', 'create', 'edit', 'export'],
    staff: ['view', 'create', 'edit', 'export'],
    classes: ['view', 'create', 'edit', 'export'],
    timetable: ['view', 'create', 'edit', 'export'],
    library: ['view', 'edit', 'approve', 'export'],
    surveys: ['view', 'create', 'edit', 'approve', 'export'],
    feedback: ['view', 'edit', 'approve', 'export'],
    counseling: [],
    academic: ['view', 'approve', 'export'],
    announcements: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
    facilities: ['view', 'approve', 'export'],
    reports: ['view', 'export'],
    datacenter: ['view', 'export'],
    permissions: ['view'],
    emulation: ['view', 'create', 'edit', 'approve', 'export'],
    rules: ['view', 'create', 'edit', 'approve', 'export'],
  },
  homeroom_teacher: {
    dashboard: ['view'],
    students: ['view', 'edit', 'export'],
    staff: ['view'],
    classes: ['view'],
    timetable: ['view'],
    library: ['view'],
    surveys: ['view', 'create'],
    feedback: ['view'],
    counseling: [],
    academic: ['view', 'edit', 'export'],
    announcements: ['view', 'create'],
    facilities: ['view', 'create'],
    reports: ['view'],
    datacenter: [],
    permissions: [],
    emulation: ['view', 'create', 'edit', 'export'],
    rules: ['view'],
  },
  subject_teacher: {
    dashboard: ['view'],
    students: ['view'],
    staff: ['view'],
    classes: ['view'],
    timetable: ['view'],
    library: ['view'],
    surveys: ['view'],
    feedback: ['view'],
    counseling: [],
    academic: ['view', 'create', 'edit'],
    announcements: ['view'],
    facilities: ['view', 'create'],
    reports: ['view'],
    datacenter: [],
    permissions: [],
    emulation: ['view', 'create'],
    rules: ['view'],
  },
  librarian: {
    dashboard: ['view'],
    students: ['view'],
    staff: ['view'],
    classes: ['view'],
    timetable: ['view'],
    library: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
    surveys: ['view'],
    feedback: ['view'],
    counseling: [],
    academic: [],
    announcements: ['view', 'create'],
    facilities: ['view', 'create'],
    reports: ['view'],
    datacenter: ['view', 'create', 'export'],
    permissions: [],
    emulation: ['view'],
    rules: ['view'],
  },
  counselor: {
    dashboard: ['view'],
    students: ['view'],
    staff: ['view'],
    classes: ['view'],
    timetable: ['view'],
    library: ['view'],
    surveys: ['view', 'create'],
    feedback: ['view'],
    counseling: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
    academic: [],
    announcements: ['view'],
    facilities: ['view'],
    reports: ['view'],
    datacenter: [],
    permissions: [],
    emulation: ['view'],
    rules: ['view'],
  },
  staff: {
    dashboard: ['view'],
    students: ['view'],
    staff: ['view'],
    classes: ['view'],
    timetable: ['view'],
    library: ['view'],
    surveys: ['view'],
    feedback: ['view'],
    counseling: [],
    academic: [],
    announcements: ['view'],
    facilities: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
    reports: ['view'],
    datacenter: ['view'],
    permissions: [],
    emulation: ['view'],
    rules: ['view'],
  },
  student: {
    dashboard: ['view'],
    students: [],
    staff: [],
    classes: [],
    timetable: ['view'],
    library: ['view', 'create'],
    surveys: ['view', 'create'],
    feedback: ['view', 'create'],
    counseling: ['view', 'create'],
    academic: ['view'],
    announcements: ['view'],
    facilities: ['view', 'create'],
    reports: [],
    datacenter: [],
    permissions: [],
    emulation: ['view'],
    rules: ['view'],
  },
};

export function getEffectiveRoles(userOrRole: UserProfile | UserRole): UserRole[] {
  if (typeof userOrRole === 'string') {
    return ROLE_DEFINITIONS[userOrRole] ? [userOrRole] : ['student'];
  }
  const primaryRole: UserRole =
    userOrRole?.role && ROLE_DEFINITIONS[userOrRole.role] ? userOrRole.role : 'student';
  const set = new Set<UserRole>([primaryRole]);
  if (Array.isArray(userOrRole?.secondaryRoles)) {
    for (const r of userOrRole.secondaryRoles) {
      if (r && ROLE_DEFINITIONS[r]) {
        set.add(r);
      }
    }
  }
  return Array.from(set);
}

export function userHasRole(
  userOrRole: UserProfile | UserRole,
  target: UserRole | UserRole[]
): boolean {
  const effective = getEffectiveRoles(userOrRole);
  const targets = Array.isArray(target) ? target : [target];
  return targets.some((t) => effective.includes(t));
}

export function formatUserRolesLabel(user: Pick<UserProfile, 'role' | 'secondaryRoles'>): string {
  const roles = getEffectiveRoles(user as UserProfile);
  return roles.map((r) => ROLE_DEFINITIONS[r]?.label || r).join(' + ');
}

function singleRoleHasPermission(
  role: UserRole,
  module: AppModuleId,
  action: AppAction,
  customMatrix: PermissionMatrix = DEFAULT_PERMISSIONS
): boolean {
  if (module === 'counseling' && role !== 'counselor' && role !== 'student') {
    return false;
  }
  const roleRules = customMatrix[role] || DEFAULT_PERMISSIONS[role];
  if (!roleRules) return false;
  const moduleActions = roleRules[module] || DEFAULT_PERMISSIONS[role]?.[module];
  if (!moduleActions) return false;
  if (role === 'admin' && module !== 'counseling') {
    return true;
  }
  return moduleActions.includes(action);
}

export function hasPermission(
  userOrRole: UserProfile | UserRole,
  module: AppModuleId,
  action: AppAction,
  customMatrix: PermissionMatrix = DEFAULT_PERMISSIONS,
  userOverride?: Partial<Record<AppModuleId, AppAction[]>>
): boolean {
  const roles = getEffectiveRoles(userOrRole);
  const resolvedOverride =
    userOverride ?? (typeof userOrRole === 'object' ? userOrRole.permissionsOverride : undefined);

  // Confidentiality invariant: non-counselor staff/BGH/admin NEVER gain counseling access via overrides or secondary roles unless 'counselor' is assigned
  if (module === 'counseling') {
    if (roles.includes('counselor')) {
      return singleRoleHasPermission('counselor', 'counseling', action, customMatrix);
    }
    if (roles.length === 1 && roles[0] === 'student') {
      return resolvedOverride?.counseling
        ? resolvedOverride.counseling.includes(action)
        : singleRoleHasPermission('student', 'counseling', action, customMatrix);
    }
    return false;
  }

  if (resolvedOverride && resolvedOverride[module]) {
    return resolvedOverride[module]!.includes(action);
  }

  return roles.some((r) => singleRoleHasPermission(r, module, action, customMatrix));
}

export function canAccessModule(
  userOrRole: UserProfile | UserRole,
  module: AppModuleId,
  customMatrix: PermissionMatrix = DEFAULT_PERMISSIONS,
  userOverride?: Partial<Record<AppModuleId, AppAction[]>>
): boolean {
  return hasPermission(userOrRole, module, 'view', customMatrix, userOverride);
}

export function getAllowedTabsForApp(
  userOrRole: UserProfile | UserRole,
  superAppId: SuperAppId,
  customMatrix: PermissionMatrix = DEFAULT_PERMISSIONS,
  userOverride?: Partial<Record<AppModuleId, AppAction[]>>
): AppTabDefinition[] {
  const meta = APP_REGISTRY[superAppId];
  if (!meta) return [];

  const roles = getEffectiveRoles(userOrRole);
  const isPureStudent = roles.length === 1 && roles[0] === 'student';

  return meta.tabs.filter((tab) => {
    if (isPureStudent && superAppId === 'school') {
      if (tab.id === 'emulation') {
        return (
          hasPermission(userOrRole, 'emulation', 'view', customMatrix, userOverride) ||
          hasPermission(userOrRole, 'rules', 'view', customMatrix, userOverride)
        );
      }
      return false;
    }
    if (isPureStudent && superAppId === 'facilities') {
      return tab.id === 'broken';
    }
    if (isPureStudent && superAppId === 'analytics') {
      return false;
    }
    if (superAppId === 'services' && tab.id === 'counseling') {
      return hasPermission(userOrRole, 'counseling', 'view', customMatrix, userOverride);
    }
    if (superAppId === 'school' && tab.id === 'emulation') {
      return (
        hasPermission(userOrRole, 'emulation', 'view', customMatrix, userOverride) ||
        hasPermission(userOrRole, 'rules', 'view', customMatrix, userOverride)
      );
    }
    const action = tab.requiredAction ?? 'view';
    return hasPermission(userOrRole, tab.permissionModule, action, customMatrix, userOverride);
  });
}

export function canAccessSuperApp(
  userOrRole: UserProfile | UserRole,
  superAppId: SuperAppId,
  customMatrix: PermissionMatrix = DEFAULT_PERMISSIONS,
  userOverride?: Partial<Record<AppModuleId, AppAction[]>>
): boolean {
  const roles = getEffectiveRoles(userOrRole);
  if (superAppId === 'admin') {
    return roles.includes('admin') || roles.includes('principal');
  }
  return getAllowedTabsForApp(userOrRole, superAppId, customMatrix, userOverride).length > 0;
}

export function canViewConfidentialCounseling(userOrRole: UserProfile | UserRole): boolean {
  return getEffectiveRoles(userOrRole).includes('counselor');
}

export function getTeacherAssignedClasses(currentUser: UserProfile, teachers: Teacher[]): string[] {
  const set = new Set<string>(currentUser.assignedClasses || []);
  if (currentUser.className) set.add(currentUser.className);
  const userEmailLower = (currentUser.email || '').trim().toLowerCase();
  const userNameLower = (currentUser.displayName || '').trim().toLowerCase();
  const matched = teachers.find(
    (t) =>
      (currentUser.linkedProfileId && t.id === currentUser.linkedProfileId) ||
      (userEmailLower && (t.email || '').trim().toLowerCase() === userEmailLower) ||
      (userNameLower && (t.fullName || '').trim().toLowerCase() === userNameLower)
  );
  if (matched?.homeroomClassName) set.add(matched.homeroomClassName);
  if (matched?.assignedClasses) {
    matched.assignedClasses.forEach((c) => set.add(c));
  }
  return Array.from(set);
}

export function filterStudentsByScope(
  students: Student[],
  currentUser: UserProfile,
  teachers: Teacher[] = []
): Student[] {
  if (
    userHasRole(currentUser, ['admin', 'principal', 'librarian', 'counselor', 'staff'])
  ) {
    return students;
  }
  if (userHasRole(currentUser, ['homeroom_teacher', 'subject_teacher'])) {
    const assigned = getTeacherAssignedClasses(currentUser, teachers);
    if (assigned.length === 0) return students;
    return students.filter((s) => assigned.includes(s.className));
  }
  if (userHasRole(currentUser, 'student')) {
    return students.filter(
      (s) =>
        s.id === currentUser.id ||
        s.id === currentUser.linkedProfileId ||
        (currentUser.studentCode && s.studentCode === currentUser.studentCode)
    );
  }
  return [];
}

export function filterFeedbacksByScope(
  feedbacks: FeedbackReport[],
  currentUser: UserProfile
): FeedbackReport[] {
  if (userHasRole(currentUser, ['admin', 'principal', 'staff'])) {
    return feedbacks;
  }
  if (userHasRole(currentUser, ['homeroom_teacher', 'subject_teacher', 'librarian', 'counselor'])) {
    return feedbacks.filter((f) => !f.isAnonymous || f.studentId === currentUser.id);
  }
  if (userHasRole(currentUser, 'student')) {
    return feedbacks.filter(
      (f) =>
        f.studentId === currentUser.id ||
        (currentUser.linkedProfileId && f.studentId === currentUser.linkedProfileId)
    );
  }
  return [];
}

export function filterLeaveRequestsByScope(
  requests: StudentLeaveRequest[],
  currentUser: UserProfile,
  teachers: Teacher[] = []
): StudentLeaveRequest[] {
  if (userHasRole(currentUser, ['admin', 'principal'])) {
    return requests;
  }
  if (userHasRole(currentUser, 'homeroom_teacher')) {
    const assigned = getTeacherAssignedClasses(currentUser, teachers);
    if (assigned.length === 0) return requests;
    return requests.filter((r) => assigned.includes(r.className));
  }
  if (userHasRole(currentUser, 'student')) {
    return requests.filter(
      (r) =>
        r.studentId === currentUser.id ||
        (currentUser.studentCode && r.studentCode === currentUser.studentCode) ||
        (currentUser.linkedProfileId && r.studentId === currentUser.linkedProfileId)
    );
  }
  return [];
}

export function filterAcademicRecordsByScope(
  records: AcademicRecord[],
  currentUser: UserProfile
): AcademicRecord[] {
  if (userHasRole(currentUser, ['admin', 'principal', 'homeroom_teacher', 'subject_teacher'])) {
    return records;
  }
  if (userHasRole(currentUser, 'student')) {
    return records.filter(
      (r) =>
        (r.studentId === currentUser.id ||
          (currentUser.studentCode && r.studentCode === currentUser.studentCode) ||
          (currentUser.linkedProfileId && r.studentId === currentUser.linkedProfileId)) &&
        r.status !== 'draft'
    );
  }
  return [];
}

export function buildRoleScopedAISummary(params: {
  currentUser: UserProfile;
  studentsCount: number;
  teachersCount: number;
  classesCount: number;
  booksCount: number;
  activeBorrowsCount: number;
  overdueBorrowsCount: number;
  openFeedbacksCount: number;
  openMaintenanceCount: number;
  ownGradesCount?: number;
  ownAvgScore?: number | null;
}): string {
  const { currentUser } = params;
  const roles = getEffectiveRoles(currentUser);
  const isPureStudent = roles.length === 1 && roles[0] === 'student';

  if (isPureStudent) {
    return [
      `Vai trò: Học sinh (${currentUser.displayName}${currentUser.className ? ` · Lớp ${currentUser.className}` : ''})`,
      `Số đầu sách thư viện hiện có: ${params.booksCount}`,
      `Số sách bạn đang mượn: ${params.activeBorrowsCount}`,
      params.ownGradesCount && params.ownGradesCount > 0 && params.ownAvgScore != null
        ? `Điểm trung bình các môn đã công bố của bạn: ${params.ownAvgScore.toFixed(1)}/10 (${params.ownGradesCount} môn)`
        : 'Chưa có bảng điểm môn học nào được công bố.',
    ].join('\n');
  }
  if (roles.length === 1 && roles[0] === 'librarian') {
    return [
      `Vai trò: Thủ thư (${currentUser.displayName})`,
      `Đầu sách trong kho: ${params.booksCount}`,
      `Lượt đang mượn: ${params.activeBorrowsCount} · Quá hạn: ${params.overdueBorrowsCount}`,
    ].join('\n');
  }
  if (roles.length === 1 && roles[0] === 'staff') {
    return [
      `Vai trò: Cán bộ Cơ sở vật chất (${currentUser.displayName})`,
      `Phiếu bảo trì đang mở: ${params.openMaintenanceCount}`,
    ].join('\n');
  }
  return [
    `Vai trò: ${formatUserRolesLabel(currentUser)}`,
    `Tổng học sinh (trong phạm vi): ${params.studentsCount} · Lớp: ${params.classesCount} · Giáo viên: ${params.teachersCount}`,
    `Thư viện: ${params.booksCount} đầu sách · ${params.activeBorrowsCount} đang mượn · ${params.overdueBorrowsCount} quá hạn`,
    `Phản ánh đang mở: ${params.openFeedbacksCount} · Bảo trì đang mở: ${params.openMaintenanceCount}`,
  ].join('\n');
}
