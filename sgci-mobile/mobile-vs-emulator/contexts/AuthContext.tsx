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

interface User {
  id: number;
  name: string;
  email: string;
  role: 'gerant' | 'caissier';
  telephone?: string | null;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
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
    async (email: string, password: string) => {
      setIsLoading(true);
      try {
        const response = await apiFetch('/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Identifiants incorrects');
        }

        const data = await response.json();
        await SecureStore.setItemAsync('auth_token', data.token);
        await AsyncStorage.setItem('user_data', JSON.stringify(data.user));
        setUser(data.user);
        fetchBoutiqueSettings().catch(() => undefined);
        router.replace('/(tabs)');
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Erreur de connexion';
        Alert.alert('Erreur', message);
        throw error;
      } finally {
        setIsLoading(false);
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

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      getToken,
    }),
    [user, isLoading, login, logout, getToken]
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
