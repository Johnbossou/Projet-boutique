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
  date_peremption?: string | null;
  date_fabrication?: string | null;
  lot_numero?: string | null;
  duree_conservation_jours?: number | null;
  code_qr?: string;
  unite_mesure: string;
  image_url?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  categorie?: Categorie;
  statut_stock?: 'normal' | 'alerte' | 'rupture';
  jours_restants?: number | null;
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
  type: 'entree' | 'sortie';
  reference_bon?: string | null;
  user_id: number;
  statut: 'en_attente' | 'accepte' | 'rejete';
  notes?: string | null;
  quantite_avant?: number;
  quantite_apres?: number;
  produit?: Produit;
  user?: User;
  created_at: string;
  updated_at: string;
}

export interface Fournisseur {
  id: number;
  nom: string;
  email?: string | null;
  telephone?: string | null;
  adresse?: string | null;
  ville?: string | null;
  pays?: string | null;
  conditions_paiement?: string | null;
  notes?: string | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface LigneCommandeFournisseur {
  id: number;
  commande_fournisseur_id: number;
  produit_id: number;
  quantite_commandee: number;
  quantite_recue: number;
  prix_unitaire: number;
  montant_total: number;
  statut: string;
  produit?: Produit;
  quantite_restante?: number;
}

export interface CommandeFournisseur {
  id: number;
  numero_commande: string;
  fournisseur_id: number;
  boutique_id: number;
  user_id: number;
  date_commande: string;
  date_livraison_prevue?: string | null;
  date_livraison_reelle?: string | null;
  statut: 'en_attente' | 'en_cours' | 'livre' | 'annule';
  montant_total: number;
  montant_paye: number;
  conditions_paiement?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  fournisseur?: Fournisseur;
  user?: { id: number; name: string };
  lignes: LigneCommandeFournisseur[];
}

export interface ReceptionLigne {
  ligne_id: number;
  produit_id: number;
  quantite_recue: number;
  quantite_restante: number;
  mouvement_id: number;
  stock_apres: number;
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

export interface PeremptionResult {
  proches_peremption: Produit[];
  perimes: Produit[];
}

export interface TransfertStock {
  id: number;
  numero_transfert: string;
  boutique_source_id: number;
  boutique_destination_id: number;
  produit_id: number;
  quantite: number;
  statut: 'en_attente' | 'en_cours' | 'termine' | 'annule';
  date_transfert: string;
  date_reception?: string | null;
  motif?: string | null;
  notes?: string | null;
  user_source_id?: number | null;
  user_destination_id?: number | null;
  created_at: string;
  updated_at: string;
  boutiqueSource?: Boutique;
  boutiqueDestination?: Boutique;
  produit?: Produit;
  userSource?: User;
  userDestination?: User;
}

export interface StatistiquesTransferts {
  total_transferts: number;
  transferts_en_attente: number;
  transferts_en_cours: number;
  transferts_termines: number;
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