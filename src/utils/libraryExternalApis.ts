import type { Book } from '../types';

export type ExternalBookSource = 'google_books' | 'open_library';
export type ExternalSearchSourceFilter = 'all' | ExternalBookSource;
export type ExternalSearchMode = 'all' | 'title' | 'author' | 'isbn';

export interface ExternalBookResult {
  uid: string;
  sources: ExternalBookSource[];
  googleBooksId?: string;
  openLibraryKey?: string;
  title: string;
  subtitle?: string;
  authors: string[];
  authorText: string;
  isbn13: string;
  isbn10: string;
  publisher: string;
  publishYear: number;
  description: string;
  categoriesRaw: string[];
  mappedCategory: string;
  pageCount?: number;
  language?: string;
  coverUrl: string;
  thumbnailUrl?: string;
  previewLink?: string;
  infoLink?: string;
  ratingsAverage?: number;
  ratingsCount?: number;
  editionsCount?: number;
}

export interface ExternalSearchResponse {
  query: string;
  source: ExternalSearchSourceFilter;
  mode: ExternalSearchMode;
  totalMerged: number;
  googleCount: number;
  openLibraryCount: number;
  googleRateLimited?: boolean;
  warnings: string[];
  results: ExternalBookResult[];
}

export interface ExternalIsbnLookupResponse {
  found: boolean;
  isbn: string;
  result: ExternalBookResult | null;
  sources: ExternalBookSource[];
  warnings?: string[];
}

export interface ExternalEnrichResponse {
  found: boolean;
  match: ExternalBookResult | null;
  sources: ExternalBookSource[];
  warnings?: string[];
}

export interface GoogleVolumeItem {
  id?: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    industryIdentifiers?: Array<{ type?: string; identifier?: string }>;
    pageCount?: number;
    categories?: string[];
    averageRating?: number;
    ratingsCount?: number;
    imageLinks?: {
      extraLarge?: string;
      large?: string;
      medium?: string;
      small?: string;
      thumbnail?: string;
      smallThumbnail?: string;
    };
    language?: string;
    previewLink?: string;
    infoLink?: string;
    canonicalVolumeLink?: string;
  };
}

export interface OpenLibrarySearchDoc {
  key?: string;
  title?: string;
  subtitle?: string;
  author_name?: string[];
  first_publish_year?: number;
  publish_year?: number[];
  publisher?: string[];
  isbn?: string[];
  cover_i?: number;
  cover_edition_key?: string;
  edition_key?: string[];
  subject?: string[];
  number_of_pages_median?: number;
  language?: string[];
  edition_count?: number;
  ratings_average?: number;
  ratings_count?: number;
  id_google?: string[];
  first_sentence?: string[] | string;
}

export interface OpenLibraryBookDataEntry {
  url?: string;
  key?: string;
  title?: string;
  subtitle?: string;
  authors?: Array<{ name?: string; url?: string }>;
  publishers?: Array<{ name?: string }>;
  publish_date?: string;
  number_of_pages?: number;
  subjects?: Array<{ name?: string; url?: string }>;
  identifiers?: {
    isbn_10?: string[];
    isbn_13?: string[];
    openlibrary?: string[];
    google?: string[];
  };
  cover?: {
    small?: string;
    medium?: string;
    large?: string;
  };
  excerpts?: Array<{ text?: string }>;
  notes?: string;
}

const VALID_BOOK_CATEGORIES = [
  'Khoa học tự nhiên',
  'Văn học & Ngữ văn',
  'Công nghệ & Tin học',
  'Ngoại ngữ',
  'Kỹ năng sống',
  'Sách giáo khoa & Tham khảo',
  'Lịch sử & Xã hội',
] as const;

export function normalizeIsbn(raw?: string | null): string {
  if (!raw) return '';
  const cleaned = String(raw)
    .toUpperCase()
    .replace(/[^0-9X]/g, '');
  if (cleaned.length === 13 || cleaned.length === 10) {
    return cleaned;
  }
  return '';
}

export function extractIsbnPair(candidates: Array<{ type?: string; identifier?: string } | string>): {
  isbn13: string;
  isbn10: string;
} {
  let isbn13 = '';
  let isbn10 = '';

  for (const item of candidates) {
    const raw = typeof item === 'string' ? item : item?.identifier || '';
    const norm = normalizeIsbn(raw);
    if (!norm) continue;
    if (norm.length === 13 && !isbn13) {
      isbn13 = norm;
    } else if (norm.length === 10 && !isbn10) {
      isbn10 = norm;
    }
  }

  return { isbn13, isbn10 };
}

