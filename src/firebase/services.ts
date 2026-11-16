import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  runTransaction,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
  type DocumentData,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, auth } from './config';
import { handleFirestoreError, OperationType } from './errorHandler';
import {
  AcademicRecord,
  AcademicYearConfig,
  Announcement,
  Assignment,
  AssignmentSubmission,
  AttendanceRecord,
  AuditLogEntry,
  Book,
  BookCopy,
  BookReservation,
  BorrowTransaction,
  ClassPlacement,
  Competition,
  CompetitionAward,
  CompetitionCriterion,
  CompetitionParticipant,
  CompetitionScore,
  CounselingRequest,
  EmulationAppeal,
  EmulationPeriod,
  EmulationRecord,
  EmulationSnapshot,
  EmulationTitleConfig,
  ExportHistoryRecord,
  ExternalDatasetRecord,
  FacilityAsset,
  FeedbackReport,
  GoogleDataChangeLog,
  GoogleDocProposal,
  GooglePendingDeletion,
  GoogleReportTemplate,
  GoogleSyncConflict,
  GoogleSyncHistoryItem,
  GoogleSyncSource,
  ImportHistoryRecord,
  InventoryAudit,
  LearningMaterial,
  LegacyMigrationSummary,
  LibraryRenewalRequest,
  LibraryTransactionHistoryEntry,
  MaintenanceRequest,
  RuleCategory,
  RuleCriterion,
  RuleDocument,
  RuleVersion,
  SchoolClass,
  SchoolEvent,
  SchoolRoom,
  ScoreTransferRecord,
  StaffMember,
  Student,
  StudentLeaveRequest,
  SupportTicket,
  Survey,
  SurveyResponse,
  SyncConflictPrompt,
  SystemSettings,
  Teacher,
  TeachingAssignment,
  TimetableEntry,
  UserInvite,
  UserProfile,
  UserRole,
} from '../types';
import * as XLSX from 'xlsx';
import {
  DEFAULT_SCHOOL_ID,
  LEGACY_COLLECTION_STORAGE_KEYS,
  LEGACY_EXTERNAL_DATASETS_KEY,
  PRIMARY_ADMIN_EMAILS,
  buildLegacyMigrationSummary,
  buildPartialUpdatePayload,
  getCollectionSubscriptionSpecs,
  isSameSchoolRecord,
  normalizeInviteDocId,
  normalizeSchoolId,
  resolveConcurrentUpdate,
  withSyncMetadata,
} from '../utils/syncEngine';
import {
  parseDevelopmentAdminMode,
  resolveEffectiveAccountProvisioning,
} from '../utils/devAdminMode';
import {
  type AuthPhase,
  normalizeUserProfileSafe,
  withTimeout,
} from '../utils/authSession';

/* ================== ERRORS & GUARDS ================== */
export class AuthRequiredError extends Error {
  constructor(message = 'Bạn cần đăng nhập tài khoản Google để thao tác với dữ liệu SchoolHub.') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

export class OfflineSyncError extends Error {
  constructor(
    message = 'Đang mất kết nối mạng. Không thể lưu thay đổi lên máy chủ khi ngoại tuyến.'
  ) {
    super(message);
    this.name = 'OfflineSyncError';
  }
}

export class SyncConflictError extends Error {
  conflict: SyncConflictPrompt;
  constructor(conflict: SyncConflictPrompt) {
    super(
      `Xung đột đồng bộ trên "${conflict.recordLabel}" (máy chủ v${conflict.serverVersion}, phiên bản đang sửa v${conflict.expectedVersion}).`
    );
    this.name = 'SyncConflictError';
    this.conflict = conflict;
  }
}

let activeSchoolId = DEFAULT_SCHOOL_ID;

export function setActiveSchoolContext(schoolId?: string | null): void {
  activeSchoolId = normalizeSchoolId(schoolId);
}

export function getActiveSchoolContext(): string {
  return activeSchoolId;
}

function getActorUid(): string {
  return auth.currentUser?.uid || 'system';
}

function requireAuthenticatedOnline(): FirebaseUser {
  const user = auth.currentUser;
  if (!user) {
    throw new AuthRequiredError();
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new OfflineSyncError();
  }
  return user;
}

export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((v) => v !== undefined)
      .map((v) => stripUndefined(v)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
      }
    }
    return out as T;
  }
  return value;
}

/* ================== LEGACY CLEANUP / MIGRATION ONLY ================== */
export function purgeLegacyMockData(): void {
  try {
    const legacyKeys = [
      'schoolhub_db_students',
      'schoolhub_db_teachers',
      'schoolhub_db_classes',
      'schoolhub_db_books',
      'schoolhub_db_borrow_transactions',
      'schoolhub_db_surveys',
      'schoolhub_db_survey_responses',
      'schoolhub_db_feedbacks',
      'schoolhub_db_counseling',
      'schoolhub_db_announcements',
      'schoolhub_db_attendance',
      'schoolhub_db_academic',
      'schoolhub_db_facilities',
      'schoolhub_db_maintenance',
      'schoolhub_db_timetable',
    ];
    legacyKeys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore in non-browser environments
  }
}

if (typeof window !== 'undefined') {
  purgeLegacyMockData();
}

export function scanLegacyLocalStorage(
  existingByCollection: Record<string, Array<{ id?: string; [k: string]: unknown }>> = {}
): LegacyMigrationSummary {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return {
      totalLocalRecords: 0,
      totalNewRecords: 0,
      totalDuplicateRecords: 0,
      legacyKeysFound: [],
      collections: [],
    };
  }
  return buildLegacyMigrationSummary((k) => localStorage.getItem(k), existingByCollection);
}

export function purgeAllLegacyLocalStorageKeys(): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    for (const entry of LEGACY_COLLECTION_STORAGE_KEYS) {
      localStorage.removeItem(entry.localStorageKey);
    }
    localStorage.removeItem(LEGACY_EXTERNAL_DATASETS_KEY);
    localStorage.removeItem('schoolhub_clean_db_system_settings');
    purgeLegacyMockData();
  } catch {
    // Ignore
  }
}

export async function migrateLegacyLocalStorageToCloud(
  summary: LegacyMigrationSummary
): Promise<{ uploadedCount: number }> {
  requireAuthenticatedOnline();
  let uploadedCount = 0;
  for (const col of summary.collections) {
    if (col.itemsToUpload.length === 0) continue;
    const typed = col.itemsToUpload.map((item) => ({
      ...item,
      id: String(item.id),
    }));
    await upsertBatchWithSync(col.collectionName, col.collectionName, typed);
    uploadedCount += typed.length;
  }
  purgeAllLegacyLocalStorageKeys();
  return { uploadedCount };
}

/* ================== CORE CLOUD CRUD & OPTIMISTIC CONCURRENCY ================== */
const COLLECTION_LABELS: Record<string, string> = {
  users: 'Tài khoản hệ thống',
  userInvites: 'Lời mời tài khoản',
  studentProfiles: 'Hồ sơ học sinh',
  teacherProfiles: 'Hồ sơ giáo viên',
  staffMembers: 'Nhân viên nhà trường',
  classes: 'Lớp học',
  books: 'Danh mục sách',
  bookCopies: 'Bản sao sách',
  borrowTransactions: 'Phiếu mượn trả sách',
  surveys: 'Khảo sát',
  feedbackReports: 'Phản ánh & Kiến nghị',
  counselingRequests: 'Tư vấn tâm lý',
  leaveRequests: 'Đơn xin phép',
  announcements: 'Thông báo',
  schoolEvents: 'Sự kiện trường',
  timetable: 'Thời khóa biểu',
  attendanceRecords: 'Điểm danh',
  academicRecords: 'Bảng điểm học tập',
  assignments: 'Bài tập',
  learningMaterials: 'Học liệu',
  facilities: 'Thiết bị CSVC',
  rooms: 'Phòng học',
  maintenanceRequests: 'Bảo trì CSVC',
  supportTickets: 'Hỗ trợ kỹ thuật',
  ruleCriteria: 'Tiêu chí nội quy',
  emulationRecords: 'Ghi nhận thi đua',
  competitions: 'Cuộc thi',
  externalDatasets: 'Dữ liệu tham chiếu',
};

async function fetchCollectionRemote<T extends { id: string }>(
  firestoreCollection: string
): Promise<T[]> {
  requireAuthenticatedOnline();
  try {
    const school = getActiveSchoolContext();
    const colRef = collection(db, firestoreCollection);
    const snap =
      school === DEFAULT_SCHOOL_ID
        ? await getDocs(colRef)
        : await getDocs(query(colRef, where('schoolId', '==', school)));
    return snap.docs
      .map((d) => ({ ...d.data(), id: d.id } as T))
      .filter((item) => isSameSchoolRecord(item as unknown as { schoolId?: string }, school));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, firestoreCollection);
  }
}

export interface UpsertCloudOptions<T> {
  baseRecord?: T | null;
  forceOverwrite?: boolean;
  recordLabel?: string;
}

