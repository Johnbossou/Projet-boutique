import { apiFetch } from "@/lib/api-client";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface ApiUser {
  id: number;
  name: string;
  email: string;
  role: string;
  est_actif: boolean;
}

export function UsersManagement() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "caissier",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/users?actifs_seulement=0");
      if (res.ok) setUsers(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    const res = await apiFetch("/users", {
      method: "POST",
      body: JSON.stringify(form),
    });
    if (res.ok) {
      Alert.alert("OK", "Utilisateur créé");
      setForm({ name: "", email: "", password: "", role: "caissier" });
      load();
    } else Alert.alert("Erreur", "Création impossible");
  };

  return (
    <ScrollView style={styles.box}>
      <Text style={styles.title}>Équipe</Text>
      <TextInput
        style={styles.input}
        placeholder="Nom"
        placeholderTextColor="#64748b"
        value={form.name}
        onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#64748b"
        value={form.email}
        onChangeText={(t) => setForm((f) => ({ ...f, email: t }))}
      />
      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        placeholderTextColor="#64748b"
        secureTextEntry
        value={form.password}
        onChangeText={(t) => setForm((f) => ({ ...f, password: t }))}
      />
      <TouchableOpacity style={styles.btn} onPress={create}>
        <Text style={styles.btnText}>Créer caissier</Text>
      </TouchableOpacity>
      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 16 }} />
      ) : (
        users.map((u) => (
          <View key={u.id} style={styles.row}>
            <Text style={styles.name}>{u.name}</Text>
            <Text style={styles.sub}>
              {u.email} · {u.role} · {u.est_actif ? "actif" : "inactif"}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  box: { padding: 16 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 12 },
  input: {
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 12,
    color: "#fff",
    marginBottom: 10,
  },
  btn: {
    backgroundColor: "#f97316",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 16,
  },
  btnText: { color: "#fff", fontWeight: "600" },
  row: {
    backgroundColor: "#1e293b",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  name: { color: "#fff", fontWeight: "600" },
  sub: { color: "#94a3b8", fontSize: 12, marginTop: 4 },
});
