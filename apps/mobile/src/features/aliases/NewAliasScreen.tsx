import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import type { AliasMode } from '@zerospam/shared-api';
import { Button, SectionHeader, Text, TextField } from '../../components/ui';
import ForwardingPicker from './ForwardingPicker';
import { useCreateAlias, useForwardTargets } from '../../hooks/useAliases';
import { useActiveMailbox } from '../../stores/mailboxStore';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { errorText } from '../../lib/apiClient';
import { toast } from '../../lib/toast';
import { localPartProblem } from '../../lib/validation';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'NewAlias'>;

const EXPIRY: { label: string; days: number | null }[] = [
  { label: 'Never', days: null },
  { label: '1 week', days: 7 },
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
];

export default function NewAliasScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const mailbox = useActiveMailbox();
  const targets = useForwardTargets();
  const create = useCreateAlias();
  const [label, setLabel] = useState('');
  const [local, setLocal] = useState('');
  const [days, setDays] = useState<number | null>(null);
  const [mode, setMode] = useState<AliasMode>('store');
  const [targetId, setTargetId] = useState<number | null>(null);
  const domain = mailbox?.address.split('@')[1] ?? 'zero-spam.email';
  const localErr = localPartProblem(local.trim());

  const submit = () => {
    if (!mailbox || localErr) return;
    create.mutate(
      {
        mailboxId: mailbox.id,
        label: label.trim() || undefined,
        localPart: local.trim() || undefined,
        expiresInDays: days,
        mode,
        forwardTargetId: mode === 'store' ? null : targetId,
      },
      {
        onSuccess: async (r) => {
          await Clipboard.setStringAsync(r.address);
          toast(`${r.address} copied`);
          navigation.replace('Alias', { aliasId: r.id });
        },
        onError: (e) => toast(errorText(e)),
      },
    );
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={{ paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
      <View style={{ padding: space.lg, gap: space.lg }}>
        <TextField label="Label (optional)" value={label} onChangeText={setLabel} placeholder="Where you’ll use it" maxLength={200} />
        <TextField
          label="Address (optional)"
          value={local}
          onChangeText={(v) => setLocal(v.replace(/\s/g, '').toLowerCase())}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Leave empty for a random one"
          hint={`${local.trim() || 'random-words-1234'}@${domain}`}
          error={localErr}
        />
      </View>

      <SectionHeader title="Expires" />
      <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, flexWrap: 'wrap' }}>
        {EXPIRY.map((e) => {
          const selected = e.days === days;
          return (
            <Pressable
              key={e.label}
              onPress={() => setDays(e.days)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={{
                paddingHorizontal: space.md,
                minHeight: 40,
                justifyContent: 'center',
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: selected ? colors.ink : colors.rule,
                backgroundColor: selected ? colors.ink : colors.paper,
              }}
            >
              <Text variant="small" style={{ color: selected ? colors.paper : colors.ink, fontWeight: selected ? '600' : '400' }}>{e.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <SectionHeader title="Delivery" />
      <View style={{ paddingHorizontal: space.lg }}>
        <ForwardingPicker
          mode={mode}
          targetId={targetId}
          targets={targets.data ?? []}
          onChange={(m, t) => {
            setMode(m);
            setTargetId(t);
          }}
        />
      </View>

      <View style={{ padding: space.lg }}>
        <Button title="Create alias" icon="add" onPress={submit} loading={create.isPending} disabled={!!localErr || !mailbox} />
        <Text variant="caption" tone="quiet" style={{ textAlign: 'center', marginTop: space.sm }}>The new address is copied so you can paste it right away.</Text>
      </View>
    </ScrollView>
  );
}
