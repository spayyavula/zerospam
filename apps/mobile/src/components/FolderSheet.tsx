import React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FOLDER_LABEL, useMailboxStore, type MailFolder } from '../stores/mailboxStore';
import { useCounts } from '../hooks/useApi';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import { Divider, SectionHeader, Text } from './ui';

const ICON: Record<MailFolder, keyof typeof Ionicons.glyphMap> = {
  inbox: 'mail-outline',
  sent: 'paper-plane-outline',
  trash: 'trash-outline',
};

/** Bottom sheet for choosing the Mail tab's folder and, with several mailboxes, the mailbox. */
export default function FolderSheet({
  visible,
  onClose,
  showFolders = true,
}: {
  visible: boolean;
  onClose: () => void;
  showFolders?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { mailboxes, activeMailboxId, folder, setFolder, setActiveMailboxId } = useMailboxStore();
  const counts = useCounts(activeMailboxId);

  const item = (
    key: string,
    label: string,
    icon: keyof typeof Ionicons.glyphMap,
    selected: boolean,
    onPress: () => void,
    badge?: number,
  ) => (
    <Pressable
      key={key}
      onPress={() => {
        onPress();
        onClose();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingHorizontal: space.lg,
        minHeight: 52,
        backgroundColor: selected ? colors.paperDeep : pressed ? colors.paperDeep : 'transparent',
      })}
    >
      <Ionicons name={icon} size={20} color={selected ? colors.ink : colors.inkSoft} />
      <Text variant="body" numberOfLines={1} style={{ flex: 1, fontWeight: selected ? '600' : '400' }}>{label}</Text>
      {badge ? <Text variant="small" tone="quiet">{badge}</Text> : null}
      {selected ? <Ionicons name="checkmark" size={18} color={colors.ink} /> : null}
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={onClose} accessibilityLabel="Close" />
      <View
        style={{
          backgroundColor: colors.paper,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          paddingBottom: insets.bottom + space.md,
          maxHeight: '75%',
        }}
      >
        <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.rule, marginTop: 8 }} />
        <ScrollView>
          {showFolders ? (
            <>
              <SectionHeader title="Folders" />
              {(Object.keys(FOLDER_LABEL) as MailFolder[]).map((f) =>
                item(f, FOLDER_LABEL[f], ICON[f], f === folder, () => setFolder(f), f === 'inbox' ? counts.data?.inbox.unread : undefined),
              )}
            </>
          ) : null}
          {mailboxes.length > 1 ? (
            <>
              {showFolders ? <Divider /> : null}
              <SectionHeader title="Mailboxes" />
              {mailboxes.map((m) =>
                item(`mb-${m.id}`, m.address, 'at-outline', m.id === activeMailboxId, () => setActiveMailboxId(m.id)),
              )}
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
