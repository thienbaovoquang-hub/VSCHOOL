import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Atom,
  BookOpen,
  Bot,
  Calculator,
  Compass,
  Feather,
  FlaskConical,
  Landmark,
  Languages,
  Layers,
  Sparkles,
} from 'lucide-react';
import { PermissionMatrix, UserProfile } from '../../types';
import { DEFAULT_PERMISSIONS } from '../../utils/rbac';
import { resolveAppTabAlias } from '../../utils/streamlinedHelpers';
import {
  parseSubjectBridgeMessage,
  SubjectBridgeContextPayload,
} from '../../utils/subjectAi';
import {
  getActiveSubjects,
  getSubjectById,
  SubjectId,
  syncSubjectIframeTheme,
} from '../../utils/subjectRegistry';
import { AppWindowShell } from '../shared/AppWindowShell';
import {
  HostToIframeCommand,
  PendingSubjectAiRequest,
  SubjectAiDrawer,
} from './SubjectAiDrawer';

const SUBJECT_ICONS = {
  Languages,
  Calculator,
  Atom,
  FlaskConical,
  Feather,
  Landmark,
  Compass,
} as const;

interface SubjectsAppProps {
  activeTab: string;
  currentUser: UserProfile;
  customPermissions?: PermissionMatrix;
  darkMode: boolean;
  onSelectTab: (tabId: string) => void;
}

