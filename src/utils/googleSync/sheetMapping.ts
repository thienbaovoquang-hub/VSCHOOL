import type {
  ColumnMappingRule,
  GoogleSyncRowError,
  ImportMode,
  ImportModuleKey,
  ImportModuleSchema,
  ImportPreviewReport,
  SchemaFieldDef,
  ValidatedImportRow,
  ValidationIssue,
} from '../../types';
import { buildCatalogLists, getFieldHeaderAliases, getSchemaByKey } from '../importExport/schemas';
import {
  normalizeCode,
  normalizeText,
  validateSingleField,
  type ValidationDbContext,
} from '../importExport/validator';
import {
  resolveCatalogOptions,
  validateDependentFieldValue,
} from '../catalogs/catalogRegistry';

export function stripVietnameseDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export function normalizeHeaderToken(header: string): string {
  return stripVietnameseDiacritics(header || '')
    .toLowerCase()
    .replace(/\*+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function detectPrimaryKeyField(schema: ImportModuleSchema): string {
  const uniqueField = schema.fields.find(
    (f) => f.uniqueKey && f.key !== 'fullName'
  );
  if (uniqueField) return uniqueField.key;

  const matchingPrimaryHeader = schema.fields.find(
    (f) =>
      normalizeHeaderToken(f.header) ===
      normalizeHeaderToken(schema.primaryKeyHeader)
  );
  if (matchingPrimaryHeader && matchingPrimaryHeader.key !== 'fullName') {
    return matchingPrimaryHeader.key;
  }

  // Fallback for schemas whose primary key is composite or named differently
  const nonNameRequired = schema.fields.find(
    (f) => f.required && f.key !== 'fullName'
  );
  return nonNameRequired?.key || schema.fields[0]?.key || 'id';
}

export function suggestColumnMappings(
  headers: string[],
  moduleKey: ImportModuleKey,
  aiSuggestions?: Record<string, string>
): ColumnMappingRule[] {
  const schema = getSchemaByKey(moduleKey);
  const usedTargets = new Set<string>();

  return headers.map((rawHeader, sheetColIndex) => {
    const header = normalizeText(rawHeader);
    const normHeader = normalizeHeaderToken(header);
    let matchedField: SchemaFieldDef | undefined;
    let confidence = 0;

    // 1. Check explicit AI suggestion if valid field key
    const aiKey = aiSuggestions?.[header];
    if (aiKey) {
      const f = schema.fields.find((x) => x.key === aiKey);
      if (f && !usedTargets.has(f.key)) {
        matchedField = f;
        confidence = 0.92;
      }
    }

    // 2. Exact key or exact header or alias match
    if (!matchedField && normHeader) {
      for (const field of schema.fields) {
        if (usedTargets.has(field.key)) continue;
        const aliases = [field.key, field.header, field.label, ...getFieldHeaderAliases(field)];
        for (const alias of aliases) {
          if (normalizeHeaderToken(alias) === normHeader) {
            matchedField = field;
            confidence = 1;
            break;
          }
        }
        if (matchedField) break;
      }
    }

    // 3. Token overlap fuzzy matching
    if (!matchedField && normHeader) {
      const headerTokens = new Set(normHeader.split(' ').filter(Boolean));
      let bestScore = 0;
      let bestCandidate: SchemaFieldDef | undefined;
      for (const field of schema.fields) {
        if (usedTargets.has(field.key)) continue;
        const labelTokens = normalizeHeaderToken(`${field.label} ${field.header}`).split(' ').filter(Boolean);
        if (labelTokens.length === 0) continue;
        const overlap = labelTokens.filter((t) => headerTokens.has(t)).length;
        const score = overlap / Math.max(headerTokens.size, labelTokens.length);
        if (score >= 0.5 && score > bestScore) {
          bestScore = score;
          bestCandidate = field;
        }
      }
      if (bestCandidate) {
        matchedField = bestCandidate;
        confidence = Number(bestScore.toFixed(2));
      }
    }

    if (matchedField) {
      usedTargets.add(matchedField.key);
      return {
        sheetColumn: header || `Cột ${sheetColIndex + 1}`,
        sheetColIndex,
        targetFieldKey: matchedField.key,
        required: matchedField.required,
        defaultValue: matchedField.defaultValue !== undefined ? String(matchedField.defaultValue) : undefined,
        ignored: false,
        confidence,
        formatHint: matchedField.formatHint,
      };
    }

    return {
      sheetColumn: header || `Cột ${sheetColIndex + 1}`,
      sheetColIndex,
      targetFieldKey: '',
      ignored: true,
      confidence: 0,
    };
  });
}

export interface FormulaProtectionMap {
  formulaColumns: string[];
  formulaCells: Array<{ rowIndex: number; colIndex: number; formula: string }>;
}

export function detectFormulaCells(
  formulaMatrix: unknown[][],
  headers: string[]
): FormulaProtectionMap {
  const formulaColSet = new Set<string>();
  const formulaCells: Array<{ rowIndex: number; colIndex: number; formula: string }> = [];

  for (let r = 0; r < formulaMatrix.length; r++) {
    const row = formulaMatrix[r] || [];
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (typeof cell === 'string' && cell.trim().startsWith('=')) {
        formulaCells.push({ rowIndex: r, colIndex: c, formula: cell.trim() });
        const colName = headers[c] || `Cột ${c + 1}`;
        formulaColSet.add(colName);
      }
    }
  }

  return {
    formulaColumns: Array.from(formulaColSet),
    formulaCells,
  };
}

export interface MappedSheetPreviewResult {
  report: ImportPreviewReport;
  mappedRows: Array<{
    rowNumber: number;
    sheetKey: string;
    rawMappedByField: Record<string, unknown>;
    normalizedData: Record<string, unknown>;
    status: ValidatedImportRow['status'];
    existingRecord?: Record<string, unknown>;
    issues: ValidationIssue[];
  }>;
  rowErrors: GoogleSyncRowError[];
  formulaProtection: FormulaProtectionMap;
}

export function getBusinessKeyFromRecord(
  schemaKey: ImportModuleKey,
  record: Record<string, unknown>,
  explicitPrimaryKey?: string
): string {
  if (explicitPrimaryKey && explicitPrimaryKey !== 'fullName') {
    const explicitVal = normalizeCode(record[explicitPrimaryKey]);
    if (explicitVal) return explicitVal;
  }

  switch (schemaKey) {
    case 'students':
      return normalizeCode(record.studentCode);
    case 'teachers':
      return normalizeCode(record.email || record.id);
    case 'staff':
      return normalizeCode(record.staffCode);
    case 'classes':
      return normalizeCode(record.code || record.name);
    case 'academic_years':
      return normalizeCode(record.name);
    case 'users':
    case 'role_assignments':
      return normalizeCode(record.email);
    case 'books':
      return normalizeCode(record.isbn || record.bookCode || record.id);
    case 'book_copies':
      return normalizeCode(record.copyBarcode);
    case 'inventory_audits':
      return normalizeCode(record.auditCode);
    case 'borrow_migration':
      return normalizeCode(record.transactionCode);
    case 'survey_questions':
      return normalizeCode(record.title);
    case 'leave_migration':
      return normalizeCode(record.requestCode);
    case 'feedback_migration':
      return normalizeCode(record.reportCode);
    case 'rooms':
    case 'facilities':
      return normalizeCode(record.code);
    case 'maintenance_plans':
      return normalizeCode(record.requestCode);
    case 'timetable':
      return `${normalizeCode(record.className)}__D${record.dayOfWeek}__P${record.period}`;
    case 'grades':
      return `${normalizeCode(record.studentCode)}__${normalizeCode(record.subjectName)}__${normalizeCode(record.semester)}`;
    case 'attendance':
      return `${normalizeText(record.date)}__${normalizeCode(record.studentCode)}`;
    case 'teaching_assignments':
      return `${normalizeCode(record.teacherName || record.teacherCode)}__${normalizeCode(record.className)}__${normalizeCode(record.subject)}__${normalizeCode(record.semester)}`;
    case 'announcements':
      return normalizeCode(record.title);
    case 'events':
      return `${normalizeCode(record.title)}__${normalizeText(record.date)}`;
    case 'assignments':
      return `${normalizeCode(record.title)}__${normalizeCode(record.className)}`;
    case 'rule_criteria':
      return normalizeCode(record.code || record.name);
    case 'emulation_records':
      return normalizeCode(record.recordCode || record.id);
    default:
      return normalizeCode(record.id || record[Object.keys(record)[0] || '']);
  }
}

export function buildMappedPreview(params: {
  moduleKey: ImportModuleKey;
  fileName: string;
  sheetName: string;
  headers: string[];
  rawRows: unknown[][];
  formulaRows?: unknown[][];
  headerRow?: number;
  mappings: ColumnMappingRule[];
  primaryKeyField?: string;
  existingRecords: Record<string, unknown>[];
  context?: ValidationDbContext;
  importMode?: ImportMode;
}): MappedSheetPreviewResult {
  const {
    moduleKey,
    fileName,
    sheetName,
    headers,
    rawRows,
    formulaRows = [],
    headerRow = 1,
    mappings,
    primaryKeyField,
    existingRecords,
    importMode = 'update_existing',
  } = params;

  const schema = getSchemaByKey(moduleKey);
  const formulaProtection = detectFormulaCells(formulaRows, headers);
  const headerErrors: string[] = [];
  const missingRequiredHeaders: string[] = [];
  const unrecognizedHeaders: string[] = [];

  const activeMappings = mappings.filter((m) => !m.ignored && Boolean(m.targetFieldKey));
  const mappedFieldKeys = new Set(activeMappings.map((m) => m.targetFieldKey));

  for (const field of schema.fields) {
    if (field.required && !mappedFieldKeys.has(field.key)) {
      missingRequiredHeaders.push(field.header);
    }
  }
  for (const m of mappings) {
    if (m.ignored || !m.targetFieldKey) {
      if (m.sheetColumn) unrecognizedHeaders.push(m.sheetColumn);
    }
  }
  if (missingRequiredHeaders.length > 0) {
    headerErrors.push(`Thiếu ánh xạ cho các cột bắt buộc: ${missingRequiredHeaders.join(', ')}`);
  }

  const seenKeysInSheet = new Map<string, number>();
  const validatedRows: ValidatedImportRow[] = [];
  const mappedRows: MappedSheetPreviewResult['mappedRows'] = [];
  const rowErrors: GoogleSyncRowError[] = [];
  const runtimeCtx: ValidationDbContext = params.context || {};
  const catalogs = buildCatalogLists(runtimeCtx);

  const mappingByFieldKey = new Map<string, ColumnMappingRule>();
  for (const m of activeMappings) {
    if (!mappingByFieldKey.has(m.targetFieldKey)) {
      mappingByFieldKey.set(m.targetFieldKey, m);
    }
  }

  for (let idx = 0; idx < rawRows.length; idx++) {
    const rowArr = rawRows[idx] || [];
    const hasAnyValue = rowArr.some((cell) => normalizeText(cell).length > 0);
    if (!hasAnyValue) continue;

    const rowNumber = headerRow + 1 + idx;
    const rawMappedByField: Record<string, unknown> = {};
    for (const m of activeMappings) {
      const cellVal = rowArr[m.sheetColIndex];
      const cellStr = normalizeText(cellVal);
      rawMappedByField[m.targetFieldKey] =
        cellStr === '' && m.defaultValue !== undefined && m.defaultValue !== ''
          ? m.defaultValue
          : cellVal;
    }

    const rowBizKeyCandidate = getBusinessKeyFromRecord(
      moduleKey,
      rawMappedByField,
      primaryKeyField
    );
    const matchedExisting = rowBizKeyCandidate
      ? existingRecords.find(
          (rec) =>
            getBusinessKeyFromRecord(moduleKey, rec, primaryKeyField) ===
            rowBizKeyCandidate
        )
      : undefined;

    const isUpdateCandidate =
      Boolean(matchedExisting) && importMode === 'update_existing' && schema.allowUpdate;

    const issues: ValidationIssue[] = [];
    const normalized: Record<string, unknown> = {};

    for (const field of schema.fields) {
      const hasMappedCol = mappedFieldKeys.has(field.key);
      const rawVal = hasMappedCol ? rawMappedByField[field.key] : field.defaultValue ?? '';
      const catalogOptions =
        field.catalogId || field.lookupCatalog || (field.options && field.options.length > 0)
          ? resolveCatalogOptions({
              catalogId: field.catalogId,
              lookupCatalog: field.lookupCatalog,
              staticOptions: field.options,
              includeInactive: false,
              runtime: runtimeCtx,
            })
          : undefined;
      const res = validateSingleField(field, rawVal, {
        treatBlankAsOptional: isUpdateCandidate && field.key !== primaryKeyField,
        catalogOptions,
      });
      if (!res.valid && res.error) {
        issues.push({
          rowNumber,
          sheetName,
          field: field.key,
          header: field.header,
          value: normalizeText(rawVal),
          message: res.error,
          severity: 'error',
        });
      } else {
        normalized[field.key] = res.value;
      }
    }

    // Class existence check when classes are loaded in DB
    if (
      (moduleKey === 'students' ||
        moduleKey === 'class_placements' ||
        moduleKey === 'teaching_assignments' ||
        moduleKey === 'timetable' ||
        moduleKey === 'assignments') &&
      normalized.className &&
      catalogs.classes.length > 0
    ) {
      const clsName = normalizeText(normalized.className);
      if (!catalogs.classes.some((c) => c.toLowerCase() === clsName.toLowerCase())) {
        issues.push({
          rowNumber,
          sheetName,
          field: 'className',
          header: 'Lớp *',
          value: clsName,
          message: `Lớp "${clsName}" chưa tồn tại trong danh mục Lớp học của SchoolHub.`,
          severity: 'error',
        });
      }
    }

    // Parent-child dependent validation (e.g. Khối -> Lớp, Tổ chuyên môn -> Bộ môn)
    for (const field of schema.fields) {
      if (!field.parentFieldKey) continue;
      const childVal = normalized[field.key];
      const parentVal = normalized[field.parentFieldKey];
      if (normalizeText(childVal) && normalizeText(parentVal)) {
        const depRes = validateDependentFieldValue({
          childFieldKey: field.key,
          childValue: childVal,
          parentValue: parentVal,
          runtime: runtimeCtx,
        });
        if (!depRes.valid && depRes.message) {
          issues.push({
            rowNumber,
            sheetName,
            field: field.key,
            header: field.header,
            value: normalizeText(childVal),
            message: depRes.message,
            severity: 'error',
          });
        }
      }
    }

    const finalBizKey = getBusinessKeyFromRecord(
      moduleKey,
      normalized,
      primaryKeyField
    );

    let isDuplicate = false;
    if (finalBizKey) {
      const seenAt = seenKeysInSheet.get(finalBizKey);
      if (seenAt !== undefined) {
        isDuplicate = true;
        issues.push({
          rowNumber,
          sheetName,
          field: primaryKeyField || schema.fields[0]?.key || 'id',
          header: schema.primaryKeyHeader,
          value: finalBizKey,
          message: `Trùng khóa "${finalBizKey}" trong Google Sheet với dòng ${seenAt}.`,
          severity: 'error',
        });
      } else {
        seenKeysInSheet.set(finalBizKey, rowNumber);
      }
    }

    if (matchedExisting && importMode === 'only_add') {
      isDuplicate = true;
      issues.push({
        rowNumber,
        sheetName,
        field: primaryKeyField || schema.fields[0]?.key || 'id',
        header: schema.primaryKeyHeader,
        value: finalBizKey,
        message: `Bản ghi "${finalBizKey}" đã tồn tại trên SchoolHub (đang chọn chế độ Chỉ thêm mới).`,
        severity: 'error',
      });
    }

    for (const issue of issues) {
      const schemaField = schema.fields.find((f) => f.key === issue.field);
      const parentVal = schemaField?.parentFieldKey
        ? normalizeText(normalized[schemaField.parentFieldKey] ?? rawMappedByField[schemaField.parentFieldKey])
        : undefined;
      const allowedOpts = schemaField
        ? resolveCatalogOptions({
            catalogId: schemaField.catalogId,
            lookupCatalog: schemaField.lookupCatalog,
            staticOptions: schemaField.options,
            parentValue: parentVal || undefined,
            includeInactive: false,
            runtime: runtimeCtx,
          }).map((o) => o.value)
        : undefined;
      rowErrors.push({
        rowNumber: issue.rowNumber,
        field: issue.field,
        header: issue.header,
        sheetColumn: mappingByFieldKey.get(issue.field)?.sheetColumn,
        rawValue: issue.value,
        message: issue.message,
        severity: issue.severity,
        allowedValues: allowedOpts && allowedOpts.length > 0 ? allowedOpts : undefined,
        parentFieldKey: schemaField?.parentFieldKey,
        parentValue: parentVal || undefined,
      });
    }

    const hasError = issues.some((i) => i.severity === 'error');
    const status: ValidatedImportRow['status'] = hasError
      ? isDuplicate
        ? 'duplicate'
        : 'invalid'
      : matchedExisting
      ? 'valid_update'
      : 'valid_create';

    validatedRows.push({
      rowNumber,
      rawData: rawMappedByField,
      normalizedData: normalized,
      status,
      existingId: matchedExisting ? String(matchedExisting.id) : undefined,
      issues,
    });

    mappedRows.push({
      rowNumber,
      sheetKey: finalBizKey,
      rawMappedByField,
      normalizedData: normalized,
      status,
      existingRecord: matchedExisting,
      issues,
    });
  }

  return {
    report: {
      schemaKey: moduleKey,
      fileName,
      headersFound: headers.map((h) => normalizeText(h)).filter(Boolean),
      missingRequiredHeaders,
      unrecognizedHeaders,
      headerErrors,
      totalRows: validatedRows.length,
      validCreateCount: validatedRows.filter((r) => r.status === 'valid_create').length,
      validUpdateCount: validatedRows.filter((r) => r.status === 'valid_update').length,
      invalidCount: validatedRows.filter((r) => r.status === 'invalid').length,
      duplicateCount: validatedRows.filter((r) => r.status === 'duplicate').length,
      warningCount: validatedRows.reduce(
        (sum, r) => sum + r.issues.filter((i) => i.severity === 'warning').length,
        0
      ),
      rows: validatedRows,
    },
    mappedRows,
    rowErrors,
    formulaProtection,
  };
}
