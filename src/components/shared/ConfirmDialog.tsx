import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '../common/Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy bỏ',
  danger = true,
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} maxWidth="sm">
      <div className="space-y-4 text-xs">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
              danger
                ? 'bg-rose-500/15 border-rose-400/30 text-rose-600 dark:text-rose-400'
                : 'bg-sky-500/15 border-sky-400/30 text-sky-600 dark:text-sky-400'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <p className="text-slate-700 dark:text-slate-200 leading-relaxed pt-1">{message}</p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-900/10 dark:border-white/10">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-slate-800/75 text-slate-800 dark:text-slate-100 font-semibold transition-all cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className={`px-4 py-2 rounded-xl text-white font-bold shadow-sm transition-colors cursor-pointer ${
              danger
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-sky-600 hover:bg-sky-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};
