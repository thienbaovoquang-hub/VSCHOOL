import React, { useMemo, useState } from 'react';
import {
  Bell, Plus, Pin, Search, CheckCircle2, Eye, RotateCcw, Pencil, ShieldAlert
} from 'lucide-react';
import {
  Announcement,
  ExportHistoryRecord,
  ImportHistoryRecord,
  ImportModuleKey,
  PermissionMatrix,
  UserProfile,
} from '../types';
import { LiquidCard } from '../components/common/LiquidCard';
import { Badge } from '../components/common/Badge';
import { ModuleDataActions } from '../components/importExport/ModuleDataActions';
import { UnifiedManualFormModal } from '../components/importExport/UnifiedManualFormModal';
import type { ValidationDbContext } from '../utils/importExport/validator';
import { resolveCatalogOptions } from '../utils/catalogs/catalogRegistry';
import { DEFAULT_PERMISSIONS, hasPermission } from '../utils/rbac';
import { formatDateTimeSafe } from '../utils/crossAppSync';
import confetti from 'canvas-confetti';

interface AnnouncementsViewProps {
  announcements: Announcement[];
  currentUser: UserProfile;
  customPermissions?: PermissionMatrix;
  validationContext?: ValidationDbContext;
  onCreateAnnouncement: (ann: Announcement) => Promise<void>;
  onUpdateAnnouncement?: (ann: Announcement) => Promise<void>;
  onUnifiedImportCommit?: (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => Promise<void> | void;
  onLogExport?: (record: ExportHistoryRecord) => Promise<void> | void;
}

export const AnnouncementsView: React.FC<AnnouncementsViewProps> = ({
  announcements,
  currentUser,
  customPermissions = DEFAULT_PERMISSIONS,
  validationContext = {},
  onCreateAnnouncement,
  onUpdateAnnouncement,
  onUnifiedImportCommit,
  onLogExport,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);

  const categoryOptions = useMemo(
    () => resolveCatalogOptions({ catalogId: 'announcement_category', runtime: validationContext }),
    [validationContext]
  );

  const canCreate = hasPermission(currentUser.role, 'announcements', 'create', customPermissions);
  const canEdit = hasPermission(currentUser.role, 'announcements', 'edit', customPermissions);

  const visibleAnnouncements = announcements.filter((a) => {
    const annStatus = a.status || 'published';
    if (!canCreate && !canEdit && annStatus !== 'published') return false;
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      a.title.toLowerCase().includes(q) ||
      a.content.toLowerCase().includes(q) ||
      a.authorName.toLowerCase().includes(q);
    const matchesCat = selectedCategory === 'all' || a.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const sortedAnnouncements = [...visibleAnnouncements].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.publishedAt.localeCompare(a.publishedAt);
  });

  const openCreateModal = () => {
    setEditingAnn(null);
    setIsModalOpen(true);
  };

  const openEditModal = (ann: Announcement) => {
    setEditingAnn(ann);
    setIsModalOpen(true);
  };

  const handleUnifiedSave = async (entity: Record<string, unknown>, isEdit: boolean) => {
    const ann = entity as unknown as Announcement;
    if (isEdit && onUpdateAnnouncement) {
      await onUpdateAnnouncement(ann);
    } else {
      await onCreateAnnouncement(ann);
    }
    confetti({ particleCount: 35, spread: 50 });
    setIsModalOpen(false);
    setEditingAnn(null);
  };

  const handleMarkRead = async (ann: Announcement) => {
    const updater = onUpdateAnnouncement || onCreateAnnouncement;
    const readIds = ann.readByIds || [];
    if (readIds.includes(currentUser.id)) return;
    await updater({ ...ann, readByIds: [...readIds, currentUser.id] });
  };

  const handleRecallOrPublish = async (ann: Announcement) => {
    const updater = onUpdateAnnouncement || onCreateAnnouncement;
    const nextStatus: Announcement['status'] =
      (ann.status || 'published') === 'published' ? 'recalled' : 'published';
    await updater({ ...ann, status: nextStatus });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Bell className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            Trung tâm Phát thanh & Thông báo Toàn trường
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Phát hành chỉ thị điều hành, lịch khảo thí, xác nhận đã đọc và lưu trữ bản tin
          </p>
        </div>

        {onUnifiedImportCommit ? (
          <ModuleDataActions
            moduleKey="announcements"
            context={validationContext}
            currentUser={currentUser}
            allRecords={announcements as unknown as Record<string, unknown>[]}
            filteredRecords={sortedAnnouncements as unknown as Record<string, unknown>[]}
            canCreate={canCreate}
            canImport={canCreate}
            canExport={canCreate || canEdit || visibleAnnouncements.length > 0}
            createLabel="Tạo Thông báo"
            onManualSave={handleUnifiedSave}
            onCommitImport={(key, items, hist) => onUnifiedImportCommit(key, items, hist)}
            onLogExport={onLogExport}
          />
        ) : (
          canCreate && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-teal-400 text-white text-xs font-bold shadow-md shadow-sky-500/20 hover:opacity-95 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Tạo Thông báo
            </button>
          )
        )}
      </div>

      {canCreate && (
        <div className="px-3.5 py-2 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          <span>
            Thông báo nhập từ Excel mặc định lưu ở trạng thái <strong>Nháp (draft)</strong> và hiển thị xem trước đối tượng nhận — cần kiểm duyệt thủ công trước khi phát hành toàn trường.
          </span>
        </div>
      )}

      <LiquidCard className="p-3.5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm tiêu đề, nội dung thông báo..."
              className="w-full bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-200 w-full sm:w-auto"
          >
            <option value="all">Tất cả Chuyên mục</option>
            {categoryOptions.map((opt) => (
              <option key={opt.id} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </LiquidCard>

      <div className="space-y-4">
        {sortedAnnouncements.map((ann) => {
          const isRead = ann.readByIds?.includes(currentUser.id);
          const annStatus = ann.status || 'published';
          return (
            <LiquidCard
              key={ann.id}
              className={`p-5 transition-all ${
                ann.isPinned
                  ? 'border-amber-200/80 dark:border-amber-700/60 bg-gradient-to-r from-amber-50/30 via-white/85 to-white/75 dark:from-amber-950/20 dark:via-slate-800/85 dark:to-slate-900/80 shadow-md'
                  : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={ann.priority === 'urgent' ? 'pink' : ann.priority === 'important' ? 'amber' : 'blue'}>
                      {ann.category}
                    </Badge>

                    {annStatus !== 'published' && (
                      <Badge variant={annStatus === 'recalled' ? 'pink' : 'gray'} size="sm">
                        {annStatus === 'draft' ? 'Bản nháp' : 'Đã thu hồi'}
                      </Badge>
                    )}

                    {ann.isPinned && (
                      <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                        <Pin className="w-3 h-3" /> Đã ghim
                      </span>
                    )}

                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Đối tượng: <strong className="text-slate-700 dark:text-slate-200">{ann.targetAudience}</strong> ·{' '}
                      <span className="tabular-nums">{ann.readByIds?.length || 0} lượt đã đọc</span>
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                    {ann.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                    {ann.content}
                  </p>
                </div>

                <div className="sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-700/60 text-xs text-slate-400 space-y-1.5">
                  <div>
                    <p className="font-semibold text-slate-700 dark:text-slate-200">{ann.authorName}</p>
                    <p className="text-[11px] text-sky-600 dark:text-sky-400">{ann.authorRole}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
                      {formatDateTimeSafe(ann.publishedAt)}
                    </p>
                  </div>

                  <div className="flex sm:justify-end items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleMarkRead(ann)}
                      disabled={isRead}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                        isRead
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                          : 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 hover:bg-sky-100'
                      }`}
                    >
                      {isRead ? <CheckCircle2 className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {isRead ? 'Đã đọc' : 'Đánh dấu đã đọc'}
                    </button>

                    {canEdit && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditModal(ann)}
                          className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-sky-600 cursor-pointer"
                          title="Chỉnh sửa"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRecallOrPublish(ann)}
                          className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-amber-600 cursor-pointer"
                          title={annStatus === 'published' ? 'Thu hồi bản tin' : 'Phát hành lại'}
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </LiquidCard>
          );
        })}
      </div>

      {sortedAnnouncements.length === 0 && (
        <div className="py-14 text-center flex flex-col items-center justify-center p-8 rounded-3xl bg-white/60 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-700/80">
          <div className="w-14 h-14 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-3">
            <Bell className="w-7 h-7 stroke-1" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Chưa có thông báo nào</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-5">
            Bảng tin thông báo điều hành và hoạt động nhà trường hiện đang trống.
          </p>
          {canCreate && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white text-xs font-semibold shadow-md flex items-center gap-2 hover:opacity-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Tạo thông báo đầu tiên
            </button>
          )}
        </div>
      )}

      <UnifiedManualFormModal
        isOpen={isModalOpen}
        moduleKey="announcements"
        context={validationContext}
        existingRecords={announcements as unknown as Record<string, unknown>[]}
        initialValues={
          editingAnn
            ? (editingAnn as unknown as Record<string, unknown>)
            : { status: 'published' }
        }
        editingRecordId={editingAnn?.id}
        currentUser={currentUser}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAnn(null);
        }}
        onSave={handleUnifiedSave}
      />
    </div>
  );
};
