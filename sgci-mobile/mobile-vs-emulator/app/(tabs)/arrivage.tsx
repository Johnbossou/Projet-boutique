import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api-client";
import { useRouter } from "expo-router";
import { ArrowLeft, CheckCircle2, Package, Plus, XCircle, Scan } from "lucide-react-native";
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
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";

interface Produit {
  id: number;
  nom: string;
}

interface Mouvement {
  id: number;
  quantite: number;
  statut: string;
  reference_bon?: string;
  produit?: { nom: string };
  created_at: string;
}

export default function ArrivageScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const isGerant = user?.role === "gerant";
  const [produits, setProduits] = useState<Produit[]>([]);
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [produitId, setProduitId] = useState("");
  const [quantite, setQuantite] = useState("");
  const [referenceBon, setReferenceBon] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, mRes] = await Promise.all([
        apiFetch("/produits?page=1&per_page=200"),
        apiFetch("/mouvements-stock?per_page=50&statut=en_attente&raison=arrivage"),
      ]);
      if (pRes.ok) {
        const d = await pRes.json();
        setProduits(Array.isArray(d.data) ? d.data : d);
      }
      if (mRes.ok) {
        const d = await mRes.json();
        setMouvements(Array.isArray(d.data) ? d.data : []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCodeScanned = async (code: string) => {
    try {
      const res = await apiFetch(`/produits/code/${encodeURIComponent(code)}`);
      if (res.ok) {
        const produit = await res.json();
        setProduitId(String(produit.id));
        setQuantite("1");
        Alert.alert("Succès", `Produit détecté: ${produit.nom}`);
      } else {
        Alert.alert("Info", `Code détecté: ${code}\nMais produit non trouvé`);
      }
    } catch (error) {
      Alert.alert("Erreur", "Impossible de traiter le code");
    }
  };

  useEffect(() => {
    charger();
  }, [charger]);

  const submit = async () => {
    if (!produitId || !quantite) {
      Alert.alert("Erreur", "Produit et quantité requis");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/mouvements-stock", {
        method: "POST",
        body: JSON.stringify({
          produit_id: parseInt(produitId, 10),
          quantite: parseInt(quantite, 10),
          raison: "arrivage",
          type: "entrée",
          reference_bon: referenceBon || null,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.message || e.error || "Échec enregistrement");
      }
      Alert.alert("Succès", "Arrivage en attente de validation");
      setQuantite("");
      setReferenceBon("");
      setNotes("");
      charger();
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const valider = async (id: number) => {
    const res = await apiFetch(`/mouvements-stock/${id}/valider`, { method: "POST" });
    if (res.ok) {
      Alert.alert("OK", "Stock mis à jour");
      charger();
    } else {
      const e = await res.json().catch(() => ({}));
      Alert.alert("Erreur", e.error || e.message || "Refusé");
    }
  };

  const rejeter = (id: number) => {
    Alert.alert("Rejeter l'arrivage", "Confirmer le rejet ?", [
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
          else Alert.alert("Erreur", "Impossible de rejeter");
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
        <Text style={styles.title}>Arrivage stock</Text>
        <Package color="#f97316" size={24} />
      </View>

      <ScrollView style={styles.form}>
        <View style={styles.scannerSection}>
          <TouchableOpacity
            style={styles.btnScanner}
            onPress={() => setShowScanner(true)}
          >
            <Scan color="#fff" size={20} />
            <Text style={styles.btnText}>Scanner QR/Code-barres</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Produit (ID)</Text>
        <TextInput
          style={styles.input}
          value={produitId}
          onChangeText={setProduitId}
          placeholder="ID produit"
          placeholderTextColor="#64748b"
          keyboardType="number-pad"
        />
        {produits.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {produits.slice(0, 15).map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.chip, produitId === String(p.id) && styles.chipActive]}
                onPress={() => setProduitId(String(p.id))}
              >
                <Text style={styles.chipText}>{p.nom}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        <Text style={styles.label}>Quantité</Text>
        <TextInput
          style={styles.input}
          value={quantite}
          onChangeText={setQuantite}
          keyboardType="number-pad"
          placeholderTextColor="#64748b"
        />
        <Text style={styles.label}>Réf. bon</Text>
        <TextInput style={styles.input} value={referenceBon} onChangeText={setReferenceBon} placeholderTextColor="#64748b" />
        <Text style={styles.label}>Notes</Text>
        <TextInput style={styles.input} value={notes} onChangeText={setNotes} placeholderTextColor="#64748b" />
        <TouchableOpacity style={styles.btnPrimary} onPress={submit} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Plus color="#fff" size={20} />}
          <Text style={styles.btnText}>Enregistrer arrivage</Text>
        </TouchableOpacity>
      </ScrollView>

      <Text style={styles.sectionTitle}>En attente ({mouvements.length})</Text>
      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={mouvements}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.produit?.nom ?? "Produit"}</Text>
              <Text style={styles.cardSub}>+{item.quantite} · {item.statut}</Text>
              {isGerant && item.statut === "en_attente" && (
                <View style={styles.row}>
                  <TouchableOpacity style={styles.btnOk} onPress={() => valider(item.id)}>
                    <CheckCircle2 color="#fff" size={18} />
                    <Text style={styles.btnSm}>Valider</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnKo} onPress={() => rejeter(item.id)}>
                    <XCircle color="#fff" size={18} />
                    <Text style={styles.btnSm}>Rejeter</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Aucun arrivage en attente</Text>}
        />
      )}

      <BarcodeScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleCodeScanned}
      />
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
  form: { padding: 16, maxHeight: 340 },
  scannerSection: {
    marginBottom: 16,
  },
  btnScanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#3b82f6",
    padding: 12,
    borderRadius: 10,
  },
  label: { color: "#94a3b8", marginBottom: 6, fontSize: 13 },
  input: {
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 12,
    color: "#fff",
    marginBottom: 12,
  },
  chip: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  chipActive: { backgroundColor: "#f97316" },
  chipText: { color: "#e2e8f0", fontSize: 12 },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#f97316",
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  btnText: { color: "#fff", fontWeight: "600" },
  sectionTitle: { color: "#94a3b8", paddingHorizontal: 16, marginTop: 8 },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: { color: "#fff", fontWeight: "600" },
  cardSub: { color: "#94a3b8", marginTop: 4 },
  row: { flexDirection: "row", gap: 10, marginTop: 12 },
  btnOk: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#22c55e",
    padding: 10,
    borderRadius: 8,
  },
  btnKo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#ef4444",
    padding: 10,
    borderRadius: 8,
  },
  btnSm: { color: "#fff", fontSize: 13, fontWeight: "600" },
  empty: { color: "#64748b", textAlign: "center", marginTop: 24 },
});
