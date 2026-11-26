import React, { useState } from 'react';
import type { Book } from '../../types';
import type { AcademicPaperResult, AcademicSource, CitationFormat } from '../../utils/externalIntegrations';
import { formatAcademicCitation } from '../../utils/externalIntegrations';
import { buildBookFromAcademicPaper } from '../../utils/libraryExternalApis';
import { LiquidCard } from '../common/LiquidCard';
import { EmptyState } from '../shared/EmptyState';
import {
  AlertTriangle,
  BookOpen,
  BookPlus,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  GraduationCap,
  RefreshCw,
  Search,
  Sparkles,
} from '../icons/UiIcons';
import { FormattedAiText } from '../common/FormattedAiText';

interface AcademicPaperExplorerProps {
  books: Book[];
  canManageCatalog: boolean;
  onAddBook: (book: Book) => Promise<void> | void;
}

const ACADEMIC_PRESETS: Array<{ label: string; query: string }> = [
  { label: 'Vật lý lượng tử', query: 'quantum computing education' },
  { label: 'Trí tuệ nhân tạo', query: 'large language models education' },
  { label: 'Biến đổi khí hậu', query: 'climate change Mekong delta' },
  { label: 'Hóa học hữu cơ', query: 'green chemistry catalysis' },
  { label: 'Toán học ứng dụng', query: 'differential equations modeling' },
];

