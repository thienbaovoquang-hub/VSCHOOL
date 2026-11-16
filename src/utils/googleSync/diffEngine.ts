import type {
  FieldDiff,
  GoogleConflictField,
  GoogleConflictPolicy,
  GoogleDeletionPolicy,
  GooglePendingDeletion,
  GoogleSyncConflict,
  GoogleSyncDirection,
  ImportModuleKey,
  ImportModuleSchema,
} from '../../types';
import { getSchemaByKey } from '../importExport/schemas';
import { normalizeText } from '../importExport/validator';
import { getBusinessKeyFromRecord } from './sheetMapping';

export interface SyncedRecordSnapshotEntry {
  hash: string;
  updatedAt: string;
  fields: Record<string, string>;
}

export function computeCanonicalFieldMap(
  schema: ImportModuleSchema,
  record: Record<string, unknown>,
  mappedFieldKeys?: string[]
): Record<string, string> {
  const keysToCompare =
    mappedFieldKeys && mappedFieldKeys.length > 0
      ? mappedFieldKeys
      : schema.fields.filter((f) => !f.sensitive).map((f) => f.key);
  const out: Record<string, string> = {};
  for (const key of keysToCompare) {
    out[key] = normalizeText(record[key]);
  }
  return out;
}

export function hashFieldMap(fields: Record<string, string>): string {
  const entries = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([k, v]) => `${k}=${v}`).join('|');
}

export interface IncomingSyncRow {
  rowNumber: number;
  key: string;
  rawMappedByField: Record<string, unknown>;
  normalizedData: Record<string, unknown>;
  existingRecord?: Record<string, unknown>;
}

export interface PlannedRowUpdate {
  key: string;
  existingRecord: Record<string, unknown>;
  incomingNormalized: Record<string, unknown>;
  rawMappedByField: Record<string, unknown>;
  diffs: FieldDiff[];
}

export interface IncrementalSyncPlan {
  toCreate: IncomingSyncRow[];
  toUpdate: PlannedRowUpdate[];
  unchangedKeys: string[];
  conflicts: GoogleSyncConflict[];
  flaggedDeletions: GooglePendingDeletion[];
  autoDeleteIds: string[];
  nextSnapshotMap: Record<string, SyncedRecordSnapshotEntry>;
}

