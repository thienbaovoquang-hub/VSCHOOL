export interface HistoryLesson {
  id: string;
  title: string;
  grade: string;
  chapter: string;
  era: string;
  topic: string;
  timeMarker: string;
  sortYear: number | null;
  context: string;
  causes: string;
  progression: string;
  result: string;
  significance: string;
  lessonLearned: string;
  figures: string[];
  source: string;
  mediaUrls: Array<{ name: string; type: 'image' | 'doc'; url: string; content?: string }>;
  syncToTimeline: boolean;
  bookmarked?: boolean;
  completed?: boolean;
  highlights?: Array<{ id: string; quote: string; createdAt: string }>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEventItem {
  id: string;
  title: string;
  timeMarker: string;
  sortYear: number | null;
  era: string;
  country: string;
  region: string;
  topic: string;
  context: string;
  progression: string;
  result: string;
  significance: string;
  figures: string[];
  source: string;
  linkedLessonId?: string;
  relatedEventIds: string[];
  isAutoFromLesson?: boolean;
  createdAt?: string;
}

export interface ArchiveItem {
  id: string;
  title: string;
  kind: 'image' | 'document' | 'artifact';
  era: string;
  topic: string;
  country: string;
  figure: string;
  yearLabel: string;
  source: string;
  provenance: string;
  summary: string;
  content: string;
  fileUrl?: string;
  linkedLessonId?: string;
  linkedEventId?: string;
  bookmarked?: boolean;
  createdAt: string;
}

export type PracticeQuestionType = 'mcq' | 'tf' | 'match' | 'order' | 'source';

export interface PracticeQuestion {
  id: string;
  type: PracticeQuestionType;
  prompt: string;
  grade?: string;
  chapter?: string;
  topic?: string;
  lessonId?: string;
  passage?: string;
  sourceCitation?: string;
  options?: string[];
  correctIndex?: number;
  correctBool?: boolean;
  pairs?: Array<{ event: string; time: string }>;
  orderItems?: Array<{ label: string; timeMarker: string; sortYear: number }>;
  explanation: string;
  createdAt?: string;
}

export type PracticeAnswerPayload =
  | { type: 'mcq' | 'source'; selectedIndex: number | null }
  | { type: 'tf'; selectedBool: boolean | null }
  | { type: 'match'; mapping: Record<number, string> }
  | { type: 'order'; orderedLabels: string[] };

const ROMAN_MAP: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
  XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16, XVII: 17, XVIII: 18,
  XIX: 19, XX: 20, XXI: 21,
};

/**
 * Parses Vietnamese / international historical date strings into a sortable numeric year.
 * Supports BCE/TCN ("2879 TCN", "-208", "490 BCE"), full dates ("02/09/1945", "1945-09-02"),
 * year ranges ("1945–1954"), and Roman centuries ("Thế kỷ X", "Thế kỷ XVIII TCN").
 */
export function parseHistoricalSortYear(raw?: string | number | null): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  const str = String(raw ?? '').trim();
  if (!str) return null;

  const isBce = /\b(tcn|bc|bce)\b/i.test(str) || /^\s*-\s*\d/.test(str);

  // ISO date YYYY-MM-DD
  const isoMatch = /^(\d{1,4})-(\d{1,2})-(\d{1,2})$/.exec(str);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    return y + (m - 1) / 12 + (d - 1) / 372;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = /(\d{1,2})[/-](\d{1,2})[/-](\d{1,4})/.exec(str);
  if (dmyMatch) {
    const d = Number(dmyMatch[1]);
    const m = Number(dmyMatch[2]);
    const y = Number(dmyMatch[3]);
    const base = isBce ? -y : y;
    return base + (m - 1) / 12 + (d - 1) / 372;
  }

  // MM/YYYY
  const myMatch = /(\d{1,2})[/-](\d{3,4})/.exec(str);
  if (myMatch) {
    const m = Number(myMatch[1]);
    const y = Number(myMatch[2]);
    const base = isBce ? -y : y;
    return base + (m - 1) / 12;
  }

  // Century ("Thế kỷ X", "TK 19")
  const centuryMatch = /(?:thế\s*kỷ|tk)\s+([ivxlcdm]+|\d{1,2})/i.exec(str);
  if (centuryMatch) {
    const tok = centuryMatch[1].toUpperCase();
    const num = ROMAN_MAP[tok] ?? Number(tok);
    if (Number.isFinite(num) && num >= 1 && num <= 50) {
      const startYear = (num - 1) * 100 + 1;
      return isBce ? -startYear : startYear;
    }
  }

  // Plain integer year / first year in range
  const yearMatch = /-?\d{1,5}/.exec(str);
  if (yearMatch) {
    const rawNum = Number(yearMatch[0]);
    if (!Number.isFinite(rawNum)) return null;
    if (rawNum < 0) return rawNum;
    return isBce ? -rawNum : rawNum;
  }

  return null;
}

