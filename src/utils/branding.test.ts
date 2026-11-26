import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BRAND_NAME,
  DEFAULT_SYSTEM_BRANDING,
  normalizeBrandName,
  resolveSystemBranding,
  splitBrandWordmark,
} from './branding';
import type { SystemSettings } from '../types';

const BASE_SETTINGS: SystemSettings = {
  schoolName: 'Trường THPT Thực Hành',
  academicYear: '2026 - 2027',
  defaultLoanDays: 14,
  maxBorrowLimit: 3,
  compactMode: false,
  glassIntensity: 'high',
};

test('resolveSystemBranding defaults to VSCHOOL with null custom logo', () => {
  const branding = resolveSystemBranding(BASE_SETTINGS);
  assert.equal(branding.appName, DEFAULT_BRAND_NAME);
  assert.equal(branding.logoUrl, null);
  assert.deepEqual(branding, DEFAULT_SYSTEM_BRANDING);
});

test('resolveSystemBranding allows customizing name and logo independently', () => {
  const onlyCustomName = resolveSystemBranding({
    ...BASE_SETTINGS,
    systemBranding: { appName: 'EduPortal', logoUrl: null },
  });
  assert.equal(onlyCustomName.appName, 'EduPortal');
  assert.equal(onlyCustomName.logoUrl, null);

  const onlyCustomLogo = resolveSystemBranding({
    ...BASE_SETTINGS,
    systemBranding: { appName: 'VSCHOOL', logoUrl: 'data:image/png;base64,LOGO' },
  });
  assert.equal(onlyCustomLogo.appName, 'VSCHOOL');
  assert.equal(onlyCustomLogo.logoUrl, 'data:image/png;base64,LOGO');
});

test('normalizeBrandName trims whitespace and falls back to VSCHOOL on empty', () => {
  assert.equal(normalizeBrandName('   '), 'VSCHOOL');
  assert.equal(normalizeBrandName('  MySchool Cloud  '), 'MySchool Cloud');
});

test('splitBrandWordmark splits VS and CHOOL for VSCHOOL (case-insensitive)', () => {
  const v1 = splitBrandWordmark('VSCHOOL');
  assert.equal(v1.isVschool, true);
  assert.equal(v1.prefix, 'VS');
  assert.equal(v1.suffix, 'CHOOL');

  const v2 = splitBrandWordmark('CustomHub');
  assert.equal(v2.isVschool, false);
  assert.equal(v2.fullName, 'CustomHub');
});
