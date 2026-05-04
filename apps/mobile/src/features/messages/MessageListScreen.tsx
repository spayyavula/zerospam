import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MessageSummary, FolderName } from '@zerospam/shared-api';
import type { MessageStackParamList } from '../../navigation/types';
import { useMessages } from '../../hooks/useApi';

type Props = NativeStackScreenProps<MessageStackParamList, 'MessageList'>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ── Message row ───────────────────────────────────────────────────────────────

interface MessageRowProps {
  item: MessageSummary;
  onPress: (id: string) => void;
}

function MessageRow({ item, onPress }: MessageRowProps) {
  const isRead = item.read === 1;
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => onPress(item.id)}
      accessibilityRole="button"
      accessibilityLabel={`Message from ${item.from_address}: ${item.subject ?? '(no subject)'}`}
    >
      <View style={styles.rowLeft}>
        <View style={styles.rowHeader}>
          <Text style={[styles.sender, !isRead && styles.senderBold]} numberOfLines={1}>
            {item.from_name ?? item.from_address}
          </Text>
          <Text style={styles.date}>{formatDate(item.received_at)}</Text>
        </View>
        <Text style={[styles.subject, !isRead && styles.subjectBold]} numberOfLines={1}>
          {item.subject ?? '(no subject)'}
        </Text>
        {item.preview ? (
          <Text style={styles.preview} numberOfLines={1}>
            {item.preview}
          </Text>
        ) : null}
      </View>
      {!isRead && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MessageListScreen({ route, navigation }: Props) {
  const { folder, mailboxId } = route.params;
  const { data, isLoading, isError, refetch, isFetching } = useMessages(mailboxId, folder);

  const handlePress = useCallback(
    (messageId: string) => {
      navigation.push('MessageDetail', { messageId });
    },
    [navigation],
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#5cc8ff" size="large" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load messages.</Text>
        <Pressable style={styles.retryButton} onPress={() => void refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!data || data.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>
          {folder === 'inbox' ? 'Your inbox is empty.' : 'No quarantined messages.'}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={data}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <MessageRow item={item} onPress={handlePress} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      onRefresh={() => void refetch()}
      refreshing={isFetching && !isLoading}
    />
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#0b0e14' },
  centered: {
    flex: 1,
    backgroundColor: '#0b0e14',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b0e14',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowPressed: { backgroundColor: '#131820' },
  rowLeft: { flex: 1 },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 3,
  },
  sender: { color: '#7c8aa0', fontSize: 14, flex: 1, marginRight: 8 },
  senderBold: { color: '#dbe3ef', fontWeight: '600' },
  date: { color: '#4a5568', fontSize: 12 },
  subject: { color: '#7c8aa0', fontSize: 14 },
  subjectBold: { color: '#c9d6e8', fontWeight: '600' },
  preview: { color: '#4a5568', fontSize: 13, marginTop: 2 },
  separator: { height: 1, backgroundColor: '#1a2030', marginLeft: 16 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#5cc8ff',
    marginLeft: 10,
    flexShrink: 0,
  },
  emptyText: { color: '#4a5568', fontSize: 15 },
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