export function compareChronologicalItems<T extends { sortYear?: number | null; timeMarker?: string; title?: string }>(
  a: T,
  b: T
): number {
  const ya = typeof a.sortYear === 'number' && Number.isFinite(a.sortYear)
    ? a.sortYear
    : parseHistoricalSortYear(a.timeMarker);
  const yb = typeof b.sortYear === 'number' && Number.isFinite(b.sortYear)
    ? b.sortYear
    : parseHistoricalSortYear(b.timeMarker);

  if (ya !== null && yb !== null) {
    if (ya !== yb) return ya - yb;
  } else if (ya !== null) {
    return -1;
  } else if (yb !== null) {
    return 1;
  }
  return String(a.title || '').localeCompare(String(b.title || ''), 'vi');
}

export function mergeHistoryLessonsAndEvents(
  lessons: HistoryLesson[],
  explicitEvents: TimelineEventItem[]
): TimelineEventItem[] {
  const linkedLessonIds = new Set(
    explicitEvents.map((ev) => ev.linkedLessonId).filter((id): id is string => Boolean(id))
  );

  const syncedFromLessons: TimelineEventItem[] = lessons
    .filter((lesson) => lesson.syncToTimeline && !linkedLessonIds.has(lesson.id))
    .map((lesson) => ({
      id: `tl-lesson-${lesson.id}`,
      title: lesson.title,
      timeMarker: lesson.timeMarker || 'Chưa rõ mốc thời gian',
      sortYear: lesson.sortYear ?? parseHistoricalSortYear(lesson.timeMarker),
      era: lesson.era || 'Chưa phân loại',
      country: 'Việt Nam / Chung',
      region: 'Kho kiến thức',
      topic: lesson.topic || lesson.chapter || 'Bài học',
      context: lesson.context,
      progression: lesson.progression,
      result: lesson.result,
      significance: lesson.significance,
      figures: lesson.figures || [],
      source: lesson.source,
      linkedLessonId: lesson.id,
      relatedEventIds: [],
      isAutoFromLesson: true,
      createdAt: lesson.createdAt,
    }));

  const normalizedExplicit = explicitEvents.map((ev) => ({
    ...ev,
    sortYear: ev.sortYear ?? parseHistoricalSortYear(ev.timeMarker),
    relatedEventIds: Array.isArray(ev.relatedEventIds) ? ev.relatedEventIds : [],
  }));

  return [...normalizedExplicit, ...syncedFromLessons].sort(compareChronologicalItems);
}

export function linkEventsBidirectionally(
  events: TimelineEventItem[],
  sourceId: string,
  targetId: string
): TimelineEventItem[] {
  if (!sourceId || !targetId || sourceId === targetId) return events;
  return events.map((ev) => {
    const existing = Array.isArray(ev.relatedEventIds) ? ev.relatedEventIds : [];
    if (ev.id === sourceId && !existing.includes(targetId)) {
      return { ...ev, relatedEventIds: [...existing, targetId] };
    }
    if (ev.id === targetId && !existing.includes(sourceId)) {
      return { ...ev, relatedEventIds: [...existing, sourceId] };
    }
    return ev;
  });
}

