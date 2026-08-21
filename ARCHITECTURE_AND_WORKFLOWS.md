# 🏗️ SGCI Bénin — Architecture et Workflows

> **Version 2.0** | Mai 2026

---

## Table des matières

1. [Architecture système](#architecture-système)
2. [Workflow Authentification](#workflow-authentification)
3. [Workflow Vente](#workflow-vente)
4. [Workflow Stock & Arrivage](#workflow-stock--arrivage)
5. [Workflow Prédictions IA](#workflow-prédictions-ia)
6. [Workflow Offline Sync](#workflow-offline-sync)
7. [Workflow Notifications](#workflow-notifications)
8. [Workflow Cross-selling](#workflow-cross-selling)
9. [Architecture de données](#architecture-de-données)
10. [Flux de communication](#flux-de-communication)

---

## Architecture système

### Vue d'ensemble

```
Frontend (Next.js) ←→ Mobile (Expo) ←→ Backend (Laravel) ←→ MySQL
                              ↓
                         Services (FCM, Email, SMS)
```

### Couches architecturales

1. **Presentation Layer**: Next.js (Web), Expo (Mobile)
2. **API Layer**: Laravel REST API
3. **Business Logic Layer**: Controllers, Services
4. **Data Access Layer**: Eloquent ORM
5. **Database Layer**: MySQL 8.0
6. **External Services**: FCM, Email, SMS

---

## Workflow Authentification

### Flux

1. **Login**: Client → `POST /login` → Backend → Database
2. **Validation**: Vérification email/password (bcrypt)
3. **Token**: Génération token Sanctum (24h)
4. **Storage**: Token stocké (localStorage/SecureStore)
5. **Refresh**: Auto-refresh avant expiration

### Séquence

```
Client → POST /login → Backend → Verify → Create Token → Response
Client → Store Token → API Requests (Bearer Token) → Auto Refresh
```

---

## Workflow Vente

### Étapes

1. **Création brouillon**: `POST /ventes` (statut: en_cours)
2. **Ajout lignes**: Produits, quantités, prix
3. **Checkout**: `POST /ventes/checkout`
4. **Validation stock**: Vérification disponibilité
5. **Finalisation**: `POST /ventes/{id}/terminer`
6. **Mise à jour stock**: Décrémentation automatique
7. **Facturation**: Génération PDF

### Séquence

```
Caissier → Créer vente → Ajouter produits → Checkout → 
Validate stock → Finaliser → Update stock → Générer facture
```

### Annulation

- Délai configurable (défaut: 30 min)
- `POST /ventes/{id}/annuler`
- Restauration automatique du stock

---

## Workflow Stock & Arrivage

### Mouvements de stock

1. **Entrée**: Réception marchandise
2. **Sortie**: Vente, perte, casse
3. **Validation**: Gérant valide arrivages
4. **Alertes**: Auto quand stock < seuil

### Arrivage

```
Caissier → Créer mouvement (entree) → Statut: en_attente →
Gérant → Valider → Update stock → Notification
```

### Scan QR/Barcode

- Scan code-barres produit
- Auto-remplissage formulaire
- Validation en temps réel

---

## Workflow Prédictions IA

### Génération prédictions

1. **Collecte données**: Ventes historiques (7/30/90 jours)
2. **Calcul**: Algorithme adaptatif (poids dynamiques)
3. **Stockage**: Table `ai_predictions`
4. **Validation**: Comparaison prédictions vs réalité
5. **Métriques**: MAE, RMSE, MAPE, Accuracy

### Scheduler

```php
// Quotidien 23h: Validation prédictions
$schedule->job(new ValidatePredictionsJob())->dailyAt('23:00');

// Hebdomadaire dimanche 22h: Génération prédictions
$schedule->call(fn() => app(PredictionsController::class)->genererPredictionsHebdomadaires())
    ->weekly()->sundaysAt('22:00');

// Quotidien 8h: Alertes prédictions
$schedule->job(new SendPredictionAlertsJob())->dailyAt('08:00');
```

### Algorithme adaptatif

```php
// Poids basés sur volatilité
if ($volatilite > 2) {
    $poidsRecent = 0.6; // Haute volatilité
    $poidsMoyen = 0.3;
} else {
    $poidsRecent = 0.4; // Faible volatilité
    $poidsMoyen = 0.5;
}

$prediction = ($ventesRecents * $poidsRecent) + 
              ($ventesMoyennes * $poidsMoyen) + 
              ($ventesMax * 0.1);
```

---

## Workflow Offline Sync

### Frontend (localStorage)

1. **Détection offline**: `navigator.onLine`
2. **Stockage local**: Ventes dans localStorage
3. **Queue locale**: File d'attente des ventes
4. **Sync automatique**: Dès retour en ligne

### Mobile (AsyncStorage)

1. **Stockage**: AsyncStorage pour ventes offline
2. **Batch sync**: `POST /ventes/sync-offline-batch`
3. **Conflict resolution**: Last-write-wins
4. **Retry automatique**: En cas d'échec

### Backend

```php
// Endpoint batch sync
POST /ventes/sync-offline-batch
{
  "sales": [
    {
      "numero": "VTE-OFFLINE-001",
      "total": 15000,
      "lignes": [...],
      "created_at": "2026-05-26T10:00:00Z"
    }
  ]
}
```

---

## Workflow Notifications

### Types de notifications

1. **In-app**: Cloche dans UI
2. **Push**: FCM (mobile/web)
3. **Email**: Alertes stock, rapports
4. **SMS**: Alertes urgentes

### Flux alertes stock

```
Scheduler (9h) → Check produits en alerte → 
SendStockAlertsJob → FCM + Email + SMS → Gérants
```

### Flux prédictions IA

```
Scheduler (8h) → Check prédictions critiques →
SendPredictionAlertsJob → FCM + Email → Gérants
```

---

## Workflow Cross-selling

### Market Basket Analysis

1. **Analyse ventes**: Produits achetés ensemble
2. **Calcul co-occurrences**: Fréquence d'association
3. **Confidence**: Probabilité d'achat conjoint
4. **Recommandations**: Top 5 associations

### Endpoint

```php
POST /predictions/cross-selling
{
  "produit_id": 1
}

Response:
{
  "data": [
    {
      "produit": { "nom": "Huile de palme" },
      "cooccurrence_count": 45,
      "confidence": 35.5
    }
  ]
}
```

---

## Architecture de données

### Schéma principal

```
users (1:N) → ventes (1:N) → lignes_ventes (N:1) → produits
categories (1:N) → produits
produits (1:N) → ai_predictions
produits (1:N) → mouvements_stock
users (1:N) → fcm_tokens
```

### Relations clés

- **User → Ventes**: Un utilisateur fait plusieurs ventes
- **Produit → LignesVentes**: Un produit apparaît dans plusieurs lignes
- **Vente → LignesVentes**: Une vente a plusieurs lignes
- **Produit → AiPredictions**: Un produit a plusieurs prédictions

---

## Flux de communication

### Requête API typique

```
Client → Axios Request → API Client → Add Bearer Token →
Backend → Middleware (auth:sanctum) → Controller → 
Service → Model → Database → Response → Client
```

### Gestion erreurs

```
401 Unauthorized → Auto refresh token → Retry request
422 Validation → Display errors to user
500 Server Error → Log error → Show generic message
```

### Offline handling

```
Network Error → Store request locally → 
Queue for sync → Retry when online
```

---

## Workflows métier résumés

### Vente

1. Créer brouillon → Ajouter produits → Checkout → Finaliser → Facture

### Stock

1. Créer mouvement → Valider (gérant) → Update stock → Notification

### IA

1. Collecter données → Calculer prédiction → Stocker → Valider → Alertes

### Offline

1. Détecter offline → Stocker localement → Sync batch → Conflict resolution

---

**Documentation Architecture et Workflows SGCI Bénin v2.0**