import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import type {
  FacilityAsset,
  FacilityMeterReading,
  FacilitySmartConfig,
  SchoolClass,
  SchoolRoom,
} from '../types';
import {
  buildAdjustedQuantityFacilityAsset,
  buildDefaultSmartConfigForClass,
  buildFacilitiesGoogleSheetsTsv,
  buildTransferredFacilityAsset,
  calculateAssetEnergyMetric,
  calculateFacilityEnergySummary,
  cascadeSyncFacilitiesForClass,
  createFacilityActivityLog,
  evaluateSmartEnvironment,
  filterClassesForFacilities,
  filterFacilitiesByScope,
  generateClassFacilitiesWorkbookBuffer,
  inferDefaultPowerWatts,
  inferDeviceKind,
  normalizeFacilityAsset,
  parseAndValidateClassFacilitiesWorkbook,
  parseDelimitedSpreadsheetText,
  parseGoogleSheetsUrlToCsvUrl,
  summarizeSchoolSmartStatus,
} from './facilitiesEngine';

const sampleClasses: SchoolClass[] = [
  {
    id: 'CLS-10A1',
    name: '10A1',
    code: '10A1',
    grade: 10,
    academicYear: '2026 - 2027',
    room: 'P.101',
    homeroomTeacherId: 'TCH-1',
    homeroomTeacherName: 'GV 10A1',
    studentCount: 42,
    status: 'active',
  },
  {
    id: 'CLS-10A2',
    name: '10A2',
    code: '10A2',
    grade: 10,
    academicYear: '2026 - 2027',
    room: 'P.102',
    homeroomTeacherId: 'TCH-2',
    homeroomTeacherName: 'GV 10A2',
    studentCount: 41,
    status: 'active',
  },
  {
    id: 'CLS-11B1',
    name: '11B1',
    code: '11B1',
    grade: 11,
    academicYear: '2026 - 2027',
    room: 'P.201',
    homeroomTeacherId: 'TCH-3',
    homeroomTeacherName: 'GV 11B1',
    studentCount: 40,
    status: 'active',
  },
  {
    id: 'CLS-OLD',
    name: '12C9',
    code: '12C9',
    grade: 12,
    academicYear: '2025 - 2026',
    room: 'P.309',
    homeroomTeacherId: 'TCH-OLD',
    homeroomTeacherName: 'GV 12C9',
    studentCount: 38,
    status: 'inactive',
  },
];

const sampleRooms: SchoolRoom[] = [
  {
    id: 'RM-101',
    code: 'P.101',
    name: 'P.101',
    building: 'Nhà A',
    floor: 'Tầng 1',
    roomType: 'Phòng học',
    capacity: 42,
    assignedClassName: '10A1',
    status: 'Đang sử dụng',
  },
  {
    id: 'RM-102',
    code: 'P.102',
    name: 'P.102',
    building: 'Nhà A',
    floor: 'Tầng 1',
    roomType: 'Phòng học',
    capacity: 42,
    assignedClassName: '10A2',
    status: 'Đang sử dụng',
  },
];

const sampleAssets: FacilityAsset[] = [
  {
    id: 'AST-1',
    code: 'TB-10A1-DEN',
    name: 'Đèn LED chiếu sáng',
    category: 'Thiết bị trình chiếu',
    deviceKind: 'Đèn',
    quantity: 8,
    unit: 'Bóng',
    powerWatts: 36,
    dailyUsageHours: 6,
    operatingDaysPerMonth: 22,
    classId: 'CLS-10A1',
    className: '10A1',
    grade: 10,
    academicYear: '2026 - 2027',
    roomLocation: 'P.101',
    condition: 'Tốt',
    status: 'Đang sử dụng',
    lastInspected: '2026-09-01',
  },
  {
    id: 'AST-2',
    code: 'TB-10A1-AC',
    name: 'Điều hòa Daikin 18000BTU',
    category: 'Điều hòa - Quạt',
    deviceKind: 'Điều hòa',
    quantity: 2,
    unit: 'Cái',
    powerWatts: 1500,
    dailyUsageHours: 4,
    operatingDaysPerMonth: 22,
    classId: 'CLS-10A1',
    className: '10A1',
    grade: 10,
    academicYear: '2026 - 2027',
    roomLocation: 'P.101',
    condition: 'Tốt',
    status: 'Đang sử dụng',
    lastInspected: '2026-09-01',
  },
  {
    id: 'AST-3',
    code: 'TB-10A2-QUAT',
    name: 'Quạt trần Panasonic',
    category: 'Điều hòa - Quạt',
    deviceKind: 'Quạt',
    quantity: 4,
    unit: 'Cái',
    powerWatts: 70,
    dailyUsageHours: 5,
    operatingDaysPerMonth: 22,
    classId: 'CLS-10A2',
    className: '10A2',
    grade: 10,
    academicYear: '2026 - 2027',
    roomLocation: 'P.102',
    condition: 'Cần bảo trì',
    status: 'Đang sử dụng',
    lastInspected: '2026-09-01',
  },
];

