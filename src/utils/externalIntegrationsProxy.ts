import {
  computeNeoPhysics,
  mergeWorldBankMultiCountry,
  normalizeCrossrefWork,
  normalizeDatamuseList,
  normalizeGutendexBook,
  normalizeNasaApod,
  normalizeNasaMediaItems,
  normalizeNasaNeoFeed,
  normalizeNominatimItem,
  normalizeNominatimResults,
  normalizePubChemPropertyRow,
  normalizeRestCountry,
  normalizeWikipediaSummary,
  normalizeWiktionaryEnRest,
  normalizeWiktionaryViExtract,
  normalizeWorldBankResponse,
  parseArxivAtomXml,
  type AcademicPaperResult,
  type AcademicSource,
  type CountryProfile,
  type GutendexBookResult,
  type LexiconLookupResult,
  type NasaApodResult,
  type NasaMediaItem,
  type NasaNeoItem,
  type NominatimPlace,
  type PubChemCompound,
  type WikipediaSummaryResult,
  type WorldBankMultiCountryComparison,
  type WorldBankSeries,
} from './externalIntegrations.ts';

export interface TtlCache<T> {
  get(key: string): T | null;
  set(key: string, value: T): void;
  clear(): void;
}

export function createTtlCache<T>(ttlMs: number = 15 * 60 * 1000, maxEntries: number = 300): TtlCache<T> {
  const store = new Map<string, { value: T; expiresAt: number }>();
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
      if (store.size >= maxEntries) {
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

export interface ProxyFetchOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  nasaApiKey?: string;
}

const USER_AGENT = 'SchoolHubEdu/1.0 (https://schoolhub.local; edu-integration)';

async function fetchWithTimeout(
  url: string,
  options: ProxyFetchOptions & { accept?: string } = {}
): Promise<Response> {
  const fetchFn = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs ?? 9000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: options.accept || 'application/json',
        'User-Agent': USER_AGENT,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonStrict<T = any>(url: string, options: ProxyFetchOptions = {}): Promise<T> {
  const res = await fetchWithTimeout(url, { ...options, accept: 'application/json' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

async function fetchTextStrict(url: string, options: ProxyFetchOptions = {}): Promise<string> {
  const res = await fetchWithTimeout(url, {
    ...options,
    accept: 'text/plain, application/xml, text/xml, */*',
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return await res.text();
}

/* ============================================================================
   1. OpenStreetMap Nominatim
   ============================================================================ */

export async function searchNominatim(
  rawQuery: string,
  limit: number = 8,
  options: ProxyFetchOptions & { cache?: TtlCache<NominatimPlace[]> } = {}
): Promise<NominatimPlace[]> {
  const q = rawQuery.trim();
  if (!q) return [];

  const safeLimit = Math.max(1, Math.min(15, Math.trunc(limit)));
  const cacheKey = `nom::${safeLimit}::${q.toLowerCase()}`;
  const cached = options.cache?.get(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    addressdetails: '1',
    limit: String(safeLimit),
    'accept-language': 'vi,en',
  });

  const data = await fetchJsonStrict<unknown[]>(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    options
  );
  const results = normalizeNominatimResults(data);
  options.cache?.set(cacheKey, results);
  return results;
}

export async function reverseNominatim(
  lat: number,
  lon: number,
  options: ProxyFetchOptions & { cache?: TtlCache<NominatimPlace | null> } = {}
): Promise<NominatimPlace | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const cacheKey = `nomrev::${lat.toFixed(3)}::${lon.toFixed(3)}`;
  const cached = options.cache?.get(cacheKey);
  if (cached !== null && cached !== undefined) return cached;

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: 'jsonv2',
    addressdetails: '1',
    'accept-language': 'vi,en',
  });
  const data = await fetchJsonStrict<any>(
    `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
    options
  );
  const normalized = normalizeNominatimItem(data);
  options.cache?.set(cacheKey, normalized);
  return normalized;
}

/* ============================================================================
   2. PubChem API
   ============================================================================ */

const PUBCHEM_PROPS = [
  'MolecularFormula',
  'MolecularWeight',
  'IUPACName',
  'CanonicalSMILES',
  'IsomericSMILES',
  'InChIKey',
  'XLogP',
  'TPSA',
  'HBondDonorCount',
  'HBondAcceptorCount',
  'RotatableBondCount',
  'Charge',
  'ExactMass',
  'Title',
].join(',');

export async function lookupPubChemCompound(
  rawQuery: string,
  options: ProxyFetchOptions & { cache?: TtlCache<PubChemCompound> } = {}
): Promise<PubChemCompound | null> {
  const q = rawQuery.trim();
  if (!q) return null;

  const cacheKey = `pubchem::${q.toLowerCase()}`;
  const cached = options.cache?.get(cacheKey);
  if (cached) return cached;

  const isNumericCid = /^\d+$/.test(q);
  const candidateUrls = isNumericCid
    ? [
        `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${q}/property/${PUBCHEM_PROPS}/JSON`,
      ]
    : [
        `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(q)}/property/${PUBCHEM_PROPS}/JSON`,
        `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/fastformula/${encodeURIComponent(q)}/property/${PUBCHEM_PROPS}/JSON`,
        `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(q)}/property/${PUBCHEM_PROPS}/JSON`,
      ];

  let propRow: Record<string, any> | null = null;
  for (const url of candidateUrls) {
    try {
      const data = await fetchJsonStrict<any>(url, options);
      const props = data?.PropertyTable?.Properties;
      if (Array.isArray(props) && props[0]) {
        propRow = props[0];
        break;
      }
    } catch {
      // try next PubChem namespace
    }
  }

  if (!propRow?.CID) return null;
  const cid = Number(propRow.CID);

  let synonyms: string[] = [];
  let description = '';
  let descriptionSource = '';

  const [synData, descData] = await Promise.all([
    fetchJsonStrict<any>(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/synonyms/JSON`,
      { ...options, timeoutMs: 4500 }
    ).catch(() => null),
    fetchJsonStrict<any>(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/description/JSON`,
      { ...options, timeoutMs: 4500 }
    ).catch(() => null),
  ]);

  const synList = synData?.InformationList?.Information?.[0]?.Synonym;
  if (Array.isArray(synList)) {
    synonyms = synList.slice(0, 10).map(String);
  }

  const descList = descData?.InformationList?.Information;
  if (Array.isArray(descList)) {
    const withDesc = descList.find((d: any) => typeof d?.Description === 'string' && d.Description.trim());
    if (withDesc) {
      description = String(withDesc.Description).trim();
      descriptionSource = String(withDesc.DescriptionSourceName || 'PubChem');
    }
  }

  const compound = normalizePubChemPropertyRow(propRow, {
    synonyms,
    description: description || undefined,
    descriptionSource: descriptionSource || undefined,
    queryTitle: q,
  });

  if (compound) {
    options.cache?.set(cacheKey, compound);
  }
  return compound;
}

/* ============================================================================
   3. REST Countries + World Bank API
   ============================================================================ */

const VI_COUNTRY_ALIASES: Record<string, string> = {
  'việt nam': 'vietnam',
  'viet nam': 'vietnam',
  'nhật bản': 'japan',
  'nhat ban': 'japan',
  'hàn quốc': 'korea',
  'han quoc': 'korea',
  'triều tiên': 'north korea',
  'trung quốc': 'china',
  'trung quoc': 'china',
  'hoa kỳ': 'united states',
  'hoa ky': 'united states',
  'mỹ': 'united states',
  'nước mỹ': 'united states',
  'đức': 'germany',
  'pháp': 'france',
  'nước pháp': 'france',
  'anh': 'united kingdom',
  'vương quốc anh': 'united kingdom',
  'nga': 'russia',
  'liên bang nga': 'russia',
  'thái lan': 'thailand',
  'thai lan': 'thailand',
  'lào': 'laos',
  'campuchia': 'cambodia',
  'ấn độ': 'india',
  'an do': 'india',
  'úc': 'australia',
  'ôxtrâylia': 'australia',
  'ý': 'italy',
  'italia': 'italy',
  'tây ban nha': 'spain',
  'bồ đào nha': 'portugal',
  'hà lan': 'netherlands',
  'thụy sĩ': 'switzerland',
  'thụy điển': 'sweden',
  'na uy': 'norway',
  'đan mạch': 'denmark',
  'phần lan': 'finland',
  'bỉ': 'belgium',
  'áo': 'austria',
  'ba lan': 'poland',
  'hy lạp': 'greece',
  'thổ nhĩ kỳ': 'turkey',
  'ai cập': 'egypt',
  'nam phi': 'south africa',
  'ma rốc': 'morocco',
  'đài loan': 'taiwan',
  'hồng kông': 'hong kong',
  'mông cổ': 'mongolia',
  'miến điện': 'myanmar',
  'đông timor': 'timor-leste',
  'niuzilân': 'new zealand',
  'tân tây lan': 'new zealand',
  'mêhicô': 'mexico',
  'acgentina': 'argentina',
  'braxin': 'brazil',
  'ả rập xê út': 'saudi arabia',
};

function resolveCountrySearchQuery(raw: string): string {
  const lowered = raw.trim().toLowerCase();
  if (!lowered) return '';
  if (VI_COUNTRY_ALIASES[lowered]) return VI_COUNTRY_ALIASES[lowered];
  return raw.trim();
}

let allCountriesSnapshotPromise: Promise<CountryProfile[]> | null = null;
let allCountriesSnapshotAt = 0;

async function fetchAllCountriesSnapshot(options: ProxyFetchOptions): Promise<CountryProfile[]> {
  const now = Date.now();
  if (allCountriesSnapshotPromise && now - allCountriesSnapshotAt < 60 * 60 * 1000) {
    return allCountriesSnapshotPromise;
  }
  allCountriesSnapshotAt = now;
  allCountriesSnapshotPromise = (async () => {
    const endpoints = [
      'https://www.apicountries.com/countries',
      'https://cdn.jsdelivr.net/npm/world-countries@5/countries.json',
    ];
    for (const ep of endpoints) {
      try {
        const raw = await fetchJsonStrict<any>(ep, { ...options, timeoutMs: 8000 });
        if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.success === false) {
          continue;
        }
        if (Array.isArray(raw) && raw.length > 0) {
          const parsed = raw
            .map((item) => normalizeRestCountry(item))
            .filter((item): item is CountryProfile => Boolean(item));
          if (parsed.length > 0) return parsed;
        }
      } catch {
        // try next source
      }
    }
    throw new Error('Không thể tải danh sách quốc gia từ máy chủ dữ liệu.');
  })().catch((err) => {
    allCountriesSnapshotPromise = null;
    throw err;
  });
  return allCountriesSnapshotPromise;
}

export async function searchRestCountries(
  rawQuery: string,
  region: string = '',
  options: ProxyFetchOptions & { cache?: TtlCache<CountryProfile[]> } = {}
): Promise<CountryProfile[]> {
  const originalQ = rawQuery.trim();
  const mappedQ = resolveCountrySearchQuery(originalQ);
  const cleanRegion = region.trim();
  const cacheKey = `countries::${cleanRegion.toLowerCase()}::${mappedQ.toLowerCase()}`;
  const cached = options.cache?.get(cacheKey);
  if (cached) return cached;

  let results: CountryProfile[] = [];
  let fetchedDirect = false;

  if (mappedQ && mappedQ.length >= 2) {
    try {
      const data = await fetchJsonStrict<any>(
        `https://www.apicountries.com/name/${encodeURIComponent(mappedQ)}`,
        { ...options, timeoutMs: 6500 }
      );
      if (data && typeof data === 'object' && !Array.isArray(data) && data.success === false) {
        throw new Error('Upstream country endpoint returned error');
      }
      if (Array.isArray(data)) {
        results = data
          .map((item) => normalizeRestCountry(item))
          .filter((item): item is CountryProfile => Boolean(item));
        fetchedDirect = results.length > 0;
      }
    } catch {
      // Fallback to snapshot search below (supports cca3, cca2, nativeName, capital, CDN fallback)
    }
  } else if (!mappedQ && cleanRegion && cleanRegion !== 'all') {
    try {
      const data = await fetchJsonStrict<any>(
        `https://www.apicountries.com/region/${encodeURIComponent(cleanRegion)}`,
        { ...options, timeoutMs: 6500 }
      );
      if (Array.isArray(data)) {
        results = data
          .map((item) => normalizeRestCountry(item))
          .filter((item): item is CountryProfile => Boolean(item));
        fetchedDirect = results.length > 0;
      }
    } catch {
      // Fallback to snapshot below
    }
  }

  if (!fetchedDirect) {
    const all = await fetchAllCountriesSnapshot(options);
    results = all;
    if (mappedQ) {
      const needle = mappedQ.toLowerCase();
      const origNeedle = originalQ.toLowerCase();
      results = results.filter((c) => {
        const fields = [
          c.nameCommon,
          c.nameOfficial,
          c.nativeName,
          c.capital,
          c.cca3,
          c.cca2,
        ];
        return fields.some(
          (f) => f && (f.toLowerCase().includes(needle) || f.toLowerCase().includes(origNeedle))
        );
      });
    }
  }

  if (cleanRegion && cleanRegion !== 'all') {
    results = results.filter((c) => c.region.toLowerCase() === cleanRegion.toLowerCase());
  }

  results.sort((a, b) => b.population - a.population);
  const sliced = results.slice(0, 36);
  if (sliced.length > 0) {
    options.cache?.set(cacheKey, sliced);
  }
  return sliced;
}

