import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDevelopmentAdminMode,
  resolveBackendApiEffectiveRole,
  resolveEffectiveAccountProvisioning,
} from './devAdminMode';
import { canAccessSuperApp } from './rbac';
import { SUPER_APP_ORDER } from '../data/appRegistry';
import type { UserInvite, UserProfile } from '../types';

test('parseDevelopmentAdminMode defaults to true during development and toggles cleanly off/on', () => {
  assert.equal(parseDevelopmentAdminMode(undefined), true);
  assert.equal(parseDevelopmentAdminMode(''), true);
  assert.equal(parseDevelopmentAdminMode('true'), true);
  assert.equal(parseDevelopmentAdminMode('1'), true);
  assert.equal(parseDevelopmentAdminMode(true), true);

  assert.equal(parseDevelopmentAdminMode('false'), false);
  assert.equal(parseDevelopmentAdminMode('FALSE'), false);
  assert.equal(parseDevelopmentAdminMode('0'), false);
  assert.equal(parseDevelopmentAdminMode('off'), false);
  assert.equal(parseDevelopmentAdminMode(false), false);
});

test('DEVELOPMENT_ADMIN_MODE=true grants Admin to new accounts on first login across all 10 Super Apps', () => {
  const res = resolveEffectiveAccountProvisioning({
    isDevAdminMode: true,
    isPrimaryAdmin: false,
    emailVerified: true,
    displayNameFallback: 'New Tester',
    invite: null,
    existingUser: null,
  });

  assert.equal(res.mode, 'create');
  assert.equal(res.role, 'admin');
  assert.equal(res.status, 'active');
  assert.equal(res.reason, 'development_admin_mode');

  const provisionedUser: UserProfile = {
    id: 'uid-new-tester',
    email: 'newtester@gmail.com',
    displayName: 'New Tester',
    role: res.role,
    status: res.status,
    schoolId: res.schoolId,
  };

  for (const appId of SUPER_APP_ORDER) {
    assert.equal(
      canAccessSuperApp(provisionedUser, appId),
      true,
      `Dev Admin should have access to SuperApp "${appId}"`
    );
  }
});

test('DEVELOPMENT_ADMIN_MODE=true promotes existing student/staff accounts to Admin without losing profile metadata', () => {
  const existingStudent: UserProfile = {
    id: 'uid-existing-stu',
    email: 'student01@gmail.com',
    displayName: 'Nguyễn Văn A',
    role: 'student',
    status: 'active',
    schoolId: 'schoolhub_main',
    studentCode: 'HS2026-01',
    classId: 'CLS-10A1',
    className: '10A1',
    grade: 10,
    linkedProfileId: 'STU-01',
  };

  const upgraded = resolveEffectiveAccountProvisioning({
    isDevAdminMode: true,
    isPrimaryAdmin: false,
    emailVerified: true,
    displayNameFallback: existingStudent.displayName,
    existingUser: existingStudent,
  });

  assert.equal(upgraded.mode, 'update');
  assert.equal(upgraded.shouldPersistUpdate, true);
  assert.equal(upgraded.role, 'admin');
  assert.equal(upgraded.status, 'active');
  assert.equal(upgraded.preDevRole, 'student');

  // Subsequent reloads / re-logins / cross-device logins see persisted Admin with no redundant write
  const persistedAdmin: UserProfile = {
    ...existingStudent,
    role: upgraded.role,
    status: upgraded.status,
    preDevRole: upgraded.preDevRole,
  };
  const reloadCheck = resolveEffectiveAccountProvisioning({
    isDevAdminMode: true,
    isPrimaryAdmin: false,
    emailVerified: true,
    displayNameFallback: persistedAdmin.displayName,
    existingUser: persistedAdmin,
  });

  assert.equal(reloadCheck.mode, 'keep');
  assert.equal(reloadCheck.shouldPersistUpdate, false);
  assert.equal(reloadCheck.role, 'admin');
});

test('DEVELOPMENT_ADMIN_MODE=false reverts uninvited new accounts to student, honors invite role for invited users, and preserves existing profiles', () => {
  const uninvitedNew = resolveEffectiveAccountProvisioning({
    isDevAdminMode: false,
    isPrimaryAdmin: false,
    emailVerified: true,
    displayNameFallback: 'Fresh User',
    invite: null,
    existingUser: null,
  });
  assert.equal(uninvitedNew.role, 'student');
  assert.equal(uninvitedNew.status, 'active');
  assert.equal(uninvitedNew.reason, 'default_student');

  const teacherInvite: UserInvite = {
    id: 'INV_gv_toan_school.vn',
    email: 'gv.toan@school.vn',
    emailLower: 'gv.toan@school.vn',
    displayName: 'Thầy Minh',
    role: 'subject_teacher',
    status: 'active',
    schoolId: 'schoolhub_main',
    createdAt: '2026-11-14T00:00:00.000Z',
    updatedAt: '2026-11-14T00:00:00.000Z',
  };
  const invitedRes = resolveEffectiveAccountProvisioning({
    isDevAdminMode: false,
    isPrimaryAdmin: false,
    emailVerified: true,
    displayNameFallback: 'Thầy Minh',
    invite: teacherInvite,
    existingUser: null,
  });
  assert.equal(invitedRes.role, 'subject_teacher');
  assert.equal(invitedRes.claimInvite, true);
  assert.equal(invitedRes.reason, 'invite_claim');

  const existingTeacher: UserProfile = {
    id: 'uid-teacher',
    email: 'gv.toan@school.vn',
    displayName: 'Thầy Minh',
    role: 'homeroom_teacher',
    status: 'active',
    schoolId: 'schoolhub_main',
  };
  const existingRes = resolveEffectiveAccountProvisioning({
    isDevAdminMode: false,
    isPrimaryAdmin: false,
    emailVerified: true,
    displayNameFallback: 'Thầy Minh',
    existingUser: existingTeacher,
  });
  assert.equal(existingRes.role, 'homeroom_teacher');
  assert.equal(existingRes.shouldPersistUpdate, false);
});

test('resolveBackendApiEffectiveRole enforces Admin during dev mode and defaults unspecified roles to student when disabled', () => {
  assert.equal(resolveBackendApiEffectiveRole(undefined, true), 'admin');
  assert.equal(resolveBackendApiEffectiveRole('student', true), 'admin');
  assert.equal(resolveBackendApiEffectiveRole('student', false), 'student');
  assert.equal(resolveBackendApiEffectiveRole('principal', false), 'principal');
  assert.equal(resolveBackendApiEffectiveRole(undefined, false), 'student');
});
