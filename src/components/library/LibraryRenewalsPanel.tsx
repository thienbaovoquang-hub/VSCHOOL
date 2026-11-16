import React, { useMemo, useState } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Send,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import {
  BookReservation,
  BorrowTransaction,
  LibraryRenewalRequest,
  SystemSettings,
  UserProfile,
} from '../../types';
import { LiquidCard } from '../common/LiquidCard';
import { Badge } from '../common/Badge';
import { EmptyState } from '../shared/EmptyState';
import { canRenewTransaction, getEffectiveLibraryPolicy } from '../../utils/libraryRules';

interface LibraryRenewalsPanelProps {
  currentUser: UserProfile;
  transactions: BorrowTransaction[];
  reservations: BookReservation[];
  renewalRequests: LibraryRenewalRequest[];
  systemSettings: SystemSettings;
  canApprove: boolean;
  onSubmitRenewalRequest: (req: LibraryRenewalRequest) => Promise<void> | void;
  onApproveRenewalRequest: (req: LibraryRenewalRequest) => Promise<void> | void;
  onRejectRenewalRequest: (req: LibraryRenewalRequest, reviewNote: string) => Promise<void> | void;
  onDirectRenew: (tx: BorrowTransaction) => Promise<void> | void;
  onOpenDueDateEdit: (tx: BorrowTransaction) => void;
}

