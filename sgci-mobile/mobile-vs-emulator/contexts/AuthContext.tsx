import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Alert } from 'react-native';
import { apiFetch } from '@/lib/api-client';
import { fetchBoutiqueSettings } from '@/lib/boutique-settings';
import { User } from '@/types';

export type LoginResult =
  | { success: true; needsBoutiqueSelection?: boolean }
  | { success: false; message: string }
  | { requiresTwoFactor: true };

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, twoFactorCode?: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
  switchBoutique: (boutiqueId: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Le rôle global (User.role) est le rôle le plus élevé parmi les boutiques.
 * Pour l'interface, on veut le rôle DANS la boutique courante (role_courant).
 */
function normalizeUser(dUser: User): User {
  if (!dUser.role_courant) return dUser;
  return {
    ...dUser,
    role: dUser.role_courant,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync('auth_token');
    } catch {
      return null;
    }
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      const userData = await AsyncStorage.getItem('user_data');

      if (token && userData) {
        const response = await apiFetch('/me');
        if (response.ok) {
          const data = await response.json();
          setUser(normalizeUser(data.user));
          fetchBoutiqueSettings().catch(() => undefined);
        } else {
          await SecureStore.deleteItemAsync('auth_token');
          await AsyncStorage.removeItem('user_data');
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(
    async (email: string, password: string, twoFactorCode?: string): Promise<LoginResult> => {
      const body: Record<string, unknown> = { email, password };
      if (twoFactorCode) body.two_factor_code = twoFactorCode;
      try {
        const response = await apiFetch('/login', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          return { success: false, message: data.message || 'Identifiants incorrects' };
        }

        if (data.requires_two_factor) {
          return { requiresTwoFactor: true };
        }

        if (!data.token) {
          return { success: false, message: 'Réponse du serveur invalide' };
        }

        await SecureStore.setItemAsync('auth_token', data.token);

        // Recharger le profil complet (boutiques + role_courant + current_boutique_id)
        // via /me, car /login ne renvoie qu'un user réduit.
        let fullUser: User = data.user;
        try {
          const meResponse = await apiFetch('/me');
          if (meResponse.ok) {
            const meData = await meResponse.json();
            fullUser = meData.user;
          }
        } catch {
          // Non bloquant : on conserve le user réduit en cas de souci réseau.
        }
        fullUser = normalizeUser(fullUser);

        await AsyncStorage.setItem('user_data', JSON.stringify(fullUser));
        setUser(fullUser);
        fetchBoutiqueSettings().catch(() => undefined);

        if ((fullUser.boutiques?.length ?? 0) > 1) {
          // La page de connexion affiche le sélecteur de boutique
          return { success: true, needsBoutiqueSelection: true };
        }

        router.replace('/(tabs)');
        return { success: true };
      } catch {
        return { success: false, message: 'Erreur réseau. Vérifiez votre connexion.' };
      }
    },
    [router]
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch('/logout', { method: 'POST' });
    } catch {
      // ignore network errors on logout
    }
    await SecureStore.deleteItemAsync('auth_token');
    await AsyncStorage.removeItem('user_data');
    setUser(null);
    router.replace('/(auth)/login');
  }, [router]);

  const switchBoutique = useCallback(async (boutiqueId: number) => {
    setIsLoading(true);
    try {
      const response = await apiFetch('/switch-boutique', {
        method: 'POST',
        body: JSON.stringify({ boutique_id: boutiqueId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Erreur lors du changement de boutique');
      }

      const data = await response.json();
      setUser((prevUser) => {
        if (!prevUser) return null;
        return normalizeUser({
          ...prevUser,
          role_courant: data.role_courant,
          current_boutique_id: data.current_boutique_id,
          current_boutique: data.current_boutique,
        });
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Échec du changement de boutique';
      Alert.alert('Erreur', message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      getToken,
      switchBoutique,
    }),
    [user, isLoading, login, logout, getToken, switchBoutique]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
}
