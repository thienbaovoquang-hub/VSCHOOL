import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SYSTEM_FOOTER, resolveSystemFooter, sanitizeSocialUrl } from './footerConfig';
import type { SystemSettings } from '../types';

const BASE_SETTINGS: SystemSettings = {
  schoolName: 'Trường THPT Thực Hành',
  academicYear: '2026 - 2027',
  defaultLoanDays: 14,
  maxBorrowLimit: 3,
  compactMode: false,
  glassIntensity: 'high',
};

test('resolveSystemFooter provides default visible footer with brand title, contact info, and ownership statement', () => {
  const footer = resolveSystemFooter(BASE_SETTINGS);
  assert.equal(footer.visible, true);
  assert.equal(footer.title, 'VSCHOOL');
  assert.equal(footer.description, DEFAULT_SYSTEM_FOOTER.description);
  assert.equal(footer.logoUrl, null);
  assert.equal(footer.contactEmail, 'lienhe@vschool.edu.vn');
  assert.equal(footer.contactPhone, '(028) 3822 1234');
  assert.equal(footer.contactAddress, DEFAULT_SYSTEM_FOOTER.contactAddress);
  assert.equal(footer.copyright, DEFAULT_SYSTEM_FOOTER.copyright);
  assert.equal(footer.ownershipStatement, DEFAULT_SYSTEM_FOOTER.ownershipStatement);
  assert.equal(footer.facebookUrl, 'https://facebook.com');
  assert.equal(footer.instagramUrl, 'https://instagram.com');
});

test('resolveSystemFooter respects custom editable footer values, contact info, logo, and visibility toggle', () => {
  const footer = resolveSystemFooter({
    ...BASE_SETTINGS,
    systemFooter: {
      visible: false,
      title: 'THPT Chuyên',
      description: 'Cổng thông tin điện tử nội bộ',
      logoUrl: 'data:image/png;base64,abc123',
      contactEmail: 'admin@thptchuyen.edu.vn',
      contactPhone: '028 9999 8888',
      contactAddress: '123 Nguyễn Huệ, TP.HCM',
      copyright: '© 2026 THPT Chuyên',
      ownershipStatement: 'Vận hành bởi Ban Giám Hiệu THPT Chuyên',
      facebookUrl: 'facebook.com/thptchuyen',
      instagramUrl: '',
    },
  });
  assert.equal(footer.visible, false);
  assert.equal(footer.title, 'THPT Chuyên');
  assert.equal(footer.description, 'Cổng thông tin điện tử nội bộ');
  assert.equal(footer.logoUrl, 'data:image/png;base64,abc123');
  assert.equal(footer.contactEmail, 'admin@thptchuyen.edu.vn');
  assert.equal(footer.contactPhone, '028 9999 8888');
  assert.equal(footer.contactAddress, '123 Nguyễn Huệ, TP.HCM');
  assert.equal(footer.copyright, '© 2026 THPT Chuyên');
  assert.equal(footer.ownershipStatement, 'Vận hành bởi Ban Giám Hiệu THPT Chuyên');
  assert.equal(footer.facebookUrl, 'https://facebook.com/thptchuyen');
  assert.equal(footer.instagramUrl, '');
});

test('sanitizeSocialUrl blocks dangerous schemes and normalizes plain domains', () => {
  assert.equal(sanitizeSocialUrl('javascript:alert(1)'), '');
  assert.equal(sanitizeSocialUrl('data:text/html,hi'), '');
  assert.equal(sanitizeSocialUrl('https://instagram.com/vschool'), 'https://instagram.com/vschool');
  assert.equal(sanitizeSocialUrl('fb.com/vschool'), 'https://fb.com/vschool');
});
