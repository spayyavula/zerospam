import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Button, Text, TextField } from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { useActiveMailbox } from '../../stores/mailboxStore';
import { apiClient, errorText } from '../../lib/apiClient';
import { clearDeviceToken } from '../../lib/secureStore';
import { toast } from '../../lib/toast';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/tokens';

export default function DeleteAccountScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const mailbox = useActiveMailbox();
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiClient.post('/api/account/delete', { password, ...(user?.totp_enabled ? { totp } : {}) });
      await clearDeviceToken();
      useAuthStore.setState({ status: 'unauthenticated', user: null, locked: false, billing: null });
      toast('Your account was deleted');
    } catch (e) {
      setError(errorText(e, 'Could not delete the account. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    if (!password) return setError('Enter your password.');
    if (user?.totp_enabled && !/^\d{6}$/.test(totp)) return setError('Enter the 6-digit code from your authenticator app.');
    Alert.alert('Delete everything?', 'Your mailboxes, all mail, and aliases will be permanently deleted. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete account', style: 'destructive', onPress: () => void run() },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
      <Text variant="title">Delete your account</Text>
      <View style={{ gap: space.sm }}>
        <Text variant="body" tone="soft">This permanently deletes:</Text>
        <Text variant="small" tone="soft">
          {`•  ${mailbox?.address ?? 'Your mailbox'} and every message in it\n•  All your aliases and forwarding addresses\n•  Approved senders, rules, and drafts\n•  Connected Gmail and Outlook accounts`}
        </Text>
        <Text variant="small" tone="quiet">
          Any paid plan is cancelled first. Your addresses are retired and never given to anyone else.
        </Text>
      </View>
      <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" error={user?.totp_enabled ? null : error} />
      {user?.totp_enabled ? (
        <TextField label="2FA code" value={totp} onChangeText={(v) => setTotp(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} error={error} />
      ) : null}
      <Button kind="danger" icon="trash-outline" title="Delete account" onPress={confirm} loading={busy} />
    </ScrollView>
  );
}
