import React, { useEffect, useState } from 'react';
import { Calendar, AlertTriangle, Clock } from 'lucide-react';
import { BorrowTransaction, UserProfile } from '../../types';
import { Modal } from '../common/Modal';
import {
  applyLibrarianDueDateEdit,
  calculateDueDate,
  checkIsOverdue,
  getDaysRemaining,
} from '../../utils/libraryRules';

interface LibraryDueDateModalProps {
  transaction: BorrowTransaction | null;
  currentUser: UserProfile;
  onClose: () => void;
  onConfirm: (transactionId: string, newDueDate: string, reason: string) => Promise<void> | void;
}

export const LibraryDueDateModal: React.FC<LibraryDueDateModalProps> = ({
  transaction,
  currentUser,
  onClose,
  onConfirm,
}) => {
  const [newDueDate, setNewDueDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (transaction) {
      setNewDueDate(transaction.dueDate);
      setReason('');
      setError(null);
    }
  }, [transaction]);

  if (!transaction) return null;

  const previewOverdue = newDueDate ? checkIsOverdue(newDueDate) : { isOverdue: false, daysOverdue: 0 };
  const daysRemaining = newDueDate ? getDaysRemaining(newDueDate) : 0;

  const applyOffsetDays = (days: number) => {
    const base = new Date(`${transaction.dueDate}T00:00:00Z`);
    if (Number.isNaN(base.getTime())) return;
    setNewDueDate(calculateDueDate(base, days));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = applyLibrarianDueDateEdit({
      transaction,
      newDueDate,
      reason,
      changedBy: currentUser.displayName,
      changedByRole: currentUser.role,
    });
    if (!check.valid) {
      setError(check.error || 'Dữ liệu điều chỉnh không hợp lệ.');
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(transaction.id, newDueDate, reason.trim());
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(transaction)}
      onClose={onClose}
      title="Chỉnh sửa Hạn trả sách"
      description="Thủ thư có thể điều chỉnh ngày hẹn trả trực tiếp và hệ thống sẽ lưu lịch sử kiểm toán bất biến."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
          <p className="font-bold text-slate-800 dark:text-slate-100">{transaction.bookTitle}</p>
          <p className="text-slate-500 dark:text-slate-400">
            Bạn đọc: <strong>{transaction.studentName}</strong> ({transaction.studentCode}) · Mã phiếu:{' '}
            <span className="font-mono-tabular">{transaction.transactionCode}</span>
          </p>
          <div className="flex items-center gap-4 pt-1 font-mono-tabular text-[11px] text-slate-500">
            <span>Ngày mượn: {transaction.borrowDate}</span>
            <span>Hạn hiện tại: <strong className="text-sky-600 dark:text-sky-400">{transaction.dueDate}</strong></span>
          </div>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
            Chọn hạn trả mới *
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                required
                min={transaction.borrowDate}
                value={newDueDate}
                onChange={(e) => {
                  setNewDueDate(e.target.value);
                  setError(null);
                }}
                className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 font-mono-tabular text-slate-800 dark:text-slate-100"
              />
            </div>
            {[3, 7, 14].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => applyOffsetDays(d)}
                className="px-2.5 py-2 rounded-xl bg-sky-500/12 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-semibold font-mono-tabular cursor-pointer shrink-0"
              >
                +{d}d
              </button>
            ))}
          </div>
          {newDueDate && (
            <p className="mt-1.5 text-[11px] flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Clock className="w-3.5 h-3.5 text-sky-500" />
              {previewOverdue.isOverdue ? (
                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                  Trạng thái sau lưu: Quá hạn {previewOverdue.daysOverdue} ngày
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  Trạng thái sau lưu: Đang mượn (còn {daysRemaining} ngày)
                </span>
              )}
            </p>
          )}
        </div>

        <div>
          <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
            Lý do điều chỉnh hạn trả * (bắt buộc)
          </label>
          <textarea
            required
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError(null);
            }}
            placeholder="Ví dụ: Học sinh thi học sinh giỏi cấp tỉnh, gia hạn đặc cách theo lịch ôn tập..."
            className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
          />
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-rose-500/12 text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-semibold cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold cursor-pointer disabled:opacity-50"
          >
            {submitting ? 'Đang lưu...' : 'Lưu Hạn trả mới'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
