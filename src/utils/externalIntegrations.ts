import { stripHtmlTags } from './libraryExternalApis.ts';

/* ============================================================================
   1. OpenStreetMap Nominatim Geocoding Normalizers
   ============================================================================ */

export interface NominatimPlace {
  placeId: string;
  name: string;
  displayName: string;
  lat: number;
  lon: number;
  type: string;
  category: string;
  country: string;
  countryCode: string;
  state: string;
  city: string;
  boundingBox?: [number, number, number, number];
}

export function normalizeNominatimItem(raw: any): NominatimPlace | null {
  if (!raw || typeof raw !== 'object') return null;
  const lat = Number(raw.lat);
  const lon = Number(raw.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const displayName = String(raw.display_name || raw.name || '').trim();
  if (!displayName) return null;

  const addr = (raw.address && typeof raw.address === 'object' ? raw.address : {}) as Record<
    string,
    unknown
  >;
  const name =
    String(
      raw.name ||
        addr.city ||
        addr.town ||
        addr.village ||
        addr.state ||
        addr.country ||
        displayName.split(',')[0] ||
        ''
    ).trim() || displayName;

  let boundingBox: [number, number, number, number] | undefined;
  if (Array.isArray(raw.boundingbox) && raw.boundingbox.length === 4) {
    const nums = raw.boundingbox.map((n: unknown) => Number(n));
    if (nums.every((n: number) => Number.isFinite(n))) {
      boundingBox = [nums[0], nums[1], nums[2], nums[3]];
    }
  }

  return {
    placeId: String(raw.place_id || `${lat.toFixed(4)},${lon.toFixed(4)}`),
    name,
    displayName,
    lat: Number(lat.toFixed(5)),
    lon: Number(lon.toFixed(5)),
    type: String(raw.type || raw.addresstype || 'place'),
    category: String(raw.class || raw.category || 'boundary'),
    country: String(addr.country || ''),
    countryCode: String(addr.country_code || '').toUpperCase(),
    state: String(addr.state || addr.province || addr.region || ''),
    city: String(addr.city || addr.town || addr.village || addr.county || ''),
    ...(boundingBox ? { boundingBox } : {}),
  };
}

export function normalizeNominatimResults(list: unknown): NominatimPlace[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => normalizeNominatimItem(item))
    .filter((item): item is NominatimPlace => Boolean(item));
}

/* ============================================================================
   2. PubChem Compound Normalizers (Chemistry)
   ============================================================================ */

export interface PubChemCompound {
  cid: number;
  title: string;
  iupacName: string;
  molecularFormula: string;
  molecularWeight: number;
  canonicalSmiles: string;
  isomericSmiles: string;
  inchiKey: string;
  xlogp?: number;
  tpsa?: number;
  hBondDonorCount?: number;
  hBondAcceptorCount?: number;
  rotatableBondCount?: number;
  charge?: number;
  exactMass?: number;
  synonyms: string[];
  description?: string;
  descriptionSource?: string;
  imageUrl: string;
  pubchemUrl: string;
}

