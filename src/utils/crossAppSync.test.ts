import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDateTimeSafe,
  createMaintenanceFromFeedback,
  syncAssetAfterMaintenance,
  validateBackupPayload,
} from './crossAppSync';

test('formatDateTimeSafe handles valid ISO timestamps cleanly without Invalid Date', () => {
  const formatted = formatDateTimeSafe('2026-11-13T10:30:00.000Z');
  assert.equal(formatted.includes('Invalid'), false);
  assert.ok(formatted.includes('2026'));
  assert.equal(formatDateTimeSafe('13/11/2026 17:30'), '13/11/2026 17:30');
});

test('createMaintenanceFromFeedback creates ticket only for facility category', () => {
  const facilityTicket = createMaintenanceFromFeedback({
    id: 'FB-1',
    reportCode: 'FB-2026-001',
    title: 'Máy chiếu mờ',
    category: 'Cơ sở vật chất',
    content: 'Bóng đèn yếu',
    location: 'Phòng B301',
    priority: 'high',
    isAnonymous: false,
    studentId: 'S1',
    studentName: 'An',
    studentClass: '11A1',
    status: 'submitted',
    createdAt: '2026-11-13T08:00:00Z',
    updatedAt: '2026-11-13T08:00:00Z',
  });
  assert.ok(facilityTicket);
  assert.equal(facilityTicket?.linkedFeedbackId, 'FB-1');
  assert.equal(facilityTicket?.roomLocation, 'Phòng B301');

  const academicFeedback = createMaintenanceFromFeedback({
    id: 'FB-2',
    reportCode: 'FB-2026-002',
    title: 'Đề nghị thêm giờ ôn',
    category: 'Kiến nghị đào tạo',
    content: '...',
    location: '11A1',
    priority: 'low',
    isAnonymous: true,
    studentId: 'ANON',
    studentName: 'Ẩn danh',
    studentClass: '11A1',
    status: 'submitted',
    createdAt: '2026-11-13T08:00:00Z',
    updatedAt: '2026-11-13T08:00:00Z',
  });
  assert.equal(academicFeedback, null);
});

test('syncAssetAfterMaintenance updates linked FacilityAsset condition on completion', () => {
  const assets = [
    {
      id: 'FAC-1',
      code: 'DEV-01',
      name: 'Máy chiếu Epson',
      category: 'Thiết bị trình chiếu' as const,
      roomLocation: 'B301',
      condition: 'Hỏng hóc' as const,
      status: 'Đang sửa chữa' as const,
      lastInspected: '2026-11-01',
    },
  ];
  const updated = syncAssetAfterMaintenance(assets, {
    id: 'MNT-1',
    requestCode: 'MNT-001',
    assetId: 'FAC-1',
    assetName: 'Máy chiếu Epson',
    roomLocation: 'B301',
    reportedBy: 'GV',
    reporterRole: 'teacher',
    issueDescription: 'Không lên nguồn',
    priority: 'high',
    status: 'completed',
    reportedAt: '2026-11-10',
  });
  assert.ok(updated);
  assert.equal(updated?.condition, 'Tốt');
  assert.equal(updated?.status, 'Đang sử dụng');
});

test('validateBackupPayload rejects malformed JSON and accepts valid backup object', () => {
  assert.equal(validateBackupPayload(null).valid, false);
  assert.equal(validateBackupPayload({ foo: 'bar' }).valid, false);
  const ok = validateBackupPayload({ version: 1, data: { students: [], books: [] } });
  assert.equal(ok.valid, true);
  assert.equal(ok.collectionsCount, 2);
});
