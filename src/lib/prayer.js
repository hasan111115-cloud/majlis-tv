import { Coordinates, CalculationMethod, PrayerTimes, Madhab, HighLatitudeRule } from 'adhan';
import { zonedParts, hijriMonth } from './time.js';

/* المواقيت تُحسب فلكيًا على الجهاز بمكتبة adhan المعتمدة —
   لا تحتاج اتصالًا بالإنترنت ولا مفتاح API، وتبقى دقيقة في التشغيل الطويل. */

export const METHODS = [
  { id: 'UmmAlQura', name: 'أم القرى — السعودية' },
  { id: 'MuslimWorldLeague', name: 'رابطة العالم الإسلامي' },
  { id: 'Egyptian', name: 'الهيئة المصرية العامة للمساحة' },
  { id: 'Dubai', name: 'دبي' },
  { id: 'Kuwait', name: 'الكويت' },
  { id: 'Qatar', name: 'قطر' },
  { id: 'Karachi', name: 'جامعة العلوم الإسلامية — كراتشي' },
  { id: 'Turkey', name: 'رئاسة الشؤون الدينية — تركيا' },
  { id: 'Singapore', name: 'سنغافورة' },
  { id: 'NorthAmerica', name: 'أمريكا الشمالية (ISNA)' },
  { id: 'MoonsightingCommittee', name: 'لجنة رؤية الهلال' },
];

export const PRAYERS = [
  { key: 'fajr', name: 'الفجر' },
  { key: 'sunrise', name: 'الشروق' },
  { key: 'dhuhr', name: 'الظهر' },
  { key: 'asr', name: 'العصر' },
  { key: 'maghrib', name: 'المغرب' },
  { key: 'isha', name: 'العشاء' },
];

function params(methodId, madhab, lat) {
  const fn = CalculationMethod[methodId] || CalculationMethod.UmmAlQura;
  const p = fn();
  p.madhab = madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  if (Math.abs(lat) > 48) p.highLatitudeRule = HighLatitudeRule.recommended(new Coordinates(lat, 0));
  return p;
}

/** مواقيت يوم محدد (y,m,d بتوقيت المدينة) */
export function dayTimes(city, y, m, d, settings) {
  const coords = new Coordinates(city.lat, city.lon);
  const date = new Date(y, m - 1, d, 12);
  const pt = new PrayerTimes(coords, date, params(settings.method, settings.madhab, city.lat));
  const list = PRAYERS.map((p) => ({ ...p, time: pt[p.key] }));
  // تقويم أم القرى: العشاء بعد المغرب بساعتين في رمضان بدل ساعة ونصف
  if ((settings.method || 'UmmAlQura') === 'UmmAlQura' && hijriMonth(list[2].time, city.tz, settings.hijriOffset) === 9) {
    const isha = list[5];
    isha.time = new Date(isha.time.getTime() + 30 * 60000);
  }
  return list;
}

function addDays(y, m, d, n) {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
}

/**
 * الحالة الكاملة لشريط الصلاة:
 * - list: المواقيت المعروضة (اليوم، أو الغد بعد دخول العشاء)
 * - next: الحدث القادم (صلاة أو شروق) ووقته
 * - current: صلاة دخل وقتها خلال آخر ٣٠ دقيقة
 */
export function prayerState(city, nowMs, settings) {
  const p = zonedParts(new Date(nowMs), city.tz);
  const today = dayTimes(city, p.year, p.month, p.day, settings);
  const [ty, tm, td] = addDays(p.year, p.month, p.day, 1);
  const tomorrow = dayTimes(city, ty, tm, td, settings);
  const nextToday = today.find((x) => x.time.getTime() > nowMs);
  const showTomorrow = !nextToday;
  const next = nextToday || tomorrow[0];
  const list = showTomorrow ? tomorrow : today;
  let current = null;
  for (const x of today) {
    if (x.key === 'sunrise') continue;
    const dt = nowMs - x.time.getTime();
    if (dt >= 0 && dt < 30 * 60000) current = x;
  }
  return { list, next, current, showTomorrow };
}
