import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '../lib/toast';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './ui';

export default function ToastHost() {
  const message = useToastStore((s) => s.message);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  if (!message) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 72, alignItems: 'center' }}
    >
      <View style={{ backgroundColor: colors.ink, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, maxWidth: 480 }}>
        <Text variant="small" style={{ color: colors.paper }}>{message}</Text>
      </View>
    </View>
  );
}
