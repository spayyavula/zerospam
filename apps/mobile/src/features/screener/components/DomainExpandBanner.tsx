import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  domain: string;
  loading: boolean;
  onAccept: () => void;
  onDismiss: () => void;
};

export default function DomainExpandBanner({ domain, loading, onAccept, onDismiss }: Props) {
  return (
    <View style={styles.banner}>
      <View style={styles.textBlock}>
        <Text style={styles.title}>Trust everyone @{domain}?</Text>
        <Text style={styles.sub}>
          Allow all future mail from this domain directly to Inbox.
        </Text>
      </View>
      <View style={styles.actions}>
        {loading ? (
          <ActivityIndicator color="#5cc8ff" style={styles.loader} />
        ) : (
          <>
            <Pressable
              style={[styles.btn, styles.acceptBtn]}
              onPress={onAccept}
              accessibilityRole="button"
              accessibilityLabel={`Trust everyone at ${domain}`}
            >
              <Text style={styles.acceptText}>Trust domain</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.dismissBtn]}
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
            >
              <Text style={styles.dismissText}>Not now</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#0d1a2d',
    borderBottomWidth: 1,
    borderBottomColor: '#1e3a5f',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  textBlock: { flex: 1 },
  title: { color: '#dbe3ef', fontSize: 14, fontWeight: '700' },
  sub: { color: '#7c8aa0', fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  acceptBtn: { backgroundColor: '#5cc8ff' },
  dismissBtn: { backgroundColor: '#1e2736' },
  acceptText: { color: '#0b0e14', fontSize: 13, fontWeight: '700' },
  dismissText: { color: '#7c8aa0', fontSize: 13 },
  loader: { paddingHorizontal: 20 },
});
