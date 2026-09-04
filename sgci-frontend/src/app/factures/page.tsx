'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, FileText, Send, Download, Eye, Calendar, Filter, FileX2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/EmptyState';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getEffectiveRole } from '@/lib/role';

interface Facture {
  id: number;
  numero_facture: string;
  statut: string;
  montant_total: number;
  tva: number;
  client: { id?: number; nom: string; email: string } | null;
  vente: { id?: number; numero_vente: string } | null;
  commandeClient: { id?: number; numero_commande: string } | null;
  created_at: string;
}

interface FactureDetail extends Facture {
  boutique: { id: number; nom: string } | null;
  ligneVentes?: Array<{
    id: number;
    quantite: number;
    prix_unitaire: number;
    produit: { id: number; nom: string; code_barre?: string } | null;
  }>;
  lignesCommande?: Array<{
    id: number;
    quantite: number;
    prix_unitaire: number;
    produit: { id: number; nom: string; code_barre?: string } | null;
  }>;
}

const STATUT_COLORS: Record<string, string> = {
  brouillon: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  envoyee: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  payee: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  annulee: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const STATUT_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  envoyee: 'Envoyée',
  payee: 'Payée',
  annulee: 'Annulée',
};

export default function FacturesPage() {
  const { user } = useAuth();
  const roleCourant = getEffectiveRole(user);
  const estProprietaire = roleCourant === 'proprietaire';

  const [factures, setFactures] = useState<Facture[]>([]);
  const [totalFactures, setTotalFactures] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filtreStatut, setFiltreStatut] = useState('all');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [detailOuvert, setDetailOuvert] = useState<FactureDetail | null>(null);
  const [actionEnCours, setActionEnCours] = useState<number | string | null>(null);

  const chargerFactures = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ per_page: '50' });
      if (filtreStatut !== 'all') params.set('statut', filtreStatut);
      if (dateDebut) params.set('date_debut', dateDebut);
      if (dateFin) params.set('date_fin', dateFin);
      const res = await apiFetch(`/factures?${params}`);
      if (res.ok) {
        const data = await res.json();
        setFactures(data.data ?? []);
        setTotalFactures(data.total ?? data.data?.length ?? 0);
      }
    } catch {
      toast.error('Erreur lors du chargement des factures');
    } finally {
      setIsLoading(false);
    }
  }, [filtreStatut, dateDebut, dateFin]);

  const chargerTotal = useCallback(async () => {
    try {
      const res = await apiFetch('/factures?per_page=1');
      if (res.ok) {
        const data = await res.json();
        setTotalFactures(data.total ?? 0);
      }
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    chargerFactures();
    chargerTotal();
  }, [chargerFactures, chargerTotal]);

  const voirDetail = async (facture: Facture) => {
    try {
      const res = await apiFetch(`/factures/${facture.id}`);
      if (res.ok) {
        const data = await res.json();
        setDetailOuvert(data.data ?? data);
      } else {
        toast.error('Impossible de charger le détail');
      }
    } catch {
      toast.error('Erreur réseau');
    }
  };

  const envoyerEmail = async (facture: Facture) => {
    try {
      setActionEnCours(facture.id);
      const res = await apiFetch(`/factures/${facture.id}/envoyer-email`, { method: 'POST' });
      if (res.ok) {
        toast.success('Email envoyé avec succès');
        chargerFactures();
      } else {
        const data = await res.json();
        toast.error(data.message || "Erreur lors de l'envoi de l'email");
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setActionEnCours(null);
    }
  };

  const telechargerPdf = async (facture: Facture) => {
    try {
      setActionEnCours(`pdf-${facture.id}`);
      const res = await apiFetch(`/factures/${facture.id}/telecharger-pdf`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${facture.numero_facture}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('PDF téléchargé');
      } else {
        toast.error('Erreur lors du téléchargement');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setActionEnCours(null);
    }
  };

  const genererDuJour = async () => {
    try {
      setActionEnCours('generer-du-jour');
      const res = await apiFetch('/factures/generer-du-jour', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || 'Factures du jour générées');
        chargerFactures();
      } else {
        const data = await res.json();
        toast.error(data.message || 'Erreur lors de la génération');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setActionEnCours(null);
    }
  };

  const formatMontant = (montant: number) =>
    montant.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' XOF';

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Factures</h1>
            <p className="text-sm text-muted-foreground">
              {totalFactures} facture{totalFactures > 1 ? 's' : ''} au total
            </p>
          </div>
        </div>
        {estProprietaire && (
          <Button onClick={genererDuJour} disabled={actionEnCours === 'generer-du-jour'}>
            {actionEnCours === 'generer-du-jour' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            Générer du jour
          </Button>
        )}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalFactures}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Envoyées</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              {factures.filter((f) => f.statut === 'envoyee').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Payées</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {factures.filter((f) => f.statut === 'payee').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Montant total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatMontant(factures.reduce((s, f) => s + f.montant_total, 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={filtreStatut} onValueChange={setFiltreStatut}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="brouillon">Brouillon</SelectItem>
            <SelectItem value="envoyee">Envoyée</SelectItem>
            <SelectItem value="payee">Payée</SelectItem>
            <SelectItem value="annulee">Annulée</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <input
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <span className="text-muted-foreground text-sm">→</span>
          <input
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Chargement des factures…</span>
            </div>
          ) : factures.length === 0 ? (
            <EmptyState
              icon={FileX2}
              title={
                filtreStatut === 'all' && !dateDebut && !dateFin
                  ? 'Aucune facture'
                  : 'Aucune facture ne correspond aux filtres'
              }
              description="Les factures générées depuis vos ventes et commandes apparaîtront ici."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° facture</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Réf. source</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-right">TVA</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {factures.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-mono text-xs">{f.numero_facture}</TableCell>
                    <TableCell>{f.client?.nom ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {f.vente?.numero_vente ?? f.commandeClient?.numero_commande ?? '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatMontant(f.montant_total)}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {formatMontant(f.tva)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={STATUT_COLORS[f.statut] ?? ''}>
                        {STATUT_LABELS[f.statut] ?? f.statut}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(f.created_at).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => voirDetail(f)}
                          title="Voir le détail"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => envoyerEmail(f)}
                          disabled={actionEnCours === f.id || f.statut === 'annulee'}
                          title="Envoyer par email"
                        >
                          {actionEnCours === f.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => telechargerPdf(f)}
                          disabled={actionEnCours === `pdf-${f.id}`}
                          title="Télécharger PDF"
                        >
                          {actionEnCours === `pdf-${f.id}` ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {detailOuvert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setDetailOuvert(null)}
        >
          <Card
            className="w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold">{detailOuvert.numero_facture}</h2>
                  <p className="text-sm text-muted-foreground">
                    {detailOuvert.boutique?.nom ?? '—'} ·{' '}
                    {new Date(detailOuvert.created_at).toLocaleString('fr-FR')}
                  </p>
                </div>
                <Badge variant="secondary" className={STATUT_COLORS[detailOuvert.statut] ?? ''}>
                  {STATUT_LABELS[detailOuvert.statut] ?? detailOuvert.statut}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Client :</span>{' '}
                  <span className="font-medium">{detailOuvert.client?.nom ?? '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Email :</span>{' '}
                  {detailOuvert.client?.email ?? '—'}
                </div>
                {detailOuvert.vente && (
                  <div>
                    <span className="text-muted-foreground">Vente :</span>{' '}
                    <span className="font-mono text-xs">{detailOuvert.vente.numero_vente}</span>
                  </div>
                )}
                {detailOuvert.commandeClient && (
                  <div>
                    <span className="text-muted-foreground">Commande :</span>{' '}
                    <span className="font-mono text-xs">{detailOuvert.commandeClient.numero_commande}</span>
                  </div>
                )}
              </div>

              {((detailOuvert.ligneVentes && detailOuvert.ligneVentes.length > 0) ||
                (detailOuvert.lignesCommande && detailOuvert.lignesCommande.length > 0)) && (
                <div>
                  <p className="text-sm font-medium mb-2">Désignations :</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead className="text-right">Qté</TableHead>
                        <TableHead className="text-right">Prix unitaire</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detailOuvert.ligneVentes ?? detailOuvert.lignesCommande ?? []).map((l) => (
                        <TableRow key={l.id}>
                          <TableCell>{l.produit?.nom ?? '—'}</TableCell>
                          <TableCell className="text-right">{l.quantite}</TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {formatMontant(l.prix_unitaire)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {formatMontant(l.quantite * l.prix_unitaire)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex justify-end gap-6 text-sm pt-2 border-t">
                <div>
                  <span className="text-muted-foreground">TVA : </span>
                  <span className="font-medium">{formatMontant(detailOuvert.tva)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total HT : </span>
                  <span className="font-medium">
                    {formatMontant(detailOuvert.montant_total - detailOuvert.tva)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total TTC : </span>
                  <span className="font-bold text-lg">{formatMontant(detailOuvert.montant_total)}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={actionEnCours === detailOuvert.id || detailOuvert.statut === 'annulee'}
                  onClick={() => envoyerEmail(detailOuvert)}
                >
                  {actionEnCours === detailOuvert.id ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Envoyer par email
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={actionEnCours === `pdf-${detailOuvert.id}`}
                  onClick={() => telechargerPdf(detailOuvert)}
                >
                  {actionEnCours === `pdf-${detailOuvert.id}` ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Télécharger PDF
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
