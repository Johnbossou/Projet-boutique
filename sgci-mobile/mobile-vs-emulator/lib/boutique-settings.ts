import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '@/lib/api-client';
import { saveBoutiqueSettings, type BoutiqueSettings } from '@/lib/preferences';

const META_KEY = 'sgci_boutique_api_meta';

/**
 * Miroir mémoire des paramètres de la boutique courante.
 *
 * AsyncStorage est asynchrone alors que le calcul du ticket doit rester
 * synchrone (useMemo), on garde donc une copie en mémoire mise à jour à
 * chaque fetchBoutiqueSettings().
 */
let metaMemoire: { taux_tva: number; delai_annulation_vente_minutes: number } = {
  taux_tva: 18,
  delai_annulation_vente_minutes: 5,
};

export interface BoutiqueSettingsApi {
  nom: string;
  adresse?: string | null;
  telephone?: string | null;
  email?: string | null;
  devise: string;
  taux_tva: number;
  delai_annulation_vente_minutes: number;
}

export async function cacheBoutiqueMeta(settings: BoutiqueSettingsApi): Promise<void> {
  const taux = Number(settings.taux_tva ?? 18);
  const delai = Number(settings.delai_annulation_vente_minutes ?? 5);

  // Le taux de TVA est propre à chaque boutique : sans le persister, la
  // caisse affichait toujours 18 % et un montant différent de celui
  // réellement encaissé par le serveur.
  metaMemoire = {
    taux_tva: Number.isFinite(taux) && taux >= 0 ? taux : 18,
    delai_annulation_vente_minutes: Number.isFinite(delai) && delai >= 0 ? delai : 5,
  };

  await AsyncStorage.setItem(META_KEY, JSON.stringify(metaMemoire));
}

/**
 * Taux de TVA courant sous forme de ratio (0.18) et non de pourcentage.
 */
export function getTauxTvaSync(): number {
  const taux = metaMemoire.taux_tva;
  if (!Number.isFinite(taux) || taux < 0) return 0.18;
  return taux > 1 ? taux / 100 : taux;
}

/**
 * Fenêtre d'annulation en millisecondes, depuis le miroir mémoire.
 *
 * Sémantique : 0 signifie « annulation désactivée » (MAX_SAFE_INTEGER). Une
 * valeur négative est considered comme des données corrompues et retombe sur le
 * défaut de 5 minutes : la traiter comme « pas de limite » ouvrirait une fenêtre
 * d'annulation illimitée, donc une faille de caisse.
 */
export function getDelaiAnnulationMsSync(): number {
  const minutes = metaMemoire.delai_annulation_vente_minutes;
  if (!Number.isFinite(minutes) || minutes < 0) return 5 * 60 * 1000;
  if (minutes === 0) return Number.MAX_SAFE_INTEGER;
  return minutes * 60 * 1000;
}

export async function getDelaiAnnulationMs(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    if (!raw) return 5 * 60 * 1000;
    const meta = JSON.parse(raw);
    const minutes = Number(meta.delai_annulation_vente_minutes ?? 5);
    if (!Number.isFinite(minutes) || minutes < 0) return 5 * 60 * 1000;
    if (minutes === 0) return Number.MAX_SAFE_INTEGER;
    return minutes * 60 * 1000;
  } catch {
    return 5 * 60 * 1000;
  }
}

export function apiToLocal(s: BoutiqueSettingsApi): BoutiqueSettings {
  return {
    nom: s.nom,
    adresse: s.adresse ?? '',
    telephone: s.telephone ?? '',
    email: s.email ?? '',
    tva: Number(s.taux_tva ?? 18),
    devise: s.devise ?? 'FCFA',
  };
}

export async function fetchBoutiqueSettings(): Promise<BoutiqueSettingsApi | null> {
  const response = await apiFetch('/boutique/settings');
  if (!response.ok) return null;
  const data = await response.json();
  await cacheBoutiqueMeta(data);
  await saveBoutiqueSettings(apiToLocal(data));
  return data;
}

export async function updateBoutiqueSettings(
  payload: Partial<BoutiqueSettingsApi>
): Promise<BoutiqueSettingsApi> {
  const response = await apiFetch('/boutique/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Erreur mise à jour boutique');
  }
  const data = await response.json();
  const settings = data.settings ?? data;
  await cacheBoutiqueMeta(settings);
  await saveBoutiqueSettings(apiToLocal(settings));
  return settings;
}
