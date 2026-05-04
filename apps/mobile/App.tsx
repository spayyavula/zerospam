import React, { useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import type { NavigationContainerRef } from '@react-navigation/native';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import RootNavigator from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { logger } from './src/lib/logger';
import { useNavigationTracking } from './src/lib/monitoring';

function logQueryError(error: unknown, context: string): void {
  logger.error('query_error', {
    context,
    message: error instanceof Error ? error.message : String(error),
    status: (error as { status?: number }).status,
  });
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) =>
      logQueryError(error, String(query.queryKey[0] ?? 'unknown')),
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) =>
      logQueryError(error, mutation.options.mutationKey?.[0] as string ?? 'mutation'),
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function AppWithNavTracking() {
  const navRef = useRef<NavigationContainerRef<ReactNavigation.RootParamList>>(null);
  const onStateChange = useNavigationTracking(navRef);

  return (
    <NavigationContainer ref={navRef} onStateChange={onStateChange}>
      <StatusBar style="light" />
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <AppWithNavTracking />
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}


