import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "sgci_caisse_offline_queue";

export interface OfflineVentePayload {
  id: string;
  vente: Record<string, unknown>;
  timestamp: number;
}

export async function loadOfflineQueue(): Promise<OfflineVentePayload[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveOfflineQueue(queue: OfflineVentePayload[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueueOfflineVente(vente: Record<string, unknown>): Promise<void> {
  const queue = await loadOfflineQueue();

  // Clé d'idempotence : si la synchro renvoie la vente (réponse perdue
  // après commit serveur), l'API reconnaît la clé et ne crée pas de doublon
  const idempotencyKey =
    typeof vente.idempotency_key === "string" && vente.idempotency_key.length > 0
      ? vente.idempotency_key
      : `offline_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  queue.push({
    id: `vente_${Date.now()}`,
    vente: { ...vente, idempotency_key: idempotencyKey },
    timestamp: Date.now(),
  });
  await saveOfflineQueue(queue);
}
