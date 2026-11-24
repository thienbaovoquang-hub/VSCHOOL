import type {
  AcademicRecord,
  Announcement,
  AttendanceRecord,
  Book,
  BookCopy,
  BorrowTransaction,
  EmulationRecord,
  FacilityAsset,
  FieldDiff,
  ImportMode,
  ImportModuleSchema,
  ImportPreviewReport,
  MaintenanceRequest,
  RuleCategory,
  RuleCriterion,
  SchemaFieldDef,
  SchoolClass,
  SchoolRoom,
  StaffMember,
  Student,
  StudentLeaveRequest,
  Teacher,
  TeachingAssignment,
  TimetableEntry,
  UserProfile,
  ValidatedImportRow,
  ValidationIssue,
} from '../../types';
import {
  buildCatalogLists,
  getFieldHeaderAliases,
  type SchemaRuntimeContext,
} from './schemas';
import { inferRowDefaultsFromSheetName } from './sheetGrouping';
import { detectTimetableConflicts } from '../academicRules';
import {
  normalizeCatalogInputValue,
  resolveCatalogOptions,
  validateDependentFieldValue,
} from '../catalogs/catalogRegistry';
import type { DataCatalogOption } from '../../types';

export interface ParsedRowOrigin {
  sheetName: string;
  rowNumber: number;
  row: Record<string, unknown>;
}

export interface ParsedWorkbookData {
  fileName: string;
  sheetNames: string[];
  dataSheetName: string;
  dataSheetNames?: string[];
  headers: string[];
  sheetHeaders?: Record<string, string[]>;
  rows: Record<string, unknown>[];
  rowItems?: ParsedRowOrigin[];
  extraSheets: Record<string, Record<string, unknown>[]>;
  templateVersionFound?: string;
  templateModuleFound?: string;
}

export interface ValidationDbContext extends SchemaRuntimeContext {
  userAccounts?: UserProfile[];
  staffMembers?: StaffMember[];
  teachingAssignments?: TeachingAssignment[];
  timetable?: TimetableEntry[];
  academicRecords?: AcademicRecord[];
  attendanceRecords?: AttendanceRecord[];
  leaveRequests?: StudentLeaveRequest[];
  bookCopies?: BookCopy[];
  borrowTransactions?: BorrowTransaction[];
  facilities?: FacilityAsset[];
  maintenanceRequests?: MaintenanceRequest[];
  ruleCategories?: RuleCategory[];
  ruleCriteria?: RuleCriterion[];
  emulationRecords?: EmulationRecord[];
  announcements?: Announcement[];
}

export function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().split('T')[0];
  }
  return String(value).replace(/\u00A0/g, ' ').trim();
}

export function normalizeCode(value: unknown): string {
  return normalizeText(value).toUpperCase();
}

export function normalizeDateValue(raw: unknown): { valid: boolean; value: string; error?: string } {
  if (raw === null || raw === undefined || raw === '') {
    return { valid: true, value: '' };
  }

  // Excel serial number (since 1899-12-30)
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 1000 && raw < 100000) {
    const utcDays = Math.floor(raw - 25569);
    const utcMs = utcDays * 86400 * 1000;
    const d = new Date(utcMs);
    if (!Number.isNaN(d.getTime())) {
      return { valid: true, value: d.toISOString().split('T')[0] };
    }
  }

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return { valid: true, value: raw.toISOString().split('T')[0] };
  }

  const str = normalizeText(raw);
  if (!str) return { valid: true, value: '' };

  // Match YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === m && dt.getUTCDate() === d) {
      return {
        valid: true,
        value: `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      };
    }
    return { valid: false, value: str, error: `Ngày không tồn tại: "${str}"` };
  }

  // Match DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const d = Number(dmyMatch[1]);
    const m = Number(dmyMatch[2]);
    const y = Number(dmyMatch[3]);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === m && dt.getUTCDate() === d) {
      return {
        valid: true,
        value: `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      };
    }
    return { valid: false, value: str, error: `Ngày không tồn tại: "${str}"` };
  }

  return {
    valid: false,
    value: str,
    error: `Sai định dạng ngày "${str}" (yêu cầu YYYY-MM-DD hoặc DD/MM/YYYY)`,
  };
}

export function normalizePhoneValue(raw: unknown): { valid: boolean; value: string; error?: string } {
  const str = normalizeText(raw);
  if (!str) return { valid: true, value: '' };
  const compact = str.replace(/[\s.-]/g, '');
  if (!/^(\+?\d{9,13})$/.test(compact)) {
    return {
      valid: false,
      value: str,
      error: `Số điện thoại "${str}" không hợp lệ (cần 9-13 chữ số)`,
    };
  }
  return { valid: true, value: compact };
}

export function validateEmailValue(raw: unknown): { valid: boolean; value: string; error?: string } {
  const str = normalizeText(raw);
  if (!str) return { valid: true, value: '' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(str)) {
    return {
      valid: false,
      value: str,
      error: `Email "${str}" không đúng định dạng`,
    };
  }
  return { valid: true, value: str.toLowerCase() };
}

