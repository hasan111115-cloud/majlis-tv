/* مجموعة أيقونات خطية موحّدة (سماكة 1.6) — مرسومة يدويًا لتتسق مع الهوية */
const S = ({ children, size = 24, className, title, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={title ? undefined : true}
    role={title ? 'img' : undefined}
    {...rest}
  >
    {title ? <title>{title}</title> : null}
    {children}
  </svg>
);

export const IconSettings = (p) => (
  <S {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </S>
);
export const IconExpand = (p) => (
  <S {...p}>
    <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" />
  </S>
);
export const IconCollapse = (p) => (
  <S {...p}>
    <path d="M9 4v4a1 1 0 0 1-1 1H4M20 9h-4a1 1 0 0 1-1-1V4M15 20v-4a1 1 0 0 1 1-1h4M4 15h4a1 1 0 0 1 1 1v4" />
  </S>
);
export const IconVolume = (p) => (
  <S {...p}>
    <path d="M4 10v4h3l4 3.5v-11L7 10H4Z" />
    <path d="M15 9.2a4 4 0 0 1 0 5.6M17.6 6.8a7.5 7.5 0 0 1 0 10.4" />
  </S>
);
export const IconMute = (p) => (
  <S {...p}>
    <path d="M4 10v4h3l4 3.5v-11L7 10H4Z" />
    <path d="m15.5 9.5 5 5M20.5 9.5l-5 5" />
  </S>
);
export const IconPlay = (p) => (
  <S {...p}>
    <path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" stroke="none" />
  </S>
);
export const IconPause = (p) => (
  <S {...p}>
    <rect x="7" y="5.5" width="3.4" height="13" rx="1" fill="currentColor" stroke="none" />
    <rect x="13.6" y="5.5" width="3.4" height="13" rx="1" fill="currentColor" stroke="none" />
  </S>
);
export const IconRetry = (p) => (
  <S {...p}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
    <path d="M4.5 4.5v3.8h3.8" />
  </S>
);
export const IconExternal = (p) => (
  <S {...p}>
    <path d="M14 4h6v6M20 4l-8.5 8.5" />
    <path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
  </S>
);
export const IconClose = (p) => (
  <S {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </S>
);
export const IconPin = (p) => (
  <S {...p}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.3" />
  </S>
);
export const IconLocate = (p) => (
  <S {...p}>
    <circle cx="12" cy="12" r="6.5" />
    <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
  </S>
);
export const IconSearch = (p) => (
  <S {...p}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="m15 15 5 5" />
  </S>
);
export const IconWifiOff = (p) => (
  <S {...p}>
    <path d="M3 3l18 18M8.5 16.2a5 5 0 0 1 7 0M5.3 12.9a9.6 9.6 0 0 1 4-2.3M14.8 10.6a9.6 9.6 0 0 1 3.9 2.3M2.3 9.5A14 14 0 0 1 6 7.2M10.3 5.6A14 14 0 0 1 21.7 9.5" />
    <circle cx="12" cy="19.5" r=".6" fill="currentColor" />
  </S>
);
export const IconPlus = (p) => (
  <S {...p}>
    <path d="M12 5v14M5 12h14" />
  </S>
);
export const IconMinus = (p) => (
  <S {...p}>
    <path d="M5 12h14" />
  </S>
);
export const IconTrash = (p) => (
  <S {...p}>
    <path d="M5 7h14M10 7V5h4v2M7 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4L17 7" />
  </S>
);
export const IconDrop = (p) => (
  <S {...p}>
    <path d="M12 3.5s-6 6.6-6 10.6a6 6 0 0 0 12 0c0-4-6-10.6-6-10.6Z" />
  </S>
);
export const IconWind = (p) => (
  <S {...p}>
    <path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h7" />
  </S>
);
export const IconUmbrella = (p) => (
  <S {...p}>
    <path d="M3 12a9 9 0 0 1 18 0H3ZM12 12v6.5a2 2 0 0 1-4 0" />
    <path d="M12 3v0" />
  </S>
);
export const IconThermo = (p) => (
  <S {...p}>
    <path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0Z" />
    <path d="M12 10v6" />
  </S>
);
export const IconSunrise = (p) => (
  <S {...p}>
    <path d="M4 18h16M7.5 18a4.5 4.5 0 0 1 9 0M12 4v5M9.5 6.5 12 4l2.5 2.5M4.6 12.6l1.2 1M19.4 12.6l-1.2 1" />
  </S>
);
export const IconSunset = (p) => (
  <S {...p}>
    <path d="M4 18h16M7.5 18a4.5 4.5 0 0 1 9 0M12 4v5M9.5 6.5 12 9l2.5-2.5M4.6 12.6l1.2 1M19.4 12.6l-1.2 1" />
  </S>
);

/* أيقونات الطقس */
const Sun = () => (
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </>
);
const Moon = () => <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" />;
const Cloud = ({ y = 0 }) => (
  <path transform={`translate(0 ${y})`} d="M7.5 18.5h9.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.4A3.3 3.3 0 0 0 7.5 18.5Z" />
);

export function WeatherIcon({ icon = 'cloud', isDay = true, size = 24, className }) {
  const cls = `wx-ico ${className || ''}`;
  if (icon === 'clear') return <S size={size} className={cls}>{isDay ? <Sun /> : <Moon />}</S>;
  if (icon === 'partly')
    return (
      <S size={size} className={cls}>
        {isDay ? (
          <path d="M8.5 4v1.2M3.8 8.5H5M5.2 5.2l.9.9M11.8 5.2l-.9.9M6.2 10.6a3 3 0 0 1 5-3.3" />
        ) : (
          <path d="M11 4.5a4.2 4.2 0 0 0-5.7 5.7A4.2 4.2 0 0 1 11 4.5Z" />
        )}
        <path d="M8.5 19.5h9a3.6 3.6 0 0 0 .4-7.2 5 5 0 0 0-9.6 1.3 3 3 0 0 0 .2 5.9Z" />
      </S>
    );
  if (icon === 'fog')
    return (
      <S size={size} className={cls}>
        <Cloud y={-3} />
        <path d="M4 19h10M8 21.5h12" />
      </S>
    );
  if (icon === 'drizzle' || icon === 'rain')
    return (
      <S size={size} className={cls}>
        <Cloud y={-3} />
        {icon === 'rain' ? <path d="M8.5 18.5 7.5 21M12.5 18.5l-1 2.5M16.5 18.5l-1 2.5" /> : <path d="M9 19v.6M13 19.5v.6M17 19v.6M11 21.6v.4M15 21.6v.4" />}
      </S>
    );
  if (icon === 'snow')
    return (
      <S size={size} className={cls}>
        <Cloud y={-3} />
        <path d="M8.5 19.5h.01M12.5 20.5h.01M16.5 19.5h.01M10.5 22h.01M14.5 22h.01" strokeWidth="2.4" />
      </S>
    );
  if (icon === 'storm')
    return (
      <S size={size} className={cls}>
        <Cloud y={-3} />
        <path d="m12.5 17-2 3.2h3l-2 3" />
      </S>
    );
  return <S size={size} className={cls}><Cloud /></S>;
}
