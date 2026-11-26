import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  Landmark,
  Plus,
  Search,
  Trash2,
  Upload,
} from '../icons/UiIcons';
import { ATLAS_ERAS } from '../../data/historySeed';
import type {
  ArchiveCategory,
  HistoryEvent,
  HistoryGradeLevel,
  HistoryPeriodId,
  HistoryQuestion,
  HistoryRegionId,
  HistoryStoreState,
  PracticeAnswerValue,
} from '../../types/history';
import {
  ARCHIVE_CATEGORY_LABELS,
  PERIOD_LABELS,
  QUESTION_TYPE_LABELS,
  REGION_LABELS,
  addCrossLinkedEvent,
  addCrossLinkedLesson,
  filterArchiveItems,
  filterEvents,
  filterLessons,
  getRelatedEventsForEvent,
  gradePracticeQuiz,
  loadHistoryStore,
  saveHistoryStore,
} from '../../utils/historyEngine';
import {
  createEmptyHistoryState,
  stripBuiltinHistoryItems,
} from '../../utils/subjects/subjectDataStore';
import { Modal } from '../common/Modal';
import {
  SubjectEmptyState,
  SubjectWorkspaceShell,
  type GeneratedAiQuizItem,
  type SubjectHostWorkspaceProps,
} from './SubjectWorkspaceShared';

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không thể đọc tệp đã chọn.'));
    reader.readAsDataURL(file);
  });
}