export async function fetchWorldBankIndicator(
  countryCode: string,
  indicatorId: string,
  options: ProxyFetchOptions & { cache?: TtlCache<WorldBankSeries> } = {}
): Promise<WorldBankSeries> {
  const cc = countryCode.trim().toUpperCase() || 'VNM';
  const ind = indicatorId.trim() || 'NY.GDP.PCAP.CD';
  const cacheKey = `wb::${cc}::${ind}`;
  const cached = options.cache?.get(cacheKey);
  if (cached) return cached;

  const url = `https://api.worldbank.org/v2/country/${encodeURIComponent(cc)}/indicator/${encodeURIComponent(ind)}?format=json&per_page=30&mrv=20`;
  const data = await fetchJsonStrict<unknown>(url, options);
  const series = normalizeWorldBankResponse(data, cc, ind);
  if (series.points.length > 0) {
    options.cache?.set(cacheKey, series);
  }
  return series;
}

export async function fetchWorldBankMultiCountry(
  countryCodes: string[],
  indicatorId: string,
  options: ProxyFetchOptions & { cache?: TtlCache<WorldBankSeries> } = {}
): Promise<WorldBankMultiCountryComparison> {
  const cleanCodes = Array.from(
    new Set(
      countryCodes
        .map((c) => c.trim().toUpperCase())
        .filter((c) => /^[A-Z0-9]{2,3}$/.test(c))
    )
  ).slice(0, 5);

  const codes = cleanCodes.length > 0 ? cleanCodes : ['VNM', 'JPN', 'SGP'];
  const ind = indicatorId.trim() || 'NY.GDP.PCAP.CD';

  const seriesList = await Promise.all(
    codes.map((code) => fetchWorldBankIndicator(code, ind, options))
  );
  return mergeWorldBankMultiCountry(seriesList);
}

