import { useState } from 'react';
import ChannelBadge from './ChannelBadge.jsx';
import { analyzeUrl } from '../lib/channels.js';
import { digitsOf } from '../lib/time.js';
import { IconPlus, IconTrash, IconRetry } from './Icons.jsx';
import { blocksHttp } from '../lib/env.js';

const KIND_LABEL = { youtube: 'يوتيوب', hls: 'بث m3u8', file: 'ملف فيديو' };

/** فحص رابط قبل حفظه: يكشف روابط الصفحات، وروابط http، والخوادم التي تمنع التشغيل */
export async function testLink(url) {
  const info = analyzeUrl(url);
  if (!['youtube', 'hls', 'file'].includes(info.kind)) return { ok: false, hard: true, msg: info.reason };
  if (blocksHttp() && url.trim().startsWith('http:')) {
    return {
      ok: false,
      hard: false,
      msg: 'الرابط يبدأ بـ http، والمتصفح يمنعه لأن الموقع يعمل عبر https. ابحث عن نسخة https من الرابط أو رابط بث يوتيوب.',
    };
  }
  if (info.kind === 'youtube') return { ok: true, msg: 'رابط يوتيوب صالح — سيُشغَّل داخل الموقع.' };
  if (info.kind === 'file') return { ok: true, msg: 'رابط ملف فيديو مباشر.' };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(url.trim(), { signal: ctl.signal, cache: 'no-store' });
    if (!r.ok) return { ok: false, hard: false, msg: `الخادم ردّ بخطأ (${r.status}). قد يكون الرابط منتهيًا أو متوقفًا.` };
    const txt = (await r.text()).slice(0, 2000);
    if (!txt.includes('#EXTM3U')) return { ok: false, hard: false, msg: 'الرابط لا يعيد بث m3u8 صالحًا. تأكد أنه رابط البث وليس صفحة.' };
    return { ok: true, msg: 'الرابط يعمل ✓' };
  } catch (e) {
    return {
      ok: false,
      hard: false,
      msg:
        e.name === 'AbortError'
          ? 'انتهت المهلة دون رد من خادم البث.'
          : 'خادم البث يرفض التشغيل من مواقع أخرى (CORS)، أو الرابط متوقف. هذه الروابط تعمل فقط في تطبيقات مثل VLC وليس داخل المتصفح.',
    };
  } finally {
    clearTimeout(t);
  }
}

