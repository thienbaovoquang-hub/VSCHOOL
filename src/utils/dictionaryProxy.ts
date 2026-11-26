export interface DictionaryCacheEntry {
  status: 200 | 404;
  payload: unknown;
  cachedAt: number;
}

export interface DictionaryCache {
  get: (word: string) => DictionaryCacheEntry | undefined;
  set: (word: string, entry: DictionaryCacheEntry) => void;
  clear: () => void;
}

export interface DictionaryLookupSuccess {
  ok: true;
  status: 200;
  word: string;
  entries: unknown[];
  cached: boolean;
}

export interface DictionaryLookupFailure {
  ok: false;
  status: 400 | 404 | 502 | 504;
  notFound: boolean;
  word: string;
  error: string;
  cached: boolean;
}

export type DictionaryLookupResult = DictionaryLookupSuccess | DictionaryLookupFailure;

const DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_MAX_CACHE_SIZE = 500;
const DEFAULT_TIMEOUT_MS = 8000;

export function normalizeDictionaryWord(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[.,!?;:"'()\[\]{}«»“”‘’]+|[.,!?;:"'()\[\]{}«»“”‘’]+$/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
    .trim();
}

export function createDictionaryCache(
  ttlMs: number = DEFAULT_CACHE_TTL_MS,
  maxSize: number = DEFAULT_MAX_CACHE_SIZE
): DictionaryCache {
  const store = new Map<string, DictionaryCacheEntry>();
  return {
    get(word: string) {
      const entry = store.get(word);
      if (!entry) return undefined;
      if (Date.now() - entry.cachedAt > ttlMs) {
        store.delete(word);
        return undefined;
      }
      return entry;
    },
    set(word: string, entry: DictionaryCacheEntry) {
      if (store.has(word)) {
        store.delete(word);
      } else if (store.size >= maxSize) {
        const oldestKey = store.keys().next().value;
        if (oldestKey !== undefined) store.delete(oldestKey);
      }
      store.set(word, entry);
    },
    clear() {
      store.clear();
    },
  };
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SchoolHub-Dictionary/1.0',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchFreeDictionaryEntry(
  rawWord: unknown,
  options?: {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    cache?: DictionaryCache;
    retryDelayMs?: number;
  }
): Promise<DictionaryLookupResult> {
  const word = normalizeDictionaryWord(rawWord);
  if (!word) {
    return {
      ok: false,
      status: 400,
      notFound: false,
      word: '',
      error: 'Vui lòng nhập từ tiếng Anh cần tra cứu.',
      cached: false,
    };
  }

  const cache = options?.cache;
  if (cache) {
    const hit = cache.get(word);
    if (hit) {
      if (hit.status === 200 && Array.isArray(hit.payload)) {
        return {
          ok: true,
          status: 200,
          word,
          entries: hit.payload,
          cached: true,
        };
      }
      if (hit.status === 404) {
        return {
          ok: false,
          status: 404,
          notFound: true,
          word,
          error: `Không tìm thấy từ "${word}" trong Free Dictionary API.`,
          cached: true,
        };
      }
    }
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryDelayMs = options?.retryDelayMs ?? 250;
  const targetUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;

  let lastStatus: 502 | 504 = 502;
  let lastMessage = 'Không thể kết nối Free Dictionary API (dictionaryapi.dev).';

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0 && retryDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }

    try {
      const response = await fetchWithTimeout(fetchImpl, targetUrl, timeoutMs);
      if (response.status === 404) {
        cache?.set(word, { status: 404, payload: null, cachedAt: Date.now() });
        return {
          ok: false,
          status: 404,
          notFound: true,
          word,
          error: `Không tìm thấy từ "${word}" trong Free Dictionary API.`,
          cached: false,
        };
      }

      if (response.ok) {
        const data = (await response.json()) as unknown;
        const entries = Array.isArray(data) ? data : data ? [data] : [];
        if (entries.length === 0) {
          cache?.set(word, { status: 404, payload: null, cachedAt: Date.now() });
          return {
            ok: false,
            status: 404,
            notFound: true,
            word,
            error: `Không tìm thấy từ "${word}" trong Free Dictionary API.`,
            cached: false,
          };
        }
        cache?.set(word, { status: 200, payload: entries, cachedAt: Date.now() });
        return {
          ok: true,
          status: 200,
          word,
          entries,
          cached: false,
        };
      }

      lastStatus = 502;
      lastMessage = `Free Dictionary API trả về mã lỗi HTTP ${response.status}.`;
      if (response.status !== 429 && response.status < 500) {
        break;
      }
    } catch (error) {
      const isAbort = error instanceof Error && error.name === 'AbortError';
      lastStatus = isAbort ? 504 : 502;
      lastMessage = isAbort
        ? 'Kết nối tới Free Dictionary API bị quá thời gian chờ.'
        : 'Không thể kết nối Free Dictionary API (dictionaryapi.dev).';
    }
  }

  return {
    ok: false,
    status: lastStatus,
    notFound: false,
    word,
    error: lastMessage,
    cached: false,
  };
}
