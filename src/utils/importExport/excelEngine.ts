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
  MODULE_SCHEMAS,
  buildCatalogLists,
  sanitizeCsvCell,
  type SchemaRuntimeContext,
} from './schemas';
import { resolveCatalogOptions } from '../catalogs/catalogRegistry';
import type { ParsedRowOrigin, ParsedWorkbookData } from './validator';
import {
  buildModuleSheetTabs,
  resolveSheetTabForRecord,
  sanitizeExcelSheetName,
} from './sheetGrouping';

const IGNORED_SYSTEM_SHEETS = new Set([
  'HUONG_DAN',
  'DANH_MUC',
  'HUONGDAN',
  'DANHMUC',
  'README',
  'GUIDE',
  'TONG_QUAN',
  'LOI_CHI_TIET',
]);

function getKnownExtraSheetNames(): Set<string> {
  const names = new Set<string>();
  for (const schema of Object.values(MODULE_SCHEMAS)) {
    for (const extra of schema.extraSheets || []) {
      names.add(extra.sheetName.toUpperCase());
    }
  }
  return names;
}

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
    if (resolved.length > 0) {
      return Array.from(new Set(resolved.map((o) => o.value)));
    }
  }
  if (field.options && field.options.length > 0) {
    return Array.from(new Set(field.options));
  }
  if (field.lookupCatalog) {
    return Array.from(new Set(catalogs[field.lookupCatalog] || []));
  }
  if (field.type === 'boolean') {
    return ['Có', 'Không'];
  }
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

interface DropdownColumnRegistration {
  colLetter: string;
  title: string;
  values: string[];
  required?: boolean;
  formulaRef: string;
}

function attachDropdownValidations(
  ws: ExcelJS.Worksheet,
  fields: SchemaFieldDef[],
  dropdownByKey: Map<string, DropdownColumnRegistration>,
  maxRowCount: number = 200
): void {
  fields.forEach((field, idx) => {
    const reg = dropdownByKey.get(field.key);
    if (!reg || reg.values.length === 0) return;
    const dataColLetter = toExcelColLetter(idx + 1);
    for (let r = 2; r <= maxRowCount; r++) {
      ws.getCell(`${dataColLetter}${r}`).dataValidation = {
        type: 'list',
        allowBlank: !field.required,
        formulae: [reg.formulaRef],
        showErrorMessage: true,
        errorTitle: 'Giá trị không nằm trong danh mục',
        error: `Vui lòng chọn giá trị hợp lệ từ danh sách "${field.label}".`,
      };
    }
  });
}

