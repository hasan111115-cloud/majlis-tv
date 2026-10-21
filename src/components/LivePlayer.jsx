import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { IconMute, IconVolume, IconPlay, IconPause, IconExpand, IconRetry, IconExternal } from './Icons.jsx';
import ChannelBadge from './ChannelBadge.jsx';
import { digitsOf } from '../lib/time.js';

const SOURCE_TIMEOUT = 20000; // مهلة كل مصدر قبل تجربة البديل
const STALL_LIMIT = 25000; // تقطيع أطول من هذا = إعادة اتصال

const isApple = typeof navigator !== 'undefined' && /Apple/.test(navigator.vendor || '') && !/CriOS|FxiOS/.test(navigator.userAgent);

function usableSources(channel) {
  const httpsPage = typeof location !== 'undefined' && location.protocol === 'https:';
  const all = channel.sources || [];
  const ok = all.filter((s) => !(httpsPage && s.url.startsWith('http:')));
  return { ok, blockedMixed: all.length > 0 && ok.length === 0 };
}

/**
 * phase: loading | playing | paused | error | needs-tap
 * - التشغيل يبدأ تلقائيًا فور اختيار القناة (وعند فتح الموقع).
 * - نحاول بالصوت أولًا؛ إن منعه المتصفح نشغّل بلا صوت فورًا ونعيد الصوت مع أول تفاعل.
 */
