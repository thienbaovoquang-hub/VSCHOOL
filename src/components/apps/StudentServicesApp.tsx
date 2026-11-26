import React, { useMemo, useState } from 'react';
import {
  FileCheck, Plus, CheckCircle2, XCircle, Calendar
} from '../icons/UiIcons';
import {
  CounselingRequest,
  ExportHistoryRecord,
  ImportHistoryRecord,
  ImportModuleKey,
  PermissionMatrix,
  StudentLeaveRequest,
  Survey,
  SurveyResponse,
  Teacher,
  UserProfile,
} from '../../types';
import { AppWindowShell } from '../shared/AppWindowShell';
import { EmptyState } from '../shared/EmptyState';
import { LiquidCard } from '../common/LiquidCard';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { ModuleDataActions } from '../importExport/ModuleDataActions';
import type { ValidationDbContext } from '../../utils/importExport/validator';
import { resolveCatalogOptions } from '../../utils/catalogs/catalogRegistry';
import { SurveysView } from '../../views/SurveysView';
import { CounselingView } from '../../views/CounselingView';
import {
  DEFAULT_PERMISSIONS,
  filterLeaveRequestsByScope,
  hasPermission,
  userHasRole,
} from '../../utils/rbac';

interface StudentServicesAppProps {
  activeTab: string;
  currentUser: UserProfile;
  customPermissions?: PermissionMatrix;
  validationContext?: ValidationDbContext;
  teachers: Teacher[];
  surveys: Survey[];
  surveyResponses: SurveyResponse[];
  counselingRequests: CounselingRequest[];
  leaveRequests: StudentLeaveRequest[];
  onSelectTab: (tabId: string) => void;
  onSubmitSurveyResponse: (res: SurveyResponse) => Promise<void>;
  onCreateSurvey: (survey: Survey) => Promise<void>;
  onSubmitCounseling: (req: CounselingRequest) => Promise<void>;
  onUpdateCounselingStatus: (
    id: string,
    status: CounselingRequest['status'],
    notes?: string
  ) => Promise<void>;
  onSaveLeaveRequest: (req: StudentLeaveRequest) => void;
  onUnifiedImportCommit?: (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => Promise<void> | void;
  onLogExport?: (record: ExportHistoryRecord) => Promise<void> | void;
}

export const StudentServicesApp: React.FC<StudentServicesAppProps> = ({
  activeTab,
  currentUser,
  customPermissions = DEFAULT_PERMISSIONS,
  validationContext,
  teachers,
  surveys,
  surveyResponses,
  counselingRequests,
  leaveRequests,
  onSelectTab,
  onSubmitSurveyResponse,
  onCreateSurvey,
  onSubmitCounseling,
  onUpdateCounselingStatus,
  onSaveLeaveRequest,
  onUnifiedImportCommit,
  onLogExport,
}) => {
  const canApproveLeave =
    hasPermission(currentUser, 'feedback', 'approve', customPermissions) ||
    userHasRole(currentUser, 'homeroom_teacher');

  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState<{
    type: StudentLeaveRequest['type'];
    fromDate: string;
    toDate: string;
    reason: string;
  }>({
    type: 'Nghỉ ốm',
    fromDate: new Date().toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0],
    reason: '',
  });

  const leaveTypeOptions = useMemo(
    () => resolveCatalogOptions({ catalogId: 'leave_request_type', runtime: validationContext }),
    [validationContext]
  );

  const visibleLeaves = useMemo(
    () => filterLeaveRequestsByScope(leaveRequests, currentUser, teachers),
    [leaveRequests, currentUser, teachers]
  );

