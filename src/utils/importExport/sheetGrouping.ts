import type { ImportModuleKey, ImportModuleSchema, PresetClassConfig, SchoolClass } from '../../types';
import { resolveCatalogOptions } from '../catalogs/catalogRegistry';
import { CANONICAL_RULE_GROUPS, findCanonicalRuleGroup } from '../emulationRules';
import type { SchemaRuntimeContext } from './schemas';

export interface ModuleSheetTabSpec {
  sheetName: string;
  label: string;
  inferredValues: Record<string, string | number>;
  matchValues: string[];
  fieldKey?: string;
  omittedFieldKeys?: string[];
}

const RESERVED_SYSTEM_SHEETS = new Set(['HUONG_DAN', 'DANH_MUC', 'HUONGDAN', 'DANHMUC', 'README', 'GUIDE']);

function normToken(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function sanitizeExcelSheetName(raw: string, usedLower: Set<string>): string {
  const cleanedBase = String(raw || 'DuLieu')
    .replace(/[\[\]:*?/\\]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  let base = (cleanedBase || 'DuLieu').slice(0, 31).trim();
  if (!base || RESERVED_SYSTEM_SHEETS.has(base.toUpperCase())) {
    base = 'DuLieu';
  }
  let candidate = base;
  let counter = 2;
  while (usedLower.has(candidate.toLowerCase()) || RESERVED_SYSTEM_SHEETS.has(candidate.toUpperCase())) {
    const suffix = `_${counter}`;
    candidate = `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
    counter += 1;
  }
  usedLower.add(candidate.toLowerCase());
  return candidate;
}

function uniqueValues(values: Array<string | number | undefined | null>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const clean = String(v ?? '').trim();
    if (!clean) continue;
    const lower = clean.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(clean);
  }
  return out;
}

export function mergeActiveAndPresetClasses(context: SchemaRuntimeContext = {}): Array<Pick<SchoolClass, 'name' | 'grade' | 'room' | 'homeroomTeacherName' | 'academicYear'>> {
  const dbClasses = context.classes || [];
  const inactiveNames = new Set(
    dbClasses.filter((c) => c.status === 'inactive').map((c) => c.name.trim().toLowerCase())
  );
  const byLower = new Map<string, Pick<SchoolClass, 'name' | 'grade' | 'room' | 'homeroomTeacherName' | 'academicYear'>>();
  for (const c of dbClasses) {
    if (c.status === 'inactive') continue;
    const name = c.name.trim();
    if (!name) continue;
    byLower.set(name.toLowerCase(), {
      name,
      grade: c.grade,
      room: c.room,
      homeroomTeacherName: c.homeroomTeacherName,
      academicYear: c.academicYear,
    });
  }
  const presets: PresetClassConfig[] = context.systemSettings?.presetClasses || [];
  for (const p of presets) {
    const name = (p?.name || '').trim();
    if (!name) continue;
    const lower = name.toLowerCase();
    if (inactiveNames.has(lower) || byLower.has(lower)) continue;
    byLower.set(lower, {
      name,
      grade: Number(p.grade) || Number(name.match(/^(\d{2})/)?.[1] || 10),
      room: p.room || '',
      homeroomTeacherName: p.homeroomTeacherName || '',
      academicYear: p.academicYear || context.systemSettings?.academicYear || '2026 - 2027',
    });
  }
  return Array.from(byLower.values()).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

function makeFixedTabs(
  items: Array<{
    sheetName: string;
    label: string;
    fieldKey?: string;
    primaryValue?: string | number;
    aliases?: string[];
    extraInferred?: Record<string, string | number>;
    omittedFieldKeys?: string[];
  }>,
  usedLower: Set<string>
): ModuleSheetTabSpec[] {
  return items.map((item) => {
    const sheetName = sanitizeExcelSheetName(item.sheetName, usedLower);
    const inferred: Record<string, string | number> = { ...(item.extraInferred || {}) };
    if (item.fieldKey && item.primaryValue !== undefined) {
      inferred[item.fieldKey] = item.primaryValue;
    }
    const matches = uniqueValues([
      item.primaryValue !== undefined ? String(item.primaryValue) : '',
      ...(item.aliases || []),
    ]);
    const omitted = item.omittedFieldKeys ?? (item.fieldKey ? [item.fieldKey] : undefined);
    return {
      sheetName,
      label: item.label,
      inferredValues: inferred,
      matchValues: matches,
      fieldKey: item.fieldKey,
      omittedFieldKeys: omitted,
    };
  });
}

function makeDynamicTabs(
  values: string[],
  prefix: string,
  fieldKey: string,
  usedLower: Set<string>,
  extraResolver?: (val: string) => Record<string, string | number>,
  omittedKeysOverride?: string[]
): ModuleSheetTabSpec[] {
  return values.map((val) => {
    const rawName = prefix ? `${prefix}${val}` : val;
    const sheetName = sanitizeExcelSheetName(rawName, usedLower);
    const extra = extraResolver ? extraResolver(val) : {};
    return {
      sheetName,
      label: val,
      inferredValues: { ...extra, [fieldKey]: val },
      matchValues: [val],
      fieldKey,
      omittedFieldKeys: omittedKeysOverride ?? [fieldKey],
    };
  });
}

export function buildModuleSheetTabs(
  schema: ImportModuleSchema,
  context: SchemaRuntimeContext = {},
  records: Record<string, unknown>[] = []
): ModuleSheetTabSpec[] {
  const usedLower = new Set<string>();
  for (const extra of schema.extraSheets || []) {
    usedLower.add(extra.sheetName.toLowerCase());
  }

  const activeClasses = mergeActiveAndPresetClasses(context);

  const classGradeMap = new Map<string, number>();
  for (const c of activeClasses) {
    if (c.name) classGradeMap.set(c.name.toLowerCase(), c.grade);
  }
  for (const c of context.classes || []) {
    if (c.name && !classGradeMap.has(c.name.toLowerCase())) {
      classGradeMap.set(c.name.toLowerCase(), c.grade);
    }
  }

  const key: ImportModuleKey = schema.key;

  switch (key) {
    case 'students': {
      const recordClasses = uniqueValues(records.map((r) => String(r.className || '')));
      const classNames = uniqueValues([...activeClasses.map((c) => c.name), ...recordClasses]);
      if (classNames.length > 0) {
        return makeDynamicTabs(
          classNames,
          '',
          'className',
          usedLower,
          (clsName): Record<string, string | number> => {
            const grade =
              classGradeMap.get(clsName.toLowerCase()) ||
              Number(clsName.match(/^(\d{2})/)?.[1] || 0);
            return grade >= 1 && grade <= 12 ? { grade } : {};
          },
          ['className', 'grade']
        );
      }
      return makeFixedTabs(
        [
          { sheetName: 'Khoi_10', label: 'Học sinh Khối 10', fieldKey: 'grade', primaryValue: 10, omittedFieldKeys: ['grade'] },
          { sheetName: 'Khoi_11', label: 'Học sinh Khối 11', fieldKey: 'grade', primaryValue: 11, omittedFieldKeys: ['grade'] },
          { sheetName: 'Khoi_12', label: 'Học sinh Khối 12', fieldKey: 'grade', primaryValue: 12, omittedFieldKeys: ['grade'] },
        ],
        usedLower
      );
    }

    case 'timetable': {
      const recordClasses = uniqueValues(records.map((r) => String(r.className || '')));
      const classNames = uniqueValues([...activeClasses.map((c) => c.name), ...recordClasses]);
      if (classNames.length > 0) {
        return makeDynamicTabs(classNames, 'TKB_', 'className', usedLower);
      }
      return makeFixedTabs(
        [
          { sheetName: 'TKB_Khoi10', label: 'Thời khóa biểu Khối 10' },
          { sheetName: 'TKB_Khoi11', label: 'Thời khóa biểu Khối 11' },
          { sheetName: 'TKB_Khoi12', label: 'Thời khóa biểu Khối 12' },
        ],
        usedLower
      );
    }

    case 'attendance': {
      const recordClasses = uniqueValues(records.map((r) => String(r.className || '')));
      const classNames = uniqueValues([...activeClasses.map((c) => c.name), ...recordClasses]);
      if (classNames.length > 0) {
        return makeDynamicTabs(classNames, 'DD_', 'className', usedLower);
      }
      return makeFixedTabs(
        [
          { sheetName: 'DD_Khoi10', label: 'Điểm danh Khối 10' },
          { sheetName: 'DD_Khoi11', label: 'Điểm danh Khối 11' },
          { sheetName: 'DD_Khoi12', label: 'Điểm danh Khối 12' },
        ],
        usedLower
      );
    }

    case 'assignments': {
      const recordClasses = uniqueValues(records.map((r) => String(r.className || '')));
      const classNames = uniqueValues([...activeClasses.map((c) => c.name), ...recordClasses]);
      if (classNames.length > 0) {
        return makeDynamicTabs(classNames, 'BT_', 'className', usedLower);
      }
      const subjects = resolveCatalogOptions({
        catalogId: 'teacher_subject',
        staticOptions: ['Toán học', 'Ngữ văn', 'Tiếng Anh'],
        runtime: context,
      })
        .slice(0, 6)
        .map((o) => o.value);
      return makeDynamicTabs(subjects, 'BT_', 'subject', usedLower);
    }

    case 'classes': {
      const grades = uniqueValues([
        '10',
        '11',
        '12',
        ...activeClasses.map((c) => String(c.grade)),
        ...records.map((r) => String(r.grade || '')),
      ]);
      return grades.map((g) => ({
        sheetName: sanitizeExcelSheetName(`Khoi_${g}`, usedLower),
        label: `Khối ${g}`,
        inferredValues: { grade: Number(g) || g },
        matchValues: [g],
        fieldKey: 'grade',
        omittedFieldKeys: ['grade'],
      }));
    }

    case 'materials': {
      const grades = uniqueValues([
        '10',
        '11',
        '12',
        ...records.map((r) => String(r.grade || '')),
      ]);
      return grades.map((g) => ({
        sheetName: sanitizeExcelSheetName(`Khoi_${g}`, usedLower),
        label: `Học liệu Khối ${g}`,
        inferredValues: { grade: Number(g) || g },
        matchValues: [g],
        fieldKey: 'grade',
        omittedFieldKeys: ['grade'],
      }));
    }

    case 'teachers': {
      const depts = uniqueValues([
        ...resolveCatalogOptions({ catalogId: 'teacher_department', runtime: context }).map((o) => o.value),
        ...records.map((r) => String(r.department || '')),
      ]);
      return makeDynamicTabs(depts, '', 'department', usedLower);
    }

    case 'staff': {
      const depts = uniqueValues([
        ...resolveCatalogOptions({ catalogId: 'staff_department', runtime: context }).map((o) => o.value),
        ...records.map((r) => String(r.department || '')),
      ]);
      return makeDynamicTabs(depts, '', 'department', usedLower);
    }

    case 'users':
    case 'role_assignments':
      return makeFixedTabs(
        [
          { sheetName: 'QuanTriVien', label: 'Quản trị viên', fieldKey: 'role', primaryValue: 'admin' },
          { sheetName: 'BanGiamHieu', label: 'Ban Giám hiệu', fieldKey: 'role', primaryValue: 'principal' },
          { sheetName: 'GV_ChuNhiem', label: 'GV Chủ nhiệm', fieldKey: 'role', primaryValue: 'homeroom_teacher' },
          { sheetName: 'GV_BoMon', label: 'GV Bộ môn', fieldKey: 'role', primaryValue: 'subject_teacher' },
          { sheetName: 'ThuThu', label: 'Thủ thư', fieldKey: 'role', primaryValue: 'librarian' },
          { sheetName: 'TuVan', label: 'Tư vấn học đường', fieldKey: 'role', primaryValue: 'counselor' },
          { sheetName: 'NhanVien', label: 'Nhân viên', fieldKey: 'role', primaryValue: 'staff' },
          { sheetName: 'HocSinh', label: 'Học sinh', fieldKey: 'role', primaryValue: 'student' },
        ],
        usedLower
      );

    case 'academic_years':
      return makeFixedTabs(
        [
          { sheetName: 'DangDienRa', label: 'Năm học đang diễn ra', fieldKey: 'status', primaryValue: 'Đang diễn ra' },
          { sheetName: 'SapToi', label: 'Năm học sắp tới', fieldKey: 'status', primaryValue: 'Sắp tới' },
          { sheetName: 'DaKetThuc', label: 'Năm học đã kết thúc', fieldKey: 'status', primaryValue: 'Đã kết thúc' },
        ],
        usedLower
      );

    case 'class_placements':
      return makeFixedTabs(
        [
          { sheetName: 'XepLop_DauNam', label: 'Xếp lớp đầu năm', fieldKey: 'placementType', primaryValue: 'Xếp lớp đầu năm' },
          { sheetName: 'ChuyenLop', label: 'Chuyển lớp', fieldKey: 'placementType', primaryValue: 'Chuyển lớp' },
          { sheetName: 'BoSung', label: 'Phân lớp bổ sung', fieldKey: 'placementType', primaryValue: 'Bổ sung' },
        ],
        usedLower
      );

    case 'teaching_assignments':
      return makeFixedTabs(
        [
          { sheetName: 'CaNam', label: 'Phân công Cả năm', fieldKey: 'semester', primaryValue: 'Cả năm' },
          { sheetName: 'HK1', label: 'Phân công Học kỳ 1', fieldKey: 'semester', primaryValue: 'HK1' },
          { sheetName: 'HK2', label: 'Phân công Học kỳ 2', fieldKey: 'semester', primaryValue: 'HK2' },
        ],
        usedLower
      );

    case 'grades':
      return makeFixedTabs(
        [
          { sheetName: 'Diem_HK1', label: 'Bảng điểm Học kỳ 1', fieldKey: 'semester', primaryValue: 'HK1' },
          { sheetName: 'Diem_HK2', label: 'Bảng điểm Học kỳ 2', fieldKey: 'semester', primaryValue: 'HK2' },
        ],
        usedLower
      );

    case 'books': {
      const cats = uniqueValues([
        ...resolveCatalogOptions({ catalogId: 'book_category', runtime: context }).map((o) => o.value),
        ...records.map((r) => String(r.category || '')),
      ]);
      return makeDynamicTabs(cats, '', 'category', usedLower);
    }

    case 'book_copies':
      return makeFixedTabs(
        [
          { sheetName: 'SanSang', label: 'Bản sao sẵn sàng', fieldKey: 'status', primaryValue: 'available' },
          { sheetName: 'DangMuon', label: 'Đang cho mượn', fieldKey: 'status', primaryValue: 'borrowed' },
          { sheetName: 'QuaHan', label: 'Quá hạn trả', fieldKey: 'status', primaryValue: 'overdue' },
          { sheetName: 'DaDatGiu', label: 'Đã đặt giữ', fieldKey: 'status', primaryValue: 'reserved' },
          { sheetName: 'BaoTri', label: 'Đang bảo trì', fieldKey: 'status', primaryValue: 'maintenance' },
          { sheetName: 'HuHong', label: 'Hư hỏng', fieldKey: 'status', primaryValue: 'damaged' },
          { sheetName: 'Mat', label: 'Mất bản sao', fieldKey: 'status', primaryValue: 'lost' },
        ],
        usedLower
      );

    case 'inventory_audits':
      return makeFixedTabs(
        [
          { sheetName: 'KiemKe_DinhKy', label: 'Kiểm kê định kỳ' },
          { sheetName: 'KiemKe_DotXuat', label: 'Kiểm kê đột xuất' },
        ],
        usedLower
      );

    case 'borrow_migration':
      return makeFixedTabs(
        [
          { sheetName: 'DaTra', label: 'Lịch sử đã trả', fieldKey: 'status', primaryValue: 'returned' },
          { sheetName: 'DangMuon', label: 'Đang mượn', fieldKey: 'status', primaryValue: 'borrowed' },
          { sheetName: 'QuaHan', label: 'Quá hạn trả', fieldKey: 'status', primaryValue: 'overdue' },
          { sheetName: 'MatSach', label: 'Mất sách', fieldKey: 'status', primaryValue: 'lost' },
        ],
        usedLower
      );

    case 'survey_questions':
      return makeFixedTabs(
        [
          { sheetName: 'ToanTruong', label: 'Khảo sát Toàn trường', fieldKey: 'targetAudience', primaryValue: 'Toàn trường' },
          { sheetName: 'TheoKhoi', label: 'Khảo sát Theo khối', fieldKey: 'targetAudience', primaryValue: 'Theo khối' },
          { sheetName: 'TheoLop', label: 'Khảo sát Theo lớp', fieldKey: 'targetAudience', primaryValue: 'Theo lớp' },
        ],
        usedLower
      );

    case 'leave_migration':
      return makeFixedTabs(
        [
          { sheetName: 'NghiOm', label: 'Đơn nghỉ ốm', fieldKey: 'type', primaryValue: 'Nghỉ ốm' },
          { sheetName: 'ViecGiaDinh', label: 'Việc gia đình', fieldKey: 'type', primaryValue: 'Việc gia đình' },
          { sheetName: 'ChuyenLop', label: 'Đơn chuyển lớp', fieldKey: 'type', primaryValue: 'Chuyển lớp' },
          { sheetName: 'XacNhanHS', label: 'Xác nhận học sinh', fieldKey: 'type', primaryValue: 'Xác nhận học sinh' },
        ],
        usedLower
      );

    case 'feedback_migration': {
      const cats = uniqueValues([
        ...resolveCatalogOptions({ catalogId: 'feedback_category', runtime: context }).map((o) => o.value),
        ...records.map((r) => String(r.category || '')),
      ]);
      return makeDynamicTabs(cats, '', 'category', usedLower);
    }

    case 'announcements': {
      const audiences = uniqueValues([
        ...resolveCatalogOptions({ catalogId: 'announcement_audience', runtime: context }).map((o) => o.value),
        ...records.map((r) => String(r.targetAudience || '')),
      ]);
      return makeDynamicTabs(audiences, '', 'targetAudience', usedLower);
    }

    case 'events':
      return makeFixedTabs(
        [
          { sheetName: 'HocThuat', label: 'Sự kiện Học thuật', fieldKey: 'category', primaryValue: 'Học thuật' },
          { sheetName: 'VanHoa', label: 'Sự kiện Văn hóa', fieldKey: 'category', primaryValue: 'Văn hóa' },
          { sheetName: 'TheThao', label: 'Sự kiện Thể thao', fieldKey: 'category', primaryValue: 'Thể thao' },
          { sheetName: 'DoanDoi', label: 'Hoạt động Đoàn - Đội', fieldKey: 'category', primaryValue: 'Đoàn - Đội' },
        ],
        usedLower
      );

    case 'rooms': {
      const types = uniqueValues([
        ...resolveCatalogOptions({ catalogId: 'room_type', runtime: context }).map((o) => o.value),
        ...records.map((r) => String(r.roomType || '')),
      ]);
      return makeDynamicTabs(types, '', 'roomType', usedLower);
    }

    case 'facilities': {
      const cats = uniqueValues([
        ...resolveCatalogOptions({ catalogId: 'facility_category', runtime: context }).map((o) => o.value),
        ...records.map((r) => String(r.category || '')),
      ]);
      return makeDynamicTabs(cats, '', 'category', usedLower);
    }

    case 'maintenance_plans':
      return makeFixedTabs(
        [
          { sheetName: 'KhanCap', label: 'Ưu tiên Khẩn cấp', fieldKey: 'priority', primaryValue: 'urgent' },
          { sheetName: 'UuTienCao', label: 'Ưu tiên Cao', fieldKey: 'priority', primaryValue: 'high' },
          { sheetName: 'TrungBinh', label: 'Ưu tiên Trung bình', fieldKey: 'priority', primaryValue: 'medium' },
          { sheetName: 'Thap', label: 'Ưu tiên Thấp', fieldKey: 'priority', primaryValue: 'low' },
        ],
        usedLower
      );

    case 'external_datasets':
      return makeFixedTabs(
        [
          { sheetName: 'ChiSo_ChuyenCan', label: 'Chỉ số Chuyên cần' },
          { sheetName: 'ChiSo_HocLuc', label: 'Chỉ số Học lực' },
          { sheetName: 'ChiSo_Khac', label: 'Chỉ số Tham chiếu khác' },
        ],
        usedLower
      );

    case 'rule_criteria':
      return makeFixedTabs(
        CANONICAL_RULE_GROUPS.map((grp) => ({
          sheetName: grp.sheetName,
          label: grp.name,
          fieldKey: 'categoryName',
          primaryValue: grp.name,
          aliases: grp.aliases,
          omittedFieldKeys: ['categoryName'],
        })),
        usedLower
      );

    case 'emulation_records':
      return makeFixedTabs(
        [
          { sheetName: 'ViPham', label: 'Vi phạm (Trừ điểm)', fieldKey: 'type', primaryValue: 'violation' },
          { sheetName: 'ThanhTich', label: 'Thành tích (Cộng điểm)', fieldKey: 'type', primaryValue: 'achievement' },
        ],
        usedLower
      );
  }
}

export function resolveSheetTabForRecord(
  record: Record<string, unknown>,
  tabs: ModuleSheetTabSpec[]
): ModuleSheetTabSpec {
  if (tabs.length === 0) {
    return { sheetName: 'DATA', label: 'Dữ liệu', inferredValues: {}, matchValues: [] };
  }
  const keyedTabs = tabs.filter((t) => Boolean(t.fieldKey));
  if (keyedTabs.length === 0) {
    return tabs[0];
  }
  for (const tab of keyedTabs) {
    const rawVal = normToken(record[tab.fieldKey!]);
    if (!rawVal) continue;
    if (tab.matchValues.some((mv) => normToken(mv) === rawVal)) {
      return tab;
    }
  }
  return tabs[0];
}

export function inferRowDefaultsFromSheetName(
  schema: ImportModuleSchema,
  sheetName: string,
  context: SchemaRuntimeContext = {}
): Record<string, string | number> {
  const upper = sheetName.trim().toUpperCase();
  if (!sheetName || upper === 'DATA' || upper === 'DU_LIEU' || upper === 'WORD_TABLE') {
    return {};
  }
  const tabs = buildModuleSheetTabs(schema, context);
  const sheetToken = normToken(sheetName);
  const exact = tabs.find(
    (t) => t.sheetName.toLowerCase() === sheetName.trim().toLowerCase() || normToken(t.sheetName) === sheetToken
  );
  if (exact) {
    return { ...exact.inferredValues };
  }

  const activeClasses = mergeActiveAndPresetClasses(context);
  const resolveClassGrade = (clsName: string): number | undefined => {
    const known = activeClasses.find((c) => c.name.toLowerCase() === clsName.toLowerCase());
    if (known?.grade && known.grade >= 1 && known.grade <= 12) return known.grade;
    const m = clsName.match(/^(\d{2})/) || clsName.match(/(\d{1,2})/);
    const g = m ? Number(m[1]) : 0;
    return g >= 1 && g <= 12 ? g : undefined;
  };

  // Fallback prefix inference for custom user-added tabs (e.g., 10A9, HocSinh_10A9, TKB_10A9, DD_10A9, BT_10A9, Khoi_10)
  if (schema.key === 'students') {
    const clean = sheetName.replace(/^HocSinh_/i, '').replace(/^Lop_/i, '').trim();
    if (/^Khoi_(\d{1,2})$/i.test(clean)) {
      const g = Number(clean.match(/^Khoi_(\d{1,2})$/i)?.[1]);
      if (g >= 1 && g <= 12) return { grade: g };
    }
    if (clean) {
      const g = resolveClassGrade(clean);
      return g ? { className: clean, grade: g } : { className: clean };
    }
  }
  if (schema.key === 'timetable' && /^TKB_/i.test(sheetName)) {
    const clean = sheetName.replace(/^TKB_/i, '').trim();
    if (clean && !/^Khoi/i.test(clean)) return { className: clean };
  }
  if (schema.key === 'attendance' && /^DD_/i.test(sheetName)) {
    const clean = sheetName.replace(/^DD_/i, '').trim();
    if (clean && !/^Khoi/i.test(clean)) return { className: clean };
  }
  if (schema.key === 'assignments' && /^BT_/i.test(sheetName)) {
    const clean = sheetName.replace(/^BT_/i, '').trim();
    if (clean) return { className: clean };
  }
  if (schema.key === 'facilities') {
    const clean = sheetName.replace(/^Lop_/i, '').trim();
    const knownCls = activeClasses.find((c) => c.name.toLowerCase() === clean.toLowerCase());
    if (knownCls) {
      return {
        className: knownCls.name,
        grade: knownCls.grade,
        ...(knownCls.academicYear ? { academicYear: knownCls.academicYear } : {}),
        ...(knownCls.room ? { roomLocation: knownCls.room } : {}),
      };
    }
  }
  if ((schema.key === 'classes' || schema.key === 'materials') && /^Khoi_(\d{1,2})$/i.test(sheetName)) {
    const g = Number(sheetName.match(/^Khoi_(\d{1,2})$/i)?.[1]);
    if (g >= 1 && g <= 12) return { grade: g };
  }
  if (schema.key === 'rule_criteria') {
    const matchedGroup = findCanonicalRuleGroup(sheetName);
    if (matchedGroup) {
      return { categoryName: matchedGroup.name };
    }
    const clean = sheetName.trim();
    if (clean) {
      return { categoryName: clean };
    }
  }
  return {};
}
