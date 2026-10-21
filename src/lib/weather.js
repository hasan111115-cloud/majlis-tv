import { useEffect, useRef, useState, useCallback } from 'react';

/* الطقس من Open-Meteo: خدمة مفتوحة مجانية بلا مفتاح API، تسمح بالطلب المباشر من المتصفح.
   الاستخدام مجاني لغير التجاري حتى ١٠٬٠٠٠ طلب يوميًا؛ نحدّث كل ١٥ دقيقة فقط (~١٠٠ طلب يوميًا). */

const REFRESH_MS = 15 * 60 * 1000;
const CACHE_KEY = 'majlis.weather.v1';

export const WMO = {
  0: { day: 'صافٍ ومشمس', night: 'صافٍ', icon: 'clear', mood: 'clear' },
  1: { day: 'مشمس غالبًا', night: 'صافٍ غالبًا', icon: 'clear', mood: 'clear' },
  2: { day: 'غائم جزئيًا', icon: 'partly', mood: 'cloudy' },
  3: { day: 'غائم', icon: 'cloud', mood: 'cloudy' },
  45: { day: 'ضباب', icon: 'fog', mood: 'cloudy' },
  48: { day: 'ضباب متجمد', icon: 'fog', mood: 'cloudy' },
  51: { day: 'رذاذ خفيف', icon: 'drizzle', mood: 'rain' },
  53: { day: 'رذاذ', icon: 'drizzle', mood: 'rain' },
  55: { day: 'رذاذ كثيف', icon: 'drizzle', mood: 'rain' },
  56: { day: 'رذاذ متجمد', icon: 'drizzle', mood: 'rain' },
  57: { day: 'رذاذ متجمد كثيف', icon: 'drizzle', mood: 'rain' },
  61: { day: 'مطر خفيف', icon: 'rain', mood: 'rain' },
  63: { day: 'مطر', icon: 'rain', mood: 'rain' },
  65: { day: 'مطر غزير', icon: 'rain', mood: 'rain' },
  66: { day: 'مطر متجمد', icon: 'rain', mood: 'rain' },
  67: { day: 'مطر متجمد غزير', icon: 'rain', mood: 'rain' },
  71: { day: 'ثلج خفيف', icon: 'snow', mood: 'cloudy' },
  73: { day: 'ثلج', icon: 'snow', mood: 'cloudy' },
  75: { day: 'ثلج كثيف', icon: 'snow', mood: 'cloudy' },
  77: { day: 'حبيبات ثلجية', icon: 'snow', mood: 'cloudy' },
  80: { day: 'زخات مطر خفيفة', icon: 'rain', mood: 'rain' },
  81: { day: 'زخات مطر', icon: 'rain', mood: 'rain' },
  82: { day: 'زخات مطر غزيرة', icon: 'rain', mood: 'rain' },
  85: { day: 'زخات ثلج', icon: 'snow', mood: 'cloudy' },
  86: { day: 'زخات ثلج كثيفة', icon: 'snow', mood: 'cloudy' },
  95: { day: 'عاصفة رعدية', icon: 'storm', mood: 'rain' },
  96: { day: 'عاصفة رعدية مع برد', icon: 'storm', mood: 'rain' },
  99: { day: 'عاصفة رعدية مع برد كثيف', icon: 'storm', mood: 'rain' },
};

export function describe(code, isDay = true) {
  const w = WMO[code] || { day: 'غير معروف', icon: 'cloud', mood: 'cloudy' };
  return { label: (!isDay && w.night) || w.day, icon: w.icon, mood: isDay ? w.mood : 'night', isDay };
}

