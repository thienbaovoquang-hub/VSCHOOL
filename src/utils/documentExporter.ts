import mammoth from 'mammoth';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type {
  Competition,
  CompetitionAward,
  CompetitionCriterion,
  EmulationRecord,
  ImportModuleSchema,
  RuleCriterion,
  RuleVersion,
  SchemaFieldDef,
} from '../types';
import type { ParsedWorkbookData } from './importExport/validator';
import type {
  ClassEmulationSummary,
  CompetitionLeaderboardRow,
  StudentEmulationSummary,
} from './emulationRules';

let vfsInitialized = false;

function ensurePdfMakeReady(): any {
  const pm: any = (pdfMake as any)?.default || pdfMake;
  if (!vfsInitialized) {
    const vfs = (pdfFonts as any)?.pdfMake?.vfs || (pdfFonts as any)?.vfs || (pdfFonts as any)?.default || pdfFonts;
    if (vfs && typeof pm.addVirtualFileSystem === 'function') {
      pm.addVirtualFileSystem(vfs);
    } else if (vfs) {
      pm.vfs = vfs;
    }
    pm.fonts = {
      Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf',
      },
    };
    vfsInitialized = true;
  }
  return pm;
}

export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function extractTextFromDocxFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return (result.value || '').trim();
}

export function extractTableFromHtmlString(
  html: string,
  fileName: string = 'word_import.docx'
): ParsedWorkbookData {
  // Parse the largest HTML <table> without requiring browser DOM in pure Node unit tests
  const tableMatches = Array.from(html.matchAll(/<table[\s\S]*?<\/table>/gi));
  if (tableMatches.length === 0) {
    throw new Error(
      `Tệp Word "${fileName}" không chứa bảng dữ liệu (Table). Vui lòng chèn bảng có dòng tiêu đề cột ở hàng đầu tiên hoặc dùng tệp Excel.`
    );
  }

  const parseRows = (tableHtml: string): string[][] => {
    const trMatches = Array.from(tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi));
    return trMatches.map((tr) => {
      const cellMatches = Array.from(tr[1].matchAll(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi));
      return cellMatches.map((c) =>
        c[1]
          .replace(/<br\s*\/?>/gi, ' ')
          .replace(/<\/p>\s*<p[^>]*>/gi, ' ')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/&lt;/gi, '<')
          .replace(/&gt;/gi, '>')
          .replace(/&quot;/gi, '"')
          .replace(/&#39;/gi, "'")
          .replace(/\s+/g, ' ')
          .trim()
      );
    });
  };

  let bestMatrix: string[][] = [];
  for (const m of tableMatches) {
    const matrix = parseRows(m[0]).filter((r) => r.some((cell) => cell !== ''));
    if (matrix.length > bestMatrix.length) {
      bestMatrix = matrix;
    }
  }

  if (bestMatrix.length === 0) {
    throw new Error(`Bảng trong tệp Word "${fileName}" chưa có dữ liệu.`);
  }

  const headers = bestMatrix[0].map((h) => h.trim()).filter(Boolean);
  if (headers.length === 0) {
    throw new Error(`Bảng trong tệp Word "${fileName}" chưa có dòng tiêu đề cột.`);
  }

  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < bestMatrix.length; i++) {
    const cells = bestMatrix[i];
    const rowObj: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      rowObj[header] = cells[idx] ?? '';
    });
    rows.push(rowObj);
  }

  return {
    fileName,
    sheetNames: ['WORD_TABLE'],
    dataSheetName: 'WORD_TABLE',
    headers,
    rows,
    extraSheets: {},
  };
}

export async function parseWordDocxTable(
  input: File | ArrayBuffer | Uint8Array,
  fileNameOverride?: string
): Promise<ParsedWorkbookData> {
  let arrayBuffer: ArrayBuffer;
  let fileName = fileNameOverride || 'word_import.docx';
  if (input instanceof Uint8Array) {
    arrayBuffer = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer;
  } else if (input instanceof ArrayBuffer) {
    arrayBuffer = input;
  } else {
    fileName = (input as File).name || fileName;
    arrayBuffer = await (input as File).arrayBuffer();
  }

  const result = await mammoth.convertToHtml({ arrayBuffer });
  return extractTableFromHtmlString(result.value || '', fileName);
}

export async function readFileAsBase64(file: File): Promise<string> {
  const ab = await file.arrayBuffer();
  const bytes = new Uint8Array(ab);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/* ---------------- DOCX HELPERS ---------------- */
function makeCell(text: string, opts?: { bold?: boolean; header?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; widthPct?: number }): TableCell {
  return new TableCell({
    width: opts?.widthPct ? { size: opts.widthPct, type: WidthType.PERCENTAGE } : undefined,
    shading: opts?.header
      ? { type: ShadingType.SOLID, color: '0F4C81', fill: '0F4C81' }
      : undefined,
    margins: { top: 90, bottom: 90, left: 110, right: 110 },
    children: [
      new Paragraph({
        alignment: opts?.align ?? AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold: opts?.bold || opts?.header,
            size: opts?.header ? 20 : 19,
            font: 'Times New Roman',
            color: opts?.header ? 'FFFFFF' : '1E293B',
          }),
        ],
      }),
    ],
  });
}

