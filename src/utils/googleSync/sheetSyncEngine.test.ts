import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyGoogleApiError } from './errorClassifier';
import { buildMappedPreview, suggestColumnMappings } from './sheetMapping';
import { extractRangeHeaderAndRows, parseRangeStartRow } from './rangeUtils';
import type { SchoolClass, Student } from '../../types';

const SAMPLE_CLASSES: SchoolClass[] = [
  {
    id: 'CLS-10A1',
    code: '10A1',
    name: '10A1',
    grade: 10,
    academicYear: '2026 - 2027',
    room: 'A101',
    homeroomTeacherId: 'GV-01',
    homeroomTeacherName: 'Cô Lan',
    studentCount: 40,
  },
  {
    id: 'CLS-11A1',
    code: '11A1',
    name: '11A1',
    grade: 11,
    academicYear: '2026 - 2027',
    room: 'B201',
    homeroomTeacherId: 'GV-02',
    homeroomTeacherName: 'Thầy Minh',
    studentCount: 38,
  },
];

const EMPTY_STUDENT_DB: {
  students: Student[];
  classes: SchoolClass[];
} = {
  students: [],
  classes: SAMPLE_CLASSES,
};

test('classifyGoogleApiError classifies 401, disabled API, 403, 404 and missing tab accurately', () => {
  const unauth = classifyGoogleApiError(
    401,
    JSON.stringify({ error: { status: 'UNAUTHENTICATED', message: 'Invalid Credentials' } })
  );
  assert.equal(unauth.errorCode, 'TOKEN_EXPIRED');
  assert.equal(unauth.isAuthError, true);

  const apiDisabled = classifyGoogleApiError(
    403,
    JSON.stringify({
      error: {
        status: 'PERMISSION_DENIED',
        errors: [{ reason: 'accessNotConfigured' }],
        message: 'Google Sheets API has not been used in project 123 before or it is disabled.',
      },
    })
  );
  assert.equal(apiDisabled.errorCode, 'API_DISABLED');
  assert.equal(apiDisabled.isAuthError, false);

  const permDenied = classifyGoogleApiError(
    403,
    JSON.stringify({ error: { status: 'PERMISSION_DENIED', message: 'The caller does not have permission' } })
  );
  assert.equal(permDenied.errorCode, 'PERMISSION_DENIED');

  const notFound = classifyGoogleApiError(
    404,
    JSON.stringify({ error: { status: 'NOT_FOUND', message: 'Requested entity was not found.' } })
  );
  assert.equal(notFound.errorCode, 'SPREADSHEET_NOT_FOUND');

  const missingTab = classifyGoogleApiError(
    400,
    JSON.stringify({ error: { message: "Unable to parse range: 'WrongTab'!A1:ZZ" } }),
    { sheetName: 'WrongTab' }
  );
  assert.equal(missingTab.errorCode, 'SHEET_NOT_FOUND');
});

test('buildMappedPreview validates catalog values, Khối -> Lớp dependency, and emits structured rowErrors', () => {
  const headers = [
    'Mã học sinh',
    'Họ và tên',
    'Giới tính',
    'Ngày sinh',
    'Khối',
    'Lớp',
    'Mã thẻ RFID',
    'SĐT phụ huynh',
    'Trạng thái',
  ];
  const mappings = suggestColumnMappings(headers, 'students');

  const rawRows: unknown[][] = [
    ['HS202601', 'Nguyễn Văn A', 'nam', '2010-05-12', '10', '10A1', 'RFID-1001', '0901234567', 'Đang học'],
    ['HS202602', 'Trần Thị B', 'Nữ', '2010-06-15', '10', '11A1', 'RFID-1002', '0901234568', 'Đang học'],
    ['HS202603', 'Lê Văn C', 'Không xác định', '2009-04-20', '11', '11A1', 'RFID-1003', '0901234569', 'Đang học'],
  ];

  const preview = buildMappedPreview({
    moduleKey: 'students',
    fileName: 'Danh sách học sinh',
    sheetName: 'DATA',
    headers,
    rawRows,
    mappings,
    existingRecords: [],
    context: EMPTY_STUDENT_DB,
    importMode: 'only_add',
  });

  assert.equal(preview.report.validCreateCount, 1);
  assert.equal(preview.report.rows[0].normalizedData.gender, 'Nam');
  assert.equal(preview.report.invalidCount, 2);

  const depErr = preview.rowErrors.find((e) => e.rowNumber === 3 && e.field === 'className');
  assert.ok(depErr);
  assert.equal(depErr.parentFieldKey, 'grade');
  assert.equal(depErr.parentValue, '10');
  assert.deepEqual(depErr.allowedValues, ['10A1']);

  const genderErr = preview.rowErrors.find((e) => e.rowNumber === 4 && e.field === 'gender');
  assert.ok(genderErr);
  assert.equal(genderErr.sheetColumn, 'Giới tính');
  assert.ok((genderErr.allowedValues || []).includes('Nam'));
});

