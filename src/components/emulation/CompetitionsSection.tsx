import React, { useMemo, useState } from 'react';
import {
  Trophy,
  Plus,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  RotateCcw,
  FileDown,
  Award,
  Users,
  Trash2,
} from 'lucide-react';
import {
  Competition,
  CompetitionAward,
  CompetitionCriterion,
  CompetitionParticipant,
  CompetitionScore,
  CompetitionStatus,
  CompetitionTransferMode,
  EmulationRecord,
  SchoolClass,
  ScoreTransferRecord,
  Student,
  UserProfile,
} from '../../types';
import { LiquidCard } from '../common/LiquidCard';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { EmptyState } from '../shared/EmptyState';
import {
  buildCompetitionLeaderboard,
  planCompetitionTransferToEmulation,
  revertCompetitionTransfer,
  syncCompetitionStatusByDate,
} from '../../utils/emulationRules';
import {
  exportCertificatesToPdf,
  exportCompetitionToDocx,
  exportCompetitionToPdf,
} from '../../utils/documentExporter';

interface CompetitionsSectionProps {
  currentUser: UserProfile;
  schoolName: string;
  academicYear: string;
  students: Student[];
  classes: SchoolClass[];
  competitions: Competition[];
  competitionCriteria: CompetitionCriterion[];
  competitionParticipants: CompetitionParticipant[];
  competitionScores: CompetitionScore[];
  competitionAwards: CompetitionAward[];
  scoreTransfers: ScoreTransferRecord[];
  canCreate: boolean;
  canApprove: boolean;
  canExport: boolean;
  onSaveCompetition: (c: Competition) => Promise<void> | void;
  onSaveCriterion: (c: CompetitionCriterion) => Promise<void> | void;
  onDeleteCriterion: (id: string) => Promise<void> | void;
  onSaveParticipant: (p: CompetitionParticipant) => Promise<void> | void;
  onSaveScore: (s: CompetitionScore) => Promise<void> | void;
  onSaveAward: (a: CompetitionAward) => Promise<void> | void;
  onSaveTransfer: (t: ScoreTransferRecord) => Promise<void> | void;
  onSaveEmulationRecord: (r: EmulationRecord) => Promise<void> | void;
  emulationRecords: EmulationRecord[];
}

