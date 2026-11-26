import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  Database,
  RefreshCw,
  Trash2,
  X,
} from '../icons/UiIcons';
import type { LegacyMigrationSummary, SyncConflictPrompt } from '../../types';

interface SyncConflictModalProps {
  conflict: SyncConflictPrompt | null;
  onResolve: (strategy: 'keep_server' | 'overwrite_local' | 'custom', customMerged?: Record<string, unknown>) => Promise<void>;
  onDismiss: () => void;
}

export const SyncConflictModal: React.FC<SyncConflictModalProps> = ({
  conflict,
  onResolve,
  onDismiss,
}) => {
  const [fieldChoices, setFieldChoices] = useState<Record<string, 'local' | 'server'>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!conflict) return null;

  const handleResolve = async (strategy: 'keep_server' | 'overwrite_local' | 'custom') => {
    setIsSubmitting(true);
    try {
      if (strategy === 'custom') {
        const merged: Record<string, unknown> = { ...conflict.mergedPreview };
        for (const item of conflict.conflictingFields) {
          const choice = fieldChoices[item.field] || 'local';
          merged[item.field] = choice === 'server' ? item.serverValue : item.localValue;
        }
        await onResolve('custom', merged);
      } else {
        await onResolve(strategy);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatVal = (val: unknown): string => {
    if (val === undefined || val === null || val === '') return '(Trống)';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4">
      <div
        data-testid="sync-conflict-modal"
        className="w-full max-w-2xl rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-4 border-b border-slate-900/10 dark:border-white/10 flex items-center justify-between bg-amber-500/10">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">
                Phát hiện xung đột đồng bộ ({conflict.collectionLabel})
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                Bản ghi <span className="font-semibold">{conflict.recordLabel}</span> vừa được người khác cập nhật lên phiên bản v{conflict.serverVersion} trong khi bạn đang sửa từ v{conflict.expectedVersion}.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="p-1.5 rounded-xl hover:bg-white/50 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3">
          {conflict.conflictingFields.map((item) => {
            const chosen = fieldChoices[item.field] || 'local';
            return (
              <div
                key={item.field}
                className="rounded-2xl glass-subsurface p-3.5 space-y-2"
              >
                <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Trường: <span className="font-mono text-sky-600 dark:text-sky-400">{item.field}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFieldChoices((prev) => ({ ...prev, [item.field]: 'server' }))}
                    className={`text-left p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                      chosen === 'server'
                        ? 'border-sky-500 bg-sky-500/15 ring-2 ring-sky-400/30'
                        : 'glass-subsurface'
                    }`}
                  >
                    <div className="text-[10px] font-bold text-sky-700 dark:text-sky-300 mb-1">
                      Bản trên máy chủ (Mới nhất)
                    </div>
                    <div className="text-slate-900 dark:text-slate-100 break-words">
                      {formatVal(item.serverValue)}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFieldChoices((prev) => ({ ...prev, [item.field]: 'local' }))}
                    className={`text-left p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                      chosen === 'local'
                        ? 'border-emerald-500 bg-emerald-500/15 ring-2 ring-emerald-400/30'
                        : 'glass-subsurface'
                    }`}
                  >
                    <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 mb-1">
                      Bản bạn vừa sửa
                    </div>
                    <div className="text-slate-900 dark:text-slate-100 break-words">
                      {formatVal(item.localValue)}
                    </div>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-end gap-2.5 bg-slate-50 dark:bg-slate-800">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleResolve('keep_server')}
            className="px-3.5 py-2 rounded-xl glass-subsurface text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-white/75 dark:hover:bg-slate-800/75 cursor-pointer"
          >
            Giữ bản máy chủ
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleResolve('custom')}
            className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer shadow-sm"
          >
            Áp dụng lựa chọn từng trường
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleResolve('overwrite_local')}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer shadow-sm"
          >
            Ghi đè bằng bản của tôi
          </button>
        </div>
      </div>
    </div>
  );
};

interface LegacyMigrationModalProps {
  isOpen: boolean;
  summary: LegacyMigrationSummary | null;
  isMigrating: boolean;
  onConfirmMigrate: () => Promise<void>;
  onPurgeOnly: () => void;
  onClose: () => void;
}

export const LegacyMigrationModal: React.FC<LegacyMigrationModalProps> = ({
  isOpen,
  summary,
  isMigrating,
  onConfirmMigrate,
  onPurgeOnly,
  onClose,
}) => {
  if (!isOpen || !summary) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4">
      <div
        data-testid="legacy-migration-modal"
        className="w-full max-w-2xl rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
      >
        <div className="px-6 py-4 border-b border-slate-900/10 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">
                Chuyển dữ liệu cục bộ cũ lên Cloud Firestore
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                Phát hiện {summary.totalLocalRecords} bản ghi trong trình duyệt ({summary.totalNewRecords} bản ghi mới, {summary.totalDuplicateRecords} bản ghi đã có trên máy chủ).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/50 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-2.5">
          {summary.collections.length === 0 ? (
            <div className="rounded-2xl glass-subsurface p-4 text-xs text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Không còn bản ghi nghiệp vụ chưa đồng bộ trong trình duyệt này.</span>
            </div>
          ) : (
            summary.collections.map((c) => (
              <div
                key={c.localStorageKey}
                className="flex items-center justify-between rounded-2xl glass-subsurface px-4 py-2.5 text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {c.collectionName}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{c.localStorageKey}</div>
                </div>
                <div className="text-right font-mono-tabular">
                  <div className="font-bold text-sky-600 dark:text-sky-400">
                    +{c.newCount} bản ghi mới
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Trùng ID bỏ qua: {c.duplicateCount}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2.5 bg-slate-50 dark:bg-slate-800">
          <button
            type="button"
            disabled={isMigrating}
            onClick={onPurgeOnly}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa bộ nhớ cục bộ cũ (không tải lên)</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isMigrating}
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl glass-subsurface text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
            >
              Để sau
            </button>
            <button
              type="button"
              disabled={isMigrating || summary.totalNewRecords === 0}
              onClick={onConfirmMigrate}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer shadow-md"
            >
              {isMigrating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang đồng bộ lên Cloud...</span>
                </>
              ) : (
                <span>Tải {summary.totalNewRecords} bản ghi lên Firestore &amp; Dọn bộ nhớ cũ</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface OfflineSyncBannerProps {
  isOnline: boolean;
  syncError?: string | null;
}

export const OfflineSyncBanner: React.FC<OfflineSyncBannerProps> = ({ isOnline, syncError }) => {
  if (isOnline && !syncError) return null;

  return (
    <div
      data-testid="offline-sync-banner"
      className={`fixed top-[72px] left-1/2 -translate-x-1/2 z-[110] max-w-xl w-[calc(100%-24px)] rounded-2xl px-4 py-2.5 bg-white dark:bg-slate-900 shadow-lg border flex items-center gap-2.5 text-xs font-medium ${
        !isOnline
          ? 'border-amber-400 text-amber-900 dark:text-amber-100'
          : 'border-rose-400 text-rose-900 dark:text-rose-100'
      }`}
    >
      {!isOnline ? (
        <>
          <CloudOff className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            Mất kết nối Internet. Đang hiển thị bản sao đọc trực tuyến mới nhất; mọi thao tác lưu mới tạm thời bị khóa để tránh lệch dữ liệu.
          </span>
        </>
      ) : (
        <>
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <span className="truncate">{syncError}</span>
        </>
      )}
    </div>
  );
};