test('parseRangeStartRow and extractRangeHeaderAndRows separate headerRow when range starts below header', () => {
  assert.equal(parseRangeStartRow("'HocSinh'!B5:Z100"), 5);
  assert.equal(parseRangeStartRow('A1:ZZ'), 1);
  assert.equal(parseRangeStartRow(undefined), 1);

  const extractedWithSeparateHeader = extractRangeHeaderAndRows({
    allValues: [
      ['HS01', 'Nguyễn An', 'Nam'],
      ['HS02', 'Trần Bình', 'Khác'],
    ],
    headerRow: 1,
    rangeUsed: "'HocSinh'!A2:C10",
    explicitHeaderRowValues: ['Mã HS', 'Họ và tên', 'Giới tính'],
  });
  assert.deepEqual(extractedWithSeparateHeader.headers, ['Mã HS', 'Họ và tên', 'Giới tính']);
  assert.equal(extractedWithSeparateHeader.rawRows.length, 2);
  assert.equal(extractedWithSeparateHeader.rawRows[1][2], 'Khác');

  const extractedCombined = extractRangeHeaderAndRows({
    allValues: [
      ['Mã HS', 'Họ và tên', 'Giới tính'],
      ['HS01', 'Nguyễn An', 'Nam'],
    ],
    headerRow: 1,
    rangeUsed: 'A1:C10',
  });
  assert.deepEqual(extractedCombined.headers, ['Mã HS', 'Họ và tên', 'Giới tính']);
  assert.equal(extractedCombined.rawRows.length, 1);
});

test('buildMappedPreview detects Tổ chuyên môn -> Bộ môn mismatch for teachers', () => {
  const headers = ['Họ và tên', 'Email', 'Số điện thoại', 'Tổ chuyên môn', 'Bộ môn'];
  const mappings = suggestColumnMappings(headers, 'teachers');
  const preview = buildMappedPreview({
    moduleKey: 'teachers',
    fileName: 'GiaoVien.gsheet',
    sheetName: 'GV',
    headers,
    rawRows: [
      ['Nguyễn Văn T', 't@schoolhub.edu.vn', '0901234567', 'Tổ Toán - Tin', 'Toán học'],
      ['Trần Thị L', 'l@schoolhub.edu.vn', '0901234568', 'Tổ Toán - Tin', 'Vật lí'],
    ],
    mappings,
    existingRecords: [],
    importMode: 'only_add',
  });

  assert.equal(preview.report.validCreateCount, 1);
  assert.equal(preview.report.invalidCount, 1);
  const subErr = preview.rowErrors.find((e) => e.rowNumber === 3 && e.field === 'subject');
  assert.ok(subErr);
  assert.equal(subErr.parentFieldKey, 'department');
  assert.equal(subErr.parentValue, 'Tổ Toán - Tin');
  assert.deepEqual(subErr.allowedValues, ['Toán học', 'Tin học']);
});


