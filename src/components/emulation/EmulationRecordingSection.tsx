import React, { useMemo, useState } from 'react';
import {
  ClipboardPlus,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Lock,
  XCircle,
  Users,
} from '../icons/UiIcons';
import {
  EmulationRecord,
  EmulationRecordWorkflowStatus,
  ExportHistoryRecord,
  ImportHistoryRecord,
  ImportModuleKey,
  RuleCriterion,
  RuleTargetScope,
  SchoolClass,
  Student,
  UserProfile,
} from '../../types';
import { LiquidCard } from '../common/LiquidCard';
import { Badge } from '../common/Badge';
import { EmptyState } from '../shared/EmptyState';
import { ModuleDataActions } from '../importExport/ModuleDataActions';
import type { ValidationDbContext } from '../../utils/importExport/validator';
import {
  detectBulkRecordDuplicates,
  resolveCriterionAppliedPoints,
} from '../../utils/emulationRules';

interface EmulationRecordingSectionProps {
  currentUser: UserProfile;
  validationContext?: ValidationDbContext;
  students: Student[];
  classes: SchoolClass[];
  ruleCriteria: RuleCriterion[];
  emulationRecords: EmulationRecord[];
  canCreate: boolean;
  canApprove: boolean;
  canExport: boolean;
  onSaveRecord: (rec: EmulationRecord) => Promise<void> | void;
  onUnifiedImportCommit?: (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => Promise<void> | void;
  onLogExport?: (record: ExportHistoryRecord) => Promise<void> | void;
}

const STATUS_BADGE: Record<EmulationRecordWorkflowStatus, { label: string; variant: 'mint' | 'blue' | 'amber' | 'pink' | 'gray' }> = {
  draft: { label: 'Bản nháp', variant: 'gray' },
  pending_verification: { label: 'Chờ xác minh', variant: 'amber' },
  verified: { label: 'Đã xác minh', variant: 'blue' },
  pending_approval: { label: 'Chờ phê duyệt', variant: 'amber' },
  recorded: { label: 'Đã ghi nhận chính thức', variant: 'mint' },
  insufficient_evidence: { label: 'Thiếu minh chứng', variant: 'pink' },
  cancelled: { label: 'Đã hủy', variant: 'gray' },
};

export const EmulationRecordingSection: React.FC<EmulationRecordingSectionProps> = ({
  currentUser,
  validationContext,
  students,
  classes,
  ruleCriteria,
  emulationRecords,
  canCreate,
  canApprove,
  canExport,
  onSaveRecord,
  onUnifiedImportCommit,
  onLogExport,
}) => {
  const [targetType, setTargetType] = useState<RuleTargetScope>('individual');
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [targetClassId, setTargetClassId] = useState('');
  const [groupName, setGroupName] = useState('');

  const [criterionId, setCriterionId] = useState('');
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceNote, setEvidenceNote] = useState('');
  const [isSensitive, setIsSensitive] = useState(false);

  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [overridePoints, setOverridePoints] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [recordStatusFilter, setRecordStatusFilter] = useState<'all' | EmulationRecordWorkflowStatus>('all');
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const activeCriteria = useMemo(
    () => ruleCriteria.filter((c) => c.status === 'active'),
    [ruleCriteria]
  );

  const selectedCriterion = activeCriteria.find((c) => c.id === criterionId) || null;

  const filteredClassStudents = useMemo(
    () =>
      students.filter((s) =>
        selectedClassFilter === 'all' ? true : s.classId === selectedClassFilter || s.className === selectedClassFilter
      ),
    [students, selectedClassFilter]
  );

  const duplicateStudentIds = useMemo(() => {
    if (targetType !== 'individual' || !criterionId || selectedStudentIds.length === 0) return [];
    return detectBulkRecordDuplicates(emulationRecords, selectedStudentIds, criterionId, occurredAt);
  }, [emulationRecords, targetType, criterionId, selectedStudentIds, occurredAt]);

  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllFilteredStudents = () => {
    const ids = filteredClassStudents.map((s) => s.id);
    setSelectedStudentIds(ids);
  };

