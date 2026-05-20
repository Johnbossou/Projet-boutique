# SGCI Bénin — Backend API

API Laravel pour la gestion de boutique (produits, caisse, clients, analytics, IA).

## Installation locale

```bash
cd sgci-backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

API disponible sur : `http://127.0.0.1:8000/api`

## Comptes de démonstration

| Email | Mot de passe | Rôle |
|-------|--------------|------|
| gerant@sgci.bj | password | Gérant |
| caissier@sgci.bj | password | Caissier |

## CORS (web + mobile)

Édite `config/cors.php` et remplace `192.168.1.102` par l’IP de ton PC si tu testes depuis un téléphone sur le même réseau Wi‑Fi.

## Endpoints utiles

- `GET /api/health` — état de l’API (public)
- `POST /api/login` — connexion
- `GET /api/me` — profil connecté
- `PUT /api/me/profile` — modifier nom, email, téléphone
- `PUT /api/me/password` — changer le mot de passe
- Routes protégées : header `Authorization: Bearer {token}`

## Module « Assistant stock & promos » (ex-IA)

- `GET /api/ia/predictions-demande` — besoins stock (ventes 7/30/90 j)
- `GET /api/ia/recommandations-promotions` — promos suggérées (score > 40)
- `GET /api/ia/metrics-performance` — indicateurs
- `POST /api/ia/recalculer-analyses` — recalcul (alias `entrainer-modele`)

Ce n’est pas un modèle ML : assistant statistique basé sur vos ventes terminées.
