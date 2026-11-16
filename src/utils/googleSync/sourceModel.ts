import type {
  ColumnMappingRule,
  GoogleFileType,
  GoogleSheetValidationColumnSpec,
  GoogleSyncMode,
  GoogleSyncSource,
  GoogleSyncTargetModule,
  ImportModuleKey,
  SuperAppId,
} from '../../types';
import { getSchemaByKey, MODULE_SCHEMAS, type SchemaRuntimeContext } from '../importExport/schemas';
import { buildSheetValidationColumnsForModule } from '../catalogs/catalogRegistry';
import { detectPrimaryKeyField, suggestColumnMappings } from './sheetMapping';

export type ModuleInputMethod = 'file' | 'google';

export const DOCUMENT_MODULES: ReadonlyArray<GoogleSyncTargetModule> = [
  'rules_doc',
  'school_plan',
  'library_guide',
  'report_doc',
];

export function isDocumentModule(moduleKey: GoogleSyncTargetModule): boolean {
  return DOCUMENT_MODULES.includes(moduleKey);
}

export function getExpectedGoogleFileTypeForModule(
  moduleKey: GoogleSyncTargetModule
): GoogleFileType {
  return isDocumentModule(moduleKey) ? 'google_doc' : 'google_sheet';
}

export function getTargetModuleTitle(moduleKey: GoogleSyncTargetModule): string {
  if (moduleKey === 'rules_doc') return 'Nội quy & Quy chế Thi đua';
  if (moduleKey === 'school_plan') return 'Kế hoạch Nhà trường';
  if (moduleKey === 'library_guide') return 'Hướng dẫn & Quy định Thư viện';
  if (moduleKey === 'report_doc') return 'Báo cáo Tổng hợp';
  if (moduleKey in MODULE_SCHEMAS) {
    return MODULE_SCHEMAS[moduleKey as ImportModuleKey].title;
  }
  return moduleKey;
}

export function getTargetModuleAppId(moduleKey: GoogleSyncTargetModule): SuperAppId {
  if (moduleKey === 'rules_doc') return 'school';
  if (moduleKey === 'school_plan') return 'school';
  if (moduleKey === 'library_guide') return 'library';
  if (moduleKey === 'report_doc') return 'analytics';
  if (moduleKey in MODULE_SCHEMAS) {
    return MODULE_SCHEMAS[moduleKey as ImportModuleKey].appId;
  }
  return 'admin';
}

/**
 * Normalizes GoogleSyncSources to guarantee:
 * - Strictly 1 fixed Google source per targetModule (keeping the most recently linked/updated entry)
 * - Simplified 1-way direction: Google -> SchoolHub ('sheets_to_schoolhub')
 * - Non-destructive deletion policy ('ignore') so rows deleted externally never wipe SchoolHub records
 */
export function normalizeFixedSourcesPerModule(
  sources: GoogleSyncSource[]
): GoogleSyncSource[] {
  const byModule = new Map<GoogleSyncTargetModule, GoogleSyncSource>();
  const sorted = [...sources].sort((a, b) => {
    const tA = new Date(a.lastSyncAt || a.linkedAt || 0).getTime();
    const tB = new Date(b.lastSyncAt || b.linkedAt || 0).getTime();
    return tB - tA;
  });

  for (const src of sorted) {
    if (byModule.has(src.targetModule)) continue;
    byModule.set(src.targetModule, {
      ...src,
      syncDirection: 'sheets_to_schoolhub',
      deletionPolicy: 'ignore',
      conflictPolicy: 'sheets_wins',
      syncMode: src.syncMode || 'realtime',
      syncIntervalMinutes: src.syncIntervalMinutes || 15,
    });
  }

  return Array.from(byModule.values());
}

export function getFixedSourceForModule(
  sources: GoogleSyncSource[],
  moduleKey: GoogleSyncTargetModule
): GoogleSyncSource | undefined {
  return normalizeFixedSourcesPerModule(sources).find((s) => s.targetModule === moduleKey);
}

export function replaceFixedModuleSource(
  sources: GoogleSyncSource[],
  nextSource: GoogleSyncSource
): {
  nextSources: GoogleSyncSource[];
  replacedSourceIds: string[];
} {
  const replacedSourceIds = sources
    .filter((s) => s.targetModule === nextSource.targetModule && s.id !== nextSource.id)
    .map((s) => s.id);

  const normalizedNext: GoogleSyncSource = {
    ...nextSource,
    syncDirection: 'sheets_to_schoolhub',
    deletionPolicy: 'ignore',
    conflictPolicy: 'sheets_wins',
  };

  const remaining = sources.filter(
    (s) => s.targetModule !== nextSource.targetModule && s.id !== nextSource.id
  );

  return {
    nextSources: [normalizedNext, ...remaining],
    replacedSourceIds,
  };
}

