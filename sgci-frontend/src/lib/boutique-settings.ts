import { apiFetch } from '@/lib/api-client';
import { saveBoutiqueSettings, type BoutiqueSettings } from '@/lib/preferences';

export interface BoutiqueSettingsApi {
  id?: number;
  nom: string;
  adresse?: string | null;
  telephone?: string | null;
  email?: string | null;
  devise: string;
  taux_tva: number;
  delai_annulation_vente_minutes: number;
}

const META_KEY = 'sgci_boutique_api_meta';

export function cacheBoutiqueMeta(settings: BoutiqueSettingsApi): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(META_KEY, JSON.stringify({
    delai_annulation_vente_minutes: settings.delai_annulation_vente_minutes ?? 5,
    taux_tva: settings.taux_tva ?? 18,
  }));
}

export function getDelaiAnnulationMs(): number {
  if (typeof window === 'undefined') return 5 * 60 * 1000;
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return 5 * 60 * 1000;
    const meta = JSON.parse(raw);
    const minutes = Number(meta.delai_annulation_vente_minutes ?? 5);
    return minutes <= 0 ? Number.MAX_SAFE_INTEGER : minutes * 60 * 1000;
  } catch {
    return 5 * 60 * 1000;
  }
}

export function apiToLocal(settings: BoutiqueSettingsApi): BoutiqueSettings {
  return {
    nom: settings.nom,
    adresse: settings.adresse ?? '',
    telephone: settings.telephone ?? '',
    email: settings.email ?? '',
    tva: Number(settings.taux_tva ?? 18),
    devise: settings.devise ?? 'FCFA',
  };
}

export function localToApi(
  boutique: BoutiqueSettings,
  delaiMinutes = 5
): Partial<BoutiqueSettingsApi> {
  return {
    nom: boutique.nom,
    adresse: boutique.adresse || null,
    telephone: boutique.telephone || null,
    email: boutique.email || null,
    devise: boutique.devise,
    taux_tva: boutique.tva,
    delai_annulation_vente_minutes: delaiMinutes,
  };
}

export async function fetchBoutiqueSettings(): Promise<BoutiqueSettingsApi | null> {
  const response = await apiFetch('/boutique/settings');
  if (!response.ok) return null;
  const data = await response.json();
  cacheBoutiqueMeta(data);
  saveBoutiqueSettings(apiToLocal(data));
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
  cacheBoutiqueMeta(settings);
  saveBoutiqueSettings(apiToLocal(settings));
  return settings;
}
