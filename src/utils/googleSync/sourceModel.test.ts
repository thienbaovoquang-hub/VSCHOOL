import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { GoogleSyncSource } from '../../types';
import {
  buildAutoMappingsFromHeaders,
  buildTemplateDocPayload,
  buildTemplateSheetPayload,
  formatSyncIntervalLabel,
  getExpectedGoogleFileTypeForModule,
  getFixedSourceForModule,
  getTargetModuleAppId,
  getTargetModuleTitle,
  isDocumentModule,
  normalizeFixedSourcesPerModule,
  replaceFixedModuleSource,
} from './sourceModel';

function makeSource(overrides: Partial<GoogleSyncSource>): GoogleSyncSource {
  return {
    id: 'SRC-1',
    fileId: 'file-1',
    fileName: 'Danh sách Học sinh',
    fileType: 'google_sheet',
    mimeType: 'application/vnd.google-apps.spreadsheet',
    webViewLink: 'https://docs.google.com/spreadsheets/d/file-1/edit',
    permissionLevel: 'read_write',
    canEdit: true,
    targetModule: 'students',
    superAppId: 'school',
    syncDirection: 'bidirectional',
    conflictPolicy: 'manual_review',
    deletionPolicy: 'flag_review',
    syncMode: 'realtime',
    syncIntervalMinutes: 15,
    errorPolicy: 'only_valid',
    paused: false,
    status: 'connected',
    primaryKeyField: 'studentCode',
    mappings: [],
    linkedBy: 'Admin',
    linkedByRole: 'admin',
    linkedAt: '2026-10-01T08:00:00.000Z',
    ...overrides,
  };
}

