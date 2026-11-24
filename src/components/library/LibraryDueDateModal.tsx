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
        <div className="glass-subsurface p-3.5 rounded-xl space-y-1">
          <p className="font-bold text-slate-800 dark:text-slate-100">{transaction.bookTitle}</p>
          <p className="text-slate-600 dark:text-slate-300">
            Bạn đọc: <strong>{transaction.studentName}</strong> ({transaction.studentCode}) · Mã phiếu:{' '}
            <span className="font-mono-tabular">{transaction.transactionCode}</span>
          </p>
          <div className="flex items-center gap-4 pt-1 font-mono-tabular text-[11px] text-slate-600 dark:text-slate-300">
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
                className="w-full glass-subsurface rounded-xl pl-9 pr-3 py-2 font-mono-tabular text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/40"
              />
            </div>
            {[3, 7, 14].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => applyOffsetDays(d)}
                className="px-2.5 py-2 rounded-xl glass-subsurface bg-sky-500/12 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-semibold font-mono-tabular cursor-pointer shrink-0 transition-colors"
              >
                +{d}d
              </button>
            ))}
          </div>
          {newDueDate && (
            <p className="mt-1.5 text-[11px] flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
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
            className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/40"
          />
        </div>

        {error && (
          <div className="p-2.5 rounded-xl glass-subsurface bg-rose-500/12 border-rose-400/35 text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-white/40 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl glass-subsurface hover:bg-white/70 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer transition-colors"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold shadow-sm cursor-pointer disabled:opacity-50 transition-all"
          >
            {submitting ? 'Đang lưu...' : 'Lưu Hạn trả mới'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
