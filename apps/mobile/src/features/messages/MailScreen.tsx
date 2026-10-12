import React, { useLayoutEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import MessageList from './MessageList';
import FolderSheet from '../../components/FolderSheet';
import { IconButton, Text } from '../../components/ui';
import { FOLDER_LABEL, useActiveMailbox, useMailboxStore } from '../../stores/mailboxStore';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, space } from '../../theme/tokens';
import type { MainTabParamList } from '../../navigation/types';

export default function MailScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList, 'Mail'>>();
  const { colors } = useTheme();
  const folder = useMailboxStore((s) => s.folder);
  const mailboxId = useMailboxStore((s) => s.activeMailboxId);
  const mailbox = useActiveMailbox();
  const [sheet, setSheet] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <Pressable
          onPress={() => setSheet(true)}
          accessibilityRole="button"
          accessibilityLabel={`${FOLDER_LABEL[folder]}. Change folder`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <View>
            <Text style={{ fontFamily: fonts.displayItalic, fontSize: 24, lineHeight: 28 }}>{FOLDER_LABEL[folder]}</Text>
            {mailbox ? <Text variant="caption" tone="quiet" numberOfLines={1}>{mailbox.address}</Text> : null}
          </View>
          <Ionicons name="chevron-down" size={16} color={colors.quiet} />
        </Pressable>
      ),
      headerRight: () => (
        <View style={{ flexDirection: 'row', marginRight: space.sm }}>
          <IconButton name="search" label="Search mail" onPress={() => navigation.getParent()?.navigate('Search')} />
        </View>
      ),
    });
  }, [navigation, folder, mailbox, colors.quiet]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <MessageList mailboxId={mailboxId} folder={folder} />
      <Pressable
        onPress={() => navigation.getParent()?.navigate('Compose')}
        accessibilityRole="button"
        accessibilityLabel="Write a message"
        style={({ pressed }) => ({
          position: 'absolute',
          right: space.lg,
          bottom: space.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 20,
          height: 56,
          borderRadius: 16,
          backgroundColor: colors.signal,
          opacity: pressed ? 0.85 : 1,
          elevation: 4,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
        })}
      >
        <Ionicons name="create-outline" size={22} color={colors.onSignal} />
        <Text style={{ color: colors.onSignal, fontWeight: '600' }}>Write</Text>
      </Pressable>
      <FolderSheet visible={sheet} onClose={() => setSheet(false)} />
    </View>
  );
}
