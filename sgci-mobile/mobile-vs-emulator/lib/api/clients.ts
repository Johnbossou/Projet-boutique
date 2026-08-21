import { apiFetch } from '../api-client';
import { ApiResponse, Client } from '@/types';

export const clientsApi = {
  async getAll(): Promise<ApiResponse<Client[]>> {
    try {
      const response = await apiFetch('/clients');
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },

  async getById(id: number): Promise<ApiResponse<Client>> {
    try {
      const response = await apiFetch(`/clients/${id}`);
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },

  async create(client: Partial<Client>): Promise<ApiResponse<Client>> {
    try {
      const response = await apiFetch('/clients', {
        method: 'POST',
        body: JSON.stringify(client),
      });
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },

  async update(id: number, client: Partial<Client>): Promise<ApiResponse<Client>> {
    try {
      const response = await apiFetch(`/clients/${id}`, {
        method: 'PUT',
        body: JSON.stringify(client),
      });
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },

  async search(query: string): Promise<ApiResponse<Client[]>> {
    try {
      const response = await apiFetch('/clients/search/advanced', {
        method: 'POST',
        body: JSON.stringify({ query }),
      });
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },

  async getStatistiques(): Promise<ApiResponse<any>> {
    try {
      const response = await apiFetch('/clients/statistiques/globales');
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },

  async promouvoirVip(id: number): Promise<ApiResponse<Client>> {
    try {
      const response = await apiFetch(`/clients/${id}/promouvoir-vip`, {
        method: 'POST',
      });
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },
};
