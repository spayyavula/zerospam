import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { ScreenerSender } from '@zerospam/shared-api';
import Avatar from '../../components/Avatar';
import { Button, EmptyState, ErrorState, Loading, Text } from '../../components/ui';
import { useScreener, useScreenerAllow, useScreenerAllowDomain, useScreenerReject } from '../../hooks/useApi';
import { useMailboxStore } from '../../stores/mailboxStore';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { shortDate, wantInHeadline } from '../../lib/format';
import { errorText } from '../../lib/apiClient';
import { toast } from '../../lib/toast';

function SenderCard({
  sender,
  onAllow,
  onBlock,
}: {
  sender: ScreenerSender;
  onAllow: () => void;
  onBlock: () => void;
}) {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [open, setOpen] = useState(false);
  const label = sender.name?.trim() || sender.address;

  return (
    <View style={{ borderWidth: 1, borderColor: colors.rule, borderRadius: radius.lg, backgroundColor: colors.paper, overflow: 'hidden' }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${sender.message_count} message${sender.message_count === 1 ? '' : 's'}. ${open ? 'Hide' : 'Show'} messages`}
        style={{ flexDirection: 'row', gap: space.md, padding: space.lg, alignItems: 'center' }}
      >
        <Avatar label={label} address={sender.address} size={44} />
        <View style={{ flex: 1 }}>
          <Text variant="heading" numberOfLines={1}>{label}</Text>
          {sender.name ? <Text variant="small" tone="quiet" numberOfLines={1}>{sender.address}</Text> : null}
          <Text variant="caption" tone="quiet">
            {sender.message_count} message{sender.message_count === 1 ? '' : 's'} · {shortDate(sender.latest_received_at)}
          </Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.quiet} />
      </Pressable>

      {open ? (
        sender.messages.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => navigation.navigate('Message', { messageId: m.id, mailboxId: m.mailbox_id })}
            accessibilityRole="button"
            style={({ pressed }) => ({ paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: 1, borderTopColor: colors.rule, backgroundColor: pressed ? colors.paperDeep : colors.paper })}
          >
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Text variant="small" numberOfLines={1} style={{ flex: 1, fontWeight: '600' }}>{m.subject?.trim() || '(no subject)'}</Text>
              <Text variant="caption" tone="quiet">{shortDate(m.received_at)}</Text>
            </View>
            {m.preview ? <Text variant="small" tone="quiet" numberOfLines={2}>{m.preview}</Text> : null}
          </Pressable>
        ))
      ) : (
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md, gap: 2 }}>
          <Text variant="small" numberOfLines={1} style={{ fontWeight: '600' }}>{sender.latest_subject || '(no subject)'}</Text>
          {sender.latest_preview ? <Text variant="small" tone="quiet" numberOfLines={2}>{sender.latest_preview}</Text> : null}
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: space.sm, padding: space.md, borderTopWidth: 1, borderTopColor: colors.rule, backgroundColor: colors.paperDeep }}>
        <Button style={{ flex: 1 }} kind="secondary" icon="close" title="Decline" onPress={onBlock} accessibilityLabel={`Decline ${sender.address}`} />
        <Button style={{ flex: 1 }} icon="checkmark" title="Allow" onPress={onAllow} accessibilityLabel={`Allow ${sender.address}`} />
      </View>
    </View>
  );
}

export default function ScreenerScreen() {
  const { colors } = useTheme();
  const mailboxId = useMailboxStore((s) => s.activeMailboxId);
  const q = useScreener(mailboxId);
  const allow = useScreenerAllow();
  const reject = useScreenerReject();
  const allowDomain = useScreenerAllowDomain();

  // Hide a sender as soon as it's decided; bring it back if the request fails.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [domainPrompt, setDomainPrompt] = useState<string | null>(null);

  const hide = useCallback((a: string, on: boolean) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (on) next.add(a);
      else next.delete(a);
      return next;
    });
  }, []);

  const onAllow = (s: ScreenerSender) => {
    if (mailboxId == null) return;
    hide(s.address, true);
    allow.mutate(
      { mailboxId, senderAddress: s.address },
      {
        onSuccess: (r) => {
          toast(`Allowed · ${r.moved} message${r.moved === 1 ? '' : 's'} moved to Inbox`);
          if (r.suggest_domain_expand) setDomainPrompt(r.domain);
        },
        onError: (e) => {
          hide(s.address, false);
          toast(errorText(e));
        },
      },
    );
  };

  const onBlock = (s: ScreenerSender) => {
    if (mailboxId == null) return;
    hide(s.address, true);
    reject.mutate(
      { mailboxId, senderAddress: s.address },
      {
        onSuccess: () => toast(`Declined · hidden from the Screener for 30 days`),
        onError: (e) => {
          hide(s.address, false);
          toast(errorText(e));
        },
      },
    );
  };

  if (mailboxId == null || q.isPending) return <Loading />;
  if (q.isError) return <ErrorState message={errorText(q.error, 'Could not load the Screener.')} onRetry={() => void q.refetch()} />;

  const visible = (q.data ?? []).filter((s) => !hidden.has(s.address));

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={visible.length === 0 ? { flexGrow: 1 } : { padding: space.lg, gap: space.md, paddingBottom: space.xxl }}
      data={visible}
      keyExtractor={(s) => s.address}
      ListHeaderComponent={
        <View style={{ gap: space.md, marginBottom: visible.length ? 0 : space.lg }}>
          {visible.length ? (
            <View style={{ gap: space.sm, marginBottom: space.sm }}>
              <Text variant="display">{wantInHeadline(visible.length)}</Text>
              <Text variant="small" tone="soft">
                Allow someone once and their mail goes straight to your Inbox from now on.
              </Text>
            </View>
          ) : null}
          {domainPrompt && mailboxId != null ? (
            <View style={{ backgroundColor: colors.paperDeep, borderRadius: radius.md, padding: space.md, gap: space.sm, borderWidth: 1, borderColor: colors.signal }}>
              <Text variant="small">Allow everyone at <Text variant="small" style={{ fontWeight: '700' }}>{domainPrompt}</Text>?</Text>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button style={{ flex: 1 }} kind="ghost" title="Not now" onPress={() => setDomainPrompt(null)} />
                <Button
                  style={{ flex: 1 }}
                  title="Allow domain"
                  loading={allowDomain.isPending}
                  onPress={() =>
                    allowDomain.mutate(
                      { mailboxId, domain: domainPrompt },
                      { onSuccess: () => toast(`Allowed everyone at ${domainPrompt}`), onError: (e) => toast(errorText(e)), onSettled: () => setDomainPrompt(null) },
                    )
                  }
                />
              </View>
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={<EmptyState icon="people-outline" title="No one waiting" body="When someone new writes to you, they show up here first. You decide if they reach your Inbox." />}
      renderItem={({ item }) => <SenderCard sender={item} onAllow={() => onAllow(item)} onBlock={() => onBlock(item)} />}
      refreshControl={
        <RefreshControl refreshing={q.isRefetching} onRefresh={() => { setHidden(new Set()); void q.refetch(); }} tintColor={colors.ink} colors={[colors.onSignal]} progressBackgroundColor={colors.signal} />
      }
    />
  );
}
