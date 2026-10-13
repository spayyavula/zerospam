import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from './types';
import LoginScreen from '../features/auth/LoginScreen';
import TotpScreen from '../features/auth/TotpScreen';
import SignupScreen from '../features/auth/SignupScreen';
import { useTheme } from '../theme/ThemeProvider';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.paper },
        headerTintColor: colors.ink,
        headerShadowVisible: false,
        headerTitle: '',
        contentStyle: { backgroundColor: colors.paper },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Totp" component={TotpScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
}