function makeHeaderBlock(schoolName: string, docTitle: string, subtitle: string): Paragraph[] {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: `TRƯỜNG THPT / ĐƠN VỊ: ${schoolName.toUpperCase()}`,
          bold: true,
          size: 22,
          font: 'Times New Roman',
          color: '0F4C81',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
          bold: true,
          size: 20,
          font: 'Times New Roman',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 220 },
      children: [
        new TextRun({
          text: 'Độc lập - Tự do - Hạnh phúc',
          bold: true,
          underline: {},
          size: 20,
          font: 'Times New Roman',
        }),
      ],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: docTitle.toUpperCase(),
          bold: true,
          size: 28,
          font: 'Times New Roman',
          color: '0F172A',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: subtitle,
          italics: true,
          size: 20,
          font: 'Times New Roman',
          color: '475569',
        }),
      ],
    }),
  ];
}

function makeTableBorders() {
  return {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
    insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
  };
}

function makeSignatureBlock(leftRole: string, rightRole: string): Paragraph[] {
  const todayStr = new Date().toLocaleDateString('vi-VN');
  return [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 320, after: 120 },
      children: [
        new TextRun({
          text: `Ngày ${todayStr}`,
          italics: true,
          size: 20,
          font: 'Times New Roman',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: `     ${leftRole}`, bold: true, size: 20, font: 'Times New Roman' }),
        new TextRun({ text: `                                              ${rightRole}`, bold: true, size: 20, font: 'Times New Roman' }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '     (Ký và ghi rõ họ tên)', italics: true, size: 18, font: 'Times New Roman', color: '64748B' }),
        new TextRun({ text: '                                       (Ký, đóng dấu)', italics: true, size: 18, font: 'Times New Roman', color: '64748B' }),
      ],
    }),
  ];
}

