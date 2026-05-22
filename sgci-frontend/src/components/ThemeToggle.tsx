'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { saveUserPreferences, loadUserPreferences } from '@/lib/preferences';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-label="Thème" disabled>
        <Sun className="w-5 h-5" />
      </Button>
    );
  }

  const isDark = (resolvedTheme ?? theme) === 'dark';

  const toggle = () => {
    const next = isDark ? 'light' : 'dark';
    setTheme(next);
    const prefs = loadUserPreferences();
    saveUserPreferences({ ...prefs, darkMode: next === 'dark' });
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? 'Mode jour' : 'Mode nuit'}
      title={isDark ? 'Passer en mode jour' : 'Passer en mode nuit'}
    >
      {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-700" />}
    </Button>
  );
}
