# 📖 SGCI Bénin — Documentation API

> **Version 2.0** | Mai 2026 | API v1.2

---

## Table des matières

- [Généralités](#généralités)
- [Authentification](#authentification)
- [Produits](#produits)
- [Catégories](#catégories)
- [Ventes](#ventes)
- [Clients](#clients)
- [Stock & Mouvements](#stock--mouvements)
- [Analytics](#analytics)
- [Prédictions IA](#prédictions-ia)
- [Notifications](#notifications)
- [FCM Push](#fcm-push)
- [Utilisateurs](#utilisateurs)
- [Boutique](#boutique)
- [Codes d'erreur](#codes-erreur)

---

## Généralités

### Base URL
```
Production: https://api.sgci.bj/api
Staging: https://staging-api.sgci.bj/api
Local: http://127.0.0.1:8000/api
```

### Authentification
Toutes les routes protégées nécessitent un token Bearer dans le header:
```
Authorization: Bearer {token}
```

### Format de réponse
```json
{
  "data": { ... },
  "message": "Success message",
  "status": 200
}
```

### Pagination
```
GET /resource?page=1&per_page=20
```

---

## Authentification

### POST /login
Connexion utilisateur.

**Rate limit**: 10 requêtes par minute

**Request Body:**
```json
{
  "email": "gerant@sgci.bj",
  "password": "password"
}
```

**Response (200):**
```json
{
  "token": "1|abc123xyz...",
  "user": {
    "id": 1,
    "name": "Jean Dupont",
    "email": "gerant@sgci.bj",
    "role": "gerant",
    "is_active": true
  },
  "expires_at": "2026-05-27T10:00:00Z"
}
```

**Errors:**
- `401`: Identifiants invalides
- `429`: Trop de tentatives

---

### POST /logout ⚠️
Déconnexion utilisateur.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "message": "Déconnexion réussie"
}
```

---

### POST /refresh ⚠️
Rafraîchissement du token.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "token": "1|newtoken...",
  "expires_at": "2026-05-27T10:00:00Z"
}
```

---

### GET /me ⚠️
Informations utilisateur connecté.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "id": 1,
  "name": "Jean Dupont",
  "email": "gerant@sgci.bj",
  "role": "gerant",
  "is_active": true,
  "created_at": "2026-01-01T00:00:00Z"
}
```

---

### PUT /me/profile ⚠️
Mise à jour profil utilisateur.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "name": "Jean Dupont",
  "email": "jean.dupont@sgci.bj"
}
```

**Response (200):**
```json
{
  "message": "Profil mis à jour",
  "user": { ... }
}
```

---

### PUT /me/password ⚠️
Changement mot de passe.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "current_password": "oldpassword",
  "password": "newpassword",
  "password_confirmation": "newpassword"
}
```

**Response (200):**
```json
{
  "message": "Mot de passe changé"
}
```

**Errors:**
- `422`: Validation failed
- `401`: Current password incorrect

---

## Produits

### GET /produits ⚠️
Liste des produits (paginée).

**Headers:** `Authorization: Bearer {token}`

**Query Params:**
- `page`: Page number (default: 1)
- `per_page`: Items per page (default: 20)
- `search`: Recherche par nom
- `categorie_id`: Filtrer par catégorie
- `en_alerte`: Produits en alerte stock (true/false)

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "nom": "Riz local 5kg",
      "description": "Riz de qualité supérieure",
      "prix": 5000.00,
      "stock": 45,
      "seuil_alerte": 10,
      "categorie_id": 1,
      "perissable": false,
      "code_barres": "1234567890123",
      "image_url": "https://...",
      "statut_stock": "normal",
      "created_at": "2026-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "current_page": 1,
    "per_page": 20,
    "total": 150
  }
}
```

---

### POST /produits ⚠️
Création produit (gérant uniquement).

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "nom": "Riz local 5kg",
  "description": "Riz de qualité supérieure",
  "prix": 5000.00,
  "stock": 50,
  "seuil_alerte": 10,
  "categorie_id": 1,
  "perissable": false,
  "code_barres": "1234567890123"
}
```

**Response (201):**
```json
{
  "message": "Produit créé",
  "produit": { ... }
}
```

**Errors:**
- `403`: Non autorisé (caissier)
- `422`: Validation failed

---

### GET /produits/{id} ⚠️
Détails d'un produit.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "id": 1,
  "nom": "Riz local 5kg",
  "description": "Riz de qualité supérieure",
  "prix": 5000.00,
  "stock": 45,
  "seuil_alerte": 10,
  "categorie": {
    "id": 1,
    "nom": "Alimentation"
  },
  "statut_stock": "normal",
  "created_at": "2026-01-01T00:00:00Z"
}
```

**Errors:**
- `404`: Produit non trouvé

---

### PUT /produits/{id} ⚠️
Mise à jour produit (gérant uniquement).

**Headers:** `Authorization: Bearer {token}`

**Request Body:** (Même que création)

**Response (200):**
```json
{
  "message": "Produit mis à jour",
  "produit": { ... }
}
```

---

### DELETE /produits/{id} ⚠️
Suppression produit (gérant uniquement).

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "message": "Produit supprimé"
}
```

**Errors:**
- `403`: Non autorisé (caissier)

---

### GET /produits/alerte-stock ⚠️
Produits en alerte stock.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "data": [
    {
      "id": 5,
      "nom": "Huile de palme 1L",
      "stock": 5,
      "seuil_alerte": 10,
      "statut_stock": "alerte"
    }
  ]
}
```

---

### GET /produits/statistiques ⚠️
Statistiques globales produits.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "total_produits": 150,
  "en_alerte": 12,
  "en_rupture": 3,
  "perissables": 45,
  "valeur_stock_totale": 2500000.00
}
```

---

### GET /produits/search/{search} ⚠️
Recherche produits par nom.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "data": [ ... ]
}
```

---

### GET /produits/code/{code} ⚠️
Recherche produit par code-barres.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "id": 1,
  "nom": "Riz local 5kg",
  "code_barres": "1234567890123",
  "prix": 5000.00,
  "stock": 45
}
```

**Errors:**
- `404`: Code-barres non trouvé

---

### POST /produits/{id}/image ⚠️
Upload image produit.

**Headers:** `Authorization: Bearer {token}`

**Request:** `multipart/form-data`
- `image`: Fichier image (max 2MB)

**Response (200):**
```json
{
  "message": "Image uploadée",
  "image_url": "https://..."
}
```

---

## Catégories

### GET /categories ⚠️
Liste des catégories.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "nom": "Alimentation",
      "description": "Produits alimentaires",
      "created_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

### POST /categories ⚠️
Création catégorie (gérant uniquement).

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "nom": "Électronique",
  "description": "Produits électroniques"
}
```

**Response (201):**
```json
{
  "message": "Catégorie créée",
  "categorie": { ... }
}
```

---

### GET /categories/{id} ⚠️
Détails catégorie.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "id": 1,
  "nom": "Alimentation",
  "description": "Produits alimentaires",
  "produits_count": 45
}
```

---

### PUT /categories/{id} ⚠️
Mise à jour catégorie (gérant uniquement).

**Headers:** `Authorization: Bearer {token}`

**Request Body:** (Même que création)

**Response (200):**
```json
{
  "message": "Catégorie mise à jour",
  "categorie": { ... }
}
```

---

### DELETE /categories/{id} ⚠️
Suppression catégorie (gérant uniquement).

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "message": "Catégorie supprimée"
}
```

---

### GET /categories/{id}/produits ⚠️
Produits d'une catégorie.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "data": [ ... ]
}
```

---

### GET /categories/statistiques/overview ⚠️
Statistiques catégories.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "total_categories": 8,
  "top_categories": [
    {
      "nom": "Alimentation",
      "produits_count": 45,
      "ventes_count": 234
    }
  ]
}
```

---

## Ventes

### GET /ventes ⚠️
Liste des ventes (paginée).

**Headers:** `Authorization: Bearer {token}`

**Query Params:**
- `page`: Page number
- `per_page`: Items per page
- `statut`: filtre par statut (en_cours, terminee, annulee)
- `date_from`: Date début (YYYY-MM-DD)
- `date_to`: Date fin (YYYY-MM-DD)

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "numero": "VTE-2026-0001",
      "total": 15000.00,
      "tva": 0,
      "remise": 0,
      "statut": "terminee",
      "mode_paiement": "especes",
      "user": {
        "id": 2,
        "name": "Marie Kouassi"
      },
      "client": null,
      "lignes": [
        {
          "id": 1,
          "produit": {
            "nom": "Riz local 5kg"
          },
          "quantite": 3,
          "prix_unitaire": 5000.00,
          "sous_total": 15000.00
        }
      ],
      "created_at": "2026-05-26T10:30:00Z"
    }
  ],
  "meta": { ... }
}
```

---

### POST /ventes ⚠️
Création vente (brouillon).

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "client_id": 1,
  "mode_paiement": "especes",
  "lignes": [
    {
      "produit_id": 1,
      "quantite": 3,
      "prix_unitaire": 5000.00
    }
  ]
}
```

**Response (201):**
```json
{
  "message": "Vente créée",
  "vente": {
    "id": 1,
    "numero": "VTE-2026-0001",
    "statut": "en_cours",
    "total": 15000.00,
    "lignes": [ ... ]
  }
}
```

---

### GET /ventes/{id} ⚠️
Détails d'une vente.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "id": 1,
  "numero": "VTE-2026-0001",
  "total": 15000.00,
  "statut": "terminee",
  "user": { ... },
  "client": { ... },
  "lignes": [ ... ],
  "created_at": "2026-05-26T10:30:00Z"
}
```

---

### PUT /ventes/{id} ⚠️
Mise à jour vente (brouillon uniquement).

**Headers:** `Authorization: Bearer {token}`

**Request Body:** (Même que création)

**Response (200):**
```json
{
  "message": "Vente mise à jour",
  "vente": { ... }
}
```

**Errors:**
- `422`: Vente déjà terminée

---

### POST /ventes/checkout ⚠️
Validation et finalisation vente.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "vente_id": 1,
  "mode_paiement": "especes",
  "montant_recu": 20000.00
}
```

**Response (200):**
```json
{
  "message": "Vente finalisée",
  "vente": {
    "id": 1,
    "statut": "terminee",
    "total": 15000.00,
    "monnaie": 5000.00
  }
}
```

---

### POST /ventes/{id}/terminer ⚠️
Terminer une vente (déclenche mise à jour stock).

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "message": "Vente terminée",
  "vente": { ... }
}
```

---

### POST /ventes/{id}/annuler ⚠️
Annulation vente (restaure stock).

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "message": "Vente annulée",
  "vente": { ... }
}
```

