import React, { useEffect, useState } from 'react';
import {
  ShieldAlert, Check, X, Save, RefreshCw, CheckCircle2, Lock
} from 'lucide-react';
import { LiquidCard } from '../components/common/LiquidCard';
import { Badge } from '../components/common/Badge';
import { UserRole, AppModuleId, AppAction, UserProfile, PermissionMatrix } from '../types';
import { DEFAULT_PERMISSIONS, ROLE_DEFINITIONS } from '../utils/rbac';
import confetti from 'canvas-confetti';

interface PermissionsMatrixViewProps {
  currentUser: UserProfile;
  customPermissions?: PermissionMatrix;
  onSaveMatrix?: (matrix: PermissionMatrix) => Promise<void> | void;
  extraTopActions?: React.ReactNode;
}

const MODULE_LABELS: { id: AppModuleId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'students', label: 'Học sinh' },
  { id: 'staff', label: 'Giáo viên' },
  { id: 'classes', label: 'Lớp học' },
  { id: 'timetable', label: 'Thời khóa biểu' },
  { id: 'academic', label: 'Sổ điểm & Chuyên cần' },
  { id: 'emulation', label: 'Thi đua & Phong trào' },
  { id: 'rules', label: 'Nội quy & Tiêu chí' },
  { id: 'library', label: 'Thư viện RFID' },
  { id: 'surveys', label: 'Khảo sát' },
  { id: 'feedback', label: 'Phản ánh' },
  { id: 'counseling', label: 'Tư vấn học đường (Bảo mật)' },
  { id: 'announcements', label: 'Thông báo' },
  { id: 'facilities', label: 'Cơ sở vật chất' },
  { id: 'reports', label: 'Báo cáo BGH' },
  { id: 'datacenter', label: 'Dữ liệu Excel' },
  { id: 'permissions', label: 'Phân quyền' },
];

const ROLES_ORDER: UserRole[] = [
  'admin',
  'principal',
  'homeroom_teacher',
  'subject_teacher',
  'librarian',
  'counselor',
  'staff',
  'student',
];

