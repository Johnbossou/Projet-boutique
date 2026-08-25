import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../../contexts/AuthContext";
import { apiFetch } from "@/lib/api-client";

interface ChatUser {
  id: number;
  name: string;
  role?: string;
}

interface ChatMessage {
  id: number;
  user_id: number;
  message: string;
  type: string;
  created_at: string;
  user?: { id: number; name: string };
}

interface Conversation {
  id: number;
  titre: string;
  type: string;
  updated_at: string;
  dernier_message?: ChatMessage | null;
  messages_non_lus?: number;
}

const COLORS = {
  bg: "#0f172a",
  card: "#1e293b",
  border: "#334155",
  textPrimary: "#f8fafc",
  textSecondary: "#94a3b8",
  accent: "#f97316",
};

export default function MessagesScreen() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [staff, setStaff] = useState<ChatUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const flatListRef = useRef<FlatList<ChatMessage> | null>(null);

  const peutCreer = user?.role === "proprietaire" || user?.role === "gerant";
  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

  const chargerConversations = useCallback(async () => {
    try {
      const res = await apiFetch("/chat");
      if (res.ok) {
        const json = await res.json();
        setConversations(Array.isArray(json?.data) ? json.data : []);
      }
    } catch {
      // le polling retentera
    }
  }, []);

  const chargerConversation = useCallback(async (id: number) => {
    try {
      const res = await apiFetch(`/chat/${id}`);
      if (res.ok) {
        const conv = await res.json();
        setMessages(Array.isArray(conv?.messages) ? conv.messages : []);
      }
    } catch {
      // silencieux
    }
  }, []);

  useEffect(() => {
    chargerConversations();
    const t = setInterval(chargerConversations, 6000);
    return () => clearInterval(t);
  }, [chargerConversations]);

  useEffect(() => {
    if (activeId === null) return;
    setLoadingThread(true);
    chargerConversation(activeId).finally(() => setLoadingThread(false));
    const t = setInterval(() => chargerConversation(activeId), 5000);
    return () => clearInterval(t);
  }, [activeId, chargerConversation]);

  const envoyer = async () => {
    if (!activeId || !draft.trim() || sending) return;
    const contenu = draft.trim();
    setSending(true);
    try {
      const res = await apiFetch(`/chat/${activeId}/message`, {
        method: "POST",
        body: JSON.stringify({ message: contenu }),
      });
      if (res.ok) {
        setDraft("");
        await chargerConversation(activeId);
        await chargerConversations();
        setTimeout(
          () => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }),
          150
        );
      }
    } finally {
      setSending(false);
    }
  };

  const ouvrirNouvelleDiscussion = async () => {
    setShowNewDialog(true);
    setSelectedIds([]);
    try {
      const res = await apiFetch("/users");
      if (res.ok) {
        const json = await res.json();
        const liste: ChatUser[] = Array.isArray(json) ? json : json?.data ?? [];
        setStaff(liste.filter((u: ChatUser) => u.id !== user?.id));
      }
    } catch {
      setStaff([]);
    }
  };

  const creerDiscussion = async () => {
    if (selectedIds.length === 0) return;
    const autres = selectedIds
      .map((id) => staff.find((s) => s.id === id)?.name ?? "")
      .filter(Boolean);
    const titre =
      autres.length === 1 ? autres[0] : `Groupe (${autres.length + 1} membres)`;

    try {
      const res = await apiFetch("/chat", {
        method: "POST",
        body: JSON.stringify({
          titre,
          type: autres.length === 1 ? "prive" : "groupe",
          participant_ids: selectedIds,
        }),
      });
      if (res.ok) {
        setShowNewDialog(false);
        await chargerConversations();
        const json = await res.json();
        if (json?.data?.id) setActiveId(json.data.id);
      }
    } catch {
      // silencieux
    }
  };

  const initiale = (nom?: string) => (nom ?? "?").charAt(0).toUpperCase();

  const heureCourte = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      onPress={() => setActiveId(item.id)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: COLORS.card,
        borderRadius: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: "#334155",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
          {item.type === "groupe" ? "#" : initiale(item.titre)}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: COLORS.textPrimary, fontWeight: "600", fontSize: 15 }} numberOfLines={1}>
          {item.titre}
        </Text>
        <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
          {item.dernier_message?.message ?? "—"}
        </Text>
      </View>
      {(item.messages_non_lus ?? 0) > 0 && (
        <View
          style={{
            backgroundColor: COLORS.accent,
            minWidth: 24,
            height: 24,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 7,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
            {item.messages_non_lus}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    if (item.type === "systeme") {
      return (
        <Text
          style={{
            alignSelf: "center",
            color: COLORS.textSecondary,
            fontSize: 11,
            marginVertical: 6,
            textAlign: "center",
          }}
        >
          {item.message}
        </Text>
      );
    }
    const mine = item.user_id === user?.id;
    return (
      <View
        style={{
          alignSelf: mine ? "flex-end" : "flex-start",
          maxWidth: "78%",
          backgroundColor: mine ? COLORS.accent : COLORS.card,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          borderBottomLeftRadius: mine ? 18 : 4,
          borderBottomRightRadius: mine ? 4 : 18,
          paddingHorizontal: 13,
          paddingVertical: 9,
          marginVertical: 3,
        }}
      >
        {!mine && (
          <Text style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: "700", marginBottom: 2 }}>
            {item.user?.name ?? "Membre"}
          </Text>
        )}
        <Text style={{ color: mine ? "#ffffff" : COLORS.textPrimary, fontSize: 15 }}>
          {item.message}
        </Text>
        <Text
          style={{
            color: mine ? "rgba(255,255,255,0.75)" : COLORS.textSecondary,
            fontSize: 10,
            alignSelf: "flex-end",
            marginTop: 3,
          }}
        >
          {heureCourte(item.created_at)}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {!activeConversation ? (
        <View style={{ flex: 1, padding: 16 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <Text style={{ color: COLORS.textPrimary, fontSize: 22, fontWeight: "800" }}>
              Messages
            </Text>
            {peutCreer && (
              <TouchableOpacity
                onPress={ouvrirNouvelleDiscussion}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: COLORS.accent,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 12,
                }}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                  Nouvelle
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {conversations.length === 0 ? (
            <View
              style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }}
            >
              <Ionicons name="chatbubbles-outline" size={48} color={COLORS.border} />
              <Text style={{ color: COLORS.textSecondary, fontSize: 14 }}>
                Aucune discussion pour le moment.
              </Text>
            </View>
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderConversation}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingHorizontal: 12,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: COLORS.border,
              backgroundColor: COLORS.card,
            }}
          >
            <TouchableOpacity onPress={() => setActiveId(null)}>
              <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text
              style={{ color: COLORS.textPrimary, fontSize: 17, fontWeight: "700", flexShrink: 1 }}
              numberOfLines={1}
            >
              {activeConversation.titre}
            </Text>
          </View>

          {loadingThread ? (
            <ActivityIndicator color={COLORS.accent} style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              ref={flatListRef}
              data={[...messages].reverse()}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderMessage}
              inverted
              contentContainerStyle={{ padding: 14 }}
              showsVerticalScrollIndicator={false}
            />
          )}

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              padding: 12,
              borderTopWidth: 1,
              borderTopColor: COLORS.border,
              backgroundColor: COLORS.card,
            }}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Écrire un message…"
              placeholderTextColor={COLORS.textSecondary}
              multiline
              style={{
                flex: 1,
                backgroundColor: COLORS.bg,
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: Platform.OS === "ios" ? 10 : 6,
                color: COLORS.textPrimary,
                maxHeight: 100,
                fontSize: 15,
              }}
            />
            <TouchableOpacity
              onPress={envoyer}
              disabled={sending || !draft.trim()}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor:
                  sending || !draft.trim() ? COLORS.border : COLORS.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={19} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      <Modal visible={showNewDialog} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.65)",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: COLORS.border,
              width: "100%",
              maxWidth: 420,
              padding: 18,
            }}
          >
            <Text style={{ color: COLORS.textPrimary, fontSize: 17, fontWeight: "800" }}>
              Nouvelle discussion
            </Text>
            <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 3 }}>
              Choisissez les membres de votre équipe.
            </Text>

            <FlatList
              data={staff}
              keyExtractor={(item) => String(item.id)}
              style={{ maxHeight: 260, marginTop: 12 }}
              ListEmptyComponent={
                <Text style={{ color: COLORS.textSecondary, fontSize: 13, paddingVertical: 8 }}>
                  Aucun autre membre trouvé.
                </Text>
              }
              renderItem={({ item }) => {
                const checked = selectedIds.includes(item.id);
                return (
                  <TouchableOpacity
                    onPress={() =>
                      setSelectedIds((prev) =>
                        checked ? prev.filter((x) => x !== item.id) : [...prev, item.id]
                      )
                    }
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      paddingVertical: 9,
                    }}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        borderWidth: 2,
                        borderColor: checked ? COLORS.accent : COLORS.border,
                        backgroundColor: checked ? COLORS.accent : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        backgroundColor: "#334155",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                        {initiale(item.name)}
                      </Text>
                    </View>
                    <View>
                      <Text style={{ color: COLORS.textPrimary, fontSize: 14, fontWeight: "600" }}>
                        {item.name}
                      </Text>
                      <Text style={{ color: COLORS.textSecondary, fontSize: 11, textTransform: "capitalize" }}>
                        {item.role ?? ""}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                onPress={() => setShowNewDialog(false)}
                style={{ paddingVertical: 9, paddingHorizontal: 16, borderRadius: 12 }}
              >
                <Text style={{ color: COLORS.textSecondary, fontWeight: "600" }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={creerDiscussion}
                disabled={selectedIds.length === 0}
                style={{
                  backgroundColor: selectedIds.length === 0 ? COLORS.border : COLORS.accent,
                  paddingVertical: 9,
                  paddingHorizontal: 18,
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Créer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
