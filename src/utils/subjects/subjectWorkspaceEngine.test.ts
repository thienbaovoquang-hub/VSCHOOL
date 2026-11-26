import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMolarMass,
  computeAcidBaseTitration,
  computeLinearRegression,
  computeOverviewMetrics,
  computeTriangleMetrics,
  doesLabelMatchSubject,
  evaluateMathExpression,
  gradeWordOrderSentence,
  matchSubjectSchoolContext,
  normalizeSubjectToken,
  simulateCollision1D,
  simulateProjectileMotion,
  simulateSpringOscillator,
  type SubjectSchoolContext,
} from './subjectWorkspaceEngine';
import { getActiveSubjects, type SubjectId } from '../subjectRegistry';

test('Cross-VSCHOOL subject normalization & school context matching unifies aliases cleanly', () => {
  assert.equal(normalizeSubjectToken('Tiếng Anh (10A1)'), 'tieng anh 10a1');
  assert.equal(doesLabelMatchSubject('Tiếng Anh', 'english'), true);
  assert.equal(doesLabelMatchSubject('Anh văn', 'english'), true);
  assert.equal(doesLabelMatchSubject('Vật lí', 'physics'), true);
  assert.equal(doesLabelMatchSubject('Hóa học', 'physics'), false);

  const ctx = matchSubjectSchoolContext({
    subjectId: 'english',
    currentUser: {
      id: 'st-1',
      email: 'hs@school.vn',
      displayName: 'Nguyễn An',
      role: 'student',
      className: '10A1',
      status: 'active',
    },
    academicRecords: [
      {
        id: 'ar1',
        studentId: 'st-1',
        studentName: 'Nguyễn An',
        studentCode: 'HS001',
        classId: 'c1',
        className: '10A1',
        subjectId: 'english',
        subjectName: 'Tiếng Anh',
        semester: 'HK1',
        scoreRegular: [9, 8],
        scoreMidterm: 8.5,
        scoreFinal: 8.5,
        averageScore: 8.5,
        updatedAt: '2026-01-01',
      },
    ],
    timetable: [
      {
        id: 'tt1',
        classId: 'c1',
        className: '10A1',
        dayOfWeek: 2,
        period: 1,
        subject: 'Anh văn',
        teacherName: 'Cô Mai',
        room: 'A102',
      },
    ],
    assignments: [
      {
        id: 'as1',
        title: 'Unit 3 Vocabulary',
        description: 'Complete worksheet',
        classId: 'c1',
        className: '10A1',
        subject: 'Tiếng Anh',
        teacherName: 'Cô Mai',
        dueDate: '2026-12-01',
        status: 'open',
        createdAt: '2026-11-01',
      },
    ],
    assignmentSubmissions: [],
    learningMaterials: [
      {
        id: 'lm1',
        title: 'Ngữ pháp Unit 3',
        subject: 'Tiếng Anh',
        grade: 10,
        type: 'PDF',
        urlOrNote: 'unit3.pdf',
        uploadedBy: 'Cô Mai',
        uploadedAt: '2026-11-01',
      },
    ],
    teachers: [
      {
        id: 't1',
        fullName: 'Cô Mai',
        email: 'mai@school.vn',
        phone: '0901234567',
        subject: 'Tiếng Anh',
        isHomeroom: false,
        role: 'subject_teacher',
        assignedClasses: ['10A1'],
        status: 'Đang công tác',
      },
    ],
  });

  assert.equal(ctx.myAverageScore, 8.5);
  assert.equal(ctx.pendingAssignmentCount, 1);
  assert.equal(ctx.timetableSlots.length, 1);
  assert.equal(ctx.materials.length, 1);
  assert.equal(ctx.teachers.length, 1);

  const schoolContexts = {} as Record<SubjectId, SubjectSchoolContext>;
  for (const subj of getActiveSubjects()) {
    schoolContexts[subj.id] =
      subj.id === 'english'
        ? ctx
        : {
            subjectId: subj.id,
            academicRecords: [],
            myAverageScore: null,
            timetableSlots: [],
            assignments: [],
            submissionByAssignmentId: {},
            materials: [],
            teachers: [],
            pendingAssignmentCount: 0,
          };
  }

  const overview = computeOverviewMetrics({
    progressMap: {
      english: {
        masteredIds: ['v1', 'v2'],
        bookmarkedIds: [],
        practiceAttempts: 1,
        notesByItemId: {},
        updatedAt: '',
      },
    },
    schoolContexts,
  });
  assert.equal(overview.totalMastered, 2);
  assert.equal(overview.totalPendingAssignments, 1);
  assert.equal(overview.perSubject[0].schoolAverage, 8.5);
});

