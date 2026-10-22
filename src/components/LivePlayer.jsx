import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { IconMute, IconVolume, IconPlay, IconPause, IconExpand, IconRetry, IconExternal } from './Icons.jsx';
import ChannelBadge from './ChannelBadge.jsx';
import { digitsOf } from '../lib/time.js';
import { analyzeUrl } from '../lib/channels.js';
import { blocksHttp } from '../lib/env.js';

const SOURCE_TIMEOUT = 20000; // مهلة مصدر HLS قبل تجربة البديل
const YT_TIMEOUT = 14000; // مهلة مصدر يوتيوب (القناة قد لا تكون في بث مباشر الآن)
const STALL_LIMIT = 25000; // تقطيع أطول من هذا = إعادة اتصال

const isApple = typeof navigator !== 'undefined' && /Apple/.test(navigator.vendor || '') && !/CriOS|FxiOS/.test(navigator.userAgent);

function usableSources(channel) {
  const httpsPage = blocksHttp();
  const all = (channel.sources || []).map((s) => ({ ...s, info: analyzeUrl(s.url) }));
  const ok = all.filter((s) => !(httpsPage && s.url.startsWith('http:')) && ['hls', 'file', 'youtube'].includes(s.info.kind));
  const invalid = all.find((s) => !['hls', 'file', 'youtube'].includes(s.info.kind));
  const mixed = all.some((s) => httpsPage && s.url.startsWith('http:'));
  return { ok, invalid, mixed, total: all.length };
}

/* تحميل واجهة يوتيوب مرة واحدة */
let ytPromise = null;
function loadYT() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (!ytPromise) {
    ytPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(window.YT);
      };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      s.onerror = () => {
        ytPromise = null;
        reject(new Error('yt'));
      };
      document.head.appendChild(s);
    });
  }
  return ytPromise;
}

function levelLabel(h) {
  if (!h) return '';
  if (h >= 2000) return '4K';
  if (h >= 1000) return '1080p';
  if (h >= 700) return '720p';
  return `${h}p`;
}

/**
 * phase: loading | playing | paused | error | needs-tap
 * - التشغيل يبدأ تلقائيًا فور اختيار القناة (وعند فتح الموقع).
 * - نحاول بالصوت أولًا؛ إن منعه المتصفح نشغّل بلا صوت فورًا ونعيد الصوت مع أول تفاعل.
 * - يدعم HLS ‏(m3u8) والملفات المباشرة وبث يوتيوب، ويتنقّل بين المصادر تلقائيًا.
 */