  const handleSubmitRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCriterion) {
      setFeedback({ ok: false, msg: 'Vui lòng chọn tiêu chí nội quy đang áp dụng.' });
      return;
    }

    const baseOrOverride =
      overrideEnabled && overridePoints !== ''
        ? Number(overridePoints)
        : null;

    if (overrideEnabled && overrideReason.trim().length < 3) {
      setFeedback({ ok: false, msg: 'Khi điều chỉnh điểm khác chuẩn, bắt buộc nhập lý do (tối thiểu 3 ký tự).' });
      return;
    }

    if (!selectedCriterion.pointsSpecified && !overrideEnabled) {
      setFeedback({ ok: false, msg: 'Tiêu chí này chưa gán điểm chuẩn — bật "Điều chỉnh điểm" hoặc cấu hình điểm trong mục Nội quy.' });
      return;
    }

    const pointsApplied = resolveCriterionAppliedPoints(selectedCriterion, baseOrOverride);
    const now = new Date().toISOString();
    const initialStatus: EmulationRecordWorkflowStatus = canApprove ? 'recorded' : 'pending_verification';

    if (targetType === 'individual') {
      if (selectedStudentIds.length === 0) {
        setFeedback({ ok: false, msg: 'Vui lòng chọn ít nhất 1 học sinh.' });
        return;
      }
      for (const stuId of selectedStudentIds) {
        const stu = students.find((s) => s.id === stuId);
        if (!stu) continue;
        const suffix = `${Date.now().toString().slice(-5)}-${Math.random().toString(36).slice(2, 5)}`;
        await onSaveRecord({
          id: `EMU-${suffix}`,
          recordCode: `TD-${suffix.toUpperCase()}`,
          targetType: 'individual',
          studentId: stu.id,
          studentCode: stu.studentCode,
          studentName: stu.fullName,
          classId: stu.classId,
          className: stu.className,
          grade: stu.grade,
          criterionId: selectedCriterion.id,
          criterionName: selectedCriterion.name,
          categoryName: selectedCriterion.categoryName,
          type: selectedCriterion.type,
          pointsApplied,
          pointsOverridden: overrideEnabled,
          overrideReason: overrideEnabled ? overrideReason.trim() : undefined,
          occurredAt,
          location: location.trim() || undefined,
          description: description.trim() || selectedCriterion.name,
          isSensitive,
          evidenceNote: evidenceNote.trim() || undefined,
          reporterId: currentUser.id,
          reporterName: currentUser.displayName,
          reporterRole: currentUser.role,
          status: initialStatus,
          verifiedBy: canApprove ? currentUser.displayName : undefined,
          verifiedAt: canApprove ? now : undefined,
          approvedBy: canApprove ? currentUser.displayName : undefined,
          approvedAt: canApprove ? now : undefined,
          createdAt: now,
        });
      }
      setFeedback({
        ok: true,
        msg: `Đã lập ${selectedStudentIds.length} bản ghi thi đua (${STATUS_BADGE[initialStatus].label}).`,
      });
      setSelectedStudentIds([]);
    } else if (targetType === 'class') {
      const cls = classes.find((c) => c.id === targetClassId);
      if (!cls) {
        setFeedback({ ok: false, msg: 'Vui lòng chọn lớp học.' });
        return;
      }
      const suffix = `${Date.now().toString().slice(-5)}-${Math.random().toString(36).slice(2, 5)}`;
      await onSaveRecord({
        id: `EMU-${suffix}`,
        recordCode: `TD-${suffix.toUpperCase()}`,
        targetType: 'class',
        classId: cls.id,
        className: cls.name,
        grade: cls.grade,
        criterionId: selectedCriterion.id,
        criterionName: selectedCriterion.name,
        categoryName: selectedCriterion.categoryName,
        type: selectedCriterion.type,
        pointsApplied,
        pointsOverridden: overrideEnabled,
        overrideReason: overrideEnabled ? overrideReason.trim() : undefined,
        occurredAt,
        location: location.trim() || undefined,
        description: description.trim() || selectedCriterion.name,
        isSensitive,
        evidenceNote: evidenceNote.trim() || undefined,
        reporterId: currentUser.id,
        reporterName: currentUser.displayName,
        reporterRole: currentUser.role,
        status: initialStatus,
        verifiedBy: canApprove ? currentUser.displayName : undefined,
        verifiedAt: canApprove ? now : undefined,
        approvedBy: canApprove ? currentUser.displayName : undefined,
        approvedAt: canApprove ? now : undefined,
        createdAt: now,
      });
      setFeedback({ ok: true, msg: `Đã ghi nhận thi đua tập thể lớp ${cls.name}.` });
    } else {
      if (!groupName.trim()) {
        setFeedback({ ok: false, msg: 'Vui lòng nhập tên tổ / nhóm.' });
        return;
      }
      const suffix = `${Date.now().toString().slice(-5)}-${Math.random().toString(36).slice(2, 5)}`;
      await onSaveRecord({
        id: `EMU-${suffix}`,
        recordCode: `TD-${suffix.toUpperCase()}`,
        targetType: 'group',
        groupName: groupName.trim(),
        criterionId: selectedCriterion.id,
        criterionName: selectedCriterion.name,
        categoryName: selectedCriterion.categoryName,
        type: selectedCriterion.type,
        pointsApplied,
        pointsOverridden: overrideEnabled,
        overrideReason: overrideEnabled ? overrideReason.trim() : undefined,
        occurredAt,
        location: location.trim() || undefined,
        description: description.trim() || selectedCriterion.name,
        isSensitive,
        evidenceNote: evidenceNote.trim() || undefined,
        reporterId: currentUser.id,
        reporterName: currentUser.displayName,
        reporterRole: currentUser.role,
        status: initialStatus,
        createdAt: now,
      });
      setFeedback({ ok: true, msg: `Đã ghi nhận thi đua cho nhóm "${groupName}".` });
      setGroupName('');
    }

    setDescription('');
    setEvidenceNote('');
    setOverrideEnabled(false);
    setOverridePoints('');
    setOverrideReason('');
  };

  const handleTransitionStatus = async (rec: EmulationRecord, nextStatus: EmulationRecordWorkflowStatus) => {
    const now = new Date().toISOString();
    await onSaveRecord({
      ...rec,
      status: nextStatus,
      ...(nextStatus === 'verified' ? { verifiedBy: currentUser.displayName, verifiedAt: now } : {}),
      ...(nextStatus === 'recorded' ? { approvedBy: currentUser.displayName, approvedAt: now } : {}),
      updatedAt: now,
    });
  };

  const visibleRecords = useMemo(() => {
    return emulationRecords.filter((r) => {
      if (recordStatusFilter !== 'all' && r.status !== recordStatusFilter) return false;
      return true;
    });
  }, [emulationRecords, recordStatusFilter]);

  return (
    <div className="space-y-5">
      {(canCreate || canExport) && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ModuleDataActions
            moduleKey="emulation_records"
            context={validationContext ?? {}}
            currentUser={currentUser}
            allRecords={emulationRecords as unknown as Record<string, unknown>[]}
            filteredRecords={visibleRecords as unknown as Record<string, unknown>[]}
            canCreate={false}
            canImport={canApprove}
            canExport={canExport}
            onCommitImport={onUnifiedImportCommit ?? (async () => {})}
            onLogExport={onLogExport}
          />
        </div>
      )}

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            feedback.ok
              ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/12 text-rose-700 dark:text-rose-300'
          }`}
        >
          {feedback.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {canCreate && (
        <LiquidCard className="p-5">
          <form onSubmit={handleSubmitRecord} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Target selector */}
              <div className="lg:col-span-6 space-y-3">
                <div>
                  <label className="block font-semibold mb-1.5 text-slate-700 dark:text-slate-200">Đối tượng ghi nhận</label>
                  <div className="glass-pill-tray grid grid-cols-3 gap-1">
                    {[
                      { id: 'individual' as const, label: 'Cá nhân HS' },
                      { id: 'class' as const, label: 'Tập thể lớp' },
                      { id: 'group' as const, label: 'Tổ / Nhóm' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setTargetType(opt.id)}
                        className={`py-1.5 rounded-xl font-semibold cursor-pointer transition-all ${
                          targetType === opt.id
                            ? 'glass-pill-tab-active'
                            : 'glass-pill-tab'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {targetType === 'individual' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <select
                        value={selectedClassFilter}
                        onChange={(e) => setSelectedClassFilter(e.target.value)}
                        className="glass-subsurface rounded-xl px-2.5 py-1.5 font-semibold"
                      >
                        <option value="all">Tất cả lớp ({students.length} HS)</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            Lớp {c.name}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAllFilteredStudents}
                          className="text-sky-600 dark:text-sky-400 font-semibold hover:underline cursor-pointer"
                        >
                          Chọn cả lớp
                        </button>
                        {selectedStudentIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedStudentIds([])}
                            className="text-slate-500 hover:text-rose-500 cursor-pointer"
                          >
                            Bỏ chọn ({selectedStudentIds.length})
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="max-h-40 overflow-y-auto rounded-xl glass-subsurface p-2 space-y-1">
                      {filteredClassStudents.length === 0 ? (
                        <p className="text-slate-500 dark:text-slate-400 text-center py-4">Chưa có danh sách học sinh.</p>
                      ) : (
                        filteredClassStudents.map((s) => (
                          <label key={s.id} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-sky-500/10 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedStudentIds.includes(s.id)}
                              onChange={() => toggleStudentSelection(s.id)}
                            />
                            <span className="font-semibold text-slate-900 dark:text-slate-100">{s.fullName}</span>
                            <span className="text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400">
                              {s.studentCode} · {s.className}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {targetType === 'class' && (
                  <div>
                    <label className="block font-semibold mb-1">Chọn Lớp học *</label>
                    <select
                      required
                      value={targetClassId}
                      onChange={(e) => setTargetClassId(e.target.value)}
                      className="w-full glass-subsurface rounded-xl px-3 py-2"
                    >
                      <option value="">-- Chọn lớp --</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          Lớp {c.name} (GVCN: {c.homeroomTeacherName})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {targetType === 'group' && (
                  <div>
                    <label className="block font-semibold mb-1">Tên Tổ / Chi đoàn / Nhóm *</label>
                    <input
                      required
                      type="text"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="VD: Tổ 1 - Lớp 10A1 hoặc Đội Sao Đỏ"
                      className="w-full glass-subsurface rounded-xl px-3 py-2"
                    />
                  </div>
                )}

                {duplicateStudentIds.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-amber-500/12 border border-amber-400/40 text-amber-800 dark:text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      Cảnh báo trùng: {duplicateStudentIds.length} học sinh đã có bản ghi cùng tiêu chí trong ngày {occurredAt}.
                    </span>
                  </div>
                )}
              </div>

              {/* Criterion & Details */}
              <div className="lg:col-span-6 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Tiêu chí áp dụng *</label>
                    <select
                      required
                      value={criterionId}
                      onChange={(e) => setCriterionId(e.target.value)}
                      className="w-full glass-subsurface rounded-xl px-3 py-2"
                    >
                      <option value="">-- Chọn tiêu chí nội quy --</option>
                      {activeCriteria.map((c) => (
                        <option key={c.id} value={c.id}>
                          [{c.code}] {c.name} ({c.pointsSpecified && c.points !== null ? `${c.points > 0 ? '+' : ''}${c.points}đ` : 'Chưa gán điểm'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Ngày xảy ra *</label>
                    <input
                      required
                      type="date"
                      value={occurredAt}
                      onChange={(e) => setOccurredAt(e.target.value)}
                      className="w-full glass-subsurface rounded-xl px-3 py-2 font-mono-tabular"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Địa điểm / Tiết học</label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="VD: Sân trường, Phòng 10A1..."
                      className="w-full glass-subsurface rounded-xl px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Minh chứng đính kèm / Ghi chú</label>
                    <input
                      type="text"
                      value={evidenceNote}
                      onChange={(e) => setEvidenceNote(e.target.value)}
                      placeholder="Biên bản trực tuần, ảnh chụp..."
                      className="w-full glass-subsurface rounded-xl px-3 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Mô tả chi tiết</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ghi nhận diễn biến sự việc..."
                    className="w-full glass-subsurface rounded-xl px-3 py-2"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSensitive}
                      onChange={(e) => setIsSensitive(e.target.checked)}
                    />
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Bảo mật ghi chú trên bảng công khai</span>
                  </label>

                  {canApprove && (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={overrideEnabled}
                        onChange={(e) => setOverrideEnabled(e.target.checked)}
                      />
                      <span>Điều chỉnh điểm khác chuẩn</span>
                    </label>
                  )}
                </div>

                {overrideEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-400/35">
                    <input
                      type="number"
                      step="0.5"
                      required
                      value={overridePoints}
                      onChange={(e) => setOverridePoints(e.target.value)}
                      placeholder="Điểm áp dụng"
                      className="glass-subsurface rounded-lg px-2.5 py-1.5 font-mono-tabular"
                    />
                    <input
                      type="text"
                      required
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Lý do điều chỉnh điểm (bắt buộc)..."
                      className="sm:col-span-2 glass-subsurface rounded-lg px-2.5 py-1.5"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs cursor-pointer"
                >
                  Lưu Bản ghi Thi đua
                </button>
              </div>
            </div>
          </form>
        </LiquidCard>
      )}

      {/* Records Queue */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
          <Users className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          Danh sách Bản ghi Thi đua ({visibleRecords.length})
        </h4>
        <select
          value={recordStatusFilter}
          onChange={(e) => setRecordStatusFilter(e.target.value as typeof recordStatusFilter)}
          className="glass-subsurface rounded-xl px-3 py-1.5 font-semibold"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="pending_verification">Chờ xác minh</option>
          <option value="verified">Đã xác minh</option>
          <option value="recorded">Ghi nhận chính thức</option>
          <option value="insufficient_evidence">Thiếu minh chứng</option>
          <option value="cancelled">Đã hủy</option>
        </select>
      </div>

      {visibleRecords.length === 0 ? (
        <EmptyState
          icon={ClipboardPlus}
          title="Chưa có bản ghi thi đua nào"
          description="Các lượt ghi nhận thành tích, khen thưởng hoặc vi phạm nề nếp sẽ hiển thị tại đây."
        />
      ) : (
        <div className="glass-table-shell">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="glass-table-head">
                <tr>
                  <th className="px-4 py-3">Ngày / Mã</th>
                  <th className="px-4 py-3">Đối tượng</th>
                  <th className="px-4 py-3">Tiêu chí</th>
                  <th className="px-4 py-3">Điểm</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  {canApprove && <th className="px-4 py-3 text-right">Duyệt / Xử lý</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/25 dark:divide-white/10">
                {visibleRecords.map((rec) => {
                  const st = STATUS_BADGE[rec.status];
                  return (
                    <tr key={rec.id} className="glass-table-row">
                      <td className="px-4 py-3 font-mono-tabular">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{rec.occurredAt}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{rec.recordCode}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900 dark:text-slate-100">
                          {rec.studentName || rec.className || rec.groupName}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {rec.targetType === 'individual' ? `Lớp ${rec.className || '—'}` : rec.targetType === 'class' ? 'Tập thể lớp' : 'Tổ/Nhóm'}
                        </p>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{rec.criterionName}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {rec.isSensitive && !canApprove ? '[Nội dung bảo mật]' : rec.description}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-mono-tabular font-bold">
                        <span className={rec.pointsApplied >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                          {rec.pointsApplied > 0 ? `+${rec.pointsApplied}` : rec.pointsApplied}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={st.variant} size="sm">{st.label}</Badge>
                      </td>
                      {canApprove && (
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            {rec.status !== 'recorded' && rec.status !== 'cancelled' && (
                              <button
                                type="button"
                                onClick={() => handleTransitionStatus(rec, 'recorded')}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <ShieldCheck className="w-3 h-3" /> Duyệt
                              </button>
                            )}
                            {rec.status === 'pending_verification' && (
                              <button
                                type="button"
                                onClick={() => handleTransitionStatus(rec, 'insufficient_evidence')}
                                className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 font-semibold cursor-pointer transition-colors"
                              >
                                Thiếu MC
                              </button>
                            )}
                            {rec.status !== 'cancelled' && (
                              <button
                                type="button"
                                onClick={() => handleTransitionStatus(rec, 'cancelled')}
                                title="Hủy bản ghi"
                                className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/15 cursor-pointer transition-colors"
                              >
                                <XCircle className="w-3.5 h-3.5" />
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
    </div>
  );
};