export function validateSingleField(
  field: SchemaFieldDef,
  rawValue: unknown,
  options?: { treatBlankAsOptional?: boolean; catalogOptions?: DataCatalogOption[] }
): { valid: boolean; value: unknown; error?: string } {
  const rawStr = normalizeText(rawValue);
  const isEmpty = rawStr.length === 0;

  if (isEmpty) {
    if (field.required && !options?.treatBlankAsOptional) {
      return {
        valid: false,
        value: '',
        error: `Thiếu thông tin bắt buộc: ${field.label}`,
      };
    }
    return {
      valid: true,
      value: !options?.treatBlankAsOptional && field.defaultValue !== undefined ? field.defaultValue : '',
    };
  }

  if (field.type === 'date') {
    return normalizeDateValue(rawValue);
  }

  if (field.type === 'phone') {
    return normalizePhoneValue(rawValue);
  }

  if (field.type === 'email') {
    return validateEmailValue(rawValue);
  }

  const dynamicCatalogOpts = options?.catalogOptions;

  if (field.type === 'number' || field.type === 'integer') {
    const cleaned = rawStr.replace(',', '.');
    const num = Number(cleaned);
    if (!Number.isFinite(num)) {
      return {
        valid: false,
        value: rawValue,
        error: `${field.label} phải là giá trị số (nhận được "${rawStr}")`,
      };
    }
    if (field.type === 'integer' && !Number.isInteger(num)) {
      return {
        valid: false,
        value: num,
        error: `${field.label} phải là số nguyên`,
      };
    }
    if (field.min !== undefined && num < field.min) {
      return {
        valid: false,
        value: num,
        error: `${field.label} phải >= ${field.min}`,
      };
    }
    if (field.max !== undefined && num > field.max) {
      return {
        valid: false,
        value: num,
        error: `${field.label} phải <= ${field.max}`,
      };
    }
    if (field.catalogId && dynamicCatalogOpts && dynamicCatalogOpts.length > 0) {
      const normRes = normalizeCatalogInputValue(String(num), dynamicCatalogOpts);
      if (!normRes.matched) {
        const validList = dynamicCatalogOpts.map((o) => o.value);
        return {
          valid: false,
          value: num,
          error: `${field.label} "${rawStr}" không nằm trong danh mục chuẩn (${validList.join(', ')})`,
        };
      }
      return { valid: true, value: Number(normRes.value) };
    }
    return { valid: true, value: num };
  }

  if (field.catalogId && dynamicCatalogOpts && dynamicCatalogOpts.length > 0) {
    const normRes = normalizeCatalogInputValue(rawStr, dynamicCatalogOpts);
    if (normRes.matched) {
      return {
        valid: true,
        value: normRes.value,
      };
    }
    const validList = dynamicCatalogOpts.map((o) => o.value);
    if (field.type === 'enum') {
      return {
        valid: false,
        value: rawStr,
        error: `${field.label} "${rawStr}" không nằm trong danh mục chuẩn (${validList.join(', ')})`,
      };
    }
  }

  if (field.type === 'enum' && field.options && field.options.length > 0) {
    const matched = field.options.find(
      (opt) => opt.toLowerCase() === rawStr.toLowerCase()
    );
    if (!matched) {
      return {
        valid: false,
        value: rawStr,
        error: `${field.label} "${rawStr}" không nằm trong danh sách hợp lệ (${field.options.join(', ')})`,
      };
    }
    return { valid: true, value: matched };
  }

  if (field.type === 'boolean') {
    const lower = rawStr.toLowerCase();
    if (['true', '1', 'có', 'yes', 'x'].includes(lower)) return { valid: true, value: true };
    if (['false', '0', 'không', 'no'].includes(lower)) return { valid: true, value: false };
    return {
      valid: false,
      value: rawStr,
      error: `${field.label} phải là Có/Không hoặc true/false`,
    };
  }

  if (field.pattern) {
    const regex = new RegExp(field.pattern);
    if (!regex.test(rawStr)) {
      return {
        valid: false,
        value: rawStr,
        error: field.patternMessage || `${field.label} không đúng định dạng`,
      };
    }
  }

  return { valid: true, value: rawStr };
}