**Errors:**
- `422`: Délai d'annulation dépassé

---

### GET /ventes/{id}/facture ⚠️
Génération facture (JSON).

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "vente": { ... },
  "facture": {
    "numero": "FAC-2026-0001",
    "date": "2026-05-26",
    "total_ht": 15000.00,
    "tva": 0,
    "total_ttc": 15000.00
  }
}
```

---

### GET /ventes/{id}/facture/pdf ⚠️
Génération facture PDF.

**Headers:** `Authorization: Bearer {token}`

**Response (200):** `application/pdf`

---

### GET /ventes/{id}/facture/html ⚠️
Génération facture HTML.

**Headers:** `Authorization: Bearer {token}`

**Response (200):** `text/html`

---

### POST /ventes/sync-offline-batch ⚠️
Synchronisation batch ventes offline.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "sales": [
    {
      "numero": "VTE-OFFLINE-001",
      "total": 15000.00,
      "mode_paiement": "especes",
      "created_at": "2026-05-26T10:00:00Z",
      "lignes": [
        {
          "produit_id": 1,
          "quantite": 3,
          "prix_unitaire": 5000.00,
          "sous_total": 15000.00
        }
      ]
    }
  ]
}
```

**Response (200):**
```json
{
  "message": "Synchronisation terminée",
  "synced_count": 5,
  "failed_count": 0
}
```

