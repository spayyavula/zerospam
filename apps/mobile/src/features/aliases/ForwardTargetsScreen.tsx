import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Button, Chip, Divider, ErrorState, Loading, SectionHeader, Text, TextField } from '../../components/ui';
import { useAddForwardTarget, useDeleteForwardTarget, useForwardTargets, useResendForwardTarget } from '../../hooks/useAliases';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/tokens';
import { errorText } from '../../lib/apiClient';
import { isEmail } from '../../lib/format';
import { toast } from '../../lib/toast';

export default function ForwardTargetsScreen() {
  const { colors } = useTheme();
  const q = useForwardTargets();
  const add = useAddForwardTarget();
  const resend = useResendForwardTarget();
  const del = useDeleteForwardTarget();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    const e = email.trim();
    if (!isEmail(e)) return setErr('Enter a valid email address.');
    setErr(null);
    add.mutate(e, {
      onSuccess: (r) => {
        setEmail('');
        toast(r.verified ? `${r.email} is ready` : `Confirmation sent to ${r.email}`);
      },
      onError: (x) => setErr(errorText(x)),
    });
  };

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={{ paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
      <View style={{ padding: space.lg, gap: space.md }}>
        <Text variant="small" tone="soft">
          Aliases can forward approved mail to these addresses. Each one must be confirmed from its own inbox first.
        </Text>
        <TextField
          label="Add an address"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="you@gmail.com"
          returnKeyType="send"
          onSubmitEditing={submit}
          error={err}
        />
        <Button title="Send confirmation" icon="mail-outline" onPress={submit} loading={add.isPending} />
      </View>

      <SectionHeader title="Your forwarding addresses" />
      {(q.data ?? []).length === 0 ? (
        <Text variant="small" tone="quiet" style={{ paddingHorizontal: space.lg }}>None yet.</Text>
      ) : (
        (q.data ?? []).map((t, i) => (
          <View key={t.id}>
            {i > 0 ? <Divider inset={space.lg} /> : null}
            <View style={{ paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>{t.email}</Text>
                <Chip label={t.verified_at ? 'Confirmed' : 'Waiting'} tone={t.verified_at ? 'ok' : 'quiet'} />
              </View>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                {!t.verified_at ? (
                  <Button
                    style={{ flex: 1 }}
                    kind="secondary"
                    title="Resend"
                    onPress={() => resend.mutate(t.id, { onSuccess: () => toast(`Sent again to ${t.email}`), onError: (e) => toast(errorText(e)) })}
                  />
                ) : null}
                <Button
                  style={{ flex: 1 }}
                  kind="ghost"
                  title="Remove"
                  onPress={() =>
                    Alert.alert('Remove this address?', 'Aliases forwarding here go back to keeping mail in ZeroSpam.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => del.mutate(t.id, { onSuccess: () => toast('Removed'), onError: (e) => toast(errorText(e)) }) },
                    ])
                  }
                />
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
