import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api-client";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  FileText,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface LigneDevis {
  id: number;
  quantite: number;
  prix_unitaire: number;
  montant_total: number;
  produit: { id: number; nom: string } | null;
}

interface Devis {
  id: number;
  numero_devis: string;
  date_devis: string;
  date_validite: string;
  montant_total: number;
  statut: string;
  notes: string | null;
  client: { id: number; nom: string } | null;
  lignes: LigneDevis[];
}

const STATUT_COLORS: Record<string, { bg: string; text: string }> = {
  en_attente: { bg: "#eab308", text: "#000" },
  accepte: { bg: "#22c55e", text: "#fff" },
  refuse: { bg: "#ef4444", text: "#fff" },
  expire: { bg: "#6b7280", text: "#fff" },
};

const STATUT_LABELS: Record<string, string> = {
  en_attente: "En attente",
  accepte: "Accepte",
  refuse: "Refuse",
  expire: "Expire",
};

export default function DevisScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const isGerant = user?.role === "gerant" || user?.role === "proprietaire";

  const [devis, setDevis] = useState<Devis[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Devis | null>(null);
  const [filter, setFilter] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter ? `/devis?statut=${filter}&per_page=50` : "/devis?per_page=50";
      const res = await apiFetch(url);
      if (res.ok) {
        const d = await res.json();
        setDevis(Array.isArray(d.data) ? d.data : []);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    charger();
  }, [charger]);

  const accepter = async (d: Devis) => {
    Alert.alert("Accepter", `Accepter le devis ${d.numero_devis}?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Oui",
        onPress: async () => {
          const res = await apiFetch(`/devis/${d.id}/accepter`, { method: "POST" });
          if (res.ok) {
            Alert.alert("OK", "Devis accepte");
            setSelected(null);
            charger();
          } else {
            const e = await res.json().catch(() => ({}));
            Alert.alert("Erreur", e.message || "Echec");
          }
        },
      },
    ]);
  };

  const refuser = async (d: Devis) => {
    Alert.alert("Refuser", `Refuser le devis ${d.numero_devis}?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Oui",
        style: "destructive",
        onPress: async () => {
          const res = await apiFetch(`/devis/${d.id}/refuser`, { method: "POST" });
          if (res.ok) {
            Alert.alert("OK", "Devis refuse");
            setSelected(null);
            charger();
          } else {
            const e = await res.json().catch(() => ({}));
            Alert.alert("Erreur", e.message || "Echec");
          }
        },
      },
    ]);
  };

  const telechargerPdf = async (d: Devis) => {
    try {
      const res = await apiFetch(`/devis/${d.id}/pdf`);
      if (res.ok) {
        Alert.alert("PDF", "Le PDF a ete genere. Consultez vos telechargements.");
      } else {
        Alert.alert("Erreur", "Impossible de generer le PDF");
      }
    } catch {
      Alert.alert("Erreur", "Impossible de generer le PDF");
    }
  };

  const badgeStyle = (statut: string) => {
    const c = STATUT_COLORS[statut] ?? STATUT_COLORS.en_attente;
    return { backgroundColor: c.bg };
  };

  const badgeTextStyle = (statut: string) => {
    const c = STATUT_COLORS[statut] ?? STATUT_COLORS.en_attente;
    return { color: c.text };
  };

  const fmt = (n: number) => n.toLocaleString("fr-FR") + " FCFA";

  if (selected) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelected(null)}>
            <ArrowLeft color="#fff" size={24} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {selected.numero_devis}
          </Text>
          <View style={[styles.badge, badgeStyle(selected.statut)]}>
            <Text style={[styles.badgeText, badgeTextStyle(selected.statut)]}>
              {STATUT_LABELS[selected.statut] ?? selected.statut}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={styles.card}>
            <Text style={styles.cardSub}>
              Client : {selected.client?.nom ?? "—"}
            </Text>
            <Text style={styles.cardSub}>
              Date : {new Date(selected.date_devis).toLocaleDateString("fr-FR")}
            </Text>
            <Text style={styles.cardSub}>
              Validite : {new Date(selected.date_validite).toLocaleDateString("fr-FR")}
            </Text>
            <Text style={[styles.cardTitle, { marginTop: 8 }]}>
              Total : {fmt(selected.montant_total)}
            </Text>
          </View>

          {selected.lignes?.map((ligne) => (
            <View key={ligne.id} style={styles.card}>
              <Text style={styles.cardTitle}>
                {ligne.produit?.nom ?? `Produit #${ligne.produit?.id}`}
              </Text>
              <Text style={styles.cardSub}>
                {ligne.quantite} x {fmt(ligne.prix_unitaire)} = {fmt(ligne.montant_total)}
              </Text>
            </View>
          ))}

          {selected.notes && (
            <View style={styles.card}>
              <Text style={styles.label}>Notes</Text>
              <Text style={styles.cardSub}>{selected.notes}</Text>
            </View>
          )}

          {selected.statut === "en_attente" && isGerant && (
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={styles.btnAccept}
                onPress={() => accepter(selected)}
              >
                <CheckCircle2 color="#fff" size={20} />
                <Text style={styles.btnText}>Accepter</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnRefuse}
                onPress={() => refuser(selected)}
              >
                <XCircle color="#fff" size={20} />
                <Text style={styles.btnText}>Refuser</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => telechargerPdf(selected)}
          >
            <Download color="#fff" size={20} />
            <Text style={styles.btnText}>Telecharger PDF</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Devis</Text>
        <FileText color="#3b82f6" size={24} />
      </View>

      <View style={styles.filters}>
        {[
          { key: null, label: "Tous" },
          { key: "en_attente", label: "En attente" },
          { key: "accepte", label: "Accepte" },
          { key: "refuse", label: "Refuse" },
        ].map((f) => (
          <TouchableOpacity
            key={f.label}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text
              style={[
                styles.chipText,
                filter === f.key && styles.chipTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#3b82f6" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={devis}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => setSelected(item)}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{item.numero_devis}</Text>
                <View style={[styles.badge, badgeStyle(item.statut)]}>
                  <Text style={[styles.badgeText, badgeTextStyle(item.statut)]}>
                    {STATUT_LABELS[item.statut] ?? item.statut}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardSub}>
                Client : {item.client?.nom ?? "—"}
              </Text>
              <Text style={styles.cardSub}>
                {fmt(item.montant_total)} · {item.lignes?.length ?? 0} ligne(s)
              </Text>
              <Text style={styles.date}>
                {new Date(item.date_devis).toLocaleDateString("fr-FR")}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>Aucun devis</Text>
          }
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
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    marginHorizontal: 12,
  },
  filters: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#1e293b",
  },
  chipActive: { backgroundColor: "#3b82f6" },
  chipText: { color: "#94a3b8", fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
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
  cardSub: { color: "#94a3b8", marginTop: 4, fontSize: 13 },
  date: { color: "#64748b", fontSize: 11, marginTop: 6 },
  label: { color: "#94a3b8", marginBottom: 4, fontSize: 13 },
  empty: { color: "#64748b", textAlign: "center", marginTop: 40 },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#3b82f6",
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  btnAccept: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#22c55e",
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  btnRefuse: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ef4444",
    padding: 14,
    borderRadius: 12,
  },
  btnText: { color: "#fff", fontWeight: "600" },
});