---

### GET /ventes/aujourdhui/stats ⚠️
Statistiques ventes du jour.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "ca_jour": 250000.00,
  "nb_ventes": 45,
  "panier_moyen": 5555.56,
  "top_produit": "Riz local 5kg"
}
```

---

### GET /ventes/statistiques/general ⚠️
Statistiques générales ventes.

**Headers:** `Authorization: Bearer {token}`

**Query Params:**
- `periode`: 7days, 30days, 90days, 1year

**Response (200):**
```json
{
  "periode": "30days",
  "ca_total": 7500000.00,
  "nb_ventes": 1250,
  "evolution_ca": "+15.5%",
  "top_produits": [ ... ],
  "repartition_paiements": {
    "especes": 60,
    "mobile_money": 30,
    "carte": 10
  }
}
```

---

## Clients

### GET /clients ⚠️
Liste des clients (paginée).

**Headers:** `Authorization: Bearer {token}`

**Query Params:**
- `page`, `per_page`
- `search`: Recherche par nom/téléphone
- `is_vip`: Filtrer VIP

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "nom": "Koffi Amégnon",
      "telephone": "+229 97 00 00 00",
      "email": "koffi@example.com",
      "adresse": "Cotonou",
      "is_vip": true,
      "total_achats": 250000.00,
      "nombre_commandes": 15,
      "created_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

### POST /clients ⚠️
Création client.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "nom": "Koffi Amégnon",
  "telephone": "+229 97 00 00 00",
  "email": "koffi@example.com",
  "adresse": "Cotonou"
}
```