test('device kind and wattage defaults infer accurately', () => {
  assert.equal(inferDeviceKind('Smart TV Samsung 65 inch'), 'TV');
  assert.equal(inferDeviceKind('Quạt treo tường Senko'), 'Quạt');
  assert.equal(inferDeviceKind('Bóng đèn tuýp LED 1m2'), 'Đèn');
  assert.equal(inferDeviceKind('Máy lạnh Toshiba'), 'Điều hòa');
  assert.equal(inferDeviceKind('Máy tính thực hành Core i5'), 'Máy tính');
  assert.equal(inferDeviceKind('Máy chiếu Epson EB'), 'Máy chiếu');
  assert.equal(inferDefaultPowerWatts('Điều hòa'), 1200);
});

test('cascading filters and class transfer work deterministically', () => {
  const grade10 = filterClassesForFacilities({
    classes: sampleClasses,
    academicYear: '2026 - 2027',
    grade: 10,
  });
  assert.deepEqual(
    grade10.map((c) => c.name),
    ['10A1', '10A2']
  );

  const scoped = filterFacilitiesByScope({
    facilities: sampleAssets,
    classes: sampleClasses,
    academicYear: '2026 - 2027',
    grade: 10,
    classId: 'CLS-10A1',
  });
  assert.equal(scoped.length, 2);

  const transferred = buildTransferredFacilityAsset({
    asset: sampleAssets[0],
    targetClass: sampleClasses[1],
    rooms: sampleRooms,
  });
  assert.equal(transferred.classId, 'CLS-10A2');
  assert.equal(transferred.className, '10A2');
  assert.equal(transferred.roomLocation, 'P.102');

  const adjusted = buildAdjustedQuantityFacilityAsset(sampleAssets[0], 12);
  assert.equal(adjusted.quantity, 12);
});

test('cascadeSyncFacilitiesForClass updates renamed classes across linked records', () => {
  const previousClass = sampleClasses[0];
  const renamedClass: SchoolClass = {
    ...previousClass,
    name: '10A1-CLC',
    room: 'P.101A',
  };
  const smartConfigs: FacilitySmartConfig[] = [buildDefaultSmartConfigForClass(previousClass, 'Admin')];
  const meterReadings: FacilityMeterReading[] = [
    {
      id: 'MR-1',
      scopeType: 'class',
      scopeId: 'CLS-10A1',
      scopeName: '10A1',
      classId: 'CLS-10A1',
      className: '10A1',
      grade: 10,
      roomLocation: 'P.101',
      academicYear: '2026 - 2027',
      periodType: 'month',
      periodKey: '2026-10',
      measuredKwh: 320,
      costPerKwh: 2100,
      sourceMode: 'meter_reading',
      recordedBy: 'Kế toán',
      recordedAt: '2026-10-31T08:00:00Z',
    },
  ];

  const diff = cascadeSyncFacilitiesForClass({
    updatedClass: renamedClass,
    previousClass,
    facilities: sampleAssets,
    smartConfigs,
    meterReadings,
  });

  assert.equal(diff.updatedFacilities.length, 2);
  assert.equal(diff.updatedFacilities[0].className, '10A1-CLC');
  assert.equal(diff.updatedFacilities[0].roomLocation, 'P.101A');
  assert.equal(diff.updatedSmartConfigs[0].className, '10A1-CLC');
  assert.equal(diff.updatedMeterReadings[0].className, '10A1-CLC');
});

