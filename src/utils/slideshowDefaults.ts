import type { SchoolSlideshowConfig, SchoolSlideshowImage, SystemSettings } from '../types';

export const DEFAULT_SLIDESHOW_IMAGES: SchoolSlideshowImage[] = [
  {
    id: 'default-campus-1',
    url: '/images/campus/campus_courtyard.jpg',
    caption: 'Khuôn viên xanh — Không gian học đường thân thiện & hiện đại',
  },
  {
    id: 'default-library-2',
    url: '/images/campus/modern_library.jpg',
    caption: 'Thư viện số — Kết nối tri thức & văn hóa đọc',
  },
  {
    id: 'default-stem-3',
    url: '/images/campus/stem_classroom.jpg',
    caption: 'Phòng học thông minh — Sáng tạo & trải nghiệm STEM',
  },
];

export const DEFAULT_SCHOOL_SLIDESHOW: SchoolSlideshowConfig = {
  images: DEFAULT_SLIDESHOW_IMAGES,
  autoPlay: true,
  intervalSeconds: 5,
};

export const MAX_SLIDESHOW_TOTAL_BYTES = 750 * 1024; // Keep systemSettings doc safely below Firestore 1MB cap

export function clampSlideshowInterval(seconds?: number): number {
  const num = Number(seconds);
  if (!Number.isFinite(num) || num <= 0) return 5;
  return Math.min(60, Math.max(2, Math.round(num)));
}

export function resolveSlideshowConfig(settings?: SystemSettings | null): SchoolSlideshowConfig {
  const raw = settings?.schoolSlideshow;
  const validImages = Array.isArray(raw?.images)
    ? raw.images.filter(
        (img): img is SchoolSlideshowImage =>
          Boolean(img && typeof img.id === 'string' && typeof img.url === 'string' && img.url.trim().length > 0)
      )
    : [];

  return {
    images: validImages.length > 0 ? validImages : DEFAULT_SLIDESHOW_IMAGES,
    autoPlay: typeof raw?.autoPlay === 'boolean' ? raw.autoPlay : true,
    intervalSeconds: clampSlideshowInterval(raw?.intervalSeconds),
  };
}

export function estimateSlideshowPayloadBytes(images: SchoolSlideshowImage[]): number {
  return images.reduce((acc, item) => acc + item.url.length + (item.caption?.length || 0) + 48, 0);
}

export function compressSlideshowImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Vui lòng chỉ chọn tệp hình ảnh (JPG, PNG, WEBP).'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh đã chọn.'));
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        reject(new Error('Dữ liệu ảnh trống.'));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Định dạng ảnh không hợp lệ.'));
      img.onload = () => {
        const maxWidth = 1280;
        const maxHeight = 720;
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
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.78);
        resolve(compressed);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
