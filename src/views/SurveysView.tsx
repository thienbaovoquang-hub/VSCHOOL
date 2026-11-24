import React, { useMemo, useState } from 'react';
import {
  ClipboardList, Plus, BarChart2, CheckCircle2, Clock,
  Lock, ArrowRight, Send, User, Trash2, Power
} from 'lucide-react';
import {
  ExportHistoryRecord,
  ImportHistoryRecord,
  ImportModuleKey,
  PermissionMatrix,
  Survey,
  SurveyQuestion,
  SurveyResponse,
  UserProfile,
} from '../types';
import { LiquidCard } from '../components/common/LiquidCard';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { ModuleDataActions } from '../components/importExport/ModuleDataActions';
import type { ValidationDbContext } from '../utils/importExport/validator';
import { resolveCatalogOptions } from '../utils/catalogs/catalogRegistry';
import { DEFAULT_PERMISSIONS, hasPermission } from '../utils/rbac';
import confetti from 'canvas-confetti';

interface SurveysViewProps {
  surveys: Survey[];
  surveyResponses?: SurveyResponse[];
  currentUser: UserProfile;
  customPermissions?: PermissionMatrix;
  validationContext?: ValidationDbContext;
  onSubmitSurveyResponse: (response: SurveyResponse) => Promise<void>;
  onCreateSurvey: (survey: Survey) => Promise<void>;
  onUnifiedImportCommit?: (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => Promise<void> | void;
  onLogExport?: (record: ExportHistoryRecord) => Promise<void> | void;
}

export const SurveysView: React.FC<SurveysViewProps> = ({
  surveys,
  surveyResponses = [],
  currentUser,
  customPermissions = DEFAULT_PERMISSIONS,
  validationContext,
  onSubmitSurveyResponse,
  onCreateSurvey,
  onUnifiedImportCommit,
  onLogExport,
}) => {
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [analyticsSurvey, setAnalyticsSurvey] = useState<Survey | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newAudience, setNewAudience] = useState<'Toàn trường' | 'Theo khối' | 'Theo lớp'>('Toàn trường');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([
    { id: 'q1', text: 'Bạn đánh giá thế nào về chất lượng cơ sở vật chất?', type: 'rating', required: true },
    { id: 'q2', text: 'Ý kiến đóng góp cụ thể của bạn:', type: 'text', required: false },
  ]);

  const audienceOptions = useMemo(
    () => resolveCatalogOptions({ catalogId: 'survey_audience', runtime: validationContext }),
    [validationContext]
  );

  const canCreate = hasPermission(currentUser.role, 'surveys', 'create', customPermissions);
  const canManage =
    hasPermission(currentUser.role, 'surveys', 'edit', customPermissions) ||
    currentUser.role === 'admin' ||
    currentUser.role === 'principal';

  const hasAlreadySubmitted = (survey: Survey) =>
    !survey.allowMultipleSubmissions && Boolean(survey.submittedByIds?.includes(currentUser.id));

  const handleTakeSurvey = (survey: Survey) => {
    setSelectedSurvey(survey);
    setAnswers({});
    setSubmittedSuccess(false);
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSurvey || hasAlreadySubmitted(selectedSurvey)) return;

