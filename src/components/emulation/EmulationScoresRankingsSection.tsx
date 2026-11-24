import React, { useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
  FileDown,
  Lock,
  MessageSquareWarning,
  Plus,
  Send,
  Sliders,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  EmulationAppeal,
  EmulationClassFormula,
  EmulationCycleType,
  EmulationPeriod,
  EmulationPolicy,
  EmulationRecord,
  EmulationSnapshot,
  EmulationTitleConfig,
  SchoolClass,
  ScoreTransferRecord,
  Student,
  SystemSettings,
  UserProfile,
} from '../../types';
import { LiquidCard } from '../common/LiquidCard';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { EmptyState } from '../shared/EmptyState';
import {
  buildPeriodSnapshotEntries,
  computeClassEmulationSummaries,
  computeStudentEmulationSummaries,
  DEFAULT_EMULATION_POLICY,
  DEFAULT_EMULATION_TITLES,
  resolveAppealEffect,
  sanitizeEmulationRecordForPublicView,
} from '../../utils/emulationRules';
import {
  exportCertificatesToDocx,
  exportCertificatesToPdf,
  exportEmulationReportToDocx,
  exportEmulationReportToPdf,
} from '../../utils/documentExporter';
import { userHasRole } from '../../utils/rbac';

interface EmulationScoresRankingsSectionProps {
  mode?: 'scores_appeals' | 'rankings' | 'unified';
  currentUser: UserProfile;
  systemSettings: SystemSettings;
  students: Student[];
  classes: SchoolClass[];
  emulationRecords: EmulationRecord[];
  emulationAppeals: EmulationAppeal[];
  emulationPeriods: EmulationPeriod[];
  emulationSnapshots: EmulationSnapshot[];
  titleConfigs: EmulationTitleConfig[];
  scoreTransfers: ScoreTransferRecord[];
  canApprove: boolean;
  canExport: boolean;
  onSaveSettings: (s: SystemSettings) => Promise<void> | void;
  onSaveRecord: (r: EmulationRecord) => Promise<void> | void;
  onSaveAppeal: (a: EmulationAppeal) => Promise<void> | void;
  onSavePeriod: (p: EmulationPeriod) => Promise<void> | void;
  onSaveSnapshot: (snap: EmulationSnapshot) => Promise<void> | void;
  onSaveTitleConfig: (cfg: EmulationTitleConfig) => Promise<void> | void;
  onDeleteTitleConfig: (id: string) => Promise<void> | void;
}

