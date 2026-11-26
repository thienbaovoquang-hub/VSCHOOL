import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  FileSpreadsheet,
  Monitor,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wrench,
} from '../icons/UiIcons';
import type {
  AcademicYearConfig,
  ExportHistoryRecord,
  FacilityActivityLog,
  FacilityAsset,
  FacilityDeviceKind,
  SchoolClass,
  SchoolRoom,
  SystemSettings,
  UserProfile,
} from '../../types';
import { LiquidCard } from '../common/LiquidCard';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { EmptyState } from '../shared/EmptyState';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { ClassFacilitiesExcelModal } from './ClassFacilitiesExcelModal';
import {
  DEFAULT_ELECTRICITY_COST_PER_KWH,
  FACILITY_CONDITION_OPTIONS,
  FACILITY_DEVICE_KINDS,
  FACILITY_STATUS_OPTIONS,
  buildAdjustedQuantityFacilityAsset,
  buildTransferredFacilityAsset,
  calculateAssetEnergyMetric,
  createFacilityActivityLog,
  filterClassesForFacilities,
  filterFacilitiesByScope,
  getAvailableAcademicYearsForFacilities,
  inferCategoryFromDeviceKind,
  inferDefaultDailyHours,
  inferDefaultPowerWatts,
  normalizeFacilityAsset,
} from '../../utils/facilitiesEngine';

interface ClassFacilitiesPanelProps {
  currentUser: UserProfile;
  academicYears: AcademicYearConfig[];
  systemSettings?: SystemSettings;
  classes: SchoolClass[];
  rooms: SchoolRoom[];
  facilities: FacilityAsset[];
  canEdit: boolean;
  canDelete: boolean;
  onSaveFacility: (asset: FacilityAsset) => Promise<void> | void;
  onSaveFacilitiesBatch: (assets: FacilityAsset[]) => Promise<void>;
  onDeleteFacility: (assetId: string) => Promise<void> | void;
  onLogFacilityActivity?: (entry: FacilityActivityLog) => Promise<void>;
  onLogExport?: (record: ExportHistoryRecord) => Promise<void> | void;
  onQuickReportBroken: (asset: FacilityAsset) => void;
}

