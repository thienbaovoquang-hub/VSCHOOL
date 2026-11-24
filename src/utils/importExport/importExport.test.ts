import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {
  MODULE_SCHEMAS,
  getSchemaByKey,
  sanitizeCsvCell,
  buildCatalogLists,
} from './schemas';
import {
  validateManualRecord,
  validateImportWorkbook,
  extractExistingRecordsForModule,
} from './validator';
import {
  generateTemplateWorkbookBuffer,
  parseUploadedSpreadsheet,
  exportRecordsToBuffer,
  generateErrorReportBuffer,
} from './excelEngine';
import {
  buildDomainEntityFromNormalized,
  buildImportExecutionPlan,
} from './processor';
import { extractTableFromHtmlString } from '../documentExporter';
import type { ImportModuleKey } from '../../types';

const TEST_CONTEXT = {
  classes: [
    {
      id: 'CLS-10A1',
      code: '10A1',
      name: '10A1',
      grade: 10,
      academicYear: '2026 - 2027',
      homeroomTeacherId: 'TCH-01',
      homeroomTeacherName: 'Nguyễn Văn A',
      room: 'P.101',
      studentCount: 35,
    },
    {
      id: 'CLS-11A1',
      code: '11A1',
      name: '11A1',
      grade: 11,
      academicYear: '2026 - 2027',
      homeroomTeacherId: 'TCH-02',
      homeroomTeacherName: 'Trần Thị B',
      room: 'P.201',
      studentCount: 36,
    },
  ],
  academicYears: [
    {
      id: 'YR-2026-2027',
      name: '2026 - 2027',
      currentSemester: 'HK1' as const,
      startDate: '2026-09-05',
      endDate: '2027-05-30',
      status: 'Đang diễn ra' as const,
    },
  ],
  rooms: [
    {
      id: 'RM-P101',
      code: 'P.101',
      name: 'Phòng 101',
      building: 'Nhà A',
      floor: 'Tầng 1',
      capacity: 45,
      roomType: 'Phòng học' as const,
      status: 'Đang sử dụng' as const,
    },
    {
      id: 'RM-P201',
      code: 'P.201',
      name: 'Phòng 201',
      building: 'Nhà A',
      floor: 'Tầng 2',
      capacity: 45,
      roomType: 'Phòng học' as const,
      status: 'Sẵn sàng' as const,
    },
  ],
  teachers: [
    {
      id: 'TCH-001',
      fullName: 'Nguyễn Văn A',
      subject: 'Toán học',
      email: 'nva@schoolhub.edu.vn',
      phone: '0912345678',
      isHomeroom: true,
      homeroomClassName: '10A1',
      status: 'Đang công tác' as const,
      role: 'homeroom_teacher' as const,
    },
  ],
  students: [
    {
      id: 'STU-001',
      studentCode: 'STU-2026-001',
      fullName: 'Trần Minh Khôi',
      classId: 'CLS-10A1',
      className: '10A1',
      grade: 10,
      academicYear: '2026 - 2027',
      rfidCardId: 'RFID-100001',
      dateOfBirth: '2010-05-12',
      gender: 'Nam' as const,
      parentName: 'Trần Văn Hùng',
      parentRelation: 'Bố' as const,
      parentPhone: '0987654321',
      email: 'khoitm@student.edu.vn',
      status: 'Đang học' as const,
      address: 'Quận 1, TP.HCM',
      conduct: 'Tốt' as const,
      notes: 'Ghi chú cũ cần giữ nguyên',
    },
  ],
  books: [
    {
      id: 'BOK-001',
      bookCode: 'BOK-001',
      isbn: '978-604-0-12345-6',
      title: 'Giải tích 10 Nâng cao',
      author: 'Bộ GD&ĐT',
      category: 'Sách giáo khoa',
      publisher: 'NXB Giáo Dục',
      publishYear: 2025,
      totalCopies: 10,
      availableCopies: 10,
      shelfLocation: 'Kệ A1',
      coverUrl: '',
      description: 'Sách chuẩn',
    },
  ],
  timetable: [
    {
      id: 'TT-10A1-D2-P1',
      classId: 'CLS-10A1',
      className: '10A1',
      dayOfWeek: 2,
      period: 1,
      subject: 'Toán học',
      teacherName: 'Nguyễn Văn A',
      room: 'P.101',
    },
  ],
  academicRecords: [
    {
      id: 'GRD-PUB-01',
      studentId: 'STU-001',
      studentName: 'Trần Minh Khôi',
      studentCode: 'STU-2026-001',
      classId: 'CLS-10A1',
      className: '10A1',
      subjectId: 'SUB-TOAN',
      subjectName: 'Toán học',
      semester: 'HK1' as const,
      academicYear: '2026 - 2027',
      scoreRegular: [8, 9],
      scoreMidterm: 8.5,
      scoreFinal: 9.0,
      averageScore: 8.7,
      status: 'published' as const,
    },
  ],
  leaveRequests: [
    {
      id: 'LR-01',
      requestCode: 'LR-2026-01',
      studentId: 'STU-001',
      studentName: 'Trần Minh Khôi',
      studentCode: 'STU-2026-001',
      className: '10A1',
      type: 'Nghỉ ốm' as const,
      fromDate: '2026-10-10',
      toDate: '2026-10-12',
      reason: 'Sốt',
      status: 'approved' as const,
      createdAt: '2026-10-09T08:00:00Z',
    },
  ],
  userAccounts: [
    {
      id: 'USR-01',
      email: 'nva@schoolhub.edu.vn',
      displayName: 'Nguyễn Văn A',
      role: 'homeroom_teacher' as const,
      status: 'active' as const,
    },
  ],
};