export const EmulationScoresRankingsSection: React.FC<EmulationScoresRankingsSectionProps> = ({
  mode = 'unified',
  currentUser,
  systemSettings,
  students,
  classes,
  emulationRecords,
  emulationAppeals,
  emulationPeriods,
  emulationSnapshots,
  titleConfigs,
  scoreTransfers,
  canApprove,
  canExport,
  onSaveSettings,
  onSaveRecord,
  onSaveAppeal,
  onSavePeriod,
  onSaveSnapshot,
  onSaveTitleConfig,
  onDeleteTitleConfig,
}) => {
  const effectivePolicy: EmulationPolicy = useMemo(
    () => ({ ...DEFAULT_EMULATION_POLICY, ...(systemSettings.emulationPolicy || {}) }),
    [systemSettings.emulationPolicy]
  );

  const effectiveTitles = useMemo(
    () => (titleConfigs.length > 0 ? titleConfigs : DEFAULT_EMULATION_TITLES),
    [titleConfigs]
  );

  const isPureStudent =
    userHasRole(currentUser, 'student') &&
    !userHasRole(currentUser, ['admin', 'principal', 'homeroom_teacher', 'subject_teacher']);

  const [policyDraft, setPolicyDraft] = useState<EmulationPolicy>(effectivePolicy);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('live');
  const [rankingViewScope, setRankingViewScope] = useState<'class' | 'student'>('class');
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Appeal form (student/user submits)
  const [appealRecordId, setAppealRecordId] = useState('');
  const [appealReason, setAppealReason] = useState('');
  const [appealEvidence, setAppealEvidence] = useState('');

  // Appeal review modal (BGH/GVCN)
  const [reviewingAppeal, setReviewingAppeal] = useState<EmulationAppeal | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewAdjustedPoints, setReviewAdjustedPoints] = useState<string>('');

  // Period create modal
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);
  const [periodForm, setPeriodForm] = useState({
    name: `Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`,
    cycleType: effectivePolicy.cycleType as EmulationCycleType,
    startDate: `${new Date().toISOString().slice(0, 7)}-01`,
    endDate: new Date().toISOString().split('T')[0],
  });

  // Policy & Titles modal (for unified mode)
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);

  // Title create modal
  const [isTitleModalOpen, setIsTitleModalOpen] = useState(false);
  const [titleForm, setTitleForm] = useState({
    name: '',
    targetScope: 'student' as 'student' | 'class',
    minScore: 110,
    maxViolations: 1,
    description: '',
  });

  const activePeriod = useMemo(
    () => emulationPeriods.find((p) => p.id === selectedPeriodId) || null,
    [emulationPeriods, selectedPeriodId]
  );

  const activeSnapshot = useMemo(
    () =>
      selectedPeriodId !== 'live'
        ? emulationSnapshots.find((s) => s.periodId === selectedPeriodId) || null
        : null,
    [emulationSnapshots, selectedPeriodId]
  );

  const previousRankMaps = useMemo(() => {
    const sortedSnaps = [...emulationSnapshots].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const latest = sortedSnaps[0];
    const stuMap = new Map<string, number>();
    const clsMap = new Map<string, number>();
    if (latest) {
      latest.entries.forEach((e) => {
        if (e.targetType === 'student') stuMap.set(e.targetId, e.rank);
        else clsMap.set(e.targetId, e.rank);
      });
    }
    return { stuMap, clsMap };
  }, [emulationSnapshots]);

  const studentSummaries = useMemo(
    () =>
      computeStudentEmulationSummaries({
        students,
        records: emulationRecords,
        transfers: scoreTransfers,
        policy: effectivePolicy,
        startDate: activePeriod?.startDate,
        endDate: activePeriod?.endDate,
        previousRankMap: previousRankMaps.stuMap,
        titles: effectiveTitles,
      }),
    [students, emulationRecords, scoreTransfers, effectivePolicy, activePeriod, previousRankMaps, effectiveTitles]
  );

  const classSummaries = useMemo(
    () =>
      computeClassEmulationSummaries({
        classes,
        students,
        records: emulationRecords,
        transfers: scoreTransfers,
        policy: effectivePolicy,
        startDate: activePeriod?.startDate,
        endDate: activePeriod?.endDate,
        previousRankMap: previousRankMaps.clsMap,
        titles: effectiveTitles,
      }),
    [classes, students, emulationRecords, scoreTransfers, effectivePolicy, activePeriod, previousRankMaps, effectiveTitles]
  );

  // Scoped personal view for pure students in Score Ledger
  const visibleStudentSummaries = useMemo(() => {
    if (!isPureStudent) return studentSummaries;
    return studentSummaries.filter(
      (s) =>
        s.studentId === currentUser.id ||
        s.studentId === currentUser.linkedProfileId ||
        (currentUser.studentCode && s.studentCode === currentUser.studentCode)
    );
  }, [studentSummaries, isPureStudent, currentUser]);

  const appealableRecords = useMemo(() => {
    const base = emulationRecords.filter((r) => r.status !== 'cancelled' && r.type === 'violation');
    if (!isPureStudent) return base;
    return base.filter(
      (r) =>
        r.studentId === currentUser.id ||
        r.studentId === currentUser.linkedProfileId ||
        (currentUser.studentCode && r.studentCode === currentUser.studentCode)
    );
  }, [emulationRecords, isPureStudent, currentUser]);

  const visibleAppeals = useMemo(() => {
    if (!isPureStudent) return emulationAppeals;
    return emulationAppeals.filter(
      (a) =>
        a.studentId === currentUser.id ||
        a.studentId === currentUser.linkedProfileId
    );
  }, [emulationAppeals, isPureStudent, currentUser]);

  const handleSaveEmulationPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings({
      ...systemSettings,
      emulationPolicy: {
        ...policyDraft,
        updatedBy: currentUser.displayName,
        updatedAt: new Date().toISOString(),
      },
    });
    setFeedback({ ok: true, msg: 'Đã lưu cấu hình quy chế điểm thi đua toàn trường.' });
  };

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    const rec = emulationRecords.find((r) => r.id === appealRecordId);
    if (!rec || !appealReason.trim()) return;
    const now = new Date().toISOString();
    const appeal: EmulationAppeal = {
      id: `APL-${Date.now()}`,
      recordId: rec.id,
      recordCode: rec.recordCode,
      studentId: rec.studentId || currentUser.id,
      studentName: rec.studentName || currentUser.displayName,
      className: rec.className || currentUser.className || '—',
      reason: appealReason.trim(),
      evidenceNote: appealEvidence.trim() || undefined,
      status: 'submitted',
      history: [
        {
          timestamp: now,
          actorName: currentUser.displayName,
          actorRole: currentUser.role,
          status: 'submitted',
          note: appealReason.trim(),
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
    await onSaveAppeal(appeal);
    setAppealRecordId('');
    setAppealReason('');
    setAppealEvidence('');
    setFeedback({ ok: true, msg: 'Đã gửi đơn khiếu nại / đính chính kết quả thi đua.' });
  };

  const handleResolveAppeal = async (decision: 'accepted' | 'rejected') => {
    if (!reviewingAppeal) return;
    const targetRec = emulationRecords.find((r) => r.id === reviewingAppeal.recordId);
    if (!targetRec) {
      await onSaveAppeal({
        ...reviewingAppeal,
        status: decision,
        reviewedBy: currentUser.displayName,
        resolutionNote: reviewNote.trim() || 'Đã xử lý',
        updatedAt: new Date().toISOString(),
      });
      setReviewingAppeal(null);
      return;
    }

    const adj = reviewAdjustedPoints !== '' ? Number(reviewAdjustedPoints) : undefined;
    const { updatedAppeal, updatedRecord } = resolveAppealEffect({
      appeal: reviewingAppeal,
      record: targetRec,
      decision,
      resolutionNote: reviewNote.trim() || (decision === 'accepted' ? 'Chấp nhận đính chính' : 'Giữ nguyên kết quả'),
      reviewedBy: currentUser.displayName,
      adjustedPoints: adj,
    });
    await onSaveAppeal(updatedAppeal);
    if (decision === 'accepted') {
      await onSaveRecord(updatedRecord);
    }
    setReviewingAppeal(null);
    setReviewNote('');
    setReviewAdjustedPoints('');
    setFeedback({
      ok: true,
      msg: `Đã ${decision === 'accepted' ? 'chấp nhận' : 'từ chối'} khiếu nại ${updatedAppeal.recordCode}.`,
    });
  };

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    const p: EmulationPeriod = {
      id: `PER-${Date.now()}`,
      name: periodForm.name.trim(),
      academicYear: systemSettings.academicYear,
      cycleType: periodForm.cycleType,
      startDate: periodForm.startDate,
      endDate: periodForm.endDate,
      status: 'open',
    };
    await onSavePeriod(p);
    setSelectedPeriodId(p.id);
    setIsPeriodModalOpen(false);
    setFeedback({ ok: true, msg: `Đã khởi tạo kỳ thi đua "${p.name}".` });
  };

  const handleClosePeriodAndSnapshot = async (period: EmulationPeriod) => {
    const entries = buildPeriodSnapshotEntries({
      students,
      classes,
      records: emulationRecords,
      transfers: scoreTransfers,
      policy: effectivePolicy,
      startDate: period.startDate,
      endDate: period.endDate,
    });
    const now = new Date().toISOString();
    const snap: EmulationSnapshot = {
      id: `SNP-${Date.now()}`,
      periodId: period.id,
      periodName: period.name,
      academicYear: period.academicYear,
      createdAt: now,
      createdBy: currentUser.displayName,
      entries,
    };
    await onSaveSnapshot(snap);
    await onSavePeriod({
      ...period,
      status: 'closed',
      closedBy: currentUser.displayName,
      closedAt: now,
    });
    setFeedback({
      ok: true,
      msg: `Đã chốt sổ kỳ "${period.name}" và lưu snapshot bất biến (${entries.length} thứ hạng).`,
    });
  };

  const handleCreateTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleForm.name.trim()) return;
    await onSaveTitleConfig({
      id: `TTL-${Date.now()}`,
      name: titleForm.name.trim(),
      targetScope: titleForm.targetScope,
      minScore: Number(titleForm.minScore),
      maxViolations: titleForm.maxViolations,
      badgeColor: 'bg-amber-500/15 text-amber-700 border-amber-300/60',
      description: titleForm.description.trim() || `Điểm >= ${titleForm.minScore}`,
    });
    setTitleForm({ name: '', targetScope: 'student', minScore: 110, maxViolations: 1, description: '' });
    setIsTitleModalOpen(false);
  };

  const chartData = useMemo(() => {
    if (rankingViewScope === 'class') {
      return classSummaries.slice(0, 12).map((c) => ({
        name: c.className,
        score: c.totalScore,
      }));
    }
    return studentSummaries.slice(0, 12).map((s) => ({
      name: s.studentName.split(' ').slice(-2).join(' '),
      score: s.totalScore,
    }));
  }, [rankingViewScope, classSummaries, studentSummaries]);

  const sanitizedRecentRecords = useMemo(
    () =>
      emulationRecords
        .filter((r) => r.status === 'recorded' || r.status === 'verified')
        .slice(0, 6)
        .map((r) => (canApprove ? r : sanitizeEmulationRecordForPublicView(r))),
    [emulationRecords, canApprove]
  );

  const handleExportCertificates = async (format: 'docx' | 'pdf') => {
    const recipients = [
      ...classSummaries
        .filter((c) => c.titleAwarded || c.rank <= 3)
        .slice(0, 5)
        .map((c) => ({
          recipientName: `Tập thể Lớp ${c.className}`,
          achievementTitle: c.titleAwarded || `Hạng ${c.rank} Thi đua`,
          reason: `Đạt ${c.totalScore} điểm trong kỳ ${activePeriod?.name || 'Hiện hành'}`,
        })),
      ...studentSummaries
        .filter((s) => s.titleAwarded || s.rank <= 5)
        .slice(0, 8)
        .map((s) => ({
          recipientName: s.studentName,
          className: s.className,
          achievementTitle: s.titleAwarded || `Hạng ${s.rank} Cá nhân Tiêu biểu`,
          reason: `Đạt ${s.totalScore} điểm thi đua`,
        })),
    ];

    if (recipients.length === 0) {
      setFeedback({ ok: false, msg: 'Chưa có lớp hoặc học sinh đủ dữ liệu để xuất Giấy khen.' });
      return;
    }

    if (format === 'docx') {
      await exportCertificatesToDocx({
        schoolName: systemSettings.schoolName,
        academicYear: systemSettings.academicYear,
        recipients,
      });
    } else {
      await exportCertificatesToPdf({
        schoolName: systemSettings.schoolName,
        academicYear: systemSettings.academicYear,
        recipients,
      });
    }
  };

  return (
    <div className="space-y-5">
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

      {mode === 'scores_appeals' && (
        <>
          {/* Policy & Title Config for BGH/Admin */}
          {canApprove && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <LiquidCard className="lg:col-span-7 p-5 space-y-3 text-xs">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  Cấu hình Cơ chế Tính điểm Thi đua
                </h3>
                <form onSubmit={handleSaveEmulationPolicy} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Điểm gốc đầu kỳ</label>
                    <input
                      type="number"
                      value={policyDraft.startingScore}
                      onChange={(e) => setPolicyDraft((p) => ({ ...p, startingScore: Number(e.target.value) || 0 }))}
                      className="w-full glass-subsurface rounded-xl px-2.5 py-1.5 font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Điểm sàn</label>
                    <input
                      type="number"
                      value={policyDraft.minScore}
                      onChange={(e) => setPolicyDraft((p) => ({ ...p, minScore: Number(e.target.value) || 0 }))}
                      className="w-full glass-subsurface rounded-xl px-2.5 py-1.5 font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Điểm trần</label>
                    <input
                      type="number"
                      value={policyDraft.maxScore}
                      onChange={(e) => setPolicyDraft((p) => ({ ...p, maxScore: Number(e.target.value) || 100 }))}
                      className="w-full glass-subsurface rounded-xl px-2.5 py-1.5 font-mono-tabular"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-2">
                    <label className="block text-[11px] font-semibold mb-1">Công thức điểm Lớp</label>
                    <select
                      value={policyDraft.classFormula}
                      onChange={(e) => setPolicyDraft((p) => ({ ...p, classFormula: e.target.value as EmulationClassFormula }))}
                      className="w-full glass-subsurface rounded-xl px-2.5 py-1.5"
                    >
                      <option value="combined_formula">Kết hợp TB học sinh + điểm tập thể lớp</option>
                      <option value="sum_students">Tổng biến động điểm học sinh trong lớp</option>
                      <option value="average_students">Trung bình biến động điểm học sinh</option>
                      <option value="class_events_only">Chỉ tính sự kiện cấp Tập thể lớp</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer transition-colors"
                    >
                      Lưu Quy chế
                    </button>
                  </div>
                </form>
              </LiquidCard>

              <LiquidCard className="lg:col-span-5 p-5 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-500" />
                    Danh hiệu & Khen thưởng ({effectiveTitles.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsTitleModalOpen(true)}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm
                  </button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {effectiveTitles.map((t) => (
                    <div
                      key={t.id}
                      className="p-2.5 rounded-xl glass-subsurface flex items-center justify-between gap-2"
                    >
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100">{t.name}</p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 font-mono-tabular">
                          {t.targetScope === 'class' ? 'Lớp' : 'Học sinh'} · Điểm ≥ {t.minScore}
                          {t.maxViolations !== undefined ? ` · Vi phạm ≤ ${t.maxViolations}` : ''}
                        </p>
                      </div>
                      {titleConfigs.some((x) => x.id === t.id) && (
                        <button
                          type="button"
                          onClick={() => onDeleteTitleConfig(t.id)}
                          className="p-1 text-rose-500 hover:bg-rose-500/15 rounded-lg cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </LiquidCard>
            </div>
          )}

          {/* Student Score Ledger */}
          <div className="glass-table-shell">
            <div className="px-4 py-3 border-b border-white/25 dark:border-white/10 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Bảng Điểm Thi đua Cá nhân ({visibleStudentSummaries.length})
              </h3>
              <span className="text-[11px] font-mono-tabular text-slate-600 dark:text-slate-400">Điểm gốc: {effectivePolicy.startingScore}đ</span>
            </div>
            {visibleStudentSummaries.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">Chưa có dữ liệu học sinh để tổng hợp điểm.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="glass-table-head">
                    <tr>
                      <th className="px-4 py-2.5">Hạng</th>
                      <th className="px-4 py-2.5">Học sinh</th>
                      <th className="px-4 py-2.5">Lớp</th>
                      <th className="px-4 py-2.5">Cộng</th>
                      <th className="px-4 py-2.5">Trừ</th>
                      <th className="px-4 py-2.5">Phong trào</th>
                      <th className="px-4 py-2.5">Tổng điểm</th>
                      <th className="px-4 py-2.5">Danh hiệu dự kiến</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/25 dark:divide-white/10">
                    {visibleStudentSummaries.slice(0, 30).map((s, idx) => (
                      <tr key={`${s.studentId || 'stu'}-${idx}`} className="glass-table-row">
                        <td className="px-4 py-2.5 font-mono-tabular font-bold">#{s.rank}</td>
                        <td className="px-4 py-2.5">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{s.studentName}</span>
                          <span className="block text-[10px] font-mono-tabular text-slate-500 dark:text-slate-400">{s.studentCode}</span>
                        </td>
                        <td className="px-4 py-2.5">{s.className}</td>
                        <td className="px-4 py-2.5 font-mono-tabular text-emerald-600 dark:text-emerald-400">+{s.achievementPoints}</td>
                        <td className="px-4 py-2.5 font-mono-tabular text-rose-600 dark:text-rose-400">{s.violationPoints}</td>
                        <td className="px-4 py-2.5 font-mono-tabular text-indigo-600 dark:text-indigo-400">+{s.transferPoints}</td>
                        <td className="px-4 py-2.5 font-mono-tabular font-extrabold text-sky-700 dark:text-sky-300">
                          {s.totalScore}
                        </td>
                        <td className="px-4 py-2.5">
                          {s.titleAwarded ? <Badge variant="amber" size="sm">{s.titleAwarded}</Badge> : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Appeals Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <LiquidCard className="lg:col-span-5 p-5 space-y-3 text-xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Send className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                Gửi Khiếu nại / Đính chính Điểm
              </h3>
              {appealableRecords.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 py-4">Không có bản ghi vi phạm nào thuộc phạm vi để khiếu nại.</p>
              ) : (
                <form onSubmit={handleSubmitAppeal} className="space-y-3">
                  <div>
                    <label className="block font-semibold mb-1">Chọn bản ghi cần rà soát *</label>
                    <select
                      required
                      value={appealRecordId}
                      onChange={(e) => setAppealRecordId(e.target.value)}
                      className="w-full glass-subsurface rounded-xl px-3 py-2"
                    >
                      <option value="">-- Chọn bản ghi --</option>
                      {appealableRecords.map((r) => (
                        <option key={r.id} value={r.id}>
                          [{r.recordCode}] {r.studentName || r.className} — {r.criterionName} ({r.pointsApplied}đ)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Lý do khiếu nại *</label>
                    <textarea
                      required
                      rows={2}
                      value={appealReason}
                      onChange={(e) => setAppealReason(e.target.value)}
                      placeholder="Trình bày lý do và bối cảnh cụ thể..."
                      className="w-full glass-subsurface rounded-xl px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Minh chứng đính kèm</label>
                    <input
                      type="text"
                      value={appealEvidence}
                      onChange={(e) => setAppealEvidence(e.target.value)}
                      placeholder="Giấy xác nhận GVCN / Y tế..."
                      className="w-full glass-subsurface rounded-xl px-3 py-2"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer transition-colors"
                  >
                    Gửi Khiếu nại
                  </button>
                </form>
              )}
            </LiquidCard>

            <LiquidCard className="lg:col-span-7 p-5 space-y-3 text-xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <MessageSquareWarning className="w-4 h-4 text-amber-500" />
                Hồ sơ Khiếu nại & Lịch sử Giải quyết ({visibleAppeals.length})
              </h3>
              {visibleAppeals.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 py-4 text-center">Chưa có đơn khiếu nại nào.</p>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {visibleAppeals.map((apl) => (
                    <div
                      key={apl.id}
                      className="p-3.5 rounded-xl glass-subsurface space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-slate-100">
                            {apl.studentName} ({apl.className}) · <span className="font-mono-tabular">{apl.recordCode}</span>
                          </p>
                          <p className="text-slate-700 dark:text-slate-300 mt-0.5">{apl.reason}</p>
                        </div>
                        <Badge
                          variant={apl.status === 'accepted' ? 'mint' : apl.status === 'rejected' ? 'pink' : 'amber'}
                          size="sm"
                        >
                          {apl.status === 'accepted' ? 'Chấp nhận' : apl.status === 'rejected' ? 'Từ chối' : 'Đang xử lý'}
                        </Badge>
                      </div>
                      {apl.resolutionNote && (
                        <p className="text-[11px] text-sky-700 dark:text-sky-300">
                          Kết luận ({apl.reviewedBy}): {apl.resolutionNote}
                        </p>
                      )}
                      {canApprove && (apl.status === 'submitted' || apl.status === 'reviewing' || apl.status === 'need_info') && (
                        <button
                          type="button"
                          onClick={() => {
                            setReviewingAppeal(apl);
                            setReviewNote('');
                            setReviewAdjustedPoints('');
                          }}
                          className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer transition-colors"
                        >
                          Xem xét & Phán quyết
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </LiquidCard>
          </div>
        </>
      )}

      {(mode === 'rankings' || mode === 'unified') && (
        <>
          {/* Period Bar + Exports */}
          <div className="liquid-glass-panel rounded-2xl p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
                className="glass-subsurface rounded-xl px-3 py-2 font-semibold"
              >
                <option value="live">Kỳ hiện tại (Thời gian thực)</option>
                {emulationPeriods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.status === 'closed' ? 'Đã chốt sổ' : 'Đang mở'})
                  </option>
                ))}
              </select>

              <div className="glass-pill-tray inline-flex font-semibold">
                <button
                  type="button"
                  onClick={() => setRankingViewScope('class')}
                  className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
                    rankingViewScope === 'class' ? 'glass-pill-tab-active' : 'glass-pill-tab'
                  }`}
                >
                  Xếp hạng Lớp
                </button>
                <button
                  type="button"
                  onClick={() => setRankingViewScope('student')}
                  className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
                    rankingViewScope === 'student' ? 'glass-pill-tab-active' : 'glass-pill-tab'
                  }`}
                >
                  Xếp hạng Cá nhân
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {canApprove && (
                <>
                  {mode === 'unified' && (
                    <button
                      type="button"
                      data-testid="btn-open-emulation-policy"
                      onClick={() => setIsPolicyModalOpen(true)}
                      className="px-3 py-1.5 rounded-xl glass-subsurface hover:bg-white/80 dark:hover:bg-white/10 font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Sliders className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" /> Quy chế & Danh hiệu
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsPeriodModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl glass-subsurface hover:bg-white/80 dark:hover:bg-white/10 font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tạo Kỳ thi đua
                  </button>
                  {activePeriod && activePeriod.status === 'open' && (
                    <button
                      type="button"
                      onClick={() => handleClosePeriodAndSnapshot(activePeriod)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <CalendarCheck className="w-3.5 h-3.5" /> Chốt kỳ
                    </button>
                  )}
                </>
              )}
              {canExport && (
                <>
                  <button
                    type="button"
                    data-testid="btn-export-emulation-docx"
                    onClick={() =>
                      void exportEmulationReportToDocx({
                        schoolName: systemSettings.schoolName,
                        periodName: activePeriod?.name || 'Kỳ hiện hành',
                        academicYear: systemSettings.academicYear,
                        classSummaries,
                        studentSummaries,
                        records: emulationRecords,
                      })
                    }
                    className="px-3 py-1.5 rounded-xl glass-subsurface hover:bg-white/80 dark:hover:bg-white/10 font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
                  >
                    <FileDown className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" /> Xuất Word
                  </button>
                  <button
                    type="button"
                    data-testid="btn-export-emulation-pdf"
                    onClick={() =>
                      void exportEmulationReportToPdf({
                        schoolName: systemSettings.schoolName,
                        periodName: activePeriod?.name || 'Kỳ hiện hành',
                        academicYear: systemSettings.academicYear,
                        classSummaries,
                        studentSummaries,
                      })
                    }
                    className="px-3 py-1.5 rounded-xl glass-subsurface hover:bg-white/80 dark:hover:bg-white/10 font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
                  >
                    <FileDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /> Xuất PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportCertificates('pdf')}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap transition-colors"
                  >
                    <Award className="w-3.5 h-3.5" /> Giấy khen PDF
                  </button>
                </>
              )}
            </div>
          </div>

          {activeSnapshot && (
            <div className="p-3 rounded-xl bg-indigo-500/12 border border-indigo-400/35 text-xs flex items-center gap-2 text-indigo-800 dark:text-indigo-200">
              <Lock className="w-4 h-4 shrink-0" />
              <span>
                Đang xem ảnh chụp lịch sử (Snapshot bất biến) của kỳ <strong>{activeSnapshot.periodName}</strong> chốt bởi {activeSnapshot.createdBy}.
              </span>
            </div>
          )}

          {/* Recharts Visualization */}
          <LiquidCard className="p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mb-3">
              <BarChart3 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              Biểu đồ Điểm Thi đua {rankingViewScope === 'class' ? 'Tập thể Lớp' : 'Học sinh Dẫn đầu'}
            </h3>
            {chartData.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="Chưa có dữ liệu xếp hạng"
                description="Bổ sung danh sách lớp/học sinh và ghi nhận thi đua để hiển thị biểu đồ xếp hạng."
              />
            ) : (
              <div className="w-full h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.85)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '12px',
                        color: '#f8fafc',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="score" name="Tổng điểm" fill="#0284c7" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </LiquidCard>

          {/* Rankings Table */}
          <div className="glass-table-shell">
            <div className="px-4 py-3 border-b border-white/25 dark:border-white/10 flex items-center justify-between text-xs">
              <h4 className="font-bold text-slate-900 dark:text-slate-100">
                {rankingViewScope === 'class'
                  ? `Bảng xếp hạng Tập thể Lớp (${classSummaries.length})`
                  : `Bảng điểm & Xếp hạng Học sinh (${visibleStudentSummaries.length})`}
              </h4>
              <span className="text-[11px] font-mono-tabular text-slate-600 dark:text-slate-400">Điểm gốc đầu kỳ: {effectivePolicy.startingScore}đ</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="glass-table-head">
                  <tr>
                    <th className="px-4 py-3">Hạng</th>
                    <th className="px-4 py-3">Biến động</th>
                    <th className="px-4 py-3">{rankingViewScope === 'class' ? 'Lớp' : 'Học sinh'}</th>
                    <th className="px-4 py-3">Thành tích</th>
                    <th className="px-4 py-3">Vi phạm</th>
                    {rankingViewScope === 'student' && <th className="px-4 py-3">Phong trào</th>}
                    <th className="px-4 py-3">Tổng điểm</th>
                    <th className="px-4 py-3">Danh hiệu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/25 dark:divide-white/10">
                  {(rankingViewScope === 'class' ? classSummaries : visibleStudentSummaries).slice(0, 30).map((row, idx) => {
                    const isCls = 'studentCount' in row;
                    const id = isCls ? row.classId : row.studentId;
                    const name = isCls ? `Lớp ${row.className}` : `${row.studentName} (${row.className})`;
                    return (
                      <tr key={`${id || 'row'}-${idx}`} className="glass-table-row">
                        <td className="px-4 py-3 font-mono-tabular font-extrabold text-sky-700 dark:text-sky-300">
                          #{row.rank}
                        </td>
                        <td className="px-4 py-3 font-mono-tabular">
                          {row.rankDelta === undefined || row.rankDelta === 0 ? (
                            <span className="text-slate-500 dark:text-slate-400">—</span>
                          ) : row.rankDelta > 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-0.5 font-bold">
                              <TrendingUp className="w-3.5 h-3.5" /> +{row.rankDelta}
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400 inline-flex items-center gap-0.5 font-bold">
                              <TrendingDown className="w-3.5 h-3.5" /> {row.rankDelta}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">{name}</td>
                        <td className="px-4 py-3 font-mono-tabular text-emerald-600 dark:text-emerald-400">+{row.achievementPoints}</td>
                        <td className="px-4 py-3 font-mono-tabular text-rose-600 dark:text-rose-400">{row.violationPoints}</td>
                        {!isCls && rankingViewScope === 'student' && (
                          <td className="px-4 py-3 font-mono-tabular text-indigo-600 dark:text-indigo-400">+{row.transferPoints}</td>
                        )}
                        <td className="px-4 py-3 font-mono-tabular font-extrabold text-slate-900 dark:text-white">{row.totalScore}</td>
                        <td className="px-4 py-3">
                          {row.titleAwarded ? <Badge variant="amber" size="sm">{row.titleAwarded}</Badge> : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Privacy-Sanitized Recent Highlights */}
          {sanitizedRecentRecords.length > 0 && (
            <LiquidCard className="p-4 space-y-2 text-xs">
              <h4 className="font-bold text-slate-900 dark:text-slate-100">
                Điểm nhấn Ghi nhận gần đây (Đã áp dụng lọc bảo mật)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {sanitizedRecentRecords.map((r) => (
                  <div key={r.id} className="p-2.5 rounded-xl glass-subsurface flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{r.studentName || r.className || r.groupName} · {r.criterionName}</p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">{r.description}</p>
                    </div>
                    <Badge variant={r.pointsApplied >= 0 ? 'mint' : 'pink'} size="sm">
                      {r.pointsApplied > 0 ? `+${r.pointsApplied}` : r.pointsApplied}đ
                    </Badge>
                  </div>
                ))}
              </div>
            </LiquidCard>
          )}

          {/* Unified Appeals & Corrections */}
          {mode === 'unified' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <LiquidCard className="lg:col-span-5 p-5 space-y-3 text-xs">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Send className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  Gửi Khiếu nại / Đính chính Điểm
                </h3>
                {appealableRecords.length === 0 ? (
                  <p className="text-slate-500 dark:text-slate-400 py-3">Không có bản ghi vi phạm nào thuộc phạm vi để khiếu nại.</p>
                ) : (
                  <form onSubmit={handleSubmitAppeal} className="space-y-3">
                    <div>
                      <label className="block font-semibold mb-1">Chọn bản ghi cần rà soát *</label>
                      <select
                        required
                        value={appealRecordId}
                        onChange={(e) => setAppealRecordId(e.target.value)}
                        className="w-full glass-subsurface rounded-xl px-3 py-2"
                      >
                        <option value="">-- Chọn bản ghi --</option>
                        {appealableRecords.map((r) => (
                          <option key={r.id} value={r.id}>
                            [{r.recordCode}] {r.studentName || r.className} — {r.criterionName} ({r.pointsApplied}đ)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Lý do khiếu nại *</label>
                      <textarea
                        required
                        rows={2}
                        value={appealReason}
                        onChange={(e) => setAppealReason(e.target.value)}
                        placeholder="Trình bày lý do và bối cảnh cụ thể..."
                        className="w-full glass-subsurface rounded-xl px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Minh chứng đính kèm</label>
                      <input
                        type="text"
                        value={appealEvidence}
                        onChange={(e) => setAppealEvidence(e.target.value)}
                        placeholder="Giấy xác nhận GVCN / Y tế..."
                        className="w-full glass-subsurface rounded-xl px-3 py-2"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer transition-colors"
                    >
                      Gửi Khiếu nại
                    </button>
                  </form>
                )}
              </LiquidCard>

              <LiquidCard className="lg:col-span-7 p-5 space-y-3 text-xs">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <MessageSquareWarning className="w-4 h-4 text-amber-500" />
                  Hồ sơ Khiếu nại & Giải quyết ({visibleAppeals.length})
                </h3>
                {visibleAppeals.length === 0 ? (
                  <p className="text-slate-500 dark:text-slate-400 py-4 text-center">Chưa có đơn khiếu nại nào.</p>
                ) : (
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {visibleAppeals.map((apl) => (
                      <div
                        key={apl.id}
                        className="p-3.5 rounded-xl glass-subsurface space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-slate-900 dark:text-slate-100">
                              {apl.studentName} ({apl.className}) · <span className="font-mono-tabular">{apl.recordCode}</span>
                            </p>
                            <p className="text-slate-700 dark:text-slate-300 mt-0.5">{apl.reason}</p>
                          </div>
                          <Badge
                            variant={apl.status === 'accepted' ? 'mint' : apl.status === 'rejected' ? 'pink' : 'amber'}
                            size="sm"
                          >
                            {apl.status === 'accepted' ? 'Chấp nhận' : apl.status === 'rejected' ? 'Từ chối' : 'Đang xử lý'}
                          </Badge>
                        </div>
                        {apl.resolutionNote && (
                          <p className="text-[11px] text-sky-700 dark:text-sky-300">
                            Kết luận ({apl.reviewedBy}): {apl.resolutionNote}
                          </p>
                        )}
                        {canApprove && (apl.status === 'submitted' || apl.status === 'reviewing' || apl.status === 'need_info') && (
                          <button
                            type="button"
                            onClick={() => {
                              setReviewingAppeal(apl);
                              setReviewNote('');
                              setReviewAdjustedPoints('');
                            }}
                            className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer transition-colors"
                          >
                            Xem xét & Phán quyết
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </LiquidCard>
            </div>
          )}
        </>
      )}

      {/* Modal: Emulation Policy & Titles Config */}
      <Modal
        isOpen={isPolicyModalOpen}
        onClose={() => setIsPolicyModalOpen(false)}
        title="Quy chế Tính điểm & Danh hiệu Thi đua"
        maxWidth="3xl"
      >
        <div className="space-y-5 text-xs">
          <form onSubmit={handleSaveEmulationPolicy} className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl glass-subsurface">
            <div>
              <label className="block text-[11px] font-semibold mb-1">Điểm gốc đầu kỳ</label>
              <input
                type="number"
                value={policyDraft.startingScore}
                onChange={(e) => setPolicyDraft((p) => ({ ...p, startingScore: Number(e.target.value) || 0 }))}
                className="w-full glass-subsurface rounded-xl px-2.5 py-1.5 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1">Điểm sàn</label>
              <input
                type="number"
                value={policyDraft.minScore}
                onChange={(e) => setPolicyDraft((p) => ({ ...p, minScore: Number(e.target.value) || 0 }))}
                className="w-full glass-subsurface rounded-xl px-2.5 py-1.5 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1">Điểm trần</label>
              <input
                type="number"
                value={policyDraft.maxScore}
                onChange={(e) => setPolicyDraft((p) => ({ ...p, maxScore: Number(e.target.value) || 100 }))}
                className="w-full glass-subsurface rounded-xl px-2.5 py-1.5 font-mono-tabular"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold mb-1">Công thức điểm Lớp</label>
              <select
                value={policyDraft.classFormula}
                onChange={(e) => setPolicyDraft((p) => ({ ...p, classFormula: e.target.value as EmulationClassFormula }))}
                className="w-full glass-subsurface rounded-xl px-2.5 py-1.5"
              >
                <option value="combined_formula">Kết hợp TB học sinh + điểm tập thể lớp</option>
                <option value="sum_students">Tổng biến động điểm học sinh trong lớp</option>
                <option value="average_students">Trung bình biến động điểm học sinh</option>
                <option value="class_events_only">Chỉ tính sự kiện cấp Tập thể lớp</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer transition-colors"
              >
                Lưu Quy chế
              </button>
            </div>
          </form>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-500" />
                Danh hiệu & Khen thưởng ({effectiveTitles.length})
              </h4>
              <button
                type="button"
                onClick={() => setIsTitleModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm Danh hiệu
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
              {effectiveTitles.map((t) => (
                <div
                  key={t.id}
                  className="p-2.5 rounded-xl glass-subsurface flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100">{t.name}</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 font-mono-tabular">
                      {t.targetScope === 'class' ? 'Lớp' : 'Học sinh'} · Điểm ≥ {t.minScore}
                      {t.maxViolations !== undefined ? ` · Vi phạm ≤ ${t.maxViolations}` : ''}
                    </p>
                  </div>
                  {titleConfigs.some((x) => x.id === t.id) && (
                    <button
                      type="button"
                      onClick={() => onDeleteTitleConfig(t.id)}
                      className="p-1 text-rose-500 hover:bg-rose-500/15 rounded-lg cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal: Resolve Appeal */}
      <Modal
        isOpen={Boolean(reviewingAppeal)}
        onClose={() => setReviewingAppeal(null)}
        title={`Xử lý Khiếu nại — ${reviewingAppeal?.studentName || ''}`}
        maxWidth="md"
      >
        {reviewingAppeal && (
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl glass-subsurface">
              <p className="font-bold font-mono-tabular">{reviewingAppeal.recordCode}</p>
              <p className="text-slate-700 dark:text-slate-300 mt-1">{reviewingAppeal.reason}</p>
            </div>
            <div>
              <label className="block font-semibold mb-1">Điểm mới nếu điều chỉnh (để trống = Hủy bỏ vi phạm khi Chấp nhận)</label>
              <input
                type="number"
                step="0.5"
                value={reviewAdjustedPoints}
                onChange={(e) => setReviewAdjustedPoints(e.target.value)}
                placeholder="VD: 0 hoặc -1 (để trống nếu hủy hoàn toàn)"
                className="w-full glass-subsurface rounded-xl px-3 py-2 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Ghi chú kết luận *</label>
              <textarea
                rows={2}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Kết luận giải quyết của Ban Giám hiệu / GVCN..."
                className="w-full glass-subsurface rounded-xl px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleResolveAppeal('rejected')}
                className="px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 font-bold cursor-pointer transition-colors"
              >
                Từ chối
              </button>
              <button
                type="button"
                onClick={() => handleResolveAppeal('accepted')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer transition-colors"
              >
                Chấp nhận Đính chính
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Create Period */}
      <Modal
        isOpen={isPeriodModalOpen}
        onClose={() => setIsPeriodModalOpen(false)}
        title="Khởi tạo Kỳ Tổng kết Thi đua"
        maxWidth="md"
      >
        <form onSubmit={handleCreatePeriod} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Tên kỳ thi đua *</label>
            <input
              required
              type="text"
              value={periodForm.name}
              onChange={(e) => setPeriodForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full glass-subsurface rounded-xl px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Từ ngày</label>
              <input
                type="date"
                required
                value={periodForm.startDate}
                onChange={(e) => setPeriodForm((p) => ({ ...p, startDate: e.target.value }))}
                className="w-full glass-subsurface rounded-xl px-3 py-2 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Đến ngày</label>
              <input
                type="date"
                required
                value={periodForm.endDate}
                onChange={(e) => setPeriodForm((p) => ({ ...p, endDate: e.target.value }))}
                className="w-full glass-subsurface rounded-xl px-3 py-2 font-mono-tabular"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsPeriodModalOpen(false)} className="px-4 py-2 rounded-xl glass-subsurface cursor-pointer">
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer">
              Tạo Kỳ
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Title */}
      <Modal
        isOpen={isTitleModalOpen}
        onClose={() => setIsTitleModalOpen(false)}
        title="Thêm Cấu hình Danh hiệu Thi đua"
        maxWidth="md"
      >
        <form onSubmit={handleCreateTitle} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Tên danh hiệu *</label>
            <input
              required
              type="text"
              value={titleForm.name}
              onChange={(e) => setTitleForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="VD: Chi đoàn Vững mạnh"
              className="w-full glass-subsurface rounded-xl px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block font-semibold mb-1">Đối tượng</label>
              <select
                value={titleForm.targetScope}
                onChange={(e) => setTitleForm((p) => ({ ...p, targetScope: e.target.value as 'student' | 'class' }))}
                className="w-full glass-subsurface rounded-xl px-2 py-2"
              >
                <option value="student">Học sinh</option>
                <option value="class">Lớp</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Điểm tối thiểu</label>
              <input
                type="number"
                value={titleForm.minScore}
                onChange={(e) => setTitleForm((p) => ({ ...p, minScore: Number(e.target.value) || 0 }))}
                className="w-full glass-subsurface rounded-xl px-2.5 py-2 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Vi phạm tối đa</label>
              <input
                type="number"
                value={titleForm.maxViolations}
                onChange={(e) => setTitleForm((p) => ({ ...p, maxViolations: Number(e.target.value) || 0 }))}
                className="w-full glass-subsurface rounded-xl px-2.5 py-2 font-mono-tabular"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsTitleModalOpen(false)} className="px-4 py-2 rounded-xl glass-subsurface cursor-pointer">
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer">
              Lưu Danh hiệu
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
