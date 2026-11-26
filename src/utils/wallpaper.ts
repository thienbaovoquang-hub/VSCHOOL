import type {
  SystemSettings,
  SystemWallpaperConfig,
  SystemWallpaperMode,
} from '../types';

export const WALLPAPER_CACHE_STORAGE_KEY = 'vschool_wallpaper_cache_v1';
export const MAX_WALLPAPER_BYTES = 350 * 1024; // Keep systemSettings doc well under Firestore 1MB cap

export interface WallpaperPreset {
  id: string;
  label: string;
  mode: SystemWallpaperMode;
  solidColor?: string;
  imageUrl?: string | null;
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: 'aurora',
    label: 'Nền xanh mặc định',
    mode: 'aurora',
    solidColor: '#dde9fa',
    imageUrl: null,
  },
  {
    id: 'ocean-aurora',
    label: 'Xanh đại dương dịu',
    mode: 'preset',
    solidColor: '#cde6fd',
    imageUrl: null,
  },
  {
    id: 'sunset-silk',
    label: 'Hồng phấn nhẹ',
    mode: 'preset',
    solidColor: '#f8e3ea',
    imageUrl: null,
  },
  {
    id: 'emerald-breeze',
    label: 'Xanh ngọc dịu',
    mode: 'preset',
    solidColor: '#d2f2e8',
    imageUrl: null,
  },
  {
    id: 'campus-courtyard',
    label: 'Khuôn viên xanh',
    mode: 'image',
    imageUrl: '/images/campus/campus_courtyard.jpg',
  },
  {
    id: 'modern-library',
    label: 'Thư viện số',
    mode: 'image',
    imageUrl: '/images/campus/modern_library.jpg',
  },
  {
    id: 'stem-classroom',
    label: 'Phòng học STEM',
    mode: 'image',
    imageUrl: '/images/campus/stem_classroom.jpg',
  },
];

export const DEFAULT_SYSTEM_WALLPAPER: SystemWallpaperConfig = {
  mode: 'aurora',
  presetId: 'aurora',
  imageUrl: null,
  blurPx: 0,
  overlayOpacity: 18,
};

export function clampWallpaperBlur(value?: number): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.min(24, Math.round(num));
}

export function clampWallpaperOverlay(value?: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return DEFAULT_SYSTEM_WALLPAPER.overlayOpacity;
  if (num < 0) return 0;
  return Math.min(70, Math.round(num));
}

export function isSafeWallpaperUrl(url?: string | null): boolean {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > MAX_WALLPAPER_BYTES * 2) return false;

  if (trimmed.startsWith('/')) {
    return !trimmed.startsWith('//');
  }

  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-zA-Z0-9+/=]+$/i.test(trimmed)) {
    return trimmed.length <= MAX_WALLPAPER_BYTES + 128;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function findWallpaperPreset(presetId?: string | null): WallpaperPreset | undefined {
  if (!presetId) return undefined;
  return WALLPAPER_PRESETS.find((item) => item.id === presetId);
}

export function resolveSystemWallpaper(
  settings?: SystemSettings | null,
  fallback?: SystemWallpaperConfig | null
): SystemWallpaperConfig {
  const raw = settings?.systemWallpaper;
  const base = fallback || DEFAULT_SYSTEM_WALLPAPER;

  if (!raw) {
    return {
      ...base,
      blurPx: clampWallpaperBlur(base.blurPx),
      overlayOpacity: clampWallpaperOverlay(base.overlayOpacity),
    };
  }

  const preset = findWallpaperPreset(raw.presetId);
  const rawImageUrl =
    typeof raw.imageUrl === 'string' && isSafeWallpaperUrl(raw.imageUrl)
      ? raw.imageUrl.trim()
      : null;

  const blurPx = clampWallpaperBlur(raw.blurPx);
  const overlayOpacity = clampWallpaperOverlay(raw.overlayOpacity);

  if (raw.mode === 'image') {
    const resolvedUrl = rawImageUrl || (preset?.imageUrl && isSafeWallpaperUrl(preset.imageUrl) ? preset.imageUrl : null);
    if (resolvedUrl) {
      return {
        mode: 'image',
        presetId: preset?.id ?? null,
        imageUrl: resolvedUrl,
        blurPx,
        overlayOpacity,
      };
    }
    return {
      mode: 'aurora',
      presetId: 'aurora',
      imageUrl: null,
      blurPx,
      overlayOpacity,
    };
  }

  if (raw.mode === 'preset') {
    if (preset && preset.mode === 'preset') {
      return {
        mode: 'preset',
        presetId: preset.id,
        imageUrl: null,
        blurPx,
        overlayOpacity,
      };
    }
    if (preset && preset.mode === 'image' && preset.imageUrl) {
      return {
        mode: 'image',
        presetId: preset.id,
        imageUrl: preset.imageUrl,
        blurPx,
        overlayOpacity,
      };
    }
  }

  return {
    mode: 'aurora',
    presetId: 'aurora',
    imageUrl: null,
    blurPx,
    overlayOpacity,
  };
}

export function readCachedSystemWallpaper(): SystemWallpaperConfig {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_SYSTEM_WALLPAPER;
  }
  try {
    const raw = window.localStorage.getItem(WALLPAPER_CACHE_STORAGE_KEY);
    if (!raw) return DEFAULT_SYSTEM_WALLPAPER;
    const parsed = JSON.parse(raw) as SystemWallpaperConfig;
    return resolveSystemWallpaper({ systemWallpaper: parsed } as SystemSettings);
  } catch {
    return DEFAULT_SYSTEM_WALLPAPER;
  }
}

export function writeCachedSystemWallpaper(wallpaper: SystemWallpaperConfig): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const normalized = resolveSystemWallpaper({ systemWallpaper: wallpaper } as SystemSettings);
    window.localStorage.setItem(WALLPAPER_CACHE_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore localStorage quota exceeded errors cleanly
  }
}

export function compressWallpaperFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Vui lòng chọn tệp hình ảnh hợp lệ (JPG, PNG, WEBP).'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc tệp hình nền đã chọn.'));
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        reject(new Error('Dữ liệu hình ảnh trống.'));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Định dạng hình ảnh không hợp lệ.'));
      img.onload = () => {
        const maxWidth = 1600;
        const maxHeight = 900;
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          if (dataUrl.length <= MAX_WALLPAPER_BYTES) {
            resolve(dataUrl);
          } else {
            reject(new Error('Trình duyệt không hỗ trợ tối ưu kích thước ảnh nền.'));
          }
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        const candidates = [
          canvas.toDataURL('image/webp', 0.84),
          canvas.toDataURL('image/webp', 0.72),
          canvas.toDataURL('image/jpeg', 0.82),
          canvas.toDataURL('image/jpeg', 0.68),
        ];

        const fitted = candidates.find((c) => c.length <= MAX_WALLPAPER_BYTES);
        if (!fitted) {
          reject(
            new Error(
              'Ảnh sau tối ưu vẫn vượt giới hạn lưu trữ đám mây (350KB). Vui lòng chọn ảnh gọn nhẹ hơn.'
            )
          );
          return;
        }
        resolve(fitted);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
