import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_EMULATION_POLICY,
  isEmulationRecordCounted,
  computeStudentEmulationSummaries,
  computeClassEmulationSummaries,
  detectBulkRecordDuplicates,
  sanitizeEmulationRecordForPublicView,
  resolveAppealEffect,
  buildCompetitionLeaderboard,
  planCompetitionTransferToEmulation,
  revertCompetitionTransfer,
  syncCompetitionStatusByDate,
  parseRuleClausesLocally,
  canDeleteRuleCriterion,
  buildWorkbookFromAiRuleCriteria,
  synthesizeMissingRuleCategories,
  CANONICAL_RULE_GROUPS,
  findCanonicalRuleGroup,
  classifyCriterionPointSign,
  groupAndFilterRuleCriteria,
} from './emulationRules';
import type {
  AIExtractedRuleItem,
  Competition,
  CompetitionCriterion,
  CompetitionParticipant,
  CompetitionScore,
  EmulationAppeal,
  EmulationRecord,
  RuleCategory,
  RuleCriterion,
  SchoolClass,
  ScoreTransferRecord,
  Student,
} from '../types';

const TEST_STUDENTS: Student[] = [
  {
    id: 'STU-1',
    studentCode: 'STU-2026-001',
    fullName: 'Nguyễn Minh An',
    classId: 'CLS-10A1',
    className: '10A1',
    grade: 10,
    rfidCardId: 'R1',
    dateOfBirth: '2010-02-01',
    gender: 'Nam',
    parentPhone: '0901112222',
    status: 'Đang học',
    address: 'Hà Nội',
  },
  {
    id: 'STU-2',
    studentCode: 'STU-2026-002',
    fullName: 'Trần Bảo Châu',
    classId: 'CLS-10A1',
    className: '10A1',
    grade: 10,
    rfidCardId: 'R2',
    dateOfBirth: '2010-03-01',
    gender: 'Nữ',
    parentPhone: '0901112233',
    status: 'Đang học',
    address: 'Hà Nội',
  },
];

const TEST_CLASSES: SchoolClass[] = [
  {
    id: 'CLS-10A1',
    code: '10A1',
    name: '10A1',
    grade: 10,
    academicYear: '2026 - 2027',
    homeroomTeacherId: 'TCH-1',
    homeroomTeacherName: 'Cô Lan',
    room: 'P.101',
    studentCount: 2,
  },
];

test('Unverified, insufficient_evidence, and cancelled records NEVER alter scores', () => {
  const baseRec: EmulationRecord = {
    id: 'REC-1',
    recordCode: 'TD-001',
    targetType: 'individual',
    studentId: 'STU-1',
    studentCode: 'STU-2026-001',
    studentName: 'Nguyễn Minh An',
    classId: 'CLS-10A1',
    className: '10A1',
    grade: 10,
    criterionId: 'CR-1',
    criterionName: 'Đi học muộn',
    categoryName: 'Chuyên cần',
    type: 'violation',
    pointsApplied: -5,
    occurredAt: '2026-11-10',
    description: 'Muộn 15 phút',
    reporterId: 'T1',
    reporterName: 'GV',
    reporterRole: 'subject_teacher',
    status: 'pending_verification',
    createdAt: '2026-11-10T07:30:00Z',
  };

  assert.equal(isEmulationRecordCounted(baseRec), false);
  assert.equal(isEmulationRecordCounted({ ...baseRec, status: 'insufficient_evidence' }), false);
  assert.equal(isEmulationRecordCounted({ ...baseRec, status: 'cancelled' }), false);
  assert.equal(isEmulationRecordCounted({ ...baseRec, status: 'recorded' }), true);

  const summaries = computeStudentEmulationSummaries({
    students: TEST_STUDENTS,
    records: [
      baseRec, // pending_verification -> ignored
      { ...baseRec, id: 'REC-2', status: 'recorded', studentId: 'STU-2', studentCode: 'STU-2026-002', studentName: 'Trần Bảo Châu', type: 'achievement', pointsApplied: 10 },
    ],
  });

  const an = summaries.find((s) => s.studentId === 'STU-1')!;
  const chau = summaries.find((s) => s.studentId === 'STU-2')!;
  assert.equal(an.totalScore, DEFAULT_EMULATION_POLICY.startingScore);
  assert.equal(chau.totalScore, 110);
  assert.equal(chau.rank, 1);
});

