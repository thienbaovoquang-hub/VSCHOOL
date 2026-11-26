import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import type {
  AcademicYearConfig,
  FacilityActivityLog,
  FacilityAsset,
  FacilityDeviceKind,
  FacilityMeterReading,
  FacilitySmartConfig,
  FacilitySmartDeviceState,
  SchoolClass,
  SchoolRoom,
  SystemSettings,
  UserRole,
} from '../types';
import { sanitizeExcelSheetName } from './importExport/sheetGrouping';
import type { ParsedWorkbookData } from './importExport/validator';

export const DEFAULT_ELECTRICITY_COST_PER_KWH = 2100;
export const DEFAULT_OPERATING_DAYS_PER_MONTH = 22;

export const FACILITY_DEVICE_KINDS: FacilityDeviceKind[] = [
  'TV',
  'Quạt',
  'Đèn',
  'Điều hòa',
  'Máy tính',
  'Máy chiếu',
  'Bàn ghế',
  'Thiết bị thí nghiệm',
  'Khác',
];

export const FACILITY_CONDITION_OPTIONS: FacilityAsset['condition'][] = [
  'Tốt',
  'Cần bảo trì',
  'Hỏng hóc',
];

export const FACILITY_STATUS_OPTIONS: FacilityAsset['status'][] = [
  'Đang sử dụng',
  'Đang sửa chữa',
  'Ngừng sử dụng',
];

export const SMART_STATE_LABELS: Record<FacilitySmartDeviceState, string> = {
  on: 'Đang bật',
  off: 'Đang tắt',
  offline: 'Mất kết nối',
  check: 'Cần kiểm tra',
};

function normText(raw: unknown): string {
  return String(raw ?? '').trim();
}

