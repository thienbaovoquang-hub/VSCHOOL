import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import type {
  Book,
  DataSourceConfig,
  SchoolClass,
  SchoolRoom,
  Student,
  SystemSettings,
} from '../../types';
import {
  acquireGroupSyncLock,
  applySourceConfiguration,
  isGroupSyncLocked,
  prepareSourceSwitch,
  releaseGroupSyncLock,
} from './groupSpecs';
import {
  buildGroupTemplatePlan,
  buildLiveGroupDanhMuc,
  generateGroupWorkbookBuffer,
  parseExcelWorkbookToGroupTabs,
  validateAndNormalizeGroupData,
  type DataSourceExistingData,
  type DataSourceRuntimeContext,
} from './templateEngine';

const SAMPLE_CLASSES: SchoolClass[] = [
  {
    id: 'CLS-10A1',
    name: '10A1',
    code: '10A1',
    grade: 10,
    academicYear: '2026 - 2027',
    room: 'P101',
    homeroomTeacherId: 'TCH-1',
    homeroomTeacherName: 'Trần Thị Lan',
    studentCount: 38,
    status: 'active',
  },
  {
    id: 'CLS-10A2',
    name: '10A2',
    code: '10A2',
    grade: 10,
    academicYear: '2026 - 2027',
    room: 'P102',
    homeroomTeacherId: 'TCH-2',
    homeroomTeacherName: 'Nguyễn Văn Hùng',
    studentCount: 36,
    status: 'active',
  },
  {
    id: 'CLS-OLD',
    name: '12A9',
    code: '12A9',
    grade: 12,
    academicYear: '2025 - 2026',
    room: 'P309',
    homeroomTeacherId: 'TCH-9',
    homeroomTeacherName: 'Lê Minh Tuấn',
    studentCount: 0,
    status: 'inactive',
  },
];

const SAMPLE_ROOMS: SchoolRoom[] = [
  {
    id: 'RM-101',
    code: 'P101',
    name: 'Phòng 101',
    building: 'Dãy A',
    floor: '1',
    capacity: 45,
    roomType: 'Phòng học',
    status: 'Đang sử dụng',
  },
  {
    id: 'RM-LAB',
    code: 'P203',
    name: 'Phòng Lab Tin',
    building: 'Dãy B',
    floor: '2',
    capacity: 40,
    roomType: 'Phòng máy',
    status: 'Đang sử dụng',
  },
];

const SAMPLE_SETTINGS: SystemSettings = {
  schoolName: 'THPT SchoolHub',
  academicYear: '2026 - 2027',
  defaultLoanDays: 14,
  maxBorrowLimit: 5,
  compactMode: false,
  glassIntensity: 'standard',
  subjectsCatalog: ['Toán học', 'Ngữ văn', 'Tiếng Anh', 'Tin học'],
};

const RUNTIME_CONTEXT: DataSourceRuntimeContext = {
  classes: SAMPLE_CLASSES,
  academicYears: [
    {
      id: 'AY-2025',
      name: '2025 - 2026',
      startDate: '2025-09-05',
      endDate: '2026-05-31',
      currentSemester: 'HK2',
      status: 'Đã kết thúc',
    },
    {
      id: 'AY-2026',
      name: '2026 - 2027',
      startDate: '2026-09-05',
      endDate: '2027-05-31',
      currentSemester: 'HK1',
      status: 'Đang diễn ra',
    },
  ],
  rooms: SAMPLE_ROOMS,
  systemSettings: SAMPLE_SETTINGS,
};

function makeEmptyExisting(): DataSourceExistingData {
  return {
    students: [],
    teachers: [],
    staffMembers: [],
    timetable: [],
    afternoonSchedules: [],
    books: [],
    facilities: [],
  };
}

