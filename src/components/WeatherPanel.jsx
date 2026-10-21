import { useEffect, useRef } from 'react';
import { describe, windDir } from '../lib/weather.js';
import { dtf, loc, formatTime, digitsOf, relativeAgo, useNow } from '../lib/time.js';
import {
  WeatherIcon, IconClose, IconRetry, IconDrop, IconWind, IconUmbrella, IconThermo, IconSunrise, IconSunset,
} from './Icons.jsx';

function n(v, digits) {
  if (v == null || Number.isNaN(v)) return '—';
  return digitsOf(Math.round(v), digits);
}

export function WeatherForecast({ data, tz, settings }) {
  const d = settings.digits;
  const hourFmt = dtf(loc(d), { timeZone: tz, hour: 'numeric', hour12: !settings.clock24 });
  const dayFmt = dtf(loc(d), { timeZone: tz, weekday: 'long' });
  const days = data.daily.slice(1, 6);
  return (
    <>
      <section className="wx-section">
        <h3>الساعات القادمة</h3>
        <ol className="wx-hours">
          {data.hourly.slice(0, 12).map((h, i) => {
            const w = describe(h.code, h.isDay);
            return (
              <li key={h.t} className="wx-hour">
                <span className="muted small">{i === 0 ? 'الآن' : hourFmt.format(new Date(h.t))}</span>
                <WeatherIcon icon={w.icon} isDay={w.isDay} size={26} />
                <span className="wx-hour-t">{n(h.temp, d)}°</span>
                <span className="wx-pop">{h.pop != null && h.pop > 0 ? `${n(h.pop, d)}٪` : ' '}</span>
              </li>
            );
          })}
        </ol>
      </section>
      <section className="wx-section">
        <h3>الأيام الخمسة القادمة</h3>
        <ol className="wx-days">
          {days.map((day) => {
            const w = describe(day.code, true);
            return (
              <li key={day.t} className="wx-day">
                <span className="wx-day-name">{dayFmt.format(new Date(day.t + 12 * 3600000))}</span>
                <span className="wx-day-cond">
                  <WeatherIcon icon={w.icon} size={24} />
                  <span>{w.label}</span>
                </span>
                <span className="wx-pop">{day.pop != null && day.pop > 0 ? `${n(day.pop, d)}٪` : ''}</span>
                <span className="wx-day-range">
                  <b>{n(day.max, d)}°</b>
                  <span className="muted">{n(day.min, d)}°</span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}

export default function WeatherPanel({ city, weather, settings, onClose }) {
  const ref = useRef(null);
  const now = useNow();
  useEffect(() => {
    ref.current?.querySelector('[data-nav]')?.focus({ preventScroll: true });
  }, []);
  const data = weather.data;
  const d = settings.digits;
  const tz = data?.tz || city.tz;
  const today = data?.daily?.[0];
  const w = data ? describe(data.current.code, data.current.isDay) : null;
  const dir = data ? windDir(data.current.windDeg) : null;

  return (
    <aside className="sheet sheet-weather" role="dialog" aria-modal="true" aria-label={`طقس ${city.name}`} data-nav-scope ref={ref}>
      <div className="sheet-head">
        <div>
          <div className="eyebrow">الطقس</div>
          <h2>{city.name}</h2>
        </div>
        <button className="icon-btn" data-nav onClick={onClose} aria-label="إغلاق">
          <IconClose />
        </button>
      </div>

      {!data ? (
        <div className="sheet-empty">
          {weather.status === 'loading' ? (
            <>
              <div className="loader" aria-hidden="true" />
              <p>جارٍ جلب بيانات الطقس…</p>
            </>
          ) : (
            <>
              <p>بيانات الطقس غير متاحة مؤقتًا.</p>
              <p className="muted small">{weather.error}</p>
              <button className="btn" data-nav onClick={weather.retry}>
                <IconRetry size={20} />
                إعادة المحاولة
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="sheet-body">
          <section className="wx-now">
            <WeatherIcon icon={w.icon} isDay={w.isDay} size={64} className="wx-now-ico" />
            <div>
              <div className="wx-now-temp">{n(data.current.temp, d)}°</div>
              <div className="wx-now-desc">{w.label}</div>
              {today ? (
                <div className="muted">
                  العظمى {n(today.max, d)}° · الصغرى {n(today.min, d)}°
                </div>
              ) : null}
            </div>
          </section>

          <dl className="wx-stats">
            <div>
              <dt><IconThermo size={18} />المحسوسة</dt>
              <dd>{n(data.current.feels, d)}°</dd>
            </div>
            <div>
              <dt><IconDrop size={18} />الرطوبة</dt>
              <dd>{n(data.current.humidity, d)}٪</dd>
            </div>
            <div>
              <dt><IconWind size={18} />الرياح</dt>
              <dd>
                {n(data.current.wind, d)} كم/س
                {dir ? <small className="muted"> {dir}</small> : null}
              </dd>
            </div>
            <div>
              <dt><IconUmbrella size={18} />احتمال الهطول</dt>
              <dd>{today?.pop != null ? `${n(today.pop, d)}٪` : 'غير متاح'}</dd>
            </div>
            <div>
              <dt><IconSunrise size={18} />الشروق</dt>
              <dd>{today?.sunrise ? formatTime(new Date(today.sunrise), tz, settings) : '—'}</dd>
            </div>
            <div>
              <dt><IconSunset size={18} />الغروب</dt>
              <dd>{today?.sunset ? formatTime(new Date(today.sunset), tz, settings) : '—'}</dd>
            </div>
          </dl>

          <WeatherForecast data={data} tz={tz} settings={settings} />

          <div className="wx-foot">
            <span className={weather.status === 'stale' ? 'warn' : 'muted'}>
              {weather.status === 'stale' ? 'بيانات محفوظة — ' : ''}
              آخر تحديث {relativeAgo(now - data.fetchedAt, d)}
              {weather.status === 'stale' && weather.error ? ` · ${weather.error}` : ''}
            </span>
            <button className="btn ghost sm" data-nav onClick={weather.retry}>
              <IconRetry size={18} />
              تحديث
            </button>
          </div>
          <p className="credit">المصدر: Open-Meteo</p>
        </div>
      )}
    </aside>
  );
}
