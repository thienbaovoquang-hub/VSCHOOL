import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {
  generateSubjectExportBuffer,
  generateSubjectTemplateBuffer,
  parseSubjectExcelBuffer,
  type SubjectExcelSubjectId,
} from './subjectExcel';

const ALL_SUBJECT_MODULES: Array<{
  subjectId: SubjectExcelSubjectId;
  moduleKey: string;
  omittedFieldCheck?: { tabName: string; omittedHeader: string };
}> = [
  { subjectId: 'english', moduleKey: 'vocab', omittedFieldCheck: { tabName: 'Vocab_A1_A2', omittedHeader: 'Cấp độ' } },
  { subjectId: 'english', moduleKey: 'grammar', omittedFieldCheck: { tabName: 'Grammar_A1_A2', omittedHeader: 'Cấp độ' } },
  { subjectId: 'english', moduleKey: 'tests', omittedFieldCheck: { tabName: 'KT_15Phut', omittedHeader: 'Loại bài kiểm tra' } },
  { subjectId: 'english', moduleKey: 'quiz', omittedFieldCheck: { tabName: 'Level_B1', omittedHeader: 'Cấp độ' } },
  { subjectId: 'math', moduleKey: 'questions', omittedFieldCheck: { tabName: 'Toan_10A1', omittedHeader: 'Lớp áp dụng' } },
  { subjectId: 'math', moduleKey: 'formula', omittedFieldCheck: { tabName: 'Khoi_10', omittedHeader: 'Khối lớp' } },
  { subjectId: 'math', moduleKey: 'lessons', omittedFieldCheck: { tabName: 'Khoi_10', omittedHeader: 'Khối lớp' } },
  { subjectId: 'physics', moduleKey: 'questions', omittedFieldCheck: { tabName: 'Khoi_10', omittedHeader: 'Khối lớp' } },
  { subjectId: 'physics', moduleKey: 'formula', omittedFieldCheck: { tabName: 'Khoi_10', omittedHeader: 'Khối lớp' } },
  { subjectId: 'physics', moduleKey: 'lessons', omittedFieldCheck: { tabName: 'Khoi_11', omittedHeader: 'Khối lớp' } },
  { subjectId: 'chemistry', moduleKey: 'questions', omittedFieldCheck: { tabName: 'Khoi_10', omittedHeader: 'Khối lớp' } },
  { subjectId: 'chemistry', moduleKey: 'formula', omittedFieldCheck: { tabName: 'Khoi_10', omittedHeader: 'Khối lớp' } },
  { subjectId: 'chemistry', moduleKey: 'elements', omittedFieldCheck: { tabName: 'KimLoai', omittedHeader: 'Nhóm nguyên tố' } },
  { subjectId: 'chemistry', moduleKey: 'lessons', omittedFieldCheck: { tabName: 'Khoi_12', omittedHeader: 'Khối lớp' } },
  { subjectId: 'literature', moduleKey: 'works', omittedFieldCheck: { tabName: 'VanHocTrungDai', omittedHeader: 'Giai đoạn' } },
  { subjectId: 'literature', moduleKey: 'knowledge', omittedFieldCheck: { tabName: 'DocHieu', omittedHeader: 'Mảng kiến thức' } },
  { subjectId: 'literature', moduleKey: 'writing', omittedFieldCheck: { tabName: 'NghiLuanVanHoc', omittedHeader: 'Dạng bài viết' } },
  { subjectId: 'literature', moduleKey: 'questions', omittedFieldCheck: { tabName: 'Loai_TracNghiem', omittedHeader: 'Loại câu hỏi' } },
  { subjectId: 'history', moduleKey: 'history', omittedFieldCheck: { tabName: 'CoDai_TrungDai', omittedHeader: 'Thời kỳ' } },
  { subjectId: 'history', moduleKey: 'timeline', omittedFieldCheck: { tabName: 'CanDai', omittedHeader: 'Thời kỳ' } },
  { subjectId: 'history', moduleKey: 'archive', omittedFieldCheck: { tabName: 'VanKien', omittedHeader: 'Loại' } },
  { subjectId: 'history', moduleKey: 'practice', omittedFieldCheck: { tabName: 'Loai_mcq', omittedHeader: 'Loại' } },
  { subjectId: 'geography', moduleKey: 'knowledge', omittedFieldCheck: { tabName: 'Mang_TuNhien', omittedHeader: 'Mảng' } },
  { subjectId: 'geography', moduleKey: 'atlas', omittedFieldCheck: { tabName: 'Atlat_VietNam', omittedHeader: 'Phạm vi' } },
  { subjectId: 'geography', moduleKey: 'data' },
  { subjectId: 'geography', moduleKey: 'practice', omittedFieldCheck: { tabName: 'Loai_atlas', omittedHeader: 'Loại' } },
];