function getRecordBusinessKey(schema: ImportModuleSchema, record: Record<string, unknown>): string {
  switch (schema.key) {
    case 'students':
      return normalizeCode(record.studentCode);
    case 'teachers':
      return normalizeCode(record.email || record.fullName);
    case 'staff':
      return normalizeCode(record.staffCode);
    case 'classes':
      return normalizeCode(record.code || record.name);
    case 'academic_years':
      return normalizeCode(record.name);
    case 'users':
    case 'role_assignments':
      return normalizeCode(record.email);
    case 'books':
      return normalizeCode(record.isbn || record.bookCode || record.id);
    case 'book_copies':
      return normalizeCode(record.copyBarcode);
    case 'inventory_audits':
      return normalizeCode(record.auditCode);
    case 'borrow_migration':
      return normalizeCode(record.transactionCode);
    case 'survey_questions':
      return normalizeCode(record.title);
    case 'leave_migration':
      return normalizeCode(record.requestCode);
    case 'feedback_migration':
      return normalizeCode(record.reportCode);
    case 'rooms':
      return normalizeCode(record.code);
    case 'facilities':
      return normalizeCode(record.code);
    case 'maintenance_plans':
      return normalizeCode(record.requestCode);
    case 'timetable':
      return `${normalizeCode(record.className)}__D${record.dayOfWeek}__P${record.period}`;
    case 'grades':
      return `${normalizeCode(record.studentCode)}__${normalizeCode(record.subjectName)}__${normalizeCode(record.semester)}`;
    case 'attendance':
      return `${normalizeText(record.date)}__${normalizeCode(record.studentCode)}`;
    case 'teaching_assignments':
      return `${normalizeCode(record.teacherName || record.teacherCode)}__${normalizeCode(record.className)}__${normalizeCode(record.subject)}__${normalizeCode(record.semester)}`;
    case 'announcements':
      return normalizeCode(record.title);
    case 'events':
      return `${normalizeCode(record.title)}__${normalizeText(record.date)}`;
    case 'assignments':
      return `${normalizeCode(record.title)}__${normalizeCode(record.className)}`;
    case 'rule_criteria':
      return normalizeCode(record.code || record.name);
    case 'emulation_records':
      return normalizeCode(record.recordCode || record.id);
    default:
      return normalizeCode(record[schema.fields[0]?.key || 'id']);
  }
}

function findExistingRecord(
  schema: ImportModuleSchema,
  normalized: Record<string, unknown>,
  existingRecords: Record<string, unknown>[]
): Record<string, unknown> | undefined {
  const targetKey = getRecordBusinessKey(schema, normalized);
  if (!targetKey) return undefined;
  return existingRecords.find((item) => getRecordBusinessKey(schema, item) === targetKey);
}

function computeRecordDiffs(
  schema: ImportModuleSchema,
  existingRecord: Record<string, unknown>,
  incomingNormalized: Record<string, unknown>,
  rawRow: Record<string, unknown>
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  for (const field of schema.fields) {
    const rawVal = resolveRawFieldValue(field, rawRow);
    // Do NOT overwrite existing value when Excel cell is blank!
    if (normalizeText(rawVal) === '') continue;

    const nextVal = normalizeText(incomingNormalized[field.key]);
    const prevVal = normalizeText(existingRecord[field.key]);
    if (nextVal !== prevVal && nextVal !== '') {
      diffs.push({
        field: field.key,
        label: field.label,
        before: prevVal || '(trống)',
        after: nextVal,
      });
    }
  }
  return diffs;
}

export function resolveRawFieldValue(field: SchemaFieldDef, row: Record<string, unknown>): unknown {
  if (field.header in row) return row[field.header];
  if (field.key in row) return row[field.key];
  const aliases = getFieldHeaderAliases(field);
  for (const alias of aliases) {
    if (alias in row) return row[alias];
    const foundKey = Object.keys(row).find(
      (k) => k.trim().toLowerCase() === alias.toLowerCase() || k.replace(/\*+$/, '').trim().toLowerCase() === alias.replace(/\*+$/, '').trim().toLowerCase()
    );
    if (foundKey) return row[foundKey];
  }
  return undefined;
}

