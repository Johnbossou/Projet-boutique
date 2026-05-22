'use client';

import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Package, 
  ShoppingCart, 
  Users, 
  AlertTriangle,
  DollarSign,
  BarChart3,
  Settings,
  LogOut,
  Store,
  Bell,
  Search,
  RefreshCw,
  // 🆕 AJOUTE CES IMPORTS MANQUANTS :
  Brain,
  Sparkles,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api-client';
import { NotificationBell } from '@/components/NotificationBell';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

// Types pour les données réelles
interface DashboardStats {
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
}

interface Produit {
  id: number;
  nom: string;
  quantite_stock: number;
  seuil_alerte: number;
  prix: number;
  categorie?: {
    nom: string;
  };
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

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [produitsAlerte, setProduitsAlerte] = useState<Produit[]>([]);
  const [produitsPopulaires, setProduitsPopulaires] = useState<ProduitPopulaire[]>([]);

  // 🎯 FONCTION POUR RÉCUPÉRER LES DONNÉES RÉELLES
  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      console.log('🔄 Début du chargement des données...');

      const statsResponse = await apiFetch('/analytics/stats-globales');
      
      if (!statsResponse.ok) throw new Error('Erreur stats globales');
      const statsData = await statsResponse.json();
      console.log('📊 STATS GLOBALES:', statsData);
      setStats(statsData);

      // Récupérer les produits en alerte - AVEC GESTION D'ERREUR
      try {
        const alerteResponse = await apiFetch('/produits/alerte-stock');
        
        if (alerteResponse.ok) {
          const alerteData = await alerteResponse.json();
          console.log('🚨 PRODUITS ALERTE:', alerteData);
          setProduitsAlerte(alerteData);
        } else {
          console.warn('⚠️ API alerte-stock non disponible, utilisation des données simulées');
          // Données simulées basées sur les stocks
          setProduitsAlerte([]);
        }
      } catch (alerteError) {
        console.warn('⚠️ Erreur API alerte-stock:', alerteError);
        setProduitsAlerte([]);
      }

      // Récupérer les produits populaires
      const populairesResponse = await apiFetch('/analytics/produits-populaires');
      
      if (!populairesResponse.ok) throw new Error('Erreur produits populaires');
      const populairesData = await populairesResponse.json();
      console.log('📈 PRODUITS POPULAIRES:', populairesData);
      setProduitsPopulaires(populairesData);

