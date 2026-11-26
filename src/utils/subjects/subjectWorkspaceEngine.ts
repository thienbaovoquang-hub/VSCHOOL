import type {
  AcademicRecord,
  Assignment,
  AssignmentSubmission,
  LearningMaterial,
  Teacher,
  TimetableEntry,
  UserProfile,
} from '../../types';
import { ELEMENT_BY_SYMBOL } from '../../data/chemistryElements.ts';
import {
  getSubjectById,
  SUBJECT_CATALOG,
  type SubjectId,
} from '../subjectRegistry.ts';

/* ============================================================================
   1. CROSS-WEB UNIFICATION WITH VSCHOOL (Grades, Timetable, Assignments, Materials)
   ============================================================================ */

export function normalizeSubjectToken(raw: string | undefined | null): string {
  return String(raw || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function doesLabelMatchSubject(label: string | undefined | null, subjectId: SubjectId): boolean {
  const norm = normalizeSubjectToken(label);
  if (!norm) return false;
  if (norm === subjectId) return true;
  const def = getSubjectById(subjectId);
  if (!def) return false;

  const aliases = def.matchAliases.map((a) => normalizeSubjectToken(a));
  return aliases.some(
    (alias) =>
      norm === alias ||
      norm.startsWith(`${alias} `) ||
      norm.endsWith(` ${alias}`) ||
      (alias.length >= 4 && norm.includes(alias))
  );
}

export interface SubjectSchoolContext {
  subjectId: SubjectId;
  academicRecords: AcademicRecord[];
  myAverageScore: number | null;
  timetableSlots: TimetableEntry[];
  assignments: Assignment[];
  submissionByAssignmentId: Record<string, AssignmentSubmission>;
  materials: LearningMaterial[];
  teachers: Teacher[];
  pendingAssignmentCount: number;
}

export function matchSubjectSchoolContext(params: {
  subjectId: SubjectId;
  currentUser: UserProfile;
  academicRecords: AcademicRecord[];
  timetable: TimetableEntry[];
  assignments: Assignment[];
  assignmentSubmissions: AssignmentSubmission[];
  learningMaterials: LearningMaterial[];
  teachers: Teacher[];
}): SubjectSchoolContext {
  const {
    subjectId,
    currentUser,
    academicRecords,
    timetable,
    assignments,
    assignmentSubmissions,
    learningMaterials,
    teachers,
  } = params;

  const isStudent = currentUser.role === 'student';
  const isTeacher =
    currentUser.role === 'subject_teacher' || currentUser.role === 'homeroom_teacher';
  const userClass = String(currentUser.className || '').trim().toLowerCase();
  const assignedSet = new Set(
    (currentUser.assignedClasses || []).map((c) => c.trim().toLowerCase()).filter(Boolean)
  );
  if (userClass) assignedSet.add(userClass);

  const matchesClassScope = (className?: string) => {
    const cNorm = String(className || '').trim().toLowerCase();
    if (!cNorm) return true;
    if (isStudent && userClass) return cNorm === userClass;
    if (isTeacher && assignedSet.size > 0) return assignedSet.has(cNorm);
    return true;
  };

  const matchedRecords = academicRecords.filter((rec) => {
    const matchesSubj =
      doesLabelMatchSubject(rec.subjectId, subjectId) ||
      doesLabelMatchSubject(rec.subjectName, subjectId);
    if (!matchesSubj) return false;
    if (isStudent) {
      if (currentUser.linkedProfileId && rec.studentId === currentUser.linkedProfileId) return true;
      if (currentUser.studentCode && rec.studentCode === currentUser.studentCode) return true;
      if (rec.studentId === currentUser.id) return true;
      return false;
    }
    return matchesClassScope(rec.className);
  });

  const myAverageScore =
    matchedRecords.length > 0
      ? Number(
          (
            matchedRecords.reduce((acc, r) => acc + (Number(r.averageScore) || 0), 0) /
            matchedRecords.length
          ).toFixed(2)
        )
      : null;

  const timetableSlots = timetable
    .filter(
      (slot) =>
        doesLabelMatchSubject(slot.subject, subjectId) && matchesClassScope(slot.className)
    )
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.period - b.period);

  const matchedAssignments = assignments
    .filter(
      (a) => doesLabelMatchSubject(a.subject, subjectId) && matchesClassScope(a.className)
    )
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

  const submissionByAssignmentId: Record<string, AssignmentSubmission> = {};
  for (const sub of assignmentSubmissions) {
    if (isStudent) {
      const isMine =
        sub.studentId === currentUser.id ||
        (currentUser.linkedProfileId && sub.studentId === currentUser.linkedProfileId) ||
        (currentUser.studentCode && sub.studentCode === currentUser.studentCode);
      if (isMine) {
        submissionByAssignmentId[sub.assignmentId] = sub;
      }
    } else if (!submissionByAssignmentId[sub.assignmentId]) {
      submissionByAssignmentId[sub.assignmentId] = sub;
    }
  }

  const pendingAssignmentCount = matchedAssignments.filter(
    (a) => a.status === 'open' && !submissionByAssignmentId[a.id]
  ).length;

  const matchedMaterials = learningMaterials
    .filter((m) => {
      if (!doesLabelMatchSubject(m.subject, subjectId)) return false;
      if (isStudent && currentUser.grade && m.grade && m.grade !== currentUser.grade) {
        return false;
      }
      return true;
    })
    .sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));

  const matchedTeachers = teachers.filter((t) =>
    doesLabelMatchSubject(t.subject, subjectId)
  );

  return {
    subjectId,
    academicRecords: matchedRecords,
    myAverageScore,
    timetableSlots,
    assignments: matchedAssignments,
    submissionByAssignmentId,
    materials: matchedMaterials,
    teachers: matchedTeachers,
    pendingAssignmentCount,
  };
}