async function createTestXlsxBuffer(
  sheets: Array<{ name: string; headers?: string[]; rows: Array<Record<string, unknown> | unknown[]> }>
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name);
    if (s.headers) {
      ws.addRow(s.headers);
      for (const r of s.rows) {
        if (Array.isArray(r)) {
          ws.addRow(r);
        } else {
          ws.addRow(s.headers.map((h) => r[h] ?? ''));
        }
      }
    } else {
      for (const r of s.rows) {
        if (Array.isArray(r)) ws.addRow(r);
      }
    }
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

describe('Unified Import/Export Engine — 8 Super Apps', () => {
  it('covers all 29 ImportModuleKey schemas without password/counseling/teacherCode security or field violations', () => {
    const allKeys = Object.keys(MODULE_SCHEMAS) as ImportModuleKey[];
    assert.equal(allKeys.length, 29);

    // Ensure users & role_assignments never contain plaintext password fields
    for (const k of ['users', 'role_assignments'] as ImportModuleKey[]) {
      const schema = getSchemaByKey(k);
      const hasPasswordField = schema.fields.some((f) =>
        /password|matkhau|secret/i.test(f.key + f.header)
      );
      assert.equal(hasPasswordField, false, `${k} must not have password column`);
    }

    // Ensure teacherCode is completely removed from teachers, users, teaching_assignments, classes
    for (const k of ['teachers', 'users', 'teaching_assignments', 'classes'] as ImportModuleKey[]) {
      const schema = getSchemaByKey(k);
      assert.equal(
        schema.fields.some((f) => f.key === 'teacherCode' || /Mã giáo viên/i.test(f.header)),
        false,
        `${k} must not contain teacherCode`
      );
    }
  });

  it('neutralizes CSV formula injection payloads safely', () => {
    assert.equal(sanitizeCsvCell('=CMD|"/C calc"!A0'), `"'=CMD|""/C calc""!A0"`);
    assert.equal(sanitizeCsvCell('+1+1'), `'+1+1`);
    assert.equal(sanitizeCsvCell('-2*3'), `'-2*3`);
    assert.equal(sanitizeCsvCell('@SUM(A1:A2)'), `'@SUM(A1:A2)`);
    assert.equal(sanitizeCsvCell('\t=1'), `'\t=1`);
    assert.equal(sanitizeCsvCell('Bình thường, 10A1'), '"Bình thường, 10A1"');
  });

  it('generates clean multi-tab .xlsx templates (per class for students), HUONG_DAN, DANH_MUC, drop-down lists, extra sheets, and ZERO fake human PII rows', async () => {
    const studentSchema = getSchemaByKey('students');
    const bytes = await generateTemplateWorkbookBuffer(studentSchema, TEST_CONTEXT);
    const parsed = await parseUploadedSpreadsheet(bytes, studentSchema.templateFileName);

    assert.equal(parsed.dataSheetName, '10A1');
    assert.deepEqual(parsed.dataSheetNames, ['10A1', '11A1']);
    assert.ok(parsed.sheetNames.includes('HUONG_DAN'));
    assert.ok(parsed.sheetNames.includes('DANH_MUC'));
    assert.ok(parsed.sheetNames.includes('PHU_HUYNH'));
    assert.equal(parsed.templateModuleFound, 'students');
    assert.equal(parsed.templateVersionFound, studentSchema.version);
    assert.equal(parsed.rows.length, 0, 'Template data sheets must have zero fake student rows');
    assert.ok(parsed.headers.includes('Mã học sinh *'));
    assert.ok(parsed.headers.includes('Tên phụ huynh'));

    // Dynamic DANH_MUC catalog contains live classes
    const catalogs = buildCatalogLists(TEST_CONTEXT);
    assert.deepEqual(catalogs.classes, ['10A1', '11A1']);
  });

  it('detects template mismatch, wrong version, and missing required columns', async () => {
    const schema = getSchemaByKey('students');
    const badFileBytes = await createTestXlsxBuffer([
      {
        name: 'HUONG_DAN',
        rows: [
          ['HƯỚNG DẪN'],
          ['MODULE_KEY', 'teachers', 'TEMPLATE_VERSION', '1.0'],
        ],
      },
      {
        name: 'DATA',
        headers: ['Mã học sinh *', 'Họ và tên *'],
        rows: [{ 'Mã học sinh *': 'STU-999', 'Họ và tên *': 'Test' }],
      },
    ]);

    const parsed = await parseUploadedSpreadsheet(badFileBytes, 'wrong.xlsx');
    const report = validateImportWorkbook(
      schema,
      parsed,
      TEST_CONTEXT,
      extractExistingRecordsForModule('students', TEST_CONTEXT),
      'only_add'
    );

    assert.ok(report.headerErrors.length >= 2);
    assert.ok(report.missingRequiredHeaders.includes('Mã thẻ RFID *'));
    assert.ok(report.missingRequiredHeaders.includes('SĐT phụ huynh *'));
  });

  it('keeps manual form validation and Excel validation in full parity and prevents blank cells from overwriting existing fields on update', async () => {
    const schema = getSchemaByKey('students');
    const existing = extractExistingRecordsForModule('students', TEST_CONTEXT);

    // 1. Manual duplicate + invalid email + invalid phone should fail
    const manualInvalid = validateManualRecord(
      schema,
      {
        studentCode: 'STU-2026-001', // collides with existing
        fullName: 'Học Sinh Mới',
        gender: 'Nam',
        dateOfBirth: '31/02/2010', // impossible date
        grade: 10,
        className: '99Z9', // non-existent class
        rfidCardId: 'RFID-999999',
        parentPhone: '123', // too short
        email: 'bad-email',
      },
      TEST_CONTEXT,
      existing
    );
    assert.equal(manualInvalid.valid, false);
    assert.ok(manualInvalid.fieldErrors.studentCode);
    assert.ok(manualInvalid.fieldErrors.dateOfBirth);
    assert.ok(manualInvalid.fieldErrors.className);
    assert.ok(manualInvalid.fieldErrors.parentPhone);
    assert.ok(manualInvalid.fieldErrors.email);

    // 2. Manual valid entry produces identical domain structure to Excel valid entry
    const validInput = {
      studentCode: 'STU-2026-888',
      fullName: 'Lê Hoàng Nam',
      gender: 'Nam',
      dateOfBirth: '15/08/2010',
      grade: 10,
      className: '10A1',
      academicYear: '2026 - 2027',
      rfidCardId: 'RFID-888888',
      status: 'Đang học',
      conduct: 'Tốt',
      parentName: 'Lê Văn Minh',
      parentRelation: 'Bố',
      parentPhone: '0901 234 567',
      email: 'NAM.LE@SCHOOL.EDU.VN',
      address: '12 Nguyễn Huệ',
      notes: 'Nhập học đúng hạn',
    };
    const manualValid = validateManualRecord(schema, validInput, TEST_CONTEXT, existing);
    assert.equal(manualValid.valid, true);
    const manualDomain = buildDomainEntityFromNormalized('students', manualValid.normalized, TEST_CONTEXT);

    const excelBytes = await createTestXlsxBuffer([
      {
        name: 'DATA',
        headers: schema.fields.map((f) => f.header),
        rows: [
          {
            'Mã học sinh *': 'STU-2026-888',
            'Họ và tên *': 'Lê Hoàng Nam',
            'Giới tính *': 'Nam',
            'Ngày sinh *': '15/08/2010',
            'Khối *': 10,
            'Lớp *': '10A1',
            'Năm học': '2026 - 2027',
            'Mã thẻ RFID *': 'RFID-888888',
            'Trạng thái học vụ': 'Đang học',
            'Hạnh kiểm': 'Tốt',
            'Tên phụ huynh': 'Lê Văn Minh',
            'Quan hệ phụ huynh': 'Bố',
            'SĐT phụ huynh *': '0901 234 567',
            'Email học sinh / PH': 'NAM.LE@SCHOOL.EDU.VN',
            'Địa chỉ': '12 Nguyễn Huệ',
            'Ghi chú': 'Nhập học đúng hạn',
          },
        ],
      },
    ]);

    const parsedExcel = await parseUploadedSpreadsheet(excelBytes, 'students.xlsx');
    const excelReport = validateImportWorkbook(schema, parsedExcel, TEST_CONTEXT, existing, 'only_add');
    assert.equal(excelReport.validCreateCount, 1);
    const excelPlan = buildImportExecutionPlan({
      report: excelReport,
      mode: 'only_add',
      errorPolicy: 'only_valid',
      context: TEST_CONTEXT,
      existingRecords: existing,
      extra: { actorName: 'Admin', actorRole: 'admin' },
    });
    assert.deepEqual(excelPlan.entitiesToSave[0], manualDomain);

    // 3. Update mode: blank cells must NOT overwrite existing notes/parentPhone/email
    const updateBytes = await createTestXlsxBuffer([
      {
        name: 'DATA',
        headers: schema.fields.map((f) => f.header),
        rows: [
          {
            'Mã học sinh *': 'STU-2026-001',
            'Họ và tên *': 'Trần Minh Khôi (Đã cập nhật)',
            'Giới tính *': '',
            'Ngày sinh *': '',
            'Khối *': '',
            'Lớp *': '11A1',
            'Năm học': '',
            'Mã thẻ RFID *': '',
            'SĐT phụ huynh *': '',
            'Ghi chú': '',
          },
        ],
      },
    ]);
    const parsedUpdate = await parseUploadedSpreadsheet(updateBytes, 'update.xlsx');
    const updateReport = validateImportWorkbook(schema, parsedUpdate, TEST_CONTEXT, existing, 'update_existing');
    assert.equal(updateReport.validUpdateCount, 1);
    const updatePlan = buildImportExecutionPlan({
      report: updateReport,
      mode: 'update_existing',
      errorPolicy: 'only_valid',
      context: TEST_CONTEXT,
      existingRecords: existing,
      extra: { actorName: 'Admin', actorRole: 'admin' },
    });
    const updatedStudent = updatePlan.entitiesToSave[0];
    assert.equal(updatedStudent.fullName, 'Trần Minh Khôi (Đã cập nhật)');
    assert.equal(updatedStudent.className, '11A1');
    assert.equal(updatedStudent.notes, 'Ghi chú cũ cần giữ nguyên');
    assert.equal(updatedStudent.parentPhone, '0987654321');
    assert.equal(updatedStudent.rfidCardId, 'RFID-100001');
  });

  it('enforces abort_on_error policy, in-file duplicate detection, and generates downloadable Excel Error Report', async () => {
    const schema = getSchemaByKey('students');
    const existing = extractExistingRecordsForModule('students', TEST_CONTEXT);

    const mixedBytes = await createTestXlsxBuffer([
      {
        name: 'DATA',
        headers: schema.fields.map((f) => f.header),
        rows: [
          {
            'Mã học sinh *': 'STU-NEW-1',
            'Họ và tên *': 'Nguyễn An',
            'Giới tính *': 'Nam',
            'Ngày sinh *': '2010-03-10',
            'Khối *': 10,
            'Lớp *': '10A1',
            'Mã thẻ RFID *': 'RFID-NEW-1',
            'SĐT phụ huynh *': '0911223344',
          },
          {
            'Mã học sinh *': 'STU-NEW-1', // duplicate inside file!
            'Họ và tên *': 'Nguyễn Bình',
            'Giới tính *': 'Nữ',
            'Ngày sinh *': '2010-04-10',
            'Khối *': 10,
            'Lớp *': '10A1',
            'Mã thẻ RFID *': 'RFID-NEW-2',
            'SĐT phụ huynh *': '0911223355',
          },
        ],
      },
    ]);

    const parsed = await parseUploadedSpreadsheet(mixedBytes, 'dup.xlsx');
    const report = validateImportWorkbook(schema, parsed, TEST_CONTEXT, existing, 'only_add');
    assert.equal(report.validCreateCount, 1);
    assert.equal(report.duplicateCount, 1);

    const abortPlan = buildImportExecutionPlan({
      report,
      mode: 'only_add',
      errorPolicy: 'abort_on_error',
      context: TEST_CONTEXT,
      existingRecords: existing,
      extra: { actorName: 'Admin', actorRole: 'admin' },
    });
    assert.equal(abortPlan.result.aborted, true);
    assert.equal(abortPlan.entitiesToSave.length, 0);
    assert.equal(abortPlan.historyRecord.status, 'aborted');

    const errReportBytes = await generateErrorReportBuffer(report);
    const errWb = new ExcelJS.Workbook();
    await errWb.xlsx.load(errReportBytes.buffer as ArrayBuffer);
    assert.ok(errWb.getWorksheet('TONG_QUAN'));
    assert.ok(errWb.getWorksheet('LOI_CHI_TIET'));
  });

  it('enforces business guardrails across super apps: timetable conflicts, published grade lock, attendance leave warning, academic year dates, book copies & announcements draft', async () => {
    // 1. Timetable conflict vs DB and vs earlier row in Excel
    const ttSchema = getSchemaByKey('timetable');
    const ttBytes = await createTestXlsxBuffer([
      {
        name: 'DATA',
        headers: ttSchema.fields.map((f) => f.header),
        rows: [
          {
            'Lớp *': '11A1',
            'Thứ *': 2,
            'Tiết *': 1,
            'Môn học *': 'Vật lí',
            'Giáo viên *': 'Nguyễn Văn A', // Teacher conflict with DB (10A1 D2 P1)!
            'Phòng học *': 'P.201',
          },
          {
            'Lớp *': '11A1',
            'Thứ *': 3,
            'Tiết *': 2,
            'Môn học *': 'Toán học',
            'Giáo viên *': 'Trần Thị B',
            'Phòng học *': 'P.201',
          },
          {
            'Lớp *': '10A1',
            'Thứ *': 3,
            'Tiết *': 2,
            'Môn học *': 'Hóa học',
            'Giáo viên *': 'Lê Văn C',
            'Phòng học *': 'P.201', // Room conflict with row 2 in same Excel!
          },
        ],
      },
    ]);
    const ttParsed = await parseUploadedSpreadsheet(ttBytes, 'tkb.xlsx');
    const ttReport = validateImportWorkbook(
      ttSchema,
      ttParsed,
      TEST_CONTEXT,
      extractExistingRecordsForModule('timetable', TEST_CONTEXT),
      'only_add'
    );
    assert.equal(ttReport.rows[0].status, 'invalid');
    assert.equal(ttReport.rows[1].status, 'valid_create');
    assert.equal(ttReport.rows[2].status, 'invalid');

    // 2. Published grade protection even in update_existing mode
    const grSchema = getSchemaByKey('grades');
    const grBytes = await createTestXlsxBuffer([
      {
        name: 'DATA',
        headers: grSchema.fields.map((f) => f.header),
        rows: [
          {
            'Mã học sinh *': 'STU-2026-001',
            'Môn học *': 'Toán học',
            'Học kỳ *': 'HK1',
            'Năm học': '2026 - 2027',
            'Điểm thường xuyên': '10; 10',
            'Điểm giữa kỳ *': 10,
            'Điểm cuối kỳ *': 10,
            'Trạng thái': 'draft',
          },
        ],
      },
    ]);
    const grParsed = await parseUploadedSpreadsheet(grBytes, 'grades.xlsx');
    const grReport = validateImportWorkbook(
      grSchema,
      grParsed,
      TEST_CONTEXT,
      extractExistingRecordsForModule('grades', TEST_CONTEXT),
      'update_existing'
    );
    assert.equal(grReport.rows[0].status, 'invalid');
    assert.ok(grReport.rows[0].issues.some((i) => i.message.includes('đã công bố')));

    // 3. Attendance approved leave warning
    const attSchema = getSchemaByKey('attendance');
    const attValidation = validateManualRecord(
      attSchema,
      {
        date: '2026-10-11',
        studentCode: 'STU-2026-001',
        className: '10A1',
        status: 'absent_unexcused',
        reason: '',
      },
      TEST_CONTEXT,
      []
    );
    assert.equal(attValidation.valid, true); // warning does not block, informs user
    assert.ok(attValidation.issues.some((i) => i.severity === 'warning' && i.message.includes('đơn xin nghỉ')));

    // 4. Academic year startDate >= endDate blocked
    const yrValidation = validateManualRecord(
      getSchemaByKey('academic_years'),
      {
        name: '2027 - 2028',
        currentSemester: 'HK1',
        startDate: '2027-09-05',
        endDate: '2027-05-01',
        status: 'Sắp tới',
      },
      TEST_CONTEXT,
      []
    );
    assert.equal(yrValidation.valid, false);
    assert.ok(yrValidation.fieldErrors.endDate);

    // 5. Book copy must reference existing book
    const copyInvalid = validateManualRecord(
      getSchemaByKey('book_copies'),
      {
        bookRef: 'UNKNOWN-ISBN',
        copyBarcode: 'BC-0001',
        status: 'available',
        condition: 'Tốt',
      },
      TEST_CONTEXT,
      []
    );
    assert.equal(copyInvalid.valid, false);
    assert.ok(copyInvalid.fieldErrors.bookRef);

    // 6. Announcements default safely to draft
    const annDomain = buildDomainEntityFromNormalized(
      'announcements',
      {
        title: 'Thông báo nghỉ lễ',
        content: 'Nghỉ lễ theo quy định.',
        category: 'Toàn trường',
        targetAudience: 'Toàn trường',
        priority: 'normal',
      },
      TEST_CONTEXT
    );
    assert.equal(annDomain.status, 'draft');
  });

  it('exports scoped columns to safe UTF-8 CSV and template-compatible XLSX', async () => {
    const studentSchema = getSchemaByKey('students');
    const dangerousRecord = {
      ...TEST_CONTEXT.students[0],
      notes: '=HYPERLINK("http://evil")',
    };

    const csvBytes = await exportRecordsToBuffer(studentSchema, [dangerousRecord], {
      format: 'csv',
      scope: 'selected',
      selectedFieldKeys: ['studentCode', 'fullName', 'notes'],
      templateCompatible: false,
    });
    assert.equal(csvBytes[0], 0xef, 'CSV must start with UTF-8 BOM byte 0xEF');
    assert.equal(csvBytes[1], 0xbb, 'CSV must have UTF-8 BOM byte 0xBB');
    assert.equal(csvBytes[2], 0xbf, 'CSV must have UTF-8 BOM byte 0xBF');
    const csvText = new TextDecoder('utf-8', { ignoreBOM: true }).decode(csvBytes);
    assert.ok(csvText.startsWith('\uFEFF'), 'Decoded CSV with ignoreBOM must preserve BOM');
    assert.ok(csvText.includes(`"'=HYPERLINK(`), 'Formula cell must be neutralized');
    assert.ok(!csvText.includes('Mã thẻ RFID'), 'Unselected columns must not be exported');

    const xlsxBytes = await exportRecordsToBuffer(
      studentSchema,
      [TEST_CONTEXT.students[0]],
      {
        format: 'xlsx',
        scope: 'all',
        selectedFieldKeys: ['studentCode', 'fullName', 'className'],
        templateCompatible: true,
      },
      TEST_CONTEXT
    );
    const parsedExport = await parseUploadedSpreadsheet(xlsxBytes, 'export.xlsx');
    assert.equal(parsedExport.dataSheetName, '10A1');
    assert.ok(parsedExport.sheetNames.includes('DANH_MUC'));
    assert.equal(parsedExport.templateModuleFound, 'students');
    assert.deepEqual(parsedExport.headers, ['Mã học sinh *', 'Họ và tên *', 'Lớp *']);
    assert.equal(parsedExport.rows.length, 1);

    // Exported XLSX must also carry Excel drop-down validation rules
    const expWb = new ExcelJS.Workbook();
    await expWb.xlsx.load(xlsxBytes.buffer as ArrayBuffer);
    const expWs = expWb.getWorksheet('10A1');
    assert.ok(expWs);
    assert.equal(expWs.getCell('C2').dataValidation?.type, 'list');
    assert.ok(expWs.getCell('C2').dataValidation?.formulae?.[0]?.startsWith('=DANH_MUC!'));
  });

  it('extracts the main Word DOCX HTML table cleanly for unified import validation and throws clear Vietnamese error if missing', () => {
    const sampleHtml = `
      <p>TRƯỜNG THPT SCHOOLHUB</p>
      <table><tr><th>Thông tin</th><th>Giá trị</th></tr><tr><td>Năm học</td><td>2026 - 2027</td></tr></table>
      <table>
        <thead>
          <tr><th>Mã học sinh *</th><th>Họ và tên *</th><th>Lớp *</th><th>Ghi chú</th></tr>
        </thead>
        <tbody>
          <tr><td>STU-DOCX-01</td><td>Nguyễn Minh &amp; An</td><td>10A1</td><td>Tốt<br/>Chăm ngoan</td></tr>
          <tr><td>STU-DOCX-02</td><td>Lê Thị Bình</td><td>11A1</td><td>&nbsp;</td></tr>
        </tbody>
      </table>
    `;

    const parsedDocx = extractTableFromHtmlString(sampleHtml, 'Danh_sach_HS.docx');
    assert.equal(parsedDocx.fileName, 'Danh_sach_HS.docx');
    assert.equal(parsedDocx.dataSheetName, 'WORD_TABLE');
    assert.deepEqual(parsedDocx.headers, ['Mã học sinh *', 'Họ và tên *', 'Lớp *', 'Ghi chú']);
    assert.equal(parsedDocx.rows.length, 2);
    assert.equal(parsedDocx.rows[0]['Họ và tên *'], 'Nguyễn Minh & An');
    assert.equal(parsedDocx.rows[0]['Ghi chú'], 'Tốt Chăm ngoan');
    assert.equal(parsedDocx.rows[1]['Ghi chú'], '');

    assert.throws(
      () => extractTableFromHtmlString('<p>Văn bản không có bảng</p>', 'khong_bang.docx'),
      /không chứa bảng dữ liệu/
    );
  });

  it('preserves Khác gender, Yếu conduct, optional catalog fields, and validates department -> subject dependency', () => {
    const stuSchema = getSchemaByKey('students');
    const stuValid = validateManualRecord(
      stuSchema,
      {
        studentCode: 'STU-KHAC-01',
        fullName: 'Phạm Minh Khôi',
        gender: 'Khác',
        dateOfBirth: '2010-03-14',
        grade: 10,
        className: '10A1',
        rfidCardId: 'RFID-9991',
        parentPhone: '0912345679',
        status: 'Đang học',
        conduct: 'Yếu',
      },
      TEST_CONTEXT,
      []
    );
    assert.equal(stuValid.valid, true);
    const stuDomain = buildDomainEntityFromNormalized(
      'students',
      {
        studentCode: 'STU-KHAC-01',
        fullName: 'Phạm Minh Khôi',
        gender: 'Khác',
        dateOfBirth: '2010-03-14',
        grade: 10,
        className: '10A1',
        rfidCardId: 'RFID-9991',
        parentPhone: '0912345679',
        status: 'Đang học',
        conduct: 'Yếu',
      },
      TEST_CONTEXT
    );
    assert.equal(stuDomain.gender, 'Khác');
    assert.equal(stuDomain.conduct, 'Yếu');

    const teacherSchema = getSchemaByKey('teachers');
    const invalidTeacherDep = validateManualRecord(
      teacherSchema,
      {
        fullName: 'Nguyễn Thị Sai Tổ',
        email: 'saito@schoolhub.edu.vn',
        department: 'Tổ Ngữ văn',
        subject: 'Toán học',
      },
      TEST_CONTEXT,
      []
    );
    assert.equal(invalidTeacherDep.valid, false);
    assert.ok(invalidTeacherDep.fieldErrors.subject);

    const teacherDomain = buildDomainEntityFromNormalized(
      'teachers',
      {
        fullName: 'Lê Văn Đúng',
        email: 'dung@schoolhub.edu.vn',
        gender: 'Khác',
        department: 'Tổ Toán - Tin',
        subject: 'Tin học',
      },
      TEST_CONTEXT
    );
    assert.equal(teacherDomain.gender, 'Khác');

    const staffDomain = buildDomainEntityFromNormalized(
      'staff',
      {
        staffCode: 'NV-100',
        fullName: 'Trần Văn Hợp Đồng',
        gender: 'Nam',
        department: 'Thư viện',
        position: 'Thủ thư',
        employmentType: 'Hợp đồng dài hạn',
        status: 'Đang công tác',
      },
      TEST_CONTEXT
    );
    assert.equal(staffDomain.gender, 'Nam');
    assert.equal(staffDomain.employmentType, 'Hợp đồng dài hạn');
  });

  it('generates multi-sheet tabs and ExcelJS Drop-down lists across ALL 29 modules and infers grouping fields from sheet tab names', async () => {
    const allKeys = Object.keys(MODULE_SCHEMAS) as ImportModuleKey[];
    assert.equal(allKeys.length, 29);

    for (const moduleKey of allKeys) {
      const schema = getSchemaByKey(moduleKey);
      const bytes = await generateTemplateWorkbookBuffer(schema, TEST_CONTEXT);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(bytes.buffer as ArrayBuffer);

      const parsed = await parseUploadedSpreadsheet(bytes, schema.templateFileName);
      const dataTabs = parsed.dataSheetNames || [];
      assert.ok(
        dataTabs.length >= 2,
        `Module ${moduleKey} must generate >= 2 data sheet tabs, got: ${JSON.stringify(dataTabs)}`
      );
      assert.ok(
        !dataTabs.includes('DATA'),
        `Module ${moduleKey} must not emit legacy single DATA tab`
      );
      assert.ok(wb.getWorksheet('HUONG_DAN'), `${moduleKey} missing HUONG_DAN`);
      assert.ok(wb.getWorksheet('DANH_MUC'), `${moduleKey} missing DANH_MUC`);

      // Every data tab must attach list dataValidation on dropdown-eligible columns
      const hasDropdownEligibleField = schema.fields.some(
        (f) => f.type === 'enum' || f.type === 'boolean' || Boolean(f.catalogId || f.lookupCatalog || f.options?.length)
      );
      for (const tabName of dataTabs) {
        const ws = wb.getWorksheet(tabName);
        assert.ok(ws, `${moduleKey} missing worksheet ${tabName}`);
        if (hasDropdownEligibleField) {
          let listCount = 0;
          for (let colIdx = 1; colIdx <= schema.fields.length; colIdx++) {
            if (ws.getRow(2).getCell(colIdx).dataValidation?.type === 'list') {
              listCount++;
            }
          }
          assert.ok(
            listCount >= 1,
            `Module ${moduleKey} sheet "${tabName}" must have at least 1 Excel Drop-down list`
          );
        }
      }

      // Check extraSheets also have list validations when eligible
      for (const extra of schema.extraSheets || []) {
        const extraWs = wb.getWorksheet(extra.sheetName);
        assert.ok(extraWs, `${moduleKey} missing extraSheet ${extra.sheetName}`);
        const extraEligible = extra.fields.some(
          (f) => f.type === 'enum' || f.type === 'boolean' || Boolean(f.catalogId || f.lookupCatalog || f.options?.length)
        );
        if (extraEligible) {
          let extraListCount = 0;
          for (let colIdx = 1; colIdx <= extra.fields.length; colIdx++) {
            if (extraWs.getRow(2).getCell(colIdx).dataValidation?.type === 'list') {
              extraListCount++;
            }
          }
          assert.ok(
            extraListCount >= 1,
            `Module ${moduleKey} extraSheet "${extra.sheetName}" must have at least 1 Drop-down list`
          );
        }
      }
    }

    // Multi-tab student import infers blank className & grade from tab names ("10A1", "11A1") and tracks exact sheet coordinates
    const stuSchema = getSchemaByKey('students');
    const multiClassBytes = await createTestXlsxBuffer([
      {
        name: '10A1',
        headers: stuSchema.fields.map((f) => f.header),
        rows: [
          {
            'Mã học sinh *': 'STU-TAB-10',
            'Họ và tên *': 'Nguyễn Văn Mười',
            'Giới tính *': 'Nam',
            'Ngày sinh *': '2010-02-14',
            'Khối *': '',
            'Lớp *': '',
            'Mã thẻ RFID *': 'RFID-TAB-10',
            'SĐT phụ huynh *': '0911000010',
          },
        ],
      },
      {
        name: '11A1',
        headers: stuSchema.fields.map((f) => f.header),
        rows: [
          {
            'Mã học sinh *': 'STU-TAB-11',
            'Họ và tên *': 'Trần Thị Mười Một',
            'Giới tính *': 'Nữ',
            'Ngày sinh *': '2009-07-20',
            'Khối *': '',
            'Lớp *': '',
            'Mã thẻ RFID *': 'RFID-TAB-11',
            'SĐT phụ huynh *': '0911000011',
          },
          {
            'Mã học sinh *': 'STU-TAB-ERR',
            'Họ và tên *': 'Lỗi SĐT',
            'Giới tính *': 'Nam',
            'Ngày sinh *': '2009-07-20',
            'Khối *': '',
            'Lớp *': '',
            'Mã thẻ RFID *': 'RFID-TAB-ERR',
            'SĐT phụ huynh *': '12', // invalid phone on 11A1 row 3
          },
        ],
      },
    ]);

    const parsedMulti = await parseUploadedSpreadsheet(multiClassBytes, 'hoc-sinh-theo-lop.xlsx');
    assert.deepEqual(parsedMulti.dataSheetNames, ['10A1', '11A1']);
    const reportMulti = validateImportWorkbook(
      stuSchema,
      parsedMulti,
      TEST_CONTEXT,
      extractExistingRecordsForModule('students', TEST_CONTEXT),
      'only_add'
    );
    assert.deepEqual(reportMulti.tabNames, ['10A1', '11A1']);
    assert.equal(reportMulti.validCreateCount, 2);
    assert.equal(reportMulti.invalidCount, 1);
    assert.equal(reportMulti.rows[0].sheetName, '10A1');
    assert.equal(reportMulti.rows[0].normalizedData.className, '10A1');
    assert.equal(reportMulti.rows[0].normalizedData.grade, 10);
    assert.equal(reportMulti.rows[1].sheetName, '11A1');
    assert.equal(reportMulti.rows[1].normalizedData.className, '11A1');
    assert.equal(reportMulti.rows[1].normalizedData.grade, 11);
    assert.equal(reportMulti.rows[2].sheetName, '11A1');
    assert.equal(reportMulti.rows[2].rowNumber, 3);
    assert.equal(reportMulti.rows[2].issues[0].sheetName, '11A1');
  });
});

