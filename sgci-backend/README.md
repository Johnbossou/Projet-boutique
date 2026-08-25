# SGCI Backend API

Système de Gestion Commerciale Intelligente — Backend API Laravel 12

## Tech Stack

- **PHP 8.2+** / **Laravel 12.x**
- **MySQL 8** ou **SQLite** (tests)
- **Laravel Sanctum** (auth API + httpOnly cookies)
- **DomPDF** (génération PDF factures/devis)
- **Laravel Reverb** (WebSocket temps réel, optionnel)

## Installation

```bash
git clone https://github.com/Johnbossou/Projet-boutique.git
cd Projet-boutique/sgci-backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

Tests :
```bash
php artisan test
# OU avec SQLite :
$env:DB_CONNECTION='sqlite'; $env:DB_DATABASE="$PWD\database\database.sqlite"; php artisan test
```

## Comptes de test (seeder)

| Email | Mot de passe | Rôle |
|---|---|---|
| proprietaire@sgci.bj | password | propriétaire |
| gerant@sgci.bj | password | gérant |
| caissier@sgci.bj | password | caissier |

## API Endpoints

### Auth
| Méthode | Route | Description |
|---|---|---|
| POST | `/api/login` | Connexion (cookie httpOnly + token JSON) |
| POST | `/api/register` | Inscription |
| POST | `/api/logout` | Déconnexion (clear cookie) |
| POST | `/api/refresh` | Renouveler le token |
| POST | `/api/me` | Profil utilisateur |
| POST | `/api/switch-boutique` | Changer de boutique |
| POST | `/api/forgot-password` | Demander réinitialisation |
| POST | `/api/reset-password` | Réinitialiser le mot de passe |
| POST | `/api/enable-2fa` | Activer 2FA |
| POST | `/api/confirm-2fa` | Confirmer 2FA |
| POST | `/api/disable-2fa` | Désactiver 2FA (mot de passe requis) |

### Produits
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/produits` | Liste paginée |
| POST | `/api/produits` | Créer (gérant+) |
| GET | `/api/produits/{id}` | Détail |
| PUT | `/api/produits/{id}` | Modifier (gérant+) |
| DELETE | `/api/produits/{id}` | Supprimer (gérant+) |
| POST | `/api/produits/{id}/image` | Upload image |
| GET | `/api/produits/alerte-stock` | Alertes stock |
| GET | `/api/produits/statistiques` | Stats produits |
| GET | `/api/produits/search/{q}` | Recherche |

### Ventes
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/ventes` | Liste paginée |
| POST | `/api/ventes` | Créer une vente |
| GET | `/api/ventes/{id}` | Détail |
| POST | `/api/ventes/{id}/annuler` | Annuler |
| POST | `/api/ventes/{id}/terminer` | Terminer |
| GET | `/api/ventes/aujourdhui/stats` | Stats du jour |
| GET | `/api/ventes/statistiques/general` | Stats globales |

### Clients
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/clients` | Liste paginée |
| POST | `/api/clients` | Créer |
| GET | `/api/clients/{id}` | Détail |
| PUT | `/api/clients/{id}` | Modifier |
| DELETE | `/api/clients/{id}` | Supprimer |
| GET | `/api/clients/search/advanced` | Recherche avancée |
| POST | `/api/clients/{id}/promouvoir-vip` | Promouvoir VIP |
| GET | `/api/clients/statistiques/globales` | Stats clients |

### Commandes clients
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/commandes-clients` | Liste |
| POST | `/api/commandes-clients` | Créer |
| GET | `/api/commandes-clients/{id}` | Détail |
| PUT | `/api/commandes-clients/{id}` | Modifier |
| DELETE | `/api/commandes-clients/{id}` | Supprimer |

### Devis
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/devis` | Liste |
| POST | `/api/devis` | Créer |
| GET | `/api/devis/{id}` | Détail |
| PUT | `/api/devis/{id}` | Modifier |
| DELETE | `/api/devis/{id}` | Supprimer |
| POST | `/api/devis/{id}/accepter` | Accepter |
| POST | `/api/devis/{id}/refuser` | Refuser |
| GET | `/api/devis/{id}/pdf` | Générer PDF |

### Paiements
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/paiements` | Liste |
| POST | `/api/paiements` | Créer |
| GET | `/api/paiements/{id}` | Détail |

### Mobile Money
| Méthode | Route | Description |
|---|---|---|
| POST | `/api/mobile-money/initiate` | Initier paiement |
| GET | `/api/mobile-money/status/{id}` | Statut paiement |
| POST | `/api/mobile-money/cancel/{id}` | Annuler |
| POST | `/api/mobile-money/detect-provider` | Détecter provider |
| POST | `/api/mobile-money/callback` | Callback (HMAC) |

### Retours
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/retours` | Liste |
| POST | `/api/retours` | Créer |
| GET | `/api/retours/{id}` | Détail |
| POST | `/api/retours/{id}/valider` | Valider |
| POST | `/api/retours/{id}/refuser` | Refuser |

