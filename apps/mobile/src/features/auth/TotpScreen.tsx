import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'Totp'>;

export default function TotpScreen({ route }: Props) {
  const { email, password } = route.params;
  const login = useAuthStore((s) => s.login);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setLoading(true);
    const result = await login(email, password, trimmed);
    setLoading(false);
    if (result !== null && result !== 'needs_totp') {
      setError(
        result === 'invalid_credentials'
          ? 'Code is incorrect or expired.'
          : 'Something went wrong. Try again.',
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.eyebrow}>ZeroSpam</Text>
        <Text style={styles.title}>Two-factor verification</Text>
        <Text style={styles.subtitle}>
          Open your authenticator app and enter the 6-digit code.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>Verification code</Text>
        <TextInput
          style={[styles.input, styles.codeInput]}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          placeholderTextColor="#4a5568"
          placeholder="000000"
          autoFocus
        />

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Verify code"
        >
          {loading ? (
            <ActivityIndicator color="#0b0e14" />
          ) : (
            <Text style={styles.buttonText}>Verify</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0e14' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  eyebrow: {
    color: '#5cc8ff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: '#dbe3ef',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 10,
  },
  subtitle: {
    color: '#7c8aa0',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  label: {
    color: '#7c8aa0',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#161b26',
    borderWidth: 1,
    borderColor: '#2a3241',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#dbe3ef',
    fontSize: 15,
  },
  codeInput: {
    letterSpacing: 6,
    fontSize: 22,
    textAlign: 'center',
  },
  error: {
    color: '#f87171',
    fontSize: 13,
    marginBottom: 8,
  },
  button: {
    marginTop: 26,
    backgroundColor: '#5cc8ff',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#0b0e14', fontSize: 15, fontWeight: '700' },
});