test('Excel-only data source configuration, upsert per group, and concurrent sync lock', () => {
  const initial: DataSourceConfig[] = [];
  const res1 = applySourceConfiguration(initial, {
    groupKey: 'students',
    activeMethod: 'excel',
    sourceName: 'ds-hoc-sinh.xlsx',
    status: 'connected',
    syncMode: 'manual',
    syncIntervalMinutes: 15,
    updatedAt: '2026-09-01T08:00:00.000Z',
  });
  assert.equal(res1.nextConfigs.length, 1);
  assert.equal(res1.savedConfig.activeMethod, 'excel');

  // Updating Excel source preserves single config per groupKey without extra confirmation
  const sameMethod = prepareSourceSwitch({
    currentConfig: res1.savedConfig,
    targetMethod: 'excel',
    confirmed: false,
  });
  assert.equal(sameMethod.allowed, true);
  assert.equal(sameMethod.requiresConfirmation, false);

  const res2 = applySourceConfiguration(res1.nextConfigs, {
    groupKey: 'students',
    activeMethod: 'excel',
    sourceName: 'SchoolHub - HocSinh_2026.xlsx',
    status: 'connected',
    syncMode: 'manual',
    syncIntervalMinutes: 0,
    updatedAt: '2026-09-01T09:00:00.000Z',
  });
  assert.equal(res2.nextConfigs.length, 1);
  assert.equal(res2.savedConfig.activeMethod, 'excel');
  assert.equal(res2.savedConfig.sourceName, 'SchoolHub - HocSinh_2026.xlsx');

  // Sync lock prevents concurrent sync on same group
  assert.equal(isGroupSyncLocked('students'), false);
  assert.equal(acquireGroupSyncLock('students'), true);
  assert.equal(isGroupSyncLocked('students'), true);
  assert.equal(acquireGroupSyncLock('students'), false);
  releaseGroupSyncLock('students');
  assert.equal(isGroupSyncLocked('students'), false);
  assert.equal(acquireGroupSyncLock('students'), true);
  releaseGroupSyncLock('students');
});

test('Live DanhMuc reflects active DB classes/subjects and fabricates zero hardcoded classes when DB is empty', () => {
  const danhMuc = buildLiveGroupDanhMuc('students', RUNTIME_CONTEXT);
  const lopCol = danhMuc.find((c) => c.key === 'Lop');
  const monCol = danhMuc.find((c) => c.key === 'MonHoc');
  const phongCol = danhMuc.find((c) => c.key === 'PhongHoc');

  assert.ok(lopCol);
  assert.deepEqual(lopCol.values, ['10A1', '10A2']);
  assert.ok(!lopCol.values.includes('12A9'), 'Archived inactive class must be excluded from Lop DanhMuc');
  assert.ok(monCol);
  assert.deepEqual(monCol.values, ['Toán học', 'Ngữ văn', 'Tiếng Anh', 'Tin học']);
  assert.ok(phongCol);
  assert.deepEqual(phongCol.values, ['P101', 'P203']);

  const emptyPlan = buildGroupTemplatePlan('students', {
    classes: [],
    academicYears: [],
    rooms: [],
  });
  const emptyLopCol = emptyPlan.danhMuc.find((c) => c.key === 'Lop');
  assert.deepEqual(emptyLopCol?.values, []);
  assert.equal(emptyPlan.dataTabs.length, 1);
  assert.equal(emptyPlan.dataTabs[0].tabName, 'HocSinh_Mau');
});

