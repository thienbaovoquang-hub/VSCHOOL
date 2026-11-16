import type {
  AcademicRecord,
  AcademicYearConfig,
  Announcement,
  Assignment,
  AttendanceRecord,
  Book,
  BookCopy,
  BorrowTransaction,
  ClassPlacement,
  EmulationRecord,
  ErrorPolicy,
  FacilityAsset,
  FeedbackReport,
  GradeWeightConfig,
  ImportExecutionResult,
  ImportHistoryRecord,
  ImportMode,
  ImportModuleKey,
  ImportPreviewReport,
  InventoryAudit,
  LearningMaterial,
  MaintenanceRequest,
  RuleCriterion,
  SchoolClass,
  SchoolEvent,
  SchoolRoom,
  StaffMember,
  Student,
  StudentLeaveRequest,
  Survey,
  SurveyQuestion,
  Teacher,
  TeachingAssignment,
  TimetableEntry,
  UserProfile,
  UserRole,
} from '../../types';
import { calculateSubjectGPA, DEFAULT_GRADE_WEIGHTS } from '../academicRules';
import { computeInventoryAuditDiff } from '../libraryRules';
import { getSchemaByKey } from './schemas';
import { normalizeCode, normalizeText, type ValidationDbContext } from './validator';
import { sanitizeFirestoreDocId } from '../catalogs/catalogRegistry';

export interface ProcessorExtraContext {
  actorName: string;
  actorRole: UserRole;
  gradeWeights?: GradeWeightConfig;
  extraSheets?: Record<string, Record<string, unknown>[]>;
}

function mergeDefined<T extends Record<string, unknown>>(
  existing: T | undefined,
  incoming: Record<string, unknown>,
  rawRow?: Record<string, unknown>,
  fieldHeaders?: Record<string, string>
): Record<string, unknown> {
  if (!existing) return { ...incoming };
  const merged: Record<string, unknown> = { ...existing };
  for (const [k, val] of Object.entries(incoming)) {
    if (rawRow && fieldHeaders && fieldHeaders[k]) {
      const rawCell = rawRow[fieldHeaders[k]] ?? rawRow[k];
      if (normalizeText(rawCell) === '') {
        continue; // Preserve existing value when Excel cell is blank!
      }
    }
    if (val !== '' && val !== undefined && val !== null) {
      merged[k] = val;
    }
  }
  return merged;
}

