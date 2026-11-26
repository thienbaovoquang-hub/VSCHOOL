import type {
  AIExtractedRuleItem,
  Competition,
  CompetitionCriterion,
  CompetitionParticipant,
  CompetitionScore,
  CompetitionStatus,
  EmulationAppeal,
  EmulationPolicy,
  EmulationRecord,
  EmulationSnapshotEntry,
  EmulationTitleConfig,
  RuleCategory,
  RuleCriterion,
  SchoolClass,
  ScoreTransferRecord,
  Student,
} from '../types';
import type { ParsedWorkbookData } from './importExport/validator';
import { sanitizeFirestoreDocId } from './catalogs/catalogRegistry';

export const DEFAULT_EMULATION_POLICY: EmulationPolicy = {
  startingScore: 100,
  minScore: 0,
  maxScore: 200,
  cycleType: 'month',
  requireApprovalForRecord: false,
  includeVerifiedBeforeApproval: true,
  allowStudentAppealDays: 7,
  rankingEligibilityMinRecords: 0,
  classFormula: 'combined_formula',
  studentWeight: 0.6,
  classEventWeight: 1,
};

export const DEFAULT_EMULATION_TITLES: EmulationTitleConfig[] = [
  {
    id: 'TTL-STU-EXCELLENT',
    name: 'Học sinh Tiêu biểu',
    targetScope: 'student',
    minScore: 115,
    maxViolations: 0,
    badgeColor: 'bg-amber-500/15 text-amber-700 border-amber-300/60',
    description: 'Điểm thi đua >= 115 và không có vi phạm trong kỳ.',
  },
  {
    id: 'TTL-STU-ACTIVE',
    name: 'Học sinh Tích cực',
    targetScope: 'student',
    minScore: 100,
    maxViolations: 1,
    badgeColor: 'bg-emerald-500/15 text-emerald-700 border-emerald-300/60',
    description: 'Điểm thi đua >= 100 và tối đa 1 vi phạm nhẹ.',
  },
  {
    id: 'TTL-CLS-BANNER',
    name: 'Lớp Cờ Đỏ Xuất sắc',
    targetScope: 'class',
    minScore: 115,
    maxViolations: 1,
    badgeColor: 'bg-rose-500/15 text-rose-700 border-rose-300/60',
    description: 'Tổng điểm thi đua lớp >= 115 và giữ nề nếp ổn định.',
  },
  {
    id: 'TTL-CLS-ADVANCED',
    name: 'Lớp Tiên tiến',
    targetScope: 'class',
    minScore: 100,
    badgeColor: 'bg-sky-500/15 text-sky-700 border-sky-300/60',
    description: 'Điểm thi đua lớp đạt từ 100 điểm trở lên.',
  },
];

/**
 * Determines whether a record is active and legally counts toward scores.
 * Guardrail: draft, pending_verification, insufficient_evidence, cancelled NEVER alter scores.
 */
export function isEmulationRecordCounted(
  record: EmulationRecord,
  policy: EmulationPolicy = DEFAULT_EMULATION_POLICY
): boolean {
  if (record.status === 'recorded') return true;
  if (
    record.status === 'verified' &&
    !policy.requireApprovalForRecord &&
    policy.includeVerifiedBeforeApproval
  ) {
    return true;
  }
  return false;
}

export function isDateInRange(dateStr: string, startDate?: string, endDate?: string): boolean {
  if (!dateStr) return false;
  const day = dateStr.split('T')[0];
  if (startDate && day < startDate) return false;
  if (endDate && day > endDate) return false;
  return true;
}

export function clampScore(score: number, policy: EmulationPolicy): number {
  const rounded = Math.round(score * 100) / 100;
  return Math.max(policy.minScore, Math.min(policy.maxScore, rounded));
}

export function resolveCriterionAppliedPoints(
  criterion: Pick<RuleCriterion, 'type' | 'points'>,
  overridePoints?: number | null
): number {
  if (overridePoints !== undefined && overridePoints !== null && !Number.isNaN(overridePoints)) {
    const abs = Math.abs(overridePoints);
    if (abs === 0) return 0;
    return criterion.type === 'violation' ? -abs : abs;
  }
  const base = criterion.points ?? 0;
  const abs = Math.abs(base);
  if (abs === 0) return 0;
  return criterion.type === 'violation' ? -abs : abs;
}

/* ================== CANONICAL RULE GROUPS & POINT SIGN FILTERING ================== */

export interface RuleGroupTabConfig {
  order: number;
  name: string;
  sheetName: string;
  shortLabel: string;
  aliases: string[];
  defaultTargetScope: 'individual' | 'class' | 'group';
}

