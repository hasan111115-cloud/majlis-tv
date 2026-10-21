import { useSyncExternalStore } from 'react';

const KEY = 'majlis.settings.v1';

export const MADINAH = {
  id: 'madinah',
  name: 'المدينة المنورة',
  country: 'السعودية',
  lat: 24.4672,
  lon: 39.6111,
  tz: 'Asia/Riyadh',
  source: 'default',
};

export const DEFAULTS = {
  city: MADINAH,
  autoLocate: false,
  locPromptDone: false,
  defaultChannel: 'sunnah',
  startup: 'last', // 'last' | 'default'
  lastChannel: null,
  clock24: false,
  digits: 'arab', // 'arab' | 'latn'
  showHijri: true,
  hijriOffset: 0,
  method: 'UmmAlQura',
  madhab: 'shafi',
  volume: 0.8,
  muted: false, // تفضيل المستخدم للصوت؛ التشغيل التلقائي يبدأ دائمًا ويكتم مؤقتًا فقط إن منعه المتصفح
  ambient: true,
  showChannels: true,
  effects: true,
  theme: 'dark', // 'dark' | 'system'
  customChannels: [],
  channelList: null, // تُحفظ هنا قائمة القنوات كاملة بعد أول تعديل من المستخدم
  quality: 'auto', // 'auto' | 'max'
};

function safeRead() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    const merged = { ...DEFAULTS, ...parsed };
    if (!merged.city || typeof merged.city.lat !== 'number') merged.city = MADINAH;
    if (!Array.isArray(merged.customChannels)) merged.customChannels = [];
    if (merged.channelList != null && !Array.isArray(merged.channelList)) merged.channelList = null;
    // إزالة مصدر يوتيوب خاطئ أُضيف سابقًا لقناة السنة من القوائم المحفوظة
    if (Array.isArray(merged.channelList)) {
      merged.channelList = merged.channelList.map((c) => ({
        ...c,
        sources: (c.sources || []).filter((x) => !String(x.url || '').includes('UCROKYPep-UuODNwyipe6JMw')),
        officialUrl: String(c.officialUrl || '').includes('saudisunnahtv') ? 'https://www.sba.sa/' : c.officialUrl,
      }));
      // إضافة البث الرسمي الصحيح لقناة السنة في القوائم المحفوظة
      const yt = 'https://www.youtube.com/live/Rs7St51oDDc';
      merged.channelList = merged.channelList.map((c) =>
        c.id === 'sunnah' && !(c.sources || []).some((x) => x.url === yt)
          ? { ...c, sources: [{ label: 'يوتيوب — البث الرسمي المباشر (HD)', url: yt }, ...(c.sources || [])] }
          : c,
      );
    }
    return merged;
  } catch {
    return { ...DEFAULTS };
  }
}

let state = typeof window !== 'undefined' ? safeRead() : { ...DEFAULTS };
const listeners = new Set();

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* التخزين غير متاح (وضع خاص أو محظور) — تعمل الإعدادات لهذه الجلسة فقط */
  }
}

export function getSettings() {
  return state;
}

export function setSettings(patch) {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...next };
  persist();
  listeners.forEach((l) => l());
}

export function resetSettings() {
  state = { ...DEFAULTS };
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSettings() {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}

export function storageAvailable() {
  try {
    const k = '__majlis_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}