export function computeIncrementalSyncPlan(params: {
  sourceId: string;
  fileName: string;
  moduleKey: ImportModuleKey;
  primaryKeyField?: string;
  mappedFieldKeys: string[];
  incomingValidRows: IncomingSyncRow[];
  existingRecords: Record<string, unknown>[];
  lastSyncedMap?: Record<string, SyncedRecordSnapshotEntry>;
  conflictPolicy: GoogleConflictPolicy;
  deletionPolicy: GoogleDeletionPolicy;
  nowIso?: string;
}): IncrementalSyncPlan {
  const {
    sourceId,
    fileName,
    moduleKey,
    primaryKeyField,
    mappedFieldKeys,
    incomingValidRows,
    existingRecords,
    lastSyncedMap = {},
    conflictPolicy,
    deletionPolicy,
    nowIso = new Date().toISOString(),
  } = params;

  const schema = getSchemaByKey(moduleKey);
  const fieldLabelMap = new Map(schema.fields.map((f) => [f.key, f.label]));

  const toCreate: IncomingSyncRow[] = [];
  const toUpdate: PlannedRowUpdate[] = [];
  const unchangedKeys: string[] = [];
  const conflicts: GoogleSyncConflict[] = [];
  const flaggedDeletions: GooglePendingDeletion[] = [];
  const autoDeleteIds: string[] = [];
  const nextSnapshotMap: Record<string, SyncedRecordSnapshotEntry> = { ...lastSyncedMap };

  const seenIncomingKeys = new Set<string>();

  for (const row of incomingValidRows) {
    if (!row.key) continue;
    seenIncomingKeys.add(row.key);

    const sheetFields = computeCanonicalFieldMap(schema, row.normalizedData, mappedFieldKeys);
    const sheetHash = hashFieldMap(sheetFields);

    if (!row.existingRecord) {
      toCreate.push(row);
      nextSnapshotMap[row.key] = {
        hash: sheetHash,
        updatedAt: nowIso,
        fields: sheetFields,
      };
      continue;
    }

    const dbFields = computeCanonicalFieldMap(schema, row.existingRecord, mappedFieldKeys);
    const dbHash = hashFieldMap(dbFields);
    const baseline = lastSyncedMap[row.key];

    // If Sheet and DB already have identical values across mapped fields -> unchanged
    if (sheetHash === dbHash) {
      unchangedKeys.push(row.key);
      nextSnapshotMap[row.key] = {
        hash: dbHash,
        updatedAt: baseline?.updatedAt || nowIso,
        fields: dbFields,
      };
      continue;
    }

    // Detect concurrent conflict when we have a prior synced baseline and BOTH sides diverged from it
    const sheetChangedSinceBaseline = baseline ? baseline.hash !== sheetHash : true;
    const dbChangedSinceBaseline = baseline ? baseline.hash !== dbHash : false;

    const diffs: FieldDiff[] = [];
    const conflictingFields: GoogleConflictField[] = [];

    for (const key of mappedFieldKeys) {
      const sheetVal = sheetFields[key] ?? '';
      const dbVal = dbFields[key] ?? '';
      const baseVal = baseline?.fields?.[key] ?? '';
      const rawCell = normalizeText(row.rawMappedByField[key]);

      // Blank cell in Sheet never wipes existing DB field during partial update
      if (rawCell === '' && dbVal !== '') continue;
      if (sheetVal === dbVal) continue;

      const label = fieldLabelMap.get(key) || key;
      if (baseline && sheetVal !== baseVal && dbVal !== baseVal) {
        conflictingFields.push({
          field: key,
          label,
          schoolHubValue: dbVal || '(trống)',
          sheetValue: sheetVal || '(trống)',
        });
      }
      diffs.push({
        field: key,
        label,
        before: dbVal || '(trống)',
        after: sheetVal || '(trống)',
      });
    }

    if (
      conflictingFields.length > 0 &&
      sheetChangedSinceBaseline &&
      dbChangedSinceBaseline &&
      conflictPolicy === 'manual_review'
    ) {
      conflicts.push({
        id: `CNF-${sourceId}-${row.key}-${Date.now().toString(36)}`,
        sourceId,
        fileName,
        moduleKey,
        recordKey: row.key,
        recordLabel:
          normalizeText(
            row.existingRecord.fullName ||
              row.existingRecord.title ||
              row.existingRecord.name ||
              row.key
          ) || row.key,
        existingRecordId: String(row.existingRecord.id || row.key),
        schoolHubRecord: row.existingRecord,
        sheetNormalized: row.normalizedData,
        conflictingFields,
        status: 'pending',
        detectedAt: nowIso,
      });
      continue;
    }

    if (
      conflictingFields.length > 0 &&
      sheetChangedSinceBaseline &&
      dbChangedSinceBaseline &&
      conflictPolicy === 'schoolhub_wins'
    ) {
      unchangedKeys.push(row.key);
      nextSnapshotMap[row.key] = {
        hash: dbHash,
        updatedAt: nowIso,
        fields: dbFields,
      };
      continue;
    }

    if (diffs.length === 0) {
      unchangedKeys.push(row.key);
      continue;
    }

    toUpdate.push({
      key: row.key,
      existingRecord: row.existingRecord,
      incomingNormalized: row.normalizedData,
      rawMappedByField: row.rawMappedByField,
      diffs,
    });
    nextSnapshotMap[row.key] = {
      hash: sheetHash,
      updatedAt: nowIso,
      fields: sheetFields,
    };
  }

  // Detect records previously synced from this Sheet that have since been removed from Sheet
  if (deletionPolicy !== 'ignore') {
    for (const prevKey of Object.keys(lastSyncedMap)) {
      if (seenIncomingKeys.has(prevKey)) continue;
      const existingMatch = existingRecords.find(
        (rec) =>
          getBusinessKeyFromRecord(moduleKey, rec, primaryKeyField) === prevKey
      );
      if (!existingMatch) continue;
      const recId = String(existingMatch.id || prevKey);
      if (deletionPolicy === 'auto_delete') {
        autoDeleteIds.push(recId);
        delete nextSnapshotMap[prevKey];
      } else {
        flaggedDeletions.push({
          id: `DEL-${sourceId}-${prevKey}`,
          sourceId,
          fileName,
          moduleKey,
          recordKey: prevKey,
          recordId: recId,
          recordLabel:
            normalizeText(
              existingMatch.fullName ||
                existingMatch.title ||
                existingMatch.name ||
                prevKey
            ) || prevKey,
          status: 'pending_review',
          detectedAt: nowIso,
        });
      }
    }
  }

  return {
    toCreate,
    toUpdate,
    unchangedKeys,
    conflicts,
    flaggedDeletions,
    autoDeleteIds,
    nextSnapshotMap,
  };
}

export function resolveConflictRecord(
  conflict: GoogleSyncConflict,
  choice: 'schoolhub' | 'sheet' | 'custom',
  customValues?: Record<string, string>
): Record<string, unknown> {
  if (choice === 'schoolhub') {
    return { ...conflict.schoolHubRecord };
  }
  const next: Record<string, unknown> = { ...conflict.schoolHubRecord };
  for (const cf of conflict.conflictingFields) {
    if (choice === 'sheet') {
      next[cf.field] = conflict.sheetNormalized[cf.field];
    } else if (choice === 'custom' && customValues && cf.field in customValues) {
      next[cf.field] = customValues[cf.field];
    }
  }
  return next;
}