test('Generates multi-sheet workbooks with HUONG_DAN, hidden DANH_MUC Drop-downs, presetClasses, and omitted classified columns across all 7 subjects', async () => {
  const presetClasses = ['10A1', '10A2', '11A3'];

  for (const item of ALL_SUBJECT_MODULES) {
    const { buffer, spec } = await generateSubjectTemplateBuffer({
      subjectId: item.subjectId,
      moduleKey: item.moduleKey,
      presetClasses,
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer.buffer as ArrayBuffer);

    const guide = wb.getWorksheet('HUONG_DAN');
    assert.ok(guide, `${item.subjectId}:${item.moduleKey} missing HUONG_DAN`);

    const danhMuc = wb.getWorksheet('DANH_MUC');
    assert.ok(danhMuc, `${item.subjectId}:${item.moduleKey} missing DANH_MUC`);
    assert.equal(danhMuc.state, 'hidden', `${item.subjectId}:${item.moduleKey} DANH_MUC must be hidden`);

    // Verify presetClasses appear inside DANH_MUC whenever classes dropdown is configured
    const hasClassDropdownCol = spec.columns.some((c) => c.dropdownKey === 'classes');
    if (hasClassDropdownCol) {
      const dmHeaders = (danhMuc.getRow(1).values as unknown[]) || [];
      const classColIdx = dmHeaders.findIndex((h) => String(h || '').includes('Lớp cài đặt trước'));
      assert.ok(classColIdx >= 1, `${item.subjectId}:${item.moduleKey} DANH_MUC missing presetClasses column`);
      const dmClassVals = [2, 3, 4].map((r) => String(danhMuc.getCell(r, classColIdx).value || ''));
      assert.deepEqual(dmClassVals, presetClasses);
    }

    // Verify every data tab attaches ExcelJS list drop-downs referencing =DANH_MUC!
    for (const tab of spec.tabs) {
      const ws = wb.getWorksheet(tab.tabName);
      assert.ok(ws, `${item.subjectId}:${item.moduleKey} missing sheet tab ${tab.tabName}`);
      const omittedSet = new Set(tab.omittedKeys);
      const tabCols = spec.columns.filter((c) => !omittedSet.has(c.key));
      const actualHeaders = (ws.getRow(1).values as unknown[]).slice(1).map((v) => String(v || ''));
      assert.deepEqual(
        actualHeaders,
        tabCols.map((c) => c.header),
        `${item.subjectId}:${item.moduleKey}:${tab.tabName} must omit classified columns`
      );

      let listDropdownCount = 0;
      tabCols.forEach((col, idx) => {
        if (!col.dropdownKey) return;
        const dv = ws.getCell(2, idx + 1).dataValidation;
        assert.equal(dv?.type, 'list', `${item.subjectId}:${item.moduleKey}:${tab.tabName}:${col.key} missing list validation`);
        assert.ok(
          dv?.formulae?.[0]?.includes('DANH_MUC!'),
          `${item.subjectId}:${item.moduleKey}:${tab.tabName}:${col.key} must reference DANH_MUC`
        );
        listDropdownCount++;
      });
      assert.ok(listDropdownCount >= 1, `${item.subjectId}:${item.moduleKey}:${tab.tabName} must have >=1 drop-down list`);
    }

    if (item.omittedFieldCheck) {
      const checkedWs = wb.getWorksheet(item.omittedFieldCheck.tabName);
      assert.ok(checkedWs, `Expected tab ${item.omittedFieldCheck.tabName}`);
      const headers = (checkedWs.getRow(1).values as unknown[]).map((v) => String(v || ''));
      assert.equal(
        headers.includes(item.omittedFieldCheck.omittedHeader),
        false,
        `${item.subjectId}:${item.moduleKey}:${item.omittedFieldCheck.tabName} should omit "${item.omittedFieldCheck.omittedHeader}"`
      );
    }
  }
});

test('Parses multi-sheet workbooks across subjects and infers omitted classified fields and discovered entities', async () => {
  // 1. English Vocab (infers level A2 from Vocab_A1_A2 and discovers classes & topics)
  const engTpl = await generateSubjectTemplateBuffer({
    subjectId: 'english',
    moduleKey: 'vocab',
    presetClasses: ['10A1', '10A2'],
  });
  const engParsed = parseSubjectExcelBuffer({
    subjectId: 'english',
    moduleKey: 'vocab',
    buffer: engTpl.buffer,
    presetClasses: ['10A1', '10A2'],
  });
  assert.ok(engParsed.rows.length >= 1);
  assert.equal(engParsed.rows[0].level, 'A2');
  assert.equal(engParsed.rows[0].className, '10A1');
  assert.ok(engParsed.discoveredClasses.includes('10A1'));
  assert.ok(engParsed.discoveredTopics.includes('School'));
  assert.ok(engParsed.discoveredCategories.includes('A2'));

  // 2. Math Questions with presetClasses (Toan_10A1 infers className 10A1 & Lớp 10)
  const mathTpl = await generateSubjectTemplateBuffer({
    subjectId: 'math',
    moduleKey: 'questions',
    presetClasses: ['10A1', '11A2'],
  });
  const mathParsed = parseSubjectExcelBuffer({
    subjectId: 'math',
    moduleKey: 'questions',
    buffer: mathTpl.buffer,
    presetClasses: ['10A1', '11A2'],
  });
  assert.equal(mathParsed.rows.length, 1);
  assert.equal(mathParsed.rows[0].className, '10A1');
  assert.equal(mathParsed.rows[0].grade, 'Lớp 10');
  assert.deepEqual(mathParsed.discoveredClasses, ['10A1']);

  // 3. Literature Works (VanHocTrungDai infers period = 'Văn học trung đại')
  const litTpl = await generateSubjectTemplateBuffer({
    subjectId: 'literature',
    moduleKey: 'works',
    presetClasses: ['10A1'],
  });
  const litParsed = parseSubjectExcelBuffer({
    subjectId: 'literature',
    moduleKey: 'works',
    buffer: litTpl.buffer,
    presetClasses: ['10A1'],
  });
  assert.equal(litParsed.rows.length, 1);
  assert.equal(litParsed.rows[0].period, 'Văn học trung đại');
  assert.equal(litParsed.rows[0].className, '10A1');
  assert.ok(litParsed.discoveredCategories.includes('Văn học trung đại'));

  // 4. History Timeline (CoDai_TrungDai infers period = 'Cổ đại & Trung đại')
  const histTpl = await generateSubjectTemplateBuffer({
    subjectId: 'history',
    moduleKey: 'timeline',
  });
  const histParsed = parseSubjectExcelBuffer({
    subjectId: 'history',
    moduleKey: 'timeline',
    buffer: histTpl.buffer,
  });
  assert.equal(histParsed.rows.length, 1);
  assert.equal(histParsed.rows[0].era, 'Cổ đại & Trung đại');
  assert.ok(histParsed.discoveredCategories.includes('Cổ đại & Trung đại'));

  // 5. Geography Data Matrix (multi-sheet datasets support)
  const geoWb = new ExcelJS.Workbook();
  const s1 = geoWb.addWorksheet('CoCau_KinhTe');
  s1.addRow(['Đối tượng *', 'Đơn vị *', '2021', '2022', '2023', 'Nguồn']);
  s1.addRow(['Công nghiệp - xây dựng', '%', 37.5, 38.2, 37.1, 'TCTK']);
  const s2 = geoWb.addWorksheet('DanSo_LaoDong');
  s2.addRow(['Đối tượng *', 'Đơn vị *', '2021', '2022', '2023', 'Nguồn']);
  s2.addRow(['Dân số thành thị', '%', 37.1, 37.6, 38.1, 'TCTK']);
  const geoBuf = new Uint8Array(await geoWb.xlsx.writeBuffer());
  const geoParsed = parseSubjectExcelBuffer({
    subjectId: 'geography',
    moduleKey: 'data',
    buffer: geoBuf,
  });
  assert.equal(geoParsed.datasets?.length, 2);
  assert.equal(geoParsed.sheetNames.length, 2);
});

test('Exports multi-sheet Excel workbooks via generateSubjectExportBuffer and round-trips cleanly including Geography matrix and className preservation', async () => {
  // 1. Physics Formula export & round-trip
  const physExport = await generateSubjectExportBuffer({
    subjectId: 'physics',
    moduleKey: 'formula',
    presetClasses: ['10A1', '11A2'],
    records: [
      {
        name: 'Định luật II Newton',
        formula: 'F = m * a',
        topic: 'Động lực học',
        grade: 'Lớp 10',
        className: '10A1',
        meaning: 'Lực tỉ lệ thuận với gia tốc',
      },
      {
        name: 'Định luật Ohm',
        formula: 'I = U / R',
        topic: 'Dòng điện không đổi',
        grade: 'Lớp 11',
        className: '11A2',
        meaning: 'Cường độ dòng điện',
      },
    ],
  });
  const physParsed = parseSubjectExcelBuffer({
    subjectId: 'physics',
    moduleKey: 'formula',
    buffer: physExport.buffer,
    presetClasses: ['10A1', '11A2'],
  });
  assert.equal(physParsed.rows.length, 2);
  assert.ok(physParsed.discoveredClasses.includes('10A1'));
  assert.ok(physParsed.discoveredClasses.includes('11A2'));

  // 2. Geography Data export supporting both columns+rows and years+series
  const geoExport = await generateSubjectExportBuffer({
    subjectId: 'geography',
    moduleKey: 'data',
    records: [
      {
        title: 'GDP theo khu vực',
        unit: '%',
        columns: ['2021', '2022', '2023'],
        rows: [
          { label: 'Dịch vụ', values: [41.2, 41.8, 42.5] },
          { label: 'Công nghiệp', values: [37.5, 38.0, 37.9] },
        ],
        source: 'Tổng cục Thống kê',
      },
    ],
  });
  const geoParsed = parseSubjectExcelBuffer({
    subjectId: 'geography',
    moduleKey: 'data',
    buffer: geoExport.buffer,
  });
  assert.equal(geoParsed.datasets?.length, 1);
  assert.equal((geoParsed.datasets?.[0] as { rows?: unknown[] })?.rows?.length, 2);

  // 3. History & Geography normalized rows preserve className
  const histExport = await generateSubjectExportBuffer({
    subjectId: 'history',
    moduleKey: 'history',
    presetClasses: ['12A1'],
    records: [
      {
        title: 'Chiến thắng Điện Biên Phủ 1954',
        era: 'Hiện đại',
        year: '1954',
        grade: 'Lớp 12',
        className: '12A1',
        summary: 'Mốc son lịch sử kết thúc kháng chiến chống Pháp.',
      },
    ],
  });
  const histParsed = parseSubjectExcelBuffer({
    subjectId: 'history',
    moduleKey: 'history',
    buffer: histExport.buffer,
    presetClasses: ['12A1'],
  });
  assert.equal(histParsed.rows.length, 1);
  assert.equal(histParsed.rows[0].className, '12A1');
  assert.deepEqual(histParsed.discoveredClasses, ['12A1']);
});

