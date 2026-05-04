import React, { useState } from 'react';
import { Text, View, StyleSheet, Pressable } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { MainTabParamList, MessageStackParamList } from './types';
import { useMailboxStore } from '../stores/mailboxStore';
import { useMailboxes, useCounts } from '../hooks/useApi';
import ScreenerScreen from '../features/screener/ScreenerScreen';
import MessageListScreen from '../features/messages/MessageListScreen';
import MessageDetailScreen from '../features/messages/MessageDetailScreen';
import MailboxPickerModal from '../components/MailboxPickerModal';
import SettingsScreen from '../features/settings/SettingsScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const MessageStack = createNativeStackNavigator<MessageStackParamList>();

// ── Stack navigators for Inbox / Quarantine ───────────────────────────────────

function InboxStack() {
  const activeId = useMailboxStore((s) => s.activeMailboxId);
  return (
    <MessageStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0d1117' },
        headerTintColor: '#dbe3ef',
        headerShadowVisible: false,
      }}
    >
      <MessageStack.Screen
        name="MessageList"
        component={MessageListScreen}
        options={{ title: 'Inbox' }}
        initialParams={{ folder: 'inbox', mailboxId: activeId ?? 0 }}
      />
      <MessageStack.Screen
        name="MessageDetail"
        component={MessageDetailScreen}
        options={{ title: 'Message' }}
        initialParams={{ messageId: '' }}
      />
    </MessageStack.Navigator>
  );
}

function QuarantineStack() {
  const activeId = useMailboxStore((s) => s.activeMailboxId);
  return (
    <MessageStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0d1117' },
        headerTintColor: '#dbe3ef',
        headerShadowVisible: false,
      }}
    >
      <MessageStack.Screen
        name="MessageList"
        component={MessageListScreen}
        options={{ title: 'Quarantine' }}
        initialParams={{ folder: 'quarantine', mailboxId: activeId ?? 0 }}
      />
      <MessageStack.Screen
        name="MessageDetail"
        component={MessageDetailScreen}
        options={{ title: 'Message' }}
        initialParams={{ messageId: '' }}
      />
    </MessageStack.Navigator>
  );
}



// ── Bootstrap + shared header components ─────────────────────────────────────

function MailboxBootstrap() {
  useMailboxes();
  return null;
}

function ScreenerTabTitle() {
  const mailboxes = useMailboxStore((s) => s.mailboxes);
  const activeId = useMailboxStore((s) => s.activeMailboxId);
  const active = mailboxes.find((m) => m.id === activeId);
  return (
    <Text style={styles.headerTitle} numberOfLines={1}>
      {active ? active.address : 'Screener'}
    </Text>
  );
}

// Badge showing unread count.
function CountBadge({ folder }: { folder: 'inbox' | 'quarantine' }) {
  const activeId = useMailboxStore((s) => s.activeMailboxId);
  const { data } = useCounts(activeId);
  const count = data?.[folder]?.unread ?? 0;
  if (count === 0) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : String(count)}</Text>
    </View>
  );
}

// ── Mailbox picker button (shared across tabs) ────────────────────────────────

function MailboxPickerButton({ onPress }: { onPress: () => void }) {
  const mailboxes = useMailboxStore((s) => s.mailboxes);
  if (mailboxes.length <= 1) return null;
  return (
    <Pressable
      style={styles.pickerButton}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Switch mailbox"
    >
      <Text style={styles.pickerButtonText}>⌄</Text>
    </Pressable>
  );
}

// ── Main navigator ─────────────────────────────────────────────────────────────

export default function MainNavigator() {
  const [pickerVisible, setPickerVisible] = useState(false);

  return (
    <>
      <MailboxBootstrap />
      <MailboxPickerModal visible={pickerVisible} onClose={() => setPickerVisible(false)} />
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#0d1117' },
          headerTintColor: '#dbe3ef',
          headerShadowVisible: false,
          tabBarStyle: { backgroundColor: '#0d1117', borderTopColor: '#1e2736' },
          tabBarActiveTintColor: '#5cc8ff',
          tabBarInactiveTintColor: '#4a5568',
          headerRight: () => <MailboxPickerButton onPress={() => setPickerVisible(true)} />,
        }}
      >
        <Tab.Screen
          name="Screener"
          component={ScreenerScreen}
          options={{
            headerTitle: () => <ScreenerTabTitle />,
          }}
        />
        <Tab.Screen
          name="Inbox"
          component={InboxStack}
          options={{
            headerShown: false,
            tabBarLabel: 'Inbox',
            tabBarBadge: undefined,
          }}
        />
        <Tab.Screen
          name="Quarantine"
          component={QuarantineStack}
          options={{
            headerShown: false,
            tabBarLabel: 'Quarantine',
          }}
        />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerTitle: {
    color: '#dbe3ef',
    fontSize: 16,
    fontWeight: '700',
    maxWidth: 240,
  },
  badge: {
    backgroundColor: '#5cc8ff',
    borderRadius: 8,
    minWidth: 16,
    paddingHorizontal: 4,
    alignItems: 'center',
    marginLeft: 4,
  },
  badgeText: { color: '#0b0e14', fontSize: 10, fontWeight: '700' },
  pickerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pickerButtonText: {
    color: '#5cc8ff',
    fontSize: 20,
    lineHeight: 22,
  },
});


