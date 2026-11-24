import type {
  LegacyCollectionMigrationStats,
  LegacyMigrationSummary,
  SyncConflictFieldEntry,
  UserProfile,
} from '../types';
import { canViewConfidentialCounseling, getEffectiveRoles, userHasRole } from './rbac';

export const DEFAULT_SCHOOL_ID = 'schoolhub_main';

export const PRIMARY_ADMIN_EMAILS: readonly string[] = [
  'nguyenthithanhtruc10112018@gmail.com',
  'thienbaovoquang@gmail.com',
  'nguyenvandung14102010@gmail.com',
  'nguyenvandung19112010@gmail.com',
  'nguyenvandunga3k30@gmail.com',
];

export const LEGACY_EXTERNAL_DATASETS_KEY = 'schoolhub_external_datasets';
export const LEGACY_LOCAL_DB_PREFIX = 'schoolhub_clean_db_';

export const UI_PREFERENCE_LOCAL_KEYS = [
  'schoolhub_dark_mode',
  'schoolhub_pinned_apps',
] as const;

export const LEGACY_COLLECTION_STORAGE_KEYS: ReadonlyArray<{
  collectionName: string;
  localStorageKey: string;
}> = [
  { collectionName: 'users', localStorageKey: 'schoolhub_clean_db_users' },
  { collectionName: 'studentProfiles', localStorageKey: 'schoolhub_clean_db_students' },
  { collectionName: 'teacherProfiles', localStorageKey: 'schoolhub_clean_db_teachers' },
  { collectionName: 'staffMembers', localStorageKey: 'schoolhub_clean_db_staff_members' },
  { collectionName: 'academicYears', localStorageKey: 'schoolhub_clean_db_academic_years' },
  { collectionName: 'classes', localStorageKey: 'schoolhub_clean_db_classes' },
  { collectionName: 'classPlacements', localStorageKey: 'schoolhub_clean_db_class_placements' },
  { collectionName: 'teachingAssignments', localStorageKey: 'schoolhub_clean_db_teaching_assignments' },
  { collectionName: 'books', localStorageKey: 'schoolhub_clean_db_books' },
  { collectionName: 'bookCopies', localStorageKey: 'schoolhub_clean_db_book_copies' },
  { collectionName: 'borrowTransactions', localStorageKey: 'schoolhub_clean_db_borrow_transactions' },
  { collectionName: 'bookReservations', localStorageKey: 'schoolhub_clean_db_book_reservations' },
  { collectionName: 'libraryRenewalRequests', localStorageKey: 'schoolhub_clean_db_library_renewal_requests' },
  { collectionName: 'libraryTransactionHistory', localStorageKey: 'schoolhub_clean_db_library_transaction_history' },
  { collectionName: 'inventoryAudits', localStorageKey: 'schoolhub_clean_db_inventory_audits' },
  { collectionName: 'surveys', localStorageKey: 'schoolhub_clean_db_surveys' },
  { collectionName: 'surveyResponses', localStorageKey: 'schoolhub_clean_db_survey_responses' },
  { collectionName: 'feedbackReports', localStorageKey: 'schoolhub_clean_db_feedbacks' },
  { collectionName: 'counselingRequests', localStorageKey: 'schoolhub_clean_db_counseling' },
  { collectionName: 'leaveRequests', localStorageKey: 'schoolhub_clean_db_leave_requests' },
  { collectionName: 'supportTickets', localStorageKey: 'schoolhub_clean_db_support_tickets' },
  { collectionName: 'announcements', localStorageKey: 'schoolhub_clean_db_announcements' },
  { collectionName: 'schoolEvents', localStorageKey: 'schoolhub_clean_db_school_events' },
  { collectionName: 'timetable', localStorageKey: 'schoolhub_clean_db_timetable' },
  { collectionName: 'attendanceRecords', localStorageKey: 'schoolhub_clean_db_attendance' },
  { collectionName: 'academicRecords', localStorageKey: 'schoolhub_clean_db_academic' },
  { collectionName: 'assignments', localStorageKey: 'schoolhub_clean_db_assignments' },
  { collectionName: 'assignmentSubmissions', localStorageKey: 'schoolhub_clean_db_assignment_submissions' },
  { collectionName: 'learningMaterials', localStorageKey: 'schoolhub_clean_db_learning_materials' },
  { collectionName: 'facilities', localStorageKey: 'schoolhub_clean_db_facilities' },
  { collectionName: 'rooms', localStorageKey: 'schoolhub_clean_db_rooms' },
  { collectionName: 'maintenanceRequests', localStorageKey: 'schoolhub_clean_db_maintenance' },
  { collectionName: 'auditLogs', localStorageKey: 'schoolhub_clean_db_audit_logs' },
  { collectionName: 'importHistory', localStorageKey: 'schoolhub_clean_db_import_history' },
  { collectionName: 'exportHistory', localStorageKey: 'schoolhub_clean_db_export_history' },
  { collectionName: 'ruleDocuments', localStorageKey: 'schoolhub_clean_db_rule_documents' },
  { collectionName: 'ruleVersions', localStorageKey: 'schoolhub_clean_db_rule_versions' },
  { collectionName: 'ruleCategories', localStorageKey: 'schoolhub_clean_db_rule_categories' },
  { collectionName: 'ruleCriteria', localStorageKey: 'schoolhub_clean_db_rule_criteria' },
  { collectionName: 'emulationTitleConfigs', localStorageKey: 'schoolhub_clean_db_emulation_title_configs' },
  { collectionName: 'emulationRecords', localStorageKey: 'schoolhub_clean_db_emulation_records' },
  { collectionName: 'emulationAppeals', localStorageKey: 'schoolhub_clean_db_emulation_appeals' },
  { collectionName: 'emulationPeriods', localStorageKey: 'schoolhub_clean_db_emulation_periods' },
  { collectionName: 'emulationSnapshots', localStorageKey: 'schoolhub_clean_db_emulation_snapshots' },
  { collectionName: 'competitions', localStorageKey: 'schoolhub_clean_db_competitions' },
  { collectionName: 'competitionCriteria', localStorageKey: 'schoolhub_clean_db_competition_criteria' },
  { collectionName: 'competitionParticipants', localStorageKey: 'schoolhub_clean_db_competition_participants' },
  { collectionName: 'competitionScores', localStorageKey: 'schoolhub_clean_db_competition_scores' },
  { collectionName: 'competitionAwards', localStorageKey: 'schoolhub_clean_db_competition_awards' },
  { collectionName: 'scoreTransferRecords', localStorageKey: 'schoolhub_clean_db_score_transfer_records' },
  { collectionName: 'dataSourceConfigs', localStorageKey: 'schoolhub_clean_db_data_source_configs' },
  { collectionName: 'afternoonSchedules', localStorageKey: 'schoolhub_clean_db_afternoon_schedules' },
  { collectionName: 'externalDatasets', localStorageKey: LEGACY_EXTERNAL_DATASETS_KEY },
];

