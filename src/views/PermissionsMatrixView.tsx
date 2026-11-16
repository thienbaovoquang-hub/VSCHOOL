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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Ma trận Phân quyền Hệ sinh thái (RBAC Matrix)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Cấu hình quyền hạn cho 8 vai trò trên 17 phân hệ · Hồ sơ Tư vấn tâm lý luôn khóa truy cập trái phép
          </p>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Khôi phục mặc định
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 text-white text-xs font-bold shadow-md shadow-indigo-500/20 hover:opacity-95 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Lưu Ma trận Quyền
            </button>
          </div>
        )}
      </div>

      {isSaved && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Đã lưu và áp dụng ma trận quyền hạn vào cấu hình hệ thống!</span>
        </div>
      )}

      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
        {ROLES_ORDER.map((r) => {
          const info = ROLE_DEFINITIONS[r];
          return (
            <button
              key={r}
              type="button"
              onClick={() => setSelectedRole(r)}
              className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all border cursor-pointer ${
                selectedRole === r
                  ? 'bg-slate-900 dark:bg-sky-500 text-white border-slate-900 dark:border-sky-500 shadow-sm'
                  : 'bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800'
              }`}
            >
              {info.label}
            </button>
          );
        })}
      </div>

      <LiquidCard className="p-0 overflow-hidden">
        <div className="p-4 bg-slate-50/70 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
              Cấu hình quyền cho: {ROLE_DEFINITIONS[selectedRole].label}
            </span>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
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
            <thead className="bg-slate-50/40 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
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
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {MODULE_LABELS.map((mod) => {
                const actions: AppAction[] = matrix[selectedRole]?.[mod.id] || [];
                const isAdminRole = selectedRole === 'admin';
                const locked = isCounselingLocked(selectedRole, mod.id);

                return (
                  <tr key={mod.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3 text-left font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
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
                            className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all ${
                              has
                                ? 'bg-emerald-500 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700'
                            } ${!canEdit || isAdminRole || locked ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
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
      </LiquidCard>
    </div>
  );
};
