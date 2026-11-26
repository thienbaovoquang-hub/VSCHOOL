import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Check,
  Copy,
  RotateCcw,
  Send,
  Sparkles,
} from '../icons/UiIcons';
import {
  AcademicRecord,
  Announcement,
  Book,
  BorrowTransaction,
  ExternalDatasetRecord,
  FacilityAsset,
  FeedbackReport,
  MaintenanceRequest,
  PermissionMatrix,
  SchoolClass,
  Student,
  SuperAppId,
  Teacher,
  UserProfile,
} from '../../types';
import { AppWindowShell } from '../shared/AppWindowShell';
import { LiquidCard } from '../common/LiquidCard';
import { Badge } from '../common/Badge';
import { FormattedAiText } from '../common/FormattedAiText';
import { postSseWithFallback } from '../../utils/aiStreamClient';
import { canAccessSuperApp, DEFAULT_PERMISSIONS, ROLE_DEFINITIONS } from '../../utils/rbac';
import {
  AiAssistantChatMessage,
  buildAiAssistantContextSummary,
  createWelcomeAssistantMessage,
  getAssistantPromptCatalog,
  getAssistantQuickChips,
  PromptCategoryId,
} from '../../utils/aiAssistantHelpers';

interface AIAssistantAppProps {
  activeTab: string;
  currentUser: UserProfile;
  customPermissions?: PermissionMatrix;
  externalDatasets?: ExternalDatasetRecord[];
  students: Student[];
  teachers: Teacher[];
  classes: SchoolClass[];
  books: Book[];
  borrowTransactions: BorrowTransaction[];
  academicRecords: AcademicRecord[];
  feedbacks: FeedbackReport[];
  announcements: Announcement[];
  facilities: FacilityAsset[];
  maintenance: MaintenanceRequest[];
  onSelectTab: (tabId: string) => void;
  onOpenTargetApp: (appId: SuperAppId, tabId?: string) => void;
}

