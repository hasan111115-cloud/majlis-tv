import { useEffect, useMemo, useState } from 'react';

/* نسخة احتياطية مطابقة لـ public/channels.json — تُستخدم فقط إذا تعذّر تحميل الملف.
   لتحديث الروابط الأساسية عدّل public/channels.json (أو channels.json في مجلد النشر). */
export const BUILTIN = [
  {
    id: 'sunnah', name: 'قناة السنة النبوية', short: 'السنة', tone: '#b89a5e', logo: '',
    officialUrl: 'https://www.sba.sa/',
    sources: [
      { label: 'يوتيوب — البث الرسمي المباشر (HD)', url: 'https://www.youtube.com/live/Rs7St51oDDc' },
      { label: 'هيئة الإذاعة والتلفزيون — 720p', url: 'http://m.live.net.sa:1935/live/sunnah/playlist.m3u8' },
      { label: 'Globecast — 360p', url: 'https://cdn-globecast.akamaized.net/live/eds/saudi_sunnah/hls_roku/index.m3u8' },
      { label: 'Globecast — خادم بديل', url: 'https://cdnamd-hls-globecast.akamaized.net/live/ramdisk/saudi_sunnah/hls1/saudi_sunnah.m3u8' },
    ],
  },
  {
    id: 'quran', name: 'قناة القرآن الكريم', short: 'القرآن', tone: '#6f9a86', logo: '',
    officialUrl: 'https://www.sba.sa/',
    sources: [
      { label: 'شاهد — HD', url: 'https://al-ekhbaria-prod-dub.shahid.net/out/v1/9885cab0a3ec4008b53bae57a27ca76b/index.m3u8' },
      { label: 'هيئة الإذاعة والتلفزيون — 720p', url: 'http://m.live.net.sa:1935/live/quran/playlist.m3u8' },
      { label: 'Globecast — 360p', url: 'https://cdn-globecast.akamaized.net/live/eds/saudi_quran/hls_roku/index.m3u8' },
    ],
  },
  {
    id: 'nidaa', name: 'إذاعة نداء الإسلام', short: 'نداء', tone: '#7f8fb5', logo: '', radio: true,
    officialUrl: 'https://www.sba.sa/',
    sources: [{ label: 'هيئة الإذاعة والتلفزيون — بث صوتي', url: 'https://live.kwikmotion.com/sbrksanedaradiolive/srpksanedaradio/playlist.m3u8' }],
  },
];

/* ---------- تحليل الروابط ---------- */
const YT_HOST = /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/i;

/**
 * يحدد نوع الرابط:
 *  { kind: 'youtube', embed }  فيديو أو بث يوتيوب
 *  { kind: 'hls' }             رابط m3u8
 *  { kind: 'file' }            ملف فيديو مباشر (mp4/webm)
 *  { kind: 'page', reason }    صفحة ويب وليست رابط بث
 *  { kind: 'invalid', reason }
 */
export function analyzeUrl(raw) {
  let u;
  try {
    u = new URL(String(raw).trim());
  } catch {
    return { kind: 'invalid', reason: 'الرابط غير صحيح. انسخه كاملًا بدءًا من https://' };
  }
  if (!/^https?:$/.test(u.protocol)) return { kind: 'invalid', reason: 'الرابط يجب أن يبدأ بـ https://' };

  if (YT_HOST.test(u.hostname)) {
    const base = 'https://www.youtube.com/embed/';
    const params = 'enablejsapi=1&autoplay=1&mute=1&playsinline=1&controls=0&rel=0&iv_load_policy=3&disablekb=1';
    let id = null;
    if (/youtu\.be$/i.test(u.hostname)) id = u.pathname.slice(1).split('/')[0];
    else if (u.searchParams.get('v')) id = u.searchParams.get('v');
    else {
      const m = u.pathname.match(/^\/(?:live|embed|shorts|v)\/([\w-]{6,})/);
      if (m && m[1] !== 'live_stream') id = m[1];
    }
    if (id && /^[\w-]{6,}$/.test(id)) return { kind: 'youtube', embed: `${base}${id}?${params}` };
    const ch = u.pathname.match(/^\/channel\/(UC[\w-]{20,})/) || [null, u.searchParams.get('channel')];
    if (ch[1] && /^UC[\w-]{20,}$/.test(ch[1])) return { kind: 'youtube', embed: `${base}live_stream?channel=${ch[1]}&${params}` };
    if (/^\/@/.test(u.pathname) || /^\/(c|user)\//.test(u.pathname)) {
      return {
        kind: 'invalid',
        reason: 'رابط اسم القناة (@…) لا يكفي. افتح البث المباشر في يوتيوب وانسخ رابط الفيديو نفسه (يحتوي watch?v= أو /live/).',
      };
    }
    return { kind: 'invalid', reason: 'لم أتعرّف على رابط يوتيوب هذا. انسخ رابط البث المباشر نفسه.' };
  }

  const path = u.pathname.toLowerCase();
  if (path.endsWith('.m3u8') || path.includes('.m3u8') || /\/(playlist|index|master|chunks)\b/.test(path) || u.searchParams.get('format') === 'm3u8') {
    return { kind: 'hls' };
  }
  if (/\.(mp4|webm|mov|m4v)$/.test(path)) return { kind: 'file' };
  if (/\.(mpd)$/.test(path)) return { kind: 'invalid', reason: 'صيغة DASH ‏(mpd) غير مدعومة. استخدم رابط m3u8 أو يوتيوب.' };
  if (/\.(ts)$/.test(path)) return { kind: 'invalid', reason: 'هذا رابط مقطع واحد (ts)، وليس رابط البث. ابحث عن رابط ينتهي بـ m3u8.' };
  return {
    kind: 'page',
    reason: 'هذا يبدو رابط صفحة موقع وليس رابط بث. المطلوب رابط ينتهي بـ m3u8، أو رابط بث يوتيوب.',
  };
}

/* ---------- التنظيف ---------- */
export function clean(c) {
  if (!c || typeof c.id !== 'string' || typeof c.name !== 'string') return null;
  const sources = (c.sources || [])
    .filter((s) => s && /^https?:\/\//i.test(s.url || ''))
    .map((s) => ({ label: String(s.label || '').slice(0, 60), url: s.url.trim() }));
  return {
    id: c.id,
    name: c.name.slice(0, 60),
    short: (c.short || c.name.replace(/^قناة\s+/, '')).slice(0, 10),
    tone: /^#[0-9a-f]{3,8}$/i.test(c.tone || '') ? c.tone : '#9a9aa6',
    logo: /^https?:\/\//i.test(c.logo || '') ? c.logo : '',
    officialUrl: /^https?:\/\//i.test(c.officialUrl || '') ? c.officialUrl : '',
    radio: !!c.radio,
    sources,
  };
}

/**
 * القائمة المعروضة:
 * - إن عدّل المستخدم القنوات (حذف/إضافة/تعديل/ترتيب) تُحفظ قائمته كاملة في channelList.
 * - وإلا نعرض القنوات الأساسية من channels.json.
 */
export function useChannels(settings) {
  const [base, setBase] = useState(() => BUILTIN.map(clean));
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

  const { channelList, customChannels } = settings;
  const channels = useMemo(() => {
    if (Array.isArray(channelList)) return channelList.map(clean).filter(Boolean);
    const extra = (customChannels || []).map(clean).filter(Boolean);
    const ids = new Set(base.map((c) => c.id));
    return [...base, ...extra.filter((c) => !ids.has(c.id))];
  }, [base, channelList, customChannels]);

  return { channels, base };
}
