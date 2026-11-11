package com.stocksim.learn;

import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ApkUpdaterPlugin.class);
        super.onCreate(savedInstanceState);

        // 返回鍵：先讓網頁關閉開啟中的視窗（說明、搜尋結果），否則回上一頁；
        // 已經在第一頁時把 App 退到背景（不結束，下次開啟仍在原畫面）。
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                final WebView web = getBridge() != null ? getBridge().getWebView() : null;
                if (web == null) {
                    moveTaskToBack(true);
                    return;
                }
                web.evaluateJavascript(
                    "(function(){try{return window.__stocksimBack?window.__stocksimBack():'none'}catch(e){return 'none'}})()",
                    new ValueCallback<String>() {
                        @Override
                        public void onReceiveValue(String value) {
                            if (value != null && value.contains("handled")) return;
                            if (web.canGoBack()) web.goBack();
                            else moveTaskToBack(true);
                        }
                    });
            }
        });
    }
}
