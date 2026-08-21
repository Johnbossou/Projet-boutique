import { apiFetch } from '../api-client';
import { ApiResponse } from '@/types';

export const analyticsApi = {
  async getStatsGlobales(): Promise<ApiResponse<any>> {
    try {
      const response = await apiFetch('/analytics/stats-globales');
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },

  async getVentesQuotidiennes(jours: number = 7): Promise<ApiResponse<any>> {
    try {
      const response = await apiFetch(`/analytics/ventes-quotidiennes?jours=${jours}`);
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },

  async getVentesMensuelles(mois: number = 6): Promise<ApiResponse<any>> {
    try {
      const response = await apiFetch(`/analytics/ventes-mensuelles?mois=${mois}`);
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },

  async getProduitsPopulaires(limit: number = 10): Promise<ApiResponse<any>> {
    try {
      const response = await apiFetch(`/analytics/produits-populaires?limit=${limit}`);
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },

  async getChiffreAffaires(periode: string = 'mois'): Promise<ApiResponse<any>> {
    try {
      const response = await apiFetch(`/analytics/chiffre-affaires?periode=${periode}`);
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },

  async getRepartitionCategories(): Promise<ApiResponse<any>> {
    try {
      const response = await apiFetch('/analytics/repartition-categories');
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },

  async getAlertesStock(): Promise<ApiResponse<any>> {
    try {
      const response = await apiFetch('/analytics/alertes-stock');
      const data = await response.json();
      return { success: response.ok, data: response.ok ? data : undefined, error: response.ok ? undefined : data.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur réseau' };
    }
  },
};