export function buildAutoMappingsFromHeaders(
  moduleKey: ImportModuleKey,
  headers: string[]
): {
  mappings: ColumnMappingRule[];
  primaryKeyField: string;
  missingRequiredHeaders: string[];
} {
  const schema = getSchemaByKey(moduleKey);
  const mappings = suggestColumnMappings(headers, moduleKey);
  const primaryKeyField = detectPrimaryKeyField(schema);

  const mappedKeys = new Set(
    mappings.filter((m) => !m.ignored && m.targetFieldKey).map((m) => m.targetFieldKey)
  );
  const missingRequiredHeaders = schema.fields
    .filter((f) => f.required && !mappedKeys.has(f.key))
    .map((f) => f.label);

  return { mappings, primaryKeyField, missingRequiredHeaders };
}

export function buildTemplateSheetPayload(
  moduleKey: ImportModuleKey,
  context?: SchemaRuntimeContext
): {
  title: string;
  sheetName: string;
  headers: string[];
  rows: (string | number | boolean)[][];
  validationColumns: GoogleSheetValidationColumnSpec[];
} {
  const schema = getSchemaByKey(moduleKey);
  const headers = schema.fields.map((f) => f.header);
  const validationColumns = buildSheetValidationColumnsForModule(
    moduleKey,
    MODULE_SCHEMAS,
    context
  );
  return {
    title: `SchoolHub - ${schema.title}`,
    sheetName: 'DATA',
    headers,
    rows: [],
    validationColumns,
  };
}

export interface DocSectionTemplate {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: string[][];
}

export function buildTemplateDocPayload(
  moduleKey: GoogleSyncTargetModule,
  schoolName: string,
  academicYear: string
): {
  title: string;
  sections: DocSectionTemplate[];
} {
  const cleanSchool = schoolName || 'Trường THPT SchoolHub';
  const cleanYear = academicYear || '2026 - 2027';

  if (moduleKey === 'rules_doc') {
    return {
      title: `Quy chế Nội quy & Thi đua - ${cleanSchool} (${cleanYear})`,
      sections: [
        {
          heading: 'QUY ĐỊNH NỘI QUY & TIÊU CHÍ THI ĐUA',
          paragraphs: [
            `Đơn vị: ${cleanSchool}`,
            `Năm học: ${cleanYear}`,
            'Ghi chú: Chỉnh sửa các điều khoản dưới đây. Khi đồng bộ về SchoolHub, hệ thống sẽ tạo Bản nháp để Ban Giám hiệu duyệt trước khi ban hành.',
          ],
        },
        {
          heading: 'I. Nề nếp & Chuyên cần',
          bullets: [
            '1. Đi học đúng giờ, đầy đủ tiết học: cộng 2 điểm.',
            '2. Đi học muộn không phép: trừ 2 điểm.',
            '3. Nghỉ học không phép: trừ 5 điểm.',
          ],
        },
        {
          heading: 'II. Tác phong & Đồng phục',
          bullets: [
            '1. Mặc đúng đồng phục, đeo thẻ học sinh đầy đủ.',
            '2. Giữ gìn vệ sinh lớp học và khuôn viên trường.',
          ],
        },
      ],
    };
  }

  return {
    title: `${getTargetModuleTitle(moduleKey)} - ${cleanSchool} (${cleanYear})`,
    sections: [
      {
        heading: getTargetModuleTitle(moduleKey).toUpperCase(),
        paragraphs: [
          `Đơn vị: ${cleanSchool}`,
          `Năm học: ${cleanYear}`,
          'Nhập nội dung chính thức tại đây. SchoolHub sẽ đồng bộ thay đổi từ tài liệu này.',
        ],
      },
    ],
  };
}

export function formatSyncIntervalLabel(
  syncMode: GoogleSyncMode,
  intervalMinutes: number = 15
): string {
  if (syncMode === 'realtime') return 'Tự động';
  if (syncMode === 'manual') return 'Thủ công';
  if (intervalMinutes >= 60 && intervalMinutes % 60 === 0) {
    const hrs = intervalMinutes / 60;
    return `Định kỳ (${hrs} giờ)`;
  }
  return `Định kỳ (${intervalMinutes} phút)`;
}
