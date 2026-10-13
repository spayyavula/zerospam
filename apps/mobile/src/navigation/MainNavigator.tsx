import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { AppStackParamList, MainTabParamList } from './types';
import { useCounts, useMailboxes } from '../hooks/useApi';
import { useMailboxStore } from '../stores/mailboxStore';
import { useTheme } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import MailScreen from '../features/messages/MailScreen';
import QuarantineScreen from '../features/messages/QuarantineScreen';
import MessageScreen from '../features/messages/MessageScreen';
import ScreenerScreen from '../features/screener/ScreenerScreen';
import ComposeScreen from '../features/compose/ComposeScreen';
import SearchScreen from '../features/search/SearchScreen';
import MoreScreen from '../features/more/MoreScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<AppStackParamList>();

function icon(name: keyof typeof Ionicons.glyphMap, focusedName: keyof typeof Ionicons.glyphMap) {
  return function TabIcon({ focused, color, size }: { focused: boolean; color: string; size: number }) {
    return <Ionicons name={focused ? focusedName : name} color={color} size={size} />;
  };
}

function useHeaderOptions() {
  const { colors } = useTheme();
  return {
    headerStyle: { backgroundColor: colors.paper },
    headerTintColor: colors.ink,
    headerShadowVisible: false,
    headerTitleStyle: { fontFamily: fonts.displayItalic, fontSize: 22, color: colors.ink },
    contentStyle: { backgroundColor: colors.paper },
  } as const;
}

function Tabs() {
  const { colors } = useTheme();
  const header = useHeaderOptions();
  const mailboxId = useMailboxStore((s) => s.activeMailboxId);
  const counts = useCounts(mailboxId);
  const waiting = counts.data?.screener.total ?? 0;
  const unread = counts.data?.inbox.unread ?? 0;

  return (
    <Tab.Navigator
      screenOptions={{
        ...header,
        sceneStyle: { backgroundColor: colors.paper },
        tabBarStyle: { backgroundColor: colors.paper, borderTopColor: colors.rule },
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.quiet,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarBadgeStyle: { backgroundColor: colors.signal, color: colors.onSignal, fontSize: 10, fontWeight: '700' },
      }}
    >
      <Tab.Screen
        name="Mail"
        component={MailScreen}
        options={{ tabBarIcon: icon('mail-outline', 'mail'), tabBarBadge: unread ? (unread > 99 ? '99+' : unread) : undefined }}
      />
      <Tab.Screen
        name="Screener"
        component={ScreenerScreen}
        options={{ tabBarIcon: icon('people-outline', 'people'), tabBarBadge: waiting ? waiting : undefined }}
      />
      <Tab.Screen name="Quarantine" component={QuarantineScreen} options={{ tabBarIcon: icon('shield-outline', 'shield') }} />
      <Tab.Screen name="More" component={MoreScreen} options={{ tabBarIcon: icon('ellipsis-horizontal-circle-outline', 'ellipsis-horizontal-circle') }} />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  useMailboxes();
  const header = useHeaderOptions();
  return (
    <Stack.Navigator screenOptions={header}>
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="Message" component={MessageScreen} options={{ title: '' }} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen
        name="Compose"
        component={ComposeScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom', headerTitleStyle: { ...header.headerTitleStyle, fontSize: 20 } }}
      />
    </Stack.Navigator>
  );
}