describe('Google Sync Simplified Fixed-Source Model', () => {
  it('classifies document modules vs tabular sheet modules accurately', () => {
    assert.equal(isDocumentModule('rules_doc'), true);
    assert.equal(isDocumentModule('school_plan'), true);
    assert.equal(isDocumentModule('library_guide'), true);
    assert.equal(isDocumentModule('report_doc'), true);
    assert.equal(isDocumentModule('students'), false);
    assert.equal(isDocumentModule('teachers'), false);
    assert.equal(isDocumentModule('books'), false);

    assert.equal(getExpectedGoogleFileTypeForModule('rules_doc'), 'google_doc');
    assert.equal(getExpectedGoogleFileTypeForModule('students'), 'google_sheet');
    assert.equal(getExpectedGoogleFileTypeForModule('teachers'), 'google_sheet');

    assert.equal(getTargetModuleAppId('rules_doc'), 'school');
    assert.equal(getTargetModuleAppId('students'), 'school');
    assert.equal(getTargetModuleAppId('books'), 'library');
    assert.ok(getTargetModuleTitle('rules_doc').includes('Nội quy'));
    assert.ok(getTargetModuleTitle('students').length > 0);
  });

  it('normalizes strictly 1 fixed Google source per targetModule with 1-way Google -> SchoolHub sync', () => {
    const older = makeSource({
      id: 'SRC-OLD',
      fileId: 'old-sheet',
      fileName: 'Old Students Sheet',
      targetModule: 'students',
      linkedAt: '2026-09-01T08:00:00.000Z',
      lastSyncAt: '2026-09-05T08:00:00.000Z',
    });
    const newer = makeSource({
      id: 'SRC-NEW',
      fileId: 'new-sheet',
      fileName: 'New Students Sheet',
      targetModule: 'students',
      linkedAt: '2026-10-01T08:00:00.000Z',
      lastSyncAt: '2026-10-10T08:00:00.000Z',
    });
    const rulesSrc = makeSource({
      id: 'SRC-RULES',
      fileId: 'doc-rules',
      fileName: 'Nội quy Trường',
      fileType: 'google_doc',
      mimeType: 'application/vnd.google-apps.document',
      targetModule: 'rules_doc',
      superAppId: 'school',
      linkedAt: '2026-10-02T08:00:00.000Z',
    });

    const normalized = normalizeFixedSourcesPerModule([older, newer, rulesSrc]);
    assert.equal(normalized.length, 2, 'Must keep strictly 1 source per module');

    const fixedStudents = getFixedSourceForModule(normalized, 'students');
    assert.ok(fixedStudents);
    assert.equal(fixedStudents.id, 'SRC-NEW');
    assert.equal(fixedStudents.syncDirection, 'sheets_to_schoolhub');
    assert.equal(fixedStudents.deletionPolicy, 'ignore');
    assert.equal(fixedStudents.conflictPolicy, 'sheets_wins');

    const fixedRules = getFixedSourceForModule(normalized, 'rules_doc');
    assert.ok(fixedRules);
    assert.equal(fixedRules.id, 'SRC-RULES');
    assert.equal(fixedRules.syncDirection, 'sheets_to_schoolhub');
  });

  it('replaces an existing linked module source while preserving other modules', () => {
    const s1 = makeSource({ id: 'SRC-1', targetModule: 'students' });
    const s2 = makeSource({ id: 'SRC-2', targetModule: 'books', superAppId: 'library' });
    const replacement = makeSource({
      id: 'SRC-3',
      fileId: 'sheet-3',
      fileName: 'Học sinh Chính thức',
      targetModule: 'students',
    });

    const { nextSources, replacedSourceIds } = replaceFixedModuleSource([s1, s2], replacement);
    assert.deepEqual(replacedSourceIds, ['SRC-1']);
    assert.equal(nextSources.length, 2);
    assert.equal(nextSources[0].id, 'SRC-3');
    assert.equal(nextSources[0].syncDirection, 'sheets_to_schoolhub');
    assert.equal(nextSources[1].id, 'SRC-2');
  });

  it('auto-maps Vietnamese headers and detects missing required headers', () => {
    const partial = buildAutoMappingsFromHeaders('students', ['Mã học sinh', 'Họ và tên']);
    assert.equal(partial.primaryKeyField, 'studentCode');
    assert.equal(partial.mappings[0].targetFieldKey, 'studentCode');
    assert.equal(partial.mappings[1].targetFieldKey, 'fullName');
    assert.ok(partial.missingRequiredHeaders.length > 0);

    const books = buildAutoMappingsFromHeaders('books', buildTemplateSheetPayload('books').headers);
    assert.equal(books.primaryKeyField, 'bookCode');
    assert.equal(books.missingRequiredHeaders.length, 0);

    const teachers = buildAutoMappingsFromHeaders('teachers', buildTemplateSheetPayload('teachers').headers);
    assert.equal(teachers.primaryKeyField, 'email');
    assert.equal(teachers.missingRequiredHeaders.length, 0);
  });

  it('builds structured sheet & document template payloads and Vietnamese interval labels', () => {
    const sheetPayload = buildTemplateSheetPayload('students');
    assert.equal(sheetPayload.sheetName, 'DATA');
    assert.ok(sheetPayload.headers.includes('Mã học sinh *'));
    assert.equal(sheetPayload.rows.length, 0);

    const rulesPayload = buildTemplateDocPayload('rules_doc', 'THPT Lê Quý Đôn', '2026 - 2027');
    assert.ok(rulesPayload.title.includes('THPT Lê Quý Đôn'));
    assert.ok(rulesPayload.sections.length >= 3);
    assert.ok(rulesPayload.sections[0].paragraphs?.some((p) => p.includes('2026 - 2027')));

    const genericDoc = buildTemplateDocPayload('school_plan', 'THPT Chu Văn An', '2026 - 2027');
    assert.ok(genericDoc.title.includes('Kế hoạch Nhà trường'));
    assert.equal(genericDoc.sections.length, 1);

    assert.equal(formatSyncIntervalLabel('realtime', 15), 'Tự động');
    assert.equal(formatSyncIntervalLabel('manual', 15), 'Thủ công');
    assert.equal(formatSyncIntervalLabel('scheduled', 15), 'Định kỳ (15 phút)');
    assert.equal(formatSyncIntervalLabel('scheduled', 60), 'Định kỳ (1 giờ)');
  });
});