async function upsertDocWithSync<T extends { id: string }>(
  firestoreCollection: string,
  _ignoredKey: string,
  item: T,
  _prepend: boolean = true,
  options?: UpsertCloudOptions<T>
): Promise<void> {
  requireAuthenticatedOnline();
  const actorUid = getActorUid();
  const schoolId = getActiveSchoolContext();
  const ref = doc(db, firestoreCollection, item.id);
  const sanitized = stripUndefined(item) as Record<string, unknown>;

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const serverData = snap.exists()
        ? ({ ...snap.data(), id: snap.id } as Record<string, unknown>)
        : null;

      if (!serverData) {
        const created = stripUndefined(
          withSyncMetadata(sanitized, { schoolId, actorUid })
        );
        tx.set(ref, created);
        return;
      }

      if (options?.forceOverwrite) {
        const nextPayload = stripUndefined(
          withSyncMetadata(sanitized, {
            schoolId,
            actorUid,
            existing: serverData,
          })
        );
        tx.set(ref, nextPayload);
        return;
      }

      const base =
        (options?.baseRecord as Record<string, unknown> | undefined) ||
        (typeof sanitized.version === 'number' ? undefined : serverData);

      if (base) {
        const res = resolveConcurrentUpdate(base, sanitized, serverData);
        if (res.status === 'conflict') {
          const baseVer =
            typeof base.version === 'number'
              ? base.version
              : typeof serverData.version === 'number'
                ? serverData.version
                : 1;
          const serverVer = typeof serverData.version === 'number' ? serverData.version : 1;
          throw new SyncConflictError({
            id: `CONFLICT-${firestoreCollection}-${item.id}-${Date.now()}`,
            collectionName: firestoreCollection,
            collectionLabel: COLLECTION_LABELS[firestoreCollection] || firestoreCollection,
            docId: item.id,
            recordLabel:
              options?.recordLabel ||
              String(sanitized.fullName || sanitized.title || sanitized.name || item.id),
            expectedVersion: baseVer,
            serverVersion: serverVer,
            localRecord: sanitized,
            serverRecord: serverData,
            conflictingFields: res.conflictingFields,
            mergedPreview: res.mergedRecord,
            detectedAt: new Date().toISOString(),
          });
        }
        const patch = stripUndefined(
          buildPartialUpdatePayload(serverData, res.mergedRecord, {
            schoolId,
            actorUid,
            expectedVersion:
              typeof serverData.version === 'number' ? serverData.version : 1,
          })
        );
        tx.update(ref, patch as DocumentData);
        return;
      }

      // If no baseRecord was supplied (e.g., item came with an older explicit `version`), enforce version equality
      const expectedVer = typeof sanitized.version === 'number' ? sanitized.version : undefined;
      const serverVer = typeof serverData.version === 'number' ? serverData.version : 1;
      if (expectedVer !== undefined && serverVer > expectedVer) {
        const res = resolveConcurrentUpdate(serverData, sanitized, serverData);
        throw new SyncConflictError({
          id: `CONFLICT-${firestoreCollection}-${item.id}-${Date.now()}`,
          collectionName: firestoreCollection,
          collectionLabel: COLLECTION_LABELS[firestoreCollection] || firestoreCollection,
          docId: item.id,
          recordLabel:
            options?.recordLabel ||
            String(sanitized.fullName || sanitized.title || sanitized.name || item.id),
          expectedVersion: expectedVer,
          serverVersion: serverVer,
          localRecord: sanitized,
          serverRecord: serverData,
          conflictingFields: res.conflictingFields.length
            ? res.conflictingFields
            : [
                {
                  field: 'version',
                  baseValue: expectedVer,
                  localValue: sanitized,
                  serverValue: serverData,
                },
              ],
          mergedPreview: sanitized,
          detectedAt: new Date().toISOString(),
        });
      }

      const patch = stripUndefined(
        buildPartialUpdatePayload(serverData, sanitized, {
          schoolId,
          actorUid,
          expectedVersion: serverVer,
        })
      );
      tx.update(ref, patch as DocumentData);
    });
  } catch (e) {
    if (e instanceof SyncConflictError || e instanceof AuthRequiredError || e instanceof OfflineSyncError) {
      throw e;
    }
    handleFirestoreError(e, OperationType.WRITE, `${firestoreCollection}/${item.id}`);
  }
}

export async function applyConflictResolution(
  collectionName: string,
  docId: string,
  mergedRecord: Record<string, unknown>
): Promise<void> {
  await upsertDocWithSync(
    collectionName,
    collectionName,
    { ...mergedRecord, id: docId },
    true,
    { forceOverwrite: true }
  );
}

async function deleteDocWithSync<T extends { id: string }>(
  firestoreCollection: string,
  _ignoredKey: string,
  id: string
): Promise<void> {
  requireAuthenticatedOnline();
  try {
    await deleteDoc(doc(db, firestoreCollection, id));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `${firestoreCollection}/${id}`);
  }
}

export async function upsertBatchWithSync<T extends { id: string }>(
  firestoreCollection: string,
  _ignoredKey: string,
  items: T[],
  _prepend: boolean = true
): Promise<void> {
  if (items.length === 0) return;
  requireAuthenticatedOnline();
  const actorUid = getActorUid();
  const schoolId = getActiveSchoolContext();
  const now = new Date().toISOString();

  const sanitizedItems = items.map((it) =>
    stripUndefined(
      withSyncMetadata(it as unknown as Record<string, unknown>, {
        schoolId,
        actorUid,
        nowIso: now,
      })
    )
  );

  const CHUNK_SIZE = 400;
  try {
    for (let i = 0; i < sanitizedItems.length; i += CHUNK_SIZE) {
      const chunk = sanitizedItems.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const item of chunk) {
        batch.set(doc(db, firestoreCollection, String(item.id)), item, { merge: true });
      }
      await batch.commit();
    }
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `${firestoreCollection}/batch`);
  }
}

/* ================== AUTH PROVISIONING, INVITES & USER ACCOUNTS ================== */
export async function fetchEffectiveDevelopmentAdminMode(): Promise<boolean> {
  let serverMode = true;
  if (typeof fetch === 'function') {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 3500) : null;
    try {
      const resp = await fetch('/api/system/auth-mode', {
        cache: 'no-store',
        ...(controller ? { signal: controller.signal } : {}),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { developmentAdminMode?: unknown };
        serverMode = parseDevelopmentAdminMode(
          data.developmentAdminMode as string | boolean | undefined
        );
      }
    } catch {
      // Fallback to default true in dev if backend endpoint times out or is unreachable
    } finally {
      if (timer !== null) clearTimeout(timer);
    }
  }

  let firestoreMode = true;
  try {
    const cfgSnap = await withTimeout(
      getDoc(doc(db, 'appConfig', 'runtime')),
      5000,
      'Quá thời gian kiểm tra appConfig/runtime.'
    );
    if (cfgSnap.exists()) {
      const data = cfgSnap.data() as { DEVELOPMENT_ADMIN_MODE?: unknown };
      firestoreMode = parseDevelopmentAdminMode(
        data.DEVELOPMENT_ADMIN_MODE as string | boolean | undefined
      );
    }
  } catch {
    // appConfig/runtime is optional; ignore if absent, timed out, or unreachable
  }

  return serverMode && firestoreMode;
}

export async function resolveOrProvisionAuthenticatedUser(
  fireUser: FirebaseUser,
  options?: {
    onPhase?: (phase: AuthPhase) => void;
  }
): Promise<UserProfile> {
  requireAuthenticatedOnline();
  const uid = fireUser.uid;
  const email = (fireUser.email || '').trim();
  const emailLower = email.toLowerCase();
  const now = new Date().toISOString();
  const userRef = doc(db, 'users', uid);

  try {
    options?.onPhase?.('loading_profile');

    const [existingSnap, isDevAdminMode] = await Promise.all([
      withTimeout(
        getDoc(userRef),
        12000,
        'Quá thời gian tải hồ sơ người dùng từ Cloud Firestore. Vui lòng thử lại.'
      ),
      fetchEffectiveDevelopmentAdminMode(),
    ]);

    const inviteId = normalizeInviteDocId(email);
    const inviteRef = emailLower ? doc(db, 'userInvites', inviteId) : null;
    let inviteData: UserInvite | null = null;
    if (inviteRef) {
      try {
        const invSnap = await withTimeout(
          getDoc(inviteRef),
          5000,
          'Quá thời gian kiểm tra lời mời tài khoản.'
        );
        if (invSnap.exists()) {
          inviteData = { ...invSnap.data(), id: invSnap.id } as UserInvite;
        }
      } catch {
        // Non-fatal if invite cannot be read or timed out
      }
    }

    options?.onPhase?.('loading_permissions');

    const isPrimaryAdmin = PRIMARY_ADMIN_EMAILS.includes(emailLower);
    const rawDisplayNameFallback =
      inviteData?.displayName ||
      fireUser.displayName ||
      email.split('@')[0] ||
      'Người dùng SchoolHub';
    const displayNameFallback =
      rawDisplayNameFallback.trim().slice(0, 100) || 'Người dùng SchoolHub';

    if (existingSnap.exists()) {
      const rawExisting = existingSnap.data() as Record<string, unknown>;
      const current = normalizeUserProfileSafe(
        { ...(rawExisting as Partial<UserProfile>), id: existingSnap.id },
        {
          email,
          displayName: displayNameFallback,
          photoURL: fireUser.photoURL,
        }
      );

      const resolution = resolveEffectiveAccountProvisioning({
        isDevAdminMode,
        isPrimaryAdmin,
        emailVerified: fireUser.emailVerified,
        displayNameFallback,
        invite: inviteData,
        existingUser: current,
      });

      const updates: Partial<UserProfile> = {};
      if (!rawExisting.schoolId || rawExisting.schoolId !== resolution.schoolId) {
        updates.schoolId = resolution.schoolId;
      }
      if (
        typeof rawExisting.version !== 'number' ||
        !Number.isInteger(rawExisting.version) ||
        rawExisting.version < 1 ||
        rawExisting.version > 1000000
      ) {
        updates.version = 1;
      }
      if (!rawExisting.email && email) {
        updates.email = email;
      }
      if (fireUser.photoURL && rawExisting.avatarUrl !== fireUser.photoURL) {
        updates.avatarUrl = fireUser.photoURL;
      }
      const rawName = typeof rawExisting.displayName === 'string' ? rawExisting.displayName.trim() : '';
      if (!rawName || rawName.length > 100 || rawName !== rawExisting.displayName) {
        updates.displayName = (rawName || displayNameFallback).slice(0, 100) || 'Người dùng SchoolHub';
      }
      if (rawExisting.role !== resolution.role) {
        updates.role = resolution.role;
      }
      if ((rawExisting.status || 'active') !== resolution.status) {
        updates.status = resolution.status;
      }
      if (resolution.preDevRole && rawExisting.preDevRole !== resolution.preDevRole) {
        updates.preDevRole = resolution.preDevRole;
      }
      if (resolution.claimInvite && inviteData) {
        if (inviteData.secondaryRoles) updates.secondaryRoles = inviteData.secondaryRoles;
        if (inviteData.linkedProfileId) updates.linkedProfileId = inviteData.linkedProfileId;
        if (inviteData.assignedClasses) updates.assignedClasses = inviteData.assignedClasses;
        if (inviteData.assignedSubjects) updates.assignedSubjects = inviteData.assignedSubjects;
        if (inviteData.permissionsOverride) updates.permissionsOverride = inviteData.permissionsOverride;
        if (inviteData.studentCode) updates.studentCode = inviteData.studentCode;
        if (inviteData.teacherCode) updates.teacherCode = inviteData.teacherCode;
        if (inviteData.classId) updates.classId = inviteData.classId;
        if (inviteData.className) updates.className = inviteData.className;
        if (inviteData.grade !== undefined) updates.grade = inviteData.grade;
        if (inviteData.phone) updates.phone = inviteData.phone;
        if (inviteData.rfidCardId) updates.rfidCardId = inviteData.rfidCardId;
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = now;
        updates.updatedBy = uid;
        await withTimeout(
          updateDoc(userRef, stripUndefined(updates) as DocumentData),
          12000,
          'Quá thời gian cập nhật hồ sơ và quyền truy cập trên Cloud Firestore.'
        );
      }

      if (inviteRef && resolution.claimInvite) {
        try {
          await withTimeout(
            updateDoc(inviteRef, {
              claimedByUid: uid,
              claimedAt: now,
              updatedAt: now,
              updatedBy: uid,
            }),
            5000,
            'Quá thời gian cập nhật trạng thái lời mời.'
          );
        } catch {
          // Non-fatal: profile has already been resolved and updated cleanly
        }
      }

      options?.onPhase?.('loading_app');
      const merged = normalizeUserProfileSafe(
        { ...current, ...updates, id: uid },
        {
          email,
          displayName: displayNameFallback,
          photoURL: fireUser.photoURL,
          fallbackRole: resolution.role,
        }
      );
      setActiveSchoolContext(merged.schoolId || DEFAULT_SCHOOL_ID);
      return merged;
    }

    // Create new user profile (Admin when DEVELOPMENT_ADMIN_MODE=true; Invite/PrimaryAdmin/Student when false)
    const resolution = resolveEffectiveAccountProvisioning({
      isDevAdminMode,
      isPrimaryAdmin,
      emailVerified: fireUser.emailVerified,
      displayNameFallback,
      invite: inviteData,
      existingUser: null,
    });

    const newProfile: UserProfile = stripUndefined({
      id: uid,
      email,
      displayName: displayNameFallback,
      role: resolution.role,
      preDevRole: resolution.preDevRole,
      secondaryRoles: resolution.secondaryRoles,
      status: resolution.status,
      schoolId: resolution.schoolId,
      version: 1,
      linkedProfileId: inviteData?.linkedProfileId,
      assignedClasses: inviteData?.assignedClasses,
      assignedSubjects: inviteData?.assignedSubjects,
      permissionsOverride: inviteData?.permissionsOverride,
      avatarUrl: fireUser.photoURL || undefined,
      rfidCardId: inviteData?.rfidCardId,
      studentCode: inviteData?.studentCode,
      teacherCode: inviteData?.teacherCode,
      classId: inviteData?.classId,
      className: inviteData?.className,
      grade: inviteData?.grade,
      phone: inviteData?.phone,
      createdAt: now,
      updatedAt: now,
      createdBy: uid,
      updatedBy: uid,
    });

    await withTimeout(
      setDoc(userRef, newProfile),
      12000,
      'Quá thời gian khởi tạo hồ sơ tài khoản mới trên Cloud Firestore.'
    );
    if (inviteRef && resolution.claimInvite) {
      try {
        await withTimeout(
          updateDoc(inviteRef, {
            claimedByUid: uid,
            claimedAt: now,
            updatedAt: now,
            updatedBy: uid,
          }),
          5000,
          'Quá thời gian cập nhật trạng thái lời mời.'
        );
      } catch {
        // Non-fatal if invite claim update is blocked by prior claim metadata
      }
    }
    options?.onPhase?.('loading_app');
    setActiveSchoolContext(resolution.schoolId);
    return normalizeUserProfileSafe(newProfile, {
      email,
      displayName: displayNameFallback,
      photoURL: fireUser.photoURL,
      fallbackRole: resolution.role,
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AuthTimeoutError') {
      throw e;
    }
    handleFirestoreError(e, OperationType.WRITE, `users/${uid}`);
  }
}

export async function getUserProfileById(uid: string): Promise<UserProfile | null> {
  requireAuthenticatedOnline();
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? ({ ...snap.data(), id: snap.id } as UserProfile) : null;
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, `users/${uid}`);
  }
}