export function gradePracticeQuestion(
  question: PracticeQuestion,
  answer: PracticeAnswerPayload | undefined
): { isCorrect: boolean; earned: number; maxPoints: number } {
  const maxPoints = 1;
  if (!answer) return { isCorrect: false, earned: 0, maxPoints };

  if ((question.type === 'mcq' || question.type === 'source') && (answer.type === 'mcq' || answer.type === 'source')) {
    const ok = typeof question.correctIndex === 'number' && answer.selectedIndex === question.correctIndex;
    return { isCorrect: ok, earned: ok ? 1 : 0, maxPoints };
  }

  if (question.type === 'tf' && answer.type === 'tf') {
    const ok = typeof question.correctBool === 'boolean' && answer.selectedBool === question.correctBool;
    return { isCorrect: ok, earned: ok ? 1 : 0, maxPoints };
  }

  if (question.type === 'match' && answer.type === 'match') {
    const pairs = question.pairs || [];
    if (pairs.length === 0) return { isCorrect: false, earned: 0, maxPoints };
    let matched = 0;
    pairs.forEach((p, idx) => {
      if ((answer.mapping[idx] || '').trim() === p.time.trim()) {
        matched += 1;
      }
    });
    const ratio = matched / pairs.length;
    return { isCorrect: matched === pairs.length, earned: Number(ratio.toFixed(2)), maxPoints };
  }

  if (question.type === 'order' && answer.type === 'order') {
    const expected = [...(question.orderItems || [])]
      .sort((a, b) => a.sortYear - b.sortYear)
      .map((item) => item.label);
    if (expected.length === 0 || answer.orderedLabels.length !== expected.length) {
      return { isCorrect: false, earned: 0, maxPoints };
    }
    const ok = expected.every((label, idx) => answer.orderedLabels[idx] === label);
    return { isCorrect: ok, earned: ok ? 1 : 0, maxPoints };
  }

  return { isCorrect: false, earned: 0, maxPoints };
}

/**
 * Generates review questions strictly from user-stored lessons & timeline events.
 * Never invents external dates, figures, or facts.
 */
export function generateQuestionsFromStoredHistory(
  lessons: HistoryLesson[],
  events: TimelineEventItem[]
): PracticeQuestion[] {
  const generated: PracticeQuestion[] = [];
  const merged = mergeHistoryLessonsAndEvents(lessons, events);
  const datedEvents = merged.filter((ev) => ev.timeMarker && ev.sortYear !== null);

  // 1. Event-time matching question (when >= 2 dated events exist)
  if (datedEvents.length >= 2) {
    const subset = datedEvents.slice(0, 4);
    generated.push({
      id: `gen-match-${Date.now()}`,
      type: 'match',
      prompt: 'Nối các sự kiện lịch sử đã lưu với đúng mốc thời gian tương ứng:',
      topic: subset[0].topic || 'Tổng hợp',
      pairs: subset.map((ev) => ({ event: ev.title, time: ev.timeMarker })),
      explanation: subset.map((ev) => `${ev.title} (${ev.timeMarker})`).join(' · '),
    });
  }

  // 2. Chronological ordering question (when >= 3 distinct-year events exist)
  const distinctByYear: TimelineEventItem[] = [];
  const seenYears = new Set<number>();
  for (const ev of datedEvents) {
    if (ev.sortYear !== null && !seenYears.has(ev.sortYear)) {
      seenYears.add(ev.sortYear);
      distinctByYear.push(ev);
    }
  }
  if (distinctByYear.length >= 3) {
    const picked = distinctByYear.slice(0, 4);
    generated.push({
      id: `gen-order-${Date.now() + 1}`,
      type: 'order',
      prompt: 'Sắp xếp các sự kiện sau theo đúng trình tự thời gian từ sớm nhất đến muộn nhất:',
      topic: picked[0].topic || 'Dòng thời gian',
      orderItems: picked.map((ev) => ({
        label: ev.title,
        timeMarker: ev.timeMarker,
        sortYear: ev.sortYear as number,
      })),
      explanation: [...picked]
        .sort((a, b) => (a.sortYear as number) - (b.sortYear as number))
        .map((ev) => `${ev.timeMarker}: ${ev.title}`)
        .join(' → '),
    });
  }

  // 3. Per-lesson time/result MCQ when >= 2 lessons have distinct dates
  const datedLessons = lessons.filter((l) => l.timeMarker && l.title);
  if (datedLessons.length >= 2) {
    const timePool = Array.from(new Set(datedEvents.map((e) => e.timeMarker)));
    if (timePool.length >= 2) {
      datedLessons.slice(0, 3).forEach((lesson, idx) => {
        const distractors = timePool.filter((t) => t !== lesson.timeMarker).slice(0, 3);
        const options = [lesson.timeMarker, ...distractors];
        generated.push({
          id: `gen-mcq-${lesson.id}-${idx}`,
          type: 'mcq',
          prompt: `Bài học / sự kiện "${lesson.title}" gắn với mốc thời gian nào trong kho kiến thức của bạn?`,
          grade: lesson.grade,
          chapter: lesson.chapter,
          topic: lesson.topic,
          lessonId: lesson.id,
          options,
          correctIndex: 0,
          explanation: `${lesson.title} diễn ra vào ${lesson.timeMarker}. ${lesson.significance || lesson.result || ''}`.trim(),
        });
      });
    }
  }

  return generated;
}