function normToken(raw: unknown): string {
  return normText(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function inferDeviceKind(
  name: string,
  category?: string,
  explicitKind?: string
): FacilityDeviceKind {
  if (explicitKind) {
    const t = normToken(explicitKind);
    if (t === 'tv' || t.includes('tivi') || t.includes('manhinh')) return 'TV';
    if (t.includes('quat')) return 'Quạt';
    if (t === 'den' || t.includes('bongden') || t.includes('chieusang')) return 'Đèn';
    if (t.includes('dieuhoa') || t.includes('maylanh')) return 'Điều hòa';
    if (t.includes('maytinh') || t.includes('laptop') || t.includes('pc')) return 'Máy tính';
    if (t.includes('maychieu') || t.includes('projector')) return 'Máy chiếu';
    if (t.includes('banghe')) return 'Bàn ghế';
    if (t.includes('thinghiem') || t.includes('thuchanh')) return 'Thiết bị thí nghiệm';
  }
  const combined = normToken(`${name} ${category || ''}`);
  if (combined.includes('dieuhoa') || combined.includes('maylanh')) return 'Điều hòa';
  if (combined.includes('quat')) return 'Quạt';
  if (combined.includes('bongden') || combined.includes('denled') || combined.includes('denchieusang') || /\bden\b/i.test(name)) {
    return 'Đèn';
  }
  if (combined.includes('tivi') || /\btv\b/i.test(name) || combined.includes('smarttv')) return 'TV';
  if (combined.includes('maychieu') || combined.includes('projector')) return 'Máy chiếu';
  if (combined.includes('maytinh') || combined.includes('laptop') || combined.includes('pc')) return 'Máy tính';
  if (combined.includes('banghe') || combined.includes('banhoc')) return 'Bàn ghế';
  if (combined.includes('thinghiem') || combined.includes('kinhhienvi')) return 'Thiết bị thí nghiệm';
  if (normToken(category) === 'maytinh') return 'Máy tính';
  if (normToken(category) === 'banghe') return 'Bàn ghế';
  if (normToken(category) === 'dieuhoaquat') return 'Quạt';
  if (normToken(category) === 'thietbithinghiem') return 'Thiết bị thí nghiệm';
  if (normToken(category) === 'thietbitrinhchieu') return 'Máy chiếu';
  return 'Khác';
}

export function inferCategoryFromDeviceKind(
  kind: FacilityDeviceKind,
  fallback?: FacilityAsset['category']
): FacilityAsset['category'] {
  switch (kind) {
    case 'TV':
    case 'Máy chiếu':
      return 'Thiết bị trình chiếu';
    case 'Máy tính':
      return 'Máy tính';
    case 'Bàn ghế':
      return 'Bàn ghế';
    case 'Quạt':
    case 'Điều hòa':
      return 'Điều hòa - Quạt';
    case 'Thiết bị thí nghiệm':
      return 'Thiết bị thí nghiệm';
    default:
      return fallback || 'Thiết bị trình chiếu';
  }
}

export function inferDefaultPowerWatts(kind: FacilityDeviceKind): number {
  switch (kind) {
    case 'Điều hòa':
      return 1200;
    case 'Máy chiếu':
      return 280;
    case 'Máy tính':
      return 180;
    case 'TV':
      return 140;
    case 'Quạt':
      return 65;
    case 'Đèn':
      return 36;
    case 'Thiết bị thí nghiệm':
      return 120;
    case 'Bàn ghế':
      return 0;
    default:
      return 60;
  }
}

export function inferDefaultDailyHours(kind: FacilityDeviceKind): number {
  switch (kind) {
    case 'Đèn':
    case 'Quạt':
      return 6;
    case 'Điều hòa':
      return 5;
    case 'TV':
    case 'Máy chiếu':
      return 4;
    case 'Máy tính':
      return 5;
    case 'Thiết bị thí nghiệm':
      return 2;
    case 'Bàn ghế':
      return 0;
    default:
      return 4;
  }
}

export function isSmartControllableKind(kind: FacilityDeviceKind): boolean {
  return kind === 'Đèn' || kind === 'Quạt' || kind === 'Điều hòa' || kind === 'TV' || kind === 'Máy chiếu';
}

export function normalizeFacilityAsset(
  asset: FacilityAsset,
  classes: SchoolClass[] = [],
  rooms: SchoolRoom[] = [],
  defaultAcademicYear?: string
): FacilityAsset {
  const matchedClass =
    (asset.classId && classes.find((c) => c.id === asset.classId)) ||
    (asset.className &&
      classes.find((c) => c.name.trim().toLowerCase() === asset.className!.trim().toLowerCase())) ||
    classes.find(
      (c) =>
        Boolean(c.room) &&
        normToken(c.room) === normToken(asset.roomLocation)
    );
  const matchedRoom =
    (asset.roomId && rooms.find((r) => r.id === asset.roomId)) ||
    rooms.find(
      (r) =>
        normToken(r.code) === normToken(asset.roomLocation) ||
        normToken(r.name) === normToken(asset.roomLocation)
    );

  const deviceKind = inferDeviceKind(asset.name, asset.category, asset.deviceKind);
  const powerWatts =
    typeof asset.powerWatts === 'number' && Number.isFinite(asset.powerWatts) && asset.powerWatts >= 0
      ? asset.powerWatts
      : inferDefaultPowerWatts(deviceKind);
  const dailyUsageHours =
    typeof asset.dailyUsageHours === 'number' &&
    Number.isFinite(asset.dailyUsageHours) &&
    asset.dailyUsageHours >= 0
      ? asset.dailyUsageHours
      : inferDefaultDailyHours(deviceKind);
  const quantity =
    typeof asset.quantity === 'number' && Number.isFinite(asset.quantity) && asset.quantity > 0
      ? Math.round(asset.quantity)
      : 1;

  const smartState: FacilitySmartDeviceState =
    asset.smartState ||
    (asset.condition === 'Hỏng hóc' || asset.status === 'Đang sửa chữa'
      ? 'check'
      : asset.status === 'Ngừng sử dụng'
      ? 'off'
      : 'off');

  return {
    ...asset,
    deviceKind,
    quantity,
    unit: asset.unit || 'Cái',
    powerWatts,
    dailyUsageHours,
    operatingDaysPerMonth: asset.operatingDaysPerMonth ?? DEFAULT_OPERATING_DAYS_PER_MONTH,
    classId: matchedClass?.id || asset.classId,
    className: matchedClass?.name || asset.className || matchedRoom?.assignedClassName,
    grade: matchedClass?.grade || asset.grade,
    academicYear:
      asset.academicYear ||
      matchedClass?.academicYear ||
      defaultAcademicYear ||
      '2026 - 2027',
    roomId: matchedRoom?.id || asset.roomId,
    roomLocation:
      asset.roomLocation || matchedClass?.room || matchedRoom?.name || 'Phòng học',
    smartControllable: asset.smartControllable ?? isSmartControllableKind(deviceKind),
    smartState,
    iotMode: asset.iotMode || 'simulated',
  };
}

export function getAvailableAcademicYearsForFacilities(
  academicYears: AcademicYearConfig[],
  classes: SchoolClass[],
  facilities: FacilityAsset[],
  fallbackYear?: string
): string[] {
  const set = new Set<string>();
  academicYears.forEach((y) => {
    if (y.name?.trim()) set.add(y.name.trim());
  });
  classes.forEach((c) => {
    if (c.status !== 'inactive' && c.academicYear?.trim()) set.add(c.academicYear.trim());
  });
  facilities.forEach((f) => {
    if (f.academicYear?.trim()) set.add(f.academicYear.trim());
  });
  if (fallbackYear?.trim()) set.add(fallbackYear.trim());
  if (set.size === 0) set.add('2026 - 2027');
  return Array.from(set).sort((a, b) => b.localeCompare(a, 'vi'));
}

export function filterClassesForFacilities(params: {
  classes: SchoolClass[];
  academicYear?: string;
  grade?: string | number;
  includeInactive?: boolean;
}): SchoolClass[] {
  const { classes, academicYear, grade, includeInactive = false } = params;
  return classes
    .filter((cls) => {
      if (!includeInactive && cls.status === 'inactive') return false;
      if (academicYear && academicYear !== 'all' && cls.academicYear && cls.academicYear !== academicYear) {
        return false;
      }
      if (grade && grade !== 'all' && Number(cls.grade) !== Number(grade)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

export function matchAssetToClass(asset: FacilityAsset, cls: SchoolClass): boolean {
  if (asset.classId && cls.id && asset.classId === cls.id) return true;
  if (asset.className && normToken(asset.className) === normToken(cls.name)) return true;
  if (cls.room && asset.roomLocation && normToken(asset.roomLocation) === normToken(cls.room)) {
    return true;
  }
  return false;
}

export function filterFacilitiesByScope(params: {
  facilities: FacilityAsset[];
  classes: SchoolClass[];
  academicYear?: string;
  grade?: string | number;
  classId?: string;
  roomLocation?: string;
  deviceKind?: string;
  condition?: string;
  search?: string;
}): FacilityAsset[] {
  const {
    facilities,
    classes,
    academicYear,
    grade,
    classId,
    roomLocation,
    deviceKind,
    condition,
    search,
  } = params;

  const targetClass = classId && classId !== 'all' ? classes.find((c) => c.id === classId) : undefined;
  const q = normText(search).toLowerCase();

  return facilities.filter((asset) => {
    const linkedClass =
      (asset.classId && classes.find((c) => c.id === asset.classId)) ||
      (asset.className && classes.find((c) => normToken(c.name) === normToken(asset.className))) ||
      classes.find((c) => c.room && normToken(c.room) === normToken(asset.roomLocation));

    const effectiveYear = asset.academicYear || linkedClass?.academicYear;
    if (academicYear && academicYear !== 'all' && effectiveYear && effectiveYear !== academicYear) {
      return false;
    }

    const effectiveGrade = asset.grade || linkedClass?.grade;
    if (grade && grade !== 'all' && Number(effectiveGrade) !== Number(grade)) {
      return false;
    }

    if (targetClass && !matchAssetToClass(asset, targetClass)) {
      return false;
    }

    if (roomLocation && roomLocation !== 'all' && normToken(asset.roomLocation) !== normToken(roomLocation)) {
      return false;
    }

    const resolvedKind = inferDeviceKind(asset.name, asset.category, asset.deviceKind);
    if (deviceKind && deviceKind !== 'all' && resolvedKind !== deviceKind) {
      return false;
    }

    if (condition && condition !== 'all' && asset.condition !== condition) {
      return false;
    }

    if (q) {
      const hay = `${asset.code} ${asset.name} ${resolvedKind} ${asset.className || ''} ${asset.roomLocation} ${asset.notes || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });
}

export function buildTransferredFacilityAsset(params: {
  asset: FacilityAsset;
  targetClass: SchoolClass;
  rooms?: SchoolRoom[];
  actorName?: string;
}): FacilityAsset {
  const { asset, targetClass, rooms = [] } = params;
  const targetRoom = rooms.find(
    (r) =>
      normToken(r.code) === normToken(targetClass.room) ||
      normToken(r.name) === normToken(targetClass.room) ||
      normToken(r.assignedClassName) === normToken(targetClass.name)
  );
  return {
    ...asset,
    classId: targetClass.id,
    className: targetClass.name,
    grade: targetClass.grade,
    academicYear: targetClass.academicYear || asset.academicYear,
    roomId: targetRoom?.id || asset.roomId,
    roomLocation: targetClass.room || targetRoom?.name || targetClass.name,
    updatedAt: new Date().toISOString(),
  };
}

export function buildAdjustedQuantityFacilityAsset(
  asset: FacilityAsset,
  nextQuantity: number
): FacilityAsset {
  return {
    ...asset,
    quantity: Math.max(1, Math.round(nextQuantity)),
    updatedAt: new Date().toISOString(),
  };
}

export function cascadeSyncFacilitiesForClass(params: {
  updatedClass: SchoolClass;
  previousClass?: SchoolClass;
  facilities: FacilityAsset[];
  smartConfigs: FacilitySmartConfig[];
  meterReadings: FacilityMeterReading[];
}): {
  updatedFacilities: FacilityAsset[];
  updatedSmartConfigs: FacilitySmartConfig[];
  updatedMeterReadings: FacilityMeterReading[];
} {
  const { updatedClass, previousClass, facilities, smartConfigs, meterReadings } = params;
  const oldNames = new Set(
    [previousClass?.name, updatedClass.name].filter(Boolean).map((v) => normToken(v))
  );
  const oldRoom = previousClass?.room ? normToken(previousClass.room) : '';

  const updatedFacilities: FacilityAsset[] = [];
  for (const asset of facilities) {
    const matchesById = asset.classId === updatedClass.id;
    const matchesByOldName = Boolean(asset.className) && oldNames.has(normToken(asset.className));
    if (!matchesById && !matchesByOldName) continue;

    const shouldUpdateRoom =
      Boolean(updatedClass.room) &&
      (!oldRoom || normToken(asset.roomLocation) === oldRoom || normToken(asset.roomLocation) === normToken(previousClass?.name));

    const nextAsset: FacilityAsset = {
      ...asset,
      classId: updatedClass.id,
      className: updatedClass.name,
      grade: updatedClass.grade,
      academicYear: updatedClass.academicYear || asset.academicYear,
      roomLocation: shouldUpdateRoom ? updatedClass.room : asset.roomLocation,
    };

    if (
      nextAsset.classId !== asset.classId ||
      nextAsset.className !== asset.className ||
      nextAsset.grade !== asset.grade ||
      nextAsset.academicYear !== asset.academicYear ||
      nextAsset.roomLocation !== asset.roomLocation
    ) {
      updatedFacilities.push(nextAsset);
    }
  }

  const updatedSmartConfigs: FacilitySmartConfig[] = [];
  for (const cfg of smartConfigs) {
    if (cfg.classId === updatedClass.id || oldNames.has(normToken(cfg.className))) {
      const nextCfg: FacilitySmartConfig = {
        ...cfg,
        classId: updatedClass.id,
        className: updatedClass.name,
        academicYear: updatedClass.academicYear || cfg.academicYear,
        roomLocation: updatedClass.room || cfg.roomLocation,
      };
      if (
        nextCfg.className !== cfg.className ||
        nextCfg.academicYear !== cfg.academicYear ||
        nextCfg.roomLocation !== cfg.roomLocation
      ) {
        updatedSmartConfigs.push(nextCfg);
      }
    }
  }

  const updatedMeterReadings: FacilityMeterReading[] = [];
  for (const r of meterReadings) {
    if (r.scopeType === 'class' && (r.classId === updatedClass.id || r.scopeId === updatedClass.id)) {
      const nextR: FacilityMeterReading = {
        ...r,
        classId: updatedClass.id,
        className: updatedClass.name,
        scopeName: updatedClass.name,
        grade: updatedClass.grade,
        academicYear: updatedClass.academicYear || r.academicYear,
        roomLocation: updatedClass.room || r.roomLocation,
      };
      if (
        nextR.className !== r.className ||
        nextR.scopeName !== r.scopeName ||
        nextR.grade !== r.grade ||
        nextR.roomLocation !== r.roomLocation
      ) {
        updatedMeterReadings.push(nextR);
      }
    }
  }

  return { updatedFacilities, updatedSmartConfigs, updatedMeterReadings };
}

/* ================== ENERGY CALCULATION ENGINE ================== */

export interface AssetEnergyMetric {
  assetId: string;
  code: string;
  name: string;
  deviceKind: FacilityDeviceKind;
  quantity: number;
  powerWattsPerUnit: number;
  totalWatts: number;
  dailyUsageHours: number;
  operatingDaysPerMonth: number;
  dailyKwh: number;
  monthlyKwh: number;
  estimatedMonthlyCostVnd: number;
  classId?: string;
  className: string;
  grade?: number;
  roomLocation: string;
  isActiveConsumption: boolean;
  isEstimated: boolean;
}

export interface AggregatedEnergyBucket {
  key: string;
  label: string;
  subLabel?: string;
  deviceCount: number;
  totalQuantity: number;
  totalWatts: number;
  estimatedDailyKwh: number;
  estimatedMonthlyKwh: number;
  measuredMonthlyKwh: number | null;
  effectiveMonthlyKwh: number;
  estimatedMonthlyCostVnd: number;
  hasMeterReading: boolean;
  sourceLabel: string;
}

export interface FacilityEnergySummary {
  costPerKwh: number;
  totalActiveDevices: number;
  totalWatts: number;
  totalDailyKwh: number;
  estimatedMonthlyKwh: number;
  measuredMonthlyKwh: number | null;
  effectiveMonthlyKwh: number;
  effectiveMonthlyCostVnd: number;
  hasAnyMeterReading: boolean;
  schoolSourceLabel: string;
  byDevice: AssetEnergyMetric[];
  byClass: AggregatedEnergyBucket[];
  byRoom: AggregatedEnergyBucket[];
  byGrade: AggregatedEnergyBucket[];
}

export function calculateAssetEnergyMetric(
  asset: FacilityAsset,
  costPerKwh: number = DEFAULT_ELECTRICITY_COST_PER_KWH,
  classes: SchoolClass[] = []
): AssetEnergyMetric {
  const normalized = normalizeFacilityAsset(asset, classes);
  const qty = normalized.quantity || 1;
  const watts = normalized.powerWatts ?? 0;
  const isActiveConsumption = normalized.status !== 'Ngừng sử dụng' && watts > 0;
  const totalWatts = isActiveConsumption ? watts * qty : 0;
  const dailyHours = isActiveConsumption ? normalized.dailyUsageHours ?? 0 : 0;
  const days = normalized.operatingDaysPerMonth ?? DEFAULT_OPERATING_DAYS_PER_MONTH;
  const dailyKwh = Number(((totalWatts * dailyHours) / 1000).toFixed(2));
  const monthlyKwh = Number((dailyKwh * days).toFixed(2));
  const estimatedMonthlyCostVnd = Math.round(monthlyKwh * costPerKwh);

  return {
    assetId: asset.id,
    code: asset.code,
    name: asset.name,
    deviceKind: normalized.deviceKind || 'Khác',
    quantity: qty,
    powerWattsPerUnit: watts,
    totalWatts,
    dailyUsageHours: dailyHours,
    operatingDaysPerMonth: days,
    dailyKwh,
    monthlyKwh,
    estimatedMonthlyCostVnd,
    classId: normalized.classId,
    className: normalized.className || 'Dùng chung',
    grade: normalized.grade,
    roomLocation: normalized.roomLocation,
    isActiveConsumption,
    isEstimated: true,
  };
}

export function calculateFacilityEnergySummary(params: {
  facilities: FacilityAsset[];
  classes: SchoolClass[];
  meterReadings?: FacilityMeterReading[];
  costPerKwh?: number;
  periodKey?: string;
}): FacilityEnergySummary {
  const {
    facilities,
    classes,
    meterReadings = [],
    costPerKwh = DEFAULT_ELECTRICITY_COST_PER_KWH,
    periodKey,
  } = params;

  const byDevice = facilities.map((f) => calculateAssetEnergyMetric(f, costPerKwh, classes));

  const relevantReadings = periodKey
    ? meterReadings.filter((r) => r.periodKey === periodKey)
    : meterReadings;

  const latestReadingByScope = new Map<string, FacilityMeterReading>();
  const sortedReadings = [...relevantReadings].sort((a, b) =>
    (b.recordedAt || '').localeCompare(a.recordedAt || '')
  );
  for (const r of sortedReadings) {
    const key = `${r.scopeType}:${normToken(r.scopeId || r.scopeName)}`;
    if (!latestReadingByScope.has(key)) {
      latestReadingByScope.set(key, r);
    }
  }

  const buildBuckets = (
    groupFn: (m: AssetEnergyMetric) => { key: string; label: string; subLabel?: string },
    scopeType: 'class' | 'room' | 'grade'
  ): AggregatedEnergyBucket[] => {
    const map = new Map<
      string,
      {
        label: string;
        subLabel?: string;
        deviceCount: number;
        totalQuantity: number;
        totalWatts: number;
        estimatedDailyKwh: number;
        estimatedMonthlyKwh: number;
      }
    >();

    for (const m of byDevice) {
      const g = groupFn(m);
      const curr = map.get(g.key) || {
        label: g.label,
        subLabel: g.subLabel,
        deviceCount: 0,
        totalQuantity: 0,
        totalWatts: 0,
        estimatedDailyKwh: 0,
        estimatedMonthlyKwh: 0,
      };
      curr.deviceCount += 1;
      curr.totalQuantity += m.quantity;
      curr.totalWatts += m.totalWatts;
      curr.estimatedDailyKwh = Number((curr.estimatedDailyKwh + m.dailyKwh).toFixed(2));
      curr.estimatedMonthlyKwh = Number((curr.estimatedMonthlyKwh + m.monthlyKwh).toFixed(2));
      map.set(g.key, curr);
    }

    return Array.from(map.entries())
      .map(([key, bucket]) => {
        const meter =
          latestReadingByScope.get(`${scopeType}:${normToken(key)}`) ||
          latestReadingByScope.get(`${scopeType}:${normToken(bucket.label)}`);
        const measuredMonthlyKwh = meter
          ? Number(
              (meter.periodType === 'day'
                ? meter.measuredKwh * DEFAULT_OPERATING_DAYS_PER_MONTH
                : meter.measuredKwh
              ).toFixed(2)
            )
          : null;
        const effectiveMonthlyKwh =
          measuredMonthlyKwh !== null ? measuredMonthlyKwh : bucket.estimatedMonthlyKwh;
        const rate = meter?.costPerKwh || costPerKwh;
        return {
          key,
          label: bucket.label,
          subLabel: bucket.subLabel,
          deviceCount: bucket.deviceCount,
          totalQuantity: bucket.totalQuantity,
          totalWatts: bucket.totalWatts,
          estimatedDailyKwh: bucket.estimatedDailyKwh,
          estimatedMonthlyKwh: bucket.estimatedMonthlyKwh,
          measuredMonthlyKwh,
          effectiveMonthlyKwh,
          estimatedMonthlyCostVnd: Math.round(effectiveMonthlyKwh * rate),
          hasMeterReading: measuredMonthlyKwh !== null,
          sourceLabel:
            measuredMonthlyKwh !== null
              ? meter?.sourceMode === 'sensor'
                ? 'Cảm biến đo đạc'
                : 'Số liệu công tơ thực tế'
              : 'Số liệu ước tính từ công suất & thời gian',
        };
      })
      .sort((a, b) => b.effectiveMonthlyKwh - a.effectiveMonthlyKwh);
  };

  const byClass = buildBuckets(
    (m) => ({
      key: m.classId || m.className,
      label: m.className,
      subLabel: m.roomLocation,
    }),
    'class'
  );
  const byRoom = buildBuckets(
    (m) => ({
      key: m.roomLocation || 'Chưa xếp phòng',
      label: m.roomLocation || 'Chưa xếp phòng',
      subLabel: m.className !== 'Dùng chung' ? `Lớp ${m.className}` : undefined,
    }),
    'room'
  );
  const byGrade = buildBuckets(
    (m) => ({
      key: m.grade ? `khoi-${m.grade}` : 'dung-chung',
      label: m.grade ? `Khối ${m.grade}` : 'Khu dùng chung',
    }),
    'grade'
  );

  const totalWatts = byDevice.reduce((s, d) => s + d.totalWatts, 0);
  const totalDailyKwh = Number(byDevice.reduce((s, d) => s + d.dailyKwh, 0).toFixed(2));
  const estimatedMonthlyKwh = Number(byDevice.reduce((s, d) => s + d.monthlyKwh, 0).toFixed(2));
  const schoolMeter = sortedReadings.find((r) => r.scopeType === 'school');
  const measuredMonthlyKwh = schoolMeter
    ? Number(
        (schoolMeter.periodType === 'day'
          ? schoolMeter.measuredKwh * DEFAULT_OPERATING_DAYS_PER_MONTH
          : schoolMeter.measuredKwh
        ).toFixed(2)
      )
    : null;
  const hasAnyMeterReading = Boolean(schoolMeter) || byClass.some((b) => b.hasMeterReading);
  const combinedClassEffectiveKwh = Number(
    byClass.reduce((s, b) => s + b.effectiveMonthlyKwh, 0).toFixed(2)
  );
  const effectiveMonthlyKwh =
    measuredMonthlyKwh !== null
      ? measuredMonthlyKwh
      : hasAnyMeterReading
      ? combinedClassEffectiveKwh
      : estimatedMonthlyKwh;
  const effectiveCostRate = schoolMeter?.costPerKwh || costPerKwh;

  return {
    costPerKwh,
    totalActiveDevices: byDevice.filter((d) => d.isActiveConsumption).length,
    totalWatts,
    totalDailyKwh,
    estimatedMonthlyKwh,
    measuredMonthlyKwh,
    effectiveMonthlyKwh,
    effectiveMonthlyCostVnd: Math.round(effectiveMonthlyKwh * effectiveCostRate),
    hasAnyMeterReading,
    schoolSourceLabel:
      measuredMonthlyKwh !== null
        ? 'Số liệu công tơ tổng toàn trường'
        : hasAnyMeterReading
        ? 'Kết hợp số liệu công tơ theo lớp & ước tính từ công suất thiết bị (chưa có công tơ tổng)'
        : 'Số liệu ước tính từ công suất & thời gian sử dụng (chưa kết nối cảm biến đo tổng)',
    byDevice,
    byClass,
    byRoom,
    byGrade,
  };
}

/* ================== SMART ENVIRONMENT & CONTROL ENGINE ================== */

export function buildDefaultSmartConfigForClass(
  cls: SchoolClass,
  actorName: string = 'Hệ thống'
): FacilitySmartConfig {
  return {
    id: `SMART-${cls.id}`,
    classId: cls.id,
    className: cls.name,
    roomLocation: cls.room || cls.name,
    academicYear: cls.academicYear || '2026 - 2027',
    sensorMode: 'simulated',
    temperatureC: 28,
    luxLevel: 380,
    autoEnabled: false,
    tempThresholdAC: 30,
    tempThresholdFan: 27,
    luxThresholdLight: 300,
    scheduleStart: '07:00',
    scheduleEnd: '17:00',
    safetyMaxTempC: 36,
    safetyMaxRuntimeHours: 10,
    deviceStates: {
      lights: 'off',
      fans: 'off',
      ac: 'off',
    },
    updatedBy: actorName,
    updatedAt: new Date().toISOString(),
  };
}

export interface SmartRuleSuggestion {
  deviceGroup: 'lights' | 'fans' | 'ac';
  deviceLabel: string;
  recommendedState: 'on' | 'off';
  currentState: FacilitySmartDeviceState;
  actionNeeded: boolean;
  reason: string;
  requiresConfirmation: boolean;
  safetyWarning?: string;
}

export interface SmartEnvironmentEvaluation {
  withinSchedule: boolean;
  isSimulationMode: boolean;
  modeNotice: string;
  suggestions: SmartRuleSuggestion[];
  safetyAlerts: string[];
}

function parseMinutesHHMM(hhmm: string): number {
  const m = (hhmm || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function evaluateSmartEnvironment(
  config: FacilitySmartConfig,
  currentTimeHHMM?: string
): SmartEnvironmentEvaluation {
  const now = new Date();
  const hhmm =
    currentTimeHHMM ||
    `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const nowMin = parseMinutesHHMM(hhmm);
  const startMin = parseMinutesHHMM(config.scheduleStart || '07:00');
  const endMin = parseMinutesHHMM(config.scheduleEnd || '17:00');
  const withinSchedule = nowMin >= startMin && nowMin <= endMin;

  const suggestions: SmartRuleSuggestion[] = [];
  const safetyAlerts: string[] = [];

  if (config.temperatureC >= config.safetyMaxTempC) {
    safetyAlerts.push(
      `Nhiệt độ (${config.temperatureC}°C) vượt ngưỡng an toàn (${config.safetyMaxTempC}°C) — cần kiểm tra thông gió hoặc tải điện.`
    );
  }

  // Lighting rule
  const recLight: 'on' | 'off' =
    withinSchedule && config.luxLevel < config.luxThresholdLight ? 'on' : 'off';
  suggestions.push({
    deviceGroup: 'lights',
    deviceLabel: 'Hệ thống Đèn chiếu sáng',
    recommendedState: recLight,
    currentState: config.deviceStates.lights,
    actionNeeded:
      config.deviceStates.lights !== recLight && config.deviceStates.lights !== 'offline',
    reason: !withinSchedule
      ? `Ngoài khung giờ học (${config.scheduleStart} - ${config.scheduleEnd}) → đề xuất tắt đèn tiết kiệm điện.`
      : config.luxLevel < config.luxThresholdLight
      ? `Độ sáng (${config.luxLevel} lux) thấp hơn ngưỡng (${config.luxThresholdLight} lux) → đề xuất bật đèn.`
      : `Ánh sáng tự nhiên đủ (${config.luxLevel} lux ≥ ${config.luxThresholdLight} lux) → đề xuất tắt bớt đèn.`,
    requiresConfirmation: true,
  });

  // Fan rule
  const recFan: 'on' | 'off' =
    withinSchedule && config.temperatureC >= config.tempThresholdFan ? 'on' : 'off';
  suggestions.push({
    deviceGroup: 'fans',
    deviceLabel: 'Hệ thống Quạt',
    recommendedState: recFan,
    currentState: config.deviceStates.fans,
    actionNeeded:
      config.deviceStates.fans !== recFan && config.deviceStates.fans !== 'offline',
    reason: !withinSchedule
      ? `Ngoài khung giờ học (${config.scheduleStart} - ${config.scheduleEnd}) → đề xuất tắt quạt.`
      : config.temperatureC >= config.tempThresholdFan
      ? `Nhiệt độ (${config.temperatureC}°C ≥ ${config.tempThresholdFan}°C) → đề xuất bật quạt làm mát.`
      : `Nhiệt độ phòng mát (${config.temperatureC}°C < ${config.tempThresholdFan}°C) → có thể tắt quạt.`,
    requiresConfirmation: true,
  });

  // AC rule
  const recAC: 'on' | 'off' =
    withinSchedule && config.temperatureC >= config.tempThresholdAC ? 'on' : 'off';
  suggestions.push({
    deviceGroup: 'ac',
    deviceLabel: 'Hệ thống Điều hòa',
    recommendedState: recAC,
    currentState: config.deviceStates.ac,
    actionNeeded:
      config.deviceStates.ac !== recAC && config.deviceStates.ac !== 'offline',
    reason: !withinSchedule
      ? `Ngoài khung giờ học (${config.scheduleStart} - ${config.scheduleEnd}) → đề xuất tắt điều hòa.`
      : config.temperatureC >= config.tempThresholdAC
      ? `Nhiệt độ (${config.temperatureC}°C ≥ ${config.tempThresholdAC}°C) → đề xuất bật điều hòa (tải điện cao, cần xác nhận).`
      : `Nhiệt độ (${config.temperatureC}°C < ${config.tempThresholdAC}°C) → chưa cần bật điều hòa.`,
    requiresConfirmation: true,
    safetyWarning:
      recAC === 'on'
        ? 'Điều hòa công suất lớn — kiểm tra đóng kín cửa phòng trước khi bật.'
        : undefined,
  });

  const isSimulationMode = config.sensorMode !== 'connected';

  return {
    withinSchedule,
    isSimulationMode,
    modeNotice: isSimulationMode
      ? 'Chế độ mô phỏng & đề xuất (Chưa kết nối cảm biến/IoT phần cứng thực tế).'
      : 'Đang đồng bộ cảm biến & bộ điều khiển IoT đã cấu hình.',
    suggestions,
    safetyAlerts,
  };
}

export function summarizeSchoolSmartStatus(configs: FacilitySmartConfig[]): {
  onCount: number;
  offCount: number;
  offlineCount: number;
  checkCount: number;
  totalChannels: number;
} {
  let onCount = 0;
  let offCount = 0;
  let offlineCount = 0;
  let checkCount = 0;

  for (const cfg of configs) {
    const states = [cfg.deviceStates.lights, cfg.deviceStates.fans, cfg.deviceStates.ac];
    for (const s of states) {
      if (s === 'on') onCount += 1;
      else if (s === 'off') offCount += 1;
      else if (s === 'offline') offlineCount += 1;
      else if (s === 'check') checkCount += 1;
    }
  }

  return {
    onCount,
    offCount,
    offlineCount,
    checkCount,
    totalChannels: onCount + offCount + offlineCount + checkCount,
  };
}

/* ================== PER-CLASS EXCEL TEMPLATE, IMPORT & EXPORT ================== */

export interface ClassFacilitiesWorkbookOptions {
  classes: SchoolClass[];
  facilities: FacilityAsset[];
  rooms: SchoolRoom[];
  academicYear: string;
  systemSettings?: SystemSettings;
  scope?: 'all' | 'grade' | 'class';
  grade?: number;
  classId?: string;
  templateMode?: boolean;
}

const CLASS_SHEET_HEADERS = [
  'Mã thiết bị',
  'Tên thiết bị *',
  'Loại thiết bị',
  'Số lượng *',
  'Đơn vị tính',
  'Công suất (W)',
  'Giờ dùng/ngày',
  'Tình trạng *',
  'Trạng thái sử dụng',
  'Vị trí / Phòng',
  'Ghi chú',
] as const;

export async function generateClassFacilitiesWorkbookBuffer(
  options: ClassFacilitiesWorkbookOptions
): Promise<Uint8Array> {
  const {
    classes,
    facilities,
    rooms,
    academicYear,
    scope = 'all',
    grade,
    classId,
    templateMode = false,
  } = options;

  let targetClasses = filterClassesForFacilities({
    classes,
    academicYear: academicYear === 'all' ? undefined : academicYear,
    grade: scope === 'grade' ? grade : undefined,
    includeInactive: false,
  });
  if (scope === 'class' && classId) {
    targetClasses = classes.filter((c) => c.id === classId && c.status !== 'inactive');
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'SchoolHub Cơ sở vật chất';
  wb.created = new Date();

  // 1. HUONG_DAN sheet
  const guideSheet = wb.addWorksheet('HUONG_DAN');
  guideSheet.columns = [
    { header: 'Mục', key: 'section', width: 28 },
    { header: 'Hướng dẫn sử dụng biểu mẫu Thiết bị theo lớp', key: 'detail', width: 88 },
  ];
  guideSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  guideSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F766E' },
  };
  const guideRows = [
    ['Năm học đồng bộ', academicYear || 'Tất cả năm học đang hoạt động'],
    ['Cấu trúc Sheet lớp', 'Mỗi sheet ứng với một lớp đang hoạt động (tên sheet khớp với mã/tên lớp). Không dùng tên HUONG_DAN hoặc DANH_MUC làm tên lớp.'],
    ['Quy tắc nhập liệu', 'Các cột đánh dấu (*) là bắt buộc: Tên thiết bị *, Số lượng * (>0), Tình trạng *. Mã thiết bị để trống sẽ tự động sinh theo lớp.'],
    ['Cập nhật an toàn', 'Khi cập nhật lại file, hệ thống chỉ cập nhật đúng thiết bị của đúng lớp tương ứng, không ghi đè lớp khác và không tự xóa dữ liệu đang có.'],
    ['Danh mục tham chiếu', 'Sử dụng danh sách tại sheet DANH_MUC (Loại thiết bị, Tình trạng, Trạng thái, Danh sách lớp) để tránh sai chính tả.'],
    ['Tương thích Google Sheets', 'Có thể mở file này bằng Google Sheets, chỉnh sửa rồi tải về .xlsx hoặc sao chép vùng dữ liệu dán trực tiếp vào chức năng nhập.'],
  ];
  guideRows.forEach((r) => guideSheet.addRow({ section: r[0], detail: r[1] }));

  // 2. DANH_MUC sheet
  const catSheet = wb.addWorksheet('DANH_MUC');
  catSheet.columns = [
    { header: 'LoaiThietBi', key: 'kind', width: 22 },
    { header: 'TinhTrang', key: 'condition', width: 18 },
    { header: 'TrangThai', key: 'status', width: 20 },
    { header: 'DonViTinh', key: 'unit', width: 14 },
    { header: 'LopHoatDong', key: 'className', width: 18 },
    { header: 'PhongHoc', key: 'room', width: 20 },
  ];
  catSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  catSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1D4ED8' },
  };
  const units = ['Cái', 'Bộ', 'Chiếc', 'Hệ thống', 'Bóng'];
  const activeRoomNames = rooms.map((r) => r.name || r.code).filter(Boolean);
  const maxCatRows = Math.max(
    FACILITY_DEVICE_KINDS.length,
    FACILITY_CONDITION_OPTIONS.length,
    FACILITY_STATUS_OPTIONS.length,
    units.length,
    targetClasses.length,
    activeRoomNames.length
  );
  for (let i = 0; i < maxCatRows; i += 1) {
    catSheet.addRow({
      kind: FACILITY_DEVICE_KINDS[i] || '',
      condition: FACILITY_CONDITION_OPTIONS[i] || '',
      status: FACILITY_STATUS_OPTIONS[i] || '',
      unit: units[i] || '',
      className: targetClasses[i]?.name || '',
      room: activeRoomNames[i] || '',
    });
  }

  // 3. Per-class data sheets
  const usedNames = new Set<string>(['huong_dan', 'danh_muc']);
  const classesToWrite = targetClasses.length > 0 ? targetClasses : [];

  if (classesToWrite.length === 0) {
    const fallbackSheet = wb.addWorksheet('10A1');
    fallbackSheet.addRow([...CLASS_SHEET_HEADERS]);
    fallbackSheet.getRow(1).font = { bold: true };
  }

  for (const cls of classesToWrite) {
    const sheetName = sanitizeExcelSheetName(cls.name || cls.code, usedNames);
    const ws = wb.addWorksheet(sheetName);
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    const widths = [16, 28, 20, 12, 13, 15, 14, 16, 18, 18, 24];
    ws.columns = CLASS_SHEET_HEADERS.map((h, i) => ({
      header: h,
      key: `col_${i}`,
      width: widths[i] || 18,
    }));

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' },
    };

    const classAssets = facilities.filter((f) => matchAssetToClass(f, cls));
    if (templateMode && classAssets.length === 0) {
      // Seed clean starter rows in template so schools have wattage/kind formatting examples
      const starterRows = [
        [`TB-${cls.name}-01`, 'Đèn LED chiếu sáng lớp học', 'Đèn', 8, 'Bóng', 36, 6, 'Tốt', 'Đang sử dụng', cls.room || cls.name, 'Mẫu chuẩn'],
        [`TB-${cls.name}-02`, 'Quạt trần phòng học', 'Quạt', 4, 'Cái', 65, 6, 'Tốt', 'Đang sử dụng', cls.room || cls.name, 'Mẫu chuẩn'],
        [`TB-${cls.name}-03`, 'Smart TV 65 inch', 'TV', 1, 'Cái', 140, 4, 'Tốt', 'Đang sử dụng', cls.room || cls.name, 'Mẫu chuẩn'],
      ];
      starterRows.forEach((r) => ws.addRow(r));
    } else {
      classAssets.forEach((asset) => {
        const norm = normalizeFacilityAsset(asset, classes, rooms, academicYear);
        ws.addRow([
          norm.code,
          norm.name,
          norm.deviceKind || 'Khác',
          norm.quantity || 1,
          norm.unit || 'Cái',
          norm.powerWatts ?? 0,
          norm.dailyUsageHours ?? 0,
          norm.condition,
          norm.status,
          norm.roomLocation || cls.room || cls.name,
          norm.notes || '',
        ]);
      });
    }

    // Add Excel data validation dropdowns for rows 2..200
    const maxDataRows = Math.max(ws.rowCount + 25, 60);
    for (let r = 2; r <= maxDataRows; r += 1) {
      ws.getCell(r, 3).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`DANH_MUC!$A$2:$A$${FACILITY_DEVICE_KINDS.length + 1}`],
      };
      ws.getCell(r, 8).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [`DANH_MUC!$B$2:$B$${FACILITY_CONDITION_OPTIONS.length + 1}`],
      };
      ws.getCell(r, 9).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`DANH_MUC!$C$2:$C$${FACILITY_STATUS_OPTIONS.length + 1}`],
      };
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

export interface ClassFacilityPreviewRow {
  sheetName: string;
  rowNumber: number;
  className: string;
  classId?: string;
  status: 'valid_create' | 'valid_update' | 'invalid' | 'duplicate';
  errors: string[];
  diffs: string[];
  entity?: FacilityAsset;
}

export interface ClassFacilityImportPreview {
  totalRows: number;
  validCreateCount: number;
  validUpdateCount: number;
  invalidCount: number;
  duplicateCount: number;
  matchedSheets: string[];
  unknownClassSheets: string[];
  inactiveClassSheets: string[];
  rows: ClassFacilityPreviewRow[];
  entitiesToSave: FacilityAsset[];
}

export function parseGoogleSheetsUrlToCsvUrl(rawUrl: string): string | null {
  const trimmed = normText(rawUrl);
  if (!trimmed) return null;
  if (/export\?format=(csv|tsv)/i.test(trimmed) || /output=(csv|tsv)/i.test(trimmed)) {
    return trimmed;
  }
  const idMatch = trimmed.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;
  const spreadsheetId = idMatch[1];
  const gidMatch = trimmed.match(/[?&#]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
}

export function parseDelimitedSpreadsheetText(
  text: string,
  sheetName: string = 'GoogleSheets'
): ParsedWorkbookData {
  const cleanText = text.replace(/^\uFEFF/, '').trim();
  const firstLine = cleanText.split(/\r?\n/)[0] || '';
  const delimiter = firstLine.includes('\t') ? '\t' : ',';
  const wb = XLSX.read(cleanText, { type: 'string', FS: delimiter });
  const firstWsName = wb.SheetNames[0];
  const rows = firstWsName
    ? XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[firstWsName], {
        defval: '',
        raw: false,
      })
    : [];
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return {
    fileName: `${sheetName}.csv`,
    sheetNames: [sheetName],
    dataSheetName: sheetName,
    dataSheetNames: [sheetName],
    headers,
    rows,
    rowItems: rows.map((row, idx) => ({
      sheetName,
      rowNumber: idx + 2,
      row,
    })),
    extraSheets: {},
  };
}

function getRowCellByAliases(row: Record<string, unknown>, aliases: string[]): string {
  const normalizedWanted = new Set(aliases.map(normToken));
  for (const [k, v] of Object.entries(row)) {
    if (normalizedWanted.has(normToken(k))) {
      return normText(v);
    }
  }
  return '';
}

function normalizeConditionInput(raw: string): FacilityAsset['condition'] | null {
  const t = normToken(raw);
  if (!t || t === 'tot' || t === 'binhthuong' || t === 'good') return 'Tốt';
  if (t.includes('baotri') || t.includes('suachua') || t.includes('canbaotri')) return 'Cần bảo trì';
  if (t.includes('hong') || t.includes('hu')) return 'Hỏng hóc';
  return null;
}

function normalizeStatusInput(raw: string): FacilityAsset['status'] {
  const t = normToken(raw);
  if (t.includes('suachua')) return 'Đang sửa chữa';
  if (t.includes('ngung') || t.includes('thanhly')) return 'Ngừng sử dụng';
  return 'Đang sử dụng';
}

export function parseAndValidateClassFacilitiesWorkbook(params: {
  parsedWorkbook: ParsedWorkbookData;
  classes: SchoolClass[];
  existingFacilities: FacilityAsset[];
  rooms?: SchoolRoom[];
  targetAcademicYear: string;
  fallbackClassId?: string;
}): ClassFacilityImportPreview {
  const {
    parsedWorkbook,
    classes,
    existingFacilities,
    rooms = [],
    targetAcademicYear,
    fallbackClassId,
  } = params;

  const IGNORED_SHEETS = new Set(['HUONG_DAN', 'DANH_MUC', 'HUONGDAN', 'DANHMUC', 'TONG_QUAN', 'README']);
  const origins =
    parsedWorkbook.rowItems && parsedWorkbook.rowItems.length > 0
      ? parsedWorkbook.rowItems
      : parsedWorkbook.rows.map((row, idx) => ({
          sheetName: parsedWorkbook.dataSheetName || parsedWorkbook.sheetNames?.[0] || 'DATA',
          rowNumber: idx + 2,
          row,
        }));

  const fallbackClass = fallbackClassId
    ? classes.find((c) => c.id === fallbackClassId)
    : undefined;

  const matchedSheetsSet = new Set<string>();
  const unknownClassSheetsSet = new Set<string>();
  const inactiveClassSheetsSet = new Set<string>();
  const seenKeysInUpload = new Set<string>();

  const rows: ClassFacilityPreviewRow[] = [];
  const entitiesToSave: FacilityAsset[] = [];
  let validCreateCount = 0;
  let validUpdateCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;

  for (const origin of origins) {
    const sheetName = normText(origin.sheetName || 'DATA');
    if (IGNORED_SHEETS.has(sheetName.toUpperCase())) continue;

    const rawRow = origin.row || {};
    const name = getRowCellByAliases(rawRow, ['Tên thiết bị *', 'Tên thiết bị', 'TenThietBi', 'TenTaiSan', 'Tên tài sản', 'name']);
    const rawCode = getRowCellByAliases(rawRow, ['Mã thiết bị', 'Mã thiết bị *', 'MaThietBi', 'MaTaiSan', 'Mã tài sản', 'code']);
    const rowClassHint = getRowCellByAliases(rawRow, ['Lớp', 'Lớp học', 'Lop', 'Mã lớp', 'MaLop', 'className']);
    const rawKind = getRowCellByAliases(rawRow, ['Loại thiết bị', 'LoaiThietBi', 'Danh mục', 'Danh mục *', 'Nhóm tài sản', 'NhomTaiSan', 'deviceKind', 'category']);
    const rawQty = getRowCellByAliases(rawRow, ['Số lượng *', 'Số lượng', 'SoLuong', 'quantity']);
    const rawUnit = getRowCellByAliases(rawRow, ['Đơn vị tính', 'DonViTinh', 'unit']);
    const rawWatts = getRowCellByAliases(rawRow, ['Công suất (W)', 'Công suất', 'CongSuat', 'CongSuatW', 'powerWatts']);
    const rawHours = getRowCellByAliases(rawRow, ['Giờ dùng/ngày', 'GioSuDung', 'GioDungNgay', 'dailyUsageHours']);
    const rawCond = getRowCellByAliases(rawRow, ['Tình trạng *', 'Tình trạng', 'TinhTrang', 'condition']);
    const rawStatus = getRowCellByAliases(rawRow, ['Trạng thái sử dụng', 'Trạng thái', 'TrangThai', 'status']);
    const rawRoom = getRowCellByAliases(rawRow, ['Vị trí / Phòng', 'Phòng / Vị trí *', 'Vị trí', 'ViTri', 'Phòng', 'roomLocation']);
    const rawNotes = getRowCellByAliases(rawRow, ['Ghi chú', 'GhiChu', 'notes']);

    // Skip blank trailing rows
    if (!name && !rawCode && !rawQty && !rawRoom) continue;

    const errors: string[] = [];

    // Resolve class strictly from row class column or sheet name (ignoring generic sheet names)
    const sheetClassToken = ['DATA', 'GOOGLESHEETS', 'SHEET1', 'TRANGTINH1'].includes(
      sheetName.toUpperCase()
    )
      ? ''
      : sheetName;
    const classCandidate = rowClassHint || sheetClassToken || fallbackClass?.name || '';
    const candidateNorm = normToken(classCandidate);

    const matchedClasses = classes.filter(
      (c) =>
        normToken(c.name) === candidateNorm ||
        normToken(c.code) === candidateNorm
    );
    const activeMatchedClass =
      matchedClasses.find(
        (c) => c.status !== 'inactive' && (!targetAcademicYear || targetAcademicYear === 'all' || c.academicYear === targetAcademicYear)
      ) || matchedClasses.find((c) => c.status !== 'inactive');
    const inactiveMatchedClass = !activeMatchedClass
      ? matchedClasses.find((c) => c.status === 'inactive')
      : undefined;

    if (!classCandidate) {
      errors.push('Thiếu mã/tên lớp (tên sheet hoặc cột Lớp).');
    } else if (inactiveMatchedClass) {
      inactiveClassSheetsSet.add(sheetName);
      errors.push(`Lớp "${classCandidate}" đã ngừng hoạt động.`);
    } else if (!activeMatchedClass) {
      unknownClassSheetsSet.add(sheetName);
      errors.push(`Mã/tên lớp "${classCandidate}" không tồn tại trong hệ thống.`);
    } else {
      matchedSheetsSet.add(sheetName);
    }

    if (!name || name.length < 2) {
      errors.push('Thiếu tên thiết bị hợp lệ.');
    }

    const qtyNum = Number(rawQty);
    if (!rawQty || !Number.isFinite(qtyNum) || qtyNum <= 0 || !Number.isInteger(qtyNum)) {
      errors.push('Số lượng phải là số nguyên dương (> 0).');
    }

    const wattsNum = rawWatts === '' ? undefined : Number(rawWatts);
    if (rawWatts !== '' && (!Number.isFinite(wattsNum) || (wattsNum ?? -1) < 0)) {
      errors.push('Công suất (W) phải là số >= 0.');
    }

    const hoursNum = rawHours === '' ? undefined : Number(rawHours);
    if (
      rawHours !== '' &&
      (!Number.isFinite(hoursNum) || (hoursNum ?? -1) < 0 || (hoursNum ?? 0) > 24)
    ) {
      errors.push('Giờ sử dụng/ngày phải nằm trong 0 - 24 giờ.');
    }

    const condition = normalizeConditionInput(rawCond);
    if (!condition) {
      errors.push(`Tình trạng "${rawCond}" không hợp lệ (chỉ nhận Tốt / Cần bảo trì / Hỏng hóc).`);
    }

    const resolvedClass = activeMatchedClass;
    const resolvedClassName = resolvedClass?.name || classCandidate || 'Chưa rõ';
    const resolvedRoomLocation =
      rawRoom || resolvedClass?.room || resolvedClassName;

    const deviceKind = inferDeviceKind(name, rawKind, rawKind);
    const effectiveCode =
      rawCode ||
      `TB-${resolvedClassName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}-${normToken(name).slice(0, 8).toUpperCase()}`;

    // Check duplicate inside uploaded file scoped to class
    const uploadDedupKey = rawCode
      ? `${normToken(resolvedClassName)}::CODE::${normToken(rawCode)}`
      : `${normToken(resolvedClassName)}::NAME::${normToken(name)}::${normToken(resolvedRoomLocation)}`;

    let isDuplicate = false;
    if (seenKeysInUpload.has(uploadDedupKey)) {
      isDuplicate = true;
      errors.push(`Dòng bị trùng thiết bị "${name}" (${effectiveCode}) trong cùng lớp ${resolvedClassName}.`);
    } else {
      seenKeysInUpload.add(uploadDedupKey);
    }

    if (errors.length > 0) {
      if (isDuplicate) duplicateCount += 1;
      else invalidCount += 1;
      rows.push({
        sheetName,
        rowNumber: origin.rowNumber,
        className: resolvedClassName,
        classId: resolvedClass?.id,
        status: isDuplicate ? 'duplicate' : 'invalid',
        errors,
        diffs: [],
      });
      continue;
    }

    // Safe scoped matching: ONLY match equipment belonging to the SAME class!
    const existingInSameClass = existingFacilities.find((f) => {
      if (!resolvedClass || !matchAssetToClass(f, resolvedClass)) return false;
      if (rawCode && normToken(f.code) === normToken(rawCode)) return true;
      return normToken(f.name) === normToken(name) && normToken(f.roomLocation) === normToken(resolvedRoomLocation);
    });

    // Guard: if code exists in ANOTHER class, reject to guarantee we never overwrite another class!
    const conflictOtherClass = rawCode
      ? existingFacilities.find(
          (f) =>
            normToken(f.code) === normToken(rawCode) &&
            resolvedClass &&
            !matchAssetToClass(f, resolvedClass)
        )
      : undefined;

    if (conflictOtherClass) {
      invalidCount += 1;
      rows.push({
        sheetName,
        rowNumber: origin.rowNumber,
        className: resolvedClassName,
        classId: resolvedClass?.id,
        status: 'invalid',
        errors: [
          `Mã thiết bị "${rawCode}" đang thuộc lớp/phòng "${conflictOtherClass.className || conflictOtherClass.roomLocation}" — không thể ghi đè chéo lớp.`,
        ],
        diffs: [],
      });
      continue;
    }

    const matchedRoom = rooms.find(
      (r) =>
        normToken(r.code) === normToken(resolvedRoomLocation) ||
        normToken(r.name) === normToken(resolvedRoomLocation)
    );

    const resolvedWatts =
      wattsNum !== undefined ? wattsNum : existingInSameClass?.powerWatts ?? inferDefaultPowerWatts(deviceKind);
    const resolvedHours =
      hoursNum !== undefined ? hoursNum : existingInSameClass?.dailyUsageHours ?? inferDefaultDailyHours(deviceKind);
    const resolvedStatus = rawStatus
      ? normalizeStatusInput(rawStatus)
      : existingInSameClass?.status || 'Đang sử dụng';

    const today = new Date().toISOString().split('T')[0];
    const safeDocId =
      existingInSameClass?.id ||
      `AST-${resolvedClassName.replace(/[^a-zA-Z0-9]/g, '')}-${effectiveCode.replace(/[^a-zA-Z0-9_-]/g, '')}-${Date.now().toString(36).slice(-4)}`;

    const entity: FacilityAsset = {
      ...(existingInSameClass || {}),
      id: safeDocId,
      code: existingInSameClass?.code || effectiveCode,
      name,
      category: inferCategoryFromDeviceKind(deviceKind, existingInSameClass?.category),
      deviceKind,
      quantity: qtyNum,
      unit: rawUnit || existingInSameClass?.unit || 'Cái',
      powerWatts: resolvedWatts,
      dailyUsageHours: resolvedHours,
      operatingDaysPerMonth:
        existingInSameClass?.operatingDaysPerMonth ?? DEFAULT_OPERATING_DAYS_PER_MONTH,
      classId: resolvedClass!.id,
      className: resolvedClass!.name,
      grade: resolvedClass!.grade,
      academicYear:
        resolvedClass!.academicYear ||
        (targetAcademicYear && targetAcademicYear !== 'all' ? targetAcademicYear : '2026 - 2027'),
      roomId: matchedRoom?.id || existingInSameClass?.roomId,
      roomLocation: resolvedRoomLocation,
      condition: condition!,
      status: resolvedStatus,
      smartControllable: isSmartControllableKind(deviceKind),
      smartState: existingInSameClass?.smartState || 'off',
      iotMode: existingInSameClass?.iotMode || 'simulated',
      lastInspected: existingInSameClass?.lastInspected || today,
      updatedAt: new Date().toISOString(),
      notes: rawNotes || existingInSameClass?.notes,
    };

    const diffs: string[] = [];
    if (existingInSameClass) {
      if ((existingInSameClass.quantity || 1) !== entity.quantity) {
        diffs.push(`SL: ${existingInSameClass.quantity || 1} → ${entity.quantity}`);
      }
      if ((existingInSameClass.powerWatts ?? 0) !== (entity.powerWatts ?? 0)) {
        diffs.push(`Công suất: ${existingInSameClass.powerWatts ?? 0}W → ${entity.powerWatts ?? 0}W`);
      }
      if (existingInSameClass.condition !== entity.condition) {
        diffs.push(`Tình trạng: ${existingInSameClass.condition} → ${entity.condition}`);
      }
      if (existingInSameClass.roomLocation !== entity.roomLocation) {
        diffs.push(`Vị trí: ${existingInSameClass.roomLocation} → ${entity.roomLocation}`);
      }
      validUpdateCount += 1;
      rows.push({
        sheetName,
        rowNumber: origin.rowNumber,
        className: resolvedClassName,
        classId: resolvedClass?.id,
        status: 'valid_update',
        errors: [],
        diffs: diffs.length > 0 ? diffs : ['Giữ nguyên thông tin hiện có'],
        entity,
      });
    } else {
      validCreateCount += 1;
      rows.push({
        sheetName,
        rowNumber: origin.rowNumber,
        className: resolvedClassName,
        classId: resolvedClass?.id,
        status: 'valid_create',
        errors: [],
        diffs: ['Thêm mới thiết bị vào lớp'],
        entity,
      });
    }

    entitiesToSave.push(entity);
  }

  return {
    totalRows: rows.length,
    validCreateCount,
    validUpdateCount,
    invalidCount,
    duplicateCount,
    matchedSheets: Array.from(matchedSheetsSet),
    unknownClassSheets: Array.from(unknownClassSheetsSet),
    inactiveClassSheets: Array.from(inactiveClassSheetsSet),
    rows,
    entitiesToSave,
  };
}

export function buildFacilitiesGoogleSheetsTsv(
  facilities: FacilityAsset[],
  classes: SchoolClass[] = []
): string {
  const headers = [
    'Lớp',
    'Năm học',
    'Mã thiết bị',
    'Tên thiết bị *',
    'Loại thiết bị',
    'Số lượng *',
    'Đơn vị tính',
    'Công suất (W)',
    'Giờ dùng/ngày',
    'Tiêu thụ (kWh/tháng)',
    'Tình trạng *',
    'Trạng thái sử dụng',
    'Vị trí / Phòng',
    'Ghi chú',
  ];

  const lines = [headers.join('\t')];
  for (const f of facilities) {
    const m = calculateAssetEnergyMetric(f, DEFAULT_ELECTRICITY_COST_PER_KWH, classes);
    const norm = normalizeFacilityAsset(f, classes);
    const cells = [
      norm.className || '',
      norm.academicYear || '',
      norm.code,
      norm.name,
      norm.deviceKind || 'Khác',
      String(norm.quantity || 1),
      norm.unit || 'Cái',
      String(norm.powerWatts ?? 0),
      String(norm.dailyUsageHours ?? 0),
      String(m.monthlyKwh),
      norm.condition,
      norm.status,
      norm.roomLocation,
      (norm.notes || '').replace(/[\t\r\n]+/g, ' '),
    ];
    lines.push(cells.join('\t'));
  }
  return lines.join('\n');
}

export function createFacilityActivityLog(params: {
  logType: FacilityActivityLog['logType'];
  summary: string;
  actorName: string;
  actorRole: UserRole;
  asset?: FacilityAsset;
  classId?: string;
  className?: string;
  fromClassName?: string;
  toClassName?: string;
  details?: string;
}): FacilityActivityLog {
  return {
    id: `FAL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    logType: params.logType,
    assetId: params.asset?.id,
    assetCode: params.asset?.code,
    assetName: params.asset?.name,
    classId: params.classId || params.asset?.classId,
    className: params.className || params.asset?.className,
    fromClassName: params.fromClassName,
    toClassName: params.toClassName,
    summary: params.summary.slice(0, 290),
    details: params.details,
    actorName: params.actorName,
    actorRole: params.actorRole,
    timestamp: new Date().toISOString(),
  };
}
