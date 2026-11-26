export function toggleSelectedId(selectedIds: string[], id: string): string[] {
  if (!id) return selectedIds;
  if (selectedIds.includes(id)) {
    return selectedIds.filter((item) => item !== id);
  }
  return [...selectedIds, id];
}

export function areAllVisibleSelected(selectedIds: string[], visibleIds: string[]): boolean {
  if (visibleIds.length === 0) return false;
  const selectedSet = new Set(selectedIds);
  return visibleIds.every((id) => selectedSet.has(id));
}

export function toggleSelectAllVisible(selectedIds: string[], visibleIds: string[]): string[] {
  if (visibleIds.length === 0) return selectedIds;
  const visibleSet = new Set(visibleIds);
  const allSelected = areAllVisibleSelected(selectedIds, visibleIds);
  if (allSelected) {
    return selectedIds.filter((id) => !visibleSet.has(id));
  }
  const merged = new Set(selectedIds);
  for (const id of visibleIds) {
    if (id) merged.add(id);
  }
  return Array.from(merged);
}

export function pruneStaleSelectedIds(selectedIds: string[], validIds: string[]): string[] {
  if (selectedIds.length === 0) return selectedIds;
  const validSet = new Set(validIds);
  return selectedIds.filter((id) => validSet.has(id));
}

export function chunkIdsForBatchDelete(ids: string[], chunkSize: number = 400): string[][] {
  const safeSize = Math.max(1, Math.floor(chunkSize));
  const uniqueIds: string[] = [];
  const seen = new Set<string>();
  for (const rawId of ids) {
    const id = typeof rawId === 'string' ? rawId.trim() : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    uniqueIds.push(id);
  }
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += safeSize) {
    chunks.push(uniqueIds.slice(i, i + safeSize));
  }
  return chunks;
}

export interface PartitionedKeySelection {
  primaryIds: string[];
  secondaryIds: string[];
}

export function partitionPrefixedKeys(
  selectedKeys: string[],
  primaryPrefix: string,
  secondaryPrefix: string
): PartitionedKeySelection {
  const primaryIds: string[] = [];
  const secondaryIds: string[] = [];
  for (const key of selectedKeys) {
    if (key.startsWith(primaryPrefix)) {
      const id = key.slice(primaryPrefix.length);
      if (id) primaryIds.push(id);
    } else if (key.startsWith(secondaryPrefix)) {
      const id = key.slice(secondaryPrefix.length);
      if (id) secondaryIds.push(id);
    }
  }
  return { primaryIds, secondaryIds };
}