**Response (201):**
```json
{
  "message": "Client créé",
  "client": { ... }
}
```

---

### GET /clients/{id} ⚠️
Détails client.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "id": 1,
  "nom": "Koffi Amégnon",
  "telephone": "+229 97 00 00 00",
  "email": "koffi@example.com",
  "adresse": "Cotonou",
  "is_vip": true,
  "total_achats": 250000.00,
  "nombre_commandes": 15,
  "derniere_commande": "2026-05-26T10:30:00Z"
}
```

---

### PUT /clients/{id} ⚠️
Mise à jour client.

**Headers:** `Authorization: Bearer {token}`

**Request Body:** (Même que création)

**Response (200):**
```json
{
  "message": "Client mis à jour",
  "client": { ... }
}
```

---

### DELETE /clients/{id} ⚠️
Suppression client (gérant uniquement).

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "message": "Client supprimé"
}
```

---

### POST /clients/{id}/promouvoir-vip ⚠️
Promouvoir client VIP (gérant uniquement).

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "message": "Client promu VIP",
  "client": { ... }
}
```

---

### POST /clients/{id}/retrograder-vip ⚠️
Rétrograder client VIP (gérant uniquement).

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "message": "Client rétrogradé",
  "client": { ... }
}
```

---

### GET /clients/{id}/commandes ⚠️
Historique commandes client.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "data": [ ... ]
}
```

---

### GET /clients/statistiques/globales ⚠️
Statistiques globales clients.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "total_clients": 150,
  "vip_count": 25,
  "total_ca_clients": 15000000.00,
  "panier_moyen": 100000.00
}
```

---

### GET /clients/export/data ⚠️
Export données clients (CSV/JSON).

**Headers:** `Authorization: Bearer {token}`

