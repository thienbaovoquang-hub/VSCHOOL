import React, { useState, useEffect } from 'react';
import type { Book } from '../../types';
import type { GutendexBookResult, LexiconLookupResult } from '../../utils/externalIntegrations';
import {
  findCatalogDuplicateBook,
  formatLanguageLabel,
  gutendexToExternalBookResult,
  type ExternalBookResult,
  type ExternalSearchMode,
  type ExternalSearchResponse,
  type ExternalSearchSourceFilter,
} from '../../utils/libraryExternalApis';
import { LiquidCard } from '../common/LiquidCard';
import { Badge } from '../common/Badge';
import { EmptyState } from '../shared/EmptyState';
import { Modal } from '../common/Modal';
import { BookCoverThumb } from './BookCoverThumb';
import {
  AlertTriangle,
  BookOpen,
  BookPlus,
  CheckCircle2,
  ExternalLink,
  Eye,
  Globe,
  RefreshCw,
  Search,
  Sparkles,
  Star,
} from '../icons/UiIcons';

type ExplorerSourceMode = ExternalSearchSourceFilter | 'gutendex';

interface ExternalBookExplorerProps {
  books: Book[];
  categoryOptions: Array<{ id: string; value: string; label: string }>;
  canManageCatalog: boolean;
  initialQuery?: string;
  initialMode?: ExternalSearchMode;
  onImportExternalBook: (
    external: ExternalBookResult,
    options: { totalCopies: number; shelfLocation: string; category: string }
  ) => Promise<void> | void;
  onInspectExternalBook: (external: ExternalBookResult) => void;
}

const DISCOVERY_PRESETS: Array<{
  label: string;
  query: string;
  mode: ExternalSearchMode;
  source?: ExplorerSourceMode;
}> = [
  { label: 'Khoa học & Vũ trụ', query: 'Carl Sagan Cosmos', mode: 'all' },
  { label: 'Văn học kinh điển', query: 'Nguyễn Nhật Ánh', mode: 'author' },
  { label: 'Lập trình Python', query: 'Python programming', mode: 'all' },
  { label: 'Project Gutenberg: Sherlock Holmes', query: 'Sherlock Holmes', mode: 'all', source: 'gutendex' },
  { label: 'Project Gutenberg: Shakespeare', query: 'Shakespeare', mode: 'all', source: 'gutendex' },
  { label: 'Tiếng Anh học thuật', query: 'English grammar in use', mode: 'title' },
];

