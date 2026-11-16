import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasPermission,
  canAccessModule,
  canAccessSuperApp,
  getAllowedTabsForApp,
  canViewConfidentialCounseling,
  filterStudentsByScope,
  filterFeedbacksByScope,
  filterLeaveRequestsByScope,
  buildRoleScopedAISummary,
  getEffectiveRoles,
  userHasRole,
  getTeacherAssignedClasses,
  DEFAULT_PERMISSIONS,
  ROLE_DEFINITIONS,
} from './rbac';
import type { UserProfile } from '../types';

test('Admin has administrative access across modules but NOT implicit access to confidential counseling', () => {
  assert.equal(hasPermission('admin', 'students', 'delete'), true);
  assert.equal(hasPermission('admin', 'permissions', 'edit'), true);
  assert.equal(hasPermission('admin', 'library', 'approve'), true);
  assert.equal(hasPermission('admin', 'counseling', 'view'), false);
  assert.equal(canViewConfidentialCounseling('admin'), false);
});

test('Principal (Ban Giám hiệu) has school-wide operational rights, emulation/rules approval, and NO technical permission edits or counseling access', () => {
  assert.equal(hasPermission('principal', 'students', 'create'), true);
  assert.equal(hasPermission('principal', 'students', 'edit'), true);
  assert.equal(hasPermission('principal', 'staff', 'edit'), true);
  assert.equal(hasPermission('principal', 'emulation', 'approve'), true);
  assert.equal(hasPermission('principal', 'rules', 'approve'), true);
  assert.equal(hasPermission('principal', 'reports', 'export'), true);
  assert.equal(hasPermission('principal', 'permissions', 'view'), true);
  assert.equal(hasPermission('principal', 'permissions', 'edit'), false);
  assert.equal(hasPermission('principal', 'counseling', 'view'), false);
});

test('Multi-role users (secondaryRoles) merge permissions cleanly while strictly isolating counseling', () => {
  const teacherWithBghAndLib: UserProfile = {
    id: 'USR-MULTI-1',
    email: 'gv.bgh@schoolhub.edu.vn',
    displayName: 'Nguyễn Văn Đa Nhiệm',
    role: 'homeroom_teacher',
    secondaryRoles: ['principal', 'librarian'],
    className: '11A1',
  };

  assert.deepEqual(getEffectiveRoles(teacherWithBghAndLib), [
    'homeroom_teacher',
    'principal',
    'librarian',
  ]);
  assert.equal(userHasRole(teacherWithBghAndLib, 'librarian'), true);
  assert.equal(hasPermission(teacherWithBghAndLib, 'library', 'approve'), true);
  assert.equal(hasPermission(teacherWithBghAndLib, 'rules', 'approve'), true);
  assert.equal(hasPermission(teacherWithBghAndLib, 'academic', 'edit'), true);
  assert.equal(hasPermission(teacherWithBghAndLib, 'permissions', 'edit'), false);
  assert.equal(hasPermission(teacherWithBghAndLib, 'counseling', 'view'), false);
  assert.equal(canViewConfidentialCounseling(teacherWithBghAndLib), false);

  const teacherAlsoCounselor: UserProfile = {
    ...teacherWithBghAndLib,
    secondaryRoles: ['counselor'],
  };
  assert.equal(hasPermission(teacherAlsoCounselor, 'counseling', 'view'), true);
  assert.equal(canViewConfidentialCounseling(teacherAlsoCounselor), true);
});

test('Counselor has exclusive confidential counseling access', () => {
  assert.equal(hasPermission('counselor', 'counseling', 'view'), true);
  assert.equal(hasPermission('counselor', 'counseling', 'edit'), true);
  assert.equal(canViewConfidentialCounseling('counselor'), true);
  assert.equal(canViewConfidentialCounseling('librarian'), false);
});

