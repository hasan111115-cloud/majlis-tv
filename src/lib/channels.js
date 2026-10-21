import { useEffect, useMemo, useState } from 'react';

/* نسخة احتياطية مطابقة لـ public/channels.json — تُستخدم فقط إذا تعذّر تحميل الملف.
   لتحديث الروابط عدّل public/channels.json (أو channels.json في مجلد النشر) دون إعادة البناء. */
export const BUILTIN = [
  {
    id: 'sunnah', name: 'قناة السنة النبوية', short: 'السنة', tone: '#b89a5e', logo: '',
    officialUrl: 'https://www.sba.sa/',
    sources: [
      { label: 'هيئة الإذاعة والتلفزيون — 720p', url: 'http://m.live.net.sa:1935/live/sunnah/playlist.m3u8' },
      { label: 'Globecast — 360p', url: 'https://cdn-globecast.akamaized.net/live/eds/saudi_sunnah/hls_roku/index.m3u8' },
    ],
  },
  {
    id: 'quran', name: 'قناة القرآن الكريم', short: 'القرآن', tone: '#6f9a86', logo: '',
    officialUrl: 'https://www.sba.sa/',
    sources: [
      { label: 'هيئة الإذاعة والتلفزيون — 720p', url: 'http://m.live.net.sa:1935/live/quran/playlist.m3u8' },
      { label: 'Globecast — 360p', url: 'https://cdn-globecast.akamaized.net/live/eds/saudi_quran/hls_roku/index.m3u8' },
    ],
  },
  {
    id: 'alarabiya', name: 'قناة العربية', short: 'العربية', tone: '#c9824a', logo: '',
    officialUrl: 'https://www.alarabiya.net/live-stream',
    sources: [{ label: 'البث الرسمي — 1080p', url: 'https://live.alarabiya.net/alarabiapublish/alarabiya.smil/playlist.m3u8' }],
  },
  {
    id: 'aljazeera', name: 'قناة الجزيرة', short: 'الجزيرة', tone: '#c8a24a', logo: '',
    officialUrl: 'https://www.aljazeera.net/live',
    sources: [
      { label: 'البث الرسمي — 1080p', url: 'https://live-hls-apps-aja-fa.getaj.net/AJA/index.m3u8' },
      { label: 'البث الرسمي — خادم بديل', url: 'https://live-hls-v3-aja.getaj.net/AJA-V3/index.m3u8' },
    ],
  },
];

function clean(c) {
  if (!c || typeof c.id !== 'string' || typeof c.name !== 'string') return null;
  const sources = (c.sources || []).filter((s) => s && /^https?:\/\//i.test(s.url || ''));
  return {
    id: c.id,
    name: c.name.slice(0, 60),
    short: (c.short || c.name).slice(0, 10),
    tone: /^#[0-9a-f]{3,8}$/i.test(c.tone || '') ? c.tone : '#9a9aa6',
    logo: /^https?:\/\//i.test(c.logo || '') ? c.logo : '',
    officialUrl: /^https?:\/\//i.test(c.officialUrl || '') ? c.officialUrl : '',
    sources,
    custom: !!c.custom,
  };
}

export function useChannels(custom) {
  const [base, setBase] = useState(BUILTIN.map(clean));
  useEffect(() => {
    let alive = true;
    fetch('./channels.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => {
        const list = (j.channels || []).map(clean).filter(Boolean);
        if (alive && list.length) setBase(list);
      })
      .catch(() => { /* نبقي القائمة المضمّنة */ });
    return () => { alive = false; };
  }, []);
  return useMemo(() => {
    const extra = (custom || []).map((c) => clean({ ...c, custom: true })).filter(Boolean);
    const ids = new Set(base.map((c) => c.id));
    return [...base, ...extra.filter((c) => !ids.has(c.id))];
  }, [base, custom]);
}
