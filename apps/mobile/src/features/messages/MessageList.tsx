import React, { useCallback, useMemo } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { FolderName, MessageSummary } from '@zerospam/shared-api';
import MessageRow, { type SwipeAction } from '../../components/MessageRow';
import { Divider, EmptyState, ErrorState, Loading, Text } from '../../components/ui';
import { useDeleteForever, useMessages, useMove, useSetRead, useTrustSender } from '../../hooks/useApi';
import { useTheme } from '../../theme/ThemeProvider';
import { errorText } from '../../lib/apiClient';
import { toast } from '../../lib/toast';

const EMPTY: Record<FolderName, { title: string; body: string; icon: 'mail-open-outline' | 'paper-plane-outline' | 'trash-outline' | 'shield-checkmark-outline' }> = {
  inbox: { title: 'All caught up', body: 'Only senders you have approved land here.', icon: 'mail-open-outline' },
  sent: { title: 'Nothing sent yet', body: 'Messages you send from this mailbox appear here.', icon: 'paper-plane-outline' },
  trash: { title: 'Trash is empty', body: 'Deleted messages stay here until you remove them.', icon: 'trash-outline' },
  quarantine: {
    title: 'Quarantine is empty',
    body: 'Mail from senders you haven\u2019t approved waits here, then deletes itself.',
    icon: 'shield-checkmark-outline',
  },
};

export default function MessageList({
  mailboxId,
  folder,
  ListHeaderComponent,
}: {
  mailboxId: number | null;
  folder: FolderName;
  ListHeaderComponent?: React.ReactElement | null;
}) {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const q = useMessages(mailboxId, folder);
  const setRead = useSetRead();
  const move = useMove();
  const del = useDeleteForever();
  const trust = useTrustSender();

  const items = useMemo(() => q.data?.pages.flat() ?? [], [q.data]);

  const actionsFor = useCallback(
    (m: MessageSummary): { left?: SwipeAction; right?: SwipeAction } => {
      const ref = { id: m.id, mailboxId: m.mailbox_id };
      const fail = (e: unknown) => toast(errorText(e));
      const toggleRead: SwipeAction = {
        label: m.read ? 'Unread' : 'Read',
        icon: m.read ? 'mail-unread-outline' : 'mail-open-outline',
        tone: 'neutral',
        onAction: () => setRead.mutate({ ...ref, read: !m.read }, { onError: fail }),
      };
      switch (folder) {
        case 'inbox':
          return {
            left: toggleRead,
            right: {
              label: 'Trash',
              icon: 'trash-outline',
              tone: 'danger',
              onAction: () => move.mutate({ ...ref, folder: 'trash' }, { onSuccess: () => toast('Moved to Trash'), onError: fail }),
            },
          };
        case 'trash':
          return {
            left: {
              label: 'Restore',
              icon: 'arrow-undo-outline',
              tone: 'neutral',
              onAction: () => move.mutate({ ...ref, folder: 'inbox' }, { onSuccess: () => toast('Moved to Inbox'), onError: fail }),
            },
            right: {
              label: 'Delete',
              icon: 'close-circle-outline',
              tone: 'danger',
              onAction: () => del.mutate(ref, { onSuccess: () => toast('Deleted forever'), onError: fail }),
            },
          };
        case 'quarantine':
          return {
            left: {
              label: 'Trust',
              icon: 'checkmark-circle-outline',
              tone: 'signal',
              onAction: () =>
                trust.mutate(ref, { onSuccess: () => toast(`Trusted ${m.from_address}`), onError: fail }),
            },
            right: {
              label: 'Delete',
              icon: 'close-circle-outline',
              tone: 'danger',
              onAction: () => del.mutate(ref, { onSuccess: () => toast('Deleted'), onError: fail }),
            },
          };
        default:
          return {};
      }
    },
    [folder, setRead, move, del, trust],
  );

  if (mailboxId == null || q.isPending) return <Loading />;
  if (q.isError && items.length === 0) {
    return <ErrorState message={errorText(q.error, 'Could not load messages.')} onRetry={() => void q.refetch()} />;
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={items.length === 0 ? { flexGrow: 1 } : { paddingBottom: 96 }}
      data={items}
      keyExtractor={(m) => m.id}
      ItemSeparatorComponent={() => <Divider inset={68} />}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={<EmptyState {...EMPTY[folder]} />}
      renderItem={({ item }) => {
        const a = actionsFor(item);
        return (
          <MessageRow
            message={item}
            showRecipient={folder === 'sent'}
            leftAction={a.left}
            rightAction={a.right}
            onPress={() => navigation.navigate('Message', { messageId: item.id, mailboxId: item.mailbox_id })}
          />
        );
      }}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
      }}
      ListFooterComponent={
        q.isFetchingNextPage ? (
          <View style={{ padding: 16 }}>
            <Text variant="small" tone="quiet" style={{ textAlign: 'center' }}>Loading more…</Text>
          </View>
        ) : null
      }
      refreshControl={
        <RefreshControl
          refreshing={q.isRefetching && !q.isFetchingNextPage}
          onRefresh={() => void q.refetch()}
          tintColor={colors.ink}
          colors={[colors.onSignal]}
          progressBackgroundColor={colors.signal}
        />
      }
    />
  );
}