/* ============================================================================
   4. Wikipedia REST API
   ============================================================================ */

export type WikipediaContext = 'literature' | 'history' | 'geography' | 'math';

const WIKI_CONTEXT_SIGNALS: Record<
  WikipediaContext,
  { positive: string[]; negative: string[]; queryHint: string }
> = {
  literature: {
    positive: [
      'nhà thơ',
      'nhà văn',
      'tác giả',
      'tác phẩm',
      'tiểu thuyết',
      'truyện ngắn',
      'bài thơ',
      'tập thơ',
      'văn học',
      'thi phẩm',
      'bút ký',
      'tùy bút',
      'kịch bản',
      'poet',
      'novelist',
      'literature',
    ],
    negative: [
      'ca sĩ',
      'diễn viên',
      'bóng đá',
      'cầu thủ',
      'phim truyền hình',
      'ban nhạc',
      'album',
      'singer',
      'footballer',
    ],
    queryHint: 'nhà thơ nhà văn tác phẩm',
  },
  history: {
    positive: [
      'chiến dịch',
      'trận ',
      'khởi nghĩa',
      'triều đại',
      'hoàng đế',
      'vua ',
      'lịch sử',
      'cách mạng',
      'hiệp định',
      'chiến tranh',
      'triều ',
      'kháng chiến',
      'tướng',
      'history',
      'battle',
      'dynasty',
    ],
    negative: ['ca sĩ', 'phim điện ảnh', 'cầu thủ', 'album', 'bài hát'],
    queryHint: 'lịch sử chiến dịch',
  },
  geography: {
    positive: [
      'địa lý',
      'khí hậu',
      'sông ',
      'dãy núi',
      'biển ',
      'quốc gia',
      'châu lục',
      'dân số',
      'kinh tế',
      'địa hình',
      'geography',
      'climate',
    ],
    negative: ['ca sĩ', 'diễn viên', 'album'],
    queryHint: 'địa lý',
  },
  math: {
    positive: [
      'toán học',
      'định lý',
      'phương trình',
      'hàm số',
      'tích phân',
      'đạo hàm',
      'hình học',
      'ma trận',
      'xác suất',
      'số học',
      'mathematics',
      'theorem',
      'equation',
    ],
    negative: ['ca sĩ', 'diễn viên', 'phim'],
    queryHint: 'toán học',
  },
};

function scoreWikiCandidate(
  title: string,
  snippetHtml: string,
  query: string,
  context?: WikipediaContext
): number {
  const cleanSnippet = snippetHtml.replace(/<[^>]+>/g, ' ').toLowerCase();
  const lowerTitle = title.toLowerCase();
  const lowerQ = query.toLowerCase();
  let score = 0;

  if (lowerTitle === lowerQ) score += 12;
  else if (lowerTitle.startsWith(lowerQ)) score += 6;

  if (!context) return score;
  const rules = WIKI_CONTEXT_SIGNALS[context];
  for (const pos of rules.positive) {
    if (lowerTitle.includes(pos)) score += 18;
    if (cleanSnippet.includes(pos)) score += 9;
  }
  for (const neg of rules.negative) {
    if (lowerTitle.includes(neg)) score -= 25;
    if (cleanSnippet.includes(neg)) score -= 14;
  }
  return score;
}

