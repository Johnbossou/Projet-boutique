# 📘 SGCI Bénin — Documentation Technique

> **Version 2.0** | Mai 2026

---

## Table des matières

1. [Architecture](#architecture)
2. [Stack technique](#stack-technique)
3. [Backend Laravel](#backend-laravel)
4. [Frontend Next.js](#frontend-nextjs)
5. [Mobile Expo](#mobile-expo)
6. [Base de données](#base-de-données)
7. [Sécurité](#sécurité)
8. [Module IA](#module-ia)
9. [Offline System](#offline-system)
10. [CI/CD](#cicd)

---

## Architecture

```
Frontend (Next.js) ←→ Mobile (Expo) ←→ Backend (Laravel) ←→ MySQL
                              ↓
                         Services (FCM, Email, SMS)
```

---

## Stack technique

**Backend**: Laravel 12, PHP 8.2, MySQL 8, Sanctum, Queues, Scheduler
**Frontend**: Next.js 15, React 19, Tailwind 4, shadcn/ui, Axios
**Mobile**: Expo 54, React Native, AsyncStorage, SecureStore
**Infrastructure**: Docker, GitHub Actions, FCM, SMTP

---

## Backend Laravel

### Structure
```
app/
├── Http/Controllers/API/ (Auth, Produit, Vente, Predictions, Fcm)
├── Models/ (User, Produit, Vente, AiPrediction, FcmToken)
├── Services/ (FcmService, EmailService, SmsService)
├── Jobs/ (SendStockAlertsJob, ValidatePredictionsJob)
└── Console/Kernel.php (Scheduler)
```

### Modèles clés
- **User**: Authentification, rôles (gerant/caissier)
- **Produit**: CRUD, stock, alertes, relations ventes
- **Vente**: Transactions, lignes, paiements
- **AiPrediction**: Prédictions IA, validation, métriques

### Scheduler (Kernel.php)
```php
// Alertes stock: 9h quotidien
$schedule->job(new SendStockAlertsJob())->dailyAt('09:00');

// Validation prédictions: 23h quotidien
$schedule->job(new ValidatePredictionsJob())->dailyAt('23:00');

// Alertes prédictions: 8h quotidien
$schedule->job(new SendPredictionAlertsJob())->dailyAt('08:00');

// Prédictions hebdomadaires: dimanche 22h
$schedule->call(fn() => app(PredictionsController::class)->genererPredictionsHebdomadaires())
    ->weekly()->sundaysAt('22:00');
```

---

## Frontend Next.js

### Structure
```
src/
├── app/ (pages: login, dashboard, produits, caisse, etc.)
├── components/ui/ (shadcn/ui)
├── contexts/AuthContext.tsx
└── lib/api-client.ts
```

### AuthContext
- Gestion état auth (user, login, logout)
- Token refresh automatique
- Redirection intelligente

### API Client
- Axios avec interceptors
- Gestion erreurs 401
- Refresh token automatique

---

## Mobile Expo

### Structure
```
src/
├── screens/ (Login, Dashboard, Products, CashRegister, etc.)
├── navigation/ (TabNavigator, AuthNavigator)
├── services/ (api, auth, offlineSync)
└── contexts/AuthContext.tsx
```

### Offline Sync
- AsyncStorage pour ventes offline
- Batch sync endpoint: `/ventes/sync-offline-batch`
- Conflict resolution: Last-write-wins

---

## Base de données

### Tables principales
- **users**: id, name, email, password, role, is_active
- **produits**: id, nom, prix, stock, seuil_alerte, code_barres
- **ventes**: id, numero, total, user_id, statut, mode_paiement
- **lignes_ventes**: id, vente_id, produit_id, quantite, prix_unitaire
- **ai_predictions**: id, produit_id, predicted_demand, real_demand, metrics
- **fcm_tokens**: id, user_id, token, platform, is_active

### Relations
- users → ventes (1:N)
- produits → lignes_ventes (1:N)
- ventes → lignes_ventes (1:N)
- produits → ai_predictions (1:N)

---

## Sécurité

### Authentification
- Laravel Sanctum (token-based)
- Token expiration: 24h
- Refresh token endpoint

### Authorization
- Rôles: gerant (accès complet), caissier (accès limité)
- Middleware: `auth:sanctum`, `role:gerant`

### Validation
- Form Requests pour validation
- Rules personnalisées
- Protection XSS/CSRF

---

## Module IA

### Algorithmes
- **Prédictions adaptatives**: Poids dynamiques basés sur volatilité
- **Cross-selling**: Market Basket Analysis
- **Réapprovisionnement**: Recommandations basées sur prédictions

### Métriques
- MAE (Mean Absolute Error)
- RMSE (Root Mean Square Error)
- MAPE (Mean Absolute Percentage Error)
- Accuracy = 100 - MAPE

### Validation
- Job quotidien: ValidatePredictionsJob
- Comparaison prédictions vs réalité
- Stockage dans ai_predictions

---

## Offline System

### Frontend
- localStorage pour données offline
- Détection réseau
- Sync automatique

### Mobile
- AsyncStorage pour ventes offline
- Batch sync par lots
- Gestion conflits

### Backend
- Endpoint: `POST /ventes/sync-offline-batch`
- Transaction DB
- Mise à jour stock

---

## CI/CD

### GitHub Actions
- Backend tests (PHPUnit)
- Frontend tests (Playwright)
- Docker build
- Deploy staging/production

### Docker Compose
- Services: api, db, web
- Volumes persistants
- Environment variables

---

## Performance

### Backend
- Indexation DB
- Caching (Redis)
- Eager loading (N+1 prevention)

### Frontend
- Code splitting
- Memoization
- Lazy loading

### Mobile
- Image optimization
- Virtualization (FlatList)
- AsyncStorage efficient

---

## Monitoring

### Logging
- Laravel Log (backend)
- Console (frontend)
- Error tracking (Sentry optionnel)

### Health Checks
- `GET /api/health`
- Monitoring uptime
- Alertes automatiques

---

**Documentation complète du projet SGCI Bénin v2.0**