export default function LivePlayer({ channel, settings, onSettings, onStatus, idle }) {
  const wrapRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const timers = useRef({});
  const [phase, setPhase] = useState('loading');
  const [buffering, setBuffering] = useState(false);
  const [srcInfo, setSrcInfo] = useState({ i: 0, n: 0, label: '' });
  const [error, setError] = useState('');
  const [forcedMute, setForcedMute] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [showCtl, setShowCtl] = useState(true);
  const wantSound = !settings.muted;
  const srcIndexRef = useRef(0);
  srcIndexRef.current = srcInfo.i;
  const srcKey = JSON.stringify(channel.sources || []);
  const wantSoundRef = useRef(wantSound);
  wantSoundRef.current = wantSound;

  const clearTimer = (k) => {
    clearTimeout(timers.current[k]);
    timers.current[k] = null;
  };

  const teardown = useCallback(() => {
    Object.keys(timers.current).forEach(clearTimer);
    const v = videoRef.current;
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (v) {
      v.pause();
      v.removeAttribute('src');
      try { v.load(); } catch { /* لا شيء */ }
    }
  }, []);

  /* محاولة التشغيل: بالصوت إن أراده المستخدم، وإلا/وعند المنع بلا صوت */
  const tryPlay = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !wantSoundRef.current;
    try {
      await v.play();
      setForcedMute(false);
    } catch (e) {
      // NotAllowedError وحده يعني أن المتصفح منع التشغيل التلقائي؛ غيره (تحميل/ترميز) تعالجه أحداث الخطأ
      if (!e || e.name !== 'NotAllowedError') return;
      if (!v.muted) {
        v.muted = true;
        try {
          await v.play();
          setForcedMute(true); // يعمل الآن بلا صوت؛ يعود الصوت مع أول تفاعل
          return;
        } catch (e2) {
          if (!e2 || e2.name !== 'NotAllowedError') return;
        }
      }
      setPhase('needs-tap');
    }
  }, []);

  /* تحميل القناة وتجربة مصادرها بالترتيب */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return undefined;
    let cancelled = false;
    let everPlayed = false;
    const { ok: sources, blockedMixed } = usableSources(channel);
    setPhase('loading');
    setBuffering(false);
    setError('');

    if (!sources.length) {
      setPhase('error');
      setError(
        blockedMixed
          ? 'مصادر هذه القناة تعمل عبر http فقط، والمتصفح يمنعها داخل موقع آمن (https). شغّل «مجلس» عبر http محليًا أو أضف مصدر https من الإعدادات.'
          : 'لا يوجد رابط بث مضاف لهذه القناة بعد. أضفه من ملف القنوات أو الإعدادات.',
      );
      onStatus?.(channel.id, 'error');
      return undefined;
    }

    const fail = (i, reason) => {
      if (cancelled) return;
      if (i + 1 < sources.length) start(i + 1);
      else {
        teardown();
        setPhase('error');
        setError(reason);
        onStatus?.(channel.id, 'error');
      }
    };

    const start = (i) => {
      if (cancelled) return;
      teardown();
      const s = sources[i];
      setSrcInfo({ i, n: sources.length, label: s.label || '' });
      setPhase('loading');
      timers.current.src = setTimeout(
        () => !everPlayed && fail(i, 'انتهت مهلة الاتصال بالبث. قد يكون المصدر متوقفًا الآن أو يمنع التشغيل خارج موقعه الرسمي.'),
        SOURCE_TIMEOUT,
      );
      const useNative = !Hls.isSupported() || (isApple && v.canPlayType('application/vnd.apple.mpegurl'));
      if (!useNative) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 20,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          liveSyncDurationCount: 3,
          manifestLoadingMaxRetry: 2,
          levelLoadingMaxRetry: 3,
          fragLoadingMaxRetry: 4,
        });
        hlsRef.current = hls;
        let netRecover = 0;
        let mediaRecover = 0;
        hls.on(Hls.Events.MANIFEST_PARSED, () => tryPlay());
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
            fail(i, 'تعذّر الوصول إلى البث. قد يكون المصدر متوقفًا أو يمنع التشغيل خارج موقعه الرسمي.');
          }
        });
        hls.loadSource(s.url);
        hls.attachMedia(v);
      } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
        v.src = s.url;
        tryPlay();
      } else {
        fail(i, 'هذا المتصفح لا يدعم تشغيل بث HLS. جرّب Chrome أو Safari.');
      }
    };

    const onPlaying = () => {
      if (cancelled) return;
      everPlayed = true;
      clearTimer('src');
      clearTimer('stall');
      setBuffering(false);
      setPhase('playing');
      onStatus?.(channel.id, 'playing');
    };
    const onWaiting = () => {
      if (!everPlayed) return;
      setBuffering(true);
      clearTimer('stall');
      timers.current.stall = setTimeout(() => {
        // انقطاع طويل: نعيد الاتصال من المصدر الأول
        everPlayed = false;
        start(0);
      }, STALL_LIMIT);
    };
    const onPause = () => {
      if (everPlayed && !v.ended) setPhase((p) => (p === 'playing' ? 'paused' : p));
    };
    const onErr = () => {
      if (hlsRef.current) return; // hls.js يعالج أخطاءه
      const i = srcIndexRef.current;
      fail(i, 'تعذّر تشغيل البث في هذا المتصفح.');
    };
    v.addEventListener('playing', onPlaying);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('pause', onPause);
    v.addEventListener('error', onErr);
    start(0);
    return () => {
      cancelled = true;
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('error', onErr);
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id, srcKey, attempt]);

  /* مستوى الصوت */
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.volume = Math.min(1, Math.max(0, settings.volume));
  }, [settings.volume]);

  /* كتم/تشغيل الصوت حسب تفضيل المستخدم */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (settings.muted) {
      v.muted = true;
      setForcedMute(false);
    } else if (!forcedMute) {
      v.muted = false;
    }
  }, [settings.muted, forcedMute]);

  /* أول تفاعل في أي مكان يعيد الصوت (أو يبدأ التشغيل إن منعه المتصفح كليًا).
     يجب أن يحدث داخل حدث المستخدم نفسه، لذلك نستخدم مستمعًا مباشرًا. */
  useEffect(() => {
    if (!forcedMute && phase !== 'needs-tap') return undefined;
    const unlock = () => {
      const v = videoRef.current;
      if (!v) return;
      if (wantSoundRef.current) v.muted = false;
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
  }, [channel.id, poke]);
  useEffect(() => {
    if (idle) setShowCtl(false);
  }, [idle]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      // العودة إلى اللحظة المباشرة بعد الإيقاف
      const h = hlsRef.current;
      if (h && h.liveSyncPosition) v.currentTime = h.liveSyncPosition;
      else if (v.seekable && v.seekable.length) v.currentTime = Math.max(0, v.seekable.end(v.seekable.length - 1) - 6);
      tryPlay();
    } else {
      v.pause();
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (forcedMute) {
      if (v) v.muted = false;
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
    else if (v?.webkitEnterFullscreen) v.webkitEnterFullscreen();
  };

  const isLive = phase === 'playing' && !buffering;
  const audible = !settings.muted && !forcedMute;

  return (
    <div
      ref={wrapRef}
      className={`player ${showCtl ? 'show-ctl' : ''} phase-${phase}`}
      onPointerMove={poke}
      onPointerDown={poke}
      onFocus={poke}
      onDoubleClick={fullscreen}
    >
      <video
        ref={videoRef}
        className={`player-video ${phase === 'playing' || phase === 'paused' ? 'on' : ''}`}
        playsInline
        autoPlay
        muted
        preload="auto"
        disablePictureInPicture={false}
      />

      {/* شريط علوي: القناة وحالة البث */}
      <div className="player-top">
        <ChannelBadge channel={channel} size="sm" />
        <div className="player-title">
          <strong>{channel.name}</strong>
          {srcInfo.n > 1 && phase !== 'error' ? (
            <span className="player-src">المصدر {digitsOf(srcInfo.i + 1, settings.digits)} من {digitsOf(srcInfo.n, settings.digits)}</span>
          ) : null}
        </div>
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

      {/* حالات التحميل والخطأ */}
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

      {/* أدوات التحكم السفلية */}
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
