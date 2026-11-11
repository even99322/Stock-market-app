package com.stocksim.learn;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import androidx.core.content.pm.PackageInfoCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * 自動更新：下載 GitHub Release 上的 APK，交給系統安裝程式。
 * Android 不允許一般 App 靜默安裝，最後一步需要使用者按「更新」。
 */
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {
    private volatile boolean busy = false;

    @PluginMethod
    public void getVersion(PluginCall call) {
        try {
            Context ctx = getContext();
            PackageInfo pi = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
            JSObject r = new JSObject();
            r.put("versionName", pi.versionName);
            r.put("versionCode", PackageInfoCompat.getLongVersionCode(pi));
            call.resolve(r);
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void canInstall(PluginCall call) {
        boolean allowed = Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls();
        JSObject r = new JSObject();
        r.put("allowed", allowed);
        call.resolve(r);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 26) {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        }
        call.resolve();
    }

    /** 已下載過的 APK 直接再次開啟安裝畫面 */
    @PluginMethod
    public void installDownloaded(PluginCall call) {
        File f = apkFile();
        if (!f.exists()) {
            call.reject("尚未下載");
            return;
        }
        try {
            install(f);
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void downloadAndInstall(final PluginCall call) {
        final String url = call.getString("url");
        if (url == null) {
            call.reject("missing url");
            return;
        }
        if (busy) {
            call.reject("正在下載中");
            return;
        }
        busy = true;
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    File out = apkFile();
                    File dir = out.getParentFile();
                    if (dir != null && !dir.exists()) dir.mkdirs();
                    if (out.exists()) out.delete();
                    download(url, out);
                    install(out);
                    call.resolve();
                } catch (Exception e) {
                    call.reject("下載失敗：" + e.getMessage());
                } finally {
                    busy = false;
                }
            }
        }).start();
    }

    private File apkFile() {
        return new File(new File(getContext().getCacheDir(), "updates"), "update.apk");
    }

    private void download(String urlStr, File out) throws Exception {
        HttpURLConnection conn = null;
        String current = urlStr;
        for (int i = 0; i < 6; i++) {
            conn = (HttpURLConnection) new URL(current).openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(20000);
            conn.setReadTimeout(30000);
            conn.setRequestProperty("User-Agent", "StockSim-Android");
            conn.setRequestProperty("Accept", "application/octet-stream");
            int code = conn.getResponseCode();
            if (code >= 300 && code < 400) {
                String loc = conn.getHeaderField("Location");
                conn.disconnect();
                if (loc == null) throw new Exception("redirect without location");
                current = new URL(new URL(current), loc).toString();
                continue;
            }
            if (code != 200) throw new Exception("HTTP " + code);
            break;
        }
        if (conn == null) throw new Exception("no connection");
        int total = conn.getContentLength();
        InputStream in = conn.getInputStream();
        OutputStream os = new FileOutputStream(out);
        try {
            byte[] buf = new byte[64 * 1024];
            long done = 0;
            int lastPct = -1;
            int n;
            while ((n = in.read(buf)) != -1) {
                os.write(buf, 0, n);
                done += n;
                if (total > 0) {
                    int pct = (int) (done * 100 / total);
                    if (pct != lastPct) {
                        lastPct = pct;
                        JSObject p = new JSObject();
                        p.put("percent", pct);
                        notifyListeners("progress", p);
                    }
                }
            }
        } finally {
            os.close();
            in.close();
            conn.disconnect();
        }
    }

    private void install(File f) {
        Context ctx = getContext();
        Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", f);
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(uri, "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(i);
    }
}
