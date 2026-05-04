import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';

export default function RootNavigator() {
  const status = useAuthStore((s) => s.status);
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (status === 'unknown') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#5cc8ff" size="large" />
      </View>
    );
  }

  if (status === 'authenticated') {
    return <MainNavigator />;
  }

  return <AuthNavigator />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#0b0e14',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
