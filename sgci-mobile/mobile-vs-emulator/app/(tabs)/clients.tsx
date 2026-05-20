import { Picker } from "@react-native-picker/picker";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import {
    AlertTriangle,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Crown,
    DollarSign,
    Download,
    Edit,
    Mail,
    MapPin,
    Phone,
    Save,
    Search,
    ShoppingCart,
    Trash2,
    TrendingUp,
    UserPlus,
    Users,
    X,
    Zap
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Dimensions,
    Easing,
    Modal,
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
import { apiFetch } from "@/lib/api-client";

const { width, height } = Dimensions.get("window");

// Types pour les données clients
interface Vente {
  id: number;
  numero_commande: string;
  date_commande: string;
  montant_total: number;
  statut: "en_attente" | "confirmee" | "expediee" | "livree" | "annulee";
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
  statut: "actif" | "inactif" | "vip";
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
  statut: "actif" | "inactif" | "vip";
  notes: string;
}

export default function ClientsScreen() {
  const { user, getToken } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [commandesClient, setCommandesClient] = useState<Vente[]>([]);
  const [clientSelectionne, setClientSelectionne] = useState<Client | null>(
    null
  );
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState<
    "tous" | "actif" | "inactif" | "vip"
  >("tous");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingCommandes, setLoadingCommandes] = useState(false);
  const [showModalClient, setShowModalClient] = useState(false);
  const [modeEdition, setModeEdition] = useState(false);
  const [showConfirmationSuppression, setShowConfirmationSuppression] =
    useState(false);
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);
  const [ongletActif, setOngletActif] = useState<
    "informations" | "commandes" | "statistiques"
  >("informations");

  // État pour la pagination
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
  });

  // ÉTATS POUR LES FORMULAIRES
  const [formData, setFormData] = useState<ClientFormData>({
    nom: "",
    email: "",
    telephone: "",
    adresse: "",
    ville: "",
    statut: "actif",
    notes: "",
  });

  const [statsClients, setStatsClients] = useState<StatistiquesClients>({
    total_clients: 0,
    clients_actifs: 0,
    clients_vip: 0,
    clients_inactifs: 0,
    chiffre_affaires_total: 0,
    commandes_total: 0,
    panier_moyen: 0,
  });

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // Debounce pour la recherche
  const [rechercheDebouncee, setRechercheDebouncee] = useState("");
  const debounceTimer = useRef<NodeJS.Timeout>();

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
  }, []);

  // Debounce pour la recherche
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      setRechercheDebouncee(recherche);
    }, 500);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [recherche]);

  // CHARGEMENT DES DONNÉES
  useEffect(() => {
    chargerClients();
    chargerStatistiques();
  }, []);

  // Chargement avec filtres
  useEffect(() => {
    chargerClientsAvecFiltres();
  }, [rechercheDebouncee, filtreStatut]);

  // 🚀 CHARGE LES CLIENTS AVEC FILTRES
  const chargerClientsAvecFiltres = async (page = 1) => {
    try {
      setIsLoading(true);
      const token = await getToken();

      const params = new URLSearchParams();
      if (rechercheDebouncee) params.append("search", rechercheDebouncee);
      if (filtreStatut !== "tous") params.append("statut", filtreStatut);
      params.append("page", page.toString());

      const response = await apiFetch(
        `/clients?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) throw new Error(`Erreur API: ${response.status}`);

      const data = await response.json();
      const clientsData = data.data || [];

      const clientsTransformes: Client[] = clientsData.map((client: any) => ({
        id: client.id,
        nom: client.nom,
        email: client.email,
        telephone: client.telephone || "Non renseigné",
        adresse: client.adresse || "",
        ville: client.ville || "",
        created_at: client.created_at,
        total_achats: parseFloat(client.total_achats) || 0,
        nombre_commandes: client.nombre_commandes || 0,
        derniere_commande: client.derniere_commande,
        statut: client.statut,
        notes: client.notes || "",
      }));

      setClients(clientsTransformes);
      setPagination(
        data.meta || {
          current_page: 1,
          last_page: 1,
          per_page: 20,
          total: clientsTransformes.length,
        }
      );
    } catch (error) {
      console.error("Erreur chargement clients:", error);
      Alert.alert("Erreur", "Erreur lors du chargement des clients");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // 🚀 CHARGE LES STATISTIQUES
  const chargerStatistiques = async () => {
    try {
      const token = await getToken();
      const response = await apiFetch(
        "/clients/statistiques/globales",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (response.ok) {
        const stats = await response.json();
        setStatsClients(stats);
      }
    } catch (error) {
      console.error("Erreur chargement statistiques:", error);
    }
  };

  // 🚀 CHARGE LES DÉTAILS D'UN CLIENT
  const chargerDetailsClient = async (clientId: number) => {
    try {
      setLoadingCommandes(true);
      const token = await getToken();

      const response = await apiFetch(
        `/clients/${clientId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) throw new Error("Erreur chargement détails client");

      const clientDetail = await response.json();
      const clientAvecVentes: Client = {
        ...clientDetail,
        ventes: clientDetail.ventes || [],
      };

      setClientSelectionne(clientAvecVentes);
      setCommandesClient(clientDetail.ventes || []);
    } catch (error) {
      console.error("Erreur chargement détails client:", error);
      Alert.alert("Erreur", "Erreur lors du chargement des détails du client");
    } finally {
      setLoadingCommandes(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await chargerClientsAvecFiltres();
    await chargerStatistiques();
  };

  // 🎯 RÉINITIALISER LE FORMULAIRE
  const reinitialiserFormulaire = () => {
    setFormData({
      nom: "",
      email: "",
      telephone: "",
      adresse: "",
      ville: "",
      statut: "actif",
      notes: "",
    });
  };

  // 🎯 OUVRIR MODAL CRÉATION
  const ouvrirModalCreation = () => {
    setClientSelectionne(null);
    setModeEdition(true);
    reinitialiserFormulaire();
    setShowModalClient(true);
    setOngletActif("informations");
  };

  // 🎯 OUVRIR MODAL ÉDITION
  const ouvrirModalEdition = (client: Client) => {
    setClientSelectionne(client);
    setModeEdition(true);
    setFormData({
      nom: client.nom,
      email: client.email,
      telephone: client.telephone || "",
      adresse: client.adresse || "",
      ville: client.ville || "",
      statut: client.statut,
      notes: client.notes || "",
    });
    setShowModalClient(true);
    setOngletActif("informations");
  };

  // 🎯 OUVRIR MODAL VISUALISATION
  const ouvrirModalVisualisation = async (client: Client) => {
    setClientSelectionne(client);
    setModeEdition(false);
    setShowModalClient(true);
    setOngletActif("informations");
    await chargerDetailsClient(client.id);
  };

  // 🎯 GESTION DES CHAMPS DU FORMULAIRE
  const handleInputChange = (field: keyof ClientFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // 🎯 CRÉATION D'UN NOUVEAU CLIENT
  const creerClient = async () => {
    try {
      setActionEnCours("creation");
      const token = await getToken();

      const response = await apiFetch("/clients", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erreur création client");
      }

      const result = await response.json();
      const nouveauClient = result.client || result;

      setClients((prev) => [...prev, nouveauClient]);
      chargerStatistiques();

      setShowModalClient(false);
      reinitialiserFormulaire();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Succès", "Client créé avec succès");
    } catch (error: any) {
      console.error("Erreur création client:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Erreur",
        error.message || "Erreur lors de la création du client"
      );
    } finally {
      setActionEnCours(null);
    }
  };

  // 🎯 MISE À JOUR D'UN CLIENT
  const mettreAJourClient = async () => {
    if (!clientSelectionne) return;

    try {
      setActionEnCours("modification");
      const token = await getToken();

      const response = await apiFetch(
        `/clients/${clientSelectionne.id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erreur modification client");
      }

      const result = await response.json();
      const clientModifie = result.client || result;

      setClients((prev) =>
        prev.map((client) =>
          client.id === clientSelectionne.id ? clientModifie : client
        )
      );

      setClientSelectionne(clientModifie);
      setModeEdition(false);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Succès", "Client modifié avec succès");
    } catch (error: any) {
      console.error("Erreur modification client:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Erreur",
        error.message || "Erreur lors de la modification du client"
      );
    } finally {
      setActionEnCours(null);
    }
  };

  // 🎯 SUPPRESSION D'UN CLIENT
  const supprimerClient = async () => {
    if (!clientSelectionne) return;

    try {
      setActionEnCours("suppression");
      const token = await getToken();

      const response = await apiFetch(
        `/clients/${clientSelectionne.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erreur suppression client");
      }

      setClients((prev) =>
        prev.filter((client) => client.id !== clientSelectionne.id)
      );

      setShowModalClient(false);
      setShowConfirmationSuppression(false);
      setClientSelectionne(null);

      chargerStatistiques();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Succès", "Client supprimé avec succès");
    } catch (error: any) {
      console.error("Erreur suppression client:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Erreur",
        error.message || "Erreur lors de la suppression du client"
      );
    } finally {
      setActionEnCours(null);
    }
  };

  // 🎯 PROMOUVOIR UN CLIENT VIP
  const promouvoirVip = async (client: Client) => {
    try {
      setActionEnCours(`promotion-${client.id}`);
      const token = await getToken();

      const response = await apiFetch(
        `/clients/${client.id}/promouvoir-vip`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erreur promotion VIP");
      }

      const result = await response.json();

      setClients((prev) =>
        prev.map((c) => (c.id === client.id ? { ...c, statut: "vip" } : c))
      );

      if (clientSelectionne && clientSelectionne.id === client.id) {
        setClientSelectionne({ ...clientSelectionne, statut: "vip" });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Succès", "Client promu VIP avec succès");
    } catch (error: any) {
      console.error("Erreur promotion VIP:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Erreur",
        error.message || "Erreur lors de la promotion du client"
      );
    } finally {
      setActionEnCours(null);
    }
  };

  // 🎯 RÉTROGRADER UN CLIENT VIP
  const retrograderVip = async (client: Client) => {
    try {
      setActionEnCours(`retrogradation-${client.id}`);
      const token = await getToken();

      const response = await apiFetch(
        `/clients/${client.id}/retrograder-vip`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erreur rétrogradation VIP");
      }

      const result = await response.json();

      setClients((prev) =>
        prev.map((c) => (c.id === client.id ? { ...c, statut: "actif" } : c))
      );

      if (clientSelectionne && clientSelectionne.id === client.id) {
        setClientSelectionne({ ...clientSelectionne, statut: "actif" });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Succès", "Client rétrogradé avec succès");
    } catch (error: any) {
      console.error("Erreur rétrogradation VIP:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Erreur",
        error.message || "Erreur lors de la rétrogradation du client"
      );
    } finally {
      setActionEnCours(null);
    }
  };

  // 🎯 EXPORTER LES CLIENTS
  const exporterClients = async () => {
    try {
      setActionEnCours("export");
      const token = await getToken();

      const params = new URLSearchParams();
      if (recherche) params.append("search", recherche);
      if (filtreStatut !== "tous") params.append("statut", filtreStatut);

      const response = await apiFetch(
        `/clients/export/data?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Erreur export clients");

      const data = await response.json();

      // Note: Pour l'export en React Native, vous pourriez utiliser expo-file-system
      // et expo-sharing pour sauvegarder et partager le fichier
      Alert.alert(
        "Info",
        "Export fonctionnel - Adaptation nécessaire pour React Native"
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      console.error("Erreur export clients:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erreur", "Erreur lors de l'export des clients");
    } finally {
      setActionEnCours(null);
    }
  };

  // 🎯 FORMATAGE PRIX
  const formatPrix = (prix: number) => {
    return new Intl.NumberFormat("fr-FR").format(prix) + " FCFA";
  };

  // 🎯 COMPOSANT CARD CLIENT
  const ClientCard = ({ client, index }: { client: Client; index: number }) => {
    return (
      <Animated.View
        style={[
          styles.clientCard,
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
          style={styles.clientCardInner}
          onPress={() => ouvrirModalVisualisation(client)}
          activeOpacity={0.9}
        >
          <View style={styles.clientCardHeader}>
            <View style={styles.clientInfo}>
              <View
                style={[
                  styles.clientAvatar,
                  client.statut === "vip"
                    ? styles.vipAvatar
                    : client.statut === "actif"
                      ? styles.actifAvatar
                      : styles.inactifAvatar,
                ]}
              >
                <Users size={20} color="#ffffff" />
              </View>
              <View style={styles.clientText}>
                <View style={styles.clientNameRow}>
                  <Text style={styles.clientName} numberOfLines={1}>
                    {client.nom}
                  </Text>
                  {client.statut === "vip" && (
                    <Crown size={16} color="#f59e0b" />
                  )}
                </View>
                <Text style={styles.clientEmail} numberOfLines={1}>
                  {client.email}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.statutBadge,
                client.statut === "vip"
                  ? styles.vipBadge
                  : client.statut === "actif"
                    ? styles.actifBadge
                    : styles.inactifBadge,
              ]}
            >
              <Text
                style={[
                  styles.statutBadgeText,
                  client.statut === "vip"
                    ? styles.vipBadgeText
                    : client.statut === "actif"
                      ? styles.actifBadgeText
                      : styles.inactifBadgeText,
                ]}
              >
                {client.statut === "vip" ? "VIP" : client.statut}
              </Text>
            </View>
          </View>

          <View style={styles.clientDetails}>
            <View style={styles.detailItem}>
              <Phone size={14} color="#64748b" />
              <Text style={styles.detailText}>{client.telephone}</Text>
            </View>

            {client.ville && (
              <View style={styles.detailItem}>
                <MapPin size={14} color="#64748b" />
                <Text style={styles.detailText}>{client.ville}</Text>
              </View>
            )}
          </View>

          <View style={styles.clientMetrics}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{client.nombre_commandes}</Text>
              <Text style={styles.metricLabel}>Commandes</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricValueGreen}>
                {client.total_achats >= 1000
                  ? `${(client.total_achats / 1000).toFixed(0)}K`
                  : client.total_achats.toLocaleString()}
              </Text>
              <Text style={styles.metricLabel}>FCFA</Text>
            </View>
          </View>

          {client.derniere_commande && (
            <View style={styles.lastOrder}>
              <Calendar size={12} color="#94a3b8" />
              <Text style={styles.lastOrderText}>
                Dernière commande:{" "}
                {new Date(client.derniere_commande.date).toLocaleDateString(
                  "fr-FR"
                )}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // 🎯 COMPOSANT CARD COMMANDE
  const CommandeCard = ({ commande }: { commande: Vente }) => {
    const getStatutColor = () => {
      switch (commande.statut) {
        case "livree":
          return "#22c55e";
        case "expediee":
          return "#3b82f6";
        case "confirmee":
          return "#f59e0b";
        case "en_attente":
          return "#f97316";
        default:
          return "#ef4444";
      }
    };

    const getStatutText = () => {
      switch (commande.statut) {
        case "livree":
          return "Livrée";
        case "expediee":
          return "Expédiée";
        case "confirmee":
          return "Confirmée";
        case "en_attente":
          return "En attente";
        default:
          return "Annulée";
      }
    };

    return (
      <View style={styles.commandeCard}>
        <View style={styles.commandeLeft}>
          <View
            style={[
              styles.commandeStatut,
              { backgroundColor: getStatutColor() },
            ]}
          />
          <View>
            <Text style={styles.commandeNumero}>
              Commande #{commande.numero_commande}
            </Text>
            <Text style={styles.commandeDate}>
              {new Date(commande.date_commande).toLocaleDateString("fr-FR")} •{" "}
              {commande.produits_count} produit(s)
            </Text>
          </View>
        </View>
        <View style={styles.commandeRight}>
          <Text style={styles.commandeMontant}>
            {commande.montant_total.toLocaleString()} FCFA
          </Text>
          <View
            style={[
              styles.commandeBadge,
              { backgroundColor: `${getStatutColor()}20` },
            ]}
          >
            <Text
              style={[styles.commandeBadgeText, { color: getStatutColor() }]}
            >
              {getStatutText()}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  // 🎯 STATISTIQUES RAPIDES
  const quickStats = [
    {
      label: "Total Clients",
      value: statsClients.total_clients,
      color: "#3b82f6",
      icon: Users,
    },
    {
      label: "Clients Actifs",
      value: statsClients.clients_actifs,
      color: "#22c55e",
      icon: Zap,
    },
    {
      label: "Clients VIP",
      value: statsClients.clients_vip,
      color: "#f59e0b",
      icon: Crown,
    },
    {
      label: "CA Total",
      value: statsClients.chiffre_affaires_total,
      color: "#8b5cf6",
      icon: DollarSign,
    },
    {
      label: "Commandes",
      value: statsClients.commandes_total,
      color: "#ec4899",
      icon: ShoppingCart,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Header */}
      <BlurView intensity={30} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <LinearGradient
              colors={["#3b82f6", "#8b5cf6"]}
              style={styles.headerLogo}
            >
              <Users size={24} color="#ffffff" />
            </LinearGradient>
            <View>
              <Text style={styles.headerTitle}>Gestion Clients</Text>
              <Text style={styles.headerSubtitle}>
                {pagination.total} clients • CRM avancé
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={exporterClients}
              disabled={actionEnCours === "export"}
            >
              {actionEnCours === "export" ? (
                <View style={styles.loadingSpinner} />
              ) : (
                <Download size={20} color="#ffffff" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={ouvrirModalCreation}
            >
              <UserPlus size={20} color="#ffffff" />
              <Text style={styles.primaryButtonText}>Nouveau</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>

      {/* Barre de Recherche et Filtres */}
      <Animated.View
        style={[
          styles.controlsContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideUpAnim }],
          },
        ]}
      >
        <BlurView intensity={10} style={styles.controlsCard}>
          <View style={styles.searchContainer}>
            <Search size={20} color="#94a3b8" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un client..."
              placeholderTextColor="#94a3b8"
              value={recherche}
              onChangeText={setRecherche}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filtersContainer}
          >
            {/* Filtre Statut */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Statut</Text>
              <View style={styles.filterSelect}>
                <Picker
                  selectedValue={filtreStatut}
                  onValueChange={(value) => setFiltreStatut(value as any)}
                  style={styles.picker}
                >
                  <Picker.Item label="Tous les statuts" value="tous" />
                  <Picker.Item label="Actifs" value="actif" />
                  <Picker.Item label="Inactifs" value="inactif" />
                  <Picker.Item label="VIP" value="vip" />
                </Picker>
              </View>
            </View>
          </ScrollView>
        </BlurView>
      </Animated.View>

      {/* Statistiques Rapides */}
      <Animated.View
        style={[
          styles.statsContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideUpAnim }],
          },
        ]}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {quickStats.map((stat, index) => (
            <BlurView key={stat.label} intensity={10} style={styles.statCard}>
              <View style={styles.statContent}>
                <View>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                  <Text style={[styles.statValue, { color: stat.color }]}>
                    {isLoading
                      ? "-"
                      : stat.label === "CA Total"
                        ? stat.value >= 1000000
                          ? `${(stat.value / 1000000).toFixed(1)}M`
                          : `${(stat.value / 1000).toFixed(0)}K`
                        : stat.value}
                  </Text>
                  {stat.label === "Total Clients" &&
                    statsClients.nouveaux_clients_mois && (
                      <Text style={styles.statTrend}>
                        +{statsClients.nouveaux_clients_mois} ce mois
                      </Text>
                    )}
                </View>
                <View
                  style={[
                    styles.statIconContainer,
                    { backgroundColor: `${stat.color}20` },
                  ]}
                >
                  <stat.icon size={20} color={stat.color} />
                </View>
              </View>
            </BlurView>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Liste des Clients */}
      <Animated.View
        style={[
          styles.clientsContainer,
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
              tintColor="#f97316"
              colors={["#f97316"]}
            />
          }
        >
          {isLoading ? (
            // Skeleton Loading
            Array.from({ length: 6 }).map((_, index) => (
              <View key={index} style={styles.skeletonCard}>
                <View style={styles.skeletonHeader}>
                  <View style={styles.skeletonAvatar} />
                  <View style={styles.skeletonText}>
                    <View style={styles.skeletonLine} />
                    <View style={[styles.skeletonLine, { width: "60%" }]} />
                  </View>
                  <View style={styles.skeletonBadge} />
                </View>
                <View style={styles.skeletonDetails}>
                  <View style={[styles.skeletonLine, { width: "70%" }]} />
                  <View style={[styles.skeletonLine, { width: "40%" }]} />
                </View>
                <View style={styles.skeletonMetrics}>
                  <View style={[styles.skeletonLine, { width: 40 }]} />
                  <View style={styles.skeletonDivider} />
                  <View style={[styles.skeletonLine, { width: 60 }]} />
                </View>
              </View>
            ))
          ) : clients.length > 0 ? (
            clients.map((client, index) => (
              <ClientCard key={client.id} client={client} index={index} />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Users size={64} color="#94a3b8" />
              <Text style={styles.emptyStateTitle}>Aucun client trouvé</Text>
              <Text style={styles.emptyStateText}>
                Aucun client ne correspond à vos critères de recherche.
              </Text>
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={ouvrirModalCreation}
              >
                <UserPlus size={20} color="#ffffff" />
                <Text style={styles.emptyStateButtonText}>
                  Créer le premier client
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Pagination */}
          {!isLoading && pagination.last_page > 1 && (
            <View style={styles.pagination}>
              <Text style={styles.paginationInfo}>
                Page {pagination.current_page} sur {pagination.last_page}
              </Text>
              <View style={styles.paginationButtons}>
                <TouchableOpacity
                  style={[
                    styles.paginationButton,
                    pagination.current_page === 1 &&
                      styles.paginationButtonDisabled,
                  ]}
                  onPress={() =>
                    chargerClientsAvecFiltres(pagination.current_page - 1)
                  }
                  disabled={pagination.current_page === 1}
                >
                  <ChevronLeft
                    size={20}
                    color={
                      pagination.current_page === 1 ? "#94a3b8" : "#ffffff"
                    }
                  />
                </TouchableOpacity>

                {Array.from(
                  { length: Math.min(5, pagination.last_page) },
                  (_, i) => {
                    let pageNum;
                    if (pagination.last_page <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.current_page <= 3) {
                      pageNum = i + 1;
                    } else if (
                      pagination.current_page >=
                      pagination.last_page - 2
                    ) {
                      pageNum = pagination.last_page - 4 + i;
                    } else {
                      pageNum = pagination.current_page - 2 + i;
                    }

                    return (
                      <TouchableOpacity
                        key={pageNum}
                        style={[
                          styles.paginationButton,
                          pagination.current_page === pageNum &&
                            styles.paginationButtonActive,
                        ]}
                        onPress={() => chargerClientsAvecFiltres(pageNum)}
                      >
                        <Text
                          style={[
                            styles.paginationButtonText,
                            pagination.current_page === pageNum &&
                              styles.paginationButtonTextActive,
                          ]}
                        >
                          {pageNum}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                )}

                <TouchableOpacity
                  style={[
                    styles.paginationButton,
                    pagination.current_page === pagination.last_page &&
                      styles.paginationButtonDisabled,
                  ]}
                  onPress={() =>
                    chargerClientsAvecFiltres(pagination.current_page + 1)
                  }
                  disabled={pagination.current_page === pagination.last_page}
                >
                  <ChevronRight
                    size={20}
                    color={
                      pagination.current_page === pagination.last_page
                        ? "#94a3b8"
                        : "#ffffff"
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* Modal Détail Client */}
      <Modal
        visible={showModalClient}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowModalClient(false);
          setModeEdition(false);
          setClientSelectionne(null);
          setCommandesClient([]);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Header Modal */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowModalClient(false);
                setModeEdition(false);
                setClientSelectionne(null);
                setCommandesClient([]);
              }}
              style={styles.modalCloseButton}
              disabled={actionEnCours !== null}
            >
              <X size={24} color="#64748b" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {clientSelectionne ? clientSelectionne.nom : "Nouveau Client"}
            </Text>
            {clientSelectionne && !modeEdition && (
              <TouchableOpacity
                style={styles.modalEditButton}
                onPress={() => ouvrirModalEdition(clientSelectionne)}
                disabled={actionEnCours !== null}
              >
                <Edit size={20} color="#3b82f6" />
              </TouchableOpacity>
            )}
          </View>

          {/* Tabs Navigation */}
          {!modeEdition && clientSelectionne && (
            <View style={styles.tabsContainer}>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  ongletActif === "informations" && styles.tabButtonActive,
                ]}
                onPress={() => setOngletActif("informations")}
              >
                <Text
                  style={[
                    styles.tabText,
                    ongletActif === "informations" && styles.tabTextActive,
                  ]}
                >
                  Informations
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  ongletActif === "commandes" && styles.tabButtonActive,
                ]}
                onPress={() => setOngletActif("commandes")}
              >
                <Text
                  style={[
                    styles.tabText,
                    ongletActif === "commandes" && styles.tabTextActive,
                  ]}
                >
                  Commandes ({commandesClient.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  ongletActif === "statistiques" && styles.tabButtonActive,
                ]}
                onPress={() => setOngletActif("statistiques")}
              >
                <Text
                  style={[
                    styles.tabText,
                    ongletActif === "statistiques" && styles.tabTextActive,
                  ]}
                >
                  Statistiques
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Contenu Modal */}
          <ScrollView style={styles.modalContent}>
            {modeEdition ? (
              // MODE ÉDITION/CRÉATION
              <View style={styles.formContainer}>
                <Text style={styles.formTitle}>
                  {clientSelectionne ? "Modifier le client" : "Nouveau Client"}
                </Text>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Nom complet *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Koffi Mensah"
                    value={formData.nom}
                    onChangeText={(text) => handleInputChange("nom", text)}
                    editable={actionEnCours === null}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Email *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="koffi.mensah@email.com"
                    value={formData.email}
                    onChangeText={(text) => handleInputChange("email", text)}
                    keyboardType="email-address"
                    editable={actionEnCours === null}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Téléphone</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="+229 01 02 03 04"
                    value={formData.telephone}
                    onChangeText={(text) =>
                      handleInputChange("telephone", text)
                    }
                    keyboardType="phone-pad"
                    editable={actionEnCours === null}
                  />
                </View>

                <View style={styles.rowGroup}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>Ville</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Cotonou"
                      value={formData.ville}
                      onChangeText={(text) => handleInputChange("ville", text)}
                      editable={actionEnCours === null}
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>Statut</Text>
                    <View style={styles.formSelect}>
                      <Picker
                        selectedValue={formData.statut}
                        onValueChange={(value) =>
                          handleInputChange("statut", value)
                        }
                        style={styles.picker}
                        enabled={actionEnCours === null}
                      >
                        <Picker.Item label="Actif" value="actif" />
                        <Picker.Item label="Inactif" value="inactif" />
                        <Picker.Item label="VIP" value="vip" />
                      </Picker>
                    </View>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Adresse</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="123 Rue du Commerce"
                    value={formData.adresse}
                    onChangeText={(text) => handleInputChange("adresse", text)}
                    editable={actionEnCours === null}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Notes</Text>
                  <TextInput
                    style={[styles.formInput, styles.textArea]}
                    placeholder="Notes sur le client..."
                    value={formData.notes}
                    onChangeText={(text) => handleInputChange("notes", text)}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    editable={actionEnCours === null}
                  />
                </View>

                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={[styles.formButton, styles.formButtonPrimary]}
                    onPress={
                      clientSelectionne ? mettreAJourClient : creerClient
                    }
                    disabled={
                      actionEnCours !== null || !formData.nom || !formData.email
                    }
                  >
                    {actionEnCours ? (
                      <View style={styles.formButtonLoading}>
                        <View style={styles.loadingSpinnerWhite} />
                        <Text style={styles.formButtonText}>
                          {clientSelectionne
                            ? "Modification..."
                            : "Création..."}
                        </Text>
                      </View>
                    ) : (
                      <>
                        <Save size={20} color="#ffffff" />
                        <Text style={styles.formButtonText}>
                          {clientSelectionne
                            ? "Enregistrer"
                            : "Créer le client"}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.formButton, styles.formButtonSecondary]}
                    onPress={() => {
                      if (clientSelectionne) {
                        setModeEdition(false);
                      } else {
                        setShowModalClient(false);
                      }
                    }}
                    disabled={actionEnCours !== null}
                  >
                    <Text style={styles.formButtonSecondaryText}>Annuler</Text>
                  </TouchableOpacity>
                </View>

                {clientSelectionne && (
                  <View style={styles.formActions}>
                    <TouchableOpacity
                      style={[styles.formButton, styles.formButtonDanger]}
                      onPress={() => {
                        setModeEdition(false);
                        setShowConfirmationSuppression(true);
                      }}
                      disabled={actionEnCours !== null}
                    >
                      <Trash2 size={20} color="#ffffff" />
                      <Text style={styles.formButtonText}>
                        Supprimer le client
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : clientSelectionne ? (
              // MODE VISUALISATION
              <>
                {ongletActif === "informations" && (
                  <View style={styles.detailsContainer}>
                    {/* En-tête avec statut */}
                    <View style={styles.detailHeader}>
                      <View
                        style={[
                          styles.detailAvatar,
                          clientSelectionne.statut === "vip"
                            ? styles.vipAvatar
                            : clientSelectionne.statut === "actif"
                              ? styles.actifAvatar
                              : styles.inactifAvatar,
                        ]}
                      >
                        <Users size={28} color="#ffffff" />
                      </View>
                      <View style={styles.detailHeaderInfo}>
                        <View style={styles.detailNameRow}>
                          <Text style={styles.detailName}>
                            {clientSelectionne.nom}
                          </Text>
                          {clientSelectionne.statut === "vip" && (
                            <Crown size={20} color="#f59e0b" />
                          )}
                        </View>
                        <Text style={styles.detailEmail}>
                          {clientSelectionne.email}
                        </Text>
                        <View
                          style={[
                            styles.detailStatutBadge,
                            clientSelectionne.statut === "vip"
                              ? styles.vipBadge
                              : clientSelectionne.statut === "actif"
                                ? styles.actifBadge
                                : styles.inactifBadge,
                          ]}
                        >
                          <Text style={styles.detailStatutText}>
                            {clientSelectionne.statut === "vip"
                              ? "CLIENT VIP"
                              : `CLIENT ${clientSelectionne.statut.toUpperCase()}`}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Actions rapides */}
                    <View style={styles.quickActions}>
                      {clientSelectionne.statut === "vip" ? (
                        <TouchableOpacity
                          style={[
                            styles.quickActionButton,
                            styles.quickActionVip,
                          ]}
                          onPress={() => retrograderVip(clientSelectionne)}
                          disabled={
                            actionEnCours ===
                            `retrogradation-${clientSelectionne.id}`
                          }
                        >
                          <Crown size={20} color="#f59e0b" />
                          <Text style={styles.quickActionText}>
                            {actionEnCours ===
                            `retrogradation-${clientSelectionne.id}`
                              ? "Rétrogradation..."
                              : "Rétrograder VIP"}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[
                            styles.quickActionButton,
                            styles.quickActionPromote,
                          ]}
                          onPress={() => promouvoirVip(clientSelectionne)}
                          disabled={
                            actionEnCours ===
                            `promotion-${clientSelectionne.id}`
                          }
                        >
                          <Crown size={20} color="#ffffff" />
                          <Text style={styles.quickActionText}>
                            {actionEnCours ===
                            `promotion-${clientSelectionne.id}`
                              ? "Promotion..."
                              : "Promouvoir VIP"}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Informations de contact */}
                    <View style={styles.infoSection}>
                      <Text style={styles.sectionTitle}>
                        Informations de Contact
                      </Text>

                      <View style={styles.infoGrid}>
                        <View style={styles.infoItem}>
                          <Mail size={20} color="#64748b" />
                          <View style={styles.infoContent}>
                            <Text style={styles.infoLabel}>Email</Text>
                            <Text style={styles.infoValue}>
                              {clientSelectionne.email}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.infoItem}>
                          <Phone size={20} color="#64748b" />
                          <View style={styles.infoContent}>
                            <Text style={styles.infoLabel}>Téléphone</Text>
                            <Text style={styles.infoValue}>
                              {clientSelectionne.telephone}
                            </Text>
                          </View>
                        </View>

                        {clientSelectionne.ville && (
                          <View style={styles.infoItem}>
                            <MapPin size={20} color="#64748b" />
                            <View style={styles.infoContent}>
                              <Text style={styles.infoLabel}>Ville</Text>
                              <Text style={styles.infoValue}>
                                {clientSelectionne.ville}
                              </Text>
                            </View>
                          </View>
                        )}

                        <View style={styles.infoItem}>
                          <Calendar size={20} color="#64748b" />
                          <View style={styles.infoContent}>
                            <Text style={styles.infoLabel}>
                              Date d'inscription
                            </Text>
                            <Text style={styles.infoValue}>
                              {new Date(
                                clientSelectionne.created_at
                              ).toLocaleDateString("fr-FR")}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {clientSelectionne.adresse && (
                        <View style={styles.infoItem}>
                          <MapPin size={20} color="#64748b" />
                          <View style={styles.infoContent}>
                            <Text style={styles.infoLabel}>Adresse</Text>
                            <Text style={styles.infoValue}>
                              {clientSelectionne.adresse}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>

                    {/* Notes */}
                    {clientSelectionne.notes && (
                      <View style={styles.notesSection}>
                        <Text style={styles.sectionTitle}>Notes</Text>
                        <Text style={styles.notesText}>
                          {clientSelectionne.notes}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {ongletActif === "commandes" && (
                  <View style={styles.commandesContainer}>
                    <Text style={styles.sectionTitle}>
                      Historique des Commandes
                    </Text>
                    <Text style={styles.sectionSubtitle}>
                      {commandesClient.length} commande(s) trouvée(s)
                    </Text>

                    {loadingCommandes ? (
                      <View style={styles.loadingCommandes}>
                        {Array.from({ length: 3 }).map((_, index) => (
                          <View key={index} style={styles.skeletonCommande}>
                            <View style={styles.skeletonCommandeLeft}>
                              <View style={styles.skeletonStatut} />
                              <View>
                                <View
                                  style={[styles.skeletonLine, { width: 120 }]}
                                />
                                <View
                                  style={[styles.skeletonLine, { width: 80 }]}
                                />
                              </View>
                            </View>
                            <View style={styles.skeletonCommandeRight}>
                              <View
                                style={[styles.skeletonLine, { width: 80 }]}
                              />
                              <View
                                style={[styles.skeletonLine, { width: 60 }]}
                              />
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : commandesClient.length > 0 ? (
                      <View style={styles.commandesList}>
                        {commandesClient.map((commande) => (
                          <CommandeCard key={commande.id} commande={commande} />
                        ))}
                      </View>
                    ) : (
                      <View style={styles.emptyCommandes}>
                        <ShoppingCart size={48} color="#94a3b8" />
                        <Text style={styles.emptyCommandesText}>
                          Aucune commande trouvée pour ce client
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {ongletActif === "statistiques" && (
                  <View style={styles.statsDetailContainer}>
                    <Text style={styles.sectionTitle}>
                      Statistiques du Client
                    </Text>

                    <View style={styles.clientStatsGrid}>
                      <View style={styles.clientStatCard}>
                        <DollarSign size={24} color="#22c55e" />
                        <Text style={styles.clientStatValue}>
                          {formatPrix(clientSelectionne.total_achats)}
                        </Text>
                        <Text style={styles.clientStatLabel}>
                          Chiffre d'Affaires
                        </Text>
                      </View>

                      <View style={styles.clientStatCard}>
                        <ShoppingCart size={24} color="#3b82f6" />
                        <Text style={styles.clientStatValue}>
                          {clientSelectionne.nombre_commandes}
                        </Text>
                        <Text style={styles.clientStatLabel}>
                          Commandes Total
                        </Text>
                      </View>

                      <View style={styles.clientStatCard}>
                        <TrendingUp size={24} color="#8b5cf6" />
                        <Text style={styles.clientStatValue}>
                          {clientSelectionne.nombre_commandes > 0
                            ? formatPrix(
                                Math.round(
                                  clientSelectionne.total_achats /
                                    clientSelectionne.nombre_commandes
                                )
                              )
                            : "0 FCFA"}
                        </Text>
                        <Text style={styles.clientStatLabel}>Panier Moyen</Text>
                      </View>

                      <View style={styles.clientStatCard}>
                        <Calendar size={24} color="#f59e0b" />
                        <Text style={styles.clientStatValue}>
                          {commandesClient.length}
                        </Text>
                        <Text style={styles.clientStatLabel}>
                          Commandes Récentes
                        </Text>
                      </View>
                    </View>

                    {/* Dernières commandes */}
                    {commandesClient.length > 0 && (
                      <View style={styles.recentCommandes}>
                        <Text style={styles.sectionTitle}>
                          10 Dernières Commandes
                        </Text>
                        <View style={styles.recentCommandesList}>
                          {commandesClient.slice(0, 10).map((commande) => (
                            <View
                              key={commande.id}
                              style={styles.recentCommande}
                            >
                              <View>
                                <Text style={styles.recentCommandeNumero}>
                                  #{commande.numero_commande}
                                </Text>
                                <Text style={styles.recentCommandeDate}>
                                  {new Date(
                                    commande.date_commande
                                  ).toLocaleDateString("fr-FR")}
                                </Text>
                              </View>
                              <View style={styles.recentCommandeRight}>
                                <Text style={styles.recentCommandeMontant}>
                                  {commande.montant_total.toLocaleString()} FCFA
                                </Text>
                                <View
                                  style={[
                                    styles.recentCommandeStatut,
                                    {
                                      backgroundColor:
                                        commande.statut === "livree"
                                          ? "#dcfce7"
                                          : commande.statut === "expediee"
                                            ? "#dbeafe"
                                            : "#fef3c7",
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.recentCommandeStatutText,
                                      {
                                        color:
                                          commande.statut === "livree"
                                            ? "#16a34a"
                                            : commande.statut === "expediee"
                                              ? "#2563eb"
                                              : "#d97706",
                                      },
                                    ]}
                                  >
                                    {commande.statut}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal Confirmation Suppression */}
      <Modal
        visible={showConfirmationSuppression}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmationSuppression(false)}
      >
        <View style={styles.alertOverlay}>
          <BlurView intensity={20} style={styles.alertContainer}>
            <View style={styles.alertIcon}>
              <AlertTriangle size={32} color="#ef4444" />
            </View>
            <Text style={styles.alertTitle}>Confirmer la suppression</Text>
            <Text style={styles.alertMessage}>
              Êtes-vous sûr de vouloir supprimer le client{" "}
              {clientSelectionne?.nom} ?
            </Text>
            <Text style={styles.alertWarning}>
              Cette action est irréversible.
            </Text>

            <View style={styles.alertButtons}>
              <TouchableOpacity
                style={[styles.alertButton, styles.alertButtonCancel]}
                onPress={() => setShowConfirmationSuppression(false)}
                disabled={actionEnCours !== null}
              >
                <Text style={styles.alertButtonCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.alertButton, styles.alertButtonConfirm]}
                onPress={supprimerClient}
                disabled={actionEnCours !== null}
              >
                {actionEnCours === "suppression" ? (
                  <View style={styles.formButtonLoading}>
                    <View style={styles.loadingSpinnerWhite} />
                    <Text style={styles.alertButtonConfirmText}>
                      Suppression...
                    </Text>
                  </View>
                ) : (
                  <>
                    <Trash2 size={20} color="#ffffff" />
                    <Text style={styles.alertButtonConfirmText}>Supprimer</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>
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
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginRight: 8,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3b82f6",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    marginLeft: 8,
  },
  loadingSpinner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#ffffff",
    borderTopColor: "transparent",
  },
  loadingSpinnerWhite: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#ffffff",
    borderTopColor: "transparent",
    marginRight: 8,
  },
  // Contrôles
  controlsContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  controlsCard: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 16,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 16,
    height: 44,
  },
  filtersContainer: {
    flexDirection: "row",
  },
  filterGroup: {
    minWidth: 150,
  },
  filterLabel: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 6,
  },
  filterSelect: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  picker: {
    color: "#ffffff",
    fontSize: 14,
  },
  // Statistiques
  statsContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  statCard: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 16,
    marginRight: 12,
    minWidth: 150,
  },
  statContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
  },
  statTrend: {
    fontSize: 11,
    color: "#22c55e",
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  // Clients
  clientsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
  },
  // Client Card
  clientCard: {
    marginBottom: 16,
  },
  clientCardInner: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 16,
  },
  clientCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  clientInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  vipAvatar: {
    backgroundColor: "#f59e0b",
  },
  actifAvatar: {
    backgroundColor: "#22c55e",
  },
  inactifAvatar: {
    backgroundColor: "#64748b",
  },
  clientText: {
    flex: 1,
  },
  clientNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  clientName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ffffff",
    marginRight: 8,
    flex: 1,
  },
  clientEmail: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  statutBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  vipBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderColor: "rgba(245, 158, 11, 0.2)",
  },
  actifBadge: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderColor: "rgba(34, 197, 94, 0.2)",
  },
  inactifBadge: {
    backgroundColor: "rgba(100, 116, 139, 0.1)",
    borderColor: "rgba(100, 116, 139, 0.2)",
  },
  statutBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  vipBadgeText: {
    color: "#f59e0b",
  },
  actifBadgeText: {
    color: "#22c55e",
  },
  inactifBadgeText: {
    color: "#64748b",
  },
  clientDetails: {
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: "#94a3b8",
    marginLeft: 8,
  },
  clientMetrics: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  metricValueGreen: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#22c55e",
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 11,
    color: "#94a3b8",
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginHorizontal: 16,
  },
  lastOrder: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  lastOrderText: {
    fontSize: 12,
    color: "#94a3b8",
    marginLeft: 6,
  },
  // Skeleton
  skeletonCard: {
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
    marginBottom: 16,
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginRight: 12,
  },
  skeletonText: {
    flex: 1,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 6,
    marginBottom: 6,
  },
  skeletonBadge: {
    width: 60,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
  },
  skeletonDetails: {
    marginBottom: 16,
  },
  skeletonMetrics: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  skeletonDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginHorizontal: 16,
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
    paddingHorizontal: 40,
    marginBottom: 16,
  },
  emptyStateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3b82f6",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyStateButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    marginLeft: 8,
  },
  // Pagination
  pagination: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  paginationInfo: {
    fontSize: 12,
    color: "#94a3b8",
  },
  paginationButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  paginationButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
  },
  paginationButtonActive: {
    backgroundColor: "#3b82f6",
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  paginationButtonTextActive: {
    color: "#ffffff",
  },
  // Modals
  modalContainer: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
  },
  modalEditButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
  },
  // Tabs
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#3b82f6",
  },
  tabText: {
    fontSize: 14,
    color: "#94a3b8",
    fontWeight: "500",
  },
  tabTextActive: {
    color: "#3b82f6",
    fontWeight: "600",
  },
  // Form
  formContainer: {
    padding: 20,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#ffffff",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  rowGroup: {
    flexDirection: "row",
    gap: 12,
  },
  formSelect: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  formActions: {
    marginTop: 24,
  },
  formButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  formButtonLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  formButtonPrimary: {
    backgroundColor: "#3b82f6",
  },
  formButtonSecondary: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  formButtonDanger: {
    backgroundColor: "#ef4444",
  },
  formButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    marginLeft: 8,
    fontSize: 16,
  },
  formButtonSecondaryText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 16,
  },
  // Details
  modalContent: {
    flex: 1,
  },
  detailsContainer: {
    padding: 20,
  },
  detailHeader: {
    flexDirection: "row",
    marginBottom: 24,
  },
  detailAvatar: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  detailHeaderInfo: {
    flex: 1,
  },
  detailNameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  detailName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
    marginRight: 8,
    flex: 1,
  },
  detailEmail: {
    fontSize: 14,
    color: "#94a3b8",
    marginBottom: 8,
  },
  detailStatutBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  detailStatutText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
  },
  quickActions: {
    marginBottom: 24,
  },
  quickActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
  },
  quickActionPromote: {
    backgroundColor: "#f59e0b",
  },
  quickActionVip: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  quickActionText: {
    color: "#ffffff",
    fontWeight: "600",
    marginLeft: 8,
    fontSize: 16,
  },
  infoSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 16,
  },
  infoGrid: {
    gap: 16,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: "#ffffff",
  },
  notesSection: {
    marginBottom: 24,
  },
  notesText: {
    fontSize: 16,
    color: "#94a3b8",
    lineHeight: 24,
  },
  // Commandes
  commandesContainer: {
    padding: 20,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#94a3b8",
    marginBottom: 16,
  },
  loadingCommandes: {
    gap: 12,
  },
  skeletonCommande: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  skeletonCommandeLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  skeletonStatut: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginRight: 12,
  },
  skeletonCommandeRight: {
    alignItems: "flex-end",
  },
  commandesList: {
    gap: 12,
  },
  commandeCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  commandeLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  commandeStatut: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  commandeNumero: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 4,
  },
  commandeDate: {
    fontSize: 12,
    color: "#94a3b8",
  },
  commandeRight: {
    alignItems: "flex-end",
  },
  commandeMontant: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#22c55e",
    marginBottom: 8,
  },
  commandeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  commandeBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  emptyCommandes: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyCommandesText: {
    fontSize: 16,
    color: "#94a3b8",
    marginTop: 16,
  },
  // Statistiques détaillées
  statsDetailContainer: {
    padding: 20,
  },
  clientStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  clientStatCard: {
    width: (width - 60) / 2,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 16,
    alignItems: "center",
  },
  clientStatValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
    marginVertical: 8,
  },
  clientStatLabel: {
    fontSize: 12,
    color: "#94a3b8",
  },
  recentCommandes: {
    marginBottom: 24,
  },
  recentCommandesList: {
    gap: 8,
  },
  recentCommande: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  recentCommandeNumero: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 4,
  },
  recentCommandeDate: {
    fontSize: 12,
    color: "#94a3b8",
  },
  recentCommandeRight: {
    alignItems: "flex-end",
  },
  recentCommandeMontant: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#22c55e",
    marginBottom: 4,
  },
  recentCommandeStatut: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  recentCommandeStatutText: {
    fontSize: 10,
    fontWeight: "600",
  },
  // Alertes
  alertOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: 20,
  },
  alertContainer: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 16,
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
  },
  alertIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 8,
    textAlign: "center",
  },
  alertMessage: {
    fontSize: 16,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 24,
  },
  alertWarning: {
    fontSize: 14,
    color: "#f97316",
    marginBottom: 24,
    textAlign: "center",
  },
  alertButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  alertButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
  },
  alertButtonCancel: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  alertButtonConfirm: {
    backgroundColor: "#ef4444",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  alertButtonCancelText: {
    color: "#ffffff",
    fontWeight: "600",
    textAlign: "center",
  },
  alertButtonConfirmText: {
    color: "#ffffff",
    fontWeight: "600",
    marginLeft: 8,
  },
});