test('energy calculations compute estimated kWh and prioritize manual meter readings', () => {
  const metric = calculateAssetEnergyMetric(sampleAssets[0], 2000, sampleClasses);
  // 8 * 36W = 288W; 288 * 6 / 1000 = 1.728 -> 1.73 kWh/day; 1.73 * 22 = 38.06 kWh/month
  assert.equal(metric.totalWatts, 288);
  assert.equal(metric.dailyKwh, 1.73);
  assert.equal(metric.monthlyKwh, 38.06);
  assert.equal(metric.isEstimated, true);

  const inactiveNormalized = normalizeFacilityAsset(
    { ...sampleAssets[0], status: 'Ngừng sử dụng' },
    sampleClasses,
    sampleRooms
  );
  assert.equal(calculateAssetEnergyMetric(inactiveNormalized, 2000, sampleClasses).totalWatts, 0);

  const meterReadings: FacilityMeterReading[] = [
    {
      id: 'MR-10A1',
      scopeType: 'class',
      scopeId: 'CLS-10A1',
      scopeName: '10A1',
      classId: 'CLS-10A1',
      className: '10A1',
      academicYear: '2026 - 2027',
      periodType: 'month',
      periodKey: '2026-10',
      measuredKwh: 295,
      costPerKwh: 2200,
      sourceMode: 'meter_reading',
      recordedBy: 'Admin',
      recordedAt: '2026-10-31T08:00:00Z',
    },
  ];
  const summary = calculateFacilityEnergySummary({
    facilities: sampleAssets,
    classes: sampleClasses,
    meterReadings,
    costPerKwh: 2100,
  });
  const class10A1 = summary.byClass.find((b) => b.label === '10A1');
  const class10A2 = summary.byClass.find((b) => b.label === '10A2');
  assert.equal(class10A1?.hasMeterReading, true);
  assert.equal(class10A1?.effectiveMonthlyKwh, 295);
  assert.equal(class10A2?.hasMeterReading, false);
  assert.match(class10A2?.sourceLabel || '', /ước tính/i);
  assert.match(summary.schoolSourceLabel, /ước tính/i);
  assert.equal(
    summary.effectiveMonthlyKwh,
    Number((295 + (class10A2?.estimatedMonthlyKwh || 0)).toFixed(2))
  );
});

test('smart control evaluation generates recommendations with simulation notice and safety limits', () => {
  const cfg: FacilitySmartConfig = {
    ...buildDefaultSmartConfigForClass(sampleClasses[0], 'Admin'),
    temperatureC: 37,
    luxLevel: 210,
    tempThresholdFan: 27,
    tempThresholdAC: 30,
    luxThresholdLight: 300,
    safetyMaxTempC: 36,
    scheduleStart: '07:00',
    scheduleEnd: '17:00',
  };

  const inClassEval = evaluateSmartEnvironment(cfg, '09:30');
  assert.equal(inClassEval.isSimulationMode, true);
  assert.match(inClassEval.modeNotice, /mô phỏng/i);
  assert.equal(inClassEval.safetyAlerts.length, 1);
  assert.equal(inClassEval.suggestions.find((s) => s.deviceGroup === 'lights')?.recommendedState, 'on');
  assert.equal(inClassEval.suggestions.find((s) => s.deviceGroup === 'fans')?.recommendedState, 'on');
  assert.equal(inClassEval.suggestions.find((s) => s.deviceGroup === 'ac')?.recommendedState, 'on');

  const afterHoursEval = evaluateSmartEnvironment(
    {
      ...cfg,
      deviceStates: { lights: 'on', fans: 'on', ac: 'offline' },
    },
    '19:00'
  );
  assert.equal(afterHoursEval.withinSchedule, false);
  assert.equal(afterHoursEval.suggestions.find((s) => s.deviceGroup === 'lights')?.actionNeeded, true);
  assert.equal(afterHoursEval.suggestions.find((s) => s.deviceGroup === 'ac')?.actionNeeded, false);

  const totals = summarizeSchoolSmartStatus([
    { ...cfg, deviceStates: { lights: 'on', fans: 'off', ac: 'offline' } },
    { ...cfg, id: 'SMART-2', classId: 'CLS-10A2', deviceStates: { lights: 'check', fans: 'on', ac: 'off' } },
  ]);
  assert.deepEqual(totals, {
    onCount: 2,
    offCount: 2,
    offlineCount: 1,
    checkCount: 1,
    totalChannels: 6,
  });
});