    setIsSubmitting(true);
    try {
      const response: SurveyResponse = {
        id: `RESP-${Date.now()}`,
        surveyId: selectedSurvey.id,
        studentId: selectedSurvey.isAnonymous ? 'ANONYMOUS' : currentUser.id,
        isAnonymous: selectedSurvey.isAnonymous,
        answers,
        submittedAt: new Date().toISOString(),
      };

      await onSubmitSurveyResponse(response);
      setSubmittedSuccess(true);
      confetti({ particleCount: 50, spread: 50 });
      setTimeout(() => {
        setSelectedSurvey(null);
      }, 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: `q-${Date.now()}`,
        text: '',
        type: 'single',
        options: ['Rất hài lòng', 'Hài lòng', 'Bình thường'],
        required: true,
      },
    ]);
  };

  const handleUpdateQuestion = (idx: number, patch: Partial<SurveyQuestion>) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };

  const handleRemoveQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedQuestions = questions.filter((q) => q.text.trim());
    if (!newTitle.trim() || cleanedQuestions.length === 0) return;

    const newSurvey: Survey = {
      id: `SRV-${new Date().getFullYear()}-${String(surveys.length + 1).padStart(2, '0')}-${Date.now().toString().slice(-3)}`,
      title: newTitle.trim(),
      description: newDesc.trim(),
      targetAudience: newAudience,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isAnonymous,
      allowMultipleSubmissions: allowMultiple,
      submittedByIds: [],
      status: 'active',
      questions: cleanedQuestions,
      responsesCount: 0,
      createdBy: currentUser.displayName,
    };

    await onCreateSurvey(newSurvey);
    setIsCreateModalOpen(false);
    setNewTitle('');
    setNewDesc('');
  };

  const handleToggleStatus = async (survey: Survey) => {
    const nextStatus: Survey['status'] = survey.status === 'active' ? 'closed' : 'active';
    await onCreateSurvey({ ...survey, status: nextStatus });
  };

  const analyticsResponses = analyticsSurvey
    ? surveyResponses.filter((r) => r.surveyId === analyticsSurvey.id)
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {validationContext && onUnifiedImportCommit && (
          <ModuleDataActions
            moduleKey="survey_questions"
            context={validationContext}
            currentUser={currentUser}
            allRecords={surveys.map((s) => ({
              ...s,
              questionText: s.questions?.[0]?.text || '',
              questionType: s.questions?.[0]?.type || 'rating',
              optionsText: (s.questions?.[0]?.options || []).join('; '),
            }))}
            canCreate={false}
            canImport={canCreate || canManage}
            canExport={canManage || surveys.length > 0}
            onCommitImport={(key, items, hist) => onUnifiedImportCommit(key, items, hist)}
            onLogExport={onLogExport}
          />
        )}
        {canCreate && (
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-600 hover:to-teal-600 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Tạo Khảo sát Mới
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {surveys.map((survey) => {
          const alreadyDone = hasAlreadySubmitted(survey);
          const isClosed = survey.status === 'closed';
          return (
            <LiquidCard key={survey.id} className="p-5 flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <Badge variant={survey.status === 'active' ? 'mint' : 'gray'} size="sm">
                    {survey.status === 'active' ? 'Đang diễn ra' : 'Đã đóng'}
                  </Badge>
                  {survey.isAnonymous ? (
                    <span className="text-[11px] text-teal-700 dark:text-teal-300 font-medium flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Ẩn danh bảo mật
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1">
                      <User className="w-3 h-3" /> Ghi nhận tài khoản
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                  {survey.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                  {survey.description || 'Không có mô tả chi tiết.'}
                </p>

                <div className="mt-3 pt-3 border-t border-white/35 dark:border-white/10 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>
                    Đối tượng: <strong className="text-slate-800 dark:text-slate-100">{survey.targetAudience}</strong>
                  </span>
                  <span className="tabular-nums">
                    Phản hồi: <strong className="text-sky-700 dark:text-sky-300">{survey.responsesCount}</strong> lượt
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/35 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 tabular-nums">
                  <Clock className="w-3.5 h-3.5" /> Hạn: {survey.endDate}
                </span>

                <div className="flex items-center gap-1.5">
                  {canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => setAnalyticsSurvey(survey)}
                        className="px-2.5 py-1.5 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <BarChart2 className="w-3.5 h-3.5 text-indigo-500" /> Kết quả
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(survey)}
                        className="p-1.5 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 hover:text-amber-600 cursor-pointer transition-colors"
                        title={isClosed ? 'Mở lại khảo sát' : 'Đóng khảo sát'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    disabled={isClosed || alreadyDone}
                    onClick={() => handleTakeSurvey(survey)}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white text-xs font-bold shadow-xs disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {alreadyDone ? 'Đã gửi phản hồi' : isClosed ? 'Đã kết thúc' : 'Tham gia'}
                    {!alreadyDone && !isClosed && <ArrowRight className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </LiquidCard>
          );
        })}
      </div>

      {surveys.length === 0 && (
        <div className="py-14 text-center flex flex-col items-center justify-center p-8 rounded-3xl liquid-glass-panel">
          <div className="w-14 h-14 rounded-2xl glass-subsurface bg-sky-500/12 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-3">
            <ClipboardList className="w-7 h-7 stroke-1" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Chưa có cuộc khảo sát nào</h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mt-1 mb-5">
            Tạo phiếu khảo sát trực tuyến để lắng nghe ý kiến học sinh về hoạt động giáo dục và dịch vụ trường học.
          </p>
          {canCreate && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white text-xs font-semibold shadow-sm flex items-center gap-2 hover:opacity-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Tạo khảo sát đầu tiên
            </button>
          )}
        </div>
      )}

      {/* Take Survey Modal */}
      {selectedSurvey && (
        <Modal
          isOpen={!!selectedSurvey}
          onClose={() => setSelectedSurvey(null)}
          title={selectedSurvey.title}
          description={selectedSurvey.description}
          maxWidth="2xl"
        >
          {submittedSuccess ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl glass-subsurface bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">Cảm ơn bạn đã hoàn thành khảo sát!</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mx-auto">
                Ý kiến đóng góp của bạn đã được ghi nhận vào hệ sinh thái SchoolHub.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmitResponse} className="space-y-4 text-xs">
              {selectedSurvey.questions.map((q, qIdx) => (
                <div key={q.id} className="p-4 rounded-2xl glass-subsurface space-y-2.5">
                  <p className="font-bold text-slate-800 dark:text-slate-100 flex items-start gap-2">
                    <span className="text-sky-600 dark:text-sky-400 font-mono-tabular">Câu {qIdx + 1}:</span>
                    <span>
                      {q.text} {q.required && <span className="text-rose-500">*</span>}
                    </span>
                  </p>

                  {q.type === 'rating' && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setAnswers({ ...answers, [q.id]: star })}
                          className={`w-9 h-9 rounded-xl font-bold text-xs flex items-center justify-center transition-all cursor-pointer font-mono-tabular ${
                            answers[q.id] === star
                              ? 'glass-pill-tab-active shadow-sm'
                              : 'glass-subsurface text-slate-700 dark:text-slate-200 hover:bg-white/75 dark:hover:bg-white/10'
                          }`}
                        >
                          {star}★
                        </button>
                      ))}
                    </div>
                  )}

                  {q.type === 'multiple' && q.options && (
                    <div className="space-y-1.5 pt-1">
                      {q.options.map((opt, optIdx) => (
                        <label
                          key={optIdx}
                          className="flex items-center gap-2.5 p-2.5 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-white/10 cursor-pointer text-xs text-slate-700 dark:text-slate-200 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={Array.isArray(answers[q.id]) && (answers[q.id] as string[]).includes(opt)}
                            onChange={(e) => {
                              const curr = Array.isArray(answers[q.id]) ? [...(answers[q.id] as string[])] : [];
                              if (e.target.checked) curr.push(opt);
                              else {
                                const idx = curr.indexOf(opt);
                                if (idx >= 0) curr.splice(idx, 1);
                              }
                              setAnswers({ ...answers, [q.id]: curr });
                            }}
                            className="rounded text-sky-600 focus:ring-sky-400"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {q.type === 'single' && q.options && (
                    <div className="space-y-1.5 pt-1">
                      {q.options.map((opt, optIdx) => (
                        <label
                          key={optIdx}
                          className="flex items-center gap-2.5 p-2.5 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-white/10 cursor-pointer text-xs text-slate-700 dark:text-slate-200 transition-colors"
                        >
                          <input
                            type="radio"
                            name={`q_${q.id}`}
                            value={opt}
                            checked={answers[q.id] === opt}
                            onChange={() => setAnswers({ ...answers, [q.id]: opt })}
                            className="text-sky-600 focus:ring-sky-400"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {q.type === 'text' && (
                    <textarea
                      rows={3}
                      required={q.required}
                      value={String(answers[q.id] || '')}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                      placeholder="Nhập ý kiến đóng góp của bạn..."
                      className="w-full glass-subsurface rounded-xl p-3 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
                    />
                  )}
                </div>
              ))}

              <div className="flex items-center justify-between pt-3 border-t border-white/40 dark:border-white/10">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedSurvey.isAnonymous ? 'Chế độ: Ẩn danh hoàn toàn' : 'Chế độ: Ghi nhận tài khoản'}
                </span>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-600 hover:to-teal-600 text-white font-bold text-xs shadow-sm disabled:opacity-40 flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? 'Đang gửi...' : 'Gửi phản hồi khảo sát'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* Analytics Results Modal */}
      {analyticsSurvey && (
        <Modal
          isOpen={!!analyticsSurvey}
          onClose={() => setAnalyticsSurvey(null)}
          title={`Kết quả Khảo sát: ${analyticsSurvey.title}`}
          description={`Tổng số phản hồi đã ghi nhận: ${analyticsResponses.length || analyticsSurvey.responsesCount}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            {analyticsResponses.length === 0 ? (
              <div className="py-10 text-center text-slate-500 dark:text-slate-400">
                Chưa có dữ liệu phản hồi chi tiết nào cho khảo sát này.
              </div>
            ) : (
              analyticsSurvey.questions.map((q, idx) => {
                const vals = analyticsResponses
                  .map((r) => r.answers[q.id])
                  .filter((v) => v !== undefined && v !== '');
                return (
                  <div key={q.id} className="p-4 rounded-2xl glass-subsurface space-y-2">
                    <p className="font-bold text-slate-800 dark:text-slate-100">
                      Câu {idx + 1}: {q.text}
                    </p>
                    {q.type === 'rating' && (
                      <p className="text-sky-700 dark:text-sky-300 font-bold tabular-nums">
                        Điểm trung bình:{' '}
                        {vals.length > 0
                          ? (vals.reduce<number>((s, v) => s + Number(v || 0), 0) / vals.length).toFixed(1)
                          : '0.0'}{' '}
                        / 5.0 ★ ({vals.length} lượt)
                      </p>
                    )}
                    {(q.type === 'single' || q.type === 'multiple') && (
                      <div className="space-y-1.5">
                        {(q.options || []).map((opt) => {
                          const count = vals.filter((v) =>
                            Array.isArray(v) ? v.includes(opt) : v === opt
                          ).length;
                          const pct = vals.length > 0 ? Math.round((count / vals.length) * 100) : 0;
                          return (
                            <div key={opt} className="space-y-1">
                              <div className="flex justify-between text-slate-700 dark:text-slate-200">
                                <span>{opt}</span>
                                <span className="font-mono-tabular font-bold">{count} ({pct}%)</span>
                              </div>
                              <div className="h-1.5 bg-white/45 dark:bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {q.type === 'text' && (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {vals.length === 0 ? (
                          <p className="text-slate-500 dark:text-slate-400">Chưa có ý kiến văn bản.</p>
                        ) : (
                          vals.map((v, i) => (
                            <p key={i} className="p-2.5 rounded-xl glass-subsurface text-slate-700 dark:text-slate-200">
                              “{String(v)}”
                            </p>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Modal>
      )}

      {/* Create Survey Modal with Dynamic Question Builder */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Thiết kế Khảo sát Mới"
          description="Tùy chỉnh câu hỏi đánh giá, trắc nghiệm và tự luận"
          maxWidth="2xl"
        >
          <form onSubmit={handleSaveSurvey} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Tiêu đề khảo sát *</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ví dụ: Khảo sát chất lượng dịch vụ thư viện"
                className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Mục đích & Mô tả</label>
              <textarea
                rows={2}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Mô tả tóm tắt nội dung khảo sát..."
                className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Đối tượng tham gia</label>
                <select
                  value={newAudience}
                  onChange={(e) => setNewAudience(e.target.value as 'Toàn trường' | 'Theo khối' | 'Theo lớp')}
                  className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-700 dark:text-slate-100 outline-none"
                >
                  {audienceOptions.map((opt) => (
                    <option key={opt.id} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col justify-center gap-1.5 pt-2">
                <label className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-400"
                  />
                  <span>Ẩn danh người trả lời</span>
                </label>
                <label className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowMultiple}
                    onChange={(e) => setAllowMultiple(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-400"
                  />
                  <span>Cho phép gửi nhiều lần</span>
                </label>
              </div>
            </div>

            {/* Question Builder */}
            <div className="space-y-2.5 pt-2 border-t border-white/40 dark:border-white/10">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  Danh sách Câu hỏi ({questions.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="px-2.5 py-1 rounded-lg glass-subsurface bg-sky-500/12 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm câu hỏi
                </button>
              </div>

              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {questions.map((q, idx) => (
                  <div key={q.id} className="p-3 rounded-xl glass-subsurface space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-tabular font-bold text-sky-600 dark:text-sky-400">#{idx + 1}</span>
                      <input
                        type="text"
                        required
                        value={q.text}
                        onChange={(e) => handleUpdateQuestion(idx, { text: e.target.value })}
                        placeholder="Nội dung câu hỏi..."
                        className="flex-1 glass-subsurface rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-100 outline-none"
                      />
                      <select
                        value={q.type}
                        onChange={(e) =>
                          handleUpdateQuestion(idx, {
                            type: e.target.value as SurveyQuestion['type'],
                            options:
                              e.target.value === 'single' || e.target.value === 'multiple'
                                ? q.options && q.options.length > 0
                                  ? q.options
                                  : ['Lựa chọn A', 'Lựa chọn B']
                                : undefined,
                          })
                        }
                        className="glass-subsurface rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-200 outline-none"
                      >
                        <option value="rating">Đánh giá ★</option>
                        <option value="single">Chọn 1</option>
                        <option value="multiple">Chọn nhiều</option>
                        <option value="text">Tự luận</option>
                      </select>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(idx)}
                          className="p-1 text-rose-500 hover:bg-rose-500/15 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {(q.type === 'single' || q.type === 'multiple') && (
                      <input
                        type="text"
                        value={(q.options || []).join(', ')}
                        onChange={(e) =>
                          handleUpdateQuestion(idx, {
                            options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                          })
                        }
                        placeholder="Các lựa chọn (phân tách bằng dấu phẩy)"
                        className="w-full glass-subsurface rounded-lg px-2.5 py-1.5 text-[11px] text-slate-700 dark:text-slate-200 outline-none"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/40 dark:border-white/10 mt-4">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-600 hover:to-teal-600 text-white font-bold shadow-sm cursor-pointer transition-all"
              >
                Phát hành Khảo sát
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
