export interface Boutique {
  id: number;
  nom: string;
  adresse?: string | null;
  telephone?: string | null;
  email?: string | null;
  proprietaire_id: number;
  created_at: string;
  updated_at: string;
  proprietaire?: User;
  users?: BoutiqueUser[];
  role_dans_boutique?: 'proprietaire' | 'gerant' | 'caissier' | null;
}

export interface BoutiqueUser {
  boutique_id: number;
  user_id: number;
  role_dans_boutique: 'proprietaire' | 'gerant' | 'caissier';
  created_at: string;
  updated_at: string;
  boutique?: Boutique;
  user?: User;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'proprietaire' | 'gerant' | 'caissier';
  role_courant?: 'proprietaire' | 'gerant' | 'caissier' | null;
  telephone?: string | null;
  derniere_connexion?: string;
  est_actif?: boolean;
  two_factor_enabled?: boolean;
  current_boutique_id?: number | null;
  boutiques?: Boutique[];
  current_boutique?: Boutique | null;
}

export interface Categorie {
  id: number;
  nom: string;
  description: string;
  couleur: string;
  icone: string;
  produits_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Produit {
  id: number;
  nom: string;
  description: string;
  prix: number;
  quantite_stock: number;
  seuil_alerte: number;
  categorie_id: number;
  est_perissable: boolean;
  code_qr?: string;
  unite_mesure: string;
  image_url?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  categorie?: Categorie;
  statut_stock?: 'normal' | 'alerte' | 'rupture';
}

export interface LigneVente {
  id: number;
  vente_id: number;
  produit_id: number;
  quantite: number;
  prix_unitaire: number;
  sous_total: number;
  created_at: string;
  updated_at: string;
  produit?: Produit;
}

export interface Vente {
  id: number;
  numero_vente: string;
  montant_total: number;
  tva: number;
  remise: number;
  user_id: number;
  statut: 'en_cours' | 'termine' | 'annule';
  notes?: string;
  client_id?: number | null;
  mode_paiement?: 'especes' | 'mtn' | 'moov' | 'carte' | null;
  montant_recu?: number | null;
  monnaie_rendue?: number | null;
  numero_transaction?: string | null;
  reference_carte?: string | null;
  banque?: string | null;
  created_at: string;
  updated_at: string;
  user?: User;
  client?: { id: number; nom: string; email?: string };
  ligne_ventes?: LigneVente[];
}

export interface BoutiqueSettingsApi {
  id?: number;
  nom: string;
  adresse?: string | null;
  telephone?: string | null;
  email?: string | null;
  devise: string;
  taux_tva: number;
  delai_annulation_vente_minutes: number;
}

export interface MouvementStock {
  id: number;
  produit_id: number;
  quantite: number;
  raison: 'arrivage' | 'vente' | 'ajustement' | 'retour' | 'casse';
  type: 'entrée' | 'sortie';
  reference_bon?: string | null;
  user_id: number;
  statut: 'en_attente' | 'accepté' | 'rejeté';
  notes?: string | null;
  quantite_avant?: number;
  quantite_apres?: number;
  produit?: Produit;
  user?: User;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsData {
  ventes: {
    total_ventes: number;
    chiffre_affaires_total: number;
    panier_moyen: number;
  };
  produits: {
    total_produits: number;
    total_stock: number;
    valeur_stock_total: number;
    produits_en_alerte: number;
    produits_en_rupture: number;
  };
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  status: 'success' | 'error';
}