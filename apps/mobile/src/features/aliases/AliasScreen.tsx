import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Share, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { Button, Chip, Divider, EmptyState, Loading, SectionHeader, Text, TextField } from '../../components/ui';
import ForwardingPicker from './ForwardingPicker';
import { aliasStatus } from './aliasStatus';
import { useAliases, useDeleteAlias, useForwardTargets, usePatchAlias, useSetAliasBlocked } from '../../hooks/useAliases';
import { useMailboxStore } from '../../stores/mailboxStore';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/tokens';
import { errorText } from '../../lib/apiClient';
import { longDate, shortDate } from '../../lib/format';
import { toast } from '../../lib/toast';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Alias'>;

export default function AliasScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const mailboxId = useMailboxStore((s) => s.activeMailboxId);
  const aliases = useAliases(mailboxId);
  const targets = useForwardTargets();
  const patch = usePatchAlias();
  const setBlocked = useSetAliasBlocked();
  const del = useDeleteAlias();
  const alias = aliases.data?.find((a) => a.id === route.params.aliasId);
  const [label, setLabel] = useState(alias?.label ?? '');

  useEffect(() => setLabel(alias?.label ?? ''), [alias?.label]);
  useEffect(() => navigation.setOptions({ title: 'Alias' }), [navigation]);

  if (aliases.isPending) return <Loading />;
  if (!alias) return <EmptyState title="Alias not found" body="It may have been deleted." />;

  const status = aliasStatus(alias);
  const fail = (e: unknown) => toast(errorText(e));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={{ paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
      <View style={{ padding: space.lg, gap: space.md }}>
        <Text variant="title" selectable>{alias.address}</Text>
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip label={status.label} tone={status.tone} />
          <Text variant="caption" tone="quiet">
            Made {shortDate(alias.created_at)}
            {alias.expires_at ? ` · ${alias.expires_at < Date.now() ? 'expired' : 'expires'} ${longDate(alias.expires_at)}` : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button
            style={{ flex: 1 }}
            kind="secondary"
            icon="copy-outline"
            title="Copy"
            onPress={async () => {
              await Clipboard.setStringAsync(alias.address);
              toast('Copied');
            }}
          />
          <Button style={{ flex: 1 }} kind="secondary" icon="share-outline" title="Share" onPress={() => void Share.share({ message: alias.address })} />
        </View>
        <Text variant="small" tone="quiet">
          {alias.received_count} received{alias.last_seen ? ` · last ${shortDate(alias.last_seen)}` : ''}
          {alias.mode !== 'store' ? ` · ${alias.forwarded_count} forwarded · ${alias.replied_count} replies sent` : ''}
        </Text>
      </View>
      <Divider />

      <SectionHeader title="Label" />
      <View style={{ paddingHorizontal: space.lg, gap: space.sm }}>
        <TextField
          value={label}
          onChangeText={setLabel}
          placeholder="Where you used it, e.g. “airline”"
          maxLength={200}
          returnKeyType="done"
          onSubmitEditing={() =>
            label.trim() !== (alias.label ?? '') &&
            patch.mutate({ id: alias.id, patch: { label: label.trim() || null } }, { onSuccess: () => toast('Saved'), onError: fail })
          }
        />
        {label.trim() !== (alias.label ?? '') ? (
          <Button
            title="Save label"
            loading={patch.isPending}
            onPress={() => patch.mutate({ id: alias.id, patch: { label: label.trim() || null } }, { onSuccess: () => toast('Saved'), onError: fail })}
          />
        ) : null}
      </View>

      <SectionHeader title="Delivery" />
      <View style={{ paddingHorizontal: space.lg }}>
        <ForwardingPicker
          mode={alias.mode}
          targetId={alias.forward_target_id}
          targets={targets.data ?? []}
          onChange={(mode, forwardTargetId) =>
            patch.mutate({ id: alias.id, patch: { mode, forwardTargetId } }, { onSuccess: () => toast('Delivery updated'), onError: fail })
          }
        />
        {alias.mode !== 'store' ? (
          <Text variant="small" tone="quiet" style={{ marginTop: space.sm }}>
            Only senders you’ve approved are forwarded. Replies from your real inbox go out from this alias, so your address stays hidden.
          </Text>
        ) : null}
      </View>

      <SectionHeader title="Turn off" />
      <View style={{ paddingHorizontal: space.lg, gap: space.sm }}>
        <Text variant="small" tone="quiet">
          {alias.abused
            ? 'This alias refuses all mail and replies. Turn it back on any time.'
            : 'Getting spam here? Turning the alias off refuses all future mail and replies to it.'}
        </Text>
        <Button
          kind={alias.abused ? 'secondary' : 'danger'}
          icon={alias.abused ? 'refresh' : 'ban-outline'}
          title={alias.abused ? 'Turn back on' : 'Turn off alias'}
          loading={setBlocked.isPending}
          onPress={() =>
            setBlocked.mutate(
              { id: alias.id, blocked: !alias.abused },
              { onSuccess: () => toast(alias.abused ? 'Alias is on' : 'Alias is off'), onError: fail },
            )
          }
        />
        <Button
          kind="ghost"
          title="Delete alias"
          style={{ marginTop: space.sm }}
          onPress={() =>
            Alert.alert('Delete this alias?', `${alias.address} will stop receiving mail. Mail it already received stays in your mailbox.`, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => del.mutate(alias.id, { onSuccess: () => { toast('Alias deleted'); navigation.goBack(); }, onError: fail }),
              },
            ])
          }
        />
      </View>
    </ScrollView>
  );
}