export async function getUserAccounts(): Promise<UserProfile[]> {
  return fetchCollectionRemote<UserProfile>('users');
}

export async function saveUserAccount(
  user: UserProfile,
  options?: UpsertCloudOptions<UserProfile>
): Promise<void> {
  const now = new Date().toISOString();
  const normalized: UserProfile = {
    ...user,
    status: user.status || 'active',
    schoolId: normalizeSchoolId(user.schoolId || getActiveSchoolContext()),
    createdAt: user.createdAt || now,
    updatedAt: now,
  };
  await upsertDocWithSync('users', 'users', normalized, true, options);

  // Also keep an email-indexed UserInvite updated when saving by email if not already claimed by a Firebase UID
  if (normalized.email && !normalized.id.match(/^[a-zA-Z0-9]{20,36}$/)) {
    await saveUserInviteFromProfile(normalized);
  }
}

export async function saveUserInviteFromProfile(user: UserProfile): Promise<UserInvite> {
  requireAuthenticatedOnline();
  const email = user.email.trim();
  const emailLower = email.toLowerCase();
  const inviteId = normalizeInviteDocId(email);
  const now = new Date().toISOString();
  const actorUid = getActorUid();
  const schoolId = normalizeSchoolId(user.schoolId || getActiveSchoolContext());

  const invite: UserInvite = stripUndefined({
    id: inviteId,
    email,
    emailLower,
    displayName: user.displayName,
    role: user.role,
    secondaryRoles: user.secondaryRoles,
    status: user.status || 'active',
    schoolId,
    linkedProfileId: user.linkedProfileId,
    assignedClasses: user.assignedClasses,
    assignedSubjects: user.assignedSubjects,
    permissionsOverride: user.permissionsOverride,
    rfidCardId: user.rfidCardId,
    studentCode: user.studentCode,
    teacherCode: user.teacherCode,
    classId: user.classId,
    className: user.className,
    grade: user.grade,
    phone: user.phone,
    createdBy: user.createdBy || actorUid,
    createdAt: user.createdAt || now,
    updatedBy: actorUid,
    updatedAt: now,
  });

  await upsertDocWithSync('userInvites', 'userInvites', invite, true, { forceOverwrite: true });
  return invite;
}

export async function deleteUserInvite(inviteId: string): Promise<void> {
  await deleteDocWithSync<UserInvite>('userInvites', 'userInvites', inviteId);
}

export async function deleteUserAccount(userId: string): Promise<void> {
  await deleteDocWithSync<UserProfile>('users', 'users', userId);
}

/* ================== STUDENTS SERVICE ================== */
export async function getStudents(): Promise<Student[]> {
  return fetchCollectionRemote<Student>('studentProfiles');
}

export async function saveStudent(
  student: Student,
  options?: UpsertCloudOptions<Student>
): Promise<void> {
  await upsertDocWithSync('studentProfiles', 'students', student, true, options);
}

export async function deleteStudent(studentId: string): Promise<void> {
  await deleteDocWithSync<Student>('studentProfiles', 'students', studentId);
}

/* ================== TEACHERS & STAFF SERVICE ================== */
export async function getTeachers(): Promise<Teacher[]> {
  return fetchCollectionRemote<Teacher>('teacherProfiles');
}

export async function saveTeacher(
  teacher: Teacher,
  options?: UpsertCloudOptions<Teacher>
): Promise<void> {
  await upsertDocWithSync('teacherProfiles', 'teachers', teacher, false, options);
}

export async function deleteTeacher(teacherId: string): Promise<void> {
  await deleteDocWithSync<Teacher>('teacherProfiles', 'teachers', teacherId);
}

export async function getStaffMembers(): Promise<StaffMember[]> {
  return fetchCollectionRemote<StaffMember>('staffMembers');
}

export async function saveStaffMember(
  member: StaffMember,
  options?: UpsertCloudOptions<StaffMember>
): Promise<void> {
  await upsertDocWithSync('staffMembers', 'staff_members', member, true, options);
}

export async function deleteStaffMember(memberId: string): Promise<void> {
  await deleteDocWithSync<StaffMember>('staffMembers', 'staff_members', memberId);
}

export async function getAcademicYears(): Promise<AcademicYearConfig[]> {
  return fetchCollectionRemote<AcademicYearConfig>('academicYears');
}

export async function saveAcademicYear(year: AcademicYearConfig): Promise<void> {
  await upsertDocWithSync('academicYears', 'academic_years', year, true);
}

/* ================== CLASSES, PLACEMENTS & TEACHING ASSIGNMENTS SERVICE ================== */
export async function getClasses(): Promise<SchoolClass[]> {
  return fetchCollectionRemote<SchoolClass>('classes');
}

export async function saveClass(
  schoolClass: SchoolClass,
  options?: UpsertCloudOptions<SchoolClass>
): Promise<void> {
  await upsertDocWithSync('classes', 'classes', schoolClass, false, options);
}

export async function deleteClass(classId: string): Promise<void> {
  await deleteDocWithSync<SchoolClass>('classes', 'classes', classId);
}

export async function getClassPlacements(): Promise<ClassPlacement[]> {
  return fetchCollectionRemote<ClassPlacement>('classPlacements');
}

export async function saveClassPlacement(placement: ClassPlacement): Promise<void> {
  await upsertDocWithSync('classPlacements', 'class_placements', placement, true);
}

export async function getTeachingAssignments(): Promise<TeachingAssignment[]> {
  return fetchCollectionRemote<TeachingAssignment>('teachingAssignments');
}

export async function saveTeachingAssignment(assignment: TeachingAssignment): Promise<void> {
  await upsertDocWithSync('teachingAssignments', 'teaching_assignments', assignment, true);
}

/* ================== TIMETABLE, ASSIGNMENTS, SUBMISSIONS & MATERIALS ================== */
export async function getTimetable(): Promise<TimetableEntry[]> {
  return fetchCollectionRemote<TimetableEntry>('timetable');
}

export async function saveTimetableEntry(entry: TimetableEntry): Promise<void> {
  await upsertDocWithSync('timetable', 'timetable', entry, false);
}

export async function deleteTimetableEntry(entryId: string): Promise<void> {
  await deleteDocWithSync<TimetableEntry>('timetable', 'timetable', entryId);
}

export async function getAssignments(): Promise<Assignment[]> {
  return fetchCollectionRemote<Assignment>('assignments');
}

export async function saveAssignment(assignment: Assignment): Promise<void> {
  await upsertDocWithSync('assignments', 'assignments', assignment, true);
}

export async function deleteAssignment(assignmentId: string): Promise<void> {
  await deleteDocWithSync<Assignment>('assignments', 'assignments', assignmentId);
}

export async function getAssignmentSubmissions(): Promise<AssignmentSubmission[]> {
  return fetchCollectionRemote<AssignmentSubmission>('assignmentSubmissions');
}

export async function saveAssignmentSubmission(sub: AssignmentSubmission): Promise<void> {
  await upsertDocWithSync('assignmentSubmissions', 'assignment_submissions', sub, true);
}

export async function getLearningMaterials(): Promise<LearningMaterial[]> {
  return fetchCollectionRemote<LearningMaterial>('learningMaterials');
}

export async function saveLearningMaterial(material: LearningMaterial): Promise<void> {
  await upsertDocWithSync('learningMaterials', 'learning_materials', material, true);
}

export async function deleteLearningMaterial(materialId: string): Promise<void> {
  await deleteDocWithSync<LearningMaterial>('learningMaterials', 'learning_materials', materialId);
}