export function normalizePubChemPropertyRow(
  prop: Record<string, any> | null | undefined,
  extras?: {
    synonyms?: string[];
    description?: string;
    descriptionSource?: string;
    queryTitle?: string;
  }
): PubChemCompound | null {
  if (!prop || typeof prop !== 'object') return null;
  const cid = Number(prop.CID);
  if (!Number.isFinite(cid) || cid <= 0) return null;

  const molecularFormula = String(prop.MolecularFormula || '').trim();
  const molecularWeight = Number(prop.MolecularWeight);
  const iupacName = String(prop.IUPACName || '').trim();
  const canonicalSmiles = String(
    prop.CanonicalSMILES || prop.ConnectivitySMILES || ''
  ).trim();
  const isomericSmiles = String(prop.IsomericSMILES || prop.SMILES || canonicalSmiles).trim();
  const synonyms = Array.isArray(extras?.synonyms)
    ? extras!.synonyms.map((s) => String(s).trim()).filter(Boolean).slice(0, 10)
    : [];

  const title =
    String(prop.Title || '').trim() ||
    synonyms[0] ||
    (extras?.queryTitle ? extras.queryTitle.trim() : '') ||
    iupacName ||
    `CID ${cid}`;

  return {
    cid,
    title,
    iupacName: iupacName || title,
    molecularFormula: molecularFormula || '—',
    molecularWeight: Number.isFinite(molecularWeight) ? Number(molecularWeight.toFixed(3)) : 0,
    canonicalSmiles,
    isomericSmiles,
    inchiKey: String(prop.InChIKey || '').trim(),
    ...(Number.isFinite(Number(prop.XLogP)) ? { xlogp: Number(prop.XLogP) } : {}),
    ...(Number.isFinite(Number(prop.TPSA)) ? { tpsa: Number(prop.TPSA) } : {}),
    ...(Number.isFinite(Number(prop.HBondDonorCount))
      ? { hBondDonorCount: Number(prop.HBondDonorCount) }
      : {}),
    ...(Number.isFinite(Number(prop.HBondAcceptorCount))
      ? { hBondAcceptorCount: Number(prop.HBondAcceptorCount) }
      : {}),
    ...(Number.isFinite(Number(prop.RotatableBondCount))
      ? { rotatableBondCount: Number(prop.RotatableBondCount) }
      : {}),
    ...(Number.isFinite(Number(prop.Charge)) ? { charge: Number(prop.Charge) } : {}),
    ...(Number.isFinite(Number(prop.ExactMass))
      ? { exactMass: Number(Number(prop.ExactMass).toFixed(4)) }
      : {}),
    synonyms,
    ...(extras?.description ? { description: extras.description } : {}),
    ...(extras?.descriptionSource ? { descriptionSource: extras.descriptionSource } : {}),
    imageUrl: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG?image_size=large`,
    pubchemUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
  };
}

/* ============================================================================
   3. REST Countries + World Bank Normalizers (Geography)
   ============================================================================ */

export interface CountryProfile {
  cca3: string;
  cca2: string;
  nameCommon: string;
  nameOfficial: string;
  nativeName: string;
  capital: string;
  region: string;
  subregion: string;
  population: number;
  areaKm2: number;
  densityPerKm2: number;
  lat: number;
  lon: number;
  flagSvg: string;
  flagPng: string;
  languages: string[];
  currencies: string[];
  timezones: string[];
  borders: string[];
  mapsUrl?: string;
}

export function normalizeRestCountry(raw: any): CountryProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const cca3 = String(raw.cca3 || raw.alpha3Code || '').trim().toUpperCase();
  const cca2 = String(raw.cca2 || raw.alpha2Code || '').trim().toUpperCase();
  const nameCommon =
    typeof raw.name === 'string'
      ? raw.name.trim()
      : String(raw.name?.common || raw.name?.official || '').trim();
  if (!cca3 || !nameCommon) return null;

  const population = Number(raw.population) || 0;
  const areaKm2 = Number(raw.area) || 0;
  const densityPerKm2 =
    Number.isFinite(Number(raw.populationDensity)) && Number(raw.populationDensity) > 0
      ? Number(Number(raw.populationDensity).toFixed(1))
      : areaKm2 > 0
      ? Number((population / areaKm2).toFixed(1))
      : 0;

  const latlng = Array.isArray(raw.latlng) ? raw.latlng : [0, 0];
  const lat = Number.isFinite(Number(latlng[0])) ? Number(latlng[0]) : 0;
  const lon = Number.isFinite(Number(latlng[1])) ? Number(latlng[1]) : 0;

  let languages: string[] = [];
  if (Array.isArray(raw.languages)) {
    languages = raw.languages
      .map((l: any) =>
        typeof l === 'string' ? l.trim() : String(l?.name || l?.nativeName || '').trim()
      )
      .filter(Boolean);
  } else if (raw.languages && typeof raw.languages === 'object') {
    languages = Object.values(raw.languages)
      .map((v) => String(v).trim())
      .filter(Boolean);
  }

  let currencies: string[] = [];
  if (Array.isArray(raw.currencies)) {
    currencies = raw.currencies
      .map((c: any) => {
        if (!c || typeof c !== 'object') return String(c || '').trim();
        const code = String(c.code || '').trim().toUpperCase();
        const cname = c.name ? String(c.name).trim() : code;
        const sym = c.symbol ? ` (${c.symbol})` : '';
        return code ? `${code} - ${cname}${sym}` : `${cname}${sym}`;
      })
      .filter(Boolean);
  } else if (raw.currencies && typeof raw.currencies === 'object') {
    currencies = Object.entries(raw.currencies).map(([code, val]: [string, any]) => {
      const cname = val?.name ? String(val.name) : code;
      const sym = val?.symbol ? ` (${val.symbol})` : '';
      return `${code} - ${cname}${sym}`;
    });
  }

  let nativeName =
    typeof raw.nativeName === 'string' && raw.nativeName.trim()
      ? raw.nativeName.trim()
      : nameCommon;
  if (raw.name?.nativeName && typeof raw.name.nativeName === 'object') {
    const firstNative = Object.values(raw.name.nativeName)[0] as any;
    if (firstNative?.common) nativeName = String(firstNative.common);
  }

  const capital = Array.isArray(raw.capital)
    ? String(raw.capital[0] || '').trim() || '—'
    : typeof raw.capital === 'string' && raw.capital.trim()
    ? raw.capital.trim()
    : '—';

  const nameOfficial =
    typeof raw.name === 'string'
      ? String(raw.officialName || raw.nativeName || nameCommon).trim()
      : String(raw.name?.official || nameCommon).trim();

  return {
    cca3,
    cca2,
    nameCommon,
    nameOfficial,
    nativeName,
    capital,
    region: String(raw.region || '—'),
    subregion: String(raw.subregion || raw.region || '—'),
    population,
    areaKm2,
    densityPerKm2,
    lat,
    lon,
    flagSvg: String(raw.flags?.svg || raw.flags?.png || ''),
    flagPng: String(raw.flags?.png || raw.flags?.svg || ''),
    languages,
    currencies,
    timezones: Array.isArray(raw.timezones) ? raw.timezones.map(String) : [],
    borders: Array.isArray(raw.borders) ? raw.borders.map(String) : [],
    mapsUrl: raw.maps?.openStreetMaps
      ? String(raw.maps.openStreetMaps)
      : raw.maps?.googleMaps
      ? String(raw.maps.googleMaps)
      : undefined,
  };
}

export interface WorldBankIndicatorPoint {
  year: number;
  value: number;
}

export interface WorldBankSeries {
  countryCode: string;
  countryName: string;
  indicatorId: string;
  indicatorName: string;
  points: WorldBankIndicatorPoint[];
  latestYear: number | null;
  latestValue: number | null;
}

export const WORLD_BANK_INDICATORS: Record<
  string,
  { id: string; label: string; unit: string }
> = {
  'SP.POP.TOTL': { id: 'SP.POP.TOTL', label: 'Tổng dân số', unit: 'người' },
  'NY.GDP.MKTP.CD': { id: 'NY.GDP.MKTP.CD', label: 'GDP danh nghĩa', unit: 'USD' },
  'NY.GDP.PCAP.CD': { id: 'NY.GDP.PCAP.CD', label: 'GDP bình quân đầu người', unit: 'USD/người' },
  'SE.XPD.TOTL.GD.ZS': { id: 'SE.XPD.TOTL.GD.ZS', label: 'Chi tiêu giáo dục (% GDP)', unit: '% GDP' },
  'SE.SEC.ENRR': { id: 'SE.SEC.ENRR', label: 'Tỷ lệ nhập học THPT', unit: '%' },
  'IT.NET.USER.ZS': { id: 'IT.NET.USER.ZS', label: 'Người dùng Internet', unit: '%' },
  'SP.URB.TOTL.IN.ZS': { id: 'SP.URB.TOTL.IN.ZS', label: 'Tỷ lệ đô thị hóa', unit: '%' },
  'AG.LND.FRST.ZS': { id: 'AG.LND.FRST.ZS', label: 'Độ che phủ rừng', unit: '%' },
  'EG.FEC.RNEW.ZS': { id: 'EG.FEC.RNEW.ZS', label: 'Năng lượng tái tạo tiêu thụ', unit: '%' },
  'EN.ATM.CO2E.PC': { id: 'EN.ATM.CO2E.PC', label: 'Phát thải CO₂ bình quân', unit: 'tấn/người' },
};

export interface WorldBankComparisonRow {
  year: number;
  values: Record<string, number | null>;
}

export interface WorldBankMultiCountryComparison {
  indicatorId: string;
  indicatorName: string;
  unit: string;
  countries: Array<{
    countryCode: string;
    countryName: string;
    latestYear: number | null;
    latestValue: number | null;
  }>;
  years: number[];
  rows: WorldBankComparisonRow[];
}

export function mergeWorldBankMultiCountry(
  seriesList: WorldBankSeries[]
): WorldBankMultiCountryComparison {
  const validSeries = seriesList.filter((s) => s && s.countryCode);
  const first = validSeries[0];
  const indicatorId = first?.indicatorId || '';
  const meta = WORLD_BANK_INDICATORS[indicatorId];
  const indicatorName = meta?.label || first?.indicatorName || indicatorId;
  const unit = meta?.unit || '';

  const yearSet = new Set<number>();
  const lookup = new Map<string, Map<number, number>>();
  for (const series of validSeries) {
    const code = series.countryCode.toUpperCase();
    const map = new Map<number, number>();
    for (const pt of series.points || []) {
      if (Number.isFinite(pt.year) && Number.isFinite(pt.value)) {
        yearSet.add(pt.year);
        map.set(pt.year, pt.value);
      }
    }
    lookup.set(code, map);
  }

  const years = Array.from(yearSet).sort((a, b) => a - b);
  const rows: WorldBankComparisonRow[] = years.map((year) => {
    const values: Record<string, number | null> = {};
    for (const series of validSeries) {
      const code = series.countryCode.toUpperCase();
      const v = lookup.get(code)?.get(year);
      values[code] = v === undefined ? null : v;
    }
    return { year, values };
  });

  return {
    indicatorId,
    indicatorName,
    unit,
    countries: validSeries.map((s) => ({
      countryCode: s.countryCode.toUpperCase(),
      countryName: s.countryName || s.countryCode.toUpperCase(),
      latestYear: s.latestYear,
      latestValue: s.latestValue,
    })),
    years,
    rows,
  };
}

export function normalizeWorldBankResponse(
  raw: unknown,
  fallbackCountryCode: string,
  fallbackIndicatorId: string
): WorldBankSeries {
  const rows = Array.isArray(raw) && Array.isArray(raw[1]) ? raw[1] : [];
  let countryName = fallbackCountryCode.toUpperCase();
  let indicatorName =
    WORLD_BANK_INDICATORS[fallbackIndicatorId]?.label || fallbackIndicatorId;

  const points: WorldBankIndicatorPoint[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    if (row.country?.value) countryName = String(row.country.value);
    if (row.indicator?.value && !WORLD_BANK_INDICATORS[fallbackIndicatorId]) {
      indicatorName = String(row.indicator.value);
    }
    const year = Number(row.date);
    const val = row.value === null || row.value === undefined ? NaN : Number(row.value);
    if (Number.isFinite(year) && Number.isFinite(val)) {
      points.push({ year: Math.trunc(year), value: Number(val.toFixed(3)) });
    }
  }

  points.sort((a, b) => a.year - b.year);
  const latest = points.length > 0 ? points[points.length - 1] : null;

  return {
    countryCode: fallbackCountryCode.toUpperCase(),
    countryName,
    indicatorId: fallbackIndicatorId,
    indicatorName,
    points,
    latestYear: latest ? latest.year : null,
    latestValue: latest ? latest.value : null,
  };
}

/* ============================================================================
   4. Wikipedia REST Normalizer (History, Geography, Literature, Library)
   ============================================================================ */

export interface WikipediaSummaryResult {
  lang: 'vi' | 'en';
  title: string;
  description: string;
  extract: string;
  thumbnailUrl?: string;
  pageUrl: string;
}

export function normalizeWikipediaSummary(
  raw: any,
  lang: 'vi' | 'en'
): WikipediaSummaryResult | null {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found') return null;
  const title = String(raw.title || raw.titles?.normalized || '').trim();
  const extract = String(raw.extract || '').trim();
  if (!title || !extract) return null;

  const pageUrl =
    String(
      raw.content_urls?.desktop?.page ||
        raw.content_urls?.mobile?.page ||
        `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, '_'))}`
    ).trim();

  const thumb = raw.thumbnail?.source || raw.originalimage?.source || undefined;

  return {
    lang,
    title,
    description: String(raw.description || '').trim(),
    extract,
    ...(thumb ? { thumbnailUrl: String(thumb) } : {}),
    pageUrl,
  };
}

/* ============================================================================
   5. Gutendex / Project Gutenberg Normalizers (Library & Literature)
   ============================================================================ */

export interface GutendexBookResult {
  id: number;
  title: string;
  authors: Array<{ name: string; birthYear?: number | null; deathYear?: number | null }>;
  authorText: string;
  subjects: string[];
  bookshelves: string[];
  languages: string[];
  downloadCount: number;
  coverUrl: string;
  textUrl?: string;
  htmlUrl?: string;
  epubUrl?: string;
  gutenbergUrl: string;
}

export function normalizeGutendexBook(raw: any): GutendexBookResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = Number(raw.id);
  const title = String(raw.title || '').trim();
  if (!Number.isFinite(id) || id <= 0 || !title) return null;

  const authors: Array<{ name: string; birthYear?: number | null; deathYear?: number | null }> = Array.isArray(raw.authors)
    ? raw.authors
        .map((a: any) => ({
          name: String(a?.name || '').trim(),
          birthYear: typeof a?.birth_year === 'number' ? a.birth_year : null,
          deathYear: typeof a?.death_year === 'number' ? a.death_year : null,
        }))
        .filter((a: { name: string }) => Boolean(a.name))
    : [];

  const formats = raw.formats && typeof raw.formats === 'object' ? raw.formats : {};
  const pickFormat = (prefixes: string[]): string | undefined => {
    for (const prefix of prefixes) {
      const matchKey = Object.keys(formats).find(
        (k) => k.toLowerCase().startsWith(prefix) && typeof formats[k] === 'string'
      );
      if (matchKey) {
        const val = String(formats[matchKey]).trim();
        if (val.startsWith('http://')) return `https://${val.slice('http://'.length)}`;
        if (val.startsWith('https://')) return val;
      }
    }
    return undefined;
  };

  return {
    id,
    title,
    authors,
    authorText: authors.length > 0 ? authors.map((a) => a.name).join('; ') : 'Tác giả khuyết danh',
    subjects: Array.isArray(raw.subjects) ? raw.subjects.map(String).slice(0, 8) : [],
    bookshelves: Array.isArray(raw.bookshelves) ? raw.bookshelves.map(String).slice(0, 5) : [],
    languages: Array.isArray(raw.languages) ? raw.languages.map(String) : [],
    downloadCount: Number(raw.download_count) || 0,
    coverUrl: pickFormat(['image/jpeg', 'image/png']) || '',
    textUrl: pickFormat(['text/plain; charset=utf-8', 'text/plain']),
    htmlUrl: pickFormat(['text/html; charset=utf-8', 'text/html']),
    epubUrl: pickFormat(['application/epub+zip']),
    gutenbergUrl: `https://www.gutenberg.org/ebooks/${id}`,
  };
}