test('Class emulation summaries support configurable formula and bulk duplicate detection', () => {
  const records: EmulationRecord[] = [
    {
      id: 'R1',
      recordCode: 'TD-1',
      targetType: 'individual',
      studentId: 'STU-1',
      classId: 'CLS-10A1',
      className: '10A1',
      criterionId: 'CR-V',
      criterionName: 'Vi phạm đồng phục',
      categoryName: 'Nề nếp',
      type: 'violation',
      pointsApplied: -4,
      occurredAt: '2026-11-12',
      description: 'Thiếu phù hiệu',
      isSensitive: true,
      reporterId: 'T1',
      reporterName: 'GVCN',
      reporterRole: 'homeroom_teacher',
      status: 'recorded',
      createdAt: '2026-11-12T08:00:00Z',
    },
    {
      id: 'R2',
      recordCode: 'TD-2',
      targetType: 'class',
      classId: 'CLS-10A1',
      className: '10A1',
      criterionId: 'CR-C',
      criterionName: 'Lớp trực tuần tốt',
      categoryName: 'Phong trào',
      type: 'achievement',
      pointsApplied: 12,
      occurredAt: '2026-11-12',
      description: 'Hoàn thành xuất sắc',
      reporterId: 'T1',
      reporterName: 'BGH',
      reporterRole: 'principal',
      status: 'recorded',
      createdAt: '2026-11-12T10:00:00Z',
    },
  ];

  const dups = detectBulkRecordDuplicates(records, ['STU-1', 'STU-2'], 'CR-V', '2026-11-12');
  assert.deepEqual(dups, ['STU-1']);

  const sanitized = sanitizeEmulationRecordForPublicView(records[0]);
  assert.match(sanitized.description, /bảo mật/);

  const classSums = computeClassEmulationSummaries({
    classes: TEST_CLASSES,
    students: TEST_STUDENTS,
    records,
    policy: { ...DEFAULT_EMULATION_POLICY, classFormula: 'combined_formula', studentWeight: 0.5, classEventWeight: 1 },
  });
  // student avg net = (-4 + 0)/2 = -2 -> * 0.5 = -1; classEventNet = +12; starting = 100 => 111
  assert.equal(classSums[0].totalScore, 111);
});

test('Accepted appeal cancels or adjusts linked emulation record transparently', () => {
  const rec: EmulationRecord = {
    id: 'REC-10',
    recordCode: 'TD-10',
    targetType: 'individual',
    studentId: 'STU-1',
    classId: 'CLS-10A1',
    className: '10A1',
    criterionId: 'CR-1',
    criterionName: 'Vắng không phép',
    categoryName: 'Chuyên cần',
    type: 'violation',
    pointsApplied: -5,
    occurredAt: '2026-11-12',
    description: 'Vắng tiết 1',
    reporterId: 'T1',
    reporterName: 'GV',
    reporterRole: 'subject_teacher',
    status: 'recorded',
    createdAt: '2026-11-12T08:00:00Z',
  };
  const appeal: EmulationAppeal = {
    id: 'APL-1',
    recordId: 'REC-10',
    recordCode: 'TD-10',
    studentId: 'STU-1',
    studentName: 'Nguyễn Minh An',
    className: '10A1',
    reason: 'Em đã có đơn xin phép được GVCN duyệt',
    status: 'submitted',
    history: [{ timestamp: '2026-11-12T09:00:00Z', actorName: 'An', actorRole: 'student', status: 'submitted', note: 'Nộp khiếu nại' }],
    createdAt: '2026-11-12T09:00:00Z',
    updatedAt: '2026-11-12T09:00:00Z',
  };

  const resolved = resolveAppealEffect({
    appeal,
    record: rec,
    decision: 'accepted',
    resolutionNote: 'Xác nhận đơn nghỉ hợp lệ, hủy trừ điểm',
    reviewedBy: 'Cô Lan (GVCN)',
  });
  assert.equal(resolved.updatedAppeal.status, 'accepted');
  assert.equal(resolved.updatedRecord.status, 'cancelled');
  assert.equal(isEmulationRecordCounted(resolved.updatedRecord), false);
});