const DIRS = ['شمالية', 'شمالية شرقية', 'شرقية', 'جنوبية شرقية', 'جنوبية', 'جنوبية غربية', 'غربية', 'شمالية غربية'];
export function windDir(deg) {
  if (deg == null || Number.isNaN(deg)) return null;
  return DIRS[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

async function fetchJSON(url, ms = 12000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

export async function fetchWeather(lat, lon) {
  const u = new URL('https://api.open-meteo.com/v1/forecast');
  u.search = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,is_day,precipitation',
    hourly: 'temperature_2m,weather_code,precipitation_probability,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
    timezone: 'auto',
    timeformat: 'unixtime',
    forecast_days: '7',
    wind_speed_unit: 'kmh',
  }).toString();
  const j = await fetchJSON(u.toString());
  const nowS = Date.now() / 1000;
  const hourly = [];
  for (let i = 0; i < j.hourly.time.length && hourly.length < 24; i++) {
    if (j.hourly.time[i] + 3600 <= nowS) continue;
    hourly.push({
      t: j.hourly.time[i] * 1000,
      temp: j.hourly.temperature_2m[i],
      code: j.hourly.weather_code[i],
      pop: j.hourly.precipitation_probability?.[i] ?? null,
      isDay: j.hourly.is_day?.[i] === 1,
    });
  }
  const daily = j.daily.time.map((t, i) => ({
    t: t * 1000,
    code: j.daily.weather_code[i],
    max: j.daily.temperature_2m_max[i],
    min: j.daily.temperature_2m_min[i],
    pop: j.daily.precipitation_probability_max?.[i] ?? null,
    sunrise: j.daily.sunrise?.[i] ? j.daily.sunrise[i] * 1000 : null,
    sunset: j.daily.sunset?.[i] ? j.daily.sunset[i] * 1000 : null,
  }));
  const c = j.current;
  return {
    lat, lon,
    tz: j.timezone,
    fetchedAt: Date.now(),
    observedAt: c.time * 1000,
    current: {
      temp: c.temperature_2m,
      feels: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      code: c.weather_code,
      wind: c.wind_speed_10m,
      windDeg: c.wind_direction_10m,
      isDay: c.is_day === 1,
      precip: c.precipitation,
    },
    hourly,
    daily,
  };
}

function readCache(lat, lon) {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (c && Math.abs(c.lat - lat) < 0.01 && Math.abs(c.lon - lon) < 0.01) return c;
  } catch { /* لا شيء */ }
  return null;
}
function writeCache(d) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch { /* لا شيء */ }
}

/**
 * status: loading | ok | stale (بيانات محفوظة بسبب خطأ) | error
 */
export function useWeather(city) {
  const [st, setSt] = useState(() => {
    const c = readCache(city.lat, city.lon);
    if (c && Date.now() - c.fetchedAt < REFRESH_MS) return { status: 'ok', data: c, error: null };
    return { status: c ? 'stale' : 'loading', data: c, error: null };
  });
  const reqId = useRef(0);
  const lastOk = useRef(st.data?.fetchedAt || 0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setSt((s) => (s.data ? s : { status: 'loading', data: null, error: null }));
    try {
      const d = await fetchWeather(city.lat, city.lon);
      if (id !== reqId.current) return;
      writeCache(d);
      lastOk.current = d.fetchedAt;
      setSt({ status: 'ok', data: d, error: null });
    } catch (e) {
      if (id !== reqId.current) return;
      const msg = navigator.onLine === false ? 'لا يوجد اتصال بالإنترنت' : 'تعذّر الوصول إلى خدمة الطقس';
      setSt((s) => ({ status: s.data ? 'stale' : 'error', data: s.data, error: msg }));
    }
  }, [city.lat, city.lon]);

  useEffect(() => {
    const c = readCache(city.lat, city.lon);
    lastOk.current = c?.fetchedAt || 0;
    if (c) setSt({ status: Date.now() - c.fetchedAt < REFRESH_MS ? 'ok' : 'stale', data: c, error: null });
    else setSt({ status: 'loading', data: null, error: null });
    if (!c || Date.now() - c.fetchedAt >= REFRESH_MS) load();

    let timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, REFRESH_MS);
    const onOnline = () => load();
    const onVis = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastOk.current > REFRESH_MS) load();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(timer);
      reqId.current++;
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [city.lat, city.lon, load]);

  return { ...st, retry: load };
}
