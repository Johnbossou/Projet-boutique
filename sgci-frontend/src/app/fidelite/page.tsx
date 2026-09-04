'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2,
  Award,
  Star,
  Gift,
  Users,
  Plus,
  Trash2,
  CheckCircle2,
  Trophy,
  Edit,
  X,
  Save,
  Search,
  TrendingUp,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/EmptyState';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────────────────

interface NiveauFidelite {
  nom: string;
  points_min: number;
  remise_pourcentage: number;
}

interface Recompense {
  id: number;
  nom: string;
  points_requis: number;
  type: string;
  valeur: number;
  programme_fidelite_id?: number;
}

interface ProgrammeFidelite {
  id: number;
  nom: string;
  description: string;
  points_par_achat: number;
  valeur_point: number;
  actif: boolean;
  niveaux: NiveauFidelite[];
  recompenses: Recompense[];
  clients_fidelites_count?: number;
}

interface ProgrammeFormData {
  nom: string;
  description: string;
  points_par_achat: number;
  valeur_point: number;
  actif: boolean;
  niveaux: NiveauFidelite[];
}

interface ClientPoints {
  client: { id: number; nom: string; email: string } | null;
  points: number;
  programme_fidelite: ProgrammeFidelite | null;
  transactions: TransactionPoint[];
}

interface TransactionPoint {
  id: number;
  type: string;
  points: number;
  description: string;
  created_at: string;
}

interface RecompenseFormData {
  programme_fidelite_id: string;
  nom: string;
  points_requis: number;
  type: string;
  valeur: number;
}

interface InscrireClientForm {
  programme_fidelite_id: string;
  client_id: string;
}

interface ReclamerRecompenseForm {
  recompense_fidelite_id: string;
  client_id: string;
}