**Query Params:**
- `format`: csv, json

**Response (200):** File download

---

### GET /clients/search/advanced ⚠️
Recherche avancée clients.

**Headers:** `Authorization: Bearer {token}`

**Query Params:**
- `nom`: Nom partiel
- `telephone`: Téléphone partiel
- `email`: Email partiel
- `is_vip`: true/false
- `min_achats`: Montant minimum

**Response (200):**
```json
{
  "data": [ ... ]
}
```

---

## Stock & Mouvements

### GET /mouvements-stock ⚠️
Liste des mouvements de stock.

**Headers:** `Authorization: Bearer {token}`

**Query Params:**
- `type`: entree, sortie
- `statut`: en_attente, valide, rejete

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "type": "entree",
      "quantite": 100,
      "produit": {
        "nom": "Riz local 5kg"
      },
      "statut": "valide",
      "user": {
        "name": "Jean Dupont"
      },
      "created_at": "2026-05-26T10:00:00Z"
    }
  ]
}
```

---

### POST /mouvements-stock ⚠️
Création mouvement stock.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "type": "entree",
  "produit_id": 1,
  "quantite": 100,
  "motif": "Réapprovisionnement"
}
```

**Response (201):**
```json
{
  "message": "Mouvement créé",
  "mouvement": { ... }
}
```

---

### POST /mouvements-stock/{id}/valider ⚠️
Validation mouvement (gérant uniquement).

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "message": "Mouvement validé",
  "mouvement": { ... }
}
```

---

### POST /mouvements-stock/{id}/rejeter ⚠️
Rejet mouvement (gérant uniquement).

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "motif": "Quantité incorrecte"
}
```

**Response (200):**
```json
{
  "message": "Mouvement rejeté",
  "mouvement": { ... }
}
```

---

### GET /mouvements-stock/statistiques ⚠️
Statistiques mouvements.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "total_entrees": 5000,
  "total_sorties": 3200,
  "solde": 1800,
  "en_attente": 15
}
```

---

### GET /mouvements-stock/export ⚠️
Export mouvements (CSV/JSON).

**Headers:** `Authorization: Bearer {token}`

**Response (200):** File download

---

## Analytics

### GET /analytics/stats-globales ⚠️
Statistiques globales.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "ca_total": 7500000.00,
  "nb_ventes": 1250,
  "nb_clients": 150,
  "nb_produits": 150,
  "panier_moyen": 6000.00
}
```

---

### GET /analytics/ventes-quotidiennes ⚠️
Ventes quotidiennes (30 derniers jours).

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "data": [
    {
      "date": "2026-05-01",
      "ca": 250000.00,
      "nb_ventes": 45
    }
  ]
}
```

---

### GET /analytics/ventes-mensuelles ⚠️
Ventes mensuelles (12 derniers mois).

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "data": [
    {
      "mois": "2026-05",
      "ca": 7500000.00,
      "nb_ventes": 1250
    }
  ]
}
```

---

### GET /analytics/produits-populaires ⚠️
Top produits vendus.

**Headers:** `Authorization: Bearer {token}`

**Query Params:**
- `limit`: Nombre de résultats (default: 10)
- `periode`: 7days, 30days, 90days

**Response (200):**
```json
{
  "data": [
    {
      "produit": {
        "nom": "Riz local 5kg"
      },
      "quantite_vendue": 500,
      "ca": 2500000.00
    }
  ]
}
```

---

### GET /analytics/chiffre-affaires ⚠️
Chiffre d'affaires par période.

**Headers:** `Authorization: Bearer {token}`

**Query Params:**
- `periode`: 7days, 30days, 90days, 1year

**Response (200):**
```json
{
  "periode": "30days",
  "ca": 7500000.00,
  "evolution": "+15.5%",
  "prevision": 8500000.00
}
```

---

