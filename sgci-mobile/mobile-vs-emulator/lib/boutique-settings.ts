import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '@/lib/api-client';
import { saveBoutiqueSettings, type BoutiqueSettings } from '@/lib/preferences';

const META_KEY = 'sgci_boutique_api_meta';

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
  await AsyncStorage.setItem(
    META_KEY,
    JSON.stringify({
      delai_annulation_vente_minutes: settings.delai_annulation_vente_minutes ?? 5,
    })
  );
}

export function getDelaiAnnulationMsSync(): number {
  return 5 * 60 * 1000;
}

export async function getDelaiAnnulationMs(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    if (!raw) return 5 * 60 * 1000;
    const meta = JSON.parse(raw);
    const minutes = Number(meta.delai_annulation_vente_minutes ?? 5);
    return minutes <= 0 ? Number.MAX_SAFE_INTEGER : minutes * 60 * 1000;
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
