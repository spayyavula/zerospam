import React, { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import TrialEndedScreen from '../features/billing/TrialEndedScreen';
import { Loading } from '../components/ui';

export default function RootNavigator() {
  const status = useAuthStore((s) => s.status);
  const locked = useAuthStore((s) => s.locked);
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const qc = useQueryClient();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // Never show one account's cached mail to the next person who signs in.
  useEffect(() => {
    if (status === 'unauthenticated') qc.clear();
  }, [status, qc]);

  if (status === 'unknown') return <Loading />;
  if (status === 'unauthenticated') return <AuthNavigator />;
  if (locked) return <TrialEndedScreen />;
  return <MainNavigator />;
}
