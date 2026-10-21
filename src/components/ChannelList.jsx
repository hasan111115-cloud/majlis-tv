import ChannelBadge from './ChannelBadge.jsx';
import { digitsOf } from '../lib/time.js';

const STATUS = {
  playing: { cls: 'ok', text: 'يعمل' },
  error: { cls: 'bad', text: 'تعذّر التشغيل' },
};

export default function ChannelList({ channels, activeId, statuses, onSelect, digits }) {
  return (
    <nav className="channels" aria-label="القنوات">
      <div className="channels-head">
        <span>القنوات</span>
        <span className="muted small">{digitsOf(channels.length, digits)}</span>
      </div>
      <ul className="channels-list" role="list">
        {channels.map((c, i) => {
          const active = c.id === activeId;
          const st = STATUS[statuses[c.id]];
          return (
            <li key={c.id}>
              <button
                className={`ch-card ${active ? 'active' : ''}`}
                data-nav
                {...(active ? { 'data-nav-default': '' } : {})}
                aria-current={active ? 'true' : undefined}
                onClick={() => onSelect(c.id)}
                style={{ '--tone': c.tone }}
              >
                <ChannelBadge channel={c} />
                <span className="ch-meta">
                  <span className="ch-name">{c.name}</span>
                  <span className="ch-sub">
                    {active ? <span className="ch-now">قيد العرض</span> : null}
                    {st ? <span className={`ch-status ${st.cls}`}>{st.text}</span> : null}
                    {!active && !st ? <span className="muted">بث مباشر</span> : null}
                  </span>
                </span>
                {i < 9 ? <kbd className="ch-key">{digitsOf(i + 1, digits)}</kbd> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
