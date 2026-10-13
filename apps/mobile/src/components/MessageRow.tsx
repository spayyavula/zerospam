import React, { useRef } from 'react';
import { Pressable, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Ionicons } from '@expo/vector-icons';
import type { MessageSummary } from '@zerospam/shared-api';
import { Text } from './ui';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { expiresIn, parseAddressList, senderLabel, shortDate } from '../lib/format';

export type SwipeAction = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'danger' | 'neutral' | 'signal';
  onAction: () => void;
};

function ActionPanel({ action, align }: { action: SwipeAction; align: 'left' | 'right' }) {
  const { colors } = useTheme();
  const bg = action.tone === 'danger' ? colors.danger : action.tone === 'signal' ? colors.signal : colors.inkSoft;
  const fg = action.tone === 'signal' ? colors.onSignal : colors.paper;
  return (
    <View
      style={{
        width: 104,
        backgroundColor: bg,
        justifyContent: 'center',
        alignItems: align === 'left' ? 'flex-start' : 'flex-end',
        paddingHorizontal: space.xl,
      }}
    >
      <Ionicons name={action.icon} size={22} color={fg} />
      <Text variant="caption" style={{ color: fg, marginTop: 2 }}>{action.label}</Text>
    </View>
  );
}

export default function MessageRow({
  message,
  onPress,
  showRecipient,
  leftAction,
  rightAction,
}: {
  message: MessageSummary;
  onPress: () => void;
  /** Sent folder: show who it went to instead of who sent it. */
  showRecipient?: boolean;
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
}) {
  const { colors } = useTheme();
  const ref = useRef<SwipeableMethods>(null);
  const unread = !message.read && !showRecipient;
  const who = showRecipient
    ? `To: ${parseAddressList(message.to_addresses).join(', ') || '—'}`
    : senderLabel(message);

  const row = (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${who}. ${message.subject ?? 'No subject'}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: space.md,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        backgroundColor: pressed ? colors.paperDeep : colors.paper,
      })}
    >
      <View style={{ width: 8, paddingTop: 7 }}>
        {unread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.signal }} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
          <Text
            variant="body"
            numberOfLines={1}
            style={{ flex: 1, fontWeight: unread ? '700' : '500' }}
          >
            {who}
          </Text>
          <Text variant="caption" tone={unread ? 'ink' : 'quiet'}>{shortDate(message.received_at)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text variant="small" numberOfLines={1} style={{ flex: 1, fontWeight: unread ? '600' : '400' }}>
            {message.subject?.trim() || '(no subject)'}
          </Text>
          {message.attachment_count > 0 ? <Ionicons name="attach" size={15} color={colors.quiet} /> : null}
          {message.starred ? <Ionicons name="star" size={14} color={colors.signal} /> : null}
        </View>
        {message.preview ? (
          <Text variant="small" tone="quiet" numberOfLines={2}>{message.preview}</Text>
        ) : null}
        {message.folder === 'quarantine' && message.expires_at ? (
          <Text variant="caption" tone="quiet">Deleted {expiresIn(message.expires_at)}</Text>
        ) : null}
      </View>
    </Pressable>
  );

  if (!leftAction && !rightAction) return row;

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      leftThreshold={80}
      rightThreshold={80}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={leftAction ? () => <ActionPanel action={leftAction} align="left" /> : undefined}
      renderRightActions={rightAction ? () => <ActionPanel action={rightAction} align="right" /> : undefined}
      onSwipeableOpen={(direction) => {
        // 'right' = the row moved right, revealing the left panel.
        const action = direction === 'right' ? leftAction : rightAction;
        ref.current?.close();
        action?.onAction();
      }}
    >
      {row}
    </ReanimatedSwipeable>
  );
}
