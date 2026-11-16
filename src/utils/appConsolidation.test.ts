import test from 'node:test';
import assert from 'node:assert/strict';
import { SUPER_APP_ORDER, APP_REGISTRY, LEGACY_MODULE_TO_SUPER_APP } from '../data/appRegistry';
import type { AppModuleId, SuperAppId } from '../types';

test('Desktop has strictly 8 consolidated Super Apps', () => {
  assert.equal(SUPER_APP_ORDER.length, 8);
  assert.deepEqual(SUPER_APP_ORDER, [
    'admin',
    'school',
    'learning',
    'library',
    'services',
    'communication',
    'facilities',
    'analytics',
  ]);
  assert.equal(Object.keys(APP_REGISTRY).length, 8);
});

test('Every Super App defines valid defaultTab and unique Pill Navigation tabs', () => {
  for (const appId of SUPER_APP_ORDER) {
    const app = APP_REGISTRY[appId];
    assert.ok(app, `Missing metadata for ${appId}`);
    assert.ok(app.tabs.length >= 2, `Expected >=2 tabs for ${appId}`);
    const tabIds = app.tabs.map((t) => t.id);
    assert.equal(new Set(tabIds).size, tabIds.length, `Duplicate tab IDs in ${appId}`);
    assert.ok(tabIds.includes(app.defaultTab), `Invalid defaultTab in ${appId}`);
  }
});

test('Streamlined Super Apps maintain clean Pill tab sets', () => {
  assert.deepEqual(APP_REGISTRY.admin.tabs.map((t) => t.id), ['overview', 'users', 'permissions', 'settings']);
  assert.deepEqual(APP_REGISTRY.school.tabs.map((t) => t.id), ['students-classes', 'staff-hr', 'emulation']);
  assert.equal(APP_REGISTRY.learning.title, 'Lịch học');
  assert.deepEqual(APP_REGISTRY.learning.tabs.map((t) => t.id), ['timetable', 'schedule']);
  assert.deepEqual(APP_REGISTRY.library.tabs.map((t) => t.id), ['overview', 'catalog', 'circulation', 'history', 'settings']);
  assert.deepEqual(APP_REGISTRY.services.tabs.map((t) => t.id), ['surveys', 'counseling', 'leave']);
});

test('All 17 modules map cleanly into the 8 Super Apps', () => {
  const legacyModules: AppModuleId[] = [
    'dashboard', 'students', 'staff', 'classes', 'timetable', 'library',
    'surveys', 'feedback', 'counseling', 'academic', 'announcements',
    'facilities', 'reports', 'datacenter', 'permissions', 'emulation', 'rules',
  ];
  for (const mod of legacyModules) {
    const mapped = LEGACY_MODULE_TO_SUPER_APP[mod];
    assert.ok(mapped, `Missing legacy mapping for ${mod}`);
    assert.ok(SUPER_APP_ORDER.includes(mapped.appId as SuperAppId));
    const tabExists = APP_REGISTRY[mapped.appId].tabs.some((t) => t.id === mapped.tabId);
    assert.ok(tabExists, `Invalid mapped tab ${mapped.tabId} for ${mod}`);
  }
});
