import React from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { AliasMode, ForwardTarget } from '@zerospam/shared-api';
import { Text } from '../../components/ui';
import { MODE_LABEL } from '../../hooks/useAliases';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';

function Option({ selected, disabled, title, hint, onPress }: { selected: boolean; disabled?: boolean; title: string; hint?: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: space.md,
        alignItems: 'center',
        padding: space.md,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: selected ? colors.ink : colors.rule,
        backgroundColor: pressed ? colors.paperDeep : colors.paper,
        opacity: disabled ? 0.45 : 1,
      })}
    >
      <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? colors.ink : colors.quiet} />
      <View style={{ flex: 1 }}>
        <Text variant="body" style={{ fontWeight: selected ? '600' : '400' }}>{title}</Text>
        {hint ? <Text variant="small" tone="quiet">{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

/**
 * Delivery mode plus (for forward modes) which verified address to forward to.
 * Forwarding modes are disabled until the account has a verified forwarding address.
 */
export default function ForwardingPicker({
  mode,
  targetId,
  targets,
  onChange,
}: {
  mode: AliasMode;
  targetId: number | null;
  targets: ForwardTarget[];
  onChange: (mode: AliasMode, targetId: number | null) => void;
}) {
  const navigation = useNavigation();
  const verified = targets.filter((t) => t.verified_at);
  const pending = targets.filter((t) => !t.verified_at);

  return (
    <View style={{ gap: space.sm }}>
      {(['store', 'forward', 'both'] as AliasMode[]).map((m) => (
        <Option
          key={m}
          selected={mode === m}
          disabled={m !== 'store' && verified.length === 0}
          title={MODE_LABEL[m].title}
          hint={MODE_LABEL[m].hint}
          onPress={() => onChange(m, m === 'store' ? targetId : targetId ?? verified[0]?.id ?? null)}
        />
      ))}

      {verified.length === 0 ? (
        <Text variant="small" tone="quiet">
          To forward, add the address where you want mail delivered and confirm it from that inbox.
          {pending.length ? ` Waiting for confirmation: ${pending.map((p) => p.email).join(', ')}.` : ''}
        </Text>
      ) : null}

      {mode !== 'store' && verified.length > 0 ? (
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          <Text variant="small" tone="soft" style={{ fontWeight: '600' }}>Forward to</Text>
          {verified.map((t) => (
            <Option key={t.id} selected={t.id === targetId} title={t.email} onPress={() => onChange(mode, t.id)} />
          ))}
        </View>
      ) : null}

      <Pressable onPress={() => navigation.navigate('ForwardTargets')} accessibilityRole="button" style={{ paddingVertical: space.sm }}>
        <Text variant="small" tone="accent" style={{ fontWeight: '600' }}>Manage forwarding addresses</Text>
      </Pressable>
    </View>
  );
}
