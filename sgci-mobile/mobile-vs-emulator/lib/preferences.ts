import AsyncStorage from '@react-native-async-storage/async-storage';

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

export async function loadBoutiqueSettings(): Promise<BoutiqueSettings> {
  try {
    const raw = await AsyncStorage.getItem(BOUTIQUE_KEY);
    return raw ? { ...defaultBoutique, ...JSON.parse(raw) } : defaultBoutique;
  } catch {
    return defaultBoutique;
  }
}

export async function saveBoutiqueSettings(settings: BoutiqueSettings): Promise<void> {
  await AsyncStorage.setItem(BOUTIQUE_KEY, JSON.stringify(settings));
}

export async function loadUserPreferences(): Promise<UserPreferences> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    return raw ? { ...defaultPreferences, ...JSON.parse(raw) } : defaultPreferences;
  } catch {
    return defaultPreferences;
  }
}

export async function saveUserPreferences(prefs: UserPreferences): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}