test('Custom permission matrix overrides default role rules safely without leaking counseling', () => {
  const custom = structuredClone(DEFAULT_PERMISSIONS);
  custom.staff.counseling = ['view'];
  custom.homeroom_teacher.timetable = ['view', 'create'];
  assert.equal(hasPermission('admin', 'counseling', 'view', custom), false);
  assert.equal(hasPermission('staff', 'counseling', 'view', custom), false);
  assert.equal(hasPermission('homeroom_teacher', 'timetable', 'create', custom), true);
});

test('Student can access School SuperApp ONLY for Emulation tab, plus allowed tabs across other apps', () => {
  assert.equal(hasPermission('student', 'students', 'delete'), false);
  assert.equal(hasPermission('student', 'students', 'edit'), false);
  assert.equal(hasPermission('student', 'feedback', 'create'), true);
  assert.equal(hasPermission('student', 'counseling', 'create'), true);
  assert.equal(hasPermission('student', 'emulation', 'view'), true);
  assert.equal(canAccessModule('student', 'reports'), false);
  assert.equal(canAccessModule('student', 'timetable'), true);

  assert.equal(canAccessSuperApp('student', 'admin'), false);
  assert.equal(canAccessSuperApp('student', 'school'), true);
  const studentSchoolTabs = getAllowedTabsForApp('student', 'school').map((t) => t.id);
  assert.deepEqual(studentSchoolTabs, ['emulation']);

  assert.equal(canAccessSuperApp('student', 'learning'), true);
  assert.equal(canAccessSuperApp('student', 'library'), true);
  assert.equal(canAccessSuperApp('student', 'services'), true);
  assert.equal(canAccessSuperApp('student', 'communication'), true);

  const commTabs = getAllowedTabsForApp('student', 'communication').map((t) => t.id);
  assert.equal(commTabs.includes('announcements'), true);
  assert.equal(commTabs.includes('dispatch'), false);

  const libTabs = getAllowedTabsForApp('student', 'library').map((t) => t.id);
  assert.equal(libTabs.includes('settings'), false);
  assert.equal(libTabs.includes('circulation'), true);
});

test('Teacher class scope matches by linkedProfileId or email without requiring teacherCode', () => {
  const assigned = getTeacherAssignedClasses(
    {
      id: 'USR-T1',
      email: 'gv.toan@schoolhub.edu.vn',
      displayName: 'Thầy Toán',
      role: 'subject_teacher',
      linkedProfileId: 'TCH-01',
    },
    [
      {
        id: 'TCH-01',
        fullName: 'Thầy Toán',
        subject: 'Toán học',
        email: 'gv.toan@schoolhub.edu.vn',
        phone: '0901234567',
        isHomeroom: true,
        homeroomClassName: '10A1',
        assignedClasses: ['10A1', '10A2'],
        status: 'Đang công tác',
        role: 'homeroom_teacher',
      },
    ]
  );
  assert.deepEqual(assigned.sort(), ['10A1', '10A2']);
});

