# SGCI Bénin — Mobile (Expo)

## Démarrage

```bash
cd sgci-mobile/mobile-vs-emulator
npm install
cp .env.example .env
npx expo start
```

`EXPO_PUBLIC_API_URL` = URL de l’API (ex. `http://192.168.x.x:8000/api` sur téléphone).

## Écrans

| Route | Fonction |
|-------|----------|
| `(tabs)/index` | Dashboard + notifications |
| `(tabs)/caisse` | Vente, scan, hors-ligne, PDF, historique |
| `(tabs)/produits` | CRUD + upload image |
| `(tabs)/clients` | CRM |
| `(tabs)/stock` | Historique mouvements |
| `(tabs)/arrivage` | Saisie arrivages |
| `(tabs)/analytics` | Stats + export |
| `(tabs)/ia` | Assistant stock |
| `(tabs)/parametres` | Profil, boutique API, équipe (gérant) |

## Parité API v1.2

- `POST /ventes` + paiements
- `POST /ventes/{id}/annuler`
- `GET /ventes/{id}/facture/pdf`
- `GET /produits/code/{code}` (scanner)
- `POST /produits/{id}/image`
- File caisse hors-ligne (`lib/offline-caisse.ts`)
- Notifications (`/notifications/*`)
