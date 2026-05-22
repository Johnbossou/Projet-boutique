import { useSgciTheme } from '@/contexts/ThemeContext';

/** Thème jour/nuit piloté par les préférences SGCI (pas le thème système). */
export function useColorScheme(): 'light' | 'dark' {
  const { colorScheme, ready } = useSgciTheme();
  if (!ready) return 'dark';
  return colorScheme;
}
