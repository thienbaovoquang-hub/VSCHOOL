import {
  buildGoogleBooksQuery,
  buildOpenLibrarySearchParams,
  mergeExternalBookResults,
  normalizeGoogleBooksVolume,
  normalizeIsbn,
  normalizeOpenLibraryBookData,
  normalizeOpenLibraryDoc,
  normalizeTitleAuthorKey,
  stripHtmlTags,
  type ExternalBookResult,
  type ExternalBookSource,
  type ExternalEnrichResponse,
  type ExternalIsbnLookupResponse,
  type ExternalSearchMode,
  type ExternalSearchResponse,
  type ExternalSearchSourceFilter,
  type GoogleVolumeItem,
  type OpenLibraryBookDataEntry,
  type OpenLibrarySearchDoc,
} from './libraryExternalApis.ts';

export interface ExternalBookCacheEntry<T> {
  value: T;
  expiresAt: number;
}

export function createExternalBookCache<T>(ttlMs: number = 15 * 60 * 1000) {
  const store = new Map<string, ExternalBookCacheEntry<T>>();
  return {
    get(key: string): T | null {
      const hit = store.get(key);
      if (!hit) return null;
      if (Date.now() > hit.expiresAt) {
        store.delete(key);
        return null;
      }
      return hit.value;
    },
    set(key: string, value: T) {
      if (store.size > 300) {
        const oldestKey = store.keys().next().value;
        if (oldestKey !== undefined) store.delete(oldestKey);
      }
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
    clear() {
      store.clear();
    },
  };
}

interface FetchOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  googleApiKey?: string;
}