export default function LivePlayer({ channel, settings, onSettings, onStatus, idle }) {
  const wrapRef = useRef(null);
  const videoRef = useRef(null);
  const ytHostRef = useRef(null);
  const hlsRef = useRef(null);
  const ytRef = useRef(null);
  const engineRef = useRef(null); // 'video' | 'yt'
  const timers = useRef({});
  const [engine, setEngine] = useState('video');
  const [phase, setPhase] = useState('loading');
  const [buffering, setBuffering] = useState(false);
  const [srcInfo, setSrcInfo] = useState({ i: 0, n: 0, label: '' });
  const [quality, setQuality] = useState('');
  const [audioOnly, setAudioOnly] = useState(false);
  const [error, setError] = useState('');
  const [forcedMute, setForcedMute] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [showCtl, setShowCtl] = useState(true);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const srcKey = JSON.stringify(channel.sources || []);

  const clearTimer = (k) => {
    clearTimeout(timers.current[k]);
    timers.current[k] = null;
  };

  const teardown = useCallback(() => {
    Object.keys(timers.current).forEach((k) => k !== 'ctl' && clearTimer(k));
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.removeAttribute('src');
      try { v.load(); } catch { /* لا شيء */ }
    }
    if (ytRef.current) {
      try { ytRef.current.destroy(); } catch { /* لا شيء */ }
      ytRef.current = null;
    }
    if (ytHostRef.current) ytHostRef.current.textContent = '';
    setQuality('');
    setAudioOnly(false);
  }, []);

  /* ---------- تشغيل الفيديو (HLS/ملف) ---------- */
  const tryPlay = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !!settingsRef.current.muted;
    try {
      await v.play();
      setForcedMute(false);
    } catch (e) {
      // NotAllowedError وحده يعني أن المتصفح منع التشغيل التلقائي؛ غيره تعالجه أحداث الخطأ
      if (!e || e.name !== 'NotAllowedError') return;
      if (!v.muted) {
        v.muted = true;
        try {
          await v.play();
          setForcedMute(true);
          return;
        } catch (e2) {
          if (!e2 || e2.name !== 'NotAllowedError') return;
        }
      }
      setPhase('needs-tap');
    }
  }, []);

  /* ---------- تحميل القناة وتجربة مصادرها بالترتيب ---------- */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return undefined;
    let cancelled = false;
    let everPlayed = false;
    let cur = 0;
    const { ok: sources, invalid, mixed, total } = usableSources(channel);
    setPhase('loading');
    setBuffering(false);
    setError('');

    if (!sources.length) {
      setPhase('error');
      setError(
        !total
          ? 'لا يوجد رابط بث لهذه القناة. أضف رابطًا من الإعدادات ← القنوات.'
          : invalid
            ? invalid.info.reason
            : mixed
              ? 'روابط هذه القناة تبدأ بـ http، والمتصفح يمنعها لأن الموقع يعمل عبر https. استخدم رابطًا يبدأ بـ https أو رابط بث يوتيوب.'
              : 'تعذّر تشغيل روابط هذه القناة.',
      );
      onStatus?.(channel.id, 'error');
      return undefined;
    }

    const fail = (i, reason) => {
      if (cancelled || i !== cur) return;
      if (i + 1 < sources.length) start(i + 1);
      else {
        teardown();
        setPhase('error');
        setError(reason);
        onStatus?.(channel.id, 'error');
      }
    };

    const markPlaying = () => {
      if (cancelled) return;
      everPlayed = true;
      clearTimer('src');
      clearTimer('stall');
      setBuffering(false);
      setPhase('playing');
      onStatus?.(channel.id, 'playing');
    };

    const startYouTube = (i, s) => {
      engineRef.current = 'yt';
      setEngine('yt');
      timers.current.src = setTimeout(
        () => !everPlayed && fail(i, 'بث يوتيوب لهذه القناة غير متاح الآن (قد لا تكون القناة في بث مباشر حاليًا).'),
        YT_TIMEOUT,
      );
      // نُنشئ الإطار يدويًا (لا عبر React) لأن واجهة يوتيوب تستبدله وتحذفه بنفسها
      const iframe = document.createElement('iframe');
      iframe.src = s.info.embed + `&origin=${encodeURIComponent(location.origin)}`;
      iframe.title = channel.name;
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      iframe.tabIndex = -1;
      ytHostRef.current?.appendChild(iframe);
      loadYT()
        .then((YT) => {
          if (cancelled || i !== cur || !iframe.isConnected) return;
          ytRef.current = new YT.Player(iframe, {
            events: {
              onReady: (e) => {
                const p = e.target;
                p.setVolume(Math.round(settingsRef.current.volume * 100));
                p.mute();
                p.playVideo();
                // نعيد الصوت فورًا إن سمح المتصفح، وإلا عند أول تفاعل
                if (!settingsRef.current.muted) {
                  if (navigator.userActivation?.hasBeenActive) p.unMute();
                  else setForcedMute(true);
                }
              },
              onStateChange: (e) => {
                if (cancelled) return;
                const st = e.data;
                if (st === 1) {
                  markPlaying();
                  try {
                    const q = e.target.getPlaybackQuality?.();
                    const map = { hd2160: '4K', hd1440: '1440p', hd1080: '1080p', hd720: '720p', large: '480p', medium: '360p', small: '240p' };
                    setQuality(map[q] || '');
                  } catch { /* لا شيء */ }
                } else if (st === 3 && everPlayed) setBuffering(true);
                else if (st === 2 && everPlayed) setPhase('paused');
                else if (st === 0) {
                  everPlayed = false;
                  start(i);
                }
              },
              onPlaybackQualityChange: (e) => {
                const map = { hd2160: '4K', hd1440: '1440p', hd1080: '1080p', hd720: '720p', large: '480p', medium: '360p', small: '240p' };
                setQuality(map[e.data] || '');
              },
              onError: () => fail(i, 'تعذّر تشغيل بث يوتيوب (قد يكون البث متوقفًا أو يمنع التضمين).'),
            },
          });
        })
        .catch(() => fail(i, 'تعذّر تحميل مشغّل يوتيوب. تأكد من الاتصال بالإنترنت.'));
    };

    const startVideo = (i, s) => {
      engineRef.current = 'video';
      setEngine('video');
      timers.current.src = setTimeout(
        () => !everPlayed && fail(i, 'انتهت مهلة الاتصال بالبث. قد يكون المصدر متوقفًا الآن أو يمنع التشغيل خارج موقعه الرسمي.'),
        SOURCE_TIMEOUT,
      );
      v.volume = Math.min(1, Math.max(0, settingsRef.current.volume));
      const nativeHls = v.canPlayType('application/vnd.apple.mpegurl');
      const useHlsJs = s.info.kind === 'hls' && Hls.isSupported() && !(isApple && nativeHls);
      if (useHlsJs) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 20,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          liveSyncDurationCount: 3,
          capLevelToPlayerSize: false, // لا نخفض الجودة بسبب حجم المشغّل
          abrEwmaDefaultEstimate: 8_000_000, // نبدأ بتقدير سرعة عالٍ فتظهر الجودة العالية مبكرًا
          startLevel: -1,
          manifestLoadingMaxRetry: 2,
          levelLoadingMaxRetry: 3,
          fragLoadingMaxRetry: 4,
        });
        hlsRef.current = hls;
        let netRecover = 0;
        let mediaRecover = 0;
        hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
          const levels = data.levels || [];
          if (levels.length > 1) {
            const top = levels.reduce((best, l, idx) => ((l.height || 0) > (levels[best].height || 0) ? idx : best), 0);
            if (settingsRef.current.quality === 'max') hls.currentLevel = top;
            else hls.startLevel = top; // تلقائي: نبدأ بالأعلى ثم يتكيّف حسب سرعة الإنترنت
          }
          tryPlay();
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
          const l = hls.levels?.[data.level];
          setQuality(l?.height ? levelLabel(l.height) : '');
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal || cancelled) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && everPlayed && netRecover < 3) {
            netRecover++;
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecover < 2) {
            mediaRecover++;
            if (mediaRecover === 2) hls.swapAudioCodec();
            hls.recoverMediaError();
          } else {
            const blocked = data.details === 'manifestLoadError' && data.response?.code === 0;
            fail(
              i,
              blocked
                ? 'خادم البث يرفض التشغيل من مواقع أخرى، أو الرابط متوقف. جرّب رابطًا آخر للقناة.'
                : 'تعذّر الوصول إلى البث. قد يكون المصدر متوقفًا أو يمنع التشغيل خارج موقعه الرسمي.',
            );
          }
        });
        hls.loadSource(s.url);
        hls.attachMedia(v);
      } else if (s.info.kind === 'file' || nativeHls) {
        v.src = s.url;
        tryPlay();
      } else {
        fail(i, 'هذا المتصفح لا يدعم تشغيل بث HLS. جرّب Chrome أو Safari.');
      }
    };

    const start = (i) => {
      if (cancelled) return;
      cur = i;
      teardown();
      const s = sources[i];
      setSrcInfo({ i, n: sources.length, label: s.label || '' });
      setPhase('loading');
      if (s.info.kind === 'youtube') startYouTube(i, s);
      else startVideo(i, s);
    };

    const onPlaying = () => {
      if (engineRef.current !== 'video') return;
      markPlaying();
      // بث صوتي فقط (إذاعة): لا توجد صورة
      setAudioOnly(!v.videoWidth && !v.videoHeight);
    };
    const onWaiting = () => {
      if (!everPlayed || engineRef.current !== 'video') return;
      setBuffering(true);
      clearTimer('stall');
      timers.current.stall = setTimeout(() => {
        everPlayed = false;
        start(0);
      }, STALL_LIMIT);
    };
    const onPause = () => {
      if (engineRef.current === 'video' && everPlayed && !v.ended) setPhase((p) => (p === 'playing' ? 'paused' : p));
    };
    const onErr = () => {
      if (hlsRef.current || engineRef.current !== 'video' || !v.getAttribute('src')) return;
      fail(cur, 'تعذّر تشغيل البث في هذا المتصفح.');
    };
    const onResize = () => {
      if (engineRef.current !== 'video') return;
      if (v.videoHeight) setAudioOnly(false);
      if (!hlsRef.current) setQuality(levelLabel(v.videoHeight));
    };
    v.addEventListener('playing', onPlaying);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('pause', onPause);
    v.addEventListener('error', onErr);
    v.addEventListener('resize', onResize);
    start(0);
    return () => {
      cancelled = true;
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('error', onErr);
      v.removeEventListener('resize', onResize);
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id, srcKey, attempt, settings.quality]);

  /* مستوى الصوت */
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.volume = Math.min(1, Math.max(0, settings.volume));
    try { ytRef.current?.setVolume?.(Math.round(settings.volume * 100)); } catch { /* لا شيء */ }
  }, [settings.volume]);

  /* كتم/تشغيل الصوت حسب تفضيل المستخدم */
  useEffect(() => {
    const v = videoRef.current;
    const yt = ytRef.current;
    if (settings.muted) {
      if (v) v.muted = true;
      try { yt?.mute?.(); } catch { /* لا شيء */ }
      setForcedMute(false);
    } else if (!forcedMute) {
      if (v) v.muted = false;
      try { yt?.unMute?.(); } catch { /* لا شيء */ }
    }
  }, [settings.muted, forcedMute]);

  /* أول تفاعل في أي مكان يعيد الصوت (أو يبدأ التشغيل إن منعه المتصفح كليًا) */
  useEffect(() => {
    if (!forcedMute && phase !== 'needs-tap') return undefined;
    const unlock = () => {
      const wantSound = !settingsRef.current.muted;
      if (engineRef.current === 'yt') {
        const yt = ytRef.current;
        try {
          if (wantSound) yt?.unMute?.();
          yt?.playVideo?.();
        } catch { /* لا شيء */ }
        setForcedMute(false);
        return;
      }
      const v = videoRef.current;
      if (!v) return;
      if (wantSound) v.muted = false;
      v.play().then(() => setForcedMute(false)).catch(() => {});
    };
    const opts = { capture: true };
    window.addEventListener('pointerdown', unlock, opts);
    window.addEventListener('keydown', unlock, opts);
    window.addEventListener('touchend', unlock, opts);
    return () => {
      window.removeEventListener('pointerdown', unlock, opts);
      window.removeEventListener('keydown', unlock, opts);
      window.removeEventListener('touchend', unlock, opts);
    };
  }, [forcedMute, phase]);

  /* إظهار عناصر التحكم مع الحركة وإخفاؤها بعد ٣.٥ ثوانٍ */
  const poke = useCallback(() => {
    setShowCtl(true);
    clearTimeout(timers.current.ctl);
    timers.current.ctl = setTimeout(() => {
      if (!wrapRef.current?.contains(document.activeElement)) setShowCtl(false);
    }, 3500);
  }, []);
  useEffect(() => {
    poke();
    return () => clearTimeout(timers.current.ctl);
  }, [channel.id, poke]);
  useEffect(() => {
    if (idle) setShowCtl(false);
  }, [idle]);

  const togglePlay = () => {
    if (engineRef.current === 'yt') {
      const yt = ytRef.current;
      if (!yt) return;
      if (phase === 'paused') {
        try { yt.seekTo(yt.getDuration(), true); } catch { /* لا شيء */ }
        yt.playVideo();
      } else yt.pauseVideo();
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      const h = hlsRef.current;
      if (h && h.liveSyncPosition) v.currentTime = h.liveSyncPosition;
      else if (v.seekable && v.seekable.length) v.currentTime = Math.max(0, v.seekable.end(v.seekable.length - 1) - 6);
      tryPlay();
    } else {
      v.pause();
    }
  };

  const toggleMute = () => {
    if (forcedMute) {
      if (engineRef.current === 'yt') {
        try { ytRef.current?.unMute?.(); } catch { /* لا شيء */ }
      } else if (videoRef.current) videoRef.current.muted = false;
      setForcedMute(false);
      onSettings({ muted: false });
      return;
    }
    onSettings({ muted: !settings.muted });
  };

  const fullscreen = () => {
    const el = wrapRef.current;
    const v = videoRef.current;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
      return;
    }
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el?.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (v?.webkitEnterFullscreen && engine === 'video') v.webkitEnterFullscreen();
  };

  const isLive = phase === 'playing' && !buffering;
  const audible = !settings.muted && !forcedMute;
  const d = settings.digits;

  return (
    <div
      ref={wrapRef}
      className={`player ${showCtl ? 'show-ctl' : ''} phase-${phase} engine-${engine}`}
      onPointerMove={poke}
      onPointerDown={poke}
      onFocus={poke}
      onDoubleClick={fullscreen}
    >
      <video
        ref={videoRef}
        className={`player-video ${engine === 'video' && (phase === 'playing' || phase === 'paused') ? 'on' : ''}`}
        playsInline
        autoPlay
        muted
        preload="auto"
      />
      <div ref={ytHostRef} className={`player-yt ${engine === 'yt' && (phase === 'playing' || phase === 'paused') ? 'on' : ''}`} />

      {(audioOnly || channel.radio) && engine === 'video' && (phase === 'playing' || phase === 'paused') ? (
        <div className={`radio-screen ${phase === 'playing' && !buffering ? 'live' : ''}`} style={{ '--tone': channel.tone }}>
          <div className="radio-waves" aria-hidden="true">
            {Array.from({ length: 5 }, (_, k) => <i key={k} />)}
          </div>
          <div className="radio-name">{channel.name}</div>
          <div className="radio-sub">بث إذاعي مباشر</div>
        </div>
      ) : null}

      {/* شريط علوي: القناة وحالة البث */}
      <div className="player-top">
        <ChannelBadge channel={channel} size="sm" />
        <div className="player-title">
          <strong>{channel.name}</strong>
          {phase !== 'error' && srcInfo.label ? (
            <span className="player-src">
              {srcInfo.label}
              {srcInfo.n > 1 ? ` · المصدر ${digitsOf(srcInfo.i + 1, d)} من ${digitsOf(srcInfo.n, d)}` : ''}
            </span>
          ) : null}
        </div>
        {quality && isLive ? <span className="state-pill q-pill">{quality}</span> : null}
        {isLive ? (
          <span className="live-pill" aria-label="بث مباشر يعمل الآن">
            <i />
            مباشر
          </span>
        ) : phase === 'paused' ? (
          <span className="state-pill">متوقف مؤقتًا</span>
        ) : buffering ? (
          <span className="state-pill">جارٍ التحميل…</span>
        ) : null}
      </div>

      {forcedMute && phase === 'playing' && !settings.muted ? (
        <button className="unmute-hint" data-nav onClick={toggleMute}>
          <IconMute size={20} />
          يعمل البث بلا صوت — اضغط أي زر لتشغيل الصوت
        </button>
      ) : null}

      {phase === 'loading' ? (
        <div className="player-state" role="status">
          <div className="loader" aria-hidden="true" />
          <p>جارٍ الاتصال ببث {channel.name}…</p>
          {srcInfo.label ? <span className="muted small">{srcInfo.label}</span> : null}
        </div>
      ) : null}

      {phase === 'needs-tap' ? (
        <div className="player-state">
          <button className="big-play" data-nav data-nav-default onClick={() => tryPlay()} aria-label="تشغيل البث">
            <IconPlay size={36} />
          </button>
          <p>المتصفح أوقف التشغيل التلقائي. اضغط أي زر لبدء البث.</p>
        </div>
      ) : null}

      {phase === 'error' ? (
        <div className="player-state error" role="alert">
          <p className="err-title">تعذّر تشغيل {channel.name}</p>
          <p className="err-body">{error}</p>
          <div className="err-actions">
            <button className="btn" data-nav onClick={() => setAttempt((a) => a + 1)}>
              <IconRetry size={20} />
              إعادة المحاولة
            </button>
            {channel.officialUrl ? (
              <a className="btn ghost" data-nav href={channel.officialUrl} target="_blank" rel="noopener noreferrer">
                <IconExternal size={20} />
                الموقع الرسمي
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {phase === 'playing' || phase === 'paused' ? (
        <div className="player-ctl chrome-ctl">
          <button className="icon-btn" data-nav onClick={togglePlay} aria-label={phase === 'paused' ? 'تشغيل' : 'إيقاف مؤقت'}>
            {phase === 'paused' ? <IconPlay /> : <IconPause />}
          </button>
          <button className="icon-btn" data-nav onClick={toggleMute} aria-label={audible ? 'كتم الصوت' : 'تشغيل الصوت'}>
            {audible ? <IconVolume /> : <IconMute />}
          </button>
          <span className="ctl-spacer" />
          <button className="icon-btn" data-nav onClick={fullscreen} aria-label="عرض القناة بملء الشاشة">
            <IconExpand />
          </button>
        </div>
      ) : null}
    </div>
  );
}
