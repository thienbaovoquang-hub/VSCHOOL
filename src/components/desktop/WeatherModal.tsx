import React, { useEffect, useState } from 'react';
import {
  X,
  CloudSun,
  Wind,
  Thermometer,
  RefreshCw,
  MapPin,
  Calendar,
  Sun,
  Activity,
  Search,
  Layers,
  Compass,
} from '../icons/UiIcons';
import {
  DEFAULT_WEATHER_URL,
  isSafeWeatherUrl,
  resolveWeatherEmbedUrl,
} from '../../utils/weatherConfig';
import type { NominatimPlace } from '../../utils/externalIntegrations';

interface WeatherModalProps {
  isOpen: boolean;
  weatherUrl: string;
  onClose: () => void;
}

interface LocationPreset {
  name: string;
  lat: number;
  lon: number;
}

const LOCATION_PRESETS: LocationPreset[] = [
  { name: 'Xã Quang Đồng, Yên Thành, Nghệ An', lat: 19.0003, lon: 105.4726 },
  { name: 'Hà Nội', lat: 21.0285, lon: 105.8542 },
  { name: 'TP. Hồ Chí Minh', lat: 10.8231, lon: 106.6297 },
  { name: 'Đà Nẵng', lat: 16.0544, lon: 108.2022 },
  { name: 'Sa Pa, Lào Cai', lat: 22.3364, lon: 103.8438 },
  { name: 'Huế', lat: 16.4637, lon: 107.5909 },
  { name: 'Cần Thơ', lat: 10.0452, lon: 105.7469 },
];

const WINDY_OVERLAYS = [
  { id: 'wind', label: 'Gió' },
  { id: 'rain', label: 'Mưa' },
  { id: 'temp', label: 'Nhiệt độ' },
  { id: 'clouds', label: 'Mây' },
  { id: 'pressure', label: 'Áp suất' },
  { id: 'thunder', label: 'Dông' },
  { id: 'waves', label: 'Sóng biển' },
];

const WINDY_MODELS = [
  { id: 'ecmwf', label: 'ECMWF (9km)' },
  { id: 'gfs', label: 'GFS (22km)' },
  { id: 'icon', label: 'ICON (13km)' },
];

const WINDY_LEVELS = [
  { id: 'surface', label: 'Bề mặt' },
  { id: '850h', label: '850 hPa (~1.5km)' },
  { id: '500h', label: '500 hPa (~5.5km)' },
];

interface OpenMeteoCurrent {
  temperature_2m: number;
  relative_humidity_2m: number;
  apparent_temperature: number;
  precipitation: number;
  weather_code: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
}

interface DailyForecast {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  weather_code: number[];
  sunrise?: string[];
  sunset?: string[];
}

interface AirQualityData {
  pm2_5?: number;
  pm10?: number;
  european_aqi?: number;
}

function getWeatherDescription(code: number): string {
  switch (code) {
    case 0: return 'Trời quang (Clear sky)';
    case 1:
    case 2:
    case 3: return 'Mây rải rác / Nhiều mây';
    case 45:
    case 48: return 'Sương mù';
    case 51:
    case 53:
    case 55: return 'Mưa phùn';
    case 61:
    case 63:
    case 65: return 'Mưa';
    case 71:
    case 73:
    case 75: return 'Tuyết rơi';
    case 95:
    case 96:
    case 99: return 'Dông sét';
    default: return 'Ổn định';
  }
}