export const LibraryRenewalsPanel: React.FC<LibraryRenewalsPanelProps> = ({
  currentUser,
  transactions,
  reservations,
  renewalRequests,
  systemSettings,
  canApprove,
  onSubmitRenewalRequest,
  onApproveRenewalRequest,
  onRejectRenewalRequest,
  onDirectRenew,
  onOpenDueDateEdit,
}) => {
  const [selectedTxId, setSelectedTxId] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const activeLoans = useMemo(
    () => transactions.filter((t) => t.status === 'borrowed' || t.status === 'overdue'),
    [transactions]
  );

  const myActiveLoans = useMemo(() => {
    if (canApprove) return activeLoans;
    return activeLoans.filter(
      (t) =>
        t.studentId === currentUser.id ||
        t.studentId === currentUser.linkedProfileId ||
        (currentUser.studentCode && t.studentCode === currentUser.studentCode)
    );
  }, [activeLoans, canApprove, currentUser]);

  const selectedTx = myActiveLoans.find((t) => t.id === selectedTxId) || null;
  const selectedEligibility = selectedTx
    ? canRenewTransaction(selectedTx, reservations, new Date(), systemSettings)
    : null;

  const visibleRequests = useMemo(() => {
    const base = canApprove
      ? renewalRequests
      : renewalRequests.filter(
          (r) =>
            r.borrowerId === currentUser.id ||
            r.borrowerId === currentUser.linkedProfileId
        );
    return base.filter((r) => statusFilter === 'all' || r.status === statusFilter);
  }, [renewalRequests, canApprove, currentUser, statusFilter]);

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTx) return;
    if (!selectedEligibility?.allowed || !selectedEligibility.newDueDate) {
      setFeedback({ ok: false, msg: selectedEligibility?.reason || 'Phiếu mượn không đủ điều kiện gia hạn.' });
      return;
    }
    const pendingSame = renewalRequests.some(
      (r) => r.transactionId === selectedTx.id && r.status === 'pending'
    );
    if (pendingSame) {
      setFeedback({ ok: false, msg: 'Phiếu mượn này đã có yêu cầu gia hạn đang chờ thủ thư duyệt.' });
      return;
    }

    const req: LibraryRenewalRequest = {
      id: `REN-${Date.now()}`,
      transactionId: selectedTx.id,
      transactionCode: selectedTx.transactionCode,
      bookId: selectedTx.bookId,
      bookTitle: selectedTx.bookTitle,
      copyBarcode: selectedTx.copyBarcode,
      borrowerId: selectedTx.studentId,
      borrowerName: selectedTx.studentName,
      borrowerRole: selectedTx.borrowerRole || currentUser.role,
      currentDueDate: selectedTx.dueDate,
      requestedDueDate: selectedEligibility.newDueDate,
      requestedDays: selectedEligibility.renewDays || 7,
      reason: requestReason.trim() || 'Cần thêm thời gian nghiên cứu tài liệu',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    await onSubmitRenewalRequest(req);
    setSelectedTxId('');
    setRequestReason('');
    setFeedback({
      ok: true,
      msg: `Đã gửi yêu cầu gia hạn đến ${req.requestedDueDate} — chờ thủ thư phê duyệt.`,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-sky-600" />
            Gia hạn Mượn sách & Điều chỉnh Hạn trả
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tách biệt luồng bạn đọc gửi yêu cầu gia hạn với luồng thủ thư phê duyệt hoặc chỉnh sửa hạn trả trực tiếp.
          </p>
        </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Request Form */}
        <LiquidCard className="lg:col-span-5 p-5 space-y-3 text-xs">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <Send className="w-4 h-4 text-sky-500" />
            Gửi Yêu cầu Gia hạn
          </h3>
          {myActiveLoans.length === 0 ? (
            <p className="text-slate-400 py-4">Không có sách đang mượn để gia hạn.</p>
          ) : (
            <form onSubmit={handleRequestSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Chọn phiếu mượn *</label>
                <select
                  required
                  value={selectedTxId}
                  onChange={(e) => setSelectedTxId(e.target.value)}
                  className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                >
                  <option value="">-- Chọn sách đang mượn --</option>
                  {myActiveLoans.map((tx) => (
                    <option key={tx.id} value={tx.id}>
                      {tx.bookTitle} — {tx.studentName} (Hạn: {tx.dueDate})
                    </option>
                  ))}
                </select>
              </div>

              {selectedTx && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 space-y-1">
                  <p>
                    Hạn hiện tại: <strong className="font-mono-tabular">{selectedTx.dueDate}</strong> · Đã gia hạn:{' '}
                    <strong className="font-mono-tabular">
                      {selectedTx.renewCount ?? 0}/
                      {getEffectiveLibraryPolicy(selectedTx.borrowerRole || 'student', systemSettings).maxRenewals}
                    </strong>{' '}
                    lần
                  </p>
                  {selectedEligibility?.allowed ? (
                    <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      Đủ điều kiện gia hạn đến: {selectedEligibility.newDueDate} (+{selectedEligibility.renewDays} ngày)
                    </p>
                  ) : (
                    <p className="text-rose-600 dark:text-rose-400 font-semibold">
                      {selectedEligibility?.reason}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block font-semibold mb-1">Lý do xin gia hạn *</label>
                <textarea
                  required
                  rows={2}
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  placeholder="Ví dụ: Em chưa đọc xong tài liệu tham khảo cho bài kiểm tra..."
                  className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                />
              </div>

              <button
                type="submit"
                disabled={!selectedTx || !selectedEligibility?.allowed}
                className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold disabled:opacity-40 cursor-pointer"
              >
                Gửi Yêu cầu Gia hạn
              </button>
            </form>
          )}
        </LiquidCard>

        {/* Right: Approval Queue */}
        <LiquidCard className="lg:col-span-7 p-5 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-500" />
              Danh sách Yêu cầu Gia hạn ({visibleRequests.length})
            </h3>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-semibold"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">Chờ duyệt</option>
              <option value="approved">Đã duyệt</option>
              <option value="rejected">Từ chối</option>
            </select>
          </div>

          {visibleRequests.length === 0 ? (
            <EmptyState
              icon={RefreshCw}
              title="Chưa có yêu cầu gia hạn nào"
              description="Các đề nghị gia hạn do học sinh/giáo viên gửi sẽ hiển thị tại đây để thủ thư phê duyệt."
            />
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {visibleRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-3.5 rounded-xl bg-white/65 dark:bg-slate-800/65 border border-slate-200/60 dark:border-slate-700/60 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-100">{req.bookTitle}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {req.borrowerName} · <span className="font-mono-tabular">{req.transactionCode}</span>
                      </p>
                    </div>
                    <Badge
                      variant={req.status === 'approved' ? 'mint' : req.status === 'rejected' ? 'pink' : 'amber'}
                      size="sm"
                    >
                      {req.status === 'pending' ? 'Chờ duyệt' : req.status === 'approved' ? 'Đã duyệt' : 'Từ chối'}
                    </Badge>
                  </div>
                  <p className="text-[11px] font-mono-tabular text-slate-600 dark:text-slate-300">
                    Hạn cũ: {req.currentDueDate} → Đề nghị mới: <strong>{req.requestedDueDate}</strong> (+{req.requestedDays}d)
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Lý do: {req.reason}</p>
                  {req.reviewNote && (
                    <p className="text-[11px] text-indigo-600 dark:text-indigo-400">Ghi chú duyệt: {req.reviewNote}</p>
                  )}

                  {canApprove && req.status === 'pending' && (
                    <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onApproveRenewalRequest(req)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Phê duyệt gia hạn
                      </button>
                      {rejectingId === req.id ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input
                            type="text"
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            placeholder="Lý do từ chối..."
                            className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px]"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              await onRejectRenewalRequest(req, rejectNote.trim() || 'Không đạt điều kiện gia hạn');
                              setRejectingId(null);
                              setRejectNote('');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-semibold cursor-pointer"
                          >
                            Xác nhận
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRejectingId(req.id)}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/12 text-rose-700 dark:text-rose-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Từ chối
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </LiquidCard>
      </div>

      {/* Librarian Quick Direct Actions on Active Loans */}
      {canApprove && activeLoans.length > 0 && (
        <LiquidCard className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Thao tác nhanh trên Phiếu đang mượn ({activeLoans.length})
            </h3>
            <span className="text-[11px] text-slate-400">Gia hạn theo chính sách hoặc chỉnh sửa hạn trả có ghi lý do</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 dark:bg-slate-800/70 text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="px-4 py-2.5">Mã phiếu</th>
                  <th className="px-4 py-2.5">Bạn đọc</th>
                  <th className="px-4 py-2.5">Sách</th>
                  <th className="px-4 py-2.5">Hạn trả</th>
                  <th className="px-4 py-2.5">Lần gia hạn</th>
                  <th className="px-4 py-2.5 text-right">Thao tác Thủ thư</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeLoans.map((tx) => {
                  const elig = canRenewTransaction(tx, reservations, new Date(), systemSettings);
                  return (
                    <tr key={tx.id}>
                      <td className="px-4 py-2.5 font-mono-tabular font-semibold">{tx.transactionCode}</td>
                      <td className="px-4 py-2.5 font-bold">{tx.studentName}</td>
                      <td className="px-4 py-2.5">{tx.bookTitle}</td>
                      <td className="px-4 py-2.5 font-mono-tabular">{tx.dueDate}</td>
                      <td className="px-4 py-2.5 font-mono-tabular">
                        {tx.renewCount ?? 0}/{getEffectiveLibraryPolicy(tx.borrowerRole || 'student', systemSettings).maxRenewals}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={!elig.allowed}
                            title={elig.reason || `Gia hạn +${elig.renewDays} ngày`}
                            onClick={() => onDirectRenew(tx)}
                            className="px-2.5 py-1 rounded-lg bg-sky-500/12 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-semibold disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" /> +{elig.renewDays || 7}d
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenDueDateEdit(tx)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-500/12 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            Chỉnh sửa hạn trả
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </LiquidCard>
      )}
    </div>
  );
};