/* ---------------- 1. EXPORT APPROVED RULES (.DOCX & .PDF) ---------------- */
export async function exportRulesToDocx(params: {
  schoolName: string;
  documentTitle: string;
  version?: RuleVersion;
  criteria: RuleCriterion[];
}): Promise<string> {
  const { schoolName, documentTitle, version, criteria } = params;
  const activeCriteria = criteria.filter((c) => c.status !== 'inactive');
  const subtitle = version
    ? `Phiên bản ${version.versionNumber} · Năm học ${version.academicYear} · Hiệu lực từ ${version.effectiveDate}`
    : `Ban hành kèm quy định nề nếp & thi đua học đường (${activeCriteria.length} tiêu chí)`;

  const rows = [
    new TableRow({
      tableHeader: true,
      children: [
        makeCell('STT', { header: true, align: AlignmentType.CENTER, widthPct: 6 }),
        makeCell('Mã tiêu chí', { header: true, widthPct: 14 }),
        makeCell('Nhóm nội quy', { header: true, widthPct: 18 }),
        makeCell('Nội dung tiêu chí', { header: true, widthPct: 32 }),
        makeCell('Loại', { header: true, align: AlignmentType.CENTER, widthPct: 10 }),
        makeCell('Điểm', { header: true, align: AlignmentType.CENTER, widthPct: 10 }),
        makeCell('Phạm vi', { header: true, align: AlignmentType.CENTER, widthPct: 10 }),
      ],
    }),
    ...activeCriteria.map((c, idx) =>
      new TableRow({
        children: [
          makeCell(String(idx + 1), { align: AlignmentType.CENTER }),
          makeCell(c.code),
          makeCell(c.categoryName),
          makeCell(`${c.name}${c.behavior && c.behavior !== c.name ? `\n(${c.behavior})` : ''}`),
          makeCell(c.type === 'achievement' ? 'Thành tích' : 'Vi phạm', { align: AlignmentType.CENTER }),
          makeCell(c.pointsSpecified && c.points !== null ? String(c.points) : 'Chưa gán điểm', {
            align: AlignmentType.CENTER,
            bold: true,
          }),
          makeCell(
            c.targetScope === 'class' ? 'Tập thể lớp' : c.targetScope === 'group' ? 'Tổ / Nhóm' : 'Cá nhân',
            { align: AlignmentType.CENTER }
          ),
        ],
      })
    ),
  ];

  const doc = new Document({
    sections: [
      {
        children: [
          ...makeHeaderBlock(schoolName, documentTitle || 'QUY ĐỊNH NỘI QUY & TIÊU CHÍ THI ĐUA', subtitle),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: makeTableBorders(),
            rows,
          }),
          ...makeSignatureBlock('NGƯỜI LẬP BIỂU', 'HIỆU TRƯỞNG / BAN GIÁM HIỆU'),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `Noi_Quy_Thi_Dua_${new Date().toISOString().split('T')[0]}.docx`;
  triggerBlobDownload(blob, fileName);
  return fileName;
}

export async function exportRulesToPdf(params: {
  schoolName: string;
  documentTitle: string;
  version?: RuleVersion;
  criteria: RuleCriterion[];
}): Promise<string> {
  const pm = ensurePdfMakeReady();
  const { schoolName, documentTitle, version, criteria } = params;
  const activeCriteria = criteria.filter((c) => c.status !== 'inactive');
  const subtitle = version
    ? `Phiên bản ${version.versionNumber} · Năm học ${version.academicYear} · Hiệu lực từ ${version.effectiveDate}`
    : `Tổng số ${activeCriteria.length} tiêu chí đang áp dụng`;

  const body = [
    [
      { text: 'STT', bold: true, color: '#ffffff', fillColor: '#0f4c81', alignment: 'center' },
      { text: 'Mã', bold: true, color: '#ffffff', fillColor: '#0f4c81' },
      { text: 'Nhóm', bold: true, color: '#ffffff', fillColor: '#0f4c81' },
      { text: 'Tiêu chí & Hành vi quy định', bold: true, color: '#ffffff', fillColor: '#0f4c81' },
      { text: 'Loại', bold: true, color: '#ffffff', fillColor: '#0f4c81', alignment: 'center' },
      { text: 'Điểm', bold: true, color: '#ffffff', fillColor: '#0f4c81', alignment: 'center' },
    ],
    ...activeCriteria.map((c, i) => [
      { text: String(i + 1), alignment: 'center' },
      c.code,
      c.categoryName,
      `${c.name}${c.behavior && c.behavior !== c.name ? `\n(${c.behavior})` : ''}`,
      { text: c.type === 'achievement' ? 'Thành tích' : 'Vi phạm', alignment: 'center' },
      {
        text: c.pointsSpecified && c.points !== null ? String(c.points) : 'Chưa gán',
        alignment: 'center',
        bold: true,
      },
    ]),
  ];

  const docDef = {
    pageSize: 'A4',
    pageMargins: [32, 36, 32, 36],
    defaultStyle: { font: 'Roboto', fontSize: 9.5, color: '#1e293b' },
    content: [
      { text: schoolName.toUpperCase(), bold: true, fontSize: 11, color: '#0f4c81', alignment: 'center' },
      { text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc', alignment: 'center', fontSize: 9.5, margin: [0, 3, 0, 10] },
      { text: (documentTitle || 'NỘI QUY & TIÊU CHÍ THI ĐUA').toUpperCase(), bold: true, fontSize: 14, alignment: 'center', margin: [0, 2, 0, 4] },
      { text: subtitle, italics: true, fontSize: 9.5, color: '#475569', alignment: 'center', margin: [0, 0, 0, 14] },
      {
        table: {
          headerRows: 1,
          widths: [26, 62, 85, '*', 56, 52],
          body,
        },
        layout: 'lightHorizontalLines',
      },
      {
        columns: [
          { text: 'NGƯỜI LẬP\n(Ký, ghi rõ họ tên)', alignment: 'center', bold: true, margin: [0, 22, 0, 0] },
          { text: 'BAN GIÁM HIỆU PHÊ DUYỆT\n(Ký, đóng dấu)', alignment: 'center', bold: true, margin: [0, 22, 0, 0] },
        ],
      },
    ],
  };

  const blob: Blob = await pm.createPdf(docDef).getBlob();
  const fileName = `Noi_Quy_Thi_Dua_${new Date().toISOString().split('T')[0]}.pdf`;
  triggerBlobDownload(blob, fileName);
  return fileName;
}

/* ---------------- 2. EXPORT EMULATION REPORT & RANKING (.DOCX & .PDF) ---------------- */
export async function exportEmulationReportToDocx(params: {
  schoolName: string;
  periodName: string;
  academicYear: string;
  classSummaries: ClassEmulationSummary[];
  studentSummaries: StudentEmulationSummary[];
  records: EmulationRecord[];
  summaryText?: string;
}): Promise<string> {
  const { schoolName, periodName, academicYear, classSummaries, studentSummaries, summaryText } = params;

  const classRows = [
    new TableRow({
      tableHeader: true,
      children: [
        makeCell('Hạng', { header: true, align: AlignmentType.CENTER, widthPct: 10 }),
        makeCell('Lớp', { header: true, widthPct: 18 }),
        makeCell('GV Chủ nhiệm', { header: true, widthPct: 24 }),
        makeCell('Cộng', { header: true, align: AlignmentType.CENTER, widthPct: 12 }),
        makeCell('Trừ', { header: true, align: AlignmentType.CENTER, widthPct: 12 }),
        makeCell('Tổng điểm', { header: true, align: AlignmentType.CENTER, widthPct: 12 }),
        makeCell('Danh hiệu', { header: true, widthPct: 12 }),
      ],
    }),
    ...classSummaries.map((c) =>
      new TableRow({
        children: [
          makeCell(String(c.rank), { align: AlignmentType.CENTER, bold: true }),
          makeCell(c.className, { bold: true }),
          makeCell(c.homeroomTeacherName || '—'),
          makeCell(`+${c.achievementPoints}`, { align: AlignmentType.CENTER }),
          makeCell(String(c.violationPoints), { align: AlignmentType.CENTER }),
          makeCell(String(c.totalScore), { align: AlignmentType.CENTER, bold: true }),
          makeCell(c.titleAwarded || '—'),
        ],
      })
    ),
  ];

  const topStudents = studentSummaries.slice(0, 30);
  const stuRows = [
    new TableRow({
      tableHeader: true,
      children: [
        makeCell('Hạng', { header: true, align: AlignmentType.CENTER, widthPct: 10 }),
        makeCell('Mã HS', { header: true, widthPct: 16 }),
        makeCell('Họ và tên', { header: true, widthPct: 28 }),
        makeCell('Lớp', { header: true, align: AlignmentType.CENTER, widthPct: 12 }),
        makeCell('Tổng điểm', { header: true, align: AlignmentType.CENTER, widthPct: 14 }),
        makeCell('Danh hiệu', { header: true, widthPct: 20 }),
      ],
    }),
    ...topStudents.map((s) =>
      new TableRow({
        children: [
          makeCell(String(s.rank), { align: AlignmentType.CENTER, bold: true }),
          makeCell(s.studentCode),
          makeCell(s.studentName),
          makeCell(s.className, { align: AlignmentType.CENTER }),
          makeCell(String(s.totalScore), { align: AlignmentType.CENTER, bold: true }),
          makeCell(s.titleAwarded || '—'),
        ],
      })
    ),
  ];

  const children: Array<Paragraph | Table> = [
    ...makeHeaderBlock(
      schoolName,
      `BIÊN BẢN & BÁO CÁO THI ĐUA (${periodName})`,
      `Năm học ${academicYear} · Tổng hợp từ dữ liệu đã xác minh`
    ),
  ];

  if (summaryText) {
    children.push(
      new Paragraph({
        spacing: { after: 180 },
        children: [
          new TextRun({ text: 'Nhận xét tổng quan:\n', bold: true, size: 21, font: 'Times New Roman' }),
          new TextRun({ text: summaryText, size: 20, font: 'Times New Roman' }),
        ],
      })
    );
  }

  children.push(
    new Paragraph({
      spacing: { before: 120, after: 100 },
      children: [new TextRun({ text: 'I. BẢNG XẾP HẠNG THI ĐUA TẬP THỂ LỚP', bold: true, size: 22, font: 'Times New Roman', color: '0F4C81' })],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: makeTableBorders(),
      rows: classRows,
    }),
    new Paragraph({
      spacing: { before: 240, after: 100 },
      children: [new TextRun({ text: 'II. BẢNG XẾP HẠNG CÁ NHÂN TIÊU BIỂU', bold: true, size: 22, font: 'Times New Roman', color: '0F4C81' })],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: makeTableBorders(),
      rows: stuRows,
    }),
    ...makeSignatureBlock('TRƯỞNG BAN THI ĐUA', 'HIỆU TRƯỞNG PHÊ DUYỆT')
  );

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const fileName = `Bao_Cao_Thi_Dua_${new Date().toISOString().split('T')[0]}.docx`;
  triggerBlobDownload(blob, fileName);
  return fileName;
}

export async function exportEmulationReportToPdf(params: {
  schoolName: string;
  periodName: string;
  academicYear: string;
  classSummaries: ClassEmulationSummary[];
  studentSummaries: StudentEmulationSummary[];
  summaryText?: string;
}): Promise<string> {
  const pm = ensurePdfMakeReady();
  const { schoolName, periodName, academicYear, classSummaries, studentSummaries, summaryText } = params;

  const classTableBody = [
    [
      { text: 'Hạng', bold: true, color: '#ffffff', fillColor: '#0f4c81', alignment: 'center' },
      { text: 'Lớp', bold: true, color: '#ffffff', fillColor: '#0f4c81' },
      { text: 'GV Chủ nhiệm', bold: true, color: '#ffffff', fillColor: '#0f4c81' },
      { text: 'Cộng', bold: true, color: '#ffffff', fillColor: '#0f4c81', alignment: 'center' },
      { text: 'Trừ', bold: true, color: '#ffffff', fillColor: '#0f4c81', alignment: 'center' },
      { text: 'Tổng điểm', bold: true, color: '#ffffff', fillColor: '#0f4c81', alignment: 'center' },
      { text: 'Danh hiệu', bold: true, color: '#ffffff', fillColor: '#0f4c81' },
    ],
    ...classSummaries.map((c) => [
      { text: String(c.rank), alignment: 'center', bold: true },
      { text: c.className, bold: true },
      c.homeroomTeacherName || '—',
      { text: `+${c.achievementPoints}`, alignment: 'center' },
      { text: String(c.violationPoints), alignment: 'center' },
      { text: String(c.totalScore), alignment: 'center', bold: true },
      c.titleAwarded || '—',
    ]),
  ];

  const studentTableBody = [
    [
      { text: 'Hạng', bold: true, color: '#ffffff', fillColor: '#0f4c81', alignment: 'center' },
      { text: 'Mã HS', bold: true, color: '#ffffff', fillColor: '#0f4c81' },
      { text: 'Họ và tên', bold: true, color: '#ffffff', fillColor: '#0f4c81' },
      { text: 'Lớp', bold: true, color: '#ffffff', fillColor: '#0f4c81', alignment: 'center' },
      { text: 'Tổng điểm', bold: true, color: '#ffffff', fillColor: '#0f4c81', alignment: 'center' },
      { text: 'Danh hiệu', bold: true, color: '#ffffff', fillColor: '#0f4c81' },
    ],
    ...studentSummaries.slice(0, 30).map((s) => [
      { text: String(s.rank), alignment: 'center', bold: true },
      s.studentCode,
      s.studentName,
      { text: s.className, alignment: 'center' },
      { text: String(s.totalScore), alignment: 'center', bold: true },
      s.titleAwarded || '—',
    ]),
  ];

  const content: any[] = [
    { text: schoolName.toUpperCase(), bold: true, fontSize: 11, color: '#0f4c81', alignment: 'center' },
    { text: `BÁO CÁO & BIÊN BẢN XẾP HẠNG THI ĐUA (${periodName})`.toUpperCase(), bold: true, fontSize: 14, alignment: 'center', margin: [0, 6, 0, 2] },
    { text: `Năm học ${academicYear}`, italics: true, fontSize: 9.5, color: '#475569', alignment: 'center', margin: [0, 0, 0, 12] },
  ];

  if (summaryText) {
    content.push({ text: 'Nhận xét tổng hợp:', bold: true, margin: [0, 0, 0, 3] });
    content.push({ text: summaryText, margin: [0, 0, 0, 12] });
  }

  content.push(
    { text: 'I. XẾP HẠNG THI ĐUA TẬP THỂ LỚP', bold: true, fontSize: 11, color: '#0f4c81', margin: [0, 4, 0, 6] },
    { table: { headerRows: 1, widths: [32, 48, '*', 42, 42, 54, 90], body: classTableBody }, layout: 'lightHorizontalLines' },
    { text: 'II. XẾP HẠNG THI ĐUA CÁ NHÂN TIÊU BIỂU', bold: true, fontSize: 11, color: '#0f4c81', margin: [0, 14, 0, 6] },
    { table: { headerRows: 1, widths: [32, 74, '*', 45, 54, 90], body: studentTableBody }, layout: 'lightHorizontalLines' },
    {
      columns: [
        { text: 'TRƯỞNG BAN THI ĐUA\n(Ký, ghi rõ họ tên)', alignment: 'center', bold: true, margin: [0, 22, 0, 0] },
        { text: 'BAN GIÁM HIỆU\n(Ký, đóng dấu)', alignment: 'center', bold: true, margin: [0, 22, 0, 0] },
      ],
    }
  );

  const blob: Blob = await pm
    .createPdf({
      pageSize: 'A4',
      pageMargins: [32, 36, 32, 36],
      defaultStyle: { font: 'Roboto', fontSize: 9.5, color: '#1e293b' },
      content,
    })
    .getBlob();
  const fileName = `Bao_Cao_Thi_Dua_${new Date().toISOString().split('T')[0]}.pdf`;
  triggerBlobDownload(blob, fileName);
  return fileName;
}

/* ---------------- 3. EXPORT COMPETITION REPORT (.DOCX & .PDF) ---------------- */
export async function exportCompetitionToDocx(params: {
  schoolName: string;
  competition: Competition;
  criteria: CompetitionCriterion[];
  leaderboard: CompetitionLeaderboardRow[];
  awards: CompetitionAward[];
}): Promise<string> {
  const { schoolName, competition, criteria, leaderboard, awards } = params;

  const boardRows = [
    new TableRow({
      tableHeader: true,
      children: [
        makeCell('Hạng', { header: true, align: AlignmentType.CENTER, widthPct: 10 }),
        makeCell('Đối tượng / Thí sinh', { header: true, widthPct: 34 }),
        makeCell('Lớp / Đơn vị', { header: true, widthPct: 18 }),
        makeCell('Tổng điểm', { header: true, align: AlignmentType.CENTER, widthPct: 16 }),
        makeCell('Giải thưởng / Danh hiệu', { header: true, widthPct: 22 }),
      ],
    }),
    ...leaderboard.map((row) => {
      const award = awards.find((a) => a.participantId === row.participantId);
      return new TableRow({
        children: [
          makeCell(String(row.rank), { align: AlignmentType.CENTER, bold: true }),
          makeCell(row.targetName, { bold: true }),
          makeCell(row.className || '—'),
          makeCell(String(row.totalPoints), { align: AlignmentType.CENTER, bold: true }),
          makeCell(award?.awardTitle || '—'),
        ],
      });
    }),
  ];

  const doc = new Document({
    sections: [
      {
        children: [
          ...makeHeaderBlock(
            schoolName,
            `BÁO CÁO KẾT QUẢ PHONG TRÀO: ${competition.name}`,
            `Mã: ${competition.code} · Thời gian: ${competition.startDate} đến ${competition.endDate} · ${criteria.length} tiêu chí chấm`
          ),
          new Paragraph({
            spacing: { after: 140 },
            children: [
              new TextRun({ text: 'Đơn vị tổ chức: ', bold: true, size: 20, font: 'Times New Roman' }),
              new TextRun({ text: `${competition.organizerName} (${competition.category})`, size: 20, font: 'Times New Roman' }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: makeTableBorders(),
            rows: boardRows,
          }),
          ...makeSignatureBlock('BAN TỔ CHỨC PHONG TRÀO', 'BAN GIÁM HIỆU'),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `Phong_Trao_${competition.code}_${new Date().toISOString().split('T')[0]}.docx`;
  triggerBlobDownload(blob, fileName);
  return fileName;
}

export async function exportCompetitionToPdf(params: {
  schoolName: string;
  competition: Competition;
  leaderboard: CompetitionLeaderboardRow[];
  awards: CompetitionAward[];
}): Promise<string> {
  const pm = ensurePdfMakeReady();
  const { schoolName, competition, leaderboard, awards } = params;

  const body = [
    [
      { text: 'Hạng', bold: true, color: '#ffffff', fillColor: '#0f4c81', alignment: 'center' },
      { text: 'Đối tượng / Thí sinh', bold: true, color: '#ffffff', fillColor: '#0f4c81' },
      { text: 'Lớp', bold: true, color: '#ffffff', fillColor: '#0f4c81' },
      { text: 'Tổng điểm', bold: true, color: '#ffffff', fillColor: '#0f4c81', alignment: 'center' },
      { text: 'Giải thưởng', bold: true, color: '#ffffff', fillColor: '#0f4c81' },
    ],
    ...leaderboard.map((row) => {
      const award = awards.find((a) => a.participantId === row.participantId);
      return [
        { text: String(row.rank), alignment: 'center', bold: true },
        row.targetName,
        row.className || '—',
        { text: String(row.totalPoints), alignment: 'center', bold: true },
        award?.awardTitle || '—',
      ];
    }),
  ];

  const blob: Blob = await pm
    .createPdf({
      pageSize: 'A4',
      pageMargins: [32, 36, 32, 36],
      defaultStyle: { font: 'Roboto', fontSize: 9.5, color: '#1e293b' },
      content: [
        { text: schoolName.toUpperCase(), bold: true, fontSize: 11, color: '#0f4c81', alignment: 'center' },
        { text: `KẾT QUẢ PHONG TRÀO: ${competition.name}`.toUpperCase(), bold: true, fontSize: 13.5, alignment: 'center', margin: [0, 6, 0, 3] },
        { text: `Mã: ${competition.code} · Thời gian: ${competition.startDate} - ${competition.endDate}`, italics: true, alignment: 'center', fontSize: 9.5, color: '#475569', margin: [0, 0, 0, 14] },
        { table: { headerRows: 1, widths: [35, '*', 64, 60, 110], body }, layout: 'lightHorizontalLines' },
        {
          columns: [
            { text: 'BAN TỔ CHỨC\n(Ký, ghi rõ họ tên)', alignment: 'center', bold: true, margin: [0, 22, 0, 0] },
            { text: 'BAN GIÁM HIỆU\n(Ký, đóng dấu)', alignment: 'center', bold: true, margin: [0, 22, 0, 0] },
          ],
        },
      ],
    })
    .getBlob();
  const fileName = `Phong_Trao_${competition.code}_${new Date().toISOString().split('T')[0]}.pdf`;
  triggerBlobDownload(blob, fileName);
  return fileName;
}

/* ---------------- 4. CERTIFICATES / GIẤY KHEN (.DOCX & .PDF) ---------------- */
export interface CertificateRecipient {
  recipientName: string;
  className?: string;
  achievementTitle: string;
  reason: string;
  issuedDate?: string;
}

export async function exportCertificatesToDocx(params: {
  schoolName: string;
  academicYear: string;
  recipients: CertificateRecipient[];
}): Promise<string> {
  const { schoolName, academicYear, recipients } = params;

  const sections = recipients.map((rec) => ({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', bold: true, size: 22, font: 'Times New Roman' }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 260 },
        children: [
          new TextRun({ text: 'Độc lập - Tự do - Hạnh phúc', bold: true, underline: {}, size: 20, font: 'Times New Roman' }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 140 },
        children: [
          new TextRun({ text: `HIỆU TRƯỞNG ${schoolName.toUpperCase()}`, bold: true, size: 24, font: 'Times New Roman', color: '0F4C81' }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 220 },
        children: [
          new TextRun({ text: 'GIẤY KHEN', bold: true, size: 52, font: 'Times New Roman', color: 'B45309' }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new TextRun({ text: 'Tặng thưởng: ', size: 24, font: 'Times New Roman' }),
          new TextRun({ text: rec.recipientName.toUpperCase(), bold: true, size: 28, font: 'Times New Roman', color: '0F172A' }),
        ],
      }),
      ...(rec.className
        ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 120 },
              children: [
                new TextRun({ text: `Lớp / Đơn vị: ${rec.className}`, italics: true, size: 22, font: 'Times New Roman', color: '334155' }),
              ],
            }),
          ]
        : []),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new TextRun({ text: `Đã đạt danh hiệu: `, size: 24, font: 'Times New Roman' }),
          new TextRun({ text: rec.achievementTitle, bold: true, size: 26, font: 'Times New Roman', color: '0F4C81' }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 260 },
        children: [
          new TextRun({ text: `${rec.reason} (Năm học ${academicYear})`, size: 21, font: 'Times New Roman', color: '475569' }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: `Ngày ${rec.issuedDate || new Date().toLocaleDateString('vi-VN')}`,
            italics: true,
            size: 20,
            font: 'Times New Roman',
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({ text: 'HIỆU TRƯỞNG PHÊ DUYỆT     ', bold: true, size: 22, font: 'Times New Roman' }),
        ],
      }),
    ],
  }));

  const doc = new Document({ sections });
  const blob = await Packer.toBlob(doc);
  const fileName = `Giay_Khen_${new Date().toISOString().split('T')[0]}.docx`;
  triggerBlobDownload(blob, fileName);
  return fileName;
}

export async function exportCertificatesToPdf(params: {
  schoolName: string;
  academicYear: string;
  recipients: CertificateRecipient[];
}): Promise<string> {
  const pm = ensurePdfMakeReady();
  const { schoolName, academicYear, recipients } = params;

  const pages: any[] = [];
  recipients.forEach((rec, idx) => {
    pages.push({
      stack: [
        { text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', bold: true, fontSize: 12, alignment: 'center', margin: [0, 12, 0, 2] },
        { text: 'Độc lập - Tự do - Hạnh phúc', bold: true, fontSize: 11, alignment: 'center', margin: [0, 0, 0, 18] },
        { text: `HIỆU TRƯỞNG ${schoolName.toUpperCase()}`, bold: true, fontSize: 14, color: '#0f4c81', alignment: 'center', margin: [0, 0, 0, 12] },
        { text: 'GIẤY KHEN', bold: true, fontSize: 32, color: '#b45309', alignment: 'center', margin: [0, 6, 0, 14] },
        {
          text: [
            { text: 'Trân trọng trao tặng: ', fontSize: 14 },
            { text: rec.recipientName.toUpperCase(), bold: true, fontSize: 17, color: '#0f172a' },
          ],
          alignment: 'center',
          margin: [0, 0, 0, 8],
        },
        ...(rec.className
          ? [{ text: `Đơn vị / Lớp: ${rec.className}`, italics: true, fontSize: 12.5, color: '#334155', alignment: 'center', margin: [0, 0, 0, 10] }]
          : []),
        {
          text: [
            { text: 'Đã đạt thành tích / Danh hiệu: ', fontSize: 13.5 },
            { text: rec.achievementTitle, bold: true, fontSize: 15, color: '#0f4c81' },
          ],
          alignment: 'center',
          margin: [0, 0, 0, 10],
        },
        { text: `${rec.reason} · Năm học ${academicYear}`, fontSize: 12, color: '#475569', alignment: 'center', margin: [0, 0, 0, 28] },
        {
          text: `Ngày ${rec.issuedDate || new Date().toLocaleDateString('vi-VN')}\nHIỆU TRƯỞNG PHÊ DUYỆT`,
          bold: true,
          fontSize: 12,
          alignment: 'right',
          margin: [0, 10, 40, 0],
        },
      ],
      ...(idx < recipients.length - 1 ? { pageBreak: 'after' } : {}),
    });
  });

  const blob: Blob = await pm
    .createPdf({
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [60, 50, 60, 50],
      defaultStyle: { font: 'Roboto', color: '#1e293b' },
      background: () => ({
        canvas: [
          { type: 'rect', x: 24, y: 24, w: 794, h: 547, lineWidth: 3, lineColor: '#b45309' },
          { type: 'rect', x: 32, y: 32, w: 778, h: 531, lineWidth: 1, lineColor: '#0f4c81' },
        ],
      }),
      content: pages,
    })
    .getBlob();
  const fileName = `Giay_Khen_${new Date().toISOString().split('T')[0]}.pdf`;
  triggerBlobDownload(blob, fileName);
  return fileName;
}

/* ---------------- 5. GENERIC MODULE TABULAR WORD (.DOCX) EXPORT ---------------- */
function formatModuleRecordCell(rec: Record<string, unknown>, f: SchemaFieldDef): string {
  const raw = rec[f.key];
  if (f.key === 'scoreRegularText' && Array.isArray(rec.scoreRegular)) {
    return (rec.scoreRegular as number[]).join(', ');
  }
  if (f.key === 'assignedClasses' && Array.isArray(raw)) {
    return raw.join(', ');
  }
  if (f.key === 'bookRef') {
    return String(rec.bookId || '');
  }
  if (f.key === 'isAnonymous') {
    return raw === true || raw === 'Có' ? 'Có' : 'Không';
  }
  if (Array.isArray(raw)) return raw.join(', ');
  if (raw === null || raw === undefined) return '';
  return String(raw);
}

export async function exportRecordsToDocx(params: {
  schoolName: string;
  schema: ImportModuleSchema;
  records: Record<string, unknown>[];
  selectedFieldKeys: string[];
  templateCompatible?: boolean;
  fileName?: string;
}): Promise<string> {
  const { schoolName, schema, records, selectedFieldKeys, templateCompatible = true } = params;
  const chosenFields = schema.fields.filter(
    (f) => !f.sensitive && selectedFieldKeys.includes(f.key)
  );
  const fieldsToUse =
    chosenFields.length > 0 ? chosenFields : schema.fields.filter((f) => !f.sensitive);

  const widthPct = Math.max(8, Math.floor(100 / Math.max(1, fieldsToUse.length)));
  const headerRow = new TableRow({
    tableHeader: true,
    children: fieldsToUse.map((f) =>
      makeCell(templateCompatible ? f.header : f.label, {
        header: true,
        align: AlignmentType.CENTER,
        widthPct,
      })
    ),
  });

  const dataRows = records.slice(0, 500).map(
    (rec) =>
      new TableRow({
        children: fieldsToUse.map((f) =>
          makeCell(formatModuleRecordCell(rec, f), { widthPct })
        ),
      })
  );

  const dateStr = new Date().toISOString().split('T')[0];
  const fileName =
    params.fileName ||
    `EXPORT_${schema.templateFileName.replace('_TEMPLATE.xlsx', '')}_${dateStr}.docx`;

  const doc = new Document({
    sections: [
      {
        children: [
          ...makeHeaderBlock(
            schoolName || 'Trường THPT SchoolHub',
            `DANH SÁCH ${schema.title.toUpperCase()}`,
            `Xuất ngày ${new Date().toLocaleDateString('vi-VN')} · Tổng số ${records.length} bản ghi`
          ),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: makeTableBorders(),
            rows: [headerRow, ...dataRows],
          }),
          ...makeSignatureBlock('NGƯỜI LẬP BIỂU', 'HIỆU TRƯỞNG PHÊ DUYỆT'),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  triggerBlobDownload(blob, fileName);
  return fileName;
}

export interface GenericDocSection {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: string[][];
}

export async function exportDocSectionsToDocx(params: {
  schoolName?: string;
  title: string;
  subtitle?: string;
  sections: GenericDocSection[];
  fileName?: string;
}): Promise<string> {
  const { schoolName = 'Trường THPT SchoolHub', title, subtitle, sections } = params;
  const children: Array<Paragraph | Table> = [
    ...makeHeaderBlock(
      schoolName,
      title,
      subtitle || `Xuất từ SchoolHub ngày ${new Date().toLocaleDateString('vi-VN')}`
    ),
  ];

  for (const sec of sections) {
    if (sec.heading) {
      children.push(
        new Paragraph({
          spacing: { before: 180, after: 80 },
          children: [
            new TextRun({
              text: sec.heading,
              bold: true,
              size: 22,
              font: 'Times New Roman',
              color: '0F4C81',
            }),
          ],
        })
      );
    }
    for (const p of sec.paragraphs || []) {
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: p, size: 20, font: 'Times New Roman' })],
        })
      );
    }
    for (const b of sec.bullets || []) {
      children.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: `• ${b}`, size: 20, font: 'Times New Roman' })],
        })
      );
    }
    if (sec.table && sec.table.length > 0) {
      const colCount = Math.max(1, sec.table[0]?.length || 1);
      const widthPct = Math.max(8, Math.floor(100 / colCount));
      const tableRows = sec.table.map((row, rowIdx) =>
        new TableRow({
          tableHeader: rowIdx === 0,
          children: row.map((cellText) =>
            makeCell(cellText ?? '', {
              header: rowIdx === 0,
              align: rowIdx === 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
              widthPct,
            })
          ),
        })
      );
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: makeTableBorders(),
          rows: tableRows,
        })
      );
    }
  }

  children.push(...makeSignatureBlock('NGƯỜI LẬP BÁO CÁO', 'BAN GIÁM HIỆU PHÊ DUYỆT'));

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const safeBase = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'Bao_Cao_SchoolHub';
  const fileName = params.fileName || `${safeBase}_${new Date().toISOString().split('T')[0]}.docx`;
  triggerBlobDownload(blob, fileName);
  return fileName;
}


