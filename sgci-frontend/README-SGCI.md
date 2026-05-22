# SGCI Bénin — Frontend Web

Dashboard Next.js 15 connecté à l’API Laravel (`sgci-backend`).

## Démarrage

```bash
cd sgci-frontend
npm install
cp .env.local.example .env.local   # si présent, sinon créer :
# NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

## Comptes démo

- Gérant : `gerant@sgci.bj` / `password`
- Caissier : `caissier@sgci.bj` / `password`

## Pages

| Route | Description |
|-------|-------------|
| `/dashboard` | Vue d’ensemble |
| `/produits` | Catalogue + catégories |
| `/stock` | Historique mouvements (validation gérant) |
| `/arrivage` | Saisie arrivages |
| `/caisse` | Point de vente, paiements, annulation |
| `/clients` | CRM clients |
| `/analytics` | Rapports + export PDF/JSON |
| `/ia` | Assistant stock & promos |
| `/parametres` | Profil, boutique (API), équipe (gérant) |

## Thème jour / nuit

- Bouton soleil/lune dans la barre (`ThemeToggle`)
- Paramètres → Interface : interrupteur mode nuit
- Stockage : `localStorage` (`sgci-theme` + préférences utilisateur)

## Alignement API v1.2

- Paiements vente : `mode_paiement`, `montant_recu`, etc. → `POST /ventes`
- Annulation : `POST /ventes/{id}/annuler` (délai depuis `/boutique/settings`)
- Paramètres boutique : `GET/PUT /boutique/settings`
- Gestion utilisateurs (gérant) : onglet **Équipe** dans Paramètres

## Backend requis

```bash
cd ../sgci-backend
php artisan migrate --seed
php artisan serve
```
