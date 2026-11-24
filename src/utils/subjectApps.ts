export type SubjectId =
  | 'english'
  | 'math'
  | 'literature'
  | 'physics'
  | 'chemistry'
  | 'biology'
  | 'history'
  | 'geography'
  | 'informatics';

export interface SubjectDefinition {
  id: SubjectId;
  name: string;
  shortName: string;
  englishName: string;
  code: string;
  description: string;
  accentBg: string;
  accentText: string;
  order: number;
}

export interface SubjectHtmlModule {
  id: string;
  subjectId: SubjectId;
  title: string;
  description: string;
  fileName: string;
  sourceType: 'builtin' | 'uploaded';
  srcUrl?: string;
  htmlContent?: string;
  sizeBytes?: number;
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
}

export interface SubjectProgressSnapshot {
  subjectId: SubjectId;
  masteredCount?: number;
  masteredTotal?: number;
  quizScore?: number;
  quizTotal?: number;
  activeSection?: string;
  updatedAt?: string;
}

export interface SubjectSummary {
  subject: SubjectDefinition;
  modules: SubjectHtmlModule[];
  moduleCount: number;
  hasHtmlApp: boolean;
  defaultModuleId: string | null;
}

export const SUBJECT_STORAGE_KEY = 'schoolhub_subject_html_apps_v1';
export const MAX_HTML_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB

export const SUBJECT_DEFINITIONS: readonly SubjectDefinition[] = [
  {
    id: 'english',
    name: 'Tiếng Anh',
    shortName: 'Tiếng Anh',
    englishName: 'English',
    code: 'ENG',
    description: 'Từ vựng học thuật, ngữ pháp, ghép câu và trắc nghiệm tương tác từ file HTML.',
    accentBg: 'bg-sky-500/12 dark:bg-sky-500/20',
    accentText: 'text-sky-700 dark:text-sky-300',
    order: 1,
  },
  {
    id: 'math',
    name: 'Toán học',
    shortName: 'Toán',
    englishName: 'Mathematics',
    code: 'MATH',
    description: 'Đồ thị hàm số, hình học không gian và bài tập trắc nghiệm HTML.',
    accentBg: 'bg-indigo-500/12 dark:bg-indigo-500/20',
    accentText: 'text-indigo-700 dark:text-indigo-300',
    order: 2,
  },
  {
    id: 'literature',
    name: 'Ngữ văn',
    shortName: 'Ngữ văn',
    englishName: 'Literature',
    code: 'LIT',
    description: 'Đọc hiểu văn bản, phân tích tác phẩm và luyện viết tương tác.',
    accentBg: 'bg-rose-500/12 dark:bg-rose-500/20',
    accentText: 'text-rose-700 dark:text-rose-300',
    order: 3,
  },
  {
    id: 'physics',
    name: 'Vật lý',
    shortName: 'Vật lý',
    englishName: 'Physics',
    code: 'PHY',
    description: 'Mô phỏng dao động, mạch điện và thí nghiệm ảo HTML5.',
    accentBg: 'bg-amber-500/12 dark:bg-amber-500/20',
    accentText: 'text-amber-700 dark:text-amber-300',
    order: 4,
  },
  {
    id: 'chemistry',
    name: 'Hóa học',
    shortName: 'Hóa học',
    englishName: 'Chemistry',
    code: 'CHEM',
    description: 'Bảng tuần hoàn, cân bằng phương trình và mô phỏng phản ứng.',
    accentBg: 'bg-emerald-500/12 dark:bg-emerald-500/20',
    accentText: 'text-emerald-700 dark:text-emerald-300',
    order: 5,
  },
  {
    id: 'biology',
    name: 'Sinh học',
    shortName: 'Sinh học',
    englishName: 'Biology',
    code: 'BIO',
    description: 'Di truyền học, cấu trúc tế bào và sơ đồ sinh thái tương tác.',
    accentBg: 'bg-teal-500/12 dark:bg-teal-500/20',
    accentText: 'text-teal-700 dark:text-teal-300',
    order: 6,
  },
  {
    id: 'history',
    name: 'Lịch sử',
    shortName: 'Lịch sử',
    englishName: 'History',
    code: 'HIS',
    description: 'Dòng thời gian sự kiện, bản đồ lịch sử và câu hỏi ôn tập.',
    accentBg: 'bg-orange-500/12 dark:bg-orange-500/20',
    accentText: 'text-orange-700 dark:text-orange-300',
    order: 7,
  },
  {
    id: 'geography',
    name: 'Địa lý',
    shortName: 'Địa lý',
    englishName: 'Geography',
    code: 'GEO',
    description: 'Atlat tương tác, biểu đồ khí hậu và địa lý kinh tế - xã hội.',
    accentBg: 'bg-cyan-500/12 dark:bg-cyan-500/20',
    accentText: 'text-cyan-700 dark:text-cyan-300',
    order: 8,
  },
  {
    id: 'informatics',
    name: 'Tin học',
    shortName: 'Tin học',
    englishName: 'Informatics',
    code: 'INFO',
    description: 'Thuật toán trực quan, thực hành HTML/JS và lập trình cơ bản.',
    accentBg: 'bg-violet-500/12 dark:bg-violet-500/20',
    accentText: 'text-violet-700 dark:text-violet-300',
    order: 9,
  },
];

