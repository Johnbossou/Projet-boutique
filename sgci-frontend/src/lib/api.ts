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

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Gestion avancée des erreurs
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token && !error.config?.headers?.['X-Retry-After-Refresh']) {
        try {
          const refreshRes = await fetch(`${API_BASE_URL}/refresh`, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });
          if (refreshRes.ok) {
            const data = await refreshRes.json();
            if (data.token) localStorage.setItem('auth_token', data.token);
            if (data.expires_at) localStorage.setItem('token_expires_at', data.expires_at);
            error.config.headers.Authorization = `Bearer ${data.token}`;
            error.config.headers['X-Retry-After-Refresh'] = '1';
            return api.request(error.config);
          }
        } catch {
          /* ignore */
        }
      }
      localStorage.removeItem('auth_token');
      localStorage.removeItem('token_expires_at');
      localStorage.removeItem('user_data');
      window.location.href = '/login?message=session_expired';
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