export type GeoDomain = 'Tự nhiên' | 'Dân cư' | 'Kinh tế' | 'Xã hội' | 'Môi trường';

export type AtlasLayerId =
  | 'topography'
  | 'administrative'
  | 'climate'
  | 'hydrology'
  | 'population'
  | 'economy'
  | 'transport'
  | 'resources';

export interface AtlasLayerMeta {
  id: AtlasLayerId;
  label: string;
  color: string;
}

export const ATLAS_LAYERS: readonly AtlasLayerMeta[] = [
  { id: 'topography', label: 'Địa hình', color: '#8C6D46' },
  { id: 'administrative', label: 'Hành chính', color: '#B84A39' },
  { id: 'climate', label: 'Khí hậu', color: '#D97706' },
  { id: 'hydrology', label: 'Sông ngòi', color: '#0284C7' },
  { id: 'population', label: 'Dân cư', color: '#7C3AED' },
  { id: 'economy', label: 'Kinh tế', color: '#0B4F6C' },
  { id: 'transport', label: 'Giao thông', color: '#475569' },
  { id: 'resources', label: 'Tài nguyên', color: '#2D6A4F' },
] as const;

export interface GeoLesson {
  id: string;
  title: string;
  grade: string;
  chapter: string;
  topic: string;
  domain: GeoDomain;
  summary: string;
  keyPoints: string;
  examples: string;
  dataNotes: string;
  source: string;
  yearRef: string;
  media: Array<{ name: string; type: 'image' | 'doc'; url: string; content?: string }>;
  bookmarked?: boolean;
  completed?: boolean;
  highlights?: Array<{ id: string; text: string; createdAt: string }>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AtlasFeature {
  id: string;
  name: string;
  scope: 'vietnam' | 'world';
  layer: AtlasLayerId;
  kind: 'point' | 'polygon' | 'polyline';
  lat: number;
  lon: number;
  coordinates?: number[][][]; // For GeoJSON polygons/polylines (rings of [lon, lat])
  region: string;
  country: string;
  summary: string;
  metricsText: string;
  source: string;
  yearRef: string;
  createdAt?: string;
}

export interface GeoDatasetRow {
  label: string;
  values: Array<number | null>;
}

export interface GeoDataset {
  id: string;
  title: string;
  category: 'Dân số' | 'Diện tích' | 'Khí hậu' | 'Kinh tế' | 'Nông nghiệp' | 'Công nghiệp';
  unit: string;
  secondaryUnit?: string;
  chartType: 'bar' | 'line' | 'pie' | 'combo';
  columns: string[];
  rows: GeoDatasetRow[];
  analysis: string;
  source: string;
  yearRange: string;
  createdAt: string;
  updatedAt: string;
}

export type GeoQuestionType = 'mcq' | 'tf' | 'short' | 'atlas' | 'data';

export interface GeoQuestion {
  id: string;
  type: GeoQuestionType;
  grade: string;
  chapter: string;
  topic: string;
  prompt: string;
  options?: string[];
  correctIndex?: number;
  correctBool?: boolean;
  correctAnswerText?: string;
  acceptedKeywords?: string[];
  linkedDatasetId?: string;
  linkedAtlasId?: string;
  imageUrl?: string;
  methodGuide: string;
  explanation: string;
  source?: string;
  createdAt?: string;
}

export type GeoAnswerPayload =
  | { type: 'mcq' | 'atlas' | 'data'; selectedIndex: number | null; textAnswer?: string }
  | { type: 'tf'; selectedBool: boolean | null }
  | { type: 'short'; textAnswer: string };

export type GeoExcelModule = 'knowledge' | 'atlas' | 'data' | 'practice' | 'test';

export function roundGeo(val: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

/**
 * Computes structural share percentages (%) that sum to ~100%.
 */
export function calculateStructurePercentages(values: number[]): Array<number | null> {
  const clean = values.map((v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null));
  const total = clean.reduce<number>((sum, v) => sum + (v ?? 0), 0);
  if (total <= 0) return clean.map(() => null);
  return clean.map((v) => (v === null ? null : roundGeo((v / total) * 100, 2)));
}

/**
 * Computes population density (people/km²).
 */
export function calculatePopulationDensity(
  population: number,
  areaKm2: number
): number | null {
  if (!Number.isFinite(population) || !Number.isFinite(areaKm2) || areaKm2 <= 0 || population < 0) {
    return null;
  }
  return roundGeo(population / areaKm2, 2);
}

/**
 * Computes growth index (base = 100%) and year-over-year growth rate (%).
 */
export function calculateGrowthIndices(
  series: Array<{ label: string; value: number | null }>
): Array<{
  label: string;
  value: number | null;
  indexPercent: number | null;
  yoyPercent: number | null;
}> {
  const firstValid = series.find((s) => typeof s.value === 'number' && Number.isFinite(s.value) && s.value > 0);
  const baseVal = firstValid?.value ?? null;

  return series.map((item, idx) => {
    const val = typeof item.value === 'number' && Number.isFinite(item.value) ? item.value : null;
    const indexPercent =
      val !== null && baseVal !== null && baseVal > 0 ? roundGeo((val / baseVal) * 100, 2) : null;

    let yoyPercent: number | null = null;
    if (idx > 0 && val !== null) {
      const prev = series[idx - 1]?.value;
      if (typeof prev === 'number' && Number.isFinite(prev) && prev > 0) {
        yoyPercent = roundGeo(((val - prev) / prev) * 100, 2);
      }
    }

    return {
      label: item.label,
      value: val,
      indexPercent,
      yoyPercent,
    };
  });
}

/**
 * Computes per-capita or general average indicator.
 */
export function calculatePerCapitaAverage(totalValue: number, divisor: number): number | null {
  if (!Number.isFinite(totalValue) || !Number.isFinite(divisor) || divisor <= 0) {
    return null;
  }
  return roundGeo(totalValue / divisor, 2);
}

/**
 * Parses coordinate strings such as "21.0285, 105.8542", "21.03N 105.85E", "10.8°N, 106.6°E".
 */
export function parseCoordinatePair(raw: string): { lat: number; lon: number } | null {
  const str = String(raw ?? '').trim();
  if (!str) return null;

  // Match two signed or directional decimal numbers
  const match =
    /(-?\d+(?:[.,]\d+)?)\s*°?\s*([NSns])?\s*[,;\s/]+\s*(-?\d+(?:[.,]\d+)?)\s*°?\s*([EWew])?/.exec(
      str
    );
  if (!match) return null;

  let lat = Number(match[1].replace(',', '.'));
  let lon = Number(match[3].replace(',', '.'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  if (match[2] && match[2].toUpperCase() === 'S') lat = -Math.abs(lat);
  if (match[2] && match[2].toUpperCase() === 'N') lat = Math.abs(lat);
  if (match[4] && match[4].toUpperCase() === 'W') lon = -Math.abs(lon);
  if (match[4] && match[4].toUpperCase() === 'E') lon = Math.abs(lon);

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat: roundGeo(lat, 4), lon: roundGeo(lon, 4) };
}

function normalizeLayerId(raw: string): AtlasLayerId {
  const s = normalizeHeaderKey(raw);
  if (s.includes('dia_hinh') || s.includes('topo')) return 'topography';
  if (s.includes('hanh_chinh') || s.includes('admin')) return 'administrative';
  if (s.includes('khi_hau') || s.includes('climate')) return 'climate';
  if (s.includes('song') || s.includes('thuy') || s.includes('hydro')) return 'hydrology';
  if (s.includes('dan') || s.includes('pop')) return 'population';
  if (s.includes('kinh_te') || s.includes('econ')) return 'economy';
  if (s.includes('giao_thong') || s.includes('trans')) return 'transport';
  if (s.includes('tai_nguyen') || s.includes('resour')) return 'resources';
  return 'administrative';
}

export function validateAndNormalizeGeoJson(
  rawJson: unknown,
  defaultScope: 'vietnam' | 'world' = 'vietnam',
  defaultLayer: AtlasLayerId = 'administrative'
): AtlasFeature[] {
  if (!rawJson || typeof rawJson !== 'object') return [];
  const obj = rawJson as Record<string, unknown>;
  const rawFeatures =
    obj.type === 'FeatureCollection' && Array.isArray(obj.features)
      ? obj.features
      : obj.type === 'Feature'
        ? [obj]
        : [];

  const out: AtlasFeature[] = [];
  rawFeatures.forEach((entry, idx) => {
    if (!entry || typeof entry !== 'object') return;
    const f = entry as Record<string, unknown>;
    const props = (f.properties && typeof f.properties === 'object' ? f.properties : {}) as Record<
      string,
      unknown
    >;
    const geom = (f.geometry && typeof f.geometry === 'object' ? f.geometry : null) as Record<
      string,
      unknown
    > | null;
    if (!geom) return;

    const name = String(props.name || props.ten || props.NAME || props.ADMIN || `Khu vực #${idx + 1}`).trim();
    const geomType = String(geom.type || '');
    const coords = geom.coordinates;

    if (geomType === 'Point' && Array.isArray(coords) && coords.length >= 2) {
      const lon = Number(coords[0]);
      const lat = Number(coords[1]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        out.push({
          id: `geo-${Date.now()}-${idx}`,
          name,
          scope: defaultScope,
          layer: props.layer ? normalizeLayerId(String(props.layer)) : defaultLayer,
          kind: 'point',
          lat,
          lon,
          region: String(props.region || props.khu_vuc || ''),
          country: String(props.country || props.quoc_gia || (defaultScope === 'vietnam' ? 'Việt Nam' : '')),
          summary: String(props.summary || props.description || ''),
          metricsText: String(props.metrics || ''),
          source: String(props.source || 'GeoJSON nhập vào'),
          yearRef: String(props.year || ''),
        });
      }
    } else if (
      (geomType === 'Polygon' || geomType === 'MultiPolygon' || geomType === 'LineString') &&
      Array.isArray(coords)
    ) {
      const rings: number[][][] =
        geomType === 'Polygon'
          ? (coords as number[][][])
          : geomType === 'LineString'
            ? [coords as number[][]]
            : ((coords as number[][][][]).flat());

      const allPts = rings.flat().filter((pt) => Array.isArray(pt) && pt.length >= 2);
      if (allPts.length > 0) {
        const avgLon = allPts.reduce((s, p) => s + Number(p[0] || 0), 0) / allPts.length;
        const avgLat = allPts.reduce((s, p) => s + Number(p[1] || 0), 0) / allPts.length;
        out.push({
          id: `geo-${Date.now()}-${idx}`,
          name,
          scope: defaultScope,
          layer: props.layer ? normalizeLayerId(String(props.layer)) : defaultLayer,
          kind: geomType === 'LineString' ? 'polyline' : 'polygon',
          lat: roundGeo(avgLat, 4),
          lon: roundGeo(avgLon, 4),
          coordinates: rings,
          region: String(props.region || props.khu_vuc || ''),
          country: String(props.country || props.quoc_gia || ''),
          summary: String(props.summary || props.description || ''),
          metricsText: String(props.metrics || ''),
          source: String(props.source || 'GeoJSON nhập vào'),
          yearRef: String(props.year || ''),
        });
      }
    }
  });

  return out;
}

export function gradeGeoQuestion(
  question: GeoQuestion,
  answer: GeoAnswerPayload | undefined
): { isCorrect: boolean; earned: number; maxPoints: number } {
  const maxPoints = 1;
  if (!answer) return { isCorrect: false, earned: 0, maxPoints };

  if (question.type === 'tf' && answer.type === 'tf') {
    const ok = typeof question.correctBool === 'boolean' && answer.selectedBool === question.correctBool;
    return { isCorrect: ok, earned: ok ? 1 : 0, maxPoints };
  }

  if (question.type === 'short' && answer.type === 'short') {
    const userNorm = answer.textAnswer.trim().toLowerCase();
    if (!userNorm) return { isCorrect: false, earned: 0, maxPoints };
    const expected = (question.correctAnswerText || '').trim().toLowerCase();
    if (expected && userNorm === expected) {
      return { isCorrect: true, earned: 1, maxPoints };
    }
    const keywords = (question.acceptedKeywords || []).map((k) => k.trim().toLowerCase()).filter(Boolean);
    if (keywords.length > 0 && keywords.some((kw) => userNorm.includes(kw))) {
      return { isCorrect: true, earned: 1, maxPoints };
    }
    if (expected && (userNorm.includes(expected) || expected.includes(userNorm))) {
      return { isCorrect: true, earned: 1, maxPoints };
    }
    return { isCorrect: false, earned: 0, maxPoints };
  }

  if (
    (question.type === 'mcq' || question.type === 'atlas' || question.type === 'data') &&
    (answer.type === 'mcq' || answer.type === 'atlas' || answer.type === 'data')
  ) {
    if (Array.isArray(question.options) && question.options.length > 0) {
      const ok = typeof question.correctIndex === 'number' && answer.selectedIndex === question.correctIndex;
      return { isCorrect: ok, earned: ok ? 1 : 0, maxPoints };
    }
    if (question.correctAnswerText && answer.textAnswer) {
      const ok = answer.textAnswer.trim().toLowerCase() === question.correctAnswerText.trim().toLowerCase();
      return { isCorrect: ok, earned: ok ? 1 : 0, maxPoints };
    }
  }

  return { isCorrect: false, earned: 0, maxPoints };
}

/**
 * Generates geography practice questions strictly from user-stored datasets, atlas locations, and lessons.
 * Never fabricates external statistics or geographic facts when stores are empty.
 */
export function generateQuestionsFromGeoData(
  lessons: GeoLesson[],
  atlasFeatures: AtlasFeature[],
  datasets: GeoDataset[]
): GeoQuestion[] {
  const generated: GeoQuestion[] = [];

  // 1. From datasets (Data & Charts -> Practice/Test)
  for (const ds of datasets) {
    if (!ds.rows || ds.rows.length < 2 || !ds.columns || ds.columns.length === 0) continue;
    const lastColIdx = ds.columns.length - 1;
    const lastColName = ds.columns[lastColIdx];
    const validRows = ds.rows.filter(
      (r) => typeof r.values[lastColIdx] === 'number' && Number.isFinite(r.values[lastColIdx])
    );
    if (validRows.length >= 2) {
      const sorted = [...validRows].sort(
        (a, b) => Number(b.values[lastColIdx] ?? 0) - Number(a.values[lastColIdx] ?? 0)
      );
      const top = sorted[0];
      const options = sorted.slice(0, 4).map((r) => r.label);
      const topVal = top.values[lastColIdx];
      generated.push({
        id: `gq-ds-max-${ds.id}-${lastColIdx}`,
        type: 'data',
        grade: 'Tổng hợp',
        chapter: ds.category,
        topic: ds.title,
        prompt: `Căn cứ bảng số liệu "${ds.title}" (${lastColName}), đối tượng nào có giá trị lớn nhất?`,
        options,
        correctIndex: 0,
        linkedDatasetId: ds.id,
        methodGuide: `So sánh trực tiếp giá trị tại cột "${lastColName}" (đơn vị: ${ds.unit}) trong bảng số liệu đã lưu.`,
        explanation: `${top.label} đạt ${topVal} ${ds.unit} (${lastColName})${ds.source ? ` — Nguồn: ${ds.source}` : ''}.`,
        source: ds.source,
      });
    }
  }

  // 2. From Atlas features (Atlas -> Practice/Test)
  if (atlasFeatures.length >= 2) {
    const layerPool = Array.from(
      new Set(
        atlasFeatures.map(
          (f) => ATLAS_LAYERS.find((l) => l.id === f.layer)?.label || f.layer
        )
      )
    );
    if (layerPool.length >= 2) {
      atlasFeatures.slice(0, 3).forEach((feat) => {
        const trueLabel = ATLAS_LAYERS.find((l) => l.id === feat.layer)?.label || feat.layer;
        const distractors = layerPool.filter((l) => l !== trueLabel).slice(0, 3);
        generated.push({
          id: `gq-atl-${feat.id}`,
          type: 'atlas',
          grade: 'Atlat',
          chapter: feat.scope === 'vietnam' ? 'Atlat Việt Nam' : 'Bản đồ Thế giới',
          topic: feat.region || feat.country || 'Địa danh',
          prompt: `Địa danh "${feat.name}" (${feat.lat}°B/N, ${feat.lon}°Đ/T) thuộc lớp bản đồ chuyên đề nào trong Atlat của bạn?`,
          options: [trueLabel, ...distractors],
          correctIndex: 0,
          linkedAtlasId: feat.id,
          methodGuide: 'Đối chiếu ký hiệu chuyên đề và tọa độ trên Atlat tương tác.',
          explanation: `${feat.name} thuộc lớp ${trueLabel}${feat.region ? ` (${feat.region})` : ''}. ${feat.summary || ''}`.trim(),
          source: feat.source,
        });
      });
    }
  }

  // 3. From Lessons (Knowledge -> Practice/Test)
  if (lessons.length >= 2) {
    const domainPool = Array.from(new Set(lessons.map((l) => l.domain)));
    if (domainPool.length >= 2) {
      lessons.slice(0, 3).forEach((lesson) => {
        const distractors = domainPool.filter((d) => d !== lesson.domain).slice(0, 3);
        generated.push({
          id: `gq-les-${lesson.id}`,
          type: 'mcq',
          grade: lesson.grade,
          chapter: lesson.chapter,
          topic: lesson.topic,
          prompt: `Bài học "${lesson.title}" thuộc mảng kiến thức Địa lý nào?`,
          options: [lesson.domain, ...distractors],
          correctIndex: 0,
          methodGuide: 'Xác định đối tượng nghiên cứu trọng tâm của bài học.',
          explanation: `${lesson.title} thuộc phân mảng Địa lý ${lesson.domain}. ${lesson.summary || ''}`.trim(),
          source: lesson.source,
        });
      });
    }
  }

  return generated;
}

function normalizeHeaderKey(raw: string): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function pickField(normMap: Record<string, string>, aliases: string[]): string {
  for (const alias of aliases) {
    if (normMap[alias] !== undefined && normMap[alias] !== '') {
      return normMap[alias];
    }
  }
  return '';
}

function parseGeoDomain(raw: string): GeoDomain {
  const s = normalizeHeaderKey(raw);
  if (s.includes('dan_cu')) return 'Dân cư';
  if (s.includes('kinh_te')) return 'Kinh tế';
  if (s.includes('xa_hoi')) return 'Xã hội';
  if (s.includes('moi_truong')) return 'Môi trường';
  return 'Tự nhiên';
}

export function normalizeGeoExcelRow(
  moduleKey: GeoExcelModule,
  rawRow: Record<string, unknown>,
  rowIndex: number
): Record<string, unknown> | null {
  const normMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawRow)) {
    const nk = normalizeHeaderKey(k);
    const str = String(v ?? '').trim();
    if (nk && str) normMap[nk] = str;
  }
  if (Object.keys(normMap).length === 0) return null;

  if (moduleKey === 'knowledge') {
    const title = pickField(normMap, ['tieu_de', 'ten_bai', 'bai_hoc', 'title', 'name']);
    if (!title) return null;
    const now = new Date().toISOString();
    return {
      id: `gles-${Date.now()}-${rowIndex}`,
      title,
      grade: pickField(normMap, ['lop', 'khoi', 'grade']) || 'Khác',
      chapter: pickField(normMap, ['chuong', 'chapter']) || 'Chuyên đề',
      topic: pickField(normMap, ['chu_de', 'topic']) || 'Địa lý',
      domain: parseGeoDomain(pickField(normMap, ['mang', 'linh_vuc', 'phan_loai', 'domain'])),
      summary: pickField(normMap, ['kien_thuc_trong_tam', 'tom_tat', 'noi_dung', 'summary']),
      keyPoints: pickField(normMap, ['y_chinh', 'diem_nhan', 'key_points']),
      examples: pickField(normMap, ['vi_du', 'minh_hoa', 'examples']),
      dataNotes: pickField(normMap, ['so_lieu', 'du_lieu', 'data_notes']),
      source: pickField(normMap, ['nguon', 'tai_lieu', 'source']),
      yearRef: pickField(normMap, ['nam', 'thoi_diem', 'year']),
      className: pickField(normMap, ['lop_ap_dung', 'class_name', 'classname']) || undefined,
      media: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  if (moduleKey === 'atlas') {
    const name = pickField(normMap, ['dia_danh', 'ten', 'khu_vuc', 'quoc_gia', 'name', 'title']);
    if (!name) return null;
    const latRaw = pickField(normMap, ['vi_do', 'lat', 'latitude']).replace(',', '.');
    const lonRaw = pickField(normMap, ['kinh_do', 'lon', 'lng', 'longitude']).replace(',', '.');
    const coordStr = pickField(normMap, ['toa_do', 'coordinates']);
    const parsedCoord = coordStr ? parseCoordinatePair(coordStr) : null;
    const lat = Number(latRaw) || parsedCoord?.lat || 0;
    const lon = Number(lonRaw) || parsedCoord?.lon || 0;
    const rawScope = normalizeHeaderKey(pickField(normMap, ['pham_vi', 'ban_do', 'scope']));
    const scope: 'vietnam' | 'world' = rawScope.includes('the_gioi') || rawScope.includes('world') ? 'world' : 'vietnam';

    return {
      id: `atl-${Date.now()}-${rowIndex}`,
      name,
      scope,
      layer: normalizeLayerId(pickField(normMap, ['lop_ban_do', 'lop', 'layer'])),
      kind: 'point',
      lat: Number.isFinite(lat) ? lat : 0,
      lon: Number.isFinite(lon) ? lon : 0,
      region: pickField(normMap, ['vung', 'khu_vuc', 'region']),
      country: pickField(normMap, ['quoc_gia', 'country']) || (scope === 'vietnam' ? 'Việt Nam' : ''),
      summary: pickField(normMap, ['thong_tin', 'mo_ta', 'summary']),
      metricsText: pickField(normMap, ['chi_so', 'so_lieu', 'metrics']),
      source: pickField(normMap, ['nguon', 'source']),
      yearRef: pickField(normMap, ['nam', 'year']),
    };
  }

  if (moduleKey === 'practice' || moduleKey === 'test') {
    const prompt = pickField(normMap, ['cau_hoi', 'de_bai', 'prompt', 'question']);
    if (!prompt) return null;
    const rawType = normalizeHeaderKey(pickField(normMap, ['loai', 'dang_cau_hoi', 'type']));
    const type: GeoQuestionType =
      rawType === 'tf' || rawType.includes('dung')
        ? 'tf'
        : rawType === 'short' || rawType.includes('tra_loi_ngan') || rawType.includes('dien')
          ? 'short'
          : rawType.includes('atlat') || rawType.includes('atlas')
            ? 'atlas'
            : rawType.includes('so_lieu') || rawType.includes('bieu_do') || rawType === 'data'
              ? 'data'
              : 'mcq';

    const base = {
      id: `gq-${Date.now()}-${rowIndex}`,
      type,
      grade: pickField(normMap, ['lop', 'grade']) || 'Khác',
      chapter: pickField(normMap, ['chuong', 'chapter']) || 'Chuyên đề',
      topic: pickField(normMap, ['chu_de', 'topic']) || 'Địa lý',
      prompt,
      className: pickField(normMap, ['lop_ap_dung', 'class_name', 'classname']) || undefined,
      methodGuide: pickField(normMap, ['phuong_phap', 'huong_dan', 'method']),
      explanation: pickField(normMap, ['giai_thich', 'loi_giai', 'explanation']),
      source: pickField(normMap, ['nguon', 'source']),
    };

    if (type === 'tf') {
      const ans = normalizeHeaderKey(pickField(normMap, ['dap_an_dung', 'dap_an', 'answer', 'correct']));
      return {
        ...base,
        correctBool: ans === 'dung' || ans === 'true' || ans === 'd' || ans === '1',
      };
    }

    if (type === 'short') {
      const ansText = pickField(normMap, ['dap_an_dung', 'dap_an', 'answer', 'correct']);
      return {
        ...base,
        correctAnswerText: ansText,
        acceptedKeywords: ansText ? ansText.split(/[;,]/).map((s) => s.trim()).filter(Boolean) : [],
      };
    }

    const options = [
      pickField(normMap, ['phuong_an_a', 'dap_an_a', 'a', 'option_a']),
      pickField(normMap, ['phuong_an_b', 'dap_an_b', 'b', 'option_b']),
      pickField(normMap, ['phuong_an_c', 'dap_an_c', 'c', 'option_c']),
      pickField(normMap, ['phuong_an_d', 'dap_an_d', 'd', 'option_d']),
    ].filter(Boolean);

    const ansToken = pickField(normMap, ['dap_an_dung', 'dap_an', 'answer', 'correct']).toUpperCase();
    const letterIdx = ['A', 'B', 'C', 'D'].indexOf(ansToken);
    const correctIndex = letterIdx >= 0 ? letterIdx : Math.max(0, Math.min(3, Number(ansToken) || 0));

    return {
      ...base,
      options: options.length >= 2 ? options : ['Phương án A', 'Phương án B'],
      correctIndex: correctIndex < options.length ? correctIndex : 0,
    };
  }

  return null;
}

/**
 * Converts tabular Excel rows into a structured GeoDataset (for Data & Charts module).
 * Supports arbitrary year/indicator columns: first non-empty label column becomes row label,
 * numeric columns become series columns.
 */
export function normalizeGeoDataMatrixRows(
  rawRows: Record<string, unknown>[],
  meta?: {
    title?: string;
    category?: GeoDataset['category'];
    unit?: string;
    source?: string;
    yearRange?: string;
  }
): GeoDataset | null {
  if (!Array.isArray(rawRows) || rawRows.length === 0) return null;
  const allHeaders = Array.from(
    new Set(rawRows.flatMap((r) => Object.keys(r || {})).map((h) => h.trim()).filter(Boolean))
  );
  if (allHeaders.length < 2) return null;

  // Detect metadata columns vs numeric/data columns
  const labelHeader =
    allHeaders.find((h) =>
      ['doi_tuong', 'chi_tieu', 'dia_phuong', 'tinh', 'vung', 'quoc_gia', 'nam', 'label', 'name', 'hang_muc'].includes(
        normalizeHeaderKey(h)
      )
    ) || allHeaders[0];

  const ignoredMeta = new Set([
    normalizeHeaderKey(labelHeader),
    'don_vi',
    'unit',
    'nguon',
    'source',
    'ghi_chu',
    'note',
  ]);

  const dataColumns = allHeaders.filter((h) => !ignoredMeta.has(normalizeHeaderKey(h)));
  if (dataColumns.length === 0) return null;

  const rows: GeoDatasetRow[] = [];
  let detectedUnit = meta?.unit || '';
  let detectedSource = meta?.source || '';

  for (const r of rawRows) {
    const label = String(r[labelHeader] ?? '').trim();
    if (!label) continue;

    if (!detectedUnit) {
      const uKey = allHeaders.find((h) => ['don_vi', 'unit'].includes(normalizeHeaderKey(h)));
      if (uKey && r[uKey]) detectedUnit = String(r[uKey]).trim();
    }
    if (!detectedSource) {
      const sKey = allHeaders.find((h) => ['nguon', 'source'].includes(normalizeHeaderKey(h)));
      if (sKey && r[sKey]) detectedSource = String(r[sKey]).trim();
    }

    const values = dataColumns.map((col) => {
      const rawVal = r[col];
      if (rawVal === '' || rawVal === null || rawVal === undefined) return null;
      const num = Number(String(rawVal).replace(/\s+/g, '').replace(',', '.'));
      return Number.isFinite(num) ? num : null;
    });

    rows.push({ label, values });
  }

  if (rows.length === 0) return null;
  const now = new Date().toISOString();
  return {
    id: `ds-${Date.now()}`,
    title: meta?.title || 'Bảng số liệu Địa lý nhập từ Excel',
    category: meta?.category || 'Kinh tế',
    unit: detectedUnit || 'Đơn vị',
    chartType: dataColumns.length > 1 ? 'bar' : 'pie',
    columns: dataColumns,
    rows,
    analysis: '',
    source: detectedSource || 'Chưa ghi nguồn',
    yearRange: meta?.yearRange || dataColumns.join(', '),
    createdAt: now,
    updatedAt: now,
  };
}
