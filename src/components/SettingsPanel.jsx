import { useEffect, useRef, useState } from 'react';
import { METHODS } from '../lib/prayer.js';
import { searchCities, cityFromPosition, geoErrorText } from '../lib/geo.js';
import { MADINAH, storageAvailable } from '../lib/settings.js';
import { digitsOf } from '../lib/time.js';
import { IconClose, IconSearch, IconLocate, IconPlus, IconMinus, IconTrash, IconPin } from './Icons.jsx';

function Segmented({ label, value, options, onChange }) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <div className="seg" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.v)}
            role="radio"
            aria-checked={value === o.v}
            className={`seg-btn ${value === o.v ? 'on' : ''}`}
            data-nav
            onClick={() => onChange(o.v)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <button className="toggle-row" role="switch" aria-checked={checked} data-nav onClick={() => onChange(!checked)}>
      <span className="toggle-text">
        <span>{label}</span>
        {hint ? <span className="muted small">{hint}</span> : null}
      </span>
      <span className={`switch ${checked ? 'on' : ''}`} aria-hidden="true">
        <i />
      </span>
    </button>
  );
}

export default function SettingsPanel({ settings, set, reset, channels, onClose, wakeLockState }) {
  const ref = useRef(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [newCh, setNewCh] = useState({ name: '', url: '', site: '' });
  const [chMsg, setChMsg] = useState('');
  const d = settings.digits;

  useEffect(() => {
    ref.current?.querySelector('[data-nav]')?.focus({ preventScroll: true });
  }, []);

  const doSearch = async (e) => {
    e.preventDefault();
    if (q.trim().length < 2) {
      setMsg('اكتب حرفين على الأقل من اسم المدينة.');
      return;
    }
    setBusy('search');
    setMsg('');
    try {
      const r = await searchCities(q);
      setResults(r);
      if (!r.length) setMsg('لم نجد مدينة بهذا الاسم. جرّب كتابتها بطريقة أخرى أو بالإنجليزية.');
    } catch {
      setMsg('تعذّر البحث الآن. تأكد من الاتصال بالإنترنت وحاول مرة أخرى.');
    }
    setBusy('');
  };

  const pickCity = (c) => {
    set({ city: c, autoLocate: false });
    setResults(null);
    setQ('');
    setMsg(`تم اختيار ${c.name}. تحدّثت المواقيت والطقس.`);
  };

  const locate = async () => {
    setBusy('gps');
    setMsg('');
    try {
      const c = await cityFromPosition();
      set({ city: c, autoLocate: true, locPromptDone: true });
      setMsg(`تم تحديد موقعك: ${c.name}.`);
    } catch (e) {
      set({ autoLocate: false });
      setMsg(geoErrorText(e));
    }
    setBusy('');
  };

  const addChannel = (e) => {
    e.preventDefault();
    const name = newCh.name.trim().slice(0, 40);
    const url = newCh.url.trim();
    const site = newCh.site.trim();
    if (!name) return setChMsg('اكتب اسم القناة.');
    if (!/^https?:\/\/\S+$/i.test(url)) return setChMsg('رابط البث يجب أن يبدأ بـ https:// (ويفضّل أن يكون بصيغة m3u8).');
    if (site && !/^https?:\/\/\S+$/i.test(site)) return setChMsg('رابط الموقع الرسمي غير صحيح.');
    const ch = {
      id: `c-${Date.now().toString(36)}`,
      name,
      short: name.replace(/^قناة\s+/, '').split(/\s+/)[0].slice(0, 8),
      tone: '#9aa0ad',
      officialUrl: site,
      sources: [{ label: 'رابط مضاف يدويًا', url }],
    };
    set({ customChannels: [...settings.customChannels, ch] });
    setNewCh({ name: '', url: '', site: '' });
    setChMsg(
      url.startsWith('http:') && location.protocol === 'https:'
        ? `أُضيفت «${name}». تنبيه: الرابط يبدأ بـ http وقد يمنعه المتصفح لأن الموقع يعمل عبر https.`
        : `أُضيفت «${name}» إلى القائمة.`,
    );
  };

  const removeChannel = (id) => {
    set({
      customChannels: settings.customChannels.filter((c) => c.id !== id),
      ...(settings.defaultChannel === id ? { defaultChannel: 'sunnah' } : {}),
    });
  };

  const vol = Math.round(settings.volume * 100);

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="sheet sheet-settings" role="dialog" aria-modal="true" aria-label="الإعدادات" data-nav-scope ref={ref}>
        <div className="sheet-head">
          <div>
            <div className="eyebrow">مجلس</div>
            <h2>الإعدادات</h2>
          </div>
          <button className="icon-btn" data-nav onClick={onClose} aria-label="إغلاق الإعدادات">
            <IconClose />
          </button>
        </div>

        <div className="sheet-body settings-body">
          {/* ١. المدينة والموقع */}
          <section className="set-group">
            <h3>المدينة</h3>
            <div className="current-city">
              <IconPin size={20} />
              <span>
                <strong>{settings.city.name}</strong>
                <span className="muted small">
                  {[settings.city.region, settings.city.country].filter(Boolean).join('، ')}
                  {settings.city.source === 'gps' ? ' · حسب موقعك' : ''}
                </span>
              </span>
            </div>
            <form className="search-row" onSubmit={doSearch} role="search">
              <input
                id="city-search"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث عن مدينة… مثل: الرياض، جدة، دبي"
                data-nav
                autoComplete="off"
                enterKeyHint="search"
              />
              <button className="btn" data-nav type="submit" disabled={busy === 'search'}>
                <IconSearch size={20} />
                {busy === 'search' ? 'جارٍ البحث…' : 'بحث'}
              </button>
            </form>
            {results && results.length ? (
              <ul className="city-results">
                {results.map((c) => (
                  <li key={c.id}>
                    <button className="city-opt" data-nav onClick={() => pickCity(c)}>
                      <strong>{c.name}</strong>
                      <span className="muted small">{[c.region, c.country].filter(Boolean).join('، ')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="btn-row">
              <button className="btn ghost" data-nav onClick={locate} disabled={busy === 'gps'}>
                <IconLocate size={20} />
                {busy === 'gps' ? 'جارٍ تحديد الموقع…' : 'استخدام موقعي الحالي'}
              </button>
              {settings.city.id !== 'madinah' ? (
                <button className="btn ghost" data-nav onClick={() => pickCity(MADINAH)}>
                  العودة إلى المدينة المنورة
                </button>
              ) : null}
            </div>
            <p className="muted small">
              نستخدم موقعك فقط لحساب مواقيت الصلاة والطقس بدقة، ولا يُرسل أو يُحفظ إلا على هذا الجهاز.
            </p>
            <Toggle
              label="تحديد الموقع تلقائيًا عند الفتح"
              hint="يطلب المتصفح الإذن مرة واحدة"
              checked={settings.autoLocate}
              onChange={(v) => (v ? locate() : set({ autoLocate: false }))}
            />
            {msg ? <p className="note" role="status">{msg}</p> : null}
          </section>

          {/* ٢. القنوات */}
          <section className="set-group">
            <h3>القنوات</h3>
            <div className="field">
              <div className="field-label">القناة الافتراضية</div>
              <div className="seg seg-wrap" role="radiogroup" aria-label="القناة الافتراضية">
                {channels.map((c) => (
                  <button
                    key={c.id}
                    role="radio"
                    aria-checked={settings.defaultChannel === c.id}
                    className={`seg-btn ${settings.defaultChannel === c.id ? 'on' : ''}`}
                    data-nav
                    onClick={() => set({ defaultChannel: c.id })}
                  >
                    {c.name.replace(/^قناة\s+/, '')}
                  </button>
                ))}
              </div>
            </div>
            <Segmented
              label="عند فتح الموقع"
              value={settings.startup}
              onChange={(v) => set({ startup: v })}
              options={[
                { v: 'last', label: 'آخر قناة شاهدتها' },
                { v: 'default', label: 'القناة الافتراضية دائمًا' },
              ]}
            />
            <Toggle label="إظهار قائمة القنوات" checked={settings.showChannels} onChange={(v) => set({ showChannels: v })} />

            <form className="add-ch" onSubmit={addChannel}>
              <div className="field-label">إضافة قناة</div>
              <input id="ch-name" data-nav placeholder="اسم القناة" value={newCh.name} onChange={(e) => setNewCh({ ...newCh, name: e.target.value })} />
              <input id="ch-url" data-nav dir="ltr" inputMode="url" placeholder="https://…/playlist.m3u8" value={newCh.url} onChange={(e) => setNewCh({ ...newCh, url: e.target.value })} />
              <input id="ch-site" data-nav dir="ltr" inputMode="url" placeholder="الموقع الرسمي (اختياري) https://…" value={newCh.site} onChange={(e) => setNewCh({ ...newCh, site: e.target.value })} />
              <button className="btn" data-nav type="submit">
                <IconPlus size={20} />
                إضافة
              </button>
              <p className="muted small">استخدم روابط بث رسمية أو مرخّصة فقط. الصيغة المدعومة: HLS ‏(m3u8).</p>
              {chMsg ? <p className="note" role="status">{chMsg}</p> : null}
            </form>
            {settings.customChannels.length ? (
              <ul className="custom-ch">
                {settings.customChannels.map((c) => (
                  <li key={c.id}>
                    <span>{c.name}</span>
                    <button className="icon-btn sm" data-nav onClick={() => removeChannel(c.id)} aria-label={`حذف ${c.name}`}>
                      <IconTrash size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {/* ٣. الوقت والتاريخ */}
          <section className="set-group">
            <h3>الوقت والتاريخ</h3>
            <Segmented label="نظام الساعة" value={settings.clock24} onChange={(v) => set({ clock24: v })}
              options={[{ v: false, label: '١٢ ساعة' }, { v: true, label: '٢٤ ساعة' }]} />
            <Segmented label="الأرقام" value={settings.digits} onChange={(v) => set({ digits: v })}
              options={[{ v: 'arab', label: 'عربية ١٢٣' }, { v: 'latn', label: 'إنجليزية 123' }]} />
            <Toggle label="عرض التاريخ الهجري" hint="تقويم أم القرى" checked={settings.showHijri} onChange={(v) => set({ showHijri: v })} />
            {settings.showHijri ? (
              <Segmented label="تعديل التاريخ الهجري" value={settings.hijriOffset} onChange={(v) => set({ hijriOffset: v })}
                options={[{ v: -1, label: 'يوم −' }, { v: 0, label: 'بدون تعديل' }, { v: 1, label: 'يوم +' }]} />
            ) : null}
          </section>

          {/* ٤. مواقيت الصلاة */}
          <section className="set-group">
            <h3>مواقيت الصلاة</h3>
            <div className="field">
              <div className="field-label">طريقة الحساب</div>
              <div className="seg seg-wrap" role="radiogroup" aria-label="طريقة الحساب">
                {METHODS.map((m) => (
                  <button key={m.id} role="radio" aria-checked={settings.method === m.id}
                    className={`seg-btn ${settings.method === m.id ? 'on' : ''}`} data-nav onClick={() => set({ method: m.id })}>
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
            <Segmented label="وقت العصر" value={settings.madhab} onChange={(v) => set({ madhab: v })}
              options={[{ v: 'shafi', label: 'الجمهور (المعتمد في السعودية)' }, { v: 'hanafi', label: 'الحنفي' }]} />
          </section>

          {/* ٥. الصوت */}
          <section className="set-group">
            <h3>الصوت</h3>
            <div className="field">
              <div className="field-label">مستوى الصوت</div>
              <div className="vol">
                <button className="icon-btn" data-nav onClick={() => set({ volume: Math.max(0, +(settings.volume - 0.1).toFixed(2)) })} aria-label="خفض الصوت">
                  <IconMinus />
                </button>
                <div className="vol-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={vol} aria-label="مستوى الصوت">
                  <i style={{ width: `${vol}%` }} />
                </div>
                <span className="vol-num">{digitsOf(vol, d)}٪</span>
                <button className="icon-btn" data-nav onClick={() => set({ volume: Math.min(1, +(settings.volume + 0.1).toFixed(2)) })} aria-label="رفع الصوت">
                  <IconPlus />
                </button>
              </div>
            </div>
            <Toggle
              label="التشغيل بالصوت"
              hint="إن منعه المتصفح عند الفتح، يبدأ البث بلا صوت ويعود الصوت مع أول ضغطة"
              checked={!settings.muted}
              onChange={(v) => set({ muted: !v })}
            />
          </section>

          {/* ٦. العرض */}
          <section className="set-group">
            <h3>العرض</h3>
            <Toggle
              label="وضع العرض المستمر"
              hint="يخفي أدوات التحكم بهدوء عند عدم التفاعل ويطلب إبقاء الشاشة مضاءة"
              checked={settings.ambient}
              onChange={(v) => set({ ambient: v })}
            />
            <p className="muted small">إبقاء الشاشة مضاءة: {wakeLockState}</p>
            <Toggle label="المؤثرات البصرية" hint="خلفية متدرجة حسب الطقس وحركات انتقالية" checked={settings.effects} onChange={(v) => set({ effects: v })} />
            <Segmented label="المظهر" value={settings.theme} onChange={(v) => set({ theme: v })}
              options={[{ v: 'dark', label: 'داكن دائمًا' }, { v: 'system', label: 'حسب إعداد الجهاز' }]} />
          </section>

          {/* ٧. إعادة الضبط */}
          <section className="set-group">
            <h3>إعادة الضبط</h3>
            {!confirmReset ? (
              <button className="btn ghost danger" data-nav onClick={() => setConfirmReset(true)}>
                إعادة كل الإعدادات إلى الوضع الأصلي
              </button>
            ) : (
              <div className="confirm">
                <p>ستعود المدينة إلى المدينة المنورة وتُحذف القنوات المضافة. هل تريد المتابعة؟</p>
                <div className="btn-row">
                  <button className="btn danger" data-nav onClick={() => { reset(); setConfirmReset(false); }}>نعم، أعد الضبط</button>
                  <button className="btn ghost" data-nav onClick={() => setConfirmReset(false)}>إلغاء</button>
                </div>
              </div>
            )}
            {!storageAvailable() ? (
              <p className="note warn">التخزين المحلي غير متاح في هذا المتصفح، لذلك لن تُحفظ الإعدادات بعد إغلاقه.</p>
            ) : (
              <p className="muted small">تُحفظ الإعدادات على هذا الجهاز فقط.</p>
            )}
          </section>

          <section className="set-group keys-help">
            <h3>التحكم بالريموت ولوحة المفاتيح</h3>
            <ul>
              <li><kbd>الأسهم</kbd> التنقل بين العناصر</li>
              <li><kbd>Enter</kbd> اختيار</li>
              <li><kbd>Esc</kbd> / رجوع: إغلاق اللوحات</li>
              <li><kbd>١–٩</kbd> الانتقال مباشرة إلى قناة</li>
              <li><kbd>PageUp/PageDown</kbd> القناة السابقة/التالية</li>
              <li><kbd>M</kbd> كتم الصوت · <kbd>F</kbd> ملء الشاشة · <kbd>W</kbd> الطقس · <kbd>S</kbd> الإعدادات</li>
            </ul>
          </section>
        </div>
      </aside>
    </div>
  );
}
