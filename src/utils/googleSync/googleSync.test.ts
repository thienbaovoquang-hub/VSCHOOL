import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMappedPreview,
  detectFormulaCells,
  detectPrimaryKeyField,
  suggestColumnMappings,
} from './sheetMapping';
import {
  computeIncrementalSyncPlan,
  prepareSheetExportMatrix,
  resolveConflictRecord,
} from './diffEngine';
import {
  diffDocTexts,
  extractStructuredGoogleDoc,
  extractTemplatePlaceholders,
  interpolateReportTemplate,
} from './docsParser';
import { getSchemaByKey } from '../importExport/schemas';

test('suggestColumnMappings matches Vietnamese diacritic headers & protects against forcing teacherCode', () => {
  const stuMappings = suggestColumnMappings(
    ['Ma hoc sinh', 'Ho va ten', 'Lop', 'So dien thoai phu huynh', 'Cot Khong Lien Quan XYZ'],
    'students'
  );
  assert.equal(stuMappings[0].targetFieldKey, 'studentCode');
  assert.equal(stuMappings[1].targetFieldKey, 'fullName');
  assert.equal(stuMappings[2].targetFieldKey, 'className');
  assert.equal(stuMappings[3].targetFieldKey, 'parentPhone');
  assert.equal(stuMappings[4].targetFieldKey, '');

  const teacherSchema = getSchemaByKey('teachers');
  const teacherPk = detectPrimaryKeyField(teacherSchema);
  assert.equal(teacherPk, 'email');
  assert.notEqual(teacherPk, 'teacherCode');
});

test('detectFormulaCells identifies formula columns cleanly', () => {
  const protection = detectFormulaCells(
    [
      ['HS001', 'Nguyễn An', '=AVERAGE(D2:E2)'],
      ['HS002', 'Trần Bình', '8.5'],
    ],
    ['Mã HS', 'Họ tên', 'Điểm TB']
  );
  assert.deepEqual(protection.formulaColumns, ['Điểm TB']);
  assert.equal(protection.formulaCells.length, 1);
  assert.equal(protection.formulaCells[0].formula, '=AVERAGE(D2:E2)');
});

test('buildMappedPreview validates rows against schema and distinguishes create vs update vs invalid vs duplicate', () => {
  const existingStudents = [
    {
      id: 'HS2026001',
      studentCode: 'HS2026001',
      fullName: 'Nguyễn Văn An',
      className: '10A1',
      grade: 10,
      rfidCardId: 'RFID-001',
      dateOfBirth: '2010-05-10',
      gender: 'Nam',
      parentPhone: '0912345678',
      address: 'Hà Nội',
      status: 'Đang học',
      conduct: 'Tốt',
    },
  ];

  const headers = ['Mã học sinh', 'Họ tên', 'Lớp', 'Khối', 'Mã thẻ RFID', 'Ngày sinh', 'Giới tính', 'SĐT PH', 'Địa chỉ'];
  const mappings = suggestColumnMappings(headers, 'students');
  const mapByIdx = (idx: number, key: string) => {
    mappings[idx] = { sheetColumn: headers[idx], sheetColIndex: idx, targetFieldKey: key, ignored: false };
  };
  mapByIdx(0, 'studentCode');
  mapByIdx(1, 'fullName');
  mapByIdx(2, 'className');
  mapByIdx(3, 'grade');
  mapByIdx(4, 'rfidCardId');
  mapByIdx(5, 'dateOfBirth');
  mapByIdx(6, 'gender');
  mapByIdx(7, 'parentPhone');
  mapByIdx(8, 'address');

  const preview = buildMappedPreview({
    moduleKey: 'students',
    fileName: 'DanhSachHS.gsheet',
    sheetName: 'HocSinh',
    headers,
    rawRows: [
      ['HS2026001', 'Nguyễn Văn An', '10A1', '10', 'RFID-001', '2010-05-10', 'Nam', '0912345678', 'TP.HCM'], // update
      ['HS2026002', 'Lê Thị Hoa', '10A2', '10', 'RFID-002', '2010-08-20', 'Nữ', '0987654321', 'Đà Nẵng'], // create
      ['HS2026002', 'Lê Thị Hoa Trùng', '10A2', '10', 'RFID-002B', '2010-08-20', 'Nữ', '0987654321', 'Huế'], // duplicate
      ['HS2026003', 'Phạm Lỗi', '10A3', '10', 'RFID-003', 'not-a-date', 'Nam', '12', 'Cần Thơ'], // invalid
    ],
    mappings,
    primaryKeyField: 'studentCode',
    existingRecords: existingStudents,
    importMode: 'update_existing',
  });

  assert.equal(preview.report.totalRows, 4);
  assert.equal(preview.report.validUpdateCount, 1);
  assert.equal(preview.report.validCreateCount, 1);
  assert.equal(preview.report.duplicateCount, 1);
  assert.equal(preview.report.invalidCount, 1);
});

