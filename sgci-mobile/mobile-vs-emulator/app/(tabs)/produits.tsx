import { Picker } from "@react-native-picker/picker";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import {
    AlertTriangle,
    BarChart,
    BarChart3,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Edit,
    Eye,
    Grid,
    Hash,
    Image as ImageIcon,
    Link,
    List,
    MoreVertical,
    Package,
    Plus,
    Save,
    Search,
    Tag,
    Trash2,
    X
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Dimensions,
    Easing,
    Image,
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
    View
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { apiFetch } from "@/lib/api-client";

const { width, height } = Dimensions.get("window");

// Types pour les données réelles
interface Produit {
  id: number;
  nom: string;
  description: string;
  prix: number;
  quantite_stock: number;
  seuil_alerte: number;
  categorie_id: number;
  est_perissable: boolean;
  unite_mesure: string;
  created_at: string;
  image_url?: string;
  images?: string[];
  categorie?: {
    id: number;
    nom: string;
    couleur: string;
  };
}

interface Categorie {
  id: number;
  nom: string;
  description?: string;
  couleur: string;
  icone?: string;
  produits_count?: number;
}

interface PaginationInfo {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

// 🎯 BIBLIOTHÈQUE D'IMAGES PAR DÉFAUT
const defaultImages = {
  electronique: [
    "https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=400&h=300&fit=crop",
  ],
  alimentation: [
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&h=300&fit=crop",
  ],
  vetements: [
    "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400&h=300&fit=crop",
  ],
  maison: [
    "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=400&h=300&fit=crop",
  ],
  default: [
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=300&fit=crop",
  ],
};

export default function ProduitsScreen() {
  const { user } = useAuth();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [rechercheTerm, setRechercheTerm] = useState("");
  const [filtreCategorie, setFiltreCategorie] = useState<string>("all");
  const [filtreStock, setFiltreStock] = useState<string>("all");
  const [vue, setVue] = useState<"grid" | "list">("grid");
  const [produitSelectionne, setProduitSelectionne] = useState<Produit | null>(
    null
  );
  const [showDetails, setShowDetails] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProduit, setEditingProduit] = useState<Produit | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [produitToDelete, setProduitToDelete] = useState<Produit | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
    from: 0,
    to: 0,
  });
  const [formData, setFormData] = useState({
    nom: "",
    description: "",
    prix: "",
    quantite_stock: "",
    seuil_alerte: "",
    categorie_id: "",
    est_perissable: false,
    unite_mesure: "unité",
    image_url: "",
    images: [] as string[],
  });

  // 🎯 ÉTATS POUR LA GESTION DES CATÉGORIES
  const [showCategorieForm, setShowCategorieForm] = useState(false);
  const [editingCategorie, setEditingCategorie] = useState<Categorie | null>(
    null
  );
  const [categorieToDelete, setCategorieToDelete] = useState<Categorie | null>(
    null
  );
  const [showDeleteCategorieDialog, setShowDeleteCategorieDialog] =
    useState(false);
  const [categorieForm, setCategorieForm] = useState({
    nom: "",
    description: "",
    couleur: "#3b82f6",
    icone: "Package",
  });

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

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

  // 🎯 DEBOUNCE RECHERCHE
  useEffect(() => {
    const timer = setTimeout(() => {
      setRechercheTerm(recherche);
      setPagination((prev) => ({ ...prev, current_page: 1 }));
    }, 500);
    return () => clearTimeout(timer);
  }, [recherche]);

  // 🎯 CHARGEMENT DES DONNÉES
  useEffect(() => {
    chargerDonnees();
    chargerStats();
  }, [rechercheTerm, filtreCategorie, filtreStock, pagination.current_page]);

  const chargerDonnees = async () => {
    try {
      setIsLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");

      // Construction des paramètres
      const params = new URLSearchParams();
      params.append("page", pagination.current_page.toString());

      if (rechercheTerm) params.append("search", rechercheTerm);
      if (filtreCategorie !== "all")
        params.append("categorie_id", filtreCategorie);
      if (filtreStock !== "all") params.append("statut_stock", filtreStock);

      // Charger les produits
      const produitsResponse = await apiFetch(
        `/produits?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!produitsResponse.ok)
        throw new Error("Erreur lors du chargement des produits");

      const produitsData = await produitsResponse.json();

      if (produitsData.data) {
        setProduits(produitsData.data);
        setPagination(produitsData);
      } else {
        setProduits(produitsData);
      }

      // Charger les catégories
      const categoriesResponse = await apiFetch(
        "/categories",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!categoriesResponse.ok)
        throw new Error("Erreur lors du chargement des catégories");

      const categoriesData = await categoriesResponse.json();
      setCategories(categoriesData.data || categoriesData);
    } catch (error) {
      console.error("Erreur chargement données:", error);
      Alert.alert("Erreur", "Erreur lors du chargement des données");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const chargerStats = async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      const response = await apiFetch(
        "/produits/statistiques",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (response.ok) {
        const statsData = await response.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error("Erreur chargement stats:", error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await chargerDonnees();
  };

  // 🎯 GESTION PRODUITS (CRUD)
  const handleCreateProduit = async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      const response = await apiFetch("/produits", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          ...formData,
          prix: parseFloat(formData.prix),
          quantite_stock: parseInt(formData.quantite_stock),
          seuil_alerte: parseInt(formData.seuil_alerte),
          categorie_id: parseInt(formData.categorie_id),
          image_url: formData.image_url || null,
          images: formData.images,
        }),
      });

      if (!response.ok) throw new Error("Erreur lors de la création");

      const newProduit = await response.json();
      setProduits((prev) => [newProduit, ...prev]);
      setShowForm(false);
      resetForm();
      Alert.alert("Succès", "Produit créé avec succès");
      chargerStats();
    } catch (error) {
      Alert.alert("Erreur", "Erreur lors de la création du produit");
    }
  };

  const handleUpdateProduit = async () => {
    if (!editingProduit) return;

    try {
      const token = await SecureStore.getItemAsync("auth_token");
      const response = await apiFetch(
        `/produits/${editingProduit.id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            ...formData,
            prix: parseFloat(formData.prix),
            quantite_stock: parseInt(formData.quantite_stock),
            seuil_alerte: parseInt(formData.seuil_alerte),
            categorie_id: parseInt(formData.categorie_id),
            image_url: formData.image_url || null,
            images: formData.images,
          }),
        }
      );

      if (!response.ok) throw new Error("Erreur lors de la modification");

      const updatedProduit = await response.json();
      setProduits((prev) =>
        prev.map((p) => (p.id === editingProduit.id ? updatedProduit : p))
      );
      setShowForm(false);
      setEditingProduit(null);
      resetForm();
      Alert.alert("Succès", "Produit modifié avec succès");
      chargerStats();
    } catch (error) {
      Alert.alert("Erreur", "Erreur lors de la modification du produit");
    }
  };

  const handleDeleteProduit = async () => {
    if (!produitToDelete) return;

    try {
      const token = await SecureStore.getItemAsync("auth_token");
      const response = await apiFetch(
        `/produits/${produitToDelete.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) throw new Error("Erreur lors de la suppression");

      setProduits((prev) => prev.filter((p) => p.id !== produitToDelete.id));
      setShowDeleteDialog(false);
      setProduitToDelete(null);
      Alert.alert("Succès", "Produit supprimé avec succès");
      chargerStats();
    } catch (error) {
      Alert.alert("Erreur", "Erreur lors de la suppression du produit");
    }
  };

  const resetForm = () => {
    setFormData({
      nom: "",
      description: "",
      prix: "",
      quantite_stock: "",
      seuil_alerte: "",
      categorie_id: "",
      est_perissable: false,
      unite_mesure: "unité",
      image_url: "",
      images: [],
    });
    setEditingProduit(null);
  };

  const openEditDialog = (produit: Produit) => {
    setEditingProduit(produit);
    setFormData({
      nom: produit.nom,
      description: produit.description,
      prix: produit.prix.toString(),
      quantite_stock: produit.quantite_stock.toString(),
      seuil_alerte: produit.seuil_alerte.toString(),
      categorie_id: produit.categorie_id.toString(),
      est_perissable: produit.est_perissable,
      unite_mesure: produit.unite_mesure,
      image_url: produit.image_url || "",
      images: produit.images || [],
    });
    setShowForm(true);
  };

  const openDeleteDialog = (produit: Produit) => {
    setProduitToDelete(produit);
    setShowDeleteDialog(true);
  };

  // 🎯 GESTION DES IMAGES
  const getDefaultImage = (produit: Produit) => {
    const categorie = categories.find((c) => c.id === produit.categorie_id);
    const categorieNom = categorie?.nom.toLowerCase() || "default";

    if (
      categorieNom.includes("electronique") ||
      categorieNom.includes("tech")
    ) {
      return defaultImages.electronique[0];
    } else if (
      categorieNom.includes("aliment") ||
      categorieNom.includes("nourriture")
    ) {
      return defaultImages.alimentation[0];
    } else if (
      categorieNom.includes("vetement") ||
      categorieNom.includes("habillement")
    ) {
      return defaultImages.vetements[0];
    } else if (
      categorieNom.includes("maison") ||
      categorieNom.includes("décoration")
    ) {
      return defaultImages.maison[0];
    } else {
      return defaultImages.default[0];
    }
  };

  const addImageUrl = () => {
    if (formData.image_url.trim()) {
      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, prev.image_url.trim()],
        image_url: "",
      }));
    }
  };

  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const pickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert(
        "Permission nécessaire",
        "Vous devez autoriser l'accès aux photos."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets[0].uri) {
      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, result.assets[0].uri],
      }));
    }
  };

  // 🎯 GESTION CATÉGORIES (CRUD)
  const handleCreateCategorie = async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      const response = await apiFetch("/categories", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(categorieForm),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erreur création catégorie");
      }

      const newCategorie = await response.json();
      setCategories((prev) => [...prev, newCategorie]);
      setShowCategorieForm(false);
      resetCategorieForm();
      Alert.alert("Succès", "Catégorie créée avec succès");
    } catch (error: any) {
      Alert.alert(
        "Erreur",
        error.message || "Erreur lors de la création de la catégorie"
      );
    }
  };

  const handleUpdateCategorie = async () => {
    if (!editingCategorie) return;

    try {
      const token = await SecureStore.getItemAsync("auth_token");
      const response = await apiFetch(
        `/categories/${editingCategorie.id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(categorieForm),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erreur modification catégorie");
      }

      const updatedCategorie = await response.json();
      setCategories((prev) =>
        prev.map((c) => (c.id === editingCategorie.id ? updatedCategorie : c))
      );
      setShowCategorieForm(false);
      setEditingCategorie(null);
      resetCategorieForm();
      Alert.alert("Succès", "Catégorie modifiée avec succès");
    } catch (error: any) {
      Alert.alert(
        "Erreur",
        error.message || "Erreur lors de la modification de la catégorie"
      );
    }
  };

  const handleDeleteCategorie = async () => {
    if (!categorieToDelete) return;

    try {
      const token = await SecureStore.getItemAsync("auth_token");
      const response = await apiFetch(
        `/categories/${categorieToDelete.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erreur suppression catégorie");
      }

      setCategories((prev) =>
        prev.filter((c) => c.id !== categorieToDelete.id)
      );
      setShowDeleteCategorieDialog(false);
      setCategorieToDelete(null);
      Alert.alert("Succès", "Catégorie supprimée avec succès");
    } catch (error: any) {
      Alert.alert(
        "Erreur",
        error.message || "Erreur lors de la suppression de la catégorie"
      );
    }
  };

  const resetCategorieForm = () => {
    setCategorieForm({
      nom: "",
      description: "",
      couleur: "#3b82f6",
      icone: "Package",
    });
    setEditingCategorie(null);
  };

  // 🎯 PAGINATION
  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, current_page: newPage }));
  };

  // 🎯 STATUT STOCK
  const getStatutStock = (produit: Produit) => {
    if (produit.quantite_stock === 0)
      return { label: "Rupture", color: "#ef4444", bgColor: "bg-red-500" };
    if (produit.quantite_stock <= produit.seuil_alerte)
      return { label: "Alerte", color: "#f97316", bgColor: "bg-orange-500" };
    return { label: "Normal", color: "#22c55e", bgColor: "bg-green-500" };
  };

  // 🎯 FORMATAGE PRIX
  const formatPrix = (prix: number) => {
    return new Intl.NumberFormat("fr-FR").format(prix) + " FCFA";
  };

  // 🎯 RENDER IMAGE PRODUIT
  const ProductImage = ({
    produit,
    size = 100,
  }: {
    produit: Produit;
    size?: number;
  }) => {
    const [imageError, setImageError] = useState(false);

    const images =
      produit.images && produit.images.length > 0
        ? produit.images
        : produit.image_url
          ? [produit.image_url]
          : [getDefaultImage(produit)];

    const imageUrl = images[0];

    if (imageError) {
      return (
        <View style={[styles.imagePlaceholder, { width: size, height: size }]}>
          <ImageIcon size={size * 0.3} color="#94a3b8" />
          <Text style={styles.imagePlaceholderText}>Image non disponible</Text>
        </View>
      );
    }

    return (
      <Image
        source={{ uri: imageUrl }}
        style={{ width: size, height: size, borderRadius: 12 }}
        onError={() => setImageError(true)}
      />
    );
  };

  // 🎯 COMPOSANT CARD PRODUIT GRID
  const ProductCard = ({
    produit,
    index,
  }: {
    produit: Produit;
    index: number;
  }) => {
    const statut = getStatutStock(produit);
    const categorie = categories.find((c) => c.id === produit.categorie_id);

    return (
      <Animated.View
        style={[
          styles.productCard,
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
          style={styles.productCardInner}
          onPress={() => {
            setProduitSelectionne(produit);
            setShowDetails(true);
          }}
          activeOpacity={0.9}
        >
          {/* Image et badges */}
          <View style={styles.productImageContainer}>
            <ProductImage produit={produit} size={200} />

            {/* Badge Statut */}
            <View
              style={[styles.statutBadge, { backgroundColor: statut.color }]}
            >
              <Text style={styles.statutBadgeText}>{statut.label}</Text>
            </View>

            {/* Badge Catégorie */}
            {categorie && (
              <View
                style={[
                  styles.categorieBadge,
                  { backgroundColor: `${categorie.couleur}20` },
                ]}
              >
                <Text
                  style={[
                    styles.categorieBadgeText,
                    { color: categorie.couleur },
                  ]}
                >
                  {categorie.nom}
                </Text>
              </View>
            )}

            {/* Menu Actions */}
            <TouchableOpacity
              style={styles.productMenuButton}
              onPress={(e) => {
                e.stopPropagation();
                Alert.alert(produit.nom, "Que souhaitez-vous faire ?", [
                  {
                    text: "Voir détails",
                    onPress: () => {
                      setProduitSelectionne(produit);
                      setShowDetails(true);
                    },
                  },
                  {
                    text: "Modifier",
                    onPress: () => openEditDialog(produit),
                  },
                  {
                    text: "Supprimer",
                    style: "destructive",
                    onPress: () => openDeleteDialog(produit),
                  },
                  {
                    text: "Annuler",
                    style: "cancel",
                  },
                ]);
              }}
            >
              <MoreVertical size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Contenu */}
          <View style={styles.productCardContent}>
            <Text style={styles.productName} numberOfLines={1}>
              {produit.nom}
            </Text>

            <Text style={styles.productDescription} numberOfLines={2}>
              {produit.description}
            </Text>

            {/* Prix */}
            <Text style={styles.productPrice}>{formatPrix(produit.prix)}</Text>

            {/* Métriques Stock */}
            <View style={styles.productMetrics}>
              <View style={styles.stockInfo}>
                <View
                  style={[
                    styles.stockIndicator,
                    { backgroundColor: statut.color },
                  ]}
                />
                <Text style={styles.stockText}>
                  Stock:{" "}
                  <Text style={styles.stockValue}>
                    {produit.quantite_stock}
                  </Text>
                </Text>
              </View>
              <Text style={styles.seuilText}>
                Seuil: {produit.seuil_alerte}
              </Text>
            </View>

            {/* Barre de progression stock */}
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(100, (produit.quantite_stock / (produit.seuil_alerte * 3)) * 100)}%`,
                    backgroundColor: statut.color,
                  },
                ]}
              />
            </View>

            {/* Périssable */}
            {produit.est_perissable && (
              <View style={styles.perissableBadge}>
                <AlertTriangle size={12} color="#f97316" />
                <Text style={styles.perissableText}>Périssable</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // 🎯 COMPOSANT LIGNE PRODUIT LISTE
  const ProductRow = ({
    produit,
    index,
  }: {
    produit: Produit;
    index: number;
  }) => {
    const statut = getStatutStock(produit);
    const categorie = categories.find((c) => c.id === produit.categorie_id);

    return (
      <Animated.View
        style={[
          styles.productRow,
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
        <View style={styles.productRowContent}>
          {/* Image et infos */}
          <View style={styles.productRowLeft}>
            <ProductImage produit={produit} size={50} />
            <View style={styles.productRowInfo}>
              <Text style={styles.productRowName} numberOfLines={1}>
                {produit.nom}
              </Text>
              <Text style={styles.productRowDescription} numberOfLines={1}>
                {produit.description}
              </Text>
              {categorie && (
                <View
                  style={[
                    styles.rowCategorieBadge,
                    { backgroundColor: `${categorie.couleur}20` },
                  ]}
                >
                  <Text
                    style={[
                      styles.rowCategorieText,
                      { color: categorie.couleur },
                    ]}
                  >
                    {categorie.nom}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Détails côté droit */}
          <View style={styles.productRowRight}>
            <Text style={styles.productRowPrice}>
              {formatPrix(produit.prix)}
            </Text>

            <View style={styles.productRowStock}>
              <View
                style={[
                  styles.rowStockIndicator,
                  { backgroundColor: statut.color },
                ]}
              />
              <Text style={[styles.rowStockText, { color: statut.color }]}>
                {produit.quantite_stock}
              </Text>
              <Text style={styles.rowStockSeuil}>/{produit.seuil_alerte}</Text>
            </View>

            {/* Actions */}
            <View style={styles.productRowActions}>
              <TouchableOpacity
                style={styles.rowActionButton}
                onPress={() => {
                  setProduitSelectionne(produit);
                  setShowDetails(true);
                }}
              >
                <Eye size={18} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rowActionButton}
                onPress={() => openEditDialog(produit)}
              >
                <Edit size={18} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rowActionButton}
                onPress={() => openDeleteDialog(produit)}
              >
                <Trash2 size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animated.View>
    );
  };

  // 🎯 STATISTIQUES RAPIDES
  const quickStats = [
    {
      label: "Total Produits",
      value: stats?.total_produits ?? produits.length,
      color: "#3b82f6",
      icon: Package,
    },
    {
      label: "En Alerte",
      value:
        stats?.produits_en_alerte ??
        produits.filter(
          (p) => p.quantite_stock <= p.seuil_alerte && p.quantite_stock > 0
        ).length,
      color: "#f97316",
      icon: AlertTriangle,
    },
    {
      label: "En Rupture",
      value:
        stats?.produits_en_rupture ??
        produits.filter((p) => p.quantite_stock === 0).length,
      color: "#ef4444",
      icon: Package,
    },
    {
      label: "Périssables",
      value: produits.filter((p) => p.est_perissable).length,
      color: "#22c55e",
      icon: Tag,
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
              colors={["#3b82f6", "#8b5cf6"]}
              style={styles.headerLogo}
            >
              <Package size={24} color="#ffffff" />
            </LinearGradient>
            <View>
              <Text style={styles.headerTitle}>Gestion Produits</Text>
              <Text style={styles.headerSubtitle}>
                {pagination.total} produits dans votre catalogue
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowStats(true)}
            >
              <BarChart3 size={20} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowCategories(true)}
            >
              <Tag size={20} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setShowForm(true)}
            >
              <Plus size={20} color="#ffffff" />
              <Text style={styles.primaryButtonText}>Nouveau</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>

      {/* Barre de recherche et filtres */}
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
              placeholder="Rechercher un produit..."
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
            {/* Filtre Catégorie */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Catégorie</Text>
              <View style={styles.filterSelect}>
                <Picker
                  selectedValue={filtreCategorie}
                  onValueChange={setFiltreCategorie}
                  style={styles.picker}
                >
                  <Picker.Item label="Toutes catégories" value="all" />
                  {categories.map((categorie) => (
                    <Picker.Item
                      key={categorie.id}
                      label={categorie.nom}
                      value={categorie.id.toString()}
                    />
                  ))}
                </Picker>
                <ChevronDown size={16} color="#64748b" />
              </View>
            </View>

            {/* Filtre Stock */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Stock</Text>
              <View style={styles.filterSelect}>
                <Picker
                  selectedValue={filtreStock}
                  onValueChange={setFiltreStock}
                  style={styles.picker}
                >
                  <Picker.Item label="Tous les stocks" value="all" />
                  <Picker.Item label="Stock normal" value="normal" />
                  <Picker.Item label="En alerte" value="alerte" />
                  <Picker.Item label="En rupture" value="rupture" />
                  <Picker.Item label="Périssables" value="perissable" />
                </Picker>
                <ChevronDown size={16} color="#64748b" />
              </View>
            </View>

            {/* Toggle Vue */}
            <View style={styles.viewToggle}>
              <Text style={styles.filterLabel}>Vue</Text>
              <View style={styles.toggleButtons}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    vue === "grid" && styles.toggleButtonActive,
                  ]}
                  onPress={() => setVue("grid")}
                >
                  <Grid
                    size={20}
                    color={vue === "grid" ? "#ffffff" : "#64748b"}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    vue === "list" && styles.toggleButtonActive,
                  ]}
                  onPress={() => setVue("list")}
                >
                  <List
                    size={20}
                    color={vue === "list" ? "#ffffff" : "#64748b"}
                  />
                </TouchableOpacity>
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
                    {isLoading ? "-" : stat.value}
                  </Text>
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

      {/* Liste des Produits */}
      <Animated.View
        style={[
          styles.productsContainer,
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
          {vue === "grid" ? (
            // Vue Grid
            <View style={styles.gridContainer}>
              {isLoading ? (
                // Skeleton Grid
                Array.from({ length: 6 }).map((_, index) => (
                  <View key={index} style={styles.skeletonCard}>
                    <View style={styles.skeletonImage} />
                    <View style={styles.skeletonContent}>
                      <View style={styles.skeletonLine} />
                      <View style={[styles.skeletonLine, { width: "80%" }]} />
                      <View style={[styles.skeletonLine, { width: "60%" }]} />
                      <View style={[styles.skeletonLine, { width: "40%" }]} />
                    </View>
                  </View>
                ))
              ) : produits.length > 0 ? (
                <View style={styles.grid}>
                  {produits.map((produit, index) => (
                    <ProductCard
                      key={produit.id}
                      produit={produit}
                      index={index}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Package size={64} color="#94a3b8" />
                  <Text style={styles.emptyStateTitle}>
                    Aucun produit trouvé
                  </Text>
                  <Text style={styles.emptyStateText}>
                    Aucun produit ne correspond à vos critères de recherche.
                  </Text>
                </View>
              )}
            </View>
          ) : (
            // Vue Liste
            <View style={styles.listContainer}>
              {isLoading ? (
                // Skeleton List
                Array.from({ length: 10 }).map((_, index) => (
                  <View key={index} style={styles.skeletonRow}>
                    <View style={styles.skeletonRowLeft}>
                      <View style={styles.skeletonRowImage} />
                      <View style={styles.skeletonRowText}>
                        <View style={styles.skeletonLine} />
                        <View style={[styles.skeletonLine, { width: "60%" }]} />
                      </View>
                    </View>
                    <View style={styles.skeletonRowRight}>
                      <View style={[styles.skeletonLine, { width: 80 }]} />
                      <View style={[styles.skeletonLine, { width: 40 }]} />
                    </View>
                  </View>
                ))
              ) : produits.length > 0 ? (
                produits.map((produit, index) => (
                  <ProductRow
                    key={produit.id}
                    produit={produit}
                    index={index}
                  />
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Package size={64} color="#94a3b8" />
                  <Text style={styles.emptyStateTitle}>
                    Aucun produit trouvé
                  </Text>
                  <Text style={styles.emptyStateText}>
                    Aucun produit ne correspond à vos critères de recherche.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Pagination */}
          {!isLoading && pagination.last_page > 1 && (
            <View style={styles.pagination}>
              <Text style={styles.paginationInfo}>
                Affichage de {pagination.from} à {pagination.to} sur{" "}
                {pagination.total} produits
              </Text>
              <View style={styles.paginationButtons}>
                <TouchableOpacity
                  style={[
                    styles.paginationButton,
                    pagination.current_page === 1 &&
                      styles.paginationButtonDisabled,
                  ]}
                  onPress={() => handlePageChange(pagination.current_page - 1)}
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
                        onPress={() => handlePageChange(pageNum)}
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
                  onPress={() => handlePageChange(pagination.current_page + 1)}
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

      {/* Modal Détails Produit */}
      <Modal
        visible={showDetails}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetails(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Header Modal */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowDetails(false)}
              style={styles.modalCloseButton}
            >
              <X size={24} color="#64748b" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Détails du Produit</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalActionButton}
                onPress={() => {
                  setShowDetails(false);
                  if (produitSelectionne) openEditDialog(produitSelectionne);
                }}
              >
                <Edit size={20} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalActionButton}
                onPress={() => {
                  setShowDetails(false);
                  if (produitSelectionne) openDeleteDialog(produitSelectionne);
                }}
              >
                <Trash2 size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>

          {produitSelectionne && (
            <ScrollView style={styles.modalContent}>
              {/* Image */}
              <View style={styles.detailImageContainer}>
                <ProductImage produit={produitSelectionne} size={300} />
              </View>

              {/* Infos principales */}
              <View style={styles.detailInfoContainer}>
                <Text style={styles.detailName}>{produitSelectionne.nom}</Text>
                <Text style={styles.detailDescription}>
                  {produitSelectionne.description || "Aucune description"}
                </Text>

                {/* Prix */}
                <View style={styles.detailPriceContainer}>
                  <Text style={styles.detailPriceLabel}>Prix de vente</Text>
                  <Text style={styles.detailPrice}>
                    {formatPrix(produitSelectionne.prix)}
                  </Text>
                </View>

                {/* Métriques */}
                <View style={styles.detailMetrics}>
                  {[
                    {
                      label: "Stock Actuel",
                      value: produitSelectionne.quantite_stock,
                      icon: Package,
                    },
                    {
                      label: "Seuil Alerte",
                      value: produitSelectionne.seuil_alerte,
                      icon: AlertTriangle,
                    },
                    {
                      label: "Unité",
                      value: produitSelectionne.unite_mesure,
                      icon: Hash,
                    },
                    {
                      label: "Statut",
                      value: getStatutStock(produitSelectionne).label,
                      icon: BarChart,
                    },
                  ].map((metric, index) => (
                    <View key={index} style={styles.detailMetric}>
                      <metric.icon size={20} color="#64748b" />
                      <View style={styles.detailMetricInfo}>
                        <Text style={styles.detailMetricLabel}>
                          {metric.label}
                        </Text>
                        <Text
                          style={[
                            styles.detailMetricValue,
                            metric.label === "Statut" && {
                              color: getStatutStock(produitSelectionne).color,
                            },
                          ]}
                        >
                          {metric.value}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Catégorie */}
                {produitSelectionne.categorie && (
                  <View style={styles.detailCategorie}>
                    <Text style={styles.detailSectionTitle}>Catégorie</Text>
                    <View
                      style={[
                        styles.categorieTag,
                        {
                          backgroundColor: `${produitSelectionne.categorie.couleur}20`,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.categorieTagText,
                          { color: produitSelectionne.categorie.couleur },
                        ]}
                      >
                        {produitSelectionne.categorie.nom}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Périssable */}
                {produitSelectionne.est_perissable && (
                  <View style={styles.perissableContainer}>
                    <AlertTriangle size={20} color="#f97316" />
                    <Text style={styles.perissableLabel}>
                      Produit Périssable
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Modal Formulaire Produit */}
      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowForm(false);
          resetForm();
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowForm(false);
                resetForm();
              }}
              style={styles.modalCloseButton}
            >
              <X size={24} color="#64748b" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingProduit ? "Modifier le produit" : "Nouveau produit"}
            </Text>
            <TouchableOpacity
              style={styles.modalSaveButton}
              onPress={
                editingProduit ? handleUpdateProduit : handleCreateProduit
              }
            >
              <Save size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer}>
            {/* Nom */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Nom du produit *</Text>
              <TextInput
                style={styles.formInput}
                value={formData.nom}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, nom: text }))
                }
                placeholder="Nom du produit"
                placeholderTextColor="#94a3b8"
              />
            </View>

            {/* Description */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                value={formData.description}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, description: text }))
                }
                placeholder="Description du produit"
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Prix et Stock */}
            <View style={styles.rowGroup}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.formLabel}>Prix (FCFA) *</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.prix}
                  onChangeText={(text) =>
                    setFormData((prev) => ({ ...prev, prix: text }))
                  }
                  placeholder="0.00"
                  placeholderTextColor="#94a3b8"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.formLabel}>Stock *</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.quantite_stock}
                  onChangeText={(text) =>
                    setFormData((prev) => ({ ...prev, quantite_stock: text }))
                  }
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                />
              </View>
            </View>

            {/* Seuil et Unité */}
            <View style={styles.rowGroup}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.formLabel}>Seuil d'alerte *</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.seuil_alerte}
                  onChangeText={(text) =>
                    setFormData((prev) => ({ ...prev, seuil_alerte: text }))
                  }
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.formLabel}>Unité *</Text>
                <View style={styles.formSelect}>
                  <Picker
                    selectedValue={formData.unite_mesure}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, unite_mesure: value }))
                    }
                    style={styles.picker}
                  >
                    <Picker.Item label="Unité" value="unité" />
                    <Picker.Item label="Kilogramme" value="kg" />
                    <Picker.Item label="Gramme" value="g" />
                    <Picker.Item label="Litre" value="L" />
                    <Picker.Item label="Millilitre" value="mL" />
                    <Picker.Item label="Mètre" value="m" />
                    <Picker.Item label="Centimètre" value="cm" />
                    <Picker.Item label="Paquet" value="paquet" />
                    <Picker.Item label="Carton" value="carton" />
                  </Picker>
                </View>
              </View>
            </View>

            {/* Catégorie */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Catégorie *</Text>
              <View style={styles.formSelect}>
                <Picker
                  selectedValue={formData.categorie_id}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, categorie_id: value }))
                  }
                  style={styles.picker}
                >
                  <Picker.Item label="Sélectionner une catégorie" value="" />
                  {categories.map((categorie) => (
                    <Picker.Item
                      key={categorie.id}
                      label={categorie.nom}
                      value={categorie.id.toString()}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Images */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Images</Text>

              {/* Images existantes */}
              {formData.images.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.imagesPreview}
                >
                  {formData.images.map((url, index) => (
                    <View key={index} style={styles.imagePreview}>
                      <Image
                        source={{ uri: url }}
                        style={styles.imagePreviewImage}
                      />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => removeImage(index)}
                      >
                        <X size={12} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* Ajouter image URL */}
              <View style={styles.addImageContainer}>
                <TextInput
                  style={[styles.formInput, { flex: 1 }]}
                  value={formData.image_url}
                  onChangeText={(text) =>
                    setFormData((prev) => ({ ...prev, image_url: text }))
                  }
                  placeholder="URL d'une image"
                  placeholderTextColor="#94a3b8"
                />
                <TouchableOpacity
                  style={styles.addImageButton}
                  onPress={addImageUrl}
                >
                  <Link size={20} color="#ffffff" />
                </TouchableOpacity>
              </View>

              {/* Bouton galerie */}
              <TouchableOpacity
                style={styles.galleryButton}
                onPress={pickImage}
              >
                <ImageIcon size={20} color="#3b82f6" />
                <Text style={styles.galleryButtonText}>
                  Choisir depuis la galerie
                </Text>
              </TouchableOpacity>
            </View>

            {/* Périssable */}
            <View style={styles.switchGroup}>
              <Text style={styles.formLabel}>Produit périssable</Text>
              <TouchableOpacity
                style={[
                  styles.switch,
                  formData.est_perissable && styles.switchActive,
                ]}
                onPress={() =>
                  setFormData((prev) => ({
                    ...prev,
                    est_perissable: !prev.est_perissable,
                  }))
                }
              >
                <View
                  style={[
                    styles.switchThumb,
                    formData.est_perissable && styles.switchThumbActive,
                  ]}
                />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal Statistiques */}
      <Modal
        visible={showStats}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowStats(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowStats(false)}
              style={styles.modalCloseButton}
            >
              <X size={24} color="#64748b" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Statistiques</Text>
          </View>

          <ScrollView style={styles.statsModalContent}>
            {/* Valeur du stock */}
            <BlurView intensity={10} style={styles.statsCard}>
              <Text style={styles.statsCardTitle}>Valeur du Stock</Text>
              <Text style={styles.statsCardValue}>
                {stats?.valeur_stock_total
                  ? formatPrix(stats.valeur_stock_total)
                  : "-"}
              </Text>
              <Text style={styles.statsCardDescription}>
                Valeur totale de l'inventaire
              </Text>
            </BlurView>

            {/* Détails inventaire */}
            <View style={styles.statsDetails}>
              <Text style={styles.statsSectionTitle}>Inventaire</Text>
              <View style={styles.statsList}>
                <View style={styles.statsItem}>
                  <Text style={styles.statsItemLabel}>Total produits:</Text>
                  <Text style={styles.statsItemValue}>
                    {stats?.total_produits ?? "-"}
                  </Text>
                </View>
                <View style={styles.statsItem}>
                  <Text style={styles.statsItemLabel}>En alerte:</Text>
                  <Text style={[styles.statsItemValue, { color: "#f97316" }]}>
                    {stats?.produits_en_alerte ?? "-"}
                  </Text>
                </View>
                <View style={styles.statsItem}>
                  <Text style={styles.statsItemLabel}>En rupture:</Text>
                  <Text style={[styles.statsItemValue, { color: "#ef4444" }]}>
                    {stats?.produits_en_rupture ?? "-"}
                  </Text>
                </View>
                <View style={styles.statsItem}>
                  <Text style={styles.statsItemLabel}>Périssables:</Text>
                  <Text style={styles.statsItemValue}>
                    {produits.filter((p) => p.est_perissable).length}
                  </Text>
                </View>
              </View>
            </View>

            {/* Distribution par catégorie */}
            <View style={styles.statsDetails}>
              <Text style={styles.statsSectionTitle}>Par Catégorie</Text>
              {categories.map((categorie) => (
                <View key={categorie.id} style={styles.categoryStat}>
                  <View style={styles.categoryStatHeader}>
                    <View
                      style={[
                        styles.categoryColor,
                        { backgroundColor: categorie.couleur },
                      ]}
                    />
                    <Text style={styles.categoryName}>{categorie.nom}</Text>
                    <Text style={styles.categoryCount}>
                      {categorie.produits_count || 0} produits
                    </Text>
                  </View>
                  <View style={styles.categoryBar}>
                    <View
                      style={[
                        styles.categoryBarFill,
                        {
                          width: `${((categorie.produits_count || 0) / (stats?.total_produits || 1)) * 100}%`,
                          backgroundColor: categorie.couleur,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal Catégories */}
      <Modal
        visible={showCategories}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCategories(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowCategories(false)}
              style={styles.modalCloseButton}
            >
              <X size={24} color="#64748b" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Catégories</Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setShowCategorieForm(true)}
            >
              <Plus size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.categoriesContent}>
            {categories.map((categorie) => (
              <View key={categorie.id} style={styles.categoryItem}>
                <View style={styles.categoryItemLeft}>
                  <View
                    style={[
                      styles.categoryIcon,
                      { backgroundColor: `${categorie.couleur}20` },
                    ]}
                  >
                    <Tag size={20} color={categorie.couleur} />
                  </View>
                  <View>
                    <Text style={styles.categoryItemName}>{categorie.nom}</Text>
                    <Text
                      style={styles.categoryItemDescription}
                      numberOfLines={1}
                    >
                      {categorie.description || "Aucune description"}
                    </Text>
                    <Text style={styles.categoryItemCount}>
                      {categorie.produits_count || 0} produit(s)
                    </Text>
                  </View>
                </View>
                <View style={styles.categoryItemActions}>
                  <TouchableOpacity
                    style={styles.categoryActionButton}
                    onPress={() => {
                      setEditingCategorie(categorie);
                      setCategorieForm({
                        nom: categorie.nom,
                        description: categorie.description || "",
                        couleur: categorie.couleur,
                        icone: categorie.icone || "Package",
                      });
                      setShowCategorieForm(true);
                    }}
                  >
                    <Edit size={18} color="#3b82f6" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.categoryActionButton}
                    onPress={() => {
                      setCategorieToDelete(categorie);
                      setShowDeleteCategorieDialog(true);
                    }}
                    disabled={(categorie.produits_count || 0) > 0}
                  >
                    <Trash2
                      size={18}
                      color={
                        (categorie.produits_count || 0) > 0
                          ? "#94a3b8"
                          : "#ef4444"
                      }
                    />
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {categories.length === 0 && (
              <View style={styles.emptyCategories}>
                <Tag size={64} color="#94a3b8" />
                <Text style={styles.emptyCategoriesTitle}>
                  Aucune catégorie
                </Text>
                <Text style={styles.emptyCategoriesText}>
                  Créez votre première catégorie pour organiser vos produits
                </Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal Formulaire Catégorie */}
      <Modal
        visible={showCategorieForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowCategorieForm(false);
          resetCategorieForm();
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowCategorieForm(false);
                resetCategorieForm();
              }}
              style={styles.modalCloseButton}
            >
              <X size={24} color="#64748b" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingCategorie ? "Modifier catégorie" : "Nouvelle catégorie"}
            </Text>
            <TouchableOpacity
              style={styles.modalSaveButton}
              onPress={
                editingCategorie ? handleUpdateCategorie : handleCreateCategorie
              }
            >
              <Save size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer}>
            {/* Nom */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Nom de la catégorie *</Text>
              <TextInput
                style={styles.formInput}
                value={categorieForm.nom}
                onChangeText={(text) =>
                  setCategorieForm((prev) => ({ ...prev, nom: text }))
                }
                placeholder="Nom de la catégorie"
                placeholderTextColor="#94a3b8"
              />
            </View>

            {/* Description */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                value={categorieForm.description}
                onChangeText={(text) =>
                  setCategorieForm((prev) => ({ ...prev, description: text }))
                }
                placeholder="Description de la catégorie"
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Couleur */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Couleur</Text>
              <View style={styles.colorPickerContainer}>
                <TextInput
                  style={[styles.formInput, { flex: 1 }]}
                  value={categorieForm.couleur}
                  onChangeText={(text) =>
                    setCategorieForm((prev) => ({ ...prev, couleur: text }))
                  }
                  placeholder="#3b82f6"
                  placeholderTextColor="#94a3b8"
                />
                <View
                  style={[
                    styles.colorPreview,
                    { backgroundColor: categorieForm.couleur },
                  ]}
                />
              </View>
            </View>

            {/* Aperçu */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Aperçu</Text>
              <View style={styles.previewContainer}>
                <View
                  style={[
                    styles.categoryPreview,
                    { backgroundColor: `${categorieForm.couleur}20` },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryPreviewText,
                      { color: categorieForm.couleur },
                    ]}
                  >
                    {categorieForm.nom || "Nom de catégorie"}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Alertes de confirmation */}
      {showDeleteDialog && (
        <Modal
          visible={showDeleteDialog}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDeleteDialog(false)}
        >
          <View style={styles.alertOverlay}>
            <BlurView intensity={20} style={styles.alertContainer}>
              <Text style={styles.alertTitle}>Supprimer le produit</Text>
              <Text style={styles.alertMessage}>
                Êtes-vous sûr de vouloir supprimer le produit "
                {produitToDelete?.nom}" ?
              </Text>
              <Text style={styles.alertWarning}>
                Cette action est irréversible.
              </Text>

              <View style={styles.alertButtons}>
                <TouchableOpacity
                  style={[styles.alertButton, styles.alertButtonCancel]}
                  onPress={() => setShowDeleteDialog(false)}
                >
                  <Text style={styles.alertButtonCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.alertButton, styles.alertButtonConfirm]}
                  onPress={handleDeleteProduit}
                >
                  <Trash2 size={20} color="#ffffff" />
                  <Text style={styles.alertButtonConfirmText}>Supprimer</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </View>
        </Modal>
      )}

      {showDeleteCategorieDialog && (
        <Modal
          visible={showDeleteCategorieDialog}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDeleteCategorieDialog(false)}
        >
          <View style={styles.alertOverlay}>
            <BlurView intensity={20} style={styles.alertContainer}>
              <Text style={styles.alertTitle}>Supprimer la catégorie</Text>
              <Text style={styles.alertMessage}>
                Êtes-vous sûr de vouloir supprimer la catégorie "
                {categorieToDelete?.nom}" ?
              </Text>

              {categorieToDelete &&
              (categorieToDelete.produits_count || 0) > 0 ? (
                <Text style={styles.alertError}>
                  ATTENTION: {categorieToDelete.produits_count} produit(s)
                  utilisent cette catégorie. La suppression est impossible.
                </Text>
              ) : (
                <Text style={styles.alertWarning}>
                  Cette action est irréversible.
                </Text>
              )}

              <View style={styles.alertButtons}>
                <TouchableOpacity
                  style={[styles.alertButton, styles.alertButtonCancel]}
                  onPress={() => setShowDeleteCategorieDialog(false)}
                >
                  <Text style={styles.alertButtonCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.alertButton, styles.alertButtonConfirm]}
                  onPress={handleDeleteCategorie}
                  disabled={
                    categorieToDelete &&
                    (categorieToDelete.produits_count || 0) > 0
                  }
                >
                  <Trash2 size={20} color="#ffffff" />
                  <Text style={styles.alertButtonConfirmText}>Supprimer</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </View>
        </Modal>
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
    marginLeft: 8,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3b82f6",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginLeft: 8,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    marginLeft: 8,
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
    marginRight: 16,
    minWidth: 150,
  },
  filterLabel: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 6,
  },
  filterSelect: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
  },
  picker: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14,
  },
  viewToggle: {
    marginLeft: "auto",
  },
  toggleButtons: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    padding: 2,
  },
  toggleButton: {
    width: 36,
    height: 36,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  toggleButtonActive: {
    backgroundColor: "#3b82f6",
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
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  // Produits
  productsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100, // Pour le bottom tab bar
  },
  // Vue Grid
  gridContainer: {
    flex: 1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  productCard: {
    width: (width - 60) / 2,
    marginBottom: 16,
  },
  productCardInner: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    overflow: "hidden",
  },
  productImageContainer: {
    position: "relative",
  },
  statutBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statutBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600",
  },
  categorieBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categorieBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  productMenuButton: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  productCardContent: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 8,
    lineHeight: 16,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#22c55e",
    marginBottom: 8,
  },
  productMetrics: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  stockInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  stockIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  stockText: {
    fontSize: 12,
    color: "#94a3b8",
  },
  stockValue: {
    color: "#ffffff",
    fontWeight: "600",
  },
  seuilText: {
    fontSize: 11,
    color: "#64748b",
  },
  progressBar: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  perissableBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(249, 115, 22, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  perissableText: {
    fontSize: 10,
    color: "#f97316",
    marginLeft: 4,
    fontWeight: "600",
  },
  // Vue Liste
  listContainer: {
    flex: 1,
  },
  productRow: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    marginBottom: 8,
    overflow: "hidden",
  },
  productRowContent: {
    flexDirection: "row",
    padding: 12,
  },
  productRowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  productRowInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productRowName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 2,
  },
  productRowDescription: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 4,
  },
  rowCategorieBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rowCategorieText: {
    fontSize: 10,
    fontWeight: "600",
  },
  productRowRight: {
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  productRowPrice: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#22c55e",
    marginBottom: 8,
  },
  productRowStock: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  rowStockIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  rowStockText: {
    fontSize: 12,
    fontWeight: "600",
  },
  rowStockSeuil: {
    fontSize: 11,
    color: "#64748b",
  },
  productRowActions: {
    flexDirection: "row",
  },
  rowActionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
  },
  // Skeleton
  skeletonCard: {
    width: (width - 60) / 2,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    marginBottom: 16,
    overflow: "hidden",
  },
  skeletonImage: {
    width: "100%",
    height: 150,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  skeletonContent: {
    padding: 12,
  },
  skeletonLine: {
    height: 10,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 5,
    marginBottom: 8,
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    marginBottom: 8,
  },
  skeletonRowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  skeletonRowImage: {
    width: 50,
    height: 50,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    marginRight: 12,
  },
  skeletonRowText: {
    flex: 1,
  },
  skeletonRowRight: {
    alignItems: "flex-end",
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
  },
  // Image
  imagePlaceholder: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderText: {
    fontSize: 10,
    color: "#94a3b8",
    marginTop: 4,
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
  modalActions: {
    flexDirection: "row",
  },
  modalActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginLeft: 8,
  },
  modalSaveButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#3b82f6",
  },
  // Détails produit
  modalContent: {
    flex: 1,
  },
  detailImageContainer: {
    padding: 20,
    alignItems: "center",
  },
  detailInfoContainer: {
    padding: 20,
  },
  detailName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 8,
  },
  detailDescription: {
    fontSize: 16,
    color: "#94a3b8",
    lineHeight: 24,
    marginBottom: 20,
  },
  detailPriceContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  detailPriceLabel: {
    fontSize: 14,
    color: "#94a3b8",
    marginBottom: 4,
  },
  detailPrice: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#22c55e",
  },
  detailMetrics: {
    marginBottom: 20,
  },
  detailMetric: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  detailMetricInfo: {
    flex: 1,
    marginLeft: 12,
  },
  detailMetricLabel: {
    fontSize: 14,
    color: "#94a3b8",
  },
  detailMetricValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginTop: 2,
  },
  detailCategorie: {
    marginBottom: 20,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 8,
  },
  categorieTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  categorieTagText: {
    fontSize: 14,
    fontWeight: "600",
  },
  perissableContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(249, 115, 22, 0.1)",
    padding: 12,
    borderRadius: 8,
  },
  perissableLabel: {
    fontSize: 14,
    color: "#f97316",
    fontWeight: "600",
    marginLeft: 8,
  },
  // Formulaire
  formContainer: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
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
    height: 100,
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
  // Images
  imagesPreview: {
    flexDirection: "row",
    marginBottom: 12,
  },
  imagePreview: {
    position: "relative",
    marginRight: 8,
  },
  imagePreviewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeImageButton: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
  },
  addImageContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  addImageButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
  },
  galleryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
    borderRadius: 8,
    padding: 12,
  },
  galleryButtonText: {
    color: "#3b82f6",
    fontWeight: "600",
    marginLeft: 8,
  },
  // Switch
  switchGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  switch: {
    width: 52,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    padding: 2,
  },
  switchActive: {
    backgroundColor: "#3b82f6",
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  switchThumbActive: {
    transform: [{ translateX: 24 }],
  },
  // Statistiques modal
  statsModalContent: {
    padding: 20,
  },
  statsCard: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
  },
  statsCardTitle: {
    fontSize: 16,
    color: "#94a3b8",
    marginBottom: 8,
  },
  statsCardValue: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#22c55e",
    marginBottom: 4,
  },
  statsCardDescription: {
    fontSize: 14,
    color: "#94a3b8",
  },
  statsDetails: {
    marginBottom: 20,
  },
  statsSectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 16,
  },
  statsList: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    overflow: "hidden",
  },
  statsItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  statsItemLabel: {
    fontSize: 14,
    color: "#94a3b8",
  },
  statsItemValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  categoryStat: {
    marginBottom: 12,
  },
  categoryStatHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  categoryName: {
    flex: 1,
    fontSize: 14,
    color: "#ffffff",
    fontWeight: "500",
  },
  categoryCount: {
    fontSize: 12,
    color: "#94a3b8",
  },
  categoryBar: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 2,
    overflow: "hidden",
  },
  categoryBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  // Catégories modal
  categoriesContent: {
    padding: 20,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 16,
    marginBottom: 8,
  },
  categoryItemLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  categoryItemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 2,
  },
  categoryItemDescription: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 4,
  },
  categoryItemCount: {
    fontSize: 11,
    color: "#64748b",
  },
  categoryItemActions: {
    flexDirection: "row",
  },
  categoryActionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginLeft: 8,
  },
  emptyCategories: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyCategoriesTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyCategoriesText: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    paddingHorizontal: 40,
  },
  // Formulaire catégorie
  colorPickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  colorPreview: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  previewContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 8,
    padding: 16,
  },
  categoryPreview: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  categoryPreviewText: {
    fontSize: 14,
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
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 12,
  },
  alertMessage: {
    fontSize: 16,
    color: "#94a3b8",
    lineHeight: 24,
    marginBottom: 8,
  },
  alertWarning: {
    fontSize: 14,
    color: "#f97316",
    marginBottom: 20,
  },
  alertError: {
    fontSize: 14,
    color: "#ef4444",
    marginBottom: 20,
  },
  alertButtons: {
    flexDirection: "row",
    gap: 12,
  },
  alertButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
  },
  alertButtonCancel: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  alertButtonCancelText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  alertButtonConfirm: {
    backgroundColor: "#ef4444",
  },
  alertButtonConfirmText: {
    color: "#ffffff",
    fontWeight: "600",
    marginLeft: 8,
  },
});