test('Scope filters isolate students, feedbacks, and leave requests by role', () => {
  const stuList = [
    {
      id: 'S1',
      studentCode: 'STU-1',
      fullName: 'An',
      classId: 'CLS-11A1',
      className: '11A1',
      grade: 11,
      rfidCardId: 'R1',
      dateOfBirth: '2010-01-01',
      gender: 'Nam' as const,
      parentPhone: '0900',
      status: 'Đang học' as const,
      address: 'HN',
    },
    {
      id: 'S2',
      studentCode: 'STU-2',
      fullName: 'Bình',
      classId: 'CLS-10A1',
      className: '10A1',
      grade: 10,
      rfidCardId: 'R2',
      dateOfBirth: '2011-01-01',
      gender: 'Nam' as const,
      parentPhone: '0901',
      status: 'Đang học' as const,
      address: 'HN',
    },
  ];

  const scopedForStudent = filterStudentsByScope(stuList, {
    id: 'S1',
    email: 'an@schoolhub.edu.vn',
    displayName: 'An',
    role: 'student',
    studentCode: 'STU-1',
  });
  assert.equal(scopedForStudent.length, 1);
  assert.equal(scopedForStudent[0].id, 'S1');

  const scopedForHomeroom = filterStudentsByScope(stuList, {
    id: 'T1',
    email: 'gv@schoolhub.edu.vn',
    displayName: 'GVCN 11A1',
    role: 'homeroom_teacher',
    className: '11A1',
  });
  assert.equal(scopedForHomeroom.length, 1);
  assert.equal(scopedForHomeroom[0].className, '11A1');

  const feedbacks = [
    {
      id: 'F1',
      reportCode: 'FB-1',
      title: 'A',
      category: 'Cơ sở vật chất' as const,
      content: '...',
      location: 'B301',
      priority: 'low' as const,
      isAnonymous: false,
      studentId: 'S1',
      studentName: 'An',
      studentClass: '11A1',
      status: 'submitted' as const,
      createdAt: '2026-11-10',
      updatedAt: '2026-11-10',
    },
    {
      id: 'F2',
      reportCode: 'FB-2',
      title: 'B',
      category: 'Khác' as const,
      content: '...',
      location: 'Sân',
      priority: 'low' as const,
      isAnonymous: true,
      studentId: 'S2',
      studentName: 'Ẩn danh',
      studentClass: '10A1',
      status: 'submitted' as const,
      createdAt: '2026-11-10',
      updatedAt: '2026-11-10',
    },
  ];
  const studentFeedbacks = filterFeedbacksByScope(feedbacks, {
    id: 'S1',
    email: 'an@schoolhub.edu.vn',
    displayName: 'An',
    role: 'student',
  });
  assert.equal(studentFeedbacks.length, 1);
  assert.equal(studentFeedbacks[0].id, 'F1');

  const leaves = [
    {
      id: 'L1',
      requestCode: 'DON-1',
      studentId: 'S1',
      studentName: 'An',
      studentCode: 'STU-1',
      className: '11A1',
      type: 'Nghỉ ốm' as const,
      fromDate: '2026-11-10',
      toDate: '2026-11-10',
      reason: 'Ốm',
      status: 'pending' as const,
      createdAt: '2026-11-09',
    },
    {
      id: 'L2',
      requestCode: 'DON-2',
      studentId: 'S2',
      studentName: 'Bình',
      studentCode: 'STU-2',
      className: '10A1',
      type: 'Nghỉ ốm' as const,
      fromDate: '2026-11-10',
      toDate: '2026-11-10',
      reason: 'Ốm',
      status: 'pending' as const,
      createdAt: '2026-11-09',
    },
  ];
  const homeroomLeaves = filterLeaveRequestsByScope(leaves, {
    id: 'T1',
    email: 'gv@schoolhub.edu.vn',
    displayName: 'GVCN 11A1',
    role: 'homeroom_teacher',
    className: '11A1',
  });
  assert.equal(homeroomLeaves.length, 1);
  assert.equal(homeroomLeaves[0].id, 'L1');
});

test('buildRoleScopedAISummary omits school-wide counts for student accounts', () => {
  const summary = buildRoleScopedAISummary({
    currentUser: { id: 'S1', email: 's1@edu', displayName: 'An', role: 'student', className: '11A1' },
    studentsCount: 999,
    teachersCount: 50,
    classesCount: 30,
    booksCount: 20,
    activeBorrowsCount: 1,
    overdueBorrowsCount: 0,
    openFeedbacksCount: 10,
    openMaintenanceCount: 5,
  });
  assert.equal(summary.includes('999'), false);
  assert.equal(summary.includes('Học sinh'), true);
});

test('Role definitions map all 8 roles with non-empty labels', () => {
  const roles = Object.keys(ROLE_DEFINITIONS);
  assert.equal(roles.length, 8);
  for (const role of roles) {
    assert.ok(ROLE_DEFINITIONS[role as keyof typeof ROLE_DEFINITIONS].label.length > 0);
  }
});
