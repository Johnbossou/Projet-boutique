'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Mail,
  Phone,
  MapPin,
  Calendar,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Edit,
  Trash2,
  Crown,
  Zap,
  X,
  Save,
  AlertTriangle,
  Download,
  ArrowDown,
  ArrowUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';

// Types pour les données clients
interface Vente {
  id: number;
  numero_commande: string;
  date_commande: string;
  montant_total: number;
  statut: 'en_attente' | 'confirmee' | 'expediee' | 'livree' | 'annulee';
  produits_count: number;
  created_at: string;
}

interface Client {
  id: number;
  nom: string;
  email: string;
  telephone: string;
  adresse?: string;
  ville?: string;
  created_at: string;
  total_achats: number;
  nombre_commandes: number;
  derniere_commande?: {
    id: number;
    numero_commande: string;
    date: string;
    montant: number;
    statut: string;
  };
  statut: 'actif' | 'inactif' | 'vip';
  notes?: string;
  ventes?: Vente[];
}

interface StatistiquesClients {
  total_clients: number;
  clients_actifs: number;
  clients_vip: number;
  clients_inactifs: number;
  chiffre_affaires_total: number;
  commandes_total: number;
  panier_moyen: number;
  chiffre_affaires_mensuel?: number;
  nouveaux_clients_mois?: number;
  taux_conversion_vip?: number;
}

// Interface pour le formulaire
interface ClientFormData {
  nom: string;
  email: string;
  telephone: string;
  adresse: string;
  ville: string;
  statut: 'actif' | 'inactif' | 'vip';
  notes: string;
}