test('Students XLSX roundtrip: multi-class tabs, tab class inference, status Tạm dừng học, class transfer & multi-year isolation, inactive class rejection', async () => {
  const wb = new ExcelJS.Workbook();
  const ws1 = wb.addWorksheet('HocSinh_10A1');
  ws1.addRow(['MaHocSinh', 'HoTen', 'NgaySinh', 'GioiTinh', 'Khoi', 'Lop', 'NamHoc', 'TrangThai']);
  ws1.addRow(['HS001', 'Nguyễn Minh An', '2010-05-14', 'Nam', '10', '', '2026 - 2027', 'Đang học']);
  ws1.addRow(['HS002', 'Lê Thu Hà', '2010-08-20', 'Nữ', '10', '10A1', '2026 - 2027', 'Tạm dừng học']);

  const ws2 = wb.addWorksheet('HocSinh_10A2');
  ws2.addRow(['MaHocSinh', 'HoTen', 'NgaySinh', 'GioiTinh', 'Khoi', 'Lop', 'NamHoc', 'TrangThai']);
  // Same student code HS001 in prior year 2025 - 2026 must remain distinct by year isolation
  ws2.addRow(['HS001', 'Nguyễn Minh An', '2010-05-14', 'Nam', '10', '', '2025 - 2026', 'Đang học']);

  const buf = new Uint8Array(await wb.xlsx.writeBuffer());
  const parsed = parseExcelWorkbookToGroupTabs(buf, 'hoc-sinh.xlsx');
  assert.ok(parsed.tabs['HocSinh_10A1']);
  assert.ok(parsed.tabs['HocSinh_10A2']);

  const existing: DataSourceExistingData = {
    ...makeEmptyExisting(),
    students: [
      {
        id: 'STU-OLD-HS002',
        studentCode: 'HS002',
        fullName: 'Lê Thu Hà',
        dateOfBirth: '2010-08-20',
        gender: 'Nữ',
        grade: 10,
        classId: 'CLS-10A2',
        className: '10A2',
        academicYear: '2026 - 2027',
        parentPhone: '0912345678',
        address: 'Hà Nội',
        status: 'Đang học',
        rfidCardId: 'RFID-HS002',
      } satisfies Student,
    ],
  };

  const res = validateAndNormalizeGroupData('students', parsed.tabs, RUNTIME_CONTEXT, existing);
  assert.equal(res.valid, true, `Unexpected validation issues: ${JSON.stringify(res.issues)}`);
  assert.equal(res.summary.createCount, 2);
  assert.equal(res.summary.updateCount, 1);

  const out = res.normalized.students!;
  assert.equal(out.length, 3);

  const an2026 = out.find((s) => s.studentCode === 'HS001' && s.academicYear === '2026 - 2027');
  const an2025 = out.find((s) => s.studentCode === 'HS001' && s.academicYear === '2025 - 2026');
  const haTransferred = out.find((s) => s.studentCode === 'HS002');

  assert.equal(an2026?.className, '10A1', 'Should infer class 10A1 from tab name');
  assert.equal(an2025?.className, '10A2', 'Should infer class 10A2 from tab name');
  assert.notEqual(an2026?.id, an2025?.id, 'Same studentCode across academic years must have distinct IDs');
  assert.equal(haTransferred?.id, 'STU-OLD-HS002', 'Class transfer in same year must update existing record');
  assert.equal(haTransferred?.className, '10A1');
  assert.equal(haTransferred?.status, 'Tạm dừng học');

  // Verify archived inactive class is rejected with exact row/field coordinates
  const badWb = new ExcelJS.Workbook();
  const badWs = badWb.addWorksheet('HocSinh_12A9');
  badWs.addRow(['MaHocSinh', 'HoTen', 'Khoi', 'Lop', 'NamHoc']);
  badWs.addRow(['HS999', 'Trần Bình', '12', '12A9', '2026 - 2027']);
  const badParsed = parseExcelWorkbookToGroupTabs(new Uint8Array(await badWb.xlsx.writeBuffer()), 'bad.xlsx');
  const badRes = validateAndNormalizeGroupData('students', badParsed.tabs, RUNTIME_CONTEXT, makeEmptyExisting());
  assert.equal(badRes.valid, false);
  assert.equal(badRes.issues[0].sheetName, 'HocSinh_12A9');
  assert.equal(badRes.issues[0].rowNumber, 2);
  assert.equal(badRes.issues[0].field, 'className');
});

test('Staff XLSX roundtrip: GiaoVien + NhanVien in single workbook', async () => {
  const bytes = await generateGroupWorkbookBuffer('staff', RUNTIME_CONTEXT, {
    teachers: [
      {
        id: 'TCH-1',
        teacherCode: 'GV001',
        fullName: 'Trần Thị Lan',
        email: 'lan.tt@schoolhub.edu.vn',
        phone: '0987654321',
        subject: 'Toán học',
        isHomeroom: true,
        role: 'homeroom_teacher',
        department: 'Tổ Toán - Tin',
        status: 'Đang công tác',
      },
    ],
    staffMembers: [
      {
        id: 'STF-1',
        staffCode: 'NV001',
        fullName: 'Phạm Văn Nam',
        email: 'nam.pv@schoolhub.edu.vn',
        phone: '0912345678',
        position: 'Nhân viên thư viện',
        department: 'Thư viện',
        status: 'Đang công tác',
      },
    ],
  });

  const parsed = parseExcelWorkbookToGroupTabs(bytes, 'nhan-su.xlsx');
  assert.ok(parsed.tabs['GiaoVien']);
  assert.ok(parsed.tabs['NhanVien']);

  const res = validateAndNormalizeGroupData('staff', parsed.tabs, RUNTIME_CONTEXT, makeEmptyExisting());
  assert.equal(res.valid, true, JSON.stringify(res.issues));
  assert.equal(res.normalized.teachers?.length, 1);
  assert.equal(res.normalized.staffMembers?.length, 1);
  assert.equal(res.normalized.teachers?.[0].teacherCode, 'GV001');
  assert.equal(res.normalized.staffMembers?.[0].staffCode, 'NV001');
});

