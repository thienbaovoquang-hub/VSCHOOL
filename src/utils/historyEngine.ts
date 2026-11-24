import type {
  ArchiveCategory,
  ArchiveItem,
  HistoryEvent,
  HistoryGradeLevel,
  HistoryImportTarget,
  HistoryLesson,
  HistoryPeriodId,
  HistoryQuestion,
  HistoryQuestionType,
  HistoryRegionId,
  HistoryStoreState,
  ParsedImportPreviewRow,
  PracticeAnswerValue,
  PracticeAttempt,
  PracticeQuestionResult,
} from '../types/history';

export const HISTORY_STORAGE_KEY = 'schoolhub_history_museum_v1';

export const PERIOD_LABELS: Record<HistoryPeriodId, string> = {
  ancient: 'Cổ đại',
  medieval: 'Trung đại',
  early_modern: 'Cận đại',
  modern: 'Hiện đại (1917–1945)',
  contemporary: 'Đương đại (Sau 1945)',
};

export const REGION_LABELS: Record<HistoryRegionId, string> = {
  vietnam: 'Việt Nam',
  asia: 'Châu Á',
  europe: 'Châu Âu',
  world: 'Thế giới',
};

export const ARCHIVE_CATEGORY_LABELS: Record<ArchiveCategory, string> = {
  image: 'Hình ảnh lịch sử',
  document: 'Văn kiện & Thư tịch',
  map: 'Bản đồ cổ',
  artifact: 'Hiện vật bảo tàng',
};

export const QUESTION_TYPE_LABELS: Record<HistoryQuestionType, string> = {
  mcq: 'Trắc nghiệm 4 lựa chọn',
  tf: 'Đúng / Sai (4 mệnh đề)',
  match: 'Nối sự kiện & Thời gian',
  order: 'Sắp xếp trình tự lịch sử',
  reading: 'Đọc hiểu & Phân tích tư liệu',
};

export const GRADE_LEVELS: readonly HistoryGradeLevel[] = [
  'Lớp 10',
  'Lớp 11',
  'Lớp 12',
  'Chuyên đề',
] as const;