export type CollectionSubscriptionScope =
  | 'full_school'
  | 'own_doc'
  | 'own_student'
  | 'own_borrower'
  | 'own_requester'
  | 'counselor_only'
  | 'none';

export interface CollectionSubscriptionSpec {
  collectionName: string;
  scope: CollectionSubscriptionScope;
  /** True when reading DEFAULT_SCHOOL_ID where legacy cloud documents may omit `schoolId`. */
  allowLegacyMissingSchoolId: boolean;
}

const METADATA_KEYS = new Set([
  'schoolId',
  'version',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
]);

export function normalizeSchoolId(schoolId?: string | null): string {
  const cleaned = (schoolId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return cleaned || DEFAULT_SCHOOL_ID;
}

/**
 * Produces a deterministic, Firestore-safe document ID for email-indexed `userInvites`.
 * Satisfies `^[a-zA-Z0-9_.-]+$` and keeps <= 128 chars.
 */
export function normalizeInviteDocId(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return 'INV-EMPTY';
  const safe = normalized.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `INV_${safe}`.slice(0, 128);
}

export function isValidFirestoreDocId(id: string): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && /^[a-zA-Z0-9_.-]+$/.test(id);
}

export function isSameSchoolRecord(
  record: { schoolId?: string | null } | null | undefined,
  schoolId: string
): boolean {
  const target = normalizeSchoolId(schoolId);
  const recSchool = record?.schoolId ? normalizeSchoolId(record.schoolId) : null;
  if (!recSchool) {
    // Legacy documents created before multi-school tagging belong to DEFAULT_SCHOOL_ID
    return target === DEFAULT_SCHOOL_ID;
  }
  return recSchool === target;
}

