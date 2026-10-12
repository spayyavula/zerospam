import React, { useState } from 'react';
import { Text as RNText, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import AuthLayout from './AuthLayout';
import { Button, Text, TextField } from '../../components/ui';
import { apiClient, errorText } from '../../lib/apiClient';
import { useTheme } from '../../theme/ThemeProvider';
import { PRIVACY_URL, TERMS_URL } from '../../config';
import { isEmail } from '../../lib/format';
import { usernameProblem } from '../../lib/validation';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

const DOMAIN = 'zero-spam.email';

export default function SignupScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError(null);
    const u = username.trim().toLowerCase();
    const e = email.trim();
    const problem = usernameProblem(u);
    if (problem) return setError(`Address: ${problem}`);
    if (!isEmail(e)) return setError('Enter the email address you use now, so we can confirm it’s you.');
    if (password.length < 12) return setError('Choose a password of at least 12 characters.');
    setLoading(true);
    try {
      await apiClient.post('/api/auth/signup', { username: u, email: e, password }, { auth: 'omit' });
      setDone(true);
    } catch (err) {
      setError(errorText(err, 'Could not create the account. Try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <AuthLayout title="Check your email" subtitle={`We sent a confirmation link to ${email.trim()}. Open it, then sign in here.`}>
        <Text variant="body" tone="soft">Your new address is {username.trim().toLowerCase()}@{DOMAIN}. Your 3-month free trial starts now.</Text>
        <Button title="Go to sign in" onPress={() => navigation.navigate('Login')} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your address" subtitle="Three months free. Only people you approve reach your inbox.">
      <View style={{ gap: 6 }}>
        <TextField
          label="Your new address"
          value={username}
          onChangeText={(v) => setUsername(v.toLowerCase().replace(/\s/g, ''))}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="yourname"
          hint={`${username.trim() || 'yourname'}@${DOMAIN}`}
        />
      </View>
      <TextField
        label="Current email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        hint="For confirming your account and sign-in. We never share it."
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        hint="At least 12 characters."
        error={error}
      />
      <Button title="Create account" onPress={submit} loading={loading} />
      <RNText style={{ color: colors.quiet, fontSize: 13, lineHeight: 18, textAlign: 'center' }}>
        By creating an account you agree to the{' '}
        <RNText style={{ color: colors.accent }} onPress={() => void WebBrowser.openBrowserAsync(TERMS_URL)}>Terms</RNText>
        {' '}and{' '}
        <RNText style={{ color: colors.accent }} onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_URL)}>Privacy Policy</RNText>.
      </RNText>
      <Button title="I already have an account" kind="ghost" onPress={() => navigation.navigate('Login')} />
    </AuthLayout>
  );
}
