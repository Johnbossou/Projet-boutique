import { lireErreurApi } from './api-errors';

export interface OfflineQueueItem {
  id: string;
  vente: Record<string, unknown>;
  timestamp: number;
  status: 'pending' | 'synced' | 'failed';
}

export interface ResultatSyncOffline {
  /** Identifiants des ventes définitivement synchronisées. */
  synchronisees: string[];
  /** Ventes retirées de la file parce que le serveur les a rejetées. */
  rejetees: { id: string; raison: string }[];
  /** Identifiants conservés pour un nouvel essai. */
  enAttente: string[];
}

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Rejoue la file de ventes hors-ligne.
 *
 * Le client HTTP est injecté pour que la logique de décision soit testable sans
 * réseau ni navigateur.
 *
 * Règle de conservation : une vente n'est retirée de la file que si le serveur
 * l'a acceptée, ou si le refus est définitif.
 *  - 2xx                -> retirée, comptée en synchronisée ;
 *  - 4xx                -> retirée : produit hors boutique, stock insuffisant,
 *                          payload invalide. Rejouer ne peut jamais aboutir, et
 *                          sans retrait le badge « En attente » ne cesse de
 *                          compter sans que l'utilisateur comprenne pourquoi ;
 *  - 5xx / réseau / 3xx -> conservée : l'échec est transitoire.
 */
export async function syncOfflineQueue(
  file: OfflineQueueItem[],
  apiFetch: Fetcher,
): Promise<ResultatSyncOffline> {
  const resultat: ResultatSyncOffline = {
    synchronisees: [],
    rejetees: [],
    enAttente: [],
  };

  for (const item of file) {
    try {
      const response = await apiFetch('/ventes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(item.vente),
      });

      if (response.ok) {
        resultat.synchronisees.push(item.id);
        continue;
      }

      if (response.status >= 400 && response.status < 500) {
        const data = await response.json().catch(() => null);
        resultat.rejetees.push({
          id: item.id,
          raison: lireErreurApi(data) ?? `Vente refusée (${response.status})`,
        });
        continue;
      }

      // 5xx ou 3xx : erreur serveur ou redirection, on conserve pour réessai.
      resultat.enAttente.push(item.id);
    } catch {
      // Réseau indisponible : on conserve pour un nouvel essai.
      resultat.enAttente.push(item.id);
    }
  }

  return resultat;
}
