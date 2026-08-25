import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api-client";
import { useRouter } from "expo-router";
import { ArrowLeft, RefreshCcw, RotateCcw } from "lucide-react-native";
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

interface Retour {
  id: number;
  reference: string;
  vente_numero: string;
  type: string;
  motif: string;
  montant_rembourse: number;
  statut: string;
  created_at: string;
}

const STATUT_COLORS: Record<string, { bg: string; text: string }> = {
  en_attente: { bg: "#eab308", text: "#000" },
  valide: { bg: "#22c55e", text: "#fff" },
  refuse: { bg: "#ef4444", text: "#fff" },
};

export default function RetoursScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const isGerant = user?.role === "gerant" || user?.role === "proprietaire";
  const [retours, setRetours] = useState<Retour[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtre, setFiltre] = useState<"all" | "en_attente" | "valide">("all");

  const charger = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({ per_page: "50" });
      if (filtre === "en_attente") params.set("statut", "en_attente");
      else if (filtre === "valide") params.set("statut", "valide");
      const res = await apiFetch(`/retours?${params}`);
      if (res.ok) {
        const d = await res.json();
        setRetours(Array.isArray(d.data) ? d.data : []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filtre]);

  useEffect(() => {
    charger();
  }, [charger]);

  const valider = async (id: number) => {
    const res = await apiFetch(`/retours/${id}/valider`, { method: "POST" });
    if (res.ok) {
      Alert.alert("OK", "Retour validé");
      charger();
    } else {
      const e = await res.json().catch(() => ({}));
      Alert.alert("Erreur", e.error || "Action impossible");
    }
  };

  const refuser = async (id: number) => {
    const res = await apiFetch(`/retours/${id}/refuser`, { method: "POST" });
    if (res.ok) {
      Alert.alert("OK", "Retour refusé");
      charger();
    } else {
      const e = await res.json().catch(() => ({}));
      Alert.alert("Erreur", e.error || "Action impossible");
    }
  };

  const afficherDetails = (item: Retour) => {
    const badge = STATUT_COLORS[item.statut] ?? STATUT_COLORS.en_attente;
    const buttons: Array<{ text: string; style?: "cancel" | "destructive"; onPress?: () => void }> = [
      { text: "Fermer", style: "cancel" },
    ];

    if (isGerant && item.statut === "en_attente") {
      buttons.unshift(
        { text: "Refuser", style: "destructive", onPress: () => refuser(item.id) },
        { text: "Valider", onPress: () => valider(item.id) }
      );
    }

    Alert.alert(
      item.reference,
      [
        `Vente : ${item.vente_numero}`,
        `Type : ${item.type}`,
        `Motif : ${item.motif}`,
        `Montant : ${Number(item.montant_rembourse).toLocaleString("fr-FR")} FC`,
        `Statut : ${item.statut.replace("_", " ")}`,
        `Date : ${new Date(item.created_at).toLocaleString("fr-FR")}`,
      ].join("\n"),
      buttons
    );
  };

  const badgeStyle = (statut: string) => {
    const c = STATUT_COLORS[statut] ?? STATUT_COLORS.en_attente;
    return { backgroundColor: c.bg };
  };

  const badgeTextStyle = (statut: string) => {
    const c = STATUT_COLORS[statut] ?? STATUT_COLORS.en_attente;
    return { color: c.text };
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Retours / Remboursements</Text>
        <RotateCcw color="#f97316" size={24} />
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
          <Text style={styles.filterText}>En attente</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filtre === "valide" && styles.filterActive]}
          onPress={() => setFiltre("valide")}
        >
          <Text style={styles.filterText}>Validés</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={retours}
          keyExtractor={(r) => String(r.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => charger(true)}
              tintColor="#f97316"
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => afficherDetails(item)}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{item.reference}</Text>
                <View style={[styles.badge, badgeStyle(item.statut)]}>
                  <Text style={[styles.badgeText, badgeTextStyle(item.statut)]}>
                    {item.statut.replace("_", " ")}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardSub}>
                Vente {item.vente_numero} · {item.type} · {item.motif}
              </Text>
              <View style={styles.cardBottom}>
                <Text style={styles.amount}>
                  {Number(item.montant_rembourse).toLocaleString("fr-FR")} FC
                </Text>
                <Text style={styles.date}>{new Date(item.created_at).toLocaleString("fr-FR")}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Aucun retour</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  filters: { flexDirection: "row", padding: 12, gap: 8, alignItems: "center" },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#1e293b",
  },
  filterActive: { backgroundColor: "#f97316" },
  filterText: { color: "#e2e8f0", fontSize: 13 },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: { color: "#fff", fontWeight: "600", fontSize: 15 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  cardSub: { color: "#94a3b8", marginTop: 6, fontSize: 13 },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  amount: { color: "#f97316", fontWeight: "700", fontSize: 15 },
  date: { color: "#64748b", fontSize: 11 },
  empty: { color: "#64748b", textAlign: "center", marginTop: 40 },
});