function checkRelationalRules(
  schema: ImportModuleSchema,
  normalized: Record<string, unknown>,
  context: ValidationDbContext,
  rowNumber: number,
  extraTimetableInFile: TimetableEntry[] = [],
  sheetName: string = 'DATA'
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const catalogs = buildCatalogLists(context);
  const addIssue = (field: string, header: string, value: unknown, message: string, severity: 'error' | 'warning' = 'error') => {
    issues.push({
      rowNumber,
      sheetName,
      field,
      header,
      value: normalizeText(value),
      message,
      severity,
    });
  };

  // Class existence check when classes exist in DB
  if ((schema.key === 'students' || schema.key === 'class_placements' || schema.key === 'teaching_assignments' || schema.key === 'timetable' || schema.key === 'assignments') && normalized.className) {
    const clsName = normalizeText(normalized.className);
    if (catalogs.classes.length > 0 && !catalogs.classes.some((c) => c.toLowerCase() === clsName.toLowerCase())) {
      addIssue('className', 'Lớp', clsName, `Lớp "${clsName}" chưa tồn tại trong danh mục Lớp học của trường.`);
    }
  }

  // Dependent catalog validation (e.g., Khối -> Lớp, Tổ chuyên môn -> Bộ môn)
  for (const field of schema.fields) {
    if (!field.parentFieldKey) continue;
    const childVal = normalized[field.key];
    const parentVal = normalized[field.parentFieldKey];
    if (normalizeText(childVal) && normalizeText(parentVal)) {
      const depRes = validateDependentFieldValue({
        childFieldKey: field.key,
        childValue: childVal,
        parentValue: parentVal,
        runtime: context,
      });
      if (!depRes.valid && depRes.message) {
        addIssue(field.key, field.header, childVal, depRes.message);
      }
    }
  }

  // Academic Year date order check
  if (schema.key === 'academic_years') {
    const sDate = normalizeText(normalized.startDate);
    const eDate = normalizeText(normalized.endDate);
    if (sDate && eDate && sDate >= eDate) {
      addIssue('endDate', 'Ngày kết thúc *', eDate, 'Ngày kết thúc năm học phải sau Ngày bắt đầu.');
    }
  }

  // Survey / Leave date order check
  if (schema.key === 'survey_questions') {
    const sDate = normalizeText(normalized.startDate);
    const eDate = normalizeText(normalized.endDate);
    if (sDate && eDate && sDate > eDate) {
      addIssue('endDate', 'Ngày đóng *', eDate, 'Ngày đóng khảo sát phải sau hoặc bằng Ngày mở.');
    }
  }
  if (schema.key === 'leave_migration') {
    const sDate = normalizeText(normalized.fromDate);
    const eDate = normalizeText(normalized.toDate);
    if (sDate && eDate && sDate > eDate) {
      addIssue('toDate', 'Đến ngày *', eDate, 'Đến ngày phải sau hoặc bằng Từ ngày.');
    }
  }

  // Student existence check
  if (
    ['class_placements', 'grades', 'attendance', 'borrow_migration', 'leave_migration'].includes(schema.key) &&
    normalized.studentCode
  ) {
    const code = normalizeCode(normalized.studentCode);
    const exists = (context.students || []).some((s) => normalizeCode(s.studentCode) === code);
    if (!exists) {
      addIssue('studentCode', 'Mã học sinh *', normalized.studentCode, `Không tìm thấy học sinh có mã "${normalized.studentCode}" trong hệ thống.`);
    }
  }

  // Teacher existence check (match by fullName or email without teacherCode)
  if (schema.key === 'teaching_assignments' && (normalized.teacherName || normalized.teacherCode)) {
    const teacherRef = normalizeText(normalized.teacherName || normalized.teacherCode).toLowerCase();
    const exists = (context.teachers || []).some(
      (t) =>
        t.fullName.toLowerCase() === teacherRef ||
        t.email.toLowerCase() === teacherRef ||
        t.id.toLowerCase() === teacherRef
    );
    if (!exists) {
      addIssue('teacherName', 'Giáo viên *', normalized.teacherName || normalized.teacherCode, `Không tìm thấy giáo viên "${normalized.teacherName || normalized.teacherCode}".`);
    }
  }

  // Emulation record student existence check when targetType === 'individual'
  if (schema.key === 'emulation_records' && normalized.targetType === 'individual' && normalized.studentCode) {
    const code = normalizeCode(normalized.studentCode);
    const exists = (context.students || []).some((s) => normalizeCode(s.studentCode) === code);
    if (!exists) {
      addIssue('studentCode', 'Mã học sinh', normalized.studentCode, `Không tìm thấy học sinh có mã "${normalized.studentCode}" trong hệ thống.`);
    }
  }

  // Room existence check (for classes/facilities when rooms already exist)
  if ((schema.key === 'facilities' || schema.key === 'maintenance_plans') && normalized.roomLocation && (context.rooms || []).length > 0) {
    const loc = normalizeText(normalized.roomLocation).toLowerCase();
    const matchedRoom = (context.rooms || []).some(
      (r: SchoolRoom) => r.code.toLowerCase() === loc || r.name.toLowerCase() === loc
    );
    if (!matchedRoom) {
      addIssue(
        'roomLocation',
        'Phòng / Vị trí *',
        normalized.roomLocation,
        `Phòng "${normalized.roomLocation}" chưa có trong danh mục Phòng học (nên bổ sung phòng trước).`,
        'warning'
      );
    }
  }

  // BookCopy must link to an existing Book
  if (schema.key === 'book_copies' && normalized.bookRef) {
    const ref = normalizeCode(normalized.bookRef);
    const matchedBook = (context.books || []).find(
      (b: Book) =>
        normalizeCode(b.id) === ref ||
        normalizeCode(b.isbn) === ref ||
        normalizeCode(b.bookCode) === ref
    );
    if (!matchedBook) {
      addIssue('bookRef', 'Mã đầu sách / ISBN *', normalized.bookRef, `Không tìm thấy đầu sách khớp với "${normalized.bookRef}".`);
    }
  }

  // Timetable conflict checks (DB + rows in current Excel)
  if (schema.key === 'timetable') {
    const candidate: TimetableEntry = {
      id: `TT-TEMP-${rowNumber}`,
      classId: `CLS-${normalizeText(normalized.className)}`,
      className: normalizeText(normalized.className),
      dayOfWeek: Number(normalized.dayOfWeek) || 2,
      period: Number(normalized.period) || 1,
      subject: normalizeText(normalized.subject),
      teacherName: normalizeText(normalized.teacherName),
      room: normalizeText(normalized.room),
    };
    const combinedExisting = [...(context.timetable || []), ...extraTimetableInFile];
    const conflicts = detectTimetableConflicts(candidate, combinedExisting);
    for (const c of conflicts) {
      addIssue(c.type === 'room' ? 'room' : c.type === 'teacher' ? 'teacherName' : 'className', 'Thời khóa biểu', candidate.subject, c.message);
    }
  }

  // Grades: regular scores parsing (0-10) + published protection
  if (schema.key === 'grades') {
    const regText = normalizeText(normalized.scoreRegularText);
    if (regText) {
      const parts = regText.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
      for (const p of parts) {
        const val = Number(p.replace(',', '.'));
        if (!Number.isFinite(val) || val < 0 || val > 10) {
          addIssue('scoreRegularText', 'Điểm thường xuyên', regText, `Điểm thành phần "${p}" không hợp lệ (phải từ 0.0 đến 10.0).`);
          break;
        }
      }
    }
    const studentCode = normalizeCode(normalized.studentCode);
    const subjectName = normalizeText(normalized.subjectName).toLowerCase();
    const semester = normalizeText(normalized.semester || 'HK1');
    const existingGrade = (context.academicRecords || []).find(
      (r) =>
        normalizeCode(r.studentCode) === studentCode &&
        r.subjectName.toLowerCase() === subjectName &&
        r.semester === semester
    );
    if (existingGrade && existingGrade.status === 'published') {
      addIssue(
        'status',
        'Trạng thái điểm',
        'published',
        `Bảng điểm môn ${existingGrade.subjectName} (${semester}) của ${existingGrade.studentName} đã công bố — hệ thống chặn ghi đè im lặng qua Excel.`,
        'error'
      );
    }
  }

  // Attendance approved leave reconciliation warning
  if (schema.key === 'attendance' && normalized.status === 'absent_unexcused') {
    const code = normalizeCode(normalized.studentCode);
    const date = normalizeText(normalized.date);
    const hasApprovedLeave = (context.leaveRequests || []).some(
      (lr) =>
        lr.status === 'approved' &&
        normalizeCode(lr.studentCode) === code &&
        lr.fromDate <= date &&
        date <= lr.toDate
    );
    if (hasApprovedLeave) {
      addIssue(
        'status',
        'Trạng thái *',
        'absent_unexcused',
        `Học sinh đã có đơn xin nghỉ được duyệt trong ngày ${date} (nên dùng absent_excused).`,
        'warning'
      );
    }
  }

  // Role assignment requires existing user account
  if (schema.key === 'role_assignments' && normalized.email) {
    const em = normalizeCode(normalized.email);
    const exists = (context.userAccounts || []).some((u) => normalizeCode(u.email) === em);
    if (!exists) {
      addIssue('email', 'Email *', normalized.email, `Không tìm thấy tài khoản "${normalized.email}" để phân quyền.`);
    }
  }

  return issues;
}