test('Competition transfer prevents double counting and supports clean revert', () => {
  const competition: Competition = {
    id: 'CMP-1',
    code: 'PT-2026-01',
    name: 'Hội thi Văn nghệ 20/11',
    description: 'Thi đua văn nghệ',
    category: 'Văn thể mỹ',
    academicYear: '2026 - 2027',
    startDate: '2026-11-01',
    endDate: '2026-11-10',
    participantScope: 'class',
    transferMode: 'ratio_transfer',
    ratioDivisor: 10,
    maxTransferPoints: 15,
    status: 'closed',
    organizerName: 'Đoàn trường',
    createdBy: 'BGH',
    createdAt: '2026-10-25',
  };

  assert.equal(syncCompetitionStatusByDate({ ...competition, status: 'upcoming' }, '2026-11-05'), 'ongoing');

  const criteria: CompetitionCriterion[] = [
    { id: 'CC-1', competitionId: 'CMP-1', name: 'Nội dung', description: '', maxPoints: 100, weight: 1, order: 1 },
  ];
  const participants: CompetitionParticipant[] = [
    { id: 'CP-1', competitionId: 'CMP-1', targetType: 'class', targetId: 'CLS-10A1', targetName: '10A1', className: '10A1', grade: 10, registeredAt: '2026-11-01', status: 'active' },
  ];
  const scores: CompetitionScore[] = [
    { id: 'CS-1', competitionId: 'CMP-1', participantId: 'CP-1', criterionId: 'CC-1', criterionName: 'Nội dung', score: 90, scoredBy: 'BGK', scoredAt: '2026-11-09' },
  ];

  const leaderboard = buildCompetitionLeaderboard({ competitionId: 'CMP-1', participants, criteria, scores });
  assert.equal(leaderboard[0].totalPoints, 90);

  const plan1 = planCompetitionTransferToEmulation({
    competition,
    leaderboard,
    existingTransfers: [],
    approvedBy: 'Hiệu trưởng',
    approvedById: 'USR-BGH',
  });
  assert.equal(plan1.newTransfers.length, 1);
  assert.equal(plan1.newTransfers[0].pointsTransferred, 9);
  assert.equal(plan1.newEmulationRecords.length, 1);

  // Re-running sync must block duplicate transfer (Anti-Double-Count)
  const plan2 = planCompetitionTransferToEmulation({
    competition,
    leaderboard,
    existingTransfers: plan1.newTransfers,
    approvedBy: 'Hiệu trưởng',
    approvedById: 'USR-BGH',
  });
  assert.equal(plan2.newTransfers.length, 0);
  assert.equal(plan2.skippedAlreadyTransferred, 1);

  // Revert allows clean undo
  const reverted = revertCompetitionTransfer({
    transfer: plan1.newTransfers[0] as ScoreTransferRecord,
    revertedBy: 'Hiệu trưởng',
    revertReason: 'Cập nhật lại kết quả',
  });
  assert.equal(reverted.updatedTransfer.syncStatus, 'reverted');
  assert.equal(reverted.cancelledEmulationRecordId, plan1.newEmulationRecords[0].id);
});

test('parseRuleClausesLocally never invents points when document omits scores, and referenced criteria cannot be deleted', () => {
  const sampleText = [
    'I. Chuyên cần & Đồng phục',
    '1. Đi học đúng giờ, mặc đúng đồng phục quy định.',
    '2. Đi học muộn không có lý do chính đáng (trừ 3 điểm).',
    '3. Nhặt được của rơi trả người đánh mất (+10 điểm).',
  ].join('\n');

  const extracted = parseRuleClausesLocally(sampleText);
  assert.equal(extracted.length, 3);
  assert.equal(extracted[0].pointsSpecified, false);
  assert.equal(extracted[0].points, null);
  assert.equal(extracted[1].pointsSpecified, true);
  assert.equal(extracted[1].points, -3);
  assert.equal(extracted[1].type, 'violation');
  assert.equal(extracted[2].pointsSpecified, true);
  assert.equal(extracted[2].points, 10);
  assert.equal(extracted[2].type, 'achievement');

  const deleteCheck = canDeleteRuleCriterion('CR-1', [
    {
      id: 'R1',
      recordCode: 'TD-1',
      targetType: 'individual',
      criterionId: 'CR-1',
      criterionName: 'Test',
      categoryName: 'Cat',
      type: 'violation',
      pointsApplied: -2,
      occurredAt: '2026-11-10',
      description: 'Test',
      reporterId: 'U1',
      reporterName: 'GV',
      reporterRole: 'homeroom_teacher',
      status: 'recorded',
      createdAt: '2026-11-10',
    },
  ]);
  assert.equal(deleteCheck.allowed, false);
  assert.equal(deleteCheck.referencedCount, 1);
});

