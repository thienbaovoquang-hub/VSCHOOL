import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateGrowthIndices,
  calculatePerCapitaAverage,
  calculatePopulationDensity,
  calculateStructurePercentages,
  generateQuestionsFromGeoData,
  gradeGeoQuestion,
  normalizeGeoDataMatrixRows,
  normalizeGeoExcelRow,
  parseCoordinatePair,
  validateAndNormalizeGeoJson,
  type AtlasFeature,
  type GeoDataset,
  type GeoLesson,
} from './geographyRules.ts';

test('geographic calculation helpers compute structure, density, growth, and per-capita average accurately', () => {
  assert.deepEqual(calculateStructurePercentages([25, 50, 25]), [25, 50, 25]);
  assert.deepEqual(calculateStructurePercentages([0, 0]), [null, null]);

  assert.equal(calculatePopulationDensity(100_000_000, 331_212), 301.92);
  assert.equal(calculatePopulationDensity(1000, 0), null);

  const growth = calculateGrowthIndices([
    { label: '2020', value: 100 },
    { label: '2021', value: 110 },
    { label: '2022', value: 132 },
  ]);
  assert.equal(growth[0].indexPercent, 100);
  assert.equal(growth[0].yoyPercent, null);
  assert.equal(growth[1].indexPercent, 110);
  assert.equal(growth[1].yoyPercent, 10);
  assert.equal(growth[2].indexPercent, 132);
  assert.equal(growth[2].yoyPercent, 20);

  assert.equal(calculatePerCapitaAverage(400_000, 100), 4000);
  assert.equal(calculatePerCapitaAverage(400_000, 0), null);
});

test('parseCoordinatePair supports decimal and directional coordinates with bounds validation', () => {
  assert.deepEqual(parseCoordinatePair('21.0285, 105.8542'), { lat: 21.0285, lon: 105.8542 });
  assert.deepEqual(parseCoordinatePair('33.87°S, 151.21°E'), { lat: -33.87, lon: 151.21 });
  assert.equal(parseCoordinatePair('95.0, 200.0'), null);
  assert.equal(parseCoordinatePair('Hà Nội'), null);
});

test('validateAndNormalizeGeoJson parses Point and Polygon FeatureCollections cleanly', () => {
  const features = validateAndNormalizeGeoJson({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'Điểm A', layer: 'Khí hậu', year: '2025' },
        geometry: { type: 'Point', coordinates: [105.85, 21.03] },
      },
      {
        type: 'Feature',
        properties: { name: 'Vùng B', layer: 'Tài nguyên' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[104, 20], [105, 20], [105, 21], [104, 20]]],
        },
      },
    ],
  });

  assert.equal(features.length, 2);
  assert.equal(features[0].kind, 'point');
  assert.equal(features[0].layer, 'climate');
  assert.equal(features[1].kind, 'polygon');
  assert.equal(features[1].layer, 'resources');
});

test('gradeGeoQuestion grades mcq, tf, short, atlas, and data questions', () => {
  assert.equal(
    gradeGeoQuestion(
      { id: '1', type: 'mcq', grade: '12', chapter: 'C1', topic: 'T1', prompt: 'Q', options: ['A', 'B'], correctIndex: 1, methodGuide: '', explanation: '' },
      { type: 'mcq', selectedIndex: 1 }
    ).isCorrect,
    true
  );
  assert.equal(
    gradeGeoQuestion(
      { id: '2', type: 'tf', grade: '12', chapter: 'C1', topic: 'T1', prompt: 'Q', correctBool: false, methodGuide: '', explanation: '' },
      { type: 'tf', selectedBool: false }
    ).isCorrect,
    true
  );
  assert.equal(
    gradeGeoQuestion(
      { id: '3', type: 'short', grade: '12', chapter: 'C1', topic: 'T1', prompt: 'Q', correctAnswerText: 'Gió mùa Đông Bắc', acceptedKeywords: ['đông bắc'], methodGuide: '', explanation: '' },
      { type: 'short', textAnswer: 'Do ảnh hưởng gió mùa Đông Bắc' }
    ).isCorrect,
    true
  );
});

