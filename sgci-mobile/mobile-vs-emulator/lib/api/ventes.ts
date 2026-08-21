import { apiFetch } from '../api-client';
import { ApiResponse, Vente, LigneVente } from '@/types';

export const ventesApi = {
  async getAll(): Promise<ApiResponse<Vente[]>> {
    try {
      const response = await apiFetch('/ventes');
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },

  async getById(id: number): Promise<ApiResponse<Vente>> {
    try {
      const response = await apiFetch(`/ventes/${id}`);
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },

  async create(vente: Partial<Vente>): Promise<ApiResponse<Vente>> {
    try {
      const response = await apiFetch('/ventes', {
        method: 'POST',
        body: JSON.stringify(vente),
      });
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },

  async checkout(venteData: { ligne_ventes: Partial<LigneVente>[]; client_id?: number; mode_paiement: string; montant_recu?: number }): Promise<ApiResponse<Vente>> {
    try {
      const response = await apiFetch('/ventes/checkout', {
        method: 'POST',
        body: JSON.stringify(venteData),
      });
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },

  async terminer(id: number): Promise<ApiResponse<Vente>> {
    try {
      const response = await apiFetch(`/ventes/${id}/terminer`, {
        method: 'POST',
      });
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },

  async annuler(id: number): Promise<ApiResponse<Vente>> {
    try {
      const response = await apiFetch(`/ventes/${id}/annuler`, {
        method: 'POST',
      });
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },

  async getStatsAujourdhui(): Promise<ApiResponse<any>> {
    try {
      const response = await apiFetch('/ventes/aujourdhui/stats');
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },

  async syncOfflineBatch(ventes: any[]): Promise<ApiResponse<any>> {
    try {
      const response = await apiFetch('/ventes/sync-offline-batch', {
        method: 'POST',
        body: JSON.stringify({ ventes }),
      });
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },
};
