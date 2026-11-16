import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTH_PHASE_LABELS,
  AuthTimeoutError,
  classifyAuthFailure,
  hasAccountIdentityChanged,
  isAuthLoadingPhase,
  normalizeUserProfileSafe,
  withTimeout,
} from './authSession';

test('isAuthLoadingPhase differentiates loading phases from terminal UI phases', () => {
  assert.equal(isAuthLoadingPhase('checking_auth'), true);
  assert.equal(isAuthLoadingPhase('loading_profile'), true);
  assert.equal(isAuthLoadingPhase('loading_permissions'), true);
  assert.equal(isAuthLoadingPhase('loading_app'), true);

  assert.equal(isAuthLoadingPhase('authenticated'), false);
  assert.equal(isAuthLoadingPhase('signed_out'), false);
  assert.equal(isAuthLoadingPhase('access_denied'), false);
  assert.equal(isAuthLoadingPhase('error'), false);

  for (const key of Object.keys(AUTH_PHASE_LABELS) as Array<keyof typeof AUTH_PHASE_LABELS>) {
    assert.ok(AUTH_PHASE_LABELS[key].title.length > 0);
    assert.ok(AUTH_PHASE_LABELS[key].detail.length > 0);
  }
});

test('withTimeout resolves fast promises and rejects stalled promises with AuthTimeoutError', async () => {
  const ok = await withTimeout(Promise.resolve('ready'), 200, 'Timed out');
  assert.equal(ok, 'ready');

  await assert.rejects(
    () => withTimeout(new Promise(() => undefined), 20, 'Quá thời gian test'),
    (err: unknown) => err instanceof AuthTimeoutError && err.message === 'Quá thời gian test'
  );
});

test('normalizeUserProfileSafe repairs malformed legacy profiles without wiping metadata', () => {
  const repaired = normalizeUserProfileSafe(
    {
      id: 'uid-account-b',
      email: '',
      displayName: '   ',
      role: 'UNKNOWN_ROLE' as never,
      version: 0,
      schoolId: '   ',
      studentCode: 'HS-2026-99',
      className: '11A2',
      linkedProfileId: 'STU-99',
      secondaryRoles: ['librarian', 'INVALID_ROLE' as never],
    },
    {
      email: 'account.b@school.vn',
      displayName: 'Tài Khoản B',
      photoURL: 'https://example.com/b.png',
      fallbackRole: 'admin',
    }
  );

  assert.equal(repaired.id, 'uid-account-b');
  assert.equal(repaired.email, 'account.b@school.vn');
  assert.equal(repaired.displayName, 'Tài Khoản B');
  assert.equal(repaired.role, 'admin');
  assert.equal(repaired.status, 'active');
  assert.equal(repaired.version, 1);
  assert.equal(repaired.schoolId, 'schoolhub_main');
  assert.equal(repaired.avatarUrl, 'https://example.com/b.png');
  assert.equal(repaired.studentCode, 'HS-2026-99');
  assert.equal(repaired.className, '11A2');
  assert.equal(repaired.linkedProfileId, 'STU-99');
  assert.deepEqual(repaired.secondaryRoles, ['librarian']);
});

test('hasAccountIdentityChanged detects A -> B and sign-out/sign-in transitions cleanly', () => {
  assert.equal(hasAccountIdentityChanged(null, null), false);
  assert.equal(hasAccountIdentityChanged('uid-a', 'uid-a'), false);
  assert.equal(hasAccountIdentityChanged(null, 'uid-a'), true);
  assert.equal(hasAccountIdentityChanged('uid-a', null), true);
  assert.equal(hasAccountIdentityChanged('uid-a', 'uid-b'), true);
});

test('classifyAuthFailure unwraps Firestore permission, timeout, and offline errors clearly', () => {
  const permDenied = classifyAuthFailure(
    new Error(
      JSON.stringify({
        error: 'Missing or insufficient permissions.',
        operationType: 'write',
        path: 'users/uid-b',
      })
    )
  );
  assert.equal(permDenied.kind, 'access_denied');
  assert.match(permDenied.message, /Firestore/);

  const timeoutErr = classifyAuthFailure(new AuthTimeoutError('Quá thời gian đọc hồ sơ'));
  assert.equal(timeoutErr.kind, 'error');
  assert.match(timeoutErr.message, /Quá thời gian đọc hồ sơ/);

  const offlineErr = classifyAuthFailure(new Error('Failed to get document because the client is offline.'));
  assert.equal(offlineErr.kind, 'error');
  assert.match(offlineErr.message, /mất mạng|kết nối/i);
});