async function fetchJsonWithTimeout(
  url: string,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number; headers?: Record<string, string> } = {}
): Promise<unknown> {
  const fetchFn = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs ?? 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SchoolHubLibrary/1.0 (+https://schoolhub.local)',
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function queryGoogleBooksApi(
  query: string,
  mode: ExternalSearchMode,
  lang: string,
  maxResults: number,
  options: FetchOptions = {}
): Promise<ExternalBookResult[]> {
  const builtQ = buildGoogleBooksQuery(query, mode);
  if (!builtQ) return [];

  const params = new URLSearchParams({
    q: builtQ,
    maxResults: String(Math.max(1, Math.min(25, maxResults))),
    printType: 'books',
  });
  if (lang === 'vi' || lang === 'en') {
    params.set('langRestrict', lang);
  }
  if (options.googleApiKey) {
    params.set('key', options.googleApiKey);
  }

  const url = `https://www.googleapis.com/books/v1/volumes?${params.toString()}`;
  const data = (await fetchJsonWithTimeout(url, options)) as { items?: GoogleVolumeItem[] };
  const items = Array.isArray(data?.items) ? data.items : [];
  return items
    .map((item) => normalizeGoogleBooksVolume(item))
    .filter((item): item is ExternalBookResult => Boolean(item));
}

export async function queryOpenLibrarySearchApi(
  query: string,
  mode: ExternalSearchMode,
  lang: string,
  maxResults: number,
  options: FetchOptions = {}
): Promise<ExternalBookResult[]> {
  const params = buildOpenLibrarySearchParams(query, mode, lang, maxResults);
  const url = `https://openlibrary.org/search.json?${params.toString()}`;
  const data = (await fetchJsonWithTimeout(url, options)) as { docs?: OpenLibrarySearchDoc[] };
  const docs = Array.isArray(data?.docs) ? data.docs : [];
  return docs
    .map((doc) => normalizeOpenLibraryDoc(doc))
    .filter((item): item is ExternalBookResult => Boolean(item));
}

export async function fetchOpenLibraryWorkDescription(
  workKey?: string,
  options: FetchOptions = {}
): Promise<string> {
  if (!workKey || !workKey.startsWith('/works/')) return '';
  try {
    const url = `https://openlibrary.org${workKey}.json`;
    const data = (await fetchJsonWithTimeout(url, {
      ...options,
      timeoutMs: Math.min(options.timeoutMs ?? 5000, 5000),
    })) as { description?: string | { value?: string } };
    if (typeof data?.description === 'string') {
      return stripHtmlTags(data.description);
    }
    if (data?.description && typeof data.description === 'object' && typeof data.description.value === 'string') {
      return stripHtmlTags(data.description.value);
    }
    return '';
  } catch {
    return '';
  }
}

export async function queryOpenLibraryIsbnApi(
  isbn: string,
  options: FetchOptions = {}
): Promise<ExternalBookResult | null> {
  const clean = normalizeIsbn(isbn);
  if (!clean) return null;

  const bibKey = `ISBN:${clean}`;
  const url = `https://openlibrary.org/api/books?bibkeys=${encodeURIComponent(bibKey)}&jscmd=data&format=json`;
  const data = (await fetchJsonWithTimeout(url, options)) as Record<string, OpenLibraryBookDataEntry>;
  const entry = data?.[bibKey];
  if (!entry) return null;

  // Try to grab work description via /isbn/{isbn}.json if entry has no excerpt/notes
  let workDescription = '';
  if (!entry.notes && (!entry.excerpts || entry.excerpts.length === 0)) {
    try {
      const editionData = (await fetchJsonWithTimeout(
        `https://openlibrary.org/isbn/${encodeURIComponent(clean)}.json`,
        { ...options, timeoutMs: 4000 }
      )) as { works?: Array<{ key?: string }>; description?: string | { value?: string } };
      if (typeof editionData?.description === 'string') {
        workDescription = stripHtmlTags(editionData.description);
      } else if (editionData?.description && typeof editionData.description === 'object') {
        workDescription = stripHtmlTags(editionData.description.value);
      } else if (editionData?.works?.[0]?.key) {
        workDescription = await fetchOpenLibraryWorkDescription(editionData.works[0].key, options);
      }
    } catch {
      // Optional enrichment failure is harmless
    }
  }

  return normalizeOpenLibraryBookData(clean, entry, workDescription);
}

export async function searchExternalBooks(
  params: {
    q: string;
    source?: ExternalSearchSourceFilter;
    mode?: ExternalSearchMode;
    lang?: string;
    maxResults?: number;
  },
  options: FetchOptions & { cache?: ReturnType<typeof createExternalBookCache<ExternalSearchResponse>> } = {}
): Promise<ExternalSearchResponse> {
  const q = params.q.trim();
  const source: ExternalSearchSourceFilter =
    params.source === 'google_books' || params.source === 'open_library' ? params.source : 'all';
  const mode: ExternalSearchMode =
    params.mode === 'title' || params.mode === 'author' || params.mode === 'isbn'
      ? params.mode
      : 'all';
  const lang = (params.lang || '').trim().toLowerCase();
  const maxResults = Math.max(1, Math.min(24, Number(params.maxResults) || 15));

  if (!q) {
    return {
      query: '',
      source,
      mode,
      totalMerged: 0,
      googleCount: 0,
      openLibraryCount: 0,
      warnings: [],
      results: [],
    };
  }

  const cacheKey = `search::${source}::${mode}::${lang}::${maxResults}::${q.toLowerCase()}`;
  const cached = options.cache?.get(cacheKey);
  if (cached) return cached;

  const warnings: string[] = [];
  let googleResults: ExternalBookResult[] = [];
  let openLibraryResults: ExternalBookResult[] = [];
  let googleRateLimited = false;

  const tasks: Promise<void>[] = [];

  if (source === 'all' || source === 'google_books') {
    tasks.push(
      queryGoogleBooksApi(q, mode, lang, maxResults, options)
        .then((res) => {
          googleResults = res;
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : 'error';
          if (msg.includes('429')) {
            googleRateLimited = true;
            warnings.push(
              'Google Books tạm giới hạn từ máy chủ (HTTP 429); đang ưu tiên dữ liệu từ Open Library.'
            );
          } else {
            warnings.push(`Google Books tạm thời gián đoạn (${msg}).`);
          }
        })
    );
  }

  if (source === 'all' || source === 'open_library') {
    tasks.push(
      queryOpenLibrarySearchApi(q, mode, lang, maxResults, options)
        .then((res) => {
          openLibraryResults = res;
        })
        .catch((err) => {
          warnings.push(`Open Library tạm thời gián đoạn (${err instanceof Error ? err.message : 'error'}).`);
        })
    );
  }

  await Promise.all(tasks);

  const merged = mergeExternalBookResults(googleResults, openLibraryResults);
  const response: ExternalSearchResponse = {
    query: q,
    source,
    mode,
    totalMerged: merged.length,
    googleCount: googleResults.length,
    openLibraryCount: openLibraryResults.length,
    ...(googleRateLimited ? { googleRateLimited: true } : {}),
    warnings,
    results: merged,
  };

  if (merged.length > 0 || warnings.length === 0) {
    options.cache?.set(cacheKey, response);
  }
  return response;
}

export async function lookupExternalBookByIsbn(
  rawIsbn: string,
  options: FetchOptions & { cache?: ReturnType<typeof createExternalBookCache<ExternalIsbnLookupResponse>> } = {}
): Promise<ExternalIsbnLookupResponse> {
  const isbn = normalizeIsbn(rawIsbn);
  if (!isbn) {
    return {
      found: false,
      isbn: rawIsbn.trim(),
      result: null,
      sources: [],
      warnings: ['Mã ISBN không hợp lệ (cần đúng 10 hoặc 13 ký tự).'],
    };
  }

  const cacheKey = `isbn::${isbn}`;
  const cached = options.cache?.get(cacheKey);
  if (cached) return cached;

  const warnings: string[] = [];
  let googleItems: ExternalBookResult[] = [];
  let openLibraryItems: ExternalBookResult[] = [];

  await Promise.all([
    queryGoogleBooksApi(isbn, 'isbn', '', 5, options)
      .then((res) => {
        googleItems = res;
      })
      .catch((err) => {
        warnings.push(`Google Books ISBN lookup lỗi (${err instanceof Error ? err.message : 'error'}).`);
      }),
    queryOpenLibraryIsbnApi(isbn, options)
      .then((res) => {
        if (res) openLibraryItems = [res];
      })
      .catch((err) => {
        warnings.push(`Open Library ISBN lookup lỗi (${err instanceof Error ? err.message : 'error'}).`);
      }),
  ]);

  const merged = mergeExternalBookResults(googleItems, openLibraryItems);
  const best = merged[0] || null;
  const sources: ExternalBookSource[] = best ? best.sources : [];

  const response: ExternalIsbnLookupResponse = {
    found: Boolean(best),
    isbn,
    result: best,
    sources,
    ...(warnings.length > 0 ? { warnings } : {}),
  };

  if (best || warnings.length === 0) {
    options.cache?.set(cacheKey, response);
  }
  return response;
}

export async function enrichBookFromExternalApis(
  input: { isbn?: string; title?: string; author?: string },
  options: FetchOptions = {}
): Promise<ExternalEnrichResponse> {
  const cleanIsbn = normalizeIsbn(input.isbn);
  const cleanTitle = (input.title || '').trim();
  const cleanAuthor = (input.author || '').trim();
  const warnings: string[] = [];

  if (cleanIsbn) {
    const byIsbn = await lookupExternalBookByIsbn(cleanIsbn, options);
    if (byIsbn.found && byIsbn.result) {
      return {
        found: true,
        match: byIsbn.result,
        sources: byIsbn.sources,
        warnings: byIsbn.warnings,
      };
    }
    if (byIsbn.warnings) warnings.push(...byIsbn.warnings);
  }

  if (!cleanTitle) {
    return { found: false, match: null, sources: [], warnings };
  }

  const combinedQuery = cleanAuthor ? `${cleanTitle} ${cleanAuthor}` : cleanTitle;
  const searchRes = await searchExternalBooks(
    { q: combinedQuery, source: 'all', mode: 'all', maxResults: 8 },
    options
  );
  warnings.push(...searchRes.warnings);

  if (searchRes.results.length === 0) {
    return { found: false, match: null, sources: [], warnings };
  }

  const targetKey = normalizeTitleAuthorKey(cleanTitle, cleanAuthor.split(',')[0] || '');
  const exactMatch = searchRes.results.find(
    (item) => normalizeTitleAuthorKey(item.title, item.authors[0] || '') === targetKey
  );
  let best = exactMatch || searchRes.results[0];

  // If best match lacks description and has an Open Library work key, fetch the full synopsis
  if ((!best.description || best.description.length < 30) && best.openLibraryKey) {
    const workDesc = await fetchOpenLibraryWorkDescription(best.openLibraryKey, options);
    if (workDesc) {
      best = { ...best, description: workDesc };
    }
  }

  return {
    found: true,
    match: best,
    sources: best.sources,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
