import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { AuthGuard } from '@/components/AuthGuard';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SGCI Bénin - Dashboard Premium',
  description: 'Système de Gestion Commerciale Intelligente - Version Élite',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="dark">
      <body className={inter.className}>
        <AuthProvider>
          <AuthGuard>{children}</AuthGuard>
          {/* 🔥 AJOUT CRITIQUE : Toaster pour les notifications */}
          <Toaster 
            position="top-right"
            richColors
            closeButton
            duration={4000}
            expand={true}
          />
        </AuthProvider>
      </body>
    </html>
  );
}