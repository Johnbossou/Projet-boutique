'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Zap,
  Target,
  BarChart3,
  RefreshCw,
  Sparkles,
  Clock,
  Calculator,
  PieChart,
  ShieldAlert,
  TrendingDown,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';

// Types mis à jour pour correspondre à votre nouveau contrôleur
interface Prediction {
  produit_id: number;
  produit_nom: string;
  categorie: string;
  couleur_categorie: string;
  stock_actuel: number;
  seuil_alerte: number;
  est_perissable: boolean;
  ventes_30_jours: number;
  demande_predite_semaine: number;
  recommandation: string;
  confiance_prediction: number;
  besoin_calcule: number;
  niveau_urgence: 'critical' | 'high' | 'medium' | 'low' | 'none';
  statut_stock: string;
  mode_calcul?: string;
}

interface RecommandationPromo {
  produit: {
    id: number;
    nom: string;
    prix: number;
    quantite_stock: number;
    categorie: string;
    couleur_categorie: string;
    est_perissable: boolean;
    statut_stock: string;
  };
  ventes_30_jours: number;
  ratio_stock_ventes: number;
  score_promotion: number;
  prix_suggere: number;
  reduction_suggeree: string;
  duree_suggeree: string;
  impact_estime: {
    ventes_attendues: number;
    augmentation_ventes: string;
    stock_apres_promo: number;
  };
  mode_calcul?: string;
}

interface Metrics {
  precision_globale: number;
  precision_stock_alerte: number;
  precision_demandes: number;
  taux_confiance: number;
  nombre_echantillons: number;
  total_ventes_historique?: number;
  dernier_calcul: string;
  mode?: string;
}

interface ImpactBusiness {
  reduction_ruptures: number;
  optimisation_stock: number;
  augmentation_ca: number;
  gain_temps: number;
  produits_alerte_actuels: number;
  produits_rupture_actuels: number;
}

interface PerformanceData {
  precision: Metrics;
  impact_business: ImpactBusiness;
  historique: any[];
  statut_modele: {
    statut: string;
    libelle?: string;
    dernier_entrainement: any;
    dernier_recalcul?: any;
    prochaine_mise_a_jour: string | null;
  };
  donnees_temps_reel: {
    total_produits: number;
    produits_alerte: number;
    produits_rupture: number;
    ventes_du_jour: number;
    chiffre_affaires_jour: number;
    mise_a_jour: string;
  };
}