/* ================== LIBRARY SERVICE (ATOMIC TRANSACTIONS) ================== */
export async function getBooks(): Promise<Book[]> {
  return fetchCollectionRemote<Book>('books');
}

export async function saveBook(book: Book, options?: UpsertCloudOptions<Book>): Promise<void> {
  await upsertDocWithSync('books', 'books', book, true, options);
}

export async function deleteBook(bookId: string): Promise<void> {
  await deleteDocWithSync<Book>('books', 'books', bookId);
}

export async function getBookCopies(): Promise<BookCopy[]> {
  return fetchCollectionRemote<BookCopy>('bookCopies');
}

export async function saveBookCopy(copy: BookCopy): Promise<void> {
  await upsertDocWithSync('bookCopies', 'book_copies', copy, true);
}

export async function deleteBookCopy(copyId: string): Promise<void> {
  await deleteDocWithSync<BookCopy>('bookCopies', 'book_copies', copyId);
}

export async function getInventoryAudits(): Promise<InventoryAudit[]> {
  return fetchCollectionRemote<InventoryAudit>('inventoryAudits');
}

export async function saveInventoryAudit(audit: InventoryAudit): Promise<void> {
  await upsertDocWithSync('inventoryAudits', 'inventory_audits', audit, true);
}

export async function getBorrowTransactions(): Promise<BorrowTransaction[]> {
  return fetchCollectionRemote<BorrowTransaction>('borrowTransactions');
}

export async function recordBorrowBook(
  student: Pick<Student, 'id' | 'fullName' | 'studentCode'>,
  book: Book,
  copyBarcode: string,
  loanDays: number = 14,
  copyId?: string,
  borrowerRole?: UserProfile['role']
): Promise<BorrowTransaction> {
  requireAuthenticatedOnline();
  const actorUid = getActorUid();
  const schoolId = getActiveSchoolContext();
  const nowIso = new Date().toISOString();
  const today = new Date();
  const due = new Date();
  due.setDate(today.getDate() + loanDays);

  const uniqueSuffix = `${Date.now().toString().slice(-6)}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
  const code = `LIB-${today.getFullYear()}-${uniqueSuffix}`;

  // Resolve target copyId by barcode if copyId was not directly passed
  let resolvedCopyId = copyId;
  if (!resolvedCopyId && copyBarcode) {
    const q = query(
      collection(db, 'bookCopies'),
      where('copyBarcode', '==', copyBarcode.trim())
    );
    const copySnap = await getDocs(q);
    if (!copySnap.empty) {
      resolvedCopyId = copySnap.docs[0].id;
    }
  }

  const newTrans: BorrowTransaction = stripUndefined(
    withSyncMetadata(
      {
        id: code,
        transactionCode: code,
        studentId: student.id,
        studentName: student.fullName,
        studentCode: student.studentCode,
        ...(borrowerRole ? { borrowerRole } : {}),
        bookId: book.id,
        bookTitle: book.title,
        ...(resolvedCopyId ? { copyId: resolvedCopyId } : {}),
        copyBarcode,
        borrowDate: today.toISOString().split('T')[0],
        dueDate: due.toISOString().split('T')[0],
        renewCount: 0,
        status: 'borrowed' as const,
      },
      { schoolId, actorUid, nowIso }
    )
  );

  try {
    await runTransaction(db, async (tx) => {
      const bookRef = doc(db, 'books', book.id);
      const bookSnap = await tx.get(bookRef);
      if (!bookSnap.exists()) {
        throw new Error(`Không tìm thấy đầu sách "${book.title}" trên hệ thống.`);
      }
      const bookData = bookSnap.data() as Book & { version?: number };
      if ((bookData.availableCopies ?? 0) <= 0) {
        throw new Error(`Sách "${bookData.title}" đã hết bản sẵn sàng để mượn.`);
      }

      if (resolvedCopyId) {
        const copyRef = doc(db, 'bookCopies', resolvedCopyId);
        const copySnap = await tx.get(copyRef);
        if (copySnap.exists()) {
          const copyData = copySnap.data() as BookCopy & { version?: number };
          if (copyData.status === 'borrowed' || copyData.status === 'lost') {
            throw new Error(`Bản sao ${copyData.copyBarcode} đang ở trạng thái ${copyData.status}.`);
          }
          tx.update(copyRef, {
            status: 'borrowed',
            currentTransactionId: newTrans.id,
            updatedAt: nowIso,
            updatedBy: actorUid,
            version: (copyData.version || 1) + 1,
          });
        }
      }

      tx.update(bookRef, {
        availableCopies: Math.max(0, (bookData.availableCopies ?? 0) - 1),
        updatedAt: nowIso,
        updatedBy: actorUid,
        version: (bookData.version || 1) + 1,
      });

      tx.set(doc(db, 'borrowTransactions', newTrans.id), newTrans);
    });
    return newTrans;
  } catch (e) {
    if (e instanceof Error && !e.message.includes('Firebase')) throw e;
    handleFirestoreError(e, OperationType.WRITE, `borrowTransactions/${newTrans.id}`);
  }
}

export async function recordReturnBook(
  transactionId: string,
  conditionOnReturn: BorrowTransaction['conditionOnReturn'] = 'Tốt',
  fineAmount: number = 0
): Promise<void> {
  requireAuthenticatedOnline();
  const actorUid = getActorUid();
  const nowIso = new Date().toISOString();
  const returnDate = nowIso.split('T')[0];
  const isLost = conditionOnReturn === 'Mất';
  const nextStatus: BorrowTransaction['status'] = isLost ? 'lost' : 'returned';

  const transRef = doc(db, 'borrowTransactions', transactionId);
  try {
    await runTransaction(db, async (tx) => {
      const transSnap = await tx.get(transRef);
      if (!transSnap.exists()) {
        throw new Error(`Không tìm thấy phiếu mượn ${transactionId} trên máy chủ.`);
      }
      const transData = transSnap.data() as BorrowTransaction & { version?: number };
      if (transData.status === 'returned' || transData.status === 'lost') {
        throw new Error(`Phiếu mượn ${transData.transactionCode} đã được xử lý trả trước đó.`);
      }

      const bookRef = doc(db, 'books', transData.bookId);
      const bookSnap = await tx.get(bookRef);

      let copySnap = null;
      let copyRef = null;
      if (transData.copyId) {
        copyRef = doc(db, 'bookCopies', transData.copyId);
        copySnap = await tx.get(copyRef);
      }

      tx.update(transRef, {
        status: nextStatus,
        returnDate,
        conditionOnReturn,
        fineAmount,
        updatedAt: nowIso,
        updatedBy: actorUid,
        version: (transData.version || 1) + 1,
      });

      if (bookSnap.exists() && !isLost) {
        const bookData = bookSnap.data() as Book & { version?: number };
        tx.update(bookRef, {
          availableCopies: Math.min(bookData.totalCopies, (bookData.availableCopies ?? 0) + 1),
          updatedAt: nowIso,
          updatedBy: actorUid,
          version: (bookData.version || 1) + 1,
        });
      }

      if (copyRef && copySnap?.exists()) {
        const copyData = copySnap.data() as BookCopy & { version?: number };
        tx.update(copyRef, {
          status: isLost ? 'lost' : conditionOnReturn === 'Hỏng' ? 'damaged' : 'available',
          condition:
            conditionOnReturn === 'Hỏng'
              ? 'Hỏng'
              : conditionOnReturn === 'Hư hỏng nhẹ'
                ? 'Cần sửa'
                : 'Tốt',
          currentTransactionId: '',
          updatedAt: nowIso,
          updatedBy: actorUid,
          version: (copyData.version || 1) + 1,
        });
      }
    });
  } catch (e) {
    if (e instanceof Error && !e.message.includes('Firebase')) throw e;
    handleFirestoreError(e, OperationType.UPDATE, `borrowTransactions/${transactionId}`);
  }
}

export async function recordRenewBook(transactionId: string, newDueDate: string): Promise<void> {
  requireAuthenticatedOnline();
  const actorUid = getActorUid();
  const nowIso = new Date().toISOString();
  const transRef = doc(db, 'borrowTransactions', transactionId);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(transRef);
      if (!snap.exists()) {
        throw new Error(`Không tìm thấy phiếu mượn ${transactionId}.`);
      }
      const data = snap.data() as BorrowTransaction & { version?: number };
      tx.update(transRef, {
        dueDate: newDueDate,
        renewCount: (data.renewCount ?? 0) + 1,
        updatedAt: nowIso,
        updatedBy: actorUid,
        version: (data.version || 1) + 1,
      });
    });
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `borrowTransactions/${transactionId}`);
  }
}

export async function getBookReservations(): Promise<BookReservation[]> {
  return fetchCollectionRemote<BookReservation>('bookReservations');
}

export async function saveBookReservation(res: BookReservation): Promise<void> {
  await upsertDocWithSync('bookReservations', 'book_reservations', res, true);
}

export async function getLibraryRenewalRequests(): Promise<LibraryRenewalRequest[]> {
  return fetchCollectionRemote<LibraryRenewalRequest>('libraryRenewalRequests');
}

export async function saveLibraryRenewalRequest(req: LibraryRenewalRequest): Promise<void> {
  await upsertDocWithSync('libraryRenewalRequests', 'library_renewal_requests', req, true);
}

export async function deleteLibraryRenewalRequest(id: string): Promise<void> {
  await deleteDocWithSync<LibraryRenewalRequest>('libraryRenewalRequests', 'library_renewal_requests', id);
}

export async function getLibraryTransactionHistory(): Promise<LibraryTransactionHistoryEntry[]> {
  const rows = await fetchCollectionRemote<LibraryTransactionHistoryEntry>('libraryTransactionHistory');
  return rows.sort((a, b) => b.changedAt.localeCompare(a.changedAt));
}

export async function appendLibraryTransactionHistory(entry: LibraryTransactionHistoryEntry): Promise<void> {
  await upsertDocWithSync('libraryTransactionHistory', 'library_transaction_history', entry, true);
}

export async function updateBorrowDueDateWithHistory(
  transactionId: string,
  newDueDate: string,
  changedBy: string,
  changedByRole: UserRole,
  reason: string,
  isRenewalApproved: boolean = false
): Promise<{ updatedTransaction: BorrowTransaction | null; historyEntry: LibraryTransactionHistoryEntry | null }> {
  requireAuthenticatedOnline();
  const actorUid = getActorUid();
  const schoolId = getActiveSchoolContext();
  const nowIso = new Date().toISOString();
  const today = nowIso.split('T')[0];
  const transRef = doc(db, 'borrowTransactions', transactionId);

  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(transRef);
      if (!snap.exists()) {
        return { updatedTransaction: null, historyEntry: null };
      }
      const current = { ...snap.data(), id: snap.id } as BorrowTransaction & { version?: number };
      const nextStatus: BorrowTransaction['status'] =
        current.status === 'returned' || current.status === 'lost'
          ? current.status
          : newDueDate < today
            ? 'overdue'
            : 'borrowed';

      const historyEntry: LibraryTransactionHistoryEntry = {
        id: `LTH-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        transactionId: current.id,
        transactionCode: current.transactionCode,
        bookTitle: current.bookTitle,
        borrowerName: current.studentName,
        actionType: isRenewalApproved ? 'renew_approved' : 'due_date_edited',
        oldDueDate: current.dueDate,
        newDueDate,
        changedBy,
        changedByRole,
        changedAt: nowIso,
        reason,
      };

      const nextRenewCount = isRenewalApproved
        ? (current.renewCount ?? 0) + 1
        : current.renewCount ?? 0;
      const nextHistoryList = [historyEntry, ...(current.dueDateHistory || [])].slice(0, 20);
      const nextVersion = (current.version || 1) + 1;

      tx.update(transRef, {
        dueDate: newDueDate,
        status: nextStatus,
        renewCount: nextRenewCount,
        dueDateHistory: nextHistoryList,
        updatedAt: nowIso,
        updatedBy: actorUid,
        version: nextVersion,
      });

      const historyDoc = stripUndefined(
        withSyncMetadata(historyEntry as unknown as Record<string, unknown>, {
          schoolId,
          actorUid,
          nowIso,
        })
      );
      tx.set(doc(db, 'libraryTransactionHistory', historyEntry.id), historyDoc);

      const updatedTransaction: BorrowTransaction = {
        ...current,
        dueDate: newDueDate,
        status: nextStatus,
        renewCount: nextRenewCount,
        dueDateHistory: nextHistoryList,
      };
      return { updatedTransaction, historyEntry };
    });
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `borrowTransactions/${transactionId}`);
  }
}

