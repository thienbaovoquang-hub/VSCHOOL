import React, { useEffect, useMemo, useState } from 'react';
import {
  Shield, Settings, Trash2, CheckCircle2,
  Moon, Sun, Minimize2, ArrowRight, Database, Save,
  Pencil, Download, Upload, Lock, Unlock, Search, AlertTriangle
} from 'lucide-react';
import {
  AuditLogEntry,
  ExportHistoryRecord,
  ImportHistoryRecord,
  ImportModuleKey,
  PermissionMatrix,
  SuperAppId,
  SystemSettings,
  UserInvite,
  UserProfile,
  UserRole,
} from '../../types';
import { AppWindowShell } from '../shared/AppWindowShell';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { LiquidCard } from '../common/LiquidCard';
import { Badge } from '../common/Badge';
import { PermissionsMatrixView } from '../../views/PermissionsMatrixView';
import { ModuleDataActions } from '../importExport/ModuleDataActions';
import { UnifiedManualFormModal } from '../importExport/UnifiedManualFormModal';
import { extractExistingRecordsForModule, type ValidationDbContext } from '../../utils/importExport/validator';
import { Modal } from '../common/Modal';
import {
  DEFAULT_PERMISSIONS,
  formatUserRolesLabel,
  hasPermission,
  ROLE_DEFINITIONS,
  userHasRole,
} from '../../utils/rbac';
import { validateBackupPayload } from '../../utils/crossAppSync';
import { exportFullBackupJson } from '../../firebase/services';

interface AdministrationAppProps {
  activeTab: string;
  currentUser: UserProfile;
  userAccounts: UserProfile[];
  userInvites?: UserInvite[];
  auditLogs?: AuditLogEntry[];
  importHistory?: ImportHistoryRecord[];
  exportHistory?: ExportHistoryRecord[];
  validationContext?: ValidationDbContext;
  backupDataSnapshot?: Record<string, unknown>;
  legacyMigrationCount?: number;
  systemSettings: SystemSettings;
  darkMode: boolean;
  stats: {
    studentsCount: number;
    teachersCount: number;
    booksCount: number;
    openMaintenanceCount: number;
  };
  onSelectTab: (tabId: string) => void;
  onSaveUserAccount: (user: UserProfile) => Promise<void> | void;
  onDeleteUserAccount: (userId: string) => Promise<void> | void;
  onDeleteUserInvite?: (inviteId: string) => Promise<void> | void;
  onSaveSettings: (settings: SystemSettings) => Promise<void> | void;
  onToggleDarkMode: () => void;
  onClearAllData: () => Promise<void> | void;
  onRestoreBackup: (payload: Record<string, unknown>) => Promise<void> | void;
  onOpenLegacyMigration?: () => void;
  onOpenTargetApp: (appId: SuperAppId, tabId?: string) => void;
  onUnifiedImportCommit?: (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => Promise<void> | void;
  onLogExport?: (record: ExportHistoryRecord) => Promise<void> | void;
  onAppendAuditLog?: (action: string, target: string) => Promise<void> | void;
}

export const AdministrationApp: React.FC<AdministrationAppProps> = ({
  activeTab,
  currentUser,
  userAccounts,
  userInvites = [],
  validationContext,
  backupDataSnapshot,
  legacyMigrationCount = 0,
  systemSettings,
  darkMode,
  stats,
  onSelectTab,
  onSaveUserAccount,
  onDeleteUserAccount,
  onDeleteUserInvite,
  onSaveSettings,
  onToggleDarkMode,
  onClearAllData,
  onRestoreBackup,
  onOpenLegacyMigration,
  onOpenTargetApp,
  onUnifiedImportCommit,
  onLogExport,
}) => {
  const customPermissions = systemSettings.customPermissions || DEFAULT_PERMISSIONS;
  const canEditUsers = hasPermission(currentUser, 'permissions', 'edit', customPermissions);
  const canExportUsers = hasPermission(currentUser, 'permissions', 'export', customPermissions) || canEditUsers;

  const [draftSettings, setDraftSettings] = useState<SystemSettings>(systemSettings);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [backupMessage, setBackupMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // User CRUD state (synced via UnifiedManualFormModal)
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [userSearch, setUserSearch] = useState('');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [multiRoleUser, setMultiRoleUser] = useState<UserProfile | null>(null);
  const [draftSecondaryRoles, setDraftSecondaryRoles] = useState<UserRole[]>([]);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<UserProfile | null>(null);

  const effectiveContext: ValidationDbContext = useMemo(
    () =>
      validationContext ?? {
        userAccounts,
        systemSettings,
      },
    [validationContext, userAccounts, systemSettings]
  );

  const safeCommitImport = async (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => {
    if (onUnifiedImportCommit) {
      await onUnifiedImportCommit(moduleKey, entitiesToSave, historyRecord);
    } else {
      for (const item of entitiesToSave) {
        await onSaveUserAccount(item as unknown as UserProfile);
      }
    }
  };

  useEffect(() => {
    setDraftSettings(systemSettings);
  }, [systemSettings]);

  const handleSaveSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings(draftSettings);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  };

  const handleSavePermissionMatrix = async (nextMatrix: PermissionMatrix) => {
    await onSaveSettings({
      ...systemSettings,
      customPermissions: nextMatrix,
    });
  };

  const openEditUser = (user: UserProfile) => {
    setEditingUser(user);
  };

  const handleExportJsonBackup = () => {
    const json = exportFullBackupJson({
      settings: systemSettings,
      data: backupDataSnapshot || {},
    });
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SchoolHub_Cloud_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupMessage({ type: 'ok', text: 'Đã xuất tệp sao lưu dữ liệu Cloud trực tuyến (.json).' });
  };

  const handleImportJsonBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const validation = validateBackupPayload(parsed);
      if (!validation.valid) {
        setBackupMessage({ type: 'err', text: validation.error || 'Tệp sao lưu không hợp lệ.' });
        return;
      }
      await onRestoreBackup(parsed as Record<string, unknown>);
      setBackupMessage({
        type: 'ok',
        text: `Đã khôi phục và đồng bộ lên Firestore ${validation.collectionsCount} phân hệ dữ liệu.`,
      });
    } catch {
      setBackupMessage({ type: 'err', text: 'Không thể đọc tệp JSON hoặc không đủ quyền ghi lên Firestore.' });
    } finally {
      e.target.value = '';
    }
  };

