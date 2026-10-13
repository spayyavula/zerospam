import React, { useRef, useState } from 'react';
import { Pressable, type TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import AuthLayout from './AuthLayout';
import { Button, Text, TextField } from '../../components/ui';
import { useAuthStore, type LoginResult } from '../../stores/authStore';
import { WEB_URL } from '../../config';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export const LOGIN_ERRORS: Record<Exclude<LoginResult, null | 'needs_totp'>, string> = {
  invalid_credentials: 'That email and password don’t match. If you just signed up, confirm your email first.',
  bad_code: 'That code is wrong or expired.',
  rate_limited: 'Too many attempts. Wait a minute and try again.',
  invalid_input: 'Check your email address and password.',
  network_error: 'Can’t reach ZeroSpam. Check your connection.',
};

export default function LoginScreen({ navigation }: Props) {
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    setError(null);
    const e = email.trim();
    if (!e || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    const result = await login(e, password);
    setLoading(false);
    if (result === 'needs_totp') {
      navigation.navigate('Totp', { email: e, password });
      return;
    }
    if (result) setError(LOGIN_ERRORS[result]);
  };

  return (
    <AuthLayout title="Sign in" subtitle="Your inbox, with only the people you’ve approved.">
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        placeholder="you@example.com"
      />
      <TextField
        ref={passwordRef}
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="password"
        autoComplete="current-password"
        returnKeyType="go"
        onSubmitEditing={submit}
        error={error}
      />
      <Button title="Sign in" onPress={submit} loading={loading} />
      <Button title="Create an account" kind="ghost" onPress={() => navigation.navigate('Signup')} />
      <Pressable
        onPress={() => void WebBrowser.openBrowserAsync(WEB_URL)}
        accessibilityRole="link"
        style={{ alignSelf: 'center', padding: 8 }}
      >
        <Text variant="small" tone="quiet">Forgot your password? Reset it on zero-spam.email</Text>
      </Pressable>
    </AuthLayout>
  );
}
