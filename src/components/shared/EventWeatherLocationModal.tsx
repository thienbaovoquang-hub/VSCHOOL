import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CloudSun,
  Compass,
  Layers,
  MapPin,
  Search,
  Thermometer,
  Wind,
} from '../icons/UiIcons';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import type { SchoolEvent } from '../../types';
import {
  evaluateEventWeatherRisk,
  type NominatimPlace,
} from '../../utils/externalIntegrations';
import {
  DEFAULT_WEATHER_URL,
  isSafeWeatherUrl,
  resolveWeatherEmbedUrl,
} from '../../utils/weatherConfig';

interface EventWeatherLocationModalProps {
  isOpen: boolean;
  event: SchoolEvent | null;
  weatherUrl?: string;
  onClose: () => void;
}

interface ResolvedCoords {
  name: string;
  displayName?: string;
  lat: number;
  lon: number;
}

interface DailyMeteoData {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  precipitation_probability_max: number[];
  wind_speed_10m_max: number[];
  weather_code: number[];
  sunrise?: string[];
  sunset?: string[];
}

const DEFAULT_SCHOOL_COORDS: ResolvedCoords = {
  name: 'Cơ sở chính (Yên Thành, Nghệ An)',
  displayName: 'Yên Thành, Nghệ An, Việt Nam',
  lat: 19.0003,
  lon: 105.4726,
};

const QUICK_LOCATIONS: ResolvedCoords[] = [
  DEFAULT_SCHOOL_COORDS,
  { name: 'Hà Nội', displayName: 'Hà Nội, Việt Nam', lat: 21.0285, lon: 105.8542 },
  { name: 'Đà Nẵng', displayName: 'Đà Nẵng, Việt Nam', lat: 16.0544, lon: 108.2022 },
  { name: 'TP. Hồ Chí Minh', displayName: 'TP. Hồ Chí Minh, Việt Nam', lat: 10.8231, lon: 106.6297 },
];

const WINDY_LAYERS = [
  { id: 'wind', label: 'Gió' },
  { id: 'rain', label: 'Mưa' },
  { id: 'temp', label: 'Nhiệt độ' },
  { id: 'thunder', label: 'Dông sét' },
];

