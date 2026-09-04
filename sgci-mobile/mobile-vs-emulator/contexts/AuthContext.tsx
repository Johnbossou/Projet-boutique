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
  | { success: true }
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
          setUser(data.user);
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
        await AsyncStorage.setItem('user_data', JSON.stringify(data.user));
        setUser(data.user);
        fetchBoutiqueSettings().catch(() => undefined);
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
      // Update user data with new boutique info
      setUser((prevUser) => {
        if (!prevUser) return null;
        return {
          ...prevUser,
          current_boutique_id: data.current_boutique_id,
          current_boutique: data.current_boutique,
        };
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
