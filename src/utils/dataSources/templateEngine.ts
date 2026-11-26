import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import type {
  AcademicYearConfig,
  AfternoonScheduleEntry,
  Book,
  DataCatalogDefinition,
  DataSourceGroupKey,
  FacilityAsset,
  SheetValidationColumnSpec,
  SchoolClass,
  SchoolRoom,
  StaffMember,
  Student,
  SystemSettings,
  Teacher,
  TimetableEntry,
  ValidationIssue,
} from '../../types';
import { resolveCatalogOptions } from '../catalogs/catalogRegistry';
import {
  AFTERNOON_COLUMNS,
  BOOK_COLUMNS,
  DATA_SOURCE_GROUP_SPECS,
  FACILITY_COLUMNS,
  STAFF_COLUMNS,
  STUDENT_COLUMNS,
  TIMETABLE_COLUMNS,
  type GroupColumnSpec,
  formatSyncDayOfWeekInput,
  normalizeDateValue,
  normalizeHeaderMatchToken,
  normalizePhoneValue,
  normalizeText,
  parseTimeHHMM,
  resolveCellByColumnSpec,
  sanitizeSheetTabName,
  validateEmailValue,
} from './groupSpecs';
import {
  inferDefaultDailyHours,
  inferDefaultPowerWatts,
  inferDeviceKind,
} from '../facilitiesEngine';

export interface DataSourceRuntimeContext {
  classes: SchoolClass[];
  academicYears: AcademicYearConfig[];
  rooms: SchoolRoom[];
  dataCatalogs?: DataCatalogDefinition[];
  systemSettings?: SystemSettings;
}

export interface DataSourceExistingData {
  students: Student[];
  teachers: Teacher[];
  staffMembers: StaffMember[];
  timetable: TimetableEntry[];
  afternoonSchedules: AfternoonScheduleEntry[];
  books: Book[];
  facilities: FacilityAsset[];
}

export interface DanhMucColumn {
  key: string;
  header: string;
  values: string[];
}

export interface GroupTabPlan {
  tabName: string;
  title: string;
  columns: GroupColumnSpec[];
  rows: Record<string, string | number>[];
  validationColumns: SheetValidationColumnSpec[];
}

export interface ParsedGroupTab {
  sheetName: string;
  headers: string[];
  rows: Array<{ rowNumber: number; data: Record<string, unknown> }>;
}

export interface ParsedGroupWorkbook {
  fileName: string;
  sheetNames: string[];
  tabs: Record<string, ParsedGroupTab>;
}

export interface GroupSyncPreviewSummary {
  totalRows: number;
  validRows: number;
  createCount: number;
  updateCount: number;
  unchangedCount: number;
  errorCount: number;
  tabBreakdown: Array<{ tabName: string; rowCount: number; errorCount: number }>;
}

export interface GroupValidationResult {
  valid: boolean;
  groupKey: DataSourceGroupKey;
  autoClassesToCreate?: string[];
  issues: ValidationIssue[];
  summary: GroupSyncPreviewSummary;
  normalized: {
    students?: Student[];
    teachers?: Teacher[];
    staffMembers?: StaffMember[];
    timetable?: TimetableEntry[];
    afternoonSchedules?: AfternoonScheduleEntry[];
    books?: Book[];
    facilities?: FacilityAsset[];
  };
  samplePreview: Array<{
    tabName: string;
    rowNumber: number;
    key: string;
    label: string;
    action: 'create' | 'update' | 'error';
    errorMessage?: string;
  }>;
}

function uniqueStrings(values: Array<string | number | undefined | null>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const clean = String(raw ?? '').trim();
    if (!clean) continue;
    const norm = clean.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(clean);
  }
  return out;
}

function columnLetter(colIndexOneBased: number): string {
  let n = colIndexOneBased;
  let result = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result || 'A';
}

function getEffectiveActiveClasses(context: DataSourceRuntimeContext): SchoolClass[] {
  const dbClasses = context.classes || [];
  const inactiveLower = new Set(
    dbClasses.filter((c) => c.status === 'inactive').map((c) => c.name.trim().toLowerCase())
  );
  const byLower = new Map<string, SchoolClass>();
  for (const c of dbClasses) {
    if (c.status === 'inactive') continue;
    if (!c.name.trim()) continue;
    byLower.set(c.name.trim().toLowerCase(), c);
  }
  const defaultYear =
    context.systemSettings?.academicYear ||
    context.academicYears?.[0]?.name ||
    '2026 - 2027';
  for (const p of context.systemSettings?.presetClasses || []) {
    const clean = (p?.name || '').trim();
    if (!clean) continue;
    const lower = clean.toLowerCase();
    if (inactiveLower.has(lower) || byLower.has(lower)) continue;
    const grade = Number(p.grade) || Number(clean.match(/^(\d{1,2})/)?.[1] || 10);
    byLower.set(lower, {
      id: `PRESET-${clean}`,
      code: clean,
      name: clean,
      grade: grade >= 1 && grade <= 12 ? grade : 10,
      academicYear: p.academicYear || defaultYear,
      homeroomTeacherId: '',
      homeroomTeacherName: p.homeroomTeacherName || 'Chưa phân công',
      room: p.room || '',
      studentCount: 0,
      status: 'active',
    });
  }
  return Array.from(byLower.values()).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

export function buildLiveGroupDanhMuc(
  _groupKey: DataSourceGroupKey,
  context: DataSourceRuntimeContext
): DanhMucColumn[] {
  const activeClasses = getEffectiveActiveClasses(context);

  const gradesFromActive = activeClasses.map((c) => String(c.grade));
  const catalogGrades = resolveCatalogOptions({
    catalogId: 'student_grade',
    runtime: context,
  }).map((o) => o.value);
  const grades = uniqueStrings([...gradesFromActive, ...catalogGrades]);

  const classNames = uniqueStrings(activeClasses.map((c) => c.name));

  const academicYears = uniqueStrings([
    context.systemSettings?.academicYear,
    ...(context.academicYears || []).map((y) => y.name),
  ]);

  const genders = resolveCatalogOptions({
    catalogId: 'student_gender',
    runtime: context,
  }).map((o) => o.value);

  const studentStatuses = resolveCatalogOptions({
    catalogId: 'student_status',
    runtime: context,
  }).map((o) => o.value);

  const subjects = resolveCatalogOptions({
    catalogId: 'teacher_subject',
    runtime: context,
  }).map((o) => o.value);

  const profGroups = resolveCatalogOptions({
    catalogId: 'teacher_department',
    runtime: context,
  }).map((o) => o.value);

  const staffDepts = resolveCatalogOptions({
    catalogId: 'staff_department',
    runtime: context,
  }).map((o) => o.value);

  const staffPositions = resolveCatalogOptions({
    catalogId: 'staff_position',
    runtime: context,
  }).map((o) => o.value);

  const staffStatuses = resolveCatalogOptions({
    catalogId: 'staff_status',
    runtime: context,
  }).map((o) => o.value);

  const semesters = resolveCatalogOptions({
    catalogId: 'semester',
    runtime: context,
  }).map((o) => o.value);

  const rooms = uniqueStrings((context.rooms || []).map((r) => r.code || r.name));

  const bookCategories = resolveCatalogOptions({
    catalogId: 'book_category',
    runtime: context,
  }).map((o) => o.value);

  const facilityGroups = resolveCatalogOptions({
    catalogId: 'facility_category',
    runtime: context,
  }).map((o) => o.value);

  const facilityConditions = resolveCatalogOptions({
    catalogId: 'facility_condition',
    runtime: context,
  }).map((o) => o.value);

  return [
    { key: 'GioiTinh', header: 'GioiTinh', values: genders },
    { key: 'Khoi', header: 'Khoi', values: grades },
    { key: 'Lop', header: 'Lop', values: classNames },
    { key: 'NamHoc', header: 'NamHoc', values: academicYears },
    { key: 'TrangThaiHocSinh', header: 'TrangThaiHocSinh', values: studentStatuses },
    { key: 'LoaiNhanSu', header: 'LoaiNhanSu', values: ['Giáo viên', 'Nhân viên'] },
    { key: 'ChucVu', header: 'ChucVu', values: uniqueStrings([...staffPositions, 'Giáo viên chủ nhiệm', 'Giáo viên bộ môn', 'Tổ trưởng chuyên môn']) },
    { key: 'ToChuyenMon', header: 'ToChuyenMon', values: profGroups },
    { key: 'BoPhan', header: 'BoPhan', values: staffDepts },
    { key: 'MonHoc', header: 'MonHoc', values: subjects },
    { key: 'TrangThaiNhanSu', header: 'TrangThaiNhanSu', values: staffStatuses },
    { key: 'HocKy', header: 'HocKy', values: semesters },
    { key: 'Thu', header: 'Thu', values: ['2', '3', '4', '5', '6', '7'] },
    { key: 'Tiet', header: 'Tiet', values: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] },
    { key: 'PhongHoc', header: 'PhongHoc', values: rooms },
    { key: 'TheLoaiSach', header: 'TheLoaiSach', values: bookCategories },
    { key: 'TrangThaiSach', header: 'TrangThaiSach', values: ['Sẵn sàng', 'Ngừng lưu hành'] },
    { key: 'NhomTaiSan', header: 'NhomTaiSan', values: facilityGroups },
    {
      key: 'LoaiTaiSan',
      header: 'LoaiTaiSan',
      values: ['Thiết bị giảng dạy', 'Thiết bị CNTT', 'Nội thất lớp học', 'Thiết bị điện - làm mát', 'Thiết bị thí nghiệm'],
    },
    { key: 'DonViTinh', header: 'DonViTinh', values: ['Cái', 'Bộ', 'Chiếc', 'Phòng', 'Hệ thống'] },
    { key: 'TinhTrangCSVC', header: 'TinhTrangCSVC', values: facilityConditions },
  ];
}

