import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from './types';
import LoginScreen from '../features/auth/LoginScreen';
import TotpScreen from '../features/auth/TotpScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0b0e14' },
        headerTintColor: '#dbe3ef',
        headerShadowVisible: false,
        contentStyle: { backgroundColor: '#0b0e14' },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="Totp"
        component={TotpScreen}
        options={{ title: 'Verification' }}
      />
    </Stack.Navigator>
  );
}
