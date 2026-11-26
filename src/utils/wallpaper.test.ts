import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SYSTEM_WALLPAPER,
  WALLPAPER_PRESETS,
  clampWallpaperBlur,
  clampWallpaperOverlay,
  isSafeWallpaperUrl,
  resolveSystemWallpaper,
} from './wallpaper';
import type { SystemSettings } from '../types';

test('clampWallpaperBlur enforces bounds 0..24px', () => {
  assert.equal(clampWallpaperBlur(-5), 0);
  assert.equal(clampWallpaperBlur(8.6), 9);
  assert.equal(clampWallpaperBlur(99), 24);
  assert.equal(clampWallpaperBlur(undefined), 0);
});

test('clampWallpaperOverlay enforces bounds 0..70% and uses sensible default', () => {
  assert.equal(clampWallpaperOverlay(-10), 0);
  assert.equal(clampWallpaperOverlay(25), 25);
  assert.equal(clampWallpaperOverlay(120), 70);
  assert.equal(clampWallpaperOverlay(undefined), DEFAULT_SYSTEM_WALLPAPER.overlayOpacity);
});

test('isSafeWallpaperUrl accepts campus assets, http/https, and image data URLs while blocking XSS', () => {
  assert.equal(isSafeWallpaperUrl('/images/campus/campus_courtyard.jpg'), true);
  assert.equal(isSafeWallpaperUrl('https://example.com/bg.webp'), true);
  assert.equal(isSafeWallpaperUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg=='), true);

  assert.equal(isSafeWallpaperUrl(''), false);
  assert.equal(isSafeWallpaperUrl('//evil.example/bg.png'), false);
  assert.equal(isSafeWallpaperUrl('javascript:alert(1)'), false);
  assert.equal(isSafeWallpaperUrl('data:text/html;base64,PHNjcmlwdD4='), false);
});

test('resolveSystemWallpaper defaults to aurora and safely resolves presets & custom images', () => {
  const defaultResolved = resolveSystemWallpaper(undefined);
  assert.equal(defaultResolved.mode, 'aurora');
  assert.equal(defaultResolved.presetId, 'aurora');
  assert.equal(defaultResolved.imageUrl, null);

  const presetResolved = resolveSystemWallpaper({
    systemWallpaper: {
      mode: 'preset',
      presetId: 'ocean-aurora',
      imageUrl: null,
      blurPx: 4,
      overlayOpacity: 20,
    },
  } as SystemSettings);
  assert.equal(presetResolved.mode, 'preset');
  assert.equal(presetResolved.presetId, 'ocean-aurora');
  assert.equal(presetResolved.blurPx, 4);

  const customImageResolved = resolveSystemWallpaper({
    systemWallpaper: {
      mode: 'image',
      presetId: null,
      imageUrl: 'https://images.example.com/school-bg.jpg',
      blurPx: 6,
      overlayOpacity: 30,
    },
  } as SystemSettings);
  assert.equal(customImageResolved.mode, 'image');
  assert.equal(customImageResolved.imageUrl, 'https://images.example.com/school-bg.jpg');

  const maliciousFallback = resolveSystemWallpaper({
    systemWallpaper: {
      mode: 'image',
      presetId: null,
      imageUrl: 'javascript:alert(1)',
      blurPx: 0,
      overlayOpacity: 10,
    },
  } as SystemSettings);
  assert.equal(maliciousFallback.mode, 'aurora');
  assert.equal(maliciousFallback.imageUrl, null);
});

test('WALLPAPER_PRESETS exposes aurora default, solid color presets, and campus photos', () => {
  assert.ok(WALLPAPER_PRESETS.some((p) => p.id === 'aurora' && p.mode === 'aurora'));
  assert.ok(WALLPAPER_PRESETS.some((p) => p.mode === 'preset' && Boolean(p.solidColor)));
  assert.ok(WALLPAPER_PRESETS.some((p) => p.mode === 'image' && Boolean(p.imageUrl)));
});
