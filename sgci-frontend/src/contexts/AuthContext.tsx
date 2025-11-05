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
  getToken: () => Promise<string | null>; // ⬅️ FONCTION AJOUTÉE
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API functions directement dans le contexte (TESTÉES et FONCTIONNELLES)
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

  // 🎯 NOUVELLE FONCTION getToken
  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.warn('❌ Aucun token trouvé dans le localStorage');
        return null;
      }
      
      // Optionnel: Vérifier si le token est encore valide
      console.log('✅ Token récupéré:', token.substring(0, 20) + '...');
      return token;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération du token:', error);
      return null;
    }
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const userData = localStorage.getItem('user_data');

      if (token && userData) {
        try {
          const response = await api.getProfile();
          setUser(response.user);
        } catch {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_data');
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (error) {
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
      console.log('🔄 Tentative de connexion avec:', email);
      
      const response = await api.login({ email, password });
      const { token, user: userData } = response;
      
      console.log('✅ Connexion réussie, token reçu');
      
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user_data', JSON.stringify(userData));
      
      // 🎯 SOLUTION : Redirection NATIVE pour éviter les conflits
      window.location.href = '/dashboard';
      
      // 🚨 NE RIEN METTRE APRÈS - la redirection arrête l'exécution
      
    } catch (error: unknown) {
      console.error('🚨 Échec de la connexion:', error);
      
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
      setUser(null);
      
      throw new Error(error instanceof Error ? error.message : 'Échec de la connexion');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    setUser(null);
    router.push('/login');
  }, [router]);

  const contextValue = useMemo(() => ({
    user,
    login,
    logout,
    isLoading,
    getToken, // ⬅️ AJOUTÉ AU CONTEXTE
  }), [user, login, logout, isLoading, getToken]);

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