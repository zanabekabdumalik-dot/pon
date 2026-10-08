package com.gappo.game;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;

/**
 * Обёртка игры: страница из assets/www открывается в WebView по виртуальному
 * https-адресу (без него браузерный движок не даёт доступ к микрофону).
 * Ещё здесь разрешение на микрофон, выбор фото из галереи и системный синтез речи.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/index.html";
    private static final int REQ_MIC = 1;
    private static final int REQ_FILE = 2;
    private static final int BG = Color.rgb(0x24, 0x1a, 0x33);

    private WebView web;
    private PermissionRequest pendingMic;
    private ValueCallback<Uri[]> pendingFile;
    private TextToSpeech tts;
    private volatile boolean ttsReady;
    private int utterance;

    @Override
    protected void onCreate(Bundle state) {
        setTheme(android.R.style.Theme_DeviceDefault_NoActionBar);
        super.onCreate(state);
        Window w = getWindow();
        w.setStatusBarColor(BG);
        w.setNavigationBarColor(Color.rgb(0x2b, 0x1d, 0x3a));
        setVolumeControlStream(AudioManager.STREAM_MUSIC);

        web = new WebView(this);
        web.setBackgroundColor(BG);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setTextZoom(100);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (!HOST.equals(u.getHost())) return null;
                String path = u.getPath();
                if (path == null || path.equals("/")) path = "/index.html";
                String type = mime(path);
                try {
                    InputStream in = getAssets().open("www" + path);
                    return new WebResourceResponse(type, type.startsWith("text/") ? "utf-8" : null, in);
                } catch (Exception e) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<String, String>(), null);
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (HOST.equals(u.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception ignored) {
                }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest req) {
                runOnUiThread(new Runnable() {
                    public void run() {
                        handleMic(req);
                    }
                });
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (pendingFile != null) pendingFile.onReceiveValue(null);
                pendingFile = cb;
                try {
                    startActivityForResult(params.createIntent(), REQ_FILE);
                    return true;
                } catch (Exception e) {
                    pendingFile = null;
                    return false;
                }
            }
        });

        web.addJavascriptInterface(new Bridge(), "GappoAndroid");

        tts = new TextToSpeech(this, new TextToSpeech.OnInitListener() {
            public void onInit(int status) {
                if (status != TextToSpeech.SUCCESS) return;
                int r = tts.setLanguage(new Locale("ru", "RU"));
                if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) return;
                tts.setPitch(2.0f);
                tts.setSpeechRate(1.15f);
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override
                    public void onStart(String id) {
                        js("start");
                    }

                    @Override
                    public void onDone(String id) {
                        js("end");
                    }

                    @Override
                    public void onError(String id) {
                        js("error");
                    }

                    @Override
                    public void onStop(String id, boolean interrupted) {
                        js("end");
                    }
                });
                ttsReady = true;
            }
        });

        if (state == null || web.restoreState(state) == null) web.loadUrl(START);
    }

    private void handleMic(PermissionRequest req) {
        boolean audio = false;
        for (String r : req.getResources()) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) audio = true;
        }
        if (!audio) {
            req.deny();
            return;
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            req.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            return;
        }
        if (pendingMic != null) pendingMic.deny();
        pendingMic = req;
        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        if (code != REQ_MIC || pendingMic == null) return;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
            pendingMic.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        } else {
            pendingMic.deny();
        }
        pendingMic = null;
    }

    @Override
    protected void onActivityResult(int code, int result, Intent data) {
        if (code == REQ_FILE && pendingFile != null) {
            pendingFile.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            pendingFile = null;
            return;
        }
        super.onActivityResult(code, result, data);
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.gappoBack ? window.gappoBack() : false", new ValueCallback<String>() {
            public void onReceiveValue(String handled) {
                if (!"true".equals(handled)) finish();
            }
        });
    }

    @Override
    protected void onPause() {
        web.evaluateJavascript("window.gappoPause && window.gappoPause()", null);
        if (ttsReady) tts.stop();
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onDestroy() {
        if (tts != null) tts.shutdown();
        web.destroy();
        super.onDestroy();
    }

    private void js(final String event) {
        web.post(new Runnable() {
            public void run() {
                web.evaluateJavascript("window.__gappoTTS && window.__gappoTTS('" + event + "')", null);
            }
        });
    }

    private static String mime(String p) {
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".js")) return "text/javascript";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }

    /** Мост для страницы: системный синтез речи высоким «голосом Гаппо». */
    private class Bridge {
        @JavascriptInterface
        public boolean ttsAvailable() {
            return ttsReady;
        }

        @JavascriptInterface
        public void speak(String text) {
            if (!ttsReady) {
                js("error");
                return;
            }
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "g" + (++utterance));
        }

        @JavascriptInterface
        public void stop() {
            if (ttsReady) tts.stop();
        }
    }
}
