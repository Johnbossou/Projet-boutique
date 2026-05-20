import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Package } from "lucide-react-native"; // Pour le composant Package
import { Image as ImageIcon } from "lucide-react-native"; // Pour ImageIcon
import { ChevronDown } from "lucide-react-native"; // Pour ChevronDown
import { LinearGradient } from "expo-linear-gradient";
import * as Print from "expo-print";
import {
  Barcode,
  Calculator,
  Camera,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Minus,
  Percent,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShoppingCart,
  Smartphone,
  Trash2,
  User,
  Wallet,
  X,
  Zap,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
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
  View,
} from "react-native";
import { Badge } from "../../components/ui/Badge";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "../../contexts/AuthContext";
import { apiFetch } from "@/lib/api-client";

const { width, height } = Dimensions.get("window");

// Types pour les données
interface Produit {
  id: number;
  nom: string;
  prix: number;
  quantite_stock: number;
  categorie?: {
    nom: string;
  };
  image_url?: string;
}

interface Client {
  id: number;
  nom: string;
  telephone: string;
}

interface LignePanier {
  produit: Produit;
  quantite: number;
  prixUnitaire: number;
  sousTotal: number;
}

interface VenteResponse {
  id: number;
  montant_total: number;
  tva: number;
  remise: number;
  statut: string;
  created_at: string;
  mode_paiement?: string;
  numero_transaction?: string;
  reference_carte?: string;
  banque?: string;
  montant_recu?: number;
  monnaie_rendue?: number;
  numero_vente?: string;
  client?: {
    nom: string;
    telephone?: string;
  };
  ligne_ventes: Array<{
    id: number;
    quantite: number;
    prix_unitaire: number;
    produit: Produit;
  }>;
}