function buildValidationSpecsFromDanhMuc(
  columns: GroupColumnSpec[],
  danhMuc: DanhMucColumn[]
): SheetValidationColumnSpec[] {
  const byKey = new Map(danhMuc.map((d) => [d.key, d.values]));
  const specs: SheetValidationColumnSpec[] = [];
  for (const col of columns) {
    if (!col.danhMucKey) continue;
    const values = byKey.get(col.danhMucKey) || [];
    if (values.length === 0) continue;
    specs.push({
      header: col.header,
      fieldKey: col.key,
      values,
      strict: false,
      allowBlank: !col.required,
      helpText: `Chọn giá trị từ DanhMuc (${col.label}).`,
    });
  }
  return specs;
}

export function buildGroupTemplatePlan(
  groupKey: DataSourceGroupKey,
  context: DataSourceRuntimeContext,
  existing: Partial<DataSourceExistingData> = {}
): {
  spec: typeof DATA_SOURCE_GROUP_SPECS[DataSourceGroupKey];
  danhMuc: DanhMucColumn[];
  guideRows: Array<[string, string, string]>;
  dataTabs: GroupTabPlan[];
} {
  const spec = DATA_SOURCE_GROUP_SPECS[groupKey];
  const danhMuc = buildLiveGroupDanhMuc(groupKey, context);
  const activeClasses = getEffectiveActiveClasses(context);
  const defaultYear =
    context.systemSettings?.academicYear ||
    context.academicYears?.[0]?.name ||
    '2026 - 2027';

  const dataTabs: GroupTabPlan[] = [];

  if (groupKey === 'students') {
    const classTabs =
      activeClasses.length > 0
        ? activeClasses
        : [
            {
              id: 'TEMPLATE',
              code: 'Mau',
              name: 'Mau',
              grade: 10,
              academicYear: defaultYear,
              homeroomTeacherId: '',
              homeroomTeacherName: '',
              room: '',
              studentCount: 0,
            } as SchoolClass,
          ];

    for (const cls of classTabs) {
      const tabName = sanitizeSheetTabName(`HocSinh_${cls.name}`);
      const isNamedClass = cls.name !== 'Mau';
      const tabColumns = isNamedClass
        ? STUDENT_COLUMNS.filter((c) => c.key !== 'grade' && c.key !== 'className')
        : STUDENT_COLUMNS;
      const studentsInClass = (existing.students || []).filter(
        (s) => s.className.toLowerCase() === cls.name.toLowerCase()
      );
      dataTabs.push({
        tabName,
        title: `Danh sách học sinh lớp ${cls.name}`,
        columns: tabColumns,
        validationColumns: buildValidationSpecsFromDanhMuc(tabColumns, danhMuc),
        rows: studentsInClass.map((s) => ({
          MaHocSinh: s.studentCode,
          HoTen: s.fullName,
          NgaySinh: s.dateOfBirth || '',
          GioiTinh: s.gender || 'Nam',
          Khoi: s.grade || cls.grade,
          Lop: s.className || cls.name,
          NamHoc: s.academicYear || cls.academicYear || defaultYear,
          DiaChi: s.address || '',
          SoDienThoai: '',
          Email: s.email || '',
          HoTenPhuHuynh: s.parentName || '',
          SoDienThoaiPhuHuynh: s.parentPhone || '',
          TrangThai: s.status || 'Đang học',
        })),
      });
    }
  } else if (groupKey === 'staff') {
    const teacherColumns = STAFF_COLUMNS.filter(
      (c) => c.key !== 'staffType' && c.key !== 'department'
    );
    dataTabs.push({
      tabName: 'GiaoVien',
      title: 'Danh sách Giáo viên',
      columns: teacherColumns,
      validationColumns: buildValidationSpecsFromDanhMuc(teacherColumns, danhMuc),
      rows: (existing.teachers || []).map((t) => ({
        MaNhanSu: t.teacherCode || t.id,
        HoTen: t.fullName,
        NgaySinh: t.dateOfBirth || '',
        GioiTinh: t.gender || 'Nam',
        Email: t.email || '',
        SoDienThoai: t.phone || '',
        ChucVu: t.position || (t.isHomeroom ? 'Giáo viên chủ nhiệm' : 'Giáo viên bộ môn'),
        ToChuyenMon: t.department || '',
        MonGiangDay: t.subject || '',
        TrangThaiCongTac: t.status || 'Đang công tác',
      })),
    });
    const staffOnlyColumns = STAFF_COLUMNS.filter(
      (c) => c.key !== 'staffType' && c.key !== 'professionalGroup' && c.key !== 'subject'
    );
    dataTabs.push({
      tabName: 'NhanVien',
      title: 'Danh sách Nhân viên hành chính & hỗ trợ',
      columns: staffOnlyColumns,
      validationColumns: buildValidationSpecsFromDanhMuc(staffOnlyColumns, danhMuc),
      rows: (existing.staffMembers || []).map((s) => ({
        MaNhanSu: s.staffCode || s.id,
        HoTen: s.fullName,
        NgaySinh: s.dateOfBirth || '',
        GioiTinh: s.gender || 'Nam',
        Email: s.email || '',
        SoDienThoai: s.phone || '',
        ChucVu: s.position || '',
        BoPhan: s.department || '',
        TrangThaiCongTac: s.status || 'Đang công tác',
      })),
    });
  } else if (groupKey === 'learning') {
    const ttRows = (existing.timetable || []).map((t) => ({
      NamHoc: t.academicYear || defaultYear,
      HocKy: t.semester || 'HK1',
      Khoi: t.grade || activeClasses.find((c) => c.name === t.className)?.grade || '',
      Lop: t.className,
      Thu: t.dayOfWeek,
      Tiet: t.period,
      GioBatDau: t.startTime || '',
      GioKetThuc: t.endTime || '',
      MonHoc: t.subject,
      GiaoVien: t.teacherName || '',
      PhongHoc: t.room || '',
      GhiChu: t.notes || '',
    }));
    dataTabs.push({
      tabName: 'TKB_ToanTruong',
      title: 'Thời khóa biểu toàn trường',
      columns: TIMETABLE_COLUMNS,
      validationColumns: buildValidationSpecsFromDanhMuc(TIMETABLE_COLUMNS, danhMuc),
      rows: ttRows,
    });
    const classTimetableColumns = TIMETABLE_COLUMNS.filter(
      (c) => c.key !== 'grade' && c.key !== 'className'
    );
    for (const cls of activeClasses.slice(0, 30)) {
      const clsRows = (existing.timetable || [])
        .filter((t) => t.className.toLowerCase() === cls.name.toLowerCase())
        .map((t) => ({
          NamHoc: t.academicYear || defaultYear,
          HocKy: t.semester || 'HK1',
          Thu: t.dayOfWeek,
          Tiet: t.period,
          GioBatDau: t.startTime || '',
          GioKetThuc: t.endTime || '',
          MonHoc: t.subject,
          GiaoVien: t.teacherName || '',
          PhongHoc: t.room || '',
          GhiChu: t.notes || '',
        }));
      dataTabs.push({
        tabName: sanitizeSheetTabName(`TKB_${cls.name}`),
        title: `Thời khóa biểu lớp ${cls.name}`,
        columns: classTimetableColumns,
        validationColumns: buildValidationSpecsFromDanhMuc(classTimetableColumns, danhMuc),
        rows: clsRows,
      });
    }
    dataTabs.push({
      tabName: 'ThoiGianBieu_BuoiChieu',
      title: 'Thời gian biểu buổi chiều & ngoại khóa',
      columns: AFTERNOON_COLUMNS,
      validationColumns: buildValidationSpecsFromDanhMuc(AFTERNOON_COLUMNS, danhMuc),
      rows: (existing.afternoonSchedules || []).map((a) => ({
        NamHoc: a.academicYear || defaultYear,
        Ngay: a.date || '',
        Thu: a.dayOfWeek,
        Khoi: a.grade || '',
        Lop: a.className || '',
        GioBatDau: a.startTime,
        GioKetThuc: a.endTime,
        HoatDong: a.activity,
        DiaDiem: a.location || '',
        NguoiPhuTrach: a.coordinator || '',
        GhiChu: a.notes || '',
      })),
    });
  } else if (groupKey === 'books') {
    const usedTabLower = new Set<string>(['huongdan', 'danhmuc']);
    const bookCategories = uniqueStrings([
      ...resolveCatalogOptions({ catalogId: 'book_category', runtime: context }).map((o) => o.value),
      ...(existing.books || []).map((b) => b.category),
    ]);
    const effectiveCats =
      bookCategories.length > 0
        ? bookCategories
        : ['Sách giáo khoa & Tham khảo', 'Khoa học tự nhiên', 'Văn học & Ngữ văn'];
    const bookTabColumns = BOOK_COLUMNS.filter((c) => c.key !== 'category');

    for (const cat of effectiveCats) {
      let baseTab = sanitizeSheetTabName(`Sach_${cat}`);
      let tabName = baseTab;
      let suffixIdx = 2;
      while (usedTabLower.has(tabName.toLowerCase())) {
        const sfx = `_${suffixIdx}`;
        tabName = `${baseTab.slice(0, Math.max(1, 31 - sfx.length))}${sfx}`;
        suffixIdx += 1;
      }
      usedTabLower.add(tabName.toLowerCase());

      const catBooks = (existing.books || []).filter(
        (b) => normalizeHeaderMatchToken(b.category) === normalizeHeaderMatchToken(cat)
      );

      dataTabs.push({
        tabName,
        title: `Sách thể loại: ${cat}`,
        columns: bookTabColumns,
        validationColumns: buildValidationSpecsFromDanhMuc(bookTabColumns, danhMuc),
        rows: catBooks.map((b) => ({
          MaSach: b.bookCode || b.id,
          ISBN: b.isbn || '',
          TenSach: b.title,
          TacGia: b.author,
          NhaXuatBan: b.publisher || '',
          NamXuatBan: b.publishYear || '',
          ViTriKe: b.shelfLocation || '',
          SoLuongTong: b.totalCopies,
          SoLuongHienCo: b.availableCopies,
          TrangThai: b.status || 'Sẵn sàng',
          GhiChu: b.notes || '',
        })),
      });
    }
  } else if (groupKey === 'facilities') {
    const usedTabLower = new Set<string>(['huongdan', 'danhmuc']);
    const facilityGroups = uniqueStrings([
      ...resolveCatalogOptions({ catalogId: 'facility_category', runtime: context }).map((o) => o.value),
      ...(existing.facilities || []).map((f) => f.assetGroup || f.category),
    ]);
    const effectiveGroups =
      facilityGroups.length > 0
        ? facilityGroups
        : ['Thiết bị trình chiếu', 'Máy tính', 'Bàn ghế'];
    const facilityTabColumns = FACILITY_COLUMNS.filter((c) => c.key !== 'assetGroup');

    for (const grp of effectiveGroups) {
      let baseTab = sanitizeSheetTabName(`CSVC_${grp}`);
      let tabName = baseTab;
      let suffixIdx = 2;
      while (usedTabLower.has(tabName.toLowerCase())) {
        const sfx = `_${suffixIdx}`;
        tabName = `${baseTab.slice(0, Math.max(1, 31 - sfx.length))}${sfx}`;
        suffixIdx += 1;
      }
      usedTabLower.add(tabName.toLowerCase());

      const grpFacilities = (existing.facilities || []).filter(
        (f) => normalizeHeaderMatchToken(f.assetGroup || f.category) === normalizeHeaderMatchToken(grp)
      );

      dataTabs.push({
        tabName,
        title: `Cơ sở vật chất: ${grp}`,
        columns: facilityTabColumns,
        validationColumns: buildValidationSpecsFromDanhMuc(facilityTabColumns, danhMuc),
        rows: grpFacilities.map((f) => ({
          MaTaiSan: f.code,
          TenTaiSan: f.name,
          LoaiTaiSan: f.assetType || 'Thiết bị giảng dạy',
          SoLuong: f.quantity ?? 1,
          DonViTinh: f.unit || 'Cái',
          ViTri: f.roomLocation,
          NgayTiepNhan: f.receivedDate || f.lastInspected || '',
          TinhTrang: f.condition || 'Tốt',
          NguoiQuanLy: f.manager || '',
          GhiChu: f.notes || '',
        })),
      });
    }
  }

  const guideRows: Array<[string, string, string]> = [
    ['NHÓM DỮ LIỆU', spec.title, spec.description],
    ['NGUYÊN TẮC', 'Không sửa tên cột (Dòng 1)', 'SchoolHub tự suy diễn nội dung đã phân loại theo tên Sheet Tab (Lớp/Thể loại/Nhóm) và đối chiếu tab DanhMuc.'],
    ...spec.guideSteps.map((st, idx): [string, string, string] => [
      `BƯỚC ${idx + 1}`,
      spec.dataTabNames.join(', '),
      st,
    ]),
  ];

  // Append field documentation rows
  const seenFields = new Set<string>();
  for (const tab of dataTabs) {
    for (const col of tab.columns) {
      if (seenFields.has(col.header)) continue;
      seenFields.add(col.header);
      guideRows.push([
        `CỘT: ${col.header}`,
        col.required ? 'Bắt buộc' : 'Tùy chọn',
        `${col.label} — ${col.description} (VD: ${col.example || '—'})`,
      ]);
    }
  }

  return { spec, danhMuc, guideRows, dataTabs };
}

