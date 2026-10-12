import React from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { Alias } from '@zerospam/shared-api';
import { Button, Chip, Divider, EmptyState, ErrorState, Loading, Text } from '../../components/ui';
import { useAliases, useAliasUsage } from '../../hooks/useAliases';
import { useMailboxStore } from '../../stores/mailboxStore';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/tokens';
import { errorText } from '../../lib/apiClient';
import { aliasStatus } from './aliasStatus';

function AliasRow({ alias, onPress }: { alias: Alias; onPress: () => void }) {
  const { colors } = useTheme();
  const status = aliasStatus(alias);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${alias.address}${alias.label ? `, ${alias.label}` : ''}, ${status.label}`}
      style={({ pressed }) => ({ paddingHorizontal: space.lg, paddingVertical: space.md, gap: 4, backgroundColor: pressed ? colors.paperDeep : colors.paper })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Text
          variant="body"
          numberOfLines={1}
          style={{ flex: 1, fontWeight: '600', textDecorationLine: status.off ? 'line-through' : 'none', color: status.off ? colors.quiet : colors.ink }}
        >
          {alias.address}
        </Text>
        <Chip label={status.label} tone={status.tone} />
      </View>
      {alias.label ? <Text variant="small" tone="soft" numberOfLines={1}>{alias.label}</Text> : null}
      <Text variant="caption" tone="quiet">
        {alias.received_count} received
        {alias.mode !== 'store' ? ` · ${alias.forwarded_count} forwarded · ${alias.replied_count} replies` : ''}
      </Text>
    </Pressable>
  );
}

export default function AliasesScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const mailboxId = useMailboxStore((s) => s.activeMailboxId);
  const q = useAliases(mailboxId);
  const usage = useAliasUsage();
  const atLimit = !!usage.data && usage.data.count >= usage.data.max;

  if (mailboxId == null || q.isPending) return <Loading />;
  if (q.isError) return <ErrorState message={errorText(q.error, 'Could not load aliases.')} onRetry={() => void q.refetch()} />;

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={(q.data ?? []).length === 0 ? { flexGrow: 1 } : { paddingBottom: space.xxl }}
      data={q.data}
      keyExtractor={(a) => String(a.id)}
      ItemSeparatorComponent={() => <Divider inset={space.lg} />}
      ListHeaderComponent={
        <View style={{ padding: space.lg, gap: space.md, borderBottomWidth: 1, borderBottomColor: colors.rule, backgroundColor: colors.paperDeep }}>
          <Text variant="small" tone="soft">
            Give each site its own address. If one starts getting spam, turn it off — your real address stays private.
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Button
              style={{ flex: 1 }}
              icon="add"
              title="New alias"
              disabled={atLimit}
              onPress={() => navigation.navigate('NewAlias')}
            />
            <Pressable onPress={() => navigation.navigate('ForwardTargets')} accessibilityRole="button" accessibilityLabel="Forwarding addresses" hitSlop={8} style={{ padding: 8 }}>
              <Ionicons name="arrow-redo-outline" size={22} color={colors.ink} />
            </Pressable>
          </View>
          {usage.data ? (
            <Text variant="caption" tone="quiet">
              {atLimit ? `You’ve used all ${usage.data.max} aliases. Delete one to make another.` : `${usage.data.count} of ${usage.data.max} aliases used`}
            </Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={<EmptyState icon="at-outline" title="No aliases yet" body="Make one for the next site that asks for your email." />}
      renderItem={({ item }) => <AliasRow alias={item} onPress={() => navigation.navigate('Alias', { aliasId: item.id })} />}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.ink} colors={[colors.onSignal]} progressBackgroundColor={colors.signal} />}
    />
  );
}
