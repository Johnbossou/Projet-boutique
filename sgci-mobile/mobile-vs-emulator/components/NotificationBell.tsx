import { apiFetch } from "@/lib/api-client";
import { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Bell } from "lucide-react-native";

interface AppNotification {
  id: number;
  title: string;
  message: string;
  created_at: string;
}

export function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [cRes, listRes] = await Promise.all([
        apiFetch("/notifications/unread-count"),
        apiFetch("/notifications?unread_only=1&per_page=10"),
      ]);
      if (cRes.ok) {
        const c = await cRes.json();
        setCount(c.count ?? 0);
      }
      if (listRes.ok) {
        const d = await listRes.json();
        setItems(Array.isArray(d.data) ? d.data : []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
  }, [refresh]);

  const markAll = async () => {
    await apiFetch("/notifications/mark-all-read", { method: "POST" });
    setCount(0);
    setItems([]);
  };

  return (
    <>
      <TouchableOpacity style={styles.btn} onPress={() => setOpen(true)}>
        <Bell size={22} color="#ffffff" />
        {count > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
          </View>
        )}
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Alertes</Text>
              {count > 0 && (
                <TouchableOpacity onPress={markAll}>
                  <Text style={styles.markAll}>Tout lire</Text>
                </TouchableOpacity>
              )}
            </View>
            {items.length === 0 ? (
              <Text style={styles.empty}>Aucune alerte</Text>
            ) : (
              items.map((n) => (
                <View key={n.id} style={styles.item}>
                  <Text style={styles.itemTitle}>{n.title}</Text>
                  <Text style={styles.itemMsg}>{n.message}</Text>
                </View>
              ))
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: { padding: 8, position: "relative" },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#ef4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 56,
    paddingRight: 12,
  },
  panel: {
    width: 300,
    maxHeight: 360,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 12,
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  panelTitle: { color: "#fff", fontWeight: "700" },
  markAll: { color: "#f97316", fontSize: 12 },
  empty: { color: "#94a3b8", padding: 12 },
  item: { borderBottomWidth: 1, borderBottomColor: "#334155", paddingVertical: 8 },
  itemTitle: { color: "#f8fafc", fontWeight: "600", fontSize: 13 },
  itemMsg: { color: "#94a3b8", fontSize: 12, marginTop: 2 },
});
