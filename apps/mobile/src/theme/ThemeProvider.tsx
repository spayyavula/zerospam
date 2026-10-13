import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { dark, light, type Palette } from './tokens';
import { getPref, setPref } from '../lib/prefs';

export type ThemeChoice = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  colors: Palette;
  scheme: 'light' | 'dark';
  choice: ThemeChoice;
  setChoice: (c: ThemeChoice) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  colors: light,
  scheme: 'light',
  choice: 'system',
  setChoice: () => {},
});

const PREF_KEY = 'theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [choice, setChoiceState] = useState<ThemeChoice>('system');

  useEffect(() => {
    void getPref(PREF_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setChoiceState(v);
    });
  }, []);

  const scheme: 'light' | 'dark' = choice === 'system' ? (system === 'dark' ? 'dark' : 'light') : choice;
  const colors = scheme === 'dark' ? dark : light;

  // Root view background shows behind screen transitions and the keyboard.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.paper).catch(() => {});
  }, [colors.paper]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors,
      scheme,
      choice,
      setChoice: (c) => {
        setChoiceState(c);
        void setPref(PREF_KEY, c);
      },
    }),
    [colors, scheme, choice],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * Memoised StyleSheet factory bound to the active palette:
 *   const styles = useStyles((c) => ({ root: { backgroundColor: c.paper } }));
 */
export function useStyles<T>(factory: (c: Palette) => T): T {
  const { colors } = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => factory(colors), [colors]);
}
