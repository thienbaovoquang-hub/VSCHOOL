import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Check,
  Compass,
  Globe,
  MapPin,
  Plus,
  Search,
  Trash2,
  Upload,
} from '../icons/UiIcons';
import {
  ATLAS_LAYERS,
  calculateGrowthIndices,
  calculatePopulationDensity,
  calculateStructurePercentages,
  generateQuestionsFromGeoData,
  gradeGeoQuestion,
  normalizeGeoDataMatrixRows,
  type AtlasFeature,
  type AtlasLayerId,
  type GeoAnswerPayload,
  type GeoDataset,
  type GeoDomain,
  type GeoLesson,
  type GeoQuestion,
} from '../../utils/geographyRules';
import type {
  CountryProfile,
  NominatimPlace,
  WorldBankMultiCountryComparison,
} from '../../utils/externalIntegrations';
import {
  loadSubjectCollection,
  saveSubjectCollection,
} from '../../utils/subjects/subjectDataStore';
import { Modal } from '../common/Modal';
import {
  SubjectEmptyState,
  SubjectWorkspaceShell,
  type GeneratedAiQuizItem,
  type SubjectHostWorkspaceProps,
} from './SubjectWorkspaceShared';

const CHART_PALETTE = ['#0E7490', '#D97706', '#2D6A4F', '#7C3AED', '#DB2777'];

function projectLatLonToSvg(
  lat: number,
  lon: number,
  scope: 'vietnam' | 'world'
): { x: number; y: number } {
  if (scope === 'vietnam') {
    const x = ((lon - 101.5) / 13.5) * 340 + 10;
    const y = ((24.2 - lat) / 16.5) * 500 + 10;
    return { x: Math.max(15, Math.min(345, x)), y: Math.max(15, Math.min(505, y)) };
  }
  const x = ((lon + 180) / 360) * 600;
  const y = ((85 - lat) / 155) * 300;
  return { x: Math.max(10, Math.min(590, x)), y: Math.max(10, Math.min(290, y)) };
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không thể đọc tệp đã chọn.'));
    reader.readAsDataURL(file);
  });
}