test('Learning XLSX roundtrip: TKB_ToanTruong + TKB_10A1 + ThoiGianBieu_BuoiChieu + error coordinates', async () => {
  const wb = new ExcelJS.Workbook();
  const wsAll = wb.addWorksheet('TKB_ToanTruong');
  wsAll.addRow(['NamHoc', 'HocKy', 'Khoi', 'Lop', 'Thu', 'Tiet', 'GioBatDau', 'GioKetThuc', 'MonHoc', 'GiaoVien', 'PhongHoc']);
  wsAll.addRow(['2026 - 2027', 'HK1', '10', '10A2', '2', '1', '07:15', '08:00', 'Ngữ văn', 'Cô Mai', 'P101']);

  const wsClass = wb.addWorksheet('TKB_10A1');
  wsClass.addRow(['NamHoc', 'HocKy', 'Thu', 'Tiet', 'MonHoc', 'GiaoVien', 'PhongHoc']);
  wsClass.addRow(['2026 - 2027', 'HK1', 'Thứ 3', '2', 'Toán học', 'Thầy Hùng', 'P101']);

  const wsAft = wb.addWorksheet('ThoiGianBieu_BuoiChieu');
  wsAft.addRow(['NamHoc', 'Thu', 'Lop', 'GioBatDau', 'GioKetThuc', 'HoatDong', 'DiaDiem', 'NguoiPhuTrach']);
  wsAft.addRow(['2026 - 2027', '4', '10A1', '14:00', '15:30', 'CLB Tin học', 'P203', 'Thầy Tuấn']);

  const parsed = parseExcelWorkbookToGroupTabs(new Uint8Array(await wb.xlsx.writeBuffer()), 'lich-hoc.xlsx');
  const res = validateAndNormalizeGroupData('learning', parsed.tabs, RUNTIME_CONTEXT, makeEmptyExisting());
  assert.equal(res.valid, true, JSON.stringify(res.issues));
  assert.equal(res.normalized.timetable?.length, 2);
  assert.equal(res.normalized.afternoonSchedules?.length, 1);
  assert.equal(res.normalized.timetable?.find((t) => t.className === '10A1')?.dayOfWeek, 3);
  assert.equal(res.normalized.afternoonSchedules?.[0].activity, 'CLB Tin học');

  // Verify invalid subject rejected with exact coordinates
  const badWb = new ExcelJS.Workbook();
  const badWs = badWb.addWorksheet('TKB_10A1');
  badWs.addRow(['Thu', 'Tiet', 'MonHoc']);
  badWs.addRow(['2', '1', 'Toán học']);
  badWs.addRow(['2', '2', 'Môn không tồn tại']);
  const badParsed = parseExcelWorkbookToGroupTabs(new Uint8Array(await badWb.xlsx.writeBuffer()), 'bad-tkb.xlsx');
  const badRes = validateAndNormalizeGroupData('learning', badParsed.tabs, RUNTIME_CONTEXT, makeEmptyExisting());
  assert.equal(badRes.valid, false);
  assert.equal(badRes.issues[0].sheetName, 'TKB_10A1');
  assert.equal(badRes.issues[0].rowNumber, 3);
  assert.equal(badRes.issues[0].field, 'subject');
});