export function withSyncMetadata<T extends Record<string, unknown>>(
  record: T,
  options: {
    schoolId?: string;
    actorUid: string;
    nowIso?: string;
    existing?: Partial<T> | null;
  }
): T & {
  schoolId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
} {
  const now = options.nowIso || new Date().toISOString();
  const schoolId = normalizeSchoolId(
    (options.existing?.schoolId as string | undefined) ||
      (record.schoolId as string | undefined) ||
      options.schoolId
  );
  const prevVersion =
    typeof options.existing?.version === 'number'
      ? options.existing.version
      : typeof record.version === 'number'
        ? record.version
        : 0;
  const createdAt =
    (options.existing?.createdAt as string | undefined) ||
    (record.createdAt as string | undefined) ||
    now;
  const createdBy =
    (options.existing?.createdBy as string | undefined) ||
    (record.createdBy as string | undefined) ||
    options.actorUid;

  return {
    ...record,
    schoolId,
    version: options.existing ? prevVersion + 1 : Math.max(1, prevVersion || 1),
    createdAt,
    updatedAt: now,
    createdBy,
    updatedBy: options.actorUid,
  };
}

function stableDeepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, idx) => stableDeepEqual(item, b[idx]));
  }
  if (typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const aKeys = Object.keys(a as Record<string, unknown>).filter(
      (k) => (a as Record<string, unknown>)[k] !== undefined
    );
    const bKeys = Object.keys(b as Record<string, unknown>).filter(
      (k) => (b as Record<string, unknown>)[k] !== undefined
    );
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k) =>
      stableDeepEqual(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k]
      )
    );
  }
  return false;
}

/**
 * Computes ONLY fields modified relative to `baseRecord`, plus optimistic version & audit stamps.
 */
export function buildPartialUpdatePayload<T extends Record<string, unknown>>(
  baseRecord: T | null | undefined,
  nextRecord: T,
  options: {
    schoolId?: string;
    actorUid: string;
    nowIso?: string;
    expectedVersion?: number;
  }
): Record<string, unknown> {
  const now = options.nowIso || new Date().toISOString();
  const schoolId = normalizeSchoolId(
    (baseRecord?.schoolId as string | undefined) ||
      (nextRecord.schoolId as string | undefined) ||
      options.schoolId
  );

  if (!baseRecord) {
    return withSyncMetadata(nextRecord, {
      schoolId,
      actorUid: options.actorUid,
      nowIso: now,
    });
  }

  const patch: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(baseRecord), ...Object.keys(nextRecord)]);
  for (const key of keys) {
    if (METADATA_KEYS.has(key) || key === 'id') continue;
    const prevVal = baseRecord[key];
    const nextVal = nextRecord[key];
    if (nextVal === undefined) continue;
    if (!stableDeepEqual(prevVal, nextVal)) {
      patch[key] = nextVal;
    }
  }

  const baseVer =
    typeof options.expectedVersion === 'number'
      ? options.expectedVersion
      : typeof baseRecord.version === 'number'
        ? baseRecord.version
        : 1;

  patch.schoolId = schoolId;
  patch.version = baseVer + 1;
  patch.updatedAt = now;
  patch.updatedBy = options.actorUid;
  if (!baseRecord.createdAt) {
    patch.createdAt = (nextRecord.createdAt as string | undefined) || now;
  }
  if (!baseRecord.createdBy) {
    patch.createdBy = (nextRecord.createdBy as string | undefined) || options.actorUid;
  }
  return patch;
}

export interface ConcurrentResolutionResult {
  status: 'ok' | 'auto_merged' | 'conflict';
  mergedRecord: Record<string, unknown>;
  changedFields: string[];
  conflictingFields: SyncConflictFieldEntry[];
}

