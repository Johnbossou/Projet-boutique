import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api-client";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  CheckCircle2,
  History,
  Package,
  Pencil,
  Plus,
  Scan,
  Trash2,
  XCircle,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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
  quantite_stock?: number;
  code_barre?: string | null;
}

interface Mouvement {
  id: number;
  produit_id: number;
  quantite: number;
  quantite_recue?: number | null;
  quantite_effective?: number;
  quantite_restante?: number;
  est_partiel?: boolean;
  type: "entree" | "sortie";
  raison: string;
  statut: string;
  libelle_statut?: string;
  reference_bon?: string | null;
  motif_rejet?: string | null;
  date_peremption?: string | null;
  date_fabrication?: string | null;
  produit?: { nom: string; quantite_stock?: number };
  user?: { name: string } | null;
  validePar?: { name: string } | null;
  created_at: string;
}

const RAISONS = [
  { value: "arrivage", label: "Arrivage fournisseur" },
  { value: "ajustement", label: "Ajustement d'inventaire" },
  { value: "retour", label: "Retour client" },
  { value: "casse", label: "Casse / perte" },
] as const;

type Onglet = "en_attente" | "traites";

const emptyForm = {
  produitId: "",
  quantite: "",
  type: "entree" as "entree" | "sortie",
  raison: "arrivage",
  referenceBon: "",
  notes: "",
  datePeremption: "",
  dateFabrication: "",
};