  // Merge active Firestore userAccounts with pre-provisioned unclaimed userInvites
  const combinedUsers = useMemo(() => {
    const map = new Map<string, { user: UserProfile; isInvitePending: boolean; inviteId?: string }>();
    const seenIds = new Set<string>();
    userAccounts.forEach((u) => {
      const key = u.email.toLowerCase() || u.id;
      if (u.id && seenIds.has(u.id)) return;
      if (u.id) seenIds.add(u.id);
      map.set(key, { user: u, isInvitePending: false });
    });
    userInvites.forEach((inv) => {
      if (inv.claimedByUid) return;
      const key = inv.emailLower || inv.email.toLowerCase();
      if (!map.has(key) && (!inv.id || !seenIds.has(inv.id))) {
        if (inv.id) seenIds.add(inv.id);
        map.set(key, {
          user: {
            id: inv.id,
            email: inv.email,
            displayName: inv.displayName,
            role: inv.role,
            secondaryRoles: inv.secondaryRoles,
            status: inv.status,
            schoolId: inv.schoolId,
            assignedClasses: inv.assignedClasses,
            assignedSubjects: inv.assignedSubjects,
            className: inv.className,
            grade: inv.grade,
            phone: inv.phone,
            studentCode: inv.studentCode,
            teacherCode: inv.teacherCode,
            linkedProfileId: inv.linkedProfileId,
            createdAt: inv.createdAt,
            updatedAt: inv.updatedAt,
          },
          isInvitePending: true,
          inviteId: inv.id,
        });
      }
    });
    return Array.from(map.values()).filter(({ user }) => {
      const matchRole = roleFilter === 'all' || userHasRole(user, roleFilter);
      const q = userSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        user.displayName.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        (user.className || '').toLowerCase().includes(q);
      return matchRole && matchSearch;
    });
  }, [userAccounts, userInvites, roleFilter, userSearch]);