export function resolveConcurrentUpdate(
  baseRecord: Record<string, unknown> | null | undefined,
  localRecord: Record<string, unknown>,
  serverRecord: Record<string, unknown> | null | undefined
): ConcurrentResolutionResult {
  if (!serverRecord) {
    return {
      status: 'ok',
      mergedRecord: { ...localRecord },
      changedFields: Object.keys(localRecord).filter((k) => !METADATA_KEYS.has(k) && k !== 'id'),
      conflictingFields: [],
    };
  }

  const base = baseRecord || serverRecord;
  const baseVersion = typeof base.version === 'number' ? base.version : 0;
  const serverVersion = typeof serverRecord.version === 'number' ? serverRecord.version : 0;

  const allKeys = new Set([
    ...Object.keys(base),
    ...Object.keys(localRecord),
    ...Object.keys(serverRecord),
  ]);

  const localChangedFields: string[] = [];
  const conflictingFields: SyncConflictFieldEntry[] = [];
  const mergedRecord: Record<string, unknown> = { ...serverRecord };

  for (const key of allKeys) {
    if (METADATA_KEYS.has(key) || key === 'id') continue;
    const baseVal = base[key];
    const localVal = localRecord[key];
    const serverVal = serverRecord[key];

    const localEdited = localVal !== undefined && !stableDeepEqual(localVal, baseVal);
    const serverEdited = !stableDeepEqual(serverVal, baseVal);

    if (!localEdited) {
      continue;
    }

    localChangedFields.push(key);
    if (!serverEdited || stableDeepEqual(localVal, serverVal)) {
      mergedRecord[key] = localVal;
    } else {
      conflictingFields.push({
        field: key,
        baseValue: baseVal,
        localValue: localVal,
        serverValue: serverVal,
      });
      mergedRecord[key] = localVal;
    }
  }

  if (conflictingFields.length > 0) {
    return {
      status: 'conflict',
      mergedRecord,
      changedFields: localChangedFields,
      conflictingFields,
    };
  }

  if (baseVersion > 0 && serverVersion > baseVersion) {
    return {
      status: 'auto_merged',
      mergedRecord,
      changedFields: localChangedFields,
      conflictingFields: [],
    };
  }

  return {
    status: 'ok',
    mergedRecord,
    changedFields: localChangedFields,
    conflictingFields: [],
  };
}

/**
 * Exact per-collection subscription scope aligned with `firestore.rules`
 * and actual Firestore collection names in `src/firebase/services.ts`.
 */
