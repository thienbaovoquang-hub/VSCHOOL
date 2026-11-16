import React, { useState, useMemo } from 'react';
import {
  Building2, DoorOpen, Monitor, AlertCircle, Wrench, Plus, CheckCircle2,
  Pencil, Trash2, Link2
} from 'lucide-react';
import {
  ExportHistoryRecord,
  FacilityAsset,
  ImportHistoryRecord,
  ImportModuleKey,
  MaintenanceRequest,
  PermissionMatrix,
  SchoolClass,
  SchoolRoom,
  UserProfile,
} from '../../types';
import { AppWindowShell } from '../shared/AppWindowShell';
import { EmptyState } from '../shared/EmptyState';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { LiquidCard } from '../common/LiquidCard';
import { Badge } from '../common/Badge';
import { ModuleDataActions } from '../importExport/ModuleDataActions';
import { UnifiedManualFormModal } from '../importExport/UnifiedManualFormModal';
import type { ValidationDbContext } from '../../utils/importExport/validator';
import { resolveCatalogOptions } from '../../utils/catalogs/catalogRegistry';
import { DEFAULT_PERMISSIONS, hasPermission } from '../../utils/rbac';
import { formatDateTimeSafe } from '../../utils/crossAppSync';

interface FacilitiesAppProps {
  activeTab: string;
  currentUser: UserProfile;
  customPermissions?: PermissionMatrix;
  validationContext?: ValidationDbContext;
  classes: SchoolClass[];
  rooms: SchoolRoom[];
  facilities: FacilityAsset[];
  maintenanceRequests: MaintenanceRequest[];
  onSelectTab: (tabId: string) => void;
  onSaveRoom: (room: SchoolRoom) => void;
  onDeleteRoom: (roomId: string) => void;
  onSaveFacility: (asset: FacilityAsset) => void;
  onDeleteFacility: (assetId: string) => void;
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
  rooms,
  facilities,
  maintenanceRequests,
  onSelectTab,
  onSaveRoom,
  onDeleteRoom,
  onSaveFacility,
  onDeleteFacility,
  onSubmitMaintenance,
  onUnifiedImportCommit,
  onLogExport,
}) => {
  const canManageAssets = hasPermission(currentUser.role, 'facilities', 'edit', customPermissions);
  const canDeleteAssets = hasPermission(currentUser.role, 'facilities', 'delete', customPermissions);

  // Room Modal (UnifiedManualFormModal)
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<SchoolRoom | null>(null);
  const [pendingDeleteRoom, setPendingDeleteRoom] = useState<SchoolRoom | null>(null);

  // Asset Modal (UnifiedManualFormModal)
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FacilityAsset | null>(null);
  const [pendingDeleteAsset, setPendingDeleteAsset] = useState<FacilityAsset | null>(null);
  const [assetConditionFilter, setAssetConditionFilter] = useState('all');

  // Maintenance filter & broken report form
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

  const filteredFacilities = useMemo(() => {
    if (assetConditionFilter === 'all') return facilities;
    return facilities.filter((f) => f.condition === assetConditionFilter);
  }, [facilities, assetConditionFilter]);

  const filteredMaintenance = useMemo(() => {
    if (maintenanceFilter === 'open') return openTickets;
    if (maintenanceFilter === 'completed') return completedTickets;
    return maintenanceRequests;
  }, [maintenanceRequests, openTickets, completedTickets, maintenanceFilter]);

  // Derived room telemetry (equipment count & open issues per room)
  const roomSummaries = useMemo(() => {
    return rooms.map((rm) => {
      const assetCount = facilities.filter(
        (f) => f.roomLocation.toLowerCase() === rm.name.toLowerCase()
      ).length;
      const openIssues = openTickets.filter(
        (m) => m.roomLocation.toLowerCase() === rm.name.toLowerCase()
      ).length;
      return { room: rm, assetCount, openIssues };
    });
  }, [rooms, facilities, openTickets]);

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
    setBrokenForm({ assetId: '', assetName: '', roomLocation: '', issueDescription: '', priority: 'medium' });
    setBrokenSuccess(true);
    setTimeout(() => setBrokenSuccess(false), 3000);
  };

  const nextMaintenanceStatus = (status: MaintenanceRequest['status']): MaintenanceRequest['status'] => {
    if (status === 'reported') return 'assigned';
    if (status === 'assigned') return 'in_repair';
    return 'completed';
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
          {tabId === 'overview' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-teal-600" />
                  Tổng quan Cơ sở vật chất
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Theo dõi phòng học, tài sản thiết bị và tình hình tiếp nhận sửa chữa toàn trường
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                {[
                  { label: 'Phòng học / Khu vực', value: rooms.length },
                  { label: 'Tổng thiết bị', value: facilities.length },
                  { label: 'Phiếu chờ xử lý', value: openTickets.length },
                  { label: 'Đã sửa hoàn tất', value: completedTickets.length },
                ].map((c) => (
                  <LiquidCard key={c.label} className="p-4">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {c.label}
                    </p>
                    <p className="font-mono-tabular text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-1">
                      {c.value}
                    </p>
                  </LiquidCard>
                ))}
              </div>

              {openTickets.length > 0 ? (
                <LiquidCard className="p-4 space-y-2.5">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Sự cố đang chờ xử lý</h3>
                  {openTickets.slice(0, 4).map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl bg-white/60 dark:bg-slate-800/60 flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-100">
                          {t.assetName} — {t.roomLocation}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400">{t.issueDescription}</p>
                      </div>
                      <Badge variant="amber" size="sm">{t.status}</Badge>
                    </div>
                  ))}
                </LiquidCard>
              ) : (
                <EmptyState
                  icon={CheckCircle2}
                  title="Cơ sở vật chất đang vận hành ổn định"
                  description="Chưa có phiếu báo hỏng nào cần xử lý lúc này."
                />
              )}
            </div>
          )}

          {tabId === 'rooms' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <DoorOpen className="w-5 h-5 text-teal-600" />
                    Danh mục Phòng học & Phòng chức năng
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Quản lý sức chứa, tòa nhà, lớp học sử dụng và đồng bộ trực tiếp với Thời khóa biểu
                  </p>
                </div>
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
                      className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Thêm Phòng học
                    </button>
                  )
                )}
              </div>

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
                  {roomSummaries.map(({ room, assetCount, openIssues }) => (
                    <LiquidCard key={room.id} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[11px] font-mono-tabular font-bold text-teal-600 dark:text-teal-400">
                            {room.code} · {room.building} ({room.floor})
                          </span>
                          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{room.name}</h3>
                        </div>
                        <Badge
                          variant={openIssues > 0 ? 'amber' : room.status === 'Bảo trì' ? 'pink' : 'mint'}
                          size="sm"
                        >
                          {openIssues > 0 ? `${openIssues} sự cố` : room.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                        <p>Loại: {room.roomType} · Sức chứa: {room.capacity} chỗ</p>
                        {room.assignedClassName && <p>Lớp sử dụng: <strong>{room.assignedClassName}</strong></p>}
                        <p className="text-[11px] font-mono-tabular text-slate-400">
                          Thiết bị kiểm kê: {assetCount}
                        </p>
                      </div>
                      {(canManageAssets || canDeleteAssets) && (
                        <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex justify-end gap-2">
                          {canManageAssets && (
                            <button
                              type="button"
                              onClick={() => openEditRoom(room)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" /> Sửa
                            </button>
                          )}
                          {canDeleteAssets && (
                            <button
                              type="button"
                              onClick={() => setPendingDeleteRoom(room)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" /> Xóa
                            </button>
                          )}
                        </div>
                      )}
                    </LiquidCard>
                  ))}
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
            </div>
          )}

          {tabId === 'equipment' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-sky-600" />
                    Tài sản & Thiết bị Giảng dạy
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Quản lý mã tài sản, vị trí phòng và tình trạng kiểm định định kỳ
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={assetConditionFilter}
                    onChange={(e) => setAssetConditionFilter(e.target.value)}
                    className="bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-200"
                  >
                    <option value="all">Mọi tình trạng</option>
                    {conditionOptions.map((opt) => (
                      <option key={opt.id} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
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
                        onSaveFacility(entity as unknown as FacilityAsset);
                      }}
                      onCommitImport={(key, items, hist) => onUnifiedImportCommit(key, items, hist)}
                      onLogExport={onLogExport}
                    />
                  ) : (
                    canManageAssets && (
                      <button
                        type="button"
                        onClick={openCreateAsset}
                        className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> Thêm Thiết bị
                      </button>
                    )
                  )}
                </div>
              </div>

              {filteredFacilities.length === 0 ? (
                <EmptyState
                  icon={Monitor}
                  title="Chưa có thiết bị nào phù hợp"
                  description="Thêm máy chiếu, máy tính, điều hòa hoặc thiết bị phòng thí nghiệm vào danh mục."
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
                <LiquidCard className="p-0 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/70 dark:bg-slate-800/70 border-b border-slate-200/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 font-semibold uppercase">
                        <tr>
                          <th className="px-4 py-3">Mã TB</th>
                          <th className="px-4 py-3">Tên thiết bị</th>
                          <th className="px-4 py-3">Nhóm</th>
                          <th className="px-4 py-3">Vị trí</th>
                          <th className="px-4 py-3">Tình trạng</th>
                          <th className="px-4 py-3">Trạng thái</th>
                          {(canManageAssets || canDeleteAssets) && <th className="px-4 py-3 text-right">Thao tác</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredFacilities.map((asset) => (
                          <tr key={asset.id}>
                            <td className="px-4 py-3 font-mono-tabular font-semibold text-teal-700 dark:text-teal-300">
                              {asset.code}
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">{asset.name}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{asset.category}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{asset.roomLocation}</td>
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
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{asset.status}</td>
                            {(canManageAssets || canDeleteAssets) && (
                              <td className="px-4 py-3 text-right">
                                <div className="inline-flex items-center gap-1">
                                  {canManageAssets && (
                                    <button
                                      type="button"
                                      onClick={() => openEditAsset(asset)}
                                      aria-label={`Sửa ${asset.name}`}
                                      className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-500/15 cursor-pointer"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {canDeleteAssets && (
                                    <button
                                      type="button"
                                      onClick={() => setPendingDeleteAsset(asset)}
                                      aria-label={`Xóa ${asset.name}`}
                                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-500/15 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </LiquidCard>
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
                  onSaveFacility(entity as unknown as FacilityAsset);
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
            </div>
          )}

          {tabId === 'broken' && (
            <div className="max-w-2xl space-y-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  Báo hỏng Thiết bị & Phòng học
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Gửi yêu cầu sửa chữa trực tiếp đến bộ phận Cơ sở vật chất
                </p>
              </div>

              <LiquidCard className="p-5">
                <form onSubmit={handleReportBroken} className="space-y-3 text-xs">
                  {facilities.length > 0 && (
                    <div>
                      <label className="block font-semibold mb-1">Chọn nhanh từ danh mục thiết bị (tùy chọn)</label>
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
                        className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                      >
                        <option value="">-- Nhập thủ công thiết bị/hạng mục --</option>
                        {facilities.map((f) => (
                          <option key={f.id} value={f.id}>
                            [{f.code}] {f.name} — {f.roomLocation}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">Tên thiết bị / Hạng mục hỏng *</label>
                      <input
                        type="text"
                        required
                        value={brokenForm.assetName}
                        onChange={(e) => setBrokenForm({ ...brokenForm, assetName: e.target.value })}
                        placeholder="VD: Máy chiếu, Quạt trần, Bóng đèn..."
                        className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Phòng học / Khu vực *</label>
                      <input
                        type="text"
                        required
                        value={brokenForm.roomLocation}
                        onChange={(e) => setBrokenForm({ ...brokenForm, roomLocation: e.target.value })}
                        placeholder="VD: Phòng 11A1 - Nhà B"
                        className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Mức độ ưu tiên</label>
                    <select
                      value={brokenForm.priority}
                      onChange={(e) =>
                        setBrokenForm({ ...brokenForm, priority: e.target.value as MaintenanceRequest['priority'] })
                      }
                      className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                    >
                      {priorityOptions.map((opt) => (
                        <option key={opt.id} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Mô tả tình trạng hỏng hóc *</label>
                    <textarea
                      rows={3}
                      required
                      value={brokenForm.issueDescription}
                      onChange={(e) => setBrokenForm({ ...brokenForm, issueDescription: e.target.value })}
                      className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  {brokenSuccess && (
                    <div className="p-3 rounded-xl bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Đã tiếp nhận phiếu báo hỏng!
                    </div>
                  )}
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold cursor-pointer"
                  >
                    Gửi phiếu báo hỏng
                  </button>
                </form>
              </LiquidCard>
            </div>
          )}

          {tabId === 'maintenance' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-teal-600" />
                    Điều phối Bảo trì & Sửa chữa
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Cập nhật tiến độ xử lý các phiếu báo hỏng và tự động đồng bộ trạng thái tài sản
                  </p>
                </div>
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
                    className="bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    <option value="all">Tất cả ({maintenanceRequests.length})</option>
                    <option value="open">Đang mở ({openTickets.length})</option>
                    <option value="completed">Đã hoàn tất ({completedTickets.length})</option>
                  </select>
                </div>
              </div>

              <div className="px-3.5 py-2 rounded-xl bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200/70 dark:border-sky-800/50 text-[11px] text-sky-800 dark:text-sky-300">
                Quy trình tách biệt: Kế hoạch bảo trì định kỳ hỗ trợ thêm/nhập hàng loạt từ Excel; phiếu báo hỏng phát sinh tiếp tục xử lý trực tiếp qua quy trình tác nghiệp tại mục Báo hỏng.
              </div>

              {filteredMaintenance.length === 0 ? (
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
                            onSubmitMaintenance({
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
        </>
      )}
    </AppWindowShell>
  );
};
