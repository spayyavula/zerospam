import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Wordmark from '../../components/Wordmark';
import Mark from '../../components/Mark';
import { Text } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/tokens';

export default function AuthLayout({
  title,
  subtitle,
  children,
  showMark = true,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showMark?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.paper }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: space.xl,
          paddingTop: insets.top + space.xl,
          paddingBottom: insets.bottom + space.xl,
        }}
      >
        <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', gap: space.lg }}>
          {showMark ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Mark size={56} color={colors.ink} gap={colors.paper} />
              <Wordmark size={30} />
            </View>
          ) : null}
          <View style={{ gap: space.sm, marginBottom: space.sm }}>
            <Text variant="display">{title}</Text>
            {subtitle ? <Text variant="body" tone="soft">{subtitle}</Text> : null}
          </View>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