function parseLinks(text) {
  return text
    .split(/\s+/)
    .map((x) => x.trim())
    .filter((x) => /^https?:\/\//i.test(x));
}

function ChannelForm({ initial, onSave, onCancel, submitLabel }) {
  const [name, setName] = useState(initial?.name || '');
  const [links, setLinks] = useState((initial?.sources || []).map((s) => s.url).join('\n'));
  const [site, setSite] = useState(initial?.officialUrl || '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async (force) => {
    const n = name.trim().slice(0, 40);
    const urls = parseLinks(links);
    if (!n) return setResult({ ok: false, hard: true, msg: 'اكتب اسم القناة.' });
    if (!urls.length) return setResult({ ok: false, hard: true, msg: 'الصق رابط بث واحدًا على الأقل يبدأ بـ https://' });
    if (site.trim() && !/^https?:\/\/\S+$/i.test(site.trim())) return setResult({ ok: false, hard: true, msg: 'رابط الموقع الرسمي غير صحيح.' });
    if (!force) {
      setBusy(true);
      setResult({ ok: true, msg: 'جارٍ فحص الرابط…', pending: true });
      const r = await testLink(urls[0]);
      setBusy(false);
      if (!r.ok) {
        setResult(r);
        return;
      }
    }
    const oldByUrl = new Map((initial?.sources || []).map((s) => [s.url, s.label]));
    onSave({
      name: n,
      officialUrl: site.trim(),
      sources: urls.map((u, i) => ({
        url: u,
        label: oldByUrl.get(u) || `${KIND_LABEL[analyzeUrl(u).kind] || 'رابط'}${urls.length > 1 ? ` ${i + 1}` : ''}`,
      })),
    });
  };

  return (
    <form
      className="add-ch"
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
    >
      <input id="ch-name" data-nav placeholder="اسم القناة" value={name} onChange={(e) => setName(e.target.value)} />
      <textarea
        id="ch-links"
        data-nav
        dir="ltr"
        rows={3}
        placeholder={'رابط البث (m3u8 أو يوتيوب)\nيمكن وضع أكثر من رابط، كل رابط في سطر — يُجرَّب التالي إن تعطل الأول'}
        value={links}
        onChange={(e) => setLinks(e.target.value)}
      />
      <input id="ch-site" data-nav dir="ltr" inputMode="url" placeholder="الموقع الرسمي (اختياري) https://…" value={site} onChange={(e) => setSite(e.target.value)} />
      {result ? (
        <p className={`note ${result.ok ? '' : 'bad'}`} role="status">
          {result.msg}
        </p>
      ) : null}
      <div className="btn-row">
        <button className="btn" data-nav type="submit" disabled={busy}>
          {busy ? 'جارٍ الفحص…' : submitLabel}
        </button>
        {result && !result.ok && !result.hard ? (
          <button className="btn ghost" data-nav type="button" onClick={() => submit(true)}>
            حفظ رغم ذلك
          </button>
        ) : null}
        {onCancel ? (
          <button className="btn ghost" data-nav type="button" onClick={onCancel}>
            إلغاء
          </button>
        ) : null}
      </div>
    </form>
  );
}

export default function ChannelManager({ channels, settings, set }) {
  const [editing, setEditing] = useState(null); // id | 'new' | null
  const [confirmDel, setConfirmDel] = useState(null);
  const d = settings.digits;
  const customized = Array.isArray(settings.channelList) || settings.customChannels.length > 0;

  const commit = (list, extra = {}) => set({ channelList: list, customChannels: [], ...extra });

  const remove = (id) => {
    const list = channels.filter((c) => c.id !== id);
    const extra = {};
    if (settings.defaultChannel === id) extra.defaultChannel = list[0]?.id || 'sunnah';
    if (settings.lastChannel === id) extra.lastChannel = null;
    commit(list, extra);
    setConfirmDel(null);
  };
  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= channels.length) return;
    const list = [...channels];
    [list[idx], list[j]] = [list[j], list[idx]];
    commit(list);
  };
  const save = (id, data) => {
    if (id === 'new') {
      commit([
        ...channels,
        { id: `c-${Date.now().toString(36)}`, tone: '#9aa0ad', logo: '', short: data.name.replace(/^قناة\s+/, '').split(/\s+/)[0].slice(0, 8), ...data },
      ]);
    } else {
      commit(channels.map((c) => (c.id === id ? { ...c, ...data, short: data.name.replace(/^قناة\s+/, '').split(/\s+/)[0].slice(0, 8) } : c)));
    }
    setEditing(null);
  };

  return (
    <div className="ch-manager">
      <div className="field-label">قنواتك</div>
      {channels.length ? (
        <ol className="ch-rows">
          {channels.map((c, idx) => (
            <li key={c.id} className="ch-row-wrap">
              <div className="ch-row">
                <ChannelBadge channel={c} size="sm" />
                <span className="ch-row-meta">
                  <strong>{c.name}</strong>
                  <span className="muted small">
                    {digitsOf(c.sources.length, d)} {c.sources.length === 1 ? 'رابط' : 'روابط'}
                    {settings.defaultChannel === c.id ? ' · الافتراضية' : ''}
                  </span>
                </span>
                <span className="ch-row-actions">
                  <button className="icon-btn sm" data-nav onClick={() => move(idx, -1)} disabled={idx === 0} aria-label={`نقل ${c.name} للأعلى`}>
                    <span aria-hidden="true">↑</span>
                  </button>
                  <button className="icon-btn sm" data-nav onClick={() => move(idx, 1)} disabled={idx === channels.length - 1} aria-label={`نقل ${c.name} للأسفل`}>
                    <span aria-hidden="true">↓</span>
                  </button>
                  <button className="btn ghost sm" data-nav onClick={() => setEditing(editing === c.id ? null : c.id)}>
                    تعديل
                  </button>
                  {confirmDel === c.id ? (
                    <button className="btn danger sm" data-nav onClick={() => remove(c.id)}>
                      تأكيد الحذف
                    </button>
                  ) : (
                    <button className="icon-btn sm" data-nav onClick={() => setConfirmDel(c.id)} aria-label={`حذف ${c.name}`}>
                      <IconTrash size={18} />
                    </button>
                  )}
                </span>
              </div>
              {editing === c.id ? (
                <ChannelForm initial={c} submitLabel="حفظ التعديل" onSave={(data) => save(c.id, data)} onCancel={() => setEditing(null)} />
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="note">لا توجد قنوات. أضف قناة أو استعد القنوات الأصلية.</p>
      )}

      {editing === 'new' ? (
        <ChannelForm submitLabel="فحص وإضافة" onSave={(data) => save('new', data)} onCancel={() => setEditing(null)} />
      ) : (
        <div className="btn-row">
          <button className="btn" data-nav onClick={() => setEditing('new')}>
            <IconPlus size={20} />
            إضافة قناة
          </button>
          {customized ? (
            <button className="btn ghost" data-nav onClick={() => set({ channelList: null, customChannels: [], defaultChannel: 'sunnah' })}>
              <IconRetry size={18} />
              استعادة القنوات الأصلية
            </button>
          ) : null}
        </div>
      )}
      <p className="muted small">
        الروابط المقبولة: رابط بث ينتهي بـ m3u8، أو رابط بث مباشر من يوتيوب. روابط صفحات المواقع لا تعمل. استخدم روابط رسمية أو مرخّصة فقط.
      </p>
    </div>
  );
}
