'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const PUBLIC_PATHS = ['/', '/login', '/register', '/forgot-password', '/reset-password'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const normalizedPath = pathname.split('?')[0];

    if (!user && !PUBLIC_PATHS.includes(normalizedPath)) {
      router.replace('/login');
    }
  }, [user, isLoading, pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-16 w-16 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
          <p className="text-lg font-medium">Vérification de la session...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