/* ============================================================================
   2. PER-USER STUDY PROGRESS PERSISTENCE
   ============================================================================ */

export interface SubjectStudyProgress {
  masteredIds: string[];
  bookmarkedIds: string[];
  notesByItemId: Record<string, string>;
  practiceAttempts: number;
  lastScoreLabel?: string;
  lastScorePercent?: number;
  updatedAt: string;
}

export type SubjectProgressMap = Partial<Record<SubjectId, SubjectStudyProgress>>;

const PROGRESS_KEY_PREFIX = 'vschool_subjects_progress_v1_';

export function emptySubjectProgress(): SubjectStudyProgress {
  return {
    masteredIds: [],
    bookmarkedIds: [],
    notesByItemId: {},
    practiceAttempts: 0,
    updatedAt: new Date().toISOString(),
  };
}

export function loadUserSubjectProgressMap(userId: string): SubjectProgressMap {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(`${PROGRESS_KEY_PREFIX}${userId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SubjectProgressMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveUserSubjectProgressMap(userId: string, map: SubjectProgressMap): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(`${PROGRESS_KEY_PREFIX}${userId}`, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

export function updateSubjectProgress(
  map: SubjectProgressMap,
  subjectId: SubjectId,
  updater: (prev: SubjectStudyProgress) => SubjectStudyProgress
): SubjectProgressMap {
  const prev = map[subjectId] || emptySubjectProgress();
  return {
    ...map,
    [subjectId]: {
      ...updater(prev),
      updatedAt: new Date().toISOString(),
    },
  };
}

export function computeOverviewMetrics(params: {
  progressMap: SubjectProgressMap;
  schoolContexts: Record<SubjectId, SubjectSchoolContext>;
}) {
  const perSubject = SUBJECT_CATALOG.map((subj) => {
    const prog = params.progressMap[subj.id];
    const ctx = params.schoolContexts[subj.id];
    return {
      subjectId: subj.id,
      title: subj.title,
      masteredCount: prog?.masteredIds.length || 0,
      practiceAttempts: prog?.practiceAttempts || 0,
      lastScorePercent: prog?.lastScorePercent ?? null,
      lastScoreLabel: prog?.lastScoreLabel,
      schoolAverage: ctx?.myAverageScore ?? null,
      pendingAssignments: ctx?.pendingAssignmentCount ?? 0,
      timetableCount: ctx?.timetableSlots.length ?? 0,
      materialsCount: ctx?.materials.length ?? 0,
    };
  });

  return {
    totalMastered: perSubject.reduce((s, x) => s + x.masteredCount, 0),
    totalPracticeAttempts: perSubject.reduce((s, x) => s + x.practiceAttempts, 0),
    totalPendingAssignments: perSubject.reduce((s, x) => s + x.pendingAssignments, 0),
    totalMaterials: perSubject.reduce((s, x) => s + x.materialsCount, 0),
    perSubject,
  };
}

/* ============================================================================
   3. MATH ENGINE (Safe Expression Parser & 2D Triangle Explorer)
   ============================================================================ */

type MathToken =
  | { type: 'num'; value: number }
  | { type: 'var'; name: 'x' }
  | { type: 'fn'; name: string }
  | { type: 'op'; op: string }
  | { type: 'lparen' }
  | { type: 'rparen' };

const MATH_CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

const MATH_FUNCTIONS = new Set([
  'sin',
  'cos',
  'tan',
  'sqrt',
  'abs',
  'ln',
  'log',
  'exp',
]);

function tokenizeMathExpression(raw: string): MathToken[] {
  const s = raw.trim().toLowerCase().replace(/\s+/g, '').replace(/,/g, '.');
  if (!s) return [];
  const rawTokens: MathToken[] = [];
  let i = 0;

  while (i < s.length) {
    const ch = s[i];
    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      while (i < s.length && /[0-9.]/.test(s[i])) {
        numStr += s[i++];
      }
      const value = Number(numStr);
      if (!Number.isFinite(value)) throw new Error('Số không hợp lệ');
      rawTokens.push({ type: 'num', value });
      continue;
    }

    if (/[a-z]/.test(ch)) {
      let ident = '';
      while (i < s.length && /[a-z]/.test(s[i])) {
        ident += s[i++];
      }
      if (ident === 'x') {
        rawTokens.push({ type: 'var', name: 'x' });
      } else if (ident in MATH_CONSTANTS) {
        rawTokens.push({ type: 'num', value: MATH_CONSTANTS[ident] });
      } else if (MATH_FUNCTIONS.has(ident)) {
        rawTokens.push({ type: 'fn', name: ident });
      } else {
        throw new Error(`Không nhận dạng được ký hiệu "${ident}"`);
      }
      continue;
    }

    if ('+-*/^'.includes(ch)) {
      rawTokens.push({ type: 'op', op: ch });
      i++;
      continue;
    }
    if (ch === '(') {
      rawTokens.push({ type: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')') {
      rawTokens.push({ type: 'rparen' });
      i++;
      continue;
    }
    throw new Error(`Ký tự không hợp lệ "${ch}"`);
  }

  // Insert implicit multiplication (e.g. 2x, 2sin(x), (x+1)(x-1), x(x+1))
  const out: MathToken[] = [];
  for (let idx = 0; idx < rawTokens.length; idx++) {
    const curr = rawTokens[idx];
    if (idx > 0) {
      const prev = rawTokens[idx - 1];
      const prevIsVal =
        prev.type === 'num' || prev.type === 'var' || prev.type === 'rparen';
      const currStartsVal =
        curr.type === 'var' ||
        curr.type === 'fn' ||
        curr.type === 'lparen' ||
        (prev.type === 'rparen' && curr.type === 'num');
      if (prevIsVal && currStartsVal) {
        out.push({ type: 'op', op: '*' });
      }
    }
    out.push(curr);
  }
  return out;
}

export function evaluateMathExpression(expr: string, x: number): number | null {
  try {
    const cleaned = expr.replace(/^y\s*=\s*/i, '').replace(/^f\(x\)\s*=\s*/i, '').trim();
    const tokens = tokenizeMathExpression(cleaned);
    if (tokens.length === 0) return null;
    let pos = 0;

    const peek = () => tokens[pos];
    const consume = () => tokens[pos++];

    const parseExpr = (): number => {
      let left = parseTerm();
      while (peek()?.type === 'op' && ((peek() as { type: 'op'; op: string }).op === '+' || (peek() as { type: 'op'; op: string }).op === '-')) {
        const op = (consume() as { type: 'op'; op: string }).op;
        const right = parseTerm();
        left = op === '+' ? left + right : left - right;
      }
      return left;
    };

    const parseTerm = (): number => {
      let left = parseUnary();
      while (peek()?.type === 'op' && ((peek() as { type: 'op'; op: string }).op === '*' || (peek() as { type: 'op'; op: string }).op === '/')) {
        const op = (consume() as { type: 'op'; op: string }).op;
        const right = parseUnary();
        left = op === '*' ? left * right : left / right;
      }
      return left;
    };

    const parseUnary = (): number => {
      if (peek()?.type === 'op' && (peek() as { type: 'op'; op: string }).op === '-') {
        consume();
        return -parseUnary();
      }
      if (peek()?.type === 'op' && (peek() as { type: 'op'; op: string }).op === '+') {
        consume();
        return parseUnary();
      }
      return parsePower();
    };

    const parsePower = (): number => {
      const base = parsePrimary();
      if (peek()?.type === 'op' && (peek() as { type: 'op'; op: string }).op === '^') {
        consume();
        const exp = parseUnary();
        return Math.pow(base, exp);
      }
      return base;
    };

    const parsePrimary = (): number => {
      const tok = peek();
      if (!tok) throw new Error('Thiếu toán hạng');
      if (tok.type === 'num') {
        consume();
        return tok.value;
      }
      if (tok.type === 'var') {
        consume();
        return x;
      }
      if (tok.type === 'fn') {
        consume();
        if (peek()?.type !== 'lparen') throw new Error(`Thiếu ngoặc sau ${tok.name}`);
        consume();
        const arg = parseExpr();
        if (peek()?.type !== 'rparen') throw new Error('Thiếu ngoặc đóng )');
        consume();
        switch (tok.name) {
          case 'sin':
            return Math.sin(arg);
          case 'cos':
            return Math.cos(arg);
          case 'tan':
            return Math.abs(Math.cos(arg)) < 1e-6 ? Number.NaN : Math.tan(arg);
          case 'sqrt':
            return arg < 0 ? Number.NaN : Math.sqrt(arg);
          case 'abs':
            return Math.abs(arg);
          case 'ln':
            return arg <= 0 ? Number.NaN : Math.log(arg);
          case 'log':
            return arg <= 0 ? Number.NaN : Math.log10(arg);
          case 'exp':
            return Math.exp(arg);
        }
      }
      if (tok.type === 'lparen') {
        consume();
        const val = parseExpr();
        if (peek()?.type !== 'rparen') throw new Error('Thiếu ngoặc đóng )');
        consume();
        return val;
      }
      throw new Error('Cú pháp biểu thức không hợp lệ');
    };

    const result = parseExpr();
    if (pos !== tokens.length) return null;
    if (!Number.isFinite(result) || Math.abs(result) > 1e6) return null;
    return Number(result.toFixed(6));
  } catch {
    return null;
  }
}

export function sampleMathFunction(
  expr: string,
  xMin: number,
  xMax: number,
  steps = 120
): Array<{ x: number; y: number | null }> {
  const safeSteps = Math.max(20, Math.min(400, steps));
  const dx = (xMax - xMin) / safeSteps;
  const out: Array<{ x: number; y: number | null }> = [];
  for (let i = 0; i <= safeSteps; i++) {
    const x = Number((xMin + i * dx).toFixed(4));
    out.push({ x, y: evaluateMathExpression(expr, x) });
  }
  return out;
}

export interface TriangleMetrics {
  valid: boolean;
  reason?: string;
  a: number;
  b: number;
  c: number;
  perimeter: number;
  area: number;
  angleA: number;
  angleB: number;
  angleC: number;
  ha: number;
  classification: string;
}

export function computeTriangleMetrics(a: number, b: number, c: number): TriangleMetrics {
  if (a <= 0 || b <= 0 || c <= 0 || a + b <= c || a + c <= b || b + c <= a) {
    return {
      valid: false,
      reason: 'Tổng hai cạnh bất kỳ phải lớn hơn cạnh còn lại.',
      a,
      b,
      c,
      perimeter: 0,
      area: 0,
      angleA: 0,
      angleB: 0,
      angleC: 0,
      ha: 0,
      classification: 'Không tạo thành tam giác',
    };
  }

  const p = (a + b + c) / 2;
  const area = Math.sqrt(p * (p - a) * (p - b) * (p - c));
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const clampCos = (v: number) => Math.max(-1, Math.min(1, v));

  const angleA = toDeg(Math.acos(clampCos((b * b + c * c - a * a) / (2 * b * c))));
  const angleB = toDeg(Math.acos(clampCos((a * a + c * c - b * b) / (2 * a * c))));
  const angleC = Math.max(0, 180 - angleA - angleB);

  const isEq = Math.abs(a - b) < 1e-4 && Math.abs(b - c) < 1e-4;
  const isIso = Math.abs(a - b) < 1e-4 || Math.abs(b - c) < 1e-4 || Math.abs(a - c) < 1e-4;
  const maxAngle = Math.max(angleA, angleB, angleC);
  const angleType =
    Math.abs(maxAngle - 90) < 0.25 ? 'vuông' : maxAngle > 90 ? 'tù' : 'nhọn';

  let classification = `Tam giác ${angleType}`;
  if (isEq) classification = 'Tam giác đều';
  else if (isIso && Math.abs(maxAngle - 90) < 0.25) classification = 'Tam giác vuông cân';
  else if (isIso) classification = `Tam giác cân (${angleType})`;

  return {
    valid: true,
    a,
    b,
    c,
    perimeter: Number((a + b + c).toFixed(3)),
    area: Number(area.toFixed(3)),
    angleA: Number(angleA.toFixed(1)),
    angleB: Number(angleB.toFixed(1)),
    angleC: Number(angleC.toFixed(1)),
    ha: Number(((2 * area) / a).toFixed(3)),
    classification,
  };
}

/* ============================================================================
   4. PHYSICS ENGINE (Projectile, Spring Oscillator, 1D Collision, Linear Regression)
   ============================================================================ */

export interface ProjectileSample {
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
}

export function simulateProjectileMotion(params: {
  v0: number;
  angleDeg: number;
  g: number;
  h0: number;
  steps?: number;
}) {
  const v0 = Math.max(1, params.v0);
  const g = Math.max(0.5, params.g);
  const h0 = Math.max(0, params.h0);
  const rad = (Math.max(0, Math.min(89, params.angleDeg)) * Math.PI) / 180;
  const vx = v0 * Math.cos(rad);
  const vy0 = v0 * Math.sin(rad);

  const flightTime = (vy0 + Math.sqrt(vy0 * vy0 + 2 * g * h0)) / g;
  const maxHeight = h0 + (vy0 * vy0) / (2 * g);
  const range = vx * flightTime;
  const steps = Math.max(24, Math.min(200, params.steps || 80));

  const points: ProjectileSample[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * flightTime;
    const x = vx * t;
    const y = Math.max(0, h0 + vy0 * t - 0.5 * g * t * t);
    const vy = vy0 - g * t;
    points.push({
      t: Number(t.toFixed(3)),
      x: Number(x.toFixed(3)),
      y: Number(y.toFixed(3)),
      vx: Number(vx.toFixed(3)),
      vy: Number(vy.toFixed(3)),
      speed: Number(Math.hypot(vx, vy).toFixed(3)),
    });
  }

  return {
    flightTime: Number(flightTime.toFixed(3)),
    maxHeight: Number(maxHeight.toFixed(3)),
    range: Number(range.toFixed(3)),
    points,
  };
}

export interface SpringSample {
  t: number;
  xCm: number;
  vMs: number;
  keJ: number;
  peJ: number;
}

export function simulateSpringOscillator(params: {
  amplitudeCm: number;
  k: number;
  massKg: number;
  damping?: number;
  durationS?: number;
  steps?: number;
}) {
  const A = Math.max(1, params.amplitudeCm) / 100; // meters
  const k = Math.max(1, params.k);
  const m = Math.max(0.05, params.massKg);
  const gamma = Math.max(0, params.damping || 0);
  const omega0 = Math.sqrt(k / m);
  const omega = Math.sqrt(Math.max(0.01, omega0 * omega0 - gamma * gamma));
  const period = (2 * Math.PI) / omega;
  const duration = Math.max(period, params.durationS || 4 * period);
  const steps = Math.max(40, Math.min(240, params.steps || 120));

  const samples: SpringSample[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * duration;
    const env = Math.exp(-gamma * t);
    const x = A * env * Math.cos(omega * t);
    const v = -A * env * (gamma * Math.cos(omega * t) + omega * Math.sin(omega * t));
    const pe = 0.5 * k * x * x;
    const ke = 0.5 * m * v * v;
    samples.push({
      t: Number(t.toFixed(3)),
      xCm: Number((x * 100).toFixed(2)),
      vMs: Number(v.toFixed(3)),
      keJ: Number(ke.toFixed(4)),
      peJ: Number(pe.toFixed(4)),
    });
  }

  return {
    omega: Number(omega.toFixed(3)),
    period: Number(period.toFixed(3)),
    frequency: Number((1 / period).toFixed(3)),
    maxSpeedMs: Number((omega * A).toFixed(3)),
    totalEnergyJ: Number((0.5 * k * A * A).toFixed(4)),
    samples,
  };
}

export function simulateCollision1D(params: {
  m1: number;
  v1: number;
  m2: number;
  v2: number;
  restitution: number; // 0 (mềm) -> 1 (đàn hồi)
}) {
  const m1 = Math.max(0.1, params.m1);
  const m2 = Math.max(0.1, params.m2);
  const e = Math.max(0, Math.min(1, params.restitution));
  const { v1, v2 } = params;

  const v1After = (m1 * v1 + m2 * v2 + m2 * e * (v2 - v1)) / (m1 + m2);
  const v2After = (m1 * v1 + m2 * v2 + m1 * e * (v1 - v2)) / (m1 + m2);

  const pBefore = m1 * v1 + m2 * v2;
  const pAfter = m1 * v1After + m2 * v2After;
  const keBefore = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;
  const keAfter = 0.5 * m1 * v1After * v1After + 0.5 * m2 * v2After * v2After;

  return {
    v1After: Number(v1After.toFixed(3)),
    v2After: Number(v2After.toFixed(3)),
    momentumBefore: Number(pBefore.toFixed(3)),
    momentumAfter: Number(pAfter.toFixed(3)),
    kineticBefore: Number(keBefore.toFixed(3)),
    kineticAfter: Number(keAfter.toFixed(3)),
    energyLossPercent:
      keBefore > 1e-6 ? Number((((keBefore - keAfter) / keBefore) * 100).toFixed(2)) : 0,
  };
}

export function computeLinearRegression(points: Array<{ x: number; y: number }>) {
  if (points.length < 2) {
    return null;
  }
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0;
  let denX = 0;
  let denY = 0;
  for (const p of points) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX === 0) return null;
  const slope = num / denX;
  const intercept = meanY - slope * meanX;
  const r = denY === 0 ? 1 : num / Math.sqrt(denX * denY);
  const rSquared = Math.min(1, Math.max(0, r * r));

  return {
    slope: Number(slope.toFixed(4)),
    intercept: Number(intercept.toFixed(4)),
    rSquared: Number(rSquared.toFixed(4)),
  };
}

/* ============================================================================
   5. CHEMISTRY ENGINE (Formula Molar Mass Parser + Acid-Base Titration pH)
   ============================================================================ */

export interface FormulaElementBreakdown {
  symbol: string;
  nameVi: string;
  count: number;
  atomicMass: number;
  subtotalMass: number;
  percentMass: number;
}

export interface MolarMassResult {
  formula: string;
  molarMass: number;
  breakdown: FormulaElementBreakdown[];
}

function parseSingleCompoundCounts(segment: string): Record<string, number> {
  const stack: Array<Record<string, number>> = [{}];
  let i = 0;

  while (i < segment.length) {
    const ch = segment[i];
    if (ch === '(' || ch === '[') {
      stack.push({});
      i++;
      continue;
    }
    if (ch === ')' || ch === ']') {
      if (stack.length <= 1) throw new Error('Dấu ngoặc công thức không cân đối.');
      i++;
      let multStr = '';
      while (i < segment.length && /[0-9]/.test(segment[i])) {
        multStr += segment[i++];
      }
      const mult = multStr ? Number(multStr) : 1;
      const top = stack.pop()!;
      const parent = stack[stack.length - 1];
      for (const [sym, cnt] of Object.entries(top)) {
        parent[sym] = (parent[sym] || 0) + cnt * mult;
      }
      continue;
    }
    if (/[A-Z]/.test(ch)) {
      let sym = ch;
      i++;
      while (i < segment.length && /[a-z]/.test(segment[i])) {
        sym += segment[i++];
      }
      if (!ELEMENT_BY_SYMBOL[sym]) {
        throw new Error(`Không tìm thấy nguyên tố "${sym}" trong bảng tuần hoàn.`);
      }
      let cntStr = '';
      while (i < segment.length && /[0-9]/.test(segment[i])) {
        cntStr += segment[i++];
      }
      const count = cntStr ? Number(cntStr) : 1;
      const top = stack[stack.length - 1];
      top[sym] = (top[sym] || 0) + count;
      continue;
    }
    throw new Error(`Ký tự không hợp lệ "${ch}" trong công thức.`);
  }

  if (stack.length !== 1) throw new Error('Thiếu dấu ngoặc đóng trong công thức.');
  return stack[0];
}

export function calculateMolarMass(rawFormula: string): MolarMassResult {
  const cleaned = rawFormula.trim().replace(/\s+/g, '');
  if (!cleaned) throw new Error('Vui lòng nhập công thức hóa học.');

  // Support hydrates e.g. CuSO4.5H2O or CuSO4·5H2O
  const parts = cleaned.split(/[.·*]/).filter(Boolean);
  const totalCounts: Record<string, number> = {};

  for (const part of parts) {
    const leadMatch = /^(\d+)(.+)$/.exec(part);
    const coeff = leadMatch ? Number(leadMatch[1]) : 1;
    const body = leadMatch ? leadMatch[2] : part;
    const counts = parseSingleCompoundCounts(body);
    for (const [sym, cnt] of Object.entries(counts)) {
      totalCounts[sym] = (totalCounts[sym] || 0) + cnt * coeff;
    }
  }

  let totalMass = 0;
  const tempRows = Object.entries(totalCounts).map(([symbol, count]) => {
    const el = ELEMENT_BY_SYMBOL[symbol];
    const subtotalMass = el.mass * count;
    totalMass += subtotalMass;
    return {
      symbol,
      nameVi: el.nameVi,
      count,
      atomicMass: el.mass,
      subtotalMass: Number(subtotalMass.toFixed(3)),
    };
  });

  if (totalMass <= 0) throw new Error('Công thức không chứa nguyên tố hợp lệ.');

  const breakdown: FormulaElementBreakdown[] = tempRows.map((row) => ({
    ...row,
    percentMass: Number(((row.subtotalMass / totalMass) * 100).toFixed(2)),
  }));

  return {
    formula: cleaned,
    molarMass: Number(totalMass.toFixed(3)),
    breakdown,
  };
}

export function computeAcidBaseTitration(params: {
  acidM: number; // HCl M
  acidVolMl: number; // V HCl mL
  baseM: number; // NaOH M
  baseVolAddedMl: number; // V NaOH added mL
}) {
  const acidM = Math.max(0.01, params.acidM);
  const acidVol = Math.max(1, params.acidVolMl);
  const baseM = Math.max(0.01, params.baseM);
  const baseVol = Math.max(0, params.baseVolAddedMl);

  const molH = acidM * (acidVol / 1000);
  const molOH = baseM * (baseVol / 1000);
  const totalVolL = (acidVol + baseVol) / 1000;
  const equivalenceVolMl = (molH / baseM) * 1000;

  let ph = 7;
  const diff = molH - molOH;
  if (Math.abs(diff) < 1e-9) {
    ph = 7;
  } else if (diff > 0) {
    const cH = diff / totalVolL;
    ph = -Math.log10(cH);
  } else {
    const cOH = Math.abs(diff) / totalVolL;
    const pOH = -Math.log10(cOH);
    ph = 14 - pOH;
  }
  ph = Number(Math.max(0, Math.min(14, ph)).toFixed(2));

  let stateLabel = 'Trung tính (Điểm tương đương)';
  let phenolColor = 'Hồng nhạt (Chuyển màu)';
  let litmusColor = 'Tím (Trung tính)';
  let liquidHex = '#e2e8f0';

  if (ph < 6.5) {
    stateLabel = 'Dư axit (Môi trường axit)';
    phenolColor = 'Không màu';
    litmusColor = 'Đỏ';
    liquidHex = '#fca5a5';
  } else if (ph > 8.2) {
    stateLabel = 'Dư bazơ (Môi trường kiềm)';
    phenolColor = 'Hồng cánh sen đậm';
    litmusColor = 'Xanh lam';
    liquidHex = '#f472b6';
  } else if (ph >= 6.5 && ph <= 8.2) {
    stateLabel = 'Gần điểm tương đương (pH ≈ 7)';
    phenolColor = ph >= 8.0 ? 'Hồng phớt' : 'Không màu';
    litmusColor = 'Tím';
    liquidHex = '#f9a8d4';
  }

  return {
    ph,
    equivalenceVolMl: Number(equivalenceVolMl.toFixed(2)),
    stateLabel,
    phenolColor,
    litmusColor,
    liquidHex,
  };
}

export function generateTitrationCurve(
  acidM: number,
  acidVolMl: number,
  baseM: number,
  maxBaseMl: number
): Array<{ vBaseMl: number; ph: number }> {
  const maxV = Math.max(10, maxBaseMl);
  const points: Array<{ vBaseMl: number; ph: number }> = [];
  const step = maxV / 50;
  for (let i = 0; i <= 50; i++) {
    const v = Number((i * step).toFixed(1));
    const res = computeAcidBaseTitration({
      acidM,
      acidVolMl,
      baseM,
      baseVolAddedMl: v,
    });
    points.push({ vBaseMl: v, ph: res.ph });
  }
  return points;
}

/* ============================================================================
   6. ENGLISH HELPER (Word Order Sentence Check)
   ============================================================================ */

export function gradeWordOrderSentence(userTokens: string[], targetSentence: string) {
  const normalize = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[.,!?;:]+$/g, '')
      .replace(/\s+/g, ' ');
  const userNorm = normalize(userTokens.join(' '));
  const targetNorm = normalize(targetSentence);
  return {
    isCorrect: userNorm.length > 0 && userNorm === targetNorm,
    userSentence: userTokens.join(' '),
    targetSentence,
  };
}
