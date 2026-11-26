import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Bookmark,
  Check,
  Download,
  ExternalLink,
  Feather,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from '../icons/UiIcons';
import type {
  LiteratureKnowledgeCard,
  LiteratureQuestionItem,
  LiteratureWorkItem,
  LiteratureWritingPrompt,
} from '../../data/subjectsSeedData';
import type { AssignmentSubmission } from '../../types';
import {
  loadSubjectCollection,
  saveSubjectCollection,
} from '../../utils/subjects/subjectDataStore';
import { Modal } from '../common/Modal';
import {
  SubjectEmptyState,
  SubjectWorkspaceShell,
  type GeneratedAiCardItem,
  type GeneratedAiQuizItem,
  type SubjectHostWorkspaceProps,
} from './SubjectWorkspaceShared';

interface GutendexItem {
  id: number;
  title: string;
  authorText: string;
  languages: string[];
  downloadCount: number;
  gutenbergUrl: string;
}

interface WikipediaSummary {
  title: string;
  description?: string;
  extract: string;
  thumbnailUrl?: string;
  pageUrl: string;
}

interface WritingEvaluation {
  score10: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  rewriteSuggestion: string;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không thể đọc tệp đã chọn.'));
    reader.readAsDataURL(file);
  });
}

export const LiteratureSubjectView: React.FC<SubjectHostWorkspaceProps> = (props) => {
  const userId = props.currentUser.id;
  const [subTab, setSubTab] = useState<string>(props.initialSubTab || 'works');

  const [works, setWorks] = useState<LiteratureWorkItem[]>(() =>
    loadSubjectCollection<LiteratureWorkItem>(userId, 'literature', 'works')
  );
  const [knowledgeCards, setKnowledgeCards] = useState<LiteratureKnowledgeCard[]>(() =>
    loadSubjectCollection<LiteratureKnowledgeCard>(userId, 'literature', 'knowledge')
  );
  const [writingPrompts, setWritingPrompts] = useState<LiteratureWritingPrompt[]>(() =>
    loadSubjectCollection<LiteratureWritingPrompt>(userId, 'literature', 'prompts')
  );
  const [questions, setQuestions] = useState<LiteratureQuestionItem[]>(() =>
    loadSubjectCollection<LiteratureQuestionItem>(userId, 'literature', 'questions')
  );

  useEffect(() => {
    saveSubjectCollection(userId, 'literature', 'works', works);
  }, [userId, works]);
  useEffect(() => {
    saveSubjectCollection(userId, 'literature', 'knowledge', knowledgeCards);
  }, [userId, knowledgeCards]);
  useEffect(() => {
    saveSubjectCollection(userId, 'literature', 'prompts', writingPrompts);
  }, [userId, writingPrompts]);
  useEffect(() => {
    saveSubjectCollection(userId, 'literature', 'questions', questions);
  }, [userId, questions]);

  // Works state
  const [workSearch, setWorkSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [selectedWorkId, setSelectedWorkId] = useState('');
  const [readerSection, setReaderSection] = useState<'text' | 'notes'>('text');
  const [highlightedLines, setHighlightedLines] = useState<Record<string, number[]>>({});
  const [docUploadBusy, setDocUploadBusy] = useState(false);
  const [docUploadMsg, setDocUploadMsg] = useState<string | null>(null);

  // Add Work modal
  const [workModalOpen, setWorkModalOpen] = useState(false);
  const [wTitle, setWTitle] = useState('');
  const [wAuthor, setWAuthor] = useState('');
  const [wPeriod, setWPeriod] = useState<LiteratureWorkItem['period']>('Văn học hiện đại');
  const [wGenre, setWGenre] = useState('');
  const [wGrade, setWGrade] = useState<LiteratureWorkItem['grade']>('Lớp 12');
  const [wSummary, setWSummary] = useState('');
  const [wKeyValues, setWKeyValues] = useState('');
  const [wExcerpt, setWExcerpt] = useState('');

  // External Gutendex + Wikipedia
  const [lookupModalOpen, setLookupModalOpen] = useState(false);
  const [extQuery, setExtQuery] = useState('');
  const [extMode, setExtMode] = useState<'wiki' | 'gutendex'>('wiki');
  const [extLoading, setExtLoading] = useState(false);
  const [extError, setExtError] = useState<string | null>(null);
  const [wikiResult, setWikiResult] = useState<WikipediaSummary | null>(null);
  const [gutendexBooks, setGutendexBooks] = useState<GutendexItem[]>([]);
  const [gutendexExcerpt, setGutendexExcerpt] = useState<{ title: string; text: string } | null>(
    null
  );

  // Knowledge filter & modal
  const [knowledgeFilter, setKnowledgeFilter] = useState('all');
  const [knowModalOpen, setKnowModalOpen] = useState(false);
  const [kCategory, setKCategory] =
    useState<LiteratureKnowledgeCard['category']>('Biện pháp tu từ');
  const [kTitle, setKTitle] = useState('');
  const [kSummary, setKSummary] = useState('');
  const [kExample, setKExample] = useState('');

  // Writing studio
  const [selectedPromptId, setSelectedPromptId] = useState('');
  const [customWritingPrompt, setCustomWritingPrompt] = useState('');
  const [essayDraft, setEssayDraft] = useState('');
  const [evalBusy, setEvalBusy] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [evalResult, setEvalResult] = useState<WritingEvaluation | null>(null);
  const [submitAssignmentId, setSubmitAssignmentId] = useState('');
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);

  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [pGenre, setPGenre] =
    useState<LiteratureWritingPrompt['genre']>('Nghị luận văn học');
  const [pTitle, setPTitle] = useState('');
  const [pOutlineText, setPOutlineText] = useState('');
  const [pEvidenceText, setPEvidenceText] = useState('');

  // Practice
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, number>>({});
  const [tfAnswers, setTfAnswers] = useState<Record<string, boolean>>({});
  const [essayAnswers, setEssayAnswers] = useState<Record<string, string>>({});
  const [practiceSubmitted, setPracticeSubmitted] = useState(false);

  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [qType, setQType] = useState<LiteratureQuestionItem['qtype']>('mcq');
  const [qTopic, setQTopic] = useState('Đọc hiểu');
  const [qPrompt, setQPrompt] = useState('');
  const [qOptA, setQOptA] = useState('');
  const [qOptB, setQOptB] = useState('');
  const [qOptC, setQOptC] = useState('');
  const [qOptD, setQOptD] = useState('');
  const [qCorrectIdx, setQCorrectIdx] = useState(0);
  const [qCorrectBool, setQCorrectBool] = useState(true);
  const [qExplain, setQExplain] = useState('');

  const filteredWorks = useMemo(() => {
    const q = workSearch.trim().toLowerCase();
    return works.filter((w) => {
      const gOk = gradeFilter === 'all' || w.grade === gradeFilter;
      const qOk =
        !q ||
        w.title.toLowerCase().includes(q) ||
        w.author.toLowerCase().includes(q) ||
        w.summary.toLowerCase().includes(q);
      return gOk && qOk;
    });
  }, [gradeFilter, workSearch, works]);

  const activeWork = useMemo(
    () => works.find((w) => w.id === selectedWorkId) || filteredWorks[0] || works[0],
    [filteredWorks, selectedWorkId, works]
  );

  const activePrompt = useMemo(
    () =>
      writingPrompts.find((p) => p.id === selectedPromptId) || writingPrompts[0] || null,
    [selectedPromptId, writingPrompts]
  );

  const draftStats = useMemo(() => {
    const trimmed = essayDraft.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const paragraphs = trimmed
      ? trimmed.split(/\n+/).filter((p) => p.trim().length > 0).length
      : 0;
    return { chars: essayDraft.length, words, paragraphs };
  }, [essayDraft]);

  const pendingAssignments = useMemo(
    () =>
      props.schoolContext.assignments.filter(
        (a) => !props.schoolContext.submissionByAssignmentId[a.id]
      ),
    [props.schoolContext.assignments, props.schoolContext.submissionByAssignmentId]
  );

  const handleToggleLineHighlight = (workId: string, idx: number) => {
    setHighlightedLines((prev) => {
      const cur = prev[workId] || [];
      const next = cur.includes(idx) ? cur.filter((x) => x !== idx) : [...cur, idx];
      return { ...prev, [workId]: next };
    });
  };

  const handleAddWork = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wTitle.trim()) return;
    const lines = wExcerpt
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const created: LiteratureWorkItem = {
      id: `lit-w-${Date.now()}`,
      title: wTitle.trim(),
      author: wAuthor.trim() || 'Chưa rõ',
      period: wPeriod,
      genre: wGenre.trim() || 'Văn bản',
      grade: wGrade,
      summary: wSummary.trim(),
      keyValues: wKeyValues.trim(),
      excerpt: lines,
    };
    setWorks((prev) => [created, ...prev]);
    setSelectedWorkId(created.id);
    setWTitle('');
    setWAuthor('');
    setWGenre('');
    setWSummary('');
    setWKeyValues('');
    setWExcerpt('');
    setWorkModalOpen(false);
  };

  const handleAddKnowledge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kTitle.trim() || !kSummary.trim()) return;
    setKnowledgeCards((prev) => [
      {
        id: `lit-k-${Date.now()}`,
        category: kCategory,
        title: kTitle.trim(),
        summary: kSummary.trim(),
        example: kExample.trim(),
      },
      ...prev,
    ]);
    setKTitle('');
    setKSummary('');
    setKExample('');
    setKnowModalOpen(false);
  };

  const handleAddPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pTitle.trim()) return;
    const created: LiteratureWritingPrompt = {
      id: `lit-wp-${Date.now()}`,
      genre: pGenre,
      title: pTitle.trim(),
      outline: pOutlineText
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
      evidencePool: pEvidenceText
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    };
    setWritingPrompts((prev) => [created, ...prev]);
    setSelectedPromptId(created.id);
    setPTitle('');
    setPOutlineText('');
    setPEvidenceText('');
    setPromptModalOpen(false);
  };

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qPrompt.trim()) return;
    const opts = [qOptA, qOptB, qOptC, qOptD].map((s) => s.trim()).filter(Boolean);
    setQuestions((prev) => [
      {
        id: `lq-${Date.now()}`,
        qtype: qType,
        topic: qTopic.trim() || 'Đọc hiểu',
        prompt: qPrompt.trim(),
        ...(qType === 'mcq' && opts.length >= 2
          ? { options: opts, correctIndex: Math.min(qCorrectIdx, opts.length - 1) }
          : {}),
        ...(qType === 'tf' ? { correctBool: qCorrectBool } : {}),
        explain: qExplain.trim(),
      },
      ...prev,
    ]);
    setQPrompt('');
    setQOptA('');
    setQOptB('');
    setQOptC('');
    setQOptD('');
    setQExplain('');
    setQuizModalOpen(false);
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setDocUploadBusy(true);
    setDocUploadMsg(null);
    try {
      const fileBase64 = await readFileAsBase64(file);
      const res = await fetch('/api/literature/parse-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, fileBase64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Không đọc được tệp văn bản.');
      const text = String(data.text || '').trim();
      if (!text) throw new Error('Tệp không có nội dung chữ.');
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const newWork: LiteratureWorkItem = {
        id: `lit-up-${Date.now().toString(36)}`,
        title: file.name.replace(/\.[^.]+$/, ''),
        author: 'Tài liệu nhập',
        period: 'Văn học hiện đại',
        genre: 'Văn bản',
        grade: 'Lớp 12',
        summary: lines.slice(0, 2).join(' ').slice(0, 200),
        keyValues: '',
        excerpt: lines.slice(0, 80),
      };
      setWorks((prev) => [newWork, ...prev]);
      setSelectedWorkId(newWork.id);
      setDocUploadMsg(`Đã thêm "${newWork.title}".`);
    } catch (err) {
      setDocUploadMsg(err instanceof Error ? err.message : 'Lỗi nhập tài liệu.');
    } finally {
      setDocUploadBusy(false);
    }
  };

  const handleExternalSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = extQuery.trim();
    if (!q) return;
    setExtLoading(true);
    setExtError(null);
    try {
      if (extMode === 'wiki') {
        const res = await fetch(
          `/api/external/wikipedia?q=${encodeURIComponent(q)}&lang=vi&context=literature`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Không tìm thấy Wikipedia.');
        setWikiResult(data.summary);
      } else {
        const res = await fetch(`/api/library/gutendex-search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Không tìm thấy Gutendex.');
        setGutendexBooks(Array.isArray(data.results) ? data.results.slice(0, 6) : []);
      }
    } catch (err) {
      setExtError(err instanceof Error ? err.message : 'Lỗi tra cứu.');
    } finally {
      setExtLoading(false);
    }
  };

  const handleReadGutendex = async (book: GutendexItem) => {
    setExtLoading(true);
    try {
      const res = await fetch(`/api/library/gutendex-text?id=${book.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Không tải được trích đoạn.');
      setGutendexExcerpt({
        title: book.title,
        text: String(data.excerpt || data.text || '').slice(0, 2600),
      });
    } catch (err) {
      setExtError(err instanceof Error ? err.message : 'Lỗi tải văn bản.');
    } finally {
      setExtLoading(false);
    }
  };

  const handleSaveWikiAsWork = () => {
    if (!wikiResult) return;
    const created: LiteratureWorkItem = {
      id: `lit-wiki-${Date.now()}`,
      title: wikiResult.title,
      author: 'Wikipedia',
      period: 'Văn học hiện đại',
      genre: 'Tư liệu',
      grade: 'Lớp 12',
      summary: wikiResult.description || '',
      keyValues: wikiResult.extract.slice(0, 220),
      excerpt: wikiResult.extract
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean),
    };
    setWorks((prev) => [created, ...prev]);
    setSelectedWorkId(created.id);
  };

  const handleSaveGutendexAsWork = () => {
    if (!gutendexExcerpt) return;
    const created: LiteratureWorkItem = {
      id: `lit-gut-${Date.now()}`,
      title: gutendexExcerpt.title,
      author: 'Project Gutenberg',
      period: 'Văn học hiện đại',
      genre: 'Trích đoạn',
      grade: 'Lớp 12',
      summary: '',
      keyValues: '',
      excerpt: gutendexExcerpt.text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 60),
    };
    setWorks((prev) => [created, ...prev]);
    setSelectedWorkId(created.id);
  };

  const handleEvaluateWriting = async () => {
    if (essayDraft.trim().length < 30) {
      setEvalError('Nhập tối thiểu 30 ký tự để AI đánh giá.');
      return;
    }
    setEvalBusy(true);
    setEvalError(null);
    try {
      const promptTitle = customWritingPrompt.trim() || activePrompt?.title || 'Bài viết Ngữ văn';
      const res = await fetch('/api/ai/subject-structured', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: 'literature',
          action: 'evaluate_writing',
          promptTitle,
          referenceText: activeWork ? activeWork.excerpt.join('\n') : '',
          studentText: essayDraft.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Không thể chấm bài lúc này.');
      setEvalResult({
        score10: Number(data.score10) || 7.5,
        summary: String(data.summary || ''),
        strengths: Array.isArray(data.strengths) ? data.strengths.map(String) : [],
        improvements: Array.isArray(data.improvements) ? data.improvements.map(String) : [],
        rewriteSuggestion: String(data.rewriteSuggestion || ''),
      });
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : 'Lỗi đánh giá bài viết.');
    } finally {
      setEvalBusy(false);
    }
  };

  const handleSubmitDraftToClass = async () => {
    const targetId = submitAssignmentId || pendingAssignments[0]?.id;
    if (!targetId || !props.onSaveSubmission || essayDraft.trim().length < 10) return;
    const targetAssignment =
      pendingAssignments.find((a) => a.id === targetId) || pendingAssignments[0];
    const promptTitle = customWritingPrompt.trim() || activePrompt?.title || 'Bài viết';
    const submission: AssignmentSubmission = {
      id: `sub-lit-${Date.now().toString(36)}`,
      assignmentId: targetId,
      studentId: props.currentUser.id,
      studentName: props.currentUser.displayName,
      studentCode: props.currentUser.studentCode || props.currentUser.id,
      className: targetAssignment?.className || props.currentUser.className || '',
      content: `[${promptTitle}]\n\n${essayDraft.trim()}`,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
    };
    await props.onSaveSubmission(submission);
    setSubmitNotice('Đã nộp bài lên lớp.');
  };

  const handleDownloadDraft = () => {
    const title = customWritingPrompt.trim() || activePrompt?.title || 'Bài viết Ngữ văn';
    const content = `ĐỀ BÀI: ${title}\nHỌC SINH: ${props.currentUser.displayName}\n\n${essayDraft}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ngu-van-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGradePractice = () => {
    if (questions.length === 0) return;
    let correct = 0;
    let total = 0;
    questions.forEach((q) => {
      if (q.qtype === 'mcq') {
        total += 1;
        if (mcqAnswers[q.id] === q.correctIndex) correct += 1;
      } else if (q.qtype === 'tf') {
        total += 1;
        if (tfAnswers[q.id] === q.correctBool) correct += 1;
      } else if (q.qtype === 'essay') {
        total += 1;
        if ((essayAnswers[q.id] || '').trim().length >= 15) correct += 1;
      }
    });
    setPracticeSubmitted(true);
    if (total > 0) {
      props.onRecordPracticeResult(correct, total, `Ngữ Văn (${correct}/${total})`);
    }
  };

  const handleInjectQuiz = (generated: GeneratedAiQuizItem[]) => {
    const mapped: LiteratureQuestionItem[] = generated.map((g, i) => ({
      id: `lq-ai-${Date.now()}-${i}`,
      qtype: 'mcq',
      topic: g.topic || 'Đọc hiểu',
      prompt: g.question,
      options: g.options,
      correctIndex: g.correctIndex,
      explain: g.explanation,
    }));
    setQuestions((prev) => [...mapped, ...prev]);
    setPracticeSubmitted(false);
    setSubTab('practice');
  };

  const handleInjectCards = (cards: GeneratedAiCardItem[]) => {
    const mapped: LiteratureKnowledgeCard[] = cards.map((c, i) => ({
      id: `lk-ai-${Date.now()}-${i}`,
      category: 'Đọc hiểu',
      title: c.front,
      summary: c.back,
      example: c.example || c.tip,
    }));
    setKnowledgeCards((prev) => [...mapped, ...prev]);
    setSubTab('knowledge');
  };

  const liveContextSummary = useMemo(() => {
    if (subTab === 'writing') {
      return `Luyện viết Ngữ Văn. Đề: "${customWritingPrompt.trim() || activePrompt?.title || 'Tự do'}". ${draftStats.words} từ.`;
    }
    if (activeWork) {
      return `Tác phẩm "${activeWork.title}" (${activeWork.author}, ${activeWork.grade}). ${activeWork.keyValues}`;
    }
    return `Ngữ Văn: ${works.length} tác phẩm, ${knowledgeCards.length} thẻ.`;
  }, [activePrompt?.title, activeWork, customWritingPrompt, draftStats.words, knowledgeCards.length, subTab, works.length]);

  const filteredKnowledge = useMemo(
    () =>
      knowledgeCards.filter(
        (k) => knowledgeFilter === 'all' || k.category === knowledgeFilter
      ),
    [knowledgeCards, knowledgeFilter]
  );

  const openLibraryLookup = (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setExtMode('wiki')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
            extMode === 'wiki' ? 'bg-rose-700 text-white' : 'glass-subsurface text-slate-600 dark:text-slate-300'
          }`}
        >
          Wikipedia
        </button>
        <button
          type="button"
          onClick={() => setExtMode('gutendex')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
            extMode === 'gutendex' ? 'bg-rose-700 text-white' : 'glass-subsurface text-slate-600 dark:text-slate-300'
          }`}
        >
          Gutenberg
        </button>
      </div>
      <form onSubmit={handleExternalSearch} className="flex gap-2">
        <input
          type="text"
          value={extQuery}
          onChange={(e) => setExtQuery(e.target.value)}
          placeholder={extMode === 'wiki' ? 'Tên tác phẩm, tác giả…' : 'Tác giả quốc tế…'}
          className="flex-1 min-w-0 px-3 py-2 rounded-xl glass-subsurface text-xs text-slate-900 dark:text-white"
        />
        <button
          type="submit"
          disabled={extLoading || !extQuery.trim()}
          className="px-3.5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
        >
          {extLoading ? '…' : 'Tìm'}
        </button>
      </form>
      {extError && <p className="text-xs text-rose-600 dark:text-rose-400">{extError}</p>}
      {extMode === 'wiki' && wikiResult && (
        <div className="glass-subsurface rounded-xl p-3 space-y-2 text-xs">
          <p className="font-bold text-slate-900 dark:text-white">{wikiResult.title}</p>
          <p className="text-slate-600 dark:text-slate-300 line-clamp-5 leading-relaxed">
            {wikiResult.extract}
          </p>
          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => {
                handleSaveWikiAsWork();
                setLookupModalOpen(false);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Lưu tác phẩm</span>
            </button>
            <a
              href={wikiResult.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:underline whitespace-nowrap shrink-0"
            >
              <span>Wikipedia</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
      {extMode === 'gutendex' && gutendexBooks.length > 0 && (
        <div className="space-y-1.5 max-h-56 overflow-y-auto">
          {gutendexBooks.map((b) => (
            <div key={b.id} className="glass-subsurface rounded-xl p-2.5 text-xs">
              <p className="font-semibold text-slate-900 dark:text-white line-clamp-1">{b.title}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{b.authorText}</p>
              <div className="flex gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => handleReadGutendex(b)}
                  className="text-rose-700 dark:text-rose-300 font-semibold hover:underline cursor-pointer"
                >
                  Đọc trích đoạn
                </button>
                <a href={b.gutenbergUrl} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:underline">
                  Gutenberg ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
      {gutendexExcerpt && (
        <div className="glass-subsurface rounded-xl p-3 text-xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-slate-900 dark:text-white truncate">{gutendexExcerpt.title}</p>
            <button
              type="button"
              onClick={() => {
                handleSaveGutendexAsWork();
                setLookupModalOpen(false);
              }}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              + Lưu
            </button>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-slate-700 dark:text-slate-200 max-h-40 overflow-y-auto">
            {gutendexExcerpt.text}
          </pre>
        </div>
      )}
    </div>
  );

  return (
    <SubjectWorkspaceShell
      {...props}
      activeSubTab={subTab}
      onChangeSubTab={setSubTab}
      liveContextSummary={liveContextSummary}
      excelModuleKey="practice"
      excelExportRecords={works.map((w) => ({
        TieuDe: w.title,
        TacGia: w.author,
        GiaiDoan: w.period,
        Lop: w.grade,
        TomTat: w.summary,
      }))}
      onImportExcelRows={(rows) => {
        const imported: LiteratureQuestionItem[] = rows
          .filter((r) => String(r.CauHoi || r.Prompt || r.prompt || '').trim())
          .map((r, i) => ({
            id: `lq-imp-${Date.now()}-${i}`,
            qtype: 'mcq' as const,
            topic: String(r.ChuDe || r.Topic || 'Đọc hiểu'),
            prompt: String(r.CauHoi || r.Prompt || r.prompt),
            options: [
              String(r.A || r.OptionA || 'A'),
              String(r.B || r.OptionB || 'B'),
              String(r.C || r.OptionC || 'C'),
              String(r.D || r.OptionD || 'D'),
            ],
            correctIndex: Math.max(0, Math.min(3, Number(r.CorrectIndex ?? 0))),
            explain: String(r.GiaiThich || r.Explain || ''),
          }));
        if (imported.length > 0) {
          setQuestions((prev) => [...imported, ...prev]);
          setSubTab('practice');
        }
      }}
      onInjectGeneratedQuiz={handleInjectQuiz}
      onInjectGeneratedCards={handleInjectCards}
    >
      {subTab === 'works' && (
        <div className="space-y-3" data-testid="literature-works-panel">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[200px]">
              <div className="relative flex-1 min-w-[160px] max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={workSearch}
                  onChange={(e) => setWorkSearch(e.target.value)}
                  placeholder="Lọc tác phẩm, tác giả…"
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl glass-subsurface text-xs text-slate-900 dark:text-white"
                />
              </div>
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl glass-subsurface text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                <option value="all">Tất cả lớp</option>
                <option value="Lớp 10">Lớp 10</option>
                <option value="Lớp 11">Lớp 11</option>
                <option value="Lớp 12">Lớp 12</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setWorkModalOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm tác phẩm</span>
              </button>
              <button
                type="button"
                onClick={() => setLookupModalOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl glass-subsurface text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Tra cứu mở</span>
              </button>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-subsurface text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer whitespace-nowrap shrink-0">
                <Upload className="w-3.5 h-3.5" />
                <span>{docUploadBusy ? 'Đang đọc…' : 'Nhập Word / PDF'}</span>
                <input
                  type="file"
                  accept=".docx,.pdf,.txt,.md"
                  onChange={handleDocumentUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {docUploadMsg && (
            <div className="text-xs px-3 py-2 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              {docUploadMsg}
            </div>
          )}

          {works.length === 0 ? (
            <SubjectEmptyState
              testId="literature-works-empty"
              title="Chưa có tác phẩm Ngữ văn nào."
              actions={[
                { label: '+ Thêm tác phẩm', onClick: () => setWorkModalOpen(true), primary: true },
                { label: 'Tra cứu Wikipedia / Gutenberg', onClick: () => setLookupModalOpen(true) },
                { label: 'Luyện viết', onClick: () => setSubTab('writing') },
              ]}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-4 space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
                {filteredWorks.map((w) => {
                  const isSelected = activeWork?.id === w.id;
                  const mastered = props.progress.masteredIds.includes(w.id);
                  return (
                    <div
                      key={w.id}
                      onClick={() => setSelectedWorkId(w.id)}
                      className={`p-3 rounded-2xl transition-all cursor-pointer flex items-start justify-between gap-2 ${
                        isSelected
                          ? 'liquid-glass-panel ring-2 ring-rose-500/60'
                          : 'glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/80'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {w.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {w.author} · {w.grade}
                        </p>
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
                            setWorks((prev) => prev.filter((item) => item.id !== w.id));
                          }}
                          className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                          title="Xóa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="lg:col-span-8">
                {activeWork && (
                  <div className="liquid-glass-panel rounded-2xl p-4 sm:p-5 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                          {activeWork.period} · {activeWork.genre} · {activeWork.grade}
                        </p>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                          {activeWork.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {activeWork.author}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => props.onToggleMastered(activeWork.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                          props.progress.masteredIds.includes(activeWork.id)
                            ? 'bg-emerald-600 text-white'
                            : 'glass-subsurface text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>
                          {props.progress.masteredIds.includes(activeWork.id) ? 'Đã nắm' : 'Đánh dấu'}
                        </span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1 border-b border-slate-900/10 dark:border-white/10 pb-2">
                      {[
                        { id: 'text' as const, label: 'Ngữ liệu' },
                        { id: 'notes' as const, label: 'Giá trị & Bút ký' },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setReaderSection(tab.id)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                            readerSection === tab.id
                              ? 'bg-rose-700 text-white'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-white/40 dark:hover:bg-white/5'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {readerSection === 'text' ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>Nhấp câu văn/thơ để đánh dấu dẫn chứng</span>
                          <span className="font-mono-tabular">
                            {(highlightedLines[activeWork.id] || []).length} dòng đánh dấu
                          </span>
                        </div>
                        {activeWork.excerpt.length === 0 ? (
                          <p className="text-xs text-slate-500 py-6 text-center">
                            Chưa có trích đoạn ngữ liệu.
                          </p>
                        ) : (
                          <div className="glass-subsurface rounded-xl p-4 space-y-1 font-serif max-h-[380px] overflow-y-auto">
                            {activeWork.excerpt.map((line, idx) => {
                              const marked = (highlightedLines[activeWork.id] || []).includes(idx);
                              return (
                                <p
                                  key={idx}
                                  onClick={() => handleToggleLineHighlight(activeWork.id, idx)}
                                  className={`px-2 py-1 rounded-lg text-sm leading-relaxed cursor-pointer transition-colors ${
                                    marked
                                      ? 'bg-amber-400/25 dark:bg-amber-500/25 text-slate-950 dark:text-amber-100 font-medium'
                                      : 'text-slate-800 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60'
                                  }`}
                                >
                                  {line}
                                </p>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(activeWork.summary || activeWork.keyValues) && (
                          <div className="space-y-2 text-xs text-slate-700 dark:text-slate-200">
                            {activeWork.summary && <p>{activeWork.summary}</p>}
                            {activeWork.keyValues && (
                              <p className="rounded-xl bg-slate-900/5 dark:bg-white/5 px-3 py-2 text-slate-800 dark:text-slate-100">
                                {activeWork.keyValues}
                              </p>
                            )}
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                            <Bookmark className="w-3.5 h-3.5 text-rose-600" />
                            <span>Bút ký cá nhân</span>
                          </label>
                          <textarea
                            rows={5}
                            value={props.progress.notesByItemId[activeWork.id] || ''}
                            onChange={(e) => props.onSaveStudyNote(activeWork.id, e.target.value)}
                            placeholder="Ghi chú luận điểm, dẫn chứng…"
                            className="w-full px-3 py-2 rounded-xl glass-subsurface text-xs text-slate-900 dark:text-white resize-y"
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

      {subTab === 'knowledge' && (
        <div className="space-y-3" data-testid="literature-knowledge-panel">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {['all', 'Biện pháp tu từ', 'Đọc hiểu', 'Nghị luận văn học', 'Nghị luận xã hội'].map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setKnowledgeFilter(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                      knowledgeFilter === cat
                        ? 'bg-rose-700 text-white'
                        : 'glass-subsurface text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {cat === 'all' ? 'Tất cả' : cat}
                  </button>
                )
              )}
            </div>
            <button
              type="button"
              onClick={() => setKnowModalOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm kiến thức</span>
            </button>
          </div>

          {filteredKnowledge.length === 0 ? (
            <SubjectEmptyState
              testId="literature-knowledge-empty"
              title="Chưa có thẻ tu từ hoặc kỹ năng đọc hiểu nào."
              actions={[
                { label: '+ Thêm kiến thức', onClick: () => setKnowModalOpen(true), primary: true },
                { label: 'Tạo bằng AI', onClick: () => setSubTab('ai-tutor') },
              ]}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredKnowledge.map((card) => {
                const mastered = props.progress.masteredIds.includes(card.id);
                return (
                  <div key={card.id} className="liquid-glass-panel rounded-2xl p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                          {card.category}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {card.title}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => props.onToggleMastered(card.id)}
                          className={`p-1.5 rounded-lg cursor-pointer ${
                            mastered ? 'bg-emerald-600 text-white' : 'glass-subsurface text-slate-500'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setKnowledgeCards((prev) => prev.filter((item) => item.id !== card.id))
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                      {card.summary}
                    </p>
                    {card.example && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 italic rounded-xl bg-slate-900/5 dark:bg-white/5 px-3 py-2">
                        {card.example}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {subTab === 'writing' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3" data-testid="literature-writing-panel">
          <div className="lg:col-span-4 space-y-3">
            <div className="liquid-glass-panel rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Feather className="w-4 h-4 text-rose-700 dark:text-rose-300" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Đề bài &amp; Dàn ý</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPromptModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg glass-subsurface text-[11px] font-semibold cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Lưu đề</span>
                </button>
              </div>

              {writingPrompts.length > 0 && (
                <select
                  value={activePrompt?.id || ''}
                  onChange={(e) => setSelectedPromptId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-subsurface text-xs font-medium text-slate-800 dark:text-white"
                >
                  {writingPrompts.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.genre}] {p.title}
                    </option>
                  ))}
                </select>
              )}

              <input
                type="text"
                value={customWritingPrompt}
                onChange={(e) => setCustomWritingPrompt(e.target.value)}
                placeholder="Nhập đề bài nghị luận của bạn…"
                className="w-full px-3 py-2 rounded-xl glass-subsurface text-xs text-slate-900 dark:text-white"
              />

              {activePrompt && activePrompt.outline.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Chèn nhanh vào bài
                  </p>
                  {activePrompt.outline.map((step, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        setEssayDraft((prev) => `${prev ? `${prev}\n\n` : ''}${step}\n`)
                      }
                      className="w-full text-left px-2.5 py-1.5 rounded-xl glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/80 text-xs text-slate-700 dark:text-slate-200 cursor-pointer flex items-start gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <span>{step}</span>
                    </button>
                  ))}
                </div>
              )}

              {activePrompt && activePrompt.evidencePool.length > 0 && (
                <div className="space-y-1">
                  {activePrompt.evidencePool.map((ev, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setEssayDraft((prev) => `${prev ? `${prev} ` : ''}${ev}`)}
                      className="w-full text-left px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-[11px] text-rose-900 dark:text-rose-200 cursor-pointer"
                    >
                      + {ev}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-8 space-y-3">
            <div className="liquid-glass-panel rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Trình soạn văn</h3>
                  <span className="text-[11px] text-slate-500 font-mono-tabular">
                    {draftStats.words} từ · {draftStats.paragraphs} đoạn
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleDownloadDraft}
                    disabled={!essayDraft.trim()}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl glass-subsurface text-xs font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>.txt</span>
                  </button>
                  <button
                    type="button"
                    data-testid="literature-ai-grade-btn"
                    onClick={handleEvaluateWriting}
                    disabled={evalBusy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{evalBusy ? 'Đang chấm…' : 'AI Chấm Rubric'}</span>
                  </button>
                </div>
              </div>

              <textarea
                rows={13}
                data-testid="literature-essay-editor"
                value={essayDraft}
                onChange={(e) => setEssayDraft(e.target.value)}
                placeholder="Soạn mở bài, thân bài, kết bài tại đây…"
                className="w-full px-3.5 py-3 rounded-xl glass-subsurface text-sm leading-relaxed text-slate-900 dark:text-white resize-y"
              />

              {pendingAssignments.length > 0 && props.onSaveSubmission && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-900/10 dark:border-white/10">
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <BookOpen className="w-4 h-4 text-sky-600 shrink-0" />
                    <select
                      value={submitAssignmentId || pendingAssignments[0]?.id || ''}
                      onChange={(e) => setSubmitAssignmentId(e.target.value)}
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl glass-subsurface text-xs text-slate-800 dark:text-white"
                    >
                      {pendingAssignments.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title} ({a.className})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleSubmitDraftToClass}
                    disabled={essayDraft.trim().length < 10}
                    className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-40"
                  >
                    Nộp lên lớp
                  </button>
                </div>
              )}
              {submitNotice && (
                <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                  {submitNotice}
                </p>
              )}

              {evalError && (
                <div className="p-3 rounded-xl bg-rose-500/15 text-xs text-rose-700 dark:text-rose-300">
                  {evalError}
                </div>
              )}

              {evalResult && (
                <div className="pt-3 border-t border-slate-900/10 dark:border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Đánh giá Rubric
                    </h4>
                    <span className="px-2.5 py-0.5 rounded-lg bg-violet-600 text-white text-xs font-bold font-mono-tabular">
                      {evalResult.score10.toFixed(1)} / 10
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-200">{evalResult.summary}</p>
                  {evalResult.strengths.length > 0 && (
                    <ul className="list-disc pl-4 text-xs text-emerald-800 dark:text-emerald-200 space-y-0.5">
                      {evalResult.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  )}
                  {evalResult.improvements.length > 0 && (
                    <ul className="list-disc pl-4 text-xs text-amber-800 dark:text-amber-200 space-y-0.5">
                      {evalResult.improvements.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {subTab === 'practice' && (
        <div className="space-y-3" data-testid="literature-practice-panel">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Bài tập Ngữ Văn ({questions.length})
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuizModalOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl glass-subsurface text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm câu hỏi</span>
              </button>
              {questions.length > 0 && (
                <button
                  type="button"
                  onClick={handleGradePractice}
                  className="px-4 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold cursor-pointer"
                >
                  Chấm bài
                </button>
              )}
            </div>
          </div>

          {questions.length === 0 ? (
            <SubjectEmptyState
              testId="literature-practice-empty"
              title="Chưa có câu hỏi Đọc hiểu hay Nghị luận nào."
              actions={[
                { label: '+ Thêm câu hỏi', onClick: () => setQuizModalOpen(true), primary: true },
                { label: 'Tạo đề bằng AI', onClick: () => setSubTab('ai-tutor') },
              ]}
            />
          ) : (
            <div className="space-y-2.5">
              {questions.map((q, idx) => (
                <div key={q.id} className="liquid-glass-panel rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                      Câu {idx + 1} · {q.topic}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setQuestions((prev) => prev.filter((item) => item.id !== q.id))
                      }
                      className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                    {q.prompt}
                  </p>

                  {q.qtype === 'mcq' && q.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {q.options.map((opt, oIdx) => {
                        const chosen = mcqAnswers[q.id] === oIdx;
                        const isRight = q.correctIndex === oIdx;
                        return (
                          <button
                            key={oIdx}
                            type="button"
                            onClick={() =>
                              !practiceSubmitted &&
                              setMcqAnswers((p) => ({ ...p, [q.id]: oIdx }))
                            }
                            className={`text-left px-3 py-2 rounded-xl text-xs cursor-pointer ${
                              practiceSubmitted
                                ? isRight
                                  ? 'bg-emerald-600 text-white'
                                  : chosen
                                  ? 'bg-rose-600 text-white'
                                  : 'glass-subsurface opacity-60'
                                : chosen
                                ? 'bg-rose-700 text-white font-semibold'
                                : 'glass-subsurface text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {String.fromCharCode(65 + oIdx)}. {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {q.qtype === 'tf' && (
                    <div className="flex gap-2">
                      {[true, false].map((val) => {
                        const chosen = tfAnswers[q.id] === val;
                        return (
                          <button
                            key={String(val)}
                            type="button"
                            onClick={() =>
                              !practiceSubmitted &&
                              setTfAnswers((p) => ({ ...p, [q.id]: val }))
                            }
                            className={`px-4 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                              practiceSubmitted
                                ? q.correctBool === val
                                  ? 'bg-emerald-600 text-white'
                                  : chosen
                                  ? 'bg-rose-600 text-white'
                                  : 'glass-subsurface opacity-60'
                                : chosen
                                ? 'bg-rose-700 text-white'
                                : 'glass-subsurface text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {val ? 'Đúng' : 'Sai'}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {q.qtype === 'essay' && (
                    <textarea
                      rows={3}
                      value={essayAnswers[q.id] || ''}
                      onChange={(e) =>
                        setEssayAnswers((p) => ({ ...p, [q.id]: e.target.value }))
                      }
                      placeholder="Nhập câu trả lời…"
                      className="w-full px-3 py-2 rounded-xl glass-subsurface text-xs text-slate-900 dark:text-white"
                    />
                  )}

                  {practiceSubmitted && q.explain && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 pt-1">
                      {q.explain}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Tra cứu mở Wikipedia & Project Gutenberg */}
      <Modal isOpen={lookupModalOpen} onClose={() => setLookupModalOpen(false)} title="Tra cứu Wikipedia &amp; Gutenberg" maxWidth="lg">
        {openLibraryLookup}
      </Modal>

      {/* Modal: Thêm tác phẩm */}
      <Modal isOpen={workModalOpen} onClose={() => setWorkModalOpen(false)} title="Thêm tác phẩm Ngữ văn" maxWidth="lg">
        <form onSubmit={handleAddWork} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input type="text" required value={wTitle} onChange={(e) => setWTitle(e.target.value)} placeholder="Tên tác phẩm" className="rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white" />
            <input type="text" value={wAuthor} onChange={(e) => setWAuthor(e.target.value)} placeholder="Tác giả" className="rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select value={wPeriod} onChange={(e) => setWPeriod(e.target.value as LiteratureWorkItem['period'])} className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white">
              <option value="Văn học dân gian">Dân gian</option>
              <option value="Văn học trung đại">Trung đại</option>
              <option value="Văn học hiện đại">Hiện đại</option>
            </select>
            <input type="text" value={wGenre} onChange={(e) => setWGenre(e.target.value)} placeholder="Thể loại (Thơ, Truyện)" className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
            <select value={wGrade} onChange={(e) => setWGrade(e.target.value as LiteratureWorkItem['grade'])} className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white">
              <option value="Lớp 10">Lớp 10</option>
              <option value="Lớp 11">Lớp 11</option>
              <option value="Lớp 12">Lớp 12</option>
            </select>
          </div>
          <input type="text" value={wSummary} onChange={(e) => setWSummary(e.target.value)} placeholder="Tóm tắt ngắn" className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          <input type="text" value={wKeyValues} onChange={(e) => setWKeyValues(e.target.value)} placeholder="Giá trị nội dung & nghệ thuật" className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          <textarea rows={5} value={wExcerpt} onChange={(e) => setWExcerpt(e.target.value)} placeholder="Dán trích đoạn ngữ liệu (mỗi dòng một câu)…" className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setWorkModalOpen(false)} className="px-4 py-2 rounded-xl glass-subsurface font-semibold cursor-pointer">Đóng</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-rose-700 text-white font-semibold cursor-pointer">Lưu tác phẩm</button>
          </div>
        </form>
      </Modal>

      {/* Modal: Thêm thẻ kiến thức */}
      <Modal isOpen={knowModalOpen} onClose={() => setKnowModalOpen(false)} title="Thêm kiến thức Ngữ văn" maxWidth="md">
        <form onSubmit={handleAddKnowledge} className="space-y-3 text-xs">
          <select value={kCategory} onChange={(e) => setKCategory(e.target.value as LiteratureKnowledgeCard['category'])} className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white">
            <option value="Biện pháp tu từ">Biện pháp tu từ</option>
            <option value="Đọc hiểu">Đọc hiểu</option>
            <option value="Nghị luận văn học">Nghị luận văn học</option>
            <option value="Nghị luận xã hội">Nghị luận xã hội</option>
          </select>
          <input type="text" required value={kTitle} onChange={(e) => setKTitle(e.target.value)} placeholder="Tiêu đề" className="w-full rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white" />
          <textarea rows={3} required value={kSummary} onChange={(e) => setKSummary(e.target.value)} placeholder="Nội dung trọng tâm" className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          <input type="text" value={kExample} onChange={(e) => setKExample(e.target.value)} placeholder="Ví dụ (tùy chọn)" className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setKnowModalOpen(false)} className="px-4 py-2 rounded-xl glass-subsurface font-semibold cursor-pointer">Đóng</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-rose-700 text-white font-semibold cursor-pointer">Lưu</button>
          </div>
        </form>
      </Modal>

      {/* Modal: Lưu đề viết & Dàn ý */}
      <Modal isOpen={promptModalOpen} onClose={() => setPromptModalOpen(false)} title="Lưu đề & dàn ý viết" maxWidth="md">
        <form onSubmit={handleAddPrompt} className="space-y-3 text-xs">
          <select value={pGenre} onChange={(e) => setPGenre(e.target.value as LiteratureWritingPrompt['genre'])} className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white">
            <option value="Nghị luận văn học">Nghị luận văn học</option>
            <option value="Nghị luận xã hội">Nghị luận xã hội</option>
          </select>
          <input type="text" required value={pTitle} onChange={(e) => setPTitle(e.target.value)} placeholder="Đề bài…" className="w-full rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white" />
          <textarea rows={4} value={pOutlineText} onChange={(e) => setPOutlineText(e.target.value)} placeholder="Các ý dàn bài (mỗi dòng 1 ý)…" className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          <textarea rows={2} value={pEvidenceText} onChange={(e) => setPEvidenceText(e.target.value)} placeholder="Dẫn chứng (mỗi dòng 1 dẫn chứng)…" className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPromptModalOpen(false)} className="px-4 py-2 rounded-xl glass-subsurface font-semibold cursor-pointer">Đóng</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-rose-700 text-white font-semibold cursor-pointer">Lưu đề</button>
          </div>
        </form>
      </Modal>

      {/* Modal: Thêm câu hỏi Ngữ văn */}
      <Modal isOpen={quizModalOpen} onClose={() => setQuizModalOpen(false)} title="Thêm câu hỏi Ngữ văn" maxWidth="md">
        <form onSubmit={handleAddQuestion} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <select value={qType} onChange={(e) => setQType(e.target.value as LiteratureQuestionItem['qtype'])} className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white">
              <option value="mcq">Trắc nghiệm</option>
              <option value="tf">Đúng / Sai</option>
              <option value="essay">Tự luận</option>
            </select>
            <input type="text" value={qTopic} onChange={(e) => setQTopic(e.target.value)} placeholder="Chuyên đề" className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          </div>
          <textarea rows={2} required value={qPrompt} onChange={(e) => setQPrompt(e.target.value)} placeholder="Câu hỏi…" className="w-full rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white" />
          {qType === 'mcq' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" required value={qOptA} onChange={(e) => setQOptA(e.target.value)} placeholder="A" className="rounded-xl glass-subsurface px-3 py-1.5 text-slate-900 dark:text-white" />
                <input type="text" required value={qOptB} onChange={(e) => setQOptB(e.target.value)} placeholder="B" className="rounded-xl glass-subsurface px-3 py-1.5 text-slate-900 dark:text-white" />
                <input type="text" value={qOptC} onChange={(e) => setQOptC(e.target.value)} placeholder="C" className="rounded-xl glass-subsurface px-3 py-1.5 text-slate-900 dark:text-white" />
                <input type="text" value={qOptD} onChange={(e) => setQOptD(e.target.value)} placeholder="D" className="rounded-xl glass-subsurface px-3 py-1.5 text-slate-900 dark:text-white" />
              </div>
              <select value={qCorrectIdx} onChange={(e) => setQCorrectIdx(Number(e.target.value))} className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white">
                <option value={0}>Đúng: A</option>
                <option value={1}>Đúng: B</option>
                <option value={2}>Đúng: C</option>
                <option value={3}>Đúng: D</option>
              </select>
            </>
          )}
          {qType === 'tf' && (
            <select value={qCorrectBool ? 'true' : 'false'} onChange={(e) => setQCorrectBool(e.target.value === 'true')} className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white">
              <option value="true">Đáp án: Đúng</option>
              <option value="false">Đáp án: Sai</option>
            </select>
          )}
          <input type="text" value={qExplain} onChange={(e) => setQExplain(e.target.value)} placeholder="Gợi ý đáp án (tùy chọn)" className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setQuizModalOpen(false)} className="px-4 py-2 rounded-xl glass-subsurface font-semibold cursor-pointer">Đóng</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-rose-700 text-white font-semibold cursor-pointer">Lưu</button>
          </div>
        </form>
      </Modal>
    </SubjectWorkspaceShell>
  );
};
