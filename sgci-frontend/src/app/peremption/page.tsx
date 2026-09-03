'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, RefreshCw, TriangleAlert, PackageX, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/EmptyState';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';
import type { Produit, PeremptionResult } from '@/types';

function joursRestants(p: Produit): number {
  return p.jours_restants ?? (p.date_peremption ? Math.ceil((new Date(p.date_peremption).getTime() - Date.now()) / 86400000) : 0);
}

function badgePeremption(p: Produit): { label: string; classe: string } {
  const j = joursRestants(p);
  if (j < 0) return { label: `Périmé (${-j} j)`, classe: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' };
  if (j <= 3) return { label: 'Urgent (≤3j)', classe: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200' };
  return { label: `${j} jours restants`, classe: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200' };
}

export default function PeremptionPage() {
  const [proches, setProches] = useState<Produit[]>([]);
  const [perimes, setPerimes] = useState<Produit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const charger = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/peremption/sync?jours_avant=7', { method: 'POST' });
      if (res.ok) {
        const d = await res.json();
        const data: PeremptionResult = d.data ?? d;
        setProches(Array.isArray(data.proches_peremption) ? data.proches_peremption : []);
        setPerimes(Array.isArray(data.perimes) ? data.perimes : []);
      } else {
        toast.error('Erreur lors de la synchronisation des alertes de péremption');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const total = proches.length + perimes.length;
  const valeurPerimes = perimes.reduce((s, p) => s + (p.prix * p.quantite_stock || 0), 0);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center">
          <CalendarClock className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Péremption</h1>
          <p className="text-sm text-muted-foreground">
            Produits périssables proches de la péremption ou périmés de la boutique courante.
          </p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <TriangleAlert className="w-4 h-4 text-amber-500" /> Proches de péremption
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{proches.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <PackageX className="w-4 h-4 text-red-500" /> Périmés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{perimes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Valeur stock périmé</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{valeurPerimes.toLocaleString('fr-FR')} XOF</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={charger} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} /> Synchroniser
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-blue-500" /> Produits périssables
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Synchronisation des alertes…</span>
            </div>
          ) : total === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="Aucune alerte de péremption"
              description="Les produits périssables proches de la péremption ou périmés apparaîtront ici."
              actionLabel="Actualiser"
              onAction={charger}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Date de péremption</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...perimes, ...proches].map((p) => {
                  const b = badgePeremption(p);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.nom}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{p.categorie?.nom ?? '—'}</TableCell>
                      <TableCell className="text-right">{p.quantite_stock} {p.unite_mesure}</TableCell>
                      <TableCell className="text-sm">{p.date_peremption ? new Date(p.date_peremption).toLocaleDateString('fr-FR') : '—'}</TableCell>
                      <TableCell>
                        <Badge className={b.classe}>{b.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}