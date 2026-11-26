import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyGooglePopupError,
  createSingleFlightPopupRunner,
  extractFirebaseAuthCode,
} from './googleAuthHelpers';

test('createSingleFlightPopupRunner deduplicates concurrent calls of the same flow kind', async () => {
  const runner = createSingleFlightPopupRunner();
  let calls = 0;
  let resolveOp!: (value: string) => void;

  const startSignIn = () =>
    runner.run('signin', () => {
      calls += 1;
      return new Promise<string>((resolve) => {
        resolveOp = resolve;
      });
    });

  const p1 = startSignIn();
  const p2 = startSignIn();

  assert.equal(calls, 1);
  assert.equal(runner.isInFlight(), true);
  assert.equal(runner.getActiveKind(), 'signin');
  assert.strictEqual(p1, p2);

  resolveOp('signed-in-ok');
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1, 'signed-in-ok');
  assert.equal(r2, 'signed-in-ok');
  assert.equal(runner.isInFlight(), false);
  assert.equal(runner.getActiveKind(), null);
});

test('createSingleFlightPopupRunner rejects conflicting flow kinds without cancelling active popup and resets after rejection', async () => {
  const runner = createSingleFlightPopupRunner();
  let rejectOp!: (err: Error) => void;

  const p1 = runner.run('signin', () => {
    return new Promise<string>((_resolve, reject) => {
      rejectOp = reject;
    });
  });

  await assert.rejects(
    () => runner.run('workspace', async () => 'should-not-run'),
    (err: unknown) =>
      err instanceof Error &&
      (err as { code?: string }).code === 'auth/popup-already-open'
  );

  rejectOp(new Error('Firebase: Error (auth/popup-closed-by-user).'));
  await assert.rejects(() => p1, /popup-closed-by-user/);

  assert.equal(runner.isInFlight(), false);
  assert.equal(runner.getActiveKind(), null);

  // Subsequent call after settlement runs cleanly
  const next = await runner.run('workspace', async () => 'workspace-ok');
  assert.equal(next, 'workspace-ok');
});

test('extractFirebaseAuthCode and classifyGooglePopupError map Firebase popup errors cleanly', () => {
  assert.equal(
    extractFirebaseAuthCode(new Error('Firebase: Error (auth/unauthorized-domain).')),
    'auth/unauthorized-domain'
  );
  assert.equal(
    extractFirebaseAuthCode(new Error('INTERNAL ASSERTION FAILED: Pending promise was never set')),
    'auth/internal-error'
  );

  const cancelled = classifyGooglePopupError(
    Object.assign(new Error('Cancelled'), { code: 'auth/cancelled-popup-request' })
  );
  assert.equal(cancelled.isCancellation, true);
  assert.match(cancelled.message, /đóng cửa sổ/i);

  const unauthDomain = classifyGooglePopupError(
    new Error('Firebase: Error (auth/unauthorized-domain).')
  );
  assert.equal(unauthDomain.code, 'auth/unauthorized-domain');
  assert.match(unauthDomain.message, /unauthorized-domain/);

  const internalAssert = classifyGooglePopupError(
    new Error('INTERNAL ASSERTION FAILED: Pending promise was never set')
  );
  assert.equal(internalAssert.code, 'auth/internal-error');
  assert.equal(internalAssert.isCancellation, false);
  assert.match(internalAssert.message, /gián đoạn/i);
});
