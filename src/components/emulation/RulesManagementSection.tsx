import React, { useMemo, useState } from 'react';
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  FileDown,
  ShieldCheck,
  Archive,
  Power,
} from 'lucide-react';
import {
  AIExtractedRuleItem,
  ExportHistoryRecord,
  ImportHistoryRecord,
  ImportModuleKey,
  RuleCategory,
  RuleCriterion,
  RuleDocument,
  RuleTargetScope,
  RuleVersion,
  UserProfile,
} from '../../types';
import { LiquidCard } from '../common/LiquidCard';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { EmptyState } from '../shared/EmptyState';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { BulkSelectionBar } from '../shared/BulkSelectionBar';
import { ModuleDataActions } from '../importExport/ModuleDataActions';
import type { ValidationDbContext } from '../../utils/importExport/validator';
import { resolveCatalogOptions } from '../../utils/catalogs/catalogRegistry';
import { canDeleteRuleCriterion, parseRuleClausesLocally } from '../../utils/emulationRules';
import {
  exportRulesToDocx,
  exportRulesToPdf,
  extractTextFromDocxFile,
} from '../../utils/documentExporter';
import type { EmulationRecord } from '../../types';
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
  schoolName,
  academicYear,
  validationContext,
  ruleDocuments,
  ruleVersions,
  ruleCategories,
  ruleCriteria,
  emulationRecords,
  canEdit,
  canApprove,
  canExport,
  onSaveDocument,
  onSaveVersion,
  onSaveCategory,
  onSaveCriterion,
  onDeleteCriterion,
  onDeleteCriteria,
  onUnifiedImportCommit,
  onLogExport,
}) => {
  // Upload & Parse modal
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [docTitle, setDocTitle] = useState('Nội quy Học sinh & Tiêu chí Thi đua');
  const [docEffectiveDate, setDocEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [fileName, setFileName] = useState('noi-quy-nha-truong.txt');
  const [fileType, setFileType] = useState<'docx' | 'pdf' | 'txt'>('txt');
  const [rawText, setRawText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseSummary, setParseSummary] = useState<string | null>(null);
  const [extractedItems, setExtractedItems] = useState<AIExtractedRuleItem[]>([]);

  // Category & Criterion manual modals
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catCode, setCatCode] = useState('');
  const [catDesc, setCatDesc] = useState('');

  const [isCritModalOpen, setIsCritModalOpen] = useState(false);
  const [editingCrit, setEditingCrit] = useState<RuleCriterion | null>(null);
  const [critForm, setCritForm] = useState<{
    code: string;
    categoryId: string;
    name: string;
    behavior: string;
    type: 'violation' | 'achievement';
    pointsSpecified: boolean;
    points: string;
    targetScope: RuleTargetScope;
  }>({
    code: '',
    categoryId: '',
    name: '',
    behavior: '',
    type: 'violation',
    pointsSpecified: true,
    points: '-2',
    targetScope: 'individual',
  });

  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft' | 'inactive'>('all');
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [selectedCriterionIds, setSelectedCriterionIds] = useState<string[]>([]);
  const [pendingBulkDeleteIds, setPendingBulkDeleteIds] = useState<string[] | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const activeApprovedVersion = useMemo(
    () => ruleVersions.find((v) => v.status === 'approved') || ruleVersions[0],
    [ruleVersions]
  );

  const recordTypeOptions = useMemo(
    () => resolveCatalogOptions({ catalogId: 'emulation_record_type', runtime: validationContext }),
    [validationContext]
  );

  const targetScopeOptions = useMemo(
    () => resolveCatalogOptions({ catalogId: 'rule_target_scope', runtime: validationContext }),
    [validationContext]
  );

  const visibleCriteria = useMemo(() => {
    return ruleCriteria.filter((c) => {
      // Non-editors only see active/public criteria
      if (!canEdit && !canApprove && c.status !== 'active') return false;
      if (catFilter !== 'all' && c.categoryId !== catFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      return true;
    });
  }, [ruleCriteria, canEdit, canApprove, catFilter, statusFilter]);

  const effectiveSelectedCriterionIds = useMemo(
    () => pruneStaleSelectedIds(selectedCriterionIds, ruleCriteria.map((c) => c.id)),
    [selectedCriterionIds, ruleCriteria]
  );
  const visibleCriterionIds = useMemo(
    () => visibleCriteria.map((c) => c.id),
    [visibleCriteria]
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.docx')) {
      setFileType('docx');
      try {
        const text = await extractTextFromDocxFile(file);
        setRawText(text);
      } catch {
        setFeedback({ ok: false, msg: 'Không đọc được tệp Word (.docx). Hãy kiểm tra lại định dạng.' });
      }
    } else if (lower.endsWith('.pdf')) {
      setFileType('pdf');
      setRawText('');
      setFeedback({ ok: false, msg: 'Vui lòng dùng tệp .docx/.txt hoặc dán trực tiếp nội dung điều khoản để trích xuất.' });
    } else {
      setFileType('txt');
      setRawText(await file.text());
    }
  };

  const handleRunParseRules = () => {
    if (!rawText.trim()) {
      setFeedback({ ok: false, msg: 'Vui lòng tải tệp .docx/.txt hoặc dán nội dung điều khoản nội quy.' });
      return;
    }
    setParsing(true);
    setParseSummary(null);
    try {
      const local = parseRuleClausesLocally(rawText);
      setExtractedItems(local);
      setParseSummary(`Đã phân tích và trích xuất ${local.length} điều khoản nháp.`);
    } finally {
      setParsing(false);
    }
  };

  const handleSaveExtractedAsDraft = async () => {
    const selected = extractedItems.filter((i) => i.selected !== false);
    if (selected.length === 0) {
      setFeedback({ ok: false, msg: 'Vui lòng chọn ít nhất 1 tiêu chí để lưu bản nháp.' });
      return;
    }

    const now = new Date().toISOString();
    const nextVersionNum =
      ruleVersions.reduce((mx, v) => Math.max(mx, v.versionNumber), 0) + 1;
    const docId = `RDOC-${Date.now()}`;

    const docItem: RuleDocument = {
      id: docId,
      title: docTitle.trim() || 'Văn bản Nội quy',
      academicYear,
      effectiveDate: docEffectiveDate,
      fileName,
      fileType,
      extractedText: rawText,
      versionNumber: nextVersionNum,
      status: 'draft',
      uploadedBy: currentUser.displayName,
      uploadedAt: now,
    };

    const verItem: RuleVersion = {
      id: `RVER-${Date.now()}`,
      documentId: docId,
      versionNumber: nextVersionNum,
      title: docItem.title,
      academicYear,
      effectiveDate: docEffectiveDate,
      status: 'draft',
      criteriaCount: selected.length,
      createdBy: currentUser.displayName,
      createdAt: now,
    };

    await onSaveDocument(docItem);
    await onSaveVersion(verItem);

    // Ensure categories exist and create draft criteria
    const catCache = new Map<string, RuleCategory>(
      ruleCategories.map((c) => [c.name.toLowerCase(), c])
    );

    let seq = ruleCriteria.length + 1;
    for (const item of selected) {
      const grpName = item.group.trim() || 'Quy định chung';
      let cat = catCache.get(grpName.toLowerCase());
      if (!cat) {
        cat = {
          id: `RCAT-${Date.now()}-${catCache.size + 1}`,
          code: `NHOM-${String(catCache.size + 1).padStart(2, '0')}`,
          name: grpName,
          order: catCache.size + 1,
          status: 'active',
        };
        catCache.set(grpName.toLowerCase(), cat);
        await onSaveCategory(cat);
      }

      const crit: RuleCriterion = {
        id: `RCRT-${Date.now()}-${seq}`,
        code: `TC-${String(seq).padStart(3, '0')}`,
        categoryId: cat.id,
        categoryName: cat.name,
        name: item.name,
        description: item.description,
        behavior: item.behavior,
        type: item.type,
        points: item.pointsSpecified && item.points !== null ? item.points : null,
        pointsSpecified: Boolean(item.pointsSpecified && item.points !== null),
        targetScope: item.target,
        condition: item.condition,
        sourceClause: item.sourceClause,
        documentId: docId,
        versionNumber: nextVersionNum,
        status: 'draft',
        createdBy: currentUser.displayName,
        createdAt: now,
      };
      seq++;
      await onSaveCriterion(crit);
    }

    setIsUploadOpen(false);
    setExtractedItems([]);
    setParseSummary(null);
    setFeedback({
      ok: true,
      msg: `Đã lưu ${selected.length} tiêu chí nháp (v${nextVersionNum}). Ban Giám hiệu vui lòng rà soát điểm và bấm "Phê duyệt & Ban hành".`,
    });
  };

  const handleApproveDocument = async (docItem: RuleDocument) => {
    const now = new Date().toISOString();
    // Archive previously approved docs & versions
    for (const oldDoc of ruleDocuments.filter((d) => d.status === 'approved' && d.id !== docItem.id)) {
      await onSaveDocument({ ...oldDoc, status: 'archived' });
    }
    for (const oldVer of ruleVersions.filter((v) => v.status === 'approved' && v.documentId !== docItem.id)) {
      await onSaveVersion({ ...oldVer, status: 'archived' });
    }

    await onSaveDocument({
      ...docItem,
      status: 'approved',
      approvedBy: currentUser.displayName,
      approvedAt: now,
    });

    const ver = ruleVersions.find((v) => v.documentId === docItem.id);
    if (ver) {
      await onSaveVersion({
        ...ver,
        status: 'approved',
        approvedBy: currentUser.displayName,
        approvedAt: now,
      });
    }

    const docCriteria = ruleCriteria.filter((c) => c.documentId === docItem.id && c.status === 'draft');
    for (const c of docCriteria) {
      await onSaveCriterion({
        ...c,
        status: 'active',
        updatedAt: now,
        changeHistory: [
          ...(c.changeHistory || []),
          { changedAt: now, changedBy: currentUser.displayName, summary: 'Ban Giám hiệu phê duyệt ban hành' },
        ],
      });
    }

    setFeedback({
      ok: true,
      msg: `Đã phê duyệt văn bản "${docItem.title}" (v${docItem.versionNumber}) và kích hoạt ${docCriteria.length} tiêu chí.`,
    });
  };

  const handleSaveCategoryForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    const cat: RuleCategory = {
      id: `RCAT-${Date.now()}`,
      code: catCode.trim() || `NHOM-${String(ruleCategories.length + 1).padStart(2, '0')}`,
      name: catName.trim(),
      description: catDesc.trim() || undefined,
      order: ruleCategories.length + 1,
      status: 'active',
    };
    await onSaveCategory(cat);
    setCatName('');
    setCatCode('');
    setCatDesc('');
    setIsCatModalOpen(false);
  };

  const openCreateCriterion = () => {
    setEditingCrit(null);
    setCritForm({
      code: `TC-${String(ruleCriteria.length + 1).padStart(3, '0')}`,
      categoryId: ruleCategories[0]?.id || '',
      name: '',
      behavior: '',
      type: 'violation',
      pointsSpecified: true,
      points: '-2',
      targetScope: 'individual',
    });
    setIsCritModalOpen(true);
  };

  const openEditCriterion = (c: RuleCriterion) => {
    setEditingCrit(c);
    setCritForm({
      code: c.code,
      categoryId: c.categoryId,
      name: c.name,
      behavior: c.behavior,
      type: c.type,
      pointsSpecified: c.pointsSpecified,
      points: c.points !== null && c.points !== undefined ? String(c.points) : '',
      targetScope: c.targetScope,
    });
    setIsCritModalOpen(true);
  };

  const handleSaveCriterionForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const cat = ruleCategories.find((c) => c.id === critForm.categoryId);
    const parsedNum = critForm.pointsSpecified && critForm.points !== '' ? Number(critForm.points) : null;
    const finalPoints =
      parsedNum !== null && !Number.isNaN(parsedNum)
        ? critForm.type === 'violation'
          ? -Math.abs(parsedNum)
          : Math.abs(parsedNum)
        : null;

    const now = new Date().toISOString();
    const item: RuleCriterion = {
      id: editingCrit?.id || `RCRT-${Date.now()}`,
      code: critForm.code.trim() || `TC-${ruleCriteria.length + 1}`,
      categoryId: cat?.id || critForm.categoryId || 'GENERAL',
      categoryName: cat?.name || editingCrit?.categoryName || 'Quy định chung',
      name: critForm.name.trim(),
      description: critForm.behavior.trim() || critForm.name.trim(),
      behavior: critForm.behavior.trim() || critForm.name.trim(),
      type: critForm.type,
      points: finalPoints,
      pointsSpecified: finalPoints !== null,
      targetScope: critForm.targetScope,
      status: editingCrit?.status || (canApprove ? 'active' : 'draft'),
      createdBy: editingCrit?.createdBy || currentUser.displayName,
      createdAt: editingCrit?.createdAt || now,
      updatedAt: now,
      changeHistory: [
        ...(editingCrit?.changeHistory || []),
        {
          changedAt: now,
          changedBy: currentUser.displayName,
          summary: editingCrit ? 'Cập nhật tiêu chí & mức điểm' : 'Tạo mới tiêu chí',
        },
      ],
    };
    await onSaveCriterion(item);
    setIsCritModalOpen(false);
    setFeedback({ ok: true, msg: `Đã lưu tiêu chí "${item.name}".` });
  };

  const handleToggleCriterionStatus = async (c: RuleCriterion) => {
    const nextStatus: RuleCriterion['status'] =
      c.status === 'active' ? 'inactive' : 'active';
    await onSaveCriterion({
      ...c,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleTryDeleteCriterion = async (c: RuleCriterion) => {
    const check = canDeleteRuleCriterion(c.id, emulationRecords);
    if (!check.allowed) {
      setFeedback({ ok: false, msg: check.reason || 'Tiêu chí đang được tham chiếu.' });
      return;
    }
    await onDeleteCriterion(c.id);
    setSelectedCriterionIds((prev) => prev.filter((id) => id !== c.id));
    setFeedback({ ok: true, msg: `Đã xóa tiêu chí "${c.name}".` });
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
          msg: `Không thể xóa ${blockedCount} tiêu chí đã chọn vì đang được tham chiếu trong sổ thi đua.`,
        });
      } else if (blockedCount > 0) {
        setFeedback({
          ok: true,
          msg: `Đã xóa ${deletableIds.length} tiêu chí. Bỏ qua ${blockedCount} tiêu chí đang có dữ liệu ghi nhận thi đua.`,
        });
      } else {
        setFeedback({
          ok: true,
          msg: `Đã xóa ${deletableIds.length} tiêu chí nội quy.`,
        });
      }
    } finally {
      setIsBulkDeleting(false);
      setPendingBulkDeleteIds(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Exports */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canExport && ruleCriteria.length > 0 && (
          <>
            <button
              type="button"
              data-testid="btn-export-rules-docx"
              onClick={() =>
                void exportRulesToDocx({
                  schoolName,
                  documentTitle: activeApprovedVersion?.title || 'QUY ĐỊNH NỘI QUY & TIÊU CHÍ THI ĐUA',
                  version: activeApprovedVersion,
                  criteria: ruleCriteria,
                })
              }
              className="px-3 py-1.5 rounded-xl glass-subsurface hover:bg-white/80 dark:hover:bg-white/10 text-slate-700 dark:text-slate-100 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
            >
              <FileDown className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" /> Xuất Word
            </button>
            <button
              type="button"
              data-testid="btn-export-rules-pdf"
              onClick={() =>
                void exportRulesToPdf({
                  schoolName,
                  documentTitle: activeApprovedVersion?.title || 'QUY ĐỊNH NỘI QUY & TIÊU CHÍ THI ĐUA',
                  version: activeApprovedVersion,
                  criteria: ruleCriteria,
                })
              }
              className="px-3 py-1.5 rounded-xl glass-subsurface hover:bg-white/80 dark:hover:bg-white/10 text-slate-700 dark:text-slate-100 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
            >
              <FileDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /> Xuất PDF
            </button>
          </>
        )}
        {canEdit && (
          <>
            <button
              type="button"
              onClick={() => setIsCatModalOpen(true)}
              className="px-3 py-1.5 rounded-xl glass-subsurface hover:bg-white/80 dark:hover:bg-white/10 text-slate-700 dark:text-slate-100 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm Nhóm
            </button>
            <button
              type="button"
              onClick={openCreateCriterion}
              className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm Tiêu chí
            </button>
            <button
              type="button"
              data-testid="btn-import-rules-unified"
              onClick={() => setIsUploadOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap transition-colors"
            >
              <Upload className="w-3.5 h-3.5" /> Nhập Nội quy
            </button>
          </>
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

      {/* Document & Version List */}
      {ruleDocuments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {ruleDocuments.map((doc) => (
            <LiquidCard key={doc.id} className="p-4 space-y-2 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{doc.title}</p>
                  <p className="text-[11px] text-slate-500 font-mono-tabular">
                    v{doc.versionNumber} · {doc.fileName} · Hiệu lực {doc.effectiveDate}
                  </p>
                </div>
                <Badge
                  variant={doc.status === 'approved' ? 'mint' : doc.status === 'archived' ? 'gray' : 'amber'}
                  size="sm"
                >
                  {doc.status === 'approved' ? 'Đã ban hành' : doc.status === 'archived' ? 'Lưu trữ' : 'Bản nháp'}
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500">
                Người tải: {doc.uploadedBy}
                {doc.approvedBy ? ` · Duyệt: ${doc.approvedBy}` : ''}
              </p>
              {canApprove && doc.status === 'draft' && (
                <button
                  type="button"
                  onClick={() => handleApproveDocument(doc)}
                  className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Phê duyệt & Ban hành v{doc.versionNumber}
                </button>
              )}
            </LiquidCard>
          ))}
        </div>
      )}

      {/* Structured Criteria Table */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="glass-subsurface rounded-xl px-3 py-1.5 font-semibold text-slate-800 dark:text-slate-100"
          >
            <option value="all">Tất cả nhóm ({ruleCategories.length})</option>
            {ruleCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {(canEdit || canApprove) && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="glass-subsurface rounded-xl px-3 py-1.5 font-semibold text-slate-800 dark:text-slate-100"
            >
              <option value="all">Mọi trạng thái</option>
              <option value="active">Đang áp dụng</option>
              <option value="draft">Bản nháp chờ duyệt</option>
              <option value="inactive">Ngừng áp dụng</option>
            </select>
          )}
        </div>

        {(canEdit || canExport) && (
          <ModuleDataActions
            moduleKey="rule_criteria"
            context={validationContext ?? {}}
            currentUser={currentUser}
            allRecords={ruleCriteria as unknown as Record<string, unknown>[]}
            filteredRecords={visibleCriteria as unknown as Record<string, unknown>[]}
            canCreate={false}
            canImport={canEdit}
            canExport={canExport}
            onCommitImport={onUnifiedImportCommit ?? (async () => {})}
            onLogExport={onLogExport}
          />
        )}
      </div>

      <BulkSelectionBar
        totalVisibleCount={visibleCriteria.length}
        selectedCount={effectiveSelectedCriterionIds.length}
        allVisibleSelected={areAllVisibleSelected(effectiveSelectedCriterionIds, visibleCriterionIds)}
        canDelete={canEdit || canApprove}
        entityLabel="tiêu chí"
        showSelectAll={false}
        isDeleting={isBulkDeleting}
        testIdPrefix="rules-bulk"
        onToggleSelectAll={() =>
          setSelectedCriterionIds((prev) => toggleSelectAllVisible(prev, visibleCriterionIds))
        }
        onClearSelection={() => setSelectedCriterionIds([])}
        onRequestBulkDelete={() => setPendingBulkDeleteIds(effectiveSelectedCriterionIds)}
      />

      {visibleCriteria.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="Chưa có tiêu chí nội quy nào"
          description="Tải lên văn bản nội quy (.docx/.txt) để bóc tách tiêu chí nháp hoặc bấm 'Thêm Tiêu chí' trực tiếp."
        />
      ) : (
        <div className="glass-table-shell">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="glass-table-head">
                <tr>
                  {(canEdit || canApprove) && (
                    <th className="pl-4 pr-2 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={areAllVisibleSelected(effectiveSelectedCriterionIds, visibleCriterionIds)}
                        onChange={() =>
                          setSelectedCriterionIds((prev) => toggleSelectAllVisible(prev, visibleCriterionIds))
                        }
                        aria-label="Chọn tất cả tiêu chí đang hiển thị"
                        className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500 cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3">Mã / Nhóm</th>
                  <th className="px-4 py-3">Tên tiêu chí & Hành vi</th>
                  <th className="px-4 py-3">Loại</th>
                  <th className="px-4 py-3">Điểm</th>
                  <th className="px-4 py-3">Phạm vi</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  {(canEdit || canApprove) && <th className="px-4 py-3 text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/25 dark:divide-white/10">
                {visibleCriteria.map((c) => {
                  const isSelected = effectiveSelectedCriterionIds.includes(c.id);
                  return (
                  <tr
                    key={c.id}
                    className={`glass-table-row ${c.status === 'inactive' ? 'opacity-60' : ''} ${
                      isSelected ? 'bg-sky-500/12 dark:bg-sky-500/15' : ''
                    }`}
                  >
                    {(canEdit || canApprove) && (
                      <td className="pl-4 pr-2 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() =>
                            setSelectedCriterionIds((prev) => toggleSelectedId(prev, c.id))
                          }
                          aria-label={`Chọn tiêu chí ${c.name}`}
                          className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span className="font-mono-tabular font-bold text-sky-700 dark:text-sky-300">{c.code}</span>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">{c.categoryName}</p>
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      <p className="font-bold text-slate-900 dark:text-slate-100">{c.name}</p>
                      {c.behavior && c.behavior !== c.name && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">{c.behavior}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={c.type === 'achievement' ? 'mint' : 'pink'} size="sm">
                        {c.type === 'achievement' ? 'Thành tích' : 'Vi phạm'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono-tabular font-bold">
                      {c.pointsSpecified && c.points !== null ? (
                        <span className={c.points >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                          {c.points > 0 ? `+${c.points}` : c.points}
                        </span>
                      ) : (
                        <Badge variant="amber" size="sm">Chưa gán điểm</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-700 dark:text-slate-300">
                      {c.targetScope === 'class' ? 'Tập thể lớp' : c.targetScope === 'group' ? 'Tổ / Nhóm' : 'Cá nhân'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={c.status === 'active' ? 'mint' : c.status === 'draft' ? 'amber' : 'gray'}
                        size="sm"
                      >
                        {c.status === 'active' ? 'Áp dụng' : c.status === 'draft' ? 'Nháp' : 'Ngừng'}
                      </Badge>
                    </td>
                    {(canEdit || canApprove) && (
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditCriterion(c)}
                            className="px-2 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 font-semibold cursor-pointer transition-colors"
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleCriterionStatus(c)}
                            title={c.status === 'active' ? 'Ngừng áp dụng' : 'Kích hoạt'}
                            className="p-1.5 rounded-lg glass-subsurface text-slate-600 dark:text-slate-300 cursor-pointer"
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTryDeleteCriterion(c)}
                            title="Xóa tiêu chí"
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/15 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: Rules Document Import */}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Nhập Văn bản Nội quy & Quy chế Thi đua"
        description="Tải tệp Word (.docx) / văn bản (.txt) từ máy tính hoặc dán trực tiếp điều khoản để tạo bộ tiêu chí nháp."
        maxWidth="3xl"
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Tên văn bản *</label>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="w-full glass-subsurface rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Ngày hiệu lực</label>
              <input
                type="date"
                value={docEffectiveDate}
                onChange={(e) => setDocEffectiveDate(e.target.value)}
                className="w-full glass-subsurface rounded-xl px-3 py-2 font-mono-tabular"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <label className="block font-semibold mb-1">Chọn tệp (.docx, .txt)</label>
              <input
                type="file"
                accept=".docx,.txt"
                onChange={handleFileChange}
                className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-sky-500/15 file:text-sky-700 dark:file:text-sky-300 file:font-semibold"
              />
            </div>
            <button
              type="button"
              disabled={parsing}
              onClick={handleRunParseRules}
              className="py-2 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 text-white font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              {parsing ? 'Đang phân tích văn bản...' : 'Phân tích & Trích xuất Điều khoản'}
            </button>
          </div>

          <div>
            <label className="block font-semibold mb-1">Nội dung văn bản (hoặc dán trực tiếp điều khoản)</label>
            <textarea
              rows={4}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Ví dụ:&#10;I. Nề nếp chuyên cần&#10;1. Đi học muộn không phép trừ 2 điểm&#10;2. Mặc sai đồng phục quy định"
              className="w-full glass-subsurface rounded-xl px-3 py-2 font-mono-tabular"
            />
          </div>

          {parseSummary && (
            <div className="p-3 rounded-xl bg-sky-500/12 border border-sky-400/35 text-sky-800 dark:text-sky-200">
              {parseSummary}
            </div>
          )}

          {extractedItems.length > 0 && (
            <div className="space-y-2">
              <p className="font-bold text-slate-800 dark:text-slate-100">
                Bảng rà soát tiêu chí trích xuất ({extractedItems.length}) — Các dòng "Chưa gán điểm" cần kiểm tra trước khi duyệt:
              </p>
              <div className="max-h-64 overflow-y-auto glass-table-shell">
                <table className="w-full text-left text-[11px]">
                  <thead className="glass-table-head sticky top-0 z-10">
                    <tr>
                      <th className="p-2">Chọn</th>
                      <th className="p-2">Nhóm</th>
                      <th className="p-2">Tên tiêu chí</th>
                      <th className="p-2">Loại</th>
                      <th className="p-2">Điểm</th>
                      <th className="p-2">Phạm vi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/25 dark:divide-white/10">
                    {extractedItems.map((item, idx) => (
                      <tr
                        key={item.tempId}
                        className={`glass-table-row ${!item.pointsSpecified ? 'bg-amber-500/10' : ''}`}
                      >
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={item.selected !== false}
                            onChange={(e) =>
                              setExtractedItems((prev) =>
                                prev.map((x, i) => (i === idx ? { ...x, selected: e.target.checked } : x))
                              )
                            }
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.group}
                            onChange={(e) =>
                              setExtractedItems((prev) =>
                                prev.map((x, i) => (i === idx ? { ...x, group: e.target.value } : x))
                              )
                            }
                            className="w-28 glass-subsurface rounded-lg px-2 py-1"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) =>
                              setExtractedItems((prev) =>
                                prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x))
                              )
                            }
                            className="w-full min-w-[180px] glass-subsurface rounded-lg px-2 py-1"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={item.type}
                            onChange={(e) =>
                              setExtractedItems((prev) =>
                                prev.map((x, i) =>
                                  i === idx ? { ...x, type: e.target.value as 'violation' | 'achievement' } : x
                                )
                              )
                            }
                            className="glass-subsurface rounded-lg px-2 py-1"
                          >
                            {recordTypeOptions.map((opt) => (
                              <option key={opt.id} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            placeholder="Chưa gán"
                            value={item.points === null ? '' : item.points}
                            onChange={(e) => {
                              const v = e.target.value;
                              setExtractedItems((prev) =>
                                prev.map((x, i) =>
                                  i === idx
                                    ? {
                                        ...x,
                                        points: v === '' ? null : Number(v),
                                        pointsSpecified: v !== '',
                                      }
                                    : x
                                )
                              );
                            }}
                            className={`w-20 glass-subsurface rounded-lg px-2 py-1 font-mono-tabular ${
                              !item.pointsSpecified
                                ? 'border-amber-400 text-amber-700 dark:text-amber-300'
                                : ''
                            }`}
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={item.target}
                            onChange={(e) =>
                              setExtractedItems((prev) =>
                                prev.map((x, i) =>
                                  i === idx ? { ...x, target: e.target.value as RuleTargetScope } : x
                                )
                              )
                            }
                            className="glass-subsurface rounded-lg px-2 py-1"
                          >
                            {targetScopeOptions.map((opt) => (
                              <option key={opt.id} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="px-4 py-2 rounded-xl glass-subsurface font-semibold cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleSaveExtractedAsDraft}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                >
                  Lưu thành Bản nháp chờ BGH duyệt
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal 2: Add Category */}
      <Modal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        title="Thêm Nhóm Nội quy"
        maxWidth="md"
      >
        <form onSubmit={handleSaveCategoryForm} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Mã nhóm</label>
            <input
              type="text"
              value={catCode}
              onChange={(e) => setCatCode(e.target.value)}
              placeholder="VD: NE_NEP"
              className="w-full glass-subsurface rounded-xl px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Tên nhóm nội quy *</label>
            <input
              required
              type="text"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="VD: Chuyên cần & Nề nếp"
              className="w-full glass-subsurface rounded-xl px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Mô tả</label>
            <textarea
              rows={2}
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
              className="w-full glass-subsurface rounded-xl px-3 py-2"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsCatModalOpen(false)} className="px-4 py-2 rounded-xl glass-subsurface cursor-pointer">
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer">
              Lưu nhóm
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 3: Add / Edit Criterion */}
      <Modal
        isOpen={isCritModalOpen}
        onClose={() => setIsCritModalOpen(false)}
        title={editingCrit ? `Chỉnh sửa tiêu chí ${editingCrit.code}` : 'Thêm Tiêu chí Thi đua / Nội quy'}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveCriterionForm} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Mã tiêu chí *</label>
              <input
                required
                type="text"
                value={critForm.code}
                onChange={(e) => setCritForm((p) => ({ ...p, code: e.target.value }))}
                className="w-full glass-subsurface rounded-xl px-3 py-2 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Nhóm nội quy</label>
              <select
                value={critForm.categoryId}
                onChange={(e) => setCritForm((p) => ({ ...p, categoryId: e.target.value }))}
                className="w-full glass-subsurface rounded-xl px-3 py-2"
              >
                <option value="">Quy định chung</option>
                {ruleCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Tên tiêu chí *</label>
            <input
              required
              type="text"
              value={critForm.name}
              onChange={(e) => setCritForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full glass-subsurface rounded-xl px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Mô tả hành vi cụ thể</label>
            <textarea
              rows={2}
              value={critForm.behavior}
              onChange={(e) => setCritForm((p) => ({ ...p, behavior: e.target.value }))}
              className="w-full glass-subsurface rounded-xl px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold mb-1">Loại</label>
              <select
                value={critForm.type}
                onChange={(e) =>
                  setCritForm((p) => ({ ...p, type: e.target.value as 'violation' | 'achievement' }))
                }
                className="w-full glass-subsurface rounded-xl px-3 py-2"
              >
                {recordTypeOptions.map((opt) => (
                  <option key={opt.id} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Phạm vi</label>
              <select
                value={critForm.targetScope}
                onChange={(e) =>
                  setCritForm((p) => ({ ...p, targetScope: e.target.value as RuleTargetScope }))
                }
                className="w-full glass-subsurface rounded-xl px-3 py-2"
              >
                {targetScopeOptions.map((opt) => (
                  <option key={opt.id} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Mức điểm</label>
              <input
                type="number"
                step="0.5"
                disabled={!critForm.pointsSpecified}
                value={critForm.points}
                onChange={(e) => setCritForm((p) => ({ ...p, points: e.target.value }))}
                className="w-full glass-subsurface rounded-xl px-3 py-2 font-mono-tabular disabled:opacity-40"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={critForm.pointsSpecified}
              onChange={(e) => setCritForm((p) => ({ ...p, pointsSpecified: e.target.checked }))}
            />
            <span>Đã quy định điểm cụ thể (bỏ chọn nếu chưa gán điểm)</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsCritModalOpen(false)} className="px-4 py-2 rounded-xl glass-subsurface cursor-pointer">
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer">
              Lưu tiêu chí
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(pendingBulkDeleteIds && pendingBulkDeleteIds.length > 0)}
        title="Xác nhận xóa hàng loạt tiêu chí"
        message={`Bạn có chắc muốn xóa ${pendingBulkDeleteIds?.length || 0} tiêu chí nội quy đã chọn? Các tiêu chí đang được tham chiếu trong sổ thi đua sẽ tự động được giữ lại.`}
        confirmLabel={`Xóa ${pendingBulkDeleteIds?.length || 0} tiêu chí`}
        onConfirm={() => {
          void handleConfirmBulkDeleteCriteria();
        }}
        onCancel={() => setPendingBulkDeleteIds(null)}
      />
    </div>
  );
};
