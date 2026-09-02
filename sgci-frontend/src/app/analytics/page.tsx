'use client';

import { motion } from 'framer-motion';
import { useState, useEffect, useRef, useCallback, type ComponentType, type SVGProps, useMemo } from 'react';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import {
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon,
  Calendar,
  Download,
  Zap,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  AlertTriangle,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const COLORS = ['#6366f1', '#38bdf8', '#f472b6', '#34d399', '#f97316', '#a78bfa'];

// Types pour les données analytics
interface AnalyticsData {
  ventes: {
    total_ventes: number;
    chiffre_affaires_total: number;
    panier_moyen: number;
  };
  produits: {
    total_produits: number;
    total_stock: number;
    valeur_stock_total: number;
    produits_en_alerte: number;
    produits_en_rupture: number;
  };
  metadata?: {
    periode: string;
    date_debut: string;
    date_fin: string;
  };
}

interface VenteQuotidienne {
  date: string;
  nombre_ventes: number;
  chiffre_affaires: number;
}

interface ProduitPopulaire {
  produit_id: number;
  total_vendus: number;
  chiffre_affaires: number;
  produit: {
    nom: string;
    prix: number;
  };
}

interface CategorieRepartition {
  categorie_id: number;
  categorie: string;
  chiffre_affaires: number;
  total_vendus: number;
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const chartRef = useRef<HTMLDivElement>(null);
  
  // États pour les données
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsDataPrecedent, setAnalyticsDataPrecedent] = useState<AnalyticsData | null>(null);
  const [ventesQuotidiennes, setVentesQuotidiennes] = useState<VenteQuotidienne[]>([]);
  const [produitsPopulaires, setProduitsPopulaires] = useState<ProduitPopulaire[]>([]);
  const [repartitionCategories, setRepartitionCategories] = useState<CategorieRepartition[]>([]);
  
  const lineChartData = useMemo(
    () => ventesQuotidiennes.map((item) => ({
      ...item,
      label: new Date(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    })),
    [ventesQuotidiennes]
  );

  const pieData = useMemo(
    () => repartitionCategories.map((item) => ({
      name: item.categorie,
      value: Number(item.chiffre_affaires) || 0,
      id: item.categorie_id
    })),
    [repartitionCategories]
  );
  
  // États pour les filtres et contrôles
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [periode, setPeriode] = useState<'7j' | '30j' | '90j'>('30j');

  // Fonction pour obtenir la période précédente
  const getPeriodeAvant = (periode: string): string => {
    const map = { '7j': '14j', '30j': '60j', '90j': '180j' };
    return map[periode as keyof typeof map] || '30j';
  };

  // Fonction pour charger toutes les données analytics
  const chargerAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);

      const [
        statsResponse,
        statsPrecedentResponse,
        ventesResponse,
        populairesResponse,
        categoriesResponse
      ] = await Promise.all([
        apiFetch(`/analytics/stats-globales?periode=${periode}`, {
          headers: { 'Accept': 'application/json' }
        }),
        apiFetch(`/analytics/stats-globales?periode=${getPeriodeAvant(periode)}`, {
          headers: { 'Accept': 'application/json' }
        }).catch(() => Promise.resolve(null)),
        apiFetch(`/analytics/ventes-quotidiennes?periode=${periode}`, {
          headers: { 'Accept': 'application/json' }
        }),
        apiFetch(`/analytics/produits-populaires?periode=${periode}&limit=10`, {
          headers: { 'Accept': 'application/json' }
        }),
        apiFetch(`/analytics/repartition-categories?periode=${periode}`, {
          headers: { 'Accept': 'application/json' }
        })
      ]);

      if (!statsResponse.ok) throw new Error('Erreur stats globales');

      const statsData = await statsResponse.json();
      setAnalyticsData(statsData);

      if (statsPrecedentResponse?.ok) {
        const statsPrecedent = await statsPrecedentResponse.json();
        setAnalyticsDataPrecedent(statsPrecedent);
      }

      if (ventesResponse.ok) {
        const ventesData = await ventesResponse.json();
        setVentesQuotidiennes(Array.isArray(ventesData) ? ventesData : (ventesData.data || []));
      }

      if (populairesResponse.ok) {
        const populairesData = await populairesResponse.json();
        setProduitsPopulaires(Array.isArray(populairesData) ? populairesData : (populairesData.data || []));
      }

      if (categoriesResponse.ok) {
        const categoriesData = await categoriesResponse.json();
        setRepartitionCategories(Array.isArray(categoriesData) ? categoriesData : (categoriesData.data || []));
      }

      toast.success(`Données ${periode} chargées`);
    } catch (error) {
      console.error('Erreur chargement analytics:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [periode]);

  useEffect(() => {
    chargerAnalytics();
  }, [chargerAnalytics]);

  // Calcule la tendance réelle entre deux périodes
  const calculerTendance = (valeurActuelle: number, valeurPrecedente: number | undefined): { pct: number; isPositive: boolean; label: string } => {
    if (!valeurPrecedente || valeurPrecedente === 0) {
      return { pct: 0, isPositive: true, label: 'N/A' };
    }
    const pct = ((valeurActuelle - valeurPrecedente) / valeurPrecedente) * 100;
    return {
      pct: Math.abs(pct),
      isPositive: pct >= 0,
      label: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
    };
  };

  // Gère le rafraîchissement
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await chargerAnalytics();
  };

  // Export PDF
  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      if (!chartRef.current) return;

      const canvas = await html2canvas(chartRef.current, {
        scale: 2,
        backgroundColor: '#ffffff'
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`analytics-${periode}-${new Date().toISOString().split('T')[0]}.pdf`);

      toast.success('PDF exporté avec succès');
    } catch (error) {
      console.error('Erreur export PDF:', error);
      toast.error('Erreur lors de l\'export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJson = async () => {
    try {
      setIsExporting(true);
      const response = await apiFetch(`/analytics/export?periode=${periode}`);
      if (!response.ok) throw new Error('Export API indisponible');
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `analytics-${periode}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      toast.success('Export JSON téléchargé');
    } catch (error) {
      console.error(error);
      toast.error('Export JSON impossible');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport = async () => {
    await handleExportPDF();
  };

  // Composant Metric Card amélioré
  const MetricCard = ({
    title,
    value,
    trend,
    icon: Icon,
    color,
    isPositive = true,
    delay = 0
  }: {
    title: string;
    value: string;
    trend: string;
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    color: string;
    isPositive?: boolean;
    delay?: number;
  }) => (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay }}
      whileHover={{ scale: 1.05, y: -5 }}
    >
      <Card className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border-slate-200 dark:border-slate-700 hover:shadow-xl transition-all">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                {title}
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                {isLoading ? (
                  <div className="h-8 bg-slate-300 dark:bg-slate-600 rounded w-24 animate-pulse" />
                ) : (
                  value
                )}
              </p>
              <div className={`text-xs font-semibold flex items-center space-x-1 ${
                isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {isPositive ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                <span>{trend}</span>
              </div>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color} bg-opacity-10`}>
              <Icon className={`w-6 h-6 ${color}`} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Chargement des données utilisateur...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-purple-900/20">
      {/* Header Analytics Impressionnant */}
      <motion.header 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 sticky top-0 z-50"
      >
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center space-x-4">
            <motion.div 
              className="flex items-center space-x-3"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Analytics Cinématiques
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center">
                  <Sparkles className="w-3 h-3 mr-1 text-purple-500" />
                  Données en temps réel avec visualisations avancées
                </p>
              </div>
            </motion.div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Indicateur de période active */}
            <motion.div 
              className="hidden sm:flex items-center space-x-2 bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Calendar className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {periode === '7j' ? '7 derniers jours' : 
                 periode === '30j' ? '30 derniers jours' : '90 derniers jours'}
              </span>
            </motion.div>

            {/* Filtres période */}
            <motion.div 
              className="flex items-center space-x-1 bg-white dark:bg-slate-700 rounded-lg p-1 shadow-lg border border-slate-200 dark:border-slate-600"
              whileHover={{ scale: 1.05 }}
            >
              {['7j', '30j', '90j'].map((p) => (
                <Button
                  key={p}
                  variant={periode === p ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setPeriode(p as '7j' | '30j' | '90j')}
                  className={`relative ${
                    periode === p 
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md" 
                      : "text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400"
                  } transition-all duration-300`}
                >
                  {p}
                  {periode === p && (
                    <motion.div
                      layoutId="activePeriod"
                      className="absolute inset-0 bg-white/20 rounded-md"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </Button>
              ))}
            </motion.div>

            {/* Boutons d'action */}
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="relative overflow-hidden"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>

              <Button 
                variant="default" 
                size="sm" 
                onClick={handleExport}
                disabled={isExporting}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg"
              >
                <Download className="w-4 h-4 mr-2" />
                {isExporting ? 'Export...' : 'PDF'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportJson}
                disabled={isExporting}
              >
                <Download className="w-4 h-4 mr-2" />
                JSON
              </Button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main ref={chartRef} className="p-6 space-y-8">
        {/* KPI Cards Grid Impressionnant */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <MetricCard
            title="Chiffre d'Affaires"
            value={analyticsData ? `${(analyticsData.ventes.chiffre_affaires_total / 1000).toFixed(0)}K FCFA` : '0 FCFA'}
            trend={calculerTendance(analyticsData?.ventes.chiffre_affaires_total || 0, analyticsDataPrecedent?.ventes.chiffre_affaires_total).label}
            icon={DollarSign}
            color="text-green-500"
            delay={0.1}
            isPositive={analyticsDataPrecedent ? (analyticsData?.ventes.chiffre_affaires_total || 0) >= (analyticsDataPrecedent?.ventes.chiffre_affaires_total || 0) : true}
          />
          
          <MetricCard
            title="Transactions"
            value={analyticsData ? analyticsData.ventes.total_ventes.toString() : '0'}
            trend={calculerTendance(analyticsData?.ventes.total_ventes || 0, analyticsDataPrecedent?.ventes.total_ventes).label}
            icon={ShoppingCart}
            color="text-blue-500"
            delay={0.2}
            isPositive={analyticsDataPrecedent ? (analyticsData?.ventes.total_ventes || 0) >= (analyticsDataPrecedent?.ventes.total_ventes || 0) : true}
          />
          
          <MetricCard
            title="Panier Moyen"
            value={analyticsData ? `${Math.round(analyticsData.ventes.panier_moyen).toLocaleString()} FCFA` : '0 FCFA'}
            trend={calculerTendance(analyticsData?.ventes.panier_moyen || 0, analyticsDataPrecedent?.ventes.panier_moyen).label}
            icon={Users}
            color="text-purple-500"
            delay={0.3}
            isPositive={analyticsDataPrecedent ? (analyticsData?.ventes.panier_moyen || 0) >= (analyticsDataPrecedent?.ventes.panier_moyen || 0) : true}
          />

          <MetricCard
            title="Produits en Alerte"
            value={analyticsData ? analyticsData.produits.produits_en_alerte.toString() : '0'}
            trend="Nécessite attention immédiate"
            icon={AlertTriangle}
            color="text-orange-500"
            delay={0.4}
            isPositive={false}
          />
        </motion.div>

        {/* Tabs pour différentes vues analytics */}
        <Tabs defaultValue="performance" className="space-y-8">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <TabsList className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 p-1 rounded-2xl">
              <TabsTrigger value="performance" className="flex items-center space-x-2 rounded-xl">
                <TrendingUp className="w-4 h-4" />
                <span>Performance</span>
              </TabsTrigger>
              <TabsTrigger value="produits" className="flex items-center space-x-2 rounded-xl">
                <Package className="w-4 h-4" />
                <span>Produits</span>
              </TabsTrigger>
              <TabsTrigger value="ventes" className="flex items-center space-x-2 rounded-xl">
                <BarChart3 className="w-4 h-4" />
                <span>Ventes Détaillées</span>
              </TabsTrigger>
            </TabsList>
          </motion.div>

          {/* Tab Performance */}
          <TabsContent value="performance" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Chart Ventes Quotidiennes avec Données Réelles */}
              <motion.div
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:shadow-xl transition-all duration-500">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center space-x-2">
                      <TrendingUp className="w-5 h-5 text-green-500" />
                      <span>Ventes Quotidiennes</span>
                      <Badge variant="secondary" className="ml-2 bg-green-500/10 text-green-600 dark:text-green-400">
                        {periode}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Évolution du chiffre d&apos;affaires sur la période sélectionnée
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      {isLoading ? (
                        <div className="h-full flex items-center justify-center">
                          <div className="text-center text-slate-500">
                            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                            <p>Chargement des données...</p>
                          </div>
                        </div>
                      ) : ventesQuotidiennes.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={lineChartData} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                            <XAxis
                              dataKey="date"
                              tickFormatter={(date) => new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                              stroke="#64748b"
                            />
                            <YAxis
                              tickFormatter={(value) => (typeof value === 'number' && value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value)}
                              stroke="#64748b"
                            />
                            <Tooltip
                              formatter={(value) => `${Number(value ?? 0).toLocaleString()} FCFA`}
                              labelFormatter={(label) => new Date(String(label ?? '')).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })}
                            />
                            <Line
                              type="monotone"
                              dataKey="chiffre_affaires"
                              name="Chiffre d&apos;Affaires"
                              stroke="#8b5cf6"
                              strokeWidth={3}
                              dot={{ r: 4, fill: '#8b5cf6' }}
                              activeDot={{ r: 6 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-slate-500">
                          <div className="text-center">
                            <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>Aucune donnée de vente pour cette période</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Chart Répartition Catégories avec Données Réelles */}
              <motion.div
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:shadow-xl transition-all duration-500">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center space-x-2">
                      <PieChartIcon className="w-5 h-5 text-blue-500" />
                      <span>Répartition par Catégorie</span>
                    </CardTitle>
                    <CardDescription>
                      Chiffre d&apos;affaires par catégorie de produits
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      {isLoading ? (
                        <div className="h-full flex items-center justify-center">
                          <div className="text-center text-slate-500">
                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                            <p>Chargement des données...</p>
                          </div>
                        </div>
                      ) : pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={48}
                              outerRadius={88}
                              paddingAngle={4}
                              stroke="transparent"
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${entry.id}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value) => `${Number(value ?? 0).toLocaleString()} FCFA`}
                              cursor={{ fill: 'rgba(59, 130, 246, 0.08)' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-slate-500">
                          <div className="text-center">
                            <PieChartIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>Aucune donnée de catégorie pour cette période</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </TabsContent>

          {/* Tab Produits */}
          <TabsContent value="produits" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Top Produits avec Données Réelles */}
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:shadow-xl transition-all duration-500">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Zap className="w-5 h-5 text-orange-500" />
                      <span>Top 5 Produits</span>
                      <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 dark:text-orange-400">
                        {periode}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Produits les plus vendus par quantité sur la période
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {isLoading ? (
                        Array.from({ length: 5 }).map((_, index) => (
                          <div key={index} className="flex items-center justify-between p-3 animate-pulse">
                            <div className="space-y-2 flex-1">
                              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                            </div>
                            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                          </div>
                        ))
                      ) : produitsPopulaires.length > 0 ? (
                        produitsPopulaires.map((item, index) => (
                          <motion.div
                            key={item.produit_id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-300 group border border-slate-200/50 dark:border-slate-600/50"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-lg">
                                #{index + 1}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-white group-hover:text-purple-600 transition-colors">
                                  {item.produit.nom}
                                </p>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                  {item.total_vendus} unités vendues
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-slate-900 dark:text-white text-lg">
                                {item.chiffre_affaires?.toLocaleString() || '0'} FCFA
                              </p>
                              <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                                {calculerTendance(item.total_vendus, index).label}
                              </p>
                            </div>
                          </motion.div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                          <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                          <p className="text-lg font-medium">Aucune donnée de vente</p>
                          <p className="text-sm">Les produits populaires apparaîtront après les premières ventes</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Métriques Produits */}
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:shadow-xl transition-all duration-500">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <BarChart3 className="w-5 h-5 text-green-500" />
                      <span>Métriques Stock</span>
                    </CardTitle>
                    <CardDescription>
                      Analyse complète de votre inventaire en temps réel
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {[
                        {
                          label: "Valeur Stock Total",
                          value: analyticsData ? `${(analyticsData.produits.valeur_stock_total / 1000).toFixed(0)}K FCFA` : '0 FCFA',
                          color: "text-blue-500",
                          icon: DollarSign,
                          description: "Valeur totale de l'inventaire"
                        },
                        {
                          label: "Total Produits",
                          value: analyticsData ? analyticsData.produits.total_produits.toString() : '0',
                          color: "text-green-500",
                          icon: Package,
                          description: "Nombre de références en stock"
                        },
                        {
                          label: "Stock Total",
                          value: analyticsData ? analyticsData.produits.total_stock.toString() : '0',
                          color: "text-purple-500",
                          icon: ShoppingCart,
                          description: "Quantité totale d'articles"
                        },
                        {
                          label: "Produits en Rupture",
                          value: analyticsData ? analyticsData.produits.produits_en_rupture.toString() : '0',
                          color: "text-red-500",
                          icon: AlertTriangle,
                          description: "Articles en rupture de stock"
                        }
                      ].map((metric, index) => (
                        <motion.div
                          key={metric.label}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center justify-between p-4 bg-white/50 dark:bg-slate-700/50 rounded-xl border border-slate-200/50 dark:border-slate-600/50 hover:bg-white dark:hover:bg-slate-700 transition-all duration-300 group"
                        >
                          <div className="flex items-center space-x-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                              metric.color.replace('text', 'bg').replace('-500', '-500/10')
                            } group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                              <metric.icon className={`w-6 h-6 ${metric.color}`} />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-slate-300">
                                {metric.label}
                              </p>
                              <p className="text-2xl font-bold dark:text-white bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                                {metric.value}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {metric.description}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </TabsContent>

          {/* Tab Ventes Détaillées */}
          <TabsContent value="ventes" className="space-y-6">
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:shadow-xl transition-all duration-500">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Calendar className="w-5 h-5 text-orange-500" />
                    <span>Historique des Ventes</span>
                    <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 dark:text-orange-400">
                      {ventesQuotidiennes.length} jours
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Détail quotidien des performances commerciales sur la période
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="flex items-center justify-between p-4 animate-pulse">
                          <div className="space-y-2 flex-1">
                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32"></div>
                            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                          </div>
                          <div className="space-y-2 text-right">
                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20 ml-auto"></div>
                            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-16 ml-auto"></div>
                          </div>
                        </div>
                      ))
                    ) : ventesQuotidiennes.length > 0 ? (
                      ventesQuotidiennes.map((vente, index) => (
                        <motion.div
                          key={vente.date}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-300 group border border-slate-200/50 dark:border-slate-600/50"
                        >
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-slate-500 to-slate-700 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white group-hover:text-purple-600 transition-colors">
                                {new Date(vente.date).toLocaleDateString('fr-FR', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </p>
                              <p className="text-sm text-slate-600 dark:text-slate-400">
                                {vente.nombre_ventes} transaction{vente.nombre_ventes > 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-green-600 dark:text-green-400">
                              {vente.chiffre_affaires.toLocaleString()} FCFA
                            </p>
                            <div className="flex items-center space-x-1 text-sm text-green-500 dark:text-green-400 font-medium">
                              <TrendingUp className="w-3 h-3" />
                              <span>{calculerTendance(vente.chiffre_affaires, index).label}</span>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                        <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">Aucune donnée de vente disponible</p>
                        <p className="text-sm">Les données apparaîtront après les premières transactions</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>

        {/* Footer avec statistiques de chargement */}
        <motion.footer 
          className="text-center text-slate-500 dark:text-slate-400 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <p>
            Données mises à jour en temps réel • 
            Dernière actualisation : {new Date().toLocaleTimeString('fr-FR')} • 
            Période : {periode}
          </p>
        </motion.footer>
      </main>
    </div>
  );
}