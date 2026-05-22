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
  queue.push({
    id: `vente_${Date.now()}`,
    vente,
    timestamp: Date.now(),
  });
  await saveOfflineQueue(queue);
}
