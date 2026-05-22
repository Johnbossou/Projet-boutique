# SGCI Bénin — Système de gestion commerciale

Application complète pour une boutique au Bénin : **API Laravel**, **dashboard web Next.js**, **application mobile Expo**.

| Module | Dossier | Stack |
|--------|---------|-------|
| API | `sgci-backend` | Laravel 12, Sanctum, MySQL/SQLite |
| Web | `sgci-frontend` | Next.js 15, React 19, Tailwind 4, shadcn |
| Mobile | `sgci-mobile/mobile-vs-emulator` | Expo 54, React Native |

**Version documentée : v1.2** (mai 2026)

---

## Description

SGCI (Système de Gestion Commerciale Intelligente) couvre le cycle boutique :

- **Caisse** : ventes, paiements (espèces, mobile money, carte), scan code-barres, file hors-ligne, annulation dans un délai configurable, facture PDF
- **Produits & catégories** : CRUD, alertes stock, upload image, recherche par code
- **Stock** : mouvements, arrivages en attente, validation gérant
- **Clients** : fiche, VIP, historique commandes, export
- **Analytics** : CA, ventes, top produits, alertes stock, export JSON/PDF
- **IA** : prévisions et recommandations **statistiques** (pas de ML entraîné)
- **Équipe** : gérant / caissier, comptes actifs/inactifs, paramètres boutique centralisés
- **Notifications** : cloche in-app (alertes stock, sync gérant)
- **Thème** : mode **jour** (clair) et **nuit** (sombre) sur web et mobile

---

## Démarrage rapide

### 1. Backend

```powershell
cd sgci-backend
composer install
copy .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

API : `http://127.0.0.1:8000/api` — santé : `GET /api/health`

### 2. Frontend web

```powershell
cd sgci-frontend
npm install
copy .env.local.example .env.local
npm run dev
```

Web : `http://localhost:3000`

### 3. Mobile

```powershell
cd sgci-mobile/mobile-vs-emulator
npm install
copy .env.example .env
npx expo start
```

Configurer `EXPO_PUBLIC_API_URL` (ex. `http://10.0.2.2:8000/api` sur émulateur Android).

### Comptes démo

| Email | Mot de passe | Rôle |
|-------|--------------|------|
| `gerant@sgci.bj` | `password` | Gérant |
| `caissier@sgci.bj` | `password` | Caissier |

---

## Fonctionnalités par plateforme

| Fonctionnalité | API | Web | Mobile |
|----------------|-----|-----|--------|
| Auth + rôles | ✅ | ✅ | ✅ |
| Refresh token `POST /refresh` | ✅ | ✅ | ✅ |
| Caisse / ventes / paiements | ✅ | ✅ | ✅ |
| Annulation vente (délai API) | ✅ | ✅ | ✅ |
| Scan code-barres | ✅ | ✅ | ✅ |
| Caisse hors-ligne + sync | — | ✅ (localStorage) | ✅ (AsyncStorage) |
| Facture PDF | ✅ | ✅ | ✅ |
| Produits + image | ✅ | ✅ | ✅ |
| Stock / arrivage | ✅ | ✅ | ✅ |
| Scan arrivage | ✅ | ⚠️ | ✅ |
| Clients / VIP | ✅ | ✅ | ✅ |
| Analytics + export | ✅ | ✅ | ✅ |
| Paramètres boutique | ✅ | ✅ | ✅ |
| Gestion équipe (gérant) | ✅ | ✅ | ✅ |
| Notifications in-app | ✅ | ✅ | ✅ |
| Mode jour / nuit | — | ✅ | ✅ |
| Push FCM / email auto | ❌ | ❌ | ❌ |
| ML réel (IA) | ❌ | stats | stats |

---

## Thème jour / nuit

- **Web** : `next-themes`, bouton soleil/lune dans la barre, interrupteur dans Paramètres → Interface. Préférence stockée (`sgci-theme` + `sgci_user_preferences`).
- **Mobile** : `SgciThemeProvider`, interrupteur « Mode sombre » dans Paramètres, `StatusBar` adaptée.

---

## Documentation détaillée

- [sgci-backend/README-SGCI.md](sgci-backend/README-SGCI.md)
- [sgci-frontend/README-SGCI.md](sgci-frontend/README-SGCI.md)
- [sgci-mobile/mobile-vs-emulator/README-SGCI.md](sgci-mobile/mobile-vs-emulator/README-SGCI.md)
- [AUDIT-PROJET.md](AUDIT-PROJET.md) — état honnête et limites connues

---

## Vérification technique

```powershell
cd sgci-backend
php artisan test

cd ..\sgci-frontend
npm run build
```

---

## Ce qui n’est pas « 100 % produit commercial »

Volontairement hors scope ou non testé en prod :

- Notifications **push** (FCM) et emails automatiques
- **Multi-boutiques** / SaaS multi-tenant
- **CI/CD**, Docker, déploiement VPS documenté
- **Tests E2E** Playwright / Detox
- **Imprimante thermique** Bluetooth (non intégrée)
- **Vrai modèle ML** pour le module IA

Pour un **pilote boutique réel** (caisse, stock, équipe, rapports), le socle est **complet et cohérent** entre les trois clients.