### GET /analytics/repartition-categories ⚠️
Répartition CA par catégorie.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "data": [
    {
      "categorie": "Alimentation",
      "ca": 4500000.00,
      "pourcentage": 60
    }
  ]
}
```

---

### GET /analytics/export ⚠️
Export analytics (JSON/PDF/Excel).

**Headers:** `Authorization: Bearer {token}`

**Query Params:**
- `format`: json, pdf, xlsx
- `type`: ventes, produits, clients

**Response (200):** File download

---

### GET /analytics/alertes-stock ⚠️
Alertes stock actives.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "data": [
    {
      "produit": {
        "nom": "Huile de palme 1L"
      },
      "stock_actuel": 5,
      "seuil_alerte": 10,
      "urgence": "haute"
    }
  ]
}
```

---

## Prédictions IA

### GET /predictions/demande ⚠️
Prévisions de demande produits.

**Headers:** `Authorization: Bearer {token}`

**Query Params:**
- `periode`: 7days, 30days, 90days
- `produit_id`: Filtrer par produit

**Response (200):**
```json
{
  "data": [
    {
      "produit": {
        "nom": "Riz local 5kg"
      },
      "predicted_demand": 50,
      "confidence": 85.5,
      "trend": "hausse",
      "periode": "7days"
    }
  ]
}
```

---

### POST /predictions/valider ⚠️
Validation manuelle prédictions.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "prediction_ids": [1, 2, 3]
}
```

**Response (200):**
```json
{
  "message": "Prédictions validées",
  "validated_count": 3
}
```

---

### GET /predictions/metrics-performance ⚠️
Métriques performance IA.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "mae": 5.2,
  "rmse": 7.8,
  "mape": 12.5,
  "accuracy": 87.5,
  "total_predictions": 500
}
```

---

### GET /predictions/recommandations-promotions ⚠️
Recommandations promotions.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "data": [
    {
      "produit": {
        "nom": "Riz local 5kg"
      },
      "remise_recommandee": 10,
      "raison": "Stock élevé, demande faible"
    }
  ]
}
```

---

### GET /predictions/reapprovisionnement ⚠️
Recommandations réapprovisionnement.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "data": [
    {
      "produit": {
        "nom": "Huile de palme 1L"
      },
      "stock_actuel": 5,
      "predicted_demand": 30,
      "stock_recommande": 65,
      "quantite_a_commander": 60,
      "urgence": "haute"
    }
  ]
}
```

---

### POST /predictions/cross-selling ⚠️
Cross-selling (Market Basket Analysis).

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "produit_id": 1
}
```

**Response (200):**
```json
{
  "data": [
    {
      "produit": {
        "nom": "Huile de palme 1L"
      },
      "cooccurrence_count": 45,
      "confidence": 35.5
    }
  ]
}
```

---

## Notifications

### GET /notifications ⚠️
Liste notifications utilisateur.

**Headers:** `Authorization: Bearer {token}`

**Query Params:**
- `page`, `per_page`
- `unread`: true/false

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "titre": "Alerte Stock",
      "message": "Le produit Riz est en alerte",
      "type": "stock_alert",
      "is_read": false,
      "created_at": "2026-05-26T10:00:00Z"
    }
  ]
}
```

---

### GET /notifications/unread-count ⚠️
Nombre notifications non lues.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "count": 5
}
```

---

### POST /notifications/{id}/read ⚠️
Marquer notification comme lue.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "message": "Notification marquée comme lue"
}
```

---

### POST /notifications/mark-all-read ⚠️
Marquer toutes comme lues.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "message": "Toutes les notifications marquées comme lues"
}
```

---

### POST /notifications/sync-stock-alerts ⚠️
Synchroniser alertes stock (gérant uniquement).

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "message": "Alertes stock synchronisées",
  "alerts_created": 12
}
```

---

## FCM Push