function buildDanhMucSheet(
  wb: ExcelJS.Workbook,
  fieldGroups: Array<{ prefix?: string; fields: SchemaFieldDef[] }>,
  catalogs: Record<CatalogKey, string[]>,
  context: SchemaRuntimeContext
): Map<string, DropdownColumnRegistration> {
  const dictSheet = wb.addWorksheet('DANH_MUC', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const registry = new Map<string, DropdownColumnRegistration>();
  const orderedCols: Array<{ mapKey: string; reg: DropdownColumnRegistration }> = [];

  for (const grp of fieldGroups) {
    for (const field of grp.fields) {
      const mapKey = grp.prefix ? `${grp.prefix}::${field.key}` : field.key;
      if (registry.has(mapKey)) continue;
      const values = getFieldDropdownOptions(field, catalogs, context);
      if (values.length === 0) continue;
      const colIdx = orderedCols.length + 1;
      const colLetter = toExcelColLetter(colIdx);
      const endRow = Math.max(2, values.length + 1);
      const reg: DropdownColumnRegistration = {
        colLetter,
        title: field.label,
        values,
        required: field.required,
        formulaRef: `=DANH_MUC!$${colLetter}$2:$${colLetter}$${endRow}`,
      };
      registry.set(mapKey, reg);
      orderedCols.push({ mapKey, reg });
    }
  }

  if (orderedCols.length === 0) {
    dictSheet.getCell('A1').value = 'Danh mục tham chiếu';
    dictSheet.getCell('A2').value = '(Không yêu cầu danh mục cố định)';
  } else {
    orderedCols.forEach(({ reg }, cIdx) => {
      const colNum = cIdx + 1;
      dictSheet.getColumn(colNum).width = Math.max(20, reg.title.length + 6);
      dictSheet.getCell(1, colNum).value = reg.title;
      reg.values.forEach((v, rIdx) => {
        dictSheet.getCell(rIdx + 2, colNum).value = v;
      });
    });
    styleHeaderRow(
      dictSheet.getRow(1),
      orderedCols.map(() => false)
    );
  }

  return registry;
}

export async function generateTemplateWorkbookBuffer(
  schema: ImportModuleSchema,
  context: SchemaRuntimeContext = {}
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SchoolHub Data Engine';
  wb.created = new Date();

  const catalogs = buildCatalogLists(context);
  const tabSpecs = buildModuleSheetTabs(schema, context);

  // Build DANH_MUC registrations across main fields + all extraSheets
  const dropdownFieldsInput: Array<{ prefix?: string; fields: SchemaFieldDef[] }> = [
    { fields: schema.fields },
    ...(schema.extraSheets || []).map((ex) => ({ prefix: ex.sheetName, fields: ex.fields })),
  ];

  // Create grouped Data Sheet Tabs first so users land directly on structured data tabs
  const dataWorksheets: ExcelJS.Worksheet[] = [];
  for (const tab of tabSpecs) {
    const ws = wb.addWorksheet(tab.sheetName, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    ws.columns = schema.fields.map((f) => ({
      header: f.header,
      key: f.key,
      width: f.width || 20,
      style: {
        font: { name: 'Segoe UI', size: 10 },
        numFmt: f.type === 'date' ? 'yyyy-mm-dd' : f.type === 'phone' ? '@' : undefined,
      },
    }));
    styleHeaderRow(
      ws.getRow(1),
      schema.fields.map((f) => Boolean(f.required))
    );
    if (schema.fields.length > 0) {
      ws.autoFilter = `A1:${toExcelColLetter(schema.fields.length)}1`;
    }
    dataWorksheets.push(ws);
  }

  // Sheet HUONG_DAN (Template metadata + field guide + Sheet Tab Directory — zero fake PII)
  const guideSheet = wb.addWorksheet('HUONG_DAN', {
    views: [{ state: 'frozen', ySplit: 7 }],
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
    `Các sheet dữ liệu (${tabSpecs.map((t) => t.sheetName).join(', ')}): Điền dữ liệu từ dòng 2; Không đổi tên tiêu đề cột ở dòng 1; Chọn giá trị từ Drop-down list có sẵn (liên kết sheet DANH_MUC). Hệ thống tự động gộp toàn bộ sheet hợp lệ khi tải lên.`;
  guideSheet.getCell('A3').font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF334155' } };
  guideSheet.getCell('A3').alignment = { wrapText: true };
  guideSheet.getRow(3).height = 32;

  if (schema.migrationWarning) {
    guideSheet.mergeCells('A4:G4');
    guideSheet.getCell('A4').value = `CẢNH BÁO NGHIỆP VỤ: ${schema.migrationWarning}`;
    guideSheet.getCell('A4').font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFB45309' } };
  }

  const guideHeaders = [
    'Tên cột',
    'Nhóm trường',
    'Bắt buộc',
    'Kiểu dữ liệu',
    'Định dạng chuẩn',
    'Giá trị hợp lệ (Drop-down)',
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

  // Build DANH_MUC and attach Drop-down Validations to ALL Data Sheet Tabs
  const dropdownRegistry = buildDanhMucSheet(wb, dropdownFieldsInput, catalogs, context);
  const mainDropdownMap = new Map<string, DropdownColumnRegistration>();
  for (const f of schema.fields) {
    const reg = dropdownRegistry.get(f.key);
    if (reg) mainDropdownMap.set(f.key, reg);
  }
  for (const ws of dataWorksheets) {
    attachDropdownValidations(ws, schema.fields, mainDropdownMap, 200);
  }

  // Optional Extra Relational Sheets (e.g. PHU_HUYNH, CAU_HOI_KHAO_SAT) + dropdowns
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
      const extraMap = new Map<string, DropdownColumnRegistration>();
      for (const f of extra.fields) {
        const reg = dropdownRegistry.get(`${extra.sheetName}::${f.key}`);
        if (reg) extraMap.set(f.key, reg);
      }
      attachDropdownValidations(extraWs, extra.fields, extraMap, 200);
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
  const knownExtraNames = getKnownExtraSheetNames();

  const dataSheetNames = sheetNames.filter((name) => {
    const upper = name.toUpperCase();
    if (IGNORED_SYSTEM_SHEETS.has(upper)) return false;
    if (knownExtraNames.has(upper)) return false;
    return true;
  });

  if (dataSheetNames.length === 0) {
    throw new Error('File không chứa sheet dữ liệu hợp lệ.');
  }

  const dataSheetName = dataSheetNames[0];
  const sheetHeaders: Record<string, string[]> = {};
  const mergedHeaders: string[] = [];
  const seenHeadersLower = new Set<string>();
  const rows: Record<string, unknown>[] = [];
  const rowItems: ParsedRowOrigin[] = [];

  for (const sName of dataSheetNames) {
    const ws = workbook.Sheets[sName];
    if (!ws) continue;
    const headerMatrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: '',
    });
    const tabHeaders = Array.isArray(headerMatrix[0])
      ? headerMatrix[0].map((h) => String(h ?? '').trim()).filter(Boolean)
      : [];
    sheetHeaders[sName] = tabHeaders;
    for (const h of tabHeaders) {
      if (!seenHeadersLower.has(h.toLowerCase())) {
        seenHeadersLower.add(h.toLowerCase());
        mergedHeaders.push(h);
      }
    }

    const tabRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: '',
      raw: true,
    });
    tabRows.forEach((rowObj, idx) => {
      rows.push(rowObj);
      rowItems.push({
        sheetName: sName,
        rowNumber: idx + 2,
        row: rowObj,
      });
    });
  }

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

  // Parse relational extra sheets
  const extraSheets: Record<string, Record<string, unknown>[]> = {};
  for (const name of sheetNames) {
    const upper = name.toUpperCase();
    if (!knownExtraNames.has(upper)) continue;
    extraSheets[name] = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[name], {
      defval: '',
      raw: true,
    });
  }

  return {
    fileName,
    sheetNames,
    dataSheetName,
    dataSheetNames,
    headers: mergedHeaders,
    sheetHeaders,
    rows,
    rowItems,
    extraSheets,
    templateModuleFound,
    templateVersionFound,
  };
}

