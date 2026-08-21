# 🏪 SGCI Bénin — Système de Gestion Commerciale Intelligente

> **Version 2.0** | Mai 2026 | Production-Ready

---

## 📋 Table des matières

- [Présentation](#présentation)
- [Architecture](#architecture)
- [Stack technique](#stack-technique)
- [Fonctionnalités](#fonctionnalités)
- [Démarrage rapide](#démarrage-rapide)
- [Documentation détaillée](#documentation-détaillée)
- [Roadmap](#roadmap)
- [Support](#support)

---

## 🎯 Présentation

### Qu'est-ce que SGCI ?

**SGCI (Système de Gestion Commerciale Intelligente)** est une solution complète de gestion commerciale conçue pour les boutiques, commerces et PME au Bénin et en Afrique de l'Ouest.

### Problème résolu

Les commerçants font face à des défis quotidiens :
- **Gestion manuelle** des ventes et stocks
- **Perte de données** lors des coupures réseau
- **Absence d'outils analytiques** pour prendre des décisions éclairées
- **Difficulté à suivre** les performances de l'équipe
- **Manque de visibilité** sur les tendances de vente

### Solution SGCI

SGCI offre une suite intégrée de trois applications :
- **API Laravel** — Backend robuste et sécurisé
- **Dashboard Web Next.js** — Interface d'administration moderne
- **Application Mobile Expo** — Caisse portable et hors-ligne

### Cible

- **Boutiques** de détail (alimentation, électronique, mode)
- **Commerces** de proximité
- **PME** avec 1-50 employés
- **Chaînes** de magasins (version multi-boutiques en roadmap)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     SGCI Bénin Architecture                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐│
│  │   Frontend   │      │    Mobile    │      │   Backend    ││
│  │   Next.js    │◄────►│    Expo      │◄────►│   Laravel     ││
│  │  React 19    │      │ React Native │      │   Sanctum    ││
│  │  Tailwind 4  │      │   SecureStore│      │   MySQL 8    ││
│  └──────────────┘      └──────────────┘      └──────────────┘│
│         │                      │                      │       │
│         │                      │                      │       │
│         └──────────────────────┴──────────────────────┘       │
│                          HTTP/REST API                        │
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              Services & Infrastructure                    │ │
│  │  • Laravel Queues (Jobs)                                  │ │
│  │  • Laravel Scheduler (Automated Tasks)                   │ │
│  │  • Firebase Cloud Messaging (Push Notifications)          │ │
│  │  • Email/SMS Services (Alerts)                           │ │
│  │  • Offline Sync (Batch Processing)                       │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Modules principaux

| Module | Dossier | Stack | Rôle |
|--------|---------|-------|------|
| **API** | `sgci-backend` | Laravel 12, Sanctum, MySQL 8 | Backend REST API, Auth, Business Logic |
| **Web** | `sgci-frontend` | Next.js 15, React 19, Tailwind 4, shadcn/ui | Dashboard d'administration |
| **Mobile** | `sgci-mobile/mobile-vs-emulator` | Expo 54, React Native, SecureStore | Caisse portable, Offline-first |

---

## 💻 Stack technique

### Backend (Laravel 12)

- **Framework**: Laravel 12 (PHP 8.2+)
- **Authentification**: Laravel Sanctum (Token-based)
- **Base de données**: MySQL 8.0 / SQLite (dev)
- **ORM**: Eloquent ORM
- **Queues**: Redis/Database queues
- **Scheduler**: Laravel Scheduler (Cron jobs)
- **Validation**: Form Request Validation
- **API Documentation**: OpenAPI/Swagger ready

### Frontend Web (Next.js 15)

- **Framework**: Next.js 15 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS 4
- **Components**: shadcn/ui
- **State Management**: React Context API
- **HTTP Client**: Axios with interceptors
- **Theme**: next-themes (Dark/Light mode)
- **Icons**: Lucide React
- **Animations**: Framer Motion

### Mobile (Expo 54)

- **Framework**: Expo SDK 54
- **UI Library**: React Native
- **Navigation**: React Navigation
- **Storage**: AsyncStorage (Offline data)
- **Security**: Expo SecureStore (Tokens)
- **Scanner**: expo-barcode-scanner (QR/Barcode)
- **Camera**: expo-camera (Product images)
- **PDF**: expo-print (Invoices)
- **HTTP**: Axios

### Infrastructure

- **Containerization**: Docker & Docker Compose
- **CI/CD**: GitHub Actions
- **Version Control**: Git
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **Email**: SMTP/SendGrid integration
- **SMS**: Twilio/Africa's Talking integration

---

## ✨ Fonctionnalités

### 🛒 Caisse & Ventes

- **Enregistrement des ventes** avec scan code-barres
- **Modes de paiement**: Espèces, Mobile Money, Carte bancaire
- **Gestion des remises** et promotions
- **Annulation de vente** (délai configurable)
- **Facturation PDF** automatique
- **File d'attente hors-ligne** (localStorage/AsyncStorage)
- **Synchronisation batch** des ventes offline

### 📦 Produits & Stock

- **CRUD complet** des produits
- **Gestion des catégories** hiérarchiques
- **Alertes stock** automatiques (seuil configurable)
- **Upload d'images** des produits
- **Recherche par code-barres** ou nom
- **Mouvements de stock** (entrées/sorties)
- **Arrivages en attente** de validation gérant
- **Scan QR/Barcode** pour les arrivages

### 👥 Clients & CRM

- **Fiches clients** complètes
- **Statut VIP** avec avantages
- **Historique des commandes**
- **Export des données** (JSON/PDF)
- **Statistiques client** (CA, fréquence)

### 📊 Analytics & IA

- **Tableau de bord** avec KPIs en temps réel
- **Chiffre d'affaires** journalier/mensuel/annuel
- **Top produits** et catégories
- **Alertes stock** visuelles
- **Export des rapports** (JSON/PDF/Excel)
- **Prévisions de demande** (algorithme adaptatif)
- **Recommandations de réapprovisionnement**
- **Cross-selling** (Market Basket Analysis)
- **Métriques de performance** (MAE, RMSE, MAPE, Accuracy)

### 👤 Équipe & Permissions

- **Rôles**: Gérant, Caissier
- **Gestion des comptes** utilisateurs
- **Activation/Désactivation** des comptes
- **Paramètres boutique** centralisés
- **Historique des actions** (audit trail)

### 🔔 Notifications

- **Notifications in-app** (cloche)
- **Push notifications** (FCM) — Implémenté
- **Emails automatiques** (Alertes stock, Rapports) — Implémenté
- **SMS automatiques** (Alertes urgentes) — Implémenté
- **Alertes prédictions IA** — Implémenté

### 🌓 Interface

- **Mode jour/nuit** (Dark/Light theme)
- **Interface responsive** (Mobile-first)
- **Design moderne** avec animations
- **Accessibilité** (WCAG AA)

### 🔄 Offline System

- **Stockage local** (localStorage/AsyncStorage)
- **Synchronisation batch** automatique
- **Gestion des conflits** (Last-write-wins)
- **Reprise automatique** sur rétablissement réseau

---

## 🚀 Démarrage rapide

### Prérequis

- **PHP 8.2+** avec Composer
- **Node.js 18+** avec npm
- **MySQL 8.0+** ou SQLite
- **Docker** (optionnel)
- **Git**

### 1. Cloner le projet

```bash
git clone https://github.com/votre-organisation/sgci-benin.git
cd sgci-benin
```

### 2. Backend (Laravel)

```bash
cd sgci-backend
composer install
copy .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan storage:link
php artisan serve
```

**API URL**: `http://127.0.0.1:8000/api`
**Health Check**: `GET http://127.0.0.1:8000/api/health`

### 3. Frontend Web (Next.js)

```bash
cd sgci-frontend
npm install
copy .env.local.example .env.local
# Configurer NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
npm run dev
```

**Web URL**: `http://localhost:3000`

### 4. Mobile (Expo)

```bash
cd sgci-mobile/mobile-vs-emulator
npm install
copy .env.example .env
# Configurer EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api (émulateur Android)
npx expo start
```

**Pour Android**: Appuyer sur `a`
**Pour iOS**: Appuyer sur `i`

### 5. Docker (Alternative)

```bash
docker-compose up -d
```

### Comptes de démonstration

| Email | Mot de passe | Rôle | Permissions |
|-------|--------------|------|-------------|
| `gerant@sgci.bj` | `password` | Gérant | Accès complet |
| `caissier@sgci.bj` | `password` | Caissier | Caisse, Produits (lecture) |

---

## 📚 Documentation détaillée

### Documents principaux

- **[TECHNICAL_DOCUMENTATION.md](TECHNICAL_DOCUMENTATION.md)** — Documentation technique complète
- **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** — Documentation des endpoints API
- **[ARCHITECTURE_AND_WORKFLOWS.md](ARCHITECTURE_AND_WORKFLOWS.md)** — Architecture et workflows métier

### Documentation par module

- **[sgci-backend/README-SGCI.md](sgci-backend/README-SGCI.md)** — Documentation backend
- **[sgci-frontend/README-SGCI.md](sgci-frontend/README-SGCI.md)** — Documentation frontend
- **[sgci-mobile/mobile-vs-emulator/README-SGCI.md](sgci-mobile/mobile-vs-emulator/README-SGCI.md)** — Documentation mobile

### Rapports et analyses

- **[RAPPORT_PROJET_COMPLET_V2.md](RAPPORT_PROJET_COMPLET_V2.md)** — Rapport projet complet v2.0
- **[RAPPORT_AMELIORATION_IA_V2.md](RAPPORT_AMELIORATION_IA_V2.md)** — Amélioration module IA v2.0
- **[ANALYSE_WORKFLOWS_COMPLET.md](ANALYSE_WORKFLOWS_COMPLET.md)** — Analyse workflows métier

---

## 🗺️ Roadmap

### Version 2.0 (Actuelle — Mai 2026)

- ✅ Module IA/Analytics v2.0 avec métriques réelles
- ✅ Prédictions adaptatives avec validation
- ✅ Cross-selling et réapprovisionnement intelligent
- ✅ Notifications push (FCM) implémentées
- ✅ Emails et SMS automatiques implémentés
- ✅ Synchronisation batch offline
- ✅ CI/CD GitHub Actions
- ✅ Tests E2E Playwright

### Version 2.1 (Q3 2026)

- 🔄 Multi-boutiques / Multi-tenant
- 🔄 Tableau de bord avancé avec graphiques interactifs
- 🔄 Gestion des fournisseurs
- 🔄 Commandes fournisseurs automatisées
- 🔄 Rapports personnalisables

### Version 3.0 (Q4 2026)

- 📅 SaaS multi-tenant avec abonnements
- 🤖 Assistant conversationnel IA (Chatbot)
- 📱 Application native iOS/Android
- 🌐 Internationalisation (Français, Anglais)
- 🔐 2FA (Two-Factor Authentication)

### Version 4.0 (2027)

- 🧪 Machine Learning réel pour les prédictions
- 📊 Business Intelligence avancée
- 🔄 Intégration ERP/Comptabilité
- 🌐 Marketplace B2B intégré

---

## 🧪 Tests

### Backend (PHPUnit)

```bash
cd sgci-backend
php artisan test
```

### Frontend (Playwright E2E)

```bash
cd sgci-frontend
npm run test:e2e
```

### Mobile (Expo Tests)

```bash
cd sgci-mobile/mobile-vs-emulator
npm test
```

---

## 🛠️ Développement

### Structure du projet

```
sgci-benin/
├── sgci-backend/          # API Laravel
│   ├── app/
│   │   ├── Http/Controllers/API/
│   │   ├── Models/
│   │   ├── Services/
│   │   ├── Jobs/
│   │   └── Console/Kernel.php
│   ├── database/
│   │   └── migrations/
│   ├── routes/
│   │   └── api.php
│   └── tests/
├── sgci-frontend/         # Dashboard Next.js
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── contexts/
│   │   └── lib/
│   ├── e2e/
│   └── public/
├── sgci-mobile/           # Application Expo
│   └── mobile-vs-emulator/
│       ├── src/
│       │   ├── screens/
│       │   ├── components/
│       │   └── services/
│       └── assets/
├── .github/
│   └── workflows/
│       └── ci-cd.yml
└── docker-compose.yml
```

### Conventions de code

- **Backend**: PSR-12, Laravel conventions
- **Frontend**: ESLint, Prettier, React conventions
- **Mobile**: ESLint, Prettier, React Native conventions
- **Git**: Conventional Commits

---

## 📞 Support

### Documentation

- 📖 [Documentation technique](TECHNICAL_DOCUMENTATION.md)
- 📖 [Documentation API](API_DOCUMENTATION.md)
- 📖 [Architecture & Workflows](ARCHITECTURE_AND_WORKFLOWS.md)

### Contact

- 📧 Email: support@sgci.bj
- 🌐 Site web: https://sgci.bj
- 📱 Téléphone: +229 XX XX XX XX

### Communauté

- 💬 Discord: [SGCI Community](https://discord.gg/sgci)
- 🐛 Issues: [GitHub Issues](https://github.com/votre-organisation/sgci-benin/issues)
- 📝 Wiki: [GitHub Wiki](https://github.com/votre-organisation/sgci-benin/wiki)

---

## 📄 Licence

Copyright © 2025-2026 SGCI Bénin. Tous droits réservés.

---

## 🙏 Remerciements

- Laravel Community
- Next.js Team
- Expo Team
- shadcn/ui
- Tous les contributeurs du projet

---

**SGCI Bénin — L'intelligence commerciale réinventée** 🚀
