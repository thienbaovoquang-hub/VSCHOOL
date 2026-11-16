import type { UserInvite, UserProfile, UserRole } from '../types';

const DEV_DEFAULT_SCHOOL_ID = 'schoolhub_main';

function normalizeSchoolIdLocal(schoolId?: string | null): string {
  const cleaned = (schoolId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return cleaned || DEV_DEFAULT_SCHOOL_ID;
}

export interface AccountProvisioningInput {
  isDevAdminMode: boolean;
  isPrimaryAdmin: boolean;
  emailVerified: boolean;
  displayNameFallback: string;
  invite?: UserInvite | null;
  existingUser?: UserProfile | null;
}

export interface AccountProvisioningResolution {
  mode: 'create' | 'update' | 'keep';
  role: UserRole;
  status: 'active' | 'locked' | 'disabled';
  schoolId: string;
  preDevRole?: UserRole;
  secondaryRoles?: UserRole[];
  claimInvite: boolean;
  shouldPersistUpdate: boolean;
  reason:
    | 'development_admin_mode'
    | 'primary_admin'
    | 'invite_claim'
    | 'existing_profile'
    | 'default_student';
}

const VALID_ROLES = new Set<UserRole>([
  'admin',
  'principal',
  'homeroom_teacher',
  'subject_teacher',
  'librarian',
  'counselor',
  'staff',
  'student',
]);

/**
 * Parses backend DEVELOPMENT_ADMIN_MODE flag.
 * Defaults to `true` in current development phase when unset/blank,
 * and returns `false` whenever explicitly disabled ('false', '0', 'off', 'no').
 */
export function parseDevelopmentAdminMode(rawValue?: string | boolean | null): boolean {
  if (typeof rawValue === 'boolean') return rawValue;
  if (rawValue === undefined || rawValue === null) return true;
  const normalized = String(rawValue).trim().toLowerCase();
  if (!normalized) return true;
  if (['false', '0', 'off', 'no', 'disabled'].includes(normalized)) {
    return false;
  }
  if (['true', '1', 'on', 'yes', 'enabled'].includes(normalized)) {
    return true;
  }
  return true;
}

/**
 * Resolves the effective backend API role.
 * When DEVELOPMENT_ADMIN_MODE is active, authenticated requests always carry 'admin'.
 * Otherwise honors valid requested roles and defaults to 'student' (least privilege) when unspecified.
 */
export function resolveBackendApiEffectiveRole(
  requestedRole: unknown,
  isDevAdminMode: boolean
): UserRole {
  if (isDevAdminMode) {
    return 'admin';
  }
  if (typeof requestedRole === 'string' && VALID_ROLES.has(requestedRole as UserRole)) {
    return requestedRole as UserRole;
  }
  return 'student';
}

/**
 * Pure, deterministic resolver deciding what role/status/updates should be stored in Firestore
 * for an authenticated user on login/registration/session restore.
 * Never wipes existing profile metadata (`studentCode`, `className`, `linkedProfileId`, `secondaryRoles`, etc.).
 */
export function resolveEffectiveAccountProvisioning(
  input: AccountProvisioningInput
): AccountProvisioningResolution {
  const { isDevAdminMode, isPrimaryAdmin, emailVerified, invite, existingUser } = input;
  const hasUnclaimedInvite = Boolean(invite && !invite.claimedByUid && emailVerified);

  if (existingUser) {
    const existingStatus = existingUser.status || 'active';

    if (isDevAdminMode && (emailVerified || isPrimaryAdmin)) {
      const targetSchoolId = normalizeSchoolIdLocal(
        existingUser.schoolId || invite?.schoolId || DEV_DEFAULT_SCHOOL_ID
      );
      const preDevRole =
        existingUser.preDevRole ||
        (existingUser.role !== 'admin' ? existingUser.role : undefined);
      const needsRoleUpgrade = existingUser.role !== 'admin' || existingStatus !== 'active';
      const needsSchoolFill = !existingUser.schoolId;
      const needsDisplayNameFill = !existingUser.displayName && Boolean(input.displayNameFallback);

      return {
        mode: needsRoleUpgrade || needsSchoolFill || needsDisplayNameFill || hasUnclaimedInvite ? 'update' : 'keep',
        role: 'admin',
        status: 'active',
        schoolId: targetSchoolId,
        preDevRole,
        secondaryRoles: existingUser.secondaryRoles ?? invite?.secondaryRoles,
        claimInvite: hasUnclaimedInvite,
        shouldPersistUpdate:
          needsRoleUpgrade || needsSchoolFill || needsDisplayNameFill || hasUnclaimedInvite,
        reason: 'development_admin_mode',
      };
    }

    // Official RBAC mode (DEVELOPMENT_ADMIN_MODE = false): preserve explicit roles on existing accounts
    let nextRole: UserRole = VALID_ROLES.has(existingUser.role) ? existingUser.role : 'student';
    let nextStatus: 'active' | 'locked' | 'disabled' = existingStatus;
    let nextSchoolId = normalizeSchoolIdLocal(existingUser.schoolId || DEV_DEFAULT_SCHOOL_ID);
    let reason: AccountProvisioningResolution['reason'] = 'existing_profile';
    let shouldPersistUpdate =
      !existingUser.schoolId ||
      !VALID_ROLES.has(existingUser.role) ||
      (!existingUser.displayName && Boolean(input.displayNameFallback));

    if (isPrimaryAdmin && (nextRole !== 'admin' || existingStatus !== 'active')) {
      nextRole = 'admin';
      nextStatus = 'active';
      reason = 'primary_admin';
      shouldPersistUpdate = true;
    } else if (hasUnclaimedInvite && invite) {
      nextRole = isPrimaryAdmin ? 'admin' : invite.role;
      nextStatus = isPrimaryAdmin ? 'active' : invite.status || 'active';
      nextSchoolId = normalizeSchoolIdLocal(invite.schoolId || existingUser.schoolId || DEV_DEFAULT_SCHOOL_ID);
      reason = 'invite_claim';
      shouldPersistUpdate = true;
    }

    return {
      mode: shouldPersistUpdate ? 'update' : 'keep',
      role: nextRole,
      status: nextStatus,
      schoolId: nextSchoolId,
      preDevRole: existingUser.preDevRole,
      secondaryRoles: hasUnclaimedInvite && invite?.secondaryRoles
        ? invite.secondaryRoles
        : existingUser.secondaryRoles,
      claimInvite: hasUnclaimedInvite,
      shouldPersistUpdate,
      reason,
    };
  }

  // Brand-new account (first sign-in)
  if (isDevAdminMode && (emailVerified || isPrimaryAdmin)) {
    return {
      mode: 'create',
      role: 'admin',
      status: 'active',
      schoolId: normalizeSchoolIdLocal(invite?.schoolId || DEV_DEFAULT_SCHOOL_ID),
      preDevRole: invite?.role && invite.role !== 'admin' ? invite.role : undefined,
      secondaryRoles: invite?.secondaryRoles,
      claimInvite: hasUnclaimedInvite,
      shouldPersistUpdate: true,
      reason: 'development_admin_mode',
    };
  }

  // Official RBAC mode for new accounts: primary admin -> 'admin', invited -> invite.role, uninvited -> 'student'
  if (isPrimaryAdmin) {
    return {
      mode: 'create',
      role: 'admin',
      status: 'active',
      schoolId: normalizeSchoolIdLocal(invite?.schoolId || DEV_DEFAULT_SCHOOL_ID),
      secondaryRoles: invite?.secondaryRoles,
      claimInvite: hasUnclaimedInvite,
      shouldPersistUpdate: true,
      reason: 'primary_admin',
    };
  }

  if (hasUnclaimedInvite && invite) {
    return {
      mode: 'create',
      role: invite.role,
      status: invite.status || 'active',
      schoolId: normalizeSchoolIdLocal(invite.schoolId || DEV_DEFAULT_SCHOOL_ID),
      secondaryRoles: invite.secondaryRoles,
      claimInvite: true,
      shouldPersistUpdate: true,
      reason: 'invite_claim',
    };
  }

  return {
    mode: 'create',
    role: 'student',
    status: 'active',
    schoolId: DEV_DEFAULT_SCHOOL_ID,
    claimInvite: false,
    shouldPersistUpdate: true,
    reason: 'default_student',
  };
}
