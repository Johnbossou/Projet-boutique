export interface Boutique {
  id: number;
  nom: string;
  adresse?: string | null;
  telephone?: string | null;
  email?: string | null;
  devise?: string;
  taux_tva?: number;
  delai_annulation_vente_minutes?: number;
  proprietaire_id: number;
  created_at: string;
  updated_at: string;
  proprietaire?: User;
  users?: BoutiqueUser[];
}

export interface BoutiqueUser {
  boutique_id: number;
  user_id: number;
  role_dans_boutique: 'gerant' | 'caissier';
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
  telephone?: string | null;
  derniere_connexion?: string;
  est_actif?: boolean;
  two_factor_enabled?: boolean;
  current_boutique_id?: number | null;
  boutiques?: Boutique[];
  current_boutique?: Boutique | null;
  email_verified_at?: string;
}

export interface Produit {
  id: number;
  nom: string;
  description?: string | null;
  prix: number;
  quantite_stock: number;
  seuil_alerte: number;
  categorie_id?: number | null;
  est_perissable: boolean;
  code_qr?: string | null;
  unite_mesure?: string | null;
  image_url?: string | null;
  boutique_id: number;
  categorie?: Categorie;
  created_at: string;
  updated_at: string;
}

export interface Categorie {
  id: number;
  nom: string;
  description?: string | null;
  parent_id?: number | null;
  boutique_id: number;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: number;
  nom: string;
  email?: string | null;
  telephone?: string | null;
  adresse?: string | null;
  ville?: string | null;
  statut: 'actif' | 'vip' | 'inactif';
  notes?: string | null;
  total_achats: number;
  nombre_commandes: number;
  derniere_commande?: string | null;
  boutique_id: number;
  created_at: string;
  updated_at: string;
}

export interface Vente {
  id: number;
  numero_vente: string;
  montant_total: number;
  tva: number;
  remise: number;
  user_id: number;
  client_id?: number | null;
  statut: 'en_cours' | 'termine' | 'annule';
  notes?: string | null;
  mode_paiement: 'especes' | 'mobile_money' | 'carte';
  montant_recu?: number | null;
  monnaie_rendue?: number | null;
  numero_transaction?: string | null;
  reference_carte?: string | null;
  banque?: string | null;
  boutique_id: number;
  ligne_ventes?: LigneVente[];
  client?: Client;
  user?: User;
  created_at: string;
  updated_at: string;
}

export interface LigneVente {
  id: number;
  vente_id: number;
  produit_id: number;
  quantite: number;
  prix_unitaire: number;
  sous_total: number;
  produit?: Produit;
  created_at: string;
  updated_at: string;
}

export interface MouvementStock {
  id: number;
  produit_id: number;
  type: 'entree' | 'sortie' | 'ajustement';
  quantite: number;
  raison?: string | null;
  statut: 'en_attente' | 'valide' | 'rejete';
  user_id: number;
  boutique_id: number;
  produit?: Produit;
  user?: User;
  created_at: string;
  updated_at: string;
}

export interface AiPrediction {
  id: number;
  produit_id: number;
  date_prediction: string;
  quantite_predite: number;
  quantite_reelle?: number | null;
  erreur?: number | null;
  est_valide: boolean;
  boutique_id: number;
  produit?: Produit;
  created_at: string;
  updated_at: string;
}

export interface AppNotification {
  id: number;
  user_id: number;
  titre: string;
  message: string;
  type: 'stock_alert' | 'new_sale' | 'arrival_validated' | 'prediction_alert';
  est_lu: boolean;
  data?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}