  const handleSubmitLeave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveForm.reason.trim()) return;
    const code = `DON-${new Date().getFullYear()}-${String(leaveRequests.length + 1).padStart(3, '0')}`;
    onSaveLeaveRequest({
      id: code,
      requestCode: code,
      studentId: currentUser.id,
      studentName: currentUser.displayName,
      studentCode: currentUser.studentCode || 'STU-0001',
      className: currentUser.className || '11A1',
      type: leaveForm.type,
      fromDate: leaveForm.fromDate,
      toDate: leaveForm.toDate,
      reason: leaveForm.reason.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    setIsLeaveModalOpen(false);
    setLeaveForm({
      type: 'Nghỉ ốm',
      fromDate: new Date().toISOString().split('T')[0],
      toDate: new Date().toISOString().split('T')[0],
      reason: '',
    });
  };

  return (
    <AppWindowShell
      appId="services"
      activeTab={activeTab}
      userRole={currentUser.role}
      userProfile={currentUser}
      customPermissions={customPermissions}
      onSelectTab={onSelectTab}
    >
      {(tabId) => (
        <>
          {tabId === 'surveys' && (
            <SurveysView
              surveys={surveys}
              surveyResponses={surveyResponses}
              currentUser={currentUser}
              customPermissions={customPermissions}
              validationContext={validationContext}
              onSubmitSurveyResponse={onSubmitSurveyResponse}
              onCreateSurvey={onCreateSurvey}
              onUnifiedImportCommit={onUnifiedImportCommit}
              onLogExport={onLogExport}
            />
          )}

          {tabId === 'counseling' && (
            <CounselingView
              counselingRequests={counselingRequests}
              currentUser={currentUser}
              onSubmitRequest={onSubmitCounseling}
              onUpdateStatus={onUpdateCounselingStatus}
            />
          )}

          {tabId === 'leave' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-end gap-2">
                {validationContext && onUnifiedImportCommit && (
                  <ModuleDataActions
                    moduleKey="leave_migration"
                    context={validationContext}
                    currentUser={currentUser}
                    allRecords={visibleLeaves as unknown as Record<string, unknown>[]}
                    filteredRecords={visibleLeaves as unknown as Record<string, unknown>[]}
                    canCreate={false}
                    canImport={canApproveLeave && (currentUser.role === 'admin' || currentUser.role === 'principal' || currentUser.role === 'homeroom_teacher')}
                    canExport={canApproveLeave || visibleLeaves.length > 0}
                    onCommitImport={(key, items, hist) => onUnifiedImportCommit(key, items, hist)}
                    onLogExport={onLogExport}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Plus className="w-4 h-4" /> Tạo Đơn mới
                </button>
              </div>

              {canApproveLeave && (
                <div className="px-3.5 py-2.5 rounded-xl glass-subsurface bg-amber-500/12 border-amber-400/35 text-[11px] text-amber-800 dark:text-amber-300">
                  Lưu ý kiểm soát: Chỉ dùng Excel để chuyển đổi dữ liệu đơn xin phép lịch sử có kiểm toán. Hồ sơ tư vấn tâm lý được khóa tuyệt đối khỏi tính năng import/export hàng loạt.
                </div>
              )}

              {visibleLeaves.length === 0 ? (
                <EmptyState
                  icon={FileCheck}
                  title="Chưa có đơn xin nghỉ hoặc xác nhận"
                  description="Học sinh có thể tạo đơn xin nghỉ ốm, việc gia đình hoặc xin giấy xác nhận trực tuyến."
                  action={
                    <button
                      type="button"
                      onClick={() => setIsLeaveModalOpen(true)}
                      className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Plus className="w-4 h-4" /> Nộp đơn ngay
                    </button>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {visibleLeaves.map((lv) => (
                    <LiquidCard key={lv.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono-tabular text-xs font-bold text-sky-700 dark:text-sky-300">
                            {lv.requestCode}
                          </span>
                          <Badge variant="blue" size="sm">{lv.type}</Badge>
                          <Badge
                            variant={
                              lv.status === 'approved'
                                ? 'mint'
                                : lv.status === 'rejected'
                                ? 'pink'
                                : 'amber'
                            }
                            size="sm"
                          >
                            {lv.status === 'approved'
                              ? 'Đã duyệt'
                              : lv.status === 'rejected'
                              ? 'Từ chối'
                              : 'Chờ duyệt'}
                          </Badge>
                        </div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          {lv.studentName} ({lv.className})
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300">{lv.reason}</p>
                        <p className="text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" /> {lv.fromDate} → {lv.toDate}
                        </p>
                      </div>

                      {canApproveLeave && lv.status === 'pending' && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              onSaveLeaveRequest({
                                ...lv,
                                status: 'approved',
                                reviewedBy: currentUser.displayName,
                              })
                            }
                            className="px-3 py-1.5 rounded-xl glass-subsurface bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Duyệt
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onSaveLeaveRequest({
                                ...lv,
                                status: 'rejected',
                                reviewedBy: currentUser.displayName,
                              })
                            }
                            className="px-3 py-1.5 rounded-xl glass-subsurface bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Từ chối
                          </button>
                        </div>
                      )}
                    </LiquidCard>
                  ))}
                </div>
              )}

              <Modal
                isOpen={isLeaveModalOpen}
                onClose={() => setIsLeaveModalOpen(false)}
                title="Tạo Đơn Xin Phép / Xác Nhận"
                maxWidth="md"
              >
                <form onSubmit={handleSubmitLeave} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Loại đơn</label>
                    <select
                      value={leaveForm.type}
                      onChange={(e) =>
                        setLeaveForm({ ...leaveForm, type: e.target.value as StudentLeaveRequest['type'] })
                      }
                      className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/40"
                    >
                      {leaveTypeOptions.map((opt) => (
                        <option key={opt.id} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Từ ngày</label>
                      <input
                        type="date"
                        value={leaveForm.fromDate}
                        onChange={(e) => setLeaveForm({ ...leaveForm, fromDate: e.target.value })}
                        className="w-full glass-subsurface rounded-xl px-3 py-2 font-mono-tabular text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/40"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Đến ngày</label>
                      <input
                        type="date"
                        value={leaveForm.toDate}
                        onChange={(e) => setLeaveForm({ ...leaveForm, toDate: e.target.value })}
                        className="w-full glass-subsurface rounded-xl px-3 py-2 font-mono-tabular text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/40"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Lý do chi tiết *</label>
                    <textarea
                      rows={3}
                      required
                      value={leaveForm.reason}
                      onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                      className="w-full glass-subsurface rounded-xl p-3 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/40"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-3 border-t border-white/40 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => setIsLeaveModalOpen(false)}
                      className="px-4 py-2 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer transition-colors"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-sm cursor-pointer transition-all"
                    >
                      Gửi đơn
                    </button>
                  </div>
                </form>
              </Modal>
            </div>
          )}

        </>
      )}
    </AppWindowShell>
  );
};
