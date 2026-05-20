import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Alert } from "react-native";
import { API_BASE_URL } from "../../constants/api";

// Instance axios
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Application": "SGCI-Bénin-Mobile",
  },
});

// Interceptor pour le token
api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem("auth_token");
    const expiresAt = await AsyncStorage.getItem("token_expires_at");

    if (token && expiresAt && new Date() < new Date(expiresAt)) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      // Token expiré, nettoyage
      await AsyncStorage.multiRemove([
        "auth_token",
        "token_expires_at",
        "user_data",
      ]);
    }
  } catch (error) {
    console.error("Erreur interceptor:", error);
  }
  return config;
});

// Interceptor pour les erreurs
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.multiRemove([
        "auth_token",
        "token_expires_at",
        "user_data",
      ]);

      Alert.alert(
        "Session expirée",
        "Votre session a expiré. Veuillez vous reconnecter.",
        [{ text: "OK" }]
      );
    }

    if (error.response?.status >= 500) {
      Alert.alert("Erreur serveur", "Une erreur est survenue sur le serveur");
    }

    return Promise.reject(error);
  }
);

// Services API spécifiques (basés sur tes routes)
export const authAPI = {
  login: (credentials) => api.post("/login", credentials),
  logout: () => api.post("/logout"),
  getProfile: () => api.get("/me"),
  test: () => api.get("/test"),
};

export const productsAPI = {
  getAll: (params) => api.get("/produits", { params }),
  getById: (id) => api.get(`/produits/${id}`),
  create: (data) => api.post("/produits", data),
  update: (id, data) => api.put(`/produits/${id}`, data),
  delete: (id) => api.delete(`/produits/${id}`),
  getAlerts: () => api.get("/produits/alerte-stock"),
  getStats: () => api.get("/produits/statistiques"),
  search: (searchTerm) => api.get(`/produits/search/${searchTerm}`),
};

export const salesAPI = {
  getAll: () => api.get("/ventes"),
  create: (data) => api.post("/ventes", data),
  checkout: (data) => api.post("/ventes/checkout", data),
  complete: (id) => api.post(`/ventes/${id}/terminer`),
  cancel: (id) => api.post(`/ventes/${id}/annuler`),
  getTodayStats: () => api.get("/ventes/aujourdhui/stats"),
  getGeneralStats: () => api.get("/ventes/statistiques/general"),
  getInvoice: (id) => api.get(`/ventes/${id}/facture`),
};

export const clientsAPI = {
  getAll: () => api.get("/clients"),
  create: (data) => api.post("/clients", data),
  getStats: () => api.get("/clients/statistiques/globales"),
  promoteToVIP: (id) => api.post(`/clients/${id}/promouvoir-vip`),
  getOrders: (id) => api.get(`/clients/${id}/commandes`),
  search: (params) => api.get("/clients/search/advanced", { params }),
};

export default api;