export function getCollectionSubscriptionSpecs(
  user: UserProfile,
  schoolId?: string
): CollectionSubscriptionSpec[] {
  const effectiveRoles = getEffectiveRoles(user);
  const isAdmin = effectiveRoles.includes('admin');
  const isPrincipal = effectiveRoles.includes('principal');
  const isStaffLike = effectiveRoles.some((r) =>
    [
      'admin',
      'principal',
      'homeroom_teacher',
      'subject_teacher',
      'librarian',
      'counselor',
      'staff',
    ].includes(r)
  );
  const isTeacherRole =
    effectiveRoles.includes('homeroom_teacher') ||
    effectiveRoles.includes('subject_teacher');
  const isHomeroomRole = effectiveRoles.includes('homeroom_teacher');
  const isStaffRole = effectiveRoles.includes('staff');
  const isStudentOnly = !isStaffLike && userHasRole(user, 'student');
  const isCounselor = canViewConfidentialCounseling(user);
  const isLibrarianRole = effectiveRoles.includes('librarian');
  const isLibrarianOrAdmin = isAdmin || isLibrarianRole;
  const allowLegacy = normalizeSchoolId(schoolId || user.schoolId) === DEFAULT_SCHOOL_ID;

  const spec = (
    collectionName: string,
    scope: CollectionSubscriptionScope
  ): CollectionSubscriptionSpec => ({
    collectionName,
    scope,
    allowLegacyMissingSchoolId: allowLegacy,
  });

  return [
    spec('users', isStaffLike ? 'full_school' : 'own_doc'),
    spec('userInvites', isAdmin || isPrincipal ? 'full_school' : 'none'),
    spec(
      'studentProfiles',
      isAdmin || isPrincipal || isTeacherRole || isLibrarianRole || isCounselor
        ? 'full_school'
        : isStudentOnly
          ? 'own_doc'
          : 'none'
    ),
    spec('teacherProfiles', 'full_school'),
    spec('staffMembers', isStaffLike ? 'full_school' : 'none'),
    spec('classes', 'full_school'),
    spec('academicYears', 'full_school'),
    spec('classPlacements', isStaffLike ? 'full_school' : isStudentOnly ? 'own_student' : 'none'),
    spec('teachingAssignments', isStaffLike ? 'full_school' : 'none'),
    spec('books', 'full_school'),
    spec('bookCopies', 'full_school'),
    spec(
      'borrowTransactions',
      isLibrarianOrAdmin || isPrincipal ? 'full_school' : isStudentOnly ? 'own_student' : 'none'
    ),
    spec(
      'bookReservations',
      isLibrarianOrAdmin || isPrincipal ? 'full_school' : isStudentOnly ? 'own_student' : 'none'
    ),
    spec(
      'libraryRenewalRequests',
      isLibrarianOrAdmin || isPrincipal ? 'full_school' : isStudentOnly ? 'own_borrower' : 'none'
    ),
    spec('libraryTransactionHistory', isLibrarianOrAdmin || isPrincipal ? 'full_school' : 'none'),
    spec('inventoryAudits', isLibrarianOrAdmin || isPrincipal ? 'full_school' : 'none'),
    spec('surveys', 'full_school'),
    spec(
      'surveyResponses',
      isAdmin || isPrincipal || isCounselor ? 'full_school' : isStudentOnly ? 'own_student' : 'none'
    ),
    spec(
      'feedbackReports',
      isAdmin || isPrincipal || isStaffRole ? 'full_school' : isStudentOnly ? 'own_student' : 'none'
    ),
    spec(
      'counselingRequests',
      isCounselor ? 'counselor_only' : isStudentOnly ? 'own_student' : 'none'
    ),
    spec(
      'leaveRequests',
      isAdmin || isPrincipal || isHomeroomRole ? 'full_school' : isStudentOnly ? 'own_student' : 'none'
    ),
    spec('announcements', 'full_school'),
    spec('schoolEvents', 'full_school'),
    spec('timetable', 'full_school'),
    spec(
      'attendanceRecords',
      isAdmin || isPrincipal || isTeacherRole ? 'full_school' : isStudentOnly ? 'own_student' : 'none'
    ),
    spec(
      'academicRecords',
      isAdmin || isPrincipal || isTeacherRole ? 'full_school' : isStudentOnly ? 'own_student' : 'none'
    ),
    spec('assignments', 'full_school'),
    spec(
      'assignmentSubmissions',
      isAdmin || isPrincipal || isTeacherRole ? 'full_school' : isStudentOnly ? 'own_student' : 'none'
    ),
    spec('learningMaterials', 'full_school'),
    spec('facilities', 'full_school'),
    spec('rooms', 'full_school'),
    spec('maintenanceRequests', isStaffLike ? 'full_school' : 'none'),
    spec(
      'supportTickets',
      isAdmin || isPrincipal || isStaffRole ? 'full_school' : 'own_requester'
    ),
    spec('auditLogs', isAdmin || isPrincipal ? 'full_school' : 'none'),
    spec(
      'importHistory',
      isAdmin || isPrincipal || isLibrarianRole || isTeacherRole || isStaffRole
        ? 'full_school'
        : 'none'
    ),
    spec(
      'exportHistory',
      isAdmin || isPrincipal || isLibrarianRole || isTeacherRole || isStaffRole
        ? 'full_school'
        : 'none'
    ),
    spec('ruleDocuments', 'full_school'),
    spec('ruleVersions', 'full_school'),
    spec('ruleCategories', 'full_school'),
    spec('ruleCriteria', 'full_school'),
    spec('emulationTitleConfigs', 'full_school'),
    spec('emulationRecords', isStaffLike ? 'full_school' : isStudentOnly ? 'own_student' : 'none'),
    spec(
      'emulationAppeals',
      isAdmin || isPrincipal || isTeacherRole ? 'full_school' : isStudentOnly ? 'own_student' : 'none'
    ),
    spec('emulationPeriods', 'full_school'),
    spec('emulationSnapshots', 'full_school'),
    spec('competitions', 'full_school'),
    spec('competitionCriteria', 'full_school'),
    spec('competitionParticipants', 'full_school'),
    spec('competitionScores', 'full_school'),
    spec('competitionAwards', 'full_school'),
    spec('scoreTransferRecords', isAdmin || isPrincipal || isTeacherRole ? 'full_school' : 'none'),
    spec('dataSourceConfigs', isStaffLike ? 'full_school' : 'none'),
    spec('afternoonSchedules', 'full_school'),
    spec('externalDatasets', isStaffLike ? 'full_school' : 'none'),
  ];
}

