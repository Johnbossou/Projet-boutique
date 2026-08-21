# 📊 Analyse Complète Multi-Tenancy - SGCI Bénin

**Date**: 2 juin 2026  
**Objectif**: Évolution vers une architecture multi-tenancy avec plusieurs propriétaires indépendants

---

## 🎯 Concept Multi-Tenancy

**Plateforme SaaS** avec plusieurs propriétaires indépendants:
- M. Akakpo: 3 boutiques (Cotonou, Porto-Novo, Parakou)
- Mme Sossou: 2 boutiques (Calavi, Godomey)
- **Isolation totale**: M. Akakpo ne voit JAMAIS les données de Mme Sossou

**Rôles**:
- **Propriétaire**: Possède plusieurs boutiques, voit uniquement SES boutiques
- **Gérant**: Gère une seule boutique (appartient à un propriétaire)
- **Caissier**: Travaille dans une seule boutique (appartient à un propriétaire)

**Architecture**:
- Table pivot `boutique_user` pour flexibilité (un utilisateur peut être dans plusieurs boutiques)
- `current_boutique_id` sur User pour le switch de boutique (évite de passer boutique dans chaque requête)
- Isolation des données par boutique (et donc par propriétaire)

---

## 🔍 Analyse Backend

### 1. Base de données (11 migrations)

#### Tables à créer
- ✅ `boutiques` (nouvelle)
- ✅ `boutique_user` (table pivot)

#### Tables à modifier
- ✅ `users` (ajouter `current_boutique_id`, modifier enum `role`)
- ✅ `produits` (ajouter `boutique_id`)
- ✅ `ventes` (ajouter `boutique_id`)
- ✅ `clients` (ajouter `boutique_id`)
- ✅ `categories` (ajouter `boutique_id`)
- ✅ `mouvements_stock` (ajouter `boutique_id`)
- ✅ `audit_logs` (ajouter `boutique_id`)
- ❌ `boutique_settings` (supprimer ou adapter)

#### Détails migrations

```php
// 1. Créer table boutiques
2026_06_02_000003_create_boutiques_table.php
- id
- nom
- adresse
- telephone
- email
- devise
- taux_tva
- delai_annulation_vente_minutes
- proprietaire_id (foreign key users)
- created_at
- updated_at

// 2. Créer table pivot boutique_user
2026_06_02_000004_create_boutique_user_table.php
- id
- boutique_id (foreign key boutiques)
- user_id (foreign key users)
- role_dans_boutique (enum: 'gerant', 'caissier')
- created_at
- updated_at
- unique(boutique_id, user_id)

// 3. Ajouter current_boutique_id à users
2026_06_02_000005_add_current_boutique_to_users_table.php
- current_boutique_id (nullable, foreign key boutiques)

// 4. Modifier role enum users
2026_06_02_000006_update_user_role_enum.php
- enum: 'proprietaire', 'gerant', 'caissier'

// 5-10. Ajouter boutique_id aux tables
2026_06_02_000007_add_boutique_to_produits_table.php
2026_06_02_000008_add_boutique_to_ventes_table.php
2026_06_02_000009_add_boutique_to_clients_table.php
2026_06_02_000010_add_boutique_to_categories_table.php
2026_06_02_000011_add_boutique_to_mouvements_stock_table.php
2026_06_02_000012_add_boutique_to_audit_logs_table.php

// 11. Migrer données existantes
2026_06_02_000013_migrate_existing_data_to_default_boutique.php
- Créer boutique par défaut
- Assigner boutique par défaut à tous les utilisateurs existants
- Assigner boutique par défaut à toutes les données existantes
```

---

### 2. Modèles (8 modèles à modifier/créer)

#### Modèles à créer
- ✅ `Boutique.php` (nouveau)
  - Relations: proprietaire(), users(), produits(), ventes(), clients(), categories()
  - Scopes: forProprietaire(), active()

- ✅ `BoutiqueUser.php` (nouveau - pivot)
  - Relations: user(), boutique()
  - Fillable: boutique_id, user_id, role_dans_boutique

#### Modèles à modifier
- ✅ `User.php`
  - Ajouter: current_boutique_id (fillable)
  - Relations: boutiques() (belongsToMany via pivot), currentBoutique() (belongsTo), boutiquesPossedees() (hasMany)
  - Méthodes: estProprietaire(), switchBoutique($boutiqueId)
  - Scopes: forBoutique($boutiqueId)

