/* شعار «مجلس»: شاشة بزوايا ناعمة يقوم داخلها قوس — إطلالة البيت على البث،
   ونقطة صغيرة أسفلها ترمز إلى حضور الخدمات اليومية. */
export default function Logo({ compact = false }) {
  return (
    <div className="logo" aria-label="مجلس">
      <svg className="logo-mark" viewBox="0 0 40 40" aria-hidden="true">
        <rect x="3.5" y="6" width="33" height="24" rx="6.5" fill="none" stroke="var(--gold)" strokeWidth="2" />
        <path d="M14 30v-8.5a6 6 0 0 1 12 0V30" fill="none" stroke="var(--fg)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="20" cy="35" r="1.8" fill="var(--gold)" />
      </svg>
      {!compact && (
        <div className="logo-type">
          <span className="logo-ar">مجلس</span>
          <span className="logo-en">MAJLIS</span>
        </div>
      )}
    </div>
  );
}
