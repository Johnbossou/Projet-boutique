'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Truck,
  CheckCircle2,
  XCircle,
  Eye,
  Package,
  CreditCard,
  Filter,
  PackageCheck,
  PackageSearch,
  Ban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/EmptyState';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';
import type { CommandeFournisseur } from '@/types';

const STATUT_COLORS: Record<string, string> = {
  en_attente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  en_cours: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  livre: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  annule: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const STATUT_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  en_cours: 'En cours',
  livre: 'Livrée',
  annule: 'Annulée',
};

const FILTRES = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'en_attente', label: 'En attente' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'livre', label: 'Livrée' },
  { value: 'annule', label: 'Annulée' },
];

export default function CommandesFournisseursPage() {
  const [commandes, setCommandes] = useState<CommandeFournisseur[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filtreStatut, setFiltreStatut] = useState('all');
  const [detailOuvert, setDetailOuvert] = useState<CommandeFournisseur | null>(null);
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);
  const [receptions, setReceptions] = useState<Record<number, string>>({});
  const [montantPaiement, setMontantPaiement] = useState('');

  const chargerCommandes = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ per_page: '100' });
      if (filtreStatut !== 'all') params.set('statut', filtreStatut);
      const res = await apiFetch(`/commandes-fournisseurs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCommandes(data.data ?? []);
      } else {
        toast.error('Impossible de charger les commandes');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setIsLoading(false);
    }
  }, [filtreStatut]);

  useEffect(() => {
    chargerCommandes();
  }, [chargerCommandes]);

  const totalEnAttente = useMemo(
    () => commandes.filter((c) => c.statut === 'en_attente').length,
    [commandes]
  );
  const totalEnCours = useMemo(
    () => commandes.filter((c) => c.statut === 'en_cours').length,
    [commandes]
  );
  const totalMontantEncours = useMemo(
    () =>
      commandes
        .filter((c) => c.statut !== 'annule')
        .reduce((s, c) => s + c.montant_total, 0),
    [commandes]
  );

  const rafraichir = async () => {
    await chargerCommandes();
  };

  const validerCommande = async (commande: CommandeFournisseur) => {
    setActionEnCours(`valider-${commande.id}`);
    try {
      const res = await apiFetch(`/commandes-fournisseurs/${commande.id}/valider`, {
        method: 'POST',
      });
      if (res.ok) {
        toast.success('Commande validée');
        await rafraichir();
        setDetailOuvert(null);
      } else {
        const d = await res.json();
        toast.error(d.message || "Erreur lors de la validation");
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setActionEnCours(null);
    }
  };

  const annulerCommande = async (commande: CommandeFournisseur) => {
    setActionEnCours(`annuler-${commande.id}`);
    try {
      const res = await apiFetch(`/commandes-fournisseurs/${commande.id}/annuler`, {
        method: 'POST',
      });
      if (res.ok) {
        toast.success('Commande annulée');
        await rafraichir();
        setDetailOuvert(null);
      } else {
        const d = await res.json();
        toast.error(d.message || "Erreur lors de l'annulation");
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setActionEnCours(null);
    }
  };

  const receptionner = async (commande: CommandeFournisseur) => {
    const lignesRecues = commande.lignes
      .filter((l) => {
        const v = Number(receptions[l.id]);
        const restant = l.quantite_restante ?? l.quantite_commandee - l.quantite_recue;
        return v > 0 && v <= restant;
      })
      .map((l) => ({ ligne_id: l.id, quantite_recue: Number(receptions[l.id]) }));

    if (lignesRecues.length === 0) {
      toast.error('Indiquez une quantité à recevoir (dans les limites restantes) pour au moins une ligne');
      return;
    }

    setActionEnCours(`receptionner-${commande.id}`);
    try {
      const res = await apiFetch(`/commandes-fournisseurs/${commande.id}/receptionner`, {
        method: 'POST',
        body: JSON.stringify({ lignes: lignesRecues }),
      });
      if (res.ok) {
        toast.success('Réception enregistrée — stock mis à jour');
        setReceptions({});
        await rafraichir();
        setDetailOuvert(null);
      } else {
        const d = await res.json();
        toast.error(d.message || 'Erreur lors de la réception');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setActionEnCours(null);
    }
  };

  const payerCommande = async (commande: CommandeFournisseur) => {
    const montant = Number(montantPaiement);
    if (!montant || montant <= 0) {
      toast.error('Indiquez un montant à régler');
      return;
    }
    if (montant > commande.montant_total - (commande.montant_paye ?? 0)) {
      toast.error('Le montant dépasse le reste à payer');
      return;
    }
    setActionEnCours(`payer-${commande.id}`);
    try {
      const res = await apiFetch(`/commandes-fournisseurs/${commande.id}/payer`, {
        method: 'POST',
        body: JSON.stringify({ montant }),
      });
      if (res.ok) {
        toast.success('Règlement enregistré');
        setMontantPaiement('');
        await rafraichir();
      } else {
        const d = await res.json();
        toast.error(d.message || 'Erreur lors du règlement');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setActionEnCours(null);
    }
  };

  const afficherDetail = (commande: CommandeFournisseur) => {
    setDetailOuvert(commande);
    setReceptions({});
    setMontantPaiement('');
  };

  const resteAPayer = (c: CommandeFournisseur) =>
    Math.max(0, c.montant_total - (c.montant_paye ?? 0));

  const pourcentagePaye = (c: CommandeFournisseur) => {
    if (c.montant_total <= 0) return 0;
    return Math.min(100, Math.round(((c.montant_paye ?? 0) / c.montant_total) * 100));
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
          <Truck className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Commandes fournisseurs</h1>
          <p className="text-sm text-muted-foreground">
            {commandes.length} commande{commandes.length > 1 ? 's' : ''} affichée{commandes.length > 1 ? 's' : ''}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">En attente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{totalEnAttente}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">En cours</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalEnCours}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Montant engagé</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalMontantEncours.toLocaleString('fr-FR')} XOF</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={filtreStatut} onValueChange={setFiltreStatut}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTRES.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Chargement des commandes…</span>
            </div>
          ) : commandes.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title={filtreStatut === 'all' ? 'Aucune commande fournisseur' : `Aucune commande « ${STATUT_LABELS[filtreStatut] ?? filtreStatut} »`}
              description="Les commandes passées auprès des fournisseurs apparaîtront ici."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° commande</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead className="text-right">Montant total</TableHead>
                  <TableHead>Avancement paiement</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Livraison prévue</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {commandes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.numero_commande}</TableCell>
                    <TableCell className="font-medium">{c.fournisseur?.nom ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono">
                      {c.montant_total.toLocaleString('fr-FR')} XOF
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${
                              resteAPayer(c) === 0
                                ? 'bg-green-500'
                                : pourcentagePaye(c) > 0
                                ? 'bg-amber-500'
                                : 'bg-muted-foreground/20'
                            }`}
                            style={{ width: `${pourcentagePaye(c)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {(c.montant_paye ?? 0).toLocaleString('fr-FR')} / {c.montant_total.toLocaleString('fr-FR')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUT_COLORS[c.statut] ?? ''}>
                        {STATUT_LABELS[c.statut] ?? c.statut}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.date_livraison_prevue
                        ? new Date(c.date_livraison_prevue).toLocaleDateString('fr-FR')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => afficherDetail(c)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detailOuvert} onOpenChange={(o) => { if (!o) setDetailOuvert(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailOuvert && (
            <>
              <DialogHeader>
                <DialogTitle>Commande {detailOuvert.numero_commande}</DialogTitle>
                <DialogDescription>
                  {detailOuvert.fournisseur?.nom ?? '—'} ·{' '}
                  {STATUT_LABELS[detailOuvert.statut] ?? detailOuvert.statut}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Créée le :</span>{' '}
                  {new Date(detailOuvert.created_at).toLocaleDateString('fr-FR')}
                </div>
                <div>
                  <span className="text-muted-foreground">Par :</span> {detailOuvert.user?.name ?? '—'}
                </div>
                <div>
                  <span className="text-muted-foreground">Livraison prévue :</span>{' '}
                  {detailOuvert.date_livraison_prevue
                    ? new Date(detailOuvert.date_livraison_prevue).toLocaleDateString('fr-FR')
                    : '—'}
                </div>
                {detailOuvert.conditions_paiement && (
                  <div>
                    <span className="text-muted-foreground">Conditions :</span> {detailOuvert.conditions_paiement}
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Montant total :</span>{' '}
                  <span className="font-bold">{detailOuvert.montant_total.toLocaleString('fr-FR')} XOF</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Reste à payer :</span>{' '}
                  <span
                    className={
                      resteAPayer(detailOuvert) > 0
                        ? 'text-amber-600 font-semibold'
                        : 'text-green-600 font-semibold'
                    }
                  >
                    {resteAPayer(detailOuvert).toLocaleString('fr-FR')} XOF
                  </span>
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">Paiement</span>
                  <span className="text-muted-foreground">
                    {pourcentagePaye(detailOuvert)}% · {(detailOuvert.montant_paye ?? 0).toLocaleString('fr-FR')} XOF payés
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${
                      resteAPayer(detailOuvert) === 0 ? 'bg-green-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${pourcentagePaye(detailOuvert)}%` }}
                  />
                </div>
              </div>

              {detailOuvert.notes && (
                <p className="text-sm italic text-muted-foreground">« {detailOuvert.notes} »</p>
              )}

              <div>
                <p className="text-sm font-medium mb-2">Lignes de commande :</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-right">Commandé</TableHead>
                      <TableHead className="text-right">Reçu</TableHead>
                      <TableHead className="text-right">Prix unitaire</TableHead>
                      <TableHead className="text-right">Sous-total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailOuvert.lignes.map((l) => {
                      const sousTotal = l.quantite_commandee * l.prix_unitaire;
                      const reçu = l.quantite_recue ?? 0;
                      const restant = l.quantite_restante ?? Math.max(0, l.quantite_commandee - reçu);
                      return (
                        <TableRow key={l.id}>
                          <TableCell>{l.produit?.nom ?? '—'}</TableCell>
                          <TableCell className="text-right">{l.quantite_commandee}</TableCell>
                          <TableCell className="text-right">
                            {reçu}
                            {restant > 0 && (
                              <span className="ml-1 text-xs text-muted-foreground">(reste {restant})</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {l.prix_unitaire.toLocaleString('fr-FR')} XOF
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {sousTotal.toLocaleString('fr-FR')} XOF
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {detailOuvert.statut === 'en_cours' && (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium">Réceptionner du stock</span>
                  </div>
                  <div className="space-y-2">
                    {detailOuvert.lignes.map((l) => {
                      const reçu = l.quantite_recue ?? 0;
                      const restant = l.quantite_restante ?? Math.max(0, l.quantite_commandee - reçu);
                      if (restant <= 0) return null;
                      return (
                        <div key={l.id} className="grid grid-cols-[1fr_130px] gap-2 items-center">
                          <span className="text-sm">
                            {l.produit?.nom ?? '—'}{' '}
                            <span className="text-muted-foreground">(reste {restant})</span>
                          </span>
                          <Input
                            type="number"
                            min={1}
                            max={restant}
                            placeholder={`0-${restant}`}
                            value={receptions[l.id] ?? ''}
                            onChange={(e) =>
                              setReceptions({ ...receptions, [l.id]: e.target.value })
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => receptionner(detailOuvert)}
                    disabled={actionEnCours === `receptionner-${detailOuvert.id}`}
                  >
                    {actionEnCours === `receptionner-${detailOuvert.id}` ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <PackageCheck className="w-4 h-4 mr-1" />
                    )}
                    Réceptionner
                  </Button>
                </div>
              )}

              {detailOuvert.statut !== 'annule' && resteAPayer(detailOuvert) > 0 && (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium">Enregistrer un règlement</span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={resteAPayer(detailOuvert)}
                      placeholder={`Montant (max ${resteAPayer(detailOuvert)})`}
                      value={montantPaiement}
                      onChange={(e) => setMontantPaiement(e.target.value)}
                    />
                    <Button
                      onClick={() => payerCommande(detailOuvert)}
                      disabled={actionEnCours === `payer-${detailOuvert.id}`}
                    >
                      {actionEnCours === `payer-${detailOuvert.id}` ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <CreditCard className="w-4 h-4 mr-1" />
                      )}
                      Payer
                    </Button>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2">
                {detailOuvert.statut === 'en_attente' && (
                  <>
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      disabled={actionEnCours === `valider-${detailOuvert.id}`}
                      onClick={() => validerCommande(detailOuvert)}
                    >
                      {actionEnCours === `valider-${detailOuvert.id}` ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                      )}
                      Valider
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      disabled={actionEnCours === `annuler-${detailOuvert.id}`}
                      onClick={() => annulerCommande(detailOuvert)}
                    >
                      {actionEnCours === `annuler-${detailOuvert.id}` ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4 mr-1" />
                      )}
                      Annuler
                    </Button>
                  </>
                )}
                {detailOuvert.statut === 'en_cours' && (
                  <Button
                    variant="destructive"
                    className="flex-1"
                    disabled={actionEnCours === `annuler-${detailOuvert.id}`}
                    onClick={() => annulerCommande(detailOuvert)}
                  >
                    {actionEnCours === `annuler-${detailOuvert.id}` ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Ban className="w-4 h-4 mr-1" />
                    )}
                    Annuler
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