- ✅ `Produit.php`
  - Ajouter: boutique_id (fillable)
  - Relation: boutique() (belongsTo)
  - Scope: forBoutique($boutiqueId)

- ✅ `Vente.php`
  - Ajouter: boutique_id (fillable)
  - Relation: boutique() (belongsTo)
  - Scope: forBoutique($boutiqueId)
  - Modifier: génération numéro_vente (inclure boutique_id)

- ✅ `Client.php`
  - Ajouter: boutique_id (fillable)
  - Relation: boutique() (belongsTo)
  - Scope: forBoutique($boutiqueId)

- ✅ `Categorie.php`
  - Ajouter: boutique_id (fillable)
  - Relation: boutique() (belongsTo)
  - Scope: forBoutique($boutiqueId)

- ✅ `MouvementStock.php`
  - Ajouter: boutique_id (fillable)
  - Relation: boutique() (belongsTo)
  - Scope: forBoutique($boutiqueId)

- ✅ `AuditLog.php`
  - Ajouter: boutique_id (nullable, fillable)
  - Relation: boutique() (belongsTo)
  - Scope: forBoutique($boutiqueId)

---

### 3. Contrôleurs (11 contrôleurs à modifier/créer)

#### Contrôleurs à créer
- ✅ `BoutiqueController.php` (nouveau)
  - index() - boutiques du propriétaire
  - store() - créer boutique (propriétaire)
  - show($id) - détails boutique
  - update($id) - modifier boutique (propriétaire)
  - destroy($id) - supprimer boutique (propriétaire)
  - assignUser($boutiqueId, $userId, $role) - assigner utilisateur à boutique
  - removeUser($boutiqueId, $userId) - retirer utilisateur de boutique

#### Contrôleurs à modifier
- ✅ `AuthController.php`
  - login() - retourner boutiques disponibles si propriétaire
  - me() - retourner boutique courante (current_boutique_id)
  - switchBoutique($boutiqueId) - changer de boutique (propriétaire)
  - register() - créer utilisateur avec boutique par défaut

- ✅ `ProduitController.php`
  - index() - filtrer par current_boutique_id
  - store() - définir boutique_id = current_boutique_id
  - update() - vérifier boutique_id = current_boutique_id
  - destroy() - vérifier boutique_id = current_boutique_id

- ✅ `VenteController.php`
  - index() - filtrer par current_boutique_id
  - store() - définir boutique_id = current_boutique_id
  - show() - vérifier boutique_id = current_boutique_id
  - update() - vérifier boutique_id = current_boutique_id

- ✅ `ClientController.php`
  - index() - filtrer par current_boutique_id
  - store() - définir boutique_id = current_boutique_id
  - show() - vérifier boutique_id = current_boutique_id
  - update() - vérifier boutique_id = current_boutique_id

- ✅ `CategorieController.php`
  - index() - filtrer par current_boutique_id
  - store() - définir boutique_id = current_boutique_id
  - show() - vérifier boutique_id = current_boutique_id
  - update() - vérifier boutique_id = current_boutique_id
  - destroy() - vérifier boutique_id = current_boutique_id

- ✅ `MouvementStockController.php`
  - index() - filtrer par current_boutique_id
  - store() - définir boutique_id = current_boutique_id
  - show() - vérifier boutique_id = current_boutique_id

- ✅ `UserController.php`
  - index() - filtrer par boutiques du propriétaire (via pivot)
  - store() - assigner via pivot boutique_user
  - update() - modifier role dans pivot
  - destroy() - désactiver utilisateur
  - assignBoutique($userId, $boutiqueId, $role) - assigner boutique
  - removeBoutique($userId, $boutiqueId) - retirer boutique

- ✅ `AnalyticsController.php`
  - Toutes les méthodes - filtrer par current_boutique_id

- ✅ `NotificationController.php`
  - index() - filtrer par current_boutique_id

- ✅ `AuditLogController.php`
  - index() - filtrer par current_boutique_id (sauf super admin)
  - stats() - filtrer par current_boutique_id

---

### 4. Middlewares (2 middlewares à créer)

#### Middlewares à créer
- ✅ `BoutiqueScopeMiddleware.php`
  - Appliquer scope boutique automatiquement via current_boutique_id
  - Vérifier l'accès à la boutique
  - Appliquer sur toutes les routes API (sauf auth, boutiques)

- ✅ `ProprietaireMiddleware.php`
  - Vérifier que l'utilisateur est propriétaire
  - Pour les routes réservées aux propriétaires (CRUD boutiques)

