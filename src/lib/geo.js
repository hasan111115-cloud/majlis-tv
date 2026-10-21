/* البحث عن المدن: Open-Meteo Geocoding (مجاني، بلا مفتاح، يدعم العربية ويعيد المنطقة الزمنية).
   تحويل الإحداثيات لاسم مدينة: BigDataCloud (واجهة مجانية مخصّصة للمتصفح، بلا مفتاح). */

async function getJSON(url, ms = 10000) {
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

export async function searchCities(q) {
  const query = q.trim().slice(0, 60);
  if (query.length < 2) return [];
  const u = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=ar&format=json`;
  const j = await getJSON(u);
  return (j.results || []).map((r) => ({
    id: String(r.id),
    name: r.name,
    region: r.admin1 || '',
    country: r.country || '',
    lat: r.latitude,
    lon: r.longitude,
    tz: r.timezone || 'UTC',
    source: 'search',
  }));
}

export function getPosition(timeout = 15000) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => reject(e),
      { enableHighAccuracy: false, timeout, maximumAge: 30 * 60 * 1000 },
    );
  });
}

export async function reverseName(lat, lon) {
  try {
    const j = await getJSON(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=ar`,
    );
    return { name: j.city || j.locality || j.principalSubdivision || 'موقعي الحالي', country: j.countryName || '' };
  } catch {
    return { name: 'موقعي الحالي', country: '' };
  }
}

export async function cityFromPosition() {
  const { lat, lon } = await getPosition();
  const { name, country } = await reverseName(lat, lon);
  let tz = 'UTC';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { /* لا شيء */ }
  return { id: 'gps', name, country, lat, lon, tz, source: 'gps' };
}

export function geoErrorText(e) {
  if (!e) return 'تعذّر تحديد الموقع';
  if (e.message === 'unsupported') return 'المتصفح لا يدعم تحديد الموقع. اختر المدينة يدويًا.';
  if (e.code === 1) return 'لم يُسمح بتحديد الموقع. نستخدم المدينة المختارة، ويمكنك تغييرها يدويًا.';
  if (e.code === 3) return 'انتهت مهلة تحديد الموقع. حاول مرة أخرى أو اختر المدينة يدويًا.';
  return 'تعذّر تحديد الموقع. اختر المدينة يدويًا.';
}