export async function lookupWikipediaSummary(
  rawQuery: string,
  lang: 'vi' | 'en' = 'vi',
  options: ProxyFetchOptions & {
    cache?: TtlCache<WikipediaSummaryResult>;
    context?: WikipediaContext;
  } = {}
): Promise<WikipediaSummaryResult | null> {
  const q = rawQuery.trim();
  if (!q) return null;

  const safeLang: 'vi' | 'en' = lang === 'en' ? 'en' : 'vi';
  const context = options.context;
  const cacheKey = `wiki::${safeLang}::${context || 'general'}::${q.toLowerCase()}`;
  const cached = options.cache?.get(cacheKey);
  if (cached) return cached;

  // Direct lookup only when general or no disambiguation risk; otherwise verify via contextual search
  const slug = q.replace(/\s+/g, '_');
  let directSummary: WikipediaSummaryResult | null = null;
  let directWasDisambig = false;
  try {
    const direct = await fetchJsonStrict<any>(
      `https://${safeLang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`,
      options
    );
    if (String(direct?.type || '').includes('disambiguation')) {
      directWasDisambig = true;
    } else {
      const normalized = normalizeWikipediaSummary(direct, safeLang);
      if (normalized) {
        directSummary = normalized;
        if (!context) {
          options.cache?.set(cacheKey, normalized);
          return normalized;
        }
        const directScore = scoreWikiCandidate(
          normalized.title,
          `${normalized.description} ${normalized.extract}`,
          q,
          context
        );
        // Only short-circuit direct hit if it clearly fits context cleanly without negative cues
        if (directScore >= 18) {
          options.cache?.set(cacheKey, normalized);
          return normalized;
        }
      }
    }
  } catch {
    // Fallback to search below
  }

  // Contextual search via MediaWiki API
  const searchParams = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: q,
    srlimit: context ? '6' : '3',
    format: 'json',
    origin: '*',
  });
  const searchJson = await fetchJsonStrict<any>(
    `https://${safeLang}.wikipedia.org/w/api.php?${searchParams.toString()}`,
    options
  );
  let candidates: Array<{ title: string; snippet?: string }> = Array.isArray(searchJson?.query?.search)
    ? searchJson.query.search
    : [];

  if (context && safeLang === 'vi') {
    const bestInitialScore = candidates.reduce((max, c) => {
      const s = scoreWikiCandidate(String(c?.title || ''), String(c?.snippet || ''), q, context);
      return Math.max(max, s);
    }, -999);
    // If initial results are ambiguous or off-domain (e.g. "Quang Dũng" singer or "Điện Biên Phủ" commune), query with domain hint
    if (bestInitialScore < 15) {
      const hintedParams = new URLSearchParams({
        action: 'query',
        list: 'search',
        srsearch: `${q} ${WIKI_CONTEXT_SIGNALS[context].queryHint}`,
        srlimit: '5',
        format: 'json',
        origin: '*',
      });
      const hintedJson = await fetchJsonStrict<any>(
        `https://${safeLang}.wikipedia.org/w/api.php?${hintedParams.toString()}`,
        options
      ).catch(() => null);
      const hintedCandidates = Array.isArray(hintedJson?.query?.search)
        ? hintedJson.query.search
        : [];
      const seen = new Set(candidates.map((c) => String(c?.title || '')));
      for (const hc of hintedCandidates) {
        if (hc?.title && !seen.has(String(hc.title))) {
          candidates.push(hc);
          seen.add(String(hc.title));
        }
      }
    }
  }

  let bestTitle = candidates[0]?.title;
  if (context && candidates.length > 0) {
    let bestScore = -Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const title = String(c?.title || '');
      if (!title) continue;
      const baseRankBonus = Math.max(0, 4 - i);
      const s = scoreWikiCandidate(title, String(c?.snippet || ''), q, context) + baseRankBonus;
      if (s > bestScore) {
        bestScore = s;
        bestTitle = title;
      }
    }
  }

  if (!bestTitle) {
    if (directSummary && !directWasDisambig) {
      options.cache?.set(cacheKey, directSummary);
      return directSummary;
    }
    return null;
  }

  const summaryJson = await fetchJsonStrict<any>(
    `https://${safeLang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      String(bestTitle).replace(/\s+/g, '_')
    )}`,
    options
  );
  const normalized = normalizeWikipediaSummary(summaryJson, safeLang);
  if (normalized) {
    options.cache?.set(cacheKey, normalized);
  }
  return normalized;
}

/* ============================================================================
   5. Gutendex / Project Gutenberg API
   ============================================================================ */

const iaGutenbergIdentifierMap = new Map<number, { identifier: string; title: string }>();

function mapIaLanguage(rawLang: unknown): string[] {
  const arr = Array.isArray(rawLang) ? rawLang : rawLang ? [rawLang] : [];
  return arr
    .map((l) => String(l || '').trim().toLowerCase())
    .filter(Boolean)
    .map((l) => {
      if (l === 'eng' || l === 'english') return 'en';
      if (l === 'fre' || l === 'fra' || l === 'french') return 'fr';
      if (l === 'ger' || l === 'deu' || l === 'german') return 'de';
      if (l === 'spa' || l === 'spanish') return 'es';
      return l.slice(0, 2);
    });
}

async function searchIaGutenbergMirror(
  rawQuery: string,
  lang: string,
  options: ProxyFetchOptions
): Promise<GutendexBookResult[]> {
  const q = rawQuery.trim();
  const terms = q
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
  const queryExpr = terms.length
    ? `collection:gutenberg AND (${terms.map((t) => `(title:${t} OR creator:${t} OR subject:${t})`).join(' AND ')})`
    : 'collection:gutenberg';
  const params = new URLSearchParams({
    q: queryExpr,
    rows: '25',
    output: 'json',
  });
  params.append('fl[]', 'identifier');
  params.append('fl[]', 'title');
  params.append('fl[]', 'creator');
  params.append('fl[]', 'subject');
  params.append('fl[]', 'language');
  params.append('fl[]', 'downloads');
  params.append('sort[]', 'downloads desc');

  const data = await fetchJsonStrict<any>(
    `https://archive.org/advancedsearch.php?${params.toString()}`,
    { ...options, timeoutMs: 8000 }
  );
  const docs = Array.isArray(data?.response?.docs) ? data.response.docs : [];
  const results: GutendexBookResult[] = [];
  const seenIds = new Set<number>();

  for (const doc of docs) {
    const identifier = String(doc?.identifier || '').trim();
    const match = identifier.match(/(\d{1,6})gut$/i);
    if (!match) continue;
    const pgId = Number(match[1]);
    if (!Number.isFinite(pgId) || pgId <= 0 || seenIds.has(pgId)) continue;
    seenIds.add(pgId);

    const title = String(doc?.title || `Project Gutenberg #${pgId}`).trim();
    const creators = Array.isArray(doc?.creator) ? doc.creator : doc?.creator ? [doc.creator] : [];
    const authors = creators
      .map((c: unknown) => String(c || '').trim())
      .filter(Boolean)
      .map((name: string) => ({ name }));
    const subjects = (Array.isArray(doc?.subject) ? doc.subject : doc?.subject ? [doc.subject] : [])
      .map((s: unknown) => String(s || '').trim())
      .filter(Boolean)
      .slice(0, 6);
    const languages = mapIaLanguage(doc?.language);
    if (lang && languages.length && !languages.includes(lang.toLowerCase())) continue;

    iaGutenbergIdentifierMap.set(pgId, { identifier, title });
    results.push({
      id: pgId,
      title,
      authors,
      authorText: authors.map((a: { name: string }) => a.name).join(', ') || 'Tác giả khuyết danh',
      subjects,
      bookshelves: ['Project Gutenberg'],
      languages: languages.length ? languages : ['en'],
      downloadCount: Number(doc?.downloads) || 0,
      coverUrl: `https://archive.org/services/img/${encodeURIComponent(identifier)}`,
      textUrl: `https://archive.org/download/${encodeURIComponent(identifier)}/${pgId}.txt`,
      htmlUrl: `https://www.gutenberg.org/ebooks/${pgId}`,
      gutenbergUrl: `https://www.gutenberg.org/ebooks/${pgId}`,
    });
    if (results.length >= 20) break;
  }

  return results;
}