---

### 5. Routes API (routes à ajouter)

#### Nouvelles routes
```php
// Boutiques (réservé propriétaire)
Route::middleware(['auth:sanctum', 'proprietaire'])->group(function () {
    Route::get('/boutiques', [BoutiqueController::class, 'index']);
    Route::post('/boutiques', [BoutiqueController::class, 'store']);
    Route::get('/boutiques/{id}', [BoutiqueController::class, 'show']);
    Route::put('/boutiques/{id}', [BoutiqueController::class, 'update']);
    Route::delete('/boutiques/{id}', [BoutiqueController::class, 'destroy']);
    Route::post('/boutiques/{boutiqueId}/users/{userId}', [BoutiqueController::class, 'assignUser']);
    Route::delete('/boutiques/{boutiqueId}/users/{userId}', [BoutiqueController::class, 'removeUser']);
});

// Switch boutique
Route::middleware(['auth:sanctum'])->group(function () {
    Route::post('/switch-boutique', [AuthController::class, 'switchBoutique']);
});

// Appliquer BoutiqueScopeMiddleware sur les routes existantes
Route::middleware(['auth:sanctum', 'user.active', 'boutique.scope'])->group(function () {
    // Routes existantes (produits, ventes, clients, etc.)
});
```

---

## 🔍 Analyse Frontend

### 1. Types (2 interfaces à modifier/créer)

#### Types à créer
- ✅ `Boutique` interface
  ```typescript
  interface Boutique {
    id: number;
    nom: string;
    adresse: string;
    telephone: string;
    email: string;
    devise: string;
    taux_tva: number;
    delai_annulation_vente_minutes: number;
    proprietaire_id: number;
    created_at: string;
    updated_at: string;
  }
  ```

#### Types à modifier
- ✅ `User` interface
  ```typescript
  interface User {
    id: number;
    name: string;
    email: string;
    role: 'proprietaire' | 'gerant' | 'caissier';
    telephone?: string | null;
    derniere_connexion?: string;
    est_actif?: boolean;
    two_factor_enabled?: boolean;
    current_boutique_id?: number | null;
    boutiques?: Boutique[];
    current_boutique?: Boutique;
  }
  ```

---

### 2. Context (1 contexte à modifier)

#### AuthContext à modifier
- ✅ `AuthContext.tsx`
  - Ajouter: `selectedBoutique` state
  - Ajouter: `setSelectedBoutique` function
  - Ajouter: `switchBoutique(boutiqueId)` function
  - Modifier: `login()` pour gérer sélection boutique (si propriétaire avec plusieurs boutiques)
  - Modifier: `me()` pour charger current_boutique
  - Modifier: `logout()` pour réinitialiser selectedBoutique

---

### 3. Composants (3 composants à créer/modifier)

#### Composants à créer
- ✅ `BoutiqueSelector.tsx` (nouveau)
  - Sélecteur de boutique pour propriétaire avec plusieurs boutiques
  - Affiche liste des boutiques du propriétaire
  - Permet de changer de boutique
  - Affiche boutique courante

#### Composants à modifier
- ✅ `AppShell.tsx`
  - Ajouter: BoutiqueSelector (si propriétaire avec plusieurs boutiques)
  - Afficher: boutique courante dans header
  - Modifier: navigation pour afficher boutique courante

- ✅ `UsersManagement.tsx`
  - Modifier: assignation boutique via pivot
  - Ajouter: sélection boutique lors de la création d'utilisateur
  - Modifier: liste des utilisateurs filtrée par boutiques du propriétaire

---

### 4. Pages (7 pages à modifier)

#### Pages à modifier
- ✅ `login/page.tsx`
  - Ajouter: sélection boutique (si propriétaire avec plusieurs boutiques)
  - Afficher: liste des boutiques disponibles
  - Stocker: selectedBoutique dans localStorage

- ✅ `dashboard/page.tsx`
  - Afficher: boutique courante
  - Filtrer: données par boutique (automatique via current_boutique_id)
  - Ajouter: statistiques par boutique

- ✅ `produits/page.tsx`
  - Filtrer: par boutique (automatique via API)
  - Modifier: création produit (boutique_id automatique)

- ✅ `ventes/page.tsx`
  - Filtrer: par boutique (automatique via API)
  - Modifier: création vente (boutique_id automatique)

- ✅ `clients/page.tsx`
  - Filtrer: par boutique (automatique via API)
  - Modifier: création client (boutique_id automatique)