interface StatistiquesFidelite {
  total_clients: number;
  total_points_distribues: number;
  total_recompenses: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const RECOMPENSE_TYPE_LABELS: Record<string, string> = {
  remise: 'Remise',
  produit: 'Produit',
  service: 'Service',
};

const RECOMPENSE_TYPE_COLORS: Record<string, string> = {
  remise: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  produit: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  service: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  earned: 'Gagnés',
  spent: 'Dépensés',
  bonus: 'Bonus',
  redeemed: 'Échangés',
};

const TRANSACTION_TYPE_COLORS: Record<string, string> = {
  earned: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  spent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  bonus: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  redeemed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

const emptyProgramForm: ProgrammeFormData = {
  nom: '',
  description: '',
  points_par_achat: 1,
  valeur_point: 1,
  actif: true,
  niveaux: [{ nom: 'Bronze', points_min: 0, remise_pourcentage: 0 }],
};

const emptyRecompenseForm: RecompenseFormData = {
  programme_fidelite_id: '',
  nom: '',
  points_requis: 0,
  type: 'remise',
  valeur: 0,
};

const emptyInscrireForm: InscrireClientForm = {
  programme_fidelite_id: '',
  client_id: '',
};

const emptyReclamerForm: ReclamerRecompenseForm = {
  recompense_fidelite_id: '',
  client_id: '',
};

// ─── Page ───────────────────────────────────────────────────────────────────

export default function FidelitePage() {
  const [programmes, setProgrammes] = useState<ProgrammeFidelite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('programmes');

  // Stats
  const [stats, setStats] = useState<StatistiquesFidelite>({
    total_clients: 0,
    total_points_distribues: 0,
    total_recompenses: 0,
  });

  // Programme modal
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [programForm, setProgramForm] = useState<ProgrammeFormData>(emptyProgramForm);
  const [editingProgramId, setEditingProgramId] = useState<number | null>(null);
  const [programSaving, setProgramSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);

  // Recompense form
  const [showRecompenseModal, setShowRecompenseModal] = useState(false);
  const [recompenseForm, setRecompenseForm] = useState<RecompenseFormData>(emptyRecompenseForm);
  const [recompenseSaving, setRecompenseSaving] = useState(false);

  // Points client
  const [searchClientId, setSearchClientId] = useState('');
  const [clientPointsData, setClientPointsData] = useState<ClientPoints | null>(null);
  const [searchingPoints, setSearchingPoints] = useState(false);
  const [inscrireForm, setInscrireForm] = useState<InscrireClientForm>(emptyInscrireForm);
  const [reclamerForm, setReclamerForm] = useState<ReclamerRecompenseForm>(emptyReclamerForm);
  const [inscrireSaving, setInscrireSaving] = useState(false);
  const [reclamerSaving, setReclamerSaving] = useState(false);
  const [showInscrireModal, setShowInscrireModal] = useState(false);
  const [showReclamerModal, setShowReclamerModal] = useState(false);

  // ─── Data Fetching ──────────────────────────────────────────────────────

  const chargerProgrammes = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/fidelite');
      if (res.ok) {
        const json = await res.json();
        setProgrammes(json.data ?? []);
      }
    } catch {
      toast.error('Erreur lors du chargement des programmes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const chargerStats = useCallback(async () => {
    try {
      if (programmes.length > 0) {
        let totalClients = 0;
        let totalPoints = 0;
        let totalRecompenses = 0;
        for (const p of programmes) {
          const res = await apiFetch(`/fidelite/statistiques?programme_fidelite_id=${p.id}`);
          if (res.ok) {
            const s = await res.json();
            totalClients += s.total_clients ?? 0;
            totalPoints += s.total_points_distribues ?? 0;
            totalRecompenses += s.total_recompenses ?? 0;
          }
        }
        setStats({ total_clients: totalClients, total_points_distribues: totalPoints, total_recompenses: totalRecompenses });
      }
    } catch {
      // silent
    }
  }, [programmes]);

  useEffect(() => { chargerProgrammes(); }, [chargerProgrammes]);
  useEffect(() => { chargerStats(); }, [chargerStats]);

  // ─── Programme CRUD ─────────────────────────────────────────────────────

  const ouvrirCreationProgramme = () => {
    setEditingProgramId(null);
    setProgramForm(emptyProgramForm);
    setShowProgramModal(true);
  };

  const ouvrirEditionProgramme = (p: ProgrammeFidelite) => {
    setEditingProgramId(p.id);
    setProgramForm({
      nom: p.nom,
      description: p.description,
      points_par_achat: p.points_par_achat,
      valeur_point: p.valeur_point,
      actif: p.actif,
      niveaux: p.niveaux.length > 0 ? [...p.niveaux] : [{ nom: 'Bronze', points_min: 0, remise_pourcentage: 0 }],
    });
    setShowProgramModal(true);
  };

  const sauvegarderProgramme = async () => {
    if (!programForm.nom || !programForm.points_par_achat || !programForm.valeur_point) {
      toast.error('Veuillez remplir les champs obligatoires');
      return;
    }
    if (programForm.niveaux.length === 0) {
      toast.error('Ajoutez au moins un niveau');
      return;
    }
    setProgramSaving(true);
    try {
      const payload = {
        nom: programForm.nom,
        description: programForm.description,
        points_par_achat: programForm.points_par_achat,
        valeur_point: programForm.valeur_point,
        actif: programForm.actif,
        niveaux: programForm.niveaux,
      };
      const res = editingProgramId
        ? await apiFetch(`/fidelite/${editingProgramId}`, { method: 'PUT', body: JSON.stringify(payload) })
        : await apiFetch('/fidelite', { method: 'POST', body: JSON.stringify(payload) });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Erreur sauvegarde programme');
      }
      toast.success(editingProgramId ? 'Programme modifié' : 'Programme créé');
      setShowProgramModal(false);
      chargerProgrammes();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setProgramSaving(false);
    }
  };