export function parsePublishYear(raw?: string | number | number[] | null): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const y = Math.trunc(raw);
    if (y >= 1400 && y <= 2100) return y;
  }
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const parsed = parsePublishYear(entry);
      if (parsed > 0) return parsed;
    }
    return 0;
  }
  if (typeof raw === 'string') {
    const match = raw.match(/\b(1[4-9]\d{2}|20\d{2}|2100)\b/);
    if (match) {
      return Number(match[1]);
    }
  }
  return 0;
}

export function stripHtmlTags(raw?: string | null): string {
  if (!raw) return '';
  return String(raw)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function upgradeCoverUrlToHttps(raw?: string | null): string {
  if (!raw) return '';
  let trimmed = String(raw).trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://')) {
    trimmed = `https://${trimmed.slice('http://'.length)}`;
  }
  if (!trimmed.startsWith('https://')) {
    return '';
  }
  if (trimmed.includes('books.google.')) {
    trimmed = trimmed.replace(/&edge=curl/gi, '');
  }
  return trimmed;
}

export function upgradeExternalLinkToHttps(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (trimmed.startsWith('http://')) {
    return `https://${trimmed.slice('http://'.length)}`;
  }
  if (trimmed.startsWith('https://')) {
    return trimmed;
  }
  return '';
}

export function mapSubjectsToBookCategory(
  subjects: string[] = [],
  title: string = '',
  description: string = ''
): string {
  const subjectText = subjects.join(' ').toLowerCase();
  const titleText = `${title} ${description}`.toLowerCase();

  const rules: Array<{ category: (typeof VALID_BOOK_CATEGORIES)[number]; regex: RegExp }> = [
    {
      category: 'Công nghệ & Tin học',
      regex: /\b(computer|computers|programming|software|coding|javascript|python|typescript|algorithm|algorithms|artificial intelligence|machine learning|data science|informatics|tin học|công nghệ thông tin|lập trình)\b/gi,
    },
    {
      category: 'Khoa học tự nhiên',
      regex: /\b(science|physics|chemistry|biology|mathematics|math|astronomy|cosmology|ecology|botany|genetics|astrophysics|quantum|toán học|vật lý|hóa học|sinh học|khoa học tự nhiên|vũ trụ)\b/gi,
    },
    {
      category: 'Ngoại ngữ',
      regex: /\b(language|english|french|spanish|japanese|chinese|grammar|dictionary|linguistics|ielts|toefl|toeic|ngoại ngữ|tiếng anh|từ vựng|ngữ pháp)\b/gi,
    },
    {
      category: 'Lịch sử & Xã hội',
      regex: /\b(history|historical|humankind|anthropology|civilization|geography|politics|economics|philosophy|sociology|culture|biography|world war|lịch sử|địa lý|xã hội|kinh tế|triết học|văn hóa|nhân loại)\b/gi,
    },
    {
      category: 'Kỹ năng sống',
      regex: /\b(self-help|psychology|productivity|habits|leadership|study skills|motivation|mindfulness|career|kỹ năng|tâm lý|phát triển bản thân|hướng nghiệp)\b/gi,
    },
    {
      category: 'Văn học & Ngữ văn',
      regex: /\b(literature|fiction|novel|poetry|drama|classic|short stories|essays|văn học|tiểu thuyết|thơ|truyện|ngữ văn)\b/gi,
    },
    {
      category: 'Sách giáo khoa & Tham khảo',
      regex: /\b(textbook|study guide|workbook|exam|reference|education|giáo khoa|tham khảo|ôn thi|bài tập)\b/gi,
    },
  ];

  let bestCategory: string = 'Sách giáo khoa & Tham khảo';
  let bestScore = 0;

  for (const rule of rules) {
    const subjMatches = subjectText.match(rule.regex)?.length || 0;
    const titleMatches = titleText.match(rule.regex)?.length || 0;
    const score = subjMatches * 2 + titleMatches * 3;
    if (score > bestScore) {
      bestScore = score;
      bestCategory = rule.category;
    }
  }

  return bestCategory;
}

