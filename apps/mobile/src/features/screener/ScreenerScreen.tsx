import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ScreenerSender } from '@zerospam/shared-api';
import {
  useScreener,
  useScreenerAllow,
  useScreenerReject,
  useScreenerAllowDomain,
} from '../../hooks/useApi';
import { useMailboxStore } from '../../stores/mailboxStore';
import SenderCard from './components/SenderCard';
import DomainExpandBanner from './components/DomainExpandBanner';

type DomainPrompt = { mailboxId: number; domain: string };

export default function ScreenerScreen() {
  const mailboxId = useMailboxStore((s) => s.activeMailboxId);
  const { data: senders = [], isFetching, refetch, isError } = useScreener(mailboxId);

  // Optimistic: track sender addresses being dismissed so they hide immediately.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [domainPrompt, setDomainPrompt] = useState<DomainPrompt | null>(null);

  const allowMut = useScreenerAllow();
  const rejectMut = useScreenerReject();
  const allowDomainMut = useScreenerAllowDomain();

  const dismiss = useCallback((address: string) => {
    setDismissed((prev) => new Set(prev).add(address));
  }, []);

  const handleAllow = useCallback(
    (sender: ScreenerSender) => {
      if (mailboxId == null) return;
      dismiss(sender.address);
      allowMut.mutate(
        { mailboxId, senderAddress: sender.address },
        {
          onSuccess: (res) => {
            if (res.suggest_domain_expand) {
              setDomainPrompt({ mailboxId, domain: res.domain });
            }
          },
          onError: () => {
            // Revert optimistic dismiss on failure
            setDismissed((prev) => {
              const next = new Set(prev);
              next.delete(sender.address);
              return next;
            });
          },
        },
      );
    },
    [mailboxId, allowMut, dismiss],
  );

  const handleReject = useCallback(
    (sender: ScreenerSender) => {
      if (mailboxId == null) return;
      dismiss(sender.address);
      rejectMut.mutate(
        { mailboxId, senderAddress: sender.address },
        {
          onError: () => {
            setDismissed((prev) => {
              const next = new Set(prev);
              next.delete(sender.address);
              return next;
            });
          },
        },
      );
    },
    [mailboxId, rejectMut, dismiss],
  );

  const handleAllowDomain = useCallback(() => {
    if (!domainPrompt) return;
    allowDomainMut.mutate(domainPrompt, { onSettled: () => setDomainPrompt(null) });
  }, [domainPrompt, allowDomainMut]);

  const visible = senders.filter((s) => !dismissed.has(s.address));

  if (mailboxId == null) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>No mailbox selected.</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Could not load Screener.</Text>
        <Pressable style={styles.retryButton} onPress={() => void refetch()} accessibilityRole="button">
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {domainPrompt && (
        <DomainExpandBanner
          domain={domainPrompt.domain}
          loading={allowDomainMut.isPending}
          onAccept={handleAllowDomain}
          onDismiss={() => setDomainPrompt(null)}
        />
      )}

      <FlatList
        data={visible}
        keyExtractor={(item) => item.address}
        renderItem={({ item }) => (
          <SenderCard
            sender={item}
            onAllow={handleAllow}
            onReject={handleReject}
          />
        )}
        contentContainerStyle={visible.length === 0 ? styles.emptyList : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => void refetch()}
            tintColor="#5cc8ff"
          />
        }
        ListEmptyComponent={
          isFetching ? (
            <ActivityIndicator color="#5cc8ff" style={styles.loader} />
          ) : (
            <View style={styles.center}>
              <Text style={styles.doneTitle}>You're all caught up.</Text>
              <Text style={styles.doneSub}>No unknown senders waiting.</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0e14' },
  list: { paddingVertical: 8 },
  emptyList: { flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: { color: '#7c8aa0', fontSize: 15, textAlign: 'center' },
  doneTitle: { color: '#dbe3ef', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  doneSub: { color: '#7c8aa0', fontSize: 14 },
  loader: { marginTop: 40 },
  retryButton: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#2a3241',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  retryText: { color: '#5cc8ff', fontSize: 14, fontWeight: '600' },
});
