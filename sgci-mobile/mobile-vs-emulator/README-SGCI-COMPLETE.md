# 📱 SGCI Mobile - Application Native

> **Version**: 1.0.0  
> **Développeur**: Josué BOSSOU  
> **Framework**: Expo SDK 54  
> **Statut**: Production-Ready

---

## 📋 Table des Matières

- [Présentation](#présentation)
- [Stack Technique](#stack-technique)
- [Fonctionnalités](#fonctionnalités)
- [Installation](#installation)
- [Configuration](#configuration)
- [Structure du Projet](#structure-du-projet)
- [Développement](#développement)
- [Build et Déploiement](#build-et-déploiement)
- [Dépannage](#dépannage)

---

## 🎯 Présentation

SGCI Mobile est l'application native de caisse portable pour le système SGCI Bénin. Elle permet aux caissiers de :

- Enregistrer des ventes avec scan code-barres
- Gérer les stocks en temps réel
- Consulter les analytics et prédictions IA
- Travailler hors-ligne avec synchronisation automatique

---

## 💻 Stack Technique

### Framework
- **Expo SDK**: 54.0.29
- **React Native**: 0.81.5
- **React**: 19.1.0
- **TypeScript**: 5.9.2

### Navigation
- **Expo Router**: 6.0.19 (File-based routing)
- **React Navigation**: 7.x

### Storage & Sécurité
- **AsyncStorage**: Stockage local offline
- **Expo SecureStore**: Stockage sécurisé des tokens
- **Expo Camera**: Scan QR/Barcode

### Autres
- **Axios**: Client HTTP
- **Expo Notifications**: Push notifications
- **Expo Print**: Impression factures
- **Lucide React Native**: Icônes

---

## ✨ Fonctionnalités

### 🛒 Caisse
- Scan code-barres produits
- Panier dynamique
- Modes de paiement (Espèces, Mobile Money, Carte)
- Calcul automatique monnaie rendue
- Gestion remises
- Facturation PDF

### 📦 Produits
- Recherche produits
- Consultation stock
- Alertes stock
- Scan QR/Barcode

### 👥 Clients
- Recherche clients
- Consultation historique
- Gestion VIP

### 📊 Analytics
- KPIs en temps réel
- Graphiques ventes
- Top produits
- Alertes stock

### 🤖 IA
- Prédictions demande
- Recommandations
- Cross-selling

### 🔄 Offline
- File d'attente locale
- Synchronisation automatique
- Gestion conflits

---

## 🚀 Installation

### Prérequis

- **Node.js**: 18+ avec npm
- **Expo CLI**: `npm install -g expo-cli`
- **Android Studio** (pour émulateur Android)
- **Xcode** (pour émulateur iOS - macOS uniquement)

### Étapes

```bash
# Naviguer vers le dossier mobile
cd sgci-mobile/mobile-vs-emulator

# Installer les dépendances
npm install

# Créer le fichier .env
copy .env.example .env

# Configurer l'URL API (voir section Configuration)
```

---

## ⚙️ Configuration

### Variables d'Environnement

Créer un fichier `.env` à la racine du projet :

```env
# Pour émulateur Android
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api

# Pour émulateur iOS
EXPO_PUBLIC_API_URL=http://localhost:8000/api

# Pour appareil physique (remplacer par votre IP locale)
EXPO_PUBLIC_API_URL=http://192.168.1.XXX:8000/api
```

### Trouver votre IP locale

**Windows**:
```bash
ipconfig
# Chercher "IPv4 Address"
```

**Mac/Linux**:
```bash
ifconfig | grep "inet "
```

---

## 📁 Structure du Projet

```
mobile-vs-emulator/
├── app/                      # Expo Router (file-based routing)
│   ├── (auth)/              # Groupe authentification
│   │   └── login.tsx        # Page de connexion
│   ├── (tabs)/              # Groupe tabs navigation
│   │   ├── _layout.tsx      # Layout des tabs
│   │   ├── index.tsx        # Accueil
│   │   ├── caisse.tsx       # Caisse
│   │   ├── produits.tsx     # Produits
│   │   ├── clients.tsx      # Clients
│   │   ├── analytics.tsx    # Analytics
│   │   ├── ia.tsx           # IA/Prédictions
│   │   ├── parametres.tsx   # Paramètres
│   │   ├── arrivage.tsx     # Arrivages
│   │   └── stock.tsx        # Stock
│   ├── _layout.tsx          # Root layout
│   └── modal.tsx            # Modal global
├── components/              # Composants React
│   ├── AuthGuard.tsx        # Guard authentification
│   ├── BarcodeScannerModal.tsx
│   ├── BoutiqueSelector.tsx
│   ├── NotificationBell.tsx
│   ├── ui/                  # Composants UI
│   └── ...
├── contexts/                # React Context
│   ├── AuthContext.tsx      # Contexte authentification
│   └── ThemeContext.tsx     # Contexte thème
├── lib/                     # Utilitaires
│   ├── api/                 # Services API
│   │   ├── produits.ts
│   │   ├── ventes.ts
│   │   ├── clients.ts
│   │   ├── analytics.ts
│   │   └── index.ts
│   ├── api-client.ts        # Client HTTP avec refresh token
│   ├── boutique-settings.ts
│   ├── offline-caisse.ts
│   └── ...
├── services/                # Services métier
│   ├── BackgroundSyncService.ts
│   ├── NotificationService.ts
│   └── OfflineStorageService.ts
├── types/                   # Types TypeScript
│   └── index.ts
├── constants/               # Constantes
│   ├── api.ts
│   └── theme.ts
├── hooks/                   # Custom hooks
│   └── use-color-scheme.ts
├── assets/                  # Assets (images, icônes)
├── app.json                 # Configuration Expo
├── package.json             # Dépendances
├── tsconfig.json            # Configuration TypeScript
└── .env                     # Variables environnement
```

---

## 🔨 Développement

### Démarrer le serveur de développement

```bash
npm start
```

Ou avec Expo CLI :
```bash
npx expo start
```

### Options de démarrage

```bash
# Émulateur Android
npm run android
# ou
npx expo start --android

# Émulateur iOS (macOS uniquement)
npm run ios
# ou
npx expo start --ios

# Web
npm run web
# ou
npx expo start --web
```

### Scanner le QR Code

1. Démarrer le serveur : `npm start`
2. Scanner le QR code avec :
   - **Android** : App Expo Go
   - **iOS** : App Expo Go

### Linting

```bash
npm run lint
```

---

## 📦 Build et Déploiement

### Build Android (APK)

```bash
# Build pour développement
eas build --profile development --platform android

# Build pour production
eas build --profile production --platform android
```

### Build iOS (IPA)

```bash
# Build pour développement
eas build --profile development --platform ios

# Build pour production
eas build --profile production --platform ios
```

### Configuration EAS

Ajouter `eas.json` à la racine :

```json
{
  "cli": {
    "version": ">= 5.2.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "ios": {
        "autoIncrement": true
      },
      "android": {
        "autoIncrement": true
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

---

## 🔧 Dépannage

### Problème de connexion API

**Symptôme**: Erreur de connexion au backend

**Solutions**:
1. Vérifier que le backend Laravel est démarré : `php artisan serve`
2. Vérifier l'URL API dans `.env`
3. Pour appareil physique, utiliser l'IP locale du PC
4. Pour émulateur Android, utiliser `http://10.0.2.2:8000/api`
5. Désactiver le firewall si nécessaire

### Problème de scan code-barres

**Symptôme**: La caméra ne s'ouvre pas

**Solutions**:
1. Vérifier les permissions dans `app.json`
2. Sur Android : Permissions dans Settings > Apps > Expo
3. Sur iOS : Permissions dans Settings > Expo

### Problème de stockage offline

**Symptôme**: Données non sauvegardées hors-ligne

**Solutions**:
1. Vérifier AsyncStorage : `AsyncStorage.getAllKeys()`
2. Vérifier OfflineStorageService
3. Consulter les logs dans l'app

### Problème de navigation

**Symptôme**: Navigation ne fonctionne pas

**Solutions**:
1. Vérifier Expo Router configuration
2. Vérifier les noms de fichiers dans `app/`
3. Consulter la documentation Expo Router

### Reset du projet

```bash
npm run reset-project
```

---

## 📚 Documentation Complémentaire

- [Expo Documentation](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [React Native](https://reactnative.dev/)
- [TypeScript](https://www.typescriptlang.org/)

---

## 🤝 Contribution

Ce projet est développé par Josué BOSSOU. Pour toute contribution ou question, contacter :

- **Email**: support@sgci.bj
- **Site**: https://sgci.bj

---

## 📄 Licence

Copyright © 2025-2026 SGCI Bénin. Tous droits réservés.

---

**SGCI Bénin — L'intelligence commerciale réinventée** 🚀