export async function exportRecordsToBuffer(
  schema: ImportModuleSchema,
  records: Record<string, unknown>[],
  options: ExportRequestOptions,
  context: SchemaRuntimeContext = {}
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

  const catalogs = buildCatalogLists(context);
  const plannedTabs = buildModuleSheetTabs(schema, context, records);

  // Route exported records into multi-sheet tabs
  const bucketMap = new Map<string, Record<string, unknown>[]>();
  const usedLower = new Set<string>();
  for (const t of plannedTabs) {
    bucketMap.set(t.sheetName, []);
    usedLower.add(t.sheetName.toLowerCase());
  }

  for (const rec of records) {
    const targetTab = resolveSheetTabForRecord(rec, plannedTabs);
    const arr = bucketMap.get(targetTab.sheetName) || [];
    arr.push(rec);
    bucketMap.set(targetTab.sheetName, arr);
  }

  // Keep tabs that contain records; if zero records exported, emit planned tabs
  const activeTabNames =
    records.length > 0
      ? plannedTabs.map((t) => t.sheetName).filter((n) => (bucketMap.get(n)?.length || 0) > 0)
      : plannedTabs.map((t) => t.sheetName);

  const exportTabs =
    activeTabNames.length > 0
      ? activeTabNames
      : [sanitizeExcelSheetName(plannedTabs[0]?.sheetName || 'DU_LIEU', usedLower)];

  const createdWorksheets: Array<{ ws: ExcelJS.Worksheet; rowCount: number }> = [];

  for (const tabName of exportTabs) {
    const tabRecords = bucketMap.get(tabName) || [];
    const ws = wb.addWorksheet(tabName, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    ws.columns = fieldsToUse.map((f) => ({
      header: getHeader(f),
      key: f.key,
      width: f.width || 20,
      style: {
        font: { name: 'Segoe UI', size: 10 },
        numFmt: f.type === 'date' ? 'yyyy-mm-dd' : f.type === 'phone' ? '@' : undefined,
      },
    }));

    styleHeaderRow(
      ws.getRow(1),
      fieldsToUse.map((f) => Boolean(options.templateCompatible && f.required))
    );

    for (const rec of tabRecords) {
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
      ws.autoFilter = `A1:${toExcelColLetter(fieldsToUse.length)}${Math.max(1, tabRecords.length + 1)}`;
    }
    createdWorksheets.push({ ws, rowCount: tabRecords.length });
  }

  // Add DANH_MUC + drop-down validations on all exported tabs
  const dropdownRegistry = buildDanhMucSheet(wb, [{ fields: fieldsToUse }], catalogs, context);
  const fieldDropdownMap = new Map<string, DropdownColumnRegistration>();
  for (const f of fieldsToUse) {
    const reg = dropdownRegistry.get(f.key);
    if (reg) fieldDropdownMap.set(f.key, reg);
  }
  for (const { ws, rowCount } of createdWorksheets) {
    attachDropdownValidations(ws, fieldsToUse, fieldDropdownMap, Math.max(200, rowCount + 50));
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
    { header: 'Sheet', key: 'sheetName', width: 18 },
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
