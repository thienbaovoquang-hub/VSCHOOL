export type HistorySectionId =
  | 'home'
  | 'knowledge'
  | 'timeline'
  | 'atlas'
  | 'archive'
  | 'practice';

export type HistoryPeriodId =
  | 'ancient'
  | 'medieval'
  | 'early_modern'
  | 'modern'
  | 'contemporary';

export type HistoryRegionId = 'vietnam' | 'asia' | 'europe' | 'world';

export type HistoryGradeLevel = 'Lớp 10' | 'Lớp 11' | 'Lớp 12' | 'Chuyên đề';

export type HistoryQuestionType = 'mcq' | 'tf' | 'match' | 'order' | 'reading';

export type HistoryEventRelationType = 'tiền_đề' | 'hệ_quả' | 'song_hành';

export interface HistoryLesson {
  id: string;
  title: string;
  grade: HistoryGradeLevel;
  chapter: string;
  period: HistoryPeriodId;
  region: HistoryRegionId;
  topic: string;
  eraLabel: string;
  summary: string;
  context: string;
  causes: string;
  developments: string[];
  outcomes: string;
  significance: string;
  lessonsLearned: string;
  keyFigures: string[];
  linkedEventIds: string[];
  linkedLocationIds: string[];
  linkedArchiveIds: string[];
  primarySourceQuote: {
    text: string;
    attribution: string;
  };
  heroImage?: string;
  source: 'builtin' | 'imported' | 'custom';
}

export interface HistoryEventLink {
  eventId: string;
  relation: HistoryEventRelationType;
  note: string;
}

export interface HistoryEvent {
  id: string;
  title: string;
  dateLabel: string;
  sortYear: number;
  period: HistoryPeriodId;
  region: HistoryRegionId;
  country: string;
  topic: string;
  keyFigures: string[];
  context: string;
  developments: string;
  outcomes: string;
  significance: string;
  relatedEventIds: HistoryEventLink[];
  linkedLessonId?: string;
  linkedLocationId?: string;
  linkedArchiveIds?: string[];
  imageUrl?: string;
  source: 'builtin' | 'imported' | 'custom';
}

export type AtlasScope = 'vietnam' | 'world';

export interface AtlasEra {
  id: string;
  scope: AtlasScope;
  label: string;
  dateRange: string;
  summary: string;
  territories: Array<{
    id: string;
    name: string;
    pathD: string;
    fill: string;
    stroke: string;
    labelX: number;
    labelY: number;
  }>;
}

export interface AtlasLocation {
  id: string;
  scope: AtlasScope;
  name: string;
  modernLocation: string;
  eraIds: string[];
  x: number;
  y: number;
  summary: string;
  historicalChanges: string;
  linkedEventIds: string[];
  linkedLessonIds: string[];
}

export type ArchiveCategory = 'image' | 'document' | 'map' | 'artifact';

export interface ArchiveItem {
  id: string;
  title: string;
  category: ArchiveCategory;
  period: HistoryPeriodId;
  topic: string;
  country: string;
  figures: string[];
  yearLabel: string;
  imageUrl?: string;
  transcriptOrExcerpt: string;
  provenance: string;
  curatorialNote: string;
  linkedLessonIds: string[];
  linkedEventIds: string[];
  source: 'builtin' | 'imported' | 'custom';
}

export interface HistoryQuestion {
  id: string;
  lessonId?: string;
  chapter: string;
  topic: string;
  period: HistoryPeriodId;
  type: HistoryQuestionType;
  prompt: string;
  sourceExcerpt?: string;
  options?: string[];
  correctIndex?: number;
  tfStatements?: Array<{ text: string; isTrue: boolean }>;
  matchPairs?: Array<{ left: string; right: string }>;
  orderItems?: Array<{ id: string; label: string; year: number }>;
  explanation: string;
  sourceRef: string;
  source?: 'builtin' | 'imported' | 'custom';
}

export type PracticeAnswerValue =
  | { type: 'mcq'; selectedIndex: number | null }
  | { type: 'tf'; selections: Array<boolean | null> }
  | { type: 'match'; mapping: Record<string, string> }
  | { type: 'order'; orderedIds: string[] }
  | { type: 'reading'; selectedIndex: number | null };

export interface PracticeQuestionResult {
  questionId: string;
  type: HistoryQuestionType;
  earned: number;
  maxPoints: number;
  isFullyCorrect: boolean;
  explanation: string;
  sourceRef: string;
}

export interface PracticeAttempt {
  id: string;
  title: string;
  createdAt: string;
  filterLabel: string;
  topic: string;
  questionCount: number;
  score: number;
  maxScore: number;
  percentage: number;
  durationSeconds: number;
  results: PracticeQuestionResult[];
}

export interface HistoryUserProgress {
  completedLessonIds: string[];
  bookmarkedLessonIds: string[];
  lessonNotes: Record<string, string>;
  importantQuotes: Array<{
    id: string;
    lessonId: string;
    lessonTitle: string;
    text: string;
    savedAt: string;
  }>;
  lastStudiedAt: string;
}

export interface HistoryStoreState {
  lessons: HistoryLesson[];
  events: HistoryEvent[];
  atlasLocations: AtlasLocation[];
  archiveItems: ArchiveItem[];
  questions: HistoryQuestion[];
  attempts: PracticeAttempt[];
  progress: HistoryUserProgress;
}

export type HistoryImportTarget = 'history' | 'timeline' | 'events' | 'archive' | 'practice';

export interface ParsedImportPreviewRow {
  rowId: string;
  target: HistoryImportTarget;
  title: string;
  period: HistoryPeriodId;
  topic: string;
  summaryOrDetail: string;
  rawFields: Record<string, string>;
  valid: boolean;
  warning?: string;
}
