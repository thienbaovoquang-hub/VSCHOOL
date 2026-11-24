import type { SystemFooterConfig, SystemSettings } from '../types';
import { resolveSystemBranding } from './branding';

export const DEFAULT_SYSTEM_FOOTER: SystemFooterConfig = {
  visible: true,
  title: 'VSCHOOL',
  description:
    'Hệ sinh thái giáo dục thông minh kết nối quản trị nhà trường, giảng dạy, thư viện và cộng đồng học đường trên một nền tảng thống nhất.',
  logoUrl: null,
  contactEmail: 'lienhe@vschool.edu.vn',
  contactPhone: '(028) 3822 1234',
  contactAddress: 'Cổng thông tin giáo dục & điều hành trường học trực tuyến',
  copyright: '© 2026 VSCHOOL. Bảo lưu mọi quyền.',
  ownershipStatement: 'Phát triển bởi Đội ngũ Công nghệ Giáo dục VSCHOOL',
  facebookUrl: 'https://facebook.com',
  instagramUrl: 'https://instagram.com',
};

export function sanitizeSocialUrl(raw?: string | null): string {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) return '';
  if (/^javascript:/i.test(trimmed) || /^data:/i.test(trimmed) || /^vbscript:/i.test(trimmed)) {
    return '';
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function resolveSystemFooter(settings?: SystemSettings | null): SystemFooterConfig {
  const raw = settings?.systemFooter;
  const branding = resolveSystemBranding(settings);
  const brandTitle = branding.appName || DEFAULT_SYSTEM_FOOTER.title;

  if (!raw) {
    return {
      ...DEFAULT_SYSTEM_FOOTER,
      title: brandTitle,
      copyright: `© 2026 ${brandTitle}. Bảo lưu mọi quyền.`,
      ownershipStatement: `Phát triển bởi Đội ngũ Công nghệ Giáo dục ${brandTitle}`,
    };
  }

  return {
    visible: typeof raw.visible === 'boolean' ? raw.visible : true,
    title:
      typeof raw.title === 'string' && raw.title.trim().length > 0
        ? raw.title.trim().slice(0, 64)
        : brandTitle,
    description:
      typeof raw.description === 'string'
        ? raw.description.trim().slice(0, 240)
        : DEFAULT_SYSTEM_FOOTER.description,
    logoUrl:
      typeof raw.logoUrl === 'string' && raw.logoUrl.trim().length > 0
        ? raw.logoUrl.trim()
        : null,
    contactEmail:
      typeof raw.contactEmail === 'string'
        ? raw.contactEmail.trim().slice(0, 100)
        : DEFAULT_SYSTEM_FOOTER.contactEmail,
    contactPhone:
      typeof raw.contactPhone === 'string'
        ? raw.contactPhone.trim().slice(0, 40)
        : DEFAULT_SYSTEM_FOOTER.contactPhone,
    contactAddress:
      typeof raw.contactAddress === 'string'
        ? raw.contactAddress.trim().slice(0, 140)
        : DEFAULT_SYSTEM_FOOTER.contactAddress,
    copyright:
      typeof raw.copyright === 'string'
        ? raw.copyright.trim().slice(0, 100)
        : `© 2026 ${brandTitle}. Bảo lưu mọi quyền.`,
    ownershipStatement:
      typeof raw.ownershipStatement === 'string'
        ? raw.ownershipStatement.trim().slice(0, 140)
        : `Phát triển bởi Đội ngũ Công nghệ Giáo dục ${brandTitle}`,
    facebookUrl:
      typeof raw.facebookUrl === 'string'
        ? sanitizeSocialUrl(raw.facebookUrl)
        : DEFAULT_SYSTEM_FOOTER.facebookUrl,
    instagramUrl:
      typeof raw.instagramUrl === 'string'
        ? sanitizeSocialUrl(raw.instagramUrl)
        : DEFAULT_SYSTEM_FOOTER.instagramUrl,
  };
}
