import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { logger } from '../lib/logger';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional custom fallback. If omitted, the built-in FallbackScreen is rendered. */
  fallback?: React.ReactNode;
}

/**
 * Global error boundary that catches unhandled React render errors,
 * logs them via the centralized logger, and shows a graceful fallback UI.
 *
 * Wrap the NavigationContainer (or individual screens) with this component.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    logger.error('render_error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      componentStack: info.componentStack ?? undefined,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <FallbackScreen
          message={this.state.message}
          onRetry={this.handleReset}
        />
      );
    }
    return this.props.children;
  }
}

// ── Fallback screen ───────────────────────────────────────────────────────────

interface FallbackScreenProps {
  message?: string;
  onRetry?: () => void;
}

export function FallbackScreen({ message, onRetry }: FallbackScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠</Text>
      <Text style={styles.title}>Something went wrong</Text>
      {message ? (
        <Text style={styles.detail}>{message}</Text>
      ) : null}
      {onRetry ? (
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry"
        >
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0e14',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  icon: {
    fontSize: 40,
    marginBottom: 8,
  },
  title: {
    color: '#dbe3ef',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  detail: {
    color: '#4a5568',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 300,
  },
  button: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#2a3241',
    borderRadius: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  buttonPressed: { backgroundColor: '#131820' },
  buttonText: {
    color: '#5cc8ff',
    fontSize: 15,
    fontWeight: '600',
  },
});
