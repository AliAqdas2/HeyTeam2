package ai.heyteam.portal;

import android.net.http.SslError;
import android.os.Handler;
import android.os.Looper;
import android.webkit.SslErrorHandler;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Bridge;

public class MainActivity extends BridgeActivity {
    private WebViewClient sslAwareWebViewClient;
    
    @Override
    public void onResume() {
        super.onResume();
        
        // Configure WebView to handle SSL errors for portal.heyteam.ai
        // Use a delayed post to ensure Capacitor's bridge is fully initialized
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                configureWebViewSsl();
            }
        }, 500); // Small delay to ensure Capacitor has set up its WebViewClient
    }
    
    private void configureWebViewSsl() {
        Bridge bridge = this.getBridge();
        if (bridge == null) {
            return;
        }
        
        WebView webView = bridge.getWebView();
        if (webView == null) {
            return;
        }
        
        // Create a WebViewClient that handles SSL errors for our domain
        // This will be set after Capacitor initializes, so it will override Capacitor's client
        // We only override onReceivedSslError - other methods use default behavior
        if (sslAwareWebViewClient == null) {
            sslAwareWebViewClient = new WebViewClient() {
                @Override
                public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                    String url = error.getUrl();
                    // Only bypass SSL errors for portal.heyteam.ai and heyteam.ai
                    if (url != null && (url.contains("portal.heyteam.ai") || url.contains("heyteam.ai"))) {
                        // Proceed with the connection despite SSL error
                        // This allows the connection even if certificate chain validation fails
                        handler.proceed();
                    } else {
                        // For other domains, cancel the connection (default behavior)
                        handler.cancel();
                    }
                }
            };
        }
        
        webView.setWebViewClient(sslAwareWebViewClient);
    }
}
