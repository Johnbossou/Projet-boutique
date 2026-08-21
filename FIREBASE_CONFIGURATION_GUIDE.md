# 📱 Guide de Configuration Firebase - SGCI Bénin

**Version**: 2.0  
**Date**: Juin 2026  
**Objectif**: Configurer Firebase Cloud Messaging (FCM) pour les notifications push

---

## 📋 Table des matières

- [Prérequis](#prérequis)
- [Création du projet Firebase](#création-du-projet-firebase)
- [Configuration du backend Laravel](#configuration-du-backend-laravel)
- [Configuration du frontend Next.js](#configuration-du-frontend-nextjs)
- [Configuration de l'application mobile Expo](#configuration-de-lapplication-mobile-expo)
- [Test des notifications](#test-des-notifications)
- [Dépannage](#dépannage)

---

## 🎯 Prérequis

### Compte requis
- Un compte Google (Gmail)
- Accès à la [Firebase Console](https://console.firebase.google.com/)

### Informations nécessaires
- Nom du projet SGCI
- Package ID de l'application mobile (ex: com.sgci.benin)
- SHA-1 et SHA-256 de la signature de l'app (pour Android)

---

## 🔥 Création du projet Firebase

### 1. Créer un nouveau projet

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Cliquez sur "Ajouter un projet" ou "Create a project"
3. Nommez le projet: `SGCI-Benin-Production`
4. Activez Google Analytics (recommandé)
5. Cliquez sur "Créer le projet"

### 2. Ajouter une application Android

1. Dans le projet Firebase, cliquez sur l'icône Android
2. **Package name**: `com.sgci.benin` (ou votre package réel)
3. **App nickname**: `SGCI Mobile`
4. **Debug signing certificate**: Laissez vide pour l'instant
5. Cliquez sur "Enregistrer l'application"

### 3. Télécharger le fichier config

1. Téléchargez `google-services.json`
2. Placez-le dans `sgci-mobile/mobile-vs-emulator/android/app/`

### 4. Ajouter une application iOS (optionnel)

1. Cliquez sur l'icône iOS
2. **Bundle ID**: `com.sgci.benin`
3. **App name**: `SGCI Mobile`
4. Cliquez sur "Enregistrer l'application"
5. Téléchargez `GoogleService-Info.plist`
6. Placez-le dans `sgci-mobile/mobile-vs-emulator/ios/`

### 5. Activer Cloud Messaging

1. Allez dans "Project Settings" (engrenage)
2. Onglet "Cloud Messaging"
3. Activez "Cloud Messaging API (V1)"
4. Notez le **Server Key** et **Sender ID**

---

## ⚙️ Configuration du Backend Laravel

### 1. Installer le package Firebase Laravel

Le package `kreait/laravel-firebase` est déjà dans `composer.json`.

### 2. Obtenir les credentials du compte de service

1. Allez dans [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez votre projet Firebase
3. Allez dans "IAM & Admin" > "Service Accounts"
4. Cliquez sur "Create Service Account"
5. Nom: `firebase-admin-sdk`
6. Rôle: `Project Owner` ou `Firebase Admin SDK Administrator Service Agent`
7. Cliquez sur "Create and Continue"
8. Cliquez sur "Done"
9. Cliquez sur le compte créé
10. Onglet "Keys"
11. Cliquez sur "Add Key" > "Create New Key"
12. Format: **JSON**
13. Cliquez sur "Create"
14. Téléchargez le fichier JSON

### 3. Configurer les variables d'environnement

Ouvrez votre fichier `.env` dans `sgci-backend/` et ajoutez:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=sgci-benin-production
FIREBASE_PRIVATE_KEY_ID=xxxxxxxxxxxxxxxx
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@sgci-benin-production.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=xxxxxxxxxxxxxxxx
FIREBASE_AUTH_URI=https://oauth2.googleapis.com/token
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40sgci-benin-production.iam.gserviceaccount.com

# FCM Settings
FCM_TTL=3600
FCM_PRIORITY=high
FCM_DRY_RUN=false
```

**Important**: 
- Copiez les valeurs directement depuis le fichier JSON téléchargé
- La clé privée doit être sur une seule ligne avec `\n` pour les sauts de ligne
- N'ajoutez PAS de guillemets supplémentaires autour de la clé privée

### 4. Tester la configuration

```bash
cd sgci-backend
php artisan tinker
```

Dans Tinker:
```php
use Kreait\Firebase\Factory;
use Kreait\Firebase\Messaging\CloudMessage;

$factory = (new Factory)->withServiceAccount(base_path('service-account.json'));
$messaging = $factory->createMessaging();

$message = CloudMessage::withTarget('token', 'YOUR_DEVICE_TOKEN')
    ->withNotification(['title' => 'Test', 'body' => 'Notification test']);

$messaging->send($message);
```

---

## 🌐 Configuration du Frontend Next.js

### 1. Ajouter les variables d'environnement

Dans `sgci-frontend/.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=sgci-benin-production.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=sgci-benin-production
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=sgci-benin-production.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxxxxxxxxxxx
NEXT_PUBLIC_FIREBASE_APP_ID=1:xxxxxxxxxxxx:web:xxxxxxxxxxxx
```

Ces valeurs se trouvent dans:
- Firebase Console > Project Settings > General > Your apps > Web app

### 2. Installer Firebase SDK (si nécessaire)

```bash
cd sgci-frontend
npm install firebase
```

### 3. Créer un fichier de configuration Firebase

Créez `sgci-frontend/src/lib/firebase.ts`:

```typescript
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const messaging = getMessaging(app);

export const requestNotificationPermission = async () => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.log('This browser does not support desktop notification');
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    const token = await getToken(messaging, {
      vapidKey: 'YOUR_VAPID_KEY_FROM_FIREBASE_CONSOLE',
    });
    return token;
  }
  return null;
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });

export { app, messaging };
```

---

## 📱 Configuration de l'Application Mobile Expo

### 1. Installer les dépendances

```bash
cd sgci-mobile/mobile-vs-emulator
npx expo install expo-notifications
```

### 2. Configurer app.json

Dans `sgci-mobile/mobile-vs-emulator/app.json`:

```json
{
  "expo": {
    "name": "SGCI Mobile",
    "slug": "sgci-mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.sgci.benin",
      "googleServicesFile": "./GoogleService-Info.plist"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.sgci.benin",
      "googleServicesFile": "./google-services.json"
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-notifications"
    ]
  }
}
```

### 3. Implémenter les notifications

Dans votre code React Native:

```typescript
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configuration des notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Demander les permissions
const registerForPushNotificationsAsync = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    alert('Failed to get push token for push notification!');
    return;
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  console.log('Push token:', token);
  
  // Envoyer le token à votre backend
  await apiFetch('/fcm/tokens', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });

  return token;
};
```

---

## 🧪 Test des notifications

### 1. Tester depuis Firebase Console

1. Allez dans Firebase Console > Cloud Messaging
2. Cliquez sur "Send your first message"
3. Remplissez:
   - **Title**: "Test SGCI"
   - **Body**: "Ceci est un test de notification"
4. Cible: "User segment" > "App" > "Votre app"
5. Cliquez sur "Send message"

### 2. Tester depuis le backend

```bash
cd sgci-backend
php artisan tinker
```

```php
use App\Services\FcmService;

$fcmService = new FcmService();
$fcmService->sendNotification(
    'USER_FCM_TOKEN',
    'Test Notification',
    'Ceci est un test depuis Laravel'
);
```

### 3. Tester depuis l'API

```bash
curl -X POST http://localhost:8000/api/fcm/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

---

## 🔧 Dépannage

### Erreur: "Invalid credentials"

**Cause**: Les credentials Firebase sont incorrects ou mal formatés

**Solution**:
1. Vérifiez que toutes les variables d'environnement sont correctement copiées
2. Assurez-vous que la clé privée est sur une seule ligne avec `\n`
3. Régénérez la clé de service si nécessaire

### Erreur: "Messaging not initialized"

**Cause**: Firebase n'est pas correctement initialisé

**Solution**:
1. Vérifiez que `firebase/app` est importé correctement
2. Assurez-vous que la configuration est correcte
3. Vérifiez que vous n'initialisez Firebase qu'une seule fois

### Erreur: "Permission denied"

**Cause**: L'utilisateur n'a pas autorisé les notifications

**Solution**:
1. Vérifiez que vous demandez la permission au bon moment
2. Assurez-vous que le contexte est sécurisé (HTTPS ou localhost)
3. Vérifiez les paramètres du navigateur

### Notifications non reçues sur mobile

**Cause**: Plusieurs raisons possibles

**Solution**:
1. Vérifiez que le token FCM est correctement enregistré
2. Assurez-vous que l'app est en arrière-plan ou fermée
3. Vérifiez les paramètres de notification de l'app
4. Testez avec Firebase Console pour isoler le problème

---

## 📚 Ressources utiles

- [Firebase Documentation](https://firebase.google.com/docs)
- [Cloud Messaging Guide](https://firebase.google.com/docs/cloud-messaging)
- [Laravel Firebase Package](https://github.com/kreait/laravel-firebase)
- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)

---

## ✅ Checklist de configuration

- [ ] Projet Firebase créé
- [ ] Application Android ajoutée
- [ ] Application iOS ajoutée (si applicable)
- [ ] Cloud Messaging activé
- [ ] Compte de service créé
- [ ] Clé privée téléchargée
- [ ] Variables d'environnement configurées (backend)
- [ ] Variables d'environnement configurées (frontend)
- [ ] app.json configuré (mobile)
- [ ] google-services.json placé (Android)
- [ ] GoogleService-Info.plist placé (iOS)
- [ ] Notifications testées depuis Firebase Console
- [X] Notifications testées depuis le backend
- [X] Notifications testées depuis l'API

---

**Fin du guide de configuration Firebase**
