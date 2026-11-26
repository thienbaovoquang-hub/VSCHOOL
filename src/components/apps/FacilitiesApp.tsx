import React, { useState, useMemo } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Cpu,
  DoorOpen,
  FileSpreadsheet,
  History,
  Link2,
  Monitor,
  Pencil,
  Plus,
  Trash2,
  Wrench,
  Zap,
} from '../icons/UiIcons';
import {
  AcademicYearConfig,
  DataSourceConfig,
  DataSourceGroupKey,
  DataSourceMethod,
  ExportHistoryRecord,
  FacilityActivityLog,
  FacilityAsset,
  FacilityMeterReading,
  FacilitySmartConfig,
  ImportHistoryRecord,
  ImportModuleKey,
  MaintenanceRequest,
  PermissionMatrix,
  SchoolClass,
  SchoolRoom,
  SystemSettings,
  UserProfile,
} from '../../types';
import { AppWindowShell } from '../shared/AppWindowShell';
import { EmptyState } from '../shared/EmptyState';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { BulkSelectionBar } from '../shared/BulkSelectionBar';
import { LiquidCard } from '../common/LiquidCard';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { ModuleDataActions } from '../importExport/ModuleDataActions';
import { DataSourceButton } from '../dataSources/DataSourceButton';
import { DataSourceModal } from '../dataSources/DataSourceModal';
import type {
  DataSourceExistingData,
  DataSourceRuntimeContext,
  GroupValidationResult,
} from '../../utils/dataSources/templateEngine';
import { UnifiedManualFormModal } from '../importExport/UnifiedManualFormModal';
import type { ValidationDbContext } from '../../utils/importExport/validator';
import { resolveCatalogOptions } from '../../utils/catalogs/catalogRegistry';
import { DEFAULT_PERMISSIONS, hasPermission } from '../../utils/rbac';
import { formatDateTimeSafe } from '../../utils/crossAppSync';
import {
  areAllVisibleSelected,
  pruneStaleSelectedIds,
  toggleSelectAllVisible,
  toggleSelectedId,
} from '../../utils/bulkSelection';
import {
  DEFAULT_ELECTRICITY_COST_PER_KWH,
  FACILITY_DEVICE_KINDS,
  calculateAssetEnergyMetric,
  calculateFacilityEnergySummary,
  createFacilityActivityLog,
  inferDeviceKind,
  normalizeFacilityAsset,
} from '../../utils/facilitiesEngine';
import { ClassFacilitiesPanel } from '../facilities/ClassFacilitiesPanel';
import { FacilityEnergyPanel } from '../facilities/FacilityEnergyPanel';
import { SmartControlPanel } from '../facilities/SmartControlPanel';
import { ClassFacilitiesExcelModal } from '../facilities/ClassFacilitiesExcelModal';

