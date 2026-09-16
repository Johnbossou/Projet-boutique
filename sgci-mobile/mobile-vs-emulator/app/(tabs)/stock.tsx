import { ProductImagePlaceholder } from "@/components/ProductImagePlaceholder";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api-client";
import { useRouter, type Href } from "expo-router";
import {
  AlertTriangle,
  CheckCircle2,
  History,
  PackageSearch,
  RefreshCw,
  Truck,
  XCircle,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface ProduitStock {
  id: number;
  nom: string;
  quantite_stock: number;
  seuil_alerte: number;
  categorie?: { nom: string; couleur?: string };
  image_url?: string;
  images?: string[];
}

interface Mouvement {
  id: number;
  quantite: number;
  raison: string;
  type: string;
  statut: string;
  produit?: { nom: string };
  created_at: string;
}

type StatutStock = "rupture" | "alerte" | "ok";

const statutProduit = (p: ProduitStock): StatutStock => {
  if (p.quantite_stock <= 0) return "rupture";
  if (p.quantite_stock <= p.seuil_alerte) return "alerte";
  return "ok";
};

const STATUT_COLOR: Record<StatutStock, string> = {
  rupture: "#ef4444",
  alerte: "#f97316",
  ok: "#22c55e",
};

const STATUT_LABEL: Record<StatutStock, string> = {
  rupture: "Rupture",
  alerte: "En alerte",
  ok: "OK",
};

export default function StockScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const isGerant = user?.role === "gerant";
  const [produits, setProduits] = useState<ProduitStock[]>([]);
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtre, setFiltre] = useState<"all" | "en_attente">("all");

  const chargerProduits = useCallback(async () => {
    try {
      const res = await apiFetch("/produits?per_page=100");
      if (res.ok) {
        const d = await res.json();
        const data = Array.isArray(d.data) ? d.data : d;
        setProduits(data.filter((p: ProduitStock) => p && typeof p.id === "number"));
      }
    } finally {
      // rien
    }
  }, []);

  const chargerMouvements = useCallback(async () => {
    try {
      const params = new URLSearchParams({ per_page: "50" });
      if (filtre === "en_attente") params.set("statut", "en_attente");
      const res = await apiFetch(`/mouvements-stock?${params}`);
      if (res.ok) {
        const d = await res.json();
        setMouvements(Array.isArray(d.data) ? d.data : []);
      }
    } finally {
      // rien
    }
  }, [filtre]);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([chargerProduits(), chargerMouvements()]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [chargerProduits, chargerMouvements]);

  useEffect(() => {
    charger();
  }, [charger]);

  useEffect(() => {
    chargerMouvements();
  }, [chargerMouvements]);

  const onRefresh = async () => {
    setRefreshing(true);
    await charger();
  };

  const valider = async (id: number) => {
    const res = await apiFetch(`/mouvements-stock/${id}/valider`, { method: "POST" });
    if (res.ok) {
      Alert.alert("OK", "Mouvement validé");
      chargerMouvements();
    } else {
      const e = await res.json().catch(() => ({}));
      Alert.alert("Erreur", e.error || "Réservé au gérant");
    }
  };

  const rejeter = (id: number) => {
    Alert.alert("Rejeter", "Confirmer le rejet ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Rejeter",
        style: "destructive",
        onPress: async () => {
          const res = await apiFetch(`/mouvements-stock/${id}/rejeter`, {
            method: "POST",
            body: JSON.stringify({ raison_rejet: "Rejet manuel" }),
          });
          if (res.ok) chargerMouvements();
        },
      },
    ]);
  };

  const produitsTries = useCallback(() => {
    const order: Record<StatutStock, number> = { rupture: 0, alerte: 1, ok: 2 };
    return [...produits].sort((a, b) => {
      const diff = order[statutProduit(a)] - order[statutProduit(b)];
      if (diff !== 0) return diff;
      return a.nom.localeCompare(b.nom);
    });
  }, [produits]);

  const enAlerte = produits.filter(
    (p) => p.quantite_stock > 0 && p.quantite_stock <= p.seuil_alerte
  ).length;
  const enRupture = produits.filter((p) => p.quantite_stock <= 0).length;
  const enAttente = mouvements.filter((m) => m.statut === "en_attente").length;

  const renderProduit = ({ item }: { item: ProduitStock }) => {
    const st = statutProduit(item);
    const color = STATUT_COLOR[st];
    const pct =
      item.seuil_alerte > 0
        ? Math.min(100, Math.round((item.quantite_stock / item.seuil_alerte) * 100))
        : 100;

    return (
      <View style={styles.prodCard}>
        <ProductImagePlaceholder
          nom={item.nom}
          couleur={item.categorie?.couleur || "#3b82f6"}
          size={52}
        />
        <View style={styles.prodInfo}>
          <Text style={styles.prodName} numberOfLines={1}>
            {item.nom}
          </Text>
          <Text style={styles.prodCat} numberOfLines={1}>
            {item.categorie?.nom ?? "Non catégorisé"}
          </Text>
          <View style={styles.stockLine}>
            <View style={[styles.stockDot, { backgroundColor: color }]} />
            <Text style={[styles.stockLabel, { color }]}>{STATUT_LABEL[st]}</Text>
            <Text style={styles.seuilText}>· seuil {item.seuil_alerte}</Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { backgroundColor: color, width: `${pct}%` }]}
            />
          </View>
        </View>
        <Text style={[styles.prodQty, { color }]}>{item.quantite_stock}</Text>
      </View>
    );
  };

  const renderMouvement = ({ item }: { item: Mouvement }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.produit?.nom ?? "—"}
        </Text>
        <Text style={[styles.cardStatut, item.statut === "en_attente" && styles.cardStatutAttente]}>
          {item.statut}
        </Text>
      </View>
      <Text style={styles.cardSub}>
        {item.type} · {item.raison} · {item.quantite} u.
      </Text>
      <Text style={styles.date}>{new Date(item.created_at).toLocaleString("fr-FR")}</Text>
      {isGerant && item.statut === "en_attente" && (
        <View style={styles.row}>
          <TouchableOpacity style={styles.btnOk} onPress={() => valider(item.id)}>
            <CheckCircle2 color="#fff" size={16} />
            <Text style={styles.btnText}>Valider</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnKo} onPress={() => rejeter(item.id)}>
            <XCircle color="#fff" size={16} />
            <Text style={styles.btnText}>Rejeter</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const stats = [
    { label: "Produits", value: produits.length, color: "#3b82f6", icon: PackageSearch },
    { label: "En alerte", value: enAlerte, color: "#f97316", icon: AlertTriangle },
    { label: "Rupture", value: enRupture, color: "#ef4444", icon: XCircle },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Stock</Text>
          <Text style={styles.subtitle}>
            {produits.length} produits · {enAlerte + enRupture} à surveiller
          </Text>
        </View>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => setFiltre(filtre === "all" ? "en_attente" : "all")}
        >
          <History color="#3b82f6" size={22} />
          {enAttente > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{enAttente}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.filters}>
        <TouchableOpacity
          style={[styles.filterBtn, filtre === "all" && styles.filterActive]}
          onPress={() => setFiltre("all")}
        >
          <Text style={styles.filterText}>Tous</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filtre === "en_attente" && styles.filterActive]}
          onPress={() => setFiltre("en_attente")}
        >
          <Text style={styles.filterText}>En attente ({enAttente})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkBtn} onPress={() => router.push("/arrivage" as Href)}>
          <Truck color="#facc15" size={16} />
          <Text style={styles.linkText}>Arrivage</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#3b82f6" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={produitsTries()}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={styles.listContent}
          renderItem={renderProduit}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#3b82f6"
              colors={["#3b82f6"]}
            />
          }
          ListHeaderComponent={
            <View>
              <View style={styles.statsRow}>
                {stats.map((s) => (
                  <View key={s.label} style={styles.statCard}>
                    <s.icon size={18} color={s.color} />
                    <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.sectionTitle}>État du stock</Text>
            </View>
          }
          ListEmptyComponent={
            <Text style={styles.empty}>Aucun produit enregistré</Text>
          }
          ListFooterComponent={
            <View>
              <Text style={styles.sectionTitle}>
                Mouvements {filtre === "en_attente" ? "en attente" : ""}
              </Text>
              {mouvements.length === 0 ? (
                <Text style={styles.empty}>
                  Aucun mouvement {filtre === "en_attente" ? "en attente" : "récent"}
                </Text>
              ) : (
                mouvements.map((m) => (
                  <View key={m.id}>{renderMouvement({ item: m })}</View>
                ))
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b1220" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: { color: "#fff", fontSize: 26, fontWeight: "800" },
  subtitle: { color: "#94a3b8", fontSize: 13, marginTop: 2 },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  headerBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  headerBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  filters: { flexDirection: "row", paddingHorizontal: 20, gap: 8, alignItems: "center", marginBottom: 4 },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  filterActive: { backgroundColor: "#3b82f6" },
  filterText: { color: "#e2e8f0", fontSize: 13 },
  linkBtn: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(250, 204, 21, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  linkText: { color: "#facc15", fontWeight: "600", fontSize: 13 },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 8, marginBottom: 22 },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    gap: 2,
  },
  statValue: { fontSize: 22, fontWeight: "800" },
  statLabel: { color: "#94a3b8", fontSize: 11 },
  sectionTitle: {
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  prodCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  prodInfo: { flex: 1, marginLeft: 12 },
  prodName: { color: "#fff", fontSize: 15, fontWeight: "700" },
  prodCat: { color: "#94a3b8", fontSize: 12, marginTop: 1 },
  stockLine: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 6 },
  stockDot: { width: 8, height: 8, borderRadius: 4 },
  stockLabel: { fontSize: 12, fontWeight: "600" },
  seuilText: { color: "#64748b", fontSize: 12 },
  progressBar: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 2,
    marginTop: 8,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 2 },
  prodQty: { fontSize: 22, fontWeight: "800", marginLeft: 12, minWidth: 44, textAlign: "right" },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: "#fff", fontWeight: "600", flex: 1 },
  cardStatut: {
    color: "#94a3b8",
    fontSize: 11,
    textTransform: "capitalize",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  cardStatutAttente: { color: "#facc15", backgroundColor: "rgba(250, 204, 21, 0.12)" },
  cardSub: { color: "#94a3b8", marginTop: 4, fontSize: 13 },
  date: { color: "#64748b", fontSize: 11, marginTop: 6 },
  row: { flexDirection: "row", gap: 10, marginTop: 10 },
  btnOk: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#22c55e",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnKo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ef4444",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  empty: { color: "#64748b", textAlign: "center", marginTop: 24, marginBottom: 12 },
});