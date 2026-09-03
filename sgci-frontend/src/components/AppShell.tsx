'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Brain,
  MessageCircle,
  Package,
  ShoppingCart,
  Users,
  Settings,
  Store,
  TrendingUp,
  History,
  RotateCcw,
  ClipboardList,
  ScrollText,
  FileText,
  Truck,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { BoutiqueSelector } from '@/components/BoutiqueSelector';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/boutiques', label: 'Mes Boutiques', icon: Store, role: 'proprietaire' },
  { href: '/produits', label: 'Produits', icon: Package },
  { href: '/stock', label: 'Stock', icon: History },
  { href: '/arrivage', label: 'Arrivage', icon: TrendingUp },
  { href: '/approvisionnement', label: 'Approvisionnement', icon: Truck, role: 'gerant' },
  { href: '/caisse', label: 'Caisse', icon: ShoppingCart },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/retours', label: 'Retours', icon: RotateCcw, role: 'gerant' },
  { href: '/inventaire', label: 'Inventaire', icon: ClipboardList, role: 'gerant' },
  { href: '/devis', label: 'Devis', icon: FileText, role: 'gerant' },
  { href: '/messages', label: 'Messages', icon: MessageCircle },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/ia', label: 'Assistant stock', icon: Brain },
  { href: '/parametres', label: 'Paramètres', icon: Settings },
  { href: '/parametres/audit-logs', label: 'Journal d\'audit', icon: ScrollText, role: 'gerant' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const roleCourant = (user?.role_courant || user?.role) as
    | 'proprietaire'
    | 'gerant'
    | 'caissier'
    | undefined;

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-card/80">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm">SGCI Bénin</p>
              <p className="text-xs text-muted-foreground capitalize">
                {roleCourant}{user?.current_boutique?.nom ? ` · ${user.current_boutique.nom}` : ''}
              </p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            // Masquer les items réservés aux propriétaires si le rôle courant n'est pas propriétaire
            if (item.role === 'proprietaire' && roleCourant !== 'proprietaire') {
              return null;
            }
            if (item.role === 'gerant' && roleCourant !== 'gerant' && roleCourant !== 'proprietaire') {
              return null;
            }

            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors',
                  active
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border flex items-center justify-between px-4 lg:px-6 bg-card/60 backdrop-blur sticky top-0 z-40">
          <p className="text-sm font-medium text-muted-foreground lg:hidden">SGCI Bénin</p>
          <div className="flex items-center gap-2 ml-auto">
            <BoutiqueSelector />
            <ThemeToggle />
            <NotificationBell />
            <span className="text-sm text-muted-foreground hidden sm:inline">{user?.name}</span>
            <button
              onClick={() => logout()}
              title="Se déconnecter"
              className="ml-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Déconnexion</span>
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