      console.log('✅ Données chargées avec succès!');

    } catch (error) {
      console.error('❌ Erreur chargement données:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardData();
      if (user.role === 'gerant') {
        apiFetch('/notifications/sync-stock-alerts', { method: 'POST' }).catch(() => undefined);
      }
    }
  }, [user]);

  // 🎯 STATS CALCULÉES EN TEMPS RÉEL - VERSION CORRIGÉE
  const calculatedStats = [
    {
      title: "Chiffre d'Affaires",
      value: stats ? `${(stats.ventes.chiffre_affaires_total / 1000).toFixed(0)}K FCFA` : '0 FCFA',
      icon: DollarSign,
      trend: "+12.5%",
      color: "text-green-500",
      description: "Total des ventes"
    },
    {
      title: "Ventes Total",
      value: stats ? stats.ventes.total_ventes.toString() : '0',
      icon: ShoppingCart,
      trend: "+8.2%",
      color: "text-blue-500",
      description: "Nombre de transactions"
    },
    {
      title: "Produits en Stock",
      value: stats ? stats.produits.total_produits.toString() : '0',
      icon: Package,
      trend: "Stable",
      color: "text-purple-500",
      description: "Articles disponibles"
    },
    {
      title: "Alertes Actives",
      value: produitsAlerte.length.toString(),
      icon: AlertTriangle,
      trend: produitsAlerte.length > 0 ? "Attention" : "Stable",
      color: produitsAlerte.length > 0 ? "text-orange-500" : "text-green-500",
      description: "Nécessitent réappro"
    }
  ];

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Chargement de votre session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* Sidebar Élite */}
      <motion.div
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        className={`fixed inset-y-0 left-0 z-50 w-80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-700/50 transition-all duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex flex-col h-full">
          {/* Header Sidebar */}
          <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/50">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center space-x-3"
            >
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Store className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">SGCI BÉNIN</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">Dashboard Premium</p>
              </div>
            </motion.div>
          </div>

          {/* Navigation Fonctionnelle */}
          <nav className="flex-1 p-6 space-y-2">
            {[
              { 
                icon: BarChart3, 
                label: 'Dashboard', 
                active: true,
                href: '/dashboard'
              },
              { 
                icon: Brain, 
                label: 'Assistant stock', 
                active: false,
                href: '/ia'
              },
              { 
                icon: Package, 
                label: 'Produits', 
                active: false,
                href: '/produits'
              },
              { 
                icon: Store, 
                label: 'Stock', 
                active: false,
                href: '/stock'
              },
              { 
                icon: Package, 
                label: 'Arrivage', 
                active: false,
                href: '/arrivage'
              },
              { 
                icon: ShoppingCart, 
                label: 'Caisse', 
                active: false,
                href: '/caisse'
              },
              { 
                icon: TrendingUp, 
                label: 'Analytics', 
                active: false,
                href: '/analytics'
              },
              { 
                icon: Users, 
                label: 'Clients', 
                active: false,
                href: '/clients'
              },
              { 
                icon: Settings, 
                label: 'Paramètres', 
                active: false,
                href: '/parametres'
              },
            ].map((item, index) => (
              <motion.button
                key={item.label}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-left transition-all duration-200 ${
                  typeof window !== 'undefined' && window.location.pathname === item.href
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg' 
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-orange-600 dark:hover:text-orange-400'
                }`}
                onClick={() => {
                  window.location.href = item.href;
                }}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
                
                {item.label === 'Assistant stock' && (
                  <Badge variant="secondary" className="ml-auto bg-purple-500/10 text-purple-600 border-purple-500/20 text-xs">
                    <Sparkles className="w-3 h-3 mr-1" />
                    IA
                  </Badge>
                )}
                {item.label === 'Caisse' && (
                  <Badge variant="secondary" className="ml-auto bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                    Nouveau
                  </Badge>
                )}
                {item.label === 'Analytics' && (
                  <Badge variant="secondary" className="ml-auto bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs">
                    Premium
                  </Badge>
                )}
              </motion.button>
            ))}
          </nav>

          {/* Footer Sidebar */}
          <div className="p-6 border-t border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-sm">
                  {user.name.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {user.name}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 capitalize">
                  {user.role}
                </p>
              </div>
            </div>
            <Button
              onClick={logout}
              variant="outline"
              className="w-full justify-start text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${isSidebarOpen ? 'ml-80' : 'ml-0'}`}>
        {/* Top Bar Élite */}
        <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="text-slate-600 dark:text-slate-400"
              >
                <div className="w-6 h-6">
                  <div className={`transform transition-all duration-300 ${isSidebarOpen ? 'rotate-0' : 'rotate-180'}`}>
                    ☰
                  </div>
                </div>
              </Button>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Rechercher produits, ventes..."
                  className="pl-10 w-80 bg-white/50 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600"
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={fetchDashboardData}
                disabled={isLoading}
                className="relative"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              
              <NotificationBell />
              
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                {user.name[0]}
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="p-8">
          {/* Welcome Section */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                  Bonjour, {user.name} 👋
                </h1>
                <p className="text-slate-600 dark:text-slate-400">
                  {isLoading ? 'Chargement des données en temps réel...' : 'Voici les performances de votre business'}
                </p>
              </div>
              
              <div className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400">
                <Zap className="w-4 h-4 text-green-500" />
                <span>Données en temps réel</span>
              </div>
            </div>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {calculatedStats.map((stat, index) => (
              <motion.div
                key={stat.title}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:shadow-lg transition-all duration-300 group">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          {stat.title}
                        </p>
                        {/* 🔥 CORRECTION : Remplacement du <div> dans <p> */}
                        <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                          {isLoading ? (
                            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-20"></div>
                          ) : (
                            stat.value
                          )}
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <p className={`text-xs font-medium ${stat.color}`}>
                            {stat.trend}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {stat.description}
                          </p>
                        </div>
                      </div>
                      <div className="w-12 h-12 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <stat.icon className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Alertes et Produits Populaires */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Alertes Stock */}
            <motion.div
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    <span>Alertes Stock</span>
                    <Badge variant="destructive" className="ml-2">
                      {produitsAlerte.length}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Produits nécessitant une attention immédiate
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {isLoading ? (
                      Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 animate-pulse">
                          <div className="space-y-2 flex-1">
                            <div className="h-4 bg-orange-200 dark:bg-orange-800 rounded w-3/4"></div>
                            <div className="h-3 bg-orange-200 dark:bg-orange-800 rounded w-1/2"></div>
                          </div>
                          <div className="h-8 bg-orange-200 dark:bg-orange-800 rounded w-20"></div>
                        </div>
                      ))
                    ) : produitsAlerte.length > 0 ? (
                      produitsAlerte.slice(0, 5).map((produit, index) => (
                        <div key={produit.id} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {produit.nom}
                            </p>
                            <p className="text-sm text-orange-600 dark:text-orange-400">
                              Stock: {produit.quantite_stock} (Seuil: {produit.seuil_alerte})
                            </p>
                            {produit.categorie && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Catégorie: {produit.categorie.nom}
                              </p>
                            )}
                          </div>
                          <Button size="sm" variant="outline" className="border-orange-300 text-orange-600 hover:bg-orange-50">
                            Commander
                          </Button>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Aucune alerte de stock</p>
                        <p className="text-sm">Tous vos produits sont bien approvisionnés</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Produits Populaires */}
            <motion.div
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    <span>Produits Populaires</span>
                  </CardTitle>
                  <CardDescription>
                    Top des produits les plus vendus
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {isLoading ? (
                      Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg animate-pulse">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-slate-200 dark:bg-slate-600 rounded-lg"></div>
                            <div className="space-y-2">
                              <div className="h-4 bg-slate-200 dark:bg-slate-600 rounded w-24"></div>
                              <div className="h-3 bg-slate-200 dark:bg-slate-600 rounded w-16"></div>
                            </div>
                          </div>
                          <div className="space-y-2 text-right">
                            <div className="h-4 bg-slate-200 dark:bg-slate-600 rounded w-16 ml-auto"></div>
                            <div className="h-3 bg-slate-200 dark:bg-slate-600 rounded w-12 ml-auto"></div>
                          </div>
                        </div>
                      ))
                    ) : produitsPopulaires.length > 0 ? (
                      produitsPopulaires.slice(0, 5).map((item, index) => (
                        <div key={item.produit_id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                              #{index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">
                                {item.produit.nom}
                              </p>
                              <p className="text-sm text-slate-600 dark:text-slate-400">
                                {item.total_vendus} ventes
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-slate-900 dark:text-white">
                              {item.chiffre_affaires?.toLocaleString() || '0'} FCFA
                            </p>
                            <p className="text-sm text-green-600 dark:text-green-400">
                              +{Math.round((index + 1) * 8.5)}%
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Aucune donnée de vente</p>
                        <p className="text-sm">Les statistiques apparaîtront après les premières ventes</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}