export async function searchGutendexBooks(
  rawQuery: string,
  lang: string = '',
  options: ProxyFetchOptions & { cache?: TtlCache<GutendexBookResult[]> } = {}
): Promise<GutendexBookResult[]> {
  const q = rawQuery.trim();
  const cleanLang = lang.trim().toLowerCase();
  const cacheKey = `guten::${cleanLang}::${q.toLowerCase()}`;
  const cached = options.cache?.get(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams();
  if (q) params.set('search', q);
  if (cleanLang) params.set('languages', cleanLang);

  let normalized: GutendexBookResult[] = [];
  const iaMirrorPromise = searchIaGutenbergMirror(q, cleanLang, options).catch(() => []);
  try {
    const data = await fetchJsonStrict<any>(
      `https://gutendex.com/books?${params.toString()}`,
      { ...options, timeoutMs: 2200 }
    );
    const list = Array.isArray(data?.results) ? data.results : [];
    normalized = list
      .map((item: any) => normalizeGutendexBook(item))
      .filter((item: GutendexBookResult | null): item is GutendexBookResult => Boolean(item))
      .slice(0, 20);
  } catch {
    normalized = await iaMirrorPromise;
  }

  if (normalized.length === 0) {
    const mirror = await iaMirrorPromise;
    if (mirror.length > 0) normalized = mirror;
  }

  if (normalized.length) {
    options.cache?.set(cacheKey, normalized);
  }
  return normalized;
}

async function resolveIaIdentifierForGutenbergId(
  id: number,
  options: ProxyFetchOptions
): Promise<{ identifier: string; title: string } | null> {
  const cached = iaGutenbergIdentifierMap.get(id);
  if (cached) return cached;

  const padded = String(id).padStart(5, '0');
  const q = `collection:gutenberg AND (identifier:*${padded}gut OR identifier:*${id}gut)`;
  const params = new URLSearchParams({ q, rows: '5', output: 'json' });
  params.append('fl[]', 'identifier');
  params.append('fl[]', 'title');
  const data = await fetchJsonStrict<any>(
    `https://archive.org/advancedsearch.php?${params.toString()}`,
    { ...options, timeoutMs: 7000 }
  );
  const docs = Array.isArray(data?.response?.docs) ? data.response.docs : [];
  const exact = docs.find((d: any) => {
    const ident = String(d?.identifier || '');
    const m = ident.match(/(\d{1,6})gut$/i);
    return m && Number(m[1]) === id;
  });
  if (!exact?.identifier) return null;
  const resolved = {
    identifier: String(exact.identifier),
    title: String(exact.title || `Project Gutenberg #${id}`),
  };
  iaGutenbergIdentifierMap.set(id, resolved);
  return resolved;
}

export async function fetchGutendexExcerpt(
  gutenbergId: number,
  options: ProxyFetchOptions & { cache?: TtlCache<{ id: number; title: string; text: string; truncated: boolean }> } = {}
): Promise<{ id: number; title: string; text: string; truncated: boolean }> {
  const id = Math.trunc(gutenbergId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('Mã sách Gutenberg không hợp lệ.');
  }

  const cacheKey = `gutentext::${id}`;
  const cached = options.cache?.get(cacheKey);
  if (cached) return cached;

  let resolvedTitle = `Project Gutenberg #${id}`;
  let fullText = '';

  try {
    const meta = await fetchJsonStrict<any>(`https://gutendex.com/books/${id}`, {
      ...options,
      timeoutMs: 2200,
    });
    const normalized = normalizeGutendexBook(meta);
    if (normalized?.textUrl) {
      resolvedTitle = normalized.title;
      const parsedTextUrl = new URL(normalized.textUrl);
      if (parsedTextUrl.hostname.endsWith('gutenberg.org') || parsedTextUrl.hostname.endsWith('archive.org')) {
        fullText = await fetchTextStrict(normalized.textUrl, {
          ...options,
          timeoutMs: 5000,
        });
      }
    }
  } catch {
    // fallback to Internet Archive Gutenberg mirror below
  }

  if (!fullText) {
    const iaItem = await resolveIaIdentifierForGutenbergId(id, options);
    if (!iaItem) {
      throw new Error('Không tìm thấy bản văn bản thuần Project Gutenberg cho mã sách này.');
    }
    resolvedTitle = iaItem.title;
    const filesResp = await fetchJsonStrict<any>(
      `https://archive.org/metadata/${encodeURIComponent(iaItem.identifier)}/files`,
      { ...options, timeoutMs: 7000 }
    );
    const files = Array.isArray(filesResp?.result) ? filesResp.result : [];
    const txtFile =
      files.find((f: any) => /\.txt$/i.test(String(f?.name || '')) && !/_meta\.txt$/i.test(String(f?.name || ''))) ||
      files.find((f: any) => String(f?.format || '').toLowerCase() === 'text');
    if (!txtFile?.name) {
      throw new Error('Tác phẩm này không có tệp văn bản thuần (.txt) trên kho lưu trữ Gutenberg.');
    }
    const dlUrl = `https://archive.org/download/${encodeURIComponent(iaItem.identifier)}/${encodeURIComponent(String(txtFile.name))}`;
    fullText = await fetchTextStrict(dlUrl, {
      ...options,
      timeoutMs: 10000,
    });
  }

  const maxChars = 36000;
  let cleaned = fullText.replace(/\r\n/g, '\n');
  const startMarker = cleaned.slice(0, 5000).match(/\*\*\*\s*START OF (?:THIS|THE) PROJECT GUTENBERG[^\n]*\*\*\*\s*/i);
  if (startMarker && typeof startMarker.index === 'number') {
    cleaned = cleaned.slice(startMarker.index + startMarker[0].length).trimStart();
  }
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  const excerpt = cleaned.slice(0, maxChars);
  const payload = {
    id,
    title: resolvedTitle,
    text: excerpt,
    truncated: cleaned.length > maxChars,
  };
  options.cache?.set(cacheKey, payload);
  return payload;
}

/* ============================================================================
   6. Crossref & arXiv Academic Search
   ============================================================================ */

export async function searchAcademicPapers(
  rawQuery: string,
  source: 'all' | AcademicSource = 'all',
  options: ProxyFetchOptions & { cache?: TtlCache<{ results: AcademicPaperResult[]; warnings: string[] }> } = {}
): Promise<{ results: AcademicPaperResult[]; warnings: string[] }> {
  const q = rawQuery.trim();
  if (!q) return { results: [], warnings: [] };

  const safeSource: 'all' | AcademicSource =
    source === 'crossref' || source === 'arxiv' ? source : 'all';
  const cacheKey = `acad::${safeSource}::${q.toLowerCase()}`;
  const cached = options.cache?.get(cacheKey);
  if (cached) return cached;

  const warnings: string[] = [];
  let crossrefItems: AcademicPaperResult[] = [];
  let arxivItems: AcademicPaperResult[] = [];

  const tasks: Promise<void>[] = [];

  if (safeSource === 'all' || safeSource === 'crossref') {
    tasks.push(
      fetchJsonStrict<any>(
        `https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=10&mailto=library@schoolhub.local`,
        { ...options, timeoutMs: 10000 }
      )
        .then((data) => {
          const items = Array.isArray(data?.message?.items) ? data.message.items : [];
          crossrefItems = items
            .map((item: any) => normalizeCrossrefWork(item))
            .filter((x: AcademicPaperResult | null): x is AcademicPaperResult => Boolean(x));
        })
        .catch((err) => {
          warnings.push(`Crossref tạm thời gián đoạn (${err instanceof Error ? err.message : 'error'}).`);
        })
    );
  }

  if (safeSource === 'all' || safeSource === 'arxiv') {
    tasks.push(
      fetchTextStrict(
        `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&start=0&max_results=10`,
        { ...options, timeoutMs: 10000 }
      )
        .then((xml) => {
          arxivItems = parseArxivAtomXml(xml);
        })
        .catch((err) => {
          warnings.push(`arXiv tạm thời gián đoạn (${err instanceof Error ? err.message : 'error'}).`);
        })
    );
  }

  await Promise.all(tasks);

  // Interleave results when both sources run
  const combined: AcademicPaperResult[] = [];
  const maxLen = Math.max(crossrefItems.length, arxivItems.length);
  for (let i = 0; i < maxLen; i++) {
    if (arxivItems[i]) combined.push(arxivItems[i]);
    if (crossrefItems[i]) combined.push(crossrefItems[i]);
  }

  const payload = { results: combined, warnings };
  if (combined.length > 0 || warnings.length === 0) {
    options.cache?.set(cacheKey, payload);
  }
  return payload;
}

/* ============================================================================
   7. NASA Open APIs (APOD, NEO, Media Search)
   ============================================================================ */

function decodeHtmlEntitiesQuick(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function getYesterdayUtcIso(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function fetchNasaApodHtmlFallback(
  options: ProxyFetchOptions
): Promise<NasaApodResult | null> {
  try {
    const html = await fetchTextStrict('https://science.nasa.gov/apod/', {
      ...options,
      timeoutMs: 6500,
    });
    const pickMeta = (prop: string): string => {
      const m =
        new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i').exec(html) ||
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i').exec(html);
      return m?.[1] ? decodeHtmlEntitiesQuick(m[1]) : '';
    };
    const imgUrl = pickMeta('og:image');
    const title = pickMeta('og:title') || 'Astronomy Picture of the Day';
    const explanation =
      pickMeta('og:description') ||
      'Ảnh thiên văn nổi bật từ trang NASA Science Astronomy Picture of the Day.';
    if (!imgUrl) return null;
    return {
      date: new Date().toISOString().slice(0, 10),
      title: title.replace(/^APOD:\s*/i, '').trim(),
      explanation,
      mediaType: 'image',
      url: imgUrl,
      hdUrl: imgUrl,
      copyright: 'NASA Science APOD (Dự phòng trực tiếp)',
    };
  } catch {
    return null;
  }
}

async function fetchNasaApodImagesLibraryFallback(
  cleanDate: string,
  options: ProxyFetchOptions
): Promise<NasaApodResult | null> {
  try {
    const items = await searchNasaMedia('Astronomy Picture of the Day nebula galaxy', options);
    if (!items || items.length === 0) return null;
    let pickIdx = 0;
    if (cleanDate) {
      let hash = 0;
      for (let i = 0; i < cleanDate.length; i++) {
        hash = (hash * 31 + cleanDate.charCodeAt(i)) >>> 0;
      }
      pickIdx = hash % items.length;
    }
    const chosen = items[pickIdx] || items[0];
    return {
      date: cleanDate || chosen.dateCreated || new Date().toISOString().slice(0, 10),
      title: chosen.title,
      explanation:
        chosen.description ||
        'Ảnh thiên văn chính thức từ Kho lưu trữ Hình ảnh NASA (hiển thị dự phòng khi API DEMO_KEY chạm giới hạn lượt gọi).',
      mediaType: 'image',
      url: chosen.imageUrl,
      hdUrl: chosen.imageUrl,
      copyright: `${chosen.center || 'NASA'} Image Library (Dự phòng DEMO_KEY)`,
    };
  } catch {
    return null;
  }
}

export async function fetchNasaApod(
  date: string = '',
  options: ProxyFetchOptions & { cache?: TtlCache<NasaApodResult> } = {}
): Promise<NasaApodResult | null> {
  const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(date.trim()) ? date.trim() : '';
  const apiKey = options.nasaApiKey || 'DEMO_KEY';
  const cacheKey = `nasa-apod::${cleanDate || 'today'}`;
  const cached = options.cache?.get(cacheKey);
  if (cached) return cached;

  const tryApodApi = async (targetDate?: string): Promise<NasaApodResult | null> => {
    const params = new URLSearchParams({ api_key: apiKey, thumbs: 'true' });
    if (targetDate) params.set('date', targetDate);
    const data = await fetchJsonStrict<any>(
      `https://api.nasa.gov/planetary/apod?${params.toString()}`,
      { ...options, timeoutMs: 6000 }
    );
    return normalizeNasaApod(data);
  };

  let normalized: NasaApodResult | null = null;
  try {
    normalized = await tryApodApi(cleanDate || undefined);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (!cleanDate && (msg.includes('500') || msg.includes('404'))) {
      try {
        normalized = await tryApodApi(getYesterdayUtcIso());
      } catch {
        // continue to fallbacks below
      }
    }
  }

  // Fallback 1: official NASA Science APOD page OpenGraph (when no past date specified)
  if (!normalized && !cleanDate) {
    normalized = await fetchNasaApodHtmlFallback(options);
  }

  // Fallback 2: NASA Image and Video Library (never rate-limited by DEMO_KEY)
  if (!normalized) {
    normalized = await fetchNasaApodImagesLibraryFallback(cleanDate, options);
  }

  if (normalized) {
    options.cache?.set(cacheKey, normalized);
  }
  return normalized;
}

async function fetchNasaJplCadFallback(
  options: ProxyFetchOptions
): Promise<{ date: string; count: number; items: NasaNeoItem[] } | null> {
  try {
    const data = await fetchJsonStrict<any>(
      'https://ssd-api.jpl.nasa.gov/cad.api?dist-max=0.05&sort=date&limit=12',
      { ...options, timeoutMs: 6500 }
    );
    const fields: string[] = Array.isArray(data?.fields) ? data.fields : [];
    const rows: any[][] = Array.isArray(data?.data) ? data.data : [];
    if (!fields.length || !rows.length) return null;
    const idx = (name: string) => fields.indexOf(name);
    const iDes = idx('des');
    const iCd = idx('cd');
    const iDist = idx('dist');
    const iVrel = idx('v_rel');
    const iH = idx('h');

    const AU_KM = 149597870.7;
    const AU_LD = 389.1703755;

    const items: NasaNeoItem[] = [];
    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const row = rows[rIdx];
      if (!Array.isArray(row)) continue;
      const name = String(row[iDes] || `NEO-${rIdx + 1}`).trim();
      const closeApproachDate = String(row[iCd] || new Date().toISOString().slice(0, 10)).trim();
      const distAu = Number(row[iDist]);
      const velocityKmS = Number(row[iVrel]);
      const hMag = Number(row[iH]);
      if (!Number.isFinite(distAu) || !Number.isFinite(velocityKmS)) continue;

      const dKm = Number.isFinite(hMag) ? (1329 / Math.sqrt(0.14)) * Math.pow(10, -hMag / 5) : 0.08;
      const dMidM = Math.max(5, Math.round(dKm * 1000));
      const dMinM = Math.max(4, Math.round(dMidM * 0.78));
      const dMaxM = Math.max(dMinM + 2, Math.round(dMidM * 1.25));
      const physics = computeNeoPhysics(dMidM, velocityKmS);
      const missDistanceKm = Math.round(distAu * AU_KM);
      const missDistanceLunar = Number((distAu * AU_LD).toFixed(2));
      const hazardous = Number.isFinite(hMag) ? hMag <= 22.0 && distAu <= 0.05 : false;

      items.push({
        id: `jpl-${name.replace(/\s+/g, '-')}`,
        name: `${name} (JPL CAD)`,
        closeApproachDate,
        diameterMinM: dMinM,
        diameterMaxM: dMaxM,
        velocityKmS: Number(velocityKmS.toFixed(2)),
        missDistanceKm,
        missDistanceLunar,
        isPotentiallyHazardous: hazardous,
        nasaJplUrl: `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(name)}`,
        estimatedMassKg: physics.estimatedMassKg,
        kineticEnergyMegatons: physics.kineticEnergyMegatons,
      });
    }

    if (!items.length) return null;
    return {
      date: new Date().toISOString().slice(0, 10),
      count: items.length,
      items,
    };
  } catch {
    return null;
  }
}

export async function fetchNasaNeoFeed(
  startDate: string = '',
  options: ProxyFetchOptions & { cache?: TtlCache<{ date: string; count: number; items: NasaNeoItem[] }> } = {}
): Promise<{ date: string; count: number; items: NasaNeoItem[] }> {
  const explicitDate = /^\d{4}-\d{2}-\d{2}$/.test(startDate.trim()) ? startDate.trim() : '';
  const cleanDate = explicitDate || new Date().toISOString().slice(0, 10);
  const apiKey = options.nasaApiKey || 'DEMO_KEY';
  const cacheKey = `nasa-neo::${cleanDate}`;
  const cached = options.cache?.get(cacheKey);
  if (cached) return cached;

  const tryFeed = async (targetDate: string) => {
    const params = new URLSearchParams({
      start_date: targetDate,
      end_date: targetDate,
      api_key: apiKey,
    });
    const data = await fetchJsonStrict<any>(
      `https://api.nasa.gov/neo/rest/v1/feed?${params.toString()}`,
      { ...options, timeoutMs: 7000 }
    );
    const items = normalizeNasaNeoFeed(data);
    return { date: targetDate, count: items.length, items: items.slice(0, 20) };
  };

  try {
    const payload = await tryFeed(cleanDate);
    options.cache?.set(cacheKey, payload);
    return payload;
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (!explicitDate && (msg.includes('404') || msg.includes('500'))) {
      try {
        const yesterday = getYesterdayUtcIso();
        const fallbackPayload = await tryFeed(yesterday);
        options.cache?.set(cacheKey, fallbackPayload);
        return fallbackPayload;
      } catch {
        // proceed to JPL SBDB CAD fallback below
      }
    }
    const jplFallback = await fetchNasaJplCadFallback(options);
    if (jplFallback) {
      options.cache?.set(cacheKey, jplFallback);
      return jplFallback;
    }
    if (msg.includes('429') || msg.includes('403')) {
      throw new Error(
        'NASA NeoWs DEMO_KEY đang chạm giới hạn lượt gọi theo giờ. Hãy gắn NASA_API_KEY (miễn phí tại api.nasa.gov) trong Settings > Secrets hoặc thử lại sau.'
      );
    }
    throw err;
  }
}

export async function searchNasaMedia(
  rawQuery: string,
  options: ProxyFetchOptions & { cache?: TtlCache<NasaMediaItem[]> } = {}
): Promise<NasaMediaItem[]> {
  const q = rawQuery.trim() || 'nebula';
  const cacheKey = `nasa-media::${q.toLowerCase()}`;
  const cached = options.cache?.get(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    q,
    media_type: 'image',
    page: '1',
  });
  const data = await fetchJsonStrict<any>(
    `https://images-api.nasa.gov/search?${params.toString()}`,
    options
  );
  const items = normalizeNasaMediaItems(data);
  options.cache?.set(cacheKey, items);
  return items;
}

/* ============================================================================
   8. Datamuse + Wiktionary Lexicon
   ============================================================================ */

export async function lookupLexiconWord(
  rawWord: string,
  options: ProxyFetchOptions & {
    lang?: 'en' | 'vi';
    mode?: 'word' | 'meaning';
    cache?: TtlCache<LexiconLookupResult>;
  } = {}
): Promise<LexiconLookupResult> {
  const lang: 'en' | 'vi' = options.lang === 'vi' ? 'vi' : 'en';
  const mode: 'word' | 'meaning' = options.mode === 'meaning' ? 'meaning' : 'word';
  const cleanWord = rawWord
    .trim()
    .toLowerCase()
    .replace(/^[.,!?;:"'()\[\]{}]+|[.,!?;:"'()\[\]{}]+$/g, '')
    .replace(/\s+/g, ' ');

  if (!cleanWord) {
    throw new Error('Vui lòng nhập từ khóa cần tra cứu.');
  }

  const cacheKey = `lex::${lang}::${mode}::${cleanWord}`;
  const cached = options.cache?.get(cacheKey);
  if (cached) return cached;

  if (mode === 'meaning') {
    const mlRaw = await fetchJsonStrict<unknown>(
      `https://api.datamuse.com/words?ml=${encodeURIComponent(cleanWord)}&md=dp&max=16`,
      options
    ).catch(() => []);
    const mlItems = normalizeDatamuseList(mlRaw);
    const result: LexiconLookupResult = {
      word: cleanWord,
      lang: 'en',
      meanings: [],
      synonyms: mlItems.map((i) => i.word),
      antonyms: [],
      relatedTriggers: [],
      collocations: [],
      rhymes: [],
      soundsLike: [],
      reverseMatches: mlItems.map((i) => ({ word: i.word, defs: i.defs || [] })),
      wiktionaryUrl: `https://en.wiktionary.org/wiki/Special:Search?search=${encodeURIComponent(cleanWord)}`,
      sources: mlItems.length > 0 ? ['datamuse'] : [],
    };
    options.cache?.set(cacheKey, result);
    return result;
  }

  if (lang === 'vi') {
    const viData = await fetchJsonStrict<any>(
      `https://vi.wiktionary.org/w/api.php?action=query&titles=${encodeURIComponent(
        cleanWord
      )}&prop=extracts&explaintext=1&format=json&origin=*`,
      options
    ).catch(() => null);
    const meanings = normalizeWiktionaryViExtract(viData);
    const result: LexiconLookupResult = {
      word: cleanWord,
      lang: 'vi',
      meanings,
      synonyms: [],
      antonyms: [],
      relatedTriggers: [],
      collocations: [],
      rhymes: [],
      soundsLike: [],
      reverseMatches: [],
      wiktionaryUrl: `https://vi.wiktionary.org/wiki/${encodeURIComponent(cleanWord.replace(/\s+/g, '_'))}`,
      sources: meanings.length > 0 ? ['wiktionary'] : [],
    };
    if (meanings.length > 0) options.cache?.set(cacheKey, result);
    return result;
  }

  // English mode: Wiktionary REST definitions + Datamuse semantic relations in parallel
  const enc = encodeURIComponent(cleanWord);
  const encUnderscore = encodeURIComponent(cleanWord.replace(/\s+/g, '_'));

  const [
    wiktRest,
    dmDefRaw,
    dmSynRaw,
    dmAntRaw,
    dmTrgRaw,
    dmCollocRaw,
    dmRhyRaw,
  ] = await Promise.all([
    fetchJsonStrict<any>(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encUnderscore}`,
      options
    ).catch(() => null),
    fetchJsonStrict<unknown>(
      `https://api.datamuse.com/words?sp=${enc}&qe=sp&md=dr&ipa=1&max=1`,
      options
    ).catch(() => []),
    fetchJsonStrict<unknown>(
      `https://api.datamuse.com/words?rel_syn=${enc}&max=14`,
      options
    ).catch(() => []),
    fetchJsonStrict<unknown>(
      `https://api.datamuse.com/words?rel_ant=${enc}&max=10`,
      options
    ).catch(() => []),
    fetchJsonStrict<unknown>(
      `https://api.datamuse.com/words?rel_trg=${enc}&max=14`,
      options
    ).catch(() => []),
    fetchJsonStrict<unknown>(
      `https://api.datamuse.com/words?rel_jjb=${enc}&max=12`,
      options
    ).catch(() => []),
    fetchJsonStrict<unknown>(
      `https://api.datamuse.com/words?rel_rhy=${enc}&max=12`,
      options
    ).catch(() => []),
  ]);

  let meanings = normalizeWiktionaryEnRest(wiktRest);
  const dmDefList = normalizeDatamuseList(dmDefRaw);
  const firstDm = dmDefList[0];

  // Extract IPA from Datamuse tags (`ipa_pron:...`) if present
  const ipaTag = firstDm?.tags?.find((t) => t.startsWith('ipa_pron:'));
  const ipa = ipaTag ? `/${ipaTag.slice('ipa_pron:'.length)}/` : undefined;

  // Fallback to Datamuse embedded WordNet definitions if Wiktionary didn't return an entry
  if (meanings.length === 0 && firstDm?.defs && firstDm.defs.length > 0) {
    meanings = [
      {
        partOfSpeech: 'Definition',
        definitions: firstDm.defs.slice(0, 5).map((d) => ({ definition: d })),
      },
    ];
  }

  const synonyms = normalizeDatamuseList(dmSynRaw).map((x) => x.word);
  const antonyms = normalizeDatamuseList(dmAntRaw).map((x) => x.word);
  const relatedTriggers = normalizeDatamuseList(dmTrgRaw).map((x) => x.word);
  const collocations = normalizeDatamuseList(dmCollocRaw).map((x) => x.word);
  const rhymes = normalizeDatamuseList(dmRhyRaw).map((x) => x.word);

  const sources: Array<'wiktionary' | 'datamuse'> = [];
  if (wiktRest && meanings.length > 0) sources.push('wiktionary');
  if (
    synonyms.length > 0 ||
    antonyms.length > 0 ||
    relatedTriggers.length > 0 ||
    collocations.length > 0 ||
    rhymes.length > 0 ||
    (firstDm?.defs && firstDm.defs.length > 0)
  ) {
    sources.push('datamuse');
  }

  const result: LexiconLookupResult = {
    word: cleanWord,
    lang: 'en',
    ...(ipa ? { ipa } : {}),
    meanings,
    synonyms,
    antonyms,
    relatedTriggers,
    collocations,
    rhymes,
    soundsLike: [],
    reverseMatches: [],
    wiktionaryUrl: `https://en.wiktionary.org/wiki/${encUnderscore}`,
    sources,
  };

  if (sources.length > 0) {
    options.cache?.set(cacheKey, result);
  }
  return result;
}