export async function generateGroupWorkbookBuffer(
  groupKey: DataSourceGroupKey,
  context: DataSourceRuntimeContext,
  existing: Partial<DataSourceExistingData> = {}
): Promise<Uint8Array> {
  const plan = buildGroupTemplatePlan(groupKey, context, existing);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SchoolHub';
  workbook.created = new Date();

  // 1. HuongDan sheet
  const guideWs = workbook.addWorksheet('HuongDan');
  guideWs.addRow(['Mục', 'Quy định', 'Chi tiết hướng dẫn']);
  guideWs.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  guideWs.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
  for (const row of plan.guideRows) {
    guideWs.addRow(row);
  }
  guideWs.getColumn(1).width = 24;
  guideWs.getColumn(2).width = 28;
  guideWs.getColumn(3).width = 72;

  // 2. DanhMuc sheet (dynamic live DB lookup columns)
  const danhMucWs = workbook.addWorksheet('DanhMuc');
  const dmHeaders = plan.danhMuc.map((d) => d.header);
  danhMucWs.addRow(dmHeaders);
  danhMucWs.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  danhMucWs.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  danhMucWs.views = [{ state: 'frozen', ySplit: 1 }];

  const maxDmRows = Math.max(1, ...plan.danhMuc.map((d) => d.values.length));
  for (let r = 0; r < maxDmRows; r++) {
    danhMucWs.addRow(plan.danhMuc.map((d) => d.values[r] ?? ''));
  }
  plan.danhMuc.forEach((d, idx) => {
    danhMucWs.getColumn(idx + 1).width = Math.max(16, d.header.length + 4);
  });

  // Build formula reference map for each DanhMuc key
  const danhMucFormulaMap = new Map<string, string>();
  plan.danhMuc.forEach((d, idx) => {
    if (d.values.length === 0) return;
    const colL = columnLetter(idx + 1);
    const endRow = Math.max(2, d.values.length + 1);
    danhMucFormulaMap.set(d.key, `DanhMuc!$${colL}$2:$${colL}$${endRow}`);
  });

  // 3. Data Tabs
  for (const tab of plan.dataTabs) {
    const ws = workbook.addWorksheet(tab.tabName);
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    const headers = tab.columns.map((c) => c.header);
    ws.addRow(headers);
    const headerRow = ws.getRow(1);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    for (const rowObj of tab.rows) {
      ws.addRow(headers.map((h) => rowObj[h] ?? ''));
    }

    tab.columns.forEach((col, colIdx) => {
      const excelCol = ws.getColumn(colIdx + 1);
      excelCol.width = col.width || Math.max(16, col.header.length + 4);
      if (col.danhMucKey && danhMucFormulaMap.has(col.danhMucKey)) {
        const formula = danhMucFormulaMap.get(col.danhMucKey)!;
        const maxValidationRows = Math.max(200, tab.rows.length + 100);
        for (let r = 2; r <= maxValidationRows; r++) {
          ws.getCell(r, colIdx + 1).dataValidation = {
            type: 'list',
            allowBlank: !col.required,
            formulae: [formula],
            showErrorMessage: false,
            promptTitle: col.label,
            prompt: `Chọn giá trị từ DanhMuc (${col.label})`,
          };
        }
      }
    });

    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };
  }

  const buf = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buf);
}

const IGNORED_META_SHEETS = new Set(['huongdan', 'danhmuc', 'readme', 'guide']);

export function parseExcelWorkbookToGroupTabs(
  input: ArrayBuffer | Uint8Array,
  fileName: string = 'du-lieu.xlsx'
): ParsedGroupWorkbook {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const wb = XLSX.read(bytes, { type: 'array', cellDates: false });
  const tabs: Record<string, ParsedGroupTab> = {};

  for (const sheetName of wb.SheetNames) {
    const norm = normalizeHeaderMatchToken(sheetName);
    if (IGNORED_META_SHEETS.has(norm)) continue;
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
    if (matrix.length === 0) {
      tabs[sheetName] = { sheetName, headers: [], rows: [] };
      continue;
    }

    const rawHeaders = (matrix[0] || []).map((h) => normalizeText(h));
    const rows: Array<{ rowNumber: number; data: Record<string, unknown> }> = [];
    for (let rIdx = 1; rIdx < matrix.length; rIdx++) {
      const rowArr = matrix[rIdx] || [];
      const rowObj: Record<string, unknown> = {};
      let hasAnyValue = false;
      rawHeaders.forEach((header, cIdx) => {
        if (!header) return;
        const val = rowArr[cIdx];
        if (normalizeText(val) !== '') {
          hasAnyValue = true;
        }
        rowObj[header] = val;
      });
      if (hasAnyValue) {
        rows.push({
          rowNumber: rIdx + 1,
          data: rowObj,
        });
      }
    }

    tabs[sheetName] = {
      sheetName,
      headers: rawHeaders.filter(Boolean),
      rows,
    };
  }

  return {
    fileName,
    sheetNames: wb.SheetNames,
    tabs,
  };
}

export function convertSheetValueGridToParsedTab(
  sheetName: string,
  grid: unknown[][]
): ParsedGroupTab {
  if (!grid || grid.length === 0) {
    return { sheetName, headers: [], rows: [] };
  }
  const headers = (grid[0] || []).map((h) => normalizeText(h));
  const rows: Array<{ rowNumber: number; data: Record<string, unknown> }> = [];
  for (let i = 1; i < grid.length; i++) {
    const rowArr = grid[i] || [];
    const obj: Record<string, unknown> = {};
    let hasValue = false;
    headers.forEach((h, cIdx) => {
      if (!h) return;
      const val = rowArr[cIdx] ?? '';
      if (normalizeText(val) !== '') hasValue = true;
      obj[h] = val;
    });
    if (hasValue) {
      rows.push({ rowNumber: i + 1, data: obj });
    }
  }
  return { sheetName, headers: headers.filter(Boolean), rows };
}

function makeIssue(
  sheetName: string,
  rowNumber: number,
  col: GroupColumnSpec,
  value: unknown,
  message: string
): ValidationIssue {
  return {
    sheetName,
    rowNumber,
    field: col.key,
    header: col.header,
    value: normalizeText(value),
    message,
    severity: 'error',
  };
}

function safeDocId(prefix: string, rawKey: string): string {
  const clean = normalizeHeaderMatchToken(rawKey).toUpperCase().slice(0, 64);
  return `${prefix}-${clean || Date.now()}`;
}

