import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import { fonts, radius, space } from '../../theme/tokens';

// ── Text ──────────────────────────────────────────────────────────────────────

type Variant = 'display' | 'title' | 'heading' | 'body' | 'small' | 'caption' | 'mono';

const variantStyle: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.displayItalic, fontSize: 34, lineHeight: 38, letterSpacing: -0.6 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 23 },
  small: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  mono: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 18 },
};

export function Text({
  variant = 'body',
  tone = 'ink',
  style,
  ...rest
}: TextProps & { variant?: Variant; tone?: 'ink' | 'soft' | 'quiet' | 'accent' | 'danger' | 'ok' | 'onSignal' }) {
  const { colors } = useTheme();
  const color = {
    ink: colors.ink,
    soft: colors.inkSoft,
    quiet: colors.quiet,
    accent: colors.accent,
    danger: colors.danger,
    ok: colors.ok,
    onSignal: colors.onSignal,
  }[tone];
  return <RNText {...rest} style={[variantStyle[variant], { color }, style]} />;
}

// ── Button ────────────────────────────────────────────────────────────────────

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  kind = 'primary',
  loading,
  disabled,
  icon,
  style,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  kind?: ButtonKind;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const bg = kind === 'primary' ? colors.signal : 'transparent';
  const fg = kind === 'primary' ? colors.onSignal : kind === 'danger' ? colors.danger : colors.ink;
  const border = kind === 'secondary' ? colors.ink : kind === 'danger' ? colors.danger : 'transparent';
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      {...rest}
      style={({ pressed }) => [
        {
          minHeight: 48,
          paddingHorizontal: space.lg,
          borderRadius: radius.sm,
          backgroundColor: bg,
          borderWidth: kind === 'secondary' || kind === 'danger' ? 1 : 0,
          borderColor: border,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: space.sm,
          opacity: off ? 0.55 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <RNText style={{ color: fg, fontSize: 16, fontWeight: '600' }}>{title}</RNText>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  name,
  label,
  onPress,
  color,
  size = 22,
  disabled,
}: {
  name: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => ({ padding: 8, opacity: disabled ? 0.4 : pressed ? 0.6 : 1 })}
    >
      <Ionicons name={name} size={size} color={color ?? colors.ink} />
    </Pressable>
  );
}

// ── Inputs ────────────────────────────────────────────────────────────────────

export const TextField = React.forwardRef<TextInput, TextInputProps & { label?: string; hint?: string; error?: string | null }>(
  function TextField({ label, hint, error, style, ...rest }, ref) {
    const { colors } = useTheme();
    return (
      <View style={{ gap: 6 }}>
        {label ? <Text variant="small" tone="soft" style={{ fontWeight: '500' }}>{label}</Text> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.quiet}
          selectionColor={colors.accent}
          {...rest}
          style={[
            {
              minHeight: 48,
              borderWidth: 1,
              borderColor: error ? colors.danger : colors.rule,
              borderRadius: radius.sm,
              paddingHorizontal: space.md,
              paddingVertical: 10,
              fontSize: 16,
              color: colors.ink,
              backgroundColor: colors.paperDeep,
            },
            style,
          ]}
        />
        {error ? <Text variant="small" tone="danger">{error}</Text> : hint ? <Text variant="caption" tone="quiet">{hint}</Text> : null}
      </View>
    );
  },
);

// ── Layout helpers ────────────────────────────────────────────────────────────

export function Divider({ inset = 0 }: { inset?: number }) {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.rule, marginLeft: inset }} />;
}

export function Centered({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md, backgroundColor: colors.paper }, style]}>
      {children}
    </View>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <Centered>
      <ActivityIndicator color={colors.ink} size="large" />
    </Centered>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Centered>
      <Text variant="body" tone="soft" style={{ textAlign: 'center' }}>{message}</Text>
      {onRetry ? <Button title="Try again" kind="secondary" onPress={onRetry} /> : null}
    </Centered>
  );
}

export function EmptyState({ title, body, icon }: { title: string; body?: string; icon?: keyof typeof Ionicons.glyphMap }) {
  const { colors } = useTheme();
  return (
    <Centered>
      {icon ? <Ionicons name={icon} size={36} color={colors.quiet} /> : null}
      <Text variant="title" style={{ textAlign: 'center' }}>{title}</Text>
      {body ? <Text variant="small" tone="quiet" style={{ textAlign: 'center', maxWidth: 300 }}>{body}</Text> : null}
    </Centered>
  );
}

export function Chip({ label, tone = 'quiet' }: { label: string; tone?: 'quiet' | 'ok' | 'danger' | 'signal' }) {
  const styles = useStyles((c) => ({
    quiet: { borderColor: c.rule, color: c.quiet, backgroundColor: 'transparent' },
    ok: { borderColor: c.ok, color: c.ok, backgroundColor: 'transparent' },
    danger: { borderColor: c.danger, color: c.danger, backgroundColor: 'transparent' },
    signal: { borderColor: c.signal, color: c.onSignal, backgroundColor: c.signal },
  }));
  const s = styles[tone];
  return (
    <View style={{ borderWidth: 1, borderColor: s.borderColor, backgroundColor: s.backgroundColor, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
      <RNText style={{ color: s.color, fontSize: 12, fontWeight: '600' }}>{label}</RNText>
    </View>
  );
}

export function SectionHeader({ title }: { title: string }) {
  return (
    <Text variant="caption" tone="quiet" style={{ textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: space.sm }}>
      {title}
    </Text>
  );
}

/** A tappable settings-style row. */
export function Row({
  title,
  subtitle,
  icon,
  onPress,
  right,
  danger,
}: {
  title: string;
  subtitle?: string | null;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        minHeight: 56,
        backgroundColor: pressed ? colors.paperDeep : colors.paper,
      })}
    >
      {icon ? <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.inkSoft} /> : null}
      <View style={{ flex: 1 }}>
        <Text variant="body" tone={danger ? 'danger' : 'ink'}>{title}</Text>
        {subtitle ? <Text variant="small" tone="quiet" numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.quiet} /> : null)}
    </Pressable>
  );
}
