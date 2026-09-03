'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getEffectiveRole, canGerer } from '@/lib/role';
import type { Produit, MouvementStock } from '@/types';

// ✅ CORRIGÉ : value="all" au lieu de value="" (évite l'erreur Select.Item)
const STATUTS = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'en_attente', label: 'En attente' },
  { value: 'accepte', label: 'Accepté' },
  { value: 'rejete', label: 'Rejeté' },
];

const STATUT_LABEL: Record<string, string> = {
  en_attente: 'En attente',
  accepte: 'Accepté',
  rejete: 'Rejeté',
};

// ✅ CORRIGÉ : value="all" au lieu de value=""
const RAISONS = [
  { value: 'all', label: 'Toutes les raisons' },
  { value: 'arrivage', label: 'Arrivage' },
  { value: 'vente', label: 'Vente' },
  { value: 'ajustement', label: 'Ajustement' },
  { value: 'retour', label: 'Retour' },
  { value: 'casse', label: 'Casse' },
];

export default function StockHistoryPage() {
  const { user } = useAuth();
  const userPeutGerer = canGerer(user, getEffectiveRole(user));
  const [produits, setProduits] = useState<Produit[]>([]);
  const [mouvements, setMouvements] = useState<MouvementStock[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // ✅ CORRIGÉ : valeurs initiales 'all' au lieu de ''
  const [selectedProduit, setSelectedProduit] = useState<string>('all');
  const [statut, setStatut] = useState<string>('all');
  const [raison, setRaison] = useState<string>('all');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [searchProduit, setSearchProduit] = useState('');

  const chargerProduits = useCallback(async () => {
    try {
      const response = await apiFetch('/produits?page=1&per_page=200');
      if (!response.ok) throw new Error('Impossible de charger les produits');
      const data = await response.json();
      setProduits(Array.isArray(data.data) ? data.data : data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur chargement produits';
      toast.error(message);
    }
  }, []);

  const chargerMouvements = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('per_page', '50');
      // ✅ CORRIGÉ : n'envoyer les filtres au backend que si la valeur n'est pas 'all'
      if (selectedProduit && selectedProduit !== 'all') params.set('produit_id', selectedProduit);
      if (statut && statut !== 'all') params.set('statut', statut);
      if (raison && raison !== 'all') params.set('raison', raison);
      if (dateDebut) params.set('date_debut', dateDebut);
      if (dateFin) params.set('date_fin', dateFin);

      const response = await apiFetch(`/mouvements-stock?${params}`);
      if (!response.ok) throw new Error('Impossible de charger les mouvements');
      const data = await response.json();
      setMouvements(Array.isArray(data.data) ? data.data : data.data || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur chargement mouvements';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [dateDebut, dateFin, raison, selectedProduit, statut]);

  useEffect(() => {
    chargerProduits();
    chargerMouvements();
  }, [chargerProduits, chargerMouvements]);

  const produitsFiltres = useMemo(
    () => produits.filter((produit) => produit.nom.toLowerCase().includes(searchProduit.toLowerCase())),
    [produits, searchProduit]
  );

  const validerMouvement = async (mouvementId: number) => {
    try {
      const response = await apiFetch(`/mouvements-stock/${mouvementId}/valider`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
      });
      if (!response.ok) throw new Error('Impossible de valider le mouvement');
      toast.success('Mouvement validé');
      chargerMouvements();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la validation';
      toast.error(message);
    }
  };

  const rejeterMouvement = async (mouvementId: number) => {
    const raisonRejet = window.prompt('Raison du rejet');
    if (!raisonRejet || raisonRejet.trim().length === 0) {
      toast.error('Indiquez une raison de rejet');
      return;
    }

    try {
      const response = await apiFetch(`/mouvements-stock/${mouvementId}/rejeter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ raison_rejet: raisonRejet.trim() }),
      });
      if (!response.ok) throw new Error('Impossible de rejeter le mouvement');
      toast.success('Mouvement rejeté');
      chargerMouvements();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors du rejet';
      toast.error(message);
    }
  };

  const statutsSummary = useMemo(() => {
    return {
      total: mouvements.length,
      enAttente: mouvements.filter((m) => m.statut === 'en_attente').length,
      acceptes: mouvements.filter((m) => m.statut === 'accepte').length,
      rejetes: mouvements.filter((m) => m.statut === 'rejete').length,
    };
  }, [mouvements]);

  return (
    <div className="space-y-6 py-6 px-4 md:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Historique des mouvements de stock</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Suivez l&apos;arrivage, les sorties et les ajustements avec une traçabilité complète.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="default">{statutsSummary.total} mouvements</Badge>
          <Badge variant="secondary">{statutsSummary.enAttente} en attente</Badge>
          <Badge variant="outline">{statutsSummary.acceptes} acceptés</Badge>
          <Badge variant="secondary">{statutsSummary.rejetes} rejetés</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
          <CardDescription>Affinez l&apos;historique par produit, statut ou période.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="searchProduit">Rechercher produit</Label>
              <Input
                id="searchProduit"
                value={searchProduit}
                onChange={(e) => setSearchProduit(e.target.value)}
                placeholder="Nom du produit"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="produit">Produit</Label>
              {/* ✅ CORRIGÉ : value contrôlé + onValueChange */}
              <Select value={selectedProduit} onValueChange={(value) => setSelectedProduit(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tous les produits" />
                </SelectTrigger>
                <SelectContent>
                  {/* ✅ CORRIGÉ : value="all" au lieu de value="" */}
                  <SelectItem value="all">Tous les produits</SelectItem>
                  {produitsFiltres.map((produit) => (
                    <SelectItem key={produit.id} value={produit.id.toString()}>
                      {produit.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="raison">Raison</Label>
              {/* ✅ CORRIGÉ : value contrôlé + onValueChange */}
              <Select value={raison} onValueChange={(value) => setRaison(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Toutes les raisons" />
                </SelectTrigger>
                <SelectContent>
                  {RAISONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="statut">Statut</Label>
              {/* ✅ CORRIGÉ : value contrôlé + onValueChange */}
              <Select value={statut} onValueChange={(value) => setStatut(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  {STATUTS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateDebut">Date début</Label>
              <Input
                id="dateDebut"
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateFin">Date fin</Label>
              <Input
                id="dateFin"
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={chargerMouvements} disabled={isLoading}>
              <Search className="mr-2 h-4 w-4" /> Appliquer
            </Button>
            <Button variant="outline" onClick={() => {
              // ✅ CORRIGÉ : réinitialiser avec 'all' au lieu de ''
              setSelectedProduit('all');
              setStatut('all');
              setRaison('all');
              setDateDebut('');
              setDateFin('');
              setSearchProduit('');
            }}>
              Réinitialiser
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Liste des mouvements</CardTitle>
          <CardDescription>
            {isLoading ? 'Chargement...' : `${mouvements.length} mouvement(s) affiché(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Raison</TableHead>
                <TableHead>Quantité</TableHead>
                <TableHead>Stock avant</TableHead>
                <TableHead>Stock après</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mouvements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-6 text-slate-500">
                    Aucun mouvement à afficher.
                  </TableCell>
                </TableRow>
              ) : (
                mouvements.map((mouvement) => (
                  <TableRow key={mouvement.id}>
                    <TableCell>{new Date(mouvement.created_at).toLocaleString('fr-FR')}</TableCell>
                    <TableCell>{mouvement.produit?.nom ?? '—'}</TableCell>
                    <TableCell>{mouvement.type}</TableCell>
                    <TableCell>{mouvement.raison}</TableCell>
                    <TableCell>{mouvement.quantite}</TableCell>
                    <TableCell>{mouvement.quantite_avant ?? '—'}</TableCell>
                    <TableCell>{mouvement.quantite_apres ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={mouvement.statut === 'accepte' ? 'default' : mouvement.statut === 'rejete' ? 'destructive' : 'secondary'}>
                        {STATUT_LABEL[mouvement.statut] ?? mouvement.statut}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-2">
                      {mouvement.statut === 'en_attente' && userPeutGerer ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => validerMouvement(mouvement.id)}>
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Valider
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => rejeterMouvement(mouvement.id)}>
                            <XCircle className="mr-2 h-4 w-4" /> Rejeter
                          </Button>
                        </>
                      ) : (
                        <span className="text-slate-500">Pas d&apos;action</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}