import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import LivePlayer from './components/LivePlayer.jsx';
import ChannelList from './components/ChannelList.jsx';
import PrayerTimes from './components/PrayerTimes.jsx';
import WeatherPanel from './components/WeatherPanel.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import { IconWifiOff, IconLocate } from './components/Icons.jsx';
import Safe from './components/Safe.jsx';
import { useSettings, setSettings, resetSettings } from './lib/settings.js';
import { useChannels } from './lib/channels.js';
import { useWeather, describe } from './lib/weather.js';
import { cityFromPosition } from './lib/geo.js';
import { handleArrow, isBackKey, isTyping } from './lib/nav.js';

/* خمول المستخدم: يُستخدم لإخفاء أدوات التحكم في وضع العرض المستمر */
function useIdle(ms, enabled) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setIdle(false);
      return undefined;
    }
    let t;
    const wake = () => {
      setIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), ms);
    };
    const evs = ['pointermove', 'pointerdown', 'keydown', 'touchstart', 'wheel'];
    evs.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    wake();
    return () => {
      clearTimeout(t);
      evs.forEach((e) => window.removeEventListener(e, wake));
    };
  }, [ms, enabled]);
  return idle;
}

/* إبقاء الشاشة مضاءة — تُطلب فقط إن دعمها المتصفح، ولا ندّعي نجاحها إن رُفضت */
function useWakeLock(enabled) {
  const [state, setState] = useState(() => ('wakeLock' in navigator ? 'غير مفعّل' : 'غير مدعوم في هذا المتصفح — اضبط مهلة الشاشة من إعدادات الجهاز'));
  useEffect(() => {
    if (!('wakeLock' in navigator)) return undefined;
    if (!enabled) {
      setState('غير مفعّل (وضع العرض المستمر متوقف)');
      return undefined;
    }
    let lock = null;
    let alive = true;
    const req = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        lock = await navigator.wakeLock.request('screen');
        if (!alive) { lock.release(); return; }
        setState('مفعّل');
        lock.addEventListener('release', () => alive && setState('متوقف مؤقتًا'));
      } catch {
        setState('رفضه المتصفح — اضبط مهلة الشاشة من إعدادات الجهاز');
      }
    };
    req();
    const onVis = () => document.visibilityState === 'visible' && req();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => {});
    };
  }, [enabled]);
  return state;
}

function useOnline() {
  const [on, setOn] = useState(navigator.onLine !== false);
  useEffect(() => {
    const a = () => setOn(true);
    const b = () => setOn(false);
    window.addEventListener('online', a);
    window.addEventListener('offline', b);
    return () => {
      window.removeEventListener('online', a);
      window.removeEventListener('offline', b);
    };
  }, []);
  return on;
}

