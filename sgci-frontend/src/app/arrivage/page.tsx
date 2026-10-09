'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Plus,
  CheckCircle2,
  XCircle,
  Search,
  ChevronDown,
  PackageSearch,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getEffectiveRole, canGerer } from '@/lib/role';
import type { Produit, MouvementStock, CommandeFournisseur } from '@/types';

const emptyForm = {
  produit_id: '',
  quantite: '',
  type: 'entree' as 'entree' | 'sortie',
  raison: 'arrivage' as MouvementStock['raison'],
  reference_bon: '',
  notes: '',
  date_peremption: '',
  date_fabrication: '',
  commande_fournisseur_id: '',
};

const RAISONS_SORTIE: { value: MouvementStock['raison']; label: string }[] = [
  { value: 'casse', label: 'Casse / perte' },
  { value: 'ajustement', label: 'Ajustement' },
  { value: 'retour', label: 'Retour client' },
];

const TYPE_LABEL: Record<string, string> = {
  entree: 'Entrée',
  sortie: 'Sortie',
};

const TYPE_BADGE: Record<string, string> = {
  entree: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
  sortie: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200',
};

export default function ArrivagePage() {
  const { user } = useAuth();
  const roleCourant = getEffectiveRole(user);
  const userPeutGerer = canGerer(user, roleCourant);
  const searchParams = useSearchParams();

  const [produits, setProduits] = useState<Produit[]>([]);
  const [mouvements, setMouvements] = useState<MouvementStock[]>([]);
  const [commandes, setCommandes] = useState<CommandeFournisseur[]>([]);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingOnly, setPendingOnly] = useState(true);
  const [searchProduit, setSearchProduit] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  // Réception partielle
  const [reception, setReception] = useState<{
    id: number;
    produit: string;
    quantite: number;
    quantiteRecue: string;
  } | null>(null);

  // Rejet
  const [rejet, setRejet] = useState<{ id: number; produit: string; motif: string } | null>(null);

  const chargerProduits = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiFetch('/produits?per_page=200');
      if (!response.ok) {
        throw new Error('Impossible de charger les produits');
      }
      const data = await response.json();
      const items = Array.isArray(data.data) ? data.data : data;
      setProduits(items);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erreur de chargement des produits');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const chargerMouvements = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('per_page', '100');
      if (pendingOnly) {
        params.set('statut', 'en_attente');
      }
      const response = await apiFetch(`/mouvements-stock?${params}`);
      if (!response.ok) {
        throw new Error('Impossible de charger les mouvements');
      }
      const data = await response.json();
      setMouvements(Array.isArray(data.data) ? data.data : []);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erreur de chargement des mouvements');
    }
  }, [pendingOnly]);

  const chargerCommandes = useCallback(async () => {
    try {
      const response = await apiFetch('/commandes-fournisseurs?per_page=50');
      if (!response.ok) return;
      const data = await response.json();
      const items = Array.isArray(data.data) ? data.data : [];
      // Seules les commandes encore ouvertes ont du sens pour un arrivage.
      setCommandes(items.filter((c: CommandeFournisseur) => c.statut === 'en_cours' || c.statut === 'en_attente'));
    } catch {
      // Le lien commande est optionnel : on ne bloque pas la saisie.
    }
  }, []);

  useEffect(() => {
    chargerProduits();
    chargerCommandes();
  }, [chargerProduits, chargerCommandes]);

  useEffect(() => {
    chargerMouvements();
  }, [chargerMouvements]);

  useEffect(() => {
    const produitId = searchParams.get('produit_id');
    if (produitId && produits.length > 0) {
      setFormData(prev => ({ ...prev, produit_id: produitId }));
    }
  }, [searchParams, produits]);

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingId(null);
  };

  const handleCodeDetected = (code: string, produit?: Produit) => {
    if (produit) {
      setFormData(prev => ({
        ...prev,
        produit_id: produit.id.toString(),
        quantite: prev.quantite || '1',
      }));
      toast.success(`Produit détecté : ${produit.nom}`);
    } else {
      toast.warning(`Code ${code} détecté, mais produit non trouvé`);
    }
    setShowScanner(false);
  };

  const startEdit = (m: MouvementStock) => {
    setEditingId(m.id);
    setFormData({
      produit_id: String(m.produit_id),
      quantite: String(m.quantite),
      type: m.type,
      raison: m.raison,
      reference_bon: m.reference_bon ?? '',
      notes: m.notes ?? '',
      date_peremption: m.date_peremption?.slice(0, 10) ?? '',
      date_fabrication: m.date_fabrication?.slice(0, 10) ?? '',
      commande_fournisseur_id: m.commande_fournisseur_id ? String(m.commande_fournisseur_id) : '',
    });
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

    const corps = {
      produit_id: parseInt(formData.produit_id, 10),
      quantite,
      type: formData.type,
      raison: formData.raison,
      reference_bon: formData.reference_bon || null,
      notes: formData.notes || null,
      date_peremption: formData.date_peremption || null,
      date_fabrication: formData.date_fabrication || null,
      commande_fournisseur_id: formData.commande_fournisseur_id
        ? parseInt(formData.commande_fournisseur_id, 10)
        : null,
    };

    try {
      setIsSaving(true);
      const response = await apiFetch(
        editingId ? `/mouvements-stock/${editingId}` : '/mouvements-stock',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(corps),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Impossible d’enregistrer l’arrivage');
      }

      toast.success(
        editingId
          ? 'Demande mise à jour'
          : 'Arrivage enregistré. Il reste à le valider.'
      );
      resetForm();
      chargerMouvements();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de l’enregistrement');
    } finally {
      setIsSaving(false);
    }
  };

  const validerTout = async (m: MouvementStock) => {
    try {
      const response = await apiFetch(`/mouvements-stock/${m.id}/valider`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Validation impossible');
      }

      const data = await response.json().catch(() => ({}));
      toast.success(
        `Stock mis à jour : ${data.stock_precedent} → ${data.stock_nouveau}`
      );
      chargerMouvements();
      chargerProduits();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erreur de validation');
    }
  };

  const confirmerReception = async () => {
    if (!reception) return;

    const recue = parseInt(reception.quantiteRecue, 10);
    if (Number.isNaN(recue) || recue < 1 || recue > reception.quantite) {
      toast.error(`La quantité reçue doit être comprise entre 1 et ${reception.quantite}`);
      return;
    }

    try {
      const response = await apiFetch(`/mouvements-stock/${reception.id}/valider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ quantite_recue: recue }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Validation impossible');
      }

      const data = await response.json().catch(() => ({}));
      setReception(null);
      toast.success(
        data.partiel
          ? `Réception partielle : ${recue}/${reception.quantite}. Il reste ${data.quantite_restante} à réceptionner.`
          : `Stock mis à jour : ${data.stock_precedent} → ${data.stock_nouveau}`
      );
      chargerMouvements();
      chargerProduits();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erreur de validation');
    }
  };

  const confirmerRejet = async () => {
    if (!rejet) return;

    if (!rejet.motif.trim()) {
      toast.error('Le motif du rejet est obligatoire');
      return;
    }

    try {
      const response = await apiFetch(`/mouvements-stock/${rejet.id}/rejeter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ raison_rejet: rejet.motif.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Rejet impossible');
      }

      setRejet(null);
      if (editingId === rejet.id) resetForm();
      toast.success('Mouvement rejeté');
      chargerMouvements();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors du rejet');
    }
  };

  const supprimerMouvement = async (m: MouvementStock) => {
    if (!window.confirm(`Supprimer la demande pour « ${m.produit?.nom ?? 'ce produit'} » ?`)) {
      return;
    }

    try {
      const response = await apiFetch(`/mouvements-stock/${m.id}`, { method: 'DELETE' });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Suppression impossible');
      }

      if (editingId === m.id) resetForm();
      toast.success('Demande supprimée');
      chargerMouvements();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la suppression');
    }
  };

  const produitsFiltres = useMemo(() => {
    const q = searchProduit.trim().toLowerCase();
    if (!q) return produits;
    return produits.filter(
      (p) => p.nom.toLowerCase().includes(q) || String(p.id) === q
    );
  }, [produits, searchProduit]);

  const produitSelectionne = useMemo(
    () => produits.find(p => String(p.id) === formData.produit_id),
    [produits, formData.produit_id]
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
          <Badge variant="secondary">{userPeutGerer ? 'Gérant' : 'Caissier'}</Badge>
          <Badge variant="outline">{pendingOnly ? 'En attente' : 'Tous les mouvements'}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {editingId !== null ? 'Modifier la demande' : 'Nouvel arrivage'}
          </CardTitle>
          <CardDescription>
            {editingId !== null
              ? 'Corrigez une demande encore en attente, puis enregistrez.'
              : 'Créez une demande d’arrivage. Le mouvement est enregistré et peut être validé par un gérant.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            {editingId !== null && (
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                Annuler la modification
              </Button>
            )}

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
                  {produitSelectionne && (
                    <p className="text-xs text-slate-500">
                      Stock actuel : {produitSelectionne.quantite_stock}
                    </p>
                  )}
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
                  <Label htmlFor="type">Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData(prev => ({
                        ...prev,
                        type: value as 'entree' | 'sortie',
                        raison: value === 'entree' ? 'arrivage' : 'casse',
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entree">Entrée (arrivage)</SelectItem>
                      <SelectItem value="sortie">Sortie (retour, casse…)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.type === 'sortie' && (
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="raison">Motif de la sortie *</Label>
                    <Select
                      value={formData.raison}
                      onValueChange={(value) =>
                        setFormData(prev => ({ ...prev, raison: value as MouvementStock['raison'] }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RAISONS_SORTIE.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="reference_bon">Référence bon</Label>
                  <Input
                    id="reference_bon"
                    value={formData.reference_bon}
                    onChange={(e) => setFormData(prev => ({ ...prev, reference_bon: e.target.value }))}
                    placeholder="Ex: BON-2026-001"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date_fabrication">Date de fabrication</Label>
                  <Input
                    id="date_fabrication"
                    type="date"
                    value={formData.date_fabrication}
                    onChange={(e) => setFormData(prev => ({ ...prev, date_fabrication: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date_peremption">Date de péremption</Label>
                  <Input
                    id="date_peremption"
                    type="date"
                    value={formData.date_peremption}
                    onChange={(e) => setFormData(prev => ({ ...prev, date_peremption: e.target.value }))}
                  />
                </div>
              </div>

              {commandes.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="commande_fournisseur_id">Commande fournisseur liée</Label>
                  <Select
                    value={formData.commande_fournisseur_id || 'aucune'}
                    onValueChange={(value) =>
                      setFormData(prev => ({
                        ...prev,
                        commande_fournisseur_id: value === 'aucune' ? '' : value,
                        reference_bon:
                          value === 'aucune'
                            ? prev.reference_bon
                            : (commandes.find(c => String(c.id) === value)?.numero_commande ??
                              prev.reference_bon),
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Aucune commande liée" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aucune">Aucune</SelectItem>
                      {commandes.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.numero_commande}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    La quantité reçue sera imputée sur les lignes de la commande.
                  </p>
                </div>
              )}

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
                  {editingId !== null ? 'Enregistrer les modifications' : 'Enregistrer l’arrivage'}
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
                  placeholder="Filtrer par nom de produit..."
                  value={searchProduit}
                  onChange={(e) => setSearchProduit(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">{mouvements.length} mouvements</Badge>
              {userPeutGerer ? (
                <Badge variant="outline">Gérant peut valider</Badge>
              ) : (
                <Badge variant="secondary">En attente de validation</Badge>
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
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <PackageSearch className="h-8 w-8 mb-2 opacity-50" />
                        <p className="text-sm">
                          {pendingOnly ? 'Aucune demande en attente' : 'Aucun mouvement trouvé'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  mouvements.map((mouvement) => (
                    <TableRow key={mouvement.id}>
                      <TableCell>{new Date(mouvement.created_at).toLocaleString('fr-FR')}</TableCell>
                      <TableCell>{mouvement.produit?.nom ?? 'Produit inconnu'}</TableCell>
                      <TableCell>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[mouvement.type] ?? ''}`}>
                          {TYPE_LABEL[mouvement.type] ?? mouvement.type}
                        </span>
                      </TableCell>
                      <TableCell>
                        {mouvement.est_partiel ? (
                          <span title={`Reçu ${mouvement.quantite_recue}/${mouvement.quantite}`}>
                            {mouvement.quantite_effective ?? mouvement.quantite}
                            <span className="ml-1 text-xs text-amber-600">
                              /{mouvement.quantite}
                            </span>
                          </span>
                        ) : (
                          mouvement.quantite
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            mouvement.statut === 'accepte'
                              ? 'default'
                              : mouvement.statut === 'rejete'
                                ? 'destructive'
                                : 'secondary'
                          }
                        >
                          {mouvement.libelle_statut ?? mouvement.statut}
                        </Badge>
                        {mouvement.motif_rejet && (
                          <p className="mt-1 text-xs text-red-600">{mouvement.motif_rejet}</p>
                        )}
                        {mouvement.statut !== 'en_attente' && mouvement.validePar && (
                          <p className="mt-1 text-xs text-slate-500">
                            Traité par {mouvement.validePar.name}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>{mouvement.reference_bon || '—'}</TableCell>
                      <TableCell>{mouvement.user?.name || '—'}</TableCell>
                      <TableCell className="space-x-2">
                        {mouvement.statut === 'en_attente' ? (
                          <>
                            {userPeutGerer ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => validerTout(mouvement)}
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" />Valider
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setReception({
                                      id: mouvement.id,
                                      produit: mouvement.produit?.nom ?? 'Produit',
                                      quantite: mouvement.quantite,
                                      quantiteRecue: String(mouvement.quantite),
                                    })
                                  }
                                >
                                  Partiel
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() =>
                                    setRejet({
                                      id: mouvement.id,
                                      produit: mouvement.produit?.nom ?? 'Produit',
                                      motif: '',
                                    })
                                  }
                                >
                                  <XCircle className="mr-2 h-4 w-4" />Rejeter
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button size="sm" variant="outline" onClick={() => startEdit(mouvement)}>
                                  <Pencil className="mr-2 h-4 w-4" />Modifier
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => supprimerMouvement(mouvement)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />Supprimer
                                </Button>
                              </>
                            )}
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

      {/* Réception partielle */}
      <Dialog
        open={reception !== null}
        onOpenChange={(open) => !open && setReception(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quantité réellement reçue</DialogTitle>
            <DialogDescription>
              {reception?.produit} — {reception?.quantite} unité(s) annoncées
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="quantite_recue">Quantité reçue</Label>
            <Input
              id="quantite_recue"
              type="number"
              min="1"
              max={reception?.quantite}
              value={reception?.quantiteRecue ?? ''}
              onChange={(e) =>
                setReception(r => (r ? { ...r, quantiteRecue: e.target.value } : r))
              }
            />
            <p className="text-xs text-slate-500">
              Saisissez moins que la quantité annoncée si le lot est incomplet.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReception(null)}>
              Annuler
            </Button>
            <Button onClick={confirmerReception}>Confirmer la réception</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Motif de rejet */}
      <Dialog open={rejet !== null} onOpenChange={(open) => !open && setRejet(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter la demande</DialogTitle>
            <DialogDescription>{rejet?.produit}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motif_rejet">Motif du rejet *</Label>
            <Textarea
              id="motif_rejet"
              rows={3}
              value={rejet?.motif ?? ''}
              onChange={(e) => setRejet(r => (r ? { ...r, motif: e.target.value } : r))}
              placeholder="Ex. Marchandise endommagée, quantité non conforme…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejet(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={confirmerRejet}>
              Rejeter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