### Inventaire physique
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/inventaires` | Liste |
| POST | `/api/inventaires` | Créer session |
| GET | `/api/inventaires/{id}` | Détail |
| POST | `/api/inventaires/{id}/compter` | Enregistrer comptage |
| POST | `/api/inventaires/{id}/valider` | Valider |
| POST | `/api/inventaires/{id}/annuler` | Annuler |
| GET | `/api/inventaires/{id}/ecarts` | Voir écarts |

### Facturation
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/factures` | Liste |
| POST | `/api/factures/generer-vente` | Générer pour une vente |
| POST | `/api/factures/generer-commande` | Générer pour commande client |
| GET | `/api/factures/{id}` | Détail |
| POST | `/api/factures/{id}/envoyer` | Envoyer par email |

### Utilisateurs (gérant+)
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/users` | Liste |
| POST | `/api/users` | Créer |
| GET | `/api/users/{id}` | Détail |
| PUT | `/api/users/{id}` | Modifier |
| DELETE | `/api/users/{id}` | Désactiver |

### Chat
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/conversations` | Liste conversations |
| POST | `/api/conversations` | Créer conversation |
| GET | `/api/conversations/{id}/messages` | Messages |
| POST | `/api/conversations/{id}/messages` | Envoyer message |
| PUT | `/api/messages/{id}` | Modifier message |
| DELETE | `/api/messages/{id}` | Supprimer message |

### Analytics (gérant/propriétaire)
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/analytics/dashboard` | Dashboard complet |
| GET | `/api/analytics/ventes` | Stats ventes |
| GET | `/api/analytics/produits` | Stats produits |
| GET | `/api/analytics/clients` | Stats clients |
| GET | `/api/analytics/stock` | Stats stock |

### IA (gérant/propriétaire)
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/ia/predictions/demande` | Prédictions demande |
| GET | `/api/ia/predictions/reapprovisionnement` | Suggestions réappro |
| GET | `/api/ia/recommandations/promotions` | Recommandations promo |
| GET | `/api/ia/metrics/performance` | Métriques IA |
| POST | `/api/ia/entrainer-modele` | Entraîner modèle |

### Audit Logs (gérant/propriétaire)
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/audit-logs` | Journal d'audit |
| GET | `/api/audit-logs/stats` | Statistiques |
| GET | `/api/audit-logs/export` | Export CSV |

### Notifications
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/notifications` | Liste |
| POST | `/api/notifications/{id}/read` | Marquer lue |
| POST | `/api/notifications/read-all` | Marquer toutes lues |

### Boutique Settings
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/boutique-settings` | Paramètres |
| PUT | `/api/boutique-settings` | Modifier |

### Fidélité
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/fidelite/programme` | Programme actif |
| GET | `/api/fidelite/client/{id}` | Points client |
| GET | `/api/fidelite/recompenses` | Récompenses |
| POST | `/api/fidelite/reclamation` | Réclamer récompense |

## Architecture

```
app/
├── Http/
│   ├── Controllers/API/     28 controllers API
│   ├── Middleware/           SanctumCookieAuth, EnsureUserIsActive, EnsureUserIsGerant, BoutiqueScope...
│   └── Controllers/         AuthController, BaseController
├── Models/                  36 modèles Eloquent
├── Services/                FacturationService, NotificationService, AuditLogService, TwoFactorAuthService...
├── Events/                  5 events WebSocket (ShouldBroadcast)
├── Traits/                  Auditable
database/
├── migrations/              ~30 migrations
└── seeders/                 8 seeders
routes/
├── api.php                  Routes API complètes
├── channels.php             Canaux WebSocket
config/
├── sgci.php                 Config metier (TVA, TTL tokens)
├── sanctum.php              Auth Sanctum (expiration 120min)
```

## Sécurité

- **Auth** : httpOnly cookies (web) + Bearer tokens (mobile), TTL 2h
- **Rate limiting** : login (5/min), callback Mobile Money (30/min)
- **HMAC-SHA256** : callback Mobile Money signé
- **2FA** : TOTP avec mot de passe requis pour désactivation
- **RBAC** : propriétaire > gérant > caissier
- **Audit trail** : toutes les actions sensibles loguées
- **Multi-tenancy** : BoutiqueScopeMiddleware + VerifieBoutique trait
- **CORS** : méthodes explicites, pas de wildcards
- **Security headers** : X-Frame-Options, X-Content-Type, Referrer-Policy, Permissions-Policy
- **Passwords** : bcrypt 12 rounds, min 8 caractères
- **Anti brute-force** : lockout après 5 tentatives

## License

Projet SGCI Bénin — Tous droits réservés.
