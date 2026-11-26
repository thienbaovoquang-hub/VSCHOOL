import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Search,
  Trash2,
  Upload,
  X,
} from '../icons/UiIcons';
import type {
  EmulationRecord,
  ExportHistoryRecord,
  ImportHistoryRecord,
  ImportModuleKey,
  RuleCategory,
  RuleCriterion,
  RuleDocument,
  RuleVersion,
  UserProfile,
} from '../../types';
import { Badge } from '../common/Badge';
import { EmptyState } from '../shared/EmptyState';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { BulkSelectionBar } from '../shared/BulkSelectionBar';
import { ExcelImportDialog } from '../importExport/ExcelImportDialog';
import type { ValidationDbContext } from '../../utils/importExport/validator';
import { getSchemaByKey } from '../../utils/importExport/schemas';
import {
  generateTemplateWorkbookBuffer,
  triggerBinaryDownload,
} from '../../utils/importExport/excelEngine';
import {
  CANONICAL_RULE_GROUPS,
  canDeleteRuleCriterion,
  classifyCriterionPointSign,
  findCanonicalRuleGroup,
  groupAndFilterRuleCriteria,
  type RulePointSignFilter,
} from '../../utils/emulationRules';
import {
  areAllVisibleSelected,
  pruneStaleSelectedIds,
  toggleSelectAllVisible,
  toggleSelectedId,
} from '../../utils/bulkSelection';

