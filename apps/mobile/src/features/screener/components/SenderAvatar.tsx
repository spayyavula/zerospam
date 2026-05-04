import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
];

function colorForAddress(address: string): string {
  let h = 0;
  for (let i = 0; i < address.length; i++) {
    h = (h * 31 + address.charCodeAt(i)) % COLORS.length;
  }
  return COLORS[Math.abs(h) % COLORS.length] ?? '#3b82f6';
}

function initials(name: string | null, address: string): string {
  const src = (name?.trim() || address.split('@')[0] || '?').trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

type Props = { name: string | null; address: string; size?: number };

export default function SenderAvatar({ name, address, size = 44 }: Props) {
  const color = useMemo(() => colorForAddress(address), [address]);
  const text = useMemo(() => initials(name, address), [name, address]);

  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color + '33' },
      ]}
    >
      <Text style={[styles.text, { color, fontSize: size * 0.36 }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  text: { fontWeight: '700' },
});
