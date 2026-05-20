import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import {
    AlertTriangle,
    BarChart as BarChartIcon,
    Brain,
    Calendar,
    Clock,
    Lightbulb,
    PieChart,
    RefreshCw,
    ShieldAlert,
    Sparkles,
    Target,
    TrendingDown,
    TrendingUp as TrendingUpIcon,
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
    TouchableOpacity,
    View,
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { apiFetch } from "@/lib/api-client";

const { width, height } = Dimensions.get("window");

// Types
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
  niveau_urgence: "critical" | "high" | "medium" | "low" | "none";
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
    dernier_entrainement: any;
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

export default function IAScreen() {
  const { user } = useAuth();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [recommandations, setRecommandations] = useState<RecommandationPromo[]>(
    []
  );
  const [performanceData, setPerformanceData] =
    useState<PerformanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTraining, setIsTraining] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "predictions" | "promotions" | "analytics"
  >("predictions");

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(30)).current;
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

    // Animation de rotation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  // 🧠 CHARGEMENT DES DONNÉES IA
  useEffect(() => {
    chargerDonneesIA();
  }, []);

  const chargerDonneesIA = async () => {
    try {
      setIsLoading(true);

      const [predictionsResponse, promosResponse, metricsResponse] =
        await Promise.all([
          apiFetch("/ia/predictions-demande"),
          apiFetch("/ia/recommandations-promotions"),
          apiFetch("/ia/metrics-performance"),
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
      console.error("Erreur chargement IA:", error);
      Alert.alert("Erreur", "Erreur lors du chargement des analyses");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const recalculerAnalyses = async () => {
    try {
      setIsTraining(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      const response = await apiFetch("/ia/recalculer-analyses", {
        method: "POST",
        body: JSON.stringify({}),
      });

      if (response.ok) {
        const result = await response.json();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Succès", result.message || "Analyses recalculées");

        await chargerDonneesIA();
      } else {
        throw new Error("Erreur lors du recalcul");
      }
    } catch (error) {
      console.error("Erreur recalcul:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erreur", "Erreur lors du recalcul des analyses");
    } finally {
      setIsTraining(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await chargerDonneesIA();
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // 🎨 COMPOSANT CARTE PRÉDICTION
  const CartePrediction = ({
    prediction,
    index,
  }: {
    prediction: Prediction;
    index: number;
  }) => {
    const getCouleurUrgence = (niveau: string) => {
      switch (niveau) {
        case "critical":
          return ["#ef4444", "#f97316"];
        case "high":
          return ["#f97316", "#eab308"];
        case "medium":
          return ["#eab308", "#fbbf24"];
        case "low":
          return ["#22c55e", "#10b981"];
        default:
          return ["#64748b", "#475569"];
      }
    };

    const getIconeUrgence = (niveau: string) => {
      switch (niveau) {
        case "critical":
          return <ShieldAlert size={16} color="#ffffff" />;
        case "high":
          return <AlertTriangle size={16} color="#ffffff" />;
        case "medium":
          return <TrendingDown size={16} color="#ffffff" />;
        default:
          return <TrendingUpIcon size={16} color="#ffffff" />;
      }
    };

    return (
      <Animated.View
        style={[
          styles.predictionCard,
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
        <TouchableOpacity
          style={styles.predictionCardInner}
          activeOpacity={0.9}
        >
          <View style={styles.predictionHeader}>
            <View style={styles.predictionTitleContainer}>
              <View
                style={[
                  styles.categoryDot,
                  { backgroundColor: prediction.couleur_categorie },
                ]}
              />
              <View style={styles.predictionTitleWrapper}>
                <Text style={styles.predictionProductName} numberOfLines={1}>
                  {prediction.produit_nom}
                </Text>
                <Text style={styles.predictionCategory}>
                  {prediction.categorie}
                </Text>
              </View>
            </View>

            <View style={styles.predictionUrgency}>
              <LinearGradient
                colors={getCouleurUrgence(prediction.niveau_urgence)}
                style={styles.urgencyBadge}
              >
                {getIconeUrgence(prediction.niveau_urgence)}
              </LinearGradient>
            </View>
          </View>

          <Text style={styles.predictionRecommendation} numberOfLines={2}>
            {prediction.recommandation}
          </Text>

          {/* Métriques */}
          <View style={styles.predictionMetrics}>
            <View style={styles.metricRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Stock actuel</Text>
                <Text style={styles.metricValue}>
                  {prediction.stock_actuel}
                </Text>
                <Text style={styles.metricSubtext}>
                  Seuil: {prediction.seuil_alerte}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Demande prédite</Text>
                <Text style={[styles.metricValue, styles.blueValue]}>
                  {prediction.demande_predite_semaine}
                </Text>
                <Text style={styles.metricSubtext}>
                  Confiance:{" "}
                  {(prediction.confiance_prediction * 100).toFixed(0)}%
                </Text>
              </View>
            </View>

            <View style={styles.metricRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Ventes 30j</Text>
                <Text style={styles.metricValue}>
                  {prediction.ventes_30_jours}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Besoin</Text>
                <Text
                  style={[
                    styles.metricValue,
                    prediction.besoin_calcule > 0
                      ? styles.redValue
                      : styles.greenValue,
                  ]}
                >
                  {prediction.besoin_calcule > 0
                    ? `+${prediction.besoin_calcule}`
                    : prediction.besoin_calcule}
                </Text>
              </View>
            </View>
          </View>

          {/* Barre de progression */}
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(100, (prediction.stock_actuel / prediction.demande_predite_semaine) * 100)}%`,
                    backgroundColor: getCouleurUrgence(
                      prediction.niveau_urgence
                    )[0],
                  },
                ]}
              />
            </View>
          </View>

          {/* Alerte */}
          {prediction.besoin_calcule > 0 && (
            <View
              style={[
                styles.alertContainer,
                prediction.niveau_urgence === "critical" &&
                  styles.criticalAlert,
                prediction.niveau_urgence === "high" && styles.highAlert,
                prediction.niveau_urgence === "medium" && styles.mediumAlert,
              ]}
            >
              <AlertTriangle
                size={16}
                color={
                  prediction.niveau_urgence === "critical"
                    ? "#dc2626"
                    : prediction.niveau_urgence === "high"
                      ? "#ea580c"
                      : "#ca8a04"
                }
              />
              <Text
                style={[
                  styles.alertText,
                  prediction.niveau_urgence === "critical" &&
                    styles.criticalAlertText,
                  prediction.niveau_urgence === "high" && styles.highAlertText,
                  prediction.niveau_urgence === "medium" &&
                    styles.mediumAlertText,
                ]}
              >
                {prediction.niveau_urgence === "critical"
                  ? "URGENT"
                  : "Recommandé"}
                : Commander {prediction.besoin_calcule} unités
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // 🎨 COMPOSANT RECOMMANDATION PROMO
  const CarteRecommandation = ({
    reco,
    index,
  }: {
    reco: RecommandationPromo;
    index: number;
  }) => {
    const getCouleurScore = (score: number) => {
      if (score >= 80) return ["#ef4444", "#ec4899"];
      if (score >= 60) return ["#f97316", "#ef4444"];
      if (score >= 40) return ["#eab308", "#f97316"];
      return ["#22c55e", "#10b981"];
    };

    return (
      <Animated.View
        style={[
          styles.recommendationCard,
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
          style={styles.recommendationCardInner}
          activeOpacity={0.9}
        >
          <View style={styles.recommendationHeader}>
            <View style={styles.recommendationTitleContainer}>
              <View
                style={[
                  styles.recoCategoryDot,
                  { backgroundColor: reco.produit.couleur_categorie },
                ]}
              />
              <View style={styles.recommendationTitleWrapper}>
                <Text
                  style={styles.recommendationProductName}
                  numberOfLines={1}
                >
                  {reco.produit.nom}
                </Text>
                <Text style={styles.recommendationCategory}>
                  {reco.produit.categorie}
                </Text>
              </View>
            </View>

            <LinearGradient
              colors={getCouleurScore(reco.score_promotion)}
              style={styles.scoreBadge}
            >
              <Text style={styles.scoreText}>{reco.score_promotion}%</Text>
            </LinearGradient>
          </View>

          {/* Tags */}
          <View style={styles.tagsContainer}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>
                Stock: {reco.produit.quantite_stock}
              </Text>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>
                Ventes 30j: {reco.ventes_30_jours}
              </Text>
            </View>
          </View>

          {/* Score bar */}
          <View style={styles.scoreContainer}>
            <View style={styles.scoreHeader}>
              <Text style={styles.scoreLabel}>Score promotion</Text>
              <Text style={styles.scoreValue}>{reco.score_promotion}/100</Text>
            </View>
            <View style={styles.scoreBar}>
              <Animated.View
                style={[
                  styles.scoreBarFill,
                  {
                    width: `${reco.score_promotion}%`,
                    backgroundColor: getCouleurScore(reco.score_promotion)[0],
                  },
                ]}
              />
            </View>
          </View>

          {/* Prix */}
          <View style={styles.priceContainer}>
            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>Prix actuel</Text>
              <Text style={styles.currentPrice}>
                {reco.produit.prix.toLocaleString()} FCFA
              </Text>
            </View>
            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>Prix suggéré</Text>
              <Text style={styles.suggestedPrice}>
                {reco.prix_suggere.toLocaleString()} FCFA
              </Text>
            </View>
          </View>

          {/* Réduction et durée */}
          <View style={styles.detailsContainer}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Réduction</Text>
              <Text style={styles.detailValue}>{reco.reduction_suggeree}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Durée</Text>
              <View style={styles.durationContainer}>
                <Calendar size={14} color="#3b82f6" />
                <Text style={styles.durationText}>{reco.duree_suggeree}</Text>
              </View>
            </View>
          </View>

          {/* Impact */}
          <View style={styles.impactContainer}>
            <View style={styles.impactHeader}>
              <Lightbulb size={16} color="#059669" />
              <Text style={styles.impactTitle}>Impact estimé</Text>
            </View>
            <View style={styles.impactContent}>
              <Text style={styles.impactText}>
                📈 {reco.impact_estime.augmentation_ventes} ventes attendues
              </Text>
              <Text style={styles.impactText}>
                📦 Stock après promo: {reco.impact_estime.stock_apres_promo}{" "}
                unités
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // KPI Cards
  const kpiData = [
    {
      label: "Indice stock",
      value: performanceData
        ? `${(performanceData.precision.precision_globale * 100).toFixed(1)}%`
        : "87.5%",
      subtext:
        performanceData?.precision.mode === "algorithmique_avance"
          ? "Mode Algorithmique"
          : "Mode ML",
      icon: Target,
      gradient: ["#22c55e", "#10b981"],
      index: 0,
    },
    {
      label: "Produits Analysés",
      value: predictions.length.toString(),
      subtext: `${performanceData?.donnees_temps_reel?.total_produits || 0} au total`,
      icon: PieChart,
      gradient: ["#3b82f6", "#8b5cf6"],
      index: 1,
    },
    {
      label: "Alertes Prédites",
      value: predictions.filter((p) => p.besoin_calcule > 0).length.toString(),
      subtext: `${performanceData?.donnees_temps_reel?.produits_alerte || 0} en alerte réelle`,
      icon: AlertTriangle,
      gradient: ["#f97316", "#ef4444"],
      index: 2,
    },
    {
      label: "Recommandations",
      value: recommandations.length.toString(),
      subtext: "Opportunités détectées",
      icon: Lightbulb,
      gradient: ["#8b5cf6", "#ec4899"],
      index: 3,
    },
  ];

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Header */}
      <BlurView intensity={30} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <LinearGradient
              colors={["#8b5cf6", "#ec4899"]}
              style={styles.headerLogo}
            >
              <Brain size={24} color="#ffffff" />
            </LinearGradient>
            <View>
              <Text style={styles.headerTitle}>Assistant stock & promos</Text>
              <Text style={styles.headerSubtitle}>
                Ventes des 7, 30 et 90 derniers jours
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[
                styles.trainButton,
                isTraining && styles.trainButtonDisabled,
              ]}
              onPress={recalculerAnalyses}
              disabled={isTraining}
            >
              <Animated.View
                style={{
                  transform: [
                    { rotate: isTraining ? rotateInterpolate : "0deg" },
                  ],
                }}
              >
                <RefreshCw
                  size={20}
                  color={isTraining ? "#8b5cf6" : "#ffffff"}
                />
              </Animated.View>
              <Text style={styles.trainButtonText}>
                {isTraining ? "Recalcul..." : "Recalculer"}
              </Text>
            </TouchableOpacity>

            <View
              style={[
                styles.statusBadge,
                styles.statusActive,
              ]}
            >
              <Sparkles size={12} color="#ffffff" />
              <Text style={styles.statusText}>
                {performanceData?.statut_modele?.libelle ?? "Analyses actives"}
              </Text>
            </View>
          </View>
        </View>
      </BlurView>

      {/* KPI Cards */}
      <Animated.View
        style={[
          styles.kpiContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideUpAnim }],
          },
        ]}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {kpiData.map((kpi) => (
            <Animated.View
              key={kpi.label}
              style={[
                styles.kpiCard,
                {
                  opacity: fadeAnim,
                  transform: [
                    {
                      translateY: fadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20 * (kpi.index + 1), 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <BlurView intensity={10} style={styles.kpiCardInner}>
                <LinearGradient
                  colors={kpi.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.kpiGradient}
                  opacity={0.1}
                />

                <View style={styles.kpiContent}>
                  <View>
                    <Text style={styles.kpiLabel}>{kpi.label}</Text>
                    <Text style={styles.kpiValue}>{kpi.value}</Text>
                    <Text style={styles.kpiSubtext}>{kpi.subtext}</Text>
                  </View>
                  <LinearGradient
                    colors={kpi.gradient}
                    style={styles.kpiIconContainer}
                  >
                    <kpi.icon size={24} color="#ffffff" />
                  </LinearGradient>
                </View>
              </BlurView>
            </Animated.View>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Tabs */}
      <Animated.View
        style={[
          styles.tabsContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideUpAnim }],
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
        >
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "predictions" && styles.activeTab,
            ]}
            onPress={() => setActiveTab("predictions")}
          >
            <TrendingUpIcon
              size={20}
              color={activeTab === "predictions" ? "#8b5cf6" : "#64748b"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "predictions" && styles.activeTabText,
              ]}
            >
              Prédictions
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === "promotions" && styles.activeTab]}
            onPress={() => setActiveTab("promotions")}
          >
            <Zap
              size={20}
              color={activeTab === "promotions" ? "#8b5cf6" : "#64748b"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "promotions" && styles.activeTabText,
              ]}
            >
              Promotions
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === "analytics" && styles.activeTab]}
            onPress={() => setActiveTab("analytics")}
          >
            <BarChartIcon
              size={20}
              color={activeTab === "analytics" ? "#8b5cf6" : "#64748b"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "analytics" && styles.activeTabText,
              ]}
            >
              Analytics
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>

      {/* Content */}
      <Animated.View
        style={[
          styles.contentContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideUpAnim }],
          },
        ]}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#8b5cf6"
              colors={["#8b5cf6"]}
            />
          }
        >
          {activeTab === "predictions" && (
            <View style={styles.tabContent}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>
                    Prédictions de Demande
                  </Text>
                  <Text style={styles.sectionSubtitle}>
                    Prévisions intelligentes des besoins en stock pour les 7
                    prochains jours
                  </Text>
                </View>
                <View style={styles.sectionBadges}>
                  <View style={styles.timeBadge}>
                    <Clock size={14} color="#3b82f6" />
                    <Text style={styles.timeBadgeText}>
                      Mis à jour à l'instant
                    </Text>
                  </View>
                  {predictions[0]?.mode_calcul && (
                    <View style={styles.modeBadge}>
                      <Text style={styles.modeBadgeText}>
                        {predictions[0].mode_calcul}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {isLoading ? (
                // Skeleton predictions
                <View style={styles.skeletonGrid}>
                  {Array.from({ length: 6 }).map((_, index) => (
                    <View key={index} style={styles.skeletonCard}>
                      <View style={styles.skeletonHeader}>
                        <View style={styles.skeletonTitle}>
                          <View style={styles.skeletonLine} />
                          <View
                            style={[styles.skeletonLine, { width: "60%" }]}
                          />
                        </View>
                        <View style={styles.skeletonIcon} />
                      </View>
                      <View style={styles.skeletonMetrics}>
                        {Array.from({ length: 4 }).map((_, i) => (
                          <View key={i} style={styles.skeletonMetric}>
                            <View style={styles.skeletonLine} />
                            <View
                              style={[styles.skeletonLine, { width: "40%" }]}
                            />
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              ) : predictions.length > 0 ? (
                <View style={styles.predictionsGrid}>
                  {predictions.slice(0, 9).map((prediction, index) => (
                    <CartePrediction
                      key={prediction.produit_id}
                      prediction={prediction}
                      index={index}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Brain size={64} color="#94a3b8" />
                  <Text style={styles.emptyStateTitle}>
                    Aucune donnée de prédiction
                  </Text>
                  <Text style={styles.emptyStateText}>
                    L'IA a besoin de données pour générer des prédictions
                  </Text>
                  <TouchableOpacity
                    style={styles.refreshButton}
                    onPress={chargerDonneesIA}
                  >
                    <RefreshCw size={20} color="#3b82f6" />
                    <Text style={styles.refreshButtonText}>
                      Actualiser les données
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {activeTab === "promotions" && (
            <View style={styles.tabContent}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>
                    Recommandations de Promotions
                  </Text>
                  <Text style={styles.sectionSubtitle}>
                    Opportunités intelligentes pour booster les ventes et
                    optimiser les stocks
                  </Text>
                </View>
                <View style={styles.sectionBadges}>
                  <View style={styles.opportunityBadge}>
                    <Lightbulb size={14} color="#22c55e" />
                    <Text style={styles.opportunityBadgeText}>
                      {recommandations.length} opportunités
                    </Text>
                  </View>
                  {recommandations[0]?.mode_calcul && (
                    <View style={styles.modeBadge}>
                      <Text style={styles.modeBadgeText}>
                        {recommandations[0].mode_calcul}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {isLoading ? (
                // Skeleton recommendations
                <View style={styles.skeletonGrid}>
                  {Array.from({ length: 6 }).map((_, index) => (
                    <View key={index} style={styles.skeletonCard}>
                      <View style={styles.skeletonHeader}>
                        <View style={styles.skeletonTitle}>
                          <View style={styles.skeletonLine} />
                          <View
                            style={[styles.skeletonLine, { width: "60%" }]}
                          />
                        </View>
                        <View style={styles.skeletonScore} />
                      </View>
                      <View style={styles.skeletonBar} />
                      <View style={styles.skeletonDetails}>
                        <View style={styles.skeletonLine} />
                        <View style={[styles.skeletonLine, { width: "70%" }]} />
                      </View>
                    </View>
                  ))}
                </View>
              ) : recommandations.length > 0 ? (
                <View style={styles.recommendationsGrid}>
                  {recommandations.map((recommandation, index) => (
                    <CarteRecommandation
                      key={recommandation.produit.id}
                      reco={recommandation}
                      index={index}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Zap size={64} color="#94a3b8" />
                  <Text style={styles.emptyStateTitle}>
                    Aucune recommandation de promotion
                  </Text>
                  <Text style={styles.emptyStateText}>
                    L'IA analysera les opportunités lorsque plus de données
                    seront disponibles
                  </Text>
                </View>
              )}
            </View>
          )}

          {activeTab === "analytics" && (
            <View style={styles.tabContent}>
              <View style={styles.analyticsHeader}>
                <View style={styles.analyticsTitleContainer}>
                  <BarChartIcon size={24} color="#8b5cf6" />
                  <Text style={styles.analyticsTitle}>
                    Performance du Modèle IA
                  </Text>
                </View>
                <Text style={styles.analyticsSubtitle}>
                  Métriques détaillées et analyse des prédictions en temps réel
                </Text>
              </View>

              <BlurView intensity={10} style={styles.analyticsCard}>
                {performanceData ? (
                  <>
                    {/* Précision */}
                    <View style={styles.accuracySection}>
                      <Text style={styles.sectionTitle}>
                        Indicateurs stock & ventes
                      </Text>
                      <View style={styles.metricsGrid}>
                        {[
                          {
                            label: "Indice global",
                            value:
                              performanceData.precision.precision_globale * 100,
                            color: "#22c55e",
                          },
                          {
                            label: "Stock en alerte",
                            value:
                              performanceData.precision.precision_stock_alerte *
                              100,
                            color: "#3b82f6",
                          },
                          {
                            label: "Demande estimée",
                            value:
                              performanceData.precision.precision_demandes *
                              100,
                            color: "#8b5cf6",
                          },
                          {
                            label: "Taux de Confiance",
                            value:
                              performanceData.precision.taux_confiance * 100,
                            color: "#f97316",
                          },
                        ].map((metric, index) => (
                          <Animated.View
                            key={metric.label}
                            style={[
                              styles.metricItem,
                              {
                                opacity: fadeAnim,
                                transform: [
                                  {
                                    translateY: fadeAnim.interpolate({
                                      inputRange: [0, 1],
                                      outputRange: [10 * (index + 1), 0],
                                    }),
                                  },
                                ],
                              },
                            ]}
                          >
                            <View style={styles.metricHeader}>
                              <Text style={styles.metricLabel}>
                                {metric.label}
                              </Text>
                              <Text style={styles.metricValue}>
                                {metric.value.toFixed(1)}%
                              </Text>
                            </View>
                            <View style={styles.metricBar}>
                              <Animated.View
                                style={[
                                  styles.metricBarFill,
                                  {
                                    width: `${metric.value}%`,
                                    backgroundColor: metric.color,
                                  },
                                ]}
                              />
                            </View>
                          </Animated.View>
                        ))}
                      </View>
                    </View>

                    {/* Impact Business */}
                    <View style={styles.impactSection}>
                      <Text style={styles.sectionTitle}>Impact Business</Text>
                      <View style={styles.impactGrid}>
                        {[
                          {
                            label: "Réduction Ruptures",
                            value: `${performanceData.impact_business.reduction_ruptures}%`,
                            description: `${performanceData.impact_business.produits_rupture_actuels} ruptures actuelles`,
                          },
                          {
                            label: "Optimisation Stocks",
                            value: `${performanceData.impact_business.optimisation_stock}%`,
                            description: `${performanceData.impact_business.produits_alerte_actuels} alertes actuelles`,
                          },
                          {
                            label: "Augmentation CA",
                            value: `${performanceData.impact_business.augmentation_ca}%`,
                            description: "Grâce aux promotions ciblées",
                          },
                          {
                            label: "Gain de Temps",
                            value: `${performanceData.impact_business.gain_temps}%`,
                            description: "Automatisation des décisions",
                          },
                        ].map((impact, index) => (
                          <Animated.View
                            key={impact.label}
                            style={[
                              styles.impactCard,
                              {
                                opacity: fadeAnim,
                                transform: [
                                  {
                                    translateX: fadeAnim.interpolate({
                                      inputRange: [0, 1],
                                      outputRange: [20 * (index + 1), 0],
                                    }),
                                  },
                                ],
                              },
                            ]}
                          >
                            <View style={styles.impactContent}>
                              <View>
                                <Text style={styles.impactLabel}>
                                  {impact.label}
                                </Text>
                                <Text style={styles.impactDescription}>
                                  {impact.description}
                                </Text>
                              </View>
                              <Text style={styles.impactValue}>
                                {impact.value}
                              </Text>
                            </View>
                          </Animated.View>
                        ))}
                      </View>
                    </View>

                    {/* Statut Modèle */}
                    <View style={styles.modelStatusSection}>
                      <Text style={styles.sectionTitle}>Statut des analyses</Text>
                      <View style={styles.modelStatusGrid}>
                        <View style={styles.modelStatusItem}>
                          <Text style={styles.modelStatusLabel}>Statut:</Text>
                          <View
                            style={[
                              styles.modelStatusBadge,
                              styles.modelStatusTrained,
                            ]}
                          >
                            <Text style={styles.modelStatusBadgeText}>
                              {performanceData.statut_modele?.libelle ??
                                "Analyses à jour"}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.modelStatusItem}>
                          <Text style={styles.modelStatusLabel}>
                            Dernier recalcul:
                          </Text>
                          <Text style={styles.modelStatusValue}>
                            {performanceData.statut_modele?.dernier_recalcul
                              ?.date
                              ? new Date(
                                  performanceData.statut_modele.dernier_recalcul.date
                                ).toLocaleDateString("fr-FR")
                              : performanceData.statut_modele?.dernier_entrainement
                                  ?.date
                              ? new Date(
                                  performanceData.statut_modele.dernier_entrainement.date
                                ).toLocaleDateString("fr-FR")
                              : "—"}
                          </Text>
                        </View>
                        <View style={styles.modelStatusItem}>
                          <Text style={styles.modelStatusLabel}>
                            Prochaine mise à jour:
                          </Text>
                          <Text style={styles.modelStatusValue}>
                            {performanceData.statut_modele.prochaine_mise_a_jour
                              ? new Date(
                                  performanceData.statut_modele
                                    .prochaine_mise_a_jour
                                ).toLocaleDateString("fr-FR")
                              : "Non planifiée"}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </>
                ) : (
                  <View style={styles.loadingMetrics}>
                    <Animated.View
                      style={[
                        styles.loadingSpinner,
                        {
                          transform: [{ rotate: rotateInterpolate }],
                        },
                      ]}
                    />
                    <Text style={styles.loadingMetricsText}>
                      Chargement des métriques...
                    </Text>
                  </View>
                )}
              </BlurView>
            </View>
          )}
        </ScrollView>
      </Animated.View>
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
  loadingText: {
    color: "#ffffff",
    fontSize: 16,
  },
  // Header
  header: {
    paddingTop: Platform.OS === "ios" ? 50 : StatusBar.currentHeight,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#94a3b8",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  trainButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#8b5cf6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 12,
  },
  trainButtonDisabled: {
    backgroundColor: "rgba(139, 92, 246, 0.5)",
  },
  trainButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusTrained: {
    backgroundColor: "#059669",
  },
  statusActive: {
    backgroundColor: "#3b82f6",
  },
  statusText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  // KPI Cards
  kpiContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  kpiCard: {
    width: 180,
    marginRight: 12,
  },
  kpiCardInner: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    position: "relative",
  },
  kpiGradient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.1,
  },
  kpiContent: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kpiLabel: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 2,
  },
  kpiSubtext: {
    fontSize: 10,
    color: "#94a3b8",
  },
  kpiIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  // Tabs
  tabsContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  tabsScroll: {
    flexDirection: "row",
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  activeTab: {
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    borderColor: "rgba(139, 92, 246, 0.3)",
  },
  tabText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
  activeTabText: {
    color: "#8b5cf6",
  },
  // Content
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
  },
  // Section Header
  sectionHeader: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#94a3b8",
    marginBottom: 12,
  },
  sectionBadges: {
    flexDirection: "row",
    gap: 8,
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.2)",
  },
  timeBadgeText: {
    color: "#3b82f6",
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 4,
  },
  opportunityBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.2)",
  },
  opportunityBadgeText: {
    color: "#22c55e",
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 4,
  },
  modeBadge: {
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  modeBadgeText: {
    color: "#8b5cf6",
    fontSize: 12,
    fontWeight: "500",
  },
  // Predictions
  predictionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  predictionCard: {
    width: (width - 60) / 2,
    marginBottom: 16,
  },
  predictionCardInner: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 16,
  },
  predictionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  predictionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  predictionTitleWrapper: {
    flex: 1,
  },
  predictionProductName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 2,
  },
  predictionCategory: {
    fontSize: 12,
    color: "#94a3b8",
  },
  predictionUrgency: {
    marginLeft: 8,
  },
  urgencyBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  predictionRecommendation: {
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 18,
    marginBottom: 16,
  },
  predictionMetrics: {
    marginBottom: 16,
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 11,
    color: "#94a3b8",
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 2,
  },
  blueValue: {
    color: "#3b82f6",
  },
  redValue: {
    color: "#ef4444",
  },
  greenValue: {
    color: "#22c55e",
  },
  metricSubtext: {
    fontSize: 10,
    color: "#64748b",
  },
  progressBarContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  alertContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  criticalAlert: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  highAlert: {
    backgroundColor: "rgba(249, 115, 22, 0.1)",
    borderColor: "rgba(249, 115, 22, 0.2)",
  },
  mediumAlert: {
    backgroundColor: "rgba(234, 179, 8, 0.1)",
    borderColor: "rgba(234, 179, 8, 0.2)",
  },
  alertText: {
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 8,
    flex: 1,
  },
  criticalAlertText: {
    color: "#dc2626",
  },
  highAlertText: {
    color: "#ea580c",
  },
  mediumAlertText: {
    color: "#ca8a04",
  },
  // Recommendations
  recommendationsGrid: {
    gap: 16,
  },
  recommendationCard: {
    marginBottom: 16,
  },
  recommendationCardInner: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 16,
  },
  recommendationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  recommendationTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  recoCategoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  recommendationTitleWrapper: {
    flex: 1,
  },
  recommendationProductName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 2,
  },
  recommendationCategory: {
    fontSize: 12,
    color: "#94a3b8",
  },
  scoreBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  scoreText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold",
  },
  tagsContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  tag: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "500",
  },
  scoreContainer: {
    marginBottom: 16,
  },
  scoreHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  scoreLabel: {
    fontSize: 12,
    color: "#94a3b8",
  },
  scoreValue: {
    fontSize: 12,
    color: "#ffffff",
    fontWeight: "600",
  },
  scoreBar: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 2,
    overflow: "hidden",
  },
  scoreBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  priceContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  priceItem: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 4,
  },
  currentPrice: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  suggestedPrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#22c55e",
  },
  detailsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#ef4444",
  },
  durationContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  durationText: {
    fontSize: 14,
    color: "#3b82f6",
    fontWeight: "600",
    marginLeft: 4,
  },
  impactContainer: {
    backgroundColor: "rgba(5, 150, 105, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.2)",
    borderRadius: 8,
    padding: 12,
  },
  impactHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  impactTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#059669",
    marginLeft: 6,
  },
  impactContent: {
    gap: 4,
  },
  impactText: {
    fontSize: 12,
    color: "#059669",
  },
  // Analytics
  tabContent: {
    flex: 1,
  },
  analyticsHeader: {
    marginBottom: 20,
  },
  analyticsTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  analyticsTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#ffffff",
    marginLeft: 8,
  },
  analyticsSubtitle: {
    fontSize: 14,
    color: "#94a3b8",
  },
  analyticsCard: {
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 20,
  },
  accuracySection: {
    marginBottom: 24,
  },
  metricsGrid: {
    gap: 16,
  },
  metricItem: {
    marginBottom: 12,
  },
  metricHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 14,
    color: "#94a3b8",
  },
  metricValue: {
    fontSize: 14,
    color: "#ffffff",
    fontWeight: "600",
  },
  metricBar: {
    height: 6,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 3,
    overflow: "hidden",
  },
  metricBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  impactSection: {
    marginBottom: 24,
  },
  impactGrid: {
    gap: 12,
  },
  impactCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 16,
  },
  impactContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  impactLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 2,
  },
  impactDescription: {
    fontSize: 12,
    color: "#94a3b8",
  },
  impactValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#22c55e",
  },
  modelStatusSection: {
    marginBottom: 20,
  },
  modelStatusGrid: {
    gap: 12,
  },
  modelStatusItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  modelStatusLabel: {
    fontSize: 14,
    color: "#94a3b8",
  },
  modelStatusValue: {
    fontSize: 14,
    color: "#ffffff",
    fontWeight: "600",
  },
  modelStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  modelStatusTrained: {
    backgroundColor: "rgba(5, 150, 105, 0.2)",
  },
  modelStatusUntrained: {
    backgroundColor: "rgba(234, 179, 8, 0.2)",
  },
  modelStatusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
  },
  // Skeleton
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  skeletonCard: {
    width: (width - 60) / 2,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 16,
    marginBottom: 16,
  },
  skeletonHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  skeletonTitle: {
    flex: 1,
    gap: 6,
  },
  skeletonLine: {
    height: 10,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 5,
  },
  skeletonIcon: {
    width: 32,
    height: 32,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    marginLeft: 8,
  },
  skeletonMetrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  skeletonMetric: {
    width: "45%",
    gap: 4,
  },
  skeletonBar: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 2,
    marginBottom: 12,
  },
  skeletonDetails: {
    gap: 6,
  },
  skeletonScore: {
    width: 44,
    height: 44,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 10,
    marginLeft: 8,
  },
  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyStateText: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    paddingHorizontal: 40,
    marginBottom: 24,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  refreshButtonText: {
    color: "#3b82f6",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  // Loading
  loadingMetrics: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingSpinner: {
    width: 32,
    height: 32,
    borderWidth: 3,
    borderColor: "rgba(139, 92, 246, 0.3)",
    borderTopColor: "#8b5cf6",
    borderRadius: 16,
    marginBottom: 12,
  },
  loadingMetricsText: {
    fontSize: 14,
    color: "#94a3b8",
  },
});