interface RulesManagementSectionProps {
  currentUser: UserProfile;
  schoolName: string;
  academicYear: string;
  validationContext?: ValidationDbContext;
  ruleDocuments: RuleDocument[];
  ruleVersions: RuleVersion[];
  ruleCategories: RuleCategory[];
  ruleCriteria: RuleCriterion[];
  emulationRecords: EmulationRecord[];
  canEdit: boolean;
  canApprove: boolean;
  canExport: boolean;
  onSaveDocument: (doc: RuleDocument) => Promise<void> | void;
  onSaveVersion: (ver: RuleVersion) => Promise<void> | void;
  onSaveCategory: (cat: RuleCategory) => Promise<void> | void;
  onSaveCriterion: (crit: RuleCriterion) => Promise<void> | void;
  onDeleteCriterion: (id: string) => Promise<void> | void;
  onDeleteCriteria?: (ids: string[]) => Promise<void> | void;
  onUnifiedImportCommit?: (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => Promise<void> | void;
  onLogExport?: (record: ExportHistoryRecord) => Promise<void> | void;
}

export const RulesManagementSection: React.FC<RulesManagementSectionProps> = ({
  currentUser,
  validationContext,
  ruleCategories,
  ruleCriteria,
  emulationRecords,
  canEdit,
  canApprove,
  onDeleteCriterion,
  onDeleteCriteria,
  onUnifiedImportCommit,
}) => {
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [pointFilter, setPointFilter] = useState<RulePointSignFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [selectedCriterionIds, setSelectedCriterionIds] = useState<string[]>([]);
  const [pendingBulkDeleteIds, setPendingBulkDeleteIds] = useState<string[] | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const canManage = canEdit || canApprove;

  const visibleByRole = useMemo(
    () =>
      ruleCriteria.filter((c) => {
        if (!canManage && c.status !== 'active') return false;
        return true;
      }),
    [ruleCriteria, canManage]
  );

  const grouped = useMemo(
    () =>
      groupAndFilterRuleCriteria(visibleByRole, {
        groupFilter,
        pointFilter,
        searchQuery,
      }),
    [visibleByRole, groupFilter, pointFilter, searchQuery]
  );

  const groupTabItems = useMemo(() => {
    const canonicalNames = new Set(CANONICAL_RULE_GROUPS.map((g) => g.name));
    const extras = new Set<string>();
    for (const key of Object.keys(grouped.countsByGroup)) {
      if (!canonicalNames.has(key)) extras.add(key);
    }
    for (const cat of ruleCategories) {
      const canonical = findCanonicalRuleGroup(cat.name);
      const normalizedName = canonical ? canonical.name : cat.name.trim();
      if (normalizedName && !canonicalNames.has(normalizedName)) {
        extras.add(normalizedName);
      }
    }

    const base = CANONICAL_RULE_GROUPS.map((g) => ({
      name: g.name,
      shortLabel: g.shortLabel,
      count: grouped.countsByGroup[g.name] || 0,
    }));

    const extraItems = Array.from(extras)
      .sort((a, b) => a.localeCompare(b, 'vi'))
      .map((name) => ({
        name,
        shortLabel: name,
        count: grouped.countsByGroup[name] || 0,
      }));

    return [...base, ...extraItems];
  }, [grouped.countsByGroup, ruleCategories]);

  const effectiveSelectedCriterionIds = useMemo(
    () => pruneStaleSelectedIds(selectedCriterionIds, ruleCriteria.map((c) => c.id)),
    [selectedCriterionIds, ruleCriteria]
  );

  const visibleCriterionIds = useMemo(
    () => grouped.filtered.map((c) => c.id),
    [grouped.filtered]
  );

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    setFeedback(null);
    try {
      const schema = getSchemaByKey('rule_criteria');
      const bytes = await generateTemplateWorkbookBuffer(schema, validationContext ?? {});
      triggerBinaryDownload(
        bytes,
        schema.templateFileName,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      setFeedback({
        ok: true,
        msg: `Đã tải bản mẫu Excel (${schema.templateFileName}) gồm 8 sheet nhóm nội quy.`,
      });
    } catch (err) {
      setFeedback({
        ok: false,
        msg: err instanceof Error ? err.message : 'Không thể tạo tệp Excel mẫu.',
      });
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleTryDeleteCriterion = async (c: RuleCriterion) => {
    const check = canDeleteRuleCriterion(c.id, emulationRecords);
    if (!check.allowed) {
      setFeedback({ ok: false, msg: check.reason || 'Tiêu chí đang được tham chiếu.' });
      return;
    }
    await onDeleteCriterion(c.id);
    setSelectedCriterionIds((prev) => prev.filter((id) => id !== c.id));
    setFeedback({ ok: true, msg: `Đã xóa mục "${c.name}".` });
  };

  const handleConfirmBulkDeleteCriteria = async () => {
    if (!pendingBulkDeleteIds || pendingBulkDeleteIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const deletableIds: string[] = [];
      let blockedCount = 0;
      for (const id of pendingBulkDeleteIds) {
        const check = canDeleteRuleCriterion(id, emulationRecords);
        if (check.allowed) deletableIds.push(id);
        else blockedCount++;
      }
      if (deletableIds.length > 0) {
        if (onDeleteCriteria) {
          await onDeleteCriteria(deletableIds);
        } else {
          for (const id of deletableIds) await onDeleteCriterion(id);
        }
      }
      const deletedSet = new Set(deletableIds);
      setSelectedCriterionIds((prev) => prev.filter((id) => !deletedSet.has(id)));
      if (deletableIds.length === 0 && blockedCount > 0) {
        setFeedback({
          ok: false,
          msg: `Không thể xóa ${blockedCount} mục đã chọn vì đang được tham chiếu trong sổ thi đua.`,
        });
      } else if (blockedCount > 0) {
        setFeedback({
          ok: true,
          msg: `Đã xóa ${deletableIds.length} mục. Bỏ qua ${blockedCount} mục đang có dữ liệu ghi nhận thi đua.`,
        });
      } else {
        setFeedback({
          ok: true,
          msg: `Đã xóa ${deletableIds.length} mục nội quy.`,
        });
      }
    } finally {
      setIsBulkDeleting(false);
      setPendingBulkDeleteIds(null);
    }
  };

  const hasActiveFilters =
    groupFilter !== 'all' || pointFilter !== 'all' || searchQuery.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Top Action Bar: Excel Template Download + Excel Import Only */}
      <div className="glass-subsurface rounded-2xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
              Nội quy & Tiêu chí thi đua (Nhập từ Excel)
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
              File mẫu chia sẵn 8 sheet nhóm · Cột mỗi sheet:{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                STT | Danh mục | Điểm (+/-) | Hình thức kỉ luật | Ghi chú
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            data-testid="btn-download-rules-template"
            disabled={isDownloadingTemplate}
            onClick={() => void handleDownloadTemplate()}
            className="px-3.5 py-2 rounded-xl glass-subsurface hover:bg-white/85 dark:hover:bg-white/10 border border-slate-300/70 dark:border-white/15 text-slate-800 dark:text-slate-100 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            {isDownloadingTemplate ? 'Đang tạo bản mẫu...' : 'Tải bản mẫu Excel'}
          </button>

          {canManage && (
            <button
              type="button"
              data-testid="btn-import-rules-excel"
              onClick={() => setIsImportOpen(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Nhập file Excel
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 ${
            feedback.ok
              ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/12 text-rose-700 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.ok ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.msg}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Đóng thông báo"
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Group Tabs + Point Sign Filter + Search */}
      <div className="space-y-3">
        {/* 8 Group Pills */}
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Phân loại theo nhóm nội quy">
          <button
            type="button"
            role="tab"
            aria-selected={groupFilter === 'all'}
            data-testid="filter-group-all"
            onClick={() => setGroupFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
              groupFilter === 'all'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'glass-subsurface text-slate-700 dark:text-slate-200 hover:bg-white/85 dark:hover:bg-white/10'
            }`}
          >
            <span>Tất cả nhóm</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono-tabular ${
                groupFilter === 'all'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200/70 dark:bg-white/10 text-slate-700 dark:text-slate-300'
              }`}
            >
              {visibleByRole.length}
            </span>
          </button>

          {groupTabItems.map((grp, idx) => {
            const active = groupFilter === grp.name;
            return (
              <button
                key={grp.name}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`filter-group-${idx + 1}`}
                onClick={() => setGroupFilter(grp.name)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                  active
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'glass-subsurface text-slate-700 dark:text-slate-200 hover:bg-white/85 dark:hover:bg-white/10'
                }`}
              >
                <span>{grp.name}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono-tabular ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200/70 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {grp.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Point Sign Filter + Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div className="glass-pill-tray inline-flex flex-wrap items-center gap-1 p-1 rounded-2xl w-fit max-w-full">
            {(
              [
                {
                  key: 'all',
                  label: 'Tất cả điểm',
                  count: visibleByRole.length,
                  testId: 'filter-point-all',
                  dotClass: 'bg-slate-400',
                },
                {
                  key: 'positive',
                  label: 'Điểm +',
                  count: grouped.countsByPointSign.positive,
                  testId: 'filter-point-positive',
                  dotClass: 'bg-emerald-500',
                },
                {
                  key: 'negative',
                  label: 'Điểm -',
                  count: grouped.countsByPointSign.negative,
                  testId: 'filter-point-negative',
                  dotClass: 'bg-rose-500',
                },
                {
                  key: 'zero',
                  label: 'Điểm = 0',
                  count: grouped.countsByPointSign.zero,
                  testId: 'filter-point-zero',
                  dotClass: 'bg-sky-500',
                },
                {
                  key: 'unspecified',
                  label: 'Chưa gán điểm',
                  count: grouped.countsByPointSign.unspecified,
                  testId: 'filter-point-unspecified',
                  dotClass: 'bg-amber-500',
                },
              ] as const
            ).map((opt) => {
              const isActive = pointFilter === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  data-testid={opt.testId}
                  onClick={() => setPointFilter(opt.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap ${
                    isActive
                      ? 'glass-pill-tab-active text-slate-900 dark:text-white'
                      : 'glass-pill-tab text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${opt.dotClass}`} />
                  <span>{opt.label}</span>
                  <span className="font-mono-tabular text-[11px] opacity-80">({opt.count})</span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              data-testid="rules-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm danh mục, hình thức kỉ luật, ghi chú..."
              className="w-full glass-subsurface border border-slate-200/80 dark:border-white/15 rounded-xl pl-8 pr-8 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Xóa từ khóa tìm kiếm"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <BulkSelectionBar
        totalVisibleCount={grouped.filtered.length}
        selectedCount={effectiveSelectedCriterionIds.length}
        allVisibleSelected={areAllVisibleSelected(effectiveSelectedCriterionIds, visibleCriterionIds)}
        canDelete={canManage}
        entityLabel="mục nội quy"
        showSelectAll={grouped.filtered.length > 0}
        isDeleting={isBulkDeleting}
        testIdPrefix="rules-bulk"
        onToggleSelectAll={() =>
          setSelectedCriterionIds((prev) => toggleSelectAllVisible(prev, visibleCriterionIds))
        }
        onClearSelection={() => setSelectedCriterionIds([])}
        onRequestBulkDelete={() => setPendingBulkDeleteIds(effectiveSelectedCriterionIds)}
      />

      {grouped.sections.length === 0 ? (
        <EmptyState
          icon={Archive}
          title={
            hasActiveFilters
              ? 'Không tìm thấy mục nội quy phù hợp'
              : 'Chưa có nội quy thi đua nào'
          }
          description={
            hasActiveFilters
              ? 'Thử đổi nhóm nội quy, bộ lọc Điểm (+/-) hoặc xóa từ khóa tìm kiếm.'
              : 'Tải bản mẫu Excel gồm 8 sheet nhóm, điền các cột STT | Danh mục | Điểm (+/-) | Hình thức kỉ luật | Ghi chú rồi bấm "Nhập file Excel".'
          }
          action={
            hasActiveFilters ? (
              <button
                type="button"
                onClick={() => {
                  setGroupFilter('all');
                  setPointFilter('all');
                  setSearchQuery('');
                }}
                className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer transition-colors"
              >
                Xóa bộ lọc
              </button>
            ) : canManage ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleDownloadTemplate()}
                  className="px-3.5 py-2 rounded-xl glass-subsurface text-slate-700 dark:text-slate-100 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-sky-600" /> Tải bản mẫu Excel
                </button>
                <button
                  type="button"
                  onClick={() => setIsImportOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" /> Nhập file Excel
                </button>
              </div>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {grouped.sections.map((section) => {
            const posCount = section.items.filter(
              (c) => classifyCriterionPointSign(c) === 'positive'
            ).length;
            const negCount = section.items.filter(
              (c) => classifyCriterionPointSign(c) === 'negative'
            ).length;
            const zeroCount = section.items.filter(
              (c) => classifyCriterionPointSign(c) === 'zero'
            ).length;

            return (
              <section
                key={section.groupKey}
                className="glass-table-shell overflow-hidden"
                data-testid={`rules-group-section-${section.order}`}
              >
                <div className="px-4 py-3 border-b border-white/30 dark:border-white/10 bg-white/45 dark:bg-slate-900/45 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                      {section.groupName}
                    </h4>
                    <Badge variant="blue" size="sm">
                      {section.items.length} mục
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold font-mono-tabular">
                    {posCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                        +{posCount} cộng
                      </span>
                    )}
                    {negCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300">
                        -{negCount} trừ
                      </span>
                    )}
                    {zeroCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-300">
                        {zeroCount} mục = 0
                      </span>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="glass-table-head">
                      <tr>
                        {canManage && <th className="pl-4 pr-2 py-2.5 w-8" />}
                        <th className="px-3 py-2.5 w-14">STT</th>
                        <th className="px-4 py-2.5 min-w-[220px]">Danh mục</th>
                        <th className="px-4 py-2.5 w-28 text-center">Điểm (+/-)</th>
                        <th className="px-4 py-2.5 min-w-[170px]">Hình thức kỉ luật</th>
                        <th className="px-4 py-2.5 min-w-[160px]">Ghi chú</th>
                        {canManage && <th className="px-4 py-2.5 w-16 text-right">Xóa</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/25 dark:divide-white/10">
                      {section.items.map((c, idx) => {
                        const isSelected = effectiveSelectedCriterionIds.includes(c.id);
                        const sign = classifyCriterionPointSign(c);
                        const displayStt = typeof c.stt === 'number' ? c.stt : idx + 1;
                        const discipline = c.disciplineForm || c.honorNote || '';
                        const note = c.condition || '';

                        return (
                          <tr
                            key={c.id}
                            className={`glass-table-row ${
                              isSelected ? 'bg-sky-500/12 dark:bg-sky-500/15' : ''
                            }`}
                          >
                            {canManage && (
                              <td className="pl-4 pr-2 py-2.5">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() =>
                                    setSelectedCriterionIds((prev) => toggleSelectedId(prev, c.id))
                                  }
                                  aria-label={`Chọn mục ${c.name}`}
                                  className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500 cursor-pointer"
                                />
                              </td>
                            )}
                            <td className="px-3 py-2.5 font-mono-tabular font-semibold text-slate-600 dark:text-slate-300">
                              {displayStt}
                            </td>
                            <td className="px-4 py-2.5">
                              <p className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                                {c.name}
                              </p>
                              {c.behavior && c.behavior !== c.name && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                                  {c.behavior}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center font-mono-tabular font-bold whitespace-nowrap">
                              {sign === 'positive' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                                  +{c.points}
                                </span>
                              )}
                              {sign === 'negative' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-700 dark:text-rose-300">
                                  {c.points}
                                </span>
                              )}
                              {sign === 'zero' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300">
                                  0
                                </span>
                              )}
                              {sign === 'unspecified' && (
                                <span className="text-slate-400 dark:text-slate-500 font-normal">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">
                              {discipline || (
                                <span className="text-slate-400 dark:text-slate-500">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                              {note || (
                                <span className="text-slate-400 dark:text-slate-500">—</span>
                              )}
                            </td>
                            {canManage && (
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => void handleTryDeleteCriterion(c)}
                                  title="Xóa mục nội quy"
                                  aria-label={`Xóa mục ${c.name}`}
                                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/15 cursor-pointer transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {canManage && (
        <ExcelImportDialog
          isOpen={isImportOpen}
          moduleKey="rule_criteria"
          context={validationContext ?? {}}
          existingRecords={ruleCriteria as unknown as Record<string, unknown>[]}
          currentUser={currentUser}
          onClose={() => setIsImportOpen(false)}
          onCommitImport={onUnifiedImportCommit ?? (async () => {})}
        />
      )}

      <ConfirmDialog
        isOpen={pendingBulkDeleteIds !== null}
        title="Xác nhận xóa mục nội quy"
        message={`Bạn có chắc muốn xóa ${pendingBulkDeleteIds?.length ?? 0} mục nội quy đã chọn? Các mục đang có dữ liệu ghi nhận thi đua sẽ được giữ nguyên để bảo toàn lịch sử điểm.`}
        confirmLabel="Xóa đã chọn"
        danger={true}
        onCancel={() => setPendingBulkDeleteIds(null)}
        onConfirm={() => void handleConfirmBulkDeleteCriteria()}
      />
    </div>
  );
};
