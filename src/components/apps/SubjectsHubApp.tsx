import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Code2,
  Download,
  ExternalLink,
  FileCode2,
  FolderOpen,
  Maximize2,
  Minimize2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  CheckCircle2,
  AlertCircle,
  Copy,
} from '../icons/UiIcons';
import { PermissionMatrix, UserProfile } from '../../types';
import { AppWindowShell } from '../shared/AppWindowShell';
import { Modal } from '../common/Modal';
import { DEFAULT_PERMISSIONS } from '../../utils/rbac';
import {
  SUBJECT_DEFINITIONS,
  SubjectHtmlModule,
  SubjectId,
  SubjectProgressSnapshot,
  buildSubjectIframeUrl,
  createUploadedHtmlModule,
  formatBytesCompact,
  getSubjectById,
  getSubjectSummaries,
  loadCustomSubjectHtmlModules,
  mergeSubjectHtmlModules,
  parseSubjectProgressMessage,
  saveCustomSubjectHtmlModules,
  validateHtmlAppUpload,
} from '../../utils/subjectApps';

interface SubjectsHubAppProps {
  activeTab: string;
  currentUser: UserProfile;
  customPermissions?: PermissionMatrix;
  darkMode?: boolean;
  onSelectTab: (tabId: string) => void;
}