- ✅ `parametres/page.tsx`
  - Ajouter: onglet "Mes Boutiques" (propriétaire)
  - Modifier: gestion utilisateurs (assignation via pivot)
  - Ajouter: création/suppression de boutiques (propriétaire)
  - Modifier: paramètres boutique (sélection boutique si multi)

- ✅ `parametres/audit-logs/page.tsx`
  - Filtrer: par boutique (automatique via API)

---

### 5. Services API (1 service à créer)

#### Services à créer
- ✅ `boutiqueService.ts` (nouveau)
  - `getBoutiques()` - récupérer boutiques du propriétaire
  - `createBoutique(data)` - créer nouvelle boutique
  - `updateBoutique(id, data)` - modifier boutique
  - `deleteBoutique(id)` - supprimer boutique
  - `assignUser(boutiqueId, userId, role)` - assigner utilisateur
  - `removeUser(boutiqueId, userId)` - retirer utilisateur
  - `switchBoutique(boutiqueId)` - changer de boutique

---

## 🔍 Analyse Mobile

**Note**: Aucune application mobile n'est actuellement développée. Si une application mobile est prévue, elle devra suivre la même architecture multi-tenancy avec:
- Sélection boutique au login
- Filtres boutique automatiques
- Switch boutique pour propriétaires

---

## 📝 Récapitulatif des modifications

### Backend (31 modifications)
- **Migrations**: 11
- **Modèles**: 8
- **Contrôleurs**: 11
- **Middlewares**: 2
- **Routes**: Ajouter routes boutiques + switch boutique

### Frontend (13 modifications)
- **Types**: 2
- **Context**: 1
- **Composants**: 3
- **Pages**: 7
- **Services**: 1

### Total: 44 modifications

---

## 🚀 Avantages de cette architecture

1. **Scalabilité**: Facile d'ajouter de nouveaux propriétaires et boutiques
2. **Isolation**: Données isolées par propriétaire (multi-tenancy)
3. **Flexibilité**: Propriétaire peut gérer plusieurs boutiques + utilisateur peut être dans plusieurs boutiques (pivot)
4. **Sécurité**: Contrôle d'accès granulaire (propriétaire ne voit que ses données)
5. **Analytics**: Analytics par boutique ou globales (pour un propriétaire)
6. **SaaS**: Plateforme SaaS prête pour l'expansion
7. **Performance**: current_boutique_id évite de passer boutique dans chaque requête

---

## ⚠️ Points d'attention

### Données existantes
- Créer boutique par défaut pour les données existantes
- Assigner boutique par défaut à tous les utilisateurs existants
- Assigner boutique par défaut à toutes les données existantes

### Numérotation des ventes
- Modifier pour inclure boutique_id: `VENT-{boutique_code}-{année}-{numéro}`
- Ou préfixe par boutique: `VENT-{année}-{numéro}` (filtré par boutique)

### Analytics
- Filtrer toutes les analytics par boutique
- Propriétaire peut voir analytics de toutes ses boutiques ou une spécifique

### Notifications
- Filtrer par boutique
- Propriétaire peut voir notifications de toutes ses boutiques

### Performance
- current_boutique_id évite de passer boutique dans chaque requête
- BoutiqueScopeMiddleware applique scope automatiquement

---

## 📋 Plan d'action

### Phase 1: Base de données (11 migrations)
1. ✅ Créer table boutiques
2. ✅ Créer table pivot boutique_user
3. ✅ Ajouter current_boutique_id à users
4. ✅ Modifier role enum users
5. ✅ Ajouter boutique_id à toutes les tables
6. ✅ Migrer données existantes

### Phase 2: Backend (21 modifications)
1. ✅ Créer modèles Boutique et BoutiqueUser
2. ✅ Modifier tous les modèles existants
3. ✅ Créer BoutiqueController
4. ✅ Modifier tous les contrôleurs existants
5. ✅ Créer middlewares
6. ✅ Ajouter routes API

### Phase 3: Frontend (13 modifications)
1. ✅ Modifier types
2. ✅ Modifier AuthContext
3. ✅ Créer BoutiqueSelector
4. ✅ Modifier AppShell
5. ✅ Modifier toutes les pages
6. ✅ Créer boutiqueService

### Phase 4: Tests (5 tests)
1. ✅ Tester création boutique
2. ✅ Tester switch boutique
3. ✅ Tester isolation des données
4. ✅ Tester analytics par boutique
5. ✅ Tester permissions (propriétaire vs gérant vs caissier)