export const BUILTIN_SUBJECT_HTML_MODULES: readonly SubjectHtmlModule[] = [
  {
    id: 'builtin-english-studio',
    subjectId: 'english',
    title: 'English Studio — Học Tiếng Anh Tương Tác',
    description:
      'Ứng dụng học Tiếng Anh chạy từ tệp HTML độc lập: Flashcards từ vựng kèm phát âm, Ngữ pháp trọng tâm, Ghép câu và Trắc nghiệm chấm điểm tức thì.',
    fileName: 'english.html',
    sourceType: 'builtin',
    srcUrl: '/subject-apps/english.html',
    createdAt: '2026-11-21T00:00:00.000Z',
    updatedAt: '2026-11-21T00:00:00.000Z',
    isDefault: true,
  },
];

export function isValidSubjectId(value: unknown): value is SubjectId {
  return typeof value === 'string' && SUBJECT_DEFINITIONS.some((s) => s.id === value);
}

export function getSubjectById(subjectId: SubjectId): SubjectDefinition {
  return (
    SUBJECT_DEFINITIONS.find((s) => s.id === subjectId) || SUBJECT_DEFINITIONS[0]
  );
}

export function extractHtmlTitle(html: string): string | null {
  if (typeof html !== 'string' || !html.trim()) return null;
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  const cleaned = match[1]
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || null;
}

export function normalizeHtmlFileName(fileName: string): string {
  const base = (fileName || 'subject-app.html').trim().split(/[/\\]/).pop() || 'subject-app.html';
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (/\.(html|htm)$/i.test(cleaned)) return cleaned;
  return `${cleaned}.html`;
}

export function validateHtmlAppUpload(
  fileName: string,
  content: string,
  maxBytes: number = MAX_HTML_UPLOAD_BYTES
):
  | {
      ok: true;
      title: string;
      sanitizedFileName: string;
      sizeBytes: number;
    }
  | {
      ok: false;
      error: string;
    } {
  const trimmedName = (fileName || '').trim();
  if (!trimmedName) {
    return { ok: false, error: 'Vui lòng nhập tên tệp .html hợp lệ.' };
  }

  if (!/\.(html|htm)$/i.test(trimmedName)) {
    return { ok: false, error: 'Chỉ hỗ trợ tệp định dạng .html hoặc .htm.' };
  }

  if (typeof content !== 'string' || !content.trim()) {
    return { ok: false, error: 'Nội dung tệp HTML đang trống.' };
  }

  const sizeBytes = new TextEncoder().encode(content).length;
  if (sizeBytes > maxBytes) {
    return {
      ok: false,
      error: `Dung lượng tệp vượt quá giới hạn ${(maxBytes / (1024 * 1024)).toFixed(1)} MB.`,
    };
  }

  const looksLikeHtml =
    /<!doctype\s+html/i.test(content) ||
    /<html[\s>]/i.test(content) ||
    /<body[\s>]/i.test(content) ||
    /<div[\s>]/i.test(content) ||
    /<section[\s>]/i.test(content) ||
    /<main[\s>]/i.test(content) ||
    /<h[1-6][\s>]/i.test(content) ||
    /<script[\s>]/i.test(content);

  if (!looksLikeHtml) {
    return {
      ok: false,
      error: 'Tệp chưa có cấu trúc thẻ HTML hợp lệ (ví dụ: <!DOCTYPE html>, <html>, <div>...).',
    };
  }

  const sanitizedFileName = normalizeHtmlFileName(trimmedName);
  const extracted = extractHtmlTitle(content);
  const fallbackTitle = sanitizedFileName.replace(/\.(html|htm)$/i, '').replace(/[_-]+/g, ' ');

  return {
    ok: true,
    title: extracted || fallbackTitle || 'Ứng dụng HTML',
    sanitizedFileName,
    sizeBytes,
  };
}

