'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import {
  Truck,
  Search,
  Plus,
  Pencil,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Building,
  Loader2,
  X,
  Save,
  AlertTriangle,
  Filter,
  Package,
  Clock,
  UserCheck,
  Users,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';
import { getEffectiveRole, canGerer } from '@/lib/role';

interface Fournisseur {
  id: number;
  nom: string;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  ville: string | null;
  pays: string | null;
  contact_principal: string | null;
  email_contact: string | null;
  telephone_contact: string | null;
  conditions_paiement: string | null;
  delai_livraison: number | null;
  notes: string | null;
  actif: boolean;
  created_at: string;
}

interface StatistiquesFournisseurs {
  total_fournisseurs: number;
  fournisseurs_actifs: number;
  fournisseurs_inactifs: number;
}

interface FournisseurFormData {
  nom: string;
  email: string;
  telephone: string;
  adresse: string;
  ville: string;
  pays: string;
  contact_principal: string;
  email_contact: string;
  telephone_contact: string;
  conditions_paiement: string;
  delai_livraison: string;
  notes: string;
  actif: boolean;
}

const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

export default function FournisseursPage() {
  const { user } = useAuth();
  const roleCourant = getEffectiveRole(user);
  const userPeutGerer = canGerer(user, roleCourant);

  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [fournisseurSelectionne, setFournisseurSelectionne] = useState<Fournisseur | null>(null);
  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState<'tous' | 'actif' | 'inactif'>('tous');
  const [isLoading, setIsLoading] = useState(true);
  const [showModalFournisseur, setShowModalFournisseur] = useState(false);
  const [modeEdition, setModeEdition] = useState(false);
  const [showConfirmationSuppression, setShowConfirmationSuppression] = useState(false);
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);
  const [, setLoadingDetails] = useState(false);

  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
  });

  const [formData, setFormData] = useState<FournisseurFormData>({
    nom: '',
    email: '',
    telephone: '',
    adresse: '',
    ville: '',
    pays: '',
    contact_principal: '',
    email_contact: '',
    telephone_contact: '',
    conditions_paiement: '',
    delai_livraison: '',
    notes: '',
    actif: true,
  });

  const [statsFournisseurs, setStatsFournisseurs] = useState<StatistiquesFournisseurs>({
    total_fournisseurs: 0,
    fournisseurs_actifs: 0,
    fournisseurs_inactifs: 0,
  });

  const rechercheDebouncee = useDebounce(recherche, 300);

  useEffect(() => {
    chargerFournisseurs();
    chargerStatistiques();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chargerFournisseursAvecFiltres();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rechercheDebouncee, filtreStatut]);

  const chargerFournisseursAvecFiltres = async (page = 1) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (rechercheDebouncee) params.append('search', rechercheDebouncee);
      if (filtreStatut !== 'tous') params.append('actif', filtreStatut === 'actif' ? '1' : '0');
      params.append('page', page.toString());

      const response = await apiFetch(`/fournisseurs?${params}`, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) throw new Error(`Erreur API: ${response.status}`);

      const data = await response.json();
      const rows: Fournisseur[] = data.data ?? [];

      setFournisseurs(rows);
      setPagination({
        current_page: data.current_page ?? page,
        last_page: data.last_page ?? 1,
        per_page: data.per_page ?? 20,
        total: data.total ?? rows.length,
      });
    } catch (error) {
      console.error('Erreur chargement fournisseurs:', error);
      toast.error('Erreur lors du chargement des fournisseurs');
    } finally {
      setIsLoading(false);
    }
  };

  const chargerFournisseurs = async () => {
    await chargerFournisseursAvecFiltres(1);
  };

  const chargerStatistiques = async () => {
    try {
      const response = await apiFetch('/fournisseurs/statistiques', {
        headers: { Accept: 'application/json' },
      });
      if (response.ok) {
        const stats = await response.json();
        setStatsFournisseurs(stats);
      }
    } catch (error) {
      console.error('Erreur chargement statistiques:', error);
    }
  };

  const chargerDetailsFournisseur = async (fournisseurId: number) => {
    try {
      setLoadingDetails(true);
      const response = await apiFetch(`/fournisseurs/${fournisseurId}`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('Erreur chargement détails');
      const details: Fournisseur = await response.json();
      setFournisseurSelectionne(details);
    } catch (error) {
      console.error('Erreur chargement détails fournisseur:', error);
      toast.error('Erreur lors du chargement des détails du fournisseur');
    } finally {
      setLoadingDetails(false);
    }
  };

  const reinitialiserFormulaire = () => {
    setFormData({
      nom: '',
      email: '',
      telephone: '',
      adresse: '',
      ville: '',
      pays: '',
      contact_principal: '',
      email_contact: '',
      telephone_contact: '',
      conditions_paiement: '',
      delai_livraison: '',
      notes: '',
      actif: true,
    });
  };

  const ouvrirModalCreation = () => {
    setFournisseurSelectionne(null);
    setModeEdition(true);
    reinitialiserFormulaire();
    setShowModalFournisseur(true);
  };

  const ouvrirModalEdition = (fournisseur: Fournisseur) => {
    setFournisseurSelectionne(fournisseur);
    setModeEdition(true);
    setFormData({
      nom: fournisseur.nom,
      email: fournisseur.email ?? '',
      telephone: fournisseur.telephone ?? '',
      adresse: fournisseur.adresse ?? '',
      ville: fournisseur.ville ?? '',
      pays: fournisseur.pays ?? '',
      contact_principal: fournisseur.contact_principal ?? '',
      email_contact: fournisseur.email_contact ?? '',
      telephone_contact: fournisseur.telephone_contact ?? '',
      conditions_paiement: fournisseur.conditions_paiement ?? '',
      delai_livraison: fournisseur.delai_livraison != null ? String(fournisseur.delai_livraison) : '',
      notes: fournisseur.notes ?? '',
      actif: fournisseur.actif,
    });
    setShowModalFournisseur(true);
  };

  const ouvrirModalVisualisation = async (fournisseur: Fournisseur) => {
    setFournisseurSelectionne(fournisseur);
    setModeEdition(false);
    setShowModalFournisseur(true);
    await chargerDetailsFournisseur(fournisseur.id);
  };

  const handleInputChange = (field: keyof FournisseurFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const creerFournisseur = async () => {
    try {
      setActionEnCours('creation');
      const body = {
        ...formData,
        delai_livraison: formData.delai_livraison ? Number(formData.delai_livraison) : null,
      };
      const response = await apiFetch('/fournisseurs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur création fournisseur');
      }

      const result = await response.json();
      const nouveauFournisseur = result.data ?? result;
      setFournisseurs((prev) => [...prev, nouveauFournisseur]);
      chargerStatistiques();
      setShowModalFournisseur(false);
      reinitialiserFormulaire();
      toast.success('Fournisseur créé avec succès');
    } catch (error: unknown) {
      console.error('Erreur création fournisseur:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la création du fournisseur');
    } finally {
      setActionEnCours(null);
    }
  };

  const mettreAJourFournisseur = async () => {
    if (!fournisseurSelectionne) return;
    try {
      setActionEnCours('modification');
      const body = {
        ...formData,
        delai_livraison: formData.delai_livraison ? Number(formData.delai_livraison) : null,
      };
      const response = await apiFetch(`/fournisseurs/${fournisseurSelectionne.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur modification fournisseur');
      }

      const result = await response.json();
      const fournisseurModifie = result.data ?? result;
      setFournisseurs((prev) =>
        prev.map((f) => (f.id === fournisseurSelectionne.id ? fournisseurModifie : f))
      );
      setFournisseurSelectionne(fournisseurModifie);
      setModeEdition(false);
      toast.success('Fournisseur modifié avec succès');
    } catch (error: unknown) {
      console.error('Erreur modification fournisseur:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la modification du fournisseur');
    } finally {
      setActionEnCours(null);
    }
  };

  const supprimerFournisseur = async () => {
    if (!fournisseurSelectionne) return;
    try {
      setActionEnCours('suppression');
      const response = await apiFetch(`/fournisseurs/${fournisseurSelectionne.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur suppression fournisseur');
      }

      setFournisseurs((prev) => prev.filter((f) => f.id !== fournisseurSelectionne.id));
      setShowModalFournisseur(false);
      setShowConfirmationSuppression(false);
      setFournisseurSelectionne(null);
      chargerStatistiques();
      toast.success('Fournisseur supprimé avec succès');
    } catch (error: unknown) {
      console.error('Erreur suppression fournisseur:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la suppression du fournisseur');
    } finally {
      setActionEnCours(null);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
          <p className="mt-4 text-slate-600 dark:text-slate-400">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  Fournisseurs
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {pagination.total} fournisseur{pagination.total !== 1 ? 's' : ''} • Gestion des approvisionnements
                </p>
              </div>
            </div>
          </div>

          {userPeutGerer && (
            <Button
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
              onClick={ouvrirModalCreation}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouveau Fournisseur
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 space-y-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Fournisseurs</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{statsFournisseurs.total_fournisseurs}</p>
                </div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                  <Building className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Fournisseurs Actifs</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{statsFournisseurs.fournisseurs_actifs}</p>
                  <p className="text-sm text-green-500">
                    {statsFournisseurs.total_fournisseurs > 0
                      ? Math.round((statsFournisseurs.fournisseurs_actifs / statsFournisseurs.total_fournisseurs) * 100)
                      : 0}
                    % du total
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center">
                  <UserCheck className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Fournisseurs Inactifs</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{statsFournisseurs.fournisseurs_inactifs}</p>
                </div>
                <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Barre de Recherche et Filtres */}
        <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Rechercher un fournisseur..."
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                    className="pl-10 pr-10 w-80 bg-white/50 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600"
                  />
                  {recherche && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => setRecherche('')}
                      aria-label="Effacer la recherche"
                    >
                      <X className="w-4 h-4 text-slate-500" />
                    </Button>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <select
                    value={filtreStatut}
                    onChange={(e) => setFiltreStatut(e.target.value as 'tous' | 'actif' | 'inactif')}
                    className="bg-white/50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="tous">Tous les statuts</option>
                    <option value="actif">Actifs</option>
                    <option value="inactif">Inactifs</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-2 text-sm text-slate-500">
                <span>{pagination.total} fournisseur{pagination.total !== 1 ? 's' : ''} trouvé{pagination.total !== 1 ? 's' : ''}</span>
                <span>•</span>
                <span>Page {pagination.current_page} sur {pagination.last_page}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Liste Fournisseurs en Tableau */}
        <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
          <CardHeader>
            <CardTitle>Liste des fournisseurs</CardTitle>
            <CardDescription>
              Cliquez sur une ligne pour afficher les détails du fournisseur.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto overflow-y-auto max-h-[640px]">
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95">
                    Fournisseur
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95">
                    Email
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95">
                    Téléphone
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95">
                    Ville
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95">
                    Contact
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95">
                    Statut
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12">
                      <div className="flex items-center justify-center gap-2 text-slate-500">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Chargement des fournisseurs...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : fournisseurs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12">
                      <EmptyState
                        icon={Truck}
                        title="Aucun fournisseur trouvé"
                        description="Aucun fournisseur ne correspond à vos critères de recherche."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  fournisseurs.map((fournisseur) => (
                    <TableRow
                      key={fournisseur.id}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700"
                      onClick={() => ouvrirModalVisualisation(fournisseur)}
                    >
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Truck className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900 dark:text-white">{fournisseur.nom}</span>
                            {fournisseur.pays && (
                              <span className="text-sm text-slate-500 dark:text-slate-400">{fournisseur.pays}</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {fournisseur.email ? (
                          <div className="flex items-center space-x-1 text-sm">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span>{fournisseur.email}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {fournisseur.telephone ? (
                          <div className="flex items-center space-x-1 text-sm">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{fournisseur.telephone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {fournisseur.ville ? (
                          <div className="flex items-center space-x-1 text-sm">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{fournisseur.ville}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {fournisseur.contact_principal ? (
                          <span className="text-sm">{fournisseur.contact_principal}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={fournisseur.actif ? 'default' : 'outline'}
                          className={
                            fournisseur.actif
                              ? 'bg-green-500/10 text-green-600 border-green-500/20'
                              : 'bg-slate-500/10 text-slate-600 border-slate-500/20'
                          }
                        >
                          {fournisseur.actif ? 'Actif' : 'Inactif'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              ouvrirModalVisualisation(fournisseur);
                            }}
                          >
                            <Package className="w-4 h-4" />
                          </Button>
                          {userPeutGerer && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  ouvrirModalEdition(fournisseur);
                                }}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFournisseurSelectionne(fournisseur);
                                  setShowConfirmationSuppression(true);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        {pagination.last_page > 1 && (
          <div className="flex justify-center items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => chargerFournisseursAvecFiltres(pagination.current_page - 1)}
              disabled={pagination.current_page === 1}
            >
              <ArrowUp className="w-4 h-4 mr-2" />
              Précédent
            </Button>

            <span className="text-sm text-slate-600 dark:text-slate-400">
              Page {pagination.current_page} sur {pagination.last_page}
            </span>

            <Button
              variant="outline"
              onClick={() => chargerFournisseursAvecFiltres(pagination.current_page + 1)}
              disabled={pagination.current_page === pagination.last_page}
            >
              Suivant
              <ArrowDown className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </main>

      {/* Modal Détail / Édition Fournisseur */}
      <AnimatePresence>
        {showModalFournisseur && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !modeEdition && setShowModalFournisseur(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header Modal */}
              <div className="flex items-center justify-between p-6 border-b border-slate-200/50 dark:border-slate-700/50">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                    <Truck className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      {fournisseurSelectionne ? fournisseurSelectionne.nom : 'Nouveau Fournisseur'}
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400">
                      {fournisseurSelectionne
                        ? `Fournisseur ${fournisseurSelectionne.actif ? 'Actif' : 'Inactif'}`
                        : 'Création d\'un nouveau fournisseur'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {fournisseurSelectionne && !modeEdition && userPeutGerer && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => ouvrirModalEdition(fournisseurSelectionne)}
                        disabled={actionEnCours !== null}
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Modifier
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-300 hover:bg-red-50"
                        onClick={() => setShowConfirmationSuppression(true)}
                        disabled={actionEnCours !== null}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Supprimer
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowModalFournisseur(false);
                      setModeEdition(false);
                      setFournisseurSelectionne(null);
                    }}
                    disabled={actionEnCours !== null}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Content Modal */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                {modeEdition ? (
                  // MODE ÉDITION / CRÉATION
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          {fournisseurSelectionne ? 'Modifier le fournisseur' : 'Nouveau Fournisseur'}
                        </CardTitle>
                        <CardDescription>
                          {fournisseurSelectionne
                            ? 'Modifiez les informations du fournisseur'
                            : 'Remplissez les informations pour créer un nouveau fournisseur'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {/* Ligne 1: Nom */}
                          <div>
                            <label className="text-sm font-medium">Nom du fournisseur *</label>
                            <Input
                              placeholder="Ex: Import Export SARL"
                              value={formData.nom}
                              onChange={(e) => handleInputChange('nom', e.target.value)}
                              disabled={actionEnCours !== null}
                            />
                          </div>

                          {/* Ligne 2: Email / Téléphone */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium">Email</label>
                              <Input
                                type="email"
                                placeholder="contact@fournisseur.com"
                                value={formData.email}
                                onChange={(e) => handleInputChange('email', e.target.value)}
                                disabled={actionEnCours !== null}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Téléphone</label>
                              <Input
                                placeholder="+229 01 02 03 04"
                                value={formData.telephone}
                                onChange={(e) => handleInputChange('telephone', e.target.value)}
                                disabled={actionEnCours !== null}
                              />
                            </div>
                          </div>

                          {/* Ligne 3: Adresse / Ville / Pays */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="text-sm font-medium">Adresse</label>
                              <Input
                                placeholder="123 Rue du Commerce"
                                value={formData.adresse}
                                onChange={(e) => handleInputChange('adresse', e.target.value)}
                                disabled={actionEnCours !== null}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Ville</label>
                              <Input
                                placeholder="Cotonou"
                                value={formData.ville}
                                onChange={(e) => handleInputChange('ville', e.target.value)}
                                disabled={actionEnCours !== null}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Pays</label>
                              <Input
                                placeholder="Bénin"
                                value={formData.pays}
                                onChange={(e) => handleInputChange('pays', e.target.value)}
                                disabled={actionEnCours !== null}
                              />
                            </div>
                          </div>

                          {/* Séparateur contact */}
                          <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Personne de contact</p>
                          </div>

                          {/* Ligne 4: Contact principal / Email contact / Téléphone contact */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="text-sm font-medium">Contact principal</label>
                              <Input
                                placeholder="Nom du contact"
                                value={formData.contact_principal}
                                onChange={(e) => handleInputChange('contact_principal', e.target.value)}
                                disabled={actionEnCours !== null}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Email contact</label>
                              <Input
                                type="email"
                                placeholder="contact@email.com"
                                value={formData.email_contact}
                                onChange={(e) => handleInputChange('email_contact', e.target.value)}
                                disabled={actionEnCours !== null}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Téléphone contact</label>
                              <Input
                                placeholder="+229 98 76 54 32"
                                value={formData.telephone_contact}
                                onChange={(e) => handleInputChange('telephone_contact', e.target.value)}
                                disabled={actionEnCours !== null}
                              />
                            </div>
                          </div>

                          {/* Séparateur conditions */}
                          <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Conditions commerciales</p>
                          </div>

                          {/* Ligne 5: Conditions paiement / Délai livraison */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium">Conditions de paiement</label>
                              <Input
                                placeholder="Ex: 30 jours, à la livraison..."
                                value={formData.conditions_paiement}
                                onChange={(e) => handleInputChange('conditions_paiement', e.target.value)}
                                disabled={actionEnCours !== null}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Délai de livraison (jours)</label>
                              <Input
                                type="number"
                                placeholder="7"
                                min="0"
                                value={formData.delai_livraison}
                                onChange={(e) => handleInputChange('delai_livraison', e.target.value)}
                                disabled={actionEnCours !== null}
                              />
                            </div>
                          </div>

                          {/* Notes */}
                          <div>
                            <label className="text-sm font-medium">Notes</label>
                            <textarea
                              className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-slate-700/50 text-sm"
                              rows={3}
                              placeholder="Notes sur le fournisseur..."
                              value={formData.notes}
                              onChange={(e) => handleInputChange('notes', e.target.value)}
                              disabled={actionEnCours !== null}
                            />
                          </div>

                          {/* Actif */}
                          <div className="flex items-center space-x-3 pt-2">
                            <input
                              type="checkbox"
                              id="actif"
                              checked={formData.actif}
                              onChange={(e) => handleInputChange('actif', e.target.checked)}
                              className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                              disabled={actionEnCours !== null}
                            />
                            <label htmlFor="actif" className="text-sm font-medium cursor-pointer">
                              Fournisseur actif
                            </label>
                          </div>

                          {/* Boutons */}
                          <div className="flex space-x-3 pt-4">
                            <Button
                              className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500"
                              onClick={fournisseurSelectionne ? mettreAJourFournisseur : creerFournisseur}
                              disabled={actionEnCours !== null || !formData.nom.trim()}
                            >
                              {actionEnCours === 'creation' || actionEnCours === 'modification' ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  {fournisseurSelectionne ? 'Modification...' : 'Création...'}
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4 mr-2" />
                                  {fournisseurSelectionne ? 'Enregistrer' : 'Créer le fournisseur'}
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                if (fournisseurSelectionne) {
                                  setModeEdition(false);
                                } else {
                                  setShowModalFournisseur(false);
                                }
                              }}
                              disabled={actionEnCours !== null}
                            >
                              Annuler
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : fournisseurSelectionne ? (
                  // MODE VISUALISATION
                  <Tabs defaultValue="informations">
                    <TabsList className="w-full">
                      <TabsTrigger value="informations" className="flex-1">Informations</TabsTrigger>
                      <TabsTrigger value="contact" className="flex-1">Contact</TabsTrigger>
                      <TabsTrigger value="conditions" className="flex-1">Conditions</TabsTrigger>
                    </TabsList>

                    <TabsContent value="informations" className="space-y-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Informations Générales</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center space-x-3">
                              <Building className="w-5 h-5 text-slate-400" />
                              <div>
                                <p className="font-medium">Nom</p>
                                <p className="text-slate-600 dark:text-slate-400">{fournisseurSelectionne.nom}</p>
                              </div>
                            </div>
                            {fournisseurSelectionne.pays && (
                              <div className="flex items-center space-x-3">
                                <MapPin className="w-5 h-5 text-slate-400" />
                                <div>
                                  <p className="font-medium">Pays</p>
                                  <p className="text-slate-600 dark:text-slate-400">{fournisseurSelectionne.pays}</p>
                                </div>
                              </div>
                            )}
                            {fournisseurSelectionne.ville && (
                              <div className="flex items-center space-x-3">
                                <MapPin className="w-5 h-5 text-slate-400" />
                                <div>
                                  <p className="font-medium">Ville</p>
                                  <p className="text-slate-600 dark:text-slate-400">{fournisseurSelectionne.ville}</p>
                                </div>
                              </div>
                            )}
                            <div className="flex items-center space-x-3">
                              <Badge
                                variant={fournisseurSelectionne.actif ? 'default' : 'outline'}
                                className={
                                  fournisseurSelectionne.actif
                                    ? 'bg-green-500/10 text-green-600 border-green-500/20'
                                    : 'bg-slate-500/10 text-slate-600 border-slate-500/20'
                                }
                              >
                                {fournisseurSelectionne.actif ? 'Actif' : 'Inactif'}
                              </Badge>
                            </div>
                          </div>
                          {fournisseurSelectionne.adresse && (
                            <div className="flex items-start space-x-3 pt-4">
                              <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                              <div>
                                <p className="font-medium">Adresse</p>
                                <p className="text-slate-600 dark:text-slate-400">{fournisseurSelectionne.adresse}</p>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {fournisseurSelectionne.notes && (
                        <Card>
                          <CardHeader>
                            <CardTitle>Notes</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                              {fournisseurSelectionne.notes}
                            </p>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>

                    <TabsContent value="contact" className="space-y-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Coordonnées</CardTitle>
                          <CardDescription>Informations de contact du fournisseur</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {fournisseurSelectionne.email && (
                              <div className="flex items-center space-x-3">
                                <Mail className="w-5 h-5 text-slate-400" />
                                <div>
                                  <p className="font-medium">Email</p>
                                  <p className="text-slate-600 dark:text-slate-400">{fournisseurSelectionne.email}</p>
                                </div>
                              </div>
                            )}
                            {fournisseurSelectionne.telephone && (
                              <div className="flex items-center space-x-3">
                                <Phone className="w-5 h-5 text-slate-400" />
                                <div>
                                  <p className="font-medium">Téléphone</p>
                                  <p className="text-slate-600 dark:text-slate-400">{fournisseurSelectionne.telephone}</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {fournisseurSelectionne.contact_principal && (
                            <>
                              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Personne de contact</p>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center space-x-3">
                                  <Users className="w-5 h-5 text-slate-400" />
                                  <div>
                                    <p className="font-medium">Contact principal</p>
                                    <p className="text-slate-600 dark:text-slate-400">{fournisseurSelectionne.contact_principal}</p>
                                  </div>
                                </div>
                                {fournisseurSelectionne.email_contact && (
                                  <div className="flex items-center space-x-3">
                                    <Mail className="w-5 h-5 text-slate-400" />
                                    <div>
                                      <p className="font-medium">Email contact</p>
                                      <p className="text-slate-600 dark:text-slate-400">{fournisseurSelectionne.email_contact}</p>
                                    </div>
                                  </div>
                                )}
                                {fournisseurSelectionne.telephone_contact && (
                                  <div className="flex items-center space-x-3">
                                    <Phone className="w-5 h-5 text-slate-400" />
                                    <div>
                                      <p className="font-medium">Téléphone contact</p>
                                      <p className="text-slate-600 dark:text-slate-400">{fournisseurSelectionne.telephone_contact}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="conditions" className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                          <CardContent className="p-6 text-center">
                            <Clock className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                              {fournisseurSelectionne.delai_livraison != null
                                ? `${fournisseurSelectionne.delai_livraison}j`
                                : '—'}
                            </p>
                            <p className="text-slate-600 dark:text-slate-400">Délai de livraison</p>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardContent className="p-6 text-center">
                            <Package className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                            <p className="text-lg font-bold text-slate-900 dark:text-white">
                              {fournisseurSelectionne.conditions_paiement || '—'}
                            </p>
                            <p className="text-slate-600 dark:text-slate-400">Conditions de paiement</p>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Confirmation Suppression */}
      <AnimatePresence>
        {showConfirmationSuppression && fournisseurSelectionne && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6"
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">Confirmer la suppression</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    Êtes-vous sûr de vouloir supprimer le fournisseur {fournisseurSelectionne.nom} ?
                  </p>
                </div>
              </div>

              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Cette action est irréversible. Si le fournisseur a des commandes en cours, la suppression sera bloquée.
              </p>

              <div className="flex space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmationSuppression(false)}
                  className="flex-1"
                  disabled={actionEnCours !== null}
                >
                  Annuler
                </Button>
                <Button
                  variant="destructive"
                  onClick={supprimerFournisseur}
                  className="flex-1"
                  disabled={actionEnCours !== null}
                >
                  {actionEnCours === 'suppression' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Suppression...
                    </>
                  ) : (
                    'Confirmer'
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
