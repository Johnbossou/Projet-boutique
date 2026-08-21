import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { AuthGuard } from '@/components/AuthGuard';
import { AppChrome } from '@/components/AppChrome';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ThemeBootstrap } from '@/components/ThemeBootstrap';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SGCI Bénin - Dashboard Premium',
  description: 'Système de Gestion Commerciale Intelligente - Version Élite. Gérez votre boutique, vos ventes, vos stocks et vos clients avec notre solution tout-en-un.',
  keywords: ['SGCI', 'Bénin', 'gestion commerciale', 'boutique', 'POS', 'vente', 'stock', 'client', 'caisse', 'inventaire'],
  authors: [{ name: 'SGCI Bénin' }],
  creator: 'SGCI Bénin',
  publisher: 'SGCI Bénin',
  formatDetection: { email: false, address: false, telephone: false },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://sgci.benin'),
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://sgci.benin',
    title: 'SGCI Bénin - Dashboard Premium',
    description: 'Système de Gestion Commerciale Intelligente - Version Élite',
    siteName: 'SGCI Bénin',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SGCI Bénin - Dashboard Premium',
    description: 'Système de Gestion Commerciale Intelligente - Version Élite',
    creator: '@sgci_benin',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-foreground antialiased`}>
        <ThemeProvider>
        <ThemeBootstrap />
        <AuthProvider>
          <ErrorBoundary>
            <AuthGuard>
              <AppChrome>{children}</AppChrome>
            </AuthGuard>
          </ErrorBoundary>
          {/* 🔥 AJOUT CRITIQUE : Toaster pour les notifications */}
          <Toaster 
            position="top-right"
            richColors
            closeButton
            duration={4000}
            expand={true}
          />
        </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}