interface FacilitiesAppProps {
  activeTab: string;
  currentUser: UserProfile;
  customPermissions?: PermissionMatrix;
  validationContext?: ValidationDbContext;
  academicYears?: AcademicYearConfig[];
  systemSettings?: SystemSettings;
  classes: SchoolClass[];
  rooms: SchoolRoom[];
  facilities: FacilityAsset[];
  facilityMeterReadings?: FacilityMeterReading[];
  facilitySmartConfigs?: FacilitySmartConfig[];
  facilityActivityLogs?: FacilityActivityLog[];
  maintenanceRequests: MaintenanceRequest[];
  dataSourceConfigs?: DataSourceConfig[];
  isAdmin?: boolean;
  dataSourceRuntimeContext?: DataSourceRuntimeContext;
  dataSourceExistingData?: DataSourceExistingData;
  onSaveDataSourceConfig?: (cfg: DataSourceConfig) => Promise<void>;
  onDeleteDataSourceConfig?: (id: string) => Promise<void>;
  onCommitNormalizedGroupData?: (
    groupKey: DataSourceGroupKey,
    validation: GroupValidationResult,
    sourceMeta: { method: DataSourceMethod; sourceName: string }
  ) => Promise<{ createdCount: number; updatedCount: number }>;
  onSelectTab: (tabId: string) => void;
  onSaveRoom: (room: SchoolRoom) => void;
  onDeleteRoom: (roomId: string) => void;
  onDeleteRooms?: (roomIds: string[]) => Promise<void> | void;
  onSaveFacility: (asset: FacilityAsset) => void;
  onSaveFacilitiesBatch?: (assets: FacilityAsset[]) => Promise<void>;
  onDeleteFacility: (assetId: string) => void;
  onDeleteFacilities?: (assetIds: string[]) => Promise<void> | void;
  onSaveMeterReading?: (reading: FacilityMeterReading) => Promise<void>;
  onDeleteMeterReading?: (readingId: string) => Promise<void>;
  onSaveSmartConfig?: (cfg: FacilitySmartConfig) => Promise<void>;
  onLogFacilityActivity?: (entry: FacilityActivityLog) => Promise<void>;
  onSubmitMaintenance: (req: MaintenanceRequest) => Promise<void>;
  onUnifiedImportCommit?: (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => Promise<void> | void;
  onLogExport?: (record: ExportHistoryRecord) => Promise<void> | void;
}

export const FacilitiesApp: React.FC<FacilitiesAppProps> = ({
  activeTab,
  currentUser,
  customPermissions = DEFAULT_PERMISSIONS,
  validationContext = {},
  academicYears = [],
  systemSettings,
  classes,
  rooms,
  facilities,
  facilityMeterReadings = [],
  facilitySmartConfigs = [],
  facilityActivityLogs = [],
  maintenanceRequests,
  dataSourceConfigs = [],
  isAdmin = false,
  dataSourceRuntimeContext,
  dataSourceExistingData,
  onSaveDataSourceConfig,
  onDeleteDataSourceConfig,
  onCommitNormalizedGroupData,
  onSelectTab,
  onSaveRoom,
  onDeleteRoom,
  onDeleteRooms,
  onSaveFacility,
  onSaveFacilitiesBatch,
  onDeleteFacility,
  onDeleteFacilities,
  onSaveMeterReading,
  onDeleteMeterReading,
  onSaveSmartConfig,
  onLogFacilityActivity,
  onSubmitMaintenance,
  onUnifiedImportCommit,
  onLogExport,
}) => {
  const canManageAssets = hasPermission(currentUser.role, 'facilities', 'edit', customPermissions);
  const canDeleteAssets = hasPermission(currentUser.role, 'facilities', 'delete', customPermissions);
  const isPureStudent =
    currentUser.role === 'student' && (!currentUser.secondaryRoles || currentUser.secondaryRoles.length === 0);

  // Room Modal (UnifiedManualFormModal)
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<SchoolRoom | null>(null);
  const [pendingDeleteRoom, setPendingDeleteRoom] = useState<SchoolRoom | null>(null);

  // Asset Modal (UnifiedManualFormModal)
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FacilityAsset | null>(null);
  const [pendingDeleteAsset, setPendingDeleteAsset] = useState<FacilityAsset | null>(null);
  const [assetConditionFilter, setAssetConditionFilter] = useState('all');
  const [assetKindFilter, setAssetKindFilter] = useState('all');

  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [pendingBulkRoomIds, setPendingBulkRoomIds] = useState<string[] | null>(null);
  const [isBulkDeletingRooms, setIsBulkDeletingRooms] = useState(false);

  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [pendingBulkAssetIds, setPendingBulkAssetIds] = useState<string[] | null>(null);
  const [isBulkDeletingAssets, setIsBulkDeletingAssets] = useState(false);
  const [isDataSourceOpen, setIsDataSourceOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isQuickExcelOpen, setIsQuickExcelOpen] = useState(false);

  // Broken & Maintenance unified sub-tab
  const [brokenSubTab, setBrokenSubTab] = useState<'report' | 'tickets'>(
    canManageAssets ? 'tickets' : 'report'
  );
  const [maintenanceFilter, setMaintenanceFilter] = useState<'all' | 'open' | 'completed'>('all');
  const [brokenForm, setBrokenForm] = useState<{
    assetId: string;
    assetName: string;
    roomLocation: string;
    issueDescription: string;
    priority: MaintenanceRequest['priority'];
  }>({
    assetId: '',
    assetName: '',
    roomLocation: '',
    issueDescription: '',
    priority: 'medium',
  });
  const [brokenSuccess, setBrokenSuccess] = useState(false);

  const conditionOptions = useMemo(
    () => resolveCatalogOptions({ catalogId: 'facility_condition', runtime: validationContext }),
    [validationContext]
  );

  const priorityOptions = useMemo(
    () => resolveCatalogOptions({ catalogId: 'priority_level', runtime: validationContext }),
    [validationContext]
  );

  const openTickets = maintenanceRequests.filter((m) => m.status !== 'completed');
  const completedTickets = maintenanceRequests.filter((m) => m.status === 'completed');

  const normalizedFacilities = useMemo(
    () => facilities.map((f) => normalizeFacilityAsset(f, classes, rooms)),
    [facilities, classes, rooms]
  );

  const filteredFacilities = useMemo(() => {
    return normalizedFacilities.filter((f) => {
      if (assetConditionFilter !== 'all' && f.condition !== assetConditionFilter) return false;
      const kind = inferDeviceKind(f.name, f.category, f.deviceKind);
      if (assetKindFilter !== 'all' && kind !== assetKindFilter) return false;
      return true;
    });
  }, [normalizedFacilities, assetConditionFilter, assetKindFilter]);

  const filteredMaintenance = useMemo(() => {
    if (maintenanceFilter === 'open') return openTickets;
    if (maintenanceFilter === 'completed') return completedTickets;
    return maintenanceRequests;
  }, [maintenanceRequests, openTickets, completedTickets, maintenanceFilter]);

  // Overview stats: energy, device kinds, grades, condition
  const overviewStats = useMemo(() => {
    const energy = calculateFacilityEnergySummary({
      facilities: normalizedFacilities,
      classes,
      meterReadings: facilityMeterReadings,
      costPerKwh: DEFAULT_ELECTRICITY_COST_PER_KWH,
    });

    const kindMap = new Map<string, { items: number; qty: number; faulty: number }>();
    for (const f of normalizedFacilities) {
      const k = f.deviceKind || 'Khác';
      const curr = kindMap.get(k) || { items: 0, qty: 0, faulty: 0 };
      curr.items += 1;
      curr.qty += f.quantity || 1;
      if (f.condition !== 'Tốt') curr.faulty += 1;
      kindMap.set(k, curr);
    }

    const totalUnitQty = normalizedFacilities.reduce((s, f) => s + (f.quantity || 1), 0);
    const activeClassCount = classes.filter((c) => c.status !== 'inactive').length;

    return {
      energy,
      totalUnitQty,
      activeClassCount,
      kindBreakdown: Array.from(kindMap.entries()).sort((a, b) => b[1].qty - a[1].qty),
      faultyCount: normalizedFacilities.filter((f) => f.condition !== 'Tốt').length,
    };
  }, [normalizedFacilities, classes, facilityMeterReadings]);

  // Derived room telemetry (equipment count & open issues per room)
  const roomSummaries = useMemo(() => {
    return rooms.map((rm) => {
      const assetCount = normalizedFacilities.filter(
        (f) =>
          f.roomLocation.toLowerCase() === rm.name.toLowerCase() ||
          f.roomLocation.toLowerCase() === rm.code.toLowerCase()
      ).length;
      const openIssues = openTickets.filter(
        (m) =>
          m.roomLocation.toLowerCase() === rm.name.toLowerCase() ||
          m.roomLocation.toLowerCase() === rm.code.toLowerCase()
      ).length;
      return { room: rm, assetCount, openIssues };
    });
  }, [rooms, normalizedFacilities, openTickets]);

  const effectiveSelectedRoomIds = useMemo(
    () => pruneStaleSelectedIds(selectedRoomIds, rooms.map((r) => r.id)),
    [selectedRoomIds, rooms]
  );
  const visibleRoomIds = useMemo(() => roomSummaries.map((r) => r.room.id), [roomSummaries]);

  const effectiveSelectedAssetIds = useMemo(
    () => pruneStaleSelectedIds(selectedAssetIds, facilities.map((f) => f.id)),
    [selectedAssetIds, facilities]
  );
  const visibleAssetIds = useMemo(
    () => filteredFacilities.map((f) => f.id),
    [filteredFacilities]
  );

  const handleConfirmBulkDeleteRooms = async () => {
    if (!pendingBulkRoomIds || pendingBulkRoomIds.length === 0) return;
    setIsBulkDeletingRooms(true);
    try {
      if (onDeleteRooms) {
        await onDeleteRooms(pendingBulkRoomIds);
      } else {
        for (const id of pendingBulkRoomIds) await onDeleteRoom(id);
      }
      const deletedSet = new Set(pendingBulkRoomIds);
      setSelectedRoomIds((prev) => prev.filter((id) => !deletedSet.has(id)));
    } finally {
      setIsBulkDeletingRooms(false);
      setPendingBulkRoomIds(null);
    }
  };

  const handleConfirmBulkDeleteAssets = async () => {
    if (!pendingBulkAssetIds || pendingBulkAssetIds.length === 0) return;
    setIsBulkDeletingAssets(true);
    try {
      if (onDeleteFacilities) {
        await onDeleteFacilities(pendingBulkAssetIds);
      } else {
        for (const id of pendingBulkAssetIds) await onDeleteFacility(id);
      }
      const deletedSet = new Set(pendingBulkAssetIds);
      setSelectedAssetIds((prev) => prev.filter((id) => !deletedSet.has(id)));
    } finally {
      setIsBulkDeletingAssets(false);
      setPendingBulkAssetIds(null);
    }
  };

  const openCreateRoom = () => {
    setEditingRoom(null);
    setIsRoomModalOpen(true);
  };

  const openEditRoom = (rm: SchoolRoom) => {
    setEditingRoom(rm);
    setIsRoomModalOpen(true);
  };

  const openCreateAsset = () => {
    setEditingAsset(null);
    setIsAssetModalOpen(true);
  };

  const openEditAsset = (asset: FacilityAsset) => {
    setEditingAsset(asset);
    setIsAssetModalOpen(true);
  };

  const handleQuickReportFromClass = (asset: FacilityAsset) => {
    setBrokenForm({
      assetId: asset.id,
      assetName: asset.name,
      roomLocation: asset.roomLocation || asset.className || '',
      issueDescription: '',
      priority: 'high',
    });
    setBrokenSubTab('report');
    onSelectTab('broken');
  };

  const handleReportBroken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brokenForm.assetName.trim() || !brokenForm.issueDescription.trim()) return;
    const code = `MNT-${new Date().getFullYear()}-${String(maintenanceRequests.length + 1).padStart(3, '0')}`;
    await onSubmitMaintenance({
      id: code,
      requestCode: code,
      ...(brokenForm.assetId ? { assetId: brokenForm.assetId } : {}),
      assetName: brokenForm.assetName.trim(),
      roomLocation: brokenForm.roomLocation.trim() || 'Phòng học',
      reportedBy: currentUser.displayName,
      reporterRole: currentUser.role,
      issueDescription: brokenForm.issueDescription.trim(),
      priority: brokenForm.priority,
      status: 'reported',
      reportedAt: new Date().toISOString().split('T')[0],
    });
    if (onLogFacilityActivity) {
      await onLogFacilityActivity(
        createFacilityActivityLog({
          logType: 'equipment_update',
          summary: `Báo hỏng ${brokenForm.assetName.trim()} tại ${brokenForm.roomLocation.trim() || 'Phòng học'}`,
          actorName: currentUser.displayName,
          actorRole: currentUser.role,
        })
      );
    }
    setBrokenForm({ assetId: '', assetName: '', roomLocation: '', issueDescription: '', priority: 'medium' });
    setBrokenSuccess(true);
    setTimeout(() => setBrokenSuccess(false), 3000);
  };

  const nextMaintenanceStatus = (status: MaintenanceRequest['status']): MaintenanceRequest['status'] => {
    if (status === 'reported') return 'assigned';
    if (status === 'assigned') return 'in_repair';
    return 'completed';
  };

  const saveBatchFallback = async (items: FacilityAsset[]) => {
    if (onSaveFacilitiesBatch) {
      await onSaveFacilitiesBatch(items);
    } else {
      for (const item of items) {
        await onSaveFacility(item);
      }
    }
  };

  return (
    <AppWindowShell
      appId="facilities"
      activeTab={activeTab}
      userRole={currentUser.role}
      userProfile={currentUser}
      customPermissions={customPermissions}
      onSelectTab={onSelectTab}
    >
      {(tabId) => (
        <>
          {/* ===================== 1. TỔNG QUAN ===================== */}
          {tabId === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <LiquidCard className="p-4">
                  <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Tổng thiết bị toàn trường
                  </p>
                  <p className="font-mono-tabular text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                    {overviewStats.totalUnitQty}
                    <span className="text-xs font-semibold text-slate-500 ml-1.5">
                      ({facilities.length} mã)
                    </span>
                  </p>
                </LiquidCard>
                <LiquidCard className="p-4">
                  <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Lớp học & Phòng
                  </p>
                  <p className="font-mono-tabular text-2xl font-extrabold text-teal-700 dark:text-teal-300 mt-1">
                    {overviewStats.activeClassCount} lớp · {rooms.length} phòng
                  </p>
                </LiquidCard>
                <LiquidCard className="p-4">
                  <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Điện năng tháng ({overviewStats.energy.hasAnyMeterReading ? 'Có công tơ' : 'Ước tính'})
                  </p>
                  <p className="font-mono-tabular text-2xl font-extrabold text-sky-700 dark:text-sky-300 mt-1">
                    {overviewStats.energy.effectiveMonthlyKwh.toLocaleString('vi-VN')} kWh
                  </p>
                </LiquidCard>
                <LiquidCard className="p-4">
                  <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Bảo trì & Thiết bị lỗi
                  </p>
                  <p className={`font-mono-tabular text-2xl font-extrabold mt-1 ${openTickets.length + overviewStats.faultyCount > 0 ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
                    {openTickets.length} phiếu · {overviewStats.faultyCount} lỗi
                  </p>
                </LiquidCard>
              </div>

              {/* Quick Navigation Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => onSelectTab('by-class')}
                  className="text-left p-4 rounded-2xl glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/75 transition-all flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div>
                    <p className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-teal-600" /> Quản lý theo lớp & Excel
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Lọc Năm học → Khối → Lớp, điều chuyển, nhập/xuất bảng tính
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => onSelectTab('energy')}
                  className="text-left p-4 rounded-2xl glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/75 transition-all flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div>
                    <p className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-500" /> Điện năng tiêu thụ
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Theo dõi kWh, chi phí ước tính và chỉ số công tơ
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => onSelectTab('smart-control')}
                  className="text-left p-4 rounded-2xl glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/75 transition-all flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div>
                    <p className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-sky-600" /> Điều khiển thông minh
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Giám sát nhiệt độ, ánh sáng & đề xuất bật/tắt (Mô phỏng)
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              </div>

              {/* Statistics Grid: By Device Kind + By Grade */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <LiquidCard className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Thống kê theo loại thiết bị
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsQuickExcelOpen(true)}
                      className="text-[11px] font-bold text-teal-700 dark:text-teal-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" /> Nhập/Xuất theo lớp
                    </button>
                  </div>
                  {overviewStats.kindBreakdown.length === 0 ? (
                    <p className="text-xs text-slate-500">Chưa có thiết bị nào được ghi nhận.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {overviewStats.kindBreakdown.map(([kind, st]) => (
                        <div key={kind} className="p-3 rounded-xl glass-subsurface text-xs">
                          <p className="font-bold text-slate-900 dark:text-white truncate">{kind}</p>
                          <p className="font-mono-tabular text-lg font-extrabold text-teal-700 dark:text-teal-300 mt-0.5">
                            {st.qty}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            {st.items} hạng mục{st.faulty > 0 ? ` · ${st.faulty} cần xử lý` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </LiquidCard>

                <LiquidCard className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Thống kê theo Khối & Điện năng
                    </h3>
                    <span className="text-[11px] text-slate-500">
                      {overviewStats.energy.byClass.length} lớp có thiết bị
                    </span>
                  </div>
                  {overviewStats.energy.byGrade.length === 0 ? (
                    <p className="text-xs text-slate-500">Chưa có dữ liệu phân bổ theo khối.</p>
                  ) : (
                    <div className="space-y-2">
                      {overviewStats.energy.byGrade.map((g) => (
                        <div
                          key={g.key}
                          className="p-2.5 rounded-xl glass-subsurface flex items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">{g.label}</span>
                            <span className="text-[11px] text-slate-500 ml-2">
                              {g.totalQuantity} thiết bị · {g.totalWatts.toLocaleString('vi-VN')}W
                            </span>
                          </div>
                          <span className="font-mono-tabular font-bold text-sky-700 dark:text-sky-300">
                            {g.effectiveMonthlyKwh} kWh/tháng
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </LiquidCard>
              </div>

              {/* Open Maintenance + Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <LiquidCard className="p-4 sm:p-5 space-y-2.5">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Sự cố đang chờ xử lý ({openTickets.length})
                  </h3>
                  {openTickets.length > 0 ? (
                    openTickets.slice(0, 4).map((t) => (
                      <div
                        key={t.id}
                        className="p-3 rounded-xl glass-subsurface flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white truncate">
                            {t.assetName} — {t.roomLocation}
                          </p>
                          <p className="text-slate-600 dark:text-slate-300 mt-0.5 truncate">{t.issueDescription}</p>
                        </div>
                        <Badge variant="amber" size="sm">{t.status}</Badge>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 rounded-xl glass-subsurface text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Cơ sở vật chất đang vận hành ổn định, chưa có phiếu báo hỏng chờ xử lý.</span>
                    </div>
                  )}
                </LiquidCard>

                <LiquidCard className="p-4 sm:p-5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <History className="w-4 h-4 text-sky-600" /> Nhật ký cập nhật & điều khiển
                    </h3>
                    {facilityActivityLogs.length > 4 && (
                      <button
                        type="button"
                        onClick={() => setIsActivityModalOpen(true)}
                        className="text-[11px] font-bold text-sky-600 dark:text-sky-300 hover:underline cursor-pointer"
                      >
                        Xem tất cả ({facilityActivityLogs.length})
                      </button>
                    )}
                  </div>
                  {facilityActivityLogs.length === 0 ? (
                    <p className="text-xs text-slate-500 p-3 rounded-xl glass-subsurface">
                      Lịch sử thêm/chuyển thiết bị, nhập Excel, đồng bộ lớp và thao tác điều khiển thông minh sẽ hiển thị tại đây.
                    </p>
                  ) : (
                    facilityActivityLogs.slice(0, 4).map((log) => (
                      <div key={log.id} className="p-2.5 rounded-xl glass-subsurface text-xs">
                        <p className="font-semibold text-slate-900 dark:text-white">{log.summary}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {log.actorName} · {formatDateTimeSafe(log.timestamp)}
                        </p>
                      </div>
                    ))
                  )}
                </LiquidCard>
              </div>
            </div>
          )}

          {/* ===================== 2. THEO LỚP ===================== */}
          {tabId === 'by-class' && (
            <ClassFacilitiesPanel
              currentUser={currentUser}
              academicYears={academicYears}
              systemSettings={systemSettings}
              classes={classes}
              rooms={rooms}
              facilities={facilities}
              canEdit={canManageAssets}
              canDelete={canDeleteAssets}
              onSaveFacility={onSaveFacility}
              onSaveFacilitiesBatch={saveBatchFallback}
              onDeleteFacility={onDeleteFacility}
              onLogFacilityActivity={onLogFacilityActivity}
              onLogExport={onLogExport}
              onQuickReportBroken={handleQuickReportFromClass}
            />
          )}

          {/* ===================== 3. THIẾT BỊ (TOÀN TRƯỜNG) ===================== */}
          {tabId === 'equipment' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Lọc tình trạng thiết bị"
                    value={assetConditionFilter}
                    onChange={(e) => setAssetConditionFilter(e.target.value)}
                    className="glass-subsurface rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                  >
                    <option value="all">Mọi tình trạng</option>
                    {conditionOptions.map((opt) => (
                      <option key={opt.id} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Lọc loại thiết bị"
                    value={assetKindFilter}
                    onChange={(e) => setAssetKindFilter(e.target.value)}
                    className="glass-subsurface rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                  >
                    <option value="all">Mọi loại thiết bị</option>
                    {FACILITY_DEVICE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsActivityModalOpen(true)}
                    className="px-3 py-2 rounded-xl glass-subsurface text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <History className="w-3.5 h-3.5 text-sky-600" /> Lịch sử ({facilityActivityLogs.length})
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {onUnifiedImportCommit ? (
                    <ModuleDataActions
                      moduleKey="facilities"
                      context={validationContext}
                      currentUser={currentUser}
                      allRecords={facilities as unknown as Record<string, unknown>[]}
                      filteredRecords={filteredFacilities as unknown as Record<string, unknown>[]}
                      canCreate={canManageAssets}
                      canImport={canManageAssets}
                      canExport={canManageAssets || facilities.length > 0}
                      createLabel="Thêm Thiết bị"
                      onManualSave={(entity) => {
                        const normalized = normalizeFacilityAsset(
                          entity as unknown as FacilityAsset,
                          classes,
                          rooms
                        );
                        onSaveFacility(normalized);
                        if (onLogFacilityActivity) {
                          void onLogFacilityActivity(
                            createFacilityActivityLog({
                              logType: 'equipment_create',
                              summary: `Lưu thiết bị ${normalized.name} (${normalized.code})`,
                              actorName: currentUser.displayName,
                              actorRole: currentUser.role,
                              asset: normalized,
                            })
                          );
                        }
                      }}
                      onCommitImport={(key, items, hist) => onUnifiedImportCommit(key, items, hist)}
                      onLogExport={onLogExport}
                    />
                  ) : (
                    canManageAssets && (
                      <button
                        type="button"
                        onClick={openCreateAsset}
                        className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm whitespace-nowrap shrink-0"
                      >
                        <Plus className="w-4 h-4" /> Thêm Thiết bị
                      </button>
                    )
                  )}
                  {isAdmin && onSaveDataSourceConfig && (
                    <DataSourceButton
                      groupKey="facilities"
                      config={dataSourceConfigs.find((c) => c.groupKey === 'facilities')}
                      isAdmin={isAdmin}
                      onClick={() => setIsDataSourceOpen(true)}
                    />
                  )}
                </div>
              </div>

              {isAdmin && onSaveDataSourceConfig && onCommitNormalizedGroupData && (
                <DataSourceModal
                  isOpen={isDataSourceOpen}
                  onClose={() => setIsDataSourceOpen(false)}
                  groupKey="facilities"
                  allConfigs={dataSourceConfigs}
                  runtimeContext={
                    dataSourceRuntimeContext ?? {
                      classes,
                      academicYears,
                      rooms,
                    }
                  }
                  existingData={
                    dataSourceExistingData ?? {
                      students: [],
                      teachers: [],
                      staffMembers: [],
                      timetable: [],
                      afternoonSchedules: [],
                      books: [],
                      facilities,
                    }
                  }
                  currentUserEmail={currentUser.email}
                  currentUserName={currentUser.displayName}
                  onSaveConfig={onSaveDataSourceConfig}
                  onDeleteConfig={onDeleteDataSourceConfig}
                  onCommitNormalizedGroupData={onCommitNormalizedGroupData}
                />
              )}

              <BulkSelectionBar
                totalVisibleCount={filteredFacilities.length}
                selectedCount={effectiveSelectedAssetIds.length}
                allVisibleSelected={areAllVisibleSelected(effectiveSelectedAssetIds, visibleAssetIds)}
                canDelete={canDeleteAssets}
                entityLabel="thiết bị"
                showSelectAll={false}
                isDeleting={isBulkDeletingAssets}
                testIdPrefix="facilities-bulk"
                onToggleSelectAll={() =>
                  setSelectedAssetIds((prev) => toggleSelectAllVisible(prev, visibleAssetIds))
                }
                onClearSelection={() => setSelectedAssetIds([])}
                onRequestBulkDelete={() => setPendingBulkAssetIds(effectiveSelectedAssetIds)}
              />

              {filteredFacilities.length === 0 ? (
                <EmptyState
                  icon={Monitor}
                  title="Chưa có thiết bị nào phù hợp"
                  description="Thêm máy chiếu, máy tính, điều hòa, TV, quạt hoặc thiết bị phòng học vào danh mục."
                  action={
                    canManageAssets ? (
                      <button
                        type="button"
                        onClick={openCreateAsset}
                        className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> Thêm thiết bị đầu tiên
                      </button>
                    ) : null
                  }
                />
              ) : (
                <div className="glass-table-shell">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="glass-table-head">
                        <tr>
                          {canDeleteAssets && (
                            <th className="pl-4 pr-2 py-3 w-8">
                              <input
                                type="checkbox"
                                checked={areAllVisibleSelected(effectiveSelectedAssetIds, visibleAssetIds)}
                                onChange={() =>
                                  setSelectedAssetIds((prev) => toggleSelectAllVisible(prev, visibleAssetIds))
                                }
                                aria-label="Chọn tất cả thiết bị đang hiển thị"
                                className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500 cursor-pointer"
                              />
                            </th>
                          )}
                          <th className="px-4 py-3">Mã TB</th>
                          <th className="px-4 py-3">Tên thiết bị</th>
                          <th className="px-4 py-3">Loại / Công suất</th>
                          <th className="px-4 py-3">Lớp / Vị trí</th>
                          <th className="px-4 py-3">Tình trạng</th>
                          <th className="px-4 py-3">Trạng thái</th>
                          {(canManageAssets || canDeleteAssets) && <th className="px-4 py-3 text-right">Thao tác</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/25 dark:divide-white/10">
                        {filteredFacilities.map((asset) => {
                          const isSelected = effectiveSelectedAssetIds.includes(asset.id);
                          const metric = calculateAssetEnergyMetric(asset, DEFAULT_ELECTRICITY_COST_PER_KWH, classes);
                          return (
                            <tr
                              key={asset.id}
                              className={`glass-table-row ${
                                isSelected ? 'bg-sky-500/12 dark:bg-sky-500/18' : ''
                              }`}
                            >
                              {canDeleteAssets && (
                                <td className="pl-4 pr-2 py-3">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() =>
                                      setSelectedAssetIds((prev) => toggleSelectedId(prev, asset.id))
                                    }
                                    aria-label={`Chọn thiết bị ${asset.name}`}
                                    className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500 cursor-pointer"
                                  />
                                </td>
                              )}
                              <td className="px-4 py-3 font-mono-tabular font-semibold text-teal-700 dark:text-teal-300">
                                {asset.code}
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-bold text-slate-900 dark:text-white">{asset.name}</span>
                                <span className="block text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                                  {asset.quantity || 1} {asset.unit || 'cái'}
                                  {asset.manager ? ` · QL: ${asset.manager}` : ''}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                <span className="font-semibold">{asset.deviceKind || asset.category}</span>
                                <span className="block text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400">
                                  {metric.powerWattsPerUnit}W · ~{metric.monthlyKwh} kWh/tháng
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                {asset.className && (
                                  <span className="font-bold text-teal-700 dark:text-teal-300 block">
                                    Lớp {asset.className}
                                  </span>
                                )}
                                <span>{asset.roomLocation}</span>
                              </td>
                              <td className="px-4 py-3">
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
                              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{asset.status}</td>
                              {(canManageAssets || canDeleteAssets) && (
                                <td className="px-4 py-3 text-right">
                                  <div className="inline-flex items-center gap-1">
                                    {canManageAssets && (
                                      <button
                                        type="button"
                                        onClick={() => openEditAsset(asset)}
                                        aria-label={`Sửa ${asset.name}`}
                                        className="p-1.5 rounded-lg text-sky-600 dark:text-sky-400 hover:bg-sky-500/15 cursor-pointer"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {canDeleteAssets && (
                                      <button
                                        type="button"
                                        onClick={() => setPendingDeleteAsset(asset)}
                                        aria-label={`Xóa ${asset.name}`}
                                        className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <UnifiedManualFormModal
                isOpen={isAssetModalOpen}
                moduleKey="facilities"
                context={validationContext}
                existingRecords={facilities as unknown as Record<string, unknown>[]}
                initialValues={
                  editingAsset
                    ? (editingAsset as unknown as Record<string, unknown>)
                    : { code: `AST-${new Date().getFullYear()}-${String(facilities.length + 1).padStart(3, '0')}` }
                }
                editingRecordId={editingAsset?.id}
                currentUser={currentUser}
                onClose={() => {
                  setIsAssetModalOpen(false);
                  setEditingAsset(null);
                }}
                onSave={(entity) => {
                  const normalized = normalizeFacilityAsset(
                    entity as unknown as FacilityAsset,
                    classes,
                    rooms
                  );
                  onSaveFacility(normalized);
                  if (onLogFacilityActivity) {
                    void onLogFacilityActivity(
                      createFacilityActivityLog({
                        logType: editingAsset ? 'equipment_update' : 'equipment_create',
                        summary: `${editingAsset ? 'Cập nhật' : 'Thêm'} ${normalized.name} (${normalized.code})`,
                        actorName: currentUser.displayName,
                        actorRole: currentUser.role,
                        asset: normalized,
                      })
                    );
                  }
                  setIsAssetModalOpen(false);
                  setEditingAsset(null);
                }}
              />

              <ConfirmDialog
                isOpen={Boolean(pendingDeleteAsset)}
                title="Xác nhận xóa thiết bị"
                message={`Bạn có chắc muốn xóa thiết bị "${pendingDeleteAsset?.name}" (${pendingDeleteAsset?.code})?`}
                confirmLabel="Xóa thiết bị"
                onConfirm={() => {
                  if (pendingDeleteAsset) onDeleteFacility(pendingDeleteAsset.id);
                  setPendingDeleteAsset(null);
                }}
                onCancel={() => setPendingDeleteAsset(null)}
              />

              <ConfirmDialog
                isOpen={Boolean(pendingBulkAssetIds && pendingBulkAssetIds.length > 0)}
                title="Xác nhận xóa hàng loạt thiết bị"
                message={`Bạn có chắc muốn xóa ${pendingBulkAssetIds?.length || 0} thiết bị đã chọn khỏi danh mục?`}
                confirmLabel={`Xóa ${pendingBulkAssetIds?.length || 0} thiết bị`}
                onConfirm={() => {
                  void handleConfirmBulkDeleteAssets();
                }}
                onCancel={() => setPendingBulkAssetIds(null)}
              />
            </div>
          )}

          {/* ===================== 4. ĐIỆN NĂNG ===================== */}
          {tabId === 'energy' && (
            <FacilityEnergyPanel
              currentUser={currentUser}
              academicYears={academicYears}
              classes={classes}
              facilities={facilities}
              meterReadings={facilityMeterReadings}
              canEdit={canManageAssets}
              onSaveMeterReading={async (reading) => {
                if (onSaveMeterReading) await onSaveMeterReading(reading);
              }}
              onDeleteMeterReading={async (id) => {
                if (onDeleteMeterReading) await onDeleteMeterReading(id);
              }}
              onLogFacilityActivity={onLogFacilityActivity}
            />
          )}

          {/* ===================== 5. ĐIỀU KHIỂN THÔNG MINH ===================== */}
          {tabId === 'smart-control' && (
            <SmartControlPanel
              currentUser={currentUser}
              academicYears={academicYears}
              classes={classes}
              smartConfigs={facilitySmartConfigs}
              canManageSmartControl={canManageAssets}
              onSaveSmartConfig={async (cfg) => {
                if (onSaveSmartConfig) await onSaveSmartConfig(cfg);
              }}
              onLogFacilityActivity={onLogFacilityActivity}
            />
          )}

          {/* ===================== 6. PHÒNG HỌC ===================== */}
          {tabId === 'rooms' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-end gap-2">
                {onUnifiedImportCommit ? (
                  <ModuleDataActions
                    moduleKey="rooms"
                    context={validationContext}
                    currentUser={currentUser}
                    allRecords={rooms as unknown as Record<string, unknown>[]}
                    canCreate={canManageAssets}
                    canImport={canManageAssets}
                    canExport={canManageAssets || rooms.length > 0}
                    createLabel="Thêm Phòng học"
                    onManualSave={(entity) => {
                      onSaveRoom(entity as unknown as SchoolRoom);
                    }}
                    onCommitImport={(key, items, hist) => onUnifiedImportCommit(key, items, hist)}
                    onLogExport={onLogExport}
                  />
                ) : (
                  canManageAssets && (
                    <button
                      type="button"
                      onClick={openCreateRoom}
                      className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-4 h-4" /> Thêm Phòng học
                    </button>
                  )
                )}
              </div>

              <BulkSelectionBar
                totalVisibleCount={roomSummaries.length}
                selectedCount={effectiveSelectedRoomIds.length}
                allVisibleSelected={areAllVisibleSelected(effectiveSelectedRoomIds, visibleRoomIds)}
                canDelete={canDeleteAssets}
                entityLabel="phòng học"
                showSelectAll={true}
                isDeleting={isBulkDeletingRooms}
                testIdPrefix="rooms-bulk"
                onToggleSelectAll={() =>
                  setSelectedRoomIds((prev) => toggleSelectAllVisible(prev, visibleRoomIds))
                }
                onClearSelection={() => setSelectedRoomIds([])}
                onRequestBulkDelete={() => setPendingBulkRoomIds(effectiveSelectedRoomIds)}
              />

              {roomSummaries.length === 0 ? (
                <EmptyState
                  icon={DoorOpen}
                  title="Chưa có phòng học nào"
                  description="Thêm phòng học hoặc phòng chức năng để gắn vào lớp học và lịch thời khóa biểu."
                  action={
                    canManageAssets ? (
                      <button
                        type="button"
                        onClick={openCreateRoom}
                        className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> Thêm phòng đầu tiên
                      </button>
                    ) : null
                  }
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {roomSummaries.map(({ room, assetCount, openIssues }) => {
                    const isSelected = effectiveSelectedRoomIds.includes(room.id);
                    return (
                      <LiquidCard
                        key={room.id}
                        className={`p-4 space-y-2.5 transition-all ${
                          isSelected ? 'ring-2 ring-sky-500/75 bg-sky-500/10 dark:bg-sky-500/15' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 min-w-0">
                            {canDeleteAssets && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() =>
                                  setSelectedRoomIds((prev) => toggleSelectedId(prev, room.id))
                                }
                                aria-label={`Chọn phòng ${room.name}`}
                                className="mt-1 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500 shrink-0 cursor-pointer"
                              />
                            )}
                            <div className="min-w-0">
                              <span className="text-[11px] font-mono-tabular font-bold text-teal-700 dark:text-teal-300">
                                {room.code} · {room.building} ({room.floor})
                              </span>
                              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{room.name}</h3>
                            </div>
                          </div>
                          <Badge
                            variant={openIssues > 0 ? 'amber' : room.status === 'Bảo trì' ? 'pink' : 'mint'}
                            size="sm"
                          >
                            {openIssues > 0 ? `${openIssues} sự cố` : room.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                          <p>Loại: {room.roomType} · Sức chứa: <span className="font-mono-tabular">{room.capacity}</span> chỗ</p>
                          {room.assignedClassName && <p>Lớp sử dụng: <strong>{room.assignedClassName}</strong></p>}
                          <p className="text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400">
                            Thiết bị kiểm kê: {assetCount}
                          </p>
                        </div>
                        {(canManageAssets || canDeleteAssets) && (
                          <div className="pt-2.5 border-t border-white/35 dark:border-white/10 flex justify-end gap-2">
                            {canManageAssets && (
                              <button
                                type="button"
                                onClick={() => openEditRoom(room)}
                                className="px-2.5 py-1 rounded-lg glass-subsurface text-xs font-semibold text-sky-600 dark:text-sky-300 hover:bg-sky-500/15 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                              >
                                <Pencil className="w-3 h-3" /> Sửa
                              </button>
                            )}
                            {canDeleteAssets && (
                              <button
                                type="button"
                                onClick={() => setPendingDeleteRoom(room)}
                                className="px-2.5 py-1 rounded-lg glass-subsurface text-xs font-semibold text-rose-600 dark:text-rose-300 hover:bg-rose-500/15 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                              >
                                <Trash2 className="w-3 h-3" /> Xóa
                              </button>
                            )}
                          </div>
                        )}
                      </LiquidCard>
                    );
                  })}
                </div>
              )}

              <UnifiedManualFormModal
                isOpen={isRoomModalOpen}
                moduleKey="rooms"
                context={validationContext}
                existingRecords={rooms as unknown as Record<string, unknown>[]}
                initialValues={
                  editingRoom
                    ? (editingRoom as unknown as Record<string, unknown>)
                    : { code: `P.${String(rooms.length + 101)}` }
                }
                editingRecordId={editingRoom?.id}
                currentUser={currentUser}
                onClose={() => {
                  setIsRoomModalOpen(false);
                  setEditingRoom(null);
                }}
                onSave={(entity) => {
                  onSaveRoom(entity as unknown as SchoolRoom);
                  setIsRoomModalOpen(false);
                  setEditingRoom(null);
                }}
              />

              <ConfirmDialog
                isOpen={Boolean(pendingDeleteRoom)}
                title="Xác nhận xóa phòng"
                message={`Bạn có chắc muốn xóa phòng "${pendingDeleteRoom?.name}" khỏi danh mục?`}
                confirmLabel="Xóa phòng"
                onConfirm={() => {
                  if (pendingDeleteRoom) onDeleteRoom(pendingDeleteRoom.id);
                  setPendingDeleteRoom(null);
                }}
                onCancel={() => setPendingDeleteRoom(null)}
              />

              <ConfirmDialog
                isOpen={Boolean(pendingBulkRoomIds && pendingBulkRoomIds.length > 0)}
                title="Xác nhận xóa hàng loạt phòng học"
                message={`Bạn có chắc muốn xóa ${pendingBulkRoomIds?.length || 0} phòng học đã chọn khỏi danh mục?`}
                confirmLabel={`Xóa ${pendingBulkRoomIds?.length || 0} phòng`}
                onConfirm={() => {
                  void handleConfirmBulkDeleteRooms();
                }}
                onCancel={() => setPendingBulkRoomIds(null)}
              />
            </div>
          )}

          {/* ===================== 7. BÁO HỎNG & BẢO TRÌ (UNIFIED) ===================== */}
          {(tabId === 'broken' || tabId === 'maintenance') && (
            <div className="space-y-4">
              {!isPureStudent && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex rounded-xl p-1 glass-subsurface gap-1">
                    <button
                      type="button"
                      onClick={() => setBrokenSubTab('tickets')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                        brokenSubTab === 'tickets'
                          ? 'bg-teal-600 text-white shadow-sm'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      Xử lý & Bảo trì ({openTickets.length} đang mở)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBrokenSubTab('report')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                        brokenSubTab === 'report'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      Gửi phiếu báo hỏng
                    </button>
                  </div>

                  {brokenSubTab === 'tickets' && (
                    <div className="flex flex-wrap items-center gap-2">
                      {onUnifiedImportCommit && (
                        <ModuleDataActions
                          moduleKey="maintenance_plans"
                          context={validationContext}
                          currentUser={currentUser}
                          allRecords={maintenanceRequests as unknown as Record<string, unknown>[]}
                          filteredRecords={filteredMaintenance as unknown as Record<string, unknown>[]}
                          canCreate={canManageAssets}
                          canImport={canManageAssets}
                          canExport={canManageAssets || filteredMaintenance.length > 0}
                          createLabel="Thêm Kế hoạch"
                          onManualSave={async (entity) => {
                            await onSubmitMaintenance(entity as unknown as MaintenanceRequest);
                          }}
                          onCommitImport={(key, items, hist) => onUnifiedImportCommit(key, items, hist)}
                          onLogExport={onLogExport}
                        />
                      )}
                      <select
                        value={maintenanceFilter}
                        onChange={(e) => setMaintenanceFilter(e.target.value as typeof maintenanceFilter)}
                        className="glass-subsurface rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                      >
                        <option value="all">Tất cả ({maintenanceRequests.length})</option>
                        <option value="open">Đang mở ({openTickets.length})</option>
                        <option value="completed">Đã hoàn tất ({completedTickets.length})</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {(isPureStudent || brokenSubTab === 'report') ? (
                <div className="max-w-2xl space-y-4">
                  <LiquidCard className="p-5">
                    <form onSubmit={handleReportBroken} className="space-y-3 text-xs">
                      {facilities.length > 0 && (
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                            Chọn nhanh từ danh mục thiết bị (tùy chọn)
                          </label>
                          <select
                            value={brokenForm.assetId}
                            onChange={(e) => {
                              const found = facilities.find((f) => f.id === e.target.value);
                              if (found) {
                                setBrokenForm({
                                  ...brokenForm,
                                  assetId: found.id,
                                  assetName: found.name,
                                  roomLocation: found.roomLocation,
                                });
                              } else {
                                setBrokenForm({ ...brokenForm, assetId: '' });
                              }
                            }}
                            className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                          >
                            <option value="">-- Nhập thủ công thiết bị/hạng mục --</option>
                            {facilities.map((f) => (
                              <option key={f.id} value={f.id}>
                                [{f.code}] {f.name} — {f.className ? `Lớp ${f.className} · ` : ''}{f.roomLocation}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                            Tên thiết bị / Hạng mục hỏng *
                          </label>
                          <input
                            type="text"
                            required
                            value={brokenForm.assetName}
                            onChange={(e) => setBrokenForm({ ...brokenForm, assetName: e.target.value })}
                            placeholder="VD: Máy chiếu, Quạt trần, Bóng đèn..."
                            className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                            Phòng học / Lớp *
                          </label>
                          <input
                            type="text"
                            required
                            value={brokenForm.roomLocation}
                            onChange={(e) => setBrokenForm({ ...brokenForm, roomLocation: e.target.value })}
                            placeholder="VD: P.101 - Lớp 10A1"
                            className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                          Mức độ ưu tiên
                        </label>
                        <select
                          value={brokenForm.priority}
                          onChange={(e) =>
                            setBrokenForm({ ...brokenForm, priority: e.target.value as MaintenanceRequest['priority'] })
                          }
                          className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                        >
                          {priorityOptions.map((opt) => (
                            <option key={opt.id} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                          Mô tả tình trạng hỏng hóc *
                        </label>
                        <textarea
                          rows={3}
                          required
                          value={brokenForm.issueDescription}
                          onChange={(e) => setBrokenForm({ ...brokenForm, issueDescription: e.target.value })}
                          className="w-full glass-subsurface rounded-xl p-3 text-slate-800 dark:text-slate-100"
                        />
                      </div>
                      {brokenSuccess && (
                        <div className="p-3 rounded-xl bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" /> Đã tiếp nhận phiếu báo hỏng!
                        </div>
                      )}
                      <button
                        type="submit"
                        className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer"
                      >
                        Gửi phiếu báo hỏng
                      </button>
                    </form>
                  </LiquidCard>
                </div>
              ) : filteredMaintenance.length === 0 ? (
                <EmptyState
                  icon={Wrench}
                  title="Chưa có yêu cầu bảo trì"
                  description="Các phiếu báo hỏng từ giáo viên, học sinh và phản ánh cơ sở vật chất sẽ hiển thị tại đây."
                />
              ) : (
                <div className="space-y-3">
                  {filteredMaintenance.map((req) => (
                    <LiquidCard key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono-tabular text-xs font-bold text-teal-700 dark:text-teal-300">
                            {req.requestCode}
                          </span>
                          <Badge
                            variant={
                              req.status === 'completed'
                                ? 'mint'
                                : req.status === 'in_repair'
                                ? 'blue'
                                : 'amber'
                            }
                            size="sm"
                          >
                            {req.status === 'reported'
                              ? 'Mới báo hỏng'
                              : req.status === 'assigned'
                              ? 'Đã phân công'
                              : req.status === 'in_repair'
                              ? 'Đang sửa'
                              : 'Hoàn tất'}
                          </Badge>
                          {req.linkedFeedbackId && (
                            <Badge variant="purple" size="sm">
                              <Link2 className="w-3 h-3 mr-1 inline" /> Liên kết Phản ánh
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          {req.assetName} — {req.roomLocation}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{req.issueDescription}</p>
                        <p className="text-[11px] text-slate-400">
                          Người báo: {req.reportedBy} · {formatDateTimeSafe(req.reportedAt)}
                          {req.assignedStaff && ` · Phụ trách: ${req.assignedStaff}`}
                        </p>
                      </div>

                      {canManageAssets && req.status !== 'completed' && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = nextMaintenanceStatus(req.status);
                            void onSubmitMaintenance({
                              ...req,
                              status: next,
                              assignedStaff: currentUser.displayName,
                              completedAt:
                                next === 'completed'
                                  ? new Date().toISOString().split('T')[0]
                                  : undefined,
                            });
                          }}
                          className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shrink-0 cursor-pointer"
                        >
                          {req.status === 'reported'
                            ? 'Tiếp nhận xử lý'
                            : req.status === 'assigned'
                            ? 'Bắt đầu sửa'
                            : 'Hoàn tất bảo trì'}
                        </button>
                      )}
                    </LiquidCard>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Activity History Modal */}
          <Modal
            isOpen={isActivityModalOpen}
            onClose={() => setIsActivityModalOpen(false)}
            title="Lịch sử cập nhật Cơ sở vật chất & Điều khiển"
            maxWidth="2xl"
          >
            {facilityActivityLogs.length === 0 ? (
              <EmptyState
                icon={AlertCircle}
                title="Chưa có lịch sử ghi nhận"
                description="Mọi thao tác thêm, sửa, chuyển lớp, nhập Excel và điều khiển thông minh đều được lưu đồng bộ tại đây."
              />
            ) : (
              <div className="space-y-2 text-xs max-h-96 overflow-y-auto">
                {facilityActivityLogs.map((log) => (
                  <div key={log.id} className="p-3 rounded-xl glass-subsurface flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{log.summary}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {log.actorName} ({log.actorRole}) · {formatDateTimeSafe(log.timestamp)}
                      </p>
                    </div>
                    <Badge variant="gray" size="sm">{log.logType}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Modal>

          <ClassFacilitiesExcelModal
            isOpen={isQuickExcelOpen}
            onClose={() => setIsQuickExcelOpen(false)}
            currentUser={currentUser}
            academicYears={academicYears}
            selectedAcademicYear={academicYears[0]?.name || 'all'}
            selectedGrade="all"
            selectedClassId="all"
            classes={classes}
            rooms={rooms}
            facilities={facilities}
            systemSettings={systemSettings}
            canEdit={canManageAssets}
            onCommitBatch={saveBatchFallback}
            onLogFacilityActivity={onLogFacilityActivity}
            onLogExport={onLogExport}
          />
        </>
      )}
    </AppWindowShell>
  );
};
