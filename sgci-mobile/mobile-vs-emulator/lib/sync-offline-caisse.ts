import { apiFetch } from "@/lib/api-client";
import {
  loadOfflineQueue,
  saveOfflineQueue,
  type OfflineVentePayload,
} from "@/lib/offline-caisse";

export async function syncOfflineQueue(): Promise<number> {
  const queue = await loadOfflineQueue();
  if (queue.length === 0) return 0;

  let synced = 0;
  const remaining: OfflineVentePayload[] = [];

  for (const item of queue) {
    try {
      const response = await apiFetch("/ventes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(item.vente),
      });
      if (response.ok) {
        synced += 1;
      } else {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  await saveOfflineQueue(remaining);
  return synced;
}