test('computeIncrementalSyncPlan detects partial updates, concurrent conflicts, and missing-row deletion flags', () => {
  const existing = [
    {
      id: 'HS01',
      studentCode: 'HS01',
      fullName: 'Nguyễn An',
      className: '10A1',
      parentPhone: '0901112222', // changed locally in SchoolHub since baseline!
    },
    {
      id: 'HS02',
      studentCode: 'HS02',
      fullName: 'Trần Bình',
      className: '10A1',
      parentPhone: '0903334444',
    },
  ];

  const lastSyncedMap = {
    HS01: {
      hash: 'className=10A1|fullName=Nguyễn An|parentPhone=0900000000|studentCode=HS01',
      updatedAt: '2026-09-01T00:00:00.000Z',
      fields: {
        studentCode: 'HS01',
        fullName: 'Nguyễn An',
        className: '10A1',
        parentPhone: '0900000000',
      },
    },
    HS02: {
      hash: 'className=10A1|fullName=Trần Bình|parentPhone=0903334444|studentCode=HS02',
      updatedAt: '2026-09-01T00:00:00.000Z',
      fields: {
        studentCode: 'HS02',
        fullName: 'Trần Bình',
        className: '10A1',
        parentPhone: '0903334444',
      },
    },
  };

  // HS01 also changed phone in Google Sheet -> conflict!
  // HS02 disappeared from Sheet -> flag_review!
  // HS03 is brand new -> toCreate!
  const plan = computeIncrementalSyncPlan({
    sourceId: 'SRC-1',
    fileName: 'Students Sheet',
    moduleKey: 'students',
    primaryKeyField: 'studentCode',
    mappedFieldKeys: ['studentCode', 'fullName', 'className', 'parentPhone'],
    incomingValidRows: [
      {
        rowNumber: 2,
        key: 'HS01',
        rawMappedByField: { studentCode: 'HS01', fullName: 'Nguyễn An', className: '10A1', parentPhone: '0999888777' },
        normalizedData: { studentCode: 'HS01', fullName: 'Nguyễn An', className: '10A1', parentPhone: '0999888777' },
        existingRecord: existing[0],
      },
      {
        rowNumber: 3,
        key: 'HS03',
        rawMappedByField: { studentCode: 'HS03', fullName: 'Võ Minh', className: '10A2', parentPhone: '0911223344' },
        normalizedData: { studentCode: 'HS03', fullName: 'Võ Minh', className: '10A2', parentPhone: '0911223344' },
      },
    ],
    existingRecords: existing,
    lastSyncedMap,
    conflictPolicy: 'manual_review',
    deletionPolicy: 'flag_review',
  });

  assert.equal(plan.conflicts.length, 1);
  assert.equal(plan.conflicts[0].recordKey, 'HS01');
  assert.equal(plan.flaggedDeletions.length, 1);
  assert.equal(plan.flaggedDeletions[0].recordKey, 'HS02');
  assert.equal(plan.toCreate.length, 1);
  assert.equal(plan.toCreate[0].key, 'HS03');

  const resolvedSheet = resolveConflictRecord(plan.conflicts[0], 'sheet');
  assert.equal(resolvedSheet.parentPhone, '0999888777');
});

