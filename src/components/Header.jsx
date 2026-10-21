import { useNow, formatClockParts, formatGregorian, formatHijri } from '../lib/time.js';
import { describe } from '../lib/weather.js';
import { WeatherIcon, IconSettings, IconExpand, IconCollapse } from './Icons.jsx';

export function Clock({ tz, settings }) {
  const now = useNow();
  const p = formatClockParts(new Date(now), tz, settings);
  return (
    <div className="clock" aria-live="off">
      <time className="clock-hm">
        <span>{p.hour}</span>
        <span className="clock-colon">:</span>
        <span>{p.minute}</span>
      </time>
      <div className="clock-side">
        <span className="clock-s">{p.second}</span>
        {p.period ? <span className="clock-period">{p.period}</span> : null}
      </div>
    </div>
  );
}

export function DateDisplay({ tz, settings }) {
  const now = useNow();
  const d = new Date(now);
  // نحدّث النص كل ثانية لكن React لا يعيد رسم DOM إلا إذا تغيّر
  const g = formatGregorian(d, tz, settings.digits);
  const h = settings.showHijri ? formatHijri(d, tz, settings.digits, settings.hijriOffset) : '';
  return (
    <div className="dates">
      <div className="date-weekday">{g.weekday}</div>
      <div className="date-line">
        <span>{g.date}</span>
        {h ? (
          <>
            <span className="date-sep" aria-hidden="true" />
            <span className="date-hijri">{h}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function WeatherWidget({ city, weather, settings, onOpen }) {
  const d = weather.data;
  const desc = d ? describe(d.current.code, d.current.isDay) : null;
  const t = (v) => (settings.digits === 'latn' ? Math.round(v) : Math.round(v).toLocaleString('ar-SA-u-nu-arab'));
  return (
    <button className="wx-chip" data-nav onClick={onOpen} aria-label={`الطقس في ${city.name} — اضغط للتفاصيل`}>
      <span className="wx-chip-city">{city.name}</span>
      {d ? (
        <>
          <WeatherIcon icon={desc.icon} isDay={desc.isDay} size={34} />
          <span className="wx-chip-temp">
            {t(d.current.temp)}
            <sup>°</sup>
          </span>
          <span className="wx-chip-desc">
            {desc.label}
            {weather.status === 'stale' ? <em className="wx-stale">بيانات محفوظة</em> : null}
          </span>
        </>
      ) : weather.status === 'loading' ? (
        <span className="wx-chip-desc muted">جارٍ جلب الطقس…</span>
      ) : (
        <span className="wx-chip-desc muted">الطقس غير متاح مؤقتًا</span>
      )}
    </button>
  );
}

export default function Header({ city, settings, weather, onWeather, onSettings, isFs, onFullscreen, fsSupported }) {
  return (
    <header className="topbar">
      <div className="topbar-start">
        <Clock tz={city.tz} settings={settings} />
        <div className="topbar-divider" aria-hidden="true" />
        <DateDisplay tz={city.tz} settings={settings} />
      </div>
      <div className="topbar-end">
        <WeatherWidget city={city} weather={weather} settings={settings} onOpen={onWeather} />
        <div className="topbar-actions chrome-ctl">
          <button className="icon-btn" data-nav onClick={onSettings} aria-label="الإعدادات" title="الإعدادات">
            <IconSettings />
          </button>
          {fsSupported ? (
            <button className="icon-btn" data-nav onClick={onFullscreen} aria-label={isFs ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'} title="ملء الشاشة">
              {isFs ? <IconCollapse /> : <IconExpand />}
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
