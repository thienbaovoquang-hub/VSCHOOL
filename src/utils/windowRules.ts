import { WindowSnapPosition } from '../types/window';

export interface WorkspaceSize {
  width: number;
  height: number;
}

export interface RectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SizeLimit {
  width: number;
  height: number;
}

/**
 * Calculates window bounds for Windows 11 snap positions
 */
export function calculateSnapBounds(
  snap: WindowSnapPosition, 
  workspace: WorkspaceSize
): RectBounds {
  const { width: W, height: H } = workspace;
  const halfW = Math.floor(W / 2);
  const halfH = Math.floor(H / 2);

  switch (snap) {
    case 'left':
      return { x: 0, y: 0, width: halfW, height: H };
    case 'right':
      return { x: halfW, y: 0, width: halfW, height: H };
    case 'top-left':
      return { x: 0, y: 0, width: halfW, height: halfH };
    case 'top-right':
      return { x: halfW, y: 0, width: halfW, height: halfH };
    case 'bottom-left':
      return { x: 0, y: halfH, width: halfW, height: halfH };
    case 'bottom-right':
      return { x: halfW, y: halfH, width: halfW, height: halfH };
    case 'maximized':
      return { x: 0, y: 0, width: W, height: H };
    case 'none':
    default:
      return { x: 40, y: 40, width: Math.min(960, W - 80), height: Math.min(640, H - 80) };
  }
}

/**
 * Detects which snap position should trigger based on drag cursor position
 */
export function detectSnapZone(
  cursor: { x: number; y: number },
  workspace: WorkspaceSize,
  threshold: number = 24
): WindowSnapPosition {
  const { x, y } = cursor;
  const { width: W, height: H } = workspace;

  const isNearLeft = x <= threshold;
  const isNearRight = x >= W - threshold;
  const isNearTop = y <= threshold;
  const isNearBottom = y >= H - threshold;

  // Corners (Quarter Snaps)
  if (isNearTop && isNearLeft) return 'top-left';
  if (isNearTop && isNearRight) return 'top-right';
  if (isNearBottom && isNearLeft) return 'bottom-left';
  if (isNearBottom && isNearRight) return 'bottom-right';

  // Edges (Half & Full Snaps)
  if (isNearTop) return 'maximized';
  if (isNearLeft) return 'left';
  if (isNearRight) return 'right';

  return 'none';
}

/**
 * Clamps a floating window bounds within the allowable workspace area
 */
export function clampWindowBounds(
  bounds: RectBounds,
  workspace: WorkspaceSize,
  minSize: SizeLimit = { width: 480, height: 360 }
): RectBounds {
  const width = Math.max(minSize.width, Math.min(bounds.width, workspace.width));
  const height = Math.max(minSize.height, Math.min(bounds.height, workspace.height));

  // Must have at least 100px visible on screen horizontally, and top titlebar within workspace
  const x = Math.max(0, Math.min(bounds.x, workspace.width - 120));
  const y = Math.max(0, Math.min(bounds.y, workspace.height - 48));

  return { x, y, width, height };
}

/**
 * Computes initial floating cascade position for a newly opened window
 */
export function computeCascadePosition(
  existingOpenCount: number,
  workspace: WorkspaceSize,
  defaultSize: SizeLimit
): RectBounds {
  const step = 32;
  const offset = (existingOpenCount % 8) * step;

  const width = Math.min(defaultSize.width, workspace.width - 40);
  const height = Math.min(defaultSize.height, workspace.height - 40);

  const centeredX = Math.max(20, Math.floor((workspace.width - width) / 2) + offset);
  const centeredY = Math.max(20, Math.floor((workspace.height - height) / 2) + offset);

  return clampWindowBounds({ x: centeredX, y: centeredY, width, height }, workspace, { width: 400, height: 300 });
}
