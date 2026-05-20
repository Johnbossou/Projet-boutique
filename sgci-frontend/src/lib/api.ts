import axios from 'axios';

import { API_BASE_URL } from './config';

// Instance axios avec intercepteurs avancés
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'X-Application': 'SGCI-Bénin-Premium'
  }
});

// Gestion d'authentification avec refresh token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    const expiresAt = localStorage.getItem('token_expires_at');
    
    if (token && expiresAt && new Date() < new Date(expiresAt)) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      // Token expiré, déconnexion automatique
      localStorage.removeItem('auth_token');
      localStorage.removeItem('token_expires_at');
      localStorage.removeItem('user_data');
      window.location.href = '/login';
    }
  }
  return config;
});

// Gestion avancée des erreurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirection élégante vers login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('token_expires_at');
        localStorage.removeItem('user_data');
        window.location.href = '/login?message=session_expired';
      }
    }
    
    // Notification d'erreur stylée
    if (error.response?.status >= 500) {
      console.error('🚨 Erreur serveur:', error.response.data);
    }
    
    return Promise.reject(error);
  }
);

// Services API avec typage fort
export const authAPI = {
  login: (credentials: { email: string; password: string }) =>
    api.post<{ token: string; user: any }>('/login', credentials),
  
  logout: () => api.post('/logout'),
  
  getProfile: () => api.get('/me'),
};

export const productsAPI = {
  getAll: (params?: any) => api.get('/produits', { params }),
  getById: (id: number) => api.get(`/produits/${id}`),
  create: (data: any) => api.post('/produits', data),
  update: (id: number, data: any) => api.put(`/produits/${id}`, data),
  delete: (id: number) => api.delete(`/produits/${id}`),
  getAlerts: () => api.get('/produits/alerte-stock'),
  getStats: () => api.get('/produits/statistiques'),
};