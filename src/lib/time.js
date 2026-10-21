import { useSyncExternalStore } from 'react';

/* ساعة مشتركة واحدة لكل التطبيق: مؤقّت واحد يتزامن مع بداية كل ثانية
   بدل مؤقّت لكل مكوّن — أخف على المعالج وأثبت في التشغيل الطويل. */
let now = Date.now();
const subs = new Set();
let timer = null;

function tick() {
  now = Date.now();
  subs.forEach((f) => f());
  timer = setTimeout(tick, 1000 - (now % 1000) + 5);
}

function subscribe(f) {
  subs.add(f);
  if (!timer) {
    timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    document.addEventListener('visibilitychange', resync);
  }
  return () => {
    subs.delete(f);
    if (!subs.size) {
      clearTimeout(timer);
      timer = null;
      document.removeEventListener('visibilitychange', resync);
    }
  };
}

function resync() {
  if (document.visibilityState === 'visible') {
    clearTimeout(timer);
    tick();
  }
}

export function useNow() {
  return useSyncExternalStore(subscribe, () => now, () => now);
}

/* ---------- التنسيق ---------- */
const cache = new Map();
export function dtf(locale, opts) {
  const key = locale + JSON.stringify(opts);
  let f = cache.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(locale, opts);
    } catch {
      const { timeZone, ...rest } = opts;
      f = new Intl.DateTimeFormat(locale, rest);
    }
    cache.set(key, f);
  }
  return f;
}

export const loc = (digits, cal = 'gregory') => `ar-SA-u-ca-${cal}-nu-${digits === 'latn' ? 'latn' : 'arab'}`;

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export function digitsOf(str, digits) {
  const s = String(str);
  return digits === 'latn' ? s : s.replace(/[0-9]/g, (d) => AR_DIGITS[d]);
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

/** أجزاء التاريخ والوقت في منطقة زمنية محددة */
export function zonedParts(date, tz) {
  const parts = dtf('en-US-u-nu-latn', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const o = {};
  for (const p of parts) if (p.type !== 'literal') o[p.type] = Number(p.value);
  if (o.hour === 24) o.hour = 0;
  return o;
}

export function ymdKey(date, tz) {
  const p = zonedParts(date, tz);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** وقت مثل ٥:٣٨ م أو 17:38 */
export function formatTime(date, tz, { clock24, digits }) {
  const f = dtf(loc(digits), { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: !clock24 });
  return f.format(date);
}

export function formatClockParts(date, tz, { clock24, digits }) {
  const parts = dtf(loc(digits), {
    timeZone: tz, hour: clock24 ? '2-digit' : 'numeric', minute: '2-digit', second: '2-digit', hour12: !clock24,
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? '';
  return { hour: get('hour'), minute: get('minute'), second: get('second'), period: clock24 ? '' : get('dayPeriod') };
}

export function formatGregorian(date, tz, digits) {
  return {
    weekday: dtf(loc(digits), { timeZone: tz, weekday: 'long' }).format(date),
    date: dtf(loc(digits), { timeZone: tz, day: 'numeric', month: 'long', year: 'numeric' }).format(date),
  };
}

/** التاريخ الهجري بتقويم أم القرى، مع إمكانية تعديل يوم ± */
export function formatHijri(date, tz, digits, offsetDays = 0) {
  const d = new Date(date.getTime() + offsetDays * 86400000);
  try {
    return dtf(loc(digits, 'islamic-umalqura'), { timeZone: tz, day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  } catch {
    return '';
  }
}

export function hijriMonth(date, tz, offsetDays = 0) {
  const d = new Date(date.getTime() + offsetDays * 86400000);
  try {
    const m = dtf('en-US-u-ca-islamic-umalqura-nu-latn', { timeZone: tz, month: 'numeric' }).format(d);
    return parseInt(m, 10);
  } catch {
    return 0;
  }
}

export function formatCountdown(ms, digits) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return digitsOf(`${pad2(h)}:${pad2(m)}:${pad2(s)}`, digits);
}

export function relativeAgo(ms, digits) {
  const min = Math.round(ms / 60000);
  if (min < 1) return 'الآن';
  if (min < 60) return `قبل ${digitsOf(min, digits)} د`;
  const h = Math.round(min / 60);
  if (h < 24) return `قبل ${digitsOf(h, digits)} س`;
  return `قبل ${digitsOf(Math.round(h / 24), digits)} يوم`;
}
