export interface User {
  id: number;
  name: string;
  email: string;
  role: 'gerant' | 'caissier';
  telephone?: string | null;
  derniere_connexion?: string;
  est_actif: boolean;
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
  created_at: string;
  updated_at: string;
  user?: User;
  ligne_ventes?: LigneVente[];
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