# Guide de Déploiement SGCI Bénin

## Vue d'ensemble

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Vercel     │────▶│  Laravel Forge   │────▶│  MySQL       │
│  Frontend   │     │  Backend API     │     │  (PlanetScale│
│  (Next.js)  │     │  (Laravel 12)    │     │   ou VPS)    │
└─────────────┘     └──────────────────┘     └──────────────┘
                           │
                    ┌──────┴──────┐
                    │  Redis      │
                    │  (cache)    │
                    └─────────────┘
```

---

## ÉTAPE 1 — Préparer la base de données

### Option A : PlanetScale (recommandé, gratuit)

1. Créer un compte sur [planetscale.com](https://planetscale.com)
2. Créer un database `sgci-benin`
3. Copier la **connection string** :
   ```
   mysql://username:password@aws.connect.psdb.cloud/sgci?ssl={"rejectUnauthorized":true}
   ```
4. Noter les credentials pour plus tard

### Option B : MySQL sur le VPS (via Forge)

Forge installe MySQL automatiquement. Noter les credentials dans la card du serveur.

---

## ÉTAPE 2 — Déployer le Backend (Laravel Forge)

### 2.1 Créer le serveur

1. Aller sur [forge.laravel.com](https://forge.laravel.com)
2. Cliquer **"New Server"** → choisir **DigitalOcean** (ou autre provider)
3. Choisir le plan (Basic $12/mois suffit pour commencer)
4. Région : **Amsterdam** ou **Paris** (proche du Bénin)
5. Attendre la création (~5 min)

### 2.2 Créer le site

1. Dans la card du serveur, cliquer **"New Site"**
2. **Repository** : `Johnbossou/Projet-boutique`
3. **Branch** : `main`
4. **Root Directory** : `/` (le repo a la structure mono-repo)
5. **PHP Version** : 8.2
6. Cliquer **"Add Site"**

### 2.3 Configurer les variables d'environnement

Dans la card du site → **"Environment"** → Ajouter :

```env
APP_NAME="SGCI Bénin"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://sgci-api.yourdomain.com

APP_KEY=base64:...  # (généré automatiquement par Forge)

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=sgci
DB_USER=forge
DB_PASSWORD=...  # (Forge gère ça)

# OU PlanetScale :
# DB_CONNECTION=mysql
# DB_HOST=aws.connect.psdb.cloud
# DB_DATABASE=sgci
# DB_USERNAME=...
# DB_PASSWORD=...

SESSION_DRIVER=database
QUEUE_CONNECTION=database
CACHE_STORE=redis

SANCTUM_STATEFUL_DOMAINS=sgci.yourdomain.com,localhost
SESSION_DOMAIN=sgci.yourdomain.com

# Sécurité
SGCI_TOKEN_TTL_MINUTES=120
MOBILE_MONEY_CALLBACK_SECRET=votre_secret_hmac_içi
BCRYPT_ROUNDS=12

# CORS (le frontend Vercel)
FRONTEND_URL=https://sgci.yourdomain.com

# SMS
SMS_ENABLED=false
SMS_SIMULATION=true

# Mobile Money
MTN_MOMO_BASE_URL=https://proxy.momoapi.mtn.com
MTN_MOMO_TARGET_ENV=production
ORANGE_MONEY_BASE_URL=https://api.orange.com/orange-money-webpay/ben
```

### 2.4 Configurer le deploy script

Dans la card du site → **"Deploy"** → **"Deploy Script"** :

```bash
cd /home/forge/sgci.yourdomain.com

composer install --no-interaction --prefer-dist --optimize-autoloader --no-dev

php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

php artisan migrate --force

php artisan storage:link 2>/dev/null || true