// Hook personnalisé pour le debouncing
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export default function ClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [commandesClient, setCommandesClient] = useState<Vente[]>([]);
  const [clientSelectionne, setClientSelectionne] = useState<Client | null>(null);
  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState<'tous' | 'actif' | 'inactif' | 'vip'>('tous');
  const [sortField, setSortField] = useState<'nom' | 'email' | 'telephone' | 'statut' | 'nombre_commandes' | 'total_achats' | 'created_at'>('nom');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isLoading, setIsLoading] = useState(true);
  const [loadingCommandes, setLoadingCommandes] = useState(false);
  const [showModalClient, setShowModalClient] = useState(false);
  const [modeEdition, setModeEdition] = useState(false);
  const [showConfirmationSuppression, setShowConfirmationSuppression] = useState(false);
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);
  
  // État pour la pagination
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0
  });

  // 🎯 ÉTATS POUR LES FORMULAIRES
  const [formData, setFormData] = useState<ClientFormData>({
    nom: '',
    email: '',
    telephone: '',
    adresse: '',
    ville: '',
    statut: 'actif',
    notes: ''
  });

  const [statsClients, setStatsClients] = useState<StatistiquesClients>({
    total_clients: 0,
    clients_actifs: 0,
    clients_vip: 0,
    clients_inactifs: 0,
    chiffre_affaires_total: 0,
    commandes_total: 0,
    panier_moyen: 0
  });

  // Debouncing pour la recherche
  const rechercheDebouncee = useDebounce(recherche, 300);

  // 🎯 CHARGEMENT DES DONNÉES
  useEffect(() => {
    chargerClients();
    chargerStatistiques();
  }, []);

  // Chargement avec filtres et tri
  useEffect(() => {
    chargerClientsAvecFiltres();
  }, [rechercheDebouncee, filtreStatut, sortField, sortDirection]);

  const changerTri = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortField(field);
    setSortDirection('asc');
  };

  // 🚀 CHARGE LES CLIENTS AVEC FILTRES
  const chargerClientsAvecFiltres = async (page = 1) => {
    try {
      setIsLoading(true);

      const params = new URLSearchParams();
      if (rechercheDebouncee) params.append('search', rechercheDebouncee);
      if (filtreStatut !== 'tous') params.append('statut', filtreStatut);
      params.append('page', page.toString());
      params.append('sort_field', sortField);
      params.append('sort_direction', sortDirection);
      
      const response = await apiFetch(`/clients?${params}`, {
        headers: { 'Accept': 'application/json' },
      });
      
      if (!response.ok) throw new Error(`Erreur API: ${response.status}`);
      
      const data = await response.json();
      
      // ✅ CORRECTION : Laravel paginate renvoie { data: [], meta: {} }
      const clientsData = data.data || [];
      
      const clientsTransformes: Client[] = clientsData.map((client: any) => ({
        id: client.id,
        nom: client.nom,
        email: client.email,
        telephone: client.telephone || 'Non renseigné',
        adresse: client.adresse || '',
        ville: client.ville || '',
        created_at: client.created_at,
        total_achats: parseFloat(client.total_achats) || 0,
        nombre_commandes: client.nombre_commandes || 0,
        derniere_commande: client.derniere_commande,
        statut: client.statut,
        notes: client.notes || ''
      }));
      
      setClients(clientsTransformes);
      setPagination({
        current_page: data.meta?.current_page || page,
        last_page: data.meta?.last_page || 1,
        per_page: data.meta?.per_page || 20,
        total: data.meta?.total ?? clientsTransformes.length
      });
      
    } catch (error) {
      console.error('Erreur chargement clients:', error);
      toast.error('Erreur lors du chargement des clients');
    } finally {
      setIsLoading(false);
    }
  };

  // 🚀 CHARGE LES CLIENTS (sans filtres pour l'initialisation)
  const chargerClients = async () => {
    await chargerClientsAvecFiltres(1);
  };

  // 🚀 CHARGE LES STATISTIQUES
  const chargerStatistiques = async () => {
    try {
      const response = await apiFetch('/clients/statistiques/globales', {
        headers: { 'Accept': 'application/json' },
      });
      
      if (response.ok) {
        const stats = await response.json();
        setStatsClients(stats);
      }
    } catch (error) {
      console.error('Erreur chargement statistiques:', error);
    }
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // 🚀 CHARGE LES DÉTAILS D'UN CLIENT AVEC COMMANDES
  const chargerDetailsClient = async (clientId: number) => {
    try {
      setLoadingCommandes(true);

      const response = await apiFetch(`/clients/${clientId}`, {
        headers: { 'Accept': 'application/json' },
      });
      
      if (!response.ok) throw new Error('Erreur chargement détails client');

      const clientDetail = await response.json();
      
      // Met à jour le client avec les ventes
      const clientAvecVentes: Client = {
        ...clientDetail,
        ventes: clientDetail.ventes || []
      };
      
      setClientSelectionne(clientAvecVentes);
      setCommandesClient(clientDetail.ventes || []);
      
    } catch (error) {
      console.error('Erreur chargement détails client:', error);
      toast.error('Erreur lors du chargement des détails du client');
    } finally {
      setLoadingCommandes(false);
    }
  };

  // 🎯 RÉINITIALISER LE FORMULAIRE
  const reinitialiserFormulaire = () => {
    setFormData({
      nom: '',
      email: '',
      telephone: '',
      adresse: '',
      ville: '',
      statut: 'actif',
      notes: ''
    });
  };

  // 🎯 OUVRIR MODAL CRÉATION
  const ouvrirModalCreation = () => {
    setClientSelectionne(null);
    setModeEdition(true);
    reinitialiserFormulaire();
    setShowModalClient(true);
  };

  // 🎯 OUVRIR MODAL ÉDITION
  const ouvrirModalEdition = (client: Client) => {
    setClientSelectionne(client);
    setModeEdition(true);
    setFormData({
      nom: client.nom,
      email: client.email,
      telephone: client.telephone || '',
      adresse: client.adresse || '',
      ville: client.ville || '',
      statut: client.statut,
      notes: client.notes || ''
    });
    setShowModalClient(true);
  };

  // 🎯 OUVRIR MODAL VISUALISATION
  const ouvrirModalVisualisation = async (client: Client) => {
    setClientSelectionne(client);
    setModeEdition(false);
    setShowModalClient(true);
    
    // Charge les détails du client avec ses commandes
    await chargerDetailsClient(client.id);
  };

  // 🎯 GESTION DES CHAMPS DU FORMULAIRE
  const handleInputChange = (field: keyof ClientFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 🎯 CRÉATION D'UN NOUVEAU CLIENT
  const creerClient = async () => {
    try {
      setActionEnCours('creation');

      const response = await apiFetch('/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur création client');
      }
      
      const result = await response.json();
      const nouveauClient = result.client || result;
      
      // Met à jour la liste
      setClients(prev => [...prev, nouveauClient]);
      
      // Recharge les statistiques
      chargerStatistiques();
      
      // Ferme le modal
      setShowModalClient(false);
      reinitialiserFormulaire();
      
      toast.success('Client créé avec succès');
      
    } catch (error: any) {
      console.error('Erreur création client:', error);
      toast.error(error.message || 'Erreur lors de la création du client');
    } finally {
      setActionEnCours(null);
    }
  };

  // 🎯 MISE À JOUR D'UN CLIENT
  const mettreAJourClient = async () => {
    if (!clientSelectionne) return;
    
    try {
      setActionEnCours('modification');

      const response = await apiFetch(`/clients/${clientSelectionne.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur modification client');
      }
      
      const result = await response.json();
      const clientModifie = result.client || result;
      
      // Met à jour la liste
      setClients(prev => prev.map(client => 
        client.id === clientSelectionne.id ? clientModifie : client
      ));
      
      // Met à jour le client sélectionné
      setClientSelectionne(clientModifie);
      
      // Passe en mode visualisation
      setModeEdition(false);
      
      toast.success('Client modifié avec succès');
      
    } catch (error: any) {
      console.error('Erreur modification client:', error);
      toast.error(error.message || 'Erreur lors de la modification du client');
    } finally {
      setActionEnCours(null);
    }
  };

  // 🎯 SUPPRESSION D'UN CLIENT
  const supprimerClient = async () => {
    if (!clientSelectionne) return;
    
    try {
      setActionEnCours('suppression');

      const response = await apiFetch(`/clients/${clientSelectionne.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur suppression client');
      }
      
      // Met à jour la liste
      setClients(prev => prev.filter(client => client.id !== clientSelectionne.id));
      
      // Ferme les modals
      setShowModalClient(false);
      setShowConfirmationSuppression(false);
      setClientSelectionne(null);
      
      // Recharge les statistiques
      chargerStatistiques();
      
      toast.success('Client supprimé avec succès');
      
    } catch (error: any) {
      console.error('Erreur suppression client:', error);
      toast.error(error.message || 'Erreur lors de la suppression du client');
    } finally {
      setActionEnCours(null);
    }
  };

  // 🎯 PROMOUVOIR UN CLIENT VIP
  const promouvoirVip = async (client: Client) => {
    try {
      setActionEnCours(`promotion-${client.id}`);

      const response = await apiFetch(`/clients/${client.id}/promouvoir-vip`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur promotion VIP');
      }
      
      const result = await response.json();
      const clientPromu = result.client || client;
      
      // Met à jour la liste
      setClients(prev => prev.map(c => 
        c.id === client.id ? { ...c, statut: 'vip' } : c
      ));
      
      // Met à jour le client sélectionné si c'est le même
      if (clientSelectionne && clientSelectionne.id === client.id) {
        setClientSelectionne({ ...clientSelectionne, statut: 'vip' });
      }
      
      toast.success('Client promu VIP avec succès');
      
    } catch (error: any) {
      console.error('Erreur promotion VIP:', error);
      toast.error(error.message || 'Erreur lors de la promotion du client');
    } finally {
      setActionEnCours(null);
    }
  };

  // 🎯 RÉTROGRADER UN CLIENT VIP
  const retrograderVip = async (client: Client) => {
    try {
      setActionEnCours(`retrogradation-${client.id}`);

      const response = await apiFetch(`/clients/${client.id}/retrograder-vip`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur rétrogradation VIP');
      }
      
      const result = await response.json();
      const clientRetrograde = result.client || client;
      
      // Met à jour la liste
      setClients(prev => prev.map(c => 
        c.id === client.id ? { ...c, statut: 'actif' } : c
      ));
      
      // Met à jour le client sélectionné si c'est le même
      if (clientSelectionne && clientSelectionne.id === client.id) {
        setClientSelectionne({ ...clientSelectionne, statut: 'actif' });
      }
      
      toast.success('Client rétrogradé avec succès');
      
    } catch (error: any) {
      console.error('Erreur rétrogradation VIP:', error);
      toast.error(error.message || 'Erreur lors de la rétrogradation du client');
    } finally {
      setActionEnCours(null);
    }
  };

  // 🎯 EXPORTER LES CLIENTS
  const exporterClients = async () => {
    try {
      setActionEnCours('export');

      const params = new URLSearchParams();
      if (recherche) params.append('search', recherche);
      if (filtreStatut !== 'tous') params.append('statut', filtreStatut);
      
      const response = await apiFetch(`/clients/export/data?${params}`, {
        headers: { 'Accept': 'application/json' },
      });
      
      if (!response.ok) throw new Error('Erreur export clients');
      
      const data = await response.json();
      
      // Créer un blob et télécharger le fichier
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || `clients-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`Export réalisé avec succès (${data.count || data.data?.length || 0} clients)`);
      
    } catch (error: any) {
      console.error('Erreur export clients:', error);
      toast.error('Erreur lors de l\'export des clients');
    } finally {
      setActionEnCours(null);
    }
  };

  // 🎯 COMPOSANT CARD CLIENT
  const ClientCard = ({ client, index }: { client: Client; index: number }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ scale: 1.02 }}
      className="cursor-pointer"
      onClick={() => ouvrirModalVisualisation(client)}
    >
      <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:shadow-xl transition-all duration-300 group">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                client.statut === 'vip' 
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500' 
                  : client.statut === 'actif'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                  : 'bg-gradient-to-r from-slate-500 to-gray-500'
              }`}>
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                    {client.nom}
                  </h3>
                  {client.statut === 'vip' && <Crown className="w-4 h-4 text-yellow-500" />}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">{client.email}</p>
              </div>
            </div>
            
            <Badge variant={
              client.statut === 'vip' ? 'default' :
              client.statut === 'actif' ? 'secondary' : 'outline'
            } className={
              client.statut === 'vip' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' :
              client.statut === 'actif' ? 'bg-green-500/10 text-green-600 border-green-500/20' :
              'bg-slate-500/10 text-slate-600 border-slate-500/20'
            }>
              {client.statut === 'vip' ? 'VIP' : client.statut}
            </Badge>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
              <Phone className="w-4 h-4" />
              <span>{client.telephone}</span>
            </div>
            {client.ville && (
              <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
                <MapPin className="w-4 h-4" />
                <span>{client.ville}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {client.nombre_commandes}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Commandes</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {client.total_achats >= 1000 
                  ? `${(client.total_achats / 1000).toFixed(0)}K` 
                  : client.total_achats.toLocaleString()
                }
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">FCFA</p>
            </div>
          </div>

          {client.derniere_commande && (
            <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mt-3">
              <Calendar className="w-3 h-3" />
              <span>Dernière commande: {new Date(client.derniere_commande.date).toLocaleDateString('fr-FR')}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );

  // 🎯 COMPOSANT CARD COMMANDE
  const CommandeCard = ({ commande }: { commande: Vente }) => (
    <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
      <div className="flex items-center space-x-3">
        <div className={`w-3 h-3 rounded-full ${
          commande.statut === 'livree' ? 'bg-green-500' :
          commande.statut === 'expediee' ? 'bg-blue-500' :
          commande.statut === 'confirmee' ? 'bg-yellow-500' :
          commande.statut === 'en_attente' ? 'bg-orange-500' :
          'bg-red-500'
        }`} />
        <div>
          <p className="font-medium">Commande #{commande.numero_commande}</p>
          <p className="text-sm text-slate-500">
            {new Date(commande.date_commande).toLocaleDateString('fr-FR')} • {commande.produits_count} produit(s)
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-bold text-lg">{commande.montant_total.toLocaleString()} FCFA</p>
        <Badge variant={
          commande.statut === 'livree' ? 'default' :
          commande.statut === 'expediee' ? 'secondary' : 'outline'
        } className={
          commande.statut === 'livree' ? 'bg-green-500/10 text-green-600 border-green-500/20' :
          commande.statut === 'expediee' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
          commande.statut === 'confirmee' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' :
          'bg-slate-500/10 text-slate-600 border-slate-500/20'
        }>
          {commande.statut}
        </Badge>
      </div>
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
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
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  Gestion Clients
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {pagination.total} clients • CRM avancé
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exporterClients}
              disabled={actionEnCours === 'export'}
            >
              {actionEnCours === 'export' ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-600 mr-2" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Exporter
            </Button>
            <Button 
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
              onClick={ouvrirModalCreation}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Nouveau Client
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Clients</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{statsClients.total_clients}</p>
                  <p className="text-sm text-green-500 flex items-center space-x-1">
                    <TrendingUp className="w-3 h-3" />
                    <span>+{statsClients.nouveaux_clients_mois || 0} ce mois</span>
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Clients Actifs</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{statsClients.clients_actifs}</p>
                  <p className="text-sm text-blue-500">
                    {statsClients.total_clients > 0 
                      ? Math.round((statsClients.clients_actifs / statsClients.total_clients) * 100)
                      : 0
                    }% du total
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center">
                  <Zap className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Clients VIP</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{statsClients.clients_vip}</p>
                  <p className="text-sm text-yellow-500">
                    {statsClients.taux_conversion_vip || 0}% de conversion
                  </p>
                </div>
                <div className="w-12 h-12 bg-yellow-500/10 rounded-2xl flex items-center justify-center">
                  <Crown className="w-6 h-6 text-yellow-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">CA Total</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {statsClients.chiffre_affaires_total >= 1000000 
                      ? `${(statsClients.chiffre_affaires_total / 1000000).toFixed(1)}M`
                      : `${(statsClients.chiffre_affaires_total / 1000).toFixed(0)}K`
                    }
                  </p>
                  <p className="text-sm text-green-500">FCFA</p>
                </div>
                <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Commandes</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{statsClients.commandes_total}</p>
                  <p className="text-sm text-blue-500">
                    Panier moyen: {Math.round(statsClients.panier_moyen).toLocaleString()} FCFA
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-orange-500" />
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
                    placeholder="Rechercher un client..."
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
                    onChange={(e) => setFiltreStatut(e.target.value as any)}
                    className="bg-white/50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="tous">Tous les statuts</option>
                    <option value="actif">Actifs</option>
                    <option value="inactif">Inactifs</option>
                    <option value="vip">VIP</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-2 text-sm text-slate-500">
                <span>{pagination.total} clients trouvés</span>
                <span>•</span>
                <span>Page {pagination.current_page} sur {pagination.last_page}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Liste Clients en Tableau */}
        <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
          <CardHeader>
            <CardTitle>Liste des clients</CardTitle>
            <CardDescription>
              Cliquez sur une ligne pour ouvrir le profil client et appliquer des actions VIP.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto overflow-y-auto max-h-[640px]">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-left"
                      onClick={() => changerTri('nom')}
                    >
                      Client
                      {sortField === 'nom' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )
                      ) : (
                        <ArrowUp className="w-3 h-3 opacity-0" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-left"
                      onClick={() => changerTri('email')}
                    >
                      Email
                      {sortField === 'email' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )
                      ) : (
                        <ArrowUp className="w-3 h-3 opacity-0" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-left"
                      onClick={() => changerTri('telephone')}
                    >
                      Téléphone
                      {sortField === 'telephone' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )
                      ) : (
                        <ArrowUp className="w-3 h-3 opacity-0" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-left"
                      onClick={() => changerTri('statut')}
                    >
                      Statut
                      {sortField === 'statut' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )
                      ) : (
                        <ArrowUp className="w-3 h-3 opacity-0" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-left"
                      onClick={() => changerTri('nombre_commandes')}
                    >
                      Commandes
                      {sortField === 'nombre_commandes' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )
                      ) : (
                        <ArrowUp className="w-3 h-3 opacity-0" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-left"
                      onClick={() => changerTri('total_achats')}
                    >
                      CA total
                      {sortField === 'total_achats' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )
                      ) : (
                        <ArrowUp className="w-3 h-3 opacity-0" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95">Dernière commande</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                      Chargement des clients...
                    </TableCell>
                  </TableRow>
                ) : clients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                      Aucun client ne correspond à vos critères de recherche.
                    </TableCell>
                  </TableRow>
                ) : (
                  clients.map((client) => (
                    <TableRow
                      key={client.id}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700"
                      onClick={() => ouvrirModalVisualisation(client)}
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900 dark:text-white">{client.nom}</span>
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            {client.ville || 'Ville non renseignée'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{client.email}</TableCell>
                      <TableCell>{client.telephone}</TableCell>
                      <TableCell>
                        <Badge variant={
                          client.statut === 'vip' ? 'default' : client.statut === 'actif' ? 'secondary' : 'outline'
                        } className={
                          client.statut === 'vip'
                            ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                            : client.statut === 'actif'
                            ? 'bg-green-500/10 text-green-600 border-green-500/20'
                            : 'bg-slate-500/10 text-slate-600 border-slate-500/20'
                        }>
                          {client.statut === 'vip' ? 'VIP' : client.statut}
                        </Badge>
                      </TableCell>
                      <TableCell>{client.nombre_commandes}</TableCell>
                      <TableCell>
                        {client.total_achats >= 1000
                          ? `${(client.total_achats / 1000).toFixed(0)}K FCFA`
                          : `${client.total_achats.toLocaleString()} FCFA`}
                      </TableCell>
                      <TableCell>
                        {client.derniere_commande
                          ? new Date(client.derniere_commande.date).toLocaleDateString('fr-FR')
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(event) => {
                              event.stopPropagation();
                              ouvrirModalVisualisation(client);
                            }}
                          >
                            Voir
                          </Button>
                          {client.statut === 'vip' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(event) => {
                                event.stopPropagation();
                                retrograderVip(client);
                              }}
                            >
                              Retrograder
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(event) => {
                                event.stopPropagation();
                                promouvoirVip(client);
                              }}
                            >
                              VIP
                            </Button>
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
              onClick={() => chargerClientsAvecFiltres(pagination.current_page - 1)}
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
              onClick={() => chargerClientsAvecFiltres(pagination.current_page + 1)}
              disabled={pagination.current_page === pagination.last_page}
            >
              Suivant
              <ArrowDown className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </main>

      {/* Modal Détail Client */}
      <AnimatePresence>
        {showModalClient && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !modeEdition && setShowModalClient(false)}
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
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    clientSelectionne?.statut === 'vip' 
                      ? 'bg-gradient-to-r from-yellow-500 to-orange-500' 
                      : 'bg-gradient-to-r from-blue-500 to-purple-500'
                  }`}>
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      {clientSelectionne ? clientSelectionne.nom : 'Nouveau Client'}
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400">
                      {clientSelectionne 
                        ? `Client ${clientSelectionne.statut === 'vip' ? 'VIP' : clientSelectionne.statut}`
                        : 'Création d\'un nouveau client'
                      }
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {clientSelectionne && !modeEdition && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => ouvrirModalEdition(clientSelectionne)}
                        disabled={actionEnCours !== null}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Modifier
                      </Button>
                      {clientSelectionne.statut === 'vip' ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => retrograderVip(clientSelectionne)}
                          disabled={actionEnCours === `retrogradation-${clientSelectionne.id}`}
                        >
                          <Crown className="w-4 h-4 mr-2" />
                          {actionEnCours === `retrogradation-${clientSelectionne.id}` ? 'Rétrogradation...' : 'Rétrograder'}
                        </Button>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => promouvoirVip(clientSelectionne)}
                          disabled={actionEnCours === `promotion-${clientSelectionne.id}`}
                        >
                          <Crown className="w-4 h-4 mr-2" />
                          {actionEnCours === `promotion-${clientSelectionne.id}` ? 'Promotion...' : 'Promouvoir VIP'}
                        </Button>
                      )}
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
                      setShowModalClient(false);
                      setModeEdition(false);
                      setClientSelectionne(null);
                      setCommandesClient([]);
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
                  // MODE ÉDITION/CRÉATION
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          {clientSelectionne ? 'Modifier le client' : 'Nouveau Client'}
                        </CardTitle>
                        <CardDescription>
                          {clientSelectionne 
                            ? 'Modifiez les informations du client'
                            : 'Remplissez les informations pour créer un nouveau client'
                          }
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium">Nom complet *</label>
                              <Input 
                                placeholder="Koffi Mensah" 
                                value={formData.nom}
                                onChange={(e) => handleInputChange('nom', e.target.value)}
                                disabled={actionEnCours !== null}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Email *</label>
                              <Input 
                                type="email" 
                                placeholder="koffi.mensah@email.com" 
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
                            <div>
                              <label className="text-sm font-medium">Ville</label>
                              <Input 
                                placeholder="Cotonou" 
                                value={formData.ville}
                                onChange={(e) => handleInputChange('ville', e.target.value)}
                                disabled={actionEnCours !== null}
                              />
                            </div>
                          </div>
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
                            <label className="text-sm font-medium">Statut</label>
                            <select 
                              value={formData.statut}
                              onChange={(e) => handleInputChange('statut', e.target.value as any)}
                              className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-slate-700/50"
                              disabled={actionEnCours !== null}
                            >
                              <option value="actif">Actif</option>
                              <option value="inactif">Inactif</option>
                              <option value="vip">VIP</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-sm font-medium">Notes</label>
                            <textarea 
                              className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-slate-700/50"
                              rows={3}
                              placeholder="Notes sur le client..."
                              value={formData.notes}
                              onChange={(e) => handleInputChange('notes', e.target.value)}
                              disabled={actionEnCours !== null}
                            />
                          </div>
                          <div className="flex space-x-3 pt-4">
                            <Button 
                              className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500"
                              onClick={clientSelectionne ? mettreAJourClient : creerClient}
                              disabled={actionEnCours !== null || !formData.nom || !formData.email}
                            >
                              {actionEnCours ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  {clientSelectionne ? 'Modification...' : 'Création...'}
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4 mr-2" />
                                  {clientSelectionne ? 'Enregistrer' : 'Créer le client'}
                                </>
                              )}
                            </Button>
                            <Button 
                              variant="outline"
                              onClick={() => {
                                if (clientSelectionne) {
                                  setModeEdition(false);
                                } else {
                                  setShowModalClient(false);
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
                ) : clientSelectionne ? (
                  // MODE VISUALISATION
                  <Tabs defaultValue="informations">
                    <TabsList className="w-full">
                      <TabsTrigger value="informations" className="flex-1">Informations</TabsTrigger>
                      <TabsTrigger value="commandes" className="flex-1">Commandes ({commandesClient.length})</TabsTrigger>
                      <TabsTrigger value="statistiques" className="flex-1">Statistiques</TabsTrigger>
                    </TabsList>

                    <TabsContent value="informations" className="space-y-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Informations de Contact</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center space-x-3">
                              <Mail className="w-5 h-5 text-slate-400" />
                              <div>
                                <p className="font-medium">Email</p>
                                <p className="text-slate-600 dark:text-slate-400">{clientSelectionne.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <Phone className="w-5 h-5 text-slate-400" />
                              <div>
                                <p className="font-medium">Téléphone</p>
                                <p className="text-slate-600 dark:text-slate-400">{clientSelectionne.telephone}</p>
                              </div>
                            </div>
                            {clientSelectionne.ville && (
                              <div className="flex items-center space-x-3">
                                <MapPin className="w-5 h-5 text-slate-400" />
                                <div>
                                  <p className="font-medium">Ville</p>
                                  <p className="text-slate-600 dark:text-slate-400">{clientSelectionne.ville}</p>
                                </div>
                              </div>
                            )}
                            <div className="flex items-center space-x-3">
                              <Calendar className="w-5 h-5 text-slate-400" />
                              <div>
                                <p className="font-medium">Date d'inscription</p>
                                <p className="text-slate-600 dark:text-slate-400">
                                  {new Date(clientSelectionne.created_at).toLocaleDateString('fr-FR')}
                                </p>
                              </div>
                            </div>
                          </div>
                          {clientSelectionne.adresse && (
                            <div className="flex items-start space-x-3 pt-4">
                              <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                              <div>
                                <p className="font-medium">Adresse</p>
                                <p className="text-slate-600 dark:text-slate-400">{clientSelectionne.adresse}</p>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {clientSelectionne.notes && (
                        <Card>
                          <CardHeader>
                            <CardTitle>Notes</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{clientSelectionne.notes}</p>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>

                    <TabsContent value="commandes">
                      <Card>
                        <CardHeader>
                          <CardTitle>Historique des Commandes</CardTitle>
                          <CardDescription>
                            {commandesClient.length} commande(s) trouvée(s)
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {loadingCommandes ? (
                            <div className="space-y-3">
                              {Array.from({ length: 3 }).map((_, index) => (
                                <div key={index} className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg animate-pulse">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-3 h-3 bg-slate-200 rounded-full" />
                                    <div className="space-y-2">
                                      <div className="h-4 bg-slate-200 rounded w-24"></div>
                                      <div className="h-3 bg-slate-200 rounded w-16"></div>
                                    </div>
                                  </div>
                                  <div className="space-y-2 text-right">
                                    <div className="h-4 bg-slate-200 rounded w-16 ml-auto"></div>
                                    <div className="h-6 bg-slate-200 rounded w-20"></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : commandesClient.length > 0 ? (
                            <div className="space-y-3">
                              {commandesClient.map((commande) => (
                                <CommandeCard key={commande.id} commande={commande} />
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-slate-500">
                              <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                              <p>Aucune commande trouvée pour ce client</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="statistiques">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <Card>
                          <CardContent className="p-6 text-center">
                            <DollarSign className="w-8 h-8 text-green-500 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                              {clientSelectionne.total_achats >= 1000 
                                ? `${(clientSelectionne.total_achats / 1000).toFixed(0)}K` 
                                : clientSelectionne.total_achats.toLocaleString()
                              }
                            </p>
                            <p className="text-slate-600 dark:text-slate-400">Chiffre d'Affaires</p>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardContent className="p-6 text-center">
                            <ShoppingCart className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                              {clientSelectionne.nombre_commandes}
                            </p>
                            <p className="text-slate-600 dark:text-slate-400">Commandes Total</p>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardContent className="p-6 text-center">
                            <TrendingUp className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                              {clientSelectionne.nombre_commandes > 0 
                                ? Math.round(clientSelectionne.total_achats / clientSelectionne.nombre_commandes).toLocaleString()
                                : '0'
                              }
                            </p>
                            <p className="text-slate-600 dark:text-slate-400">Panier Moyen</p>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardContent className="p-6 text-center">
                            <Calendar className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                              {commandesClient.length}
                            </p>
                            <p className="text-slate-600 dark:text-slate-400">Commandes Récentes</p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Dernières commandes */}
                      {commandesClient.length > 0 && (
                        <Card className="mt-6">
                          <CardHeader>
                            <CardTitle>10 Dernières Commandes</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {commandesClient.slice(0, 10).map((commande) => (
                                <div key={commande.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                                  <div>
                                    <p className="font-medium">#{commande.numero_commande}</p>
                                    <p className="text-sm text-slate-500">
                                      {new Date(commande.date_commande).toLocaleDateString('fr-FR')}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-bold">{commande.montant_total.toLocaleString()} FCFA</p>
                                    <Badge variant="outline" className={
                                      commande.statut === 'livree' ? 'bg-green-50 text-green-700 border-green-200' :
                                      commande.statut === 'expediee' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                      'bg-slate-50 text-slate-700 border-slate-200'
                                    }>
                                      {commande.statut}
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}
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
        {showConfirmationSuppression && clientSelectionne && (
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
                    Êtes-vous sûr de vouloir supprimer le client {clientSelectionne.nom} ?
                  </p>
                </div>
              </div>
              
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
                  onClick={supprimerClient}
                  className="flex-1"
                  disabled={actionEnCours !== null}
                >
                  {actionEnCours === 'suppression' ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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