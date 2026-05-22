'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { applyThemeFromPreferences } from '@/lib/theme-init';

/** Synchronise next-themes avec les préférences SGCI au premier rendu client. */
export function ThemeBootstrap() {
  const { setTheme } = useTheme();

  useEffect(() => {
    applyThemeFromPreferences(setTheme);
  }, [setTheme]);

  return null;
}