function getAqiDescription(aqi?: number): { label: string; color: string } {
  if (aqi === undefined) return { label: 'Đang cập nhật', color: 'bg-slate-500/10 text-slate-600' };
  if (aqi <= 20) return { label: 'Tốt (Good)', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' };
  if (aqi <= 40) return { label: 'Khá (Fair)', color: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' };
  if (aqi <= 60) return { label: 'Trung bình (Moderate)', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' };
  if (aqi <= 80) return { label: 'Kém (Poor)', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' };
  return { label: 'Rất kém (Very Poor)', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' };
}

export const WeatherModal: React.FC<WeatherModalProps> = ({
  isOpen,
  weatherUrl,
  onClose,
}) => {
  const [selectedLocation, setSelectedLocation] = useState<LocationPreset>(LOCATION_PRESETS[0]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'radar'>('dashboard');
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Nominatim place search state
  const [geoQuery, setGeoQuery] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoResults, setGeoResults] = useState<NominatimPlace[]>([]);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Windy Embed layer controls
  const [windyOverlay, setWindyOverlay] = useState('wind');
  const [windyProduct, setWindyProduct] = useState('ecmwf');
  const [windyLevel, setWindyLevel] = useState('surface');
  const [windyZoom, setWindyZoom] = useState(7);

  const [currentWeather, setCurrentWeather] = useState<OpenMeteoCurrent | null>(null);
  const [dailyForecast, setDailyForecast] = useState<DailyForecast | null>(null);
  const [airQuality, setAirQuality] = useState<AirQualityData | null>(null);

  const safeUrl = isSafeWeatherUrl(weatherUrl) ? weatherUrl.trim() : DEFAULT_WEATHER_URL;
  const embedUrl = resolveWeatherEmbedUrl(safeUrl, {
    lat: selectedLocation.lat,
    lon: selectedLocation.lon,
    zoom: windyZoom,
    overlay: windyOverlay,
    product: windyProduct,
    level: windyLevel,
  });

  const fetchOpenMeteoData = async (lat: number, lon: number) => {
    setIsDataLoading(true);
    try {
      const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset&timezone=auto`;
      const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm2_5,pm10,european_aqi`;

      const [forecastRes, aqiRes] = await Promise.all([
        fetch(forecastUrl),
        fetch(aqiUrl).catch(() => null),
      ]);

      if (forecastRes.ok) {
        const data = await forecastRes.json();
        if (data.current) setCurrentWeather(data.current);
        if (data.daily) setDailyForecast(data.daily);
      }

      if (aqiRes && aqiRes.ok) {
        const aqiData = await aqiRes.json();
        if (aqiData.current) setAirQuality(aqiData.current);
      }
    } catch {
      // ignore network errors
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleNominatimSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = geoQuery.trim();
    if (!q) return;
    setGeoLoading(true);
    setGeoError(null);
    try {
      const res = await fetch(`/api/external/nominatim?q=${encodeURIComponent(q)}&limit=6`);
      const data = (await res.json()) as { results?: NominatimPlace[]; error?: string };
      if (!res.ok) {
        setGeoError(data.error || 'Không thể tìm địa điểm qua OpenStreetMap Nominatim.');
        setGeoResults([]);
        return;
      }
      const list = Array.isArray(data.results) ? data.results : [];
      setGeoResults(list);
      if (list.length === 0) {
        setGeoError(`Không tìm thấy địa danh khớp với "${q}".`);
      }
    } catch {
      setGeoError('Lỗi kết nối dịch vụ OpenStreetMap Nominatim.');
    } finally {
      setGeoLoading(false);
    }
  };

  const handleSelectNominatimPlace = (place: NominatimPlace) => {
    setSelectedLocation({
      name: place.name + (place.country ? `, ${place.country}` : ''),
      lat: place.lat,
      lon: place.lon,
    });
    setGeoResults([]);
    setGeoError(null);
    setWindyZoom(8);
  };

  const handleReverseGeolocate = async () => {
    setGeoLoading(true);
    setGeoError(null);
    const reverseCoords = async (lat: number, lon: number, fallbackLabel: string) => {
      try {
        const res = await fetch(
          `/api/external/nominatim/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`
        );
        const data = (await res.json()) as { place?: NominatimPlace | null; error?: string };
        if (res.ok && data.place) {
          setSelectedLocation({
            name: data.place.name + (data.place.country ? `, ${data.place.country}` : ''),
            lat: data.place.lat,
            lon: data.place.lon,
          });
        } else {
          setSelectedLocation({ name: fallbackLabel, lat, lon });
        }
        setWindyZoom(10);
      } catch {
        setGeoError('Không thể giải mã tọa độ qua OpenStreetMap Nominatim Reverse.');
      } finally {
        setGeoLoading(false);
      }
    };

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          void reverseCoords(
            Number(pos.coords.latitude.toFixed(5)),
            Number(pos.coords.longitude.toFixed(5)),
            'Vị trí GPS hiện tại'
          );
        },
        () => {
          void reverseCoords(
            selectedLocation.lat,
            selectedLocation.lon,
            selectedLocation.name
          );
        },
        { timeout: 6000 }
      );
    } else {
      await reverseCoords(selectedLocation.lat, selectedLocation.lon, selectedLocation.name);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchOpenMeteoData(selectedLocation.lat, selectedLocation.lon);
  }, [isOpen, selectedLocation]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const aqiInfo = getAqiDescription(airQuality?.european_aqi);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Khám phá Open-Meteo, Nominatim & Windy"
      data-testid="weather-modal"
      data-fullscreen="true"
      className="fixed inset-0 z-[70] w-screen h-[100dvh] bg-slate-100 dark:bg-slate-950 flex flex-col overflow-hidden animate-in fade-in duration-200"
    >
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-testid="weather-modal-close-btn"
            onClick={onClose}
            aria-label="Đóng"
            title="Đóng"
            className="h-8 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-rose-500 hover:text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Đóng</span>
          </button>
          <div className="flex items-center gap-2">
            <CloudSun className="w-5 h-5 text-sky-500" />
            <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
              Open-Meteo · Nominatim &amp; Windy Radar
            </span>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
          <button
            type="button"
            data-testid="weather-tab-dashboard"
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Bảng điều khiển Open-Meteo
          </button>
          <button
            type="button"
            data-testid="weather-tab-radar"
            onClick={() => setActiveTab('radar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'radar'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Bản đồ Radar Windy
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      {activeTab === 'dashboard' ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-100 dark:bg-slate-950">
          {/* Location Selector + OpenStreetMap Nominatim Geocoding Search */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <MapPin className="w-5 h-5 text-sky-500 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Địa điểm đang chọn ({selectedLocation.lat.toFixed(3)}, {selectedLocation.lon.toFixed(3)}):
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100">
                    {selectedLocation.name}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Chọn nhanh địa điểm"
                  value={
                    LOCATION_PRESETS.some((p) => p.lat === selectedLocation.lat)
                      ? String(selectedLocation.lat)
                      : 'custom'
                  }
                  onChange={(e) => {
                    const found = LOCATION_PRESETS.find((p) => p.lat === Number(e.target.value));
                    if (found) setSelectedLocation(found);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {LOCATION_PRESETS.map((loc) => (
                    <option key={loc.lat} value={loc.lat}>
                      {loc.name}
                    </option>
                  ))}
                  {!LOCATION_PRESETS.some((p) => p.lat === selectedLocation.lat) && (
                    <option value="custom">{selectedLocation.name}</option>
                  )}
                </select>

                <button
                  type="button"
                  data-testid="weather-nominatim-reverse-btn"
                  onClick={() => void handleReverseGeolocate()}
                  disabled={geoLoading}
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Định vị GPS / OSM</span>
                </button>

                <button
                  type="button"
                  onClick={() => fetchOpenMeteoData(selectedLocation.lat, selectedLocation.lon)}
                  disabled={isDataLoading}
                  className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isDataLoading ? 'animate-spin' : ''}`} />
                  <span>Làm mới</span>
                </button>
              </div>
            </div>

            {/* Nominatim Search Form */}
            <form onSubmit={handleNominatimSearch} className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  data-testid="weather-nominatim-input"
                  value={geoQuery}
                  onChange={(e) => setGeoQuery(e.target.value)}
                  placeholder="Tìm bất kỳ địa điểm qua OpenStreetMap Nominatim (VD: Phú Quốc, Tokyo, Hạ Long, London)..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <button
                type="submit"
                data-testid="weather-nominatim-submit"
                disabled={geoLoading}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{geoLoading ? 'Đang định vị...' : 'Tìm địa danh (OSM)'}</span>
              </button>
            </form>

            {geoError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{geoError}</p>
            )}

            {geoResults.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                {geoResults.map((place) => (
                  <button
                    key={place.placeId}
                    type="button"
                    onClick={() => handleSelectNominatimPlace(place)}
                    className="text-left p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-sky-50 dark:hover:bg-sky-900/30 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {place.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {place.displayName}
                    </div>
                    <div className="text-[10px] font-mono text-sky-600 dark:text-sky-400 mt-0.5 tabular-nums">
                      {place.lat.toFixed(4)}, {place.lon.toFixed(4)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Current Weather Cards Grid */}
          {currentWeather ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Temperature */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
                  <span>NHIỆT ĐỘ HIỆN TẠI</span>
                  <Thermometer className="w-4 h-4 text-sky-500" />
                </div>
                <div className="my-3">
                  <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                    {currentWeather.temperature_2m}°C
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                    Cảm giác như {currentWeather.apparent_temperature}°C
                  </div>
                </div>
                <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 w-fit">
                  {getWeatherDescription(currentWeather.weather_code)}
                </div>
              </div>

              {/* Air Quality (AQI) */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
                  <span>CHẤT LƯỢNG KHÔNG KHÍ (AQI)</span>
                  <Activity className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="my-3">
                  <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                    {airQuality?.european_aqi ?? '--'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                    PM2.5: {airQuality?.pm2_5 ?? '--'} µg/m³ · PM10: {airQuality?.pm10 ?? '--'} µg/m³
                  </div>
                </div>
                <div className={`text-xs font-semibold px-2.5 py-1 rounded-lg inline-flex items-center gap-1 w-fit ${aqiInfo.color}`}>
                  {aqiInfo.label}
                </div>
              </div>

              {/* Humidity & Precipitation */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
                  <span>ĐỘ ẨM &amp; LƯỢNG MƯA</span>
                  <CloudSun className="w-4 h-4 text-blue-500" />
                </div>
                <div className="my-3">
                  <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                    {currentWeather.relative_humidity_2m}%
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                    Lượng mưa hiện tại: {currentWeather.precipitation} mm
                  </div>
                </div>
                <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 w-fit">
                  Độ ẩm tương đối
                </div>
              </div>

              {/* Wind Speed & Direction */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
                  <span>TỐC ĐỘ &amp; HƯỚNG GIÓ</span>
                  <Wind className="w-4 h-4 text-amber-500" />
                </div>
                <div className="my-3">
                  <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                    {currentWeather.wind_speed_10m} <span className="text-lg font-bold">km/h</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                    Hướng gió: {currentWeather.wind_direction_10m}°
                  </div>
                </div>
                <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 w-fit">
                  Gió bề mặt 10m
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-center">
              <div className="w-8 h-8 rounded-full border-[3px] border-sky-500 border-t-transparent animate-spin mx-auto mb-3" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Đang kết nối Open-Meteo API...</p>
            </div>
          )}

          {/* Daylight / Sunrise-Sunset summary */}
          {dailyForecast?.sunrise?.[0] && dailyForecast?.sunset?.[0] && (
            <div className="bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
                <Sun className="w-4 h-4 text-amber-500" />
                <span>Chu kỳ ánh sáng mặt trời hôm nay</span>
              </div>
              <div className="flex items-center gap-4 tabular-nums font-semibold">
                <span className="text-amber-600 dark:text-amber-400">
                  Bình minh: {dailyForecast.sunrise[0].slice(11, 16)}
                </span>
                <span className="text-indigo-600 dark:text-indigo-400">
                  Hoàng hôn: {dailyForecast.sunset[0].slice(11, 16)}
                </span>
              </div>
            </div>
          )}

          {/* 7-Day Daily Forecast Section */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-500" />
                <span>Dự báo thời tiết 7 ngày tới (Open-Meteo)</span>
              </h3>
              <button
                type="button"
                onClick={() => setActiveTab('radar')}
                className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
              >
                Mở bản đồ Radar Windy tại đây →
              </button>
            </div>

            {dailyForecast && dailyForecast.time ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                {dailyForecast.time.map((dateStr, idx) => {
                  const maxT = dailyForecast.temperature_2m_max[idx];
                  const minT = dailyForecast.temperature_2m_min[idx];
                  const code = dailyForecast.weather_code[idx];
                  const dObj = new Date(dateStr);
                  const label = idx === 0 ? 'Hôm nay' : `Thứ ${dObj.getDay() === 0 ? 'CN' : dObj.getDay() + 1}`;

                  return (
                    <div
                      key={dateStr}
                      className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex flex-col items-center justify-between text-center gap-2"
                    >
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{label}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">{dateStr.slice(5)}</div>
                      <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 my-1">
                        <Sun className="w-5 h-5" />
                      </div>
                      <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {getWeatherDescription(code).split('(')[0]}
                      </div>
                      <div className="flex items-center gap-2 text-xs font-extrabold tabular-nums">
                        <span className="text-rose-600 dark:text-rose-400">{maxT}°</span>
                        <span className="text-slate-400">/</span>
                        <span className="text-sky-600 dark:text-sky-400">{minT}°</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-slate-500 py-6 text-center">Đang tải biểu đồ dự báo 7 ngày...</div>
            )}
          </div>
        </div>
      ) : (
        /* Windy Interactive Radar Map View */
        <div className="flex-1 min-h-0 flex flex-col bg-slate-100 dark:bg-slate-950">
          {/* Interactive Windy Layer & Model Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-white/95 dark:bg-slate-900/95 border-b border-slate-200/80 dark:border-slate-800 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 font-bold text-slate-600 dark:text-slate-300 mr-1">
                <Layers className="w-3.5 h-3.5 text-sky-500" />
                Lớp bản đồ:
              </span>
              {WINDY_OVERLAYS.map((ov) => (
                <button
                  key={ov.id}
                  type="button"
                  data-testid={`windy-overlay-${ov.id}`}
                  onClick={() => setWindyOverlay(ov.id)}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-colors ${
                    windyOverlay === ov.id
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {ov.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Mô hình dự báo Windy"
                value={windyProduct}
                onChange={(e) => setWindyProduct(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 outline-none"
              >
                {WINDY_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>

              <select
                aria-label="Độ cao khí quyển Windy"
                value={windyLevel}
                onChange={(e) => setWindyLevel(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 outline-none"
              >
                {WINDY_LEVELS.map((lv) => (
                  <option key={lv.id} value={lv.id}>
                    {lv.label}
                  </option>
                ))}
              </select>

              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                Tâm: {selectedLocation.name}
              </span>
            </div>
          </div>

          <div className="relative flex-1 min-h-0 w-full">
            <iframe
              key={embedUrl}
              data-testid="weather-modal-iframe"
              src={embedUrl}
              title={`Bản đồ Radar Windy - ${selectedLocation.name}`}
              className="w-full h-full border-0"
              loading="eager"
              referrerPolicy="no-referrer-when-downgrade"
              allow="geolocation"
            />
          </div>
        </div>
      )}
    </div>
  );
};
