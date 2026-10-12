import React, { useEffect, useLayoutEffect, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MessageSummary } from '@zerospam/shared-api';
import MessageRow from '../../components/MessageRow';
import { Divider, EmptyState, ErrorState, Loading } from '../../components/ui';
import { useSearch } from '../../hooks/useApi';
import { useMailboxStore } from '../../stores/mailboxStore';
import { useTheme } from '../../theme/ThemeProvider';
import { errorText } from '../../lib/apiClient';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Search'>;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const FOLDER_NAME: Record<string, string> = { inbox: 'Inbox', sent: 'Sent', trash: 'Trash', quarantine: 'Quarantine' };

export default function SearchScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const mailboxId = useMailboxStore((s) => s.activeMailboxId);
  const [text, setText] = useState('');
  const query = useDebounced(text, 300);
  const q = useSearch(mailboxId, query);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <TextInput
          value={text}
          onChangeText={setText}
          autoFocus
          placeholder="Search mail"
          placeholderTextColor={colors.quiet}
          selectionColor={colors.accent}
          returnKeyType="search"
          accessibilityLabel="Search mail"
          style={{ fontSize: 17, color: colors.ink, minWidth: 240, paddingVertical: 6 }}
        />
      ),
    });
  }, [navigation, text, colors]);

  let content: React.ReactNode;
  if (query.trim().length < 2) {
    content = <EmptyState icon="search" title="Search your mail" body="Sender, subject, or words in the message. Searches every folder." />;
  } else if (q.isPending) {
    content = <Loading />;
  } else if (q.isError) {
    content = <ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} />;
  } else if (!q.data?.length) {
    content = <EmptyState title="No matches" body={`Nothing found for “${query.trim()}”.`} />;
  } else {
    content = (
      <FlatList
        data={q.data}
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <Divider inset={36} />}
        renderItem={({ item }: { item: MessageSummary }) => (
          <MessageRow
            message={{ ...item, subject: `${item.folder !== 'inbox' ? `[${FOLDER_NAME[item.folder] ?? item.folder}] ` : ''}${item.subject ?? ''}` }}
            onPress={() => navigation.navigate('Message', { messageId: item.id, mailboxId: item.mailbox_id })}
          />
        )}
      />
    );
  }

  return <View style={{ flex: 1, backgroundColor: colors.paper }}>{content}</View>;
}
