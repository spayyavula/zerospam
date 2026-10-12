import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { buildMessageHtml, buildTextHtml, type ImageMap } from '../../lib/messageHtml';
import { API_BASE_URL } from '../../config';

// Web preview only (`expo start --web`): react-native-webview has no web implementation,
// so render the same locked-down document in a sandboxed iframe.
export default function MessageBody({
  html,
  text,
  images,
}: {
  html: string | null;
  text: string | null;
  images: ImageMap | null;
  onMailto: (address: string) => void;
}) {
  const { colors } = useTheme();
  const doc = useMemo(() => {
    const origin = new URL(API_BASE_URL).origin;
    if (html) return buildMessageHtml(html, { colors, images: images ? { map: images, origin } : null });
    return buildTextHtml(text ?? '', colors);
  }, [html, text, images, colors]);
  return (
    <View style={{ flex: 1 }}>
      {React.createElement('iframe', {
        title: 'Message',
        sandbox: 'allow-popups allow-popups-to-escape-sandbox',
        srcDoc: doc,
        style: { border: 0, width: '100%', height: '100%', background: colors.paper },
      })}
    </View>
  );
}