test('Books XLSX roundtrip: preserves active loan delta and rejects totalCopies below active loans', async () => {
  const existingBook: Book = {
    id: 'BK-001',
    bookCode: 'SH-BOOK-001',
    isbn: '978-604-0-001',
    title: 'Giải tích 10',
    author: 'Phan Huy Khải',
    publisher: 'NXB Giáo dục',
    publishYear: 2024,
    category: 'Sách giáo khoa & Tham khảo',
    shelfLocation: 'A1',
    coverUrl: '',
    description: '',
    totalCopies: 10,
    availableCopies: 7, // 3 active loans
  };

  const okWb = new ExcelJS.Workbook();
  const okWs = okWb.addWorksheet('Sach');
  okWs.addRow(['MaSach', 'ISBN', 'TenSach', 'TacGia', 'TheLoai', 'SoLuongTong']);
  okWs.addRow(['SH-BOOK-001', '978-604-0-001', 'Giải tích 10 (Tái bản)', 'Phan Huy Khải', 'Sách giáo khoa & Tham khảo', '12']);

  const parsedOk = parseExcelWorkbookToGroupTabs(new Uint8Array(await okWb.xlsx.writeBuffer()), 'sach.xlsx');
  const resOk = validateAndNormalizeGroupData('books', parsedOk.tabs, RUNTIME_CONTEXT, {
    ...makeEmptyExisting(),
    books: [existingBook],
  });
  assert.equal(resOk.valid, true, JSON.stringify(resOk.issues));
  assert.equal(resOk.normalized.books?.[0].totalCopies, 12);
  assert.equal(resOk.normalized.books?.[0].availableCopies, 9, 'Must preserve 3 active loans when computing availableCopies');

  // Lowering totalCopies below 3 active loans must fail validation with exact coordinates
  const badWb = new ExcelJS.Workbook();
  const badWs = badWb.addWorksheet('Sach');
  badWs.addRow(['MaSach', 'ISBN', 'TenSach', 'TacGia', 'TheLoai', 'SoLuongTong']);
  badWs.addRow(['SH-BOOK-001', '978-604-0-001', 'Giải tích 10', 'Phan Huy Khải', 'Sách giáo khoa & Tham khảo', '2']);
  const parsedBad = parseExcelWorkbookToGroupTabs(new Uint8Array(await badWb.xlsx.writeBuffer()), 'bad-sach.xlsx');
  const resBad = validateAndNormalizeGroupData('books', parsedBad.tabs, RUNTIME_CONTEXT, {
    ...makeEmptyExisting(),
    books: [existingBook],
  });
  assert.equal(resBad.valid, false);
  assert.equal(resBad.issues[0].sheetName, 'Sach');
  assert.equal(resBad.issues[0].rowNumber, 2);
  assert.equal(resBad.issues[0].field, 'totalCopies');
});

test('Facilities XLSX roundtrip: generates and parses assetGroup, assetType, quantity, unit, receivedDate, manager', async () => {
  const bytes = await generateGroupWorkbookBuffer('facilities', RUNTIME_CONTEXT, {
    facilities: [
      {
        id: 'FAC-1',
        code: 'TS-PC-001',
        name: 'Máy chiếu Epson',
        category: 'Thiết bị trình chiếu',
        assetGroup: 'Thiết bị trình chiếu',
        assetType: 'Thiết bị giảng dạy',
        quantity: 2,
        unit: 'Bộ',
        roomLocation: 'P101',
        receivedDate: '2026-08-15',
        condition: 'Tốt',
        status: 'Đang sử dụng',
        manager: 'Lê Minh Tuấn',
        lastInspected: '2026-08-15',
      },
    ],
  });

  const parsed = parseExcelWorkbookToGroupTabs(bytes, 'csvc.xlsx');
  const res = validateAndNormalizeGroupData('facilities', parsed.tabs, RUNTIME_CONTEXT, makeEmptyExisting());
  assert.equal(res.valid, true, JSON.stringify(res.issues));
  assert.equal(res.normalized.facilities?.length, 1);
  const asset = res.normalized.facilities![0];
  assert.equal(asset.code, 'TS-PC-001');
  assert.equal(asset.assetGroup, 'Thiết bị trình chiếu');
  assert.equal(asset.assetType, 'Thiết bị giảng dạy');
  assert.equal(asset.quantity, 2);
  assert.equal(asset.unit, 'Bộ');
  assert.equal(asset.receivedDate, '2026-08-15');
  assert.equal(asset.manager, 'Lê Minh Tuấn');
});

