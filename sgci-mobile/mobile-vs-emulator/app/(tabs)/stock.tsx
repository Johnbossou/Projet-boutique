import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api-client";
import { useRouter } from "expo-router";
import { ArrowLeft, CheckCircle2, History, XCircle } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface Mouvement {
  id: number;
  quantite: number;
  raison: string;
  type: string;
  statut: string;
  produit?: { nom: string };
  created_at: string;
}

export default function StockScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const isGerant = user?.role === "gerant";
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState<"all" | "en_attente">("all");

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ per_page: "50" });
      if (filtre === "en_attente") params.set("statut", "en_attente");
      const res = await apiFetch(`/mouvements-stock?${params}`);
      if (res.ok) {
        const d = await res.json();
        setMouvements(Array.isArray(d.data) ? d.data : []);
      }
    } finally {
      setLoading(false);
    }
  }, [filtre]);

  useEffect(() => {
    charger();
  }, [charger]);

  const valider = async (id: number) => {
    const res = await apiFetch(`/mouvements-stock/${id}/valider`, { method: "POST" });
    if (res.ok) {
      Alert.alert("OK", "Mouvement validé");
      charger();
    } else {
      const e = await res.json().catch(() => ({}));
      Alert.alert("Erreur", e.error || "Réservé au gérant");
    }
  };

  const rejeter = (id: number) => {
    Alert.alert("Rejeter", "Confirmer ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Rejeter",
        style: "destructive",
        onPress: async () => {
          const res = await apiFetch(`/mouvements-stock/${id}/rejeter`, {
            method: "POST",
            body: JSON.stringify({ raison_rejet: "Rejet manuel" }),
          });
          if (res.ok) charger();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Historique stock</Text>
        <History color="#8b5cf6" size={24} />
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
        <TouchableOpacity style={styles.linkBtn} onPress={() => router.push("/(tabs)/arrivage")}>
          <Text style={styles.linkText}>+ Arrivage</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#8b5cf6" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={mouvements}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.produit?.nom ?? "—"}</Text>
              <Text style={styles.cardSub}>
                {item.type} · {item.raison} · {item.quantite} u. · {item.statut}
              </Text>
              <Text style={styles.date}>{new Date(item.created_at).toLocaleString("fr-FR")}</Text>
              {isGerant && item.statut === "en_attente" && (
                <View style={styles.row}>
                  <TouchableOpacity style={styles.btnOk} onPress={() => valider(item.id)}>
                    <CheckCircle2 color="#fff" size={16} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnKo} onPress={() => rejeter(item.id)}>
                    <XCircle color="#fff" size={16} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Aucun mouvement</Text>}
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
  filterActive: { backgroundColor: "#8b5cf6" },
  filterText: { color: "#e2e8f0", fontSize: 13 },
  linkBtn: { marginLeft: "auto" },
  linkText: { color: "#f97316", fontWeight: "600" },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: { color: "#fff", fontWeight: "600" },
  cardSub: { color: "#94a3b8", marginTop: 4, fontSize: 13 },
  date: { color: "#64748b", fontSize: 11, marginTop: 6 },
  row: { flexDirection: "row", gap: 10, marginTop: 10 },
  btnOk: { backgroundColor: "#22c55e", padding: 10, borderRadius: 8 },
  btnKo: { backgroundColor: "#ef4444", padding: 10, borderRadius: 8 },
  empty: { color: "#64748b", textAlign: "center", marginTop: 40 },
});