function useFullscreen() {
  const supported = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
  const [isFs, setFs] = useState(false);
  useEffect(() => {
    const f = () => setFs(!!(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', f);
    document.addEventListener('webkitfullscreenchange', f);
    return () => {
      document.removeEventListener('fullscreenchange', f);
      document.removeEventListener('webkitfullscreenchange', f);
    };
  }, []);
  const toggle = useCallback(() => {
    const el = document.documentElement;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    } else if (el.requestFullscreen) {
      el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    }
  }, []);
  return { supported, isFs, toggle };
}

export default function App() {
  const settings = useSettings();
  const channels = useChannels(settings.customChannels);
  const city = settings.city;
  const weather = useWeather(city);
  const online = useOnline();
  const fs = useFullscreen();
  const idle = useIdle(8000, settings.ambient);
  const wakeLockState = useWakeLock(settings.ambient);
  const [panel, setPanel] = useState(null); // 'weather' | 'settings' | null
  const [statuses, setStatuses] = useState({});
  const [geoNote, setGeoNote] = useState('');

  /* القناة الحالية: تبدأ فورًا بقناة السنة (أو آخر قناة) دون أي ضغطة */
  const [activeId, setActiveId] = useState(() => {
    const s = settings;
    return s.startup === 'last' && s.lastChannel ? s.lastChannel : s.defaultChannel || 'sunnah';
  });
  const active = useMemo(
    () => channels.find((c) => c.id === activeId) || channels.find((c) => c.id === settings.defaultChannel) || channels[0],
    [channels, activeId, settings.defaultChannel],
  );

  const select = useCallback((id) => {
    setActiveId(id);
    setSettings({ lastChannel: id });
  }, []);

  const onStatus = useCallback((id, st) => setStatuses((m) => (m[id] === st ? m : { ...m, [id]: st })), []);

  /* المظهر */
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const light = settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches;
      root.dataset.theme = light ? 'light' : 'dark';
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, [settings.theme]);

  /* تحديد الموقع تلقائيًا عند الفتح إن فعّله المستخدم */
  useEffect(() => {
    if (!settings.autoLocate) return;
    cityFromPosition()
      .then((c) => {
        const cur = settings.city;
        if (Math.abs(cur.lat - c.lat) > 0.02 || Math.abs(cur.lon - c.lon) > 0.02) setSettings({ city: c });
      })
      .catch(() => setGeoNote('تعذّر تحديد موقعك؛ نعرض بيانات المدينة المحفوظة.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* اختصارات الريموت ولوحة المفاتيح */
  const panelRef = useRef(panel);
  panelRef.current = panel;
  useEffect(() => {
    const onKey = (e) => {
      if (isBackKey(e)) {
        if (panelRef.current) {
          e.preventDefault();
          setPanel(null);
        } else if (document.activeElement && document.activeElement !== document.body) {
          document.activeElement.blur();
        }
        return;
      }
      if (handleArrow(e)) return;
      if (isTyping(document.activeElement) || e.ctrlKey || e.metaKey || e.altKey) return;
      const idx = channels.findIndex((c) => c.id === active?.id);
      if (!panelRef.current) {
        if (/^[1-9]$/.test(e.key) && channels[+e.key - 1]) {
          select(channels[+e.key - 1].id);
          return;
        }
        if (e.key === 'PageDown' || e.key === 'ChannelDown' || e.key === 'MediaTrackNext') {
          e.preventDefault();
          select(channels[(idx + 1) % channels.length].id);
          return;
        }
        if (e.key === 'PageUp' || e.key === 'ChannelUp' || e.key === 'MediaTrackPrevious') {
          e.preventDefault();
          select(channels[(idx - 1 + channels.length) % channels.length].id);
          return;
        }
      }
      const k = e.key.toLowerCase();
      if (k === 'm' || k === 'AudioVolumeMute'.toLowerCase()) setSettings((s) => ({ muted: !s.muted }));
      else if (k === 'f') fs.toggle();
      else if (k === 'w') setPanel((p) => (p === 'weather' ? null : 'weather'));
      else if (k === 's') setPanel((p) => (p === 'settings' ? null : 'settings'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [channels, active, select, fs]);

  /* إعادة التركيز بعد إغلاق لوحة */
  const prevPanel = useRef(null);
  useEffect(() => {
    if (prevPanel.current && !panel) {
      const t = document.querySelector(prevPanel.current === 'weather' ? '.wx-chip' : '[aria-label="الإعدادات"]');
      t?.focus({ preventScroll: true });
    }
    prevPanel.current = panel;
  }, [panel]);

  const mood = weather.data && settings.effects ? describe(weather.data.current.code, weather.data.current.isDay).mood : 'none';

  const showPrompt = !settings.locPromptDone && !settings.autoLocate && settings.city.id === 'madinah';
  const acceptLoc = async () => {
    setSettings({ locPromptDone: true });
    try {
      const c = await cityFromPosition();
      setSettings({ city: c, autoLocate: true });
    } catch {
      setGeoNote('لم يُسمح بتحديد الموقع؛ نستخدم المدينة المنورة ويمكنك تغييرها من الإعدادات.');
    }
  };

  return (
    <div
      className={`app mood-${mood} ${idle ? 'is-idle' : ''} ${settings.effects ? 'fx' : 'no-fx'} ${settings.showChannels ? '' : 'no-channels'} ${panel ? 'has-panel' : ''}`}
    >
      <div className="ambient-bg" aria-hidden="true" />

      <Header
        city={city}
        settings={settings}
        weather={weather}
        onWeather={() => setPanel('weather')}
        onSettings={() => setPanel('settings')}
        isFs={fs.isFs}
        onFullscreen={fs.toggle}
        fsSupported={fs.supported}
      />

      <main className="stage">
        <div className="stage-player">
          <div className="player-box">
            <Safe label="تعذّر تشغيل المشغّل" resetKey={active?.id}>
              {active ? (
                <LivePlayer channel={active} settings={settings} onSettings={setSettings} onStatus={onStatus} idle={idle} />
              ) : null}
            </Safe>
          </div>
        </div>
        {settings.showChannels ? (
          <ChannelList channels={channels} activeId={active?.id} statuses={statuses} onSelect={select} digits={settings.digits} />
        ) : null}
      </main>

      <Safe label="تعذّر عرض مواقيت الصلاة" resetKey={city.id + settings.method}>
        <PrayerTimes city={city} settings={settings} onOpenSettings={() => setPanel('settings')} />
      </Safe>

      {!online ? (
        <div className="toast" role="status">
          <IconWifiOff size={18} />
          لا يوجد اتصال بالإنترنت. الساعة والمواقيت تعمل، وسيعود البث والطقس عند عودة الاتصال.
        </div>
      ) : geoNote ? (
        <button className="toast" onClick={() => setGeoNote('')}>{geoNote}</button>
      ) : null}

      {showPrompt && !panel ? (
        <div className="loc-prompt" role="region" aria-label="تحديد الموقع">
          <IconLocate size={22} />
          <p>
            نعرض مواقيت وطقس <strong>المدينة المنورة</strong>. هل تريد استخدام موقعك الحالي بدلًا منها؟
          </p>
          <div className="btn-row">
            <button className="btn sm" data-nav onClick={acceptLoc}>استخدام موقعي</button>
            <button className="btn ghost sm" data-nav onClick={() => setSettings({ locPromptDone: true })}>
              إبقاء المدينة المنورة
            </button>
          </div>
        </div>
      ) : null}

      {panel === 'weather' ? (
        <div className="overlay overlay-clear" onClick={(e) => e.target === e.currentTarget && setPanel(null)}>
          <Safe label="تعذّر عرض تفاصيل الطقس">
            <WeatherPanel city={city} weather={weather} settings={settings} onClose={() => setPanel(null)} />
          </Safe>
        </div>
      ) : null}
      {panel === 'settings' ? (
        <SettingsPanel
          settings={settings}
          set={setSettings}
          reset={() => {
            resetSettings();
            setActiveId('sunnah');
          }}
          channels={channels}
          onClose={() => setPanel(null)}
          wakeLockState={wakeLockState}
        />
      ) : null}
    </div>
  );
}
