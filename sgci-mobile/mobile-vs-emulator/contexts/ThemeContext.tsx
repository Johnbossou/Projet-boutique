import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  loadUserPreferences,
  saveUserPreferences,
} from '@/lib/preferences';

export type ColorScheme = 'light' | 'dark';

interface ThemeContextValue {
  colorScheme: ColorScheme;
  isDark: boolean;
  setDarkMode: (enabled: boolean) => Promise<void>;
  ready: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function SgciThemeProvider({ children }: { children: React.ReactNode }) {
  const [colorScheme, setColorScheme] = useState<ColorScheme>('dark');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadUserPreferences()
      .then((prefs) => {
        setColorScheme(prefs.darkMode ? 'dark' : 'light');
      })
      .finally(() => setReady(true));
  }, []);

  const setDarkMode = useCallback(async (enabled: boolean) => {
    const next: ColorScheme = enabled ? 'dark' : 'light';
    setColorScheme(next);
    const prefs = await loadUserPreferences();
    await saveUserPreferences({ ...prefs, darkMode: enabled });
  }, []);

  const value = useMemo(
    () => ({
      colorScheme,
      isDark: colorScheme === 'dark',
      setDarkMode,
      ready,
    }),
    [colorScheme, setDarkMode, ready]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useSgciTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useSgciTheme doit être utilisé dans SgciThemeProvider');
  }
  return ctx;
}
