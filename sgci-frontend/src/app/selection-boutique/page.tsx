'use client';

import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { 
  Store, 
  ChevronRight, 
  MapPin, 
  Phone, 
  Users, 
  Package,
  ShoppingCart,
  Plus,
  Search,
  DollarSign,
  Clock,
  Star,
  Grid3x3,
  List,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Boutique {
  id: number;
  nom: string;
  adresse?: string | null;
  telephone?: string | null;
  email?: string | null;
  devise?: string;
  taux_tva?: number;
  created_at: string;
  proprietaire_id: number;
  derniere_activite?: string | null;
  chiffre_affaires_mois?: number;
  performance?: 'excellente' | 'bonne' | 'moyenne' | 'faible';
  est_favorite?: boolean;
  _count?: {
    users: number;
    produits: number;
    ventes: number;
  };
}

export default function SelectionBoutiquePage() {
  const { user, switchBoutique } = useAuth();
  const router = useRouter();
  const [boutiques, setBoutiques] = useState<Boutique[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'nom' | 'ventes' | 'ca' | 'date'>('nom');
  const [filterPerformance, setFilterPerformance] = useState<string>('all');

  const filteredAndSortedBoutiques = useMemo(() => {
    let filtered = boutiques;

    // Filtrer par recherche
    if (searchTerm) {
      filtered = filtered.filter(b =>
        b.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.adresse?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtrer par performance
    if (filterPerformance !== 'all') {
      filtered = filtered.filter(b => b.performance === filterPerformance);
    }

    // Trier
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'nom':
          return a.nom.localeCompare(b.nom);
        case 'ventes':
          return (b._count?.ventes || 0) - (a._count?.ventes || 0);
        case 'ca':
          return (b.chiffre_affaires_mois || 0) - (a.chiffre_affaires_mois || 0);
        case 'date':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return 0;
      }
    });

    // Mettre les favorites en premier
    return sorted.sort((a, b) => {
      if (a.est_favorite && !b.est_favorite) return -1;
      if (!a.est_favorite && b.est_favorite) return 1;
      return 0;
    });
  }, [boutiques, searchTerm, sortBy, filterPerformance]);

  const fetchBoutiques = async () => {
    try {
      setIsLoading(true);
      // Le endpoint /boutiques est réservé aux propriétaires (possession).
      // Pour les membres (gérant/caissier), on utilise la liste des boutiques
      // déjà chargée via /me (user.boutiques).
      let data: Boutique[] = user?.boutiques as Boutique[];

      if (user?.role === 'proprietaire') {
        const response = await apiFetch('/boutiques');
        if (!response.ok) throw new Error('Erreur lors du chargement des boutiques');
        const res = await response.json();
        data = res.data || res;
      }

      setBoutiques(data || []);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement des boutiques');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectBoutique = async (boutiqueId: number) => {
    try {
      setIsSwitching(true);
      
      // Si c'est déjà la boutique courante, rediriger directement
      if (user?.current_boutique_id === boutiqueId) {
        router.push('/dashboard');
        return;
      }

      // Sinon, switcher vers la boutique
      await switchBoutique(boutiqueId);
      toast.success('Boutique sélectionnée avec succès');
      router.push('/dashboard');
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la sélection de la boutique');
    } finally {
      setIsSwitching(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchBoutiques();
    }
  }, [user]);

  // Redirection si non connecté ou moins de 2 boutiques
  const hasMultipleBoutiques = (user?.boutiques?.length ?? 0) > 1;
  if (!user || !hasMultipleBoutiques) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Store className="w-16 h-16 mx-auto mb-4 text-slate-400" />
            <h2 className="text-xl font-bold mb-2">Accès non autorisé</h2>
            <p className="text-slate-600 dark:text-slate-400">
              Vous devez avoir accès à plusieurs boutiques pour utiliser cette page.
            </p>
            <Link href="/dashboard" className="mt-4 inline-block">
              <Button>Retour au dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <main className="container mx-auto p-8 max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-8"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <Store className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
            Sélectionnez votre boutique
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Choisissez la boutique sur laquelle vous souhaitez travailler
          </p>
        </motion.div>

        {/* Barre de recherche et filtres */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-slate-200/50 dark:border-slate-700/50"
        >
          <div className="flex flex-col md:flex-row gap-4">
            {/* Recherche */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                placeholder="Rechercher une boutique..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12"
              />
            </div>

            {/* Filtre performance */}
            <select
              value={filterPerformance}
              onChange={(e) => setFilterPerformance(e.target.value)}
              className="h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="all">Toutes les performances</option>
              <option value="excellente">Excellente</option>
              <option value="bonne">Bonne</option>
              <option value="moyenne">Moyenne</option>
              <option value="faible">Faible</option>
            </select>

            {/* Tri */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'nom' | 'ventes' | 'ca' | 'date')}
              className="h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="nom">Trier par nom</option>
              <option value="ventes">Trier par ventes</option>
              <option value="ca">Trier par CA</option>
              <option value="date">Trier par date</option>
            </select>

            {/* Vue */}
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('grid')}
              >
                <Grid3x3 className="w-5 h-5" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('list')}
              >
                <List className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Résultats */}
          <div className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            {filteredAndSortedBoutiques.length} boutique(s) trouvée(s)
          </div>
        </motion.div>

        {/* Stats globales */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
        >
          <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Total Boutiques
                  </p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                    {boutiques.length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center">
                  <Store className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Total Équipe
                  </p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                    {boutiques.reduce((sum, b) => sum + (b._count?.users || 0), 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Total Produits
                  </p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                    {boutiques.reduce((sum, b) => sum + (b._count?.produits || 0), 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center">
                  <Package className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Boutiques Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-4" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-2" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredAndSortedBoutiques.length > 0 ? (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}
          >
            {filteredAndSortedBoutiques.map((boutique, index) => (
              <motion.div
                key={boutique.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 + index * 0.05 }}
              >
                <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:shadow-xl transition-all duration-300 group cursor-pointer"
                  onClick={() => handleSelectBoutique(boutique.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{boutique.nom}</CardTitle>
                          {boutique.est_favorite && (
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          )}
                        </div>
                        {boutique.adresse && (
                          <CardDescription className="flex items-center text-xs mt-1">
                            <MapPin className="w-3 h-3 mr-1" />
                            {boutique.adresse}
                          </CardDescription>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {boutique.performance && (
                          <Badge 
                            variant={
                              boutique.performance === 'excellente' ? 'default' :
                              boutique.performance === 'bonne' ? 'secondary' :
                              boutique.performance === 'moyenne' ? 'outline' : 'destructive'
                            }
                            className={
                              boutique.performance === 'excellente' ? 'bg-green-500' :
                              boutique.performance === 'bonne' ? 'bg-blue-500' :
                              boutique.performance === 'moyenne' ? 'bg-orange-500' : 'bg-red-500'
                            }
                          >
                            {boutique.performance}
                          </Badge>
                        )}
                        <Badge variant={boutique.id === user.current_boutique_id ? "default" : "secondary"}>
                          {boutique.id === user.current_boutique_id ? "Actuelle" : "Autre"}
                        </Badge>
                        {user.boutiques?.find(b => b.id === boutique.id)?.role_dans_boutique && (
                          <Badge variant="outline" className="capitalize">
                            {user.boutiques.find(b => b.id === boutique.id)!.role_dans_boutique}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Stats avancées */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
                        <Users className="w-4 h-4" />
                        <span>{boutique._count?.users || 0} membres</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
                        <Package className="w-4 h-4" />
                        <span>{boutique._count?.produits || 0} produits</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
                        <ShoppingCart className="w-4 h-4" />
                        <span>{boutique._count?.ventes || 0} ventes</span>
                      </div>
                      {boutique.chiffre_affaires_mois && (
                        <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
                          <DollarSign className="w-4 h-4" />
                          <span>{(boutique.chiffre_affaires_mois / 1000).toFixed(0)}K FCFA</span>
                        </div>
                      )}
                      {boutique.derniere_activite && (
                        <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400 col-span-2">
                          <Clock className="w-4 h-4" />
                          <span>Dernière activité: {new Date(boutique.derniere_activite).toLocaleDateString()}</span>
                        </div>
                      )}
                      {boutique.telephone && (
                        <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400 col-span-2">
                          <Phone className="w-4 h-4" />
                          <span>{boutique.telephone}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <Button 
                      className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                      disabled={isSwitching}
                    >
                      {isSwitching ? (
                        <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Chargement...</span>
                      ) : (
                        <span className="flex items-center justify-center space-x-2">
                          {boutique.id === user.current_boutique_id ? (
                            <>
                              <span>Accéder</span>
                              <ChevronRight className="w-4 h-4" />
                            </>
                          ) : (
                            <>
                              <span>Sélectionner</span>
                              <ChevronRight className="w-4 h-4" />
                            </>
                          )}
                        </span>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-center py-16"
          >
            <Store className="w-24 h-24 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              Aucune boutique trouvée
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {searchTerm || filterPerformance !== 'all' ? 'Essayez de modifier vos critères de recherche' : 'Commencez par créer votre première boutique'}
            </p>
            {(!searchTerm && filterPerformance === 'all' && user?.role === 'proprietaire') && (
              <Link href="/boutiques">
                <Button className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Créer ma première boutique
                </Button>
              </Link>
            )}
          </motion.div>
        )}

        {/* Footer Actions */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-12 flex justify-center space-x-4"
        >
          {user?.role === 'proprietaire' && (
            <Link href="/boutiques">
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter une boutique
              </Button>
            </Link>
          )}
          <Link href="/dashboard">
            <Button variant="outline">
              Retour au dashboard
            </Button>
          </Link>
        </motion.div>
      </main>
    </div>
  );
}
