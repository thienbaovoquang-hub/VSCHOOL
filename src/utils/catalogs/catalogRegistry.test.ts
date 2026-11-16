import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSheetValidationColumnsForModule,
  countCatalogValueUsage,
  DEFAULT_DATA_CATALOGS,
  mergeDataCatalogs,
  normalizeCatalogInputValue,
  resolveCatalogOptions,
  sanitizeFirestoreDocId,
  validateDependentFieldValue,
} from './catalogRegistry';
import { MODULE_SCHEMAS } from '../importExport/schemas';
import type { SchoolClass } from '../../types';

const SAMPLE_CLASSES: SchoolClass[] = [
  {
    id: 'CLS-10A1',
    code: '10A1',
    name: '10A1',
    grade: 10,
    academicYear: '2026 - 2027',
    homeroomTeacherId: 'T1',
    homeroomTeacherName: 'Nguyễn Văn A',
    room: 'P.101',
    studentCount: 40,
  },
  {
    id: 'CLS-11A1',
    code: '11A1',
    name: '11A1',
    grade: 11,
    academicYear: '2026 - 2027',
    homeroomTeacherId: 'T2',
    homeroomTeacherName: 'Trần Thị B',
    room: 'P.201',
    studentCount: 38,
  },
];

test('mergeDataCatalogs preserves defaults and overlays custom admin catalogs', () => {
  const customBook = {
    ...DEFAULT_DATA_CATALOGS.find((c) => c.id === 'book_category')!,
    options: [
      { id: 'sci', value: 'Khoa học tự nhiên', label: 'Khoa học tự nhiên', order: 1, active: true },
      { id: 'new_cat', value: 'STEM & Robotics', label: 'STEM & Robotics', order: 2, active: true },
    ],
  };

  const merged = mergeDataCatalogs([customBook]);
  const bookCat = merged.find((c) => c.id === 'book_category');
  assert.ok(bookCat);
  assert.equal(bookCat.options.length, 2);
  assert.equal(bookCat.options[1].value, 'STEM & Robotics');
  assert.ok(merged.some((c) => c.id === 'student_gender'));
});

test('resolveCatalogOptions filters dependent classes by grade and excludes inactive options by default', () => {
  const grade10Classes = resolveCatalogOptions({
    lookupCatalog: 'classes',
    parentValue: '10',
    runtime: { classes: SAMPLE_CLASSES },
  });
  assert.deepEqual(
    grade10Classes.map((o) => o.value),
    ['10A1']
  );

  const grade11Classes = resolveCatalogOptions({
    lookupCatalog: 'classes',
    parentValue: '11',
    runtime: { classes: SAMPLE_CLASSES },
  });
  assert.deepEqual(
    grade11Classes.map((o) => o.value),
    ['11A1']
  );

  const customGender = {
    ...DEFAULT_DATA_CATALOGS.find((c) => c.id === 'student_gender')!,
    options: [
      { id: 'nam', value: 'Nam', label: 'Nam', order: 1, active: true },
      { id: 'nu', value: 'Nữ', label: 'Nữ', order: 2, active: false },
    ],
  };
  const activeOnly = resolveCatalogOptions({
    catalogId: 'student_gender',
    runtime: { dataCatalogs: [customGender] },
  });
  assert.deepEqual(activeOnly.map((o) => o.value), ['Nam']);

  const withInactive = resolveCatalogOptions({
    catalogId: 'student_gender',
    includeInactive: true,
    runtime: { dataCatalogs: [customGender] },
  });
  assert.deepEqual(withInactive.map((o) => o.value), ['Nam', 'Nữ']);
});

test('resolveCatalogOptions filters teacher subjects by department parentValue', () => {
  const natSubjects = resolveCatalogOptions({
    catalogId: 'teacher_subject',
    parentValue: 'Tổ Khoa học Tự nhiên',
  });
  assert.deepEqual(
    natSubjects.map((o) => o.value),
    ['Vật lí', 'Hóa học', 'Sinh học']
  );
});

test('normalizeCatalogInputValue normalizes unambiguous case/diacritic variants and leaves unknown values untouched', () => {
  const bookOpts = resolveCatalogOptions({ catalogId: 'book_category' });
  const matched = normalizeCatalogInputValue('khoa hoc tu nhien', bookOpts);
  assert.equal(matched.matched, true);
  assert.equal(matched.value, 'Khoa học tự nhiên');

  const unmatched = normalizeCatalogInputValue('Danh mục lạ', bookOpts);
  assert.equal(unmatched.matched, false);
  assert.equal(unmatched.value, 'Danh mục lạ');
});