export const HistorySubjectView: React.FC<SubjectHostWorkspaceProps> = (props) => {
  const userId = props.currentUser.id;
  const [subTab, setSubTab] = useState<string>(props.initialSubTab || 'lessons');
  const [store, setStore] = useState<HistoryStoreState>(() =>
    stripBuiltinHistoryItems(loadHistoryStore(createEmptyHistoryState(), userId))
  );

  useEffect(() => {
    setStore(stripBuiltinHistoryItems(loadHistoryStore(createEmptyHistoryState(), userId)));
  }, [userId]);

  // Lessons tab
  const [lessonSearch, setLessonSearch] = useState('');
  const [lessonPeriod, setLessonPeriod] = useState('all');
  const [lessonGrade, setLessonGrade] = useState('all');
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [lessonReaderTab, setLessonReaderTab] = useState<'overview' | 'steps' | 'notes'>('overview');
  const [docBusy, setDocBusy] = useState(false);
  const [docNotice, setDocNotice] = useState<string | null>(null);

  // Add Lesson modal
  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [lTitle, setLTitle] = useState('');
  const [lGrade, setLGrade] = useState<HistoryGradeLevel>('Lớp 12');
  const [lPeriod, setLPeriod] = useState<HistoryPeriodId>('modern');
  const [lRegion, setLRegion] = useState<HistoryRegionId>('vietnam');
  const [lEraLabel, setLEraLabel] = useState('');
  const [lContext, setLContext] = useState('');
  const [lSteps, setLSteps] = useState('');
  const [lSignificance, setLSignificance] = useState('');

  // Timeline tab
  const [tlPeriod, setTlPeriod] = useState('all');
  const [tlRegion, setTlRegion] = useState('all');
  const [tlSearch, setTlSearch] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eTitle, setETitle] = useState('');
  const [eDateLabel, setEDateLabel] = useState('');
  const [ePeriod, setEPeriod] = useState<HistoryPeriodId>('modern');
  const [eRegion, setERegion] = useState<HistoryRegionId>('vietnam');
  const [eCountry, setECountry] = useState('Việt Nam');
  const [eDevelopments, setEDevelopments] = useState('');
  const [eSignificance, setESignificance] = useState('');

  // Atlas tab
  const [atlasScope, setAtlasScope] = useState<'vietnam' | 'world'>('vietnam');
  const [selectedEraId, setSelectedEraId] = useState(ATLAS_ERAS[0]?.id || 'vn-ancient');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [locModalOpen, setLocModalOpen] = useState(false);
  const [locName, setLocName] = useState('');
  const [locModern, setLocModern] = useState('');
  const [locSummary, setLocSummary] = useState('');
  const [locX, setLocX] = useState(190);
  const [locY, setLocY] = useState(120);

  // Archive + Wikipedia tab
  const [archiveCategory, setArchiveCategory] = useState('all');
  const [archiveSearch, setArchiveSearch] = useState('');
  const [wikiOpen, setWikiOpen] = useState(false);
  const [wikiQuery, setWikiQuery] = useState('');
  const [wikiLoading, setWikiLoading] = useState(false);
  const [wikiError, setWikiError] = useState<string | null>(null);
  const [wikiResult, setWikiResult] = useState<{
    title: string;
    extract: string;
    thumbnailUrl?: string;
    pageUrl: string;
  } | null>(null);
  const [arcModalOpen, setArcModalOpen] = useState(false);
  const [aTitle, setATitle] = useState('');
  const [aCat, setACat] = useState<ArchiveCategory>('document');
  const [aYear, setAYear] = useState('');
  const [aExcerpt, setAExcerpt] = useState('');
  const [aProvenance, setAProvenance] = useState('');

  // Practice quiz tab
  const [quizTypeFilter, setQuizTypeFilter] = useState('all');
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, PracticeAnswerValue>>({});
  const [quizResult, setQuizResult] = useState<ReturnType<typeof gradePracticeQuiz> | null>(null);
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [qPrompt, setQPrompt] = useState('');
  const [qOptA, setQOptA] = useState('');
  const [qOptB, setQOptB] = useState('');
  const [qOptC, setQOptC] = useState('');
  const [qOptD, setQOptD] = useState('');
  const [qCorrectIdx, setQCorrectIdx] = useState(0);
  const [qExplain, setQExplain] = useState('');

  const updateAndPersistStore = (updater: (prev: HistoryStoreState) => HistoryStoreState) => {
    setStore((prev) => {
      const next = updater(prev);
      saveHistoryStore(next, userId);
      return next;
    });
  };

  const filteredLessons = useMemo(
    () =>
      filterLessons(store.lessons, {
        grade: lessonGrade,
        period: lessonPeriod,
        search: lessonSearch,
      }),
    [lessonGrade, lessonPeriod, lessonSearch, store.lessons]
  );

  const activeLesson = useMemo(
    () =>
      store.lessons.find((l) => l.id === selectedLessonId) ||
      filteredLessons[0] ||
      store.lessons[0],
    [filteredLessons, selectedLessonId, store.lessons]
  );

  const filteredEvents = useMemo(
    () =>
      filterEvents(store.events, {
        period: tlPeriod,
        region: tlRegion,
        search: tlSearch,
      }),
    [store.events, tlPeriod, tlRegion, tlSearch]
  );

  const activeEvent = useMemo(
    () =>
      store.events.find((e) => e.id === selectedEventId) ||
      filteredEvents[0] ||
      store.events[0],
    [filteredEvents, selectedEventId, store.events]
  );

  const relatedEvents = useMemo(
    () => (activeEvent ? getRelatedEventsForEvent(activeEvent.id, store.events) : []),
    [activeEvent, store.events]
  );

  const scopeEras = useMemo(() => ATLAS_ERAS.filter((e) => e.scope === atlasScope), [atlasScope]);
  const activeEra = useMemo(
    () => scopeEras.find((e) => e.id === selectedEraId) || scopeEras[0],
    [scopeEras, selectedEraId]
  );

  const scopeLocations = useMemo(
    () => store.atlasLocations.filter((loc) => loc.scope === atlasScope),
    [atlasScope, store.atlasLocations]
  );

  const activeLocation = useMemo(
    () => scopeLocations.find((l) => l.id === selectedLocationId) || scopeLocations[0],
    [scopeLocations, selectedLocationId]
  );

  const filteredArchive = useMemo(
    () =>
      filterArchiveItems(store.archiveItems, {
        category: archiveCategory,
        search: archiveSearch,
      }),
    [archiveCategory, archiveSearch, store.archiveItems]
  );

  const filteredQuestions = useMemo(
    () =>
      store.questions.filter((q) => quizTypeFilter === 'all' || q.type === quizTypeFilter),
    [quizTypeFilter, store.questions]
  );

  const handleCreateLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lTitle.trim()) return;
    const newId = `lesson-${Date.now().toString(36)}`;
    const steps = lSteps
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    updateAndPersistStore((prev) =>
      addCrossLinkedLesson(prev, {
        id: newId,
        title: lTitle.trim(),
        grade: lGrade,
        chapter: 'Bài học tự tạo',
        period: lPeriod,
        region: lRegion,
        topic: PERIOD_LABELS[lPeriod],
        eraLabel: lEraLabel.trim() || 'Mốc thời gian',
        summary: lContext.trim() || lTitle.trim(),
        context: lContext.trim(),
        causes: '',
        developments: steps,
        outcomes: '',
        significance: lSignificance.trim() || lTitle.trim(),
        lessonsLearned: '',
        keyFigures: [],
        linkedLocationIds: [],
        linkedArchiveIds: [],
        primarySourceQuote: { text: lTitle.trim(), attribution: lEraLabel.trim() || 'Tự tạo' },
        source: 'custom',
      })
    );
    setSelectedLessonId(newId);
    setLTitle('');
    setLEraLabel('');
    setLContext('');
    setLSteps('');
    setLSignificance('');
    setLessonModalOpen(false);
  };

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eTitle.trim() || !eDateLabel.trim()) return;
    const evId = `ev-${Date.now().toString(36)}`;
    updateAndPersistStore((prev) =>
      addCrossLinkedEvent(prev, {
        id: evId,
        title: eTitle.trim(),
        dateLabel: eDateLabel.trim(),
        period: ePeriod,
        region: eRegion,
        country: eCountry.trim() || 'Việt Nam',
        topic: PERIOD_LABELS[ePeriod],
        keyFigures: [],
        context: '',
        developments: eDevelopments.trim(),
        outcomes: eSignificance.trim(),
        significance: eSignificance.trim(),
        relatedEventIds: [],
        linkedArchiveIds: [],
        source: 'custom',
      })
    );
    setSelectedEventId(evId);
    setETitle('');
    setEDateLabel('');
    setEDevelopments('');
    setESignificance('');
    setEventModalOpen(false);
  };

  const handleCreateLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!locName.trim()) return;
    const id = `loc-${Date.now().toString(36)}`;
    updateAndPersistStore((prev) => ({
      ...prev,
      atlasLocations: [
        {
          id,
          name: locName.trim(),
          modernLocation: locModern.trim() || locName.trim(),
          scope: atlasScope,
          eraIds: activeEra ? [activeEra.id] : [],
          x: Number(locX) || 180,
          y: Number(locY) || 140,
          summary: locSummary.trim(),
          historicalChanges: '',
          linkedLessonIds: [],
          linkedEventIds: [],
        },
        ...prev.atlasLocations,
      ],
    }));
    setSelectedLocationId(id);
    setLocName('');
    setLocModern('');
    setLocSummary('');
    setLocModalOpen(false);
  };

  const handleCreateArchive = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aTitle.trim()) return;
    updateAndPersistStore((prev) => ({
      ...prev,
      archiveItems: [
        {
          id: `arc-${Date.now().toString(36)}`,
          title: aTitle.trim(),
          category: aCat,
          period: 'modern',
          topic: 'Tư liệu',
          country: 'Việt Nam',
          figures: [],
          yearLabel: aYear.trim() || '—',
          transcriptOrExcerpt: aExcerpt.trim(),
          provenance: aProvenance.trim() || 'Tự lưu',
          curatorialNote: '',
          linkedLessonIds: [],
          linkedEventIds: [],
          source: 'custom',
        },
        ...prev.archiveItems,
      ],
    }));
    setATitle('');
    setAYear('');
    setAExcerpt('');
    setAProvenance('');
    setArcModalOpen(false);
  };

  const handleCreateQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    const opts = [qOptA, qOptB, qOptC, qOptD].map((s) => s.trim()).filter(Boolean);
    if (!qPrompt.trim() || opts.length < 2) return;
    updateAndPersistStore((prev) => ({
      ...prev,
      questions: [
        {
          id: `hq-${Date.now().toString(36)}`,
          chapter: 'Tự tạo',
          topic: 'Lịch sử',
          period: 'modern',
          type: 'mcq',
          prompt: qPrompt.trim(),
          options: opts,
          correctIndex: Math.min(qCorrectIdx, opts.length - 1),
          explanation: qExplain.trim(),
          sourceRef: 'Cá nhân',
          source: 'custom',
        },
        ...prev.questions,
      ],
    }));
    setQPrompt('');
    setQOptA('');
    setQOptB('');
    setQOptC('');
    setQOptD('');
    setQExplain('');
    setQuizModalOpen(false);
  };

  const handleUploadHistoryDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setDocBusy(true);
    setDocNotice(null);
    try {
      const fileBase64 = await readFileAsBase64(file);
      const res = await fetch('/api/history/parse-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, fileBase64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Không thể đọc tài liệu.');
      const text = String(data.text || '').trim();
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const title = file.name.replace(/\.[^.]+$/, '');
      const newLessonId = `lesson-up-${Date.now().toString(36)}`;
      updateAndPersistStore((prev) =>
        addCrossLinkedLesson(prev, {
          id: newLessonId,
          title,
          grade: 'Lớp 12',
          chapter: 'Tài liệu nhập',
          period: 'modern',
          region: 'vietnam',
          topic: 'Lịch sử',
          eraLabel: 'Tư liệu',
          summary: lines.slice(0, 2).join(' ').slice(0, 180) || title,
          context: lines[0] || '',
          causes: '',
          developments: lines.slice(0, 10),
          outcomes: lines[lines.length - 1] || '',
          significance: lines[0] || title,
          lessonsLearned: '',
          keyFigures: [],
          linkedLocationIds: [],
          linkedArchiveIds: [],
          primarySourceQuote: { text: lines[0] || title, attribution: file.name },
          source: 'imported',
        })
      );
      setSelectedLessonId(newLessonId);
      setDocNotice(`Đã tạo bài học "${title}".`);
    } catch (err) {
      setDocNotice(err instanceof Error ? err.message : 'Lỗi đọc tài liệu.');
    } finally {
      setDocBusy(false);
    }
  };

  const handleWikiHistorySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = wikiQuery.trim();
    if (!q) return;
    setWikiLoading(true);
    setWikiError(null);
    try {
      const res = await fetch(
        `/api/external/wikipedia?q=${encodeURIComponent(q)}&lang=vi&context=history`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Không tìm thấy Wikipedia.');
      setWikiResult(data.summary);
    } catch (err) {
      setWikiError(err instanceof Error ? err.message : 'Lỗi tra cứu.');
    } finally {
      setWikiLoading(false);
    }
  };

  const handleSaveWikiToArchive = () => {
    if (!wikiResult) return;
    updateAndPersistStore((prev) => ({
      ...prev,
      archiveItems: [
        {
          id: `arc-wiki-${Date.now().toString(36)}`,
          title: wikiResult.title,
          category: 'document',
          period: 'modern',
          topic: 'Wikipedia',
          country: 'Thế giới',
          figures: [],
          yearLabel: 'Mở',
          imageUrl: wikiResult.thumbnailUrl,
          transcriptOrExcerpt: wikiResult.extract,
          provenance: wikiResult.pageUrl,
          curatorialNote: '',
          linkedLessonIds: [],
          linkedEventIds: [],
          source: 'custom',
        },
        ...prev.archiveItems,
      ],
    }));
  };

  const getOrderList = (q: HistoryQuestion): string[] => {
    const existing = practiceAnswers[q.id];
    if (existing && existing.type === 'order') return existing.orderedIds;
    return [...(q.orderItems || [])]
      .sort((a, b) => b.year - a.year)
      .map((item) => item.id);
  };

  const moveOrderItem = (q: HistoryQuestion, idx: number, dir: -1 | 1) => {
    const current = [...getOrderList(q)];
    const target = idx + dir;
    if (target < 0 || target >= current.length) return;
    const [removed] = current.splice(idx, 1);
    current.splice(target, 0, removed);
    setPracticeAnswers((prev) => ({
      ...prev,
      [q.id]: { type: 'order', orderedIds: current },
    }));
  };

  const handleSubmitHistoryQuiz = () => {
    if (filteredQuestions.length === 0) return;
    const hydratedAnswers: Record<string, PracticeAnswerValue> = { ...practiceAnswers };
    filteredQuestions.forEach((q) => {
      if (q.type === 'order' && !hydratedAnswers[q.id]) {
        hydratedAnswers[q.id] = { type: 'order', orderedIds: getOrderList(q) };
      }
    });
    const graded = gradePracticeQuiz(filteredQuestions, hydratedAnswers);
    setQuizResult(graded);
    if (graded.maxScore > 0) {
      props.onRecordPracticeResult(
        graded.score,
        graded.maxScore,
        `Lịch Sử (${graded.percentage}%)`
      );
    }
  };

  const handleInjectAiQuiz = (items: GeneratedAiQuizItem[]) => {
    const newQuestions: HistoryQuestion[] = items.map((g, i) => ({
      id: `hq-ai-${Date.now()}-${i}`,
      chapter: 'AI',
      topic: g.topic || 'Lịch sử',
      period: 'modern',
      type: 'mcq',
      prompt: g.question,
      options: g.options,
      correctIndex: g.correctIndex,
      explanation: g.explanation,
      sourceRef: 'AI',
      source: 'custom',
    }));
    updateAndPersistStore((prev) => ({
      ...prev,
      questions: [...newQuestions, ...prev.questions],
    }));
    setQuizResult(null);
    setSubTab('practice');
  };

  const liveContextSummary = useMemo(() => {
    if (subTab === 'timeline' && activeEvent) {
      return `Sự kiện "${activeEvent.title}" (${activeEvent.dateLabel}, ${activeEvent.country}).`;
    }
    if (activeLesson) {
      return `Bài học Lịch sử: "${activeLesson.title}" (${activeLesson.eraLabel}).`;
    }
    return `Lịch sử: ${store.lessons.length} bài học, ${store.events.length} sự kiện.`;
  }, [activeEvent, activeLesson, store.events.length, store.lessons.length, subTab]);

  return (
    <SubjectWorkspaceShell
      {...props}
      activeSubTab={subTab}
      onChangeSubTab={setSubTab}
      liveContextSummary={liveContextSummary}
      excelModuleKey="history"
      excelExportRecords={store.lessons.map((l) => ({
        TieuDe: l.title,
        Lop: l.grade,
        ThoiKy: PERIOD_LABELS[l.period],
        NienDai: l.eraLabel,
        YNghia: l.significance,
      }))}
      onImportExcelRows={(rows) => {
        const importedLessons = rows.filter((r) => String(r.TieuDe || r.Title || '').trim());
        if (importedLessons.length > 0) {
          updateAndPersistStore((prev) => {
            let next = prev;
            importedLessons.forEach((r) => {
              next = addCrossLinkedLesson(next, {
                title: String(r.TieuDe || r.Title),
                grade: 'Lớp 12',
                chapter: String(r.Chuong || 'Excel'),
                period: 'modern',
                region: 'vietnam',
                topic: String(r.ChuDe || 'Lịch sử'),
                eraLabel: String(r.NienDai || 'Thế kỷ XX'),
                summary: String(r.TomTat || r.BoiCanh || ''),
                context: String(r.BoiCanh || ''),
                causes: String(r.NguyenNhan || ''),
                developments: [String(r.DienBien || '')].filter(Boolean),
                outcomes: String(r.KetQua || ''),
                significance: String(r.YNghia || ''),
                lessonsLearned: String(r.BaiHoc || ''),
                keyFigures: [],
                linkedLocationIds: [],
                linkedArchiveIds: [],
                primarySourceQuote: { text: String(r.TieuDe || ''), attribution: 'Excel' },
                source: 'imported',
              });
            });
            return next;
          });
        }
      }}
      onInjectGeneratedQuiz={handleInjectAiQuiz}
    >
      {subTab === 'lessons' && (
        <div className="space-y-3" data-testid="history-lessons-panel">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[200px]">
              <div className="relative flex-1 min-w-[160px] max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={lessonSearch}
                  onChange={(e) => setLessonSearch(e.target.value)}
                  placeholder="Tìm bài học, nhân vật…"
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl glass-subsurface text-xs text-slate-900 dark:text-white"
                />
              </div>
              <select
                value={lessonGrade}
                onChange={(e) => setLessonGrade(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl glass-subsurface text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                <option value="all">Tất cả lớp</option>
                <option value="Lớp 10">Lớp 10</option>
                <option value="Lớp 11">Lớp 11</option>
                <option value="Lớp 12">Lớp 12</option>
              </select>
              <select
                value={lessonPeriod}
                onChange={(e) => setLessonPeriod(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl glass-subsurface text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                <option value="all">Mọi thời kỳ</option>
                {(Object.keys(PERIOD_LABELS) as Array<keyof typeof PERIOD_LABELS>).map((p) => (
                  <option key={p} value={p}>
                    {PERIOD_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="history-add-lesson-btn"
                onClick={() => setLessonModalOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm bài học</span>
              </button>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-subsurface text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer whitespace-nowrap shrink-0">
                <Upload className="w-3.5 h-3.5" />
                <span>{docBusy ? 'Đang nhập…' : 'Nhập Word / PDF'}</span>
                <input
                  type="file"
                  accept=".docx,.pdf,.txt,.md"
                  onChange={handleUploadHistoryDoc}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {docNotice && (
            <div className="px-3 py-2 rounded-xl bg-emerald-500/15 text-xs text-emerald-700 dark:text-emerald-300">
              {docNotice}
            </div>
          )}

          {store.lessons.length === 0 ? (
            <SubjectEmptyState
              testId="history-lessons-empty"
              title="Chưa có bài học Lịch sử nào."
              actions={[
                { label: '+ Thêm bài học', onClick: () => setLessonModalOpen(true), primary: true },
                { label: 'Mở Lược đồ', onClick: () => setSubTab('atlas') },
                { label: 'Hỏi Gia sư AI', onClick: () => setSubTab('ai-tutor') },
              ]}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-4 space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
                {filteredLessons.map((lesson) => {
                  const selected = activeLesson?.id === lesson.id;
                  const mastered = props.progress.masteredIds.includes(lesson.id);
                  return (
                    <div
                      key={lesson.id}
                      onClick={() => setSelectedLessonId(lesson.id)}
                      className={`p-3 rounded-2xl transition-all cursor-pointer flex items-start justify-between gap-2 ${
                        selected
                          ? 'liquid-glass-panel ring-2 ring-amber-500/60'
                          : 'glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/80'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 truncate">
                          {PERIOD_LABELS[lesson.period]} · {lesson.eraLabel}
                        </p>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                          {lesson.title}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {mastered && (
                          <span className="p-1 rounded-lg bg-emerald-500/15 text-emerald-600">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateAndPersistStore((prev) => ({
                              ...prev,
                              lessons: prev.lessons.filter((l) => l.id !== lesson.id),
                            }));
                          }}
                          className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="lg:col-span-8">
                {activeLesson && (
                  <div className="liquid-glass-panel rounded-2xl p-4 sm:p-5 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                          {activeLesson.grade} · {activeLesson.eraLabel}
                        </p>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                          {activeLesson.title}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => props.onToggleMastered(activeLesson.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                          props.progress.masteredIds.includes(activeLesson.id)
                            ? 'bg-emerald-600 text-white'
                            : 'glass-subsurface text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>
                          {props.progress.masteredIds.includes(activeLesson.id)
                            ? 'Đã nắm'
                            : 'Đánh dấu'}
                        </span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1 border-b border-slate-900/10 dark:border-white/10 pb-2">
                      {[
                        { id: 'overview' as const, label: 'Tổng quan' },
                        { id: 'steps' as const, label: 'Diễn biến' },
                        { id: 'notes' as const, label: 'Tư liệu & Ghi chú' },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setLessonReaderTab(tab.id)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                            lessonReaderTab === tab.id
                              ? 'bg-amber-700 text-white'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-white/40 dark:hover:bg-white/5'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {lessonReaderTab === 'overview' && (
                      <div className="space-y-3 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                        {activeLesson.context && (
                          <div>
                            <p className="text-[11px] font-bold text-slate-500">Bối cảnh</p>
                            <p>{activeLesson.context} {activeLesson.causes}</p>
                          </div>
                        )}
                        {activeLesson.significance && (
                          <div>
                            <p className="text-[11px] font-bold text-slate-500">Ý nghĩa</p>
                            <p>{activeLesson.outcomes} <strong>{activeLesson.significance}</strong></p>
                          </div>
                        )}
                      </div>
                    )}

                    {lessonReaderTab === 'steps' && (
                      <ul className="space-y-1.5 text-xs text-slate-800 dark:text-slate-200">
                        {activeLesson.developments.length === 0 ? (
                          <li className="text-slate-500">Chưa có diễn biến chi tiết.</li>
                        ) : (
                          activeLesson.developments.map((step, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="font-mono-tabular font-bold text-amber-700 dark:text-amber-300">
                                {i + 1}.
                              </span>
                              <span>{step}</span>
                            </li>
                          ))
                        )}
                      </ul>
                    )}

                    {lessonReaderTab === 'notes' && (
                      <div className="space-y-3">
                        {activeLesson.primarySourceQuote.text && (
                          <blockquote className="rounded-xl bg-amber-500/10 p-3 text-xs italic text-slate-800 dark:text-amber-100">
                            "{activeLesson.primarySourceQuote.text}"
                            <footer className="not-italic text-[11px] font-semibold text-amber-700 dark:text-amber-300 mt-1">
                              — {activeLesson.primarySourceQuote.attribution}
                            </footer>
                          </blockquote>
                        )}
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                            <Bookmark className="w-3.5 h-3.5 text-amber-600" />
                            <span>Ghi chú cá nhân</span>
                          </label>
                          <textarea
                            rows={4}
                            value={props.progress.notesByItemId[activeLesson.id] || ''}
                            onChange={(e) => props.onSaveStudyNote(activeLesson.id, e.target.value)}
                            placeholder="Ghi chú mốc năm, điểm liên hệ…"
                            className="w-full px-3 py-2 rounded-xl glass-subsurface text-xs text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === 'timeline' && (
        <div className="space-y-3" data-testid="history-timeline-panel">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[200px]">
              <div className="relative flex-1 min-w-[160px] max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={tlSearch}
                  onChange={(e) => setTlSearch(e.target.value)}
                  placeholder="Tìm sự kiện, năm…"
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl glass-subsurface text-xs text-slate-900 dark:text-white"
                />
              </div>
              <select
                value={tlPeriod}
                onChange={(e) => setTlPeriod(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl glass-subsurface text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                <option value="all">Mọi thời kỳ</option>
                {(Object.keys(PERIOD_LABELS) as Array<keyof typeof PERIOD_LABELS>).map((p) => (
                  <option key={p} value={p}>
                    {PERIOD_LABELS[p]}
                  </option>
                ))}
              </select>
              <select
                value={tlRegion}
                onChange={(e) => setTlRegion(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl glass-subsurface text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                <option value="all">Mọi khu vực</option>
                {(Object.keys(REGION_LABELS) as Array<keyof typeof REGION_LABELS>).map((r) => (
                  <option key={r} value={r}>
                    {REGION_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setEventModalOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm sự kiện</span>
            </button>
          </div>

          {store.events.length === 0 ? (
            <SubjectEmptyState
              testId="history-timeline-empty"
              title="Chưa có sự kiện nào trên dòng thời gian."
              actions={[
                { label: '+ Thêm sự kiện', onClick: () => setEventModalOpen(true), primary: true },
                { label: '+ Thêm bài học', onClick: () => setLessonModalOpen(true) },
              ]}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-6 space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
                {filteredEvents.map((ev: HistoryEvent) => (
                  <div
                    key={ev.id}
                    onClick={() => setSelectedEventId(ev.id)}
                    className={`p-3 rounded-2xl transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      activeEvent?.id === ev.id
                        ? 'liquid-glass-panel ring-2 ring-amber-500/60'
                        : 'glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 font-mono-tabular">
                        <Clock className="w-3 h-3" />
                        <span>{ev.dateLabel}</span>
                        <span>·</span>
                        <span>{ev.country}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                        {ev.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateAndPersistStore((prev) => ({
                            ...prev,
                            events: prev.events.filter((item) => item.id !== ev.id),
                          }));
                        }}
                        className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="lg:col-span-6">
                {activeEvent && (
                  <div className="liquid-glass-panel rounded-2xl p-4 space-y-3">
                    <div>
                      <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 font-mono-tabular">
                        {activeEvent.dateLabel} · {REGION_LABELS[activeEvent.region]} ({activeEvent.country})
                      </span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                        {activeEvent.title}
                      </h3>
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-200 space-y-1.5 leading-relaxed">
                      {activeEvent.context && <p><strong>Bối cảnh:</strong> {activeEvent.context}</p>}
                      {activeEvent.developments && <p><strong>Diễn biến:</strong> {activeEvent.developments}</p>}
                      {activeEvent.significance && <p><strong>Ý nghĩa:</strong> {activeEvent.significance}</p>}
                    </div>
                    {relatedEvents.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-slate-900/10 dark:border-white/10">
                        <p className="text-[11px] font-bold text-slate-500">Sự kiện liên kết</p>
                        {relatedEvents.map(({ event, relationLabel }) => (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() => setSelectedEventId(event.id)}
                            className="w-full text-left p-2 rounded-xl glass-subsurface cursor-pointer text-xs"
                          >
                            <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 block">
                              {relationLabel} · {event.dateLabel}
                            </span>
                            <strong className="text-slate-900 dark:text-white">{event.title}</strong>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === 'atlas' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3" data-testid="history-atlas-panel">
          <div className="lg:col-span-7 liquid-glass-panel rounded-2xl p-4 space-y-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1.5">
                  {(['vietnam', 'world'] as const).map((sc) => (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => {
                        setAtlasScope(sc);
                        const first = ATLAS_ERAS.find((e) => e.scope === sc);
                        if (first) setSelectedEraId(first.id);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                        atlasScope === sc ? 'bg-amber-700 text-white' : 'glass-subsurface text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {sc === 'vietnam' ? 'Việt Nam' : 'Thế giới'}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setLocModalOpen(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-700 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ghim địa danh</span>
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {scopeEras.map((era) => (
                  <button
                    key={era.id}
                    type="button"
                    onClick={() => setSelectedEraId(era.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                      activeEra?.id === era.id
                        ? 'bg-slate-900 dark:bg-amber-600 text-white'
                        : 'glass-subsurface text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {era.label}
                  </button>
                ))}
              </div>
            </div>

            {activeEra && (
              <div className="glass-subsurface rounded-xl p-2">
                <svg
                  viewBox={atlasScope === 'vietnam' ? '60 20 260 500' : '40 40 540 240'}
                  className="w-full h-72 rounded-xl bg-amber-50/70 dark:bg-slate-900/70"
                >
                  {activeEra.territories.map((t) => (
                    <g key={t.id}>
                      <path d={t.pathD} fill={t.fill} stroke={t.stroke} strokeWidth={2} />
                      <text x={t.labelX} y={t.labelY} textAnchor="middle" fontSize={10} fontWeight={700} className="fill-slate-800 dark:fill-amber-100">
                        {t.name.split('(')[0].trim()}
                      </text>
                    </g>
                  ))}
                  {scopeLocations.map((loc) => {
                    const isActive = activeLocation?.id === loc.id;
                    return (
                      <g key={loc.id} onClick={() => setSelectedLocationId(loc.id)} className="cursor-pointer">
                        <circle cx={loc.x} cy={loc.y} r={isActive ? 8 : 5.5} fill={isActive ? '#B45309' : '#1E293B'} stroke="#FFFFFF" strokeWidth={1.8} />
                        <text x={loc.x + 9} y={loc.y + 3} fontSize={9} fontWeight={600} className="fill-slate-800 dark:fill-slate-100">
                          {loc.name}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 space-y-3">
            {activeEra && (
              <div className="liquid-glass-panel rounded-2xl p-4 space-y-1.5">
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 font-mono-tabular">
                  {activeEra.dateRange}
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{activeEra.label}</h3>
                <p className="text-xs text-slate-700 dark:text-slate-200">{activeEra.summary}</p>
              </div>
            )}

            {activeLocation ? (
              <div className="liquid-glass-panel rounded-2xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-amber-700 dark:text-amber-300" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{activeLocation.name}</h4>
                      <p className="text-[11px] text-slate-500">{activeLocation.modernLocation}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateAndPersistStore((prev) => ({
                        ...prev,
                        atlasLocations: prev.atlasLocations.filter((l) => l.id !== activeLocation.id),
                      }))
                    }
                    className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {activeLocation.summary && (
                  <p className="text-xs text-slate-700 dark:text-slate-200">{activeLocation.summary}</p>
                )}
              </div>
            ) : (
              <div className="liquid-glass-panel rounded-2xl p-4 text-center space-y-2">
                <p className="text-xs text-slate-500">Chưa ghim địa danh lịch sử nào.</p>
                <button
                  type="button"
                  onClick={() => setLocModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-700 text-white text-xs font-semibold cursor-pointer"
                >
                  + Ghim địa danh
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'archive' && (
        <div className="space-y-3" data-testid="history-archive-panel">
          <div className="liquid-glass-panel rounded-2xl p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setArchiveCategory('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                    archiveCategory === 'all' ? 'bg-amber-700 text-white' : 'glass-subsurface text-slate-700 dark:text-slate-200'
                  }`}
                >
                  Tất cả{store.archiveItems.length > 0 ? ` (${store.archiveItems.length})` : ''}
                </button>
                {(Object.keys(ARCHIVE_CATEGORY_LABELS) as Array<keyof typeof ARCHIVE_CATEGORY_LABELS>).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setArchiveCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                      archiveCategory === cat ? 'bg-amber-700 text-white' : 'glass-subsurface text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {ARCHIVE_CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={archiveSearch}
                  onChange={(e) => setArchiveSearch(e.target.value)}
                  placeholder="Lọc tư liệu…"
                  className="px-3 py-1.5 rounded-xl glass-subsurface text-xs text-slate-900 dark:text-white w-40"
                />
                <button
                  type="button"
                  onClick={() => setWikiOpen((v) => !v)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                    wikiOpen ? 'bg-slate-900 dark:bg-slate-700 text-white' : 'glass-subsurface text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Tra Wikipedia</span>
                </button>
                <button
                  type="button"
                  onClick={() => setArcModalOpen(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-700 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm tư liệu</span>
                </button>
              </div>
            </div>

            {(wikiOpen || wikiResult) && (
              <div className="space-y-2.5 pt-2.5 border-t border-slate-900/10 dark:border-white/10">
                <form onSubmit={handleWikiHistorySearch} className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={wikiQuery}
                    onChange={(e) => setWikiQuery(e.target.value)}
                    placeholder="Tra cứu Wikipedia Lịch sử…"
                    className="flex-1 min-w-[200px] px-3 py-1.5 rounded-xl glass-subsurface text-xs text-slate-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={wikiLoading || !wikiQuery.trim()}
                    className="px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {wikiLoading ? 'Đang tìm…' : 'Tìm'}
                  </button>
                </form>
                {wikiError && <p className="text-xs text-rose-600">{wikiError}</p>}
                {wikiResult && (
                  <div className="glass-subsurface rounded-xl p-3 flex flex-col sm:flex-row gap-3 items-start">
                    {wikiResult.thumbnailUrl && (
                      <img src={wikiResult.thumbnailUrl} alt={wikiResult.title} className="w-20 h-20 rounded-lg object-cover shrink-0" />
                    )}
                    <div className="flex-1 space-y-1.5 text-xs">
                      <h4 className="font-bold text-slate-900 dark:text-white">{wikiResult.title}</h4>
                      <p className="text-slate-700 dark:text-slate-200 line-clamp-3">{wikiResult.extract}</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleSaveWikiToArchive}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Lưu tư liệu</span>
                        </button>
                        <a
                          href={wikiResult.pageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg glass-subsurface text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0"
                        >
                          <span>Wikipedia</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {filteredArchive.length === 0 ? (
            <SubjectEmptyState
              testId="history-archive-empty"
              title="Chưa có tư liệu hay hiện vật nào."
              actions={[
                { label: '+ Thêm tư liệu', onClick: () => setArcModalOpen(true), primary: true },
                { label: 'Tra Wikipedia', onClick: () => setWikiOpen(true) },
              ]}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredArchive.map((item) => (
                <div key={item.id} className="liquid-glass-panel rounded-2xl overflow-hidden flex flex-col">
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt={item.title} className="w-full h-36 object-cover" />
                  )}
                  <div className="p-3.5 space-y-1.5 flex-1 flex flex-col">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                      <span>{ARCHIVE_CATEGORY_LABELS[item.category]} · {item.yearLabel}</span>
                      <button
                        type="button"
                        onClick={() =>
                          updateAndPersistStore((prev) => ({
                            ...prev,
                            archiveItems: prev.archiveItems.filter((a) => a.id !== item.id),
                          }))
                        }
                        className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">{item.title}</h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-3 flex-1">
                      {item.transcriptOrExcerpt}
                    </p>
                    <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-900/10 dark:border-white/10 truncate">
                      {item.provenance}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === 'practice' && (
        <div className="space-y-3" data-testid="history-practice-panel">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setQuizTypeFilter('all')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                  quizTypeFilter === 'all' ? 'bg-amber-700 text-white' : 'glass-subsurface text-slate-700 dark:text-slate-200'
                }`}
              >
                Tất cả ({store.questions.length})
              </button>
              {(Object.keys(QUESTION_TYPE_LABELS) as Array<keyof typeof QUESTION_TYPE_LABELS>).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setQuizTypeFilter(t)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                    quizTypeFilter === t ? 'bg-amber-700 text-white' : 'glass-subsurface text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {QUESTION_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuizModalOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl glass-subsurface text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm câu hỏi</span>
              </button>
              {filteredQuestions.length > 0 && (
                <button
                  type="button"
                  onClick={handleSubmitHistoryQuiz}
                  className="px-4 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold cursor-pointer"
                >
                  Chấm bài
                </button>
              )}
            </div>
          </div>

          {quizResult && (
            <div className="liquid-glass-panel rounded-xl px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Kết quả: {quizResult.score}/{quizResult.maxScore} ({quizResult.percentage}%)
              </span>
              <button
                type="button"
                onClick={() => {
                  setQuizResult(null);
                  setPracticeAnswers({});
                }}
                className="text-xs font-semibold text-amber-700 dark:text-amber-300 cursor-pointer"
              >
                Làm lại
              </button>
            </div>
          )}

          {filteredQuestions.length === 0 ? (
            <SubjectEmptyState
              testId="history-practice-empty"
              title="Chưa có câu hỏi Lịch sử nào."
              actions={[
                { label: '+ Thêm câu hỏi', onClick: () => setQuizModalOpen(true), primary: true },
                { label: 'Tạo đề bằng AI', onClick: () => setSubTab('ai-tutor') },
              ]}
            />
          ) : (
            <div className="space-y-2.5">
              {filteredQuestions.map((q, idx) => {
                const ans = practiceAnswers[q.id];
                const resItem = quizResult?.results.find((r) => r.questionId === q.id);

                return (
                  <div key={q.id} className="liquid-glass-panel rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                      <span>Câu {idx + 1} · {QUESTION_TYPE_LABELS[q.type]}</span>
                      <div className="flex items-center gap-2">
                        {resItem && (
                          <span className="font-mono-tabular">
                            {resItem.earned}/{resItem.maxPoints} đ
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            updateAndPersistStore((prev) => ({
                              ...prev,
                              questions: prev.questions.filter((item) => item.id !== q.id),
                            }))
                          }
                          className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">{q.prompt}</p>
                    {q.sourceExcerpt && (
                      <blockquote className="rounded-xl bg-amber-500/10 p-2.5 text-xs italic text-slate-700 dark:text-amber-100">
                        {q.sourceExcerpt}
                      </blockquote>
                    )}

                    {(q.type === 'mcq' || q.type === 'reading') && q.options && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {q.options.map((opt, oIdx) => {
                          const selected =
                            ans && (ans.type === 'mcq' || ans.type === 'reading') && ans.selectedIndex === oIdx;
                          return (
                            <button
                              key={oIdx}
                              type="button"
                              onClick={() =>
                                setPracticeAnswers((p) => ({
                                  ...p,
                                  [q.id]: { type: q.type as 'mcq' | 'reading', selectedIndex: oIdx },
                                }))
                              }
                              className={`text-left px-3 py-2 rounded-xl text-xs cursor-pointer ${
                                quizResult
                                  ? q.correctIndex === oIdx
                                    ? 'bg-emerald-600 text-white'
                                    : selected
                                    ? 'bg-rose-600 text-white'
                                    : 'glass-subsurface opacity-60'
                                  : selected
                                  ? 'bg-amber-700 text-white font-semibold'
                                  : 'glass-subsurface text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              {String.fromCharCode(65 + oIdx)}. {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {q.type === 'tf' && q.tfStatements && (
                      <div className="space-y-1.5">
                        {q.tfStatements.map((st, sIdx) => {
                          const selections = ans && ans.type === 'tf' ? ans.selections : [];
                          const val = selections[sIdx];
                          return (
                            <div key={sIdx} className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl glass-subsurface text-xs">
                              <span className="flex-1 text-slate-800 dark:text-slate-200">{st.text}</span>
                              <div className="flex gap-1">
                                {[true, false].map((b) => (
                                  <button
                                    key={String(b)}
                                    type="button"
                                    onClick={() => {
                                      const nextArr = [...selections];
                                      nextArr[sIdx] = b;
                                      setPracticeAnswers((p) => ({ ...p, [q.id]: { type: 'tf', selections: nextArr } }));
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                                      val === b ? 'bg-amber-700 text-white' : 'glass-subsurface text-slate-600 dark:text-slate-300'
                                    }`}
                                  >
                                    {b ? 'Đúng' : 'Sai'}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {q.type === 'match' && q.matchPairs && (
                      <div className="space-y-1.5">
                        {q.matchPairs.map((pair, pIdx) => {
                          const mapping = ans && ans.type === 'match' ? ans.mapping : {};
                          return (
                            <div key={pIdx} className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center p-2 rounded-xl glass-subsurface text-xs">
                              <span className="font-medium text-slate-800 dark:text-slate-200">{pair.left}</span>
                              <select
                                value={mapping[pair.left] || ''}
                                onChange={(e) =>
                                  setPracticeAnswers((p) => ({
                                    ...p,
                                    [q.id]: { type: 'match', mapping: { ...mapping, [pair.left]: e.target.value } },
                                  }))
                                }
                                className="px-2.5 py-1.5 rounded-xl glass-subsurface text-xs text-slate-900 dark:text-white"
                              >
                                <option value="">-- Chọn mốc --</option>
                                {q.matchPairs?.map((opt) => (
                                  <option key={opt.right} value={opt.right}>{opt.right}</option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {q.type === 'order' && q.orderItems && (
                      <div className="space-y-1.5">
                        {getOrderList(q).map((itemId, oIdx, arr) => {
                          const item = q.orderItems?.find((it) => it.id === itemId);
                          if (!item) return null;
                          return (
                            <div key={itemId} className="flex items-center justify-between gap-2 p-2 rounded-xl glass-subsurface text-xs">
                              <span className="font-mono-tabular font-bold text-amber-700 w-5">{oIdx + 1}.</span>
                              <span className="flex-1 text-slate-800 dark:text-slate-200">{item.label}</span>
                              <div className="flex gap-1">
                                <button type="button" disabled={oIdx === 0} onClick={() => moveOrderItem(q, oIdx, -1)} className="px-2 py-0.5 rounded glass-subsurface text-[11px] disabled:opacity-30 cursor-pointer">↑</button>
                                <button type="button" disabled={oIdx === arr.length - 1} onClick={() => moveOrderItem(q, oIdx, 1)} className="px-2 py-0.5 rounded glass-subsurface text-[11px] disabled:opacity-30 cursor-pointer">↓</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {quizResult && q.explanation && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 pt-1">{q.explanation}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Thêm bài học */}
      <Modal isOpen={lessonModalOpen} onClose={() => setLessonModalOpen(false)} title="Thêm bài học Lịch sử" maxWidth="lg">
        <form onSubmit={handleCreateLesson} className="space-y-3 text-xs">
          <input type="text" required value={lTitle} onChange={(e) => setLTitle(e.target.value)} placeholder="Tên bài học / sự kiện chính" className="w-full rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white" />
          <div className="grid grid-cols-3 gap-2">
            <select value={lGrade} onChange={(e) => setLGrade(e.target.value as HistoryGradeLevel)} className="rounded-xl glass-subsurface px-2.5 py-2 text-slate-900 dark:text-white">
              <option value="Lớp 10">Lớp 10</option>
              <option value="Lớp 11">Lớp 11</option>
              <option value="Lớp 12">Lớp 12</option>
            </select>
            <select value={lPeriod} onChange={(e) => setLPeriod(e.target.value as HistoryPeriodId)} className="rounded-xl glass-subsurface px-2.5 py-2 text-slate-900 dark:text-white">
              {(Object.keys(PERIOD_LABELS) as HistoryPeriodId[]).map((p) => (
                <option key={p} value={p}>{PERIOD_LABELS[p]}</option>
              ))}
            </select>
            <input type="text" value={lEraLabel} onChange={(e) => setLEraLabel(e.target.value)} placeholder="Niên đại (vd: 1945)" className="rounded-xl glass-subsurface px-2.5 py-2 text-slate-900 dark:text-white" />
          </div>
          <select value={lRegion} onChange={(e) => setLRegion(e.target.value as HistoryRegionId)} className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white">
            {(Object.keys(REGION_LABELS) as HistoryRegionId[]).map((r) => (
              <option key={r} value={r}>{REGION_LABELS[r]}</option>
            ))}
          </select>
          <textarea rows={2} value={lContext} onChange={(e) => setLContext(e.target.value)} placeholder="Bối cảnh & nguyên nhân" className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          <textarea rows={3} value={lSteps} onChange={(e) => setLSteps(e.target.value)} placeholder="Diễn biến chính (mỗi dòng 1 ý)" className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          <input type="text" value={lSignificance} onChange={(e) => setLSignificance(e.target.value)} placeholder="Ý nghĩa lịch sử" className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setLessonModalOpen(false)} className="px-4 py-2 rounded-xl glass-subsurface font-semibold cursor-pointer">Đóng</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-amber-700 text-white font-semibold cursor-pointer">Lưu bài</button>
          </div>
        </form>
      </Modal>

      {/* Modal: Thêm sự kiện */}
      <Modal isOpen={eventModalOpen} onClose={() => setEventModalOpen(false)} title="Thêm mốc sự kiện" maxWidth="md">
        <form onSubmit={handleCreateEvent} className="space-y-3 text-xs">
          <input type="text" required value={eTitle} onChange={(e) => setETitle(e.target.value)} placeholder="Tên sự kiện" className="w-full rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white" />
          <div className="grid grid-cols-3 gap-2">
            <input type="text" required value={eDateLabel} onChange={(e) => setEDateLabel(e.target.value)} placeholder="Năm / Mốc" className="rounded-xl glass-subsurface px-2.5 py-2 text-slate-900 dark:text-white" />
            <select value={ePeriod} onChange={(e) => setEPeriod(e.target.value as HistoryPeriodId)} className="rounded-xl glass-subsurface px-2.5 py-2 text-slate-900 dark:text-white">
              {(Object.keys(PERIOD_LABELS) as HistoryPeriodId[]).map((p) => (
                <option key={p} value={p}>{PERIOD_LABELS[p]}</option>
              ))}
            </select>
            <select value={eRegion} onChange={(e) => setERegion(e.target.value as HistoryRegionId)} className="rounded-xl glass-subsurface px-2.5 py-2 text-slate-900 dark:text-white">
              {(Object.keys(REGION_LABELS) as HistoryRegionId[]).map((r) => (
                <option key={r} value={r}>{REGION_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <input type="text" value={eCountry} onChange={(e) => setECountry(e.target.value)} placeholder="Quốc gia" className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          <textarea rows={2} value={eDevelopments} onChange={(e) => setEDevelopments(e.target.value)} placeholder="Diễn biến tóm tắt" className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          <input type="text" value={eSignificance} onChange={(e) => setESignificance(e.target.value)} placeholder="Ý nghĩa" className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEventModalOpen(false)} className="px-4 py-2 rounded-xl glass-subsurface font-semibold cursor-pointer">Đóng</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-amber-700 text-white font-semibold cursor-pointer">Lưu sự kiện</button>
          </div>
        </form>
      </Modal>

      {/* Modal: Ghim địa danh lược đồ */}
      <Modal isOpen={locModalOpen} onClose={() => setLocModalOpen(false)} title="Ghim địa danh lên lược đồ" maxWidth="md">
        <form onSubmit={handleCreateLocation} className="space-y-3 text-xs">
          <input type="text" required value={locName} onChange={(e) => setLocName(e.target.value)} placeholder="Tên địa danh lịch sử (vd: Thăng Long)" className="w-full rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white" />
          <input type="text" value={locModern} onChange={(e) => setLocModern(e.target.value)} placeholder="Địa danh hiện nay" className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-slate-500">Vị trí X</span>
              <input type="number" value={locX} onChange={(e) => setLocX(Number(e.target.value))} className="w-full rounded-xl glass-subsurface px-3 py-1.5 font-mono-tabular" />
            </label>
            <label className="space-y-1">
              <span className="text-slate-500">Vị trí Y</span>
              <input type="number" value={locY} onChange={(e) => setLocY(Number(e.target.value))} className="w-full rounded-xl glass-subsurface px-3 py-1.5 font-mono-tabular" />
            </label>
          </div>
          <textarea rows={2} value={locSummary} onChange={(e) => setLocSummary(e.target.value)} placeholder="Ghi chú sự kiện gắn liền" className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setLocModalOpen(false)} className="px-4 py-2 rounded-xl glass-subsurface font-semibold cursor-pointer">Đóng</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-amber-700 text-white font-semibold cursor-pointer">Ghim</button>
          </div>
        </form>
      </Modal>

      {/* Modal: Thêm tư liệu bảo tàng */}
      <Modal isOpen={arcModalOpen} onClose={() => setArcModalOpen(false)} title="Thêm tư liệu lịch sử" maxWidth="md">
        <form onSubmit={handleCreateArchive} className="space-y-3 text-xs">
          <input type="text" required value={aTitle} onChange={(e) => setATitle(e.target.value)} placeholder="Tên tư liệu / văn kiện" className="w-full rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white" />
          <div className="grid grid-cols-2 gap-2">
            <select value={aCat} onChange={(e) => setACat(e.target.value as ArchiveCategory)} className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white">
              {(Object.keys(ARCHIVE_CATEGORY_LABELS) as ArchiveCategory[]).map((c) => (
                <option key={c} value={c}>{ARCHIVE_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
            <input type="text" value={aYear} onChange={(e) => setAYear(e.target.value)} placeholder="Năm / Giai đoạn" className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          </div>
          <textarea rows={3} value={aExcerpt} onChange={(e) => setAExcerpt(e.target.value)} placeholder="Trích đoạn / Mô tả tư liệu" className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          <input type="text" value={aProvenance} onChange={(e) => setAProvenance(e.target.value)} placeholder="Nguồn trích dẫn" className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setArcModalOpen(false)} className="px-4 py-2 rounded-xl glass-subsurface font-semibold cursor-pointer">Đóng</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-amber-700 text-white font-semibold cursor-pointer">Lưu</button>
          </div>
        </form>
      </Modal>

      {/* Modal: Thêm câu hỏi Lịch sử */}
      <Modal isOpen={quizModalOpen} onClose={() => setQuizModalOpen(false)} title="Thêm câu hỏi Lịch sử" maxWidth="md">
        <form onSubmit={handleCreateQuestion} className="space-y-3 text-xs">
          <textarea rows={2} required value={qPrompt} onChange={(e) => setQPrompt(e.target.value)} placeholder="Nội dung câu hỏi…" className="w-full rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white" />
          <div className="grid grid-cols-2 gap-2">
            <input type="text" required value={qOptA} onChange={(e) => setQOptA(e.target.value)} placeholder="A" className="rounded-xl glass-subsurface px-3 py-1.5 text-slate-900 dark:text-white" />
            <input type="text" required value={qOptB} onChange={(e) => setQOptB(e.target.value)} placeholder="B" className="rounded-xl glass-subsurface px-3 py-1.5 text-slate-900 dark:text-white" />
            <input type="text" value={qOptC} onChange={(e) => setQOptC(e.target.value)} placeholder="C" className="rounded-xl glass-subsurface px-3 py-1.5 text-slate-900 dark:text-white" />
            <input type="text" value={qOptD} onChange={(e) => setQOptD(e.target.value)} placeholder="D" className="rounded-xl glass-subsurface px-3 py-1.5 text-slate-900 dark:text-white" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select value={qCorrectIdx} onChange={(e) => setQCorrectIdx(Number(e.target.value))} className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white">
              <option value={0}>Đúng: A</option>
              <option value={1}>Đúng: B</option>
              <option value={2}>Đúng: C</option>
              <option value={3}>Đúng: D</option>
            </select>
            <input type="text" value={qExplain} onChange={(e) => setQExplain(e.target.value)} placeholder="Giải thích (tùy chọn)" className="col-span-2 rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setQuizModalOpen(false)} className="px-4 py-2 rounded-xl glass-subsurface font-semibold cursor-pointer">Đóng</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-amber-700 text-white font-semibold cursor-pointer">Lưu</button>
          </div>
        </form>
      </Modal>
    </SubjectWorkspaceShell>
  );
};