export const AIAssistantApp: React.FC<AIAssistantAppProps> = ({
  activeTab,
  currentUser,
  customPermissions = DEFAULT_PERMISSIONS,
  externalDatasets = [],
  students,
  teachers,
  classes,
  books,
  borrowTransactions,
  academicRecords,
  feedbacks,
  announcements,
  facilities,
  maintenance,
  onSelectTab,
  onOpenTargetApp,
}) => {
  const isPureStudent =
    currentUser.role === 'student' &&
    (!currentUser.secondaryRoles || currentUser.secondaryRoles.length === 0);

  const metricsSummary = useMemo(
    () =>
      buildAiAssistantContextSummary({
        currentUser,
        students,
        teachers,
        classes,
        books,
        borrowTransactions,
        academicRecords,
        feedbacks,
        announcements,
        facilities,
        maintenance,
        externalDatasets,
      }),
    [
      currentUser,
      students,
      teachers,
      classes,
      books,
      borrowTransactions,
      academicRecords,
      feedbacks,
      announcements,
      facilities,
      maintenance,
      externalDatasets,
    ]
  );

  const [chatMessages, setChatMessages] = useState<AiAssistantChatMessage[]>(() => [
    createWelcomeAssistantMessage(currentUser),
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [promptCategory, setPromptCategory] = useState<PromptCategoryId>('all');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isChatLoading]);

  const promptCatalog = useMemo(
    () => getAssistantPromptCatalog(currentUser.role),
    [currentUser.role]
  );

  const quickChips = useMemo(
    () => getAssistantQuickChips(currentUser.role),
    [currentUser.role]
  );

  const filteredPrompts = useMemo(
    () =>
      promptCategory === 'all'
        ? promptCatalog
        : promptCatalog.filter((item) => item.category === promptCategory),
    [promptCatalog, promptCategory]
  );

  const handleCopyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard?.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((curr) => (curr === id ? null : curr));
      }, 1800);
    } catch {
      // Clipboard API unavailable in restricted context
    }
  };

  const handleResetChat = () => {
    if (isChatLoading) return;
    setChatMessages([createWelcomeAssistantMessage(currentUser)]);
  };

  const handleSendChat = async (preset?: string) => {
    const q = (preset || chatInput).trim();
    if (!q || isChatLoading) return;

    const nowTime = new Date().toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const historyTurns = chatMessages
      .filter((m) => !m.isError && m.id !== 'welcome')
      .slice(-8)
      .map((m) => ({
        role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      }));
    historyTurns.push({ role: 'user', content: q });

    const userMsgId = `u-${Date.now()}`;
    const assistantMsgId = `a-${Date.now() + 1}`;
    setChatMessages((prev) => [
      ...prev,
      { id: userMsgId, sender: 'user', text: q, time: nowTime },
    ]);
    setChatInput('');
    setIsChatLoading(true);
    setStreamingMessageId(assistantMsgId);

    const upsertAssistantMessage = (text: string, isError = false) => {
      const timeLabel = new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setChatMessages((prev) => {
        const exists = prev.some((m) => m.id === assistantMsgId);
        if (exists) {
          return prev.map((m) =>
            m.id === assistantMsgId ? { ...m, text, isError, time: timeLabel } : m
          );
        }
        return [
          ...prev,
          { id: assistantMsgId, sender: 'assistant', text, time: timeLabel, isError },
        ];
      });
    };

    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 65_000);

    try {
      const finalText = await postSseWithFallback({
        streamUrl: '/api/ai/chat-stream',
        fallbackUrl: '/api/ai/chat',
        signal: controller.signal,
        isTimedOut: () => timedOut,
        payload: {
          message: q,
          messages: historyTurns,
          contextSummary: metricsSummary.roleSummaryText,
          user: {
            displayName: currentUser.displayName,
            role: currentUser.role,
            className:
              currentUser.className ||
              currentUser.studentCode ||
              currentUser.email ||
              'THPT',
          },
        },
        onUpdate: (partialText) => {
          upsertAssistantMessage(partialText, false);
        },
      });
      upsertAssistantMessage(finalText, false);
    } catch (err) {
      const errorText = timedOut
        ? 'Yêu cầu Trợ lý AI vượt quá thời gian chờ phản hồi. Vui lòng thử lại sau giây lát.'
        : err instanceof Error && err.message
          ? err.message
          : 'Không thể kết nối đến máy chủ AI lúc này.';
      upsertAssistantMessage(errorText, true);
    } finally {
      window.clearTimeout(timeoutId);
      setIsChatLoading(false);
      setStreamingMessageId(null);
    }
  };

  const roleLabel = ROLE_DEFINITIONS[currentUser.role]?.label || currentUser.role;
  const canOpenAnalytics = canAccessSuperApp(currentUser, 'analytics', customPermissions);

  const categoryOptions: Array<{ id: PromptCategoryId; label: string }> = [
    { id: 'all', label: 'Tất cả' },
    { id: 'learning', label: 'Học tập & Ôn thi' },
    { id: 'library', label: 'Thư viện RFID' },
    { id: 'services', label: 'Dịch vụ & Nội quy' },
    ...(!isPureStudent ? [{ id: 'management' as const, label: 'Điều hành & Lớp học' }] : []),
  ];

  return (
    <AppWindowShell
      appId="ai-assistant"
      activeTab={activeTab}
      userRole={currentUser.role}
      userProfile={currentUser}
      customPermissions={customPermissions}
      onSelectTab={onSelectTab}
    >
      {(tabId) => (
        <>
          {tabId === 'chat' && (
            <div
              data-testid="ai-assistant-app"
              className="h-full flex flex-col min-h-[420px] gap-3"
            >
              {/* Role-Scoped Context & Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-2xl glass-subsurface shrink-0">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-50">
                        SchoolHub Copilot
                      </span>
                      <Badge variant="mint" size="sm">
                        {roleLabel}
                      </Badge>
                    </div>
                    <p className="text-[11px] font-mono-tabular text-slate-600 dark:text-slate-300 truncate">
                      {isPureStudent
                        ? `Lớp ${currentUser.className || 'THPT'} · ${metricsSummary.ownGradesCount} môn · ${metricsSummary.activeLoans} sách đang mượn`
                        : `${metricsSummary.studentsCount} HS · ${metricsSummary.classesCount} lớp · ${metricsSummary.booksCount} đầu sách · ${metricsSummary.activeLoans} đang mượn`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onSelectTab('prompts')}
                    className="px-3 py-1.5 rounded-xl glass-subsurface text-xs font-semibold text-teal-700 dark:text-teal-300 hover:bg-white/80 dark:hover:bg-slate-800/80 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Gợi ý mẫu
                  </button>
                  <button
                    type="button"
                    data-testid="ai-chat-reset"
                    onClick={handleResetChat}
                    disabled={isChatLoading}
                    className="px-2.5 py-1.5 rounded-xl glass-subsurface text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-50 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Làm mới
                  </button>
                </div>
              </div>

              {/* Quick Suggestion Chips */}
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                {quickChips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleSendChat(chip)}
                    disabled={isChatLoading}
                    className="px-3 py-1.5 rounded-xl glass-subsurface text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:border-teal-400/70 hover:text-teal-700 dark:hover:text-teal-300 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Chat Message Feed */}
              <div
                ref={chatScrollRef}
                className="flex-1 min-h-0 overflow-y-auto space-y-3 p-3.5 sm:p-4 rounded-2xl glass-subsurface"
              >
                {chatMessages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[88%] sm:max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed ${
                        m.sender === 'user'
                          ? 'bg-teal-600 text-white shadow-sm whitespace-pre-wrap'
                          : m.isError
                            ? 'bg-rose-500/15 border border-rose-400/40 text-rose-800 dark:text-rose-200 whitespace-pre-wrap'
                            : 'glass-subsurface text-slate-800 dark:text-slate-100'
                      }`}
                    >
                      {m.sender === 'assistant' && !m.isError ? (
                        <FormattedAiText
                          text={m.text}
                          isStreaming={isChatLoading && streamingMessageId === m.id}
                        />
                      ) : (
                        m.text
                      )}
                      <div className="mt-1.5 flex items-center justify-between gap-3">
                        <span
                          className={`text-[10px] font-mono-tabular ${
                            m.sender === 'user'
                              ? 'text-white/75'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {m.time}
                        </span>
                        {m.sender === 'assistant' && !m.isError && m.id !== 'welcome' && (
                          <button
                            type="button"
                            onClick={() => void handleCopyMessage(m.id, m.text)}
                            aria-label="Sao chép phản hồi"
                            className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-300 cursor-pointer"
                          >
                            {copiedId === m.id ? (
                              <>
                                <Check className="w-3 h-3" /> Đã chép
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" /> Sao chép
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {isChatLoading &&
                  !chatMessages.some((m) => m.id === streamingMessageId) && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 italic px-2 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-ping" />
                      Trợ lý AI đang tổng hợp câu trả lời...
                    </div>
                  )}
              </div>

              {/* Composer */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSendChat();
                }}
                className="flex items-center gap-2 shrink-0"
              >
                <input
                  type="text"
                  data-testid="ai-chat-input"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Nhập câu hỏi cho Trợ lý AI (học tập, thư viện RFID, nội quy, số liệu)..."
                  className="flex-1 glass-subsurface rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                />
                <button
                  type="submit"
                  data-testid="ai-chat-send"
                  disabled={isChatLoading || !chatInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer shadow-sm whitespace-nowrap shrink-0"
                >
                  <Send className="w-4 h-4" /> Gửi
                </button>
              </form>
            </div>
          )}

          {tabId === 'prompts' && (
            <div data-testid="ai-assistant-prompts" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {categoryOptions.map((cat) => {
                    const active = promptCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setPromptCategory(cat.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-teal-600 text-white shadow-sm'
                            : 'glass-subsurface text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800/80'
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
                <span className="text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400">
                  {filteredPrompts.length} mẫu câu sẵn sàng
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredPrompts.map((item) => (
                  <LiquidCard
                    key={item.id}
                    className="p-4 flex flex-col justify-between gap-3 hover:border-teal-400/60 transition-colors"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="mint" size="sm">
                          {item.categoryLabel}
                        </Badge>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {item.description}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 italic line-clamp-2 pt-1">
                        “{item.prompt}”
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        data-testid={`prompt-run-${item.id}`}
                        onClick={() => {
                          onSelectTab('chat');
                          void handleSendChat(item.prompt);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Hỏi Trợ lý AI <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </LiquidCard>
                ))}
              </div>

              <LiquidCard className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  Cần mở nhanh tính năng chuyên sâu khác?
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenTargetApp('subjects', 'overview')}
                    className="px-3 py-1.5 rounded-xl glass-subsurface text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-sky-600 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Học tập theo môn
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenTargetApp('library', 'circulation')}
                    className="px-3 py-1.5 rounded-xl glass-subsurface text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Thư viện RFID
                  </button>
                  {canOpenAnalytics && (
                    <button
                      type="button"
                      onClick={() => onOpenTargetApp('analytics', 'ai-analysis')}
                      className="px-3 py-1.5 rounded-xl glass-subsurface text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-purple-600 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Phân tích số liệu AI
                    </button>
                  )}
                </div>
              </LiquidCard>
            </div>
          )}
        </>
      )}
    </AppWindowShell>
  );
};