test('prepareSheetExportMatrix preserves formula cells when updating existing spreadsheet', () => {
  const matrix = prepareSheetExportMatrix({
    moduleKey: 'students',
    records: [
      { id: 'HS01', studentCode: 'HS01', fullName: 'Nguyễn An Mới', className: '10A2', grade: 10 },
      { id: 'HS02', studentCode: 'HS02', fullName: 'Trần Bình', className: '10A1', grade: 10 },
    ],
    selectedFieldKeys: ['studentCode', 'fullName', 'className', 'grade'],
    existingSheetValues: [
      ['Mã học sinh *', 'Họ và tên *', 'Lớp *', 'Khối *'],
      ['HS01', 'Nguyễn An Cũ', '10A1', '10'],
    ],
    existingFormulaValues: [
      ['Mã học sinh *', 'Họ và tên *', 'Lớp *', 'Khối *'],
      ['HS01', 'Nguyễn An Cũ', '10A1', '=LEFT(C2,2)'],
    ],
    primaryKeyField: 'studentCode',
  });

  assert.equal(matrix.preservedFormulaCellCount, 1);
  assert.equal(matrix.rows.length, 2);
  assert.equal(matrix.rows[0][1], 'Nguyễn An Mới');
  assert.equal(matrix.rows[0][3], '=LEFT(C2,2)');
  assert.equal(matrix.rows[1][0], 'HS02');
});

test('extractStructuredGoogleDoc, diffDocTexts, and interpolateReportTemplate handle structured Docs cleanly', () => {
  const fakeDocApiPayload = {
    documentId: 'doc-123',
    title: 'Nội quy SchoolHub 2026',
    revisionId: 'rev-5',
    body: {
      content: [
        {
          paragraph: {
            paragraphStyle: { namedStyleType: 'HEADING_1' },
            elements: [{ textRun: { content: 'Điều 1. Chuyên cần\n' } }],
          },
        },
        {
          paragraph: {
            bullet: { listId: 'list-1' },
            elements: [{ textRun: { content: 'Đi học trễ quá 10 phút (-2 điểm)\n' } }],
          },
        },
        {
          table: {
            tableRows: [
              {
                tableCells: [
                  { content: [{ paragraph: { elements: [{ textRun: { content: 'Hành vi\n' } }] } }] },
                  { content: [{ paragraph: { elements: [{ textRun: { content: 'Điểm\n' } }] } }] },
                ],
              },
            ],
          },
        },
      ],
    },
  };

  const parsed = extractStructuredGoogleDoc(fakeDocApiPayload);
  assert.equal(parsed.title, 'Nội quy SchoolHub 2026');
  assert.equal(parsed.tableCount, 1);
  assert.ok(parsed.plainText.includes('# Điều 1. Chuyên cần'));
  assert.ok(parsed.plainText.includes('- Đi học trễ quá 10 phút (-2 điểm)'));

  const diffs = diffDocTexts('Điều 1: Cũ\nĐiều 2: Giữ nguyên', 'Điều 1: Mới\nĐiều 2: Giữ nguyên');
  assert.equal(diffs.filter((d) => d.type === 'removed').length, 1);
  assert.equal(diffs.filter((d) => d.type === 'added').length, 1);

  const placeholders = extractTemplatePlaceholders('{{TEN_TRUONG}} - {{NAM_HOC}}');
  assert.deepEqual(placeholders, ['{{TEN_TRUONG}}', '{{NAM_HOC}}']);

  const filled = interpolateReportTemplate('Báo cáo {{TEN_TRUONG}} ({{TONG_SO_HOC_SINH}} HS)', {
    TEN_TRUONG: 'THPT SchoolHub',
    TONG_SO_HOC_SINH: 1200,
  });
  assert.equal(filled, 'Báo cáo THPT SchoolHub (1200 HS)');
});
