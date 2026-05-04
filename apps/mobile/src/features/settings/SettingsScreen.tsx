import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { useMailboxStore } from '../../stores/mailboxStore';
import { usePatchMailbox } from '../../hooks/useApi';

// ── SLA section ───────────────────────────────────────────────────────────────

function SlaSection() {
  const mailboxes = useMailboxStore((s) => s.mailboxes);
  const activeId = useMailboxStore((s) => s.activeMailboxId);
  const active = mailboxes.find((m) => m.id === activeId);
  const patchMailbox = usePatchMailbox();

  const [value, setValue] = useState(String(active?.screener_sla_hours ?? 48));
  const [success, setSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Keep input in sync when active mailbox changes.
  useEffect(() => {
    if (active) {
      setValue(String(active.screener_sla_hours));
      setSuccess(false);
      setValidationError(null);
    }
  }, [active?.id, active?.screener_sla_hours]);

  function handleSave() {
    setValidationError(null);
    setSuccess(false);

    const num = parseInt(value, 10);
    if (!value.trim() || isNaN(num)) {
      setValidationError('Enter a number between 1 and 720.');
      return;
    }
    if (num < 1 || num > 720) {
      setValidationError('Must be between 1 and 720 hours.');
      return;
    }
    if (!active) return;

    patchMailbox.mutate(
      { mailboxId: active.id, patch: { screenerSlaHours: num } },
      {
        onSuccess: () => setSuccess(true),
        onError: () => setValidationError('Save failed. Please try again.'),
      },
    );
  }

  if (!active) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Screener</Text>
      <Text style={styles.label}>
        Screener SLA window
        <Text style={styles.labelSub}> (hours)</Text>
      </Text>
      <Text style={styles.hint}>
        Senders who haven't been triaged within this window are shown first.
        Range: 1–720.
      </Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, validationError ? styles.inputError : null]}
          value={value}
          onChangeText={(t) => {
            setValue(t);
            setValidationError(null);
            setSuccess(false);
          }}
          keyboardType="number-pad"
          returnKeyType="done"
          maxLength={3}
          accessibilityLabel="Screener SLA hours"
          onSubmitEditing={handleSave}
        />
        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.saveButtonPressed,
            patchMailbox.isPending && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={patchMailbox.isPending}
          accessibilityRole="button"
          accessibilityLabel="Save screener SLA"
        >
          {patchMailbox.isPending ? (
            <ActivityIndicator color="#0b0e14" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </Pressable>
      </View>
      {validationError ? (
        <Text style={styles.errorText}>{validationError}</Text>
      ) : null}
      {success ? (
        <Text style={styles.successText}>Saved ✓</Text>
      ) : null}
    </View>
  );
}

// ── Account section ───────────────────────────────────────────────────────────

function AccountSection() {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const active = useMailboxStore((s) => {
    const { mailboxes, activeMailboxId } = s;
    return mailboxes.find((m) => m.id === activeMailboxId) ?? null;
  });

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Account</Text>
      {user ? (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{user.email}</Text>
        </View>
      ) : null}
      {active ? (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Active mailbox</Text>
          <Text style={styles.infoValue}>{active.address}</Text>
        </View>
      ) : null}
      <Pressable
        style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutButtonPressed]}
        onPress={() => { void logout(); }}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <SlaSection />
        <AccountSection />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#0b0e14' },
  content: { padding: 20, gap: 24 },

  section: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    color: '#5cc8ff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  label: { color: '#dbe3ef', fontSize: 15, fontWeight: '600' },
  labelSub: { color: '#7c8aa0', fontWeight: '400' },
  hint: { color: '#4a5568', fontSize: 13, lineHeight: 18 },

  inputRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 4 },
  input: {
    flex: 1,
    backgroundColor: '#0b0e14',
    borderWidth: 1,
    borderColor: '#2a3241',
    borderRadius: 8,
    color: '#dbe3ef',
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  inputError: { borderColor: '#f87171' },

  saveButton: {
    backgroundColor: '#5cc8ff',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    minWidth: 64,
    alignItems: 'center',
  },
  saveButtonPressed: { opacity: 0.8 },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: '#0b0e14', fontWeight: '700', fontSize: 14 },

  errorText: { color: '#f87171', fontSize: 13 },
  successText: { color: '#4ade80', fontSize: 13 },

  infoRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  infoLabel: { color: '#4a5568', fontSize: 14, width: 100 },
  infoValue: { color: '#9caab8', fontSize: 14, flex: 1 },

  logoutButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#3a1a1a',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutButtonPressed: { backgroundColor: '#1a0f0f' },
  logoutText: { color: '#f87171', fontSize: 14, fontWeight: '600' },
});
