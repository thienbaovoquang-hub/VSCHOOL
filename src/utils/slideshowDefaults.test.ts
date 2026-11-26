import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampSlideshowInterval,
  DEFAULT_SLIDESHOW_IMAGES,
  estimateSlideshowPayloadBytes,
  resolveSlideshowConfig,
} from './slideshowDefaults';
import type { SystemSettings } from '../types';

const BASE_SETTINGS: SystemSettings = {
  schoolName: 'Trường THPT SchoolHub',
  academicYear: '2026 - 2027',
  defaultLoanDays: 14,
  maxBorrowLimit: 3,
  compactMode: false,
  glassIntensity: 'high',
};

test('clampSlideshowInterval defaults to 5s and clamps to [2, 60]', () => {
  assert.equal(clampSlideshowInterval(undefined), 5);
  assert.equal(clampSlideshowInterval(0), 5);
  assert.equal(clampSlideshowInterval(-3), 5);
  assert.equal(clampSlideshowInterval(1), 2);
  assert.equal(clampSlideshowInterval(5), 5);
  assert.equal(clampSlideshowInterval(120), 60);
});

test('resolveSlideshowConfig falls back to default slides, autoPlay=true, interval=5s', () => {
  const cfg = resolveSlideshowConfig(BASE_SETTINGS);
  assert.equal(cfg.autoPlay, true);
  assert.equal(cfg.intervalSeconds, 5);
  assert.equal(cfg.images.length, DEFAULT_SLIDESHOW_IMAGES.length);
});

test('resolveSlideshowConfig preserves custom uploaded slides, autoPlay flag, and interval', () => {
  const customSettings: SystemSettings = {
    ...BASE_SETTINGS,
    schoolSlideshow: {
      images: [
        { id: 'c1', url: 'data:image/jpeg;base64,AAA', caption: 'Cổng trường' },
        { id: 'c2', url: 'data:image/jpeg;base64,BBB', caption: 'Sân vận động' },
      ],
      autoPlay: false,
      intervalSeconds: 9,
    },
  };
  const cfg = resolveSlideshowConfig(customSettings);
  assert.equal(cfg.autoPlay, false);
  assert.equal(cfg.intervalSeconds, 9);
  assert.equal(cfg.images.length, 2);
  assert.equal(cfg.images[0].caption, 'Cổng trường');
});

test('estimateSlideshowPayloadBytes computes deterministic payload size', () => {
  const bytes = estimateSlideshowPayloadBytes([
    { id: '1', url: 'abcde', caption: 'test' },
  ]);
  assert.equal(bytes, 5 + 4 + 48);
});