test('Multi-sheet tabs & ExcelJS Drop-down lists across all 5 DataSource groups + tab inference for books & facilities', async () => {
  const groups: Array<'students' | 'staff' | 'learning' | 'books' | 'facilities'> = [
    'students',
    'staff',
    'learning',
    'books',
    'facilities',
  ];

  for (const g of groups) {
    const plan = buildGroupTemplatePlan(g, RUNTIME_CONTEXT, makeEmptyExisting());
    assert.ok(plan.dataTabs.length >= 2, `${g} template must split into multiple data sheet tabs`);

    const bytes = await generateGroupWorkbookBuffer(g, RUNTIME_CONTEXT, makeEmptyExisting());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer as ArrayBuffer);

    assert.ok(wb.getWorksheet('HuongDan'), `${g} must include HuongDan sheet`);
    assert.ok(wb.getWorksheet('DanhMuc'), `${g} must include DanhMuc sheet`);

    for (const tab of plan.dataTabs) {
      const ws = wb.getWorksheet(tab.tabName);
      assert.ok(ws, `${g} missing planned tab ${tab.tabName}`);
      assert.ok(tab.validationColumns.length >= 1, `${g}:${tab.tabName} must declare dropdown columns`);
      for (const vc of tab.validationColumns) {
        const colIdx = tab.columns.findIndex((c) => c.header === vc.header) + 1;
        assert.ok(colIdx >= 1, `${g}:${tab.tabName} missing column ${vc.header}`);
        const dv: ExcelJS.DataValidation | undefined = ws.getRow(2).getCell(colIdx).dataValidation;
        assert.equal(dv?.type, 'list', `${g}:${tab.tabName}:${vc.header} missing list dropdown`);
        assert.ok(
          dv?.formulae?.[0]?.includes('DanhMuc!'),
          `${g}:${tab.tabName}:${vc.header} dropdown must reference DanhMuc`
        );
      }
    }
  }

  // Books multi-tab inference when TheLoai is omitted in Sach_<TheLoai> sheet
  const bookBytes = await generateGroupWorkbookBuffer('books', RUNTIME_CONTEXT, {
    ...makeEmptyExisting(),
    books: [
      {
        id: 'BK-A',
        bookCode: 'SH-A',
        isbn: '978-1',
        title: 'Vật lý 10',
        author: 'A',
        publisher: 'GD',
        publishYear: 2025,
        category: 'Khoa học tự nhiên',
        shelfLocation: 'A1',
        coverUrl: '',
        description: '',
        totalCopies: 5,
        availableCopies: 5,
      },
      {
        id: 'BK-B',
        bookCode: 'SH-B',
        isbn: '978-2',
        title: 'Dế mèn phiêu lưu ký',
        author: 'Tô Hoài',
        publisher: 'Kim Đồng',
        publishYear: 2024,
        category: 'Văn học',
        shelfLocation: 'B1',
        coverUrl: '',
        description: '',
        totalCopies: 4,
        availableCopies: 4,
      },
    ],
  });
  const parsedBooks = parseExcelWorkbookToGroupTabs(bookBytes, 'sach-nhieu-tab.xlsx');
  assert.ok(Object.keys(parsedBooks.tabs).some((t) => t.startsWith('Sach_Khoa học')));
  assert.ok(Object.keys(parsedBooks.tabs).some((t) => t.startsWith('Sach_Văn học')));

  const inferredBookWb = new ExcelJS.Workbook();
  const wsKhtn = inferredBookWb.addWorksheet('Sach_Khoa học tự nhiên');
  wsKhtn.addRow(['MaSach', 'TenSach', 'TacGia', 'TheLoai', 'SoLuongTong']);
  wsKhtn.addRow(['SH-INF-1', 'Hóa học 10', 'Bộ GD&ĐT', '', '8']);
  const parsedInferredBooks = parseExcelWorkbookToGroupTabs(
    new Uint8Array(await inferredBookWb.xlsx.writeBuffer()),
    'books-inferred.xlsx'
  );
  const resInferredBooks = validateAndNormalizeGroupData('books', parsedInferredBooks.tabs, RUNTIME_CONTEXT, makeEmptyExisting());
  assert.equal(resInferredBooks.valid, true, JSON.stringify(resInferredBooks.issues));
  assert.equal(resInferredBooks.normalized.books?.[0].category, 'Khoa học tự nhiên');

  // Facilities multi-tab inference when NhomTaiSan is omitted in CSVC_<Nhom> sheet
  const facWb = new ExcelJS.Workbook();
  const wsFac = facWb.addWorksheet('CSVC_Thiết bị trình chiếu');
  wsFac.addRow(['MaTaiSan', 'TenTaiSan', 'NhomTaiSan', 'SoLuong', 'DonViTinh', 'ViTri', 'TinhTrang', 'TrangThai']);
  wsFac.addRow(['TS-INF-1', 'Máy chiếu Sony', '', '3', 'Chiếc', 'P101', 'Tốt', 'Đang sử dụng']);
  const parsedFac = parseExcelWorkbookToGroupTabs(
    new Uint8Array(await facWb.xlsx.writeBuffer()),
    'fac-inferred.xlsx'
  );
  const resFac = validateAndNormalizeGroupData('facilities', parsedFac.tabs, RUNTIME_CONTEXT, makeEmptyExisting());
  assert.equal(resFac.valid, true, JSON.stringify(resFac.issues));
  assert.equal(resFac.normalized.facilities?.[0].assetGroup, 'Thiết bị trình chiếu');
});
