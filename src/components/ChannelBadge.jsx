import { useState } from 'react';

/* شارة القناة: الشعار الرسمي إن أُضيف رابطه في ملف القنوات،
   وإلا لوحة طباعية باسم القناة — لا نرسم شعارات تقلّد الشعارات الأصلية. */
export default function ChannelBadge({ channel, size = 'md' }) {
  const [broken, setBroken] = useState(false);
  const useLogo = channel.logo && !broken;
  return (
    <span className={`ch-badge ch-badge-${size}`} style={{ '--tone': channel.tone }} aria-hidden="true">
      {useLogo ? (
        <img src={channel.logo} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
      ) : (
        <span className="ch-badge-txt">{channel.short}</span>
      )}
    </span>
  );
}
