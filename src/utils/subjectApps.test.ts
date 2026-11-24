import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILTIN_SUBJECT_HTML_MODULES,
  SUBJECT_DEFINITIONS,
  buildSubjectIframeUrl,
  createUploadedHtmlModule,
  extractHtmlTitle,
  formatBytesCompact,
  getModulesForSubject,
  getSubjectSummaries,
  mergeSubjectHtmlModules,
  parseSubjectProgressMessage,
  validateHtmlAppUpload,
} from './subjectApps';

test('SUBJECT_DEFINITIONS puts Tiếng Anh (english) first and defines multiple school subjects', () => {
  assert.ok(SUBJECT_DEFINITIONS.length >= 6);
  assert.equal(SUBJECT_DEFINITIONS[0].id, 'english');
  assert.equal(SUBJECT_DEFINITIONS[0].name, 'Tiếng Anh');
  assert.equal(SUBJECT_DEFINITIONS[0].order, 1);

  const ids = SUBJECT_DEFINITIONS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes('math'));
  assert.ok(ids.includes('literature'));
  assert.ok(ids.includes('physics'));
});

test('BUILTIN_SUBJECT_HTML_MODULES includes standalone english.html as the first subject HTML app', () => {
  const englishModules = getModulesForSubject([...BUILTIN_SUBJECT_HTML_MODULES], 'english');
  assert.equal(englishModules.length, 1);
  assert.equal(englishModules[0].fileName, 'english.html');
  assert.equal(englishModules[0].sourceType, 'builtin');
  assert.equal(englishModules[0].srcUrl, '/subject-apps/english.html');
  assert.equal(englishModules[0].isDefault, true);
});

test('extractHtmlTitle extracts clean title and decodes basic entities', () => {
  const html = '<!DOCTYPE html><html><head><title>Toán 12 &amp; Đồ thị</title></head><body></body></html>';
  assert.equal(extractHtmlTitle(html), 'Toán 12 & Đồ thị');
  assert.equal(extractHtmlTitle('<html><body>No title</body></html>'), null);
});

test('validateHtmlAppUpload accepts valid HTML files and rejects invalid extensions or empty payloads', () => {
  const valid = validateHtmlAppUpload(
    'math-graph.html',
    '<!DOCTYPE html><html><head><title>Đồ thị hàm số</title></head><body><div>App</div></body></html>'
  );
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.title, 'Đồ thị hàm số');
    assert.equal(valid.sanitizedFileName, 'math-graph.html');
    assert.ok(valid.sizeBytes > 20);
  }

  const badExt = validateHtmlAppUpload('notes.txt', '<div>Hello</div>');
  assert.equal(badExt.ok, false);

  const emptyContent = validateHtmlAppUpload('empty.html', '   ');
  assert.equal(emptyContent.ok, false);

  const plainText = validateHtmlAppUpload('plain.html', 'Just plain text without any markup');
  assert.equal(plainText.ok, false);

  const tooBig = validateHtmlAppUpload('big.html', '<div>ok</div>', 5);
  assert.equal(tooBig.ok, false);
});

test('createUploadedHtmlModule + mergeSubjectHtmlModules preserves builtin english.html and adds uploaded modules', () => {
  const mathMod = createUploadedHtmlModule({
    subjectId: 'math',
    fileName: 'ham-so-bac-hai.html',
    htmlContent: '<!DOCTYPE html><html><head><title>Hàm số bậc hai</title></head><body><main>Toán</main></body></html>',
    nowIso: '2026-11-21T10:00:00.000Z',
  });

  assert.equal(mathMod.subjectId, 'math');
  assert.equal(mathMod.title, 'Hàm số bậc hai');
  assert.equal(mathMod.sourceType, 'uploaded');

  const merged = mergeSubjectHtmlModules([mathMod]);
  const summaries = getSubjectSummaries(merged);

  const eng = summaries.find((s) => s.subject.id === 'english');
  const math = summaries.find((s) => s.subject.id === 'math');
  const lit = summaries.find((s) => s.subject.id === 'literature');

  assert.ok(eng?.hasHtmlApp);
  assert.equal(eng?.moduleCount, 1);
  assert.ok(math?.hasHtmlApp);
  assert.equal(math?.moduleCount, 1);
  assert.equal(lit?.hasHtmlApp, false);
  assert.equal(lit?.moduleCount, 0);
});

test('buildSubjectIframeUrl and parseSubjectProgressMessage validate URLs and postMessage payloads', () => {
  assert.equal(
    buildSubjectIframeUrl('/subject-apps/english.html', true),
    '/subject-apps/english.html?theme=dark'
  );
  assert.equal(
    buildSubjectIframeUrl('/subject-apps/english.html?v=1', false),
    '/subject-apps/english.html?v=1&theme=light'
  );

  const parsed = parseSubjectProgressMessage({
    type: 'schoolhub-subject-progress',
    subjectId: 'english',
    masteredCount: 5.4,
    masteredTotal: 12,
    quizScore: 7,
    quizTotal: 8,
    activeSection: 'vocab',
  });
  assert.deepEqual(parsed, {
    subjectId: 'english',
    masteredCount: 5,
    masteredTotal: 12,
    quizScore: 7,
    quizTotal: 8,
    activeSection: 'vocab',
    updatedAt: undefined,
  });

  assert.equal(parseSubjectProgressMessage({ type: 'other', subjectId: 'english' }), null);
  assert.equal(parseSubjectProgressMessage({ type: 'schoolhub-subject-progress', subjectId: 'unknown' }), null);
  assert.equal(formatBytesCompact(2048), '2.0 KB');
});
