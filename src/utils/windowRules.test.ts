import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  calculateSnapBounds, detectSnapZone, clampWindowBounds, computeCascadePosition 
} from './windowRules';

test('calculateSnapBounds produces correct 1/2 screen splits for left and right', () => {
  const workspace = { width: 1440, height: 900 };

  const left = calculateSnapBounds('left', workspace);
  assert.equal(left.x, 0);
  assert.equal(left.y, 0);
  assert.equal(left.width, 720);
  assert.equal(left.height, 900);

  const right = calculateSnapBounds('right', workspace);
  assert.equal(right.x, 720);
  assert.equal(right.y, 0);
  assert.equal(right.width, 720);
  assert.equal(right.height, 900);
});

test('calculateSnapBounds produces accurate 1/4 screen quarter coordinates', () => {
  const workspace = { width: 1200, height: 800 };

  const topLeft = calculateSnapBounds('top-left', workspace);
  assert.deepEqual(topLeft, { x: 0, y: 0, width: 600, height: 400 });

  const bottomRight = calculateSnapBounds('bottom-right', workspace);
  assert.deepEqual(bottomRight, { x: 600, y: 400, width: 600, height: 400 });
});

test('detectSnapZone detects corner quarters and top edge maximization', () => {
  const workspace = { width: 1000, height: 800 };

  // Corner top-left
  assert.equal(detectSnapZone({ x: 10, y: 10 }, workspace, 24), 'top-left');

  // Corner top-right
  assert.equal(detectSnapZone({ x: 990, y: 10 }, workspace, 24), 'top-right');

  // Top edge (middle) -> Maximize
  assert.equal(detectSnapZone({ x: 500, y: 10 }, workspace, 24), 'maximized');

  // Left edge (middle) -> Left half
  assert.equal(detectSnapZone({ x: 10, y: 400 }, workspace, 24), 'left');

  // Middle center -> None
  assert.equal(detectSnapZone({ x: 500, y: 400 }, workspace, 24), 'none');
});

test('clampWindowBounds enforces minimum window sizes and keep title bar inside bounds', () => {
  const workspace = { width: 1000, height: 700 };

  const clamped = clampWindowBounds(
    { x: -50, y: -20, width: 200, height: 150 },
    workspace,
    { width: 480, height: 360 }
  );

  assert.equal(clamped.x, 0);
  assert.equal(clamped.y, 0);
  assert.equal(clamped.width, 480);
  assert.equal(clamped.height, 360);
});

test('computeCascadePosition shifts cascading windows sequentially', () => {
  const workspace = { width: 1200, height: 800 };
  const size = { width: 800, height: 600 };

  const pos0 = computeCascadePosition(0, workspace, size);
  const pos1 = computeCascadePosition(1, workspace, size);

  assert.equal(pos1.x - pos0.x, 32);
  assert.equal(pos1.y - pos0.y, 32);
});
