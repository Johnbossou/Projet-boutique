'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/types';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API functions directement dans le contexte
const api = {
  login: async (credentials: { email: string; password: string }) => {
    const response = await fetch('http://localhost:8000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        message: 'Erreur de connexion' 
      }));
      throw new Error(errorData.message || 'Erreur de connexion');
    }

    return response.json();
  },

  logout: async () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      await fetch('http://localhost:8000/api/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    }
  },

  getProfile: async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('No token found');
    }

    const response = await fetch('http://localhost:8000/api/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Token invalide');
    }

    return response.json();
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // useCallback pour stabiliser la fonction checkAuth
  const checkAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const userData = localStorage.getItem('user_data');
      
      console.log('🔍 Auth check - Token:', token ? 'PRÉSENT' : 'ABSENT');
      console.log('🔍 Auth check - User data:', userData ? 'PRÉSENT' : 'ABSENT');

      if (token && userData) {
        try {
          console.log('🔄 Vérification du token avec API...');
          const response = await api.getProfile();
          console.log('✅ Token valide, user:', response.user);
          setUser(response.user);
        } catch {
          console.log('🚨 Token invalide, nettoyage...');
          // Token invalide, on nettoie
          localStorage.removeItem('auth_token');
          localStorage.removeItem('token_expires_at');
          localStorage.removeItem('user_data');
          setUser(null);
        }
      } else {
        console.log('❌ Pas de token ou user data trouvé');
        setUser(null);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Erreur inconnue lors de la vérification auth';
      
      console.error('🚨 Erreur lors de la vérification auth:', errorMessage);
      // En cas d'erreur, on nettoie et on considère comme non connecté
      localStorage.removeItem('auth_token');
      localStorage.removeItem('token_expires_at');
      localStorage.removeItem('user_data');
      setUser(null);
    } finally {
      setIsLoading(false);
      console.log('🏁 Vérification auth terminée');
    }
  }, []);

  useEffect(() => {
    console.log('🔄 AuthProvider mounted - Checking auth...');
    checkAuth();
  }, [checkAuth]);

  // useCallback pour stabiliser la fonction login
  const login = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true);
      console.log('🔐 [AUTH] Début login avec:', email);
      
      console.log('🔐 [AUTH] Appel API...');
      const response = await api.login({ email, password });
      console.log('🔐 [AUTH] Réponse API reçue');
      
      const { token, user: userData } = response;
      console.log('🔐 [AUTH] Token extrait:', token ? 'PRÉSENT' : 'ABSENT');
      console.log('🔐 [AUTH] User extrait:', userData);
      
      console.log('🔐 [AUTH] Stockage localStorage...');
      localStorage.setItem('auth_token', token);
      localStorage.setItem('token_expires_at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
      localStorage.setItem('user_data', JSON.stringify(userData));
      
      console.log('🔐 [AUTH] setUser() appelé');
      setUser(userData);
      
      console.log('🔐 [AUTH] Redirection vers /dashboard...');
      // REDIRECTION SIMPLE SANS REFRESH
      router.push('/dashboard');
      
      console.log('🟢 [AUTH] Login COMPLÈTEMENT TERMINÉ');
      
    } catch (error: unknown) {
      console.error('🔴 [AUTH] ERREUR CAPTURÉE:', error);
      
      if (error instanceof Error) {
        console.error('🔴 [AUTH] Message erreur:', error.message);
      }
      
      console.log('🟡 [AUTH] Nettoyage localStorage...');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('token_expires_at');
      localStorage.removeItem('user_data');
      
      console.log('🟡 [AUTH] setUser(null)');
      setUser(null);
      
      throw new Error(error instanceof Error ? error.message : 'Échec de la connexion');
    } finally {
      console.log('🟡 [AUTH] isLoading = false');
      setIsLoading(false);
    }
  }, [router]);

  // useCallback pour stabiliser la fonction logout
  const logout = useCallback(async () => {
    try {
      console.log('🚪 Déconnexion en cours...');
      
      // Appeler l'API de déconnexion si possible
      await api.logout();
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Erreur inconnue lors de la déconnexion API';
      
      console.error('Erreur lors de la déconnexion API:', errorMessage);
      // On continue même si l'API échoue
    } finally {
      // Nettoyer le localStorage dans tous les cas
      localStorage.removeItem('auth_token');
      localStorage.removeItem('token_expires_at');
      localStorage.removeItem('user_data');
      setUser(null);
      
      toast.info('👋 Déconnexion réussie');
      console.log('✅ Déconnexion terminée, redirection vers login');
      
      router.push('/login');
    }
  }, [router]);

  // useMemo pour stabiliser la valeur du contexte
  const contextValue = useMemo(() => ({
    user,
    login,
    logout,
    isLoading,
  }), [user, login, logout, isLoading]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth doit être utilisé within an AuthProvider');
  }
  return context;
};