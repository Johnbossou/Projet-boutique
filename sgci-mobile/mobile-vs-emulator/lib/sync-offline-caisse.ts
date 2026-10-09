import { apiFetch } from "@/lib/api-client";
import {
  loadOfflineQueue,
  saveOfflineQueue,
  type OfflineVentePayload,
} from "@/lib/offline-caisse";

export interface SyncResultats {
  synced: number;
  /** Ventes définitivement rejetées par le serveur (4xx). */
  rejetees: { id: string; raison: string }[];
  /** Ventes conservées pour un nouvel essai (réseau ou 5xx). */
  enAttente: number;
}

/**
 * Rejoue la file des ventes hors-ligne.
 *
 * Distingue les rejets définitifs (4xx) des échecs transitoires (réseau, 5xx).
 * Avant, toute réponse non-2xx remettait la vente dans la file : une vente
 * rejetée pour toujours (produit d'une autre boutique, stock insuffisant)
 * était rejouée à chaque montage et à chaque rafraîchissement, sans jamais
 * sortir de la file ni prévenir le caissier.
 */
export async function syncOfflineQueue(): Promise<SyncResultats> {
  const queue = await loadOfflineQueue();
  if (queue.length === 0) return { synced: 0, rejetees: [], enAttente: 0 };

  let synced = 0;
  const remaining: OfflineVentePayload[] = [];
  const rejetees: { id: string; raison: string }[] = [];

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
        continue;
      }

      if (response.status >= 400 && response.status < 500) {
        const data = await response.json().catch(() => null);
        rejetees.push({ id: item.id, raison: lireErreurApi(data) ?? `Erreur ${response.status}` });
        continue;
      }

      // 5xx : erreur serveur, on conserve pour un nouvel essai
      remaining.push(item);
    } catch {
      // Réseau indisponible : on conserve pour un nouvel essai
      remaining.push(item);
    }
  }

  await saveOfflineQueue(remaining);
  return { synced, rejetees, enAttente: remaining.length };
}

/**
 * Traduit une réponse d'erreur Laravel en message lisible.
 *
 * Deux formes côté backend :
 *  - { message: '...' } pour un refus métier (stock insuffisant, délai) ;
 *  - { errors: { 'ligne_ventes.0.produit_id': ['...'] } } pour une validation.
 * OperationRefusee renvoie { error: 'code', message: '...' } : le message reste
 * prioritaire, le code n'est utilisé que si aucun message n'est fourni.
 */
export function lireErreurApi(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;

  const body = data as {
    message?: string;
    error?: string;
    errors?: Record<string, string[] | string>;
  };

  if (typeof body.message === "string" && body.message.trim().length > 0) {
    return body.message;
  }

  if (body.errors && typeof body.errors === "object") {
    const messages = Object.values(body.errors)
      .flatMap((v) => (Array.isArray(v) ? v : [v]))
      .filter((m): m is string => typeof m === "string" && m.length > 0);

    if (messages.length > 0) return messages.join(" ");
  }

  if (typeof body.error === "string" && body.error.trim().length > 0) {
    return body.error;
  }

  return null;
}
