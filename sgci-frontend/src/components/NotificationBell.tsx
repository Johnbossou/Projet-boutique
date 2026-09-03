'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';

interface AppNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  data: {
    produit_id?: number;
    [key: string]: unknown;
  } | null;
  read_at: string | null;
  created_at: string;
}

const TYPE_META: Record<string, { icon: typeof Bell; dot: string; text: string; bar: string; tint: string }> = {
  stock_alerte: {
    icon: Package,
    dot: 'bg-amber-500',
    text: 'text-amber-500',
    bar: 'border-l-amber-500',
    tint: 'bg-amber-50 dark:bg-amber-500/10',
  },
  stock_rupture: {
    icon: PackageX,
    dot: 'bg-red-500',
    text: 'text-red-500',
    bar: 'border-l-red-500',
    tint: 'bg-red-50 dark:bg-red-500/10',
  },
  vente: {
    icon: ShoppingCart,
    dot: 'bg-green-500',
    text: 'text-green-500',
    bar: 'border-l-green-500',
    tint: 'bg-green-50 dark:bg-green-500/10',
  },
  user: {
    icon: Users,
    dot: 'bg-blue-500',
    text: 'text-blue-500',
    bar: 'border-l-blue-500',
    tint: 'bg-blue-50 dark:bg-blue-500/10',
  },
  paiement: {
    icon: DollarSign,
    dot: 'bg-purple-500',
    text: 'text-purple-500',
    bar: 'border-l-purple-500',
    tint: 'bg-purple-50 dark:bg-purple-500/10',
  },
};

const DEFAULT_META = {
  icon: Bell,
  dot: 'bg-slate-400',
  text: 'text-slate-400',
  bar: 'border-l-slate-400',
  tint: 'bg-slate-50 dark:bg-slate-500/10',
};

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const thatDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((today - thatDay) / 86400000);
  if (dayDiff === 0) return `aujourd'hui, ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  if (dayDiff === 1) return `hier, ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  if (dayDiff < 7) return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [cRes, listRes] = await Promise.all([
        apiFetch('/notifications/unread-count'),
        apiFetch('/notifications?unread_only=1&per_page=12'),
      ]);
      if (cRes.ok) {
        const c = await cRes.json();
        setCount(c.count ?? 0);
      }
      if (listRes.ok) {
        const d = await listRes.json();
        setItems(Array.isArray(d.data) ? d.data : []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
  }, [refresh]);

  // Fermer au clic extérieur
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const markOne = async (n: AppNotification) => {
    await apiFetch(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => undefined);
    setItems((prev) => prev.filter((x) => x.id !== n.id));
    setCount((c) => Math.max(0, c - 1));
  };

  const markAll = async () => {
    await apiFetch('/notifications/mark-all-read', { method: 'POST' }).catch(() => undefined);
    setCount(0);
    setItems([]);
    toast.success('Toutes les notifications marquées comme lues');
  };

  return (
    <div className="relative" ref={rootRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative transition-colors hover:bg-orange-500/10"
      >
        {count > 0 ? <BellRing className="w-5 h-5 text-orange-500" /> : <Bell className="w-5 h-5" />}
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white shadow-sm">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 z-50 w-80 sm:w-96 overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">Notifications</span>
                  {count > 0 && (
                    <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[11px]">
                      {count} non lue{count > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                {count > 0 && (
                  <Button variant="ghost" size="sm" onClick={markAll} className="h-7 gap-1 px-2 text-xs text-orange-600 hover:text-orange-700">
                    <CheckCheck className="w-3.5 h-3.5" />
                    Tout lire
                  </Button>
                )}
              </div>

              {/* Liste */}
              <div className="max-h-96 overflow-y-auto">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                    <Inbox className="w-10 h-10 mb-2 opacity-50" />
                    <p className="text-sm">Vous êtes à jour !</p>
                  </div>
                ) : (
                  items.map((n) => {
                    const meta = TYPE_META[n.type] ?? DEFAULT_META;
                    const Icon = meta.icon;
                    return (
                      <motion.button
                        key={n.id}
                        type="button"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={() => markOne(n)}
                        className={`block w-full border-b border-border/60 text-left transition-colors last:border-0 hover:bg-accent/50 ${meta.tint}`}
                      >
                        <div className={`flex items-start gap-3 border-l-4 px-4 py-3 ${meta.bar}`}>
                          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.tint} ${meta.dot} bg-opacity-10`}>
                            <Icon className={`h-4 w-4 ${meta.text}`} />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-sm font-medium">{n.title}</span>
                              <span className="shrink-0 text-[11px] text-muted-foreground">{formatRelative(n.created_at)}</span>
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">{n.message}</span>
                          </span>
                          <Check className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-50" />
                        </div>
                      </motion.button>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-border px-4 py-2 text-center">
                <span className="text-[11px] text-muted-foreground">Cliquez sur une alerte pour la marquer comme lue</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}