export function createUploadedHtmlModule(params: {
  subjectId: SubjectId;
  fileName: string;
  htmlContent: string;
  title?: string;
  description?: string;
  nowIso?: string;
}): SubjectHtmlModule {
  const nowIso = params.nowIso || new Date().toISOString();
  const sanitizedFileName = normalizeHtmlFileName(params.fileName);
  const extractedTitle = extractHtmlTitle(params.htmlContent);
  const title =
    (params.title || '').trim() ||
    extractedTitle ||
    sanitizedFileName.replace(/\.(html|htm)$/i, '').replace(/[_-]+/g, ' ');
  const sizeBytes = new TextEncoder().encode(params.htmlContent).length;

  return {
    id: `custom-${params.subjectId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    subjectId: params.subjectId,
    title,
    description:
      (params.description || '').trim() ||
      `Ứng dụng môn ${getSubjectById(params.subjectId).name} được nạp từ tệp ${sanitizedFileName}.`,
    fileName: sanitizedFileName,
    sourceType: 'uploaded',
    htmlContent: params.htmlContent,
    sizeBytes,
    createdAt: nowIso,
    updatedAt: nowIso,
    isDefault: false,
  };
}

export function mergeSubjectHtmlModules(
  customModules: SubjectHtmlModule[]
): SubjectHtmlModule[] {
  const seen = new Set<string>();
  const merged: SubjectHtmlModule[] = [];

  for (const mod of BUILTIN_SUBJECT_HTML_MODULES) {
    seen.add(mod.id);
    merged.push(mod);
  }

  for (const mod of customModules) {
    if (!mod || !mod.id || seen.has(mod.id)) continue;
    if (!isValidSubjectId(mod.subjectId)) continue;
    if (mod.sourceType !== 'uploaded' || typeof mod.htmlContent !== 'string') continue;
    seen.add(mod.id);
    merged.push(mod);
  }

  return merged;
}

export function getModulesForSubject(
  allModules: SubjectHtmlModule[],
  subjectId: SubjectId
): SubjectHtmlModule[] {
  return allModules.filter((m) => m.subjectId === subjectId);
}

export function getSubjectSummaries(
  allModules: SubjectHtmlModule[]
): SubjectSummary[] {
  return SUBJECT_DEFINITIONS.map((subject) => {
    const modules = getModulesForSubject(allModules, subject.id);
    const defaultMod = modules.find((m) => m.isDefault) || modules[0] || null;
    return {
      subject,
      modules,
      moduleCount: modules.length,
      hasHtmlApp: modules.length > 0,
      defaultModuleId: defaultMod ? defaultMod.id : null,
    };
  });
}

export function buildSubjectIframeUrl(srcUrl: string, darkMode: boolean): string {
  const separator = srcUrl.includes('?') ? '&' : '?';
  return `${srcUrl}${separator}theme=${darkMode ? 'dark' : 'light'}`;
}

export function parseSubjectProgressMessage(
  payload: unknown
): SubjectProgressSnapshot | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  if (obj.type !== 'schoolhub-subject-progress') return null;
  if (!isValidSubjectId(obj.subjectId)) return null;

  const toFiniteInt = (val: unknown): number | undefined =>
    typeof val === 'number' && Number.isFinite(val) && val >= 0 ? Math.round(val) : undefined;

  return {
    subjectId: obj.subjectId,
    masteredCount: toFiniteInt(obj.masteredCount),
    masteredTotal: toFiniteInt(obj.masteredTotal),
    quizScore: toFiniteInt(obj.quizScore),
    quizTotal: toFiniteInt(obj.quizTotal),
    activeSection: typeof obj.activeSection === 'string' ? obj.activeSection.slice(0, 60) : undefined,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : undefined,
  };
}

export function formatBytesCompact(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function loadCustomSubjectHtmlModules(): SubjectHtmlModule[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(SUBJECT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SubjectHtmlModule =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        isValidSubjectId(item.subjectId) &&
        item.sourceType === 'uploaded' &&
        typeof item.htmlContent === 'string'
    );
  } catch {
    return [];
  }
}

export function saveCustomSubjectHtmlModules(modules: SubjectHtmlModule[]): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  try {
    const customOnly = modules.filter((m) => m.sourceType === 'uploaded');
    localStorage.setItem(SUBJECT_STORAGE_KEY, JSON.stringify(customOnly));
  } catch {
    // Ignore storage quota errors
  }
}
