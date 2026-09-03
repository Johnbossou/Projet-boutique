'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  Plus,
  PackageX,
  CheckCircle2,
  Filter,
  Repeat,
  Truck,
  Clock4,
  Loader2,
  ArrowRightLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/EmptyState';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getEffectiveRole, canGerer } from '@/lib/role';
import type { Boutique, Produit, StatistiquesTransferts, TransfertStock } from '@/types';

const STATUT_COLORS: Record<string, string> = {
  en_attente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  en_cours: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  termine: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  annule: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const STATUT_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  en_cours: 'En cours',
  termine: 'Terminé',
  annule: 'Annulé',
};

export default function TransfertsPage() {
  const { user } = useAuth();
  const roleCourant = getEffectiveRole(user);
  const userPeutGerer = canGerer(user, roleCourant);
  const boutiqueCouranteId = user?.current_boutique_id ?? null;

  const [transferts, setTransferts] = useState<TransfertStock[]>([]);
  const [boutiques, setBoutiques] = useState<Boutique[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [stats, setStats] = useState<StatistiquesTransferts | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [filtreStatut, setFiltreStatut] = useState('all');

  const [creerOuvert, setCreerOuvert] = useState(false);
  const [destId, setDestId] = useState('');
  const [produitId, setProduitId] = useState('');
  const [quantite, setQuantite] = useState('');
  const [motif, setMotif] = useState('');
  const [notes, setNotes] = useState('');

  const destinations = boutiques.filter((b) => b.id !== boutiqueCouranteId);

  const charger = useCallback(async () => {
    setIsLoading(true);
    try {
      const qs = filtreStatut !== 'all' ? `?statut=${filtreStatut}` : '';
      const res = await apiFetch(`/transferts-stock${qs}`);
      if (res.ok) {
        const d = await res.json();
        setTransferts(Array.isArray(d.data) ? d.data : []);
      } else {
        toast.error('Erreur lors du chargement des transferts');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setIsLoading(false);
    }
  }, [filtreStatut]);

  const chargerStats = useCallback(async () => {
    try {
      const res = await apiFetch('/transferts-stock/statistiques');
      if (res.ok) setStats(await res.json());
    } catch {
      /* silencieux */
    }
  }, []);

  const chargerBoutiques = useCallback(async () => {
    try {
      const res = await apiFetch('/mes-boutiques');
      if (res.ok) setBoutiques(await res.json());
    } catch {
      toast.error('Erreur lors du chargement des boutiques');
    }
  }, []);

  const chargerProduits = useCallback(async () => {
    try {
      const res = await apiFetch('/produits?page=1&per_page=200');
      if (res.ok) {
        const d = await res.json();
        setProduits(Array.isArray(d.data) ? d.data : []);
      }
    } catch {
      toast.error('Erreur lors du chargement des produits');
    }
  }, []);

  useEffect(() => {
    charger();
    chargerStats();
    chargerBoutiques();
    chargerProduits();
  }, [charger, chargerStats, chargerBoutiques, chargerProduits]);

  const resetFormulaire = () => {
    setDestId('');
    setProduitId('');
    setQuantite('');
    setMotif('');
    setNotes('');
  };

  const creerTransfert = async () => {
    if (!destId || !produitId || !quantite) {
      toast.error('Choisissez une destination, un produit et une quantité');
      return;
    }
    const q = parseInt(quantite, 10);
    if (!q || q <= 0) {
      toast.error('La quantité doit être un entier positif');
      return;
    }
    setIsSaving(true);
    try {
      const res = await apiFetch('/transferts-stock', {
        method: 'POST',
        body: JSON.stringify({
          boutique_destination_id: parseInt(destId, 10),
          produit_id: parseInt(produitId, 10),
          quantite: q,
          motif: motif || null,
          notes: notes || null,
        }),
      });
      if (res.ok) {
        toast.success('Transfert créé — stock décrémenté');
        setCreerOuvert(false);
        resetFormulaire();
        charger();
        chargerStats();
        chargerProduits();
      } else {
        const d = await res.json();
        toast.error(d.message || 'Erreur lors de la création du transfert');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setIsSaving(false);
    }
  };

  const annulerTransfert = async (t: TransfertStock) => {
    setIsSaving(true);
    try {
      const res = await apiFetch(`/transferts-stock/${t.id}/annuler`, { method: 'POST' });
      if (res.ok) {
        toast.success('Transfert annulé — stock source restauré');
        charger();
        chargerStats();
        chargerProduits();
      } else {
        const d = await res.json();
        toast.error(d.message || 'Impossible d’annuler ce transfert');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setIsSaving(false);
    }
  };

  const recevoirTransfert = async (t: TransfertStock) => {
    setIsSaving(true);
    try {
      const res = await apiFetch(`/transferts-stock/${t.id}/recevoir`, { method: 'POST' });
      if (res.ok) {
        toast.success('Transfert reçu — stock destination incrémenté');
        charger();
        chargerStats();
        chargerProduits();
      } else {
        const d = await res.json();
        toast.error(d.message || 'Impossible de recevoir ce transfert');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setIsSaving(false);
    }
  };

  const nomBoutique = (id: number | null | undefined) =>
    boutiqueCouranteId === id
      ? (user?.current_boutique?.nom ?? 'Ma boutique courante')
      : (boutiques.find((b) => b.id === id)?.nom ?? '—');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transferts de stock</h1>
          <p className="text-muted-foreground text-sm">
            Déplacez du stock entre vos boutiques. La boutique courante (<strong>{user?.current_boutique?.nom ?? '—'}</strong>) est la source.
          </p>
        </div>
        {userPeutGerer && (
          <Button onClick={() => setCreerOuvert(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nouveau transfert
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4" /> Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.total_transferts ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock4 className="w-4 h-4 text-amber-500" /> En attente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">{stats?.transferts_en_attente ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-500" /> En cours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{stats?.transferts_en_cours ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" /> Terminés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{stats?.transferts_termines ?? '—'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={filtreStatut} onValueChange={setFiltreStatut}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="en_attente">En attente</SelectItem>
            <SelectItem value="en_cours">En cours</SelectItem>
            <SelectItem value="termine">Terminés</SelectItem>
            <SelectItem value="annule">Annulés</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Historique des transferts</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Chargement des transferts…</span>
            </div>
          ) : transferts.length === 0 ? (
            <EmptyState
              icon={ArrowRightLeft}
              title={filtreStatut === 'all' ? 'Aucun transfert' : `Aucun transfert « ${STATUT_LABELS[filtreStatut] ?? filtreStatut} »`}
              description="Créez un transfert pour déplacer du stock vers une autre de vos boutiques."
              actionLabel={userPeutGerer ? 'Nouveau transfert' : undefined}
              onAction={() => setCreerOuvert(true)}
              compact
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead>De</TableHead>
                  <TableHead>Vers</TableHead>
                  <TableHead className="text-right">Qté</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {transferts.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.numero_transfert}</TableCell>
                    <TableCell className="font-medium">{t.produit?.nom ?? '—'}</TableCell>
                    <TableCell className="text-sm">{nomBoutique(t.boutique_source_id)}</TableCell>
                    <TableCell className="text-sm">{nomBoutique(t.boutique_destination_id)}</TableCell>
                    <TableCell className="text-right font-mono">{t.quantite}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(t.date_transfert).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${STATUT_COLORS[t.statut] ?? ''}`}>
                        {STATUT_LABELS[t.statut] ?? t.statut}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        {t.boutique_source_id === boutiqueCouranteId && (t.statut === 'en_attente' || t.statut === 'en_cours') && userPeutGerer && (
                          <Button variant="ghost" size="sm" onClick={() => annulerTransfert(t)} disabled={isSaving}>
                            <PackageX className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                        {t.boutique_destination_id === boutiqueCouranteId && (t.statut === 'en_attente' || t.statut === 'en_cours') && userPeutGerer && (
                          <Button variant="ghost" size="sm" onClick={() => recevoirTransfert(t)} disabled={isSaving}>
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={creerOuvert} onOpenChange={setCreerOuvert}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Repeat className="w-5 h-5 text-blue-500" /> Nouveau transfert
            </DialogTitle>
            <DialogDescription>
              Depuis <strong>{user?.current_boutique?.nom ?? 'la boutique courante'}</strong> vers une autre boutique.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Produit *</Label>
              <Select value={produitId} onValueChange={setProduitId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un produit" />
                </SelectTrigger>
                <SelectContent>
                  {produits.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.nom} ({p.quantite_stock} en stock)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Boutique de destination *</Label>
              <Select value={destId} onValueChange={setDestId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une boutique" />
                </SelectTrigger>
                <SelectContent>
                  {destinations.length === 0 ? (
                    <SelectItem value="__none" disabled>Aucune autre boutique rattachée</SelectItem>
                  ) : (
                    destinations.map((b) => (
                      <SelectItem key={b.id} value={b.id.toString()}>
                        {b.nom}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantite">Quantité *</Label>
              <Input
                id="quantite"
                type="number"
                min={1}
                placeholder="Quantité à transférer"
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="motif">Motif</Label>
              <Input
                id="motif"
                placeholder="ex. réapprovisionnement, rotation de stock…"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Détails éventuels"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCreerOuvert(false); resetFormulaire(); }}>Annuler</Button>
            <Button onClick={creerTransfert} disabled={isSaving} className="flex-1">
              <Truck className="w-4 h-4 mr-1" /> Créer le transfert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}