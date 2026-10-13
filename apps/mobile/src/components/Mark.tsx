import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

/**
 * The ZeroSpam mark: a bold zero with a mail slot through it (it also reads as Ø, the
 * empty set). Same geometry as the app icon (apps/mobile/scripts/make-icons.py).
 * `gap` is the colour behind the slot — pass the surface colour it sits on.
 */
export default function Mark({ size = 48, color, gap }: { size?: number; color: string; gap: string }) {
  // 100-unit box: ring 60x72 outer, 34x46 inner; slot band 72x8, bar 60x5.
  const ring =
    'M50 14 A30 36 0 1 0 50 86 A30 36 0 1 0 50 14 Z ' + // outer
    'M50 27 A17 23 0 1 1 50 73 A17 23 0 1 1 50 27 Z'; // inner (opposite sweep = hole)
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityRole="image" accessibilityLabel="ZeroSpam">
      <Path d={ring} fill={color} fillRule="evenodd" />
      <Rect x={14} y={46} width={72} height={8} rx={4} fill={gap} />
      <Rect x={20} y={47.5} width={60} height={5} rx={2.5} fill={color} />
    </Svg>
  );
}
