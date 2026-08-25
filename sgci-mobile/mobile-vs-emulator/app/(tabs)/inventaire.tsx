import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api-client";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  ClipboardCheck,
  Plus,
  Save,
  AlertTriangle,
  CheckCircle2,
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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface LigneInventaire {
  produit_id: number;
  produit_nom?: string;
  quantite_systeme: number;
  quantite_physique: number | null;
  ecart: number | null;
}

interface Inventaire {
  id: number;
  reference: string;
  statut: string;
  total_produits: number;
  ecarts_detectes: number;
  lignes: LigneInventaire[];
  created_at: string;
}

const STATUT_COLORS: Record<string, { bg: string; text: string }> = {
  en_cours: { bg: "#eab308", text: "#000" },
  termine: { bg: "#3b82f6", text: "#fff" },
  valide: { bg: "#22c55e", text: "#fff" },
};

export default function InventaireScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const isGerant = user?.role === "gerant" || user?.role === "proprietaire";

  const [inventaires, setInventaires] = useState<Inventaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Inventaire | null>(null);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [lignes, setLignes] = useState<
    Record<number, { quantite_physique: string }>
  >({});

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/inventaires?per_page=50");
      if (res.ok) {
        const d = await res.json();
        setInventaires(Array.isArray(d.data) ? d.data : []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const creer = async () => {
    setCreating(true);
    try {
      const res = await apiFetch("/inventaires", { method: "POST" });
      if (res.ok) {
        Alert.alert("OK", "Inventaire créé");
        charger();
      } else {
        const e = await res.json().catch(() => ({}));
        Alert.alert("Erreur", e.error || "Impossible de créer l'inventaire");
      }
    } finally {
      setCreating(false);
    }
  };

  const ouvrirDetail = async (inv: Inventaire) => {
    if (!inv.lignes || inv.lignes.length === 0) {
      try {
        const res = await apiFetch(`/inventaires/${inv.id}`);
        if (res.ok) {
          const data = await res.json();
          setSelected(data.inventaire || data);
          return;
        }
      } catch {}
    }
    setSelected(inv);
  };

  const setLigneQte = (produitId: number, val: string) => {
    setLignes((prev) => ({ ...prev, [produitId]: { quantite_physique: val } }));
  };

  const soumettre = async () => {
    if (!selected) return;
    const lignesPayload = selected.lignes.map((l) => ({
      produit_id: l.produit_id,
      quantite_physique: parseInt(lignes[l.produit_id]?.quantite_physique || "0", 10),
    }));
    if (lignesPayload.some((l) => isNaN(l.quantite_physique) || l.quantite_physique < 0)) {
      Alert.alert("Erreur", "Veuillez remplir toutes les quantités physiques");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch(`/inventaires/${selected.id}/compter`, {
        method: "POST",
        body: JSON.stringify({ lignes: lignesPayload }),
      });
      if (res.ok) {
        Alert.alert("OK", "Comptage soumis");
        setSelected(null);
        setLignes({});
        charger();
      } else {
        const e = await res.json().catch(() => ({}));
        Alert.alert("Erreur", e.error || "Échec soumission");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const valider = async () => {
    if (!selected) return;
    setValidating(true);
    try {
      const res = await apiFetch(`/inventaires/${selected.id}/valider`, {
        method: "POST",
      });
      if (res.ok) {
        Alert.alert("OK", "Inventaire validé et ajusté");
        setSelected(null);
        charger();
      } else {
        const e = await res.json().catch(() => ({}));
        Alert.alert("Erreur", e.error || "Validation impossible");
      }
    } finally {
      setValidating(false);
    }
  };

  const badgeStyle = (statut: string) => {
    const c = STATUT_COLORS[statut] ?? STATUT_COLORS.en_cours;
    return { backgroundColor: c.bg };
  };

  const badgeTextStyle = (statut: string) => {
    const c = STATUT_COLORS[statut] ?? STATUT_COLORS.en_cours;
    return { color: c.text };
  };

  if (selected) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { setSelected(null); setLignes({}); }}>
            <ArrowLeft color="#fff" size={24} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{selected.reference}</Text>
          <View style={[styles.badge, badgeStyle(selected.statut)]}>
            <Text style={[styles.badgeText, badgeTextStyle(selected.statut)]}>
              {selected.statut.replace("_", " ")}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {selected.lignes?.map((ligne) => {
            const isEnCours = selected.statut === "en_cours";
            const qtePhysique = lignes[ligne.produit_id]?.quantite_physique;
            const ecart =
              ligne.ecart ??
              (qtePhysique != null
                ? parseInt(qtePhysique, 10) - ligne.quantite_systeme
                : null);
            const showEcart =
              !isEnCours && ligne.quantite_physique != null
                ? ligne.quantite_physique - ligne.quantite_systeme
                : ecart;

            return (
              <View key={ligne.produit_id} style={styles.card}>
                <Text style={styles.cardTitle}>
                  {ligne.produit_nom ?? `Produit #${ligne.produit_id}`}
                </Text>
                <Text style={styles.cardSub}>
                  Quantité système : {ligne.quantite_systeme}
                </Text>

                {isEnCours ? (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.label}>Quantité physique</Text>
                    <TextInput
                      style={styles.input}
                      value={qtePhysique ?? ""}
                      onChangeText={(v) => setLigneQte(ligne.produit_id, v)}
                      keyboardType="number-pad"
                      placeholderTextColor="#64748b"
                      placeholder="0"
                    />
                  </View>
                ) : (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.cardSub}>
                      Quantité physique : {ligne.quantite_physique}
                    </Text>
                    {showEcart != null && showEcart !== 0 && (
                      <Text
                        style={[
                          styles.ecartText,
                          { color: showEcart > 0 ? "#22c55e" : "#ef4444" },
                        ]}
                      >
                        Écart : {showEcart > 0 ? "+" : ""}
                        {showEcart}
                      </Text>
                    )}
                    {showEcart === 0 && (
                      <Text style={[styles.ecartText, { color: "#22c55e" }]}>
                        ✓ Conforme
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {!selected.lignes || selected.lignes.length === 0 ? (
            <Text style={styles.empty}>Aucune ligne d'inventaire</Text>
          ) : null}

          {selected.statut === "en_cours" && isGerant && selected.lignes?.length > 0 && (
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={soumettre}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Save color="#fff" size={20} />
              )}
              <Text style={styles.btnText}>Soumettre comptage</Text>
            </TouchableOpacity>
          )}

          {selected.statut === "termine" &&
            isGerant &&
            selected.ecarts_detectes > 0 && (
              <TouchableOpacity
                style={styles.btnWarn}
                onPress={valider}
                disabled={validating}
              >
                {validating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <CheckCircle2 color="#fff" size={20} />
                )}
                <Text style={styles.btnText}>Valider et ajuster</Text>
              </TouchableOpacity>
            )}
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
        <Text style={styles.title}>Inventaire physique</Text>
        <ClipboardCheck color="#f97316" size={24} />
      </View>

      {isGerant && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.btnPrimary} onPress={creer} disabled={creating}>
            {creating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Plus color="#fff" size={20} />
            )}
            <Text style={styles.btnText}>Nouvel inventaire</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={inventaires}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => ouvrirDetail(item)}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{item.reference}</Text>
                <View style={[styles.badge, badgeStyle(item.statut)]}>
                  <Text style={[styles.badgeText, badgeTextStyle(item.statut)]}>
                    {item.statut.replace("_", " ")}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardSub}>
                {item.total_produits} produit(s) · Écarts :{" "}
                <Text style={{ color: item.ecarts_detectes > 0 ? "#ef4444" : "#94a3b8" }}>
                  {item.ecarts_detectes}
                </Text>
              </Text>
              <Text style={styles.date}>
                {new Date(item.created_at).toLocaleString("fr-FR")}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Aucun inventaire</Text>}
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
  title: { color: "#fff", fontSize: 18, fontWeight: "700", flex: 1, marginHorizontal: 12 },
  actions: { paddingHorizontal: 16, paddingVertical: 10 },
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
  ecartText: { fontWeight: "700", fontSize: 13, marginTop: 4 },
  label: { color: "#94a3b8", marginBottom: 6, fontSize: 13 },
  input: {
    backgroundColor: "#0f172a",
    borderRadius: 10,
    padding: 12,
    color: "#fff",
  },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#f97316",
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  btnWarn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#f59e0b",
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  btnText: { color: "#fff", fontWeight: "600" },
  empty: { color: "#64748b", textAlign: "center", marginTop: 40 },
});