export const SubjectsApp: React.FC<SubjectsAppProps> = ({
  activeTab,
  currentUser,
  customPermissions = DEFAULT_PERMISSIONS,
  darkMode,
  onSelectTab,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [drawerSubjectId, setDrawerSubjectId] = useState<SubjectId>('math');
  const [contextBySubject, setContextBySubject] = useState<
    Partial<Record<SubjectId, SubjectBridgeContextPayload>>
  >({});
  const [pendingAiRequest, setPendingAiRequest] = useState<PendingSubjectAiRequest | null>(null);

  const resolvedInitialTab = resolveAppTabAlias('subjects', activeTab);
  const activeSubjects = getActiveSubjects();
  const initialSelectedSubject = getSubjectById(resolvedInitialTab);

  useEffect(() => {
    syncSubjectIframeTheme(iframeRef.current, darkMode);
  }, [darkMode, resolvedInitialTab]);

  useEffect(() => {
    if (initialSelectedSubject) {
      setDrawerSubjectId(initialSelectedSubject.id);
    }
  }, [initialSelectedSubject]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const parsed = parseSubjectBridgeMessage(event.data);
      if (!parsed) return;

      if (parsed.type === 'subject:context') {
        setContextBySubject((prev) => ({
          ...prev,
          [parsed.payload.subjectId]: parsed.payload,
        }));
      } else if (parsed.type === 'subject:open-ai') {
        const p = parsed.payload;
        setDrawerSubjectId(p.subjectId);
        setAiDrawerOpen(true);
        setPendingAiRequest({
          id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          subjectId: p.subjectId,
          mode: p.mode,
          prompt: p.prompt,
          contextText: p.contextText,
          autoSend: p.autoSend,
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const openAiForSubject = (subjectId: SubjectId) => {
    setDrawerSubjectId(subjectId);
    setAiDrawerOpen(true);
  };

  const askAboutCurrentContext = (subjectId: SubjectId) => {
    const ctx = contextBySubject[subjectId];
    const subjectDef = getSubjectById(subjectId);
    setDrawerSubjectId(subjectId);
    setAiDrawerOpen(true);
    setPendingAiRequest({
      id: `ctx-${Date.now()}`,
      subjectId,
      mode: 'tutor_chat',
      prompt: ctx?.topic
        ? `Hãy giải thích trọng tâm và hướng dẫn cách học hiệu quả phần "${ctx.topic}" trong môn ${subjectDef?.title || subjectId}.`
        : `Hãy tóm tắt trọng tâm cần nắm và gợi ý câu hỏi tự kiểm tra cho môn ${subjectDef?.title || subjectId}.`,
      contextText: ctx
        ? [ctx.view ? `Mục: ${ctx.view}` : '', ctx.topic, ctx.summary].filter(Boolean).join('\n')
        : '',
      autoSend: true,
    });
  };

  const handleSendCommandToIframe = useCallback(
    (command: HostToIframeCommand): boolean => {
      const targetWin = iframeRef.current?.contentWindow;
      if (!targetWin || !initialSelectedSubject) return false;
      targetWin.postMessage(
        {
          source: 'schoolhub-host',
          ...command,
        },
        '*'
      );
      return true;
    },
    [initialSelectedSubject]
  );

  const activeSubjectId = initialSelectedSubject?.id ?? drawerSubjectId;
  const activeContext = contextBySubject[activeSubjectId] || null;

  return (
    <>
      <AppWindowShell
        appId="subjects"
        activeTab={activeTab}
        userRole={currentUser.role}
        userProfile={currentUser}
        customPermissions={customPermissions}
        contentClassName={
          initialSelectedSubject
            ? 'flex-1 min-h-0 overflow-hidden flex flex-col p-0'
            : undefined
        }
        onSelectTab={onSelectTab}
      >
        {(resolvedTab) => {
          const selectedSubject = getSubjectById(resolvedTab);
          if (selectedSubject) {
            const liveSubjectCtx = contextBySubject[selectedSubject.id];
            return (
              <div
                data-testid={`subjects-${selectedSubject.id}-workspace`}
                className="flex-1 min-h-0 w-full h-full flex flex-col bg-transparent"
              >
                <div className="px-4 py-2 border-b border-slate-900/10 dark:border-white/10 bg-white/35 dark:bg-slate-900/45 backdrop-blur-xl flex items-center justify-between gap-3 shrink-0">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {selectedSubject.appTitle}
                    </span>
                    {liveSubjectCtx?.topic && (
                      <span className="hidden sm:inline text-xs text-slate-600 dark:text-slate-300 truncate">
                        · {liveSubjectCtx.topic}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      data-testid="ask-ai-current-context"
                      onClick={() => askAboutCurrentContext(selectedSubject.id)}
                      className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-100 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                      <span>Hỏi AI mục này</span>
                    </button>
                    <button
                      type="button"
                      data-testid="toggle-subject-ai-drawer"
                      onClick={() => openAiForSubject(selectedSubject.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-sky-400/35 bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-200 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      <span>Trợ lý AI {selectedSubject.title}</span>
                    </button>
                  </div>
                </div>
                <iframe
                  key={selectedSubject.id}
                  ref={iframeRef}
                  src={selectedSubject.htmlPath}
                  title={selectedSubject.appTitle}
                  data-testid={`subject-${selectedSubject.id}-iframe`}
                  onLoad={() => syncSubjectIframeTheme(iframeRef.current, darkMode)}
                  className="w-full h-full flex-1 min-h-0 border-0 block"
                />
              </div>
            );
          }

          return (
            <div data-testid="subjects-overview" className="max-w-6xl mx-auto space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Mỗi môn học tích hợp Gemini theo ngữ cảnh trực tiếp trong bài học, mô phỏng và bài tập.
                </p>
                <button
                  type="button"
                  data-testid="open-overview-ai-drawer"
                  onClick={() => openAiForSubject(drawerSubjectId)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/80 text-slate-900 dark:text-slate-100 text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer"
                >
                  <Bot className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>Trợ lý AI môn học</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
                {activeSubjects.map((subject, index) => {
                  const SubjectIcon = SUBJECT_ICONS[subject.iconName] || BookOpen;
                  return (
                    <article
                      key={subject.id}
                      data-testid={`subject-card-${subject.id}`}
                      className="liquid-glass-panel rounded-[24px] p-5 sm:p-6 flex flex-col justify-between gap-5 transition-transform duration-200 hover:-translate-y-0.5"
                    >
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3.5">
                            <div
                              className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${subject.iconGradient} text-white flex items-center justify-center shrink-0 shadow-md ring-1 ring-white/30`}
                            >
                              <SubjectIcon className="w-6 h-6" />
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold text-sky-700 dark:text-sky-300 font-mono-tabular">
                                Môn học #{index + 1} · Tích hợp Gemini AI
                              </p>
                              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                                {subject.title}
                              </h3>
                              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                {subject.appTitle}
                              </p>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                          {subject.description}
                        </p>

                        <div className="pt-3 border-t border-slate-900/10 dark:border-white/10">
                          <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-2">
                            Nội dung thực hành & AI
                          </p>
                          <ul className="space-y-1.5 text-xs text-slate-800 dark:text-slate-100">
                            {subject.capabilities.map((item) => (
                              <li key={item} className="flex items-center gap-2">
                                <BookOpen className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5">
                        <button
                          type="button"
                          data-testid={`ask-ai-subject-${subject.id}`}
                          onClick={() => openAiForSubject(subject.id)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-100 text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer"
                        >
                          <Bot className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                          <span>Hỏi AI</span>
                        </button>
                        <button
                          type="button"
                          data-testid={`open-subject-${subject.id}`}
                          onClick={() => onSelectTab(subject.id)}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-xs font-bold shadow-md shadow-sky-500/20 whitespace-nowrap shrink-0 transition-all cursor-pointer"
                        >
                          <span>Vào học {subject.title}</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              <aside className="rounded-[22px] glass-subsurface p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-400/25 text-sky-600 dark:text-sky-300 flex items-center justify-center shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">
                      Cấu trúc mở rộng theo môn học & AI theo ngữ cảnh
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                      Mỗi môn học đồng bộ ngữ cảnh trực tiếp với Trợ lý AI Gemini (giải bài theo dòng thực, sinh đề trắc nghiệm, tạo thẻ nhớ và phân tích lỗi sai): {activeSubjects.map((s) => s.title).join(', ')}.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          );
        }}
      </AppWindowShell>

      <SubjectAiDrawer
        isOpen={aiDrawerOpen}
        subjectId={activeSubjectId}
        allowSubjectSwitch={!initialSelectedSubject}
        liveContext={activeContext}
        pendingRequest={pendingAiRequest}
        onConsumePendingRequest={(id) =>
          setPendingAiRequest((prev) => (prev?.id === id ? null : prev))
        }
        onSendCommandToIframe={initialSelectedSubject ? handleSendCommandToIframe : undefined}
        onChangeSubject={setDrawerSubjectId}
        onClose={() => setAiDrawerOpen(false)}
      />
    </>
  );
};
