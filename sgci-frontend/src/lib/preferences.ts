const BOUTIQUE_KEY = 'sgci_boutique_settings';
const PREFS_KEY = 'sgci_user_preferences';

export interface BoutiqueSettings {
  nom: string;
  adresse: string;
  telephone: string;
  email: string;
  tva: number;
  devise: string;
}

export interface UserPreferences {
  notificationsEmail: boolean;
  notificationsSMS: boolean;
  darkMode: boolean;
  autoBackup: boolean;
  rapportsAutomatiques: boolean;
  alertesStock: boolean;
}

export const defaultBoutique: BoutiqueSettings = {
  nom: 'SGCI Bénin - Boutique Principale',
  adresse: 'Cotonou, Bénin',
  telephone: '+229 01 02 03 04',
  email: 'contact@sgci.bj',
  tva: 18,
  devise: 'FCFA',
};

export const defaultPreferences: UserPreferences = {
  notificationsEmail: true,
  notificationsSMS: false,
  darkMode: true,
  autoBackup: true,
  rapportsAutomatiques: true,
  alertesStock: true,
};

export function loadBoutiqueSettings(): BoutiqueSettings {
  if (typeof window === 'undefined') return defaultBoutique;
  try {
    const raw = localStorage.getItem(BOUTIQUE_KEY);
    return raw ? { ...defaultBoutique, ...JSON.parse(raw) } : defaultBoutique;
  } catch {
    return defaultBoutique;
  }
}

export function saveBoutiqueSettings(settings: BoutiqueSettings): void {
  localStorage.setItem(BOUTIQUE_KEY, JSON.stringify(settings));
}

export function loadUserPreferences(): UserPreferences {
  if (typeof window === 'undefined') return defaultPreferences;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...defaultPreferences, ...JSON.parse(raw) } : defaultPreferences;
  } catch {
    return defaultPreferences;
  }
}

export function saveUserPreferences(prefs: UserPreferences): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}
