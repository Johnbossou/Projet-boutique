import { loadUserPreferences } from '@/lib/preferences';

/** Applique le thème stocké dans les préférences SGCI au premier chargement client. */
export function applyThemeFromPreferences(setTheme: (t: string) => void): void {
  const prefs = loadUserPreferences();
  setTheme(prefs.darkMode ? 'dark' : 'light');
}
