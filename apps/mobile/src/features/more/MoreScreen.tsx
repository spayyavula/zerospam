import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import FolderSheet from '../../components/FolderSheet';
import { Divider, Row, SectionHeader, Text } from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { useActiveMailbox, useMailboxStore } from '../../stores/mailboxStore';
import { useTheme, type ThemeChoice } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { PRIVACY_URL, TERMS_URL, WEB_URL } from '../../config';

function ThemePicker() {
  const { colors, choice, setChoice } = useTheme();
  const options: { value: ThemeChoice; label: string }[] = [
    { value: 'system', label: 'Automatic' },
    { value: 'light', label: 'Day' },
    { value: 'dark', label: 'Night' },
  ];
  return (
    <View style={{ flexDirection: 'row', marginHorizontal: space.lg, borderWidth: 1, borderColor: colors.rule, borderRadius: radius.sm, overflow: 'hidden' }}>
      {options.map((o, i) => {
        const selected = o.value === choice;
        return (
          <Pressable
            key={o.value}
            onPress={() => setChoice(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? colors.ink : colors.paper,
              borderLeftWidth: i === 0 ? 0 : 1,
              borderLeftColor: colors.rule,
            }}
          >
            <Text variant="small" style={{ color: selected ? colors.paper : colors.ink, fontWeight: selected ? '600' : '400' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function planLine(b: ReturnType<typeof useAuthStore.getState>['billing']): string | null {
  if (!b || !b.enabled || b.exempt) return null;
  if (b.subscribed) {
    if (b.cancelAtPeriodEnd && b.currentPeriodEnd) {
      return `Plan ends ${new Date(b.currentPeriodEnd).toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    }
    return 'Plan active';
  }
  if (b.trialDaysLeft != null) {
    return b.trialDaysLeft <= 1 ? 'Free trial ends today' : `Free trial · ${b.trialDaysLeft} days left`;
  }
  return null;
}

export default function MoreScreen({ extraSections }: { extraSections?: React.ReactNode }) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const billing = useAuthStore((s) => s.billing);
  const logout = useAuthStore((s) => s.logout);
  const mailbox = useActiveMailbox();
  const mailboxCount = useMailboxStore((s) => s.mailboxes.length);
  const [sheet, setSheet] = useState(false);
  const web = (path = '') => void WebBrowser.openBrowserAsync(`${WEB_URL}${path}`);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={{ paddingBottom: space.xxl }}>
      <SectionHeader title="Account" />
      <Row icon="person-circle-outline" title={user?.email ?? 'Signed in'} subtitle={planLine(billing)} />
      <Divider inset={52} />
      <Row
        icon="at-outline"
        title={mailbox?.address ?? 'Mailbox'}
        subtitle={mailboxCount > 1 ? 'Tap to switch mailbox' : 'Your ZeroSpam address'}
        onPress={mailboxCount > 1 ? () => setSheet(true) : undefined}
      />

      <SectionHeader title="Appearance" />
      <ThemePicker />

      {extraSections}

      <SectionHeader title="On the website" />
      <Text variant="small" tone="quiet" style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
        These settings open zero-spam.email in your browser.
      </Text>
      <Row icon="shield-checkmark-outline" title="Approved senders and rules" onPress={() => web()} />
      <Divider inset={52} />
      <Row icon="newspaper-outline" title="Daily digest" onPress={() => web()} />
      <Divider inset={52} />
      <Row icon="key-outline" title="Password and two-factor sign-in" onPress={() => web()} />
      <Divider inset={52} />
      <Row icon="link-outline" title="Connected Gmail and Outlook" onPress={() => web()} />

      <SectionHeader title="About" />
      <Row icon="document-text-outline" title="Privacy Policy" onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_URL)} />
      <Divider inset={52} />
      <Row icon="document-outline" title="Terms of Service" onPress={() => void WebBrowser.openBrowserAsync(TERMS_URL)} />
      <Divider inset={52} />
      <Row icon="information-circle-outline" title="Version" right={<Text variant="small" tone="quiet">{Constants.expoConfig?.version ?? '—'}</Text>} />

      <View style={{ height: space.xl }} />
      <Divider />
      <Row
        icon="log-out-outline"
        title="Sign out of this phone"
        danger
        right={<View />}
        onPress={() =>
          Alert.alert('Sign out?', 'This phone stops receiving your mail and notifications until you sign in again.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: () => void logout() },
          ])
        }
      />
      <Divider />
      <FolderSheet visible={sheet} onClose={() => setSheet(false)} showFolders={false} />
    </ScrollView>
  );
}
