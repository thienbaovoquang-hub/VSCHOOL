import React, { useState, useEffect } from 'react';
import type { Book } from '../../types';
import {
  formatLanguageLabel,
  mergeBookEnrichment,
  type ExternalBookResult,
  type ExternalEnrichResponse,
} from '../../utils/libraryExternalApis';
import {
  formatAcademicCitation,
  type CitationFormat,
  type LexiconLookupResult,
} from '../../utils/externalIntegrations';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { BookCoverThumb } from './BookCoverThumb';
import {
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  RefreshCw,
  Sparkles,
  Star,
  AlertTriangle,
} from '../icons/UiIcons';

interface BookDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  book?: Book | null;
  externalResult?: ExternalBookResult | null;
  categoryOptions: Array<{ id: string; value: string; label: string }>;
  canManageCatalog: boolean;
  copyCount?: number;
  alreadyInCatalogBook?: Book | null;
  onOpenCopies?: (book: Book) => void;
  onEnrichBook?: (updatedBook: Book) => Promise<void> | void;
  onImportExternalBook?: (
    external: ExternalBookResult,
    options: { totalCopies: number; shelfLocation: string; category: string }
  ) => Promise<void> | void;
}

export const BookDetailModal: React.FC<BookDetailModalProps> = ({
  isOpen,
  onClose,
  book,
  externalResult,
  categoryOptions,
  canManageCatalog,
  copyCount = 0,
  alreadyInCatalogBook,
  onOpenCopies,
  onEnrichBook,
  onImportExternalBook,
}) => {
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichFeedback, setEnrichFeedback] = useState<{
    type: 'ok' | 'err';
    msg: string;
  } | null>(null);

  const [importCopies, setImportCopies] = useState(5);
  const [importShelf, setImportShelf] = useState('Kệ A1');
  const [importCategory, setImportCategory] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const [wikiLoading, setWikiLoading] = useState(false);
  const [wikiSummary, setWikiSummary] = useState<{
    title: string;
    description: string;
    extract: string;
    pageUrl: string;
    thumbnailUrl?: string;
  } | null>(null);
  const [wikiError, setWikiError] = useState<string | null>(null);
  const [copiedCite, setCopiedCite] = useState<string | null>(null);
  const [pgOpen, setPgOpen] = useState(false);
  const [pgLoading, setPgLoading] = useState(false);
  const [pgError, setPgError] = useState<string | null>(null);
  const [pgText, setPgText] = useState<{ id: number; text: string; truncated: boolean } | null>(null);
  const [pgWord, setPgWord] = useState('');
  const [pgLexicon, setPgLexicon] = useState<LexiconLookupResult | null>(null);

  useEffect(() => {
    setEnrichFeedback(null);
    setWikiSummary(null);
    setWikiError(null);
    setCopiedCite(null);
    setPgOpen(false);
    setPgText(null);
    setPgError(null);
    setPgLexicon(null);
    if (externalResult) {
      setImportCategory(externalResult.mappedCategory || 'Sách giáo khoa & Tham khảo');
      setImportCopies(5);
      setImportShelf('Kệ A1');
    }
  }, [book?.id, externalResult?.uid, isOpen]);

  if (!isOpen || (!book && !externalResult)) return null;

  const isLocal = Boolean(book);
  const title = book?.title || externalResult?.title || '';
  const subtitle = book?.subtitle || externalResult?.subtitle;
  const author = book?.author || externalResult?.authorText || 'Chưa rõ tác giả';
  const publisher = book?.publisher || externalResult?.publisher || 'Chưa rõ NXB';
  const publishYear = book?.publishYear || externalResult?.publishYear || 0;
  const isbn13 = book?.isbn || externalResult?.isbn13 || '';
  const isbn10 = book?.isbn10 || externalResult?.isbn10 || '';
  const pageCount = book?.pageCount || externalResult?.pageCount;
  const language = book?.language || externalResult?.language;
  const category = book?.category || externalResult?.mappedCategory || 'Sách giáo khoa & Tham khảo';
  const coverUrl = book?.coverUrl || externalResult?.coverUrl || '';
  const description = book?.description || externalResult?.description || '';
  const subjects = book?.subjects || externalResult?.categoriesRaw || [];
  const ratingsAverage = book?.ratingsAverage ?? externalResult?.ratingsAverage;
  const ratingsCount = book?.ratingsCount ?? externalResult?.ratingsCount;
  const previewLink = book?.previewLink || externalResult?.previewLink;
  const infoLink = book?.infoLink || externalResult?.infoLink;
  const openLibraryKey = book?.openLibraryKey || externalResult?.openLibraryKey;

  const sourceLabels: string[] = [];
  if (book) {
    if (book.externalSource === 'merged') {
      sourceLabels.push('Google Books', 'Open Library');
    } else if (book.externalSource === 'google_books') {
      sourceLabels.push('Google Books');
    } else if (book.externalSource === 'open_library') {
      sourceLabels.push('Open Library');
    }
  } else if (externalResult) {
    if (externalResult.sources.includes('google_books')) sourceLabels.push('Google Books');
    if (externalResult.sources.includes('open_library')) sourceLabels.push('Open Library');
  }

  const openLibraryHref =
    openLibraryKey && openLibraryKey.startsWith('/')
      ? `https://openlibrary.org${openLibraryKey}`
      : infoLink && infoLink.includes('openlibrary.org')
      ? infoLink
      : '';

  const googleBooksHref =
    previewLink && previewLink.includes('google.')
      ? previewLink
      : infoLink && infoLink.includes('google.')
      ? infoLink
      : book?.googleBooksId
      ? `https://books.google.com/books?id=${encodeURIComponent(book.googleBooksId)}`
      : externalResult?.googleBooksId
      ? `https://books.google.com/books?id=${encodeURIComponent(externalResult.googleBooksId)}`
      : '';

  const handleEnrichSingleBook = async () => {
    if (!book || !onEnrichBook) return;
    setIsEnriching(true);
    setEnrichFeedback(null);
    try {
      const resp = await fetch('/api/library/enrich-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isbn: book.isbn,
          title: book.title,
          author: book.author,
        }),
      });
      const data = (await resp.json()) as ExternalEnrichResponse;
      if (!resp.ok || !data.found || !data.match) {
        setEnrichFeedback({
          type: 'err',
          msg:
            data.warnings?.[0] ||
            'Không tìm thấy thêm dữ liệu mới trên Google Books hoặc Open Library cho đầu sách này.',
        });
        return;
      }

      const updated = mergeBookEnrichment(book, data.match);
      await onEnrichBook(updated);
      const srcNames = data.sources
        .map((s) => (s === 'google_books' ? 'Google Books' : 'Open Library'))
        .join(' & ');
      setEnrichFeedback({
        type: 'ok',
        msg: `Đã cập nhật ảnh bìa, tóm tắt và siêu dữ liệu từ ${srcNames || 'nguồn ngoài'}.`,
      });
    } catch (err) {
      setEnrichFeedback({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Lỗi kết nối dịch vụ làm giàu dữ liệu sách.',
      });
    } finally {
      setIsEnriching(false);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!externalResult || !onImportExternalBook) return;
    setIsImporting(true);
    try {
      await onImportExternalBook(externalResult, {
        totalCopies: importCopies,
        shelfLocation: importShelf,
        category: importCategory,
      });
      onClose();
    } finally {
      setIsImporting(false);
    }
  };

  const handleLookupWikipedia = async (queryText: string, lang: 'vi' | 'en' = 'vi') => {
    const clean = queryText.trim();
    if (!clean) return;
    setWikiLoading(true);
    setWikiError(null);
    try {
      const res = await fetch(
        `/api/external/wikipedia?q=${encodeURIComponent(clean)}&lang=${lang}`
      );
      const data = await res.json();
      if (!res.ok || !data.summary) {
        setWikiError(data.error || `Không tìm thấy thông tin Wikipedia cho "${clean}".`);
        setWikiSummary(null);
        return;
      }
      setWikiSummary(data.summary);
    } catch {
      setWikiError('Lỗi kết nối Wikipedia REST API.');
    } finally {
      setWikiLoading(false);
    }
  };

  const gutenbergIdMatch =
    /^PG-(\d+)$/i.exec(isbn13) ||
    /gutenberg\.org\/ebooks\/(\d+)/i.exec(infoLink || '') ||
    /gutenberg\.org\/ebooks\/(\d+)/i.exec(previewLink || '');
  const gutenbergBookId = gutenbergIdMatch ? Number(gutenbergIdMatch[1]) : null;
  const isAcademicCatalogBook =
    book?.externalSource === 'crossref' || book?.externalSource === 'arxiv';

  const handleToggleGutenbergReader = async () => {
    if (!gutenbergBookId) return;
    if (pgOpen) {
      setPgOpen(false);
      return;
    }
    setPgOpen(true);
    if (pgText?.id === gutenbergBookId) return;
    setPgLoading(true);
    setPgError(null);
    try {
      const res = await fetch(`/api/library/gutendex-text?id=${gutenbergBookId}`);
      const data = await res.json();
      if (!res.ok || !data.text) {
        setPgError(data.error || 'Không tải được nội dung từ Project Gutenberg.');
        return;
      }
      setPgText({ id: gutenbergBookId, text: data.text, truncated: Boolean(data.truncated) });
    } catch {
      setPgError('Lỗi kết nối Project Gutenberg.');
    } finally {
      setPgLoading(false);
    }
  };

  const handleLookupPgWord = async (word: string) => {
    const clean = word.trim().replace(/^[^a-zA-Z0-9'-]+|[^a-zA-Z0-9'-]+$/g, '');
    if (!clean) return;
    setPgWord(clean);
    try {
      const res = await fetch(`/api/external/lexicon?word=${encodeURIComponent(clean)}&lang=en`);
      const data = await res.json();
      if (res.ok && data.entry) setPgLexicon(data.entry);
    } catch {
      // ignore lexicon lookup errors
    }
  };

  const handleCopyAcademicCite = async (fmt: CitationFormat) => {
    if (!book) return;
    const isArxiv = book.externalSource === 'arxiv';
    const text = formatAcademicCitation(
      {
        source: isArxiv ? 'arxiv' : 'crossref',
        title: book.title,
        authors: book.author.split(',').map((s) => s.trim()).filter(Boolean),
        authorText: book.author,
        publishedYear: book.publishYear || new Date().getFullYear(),
        venue: book.publisher || (isArxiv ? 'arXiv' : 'Crossref'),
        doi: !isArxiv && book.isbn.includes('/') ? book.isbn : undefined,
        arxivId: isArxiv ? book.isbn : undefined,
        url: book.infoLink || book.previewLink || '',
      },
      fmt
    );
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCite(fmt);
      setTimeout(() => setCopiedCite(null), 2000);
    } catch {
      setEnrichFeedback({ type: 'ok', msg: `${fmt.toUpperCase()}: ${text}` });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isLocal ? 'Chi tiết Đầu sách Thư viện' : 'Chi tiết Ấn phẩm Tra cứu'}
      maxWidth="3xl"
    >
      <div className="space-y-5 text-xs">
        {/* Hero section */}
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
          <div className="flex justify-center sm:justify-start">
            <BookCoverThumb
              coverUrl={coverUrl}
              title={title}
              author={author}
              category={category}
              size="lg"
            />
          </div>

          <div className="flex-1 min-w-0 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="blue" size="sm">
                {category}
              </Badge>
              {book && (
                <Badge variant={book.availableCopies > 0 ? 'mint' : 'pink'} size="sm">
                  Còn {book.availableCopies}/{book.totalCopies} cuốn
                </Badge>
              )}
              {sourceLabels.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                  <Globe className="w-3.5 h-3.5" />
                  {sourceLabels.join(' · ')}
                </span>
              )}
            </div>

            <div>
              <h4 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-50 leading-snug">
                {title}
              </h4>
              {subtitle && (
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{subtitle}</p>
              )}
            </div>

            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Tác giả: <span className="font-bold">{author}</span>
            </p>

            {/* Unboxed structured bibliographic metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 pt-2 border-t border-slate-200/70 dark:border-white/10">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Nhà xuất bản
                </p>
                <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {publisher}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Năm xuất bản
                </p>
                <p className="font-mono-tabular font-semibold text-slate-800 dark:text-slate-100">
                  {publishYear || '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Số trang
                </p>
                <p className="font-mono-tabular font-semibold text-slate-800 dark:text-slate-100">
                  {pageCount ? `${pageCount} trang` : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  ISBN-13 / Mã
                </p>
                <p className="font-mono-tabular font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {isbn13 || '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  ISBN-10
                </p>
                <p className="font-mono-tabular font-semibold text-slate-800 dark:text-slate-100">
                  {isbn10 || '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Ngôn ngữ
                </p>
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  {formatLanguageLabel(language)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600 dark:text-slate-300 pt-1">
              {book && (
                <span>
                  Vị trí kệ: <strong className="text-slate-800 dark:text-slate-100">{book.shelfLocation}</strong>
                </span>
              )}
              {ratingsAverage !== undefined && (
                <span className="inline-flex items-center gap-1 font-mono-tabular">
                  <Star className="w-3.5 h-3.5 text-amber-500" />
                  <strong className="text-slate-800 dark:text-slate-100">{ratingsAverage}</strong>
                  {ratingsCount ? ` (${ratingsCount} đánh giá)` : ''}
                </span>
              )}
              {externalResult?.editionsCount && (
                <span className="font-mono-tabular">
                  {externalResult.editionsCount} ấn bản ghi nhận
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Synopsis */}
        <div className="p-3.5 rounded-2xl glass-subsurface space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Giới thiệu &amp; Tóm tắt nội dung
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {gutenbergBookId && (
                <button
                  type="button"
                  data-testid="detail-gutenberg-read-btn"
                  onClick={() => void handleToggleGutenbergReader()}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <BookOpen className="w-3 h-3" />
                  {pgOpen ? 'Ẩn trình đọc Gutenberg' : 'Đọc Ebook Gutenberg'}
                </button>
              )}
              {isAcademicCatalogBook && (['bibtex', 'apa', 'ieee'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => void handleCopyAcademicCite(fmt)}
                  className="px-2 py-1 rounded-lg glass-subsurface hover:bg-white/80 dark:hover:bg-white/10 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 inline-flex items-center gap-1 cursor-pointer"
                >
                  {copiedCite === fmt ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  {copiedCite === fmt ? `Đã chép ${fmt.toUpperCase()}` : `Chép ${fmt.toUpperCase()}`}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-line">
            {description ||
              'Chưa có mô tả chi tiết cho đầu sách này. Thủ thư có thể nhấn "Làm giàu từ Google Books & Open Library" để tự động bổ sung.'}
          </p>
        </div>

        {/* Embedded Gutenberg Reader inside BookDetailModal */}
        {pgOpen && (
          <div className="p-3.5 rounded-2xl glass-subsurface border border-amber-400/35 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-amber-800 dark:text-amber-300">
                Trình đọc Project Gutenberg (#{gutenbergBookId})
              </span>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleLookupPgWord(pgWord);
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={pgWord}
                  onChange={(e) => setPgWord(e.target.value)}
                  placeholder="Tra từ Wiktionary/Datamuse..."
                  className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] outline-none"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-bold cursor-pointer"
                >
                  Tra từ
                </button>
              </form>
            </div>
            {pgLexicon && (
              <div className="p-2.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 text-[11px] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-800 dark:text-indigo-200">
                    {pgLexicon.word} {pgLexicon.ipa || ''}
                  </span>
                  <button type="button" onClick={() => setPgLexicon(null)} className="text-slate-500 cursor-pointer">
                    Ẩn
                  </button>
                </div>
                {pgLexicon.meanings[0] && (
                  <p className="text-slate-700 dark:text-slate-200">
                    <strong>{pgLexicon.meanings[0].partOfSpeech}:</strong>{' '}
                    {pgLexicon.meanings[0].definitions[0]?.definition}
                  </p>
                )}
              </div>
            )}
            {pgLoading ? (
              <p className="text-slate-500">Đang tải nội dung Gutenberg...</p>
            ) : pgError ? (
              <p className="text-rose-600 dark:text-rose-400">{pgError}</p>
            ) : (
              pgText && (
                <div
                  onMouseUp={() => {
                    const sel = window.getSelection()?.toString().trim() || '';
                    if (sel && sel.length <= 28 && !/\s/.test(sel)) void handleLookupPgWord(sel);
                  }}
                  className="max-h-60 overflow-y-auto p-3 rounded-xl bg-amber-50/70 dark:bg-slate-900 font-serif text-xs leading-relaxed text-slate-800 dark:text-slate-100 whitespace-pre-wrap select-text"
                >
                  {pgText.text}
                </div>
              )
            )}
          </div>
        )}

        {/* Wikipedia Author & Literary Context */}
        <div className="p-3.5 rounded-2xl glass-subsurface space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              Bách khoa Wikipedia (Tác phẩm &amp; Tác giả)
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={wikiLoading}
                onClick={() => handleLookupWikipedia(title, 'vi')}
                className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50"
              >
                Tra tác phẩm (VI)
              </button>
              <button
                type="button"
                disabled={wikiLoading}
                onClick={() => handleLookupWikipedia(author.split(',')[0] || title, 'vi')}
                className="px-2.5 py-1 rounded-lg glass-subsurface hover:bg-white/80 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
              >
                Tra tác giả
              </button>
              <button
                type="button"
                disabled={wikiLoading}
                onClick={() => handleLookupWikipedia(title, 'en')}
                className="px-2.5 py-1 rounded-lg glass-subsurface hover:bg-white/80 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
              >
                Wikipedia (EN)
              </button>
            </div>
          </div>

          {wikiLoading && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Đang tra cứu Wikipedia REST API...
            </p>
          )}
          {wikiError && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300">{wikiError}</p>
          )}
          {wikiSummary && !wikiLoading && (
            <div className="flex gap-3 items-start pt-1 border-t border-slate-200/60 dark:border-white/10">
              {wikiSummary.thumbnailUrl && (
                <img
                  src={wikiSummary.thumbnailUrl}
                  alt={wikiSummary.title}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-lg object-cover shrink-0 bg-slate-200 dark:bg-slate-800"
                />
              )}
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-slate-800 dark:text-slate-100">
                    {wikiSummary.title}
                    {wikiSummary.description ? ` — ${wikiSummary.description}` : ''}
                  </p>
                  <a
                    href={wikiSummary.pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> Xem bài gốc
                  </a>
                </div>
                <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                  {wikiSummary.extract}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Subject tags */}
        {subjects.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Chủ đề &amp; Từ khóa thư mục
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {subjects.slice(0, 8).join(' · ')}
            </p>
          </div>
        )}

        {/* Enrichment feedback */}
        {enrichFeedback && (
          <div
            className={`p-3 rounded-xl glass-subsurface flex items-center gap-2 ${
              enrichFeedback.type === 'ok'
                ? 'bg-emerald-500/12 border-emerald-400/35 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-500/12 border-amber-400/35 text-amber-700 dark:text-amber-300'
            }`}
          >
            {enrichFeedback.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{enrichFeedback.msg}</span>
          </div>
        )}

        {/* Import form when inspecting external search result */}
        {!isLocal && externalResult && canManageCatalog && onImportExternalBook && (
          alreadyInCatalogBook ? (
            <div className="p-3 rounded-xl glass-subsurface bg-emerald-500/10 border-emerald-400/30 flex items-center justify-between gap-2">
              <span className="text-emerald-800 dark:text-emerald-200 font-semibold inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Đầu sách này đã có trong kho thư viện ({alreadyInCatalogBook.shelfLocation} · Còn{' '}
                {alreadyInCatalogBook.availableCopies}/{alreadyInCatalogBook.totalCopies})
              </span>
            </div>
          ) : (
            <form
              onSubmit={handleImportSubmit}
              className="p-3.5 rounded-2xl glass-subsurface space-y-3 border border-emerald-500/25"
            >
              <p className="font-bold text-slate-800 dark:text-slate-100">
                Nhập ấn phẩm vào kho thư viện (tự động sinh mã vạch BookCopy)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Số bản sao nhập *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    required
                    value={importCopies}
                    onChange={(e) => setImportCopies(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full glass-subsurface rounded-xl px-3 py-1.5 font-mono-tabular text-slate-800 dark:text-slate-100 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Vị trí kệ sách *
                  </label>
                  <input
                    type="text"
                    required
                    value={importShelf}
                    onChange={(e) => setImportShelf(e.target.value)}
                    placeholder="VD: Kệ B2"
                    className="w-full glass-subsurface rounded-xl px-3 py-1.5 text-slate-800 dark:text-slate-100 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Thể loại thư viện *
                  </label>
                  <select
                    value={importCategory}
                    onChange={(e) => setImportCategory(e.target.value)}
                    className="w-full glass-subsurface rounded-xl px-3 py-1.5 text-slate-800 dark:text-slate-100 outline-none"
                  >
                    {categoryOptions.map((opt) => (
                      <option key={opt.id} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isImporting}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isImporting ? 'Đang lưu vào kho...' : `Xác nhận nhập ${importCopies} bản`}
                </button>
              </div>
            </form>
          )
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200/80 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            {googleBooksHref && (
              <a
                href={googleBooksHref}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-white/10 text-sky-700 dark:text-sky-300 font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Google Books
              </a>
            )}
            {openLibraryHref && (
              <a
                href={openLibraryHref}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-white/10 text-emerald-700 dark:text-emerald-300 font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open Library
              </a>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {book && onOpenCopies && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCopies(book);
                }}
                className="px-3 py-1.5 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
              >
                <Eye className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                Xem {copyCount} bản sao
              </button>
            )}
            {book && canManageCatalog && onEnrichBook && (
              <button
                type="button"
                disabled={isEnriching}
                onClick={handleEnrichSingleBook}
                className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isEnriching ? 'animate-spin' : ''}`} />
                {isEnriching ? 'Đang đồng bộ...' : 'Làm giàu từ Google Books & Open Library'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl glass-subsurface hover:bg-white/75 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
