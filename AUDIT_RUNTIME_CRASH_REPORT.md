# Audit Runtime / Crash — SGCI Frontend vs Backend

Audit frontend Next.js (`sgci-frontend/src`) croisé avec les controllers Laravel (`sgci-backend`).
Objectif : trouver les conditions de crash à l'exécution (`.map` sur non-array, champs manquants,
clés de stockage erronées, formes de réponses paginées) et documenter les formes de réponses réelles de l'API.

Date : 2026-09-17 — Audit en lecture seule.

## Résultat global

- CRITIQUE : aucune
- HAUTE : aucune
- MOYENNE : 1 bug fonctionnel (scanner QR/code-barres d'Arrivage ne fonctionne jamais)
- BASSE : 4 points (pagination produits, _count boutiques, cohérence rôle propriétaire, URLs localhost vs 127.0.0.1)

Tous les suspects de crash identifiés en phase 1 ont été vérifiés côté backend et levés :
chaque endpoint renvoie bien la forme attendue par le frontend.

---

## Sévérité MOYENNE

### 1. Scanner QR/code-barres cassé dans Arrivage — mauvaise clé de token
- Fichier : `sgci-frontend/src/components/BarcodeScanner.tsx:108`
- Code :
  ```ts
  const token = localStorage.getItem('token');            // mauvaise clé
  const response = await fetch(`${apiBaseUrl}/produits/code/${code}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  });
  ```
- Partout ailleurs le token est stocké sous `sgci_token` (`src/lib/api-client.ts`, `src/lib/media.ts`, `AuthContext`).
  Ici la clé `'token'` renvoie `null` → envoi de `Authorization: Bearer null` → middleware `auth:sanctum` répond 401.
- Dans `handleDetectedCode` (l.116-123), seuls `response.ok` et `404` sont traités. Un 401 n'est ni l'un ni l'autre →
  aucun feedback, aucune détection. Scan caméra ET saisie manuelle ne fonctionnent jamais dans Arrivage
  (seul usage de BarcodeScanner : `app/arrivage/page.tsx:264`).
- Déclencheur : toute tentative de scan dans `/arrivage`, utilisateur connecté.
- API vérifiée : `GET /produits/code/{code}` → `ProduitController::findByCode` → produit seul ou 404 `{message}` (auth requise).

### 2. (Connexe) Base URL `localhost` vs `127.0.0.1`
- `sgci-frontend/src/app/arrivage/page.tsx:265` :
  `<BarcodeScanner apiBaseUrl={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'} />`
- Le défaut de `api-client.ts` / `media.ts` est `http://127.0.0.1:8000/api`. Sur les machines où `localhost`
  résout en IPv6 (`::1`) alors que PHP sert en IPv4, le scanner pointerait ailleurs que le reste de l'app.
  Pas un crash, mais échec silencieux possible.

---

## Sévérité BASSE

### 3. Pagination Produits inopérante (jamais au-delà de la page 1)
- `sgci-frontend/src/app/produits/page.tsx:217` :
  `if (produitsData.meta) { setPagination({ current_page: produitsData.meta.current_page, ... }); }`
- API : `ProduitController::index` (l.20-62) retourne `response()->json($produits)` → paginateur Laravel brut :
  clés `data`, `current_page`, `last_page`, `total` au premier niveau, PAS de `meta`.
- Conséquence : `produitsData.meta` toujours undefined → pagination jamais mise à jour → reste `1/1` →
  produits des pages 2+ inaccessibles. La liste elle-même (l.214 `produitsData.data || produitsData` + garde
  `Array.isArray`) fonctionne : pas de crash.
- NB : le même `data.meta` fonctionne pour les clients car `ClientController::index` renvoie vraiment un `meta`.

### 4. Totaux `_count` toujours à 0 (pages Boutiques)
- `app/boutiques/page.tsx`, `app/boutiques/[id]/page.tsx`, `app/boutiques/[id]/equipe/page.tsx` lisent
  `boutique._count?.users / produits / ventes`.
- API : `BoutiqueController::index/mesBoutiques` utilise `withCount([...])` → `users_count`, `produits_count`,
  `ventes_count`, jamais l'objet `_count`. Compteurs affichés à 0. Aucun crash.

### 5. Garde `user.role !== 'proprietaire'` = rôle global (cohérent mais restrictif)
- `app/boutiques/page.tsx:123`, `app/boutiques/[id]/page.tsx:111`, `app/boutiques/[id]/equipe/page.tsx:148`.
- API : groupe `/boutiques` protégé par `ProprietaireMiddleware` → `estProprietaire()` = `$this->role === 'proprietaire'`
  (rôle global). Front et back cohérents.
- Mais `User::roleDansBoutique()` (priorité 1 = « possède la boutique ») peut renvoyer `proprietaire` via
  `role_courant` pour un compte dont le rôle global est `gerant`/`caissier`. Menus « propriétaire » affichés
  (via `role_courant`) mais gestion des boutiques bloquée UI + API (403). Piège de permission, pas un crash.

---

## Suspects vérifiés et LEVÉS (phase 1 → vérification backend)

| Page | Ligne suspectée | Controller vérifié | Forme réelle | Verdict |
|---|---|---|---|---|
| approvisionnement | 219 / 645 `commande.lignes.*` | CommandeFournisseurController::index | `{data,total,per_page,current_page,last_page}` + `with('lignes.produit')` | OK lignes présent |
| commandes-fournisseurs | 166/462/496 lignes ; 335 montant_total | idem | lignes eager ; montant_total/paye créés à 0 | SAFE |
| commandes-clients | 318 lignes ; 331 paiements ; 222 montant_paye | CommandeClientController::index | `{data,...}` + `with(['client','devis','user','lignes.produit','paiements'])` ; montant_paye 0 | SAFE |
| retours | 254 `detailOuvert.lignes.map` | RetourVenteController::index | paginateur brut + `with(['vente','user','lignes.produit'])` | OK |
| inventaire | 266 `detail.lignes.map` ; wrap | InventaireController::show (plat) ; compter/valider (`{message,data}`) | `ouvrirDetail`→`setDetail(data)` OK (show plat) ; soumettre→`setDetail(data.data)` OK (wrap) : cohérent avec chaque endpoint | SAFE |
| fournisseurs | pagination data.current_page ; détail .nom | FournisseurController::index/show | clés présentes ; show plat | SAFE |
| clients | `data.meta?.current_page` | ClientController::index | RETOURNE `meta` `{current_page,last_page,per_page,total,from,to}` (+links) | SAFE (la note initiale « raw paginator » était fausse) |
| stock | `/mouvements-stock` `data.data ?? []` | MouvementStockController::index | paginateur brut, data array | SAFE |
| caisse | `/ventes?date=...&per_page=100` | VenteController::index | paginateur brut + garde Array.isArray (caisse l.1303+) | SAFE |
| analytics / ia / parametres / audit-logs / factures / devis / transferts / fidelite / messages / mobile-money / produits (liste) | divers | multi-controllers | toutes les lectures gardées (Array.isArray / `?.data ?? []` / `|| []`) | SAFE |

Vérifiés au passage :
- `ClientController::show` renvoie un objet PLAT avec tableau `ventes` → `clientDetail.ventes || []` OK (clients l.306-311).
- `InventaireController::compter` positionne `statut='termine'`.
- Paginateurs bruts (ventes, mouvements-stock, retours, inventaires, audit-logs, produits, categories) : `data` au premier niveau → gardes `data.data ?? []` frontend correctes.
- `AuditLogController::index` paginateur brut → audit-logs page `data.data || data` OK ; rôle gardé via `role_courant`.

## Endpoints vérifiés (forme réelle)

| Endpoint | Controller | Forme |
|---|---|---|
| GET /produits | ProduitController::index | paginateur brut `{data,...,current_page,last_page,total}` (pas de meta) |
| GET /produits/{id} | show | produit plat |
| GET /produits/search/{search} | search | tableau plat |
| GET /produits/code/{code} | findByCode | produit plat ou 404 {message} |
| GET /produits/alerte-stock | alerteStock | tableau plat |
| GET /produits/statistiques | statistiques | objet |
| POST /produits/{id}/image | uploadImage | {message, data} |
| GET /categories | CategorieController::index | paginateur brut |
| GET /ventes | VenteController::index | paginateur brut + ligneVentes.produit, client |
| GET /ventes/aujourdhui/stats | statsVentesAujourdhui | objet |
| GET /ventes/{id}/facture/pdf | genererFacturePdf | binaire PDF (media.ts) |
| GET /mouvements-stock | MouvementStockController::index | paginateur brut + produit, user |
| GET /mouvements-stock/statistiques | statistiques | objet {total_entrees, ...} |
| POST /mouvements-stock | store | {message, mouvement} |
| GET /clients | ClientController::index | {data, meta, links} — meta EXISTE |
| GET /clients/{id} | show | objet PLAT + ventes[] |
| GET /clients/statistiques/globales | statistiques | objet |
| GET /clients/search/advanced | search | tableau plat |
| GET /fournisseurs | FournisseurController::index | {data,total,per_page,current_page,last_page} |
| GET /fournisseurs/{id} | show | fournisseur PLAT + commandesFournisseurs |
| GET /fournisseurs/statistiques | statistiques | {total_fournisseurs, fournisseurs_actifs, fournisseurs_inactifs} |
| GET /commandes-fournisseurs | CommandeFournisseurController::index | {data,...} + lignes.produit |
| GET /commandes-fournisseurs/{id} | show | commande PLAT + lignes.produit |
| GET /commandes-fournisseurs/suggestions | suggestions | {data, total} |
| POST /commandes-fournisseurs/{id}/receptionner | receptionner | {message, data:{commande, receptions}} |
| GET /commandes-clients | CommandeClientController::index | {data,...} + lignes.produit + paiements |
| GET /commandes-clients/{id} | show | PLAT + lignes.produit + paiements |
| GET /retours | RetourVenteController::index | paginateur brut + lignes.produit |
| GET /retours/{id} | show | PLAT + lignes.produit, vente.ligneVentes.produit |
| GET /inventaires | InventaireController::index | paginateur brut |
| GET /inventaires/{id} | show | PLAT + lignes.produit.categorie |
| POST /inventaires/{id}/compter | compter | {message, data} (plat, lignes) |
| POST /inventaires/{id}/valider | valider | {message, data} (plat, lignes) |
| GET /inventaires/{id}/ecarts | ecarts | {inventaire, ecarts[], ecarts_positifs, ecarts_negatifs} |
| GET /audit-logs | AuditLogController::index | paginateur brut (data.data || data OK) |
| GET /audit-logs/stats | stats | objet |
| GET /mes-boutiques | BoutiqueController::mesBoutiques | tableau plat |
| GET /boutiques | BoutiqueController::index | tableau plat (users_count, produits_count, ventes_count) |
| GET /boutiques/{id}/users | equipe | tableau plat |
| GET /boutique/settings | settings | boutique plat |
| GET /me | AuthController::me | {role, role_courant (roleDansBoutique), boutiques[], ...} |
| GET /users | UserController::index | paginateur brut |
| GET /users/caissiers | caissiers | tableau plat |
| GET /notifications | NotificationController::index | paginateur brut (unread_only, per_page) |

## Méthode
- Lecture intégrale des pages frontend (validateurs : garde Array.isArray, `?.` avant `.map/.length`, parseInt de useParams, token de session).
- Lecture intégrale des controllers index/show retournant les formes ci-dessus.
- Grep croisé de chaque accès `.map/.filter/.length` sur les réponses fetch.