import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MessageStackParamList } from '../../navigation/types';
import { useMessage } from '../../hooks/useApi';

type Props = NativeStackScreenProps<MessageStackParamList, 'MessageDetail'>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFullDate(ts: number): string {
  return new Date(ts).toLocaleString([], {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function AuthBadge({ pass, label }: { pass: number | null; label: string }) {
  if (pass === null) return null;
  return (
    <View style={[styles.badge, pass ? styles.badgePass : styles.badgeFail]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MessageDetailScreen({ route }: Props) {
  const { messageId } = route.params;
  const { data, isLoading, isError, refetch } = useMessage(messageId);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#5cc8ff" size="large" />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load message.</Text>
        <Pressable style={styles.retryButton} onPress={() => void refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Subject */}
      <Text style={styles.subject}>{data.subject ?? '(no subject)'}</Text>

      {/* Auth badges */}
      <View style={styles.badges}>
        <AuthBadge pass={data.spf_pass} label="SPF" />
        <AuthBadge pass={data.dkim_pass} label="DKIM" />
        <AuthBadge pass={data.dmarc_pass} label="DMARC" />
      </View>

      {/* Metadata */}
      <View style={styles.meta}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>From</Text>
          <Text style={styles.metaValue} selectable>
            {data.from_name ? `${data.from_name} <${data.from_address}>` : data.from_address}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>To</Text>
          <Text style={styles.metaValue} selectable numberOfLines={2}>
            {data.to_addresses}
          </Text>
        </View>
        {data.cc_addresses ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>CC</Text>
            <Text style={styles.metaValue} selectable numberOfLines={2}>
              {data.cc_addresses}
            </Text>
          </View>
        ) : null}
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Date</Text>
          <Text style={styles.metaValue}>{formatFullDate(data.received_at)}</Text>
        </View>
        {data.attachment_count > 0 ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Attachments</Text>
            <Text style={styles.metaValue}>{data.attachment_count}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.divider} />

      {/* Body */}
      <Text style={styles.body} selectable>
        {data.body_text ?? data.preview ?? '(empty)'}
      </Text>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0e14' },
  content: { padding: 16, paddingBottom: 40 },
  centered: {
    flex: 1,
    backgroundColor: '#0b0e14',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  subject: {
    color: '#dbe3ef',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
    marginBottom: 10,
  },
  badges: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  badge: { borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  badgePass: { backgroundColor: '#0d3022' },
  badgeFail: { backgroundColor: '#3a0d0d' },
  badgeText: { color: '#a0aec0', fontSize: 11, fontWeight: '600' },
  meta: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 12,
    gap: 8,
    marginBottom: 16,
  },
  metaRow: { flexDirection: 'row', gap: 10 },
  metaLabel: { color: '#4a5568', fontSize: 13, width: 72 },
  metaValue: { color: '#9caab8', fontSize: 13, flex: 1 },
  divider: { height: 1, backgroundColor: '#1a2030', marginBottom: 16 },
  body: { color: '#c9d6e8', fontSize: 15, lineHeight: 24 },
  errorText: { color: '#f87171', fontSize: 15 },
  retryButton: {
    borderWidth: 1,
    borderColor: '#2a3241',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: { color: '#5cc8ff', fontSize: 14 },
});