export function buildLegacyMigrationSummary(
  readRawStorage: (key: string) => string | null,
  existingByCollection: Record<string, Array<{ id?: string; [k: string]: unknown }>> = {}
): LegacyMigrationSummary {
  const collections: LegacyCollectionMigrationStats[] = [];
  const legacyKeysFound: string[] = [];
  let totalLocalRecords = 0;
  let totalNewRecords = 0;
  let totalDuplicateRecords = 0;

  for (const entry of LEGACY_COLLECTION_STORAGE_KEYS) {
    const raw = readRawStorage(entry.localStorageKey);
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!Array.isArray(parsed)) continue;
    legacyKeysFound.push(entry.localStorageKey);
    if (parsed.length === 0) continue;

    const remoteItems = existingByCollection[entry.collectionName] || [];
    const remoteIds = new Set(remoteItems.map((item) => String(item.id || '')).filter(Boolean));
    const itemsToUpload: Record<string, unknown>[] = [];
    let duplicateCount = 0;

    for (let idx = 0; idx < parsed.length; idx++) {
      const item = parsed[idx];
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const obj = { ...(item as Record<string, unknown>) };
      const id = String(
        obj.id ||
          (entry.collectionName === 'externalDatasets'
            ? `EXT-${String(obj.code || idx).replace(/[^a-zA-Z0-9_.-]/g, '_')}`
            : '')
      ).trim();
      if (!id) continue;
      obj.id = id;
      if (remoteIds.has(id)) {
        duplicateCount += 1;
      } else {
        remoteIds.add(id);
        itemsToUpload.push(obj);
      }
    }

    totalLocalRecords += itemsToUpload.length + duplicateCount;
    totalNewRecords += itemsToUpload.length;
    totalDuplicateRecords += duplicateCount;
    collections.push({
      collectionName: entry.collectionName,
      localStorageKey: entry.localStorageKey,
      localCount: itemsToUpload.length + duplicateCount,
      newCount: itemsToUpload.length,
      duplicateCount,
      itemsToUpload,
    });
  }

  return {
    totalLocalRecords,
    totalNewRecords,
    totalDuplicateRecords,
    legacyKeysFound,
    collections,
  };
}

export function dedupById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || !item.id) continue;
    seen.set(item.id, item);
  }
  return Array.from(seen.values());
}

export function mergeRecordsById<T extends { id: string }>(
  prev: T[],
  incoming: T[],
  prepend = true
): T[] {
  const result = dedupById(prev);
  const indexById = new Map<string, number>();
  result.forEach((item, idx) => indexById.set(item.id, idx));

  const incomingUnique = dedupById(incoming);
  for (let i = incomingUnique.length - 1; i >= 0; i--) {
    // When prepending, iterate reverse if prepending sequentially so incoming order is preserved
    if (!prepend) break;
    const item = incomingUnique[i];
    const existingIdx = indexById.get(item.id);
    if (existingIdx !== undefined) {
      result[existingIdx] = item;
    } else {
      result.unshift(item);
      indexById.clear();
      result.forEach((r, idx) => indexById.set(r.id, idx));
    }
  }

  if (!prepend) {
    for (const item of incomingUnique) {
      const existingIdx = indexById.get(item.id);
      if (existingIdx !== undefined) {
        result[existingIdx] = item;
      } else {
        indexById.set(item.id, result.length);
        result.push(item);
      }
    }
  }

  return result;
}

