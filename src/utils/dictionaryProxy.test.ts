import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDictionaryCache,
  fetchFreeDictionaryEntry,
  normalizeDictionaryWord,
} from './dictionaryProxy';

test('normalizeDictionaryWord trims whitespace, lowercases, and strips outer punctuation', () => {
  assert.equal(normalizeDictionaryWord('  "Resilient!"  '), 'resilient');
  assert.equal(normalizeDictionaryWord('Education.'), 'education');
  assert.equal(normalizeDictionaryWord('   '), '');
  assert.equal(normalizeDictionaryWord(null), '');
});

test('fetchFreeDictionaryEntry returns 400 for empty input', async () => {
  const res = await fetchFreeDictionaryEntry('  ...  ');
  assert.equal(res.ok, false);
  assert.equal(res.status, 400);
});

test('fetchFreeDictionaryEntry fetches entries and caches subsequent lookups', async () => {
  const cache = createDictionaryCache(60_000, 10);
  let calls = 0;
  const mockFetch = (async () => {
    calls++;
    return new Response(
      JSON.stringify([{ word: 'resilient', phonetic: '/rɪˈzɪliənt/', meanings: [] }]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  const first = await fetchFreeDictionaryEntry('Resilient', { fetchImpl: mockFetch, cache });
  assert.equal(first.ok, true);
  assert.equal(first.cached, false);
  assert.equal(calls, 1);

  const second = await fetchFreeDictionaryEntry('resilient', { fetchImpl: mockFetch, cache });
  assert.equal(second.ok, true);
  assert.equal(second.cached, true);
  assert.equal(calls, 1);
});

test('fetchFreeDictionaryEntry returns notFound=true on 404 without retrying', async () => {
  const cache = createDictionaryCache(60_000, 10);
  let calls = 0;
  const mockFetch = (async () => {
    calls++;
    return new Response(JSON.stringify({ title: 'No Definitions Found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  const res = await fetchFreeDictionaryEntry('xyznotaword123', { fetchImpl: mockFetch, cache });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.status, 404);
    assert.equal(res.notFound, true);
  }
  assert.equal(calls, 1);
});

test('fetchFreeDictionaryEntry retries once on transient 503/429 error and succeeds', async () => {
  let calls = 0;
  const mockFetch = (async () => {
    calls++;
    if (calls === 1) {
      return new Response('rate limited', { status: 429 });
    }
    return new Response(
      JSON.stringify([{ word: 'hello', meanings: [{ partOfSpeech: 'noun', definitions: [] }] }]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  const res = await fetchFreeDictionaryEntry('hello', {
    fetchImpl: mockFetch,
    retryDelayMs: 0,
  });
  assert.equal(res.ok, true);
  assert.equal(calls, 2);
});
