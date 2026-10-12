import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AuthLayout from './AuthLayout';
import { LOGIN_ERRORS } from './LoginScreen';
import { Button, TextField } from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Totp'>;

export default function TotpScreen({ route }: Props) {
  const { email, password } = route.params;
  const login = useAuthStore((s) => s.login);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (value = code) => {
    setError(null);
    const c = value.replace(/\s/g, '');
    if (!/^\d{6}$/.test(c)) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setLoading(true);
    const result = await login(email, password, c);
    setLoading(false);
    if (result && result !== 'needs_totp') setError(LOGIN_ERRORS[result]);
  };

  return (
    <AuthLayout title="Verification" subtitle="Enter the 6-digit code from your authenticator app." showMark={false}>
      <TextField
        label="Code"
        value={code}
        onChangeText={(v) => {
          const digits = v.replace(/\D/g, '').slice(0, 6);
          setCode(digits);
          if (digits.length === 6) void submit(digits);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }}
        error={error}
      />
      <Button title="Verify" onPress={() => void submit()} loading={loading} />
    </AuthLayout>
  );
}