/* ================== RULES, EMULATION & COMPETITIONS SERVICES ================== */
export async function getRuleDocuments(): Promise<RuleDocument[]> {
  return fetchCollectionRemote<RuleDocument>('ruleDocuments');
}

export async function saveRuleDocument(docItem: RuleDocument): Promise<void> {
  await upsertDocWithSync('ruleDocuments', 'rule_documents', docItem, true);
}

export async function deleteRuleDocument(id: string): Promise<void> {
  await deleteDocWithSync<RuleDocument>('ruleDocuments', 'rule_documents', id);
}

export async function getRuleVersions(): Promise<RuleVersion[]> {
  return fetchCollectionRemote<RuleVersion>('ruleVersions');
}

export async function saveRuleVersion(ver: RuleVersion): Promise<void> {
  await upsertDocWithSync('ruleVersions', 'rule_versions', ver, true);
}

export async function getRuleCategories(): Promise<RuleCategory[]> {
  const rows = await fetchCollectionRemote<RuleCategory>('ruleCategories');
  return rows.sort((a, b) => a.order - b.order);
}

export async function saveRuleCategory(cat: RuleCategory): Promise<void> {
  await upsertDocWithSync('ruleCategories', 'rule_categories', cat, false);
}

export async function deleteRuleCategory(id: string): Promise<void> {
  await deleteDocWithSync<RuleCategory>('ruleCategories', 'rule_categories', id);
}

export async function getRuleCriteria(): Promise<RuleCriterion[]> {
  return fetchCollectionRemote<RuleCriterion>('ruleCriteria');
}

export async function saveRuleCriterion(
  item: RuleCriterion,
  options?: UpsertCloudOptions<RuleCriterion>
): Promise<void> {
  await upsertDocWithSync('ruleCriteria', 'rule_criteria', item, true, options);
}

export async function deleteRuleCriterion(id: string): Promise<void> {
  await deleteDocWithSync<RuleCriterion>('ruleCriteria', 'rule_criteria', id);
}

export async function getEmulationRecords(): Promise<EmulationRecord[]> {
  return fetchCollectionRemote<EmulationRecord>('emulationRecords');
}

export async function saveEmulationRecord(
  rec: EmulationRecord,
  options?: UpsertCloudOptions<EmulationRecord>
): Promise<void> {
  await upsertDocWithSync('emulationRecords', 'emulation_records', rec, true, options);
}

export async function deleteEmulationRecord(id: string): Promise<void> {
  await deleteDocWithSync<EmulationRecord>('emulationRecords', 'emulation_records', id);
}

export async function getEmulationAppeals(): Promise<EmulationAppeal[]> {
  return fetchCollectionRemote<EmulationAppeal>('emulationAppeals');
}

export async function saveEmulationAppeal(appeal: EmulationAppeal): Promise<void> {
  await upsertDocWithSync('emulationAppeals', 'emulation_appeals', appeal, true);
}

export async function getEmulationPeriods(): Promise<EmulationPeriod[]> {
  return fetchCollectionRemote<EmulationPeriod>('emulationPeriods');
}

export async function saveEmulationPeriod(period: EmulationPeriod): Promise<void> {
  await upsertDocWithSync('emulationPeriods', 'emulation_periods', period, true);
}

export async function getEmulationSnapshots(): Promise<EmulationSnapshot[]> {
  return fetchCollectionRemote<EmulationSnapshot>('emulationSnapshots');
}

export async function saveEmulationSnapshot(snapshot: EmulationSnapshot): Promise<void> {
  await upsertDocWithSync('emulationSnapshots', 'emulation_snapshots', snapshot, true);
}

export async function getEmulationTitleConfigs(): Promise<EmulationTitleConfig[]> {
  return fetchCollectionRemote<EmulationTitleConfig>('emulationTitleConfigs');
}

export async function saveEmulationTitleConfig(cfg: EmulationTitleConfig): Promise<void> {
  await upsertDocWithSync('emulationTitleConfigs', 'emulation_title_configs', cfg, false);
}

export async function deleteEmulationTitleConfig(id: string): Promise<void> {
  await deleteDocWithSync<EmulationTitleConfig>('emulationTitleConfigs', 'emulation_title_configs', id);
}

export async function getCompetitions(): Promise<Competition[]> {
  return fetchCollectionRemote<Competition>('competitions');
}

export async function saveCompetition(comp: Competition): Promise<void> {
  await upsertDocWithSync('competitions', 'competitions', comp, true);
}

export async function deleteCompetition(id: string): Promise<void> {
  await deleteDocWithSync<Competition>('competitions', 'competitions', id);
}

export async function getCompetitionCriteria(): Promise<CompetitionCriterion[]> {
  return fetchCollectionRemote<CompetitionCriterion>('competitionCriteria');
}

export async function saveCompetitionCriterion(item: CompetitionCriterion): Promise<void> {
  await upsertDocWithSync('competitionCriteria', 'competition_criteria', item, false);
}

export async function deleteCompetitionCriterion(id: string): Promise<void> {
  await deleteDocWithSync<CompetitionCriterion>('competitionCriteria', 'competition_criteria', id);
}

export async function getCompetitionParticipants(): Promise<CompetitionParticipant[]> {
  return fetchCollectionRemote<CompetitionParticipant>('competitionParticipants');
}

export async function saveCompetitionParticipant(p: CompetitionParticipant): Promise<void> {
  await upsertDocWithSync('competitionParticipants', 'competition_participants', p, true);
}

export async function deleteCompetitionParticipant(id: string): Promise<void> {
  await deleteDocWithSync<CompetitionParticipant>('competitionParticipants', 'competition_participants', id);
}

export async function getCompetitionScores(): Promise<CompetitionScore[]> {
  return fetchCollectionRemote<CompetitionScore>('competitionScores');
}

export async function saveCompetitionScore(score: CompetitionScore): Promise<void> {
  await upsertDocWithSync('competitionScores', 'competition_scores', score, true);
}

export async function deleteCompetitionScore(id: string): Promise<void> {
  await deleteDocWithSync<CompetitionScore>('competitionScores', 'competition_scores', id);
}

export async function getCompetitionAwards(): Promise<CompetitionAward[]> {
  return fetchCollectionRemote<CompetitionAward>('competitionAwards');
}

export async function saveCompetitionAward(award: CompetitionAward): Promise<void> {
  await upsertDocWithSync('competitionAwards', 'competition_awards', award, true);
}

export async function deleteCompetitionAward(id: string): Promise<void> {
  await deleteDocWithSync<CompetitionAward>('competitionAwards', 'competition_awards', id);
}

export async function getScoreTransferRecords(): Promise<ScoreTransferRecord[]> {
  return fetchCollectionRemote<ScoreTransferRecord>('scoreTransferRecords');
}

export async function saveScoreTransferRecord(rec: ScoreTransferRecord): Promise<void> {
  await upsertDocWithSync('scoreTransferRecords', 'score_transfer_records', rec, true);
}

/* ================== SURVEYS SERVICE (ATOMIC TRANSACTION) ================== */
export async function getSurveys(): Promise<Survey[]> {
  return fetchCollectionRemote<Survey>('surveys');
}

export async function saveSurvey(survey: Survey): Promise<void> {
  await upsertDocWithSync('surveys', 'surveys', survey, true);
}

export async function getSurveyResponses(): Promise<SurveyResponse[]> {
  return fetchCollectionRemote<SurveyResponse>('surveyResponses');
}

export async function submitSurveyResponse(response: SurveyResponse): Promise<void> {
  requireAuthenticatedOnline();
  const actorUid = getActorUid();
  const schoolId = getActiveSchoolContext();
  const nowIso = new Date().toISOString();
  const surveyRef = doc(db, 'surveys', response.surveyId);
  const respRef = doc(db, 'surveyResponses', response.id);

  try {
    await runTransaction(db, async (tx) => {
      const surveySnap = await tx.get(surveyRef);
      const respDoc = stripUndefined(
        withSyncMetadata(response as unknown as Record<string, unknown>, {
          schoolId,
          actorUid,
          nowIso,
        })
      );
      tx.set(respRef, respDoc);

      if (surveySnap.exists()) {
        const sData = surveySnap.data() as Survey & { version?: number };
        const existingIds = sData.submittedByIds || [];
        const nextIds =
          response.studentId !== 'ANONYMOUS' && !existingIds.includes(response.studentId)
            ? [...existingIds, response.studentId]
            : existingIds;
        tx.update(surveyRef, {
          responsesCount: (sData.responsesCount || 0) + 1,
          submittedByIds: nextIds,
          updatedAt: nowIso,
          updatedBy: actorUid,
          version: (sData.version || 1) + 1,
        });
      }
    });
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `surveyResponses/${response.id}`);
  }
}

/* ================== FEEDBACK SERVICE ================== */
export async function getFeedbackReports(): Promise<FeedbackReport[]> {
  return fetchCollectionRemote<FeedbackReport>('feedbackReports');
}