export default function IAPage() {
  const { user } = useAuth();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [recommandations, setRecommandations] = useState<RecommandationPromo[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTraining, setIsTraining] = useState(false);
  const [activeTab, setActiveTab] = useState('predictions');

  // 🧠 CHARGEMENT DES DONNÉES IA
  useEffect(() => {
    chargerDonneesIA();
  }, []);

  const chargerDonneesIA = async () => {
    try {
      setIsLoading(true);

      const [predictionsResponse, promosResponse, metricsResponse] = await Promise.all([
        apiFetch('/ia/predictions-demande'),
        apiFetch('/ia/recommandations-promotions'),
        apiFetch('/ia/metrics-performance'),
      ]);

      if (predictionsResponse.ok) {
        const predictionsData = await predictionsResponse.json();
        setPredictions(predictionsData.predictions || []);
      }

      if (promosResponse.ok) {
        const promosData = await promosResponse.json();
        setRecommandations(promosData.recommandations ?? promosData ?? []);
      }

      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setPerformanceData(metricsData);
      }

    } catch (error) {
      console.error('Erreur chargement IA:', error);
      toast.error('Erreur lors du chargement des analyses');
    } finally {
      setIsLoading(false);
    }
  };

  const recalculerAnalyses = async () => {
    try {
      setIsTraining(true);
      toast.info('Recalcul des analyses en cours...');

      const response = await apiFetch('/ia/recalculer-analyses', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message || 'Analyses recalculées avec succès');
        await chargerDonneesIA();
      } else {
        throw new Error('Erreur lors du recalcul');
      }
    } catch (error) {
      console.error('Erreur recalcul:', error);
      toast.error('Erreur lors du recalcul des analyses');
    } finally {
      setIsTraining(false);
    }
  };

  // 🎨 COMPOSANT CARTE PRÉDICTION AMÉLIORÉ
  const CartePrediction = ({ prediction, index }: { prediction: Prediction; index: number }) => {
    const getCouleurUrgence = (niveau: string) => {
      switch (niveau) {
        case 'critical': return 'from-red-500 to-orange-500';
        case 'high': return 'from-orange-500 to-yellow-500';
        case 'medium': return 'from-yellow-500 to-amber-500';
        case 'low': return 'from-green-500 to-emerald-500';
        default: return 'from-gray-500 to-slate-500';
      }
    };

    const getIconeUrgence = (niveau: string) => {
      switch (niveau) {
        case 'critical': return <ShieldAlert className="w-4 h-4" />;
        case 'high': return <AlertTriangle className="w-4 h-4" />;
        case 'medium': return <TrendingDown className="w-4 h-4" />;
        default: return <TrendingUp className="w-4 h-4" />;
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        whileHover={{ scale: 1.02 }}
      >
        <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: prediction.couleur_categorie }}
                  />
                  <Badge 
                    variant="secondary" 
                    className="text-xs"
                    style={{ 
                      backgroundColor: `${prediction.couleur_categorie}20`,
                      borderColor: prediction.couleur_categorie,
                      color: prediction.couleur_categorie
                    }}
                  >
                    {prediction.categorie}
                  </Badge>
                  {prediction.est_perissable && (
                    <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 text-xs">
                      Périssable
                    </Badge>
                  )}
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white text-lg mb-1">
                  {prediction.produit_nom}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {prediction.recommandation}
                </p>
              </div>
              <div className={`w-10 h-10 bg-gradient-to-br ${getCouleurUrgence(prediction.niveau_urgence)} rounded-xl flex items-center justify-center text-white text-sm font-bold`}>
                {getIconeUrgence(prediction.niveau_urgence)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div className="space-y-1">
                <span className="text-slate-500">Stock actuel</span>
                <div className="font-semibold text-slate-900 dark:text-white">
                  {prediction.stock_actuel} unités
                </div>
                <div className="text-xs text-slate-400">
                  Seuil: {prediction.seuil_alerte}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500">Demande prédite</span>
                <div className="font-semibold text-blue-600">
                  {prediction.demande_predite_semaine} unités
                </div>
                <div className="text-xs text-slate-400">
                  Confiance: {(prediction.confiance_prediction * 100).toFixed(0)}%
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500">Ventes 30j</span>
                <div className="font-semibold text-slate-900 dark:text-white">
                  {prediction.ventes_30_jours} unités
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500">Besoin</span>
                <div className={`font-semibold ${
                  prediction.besoin_calcule > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {prediction.besoin_calcule > 0 ? `+${prediction.besoin_calcule}` : prediction.besoin_calcule} unités
                </div>
              </div>
            </div>

            {/* Barre de statut */}
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (prediction.stock_actuel / prediction.demande_predite_semaine) * 100)}%` }}
                transition={{ duration: 1, delay: index * 0.2 }}
                className={`h-2 rounded-full ${
                  prediction.niveau_urgence === 'critical' ? 'bg-red-500' :
                  prediction.niveau_urgence === 'high' ? 'bg-orange-500' :
                  prediction.niveau_urgence === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                }`}
              />
            </div>

            {prediction.besoin_calcule > 0 && (
              <div className={`p-3 rounded-lg border ${
                prediction.niveau_urgence === 'critical' ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' :
                prediction.niveau_urgence === 'high' ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800' :
                'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
              }`}>
                <div className="flex items-center space-x-2">
                  <AlertTriangle className={`w-4 h-4 ${
                    prediction.niveau_urgence === 'critical' ? 'text-red-600' :
                    prediction.niveau_urgence === 'high' ? 'text-orange-600' : 'text-yellow-600'
                  }`} />
                  <span className={`text-sm font-medium ${
                    prediction.niveau_urgence === 'critical' ? 'text-red-700 dark:text-red-300' :
                    prediction.niveau_urgence === 'high' ? 'text-orange-700 dark:text-orange-300' : 'text-yellow-700 dark:text-yellow-300'
                  }`}>
                    {prediction.niveau_urgence === 'critical' ? 'URGENT' : 'Recommandé' } : Commander {prediction.besoin_calcule} unités
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  // 🎨 COMPOSANT RECOMMANDATION PROMO AMÉLIORÉ
  const CarteRecommandation = ({ reco, index }: { reco: RecommandationPromo; index: number }) => {
    const getCouleurScore = (score: number) => {
      if (score >= 80) return 'from-red-500 to-pink-500';
      if (score >= 60) return 'from-orange-500 to-red-500';
      if (score >= 40) return 'from-yellow-500 to-orange-500';
      return 'from-green-500 to-emerald-500';
    };

    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.1 }}
        whileHover={{ scale: 1.02 }}
      >
        <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: reco.produit.couleur_categorie }}
                  />
                  <Badge 
                    variant="secondary" 
                    className="text-xs"
                    style={{ 
                      backgroundColor: `${reco.produit.couleur_categorie}20`,
                      borderColor: reco.produit.couleur_categorie,
                      color: reco.produit.couleur_categorie
                    }}
                  >
                    {reco.produit.categorie}
                  </Badge>
                  {reco.produit.est_perissable && (
                    <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 text-xs">
                      Périssable
                    </Badge>
                  )}
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white text-lg mb-1">
                  {reco.produit.nom}
                </h3>
                <div className="flex items-center space-x-2 mb-2">
                  <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 text-xs">
                    Stock: {reco.produit.quantite_stock}
                  </Badge>
                  <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 text-xs">
                    Ventes 30j: {reco.ventes_30_jours}
                  </Badge>
                </div>
              </div>
              <div className={`w-12 h-12 bg-gradient-to-br ${getCouleurScore(reco.score_promotion)} rounded-xl flex items-center justify-center text-white text-xs font-bold`}>
                {reco.score_promotion}%
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 mb-1">
                  <span>Score promotion</span>
                  <span>{reco.score_promotion}/100</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${reco.score_promotion}%` }}
                    transition={{ duration: 1, delay: index * 0.2 }}
                    className={`h-2 rounded-full bg-gradient-to-r ${getCouleurScore(reco.score_promotion)}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-slate-500">Prix actuel</span>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {reco.produit.prix.toLocaleString()} FCFA
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500">Prix suggéré</span>
                  <div className="font-semibold text-green-600">
                    {reco.prix_suggere.toLocaleString()} FCFA
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-slate-500">Réduction</span>
                  <div className="font-semibold text-red-600">
                    {reco.reduction_suggeree}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500">Durée</span>
                  <div className="font-semibold text-blue-600 flex items-center">
                    <Calendar className="w-3 h-3 mr-1" />
                    {reco.duree_suggeree}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center space-x-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                    Impact estimé
                  </span>
                </div>
                <div className="text-xs text-green-600 dark:text-green-400 space-y-1">
                  <div>📈 {reco.impact_estime.augmentation_ventes} ventes attendues</div>
                  <div>📦 Stock après promo: {reco.impact_estime.stock_apres_promo} unités</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  if (!user) {
    return <div>Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 dark:from-slate-900 dark:to-purple-900/20">
      {/* Header IA */}
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  Assistant stock & promos
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Basé sur vos ventes des 7, 30 et 90 derniers jours
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              onClick={recalculerAnalyses}
              disabled={isTraining}
              className="border-purple-300 text-purple-600 hover:bg-purple-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isTraining ? 'animate-spin' : ''}`} />
              {isTraining ? 'Recalcul...' : 'Recalculer les analyses'}
            </Button>
            
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
              <Sparkles className="w-3 h-3 mr-1" />
              {performanceData?.statut_modele?.libelle ?? 'Analyses actives'}
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 space-y-6">
        {/* KPI Cards IA Dynamiques */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Indice stock
                    </p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {performanceData ? `${(performanceData.precision.precision_globale * 100).toFixed(1)}%` : '—'}
                    </p>
                    <p className="text-xs text-green-500 font-medium mt-1">
                      Assistant statistique
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center">
                    <Target className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Produits Analysés
                    </p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {predictions.length}
                    </p>
                    <p className="text-xs text-blue-500 font-medium mt-1">
                      {performanceData?.donnees_temps_reel?.total_produits || 0} au total
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center">
                    <PieChart className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Alertes Prédites
                    </p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {predictions.filter(p => p.besoin_calcule > 0).length}
                    </p>
                    <p className="text-xs text-orange-500 font-medium mt-1">
                      {performanceData?.donnees_temps_reel?.produits_alerte || 0} en alerte réelle
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Recommandations
                    </p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {recommandations.length}
                    </p>
                    <p className="text-xs text-purple-500 font-medium mt-1">
                      Opportunités détectées
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
                    <Lightbulb className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Tabs IA */}
        <Tabs defaultValue="predictions" className="space-y-6" onValueChange={setActiveTab}>
          <TabsList className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50">
            <TabsTrigger value="predictions" className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4" />
              <span>Prédictions Stock</span>
            </TabsTrigger>
            <TabsTrigger value="promotions" className="flex items-center space-x-2">
              <Zap className="w-4 h-4" />
              <span>Recommandations Promos</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>Indicateurs</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab Prédictions */}
          <TabsContent value="predictions" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Prédictions de Demande
                </h2>
                <p className="text-slate-600 dark:text-slate-400">
                  Estimation des besoins en stock (ventes récentes, pas un modèle ML)
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">
                  <Clock className="w-3 h-3 mr-1" />
                  Mis à jour à l'instant
                </Badge>
                {predictions[0]?.mode_calcul && (
                  <Badge variant="outline" className="bg-purple-50 text-purple-600 border-purple-200">
                    {predictions[0].mode_calcul}
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <Card key={index} className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 animate-pulse">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="space-y-2">
                              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-12"></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : predictions.length > 0 ? (
                predictions.slice(0, 9).map((prediction, index) => (
                  <CartePrediction 
                    key={prediction.produit_id} 
                    prediction={prediction} 
                    index={index}
                  />
                ))
              ) : (
                <div className="col-span-3 text-center py-12">
                  <Brain className="w-16 h-16 mx-auto mb-4 text-slate-400" />
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    Aucune donnée de prédiction
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-4">
                    L'IA a besoin de données pour générer des prédictions
                  </p>
                  <Button onClick={chargerDonneesIA}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Actualiser les données
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab Recommandations Promos */}
          <TabsContent value="promotions" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Recommandations de Promotions
                </h2>
                <p className="text-slate-600 dark:text-slate-400">
                  Opportunités intelligentes pour booster les ventes et optimiser les stocks
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
                  <Lightbulb className="w-3 h-3 mr-1" />
                  {recommandations.length} opportunités
                </Badge>
                {recommandations[0]?.mode_calcul && (
                  <Badge variant="outline" className="bg-purple-50 text-purple-600 border-purple-200">
                    {recommandations[0].mode_calcul}
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <Card key={index} className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 animate-pulse">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                        </div>
                        <div className="space-y-2">
                          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : recommandations.length > 0 ? (
                recommandations.map((recommandation, index) => (
                  <CarteRecommandation 
                    key={recommandation.produit.id} 
                    reco={recommandation} 
                    index={index}
                  />
                ))
              ) : (
                <div className="col-span-3 text-center py-12">
                  <Zap className="w-16 h-16 mx-auto mb-4 text-slate-400" />
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    Aucune recommandation de promotion
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    L'IA analysera les opportunités lorsque plus de données seront disponibles
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab Analytics IA */}
          <TabsContent value="analytics" className="space-y-6">
            <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-purple-500" />
                  <span>Performance du Modèle IA</span>
                </CardTitle>
                <CardDescription>
                  Métriques détaillées et analyse des prédictions en temps réel
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      Précision des Prédictions
                    </h3>
                    
                    {performanceData ? [
                      { label: 'Précision Globale', value: performanceData.precision.precision_globale * 100, color: 'bg-green-500' },
                      { label: 'Précision Stock Alerte', value: performanceData.precision.precision_stock_alerte * 100, color: 'bg-blue-500' },
                      { label: 'Précision Demandes', value: performanceData.precision.precision_demandes * 100, color: 'bg-purple-500' },
                      { label: 'Taux de Confiance', value: performanceData.precision.taux_confiance * 100, color: 'bg-orange-500' },
                    ].map((metric, index) => (
                      <div key={metric.label} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">{metric.label}</span>
                          <span className="font-medium">{metric.value.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${metric.value}%` }}
                            transition={{ duration: 1, delay: index * 0.1 }}
                            className={`h-2 rounded-full ${metric.color} shadow-lg`}
                          />
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2"></div>
                        <p className="text-slate-500">Chargement des métriques...</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-6">
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      Impact Business
                    </h3>
                    
                    {performanceData ? [
                      { label: 'Réduction Ruptures', value: `${performanceData.impact_business.reduction_ruptures}%`, description: `${performanceData.impact_business.produits_rupture_actuels} ruptures actuelles` },
                      { label: 'Optimisation Stocks', value: `${performanceData.impact_business.optimisation_stock}%`, description: `${performanceData.impact_business.produits_alerte_actuels} alertes actuelles` },
                      { label: 'Augmentation CA', value: `${performanceData.impact_business.augmentation_ca}%`, description: 'Grâce aux promotions ciblées' },
                      { label: 'Gain de Temps', value: `${performanceData.impact_business.gain_temps}%`, description: 'Automatisation des décisions' },
                    ].map((impact, index) => (
                      <motion.div
                        key={impact.label}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center justify-between p-4 bg-white/50 dark:bg-slate-700/50 rounded-xl border border-slate-200/50 dark:border-slate-600/50"
                      >
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">
                            {impact.label}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {impact.description}
                          </p>
                        </div>
                        <div className="text-2xl font-bold text-green-600">
                          {impact.value}
                        </div>
                      </motion.div>
                    )) : (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2"></div>
                        <p className="text-slate-500">Chargement des impacts...</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Statut du modèle */}
                {performanceData && (
                  <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Statut des analyses</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-slate-500">Statut:</span>
                        <Badge className="ml-2 bg-green-100 text-green-800">
                          {performanceData.statut_modele?.libelle ?? 'Analyses à jour'}
                        </Badge>
                      </div>
                      <div>
                        <span className="text-slate-500">Dernier recalcul:</span>
                        <span className="ml-2 text-slate-900 dark:text-white">
                          {performanceData.statut_modele?.dernier_recalcul?.date
                            ? new Date(performanceData.statut_modele.dernier_recalcul.date).toLocaleDateString()
                            : performanceData.statut_modele?.dernier_entrainement?.date
                            ? new Date(performanceData.statut_modele.dernier_entrainement.date).toLocaleDateString()
                            : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Prochaine mise à jour:</span>
                        <span className="ml-2 text-slate-900 dark:text-white">
                          {performanceData.statut_modele.prochaine_mise_a_jour 
                            ? new Date(performanceData.statut_modele.prochaine_mise_a_jour).toLocaleDateString()
                            : 'Non planifiée'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}