export const CANONICAL_RULE_GROUPS: RuleGroupTabConfig[] = [
  {
    order: 1,
    name: 'I. NỀ NẾP',
    sheetName: 'I. NỀ NẾP',
    shortLabel: 'I. Nề nếp',
    aliases: ['I. NỀ NẾP', 'I. NE NEP', 'I. Nề nếp', 'NỀ NẾP', 'Nề nếp', 'I'],
    defaultTargetScope: 'individual',
  },
  {
    order: 2,
    name: 'II. THẺ, PHÙ HIỆU',
    sheetName: 'II. THẺ, PHÙ HIỆU',
    shortLabel: 'II. Thẻ, phù hiệu',
    aliases: ['II. THẺ, PHÙ HIỆU', 'II. THE, PHU HIEU', 'II. Thẻ, phù hiệu', 'THẺ, PHÙ HIỆU', 'Thẻ, phù hiệu', 'II'],
    defaultTargetScope: 'individual',
  },
  {
    order: 3,
    name: 'III. VỆ SINH, TRỰC NHẬT, LAO ĐỘNG',
    sheetName: 'III. VỆ SINH, TRỰC NHẬT',
    shortLabel: 'III. Vệ sinh, trực nhật, lao động',
    aliases: [
      'III. VỆ SINH, TRỰC NHẬT, LAO ĐỘNG',
      'III. VỆ SINH, TRỰC NHẬT',
      'III. VỆ SINH, TRỰC NHẬT, LAO ĐỘ',
      'III. VE SINH, TRUC NHAT, LAO DONG',
      'III. VỆ SINH - LAO ĐỘNG',
      'VỆ SINH, TRỰC NHẬT, LAO ĐỘNG',
      'III',
    ],
    defaultTargetScope: 'individual',
  },
  {
    order: 4,
    name: 'IV. AN TOÀN GIAO THÔNG',
    sheetName: 'IV. AN TOÀN GIAO THÔNG',
    shortLabel: 'IV. An toàn giao thông',
    aliases: ['IV. AN TOÀN GIAO THÔNG', 'IV. AN TOAN GIAO THONG', 'AN TOÀN GIAO THÔNG', 'IV'],
    defaultTargetScope: 'individual',
  },
  {
    order: 5,
    name: 'V. SINH HOẠT, CHÀO CỜ, HOẠT ĐỘNG NGOÀI TRỜI',
    sheetName: 'V. SINH HOẠT, CHÀO CỜ, HĐNT',
    shortLabel: 'V. Sinh hoạt, chào cờ, HĐNT',
    aliases: [
      'V. SINH HOẠT, CHÀO CỜ, HOẠT ĐỘNG NGOÀI TRỜI',
      'V. SINH HOẠT, CHÀO CỜ, HĐNT',
      'V. SINH HOẠT, CHÀO CỜ, HOẠT ĐỘ',
      'V. SINH HOAT, CHAO CO, HOAT DONG NGOAI TROI',
      'V. SINH HOẠT, CHÀO CỜ',
      'SINH HOẠT, CHÀO CỜ, HOẠT ĐỘNG NGOÀI TRỜI',
      'V',
    ],
    defaultTargetScope: 'individual',
  },
  {
    order: 6,
    name: 'Hoạt động tập thể',
    sheetName: 'Hoạt động tập thể',
    shortLabel: 'Hoạt động tập thể',
    aliases: ['Hoạt động tập thể', 'HOẠT ĐỘNG TẬP THỂ', 'VI. HOẠT ĐỘNG TẬP THỂ', 'VI'],
    defaultTargetScope: 'class',
  },
  {
    order: 7,
    name: 'Hoạt động cá nhân',
    sheetName: 'Hoạt động cá nhân',
    shortLabel: 'Hoạt động cá nhân',
    aliases: ['Hoạt động cá nhân', 'HOẠT ĐỘNG CÁ NHÂN', 'VII. HOẠT ĐỘNG CÁ NHÂN', 'VII'],
    defaultTargetScope: 'individual',
  },
  {
    order: 8,
    name: 'VIII. CÁC HĐ KHÁC',
    sheetName: 'VIII. CÁC HĐ KHÁC',
    shortLabel: 'VIII. Các HĐ khác',
    aliases: ['VIII. CÁC HĐ KHÁC', 'VIII. CAC HD KHAC', 'CÁC HĐ KHÁC', 'VIII'],
    defaultTargetScope: 'individual',
  },
];