export async function submitFeedbackReport(report: FeedbackReport): Promise<void> {
  await upsertDocWithSync('feedbackReports', 'feedbacks', report, true);
}

export async function updateFeedbackStatus(
  reportId: string,
  status: FeedbackReport['status'],
  resolutionNote?: string,
  assignedTo?: string
): Promise<void> {
  requireAuthenticatedOnline();
  const nowIso = new Date().toISOString();
  const actorUid = getActorUid();
  const ref = doc(db, 'feedbackReports', reportId);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const cur = snap.data() as FeedbackReport & { version?: number };
      tx.update(
        ref,
        stripUndefined({
          status,
          ...(resolutionNote !== undefined ? { resolutionNote } : {}),
          ...(assignedTo !== undefined ? { assignedTo } : {}),
          updatedAt: nowIso,
          updatedBy: actorUid,
          version: (cur.version || 1) + 1,
        }) as DocumentData
      );
    });
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `feedbackReports/${reportId}`);
  }
}

/* ================== COUNSELING, LEAVE & SUPPORT TICKETS ================== */
export async function getCounselingRequests(): Promise<CounselingRequest[]> {
  return fetchCollectionRemote<CounselingRequest>('counselingRequests');
}

export async function submitCounselingRequest(request: CounselingRequest): Promise<void> {
  await upsertDocWithSync('counselingRequests', 'counseling', request, true);
}

export async function updateCounselingStatus(
  requestId: string,
  status: CounselingRequest['status'],
  meetingNotes?: string
): Promise<void> {
  requireAuthenticatedOnline();
  const nowIso = new Date().toISOString();
  const actorUid = getActorUid();
  const ref = doc(db, 'counselingRequests', requestId);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const cur = snap.data() as CounselingRequest & { version?: number };
      tx.update(
        ref,
        stripUndefined({
          status,
          ...(meetingNotes !== undefined ? { meetingNotes } : {}),
          updatedAt: nowIso,
          updatedBy: actorUid,
          version: (cur.version || 1) + 1,
        }) as DocumentData
      );
    });
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `counselingRequests/${requestId}`);
  }
}

export async function getLeaveRequests(): Promise<StudentLeaveRequest[]> {
  return fetchCollectionRemote<StudentLeaveRequest>('leaveRequests');
}

export async function saveLeaveRequest(req: StudentLeaveRequest): Promise<void> {
  await upsertDocWithSync('leaveRequests', 'leave_requests', req, true);
}

export async function getSupportTickets(): Promise<SupportTicket[]> {
  return fetchCollectionRemote<SupportTicket>('supportTickets');
}

export async function saveSupportTicket(ticket: SupportTicket): Promise<void> {
  await upsertDocWithSync('supportTickets', 'support_tickets', ticket, true);
}

/* ================== ANNOUNCEMENTS & EVENTS SERVICE ================== */
export async function getAnnouncements(): Promise<Announcement[]> {
  return fetchCollectionRemote<Announcement>('announcements');
}

export async function saveAnnouncement(ann: Announcement): Promise<void> {
  await upsertDocWithSync('announcements', 'announcements', ann, true);
}

export async function getSchoolEvents(): Promise<SchoolEvent[]> {
  return fetchCollectionRemote<SchoolEvent>('schoolEvents');
}

export async function saveSchoolEvent(event: SchoolEvent): Promise<void> {
  await upsertDocWithSync('schoolEvents', 'school_events', event, true);
}

/* ================== ATTENDANCE & ACADEMIC SERVICE ================== */
export async function getAttendanceRecords(classId?: string, date?: string): Promise<AttendanceRecord[]> {
  let list = await fetchCollectionRemote<AttendanceRecord>('attendanceRecords');
  if (classId) list = list.filter((a) => a.classId === classId);
  if (date) list = list.filter((a) => a.date === date);
  return list;
}

export async function saveAttendanceRecords(records: AttendanceRecord[]): Promise<void> {
  if (records.length === 0) return;
  await upsertBatchWithSync('attendanceRecords', 'attendance', records, false);
}

export async function getAcademicRecords(studentId?: string, classId?: string): Promise<AcademicRecord[]> {
  let list = await fetchCollectionRemote<AcademicRecord>('academicRecords');
  if (studentId) list = list.filter((a) => a.studentId === studentId);
  if (classId) list = list.filter((a) => a.classId === classId);
  return list;
}

export async function saveAcademicRecord(
  rec: AcademicRecord,
  options?: UpsertCloudOptions<AcademicRecord>
): Promise<void> {
  await upsertDocWithSync('academicRecords', 'academic', rec, false, options);
}

/* ================== FACILITIES, ROOMS & EXTERNAL DATASETS ================== */
export async function getRooms(): Promise<SchoolRoom[]> {
  return fetchCollectionRemote<SchoolRoom>('rooms');
}

export async function saveRoom(room: SchoolRoom): Promise<void> {
  await upsertDocWithSync('rooms', 'rooms', room, true);
}

export async function deleteRoom(roomId: string): Promise<void> {
  await deleteDocWithSync<SchoolRoom>('rooms', 'rooms', roomId);
}

export async function getFacilities(): Promise<FacilityAsset[]> {
  return fetchCollectionRemote<FacilityAsset>('facilities');
}

export async function saveFacility(asset: FacilityAsset): Promise<void> {
  await upsertDocWithSync('facilities', 'facilities', asset, false);
}

export async function deleteFacility(assetId: string): Promise<void> {
  await deleteDocWithSync<FacilityAsset>('facilities', 'facilities', assetId);
}

export async function getMaintenanceRequests(): Promise<MaintenanceRequest[]> {
  return fetchCollectionRemote<MaintenanceRequest>('maintenanceRequests');
}

export async function submitMaintenanceRequest(req: MaintenanceRequest): Promise<void> {
  await upsertDocWithSync('maintenanceRequests', 'maintenance', req, true);
}

export async function getExternalDatasets(): Promise<ExternalDatasetRecord[]> {
  return fetchCollectionRemote<ExternalDatasetRecord>('externalDatasets');
}

export async function saveExternalDatasetsBatch(records: ExternalDatasetRecord[]): Promise<void> {
  await upsertBatchWithSync('externalDatasets', 'externalDatasets', records, true);
}

export async function deleteExternalDataset(id: string): Promise<void> {
  await deleteDocWithSync<ExternalDatasetRecord>('externalDatasets', 'externalDatasets', id);
}

/* ================== AUDIT LOGS, IMPORT/EXPORT HISTORY & SYSTEM SETTINGS ================== */
export async function getAuditLogs(): Promise<AuditLogEntry[]> {
  return fetchCollectionRemote<AuditLogEntry>('auditLogs');
}

