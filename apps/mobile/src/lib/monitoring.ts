/**
 * Lightweight screen-view tracking for the ZeroSpam mobile app.
 *
 * Usage — mount <ScreenTracker /> inside NavigationContainer:
 *
 *   <NavigationContainer onStateChange={onNavigationStateChange}>
 *     ...
 *   </NavigationContainer>
 *
 * Or call `trackScreenView(name)` directly from any screen.
 *
 * Pluggable: call `addScreenTransport` to forward events to analytics
 * (e.g. Amplitude, PostHog) without changing this module.
 */

import { useRef, useEffect } from 'react';
import type { NavigationContainerRef, NavigationState } from '@react-navigation/native';
import { logger } from './logger';

type ScreenTransport = (screenName: string, params?: Record<string, unknown>) => void;

const screenTransports: ScreenTransport[] = [];

export function addScreenTransport(fn: ScreenTransport): void {
  screenTransports.push(fn);
}

export function trackScreenView(screenName: string, params?: Record<string, unknown>): void {
  logger.info('screen_view', { screen: screenName, ...params });
  for (const t of screenTransports) {
    try {
      t(screenName, params);
    } catch {
      // Never let a transport crash the app.
    }
  }
}

/**
 * Derives the active route name from navigation state (handles nested stacks).
 */
function getActiveRouteName(state: NavigationState | undefined): string | undefined {
  if (!state) return undefined;
  const route = state.routes[state.index];
  if (!route) return undefined;
  // Recurse into nested navigators.
  if (route.state) {
    return getActiveRouteName(route.state as NavigationState);
  }
  return route.name;
}

/**
 * Hook to wire into NavigationContainer's `onStateChange`.
 * Returns a callback to pass to `onStateChange`.
 *
 * Example:
 *   const onNavStateChange = useNavigationTracking(navigationRef);
 *   <NavigationContainer ref={navigationRef} onStateChange={onNavStateChange}>
 */
export function useNavigationTracking(
  navigationRef: React.RefObject<NavigationContainerRef<ReactNavigation.RootParamList> | null>,
): (state: NavigationState | undefined) => void {
  const routeNameRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    // Capture initial route on mount.
    const currentName = navigationRef.current?.getCurrentRoute()?.name;
    routeNameRef.current = currentName;
    if (currentName) trackScreenView(currentName);
  }, [navigationRef]);

  return (state: NavigationState | undefined) => {
    const previousRoute = routeNameRef.current;
    const currentRoute = getActiveRouteName(state);
    if (currentRoute && currentRoute !== previousRoute) {
      trackScreenView(currentRoute);
      routeNameRef.current = currentRoute;
    }
  };
}
