import type { SystemSettings, SystemWeatherConfig } from '../types';

export const LEGACY_DEFAULT_WEATHER_URL =
  'https://www.windy.com/vi/-Tr%C3%ACnh-%C4%91%C6%A1n/menu?16.318,105.763,6';

export const DEFAULT_WEATHER_URL = 'https://www.windy.com/';

export const DEFAULT_SYSTEM_WEATHER: SystemWeatherConfig = {
  url: DEFAULT_WEATHER_URL,
};

export const WEATHER_CACHE_STORAGE_KEY = 'vschool_weather_cache_v1';
export const MAX_WEATHER_URL_LENGTH = 2048;

const KNOWN_WINDY_OVERLAYS = new Set([
  'wind',
  'rain',
  'thunder',
  'temp',
  'clouds',
  'pressure',
  'waves',
  'currents',
  'snowcover',
]);

export function isSafeWeatherUrl(url?: string | null): boolean {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > MAX_WEATHER_URL_LENGTH) return false;

  try {
    const parsed = new URL(trimmed);
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      parsed.hostname.trim().length > 0
    );
  } catch {
    return false;
  }
}

export function normalizeWeatherUrl(input?: string | null): {
  valid: boolean;
  url: string;
  error?: string;
} {
  const trimmed = typeof input === 'string' ? input.trim() : '';
  if (!trimmed) {
    return {
      valid: false,
      url: '',
      error: 'Vui lòng nhập đường dẫn trang thời tiết (https://...).',
    };
  }

  if (!isSafeWeatherUrl(trimmed)) {
    return {
      valid: false,
      url: trimmed,
      error: 'Đường dẫn không hợp lệ. Chỉ hỗ trợ URL bắt đầu bằng https:// hoặc http://.',
    };
  }

  return {
    valid: true,
    url: trimmed,
  };
}

const KNOWN_WINDY_PRODUCTS = new Set(['ecmwf', 'gfs', 'icon', 'namConus', 'cams']);
const KNOWN_WINDY_LEVELS = new Set(['surface', '950h', '850h', '700h', '500h', '300h']);

export interface WindyEmbedOptions {
  lat?: number;
  lon?: number;
  zoom?: number;
  overlay?: string;
  product?: string;
  level?: string;
}

/**
 * Resolves the iframe-safe embed URL for a configured weather link.
 * Standard `www.windy.com` pages send `CSP frame-ancestors 'self' *.windy.com:*`
 * and are blocked inside third-party iframes, so we map `www.windy.com` / `windy.com`
 * share URLs to Windy's official iframe embed endpoint (`embed.windy.com/embed2.html`)
 * while preserving the user's configured coordinates, zoom, layer, model, and level.
 * Any other URL (including `embed.windy.com` or custom weather sites) is returned directly
 * unless explicit Windy overrides are requested.
 */
