import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import type {
  CatalogKey,
  ExportRequestOptions,
  ImportModuleSchema,
  ImportPreviewReport,
  SchemaFieldDef,
} from '../../types';
import {
  buildCatalogLists,
  sanitizeCsvCell,
  type SchemaRuntimeContext,
} from './schemas';
import { resolveCatalogOptions } from '../catalogs/catalogRegistry';
import type { ParsedWorkbookData } from './validator';

function toExcelColLetter(colIndex1Based: number): string {
  let n = colIndex1Based;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function getFieldDropdownOptions(
  field: SchemaFieldDef,
  catalogs: Record<CatalogKey, string[]>,
  context: SchemaRuntimeContext = {}
): string[] {
  if (field.catalogId || field.lookupCatalog) {
    const resolved = resolveCatalogOptions({
      catalogId: field.catalogId,
      lookupCatalog: field.lookupCatalog,
      staticOptions: field.options,
      includeInactive: false,
      runtime: context,
    });
    if (resolved.length > 0) return resolved.map((o) => o.value);
  }
  if (field.options && field.options.length > 0) return field.options;
  if (field.lookupCatalog) return catalogs[field.lookupCatalog] || [];
  return [];
}

function styleHeaderRow(row: ExcelJS.Row, requiredFlags: boolean[]): void {
  row.height = 28;
  row.eachCell((cell, colNumber) => {
    const isReq = requiredFlags[colNumber - 1];
    cell.font = {
      name: 'Segoe UI',
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isReq ? 'FF0F4C81' : 'FF334155' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF0284C7' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });
}

export async function generateTemplateWorkbookBuffer(
  schema: ImportModuleSchema,
  context: SchemaRuntimeContext = {}
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SchoolHub Data Engine';
  wb.created = new Date();

  const catalogs = buildCatalogLists(context);

  // 1. Sheet DATA (Clean headers, freeze top row, autofilter, widths, formats, data validations)
  const dataSheet = wb.addWorksheet('DATA', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  dataSheet.columns = schema.fields.map((f) => ({
    header: f.header,
    key: f.key,
    width: f.width || 20,
    style: {
      font: { name: 'Segoe UI', size: 10 },
      numFmt: f.type === 'date' ? 'yyyy-mm-dd' : f.type === 'phone' ? '@' : undefined,
    },
  }));

  styleHeaderRow(
    dataSheet.getRow(1),
    schema.fields.map((f) => Boolean(f.required))
  );

  if (schema.fields.length > 0) {
    const lastCol = toExcelColLetter(schema.fields.length);
    dataSheet.autoFilter = `A1:${lastCol}1`;
  }

  // 2. Sheet HUONG_DAN (Template metadata + field guide — zero fake PII)
  const guideSheet = wb.addWorksheet('HUONG_DAN', {
    views: [{ state: 'frozen', ySplit: 6 }],
  });

  guideSheet.mergeCells('A1:G1');
  guideSheet.getCell('A1').value = `HƯỚNG DẪN NHẬP DỮ LIỆU — ${schema.title.toUpperCase()}`;
  guideSheet.getCell('A1').font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF0F4C81' } };

  guideSheet.getCell('A2').value = 'MODULE_KEY';
  guideSheet.getCell('B2').value = schema.key;
  guideSheet.getCell('C2').value = 'TEMPLATE_VERSION';
  guideSheet.getCell('D2').value = schema.version;
  guideSheet.getCell('E2').value = 'NGAY_TAO_MAU';
  guideSheet.getCell('F2').value = new Date().toISOString().split('T')[0];

  guideSheet.mergeCells('A3:G3');
  guideSheet.getCell('A3').value =
    'Quy trình: (1) Điền dữ liệu vào sheet DATA từ dòng 2 trở đi; (2) Không đổi tên tiêu đề cột ở dòng 1; (3) Chọn giá trị danh mục từ dropdown hoặc sheet DANH_MUC; (4) Tải file lên SchoolHub để kiểm tra và xem trước trước khi lưu.';
  guideSheet.getCell('A3').font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF334155' } };
  guideSheet.getCell('A3').alignment = { wrapText: true };
  guideSheet.getRow(3).height = 30;

  if (schema.migrationWarning) {
    guideSheet.mergeCells('A4:G4');
    guideSheet.getCell('A4').value = `CẢNH BÁO NGHIỆP VỤ: ${schema.migrationWarning}`;
    guideSheet.getCell('A4').font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFB45309' } };
  }

  const guideHeaders = [
    'Tên cột (Sheet DATA)',
    'Nhóm trường',
    'Bắt buộc',
    'Kiểu dữ liệu',
    'Định dạng chuẩn',
    'Giá trị hợp lệ',
    'Ví dụ định dạng',
  ];
  const guideHeaderRow = guideSheet.getRow(6);
  guideHeaders.forEach((h, i) => {
    guideHeaderRow.getCell(i + 1).value = h;
  });
  styleHeaderRow(guideHeaderRow, [true, false, false, false, false, false, false]);

  guideSheet.columns = [
    { width: 26 },
    { width: 22 },
    { width: 12 },
    { width: 14 },
    { width: 24 },
    { width: 34 },
    { width: 28 },
  ];

  schema.fields.forEach((field, idx) => {
    const row = guideSheet.getRow(7 + idx);
    const validOptions = getFieldDropdownOptions(field, catalogs, context);
    row.values = [
      field.header,
      field.group,
      field.required ? 'Bắt buộc (*)' : 'Tùy chọn',
      field.type,
      field.formatHint,
      validOptions.length > 0 ? validOptions.slice(0, 12).join(', ') : field.description,
      field.exampleFormat,
    ];
    row.eachCell((cell) => {
      cell.font = { name: 'Segoe UI', size: 10 };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  // 3. Sheet DANH_MUC (Dynamic lists + Excel Data Validation dropdown links)
  const dictSheet = wb.addWorksheet('DANH_MUC', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const dropdownColumns: { fieldIndex: number; colLetter: string; title: string; values: string[] }[] = [];
  schema.fields.forEach((field, idx) => {
    const values = getFieldDropdownOptions(field, catalogs, context);
    if (values.length > 0) {
      const colIdx = dropdownColumns.length + 1;
      dropdownColumns.push({
        fieldIndex: idx,
        colLetter: toExcelColLetter(colIdx),
        title: field.label,
        values,
      });
    }
  });

  if (dropdownColumns.length === 0) {
    dictSheet.getCell('A1').value = 'Danh mục tham chiếu';
    dictSheet.getCell('A2').value = '(Không yêu cầu danh mục cố định)';
  } else {
    dropdownColumns.forEach((col, cIdx) => {
      const colNum = cIdx + 1;
      dictSheet.getColumn(colNum).width = 24;
      dictSheet.getCell(1, colNum).value = col.title;
      col.values.forEach((v, rIdx) => {
        dictSheet.getCell(rIdx + 2, colNum).value = v;
      });

      // Attach Excel Data Validation dropdown to rows 2..300 in DATA sheet
      const dataColLetter = toExcelColLetter(col.fieldIndex + 1);
      const endRow = Math.max(2, col.values.length + 1);
      const formulaRef = `=DANH_MUC!$${col.colLetter}$2:$${col.colLetter}$${endRow}`;
      for (let r = 2; r <= 200; r++) {
        dataSheet.getCell(`${dataColLetter}${r}`).dataValidation = {
          type: 'list',
          allowBlank: !schema.fields[col.fieldIndex].required,
          formulae: [formulaRef],
          showErrorMessage: true,
          errorTitle: 'Giá trị không nằm trong danh mục',
          error: `Vui lòng chọn giá trị hợp lệ từ danh sách "${col.title}".`,
        };
      }
    });
    styleHeaderRow(
      dictSheet.getRow(1),
      dropdownColumns.map(() => false)
    );
  }

  // 4. Optional Extra Relational Sheets (e.g. PHU_HUYNH, CAU_HOI_KHAO_SAT)
  if (schema.extraSheets && schema.extraSheets.length > 0) {
    for (const extra of schema.extraSheets) {
      const extraWs = wb.addWorksheet(extra.sheetName, {
        views: [{ state: 'frozen', ySplit: 1 }],
      });
      extraWs.columns = extra.fields.map((f) => ({
        header: f.header,
        key: f.key,
        width: f.width || 22,
      }));
      styleHeaderRow(
        extraWs.getRow(1),
        extra.fields.map((f) => Boolean(f.required))
      );
      if (extra.fields.length > 0) {
        extraWs.autoFilter = `A1:${toExcelColLetter(extra.fields.length)}1`;
      }
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

export async function parseUploadedSpreadsheet(
  input: File | ArrayBuffer | Uint8Array,
  fileNameOverride?: string
): Promise<ParsedWorkbookData> {
  let bytes: Uint8Array;
  let fileName = fileNameOverride || 'upload.xlsx';

  if (input instanceof Uint8Array) {
    bytes = input;
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else {
    fileName = (input as File).name || fileName;
    const ab = await (input as File).arrayBuffer();
    bytes = new Uint8Array(ab);
  }

  const isCsv = fileName.toLowerCase().endsWith('.csv');
  const workbook = isCsv
    ? XLSX.read(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), { type: 'string' })
    : XLSX.read(bytes, { type: 'array' });

  const sheetNames = workbook.SheetNames || [];
  const dataSheetName =
    sheetNames.find((n) => n.toUpperCase() === 'DATA') ||
    sheetNames.find((n) => n.toUpperCase() !== 'HUONG_DAN' && n.toUpperCase() !== 'DANH_MUC') ||
    sheetNames[0];

  if (!dataSheetName) {
    throw new Error('File không chứa sheet dữ liệu hợp lệ.');
  }

  const dataWs = workbook.Sheets[dataSheetName];
  const headerMatrix = XLSX.utils.sheet_to_json<unknown[]>(dataWs, {
    header: 1,
    defval: '',
  });
  const rawHeaders = Array.isArray(headerMatrix[0])
    ? headerMatrix[0].map((h) => String(h ?? '').trim()).filter(Boolean)
    : [];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(dataWs, {
    defval: '',
    raw: true,
  });

  // Check HUONG_DAN metadata (MODULE_KEY & TEMPLATE_VERSION)
  let templateModuleFound: string | undefined;
  let templateVersionFound: string | undefined;
  const guideName = sheetNames.find((n) => n.toUpperCase() === 'HUONG_DAN');
  if (guideName) {
    const guideRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[guideName], {
      header: 1,
      defval: '',
    });
    for (const r of guideRows.slice(0, 6)) {
      if (!Array.isArray(r)) continue;
      for (let i = 0; i < r.length - 1; i++) {
        const key = String(r[i] ?? '').trim().toUpperCase();
        const val = String(r[i + 1] ?? '').trim();
        if (key === 'MODULE_KEY' && val) templateModuleFound = val;
        if (key === 'TEMPLATE_VERSION' && val) templateVersionFound = val;
      }
    }
  }

  // Parse extra sheets
  const extraSheets: Record<string, Record<string, unknown>[]> = {};
  for (const name of sheetNames) {
    const upper = name.toUpperCase();
    if (upper === dataSheetName.toUpperCase() || upper === 'HUONG_DAN' || upper === 'DANH_MUC') {
      continue;
    }
    extraSheets[name] = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[name], {
      defval: '',
      raw: true,
    });
  }

  return {
    fileName,
    sheetNames,
    dataSheetName,
    headers: rawHeaders,
    rows,
    extraSheets,
    templateModuleFound,
    templateVersionFound,
  };
}

export async function exportRecordsToBuffer(
  schema: ImportModuleSchema,
  records: Record<string, unknown>[],
  options: ExportRequestOptions
): Promise<Uint8Array> {
  const chosenFields = schema.fields.filter(
    (f) => !f.sensitive && options.selectedFieldKeys.includes(f.key)
  );
  const fieldsToUse = chosenFields.length > 0 ? chosenFields : schema.fields.filter((f) => !f.sensitive);

  const getHeader = (f: SchemaFieldDef) => (options.templateCompatible ? f.header : f.label);

  const mapCellValue = (rec: Record<string, unknown>, f: SchemaFieldDef): unknown => {
    const raw = rec[f.key];
    if (f.key === 'scoreRegularText' && Array.isArray(rec.scoreRegular)) {
      return (rec.scoreRegular as number[]).join(', ');
    }
    if (f.key === 'assignedClasses' && Array.isArray(raw)) {
      return raw.join(', ');
    }
    if (f.key === 'bookRef') {
      return rec.bookId || '';
    }
    if (f.key === 'isAnonymous') {
      return raw === true || raw === 'Có' ? 'Có' : 'Không';
    }
    if (Array.isArray(raw)) return raw.join(', ');
    return raw ?? '';
  };

  if (options.format === 'csv') {
    const headerLine = fieldsToUse.map((f) => sanitizeCsvCell(getHeader(f))).join(',');
    const bodyLines = records.map((rec) =>
      fieldsToUse.map((f) => sanitizeCsvCell(mapCellValue(rec, f))).join(',')
    );
    const csvContent = '\uFEFF' + [headerLine, ...bodyLines].join('\r\n');
    return new TextEncoder().encode(csvContent);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'SchoolHub Export Engine';
  wb.created = new Date();

  const sheetName = options.templateCompatible ? 'DATA' : 'DU_LIEU';
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ws.columns = fieldsToUse.map((f) => ({
    header: getHeader(f),
    key: f.key,
    width: f.width || 20,
  }));

  styleHeaderRow(
    ws.getRow(1),
    fieldsToUse.map((f) => Boolean(options.templateCompatible && f.required))
  );

  for (const rec of records) {
    const rowObj: Record<string, unknown> = {};
    for (const f of fieldsToUse) {
      rowObj[f.key] = mapCellValue(rec, f);
    }
    const addedRow = ws.addRow(rowObj);
    addedRow.eachCell((cell) => {
      cell.font = { name: 'Segoe UI', size: 10 };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } },
      };
    });
  }

  if (fieldsToUse.length > 0) {
    ws.autoFilter = `A1:${toExcelColLetter(fieldsToUse.length)}${Math.max(1, records.length + 1)}`;
  }

  if (options.templateCompatible) {
    const metaWs = wb.addWorksheet('HUONG_DAN');
    metaWs.getCell('A1').value = 'MODULE_KEY';
    metaWs.getCell('B1').value = schema.key;
    metaWs.getCell('A2').value = 'TEMPLATE_VERSION';
    metaWs.getCell('B2').value = schema.version;
    metaWs.getCell('A3').value = 'EXPORTED_AT';
    metaWs.getCell('B3').value = new Date().toISOString();
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

export async function generateErrorReportBuffer(report: ImportPreviewReport): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SchoolHub Import Validation';

  const summaryWs = wb.addWorksheet('TONG_QUAN');
  summaryWs.columns = [{ width: 28 }, { width: 42 }];
  summaryWs.addRows([
    ['Tệp tải lên', report.fileName],
    ['Phân hệ', report.schemaKey],
    ['Tổng số dòng kiểm tra', report.totalRows],
    ['Hợp lệ (Thêm mới)', report.validCreateCount],
    ['Hợp lệ (Cập nhật)', report.validUpdateCount],
    ['Lỗi dữ liệu', report.invalidCount],
    ['Trùng lặp', report.duplicateCount],
    ['Cảnh báo', report.warningCount],
  ]);

  const errWs = wb.addWorksheet('LOI_CHI_TIET', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  errWs.columns = [
    { header: 'Dòng Excel', key: 'rowNumber', width: 12 },
    { header: 'Sheet', key: 'sheetName', width: 14 },
    { header: 'Cột / Trường', key: 'header', width: 24 },
    { header: 'Giá trị nhập', key: 'value', width: 24 },
    { header: 'Mức độ', key: 'severity', width: 12 },
    { header: 'Mô tả chi tiết', key: 'message', width: 48 },
  ];
  styleHeaderRow(errWs.getRow(1), [true, false, true, false, false, true]);

  for (const row of report.rows) {
    for (const issue of row.issues) {
      errWs.addRow({
        rowNumber: issue.rowNumber,
        sheetName: issue.sheetName,
        header: issue.header,
        value: issue.value,
        severity: issue.severity === 'error' ? 'Lỗi' : 'Cảnh báo',
        message: issue.message,
      });
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

export function triggerBinaryDownload(bytes: Uint8Array, fileName: string, mimeType: string): void {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
