# 📚 Guide Complet SGCI Bénin - Tout ce qu'il faut savoir

**Version**: 2.0  
**Date**: 2 juin 2026  
**Statut**: Production-Ready (migrations en attente)

---

## 📋 Table des matières

1. [Présentation du projet](#présentation-du-projet)
2. [Architecture technique](#architecture-technique)
3. [Stack technologique](#stack-technologique)
4. [Base de données](#base-de-données)
5. [API Backend](#api-backend)
6. [Frontend Web](#frontend-web)
7. [Application Mobile](#application-mobile)
8. [Workflows métier](#workflows-métier)
9. [Fonctionnalités détaillées](#fonctionnalités-détaillées)
10. [Configuration](#configuration)
11. [Déploiement](#déploiement)
12. [Tests](#tests)
13. [Maintenance](#maintenance)
14. [Roadmap](#roadmap)

---

## Présentation du projet

### Qu'est-ce que SGCI Bénin?

**SGCI Bénin** (Système de Gestion Commerciale Intelligente) est une solution SaaS de gestion de boutique complète et intelligente conçue pour les commerçants au Bénin et en Afrique de l'Ouest.

### Objectifs principaux

- **Gestion complète**: Produits, stock, ventes, clients, caisse
- **Intelligence Artificielle**: Prédictions de demande, recommandations, cross-selling
- **Multi-plateforme**: Web, Mobile (iOS/Android)
- **Offline-first**: Fonctionne sans connexion internet
- **Notifications**: Alertes stock, rapports automatiques
- **Sécurité**: Rôles, permissions, audit trail

### Valeur ajoutée

- Réduction des ruptures de stock grâce à l'IA
- Optimisation des réapprovisionnements
- Amélioration de l'expérience client
- Gain de temps dans la gestion quotidienne
- Décisions basées sur les données

---

## Architecture technique

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend Web                          │
│                    (Next.js 15 + React 19)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/REST
┌──────────────────────▼──────────────────────────────────────┐
│                      Backend API                              │
│                   (Laravel 12 + Sanctum)                     │
├─────────────────────────────────────────────────────────────┤
│  Controllers  │  Services  │  Jobs  │  Middleware  │  Models │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    Base de données                           │
│                      (MySQL 8)                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Application Mobile                         │
│                  (Expo 54 + React Native)                     │
└─────────────────────────────────────────────────────────────┘
```

### Composants principaux

#### Backend (Laravel 12)
- **Framework**: Laravel 12
- **Authentification**: Laravel Sanctum
- **Base de données**: MySQL 8
- **Queue**: Laravel Queues (Redis)
- **Scheduler**: Laravel Scheduler
- **ORM**: Eloquent ORM

#### Frontend (Next.js 15)
- **Framework**: Next.js 15 (App Router)
- **UI**: React 19
- **Styling**: Tailwind CSS 4
- **Components**: shadcn/ui
- **HTTP Client**: Axios
- **State Management**: React Context + useState

#### Mobile (Expo 54)
- **Framework**: Expo 54
- **UI**: React Native
- **Storage**: AsyncStorage, SecureStore
- **Camera**: expo-camera
- **Barcode**: expo-camera (scan code-barres)

---

## Stack technologique

### Backend

| Composant | Version | Description |
|-----------|---------|-------------|
| PHP | 8.3+ | Langage principal |
| Laravel | 12 | Framework PHP |
| MySQL | 8.0+ | Base de données |
| Sanctum | 3.x | Authentification API |
| Redis | 7.x | Queue & Cache |
| Composer | 2.x | Gestion dépendances PHP |

### Frontend

| Composant | Version | Description |
|-----------|---------|-------------|
| Node.js | 20+ | Runtime JavaScript |
| Next.js | 15 | Framework React |
| React | 19 | Library UI |
| TypeScript | 5.x | Typage |
| Tailwind CSS | 4.x | Styling |
| shadcn/ui | Latest | Components UI |
| Axios | 1.x | HTTP Client |

### Mobile

| Composant | Version | Description |
|-----------|---------|-------------|
| Expo | 54 | Framework React Native |
| React Native | 0.74+ | Framework mobile |
| expo-camera | 15.x | Camera & scan |
| AsyncStorage | 1.x | Stockage local |
| SecureStore | 12.x | Stockage sécurisé |

### Infrastructure

| Composant | Description |
|-----------|-------------|
| Docker | Conteneurisation |
| GitHub Actions | CI/CD |
| Firebase Cloud Messaging | Push notifications |
| SMTP | Emails transactionnels |
| SMS Provider | SMS transactionnels |

---

## Base de données

### Schéma global

#### Tables principales

1. **users** - Utilisateurs du système
2. **categories** - Catégories de produits
3. **produits** - Produits du catalogue
4. **clients** - Clients de la boutique
5. **ventes** - Ventes effectuées
6. **ligne_ventes** - Lignes de vente (détails)
7. **mouvements_stock** - Mouvements de stock
8. **boutique_settings** - Paramètres boutique
9. **app_notifications** - Notifications in-app
10. **fcm_tokens** - Tokens Firebase (en attente)
11. **ai_predictions** - Prédictions IA (en attente)
12. **ai_metrics** - Métriques IA

#### Tables système

- **personal_access_tokens** - Tokens Sanctum
- **cache** - Cache Laravel
- **jobs** - Queue Laravel

### Relations

```
users (1) ──────── (N) ventes
users (1) ──────── (N) app_notifications
categories (1) ── (N) produits
clients (1) ────── (N) ventes
produits (1) ───── (N) ligne_ventes
ventes (1) ─────── (N) ligne_ventes
produits (1) ───── (N) mouvements_stock
```

### Migrations

#### Migrations exécutées (20)
- 0001_01_01_000000_create_users_table.php
- 0001_01_01_000001_create_cache_table.php
- 0001_01_01_000002_create_jobs_table.php
- 2025_10_17_155025_create_categories_table.php
- 2025_10_17_155025_create_produits_table.php
- 2025_10_17_155025_create_ventes_table.php
- 2025_10_17_155026_create_ligne_ventes_table.php
- 2025_10_17_155027_add_role_to_users_table.php
- 2025_10_17_164513_add_deleted_at_to_categories_table.php
- 2025_10_17_173810_create_personal_access_tokens_table.php
- 2025_10_21_104429_create_clients_table.php
- 2025_10_23_133823_create_ai_metrics_table.php
- 2025_10_23_133834_create_ai_predictions_table.php
- 2025_10_24_190143_add_client_id_to_ventes_table.php
- 2026_05_20_000000_create_mouvements_stock_table.php
- 2026_05_21_100000_add_paiement_fields_to_ventes_table.php
- 2026_05_21_100001_add_image_url_to_produits_table.php
- 2026_05_21_100002_create_boutique_settings_table.php
- 2026_05_22_100000_create_app_notifications_table.php

#### Migrations en attente (2)
- 2026_05_26_000000_create_fcm_tokens_table.php
- 2026_05_26_000001_create_ai_predictions_table.php

**Action requise**: `php artisan migrate`

---

## API Backend

### Authentification

#### Login
```
POST /api/login
Body: { email, password }
Response: { token, user: { id, name, email, role } }
```

#### Logout
```
POST /api/logout
Headers: Authorization: Bearer {token}
```

#### Refresh Token
```
POST /api/refresh
Headers: Authorization: Bearer {token}
```

### Produits

#### Liste produits
```
GET /api/produits?page=1&search=xxx&categorie_id=1&statut_stock=alerte
Response: { data: [...], meta: { current_page, last_page, total, ... } }
```

#### Créer produit
```
POST /api/produits
Body: { nom, description, prix, quantite_stock, seuil_alerte, categorie_id, ... }
```

#### Modifier produit
```
PUT /api/produits/{id}
Body: { nom, description, prix, seuil_alerte, categorie_id, ... }
```

#### Supprimer produit
```
DELETE /api/produits/{id}
```

#### Scanner code-barres
```
GET /api/produits/scan/{code}
Response: { id, nom, prix, quantite_stock, ... }
```

#### Upload image
```
POST /api/produits/{id}/image
Body: FormData avec fichier 'image'
```

### Catégories

#### Liste catégories
```
GET /api/categories
Response: [{ id, nom, description, couleur, icone, produits_count }]
```

#### CRUD catégories
```
POST /api/categories
PUT /api/categories/{id}
DELETE /api/categories/{id}
```

### Stock

#### Liste mouvements
```
GET /api/mouvements-stock?date_debut=xxx&date_fin=xxx&statut=valide
```

#### Créer mouvement
```
POST /api/mouvements-stock
Body: { produit_id, quantite, type, raison, date_mouvement }
```

#### Valider mouvement
```
POST /api/mouvements-stock/{id}/valider
```

#### Rejeter mouvement
```
POST /api/mouvements-stock/{id}/rejeter
```

### Ventes

#### Liste ventes
```
GET /api/ventes?page=1&date_debut=xxx&date_fin=xxx&statut=terminee
```

#### Créer vente (brouillon)
```
POST /api/ventes
Body: { client_id, items: [{ produit_id, quantite, prix_unitaire }] }
```

#### Checkout
```
POST /api/ventes/{id}/checkout
Body: { mode_paiement, montant_paye, remise }
```

#### Finaliser vente
```
POST /api/ventes/{id}/finaliser
```

#### Annuler vente
```
POST /api/ventes/{id}/annuler
```

#### Sync offline batch
```
POST /api/ventes/sync-offline-batch
Body: { ventes: [...] }
```

### Clients

#### Liste clients
```
GET /api/clients?page=1&search=xxx&statut=vip
```

#### CRUD clients
```
POST /api/clients
PUT /api/clients/{id}
DELETE /api/clients/{id}
```

#### Promouvoir VIP
```
POST /api/clients/{id}/promouvoir-vip
```

### Analytics

#### Stats globales
```
GET /api/analytics/stats-globales
Response: { ventes: {...}, produits: {...} }
```

#### Produits populaires
```
GET /api/analytics/produits-populaires
Response: [{ produit_id, total_vendus, chiffre_affaires, produit: {...} }]
```

#### Ventes par période
```
GET /api/analytics/ventes-periode?periode=jour/semaine/mois
```

### IA/Prédictions

#### Prédictions demande
```
GET /api/predictions/demande
Response: [{ produit_id, predicted_demand, confidence, date_prediction }]
```

#### Recommandations réapprovisionnement
```
GET /api/predictions/recommandations-reappro
Response: [{ produit_id, recommended_qty, urgency, reason }]
```

#### Cross-selling
```
GET /api/predictions/cross-selling/{produit_id}
Response: [{ produit_id, confidence, reason }]
```

#### Métriques IA
```
GET /api/predictions/metrics
Response: { accuracy, precision, recall, last_updated }
```

### Notifications

#### Liste notifications
```
GET /api/notifications
Response: [{ id, type, titre, message, lu, created_at }]
```

#### Marquer comme lu
```
POST /api/notifications/{id}/marquer-lu
```

#### Sync alertes stock
```
POST /api/notifications/sync-stock-alerts
```

### Paramètres

#### Récupérer settings
```
GET /api/boutique-settings
Response: { nom_boutique, adresse, telephone, alertes_stock_actives, ... }
```

#### Modifier settings
```
PUT /api/boutique-settings
Body: { nom_boutique, adresse, telephone, ... }
```

### Utilisateurs

#### Liste utilisateurs
```
GET /api/users (gérant uniquement)
```

#### CRUD utilisateurs
```
POST /api/users (gérant uniquement)
PUT /api/users/{id} (gérant uniquement)
DELETE /api/users/{id} (gérant uniquement)
```

---

## Frontend Web

### Structure du projet

```
sgci-frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Layout principal
│   │   ├── page.tsx            # Page d'accueil
│   │   ├── login/              # Page login
│   │   ├── dashboard/          # Dashboard
│   │   ├── produits/           # Gestion produits
│   │   ├── stock/              # Gestion stock
│   │   ├── arrivage/           # Arrivages
│   │   ├── caisse/             # Caisse/POS
│   │   ├── clients/            # Gestion clients
│   │   ├── analytics/          # Analytics
│   │   ├── ia/                 # Assistant IA
│   │   └── parametres/         # Paramètres
│   ├── components/
│   │   ├── ui/                 # Composants shadcn/ui
│   │   ├── AppShell.tsx        # Layout avec sidebar
│   │   ├── AppChrome.tsx       # Router layout
│   │   ├── AuthGuard.tsx       # Protection routes
│   │   ├── NotificationBell.tsx # Cloche notifications
│   │   └── ...
│   ├── contexts/
│   │   └── AuthContext.tsx     # Contexte authentification
│   ├── lib/
│   │   ├── api-client.ts       # Client HTTP avec refresh token
│   │   ├── media.ts            # Upload images
│   │   └── utils.ts            # Utilitaires
│   └── globals.css             # Styles globaux
├── package.json
├── tsconfig.json
└── next.config.js
```

### Pages principales

#### Dashboard (`/dashboard`)
- Stats en temps réel (CA, ventes, stock, alertes)
- Produits en alerte
- Produits populaires
- Graphiques et métriques

#### Produits (`/produits`)
- Liste produits avec pagination
- Filtres (catégorie, statut stock, recherche)
- Vue grille / liste
- CRUD produits (gérant)
- Upload images
- Gestion catégories

#### Stock (`/stock`)
- Liste mouvements de stock
- Filtres (date, raison, statut)
- Validation arrivages (gérant)
- Export mouvements

#### Arrivage (`/arrivage`)
- Création mouvements entrée
- Validation/rejet (gérant)
- Historique arrivages

#### Caisse (`/caisse`)
- Point de vente
- Scan code-barres
- Gestion panier
- Paiements (espèces, mobile money, carte)
- Facturation PDF
- Mode offline avec sync

#### Clients (`/clients`)
- Liste clients
- Filtres (statut VIP, recherche)
- CRUD clients
- Historique commandes
- Promotion VIP (gérant)

#### Analytics (`/analytics`)
- Graphiques ventes
- Tendances
- Performance produits
- Rapports personnalisés

#### IA (`/ia`)
- Prédictions demande
- Recommandations réapprovisionnement
- Cross-selling
- Métriques IA

#### Paramètres (`/parametres`)
- Profil utilisateur
- Paramètres boutique (gérant)
- Gestion utilisateurs (gérant)
- Préférences

### Composants UI

#### shadcn/ui
- Button, Input, Card, Dialog, Table, Select, Switch, Badge, etc.
- Thème dark/light
- Responsive design

#### Composants personnalisés
- AppShell: Layout avec sidebar + header
- NotificationBell: Cloche notifications avec badge
- BarcodeScanner: Scan code-barres
- LoadingSpinner: Spinner de chargement

### State Management

#### Contextes
- AuthContext: Authentification utilisateur
- ThemeProvider: Thème dark/light

#### Hooks
- useState: État local
- useEffect: Effets de bord
- useCallback: Fonctions mémorisées
- useMemo: Valeurs mémorisées

### API Client

#### api-client.ts
```typescript
const apiFetch = async (url, options) => {
  // Ajout token automatique
  // Refresh token automatique sur 401
  // Gestion erreurs
}
```

### Routing

#### App Router (Next.js 15)
- Routes basées sur système de fichiers
- Layouts imbriqués
- Protection routes via AuthGuard

---

## Application Mobile

### Structure du projet

```
sgci-mobile/mobile-vs-emulator/
├── App.tsx                    # Point d'entrée
├── app.json                  # Configuration Expo
├── assets/                   # Images, fonts
├── components/               # Composants réutilisables
├── screens/                  # Écrans
│   ├── LoginScreen.tsx
│   ├── DashboardScreen.tsx
│   ├── ProductsScreen.tsx
│   ├── StockScreen.tsx
│   ├── SalesScreen.tsx
│   └── ...
├── services/                 # Services API
├── storage/                  # Stockage local
├── utils/                    # Utilitaires
└── package.json
```

### Fonctionnalités

#### Authentification
- Login avec email/mot de passe
- Stockage token sécurisé (SecureStore)
- Refresh token automatique

#### Produits
- Liste produits
- Scan code-barres
- Détails produit

#### Ventes
- Création vente
- Scan produits
- Paiement
- Sync offline

#### Offline
- Détection connexion
- Stockage local (AsyncStorage)
- Sync batch

#### Notifications
- FCM push notifications
- Notifications in-app

### Capacités natives

- Camera: Scan code-barres
- Storage: AsyncStorage, SecureStore
- Network: Détection connexion
- Notifications: Expo Notifications

---

## Workflows métier

### Workflow Authentification

```
1. User saisit email/password
2. Frontend → POST /api/login
3. Backend vérifie credentials
4. Backend génère token Sanctum
5. Backend retourne token + user
6. Frontend stocke token (localStorage)
7. Frontend redirige vers dashboard
8. Chaque requête inclut token (Authorization: Bearer)
9. Token refresh automatique sur 401
```

### Workflow Vente

```
1. Caissier ouvre page caisse
2. Scan code-barres produit
3. Produit ajouté au panier
4. Répétition pour tous les produits
5. Sélection client (optionnel)
6. Sélection mode paiement
7. Saisie montant payé
8. Calcul remise (optionnel)
9. Click "Payer"
10. Création vente (statut: en_cours)
11. Décrémentation stock
12. Génération facture PDF
13. Vente finalisée (statut: terminee)
14. Notification gérant
```

### Workflow Stock

```
1. Gérant crée mouvement entrée
2. Sélection produit
3. Saisie quantité
4. Saisie raison (fournisseur, etc.)
5. Mouvement créé (statut: pending)
6. Gérant valide mouvement
7. Stock incrémenté
8. Mouvement validé (statut: valide)
9. Notification caissiers
```

### Workflow IA Prédictions

```
1. Scheduler lance job quotidien (minuit)
2. ValidatePredictionsJob exécuté
3. Compare prédictions vs ventes réelles
4. Calcule accuracy, precision, recall
5. Met à jour métriques IA
6. Scheduler lance job hebdomadaire (dimanche 22h)
7. GeneratePredictionsJob exécuté
8. Analyse ventes historiques
9. Génère prédictions demande
10. Génère recommandations réapprovisionnement
11. Stocke dans table ai_predictions
12. Alertes générées si critique
```

### Workflow Offline Sync

```
1. Mobile détecte offline
2. Ventes stockées localement
3. Queue offline créée
4. Mobile détecte online
5. Sync automatique déclenché
6. POST /api/ventes/sync-offline-batch
7. Backend traite chaque vente
8. Stock décrémenté
9. Ventes confirmées
10. Queue locale vidée
```

### Workflow Notifications

```
1. Événement déclencheur (vente, stock bas, etc.)
2. Notification créée en base
3. Si utilisateur connecté:
   - WebSocket push
   - Notification in-app
4. Si utilisateur mobile:
   - FCM push notification
5. Si utilisateur offline:
   - Email/SMS (configuré)
```

---

## Fonctionnalités détaillées

### Par module

#### Module Produits
- Liste produits avec pagination
- Recherche par nom/code
- Filtre par catégorie
- Filtre par statut stock (normal, alerte, rupture)
- Vue grille / liste
- Créer produit (gérant)
- Modifier produit (gérant)
- Supprimer produit (gérant)
- Upload image produit
- Gestion images multiples
- Scan code-barres
- Statistiques produits

#### Module Stock
- Liste mouvements de stock
- Filtre par date
- Filtre par raison
- Filtre par statut (pending, valide, rejeté)
- Créer mouvement entrée
- Créer mouvement sortie
- Valider mouvement (gérant)
- Rejeter mouvement (gérant)
- Export mouvements
- Historique par produit

#### Module Ventes
- Liste ventes avec pagination
- Filtre par date
- Filtre par statut
- Filtre par client
- Créer brouillon vente
- Ajouter produits au panier
- Modifier quantité panier
- Supprimer produit panier
- Sélection client
- Sélection mode paiement
- Appliquer remise
- Checkout vente
- Finaliser vente
- Annuler vente
- Génération facture PDF
- Sync offline batch

#### Module Clients
- Liste clients avec pagination
- Recherche par nom/téléphone
- Filtre par statut (normal, VIP)
- Créer client
- Modifier client
- Supprimer client (gérant)
- Promouvoir VIP (gérant)
- Historique commandes
- Statistiques client

#### Module Caisse
- Interface POS intuitive
- Scan code-barres
- Recherche produit
- Gestion panier
- Calcul automatique total
- Modes paiement (espèces, mobile money, carte)
- Gestion remise
- Génération facture
- Mode offline
- Sync automatique
- Historique ventes du jour

#### Module Analytics
- Stats globales (CA, ventes, stock)
- Graphiques ventes
- Tendances temporelles
- Top produits
- Top clients
- Rapports personnalisés
- Export données

#### Module IA
- Prédictions demande
- Recommandations réapprovisionnement
- Cross-selling
- Métriques performance
- Alertes prédictions
- Validation automatique

#### Module Notifications
- Liste notifications
- Marquer comme lu
- Cloche notifications
- Badge compteur
- Filtre par type
- Notifications in-app
- Push notifications (FCM)
- Email notifications
- SMS notifications

#### Module Paramètres
- Profil utilisateur
- Modification mot de passe
- Paramètres boutique (gérant)
- Gestion utilisateurs (gérant)
- Préférences thème
- Préférences langue

### Par rôle

#### Gérant
- Accès complet à tous les modules
- Créer/modifier/supprimer produits
- Valider/rejeter mouvements stock
- Promouvoir clients VIP
- Gérer utilisateurs
- Modifier paramètres boutique
- Voir analytics complets
- Accéder assistant IA

#### Caissier
- Accès modules: Caisse, Produits (lecture), Clients
- Créer ventes
- Scanner produits
- Gérer panier
- Voir stock (lecture)
- Créer clients
- Voir notifications

### Par plateforme

#### Web
- Toutes les fonctionnalités
- Interface desktop
- Navigation sidebar
- Analytics avancés
- Gestion complète

#### Mobile
- Fonctionnalités essentielles
- Interface mobile
- Navigation bottom tabs
- Scan code-barres
- Mode offline
- Push notifications

### Capacités Offline

#### Détection
- Détection automatique connexion
- Indicateur visuel online/offline
- Toast notification changement état

#### Stockage
- Ventes stockées localement
- Produits en cache
- Queue offline
- Persistance AsyncStorage

#### Synchronisation
- Sync automatique au retour online
- Sync batch pour performance
- Gestion conflits
- Validation serveur

---

## Configuration

### Variables d'environnement Backend

```env
# Application
APP_NAME=SGCI_Bénin
APP_ENV=local
APP_KEY=base64:xxx
APP_DEBUG=true
APP_URL=http://localhost:8000

# Database
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=sgci_benin
DB_USERNAME=root
DB_PASSWORD=

# Sanctum
SANCTUM_STATEFUL_DOMAINS=localhost:3000
SANCTUM_TOKEN_EXPIRATION=4320

# Queue
QUEUE_CONNECTION=redis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

# Mail
MAIL_MAILER=smtp
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USERNAME=your-email
MAIL_PASSWORD=your-password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=noreply@sgci.bj
MAIL_FROM_NAME="${APP_NAME}"

# Firebase (optionnel)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="your-private-key"
FIREBASE_CLIENT_EMAIL=your-client-email

# SMS (optionnel)
SMS_ENABLED=true
SMS_PROVIDER=twilio
SMS_TWILIO_SID=your-sid
SMS_TWILIO_TOKEN=your-token
SMS_TWILIO_FROM=your-number
```

### Variables d'environnement Frontend

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_APP_NAME=SGCI Bénin
```

### Configuration Mobile

```json
{
  "expo": {
    "name": "SGCI Bénin",
    "slug": "sgci-benin",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain"
    },
    "ios": {
      "bundleIdentifier": "com.sgci.benin"
    },
    "android": {
      "package": "com.sgci.benin"
    }
  }
}
```

---

## Déploiement

### Pré-déploiement

#### 1. Exécuter migrations
```bash
cd sgci-backend
php artisan migrate
```

#### 2. Optimiser application
```bash
php artisan optimize
php artisan config:cache
php artisan route:cache
```

#### 3. Build frontend
```bash
cd sgci-frontend
npm run build
```

#### 4. Build mobile
```bash
cd sgci-mobile/mobile-vs-emulator
eas build --platform ios
eas build --platform android
```

### Déploiement Backend

#### Option 1: VPS (DigitalOcean, Hetzner, etc.)

```bash
# Cloner repository
git clone <repo-url>
cd sgci-backend

# Installer dépendances
composer install --no-dev --optimize-autoloader

# Configurer environnement
cp .env.example .env
nano .env

# Générer key
php artisan key:generate

# Exécuter migrations
php artisan migrate --force

# Configurer supervisor pour queue
sudo apt install supervisor
sudo nano /etc/supervisor/conf.d/sgci-worker.conf

# Démarrer worker
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start sgci-worker:*

# Configurer crontab
crontab -e
# Ajouter: * * * * * cd /path-to-project && php artisan schedule:run >> /dev/null 2>&1

# Démarrer serveur (optionnel, utiliser nginx en prod)
php artisan serve --host=0.0.0.0 --port=8000
```

#### Option 2: Docker

```bash
# Build image
docker build -t sgci-backend .

# Run container
docker run -d \
  --name sgci-backend \
  -p 8000:8000 \
  -e DB_HOST=db \
  -e DB_DATABASE=sgci_benin \
  -e DB_USERNAME=root \
  -e DB_PASSWORD=secret \
  sgci-backend
```

### Déploiement Frontend

#### Option 1: Vercel

```bash
# Installer Vercel CLI
npm i -g vercel

# Deploy
cd sgci-frontend
vercel
```

#### Option 2: VPS avec Nginx

```bash
# Build
npm run build

# Configurer Nginx
sudo nano /etc/nginx/sites-available/sgci-frontend

# Ajouter configuration
server {
    listen 80;
    server_name sgci.benin;
    root /var/www/sgci-frontend/.next;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Activer site
sudo ln -s /etc/nginx/sites-available/sgci-frontend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Déploiement Mobile

#### Google Play Store

```bash
# Build APK
eas build --platform android --profile production

# Upload sur Google Play Console
# Remplir store listing
# Soumettre pour review
```

#### Apple App Store

```bash
# Build IPA
eas build --platform ios --profile production

# Upload sur App Store Connect
# Remplir store listing
# Soumettre pour review
```

---

## Tests

### Tests Backend

#### Tests unitaires
```bash
php artisan test
```

#### Tests spécifiques
```bash
php artisan test --filter ProduitTest
```

#### Tests avec coverage
```bash
php artisan test --coverage
```

### Tests Frontend

#### Tests E2E (Playwright)
```bash
cd sgci-frontend
npm run test:e2e
```

#### Tests unitaires
```bash
npm run test
```

### Tests Mobile

#### Tests avec Jest
```bash
cd sgci-mobile/mobile-vs-emulator
npm test
```

### Checklist tests manuels

#### Authentification
- [ ] Login avec credentials valides
- [ ] Login avec credentials invalides
- [ ] Logout fonctionne
- [ ] Token refresh automatique
- [ ] Protection routes sans token

#### Produits
- [ ] Liste produits affiche
- [ ] Recherche fonctionne
- [ ] Filtres fonctionnent
- [ ] Création produit (gérant)
- [ ] Modification produit (gérant)
- [ ] Suppression produit (gérant)
- [ ] Upload image fonctionne
- [ ] Scan code-barres fonctionne

#### Stock
- [ ] Liste mouvements affiche
- [ ] Création mouvement fonctionne
- [ ] Validation mouvement (gérant)
- [ ] Rejet mouvement (gérant)
- [ ] Stock mis à jour correctement

#### Ventes
- [ ] Création vente fonctionne
- [ ] Ajout produit panier
- [ ] Modification quantité
- [ ] Suppression produit panier
- [ ] Checkout fonctionne
- [ ] Finalisation fonctionne
- [ ] Annulation fonctionne
- [ ] Stock décrémenté
- [ ] Facture générée

#### Clients
- [ ] Liste clients affiche
- [ ] Création client
- [ ] Modification client
- [ ] Promotion VIP (gérant)
- [ ] Historique commandes

#### Offline
- [ ] Détection offline
- [ ] Vente offline stockée
- [ ] Sync au retour online
- [ ] Conflits gérés

---

## Maintenance

### Commandes utiles

#### Backend

```bash
# Clear cache
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear

# Optimize
php artisan optimize

# Queue worker
php artisan queue:work

# Scheduler test
php artisan schedule:run

# Logs
php artisan log:clear
tail -f storage/logs/laravel.log
```

#### Frontend

```bash
# Clear cache
rm -rf .next
rm -rf node_modules/.cache

# Reinstall dependencies
rm -rf node_modules
npm install

# Lint
npm run lint

# Type check
npm run type-check
```

#### Database

```bash
# Backup
mysqldump -u root -p sgci_benin > backup.sql

# Restore
mysql -u root -p sgci_benin < backup.sql

# Reset (attention!)
php artisan migrate:fresh --seed
```

### Monitoring

#### Logs Laravel
- `storage/logs/laravel.log` - Logs application
- `storage/logs/queue.log` - Logs queue
- `storage/logs/scheduler.log` - Logs scheduler

#### Logs Frontend
- Console browser - Logs navigateur
- Network tab - Requêtes API

#### Monitoring production
- Sentry - Erreurs
- New Relic - Performance
- Loggly - Logs centralisés

### Mises à jour

#### Mise à jour dépendances Backend
```bash
composer update
composer audit
```

#### Mise à jour dépendances Frontend
```bash
npm update
npm audit
```

#### Mise à jour Expo
```bash
npx expo install --fix
```

### Sécurité

#### HTTPS
- Certificat SSL (Let's Encrypt)
- Force HTTPS
- HSTS

#### Authentification
- Token expiration
- Refresh token
- 2FA (optionnel)

#### Validation
- Validation input côté serveur
- Sanitization
- SQL injection prevention (Eloquent)

#### CORS
- Configuration CORS
- Whitelist domains

---

## Roadmap

### Version actuelle: 2.0

**Statut**: Production-Ready (migrations en attente)

### Version 2.1 (Court terme)

- [ ] Exécuter migrations en attente
- [ ] Configurer Firebase pour FCM
- [ ] Configurer SMTP pour emails
- [ ] Configurer SMS provider
- [ ] Tests E2E complets
- [ ] Documentation utilisateur

### Version 3.0 (Moyen terme)

- [ ] SaaS / Multi-boutiques
- [ ] Segmentation clients IA
- [ ] Dashboard IA temps réel
- [ ] Pricing dynamique
- [ ] Détection fraude
- [ ] 2FA (Two-Factor Authentication)
- [ ] Audit trail avancé

### Version 4.0 (Long terme)

- [ ] Marketplace intégré
- [ ] Intégration paiement mobile
- [ ] Rapports avancés
- [ ] API publique
- [ ] Webhooks
- [ ] Intégrations ERP
- [ ] Mobile app native (Swift/Kotlin)

---

## Support

### Documentation

- README.md - Présentation rapide
- TECHNICAL_DOCUMENTATION.md - Documentation technique
- API_DOCUMENTATION.md - Documentation API
- ARCHITECTURE_AND_WORKFLOWS.md - Architecture et workflows
- FONCTIONNALITES.md - Liste fonctionnalités
- VERIFICATION_WORKFLOWS.md - Checklist tests
- RAPPORT_VERIFICATION_WORKFLOWS.md - Rapport vérification

### Contacts

- Email: support@sgci.bj
- GitHub: [Repository URL]
- Documentation: [Documentation URL]

### Comptes démo

- Gérant: `gerant@sgci.bj` / `password`
- Caissier: `caissier@sgci.bj` / `password`

---

## Conclusion

SGCI Bénin est une solution complète de gestion commerciale intelligente conçue pour les commerçants au Bénin. Avec ses fonctionnalités avancées d'IA, son mode offline-first et son interface intuitive, il offre une expérience utilisateur exceptionnelle tout en optimisant la gestion quotidienne.

Le projet est actuellement en version 2.0, production-ready avec quelques migrations en attente. La roadmap prévoit des améliorations continues pour transformer SGCI Bénin en une solution SaaS multi-boutiques complète.

**Pour commencer**: Exécutez les migrations en attente, démarrez les serveurs, et commencez les tests avec les comptes démo.

**Bonne chance!** 🚀