test('parseRuleClausesLocally classifies honor vs non-honor criteria and buildWorkbookFromAiRuleCriteria avoids code collisions', () => {
  const sample = [
    'I. Khen thưởng & Nêu gương',
    '1. Nhặt được của rơi trả lại người mất, tuyên dương dưới cờ (+10 điểm).',
    '2. Trực nhật lớp đúng giờ (+2 điểm).',
    'II. Nề nếp',
    '3. Đi học muộn không phép trừ 3 điểm.',
  ].join('\n');

  const extracted = parseRuleClausesLocally(sample);
  assert.equal(extracted.length, 3);
  assert.equal(extracted[0].type, 'achievement');
  assert.equal(extracted[0].isHonor, true);
  assert.equal(extracted[1].type, 'achievement');
  assert.equal(extracted[1].isHonor, false);
  assert.equal(extracted[2].type, 'violation');
  assert.equal(extracted[2].isHonor, false);

  const existing: RuleCriterion[] = [
    {
      id: 'RC-1',
      code: 'NQ-001',
      categoryId: 'CAT-1',
      categoryName: 'Nề nếp',
      name: 'Existing rule',
      description: 'Existing',
      behavior: 'Existing',
      type: 'violation',
      points: -2,
      pointsSpecified: true,
      targetScope: 'individual',
      status: 'active',
      createdBy: 'Admin',
      createdAt: '2026-11-01',
    },
  ];

  const aiItems: AIExtractedRuleItem[] = [
    {
      tempId: 'A1',
      group: 'Khen thưởng',
      name: 'Đạt giải Nhất HSG cấp Tỉnh',
      description: 'Đạt giải Nhất kỳ thi học sinh giỏi cấp Tỉnh',
      behavior: 'Đạt giải Nhất kỳ thi học sinh giỏi cấp Tỉnh',
      type: 'achievement',
      pointsSpecified: true,
      points: 20,
      isHonor: true,
      honorNote: 'Giấy khen Hiệu trưởng',
      target: 'individual',
      selected: true,
    },
    {
      tempId: 'A2',
      group: 'Khen thưởng',
      name: 'Bị bỏ chọn',
      description: 'Skip',
      behavior: 'Skip',
      type: 'achievement',
      pointsSpecified: false,
      points: null,
      isHonor: false,
      target: 'individual',
      selected: false,
    },
    {
      tempId: 'A3',
      group: 'Nề nếp',
      name: 'Không mặc đồng phục',
      description: 'Sai đồng phục',
      behavior: 'Sai đồng phục',
      type: 'violation',
      pointsSpecified: true,
      points: 5, // positive input on violation should normalize to -5
      isHonor: true, // violation must normalize to Không vinh danh
      target: 'individual',
      selected: true,
    },
  ];

  const wb = buildWorkbookFromAiRuleCriteria(aiItems, 'noi-quy.docx', existing);
  assert.equal(wb.rows.length, 2);
  assert.equal(wb.rows[0]['Mã tiêu chí *'], 'NQ-002');
  assert.equal(wb.rows[0]['Số điểm'], 20);
  assert.equal(wb.rows[0]['Vinh danh'], 'Vinh danh');
  assert.equal(wb.rows[0]['Hình thức vinh danh'], 'Giấy khen Hiệu trưởng');
  assert.equal(wb.rows[1]['Mã tiêu chí *'], 'NQ-003');
  assert.equal(wb.rows[1]['Số điểm'], -5);
  assert.equal(wb.rows[1]['Vinh danh'], 'Không vinh danh');

  const existingCats: RuleCategory[] = [
    { id: 'CAT-NE-NEP', code: 'NHOM-01', name: 'Nề nếp', order: 1, status: 'active' },
  ];
  const synthesized = synthesizeMissingRuleCategories(
    [
      {
        ...existing[0],
        id: 'RC-2',
        code: 'NQ-002',
        categoryId: 'CAT-KHEN-THUONG',
        categoryName: 'Khen thưởng',
      },
      {
        ...existing[0],
        id: 'RC-3',
        code: 'NQ-003',
        categoryId: 'CAT-NE-NEP',
        categoryName: 'Nề nếp',
      },
    ],
    existingCats
  );
  assert.equal(synthesized.length, 1);
  assert.equal(synthesized[0].id, 'CAT-KHEN-THUONG');
  assert.equal(synthesized[0].name, 'Khen thưởng');
  assert.equal(synthesized[0].status, 'active');
});

