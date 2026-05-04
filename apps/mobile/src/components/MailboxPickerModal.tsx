import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Modal,
} from 'react-native';
import type { Mailbox } from '@zerospam/shared-api';
import { useMailboxStore } from '../stores/mailboxStore';

interface MailboxPickerModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function MailboxPickerModal({ visible, onClose }: MailboxPickerModalProps) {
  const mailboxes = useMailboxStore((s) => s.mailboxes);
  const activeId = useMailboxStore((s) => s.activeMailboxId);
  const setActive = useMailboxStore((s) => s.setActiveMailboxId);

  function handleSelect(mailbox: Mailbox) {
    setActive(mailbox.id);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Switch mailbox</Text>
        <FlatList
          data={mailboxes}
          keyExtractor={(m) => String(m.id)}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.item,
                item.id === activeId && styles.itemActive,
                pressed && styles.itemPressed,
              ]}
              onPress={() => handleSelect(item)}
              accessibilityRole="button"
              accessibilityLabel={`Select mailbox ${item.address}`}
              accessibilityState={{ selected: item.id === activeId }}
            >
              <Text
                style={[styles.itemText, item.id === activeId && styles.itemTextActive]}
                numberOfLines={1}
              >
                {item.address}
              </Text>
              {item.id === activeId && <View style={styles.check} />}
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 32,
    maxHeight: '60%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2a3241',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  title: {
    color: '#7c8aa0',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  itemActive: { backgroundColor: '#0d1520' },
  itemPressed: { backgroundColor: '#1a2234' },
  itemText: { flex: 1, color: '#9caab8', fontSize: 15 },
  itemTextActive: { color: '#5cc8ff', fontWeight: '600' },
  check: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#5cc8ff',
    marginLeft: 10,
  },
  separator: { height: 1, backgroundColor: '#1a2030' },
});
