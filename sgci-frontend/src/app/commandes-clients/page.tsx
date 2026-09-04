'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShoppingCart, CheckCircle2, XCircle, Truck, Eye, Filter, PackageSearch, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/EmptyState';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';

interface CommandeLigne {
  id: number;
  quantite: number;
  prix_unitaire: number;
  remise_pourcentage: number;
  sous_total: number;
  produit: { id: number; nom: string } | null;
}

interface CommandePaiement {
  id: number;
  montant: number;
  mode_paiement: string;
  created_at: string;
}

interface Commande {
  id: number;
  numero_commande: string;
  statut: string;
  montant_total: number;
  montant_paye: number;
  client: { id: number; nom: string; telephone: string } | null;
  user: { name: string } | null;
  devis: { numero_devis: string } | null;
  lignes: CommandeLigne[];
  paiements: CommandePaiement[];
  date_livraison_prevue: string | null;
  date_livraison_reelle: string | null;
  notes: string | null;
  created_at: string;
}

const STATUT_COLORS: Record<string, string> = {
  en_attente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  en_cours: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  livre: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  annule: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const STATUT_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  en_cours: 'En cours',
  livre: 'Livré',
  annule: 'Annulé',
};

export default function CommandesClientsPage() {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filtreStatut, setFiltreStatut] = useState('all');
  const [detailOuvert, setDetailOuvert] = useState<Commande | null>(null);
  const [actionEnCours, setActionEnCours] = useState<number | null>(null);

  const chargerCommandes = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ per_page: '50' });
      if (filtreStatut !== 'all') params.set('statut', filtreStatut);
      const res = await apiFetch(`/commandes-clients?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCommandes(data.data ?? []);
      }
    } catch {
      toast.error('Erreur lors du chargement des commandes');
    } finally {
      setIsLoading(false);
    }
  }, [filtreStatut]);

  useEffect(() => { chargerCommandes(); }, [chargerCommandes]);

  const validerCommande = async (commande: Commande) => {
    try {
      setActionEnCours(commande.id);
      const res = await apiFetch(`/commandes-clients/${commande.id}/valider`, { method: 'POST' });
      if (res.ok) {
        toast.success('Commande validée — traitement lancé');
        chargerCommandes();
        setDetailOuvert(null);
      } else {
        const data = await res.json();
        toast.error(data.message || 'Erreur lors de la validation');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setActionEnCours(null);
    }
  };

  const livrerCommande = async (commande: Commande) => {
    try {
      setActionEnCours(commande.id);
      const res = await apiFetch(`/commandes-clients/${commande.id}/livrer`, { method: 'POST' });
      if (res.ok) {
        toast.success('Commande marquée comme livrée');
        chargerCommandes();
        setDetailOuvert(null);
      } else {
        const data = await res.json();
        toast.error(data.message || 'Erreur lors de la livraison');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setActionEnCours(null);
    }
  };

  const annulerCommande = async (commande: Commande) => {
    try {
      setActionEnCours(commande.id);
      const res = await apiFetch(`/commandes-clients/${commande.id}/annuler`, { method: 'POST' });
      if (res.ok) {
        toast.success('Commande annulée');
        chargerCommandes();
        setDetailOuvert(null);
      } else {
        const data = await res.json();
        toast.error(data.message || "Erreur lors de l'annulation");
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setActionEnCours(null);
    }
  };

  const totalCommandes = commandes.length;
  const enAttente = commandes.filter(c => c.statut === 'en_attente').length;
  const enCours = commandes.filter(c => c.statut === 'en_cours').length;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 flex items-center justify-center">
          <ShoppingCart className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Commandes clients</h1>
          <p className="text-sm text-muted-foreground">
            {totalCommandes} commande{totalCommandes !== 1 ? 's' : ''}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total commandes</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalCommandes}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">En attente</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{enAttente}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">En cours</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{enCours}</p></CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={filtreStatut} onValueChange={setFiltreStatut}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="en_attente">En attente</SelectItem>
            <SelectItem value="en_cours">En cours</SelectItem>
            <SelectItem value="livre">Livré</SelectItem>
            <SelectItem value="annule">Annulé</SelectItem>
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
              title={filtreStatut === 'all' ? 'Aucune commande trouvée' : `Aucune commande au statut « ${STATUT_LABELS[filtreStatut] ?? filtreStatut} »`}
              description="Les commandes clients apparaîtront ici une fois créées."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-right">Payé</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {commandes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.numero_commande}</TableCell>
                    <TableCell>{c.client?.nom ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono">{c.montant_total.toLocaleString('fr-FR')} XOF</TableCell>
                    <TableCell className="text-right font-mono">{c.montant_paye.toLocaleString('fr-FR')} XOF</TableCell>
                    <TableCell>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${STATUT_COLORS[c.statut] ?? ''}`}>
                        {STATUT_LABELS[c.statut] ?? c.statut}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setDetailOuvert(c)}>
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

      {detailOuvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDetailOuvert(null)}>
          <Card className="w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-lg">
                Commande {detailOuvert.numero_commande}
                <span className={`ml-3 inline-block px-2 py-1 rounded-full text-xs font-medium ${STATUT_COLORS[detailOuvert.statut] ?? ''}`}>
                  {STATUT_LABELS[detailOuvert.statut] ?? detailOuvert.statut}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Client :</span>{' '}
                  {detailOuvert.client?.nom ?? '—'}
                </div>
                <div>
                  <span className="text-muted-foreground">Téléphone :</span>{' '}
                  {detailOuvert.client?.telephone ?? '—'}
                </div>
                <div>
                  <span className="text-muted-foreground">Créé par :</span>{' '}
                  {detailOuvert.user?.name ?? '—'}
                </div>
                <div>
                  <span className="text-muted-foreground">Date :</span>{' '}
                  {new Date(detailOuvert.created_at).toLocaleString('fr-FR')}
                </div>
                {detailOuvert.devis && (
                  <div>
                    <span className="text-muted-foreground">Devis :</span>{' '}
                    <span className="font-mono text-xs">{detailOuvert.devis.numero_devis}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Montant total :</span>{' '}
                  <span className="font-bold">{detailOuvert.montant_total.toLocaleString('fr-FR')} XOF</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Montant payé :</span>{' '}
                  <span className="font-bold text-green-600 dark:text-green-400">{detailOuvert.montant_paye.toLocaleString('fr-FR')} XOF</span>
                </div>
                {detailOuvert.date_livraison_prevue && (
                  <div>
                    <span className="text-muted-foreground">Livraison prévue :</span>{' '}
                    {new Date(detailOuvert.date_livraison_prevue).toLocaleDateString('fr-FR')}
                  </div>
                )}
                {detailOuvert.date_livraison_reelle && (
                  <div>
                    <span className="text-muted-foreground">Livrée le :</span>{' '}
                    {new Date(detailOuvert.date_livraison_reelle).toLocaleDateString('fr-FR')}
                  </div>
                )}
              </div>

              {detailOuvert.notes && (
                <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground italic">
                  {detailOuvert.notes}
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-2">Articles commandés</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-right">Qté</TableHead>
                      <TableHead className="text-right">Prix unitaire</TableHead>
                      <TableHead className="text-right">Remise</TableHead>
                      <TableHead className="text-right">Sous-total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailOuvert.lignes.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{l.produit?.nom ?? '—'}</TableCell>
                        <TableCell className="text-right">{l.quantite}</TableCell>
                        <TableCell className="text-right font-mono">{l.prix_unitaire.toLocaleString('fr-FR')} XOF</TableCell>
                        <TableCell className="text-right">{l.remise_pourcentage > 0 ? `${l.remise_pourcentage}%` : '—'}</TableCell>
                        <TableCell className="text-right font-mono">{l.sous_total.toLocaleString('fr-FR')} XOF</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {detailOuvert.paiements.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Paiements reçus</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Montant</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailOuvert.paiements.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono">{p.montant.toLocaleString('fr-FR')} XOF</TableCell>
                          <TableCell className="capitalize">{p.mode_paiement}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString('fr-FR')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {(detailOuvert.statut === 'en_attente' || detailOuvert.statut === 'en_cours') && (
                <div className="flex gap-3 pt-2">
                  {detailOuvert.statut === 'en_attente' && (
                    <Button className="flex-1 bg-green-600 hover:bg-green-700" disabled={actionEnCours === detailOuvert.id} onClick={() => validerCommande(detailOuvert)}>
                      {actionEnCours === detailOuvert.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />} Valider
                    </Button>
                  )}
                  {detailOuvert.statut === 'en_cours' && (
                    <Button className="flex-1 bg-green-600 hover:bg-green-700" disabled={actionEnCours === detailOuvert.id} onClick={() => livrerCommande(detailOuvert)}>
                      {actionEnCours === detailOuvert.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Truck className="w-4 h-4 mr-1" />} Livrer
                    </Button>
                  )}
                  <Button variant="destructive" className="flex-1" disabled={actionEnCours === detailOuvert.id} onClick={() => annulerCommande(detailOuvert)}>
                    {actionEnCours === detailOuvert.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <XCircle className="w-4 h-4 mr-1" />} Annuler
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