export const SubjectsHubApp: React.FC<SubjectsHubAppProps> = ({
  activeTab,
  currentUser,
  customPermissions = DEFAULT_PERMISSIONS,
  darkMode = false,
  onSelectTab,
}) => {
  const [customModules, setCustomModules] = useState<SubjectHtmlModule[]>(() =>
    loadCustomSubjectHtmlModules()
  );
  const allModules = useMemo(
    () => mergeSubjectHtmlModules(customModules),
    [customModules]
  );
  const subjectSummaries = useMemo(
    () => getSubjectSummaries(allModules),
    [allModules]
  );

  // Default to the first subject: Tiếng Anh ('english')
  const [selectedSubjectId, setSelectedSubjectId] = useState<SubjectId>('english');
  const [selectedModuleIdBySubject, setSelectedModuleIdBySubject] = useState<
    Partial<Record<SubjectId, string>>
  >({
    english: 'builtin-english-studio',
  });
  const [reloadNonce, setReloadNonce] = useState(0);
  const [isStageExpanded, setIsStageExpanded] = useState(false);
  const [progressBySubject, setProgressBySubject] = useState<
    Partial<Record<SubjectId, SubjectProgressSnapshot>>
  >({});

  // Quick Import Modal state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<'file' | 'paste'>('file');
  const [importSubjectId, setImportSubjectId] = useState<SubjectId>('english');
  const [importFileName, setImportFileName] = useState('');
  const [importTitle, setImportTitle] = useState('');
  const [importDescription, setImportDescription] = useState('');
  const [importHtmlCode, setImportHtmlCode] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [libraryNotice, setLibraryNotice] = useState<{
    message: string;
    subjectId: SubjectId;
    moduleId: string;
  } | null>(null);
  const [libraryFilterSubject, setLibraryFilterSubject] = useState<SubjectId | 'all'>('all');

  // Source Preview Modal state
  const [sourceModalModule, setSourceModalModule] = useState<SubjectHtmlModule | null>(null);
  const [sourcePreviewText, setSourcePreviewText] = useState('');
  const [sourceLoading, setSourceLoading] = useState(false);
  const [copiedSource, setCopiedSource] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Persist custom modules whenever updated
  useEffect(() => {
    saveCustomSubjectHtmlModules(customModules);
  }, [customModules]);

  // Listen to postMessage progress updates from interactive HTML subject apps
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const parsed = parseSubjectProgressMessage(event.data);
      if (!parsed) return;
      setProgressBySubject((prev) => ({
        ...prev,
        [parsed.subjectId]: parsed,
      }));
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Forward darkMode updates into running builtin iframe without reloading
  useEffect(() => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'schoolhub-theme', dark: darkMode },
        '*'
      );
    } catch {
      // Ignore cross-origin postMessage restrictions
    }
  }, [darkMode]);

  const activeSubjectSummary =
    subjectSummaries.find((s) => s.subject.id === selectedSubjectId) ||
    subjectSummaries[0];

  const activeModules = activeSubjectSummary.modules;
  const preferredModuleId = selectedModuleIdBySubject[selectedSubjectId];
  const activeModule =
    activeModules.find((m) => m.id === preferredModuleId) || activeModules[0] || null;

  const activeProgress = progressBySubject[selectedSubjectId];

  const openImportModalFor = (subjectId: SubjectId, mode: 'file' | 'paste' = 'file') => {
    setImportSubjectId(subjectId);
    setImportMode(mode);
    setImportFileName(mode === 'paste' ? `${subjectId}-app.html` : '');
    setImportTitle('');
    setImportDescription('');
    setImportHtmlCode('');
    setImportError(null);
    setImportModalOpen(true);
  };

  const handleFileChosen = async (file: File | null | undefined) => {
    if (!file) return;
    setImportError(null);
    try {
      const text = await file.text();
      const validation = validateHtmlAppUpload(file.name, text);
      if (!validation.ok) {
        setImportError(validation.error);
        return;
      }
      setImportFileName(validation.sanitizedFileName);
      setImportHtmlCode(text);
      if (!importTitle.trim()) {
        setImportTitle(validation.title);
      }
    } catch {
      setImportError('Không thể đọc tệp HTML từ thiết bị. Vui lòng thử lại.');
    }
  };

  const handleSaveImportedHtml = (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);

    const fileNameToCheck =
      importFileName.trim() || `${importSubjectId}-interactive.html`;
    const validation = validateHtmlAppUpload(fileNameToCheck, importHtmlCode);
    if (!validation.ok) {
      setImportError(validation.error);
      return;
    }

    const created = createUploadedHtmlModule({
      subjectId: importSubjectId,
      fileName: validation.sanitizedFileName,
      htmlContent: importHtmlCode,
      title: importTitle.trim() || validation.title,
      description: importDescription.trim(),
    });

    setCustomModules((prev) => [created, ...prev]);
    setSelectedSubjectId(importSubjectId);
    setSelectedModuleIdBySubject((prev) => ({
      ...prev,
      [importSubjectId]: created.id,
    }));
    setLibraryNotice({
      message: `Đã nạp tệp "${created.fileName}" vào môn ${getSubjectById(importSubjectId).name}.`,
      subjectId: importSubjectId,
      moduleId: created.id,
    });
    setImportModalOpen(false);
    onSelectTab('subjects');
  };

  const handleDeleteCustomModule = (modId: string) => {
    setCustomModules((prev) => prev.filter((m) => m.id !== modId));
  };

  const handleOpenSourcePreview = async (mod: SubjectHtmlModule) => {
    setSourceModalModule(mod);
    setCopiedSource(false);
    if (mod.sourceType === 'uploaded' && mod.htmlContent) {
      setSourcePreviewText(mod.htmlContent);
      return;
    }
    if (mod.srcUrl) {
      setSourceLoading(true);
      try {
        const res = await fetch(mod.srcUrl);
        const text = await res.text();
        setSourcePreviewText(text);
      } catch {
        setSourcePreviewText('<!-- Không thể tải mã nguồn tệp HTML. -->');
      } finally {
        setSourceLoading(false);
      }
    }
  };

  const handleDownloadModuleHtml = async (mod: SubjectHtmlModule) => {
    let content = mod.htmlContent || '';
    if (!content && mod.srcUrl) {
      try {
        const res = await fetch(mod.srcUrl);
        content = await res.text();
      } catch {
        return;
      }
    }
    if (!content) return;
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = mod.fileName || `${mod.subjectId}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopySource = async () => {
    if (!sourcePreviewText) return;
    try {
      await navigator.clipboard.writeText(sourcePreviewText);
      setCopiedSource(true);
      setTimeout(() => setCopiedSource(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const filteredLibraryModules = useMemo(() => {
    if (libraryFilterSubject === 'all') return allModules;
    return allModules.filter((m) => m.subjectId === libraryFilterSubject);
  }, [allModules, libraryFilterSubject]);

  return (
    <>
      <AppWindowShell
        appId="subjects"
      activeTab={activeTab}
      userRole={currentUser.role}
      userProfile={currentUser}
      customPermissions={customPermissions}
      onSelectTab={onSelectTab}
    >
      {(resolvedTab) => {
        if (resolvedTab === 'html-library') {
          return (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] liquid-glass-panel p-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Kho ứng dụng HTML theo từng môn học
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    Nạp tệp <span className="font-mono-tabular font-semibold">.html</span> hoặc dán mã nguồn HTML để tạo bài giảng tương tác cho từng môn.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-testid="subjects-open-paste-btn"
                    onClick={() => openImportModalFor(selectedSubjectId, 'paste')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl glass-subsurface text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-white/80 dark:hover:bg-slate-800/80 cursor-pointer whitespace-nowrap"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Dán mã HTML</span>
                  </button>
                  <button
                    type="button"
                    data-testid="subjects-open-upload-btn"
                    onClick={() => openImportModalFor(selectedSubjectId, 'file')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-sm cursor-pointer whitespace-nowrap"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Nạp file .html</span>
                  </button>
                </div>
              </div>

              {libraryNotice && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-emerald-500/12 border border-emerald-500/25 px-4 py-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{libraryNotice.message}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSubjectId(libraryNotice.subjectId);
                      setSelectedModuleIdBySubject((prev) => ({
                        ...prev,
                        [libraryNotice.subjectId]: libraryNotice.moduleId,
                      }));
                      onSelectTab('subjects');
                    }}
                    className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 cursor-pointer"
                  >
                    Chạy ngay
                  </button>
                </div>
              )}

              {/* Subject Filter Strip */}
              <div className="glass-pill-tray flex items-center gap-1 overflow-x-auto p-1 rounded-xl scrollbar-none">
                <button
                  type="button"
                  onClick={() => setLibraryFilterSubject('all')}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    libraryFilterSubject === 'all' ? 'glass-pill-tab-active' : 'glass-pill-tab'
                  }`}
                >
                  Tất cả ({allModules.length})
                </button>
                {subjectSummaries.map((sum) => (
                  <button
                    key={sum.subject.id}
                    type="button"
                    onClick={() => setLibraryFilterSubject(sum.subject.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      libraryFilterSubject === sum.subject.id ? 'glass-pill-tab-active' : 'glass-pill-tab'
                    }`}
                  >
                    {sum.subject.name} ({sum.moduleCount})
                  </button>
                ))}
              </div>

              {/* HTML Modules List */}
              {filteredLibraryModules.length === 0 ? (
                <div className="rounded-[22px] glass-subsurface p-10 text-center">
                  <FileCode2 className="w-9 h-9 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Chưa có tệp HTML nào cho bộ lọc này
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    Nhấn &ldquo;Nạp file .html&rdquo; để thêm ứng dụng học tập mới cho môn học.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {filteredLibraryModules.map((mod) => {
                    const subj = getSubjectById(mod.subjectId);
                    return (
                      <div
                        key={mod.id}
                        className="rounded-[20px] liquid-glass-panel p-4 flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            <span className={`${subj.accentText} font-bold`}>
                              {subj.name} · {subj.code}
                            </span>
                            <span className="font-mono-tabular">
                              {mod.sourceType === 'builtin' ? 'Tệp hệ thống' : formatBytesCompact(mod.sizeBytes)}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {mod.title}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                            {mod.description}
                          </p>
                          <p className="text-[11px] font-mono-tabular text-slate-400 dark:text-slate-500">
                            {mod.fileName}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-white/35 dark:border-white/10">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSubjectId(mod.subjectId);
                              setSelectedModuleIdBySubject((prev) => ({
                                ...prev,
                                [mod.subjectId]: mod.id,
                              }));
                              onSelectTab('subjects');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-sm cursor-pointer whitespace-nowrap"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Mở chạy</span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleOpenSourcePreview(mod)}
                              className="px-2.5 py-1.5 rounded-xl glass-subsurface text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap"
                            >
                              Mã HTML
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDownloadModuleHtml(mod)}
                              aria-label={`Tải xuống ${mod.fileName}`}
                              className="p-1.5 rounded-xl glass-subsurface text-slate-700 dark:text-slate-200 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            {mod.sourceType === 'uploaded' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomModule(mod.id)}
                                aria-label={`Xóa ${mod.title}`}
                                className="p-1.5 rounded-xl glass-subsurface border-rose-400/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        // TAB 1: Interactive Subjects Workspace (Tiếng Anh selected first!)
        const subjDef = activeSubjectSummary.subject;

        return (
          <div className="flex flex-col gap-3 h-full min-h-[540px]">
            {/* Horizontal Subject Divider Bar */}
            <div
              aria-label="Danh sách môn học"
              data-testid="subjects-selector-bar"
              className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0 scrollbar-none"
            >
              {subjectSummaries.map(({ subject, moduleCount, hasHtmlApp }) => {
                const isSelected = subject.id === selectedSubjectId;
                return (
                  <button
                    key={subject.id}
                    type="button"
                    data-testid={`subject-btn-${subject.id}`}
                    onClick={() => {
                      setSelectedSubjectId(subject.id);
                      setIsStageExpanded(false);
                    }}
                    className={`shrink-0 px-3.5 py-2 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                      isSelected
                        ? 'glass-subsurface border-sky-500/70 ring-2 ring-sky-500/25 shadow-sm'
                        : 'glass-subsurface border-transparent hover:border-white/50 dark:hover:border-white/20'
                    }`}
                  >
                    <span
                      className={`w-7 h-7 rounded-xl text-[10px] font-extrabold flex items-center justify-center shrink-0 ${subject.accentBg} ${subject.accentText}`}
                    >
                      {subject.code}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                        {subject.name}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 font-mono-tabular">
                        {hasHtmlApp ? `${moduleCount} HTML` : 'Chưa có'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Subject Stage */}
            {activeModule ? (
              <div
                className={
                  isStageExpanded
                    ? 'fixed inset-3 z-50 rounded-[26px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden'
                    : 'flex-1 min-h-[480px] rounded-[22px] liquid-glass-panel flex flex-col overflow-hidden'
                }
              >
                {/* Stage Control Header */}
                <div className="shrink-0 px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className={`text-xs font-extrabold ${subjDef.accentText}`}>
                      {subjDef.name}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500">·</span>
                    {activeModules.length > 1 ? (
                      <select
                        aria-label="Chọn ứng dụng HTML trong môn học"
                        value={activeModule.id}
                        onChange={(e) =>
                          setSelectedModuleIdBySubject((prev) => ({
                            ...prev,
                            [selectedSubjectId]: e.target.value,
                          }))
                        }
                        className="text-xs font-semibold glass-subsurface rounded-lg px-2 py-1 text-slate-800 dark:text-slate-100"
                      >
                        {activeModules.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.title} ({m.fileName})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                        {activeModule.fileName}
                      </span>
                    )}

                    {activeProgress && (
                      <span
                        data-testid="subject-live-progress"
                        className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 font-mono-tabular"
                      >
                        <span>·</span>
                        {typeof activeProgress.masteredCount === 'number' &&
                          typeof activeProgress.masteredTotal === 'number' && (
                            <span>
                              Từ vựng {activeProgress.masteredCount}/{activeProgress.masteredTotal}
                            </span>
                          )}
                        {typeof activeProgress.quizScore === 'number' &&
                          typeof activeProgress.quizTotal === 'number' && (
                            <span>
                              · Quiz {activeProgress.quizScore}/{activeProgress.quizTotal}
                            </span>
                          )}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openImportModalFor(selectedSubjectId, 'file')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl glass-subsurface text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Nạp .html</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleOpenSourcePreview(activeModule)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl glass-subsurface text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap"
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Mã HTML</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReloadNonce((n) => n + 1)}
                      aria-label="Tải lại ứng dụng HTML"
                      title="Tải lại ứng dụng HTML"
                      className="p-1.5 rounded-xl glass-subsurface text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsStageExpanded((prev) => !prev)}
                      aria-label={isStageExpanded ? 'Thu gọn khung học' : 'Mở rộng khung học'}
                      title={isStageExpanded ? 'Thu gọn' : 'Mở rộng'}
                      className="p-1.5 rounded-xl glass-subsurface text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      {isStageExpanded ? (
                        <Minimize2 className="w-3.5 h-3.5" />
                      ) : (
                        <Maximize2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Live Interactive HTML File Stage */}
                <div
                  className={
                    isStageExpanded
                      ? 'flex-1 min-h-0 relative bg-slate-50 dark:bg-slate-950'
                      : 'h-[540px] lg:h-[600px] min-h-[460px] relative bg-slate-50 dark:bg-slate-950'
                  }
                >
                  {activeModule.sourceType === 'builtin' && activeModule.srcUrl ? (
                    <iframe
                      key={`${activeModule.id}-${reloadNonce}`}
                      ref={iframeRef}
                      data-testid="subject-html-iframe"
                      title={activeModule.title}
                      src={buildSubjectIframeUrl(activeModule.srcUrl, darkMode)}
                      sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
                      className="w-full h-full border-0 block"
                    />
                  ) : (
                    <iframe
                      key={`${activeModule.id}-${reloadNonce}`}
                      data-testid="subject-html-iframe"
                      title={activeModule.title}
                      srcDoc={activeModule.htmlContent || ''}
                      sandbox="allow-scripts allow-forms allow-modals"
                      className="w-full h-full border-0 block bg-white"
                    />
                  )}
                </div>
              </div>
            ) : (
              /* Subject Empty State for subjects awaiting .html file upload */
              <div
                data-testid={`subject-empty-${subjDef.id}`}
                className="flex-1 min-h-[420px] rounded-[22px] liquid-glass-panel p-6 flex flex-col items-center justify-center text-center"
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${subjDef.accentBg} ${subjDef.accentText}`}
                >
                  <BookOpen className="w-7 h-7" />
                </div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Môn {subjDef.name} · {subjDef.code}
                </p>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                  Chưa có ứng dụng HTML cho môn {subjDef.name}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mt-1.5 leading-relaxed">
                  {subjDef.description} Bạn có thể tải tệp <span className="font-mono-tabular font-semibold">.html</span> từ máy tính hoặc dán mã HTML để tạo ngay ứng dụng tương tác cho môn học này.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
                  <button
                    type="button"
                    onClick={() => openImportModalFor(subjDef.id, 'file')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-sm cursor-pointer whitespace-nowrap"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Nạp file .html cho môn {subjDef.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openImportModalFor(subjDef.id, 'paste')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl glass-subsurface text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Dán mã HTML</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      }}
      </AppWindowShell>

      {/* Modal 1: Import .html file or paste HTML */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Thêm ứng dụng môn học từ file HTML"
        description="Hỗ trợ tệp .html/.htm độc lập hoặc dán trực tiếp mã nguồn HTML5 tương tác."
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveImportedHtml} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="import-subject-select"
                className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1"
              >
                Chọn môn học
              </label>
              <select
                id="import-subject-select"
                value={importSubjectId}
                onChange={(e) => setImportSubjectId(e.target.value as SubjectId)}
                className="w-full rounded-xl glass-subsurface px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100"
              >
                {SUBJECT_DEFINITIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Cách nhập HTML
              </span>
              <div className="glass-pill-tray grid grid-cols-2 gap-1 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setImportMode('file')}
                  className={`py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    importMode === 'file' ? 'glass-pill-tab-active' : 'glass-pill-tab'
                  }`}
                >
                  Chọn file .html
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('paste')}
                  className={`py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    importMode === 'paste' ? 'glass-pill-tab-active' : 'glass-pill-tab'
                  }`}
                >
                  Dán mã HTML
                </button>
              </div>
            </div>
          </div>

          {importMode === 'file' && (
            <div className="rounded-2xl border-2 border-dashed border-sky-400/40 dark:border-sky-400/25 glass-subsurface p-5 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm,text/html"
                onChange={(e) => void handleFileChosen(e.target.files?.[0])}
                className="hidden"
              />
              <FolderOpen className="w-8 h-8 text-sky-500 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {importFileName ? `Đã chọn: ${importFileName}` : 'Chọn tệp .html hoặc .htm từ máy tính'}
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Chọn tệp .html</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="import-title-input"
                className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1"
              >
                Tên hiển thị ứng dụng
              </label>
              <input
                id="import-title-input"
                type="text"
                value={importTitle}
                onChange={(e) => setImportTitle(e.target.value)}
                placeholder="VD: Ôn tập Ngữ pháp Unit 1"
                className="w-full rounded-xl glass-subsurface px-3 py-2 text-xs text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="import-filename-input"
                className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1"
              >
                Tên tệp (.html)
              </label>
              <input
                id="import-filename-input"
                type="text"
                value={importFileName}
                onChange={(e) => setImportFileName(e.target.value)}
                placeholder="vd: unit1-quiz.html"
                className="w-full rounded-xl glass-subsurface px-3 py-2 text-xs font-mono-tabular text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="import-desc-input"
              className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1"
            >
              Mô tả ngắn (tùy chọn)
            </label>
            <input
              id="import-desc-input"
              type="text"
              value={importDescription}
              onChange={(e) => setImportDescription(e.target.value)}
              placeholder="Nội dung chính hoặc hướng dẫn sử dụng..."
              className="w-full rounded-xl glass-subsurface px-3 py-2 text-xs text-slate-800 dark:text-slate-100"
            />
          </div>

          {(importMode === 'paste' || Boolean(importHtmlCode)) && (
            <div>
              <label
                htmlFor="import-html-textarea"
                className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1"
              >
                Mã nguồn HTML
              </label>
              <textarea
                id="import-html-textarea"
                rows={6}
                value={importHtmlCode}
                onChange={(e) => setImportHtmlCode(e.target.value)}
                placeholder="<!DOCTYPE html><html><head><title>App môn học</title></head><body>...</body></html>"
                className="w-full rounded-xl border border-slate-700/60 bg-slate-950/90 text-emerald-300 px-3 py-2 text-[11px] font-mono-tabular"
              />
            </div>
          )}

          {importError && (
            <div className="flex items-start gap-2 rounded-xl bg-rose-500/12 border border-rose-500/30 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{importError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setImportModalOpen(false)}
              className="px-4 py-2 rounded-xl glass-subsurface text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer shadow-sm"
            >
              Lưu &amp; Chạy ứng dụng
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: View / Download HTML Source */}
      <Modal
        isOpen={Boolean(sourceModalModule)}
        onClose={() => setSourceModalModule(null)}
        title={sourceModalModule ? `Mã nguồn: ${sourceModalModule.fileName}` : 'Mã nguồn HTML'}
        description={sourceModalModule?.title}
        maxWidth="3xl"
      >
        {sourceModalModule && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Môn: <strong>{getSubjectById(sourceModalModule.subjectId).name}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopySource()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-subsurface text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedSource ? 'Đã chép' : 'Sao chép HTML'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleDownloadModuleHtml(sourceModalModule)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải xuống .html</span>
                </button>
              </div>
            </div>

            <pre className="max-h-[420px] overflow-auto rounded-2xl bg-slate-950 text-slate-100 p-4 text-[11px] font-mono-tabular leading-relaxed border border-slate-800">
              {sourceLoading ? 'Đang đọc tệp HTML...' : sourcePreviewText}
            </pre>
          </div>
        )}
      </Modal>
    </>
  );
};
