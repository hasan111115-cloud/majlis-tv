package sa.majlis.tv;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * تطبيق «مجلس» للتلفزيون: يعرض واجهة مجلس (المضمّنة داخل التطبيق) بملء الشاشة.
 * - زر الرجوع: يُرسل للواجهة كأنه Escape (يغلق القوائم).
 * - ضغطة مطوّلة على الرجوع، أو زر القائمة: قائمة تطبيقات التلفزيون والإعدادات.
 */
public class MainActivity extends Activity {

    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/assets/index.html";
    private static final int REQ_LOCATION = 7;

    private FrameLayout root;
    private WebView web;
    private WebViewAssetLoader assets;

    private View customView;
    private WebChromeClient.CustomViewCallback customCallback;

    private GeolocationPermissions.Callback geoCallback;
    private String geoOrigin;

    private boolean backLongPressed = false;
    private boolean unloadedInBackground = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(10, 10, 12));
        setContentView(root);

        assets = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(10, 10, 12));
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);           // الصوت يبدأ تلقائيًا
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW); // بث http بجودة 720p
        s.setGeolocationEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);

        web.addJavascriptInterface(new Bridge(), "MajlisApp");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());

        web.loadUrl(START_URL);
        web.requestFocus();
        hideSystemUi();
    }

    /* ---------- الواجهة ← التطبيق ---------- */

    private class Bridge {
        @JavascriptInterface
        public void openApps() { runOnUiThread(MainActivity.this::showApps); }

        @JavascriptInterface
        public void openSettings() { runOnUiThread(MainActivity.this::openTvSettings); }

        @JavascriptInterface
        public String version() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (Exception e) {
                return "";
            }
        }
    }

    private class Client extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            return assets.shouldInterceptRequest(request.getUrl());
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            if (!request.isForMainFrame()) return false;
            Uri u = request.getUrl();
            if (HOST.equals(u.getHost())) return false;
            // الروابط الخارجية (مثل «الموقع الرسمي») تُفتح في متصفح التلفزيون إن وُجد
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, u));
            } catch (ActivityNotFoundException e) {
                Toast.makeText(MainActivity.this, "لا يوجد متصفح على التلفزيون لفتح الرابط", Toast.LENGTH_LONG).show();
            }
            return true;
        }
    }

    private class Chrome extends WebChromeClient {
        @Override
        public void onShowCustomView(View view, CustomViewCallback callback) {
            if (customView != null) { callback.onCustomViewHidden(); return; }
            customView = view;
            customCallback = callback;
            root.addView(view, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            web.setVisibility(View.GONE);
            hideSystemUi();
        }

        @Override
        public void onHideCustomView() { exitFullscreen(); }

        @Override
        public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
            if (Build.VERSION.SDK_INT < 23
                    || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                callback.invoke(origin, true, false);
                return;
            }
            geoOrigin = origin;
            geoCallback = callback;
            requestPermissions(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOCATION);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        if (requestCode == REQ_LOCATION && geoCallback != null) {
            boolean ok = results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED;
            geoCallback.invoke(geoOrigin, ok, false);
            geoCallback = null;
        }
    }

    private void exitFullscreen() {
        if (customView == null) return;
        root.removeView(customView);
        customView = null;
        web.setVisibility(View.VISIBLE);
        web.requestFocus();
        if (customCallback != null) customCallback.onCustomViewHidden();
        customCallback = null;
        hideSystemUi();
    }

    /* ---------- أزرار الريموت ---------- */

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (event.getRepeatCount() == 0) {
                backLongPressed = false;
                event.startTracking();
            }
            return true;
        }
        if (keyCode == KeyEvent.KEYCODE_MENU) {
            showApps();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public boolean onKeyLongPress(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            backLongPressed = true;
            showApps();
            return true;
        }
        return super.onKeyLongPress(keyCode, event);
    }

    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (backLongPressed || event.isCanceled()) {
                backLongPressed = false;
                return true;
            }
            if (customView != null) {
                exitFullscreen();
            } else {
                web.evaluateJavascript(
                        "(document.activeElement||document.body).dispatchEvent(new KeyboardEvent('keydown',"
                                + "{key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true,cancelable:true}));",
                        null);
            }
            return true;
        }
        return super.onKeyUp(keyCode, event);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // يُعالَج في onKeyUp؛ لا نغلق التطبيق لأنه قد يكون الواجهة الرئيسية
    }

    /* ---------- قائمة التطبيقات ---------- */

    private void showApps() {
        final PackageManager pm = getPackageManager();
        Intent q = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER);
        List<ResolveInfo> found = pm.queryIntentActivities(q, 0);
        final List<ResolveInfo> apps = new ArrayList<>();
        for (ResolveInfo r : found) {
            if (!getPackageName().equals(r.activityInfo.packageName)) apps.add(r);
        }
        Collections.sort(apps, (a, b) ->
                String.valueOf(a.loadLabel(pm)).compareToIgnoreCase(String.valueOf(b.loadLabel(pm))));

        final String[] labels = new String[apps.size() + 1];
        labels[0] = "⚙  إعدادات التلفزيون";
        for (int i = 0; i < apps.size(); i++) labels[i + 1] = String.valueOf(apps.get(i).loadLabel(pm));

        new AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                .setTitle("التطبيقات")
                .setItems(labels, (d, which) -> {
                    if (which == 0) { openTvSettings(); return; }
                    ResolveInfo r = apps.get(which - 1);
                    Intent launch = pm.getLeanbackLaunchIntentForPackage(r.activityInfo.packageName);
                    if (launch == null) launch = pm.getLaunchIntentForPackage(r.activityInfo.packageName);
                    if (launch != null) {
                        try { startActivity(launch); } catch (Exception ignored) { }
                    }
                })
                .setNegativeButton("رجوع", null)
                .show();
    }

    private void openTvSettings() {
        try {
            startActivity(new Intent(Settings.ACTION_SETTINGS));
        } catch (Exception e) {
            Toast.makeText(this, "تعذّر فتح الإعدادات", Toast.LENGTH_SHORT).show();
        }
    }

    /* ---------- دورة الحياة ---------- */

    @Override
    protected void onStart() {
        super.onStart();
        web.onResume();
        if (unloadedInBackground) {
            unloadedInBackground = false;
            web.loadUrl(START_URL); // نعيد تشغيل البث عند الرجوع للتطبيق
        }
    }

    @Override
    protected void onStop() {
        // عند فتح تطبيق آخر نوقف البث حتى لا يستمر الصوت في الخلفية
        exitFullscreen();
        web.loadUrl("about:blank");
        unloadedInBackground = true;
        web.onPause();
        super.onStop();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // ضغط زر الهوم وهو مفتوح: نغلق أي قائمة مفتوحة فقط
        exitFullscreen();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            root.removeView(web);
            web.destroy();
        }
        super.onDestroy();
    }

    @SuppressWarnings("deprecation")
    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }
}