function normalizeRuleGroupToken(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function findCanonicalRuleGroup(raw: string | undefined | null): RuleGroupTabConfig | undefined {
  const token = normalizeRuleGroupToken(raw);
  if (!token) return undefined;

  for (const grp of CANONICAL_RULE_GROUPS) {
    if (normalizeRuleGroupToken(grp.name) === token || normalizeRuleGroupToken(grp.sheetName) === token) {
      return grp;
    }
    if (grp.aliases.some((alias) => normalizeRuleGroupToken(alias) === token)) {
      return grp;
    }
  }

  // Prefix & keyword fallback for truncated Excel sheet tabs or minor punctuation variations
  if (/^i(\s|$)/.test(token) || token.includes('ne nep')) return CANONICAL_RULE_GROUPS[0];
  if (/^ii(\s|$)/.test(token) || token.includes('phu hieu') || token.includes('the phu')) return CANONICAL_RULE_GROUPS[1];
  if (/^iii(\s|$)/.test(token) || token.includes('ve sinh') || token.includes('truc nhat') || token.includes('lao dong')) return CANONICAL_RULE_GROUPS[2];
  if (/^iv(\s|$)/.test(token) || token.includes('an toan giao thong')) return CANONICAL_RULE_GROUPS[3];
  if (/^v(\s|$)/.test(token) || token.includes('chao co') || token.includes('ngoai troi') || token.includes('hdnt')) return CANONICAL_RULE_GROUPS[4];
  if (/^vi(\s|$)/.test(token) || token.includes('hoat dong tap the')) return CANONICAL_RULE_GROUPS[5];
  if (/^vii(\s|$)/.test(token) || token.includes('hoat dong ca nhan')) return CANONICAL_RULE_GROUPS[6];
  if (/^viii(\s|$)/.test(token) || token.includes('hd khac') || token.includes('hoat dong khac')) return CANONICAL_RULE_GROUPS[7];

  return undefined;
}

export type RulePointSign = 'positive' | 'negative' | 'zero' | 'unspecified';
export type RulePointSignFilter = 'all' | RulePointSign;

export function classifyCriterionPointSign(
  c: Pick<RuleCriterion, 'points' | 'pointsSpecified'>
): RulePointSign {
  if (!c.pointsSpecified || c.points === null || c.points === undefined || !Number.isFinite(c.points)) {
    return 'unspecified';
  }
  if (c.points > 0) return 'positive';
  if (c.points < 0) return 'negative';
  return 'zero';
}

export interface RuleCriteriaGroupSection {
  groupKey: string;
  groupName: string;
  order: number;
  items: RuleCriterion[];
}

export function groupAndFilterRuleCriteria(
  criteria: RuleCriterion[],
  options: {
    groupFilter?: string;
    pointFilter?: RulePointSignFilter;
    searchQuery?: string;
  } = {}
): {
  filtered: RuleCriterion[];
  sections: RuleCriteriaGroupSection[];
  countsByPointSign: Record<RulePointSign, number>;
  countsByGroup: Record<string, number>;
} {
  const { groupFilter = 'all', pointFilter = 'all', searchQuery = '' } = options;
  const query = searchQuery.trim().toLowerCase();

  const resolveCanonicalGroupName = (c: RuleCriterion): string => {
    const canonical = findCanonicalRuleGroup(c.categoryName);
    return canonical ? canonical.name : (c.categoryName || 'VIII. CÁC HĐ KHÁC').trim();
  };

  const countsByPointSign: Record<RulePointSign, number> = {
    positive: 0,
    negative: 0,
    zero: 0,
    unspecified: 0,
  };
  const countsByGroup: Record<string, number> = {};

  for (const c of criteria) {
    const sign = classifyCriterionPointSign(c);
    countsByPointSign[sign] += 1;
    const gName = resolveCanonicalGroupName(c);
    countsByGroup[gName] = (countsByGroup[gName] || 0) + 1;
  }

  const filtered = criteria.filter((c) => {
    const gName = resolveCanonicalGroupName(c);
    if (groupFilter !== 'all' && gName !== groupFilter) return false;
    if (pointFilter !== 'all' && classifyCriterionPointSign(c) !== pointFilter) return false;
    if (query) {
      const hay = `${c.name} ${c.behavior || ''} ${c.disciplineForm || c.honorNote || ''} ${c.condition || ''} ${gName} ${c.code}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  const bucketMap = new Map<string, RuleCriteriaGroupSection>();
  for (const item of filtered) {
    const gName = resolveCanonicalGroupName(item);
    const canonical = findCanonicalRuleGroup(gName);
    let section = bucketMap.get(gName);
    if (!section) {
      section = {
        groupKey: gName,
        groupName: gName,
        order: canonical?.order ?? 99,
        items: [],
      };
      bucketMap.set(gName, section);
    }
    section.items.push(item);
  }

  const sections = Array.from(bucketMap.values())
    .sort((a, b) => a.order - b.order || a.groupName.localeCompare(b.groupName, 'vi'))
    .map((sec) => ({
      ...sec,
      items: [...sec.items].sort((a, b) => {
        const aStt = typeof a.stt === 'number' ? a.stt : Number.MAX_SAFE_INTEGER;
        const bStt = typeof b.stt === 'number' ? b.stt : Number.MAX_SAFE_INTEGER;
        if (aStt !== bStt) return aStt - bStt;
        return a.name.localeCompare(b.name, 'vi');
      }),
    }));

  return {
    filtered: sections.flatMap((s) => s.items),
    sections,
    countsByPointSign,
    countsByGroup,
  };
}

export function detectBulkRecordDuplicates(
  existingRecords: EmulationRecord[],
  studentIds: string[],
  criterionId: string,
  occurredAt: string
): string[] {
  const day = occurredAt.split('T')[0];
  const existingSet = new Set(
    existingRecords
      .filter((r) => r.status !== 'cancelled' && r.criterionId === criterionId && r.occurredAt.split('T')[0] === day && r.studentId)
      .map((r) => r.studentId!)
  );
  return studentIds.filter((id) => existingSet.has(id));
}

export function sanitizeEmulationRecordForPublicView(record: EmulationRecord): EmulationRecord {
  if (!record.isSensitive) return record;
  return {
    ...record,
    description: '[Nội dung chi tiết được bảo mật theo quy định]',
    evidenceNote: undefined,
    evidenceAttachmentName: undefined,
  };
}

export interface StudentEmulationSummary {
  studentId: string;
  studentCode: string;
  studentName: string;
  classId: string;
  className: string;
  grade: number;
  baseScore: number;
  achievementPoints: number;
  violationPoints: number; // negative or 0
  transferPoints: number;
  totalScore: number;
  achievementCount: number;
  violationCount: number;
  recordCount: number;
  rank: number;
  rankDelta?: number;
  titleAwarded?: string;
}

export interface ClassEmulationSummary {
  classId: string;
  className: string;
  homeroomTeacherName?: string;
  grade: number;
  studentCount: number;
  baseScore: number;
  studentNetAvg: number;
  studentNetSum: number;
  classEventNet: number;
  transferPoints: number;
  achievementPoints: number;
  violationPoints: number;
  totalScore: number;
  recordCount: number;
  violationCount: number;
  achievementCount: number;
  rank: number;
  rankDelta?: number;
  titleAwarded?: string;
}

export function matchTitleForSummary(
  scope: 'student' | 'class',
  totalScore: number,
  violationCount: number,
  achievementCount: number,
  titles: EmulationTitleConfig[] = DEFAULT_EMULATION_TITLES
): string | undefined {
  const candidates = titles
    .filter((t) => t.targetScope === scope)
    .sort((a, b) => b.minScore - a.minScore);
  for (const t of candidates) {
    if (totalScore < t.minScore) continue;
    if (t.maxViolations !== undefined && violationCount > t.maxViolations) continue;
    if (t.minAchievements !== undefined && achievementCount < t.minAchievements) continue;
    return t.name;
  }
  return undefined;
}

export function computeStudentEmulationSummaries(params: {
  students: Student[];
  records: EmulationRecord[];
  transfers?: ScoreTransferRecord[];
  policy?: EmulationPolicy;
  startDate?: string;
  endDate?: string;
  previousRankMap?: Map<string, number>;
  titles?: EmulationTitleConfig[];
}): StudentEmulationSummary[] {
  const {
    students,
    records,
    transfers = [],
    policy = DEFAULT_EMULATION_POLICY,
    startDate,
    endDate,
    previousRankMap,
    titles = DEFAULT_EMULATION_TITLES,
  } = params;

  const countedRecords = records.filter(
    (r) =>
      r.targetType === 'individual' &&
      r.studentId &&
      isEmulationRecordCounted(r, policy) &&
      isDateInRange(r.occurredAt, startDate, endDate)
  );

  // Also include direct synced transfers not already duplicated as records
  const syncedTransfersByStudent = new Map<string, number>();
  const transferRecordIds = new Set(countedRecords.map((r) => r.sourceTransferId).filter(Boolean));
  for (const tr of transfers) {
    if (
      tr.syncStatus === 'synced' &&
      tr.targetType === 'student' &&
      !transferRecordIds.has(tr.id) &&
      isDateInRange(tr.syncedAt, startDate, endDate)
    ) {
      syncedTransfersByStudent.set(
        tr.targetId,
        (syncedTransfersByStudent.get(tr.targetId) || 0) + tr.pointsTransferred
      );
    }
  }

  const summaries: StudentEmulationSummary[] = students.map((stu) => {
    const stuRecs = countedRecords.filter((r) =>
      r.studentId
        ? r.studentId === stu.id
        : Boolean(stu.studentCode && r.studentCode === stu.studentCode)
    );
    let achievementPoints = 0;
    let violationPoints = 0;
    let transferPoints = syncedTransfersByStudent.get(stu.id) || 0;
    let achievementCount = 0;
    let violationCount = 0;

    for (const r of stuRecs) {
      if (r.sourceTransferId) {
        transferPoints += r.pointsApplied;
      } else if (r.pointsApplied >= 0) {
        achievementPoints += r.pointsApplied;
        achievementCount++;
      } else {
        violationPoints += r.pointsApplied;
        violationCount++;
      }
    }

    const rawTotal = policy.startingScore + achievementPoints + violationPoints + transferPoints;
    const totalScore = clampScore(rawTotal, policy);
    const titleAwarded = matchTitleForSummary('student', totalScore, violationCount, achievementCount, titles);

    return {
      studentId: stu.id,
      studentCode: stu.studentCode,
      studentName: stu.fullName,
      classId: stu.classId,
      className: stu.className,
      grade: stu.grade,
      baseScore: policy.startingScore,
      achievementPoints: Math.round(achievementPoints * 100) / 100,
      violationPoints: Math.round(violationPoints * 100) / 100,
      transferPoints: Math.round(transferPoints * 100) / 100,
      totalScore,
      achievementCount,
      violationCount,
      recordCount: stuRecs.length,
      rank: 0,
      titleAwarded,
    };
  });

  summaries.sort((a, b) => b.totalScore - a.totalScore || a.violationCount - b.violationCount || a.studentName.localeCompare(b.studentName, 'vi'));

  let currentRank = 0;
  let prevScore: number | null = null;
  summaries.forEach((item, idx) => {
    if (prevScore === null || item.totalScore < prevScore) {
      currentRank = idx + 1;
      prevScore = item.totalScore;
    }
    item.rank = currentRank;
    if (previousRankMap?.has(item.studentId)) {
      item.rankDelta = previousRankMap.get(item.studentId)! - item.rank;
    }
  });

  return summaries;
}

export function computeClassEmulationSummaries(params: {
  classes: SchoolClass[];
  students: Student[];
  records: EmulationRecord[];
  transfers?: ScoreTransferRecord[];
  policy?: EmulationPolicy;
  startDate?: string;
  endDate?: string;
  previousRankMap?: Map<string, number>;
  titles?: EmulationTitleConfig[];
}): ClassEmulationSummary[] {
  const {
    classes,
    students,
    records,
    transfers = [],
    policy = DEFAULT_EMULATION_POLICY,
    startDate,
    endDate,
    previousRankMap,
    titles = DEFAULT_EMULATION_TITLES,
  } = params;

  const studentSummaries = computeStudentEmulationSummaries({
    students,
    records,
    transfers,
    policy,
    startDate,
    endDate,
    titles,
  });

  const countedClassRecords = records.filter(
    (r) =>
      r.targetType === 'class' &&
      isEmulationRecordCounted(r, policy) &&
      isDateInRange(r.occurredAt, startDate, endDate)
  );

  const transferRecordIds = new Set(countedClassRecords.map((r) => r.sourceTransferId).filter(Boolean));
  const extraClassTransfers = new Map<string, number>();
  for (const tr of transfers) {
    if (
      tr.syncStatus === 'synced' &&
      tr.targetType === 'class' &&
      !transferRecordIds.has(tr.id) &&
      isDateInRange(tr.syncedAt, startDate, endDate)
    ) {
      extraClassTransfers.set(
        tr.targetId,
        (extraClassTransfers.get(tr.targetId) || 0) + tr.pointsTransferred
      );
    }
  }

  const summaries: ClassEmulationSummary[] = classes.map((cls) => {
    const classStudents = studentSummaries.filter(
      (s) => s.classId === cls.id || s.className === cls.code || s.className === cls.name
    );
    const classEvents = countedClassRecords.filter(
      (r) => r.classId === cls.id || r.className === cls.code || r.className === cls.name
    );

    const studentNetDelta = classStudents.reduce(
      (sum, s) => sum + (s.totalScore - s.baseScore),
      0
    );
    const studentNetAvg = classStudents.length > 0 ? studentNetDelta / classStudents.length : 0;

    let classAch = 0;
    let classViol = 0;
    let classTransfer = extraClassTransfers.get(cls.id) || 0;
    let violCount = classStudents.reduce((s, x) => s + x.violationCount, 0);
    let achCount = classStudents.reduce((s, x) => s + x.achievementCount, 0);

    for (const r of classEvents) {
      if (r.sourceTransferId) {
        classTransfer += r.pointsApplied;
      } else if (r.pointsApplied >= 0) {
        classAch += r.pointsApplied;
        achCount++;
      } else {
        classViol += r.pointsApplied;
        violCount++;
      }
    }

    const classEventNet = classAch + classViol + classTransfer;
    let delta = 0;
    switch (policy.classFormula) {
      case 'sum_students':
        delta = studentNetDelta;
        break;
      case 'class_events_only':
        delta = classEventNet;
        break;
      case 'average_students':
        delta = studentNetAvg;
        break;
      case 'combined_formula':
      default:
        delta = studentNetAvg * policy.studentWeight + classEventNet * policy.classEventWeight;
        break;
    }

    const totalScore = clampScore(policy.startingScore + delta, policy);
    const totalRecords =
      classEvents.length + classStudents.reduce((s, x) => s + x.recordCount, 0);

    const achAll =
      classAch + classStudents.reduce((s, x) => s + x.achievementPoints, 0);
    const violAll =
      classViol + classStudents.reduce((s, x) => s + x.violationPoints, 0);

    return {
      classId: cls.id,
      className: cls.name,
      homeroomTeacherName: cls.homeroomTeacherName,
      grade: cls.grade,
      studentCount: classStudents.length || cls.studentCount,
      baseScore: policy.startingScore,
      studentNetAvg: Math.round(studentNetAvg * 100) / 100,
      studentNetSum: Math.round(studentNetDelta * 100) / 100,
      classEventNet: Math.round(classEventNet * 100) / 100,
      transferPoints: Math.round(classTransfer * 100) / 100,
      achievementPoints: Math.round(achAll * 100) / 100,
      violationPoints: Math.round(violAll * 100) / 100,
      totalScore,
      recordCount: totalRecords,
      violationCount: violCount,
      achievementCount: achCount,
      rank: 0,
      titleAwarded: matchTitleForSummary('class', totalScore, violCount, achCount, titles),
    };
  });

  summaries.sort((a, b) => b.totalScore - a.totalScore || a.violationCount - b.violationCount || a.className.localeCompare(b.className, 'vi'));

  let currentRank = 0;
  let prevScore: number | null = null;
  summaries.forEach((item, idx) => {
    if (prevScore === null || item.totalScore < prevScore) {
      currentRank = idx + 1;
      prevScore = item.totalScore;
    }
    item.rank = currentRank;
    if (previousRankMap?.has(item.classId)) {
      item.rankDelta = previousRankMap.get(item.classId)! - item.rank;
    }
  });

  return summaries;
}

export function buildPeriodSnapshotEntries(params: {
  students: Student[];
  classes: SchoolClass[];
  records: EmulationRecord[];
  transfers: ScoreTransferRecord[];
  policy: EmulationPolicy;
  startDate: string;
  endDate: string;
}): EmulationSnapshotEntry[] {
  const stuSummaries = computeStudentEmulationSummaries(params);
  const clsSummaries = computeClassEmulationSummaries(params);

  const studentEntries: EmulationSnapshotEntry[] = stuSummaries.map((s) => ({
    targetType: 'student',
    targetId: s.studentId,
    targetName: s.studentName,
    className: s.className,
    grade: s.grade,
    rank: s.rank,
    totalScore: s.totalScore,
    achievementPoints: s.achievementPoints,
    violationPoints: s.violationPoints,
    transferPoints: s.transferPoints,
    recordCount: s.recordCount,
    titleAwarded: s.titleAwarded,
  }));

  const classEntries: EmulationSnapshotEntry[] = clsSummaries.map((c) => ({
    targetType: 'class',
    targetId: c.classId,
    targetName: c.className,
    className: c.className,
    grade: c.grade,
    rank: c.rank,
    totalScore: c.totalScore,
    achievementPoints: c.achievementPoints,
    violationPoints: c.violationPoints,
    transferPoints: c.transferPoints,
    recordCount: c.recordCount,
    titleAwarded: c.titleAwarded,
  }));

  return [...classEntries, ...studentEntries];
}

export function resolveAppealEffect(params: {
  appeal: EmulationAppeal;
  record: EmulationRecord;
  decision: 'accepted' | 'rejected';
  resolutionNote: string;
  reviewedBy: string;
  adjustedPoints?: number;
}): {
  updatedAppeal: EmulationAppeal;
  updatedRecord: EmulationRecord;
} {
  const { appeal, record, decision, resolutionNote, reviewedBy, adjustedPoints } = params;
  const now = new Date().toISOString();

  const updatedRecord: EmulationRecord =
    decision === 'accepted'
      ? adjustedPoints !== undefined && adjustedPoints !== null
        ? {
            ...record,
            pointsApplied: adjustedPoints,
            pointsOverridden: true,
            overrideReason: `Điều chỉnh theo khiếu nại (${appeal.id}): ${resolutionNote}`,
            updatedAt: now,
          }
        : {
            ...record,
            status: 'cancelled',
            overrideReason: `Hủy theo khiếu nại được chấp nhận (${appeal.id}): ${resolutionNote}`,
            updatedAt: now,
          }
      : record;

  const updatedAppeal: EmulationAppeal = {
    ...appeal,
    status: decision,
    reviewedBy,
    resolutionNote,
    adjustedPoints,
    updatedAt: now,
    history: [
      ...appeal.history,
      {
        timestamp: now,
        actorName: reviewedBy,
        actorRole: 'principal',
        status: decision,
        note: resolutionNote,
      },
    ],
  };

  return { updatedAppeal, updatedRecord };
}

/* ================== COMPETITIONS & ANTI-DOUBLE-COUNT TRANSFERS ================== */

export function syncCompetitionStatusByDate(
  competition: Competition,
  referenceDateStr: string = new Date().toISOString().split('T')[0]
): CompetitionStatus {
  if (competition.status === 'archived' || competition.manualStatusLocked) {
    return competition.status;
  }
  if (referenceDateStr < competition.startDate) return 'upcoming';
  if (referenceDateStr > competition.endDate) return 'closed';
  return 'ongoing';
}

export interface CompetitionLeaderboardRow {
  participantId: string;
  targetType: 'student' | 'class' | 'group';
  targetId: string;
  targetName: string;
  className?: string;
  grade?: number;
  totalPoints: number;
  criterionBreakdown: Record<string, number>;
  rank: number;
  alreadyTransferred: boolean;
  transferredPoints?: number;
}

export function buildCompetitionLeaderboard(params: {
  competitionId: string;
  participants: CompetitionParticipant[];
  criteria: CompetitionCriterion[];
  scores: CompetitionScore[];
  existingTransfers?: ScoreTransferRecord[];
}): CompetitionLeaderboardRow[] {
  const { competitionId, participants, criteria, scores, existingTransfers = [] } = params;
  const compParticipants = participants.filter(
    (p) => p.competitionId === competitionId && p.status !== 'withdrawn'
  );
  const compCriteria = criteria.filter((c) => c.competitionId === competitionId);
  const weightMap = new Map(compCriteria.map((c) => [c.id, c.weight || 1]));

  const activeTransferMap = new Map<string, ScoreTransferRecord>();
  for (const tr of existingTransfers) {
    if (tr.competitionId === competitionId && tr.syncStatus === 'synced') {
      activeTransferMap.set(tr.participantId, tr);
    }
  }

  const rows: CompetitionLeaderboardRow[] = compParticipants.map((p) => {
    const pScores = scores.filter(
      (s) => s.competitionId === competitionId && s.participantId === p.id
    );
    const breakdown: Record<string, number> = {};
    let totalPoints = 0;

    for (const s of pScores) {
      const weight = weightMap.get(s.criterionId) ?? 1;
      const weighted = Math.round(s.score * weight * 100) / 100;
      breakdown[s.criterionId] = (breakdown[s.criterionId] || 0) + weighted;
      totalPoints += weighted;
    }

    const activeTr = activeTransferMap.get(p.id);
    return {
      participantId: p.id,
      targetType: p.targetType,
      targetId: p.targetId,
      targetName: p.targetName,
      className: p.className,
      grade: p.grade,
      totalPoints: Math.round(totalPoints * 100) / 100,
      criterionBreakdown: breakdown,
      rank: 0,
      alreadyTransferred: Boolean(activeTr),
      transferredPoints: activeTr?.pointsTransferred,
    };
  });

  rows.sort((a, b) => b.totalPoints - a.totalPoints || a.targetName.localeCompare(b.targetName, 'vi'));

  let currentRank = 0;
  let prevScore: number | null = null;
  rows.forEach((r, idx) => {
    if (prevScore === null || r.totalPoints < prevScore) {
      currentRank = idx + 1;
      prevScore = r.totalPoints;
    }
    r.rank = currentRank;
  });

  return rows;
}

export function calculateCompetitionTransferPoints(
  rawPoints: number,
  competition: Pick<Competition, 'transferMode' | 'ratioDivisor' | 'maxTransferPoints'>
): number {
  if (competition.transferMode === 'standalone' || rawPoints <= 0) return 0;
  let converted = rawPoints;
  if (competition.transferMode === 'ratio_transfer') {
    const divisor = competition.ratioDivisor && competition.ratioDivisor > 0 ? competition.ratioDivisor : 10;
    converted = rawPoints / divisor;
  }
  converted = Math.round(converted * 100) / 100;
  if (competition.maxTransferPoints && competition.maxTransferPoints > 0) {
    converted = Math.min(converted, competition.maxTransferPoints);
  }
  return converted;
}

export function planCompetitionTransferToEmulation(params: {
  competition: Competition;
  leaderboard: CompetitionLeaderboardRow[];
  existingTransfers: ScoreTransferRecord[];
  approvedBy: string;
  approvedById: string;
}): {
  newTransfers: ScoreTransferRecord[];
  newEmulationRecords: EmulationRecord[];
  skippedAlreadyTransferred: number;
  blockedReason?: string;
} {
  const { competition, leaderboard, existingTransfers, approvedBy, approvedById } = params;

  if (competition.transferMode === 'standalone') {
    return {
      newTransfers: [],
      newEmulationRecords: [],
      skippedAlreadyTransferred: 0,
      blockedReason: 'Phong trào đang ở chế độ Độc lập (không cộng vào thi đua chung).',
    };
  }

  if (competition.transferMode === 'transfer_on_close' && competition.status !== 'closed' && competition.status !== 'archived') {
    return {
      newTransfers: [],
      newEmulationRecords: [],
      skippedAlreadyTransferred: 0,
      blockedReason: 'Chế độ Quy đổi khi kết thúc đợt chỉ cho phép đồng bộ khi phong trào đã Đóng/Kết thúc.',
    };
  }

  // Anti-double-count invariant: check active synced records by sourceId (`competitionId__participantId`)
  const activeSourceIds = new Set(
    existingTransfers
      .filter((t) => t.syncStatus === 'synced')
      .map((t) => t.sourceId)
  );

  const now = new Date().toISOString();
  const today = now.split('T')[0];
  const newTransfers: ScoreTransferRecord[] = [];
  const newEmulationRecords: EmulationRecord[] = [];
  let skippedAlreadyTransferred = 0;

  for (const row of leaderboard) {
    const sourceId = `${competition.id}__${row.participantId}`;
    if (activeSourceIds.has(sourceId)) {
      skippedAlreadyTransferred++;
      continue;
    }

    const pointsToTransfer = calculateCompetitionTransferPoints(row.totalPoints, competition);
    if (pointsToTransfer <= 0) continue;

    const suffix = `${Date.now().toString().slice(-4)}_${Math.random().toString(36).slice(2, 5)}`;
    const transferId = `TRF-${competition.id.slice(-6)}-${suffix}`;
    const emulationRecordId = `EMU-TRF-${suffix}`;

    newTransfers.push({
      id: transferId,
      sourceId,
      competitionId: competition.id,
      competitionName: competition.name,
      participantId: row.participantId,
      targetType: row.targetType,
      targetId: row.targetId,
      targetName: row.targetName,
      className: row.className,
      emulationRecordId,
      rawCompetitionPoints: row.totalPoints,
      pointsTransferred: pointsToTransfer,
      transferMode: competition.transferMode,
      syncStatus: 'synced',
      syncedAt: now,
      approvedBy,
    });

    newEmulationRecords.push({
      id: emulationRecordId,
      recordCode: `TD-PT-${suffix.toUpperCase()}`,
      targetType: row.targetType === 'student' ? 'individual' : row.targetType === 'class' ? 'class' : 'group',
      studentId: row.targetType === 'student' ? row.targetId : undefined,
      studentName: row.targetType === 'student' ? row.targetName : undefined,
      classId: row.targetType === 'class' ? row.targetId : undefined,
      className: row.className || (row.targetType === 'class' ? row.targetName : undefined),
      grade: row.grade,
      groupName: row.targetType === 'group' ? row.targetName : undefined,
      criterionId: competition.targetCriterionId || `COMP-${competition.code}`,
      criterionName: `Quy đổi phong trào: ${competition.name}`,
      categoryName: 'Phong trào & Cuộc thi',
      type: 'achievement',
      pointsApplied: pointsToTransfer,
      occurredAt: today,
      description: `Đồng bộ tự động từ "${competition.name}" (${row.totalPoints} điểm phong trào → +${pointsToTransfer} điểm thi đua).`,
      reporterId: approvedById,
      reporterName: approvedBy,
      reporterRole: 'principal',
      status: 'recorded',
      approvedBy,
      approvedAt: now,
      sourceCompetitionId: competition.id,
      sourceTransferId: transferId,
      createdAt: now,
    });
  }

  return {
    newTransfers,
    newEmulationRecords,
    skippedAlreadyTransferred,
  };
}

export function revertCompetitionTransfer(params: {
  transfer: ScoreTransferRecord;
  revertedBy: string;
  revertReason: string;
}): {
  updatedTransfer: ScoreTransferRecord;
  cancelledEmulationRecordId: string;
} {
  const now = new Date().toISOString();
  return {
    updatedTransfer: {
      ...params.transfer,
      syncStatus: 'reverted',
      revertedAt: now,
      revertedBy: params.revertedBy,
      revertReason: params.revertReason.trim() || 'Hoàn tác đồng bộ phong trào',
    },
    cancelledEmulationRecordId: params.transfer.emulationRecordId,
  };
}

/* ================== DETERMINISTIC RULE DOCUMENT PARSER FALLBACK ================== */

export function parseRuleClausesLocally(rawText: string): AIExtractedRuleItem[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 6);

  let currentGroup = 'Quy định chung';
  const items: AIExtractedRuleItem[] = [];
  let seq = 1;

  for (const line of lines) {
    // Detect section/group heading e.g. "I. Nề nếp", "Phần 2:", "Điều 3.", "1. Chuyên cần"
    if (/^(CHƯƠNG|PHẦN|MỤC|[IVXLCDM]+\.)\s+/i.test(line) && line.length < 90) {
      currentGroup = line.replace(/^(CHƯƠNG|PHẦN|MỤC|[IVXLCDM]+\.)\s+/i, '').trim();
      continue;
    }

    const isBulletOrClause = /^(\d+(\.\d+)*[.)]|[-•*]|Điều\s+\d+[:.]?)\s+/i.test(line);
    if (!isBulletOrClause && line.length < 18) continue;

    const cleanClause = line.replace(/^(\d+(\.\d+)*[.)]|[-•*]|Điều\s+\d+[:.]?)\s+/i, '').trim();
    if (!cleanClause) continue;

    // Extract explicit points ONLY if clearly stated in text
    // Match patterns like "(-5 điểm)", "trừ 3 điểm", "cộng 10 điểm", "+5đ", "-2 điểm"
    let pointsSpecified = false;
    let points: number | null = null;
    const explicitMatch = cleanClause.match(
      /(?:(trừ|phạt|cộng|thưởng)\s*(\d+(?:[.,]\d+)?)\s*(?:điểm|đ)\b)|([+-]\s*\d+(?:[.,]\d+)?)\s*(?:điểm|đ)\b/i
    );

    if (explicitMatch) {
      if (explicitMatch[2]) {
        const val = parseFloat(explicitMatch[2].replace(',', '.'));
        const isMinus = /^(trừ|phạt)/i.test(explicitMatch[1]);
        points = isMinus ? -Math.abs(val) : Math.abs(val);
        pointsSpecified = !Number.isNaN(val);
      } else if (explicitMatch[3]) {
        const val = parseFloat(explicitMatch[3].replace(/\s+/g, '').replace(',', '.'));
        points = val;
        pointsSpecified = !Number.isNaN(val);
      }
    }

    const isViolation =
      /(vi phạm|cấm|không được|trễ|muộn|vắng|bỏ tiết|gian lận|đánh nhau|gây mất trật tự|trừ|phạt|xả rác|sai đồng phục|điện thoại)/i.test(
        cleanClause
      ) && !(/(khen thưởng|thành tích|giải\s+(nhất|nhì|ba)|tuyên dương|tích cực|cộng\s+\d+)/i.test(cleanClause));

    const isClassTarget = /(tập thể lớp|toàn lớp|lớp đạt|chi đoàn)/i.test(cleanClause);
    const isHonor =
      !isViolation &&
      /(vinh danh|tuyên dương|khen thưởng|giấy khen|danh hiệu|cờ thi đua|nêu gương|bảng vàng|xuất sắc|nhặt được của rơi|giải\s+(nhất|nhì|ba|khuyến khích))/i.test(
        cleanClause
      );
    const honorMatch = cleanClause.match(/(tuyên dương dưới cờ|giấy khen[^,;.]*|cờ thi đua[^,;.]*|bảng vàng[^,;.]*)/i);

    items.push({
      tempId: `EXT-${seq++}`,
      group: currentGroup,
      name: cleanClause.length > 68 ? `${cleanClause.slice(0, 65)}...` : cleanClause,
      description: cleanClause,
      behavior: cleanClause,
      type: isViolation ? 'violation' : 'achievement',
      pointsSpecified,
      points,
      isHonor,
      ...(isHonor && honorMatch ? { honorNote: honorMatch[1].trim() } : {}),
      target: isClassTarget ? 'class' : 'individual',
      sourceClause: line.slice(0, 120),
      confidence: pointsSpecified ? 0.88 : 0.72,
      selected: true,
    });
  }

  return items;
}

export function buildWorkbookFromAiRuleCriteria(
  items: AIExtractedRuleItem[],
  fileName: string,
  existingCriteria: RuleCriterion[] = []
): ParsedWorkbookData {
  const selected = items.filter((item) => item.selected !== false && item.name.trim().length > 0);
  const usedCodes = new Set(
    existingCriteria.map((c) => c.code.trim().toUpperCase()).filter(Boolean)
  );

  let nextSeq = 1;
  const allocateCode = (): string => {
    while (true) {
      const candidate = `NQ-${String(nextSeq).padStart(3, '0')}`;
      nextSeq++;
      if (!usedCodes.has(candidate)) {
        usedCodes.add(candidate);
        return candidate;
      }
    }
  };

  const headers = [
    'Mã tiêu chí *',
    'Nhóm tiêu chí *',
    'Tên tiêu chí *',
    'Loại *',
    'Số điểm',
    'Đối tượng áp dụng *',
    'Mức độ',
    'Vinh danh',
    'Hình thức vinh danh',
    'Hành vi / Quy định *',
    'Điều kiện / Ghi chú',
  ];

  const rows: Record<string, unknown>[] = selected.map((item) => {
    const code = allocateCode();
    const isViolation = item.type !== 'achievement';
    const hasPoints =
      Boolean(item.pointsSpecified) &&
      item.points !== null &&
      item.points !== undefined &&
      Number.isFinite(Number(item.points));
    const signedPoints = hasPoints
      ? isViolation
        ? -Math.abs(Number(item.points))
        : Math.abs(Number(item.points))
      : '';
    const isHonor = isViolation ? false : Boolean(item.isHonor);
    const cleanName = item.name.trim().slice(0, 180);
    const cleanBehavior = (item.behavior || item.description || item.name).trim();

    return {
      'Mã tiêu chí *': code,
      'Nhóm tiêu chí *': (item.group || 'Quy định chung').trim().slice(0, 120),
      'Tên tiêu chí *': cleanName,
      'Loại *': isViolation ? 'violation' : 'achievement',
      'Số điểm': signedPoints,
      'Đối tượng áp dụng *':
        item.target === 'class' || item.target === 'group' ? item.target : 'individual',
      'Mức độ':
        item.severity === 'Nhẹ' || item.severity === 'Trung bình' || item.severity === 'Nghiêm trọng'
          ? item.severity
          : '',
      'Vinh danh': isHonor ? 'Vinh danh' : 'Không vinh danh',
      'Hình thức vinh danh': isHonor && item.honorNote ? item.honorNote.trim().slice(0, 180) : '',
      'Hành vi / Quy định *': cleanBehavior,
      'Điều kiện / Ghi chú': (item.condition || '').trim(),
    };
  });

  return {
    fileName,
    sheetNames: ['DATA'],
    dataSheetName: 'DATA',
    dataSheetNames: ['DATA'],
    headers,
    sheetHeaders: { DATA: headers },
    rows,
    rowItems: rows.map((row, idx) => ({
      sheetName: 'DATA',
      rowNumber: idx + 2,
      row,
    })),
    extraSheets: {},
  };
}

export function synthesizeMissingRuleCategories(
  criteria: RuleCriterion[],
  existingCategories: RuleCategory[]
): RuleCategory[] {
  const existingById = new Set(existingCategories.map((c) => c.id));
  const existingByName = new Set(existingCategories.map((c) => c.name.trim().toLowerCase()));
  const existingCodes = new Set(existingCategories.map((c) => c.code.trim().toUpperCase()));

  const created: RuleCategory[] = [];
  let orderCounter = existingCategories.length + 1;

  for (const crit of criteria) {
    const rawName = (crit.categoryName || '').trim();
    if (!rawName) continue;
    const normalizedName = rawName.toLowerCase();
    const catId = (crit.categoryId || sanitizeFirestoreDocId(`CAT-${rawName}`, 'CAT')).slice(0, 24);
    if (existingById.has(catId) || existingByName.has(normalizedName)) continue;

    let code = `NHOM-${String(orderCounter).padStart(2, '0')}`;
    while (existingCodes.has(code)) {
      orderCounter++;
      code = `NHOM-${String(orderCounter).padStart(2, '0')}`;
    }

    const canonicalGroup = findCanonicalRuleGroup(rawName);
    const preferredOrder = canonicalGroup ? canonicalGroup.order : orderCounter;

    existingById.add(catId);
    existingByName.add(normalizedName);
    existingCodes.add(code);

    created.push({
      id: catId,
      code: code.slice(0, 64),
      name: rawName.slice(0, 120),
      order: preferredOrder,
      status: 'active',
    });
    orderCounter++;
  }

  return created;
}

export function canDeleteRuleCriterion(
  criterionId: string,
  records: EmulationRecord[]
): { allowed: boolean; reason?: string; referencedCount: number } {
  const referencedCount = records.filter((r) => r.criterionId === criterionId).length;
  if (referencedCount > 0) {
    return {
      allowed: false,
      referencedCount,
      reason: `Tiêu chí đang được tham chiếu bởi ${referencedCount} bản ghi thi đua. Hãy chuyển trạng thái "Ngừng áp dụng" để bảo toàn lịch sử điểm.`,
    };
  }
  return { allowed: true, referencedCount: 0 };
}

export function createCategoryMap(categories: RuleCategory[]): Map<string, RuleCategory> {
  return new Map(categories.map((c) => [c.id, c]));
}