export async function fetchGoogleBooksClientFallback(
  query: string,
  mode: ExternalSearchMode = 'all',
  lang: string = '',
  maxResults: number = 15
): Promise<ExternalBookResult[]> {
  const builtQ = buildGoogleBooksQuery(query, mode);
  if (!builtQ) return [];
  const params = new URLSearchParams({
    q: builtQ,
    maxResults: String(Math.max(1, Math.min(20, maxResults))),
    printType: 'books',
  });
  if (lang === 'vi' || lang === 'en') {
    params.set('langRestrict', lang);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: GoogleVolumeItem[] };
    const items = Array.isArray(data?.items) ? data.items : [];
    return items
      .map((item) => normalizeGoogleBooksVolume(item))
      .filter((item): item is ExternalBookResult => Boolean(item));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export function normalizeBookCategoryChoice(category?: string | null): string {
  if (!category) return 'Sách giáo khoa & Tham khảo';
  const found = VALID_BOOK_CATEGORIES.find(
    (c) => c.toLowerCase() === category.trim().toLowerCase()
  );
  return found || 'Sách giáo khoa & Tham khảo';
}

export function buildGoogleBooksQuery(
  rawQuery: string,
  mode: ExternalSearchMode = 'all'
): string {
  const q = rawQuery.trim();
  if (!q) return '';
  if (mode === 'isbn') {
    const cleanIsbn = normalizeIsbn(q) || q.replace(/[^0-9Xx]/g, '');
    return `isbn:${cleanIsbn || q}`;
  }
  if (mode === 'title') {
    return `intitle:${q}`;
  }
  if (mode === 'author') {
    return `inauthor:${q}`;
  }
  return q;
}

export function buildOpenLibrarySearchParams(
  rawQuery: string,
  mode: ExternalSearchMode = 'all',
  lang: string = '',
  limit: number = 15
): URLSearchParams {
  const params = new URLSearchParams();
  const q = rawQuery.trim();
  if (mode === 'isbn') {
    const cleanIsbn = normalizeIsbn(q) || q.replace(/[^0-9Xx]/g, '');
    params.set('isbn', cleanIsbn || q);
  } else if (mode === 'title') {
    params.set('title', q);
  } else if (mode === 'author') {
    params.set('author', q);
  } else {
    params.set('q', q);
  }

  if (lang === 'vi') {
    params.set('language', 'vie');
  } else if (lang === 'en') {
    params.set('language', 'eng');
  }

  params.set(
    'fields',
    [
      'key',
      'title',
      'subtitle',
      'author_name',
      'first_publish_year',
      'publish_year',
      'publisher',
      'isbn',
      'cover_i',
      'cover_edition_key',
      'subject',
      'number_of_pages_median',
      'language',
      'edition_count',
      'ratings_average',
      'ratings_count',
      'id_google',
      'first_sentence',
    ].join(',')
  );
  params.set('limit', String(Math.max(1, Math.min(25, limit))));
  return params;
}

export function normalizeGoogleBooksVolume(item: GoogleVolumeItem): ExternalBookResult | null {
  const info = item?.volumeInfo;
  const title = (info?.title || '').trim();
  if (!title) return null;

  const { isbn13, isbn10 } = extractIsbnPair(info?.industryIdentifiers || []);
  const authors = Array.isArray(info?.authors)
    ? info.authors.map((a) => String(a).trim()).filter(Boolean)
    : [];
  const categoriesRaw = Array.isArray(info?.categories)
    ? info.categories.map((c) => String(c).trim()).filter(Boolean)
    : [];
  const description = stripHtmlTags(info?.description);
  const publishYear = parsePublishYear(info?.publishedDate);
  const publisher = (info?.publisher || '').trim();
  const imageLinks = info?.imageLinks || {};
  const rawCover =
    imageLinks.large ||
    imageLinks.medium ||
    imageLinks.thumbnail ||
    imageLinks.smallThumbnail ||
    imageLinks.small ||
    '';
  const coverUrl = upgradeCoverUrlToHttps(rawCover);
  const thumbnailUrl = upgradeCoverUrlToHttps(imageLinks.thumbnail || imageLinks.smallThumbnail || rawCover);
  const googleBooksId = (item.id || '').trim() || undefined;
  const uid = isbn13
    ? `isbn:${isbn13}`
    : isbn10
    ? `isbn:${isbn10}`
    : `gb:${googleBooksId || normalizeTitleAuthorKey(title, authors[0] || '')}`;

  return {
    uid,
    sources: ['google_books'],
    googleBooksId,
    title,
    subtitle: info?.subtitle?.trim() || undefined,
    authors,
    authorText: authors.length > 0 ? authors.join(', ') : 'Chưa rõ tác giả',
    isbn13,
    isbn10,
    publisher: publisher || 'Chưa rõ NXB',
    publishYear: publishYear || new Date().getFullYear(),
    description,
    categoriesRaw,
    mappedCategory: mapSubjectsToBookCategory(categoriesRaw, title, description),
    pageCount:
      typeof info?.pageCount === 'number' && info.pageCount > 0
        ? Math.trunc(info.pageCount)
        : undefined,
    language: info?.language?.trim() || undefined,
    coverUrl,
    thumbnailUrl: thumbnailUrl || undefined,
    previewLink: upgradeExternalLinkToHttps(info?.previewLink) || undefined,
    infoLink: upgradeExternalLinkToHttps(info?.infoLink || info?.canonicalVolumeLink) || undefined,
    ratingsAverage:
      typeof info?.averageRating === 'number' && Number.isFinite(info.averageRating)
        ? Number(info.averageRating.toFixed(2))
        : undefined,
    ratingsCount:
      typeof info?.ratingsCount === 'number' && info.ratingsCount > 0
        ? Math.trunc(info.ratingsCount)
        : undefined,
  };
}

export function normalizeOpenLibraryDoc(doc: OpenLibrarySearchDoc): ExternalBookResult | null {
  const title = (doc?.title || '').trim();
  if (!title) return null;

  const { isbn13, isbn10 } = extractIsbnPair(doc?.isbn || []);
  const authors = Array.isArray(doc?.author_name)
    ? doc.author_name.map((a) => String(a).trim()).filter(Boolean)
    : [];
  const categoriesRaw = Array.isArray(doc?.subject)
    ? doc.subject
        .map((s) => String(s).trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];
  const rawFirstSentence = Array.isArray(doc?.first_sentence)
    ? doc.first_sentence[0]
    : doc?.first_sentence;
  const description = stripHtmlTags(rawFirstSentence);
  const publishYear = parsePublishYear(doc?.first_publish_year ?? doc?.publish_year);
  const publisher = Array.isArray(doc?.publisher)
    ? doc.publisher.map((p) => String(p).trim()).find(Boolean) || ''
    : '';
  const openLibraryKey = (doc?.key || '').trim() || undefined;

  let coverUrl = '';
  let thumbnailUrl = '';
  if (typeof doc?.cover_i === 'number' && doc.cover_i > 0) {
    coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
    thumbnailUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
  } else if (doc?.cover_edition_key) {
    coverUrl = `https://covers.openlibrary.org/b/olid/${doc.cover_edition_key}-L.jpg`;
    thumbnailUrl = `https://covers.openlibrary.org/b/olid/${doc.cover_edition_key}-M.jpg`;
  } else if (isbn13 || isbn10) {
    const code = isbn13 || isbn10;
    coverUrl = `https://covers.openlibrary.org/b/isbn/${code}-L.jpg`;
    thumbnailUrl = `https://covers.openlibrary.org/b/isbn/${code}-M.jpg`;
  }

  const language = Array.isArray(doc?.language)
    ? mapOpenLibraryLanguage(doc.language[0])
    : undefined;

  const googleBooksId = Array.isArray(doc?.id_google)
    ? doc.id_google.map((g) => String(g).trim()).find(Boolean)
    : undefined;

  const uid = isbn13
    ? `isbn:${isbn13}`
    : isbn10
    ? `isbn:${isbn10}`
    : `ol:${openLibraryKey || normalizeTitleAuthorKey(title, authors[0] || '')}`;

  const olUrl = openLibraryKey
    ? `https://openlibrary.org${openLibraryKey.startsWith('/') ? '' : '/'}${openLibraryKey}`
    : undefined;

  return {
    uid,
    sources: ['open_library'],
    openLibraryKey,
    googleBooksId,
    title,
    subtitle: doc?.subtitle?.trim() || undefined,
    authors,
    authorText: authors.length > 0 ? authors.join(', ') : 'Chưa rõ tác giả',
    isbn13,
    isbn10,
    publisher: publisher || 'Chưa rõ NXB',
    publishYear: publishYear || new Date().getFullYear(),
    description,
    categoriesRaw,
    mappedCategory: mapSubjectsToBookCategory(categoriesRaw, title, description),
    pageCount:
      typeof doc?.number_of_pages_median === 'number' && doc.number_of_pages_median > 0
        ? Math.trunc(doc.number_of_pages_median)
        : undefined,
    language,
    coverUrl,
    thumbnailUrl: thumbnailUrl || undefined,
    previewLink: olUrl,
    infoLink: olUrl,
    ratingsAverage:
      typeof doc?.ratings_average === 'number' && Number.isFinite(doc.ratings_average)
        ? Number(doc.ratings_average.toFixed(2))
        : undefined,
    ratingsCount:
      typeof doc?.ratings_count === 'number' && doc.ratings_count > 0
        ? Math.trunc(doc.ratings_count)
        : undefined,
    editionsCount:
      typeof doc?.edition_count === 'number' && doc.edition_count > 0
        ? Math.trunc(doc.edition_count)
        : undefined,
  };
}

export function normalizeOpenLibraryBookData(
  isbnInput: string,
  entry: OpenLibraryBookDataEntry,
  workDescription?: string
): ExternalBookResult | null {
  const title = (entry?.title || '').trim();
  if (!title) return null;

  const isbnList = [
    isbnInput,
    ...(entry.identifiers?.isbn_13 || []),
    ...(entry.identifiers?.isbn_10 || []),
  ];
  const { isbn13, isbn10 } = extractIsbnPair(isbnList);
  const authors = (entry.authors || [])
    .map((a) => (a?.name || '').trim())
    .filter(Boolean);
  const categoriesRaw = (entry.subjects || [])
    .map((s) => (s?.name || '').trim())
    .filter(Boolean)
    .slice(0, 8);
  const publisher = (entry.publishers || [])
    .map((p) => (p?.name || '').trim())
    .find(Boolean) || 'Chưa rõ NXB';
  const publishYear = parsePublishYear(entry.publish_date) || new Date().getFullYear();

  const excerptText = (entry.excerpts || [])
    .map((ex) => ex?.text?.trim())
    .find(Boolean);
  const description = stripHtmlTags(workDescription || entry.notes || excerptText || '');
  const coverUrl = upgradeCoverUrlToHttps(
    entry.cover?.large || entry.cover?.medium || entry.cover?.small || ''
  );
  const thumbnailUrl = upgradeCoverUrlToHttps(entry.cover?.medium || entry.cover?.small || '');
  const openLibraryKey =
    (entry.key || '').trim() ||
    (entry.identifiers?.openlibrary?.[0] ? `/books/${entry.identifiers.openlibrary[0]}` : undefined);

  return {
    uid: isbn13 ? `isbn:${isbn13}` : isbn10 ? `isbn:${isbn10}` : `ol:${openLibraryKey || title}`,
    sources: ['open_library'],
    openLibraryKey,
    googleBooksId: entry.identifiers?.google?.[0]?.trim() || undefined,
    title,
    subtitle: entry.subtitle?.trim() || undefined,
    authors,
    authorText: authors.length > 0 ? authors.join(', ') : 'Chưa rõ tác giả',
    isbn13,
    isbn10,
    publisher,
    publishYear,
    description,
    categoriesRaw,
    mappedCategory: mapSubjectsToBookCategory(categoriesRaw, title, description),
    pageCount:
      typeof entry.number_of_pages === 'number' && entry.number_of_pages > 0
        ? Math.trunc(entry.number_of_pages)
        : undefined,
    coverUrl,
    thumbnailUrl: thumbnailUrl || undefined,
    previewLink: upgradeExternalLinkToHttps(entry.url) || undefined,
    infoLink: upgradeExternalLinkToHttps(entry.url) || undefined,
  };
}

function mapOpenLibraryLanguage(code?: string): string | undefined {
  if (!code) return undefined;
  const c = code.trim().toLowerCase();
  if (c === 'vie' || c === 'vi') return 'vi';
  if (c === 'eng' || c === 'en') return 'en';
  if (c === 'fre' || c === 'fra' || c === 'fr') return 'fr';
  if (c === 'jpn' || c === 'ja') return 'ja';
  if (c === 'chi' || c === 'zho' || c === 'zh') return 'zh';
  return c;
}

export function normalizeTitleAuthorKey(title: string, author: string): string {
  const norm = (val: string) =>
    val
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  return `${norm(title)}::${norm(author)}`;
}

function mergeTwoResults(a: ExternalBookResult, b: ExternalBookResult): ExternalBookResult {
  const sources = Array.from(new Set([...a.sources, ...b.sources]));
  const description =
    (a.description || '').length >= (b.description || '').length
      ? a.description || b.description
      : b.description || a.description;

  // Prefer Google Books / high-res direct cover over Open Library ?default=false probe when both exist
  const isProbeUrl = (u: string) => u.includes('default=false');
  let coverUrl = a.coverUrl;
  if (!coverUrl || (isProbeUrl(coverUrl) && b.coverUrl && !isProbeUrl(b.coverUrl))) {
    coverUrl = b.coverUrl || a.coverUrl;
  }

  const authors = a.authors.length >= b.authors.length ? a.authors : b.authors;
  const categoriesRaw = Array.from(new Set([...a.categoriesRaw, ...b.categoriesRaw])).slice(0, 10);

  return {
    uid: a.isbn13 ? `isbn:${a.isbn13}` : b.isbn13 ? `isbn:${b.isbn13}` : a.uid,
    sources,
    googleBooksId: a.googleBooksId || b.googleBooksId,
    openLibraryKey: a.openLibraryKey || b.openLibraryKey,
    title: a.title.length >= b.title.length ? a.title : b.title,
    subtitle: a.subtitle || b.subtitle,
    authors,
    authorText: authors.length > 0 ? authors.join(', ') : a.authorText || b.authorText,
    isbn13: a.isbn13 || b.isbn13,
    isbn10: a.isbn10 || b.isbn10,
    publisher:
      a.publisher && a.publisher !== 'Chưa rõ NXB'
        ? a.publisher
        : b.publisher || a.publisher,
    publishYear: a.publishYear || b.publishYear,
    description,
    categoriesRaw,
    mappedCategory: mapSubjectsToBookCategory(
      categoriesRaw,
      a.title || b.title,
      description
    ),
    pageCount: a.pageCount || b.pageCount,
    language: a.language || b.language,
    coverUrl,
    thumbnailUrl: a.thumbnailUrl || b.thumbnailUrl,
    previewLink: a.previewLink || b.previewLink,
    infoLink: a.infoLink || b.infoLink,
    ratingsAverage: a.ratingsAverage ?? b.ratingsAverage,
    ratingsCount: Math.max(a.ratingsCount || 0, b.ratingsCount || 0) || undefined,
    editionsCount: a.editionsCount ?? b.editionsCount,
  };
}

export function mergeExternalBookResults(
  googleItems: ExternalBookResult[],
  openLibraryItems: ExternalBookResult[]
): ExternalBookResult[] {
  const merged: ExternalBookResult[] = [];
  const isbnIndex = new Map<string, number>();
  const titleAuthorIndex = new Map<string, number>();

  const insertOrMerge = (item: ExternalBookResult) => {
    let matchIdx: number | undefined;
    if (item.isbn13 && isbnIndex.has(item.isbn13)) {
      matchIdx = isbnIndex.get(item.isbn13);
    } else if (item.isbn10 && isbnIndex.has(item.isbn10)) {
      matchIdx = isbnIndex.get(item.isbn10);
    } else if (item.googleBooksId) {
      const idx = merged.findIndex((m) => m.googleBooksId === item.googleBooksId);
      if (idx >= 0) matchIdx = idx;
    }

    if (matchIdx === undefined) {
      const key = normalizeTitleAuthorKey(item.title, item.authors[0] || '');
      if (key !== '::' && titleAuthorIndex.has(key)) {
        matchIdx = titleAuthorIndex.get(key);
      }
    }

    if (matchIdx !== undefined) {
      const combined = mergeTwoResults(merged[matchIdx], item);
      merged[matchIdx] = combined;
      if (combined.isbn13) isbnIndex.set(combined.isbn13, matchIdx);
      if (combined.isbn10) isbnIndex.set(combined.isbn10, matchIdx);
      const key = normalizeTitleAuthorKey(combined.title, combined.authors[0] || '');
      if (key !== '::') titleAuthorIndex.set(key, matchIdx);
    } else {
      const idx = merged.length;
      merged.push(item);
      if (item.isbn13) isbnIndex.set(item.isbn13, idx);
      if (item.isbn10) isbnIndex.set(item.isbn10, idx);
      const key = normalizeTitleAuthorKey(item.title, item.authors[0] || '');
      if (key !== '::') titleAuthorIndex.set(key, idx);
    }
  };

  for (const item of googleItems) insertOrMerge(item);
  for (const item of openLibraryItems) insertOrMerge(item);

  // Sort merged results so dual-source + cover + description rank slightly higher while preserving relevance
  return merged.sort((a, b) => {
    const score = (x: ExternalBookResult) =>
      (x.sources.length > 1 ? 3 : 0) +
      (x.coverUrl && !x.coverUrl.includes('default=false') ? 2 : x.coverUrl ? 1 : 0) +
      (x.description ? 2 : 0) +
      (x.isbn13 || x.isbn10 ? 1 : 0);
    return score(b) - score(a);
  });
}

export function findCatalogDuplicateBook(
  books: Book[],
  external: ExternalBookResult
): Book | undefined {
  const ext13 = normalizeIsbn(external.isbn13);
  const ext10 = normalizeIsbn(external.isbn10);

  if (ext13 || ext10) {
    const byIsbn = books.find((b) => {
      const bIsbn = normalizeIsbn(b.isbn);
      const bIsbn10 = normalizeIsbn(b.isbn10);
      return (
        (ext13 && (bIsbn === ext13 || bIsbn10 === ext13)) ||
        (ext10 && (bIsbn === ext10 || bIsbn10 === ext10))
      );
    });
    if (byIsbn) return byIsbn;
  }

  const extKey = normalizeTitleAuthorKey(external.title, external.authors[0] || '');
  return books.find((b) => {
    const bKey = normalizeTitleAuthorKey(b.title, b.author.split(',')[0] || '');
    return bKey === extKey;
  });
}

export function buildBookFromExternalResult(
  external: ExternalBookResult,
  overrides: {
    id?: string;
    bookCode?: string;
    totalCopies?: number;
    shelfLocation?: string;
    category?: string;
    notes?: string;
  } = {}
): Book {
  const now = new Date();
  const suffix = `${now.getTime().toString().slice(-6)}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
  const id = overrides.id || `BOK-${suffix}`;
  const bookCode = overrides.bookCode || `BOK-${now.getFullYear()}-${suffix.slice(0, 4)}`;
  const totalCopies = Math.max(1, Math.min(500, Math.trunc(overrides.totalCopies ?? 5)));
  const isbn = external.isbn13 || external.isbn10 || `EXT-${suffix}`;
  const title = external.title.trim().slice(0, 200) || 'Chưa rõ nhan đề';
  const author = (external.authorText || 'Chưa rõ tác giả').trim().slice(0, 180);
  const externalSource: Book['externalSource'] =
    external.sources.length > 1
      ? 'merged'
      : external.sources[0] === 'google_books'
      ? 'google_books'
      : 'open_library';

  return {
    id,
    bookCode,
    isbn,
    ...(external.isbn10 ? { isbn10: external.isbn10 } : {}),
    title,
    ...(external.subtitle ? { subtitle: external.subtitle.slice(0, 280) } : {}),
    author,
    category: normalizeBookCategoryChoice(overrides.category || external.mappedCategory),
    publisher: (external.publisher || 'Chưa rõ NXB').slice(0, 120),
    publishYear: external.publishYear || now.getFullYear(),
    totalCopies,
    availableCopies: totalCopies,
    shelfLocation: (overrides.shelfLocation || 'Kệ A1').trim() || 'Kệ A1',
    coverUrl: external.coverUrl || '',
    description: external.description || '',
    ...(external.pageCount ? { pageCount: external.pageCount } : {}),
    ...(external.language ? { language: external.language } : {}),
    ...(external.categoriesRaw.length > 0 ? { subjects: external.categoriesRaw.slice(0, 8) } : {}),
    ...(external.ratingsAverage !== undefined ? { ratingsAverage: external.ratingsAverage } : {}),
    ...(external.ratingsCount !== undefined ? { ratingsCount: external.ratingsCount } : {}),
    ...(external.googleBooksId ? { googleBooksId: external.googleBooksId } : {}),
    ...(external.openLibraryKey ? { openLibraryKey: external.openLibraryKey } : {}),
    ...(external.previewLink ? { previewLink: external.previewLink } : {}),
    ...(external.infoLink ? { infoLink: external.infoLink } : {}),
    externalSource,
    enrichedAt: now.toISOString(),
    status: 'active',
    ...(overrides.notes ? { notes: overrides.notes } : {}),
  };
}

export function mergeBookEnrichment(existing: Book, external: ExternalBookResult): Book {
  const nowIso = new Date().toISOString();
  const isGenericDescription =
    !existing.description ||
    existing.description.trim().length < 20;
  const shouldReplaceCover =
    !existing.coverUrl ||
    !existing.coverUrl.startsWith('https://') ||
    (existing.coverUrl.includes('default=false') &&
      Boolean(external.coverUrl) &&
      !external.coverUrl.includes('default=false'));
  const isGenericPublisher =
    !existing.publisher || existing.publisher === 'Chưa rõ NXB' || existing.publisher === 'NXB Giáo Dục';

  const externalSource: Book['externalSource'] =
    external.sources.length > 1
      ? 'merged'
      : external.sources[0] === 'google_books'
      ? 'google_books'
      : 'open_library';

  return {
    ...existing,
    isbn: normalizeIsbn(existing.isbn) ? existing.isbn : external.isbn13 || external.isbn10 || existing.isbn,
    isbn10: existing.isbn10 || external.isbn10,
    subtitle: existing.subtitle || (external.subtitle ? external.subtitle.slice(0, 280) : undefined),
    publisher:
      isGenericPublisher && external.publisher && external.publisher !== 'Chưa rõ NXB'
        ? external.publisher.slice(0, 120)
        : existing.publisher,
    publishYear: existing.publishYear > 0 ? existing.publishYear : external.publishYear,
    coverUrl: shouldReplaceCover && external.coverUrl ? external.coverUrl : existing.coverUrl,
    description:
      isGenericDescription && external.description
        ? external.description
        : existing.description,
    pageCount: existing.pageCount || external.pageCount,
    language: existing.language || external.language,
    subjects:
      existing.subjects && existing.subjects.length > 0
        ? existing.subjects
        : external.categoriesRaw.length > 0
        ? external.categoriesRaw.slice(0, 8)
        : undefined,
    ratingsAverage: external.ratingsAverage ?? existing.ratingsAverage,
    ratingsCount: external.ratingsCount ?? existing.ratingsCount,
    googleBooksId: existing.googleBooksId || external.googleBooksId,
    openLibraryKey: existing.openLibraryKey || external.openLibraryKey,
    previewLink: existing.previewLink || external.previewLink,
    infoLink: existing.infoLink || external.infoLink,
    externalSource,
    enrichedAt: nowIso,
  };
}

export function formatLanguageLabel(code?: string): string {
  if (!code) return 'Chưa rõ';
  const c = code.trim().toLowerCase();
  if (c === 'vi' || c === 'vie') return 'Tiếng Việt';
  if (c === 'en' || c === 'eng') return 'Tiếng Anh';
  if (c === 'fr' || c === 'fre' || c === 'fra') return 'Tiếng Pháp';
  if (c === 'ja' || c === 'jpn') return 'Tiếng Nhật';
  if (c === 'zh' || c === 'chi' || c === 'zho') return 'Tiếng Trung';
  return c.toUpperCase();
}

export function gutendexToExternalBookResult(item: {
  id: number;
  title: string;
  authorText: string;
  authors: Array<{ name: string }>;
  subjects: string[];
  languages: string[];
  coverUrl: string;
  gutenbergUrl: string;
  textUrl?: string;
  htmlUrl?: string;
  downloadCount: number;
}): ExternalBookResult {
  return {
    uid: `guten:${item.id}`,
    sources: ['open_library'],
    title: item.title,
    authors: item.authors.map((a) => a.name),
    authorText: item.authorText || 'Project Gutenberg Author',
    isbn13: `PG-${item.id}`,
    isbn10: '',
    publisher: 'Project Gutenberg (Public Domain)',
    publishYear: 1900,
    description: `Tác phẩm văn học / học thuật thuộc phạm vi công cộng từ Project Gutenberg (Mã #${item.id}, ${item.downloadCount.toLocaleString('en-US')} lượt tải). Chủ đề: ${item.subjects.slice(0, 4).join(', ') || 'Tổng hợp'}.`,
    categoriesRaw: item.subjects,
    mappedCategory: mapSubjectsToBookCategory(item.subjects, item.title, ''),
    language: item.languages[0] || 'en',
    coverUrl: item.coverUrl || '',
    previewLink: item.htmlUrl || item.gutenbergUrl,
    infoLink: item.gutenbergUrl,
  };
}

export function buildBookFromAcademicPaper(
  paper: {
    source: 'crossref' | 'arxiv';
    title: string;
    authorText: string;
    publishedYear: number;
    venue: string;
    abstract: string;
    doi?: string;
    arxivId?: string;
    url: string;
    pdfUrl?: string;
    subjects: string[];
  },
  overrides: {
    totalCopies?: number;
    shelfLocation?: string;
    category?: string;
  } = {}
): Book {
  const now = new Date();
  const suffix = `${now.getTime().toString().slice(-6)}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
  const totalCopies = Math.max(1, Math.min(100, Math.trunc(overrides.totalCopies ?? 2)));
  const identifier = paper.doi || paper.arxivId || `ACAD-${suffix}`;

  return {
    id: `BOK-${suffix}`,
    bookCode: `${paper.source === 'arxiv' ? 'ARX' : 'DOI'}-${now.getFullYear()}-${suffix.slice(0, 4)}`,
    isbn: identifier.slice(0, 48),
    title: paper.title.slice(0, 200),
    author: (paper.authorText || 'Research Author').slice(0, 180),
    category: normalizeBookCategoryChoice(
      overrides.category || mapSubjectsToBookCategory(paper.subjects, paper.title, paper.abstract)
    ),
    publisher: (paper.venue || (paper.source === 'arxiv' ? 'arXiv.org' : 'Crossref')).slice(0, 120),
    publishYear: paper.publishedYear || now.getFullYear(),
    totalCopies,
    availableCopies: totalCopies,
    shelfLocation: (overrides.shelfLocation || 'Tài liệu số / Tham khảo').trim(),
    coverUrl: '',
    description:
      paper.abstract ||
      `Tài liệu nghiên cứu học thuật (${paper.source.toUpperCase()}) · ${paper.venue}`,
    subjects: paper.subjects.slice(0, 8),
    previewLink: paper.pdfUrl || paper.url,
    infoLink: paper.url,
    externalSource: paper.source,
    enrichedAt: now.toISOString(),
    status: 'active',
    notes: paper.doi ? `DOI: ${paper.doi}` : paper.arxivId ? `arXiv: ${paper.arxivId}` : undefined,
  };
}

