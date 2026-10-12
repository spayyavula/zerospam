import React, { useMemo, useRef } from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer, type NavigationContainerRef } from '@react-navigation/native';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SourceSerif4_400Regular_Italic } from '@expo-google-fonts/source-serif-4/400Regular_Italic';
import { SourceSerif4_600SemiBold } from '@expo-google-fonts/source-serif-4/600SemiBold';
import RootNavigator from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import ToastHost from './src/components/ToastHost';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { logger } from './src/lib/logger';
import { useNavigationTracking } from './src/lib/monitoring';
import { ApiError } from './src/lib/apiClient';

function logQueryError(error: unknown, context: string): void {
  logger.error('query_error', {
    context,
    message: error instanceof Error ? error.message : String(error),
    status: (error as { status?: number }).status,
  });
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => logQueryError(error, String(query.queryKey[0] ?? 'unknown')),
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) =>
      logQueryError(error, (mutation.options.mutationKey?.[0] as string) ?? 'mutation'),
  }),
  defaultOptions: {
    queries: {
      // Don't retry auth or paywall answers; the session layer handles those.
      retry: (count, err) => !(err instanceof ApiError && [401, 402, 403, 404].includes(err.status ?? 0)) && count < 2,
      staleTime: 30_000,
    },
  },
});

function ThemedApp() {
  const { colors, scheme } = useTheme();
  const navRef = useRef<NavigationContainerRef<ReactNavigation.RootParamList>>(null);
  const onStateChange = useNavigationTracking(navRef);

  const navTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.ink,
        background: colors.paper,
        card: colors.paper,
        text: colors.ink,
        border: colors.rule,
        notification: colors.signal,
      },
    };
  }, [scheme, colors]);

  return (
    <NavigationContainer ref={navRef} theme={navTheme} onStateChange={onStateChange}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <RootNavigator />
      <ToastHost />
    </NavigationContainer>
  );
}

export default function App() {
  // The display serif is decoration; if it fails to load, text falls back to the system serif.
  const [loaded, fontError] = useFonts({ SourceSerif4_400Regular_Italic, SourceSerif4_600SemiBold });
  if (!loaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <QueryClientProvider client={queryClient}>
              <ThemedApp />
            </QueryClientProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