export function validateAndNormalizeGroupData(
  groupKey: DataSourceGroupKey,
  tabsInput: Record<string, ParsedGroupTab>,
  context: DataSourceRuntimeContext,
  existing: DataSourceExistingData
): GroupValidationResult {
  const issues: ValidationIssue[] = [];
  const samplePreview: GroupValidationResult['samplePreview'] = [];
  const tabBreakdown: GroupSyncPreviewSummary['tabBreakdown'] = [];
  const defaultYear =
    context.systemSettings?.academicYear ||
    context.academicYears?.[0]?.name ||
    '2026 - 2027';

  let totalRows = 0;
  let createCount = 0;
  let updateCount = 0;

  const dataEntries = Object.values(tabsInput).filter(
    (t) => !IGNORED_META_SHEETS.has(normalizeHeaderMatchToken(t.sheetName))
  );

  if (dataEntries.length === 0) {
    issues.push({
      sheetName: 'Workbook',
      rowNumber: 1,
      field: 'sheet',
      header: 'Tab dữ liệu',
      value: '',
      message: 'Không tìm thấy tab dữ liệu hợp lệ cho nhóm này.',
      severity: 'error',
    });
  }

  /* ---------------------- 1. STUDENTS ---------------------- */
  if (groupKey === 'students') {
    const outStudents: Student[] = [];
    const seenStudentCodes = new Set<string>();
    const activeSubjectsAndClasses = context.classes || [];
    const validStatuses = resolveCatalogOptions({
      catalogId: 'student_status',
      runtime: context,
    }).map((o) => o.value);
    const validGenders = resolveCatalogOptions({
      catalogId: 'student_gender',
      runtime: context,
    }).map((o) => o.value);

    for (const tab of dataEntries) {
      let tabErrors = 0;
      const tabLower = tab.sheetName.toLowerCase();
      if (tab.rows.length === 0) {
        tabBreakdown.push({ tabName: tab.sheetName, rowCount: 0, errorCount: 0 });
        continue;
      }

      const inferredClassFromTab = tab.sheetName.startsWith('HocSinh_')
        ? tab.sheetName.slice('HocSinh_'.length).trim()
        : '';

      if (tabLower === 'huongdan' || tabLower === 'danhmuc') continue;

      for (const { rowNumber, data } of tab.rows) {
        totalRows += 1;
        const rowIssues: ValidationIssue[] = [];

        const code = normalizeText(resolveCellByColumnSpec(data, STUDENT_COLUMNS[0])).toUpperCase();
        const fullName = normalizeText(resolveCellByColumnSpec(data, STUDENT_COLUMNS[1]));
        const dobRaw = resolveCellByColumnSpec(data, STUDENT_COLUMNS[2]);
        const genderRaw = normalizeText(resolveCellByColumnSpec(data, STUDENT_COLUMNS[3]));
        const gradeRaw = normalizeText(resolveCellByColumnSpec(data, STUDENT_COLUMNS[4]));
        const classRaw = normalizeText(resolveCellByColumnSpec(data, STUDENT_COLUMNS[5]));
        const academicYear = normalizeText(resolveCellByColumnSpec(data, STUDENT_COLUMNS[6])) || defaultYear;
        const address = normalizeText(resolveCellByColumnSpec(data, STUDENT_COLUMNS[7]));
        const phoneRaw = resolveCellByColumnSpec(data, STUDENT_COLUMNS[8]);
        const emailRaw = resolveCellByColumnSpec(data, STUDENT_COLUMNS[9]);
        const parentName = normalizeText(resolveCellByColumnSpec(data, STUDENT_COLUMNS[10]));
        const parentPhoneRaw = resolveCellByColumnSpec(data, STUDENT_COLUMNS[11]);
        const statusRaw = normalizeText(resolveCellByColumnSpec(data, STUDENT_COLUMNS[12]));

        if (!code) rowIssues.push(makeIssue(tab.sheetName, rowNumber, STUDENT_COLUMNS[0], code, 'Thiếu MaHocSinh.'));
        if (!fullName) rowIssues.push(makeIssue(tab.sheetName, rowNumber, STUDENT_COLUMNS[1], fullName, 'Thiếu HoTen.'));

        const compositeKey = `${code}__${academicYear.toLowerCase()}`;
        if (code && seenStudentCodes.has(compositeKey)) {
          rowIssues.push(
            makeIssue(tab.sheetName, rowNumber, STUDENT_COLUMNS[0], code, `Trùng MaHocSinh "${code}" trong cùng năm học "${academicYear}".`)
          );
        } else if (code) {
          seenStudentCodes.add(compositeKey);
        }

        const effectiveClassName = classRaw || (inferredClassFromTab !== 'Mau' ? inferredClassFromTab : '');
        if (!effectiveClassName) {
          rowIssues.push(makeIssue(tab.sheetName, rowNumber, STUDENT_COLUMNS[5], classRaw, 'Thiếu tên Lớp.'));
        } else if (
          inferredClassFromTab &&
          inferredClassFromTab !== 'Mau' &&
          classRaw &&
          normalizeHeaderMatchToken(classRaw) !== normalizeHeaderMatchToken(inferredClassFromTab)
        ) {
          rowIssues.push(
            makeIssue(
              tab.sheetName,
              rowNumber,
              STUDENT_COLUMNS[5],
              classRaw,
              `Cột Lop "${classRaw}" không khớp với tab "${tab.sheetName}".`
            )
          );
        }

        const matchedClass = activeSubjectsAndClasses.find(
          (c) => normalizeHeaderMatchToken(c.name) === normalizeHeaderMatchToken(effectiveClassName)
        );
        if (effectiveClassName && matchedClass?.status === 'inactive') {
          rowIssues.push(
            makeIssue(
              tab.sheetName,
              rowNumber,
              STUDENT_COLUMNS[5],
              effectiveClassName,
              `Lớp "${matchedClass.name}" đã ngừng sử dụng, không thể tiếp nhận học sinh mới.`
            )
          );
        }

        const dobRes = normalizeDateValue(dobRaw);
        if (!dobRes.valid) {
          rowIssues.push(makeIssue(tab.sheetName, rowNumber, STUDENT_COLUMNS[2], dobRaw, dobRes.error || 'Sai định dạng NgaySinh.'));
        }

        const genderMatched =
          !genderRaw
            ? 'Nam'
            : validGenders.find((g) => g.toLowerCase() === genderRaw.toLowerCase());
        if (genderRaw && !genderMatched) {
          rowIssues.push(
            makeIssue(tab.sheetName, rowNumber, STUDENT_COLUMNS[3], genderRaw, `Giới tính "${genderRaw}" không hợp lệ (${validGenders.join(', ')}).`)
          );
        }

        const presetClassMatch = (context.systemSettings?.presetClasses || []).find(
          (p) => normalizeHeaderMatchToken(p?.name) === normalizeHeaderMatchToken(effectiveClassName)
        );
        const parsedGrade = gradeRaw
          ? Number(gradeRaw)
          : matchedClass?.grade || presetClassMatch?.grade || Number(effectiveClassName.match(/^(\d{2})/)?.[1] || 10);
        if (!Number.isInteger(parsedGrade) || parsedGrade < 1 || parsedGrade > 12) {
          rowIssues.push(makeIssue(tab.sheetName, rowNumber, STUDENT_COLUMNS[4], gradeRaw, 'Khoi phải là số nguyên từ 1 đến 12.'));
        } else if (matchedClass && matchedClass.grade !== parsedGrade) {
          rowIssues.push(
            makeIssue(tab.sheetName, rowNumber, STUDENT_COLUMNS[4], gradeRaw, `Lớp "${matchedClass.name}" thuộc Khối ${matchedClass.grade}, không phải Khối ${parsedGrade}.`)
          );
        }

        const phoneRes = normalizePhoneValue(phoneRaw);
        if (!phoneRes.valid) {
          rowIssues.push(makeIssue(tab.sheetName, rowNumber, STUDENT_COLUMNS[8], phoneRaw, phoneRes.error || 'SĐT không hợp lệ.'));
        }
        const parentPhoneRes = normalizePhoneValue(parentPhoneRaw);
        if (!parentPhoneRes.valid) {
          rowIssues.push(makeIssue(tab.sheetName, rowNumber, STUDENT_COLUMNS[11], parentPhoneRaw, parentPhoneRes.error || 'SĐT phụ huynh không hợp lệ.'));
        }

        const emailRes = validateEmailValue(emailRaw);
        if (!emailRes.valid) {
          rowIssues.push(makeIssue(tab.sheetName, rowNumber, STUDENT_COLUMNS[9], emailRaw, emailRes.error || 'Email không hợp lệ.'));
        }

        const statusMatched =
          !statusRaw
            ? 'Đang học'
            : validStatuses.find((s) => s.toLowerCase() === statusRaw.toLowerCase());
        if (statusRaw && !statusMatched) {
          rowIssues.push(
            makeIssue(tab.sheetName, rowNumber, STUDENT_COLUMNS[12], statusRaw, `Trạng thái "${statusRaw}" không nằm trong danh mục (${validStatuses.join(', ')}).`)
          );
        }

        if (rowIssues.length > 0) {
          issues.push(...rowIssues);
          tabErrors += rowIssues.length;
          samplePreview.push({
            tabName: tab.sheetName,
            rowNumber,
            key: code || `#${rowNumber}`,
            label: fullName || '(Chưa có tên)',
            action: 'error',
            errorMessage: rowIssues[0].message,
          });
          continue;
        }

        // Multi-academic-year isolation: match existing by studentCode + same/empty academicYear; OR match existing studentCode for class transfer in same academicYear
        const existingMatch =
          existing.students.find(
            (s) =>
              s.studentCode.toUpperCase() === code &&
              (normalizeText(s.academicYear || defaultYear).toLowerCase() === academicYear.toLowerCase())
          ) ||
          (academicYear.toLowerCase() === defaultYear.toLowerCase()
            ? existing.students.find(
                (s) => s.studentCode.toUpperCase() === code && !s.academicYear
              )
            : undefined);

        if (existingMatch) updateCount += 1;
        else createCount += 1;

        const yearSuffix = academicYear.replace(/[^0-9]/g, '');
        const normalizedStudent: Student = {
          ...(existingMatch || {}),
          id: existingMatch?.id || safeDocId('STU', `${code}_${yearSuffix || 'CUR'}`),
          studentCode: code,
          fullName,
          dateOfBirth: dobRes.value || existingMatch?.dateOfBirth || '2010-01-01',
          gender: (genderMatched || 'Nam') as Student['gender'],
          grade: parsedGrade,
          classId: matchedClass?.id || existingMatch?.classId || safeDocId('CLS', effectiveClassName),
          className: matchedClass?.name || effectiveClassName,
          academicYear,
          address: address || existingMatch?.address || '',
          email: emailRes.value || existingMatch?.email || '',
          parentName: parentName || existingMatch?.parentName || '',
          parentPhone: parentPhoneRes.value || phoneRes.value || existingMatch?.parentPhone || '',
          rfidCardId: existingMatch?.rfidCardId || `RFID-${code}`,
          status: (statusMatched || 'Đang học') as Student['status'],
        };
        outStudents.push(normalizedStudent);
        if (samplePreview.length < 25) {
          samplePreview.push({
            tabName: tab.sheetName,
            rowNumber,
            key: code,
            label: `${fullName} (${normalizedStudent.className})`,
            action: existingMatch ? 'update' : 'create',
          });
        }
      }
      tabBreakdown.push({ tabName: tab.sheetName, rowCount: tab.rows.length, errorCount: tabErrors });
    }

    const existingClassNamesLower = new Set(
      (context.classes || []).map((c) => c.name.trim().toLowerCase())
    );
    const autoClassesMap = new Map<string, string>();
    for (const s of outStudents) {
      if (!s.className) continue;
      const lower = s.className.toLowerCase();
      if (!existingClassNamesLower.has(lower) && !autoClassesMap.has(lower)) {
        autoClassesMap.set(lower, s.className);
      }
    }

    return {
      valid: issues.length === 0,
      groupKey,
      autoClassesToCreate: Array.from(autoClassesMap.values()),
      issues,
      summary: {
        totalRows,
        validRows: outStudents.length,
        createCount,
        updateCount,
        unchangedCount: 0,
        errorCount: issues.length,
        tabBreakdown,
      },
      normalized: { students: outStudents },
      samplePreview,
    };
  }

  /* ---------------------- 2. STAFF (GiaoVien + NhanVien) ---------------------- */
  if (groupKey === 'staff') {
    const outTeachers: Teacher[] = [];
    const outStaff: StaffMember[] = [];
    const seenKeys = new Set<string>();
    const validSubjects = resolveCatalogOptions({ catalogId: 'teacher_subject', runtime: context }).map((o) => o.value);
    const validStatuses = resolveCatalogOptions({ catalogId: 'staff_status', runtime: context }).map((o) => o.value);
    const validGenders = resolveCatalogOptions({ catalogId: 'student_gender', runtime: context }).map((o) => o.value);

    for (const tab of dataEntries) {
      let tabErrors = 0;
      const tabNorm = normalizeHeaderMatchToken(tab.sheetName);
      const defaultIsTeacher = tabNorm.includes('giaovien') || tabNorm.includes('teacher');
      const defaultIsStaff = tabNorm.includes('nhanvien') || tabNorm.includes('staff');

      for (const { rowNumber, data } of tab.rows) {
        totalRows += 1;
        const rowIssues: ValidationIssue[] = [];

        const code = normalizeText(resolveCellByColumnSpec(data, STAFF_COLUMNS[0])).toUpperCase();
        const fullName = normalizeText(resolveCellByColumnSpec(data, STAFF_COLUMNS[1]));
        const dobRaw = resolveCellByColumnSpec(data, STAFF_COLUMNS[2]);
        const genderRaw = normalizeText(resolveCellByColumnSpec(data, STAFF_COLUMNS[3]));
        const emailRaw = resolveCellByColumnSpec(data, STAFF_COLUMNS[4]);
        const phoneRaw = resolveCellByColumnSpec(data, STAFF_COLUMNS[5]);
        const staffTypeRaw = normalizeText(resolveCellByColumnSpec(data, STAFF_COLUMNS[6]));
        const position = normalizeText(resolveCellByColumnSpec(data, STAFF_COLUMNS[7]));
        const profGroup = normalizeText(resolveCellByColumnSpec(data, STAFF_COLUMNS[8]));
        const dept = normalizeText(resolveCellByColumnSpec(data, STAFF_COLUMNS[9]));
        const subjectRaw = normalizeText(resolveCellByColumnSpec(data, STAFF_COLUMNS[10]));
        const statusRaw = normalizeText(resolveCellByColumnSpec(data, STAFF_COLUMNS[11]));

        if (!code) rowIssues.push(makeIssue(tab.sheetName, rowNumber, STAFF_COLUMNS[0], code, 'Thiếu MaNhanSu.'));
        if (!fullName) rowIssues.push(makeIssue(tab.sheetName, rowNumber, STAFF_COLUMNS[1], fullName, 'Thiếu HoTen.'));

        if (code) {
          if (seenKeys.has(code)) {
            rowIssues.push(makeIssue(tab.sheetName, rowNumber, STAFF_COLUMNS[0], code, `Trùng MaNhanSu "${code}".`));
          } else {
            seenKeys.add(code);
          }
        }

        const dobRes = normalizeDateValue(dobRaw);
        if (!dobRes.valid) {
          rowIssues.push(makeIssue(tab.sheetName, rowNumber, STAFF_COLUMNS[2], dobRaw, dobRes.error || 'Sai định dạng NgaySinh.'));
        }
        const emailRes = validateEmailValue(emailRaw);
        if (!emailRes.valid) {
          rowIssues.push(makeIssue(tab.sheetName, rowNumber, STAFF_COLUMNS[4], emailRaw, emailRes.error || 'Email không hợp lệ.'));
        }
        const phoneRes = normalizePhoneValue(phoneRaw);
        if (!phoneRes.valid) {
          rowIssues.push(makeIssue(tab.sheetName, rowNumber, STAFF_COLUMNS[5], phoneRaw, phoneRes.error || 'Số điện thoại không hợp lệ.'));
        }
        const genderMatched = !genderRaw
          ? 'Nam'
          : validGenders.find((g) => g.toLowerCase() === genderRaw.toLowerCase());
        if (genderRaw && !genderMatched) {
          rowIssues.push(makeIssue(tab.sheetName, rowNumber, STAFF_COLUMNS[3], genderRaw, `Giới tính "${genderRaw}" không hợp lệ.`));
        }

        const isTeacherRow = staffTypeRaw
          ? normalizeHeaderMatchToken(staffTypeRaw).includes('giaovien')
          : defaultIsTeacher || (!defaultIsStaff && Boolean(subjectRaw));

        const subjectMatched = subjectRaw
          ? validSubjects.find((s) => s.toLowerCase() === subjectRaw.toLowerCase()) || subjectRaw
          : '';
        if (isTeacherRow && !subjectMatched && !profGroup) {
          rowIssues.push(
            makeIssue(tab.sheetName, rowNumber, STAFF_COLUMNS[10], subjectRaw, 'Giáo viên cần có MonGiangDay hoặc ToChuyenMon.')
          );
        }

        const statusMatched = !statusRaw
          ? 'Đang công tác'
          : validStatuses.find((s) => s.toLowerCase() === statusRaw.toLowerCase());
        if (statusRaw && !statusMatched) {
          rowIssues.push(makeIssue(tab.sheetName, rowNumber, STAFF_COLUMNS[11], statusRaw, `Trạng thái "${statusRaw}" không hợp lệ.`));
        }

        if (rowIssues.length > 0) {
          issues.push(...rowIssues);
          tabErrors += rowIssues.length;
          samplePreview.push({
            tabName: tab.sheetName,
            rowNumber,
            key: code || `#${rowNumber}`,
            label: fullName || '(Chưa có tên)',
            action: 'error',
            errorMessage: rowIssues[0].message,
          });
          continue;
        }

        if (isTeacherRow) {
          const existingMatch = existing.teachers.find(
            (t) =>
              (t.teacherCode && t.teacherCode.toUpperCase() === code) ||
              (emailRes.value && t.email?.toLowerCase() === emailRes.value)
          );
          if (existingMatch) updateCount += 1;
          else createCount += 1;

          const teacher: Teacher = {
            ...(existingMatch || {}),
            id: existingMatch?.id || safeDocId('TCH', code),
            teacherCode: code,
            fullName,
            dateOfBirth: dobRes.value || existingMatch?.dateOfBirth,
            gender: (genderMatched || 'Nam') as Teacher['gender'],
            email: emailRes.value || existingMatch?.email || '',
            phone: phoneRes.value || existingMatch?.phone || '',
            position: position || existingMatch?.position || 'Giáo viên bộ môn',
            department: profGroup || existingMatch?.department || '',
            subject: subjectMatched || existingMatch?.subject || 'Toán học',
            isHomeroom:
              existingMatch?.isHomeroom ??
              normalizeHeaderMatchToken(position).includes('chunhiem'),
            role:
              existingMatch?.role ||
              (normalizeHeaderMatchToken(position).includes('chunhiem')
                ? 'homeroom_teacher'
                : 'subject_teacher'),
            status: (statusMatched || 'Đang công tác') as Teacher['status'],
          };
          outTeachers.push(teacher);
          if (samplePreview.length < 25) {
            samplePreview.push({
              tabName: tab.sheetName,
              rowNumber,
              key: code,
              label: `${fullName} · GV ${teacher.subject}`,
              action: existingMatch ? 'update' : 'create',
            });
          }
        } else {
          const existingMatch = existing.staffMembers.find(
            (s) =>
              s.staffCode.toUpperCase() === code ||
              (emailRes.value && s.email?.toLowerCase() === emailRes.value)
          );
          if (existingMatch) updateCount += 1;
          else createCount += 1;

          const staff: StaffMember = {
            ...(existingMatch || {}),
            id: existingMatch?.id || safeDocId('STF', code),
            staffCode: code,
            fullName,
            dateOfBirth: dobRes.value || existingMatch?.dateOfBirth,
            gender: (genderMatched || 'Nam') as StaffMember['gender'],
            email: emailRes.value || existingMatch?.email || '',
            phone: phoneRes.value || existingMatch?.phone || '',
            position: position || existingMatch?.position || 'Chuyên viên hành chính',
            department: dept || existingMatch?.department || 'Văn phòng',
            status: (statusMatched || 'Đang công tác') as StaffMember['status'],
          };
          outStaff.push(staff);
          if (samplePreview.length < 25) {
            samplePreview.push({
              tabName: tab.sheetName,
              rowNumber,
              key: code,
              label: `${fullName} · ${staff.department}`,
              action: existingMatch ? 'update' : 'create',
            });
          }
        }
      }
      tabBreakdown.push({ tabName: tab.sheetName, rowCount: tab.rows.length, errorCount: tabErrors });
    }

    return {
      valid: issues.length === 0,
      groupKey,
      issues,
      summary: {
        totalRows,
        validRows: outTeachers.length + outStaff.length,
        createCount,
        updateCount,
        unchangedCount: 0,
        errorCount: issues.length,
        tabBreakdown,
      },
      normalized: { teachers: outTeachers, staffMembers: outStaff },
      samplePreview,
    };
  }

  /* ---------------------- 3. LEARNING (TKB + ThoiGianBieu_BuoiChieu) ---------------------- */
  if (groupKey === 'learning') {
    const timetableMap = new Map<string, TimetableEntry>();
    const outAfternoon: AfternoonScheduleEntry[] = [];
    const seenAfternoonKeys = new Set<string>();
    const validSubjects = resolveCatalogOptions({ catalogId: 'teacher_subject', runtime: context }).map((o) => o.value);

    for (const tab of dataEntries) {
      let tabErrors = 0;
      const tabNorm = normalizeHeaderMatchToken(tab.sheetName);
      const isAfternoonTab =
        tabNorm.includes('buoichieu') || tabNorm.includes('afternoon');

      if (isAfternoonTab) {
        for (const { rowNumber, data } of tab.rows) {
          totalRows += 1;
          const rowIssues: ValidationIssue[] = [];
          const academicYear = normalizeText(resolveCellByColumnSpec(data, AFTERNOON_COLUMNS[0])) || defaultYear;
          const dateRaw = resolveCellByColumnSpec(data, AFTERNOON_COLUMNS[1]);
          const dayRaw = resolveCellByColumnSpec(data, AFTERNOON_COLUMNS[2]);
          const gradeRaw = normalizeText(resolveCellByColumnSpec(data, AFTERNOON_COLUMNS[3]));
          const className = normalizeText(resolveCellByColumnSpec(data, AFTERNOON_COLUMNS[4]));
          const startRes = parseTimeHHMM(resolveCellByColumnSpec(data, AFTERNOON_COLUMNS[5]));
          const endRes = parseTimeHHMM(resolveCellByColumnSpec(data, AFTERNOON_COLUMNS[6]));
          const activity = normalizeText(resolveCellByColumnSpec(data, AFTERNOON_COLUMNS[7]));
          const location = normalizeText(resolveCellByColumnSpec(data, AFTERNOON_COLUMNS[8]));
          const coordinator = normalizeText(resolveCellByColumnSpec(data, AFTERNOON_COLUMNS[9]));
          const notes = normalizeText(resolveCellByColumnSpec(data, AFTERNOON_COLUMNS[10]));

          const dateRes = normalizeDateValue(dateRaw);
          if (!dateRes.valid) {
            rowIssues.push(makeIssue(tab.sheetName, rowNumber, AFTERNOON_COLUMNS[1], dateRaw, dateRes.error || 'Ngày không hợp lệ.'));
          }
          const dayOfWeek = formatSyncDayOfWeekInput(dayRaw);
          if (!dayOfWeek) {
            rowIssues.push(makeIssue(tab.sheetName, rowNumber, AFTERNOON_COLUMNS[2], dayRaw, 'Thứ phải từ 2 đến 7.'));
          }
          if (!startRes.valid || !startRes.value) {
            rowIssues.push(makeIssue(tab.sheetName, rowNumber, AFTERNOON_COLUMNS[5], startRes.value, 'Thiếu hoặc sai GioBatDau (HH:MM).'));
          }
          if (!endRes.valid || !endRes.value) {
            rowIssues.push(makeIssue(tab.sheetName, rowNumber, AFTERNOON_COLUMNS[6], endRes.value, 'Thiếu hoặc sai GioKetThuc (HH:MM).'));
          }
          if (!activity) {
            rowIssues.push(makeIssue(tab.sheetName, rowNumber, AFTERNOON_COLUMNS[7], activity, 'Thiếu HoatDong buổi chiều.'));
          }

          if (rowIssues.length > 0) {
            issues.push(...rowIssues);
            tabErrors += rowIssues.length;
            continue;
          }

          const bizKey = `${academicYear}__${dateRes.value || 'WEEKLY'}__D${dayOfWeek}__${className || 'ALL'}__${startRes.value}__${normalizeHeaderMatchToken(activity)}`;
          if (seenAfternoonKeys.has(bizKey)) continue;
          seenAfternoonKeys.add(bizKey);

          const existingMatch = existing.afternoonSchedules.find(
            (a) =>
              (a.academicYear || defaultYear) === academicYear &&
              a.dayOfWeek === dayOfWeek &&
              (a.className || '') === className &&
              a.startTime === startRes.value &&
              a.activity.toLowerCase() === activity.toLowerCase()
          );
          if (existingMatch) updateCount += 1;
          else createCount += 1;

          const entry: AfternoonScheduleEntry = {
            ...(existingMatch || {}),
            id: existingMatch?.id || safeDocId('AFT', bizKey),
            academicYear,
            date: dateRes.value || undefined,
            dayOfWeek: dayOfWeek!,
            grade: gradeRaw ? Number(gradeRaw) : undefined,
            className: className || 'Toàn trường',
            startTime: startRes.value,
            endTime: endRes.value,
            activity,
            location: location || 'Sân trường',
            coordinator: coordinator || '',
            notes,
          };
          outAfternoon.push(entry);
          if (samplePreview.length < 25) {
            samplePreview.push({
              tabName: tab.sheetName,
              rowNumber,
              key: `T${dayOfWeek} ${startRes.value}`,
              label: `${activity} (${entry.className})`,
              action: existingMatch ? 'update' : 'create',
            });
          }
        }
        tabBreakdown.push({ tabName: tab.sheetName, rowCount: tab.rows.length, errorCount: tabErrors });
        continue;
      }

      // Timetable tab (TKB_ToanTruong or TKB_<Lop>)
      const inferredClassFromTab = tab.sheetName.startsWith('TKB_') && tabNorm !== 'tkbtoantruong'
        ? tab.sheetName.slice('TKB_'.length).trim()
        : '';

      for (const { rowNumber, data } of tab.rows) {
        totalRows += 1;
        const rowIssues: ValidationIssue[] = [];
        const academicYear = normalizeText(resolveCellByColumnSpec(data, TIMETABLE_COLUMNS[0])) || defaultYear;
        const semester = normalizeText(resolveCellByColumnSpec(data, TIMETABLE_COLUMNS[1])) || 'HK1';
        const gradeRaw = normalizeText(resolveCellByColumnSpec(data, TIMETABLE_COLUMNS[2]));
        const classRaw = normalizeText(resolveCellByColumnSpec(data, TIMETABLE_COLUMNS[3]));
        const dayRaw = resolveCellByColumnSpec(data, TIMETABLE_COLUMNS[4]);
        const periodRaw = normalizeText(resolveCellByColumnSpec(data, TIMETABLE_COLUMNS[5]));
        const startRes = parseTimeHHMM(resolveCellByColumnSpec(data, TIMETABLE_COLUMNS[6]));
        const endRes = parseTimeHHMM(resolveCellByColumnSpec(data, TIMETABLE_COLUMNS[7]));
        const subjectRaw = normalizeText(resolveCellByColumnSpec(data, TIMETABLE_COLUMNS[8]));
        const teacherName = normalizeText(resolveCellByColumnSpec(data, TIMETABLE_COLUMNS[9]));
        const room = normalizeText(resolveCellByColumnSpec(data, TIMETABLE_COLUMNS[10]));
        const notes = normalizeText(resolveCellByColumnSpec(data, TIMETABLE_COLUMNS[11]));

        const effectiveClass = classRaw || inferredClassFromTab;
        if (!effectiveClass) {
          rowIssues.push(makeIssue(tab.sheetName, rowNumber, TIMETABLE_COLUMNS[3], classRaw, 'Thiếu Lớp.'));
        }
        const matchedClass = context.classes.find(
          (c) => normalizeHeaderMatchToken(c.name) === normalizeHeaderMatchToken(effectiveClass)
        );
        const presetClassMatch = (context.systemSettings?.presetClasses || []).find(
          (p) => normalizeHeaderMatchToken(p?.name) === normalizeHeaderMatchToken(effectiveClass)
        );
        if (effectiveClass && matchedClass?.status === 'inactive') {
          rowIssues.push(
            makeIssue(
              tab.sheetName,
              rowNumber,
              TIMETABLE_COLUMNS[3],
              effectiveClass,
              `Lớp "${matchedClass.name}" đã ngừng sử dụng, không thể nhận TKB mới.`
            )
          );
        }
        const dayOfWeek = formatSyncDayOfWeekInput(dayRaw);
        if (!dayOfWeek) {
          rowIssues.push(makeIssue(tab.sheetName, rowNumber, TIMETABLE_COLUMNS[4], dayRaw, 'Thu phải từ 2 đến 7.'));
        }
        const period = Number(periodRaw);
        if (!Number.isInteger(period) || period < 1 || period > 10) {
          rowIssues.push(makeIssue(tab.sheetName, rowNumber, TIMETABLE_COLUMNS[5], periodRaw, 'Tiet phải là số nguyên từ 1 đến 10.'));
        }
        if (!subjectRaw) {
          rowIssues.push(makeIssue(tab.sheetName, rowNumber, TIMETABLE_COLUMNS[8], subjectRaw, 'Thiếu MonHoc.'));
        } else if (
          validSubjects.length > 0 &&
          !validSubjects.some((s) => normalizeHeaderMatchToken(s) === normalizeHeaderMatchToken(subjectRaw))
        ) {
          rowIssues.push(
            makeIssue(tab.sheetName, rowNumber, TIMETABLE_COLUMNS[8], subjectRaw, `Môn "${subjectRaw}" chưa nằm trong Danh mục Môn học SchoolHub.`)
          );
        }
        if (!startRes.valid) {
          rowIssues.push(makeIssue(tab.sheetName, rowNumber, TIMETABLE_COLUMNS[6], startRes.value, 'GioBatDau phải dạng HH:MM.'));
        }
        if (!endRes.valid) {
          rowIssues.push(makeIssue(tab.sheetName, rowNumber, TIMETABLE_COLUMNS[7], endRes.value, 'GioKetThuc phải dạng HH:MM.'));
        }

        if (rowIssues.length > 0) {
          issues.push(...rowIssues);
          tabErrors += rowIssues.length;
          samplePreview.push({
            tabName: tab.sheetName,
            rowNumber,
            key: effectiveClass || `#${rowNumber}`,
            label: subjectRaw || '(Lỗi dòng)',
            action: 'error',
            errorMessage: rowIssues[0].message,
          });
          continue;
        }

        const matchedSubject =
          validSubjects.find((s) => normalizeHeaderMatchToken(s) === normalizeHeaderMatchToken(subjectRaw)) || subjectRaw;
        const slotKey = `${academicYear}__${semester}__${normalizeHeaderMatchToken(matchedClass?.name || effectiveClass)}__D${dayOfWeek}__P${period}`;
        const existingMatch = existing.timetable.find(
          (t) =>
            normalizeHeaderMatchToken(t.className) === normalizeHeaderMatchToken(matchedClass?.name || effectiveClass) &&
            t.dayOfWeek === dayOfWeek &&
            t.period === period &&
            (t.academicYear || defaultYear) === academicYear &&
            (t.semester || 'HK1') === semester
        );

        const inferredGrade =
          gradeRaw
            ? Number(gradeRaw)
            : matchedClass?.grade || presetClassMatch?.grade || Number(effectiveClass.match(/^(\d{2})/)?.[1] || 0) || undefined;

        const entry: TimetableEntry = {
          ...(existingMatch || {}),
          id: existingMatch?.id || safeDocId('TT', slotKey),
          academicYear,
          semester,
          grade: inferredGrade,
          classId: matchedClass?.id || existingMatch?.classId || safeDocId('CLS', effectiveClass),
          className: matchedClass?.name || effectiveClass,
          dayOfWeek: dayOfWeek!,
          period,
          startTime: startRes.value || undefined,
          endTime: endRes.value || undefined,
          subject: matchedSubject,
          teacherName: teacherName || 'Chưa phân công',
          room: room || matchedClass?.room || '',
          notes,
        };
        timetableMap.set(slotKey, entry);
        if (samplePreview.length < 25) {
          samplePreview.push({
            tabName: tab.sheetName,
            rowNumber,
            key: `${entry.className} · T${dayOfWeek}-T${period}`,
            label: matchedSubject,
            action: existingMatch ? 'update' : 'create',
          });
        }
      }
      tabBreakdown.push({ tabName: tab.sheetName, rowCount: tab.rows.length, errorCount: tabErrors });
    }

    const outTimetable = Array.from(timetableMap.values());
    createCount = outTimetable.filter(
      (e) => !existing.timetable.some((x) => x.id === e.id)
    ).length + outAfternoon.filter(
      (a) => !existing.afternoonSchedules.some((x) => x.id === a.id)
    ).length;
    updateCount = outTimetable.length + outAfternoon.length - createCount;

    const existingClassNamesLower = new Set(
      (context.classes || []).map((c) => c.name.trim().toLowerCase())
    );
    const autoClassesMap = new Map<string, string>();
    for (const t of outTimetable) {
      if (!t.className) continue;
      const lower = t.className.toLowerCase();
      if (!existingClassNamesLower.has(lower) && !autoClassesMap.has(lower)) {
        autoClassesMap.set(lower, t.className);
      }
    }
    for (const a of outAfternoon) {
      if (!a.className || a.className.toLowerCase() === 'toàn trường') continue;
      const lower = a.className.toLowerCase();
      if (!existingClassNamesLower.has(lower) && !autoClassesMap.has(lower)) {
        autoClassesMap.set(lower, a.className);
      }
    }

    return {
      valid: issues.length === 0,
      groupKey,
      autoClassesToCreate: Array.from(autoClassesMap.values()),
      issues,
      summary: {
        totalRows,
        validRows: outTimetable.length + outAfternoon.length,
        createCount,
        updateCount,
        unchangedCount: 0,
        errorCount: issues.length,
        tabBreakdown,
      },
      normalized: {
        timetable: outTimetable,
        afternoonSchedules: outAfternoon,
      },
      samplePreview,
    };
  }

  /* ---------------------- 4. BOOKS (Sach) ---------------------- */
  if (groupKey === 'books') {
    const outBooks: Book[] = [];
    const seenKeys = new Set<string>();
    const validCategories = resolveCatalogOptions({
      catalogId: 'book_category',
      runtime: context,
    }).map((o) => o.value);

    for (const tab of dataEntries) {
      let tabErrors = 0;
      const inferredCategoryFromTab = tab.sheetName.startsWith('Sach_')
        ? (() => {
            const rawSuffix = tab.sheetName.slice('Sach_'.length).trim();
            const normTab = normalizeHeaderMatchToken(tab.sheetName);
            const matchedCatalog = validCategories.find(
              (c) => normalizeHeaderMatchToken(`Sach_${c}`) === normTab || normalizeHeaderMatchToken(c) === normalizeHeaderMatchToken(rawSuffix)
            );
            return matchedCatalog || (rawSuffix !== 'Mau' ? rawSuffix : '');
          })()
        : '';

      for (const { rowNumber, data } of tab.rows) {
        totalRows += 1;
        const rowIssues: ValidationIssue[] = [];

        const bookCode = normalizeText(resolveCellByColumnSpec(data, BOOK_COLUMNS[0])).toUpperCase();
        const isbn = normalizeText(resolveCellByColumnSpec(data, BOOK_COLUMNS[1]));
        const title = normalizeText(resolveCellByColumnSpec(data, BOOK_COLUMNS[2]));
        const author = normalizeText(resolveCellByColumnSpec(data, BOOK_COLUMNS[3]));
        const publisher = normalizeText(resolveCellByColumnSpec(data, BOOK_COLUMNS[4]));
        const pubYearRaw = normalizeText(resolveCellByColumnSpec(data, BOOK_COLUMNS[5]));
        const categoryRaw = normalizeText(resolveCellByColumnSpec(data, BOOK_COLUMNS[6])) || inferredCategoryFromTab;
        const shelfLocation = normalizeText(resolveCellByColumnSpec(data, BOOK_COLUMNS[7]));
        const totalRaw = normalizeText(resolveCellByColumnSpec(data, BOOK_COLUMNS[8]));
        const availRaw = normalizeText(resolveCellByColumnSpec(data, BOOK_COLUMNS[9]));
        const status = normalizeText(resolveCellByColumnSpec(data, BOOK_COLUMNS[10])) || 'Sẵn sàng';
        const notes = normalizeText(resolveCellByColumnSpec(data, BOOK_COLUMNS[11]));

        const key = bookCode || isbn;
        if (!key) rowIssues.push(makeIssue(tab.sheetName, rowNumber, BOOK_COLUMNS[0], '', 'Cần có MaSach hoặc ISBN.'));
        if (!title) rowIssues.push(makeIssue(tab.sheetName, rowNumber, BOOK_COLUMNS[2], title, 'Thiếu TenSach.'));
        if (!author) rowIssues.push(makeIssue(tab.sheetName, rowNumber, BOOK_COLUMNS[3], author, 'Thiếu TacGia.'));

        const keyNorm = key.toUpperCase();
        if (key && seenKeys.has(keyNorm)) {
          rowIssues.push(makeIssue(tab.sheetName, rowNumber, BOOK_COLUMNS[0], key, `Trùng mã sách "${key}".`));
        } else if (key) {
          seenKeys.add(keyNorm);
        }

        const catMatched =
          validCategories.find((c) => c.toLowerCase() === categoryRaw.toLowerCase()) || categoryRaw;
        if (!catMatched) {
          rowIssues.push(makeIssue(tab.sheetName, rowNumber, BOOK_COLUMNS[6], categoryRaw, 'Thiếu TheLoai sách.'));
        }

        const totalCopies = Number(totalRaw);
        if (!Number.isInteger(totalCopies) || totalCopies < 0) {
          rowIssues.push(makeIssue(tab.sheetName, rowNumber, BOOK_COLUMNS[8], totalRaw, 'SoLuongTong phải là số nguyên >= 0.'));
        }

        const existingMatch = existing.books.find(
          (b) =>
            (bookCode && b.bookCode?.toUpperCase() === bookCode) ||
            (isbn && b.isbn?.toLowerCase() === isbn.toLowerCase())
        );

        const activeLoanedCount = existingMatch
          ? Math.max(0, (existingMatch.totalCopies || 0) - (existingMatch.availableCopies || 0))
          : 0;

        if (Number.isInteger(totalCopies) && totalCopies < activeLoanedCount) {
          rowIssues.push(
            makeIssue(
              tab.sheetName,
              rowNumber,
              BOOK_COLUMNS[8],
              totalRaw,
              `Số lượng tổng (${totalCopies}) nhỏ hơn số bản đang cho mượn (${activeLoanedCount}).`
            )
          );
        }

        let availableCopies = availRaw !== '' ? Number(availRaw) : Math.max(0, totalCopies - activeLoanedCount);
        if (!Number.isInteger(availableCopies) || availableCopies < 0 || availableCopies > totalCopies) {
          if (availRaw !== '') {
            rowIssues.push(
              makeIssue(tab.sheetName, rowNumber, BOOK_COLUMNS[9], availRaw, 'SoLuongHienCo phải từ 0 đến SoLuongTong.')
            );
          } else {
            availableCopies = Math.max(0, totalCopies - activeLoanedCount);
          }
        }

        if (rowIssues.length > 0) {
          issues.push(...rowIssues);
          tabErrors += rowIssues.length;
          samplePreview.push({
            tabName: tab.sheetName,
            rowNumber,
            key: key || `#${rowNumber}`,
            label: title || '(Chưa có tên sách)',
            action: 'error',
            errorMessage: rowIssues[0].message,
          });
          continue;
        }

        if (existingMatch) updateCount += 1;
        else createCount += 1;

        const book: Book = {
          ...(existingMatch || {}),
          id: existingMatch?.id || safeDocId('BK', key),
          bookCode: bookCode || existingMatch?.bookCode || key,
          isbn: isbn || existingMatch?.isbn || bookCode,
          title,
          author,
          publisher: publisher || existingMatch?.publisher || '',
          publishYear: pubYearRaw ? Number(pubYearRaw) || 2024 : existingMatch?.publishYear || 2024,
          category: catMatched,
          shelfLocation: shelfLocation || existingMatch?.shelfLocation || 'Kệ chung',
          totalCopies,
          availableCopies: existingMatch
            ? Math.min(totalCopies, Math.max(0, totalCopies - activeLoanedCount))
            : availableCopies,
          coverUrl: existingMatch?.coverUrl || '',
          description: existingMatch?.description || notes || '',
          status,
          notes,
        };
        outBooks.push(book);
        if (samplePreview.length < 25) {
          samplePreview.push({
            tabName: tab.sheetName,
            rowNumber,
            key: book.bookCode || book.isbn,
            label: title,
            action: existingMatch ? 'update' : 'create',
          });
        }
      }
      tabBreakdown.push({ tabName: tab.sheetName, rowCount: tab.rows.length, errorCount: tabErrors });
    }

    return {
      valid: issues.length === 0,
      groupKey,
      issues,
      summary: {
        totalRows,
        validRows: outBooks.length,
        createCount,
        updateCount,
        unchangedCount: 0,
        errorCount: issues.length,
        tabBreakdown,
      },
      normalized: { books: outBooks },
      samplePreview,
    };
  }

  /* ---------------------- 5. FACILITIES (CoSoVatChat) ---------------------- */
  const outFacilities: FacilityAsset[] = [];
  const seenCodes = new Set<string>();
  const validGroups = resolveCatalogOptions({ catalogId: 'facility_category', runtime: context }).map((o) => o.value);
  const validConditions = resolveCatalogOptions({ catalogId: 'facility_condition', runtime: context }).map((o) => o.value);

  for (const tab of dataEntries) {
    let tabErrors = 0;
    const inferredGroupFromTab = tab.sheetName.startsWith('CSVC_')
      ? (() => {
          const rawSuffix = tab.sheetName.slice('CSVC_'.length).trim();
          const normTab = normalizeHeaderMatchToken(tab.sheetName);
          const matchedGroup = validGroups.find(
            (g) => normalizeHeaderMatchToken(`CSVC_${g}`) === normTab || normalizeHeaderMatchToken(g) === normalizeHeaderMatchToken(rawSuffix)
          );
          return matchedGroup || (rawSuffix !== 'Mau' ? rawSuffix : '');
        })()
      : '';

    for (const { rowNumber, data } of tab.rows) {
      totalRows += 1;
      const rowIssues: ValidationIssue[] = [];

      const code = normalizeText(resolveCellByColumnSpec(data, FACILITY_COLUMNS[0])).toUpperCase();
      const name = normalizeText(resolveCellByColumnSpec(data, FACILITY_COLUMNS[1]));
      const groupRaw = normalizeText(resolveCellByColumnSpec(data, FACILITY_COLUMNS[2])) || inferredGroupFromTab;
      const assetType = normalizeText(resolveCellByColumnSpec(data, FACILITY_COLUMNS[3])) || 'Thiết bị giảng dạy';
      const qtyRaw = normalizeText(resolveCellByColumnSpec(data, FACILITY_COLUMNS[4]));
      const unit = normalizeText(resolveCellByColumnSpec(data, FACILITY_COLUMNS[5])) || 'Cái';
      const roomLocation = normalizeText(resolveCellByColumnSpec(data, FACILITY_COLUMNS[6]));
      const receivedRaw = resolveCellByColumnSpec(data, FACILITY_COLUMNS[7]);
      const conditionRaw = normalizeText(resolveCellByColumnSpec(data, FACILITY_COLUMNS[8]));
      const manager = normalizeText(resolveCellByColumnSpec(data, FACILITY_COLUMNS[9]));
      const notes = normalizeText(resolveCellByColumnSpec(data, FACILITY_COLUMNS[10]));
      const classHint = FACILITY_COLUMNS[11] ? normalizeText(resolveCellByColumnSpec(data, FACILITY_COLUMNS[11])) : '';
      const wattsRaw = FACILITY_COLUMNS[12] ? normalizeText(resolveCellByColumnSpec(data, FACILITY_COLUMNS[12])) : '';
      const hoursRaw = FACILITY_COLUMNS[13] ? normalizeText(resolveCellByColumnSpec(data, FACILITY_COLUMNS[13])) : '';
      const yearHint = FACILITY_COLUMNS[14] ? normalizeText(resolveCellByColumnSpec(data, FACILITY_COLUMNS[14])) : '';

      if (!code) rowIssues.push(makeIssue(tab.sheetName, rowNumber, FACILITY_COLUMNS[0], code, 'Thiếu MaTaiSan.'));
      if (!name) rowIssues.push(makeIssue(tab.sheetName, rowNumber, FACILITY_COLUMNS[1], name, 'Thiếu TenTaiSan.'));
      if (!roomLocation) rowIssues.push(makeIssue(tab.sheetName, rowNumber, FACILITY_COLUMNS[6], roomLocation, 'Thiếu ViTri.'));

      if (code) {
        if (seenCodes.has(code)) {
          rowIssues.push(makeIssue(tab.sheetName, rowNumber, FACILITY_COLUMNS[0], code, `Trùng MaTaiSan "${code}".`));
        } else {
          seenCodes.add(code);
        }
      }

      const groupMatched =
        validGroups.find((g) => g.toLowerCase() === groupRaw.toLowerCase()) ||
        (groupRaw as FacilityAsset['category']);
      if (!groupMatched) {
        rowIssues.push(makeIssue(tab.sheetName, rowNumber, FACILITY_COLUMNS[2], groupRaw, 'Thiếu NhomTaiSan.'));
      }

      const quantity = qtyRaw ? Number(qtyRaw) : 1;
      if (!Number.isFinite(quantity) || quantity < 1) {
        rowIssues.push(makeIssue(tab.sheetName, rowNumber, FACILITY_COLUMNS[4], qtyRaw, 'SoLuong phải >= 1.'));
      }

      const receivedRes = normalizeDateValue(receivedRaw);
      if (!receivedRes.valid) {
        rowIssues.push(makeIssue(tab.sheetName, rowNumber, FACILITY_COLUMNS[7], receivedRaw, receivedRes.error || 'Sai định dạng NgayTiepNhan.'));
      }

      const condMatched = !conditionRaw
        ? 'Tốt'
        : validConditions.find((c) => c.toLowerCase() === conditionRaw.toLowerCase());
      if (conditionRaw && !condMatched) {
        rowIssues.push(
          makeIssue(tab.sheetName, rowNumber, FACILITY_COLUMNS[8], conditionRaw, `Tình trạng "${conditionRaw}" không hợp lệ (${validConditions.join(', ')}).`)
        );
      }

      if (rowIssues.length > 0) {
        issues.push(...rowIssues);
        tabErrors += rowIssues.length;
        samplePreview.push({
          tabName: tab.sheetName,
          rowNumber,
          key: code || `#${rowNumber}`,
          label: name || '(Chưa có tên tài sản)',
          action: 'error',
          errorMessage: rowIssues[0].message,
        });
        continue;
      }

      const existingMatch = existing.facilities.find((f) => f.code.toUpperCase() === code);
      if (existingMatch) updateCount += 1;
      else createCount += 1;

      const matchedClass = classHint
        ? context.classes.find(
            (c) =>
              c.name.toLowerCase() === classHint.toLowerCase() ||
              c.code.toLowerCase() === classHint.toLowerCase()
          )
        : context.classes.find(
            (c) => c.room && c.room.toLowerCase() === roomLocation.toLowerCase()
          );
      const deviceKind = inferDeviceKind(name, groupMatched, assetType);
      const wattsParsed = wattsRaw ? Number(wattsRaw) : undefined;
      const hoursParsed = hoursRaw ? Number(hoursRaw) : undefined;

      const asset: FacilityAsset = {
        ...(existingMatch || {}),
        id: existingMatch?.id || safeDocId('FAC', code),
        code,
        name,
        category: (validGroups.includes(groupMatched)
          ? groupMatched
          : 'Thiết bị trình chiếu') as FacilityAsset['category'],
        deviceKind,
        assetGroup: groupMatched,
        assetType,
        quantity: Math.round(quantity),
        unit,
        powerWatts:
          wattsParsed !== undefined && Number.isFinite(wattsParsed) && wattsParsed >= 0
            ? wattsParsed
            : existingMatch?.powerWatts ?? inferDefaultPowerWatts(deviceKind),
        dailyUsageHours:
          hoursParsed !== undefined && Number.isFinite(hoursParsed) && hoursParsed >= 0 && hoursParsed <= 24
            ? hoursParsed
            : existingMatch?.dailyUsageHours ?? inferDefaultDailyHours(deviceKind),
        classId: matchedClass?.id || existingMatch?.classId,
        className: matchedClass?.name || classHint || existingMatch?.className,
        grade: matchedClass?.grade || existingMatch?.grade,
        academicYear:
          yearHint || matchedClass?.academicYear || existingMatch?.academicYear || context.systemSettings?.academicYear,
        roomLocation,
        receivedDate: receivedRes.value || existingMatch?.receivedDate,
        condition: (condMatched || 'Tốt') as FacilityAsset['condition'],
        status:
          existingMatch?.status ||
          (condMatched === 'Hỏng hóc' ? 'Đang sửa chữa' : 'Đang sử dụng'),
        manager,
        lastInspected: receivedRes.value || existingMatch?.lastInspected || new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString(),
        notes,
      };
      outFacilities.push(asset);
      if (samplePreview.length < 25) {
        samplePreview.push({
          tabName: tab.sheetName,
          rowNumber,
          key: code,
          label: `${name} (${roomLocation})`,
          action: existingMatch ? 'update' : 'create',
        });
      }
    }
    tabBreakdown.push({ tabName: tab.sheetName, rowCount: tab.rows.length, errorCount: tabErrors });
  }

  return {
    valid: issues.length === 0,
    groupKey,
    issues,
    summary: {
      totalRows,
      validRows: outFacilities.length,
      createCount,
      updateCount,
      unchangedCount: 0,
      errorCount: issues.length,
      tabBreakdown,
    },
    normalized: { facilities: outFacilities },
    samplePreview,
  };
}
