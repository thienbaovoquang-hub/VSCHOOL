import type { SystemBrandingConfig, SystemSettings } from '../types';

export const DEFAULT_BRAND_NAME = 'VSCHOOL';

export const DEFAULT_SYSTEM_BRANDING: SystemBrandingConfig = {
  appName: DEFAULT_BRAND_NAME,
  logoUrl: null,
};

export const BRANDING_CACHE_STORAGE_KEY = 'vschool_branding_cache_v1';
export const MAX_BRAND_LOGO_BYTES = 200 * 1024;

export function normalizeBrandName(name?: string | null): string {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return trimmed.slice(0, 48) || DEFAULT_BRAND_NAME;
}

export function resolveSystemBranding(
  settings?: SystemSettings | null,
  fallback?: SystemBrandingConfig
): SystemBrandingConfig {
  const raw = settings?.systemBranding;
  const baseName = fallback?.appName || DEFAULT_BRAND_NAME;
  const baseLogo = fallback?.logoUrl ?? null;

  if (!raw) {
    return {
      appName: normalizeBrandName(baseName),
      logoUrl: baseLogo,
    };
  }

  const appName =
    typeof raw.appName === 'string' && raw.appName.trim().length > 0
      ? normalizeBrandName(raw.appName)
      : normalizeBrandName(baseName);

  const logoUrl =
    typeof raw.logoUrl === 'string' && raw.logoUrl.trim().length > 0
      ? raw.logoUrl.trim()
      : raw.logoUrl === null
        ? null
        : baseLogo;

  return { appName, logoUrl };
}

export function splitBrandWordmark(name: string): {
  isVschool: boolean;
  prefix: string;
  suffix: string;
  fullName: string;
} {
  const clean = normalizeBrandName(name);
  if (clean.toUpperCase() === 'VSCHOOL') {
    return {
      isVschool: true,
      prefix: clean.slice(0, 2),
      suffix: clean.slice(2),
      fullName: clean,
    };
  }
  return {
    isVschool: false,
    prefix: '',
    suffix: '',
    fullName: clean,
  };
}

export function readCachedSystemBranding(): SystemBrandingConfig {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_SYSTEM_BRANDING;
  }
  try {
    const raw = window.localStorage.getItem(BRANDING_CACHE_STORAGE_KEY);
    if (!raw) return DEFAULT_SYSTEM_BRANDING;
    const parsed = JSON.parse(raw) as Partial<SystemBrandingConfig>;
    return {
      appName: normalizeBrandName(parsed.appName),
      logoUrl:
        typeof parsed.logoUrl === 'string' && parsed.logoUrl.trim().length > 0
          ? parsed.logoUrl.trim()
          : null,
    };
  } catch {
    return DEFAULT_SYSTEM_BRANDING;
  }
}

export function writeCachedSystemBranding(branding: SystemBrandingConfig): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const normalized: SystemBrandingConfig = {
      appName: normalizeBrandName(branding.appName),
      logoUrl:
        typeof branding.logoUrl === 'string' && branding.logoUrl.trim().length > 0
          ? branding.logoUrl.trim()
          : null,
    };
    window.localStorage.setItem(BRANDING_CACHE_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage quota errors
  }
}

export function compressBrandLogoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WEBP, SVG).'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc tệp logo đã chọn.'));
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        reject(new Error('Dữ liệu logo trống.'));
        return;
      }

      // Preserve crisp small SVGs directly if within payload limit
      if (file.type === 'image/svg+xml' && dataUrl.length <= MAX_BRAND_LOGO_BYTES) {
        resolve(dataUrl);
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Định dạng hình ảnh logo không hợp lệ.'));
      img.onload = () => {
        const maxDim = 256;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // Prefer PNG to keep transparent logo backgrounds; fall back to WebP/JPEG if oversized
        let output = canvas.toDataURL('image/png');
        if (output.length > MAX_BRAND_LOGO_BYTES) {
          output = canvas.toDataURL('image/webp', 0.86);
        }
        if (output.length > MAX_BRAND_LOGO_BYTES) {
          output = canvas.toDataURL('image/jpeg', 0.82);
        }
        if (output.length > MAX_BRAND_LOGO_BYTES) {
          reject(new Error('Logo sau tối ưu vẫn vượt 200KB. Vui lòng chọn ảnh gọn nhẹ hơn.'));
          return;
        }
        resolve(output);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
