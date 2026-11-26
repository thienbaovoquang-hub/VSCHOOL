import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  GAUTH_URL,
  SUBJECT_CATALOG,
  getActiveSubjects,
  getGauthTabSpec,
  getSubjectById,
  resolveSubjectThemeMode,
} from './subjectRegistry';

test('Subject catalog registers all 7 active native React subjects with sub-tabs and VSCHOOL matchAliases', () => {
  const active = getActiveSubjects();
  assert.equal(active.length, 7);
  assert.equal(SUBJECT_CATALOG.length, 7);
  assert.deepEqual(
    active.map((s) => s.id),
    ['english', 'math', 'physics', 'chemistry', 'literature', 'history', 'geography']
  );

  for (const subject of active) {
    assert.ok(subject.subTabs.length >= 3, `${subject.id} must define at least 3 native subTabs`);
    assert.ok(subject.matchAliases.length >= 2, `${subject.id} must define matchAliases for cross-web sync`);
    assert.ok(subject.capabilities.length >= 4, `${subject.id} must define capabilities`);
    assert.equal('htmlPath' in subject, false, `${subject.id} must no longer use external iframe htmlPath`);
  }
});

test('getSubjectById resolves registered subjects and returns undefined for unknown IDs', () => {
  assert.equal(getSubjectById('english')?.title, 'Tiếng Anh');
  assert.equal(getSubjectById('math')?.title, 'Toán');
  assert.equal(getSubjectById('physics')?.title, 'Vật Lý');
  assert.equal(getSubjectById('chemistry')?.title, 'Hóa Học');
  assert.equal(getSubjectById('literature')?.title, 'Ngữ Văn');
  assert.equal(getSubjectById('history')?.title, 'Lịch Sử');
  assert.equal(getSubjectById('geography')?.title, 'Địa Lý');
  assert.equal(getSubjectById('biology'), undefined);
});

test('resolveSubjectThemeMode maps boolean darkMode cleanly', () => {
  assert.equal(resolveSubjectThemeMode(true), 'dark');
  assert.equal(resolveSubjectThemeMode(false), 'light');
});

test('SubjectsApp and subject views integrate natively without iframes', () => {
  const subjectsAppPath = path.join(process.cwd(), 'src', 'components', 'apps', 'SubjectsApp.tsx');
  const appCode = fs.readFileSync(subjectsAppPath, 'utf8');

  assert.equal(appCode.includes('<iframe'), false, 'SubjectsApp must never render an <iframe>');
  assert.equal(appCode.includes('EnglishSubjectView'), true);
  assert.equal(appCode.includes('MathSubjectView'), true);
  assert.equal(appCode.includes('PhysicsSubjectView'), true);
  assert.equal(appCode.includes('ChemistrySubjectView'), true);
  assert.equal(appCode.includes('LiteratureSubjectView'), true);
  assert.equal(appCode.includes('HistorySubjectView'), true);
  assert.equal(appCode.includes('GeographySubjectView'), true);
  assert.equal(appCode.includes('matchSubjectSchoolContext'), true);
});

test('Shared workspace wires real backend APIs and Gauth resource link without secondary provider stubs', () => {
  assert.equal(GAUTH_URL, 'https://www.gauth.com/');
  const sharedPath = path.join(process.cwd(), 'src', 'components', 'subjects', 'SubjectWorkspaceShared.tsx');
  const sharedCode = fs.readFileSync(sharedPath, 'utf8');
  assert.equal(sharedCode.includes('/api/ai/subject-assist-stream'), true);
  assert.equal(sharedCode.includes('/api/ai/subject-structured'), true);
  assert.equal(sharedCode.includes('/api/subjects/excel-template'), true);
  assert.equal(sharedCode.includes('/api/subjects/parse-excel'), true);
  assert.equal(sharedCode.includes('/api/subjects/export-excel'), true);
  assert.equal(sharedCode.includes('GAUTH_URL'), true);

  for (const subject of getActiveSubjects()) {
    const spec = getGauthTabSpec(subject);
    assert.equal(spec.url, 'https://www.gauth.com/');
    assert.equal(spec.subjectId, subject.id);
  }
});

test('Native subject views connect directly to dedicated external and parser APIs', () => {
  const checks: Array<{ file: string; tokens: string[] }> = [
    { file: 'EnglishSubjectView.tsx', tokens: ['/api/external/lexicon', 'Wiktionary'] },
    { file: 'PhysicsSubjectView.tsx', tokens: ['/api/external/nasa/apod', '/api/external/nasa/neo'] },
    { file: 'ChemistrySubjectView.tsx', tokens: ['/api/external/pubchem'] },
    { file: 'LiteratureSubjectView.tsx', tokens: ['/api/literature/parse-document', '/api/library/gutendex-search', '/api/ai/subject-structured'] },
    { file: 'HistorySubjectView.tsx', tokens: ['/api/history/parse-document', '/api/external/wikipedia'] },
    { file: 'GeographySubjectView.tsx', tokens: ['/api/geography/parse-document', '/api/external/nominatim', '/api/external/countries', '/api/external/worldbank/compare'] },
  ];

  for (const check of checks) {
    const code = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'subjects', check.file),
      'utf8'
    );
    for (const token of check.tokens) {
      assert.equal(code.includes(token), true, `${check.file} must integrate ${token}`);
    }
  }
});