export async function appendAuditLog(entry: AuditLogEntry): Promise<void> {
  if (!auth.currentUser || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
  const schoolId = getActiveSchoolContext();
  const actorUid = getActorUid();
  const clean = stripUndefined(
    withSyncMetadata(entry as unknown as Record<string, unknown>, {
      schoolId,
      actorUid,
      nowIso: entry.timestamp || new Date().toISOString(),
    })
  );
  try {
    await setDoc(doc(db, 'auditLogs', String(clean.id)), clean);
  } catch {
    // Non-blocking for non-admin roles without auditLogs write access
  }
}

export async function getImportHistory(): Promise<ImportHistoryRecord[]> {
  const rows = await fetchCollectionRemote<ImportHistoryRecord>('importHistory');
  return rows.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function appendImportHistory(record: ImportHistoryRecord): Promise<void> {
  requireAuthenticatedOnline();
  const schoolId = getActiveSchoolContext();
  const actorUid = getActorUid();
  const clean = stripUndefined(
    withSyncMetadata(record as unknown as Record<string, unknown>, {
      schoolId,
      actorUid,
      nowIso: record.timestamp || new Date().toISOString(),
    })
  );
  try {
    await setDoc(doc(db, 'importHistory', String(clean.id)), clean);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `importHistory/${clean.id}`);
  }
}

export async function getExportHistory(): Promise<ExportHistoryRecord[]> {
  const rows = await fetchCollectionRemote<ExportHistoryRecord>('exportHistory');
  return rows.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function appendExportHistory(record: ExportHistoryRecord): Promise<void> {
  if (!auth.currentUser || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
  const schoolId = getActiveSchoolContext();
  const actorUid = getActorUid();
  const clean = stripUndefined(
    withSyncMetadata(record as unknown as Record<string, unknown>, {
      schoolId,
      actorUid,
      nowIso: record.timestamp || new Date().toISOString(),
    })
  );
  try {
    await setDoc(doc(db, 'exportHistory', String(clean.id)), clean);
  } catch {
    // Non-blocking if current auth lacks exportHistory write access
  }
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  schoolName: 'Trường THPT SchoolHub',
  academicYear: '2026 - 2027',
  defaultLoanDays: 14,
  maxBorrowLimit: 3,
  compactMode: false,
  glassIntensity: 'high',
  gradeWeights: {
    regularWeight: 1,
    midtermWeight: 2,
    finalWeight: 3,
  },
};

export function getSystemSettings(): SystemSettings {
  return DEFAULT_SYSTEM_SETTINGS;
}

export async function fetchSystemSettingsRemote(schoolId?: string): Promise<SystemSettings> {
  if (!auth.currentUser) return DEFAULT_SYSTEM_SETTINGS;
  const targetSchool = normalizeSchoolId(schoolId || getActiveSchoolContext());
  try {
    const scopedSnap = await getDoc(doc(db, 'systemSettings', targetSchool));
    if (scopedSnap.exists()) {
      return { ...DEFAULT_SYSTEM_SETTINGS, ...(scopedSnap.data() as Partial<SystemSettings>) };
    }
    if (targetSchool === DEFAULT_SCHOOL_ID) {
      const legacyGlobalSnap = await getDoc(doc(db, 'systemSettings', 'global'));
      if (legacyGlobalSnap.exists()) {
        return {
          ...DEFAULT_SYSTEM_SETTINGS,
          ...(legacyGlobalSnap.data() as Partial<SystemSettings>),
        };
      }
    }
    return DEFAULT_SYSTEM_SETTINGS;
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, `systemSettings/${targetSchool}`);
  }
}

export async function saveSystemSettings(
  settings: SystemSettings,
  schoolId?: string
): Promise<void> {
  requireAuthenticatedOnline();
  const targetSchool = normalizeSchoolId(schoolId || getActiveSchoolContext());
  const actorUid = getActorUid();
  const now = new Date().toISOString();
  const payload = stripUndefined({
    ...settings,
    schoolId: targetSchool,
    updatedAt: now,
    updatedBy: actorUid,
  });

  try {
    await setDoc(doc(db, 'systemSettings', targetSchool), payload, { merge: true });
    if (targetSchool === DEFAULT_SCHOOL_ID) {
      await setDoc(doc(db, 'systemSettings', 'global'), payload, { merge: true });
    }
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `systemSettings/${targetSchool}`);
  }
}

/* ================== FULL CLOUD BACKUP EXPORT / IMPORT / PURGE ================== */
export function exportFullBackupJson(liveStateSnapshot?: {
  settings?: SystemSettings;
  data?: Record<string, unknown>;
}): string {
  return JSON.stringify(
    {
      version: 4,
      schoolId: getActiveSchoolContext(),
      exportedAt: new Date().toISOString(),
      settings: liveStateSnapshot?.settings || DEFAULT_SYSTEM_SETTINGS,
      data: liveStateSnapshot?.data || {},
    },
    null,
    2
  );
}

const BACKUP_KEY_TO_FIRESTORE_COLLECTION: Record<string, string> = {
  users: 'users',
  userInvites: 'userInvites',
  user_invites: 'userInvites',
  students: 'studentProfiles',
  studentProfiles: 'studentProfiles',
  teachers: 'teacherProfiles',
  teacherProfiles: 'teacherProfiles',
  staffMembers: 'staffMembers',
  staff_members: 'staffMembers',
  academicYears: 'academicYears',
  academic_years: 'academicYears',
  classes: 'classes',
  classPlacements: 'classPlacements',
  class_placements: 'classPlacements',
  teachingAssignments: 'teachingAssignments',
  teaching_assignments: 'teachingAssignments',
  books: 'books',
  bookCopies: 'bookCopies',
  book_copies: 'bookCopies',
  borrowTransactions: 'borrowTransactions',
  borrow_transactions: 'borrowTransactions',
  bookReservations: 'bookReservations',
  book_reservations: 'bookReservations',
  libraryRenewalRequests: 'libraryRenewalRequests',
  library_renewal_requests: 'libraryRenewalRequests',
  libraryTransactionHistory: 'libraryTransactionHistory',
  library_transaction_history: 'libraryTransactionHistory',
  inventoryAudits: 'inventoryAudits',
  inventory_audits: 'inventoryAudits',
  surveys: 'surveys',
  surveyResponses: 'surveyResponses',
  survey_responses: 'surveyResponses',
  feedbacks: 'feedbackReports',
  feedbackReports: 'feedbackReports',
  counseling: 'counselingRequests',
  counselingRequests: 'counselingRequests',
  leaveRequests: 'leaveRequests',
  leave_requests: 'leaveRequests',
  supportTickets: 'supportTickets',
  support_tickets: 'supportTickets',
  announcements: 'announcements',
  schoolEvents: 'schoolEvents',
  school_events: 'schoolEvents',
  attendance: 'attendanceRecords',
  attendanceRecords: 'attendanceRecords',
  academic: 'academicRecords',
  academicRecords: 'academicRecords',
  assignments: 'assignments',
  assignmentSubmissions: 'assignmentSubmissions',
  assignment_submissions: 'assignmentSubmissions',
  learningMaterials: 'learningMaterials',
  learning_materials: 'learningMaterials',
  rooms: 'rooms',
  facilities: 'facilities',
  maintenance: 'maintenanceRequests',
  maintenanceRequests: 'maintenanceRequests',
  timetable: 'timetable',
  ruleDocuments: 'ruleDocuments',
  rule_documents: 'ruleDocuments',
  ruleVersions: 'ruleVersions',
  rule_versions: 'ruleVersions',
  ruleCategories: 'ruleCategories',
  rule_categories: 'ruleCategories',
  ruleCriteria: 'ruleCriteria',
  rule_criteria: 'ruleCriteria',
  emulationRecords: 'emulationRecords',
  emulation_records: 'emulationRecords',
  emulationAppeals: 'emulationAppeals',
  emulation_appeals: 'emulationAppeals',
  emulationPeriods: 'emulationPeriods',
  emulation_periods: 'emulationPeriods',
  emulationSnapshots: 'emulationSnapshots',
  emulation_snapshots: 'emulationSnapshots',
  emulationTitleConfigs: 'emulationTitleConfigs',
  emulation_title_configs: 'emulationTitleConfigs',
  competitions: 'competitions',
  competitionCriteria: 'competitionCriteria',
  competition_criteria: 'competitionCriteria',
  competitionParticipants: 'competitionParticipants',
  competition_participants: 'competitionParticipants',
  competitionScores: 'competitionScores',
  competition_scores: 'competitionScores',
  competitionAwards: 'competitionAwards',
  competition_awards: 'competitionAwards',
  scoreTransferRecords: 'scoreTransferRecords',
  score_transfer_records: 'scoreTransferRecords',
  auditLogs: 'auditLogs',
  audit_logs: 'auditLogs',
  importHistory: 'importHistory',
  import_history: 'importHistory',
  exportHistory: 'exportHistory',
  export_history: 'exportHistory',
  googleSyncSources: 'googleSyncSources',
  google_sync_sources: 'googleSyncSources',
  googleSyncHistory: 'googleSyncHistory',
  google_sync_history: 'googleSyncHistory',
  googleDataChangeLogs: 'googleDataChangeLogs',
  google_data_change_logs: 'googleDataChangeLogs',
  googleSyncConflicts: 'googleSyncConflicts',
  google_sync_conflicts: 'googleSyncConflicts',
  googlePendingDeletions: 'googlePendingDeletions',
  google_pending_deletions: 'googlePendingDeletions',
  googleDocProposals: 'googleDocProposals',
  google_doc_proposals: 'googleDocProposals',
  googleReportTemplates: 'googleReportTemplates',
  google_report_templates: 'googleReportTemplates',
  externalDatasets: 'externalDatasets',
};

export async function importFullBackupJson(payload: Record<string, unknown>): Promise<void> {
  requireAuthenticatedOnline();
  const dataObj =
    payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
      ? (payload.data as Record<string, unknown>)
      : payload;

  for (const [k, v] of Object.entries(dataObj)) {
    if (!Array.isArray(v) || v.length === 0) continue;
    const colName = BACKUP_KEY_TO_FIRESTORE_COLLECTION[k];
    if (!colName) continue;
    const items = v
      .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'))
      .map((row, idx) => ({
        ...row,
        id: String(row.id || `${colName.toUpperCase()}-${Date.now()}-${idx}`),
      }));
    await upsertBatchWithSync(colName, colName, items);
  }

  if (payload.settings && typeof payload.settings === 'object') {
    await saveSystemSettings({
      ...DEFAULT_SYSTEM_SETTINGS,
      ...(payload.settings as Partial<SystemSettings>),
    });
  }
}

export async function clearAllCloudSystemData(
  collectionsToClear: string[] = [
    'studentProfiles',
    'teacherProfiles',
    'staffMembers',
    'classes',
    'books',
    'bookCopies',
    'borrowTransactions',
    'bookReservations',
    'libraryRenewalRequests',
    'libraryTransactionHistory',
    'inventoryAudits',
    'surveys',
    'surveyResponses',
    'feedbackReports',
    'leaveRequests',
    'announcements',
    'schoolEvents',
    'attendanceRecords',
    'academicRecords',
    'assignments',
    'assignmentSubmissions',
    'learningMaterials',
    'rooms',
    'facilities',
    'maintenanceRequests',
    'timetable',
    'supportTickets',
    'emulationRecords',
    'emulationAppeals',
    'competitions',
    'competitionCriteria',
    'competitionParticipants',
    'competitionScores',
    'competitionAwards',
    'scoreTransferRecords',
    'externalDatasets',
  ]
): Promise<void> {
  requireAuthenticatedOnline();
  const school = getActiveSchoolContext();
  for (const colName of collectionsToClear) {
    try {
      const snap = await getDocs(collection(db, colName));
      const docsToDelete = snap.docs.filter((d) =>
        isSameSchoolRecord(d.data() as { schoolId?: string }, school)
      );
      for (let i = 0; i < docsToDelete.length; i += 400) {
        const batch = writeBatch(db);
        for (const d of docsToDelete.slice(i, i + 400)) {
          batch.delete(d.ref);
        }
        await batch.commit();
      }
    } catch {
      // Skip collections the current user shouldn't delete (e.g., confidential counseling)
    }
  }
  purgeAllLegacyLocalStorageKeys();
}

export function clearAllLocalSystemData(): void {
  purgeAllLegacyLocalStorageKeys();
}

/* ================== REAL-TIME FIRESTORE SUBSCRIPTIONS ================== */
export interface SchoolRealtimeHandlers {
  user: UserProfile;
  schoolId?: string;
  onCollectionData: (collectionName: string, items: unknown[]) => void;
  onSystemSettings: (settings: SystemSettings) => void;
  onUserProfileChanged?: (profile: UserProfile) => void;
  onError?: (collectionName: string, error: Error) => void;
}

export function subscribeSchoolCollections({
  user,
  schoolId,
  onCollectionData,
  onSystemSettings,
  onUserProfileChanged,
  onError,
}: SchoolRealtimeHandlers): () => void {
  const targetSchool = normalizeSchoolId(schoolId || user.schoolId);
  const specs = getCollectionSubscriptionSpecs(user, targetSchool);
  const unsubscribes: Unsubscribe[] = [];

  // 1. Real-time self user profile listener (immediate role/lock propagation)
  unsubscribes.push(
    onSnapshot(
      doc(db, 'users', user.id),
      (snap) => {
        if (snap.exists() && onUserProfileChanged) {
          const safeProfile = normalizeUserProfileSafe(
            { ...(snap.data() as Partial<UserProfile>), id: snap.id },
            {
              email: user.email,
              displayName: user.displayName,
              photoURL: user.avatarUrl,
              fallbackRole: user.role,
            }
          );
          onUserProfileChanged(safeProfile);
        }
      },
      (err) => onError?.('users/self', err)
    )
  );

  // 2. Real-time systemSettings listener
  const settingsDocId = targetSchool === DEFAULT_SCHOOL_ID ? DEFAULT_SCHOOL_ID : targetSchool;
  unsubscribes.push(
    onSnapshot(
      doc(db, 'systemSettings', settingsDocId),
      async (snap) => {
        if (snap.exists()) {
          onSystemSettings({
            ...DEFAULT_SYSTEM_SETTINGS,
            ...(snap.data() as Partial<SystemSettings>),
          });
        } else if (targetSchool === DEFAULT_SCHOOL_ID) {
          try {
            const legacySnap = await getDoc(doc(db, 'systemSettings', 'global'));
            if (legacySnap.exists()) {
              onSystemSettings({
                ...DEFAULT_SYSTEM_SETTINGS,
                ...(legacySnap.data() as Partial<SystemSettings>),
              });
              return;
            }
          } catch {
            // Ignore fallback error
          }
          onSystemSettings(DEFAULT_SYSTEM_SETTINGS);
        } else {
          onSystemSettings(DEFAULT_SYSTEM_SETTINGS);
        }
      },
      (err) => onError?.('systemSettings', err)
    )
  );

  // 3. Per-collection scoped real-time listeners
  for (const spec of specs) {
    if (spec.scope === 'none') {
      onCollectionData(spec.collectionName, []);
      continue;
    }

    if (spec.scope === 'own_doc') {
      unsubscribes.push(
        onSnapshot(
          doc(db, spec.collectionName, user.id),
          (snap) => {
            if (snap.exists()) {
              const record = { ...snap.data(), id: snap.id };
              onCollectionData(
                spec.collectionName,
                isSameSchoolRecord(record as { schoolId?: string }, targetSchool) ? [record] : []
              );
            } else {
              onCollectionData(spec.collectionName, []);
            }
          },
          (err) => onError?.(spec.collectionName, err)
        )
      );
      continue;
    }

    const colRef = collection(db, spec.collectionName);
    let qRef;
    const schoolFilter =
      targetSchool !== DEFAULT_SCHOOL_ID ? [where('schoolId', '==', targetSchool)] : [];
    if (spec.scope === 'own_student') {
      qRef =
        spec.collectionName === 'academicRecords'
          ? query(
              colRef,
              where('studentId', '==', user.id),
              where('status', '==', 'published'),
              ...schoolFilter
            )
          : query(colRef, where('studentId', '==', user.id), ...schoolFilter);
    } else if (spec.scope === 'own_borrower') {
      qRef = query(colRef, where('borrowerId', '==', user.id), ...schoolFilter);
    } else if (spec.scope === 'own_requester') {
      qRef = query(colRef, where('requesterId', '==', user.id), ...schoolFilter);
    } else if (!spec.allowLegacyMissingSchoolId) {
      qRef = query(colRef, where('schoolId', '==', targetSchool));
    } else {
      qRef = colRef;
    }

    unsubscribes.push(
      onSnapshot(
        qRef,
        (snap) => {
          const items = snap.docs
            .map((d) => ({ ...d.data(), id: d.id }))
            .filter((item) =>
              isSameSchoolRecord(item as { schoolId?: string }, targetSchool)
            );
          onCollectionData(spec.collectionName, items);
        },
        (err) => onError?.(spec.collectionName, err)
      )
    );
  }

  return () => {
    for (const unsub of unsubscribes) {
      try {
        unsub();
      } catch {
        // Ignore cleanup errors
      }
    }
  };
}

/* ================== EXCEL IMPORT & EXPORT SERVICE ================== */
export function exportToExcel(data: Record<string, unknown>[], fileName: string, sheetName: string = 'Data'): void {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

export async function parseExcelFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/* ================== GOOGLE WORKSPACE SYNC & TEMPLATES SERVICE ================== */
export const DEFAULT_GOOGLE_REPORT_TEMPLATES: GoogleReportTemplate[] = [
  {
    id: 'TPL-DOC-EMULATION',
    name: 'Biên bản Tổng kết Thi đua Học kỳ (Google Docs)',
    description: 'Mẫu văn bản hành chính tự động chèn tên trường, năm học, ngày lập và bảng xếp hạng thi đua.',
    fileType: 'google_doc',
    targetScope: 'emulation',
    templateBody: [
      'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
      'Độc lập - Tự do - Hạnh phúc',
      '',
      'BÁO CÁO TỔNG KẾT THI ĐUA & NỀ NẾP',
      'Đơn vị: {{TEN_TRUONG}}',
      'Năm học: {{NAM_HOC}} | Ngày báo cáo: {{NGAY_BAO_CAO}}',
      'Quy mô: {{TONG_SO_HOC_SINH}} học sinh | {{TONG_SO_LOP}} lớp',
      '',
      'NỘI DUNG TỔNG HỢP',
      '{{NOI_DUNG_BAO_CAO}}',
      '',
      'Người lập báo cáo: {{NGUOI_LAP_BAO_CAO}}',
    ].join('\n'),
    placeholders: [
      '{{TEN_TRUONG}}',
      '{{NAM_HOC}}',
      '{{NGAY_BAO_CAO}}',
      '{{TONG_SO_HOC_SINH}}',
      '{{TONG_SO_LOP}}',
      '{{NOI_DUNG_BAO_CAO}}',
      '{{NGUOI_LAP_BAO_CAO}}',
    ],
    createdBy: 'Hệ thống SchoolHub',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'TPL-DOC-RULES',
    name: 'Quy chế Nội quy Nhà trường (Google Docs)',
    description: 'Xuất bộ tiêu chí nội quy chính thức kèm điểm chuẩn và đối tượng áp dụng.',
    fileType: 'google_doc',
    targetScope: 'rules',
    templateBody: [
      '{{TEN_TRUONG}} - NĂM HỌC {{NAM_HOC}}',
      'VĂN BẢN NỘI QUY & TIÊU CHÍ THI ĐUA CHÍNH THỨC',
      'Ngày ban hành: {{NGAY_BAO_CAO}}',
      '',
      '{{NOI_DUNG_BAO_CAO}}',
    ].join('\n'),
    placeholders: ['{{TEN_TRUONG}}', '{{NAM_HOC}}', '{{NGAY_BAO_CAO}}', '{{NOI_DUNG_BAO_CAO}}'],
    createdBy: 'Hệ thống SchoolHub',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'TPL-SHEET-STANDARD',
    name: 'Bảng Dữ liệu Chuẩn SchoolHub (Google Sheets)',
    description: 'Xuất bảng dữ liệu có hàng tiêu đề đóng băng, bộ lọc tự động và độ rộng cột chuẩn hóa.',
    fileType: 'google_sheet',
    targetScope: 'module_table',
    templateBody: 'Bảng tính {{TEN_TRUONG}} ({{NAM_HOC}}) - Xuất ngày {{NGAY_BAO_CAO}}',
    sheetTabName: 'DuLieu_SchoolHub',
    placeholders: ['{{TEN_TRUONG}}', '{{NAM_HOC}}', '{{NGAY_BAO_CAO}}'],
    createdBy: 'Hệ thống SchoolHub',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
];

export async function getGoogleSyncSources(): Promise<GoogleSyncSource[]> {
  return fetchCollectionRemote<GoogleSyncSource>('googleSyncSources');
}

export async function saveGoogleSyncSource(source: GoogleSyncSource): Promise<void> {
  await upsertDocWithSync('googleSyncSources', 'google_sync_sources', source, true);
}

export async function deleteGoogleSyncSource(id: string): Promise<void> {
  await deleteDocWithSync<GoogleSyncSource>('googleSyncSources', 'google_sync_sources', id);
}

export async function getGoogleSyncHistory(): Promise<GoogleSyncHistoryItem[]> {
  const rows = await fetchCollectionRemote<GoogleSyncHistoryItem>('googleSyncHistory');
  return rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function appendGoogleSyncHistory(item: GoogleSyncHistoryItem): Promise<void> {
  await upsertDocWithSync('googleSyncHistory', 'google_sync_history', item, true);
}

export async function getGoogleDataChangeLogs(): Promise<GoogleDataChangeLog[]> {
  const rows = await fetchCollectionRemote<GoogleDataChangeLog>('googleDataChangeLogs');
  return rows.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function appendGoogleDataChangeLogs(entries: GoogleDataChangeLog[]): Promise<void> {
  if (entries.length === 0) return;
  await upsertBatchWithSync('googleDataChangeLogs', 'google_data_change_logs', entries, true);
}

export async function getGoogleSyncConflicts(): Promise<GoogleSyncConflict[]> {
  const rows = await fetchCollectionRemote<GoogleSyncConflict>('googleSyncConflicts');
  return rows.sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
}

export async function saveGoogleSyncConflict(conflict: GoogleSyncConflict): Promise<void> {
  await upsertDocWithSync('googleSyncConflicts', 'google_sync_conflicts', conflict, true);
}

export async function getGooglePendingDeletions(): Promise<GooglePendingDeletion[]> {
  const rows = await fetchCollectionRemote<GooglePendingDeletion>('googlePendingDeletions');
  return rows.sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
}

export async function saveGooglePendingDeletion(del: GooglePendingDeletion): Promise<void> {
  await upsertDocWithSync('googlePendingDeletions', 'google_pending_deletions', del, true);
}

export async function getGoogleDocProposals(): Promise<GoogleDocProposal[]> {
  const rows = await fetchCollectionRemote<GoogleDocProposal>('googleDocProposals');
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveGoogleDocProposal(proposal: GoogleDocProposal): Promise<void> {
  await upsertDocWithSync('googleDocProposals', 'google_doc_proposals', proposal, true);
}

export async function getGoogleReportTemplates(): Promise<GoogleReportTemplate[]> {
  const rows = await fetchCollectionRemote<GoogleReportTemplate>('googleReportTemplates');
  return rows.length > 0 ? rows : DEFAULT_GOOGLE_REPORT_TEMPLATES;
}

export async function saveGoogleReportTemplate(tpl: GoogleReportTemplate): Promise<void> {
  await upsertDocWithSync('googleReportTemplates', 'google_report_templates', tpl, true);
}

export async function deleteGoogleReportTemplate(id: string): Promise<void> {
  await deleteDocWithSync<GoogleReportTemplate>('googleReportTemplates', 'google_report_templates', id);
}

export function subscribeGoogleWorkspaceCollections(options: {
  schoolId?: string;
  onData: (collectionName: string, items: unknown[]) => void;
  onError?: (collectionName: string, error: Error) => void;
}): () => void {
  const targetSchool = normalizeSchoolId(options.schoolId || getActiveSchoolContext());
  const collections = [
    'googleSyncSources',
    'googleSyncHistory',
    'googleDataChangeLogs',
    'googleSyncConflicts',
    'googlePendingDeletions',
    'googleDocProposals',
    'googleReportTemplates',
  ];
  const unsubs: Unsubscribe[] = [];

  for (const colName of collections) {
    const colRef = collection(db, colName);
    const qRef =
      targetSchool === DEFAULT_SCHOOL_ID
        ? colRef
        : query(colRef, where('schoolId', '==', targetSchool));
    unsubs.push(
      onSnapshot(
        qRef,
        (snap) => {
          const items = snap.docs
            .map((d) => ({ ...d.data(), id: d.id }))
            .filter((item) => isSameSchoolRecord(item as { schoolId?: string }, targetSchool));
          options.onData(colName, items);
        },
        (err) => options.onError?.(colName, err)
      )
    );
  }

  return () => {
    for (const u of unsubs) {
      try {
        u();
      } catch {
        // Ignore
      }
    }
  };
}
