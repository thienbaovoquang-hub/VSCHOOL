import test from 'node:test';
import assert from 'node:assert/strict';
import {
  areAllVisibleSelected,
  chunkIdsForBatchDelete,
  partitionPrefixedKeys,
  pruneStaleSelectedIds,
  toggleSelectAllVisible,
  toggleSelectedId,
} from './bulkSelection';

test('toggleSelectedId adds and removes IDs without duplicates', () => {
  const s1 = toggleSelectedId([], 'a');
  assert.deepEqual(s1, ['a']);
  const s2 = toggleSelectedId(s1, 'b');
  assert.deepEqual(s2, ['a', 'b']);
  const s3 = toggleSelectedId(s2, 'a');
  assert.deepEqual(s3, ['b']);
});

test('areAllVisibleSelected and toggleSelectAllVisible handle filtered subsets cleanly', () => {
  assert.equal(areAllVisibleSelected(['a'], []), false);
  assert.equal(areAllVisibleSelected(['a', 'b'], ['a', 'b']), true);
  assert.equal(areAllVisibleSelected(['a'], ['a', 'b']), false);

  // Selecting all visible preserves existing hidden selection
  const selected = toggleSelectAllVisible(['hidden-1', 'a'], ['a', 'b']);
  assert.deepEqual(selected, ['hidden-1', 'a', 'b']);

  // Toggling again deselects only visible items
  const deselected = toggleSelectAllVisible(selected, ['a', 'b']);
  assert.deepEqual(deselected, ['hidden-1']);
});

test('pruneStaleSelectedIds removes IDs no longer in dataset', () => {
  const pruned = pruneStaleSelectedIds(['s1', 's2', 's3'], ['s2', 's4']);
  assert.deepEqual(pruned, ['s2']);
});

test('chunkIdsForBatchDelete deduplicates, trims, drops empties, and respects chunk size', () => {
  const chunks = chunkIdsForBatchDelete([' id1 ', '', 'id2', 'id1', 'id3', 'id4', 'id5'], 2);
  assert.deepEqual(chunks, [
    ['id1', 'id2'],
    ['id3', 'id4'],
    ['id5'],
  ]);
});

test('partitionPrefixedKeys separates mixed entity selections accurately', () => {
  const res = partitionPrefixedKeys(
    ['teacher:T1', 'staff:S1', 'teacher:T2', 'unknown:X'],
    'teacher:',
    'staff:'
  );
  assert.deepEqual(res, {
    primaryIds: ['T1', 'T2'],
    secondaryIds: ['S1'],
  });
});