export const PermissionsMatrixView: React.FC<PermissionsMatrixViewProps> = ({
  currentUser,
  customPermissions = DEFAULT_PERMISSIONS,
  onSaveMatrix,
  extraTopActions,
}) => {
  const [matrix, setMatrix] = useState<PermissionMatrix>(() =>
    JSON.parse(JSON.stringify(customPermissions))
  );
  const [selectedRole, setSelectedRole] = useState<UserRole>('homeroom_teacher');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setMatrix(JSON.parse(JSON.stringify(customPermissions)));
  }, [customPermissions]);

  const canEdit = currentUser.role === 'admin';

  const isCounselingLocked = (role: UserRole, mod: AppModuleId) =>
    mod === 'counseling' && role !== 'counselor' && role !== 'student';

  const toggleAction = (role: UserRole, mod: AppModuleId, action: AppAction) => {
    if (!canEdit || role === 'admin' || isCounselingLocked(role, mod)) return;

    setMatrix((prev) => {
      const copy: PermissionMatrix = JSON.parse(JSON.stringify(prev));
      if (!copy[role]) copy[role] = { ...DEFAULT_PERMISSIONS[role] };
      if (!copy[role][mod]) copy[role][mod] = [];

      const list: AppAction[] = [...copy[role][mod]];
      const idx = list.indexOf(action);
      if (idx >= 0) {
        list.splice(idx, 1);
      } else {
        list.push(action);
      }
      copy[role][mod] = list;
      return copy;
    });
    setIsSaved(false);
  };

  const handleSave = async () => {
    if (onSaveMatrix) {
      await onSaveMatrix(matrix);
    }
    setIsSaved(true);
    confetti({ particleCount: 40, spread: 50 });
  };

  const handleReset = async () => {
    const fresh: PermissionMatrix = JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS));
    setMatrix(fresh);
    if (onSaveMatrix) {
      await onSaveMatrix(fresh);
    }
    setIsSaved(false);
  };

  return (
    <div className="space-y-5">
      {(extraTopActions || canEdit) && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {extraTopActions}
          {canEdit && (
            <>
              <button
                type="button"
                onClick={handleReset}
                className="px-3.5 py-2 rounded-xl glass-subsurface text-slate-700 dark:text-slate-200 hover:bg-white/75 dark:hover:bg-white/10 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Khôi phục mặc định
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 text-white text-xs font-bold shadow-md shadow-indigo-500/25 hover:opacity-95 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                Lưu Ma trận Quyền
              </button>
            </>
          )}
        </div>
      )}

      {isSaved && (
        <div className="p-3.5 rounded-2xl glass-subsurface bg-emerald-500/12 border-emerald-400/40 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Đã lưu và áp dụng ma trận quyền hạn vào cấu hình hệ thống!</span>
        </div>
      )}

      <div className="glass-pill-tray p-1.5 rounded-2xl flex items-center gap-1 overflow-x-auto text-xs scrollbar-none">
        {ROLES_ORDER.map((r) => {
          const info = ROLE_DEFINITIONS[r];
          const active = selectedRole === r;
          return (
            <button
              key={r}
              type="button"
              onClick={() => setSelectedRole(r)}
              className={`px-3.5 py-2 rounded-xl font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                active ? 'glass-pill-tab-active' : 'glass-pill-tab'
              }`}
            >
              {info.label}
            </button>
          );
        })}
      </div>

      <div className="glass-table-shell">
        <div className="p-4 sm:px-5 glass-table-head flex flex-wrap items-center justify-between gap-2 text-xs">
          <div>
            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              Cấu hình quyền cho: {ROLE_DEFINITIONS[selectedRole].label}
            </span>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5 font-normal">
              {ROLE_DEFINITIONS[selectedRole].description}
            </p>
          </div>
          {selectedRole === 'admin' ? (
            <Badge variant="pink" size="sm">Quản trị hệ thống</Badge>
          ) : (
            <Badge variant="blue" size="sm">Tùy biến được</Badge>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs">
            <thead className="glass-table-head text-xs">
              <tr>
                <th className="px-5 py-3 text-left">Phân hệ nghiệp vụ</th>
                <th className="px-3 py-3">Xem</th>
                <th className="px-3 py-3">Thêm</th>
                <th className="px-3 py-3">Sửa</th>
                <th className="px-3 py-3">Xóa</th>
                <th className="px-3 py-3">Duyệt</th>
                <th className="px-3 py-3">Xuất file</th>
              </tr>
            </thead>
            <tbody>
              {MODULE_LABELS.map((mod) => {
                const actions: AppAction[] = matrix[selectedRole]?.[mod.id] || [];
                const isAdminRole = selectedRole === 'admin';
                const locked = isCounselingLocked(selectedRole, mod.id);

                return (
                  <tr key={mod.id} className="glass-table-row">
                    <td className="px-5 py-3 text-left font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <span>{mod.label}</span>
                      {locked && (
                        <span title="Khóa bảo mật riêng tư" className="inline-flex">
                          <Lock className="w-3.5 h-3.5 text-amber-500" />
                        </span>
                      )}
                    </td>

                    {(['view', 'create', 'edit', 'delete', 'approve', 'export'] as AppAction[]).map((act) => {
                      const has = locked ? false : (isAdminRole && mod.id !== 'counseling') || actions.includes(act);

                      return (
                        <td key={act} className="px-3 py-3">
                          <button
                            type="button"
                            disabled={!canEdit || isAdminRole || locked}
                            onClick={() => toggleAction(selectedRole, mod.id, act)}
                            aria-label={`${mod.label} - ${act}`}
                            className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all ${
                              has
                                ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-xs shadow-emerald-500/25'
                                : 'glass-subsurface text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            } ${!canEdit || isAdminRole || locked ? 'cursor-default opacity-75' : 'cursor-pointer'}`}
                          >
                            {has ? <Check className="w-4 h-4 stroke-[3]" /> : <X className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