  const supprimerProgramme = async (id: number) => {
    try {
      const res = await apiFetch(`/fidelite/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erreur suppression');
      toast.success('Programme supprimé');
      setShowDeleteConfirm(null);
      chargerProgrammes();
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  // ─── Niveaux form helpers ──────────────────────────────────────────────

  const ajouterNiveau = () => {
    setProgramForm(prev => ({
      ...prev,
      niveaux: [...prev.niveaux, { nom: '', points_min: 0, remise_pourcentage: 0 }],
    }));
  };

  const supprimerNiveau = (index: number) => {
    setProgramForm(prev => ({
      ...prev,
      niveaux: prev.niveaux.filter((_, i) => i !== index),
    }));
  };

  const modifierNiveau = (index: number, field: keyof NiveauFidelite, value: string | number) => {
    setProgramForm(prev => ({
      ...prev,
      niveaux: prev.niveaux.map((n, i) => (i === index ? { ...n, [field]: value } : n)),
    }));
  };

  // ─── Recompense CRUD ───────────────────────────────────────────────────

  const sauvegarderRecompense = async () => {
    if (!recompenseForm.programme_fidelite_id || !recompenseForm.nom) {
      toast.error('Veuillez remplir les champs obligatoires');
      return;
    }
    setRecompenseSaving(true);
    try {
      const res = await apiFetch('/fidelite/recompenses', {
        method: 'POST',
        body: JSON.stringify({
          programme_fidelite_id: Number(recompenseForm.programme_fidelite_id),
          nom: recompenseForm.nom,
          points_requis: recompenseForm.points_requis,
          type: recompenseForm.type,
          valeur: recompenseForm.valeur,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Erreur création récompense');
      }
      toast.success('Récompense créée');
      setShowRecompenseModal(false);
      setRecompenseForm(emptyRecompenseForm);
      chargerProgrammes();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setRecompenseSaving(false);
    }
  };

  // ─── Points Client ─────────────────────────────────────────────────────

  const rechercherPoints = async () => {
    if (!searchClientId.trim()) return;
    setSearchingPoints(true);
    setClientPointsData(null);
    try {
      const res = await apiFetch(`/fidelite/points-client?client_id=${searchClientId.trim()}`);
      if (res.ok) {
        const data = await res.json();
        setClientPointsData(data);
      } else {
        toast.error('Client non trouvé ou non inscrit');
      }
    } catch {
      toast.error('Erreur lors de la recherche');
    } finally {
      setSearchingPoints(false);
    }
  };

  const inscrireClient = async () => {
    if (!inscrireForm.programme_fidelite_id || !inscrireForm.client_id) {
      toast.error('Veuillez sélectionner un programme et un client');
      return;
    }
    setInscrireSaving(true);
    try {
      const res = await apiFetch('/fidelite/inscrire-client', {
        method: 'POST',
        body: JSON.stringify({
          programme_fidelite_id: Number(inscrireForm.programme_fidelite_id),
          client_id: Number(inscrireForm.client_id),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Erreur inscription');
      }
      toast.success('Client inscrit au programme');
      setShowInscrireModal(false);
      setInscrireForm(emptyInscrireForm);
      chargerProgrammes();
      chargerStats();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setInscrireSaving(false);
    }
  };

  const reclamerRecompense = async () => {
    if (!reclamerForm.recompense_fidelite_id || !reclamerForm.client_id) {
      toast.error('Veuillez sélectionner une récompense et un client');
      return;
    }
    setReclamerSaving(true);
    try {
      const res = await apiFetch('/fidelite/reclamer-recompense', {
        method: 'POST',
        body: JSON.stringify({
          recompense_fidelite_id: Number(reclamerForm.recompense_fidelite_id),
          client_id: Number(reclamerForm.client_id),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Erreur réclamation');
      }
      toast.success('Récompense réclamée avec succès');
      setShowReclamerModal(false);
      setReclamerForm(emptyReclamerForm);
      chargerProgrammes();
      chargerStats();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setReclamerSaving(false);
    }
  };

  // ─── All recompenses across programmes ─────────────────────────────────

  const allRecompenses = programmes.flatMap(p =>
    (p.recompenses ?? []).map(r => ({ ...r, programme_nom: p.nom, programme_fidelite_id: p.id }))
  );

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center">
              <Award className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Fidélité</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Programmes de fidélité, récompenses et points clients
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
              onClick={ouvrirCreationProgramme}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouveau Programme
            </Button>
          </div>
        </div>
      </header>

      <main className="p-6 space-y-6">
        {/* Stats */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Clients Inscrits</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.total_clients}</p>
                </div>
                <div className="w-12 h-12 bg-yellow-500/10 rounded-2xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-yellow-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Points Distribués</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.total_points_distribues.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center">
                  <Star className="w-6 h-6 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Récompenses Réclamées</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.total_recompenses}</p>
                </div>
                <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center">
                  <Gift className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
            <TabsTrigger value="programmes" className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Programmes ({programmes.length})
            </TabsTrigger>
            <TabsTrigger value="recompenses" className="flex items-center gap-2">
              <Gift className="w-4 h-4" />
              Récompenses ({allRecompenses.length})
            </TabsTrigger>
            <TabsTrigger value="points" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Points Clients
            </TabsTrigger>
          </TabsList>

          {/* ── Tab: Programmes ──────────────────────────────────────────── */}
          <TabsContent value="programmes" className="space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : programmes.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="Aucun programme de fidélité"
                description="Créez votre premier programme pour récompenser vos clients fidèles"
                actionLabel="Créer un programme"
                onAction={ouvrirCreationProgramme}
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {programmes.map((prog, idx) => (
                  <motion.div
                    key={prog.id}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg">{prog.nom}</CardTitle>
                              <Badge variant={prog.actif ? 'default' : 'secondary'}>
                                {prog.actif ? 'Actif' : 'Inactif'}
                              </Badge>
                            </div>
                            {prog.description && (
                              <CardDescription className="mt-1 line-clamp-2">{prog.description}</CardDescription>
                            )}
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => ouvrirEditionProgramme(prog)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => setShowDeleteConfirm(prog.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center gap-2 text-sm">
                            <Star className="w-4 h-4 text-yellow-500" />
                            <span className="text-slate-600 dark:text-slate-400">
                              <span className="font-semibold text-slate-900 dark:text-white">{prog.points_par_achat}</span> pts/achat
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <TrendingUp className="w-4 h-4 text-green-500" />
                            <span className="text-slate-600 dark:text-slate-400">
                              1 pt = <span className="font-semibold text-slate-900 dark:text-white">{prog.valeur_point}</span> FCFA
                            </span>
                          </div>
                        </div>

                        {prog.niveaux.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Niveaux</p>
                            <div className="space-y-1.5">
                              {prog.niveaux.map((niv, i) => (
                                <div
                                  key={i}
                                  className="flex items-center justify-between text-sm p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50"
                                >
                                  <span className="font-medium text-slate-900 dark:text-white">{niv.nom}</span>
                                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                    <span>Min: {niv.points_min} pts</span>
                                    <Badge variant="outline" className="text-xs">
                                      -{niv.remise_pourcentage}%
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {prog.recompenses && prog.recompenses.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                              Récompenses ({prog.recompenses.length})
                            </p>
                            <div className="space-y-1.5">
                              {prog.recompenses.map((rec) => (
                                <div
                                  key={rec.id}
                                  className="flex items-center justify-between text-sm p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50"
                                >
                                  <div className="flex items-center gap-2">
                                    <Gift className="w-3.5 h-3.5 text-green-500" />
                                    <span className="font-medium text-slate-900 dark:text-white">{rec.nom}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge className={`text-xs ${RECOMPENSE_TYPE_COLORS[rec.type] ?? ''}`}>
                                      {RECOMPENSE_TYPE_LABELS[rec.type] ?? rec.type}
                                    </Badge>
                                    <span className="text-xs text-slate-500">{rec.points_requis} pts</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Tab: Récompenses ────────────────────────────────────────── */}
          <TabsContent value="recompenses" className="space-y-6">
            <div className="flex justify-end">
              <Button
                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
                onClick={() => {
                  setRecompenseForm(emptyRecompenseForm);
                  setShowRecompenseModal(true);
                }}
                disabled={programmes.length === 0}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle Récompense
              </Button>
            </div>

            {programmes.length === 0 ? (
              <EmptyState
                icon={Gift}
                title="Aucun programme disponible"
                description="Créez un programme de fidélité avant d'ajouter des récompenses"
              />
            ) : allRecompenses.length === 0 ? (
              <EmptyState
                icon={Gift}
                title="Aucune récompense"
                description="Ajoutez des récompenses à vos programmes pour inciter vos clients"
                actionLabel="Créer une récompense"
                onAction={() => {
                  setRecompenseForm(emptyRecompenseForm);
                  setShowRecompenseModal(true);
                }}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allRecompenses.map((rec, idx) => (
                  <motion.div
                    key={`${rec.programme_fidelite_id}-${rec.id}`}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:shadow-md transition-shadow">
                      <CardContent className="p-5 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                              <Gift className="w-4.5 h-4.5 text-white" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">{rec.nom}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{rec.programme_nom}</p>
                            </div>
                          </div>
                          <Badge className={`text-xs ${RECOMPENSE_TYPE_COLORS[rec.type] ?? ''}`}>
                            {RECOMPENSE_TYPE_LABELS[rec.type] ?? rec.type}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Points requis</span>
                          <span className="font-bold text-slate-900 dark:text-white">{rec.points_requis.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Valeur</span>
                          <span className="font-bold text-green-600 dark:text-green-400">{rec.valeur.toLocaleString()} {rec.type === 'remise' ? '%' : 'FCFA'}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Tab: Points Clients ──────────────────────────────────────── */}
          <TabsContent value="points" className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Rechercher par ID client..."
                  value={searchClientId}
                  onChange={(e) => setSearchClientId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && rechercherPoints()}
                  className="pl-10"
                />
              </div>
              <Button
                onClick={rechercherPoints}
                disabled={searchingPoints || !searchClientId.trim()}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
              >
                {searchingPoints ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                Rechercher
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowInscrireModal(true)}
              >
                <Users className="w-4 h-4 mr-2" />
                Inscrire Client
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowReclamerModal(true)}
                disabled={allRecompenses.length === 0}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Réclamer Récompense
              </Button>
            </div>

            {clientPointsData ? (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="space-y-6"
              >
                {/* Client Info + Points */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Client</p>
                          <p className="text-xl font-bold text-slate-900 dark:text-white">
                            {clientPointsData.client?.nom ?? 'N/A'}
                          </p>
                          <p className="text-sm text-slate-500">{clientPointsData.client?.email}</p>
                        </div>
                        <Users className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Points Disponibles</p>
                          <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                            {clientPointsData.points?.toLocaleString() ?? 0}
                          </p>
                        </div>
                        <div className="w-12 h-12 bg-yellow-500/10 rounded-2xl flex items-center justify-center">
                          <Star className="w-6 h-6 text-yellow-500" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Programme</p>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">
                            {clientPointsData.programme_fidelite?.nom ?? 'Non inscrit'}
                          </p>
                        </div>
                        <Trophy className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Transactions */}
                <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
                  <CardHeader>
                    <CardTitle>Historique des Transactions</CardTitle>
                    <CardDescription>
                      {clientPointsData.transactions?.length ?? 0} transaction(s)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!clientPointsData.transactions || clientPointsData.transactions.length === 0 ? (
                      <EmptyState
                        icon={CreditCard}
                        title="Aucune transaction"
                        description="Ce client n'a pas encore de mouvement de points"
                        compact
                      />
                    ) : (
                      <div className="space-y-3">
                        {clientPointsData.transactions.map((tx) => (
                          <div
                            key={tx.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600/50"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${
                                tx.points > 0 ? 'bg-green-500' : 'bg-red-500'
                              }`} />
                              <div>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">
                                  {tx.description || (TRANSACTION_TYPE_LABELS[tx.type] ?? tx.type)}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {new Date(tx.created_at).toLocaleDateString('fr-FR', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={`text-xs ${TRANSACTION_TYPE_COLORS[tx.type] ?? ''}`}>
                                {TRANSACTION_TYPE_LABELS[tx.type] ?? tx.type}
                              </Badge>
                              <span className={`font-bold text-sm ${tx.points > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {tx.points > 0 ? '+' : ''}{tx.points}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ) : !searchingPoints ? (
              <EmptyState
                icon={Search}
                title="Recherchez un client"
                description="Entrez l'ID d'un client pour voir ses points et l'historique de ses transactions"
              />
            ) : null}
          </TabsContent>
        </Tabs>
      </main>

      {/* ── Modal: Créer / Modifier Programme ────────────────────────────── */}
      {showProgramModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowProgramModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-200/50 dark:border-slate-700/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingProgramId ? 'Modifier le programme' : 'Nouveau Programme'}
                  </h2>
                  <p className="text-sm text-slate-500">Configurez votre programme de fidélité</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowProgramModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)] space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom du programme *</Label>
                  <Input
                    placeholder="Ex: Programme Or"
                    value={programForm.nom}
                    onChange={(e) => setProgramForm(prev => ({ ...prev, nom: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Statut
                    <button
                      type="button"
                      onClick={() => setProgramForm(prev => ({ ...prev, actif: !prev.actif }))}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        programForm.actif ? 'bg-yellow-500' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        programForm.actif ? 'translate-x-4.5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Décrivez les avantages de ce programme..."
                  value={programForm.description}
                  onChange={(e) => setProgramForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Points par achat *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={programForm.points_par_achat}
                    onChange={(e) => setProgramForm(prev => ({ ...prev, points_par_achat: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valeur du point (FCFA) *</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={programForm.valeur_point}
                    onChange={(e) => setProgramForm(prev => ({ ...prev, valeur_point: Number(e.target.value) }))}
                  />
                </div>
              </div>

              {/* Niveaux */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Niveaux de fidélité *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={ajouterNiveau}>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Ajouter un niveau
                  </Button>
                </div>
                <div className="space-y-3">
                  {programForm.niveaux.map((niv, idx) => (
                    <div key={idx} className="flex items-end gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600/50">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Nom</Label>
                        <Input
                          placeholder="Bronze"
                          value={niv.nom}
                          onChange={(e) => modifierNiveau(idx, 'nom', e.target.value)}
                        />
                      </div>
                      <div className="w-28 space-y-1">
                        <Label className="text-xs">Points min</Label>
                        <Input
                          type="number"
                          min={0}
                          value={niv.points_min}
                          onChange={(e) => modifierNiveau(idx, 'points_min', Number(e.target.value))}
                        />
                      </div>
                      <div className="w-28 space-y-1">
                        <Label className="text-xs">Remise %</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={niv.remise_pourcentage}
                          onChange={(e) => modifierNiveau(idx, 'remise_pourcentage', Number(e.target.value))}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-red-500 hover:text-red-600 shrink-0"
                        onClick={() => supprimerNiveau(idx)}
                        disabled={programForm.niveaux.length <= 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-slate-200/50 dark:border-slate-700/50">
              <Button variant="outline" onClick={() => setShowProgramModal(false)} disabled={programSaving}>
                Annuler
              </Button>
              <Button
                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
                onClick={sauvegarderProgramme}
                disabled={programSaving || !programForm.nom}
              >
                {programSaving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enregistrement...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" /> {editingProgramId ? 'Enregistrer' : 'Créer'}</>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Modal: Supprimer Programme ───────────────────────────────────── */}
      {showDeleteConfirm !== null && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowDeleteConfirm(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Confirmer la suppression</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Ce programme et toutes ses données seront supprimés.
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(null)}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => supprimerProgramme(showDeleteConfirm)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Modal: Créer Récompense ─────────────────────────────────────── */}
      {showRecompenseModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowRecompenseModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-200/50 dark:border-slate-700/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                  <Gift className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Nouvelle Récompense</h2>
                  <p className="text-sm text-slate-500">Ajoutez une récompense à un programme</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowRecompenseModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <Label>Programme *</Label>
                <select
                  value={recompenseForm.programme_fidelite_id}
                  onChange={(e) => setRecompenseForm(prev => ({ ...prev, programme_fidelite_id: e.target.value }))}
                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-slate-700/50 text-sm"
                >
                  <option value="">Sélectionner un programme</option>
                  {programmes.map(p => (
                    <option key={p.id} value={p.id}>{p.nom}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Nom de la récompense *</Label>
                <Input
                  placeholder="Ex: Remise 10%"
                  value={recompenseForm.nom}
                  onChange={(e) => setRecompenseForm(prev => ({ ...prev, nom: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Points requis</Label>
                  <Input
                    type="number"
                    min={0}
                    value={recompenseForm.points_requis}
                    onChange={(e) => setRecompenseForm(prev => ({ ...prev, points_requis: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <select
                    value={recompenseForm.type}
                    onChange={(e) => setRecompenseForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-slate-700/50 text-sm"
                  >
                    <option value="remise">Remise</option>
                    <option value="produit">Produit</option>
                    <option value="service">Service</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Valeur</Label>
                  <Input
                    type="number"
                    min={0}
                    value={recompenseForm.valeur}
                    onChange={(e) => setRecompenseForm(prev => ({ ...prev, valeur: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-slate-200/50 dark:border-slate-700/50">
              <Button variant="outline" onClick={() => setShowRecompenseModal(false)} disabled={recompenseSaving}>
                Annuler
              </Button>
              <Button
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                onClick={sauvegarderRecompense}
                disabled={recompenseSaving || !recompenseForm.nom || !recompenseForm.programme_fidelite_id}
              >
                {recompenseSaving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Création...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" /> Créer</>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Modal: Inscrire Client ───────────────────────────────────────── */}
      {showInscrireModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowInscrireModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Inscrire un client</h2>
                  <p className="text-sm text-slate-500">Ajoutez un client à un programme</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowInscrireModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Programme de fidélité *</Label>
                <select
                  value={inscrireForm.programme_fidelite_id}
                  onChange={(e) => setInscrireForm(prev => ({ ...prev, programme_fidelite_id: e.target.value }))}
                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-slate-700/50 text-sm"
                >
                  <option value="">Sélectionner un programme</option>
                  {programmes.filter(p => p.actif).map(p => (
                    <option key={p.id} value={p.id}>{p.nom}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>ID Client *</Label>
                <Input
                  type="number"
                  placeholder="1"
                  value={inscrireForm.client_id}
                  onChange={(e) => setInscrireForm(prev => ({ ...prev, client_id: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-6">
              <Button variant="outline" onClick={() => setShowInscrireModal(false)} disabled={inscrireSaving}>
                Annuler
              </Button>
              <Button
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                onClick={inscrireClient}
                disabled={inscrireSaving || !inscrireForm.programme_fidelite_id || !inscrireForm.client_id}
              >
                {inscrireSaving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Inscription...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4 mr-2" /> Inscrire</>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Modal: Réclamer Récompense ───────────────────────────────────── */}
      {showReclamerModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowReclamerModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Réclamer une récompense</h2>
                  <p className="text-sm text-slate-500">Échangez les points d&apos;un client</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowReclamerModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Récompense *</Label>
                <select
                  value={reclamerForm.recompense_fidelite_id}
                  onChange={(e) => setReclamerForm(prev => ({ ...prev, recompense_fidelite_id: e.target.value }))}
                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-slate-700/50 text-sm"
                >
                  <option value="">Sélectionner une récompense</option>
                  {allRecompenses.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.nom} — {r.points_requis} pts ({r.programme_nom})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>ID Client *</Label>
                <Input
                  type="number"
                  placeholder="1"
                  value={reclamerForm.client_id}
                  onChange={(e) => setReclamerForm(prev => ({ ...prev, client_id: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-6">
              <Button variant="outline" onClick={() => setShowReclamerModal(false)} disabled={reclamerSaving}>
                Annuler
              </Button>
              <Button
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                onClick={reclamerRecompense}
                disabled={reclamerSaving || !reclamerForm.recompense_fidelite_id || !reclamerForm.client_id}
              >
                {reclamerSaving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Traitement...</>
                ) : (
                  <><Gift className="w-4 h-4 mr-2" /> Réclamer</>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