export interface SheetExportMatrixPlan {
  headers: string[];
  rows: (string | number | boolean)[][];
  preservedFormulaCellCount: number;
}

export function prepareSheetExportMatrix(params: {
  moduleKey: ImportModuleKey;
  records: Record<string, unknown>[];
  selectedFieldKeys: string[];
  existingSheetValues?: unknown[][];
  existingFormulaValues?: unknown[][];
  primaryKeyField?: string;
  direction?: GoogleSyncDirection;
}): SheetExportMatrixPlan {
  const {
    moduleKey,
    records,
    selectedFieldKeys,
    existingSheetValues,
    existingFormulaValues,
    primaryKeyField,
  } = params;

  const schema = getSchemaByKey(moduleKey);
  const fields = selectedFieldKeys
    .map((k) => schema.fields.find((f) => f.key === k))
    .filter((f): f is NonNullable<typeof f> => Boolean(f && !f.sensitive));

  // If updating an existing sheet incrementally, preserve existing column order & untouched formula cells
  if (existingSheetValues && existingSheetValues.length > 0) {
    const existingHeaders = (existingSheetValues[0] || []).map((h) => normalizeText(h));
    const finalHeaders = [...existingHeaders];
    const headerIndexByKey = new Map<string, number>();

    for (const f of fields) {
      const idx = finalHeaders.findIndex(
        (h) =>
          h.toLowerCase() === f.header.toLowerCase() ||
          h.toLowerCase() === f.key.toLowerCase() ||
          h.replace(/\*+$/, '').trim().toLowerCase() ===
            f.header.replace(/\*+$/, '').trim().toLowerCase()
      );
      if (idx >= 0) {
        headerIndexByKey.set(f.key, idx);
      } else {
        headerIndexByKey.set(f.key, finalHeaders.length);
        finalHeaders.push(f.header);
      }
    }

    const keyColIdx = primaryKeyField
      ? headerIndexByKey.get(primaryKeyField) ?? 0
      : headerIndexByKey.get(fields[0]?.key || '') ?? 0;

    // Build map from business key -> existing row index in data rows (1..n)
    const rowByKey = new Map<string, { rowIdx: number; cells: (string | number | boolean)[] }>();
    const outRows: (string | number | boolean)[][] = [];

    for (let r = 1; r < existingSheetValues.length; r++) {
      const existingRow = (existingSheetValues[r] || []).map((c) =>
        typeof c === 'number' || typeof c === 'boolean' ? c : normalizeText(c)
      );
      while (existingRow.length < finalHeaders.length) existingRow.push('');
      const keyVal = normalizeText(existingRow[keyColIdx]).toUpperCase();
      outRows.push(existingRow);
      if (keyVal) {
        rowByKey.set(keyVal, { rowIdx: r, cells: existingRow });
      }
    }

    let preservedFormulaCellCount = 0;

    for (const rec of records) {
      const recKey = getBusinessKeyFromRecord(moduleKey, rec, primaryKeyField);
      const matched = recKey ? rowByKey.get(recKey) : undefined;
      if (matched) {
        for (const f of fields) {
          const colIdx = headerIndexByKey.get(f.key);
          if (colIdx === undefined) continue;
          const existingFormula = existingFormulaValues?.[matched.rowIdx]?.[colIdx];
          if (typeof existingFormula === 'string' && existingFormula.trim().startsWith('=')) {
            matched.cells[colIdx] = existingFormula;
            preservedFormulaCellCount += 1;
            continue;
          }
          const rawVal = rec[f.key];
          matched.cells[colIdx] =
            typeof rawVal === 'number' || typeof rawVal === 'boolean'
              ? rawVal
              : Array.isArray(rawVal)
              ? rawVal.join(', ')
              : normalizeText(rawVal);
        }
      } else {
        const newRow: (string | number | boolean)[] = new Array(finalHeaders.length).fill('');
        for (const f of fields) {
          const colIdx = headerIndexByKey.get(f.key);
          if (colIdx === undefined) continue;
          const rawVal = rec[f.key];
          newRow[colIdx] =
            typeof rawVal === 'number' || typeof rawVal === 'boolean'
              ? rawVal
              : Array.isArray(rawVal)
              ? rawVal.join(', ')
              : normalizeText(rawVal);
        }
        outRows.push(newRow);
      }
    }

    return {
      headers: finalHeaders,
      rows: outRows,
      preservedFormulaCellCount,
    };
  }

  // Fresh export (Method A)
  const headers = fields.map((f) => f.header);
  const rows = records.map((rec) =>
    fields.map((f) => {
      const val = rec[f.key];
      if (typeof val === 'number' || typeof val === 'boolean') return val;
      if (Array.isArray(val)) return val.join(', ');
      return normalizeText(val);
    })
  );

  return {
    headers,
    rows,
    preservedFormulaCellCount: 0,
  };
}
