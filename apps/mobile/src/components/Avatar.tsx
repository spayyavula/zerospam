import React from 'react';
import { View } from 'react-native';
import { Text } from './ui';
import { useTheme } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { initials, tintIndex } from '../lib/format';

// Quiet paper tints so a list of senders is easy to scan without turning into confetti.
const LIGHT = ['#EFE3C2', '#E2E8D3', '#DCE5EB', '#EBDCE2', '#E5DFEF', '#F0E1D1'];
const DARK = ['#3A3320', '#2C3325', '#263038', '#3A2A30', '#302C3A', '#3A2E22'];

/** Initials on a tint picked from the sender's address, so the same sender keeps its colour. */
export default function Avatar({ label, address, size = 40 }: { label: string; address: string; size?: number }) {
  const { scheme, colors } = useTheme();
  const bg = (scheme === 'dark' ? DARK : LIGHT)[tintIndex(address.toLowerCase(), LIGHT.length)];
  return (
    <View
      accessible={false}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ fontFamily: fonts.display, fontSize: size * 0.4, lineHeight: size * 0.5, color: colors.ink }}>{initials(label)}</Text>
    </View>
  );
}