export function validateManualRecord(
  schema: ImportModuleSchema,
  formData: Record<string, unknown>,
  context: ValidationDbContext,
  existingRecords: Record<string, unknown>[],
  editingId?: string
): { valid: boolean; normalized: Record<string, unknown>; fieldErrors: Record<string, string>; issues: ValidationIssue[] } {
  const normalized: Record<string, unknown> = {};
  const fieldErrors: Record<string, string> = {};
  const issues: ValidationIssue[] = [];

  for (const field of schema.fields) {
    const parentVal = field.parentFieldKey ? normalizeText(formData[field.parentFieldKey]) : undefined;
    const catalogOptions = field.catalogId
      ? resolveCatalogOptions({
          catalogId: field.catalogId,
          lookupCatalog: field.lookupCatalog,
          staticOptions: field.options,
          parentValue: parentVal || undefined,
          includeInactive: Boolean(editingId),
          runtime: context,
        })
      : undefined;
    const res = validateSingleField(field, formData[field.key], { catalogOptions });
    if (!res.valid && res.error) {
      fieldErrors[field.key] = res.error;
      issues.push({
        rowNumber: 1,
        sheetName: 'MANUAL',
        field: field.key,
        header: field.header,
        value: normalizeText(formData[field.key]),
        message: res.error,
        severity: 'error',
      });
    } else {
      normalized[field.key] = res.value;
    }
  }

  // Duplicate unique field check against DB (excluding current edited record)
  for (const field of schema.fields) {
    if (!field.uniqueKey) continue;
    const val = normalizeCode(normalized[field.key]);
    if (!val) continue;
    const dup = existingRecords.find((r) => {
      if (editingId && String(r.id) === String(editingId)) return false;
      return normalizeCode(r[field.key]) === val;
    });
    if (dup) {
      const msg = `${field.label} "${normalizeText(normalized[field.key])}" đã tồn tại trong hệ thống.`;
      fieldErrors[field.key] = msg;
      issues.push({
        rowNumber: 1,
        sheetName: 'MANUAL',
        field: field.key,
        header: field.header,
        value: normalizeText(normalized[field.key]),
        message: msg,
        severity: 'error',
      });
    }
  }

  const relIssues = checkRelationalRules(schema, normalized, context, 1);
  for (const issue of relIssues) {
    if (issue.severity === 'error' && !fieldErrors[issue.field]) {
      fieldErrors[issue.field] = issue.message;
    }
    issues.push(issue);
  }

  return {
    valid: issues.every((i) => i.severity !== 'error'),
    normalized,
    fieldErrors,
    issues,
  };
}

