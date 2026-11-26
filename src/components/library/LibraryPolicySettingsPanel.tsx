import React, { useEffect, useState } from 'react';
import { Sliders, Save, RotateCcw, CheckCircle2, AlertTriangle } from '../icons/UiIcons';
import {
  LibraryBorrowerGroup,
  LibraryPolicyConfig,
  LibraryRolePolicy,
  SystemSettings,
  UserProfile,
} from '../../types';
import { DEFAULT_LIBRARY_POLICY } from '../../utils/libraryRules';
import { LiquidCard } from '../common/LiquidCard';
import { Badge } from '../common/Badge';

interface LibraryPolicySettingsPanelProps {
  systemSettings: SystemSettings;
  currentUser: UserProfile;
  canEdit: boolean;
  onSaveSettings: (nextSettings: SystemSettings) => Promise<void> | void;
}

const GROUP_ORDER: LibraryBorrowerGroup[] = ['student', 'teacher', 'staff'];

export const LibraryPolicySettingsPanel: React.FC<LibraryPolicySettingsPanelProps> = ({
  systemSettings,
  currentUser,
  canEdit,
  onSaveSettings,
}) => {
  const buildInitialPolicy = (): LibraryPolicyConfig => ({
    student: {
      ...DEFAULT_LIBRARY_POLICY.student,
      ...(systemSettings.libraryPolicy?.student || {}),
      loanDays:
        systemSettings.libraryPolicy?.student?.loanDays ??
        systemSettings.defaultLoanDays ??
        DEFAULT_LIBRARY_POLICY.student.loanDays,
      maxBooks:
        systemSettings.libraryPolicy?.student?.maxBooks ??
        systemSettings.maxBorrowLimit ??
        DEFAULT_LIBRARY_POLICY.student.maxBooks,
    },
    teacher: {
      ...DEFAULT_LIBRARY_POLICY.teacher,
      ...(systemSettings.libraryPolicy?.teacher || {}),
    },
    staff: {
      ...DEFAULT_LIBRARY_POLICY.staff,
      ...(systemSettings.libraryPolicy?.staff || {}),
    },
    updatedBy: systemSettings.libraryPolicy?.updatedBy,
    updatedAt: systemSettings.libraryPolicy?.updatedAt,
  });

  const [policy, setPolicy] = useState<LibraryPolicyConfig>(buildInitialPolicy);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    setPolicy(buildInitialPolicy());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemSettings]);

  const updateGroupField = <K extends keyof LibraryRolePolicy>(
    group: LibraryBorrowerGroup,
    field: K,
    value: LibraryRolePolicy[K]
  ) => {
    setPolicy((prev) => ({
      ...prev,
      [group]: {
        ...prev[group],
        [field]: value,
      },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg(null);
    setSavedMsg(null);

    for (const g of GROUP_ORDER) {
      const p = policy[g];
      if (p.loanDays < 1 || p.maxDays < p.loanDays) {
        setErrMsg(`Nhóm ${p.label}: Thời hạn tối đa (${p.maxDays} ngày) phải >= Số ngày mượn mặc định (${p.loanDays} ngày).`);
        return;
      }
      if (p.maxBooks < 1) {
        setErrMsg(`Nhóm ${p.label}: Số sách tối đa phải >= 1.`);
        return;
      }
    }

    const nextPolicy: LibraryPolicyConfig = {
      ...policy,
      updatedBy: currentUser.displayName,
      updatedAt: new Date().toISOString(),
    };

    await onSaveSettings({
      ...systemSettings,
      defaultLoanDays: nextPolicy.student.loanDays,
      maxBorrowLimit: nextPolicy.student.maxBooks,
      libraryPolicy: nextPolicy,
    });
    setSavedMsg('Đã cập nhật chính sách mượn trả thư viện theo từng nhóm bạn đọc.');
    setTimeout(() => setSavedMsg(null), 3000);
  };

  const handleResetDefault = () => {
    setPolicy({ ...DEFAULT_LIBRARY_POLICY });
    setErrMsg(null);
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleResetDefault}
            className="px-3.5 py-2 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Khôi phục mặc định
          </button>
        </div>
      )}

      {errMsg && (
        <div className="p-3 rounded-xl glass-subsurface bg-rose-500/12 border-rose-400/40 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errMsg}</span>
        </div>
      )}
      {savedMsg && (
        <div className="p-3 rounded-xl glass-subsurface bg-emerald-500/12 border-emerald-400/40 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{savedMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {GROUP_ORDER.map((group) => {
            const p = policy[group];
            return (
              <LiquidCard key={group} className="p-5 space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2.5 border-b border-white/40 dark:border-white/10">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{p.label}</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {group === 'student'
                        ? 'Áp dụng cho Học sinh'
                        : group === 'teacher'
                        ? 'GV Chủ nhiệm & GV Bộ môn'
                        : 'Cán bộ, Nhân viên & BGH'}
                    </p>
                  </div>
                  <Badge variant={group === 'student' ? 'blue' : group === 'teacher' ? 'mint' : 'purple'} size="sm">
                    {p.maxBooks} cuốn · {p.loanDays}d
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Ngày mượn mặc định
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={180}
                      disabled={!canEdit}
                      value={p.loanDays}
                      onChange={(e) => updateGroupField(group, 'loanDays', Math.max(1, Number(e.target.value) || 1))}
                      className="w-full glass-subsurface rounded-xl px-2.5 py-1.5 font-mono-tabular text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Tổng ngày tối đa
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      disabled={!canEdit}
                      value={p.maxDays}
                      onChange={(e) => updateGroupField(group, 'maxDays', Math.max(1, Number(e.target.value) || 1))}
                      className="w-full glass-subsurface rounded-xl px-2.5 py-1.5 font-mono-tabular text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Số sách tối đa
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      disabled={!canEdit}
                      value={p.maxBooks}
                      onChange={(e) => updateGroupField(group, 'maxBooks', Math.max(1, Number(e.target.value) || 1))}
                      className="w-full glass-subsurface rounded-xl px-2.5 py-1.5 font-mono-tabular text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Số lần gia hạn tối đa
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      disabled={!canEdit}
                      value={p.maxRenewals}
                      onChange={(e) => updateGroupField(group, 'maxRenewals', Math.max(0, Number(e.target.value) || 0))}
                      className="w-full glass-subsurface rounded-xl px-2.5 py-1.5 font-mono-tabular text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Số ngày mỗi lần gia hạn
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      disabled={!canEdit}
                      value={p.renewDays}
                      onChange={(e) => updateGroupField(group, 'renewDays', Math.max(1, Number(e.target.value) || 1))}
                      className="w-full glass-subsurface rounded-xl px-2.5 py-1.5 font-mono-tabular text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Chờ mượn lại (ngày)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      disabled={!canEdit}
                      value={p.reborrowCooldownDays}
                      onChange={(e) =>
                        updateGroupField(group, 'reborrowCooldownDays', Math.max(0, Number(e.target.value) || 0))
                      }
                      className="w-full glass-subsurface rounded-xl px-2.5 py-1.5 font-mono-tabular text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Phí quá hạn / ngày (VNĐ)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    disabled={!canEdit}
                    value={p.overdueFinePerDay}
                    onChange={(e) =>
                      updateGroupField(group, 'overdueFinePerDay', Math.max(0, Number(e.target.value) || 0))
                    }
                    className="w-full glass-subsurface rounded-xl px-2.5 py-1.5 font-mono-tabular text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>

                <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={p.allowOverdueRenewal}
                    onChange={(e) => updateGroupField(group, 'allowOverdueRenewal', e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-slate-700 dark:text-slate-200 font-medium">
                    Cho phép xin gia hạn khi đã quá hạn
                  </span>
                </label>
              </LiquidCard>
            );
          })}
        </div>

        {canEdit && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {policy.updatedAt ? `Cập nhật gần nhất bởi ${policy.updatedBy || 'Hệ thống'}` : 'Đang dùng cấu hình chuẩn'}
            </span>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm inline-flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Save className="w-4 h-4" /> Lưu Chính sách Thư viện
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
