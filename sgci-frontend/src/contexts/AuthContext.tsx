'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { useRouter } from 'next/navigation';
import { User, Boutique } from '@/types';
import { apiFetch } from '@/lib/api-client';
import { fetchBoutiqueSettings } from '@/lib/boutique-settings';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
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
      return localStorage.getItem('auth_token');
    } catch {
      return null;
    }
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const userData = localStorage.getItem('user_data');

      if (token && userData) {
        try {
          const response = await apiFetch('/me');
          if (!response.ok) {
            throw new Error('Token invalide');
          }
          const data = await response.json();
          setUser(data.user);
          fetchBoutiqueSettings().catch(() => undefined);
        } catch {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_data');
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const response = await apiFetch('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          message: 'Erreur de connexion',
        }));
        throw new Error(errorData.message || 'Erreur de connexion');
      }

      const { token, user: userData, expires_at } = await response.json();
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user_data', JSON.stringify(userData));
      if (expires_at) {
        localStorage.setItem('token_expires_at', expires_at);
      }
      setUser(userData);
      fetchBoutiqueSettings().catch(() => undefined);
      
      // Redirection selon le rôle
      if (userData.role === 'proprietaire') {
        router.push('/selection-boutique');
      } else {
        router.push('/dashboard');
      }
    } catch (error: unknown) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
      setUser(null);
      throw new Error(
        error instanceof Error ? error.message : 'Échec de la connexion'
      );
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await apiFetch('/logout', { method: 'POST' });
    } catch {
      // Même si le logout distant échoue, on supprime les sessions locales.
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
      setUser(null);
      setIsLoading(false);
      router.push('/login');
    }
  }, [router]);

  const switchBoutique = useCallback(async (boutiqueId: number) => {
    try {
      setIsLoading(true);
      const response = await apiFetch('/switch-boutique', {
        method: 'POST',
        body: JSON.stringify({ boutique_id: boutiqueId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          message: 'Erreur lors du changement de boutique',
        }));
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
      throw new Error(
        error instanceof Error ? error.message : 'Échec du changement de boutique'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      user,
      login,
      logout,
      isLoading,
      getToken,
      switchBoutique,
    }),
    [user, login, logout, isLoading, getToken, switchBoutique]
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth doit être utilisé within an AuthProvider');
  }
  return context;
};
