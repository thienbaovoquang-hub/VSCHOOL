import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  SUBJECT_CATALOG,
  getActiveSubjects,
  getSubjectById,
  resolveSubjectThemeMode,
} from './subjectRegistry';

test('Subject catalog includes English, Math, Physics, Chemistry, Literature, History, and Geography as active subjects', () => {
  const active = getActiveSubjects();
  assert.equal(active.length, 7);
  assert.equal(SUBJECT_CATALOG.length, 7);
  assert.deepEqual(
    active.map((s) => s.id),
    ['english', 'math', 'physics', 'chemistry', 'literature', 'history', 'geography']
  );
  assert.equal(active[0].title, 'Tiếng Anh');
  assert.equal(active[0].htmlPath, '/assets/aistudio/anh_40c06e4c.html');
  assert.equal(active[1].title, 'Toán');
  assert.equal(active[1].htmlPath, '/assets/aistudio/MathBuddy___H_c_To_n_4da2fcc3.html');
  assert.equal(active[2].title, 'Vật Lý');
  assert.equal(active[2].htmlPath, '/assets/aistudio/V_t_L__Cute_54063342.html');
  assert.equal(active[3].title, 'Hóa Học');
  assert.equal(active[3].htmlPath, '/assets/aistudio/ChemiLab___H_c_H_a_vui_d8d22fe2.html');
  assert.equal(active[4].title, 'Ngữ Văn');
  assert.equal(active[4].htmlPath, '/assets/aistudio/3gemini-code-1795352432020_cdd2c619.html');
  assert.equal(active[5].title, 'Lịch Sử');
  assert.equal(active[5].htmlPath, '/assets/aistudio/SuKy_LichSu.html');
  assert.equal(active[6].title, 'Địa Lý');
  assert.equal(active[6].htmlPath, '/assets/aistudio/DiaLy_Atlat.html');
});

test('getSubjectById resolves registered subjects and returns undefined for unknown IDs', () => {
  const english = getSubjectById('english');
  const math = getSubjectById('math');
  const physics = getSubjectById('physics');
  const chemistry = getSubjectById('chemistry');
  const literature = getSubjectById('literature');
  const history = getSubjectById('history');
  const geography = getSubjectById('geography');
  assert.ok(english);
  assert.ok(math);
  assert.ok(physics);
  assert.ok(chemistry);
  assert.ok(literature);
  assert.ok(history);
  assert.ok(geography);
  assert.equal(english.appTitle, 'Lingo – Học tiếng Anh');
  assert.equal(math.appTitle, 'MathBuddy – Học Toán');
  assert.equal(physics.appTitle, 'Vật Lý Cute');
  assert.equal(chemistry.appTitle, 'ChemiLab – Học Hóa vui');
  assert.equal(literature.appTitle, 'Văn Hiến');
  assert.equal(history.appTitle, 'Sử Ký – Kho lưu trữ Lịch sử');
  assert.equal(geography.appTitle, 'Địa Lý – Atlat & Khám phá');
  assert.equal(getSubjectById('biology'), undefined);
});

test('All 7 subject HTML assets exist in public/assets/aistudio', () => {
  const expectedMarkers: Record<string, string> = {
    english: 'Lingo – Học tiếng Anh',
    math: 'MathBuddy – Học Toán',
    physics: 'Vật Lý Cute',
    chemistry: 'ChemiLab – Học Hóa vui',
    literature: 'Văn Hiến',
    history: 'Sử Ký',
    geography: 'Địa Lý – Atlat',
  };
  for (const [id, marker] of Object.entries(expectedMarkers)) {
    const subject = getSubjectById(id);
    assert.ok(subject, `Missing subject ${id}`);
    const relativeAssetPath = subject.htmlPath.replace(/^\//, '');
    const fullPath = path.join(process.cwd(), 'public', relativeAssetPath);
    assert.equal(fs.existsSync(fullPath), true, `Missing asset at ${fullPath}`);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.equal(content.includes(marker), true, `Missing marker ${marker} in ${fullPath}`);
  }
});

test('resolveSubjectThemeMode maps boolean darkMode to data-theme values', () => {
  assert.equal(resolveSubjectThemeMode(true), 'dark');
  assert.equal(resolveSubjectThemeMode(false), 'light');
});

test('Shared AI bridge asset and all 7 subject HTML modules wire Gemini bridge without JS syntax errors', () => {
  const bridgePath = path.join(process.cwd(), 'public', 'assets', 'aistudio', 'subject-ai-bridge.js');
  assert.equal(fs.existsSync(bridgePath), true, 'Missing subject-ai-bridge.js');
  const bridgeCode = fs.readFileSync(bridgePath, 'utf8');
  assert.doesNotThrow(() => new vm.Script(bridgeCode, { filename: 'subject-ai-bridge.js' }));

  const active = getActiveSubjects();
  for (const subject of active) {
    const fullPath = path.join(process.cwd(), 'public', subject.htmlPath.replace(/^\//, ''));
    const html = fs.readFileSync(fullPath, 'utf8');

    assert.equal(
      html.includes('/assets/aistudio/subject-ai-bridge.js'),
      true,
      `${subject.id} must include /assets/aistudio/subject-ai-bridge.js`
    );
    assert.equal(
      html.includes('SchoolHubAI.streamAssist') || html.includes('SchoolHubAI.generateQuiz'),
      true,
      `${subject.id} must call SchoolHubAI AI APIs`
    );
    assert.equal(
      html.includes('onHostCommand'),
      true,
      `${subject.id} must register SchoolHubAI.onHostCommand`
    );
    assert.equal(
      html.includes('emitContext'),
      true,
      `${subject.id} must emit subject context via SchoolHubAI.emitContext`
    );
    assert.equal(
      /onclick="[^"]*JSON\.stringify/.test(html),
      false,
      `${subject.id} must not embed JSON.stringify inside double-quoted onclick attributes`
    );

    // Parse all inline <script> blocks cleanly via node:vm
    const inlineScriptRegex = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;
    let scriptIdx = 0;
    while ((match = inlineScriptRegex.exec(html)) !== null) {
      const code = match[1].trim();
      if (!code) continue;
      scriptIdx++;
      assert.doesNotThrow(
        () => new vm.Script(code, { filename: `${subject.id}-inline-${scriptIdx}.js` }),
        `JS syntax error in ${subject.id} inline script #${scriptIdx}`
      );
    }
    assert.ok(scriptIdx >= 1, `${subject.id} should contain at least 1 inline script`);
  }

  // Ensure Literature no longer contains the legacy offline canned reply stub
  const litSubject = getSubjectById('literature');
  assert.ok(litSubject);
  const litHtml = fs.readFileSync(
    path.join(process.cwd(), 'public', litSubject.htmlPath.replace(/^\//, '')),
    'utf8'
  );
  assert.equal(litHtml.includes('Gợi ý tư duy: Xác định đối tượng nghị luận'), false);
  assert.equal(litHtml.includes('fileBase64: dataBase64'), true);
});