export function validateImportWorkbook(
  schema: ImportModuleSchema,
  parsed: ParsedWorkbookData,
  context: ValidationDbContext,
  existingRecords: Record<string, unknown>[],
  mode: ImportMode
): ImportPreviewReport {
  const headerErrors: string[] = [];
  const missingRequiredHeaders: string[] = [];
  const unrecognizedHeaders: string[] = [];

  // 1. Template version compatibility check
  if (parsed.templateModuleFound && parsed.templateModuleFound !== schema.key) {
    headerErrors.push(
      `File mẫu thuộc phân hệ "${parsed.templateModuleFound}", không khớp với phân hệ hiện tại "${schema.key}".`
    );
  }
  if (parsed.templateVersionFound && parsed.templateVersionFound !== schema.version) {
    headerErrors.push(
      `Phiên bản file mẫu (${parsed.templateVersionFound}) khác phiên bản hiện tại (${schema.version}). Vui lòng tải lại file mẫu mới nhất nếu thiếu cột.`
    );
  }

  // 2. Column matching check (supports single-sheet & multi-sheet headers)
  const normalizedHeaders = parsed.headers.map((h) => h.trim()).filter(Boolean);
  const sheetHeaderEntries = parsed.sheetHeaders
    ? Object.entries(parsed.sheetHeaders).filter(([, hdrs]) => hdrs.length > 0)
    : [[parsed.dataSheetName, normalizedHeaders] as [string, string[]]];

  const missingSet = new Set<string>();
  const unrecognizedSet = new Set<string>();
  const targetHeaderSets = sheetHeaderEntries.length > 0 ? sheetHeaderEntries : [[parsed.dataSheetName, normalizedHeaders] as [string, string[]]];

  for (const [, hdrs] of targetHeaderSets) {
    const cleanHdrs = hdrs.map((h) => h.trim()).filter(Boolean);
    for (const field of schema.fields) {
      const aliases = getFieldHeaderAliases(field);
      const hasMatch = cleanHdrs.some((h) =>
        aliases.some(
          (a) =>
            a.toLowerCase() === h.toLowerCase() ||
            a.replace(/\*+$/, '').trim().toLowerCase() === h.replace(/\*+$/, '').trim().toLowerCase()
        )
      );
      if (field.required && !hasMatch) {
        missingSet.add(field.header);
      }
    }
    for (const h of cleanHdrs) {
      const matchesAnyField = schema.fields.some((f) =>
        getFieldHeaderAliases(f).some(
          (a) =>
            a.toLowerCase() === h.toLowerCase() ||
            a.replace(/\*+$/, '').trim().toLowerCase() === h.replace(/\*+$/, '').trim().toLowerCase()
        )
      );
      if (!matchesAnyField) {
        unrecognizedSet.add(h);
      }
    }
  }

  missingRequiredHeaders.push(...Array.from(missingSet));
  unrecognizedHeaders.push(...Array.from(unrecognizedSet));

  if (missingRequiredHeaders.length > 0) {
    headerErrors.push(`Thiếu cột bắt buộc: ${missingRequiredHeaders.join(', ')}`);
  }

  // 3. Collect all non-empty rows across all parsed data tabs, preserving Excel coordinates
  const rawItems: ParsedRowOrigin[] =
    parsed.rowItems && parsed.rowItems.length > 0
      ? parsed.rowItems
      : parsed.rows.map((row, idx) => ({
          sheetName: parsed.dataSheetName,
          rowNumber: idx + 2,
          row,
        }));

  const nonEmptyRows = rawItems.filter(({ row }) =>
    Object.values(row).some((v) => normalizeText(v).length > 0)
  );

  // Track duplicates inside file
  const seenKeysInFile = new Map<string, { sheetName: string; rowNumber: number }>();
  const seenUniqueFieldsInFile = new Map<string, Map<string, { sheetName: string; rowNumber: number }>>();
  for (const f of schema.fields) {
    if (f.uniqueKey) seenUniqueFieldsInFile.set(f.key, new Map());
  }
  const extraTimetableInFile: TimetableEntry[] = [];

  const validatedRows: ValidatedImportRow[] = [];

  for (const { sheetName, rowNumber, row } of nonEmptyRows) {
    const issues: ValidationIssue[] = [];
    const normalized: Record<string, unknown> = {};
    const inferredDefaults = inferRowDefaultsFromSheetName(schema, sheetName, context);

    const resolveFieldRawWithInference = (field: SchemaFieldDef): unknown => {
      const raw = resolveRawFieldValue(field, row);
      if (normalizeText(raw) !== '') return raw;
      if (field.key in inferredDefaults) return inferredDefaults[field.key];
      return raw;
    };

    const candidateObj: Record<string, unknown> = {};
    for (const field of schema.fields) {
      candidateObj[field.key] = resolveFieldRawWithInference(field);
    }
    const existing = findExistingRecord(schema, candidateObj, existingRecords);
    const isUpdateCandidate = Boolean(existing) && mode === 'update_existing' && schema.allowUpdate;

    // Validate each field
    for (const field of schema.fields) {
      const rawVal = resolveFieldRawWithInference(field);
      const parentField = field.parentFieldKey
        ? schema.fields.find((sf) => sf.key === field.parentFieldKey)
        : undefined;
      const parentVal = field.parentFieldKey
        ? normalizeText(
            normalized[field.parentFieldKey] ??
              (parentField ? resolveFieldRawWithInference(parentField) : row[field.parentFieldKey])
          )
        : undefined;
      const catalogOptions = field.catalogId
        ? resolveCatalogOptions({
            catalogId: field.catalogId,
            lookupCatalog: field.lookupCatalog,
            staticOptions: field.options,
            parentValue: parentVal || undefined,
            includeInactive: isUpdateCandidate,
            runtime: context,
          })
        : undefined;
      const res = validateSingleField(field, rawVal, {
        // In update mode, a blank non-PK cell preserves the existing DB field rather than failing required check
        treatBlankAsOptional: isUpdateCandidate && field.header !== schema.primaryKeyHeader,
        catalogOptions,
      });
      if (!res.valid && res.error) {
        issues.push({
          rowNumber,
          sheetName,
          field: field.key,
          header: field.header,
          value: normalizeText(rawVal),
          message: res.error,
          severity: 'error',
        });
      } else {
        normalized[field.key] = res.value;
      }
    }

    // Re-check primary business key after field normalization
    const matchedExisting = findExistingRecord(schema, normalized, existingRecords);
    const rowBizKey = getRecordBusinessKey(schema, normalized);

    let isDuplicate = false;

    // Check in-file duplicate business key
    if (rowBizKey) {
      const firstLoc = seenKeysInFile.get(rowBizKey);
      if (firstLoc !== undefined) {
        isDuplicate = true;
        const locDesc =
          firstLoc.sheetName === sheetName
            ? `dòng ${firstLoc.rowNumber}`
            : `sheet "${firstLoc.sheetName}" dòng ${firstLoc.rowNumber}`;
        issues.push({
          rowNumber,
          sheetName,
          field: schema.fields[0]?.key || 'id',
          header: schema.primaryKeyHeader,
          value: rowBizKey,
          message: `Trùng bản ghi trong file với ${locDesc} (${rowBizKey}).`,
          severity: 'error',
        });
      } else {
        seenKeysInFile.set(rowBizKey, { sheetName, rowNumber });
      }
    }

    // Check in-file & DB duplicates on uniqueKey columns (e.g., rfidCardId, email, isbn, copyBarcode)
    for (const field of schema.fields) {
      if (!field.uniqueKey) continue;
      const val = normalizeCode(normalized[field.key]);
      if (!val) continue;

      const fileMap = seenUniqueFieldsInFile.get(field.key)!;
      const seenLoc = fileMap.get(val);
      if (seenLoc !== undefined) {
        isDuplicate = true;
        const locDesc =
          seenLoc.sheetName === sheetName
            ? `dòng ${seenLoc.rowNumber}`
            : `sheet "${seenLoc.sheetName}" dòng ${seenLoc.rowNumber}`;
        issues.push({
          rowNumber,
          sheetName,
          field: field.key,
          header: field.header,
          value: normalizeText(normalized[field.key]),
          message: `Trùng ${field.label} trong file Excel (đã xuất hiện ở ${locDesc}).`,
          severity: 'error',
        });
      } else {
        fileMap.set(val, { sheetName, rowNumber });
      }

      // DB check
      const dbCollision = existingRecords.find((item) => {
        if (matchedExisting && String(item.id) === String(matchedExisting.id)) return false;
        return normalizeCode(item[field.key]) === val;
      });
      if (dbCollision) {
        isDuplicate = true;
        issues.push({
          rowNumber,
          sheetName,
          field: field.key,
          header: field.header,
          value: normalizeText(normalized[field.key]),
          message: `${field.label} "${normalizeText(normalized[field.key])}" đã tồn tại trong cơ sở dữ liệu.`,
          severity: 'error',
        });
      }
    }

    // If mode is only_add and matchedExisting exists -> duplicate in DB!
    if (matchedExisting && mode === 'only_add') {
      isDuplicate = true;
      issues.push({
        rowNumber,
        sheetName,
        field: schema.fields[0]?.key || 'id',
        header: schema.primaryKeyHeader,
        value: rowBizKey,
        message: `Bản ghi đã tồn tại trong hệ thống (đang ở chế độ "Chỉ thêm mới" — chuyển sang "Cập nhật bản ghi hiện có" nếu muốn cập nhật).`,
        severity: 'error',
      });
    }

    if (matchedExisting && mode === 'update_existing' && !schema.allowUpdate) {
      isDuplicate = true;
      issues.push({
        rowNumber,
        sheetName,
        field: schema.fields[0]?.key || 'id',
        header: schema.primaryKeyHeader,
        value: rowBizKey,
        message: `Phân hệ "${schema.title}" không cho phép ghi đè bản ghi hiện có.`,
        severity: 'error',
      });
    }

    // Relational checks
    const relIssues = checkRelationalRules(schema, normalized, context, rowNumber, extraTimetableInFile, sheetName);
    issues.push(...relIssues);

    // If timetable valid so far, add to extraTimetableInFile for subsequent row conflict detection
    if (schema.key === 'timetable' && issues.every((i) => i.severity !== 'error')) {
      extraTimetableInFile.push({
        id: `TT-FILE-${sheetName}-${rowNumber}`,
        classId: `CLS-${normalizeText(normalized.className)}`,
        className: normalizeText(normalized.className),
        dayOfWeek: Number(normalized.dayOfWeek) || 2,
        period: Number(normalized.period) || 1,
        subject: normalizeText(normalized.subject),
        teacherName: normalizeText(normalized.teacherName),
        room: normalizeText(normalized.room),
      });
    }

    const hasError = issues.some((i) => i.severity === 'error');
    const diffs =
      matchedExisting && mode === 'update_existing' && schema.allowUpdate
        ? computeRecordDiffs(schema, matchedExisting, normalized, row)
        : undefined;

    const status = hasError
      ? isDuplicate
        ? 'duplicate'
        : 'invalid'
      : matchedExisting && mode === 'update_existing'
      ? 'valid_update'
      : 'valid_create';

    validatedRows.push({
      rowNumber,
      sheetName,
      rawData: row,
      normalizedData: normalized,
      status,
      existingId: matchedExisting ? String(matchedExisting.id) : undefined,
      diffs,
      issues,
    });
  }

  return {
    schemaKey: schema.key,
    fileName: parsed.fileName,
    templateVersionFound: parsed.templateVersionFound,
    tabNames: parsed.dataSheetNames || [parsed.dataSheetName],
    headersFound: normalizedHeaders,
    missingRequiredHeaders,
    unrecognizedHeaders,
    headerErrors,
    totalRows: validatedRows.length,
    validCreateCount: validatedRows.filter((r) => r.status === 'valid_create').length,
    validUpdateCount: validatedRows.filter((r) => r.status === 'valid_update').length,
    invalidCount: validatedRows.filter((r) => r.status === 'invalid').length,
    duplicateCount: validatedRows.filter((r) => r.status === 'duplicate').length,
    warningCount: validatedRows.reduce(
      (sum, r) => sum + r.issues.filter((i) => i.severity === 'warning').length,
      0
    ),
    rows: validatedRows,
    extraSheetRows: parsed.extraSheets,
  };
}