/* ============================================================================
   6. Crossref + arXiv Academic Paper Normalizers (Library STEM Research)
   ============================================================================ */

export type AcademicSource = 'crossref' | 'arxiv';

export interface AcademicPaperResult {
  uid: string;
  source: AcademicSource;
  title: string;
  authors: string[];
  authorText: string;
  publishedYear: number;
  publishedDate: string;
  venue: string;
  abstract: string;
  doi?: string;
  arxivId?: string;
  url: string;
  pdfUrl?: string;
  subjects: string[];
  citationCount?: number;
}

export function normalizeCrossrefWork(raw: any): AcademicPaperResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const rawTitle = Array.isArray(raw.title) ? raw.title[0] : raw.title;
  const title = stripHtmlTags(String(rawTitle || '')).trim();
  if (!title) return null;

  const doi = raw.DOI ? String(raw.DOI).trim() : undefined;
  const authors = Array.isArray(raw.author)
    ? raw.author
        .map((a: any) => [a?.given, a?.family].filter(Boolean).join(' ').trim() || String(a?.name || '').trim())
        .filter(Boolean)
    : [];

  const dateParts =
    raw.published?.['date-parts']?.[0] ||
    raw['published-print']?.['date-parts']?.[0] ||
    raw['published-online']?.['date-parts']?.[0] ||
    raw.created?.['date-parts']?.[0] ||
    [];
  const year = Number(dateParts[0]) || new Date().getFullYear();
  const month = dateParts[1] ? String(dateParts[1]).padStart(2, '0') : '01';
  const day = dateParts[2] ? String(dateParts[2]).padStart(2, '0') : '01';

  const venue = Array.isArray(raw['container-title']) && raw['container-title'][0]
    ? String(raw['container-title'][0]).trim()
    : String(raw.publisher || 'Crossref Journal');

  const url =
    (raw.URL && String(raw.URL).trim()) ||
    (doi ? `https://doi.org/${doi}` : 'https://www.crossref.org/');

  const pdfLink = Array.isArray(raw.link)
    ? raw.link.find((l: any) => String(l?.['content-type'] || '').includes('pdf'))?.URL
    : undefined;

  return {
    uid: `crossref:${doi || title.slice(0, 48)}`,
    source: 'crossref',
    title,
    authors,
    authorText: authors.length > 0 ? authors.join(', ') : 'Chưa rõ tác giả',
    publishedYear: year,
    publishedDate: `${year}-${month}-${day}`,
    venue,
    abstract: stripHtmlTags(raw.abstract || ''),
    doi,
    url,
    ...(pdfLink ? { pdfUrl: String(pdfLink) } : {}),
    subjects: Array.isArray(raw.subject) ? raw.subject.map(String).slice(0, 6) : [],
    ...(typeof raw['is-referenced-by-count'] === 'number'
      ? { citationCount: raw['is-referenced-by-count'] }
      : {}),
  };
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseArxivAtomXml(xml: string): AcademicPaperResult[] {
  if (!xml || typeof xml !== 'string') return [];
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  const results: AcademicPaperResult[] = [];

  for (const entry of entries) {
    const idRaw = /<id>([\s\S]*?)<\/id>/.exec(entry)?.[1]?.trim() || '';
    const titleRaw = /<title>([\s\S]*?)<\/title>/.exec(entry)?.[1] || '';
    const summaryRaw = /<summary>([\s\S]*?)<\/summary>/.exec(entry)?.[1] || '';
    const publishedRaw = /<published>([\s\S]*?)<\/published>/.exec(entry)?.[1]?.trim() || '';

    const title = decodeXmlEntities(titleRaw);
    if (!title) continue;

    const authors: string[] = [];
    const authorRegex = /<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g;
    let aMatch: RegExpExecArray | null;
    while ((aMatch = authorRegex.exec(entry)) !== null) {
      const name = decodeXmlEntities(aMatch[1]);
      if (name) authors.push(name);
    }

    const categories: string[] = [];
    const catRegex = /<category[^>]*term=["']([^"']+)["'][^>]*\/?>/g;
    let cMatch: RegExpExecArray | null;
    while ((cMatch = catRegex.exec(entry)) !== null) {
      if (cMatch[1]) categories.push(cMatch[1]);
    }

    const pdfMatch =
      /<link[^>]*title=["']pdf["'][^>]*href=["']([^"']+)["']/i.exec(entry) ||
      /<link[^>]*href=["']([^"']+)["'][^>]*title=["']pdf["']/i.exec(entry);

    const arxivId = idRaw.replace(/^https?:\/\/arxiv\.org\/abs\//i, '').trim() || undefined;
    const yearMatch = /^(\d{4})/.exec(publishedRaw);
    const publishedYear = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();

    results.push({
      uid: `arxiv:${arxivId || title.slice(0, 48)}`,
      source: 'arxiv',
      title,
      authors,
      authorText: authors.length > 0 ? authors.join(', ') : 'arXiv Author',
      publishedYear,
      publishedDate: publishedRaw ? publishedRaw.slice(0, 10) : String(publishedYear),
      venue: `arXiv (${categories[0] || 'Preprint'})`,
      abstract: decodeXmlEntities(summaryRaw),
      arxivId,
      url: idRaw.replace(/^http:\/\//i, 'https://') || 'https://arxiv.org/',
      pdfUrl: pdfMatch?.[1]?.replace(/^http:\/\//i, 'https://'),
      subjects: categories.slice(0, 6),
    });
  }

  return results;
}

export type CitationFormat = 'bibtex' | 'apa' | 'ieee';

export function formatAcademicCitation(
  paper: Pick<
    AcademicPaperResult,
    'source' | 'title' | 'authors' | 'authorText' | 'publishedYear' | 'venue' | 'doi' | 'arxivId' | 'url'
  >,
  format: CitationFormat
): string {
  const year = paper.publishedYear || new Date().getFullYear();
  const authors = paper.authors && paper.authors.length > 0 ? paper.authors : [paper.authorText || 'Unknown'];
  const firstSurname = (authors[0].split(/\s+/).pop() || 'ref').toLowerCase().replace(/[^a-z0-9]/g, '') || 'ref';

  if (format === 'bibtex') {
    const key = `${firstSurname}${year}${(paper.doi || paper.arxivId || '').replace(/[^a-z0-9]/gi, '').slice(0, 8)}`;
    const entryType = paper.source === 'crossref' ? 'article' : 'misc';
    const bibAuthors = authors.join(' and ');
    const lines = [
      `@${entryType}{${key},`,
      `  title = {${paper.title}},`,
      `  author = {${bibAuthors}},`,
      `  year = {${year}},`,
      paper.source === 'crossref' ? `  journal = {${paper.venue}},` : `  howpublished = {${paper.venue}},`,
    ];
    if (paper.doi) lines.push(`  doi = {${paper.doi}},`);
    if (paper.arxivId) {
      lines.push(`  eprint = {${paper.arxivId}},`);
      lines.push(`  archivePrefix = {arXiv},`);
    }
    if (paper.url) lines.push(`  url = {${paper.url}},`);
    lines.push('}');
    return lines.join('\n');
  }

  if (format === 'apa') {
    const apaAuthors =
      authors.length > 3
        ? `${authors[0]} et al.`
        : authors.join(', ');
    const idPart = paper.doi
      ? `https://doi.org/${paper.doi}`
      : paper.url || '';
    return `${apaAuthors} (${year}). ${paper.title}. ${paper.venue}.${idPart ? ` ${idPart}` : ''}`.trim();
  }

  // ieee
  const ieeeAuthors =
    authors.length > 3
      ? `${authors[0]} et al.`
      : authors.join(', ');
  const idPart = paper.doi ? `doi: ${paper.doi}.` : paper.arxivId ? `arXiv:${paper.arxivId}.` : '';
  return `${ieeeAuthors}, "${paper.title}," ${paper.venue}, ${year}.${idPart ? ` ${idPart}` : ''}`.trim();
}

export interface EventWeatherRiskEvaluation {
  level: 'safe' | 'caution' | 'warning';
  badgeLabel: string;
  summary: string;
}

export function evaluateEventWeatherRisk(forecast: {
  precipitationProbabilityMax?: number;
  precipitationSum?: number;
  windSpeedMax?: number;
  tempMax?: number;
  weatherCode?: number;
}): EventWeatherRiskEvaluation {
  const rainProb = Number(forecast.precipitationProbabilityMax) || 0;
  const rainSum = Number(forecast.precipitationSum) || 0;
  const wind = Number(forecast.windSpeedMax) || 0;
  const tempMax = Number(forecast.tempMax);
  const code = Number(forecast.weatherCode) || 0;

  const isStorm = code >= 95 || rainProb >= 75 || rainSum >= 18 || wind >= 42;
  const isHeatOrCold = Number.isFinite(tempMax) && (tempMax >= 36.5 || tempMax <= 10);

  if (isStorm || (Number.isFinite(tempMax) && tempMax >= 39)) {
    const reasons: string[] = [];
    if (code >= 95) reasons.push('có nguy cơ dông sét');
    if (rainProb >= 75 || rainSum >= 18) reasons.push(`mưa lớn (${rainProb}% / ${rainSum.toFixed(1)} mm)`);
    if (wind >= 42) reasons.push(`gió mạnh (${Math.round(wind)} km/h)`);
    if (Number.isFinite(tempMax) && tempMax >= 39) reasons.push(`nắng nóng gay gắt (${tempMax.toFixed(1)}°C)`);
    return {
      level: 'warning',
      badgeLabel: 'Cảnh báo ngoài trời',
      summary: `Thời tiết bất lợi (${reasons.join(', ')}). Nên chuẩn bị phương án hội trường hoặc mái che dự phòng.`,
    };
  }

  if (rainProb >= 40 || rainSum >= 4 || wind >= 25 || isHeatOrCold || code >= 51) {
    const tips: string[] = [];
    if (rainProb >= 40 || rainSum >= 4 || code >= 51) tips.push(`khả năng có mưa (${rainProb}%)`);
    if (wind >= 25) tips.push(`gió khá (${Math.round(wind)} km/h)`);
    if (isHeatOrCold && Number.isFinite(tempMax)) tips.push(`nhiệt độ cực đại ${tempMax.toFixed(1)}°C`);
    return {
      level: 'caution',
      badgeLabel: 'Cần lưu ý',
      summary: `Điều kiện trung bình (${tips.join(', ') || 'mây thay đổi'}). Nên nhắc học sinh mang ô/nước uống và cố định banner.`,
    };
  }

  return {
    level: 'safe',
    badgeLabel: 'Thuận lợi ngoài trời',
    summary: 'Thời tiết ổn định, ít khả năng mưa lớn hay gió giật — phù hợp tổ chức sự kiện sân trường.',
  };
}

/* ============================================================================
   7. NASA Open APIs Normalizers (Physics & Astronomy)
   ============================================================================ */

export interface NasaApodResult {
  date: string;
  title: string;
  explanation: string;
  mediaType: 'image' | 'video';
  url: string;
  hdUrl?: string;
  thumbnailUrl?: string;
  copyright?: string;
}

export function normalizeNasaApod(raw: any): NasaApodResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const title = String(raw.title || '').trim();
  const url = String(raw.url || '').trim();
  if (!title || !url) return null;

  return {
    date: String(raw.date || new Date().toISOString().slice(0, 10)),
    title,
    explanation: String(raw.explanation || '').trim(),
    mediaType: raw.media_type === 'video' ? 'video' : 'image',
    url,
    ...(raw.hdurl ? { hdUrl: String(raw.hdurl) } : {}),
    ...(raw.thumbnail_url ? { thumbnailUrl: String(raw.thumbnail_url) } : {}),
    ...(raw.copyright ? { copyright: String(raw.copyright).trim() } : {}),
  };
}

export interface NasaNeoItem {
  id: string;
  name: string;
  closeApproachDate: string;
  diameterMinM: number;
  diameterMaxM: number;
  velocityKmS: number;
  missDistanceKm: number;
  missDistanceLunar: number;
  isPotentiallyHazardous: boolean;
  nasaJplUrl: string;
  estimatedMassKg: number;
  kineticEnergyMegatons: number;
}

/**
 * Estimates sphere mass (density ~2600 kg/m³ stony asteroid) and relativistic-free
 * classical kinetic energy E = 1/2 * m * v^2 expressed in Megatons TNT (1 Mt = 4.184e15 J).
 */
export function computeNeoPhysics(diameterMeters: number, velocityKmS: number): {
  estimatedMassKg: number;
  kineticEnergyMegatons: number;
} {
  const d = Math.max(0, diameterMeters);
  const vMs = Math.max(0, velocityKmS) * 1000;
  const radius = d / 2;
  const volume = (4 / 3) * Math.PI * Math.pow(radius, 3);
  const densityKgM3 = 2600;
  const mass = volume * densityKgM3;
  const energyJoules = 0.5 * mass * vMs * vMs;
  const megatons = energyJoules / 4.184e15;
  return {
    estimatedMassKg: Math.round(mass),
    kineticEnergyMegatons: Number(megatons.toFixed(4)),
  };
}

export function normalizeNasaNeoFeed(raw: any): NasaNeoItem[] {
  const byDate = raw?.near_earth_objects;
  if (!byDate || typeof byDate !== 'object') return [];
  const items: NasaNeoItem[] = [];

  for (const dateKey of Object.keys(byDate).sort()) {
    const arr = Array.isArray(byDate[dateKey]) ? byDate[dateKey] : [];
    for (const neo of arr) {
      const approach = Array.isArray(neo?.close_approach_data)
        ? neo.close_approach_data[0]
        : null;
      const dMin = Number(neo?.estimated_diameter?.meters?.estimated_diameter_min) || 10;
      const dMax = Number(neo?.estimated_diameter?.meters?.estimated_diameter_max) || dMin;
      const avgD = (dMin + dMax) / 2;
      const velocityKmS = Number(approach?.relative_velocity?.kilometers_per_second) || 0;
      const missKm = Number(approach?.miss_distance?.kilometers) || 0;
      const missLunar = Number(approach?.miss_distance?.lunar) || 0;
      const physics = computeNeoPhysics(avgD, velocityKmS);

      items.push({
        id: String(neo?.id || neo?.neo_reference_id || `${dateKey}-${items.length}`),
        name: String(neo?.name || 'Unknown NEO').replace(/[()]/g, '').trim(),
        closeApproachDate: String(approach?.close_approach_date || dateKey),
        diameterMinM: Number(dMin.toFixed(1)),
        diameterMaxM: Number(dMax.toFixed(1)),
        velocityKmS: Number(velocityKmS.toFixed(2)),
        missDistanceKm: Math.round(missKm),
        missDistanceLunar: Number(missLunar.toFixed(2)),
        isPotentiallyHazardous: Boolean(neo?.is_potentially_hazardous_asteroid),
        nasaJplUrl: String(neo?.nasa_jpl_url || 'https://ssd.jpl.nasa.gov/'),
        estimatedMassKg: physics.estimatedMassKg,
        kineticEnergyMegatons: physics.kineticEnergyMegatons,
      });
    }
  }

  return items.sort((a, b) => a.missDistanceKm - b.missDistanceKm);
}

export interface NasaMediaItem {
  nasaId: string;
  title: string;
  description: string;
  dateCreated: string;
  center: string;
  imageUrl: string;
}

export function normalizeNasaMediaItems(raw: any): NasaMediaItem[] {
  const items = raw?.collection?.items;
  if (!Array.isArray(items)) return [];
  const results: NasaMediaItem[] = [];

  for (const item of items) {
    const meta = Array.isArray(item?.data) ? item.data[0] : null;
    const link = Array.isArray(item?.links)
      ? item.links.find((l: any) => l?.render === 'image' || l?.rel === 'preview')
      : null;
    if (!meta?.title || !link?.href) continue;

    results.push({
      nasaId: String(meta.nasa_id || results.length),
      title: String(meta.title).trim(),
      description: stripHtmlTags(String(meta.description || '')).slice(0, 320),
      dateCreated: String(meta.date_created || '').slice(0, 10),
      center: String(meta.center || 'NASA'),
      imageUrl: String(link.href).replace(/^http:\/\//i, 'https://'),
    });
  }
  return results.slice(0, 12);
}

/* ============================================================================
   8. Datamuse + Wiktionary Lexicon Normalizers (English & Literature)
   ============================================================================ */

export interface DatamuseWordItem {
  word: string;
  score: number;
  tags?: string[];
  defs?: string[];
}

export interface WiktionaryMeaning {
  partOfSpeech: string;
  definitions: Array<{ definition: string; example?: string }>;
}

export interface LexiconLookupResult {
  word: string;
  lang: 'en' | 'vi';
  ipa?: string;
  meanings: WiktionaryMeaning[];
  synonyms: string[];
  antonyms: string[];
  relatedTriggers: string[];
  collocations: string[];
  rhymes: string[];
  soundsLike: string[];
  reverseMatches: Array<{ word: string; defs: string[] }>;
  wiktionaryUrl: string;
  sources: Array<'wiktionary' | 'datamuse'>;
}

export function normalizeDatamuseList(raw: unknown): DatamuseWordItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) => ({
      word: String(item?.word || '').trim(),
      score: Number(item?.score) || 0,
      ...(Array.isArray(item?.tags) ? { tags: item.tags.map(String) } : {}),
      ...(Array.isArray(item?.defs) ? { defs: item.defs.map((d: unknown) => stripHtmlTags(String(d))) } : {}),
    }))
    .filter((item) => Boolean(item.word));
}

export function normalizeWiktionaryEnRest(raw: unknown): WiktionaryMeaning[] {
  if (!raw || typeof raw !== 'object') return [];
  const data = raw as Record<string, unknown>;
  const enBlocks = Array.isArray(data.en) ? data.en : Object.values(data).find(Array.isArray);
  if (!Array.isArray(enBlocks)) return [];

  const meanings: WiktionaryMeaning[] = [];
  for (const block of enBlocks) {
    if (!block || typeof block !== 'object') continue;
    const pos = String((block as any).partOfSpeech || 'Term').trim();
    const rawDefs = Array.isArray((block as any).definitions) ? (block as any).definitions : [];
    const definitions = rawDefs
      .map((d: any) => {
        const cleanDef = stripHtmlTags(String(d?.definition || '')).trim();
        if (!cleanDef) return null;
        const firstEx =
          Array.isArray(d?.parsedExamples) && d.parsedExamples[0]?.example
            ? stripHtmlTags(String(d.parsedExamples[0].example)).trim()
            : Array.isArray(d?.examples) && d.examples[0]
            ? stripHtmlTags(String(d.examples[0])).trim()
            : undefined;
        return { definition: cleanDef, ...(firstEx ? { example: firstEx } : {}) };
      })
      .filter((x: any): x is { definition: string; example?: string } => Boolean(x))
      .slice(0, 5);

    if (definitions.length > 0) {
      meanings.push({ partOfSpeech: pos, definitions });
    }
  }
  return meanings;
}

export function normalizeWiktionaryViExtract(raw: any): WiktionaryMeaning[] {
  const pages = raw?.query?.pages;
  if (!pages || typeof pages !== 'object') return [];
  const firstPage = Object.values(pages)[0] as any;
  const extract = String(firstPage?.extract || '').trim();
  if (!extract || firstPage?.missing !== undefined) return [];

  const blocks: WiktionaryMeaning[] = [];
  let currentPos = 'Wiktionary Tiếng Việt';
  let currentDefs: Array<{ definition: string }> = [];

  const flushBlock = () => {
    if (currentDefs.length > 0) {
      blocks.push({
        partOfSpeech: currentPos,
        definitions: currentDefs.slice(0, 6),
      });
      currentDefs = [];
    }
  };

  for (const rawLine of extract.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const h3Match = /^===\s*(.+?)\s*===$/.exec(line);
    if (h3Match) {
      flushBlock();
      currentPos = h3Match[1].trim() || 'Mục từ';
      continue;
    }
    if (line.startsWith('==')) {
      continue;
    }
    currentDefs.push({ definition: line });
  }
  flushBlock();

  return blocks.slice(0, 5);
}
