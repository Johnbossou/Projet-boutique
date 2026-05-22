# SGCI Bénin — Backend API (v1.1)

API Laravel pour la gestion de boutique : produits, stock, caisse, clients, analytics et assistant stock.

## Installation

```bash
cd sgci-backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

API : `http://127.0.0.1:8000/api`

## Comptes démo

| Email | Mot de passe | Rôle |
|-------|--------------|------|
| gerant@sgci.bj | password | Gérant |
| caissier@sgci.bj | password | Caissier |

## Authentification

- `POST /api/login` — connexion (compte actif requis)
- Header protégé : `Authorization: Bearer {token}`
- `POST /api/logout`, `GET /api/me`, `PUT /api/me/profile`, `PUT /api/me/password`

## Rôles

| Action | Caissier | Gérant |
|--------|----------|--------|
| Ventes, clients, produits (CRUD sauf suppression) | Oui | Oui |
| Supprimer produit / catégorie | Non | Oui |
| Valider / rejeter arrivages stock | Non | Oui |
| Paramètres boutique (écriture) | Non | Oui |
| Gestion utilisateurs | Non | Oui |

Middleware : `role.gerant`, `user.active`

## Ventes

### Vente immédiate (recommandé — caisse web/mobile)

```http
POST /api/ventes
```

Corps exemple :

```json
{
  "ligne_ventes": [{"produit_id": 1, "quantite": 2}],
  "remise": 0,
  "client_id": null,
  "notes": null,
  "mode_paiement": "especes",
  "montant_recu": 5000,
  "numero_transaction": null,
  "reference_carte": null,
  "banque": null
}
```

Modes de paiement : `especes`, `mtn`, `moov`, `carte`.

### Panier en deux temps

1. `POST /api/ventes/checkout` — statut `en_cours`, stock non déduit
2. `POST /api/ventes/{id}/terminer` — finalise et déduit le stock (+ paiement optionnel)

### Annulation

```http
POST /api/ventes/{id}/annuler
```

- Restaure le stock pour une vente `termine`
- Délai configurable via `boutique_settings.delai_annulation_vente_minutes` (défaut : 5 min)
- `DELETE /api/ventes/{id}` — suppression uniquement si statut `annule`

### Autres

- `GET /api/ventes?date=2026-05-21` — historique par jour
- `GET /api/ventes/{id}/facture` — données facture + infos boutique
- `GET /api/ventes/aujourdhui/stats`

## Paramètres boutique

- `GET /api/boutique/settings` — lecture (tous)
- `PUT /api/boutique/settings` — écriture (gérant)

Champs : `nom`, `adresse`, `telephone`, `email`, `devise`, `taux_tva`, `delai_annulation_vente_minutes`

## Utilisateurs (gérant)

- `GET /api/users` — liste (`?role=caissier`, `?actifs_seulement=0`)
- `GET /api/users/caissiers` — caissiers actifs
- `POST /api/users` — créer
- `PUT /api/users/{id}` — modifier / désactiver (`est_actif`)
- `DELETE /api/users/{id}` — désactivation (soft)

## Produits

- CRUD + `image_url` (URL externe)
- `GET /api/produits/alerte-stock`, `/statistiques`, `/search/{term}`

## Mouvements de stock

- `POST /api/mouvements-stock` — créer (souvent `en_attente` pour arrivage)
- `POST .../valider` / `.../rejeter` — gérant uniquement
- `GET .../statistiques`, `.../export`

## Clients, Analytics, IA

Identiques à la v1.0 — voir routes dans `routes/api.php`.

Module IA : assistant statistique (pas de ML).

## Tests

```bash
php artisan test
```

## CORS

Éditer `config/cors.php` pour l’IP LAN du poste de développement (tests mobile).

## Variables optionnelles

```env
SGCI_DELAI_ANNULATION_VENTE=5
SGCI_TAUX_TVA=0.18
```
