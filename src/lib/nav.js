/* تنقّل مكاني بأسهم الريموت/لوحة المفاتيح.
   كل عنصر قابل للتحديد يحمل data-nav. إذا كانت هناك طبقة مفتوحة (data-nav-scope)
   يقتصر التنقل على العناصر داخل آخر طبقة مفتوحة. */

const DIRS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

function visible(el) {
  if (el.disabled) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none';
}

function scopeRoot() {
  const scopes = document.querySelectorAll('[data-nav-scope]');
  return scopes.length ? scopes[scopes.length - 1] : document;
}

export function candidates() {
  return [...scopeRoot().querySelectorAll('[data-nav]')].filter(visible);
}

function center(r) {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function moveFocus(dir) {
  const list = candidates();
  if (!list.length) return false;
  const cur = document.activeElement;
  if (!cur || !list.includes(cur)) {
    const pref = scopeRoot().querySelector('[data-nav-default]') || list[0];
    pref.focus({ preventScroll: false });
    return true;
  }
  const a = cur.getBoundingClientRect();
  const ac = center(a);
  let best = null;
  let bestScore = Infinity;
  for (const el of list) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    const bc = center(b);
    let primary, ortho;
    if (dir === 'up') { if (b.bottom > a.top + 4 && bc.y >= ac.y) continue; primary = ac.y - bc.y; ortho = Math.abs(ac.x - bc.x); }
    if (dir === 'down') { if (b.top < a.bottom - 4 && bc.y <= ac.y) continue; primary = bc.y - ac.y; ortho = Math.abs(ac.x - bc.x); }
    if (dir === 'left') { if (b.right > a.left + 4 && bc.x >= ac.x) continue; primary = ac.x - bc.x; ortho = Math.abs(ac.y - bc.y); }
    if (dir === 'right') { if (b.left < a.right - 4 && bc.x <= ac.x) continue; primary = bc.x - ac.x; ortho = Math.abs(ac.y - bc.y); }
    if (primary <= 0) continue;
    const score = primary + ortho * 2.2;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) {
    best.focus({ preventScroll: true });
    best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return true;
  }
  return false;
}

const BACK_KEYS = new Set(['Escape', 'GoBack', 'BrowserBack', 'Back']);
const BACK_CODES = new Set([461, 10009, 27]); // LG webOS, Samsung Tizen

export function isBackKey(e) {
  return BACK_KEYS.has(e.key) || BACK_CODES.has(e.keyCode);
}

export function isTyping(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    const t = (el.type || 'text').toLowerCase();
    return !['button', 'checkbox', 'radio', 'submit', 'reset'].includes(t);
  }
  return false;
}

/** يعالج الأسهم: يعيد true إذا استُهلك المفتاح */
export function handleArrow(e) {
  const dir = DIRS[e.key];
  if (!dir) return false;
  const typing = isTyping(document.activeElement);
  if (typing && (dir === 'left' || dir === 'right')) return false;
  const moved = moveFocus(dir);
  if (moved) e.preventDefault();
  return moved;
}
