'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';

interface AppNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  read_at: string | null;
  created_at: string;
}

export function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [cRes, listRes] = await Promise.all([
        apiFetch('/notifications/unread-count'),
        apiFetch('/notifications?unread_only=1&per_page=10'),
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

  const markAll = async () => {
    await apiFetch('/notifications/mark-all-read', { method: 'POST' });
    setCount(0);
    setItems([]);
    toast.success('Notifications lues');
  };

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)} aria-label="Notifications">
        <Bell className="w-5 h-5" />
        {count > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs">{count}</Badge>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 max-h-96 overflow-auto rounded-xl border bg-white dark:bg-slate-900 shadow-xl p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold text-sm">Alertes</span>
            {count > 0 && (
              <button type="button" className="text-xs text-orange-600" onClick={markAll}>
                Tout lire
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune alerte</p>
          ) : (
            items.map((n) => (
              <div key={n.id} className="py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-xs text-slate-500">{n.message}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
