import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Brain,
  DollarSign,
  Home,
  LogOut,
  Menu,
  Package,
  RefreshCw,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  Store,
  TrendingUp,
  TrendingUp as TrendingUpIcon,
  Users,
  Zap
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { NotificationBell } from "@/components/NotificationBell";
import { apiFetch } from "@/lib/api-client";

const { width, height } = Dimensions.get("window");

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

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [produitsAlerte, setProduitsAlerte] = useState<Produit[]>([]);
  const [produitsPopulaires, setProduitsPopulaires] = useState<
    ProduitPopulaire[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animation d'entrée
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Animation de rotation pour le bouton refresh
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  // 🎯 FONCTION POUR RÉCUPÉRER LES DONNÉES RÉELLES
  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      console.log("🔄 Début du chargement des données...");

      const statsResponse = await apiFetch("/analytics/stats-globales");

      if (!statsResponse.ok) throw new Error("Erreur stats globales");
      const statsData = await statsResponse.json();
      console.log("📊 STATS GLOBALES:", statsData);
      setStats(statsData);

      // Récupérer les produits en alerte
      try {
        const alerteResponse = await apiFetch("/produits/alerte-stock");

        if (alerteResponse.ok) {
          const alerteData = await alerteResponse.json();
          console.log("🚨 PRODUITS ALERTE:", alerteData);
          setProduitsAlerte(alerteData);
        } else {
          console.warn("⚠️ API alerte-stock non disponible");
          setProduitsAlerte([]);
        }
      } catch (alerteError) {
        console.warn("⚠️ Erreur API alerte-stock:", alerteError);
        setProduitsAlerte([]);
      }

      // Récupérer les produits populaires
      const populairesResponse = await apiFetch("/analytics/produits-populaires");

      if (!populairesResponse.ok) throw new Error("Erreur produits populaires");
      const populairesData = await populairesResponse.json();
      console.log("📈 PRODUITS POPULAIRES:", populairesData);
      setProduitsPopulaires(populairesData);

      console.log("✅ Données chargées avec succès!");
    } catch (error) {
      console.error("❌ Erreur chargement données:", error);
      Alert.alert("Erreur", "Erreur lors du chargement des données");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetchDashboardData();
  };

  // 🎯 STATS CALCULÉES EN TEMPS RÉEL
  const calculatedStats = [
    {
      title: "Chiffre d'Affaires",
      value: stats
        ? `${(stats.ventes.chiffre_affaires_total / 1000).toFixed(0)}K FCFA`
        : "0 FCFA",
      icon: DollarSign,
      trend: "+12.5%",
      color: "#22c55e",
      gradient: ["#22c55e", "#16a34a"],
      description: "Total des ventes",
    },
    {
      title: "Ventes Total",
      value: stats ? stats.ventes.total_ventes.toString() : "0",
      icon: ShoppingCart,
      trend: "+8.2%",
      color: "#3b82f6",
      gradient: ["#3b82f6", "#2563eb"],
      description: "Nombre de transactions",
    },
    {
      title: "Produits en Stock",
      value: stats ? stats.produits.total_produits.toString() : "0",
      icon: Package,
      trend: "Stable",
      color: "#8b5cf6",
      gradient: ["#8b5cf6", "#7c3aed"],
      description: "Articles disponibles",
    },
    {
      title: "Alertes Actives",
      value: produitsAlerte.length.toString(),
      icon: AlertTriangle,
      trend: produitsAlerte.length > 0 ? "Attention" : "Stable",
      color: produitsAlerte.length > 0 ? "#f97316" : "#22c55e",
      gradient:
        produitsAlerte.length > 0
          ? ["#f97316", "#ea580c"]
          : ["#22c55e", "#16a34a"],
      description: "Nécessitent réappro",
    },
  ];

  // Navigation items
  const navigationItems = [
    {
      icon: BarChart3,
      label: "Dashboard",
      active: true,
      route: "/(tabs)",
    },
    {
      icon: Brain,
      label: "Assistant stock",
      active: false,
      route: "/ia",
    },
    {
      icon: Package,
      label: "Produits",
      active: false,
      route: "/produits",
    },
    {
      icon: Package,
      label: "Stock",
      active: false,
      route: "/(tabs)/stock",
    },
    {
      icon: TrendingUpIcon,
      label: "Arrivage",
      active: false,
      route: "/(tabs)/arrivage",
    },
    {
      icon: ShoppingCart,
      label: "Caisse",
      active: false,
      route: "/caisse",
    },
    {
      icon: TrendingUpIcon,
      label: "Analytics",
      active: false,
      route: "/analytics",
    },
    {
      icon: Users,
      label: "Clients",
      active: false,
      route: "/clients",
    },
    {
      icon: Settings,
      label: "Paramètres",
      active: false,
      route: "/parametres",
    },
  ];

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.View
          style={[
            styles.loadingSpinner,
            {
              transform: [{ rotate: rotateInterpolate }],
            },
          ]}
        />
        <Text style={styles.loadingText}>Chargement de votre session...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Sidebar pour tablette/desktop */}
      {width > 768 && (
        <Animated.View
          style={[
            styles.sidebar,
            {
              opacity: fadeAnim,
              transform: [
                {
                  translateX: slideUpAnim.interpolate({
                    inputRange: [0, 50],
                    outputRange: [0, -100],
                  }),
                },
              ],
            },
          ]}
        >
          <BlurView intensity={20} style={styles.sidebarBlur}>
            {/* Logo */}
            <View style={styles.sidebarHeader}>
              <LinearGradient
                colors={["#f97316", "#ef4444"]}
                style={styles.sidebarLogo}
              >
                <Store size={24} color="#ffffff" />
              </LinearGradient>
              <View>
                <Text style={styles.sidebarTitle}>SGCI BÉNIN</Text>
                <Text style={styles.sidebarSubtitle}>Dashboard Premium</Text>
              </View>
            </View>

            {/* Navigation */}
            <ScrollView
              style={styles.navScroll}
              showsVerticalScrollIndicator={false}
            >
              {navigationItems.map((item, index) => (
                <Animated.View
                  key={item.label}
                  style={[
                    styles.navItemWrapper,
                    {
                      opacity: fadeAnim,
                      transform: [
                        {
                          translateX: fadeAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-20, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      styles.navItem,
                      router.route === item.route && styles.navItemActive,
                    ]}
                    onPress={() => router.push(item.route as any)}
                  >
                    <item.icon
                      size={20}
                      color={
                        router.route === item.route ? "#ffffff" : "#64748b"
                      }
                    />
                    <Text
                      style={[
                        styles.navText,
                        router.route === item.route && styles.navTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>

                    {item.label === "Assistant stock" && (
                      <View style={styles.navBadge}>
                        <Sparkles size={12} color="#8b5cf6" />
                        <Text style={styles.navBadgeText}>IA</Text>
                      </View>
                    )}
                    {item.label === "Caisse" && (
                      <View style={[styles.navBadge, styles.newBadge]}>
                        <Text style={styles.navBadgeText}>Nouveau</Text>
                      </View>
                    )}
                    {item.label === "Analytics" && (
                      <View style={[styles.navBadge, styles.premiumBadge]}>
                        <Text style={styles.navBadgeText}>Premium</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </ScrollView>

            {/* User Profile */}
            <View style={styles.userSection}>
              <View style={styles.userInfo}>
                <LinearGradient
                  colors={["#3b82f6", "#8b5cf6"]}
                  style={styles.userAvatar}
                >
                  <Text style={styles.userInitials}>
                    {user.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </Text>
                </LinearGradient>
                <View style={styles.userDetails}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {user.name}
                  </Text>
                  <Text style={styles.userRole} numberOfLines={1}>
                    {user.role?.toUpperCase() || "UTILISATEUR"}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.logoutButton} onPress={logout}>
                <LogOut size={18} color="#64748b" />
                <Text style={styles.logoutText}>Déconnexion</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </Animated.View>
      )}

      {/* Main Content */}
      <Animated.View
        style={[
          styles.mainContent,
          width > 768 && { marginLeft: 300 },
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideUpAnim }, { scale: scaleAnim }],
          },
        ]}
      >
        {/* Top Bar */}
        <BlurView intensity={30} style={styles.topBar}>
          <View style={styles.topBarContent}>
            <View style={styles.topBarLeft}>
              {width <= 768 && (
                <TouchableOpacity
                  style={styles.menuButton}
                  onPress={() => setIsSidebarOpen(!isSidebarOpen)}
                >
                  <Menu size={24} color="#ffffff" />
                </TouchableOpacity>
              )}

              <View style={styles.searchContainer}>
                <Search size={20} color="#94a3b8" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Rechercher produits, ventes..."
                  placeholderTextColor="#94a3b8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </View>

            <View style={styles.topBarRight}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={fetchDashboardData}
                disabled={isLoading}
              >
                <Animated.View
                  style={{
                    transform: [
                      { rotate: isLoading ? rotateInterpolate : "0deg" },
                    ],
                  }}
                >
                  <RefreshCw
                    size={22}
                    color={isLoading ? "#f97316" : "#ffffff"}
                  />
                </Animated.View>
              </TouchableOpacity>

              <NotificationBell />

              <TouchableOpacity style={styles.userButton}>
                <LinearGradient
                  colors={["#3b82f6", "#8b5cf6"]}
                  style={styles.userButtonAvatar}
                >
                  <Text style={styles.userButtonInitials}>{user.name[0]}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>

        {/* Dashboard Content */}
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#f97316"
              colors={["#f97316"]}
            />
          }
        >
          {/* Welcome Section */}
          <View style={styles.welcomeSection}>
            <Animated.View
              style={[
                styles.welcomeContent,
                {
                  opacity: fadeAnim,
                  transform: [
                    {
                      translateY: fadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.welcomeTitle}>Bonjour, {user.name} 👋</Text>
              <Text style={styles.welcomeSubtitle}>
                {isLoading
                  ? "Chargement des données en temps réel..."
                  : "Voici les performances de votre business"}
              </Text>

              <View style={styles.realTimeBadge}>
                <Zap size={16} color="#22c55e" />
                <Text style={styles.realTimeText}>Données en temps réel</Text>
              </View>
            </Animated.View>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            {calculatedStats.map((stat, index) => (
              <Animated.View
                key={stat.title}
                style={[
                  styles.statCardWrapper,
                  {
                    opacity: fadeAnim,
                    transform: [
                      {
                        translateY: fadeAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [20 * (index + 1), 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <BlurView intensity={10} style={styles.statCard}>
                  <LinearGradient
                    colors={stat.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.statCardGradient}
                  />

                  <View style={styles.statCardContent}>
                    <View style={styles.statHeader}>
                      <View>
                        <Text style={styles.statTitle}>{stat.title}</Text>
                        {isLoading ? (
                          <View style={styles.statValueSkeleton} />
                        ) : (
                          <Text style={styles.statValue}>{stat.value}</Text>
                        )}
                        <View style={styles.statTrendContainer}>
                          <Text
                            style={[styles.statTrend, { color: stat.color }]}
                          >
                            {stat.trend}
                          </Text>
                          <Text style={styles.statDescription}>
                            {stat.description}
                          </Text>
                        </View>
                      </View>

                      <Animated.View
                        style={[
                          styles.statIconContainer,
                          {
                            transform: [
                              {
                                scale: fadeAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0.8, 1],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        <LinearGradient
                          colors={[
                            "rgba(255, 255, 255, 0.1)",
                            "rgba(255, 255, 255, 0.05)",
                          ]}
                          style={styles.statIconBackground}
                        />
                        <stat.icon size={24} color="#ffffff" />
                      </Animated.View>
                    </View>
                  </View>
                </BlurView>
              </Animated.View>
            ))}
          </View>

          {/* Alertes et Produits Populaires */}
          <View style={styles.contentGrid}>
            {/* Alertes Stock */}
            <Animated.View
              style={[
                styles.alertSection,
                {
                  opacity: fadeAnim,
                  transform: [
                    {
                      translateX: fadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-50, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <BlurView intensity={10} style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleContainer}>
                    <AlertTriangle size={22} color="#f97316" />
                    <Text style={styles.sectionTitle}>Alertes Stock</Text>
                    {produitsAlerte.length > 0 && (
                      <View style={styles.sectionBadge}>
                        <Text style={styles.sectionBadgeText}>
                          {produitsAlerte.length}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.sectionDescription}>
                    Produits nécessitant une attention immédiate
                  </Text>
                </View>

                <View style={styles.sectionContent}>
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                      <View key={index} style={styles.skeletonItem}>
                        <View style={styles.skeletonText}>
                          <View style={styles.skeletonLine} />
                          <View
                            style={[styles.skeletonLine, { width: "60%" }]}
                          />
                        </View>
                        <View style={styles.skeletonButton} />
                      </View>
                    ))
                  ) : produitsAlerte.length > 0 ? (
                    produitsAlerte.slice(0, 5).map((produit) => (
                      <View key={produit.id} style={styles.alertItem}>
                        <View>
                          <Text style={styles.alertItemTitle}>
                            {produit.nom}
                          </Text>
                          <Text style={styles.alertItemSubtitle}>
                            Stock: {produit.quantite_stock} (Seuil:{" "}
                            {produit.seuil_alerte})
                          </Text>
                          {produit.categorie && (
                            <Text style={styles.alertItemCategory}>
                              Catégorie: {produit.categorie.nom}
                            </Text>
                          )}
                        </View>
                        <TouchableOpacity style={styles.alertButton}>
                          <Text style={styles.alertButtonText}>Commander</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyState}>
                      <Package size={48} color="#94a3b8" />
                      <Text style={styles.emptyStateTitle}>
                        Aucune alerte de stock
                      </Text>
                      <Text style={styles.emptyStateText}>
                        Tous vos produits sont bien approvisionnés
                      </Text>
                    </View>
                  )}
                </View>
              </BlurView>
            </Animated.View>

            {/* Produits Populaires */}
            <Animated.View
              style={[
                styles.popularSection,
                {
                  opacity: fadeAnim,
                  transform: [
                    {
                      translateX: fadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [50, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <BlurView intensity={10} style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleContainer}>
                    <TrendingUp size={22} color="#22c55e" />
                    <Text style={styles.sectionTitle}>Produits Populaires</Text>
                  </View>
                  <Text style={styles.sectionDescription}>
                    Top des produits les plus vendus
                  </Text>
                </View>

                <View style={styles.sectionContent}>
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                      <View key={index} style={styles.skeletonPopularItem}>
                        <View style={styles.skeletonRank}>
                          <View style={styles.skeletonCircle} />
                          <View style={styles.skeletonPopularText}>
                            <View style={styles.skeletonLine} />
                            <View
                              style={[styles.skeletonLine, { width: "40%" }]}
                            />
                          </View>
                        </View>
                        <View style={styles.skeletonPopularStats}>
                          <View style={[styles.skeletonLine, { width: 60 }]} />
                          <View style={[styles.skeletonLine, { width: 40 }]} />
                        </View>
                      </View>
                    ))
                  ) : produitsPopulaires.length > 0 ? (
                    produitsPopulaires.slice(0, 5).map((item, index) => (
                      <TouchableOpacity
                        key={item.produit_id}
                        style={styles.popularItem}
                        activeOpacity={0.7}
                      >
                        <View style={styles.popularItemLeft}>
                          <LinearGradient
                            colors={["#3b82f6", "#8b5cf6"]}
                            style={styles.popularRank}
                          >
                            <Text style={styles.popularRankText}>
                              #{index + 1}
                            </Text>
                          </LinearGradient>
                          <View style={styles.popularItemInfo}>
                            <Text style={styles.popularItemTitle}>
                              {item.produit.nom}
                            </Text>
                            <Text style={styles.popularItemSales}>
                              {item.total_vendus} ventes
                            </Text>
                          </View>
                        </View>
                        <View style={styles.popularItemRight}>
                          <Text style={styles.popularItemRevenue}>
                            {item.chiffre_affaires?.toLocaleString() || "0"}{" "}
                            FCFA
                          </Text>
                          <Text style={styles.popularItemGrowth}>
                            +{Math.round((index + 1) * 8.5)}%
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.emptyState}>
                      <TrendingUp size={48} color="#94a3b8" />
                      <Text style={styles.emptyStateTitle}>
                        Aucune donnée de vente
                      </Text>
                      <Text style={styles.emptyStateText}>
                        Les statistiques apparaîtront après les premières ventes
                      </Text>
                    </View>
                  )}
                </View>
              </BlurView>
            </Animated.View>
          </View>
        </ScrollView>
      </Animated.View>

      {/* Bottom Tab Bar (Mobile) */}
      {width <= 768 && (
        <BlurView intensity={30} style={styles.bottomTabBar}>
          {[
            { icon: Home, label: "Accueil", route: "/(tabs)" },
            { icon: Package, label: "Produits", route: "/produits" },
            { icon: Package, label: "Stock", route: "/stock" },
            { icon: TrendingUpIcon, label: "Arrivage", route: "/arrivage" },
            { icon: ShoppingCart, label: "Caisse", route: "/caisse" },
            { icon: Users, label: "Clients", route: "/clients" },
            { icon: BarChart3, label: "Stats", route: "/analytics" },
          ].map((item, index) => (
            <TouchableOpacity
              key={item.label}
              style={styles.tabItem}
              onPress={() => router.push(item.route as any)}
            >
              <item.icon
                size={24}
                color={router.route === item.route ? "#f97316" : "#94a3b8"}
              />
              <Text
                style={[
                  styles.tabLabel,
                  router.route === item.route && styles.tabLabelActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </BlurView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
  },
  loadingSpinner: {
    width: 60,
    height: 60,
    borderWidth: 4,
    borderColor: "rgba(249, 115, 22, 0.3)",
    borderTopColor: "#f97316",
    borderRadius: 30,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: "#94a3b8",
  },
  // Sidebar styles
  sidebar: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 300,
    zIndex: 100,
  },
  sidebarBlur: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 30,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRightWidth: 1,
    borderRightColor: "rgba(255, 255, 255, 0.1)",
  },
  sidebarHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 40,
  },
  sidebarLogo: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    shadowColor: "#f97316",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  sidebarTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
  },
  sidebarSubtitle: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  navScroll: {
    flex: 1,
  },
  navItemWrapper: {
    marginBottom: 8,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "transparent",
  },
  navItemActive: {
    backgroundColor: "rgba(249, 115, 22, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(249, 115, 22, 0.3)",
  },
  navText: {
    fontSize: 15,
    color: "#64748b",
    marginLeft: 12,
    flex: 1,
    fontWeight: "500",
  },
  navTextActive: {
    color: "#ffffff",
  },
  navBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  newBadge: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderColor: "rgba(34, 197, 94, 0.2)",
  },
  premiumBadge: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderColor: "rgba(59, 130, 246, 0.2)",
  },
  navBadgeText: {
    fontSize: 10,
    color: "#8b5cf6",
    fontWeight: "600",
    marginLeft: 4,
  },
  userSection: {
    marginTop: "auto",
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  userInitials: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold",
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  userRole: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  logoutText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 8,
  },
  // Main content
  mainContent: {
    flex: 1,
  },
  topBar: {
    paddingTop: Platform.OS === "ios" ? 50 : StatusBar.currentHeight,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  topBarContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  menuButton: {
    marginRight: 16,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 16,
    height: "100%",
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 16,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  notificationButton: {
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#ef4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "bold",
  },
  userButton: {
    marginLeft: 12,
  },
  userButtonAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  userButtonInitials: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
  scrollView: {
    flex: 1,
  },
  welcomeSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  welcomeContent: {
    marginBottom: 8,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: "#94a3b8",
    marginBottom: 12,
  },
  realTimeBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.2)",
  },
  realTimeText: {
    color: "#22c55e",
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 6,
  },
  statsGrid: {
    paddingHorizontal: 20,
    marginBottom: 24,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  statCardWrapper: {
    width: width > 768 ? "48%" : "100%",
    marginBottom: 16,
  },
  statCard: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    position: "relative",
  },
  statCardGradient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.2,
  },
  statCardContent: {
    padding: 20,
  },
  statHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  statTitle: {
    fontSize: 14,
    color: "#94a3b8",
    fontWeight: "500",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 8,
  },
  statValueSkeleton: {
    width: 100,
    height: 32,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    marginBottom: 8,
  },
  statTrendContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  statTrend: {
    fontSize: 12,
    fontWeight: "600",
    marginRight: 8,
  },
  statDescription: {
    fontSize: 12,
    color: "#94a3b8",
  },
  statIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  statIconBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  contentGrid: {
    paddingHorizontal: 20,
    paddingBottom: 100, // Pour le bottom tab bar
  },
  alertSection: {
    marginBottom: 24,
  },
  popularSection: {
    marginBottom: 24,
  },
  sectionCard: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  sectionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
    marginLeft: 8,
  },
  sectionBadge: {
    backgroundColor: "#ef4444",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  sectionBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
  },
  sectionDescription: {
    fontSize: 14,
    color: "#94a3b8",
  },
  sectionContent: {
    padding: 20,
  },
  // Skeleton styles
  skeletonItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    marginBottom: 8,
  },
  skeletonText: {
    flex: 1,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 6,
    marginBottom: 6,
    width: "80%",
  },
  skeletonButton: {
    width: 80,
    height: 32,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
  },
  skeletonPopularItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    marginBottom: 8,
  },
  skeletonRank: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  skeletonCircle: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 20,
    marginRight: 12,
  },
  skeletonPopularText: {
    flex: 1,
  },
  skeletonPopularStats: {
    alignItems: "flex-end",
  },
  // Alert item styles
  alertItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "rgba(249, 115, 22, 0.05)",
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(249, 115, 22, 0.1)",
  },
  alertItemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 4,
  },
  alertItemSubtitle: {
    fontSize: 14,
    color: "#f97316",
    marginBottom: 4,
  },
  alertItemCategory: {
    fontSize: 12,
    color: "#94a3b8",
  },
  alertButton: {
    backgroundColor: "rgba(249, 115, 22, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(249, 115, 22, 0.3)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  alertButtonText: {
    color: "#f97316",
    fontSize: 14,
    fontWeight: "500",
  },
  // Popular item styles
  popularItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    marginBottom: 8,
  },
  popularItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  popularRank: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  popularRankText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
  popularItemInfo: {
    flex: 1,
  },
  popularItemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 4,
  },
  popularItemSales: {
    fontSize: 14,
    color: "#94a3b8",
  },
  popularItemRight: {
    alignItems: "flex-end",
  },
  popularItemRevenue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  popularItemGrowth: {
    fontSize: 14,
    color: "#22c55e",
    fontWeight: "500",
  },
  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
  },
  // Bottom tab bar
  bottomTabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  tabItem: {
    alignItems: "center",
    flex: 1,
  },
  tabLabel: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 4,
  },
  tabLabelActive: {
    color: "#f97316",
    fontWeight: "600",
  },
});
