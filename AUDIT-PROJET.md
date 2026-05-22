# Audit SGCI Bénin — État du projet (mai 2026, v1.2)

## Verdict global

| Critère | Note | Commentaire |
|---------|------|-------------|
| **MVP production locale** | ✅ ~98 % | Backend + web + mobile alignés sur les flux boutique |
| **Parité web / mobile** | ✅ ~95 % | Stock, arrivage, scan, offline, équipe, thème |
| **Produit commercial SaaS** | ⚠️ ~80 % | Push, CI/CD, multi-tenant, ML réel restent ouverts |

Le projet est **terminé pour un déploiement pilote en boutique** ; il n’est pas un SaaS multi-tenant clé en main.

---

## Réalisé (v1.2)

### Backend

- API REST v1.2, Sanctum, rôles gérant/caissier, comptes inactifs
- Ventes : paiements, annulation, facture HTML/PDF
- Produits : `image_url`, upload, recherche par code
- Mouvements stock (arrivage, validation gérant)
- Boutique settings, utilisateurs, notifications en base
- Analytics, clients, module IA statistique
- **`POST /api/refresh`** — renouvellement de token
- Tests Feature (`php artisan test`)

### Frontend web

- Navigation `AppShell`, toutes les pages métier
- Caisse : paiements, scan, offline, annulation
- Notifications cloche, exports, équipe gérant
- **Thème jour/nuit** (`next-themes` + préférences)

### Mobile

- Onglets : accueil, caisse, produits, clients, stock, arrivage, analytics, IA, paramètres
- Offline caisse + sync, PDF facture, scan caisse **et arrivage**
- Équipe gérant, boutique API, notifications
- **Thème jour/nuit** (`SgciThemeProvider`)

---

## Non fait ou partiel (honnête)

| Sujet | État |
|-------|------|
| Notifications push (FCM) | ❌ |
| Emails/SMS alertes stock automatiques | ❌ (préférences UI seulement) |
| `POST /ventes/sync-offline` batch serveur | ❌ (sync client vente par vente) |
| Scan arrivage web | ⚠️ formulaire manuel |
| Multi-boutiques | ❌ |
| CI/CD, Docker prod | ❌ |
| Tests E2E | ❌ |
| IA = machine learning entraîné | ❌ (heuristiques / stats) |
| Imprimante thermique testée | ❌ |

---

## Matrice de confiance

Les affirmations suivantes sont **vraies** au code actuel :

- Stock et arrivage existent sur mobile
- `NotificationBell` sur web et mobile
- Upload image produit (API + clients)
- PDF facture via API
- Gestion équipe mobile (onglet Paramètres)
- File hors-ligne mobile + web
- Thème clair/sombre web + mobile

Les affirmations **fausses ou exagérées** :

- « Caisse 100 % uniquement via checkout→terminer » — `POST /ventes` est le flux principal
- « Refresh token depuis toujours » — ajouté en v1.2
- « IA = ML production » — non, module statistique

---

## Prochaines étapes recommandées (optionnel)

1. Push notifications (Expo + backend jobs)
2. Pipeline CI (lint, `php artisan test`, `npm run build`)
3. Docker Compose (API + MySQL + front)
4. Endpoint batch sync offline si volume de ventes hors-ligne élevé