export default function ArrivageScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const isGerant = user?.role === "gerant" || user?.role === "proprietaire";

  const [produits, setProduits] = useState<Produit[]>([]);
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [onglet, setOnglet] = useState<Onglet>("en_attente");
  const [recherche, setRecherche] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // Réception partielle : quantité réellement entrée en stock.
  const [reception, setReception] = useState<{
    id: number;
    quantite: number;
    quantiteRecue: string;
  } | null>(null);

  // Motif de rejet : Alert.prompt n'existe pas sur Android, d'où un modal.
  const [rejet, setRejet] = useState<{ id: number; nom: string; motif: string } | null>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, mRes] = await Promise.all([
        apiFetch("/produits?per_page=200"),
        apiFetch("/mouvements-stock?per_page=100"),
      ]);
      if (pRes.ok) {
        const d = await pRes.json();
        setProduits(Array.isArray(d.data) ? d.data : d);
      }
      if (mRes.ok) {
        const d = await mRes.json();
        setMouvements(Array.isArray(d.data) ? d.data : []);
      }
    } catch {
      Alert.alert("Erreur", "Impossible de charger les données");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  // Recherche produit : le serveur pagine, on ne peut donc pas se contenter
  // d'afficher les 15 premiers résultats côté client.
  const produitsFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return produits;
    return produits.filter(
      (p) =>
        p.nom.toLowerCase().includes(q) ||
        String(p.id) === q ||
        (p.code_barre ?? "").toLowerCase().includes(q)
    );
  }, [produits, recherche]);

  const produitSelectionne = useMemo(
    () => produits.find((p) => String(p.id) === form.produitId) ?? null,
    [produits, form.produitId]
  );

  const listeVisible = useMemo(
    () => mouvements.filter((m) => (onglet === "en_attente" ? m.statut === "en_attente" : m.statut !== "en_attente")),
    [mouvements, onglet]
  );

  const enAttente = mouvements.filter((m) => m.statut === "en_attente").length;
  const traites = mouvements.length - enAttente;

  const choisirProduit = (id: number) => {
    setForm((f) => ({ ...f, produitId: String(id) }));
    setRecherche("");
  };

  const handleCodeScanned = async (code: string) => {
    try {
      const res = await apiFetch(`/produits/code/${encodeURIComponent(code)}`);
      if (res.ok) {
        const produit = await res.json();
        setForm((f) => ({ ...f, produitId: String(produit.id) }));
        Alert.alert("Succès", `Produit détecté : ${produit.nom}`);
      } else {
        Alert.alert("Info", `Code ${code} : produit non trouvé`);
      }
    } catch {
      Alert.alert("Erreur", "Impossible de traiter le code");
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setRecherche("");
  };

  const startEdit = (m: Mouvement) => {
    setEditingId(m.id);
    setForm({
      produitId: String(m.produit_id),
      quantite: String(m.quantite),
      type: m.type,
      raison: m.raison,
      referenceBon: m.reference_bon ?? "",
      notes: "",
      datePeremption: m.date_peremption?.slice(0, 10) ?? "",
      dateFabrication: m.date_fabrication?.slice(0, 10) ?? "",
    });
    setOnglet("en_attente");
  };

  const submit = async () => {
    if (!form.produitId || !form.quantite) {
      Alert.alert("Erreur", "Produit et quantité sont requis");
      return;
    }
    const quantite = parseInt(form.quantite, 10);
    if (Number.isNaN(quantite) || quantite < 1) {
      Alert.alert("Erreur", "La quantité doit être un nombre entier positif");
      return;
    }

    const corps: Record<string, unknown> = {
      produit_id: parseInt(form.produitId, 10),
      quantite,
      type: form.type,
      raison: form.raison,
      reference_bon: form.referenceBon || null,
      notes: form.notes || null,
      date_peremption: form.datePeremption || null,
      date_fabrication: form.dateFabrication || null,
    };

    setSaving(true);
    try {
      const res = await apiFetch(
        editingId ? `/mouvements-stock/${editingId}` : "/mouvements-stock",
        {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify(corps),
        }
      );
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || e.message || "Échec de l'enregistrement");
      }
      Alert.alert(
        "Succès",
        editingId ? "Demande mise à jour" : "Arrivage enregistré, en attente de validation"
      );
      resetForm();
      charger();
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  const supprimer = (m: Mouvement) => {
    Alert.alert("Supprimer la demande", `Retirer « ${m.produit?.nom ?? "ce produit"} » de la liste ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            const res = await apiFetch(`/mouvements-stock/${m.id}`, { method: "DELETE" });
            if (res.ok) {
              if (editingId === m.id) resetForm();
              Alert.alert("Supprimé", "La demande a été retirée");
              charger();
            } else {
              const e = await res.json().catch(() => ({}));
              Alert.alert("Erreur", e.error || e.message || "Suppression impossible");
            }
          } catch {
            Alert.alert("Erreur", "Suppression impossible");
          }
        },
      },
    ]);
  };

  /** Ouvre la saisie de la quantité réellement reçue (réception partielle). */
  const ouvrirReception = (m: Mouvement) => {
    setReception({
      id: m.id,
      quantite: m.quantite,
      quantiteRecue: String(m.quantite),
    });
  };

  const confirmerReception = async () => {
    if (!reception) return;
    const recue = parseInt(reception.quantiteRecue, 10);
    if (Number.isNaN(recue) || recue < 1 || recue > reception.quantite) {
      Alert.alert("Erreur", `La quantité reçue doit être comprise entre 1 et ${reception.quantite}`);
      return;
    }

    const res = await apiFetch(`/mouvements-stock/${reception.id}/valider`, {
      method: "POST",
      body: JSON.stringify({ quantite_recue: recue }),
    });

    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      Alert.alert("Erreur", e.error || e.message || "Validation impossible");
      return;
    }

    const data = await res.json().catch(() => ({}));
    setReception(null);
    Alert.alert(
      data.partiel ? "Réception partielle" : "Validé",
      `Stock : ${data.stock_precedent} → ${data.stock_nouveau}${
        data.partiel ? `\nIl reste ${data.quantite_restante} unité(s) à réceptionner.` : ""
      }`
    );
    charger();
  };

  const validerTout = (m: Mouvement) => {
    Alert.alert("Valider l'arrivage", `Confirmer la réception de ${m.quantite} unité(s) ?`, [
      { text: "Annuler", style: "cancel" },
      { text: "Réception partielle", onPress: () => ouvrirReception(m) },
      {
        text: "Tout recevoir",
        onPress: async () => {
          const res = await apiFetch(`/mouvements-stock/${m.id}/valider`, { method: "POST" });
          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            Alert.alert("Validé", `Stock : ${data.stock_precedent} → ${data.stock_nouveau}`);
            charger();
          } else {
            const e = await res.json().catch(() => ({}));
            Alert.alert("Erreur", e.error || e.message || "Validation impossible");
          }
        },
      },
    ]);
  };

  const ouvrirRejet = (m: Mouvement) => {
    setRejet({ id: m.id, nom: m.produit?.nom ?? `Produit #${m.produit_id}`, motif: "" });
  };

  const confirmerRejet = async () => {
    if (!rejet) return;

    if (!rejet.motif.trim()) {
      Alert.alert("Motif requis", "Le motif du rejet est obligatoire");
      return;
    }

    const res = await apiFetch(`/mouvements-stock/${rejet.id}/rejeter`, {
      method: "POST",
      body: JSON.stringify({ raison_rejet: rejet.motif.trim() }),
    });

    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      Alert.alert("Erreur", e.error || e.message || "Rejet impossible");
      return;
    }

    setRejet(null);
    if (editingId === rejet.id) resetForm();
    Alert.alert("Rejeté", "La demande a été rejetée");
    charger();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Arrivage stock</Text>
        <Package color="#3b82f6" size={24} />
      </View>

      <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
        {editingId !== null && (
          <View style={styles.editBanner}>
            <Pencil color="#fbbf24" size={16} />
            <Text style={styles.editBannerText}>Modification d'une demande en attente</Text>
            <TouchableOpacity onPress={resetForm}>
              <Text style={styles.editBannerCancel}>Annuler</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.btnScanner} onPress={() => setShowScanner(true)}>
          <Scan color="#fff" size={20} />
          <Text style={styles.btnText}>Scanner QR / code-barres</Text>
        </TouchableOpacity>

        <Text style={styles.label}>
          {form.type === "entree" ? "Produit reçu" : "Produit sorti"}
        </Text>
        <TextInput
          style={styles.input}
          value={recherche}
          onChangeText={setRecherche}
          placeholder="Rechercher un produit (nom ou code-barres)"
          placeholderTextColor="#64748b"
        />

        {form.produitId ? (
          <View style={styles.selectedProduct}>
            <Text style={styles.selectedProductName}>
              {produitSelectionne?.nom ?? `Produit #${form.produitId}`}
            </Text>
            {typeof produitSelectionne?.quantite_stock === "number" && (
              <Text style={styles.selectedProductStock}>
                Stock actuel : {produitSelectionne.quantite_stock}
              </Text>
            )}
            <TouchableOpacity onPress={() => setForm((f) => ({ ...f, produitId: "" }))}>
              <Text style={styles.link}>Changer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.resultList}>
            {produitsFiltres.length === 0 ? (
              <Text style={styles.emptySearch}>
                {produits.length === 0
                  ? "Aucun produit chargé"
                  : "Aucun produit ne correspond à cette recherche"}
              </Text>
            ) : (
              produitsFiltres.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.resultRow}
                  onPress={() => choisirProduit(p.id)}
                >
                  <Text style={styles.resultName}>{p.nom}</Text>
                  <Text style={styles.resultStock}>{p.quantite_stock ?? 0}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        <Text style={styles.label}>Type de mouvement</Text>
        <View style={styles.typeRow}>
          {(["entree", "sortie"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.typeBtn, form.type === t && styles.typeBtnActive]}
              onPress={() =>
                setForm((f) => ({
                  ...f,
                  type: t,
                  // Une sortie d'arrivage n'a pas de sens.
                  raison: t === "entree" ? "arrivage" : "casse",
                }))
              }
            >
              <Text style={[styles.typeText, form.type === t && styles.typeTextActive]}>
                {t === "entree" ? "Entrée" : "Sortie"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {form.type === "sortie" && (
          <>
            <Text style={styles.label}>Motif de la sortie</Text>
            <View style={styles.typeRow}>
              {RAISONS.filter((r) => r.value !== "arrivage").map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.typeBtn, form.raison === r.value && styles.typeBtnActive]}
                  onPress={() => setForm((f) => ({ ...f, raison: r.value }))}
                >
                  <Text style={[styles.typeText, form.raison === r.value && styles.typeTextActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Text style={styles.label}>Quantité</Text>
        <TextInput
          style={styles.input}
          value={form.quantite}
          onChangeText={(v) => setForm((f) => ({ ...f, quantite: v.replace(/[^0-9]/g, "") }))}
          keyboardType="number-pad"
          placeholder="Ex. 50"
          placeholderTextColor="#64748b"
        />

        {form.type === "entree" && (
          <>
            <Text style={styles.label}>Date de péremption (optionnel)</Text>
            <TextInput
              style={styles.input}
              value={form.datePeremption}
              onChangeText={(v) => setForm((f) => ({ ...f, datePeremption: v }))}
              placeholder="AAAA-MM-JJ"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
            />
            <Text style={styles.label}>Date de fabrication (optionnel)</Text>
            <TextInput
              style={styles.input}
              value={form.dateFabrication}
              onChangeText={(v) => setForm((f) => ({ ...f, dateFabrication: v }))}
              placeholder="AAAA-MM-JJ"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
            />
          </>
        )}

        <Text style={styles.label}>Référence du bon</Text>
        <TextInput
          style={styles.input}
          value={form.referenceBon}
          onChangeText={(v) => setForm((f) => ({ ...f, referenceBon: v }))}
          placeholder="N° de bon de livraison"
          placeholderTextColor="#64748b"
        />

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={styles.input}
          value={form.notes}
          onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
          placeholder="État du colis, remarque…"
          placeholderTextColor="#64748b"
        />

        <TouchableOpacity style={styles.btnPrimary} onPress={submit} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Plus color="#fff" size={20} />}
          <Text style={styles.btnText}>
            {editingId !== null ? "Enregistrer les modifications" : "Enregistrer l'arrivage"}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, onglet === "en_attente" && styles.tabActive]}
          onPress={() => setOnglet("en_attente")}
        >
          <Text style={[styles.tabText, onglet === "en_attente" && styles.tabTextActive]}>
            En attente ({enAttente})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, onglet === "traites" && styles.tabActive]}
          onPress={() => setOnglet("traites")}
        >
          <History color={onglet === "traites" ? "#fff" : "#64748b"} size={16} />
          <Text style={[styles.tabText, onglet === "traites" && styles.tabTextActive]}>
            Traités ({traites})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#3b82f6" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={listeVisible}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{item.produit?.nom ?? `Produit #${item.produit_id}`}</Text>
                <Text style={styles.badge}>
                  {item.type === "entree" ? "+" : "-"}
                  {item.quantite_effective ?? item.quantite}
                </Text>
              </View>

              <Text style={styles.cardSub}>
                {item.libelle_statut ?? item.statut}
                {item.reference_bon ? ` · bon ${item.reference_bon}` : ""}
              </Text>

              {item.est_partiel && (
                <Text style={styles.cardWarn}>
                  Reçu {item.quantite_recue}/{item.quantite} · reste {item.quantite_restante}
                </Text>
              )}

              {item.motif_rejet && <Text style={styles.cardKo}>Rejeté : {item.motif_rejet}</Text>}

              {item.statut !== "en_attente" && item.validePar && (
                <Text style={styles.cardMeta}>Traité par {item.validePar.name}</Text>
              )}

              {item.statut === "en_attente" && (
                <>
                  {isGerant ? (
                    <View style={styles.row}>
                      <TouchableOpacity style={styles.btnOk} onPress={() => validerTout(item)}>
                        <CheckCircle2 color="#fff" size={18} />
                        <Text style={styles.btnSm}>Valider</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.btnKo} onPress={() => ouvrirRejet(item)}>
                        <XCircle color="#fff" size={18} />
                        <Text style={styles.btnSm}>Rejeter</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.row}>
                      <TouchableOpacity
                        style={styles.btnGhost}
                        onPress={() => startEdit(item)}
                      >
                        <Pencil color="#94a3b8" size={16} />
                        <Text style={styles.btnGhostText}>Modifier</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.btnGhost}
                        onPress={() => supprimer(item)}
                      >
                        <Trash2 color="#ef4444" size={16} />
                        <Text style={[styles.btnGhostText, { color: "#ef4444" }]}>Supprimer</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {onglet === "en_attente"
                ? "Aucun arrivage en attente"
                : "Aucun mouvement traité pour l'instant"}
            </Text>
          }
        />
      )}

      {/* Réception partielle */}
      <Modal visible={reception !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Quantité réellement reçue</Text>
            <Text style={styles.modalSub}>
              Annoncé : {reception?.quantite} unité(s)
            </Text>
            <TextInput
              style={styles.input}
              value={reception?.quantiteRecue ?? ""}
              onChangeText={(v) =>
                setReception((r) => (r ? { ...r, quantiteRecue: v.replace(/[^0-9]/g, "") } : r))
              }
              keyboardType="number-pad"
              placeholderTextColor="#64748b"
            />
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.btnGhost, { flex: 1 }]}
                onPress={() => setReception(null)}
              >
                <Text style={styles.btnGhostText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnOk, { flex: 1 }]} onPress={confirmerReception}>
                <CheckCircle2 color="#fff" size={18} />
                <Text style={styles.btnSm}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Motif de rejet (Alert.prompt n'existe pas sur Android) */}
      <Modal visible={rejet !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rejeter l'arrivage</Text>
            <Text style={styles.modalSub}>{rejet?.nom}</Text>
            <TextInput
              style={[styles.input, { minHeight: 88, textAlignVertical: "top" }]}
              value={rejet?.motif ?? ""}
              onChangeText={(v) => setRejet((r) => (r ? { ...r, motif: v } : r))}
              placeholder="Ex. Marchandise endommagée, quantité non conforme…"
              placeholderTextColor="#64748b"
              multiline
              autoFocus
            />
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.btnGhost, { flex: 1 }]}
                onPress={() => setRejet(null)}
              >
                <Text style={styles.btnGhostText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnKo, { flex: 1 }]} onPress={confirmerRejet}>
                <XCircle color="#fff" size={18} />
                <Text style={styles.btnSm}>Rejeter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BarcodeScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleCodeScanned}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b1220" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  form: { padding: 16, maxHeight: 420 },
  editBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#422006",
    borderColor: "#f59e0b",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  editBannerText: { color: "#fbbf24", flex: 1, fontSize: 13 },
  editBannerCancel: { color: "#fff", fontWeight: "600", fontSize: 13 },
  btnScanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#3b82f6",
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  label: { color: "#94a3b8", marginBottom: 6, fontSize: 13 },
  input: {
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 12,
    color: "#fff",
    marginBottom: 12,
  },
  selectedProduct: {
    backgroundColor: "#1e293b",
    borderColor: "#3b82f6",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  selectedProductName: { color: "#fff", fontWeight: "600" },
  selectedProductStock: { color: "#94a3b8", fontSize: 12, marginTop: 2 },
  link: { color: "#3b82f6", marginTop: 6, fontSize: 13, fontWeight: "600" },
  resultList: { maxHeight: 180, marginBottom: 12 },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1e293b",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  resultName: { color: "#e2e8f0", flex: 1, fontSize: 13 },
  resultStock: { color: "#64748b", fontSize: 12, marginLeft: 8 },
  emptySearch: { color: "#64748b", fontSize: 13, paddingVertical: 8 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  typeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#1e293b",
  },
  typeBtnActive: { backgroundColor: "#3b82f6" },
  typeText: { color: "#94a3b8", fontSize: 13 },
  typeTextActive: { color: "#fff", fontWeight: "600" },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#3b82f6",
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  btnText: { color: "#fff", fontWeight: "600" },
  tabs: { flexDirection: "row", paddingHorizontal: 16, gap: 8 },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#1e293b",
  },
  tabActive: { backgroundColor: "#3b82f6" },
  tabText: { color: "#64748b", fontSize: 13, fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { color: "#fff", fontWeight: "600", flex: 1 },
  badge: { color: "#22c55e", fontWeight: "700", marginLeft: 8 },
  cardSub: { color: "#94a3b8", marginTop: 4, fontSize: 13 },
  cardWarn: { color: "#fbbf24", marginTop: 4, fontSize: 12 },
  cardKo: { color: "#f87171", marginTop: 4, fontSize: 12 },
  cardMeta: { color: "#64748b", marginTop: 4, fontSize: 12 },
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
  btnGhost: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 10,
    borderRadius: 8,
  },
  btnGhostText: { color: "#94a3b8", fontSize: 13, fontWeight: "600" },
  btnSm: { color: "#fff", fontSize: 13, fontWeight: "600" },
  empty: { color: "#64748b", textAlign: "center", marginTop: 24 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: { backgroundColor: "#1e293b", borderRadius: 14, padding: 20, width: "100%" },
  modalTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 4 },
  modalSub: { color: "#94a3b8", fontSize: 13, marginBottom: 16 },
});
