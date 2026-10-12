import React from 'react';
import { Alert, View } from 'react-native';
import MessageList from './MessageList';
import { Button, Text } from '../../components/ui';
import { useCounts, usePurgeQuarantine } from '../../hooks/useApi';
import { useActiveMailbox, useMailboxStore } from '../../stores/mailboxStore';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/tokens';
import { errorText } from '../../lib/apiClient';
import { toast } from '../../lib/toast';

function Header() {
  const { colors } = useTheme();
  const mailbox = useActiveMailbox();
  const counts = useCounts(mailbox?.id ?? null);
  const purge = usePurgeQuarantine();
  const total = counts.data?.quarantine.total ?? 0;
  const days = mailbox ? Math.round(mailbox.quarantine_ttl_hours / 24) : null;

  return (
    <View style={{ padding: space.lg, gap: space.md, borderBottomWidth: 1, borderBottomColor: colors.rule, backgroundColor: colors.paperDeep }}>
      <Text variant="small" tone="soft">
        Mail from senders you haven{'\u2019'}t approved waits here
        {days ? ` and deletes itself after ${days} day${days === 1 ? '' : 's'}` : ''}. Swipe right to trust a sender and move their mail to your inbox.
      </Text>
      {total > 0 && mailbox ? (
        <Button
          title={`Empty quarantine (${total})`}
          kind="danger"
          icon="trash-outline"
          loading={purge.isPending}
          onPress={() =>
            Alert.alert('Empty quarantine?', `Permanently delete ${total} message${total === 1 ? '' : 's'}. This can't be undone.`, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete all',
                style: 'destructive',
                onPress: () =>
                  purge.mutate(mailbox.id, {
                    onSuccess: (r) => toast(`Deleted ${r.purged} message${r.purged === 1 ? '' : 's'}`),
                    onError: (e) => toast(errorText(e)),
                  }),
              },
            ])
          }
        />
      ) : null}
    </View>
  );
}

export default function QuarantineScreen() {
  const mailboxId = useMailboxStore((s) => s.activeMailboxId);
  return <MessageList mailboxId={mailboxId} folder="quarantine" ListHeaderComponent={<Header />} />;
}