export const ClassFacilitiesPanel: React.FC<ClassFacilitiesPanelProps> = ({
  currentUser,
  academicYears,
  systemSettings,
  classes,
  rooms,
  facilities,
  canEdit,
  canDelete,
  onSaveFacility,
  onSaveFacilitiesBatch,
  onDeleteFacility,
  onLogFacilityActivity,
  onLogExport,
  onQuickReportBroken,
}) => {
  const availableYears = useMemo(
    () => getAvailableAcademicYearsForFacilities(academicYears, classes, facilities),
    [academicYears, classes, facilities]
  );

  const [selectedYear, setSelectedYear] = useState<string>(availableYears[0] || 'all');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedKind, setSelectedKind] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FacilityAsset | null>(null);
  const [transferAsset, setTransferAsset] = useState<FacilityAsset | null>(null);
  const [transferTargetClassId, setTransferTargetClassId] = useState('');
  const [pendingDeleteAsset, setPendingDeleteAsset] = useState<FacilityAsset | null>(null);

  const [formState, setFormState] = useState<{
    code: string;
    name: string;
    deviceKind: FacilityDeviceKind;
    quantity: number;
    unit: string;
    powerWatts: number;
    dailyUsageHours: number;
    classId: string;
    roomLocation: string;
    condition: FacilityAsset['condition'];
    status: FacilityAsset['status'];
    notes: string;
  }>({
    code: '',
    name: '',
    deviceKind: 'TV',
    quantity: 1,
    unit: 'Cái',
    powerWatts: 140,
    dailyUsageHours: 4,
    classId: '',
    roomLocation: '',
    condition: 'Tốt',
    status: 'Đang sử dụng',
    notes: '',
  });

  const activeClassesInScope = useMemo(
    () =>
      filterClassesForFacilities({
        classes,
        academicYear: selectedYear,
        grade: selectedGrade,
      }),
    [classes, selectedYear, selectedGrade]
  );

  const availableGrades = useMemo(() => {
    const yearClasses = filterClassesForFacilities({ classes, academicYear: selectedYear });
    const gSet = new Set(yearClasses.map((c) => c.grade));
    return Array.from(gSet).sort((a, b) => a - b);
  }, [classes, selectedYear]);

  const effectiveClassId =
    selectedClassId === 'all' || activeClassesInScope.some((c) => c.id === selectedClassId)
      ? selectedClassId
      : 'all';

  const scopedAssets = useMemo(
    () =>
      filterFacilitiesByScope({
        facilities,
        classes,
        academicYear: selectedYear,
        grade: selectedGrade,
        classId: effectiveClassId,
        deviceKind: selectedKind,
        search: searchQuery,
      }).map((f) => normalizeFacilityAsset(f, classes, rooms, selectedYear === 'all' ? undefined : selectedYear)),
    [facilities, classes, rooms, selectedYear, selectedGrade, effectiveClassId, selectedKind, searchQuery]
  );

  const scopedTotals = useMemo(() => {
    let totalQty = 0;
    let totalWatts = 0;
    let monthlyKwh = 0;
    let issueCount = 0;
    for (const a of scopedAssets) {
      const m = calculateAssetEnergyMetric(a, DEFAULT_ELECTRICITY_COST_PER_KWH, classes);
      totalQty += m.quantity;
      totalWatts += m.totalWatts;
      monthlyKwh += m.monthlyKwh;
      if (a.condition !== 'Tốt') issueCount += 1;
    }
    return {
      rows: scopedAssets.length,
      totalQty,
      totalWatts,
      monthlyKwh: Number(monthlyKwh.toFixed(1)),
      issueCount,
    };
  }, [scopedAssets, classes]);

  const openAddModal = () => {
    const targetCls =
      classes.find((c) => c.id === effectiveClassId) || activeClassesInScope[0];
    setEditingAsset(null);
    setFormState({
      code: `TB-${targetCls ? targetCls.name : 'SH'}-${String(facilities.length + 1).padStart(3, '0')}`,
      name: '',
      deviceKind: 'Quạt',
      quantity: 1,
      unit: 'Cái',
      powerWatts: inferDefaultPowerWatts('Quạt'),
      dailyUsageHours: inferDefaultDailyHours('Quạt'),
      classId: targetCls?.id || '',
      roomLocation: targetCls?.room || '',
      condition: 'Tốt',
      status: 'Đang sử dụng',
      notes: '',
    });
    setIsFormModalOpen(true);
  };

  const openEditModal = (asset: FacilityAsset) => {
    const norm = normalizeFacilityAsset(asset, classes, rooms);
    setEditingAsset(norm);
    setFormState({
      code: norm.code,
      name: norm.name,
      deviceKind: norm.deviceKind || 'Khác',
      quantity: norm.quantity || 1,
      unit: norm.unit || 'Cái',
      powerWatts: norm.powerWatts ?? 0,
      dailyUsageHours: norm.dailyUsageHours ?? 0,
      classId: norm.classId || '',
      roomLocation: norm.roomLocation,
      condition: norm.condition,
      status: norm.status,
      notes: norm.notes || '',
    });
    setIsFormModalOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name.trim()) return;
    const cls = classes.find((c) => c.id === formState.classId);
    const matchedRoom = rooms.find(
      (r) =>
        r.name.toLowerCase() === (formState.roomLocation || cls?.room || '').toLowerCase() ||
        r.code.toLowerCase() === (formState.roomLocation || cls?.room || '').toLowerCase()
    );

    const payload: FacilityAsset = {
      ...(editingAsset || {}),
      id: editingAsset?.id || `AST-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      code: formState.code.trim() || `TB-${Date.now().toString(36).slice(-5).toUpperCase()}`,
      name: formState.name.trim(),
      category: inferCategoryFromDeviceKind(formState.deviceKind, editingAsset?.category),
      deviceKind: formState.deviceKind,
      quantity: Math.max(1, Math.round(Number(formState.quantity) || 1)),
      unit: formState.unit.trim() || 'Cái',
      powerWatts: Math.max(0, Number(formState.powerWatts) || 0),
      dailyUsageHours: Math.min(24, Math.max(0, Number(formState.dailyUsageHours) || 0)),
      classId: cls?.id || editingAsset?.classId,
      className: cls?.name || editingAsset?.className,
      grade: cls?.grade || editingAsset?.grade,
      academicYear: cls?.academicYear || (selectedYear !== 'all' ? selectedYear : '2026 - 2027'),
      roomId: matchedRoom?.id || editingAsset?.roomId,
      roomLocation: formState.roomLocation.trim() || cls?.room || cls?.name || 'Phòng học',
      condition: formState.condition,
      status: formState.status,
      lastInspected: editingAsset?.lastInspected || new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString(),
      notes: formState.notes.trim() || undefined,
    };

    await onSaveFacility(payload);
    if (onLogFacilityActivity) {
      await onLogFacilityActivity(
        createFacilityActivityLog({
          logType: editingAsset ? 'equipment_update' : 'equipment_create',
          summary: `${editingAsset ? 'Cập nhật' : 'Thêm'} ${payload.name} (SL: ${payload.quantity}) tại ${payload.className || payload.roomLocation}`,
          actorName: currentUser.displayName,
          actorRole: currentUser.role,
          asset: payload,
        })
      );
    }
    setIsFormModalOpen(false);
    setEditingAsset(null);
  };

  const handleAdjustQuantity = async (asset: FacilityAsset, delta: number) => {
    const nextQty = Math.max(1, (asset.quantity || 1) + delta);
    if (nextQty === (asset.quantity || 1)) return;
    const updated = buildAdjustedQuantityFacilityAsset(asset, nextQty);
    await onSaveFacility(updated);
    if (onLogFacilityActivity) {
      await onLogFacilityActivity(
        createFacilityActivityLog({
          logType: 'equipment_update',
          summary: `Cập nhật SL ${asset.name} (${asset.className || asset.roomLocation}): ${asset.quantity || 1} → ${nextQty}`,
          actorName: currentUser.displayName,
          actorRole: currentUser.role,
          asset: updated,
        })
      );
    }
  };

  const handleConfirmTransfer = async () => {
    if (!transferAsset || !transferTargetClassId) return;
    const targetCls = classes.find((c) => c.id === transferTargetClassId);
    if (!targetCls) return;
    const updated = buildTransferredFacilityAsset({
      asset: transferAsset,
      targetClass: targetCls,
      rooms,
      actorName: currentUser.displayName,
    });
    await onSaveFacility(updated);
    if (onLogFacilityActivity) {
      await onLogFacilityActivity(
        createFacilityActivityLog({
          logType: 'equipment_transfer',
          summary: `Chuyển ${transferAsset.name} từ ${transferAsset.className || transferAsset.roomLocation} → ${targetCls.name} (${updated.roomLocation})`,
          actorName: currentUser.displayName,
          actorRole: currentUser.role,
          asset: updated,
          fromClassName: transferAsset.className || transferAsset.roomLocation,
          toClassName: targetCls.name,
        })
      );
    }
    setTransferAsset(null);
    setTransferTargetClassId('');
  };

  return (
    <div className="space-y-4">
      {/* Cascading Year -> Grade -> Class Filter + Actions */}
      <LiquidCard className="p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
            <select
              aria-label="Chọn Năm học"
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setSelectedGrade('all');
                setSelectedClassId('all');
              }}
              className="glass-subsurface rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer w-full sm:w-auto"
            >
              <option value="all">Tất cả năm học</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  Năm học {y}
                </option>
              ))}
            </select>

            <select
              aria-label="Chọn Khối"
              value={selectedGrade}
              onChange={(e) => {
                setSelectedGrade(e.target.value);
                setSelectedClassId('all');
              }}
              className="glass-subsurface rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer w-full sm:w-auto"
            >
              <option value="all">Tất cả khối</option>
              {availableGrades.map((g) => (
                <option key={g} value={String(g)}>
                  Khối {g}
                </option>
              ))}
            </select>

            <select
              aria-label="Chọn Lớp học"
              value={effectiveClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="glass-subsurface rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer w-full sm:w-auto"
            >
              <option value="all">Tất cả lớp ({activeClassesInScope.length})</option>
              {activeClassesInScope.map((c) => (
                <option key={c.id} value={c.id}>
                  Lớp {c.name} ({c.room})
                </option>
              ))}
            </select>

            <select
              aria-label="Loại thiết bị"
              value={selectedKind}
              onChange={(e) => setSelectedKind(e.target.value)}
              className="glass-subsurface rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer w-full sm:w-auto"
            >
              <option value="all">Mọi loại thiết bị</option>
              {FACILITY_DEVICE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>

            <div className="relative col-span-2 sm:col-span-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm thiết bị, phòng..."
                className="glass-subsurface rounded-xl pl-8 pr-3 py-2 text-xs text-slate-800 dark:text-slate-100 w-full sm:w-52"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsExcelModalOpen(true)}
              className="px-3.5 py-2 rounded-xl glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-100 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Excel / Sheets theo lớp
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={openAddModal}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" /> Thêm thiết bị lớp
              </button>
            )}
          </div>
        </div>

        {/* Concise Scoped KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
          <div className="px-3 py-2 rounded-xl bg-white/55 dark:bg-slate-800/45 border border-slate-200/70 dark:border-white/10">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Hạng mục thiết bị</span>
            <p className="font-mono-tabular text-base font-extrabold text-slate-900 dark:text-white">
              {scopedTotals.rows} <span className="text-xs font-semibold text-slate-500">({scopedTotals.totalQty} chiếc)</span>
            </p>
          </div>
          <div className="px-3 py-2 rounded-xl bg-white/55 dark:bg-slate-800/45 border border-slate-200/70 dark:border-white/10">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Tổng công suất</span>
            <p className="font-mono-tabular text-base font-extrabold text-sky-700 dark:text-sky-300">
              {scopedTotals.totalWatts.toLocaleString('vi-VN')} W
            </p>
          </div>
          <div className="px-3 py-2 rounded-xl bg-white/55 dark:bg-slate-800/45 border border-slate-200/70 dark:border-white/10">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Điện ước tính / tháng</span>
            <p className="font-mono-tabular text-base font-extrabold text-teal-700 dark:text-teal-300">
              {scopedTotals.monthlyKwh} kWh
            </p>
          </div>
          <div className="px-3 py-2 rounded-xl bg-white/55 dark:bg-slate-800/45 border border-slate-200/70 dark:border-white/10">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Cần bảo trì / Hỏng</span>
            <p className={`font-mono-tabular text-base font-extrabold ${scopedTotals.issueCount > 0 ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
              {scopedTotals.issueCount}
            </p>
          </div>
        </div>
      </LiquidCard>

      {/* Equipment Table for Scoped Class */}
      {scopedAssets.length === 0 ? (
        <EmptyState
          icon={Monitor}
          title="Lớp/phạm vi này chưa có thiết bị"
          description="Thêm TV, quạt, đèn, điều hòa, máy tính, máy chiếu hoặc nhập nhanh bằng mẫu Excel theo lớp."
          action={
            canEdit ? (
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={openAddModal}
                  className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Thêm thiết bị
                </button>
                <button
                  type="button"
                  onClick={() => setIsExcelModalOpen(true)}
                  className="px-4 py-2 rounded-xl glass-subsurface text-slate-800 dark:text-slate-100 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Nhập Excel / Sheets
                </button>
              </div>
            ) : null
          }
        />
      ) : (
        <div className="glass-table-shell">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="glass-table-head">
                <tr>
                  <th className="px-3.5 py-3">Thiết bị</th>
                  <th className="px-3.5 py-3">Lớp / Vị trí</th>
                  <th className="px-3.5 py-3 text-center">Số lượng</th>
                  <th className="px-3.5 py-3">Công suất</th>
                  <th className="px-3.5 py-3">Tiêu thụ (ước tính)</th>
                  <th className="px-3.5 py-3">Tình trạng</th>
                  <th className="px-3.5 py-3">Ghi chú</th>
                  <th className="px-3.5 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/25 dark:divide-white/10">
                {scopedAssets.map((asset) => {
                  const energy = calculateAssetEnergyMetric(asset, DEFAULT_ELECTRICITY_COST_PER_KWH, classes);
                  return (
                    <tr key={asset.id} className="glass-table-row">
                      <td className="px-3.5 py-3">
                        <div className="font-bold text-slate-900 dark:text-white">{asset.name}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-tabular mt-0.5">
                          {asset.code} · {asset.deviceKind || 'Khác'}
                        </div>
                      </td>
                      <td className="px-3.5 py-3">
                        <span className="font-bold text-teal-700 dark:text-teal-300">
                          {asset.className ? `Lớp ${asset.className}` : 'Dùng chung'}
                        </span>
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                          {asset.roomLocation}
                        </span>
                      </td>
                      <td className="px-3.5 py-3">
                        <div className="inline-flex items-center gap-1.5">
                          {canEdit && (
                            <button
                              type="button"
                              aria-label={`Giảm số lượng ${asset.name}`}
                              onClick={() => void handleAdjustQuantity(asset, -1)}
                              className="w-6 h-6 rounded-lg glass-subsurface font-bold hover:bg-white/80 dark:hover:bg-slate-700 cursor-pointer"
                            >
                              -
                            </button>
                          )}
                          <span className="font-mono-tabular font-bold min-w-[2.5rem] text-center text-slate-900 dark:text-white">
                            {asset.quantity || 1} {asset.unit || 'cái'}
                          </span>
                          {canEdit && (
                            <button
                              type="button"
                              aria-label={`Tăng số lượng ${asset.name}`}
                              onClick={() => void handleAdjustQuantity(asset, 1)}
                              className="w-6 h-6 rounded-lg glass-subsurface font-bold hover:bg-white/80 dark:hover:bg-slate-700 cursor-pointer"
                            >
                              +
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3.5 py-3 font-mono-tabular text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {energy.powerWattsPerUnit}W / cái
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                          Tổng {energy.totalWatts}W
                        </span>
                      </td>
                      <td className="px-3.5 py-3 font-mono-tabular text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {energy.monthlyKwh} kWh/tháng
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                          ~{energy.dailyKwh} kWh/ngày ({energy.dailyUsageHours}h)
                        </span>
                      </td>
                      <td className="px-3.5 py-3">
                        <Badge
                          variant={
                            asset.condition === 'Tốt'
                              ? 'mint'
                              : asset.condition === 'Cần bảo trì'
                              ? 'amber'
                              : 'pink'
                          }
                          size="sm"
                        >
                          {asset.condition}
                        </Badge>
                      </td>
                      <td className="px-3.5 py-3 text-slate-600 dark:text-slate-300 max-w-[160px] truncate">
                        {asset.notes || '—'}
                      </td>
                      <td className="px-3.5 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {canEdit && (
                            <button
                              type="button"
                              title="Chuyển lớp"
                              aria-label={`Chuyển lớp ${asset.name}`}
                              onClick={() => {
                                setTransferAsset(asset);
                                setTransferTargetClassId('');
                              }}
                              className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/15 cursor-pointer"
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            title="Báo hỏng / Cần bảo trì"
                            aria-label={`Báo hỏng ${asset.name}`}
                            onClick={() => onQuickReportBroken(asset)}
                            className="p-1.5 rounded-lg text-amber-600 dark:text-amber-300 hover:bg-amber-500/15 cursor-pointer"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              title="Sửa thiết bị"
                              aria-label={`Sửa ${asset.name}`}
                              onClick={() => openEditModal(asset)}
                              className="p-1.5 rounded-lg text-sky-600 dark:text-sky-400 hover:bg-sky-500/15 cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              title="Xóa thiết bị"
                              aria-label={`Xóa ${asset.name}`}
                              onClick={() => setPendingDeleteAsset(asset)}
                              className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Asset Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingAsset ? 'Cập nhật thiết bị lớp học' : 'Thêm thiết bị cho lớp học'}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveForm} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Lớp sử dụng
              </label>
              <select
                value={formState.classId}
                onChange={(e) => {
                  const cls = classes.find((c) => c.id === e.target.value);
                  setFormState((prev) => ({
                    ...prev,
                    classId: e.target.value,
                    roomLocation: cls?.room || prev.roomLocation,
                  }));
                }}
                className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
              >
                <option value="">-- Dùng chung toàn trường --</option>
                {filterClassesForFacilities({ classes, includeInactive: false }).map((c) => (
                  <option key={c.id} value={c.id}>
                    Lớp {c.name} ({c.room}) · {c.academicYear}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Vị trí / Phòng *
              </label>
              <input
                type="text"
                required
                value={formState.roomLocation}
                onChange={(e) => setFormState((prev) => ({ ...prev, roomLocation: e.target.value }))}
                placeholder="VD: P.101"
                className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Loại thiết bị
              </label>
              <select
                value={formState.deviceKind}
                onChange={(e) => {
                  const kind = e.target.value as FacilityDeviceKind;
                  setFormState((prev) => ({
                    ...prev,
                    deviceKind: kind,
                    powerWatts: editingAsset ? prev.powerWatts : inferDefaultPowerWatts(kind),
                    dailyUsageHours: editingAsset ? prev.dailyUsageHours : inferDefaultDailyHours(kind),
                  }));
                }}
                className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
              >
                {FACILITY_DEVICE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Tên thiết bị *
              </label>
              <input
                type="text"
                required
                value={formState.name}
                onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="VD: Smart TV 65 inch, Quạt trần Panasonic..."
                className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Mã thiết bị
              </label>
              <input
                type="text"
                value={formState.code}
                onChange={(e) => setFormState((prev) => ({ ...prev, code: e.target.value }))}
                className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Số lượng *
              </label>
              <input
                type="number"
                min={1}
                required
                value={formState.quantity}
                onChange={(e) => setFormState((prev) => ({ ...prev, quantity: Number(e.target.value) || 1 }))}
                className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Công suất (W)
              </label>
              <input
                type="number"
                min={0}
                value={formState.powerWatts}
                onChange={(e) => setFormState((prev) => ({ ...prev, powerWatts: Number(e.target.value) || 0 }))}
                className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Giờ dùng / ngày
              </label>
              <input
                type="number"
                min={0}
                max={24}
                step="0.5"
                value={formState.dailyUsageHours}
                onChange={(e) => setFormState((prev) => ({ ...prev, dailyUsageHours: Number(e.target.value) || 0 }))}
                className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 font-mono-tabular"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Tình trạng
              </label>
              <select
                value={formState.condition}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    condition: e.target.value as FacilityAsset['condition'],
                  }))
                }
                className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
              >
                {FACILITY_CONDITION_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Trạng thái
              </label>
              <select
                value={formState.status}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    status: e.target.value as FacilityAsset['status'],
                  }))
                }
                className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
              >
                {FACILITY_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Đơn vị tính
              </label>
              <input
                type="text"
                value={formState.unit}
                onChange={(e) => setFormState((prev) => ({ ...prev, unit: e.target.value }))}
                className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
              Ghi chú
            </label>
            <input
              type="text"
              value={formState.notes}
              onChange={(e) => setFormState((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Ghi chú lắp đặt, bảo hành..."
              className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700/70">
            <button
              type="button"
              onClick={() => setIsFormModalOpen(false)}
              className="px-4 py-2 rounded-xl glass-subsurface font-semibold cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer"
            >
              {editingAsset ? 'Lưu cập nhật' : 'Thêm thiết bị'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Transfer to Another Class Modal */}
      <Modal
        isOpen={Boolean(transferAsset)}
        onClose={() => setTransferAsset(null)}
        title="Điều chuyển thiết bị sang lớp khác"
        maxWidth="sm"
      >
        {transferAsset && (
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl glass-subsurface space-y-1">
              <p className="font-bold text-slate-900 dark:text-white">{transferAsset.name}</p>
              <p className="text-slate-600 dark:text-slate-300">
                Hiện tại: <strong>{transferAsset.className || 'Dùng chung'}</strong> ({transferAsset.roomLocation}) · SL: {transferAsset.quantity || 1}
              </p>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Chuyển đến lớp *
              </label>
              <select
                value={transferTargetClassId}
                onChange={(e) => setTransferTargetClassId(e.target.value)}
                className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
              >
                <option value="">-- Chọn lớp nhận --</option>
                {filterClassesForFacilities({ classes, includeInactive: false })
                  .filter((c) => c.id !== transferAsset.classId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      Lớp {c.name} ({c.room}) · {c.academicYear}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <AlertCircle className="w-4 h-4 text-sky-500 shrink-0" />
              <span>Hệ thống tự động cập nhật phòng học, khối và ghi lại lịch sử điều chuyển.</span>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/70">
              <button
                type="button"
                onClick={() => setTransferAsset(null)}
                className="px-3.5 py-2 rounded-xl glass-subsurface font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={!transferTargetClassId}
                onClick={() => void handleConfirmTransfer()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold cursor-pointer"
              >
                Xác nhận chuyển lớp
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(pendingDeleteAsset)}
        title="Xóa thiết bị khỏi lớp"
        message={`Xác nhận xóa "${pendingDeleteAsset?.name}" khỏi lớp ${pendingDeleteAsset?.className || pendingDeleteAsset?.roomLocation}?`}
        confirmLabel="Xóa thiết bị"
        onConfirm={() => {
          if (pendingDeleteAsset) void onDeleteFacility(pendingDeleteAsset.id);
          setPendingDeleteAsset(null);
        }}
        onCancel={() => setPendingDeleteAsset(null)}
      />

      <ClassFacilitiesExcelModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        currentUser={currentUser}
        academicYears={academicYears}
        selectedAcademicYear={selectedYear}
        selectedGrade={selectedGrade}
        selectedClassId={effectiveClassId}
        classes={classes}
        rooms={rooms}
        facilities={facilities}
        systemSettings={systemSettings}
        canEdit={canEdit}
        onCommitBatch={onSaveFacilitiesBatch}
        onLogFacilityActivity={onLogFacilityActivity}
        onLogExport={onLogExport}
      />
    </div>
  );
};