test('generateQuestionsFromGeoData returns empty when no user data exists and links datasets/atlas/lessons when present', () => {
  assert.deepEqual(generateQuestionsFromGeoData([], [], []), []);

  const lessons: GeoLesson[] = [
    {
      id: 'L1', title: 'Địa hình Việt Nam', grade: '12', chapter: 'Tự nhiên', topic: 'Địa hình',
      domain: 'Tự nhiên', summary: 'Đồi núi chiếm 3/4 diện tích', keyPoints: '', examples: '',
      dataNotes: '', source: 'SGK', yearRef: '2024', media: [], createdAt: '', updatedAt: '',
    },
    {
      id: 'L2', title: 'Dân số Việt Nam', grade: '12', chapter: 'Dân cư', topic: 'Dân số',
      domain: 'Dân cư', summary: 'Quy mô dân số lớn', keyPoints: '', examples: '',
      dataNotes: '', source: 'Niên giám', yearRef: '2024', media: [], createdAt: '', updatedAt: '',
    },
  ];
  const atlas: AtlasFeature[] = [
    { id: 'A1', name: 'Sông Hồng', scope: 'vietnam', layer: 'hydrology', kind: 'point', lat: 21, lon: 105.8, region: 'ĐBSH', country: 'Việt Nam', summary: '', metricsText: '', source: '', yearRef: '' },
    { id: 'A2', name: 'Đỉnh Phan Xi Păng', scope: 'vietnam', layer: 'topography', kind: 'point', lat: 22.3, lon: 103.7, region: 'Tây Bắc', country: 'Việt Nam', summary: '', metricsText: '', source: '', yearRef: '' },
  ];
  const datasets: GeoDataset[] = [
    {
      id: 'D1', title: 'Dân số các vùng', category: 'Dân số', unit: 'triệu người', chartType: 'bar',
      columns: ['2022', '2023'],
      rows: [
        { label: 'Đồng bằng sông Hồng', values: [23.4, 23.7] },
        { label: 'Tây Nguyên', values: [6.0, 6.1] },
      ],
      analysis: '', source: 'Tổng cục Thống kê', yearRange: '2022-2023', createdAt: '', updatedAt: '',
    },
  ];

  const qs = generateQuestionsFromGeoData(lessons, atlas, datasets);
  assert.ok(qs.some((q) => q.type === 'data' && q.linkedDatasetId === 'D1'));
  assert.ok(qs.some((q) => q.type === 'atlas' && q.linkedAtlasId === 'A1'));
  assert.ok(qs.some((q) => q.type === 'mcq'));
});

test('normalizeGeoExcelRow and normalizeGeoDataMatrixRows handle Vietnamese Excel columns cleanly', () => {
  const lesson = normalizeGeoExcelRow('knowledge', {
    'Tiêu đề': 'Khí hậu nhiệt đới ẩm gió mùa',
    'Lớp': '12',
    'Mảng': 'Tự nhiên',
    'Kiến thức trọng tâm': 'Nhiệt độ trung bình năm trên 20°C',
    'Nguồn': 'SGK Địa lý 12',
  }, 0);
  assert.ok(lesson);
  assert.equal(lesson.domain, 'Tự nhiên');

  const pin = normalizeGeoExcelRow('atlas', {
    'Địa danh': 'Cảng Hải Phòng',
    'Vĩ độ': '20.86',
    'Kinh độ': '106.68',
    'Lớp bản đồ': 'Giao thông',
  }, 1);
  assert.ok(pin);
  assert.equal(pin.layer, 'transport');
  assert.equal(pin.lat, 20.86);

  const ds = normalizeGeoDataMatrixRows([
    { 'Đối tượng': 'Nông nghiệp', 'Đơn vị': '%', '2020': '14.8', '2023': '11.9', 'Nguồn': 'GSO' },
    { 'Đối tượng': 'Công nghiệp - Xây dựng', 'Đơn vị': '%', '2020': '33.7', '2023': '37.1', 'Nguồn': 'GSO' },
  ]);
  assert.ok(ds);
  assert.deepEqual(ds.columns, ['2020', '2023']);
  assert.equal(ds.rows.length, 2);
  assert.equal(ds.rows[0].values[1], 11.9);
  assert.equal(ds.unit, '%');
  assert.equal(ds.source, 'GSO');
});
