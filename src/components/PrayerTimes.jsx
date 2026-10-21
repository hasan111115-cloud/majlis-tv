import { useMemo } from 'react';
import { useNow, formatTime, formatCountdown, ymdKey } from '../lib/time.js';
import { prayerState, METHODS } from '../lib/prayer.js';

export default function PrayerTimes({ city, settings, onOpenSettings }) {
  const now = useNow();
  // نعيد الحساب كل دقيقة فقط (أو عند تغيّر المدينة/الطريقة/التاريخ)، والعدّاد يتحدّث كل ثانية
  const minute = Math.floor(now / 60000);
  const state = useMemo(() => {
    try {
      return { ok: true, ...prayerState(city, now, settings) };
    } catch (e) {
      return { ok: false };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minute, city.lat, city.lon, city.tz, settings.method, settings.madhab, settings.hijriOffset, ymdKey(new Date(now), city.tz)]);

  if (!state.ok) {
    return (
      <section className="prayers prayers-error" role="alert">
        <p>تعذّر حساب مواقيت الصلاة لهذه المدينة.</p>
        <button className="btn ghost" data-nav onClick={onOpenSettings}>اختيار مدينة أخرى</button>
      </section>
    );
  }

  const { list, next, current, showTomorrow } = state;
  const remaining = next.time.getTime() - now;
  const method = METHODS.find((m) => m.id === settings.method)?.name || '';
  const nextLabel = next.key === 'sunrise' ? 'الشروق' : `صلاة ${next.name}`;

  return (
    <section className="prayers" aria-label="مواقيت الصلاة">
      <div className="prayer-next">
        <div className="prayer-next-label">
          {current ? <span className="now-tag">حان وقت صلاة {current.name}</span> : null}
          <span>متبقي على {nextLabel}</span>
        </div>
        <div className="prayer-count" aria-live="off">{formatCountdown(remaining, settings.digits)}</div>
        <div className="prayer-next-meta">
          <span>{city.name}</span>
          <span className="dot" aria-hidden="true" />
          <span title={`طريقة الحساب: ${method}`}>{showTomorrow ? 'مواقيت الغد' : method}</span>
        </div>
      </div>
      <ol className="prayer-cells">
        {list.map((p) => {
          const isNext = p.key === next.key && p.time.getTime() === next.time.getTime();
          const passed = !showTomorrow && p.time.getTime() <= now;
          const isCurrent = current && current.key === p.key && !showTomorrow;
          return (
            <li key={p.key} className={`prayer-cell ${isNext ? 'next' : ''} ${passed ? 'passed' : ''} ${isCurrent ? 'current' : ''} ${p.key === 'sunrise' ? 'sunrise' : ''}`}>
              <span className="prayer-name">{p.name}</span>
              <span className="prayer-time">{formatTime(p.time, city.tz, settings)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