  return (
    <AppWindowShell
      appId="admin"
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
                <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">
                  Tổng quan Quản trị Hệ thống
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Kiểm soát trạng thái dữ liệu, tài khoản RBAC và cấu hình toàn trường
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                {[
                  { label: 'Hồ sơ Học sinh', value: stats.studentsCount, app: 'school' as SuperAppId, tab: 'students-classes' },
                  { label: 'Nhân sự & GV', value: stats.teachersCount, app: 'school' as SuperAppId, tab: 'staff-hr' },
                  { label: 'Đầu sách Thư viện', value: stats.booksCount, app: 'library' as SuperAppId, tab: 'catalog' },
                  { label: 'Phiếu bảo trì mở', value: stats.openMaintenanceCount, app: 'facilities' as SuperAppId, tab: 'maintenance' },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => onOpenTargetApp(item.app, item.tab)}
                    className="liquid-glass-panel rounded-2xl p-4 text-left hover:-translate-y-0.5 transition-transform cursor-pointer group"
                  >
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {item.label}
                    </p>
                    <p className="font-mono-tabular text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-1">
                      {item.value}
                    </p>
                    <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                      Mở phân hệ <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </button>
                ))}
              </div>

              <LiquidCard className="p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-sky-500" />
                    Phiên làm việc hiện tại
                  </h3>
                  <Badge variant="blue">{formatUserRolesLabel(currentUser)}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <p><span className="text-slate-400">Người dùng:</span> <strong>{currentUser.displayName}</strong></p>
                  <p><span className="text-slate-400">Email:</span> {currentUser.email}</p>
                  <p><span className="text-slate-400">Trường:</span> {systemSettings.schoolName}</p>
                  <p><span className="text-slate-400">Năm học:</span> {systemSettings.academicYear}</p>
                </div>
                <div className="pt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectTab('users')}
                    className="px-3 py-1.5 rounded-xl bg-sky-500/12 text-sky-700 dark:text-sky-300 text-xs font-semibold hover:bg-sky-500/20 cursor-pointer"
                  >
                    Quản lý Người dùng ({combinedUsers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectTab('permissions')}
                    className="px-3 py-1.5 rounded-xl bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-500/20 cursor-pointer"
                  >
                    Ma trận Phân quyền
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenTargetApp('analytics', 'data')}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-500/20 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Database className="w-3.5 h-3.5" />
                    Trung tâm Dữ liệu
                  </button>
                </div>
              </LiquidCard>
            </div>
          )}

          {tabId === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">
                    Quản lý Tài khoản & Vai trò RBAC
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tạo tài khoản phân quyền (tuyệt đối không lưu/nhập mật khẩu qua Excel), khóa/mở khóa và kiểm thử vai trò
                  </p>
                </div>

                <ModuleDataActions
                  moduleKey="users"
                  context={effectiveContext}
                  currentUser={currentUser}
                  allRecords={combinedUsers.map((c) => c.user as unknown as Record<string, unknown>)}
                  filteredRecords={combinedUsers.map((c) => c.user as unknown as Record<string, unknown>)}
                  canCreate={canEditUsers}
                  canImport={canEditUsers}
                  canExport={canExportUsers}
                  createLabel="Thêm Tài khoản"
                  onManualSave={async (entity) => {
                    await onSaveUserAccount(entity as unknown as UserProfile);
                  }}
                  onCommitImport={safeCommitImport}
                  onLogExport={onLogExport}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Tìm tên, email hoặc lớp phụ trách..."
                    className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-100"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                  className="bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  <option value="all">Tất cả 8 vai trò</option>
                  {(Object.keys(ROLE_DEFINITIONS) as UserRole[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_DEFINITIONS[r].label}
                    </option>
                  ))}
                </select>
              </div>

              <LiquidCard className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/70 dark:bg-slate-800/70 border-b border-slate-200/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Tài khoản</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Vai trò</th>
                        <th className="px-4 py-3">Trạng thái</th>
                        <th className="px-4 py-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {combinedUsers.map(({ user: persona, isInvitePending, inviteId }) => {
                        const isCurrent = currentUser.id === persona.id;
                        const def = ROLE_DEFINITIONS[persona.role];
                        const status = persona.status || 'active';
                        return (
                          <tr key={persona.id} className="hover:bg-sky-50/35 dark:hover:bg-slate-800/50">
                            <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-500 text-white font-bold flex items-center justify-center shrink-0">
                                  {(persona.displayName || persona.email || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p>{persona.displayName}</p>
                                  {(persona.assignedClasses?.length || persona.className) && (
                                    <p className="text-[10px] font-normal text-slate-400">
                                      Lớp: {persona.assignedClasses?.join(', ') || persona.className}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono-tabular">
                              {persona.email}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap items-center gap-1">
                                <Badge variant={persona.role === 'admin' ? 'pink' : persona.role === 'student' ? 'blue' : 'aqua'}>
                                  {def?.label || persona.role || 'Thành viên'}
                                </Badge>
                                {(persona.secondaryRoles || []).map((sr) => (
                                  <Badge key={sr} variant="purple" size="sm">
                                    +{ROLE_DEFINITIONS[sr]?.label || sr}
                                  </Badge>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap items-center gap-1">
                                <Badge
                                  variant={status === 'active' ? 'mint' : status === 'locked' ? 'amber' : 'gray'}
                                  size="sm"
                                >
                                  {status === 'active' ? 'Hoạt động' : status === 'locked' ? 'Tạm khóa' : 'Vô hiệu hóa'}
                                </Badge>
                                {isInvitePending && (
                                  <Badge variant="blue" size="sm">
                                    Chờ kích hoạt Google
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                {isCurrent ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Đang đăng nhập
                                  </span>
                                ) : isInvitePending ? (
                                  <span className="text-[11px] text-slate-400 px-2">
                                    Tự kích hoạt khi đăng nhập email
                                  </span>
                                ) : null}

                                {canEditUsers && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setMultiRoleUser(persona);
                                        setDraftSecondaryRoles(persona.secondaryRoles || []);
                                      }}
                                      title="Gán vai trò kiêm nhiệm (Multi-role)"
                                      aria-label={`Vai trò phụ ${persona.displayName}`}
                                      className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/15 cursor-pointer"
                                    >
                                      <Shield className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openEditUser(persona)}
                                      title="Chỉnh sửa tài khoản"
                                      aria-label={`Chỉnh sửa ${persona.displayName}`}
                                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-700 cursor-pointer"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isCurrent}
                                      onClick={() =>
                                        onSaveUserAccount({
                                          ...persona,
                                          status: status === 'active' ? 'locked' : 'active',
                                        })
                                      }
                                      title={status === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                                      aria-label={status === 'active' ? `Khóa ${persona.displayName}` : `Mở khóa ${persona.displayName}`}
                                      className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-500/15 disabled:opacity-40 cursor-pointer"
                                    >
                                      {status === 'active' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                    </button>
                                    {!isCurrent && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (isInvitePending && inviteId && onDeleteUserInvite) {
                                            void onDeleteUserInvite(inviteId);
                                          } else {
                                            setPendingDeleteUser(persona);
                                          }
                                        }}
                                        title="Xóa tài khoản"
                                        aria-label={`Xóa ${persona.displayName}`}
                                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-500/15 cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </LiquidCard>

              {editingUser && (
                <UnifiedManualFormModal
                  isOpen={Boolean(editingUser)}
                  moduleKey="users"
                  context={effectiveContext}
                  existingRecords={extractExistingRecordsForModule('users', effectiveContext)}
                  initialValues={editingUser as unknown as Record<string, unknown>}
                  editingRecordId={editingUser.id}
                  currentUser={currentUser}
                  onClose={() => setEditingUser(null)}
                  onSave={async (entity) => {
                    await onSaveUserAccount(entity as unknown as UserProfile);
                    setEditingUser(null);
                  }}
                />
              )}

              <ConfirmDialog
                isOpen={Boolean(pendingDeleteUser)}
                title="Xác nhận xóa tài khoản"
                message={`Bạn có chắc muốn xóa tài khoản "${pendingDeleteUser?.displayName}" (${pendingDeleteUser?.email}) khỏi hệ thống?`}
                confirmLabel="Xóa tài khoản"
                onConfirm={() => {
                  if (pendingDeleteUser) onDeleteUserAccount(pendingDeleteUser.id);
                  setPendingDeleteUser(null);
                }}
                onCancel={() => setPendingDeleteUser(null)}
              />

              <Modal
                isOpen={Boolean(multiRoleUser)}
                onClose={() => setMultiRoleUser(null)}
                title="Cấu hình Vai trò Kiêm nhiệm (Multi-role)"
                description={
                  multiRoleUser
                    ? `Vai trò chính: ${ROLE_DEFINITIONS[multiRoleUser.role].label}. Chọn các vai trò kiêm nhiệm bổ sung.`
                    : ''
                }
                maxWidth="md"
              >
                {multiRoleUser && (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-300/40 text-amber-800 dark:text-amber-200">
                      <strong>Nguyên tắc bảo mật:</strong> Hồ sơ Tư vấn Tâm lý chỉ mở khi tài khoản có vai trò{' '}
                      <strong>Chuyên viên Tư vấn</strong>. Ban Giám hiệu hay Quản trị viên kỹ thuật không mặc định truy cập dữ liệu tâm lý.
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(Object.keys(ROLE_DEFINITIONS) as UserRole[])
                        .filter((r) => r !== multiRoleUser.role)
                        .map((r) => {
                          const checked = draftSecondaryRoles.includes(r);
                          return (
                            <label
                              key={r}
                              className={`p-2.5 rounded-xl border flex items-start gap-2 cursor-pointer transition-colors ${
                                checked
                                  ? 'bg-sky-500/12 border-sky-400/60 text-sky-800 dark:text-sky-200'
                                  : 'bg-white/70 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setDraftSecondaryRoles((prev) => [...prev, r]);
                                  } else {
                                    setDraftSecondaryRoles((prev) => prev.filter((x) => x !== r));
                                  }
                                }}
                                className="mt-0.5 rounded"
                              />
                              <div>
                                <p className="font-bold">{ROLE_DEFINITIONS[r].label}</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">
                                  {ROLE_DEFINITIONS[r].description}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                    </div>
                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                      <button
                        type="button"
                        onClick={() => setMultiRoleUser(null)}
                        className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-semibold cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await onSaveUserAccount({
                            ...multiRoleUser,
                            secondaryRoles: draftSecondaryRoles,
                          });
                          setMultiRoleUser(null);
                        }}
                        className="px-4 py-2 rounded-xl bg-sky-600 text-white font-bold cursor-pointer"
                      >
                        Lưu vai trò kiêm nhiệm
                      </button>
                    </div>
                  </div>
                )}
              </Modal>
            </div>
          )}

          {tabId === 'permissions' && (
            <div className="space-y-4">
              <div className="liquid-glass-panel rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Cấp phát & Điều chỉnh Phân quyền theo Hàng loạt (Role Assignments)
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Mọi thay đổi vai trò qua Excel bắt buộc xem trước đối chiếu, xác nhận thủ công và ghi nhật ký Audit Log.
                  </p>
                </div>
                <ModuleDataActions
                  moduleKey="role_assignments"
                  context={effectiveContext}
                  currentUser={currentUser}
                  allRecords={extractExistingRecordsForModule('role_assignments', effectiveContext)}
                  canCreate={canEditUsers}
                  canImport={canEditUsers}
                  canExport={canExportUsers}
                  createLabel="Phân quyền mới"
                  onManualSave={async (entity) => {
                    await onSaveUserAccount(entity as unknown as UserProfile);
                  }}
                  onCommitImport={safeCommitImport}
                  onLogExport={onLogExport}
                />
              </div>
              <PermissionsMatrixView
                currentUser={currentUser}
                customPermissions={customPermissions}
                onSaveMatrix={handleSavePermissionMatrix}
              />
            </div>
          )}

          {tabId === 'settings' && (
            <div className="space-y-5 max-w-3xl">
              <div>
                <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-sky-500" />
                  Cấu hình Hệ thống SchoolHub
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Tùy chỉnh thông tin trường học, quy chế thư viện và sao lưu/khôi phục JSON
                </p>
              </div>

              <LiquidCard className="p-5">
                <form onSubmit={handleSaveSettingsSubmit} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Tên Trường học
                      </label>
                      <input
                        type="text"
                        value={draftSettings.schoolName}
                        onChange={(e) => setDraftSettings({ ...draftSettings, schoolName: e.target.value })}
                        className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Năm học mặc định
                      </label>
                      <input
                        type="text"
                        value={draftSettings.academicYear}
                        onChange={(e) => setDraftSettings({ ...draftSettings, academicYear: e.target.value })}
                        className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Số ngày mượn sách mặc định (HS)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={draftSettings.defaultLoanDays}
                        onChange={(e) =>
                          setDraftSettings({ ...draftSettings, defaultLoanDays: Number(e.target.value) || 14 })
                        }
                        className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Giới hạn sách mượn tối đa / HS
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={draftSettings.maxBorrowLimit}
                        onChange={(e) =>
                          setDraftSettings({ ...draftSettings, maxBorrowLimit: Number(e.target.value) || 3 })
                        }
                        className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 font-mono-tabular"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onToggleDarkMode}
                      className="p-3 rounded-2xl bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2 font-semibold">
                        {darkMode ? <Moon className="w-4 h-4 text-sky-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                        Chế độ Giao diện
                      </span>
                      <Badge variant={darkMode ? 'purple' : 'amber'}>
                        {darkMode ? 'Tối (Dark)' : 'Sáng (Light)'}
                      </Badge>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setDraftSettings({ ...draftSettings, compactMode: !draftSettings.compactMode })
                      }
                      className="p-3 rounded-2xl bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2 font-semibold">
                        <Minimize2 className="w-4 h-4 text-sky-500" />
                        Mật độ Desktop
                      </span>
                      <Badge variant={draftSettings.compactMode ? 'blue' : 'gray'}>
                        {draftSettings.compactMode ? 'Gọn (Compact)' : 'Tiêu chuẩn'}
                      </Badge>
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                    <div>
                      {settingsSaved && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Đã lưu cấu hình hệ thống!
                        </span>
                      )}
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-bold shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-4 h-4" /> Lưu cấu hình
                    </button>
                  </div>
                </form>
              </LiquidCard>

              {/* Full Backup & Restore JSON */}
              <LiquidCard className="p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      Sao lưu & Khôi phục Dữ liệu Hệ thống (.json)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Xuất toàn bộ dữ liệu các phân hệ thành tệp JSON chuẩn hóa hoặc khôi phục lại từ bản sao lưu.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleExportJsonBackup}
                      className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Xuất Backup JSON
                    </button>
                    <label className="px-3.5 py-2 rounded-xl bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer">
                      <Upload className="w-3.5 h-3.5 text-emerald-600" /> Khôi phục JSON
                      <input type="file" accept=".json,application/json" className="hidden" onChange={handleImportJsonBackup} />
                    </label>
                  </div>
                </div>
                {backupMessage && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      backupMessage.type === 'ok'
                        ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-500/12 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {backupMessage.type === 'ok' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{backupMessage.text}</span>
                  </div>
                )}
              </LiquidCard>

              {legacyMigrationCount > 0 && onOpenLegacyMigration && (
                <LiquidCard className="p-5 border-sky-200/70 dark:border-sky-800/60 bg-sky-50/40 dark:bg-sky-950/20">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-sky-800 dark:text-sky-300">
                        Phát hiện dữ liệu cục bộ cũ trên trình duyệt ({legacyMigrationCount} bản ghi)
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                        Đồng bộ các bản ghi được tạo trước đây trong trình duyệt này lên Cloud Firestore để các tài khoản và thiết bị khác cùng sử dụng.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenLegacyMigration}
                      className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Database className="w-3.5 h-3.5" /> Chuyển lên Cloud Firestore
                    </button>
                  </div>
                </LiquidCard>
              )}

              <LiquidCard className="p-5 border-rose-200/70 dark:border-rose-900/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-rose-700 dark:text-rose-400">
                      Đặt lại Dữ liệu Hệ thống trên Cloud Firestore
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Xóa toàn bộ dữ liệu nghiệp vụ của trường hiện tại trên Cloud Firestore (và dọn bộ nhớ cục bộ cũ) để đưa hệ thống về trạng thái trống sạch.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsClearConfirmOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Đặt lại hệ thống
                  </button>
                </div>
              </LiquidCard>

              <ConfirmDialog
                isOpen={isClearConfirmOpen}
                title="Đặt lại toàn bộ dữ liệu trường trên Cloud Firestore"
                message="Thao tác này sẽ xóa toàn bộ danh sách học sinh, giáo viên, sách, lịch sử mượn trả và dữ liệu nghiệp vụ trên Cloud Firestore cho tất cả thiết bị thuộc trường này. Bạn có chắc chắn muốn tiếp tục?"
                confirmLabel="Xóa dữ liệu trên Cloud"
                onConfirm={async () => {
                  await onClearAllData();
                  setIsClearConfirmOpen(false);
                }}
                onCancel={() => setIsClearConfirmOpen(false)}
              />
            </div>
          )}
        </>
      )}
    </AppWindowShell>
  );
};
