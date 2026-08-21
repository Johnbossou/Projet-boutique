'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, CheckCircle2, XCircle, Search, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import type { Produit, MouvementStock } from '@/types';

const initialForm = {
  produit_id: '',
  quantite: '',
  reference_bon: '',
  notes: '',
};

export default function ArrivagePage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [mouvements, setMouvements] = useState<MouvementStock[]>([]);
  const [formData, setFormData] = useState(initialForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingOnly, setPendingOnly] = useState(true);
  const [searchProduit, setSearchProduit] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  const chargerProduits = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiFetch('/produits?page=1&per_page=200');
      if (!response.ok) {
        throw new Error('Impossible de charger les produits');
      }
      const data = await response.json();
      const items = Array.isArray(data.data) ? data.data : data;
      setProduits(items);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors du chargement des produits';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const chargerMouvements = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('per_page', '50');
      if (pendingOnly) {
        params.set('statut', 'en_attente');
      }
      const response = await apiFetch(`/mouvements-stock?${params}`);
      if (!response.ok) {
        throw new Error('Impossible de charger les mouvements');
      }
      const data = await response.json();
      setMouvements(Array.isArray(data.data) ? data.data : data.data || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors du chargement des mouvements';
      toast.error(message);
    }
  }, [pendingOnly]);

  useEffect(() => {
    chargerProduits();
    chargerMouvements();
  }, [chargerProduits, chargerMouvements]);

  // 🎯 PRÉ-SÉLECTION DU PRODUIT VIA URL
  useEffect(() => {
    const produitId = searchParams.get('produit_id');
    if (produitId && produits.length > 0) {
      setFormData(prev => ({ ...prev, produit_id: produitId }));
    }
  }, [searchParams, produits]);

  const resetForm = () => setFormData(initialForm);

  const handleCodeDetected = (code: string, produit?: Produit) => {
    if (produit) {
      // Si le produit est trouvé via l'API, pré-remplir le formulaire
      setFormData(prev => ({
        ...prev,
        produit_id: produit.id.toString(),
        quantite: '1', // Défaut à 1 unité
      }));
      toast.success(`Produit détecté: ${produit.nom}`);
    } else {
      // Le code a été détecté mais le produit n'existe pas
      toast.warning(`Code détecté: ${code}, mais produit non trouvé`);
    }
    setShowScanner(false);
  };

  const submitArrivage = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.produit_id) {
      toast.error('Sélectionnez un produit');
      return;
    }

    const quantite = parseInt(formData.quantite, 10);
    if (Number.isNaN(quantite) || quantite <= 0) {
      toast.error('Entrez une quantité valide');
      return;
    }

    try {
      setIsSaving(true);
      const response = await apiFetch('/mouvements-stock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          produit_id: parseInt(formData.produit_id, 10),
          quantite,
          raison: 'arrivage',
          type: 'entrée',
          reference_bon: formData.reference_bon || null,
          notes: formData.notes || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Impossible d’enregistrer l’arrivage');
      }

      await response.json();
      toast.success('Arrivage enregistré. Il reste à le valider.');
      resetForm();
      chargerMouvements();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors de l’enregistrement';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const validerMouvement = async (id: number) => {
    try {
      const response = await apiFetch(`/mouvements-stock/${id}/valider`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Impossible de valider le mouvement');
      }

      toast.success('Arrivage validé et stock mis à jour');
      chargerMouvements();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur de validation';
      toast.error(message);
    }
  };

  const rejeterMouvement = async (id: number) => {
    const raison = window.prompt('Raison du rejet du mouvement');
    if (!raison || raison.trim().length === 0) {
      toast.error('La raison du rejet est requise');
      return;
    }

    try {
      const response = await apiFetch(`/mouvements-stock/${id}/rejeter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ raison_rejet: raison.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Impossible de rejeter le mouvement');
      }

      toast.success('Mouvement rejeté');
      chargerMouvements();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors du rejet';
      toast.error(message);
    }
  };

  const produitsFiltres = produits.filter((produit) =>
    produit.nom.toLowerCase().includes(searchProduit.toLowerCase())
  );

  return (
    <div className="space-y-6 py-6 px-4 md:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Arrivage de stock</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Enregistrez des entrées de stock sécurisées avec suivi et validation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{user?.role === 'gerant' ? 'Gérant' : 'Caissier'}</Badge>
          <Badge variant="outline">{pendingOnly ? 'En attente' : 'Tous les mouvements'}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nouvel arrivage</CardTitle>
          <CardDescription>
            Créez une demande d&apos;arrivage. Le mouvement est enregistré et peut être validé par un gérant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            {/* Scanner QR/Code-barres */}
            <div className="border-b pb-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Scanner QR/Code-barres</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowScanner(!showScanner)}
                  className="gap-2"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${showScanner ? 'rotate-180' : ''}`} />
                  {showScanner ? 'Masquer' : 'Afficher'} scanner
                </Button>
              </div>
              {showScanner && (
                <div className="mb-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                  <BarcodeScanner 
                    onCodeDetected={handleCodeDetected}
                    apiBaseUrl={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}
                  />
                </div>
              )}
            </div>

            {/* Formulaire */}
            <form className="space-y-5" onSubmit={submitArrivage}>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="produit_id">Produit *</Label>
                  <Select
                    value={formData.produit_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, produit_id: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sélectionnez un produit" />
                    </SelectTrigger>
                    <SelectContent>
                      {produitsFiltres.length === 0 ? (
                        // ✅ CORRIGÉ : value="none" au lieu de value=""
                        <SelectItem value="none" disabled>Aucun produit trouvé</SelectItem>
                      ) : (
                        produitsFiltres.map((produit) => (
                          <SelectItem key={produit.id} value={produit.id.toString()}>
                            {produit.nom} ({produit.quantite_stock} en stock)
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
                    min="1"
                    value={formData.quantite}
                    onChange={(e) => setFormData(prev => ({ ...prev, quantite: e.target.value }))}
                    placeholder="0"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reference_bon">Référence bon</Label>
                  <Input
                    id="reference_bon"
                    value={formData.reference_bon}
                    onChange={(e) => setFormData(prev => ({ ...prev, reference_bon: e.target.value }))}
                    placeholder="Ex: BON-2026-001"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Informations complémentaires sur la réception"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button type="submit" disabled={isSaving || isLoading}>
                  <Plus className="mr-2 h-4 w-4" />
                  Enregistrer l&apos;arrivage
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPendingOnly((prev) => !prev)}
                >
                  {pendingOnly ? 'Afficher tous les mouvements' : 'Afficher seulement les demandes'}
                </Button>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mouvements de stock</CardTitle>
          <CardDescription>
            Liste des entrées et sorties créées depuis le système. Les mouvements en attente peuvent être validés par un gérant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-10"
                  placeholder="Rechercher un produit..."
                  value={searchProduit}
                  onChange={(e) => setSearchProduit(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">{mouvements.length} mouvements</Badge>
              {!user?.role || user.role !== 'gerant' ? (
                <Badge variant="secondary">En attente de validation</Badge>
              ) : (
                <Badge variant="outline">Gérant peut valider</Badge>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Réf. bon</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mouvements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-6 text-slate-500">
                      Aucun mouvement trouvé.
                    </TableCell>
                  </TableRow>
                ) : (
                  mouvements.map((mouvement) => (
                    <TableRow key={mouvement.id}>
                      <TableCell>{new Date(mouvement.created_at).toLocaleString('fr-FR')}</TableCell>
                      <TableCell>{mouvement.produit?.nom ?? 'Produit inconnu'}</TableCell>
                      <TableCell>{mouvement.type}</TableCell>
                      <TableCell>{mouvement.quantite}</TableCell>
                      <TableCell>
                        <Badge variant={mouvement.statut === 'accepté' ? 'default' : mouvement.statut === 'rejeté' ? 'destructive' : 'secondary'}>
                          {mouvement.statut}
                        </Badge>
                      </TableCell>
                      <TableCell>{mouvement.reference_bon || '—'}</TableCell>
                      <TableCell>{mouvement.user?.name || '—'}</TableCell>
                      <TableCell className="space-x-2">
                        {mouvement.statut === 'en_attente' && user?.role === 'gerant' ? (
                          <>
                            <Button size="sm" variant="outline" onClick={() => validerMouvement(mouvement.id)}>
                              <CheckCircle2 className="mr-2 h-4 w-4" />Valider
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => rejeterMouvement(mouvement.id)}>
                              <XCircle className="mr-2 h-4 w-4" />Rejeter
                            </Button>
                          </>
                        ) : (
                          <span className="text-sm text-slate-500">Aucune action</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}