php artisan queue:restart
```

### 2.5 Activer le SSL

1. Dans la card du site → **"SSL"** → **"HTTPS"**
2. Cliquer **"Obtain Certificate"** (Let's Encrypt, gratuit)
3. Activer **"Force HTTPS"**

### 2.6 Configurer le cron

Dans la card du site → **"Scheduler"** :
```
* * * * * cd /home/forge/sgci.yourdomain.com && php artisan schedule:run >> /dev/null 2>&1
```

### 2.7 Configurer la queue

Dans la card du serveur → **"Queue Workers"** :
- Command : `php artisan queue:work --sleep=3 --tries=3 --max-time=3600`
- Connections : `database`
- Max processes : 3

---

## ÉTAPE 3 — Déployer le Frontend (Vercel)

### 3.1 Connecter le repo

1. Aller sur [vercel.com](https://vercel.com)
2. Cliquer **"Add New Project"**
3. Importer `Johnbossou/Projet-boutique`
4. **Framework Preset** : Next.js
5. **Root Directory** : `sgci-frontend`
6. Cliquer **"Deploy"**

### 3.2 Variables d'environnement

Dans Settings → **"Environment Variables"** :

```
NEXT_PUBLIC_API_URL=https://sgci-api.yourdomain.com/api
```

### 3.3 Custom domain (optionnel)

Dans Settings → **"Domains"** :
1. Ajouter `sgci.yourdomain.com`
2. Configurer le DNS chez ton registrar :
   ```
   CNAME  sgci.yourdomain.com  cname.vercel-dns.com
   ```

---

## ÉTAPE 4 — Configurer le Mobile (EAS Build)

### 4.1 Installer EAS CLI

```bash
npm install -g eas-cli
eas login
```

### 4.2 Configurer le projet

```bash
cd sgci-mobile/mobile-vs-emulator
eas init
eas build:configure
```

### 4.3 Variables d'environnement

Créer `.env.production` :
```bash
EXPO_PUBLIC_API_URL=https://sgci-api.yourdomain.com/api
```

### 4.4 Build

```bash
# Android
eas build --platform android --profile production

# iOS
eas build --platform ios --profile production
```

### 4.5 Publier sur les stores

```bash
# Google Play
eas submit --platform android

# App Store
eas submit --platform ios
```

---

## ÉTAPE 5 — Configurer le DNS

Une fois le domaine acheté :

| Type | Host | Value | TTL |
|---|---|---|---|
| A | `@` | IP du VPS Forge | 3600 |
| A | `api` | IP du VPS Forge | 3600 |
| CNAME | `www` | `cname.vercel-dns.com` | 3600 |
| CNAME | `sgci` | `cname.vercel-dns.com` | 3600 |

Résultat :
- `sgci.yourdomain.com` → Frontend Vercel
- `sgci-api.yourdomain.com` → Backend Forge
- `www.sgci.yourdomain.com` → Frontend Vercel

---

## ÉTAPE 6 — Mobile Money en production

### MTN MoMo

1. Créer un compte sur [momodeveloper.mtn.com](https://momodeveloper.mtn.com)
2. Souscrire au **Collection API** pour le Bénin
3. Obtenir : `subscription_key`, `api_user`, `api_key`
4. Configurer le callback URL : `https://sgci-api.yourdomain.com/api/mobile-money/callback`
5. Mettre à jour `MTN_MOMO_TARGET_ENV=production`

### Orange Money

1. Créer un compte sur [developer.orange.com](https://developer.orange.com)
2. Activer **Orange Money Web Payment** pour le Bénin
3. Obtenir : `client_id`, `client_secret`, `merchant_key`
4. Configurer le callback URL : `https://sgci-api.yourdomain.com/api/mobile-money/callback`

### IMPORTANT : HMAC Secret

```bash
# Générer un secret fort :
openssl rand -hex 32
# → Mettre le résultat dans MOBILE_MONEY_CALLBACK_SECRET
```

---

## ÉTAPE 7 — Vérifications post-déploiement

```bash
# 1. Backend accessible ?
curl https://sgci-api.yourdomain.com/api/me

# 2. Login fonctionne ?
curl -X POST https://sgci-api.yourdomain.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"proprietaire@sgci.bj","password":"password"}'

# 3. Frontend accessible ?
curl -I https://sgci.yourdomain.com

# 4. CORS fonctionne ?
curl -I -H "Origin: https://sgci.yourdomain.com" \
  -X OPTIONS https://sgci-api.yourdomain.com/api/me
```

---

## Coûts estimés

| Service | Plan | Coût/mois |
|---|---|---|
| DigitalOcean VPS | Basic 2GB | ~$12 |
| Vercel | Hobby | Gratuit |
| PlanetScale | Scaler | ~$29 (ou free tier) |
| Let's Encrypt SSL | — | Gratuit |
| EAS Build | Free tier | ~$0 (limité) |
| Domaine (.com) | — | ~$10/an |
| **Total** | | **~$12-41/mois** |

---

## Rollback

En cas de problème :

```bash
# Forge : revenir au commit précédent
cd /home/forge/sgci.yourdomain.com
git log --oneline -5  # trouver le bon commit
git reset --hard <commit-hash>
composer install --no-dev
php artisan migrate:rollback
php artisan config:cache
```

Vercel : chaque deploy est un preview. Le dashboard permet de "Promote to Production" n'importe quel deploy précédent.