export function filterLessons(
  lessons: HistoryLesson[],
  filters: {
    grade?: string;
    chapter?: string;
    period?: string;
    topic?: string;
    search?: string;
    bookmarkedOnly?: boolean;
    bookmarkedIds?: string[];
  }
): HistoryLesson[] {
  const q = (filters.search || '').trim().toLowerCase();
  const bookmarkSet = new Set(filters.bookmarkedIds || []);

  return lessons.filter((lesson) => {
    if (filters.grade && filters.grade !== 'all' && lesson.grade !== filters.grade) {
      return false;
    }
    if (filters.chapter && filters.chapter !== 'all' && lesson.chapter !== filters.chapter) {
      return false;
    }
    if (filters.period && filters.period !== 'all' && lesson.period !== filters.period) {
      return false;
    }
    if (filters.topic && filters.topic !== 'all' && lesson.topic !== filters.topic) {
      return false;
    }
    if (filters.bookmarkedOnly && !bookmarkSet.has(lesson.id)) {
      return false;
    }
    if (!q) return true;
    const haystack = [
      lesson.title,
      lesson.chapter,
      lesson.topic,
      lesson.eraLabel,
      lesson.summary,
      lesson.context,
      lesson.keyFigures.join(' '),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function filterEvents(
  events: HistoryEvent[],
  filters: {
    period?: string;
    region?: string;
    country?: string;
    topic?: string;
    search?: string;
  }
): HistoryEvent[] {
  const q = (filters.search || '').trim().toLowerCase();

  return [...events]
    .filter((ev) => {
      if (filters.period && filters.period !== 'all' && ev.period !== filters.period) {
        return false;
      }
      if (filters.region && filters.region !== 'all' && ev.region !== filters.region) {
        return false;
      }
      if (filters.country && filters.country !== 'all' && ev.country !== filters.country) {
        return false;
      }
      if (filters.topic && filters.topic !== 'all' && ev.topic !== filters.topic) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        ev.title,
        ev.dateLabel,
        ev.country,
        ev.topic,
        ev.context,
        ev.developments,
        ev.keyFigures.join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    })
    .sort((a, b) => a.sortYear - b.sortYear);
}

export function filterArchiveItems(
  items: ArchiveItem[],
  filters: {
    category?: string;
    period?: string;
    topic?: string;
    country?: string;
    figure?: string;
    search?: string;
  }
): ArchiveItem[] {
  const q = (filters.search || '').trim().toLowerCase();

  return items.filter((item) => {
    if (filters.category && filters.category !== 'all' && item.category !== filters.category) {
      return false;
    }
    if (filters.period && filters.period !== 'all' && item.period !== filters.period) {
      return false;
    }
    if (filters.topic && filters.topic !== 'all' && item.topic !== filters.topic) {
      return false;
    }
    if (filters.country && filters.country !== 'all' && item.country !== filters.country) {
      return false;
    }
    if (
      filters.figure &&
      filters.figure !== 'all' &&
      !item.figures.some((f) => f.toLowerCase() === filters.figure!.toLowerCase())
    ) {
      return false;
    }
    if (!q) return true;
    const haystack = [
      item.title,
      item.topic,
      item.country,
      item.yearLabel,
      item.provenance,
      item.transcriptOrExcerpt,
      item.figures.join(' '),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function getRelatedEventsForEvent(
  eventId: string,
  allEvents: HistoryEvent[]
): Array<{ event: HistoryEvent; relationLabel: string; note: string }> {
  const current = allEvents.find((ev) => ev.id === eventId);
  if (!current) return [];

  const resultMap = new Map<string, { event: HistoryEvent; relationLabel: string; note: string }>();

  for (const link of current.relatedEventIds) {
    const target = allEvents.find((ev) => ev.id === link.eventId);
    if (target) {
      resultMap.set(target.id, {
        event: target,
        relationLabel:
          link.relation === 'tiền_đề'
            ? 'Tiền đề dẫn tới'
            : link.relation === 'hệ_quả'
              ? 'Hệ quả tiếp nối'
              : 'Sự kiện đồng đại',
        note: link.note,
      });
    }
  }

  for (const candidate of allEvents) {
    if (candidate.id === eventId || resultMap.has(candidate.id)) continue;
    const reverseLink = candidate.relatedEventIds.find((l) => l.eventId === eventId);
    if (reverseLink) {
      const inverted =
        reverseLink.relation === 'hệ_quả'
          ? 'Tiền đề lịch sử'
          : reverseLink.relation === 'tiền_đề'
            ? 'Hệ quả tiếp nối'
            : 'Sự kiện đồng đại';
      resultMap.set(candidate.id, {
        event: candidate,
        relationLabel: inverted,
        note: reverseLink.note,
      });
    }
  }

  return Array.from(resultMap.values()).sort((a, b) => a.event.sortYear - b.event.sortYear);
}

export function parseSortYear(label: string): number {
  const raw = String(label || '').trim();
  const bcMatch = /(\d{1,4})\s*(?:TCN|BCE|BC)/i.exec(raw);
  if (bcMatch) return -Number(bcMatch[1]);
  const centuryMatch = /thế\s*kỷ\s*(\d{1,2})/i.exec(raw);
  if (centuryMatch) {
    const cent = Number(centuryMatch[1]);
    return /TCN/i.test(raw) ? -(cent * 100) : (cent - 1) * 100 + 1;
  }
  const yearMatch = /(1\d{3}|20\d{2}|\d{3})/.exec(raw);
  if (yearMatch) return Number(yearMatch[1]);
  return 1900;
}

export function addCrossLinkedLesson(
  store: HistoryStoreState,
  lessonInput: Omit<HistoryLesson, 'id' | 'linkedEventIds'> & {
    id?: string;
    eraYearLabel?: string;
    country?: string;
  }
): HistoryStoreState {
  const lessonId =
    lessonInput.id || `lesson-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const eventId = `ev-${lessonId}`;
  const dateLabel = lessonInput.eraYearLabel || lessonInput.eraLabel || 'Chưa rõ niên đại';
  const sortYear = parseSortYear(dateLabel);

  const newEvent: HistoryEvent = {
    id: eventId,
    title: lessonInput.title,
    dateLabel,
    sortYear,
    period: lessonInput.period,
    region: lessonInput.region,
    country: lessonInput.country || (lessonInput.region === 'vietnam' ? 'Việt Nam' : 'Quốc tế'),
    topic: lessonInput.topic,
    keyFigures: lessonInput.keyFigures,
    context: lessonInput.context,
    developments: lessonInput.developments.join(' '),
    outcomes: lessonInput.outcomes,
    significance: lessonInput.significance,
    relatedEventIds: [],
    linkedLessonId: lessonId,
    linkedLocationId: lessonInput.linkedLocationIds[0],
    linkedArchiveIds: lessonInput.linkedArchiveIds,
    imageUrl: lessonInput.heroImage,
    source: lessonInput.source,
  };

  const newLesson: HistoryLesson = {
    ...lessonInput,
    id: lessonId,
    linkedEventIds: [eventId],
  };

  const starterQuestion: HistoryQuestion = {
    id: `q-${lessonId}`,
    lessonId,
    chapter: lessonInput.chapter,
    topic: lessonInput.topic,
    period: lessonInput.period,
    type: 'mcq',
    prompt: `Ý nghĩa nổi bật nhất của "${lessonInput.title}" (${dateLabel}) là gì?`,
    options: [
      lessonInput.significance,
      'Chỉ mang tính chất cải cách hành chính ngắn hạn trong triều đình.',
      'Không tác động đến tiến trình lịch sử các giai đoạn sau.',
      'Chủ yếu diễn ra ngoài phạm vi khu vực nghiên cứu.',
    ],
    correctIndex: 0,
    explanation: `${lessonInput.significance} Bài học: ${lessonInput.lessonsLearned}`,
    sourceRef: `${lessonInput.title} · ${lessonInput.eraLabel}`,
    source: lessonInput.source,
  };

  return {
    ...store,
    lessons: [newLesson, ...store.lessons],
    events: [...store.events.filter((e) => e.id !== eventId), newEvent].sort(
      (a, b) => a.sortYear - b.sortYear
    ),
    questions: [starterQuestion, ...store.questions],
  };
}

export function addCrossLinkedEvent(
  store: HistoryStoreState,
  eventInput: Omit<HistoryEvent, 'id' | 'sortYear'> & { id?: string }
): HistoryStoreState {
  const eventId =
    eventInput.id || `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const sortYear = parseSortYear(eventInput.dateLabel);

  const newEvent: HistoryEvent = {
    ...eventInput,
    id: eventId,
    sortYear,
  };

  const autoQuestion: HistoryQuestion = {
    id: `q-${eventId}`,
    lessonId: eventInput.linkedLessonId,
    chapter: `Dòng sự kiện ${PERIOD_LABELS[eventInput.period]}`,
    topic: eventInput.topic,
    period: eventInput.period,
    type: 'mcq',
    prompt: `Sự kiện "${eventInput.title}" gắn với mốc thời gian nào sau đây?`,
    options: [
      eventInput.dateLabel,
      `${sortYear + 25}`,
      `${sortYear - 40}`,
      'Thế kỷ XXI',
    ],
    correctIndex: 0,
    explanation: `${eventInput.title} (${eventInput.dateLabel}): ${eventInput.outcomes}`,
    sourceRef: `${eventInput.title} · ${eventInput.country}`,
    source: eventInput.source,
  };

  return {
    ...store,
    events: [...store.events.filter((e) => e.id !== eventId), newEvent].sort(
      (a, b) => a.sortYear - b.sortYear
    ),
    questions: [autoQuestion, ...store.questions],
  };
}

export function selectPracticeQuestions(
  allQuestions: HistoryQuestion[],
  filters: {
    lessonId?: string;
    chapter?: string;
    topic?: string;
    types?: HistoryQuestionType[];
    limit?: number;
  }
): HistoryQuestion[] {
  const typeSet = filters.types && filters.types.length > 0 ? new Set(filters.types) : null;
  const filtered = allQuestions.filter((q) => {
    if (filters.lessonId && filters.lessonId !== 'all' && q.lessonId !== filters.lessonId) {
      return false;
    }
    if (filters.chapter && filters.chapter !== 'all' && q.chapter !== filters.chapter) {
      return false;
    }
    if (filters.topic && filters.topic !== 'all' && q.topic !== filters.topic) {
      return false;
    }
    if (typeSet && !typeSet.has(q.type)) {
      return false;
    }
    return true;
  });

  return typeof filters.limit === 'number' && filters.limit > 0
    ? filtered.slice(0, filters.limit)
    : filtered;
}

export function gradePracticeQuiz(
  questions: HistoryQuestion[],
  answers: Record<string, PracticeAnswerValue>
): {
  score: number;
  maxScore: number;
  percentage: number;
  results: PracticeQuestionResult[];
} {
  let totalEarned = 0;
  let totalMax = 0;

  const results: PracticeQuestionResult[] = questions.map((question) => {
    const answer = answers[question.id];
    const maxPoints = 1;
    totalMax += maxPoints;

    let earned = 0;

    if (question.type === 'mcq' || question.type === 'reading') {
      const selected =
        answer && (answer.type === 'mcq' || answer.type === 'reading')
          ? answer.selectedIndex
          : null;
      if (selected !== null && selected === (question.correctIndex ?? 0)) {
        earned = 1;
      }
    } else if (question.type === 'tf') {
      const statements = question.tfStatements || [];
      const selections = answer && answer.type === 'tf' ? answer.selections : [];
      if (statements.length > 0) {
        let correctCount = 0;
        statements.forEach((stmt, idx) => {
          if (selections[idx] === stmt.isTrue) {
            correctCount += 1;
          }
        });
        earned = Number((correctCount / statements.length).toFixed(2));
      }
    } else if (question.type === 'match') {
      const pairs = question.matchPairs || [];
      const mapping = answer && answer.type === 'match' ? answer.mapping : {};
      if (pairs.length > 0) {
        let correctCount = 0;
        pairs.forEach((pair) => {
          if (mapping[pair.left] === pair.right) {
            correctCount += 1;
          }
        });
        earned = Number((correctCount / pairs.length).toFixed(2));
      }
    } else if (question.type === 'order') {
      const expected = [...(question.orderItems || [])]
        .sort((a, b) => a.year - b.year)
        .map((item) => item.id);
      const userOrder = answer && answer.type === 'order' ? answer.orderedIds : [];
      if (expected.length > 0 && userOrder.length === expected.length) {
        let matches = 0;
        expected.forEach((id, idx) => {
          if (userOrder[idx] === id) matches += 1;
        });
        earned = Number((matches / expected.length).toFixed(2));
      }
    }

    totalEarned += earned;
    return {
      questionId: question.id,
      type: question.type,
      earned,
      maxPoints,
      isFullyCorrect: earned >= 0.99,
      explanation: question.explanation,
      sourceRef: question.sourceRef,
    };
  });

  const roundedScore = Number(totalEarned.toFixed(2));
  const percentage = totalMax > 0 ? Math.round((roundedScore / totalMax) * 100) : 0;

  return {
    score: roundedScore,
    maxScore: totalMax,
    percentage,
    results,
  };
}

export function buildStudyRecommendations(store: HistoryStoreState): Array<{
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  targetSection: 'knowledge' | 'practice' | 'timeline';
  lessonId?: string;
}> {
  const completedSet = new Set(store.progress.completedLessonIds);
  const recs: Array<{
    id: string;
    title: string;
    reason: string;
    actionLabel: string;
    targetSection: 'knowledge' | 'practice' | 'timeline';
    lessonId?: string;
  }> = [];

  const nextUnread = store.lessons.find((lesson) => !completedSet.has(lesson.id));
  if (nextUnread) {
    recs.push({
      id: `rec-read-${nextUnread.id}`,
      title: `Học bài tiếp theo: ${nextUnread.title}`,
      reason: `Thuộc ${nextUnread.grade} · ${PERIOD_LABELS[nextUnread.period]} — chưa hoàn thành đọc & ghi chú.`,
      actionLabel: 'Mở bài học',
      targetSection: 'knowledge',
      lessonId: nextUnread.id,
    });
  }

  const weakAttempt = [...store.attempts]
    .sort((a, b) => a.percentage - b.percentage)
    .find((att) => att.percentage < 80);
  if (weakAttempt) {
    recs.push({
      id: `rec-review-${weakAttempt.id}`,
      title: `Ôn tập lại chuyên đề ${weakAttempt.topic}`,
      reason: `Kết quả gần đây đạt ${weakAttempt.percentage}% — nên củng cố tư liệu và làm đề kiểm tra mới.`,
      actionLabel: 'Luyện tập ngay',
      targetSection: 'practice',
    });
  } else {
    recs.push({
      id: 'rec-practice-mixed',
      title: 'Thực hành tổng hợp 5 dạng câu hỏi lịch sử',
      reason: 'Kiểm tra khả năng phân tích tư liệu, nối mốc thời gian và sắp xếp diễn biến.',
      actionLabel: 'Vào phòng luyện tập',
      targetSection: 'practice',
    });
  }

  if (store.progress.bookmarkedLessonIds.length > 0) {
    const firstBookmarkId = store.progress.bookmarkedLessonIds[0];
    const bookmarked = store.lessons.find((l) => l.id === firstBookmarkId);
    if (bookmarked) {
      recs.push({
        id: `rec-bm-${bookmarked.id}`,
        title: `Xem lại ghi chú đã lưu: ${bookmarked.title}`,
        reason: 'Bài học nằm trong danh sách đánh dấu trọng tâm của bạn.',
        actionLabel: 'Mở ghi chú',
        targetSection: 'knowledge',
        lessonId: bookmarked.id,
      });
    }
  } else {
    recs.push({
      id: 'rec-timeline-explore',
      title: 'Khám phá liên kết sự kiện trên Dòng thời gian',
      reason: 'Đối chiếu tiến trình lịch sử Việt Nam và Thế giới qua các thời kỳ.',
      actionLabel: 'Xem dòng thời gian',
      targetSection: 'timeline',
    });
  }

  return recs.slice(0, 3);
}

function normalizePeriod(raw: string): HistoryPeriodId {
  const s = (raw || '').toLowerCase();
  if (s.includes('cổ đại') || s.includes('ancient') || s.includes('tcn')) return 'ancient';
  if (s.includes('trung đại') || s.includes('medieval') || s.includes('phong kiến')) return 'medieval';
  if (s.includes('cận đại') || s.includes('early_modern') || s.includes('công nghiệp')) return 'early_modern';
  if (s.includes('đương đại') || s.includes('sau 1945') || s.includes('contemporary')) return 'contemporary';
  return 'modern';
}

function pickField(row: Record<string, unknown>, candidates: string[]): string {
  const entries = Object.entries(row);
  for (const key of candidates) {
    const exact = entries.find(([k]) => k.trim().toLowerCase() === key.toLowerCase());
    if (exact && exact[1] !== undefined && exact[1] !== null && String(exact[1]).trim() !== '') {
      return String(exact[1]).trim();
    }
  }
  for (const key of candidates) {
    const partial = entries.find(([k]) => k.trim().toLowerCase().includes(key.toLowerCase()));
    if (partial && partial[1] !== undefined && partial[1] !== null && String(partial[1]).trim() !== '') {
      return String(partial[1]).trim();
    }
  }
  return '';
}

export function detectImportTargetFromRow(
  row: Record<string, unknown>,
  fallbackTarget: HistoryImportTarget = 'history'
): HistoryImportTarget {
  const keys = Object.keys(row).map((k) => k.toLowerCase());
  const hasAny = (terms: string[]) => keys.some((k) => terms.some((t) => k.includes(t)));

  if (hasAny(['câu hỏi', 'đáp án', 'lựa chọn', 'question', 'correctindex', 'options'])) {
    return 'practice';
  }
  if (hasAny(['nguồn gốc', 'xuất xứ', 'provenance', 'hiện vật', 'văn kiện', 'archive'])) {
    return 'archive';
  }
  if (hasAny(['bối cảnh', 'nguyên nhân', 'bài học', 'context', 'causes', 'chương'])) {
    return 'history';
  }
  if (hasAny(['mốc thời gian', 'năm', 'diễn biến', 'quốc gia', 'date', 'year', 'event'])) {
    return fallbackTarget === 'timeline' || fallbackTarget === 'events'
      ? fallbackTarget
      : 'events';
  }
  return fallbackTarget;
}

export function normalizeImportedRows(
  rows: Array<Record<string, unknown>>,
  hintTarget?: HistoryImportTarget
): ParsedImportPreviewRow[] {
  return rows.map((row, idx) => {
    const detectedTarget = hintTarget || detectImportTargetFromRow(row, 'history');
    const rawFields: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v !== undefined && v !== null) {
        rawFields[k] = String(v).trim();
      }
    }

    const title =
      pickField(row, ['tiêu đề', 'tên bài', 'tên sự kiện', 'tên tư liệu', 'câu hỏi', 'title', 'name', 'prompt']) ||
      `Mục nhập #${idx + 1}`;
    const period = normalizePeriod(pickField(row, ['thời kỳ', 'giai đoạn', 'period', 'era']));
    const topic = pickField(row, ['chủ đề', 'chuyên đề', 'topic', 'category']) || 'Lịch sử tổng hợp';

    let summaryOrDetail = '';
    let valid = Boolean(title && !title.startsWith('Mục nhập #'));
    let warning: string | undefined;

    if (detectedTarget === 'practice') {
      const optA = pickField(row, ['đáp án a', 'a', 'option a']);
      const ans = pickField(row, ['đáp án đúng', 'đáp án', 'answer', 'correct']);
      summaryOrDetail = optA ? `A: ${optA} · Đáp án: ${ans || 'A'}` : `Đáp án: ${ans || 'Chưa rõ'}`;
      if (!pickField(row, ['câu hỏi', 'prompt', 'question', 'tiêu đề'])) {
        valid = false;
        warning = 'Thiếu nội dung câu hỏi';
      }
    } else if (detectedTarget === 'archive') {
      const provenance = pickField(row, ['nguồn gốc', 'xuất xứ', 'nguồn', 'provenance', 'source']);
      summaryOrDetail = provenance || pickField(row, ['trích đoạn', 'mô tả', 'excerpt', 'description']);
      if (!provenance) {
        warning = 'Nên bổ sung nguồn gốc xuất xứ tư liệu';
      }
    } else if (detectedTarget === 'timeline' || detectedTarget === 'events') {
      const dateLabel = pickField(row, ['mốc thời gian', 'năm', 'thời gian', 'date', 'year']);
      const detail = pickField(row, ['diễn biến', 'kết quả', 'bối cảnh', 'summary', 'description']);
      summaryOrDetail = [dateLabel, detail].filter(Boolean).join(' — ');
      if (!dateLabel) {
        warning = 'Thiếu mốc thời gian cụ thể';
      }
    } else {
      const context = pickField(row, ['bối cảnh', 'tóm tắt', 'diễn biến', 'context', 'summary']);
      const grade = pickField(row, ['lớp', 'grade']) || 'Lớp 10';
      summaryOrDetail = `[${grade}] ${context || 'Chưa có tóm tắt'}`;
    }

    return {
      rowId: `imp-${idx + 1}`,
      target: detectedTarget,
      title,
      period,
      topic,
      summaryOrDetail,
      rawFields,
      valid,
      warning,
    };
  });
}

export function commitImportedPreviewRows(
  store: HistoryStoreState,
  rows: ParsedImportPreviewRow[]
): { nextStore: HistoryStoreState; addedCount: number } {
  let nextStore = store;
  let addedCount = 0;

  for (const row of rows) {
    if (!row.valid) continue;
    const f = row.rawFields;
    const pick = (keys: string[]) => {
      for (const k of keys) {
        const match = Object.entries(f).find(([fk]) => fk.toLowerCase().includes(k));
        if (match && match[1]) return match[1];
      }
      return '';
    };

    if (row.target === 'history') {
      const gradeRaw = pick(['lớp', 'grade']);
      const grade: HistoryGradeLevel =
        gradeRaw.includes('11')
          ? 'Lớp 11'
          : gradeRaw.includes('12')
            ? 'Lớp 12'
            : gradeRaw.toLowerCase().includes('chuyên')
              ? 'Chuyên đề'
              : 'Lớp 10';
      const eraLabel = pick(['niên đại', 'thời gian', 'mốc', 'era']) || PERIOD_LABELS[row.period];
      const developmentsText = pick(['diễn biến', 'developments']) || row.summaryOrDetail;
      nextStore = addCrossLinkedLesson(nextStore, {
        title: row.title,
        grade,
        chapter: pick(['chương', 'chapter']) || 'Chuyên đề nhập từ Excel',
        period: row.period,
        region: pick(['quốc gia', 'khu vực']).toLowerCase().includes('việt') ? 'vietnam' : 'world',
        topic: row.topic,
        eraLabel,
        eraYearLabel: eraLabel,
        country: pick(['quốc gia', 'country']) || 'Việt Nam',
        summary: pick(['tóm tắt', 'summary']) || row.summaryOrDetail,
        context: pick(['bối cảnh', 'context']) || 'Được nhập và chuẩn hóa từ tài liệu học tập.',
        causes: pick(['nguyên nhân', 'causes']) || 'Các yếu tố kinh tế, chính trị, xã hội đương thời.',
        developments: developmentsText
          .split(/[;\n]+/)
          .map((s) => s.trim())
          .filter(Boolean),
        outcomes: pick(['kết quả', 'outcomes']) || 'Tạo chuyển biến quan trọng trong giai đoạn lịch sử.',
        significance: pick(['ý nghĩa', 'significance']) || 'Khẳng định giá trị lịch sử và dấu ấn thời đại.',
        lessonsLearned: pick(['bài học', 'lesson']) || 'Củng cố tinh thần chủ động và tư duy lịch sử.',
        keyFigures: (pick(['nhân vật', 'figures']) || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        linkedLocationIds: [],
        linkedArchiveIds: [],
        primarySourceQuote: {
          text: pick(['trích dẫn', 'tư liệu', 'quote']) || row.title,
          attribution: pick(['nguồn', 'attribution']) || 'Tài liệu nhập liệu',
        },
        source: 'imported',
      });
      addedCount += 1;
    } else if (row.target === 'timeline' || row.target === 'events') {
      const dateLabel = pick(['mốc thời gian', 'năm', 'thời gian', 'date', 'year']) || 'Chưa rõ';
      const country = pick(['quốc gia', 'country']) || 'Việt Nam';
      nextStore = addCrossLinkedEvent(nextStore, {
        title: row.title,
        dateLabel,
        period: row.period,
        region: country.toLowerCase().includes('việt') ? 'vietnam' : 'world',
        country,
        topic: row.topic,
        keyFigures: (pick(['nhân vật', 'figures']) || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        context: pick(['bối cảnh', 'context']) || row.summaryOrDetail,
        developments: pick(['diễn biến', 'developments']) || row.summaryOrDetail,
        outcomes: pick(['kết quả', 'outcomes']) || 'Ghi nhận chuyển biến lịch sử.',
        significance: pick(['ý nghĩa', 'significance']) || 'Mốc quan trọng trên dòng thời gian.',
        relatedEventIds: [],
        source: 'imported',
      });
      addedCount += 1;
    } else if (row.target === 'archive') {
      const catRaw = pick(['loại', 'phân loại', 'category']).toLowerCase();
      const category: ArchiveCategory = catRaw.includes('bản đồ')
        ? 'map'
        : catRaw.includes('hiện vật')
          ? 'artifact'
          : catRaw.includes('ảnh') || catRaw.includes('image')
            ? 'image'
            : 'document';
      const newArchive: ArchiveItem = {
        id: `arc-${Date.now().toString(36)}-${addedCount}`,
        title: row.title,
        category,
        period: row.period,
        topic: row.topic,
        country: pick(['quốc gia', 'country']) || 'Việt Nam',
        figures: (pick(['nhân vật', 'figures']) || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        yearLabel: pick(['năm', 'niên đại', 'year']) || PERIOD_LABELS[row.period],
        transcriptOrExcerpt: pick(['trích đoạn', 'nội dung', 'mô tả', 'excerpt']) || row.summaryOrDetail,
        provenance: pick(['nguồn gốc', 'xuất xứ', 'nguồn', 'provenance']) || 'Tư liệu lưu trữ do người học tải lên',
        curatorialNote: pick(['ghi chú', 'note']) || 'Đã phân loại và lưu trữ vào thư viện tư liệu.',
        linkedLessonIds: [],
        linkedEventIds: [],
        source: 'imported',
      };
      nextStore = {
        ...nextStore,
        archiveItems: [newArchive, ...nextStore.archiveItems],
      };
      addedCount += 1;
    } else if (row.target === 'practice') {
      const optA = pick(['đáp án a', 'option a']) || 'Phương án A';
      const optB = pick(['đáp án b', 'option b']) || 'Phương án B';
      const optC = pick(['đáp án c', 'option c']) || 'Phương án C';
      const optD = pick(['đáp án d', 'option d']) || 'Phương án D';
      const correctRaw = pick(['đáp án đúng', 'đáp án', 'correct']).toUpperCase();
      const correctIndex = correctRaw === 'B' ? 1 : correctRaw === 'C' ? 2 : correctRaw === 'D' ? 3 : 0;
      const newQuestion: HistoryQuestion = {
        id: `q-imp-${Date.now().toString(36)}-${addedCount}`,
        chapter: pick(['chương', 'chapter']) || 'Bộ đề nhập liệu',
        topic: row.topic,
        period: row.period,
        type: 'mcq',
        prompt: row.title,
        options: [optA, optB, optC, optD],
        correctIndex,
        explanation: pick(['giải thích', 'explanation']) || 'Đối chiếu kiến thức trong Kho kiến thức lịch sử.',
        sourceRef: pick(['nguồn', 'source']) || 'Ngân hàng câu hỏi nhập từ Excel',
        source: 'imported',
      };
      nextStore = {
        ...nextStore,
        questions: [newQuestion, ...nextStore.questions],
      };
      addedCount += 1;
    }
  }

  return { nextStore, addedCount };
}

export function getExcelTemplateSpec(target: HistoryImportTarget): {
  fileName: string;
  sheetName: string;
  headers: string[];
  sampleRows: Array<Record<string, string>>;
} {
  switch (target) {
    case 'timeline':
    case 'events':
      return {
        fileName: 'mau_su_kien_dong_thoi_gian.xlsx',
        sheetName: 'SuKienLichSu',
        headers: [
          'Tên sự kiện',
          'Mốc thời gian',
          'Thời kỳ',
          'Quốc gia',
          'Chủ đề',
          'Nhân vật',
          'Bối cảnh',
          'Diễn biến',
          'Kết quả',
          'Ý nghĩa',
        ],
        sampleRows: [
          {
            'Tên sự kiện': 'Khởi nghĩa Hai Bà Trưng',
            'Mốc thời gian': '40',
            'Thời kỳ': 'Cổ đại',
            'Quốc gia': 'Việt Nam',
            'Chủ đề': 'Đấu tranh giành độc lập',
            'Nhân vật': 'Trưng Trắc, Trưng Nhị',
            'Bối cảnh': 'Chính sách bóc lột tàn bạo của chính quyền đô hộ nhà Hán.',
            'Diễn biến': 'Mùa xuân năm 40, Hai Bà Trưng dựng cờ khởi nghĩa ở Hát Môn, đánh chiếm Mê Linh và Cổ Loa.',
            'Kết quả': 'Giành lại quyền tự chủ trong hơn 3 năm, Trưng Trắc lên ngôi vua.',
            'Ý nghĩa': 'Cuộc khởi nghĩa đầu tiên tiêu biểu cho ý chí độc lập của dân tộc Việt Nam.',
          },
        ],
      };
    case 'archive':
      return {
        fileName: 'mau_thu_vien_tu_lieu_lich_su.xlsx',
        sheetName: 'TuLieuLichSu',
        headers: [
          'Tên tư liệu',
          'Phân loại',
          'Năm',
          'Thời kỳ',
          'Quốc gia',
          'Chủ đề',
          'Nhân vật',
          'Trích đoạn',
          'Nguồn gốc xuất xứ',
          'Ghi chú giám tuyển',
        ],
        sampleRows: [
          {
            'Tên tư liệu': 'Chiếu dời đô (Thiên đô chiếu)',
            'Phân loại': 'Văn kiện',
            'Năm': '1010',
            'Thời kỳ': 'Trung đại',
            'Quốc gia': 'Việt Nam',
            'Chủ đề': 'Xây dựng quốc gia Đại Việt',
            'Nhân vật': 'Lý Công Uẩn',
            'Trích đoạn': 'Thành Đại La ở vào nơi trung tâm trời đất, được cái thế rồng cuộn hổ ngồi...',
            'Nguồn gốc xuất xứ': 'Đại Việt sử ký toàn thư, quyển II, Kỷ nhà Lý.',
            'Ghi chú giám tuyển': 'Văn kiện mở đầu cho thời kỳ phát triển rực rỡ của Thăng Long – Hà Nội.',
          },
        ],
      };
    case 'practice':
      return {
        fileName: 'mau_cau_hoi_luyen_tap_lich_su.xlsx',
        sheetName: 'CauHoiLichSu',
        headers: [
          'Câu hỏi',
          'Chương',
          'Chủ đề',
          'Thời kỳ',
          'Đáp án A',
          'Đáp án B',
          'Đáp án C',
          'Đáp án D',
          'Đáp án đúng',
          'Giải thích',
          'Nguồn',
        ],
        sampleRows: [
          {
            'Câu hỏi': 'Năm 1010, vua Lý Thái Tổ quyết định dời đô từ Hoa Lư về đâu?',
            'Chương': 'Đại Việt thời Lý – Trần',
            'Chủ đề': 'Xây dựng nhà nước phong kiến',
            'Thời kỳ': 'Trung đại',
            'Đáp án A': 'Thành Đại La (Thăng Long)',
            'Đáp án B': 'Cổ Loa',
            'Đáp án C': 'Phú Xuân',
            'Đáp án D': 'Tây Đô',
            'Đáp án đúng': 'A',
            'Giải thích': 'Năm 1010, Lý Công Uẩn ban Chiếu dời đô về Đại La và đổi tên thành Thăng Long.',
            'Nguồn': 'SGK Lịch sử 10 & Đại Việt sử ký toàn thư',
          },
        ],
      };
    case 'history':
    default:
      return {
        fileName: 'mau_bai_hoc_lich_su.xlsx',
        sheetName: 'BaiHocLichSu',
        headers: [
          'Tiêu đề',
          'Lớp',
          'Chương',
          'Thời kỳ',
          'Niên đại',
          'Quốc gia',
          'Chủ đề',
          'Nhân vật',
          'Bối cảnh',
          'Nguyên nhân',
          'Diễn biến',
          'Kết quả',
          'Ý nghĩa',
          'Bài học lịch sử',
        ],
        sampleRows: [
          {
            'Tiêu đề': 'Chiến thắng Chi Lăng – Xương Giang (1427)',
            'Lớp': 'Lớp 10',
            'Chương': 'Khởi nghĩa Lam Sơn',
            'Thời kỳ': 'Trung đại',
            'Niên đại': '1427',
            'Quốc gia': 'Việt Nam',
            'Chủ đề': 'Chống ngoại xâm',
            'Nhân vật': 'Lê Lợi, Nguyễn Trãi',
            'Bối cảnh': 'Quân Minh cố thủ ở Đông Quan và cử Liễu Thăng đem 10 vạn viện binh sang cứu viện.',
            'Nguyên nhân': 'Nghĩa quân Lam Sơn cần tiêu diệt viện binh để buộc Vương Thông đầu hàng.',
            'Diễn biến': 'Nghĩa quân phục kích chém Liễu Thăng tại Chi Lăng; tiếp tục đánh tan quân giặc ở Xương Giang.',
            'Kết quả': '10 vạn viện binh tan rã, Vương Thông xin hòa và rút quân về nước.',
            'Ý nghĩa': 'Kết thúc 20 năm đô hộ của nhà Minh, mở ra vương triều Hậu Lê.',
            'Bài học lịch sử': 'Kết hợp quân sự với ngoại giao tâm công và sức mạnh đại đoàn kết dân tộc.',
          },
        ],
      };
  }
}

export function loadHistoryStore(seedState: HistoryStoreState): HistoryStoreState {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return seedState;
  }
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return seedState;
    const parsed = JSON.parse(raw) as Partial<HistoryStoreState>;
    const mergeById = <T extends { id: string }>(seed: T[], stored?: T[]): T[] => {
      if (!Array.isArray(stored)) return seed;
      const map = new Map<string, T>();
      seed.forEach((item) => map.set(item.id, item));
      stored.forEach((item) => {
        if (item && item.id) map.set(item.id, item);
      });
      return Array.from(map.values());
    };
    return {
      lessons: mergeById(seedState.lessons, parsed.lessons),
      events: mergeById(seedState.events, parsed.events).sort((a, b) => a.sortYear - b.sortYear),
      atlasLocations: mergeById(seedState.atlasLocations, parsed.atlasLocations),
      archiveItems: mergeById(seedState.archiveItems, parsed.archiveItems),
      questions: mergeById(seedState.questions, parsed.questions),
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : seedState.attempts,
      progress: parsed.progress
        ? {
            completedLessonIds: Array.isArray(parsed.progress.completedLessonIds)
              ? parsed.progress.completedLessonIds
              : [],
            bookmarkedLessonIds: Array.isArray(parsed.progress.bookmarkedLessonIds)
              ? parsed.progress.bookmarkedLessonIds
              : [],
            lessonNotes: parsed.progress.lessonNotes || {},
            importantQuotes: Array.isArray(parsed.progress.importantQuotes)
              ? parsed.progress.importantQuotes
              : [],
            lastStudiedAt: parsed.progress.lastStudiedAt || new Date().toISOString(),
          }
        : seedState.progress,
    };
  } catch {
    return seedState;
  }
}

export function saveHistoryStore(store: HistoryStoreState): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota issues cleanly
  }
}
