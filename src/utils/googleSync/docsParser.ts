import type { GoogleDocSectionDiff } from '../../types';

export interface ParsedGoogleDocSection {
  heading: string;
  level: number;
  paragraphs: string[];
  bullets: string[];
  tables: string[][][];
}

export interface ParsedGoogleDocResult {
  documentId: string;
  title: string;
  revisionId?: string;
  plainText: string;
  sections: ParsedGoogleDocSection[];
  wordCount: number;
  tableCount: number;
}

function readParagraphText(paragraph: any): string {
  const elements = Array.isArray(paragraph?.elements) ? paragraph.elements : [];
  return elements
    .map((el: any) => el?.textRun?.content || '')
    .join('')
    .replace(/\r/g, '')
    .trim();
}

function headingLevelFromStyle(namedStyle?: string): number {
  if (!namedStyle) return 0;
  if (namedStyle === 'TITLE') return 1;
  if (namedStyle === 'SUBTITLE') return 2;
  const match = namedStyle.match(/^HEADING_(\d)$/);
  return match ? Number(match[1]) : 0;
}

export function extractStructuredGoogleDoc(docJson: any): ParsedGoogleDocResult {
  const title = String(docJson?.title || 'Tài liệu Google Docs');
  const documentId = String(docJson?.documentId || '');
  const revisionId = docJson?.revisionId ? String(docJson.revisionId) : undefined;
  const content = Array.isArray(docJson?.body?.content) ? docJson.body.content : [];

  const sections: ParsedGoogleDocSection[] = [];
  let currentSection: ParsedGoogleDocSection = {
    heading: title,
    level: 1,
    paragraphs: [],
    bullets: [],
    tables: [],
  };

  const lines: string[] = [];
  let tableCount = 0;

  for (const block of content) {
    if (block?.paragraph) {
      const text = readParagraphText(block.paragraph);
      if (!text) continue;
      const namedStyle = block.paragraph?.paragraphStyle?.namedStyleType;
      const hLevel = headingLevelFromStyle(namedStyle);
      const isBullet = Boolean(block.paragraph?.bullet);

      if (hLevel > 0) {
        if (
          currentSection.paragraphs.length > 0 ||
          currentSection.bullets.length > 0 ||
          currentSection.tables.length > 0 ||
          sections.length > 0
        ) {
          sections.push(currentSection);
        }
        currentSection = {
          heading: text,
          level: hLevel,
          paragraphs: [],
          bullets: [],
          tables: [],
        };
        lines.push(`\n${'#'.repeat(Math.min(hLevel, 4))} ${text}`);
      } else if (isBullet) {
        currentSection.bullets.push(text);
        lines.push(`- ${text}`);
      } else {
        currentSection.paragraphs.push(text);
        lines.push(text);
      }
    } else if (block?.table) {
      tableCount += 1;
      const rows: string[][] = [];
      for (const tr of block.table.tableRows || []) {
        const rowCells: string[] = [];
        for (const tc of tr.tableCells || []) {
          const cellTexts: string[] = [];
          for (const inner of tc.content || []) {
            if (inner?.paragraph) {
              const t = readParagraphText(inner.paragraph);
              if (t) cellTexts.push(t);
            }
          }
          rowCells.push(cellTexts.join(' ').trim());
        }
        rows.push(rowCells);
        if (rowCells.some(Boolean)) {
          lines.push(`| ${rowCells.join(' | ')} |`);
        }
      }
      currentSection.tables.push(rows);
    }
  }

  if (
    currentSection.paragraphs.length > 0 ||
    currentSection.bullets.length > 0 ||
    currentSection.tables.length > 0 ||
    sections.length === 0
  ) {
    sections.push(currentSection);
  }

  const plainText = lines.join('\n').trim();
  const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;

  return {
    documentId,
    title,
    revisionId,
    plainText,
    sections,
    wordCount,
    tableCount,
  };
}

export function diffDocTexts(prevText: string, nextText: string): GoogleDocSectionDiff[] {
  const prevLines = prevText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const nextLines = nextText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const prevSet = new Set(prevLines);
  const nextSet = new Set(nextLines);
  const diffs: GoogleDocSectionDiff[] = [];

  for (const line of prevLines) {
    if (!nextSet.has(line)) {
      diffs.push({ type: 'removed', text: line });
    }
  }
  for (const line of nextLines) {
    if (!prevSet.has(line)) {
      diffs.push({ type: 'added', text: line });
    } else {
      diffs.push({ type: 'unchanged', text: line });
    }
  }
  return diffs;
}

export function extractTemplatePlaceholders(templateText: string): string[] {
  const matches = templateText.match(/\{\{([A-Z0-9_]+)\}\}/g) || [];
  return Array.from(new Set(matches));
}

export function interpolateReportTemplate(
  templateText: string,
  variables: Record<string, string | number>
): string {
  return templateText.replace(/\{\{([A-Z0-9_]+)\}\}/g, (full, key: string) => {
    if (key in variables && variables[key] !== undefined && variables[key] !== null) {
      return String(variables[key]);
    }
    return full;
  });
}
