export interface ParsedSheetRange {
  sheetName?: string;
  startColLetters?: string;
  startRow: number;
  endColLetters?: string;
  endRow?: number;
}

/**
 * Parses an A1-notation range (e.g. "'HocSinh'!A5:Z100", "B3:K50", "'DATA'!A1:ZZ5000")
 * and returns the 1-based starting row index (defaults to 1 when omitted).
 */
export function parseRangeStartRow(rangeStr?: string | null): number {
  if (!rangeStr || typeof rangeStr !== 'string') return 1;
  const bangIdx = rangeStr.lastIndexOf('!');
  const cellPart = (bangIdx >= 0 ? rangeStr.slice(bangIdx + 1) : rangeStr).trim();
  if (!cellPart) return 1;

  const firstSegment = cellPart.split(':')[0]?.trim() || '';
  const match = firstSegment.match(/^\$?[A-Za-z]*\$?(\d+)$/);
  if (match && match[1]) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed >= 1) return parsed;
  }
  return 1;
}

/**
 * Extracts headers & data rows from Google Sheets values:batchGet output,
 * accounting accurately for custom A1 ranges whose startRow > 1 (e.g., A5:Z100).
 */
export function extractRangeHeaderAndRows(params: {
  allValues: unknown[][];
  formulaValues?: unknown[][];
  headerRow: number;
  rangeUsed?: string | null;
  explicitHeaderRowValues?: unknown[];
}): {
  headers: string[];
  rawRows: unknown[][];
  formulaRows: unknown[][];
  startRowOffset: number;
  effectiveDataStartRow: number;
} {
  const { allValues, formulaValues = [], headerRow, rangeUsed, explicitHeaderRowValues } = params;
  const safeHeaderRow = Math.max(1, Number(headerRow || 1));
  const startRowOffset = parseRangeStartRow(rangeUsed);

  if (explicitHeaderRowValues && startRowOffset > safeHeaderRow) {
    return {
      headers: explicitHeaderRowValues.map((h) => String(h ?? '').trim()),
      rawRows: allValues,
      formulaRows: formulaValues,
      startRowOffset,
      effectiveDataStartRow: startRowOffset,
    };
  }

  const relHeaderIdx = Math.max(0, safeHeaderRow - startRowOffset);
  const headerArr = allValues[relHeaderIdx] || [];
  const headers = headerArr.map((h) => String(h ?? '').trim());
  const rawRows = allValues.slice(relHeaderIdx + 1);
  const formulaRows = formulaValues.slice(relHeaderIdx + 1);

  return {
    headers,
    rawRows,
    formulaRows,
    startRowOffset,
    effectiveDataStartRow: startRowOffset + relHeaderIdx + 1,
  };
}