test('Canonical 8 rule groups, point sign classification (+/-/0/unspecified), and grouped web filter', () => {
  assert.equal(CANONICAL_RULE_GROUPS.length, 8);
  assert.equal(findCanonicalRuleGroup('III. VỆ SINH, TRỰC NHẬT')?.name, 'III. VỆ SINH, TRỰC NHẬT, LAO ĐỘNG');
  assert.equal(findCanonicalRuleGroup('V. SINH HOẠT, CHÀO CỜ, HĐNT')?.name, 'V. SINH HOẠT, CHÀO CỜ, HOẠT ĐỘNG NGOÀI TRỜI');
  assert.equal(findCanonicalRuleGroup('Hoạt động tập thể')?.defaultTargetScope, 'class');
  assert.equal(findCanonicalRuleGroup('VIII. CÁC HĐ KHÁC')?.order, 8);

  const sample: RuleCriterion[] = [
    {
      id: 'R1',
      code: 'TC-1',
      categoryId: 'C1',
      categoryName: 'I. NỀ NẾP',
      stt: 2,
      name: 'Đi học muộn',
      description: 'Đi học muộn',
      behavior: 'Đi học muộn',
      type: 'violation',
      points: -2,
      pointsSpecified: true,
      disciplineForm: 'Nhắc nhở',
      targetScope: 'individual',
      status: 'active',
      createdBy: 'Admin',
      createdAt: '2026-09-01',
    },
    {
      id: 'R2',
      code: 'TC-2',
      categoryId: 'C1',
      categoryName: 'I. NỀ NẾP',
      stt: 1,
      name: 'Đi học đúng giờ',
      description: 'Đi học đúng giờ',
      behavior: 'Đi học đúng giờ',
      type: 'achievement',
      points: 5,
      pointsSpecified: true,
      targetScope: 'individual',
      status: 'active',
      createdBy: 'Admin',
      createdAt: '2026-09-01',
    },
    {
      id: 'R3',
      code: 'TC-3',
      categoryId: 'C2',
      categoryName: 'II. THẺ, PHÙ HIỆU',
      stt: 1,
      name: 'Quên thẻ lần đầu',
      description: 'Quên thẻ lần đầu',
      behavior: 'Quên thẻ lần đầu',
      type: 'violation',
      points: 0,
      pointsSpecified: true,
      disciplineForm: 'Nhắc nhở',
      targetScope: 'individual',
      status: 'active',
      createdBy: 'Admin',
      createdAt: '2026-09-01',
    },
    {
      id: 'R4',
      code: 'TC-4',
      categoryId: 'C8',
      categoryName: 'VIII. CÁC HĐ KHÁC',
      stt: 1,
      name: 'Tham gia tình nguyện',
      description: 'Tham gia tình nguyện',
      behavior: 'Tham gia tình nguyện',
      type: 'achievement',
      points: null,
      pointsSpecified: false,
      targetScope: 'individual',
      status: 'active',
      createdBy: 'Admin',
      createdAt: '2026-09-01',
    },
  ];

  assert.equal(classifyCriterionPointSign(sample[0]), 'negative');
  assert.equal(classifyCriterionPointSign(sample[1]), 'positive');
  assert.equal(classifyCriterionPointSign(sample[2]), 'zero');
  assert.equal(classifyCriterionPointSign(sample[3]), 'unspecified');

  const allGrouped = groupAndFilterRuleCriteria(sample);
  assert.equal(allGrouped.sections.length, 3);
  assert.equal(allGrouped.sections[0].groupName, 'I. NỀ NẾP');
  // Sorted by STT inside section: R2 (stt=1) before R1 (stt=2)
  assert.equal(allGrouped.sections[0].items[0].id, 'R2');
  assert.equal(allGrouped.sections[0].items[1].id, 'R1');
  assert.deepEqual(allGrouped.countsByPointSign, {
    positive: 1,
    negative: 1,
    zero: 1,
    unspecified: 1,
  });

  const onlyNegative = groupAndFilterRuleCriteria(sample, { pointFilter: 'negative' });
  assert.equal(onlyNegative.filtered.length, 1);
  assert.equal(onlyNegative.filtered[0].id, 'R1');

  const onlyZero = groupAndFilterRuleCriteria(sample, { pointFilter: 'zero' });
  assert.equal(onlyZero.filtered.length, 1);
  assert.equal(onlyZero.filtered[0].id, 'R3');

  const byGroup = groupAndFilterRuleCriteria(sample, { groupFilter: 'II. THẺ, PHÙ HIỆU' });
  assert.equal(byGroup.filtered.length, 1);
  assert.equal(byGroup.filtered[0].id, 'R3');

  const bySearch = groupAndFilterRuleCriteria(sample, { searchQuery: 'tình nguyện' });
  assert.equal(bySearch.filtered.length, 1);
  assert.equal(bySearch.filtered[0].id, 'R4');
});
