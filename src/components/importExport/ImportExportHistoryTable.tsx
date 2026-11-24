import React, { useState } from 'react';
import { Download, Search, Upload } from 'lucide-react';
import type { ExportHistoryRecord, ImportHistoryRecord } from '../../types';
import { formatDateTimeSafe } from '../../utils/crossAppSync';

interface ImportExportHistoryTableProps {
  importHistory: ImportHistoryRecord[];
  exportHistory: ExportHistoryRecord[];
}

export const ImportExportHistoryTable: React.FC<ImportExportHistoryTableProps> = ({
  importHistory,
  exportHistory,
}) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();

  const filteredImports = importHistory.filter(
    (h) =>
      !q ||
      h.moduleTitle.toLowerCase().includes(q) ||
      h.fileName.toLowerCase().includes(q) ||
      h.actorName.toLowerCase().includes(q)
  );

  const filteredExports = exportHistory.filter(
    (h) =>
      !q ||
      h.moduleTitle.toLowerCase().includes(q) ||
      h.fileName.toLowerCase().includes(q) ||
      h.actorName.toLowerCase().includes(q)
  );

  return (
    <div className="space-y-3" data-testid="import-export-history-table">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="glass-pill-tray flex items-center gap-1 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'import' ? 'glass-pill-tab-active' : 'glass-pill-tab'
            }`}
          >
            <Upload size={13} />
            <span>Lịch sử Import ({importHistory.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'export' ? 'glass-pill-tab-active' : 'glass-pill-tab'
            }`}
          >
            <Download size={13} />
            <span>Lịch sử Export ({exportHistory.length})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm phân hệ, tên tệp, người thao tác..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl glass-subsurface text-slate-800 dark:text-white focus:outline-none"
          />
        </div>
      </div>

      <div className="glass-table-shell overflow-x-auto">
        {activeTab === 'import' ? (
          <table className="w-full text-left text-xs">
            <thead className="glass-table-head">
              <tr>
                <th className="px-3 py-2.5 font-bold">Thời gian</th>
                <th className="px-3 py-2.5 font-bold">Phân hệ</th>
                <th className="px-3 py-2.5 font-bold">Tệp nguồn</th>
                <th className="px-3 py-2.5 font-bold">Người thực hiện</th>
                <th className="px-3 py-2.5 font-bold">Kết quả</th>
                <th className="px-3 py-2.5 font-bold">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/25 dark:divide-white/10">
              {filteredImports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    Chưa có lịch sử Import Excel nào.
                  </td>
                </tr>
              ) : (
                filteredImports.map((h) => (
                  <tr key={h.id} className="glass-table-row">
                    <td className="px-3 py-2.5 font-mono-tabular whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {formatDateTimeSafe(h.timestamp)}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-white">
                      {h.moduleTitle}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 max-w-[180px] truncate">
                      {h.fileName}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">
                      {h.actorName}
                    </td>
                    <td className="px-3 py-2.5 font-mono-tabular text-slate-700 dark:text-slate-300">
                      +{h.createdCount} / ↻{h.updatedCount} / ✕{h.failedCount}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                          h.status === 'completed'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : h.status === 'partial'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            : 'bg-red-500/15 text-red-700 dark:text-red-300'
                        }`}
                      >
                        {h.status === 'completed'
                          ? 'Thành công'
                          : h.status === 'partial'
                          ? 'Một phần'
                          : 'Đã hủy'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="glass-table-head">
              <tr>
                <th className="px-3 py-2.5 font-bold">Thời gian</th>
                <th className="px-3 py-2.5 font-bold">Phân hệ</th>
                <th className="px-3 py-2.5 font-bold">Tên tệp xuất</th>
                <th className="px-3 py-2.5 font-bold">Định dạng &amp; Phạm vi</th>
                <th className="px-3 py-2.5 font-bold">Số lượng</th>
                <th className="px-3 py-2.5 font-bold">Người xuất</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/25 dark:divide-white/10">
              {filteredExports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    Chưa có lịch sử Export nào.
                  </td>
                </tr>
              ) : (
                filteredExports.map((h) => (
                  <tr key={h.id} className="glass-table-row">
                    <td className="px-3 py-2.5 font-mono-tabular whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {formatDateTimeSafe(h.timestamp)}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-white">
                      {h.moduleTitle}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 max-w-[200px] truncate">
                      {h.fileName}
                    </td>
                    <td className="px-3 py-2.5 font-mono-tabular text-slate-700 dark:text-slate-300">
                      {h.format.toUpperCase()} · {h.scope}
                    </td>
                    <td className="px-3 py-2.5 font-mono-tabular text-slate-700 dark:text-slate-200">
                      {h.rowCount} dòng · {h.columnCount} cột
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">
                      {h.actorName}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
