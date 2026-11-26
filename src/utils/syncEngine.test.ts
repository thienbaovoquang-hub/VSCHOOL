import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SCHOOL_ID,
  LEGACY_EXTERNAL_DATASETS_KEY,
  buildLegacyMigrationSummary,
  buildPartialUpdatePayload,
  dedupById,
  getCollectionSubscriptionSpecs,
  isSameSchoolRecord,
  isValidFirestoreDocId,
  mergeRecordsById,
  normalizeInviteDocId,
  normalizeSchoolId,
  resolveConcurrentUpdate,
  withSyncMetadata,
} from './syncEngine';
import type { UserProfile } from '../types';

test('normalizeSchoolId and normalizeInviteDocId always produce Firestore-safe IDs', () => {
  assert.equal(normalizeSchoolId(undefined), DEFAULT_SCHOOL_ID);
  assert.equal(normalizeSchoolId('  THPT Chu Văn An '), 'THPT_Chu_V_n_An');
  assert.equal(isValidFirestoreDocId(normalizeSchoolId('school_01')), true);

  const invId = normalizeInviteDocId('  GiaoVien.A+test@SchoolHub.edu.vn ');
  assert.equal(isValidFirestoreDocId(invId), true);
  assert.equal(invId, 'INV_giaovien.a_test_schoolhub.edu.vn');
});

test('isSameSchoolRecord isolates schools while preserving legacy schoolhub_main docs missing schoolId', () => {
  assert.equal(isSameSchoolRecord({ schoolId: undefined }, DEFAULT_SCHOOL_ID), true);
  assert.equal(isSameSchoolRecord({}, 'school_other'), false);
  assert.equal(isSameSchoolRecord({ schoolId: 'school_other' }, 'school_other'), true);
  assert.equal(isSameSchoolRecord({ schoolId: 'schoolhub_main' }, 'school_other'), false);
});

test('withSyncMetadata and buildPartialUpdatePayload track version, schoolId, and changed fields only', () => {
  const created = withSyncMetadata(
    { id: 'STU-01', fullName: 'Nguyễn Văn A', className: '10A1', phone: '0901' },
    { schoolId: 'schoolhub_main', actorUid: 'uid-admin', nowIso: '2026-11-14T08:00:00.000Z' }
  );
  assert.equal(created.schoolId, DEFAULT_SCHOOL_ID);
  assert.equal(created.version, 1);
  assert.equal(created.createdBy, 'uid-admin');
  assert.equal(created.updatedBy, 'uid-admin');

  const patch = buildPartialUpdatePayload(
    created,
    { ...created, phone: '0909' },
    { actorUid: 'uid-principal', nowIso: '2026-11-14T09:00:00.000Z' }
  );
  assert.equal(patch.phone, '0909');
  assert.equal('fullName' in patch, false);
  assert.equal('className' in patch, false);
  assert.equal(patch.version, 2);
  assert.equal(patch.updatedBy, 'uid-principal');
  assert.equal(patch.schoolId, DEFAULT_SCHOOL_ID);
});

test('resolveConcurrentUpdate merges non-overlapping edits cleanly and flags same-field conflicts', () => {
  const base = {
    id: 'STU-01',
    fullName: 'Nguyễn Văn A',
    phone: '0901',
    address: 'Hà Nội',
    version: 1,
  };
  const serverUpdatedAddress = {
    ...base,
    address: 'TP.HCM',
    version: 2,
  };
  const localUpdatedPhone = {
    ...base,
    phone: '0999',
  };

  const merged = resolveConcurrentUpdate(base, localUpdatedPhone, serverUpdatedAddress);
  assert.equal(merged.status, 'auto_merged');
  assert.equal(merged.conflictingFields.length, 0);
  assert.equal(merged.mergedRecord.address, 'TP.HCM');
  assert.equal(merged.mergedRecord.phone, '0999');

  const serverUpdatedPhone = {
    ...base,
    phone: '0888',
    version: 2,
  };
  const conflict = resolveConcurrentUpdate(base, localUpdatedPhone, serverUpdatedPhone);
  assert.equal(conflict.status, 'conflict');
  assert.equal(conflict.conflictingFields.length, 1);
  assert.equal(conflict.conflictingFields[0].field, 'phone');
  assert.equal(conflict.conflictingFields[0].localValue, '0999');
  assert.equal(conflict.conflictingFields[0].serverValue, '0888');
});

