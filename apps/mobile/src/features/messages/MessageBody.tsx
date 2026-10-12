import React, { useMemo } from 'react';
import { Linking, Platform, View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '../../theme/ThemeProvider';
import { buildMessageHtml, buildTextHtml, type ImageMap } from '../../lib/messageHtml';
import { API_BASE_URL } from '../../config';

const API_ORIGIN = new URL(API_BASE_URL).origin;

/**
 * Renders a message body. JavaScript is off, nothing loads from the network unless the
 * reader asked for images (and then only from our proxy), and every link leaves the
 * WebView: http(s) opens in the in-app browser, mailto: opens Compose.
 */
export default function MessageBody({
  html,
  text,
  images,
  onMailto,
}: {
  html: string | null;
  text: string | null;
  images: ImageMap | null;
  onMailto: (address: string) => void;
}) {
  const { colors } = useTheme();
  const doc = useMemo(() => {
    if (html) return buildMessageHtml(html, { colors, images: images ? { map: images, origin: API_ORIGIN } : null });
    return buildTextHtml(text ?? '', colors);
  }, [html, text, images, colors]);

  const onNavigate = (req: WebViewNavigation): boolean => {
    const url = req.url;
    // The document itself.
    if (url === 'about:blank' || url.startsWith('data:') || url.startsWith('about:srcdoc')) return true;
    if (/^mailto:/i.test(url)) {
      const addr = decodeURIComponent(url.replace(/^mailto:/i, '').split('?')[0] ?? '');
      onMailto(addr);
    } else if (/^https?:/i.test(url)) {
      void WebBrowser.openBrowserAsync(url, { showTitle: true, enableBarCollapsing: true }).catch(() => Linking.openURL(url));
    } else if (/^tel:|^sms:|^geo:/i.test(url)) {
      void Linking.openURL(url).catch(() => {});
    }
    return false;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <WebView
        // Re-mount when the theme or images change so the new document is used as-is.
        key={`${colors.paper}-${images ? 'img' : 'noimg'}`}
        originWhitelist={['*']}
        source={{ html: doc }}
        javaScriptEnabled={false}
        domStorageEnabled={false}
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        setSupportMultipleWindows={false}
        thirdPartyCookiesEnabled={false}
        sharedCookiesEnabled={false}
        incognito
        mixedContentMode="never"
        cacheEnabled={false}
        setBuiltInZoomControls
        setDisplayZoomControls={false}
        onShouldStartLoadWithRequest={onNavigate}
        style={{ flex: 1, backgroundColor: colors.paper }}
        // Android: avoid the WebView flashing white before the first paint in dark mode.
        androidLayerType={Platform.OS === 'android' ? 'hardware' : undefined}
      />
    </View>
  );
}
