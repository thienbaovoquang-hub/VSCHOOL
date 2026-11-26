import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSubjectCollectionStorageKey,
  createEmptyHistoryState,
  loadSubjectCollection,
  saveSubjectCollection,
  stripBuiltinHistoryItems,
} from './subjectDataStore.ts';
import {
  buildHistoryStorageKey,
  loadHistoryStore,
  saveHistoryStore,
} from '../historyEngine.ts';

function createMockStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

test('loadSubjectCollection returns empty array cleanly when no items exist (zero pre-seeded data)', () => {
  const prev = (globalThis as Record<string, unknown>).localStorage;
  (globalThis as Record<string, unknown>).localStorage = createMockStorage();
  try {
    const empty = loadSubjectCollection<{ id: string }>('user-1', 'english', 'vocab');
    assert.deepEqual(empty, []);

    saveSubjectCollection('user-1', 'english', 'vocab', [{ id: 'w1' }]);
    assert.deepEqual(loadSubjectCollection('user-1', 'english', 'vocab'), [{ id: 'w1' }]);
    assert.deepEqual(loadSubjectCollection('user-2', 'english', 'vocab'), []);

    const key = buildSubjectCollectionStorageKey('user-1', 'english', 'vocab');
    (globalThis as { localStorage: Storage }).localStorage.setItem(key, '{bad json');
    assert.deepEqual(loadSubjectCollection('user-1', 'english', 'vocab'), []);
  } finally {
    if (prev === undefined) {
      delete (globalThis as Record<string, unknown>).localStorage;
    } else {
      (globalThis as Record<string, unknown>).localStorage = prev;
    }
  }
});

test('createEmptyHistoryState returns completely empty arrays and stripBuiltinHistoryItems drops builtin records', () => {
  const empty = createEmptyHistoryState();
  assert.equal(empty.lessons.length, 0);
  assert.equal(empty.events.length, 0);
  assert.equal(empty.atlasLocations.length, 0);
  assert.equal(empty.archiveItems.length, 0);
  assert.equal(empty.questions.length, 0);

  const sanitized = stripBuiltinHistoryItems({
    ...empty,
    lessons: [
      {
        id: 'b1',
        title: 'Builtin',
        grade: 'Lớp 10',
        chapter: 'C1',
        period: 'ancient',
        region: 'vietnam',
        topic: 'T',
        eraLabel: 'E',
        summary: 'S',
        context: 'C',
        causes: 'Ca',
        developments: [],
        outcomes: 'O',
        significance: 'Sig',
        lessonsLearned: 'L',
        keyFigures: [],
        linkedEventIds: [],
        linkedLocationIds: [],
        linkedArchiveIds: [],
        primarySourceQuote: { text: 'Q', attribution: 'A' },
        source: 'builtin',
      },
      {
        id: 'u1',
        title: 'Custom',
        grade: 'Lớp 10',
        chapter: 'C1',
        period: 'ancient',
        region: 'vietnam',
        topic: 'T',
        eraLabel: 'E',
        summary: 'S',
        context: 'C',
        causes: 'Ca',
        developments: [],
        outcomes: 'O',
        significance: 'Sig',
        lessonsLearned: 'L',
        keyFigures: [],
        linkedEventIds: [],
        linkedLocationIds: [],
        linkedArchiveIds: [],
        primarySourceQuote: { text: 'Q', attribution: 'A' },
        source: 'custom',
      },
    ],
  });

  assert.equal(sanitized.lessons.length, 1);
  assert.equal(sanitized.lessons[0].id, 'u1');
});

test('history store isolates persisted lessons across different user IDs with zero seed defaults', () => {
  const prevStorage = (globalThis as Record<string, unknown>).localStorage;
  const prevWindow = (globalThis as Record<string, unknown>).window;
  const mockStorage = createMockStorage();
  (globalThis as Record<string, unknown>).localStorage = mockStorage;
  (globalThis as Record<string, unknown>).window = {};

  try {
    assert.equal(buildHistoryStorageKey('student-a'), 'schoolhub_history_museum_v2_student-a');
    assert.equal(buildHistoryStorageKey(''), 'schoolhub_history_museum_v2');

    const emptySeed = createEmptyHistoryState();
    assert.equal(loadHistoryStore(emptySeed, 'student-a').lessons.length, 0);

    saveHistoryStore(
      {
        ...emptySeed,
        lessons: [
          {
            id: 'h-u1',
            title: 'User Lesson',
            grade: 'Lớp 11',
            chapter: 'C1',
            period: 'early_modern',
            region: 'vietnam',
            topic: 'Topic',
            eraLabel: '1858',
            summary: 'Summary',
            context: '',
            causes: '',
            developments: [],
            outcomes: '',
            significance: '',
            lessonsLearned: '',
            keyFigures: [],
            linkedEventIds: [],
            linkedLocationIds: [],
            linkedArchiveIds: [],
            primarySourceQuote: { text: '', attribution: '' },
            source: 'custom',
          },
        ],
      },
      'student-a'
    );

    assert.equal(loadHistoryStore(emptySeed, 'student-a').lessons.length, 1);
    assert.equal(loadHistoryStore(emptySeed, 'student-b').lessons.length, 0);
  } finally {
    if (prevStorage === undefined) {
      delete (globalThis as Record<string, unknown>).localStorage;
    } else {
      (globalThis as Record<string, unknown>).localStorage = prevStorage;
    }
    if (prevWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      (globalThis as Record<string, unknown>).window = prevWindow;
    }
  }
});
