import type { HistoryStoreState } from '../../types/history';
import type { SubjectId } from '../subjectRegistry.ts';

const SUBJECT_COLLECTION_KEY_PREFIX = 'vschool_subject_items_v2_';

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
    return null;
  } catch {
    return null;
  }
}

export function buildSubjectCollectionStorageKey(
  userId: string,
  subjectId: SubjectId,
  collectionKey: string
): string {
  const safeUser = String(userId || 'anon').trim() || 'anon';
  return `${SUBJECT_COLLECTION_KEY_PREFIX}${safeUser}_${subjectId}_${collectionKey}`;
}

export function loadSubjectCollection<T>(
  userId: string,
  subjectId: SubjectId,
  collectionKey: string
): T[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(
      buildSubjectCollectionStorageKey(userId, subjectId, collectionKey)
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function saveSubjectCollection<T>(
  userId: string,
  subjectId: SubjectId,
  collectionKey: string,
  items: T[]
): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(
      buildSubjectCollectionStorageKey(userId, subjectId, collectionKey),
      JSON.stringify(items)
    );
  } catch {
    // Ignore quota errors cleanly
  }
}

export function createEmptyHistoryState(): HistoryStoreState {
  return {
    lessons: [],
    events: [],
    atlasLocations: [],
    archiveItems: [],
    questions: [],
    attempts: [],
    progress: {
      completedLessonIds: [],
      bookmarkedLessonIds: [],
      lessonNotes: {},
      importantQuotes: [],
      lastStudiedAt: new Date().toISOString(),
    },
  };
}

export function stripBuiltinHistoryItems(state: HistoryStoreState): HistoryStoreState {
  return {
    ...state,
    lessons: state.lessons.filter((l) => l.source !== 'builtin'),
    events: state.events.filter((e) => e.source !== 'builtin'),
    archiveItems: state.archiveItems.filter((a) => a.source !== 'builtin'),
    questions: state.questions.filter((q) => q.source !== 'builtin'),
  };
}