test('per-class workbook generation and safe partial import preserve other classes', async () => {
  const bytes = await generateClassFacilitiesWorkbookBuffer({
    classes: sampleClasses,
    facilities: sampleAssets,
    rooms: sampleRooms,
    academicYear: '2026 - 2027',
    scope: 'all',
  });

  const wb = XLSX.read(bytes, { type: 'array' });
  assert.ok(wb.SheetNames.includes('HUONG_DAN'));
  assert.ok(wb.SheetNames.includes('DANH_MUC'));
  assert.ok(wb.SheetNames.includes('10A1'));
  assert.ok(wb.SheetNames.includes('10A2'));
  assert.ok(!wb.SheetNames.includes('12C9'), 'Inactive class must not appear in generated workbook');

  // Verify Google Sheets URL & TSV parsing helpers
  assert.equal(
    parseGoogleSheetsUrlToCsvUrl('https://docs.google.com/spreadsheets/d/abc123XYZ/edit#gid=456'),
    'https://docs.google.com/spreadsheets/d/abc123XYZ/export?format=csv&gid=456'
  );
  const tsv = buildFacilitiesGoogleSheetsTsv(sampleAssets, sampleClasses);
  const parsedTsv = parseDelimitedSpreadsheetText(tsv, 'GoogleSheets');
  assert.equal(parsedTsv.rows.length, 3);

  // Build synthetic multi-sheet import test:
  // - 10A1 updates existing LED quantity from 8 -> 10 + adds 1 TV, plus 1 duplicate row & 1 bad qty
  // - 12C9 is inactive -> rejected
  // - 99Z9 is unknown -> rejected
  // - Cross-class code collision TB-10A2-QUAT inside sheet 10A1 -> rejected
  const importPreview = parseAndValidateClassFacilitiesWorkbook({
    parsedWorkbook: {
      fileName: 'import.xlsx',
      sheetNames: ['HUONG_DAN', '10A1', '12C9', '99Z9'],
      dataSheetName: '10A1',
      dataSheetNames: ['10A1', '12C9', '99Z9'],
      headers: [],
      rows: [],
      extraSheets: {},
      rowItems: [
        {
          sheetName: '10A1',
          rowNumber: 2,
          row: {
            'Mã thiết bị': 'TB-10A1-DEN',
            'Tên thiết bị *': 'Đèn LED chiếu sáng',
            'Loại thiết bị': 'Đèn',
            'Số lượng *': '10',
            'Công suất (W)': '36',
            'Tình trạng *': 'Tốt',
            'Vị trí / Phòng': 'P.101',
          },
        },
        {
          sheetName: '10A1',
          rowNumber: 3,
          row: {
            'Mã thiết bị': 'TB-10A1-TV',
            'Tên thiết bị *': 'Smart TV 65 inch',
            'Loại thiết bị': 'TV',
            'Số lượng *': '1',
            'Tình trạng *': 'Tốt',
          },
        },
        {
          sheetName: '10A1',
          rowNumber: 4,
          row: {
            'Mã thiết bị': 'TB-10A1-TV',
            'Tên thiết bị *': 'Smart TV 65 inch',
            'Số lượng *': '1',
            'Tình trạng *': 'Tốt',
          },
        },
        {
          sheetName: '10A1',
          rowNumber: 5,
          row: {
            'Mã thiết bị': 'TB-10A2-QUAT',
            'Tên thiết bị *': 'Quạt trần Panasonic',
            'Số lượng *': '4',
            'Tình trạng *': 'Tốt',
          },
        },
        {
          sheetName: '10A1',
          rowNumber: 6,
          row: {
            'Tên thiết bị *': 'Máy chiếu',
            'Số lượng *': '-2',
            'Tình trạng *': 'Tốt',
          },
        },
        {
          sheetName: '12C9',
          rowNumber: 2,
          row: {
            'Tên thiết bị *': 'Quạt trần',
            'Số lượng *': '4',
            'Tình trạng *': 'Tốt',
          },
        },
        {
          sheetName: '99Z9',
          rowNumber: 2,
          row: {
            'Tên thiết bị *': 'Đèn LED',
            'Số lượng *': '6',
            'Tình trạng *': 'Tốt',
          },
        },
      ],
    },
    classes: sampleClasses,
    existingFacilities: sampleAssets,
    rooms: sampleRooms,
    targetAcademicYear: '2026 - 2027',
  });

  assert.equal(importPreview.validUpdateCount, 1);
  assert.equal(importPreview.validCreateCount, 1);
  assert.equal(importPreview.duplicateCount, 1);
  assert.equal(importPreview.invalidCount, 4);
  assert.ok(importPreview.inactiveClassSheets.includes('12C9'));
  assert.ok(importPreview.unknownClassSheets.includes('99Z9'));
  assert.equal(importPreview.entitiesToSave.length, 2);
  assert.equal(importPreview.entitiesToSave[0].id, 'AST-1');
  assert.equal(importPreview.entitiesToSave[0].quantity, 10);
  assert.equal(importPreview.entitiesToSave[1].classId, 'CLS-10A1');

  const actLog = createFacilityActivityLog({
    logType: 'smart_control',
    summary: 'Bật hệ thống Đèn lớp 10A1',
    actorName: 'Admin',
    actorRole: 'admin',
    classId: 'CLS-10A1',
    className: '10A1',
  });
  assert.equal(actLog.logType, 'smart_control');
});