test('validateDependentFieldValue detects grade vs className mismatch', () => {
  const mismatch = validateDependentFieldValue({
    childFieldKey: 'className',
    childValue: '11A1',
    parentValue: '10',
    runtime: { classes: SAMPLE_CLASSES },
  });
  assert.equal(mismatch.valid, false);
  assert.equal(mismatch.expectedParentValue, '11');

  const ok = validateDependentFieldValue({
    childFieldKey: 'className',
    childValue: '11A1',
    parentValue: '11',
    runtime: { classes: SAMPLE_CLASSES },
  });
  assert.equal(ok.valid, true);
});

test('countCatalogValueUsage prevents deleting referenced values and sanitizeFirestoreDocId strips accents/spaces', () => {
  const usage = countCatalogValueUsage('book_category', 'Khoa học tự nhiên', {
    books: [{ category: 'Khoa học tự nhiên' }, { category: 'Văn học & Ngữ văn' }],
  });
  assert.equal(usage, 1);

  assert.equal(sanitizeFirestoreDocId('CLS-10A1 Đặc Biệt'), 'CLS-10A1_Dac_Biet');
  assert.match(sanitizeFirestoreDocId('Lớp 11A2 / Tốt'), /^[a-zA-Z0-9_.-]+$/);
});

test('buildSheetValidationColumnsForModule includes live classes and catalog dropdown values', () => {
  const studentSpecs = buildSheetValidationColumnsForModule('students', MODULE_SCHEMAS, {
    classes: SAMPLE_CLASSES,
  });
  const classSpec = studentSpecs.find((s) => s.fieldKey === 'className');
  const genderSpec = studentSpecs.find((s) => s.fieldKey === 'gender');
  assert.ok(classSpec);
  assert.deepEqual(classSpec.values, ['10A1', '11A1']);
  assert.ok(genderSpec);
  assert.deepEqual(genderSpec.values, ['Nam', 'Nữ', 'Khác']);
});

test('resolveCatalogOptions returns strict empty array when parentValue has no matching child options', () => {
  const noMatchSubjects = resolveCatalogOptions({
    catalogId: 'teacher_subject',
    parentValue: 'Tổ Không Tồn Tại',
  });
  assert.deepEqual(noMatchSubjects, []);
});

test('all 12 new domain catalogs exist with isReportCritical metadata and countCatalogValueUsage scans expanded collections', () => {
  const expectedIds = [
    'semester',
    'library_transaction_status',
    'book_return_condition',
    'rule_severity',
    'room_type',
    'room_status',
    'priority_level',
    'leave_request_type',
    'feedback_category',
    'announcement_category',
    'announcement_audience',
    'survey_audience',
  ];
  for (const id of expectedIds) {
    assert.ok(
      DEFAULT_DATA_CATALOGS.some((c) => c.id === id),
      `Missing catalog ${id}`
    );
  }

  assert.equal(
    DEFAULT_DATA_CATALOGS.find((c) => c.id === 'student_gender')?.isReportCritical,
    true
  );
  assert.equal(
    DEFAULT_DATA_CATALOGS.find((c) => c.id === 'rule_severity')?.isReportCritical,
    true
  );

  assert.equal(
    countCatalogValueUsage('student_gender', 'Khác', {
      teachers: [{ gender: 'Khác' }],
      staffMembers: [{ gender: 'Khác' }],
    }),
    2
  );
  assert.equal(
    countCatalogValueUsage('employment_type', 'Biên chế', {
      staffMembers: [{ employmentType: 'Biên chế' }],
    }),
    1
  );
  assert.equal(
    countCatalogValueUsage('room_type', 'Phòng máy', {
      rooms: [{ roomType: 'Phòng máy' }],
    }),
    1
  );
  assert.equal(
    countCatalogValueUsage('announcement_category', 'Khảo thí', {
      announcements: [{ category: 'Khảo thí' }],
    }),
    1
  );
  assert.equal(
    countCatalogValueUsage('rule_severity', 'Nghiêm trọng', {
      ruleCriteria: [{ severity: 'Nghiêm trọng' }],
    }),
    1
  );
});