export const CompetitionsSection: React.FC<CompetitionsSectionProps> = ({
  currentUser,
  schoolName,
  academicYear,
  students,
  classes,
  competitions,
  competitionCriteria,
  competitionParticipants,
  competitionScores,
  competitionAwards,
  scoreTransfers,
  canCreate,
  canApprove,
  canExport,
  onSaveCompetition,
  onSaveCriterion,
  onDeleteCriterion,
  onSaveParticipant,
  onSaveScore,
  onSaveAward,
  onSaveTransfer,
  onSaveEmulationRecord,
  emulationRecords,
}) => {
  const [selectedCompId, setSelectedCompId] = useState<string>(competitions[0]?.id || '');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const [compForm, setCompForm] = useState({
    code: `PT-${new Date().getFullYear()}-${String(competitions.length + 1).padStart(2, '0')}`,
    name: '',
    description: '',
    category: 'Văn thể mỹ' as Competition['category'],
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    participantScope: 'class' as Competition['participantScope'],
    transferMode: 'transfer_on_close' as CompetitionTransferMode,
    ratioDivisor: 10,
    maxTransferPoints: 20,
    organizerName: 'Đoàn Thanh niên & Ban Thi đua',
  });

  // Sub-forms inside selected competition
  const [newCritName, setNewCritName] = useState('');
  const [newCritMax, setNewCritMax] = useState(10);
  const [newCritWeight, setNewCritWeight] = useState(1);

  const [enrollType, setEnrollType] = useState<'class' | 'student' | 'group'>('class');
  const [enrollTargetId, setEnrollTargetId] = useState('');
  const [enrollGroupName, setEnrollGroupName] = useState('');

  const [scoreParticipantId, setScoreParticipantId] = useState('');
  const [scoreCriterionId, setScoreCriterionId] = useState('');
  const [scoreValue, setScoreValue] = useState('');

  const [isSyncPreviewOpen, setIsSyncPreviewOpen] = useState(false);
  const [revertingTransfer, setRevertingTransfer] = useState<ScoreTransferRecord | null>(null);
  const [revertReason, setRevertReason] = useState('');

  const selectedCompetition = useMemo(
    () => competitions.find((c) => c.id === selectedCompId) || competitions[0] || null,
    [competitions, selectedCompId]
  );

  const compCriteria = useMemo(
    () =>
      selectedCompetition
        ? competitionCriteria.filter((c) => c.competitionId === selectedCompetition.id)
        : [],
    [competitionCriteria, selectedCompetition]
  );

  const compParticipants = useMemo(
    () =>
      selectedCompetition
        ? competitionParticipants.filter((p) => p.competitionId === selectedCompetition.id)
        : [],
    [competitionParticipants, selectedCompetition]
  );

  const compAwards = useMemo(
    () =>
      selectedCompetition
        ? competitionAwards.filter((a) => a.competitionId === selectedCompetition.id)
        : [],
    [competitionAwards, selectedCompetition]
  );

  const compTransfers = useMemo(
    () =>
      selectedCompetition
        ? scoreTransfers.filter((t) => t.competitionId === selectedCompetition.id)
        : [],
    [scoreTransfers, selectedCompetition]
  );

  const leaderboard = useMemo(() => {
    if (!selectedCompetition) return [];
    return buildCompetitionLeaderboard({
      competitionId: selectedCompetition.id,
      participants: competitionParticipants,
      criteria: competitionCriteria,
      scores: competitionScores,
      existingTransfers: scoreTransfers,
    });
  }, [selectedCompetition, competitionParticipants, competitionCriteria, competitionScores, scoreTransfers]);

  const syncPlan = useMemo(() => {
    if (!selectedCompetition) return null;
    return planCompetitionTransferToEmulation({
      competition: selectedCompetition,
      leaderboard,
      existingTransfers: scoreTransfers,
      approvedBy: currentUser.displayName,
      approvedById: currentUser.id,
    });
  }, [selectedCompetition, leaderboard, scoreTransfers, currentUser]);

  const handleCreateCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = `CMP-${Date.now()}`;
    const draftComp: Competition = {
      id,
      code: compForm.code.trim(),
      name: compForm.name.trim(),
      description: compForm.description.trim() || compForm.name.trim(),
      category: compForm.category,
      academicYear,
      startDate: compForm.startDate,
      endDate: compForm.endDate,
      participantScope: compForm.participantScope,
      transferMode: compForm.transferMode,
      ratioDivisor: compForm.ratioDivisor,
      maxTransferPoints: compForm.maxTransferPoints,
      status: 'ongoing',
      organizerName: compForm.organizerName.trim(),
      createdBy: currentUser.displayName,
      createdAt: new Date().toISOString(),
    };
    draftComp.status = syncCompetitionStatusByDate(draftComp);
    await onSaveCompetition(draftComp);
    setSelectedCompId(id);
    setIsCreateOpen(false);
    setCompForm((p) => ({ ...p, name: '', description: '' }));
    setFeedback({ ok: true, msg: `Đã tạo phong trào "${draftComp.name}".` });
  };

  const handleChangeCompetitionStatus = async (comp: Competition, status: CompetitionStatus) => {
    await onSaveCompetition({
      ...comp,
      status,
      manualStatusLocked: true,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAddCriterion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompetition || !newCritName.trim()) return;
    await onSaveCriterion({
      id: `CCRT-${Date.now()}`,
      competitionId: selectedCompetition.id,
      name: newCritName.trim(),
      description: newCritName.trim(),
      maxPoints: Number(newCritMax) || 10,
      weight: Number(newCritWeight) || 1,
      order: compCriteria.length + 1,
    });
    setNewCritName('');
  };

  const handleEnrollParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompetition) return;
    if (enrollType === 'class') {
      const cls = classes.find((c) => c.id === enrollTargetId);
      if (!cls) return;
      await onSaveParticipant({
        id: `CPAR-${Date.now()}`,
        competitionId: selectedCompetition.id,
        targetType: 'class',
        targetId: cls.id,
        targetName: cls.name,
        className: cls.name,
        grade: cls.grade,
        registeredAt: new Date().toISOString().split('T')[0],
        status: 'active',
      });
    } else if (enrollType === 'student') {
      const stu = students.find((s) => s.id === enrollTargetId);
      if (!stu) return;
      await onSaveParticipant({
        id: `CPAR-${Date.now()}`,
        competitionId: selectedCompetition.id,
        targetType: 'student',
        targetId: stu.id,
        targetName: stu.fullName,
        className: stu.className,
        grade: stu.grade,
        registeredAt: new Date().toISOString().split('T')[0],
        status: 'active',
      });
    } else if (enrollGroupName.trim()) {
      await onSaveParticipant({
        id: `CPAR-${Date.now()}`,
        competitionId: selectedCompetition.id,
        targetType: 'group',
        targetId: `GRP-${Date.now()}`,
        targetName: enrollGroupName.trim(),
        registeredAt: new Date().toISOString().split('T')[0],
        status: 'active',
      });
      setEnrollGroupName('');
    }
    setEnrollTargetId('');
  };

  const handleRecordScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompetition || !scoreParticipantId || !scoreCriterionId || scoreValue === '') return;
    const crit = compCriteria.find((c) => c.id === scoreCriterionId);
    await onSaveScore({
      id: `CSCR-${Date.now()}`,
      competitionId: selectedCompetition.id,
      participantId: scoreParticipantId,
      criterionId: scoreCriterionId,
      criterionName: crit?.name || 'Tiêu chí',
      score: Number(scoreValue),
      scoredBy: currentUser.displayName,
      scoredAt: new Date().toISOString(),
    });
    setScoreValue('');
  };

  const handleAssignAward = async (row: typeof leaderboard[number], title: string) => {
    if (!selectedCompetition) return;
    await onSaveAward({
      id: `CAWD-${Date.now()}-${row.participantId.slice(-4)}`,
      competitionId: selectedCompetition.id,
      participantId: row.participantId,
      targetName: row.targetName,
      targetType: row.targetType,
      className: row.className,
      awardTitle: title,
      rank: row.rank,
      totalPoints: row.totalPoints,
      awardedBy: currentUser.displayName,
      awardedAt: new Date().toISOString().split('T')[0],
    });
  };

  const handleExecuteSync = async () => {
    if (!syncPlan || syncPlan.blockedReason) return;
    for (const tr of syncPlan.newTransfers) {
      await onSaveTransfer(tr);
    }
    for (const rec of syncPlan.newEmulationRecords) {
      await onSaveEmulationRecord(rec);
    }
    setIsSyncPreviewOpen(false);
    setFeedback({
      ok: true,
      msg: `Đã đồng bộ ${syncPlan.newTransfers.length} đối tượng sang điểm Thi đua chung (bỏ qua ${syncPlan.skippedAlreadyTransferred} mục đã đồng bộ trước đó).`,
    });
  };

  const handleConfirmRevert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revertingTransfer || revertReason.trim().length < 3) return;
    const { updatedTransfer, cancelledEmulationRecordId } = revertCompetitionTransfer({
      transfer: revertingTransfer,
      revertedBy: currentUser.displayName,
      revertReason,
    });
    await onSaveTransfer(updatedTransfer);
    const linkedRec = emulationRecords.find((r) => r.id === cancelledEmulationRecordId);
    if (linkedRec) {
      await onSaveEmulationRecord({
        ...linkedRec,
        status: 'cancelled',
        overrideReason: `Hoàn tác đồng bộ phong trào: ${revertReason.trim()}`,
        updatedAt: new Date().toISOString(),
      });
    }
    setRevertingTransfer(null);
    setRevertReason('');
    setFeedback({ ok: true, msg: 'Đã hoàn tác bản ghi đồng bộ điểm và hủy bản ghi thi đua liên kết.' });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            Phong trào, Cuộc thi & Quy đổi Điểm Thi đua
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tạo phong trào, chấm điểm theo tiêu chí riêng, trao giải và đồng bộ chống cộng trùng sang Thi đua chung.
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" /> + Tạo phong trào
          </button>
        )}
      </div>

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

      {competitions.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Chưa có phong trào hoặc cuộc thi nào"
          description="Bấm '+ Tạo phong trào' để khởi tạo hội thi, phong trào tuần/tháng hoặc cuộc thi học thuật."
        />
      ) : (
        <>
          {/* Selector cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {competitions.map((c) => {
              const effectiveStatus = syncCompetitionStatusByDate(c);
              const isSelected = selectedCompetition?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCompId(c.id)}
                  className="text-left cursor-pointer"
                >
                  <LiquidCard
                    className={`p-4 space-y-1.5 transition-all ${
                      isSelected ? 'ring-2 ring-sky-500 bg-white/90 dark:bg-slate-800/90' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-tabular text-[11px] font-bold text-sky-600">{c.code}</span>
                      <Badge
                        variant={effectiveStatus === 'ongoing' ? 'mint' : effectiveStatus === 'closed' ? 'gray' : 'blue'}
                        size="sm"
                      >
                        {effectiveStatus === 'ongoing'
                          ? 'Đang diễn ra'
                          : effectiveStatus === 'upcoming'
                          ? 'Sắp diễn ra'
                          : 'Đã đóng'}
                      </Badge>
                    </div>
                    <p className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 line-clamp-1">
                      {c.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {c.startDate} → {c.endDate} · {c.category}
                    </p>
                  </LiquidCard>
                </button>
              );
            })}
          </div>

          {selectedCompetition && (
            <div className="space-y-4">
              {/* Control bar for selected competition */}
              <LiquidCard className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                    {selectedCompetition.name}
                  </h4>
                  <p className="text-slate-500 dark:text-slate-400">
                    Chế độ quy đổi:{' '}
                    <strong>
                      {selectedCompetition.transferMode === 'standalone'
                        ? 'Độc lập (không cộng thi đua)'
                        : selectedCompetition.transferMode === 'transfer_on_close'
                        ? 'Quy đổi khi đóng phong trào'
                        : selectedCompetition.transferMode === 'direct_sync'
                        ? 'Đồng bộ trực tiếp'
                        : `Quy đổi tỉ lệ (chia ${selectedCompetition.ratioDivisor || 10})`}
                    </strong>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canApprove && (
                    <>
                      <select
                        value={selectedCompetition.status}
                        onChange={(e) =>
                          handleChangeCompetitionStatus(selectedCompetition, e.target.value as CompetitionStatus)
                        }
                        className="bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 font-semibold"
                      >
                        <option value="upcoming">Sắp diễn ra</option>
                        <option value="ongoing">Đang diễn ra</option>
                        <option value="closed">Đóng phong trào</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => setIsSyncPreviewOpen(true)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Đồng bộ sang Thi đua
                      </button>
                    </>
                  )}
                  {canExport && (
                    <>
                      <button
                        type="button"
                        data-testid="btn-export-competition-docx"
                        onClick={() =>
                          void exportCompetitionToDocx({
                            schoolName,
                            competition: selectedCompetition,
                            criteria: compCriteria,
                            leaderboard,
                            awards: compAwards,
                          })
                        }
                        className="px-3 py-1.5 rounded-xl bg-white/85 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <FileDown className="w-3.5 h-3.5 text-sky-600" /> Xuất Word
                      </button>
                      <button
                        type="button"
                        data-testid="btn-export-competition-pdf"
                        onClick={() =>
                          void exportCompetitionToPdf({
                            schoolName,
                            competition: selectedCompetition,
                            leaderboard,
                            awards: compAwards,
                          })
                        }
                        className="px-3 py-1.5 rounded-xl bg-white/85 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <FileDown className="w-3.5 h-3.5 text-rose-600" /> Xuất PDF
                      </button>
                    </>
                  )}
                </div>
              </LiquidCard>

              {/* Setup Criteria + Participants + Scoring */}
              {canCreate && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
                  {/* 1. Criteria */}
                  <LiquidCard className="p-4 space-y-3">
                    <h5 className="font-bold text-slate-800 dark:text-slate-100">
                      1. Tiêu chí Chấm ({compCriteria.length})
                    </h5>
                    <form onSubmit={handleAddCriterion} className="space-y-2">
                      <input
                        type="text"
                        required
                        value={newCritName}
                        onChange={(e) => setNewCritName(e.target.value)}
                        placeholder="Tên tiêu chí (VD: Trang trí lớp)..."
                        className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          value={newCritMax}
                          onChange={(e) => setNewCritMax(Number(e.target.value) || 10)}
                          placeholder="Điểm tối đa"
                          className="bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 font-mono-tabular"
                        />
                        <input
                          type="number"
                          step="0.5"
                          value={newCritWeight}
                          onChange={(e) => setNewCritWeight(Number(e.target.value) || 1)}
                          placeholder="Hệ số"
                          className="bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 font-mono-tabular"
                        />
                      </div>
                      <button type="submit" className="w-full py-1.5 rounded-xl bg-sky-600 text-white font-bold cursor-pointer">
                        + Thêm tiêu chí
                      </button>
                    </form>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {compCriteria.map((cr) => (
                        <div key={cr.id} className="flex items-center justify-between px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800">
                          <span>{cr.name} (x{cr.weight})</span>
                          <button type="button" onClick={() => onDeleteCriterion(cr.id)} className="text-rose-500 cursor-pointer">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </LiquidCard>

                  {/* 2. Participants */}
                  <LiquidCard className="p-4 space-y-3">
                    <h5 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-emerald-600" />
                      2. Thí sinh / Đơn vị ({compParticipants.length})
                    </h5>
                    <form onSubmit={handleEnrollParticipant} className="space-y-2">
                      <select
                        value={enrollType}
                        onChange={(e) => {
                          setEnrollType(e.target.value as 'class' | 'student' | 'group');
                          setEnrollTargetId('');
                        }}
                        className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5"
                      >
                        <option value="class">Tập thể Lớp</option>
                        <option value="student">Học sinh</option>
                        <option value="group">Nhóm / Đội</option>
                      </select>
                      {enrollType === 'group' ? (
                        <input
                          type="text"
                          required
                          value={enrollGroupName}
                          onChange={(e) => setEnrollGroupName(e.target.value)}
                          placeholder="Tên đội thi..."
                          className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5"
                        />
                      ) : (
                        <select
                          required
                          value={enrollTargetId}
                          onChange={(e) => setEnrollTargetId(e.target.value)}
                          className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5"
                        >
                          <option value="">-- Chọn đối tượng --</option>
                          {enrollType === 'class'
                            ? classes.map((c) => (
                                <option key={c.id} value={c.id}>
                                  Lớp {c.name}
                                </option>
                              ))
                            : students.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.fullName} ({s.className})
                                </option>
                              ))}
                        </select>
                      )}
                      <button type="submit" className="w-full py-1.5 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer">
                        + Ghi danh tham gia
                      </button>
                    </form>
                  </LiquidCard>

                  {/* 3. Score Entry */}
                  <LiquidCard className="p-4 space-y-3">
                    <h5 className="font-bold text-slate-800 dark:text-slate-100">3. Chấm điểm</h5>
                    <form onSubmit={handleRecordScore} className="space-y-2">
                      <select
                        required
                        value={scoreParticipantId}
                        onChange={(e) => setScoreParticipantId(e.target.value)}
                        className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5"
                      >
                        <option value="">-- Chọn thí sinh / lớp --</option>
                        {compParticipants.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.targetName}
                          </option>
                        ))}
                      </select>
                      <select
                        required
                        value={scoreCriterionId}
                        onChange={(e) => setScoreCriterionId(e.target.value)}
                        className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5"
                      >
                        <option value="">-- Chọn tiêu chí --</option>
                        {compCriteria.map((cr) => (
                          <option key={cr.id} value={cr.id}>
                            {cr.name} (Max {cr.maxPoints})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.5"
                        required
                        value={scoreValue}
                        onChange={(e) => setScoreValue(e.target.value)}
                        placeholder="Số điểm..."
                        className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 font-mono-tabular"
                      />
                      <button type="submit" className="w-full py-1.5 rounded-xl bg-indigo-600 text-white font-bold cursor-pointer">
                        Lưu điểm chấm
                      </button>
                    </form>
                  </LiquidCard>
                </div>
              )}

              {/* Leaderboard */}
              <LiquidCard className="p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                  <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Bảng Xếp hạng Phong trào ({leaderboard.length})
                  </h5>
                  {canExport && compAwards.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        exportCertificatesToPdf({
                          schoolName,
                          academicYear,
                          recipients: compAwards.map((a) => ({
                            recipientName: a.targetName,
                            className: a.className,
                            achievementTitle: a.awardTitle,
                            reason: `Đạt giải trong phong trào "${selectedCompetition.name}"`,
                          })),
                        })
                      }
                      className="text-xs font-semibold text-amber-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Award className="w-3.5 h-3.5" /> In Giấy khen Giải thưởng
                    </button>
                  )}
                </div>
                {leaderboard.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400">
                    Chưa có đơn vị/thí sinh nào tham gia phong trào này.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/70 dark:bg-slate-800/70 text-slate-500 font-semibold uppercase">
                        <tr>
                          <th className="px-4 py-2.5">Hạng</th>
                          <th className="px-4 py-2.5">Thí sinh / Lớp</th>
                          <th className="px-4 py-2.5">Tổng điểm</th>
                          <th className="px-4 py-2.5">Giải thưởng</th>
                          <th className="px-4 py-2.5">Đồng bộ Thi đua</th>
                          {canApprove && <th className="px-4 py-2.5 text-right">Trao giải</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {leaderboard.map((row) => {
                          const award = compAwards.find((a) => a.participantId === row.participantId);
                          return (
                            <tr key={row.participantId}>
                              <td className="px-4 py-2.5 font-mono-tabular font-extrabold text-amber-600">#{row.rank}</td>
                              <td className="px-4 py-2.5 font-bold">{row.targetName}</td>
                              <td className="px-4 py-2.5 font-mono-tabular font-bold text-sky-700 dark:text-sky-300">
                                {row.totalPoints}
                              </td>
                              <td className="px-4 py-2.5">
                                {award ? <Badge variant="amber" size="sm">{award.awardTitle}</Badge> : '—'}
                              </td>
                              <td className="px-4 py-2.5">
                                {row.alreadyTransferred ? (
                                  <Badge variant="mint" size="sm">+{row.transferredPoints}đ đã đồng bộ</Badge>
                                ) : (
                                  <span className="text-slate-400">Chưa đồng bộ</span>
                                )}
                              </td>
                              {canApprove && (
                                <td className="px-4 py-2.5 text-right">
                                  <div className="inline-flex gap-1">
                                    {['Giải Nhất', 'Giải Nhì', 'Giải Ba'].map((ttl) => (
                                      <button
                                        key={ttl}
                                        type="button"
                                        onClick={() => handleAssignAward(row, ttl)}
                                        className="px-2 py-0.5 rounded-lg bg-amber-500/12 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold cursor-pointer"
                                      >
                                        {ttl.replace('Giải ', '')}
                                      </button>
                                    ))}
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </LiquidCard>

              {/* Transfer Ledger & Revert */}
              {compTransfers.length > 0 && (
                <LiquidCard className="p-0 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/60">
                    <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      Nhật ký Quy đổi Điểm sang Thi đua chung ({compTransfers.length})
                    </h5>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/70 dark:bg-slate-800/70 text-slate-500 font-semibold uppercase">
                        <tr>
                          <th className="px-4 py-2">Đối tượng</th>
                          <th className="px-4 py-2">Điểm PT → Thi đua</th>
                          <th className="px-4 py-2">Trạng thái</th>
                          {canApprove && <th className="px-4 py-2 text-right">Hoàn tác</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {compTransfers.map((tr) => (
                          <tr key={tr.id}>
                            <td className="px-4 py-2 font-bold">{tr.targetName}</td>
                            <td className="px-4 py-2 font-mono-tabular">
                              {tr.rawCompetitionPoints} → <strong className="text-emerald-600">+{tr.pointsTransferred}đ</strong>
                            </td>
                            <td className="px-4 py-2">
                              <Badge variant={tr.syncStatus === 'synced' ? 'mint' : 'gray'} size="sm">
                                {tr.syncStatus === 'synced' ? 'Đã đồng bộ' : 'Đã hoàn tác'}
                              </Badge>
                            </td>
                            {canApprove && (
                              <td className="px-4 py-2 text-right">
                                {tr.syncStatus === 'synced' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRevertingTransfer(tr);
                                      setRevertReason('');
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-rose-500/12 text-rose-700 dark:text-rose-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <RotateCcw className="w-3 h-3" /> Hoàn tác
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </LiquidCard>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal: Create Competition */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Tạo Phong trào / Cuộc thi mới"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateCompetition} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Mã phong trào *</label>
              <input
                required
                type="text"
                value={compForm.code}
                onChange={(e) => setCompForm((p) => ({ ...p, code: e.target.value }))}
                className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Lĩnh vực</label>
              <select
                value={compForm.category}
                onChange={(e) => setCompForm((p) => ({ ...p, category: e.target.value as Competition['category'] }))}
                className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
              >
                <option value="Văn thể mỹ">Văn thể mỹ</option>
                <option value="Học tập">Học tập</option>
                <option value="Nề nếp">Nề nếp</option>
                <option value="Kỹ năng">Kỹ năng</option>
                <option value="Sáng tạo">Sáng tạo</option>
                <option value="Tình nguyện">Tình nguyện</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Tên phong trào / Cuộc thi *</label>
            <input
              required
              type="text"
              value={compForm.name}
              onChange={(e) => setCompForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="VD: Hội diễn Văn nghệ Chào mừng 20/11"
              className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Ngày bắt đầu</label>
              <input
                type="date"
                required
                value={compForm.startDate}
                onChange={(e) => setCompForm((p) => ({ ...p, startDate: e.target.value }))}
                className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Ngày kết thúc</label>
              <input
                type="date"
                required
                value={compForm.endDate}
                onChange={(e) => setCompForm((p) => ({ ...p, endDate: e.target.value }))}
                className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono-tabular"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Cơ chế liên thông điểm sang Thi đua chung</label>
            <select
              value={compForm.transferMode}
              onChange={(e) => setCompForm((p) => ({ ...p, transferMode: e.target.value as CompetitionTransferMode }))}
              className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
            >
              <option value="transfer_on_close">Quy đổi khi đóng/kết thúc phong trào</option>
              <option value="direct_sync">Đồng bộ trực tiếp ngay</option>
              <option value="ratio_transfer">Quy đổi theo tỉ lệ chia</option>
              <option value="standalone">Độc lập (không cộng vào thi đua chung)</option>
            </select>
          </div>
          {compForm.transferMode === 'ratio_transfer' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Hệ số chia (VD: 10đ PT = 1đ TĐ)</label>
                <input
                  type="number"
                  min={1}
                  value={compForm.ratioDivisor}
                  onChange={(e) => setCompForm((p) => ({ ...p, ratioDivisor: Number(e.target.value) || 10 }))}
                  className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono-tabular"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Trần điểm quy đổi tối đa</label>
                <input
                  type="number"
                  min={1}
                  value={compForm.maxTransferPoints}
                  onChange={(e) => setCompForm((p) => ({ ...p, maxTransferPoints: Number(e.target.value) || 20 }))}
                  className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono-tabular"
                />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 cursor-pointer">
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-amber-600 text-white font-bold cursor-pointer">
              Khởi tạo Phong trào
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Sync Preview */}
      <Modal
        isOpen={isSyncPreviewOpen}
        onClose={() => setIsSyncPreviewOpen(false)}
        title="Xem trước Đồng bộ Điểm sang Thi đua chung"
        maxWidth="md"
      >
        {syncPlan && (
          <div className="space-y-3 text-xs">
            {syncPlan.blockedReason ? (
              <div className="p-3 rounded-xl bg-rose-500/12 text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{syncPlan.blockedReason}</span>
              </div>
            ) : (
              <>
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 space-y-1">
                  <p>
                    Số đối tượng sẽ cộng điểm mới: <strong>{syncPlan.newTransfers.length}</strong>
                  </p>
                  <p>
                    Số đối tượng bỏ qua (đã đồng bộ trước đó — chống cộng trùng):{' '}
                    <strong>{syncPlan.skippedAlreadyTransferred}</strong>
                  </p>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {syncPlan.newTransfers.map((t) => (
                    <div key={t.id} className="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                      <span>{t.targetName}</span>
                      <span className="font-mono-tabular font-bold text-emerald-600">+{t.pointsTransferred}đ</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsSyncPreviewOpen(false)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 cursor-pointer">
                Đóng
              </button>
              {!syncPlan.blockedReason && syncPlan.newTransfers.length > 0 && (
                <button
                  type="button"
                  onClick={handleExecuteSync}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer"
                >
                  Xác nhận Đồng bộ
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Revert Transfer */}
      <Modal
        isOpen={Boolean(revertingTransfer)}
        onClose={() => setRevertingTransfer(null)}
        title="Hoàn tác Đồng bộ Điểm Phong trào"
        maxWidth="md"
      >
        {revertingTransfer && (
          <form onSubmit={handleConfirmRevert} className="space-y-3 text-xs">
            <p className="text-slate-600 dark:text-slate-300">
              Hoàn tác +{revertingTransfer.pointsTransferred}đ của <strong>{revertingTransfer.targetName}</strong> và hủy bản ghi thi đua liên kết.
            </p>
            <div>
              <label className="block font-semibold mb-1">Lý do hoàn tác *</label>
              <textarea
                required
                rows={2}
                value={revertReason}
                onChange={(e) => setRevertReason(e.target.value)}
                placeholder="Nhập lý do hoàn tác điểm (tối thiểu 3 ký tự)..."
                className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setRevertingTransfer(null)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 cursor-pointer">
                Hủy
              </button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold cursor-pointer">
                Xác nhận Hoàn tác
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