export const AcademicPaperExplorer: React.FC<AcademicPaperExplorerProps> = ({
  books,
  canManageCatalog,
  onAddBook,
}) => {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<'all' | AcademicSource>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'newest' | 'citations'>('relevance');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [results, setResults] = useState<AcademicPaperResult[] | null>(null);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [expandedUids, setExpandedUids] = useState<Record<string, boolean>>({});
  const [copiedCitationKey, setCopiedCitationKey] = useState<string | null>(null);
  const [aiSummaries, setAiSummaries] = useState<
    Record<string, { loading: boolean; text?: string; error?: string }>
  >({});

  const runSearch = async (overrideQuery?: string, overrideSource?: 'all' | AcademicSource) => {
    const q = (overrideQuery ?? query).trim();
    const activeSource = overrideSource ?? source;
    if (!q) {
      setErrorMsg('Vui lòng nhập từ khóa nghiên cứu, tên bài báo, tác giả hoặc mã DOI / arXiv.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSavedBanner(null);

    try {
      const params = new URLSearchParams({ q, source: activeSource });
      const res = await fetch(`/api/library/academic-search?${params.toString()}`);
      const data = (await res.json()) as {
        results?: AcademicPaperResult[];
        warnings?: string[];
        error?: string;
      };
      if (!res.ok) {
        setErrorMsg(data.error || 'Không thể tra cứu tài liệu từ Crossref / arXiv.');
        return;
      }
      setResults(Array.isArray(data.results) ? data.results : []);
      setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ Crossref / arXiv.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePaperToCatalog = async (paper: AcademicPaperResult) => {
    setSavingUid(paper.uid);
    try {
      const book = buildBookFromAcademicPaper(paper, {
        totalCopies: 2,
        shelfLocation: paper.source === 'arxiv' ? 'Kho tài liệu số arXiv' : 'Kho tạp chí DOI',
      });
      await onAddBook(book);
      setSavedBanner(`Đã lưu công trình "${paper.title}" vào danh mục tài liệu thư viện.`);
    } finally {
      setSavingUid(null);
    }
  };

  const isAlreadyInCatalog = (paper: AcademicPaperResult) => {
    const code = paper.doi || paper.arxivId || '';
    return books.some(
      (b) =>
        (code && b.isbn.toLowerCase() === code.toLowerCase()) ||
        b.title.trim().toLowerCase() === paper.title.trim().toLowerCase()
    );
  };

  const handleCopyCitation = async (paper: AcademicPaperResult, format: CitationFormat) => {
    const formatted = formatAcademicCitation(paper, format);
    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedCitationKey(`${paper.uid}:${format}`);
      setTimeout(() => setCopiedCitationKey(null), 2000);
    } catch {
      setSavedBanner(`Trích dẫn (${format.toUpperCase()}): ${formatted}`);
    }
  };

  const handleAiSummarizePaper = async (paper: AcademicPaperResult) => {
    setAiSummaries((prev) => ({ ...prev, [paper.uid]: { loading: true } }));
    try {
      const prompt = [
        `Hãy tóm tắt ngắn gọn (3-4 gạch đầu dòng bằng Tiếng Việt dễ hiểu cho học sinh/giáo viên THPT) nội dung & đóng góp chính của công trình khoa học sau:`,
        `Tiêu đề: ${paper.title}`,
        `Tác giả: ${paper.authorText} (${paper.publishedYear})`,
        `Nguồn: ${paper.venue}`,
        `Tóm tắt gốc: ${paper.abstract || 'Không có tóm tắt gốc — hãy phân tích ý nghĩa hướng nghiên cứu dựa trên tiêu đề và lĩnh vực.'}`,
      ].join('\n');
      const res = await fetch('/api/ai/subject-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: 'physics',
          mode: 'explain_concept',
          prompt,
        }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || !data.text) {
        setAiSummaries((prev) => ({
          ...prev,
          [paper.uid]: { loading: false, error: data.error || 'Chưa nhận được tóm tắt từ AI.' },
        }));
        return;
      }
      setAiSummaries((prev) => ({
        ...prev,
        [paper.uid]: {
          loading: false,
          text: data.text,
        },
      }));
    } catch {
      setAiSummaries((prev) => ({
        ...prev,
        [paper.uid]: { loading: false, error: 'Không thể kết nối trợ lý AI để tóm tắt.' },
      }));
    }
  };

  const sortedResults = React.useMemo(() => {
    if (!results) return null;
    const copy = [...results];
    if (sortBy === 'newest') {
      copy.sort((a, b) => (b.publishedYear || 0) - (a.publishedYear || 0));
    } else if (sortBy === 'citations') {
      copy.sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0));
    }
    return copy;
  }, [results, sortBy]);

  return (
    <div className="space-y-4">
      <LiquidCard className="p-3.5 space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch();
          }}
          className="flex flex-col lg:flex-row gap-2.5"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              data-testid="academic-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm bài báo khoa học, tiền ấn bản arXiv, hoặc DOI Crossref (VD: 10.1038/..., quantum optics, CRISPR)..."
              className="w-full glass-subsurface rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Nguồn học thuật"
              value={source}
              onChange={(e) => setSource(e.target.value as 'all' | AcademicSource)}
              className="glass-subsurface rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none"
            >
              <option value="all">Crossref + arXiv</option>
              <option value="arxiv">Chỉ arXiv (STEM Preprints)</option>
              <option value="crossref">Chỉ Crossref (DOI Journals)</option>
            </select>

            <button
              type="submit"
              data-testid="academic-search-submit"
              disabled={isLoading}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-all"
            >
              {isLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <GraduationCap className="w-3.5 h-3.5" />
              )}
              {isLoading ? 'Đang tìm kiếm...' : 'Tra cứu Học thuật'}
            </button>
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-slate-500 dark:text-slate-400 font-semibold mr-1">
            Chủ đề nghiên cứu STEM:
          </span>
          {ACADEMIC_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setQuery(preset.query);
                void runSearch(preset.query, source);
              }}
              className="px-2.5 py-1 rounded-lg glass-subsurface hover:bg-white/80 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-medium cursor-pointer whitespace-nowrap shrink-0 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </LiquidCard>

      {savedBanner && (
        <div className="p-3 rounded-xl glass-subsurface bg-emerald-500/12 border-emerald-400/35 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{savedBanner}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl glass-subsurface bg-rose-500/12 border-rose-400/35 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="p-3 rounded-xl glass-subsurface bg-amber-500/12 border-amber-400/35 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{warnings.join(' · ')}</span>
        </div>
      )}

      {results === null && !isLoading ? (
        <EmptyState
          icon={GraduationCap}
          title="Cổng tra cứu Crossref & arXiv cho Nghiên cứu Khoa học"
          description="Tìm kiếm công trình khoa học đã xuất bản (DOI Crossref) và tiền ấn bản Toán - Lý - Tin - Sinh mới nhất từ arXiv để đọc PDF hoặc lưu vào tủ tài liệu tham khảo của trường."
        />
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <LiquidCard key={i} className="p-4 space-y-2 animate-pulse">
              <div className="h-3 w-36 rounded bg-slate-300/60 dark:bg-slate-700/60" />
              <div className="h-4 w-3/4 rounded bg-slate-300/60 dark:bg-slate-700/60" />
              <div className="h-3 w-full rounded bg-slate-300/60 dark:bg-slate-700/60" />
            </LiquidCard>
          ))}
        </div>
      ) : results && results.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Không tìm thấy công trình khoa học phù hợp"
          description="Thử dùng từ khóa tiếng Anh chuyên ngành hoặc chuyển chế độ sang Crossref + arXiv."
        />
      ) : (
        sortedResults && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Tìm thấy <strong className="font-mono-tabular">{sortedResults.length}</strong> tài liệu học thuật
              </p>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-slate-500 dark:text-slate-400 font-semibold">Sắp xếp:</span>
                {([
                  { id: 'relevance', label: 'Liên quan' },
                  { id: 'newest', label: 'Mới nhất' },
                  { id: 'citations', label: 'Trích dẫn cao' },
                ] as const).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSortBy(opt.id)}
                    className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-colors ${
                      sortBy === opt.id
                        ? 'bg-indigo-600 text-white'
                        : 'glass-subsurface text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              {sortedResults.map((paper) => {
                const exists = isAlreadyInCatalog(paper);
                const isExpanded = Boolean(expandedUids[paper.uid]);
                const summaryState = aiSummaries[paper.uid];
                return (
                  <LiquidCard key={paper.uid} className="p-4 flex flex-col justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span className="font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                          {paper.source === 'arxiv' ? 'arXiv Preprint' : 'Crossref Journal'} · {paper.publishedYear}
                        </span>
                        <span className="font-mono-tabular text-slate-500 dark:text-slate-400">
                          {paper.doi
                            ? `DOI: ${paper.doi}`
                            : paper.arxivId
                            ? `arXiv:${paper.arxivId}`
                            : ''}
                          {paper.citationCount !== undefined ? ` · ${paper.citationCount} trích dẫn` : ''}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">
                        {paper.title}
                      </h4>

                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {paper.authorText} · <span className="italic">{paper.venue}</span>
                      </p>

                      {paper.abstract && (
                        <div className="space-y-1">
                          <p className={`text-[11px] leading-relaxed text-slate-600 dark:text-slate-300 ${isExpanded ? '' : 'line-clamp-3'}`}>
                            {paper.abstract}
                          </p>
                          {paper.abstract.length > 180 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedUids((prev) => ({ ...prev, [paper.uid]: !isExpanded }))
                              }
                              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                            >
                              {isExpanded ? 'Thu gọn tóm tắt' : 'Xem toàn văn tóm tắt'}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Citation Copy Toolbar & AI Vietnamese Summary */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {(['bibtex', 'apa', 'ieee'] as const).map((fmt) => {
                          const isCopied = copiedCitationKey === `${paper.uid}:${fmt}`;
                          return (
                            <button
                              key={fmt}
                              type="button"
                              data-testid={`btn-cite-${fmt}-${paper.uid}`}
                              onClick={() => void handleCopyCitation(paper, fmt)}
                              className="px-2 py-0.5 rounded-lg glass-subsurface hover:bg-white/80 dark:hover:bg-white/10 text-[10px] font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              {isCopied ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
                              {isCopied ? `Đã chép ${fmt.toUpperCase()}` : fmt.toUpperCase()}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          disabled={summaryState?.loading}
                          onClick={() => void handleAiSummarizePaper(paper)}
                          className="px-2 py-0.5 rounded-lg glass-subsurface bg-indigo-500/10 hover:bg-indigo-500/20 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          {summaryState?.loading ? 'AI đang tóm tắt...' : 'AI tóm tắt TV'}
                        </button>
                      </div>

                      {summaryState?.text && (
                        <div className="p-2.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 text-[11px] text-slate-700 dark:text-slate-200 space-y-1.5 leading-relaxed">
                          <FormattedAiText text={summaryState.text} />
                        </div>
                      )}
                      {summaryState?.error && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400">{summaryState.error}</p>
                      )}
                    </div>

                    <div className="pt-2.5 border-t border-white/35 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={paper.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg glass-subsurface text-sky-700 dark:text-sky-300 font-semibold inline-flex items-center gap-1 hover:bg-white/80 dark:hover:bg-white/10"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {paper.source === 'arxiv' ? 'Trang arXiv' : 'Mở DOI'}
                        </a>
                        {paper.pdfUrl && (
                          <a
                            href={paper.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 rounded-lg glass-subsurface text-rose-700 dark:text-rose-300 font-semibold inline-flex items-center gap-1 hover:bg-white/80 dark:hover:bg-white/10"
                          >
                            <FileText className="w-3 h-3" />
                            Đọc PDF
                          </a>
                        )}
                      </div>

                      {canManageCatalog && (
                        exists ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <BookOpen className="w-3.5 h-3.5" /> Đã lưu vào thư viện
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={savingUid === paper.uid}
                            onClick={() => handleSavePaperToCatalog(paper)}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <BookPlus className="w-3.5 h-3.5" />
                            {savingUid === paper.uid ? 'Đang lưu...' : 'Lưu vào thư viện'}
                          </button>
                        )
                      )}
                    </div>
                  </LiquidCard>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
};
