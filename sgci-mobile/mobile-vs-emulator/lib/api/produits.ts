import { apiFetch } from '../api-client';
import { ApiResponse, Produit } from '@/types';

export const produitsApi = {
  async getAll(): Promise<ApiResponse<Produit[]>> {
    try {
      const response = await apiFetch('/produits');
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },

  async getById(id: number): Promise<ApiResponse<Produit>> {
    try {
      const response = await apiFetch(`/produits/${id}`);
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },

  async create(produit: Partial<Produit>): Promise<ApiResponse<Produit>> {
    try {
      const response = await apiFetch('/produits', {
        method: 'POST',
        body: JSON.stringify(produit),
      });
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },

  async update(id: number, produit: Partial<Produit>): Promise<ApiResponse<Produit>> {
    try {
      const response = await apiFetch(`/produits/${id}`, {
        method: 'PUT',
        body: JSON.stringify(produit),
      });
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },

  async search(query: string): Promise<ApiResponse<Produit[]>> {
    try {
      const response = await apiFetch(`/produits/search/${encodeURIComponent(query)}`);
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },

  async findByCode(code: string): Promise<ApiResponse<Produit>> {
    try {
      const response = await apiFetch(`/produits/code/${encodeURIComponent(code)}`);
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },

  async getAlerteStock(): Promise<ApiResponse<Produit[]>> {
    try {
      const response = await apiFetch('/produits/alerte-stock');
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },
};