function rowToCandidateKeyObj(schema: ImportModuleSchema, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of schema.fields) {
    out[field.key] = resolveRawFieldValue(field, row);
  }
  return out;
}

export function extractExistingRecordsForModule(
  moduleKey: ImportModuleSchema['key'],
  dbContext: ValidationDbContext
): Record<string, unknown>[] {
  switch (moduleKey) {
    case 'students':
      return (dbContext.students || []) as unknown as Record<string, unknown>[];
    case 'teachers':
      return (dbContext.teachers || []) as unknown as Record<string, unknown>[];
    case 'staff':
      return (dbContext.staffMembers || []) as unknown as Record<string, unknown>[];
    case 'classes':
      return (dbContext.classes || []) as unknown as Record<string, unknown>[];
    case 'academic_years':
      return (dbContext.academicYears || []) as unknown as Record<string, unknown>[];
    case 'users':
    case 'role_assignments':
      return (dbContext.userAccounts || []) as unknown as Record<string, unknown>[];
    case 'books':
      return (dbContext.books || []) as unknown as Record<string, unknown>[];
    case 'book_copies':
      return (dbContext.bookCopies || []) as unknown as Record<string, unknown>[];
    case 'borrow_migration':
      return (dbContext.borrowTransactions || []) as unknown as Record<string, unknown>[];
    case 'timetable':
      return (dbContext.timetable || []) as unknown as Record<string, unknown>[];
    case 'teaching_assignments':
      return (dbContext.teachingAssignments || []) as unknown as Record<string, unknown>[];
    case 'grades':
      return (dbContext.academicRecords || []) as unknown as Record<string, unknown>[];
    case 'attendance':
      return (dbContext.attendanceRecords || []) as unknown as Record<string, unknown>[];
    case 'rooms':
      return (dbContext.rooms || []) as unknown as Record<string, unknown>[];
    case 'facilities':
      return (dbContext.facilities || []) as unknown as Record<string, unknown>[];
    case 'maintenance_plans':
      return (dbContext.maintenanceRequests || []) as unknown as Record<string, unknown>[];
    case 'rule_criteria':
      return (dbContext.ruleCriteria || []) as unknown as Record<string, unknown>[];
    case 'emulation_records':
      return (dbContext.emulationRecords || []) as unknown as Record<string, unknown>[];
    default:
      return [];
  }
}