export default function CaisseScreen() {
  const { user } = useAuth();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [panier, setPanier] = useState<LignePanier[]>([]);
  const [recherche, setRecherche] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRemiseInput, setShowRemiseInput] = useState(false);
  const [remise, setRemise] = useState(0);
  const [notes, setNotes] = useState("");
  const [clientId, setClientId] = useState<number | null>(null);
  const [lastVente, setLastVente] = useState<VenteResponse | null>(null);
  const [showTicket, setShowTicket] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // États paiement
  const [modePaiement, setModePaiement] = useState<
    "especes" | "mtn" | "moov" | "carte" | null
  >(null);
  const [numeroTransaction, setNumeroTransaction] = useState("");
  const [referenceCarte, setReferenceCarte] = useState("");
  const [banqueSelectionnee, setBanqueSelectionnee] = useState("");
  const [montantRecu, setMontantRecu] = useState("");

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

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

    // Animation pulse pour indicateur gaming
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Chargement des données
  useEffect(() => {
    chargerProduits();
    chargerClients();
  }, []);

  const chargerProduits = async () => {
    try {
      setIsLoading(true);
      const token = await SecureStore.getItemAsync("auth_token");

      const response = await apiFetch(
        "/produits?per_page=1000",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (response.ok) {
        const responseData = await response.json();
        const produitsData = Array.isArray(responseData)
          ? responseData
          : responseData.data
            ? responseData.data
            : responseData;
        setProduits(produitsData);
      }
    } catch (error) {
      console.error("Erreur chargement produits:", error);
      Alert.alert("Erreur", "Erreur lors du chargement des produits");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const chargerClients = async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token");
      const response = await apiFetch("/clients", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const clientsData = Array.isArray(data) ? data : data.data || [];
        setClients(clientsData);
      }
    } catch (error) {
      console.error("Erreur chargement clients:", error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await chargerProduits();
  };

  // Fonctions panier
  const verifierStock = useCallback(
    (produit: Produit, quantite: number): boolean => {
      const produitEnStock = produits.find((p) => p.id === produit.id);
      if (!produitEnStock) return false;

      const quantitePanier =
        panier.find((item) => item.produit.id === produit.id)?.quantite || 0;
      const quantiteTotale = quantitePanier + quantite;

      return quantiteTotale <= produitEnStock.quantite_stock;
    },
    [produits, panier]
  );

  const ajouterAuPanier = useCallback(
    (produit: Produit) => {
      if (!verifierStock(produit, 1)) {
        const stockDispo =
          produits.find((p) => p.id === produit.id)?.quantite_stock || 0;
        Alert.alert("Stock insuffisant", `Il reste ${stockDispo} unités`);
        return;
      }

      setPanier((prev) => {
        const existing = prev.find((item) => item.produit.id === produit.id);

        if (existing) {
          return prev.map((item) =>
            item.produit.id === produit.id
              ? {
                  ...item,
                  quantite: item.quantite + 1,
                  sousTotal: (item.quantite + 1) * item.prixUnitaire,
                }
              : item
          );
        }

        return [
          ...prev,
          {
            produit,
            quantite: 1,
            prixUnitaire: produit.prix,
            sousTotal: produit.prix,
          },
        ];
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [verifierStock, produits]
  );

  const modifierQuantite = useCallback(
    (produitId: number, nouvelleQuantite: number) => {
      if (nouvelleQuantite < 1) {
        retirerDuPanier(produitId);
        return;
      }

      const produit = produits.find((p) => p.id === produitId);
      if (produit && !verifierStock(produit, nouvelleQuantite)) {
        const stockDispo = produit.quantite_stock;
        const quantiteActuelle =
          panier.find((item) => item.produit.id === produitId)?.quantite || 0;

        if (nouvelleQuantite > quantiteActuelle) {
          Alert.alert("Stock insuffisant", `Il reste ${stockDispo} unités`);
          return;
        }
      }

      setPanier((prev) =>
        prev.map((item) =>
          item.produit.id === produitId
            ? {
                ...item,
                quantite: nouvelleQuantite,
                sousTotal: nouvelleQuantite * item.prixUnitaire,
              }
            : item
        )
      );
    },
    [produits, verifierStock, panier]
  );

  const retirerDuPanier = useCallback((produitId: number) => {
    setPanier((prev) => prev.filter((item) => item.produit.id !== produitId));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const viderPanier = useCallback(() => {
    setPanier([]);
    setRemise(0);
    setNotes("");
    setClientId(null);
    setModePaiement(null);
    setNumeroTransaction("");
    setReferenceCarte("");
    setBanqueSelectionnee("");
    setMontantRecu("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, []);

  // Calculs
  const calculs = useMemo(() => {
    const sousTotal = panier.reduce(
      (total, item) => total + (item.sousTotal || 0),
      0
    );
    const montantApresRemise = Math.max(0, sousTotal - (remise || 0));
    const tva = montantApresRemise * 0.18;
    const total = montantApresRemise + tva;

    return {
      sousTotal: isNaN(sousTotal) ? 0 : sousTotal,
      montantApresRemise: isNaN(montantApresRemise) ? 0 : montantApresRemise,
      tva: isNaN(tva) ? 0 : tva,
      total: isNaN(total) ? 0 : total,
    };
  }, [panier, remise]);

  const monnaieRendue = useMemo(() => {
    if (modePaiement === "especes" && montantRecu) {
      const recu = parseFloat(montantRecu);
      return Math.max(0, recu - calculs.total);
    }
    return 0;
  }, [modePaiement, montantRecu, calculs.total]);

  // Scanner QR Code
  const pickImageFromGallery = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert("Permission refusée", "Accès à la galerie refusé.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      // Traitement de l'image pour détection QR code
      Alert.alert("Scanner", "Image sélectionnée pour analyse");
      setShowScanner(false);
    }
  };

  // Paiement
  const procederPaiement = async () => {
    if (panier.length === 0) {
      Alert.alert(
        "Panier vide",
        "Ajoutez des produits avant de procéder au paiement"
      );
      return;
    }

    if (!modePaiement) {
      Alert.alert(
        "Mode de paiement",
        "Veuillez sélectionner un mode de paiement"
      );
      return;
    }

    // Validations spécifiques
    if (
      (modePaiement === "mtn" || modePaiement === "moov") &&
      !numeroTransaction
    ) {
      Alert.alert("Validation", "Veuillez saisir le numéro de téléphone");
      return;
    }

    if (modePaiement === "especes" && !montantRecu) {
      Alert.alert("Validation", "Veuillez saisir le montant reçu");
      return;
    }

    if (modePaiement === "especes" && parseFloat(montantRecu) < calculs.total) {
      Alert.alert(
        "Montant insuffisant",
        `Il manque ${(calculs.total - parseFloat(montantRecu)).toLocaleString()} FCFA`
      );
      return;
    }

    if (modePaiement === "carte" && !referenceCarte) {
      Alert.alert("Validation", "Veuillez saisir la référence de la carte");
      return;
    }

    setIsProcessing(true);

    try {
      // Vérification des stocks
      for (const item of panier) {
        const token = await SecureStore.getItemAsync("auth_token");
        const response = await apiFetch(
          `/produits/${item.produit.id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const produit = await response.json();
          if (produit.quantite_stock < item.quantite) {
            throw new Error(
              `Stock insuffisant pour ${item.produit.nom}. Il reste ${produit.quantite_stock} unités.`
            );
          }
        }
      }

      // Données de vente
      const donneesVente = {
        ligne_ventes: panier.map((item) => ({
          produit_id: item.produit.id,
          quantite: item.quantite,
        })),
        remise: remise,
        notes: notes,
        client_id: clientId,
        mode_paiement: modePaiement,
        numero_transaction:
          modePaiement === "mtn" || modePaiement === "moov"
            ? numeroTransaction
            : null,
        reference_carte: modePaiement === "carte" ? referenceCarte : null,
        banque: modePaiement === "carte" ? banqueSelectionnee : null,
        montant_recu:
          modePaiement === "especes" ? parseFloat(montantRecu) : null,
      };

      const token = await SecureStore.getItemAsync("auth_token");
      const response = await apiFetch("/ventes", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(donneesVente),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Erreur HTTP ${response.status}`);
      }

      const venteConfirmee: VenteResponse = await response.json();

      setLastVente(venteConfirmee);
      setShowTicket(true);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Recharger les produits
      await chargerProduits();
      viderPanier();
    } catch (error) {
      console.error("Erreur paiement:", error);
      Alert.alert(
        "Erreur",
        error instanceof Error ? error.message : "Erreur lors du paiement"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Recherche
  const produitsFiltres = useMemo(() => {
    if (!recherche.trim()) return produits;

    const terme = recherche.toLowerCase();
    return produits.filter(
      (produit) =>
        produit.nom.toLowerCase().includes(terme) ||
        produit.categorie?.nom.toLowerCase().includes(terme)
    );
  }, [produits, recherche]);

  // Impression ticket
  const imprimerTicket = async () => {
    if (!lastVente) return;

    try {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Ticket de caisse</title>
          <style>
            body { font-family: monospace; font-size: 12px; margin: 0; padding: 10px; }
            .ticket { width: 80mm; }
            .header { text-align: center; margin-bottom: 15px; }
            .company { font-weight: bold; font-size: 16px; }
            .info { margin-bottom: 10px; }
            .items { width: 100%; border-collapse: collapse; margin: 10px 0; }
            .items th { border-bottom: 1px solid #000; padding: 5px 0; }
            .items td { padding: 3px 0; border-bottom: 1px dashed #ccc; }
            .total { margin-top: 15px; border-top: 2px solid #000; padding-top: 10px; }
            .footer { margin-top: 20px; text-align: center; font-size: 10px; }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="header">
              <div class="company">SGCI BÉNIN</div>
              <div>Système de Gestion Commerciale Intelligente</div>
              <div>-------------------------------</div>
            </div>
            
            <div class="info">
              <div>Ticket: ${lastVente.numero_vente || lastVente.id}</div>
              <div>Date: ${new Date(lastVente.created_at).toLocaleString("fr-FR")}</div>
              <div>Caissier: ${user?.name || "System"}</div>
              <div>Client: ${lastVente.client?.nom || "Anonyme"}</div>
              <div>Mode: ${lastVente.mode_paiement?.toUpperCase() || "ESPÈCES"}</div>
            </div>
            
            <table class="items">
              <thead>
                <tr>
                  <th align="left">Article</th>
                  <th align="center">Qté</th>
                  <th align="right">Prix</th>
                  <th align="right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${lastVente.ligne_ventes
                  .map(
                    (ligne) => `
                  <tr>
                    <td>${ligne.produit.nom}</td>
                    <td align="center">${ligne.quantite}</td>
                    <td align="right">${ligne.prix_unitaire.toLocaleString()}</td>
                    <td align="right">${(ligne.prix_unitaire * ligne.quantite).toLocaleString()}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
            
            <div class="total">
              <div>Sous-total: ${(lastVente.montant_total - lastVente.tva + lastVente.remise).toLocaleString()} FCFA</div>
              ${lastVente.remise > 0 ? `<div>Remise: -${lastVente.remise.toLocaleString()} FCFA</div>` : ""}
              <div>TVA (18%): ${lastVente.tva.toLocaleString()} FCFA</div>
              <div style="font-weight: bold; font-size: 14px;">
                TOTAL: ${lastVente.montant_total.toLocaleString()} FCFA
              </div>
            </div>
            
            <div class="footer">
              <div>Merci de votre confiance !</div>
              <div>Reçu électronique</div>
              <div>-------------------------------</div>
            </div>
          </div>
        </body>
        </html>
      `;

      await Print.printAsync({ html });
    } catch (error) {
      console.error("Erreur impression:", error);
      Alert.alert("Erreur", "Impossible d'imprimer le ticket");
    }
  };

  // Composants
  const ProductItem = ({
    produit,
    index,
  }: {
    produit: Produit;
    index: number;
  }) => (
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
        onPress={() => ajouterAuPanier(produit)}
        activeOpacity={0.7}
      >
        {/* Image produit */}
        {produit.image_url ? (
          <Image
            source={{ uri: produit.image_url }}
            style={styles.productImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Barcode size={24} color="#94a3b8" />
          </View>
        )}

        {/* Infos produit */}
        <View style={styles.productInfo}>
          <View style={styles.productHeader}>
            <Text style={styles.productName} numberOfLines={1}>
              {produit.nom}
            </Text>
            {produit.categorie && (
              <Badge variant="secondary" style={styles.productCategory}>
                {produit.categorie.nom}
              </Badge>
            )}
          </View>

          <View style={styles.productDetails}>
            <Text style={styles.productPrice}>
              {produit.prix.toLocaleString()} FCFA
            </Text>

            <Badge
              variant={
                produit.quantite_stock === 0
                  ? "destructive"
                  : produit.quantite_stock < 5
                    ? "secondary"
                    : "default"
              }
              style={[
                styles.productStock,
                produit.quantite_stock === 0 && styles.productOutOfStock,
                produit.quantite_stock < 5 &&
                  produit.quantite_stock > 0 &&
                  styles.productLowStock,
              ]}
            >
              Stock: {produit.quantite_stock}
            </Badge>
          </View>

          {/* Bouton ajouter */}
          <TouchableOpacity
            style={[
              styles.addButton,
              produit.quantite_stock === 0 && styles.addButtonDisabled,
            ]}
            onPress={() => ajouterAuPanier(produit)}
            disabled={produit.quantite_stock === 0}
          >
            {produit.quantite_stock === 0 ? (
              <Text style={styles.addButtonTextDisabled}>Rupture</Text>
            ) : (
              <>
                <Plus size={16} color="#ffffff" />
                <Text style={styles.addButtonText}>Ajouter</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const CartItem = ({ item, index }: { item: LignePanier; index: number }) => (
    <Animated.View
      style={[
        styles.cartItem,
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
      <View style={styles.cartItemContent}>
        {/* Infos produit */}
        <View style={styles.cartItemLeft}>
          {item.produit.image_url ? (
            <Image
              source={{ uri: item.produit.image_url }}
              style={styles.cartItemImage}
            />
          ) : (
            <View style={styles.cartItemImagePlaceholder}>
              <Package size={20} color="#94a3b8" />
            </View>
          )}

          <View style={styles.cartItemInfo}>
            <Text style={styles.cartItemName} numberOfLines={1}>
              {item.produit.nom}
            </Text>
            <Text style={styles.cartItemPrice}>
              {item.prixUnitaire.toLocaleString()} FCFA
            </Text>
            <Text style={styles.cartItemSubtotal}>
              Sous-total: {item.sousTotal.toLocaleString()} FCFA
            </Text>
          </View>
        </View>

        {/* Contrôle quantité */}
        <View style={styles.cartItemRight}>
          <View style={styles.quantityControl}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() =>
                modifierQuantite(item.produit.id, item.quantite - 1)
              }
              disabled={isProcessing}
            >
              <Minus size={16} color="#64748b" />
            </TouchableOpacity>

            <Text style={styles.quantityText}>{item.quantite}</Text>

            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() =>
                modifierQuantite(item.produit.id, item.quantite + 1)
              }
              disabled={isProcessing}
            >
              <Plus size={16} color="#64748b" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => retirerDuPanier(item.produit.id)}
            disabled={isProcessing}
          >
            <Trash2 size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
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
              colors={["#22c55e", "#16a34a"]}
              style={styles.headerLogo}
            >
              <ShoppingCart size={24} color="#ffffff" />
            </LinearGradient>
            <View>
              <Text style={styles.headerTitle}>Caisse Gaming</Text>
              <Text style={styles.headerSubtitle}>Interface ultra-rapide</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.scanButton}
              onPress={() => setShowScanner(true)}
            >
              <Camera size={20} color="#22c55e" />
            </TouchableOpacity>

            <View style={styles.userAvatar}>
              <Text style={styles.userInitials}>
                {user.name[0].toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Barre de recherche */}
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
      </BlurView>

      {/* Indicateur Gaming */}
      <Animated.View
        style={[
          styles.gamingIndicator,
          {
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <Zap size={16} color="#22c55e" />
        <Text style={styles.gamingText}>Mode Gaming Activé</Text>
      </Animated.View>

      {/* Contenu principal */}
      <Animated.View
        style={[
          styles.mainContent,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideUpAnim }, { scale: scaleAnim }],
          },
        ]}
      >
        {/* Vue en colonnes pour tablette, sinon scroll */}
        {width > 768 ? (
          // Tablet/Desktop - 2 colonnes
          <View style={styles.columnsContainer}>
            {/* Colonne produits */}
            <View style={styles.productsColumn}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Produits Disponibles</Text>
                <View style={styles.sectionStats}>
                  <Text style={styles.sectionStatsText}>
                    {produitsFiltres.length}/{produits.length} produits
                  </Text>
                  <TouchableOpacity
                    style={styles.refreshButton}
                    onPress={chargerProduits}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#3b82f6" />
                    ) : (
                      <RefreshCw size={16} color="#3b82f6" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <FlatList
                data={produitsFiltres}
                renderItem={({ item, index }) => (
                  <ProductItem produit={item} index={index} />
                )}
                keyExtractor={(item) => item.id.toString()}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={["#3b82f6"]}
                  />
                }
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Search size={48} color="#94a3b8" />
                    <Text style={styles.emptyStateTitle}>Aucun produit</Text>
                    <Text style={styles.emptyStateText}>
                      Essayez avec d'autres termes
                    </Text>
                  </View>
                }
              />
            </View>

            {/* Colonne panier */}
            <View style={styles.cartColumn}>
              <BlurView intensity={10} style={styles.cartContainer}>
                {/* En-tête panier */}
                <View style={styles.cartHeader}>
                  <View style={styles.cartHeaderLeft}>
                    <ShoppingCart size={20} color="#22c55e" />
                    <Text style={styles.cartTitle}>Panier de Vente</Text>
                  </View>
                  <Badge variant="outline" style={styles.cartBadge}>
                    {panier.length} articles
                  </Badge>
                </View>

                {/* Liste panier */}
                <ScrollView
                  style={styles.cartList}
                  showsVerticalScrollIndicator={false}
                >
                  {panier.length === 0 ? (
                    <View style={styles.emptyCart}>
                      <ShoppingCart size={48} color="#94a3b8" />
                      <Text style={styles.emptyCartText}>Panier vide</Text>
                      <Text style={styles.emptyCartSubtext}>
                        Ajoutez des produits
                      </Text>
                    </View>
                  ) : (
                    panier.map((item, index) => (
                      <CartItem
                        key={item.produit.id}
                        item={item}
                        index={index}
                      />
                    ))
                  )}
                </ScrollView>

                {/* Détails panier */}
                {panier.length > 0 && (
                  <View style={styles.cartDetails}>
                    {/* Client */}
                    <View style={styles.cartClient}>
                      <User size={16} color="#64748b" />
                      <View style={styles.clientSelect}>
                        <Text style={styles.clientSelectLabel}>Client:</Text>
                        <Text style={styles.clientSelectValue}>
                          {clientId
                            ? clients.find((c) => c.id === clientId)?.nom ||
                              "Client"
                            : "Anonyme"}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.clientButton}
                        onPress={() => {
                          // Afficher modal sélection client
                          Alert.alert(
                            "Sélection client",
                            "Fonctionnalité en développement",
                            [{ text: "OK" }]
                          );
                        }}
                      >
                        <ChevronRight size={16} color="#64748b" />
                      </TouchableOpacity>
                    </View>

                    {/* Notes */}
                    <View style={styles.cartNotes}>
                      <TextInput
                        style={styles.notesInput}
                        placeholder="Notes (optionnel)"
                        placeholderTextColor="#94a3b8"
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        numberOfLines={2}
                      />
                    </View>

                    {/* Modes paiement */}
                    <View style={styles.paymentMethods}>
                      <Text style={styles.paymentMethodsTitle}>
                        Mode paiement
                      </Text>
                      <View style={styles.paymentGrid}>
                        {[
                          {
                            key: "especes",
                            icon: Wallet,
                            label: "Espèces",
                            color: "#22c55e",
                          },
                          {
                            key: "mtn",
                            icon: Smartphone,
                            label: "MTN",
                            color: "#fbbf24",
                          },
                          {
                            key: "moov",
                            icon: Smartphone,
                            label: "Moov",
                            color: "#3b82f6",
                          },
                          {
                            key: "carte",
                            icon: CreditCard,
                            label: "Carte",
                            color: "#8b5cf6",
                          },
                        ].map((method) => (
                          <TouchableOpacity
                            key={method.key}
                            style={[
                              styles.paymentMethod,
                              modePaiement === method.key &&
                                styles.paymentMethodActive,
                              { borderColor: method.color + "40" },
                            ]}
                            onPress={() => setModePaiement(method.key as any)}
                          >
                            <View
                              style={[
                                styles.paymentIcon,
                                { backgroundColor: method.color + "20" },
                              ]}
                            >
                              <method.icon size={20} color={method.color} />
                            </View>
                            <Text style={styles.paymentLabel}>
                              {method.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Champs spécifiques */}
                    {modePaiement && (
                      <Animated.View
                        style={[
                          styles.paymentFields,
                          {
                            opacity: fadeAnim,
                          },
                        ]}
                      >
                        {(modePaiement === "mtn" ||
                          modePaiement === "moov") && (
                          <View style={styles.paymentField}>
                            <Text style={styles.paymentFieldLabel}>
                              Numéro {modePaiement === "mtn" ? "MTN" : "Moov"}
                            </Text>
                            <TextInput
                              style={styles.paymentInput}
                              placeholder="Ex: 67 12 34 56"
                              value={numeroTransaction}
                              onChangeText={setNumeroTransaction}
                              keyboardType="phone-pad"
                            />
                          </View>
                        )}

                        {modePaiement === "carte" && (
                          <>
                            <View style={styles.paymentField}>
                              <Text style={styles.paymentFieldLabel}>
                                Référence carte
                              </Text>
                              <TextInput
                                style={styles.paymentInput}
                                placeholder="Ref. transaction"
                                value={referenceCarte}
                                onChangeText={setReferenceCarte}
                              />
                            </View>
                            <View style={styles.paymentField}>
                              <Text style={styles.paymentFieldLabel}>
                                Banque
                              </Text>
                              <View style={styles.paymentSelect}>
                                <Text style={styles.paymentSelectText}>
                                  {banqueSelectionnee || "Sélectionnez"}
                                </Text>
                                <ChevronDown size={16} color="#64748b" />
                              </View>
                            </View>
                          </>
                        )}

                        {modePaiement === "especes" && (
                          <View style={styles.paymentField}>
                            <Text style={styles.paymentFieldLabel}>
                              Montant reçu
                            </Text>
                            <TextInput
                              style={styles.paymentInput}
                              placeholder="Montant remis"
                              value={montantRecu}
                              onChangeText={setMontantRecu}
                              keyboardType="decimal-pad"
                            />
                            {montantRecu &&
                              parseFloat(montantRecu) > calculs.total && (
                                <Text style={styles.changeText}>
                                  Monnaie à rendre:{" "}
                                  {monnaieRendue.toLocaleString()} FCFA
                                </Text>
                              )}
                          </View>
                        )}
                      </Animated.View>
                    )}

                    {/* Remise */}
                    {showRemiseInput ? (
                      <View style={styles.discountContainer}>
                        <Text style={styles.discountLabel}>Remise (FCFA)</Text>
                        <View style={styles.discountInputRow}>
                          <TextInput
                            style={styles.discountInput}
                            value={remise.toString()}
                            onChangeText={(text) =>
                              setRemise(Math.max(0, Number(text) || 0))
                            }
                            keyboardType="decimal-pad"
                          />
                          <TouchableOpacity
                            style={styles.discountClose}
                            onPress={() => setShowRemiseInput(false)}
                          >
                            <X size={16} color="#64748b" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.discountButton}
                        onPress={() => setShowRemiseInput(true)}
                      >
                        <Percent size={16} color="#3b82f6" />
                        <Text style={styles.discountButtonText}>Remise</Text>
                      </TouchableOpacity>
                    )}

                    {/* Récapitulatif */}
                    <View style={styles.summary}>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Sous-total</Text>
                        <Text style={styles.summaryValue}>
                          {calculs.sousTotal.toLocaleString()} FCFA
                        </Text>
                      </View>

                      {remise > 0 && (
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>Remise</Text>
                          <Text style={styles.summaryDiscount}>
                            -{remise.toLocaleString()} FCFA
                          </Text>
                        </View>
                      )}

                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>TVA (18%)</Text>
                        <Text style={styles.summaryValue}>
                          {calculs.tva.toLocaleString()} FCFA
                        </Text>
                      </View>

                      <View style={[styles.summaryRow, styles.totalRow]}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>
                          {calculs.total.toLocaleString()} FCFA
                        </Text>
                      </View>
                    </View>

                    {/* Actions */}
                    <View style={styles.cartActions}>
                      <TouchableOpacity
                        style={styles.clearButton}
                        onPress={viderPanier}
                        disabled={isProcessing}
                      >
                        <Trash2 size={20} color="#ef4444" />
                        <Text style={styles.clearButtonText}>Vider</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.payButton,
                          (!modePaiement || isProcessing) &&
                            styles.payButtonDisabled,
                        ]}
                        onPress={procederPaiement}
                        disabled={!modePaiement || isProcessing}
                      >
                        {isProcessing ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <>
                            <Calculator size={20} color="#ffffff" />
                            <Text style={styles.payButtonText}>Payer</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </BlurView>
            </View>
          </View>
        ) : (
          // Mobile - Scroll vertical
          <ScrollView
            style={styles.mobileScroll}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#3b82f6"]}
              />
            }
          >
            {/* Section produits */}
            <View style={styles.mobileSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Produits Disponibles</Text>
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={chargerProduits}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#3b82f6" />
                  ) : (
                    <RefreshCw size={16} color="#3b82f6" />
                  )}
                </TouchableOpacity>
              </View>

              <FlatList
                data={produitsFiltres}
                renderItem={({ item, index }) => (
                  <ProductItem produit={item} index={index} />
                )}
                keyExtractor={(item) => item.id.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.productsHorizontalList}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Search size={48} color="#94a3b8" />
                    <Text style={styles.emptyStateTitle}>Aucun produit</Text>
                    <Text style={styles.emptyStateText}>
                      Essayez avec d'autres termes
                    </Text>
                  </View>
                }
              />
            </View>

            {/* Section panier */}
            <View style={styles.mobileSection}>
              <BlurView intensity={10} style={styles.mobileCart}>
                <View style={styles.cartHeader}>
                  <View style={styles.cartHeaderLeft}>
                    <ShoppingCart size={20} color="#22c55e" />
                    <Text style={styles.cartTitle}>Panier</Text>
                  </View>
                  <Badge variant="outline" style={styles.cartBadge}>
                    {panier.length} articles
                  </Badge>
                </View>

                {panier.length === 0 ? (
                  <View style={styles.emptyCart}>
                    <ShoppingCart size={48} color="#94a3b8" />
                    <Text style={styles.emptyCartText}>Panier vide</Text>
                    <Text style={styles.emptyCartSubtext}>
                      Ajoutez des produits
                    </Text>
                  </View>
                ) : (
                  <>
                    {panier.map((item, index) => (
                      <CartItem
                        key={item.produit.id}
                        item={item}
                        index={index}
                      />
                    ))}

                    {/* Détails mobile */}
                    <View style={styles.mobileCartDetails}>
                      {/* (Contenu similaire à la version tablette mais adapté) */}
                      {/* ... */}
                    </View>
                  </>
                )}
              </BlurView>
            </View>
          </ScrollView>
        )}
      </Animated.View>

      {/* Scanner Modal */}
      <Modal
        visible={showScanner}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowScanner(false)}
      >
        <SafeAreaView style={styles.scannerModal}>
          <View style={styles.scannerHeader}>
            <TouchableOpacity
              style={styles.scannerClose}
              onPress={() => setShowScanner(false)}
            >
              <X size={24} color="#64748b" />
            </TouchableOpacity>
            <Text style={styles.scannerTitle}>Scanner</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.scannerContent}>
            <View style={styles.scannerPreview}>
              <Text style={styles.scannerInstructions}>
                Fonctionnalité en développement
              </Text>
              <Camera size={64} color="#94a3b8" />
            </View>

            <View style={styles.scannerActions}>
              <TouchableOpacity
                style={styles.scannerButton}
                onPress={pickImageFromGallery}
              >
                <ImageIcon size={20} color="#ffffff" />
                <Text style={styles.scannerButtonText}>Galerie</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.scannerButtonSecondary}
                onPress={() => setShowScanner(false)}
              >
                <Text style={styles.scannerButtonSecondaryText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Ticket Modal */}
      <Modal
        visible={showTicket}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTicket(false)}
      >
        <SafeAreaView style={styles.ticketModal}>
          <View style={styles.ticketHeader}>
            <TouchableOpacity
              style={styles.ticketClose}
              onPress={() => setShowTicket(false)}
            >
              <X size={24} color="#64748b" />
            </TouchableOpacity>
            <Text style={styles.ticketTitle}>Ticket de caisse</Text>
            <TouchableOpacity
              style={styles.ticketPrint}
              onPress={imprimerTicket}
            >
              <Printer size={20} color="#3b82f6" />
            </TouchableOpacity>
          </View>

          {lastVente && (
            <ScrollView style={styles.ticketContent}>
              <BlurView intensity={10} style={styles.ticketCard}>
                {/* Contenu du ticket */}
                <View style={styles.ticketInfo}>
                  <Text style={styles.ticketStore}>SGCI BÉNIN</Text>
                  <Text style={styles.ticketSubtitle}>
                    Système de Gestion Commerciale Intelligente
                  </Text>

                  <View style={styles.ticketDivider} />

                  <View style={styles.ticketRow}>
                    <Text style={styles.ticketLabel}>N° Ticket:</Text>
                    <Text style={styles.ticketValue}>
                      {lastVente.numero_vente || `VENT-${lastVente.id}`}
                    </Text>
                  </View>

                  <View style={styles.ticketRow}>
                    <Text style={styles.ticketLabel}>Date:</Text>
                    <Text style={styles.ticketValue}>
                      {new Date(lastVente.created_at).toLocaleString("fr-FR")}
                    </Text>
                  </View>

                  <View style={styles.ticketRow}>
                    <Text style={styles.ticketLabel}>Caissier:</Text>
                    <Text style={styles.ticketValue}>
                      {user?.name || "System"}
                    </Text>
                  </View>

                  <View style={styles.ticketRow}>
                    <Text style={styles.ticketLabel}>Client:</Text>
                    <Text style={styles.ticketValue}>
                      {lastVente.client?.nom || "Anonyme"}
                    </Text>
                  </View>

                  <View style={styles.ticketRow}>
                    <Text style={styles.ticketLabel}>Mode paiement:</Text>
                    <Text style={styles.ticketValue}>
                      {lastVente.mode_paiement?.toUpperCase() || "ESPÈCES"}
                    </Text>
                  </View>

                  <View style={styles.ticketDivider} />

                  {/* Articles */}
                  <Text style={styles.ticketSectionTitle}>ARTICLES</Text>
                  {lastVente.ligne_ventes.map((ligne, index) => (
                    <View key={index} style={styles.ticketItem}>
                      <View style={styles.ticketItemHeader}>
                        <Text style={styles.ticketItemName} numberOfLines={1}>
                          {ligne.produit.nom}
                        </Text>
                        <Text style={styles.ticketItemTotal}>
                          {(
                            ligne.prix_unitaire * ligne.quantite
                          ).toLocaleString()}{" "}
                          F
                        </Text>
                      </View>
                      <View style={styles.ticketItemDetails}>
                        <Text style={styles.ticketItemDetail}>
                          {ligne.quantite} ×{" "}
                          {ligne.prix_unitaire.toLocaleString()} F
                        </Text>
                      </View>
                    </View>
                  ))}

                  <View style={styles.ticketDivider} />

                  {/* Totaux */}
                  <View style={styles.ticketTotals}>
                    <View style={styles.ticketTotalRow}>
                      <Text style={styles.ticketTotalLabel}>Sous-total:</Text>
                      <Text style={styles.ticketTotalValue}>
                        {(
                          lastVente.montant_total -
                          lastVente.tva +
                          lastVente.remise
                        ).toLocaleString()}{" "}
                        FCFA
                      </Text>
                    </View>

                    {lastVente.remise > 0 && (
                      <View style={styles.ticketTotalRow}>
                        <Text style={styles.ticketTotalLabel}>Remise:</Text>
                        <Text style={styles.ticketTotalDiscount}>
                          -{lastVente.remise.toLocaleString()} FCFA
                        </Text>
                      </View>
                    )}

                    <View style={styles.ticketTotalRow}>
                      <Text style={styles.ticketTotalLabel}>TVA (18%):</Text>
                      <Text style={styles.ticketTotalValue}>
                        {lastVente.tva.toLocaleString()} FCFA
                      </Text>
                    </View>

                    {lastVente.monnaie_rendue &&
                      lastVente.monnaie_rendue > 0 && (
                        <View style={styles.ticketTotalRow}>
                          <Text style={styles.ticketTotalLabel}>
                            Monnaie rendue:
                          </Text>
                          <Text style={styles.ticketTotalChange}>
                            {lastVente.monnaie_rendue.toLocaleString()} FCFA
                          </Text>
                        </View>
                      )}

                    <View
                      style={[styles.ticketTotalRow, styles.ticketGrandTotal]}
                    >
                      <Text style={styles.ticketGrandTotalLabel}>TOTAL:</Text>
                      <Text style={styles.ticketGrandTotalValue}>
                        {lastVente.montant_total.toLocaleString()} FCFA
                      </Text>
                    </View>
                  </View>

                  <View style={styles.ticketDivider} />

                  <Text style={styles.ticketFooter}>
                    Merci de votre confiance !
                  </Text>
                  <Text style={styles.ticketFooterSmall}>
                    Reçu électronique - Conservez ce ticket
                  </Text>
                </View>
              </BlurView>

              <View style={styles.ticketActions}>
                <TouchableOpacity
                  style={styles.ticketActionButton}
                  onPress={imprimerTicket}
                >
                  <Printer size={20} color="#ffffff" />
                  <Text style={styles.ticketActionButtonText}>Imprimer</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.ticketActionButtonSecondary}
                  onPress={() => setShowTicket(false)}
                >
                  <CheckCircle2 size={20} color="#3b82f6" />
                  <Text style={styles.ticketActionButtonSecondaryText}>
                    Terminer
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
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
    marginTop: 12,
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
    marginBottom: 16,
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
  scanButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    marginRight: 8,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
  },
  userInitials: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    paddingHorizontal: 12,
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
  // Gaming indicator
  gamingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    backgroundColor: "rgba(34, 197, 94, 0.1)",
  },
  gamingText: {
    color: "#22c55e",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 6,
  },
  // Main content
  mainContent: {
    flex: 1,
    paddingBottom: 100, // Pour bottom tab bar
  },
  // Tablet/Desktop layout
  columnsContainer: {
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  productsColumn: {
    flex: 2,
    marginRight: 16,
  },
  cartColumn: {
    flex: 1,
  },
  cartContainer: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    overflow: "hidden",
  },
  // Section headers
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
  },
  sectionStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionStatsText: {
    color: "#94a3b8",
    fontSize: 12,
    marginRight: 8,
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  // Product card
  productCard: {
    marginBottom: 12,
  },
  productCardInner: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    overflow: "hidden",
  },
  productImage: {
    width: 80,
    height: 80,
  },
  productImagePlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  productInfo: {
    flex: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  productHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  productName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
    marginRight: 8,
  },
  productCategory: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderColor: "rgba(59, 130, 246, 0.2)",
  },
  productDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#22c55e",
  },
  productStock: {
    fontSize: 10,
  },
  productOutOfStock: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  productLowStock: {
    backgroundColor: "rgba(249, 115, 22, 0.1)",
    borderColor: "rgba(249, 115, 22, 0.2)",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#22c55e",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addButtonDisabled: {
    backgroundColor: "rgba(148, 163, 184, 0.5)",
  },
  addButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    marginLeft: 4,
  },
  addButtonTextDisabled: {
    color: "#ffffff",
    fontWeight: "600",
  },
  // Cart
  cartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  cartHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  cartTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginLeft: 8,
  },
  cartBadge: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderColor: "rgba(34, 197, 94, 0.2)",
    color: "#22c55e",
  },
  cartList: {
    flex: 1,
    padding: 16,
  },
  emptyCart: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyCartText: {
    fontSize: 16,
    color: "#ffffff",
    marginTop: 12,
    marginBottom: 4,
  },
  emptyCartSubtext: {
    fontSize: 14,
    color: "#94a3b8",
  },
  // Cart item
  cartItem: {
    marginBottom: 8,
  },
  cartItemContent: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 12,
  },
  cartItemLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  cartItemImage: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 12,
  },
  cartItemImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 2,
  },
  cartItemPrice: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 2,
  },
  cartItemSubtotal: {
    fontSize: 12,
    color: "#22c55e",
    fontWeight: "600",
  },
  cartItemRight: {
    alignItems: "center",
    justifyContent: "space-between",
  },
  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 6,
    marginBottom: 8,
  },
  quantityButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  quantityText: {
    width: 32,
    textAlign: "center",
    color: "#ffffff",
    fontWeight: "600",
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  // Cart details
  cartDetails: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  cartClient: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  clientSelect: {
    flex: 1,
    marginLeft: 8,
  },
  clientSelectLabel: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 2,
  },
  clientSelectValue: {
    fontSize: 14,
    color: "#ffffff",
    fontWeight: "500",
  },
  clientButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  cartNotes: {
    marginBottom: 12,
  },
  notesInput: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    padding: 12,
    color: "#ffffff",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    minHeight: 80,
    textAlignVertical: "top",
  },
  // Payment methods
  paymentMethods: {
    marginBottom: 12,
  },
  paymentMethodsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 8,
  },
  paymentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  paymentMethod: {
    width: "48%",
    margin: "1%",
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
  },
  paymentMethodActive: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  paymentLabel: {
    fontSize: 12,
    color: "#ffffff",
    fontWeight: "500",
  },
  // Payment fields
  paymentFields: {
    marginBottom: 12,
  },
  paymentField: {
    marginBottom: 8,
  },
  paymentFieldLabel: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 4,
  },
  paymentInput: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    padding: 12,
    color: "#ffffff",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  paymentSelect: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  paymentSelectText: {
    color: "#ffffff",
    fontSize: 14,
  },
  changeText: {
    fontSize: 12,
    color: "#3b82f6",
    marginTop: 4,
  },
  // Discount
  discountContainer: {
    marginBottom: 12,
  },
  discountLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 4,
  },
  discountInputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  discountInput: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    padding: 12,
    color: "#ffffff",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    marginRight: 8,
  },
  discountClose: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  discountButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.2)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  discountButtonText: {
    color: "#3b82f6",
    fontWeight: "600",
    marginLeft: 8,
  },
  // Summary
  summary: {
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  summaryLabel: {
    fontSize: 14,
    color: "#94a3b8",
  },
  summaryValue: {
    fontSize: 14,
    color: "#ffffff",
    fontWeight: "500",
  },
  summaryDiscount: {
    fontSize: 14,
    color: "#22c55e",
    fontWeight: "600",
  },
  totalRow: {
    borderBottomWidth: 0,
    paddingTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ffffff",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#22c55e",
  },
  // Cart actions
  cartActions: {
    flexDirection: "row",
    gap: 12,
  },
  clearButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
    borderRadius: 8,
    padding: 12,
  },
  clearButtonText: {
    color: "#ef4444",
    fontWeight: "600",
    marginLeft: 8,
  },
  payButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#22c55e",
    borderRadius: 8,
    padding: 12,
  },
  payButtonDisabled: {
    backgroundColor: "rgba(148, 163, 184, 0.5)",
  },
  payButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    marginLeft: 8,
  },
  // Mobile layout
  mobileScroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  mobileSection: {
    marginBottom: 20,
  },
  productsHorizontalList: {
    flexGrow: 0,
  },
  mobileCart: {
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    overflow: "hidden",
  },
  mobileCartDetails: {
    padding: 16,
  },
  // Empty states
  emptyState: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyStateTitle: {
    fontSize: 16,
    color: "#ffffff",
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#94a3b8",
  },
  // Scanner modal
  scannerModal: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  scannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  scannerClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  scannerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
  },
  scannerContent: {
    flex: 1,
    padding: 20,
  },
  scannerPreview: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  scannerInstructions: {
    color: "#94a3b8",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  scannerActions: {
    gap: 12,
  },
  scannerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    padding: 16,
  },
  scannerButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    marginLeft: 8,
  },
  scannerButtonSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    padding: 16,
  },
  scannerButtonSecondaryText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  // Ticket modal
  ticketModal: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  ticketHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  ticketClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  ticketTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
  },
  ticketPrint: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
  },
  ticketContent: {
    flex: 1,
    padding: 20,
  },
  ticketCard: {
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    overflow: "hidden",
  },
  ticketInfo: {
    padding: 20,
  },
  ticketStore: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 4,
  },
  ticketSubtitle: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 16,
  },
  ticketDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginVertical: 12,
  },
  ticketRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  ticketLabel: {
    fontSize: 12,
    color: "#94a3b8",
  },
  ticketValue: {
    fontSize: 12,
    color: "#ffffff",
    fontWeight: "500",
  },
  ticketSectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 8,
  },
  ticketItem: {
    marginBottom: 8,
  },
  ticketItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ticketItemName: {
    flex: 1,
    fontSize: 12,
    color: "#ffffff",
    marginRight: 8,
  },
  ticketItemTotal: {
    fontSize: 12,
    color: "#ffffff",
    fontWeight: "600",
  },
  ticketItemDetails: {
    marginTop: 2,
  },
  ticketItemDetail: {
    fontSize: 10,
    color: "#94a3b8",
  },
  ticketTotals: {
    marginTop: 16,
  },
  ticketTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  ticketTotalLabel: {
    fontSize: 12,
    color: "#94a3b8",
  },
  ticketTotalValue: {
    fontSize: 12,
    color: "#ffffff",
  },
  ticketTotalDiscount: {
    fontSize: 12,
    color: "#22c55e",
    fontWeight: "600",
  },
  ticketTotalChange: {
    fontSize: 12,
    color: "#3b82f6",
  },
  ticketGrandTotal: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  ticketGrandTotalLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#ffffff",
  },
  ticketGrandTotalValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#22c55e",
  },
  ticketFooter: {
    fontSize: 12,
    color: "#ffffff",
    textAlign: "center",
    marginTop: 16,
  },
  ticketFooterSmall: {
    fontSize: 10,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 4,
  },
  ticketActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  ticketActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    padding: 16,
  },
  ticketActionButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    marginLeft: 8,
  },
  ticketActionButtonSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    padding: 16,
  },
  ticketActionButtonSecondaryText: {
    color: "#ffffff",
    fontWeight: "600",
    marginLeft: 8,
  },
});
