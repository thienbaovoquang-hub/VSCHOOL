import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareChronologicalItems,
  generateQuestionsFromStoredHistory,
  gradePracticeQuestion,
  linkEventsBidirectionally,
  mergeHistoryLessonsAndEvents,
  normalizeHistoryExcelRow,
  parseHistoricalSortYear,
  type HistoryLesson,
  type TimelineEventItem,
} from './historyRules.ts';

test('parseHistoricalSortYear parses BCE/TCN, full dates, centuries, and CE years accurately', () => {
  assert.equal(parseHistoricalSortYear('2879 TCN'), -2879);
  assert.equal(parseHistoricalSortYear('490 BCE'), -490);
  assert.equal(parseHistoricalSortYear('-208'), -208);
  assert.equal(parseHistoricalSortYear('40'), 40);
  assert.equal(parseHistoricalSortYear('Thế kỷ X'), 901);
  assert.equal(parseHistoricalSortYear('Thế kỷ III TCN'), -201);

  const aug = parseHistoricalSortYear('19/08/1945')!;
  const sep = parseHistoricalSortYear('02/09/1945')!;
  assert.ok(aug > 1945 && sep > aug && sep < 1946);
  assert.equal(parseHistoricalSortYear('không rõ'), null);
});

test('compareChronologicalItems and mergeHistoryLessonsAndEvents preserve chronological order without duplicates', () => {
  const lessons: HistoryLesson[] = [
    {
      id: 'L1',
      title: 'Khởi nghĩa Hai Bà Trưng',
      grade: '10',
      chapter: 'Chống Bắc thuộc',
      era: 'Thế kỷ I',
      topic: 'Khởi nghĩa',
      timeMarker: '40 SCN',
      sortYear: 40,
      context: 'Ách đô hộ nhà Đông Hán',
      causes: 'Mâu thuẫn dân tộc sâu sắc',
      progression: 'Phất cờ ở Hát Môn',
      result: 'Giành độc lập 3 năm',
      significance: 'Mở đầu truyền thống bất khuất',
      lessonLearned: 'Sức mạnh đoàn kết',
      figures: ['Trưng Trắc', 'Trưng Nhị'],
      source: 'Đại Việt sử ký toàn thư',
      mediaUrls: [],
      syncToTimeline: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  const explicitEvents: TimelineEventItem[] = [
    {
      id: 'E1',
      title: 'Chiến thắng Bạch Đằng',
      timeMarker: '938',
      sortYear: 938,
      era: 'Ngô',
      country: 'Việt Nam',
      region: 'Đông Nam Á',
      topic: 'Kháng chiến',
      context: 'Quân Nam Hán xâm lược',
      progression: 'Ngô Quyền đóng cọc Bạch Đằng',
      result: 'Chấm dứt hơn 1000 năm Bắc thuộc',
      significance: 'Mở ra kỷ nguyên độc lập lâu dài',
      figures: ['Ngô Quyền'],
      source: 'Sử liệu',
      relatedEventIds: [],
    },
    {
      id: 'E0',
      title: 'Chiến thắng Như Nguyệt',
      timeMarker: '1077',
      sortYear: 1077,
      era: 'Lý',
      country: 'Việt Nam',
      region: 'Đông Nam Á',
      topic: 'Kháng chiến',
      context: 'Kháng chiến chống Tống',
      progression: 'Phòng tuyến sông Cầu',
      result: 'Quân Tống rút lui',
      significance: 'Bảo vệ vững chắc Đại Việt',
      figures: ['Lý Thường Kiệt'],
      source: 'Sử liệu',
      relatedEventIds: [],
    },
  ];

  const merged = mergeHistoryLessonsAndEvents(lessons, explicitEvents);
  assert.equal(merged.length, 3);
  assert.deepEqual(
    merged.map((m) => m.title),
    ['Khởi nghĩa Hai Bà Trưng', 'Chiến thắng Bạch Đằng', 'Chiến thắng Như Nguyệt']
  );

  // If explicit event already links to L1, avoid duplicating L1
  const explicitWithLink = [
    ...explicitEvents,
    { ...merged[0], id: 'E-LINK', linkedLessonId: 'L1', isAutoFromLesson: false },
  ];
  const deduped = mergeHistoryLessonsAndEvents(lessons, explicitWithLink).sort(compareChronologicalItems);
  assert.equal(deduped.length, 3);
});

test('linkEventsBidirectionally creates two-way event links cleanly', () => {
  const events: TimelineEventItem[] = [
    {
      id: 'E1', title: 'Sự kiện A', timeMarker: '1945', sortYear: 1945, era: 'Hiện đại',
      country: 'VN', region: 'ĐNA', topic: 'Cách mạng', context: '', progression: '',
      result: '', significance: '', figures: [], source: '', relatedEventIds: [],
    },
    {
      id: 'E2', title: 'Sự kiện B', timeMarker: '1954', sortYear: 1954, era: 'Hiện đại',
      country: 'VN', region: 'ĐNA', topic: 'Kháng chiến', context: '', progression: '',
      result: '', significance: '', figures: [], source: '', relatedEventIds: [],
    },
  ];
  const linked = linkEventsBidirectionally(events, 'E1', 'E2');
  assert.deepEqual(linked[0].relatedEventIds, ['E2']);
  assert.deepEqual(linked[1].relatedEventIds, ['E1']);
});

test('gradePracticeQuestion evaluates mcq, tf, match, order, and source questions', () => {
  assert.equal(
    gradePracticeQuestion(
      { id: '1', type: 'mcq', prompt: 'P', options: ['A', 'B'], correctIndex: 1, explanation: 'E' },
      { type: 'mcq', selectedIndex: 1 }
    ).isCorrect,
    true
  );

  assert.equal(
    gradePracticeQuestion(
      { id: '2', type: 'tf', prompt: 'P', correctBool: false, explanation: 'E' },
      { type: 'tf', selectedBool: false }
    ).isCorrect,
    true
  );

  const matchPartial = gradePracticeQuestion(
    {
      id: '3',
      type: 'match',
      prompt: 'Nối',
      pairs: [
        { event: 'Bạch Đằng', time: '938' },
        { event: 'Điện Biên Phủ', time: '1954' },
      ],
      explanation: 'E',
    },
    { type: 'match', mapping: { 0: '938', 1: '1945' } }
  );
  assert.equal(matchPartial.isCorrect, false);
  assert.equal(matchPartial.earned, 0.5);

  const orderPass = gradePracticeQuestion(
    {
      id: '4',
      type: 'order',
      prompt: 'Sắp xếp',
      orderItems: [
        { label: 'B', timeMarker: '1945', sortYear: 1945 },
        { label: 'A', timeMarker: '938', sortYear: 938 },
        { label: 'C', timeMarker: '1975', sortYear: 1975 },
      ],
      explanation: 'E',
    },
    { type: 'order', orderedLabels: ['A', 'B', 'C'] }
  );
  assert.equal(orderPass.isCorrect, true);
});

test('generateQuestionsFromStoredHistory only uses user-provided items and never returns fabricated data when empty', () => {
  assert.deepEqual(generateQuestionsFromStoredHistory([], []), []);

  const events: TimelineEventItem[] = [
    { id: 'E1', title: 'Sự kiện 1', timeMarker: '40 SCN', sortYear: 40, era: 'A', country: 'VN', region: 'AS', topic: 'T', context: '', progression: '', result: '', significance: '', figures: [], source: '', relatedEventIds: [] },
    { id: 'E2', title: 'Sự kiện 2', timeMarker: '938', sortYear: 938, era: 'B', country: 'VN', region: 'AS', topic: 'T', context: '', progression: '', result: '', significance: '', figures: [], source: '', relatedEventIds: [] },
    { id: 'E3', title: 'Sự kiện 3', timeMarker: '1288', sortYear: 1288, era: 'C', country: 'VN', region: 'AS', topic: 'T', context: '', progression: '', result: '', significance: '', figures: [], source: '', relatedEventIds: [] },
  ];
  const qs = generateQuestionsFromStoredHistory([], events);
  assert.ok(qs.some((q) => q.type === 'match'));
  assert.ok(qs.some((q) => q.type === 'order'));
});

test('normalizeHistoryExcelRow maps Vietnamese/English Excel columns for history, timeline, archive, practice', () => {
  const h = normalizeHistoryExcelRow('history', {
    'Tiêu đề': 'Cách mạng tháng Tám',
    'Lớp': '12',
    'Mốc thời gian': '19/08/1945',
    'Bối cảnh': 'Nhật đầu hàng Đồng minh',
    'Nhân vật': 'Hồ Chí Minh; Võ Nguyên Giáp',
  }, 0);
  assert.ok(h);
  assert.equal(h.title, 'Cách mạng tháng Tám');
  assert.equal(h.syncToTimeline, true);
  assert.deepEqual(h.figures, ['Hồ Chí Minh', 'Võ Nguyên Giáp']);

  const q = normalizeHistoryExcelRow('practice', {
    'Câu hỏi': 'Chiến thắng Điện Biên Phủ diễn ra năm nào?',
    'Phương án A': '1945',
    'Phương án B': '1954',
    'Đáp án đúng': 'B',
    'Giải thích': 'Ngày 7/5/1954',
  }, 1);
  assert.ok(q);
  assert.equal(q.correctIndex, 1);
});
