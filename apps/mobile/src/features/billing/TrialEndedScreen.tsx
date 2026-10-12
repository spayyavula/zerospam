import React, { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Wordmark from '../../components/Wordmark';
import { Button, Text } from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/tokens';

/**
 * Shown instead of the app when the account's free trial has ended without a subscription.
 *
 * Google Play policy: an app may not sell, price, or link to a non-Play payment flow for
 * a digital service. So this screen states the situation and nothing more — no prices,
 * no buttons to checkout, no "subscribe on the web" call to action.
 */
export default function TrialEndedScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const refresh = useAuthStore((s) => s.refreshBilling);
  const logout = useAuthStore((s) => s.logout);
  const [checking, setChecking] = useState(false);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.paper,
        paddingHorizontal: space.xl,
        paddingTop: insets.top + space.xxl,
        paddingBottom: insets.bottom + space.xl,
        gap: space.lg,
      }}
    >
      <Wordmark size={26} />
      <View style={{ flex: 1, justifyContent: 'center', gap: space.lg, maxWidth: 440 }}>
        <Text variant="display">Your free trial has ended.</Text>
        <Text variant="body" tone="soft">
          Your mail is still arriving and nothing has been deleted{user?.email ? ` for ${user.email}` : ''}. The
          account needs an active plan before mail can be read in the app.
        </Text>
        <Text variant="small" tone="quiet">Plans can’t be managed in this app.</Text>
      </View>
      <Button
        title="I’ve updated my account — check again"
        kind="secondary"
        loading={checking}
        onPress={async () => {
          setChecking(true);
          await refresh();
          setChecking(false);
        }}
      />
      <Button title="Sign out" kind="ghost" onPress={() => void logout()} />
    </View>
  );
}