test('getCollectionSubscriptionSpecs isolates confidential counseling and scopes student subscriptions', () => {
  const adminUser: UserProfile = {
    id: 'uid-admin',
    email: 'admin@school.vn',
    displayName: 'Admin',
    role: 'admin',
    schoolId: DEFAULT_SCHOOL_ID,
  };
  const adminSpecs = new Map(
    getCollectionSubscriptionSpecs(adminUser).map((s) => [s.collectionName, s.scope])
  );
  assert.equal(adminSpecs.get('studentProfiles'), 'full_school');
  assert.equal(adminSpecs.get('userInvites'), 'full_school');
  assert.equal(adminSpecs.get('counselingRequests'), 'none');

  const counselorUser: UserProfile = {
    ...adminUser,
    role: 'counselor',
  };
  const counselorSpecs = new Map(
    getCollectionSubscriptionSpecs(counselorUser).map((s) => [s.collectionName, s.scope])
  );
  assert.equal(counselorSpecs.get('counselingRequests'), 'counselor_only');
  assert.equal(counselorSpecs.get('userInvites'), 'none');

  const studentUser: UserProfile = {
    id: 'uid-stu',
    email: 'stu@school.vn',
    displayName: 'Học sinh',
    role: 'student',
    schoolId: DEFAULT_SCHOOL_ID,
  };
  const studentSpecs = new Map(
    getCollectionSubscriptionSpecs(studentUser).map((s) => [s.collectionName, s.scope])
  );
  assert.equal(studentSpecs.get('users'), 'own_doc');
  assert.equal(studentSpecs.get('studentProfiles'), 'own_doc');
  assert.equal(studentSpecs.get('borrowTransactions'), 'own_student');
  assert.equal(studentSpecs.get('academicRecords'), 'own_student');
  assert.equal(studentSpecs.get('counselingRequests'), 'own_student');
  assert.equal(studentSpecs.get('staffMembers'), 'none');
  assert.equal(studentSpecs.get('auditLogs'), 'none');
});

test('buildLegacyMigrationSummary scans localStorage keys, deduplicates by id, and handles externalDatasets', () => {
  const storage = new Map<string, string>([
    [
      'schoolhub_clean_db_students',
      JSON.stringify([
        { id: 'STU-1', fullName: 'An' },
        { id: 'STU-2', fullName: 'Bình' },
      ]),
    ],
    [
      LEGACY_EXTERNAL_DATASETS_KEY,
      JSON.stringify([{ code: 'KPI-01', name: 'Chỉ tiêu tốt nghiệp', value: 98 }]),
    ],
  ]);

  const summary = buildLegacyMigrationSummary(
    (k) => storage.get(k) || null,
    { studentProfiles: [{ id: 'STU-1', fullName: 'An' }] }
  );
  assert.equal(summary.legacyKeysFound.length, 2);
  assert.equal(summary.totalLocalRecords, 3);
  assert.equal(summary.totalDuplicateRecords, 1);
  assert.equal(summary.totalNewRecords, 2);
  const extStat = summary.collections.find((c) => c.collectionName === 'externalDatasets');
  assert.ok(extStat);
  assert.equal(extStat.itemsToUpload[0].id, 'EXT-KPI-01');
});

test('dedupById and mergeRecordsById eliminate duplicate React keys from onSnapshot vs optimistic prepend races', () => {
  const dupedSnapshot = [
    { id: 'log_1', action: 'Old' },
    { id: 'log_2', action: 'New' },
    { id: 'log_1', action: 'Updated' },
  ];
  const deduped = dedupById(dupedSnapshot);
  assert.equal(deduped.length, 2);
  assert.equal(deduped.find((x) => x.id === 'log_1')?.action, 'Updated');

  // Simulate Firestore onSnapshot hydrating prev BEFORE post-await optimistic prepend executes
  const newLog = { id: 'log_1794678136001_qtsc', action: 'Đăng nhập', target: 'Admin' };
  const snapshotAlreadyHydratedPrev = [newLog, { id: 'log_prev', action: 'Earlier' }];
  const afterOptimisticMerge = mergeRecordsById(snapshotAlreadyHydratedPrev, [newLog]);
  assert.equal(afterOptimisticMerge.length, 2);
  assert.equal(
    afterOptimisticMerge.filter((x) => x.id === 'log_1794678136001_qtsc').length,
    1
  );

  // Batch prepend preserves order without duplicating existing IDs
  const batchMerged = mergeRecordsById(
    [{ id: 'b2', label: 'old-b2' }, { id: 'b1', label: 'b1' }],
    [{ id: 'b3', label: 'b3' }, { id: 'b2', label: 'new-b2' }]
  );
  assert.deepEqual(
    batchMerged.map((x) => `${x.id}:${x.label}`),
    ['b3:b3', 'b2:new-b2', 'b1:b1']
  );
});