test('Safe Math parser evaluates polynomials, trig functions, implicit multiplication, and rejects invalid input', () => {
  assert.equal(evaluateMathExpression('x^2 - 2*x - 3', 3), 0);
  assert.equal(evaluateMathExpression('2x + 1', 4), 9);
  assert.ok(Math.abs((evaluateMathExpression('sin(pi/2)', 0) ?? 0) - 1) < 1e-9);
  assert.equal(evaluateMathExpression('unknownFunc(x)', 1), null);
});

test('Triangle 2D metrics validate triangle inequality and compute Heron area + angles accurately', () => {
  const tri = computeTriangleMetrics(3, 4, 5);
  assert.equal(tri.valid, true);
  assert.equal(tri.area, 6);
  assert.equal(tri.perimeter, 12);
  assert.equal(tri.angleC, 90);
  const invalid = computeTriangleMetrics(1, 2, 10);
  assert.equal(invalid.valid, false);
});

test('Physics engines compute Projectile, Spring Oscillator, 1D Collision, and Linear Regression accurately', () => {
  const proj = simulateProjectileMotion({ v0: 20, angleDeg: 45, g: 10, h0: 0 });
  assert.ok(Math.abs(proj.range - 40) < 0.2);
  assert.ok(Math.abs(proj.maxHeight - 10) < 0.1);

  const spring = simulateSpringOscillator({ massKg: 1, k: 100, amplitudeCm: 10 });
  assert.ok(Math.abs(spring.omega - 10) < 1e-3);
  assert.ok(Math.abs(spring.maxSpeedMs - 1) < 1e-3);

  const col = simulateCollision1D({ m1: 2, v1: 4, m2: 2, v2: 0, restitution: 1 });
  assert.equal(col.v1After, 0);
  assert.equal(col.v2After, 4);
  assert.equal(col.momentumBefore, col.momentumAfter);

  const reg = computeLinearRegression([
    { x: 1, y: 3 },
    { x: 2, y: 5 },
    { x: 3, y: 7 },
  ]);
  assert.ok(reg);
  assert.equal(reg.slope, 2);
  assert.equal(reg.intercept, 1);
  assert.equal(reg.rSquared, 1);
});

test('Chemistry engine parses nested/hydrate formulas and computes titration pH accurately', () => {
  const h2so4 = calculateMolarMass('H2SO4');
  assert.ok(Math.abs(h2so4.molarMass - 98.079) < 0.2);

  const cuNo3 = calculateMolarMass('Cu(NO3)2');
  assert.ok(Math.abs(cuNo3.molarMass - 187.556) < 0.2);

  const hydrate = calculateMolarMass('CuSO4.5H2O');
  assert.ok(Math.abs(hydrate.molarMass - 249.68) < 0.5);

  const eq = computeAcidBaseTitration({ acidM: 0.1, acidVolMl: 25, baseM: 0.1, baseVolAddedMl: 25 });
  assert.equal(eq.ph, 7);
  assert.equal(eq.stateLabel, 'Gần điểm tương đương (pH ≈ 7)');
});

test('English word-order grader validates exact sentence construction cleanly', () => {
  const ok = gradeWordOrderSentence(
    ['Students', 'collaborate', 'in', 'groups', 'to', 'solve', 'problems'],
    'Students collaborate in groups to solve problems'
  );
  assert.equal(ok.isCorrect, true);
  assert.equal(ok.targetSentence, 'Students collaborate in groups to solve problems');
});
