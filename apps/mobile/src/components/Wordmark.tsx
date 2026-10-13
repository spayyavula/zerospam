import React from 'react';
import { Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

/** Zero·Spam in the display serif with the signal-yellow dot, as on the website. */
export default function Wordmark({ size = 28 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel="ZeroSpam"
      style={{ fontFamily: fonts.displayItalic, fontSize: size, color: colors.ink, letterSpacing: -0.5 }}
    >
      Zero<Text style={{ color: colors.signal, fontStyle: 'normal' }}>·</Text>Spam
    </Text>
  );
}