### POST /fcm/register ⚠️
Enregistrement token FCM.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "token": "fcm_token_string",
  "device_name": "iPhone 14",
  "platform": "ios"
}
```

**Response (200):**
```json
{
  "message": "Token enregistré"
}
```

---

### POST /fcm/unregister ⚠️
Désenregistrement token FCM.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "token": "fcm_token_string"
}
```

**Response (200):**
```json
{
  "message": "Token désenregistré"
}
```

---

### GET /fcm/my-tokens ⚠️
Liste tokens utilisateur.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "token": "fcm_token_string",
      "device_name": "iPhone 14",
      "platform": "ios",
      "is_active": true,
      "last_used_at": "2026-05-26T10:00:00Z"
    }
  ]
}
```

---

### POST /fcm/test ⚠️
Test notification push.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "title": "Test Notification",
  "body": "Ceci est un test"
}
```

**Response (200):**
```json
{
  "message": "Notification envoyée"
}
```

---

## Utilisateurs

### GET /users ⚠️
Liste utilisateurs (gérant uniquement).

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Jean Dupont",
      "email": "gerant@sgci.bj",
      "role": "gerant",
      "is_active": true,
      "created_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

### POST /users ⚠️
Création utilisateur (gérant uniquement).

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "name": "Marie Kouassi",
  "email": "marie@sgci.bj",
  "password": "password",
  "role": "caissier"
}
```

**Response (201):**
```json
{
  "message": "Utilisateur créé",
  "user": { ... }
}
```

---

### PUT /users/{id} ⚠️
Mise à jour utilisateur (gérant uniquement).

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "name": "Marie Kouassi",
  "email": "marie.kouassi@sgci.bj",
  "is_active": true
}
```

**Response (200):**
```json
{
  "message": "Utilisateur mis à jour",
  "user": { ... }
}
```

---

### DELETE /users/{id} ⚠️
Suppression utilisateur (gérant uniquement).

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "message": "Utilisateur supprimé"
}
```

---

### GET /users/caissiers ⚠️
Liste caissiers actifs.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "data": [ ... ]
}
```

---

## Boutique

### GET /boutique/settings ⚠️
Paramètres boutique.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "nom": "SGCI Boutique",
  "adresse": "Cotonou",
  "telephone": "+229 XX XX XX XX",
  "devise": "XOF",
  "tva": 0,
  "delai_annulation": 30,
  "stock_alerts_enabled": true
}
```

---

### PUT /boutique/settings ⚠️
Mise à jour paramètres (gérant uniquement).

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "nom": "SGCI Boutique",
  "adresse": "Cotonou",
  "devise": "XOF",
  "tva": 18,
  "delai_annulation": 60
}
```

**Response (200):**
```json
{
  "message": "Paramètres mis à jour",
  "settings": { ... }
}
```

---

## Codes d'erreur

### Codes HTTP standards
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `422`: Validation Error
- `429`: Too Many Requests
- `500`: Internal Server Error

### Format erreur
```json
{
  "message": "Error message",
  "errors": {
    "field": ["Error detail"]
  }
}
```

### Erreurs spécifiques
- `TOKEN_EXPIRED`: Token expiré
- `INVALID_CREDENTIALS`: Identifiants invalides
- `INSUFFICIENT_STOCK`: Stock insuffisant
- `SALE_ALREADY_FINALIZED`: Vente déjà finalisée
- `CANCELLATION_DELAY_EXCEEDED`: Délai annulation dépassé

---

## Health Check

### GET /health
Vérification santé API (publique).

**Response (200):**
```json
{
  "status": "OK",
  "service": "SGCI Bénin API",
  "version": "1.2.0",
  "timestamp": "2026-05-26T10:00:00Z"
}
```

---

## Rate Limiting

- `/login`: 10 requêtes/minute
- Routes authentifiées: 60 requêtes/minute
- Routes publiques: 100 requêtes/minute

Headers de rate limit:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1648473600
```

---

**Documentation API complète SGCI Bénin v2.0**