export const EventWeatherLocationModal: React.FC<EventWeatherLocationModalProps> = ({
  isOpen,
  event,
  weatherUrl,
  onClose,
}) => {
  const [coords, setCoords] = useState<ResolvedCoords>(DEFAULT_SCHOOL_COORDS);
  const [searchQuery, setSearchQuery] = useState('');
  const [geoPlaces, setGeoPlaces] = useState<NominatimPlace[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoNote, setGeoNote] = useState<string>('');

  const [daily, setDaily] = useState<DailyMeteoData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [overlay, setOverlay] = useState<'wind' | 'rain' | 'temp' | 'thunder'>('rain');

  const safeWeatherBase =
    weatherUrl && isSafeWeatherUrl(weatherUrl) ? weatherUrl : DEFAULT_WEATHER_URL;

  const windyEmbedUrl = useMemo(
    () =>
      resolveWeatherEmbedUrl(safeWeatherBase, {
        lat: coords.lat,
        lon: coords.lon,
        zoom: 9,
        overlay,
        product: 'ecmwf',
        level: 'surface',
      }),
    [safeWeatherBase, coords.lat, coords.lon, overlay]
  );

  const runNominatimSearch = async (query: string, autoPickFirst: boolean) => {
    const clean = query.trim();
    if (!clean) return;
    setGeoLoading(true);
    setGeoNote('');
    try {
      const res = await fetch(`/api/external/nominatim?q=${encodeURIComponent(clean)}&limit=5`);
      const data = (await res.json()) as { results?: NominatimPlace[]; error?: string };
      const list = Array.isArray(data.results) ? data.results : [];
      setGeoPlaces(list);
      if (list.length > 0 && autoPickFirst) {
        const first = list[0];
        setCoords({
          name: first.name,
          displayName: first.displayName,
          lat: first.lat,
          lon: first.lon,
        });
        setGeoNote(`Đã định vị tự động "${clean}" qua OpenStreetMap Nominatim.`);
      } else if (list.length === 0 && autoPickFirst) {
        setCoords(DEFAULT_SCHOOL_COORDS);
        setGeoNote(
          `Địa điểm nội bộ "${clean}" không có tọa độ riêng trên OSM — đang dùng tọa độ cơ sở chính (có thể tìm địa danh khác bên dưới).`
        );
      } else if (list.length === 0) {
        setGeoNote(`Không tìm thấy địa danh khớp "${clean}" trên OpenStreetMap.`);
      }
    } catch {
      setGeoNote('Không thể kết nối Nominatim; đang dùng tọa độ mặc định của trường.');
    } finally {
      setGeoLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !event) return;
    const loc = (event.location || '').trim();
    setSearchQuery(loc);
    setGeoPlaces([]);
    if (loc && !/^(phòng|hội trường|sân trường|lớp|nhà đa năng)/i.test(loc)) {
      void runNominatimSearch(loc, true);
    } else {
      setCoords(DEFAULT_SCHOOL_COORDS);
      setGeoNote(
        loc
          ? `Địa điểm khuôn viên "${loc}" — dùng tọa độ cơ sở chính (bạn có thể tìm khu vực cụ thể qua OSM).`
          : 'Đang hiển thị thời tiết tại cơ sở chính.'
      );
    }
  }, [isOpen, event?.id]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const loadForecast = async () => {
      setWeatherLoading(true);
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code,sunrise,sunset&forecast_days=14&timezone=auto`;
        const res = await fetch(url);
        if (res.ok && active) {
          const json = await res.json();
          if (json.daily) setDaily(json.daily as DailyMeteoData);
        }
      } catch {
        // ignore network issues
      } finally {
        if (active) setWeatherLoading(false);
      }
    };
    void loadForecast();
    return () => {
      active = false;
    };
  }, [isOpen, coords.lat, coords.lon]);

  const targetForecast = useMemo(() => {
    if (!daily || !daily.time?.length) return null;
    const targetDate = event?.date || daily.time[0];
    const exactIdx = daily.time.indexOf(targetDate);
    const idx = exactIdx >= 0 ? exactIdx : 0;
    const maxTemp = daily.temperature_2m_max[idx];
    const minTemp = daily.temperature_2m_min[idx];
    const rainSum = daily.precipitation_sum[idx] ?? 0;
    const rainProb = daily.precipitation_probability_max?.[idx] ?? 0;
    const windMax = daily.wind_speed_10m_max[idx] ?? 0;
    const weatherCode = daily.weather_code[idx] ?? 0;
    const sunrise = daily.sunrise?.[idx] ? daily.sunrise[idx].slice(11, 16) : undefined;
    const sunset = daily.sunset?.[idx] ? daily.sunset[idx].slice(11, 16) : undefined;
    const risk = evaluateEventWeatherRisk({
      precipitationProbabilityMax: rainProb,
      precipitationSum: rainSum,
      windSpeedMax: windMax,
      tempMax: maxTemp,
      weatherCode,
    });
    return {
      isExactDate: exactIdx >= 0,
      date: daily.time[idx],
      maxTemp,
      minTemp,
      rainSum,
      rainProb,
      windMax,
      weatherCode,
      sunrise,
      sunset,
      risk,
    };
  }, [daily, event?.date]);

  if (!event) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Thời tiết & Radar sự kiện: ${event.title}`}
      description={`${event.date} · ${event.time} · Địa điểm: ${event.location || 'Chưa ghi rõ'}`}
      maxWidth="4xl"
    >
      <div className="space-y-4" data-testid="event-weather-modal">
        {/* Nominatim Location Resolver Bar */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <MapPin className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                  {coords.name}
                </p>
                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                  {coords.lat.toFixed(4)}, {coords.lon.toFixed(4)}
                  {coords.displayName ? ` · ${coords.displayName}` : ''}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {QUICK_LOCATIONS.map((loc) => (
                <button
                  key={loc.name}
                  type="button"
                  onClick={() => {
                    setCoords(loc);
                    setGeoPlaces([]);
                    setGeoNote('');
                  }}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                    coords.lat === loc.lat && coords.lon === loc.lon
                      ? 'bg-sky-600 text-white'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {loc.name.split('(')[0].trim()}
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runNominatimSearch(searchQuery, false);
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                data-testid="event-weather-nominatim-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm địa điểm tổ chức sự kiện qua OpenStreetMap Nominatim..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <button
              type="submit"
              disabled={geoLoading}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Compass className="w-3.5 h-3.5" />
              {geoLoading ? 'Đang định vị...' : 'Định vị OSM'}
            </button>
          </form>

          {geoNote && (
            <p className="text-[11px] text-slate-600 dark:text-slate-300">{geoNote}</p>
          )}

          {geoPlaces.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {geoPlaces.map((pl) => (
                <button
                  key={pl.placeId}
                  type="button"
                  onClick={() =>
                    setCoords({
                      name: pl.name,
                      displayName: pl.displayName,
                      lat: pl.lat,
                      lon: pl.lon,
                    })
                  }
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-sky-400 text-[11px] text-left cursor-pointer transition-colors"
                >
                  <span className="font-bold text-slate-800 dark:text-slate-100">{pl.name}</span>{' '}
                  <span className="text-slate-500 dark:text-slate-400">
                    ({pl.lat.toFixed(2)}, {pl.lon.toFixed(2)})
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Outdoor Event Risk Assessment + Open-Meteo Metrics */}
        {weatherLoading ? (
          <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-center text-xs text-slate-500">
            Đang phân tích dữ liệu thời tiết Open-Meteo cho ngày {event.date}...
          </div>
        ) : targetForecast ? (
          <div
            data-testid="event-weather-risk-card"
            className={`p-4 rounded-2xl border space-y-3 ${
              targetForecast.risk.level === 'warning'
                ? 'bg-rose-50/90 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
                : targetForecast.risk.level === 'caution'
                ? 'bg-amber-50/90 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                : 'bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {targetForecast.risk.level === 'safe' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle
                    className={`w-5 h-5 ${
                      targetForecast.risk.level === 'warning'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  />
                )}
                <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  {targetForecast.risk.badgeLabel}
                </span>
              </div>
              <Badge
                variant={
                  targetForecast.risk.level === 'warning'
                    ? 'pink'
                    : targetForecast.risk.level === 'caution'
                    ? 'amber'
                    : 'mint'
                }
                size="sm"
              >
                {targetForecast.isExactDate
                  ? `Đúng ngày sự kiện (${targetForecast.date})`
                  : `Dự báo gần nhất (${targetForecast.date})`}
              </Badge>
            </div>

            <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
              {targetForecast.risk.summary}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-700/70">
                <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Thermometer className="w-3 h-3 text-rose-500" /> Nhiệt độ ngày
                </div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                  {targetForecast.minTemp}° – {targetForecast.maxTemp}°C
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-700/70">
                <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <CloudSun className="w-3 h-3 text-sky-500" /> Xác suất mưa
                </div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                  {targetForecast.rainProb}% ({targetForecast.rainSum} mm)
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-700/70">
                <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Wind className="w-3 h-3 text-amber-500" /> Gió cực đại
                </div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                  {targetForecast.windMax} km/h
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-700/70">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  Bình minh / Hoàng hôn
                </div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                  {targetForecast.sunrise || '--'} / {targetForecast.sunset || '--'}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Embedded Windy Radar at Event Coordinates */}
        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-xs">
            <span className="inline-flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
              <Layers className="w-3.5 h-3.5 text-sky-500" />
              Windy Radar trực quan tại điểm sự kiện
            </span>
            <div className="flex items-center gap-1">
              {WINDY_LAYERS.map((layer) => (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => setOverlay(layer.id as typeof overlay)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                    overlay === layer.id
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {layer.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[340px] w-full">
            <iframe
              key={windyEmbedUrl}
              data-testid="event-weather-windy-iframe"
              src={windyEmbedUrl}
              title={`Windy Radar - ${event.title}`}
              className="w-full h-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};
