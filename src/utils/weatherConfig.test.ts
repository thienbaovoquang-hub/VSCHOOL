import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SYSTEM_WEATHER,
  DEFAULT_WEATHER_URL,
  LEGACY_DEFAULT_WEATHER_URL,
  isSafeWeatherUrl,
  normalizeWeatherUrl,
  resolveSystemWeather,
  resolveWeatherEmbedUrl,
} from './weatherConfig';
import type { SystemSettings } from '../types';

const BASE_SETTINGS: SystemSettings = {
  schoolName: 'Trường THPT Thực Hành',
  academicYear: '2026 - 2027',
  defaultLoanDays: 14,
  maxBorrowLimit: 3,
  compactMode: false,
  glassIntensity: 'high',
};

test('DEFAULT_WEATHER_URL matches requested Windy root URL', () => {
  assert.equal(DEFAULT_WEATHER_URL, 'https://www.windy.com/');
  assert.equal(DEFAULT_SYSTEM_WEATHER.url, DEFAULT_WEATHER_URL);
});

test('isSafeWeatherUrl accepts http/https URLs and rejects unsafe schemes or malformed inputs', () => {
  assert.equal(isSafeWeatherUrl(DEFAULT_WEATHER_URL), true);
  assert.equal(isSafeWeatherUrl('https://embed.windy.com/embed2.html?lat=16.3&lon=105.7'), true);
  assert.equal(isSafeWeatherUrl('http://localhost:8080/weather'), true);

  assert.equal(isSafeWeatherUrl(''), false);
  assert.equal(isSafeWeatherUrl('   '), false);
  assert.equal(isSafeWeatherUrl(null), false);
  assert.equal(isSafeWeatherUrl('javascript:alert(1)'), false);
  assert.equal(isSafeWeatherUrl('data:text/html,<script>alert(1)</script>'), false);
  assert.equal(isSafeWeatherUrl('file:///etc/passwd'), false);
  assert.equal(isSafeWeatherUrl('not-a-valid-url'), false);
  assert.equal(isSafeWeatherUrl(`https://example.com/${'a'.repeat(2100)}`), false);
});

test('normalizeWeatherUrl trims valid URLs and reports clear validation errors', () => {
  const ok = normalizeWeatherUrl('  https://www.windy.com/?10.8,106.6,7  ');
  assert.equal(ok.valid, true);
  assert.equal(ok.url, 'https://www.windy.com/?10.8,106.6,7');
  assert.equal(ok.error, undefined);

  const empty = normalizeWeatherUrl('   ');
  assert.equal(empty.valid, false);
  assert.ok(empty.error && empty.error.length > 0);

  const bad = normalizeWeatherUrl('javascript:void(0)');
  assert.equal(bad.valid, false);
  assert.ok(bad.error && bad.error.length > 0);
});

test('resolveSystemWeather falls back safely to default, upgrades legacy default, and honors custom valid URLs', () => {
  assert.deepEqual(resolveSystemWeather(BASE_SETTINGS), DEFAULT_SYSTEM_WEATHER);

  const legacyUpgraded = resolveSystemWeather({
    ...BASE_SETTINGS,
    systemWeather: { url: LEGACY_DEFAULT_WEATHER_URL },
  });
  assert.equal(legacyUpgraded.url, 'https://www.windy.com/');

  const custom = resolveSystemWeather({
    ...BASE_SETTINGS,
    systemWeather: { url: 'https://www.windy.com/21.028,105.854,8' },
  });
  assert.equal(custom.url, 'https://www.windy.com/21.028,105.854,8');

  const unsafeStored = resolveSystemWeather({
    ...BASE_SETTINGS,
    systemWeather: { url: 'javascript:alert(1)' },
  });
  assert.equal(unsafeStored.url, DEFAULT_WEATHER_URL);

  const withFallback = resolveSystemWeather(BASE_SETTINGS, {
    url: 'https://www.windy.com/?16.047,108.206,7',
  });
  assert.equal(withFallback.url, 'https://www.windy.com/?16.047,108.206,7');
});

test('resolveWeatherEmbedUrl maps www.windy.com links to embed.windy.com preserving coordinates and overlay', () => {
  const defaultEmbed = resolveWeatherEmbedUrl(DEFAULT_WEATHER_URL);
  const parsedDefault = new URL(defaultEmbed);
  assert.equal(parsedDefault.origin, 'https://embed.windy.com');
  assert.equal(parsedDefault.searchParams.get('lat'), '16.318');
  assert.equal(parsedDefault.searchParams.get('lon'), '105.763');
  assert.equal(parsedDefault.searchParams.get('zoom'), '6');
  assert.equal(parsedDefault.searchParams.get('overlay'), 'wind');

  const rainEmbed = resolveWeatherEmbedUrl('https://www.windy.com/vi/-Mua-rain?rain,21.028,105.854,8');
  const parsedRain = new URL(rainEmbed);
  assert.equal(parsedRain.origin, 'https://embed.windy.com');
  assert.equal(parsedRain.searchParams.get('lat'), '21.028');
  assert.equal(parsedRain.searchParams.get('lon'), '105.854');
  assert.equal(parsedRain.searchParams.get('zoom'), '8');
  assert.equal(parsedRain.searchParams.get('overlay'), 'rain');

  const directEmbed = 'https://embed.windy.com/embed2.html?lat=10.8&lon=106.6&zoom=7';
  assert.equal(resolveWeatherEmbedUrl(directEmbed), directEmbed);

  const customWeatherSite = 'https://nchmf.gov.vn/Kttvsite/';
  assert.equal(resolveWeatherEmbedUrl(customWeatherSite), customWeatherSite);
});

test('resolveWeatherEmbedUrl supports dynamic Nominatim lat/lon, overlay, product, and level overrides', () => {
  const overridden = resolveWeatherEmbedUrl(DEFAULT_WEATHER_URL, {
    lat: 16.0544,
    lon: 108.2022,
    zoom: 9,
    overlay: 'clouds',
    product: 'gfs',
    level: '850h',
  });
  const parsed = new URL(overridden);
  assert.equal(parsed.origin, 'https://embed.windy.com');
  assert.equal(parsed.searchParams.get('lat'), '16.0544');
  assert.equal(parsed.searchParams.get('lon'), '108.2022');
  assert.equal(parsed.searchParams.get('zoom'), '9');
  assert.equal(parsed.searchParams.get('overlay'), 'clouds');
  assert.equal(parsed.searchParams.get('product'), 'gfs');
  assert.equal(parsed.searchParams.get('level'), '850h');
  assert.equal(parsed.searchParams.get('marker'), 'true');
});

