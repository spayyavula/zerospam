import React, { useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ScreenerSender, MessageSummary } from '@zerospam/shared-api';
import SenderAvatar from './SenderAvatar';

type Props = {
  sender: ScreenerSender;
  onAllow: (sender: ScreenerSender) => void;
  onReject: (sender: ScreenerSender) => void;
};

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function MessageRow({ msg }: { msg: MessageSummary }) {
  return (
    <View style={msgStyles.row}>
      <Text style={msgStyles.subject} numberOfLines={1}>
        {msg.subject ?? '(no subject)'}
      </Text>
      <Text style={msgStyles.preview} numberOfLines={1}>
        {msg.preview ?? ''}
      </Text>
      <Text style={msgStyles.time}>{timeAgo(msg.received_at)}</Text>
    </View>
  );
}

const msgStyles = StyleSheet.create({
  row: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e2736',
  },
  subject: { color: '#c9d2de', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  preview: { color: '#7c8aa0', fontSize: 12 },
  time: { color: '#4a5568', fontSize: 11, marginTop: 2 },
});

export default function SenderCard({ sender, onAllow, onReject }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.card}>
      {/* Header row */}
      <Pressable
        style={styles.header}
        onPress={() => setExpanded((e) => !e)}
        accessibilityRole="button"
        accessibilityLabel={`${sender.name ?? sender.address}. Tap to ${expanded ? 'collapse' : 'expand'} messages.`}
      >
        <SenderAvatar name={sender.name} address={sender.address} />
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {sender.name ?? sender.address}
          </Text>
          {sender.name ? (
            <Text style={styles.address} numberOfLines={1}>{sender.address}</Text>
          ) : null}
          <Text style={styles.meta}>
            {sender.message_count} message{sender.message_count !== 1 ? 's' : ''} · {timeAgo(sender.latest_received_at)}
          </Text>
        </View>
        <Text style={styles.expand}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>

      {/* Latest preview when collapsed */}
      {!expanded && (
        <View style={styles.preview}>
          <Text style={styles.previewSubject} numberOfLines={1}>{sender.latest_subject}</Text>
          <Text style={styles.previewBody} numberOfLines={1}>{sender.latest_preview}</Text>
        </View>
      )}

      {/* Expanded message list */}
      {expanded && sender.messages.length > 0 && (
        <FlatList
          data={sender.messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MessageRow msg={item} />}
          scrollEnabled={false}
        />
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.actionBtn, styles.yesBtn]}
          onPress={() => onAllow(sender)}
          accessibilityRole="button"
          accessibilityLabel={`Allow ${sender.name ?? sender.address}`}
        >
          <Text style={styles.yesBtnText}>✓ Yes</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, styles.noBtn]}
          onPress={() => onReject(sender)}
          accessibilityRole="button"
          accessibilityLabel={`Reject ${sender.name ?? sender.address}`}
        >
          <Text style={styles.noBtnText}>✕ No</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginVertical: 6,
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: '#1e2736',
    borderRadius: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  headerText: { flex: 1, minWidth: 0 },
  name: { color: '#dbe3ef', fontSize: 15, fontWeight: '700' },
  address: { color: '#7c8aa0', fontSize: 12, marginTop: 1 },
  meta: { color: '#4a5568', fontSize: 12, marginTop: 3 },
  expand: { color: '#4a5568', fontSize: 11 },
  preview: { paddingHorizontal: 14, paddingBottom: 10 },
  previewSubject: { color: '#c9d2de', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  previewBody: { color: '#7c8aa0', fontSize: 12 },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#1e2736',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yesBtn: {
    backgroundColor: '#0f2d1e',
    borderRightWidth: 1,
    borderRightColor: '#1e2736',
  },
  noBtn: { backgroundColor: '#2d0f0f' },
  yesBtnText: { color: '#4ade80', fontSize: 15, fontWeight: '700' },
  noBtnText: { color: '#f87171', fontSize: 15, fontWeight: '700' },
});