export const ExternalBookExplorer: React.FC<ExternalBookExplorerProps> = ({
  books,
  categoryOptions,
  canManageCatalog,
  initialQuery = '',
  initialMode = 'all',
  onImportExternalBook,
  onInspectExternalBook,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<ExternalSearchMode>(initialMode);
  const [source, setSource] = useState<ExplorerSourceMode>('all');
  const [lang, setLang] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [response, setResponse] = useState<ExternalSearchResponse | null>(null);
  const [gutendexResults, setGutendexResults] = useState<GutendexBookResult[] | null>(null);

  // Gutenberg in-app reader modal state
  const [readerOpen, setReaderOpen] = useState(false);
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerError, setReaderError] = useState<string | null>(null);
  const [readerData, setReaderData] = useState<{
    id: number;
    title: string;
    text: string;
    truncated: boolean;
  } | null>(null);
  const [readerFind, setReaderFind] = useState('');
  const [lexiconWord, setLexiconWord] = useState('');
  const [lexiconLoading, setLexiconLoading] = useState(false);
  const [lexiconData, setLexiconData] = useState<LexiconLookupResult | null>(null);
  const [lexiconError, setLexiconError] = useState<string | null>(null);

  const lookupReaderLexicon = async (rawWord: string) => {
    const clean = rawWord.trim().replace(/^[^a-zA-Z0-9'-]+|[^a-zA-Z0-9'-]+$/g, '');
    if (!clean) return;
    setLexiconWord(clean);
    setLexiconLoading(true);
    setLexiconError(null);
    try {
      const res = await fetch(`/api/external/lexicon?word=${encodeURIComponent(clean)}&lang=en`);
      const json = (await res.json()) as { entry?: LexiconLookupResult; error?: string };
      if (!res.ok || !json.entry) {
        setLexiconError(json.error || `Không tìm thấy từ "${clean}" trên Wiktionary / Datamuse.`);
        setLexiconData(null);
        return;
      }
      setLexiconData(json.entry);
    } catch {
      setLexiconError('Không thể tra từ điển Wiktionary / Datamuse.');
    } finally {
      setLexiconLoading(false);
    }
  };

  const handleReaderSelection = () => {
    const sel = typeof window !== 'undefined' ? window.getSelection()?.toString().trim() || '' : '';
    if (!sel || sel.length > 36 || /\s{2,}/.test(sel)) return;
    const singleToken = sel.split(/\s+/)[0];
    if (singleToken && singleToken.length >= 2) {
      void lookupReaderLexicon(singleToken);
    }
  };

  // Quick import modal state
  const [quickImportTarget, setQuickImportTarget] = useState<ExternalBookResult | null>(null);
  const [quickCopies, setQuickCopies] = useState(5);
  const [quickShelf, setQuickShelf] = useState('Kệ A1');
  const [quickCategory, setQuickCategory] = useState('Sách giáo khoa & Tham khảo');
  const [isQuickSaving, setIsQuickSaving] = useState(false);
  const [importedBanner, setImportedBanner] = useState<string | null>(null);

  const runSearch = async (
    overrideQuery?: string,
    overrideMode?: ExternalSearchMode,
    overrideSource?: ExplorerSourceMode,
    overrideLang?: string
  ) => {
    const q = (overrideQuery ?? query).trim();
    const activeMode = overrideMode ?? mode;
    const activeSource = overrideSource ?? source;
    const activeLang = overrideLang ?? lang;

    if (!q && activeSource !== 'gutendex') {
      setErrorMsg('Vui lòng nhập tên sách, tác giả, chủ đề hoặc mã ISBN cần tra cứu.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setImportedBanner(null);

    try {
      if (activeSource === 'gutendex') {
        setResponse(null);
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (activeLang) params.set('lang', activeLang);
        const res = await fetch(`/api/library/gutendex-search?${params.toString()}`);
        const data = (await res.json()) as { results?: GutendexBookResult[]; error?: string };
        if (!res.ok) {
          setErrorMsg(data.error || 'Không thể kết nối Gutendex / Project Gutenberg.');
          return;
        }
        setGutendexResults(Array.isArray(data.results) ? data.results : []);
        return;
      }

      setGutendexResults(null);
      const params = new URLSearchParams({
        q,
        source: activeSource,
        mode: activeMode,
        maxResults: '18',
      });
      if (activeLang) params.set('lang', activeLang);

      const res = await fetch(`/api/library/external-search?${params.toString()}`);
      const data = (await res.json()) as ExternalSearchResponse & { error?: string };
      if (!res.ok) {
        setErrorMsg(data.error || 'Không thể tra cứu dữ liệu sách lúc này.');
        return;
      }

      setResponse(data);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Lỗi kết nối máy chủ tra cứu thư mục sách.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      setQuery(initialQuery);
      setMode(initialMode);
      void runSearch(initialQuery, initialMode, source, lang);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, initialMode]);

  const handleOpenGutenbergReader = async (item: GutendexBookResult) => {
    setReaderOpen(true);
    setReaderLoading(true);
    setReaderError(null);
    setReaderData({ id: item.id, title: item.title, text: '', truncated: false });

    try {
      const res = await fetch(`/api/library/gutendex-text?id=${item.id}`);
      const data = await res.json();
      if (!res.ok) {
        setReaderError(data.error || 'Không thể tải văn bản sách này.');
        return;
      }
      setReaderData(data);
    } catch (err) {
      setReaderError(err instanceof Error ? err.message : 'Lỗi khi tải nội dung sách từ Gutenberg.');
    } finally {
      setReaderLoading(false);
    }
  };

  const openQuickImport = (item: ExternalBookResult) => {
    setQuickImportTarget(item);
    setQuickCopies(5);
    setQuickShelf('Kệ A1');
    setQuickCategory(item.mappedCategory || 'Sách giáo khoa & Tham khảo');
  };

  const handleConfirmQuickImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickImportTarget) return;
    setIsQuickSaving(true);
    try {
      await onImportExternalBook(quickImportTarget, {
        totalCopies: quickCopies,
        shelfLocation: quickShelf,
        category: quickCategory,
      });
      setImportedBanner(
        `Đã nhập "${quickImportTarget.title}" (${quickCopies} bản sao) vào kho thư viện.`
      );
      setQuickImportTarget(null);
    } finally {
      setIsQuickSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Controls */}
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
              data-testid="external-book-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nhập tên sách, tác giả, ISBN-10/13 hoặc tác phẩm Gutenberg (VD: Pride and Prejudice, Clean Code)..."
              className="w-full glass-subsurface rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/40"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {source !== 'gutendex' && (
              <select
                aria-label="Kiểu tìm kiếm"
                value={mode}
                onChange={(e) => setMode(e.target.value as ExternalSearchMode)}
                className="glass-subsurface rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none"
              >
                <option value="all">Tìm tất cả</option>
                <option value="title">Theo nhan đề</option>
                <option value="author">Theo tác giả</option>
                <option value="isbn">Theo ISBN</option>
              </select>
            )}

            <select
              aria-label="Nguồn dữ liệu"
              data-testid="external-book-source-select"
              value={source}
              onChange={(e) => setSource(e.target.value as ExplorerSourceMode)}
              className="glass-subsurface rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none"
            >
              <option value="all">Google Books + Open Library</option>
              <option value="google_books">Chỉ Google Books</option>
              <option value="open_library">Chỉ Open Library</option>
              <option value="gutendex">Project Gutenberg (Gutendex Ebooks)</option>
            </select>

            <select
              aria-label="Ngôn ngữ"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="glass-subsurface rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none"
            >
              <option value="">Mọi ngôn ngữ</option>
              <option value="vi">Tiếng Việt</option>
              <option value="en">Tiếng Anh</option>
            </select>

            <button
              type="submit"
              data-testid="external-book-search-submit"
              disabled={isLoading}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-all"
            >
              {isLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Globe className="w-3.5 h-3.5" />
              )}
              {isLoading
                ? 'Đang tra cứu...'
                : source === 'gutendex'
                ? 'Tìm Ebook Gutenberg'
                : 'Tra cứu'}
            </button>
          </div>
        </form>

        {/* Quick Topic Presets */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-slate-500 dark:text-slate-400 font-semibold mr-1">
            Gợi ý nhanh:
          </span>
          {DISCOVERY_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                const targetSource = preset.source ?? 'all';
                setQuery(preset.query);
                setMode(preset.mode);
                setSource(targetSource);
                void runSearch(preset.query, preset.mode, targetSource, lang);
              }}
              className="px-2.5 py-1 rounded-lg glass-subsurface hover:bg-white/80 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-medium cursor-pointer whitespace-nowrap shrink-0 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </LiquidCard>

      {importedBanner && (
        <div className="p-3 rounded-xl glass-subsurface bg-emerald-500/12 border-emerald-400/35 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{importedBanner}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl glass-subsurface bg-rose-500/12 border-rose-400/35 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {response?.warnings && response.warnings.length > 0 && (
        <div className="p-3 rounded-xl glass-subsurface bg-amber-500/12 border-amber-400/35 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{response.warnings.join(' · ')}</span>
        </div>
      )}

      {/* Results Header Strip */}
      {response && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
          <p className="font-semibold text-slate-700 dark:text-slate-200">
            Tìm thấy <strong className="font-mono-tabular">{response.totalMerged}</strong> ấn phẩm hợp nhất cho “{response.query}”
          </p>
          <p className="text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400">
            Google Books: {response.googleCount} · Open Library: {response.openLibraryCount}
          </p>
        </div>
      )}

      {gutendexResults && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
          <p className="font-semibold text-slate-700 dark:text-slate-200">
            Project Gutenberg (Gutendex): <strong className="font-mono-tabular">{gutendexResults.length}</strong> sách công cộng miễn phí
          </p>
        </div>
      )}

      {/* Empty, Loading, or Results Grid */}
      {!response && !gutendexResults && !isLoading ? (
        <EmptyState
          icon={Globe}
          title="Kho dữ liệu Google Books, Open Library & Project Gutenberg sẵn sàng"
          description="Tra cứu hàng triệu đầu sách quốc tế, sách tiếng Việt hoặc đọc trực tiếp kho tác phẩm kinh điển miễn phí (Project Gutenberg) ngay trong thư viện trường."
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <LiquidCard key={idx} className="p-3.5 flex gap-3 animate-pulse">
              <div className="w-18 h-26 rounded-xl bg-slate-300/60 dark:bg-slate-700/60 shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3 w-20 rounded bg-slate-300/60 dark:bg-slate-700/60" />
                <div className="h-4 w-4/5 rounded bg-slate-300/60 dark:bg-slate-700/60" />
                <div className="h-3 w-2/3 rounded bg-slate-300/60 dark:bg-slate-700/60" />
              </div>
            </LiquidCard>
          ))}
        </div>
      ) : gutendexResults ? (
        gutendexResults.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Không tìm thấy ebook Project Gutenberg phù hợp"
            description="Thử từ khóa tác giả hoặc tựa đề tiếng Anh/Pháp/Việt."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {gutendexResults.map((item) => {
              const asExt = gutendexToExternalBookResult(item);
              const existingBook = findCatalogDuplicateBook(books, asExt);

              return (
                <LiquidCard key={item.id} className="p-3.5 flex gap-3 hover:border-amber-400/50 transition-colors">
                  <BookCoverThumb
                    coverUrl={item.coverUrl}
                    title={item.title}
                    author={item.authorText}
                    category="Văn học & Ngữ văn"
                    size="md"
                  />

                  <div className="flex flex-col justify-between flex-1 min-w-0">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 truncate">
                          Gutenberg #{item.id}
                        </span>
                        {existingBook && (
                          <Badge variant="mint" size="sm">
                            Đã có
                          </Badge>
                        )}
                      </div>

                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm line-clamp-2">
                        {item.title}
                      </h4>

                      <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                        {item.authorText}
                      </p>

                      <p className="text-[10px] font-mono-tabular text-slate-500 dark:text-slate-400 truncate">
                        {item.languages.map((l) => formatLanguageLabel(l)).join(', ')} ·{' '}
                        {item.downloadCount.toLocaleString('en-US')} lượt tải
                      </p>
                    </div>

                    <div className="pt-2 mt-2 border-t border-white/35 dark:border-white/10 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                      {item.textUrl ? (
                        <button
                          type="button"
                          onClick={() => handleOpenGutenbergReader(item)}
                          className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        >
                          <BookOpen className="w-3 h-3" /> Đọc trực tuyến
                        </button>
                      ) : (
                        <a
                          href={item.gutenbergUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-600 dark:text-sky-400 font-semibold hover:underline inline-flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> Gutenberg
                        </a>
                      )}

                      {canManageCatalog && !existingBook && (
                        <button
                          type="button"
                          onClick={() => openQuickImport(asExt)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                        >
                          <BookPlus className="w-3 h-3" /> Nhập kho
                        </button>
                      )}
                    </div>
                  </div>
                </LiquidCard>
              );
            })}
          </div>
        )
      ) : response && response.results.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Không tìm thấy ấn phẩm phù hợp"
          description="Thử từ khóa khác, chuyển chế độ tìm kiếm sang Tất cả hoặc bỏ lọc ngôn ngữ để mở rộng phạm vi."
        />
      ) : (
        response && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {response.results.map((item) => {
              const existingBook = findCatalogDuplicateBook(books, item);
              const srcLabel =
                item.sources.length > 1
                  ? 'Google Books + Open Library'
                  : item.sources[0] === 'google_books'
                  ? 'Google Books'
                  : 'Open Library';

              return (
                <LiquidCard key={item.uid} className="p-3.5 flex gap-3 hover:border-sky-400/50 transition-colors">
                  <button
                    type="button"
                    onClick={() => onInspectExternalBook(item)}
                    className="cursor-pointer shrink-0 self-start focus:outline-none"
                    aria-label={`Xem chi tiết ${item.title}`}
                  >
                    <BookCoverThumb
                      coverUrl={item.coverUrl}
                      title={item.title}
                      author={item.authorText}
                      category={item.mappedCategory}
                      size="md"
                    />
                  </button>

                  <div className="flex flex-col justify-between flex-1 min-w-0">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300 truncate">
                          {srcLabel}
                        </span>
                        {existingBook && (
                          <Badge variant="mint" size="sm">
                            Đã có
                          </Badge>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onInspectExternalBook(item)}
                        className="text-left w-full cursor-pointer group"
                      >
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm line-clamp-2 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                          {item.title}
                        </h4>
                      </button>

                      <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                        {item.authorText}
                      </p>

                      <p className="text-[10px] font-mono-tabular text-slate-500 dark:text-slate-400 truncate">
                        {item.publishYear || '—'}
                        {item.pageCount ? ` · ${item.pageCount} tr.` : ''}
                        {item.language ? ` · ${formatLanguageLabel(item.language)}` : ''}
                        {item.ratingsAverage !== undefined ? (
                          <span className="inline-flex items-center gap-0.5 ml-1.5 text-amber-600 dark:text-amber-400">
                            <Star className="w-2.5 h-2.5 inline" /> {item.ratingsAverage}
                          </span>
                        ) : null}
                      </p>

                      {(item.isbn13 || item.isbn10) && (
                        <p className="text-[10px] font-mono-tabular text-slate-500 dark:text-slate-400 truncate">
                          ISBN: {item.isbn13 || item.isbn10}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 mt-2 border-t border-white/35 dark:border-white/10 flex items-center justify-between gap-1.5 text-[11px]">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onInspectExternalBook(item)}
                          className="text-sky-600 dark:text-sky-400 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        >
                          <Eye className="w-3 h-3" /> Chi tiết
                        </button>
                        {(item.previewLink || item.infoLink) && (
                          <a
                            href={item.previewLink || item.infoLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 inline-flex items-center gap-0.5"
                            title="Mở liên kết nguồn"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      {canManageCatalog && !existingBook && (
                        <button
                          type="button"
                          data-testid={`btn-import-external-${item.uid}`}
                          onClick={() => openQuickImport(item)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                        >
                          <BookPlus className="w-3 h-3" /> Nhập kho
                        </button>
                      )}
                    </div>
                  </div>
                </LiquidCard>
              );
            })}
          </div>
        )
      )}

      {/* Gutenberg Text Reader Modal */}
      <Modal
        isOpen={readerOpen}
        onClose={() => setReaderOpen(false)}
        title={readerData?.title ? `Đọc Ebook: ${readerData.title}` : 'Trình đọc Project Gutenberg'}
        maxWidth="3xl"
      >
        <div className="space-y-3 text-xs">
          {readerLoading ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-7 h-7 rounded-full border-[3px] border-amber-500 border-t-transparent animate-spin mx-auto" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">
                Đang tải bản văn bản từ Project Gutenberg...
              </p>
            </div>
          ) : readerError ? (
            <div className="p-3.5 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{readerError}</span>
            </div>
          ) : (
              readerData && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Nguồn: Project Gutenberg (#{readerData.id}) · Bôi đen từ tiếng Anh để tra Wiktionary + Datamuse</span>
                    {readerData.truncated && (
                      <span>Hiển thị 36.000 ký tự đầu tiên để tối ưu tốc độ đọc.</span>
                    )}
                  </div>

                  {/* In-Reader Search + Inline Wiktionary/Datamuse Lexicon Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={readerFind}
                        onChange={(e) => setReaderFind(e.target.value)}
                        placeholder="Tìm cụm từ trong tác phẩm..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 outline-none"
                      />
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void lookupReaderLexicon(lexiconWord);
                      }}
                      className="flex gap-1.5"
                    >
                      <input
                        type="text"
                        data-testid="reader-lexicon-input"
                        value={lexiconWord}
                        onChange={(e) => setLexiconWord(e.target.value)}
                        placeholder="Tra từ Wiktionary + Datamuse..."
                        className="flex-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 outline-none"
                      />
                      <button
                        type="submit"
                        disabled={lexiconLoading}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer disabled:opacity-50"
                      >
                        {lexiconLoading ? '...' : 'Tra từ'}
                      </button>
                    </form>
                  </div>

                  {(lexiconLoading || lexiconError || lexiconData) && (
                    <div
                      data-testid="reader-lexicon-card"
                      className="p-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/70 space-y-1.5"
                    >
                      {lexiconLoading ? (
                        <p className="text-indigo-700 dark:text-indigo-300 font-medium">
                          Đang tra Wiktionary &amp; Datamuse cho &quot;{lexiconWord}&quot;...
                        </p>
                      ) : lexiconError ? (
                        <p className="text-rose-600 dark:text-rose-400">{lexiconError}</p>
                      ) : (
                        lexiconData && (
                          <>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-sm text-indigo-900 dark:text-indigo-200">
                                  {lexiconData.word}
                                </span>
                                {lexiconData.ipa && (
                                  <span className="font-mono text-indigo-600 dark:text-indigo-300">
                                    {lexiconData.ipa}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => setLexiconData(null)}
                                className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                              >
                                Đóng từ điển
                              </button>
                            </div>
                            {lexiconData.meanings.slice(0, 2).map((m, idx) => (
                              <div key={`${m.partOfSpeech}-${idx}`} className="text-[11px] text-slate-700 dark:text-slate-200">
                                <span className="font-bold text-indigo-700 dark:text-indigo-300">{m.partOfSpeech}: </span>
                                {m.definitions[0]?.definition}
                              </div>
                            ))}
                            {(lexiconData.synonyms.length > 0 || lexiconData.antonyms.length > 0) && (
                              <div className="flex flex-wrap gap-3 text-[11px] pt-0.5">
                                {lexiconData.synonyms.length > 0 && (
                                  <span className="text-emerald-700 dark:text-emerald-300">
                                    <strong>Đồng nghĩa:</strong> {lexiconData.synonyms.slice(0, 5).join(', ')}
                                  </span>
                                )}
                                {lexiconData.antonyms.length > 0 && (
                                  <span className="text-rose-700 dark:text-rose-300">
                                    <strong>Trái nghĩa:</strong> {lexiconData.antonyms.slice(0, 4).join(', ')}
                                  </span>
                                )}
                              </div>
                            )}
                          </>
                        )
                      )}
                    </div>
                  )}

                  <div
                    onMouseUp={handleReaderSelection}
                    className="max-h-[54vh] overflow-y-auto p-4 rounded-xl bg-amber-50/70 dark:bg-slate-900/90 border border-amber-200/70 dark:border-slate-700 font-serif text-sm leading-relaxed text-slate-800 dark:text-slate-100 whitespace-pre-wrap select-text"
                  >
                    {readerFind.trim().length >= 2
                      ? readerData.text
                          .split(new RegExp(`(${readerFind.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
                          .map((part, idx) =>
                            part.toLowerCase() === readerFind.trim().toLowerCase() ? (
                              <mark key={idx} className="bg-amber-300 text-slate-900 rounded px-0.5">
                                {part}
                              </mark>
                            ) : (
                              <React.Fragment key={idx}>{part}</React.Fragment>
                            )
                          )
                      : readerData.text}
                  </div>
                </>
              )
            )}
          </div>
        </Modal>

      {/* Quick Import Confirmation Modal */}
      <Modal
        isOpen={Boolean(quickImportTarget)}
        onClose={() => setQuickImportTarget(null)}
        title="Nhập đầu sách vào thư viện trường"
        maxWidth="md"
      >
        {quickImportTarget && (
          <form onSubmit={handleConfirmQuickImport} className="space-y-3.5 text-xs">
            <div className="flex gap-3 p-3 rounded-xl glass-subsurface">
              <BookCoverThumb
                coverUrl={quickImportTarget.coverUrl}
                title={quickImportTarget.title}
                category={quickCategory}
                size="sm"
              />
              <div className="min-w-0 space-y-0.5">
                <p className="font-bold text-slate-800 dark:text-slate-100 line-clamp-2">
                  {quickImportTarget.title}
                </p>
                <p className="text-slate-600 dark:text-slate-300 truncate">
                  {quickImportTarget.authorText}
                </p>
                <p className="font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400">
                  ISBN: {quickImportTarget.isbn13 || quickImportTarget.isbn10 || 'Tự sinh'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Số bản sao nhập *
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  required
                  value={quickCopies}
                  onChange={(e) => setQuickCopies(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full glass-subsurface rounded-xl px-3 py-2 font-mono-tabular text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Vị trí kệ sách *
                </label>
                <input
                  type="text"
                  required
                  value={quickShelf}
                  onChange={(e) => setQuickShelf(e.target.value)}
                  className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Thể loại thư viện *
              </label>
              <select
                value={quickCategory}
                onChange={(e) => setQuickCategory(e.target.value)}
                className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none"
              >
                {categoryOptions.map((opt) => (
                  <option key={opt.id} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-white/40 dark:border-white/10">
              <button
                type="button"
                onClick={() => setQuickImportTarget(null)}
                className="px-4 py-2 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isQuickSaving}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isQuickSaving ? 'Đang lưu...' : 'Lưu vào kho & Sinh mã bản sao'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
