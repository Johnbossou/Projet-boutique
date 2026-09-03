'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Package,
  PackageX,
  ShoppingCart,
  Users,
  DollarSign,
  Inbox,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';

interface AppNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

const TYPE_META: Record<string, { icon: typeof Bell; text: string; tint: string }> = {
  stock_alerte: { icon: Package, text: 'text-amber-500', tint: 'bg-amber-50 dark:bg-amber-500/10' },
  stock_rupture: { icon: PackageX, text: 'text-red-500', tint: 'bg-red-50 dark:bg-red-500/10' },
  vente: { icon: ShoppingCart, text: 'text-green-500', tint: 'bg-green-50 dark:bg-green-500/10' },
  user: { icon: Users, text: 'text-blue-500', tint: 'bg-blue-50 dark:bg-blue-500/10' },
  paiement: { icon: DollarSign, text: 'text-purple-500', tint: 'bg-purple-50 dark:bg-purple-500/10' },
};

const DEFAULT_META = { icon: Bell, text: 'text-slate-400', tint: 'bg-slate-50 dark:bg-slate-500/10' };

export function RealTimeNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const fetchAll = async () => {
    try {
      const [listRes, countRes] = await Promise.all([
        apiFetch('/notifications?unread_only=1&per_page=15'),
        apiFetch('/notifications/unread-count'),
      ]);
      if (listRes.ok) {
        const d = await listRes.json();
        setNotifications(Array.isArray(d.data) ? d.data : []);
      }
      if (countRes.ok) {
        const c = await countRes.json();
        setUnreadCount(c.count ?? 0);
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [isOpen]);

  const markOne = async (n: AppNotification) => {
    await apiFetch(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => undefined);
    setNotifications((prev) => prev.filter((x) => x.id !== n.id));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAll = async () => {
    await apiFetch('/notifications/mark-all-read', { method: 'POST' }).catch(() => undefined);
    setNotifications([]);
    setUnreadCount(0);
    toast.success('Toutes les notifications marquées comme lues');
  };

  return (
    <div className="relative" ref={rootRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Notifications"
        className="relative hover:bg-orange-500/10"
      >
        {unreadCount > 0 ? <BellRing className="w-5 h-5 text-orange-500" /> : <Bell className="w-5 h-5" />}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 sm:w-96 overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[11px]">
                  {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAll} className="h-7 gap-1 px-2 text-xs text-orange-600">
                <CheckCheck className="w-3.5 h-3.5" />
                Tout lire
              </Button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <Inbox className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">Vous êtes à jour !</p>
              </div>
            ) : (
              notifications.map((n) => {
                const meta = TYPE_META[n.type] ?? DEFAULT_META;
                const Icon = meta.icon;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => markOne(n)}
                    className="block w-full border-b border-border/60 text-left transition-colors last:border-0 hover:bg-accent/50"
                  >
                    <div className="flex items-start gap-3 px-4 py-3">
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.tint}`}>
                        <Icon className={`h-4 w-4 ${meta.text}`} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-sm font-medium">{n.title}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">{n.message}</span>
                      </span>
                      {!n.read_at && <Check className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-50" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}