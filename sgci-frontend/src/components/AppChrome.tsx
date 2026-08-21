'use client';

import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/AppShell';

const PUBLIC = ['/', '/login', '/register', '/forgot-password', '/reset-password'];

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC.includes(pathname);

  if (isPublic) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}