export function resolveWeatherEmbedUrl(
  configuredUrl?: string | null,
  overrides?: WindyEmbedOptions
): string {
  const safeConfigured = isSafeWeatherUrl(configuredUrl)
    ? configuredUrl!.trim()
    : DEFAULT_WEATHER_URL;

  try {
    const parsed = new URL(safeConfigured);
    const host = parsed.hostname.toLowerCase();
    const isWindyRoot = host === 'www.windy.com' || host === 'windy.com';
    const isWindyEmbed = host === 'embed.windy.com';

    if (!isWindyRoot && !isWindyEmbed) {
      return safeConfigured;
    }

    if (isWindyEmbed && !overrides) {
      return safeConfigured;
    }

    let lat = 16.318;
    let lon = 105.763;
    let zoom = 6;
    let overlay = 'wind';
    let product = 'ecmwf';
    let level = 'surface';

    if (isWindyEmbed) {
      const qLat = Number(parsed.searchParams.get('lat'));
      const qLon = Number(parsed.searchParams.get('lon'));
      const qZoom = Number(parsed.searchParams.get('zoom'));
      const qOverlay = (parsed.searchParams.get('overlay') || '').trim();
      const qProduct = (parsed.searchParams.get('product') || '').trim();
      const qLevel = (parsed.searchParams.get('level') || '').trim();
      if (Number.isFinite(qLat) && qLat >= -90 && qLat <= 90) lat = qLat;
      if (Number.isFinite(qLon) && qLon >= -180 && qLon <= 180) lon = qLon;
      if (Number.isFinite(qZoom) && qZoom >= 3 && qZoom <= 18) zoom = Math.round(qZoom);
      if (KNOWN_WINDY_OVERLAYS.has(qOverlay)) overlay = qOverlay;
      if (KNOWN_WINDY_PRODUCTS.has(qProduct)) product = qProduct;
      if (KNOWN_WINDY_LEVELS.has(qLevel)) level = qLevel;
    } else {
      const rawQuery = decodeURIComponent(parsed.search.replace(/^\?/, ''));
      const coordMatch = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(?:\s*,\s*(\d+(?:\.\d+)?))?/.exec(
        rawQuery
      );
      if (coordMatch) {
        const parsedLat = Number(coordMatch[1]);
        const parsedLon = Number(coordMatch[2]);
        const parsedZoom = coordMatch[3] ? Math.round(Number(coordMatch[3])) : 6;
        if (Number.isFinite(parsedLat) && parsedLat >= -90 && parsedLat <= 90) {
          lat = parsedLat;
        }
        if (Number.isFinite(parsedLon) && parsedLon >= -180 && parsedLon <= 180) {
          lon = parsedLon;
        }
        if (Number.isFinite(parsedZoom) && parsedZoom >= 3 && parsedZoom <= 18) {
          zoom = parsedZoom;
        }
      }

      const tokens = `${parsed.pathname}/${rawQuery}`
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
      for (const token of tokens) {
        if (KNOWN_WINDY_OVERLAYS.has(token)) {
          overlay = token;
          break;
        }
      }
    }

    if (overrides) {
      if (typeof overrides.lat === 'number' && Number.isFinite(overrides.lat) && overrides.lat >= -90 && overrides.lat <= 90) {
        lat = Number(overrides.lat.toFixed(4));
      }
      if (typeof overrides.lon === 'number' && Number.isFinite(overrides.lon) && overrides.lon >= -180 && overrides.lon <= 180) {
        lon = Number(overrides.lon.toFixed(4));
      }
      if (typeof overrides.zoom === 'number' && Number.isFinite(overrides.zoom) && overrides.zoom >= 3 && overrides.zoom <= 18) {
        zoom = Math.round(overrides.zoom);
      }
      if (overrides.overlay && KNOWN_WINDY_OVERLAYS.has(overrides.overlay)) {
        overlay = overrides.overlay;
      }
      if (overrides.product && KNOWN_WINDY_PRODUCTS.has(overrides.product)) {
        product = overrides.product;
      }
      if (overrides.level && KNOWN_WINDY_LEVELS.has(overrides.level)) {
        level = overrides.level;
      }
    }

    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      detailLat: String(lat),
      detailLon: String(lon),
      zoom: String(zoom),
      level,
      overlay,
      product,
      menu: '',
      message: 'true',
      marker: overrides?.lat !== undefined ? 'true' : '',
      calendar: 'now',
      pressure: '',
      type: 'map',
      location: 'coordinates',
      detail: '',
      metricWind: 'default',
      metricTemp: 'default',
      radarRange: '-1',
    });

    return `https://embed.windy.com/embed2.html?${params.toString()}`;
  } catch {
    return safeConfigured;
  }
}

function upgradeLegacyDefaultWeatherUrl(url: string): string {
  return url === LEGACY_DEFAULT_WEATHER_URL ? DEFAULT_WEATHER_URL : url;
}

export function resolveSystemWeather(
  settings?: SystemSettings | null,
  fallback?: SystemWeatherConfig | null
): SystemWeatherConfig {
  const rawUrl = settings?.systemWeather?.url;
  if (isSafeWeatherUrl(rawUrl)) {
    return { url: upgradeLegacyDefaultWeatherUrl(rawUrl!.trim()) };
  }

  const fallbackUrl = fallback?.url;
  if (isSafeWeatherUrl(fallbackUrl)) {
    return { url: upgradeLegacyDefaultWeatherUrl(fallbackUrl!.trim()) };
  }

  return { ...DEFAULT_SYSTEM_WEATHER };
}

export function readCachedSystemWeather(): SystemWeatherConfig {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_SYSTEM_WEATHER };
  }
  try {
    const raw = window.localStorage.getItem(WEATHER_CACHE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SYSTEM_WEATHER };
    const parsed = JSON.parse(raw) as Partial<SystemWeatherConfig>;
    if (isSafeWeatherUrl(parsed.url)) {
      return { url: upgradeLegacyDefaultWeatherUrl(parsed.url!.trim()) };
    }
    return { ...DEFAULT_SYSTEM_WEATHER };
  } catch {
    return { ...DEFAULT_SYSTEM_WEATHER };
  }
}

export function writeCachedSystemWeather(config: SystemWeatherConfig): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const safeUrl = isSafeWeatherUrl(config.url)
      ? upgradeLegacyDefaultWeatherUrl(config.url.trim())
      : DEFAULT_WEATHER_URL;
    window.localStorage.setItem(WEATHER_CACHE_STORAGE_KEY, JSON.stringify({ url: safeUrl }));
  } catch {
    // Ignore storage quota errors
  }
}
