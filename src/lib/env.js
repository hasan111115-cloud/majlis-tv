/** داخل تطبيق «مجلس» للتلفزيون (أندرويد تي في) يُسمح بروابط http حتى لو كانت الصفحة https،
 *  فيعمل بث الهيئة بجودة 720p. في المتصفح العادي يمنعها المتصفح (Mixed content). */
export const inTvApp = typeof window !== 'undefined' && typeof window.MajlisApp !== 'undefined';

export function blocksHttp() {
  if (inTvApp) return false;
  return typeof location !== 'undefined' && location.protocol === 'https:';
}