export const GeographySubjectView: React.FC<SubjectHostWorkspaceProps> = (props) => {
  const userId = props.currentUser.id;
  const [subTab, setSubTab] = useState<string>(props.initialSubTab || 'knowledge');

  const [lessons, setLessons] = useState<GeoLesson[]>(() =>
    loadSubjectCollection<GeoLesson>(userId, 'geography', 'lessons')
  );
  const [atlasFeatures, setAtlasFeatures] = useState<AtlasFeature[]>(() =>
    loadSubjectCollection<AtlasFeature>(userId, 'geography', 'atlas')
  );
  const [datasets, setDatasets] = useState<GeoDataset[]>(() =>
    loadSubjectCollection<GeoDataset>(userId, 'geography', 'datasets')
  );
  const [customQuestions, setCustomQuestions] = useState<GeoQuestion[]>(() =>
    loadSubjectCollection<GeoQuestion>(userId, 'geography', 'questions')
  );

  useEffect(() => {
    saveSubjectCollection(userId, 'geography', 'lessons', lessons);
  }, [userId, lessons]);
  useEffect(() => {
    saveSubjectCollection(userId, 'geography', 'atlas', atlasFeatures);
  }, [userId, atlasFeatures]);
  useEffect(() => {
    saveSubjectCollection(userId, 'geography', 'datasets', datasets);
  }, [userId, datasets]);
  useEffect(() => {
    saveSubjectCollection(userId, 'geography', 'questions', customQuestions);
  }, [userId, customQuestions]);

  // Knowledge
  const [domainFilter, setDomainFilter] = useState('all');
  const [lessonSearch, setLessonSearch] = useState('');
  const [expandedNoteIds, setExpandedNoteIds] = useState<Record<string, boolean>>({});
  const [docBusy, setDocBusy] = useState(false);
  const [docNotice, setDocNotice] = useState<string | null>(null);
  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [lTitle, setLTitle] = useState('');
  const [lGrade, setLGrade] = useState('Lớp 12');
  const [lDomain, setLDomain] = useState<GeoDomain>('Tự nhiên');
  const [lSummary, setLSummary] = useState('');
  const [lKeyPoints, setLKeyPoints] = useState('');

  // Atlas & Nominatim
  const [atlasScope, setAtlasScope] = useState<'vietnam' | 'world'>('vietnam');
  const [activeLayers, setActiveLayers] = useState<AtlasLayerId[]>([
    'topography',
    'administrative',
    'hydrology',
    'economy',
    'transport',
    'resources',
  ]);
  const [selectedFeatureId, setSelectedFeatureId] = useState('');
  const [osmQuery, setOsmQuery] = useState('');
  const [osmBusy, setOsmBusy] = useState(false);
  const [osmResults, setOsmResults] = useState<NominatimPlace[]>([]);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pName, setPName] = useState('');
  const [pLat, setPLat] = useState('21.0285');
  const [pLon, setPLon] = useState('105.8542');
  const [pLayer, setPLayer] = useState<AtlasLayerId>('administrative');
  const [pSummary, setPSummary] = useState('');

  // Charts & Index Calculators
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [chartMode, setChartMode] = useState<'bar' | 'line' | 'pie' | 'combo'>('bar');
  const [calcPop, setCalcPop] = useState('');
  const [calcArea, setCalcArea] = useState('');
  const [calcStructInputs, setCalcStructInputs] = useState('');
  const [calcGrowthInputs, setCalcGrowthInputs] = useState('');
  const [dsModalOpen, setDsModalOpen] = useState(false);
  const [dTitle, setDTitle] = useState('');
  const [dUnit, setDUnit] = useState('triệu USD');
  const [dCols, setDCols] = useState('2020, 2022, 2024');
  const [dRowsText, setDRowsText] = useState('');

  // REST Countries & World Bank
  const [countryQuery, setCountryQuery] = useState('');
  const [countryLoading, setCountryLoading] = useState(false);
  const [countriesList, setCountriesList] = useState<CountryProfile[]>([]);
  const [wbCountries, setWbCountries] = useState('');
  const [wbIndicator, setWbIndicator] = useState('NY.GDP.PCAP.CD');
  const [wbLoading, setWbLoading] = useState(false);
  const [wbComparison, setWbComparison] = useState<WorldBankMultiCountryComparison | null>(null);
  const [worldError, setWorldError] = useState<string | null>(null);

  // Practice
  const [geoAnswers, setGeoAnswers] = useState<Record<string, GeoAnswerPayload>>({});
  const [practiceSubmitted, setPracticeSubmitted] = useState(false);
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [qType, setQType] = useState<'mcq' | 'tf' | 'short'>('mcq');
  const [qTopic, setQTopic] = useState('Địa lý');
  const [qPrompt, setQPrompt] = useState('');
  const [qOptA, setQOptA] = useState('');
  const [qOptB, setQOptB] = useState('');
  const [qOptC, setQOptC] = useState('');
  const [qOptD, setQOptD] = useState('');
  const [qCorrectIdx, setQCorrectIdx] = useState(0);
  const [qCorrectBool, setQCorrectBool] = useState(true);
  const [qShortAns, setQShortAns] = useState('');
  const [qExplain, setQExplain] = useState('');

  const filteredLessons = useMemo(() => {
    const q = lessonSearch.trim().toLowerCase();
    return lessons.filter((l) => {
      const dOk = domainFilter === 'all' || l.domain === domainFilter;
      const qOk =
        !q ||
        l.title.toLowerCase().includes(q) ||
        l.summary.toLowerCase().includes(q) ||
        l.topic.toLowerCase().includes(q);
      return dOk && qOk;
    });
  }, [domainFilter, lessonSearch, lessons]);

  const visibleAtlasFeatures = useMemo(
    () =>
      atlasFeatures.filter(
        (f) => f.scope === atlasScope && activeLayers.includes(f.layer)
      ),
    [activeLayers, atlasFeatures, atlasScope]
  );

  const activeFeature = useMemo(
    () =>
      atlasFeatures.find((f) => f.id === selectedFeatureId) ||
      visibleAtlasFeatures[0] ||
      null,
    [atlasFeatures, selectedFeatureId, visibleAtlasFeatures]
  );

  const activeDataset = useMemo(
    () => datasets.find((d) => d.id === selectedDatasetId) || datasets[0] || null,
    [datasets, selectedDatasetId]
  );

  const chartDataRows = useMemo(() => {
    if (!activeDataset) return [];
    return activeDataset.columns.map((col, colIdx) => {
      const point: Record<string, string | number> = { name: col };
      activeDataset.rows.forEach((r) => {
        point[r.label] = Number(r.values[colIdx] ?? 0);
      });
      return point;
    });
  }, [activeDataset]);

  const pieDataRows = useMemo(() => {
    if (!activeDataset || activeDataset.columns.length === 0) return [];
    const lastIdx = activeDataset.columns.length - 1;
    return activeDataset.rows.map((r) => ({
      name: r.label,
      value: Number(r.values[lastIdx] ?? 0),
    }));
  }, [activeDataset]);

  const densityResult = useMemo(() => {
    const pop = Number(calcPop);
    const area = Number(calcArea);
    if (!calcPop.trim() || !calcArea.trim()) return null;
    return calculatePopulationDensity(pop, area);
  }, [calcArea, calcPop]);

  const structurePercentages = useMemo(() => {
    if (!calcStructInputs.trim()) return [];
    const nums = calcStructInputs
      .split(/[,;\s]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n >= 0);
    return nums.length > 0 ? calculateStructurePercentages(nums) : [];
  }, [calcStructInputs]);

  const growthResult = useMemo(() => {
    if (!calcGrowthInputs.trim()) return [];
    const vals = calcGrowthInputs
      .split(/[,;\s]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    return vals.length > 0
      ? calculateGrowthIndices(vals.map((v, i) => ({ label: `Mốc ${i + 1}`, value: v })))
      : [];
  }, [calcGrowthInputs]);

  const allQuestions = useMemo(() => {
    const auto = generateQuestionsFromGeoData(lessons, atlasFeatures, datasets);
    return [...customQuestions, ...auto];
  }, [atlasFeatures, customQuestions, datasets, lessons]);

  const handleToggleLayer = (layerId: AtlasLayerId) => {
    setActiveLayers((prev) =>
      prev.includes(layerId) ? prev.filter((l) => l !== layerId) : [...prev, layerId]
    );
  };

  const handleCreateLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lTitle.trim()) return;
    const now = new Date().toISOString();
    const created: GeoLesson = {
      id: `geo-l-${Date.now().toString(36)}`,
      title: lTitle.trim(),
      grade: lGrade,
      chapter: 'Bài học',
      topic: lDomain,
      domain: lDomain,
      summary: lSummary.trim(),
      keyPoints: lKeyPoints.trim(),
      examples: '',
      dataNotes: '',
      source: 'Tự tạo',
      yearRef: String(new Date().getFullYear()),
      media: [],
      createdAt: now,
      updatedAt: now,
    };
    setLessons((prev) => [created, ...prev]);
    setLTitle('');
    setLSummary('');
    setLKeyPoints('');
    setLessonModalOpen(false);
  };

  const handleCreateManualPin = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = Number(pLat);
    const lon = Number(pLon);
    if (!pName.trim() || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const created: AtlasFeature = {
      id: `geo-pin-${Date.now().toString(36)}`,
      name: pName.trim(),
      scope: atlasScope,
      layer: pLayer,
      kind: 'point',
      lat,
      lon,
      region: atlasScope === 'vietnam' ? 'Việt Nam' : 'Thế giới',
      country: atlasScope === 'vietnam' ? 'Việt Nam' : 'Quốc tế',
      summary: pSummary.trim(),
      metricsText: `${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E`,
      source: 'Tự ghim',
      yearRef: String(new Date().getFullYear()),
    };
    setAtlasFeatures((prev) => [created, ...prev]);
    setSelectedFeatureId(created.id);
    if (!activeLayers.includes(pLayer)) {
      setActiveLayers((prev) => [...prev, pLayer]);
    }
    setPName('');
    setPSummary('');
    setPinModalOpen(false);
  };

  const handleCreateDataset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dTitle.trim() || !dRowsText.trim()) return;
    const cols = dCols
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const rows = dRowsText
      .split(/\r?\n/)
      .map((line) => {
        const [labelPart, valsPart] = line.split(':');
        if (!labelPart || !valsPart) return null;
        const values = valsPart
          .split(/[,;\s]+/)
          .map((v) => {
            const n = Number(v.trim());
            return Number.isFinite(n) ? n : null;
          });
        return { label: labelPart.trim(), values };
      })
      .filter((r): r is { label: string; values: Array<number | null> } => Boolean(r));
    if (rows.length === 0 || cols.length === 0) return;
    const now = new Date().toISOString();
    const created: GeoDataset = {
      id: `geo-ds-${Date.now().toString(36)}`,
      title: dTitle.trim(),
      category: 'Kinh tế',
      unit: dUnit.trim() || 'Đơn vị',
      chartType: chartMode,
      columns: cols,
      rows,
      analysis: '',
      source: 'Tự tạo',
      yearRange: `${cols[0]}–${cols[cols.length - 1]}`,
      createdAt: now,
      updatedAt: now,
    };
    setDatasets((prev) => [created, ...prev]);
    setSelectedDatasetId(created.id);
    setDTitle('');
    setDRowsText('');
    setDsModalOpen(false);
  };

  const handleCreateQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qPrompt.trim()) return;
    const opts = [qOptA, qOptB, qOptC, qOptD].map((s) => s.trim()).filter(Boolean);
    const created: GeoQuestion = {
      id: `gq-${Date.now().toString(36)}`,
      type: qType,
      grade: 'Lớp 12',
      chapter: 'Tự tạo',
      topic: qTopic.trim() || 'Địa lý',
      prompt: qPrompt.trim(),
      ...(qType === 'mcq' && opts.length >= 2
        ? { options: opts, correctIndex: Math.min(qCorrectIdx, opts.length - 1) }
        : {}),
      ...(qType === 'tf' ? { correctBool: qCorrectBool } : {}),
      ...(qType === 'short' ? { correctAnswerText: qShortAns.trim() } : {}),
      methodGuide: '',
      explanation: qExplain.trim(),
    };
    setCustomQuestions((prev) => [created, ...prev]);
    setQPrompt('');
    setQOptA('');
    setQOptB('');
    setQOptC('');
    setQOptD('');
    setQShortAns('');
    setQExplain('');
    setQuizModalOpen(false);
  };

  const handleUploadGeoDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setDocBusy(true);
    setDocNotice(null);
    try {
      const fileBase64 = await readFileAsBase64(file);
      const res = await fetch('/api/geography/parse-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, fileBase64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Không đọc được tài liệu.');
      const text = String(data.text || '').trim();
      const title = file.name.replace(/\.[^.]+$/, '');
      const now = new Date().toISOString();
      const newLesson: GeoLesson = {
        id: `geo-up-${Date.now().toString(36)}`,
        title,
        grade: 'Lớp 12',
        chapter: 'Tư liệu nhập',
        topic: 'Địa lý',
        domain: 'Kinh tế',
        summary: text.slice(0, 260) || title,
        keyPoints: text.slice(0, 600),
        examples: '',
        dataNotes: '',
        source: file.name,
        yearRef: String(new Date().getFullYear()),
        media: [],
        createdAt: now,
        updatedAt: now,
      };
      setLessons((prev) => [newLesson, ...prev]);
      setDocNotice(`Đã nhập "${title}".`);
    } catch (err) {
      setDocNotice(err instanceof Error ? err.message : 'Lỗi đọc tài liệu.');
    } finally {
      setDocBusy(false);
    }
  };

  const handleSearchOsm = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = osmQuery.trim();
    if (!q) return;
    setOsmBusy(true);
    try {
      const res = await fetch(`/api/external/nominatim?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.results)) {
        setOsmResults(data.results.slice(0, 5));
      }
    } finally {
      setOsmBusy(false);
    }
  };

  const handlePinOsmPlace = (place: NominatimPlace) => {
    const inVietnam =
      place.countryCode === 'VN' ||
      (place.lat >= 8 && place.lat <= 24 && place.lon >= 102 && place.lon <= 112);
    const scope = inVietnam ? 'vietnam' : 'world';
    const newFeat: AtlasFeature = {
      id: `osm-${Date.now().toString(36)}`,
      name: place.name,
      scope,
      layer: 'administrative',
      kind: 'point',
      lat: place.lat,
      lon: place.lon,
      region: place.state || place.country || 'OpenStreetMap',
      country: place.country || 'Việt Nam',
      summary: place.displayName,
      metricsText: `${place.lat.toFixed(4)}°N, ${place.lon.toFixed(4)}°E`,
      source: 'OpenStreetMap Nominatim',
      yearRef: String(new Date().getFullYear()),
    };
    setAtlasScope(scope);
    setAtlasFeatures((prev) => [newFeat, ...prev]);
    setSelectedFeatureId(newFeat.id);
    if (!activeLayers.includes('administrative')) {
      setActiveLayers((prev) => [...prev, 'administrative']);
    }
  };

  const handleSearchCountries = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = countryQuery.trim();
    if (!q) return;
    setCountryLoading(true);
    setWorldError(null);
    try {
      const res = await fetch(`/api/external/countries?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Không tìm thấy quốc gia.');
      setCountriesList(Array.isArray(data.results) ? data.results.slice(0, 6) : []);
    } catch (err) {
      setWorldError(err instanceof Error ? err.message : 'Lỗi tra cứu quốc gia.');
    } finally {
      setCountryLoading(false);
    }
  };

  const handleFetchWorldBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wbCountries.trim()) return;
    setWbLoading(true);
    setWorldError(null);
    try {
      const res = await fetch(
        `/api/external/worldbank/compare?countries=${encodeURIComponent(wbCountries)}&indicator=${encodeURIComponent(wbIndicator)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Không tải được dữ liệu World Bank.');
      setWbComparison(data.comparison || null);
    } catch (err) {
      setWorldError(err instanceof Error ? err.message : 'Lỗi kết nối World Bank.');
    } finally {
      setWbLoading(false);
    }
  };

  const wbChartRows = useMemo(() => {
    if (!wbComparison) return [];
    return wbComparison.rows.slice(-12).map((row) => {
      const pt: Record<string, string | number | null> = { year: String(row.year) };
      for (const [code, val] of Object.entries(row.values)) {
        pt[code] = val;
      }
      return pt;
    });
  }, [wbComparison]);

  const handleGradeGeoPractice = () => {
    if (allQuestions.length === 0) return;
    let earned = 0;
    allQuestions.forEach((q) => {
      const res = gradeGeoQuestion(q, geoAnswers[q.id]);
      earned += res.earned;
    });
    setPracticeSubmitted(true);
    props.onRecordPracticeResult(
      earned,
      allQuestions.length,
      `Địa Lý (${earned}/${allQuestions.length})`
    );
  };

  const liveContextSummary = useMemo(() => {
    if (subTab === 'charts' && activeDataset) {
      return `Biểu đồ "${activeDataset.title}" (${activeDataset.unit}).`;
    }
    if (subTab === 'atlas' && activeFeature) {
      return `Địa danh "${activeFeature.name}" (${activeFeature.lat}°B ${activeFeature.lon}°Đ).`;
    }
    return `Địa Lý: ${lessons.length} bài, ${atlasFeatures.length} địa danh, ${datasets.length} bảng số liệu.`;
  }, [activeDataset, activeFeature, atlasFeatures.length, datasets.length, lessons.length, subTab]);

  return (
    <SubjectWorkspaceShell
      {...props}
      activeSubTab={subTab}
      onChangeSubTab={setSubTab}
      liveContextSummary={liveContextSummary}
      excelModuleKey="geography"
      excelExportRecords={lessons.map((l) => ({
        TieuDe: l.title,
        Mang: l.domain,
        Lop: l.grade,
        TomTat: l.summary,
        Nguon: l.source,
      }))}
      onImportExcelRows={(rows) => {
        const ds = normalizeGeoDataMatrixRows(rows, { title: 'Bảng số liệu Excel' });
        if (ds) {
          setDatasets((prev) => [ds, ...prev]);
          setSelectedDatasetId(ds.id);
          setSubTab('charts');
        }
      }}
      onInjectGeneratedQuiz={(items: GeneratedAiQuizItem[]) => {
        const mapped: GeoQuestion[] = items.map((g, i) => ({
          id: `gq-ai-${Date.now()}-${i}`,
          type: 'mcq',
          grade: 'Tổng hợp',
          chapter: 'AI',
          topic: g.topic || 'Địa lý',
          prompt: g.question,
          options: g.options,
          correctIndex: g.correctIndex,
          methodGuide: '',
          explanation: g.explanation,
        }));
        setCustomQuestions((prev) => [...mapped, ...prev]);
        setPracticeSubmitted(false);
        setSubTab('practice');
      }}
    >
      {subTab === 'knowledge' && (
        <div className="space-y-3" data-testid="geography-knowledge-panel">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {['all', 'Tự nhiên', 'Dân cư', 'Kinh tế', 'Môi trường', 'Xã hội'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDomainFilter(d)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                    domainFilter === d ? 'bg-cyan-700 text-white' : 'glass-subsurface text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {d === 'all' ? 'Tất cả' : d}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={lessonSearch}
                  onChange={(e) => setLessonSearch(e.target.value)}
                  placeholder="Tìm…"
                  className="pl-8 pr-3 py-1.5 rounded-xl glass-subsurface text-xs text-slate-900 dark:text-white w-40"
                />
              </div>
              <button
                type="button"
                data-testid="geo-add-lesson-btn"
                onClick={() => setLessonModalOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm kiến thức</span>
              </button>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-subsurface text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer whitespace-nowrap shrink-0">
                <Upload className="w-3.5 h-3.5" />
                <span>{docBusy ? 'Đang nhập…' : 'Nhập Word / PDF'}</span>
                <input
                  type="file"
                  accept=".docx,.pdf,.txt,.csv"
                  onChange={handleUploadGeoDoc}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {docNotice && (
            <div className="px-3 py-2 rounded-xl bg-emerald-500/15 text-xs text-emerald-700 dark:text-emerald-300">
              {docNotice}
            </div>
          )}

          {filteredLessons.length === 0 ? (
            <SubjectEmptyState
              testId="geo-knowledge-empty"
              title="Chưa có kiến thức Địa lý nào."
              actions={[
                { label: '+ Thêm kiến thức', onClick: () => setLessonModalOpen(true), primary: true },
                { label: 'Mở Atlat', onClick: () => setSubTab('atlas') },
              ]}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredLessons.map((lesson) => {
                const mastered = props.progress.masteredIds.includes(lesson.id);
                const noteText = props.progress.notesByItemId[lesson.id] || '';
                const noteOpen = Boolean(expandedNoteIds[lesson.id]);
                return (
                  <div key={lesson.id} className="liquid-glass-panel rounded-2xl p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[11px] font-semibold text-cyan-700 dark:text-cyan-300">
                          {lesson.domain} · {lesson.grade}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                          {lesson.title}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedNoteIds((prev) => ({
                              ...prev,
                              [lesson.id]: !prev[lesson.id],
                            }))
                          }
                          className={`px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                            noteOpen || noteText
                              ? 'bg-cyan-700/15 text-cyan-700 dark:text-cyan-300'
                              : 'glass-subsurface text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {noteOpen ? 'Ẩn ghi chú' : noteText ? 'Sửa ghi chú' : '+ Ghi chú'}
                        </button>
                        <button
                          type="button"
                          onClick={() => props.onToggleMastered(lesson.id)}
                          className={`p-1.5 rounded-lg cursor-pointer ${
                            mastered ? 'bg-emerald-600 text-white' : 'glass-subsurface text-slate-500'
                          }`}
                          title="Đánh dấu đã nắm"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setLessons((prev) => prev.filter((item) => item.id !== lesson.id))
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                          title="Xóa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {lesson.summary && (
                      <p className="text-xs text-slate-700 dark:text-slate-200">{lesson.summary}</p>
                    )}
                    {lesson.keyPoints && (
                      <pre className="whitespace-pre-wrap font-sans text-[11px] text-slate-700 dark:text-slate-200 rounded-xl bg-slate-900/5 dark:bg-white/5 px-3 py-2">
                        {lesson.keyPoints}
                      </pre>
                    )}
                    {!noteOpen && noteText && (
                      <p
                        onClick={() =>
                          setExpandedNoteIds((prev) => ({ ...prev, [lesson.id]: true }))
                        }
                        className="text-[11px] text-slate-500 dark:text-slate-400 truncate cursor-pointer"
                      >
                        Ghi chú: {noteText}
                      </p>
                    )}
                    {noteOpen && (
                      <textarea
                        rows={2}
                        value={noteText}
                        onChange={(e) => props.onSaveStudyNote(lesson.id, e.target.value)}
                        placeholder="Ghi chú riêng…"
                        className="w-full px-2.5 py-1.5 rounded-xl glass-subsurface text-xs text-slate-900 dark:text-white"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {subTab === 'atlas' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3" data-testid="geography-atlas-panel">
          <div className="lg:col-span-7 liquid-glass-panel rounded-2xl p-4 space-y-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1.5">
                  {(['vietnam', 'world'] as const).map((sc) => (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => setAtlasScope(sc)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                        atlasScope === sc ? 'bg-cyan-700 text-white' : 'glass-subsurface text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {sc === 'vietnam' ? 'Việt Nam' : 'Thế giới'}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setPinModalOpen(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-cyan-700 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ghim tọa độ</span>
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {ATLAS_LAYERS.map((layer) => {
                  const on = activeLayers.includes(layer.id);
                  return (
                    <button
                      key={layer.id}
                      type="button"
                      onClick={() => handleToggleLayer(layer.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors whitespace-nowrap shrink-0 ${
                        on
                          ? 'text-white border-transparent shadow-xs'
                          : 'glass-subsurface text-slate-600 dark:text-slate-200 border-slate-300/60 dark:border-slate-600/60 opacity-80'
                      }`}
                      style={on ? { backgroundColor: layer.color } : undefined}
                    >
                      {layer.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="glass-subsurface rounded-xl p-2">
              <svg
                viewBox={atlasScope === 'vietnam' ? '0 0 360 520' : '0 0 600 300'}
                className="w-full h-80 rounded-xl bg-cyan-50/70 dark:bg-slate-900/70"
              >
                {atlasScope === 'vietnam' ? (
                  <path
                    d="M115,35 L205,40 L235,98 L195,180 L238,275 L252,380 L195,465 L138,495 L105,452 L145,400 L175,325 L160,240 L118,165 L92,98 Z"
                    fill="rgba(14, 116, 144, 0.14)"
                    stroke="#0E7490"
                    strokeWidth={2}
                  />
                ) : (
                  <g opacity={0.35} className="fill-cyan-700 dark:fill-cyan-400">
                    <rect x={45} y={45} width={120} height={90} rx={14} />
                    <rect x={110} y={150} width={80} height={110} rx={14} />
                    <rect x={250} y={50} width={220} height={115} rx={16} />
                    <rect x={265} y={145} width={95} height={110} rx={14} />
                    <rect x={455} y={185} width={95} height={65} rx={12} />
                  </g>
                )}

                {visibleAtlasFeatures.map((feat) => {
                  const pt = projectLatLonToSvg(feat.lat, feat.lon, atlasScope);
                  const layerMeta = ATLAS_LAYERS.find((l) => l.id === feat.layer);
                  const selected = activeFeature?.id === feat.id;
                  return (
                    <g key={feat.id} onClick={() => setSelectedFeatureId(feat.id)} className="cursor-pointer">
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={selected ? 9 : 6}
                        fill={layerMeta?.color || '#0E7490'}
                        stroke="#FFFFFF"
                        strokeWidth={2}
                      />
                      <text x={pt.x + 10} y={pt.y + 3} fontSize={9.5} fontWeight={700} className="fill-slate-800 dark:fill-slate-100">
                        {feat.name}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-3">
            {activeFeature ? (
              <div className="liquid-glass-panel rounded-2xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-cyan-700 dark:text-cyan-300" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {activeFeature.name}
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono-tabular">
                        {activeFeature.lat}°N · {activeFeature.lon}°E · {activeFeature.region}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setAtlasFeatures((prev) => prev.filter((f) => f.id !== activeFeature.id))
                    }
                    className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {activeFeature.summary && (
                  <p className="text-xs text-slate-700 dark:text-slate-200">{activeFeature.summary}</p>
                )}
              </div>
            ) : (
              <div className="liquid-glass-panel rounded-2xl p-4 text-xs text-slate-500 text-center">
                Tìm địa danh bên dưới hoặc nhấn &ldquo;+ Ghim tọa độ&rdquo; để đánh dấu lên bản đồ.
              </div>
            )}

            <div className="liquid-glass-panel rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-700 dark:text-cyan-300" />
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  OpenStreetMap
                </h4>
              </div>
              <form onSubmit={handleSearchOsm} className="flex gap-1.5">
                <input
                  type="text"
                  value={osmQuery}
                  onChange={(e) => setOsmQuery(e.target.value)}
                  placeholder="Tìm địa danh (Vịnh Hạ Long, Tokyo…)"
                  className="flex-1 min-w-0 px-3 py-1.5 rounded-xl glass-subsurface text-xs text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={osmBusy || !osmQuery.trim()}
                  className="px-3 py-1.5 rounded-xl bg-cyan-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                >
                  {osmBusy ? '…' : 'Tìm'}
                </button>
              </form>
              {osmResults.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {osmResults.map((place) => (
                    <div
                      key={place.placeId}
                      className="glass-subsurface rounded-xl p-2 flex items-center justify-between gap-2 text-[11px]"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">
                          {place.name}
                        </p>
                        <p className="text-slate-600 dark:text-slate-300 font-mono-tabular">
                          {place.lat.toFixed(3)}, {place.lon.toFixed(3)} · {place.country}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePinOsmPlace(place)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-700 text-white font-semibold shrink-0 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Ghim</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {subTab === 'charts' && (
        <div className="space-y-3" data-testid="geography-charts-panel">
          <div className="liquid-glass-panel rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {datasets.length > 0 && (
                  <>
                    <select
                      value={activeDataset?.id || ''}
                      onChange={(e) => setSelectedDatasetId(e.target.value)}
                      className="px-3 py-1.5 rounded-xl glass-subsurface text-xs font-bold text-slate-900 dark:text-white max-w-xs"
                    >
                      {datasets.map((ds) => (
                        <option key={ds.id} value={ds.id}>
                          {ds.title} ({ds.unit})
                        </option>
                      ))}
                    </select>
                    {activeDataset && (
                      <button
                        type="button"
                        onClick={() =>
                          setDatasets((prev) => prev.filter((d) => d.id !== activeDataset.id))
                        }
                        className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                        title="Xóa bảng"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setDsModalOpen(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-cyan-700 text-white text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tạo bảng số liệu</span>
                </button>
              </div>

              {activeDataset && (
                <div className="flex items-center gap-1">
                  {(
                    [
                      { id: 'bar', label: 'Cột' },
                      { id: 'line', label: 'Đường' },
                      { id: 'pie', label: 'Tròn' },
                      { id: 'combo', label: 'Kết hợp' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setChartMode(m.id)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                        chartMode === m.id ? 'bg-cyan-700 text-white' : 'glass-subsurface text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {!activeDataset ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">
                Tạo bảng số liệu mới hoặc nhập từ Excel để vẽ biểu đồ.
              </p>
            ) : (
              <>
                <div className="h-64 w-full glass-subsurface rounded-xl p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    {chartMode === 'pie' ? (
                      <RechartsPieChart>
                        <Pie data={pieDataRows} dataKey="value" nameKey="name" outerRadius={85} label>
                          {pieDataRows.map((_, i) => (
                            <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </RechartsPieChart>
                    ) : chartMode === 'line' ? (
                      <LineChart data={chartDataRows}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        {activeDataset.rows.map((r, i) => (
                          <Line
                            key={r.label}
                            type="monotone"
                            dataKey={r.label}
                            stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
                            strokeWidth={2.5}
                          />
                        ))}
                      </LineChart>
                    ) : chartMode === 'combo' ? (
                      <ComposedChart data={chartDataRows}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        {activeDataset.rows.map((r, i) =>
                          i === 0 ? (
                            <Bar key={r.label} dataKey={r.label} fill={CHART_PALETTE[0]} radius={[4, 4, 0, 0]} />
                          ) : (
                            <Line
                              key={r.label}
                              type="monotone"
                              dataKey={r.label}
                              stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
                              strokeWidth={2.5}
                            />
                          )
                        )}
                      </ComposedChart>
                    ) : (
                      <BarChart data={chartDataRows}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        {activeDataset.rows.map((r, i) => (
                          <Bar
                            key={r.label}
                            dataKey={r.label}
                            fill={CHART_PALETTE[i % CHART_PALETTE.length]}
                            radius={[4, 4, 0, 0]}
                          />
                        ))}
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-900/10 dark:border-white/10 text-slate-500">
                        <th className="py-2 pr-3">Đối tượng ({activeDataset.unit})</th>
                        {activeDataset.columns.map((c) => (
                          <th key={c} className="py-2 px-2 font-mono-tabular">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeDataset.rows.map((r, rIdx) => (
                        <tr key={rIdx} className="border-b border-slate-900/5 dark:border-white/5">
                          <td className="py-2 pr-3 font-semibold text-slate-900 dark:text-white">{r.label}</td>
                          {r.values.map((v, cIdx) => (
                            <td key={cIdx} className="py-2 px-2 font-mono-tabular text-slate-700 dark:text-slate-200">
                              {v ?? '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Index Calculator */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="liquid-glass-panel rounded-2xl p-4 space-y-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Mật độ dân số</h4>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={calcPop}
                  onChange={(e) => setCalcPop(e.target.value)}
                  placeholder="Dân số"
                  className="px-2.5 py-1.5 rounded-lg glass-subsurface text-xs font-mono-tabular text-slate-900 dark:text-white"
                />
                <input
                  type="number"
                  value={calcArea}
                  onChange={(e) => setCalcArea(e.target.value)}
                  placeholder="Diện tích km²"
                  className="px-2.5 py-1.5 rounded-lg glass-subsurface text-xs font-mono-tabular text-slate-900 dark:text-white"
                />
              </div>
              <p className="text-sm font-bold text-cyan-700 dark:text-cyan-300 font-mono-tabular">
                {densityResult !== null ? `${densityResult} người/km²` : '—'}
              </p>
            </div>

            <div className="liquid-glass-panel rounded-2xl p-4 space-y-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Cơ cấu (%)</h4>
              <input
                type="text"
                value={calcStructInputs}
                onChange={(e) => setCalcStructInputs(e.target.value)}
                placeholder="VD: 12, 37, 51"
                className="w-full px-2.5 py-1.5 rounded-lg glass-subsurface text-xs font-mono-tabular text-slate-900 dark:text-white"
              />
              <p className="text-xs font-bold text-cyan-700 dark:text-cyan-300 font-mono-tabular">
                {structurePercentages.length > 0
                  ? structurePercentages.map((p) => `${p ?? 0}%`).join(' · ')
                  : '—'}
              </p>
            </div>

            <div className="liquid-glass-panel rounded-2xl p-4 space-y-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Tăng trưởng (100%)</h4>
              <input
                type="text"
                value={calcGrowthInputs}
                onChange={(e) => setCalcGrowthInputs(e.target.value)}
                placeholder="VD: 100, 125, 160"
                className="w-full px-2.5 py-1.5 rounded-lg glass-subsurface text-xs font-mono-tabular text-slate-900 dark:text-white"
              />
              <p className="text-xs font-bold text-cyan-700 dark:text-cyan-300 font-mono-tabular">
                {growthResult.length > 0
                  ? growthResult.map((g) => `${g.indexPercent ?? 0}%`).join(' → ')
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {subTab === 'world' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3" data-testid="geography-world-panel">
          <div className="lg:col-span-5 liquid-glass-panel rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-700 dark:text-cyan-300" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">REST Countries</h3>
            </div>
            <form onSubmit={handleSearchCountries} className="flex gap-1.5">
              <input
                type="text"
                value={countryQuery}
                onChange={(e) => setCountryQuery(e.target.value)}
                placeholder="Tên quốc gia (Vietnam, Japan…)"
                className="flex-1 min-w-0 px-3 py-1.5 rounded-xl glass-subsurface text-xs text-slate-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={countryLoading || !countryQuery.trim()}
                className="px-3 py-1.5 rounded-xl bg-cyan-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                {countryLoading ? '…' : 'Tra cứu'}
              </button>
            </form>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {countriesList.map((c) => (
                <div key={c.cca3} className="glass-subsurface rounded-xl p-3 flex items-start gap-3">
                  {c.flagPng && (
                    <img src={c.flagPng} alt={c.nameCommon} className="w-11 h-7 object-cover rounded shadow-sm shrink-0" />
                  )}
                  <div className="min-w-0 flex-1 text-xs space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-slate-900 dark:text-white truncate">{c.nameCommon}</p>
                      <span className="font-mono-tabular text-[10px] text-cyan-700 dark:text-cyan-300">{c.cca3}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">{c.capital} · {c.subregion}</p>
                    <p className="text-[11px] font-mono-tabular text-slate-700 dark:text-slate-200">
                      {c.population.toLocaleString('vi-VN')} dân · {c.densityPerKm2}/km²
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7 liquid-glass-panel rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">World Bank</h3>
            <form onSubmit={handleFetchWorldBank} className="flex flex-wrap gap-2">
              <input
                type="text"
                value={wbCountries}
                onChange={(e) => setWbCountries(e.target.value)}
                placeholder="Mã ISO3 (VNM,JPN,SGP)"
                className="w-40 px-2.5 py-1.5 rounded-xl glass-subsurface text-xs font-mono-tabular text-slate-900 dark:text-white"
              />
              <select
                value={wbIndicator}
                onChange={(e) => setWbIndicator(e.target.value)}
                className="flex-1 min-w-[180px] px-2.5 py-1.5 rounded-xl glass-subsurface text-xs text-slate-900 dark:text-white"
              >
                <option value="NY.GDP.PCAP.CD">GDP bình quân đầu người (USD)</option>
                <option value="SP.POP.TOTL">Tổng dân số</option>
                <option value="SP.URB.TOTL.IN.ZS">Tỷ lệ đô thị hóa (%)</option>
                <option value="AG.LND.FRST.ZS">Độ che phủ rừng (%)</option>
                <option value="IT.NET.USER.ZS">Người dùng Internet (%)</option>
              </select>
              <button
                type="submit"
                disabled={wbLoading || !wbCountries.trim()}
                className="px-3 py-1.5 rounded-xl bg-cyan-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                {wbLoading ? '…' : 'Vẽ'}
              </button>
            </form>
            {worldError && <p className="text-xs text-rose-600">{worldError}</p>}

            {wbComparison && wbChartRows.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                  {wbComparison.indicatorName} ({wbComparison.unit})
                </p>
                <div className="h-64 glass-subsurface rounded-xl p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={wbChartRows}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                      <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      {wbComparison.countries.map((c, idx) => (
                        <Line
                          key={c.countryCode}
                          type="monotone"
                          dataKey={c.countryCode}
                          name={c.countryName}
                          stroke={CHART_PALETTE[idx % CHART_PALETTE.length]}
                          strokeWidth={2.5}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'practice' && (
        <div className="space-y-3" data-testid="geography-practice-panel">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Bài tập Địa lý ({allQuestions.length})
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
              {allQuestions.length > 0 && (
                <button
                  type="button"
                  onClick={handleGradeGeoPractice}
                  className="px-4 py-1.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-semibold cursor-pointer"
                >
                  Chấm điểm
                </button>
              )}
            </div>
          </div>

          {allQuestions.length === 0 ? (
            <SubjectEmptyState
              testId="geo-practice-empty"
              title="Chưa có câu hỏi Địa lý nào."
              actions={[
                { label: '+ Thêm câu hỏi', onClick: () => setQuizModalOpen(true), primary: true },
                { label: 'Tạo đề bằng AI', onClick: () => setSubTab('ai-tutor') },
              ]}
            />
          ) : (
            <div className="space-y-2.5">
              {allQuestions.map((q, idx) => {
                const ans = geoAnswers[q.id];
                const graded = practiceSubmitted ? gradeGeoQuestion(q, ans) : null;
                const isCustom = customQuestions.some((c) => c.id === q.id);
                return (
                  <div key={q.id} className="liquid-glass-panel rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-cyan-700 dark:text-cyan-300">
                      <span>Câu {idx + 1} · {q.topic}</span>
                      <div className="flex items-center gap-2">
                        {graded && (
                          <span className={graded.isCorrect ? 'text-emerald-600' : 'text-rose-600'}>
                            {graded.isCorrect ? 'Đúng' : 'Sai'}
                          </span>
                        )}
                        {isCustom && (
                          <button
                            type="button"
                            onClick={() =>
                              setCustomQuestions((prev) => prev.filter((item) => item.id !== q.id))
                            }
                            className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">{q.prompt}</p>

                    {(q.type === 'mcq' || q.type === 'atlas' || q.type === 'data') && q.options && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {q.options.map((opt, oIdx) => {
                          const selected =
                            ans &&
                            (ans.type === 'mcq' || ans.type === 'atlas' || ans.type === 'data') &&
                            ans.selectedIndex === oIdx;
                          return (
                            <button
                              key={oIdx}
                              type="button"
                              onClick={() =>
                                !practiceSubmitted &&
                                setGeoAnswers((p) => ({
                                  ...p,
                                  [q.id]: {
                                    type: q.type as 'mcq' | 'atlas' | 'data',
                                    selectedIndex: oIdx,
                                  },
                                }))
                              }
                              className={`text-left px-3 py-2 rounded-xl text-xs cursor-pointer ${
                                practiceSubmitted
                                  ? q.correctIndex === oIdx
                                    ? 'bg-emerald-600 text-white'
                                    : selected
                                    ? 'bg-rose-600 text-white'
                                    : 'glass-subsurface opacity-60'
                                  : selected
                                  ? 'bg-cyan-700 text-white font-semibold'
                                  : 'glass-subsurface text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              {String.fromCharCode(65 + oIdx)}. {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {q.type === 'tf' && (
                      <div className="flex gap-2">
                        {[true, false].map((b) => {
                          const selected = ans && ans.type === 'tf' && ans.selectedBool === b;
                          return (
                            <button
                              key={String(b)}
                              type="button"
                              onClick={() =>
                                !practiceSubmitted &&
                                setGeoAnswers((p) => ({ ...p, [q.id]: { type: 'tf', selectedBool: b } }))
                              }
                              className={`px-4 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                                practiceSubmitted
                                  ? q.correctBool === b
                                    ? 'bg-emerald-600 text-white'
                                    : selected
                                    ? 'bg-rose-600 text-white'
                                    : 'glass-subsurface opacity-60'
                                  : selected
                                  ? 'bg-cyan-700 text-white'
                                  : 'glass-subsurface text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              {b ? 'Đúng' : 'Sai'}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {q.type === 'short' && (
                      <input
                        type="text"
                        value={ans && ans.type === 'short' ? ans.textAnswer : ''}
                        onChange={(e) =>
                          setGeoAnswers((p) => ({
                            ...p,
                            [q.id]: { type: 'short', textAnswer: e.target.value },
                          }))
                        }
                        placeholder="Nhập đáp án ngắn…"
                        className="w-full max-w-md px-3 py-1.5 rounded-xl glass-subsurface text-xs text-slate-900 dark:text-white"
                      />
                    )}

                    {practiceSubmitted && q.explanation && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 pt-1">{q.explanation}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Thêm kiến thức Địa lý */}
      <Modal isOpen={lessonModalOpen} onClose={() => setLessonModalOpen(false)} title="Thêm kiến thức Địa lý" maxWidth="md">
        <form onSubmit={handleCreateLesson} className="space-y-3 text-xs">
          <input type="text" required value={lTitle} onChange={(e) => setLTitle(e.target.value)} placeholder="Tiêu đề bài / chuyên đề" className="w-full rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white" />
          <div className="grid grid-cols-2 gap-2">
            <select value={lDomain} onChange={(e) => setLDomain(e.target.value as GeoDomain)} className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white">
              <option value="Tự nhiên">Tự nhiên</option>
              <option value="Dân cư">Dân cư</option>
              <option value="Kinh tế">Kinh tế</option>
              <option value="Môi trường">Môi trường</option>
              <option value="Xã hội">Xã hội</option>
            </select>
            <select value={lGrade} onChange={(e) => setLGrade(e.target.value)} className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white">
              <option value="Lớp 10">Lớp 10</option>
              <option value="Lớp 11">Lớp 11</option>
              <option value="Lớp 12">Lớp 12</option>
            </select>
          </div>
          <input type="text" value={lSummary} onChange={(e) => setLSummary(e.target.value)} placeholder="Tóm tắt ngắn" className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          <textarea rows={3} value={lKeyPoints} onChange={(e) => setLKeyPoints(e.target.value)} placeholder="Ý chính trọng tâm…" className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setLessonModalOpen(false)} className="px-4 py-2 rounded-xl glass-subsurface font-semibold cursor-pointer">Đóng</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-cyan-700 text-white font-semibold cursor-pointer">Lưu</button>
          </div>
        </form>
      </Modal>

      {/* Modal: Ghim tọa độ Atlat thủ công */}
      <Modal isOpen={pinModalOpen} onClose={() => setPinModalOpen(false)} title="Ghim địa danh lên bản đồ" maxWidth="md">
        <form onSubmit={handleCreateManualPin} className="space-y-3 text-xs">
          <input type="text" required value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Tên địa danh (vd: Hà Nội)" className="w-full rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white" />
          <div className="grid grid-cols-3 gap-2">
            <input type="text" required value={pLat} onChange={(e) => setPLat(e.target.value)} placeholder="Vĩ độ (Lat)" className="rounded-xl glass-subsurface px-2.5 py-2 font-mono-tabular text-slate-900 dark:text-white" />
            <input type="text" required value={pLon} onChange={(e) => setPLon(e.target.value)} placeholder="Kinh độ (Lon)" className="rounded-xl glass-subsurface px-2.5 py-2 font-mono-tabular text-slate-900 dark:text-white" />
            <select value={pLayer} onChange={(e) => setPLayer(e.target.value as AtlasLayerId)} className="rounded-xl glass-subsurface px-2.5 py-2 text-slate-900 dark:text-white">
              {ATLAS_LAYERS.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </div>
          <input type="text" value={pSummary} onChange={(e) => setPSummary(e.target.value)} placeholder="Mô tả ngắn" className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPinModalOpen(false)} className="px-4 py-2 rounded-xl glass-subsurface font-semibold cursor-pointer">Đóng</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-cyan-700 text-white font-semibold cursor-pointer">Ghim</button>
          </div>
        </form>
      </Modal>

      {/* Modal: Tạo bảng số liệu */}
      <Modal isOpen={dsModalOpen} onClose={() => setDsModalOpen(false)} title="Tạo bảng số liệu Địa lý" maxWidth="md">
        <form onSubmit={handleCreateDataset} className="space-y-3 text-xs">
          <div className="grid grid-cols-3 gap-2">
            <input type="text" required value={dTitle} onChange={(e) => setDTitle(e.target.value)} placeholder="Tên bảng số liệu" className="col-span-2 rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white" />
            <input type="text" required value={dUnit} onChange={(e) => setDUnit(e.target.value)} placeholder="Đơn vị" className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          </div>
          <input type="text" required value={dCols} onChange={(e) => setDCols(e.target.value)} placeholder="Các cột (cách bởi dấu phẩy, vd: 2020, 2022, 2024)" className="w-full rounded-xl glass-subsurface px-3 py-2 font-mono-tabular text-slate-900 dark:text-white" />
          <textarea rows={4} required value={dRowsText} onChange={(e) => setDRowsText(e.target.value)} placeholder={'Mỗi dòng 1 đối tượng dạng:\nNông nghiệp: 14, 12.5, 11.9\nCông nghiệp: 34, 36.2, 37.1'} className="w-full rounded-xl glass-subsurface px-3 py-2 font-mono-tabular text-slate-900 dark:text-white" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDsModalOpen(false)} className="px-4 py-2 rounded-xl glass-subsurface font-semibold cursor-pointer">Đóng</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-cyan-700 text-white font-semibold cursor-pointer">Vẽ biểu đồ</button>
          </div>
        </form>
      </Modal>

      {/* Modal: Thêm câu hỏi Địa lý */}
      <Modal isOpen={quizModalOpen} onClose={() => setQuizModalOpen(false)} title="Thêm câu hỏi Địa lý" maxWidth="md">
        <form onSubmit={handleCreateQuestion} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <select value={qType} onChange={(e) => setQType(e.target.value as 'mcq' | 'tf' | 'short')} className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white">
              <option value="mcq">Trắc nghiệm</option>
              <option value="tf">Đúng / Sai</option>
              <option value="short">Điền ngắn</option>
            </select>
            <input type="text" value={qTopic} onChange={(e) => setQTopic(e.target.value)} placeholder="Chuyên đề" className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          </div>
          <textarea rows={2} required value={qPrompt} onChange={(e) => setQPrompt(e.target.value)} placeholder="Nội dung câu hỏi…" className="w-full rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white" />
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
          {qType === 'short' && (
            <input type="text" required value={qShortAns} onChange={(e) => setQShortAns(e.target.value)} placeholder="Đáp án ngắn chuẩn" className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          )}
          <input type="text" value={qExplain} onChange={(e) => setQExplain(e.target.value)} placeholder="Giải thích (tùy chọn)" className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setQuizModalOpen(false)} className="px-4 py-2 rounded-xl glass-subsurface font-semibold cursor-pointer">Đóng</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-cyan-700 text-white font-semibold cursor-pointer">Lưu</button>
          </div>
        </form>
      </Modal>
    </SubjectWorkspaceShell>
  );
};
