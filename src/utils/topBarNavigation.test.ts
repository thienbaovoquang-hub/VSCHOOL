import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_REGISTRY, SUPER_APP_ORDER } from '../data/appRegistry';
import type { SuperAppId, UserProfile } from '../types';
import type { WindowState } from '../types/window';
import {
  computeNextDragScroll,
  computeStepScrollTarget,
  computeTabScrollState,
  getVisibleActiveApp,
  resolveTopBarAppState,
} from './topBarNavigation';

function createMockWindows(overrides: Partial<Record<SuperAppId, Partial<WindowState>>> = {}): Record<SuperAppId, WindowState> {
  const map = {} as Record<SuperAppId, WindowState>;
  SUPER_APP_ORDER.forEach((appId, idx) => {
    const meta = APP_REGISTRY[appId];
    map[appId] = {
      windowId: `win-${appId}`,
      id: appId,
      appId,
      title: meta.title,
      isOpen: false,
      isMinimized: false,
      isMaximized: true,
      isActive: false,
      zIndex: 20 + idx,
      x: 0,
      y: 0,
      width: 1440,
      height: 900,
      snapPosition: 'maximized',
      activeTab: meta.defaultTab,
      ...overrides[appId],
    };
  });
  return map;
}

const adminUser: UserProfile = {
  id: 'u-admin',
  email: 'admin@school.edu.vn',
  displayName: 'Quản trị viên',
  role: 'admin',
  status: 'active',
};

const studentUser: UserProfile = {
  id: 'u-student',
  email: 'hs@school.edu.vn',
  displayName: 'Học sinh A',
  role: 'student',
  status: 'active',
};

test('returns null on Home when no active window is open', () => {
  const windows = createMockWindows();
  assert.equal(getVisibleActiveApp(windows, null), null);
  assert.equal(
    resolveTopBarAppState({ user: adminUser, windows, activeWindowId: null }),
    null
  );
});

test('returns null when activeWindowId points to minimized or closed window', () => {
  const windows = createMockWindows({
    admin: { isOpen: true, isMinimized: true, activeTab: 'users' },
  });
  assert.equal(getVisibleActiveApp(windows, 'admin'), null);
  assert.equal(
    resolveTopBarAppState({ user: adminUser, windows, activeWindowId: 'admin' }),
    null
  );
});

test('resolves option tabs in top bar for open full-screen app', () => {
  const windows = createMockWindows({
    admin: { isOpen: true, isMinimized: false, activeTab: 'users' },
  });
  const state = resolveTopBarAppState({
    user: adminUser,
    windows,
    activeWindowId: 'admin',
  });
  assert.ok(state);
  assert.equal(state.appId, 'admin');
  assert.equal(state.activeTab, 'users');
  assert.deepEqual(
    state.tabs.map((t) => t.id),
    ['overview', 'users', 'permissions', 'settings']
  );
});

test('filters top bar tabs by RBAC role and falls back to first allowed tab', () => {
  const windows = createMockWindows({
    library: { isOpen: true, isMinimized: false, activeTab: 'settings' },
  });
  const state = resolveTopBarAppState({
    user: studentUser,
    windows,
    activeWindowId: 'library',
  });
  assert.ok(state);
  assert.equal(state.appId, 'library');
  assert.equal(state.tabs.some((t) => t.id === 'settings'), false);
  assert.equal(state.activeTab, state.tabs[0].id);
});

test('normalizes legacy tab aliases for full-screen top bar navigation', () => {
  const windows = createMockWindows({
    subjects: { isOpen: true, isMinimized: false, activeTab: 'chemilab' },
  });
  const state = resolveTopBarAppState({
    user: studentUser,
    windows,
    activeWindowId: 'subjects',
  });
  assert.ok(state);
  assert.equal(state.activeTab, 'chemistry');
});

test('computeTabScrollState detects no overflow cleanly', () => {
  const state = computeTabScrollState({
    scrollLeft: 0,
    scrollWidth: 420,
    clientWidth: 420,
  });
  assert.deepEqual(state, {
    canScrollLeft: false,
    canScrollRight: false,
    hasOverflow: false,
    maxScrollLeft: 0,
  });
});

test('computeTabScrollState tracks left, middle, and right bounds when overflowing', () => {
  const atStart = computeTabScrollState({
    scrollLeft: 0,
    scrollWidth: 680,
    clientWidth: 480,
  });
  assert.deepEqual(atStart, {
    canScrollLeft: false,
    canScrollRight: true,
    hasOverflow: true,
    maxScrollLeft: 200,
  });

  const inMiddle = computeTabScrollState({
    scrollLeft: 95,
    scrollWidth: 680,
    clientWidth: 480,
  });
  assert.deepEqual(inMiddle, {
    canScrollLeft: true,
    canScrollRight: true,
    hasOverflow: true,
    maxScrollLeft: 200,
  });

  const atEnd = computeTabScrollState({
    scrollLeft: 200,
    scrollWidth: 680,
    clientWidth: 480,
  });
  assert.deepEqual(atEnd, {
    canScrollLeft: true,
    canScrollRight: false,
    hasOverflow: true,
    maxScrollLeft: 200,
  });
});

test('computeNextDragScroll distinguishes clicks (<= 5px) from drags and clamps scroll bounds', () => {
  const clickLike = computeNextDragScroll({
    startX: 300,
    currentX: 296,
    startScrollLeft: 40,
    maxScrollLeft: 200,
  });
  assert.equal(clickLike.isDragging, false);
  assert.equal(clickLike.dragDistance, 4);
  assert.equal(clickLike.nextScrollLeft, 44);

  const dragLeft = computeNextDragScroll({
    startX: 300,
    currentX: 180,
    startScrollLeft: 40,
    maxScrollLeft: 200,
  });
  assert.equal(dragLeft.isDragging, true);
  assert.equal(dragLeft.dragDistance, 120);
  assert.equal(dragLeft.nextScrollLeft, 160);

  const clampedMax = computeNextDragScroll({
    startX: 400,
    currentX: 50,
    startScrollLeft: 80,
    maxScrollLeft: 200,
  });
  assert.equal(clampedMax.nextScrollLeft, 200);

  const clampedMin = computeNextDragScroll({
    startX: 100,
    currentX: 280,
    startScrollLeft: 40,
    maxScrollLeft: 200,
  });
  assert.equal(clampedMin.nextScrollLeft, 0);
});

test('computeStepScrollTarget scrolls smoothly in steps and clamps at edges', () => {
  assert.equal(
    computeStepScrollTarget({
      scrollLeft: 0,
      clientWidth: 400,
      scrollWidth: 720,
      direction: 'right',
    }),
    260
  );

  assert.equal(
    computeStepScrollTarget({
      scrollLeft: 260,
      clientWidth: 400,
      scrollWidth: 720,
      direction: 'right',
    }),
    320
  );

  assert.equal(
    computeStepScrollTarget({
      scrollLeft: 200,
      clientWidth: 400,
      scrollWidth: 720,
      direction: 'left',
    }),
    0
  );
});