function normalizeHeaderKey(raw: string): string {
  return raw
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

export type HistoryExcelModule = 'history' | 'timeline' | 'archive' | 'practice';

export function normalizeHistoryExcelRow(
  moduleKey: HistoryExcelModule,
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

  if (moduleKey === 'history') {
    const title = pickField(normMap, ['tieu_de', 'ten_bai', 'bai_hoc', 'title', 'name']);
    if (!title) return null;
    const timeMarker = pickField(normMap, ['moc_thoi_gian', 'thoi_gian', 'nam', 'time_marker', 'year']);
    const figuresRaw = pickField(normMap, ['nhan_vat', 'figures']);
    const syncRaw = pickField(normMap, ['dong_bo_timeline', 'sync_to_timeline', 'timeline']);
    return {
      id: `his-${Date.now()}-${rowIndex}`,
      title,
      grade: pickField(normMap, ['lop', 'khoi_lop', 'grade']) || 'Khác',
      chapter: pickField(normMap, ['chuong', 'chapter']) || 'Chuyên đề',
      era: pickField(normMap, ['thoi_ky', 'giai_doan', 'era']) || 'Chưa phân loại',
      topic: pickField(normMap, ['chu_de', 'topic']) || 'Lịch sử',
      timeMarker,
      sortYear: parseHistoricalSortYear(timeMarker),
      context: pickField(normMap, ['boi_canh', 'hoan_canh', 'context']),
      causes: pickField(normMap, ['nguyen_nhan', 'causes']),
      progression: pickField(normMap, ['dien_bien', 'progression']),
      result: pickField(normMap, ['ket_qua', 'result']),
      significance: pickField(normMap, ['y_nghia', 'significance']),
      lessonLearned: pickField(normMap, ['bai_hoc_lich_su', 'bai_hoc_kinh_nghiem', 'lesson_learned']),
      figures: figuresRaw ? figuresRaw.split(/[;,]/).map((s) => s.trim()).filter(Boolean) : [],
      source: pickField(normMap, ['nguon', 'tai_lieu', 'source']),
      mediaUrls: [],
      className: pickField(normMap, ['lop_ap_dung', 'class_name', 'classname']) || undefined,
      syncToTimeline: syncRaw ? !/^(khong|no|false|0)$/i.test(syncRaw) : Boolean(timeMarker),
    };
  }

  if (moduleKey === 'timeline') {
    const title = pickField(normMap, ['ten_su_kien', 'su_kien', 'tieu_de', 'title', 'event']);
    if (!title) return null;
    const timeMarker = pickField(normMap, ['moc_thoi_gian', 'thoi_gian', 'nam', 'time_marker', 'year']);
    const figuresRaw = pickField(normMap, ['nhan_vat', 'figures']);
    return {
      id: `evt-${Date.now()}-${rowIndex}`,
      title,
      timeMarker,
      sortYear: parseHistoricalSortYear(timeMarker),
      era: pickField(normMap, ['thoi_ky', 'giai_doan', 'era']) || 'Chưa phân loại',
      country: pickField(normMap, ['quoc_gia', 'nuoc', 'country']) || 'Việt Nam',
      region: pickField(normMap, ['khu_vuc', 'region']) || 'Châu Á',
      topic: pickField(normMap, ['chu_de', 'topic']) || 'Sự kiện lịch sử',
      context: pickField(normMap, ['boi_canh', 'context']),
      progression: pickField(normMap, ['dien_bien', 'progression']),
      result: pickField(normMap, ['ket_qua', 'result']),
      significance: pickField(normMap, ['y_nghia', 'significance']),
      figures: figuresRaw ? figuresRaw.split(/[;,]/).map((s) => s.trim()).filter(Boolean) : [],
      source: pickField(normMap, ['nguon', 'source']),
      relatedEventIds: [],
    };
  }

  if (moduleKey === 'archive') {
    const title = pickField(normMap, ['ten_tu_lieu', 'tieu_de', 'title', 'name']);
    if (!title) return null;
    const rawKind = pickField(normMap, ['loai', 'phan_loai', 'kind', 'type']).toLowerCase();
    const kind: ArchiveItem['kind'] =
      rawKind.includes('anh') || rawKind.includes('image')
        ? 'image'
        : rawKind.includes('hien') || rawKind.includes('artifact')
          ? 'artifact'
          : 'document';
    return {
      id: `arc-${Date.now()}-${rowIndex}`,
      title,
      kind,
      era: pickField(normMap, ['thoi_ky', 'era']) || 'Chưa phân loại',
      topic: pickField(normMap, ['chu_de', 'topic']) || 'Tư liệu',
      country: pickField(normMap, ['quoc_gia', 'country']) || 'Việt Nam',
      figure: pickField(normMap, ['nhan_vat', 'figure']),
      yearLabel: pickField(normMap, ['nien_dai', 'moc_thoi_gian', 'year']),
      source: pickField(normMap, ['nguon', 'source']) || 'Chưa rõ nguồn',
      provenance: pickField(normMap, ['xuat_xu', 'noi_luu_tru', 'provenance']),
      summary: pickField(normMap, ['tom_tat', 'mo_ta', 'summary']),
      content: pickField(normMap, ['noi_dung', 'trich_dan', 'content']),
      fileUrl: pickField(normMap, ['duong_dan_anh', 'link', 'url', 'file_url']),
    };
  }

  // practice
  const prompt = pickField(normMap, ['cau_hoi', 'de_bai', 'prompt', 'question']);
  if (!prompt) return null;
  const rawType = pickField(normMap, ['loai', 'dang_cau_hoi', 'type']).toLowerCase();
  const type: PracticeQuestionType =
    rawType === 'tf' || rawType.includes('dung')
      ? 'tf'
      : rawType === 'source' || rawType.includes('tu_lieu')
        ? 'source'
        : 'mcq';

  if (type === 'tf') {
    const ans = pickField(normMap, ['dap_an', 'answer', 'correct']).toLowerCase();
    const correctBool = ans === 'dung' || ans === 'true' || ans === 'd' || ans === '1';
    return {
      id: `pq-${Date.now()}-${rowIndex}`,
      type: 'tf',
      prompt,
      topic: pickField(normMap, ['chu_de', 'topic']) || 'Luyện tập',
      chapter: pickField(normMap, ['chuong', 'chapter']),
      grade: pickField(normMap, ['lop', 'grade']),
      correctBool,
      explanation: pickField(normMap, ['giai_thich', 'explanation']),
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
    id: `pq-${Date.now()}-${rowIndex}`,
    type,
    prompt,
    topic: pickField(normMap, ['chu_de', 'topic']) || 'Luyện tập',
    chapter: pickField(normMap, ['chuong', 'chapter']),
    grade: pickField(normMap, ['lop', 'grade']),
    passage: pickField(normMap, ['tu_lieu', 'doan_trich', 'passage']),
    sourceCitation: pickField(normMap, ['nguon', 'source']),
    options: options.length >= 2 ? options : ['Đáp án A', 'Đáp án B'],
    correctIndex: correctIndex < options.length ? correctIndex : 0,
    className: pickField(normMap, ['lop_ap_dung', 'class_name', 'classname']) || undefined,
    explanation: pickField(normMap, ['giai_thich', 'explanation']),
  };
}