export function buildDomainEntityFromNormalized(
  schemaKey: ImportModuleKey,
  normalized: Record<string, unknown>,
  context: ValidationDbContext,
  existingRecord?: Record<string, unknown>,
  rawRow?: Record<string, unknown>,
  extra?: ProcessorExtraContext
): Record<string, unknown> {
  const schema = getSchemaByKey(schemaKey);
  const headerByKey: Record<string, string> = {};
  for (const f of schema.fields) headerByKey[f.key] = f.header;

  const merged = mergeDefined(existingRecord, normalized, rawRow, headerByKey);
  const nowIso = new Date().toISOString();
  const today = nowIso.split('T')[0];

  switch (schemaKey) {
    case 'students': {
      const code = normalizeText(merged.studentCode);
      const className = normalizeText(merged.className);
      const matchedClass = (context.classes || []).find(
        (c) => c.name.toLowerCase() === className.toLowerCase()
      );
      const ethnicity = normalizeText(merged.ethnicity);
      const policyGroup = normalizeText(merged.policyGroup);
      const dossierStatus = normalizeText(merged.dossierStatus);
      const entity: Student = {
        id: String(existingRecord?.id || sanitizeFirestoreDocId(code, 'STU')),
        studentCode: code,
        fullName: normalizeText(merged.fullName),
        classId: matchedClass?.id || sanitizeFirestoreDocId(`CLS-${className}`, 'CLS'),
        className,
        grade: Number(merged.grade) || matchedClass?.grade || 10,
        academicYear: normalizeText(merged.academicYear) || context.systemSettings?.academicYear || '2026 - 2027',
        rfidCardId: normalizeText(merged.rfidCardId),
        dateOfBirth: normalizeText(merged.dateOfBirth) || '2010-01-01',
        gender: (normalizeText(merged.gender) as Student['gender']) || 'Nam',
        parentName: normalizeText(merged.parentName) || undefined,
        parentRelation: (normalizeText(merged.parentRelation) as Student['parentRelation']) || undefined,
        parentPhone: normalizeText(merged.parentPhone),
        email: normalizeText(merged.email) || undefined,
        status: (normalizeText(merged.status) as Student['status']) || 'Đang học',
        address: normalizeText(merged.address),
        conduct: (normalizeText(merged.conduct) as Student['conduct']) || 'Tốt',
        notes: normalizeText(merged.notes) || undefined,
        ...(ethnicity ? { ethnicity } : {}),
        ...(policyGroup ? { policyGroup } : {}),
        ...(dossierStatus ? { dossierStatus } : {}),
        ...(existingRecord?.gpa !== undefined ? { gpa: Number(existingRecord.gpa) } : {}),
        ...(existingRecord?.attendanceRate !== undefined ? { attendanceRate: Number(existingRecord.attendanceRate) } : {}),
      };
      return entity as unknown as Record<string, unknown>;
    }

    case 'teachers': {
      const email = normalizeText(merged.email).toLowerCase();
      const homeroomClass = normalizeText(merged.homeroomClassName);
      const assignedList =
        typeof merged.assignedClasses === 'string'
          ? merged.assignedClasses
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : Array.isArray(merged.assignedClasses)
          ? (merged.assignedClasses as string[])
          : [];
      const matchedHomeroom = (context.classes || []).find(
        (c) => c.name.toLowerCase() === homeroomClass.toLowerCase()
      );
      const safeSlug = sanitizeFirestoreDocId(email, 'TCH').slice(0, 32);
      const department = normalizeText(merged.department);
      const employmentType = normalizeText(merged.employmentType);
      const teacherGender = normalizeText(merged.gender);
      const entity: Teacher = {
        id: String(existingRecord?.id || `TCH-${safeSlug}`),
        fullName: normalizeText(merged.fullName),
        ...(teacherGender ? { gender: teacherGender as Teacher['gender'] } : {}),
        subject: normalizeText(merged.subject),
        email: normalizeText(merged.email),
        phone: normalizeText(merged.phone),
        isHomeroom: Boolean(homeroomClass),
        ...(homeroomClass
          ? {
              homeroomClassName: homeroomClass,
              homeroomClassId: matchedHomeroom?.id || sanitizeFirestoreDocId(`CLS-${homeroomClass}`, 'CLS'),
            }
          : {}),
        ...(assignedList.length > 0 ? { assignedClasses: assignedList } : {}),
        ...(department ? { department } : {}),
        ...(employmentType ? { employmentType } : {}),
        status: (normalizeText(merged.status) as Teacher['status']) || 'Đang công tác',
        role: homeroomClass ? 'homeroom_teacher' : 'subject_teacher',
        notes: normalizeText(merged.notes) || undefined,
      };
      return entity as unknown as Record<string, unknown>;
    }

    case 'staff': {
      const code = normalizeText(merged.staffCode);
      const staffGender = normalizeText(merged.gender);
      const staffEmploymentType = normalizeText(merged.employmentType);
      const entity: StaffMember = {
        id: String(existingRecord?.id || sanitizeFirestoreDocId(code, 'STF')),
        staffCode: code,
        fullName: normalizeText(merged.fullName),
        ...(staffGender ? { gender: staffGender as StaffMember['gender'] } : {}),
        department: (normalizeText(merged.department) as StaffMember['department']) || 'Văn phòng',
        position: normalizeText(merged.position) || 'Nhân viên',
        email: normalizeText(merged.email),
        phone: normalizeText(merged.phone),
        ...(staffEmploymentType ? { employmentType: staffEmploymentType } : {}),
        status: (normalizeText(merged.status) as StaffMember['status']) || 'Đang công tác',
        notes: normalizeText(merged.notes) || undefined,
      };
      return entity as unknown as Record<string, unknown>;
    }

    case 'classes': {
      const code = normalizeText(merged.code || merged.name);
      const name = normalizeText(merged.name || code);
      const teacherRef = normalizeText(merged.homeroomTeacherName);
      const matchedTeacher = (context.teachers || []).find(
        (t) =>
          t.fullName.toLowerCase() === teacherRef.toLowerCase() ||
          t.email.toLowerCase() === teacherRef.toLowerCase() ||
          t.id.toLowerCase() === teacherRef.toLowerCase()
      );
      const existingStudentsCount = (context.students || []).filter(
        (s) => s.className.toLowerCase() === name.toLowerCase()
      ).length;
      const entity: SchoolClass = {
        id: String(existingRecord?.id || sanitizeFirestoreDocId(`CLS-${code}`, 'CLS')),
        code,
        name,
        grade: Number(merged.grade) || 10,
        academicYear: normalizeText(merged.academicYear) || context.systemSettings?.academicYear || '2026 - 2027',
        homeroomTeacherId: matchedTeacher?.id || String(existingRecord?.homeroomTeacherId || ''),
        homeroomTeacherName: matchedTeacher?.fullName || teacherRef || 'Chưa phân công',
        room: normalizeText(merged.room) || 'Chưa xếp phòng',
        studentCount: Number(existingRecord?.studentCount ?? existingStudentsCount),
      };
      return entity as unknown as Record<string, unknown>;
    }

    case 'academic_years': {
      const name = normalizeText(merged.name);
      const safeId = sanitizeFirestoreDocId(`YR-${name}`, 'YR');
      const entity: AcademicYearConfig = {
        id: String(existingRecord?.id || safeId),
        name,
        currentSemester: (normalizeText(merged.currentSemester) as 'HK1' | 'HK2') || 'HK1',
        startDate: normalizeText(merged.startDate),
        endDate: normalizeText(merged.endDate),
        status: (normalizeText(merged.status) as AcademicYearConfig['status']) || 'Đang diễn ra',
      };
      return entity as unknown as Record<string, unknown>;
    }

    case 'class_placements': {
      const studentCode = normalizeText(merged.studentCode);
      const className = normalizeText(merged.className);
      const academicYear = normalizeText(merged.academicYear) || context.systemSettings?.academicYear || '2026 - 2027';
      const student = (context.students || []).find(
        (s) => normalizeCode(s.studentCode) === normalizeCode(studentCode)
      );
      const cls = (context.classes || []).find(
        (c) => c.name.toLowerCase() === className.toLowerCase()
      );
      const id = sanitizeFirestoreDocId(`PLC-${academicYear}-${studentCode}`, 'PLC');
      const entity: ClassPlacement = {
        id,
        studentId: student?.id || sanitizeFirestoreDocId(studentCode, 'STU'),
        studentCode,
        studentName: student?.fullName || studentCode,
        classId: cls?.id || sanitizeFirestoreDocId(`CLS-${className}`, 'CLS'),
        className,
        grade: cls?.grade || student?.grade || 10,
        academicYear,
        placementType: (normalizeText(merged.placementType) as ClassPlacement['placementType']) || 'Xếp lớp đầu năm',
        effectiveDate: normalizeText(merged.effectiveDate) || today,
        notes: normalizeText(merged.notes) || undefined,
        createdBy: extra?.actorName || 'Hệ thống',
        createdAt: nowIso,
      };
      return entity as unknown as Record<string, unknown>;
    }

    case 'teaching_assignments': {
      const teacherRef = normalizeText(merged.teacherName || merged.teacherCode);
      const className = normalizeText(merged.className);
      const subject = normalizeText(merged.subject);
      const academicYear = normalizeText(merged.academicYear) || context.systemSettings?.academicYear || '2026 - 2027';
      const semester = (normalizeText(merged.semester) as TeachingAssignment['semester']) || 'Cả năm';
      const teacher = (context.teachers || []).find(
        (t) =>
          t.fullName.toLowerCase() === teacherRef.toLowerCase() ||
          t.email.toLowerCase() === teacherRef.toLowerCase() ||
          t.id.toLowerCase() === teacherRef.toLowerCase()
      );
      const cls = (context.classes || []).find(
        (c) => c.name.toLowerCase() === className.toLowerCase()
      );
      const id = sanitizeFirestoreDocId(`TA-${teacher?.id || teacherRef}-${className}-${semester}-${Date.now().toString().slice(-4)}`, 'TA');
      const entity: TeachingAssignment = {
        id: String(existingRecord?.id || id),
        teacherId: teacher?.id || teacherRef,
        teacherName: teacher?.fullName || teacherRef,
        classId: cls?.id || sanitizeFirestoreDocId(`CLS-${className}`, 'CLS'),
        className,
        subject,
        academicYear,
        semester,
        role: (normalizeText(merged.role) as TeachingAssignment['role']) || 'Giáo viên bộ môn',
        createdAt: String(existingRecord?.createdAt || nowIso),
      };
      return entity as unknown as Record<string, unknown>;
    }

    case 'users':
    case 'role_assignments': {
      const email = normalizeText(merged.email).toLowerCase();
      const safeId = String(existingRecord?.id || `USR-${email.replace(/[^a-z0-9]/g, '_').slice(0, 60)}`);
      const assignedClasses =
        typeof merged.assignedClasses === 'string'
          ? merged.assignedClasses
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : Array.isArray(merged.assignedClasses)
          ? (merged.assignedClasses as string[])
          : existingRecord?.assignedClasses;
      const entity: UserProfile = {
        id: safeId,
        email,
        displayName: normalizeText(merged.displayName) || String(existingRecord?.displayName || email),
        role: (normalizeText(merged.role) as UserRole) || 'student',
        status: (normalizeText(merged.status) as UserProfile['status']) || 'active',
        ...(normalizeText(merged.studentCode) ? { studentCode: normalizeText(merged.studentCode) } : {}),
        ...(normalizeText(merged.className) ? { className: normalizeText(merged.className) } : {}),
        ...(normalizeText(merged.phone) ? { phone: normalizeText(merged.phone) } : {}),
        ...(Array.isArray(assignedClasses) && assignedClasses.length > 0 ? { assignedClasses } : {}),
        createdAt: String(existingRecord?.createdAt || nowIso),
        updatedAt: nowIso,
      };
      return entity as unknown as Record<string, unknown>;
    }

    case 'timetable': {
      const className = normalizeText(merged.className);
      const dayOfWeek = Number(merged.dayOfWeek) || 2;
      const period = Number(merged.period) || 1;
      const cls = (context.classes || []).find((c) => c.name.toLowerCase() === className.toLowerCase());
      const id = String(existingRecord?.id || sanitizeFirestoreDocId(`TT-${className}-D${dayOfWeek}-P${period}`, 'TT'));
      const entity: TimetableEntry = {
        id,
        classId: cls?.id || sanitizeFirestoreDocId(`CLS-${className}`, 'CLS'),
        className,
        dayOfWeek,
        period,
        subject: normalizeText(merged.subject),
        teacherName: normalizeText(merged.teacherName),
        room: normalizeText(merged.room),
      };
      return entity as unknown as Record<string, unknown>;
    }

    case 'grades': {
      const studentCode = normalizeText(merged.studentCode);
      const student = (context.students || []).find(
        (s) => normalizeCode(s.studentCode) === normalizeCode(studentCode)
      );
      const subjectName = normalizeText(merged.subjectName);
      const semester = (normalizeText(merged.semester) as 'HK1' | 'HK2') || 'HK1';
      const regularArr = normalizeText(merged.scoreRegularText)
        .split(/[;,]/)
        .map((s) => Number(s.trim().replace(',', '.')))
        .filter((n) => Number.isFinite(n));
      const scoreMidterm = Number(merged.scoreMidterm) || 0;
      const scoreFinal = Number(merged.scoreFinal) || 0;
      const averageScore = calculateSubjectGPA(
        {
          scoreRegular: regularArr,
          scoreMidterm,
          scoreFinal,
        },
        extra?.gradeWeights || DEFAULT_GRADE_WEIGHTS
      );
      const subId = sanitizeFirestoreDocId(`SUB-${subjectName.slice(0, 12) || 'MON'}`, 'SUB');
      const id = String(
        existingRecord?.id || sanitizeFirestoreDocId(`GRD-${studentCode}-${subId}-${semester}`, 'GRD')
      );
      const entity: AcademicRecord = {
        id,
        studentId: student?.id || studentCode,
        studentName: student?.fullName || studentCode,
        studentCode,
        classId: student?.classId || sanitizeFirestoreDocId(`CLS-${student?.className || '10A1'}`, 'CLS'),
        className: student?.className || normalizeText(merged.className) || '10A1',
        subjectId: subId,
        subjectName,
        semester,
        academicYear: normalizeText(merged.academicYear) || context.systemSettings?.academicYear || '2026 - 2027',
        scoreRegular: regularArr,
        scoreMidterm,
        scoreFinal,
        averageScore,
        status: (normalizeText(merged.status) as 'draft' | 'published') || 'draft',
        updatedBy: extra?.actorName || 'Hệ thống',
        updatedAt: nowIso,
      };
      return entity as unknown as Record<string, unknown>;
    }

    case 'attendance': {
      const date = normalizeText(merged.date) || today;
      const studentCode = normalizeText(merged.studentCode);
      const student = (context.students || []).find(
        (s) => normalizeCode(s.studentCode) === normalizeCode(studentCode)
      );
      const className = normalizeText(merged.className) || student?.className || '10A1';
      const entity: AttendanceRecord = {
        id: String(existingRecord?.id || sanitizeFirestoreDocId(`ATT-${date}-${student?.id || studentCode}`, 'ATT')),
        date,
        classId: student?.classId || sanitizeFirestoreDocId(`CLS-${className}`, 'CLS'),
        className,
        studentId: student?.id || studentCode,
        studentName: student?.fullName || studentCode,
        studentCode,
        status: (normalizeText(merged.status) as AttendanceRecord['status']) || 'present',
        reason: normalizeText(merged.reason) || undefined,
        recordedBy: extra?.actorName || 'Hệ thống',
      };
      return entity as unknown as Record<string, unknown>;
    }

    case 'assignments': {
      const className = normalizeText(merged.className);
      const entity: Assignment = {
        id: String(existingRecord?.id || `ASM-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
        title: normalizeText(merged.title),
        subject: normalizeText(merged.subject),
        classId: `CLS-${className}`,
        className,
        dueDate: normalizeText(merged.dueDate) || today,
        description: normalizeText(merged.description) || '',
        teacherName: extra?.actorName || 'Giáo viên',
        points: Number(merged.points) || 10,
        status: 'open',
        createdAt: String(existingRecord?.createdAt || today),
      };
      return entity as unknown as Record<string, unknown>;
    }

    case 'materials': {
      const entity: LearningMaterial = {
        id: String(existingRecord?.id || `MAT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
        title: normalizeText(merged.title),
        subject: normalizeText(merged.subject),
        grade: Number(merged.grade) || 10,
        type: (normalizeText(merged.type) as LearningMaterial['type']) || 'PDF',
        urlOrNote: normalizeText(merged.urlOrNote),
        uploadedBy: extra?.actorName || 'Giáo viên',
        uploadedAt: today,
      };
      return entity as unknown as Record<string, unknown>;
    }

    case 'books': {
      const totalCopies = Math.max(1, Number(merged.totalCopies) || 1);
      const bookCode =
        normalizeText(merged.bookCode) ||
        `BOK-${Date.now().toString().slice(-5)}${Math.floor(10 + Math.random() * 89)}`;
      const entity: Book = {
        id: String(existingRecord?.id || sanitizeFirestoreDocId(bookCode, 'BOK')),
        bookCode,
        isbn: normalizeText(merged.isbn),
        title: normalizeText(merged.title),
        author: normalizeText(merged.author),
        category: normalizeText(merged.category) || 'Sách giáo khoa & Tham khảo',
        publisher: normalizeText(merged.publisher) || 'NXB Giáo Dục',
        publishYear: Number(merged.publishYear) || 2025,
        totalCopies,
        availableCopies: existingRecord
          ? Math.min(totalCopies, Number(existingRecord.availableCopies ?? totalCopies))
          : totalCopies,
        shelfLocation: normalizeText(merged.shelfLocation) || 'Kệ A1',
        coverUrl: String(existingRecord?.coverUrl || ''),
        description: normalizeText(merged.description) || 'Ấn phẩm thư viện trường học',
      };
      return entity as unknown as Record<string, unknown>;
    }

    case 'book_copies': {
      const ref = normalizeCode(merged.bookRef);
      const matchedBook = (context.books || []).find(
        (b) =>
          normalizeCode(b.id) === ref ||
          normalizeCode(b.isbn) === ref ||
          normalizeCode(b.bookCode) === ref
      );
      const barcode = normalizeText(merged.copyBarcode);
      const entity: BookCopy = {
        id: String(existingRecord?.id || sanitizeFirestoreDocId(`COPY-${barcode}`, 'COPY')),
        bookId: matchedBook?.id || String(existingRecord?.bookId || ref),
        copyBarcode: barcode,
        rfidTag: normalizeText(merged.rfidTag) || undefined,
        status: (normalizeText(merged.status) as BookCopy['status']) || 'available',
        condition: (normalizeText(merged.condition) as BookCopy['condition']) || 'Tốt',
        notes: normalizeText(merged.notes) || undefined,
        updatedAt: nowIso,
      };
      return entity as unknown as Record<string, unknown>;
    }

    case 'inventory_audits': {
      const codes = normalizeText(merged.scannedBarcodesText)
        .split(/[;,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const diff = computeInventoryAuditDiff(context.bookCopies || [], codes);
      const auditCode = normalizeText(merged.auditCode);
      const entity: InventoryAudit = {
        id: String(existingRecord?.id || sanitizeFirestoreDocId(`AUD-${auditCode}`, 'AUD')),
        auditCode,
        date: normalizeText(merged.date) || today,
        conductedBy: extra?.actorName || 'Thủ thư',
        totalBooks: (context.books || []).length,
        totalCopiesExpected: diff.totalCopiesExpected,
        scannedBarcodes: codes,
        matchedCount: diff.matchedCount,
        missingBarcodes: diff.missingBarcodes,
        notes: normalizeText(merged.notes) || undefined,
        status: 'completed',
      };
      return entity as unknown as Record<string, unknown>;
    }

    case 'borrow_migration': {
      const txCode = normalizeText(merged.transactionCode);
      const stuCode = normalizeText(merged.studentCode);
      const student = (context.students || []).find(
        (s) => normalizeCode(s.studentCode) === normalizeCode(stuCode)
      );
      const barcode = normalizeText(merged.copyBarcode);
      const copy = (context.bookCopies || []).find(
        (c) => normalizeCode(c.copyBarcode) === normalizeCode(barcode)
      );
      const book = (context.books || []).find((b) => b.id === copy?.bookId);
      const entity: BorrowTransaction = {
        id: String(existingRecord?.id || sanitizeFirestoreDocId(txCode, 'BRW')),
        transactionCode: txCode,
        studentId: student?.id || stuCode,
        studentName: student?.fullName || stuCode,
        studentCode: stuCode,
        bookId: book?.id || copy?.bookId || 'HIST-BOOK',
        bookTitle: book?.title || `Sách chuyển đổi (${barcode})`,
        copyId: copy?.id,
        copyBarcode: barcode,
        borrowDate: normalizeText(merged.borrowDate) || today,
        dueDate: normalizeText(merged.dueDate) || today,
        returnDate: normalizeText(merged.returnDate) || undefined,
        status: (normalizeText(merged.status) as BorrowTransaction['status']) || 'returned',
        notes: 'Chuyển đổi dữ liệu lịch sử có kiểm soát',
      };
      return entity as unknown as Record<string, unknown>;
    }

    case 'survey_questions': {
      const title = normalizeText(merged.title);
      const extraQuestionsRows = (extra?.extraSheets?.CAU_HOI_KHAO_SAT || []).filter(
        (r) => normalizeText(r['Tiêu đề khảo sát *'] ?? r.surveyTitle).toLowerCase() === title.toLowerCase()
      );
      const questions: SurveyQuestion[] = extraQuestionsRows.map((r, idx) => {
        const optsRaw = normalizeText(r['Danh sách lựa chọn (cách dấu ;)'] ?? r.optionsText);
        const options = optsRaw
          ? optsRaw.split(';').map((s) => s.trim()).filter(Boolean)
          : undefined;
        return {
          id: `Q-${idx + 1}`,
          text: normalizeText(r['Nội dung câu hỏi *'] ?? r.text),
          type: (normalizeText(r['Loại câu hỏi *'] ?? r.type) as SurveyQuestion['type']) || 'single',
          ...(options && options.length > 0 ? { options } : {}),
          required: normalizeText(r['Bắt buộc'] ?? r.required) !== 'Không',
        };
      });
      if (questions.length === 0 && normalizeText(merged.questionText)) {
        const optsRaw = normalizeText(merged.optionsText);
        const options = optsRaw
          ? optsRaw.split(';').map((s) => s.trim()).filter(Boolean)
          : undefined;
        questions.push({
          id: 'Q-1',
          text: normalizeText(merged.questionText),
          type: (normalizeText(merged.questionType) as SurveyQuestion['type']) || 'rating',
          ...(options && options.length > 0 ? { options } : {}),
          required: true,
        });
      }
      const entity: Survey = {
        id: String(existingRecord?.id || `SRV-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`),
        title,
        description: normalizeText(merged.description) || 'Khảo sát học đường',
        targetAudience: (normalizeText(merged.targetAudience) as Survey['targetAudience']) || 'Toàn trường',
        startDate: normalizeText(merged.startDate) || today,
        endDate: normalizeText(merged.endDate) || today,
        isAnonymous: normalizeText(merged.isAnonymous) !== 'Không',
        status: 'active',
        questions,
        responsesCount: Number(existingRecord?.responsesCount ?? 0),
        createdBy: extra?.actorName || 'Nhà trường',
      };
      return entity as unknown as Record<string, unknown>;
    }

    case 'leave_migration': {
      const code = normalizeText(merged.requestCode);
      const stuCode = normalizeText(merged.studentCode);
      const student = (context.students || []).find(
        (s) => normalizeCode(s.studentCode) === normalizeCode(stuCode)
      );
      const entity: StudentLeaveRequest = {
        id: String(existingRecord?.id || sanitizeFirestoreDocId(code, 'LV')),
        requestCode: code,
        studentId: student?.id || stuCode,
        studentName: student?.fullName || stuCode,
        studentCode: stuCode,
        className: student?.className || '10A1',
        type: (normalizeText(merged.type) as StudentLeaveRequest['type']) || 'Nghỉ ốm',
        fromDate: normalizeText(merged.fromDate) || today,
        toDate: normalizeText(merged.toDate) || today,
        reason: normalizeText(merged.reason),
        status: (normalizeText(merged.status) as StudentLeaveRequest['status']) || 'approved',
        reviewedBy: extra?.actorName || 'Chuyển đổi lịch sử',
        createdAt: nowIso,
      };
      return entity as unknown as Record<string, unknown>;
    }

    case 'feedback_migration': {
      const code = normalizeText(merged.reportCode);
      const entity: FeedbackReport = {
        id: String(existingRecord?.id || sanitizeFirestoreDocId(code, 'FB')),
        reportCode: code,
        title: normalizeText(merged.title),
        category: (normalizeText(merged.category) as FeedbackReport['category']) || 'Khác',
        content: normalizeText(merged.content),
        location: normalizeText(merged.location) || 'Toàn trường',
        priority: 'medium',
        isAnonymous: true,
        studentId: 'MIGRATED',
        studentName: 'Dữ liệu lịch sử',
        studentClass: 'N/A',
        status: (normalizeText(merged.status) as FeedbackReport['status']) || 'resolved',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      return entity as unknown as Record<string, unknown>;
    }

    case 'announcements': {
      const entity: Announcement = {
        id: String(existingRecord?.id || `ANN-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
        title: normalizeText(merged.title),
        content: normalizeText(merged.content),
        category: (normalizeText(merged.category) as Announcement['category']) || 'Toàn trường',
        targetAudience: (normalizeText(merged.targetAudience) as Announcement['targetAudience']) || 'Toàn trường',
        isPinned: false,
        priority: (normalizeText(merged.priority) as Announcement['priority']) || 'normal',
        // Default safely to 'draft' unless explicitly chosen & confirmed
        status: (normalizeText(merged.status) as Announcement['status']) || 'draft',
        authorName: extra?.actorName || 'Ban Truyền thông',
        authorRole: extra?.actorRole || 'admin',
        publishedAt: nowIso,
      };
      return entity as unknown as Record<string, unknown>;
    }

    case 'events': {
      const entity: SchoolEvent = {
        id: String(existingRecord?.id || `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
        title: normalizeText(merged.title),
        date: normalizeText(merged.date) || today,
        time: normalizeText(merged.time) || '08:00 - 11:00',
        location: normalizeText(merged.location),
        organizer: normalizeText(merged.organizer) || 'Đoàn trường',
        category: (normalizeText(merged.category) as SchoolEvent['category']) || 'Học thuật',
        status: (normalizeText(merged.status) as SchoolEvent['status']) || 'upcoming',
        capacity: Number(merged.capacity) || 200,
        registeredUserIds: (existingRecord?.registeredUserIds as string[]) || [],
        description: normalizeText(merged.description) || '',
      };
      return entity as unknown as Record<string, unknown>;
    }

    case 'rooms': {
      const code = normalizeText(merged.code);
      const entity: SchoolRoom = {
        id: String(existingRecord?.id || sanitizeFirestoreDocId(`RM-${code}`, 'RM')),
        code,
        name: normalizeText(merged.name),
        building: normalizeText(merged.building) || 'Nhà A',
        floor: normalizeText(merged.floor) || 'Tầng 1',
        capacity: Number(merged.capacity) || 45,
        roomType: (normalizeText(merged.roomType) as SchoolRoom['roomType']) || 'Phòng học',
        status: (normalizeText(merged.status) as SchoolRoom['status']) || 'Sẵn sàng',
        assignedClassName: normalizeText(merged.assignedClassName) || undefined,
      };
      return entity as unknown as Record<string, unknown>;
    }

    case 'facilities': {
      const code = normalizeText(merged.code);
      const entity: FacilityAsset = {
        id: String(existingRecord?.id || sanitizeFirestoreDocId(code, 'AST')),
        code,
        name: normalizeText(merged.name),
        category: (normalizeText(merged.category) as FacilityAsset['category']) || 'Thiết bị trình chiếu',
        roomLocation: normalizeText(merged.roomLocation),
        condition: (normalizeText(merged.condition) as FacilityAsset['condition']) || 'Tốt',
        status: (normalizeText(merged.status) as FacilityAsset['status']) || 'Đang sử dụng',
        lastInspected: normalizeText(merged.lastInspected) || today,
        notes: normalizeText(merged.notes) || undefined,
      };
      return entity as unknown as Record<string, unknown>;
    }

    case 'maintenance_plans': {
      const code = normalizeText(merged.requestCode);
      const entity: MaintenanceRequest = {
        id: String(existingRecord?.id || sanitizeFirestoreDocId(code, 'MNT')),
        requestCode: code,
        assetName: normalizeText(merged.assetName),
        roomLocation: normalizeText(merged.roomLocation),
        reportedBy: extra?.actorName || 'Kế hoạch bảo trì',
        reporterRole: 'Kế hoạch định kỳ',
        issueDescription: normalizeText(merged.issueDescription),
        priority: (normalizeText(merged.priority) as MaintenanceRequest['priority']) || 'medium',
        status: 'reported',
        assignedStaff: normalizeText(merged.assignedStaff) || undefined,
        reportedAt: normalizeText(merged.reportedAt) || today,
      };
      return entity as unknown as Record<string, unknown>;
    }

    case 'rule_criteria': {
      const code = normalizeText(merged.code) || `TC-${Date.now().toString().slice(-5)}`;
      const catName = normalizeText(merged.categoryName) || 'Nề nếp chung';
      const matchedCat = (context.ruleCategories || []).find(
        (c) => c.name.toLowerCase() === catName.toLowerCase()
      );
      const rawPoints = merged.points;
      const hasPoints =
        rawPoints !== '' && rawPoints !== null && rawPoints !== undefined && Number.isFinite(Number(rawPoints));
      const parsedPoints = hasPoints ? Number(rawPoints) : null;
      const ruleSeverity = normalizeText(merged.severity);
      const entity: RuleCriterion = {
        id: String(existingRecord?.id || sanitizeFirestoreDocId(`RC-${code}`, 'RC')),
        code,
        categoryId: matchedCat?.id || sanitizeFirestoreDocId(`CAT-${catName}`, 'CAT').slice(0, 24),
        categoryName: catName,
        name: normalizeText(merged.name),
        description: normalizeText(merged.behavior || merged.description),
        behavior: normalizeText(merged.behavior || merged.name),
        type: merged.type === 'achievement' ? 'achievement' : 'violation',
        points: parsedPoints,
        pointsSpecified: hasPoints,
        targetScope: (normalizeText(merged.targetScope) as RuleCriterion['targetScope']) || 'individual',
        ...(ruleSeverity ? { severity: ruleSeverity as RuleCriterion['severity'] } : {}),
        condition: normalizeText(merged.condition) || undefined,
        status: 'active',
        createdBy: extra?.actorName || 'Ban Giám hiệu',
        createdAt: String(existingRecord?.createdAt || nowIso),
        updatedAt: nowIso,
      };
      return entity as unknown as Record<string, unknown>;
    }

    case 'emulation_records': {
      const recordCode = normalizeText(merged.recordCode) || `TD-${Date.now().toString().slice(-6)}`;
      const stuCode = normalizeText(merged.studentCode);
      const student = stuCode
        ? (context.students || []).find((s) => normalizeCode(s.studentCode) === normalizeCode(stuCode))
        : undefined;
      const className = normalizeText(merged.className) || student?.className || '';
      const cls = (context.classes || []).find(
        (c) => c.name.toLowerCase() === className.toLowerCase()
      );
      const critName = normalizeText(merged.criterionName);
      const matchedCrit = (context.ruleCriteria || []).find(
        (c) => c.name.toLowerCase() === critName.toLowerCase() || c.code.toLowerCase() === critName.toLowerCase()
      );
      const type = (merged.type === 'achievement' ? 'achievement' : 'violation') as EmulationRecord['type'];
      const rawPts = Number(merged.pointsApplied) || 0;
      const signedPts =
        type === 'violation' && rawPts > 0
          ? -rawPts
          : type === 'achievement' && rawPts < 0
          ? Math.abs(rawPts)
          : rawPts;
      const emuSeverity = normalizeText(merged.severity);
      const entity: EmulationRecord = {
        id: String(existingRecord?.id || sanitizeFirestoreDocId(`EMU-${recordCode}`, 'EMU')),
        recordCode,
        targetType: (normalizeText(merged.targetType) as EmulationRecord['targetType']) || 'individual',
        ...(student ? { studentId: student.id, studentCode: student.studentCode, studentName: student.fullName } : stuCode ? { studentCode: stuCode } : {}),
        classId: cls?.id || (className ? sanitizeFirestoreDocId(`CLS-${className}`, 'CLS') : undefined),
        className: className || undefined,
        grade: cls?.grade || student?.grade,
        criterionId: matchedCrit?.id || 'MANUAL-CRIT',
        criterionName: matchedCrit?.name || critName,
        categoryName: matchedCrit?.categoryName || 'Nề nếp chung',
        type,
        ...(emuSeverity ? { severity: emuSeverity as EmulationRecord['severity'] } : {}),
        pointsApplied: signedPts,
        occurredAt: normalizeText(merged.occurredAt) || today,
        description: normalizeText(merged.description),
        reporterId: 'EXCEL_IMPORT',
        reporterName: extra?.actorName || 'Hệ thống',
        reporterRole: extra?.actorRole || 'admin',
        status: (normalizeText(merged.status) as EmulationRecord['status']) || 'pending_verification',
        createdAt: String(existingRecord?.createdAt || nowIso),
        updatedAt: nowIso,
      };
      return entity as unknown as Record<string, unknown>;
    }

    default:
      return {
        id: String(existingRecord?.id || `EXT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
        ...merged,
      };
  }
}

export function buildImportExecutionPlan(params: {
  report: ImportPreviewReport;
  mode: ImportMode;
  errorPolicy: ErrorPolicy;
  context: ValidationDbContext;
  existingRecords: Record<string, unknown>[];
  extra: ProcessorExtraContext;
}): {
  entitiesToSave: Record<string, unknown>[];
  result: ImportExecutionResult;
  historyRecord: ImportHistoryRecord;
} {
  const { report, mode, errorPolicy, context, existingRecords, extra } = params;
  const schema = getSchemaByKey(report.schemaKey);

  const errorRows = report.rows.filter(
    (r) => r.status === 'invalid' || r.status === 'duplicate'
  );
  const allIssues = report.rows.flatMap((r) => r.issues);

  if (report.headerErrors.length > 0 || (errorPolicy === 'abort_on_error' && errorRows.length > 0)) {
    const result: ImportExecutionResult = {
      schemaKey: report.schemaKey,
      fileName: report.fileName,
      mode,
      errorPolicy,
      totalRows: report.totalRows,
      createdCount: 0,
      updatedCount: 0,
      failedCount: errorRows.length,
      skippedCount: report.totalRows - errorRows.length,
      issues: allIssues,
      completedAt: new Date().toISOString(),
      aborted: true,
    };
    const historyRecord: ImportHistoryRecord = {
      id: `IMP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      moduleKey: schema.key,
      moduleTitle: schema.title,
      appId: schema.appId,
      fileName: report.fileName,
      mode,
      errorPolicy,
      totalRows: report.totalRows,
      successCount: 0,
      createdCount: 0,
      updatedCount: 0,
      failedCount: errorRows.length,
      skippedCount: report.totalRows - errorRows.length,
      actorName: extra.actorName,
      actorRole: extra.actorRole,
      status: 'aborted',
      timestamp: result.completedAt,
      summaryNote:
        report.headerErrors[0] ||
        `Hủy toàn bộ lần nhập do có ${errorRows.length} dòng lỗi theo chính sách an toàn.`,
    };
    return { entitiesToSave: [], result, historyRecord };
  }

  const entitiesToSave: Record<string, unknown>[] = [];
  let createdCount = 0;
  let updatedCount = 0;

  for (const row of report.rows) {
    if (row.status !== 'valid_create' && row.status !== 'valid_update') continue;
    const existing = row.existingId
      ? existingRecords.find((r) => String(r.id) === row.existingId)
      : undefined;
    const entity = buildDomainEntityFromNormalized(
      schema.key,
      row.normalizedData,
      context,
      existing,
      row.rawData,
      { ...extra, extraSheets: report.extraSheetRows }
    );
    entitiesToSave.push(entity);
    if (row.status === 'valid_update') updatedCount += 1;
    else createdCount += 1;
  }

  const failedCount = errorRows.length;
  const skippedCount = report.rows.filter((r) => r.status === 'skipped').length + failedCount;
  const successCount = createdCount + updatedCount;
  const completedAt = new Date().toISOString();

  const result: ImportExecutionResult = {
    schemaKey: schema.key,
    fileName: report.fileName,
    mode,
    errorPolicy,
    totalRows: report.totalRows,
    createdCount,
    updatedCount,
    failedCount,
    skippedCount,
    issues: allIssues,
    completedAt,
    aborted: false,
  };

  const historyRecord: ImportHistoryRecord = {
    id: `IMP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    moduleKey: schema.key,
    moduleTitle: schema.title,
    appId: schema.appId,
    fileName: report.fileName,
    mode,
    errorPolicy,
    totalRows: report.totalRows,
    successCount,
    createdCount,
    updatedCount,
    failedCount,
    skippedCount,
    actorName: extra.actorName,
    actorRole: extra.actorRole,
    status: failedCount > 0 ? 'partial' : 'completed',
    timestamp: completedAt,
    summaryNote: `Thêm mới ${createdCount}, cập nhật ${updatedCount}, lỗi/bỏ qua ${failedCount}.`,
  };

  return { entitiesToSave, result, historyRecord };
}
