# 📊 Analyse Multi-Tenancy - SGCI Bénin

**Date**: 2 juin 2026  
**Objectif**: Évolution vers une architecture multi-tenancy avec plusieurs propriétaires indépendants

---

## 🎯 Concept

SGCI est une plateforme SaaS qui accueille plusieurs propriétaires indépendants. Chaque propriétaire possède son propre groupe de boutiques, avec isolation totale des données.

**Exemple**:
- Monsieur Akakpo possède 3 boutiques: Cotonou, Porto-Novo, Parakou
- Madame Sossou possède 2 boutiques: Calavi, Godomey
- **Isolation**: M. Akakpo ne voit JAMAIS les boutiques/données de Mme Sossou

**Rôles**:
- **Propriétaire**: Possède plusieurs boutiques, voit et gère uniquement SES boutiques
- **Gérant**: Gère une seule boutique (appartient à un propriétaire)
- **Caissier**: Travaille dans une seule boutique (appartient à un propriétaire)

**Architecture Multi-Tenancy**:
- Chaque propriétaire = Tenant
- Isolation des données par boutique (et donc par propriétaire)
- Scalabilité: Facile d'ajouter de nouveaux propriétaires

---

## 📋 Analyse de l'existant

### Modèles actuels (sans scope boutique)

| Modèle | Statut | Modification requise |
|--------|--------|---------------------|
| `User` | ❌ Pas de boutique_id | ✅ Ajouter `current_boutique_id` (nullable) + table pivot `boutique_user` |
| `Produit` | ❌ Pas de boutique_id | ✅ Ajouter `boutique_id` (required) |
| `Vente` | ❌ Pas de boutique_id | ✅ Ajouter `boutique_id` (required) |
| `Client` | ❌ Pas de boutique_id | ✅ Ajouter `boutique_id` (required) |
| `Categorie` | ❌ Pas de boutique_id | ✅ Ajouter `boutique_id` (required) |
| `MouvementStock` | ❌ Pas de boutique_id | ✅ Ajouter `boutique_id` (required) |
| `BoutiqueSettings` | ❌ Table settings | ✅ Renommer/adapter pour multi-boutique |
| `AuditLog` | ❌ Pas de boutique_id | ✅ Ajouter `boutique_id` (nullable) |

### Contrôleurs à modifier

| Contrôleur | Modification |
|------------|--------------|
| `AuthController` | ✅ Ajouter sélection boutique au login (si propriétaire avec plusieurs boutiques) |
| `ProduitController` | ✅ Filtrer par boutique_id de l'utilisateur (isolation multi-tenancy) |
| `VenteController` | ✅ Filtrer par boutique_id de l'utilisateur (isolation multi-tenancy) |
| `ClientController` | ✅ Filtrer par boutique_id de l'utilisateur (isolation multi-tenancy) |
| `CategorieController` | ✅ Filtrer par boutique_id de l'utilisateur (isolation multi-tenancy) |
| `MouvementStockController` | ✅ Filtrer par boutique_id de l'utilisateur (isolation multi-tenancy) |
| `UserController` | ✅ Filtrer par boutique_id (uniquement boutiques du propriétaire) |
| `AnalyticsController` | ✅ Filtrer par boutique_id (isolation multi-tenancy) |
| `BoutiqueController` | ✅ Créer pour gérer les boutiques du propriétaire |
| `AuditLogController` | ✅ Filtrer par boutique_id (isolation multi-tenancy) |

### Frontend à modifier

| Composant | Modification |
|-----------|--------------|
| `AuthContext` | ✅ Ajouter gestion boutique sélectionnée (pour propriétaire avec plusieurs boutiques) |
| `Login` | ✅ Ajouter sélection boutique (si propriétaire avec plusieurs boutiques) |
| `Dashboard` | ✅ Afficher boutique courante |
| `Produits` | ✅ Filtrer par boutique (isolation multi-tenancy) |
| `Ventes` | ✅ Filtrer par boutique (isolation multi-tenancy) |
| `Clients` | ✅ Filtrer par boutique (isolation multi-tenancy) |
| `Paramètres` | ✅ Ajouter gestion boutiques (uniquement pour propriétaire) |
| `AppShell` | ✅ Ajouter sélecteur de boutique (si propriétaire avec plusieurs boutiques) |

---

## 🗂️ Nouvelle structure de base de données

### Tables à créer/modifier

1. **Table `boutiques`** (nouvelle)
   ```sql
   - id
   - nom
   - adresse
   - telephone
   - email
   - devise
   - taux_tva
   - delai_annulation_vente_minutes
   - proprietaire_id (user_id)
   - created_at
   - updated_at
   ```

2. **Table `boutique_user`** (nouvelle - table pivot)
   ```sql
   - id
   - boutique_id (foreign key)
   - user_id (foreign key)
   - role_dans_boutique (enum: 'gerant', 'caissier')
   - created_at
   - updated_at
   - unique(boutique_id, user_id)
   ```
   **Avantage**: Permet à un utilisateur d'être associé à plusieurs boutiques (flexibilité future)

3. **Table `users`** (modifier)
   ```sql
   - Ajouter: current_boutique_id (nullable) - boutique active pour le switch
   - Ajouter: role (enum: 'proprietaire', 'gerant', 'caissier')
   - Supprimer: boutique_id (remplacé par table pivot)
   ```

3. **Table `produits`** (modifier)
   ```sql
   - Ajouter: boutique_id (required, foreign key)
   ```

4. **Table `ventes`** (modifier)
   ```sql
   - Ajouter: boutique_id (required, foreign key)
   ```

5. **Table `clients`** (modifier)
   ```sql
   - Ajouter: boutique_id (required, foreign key)
   ```

6. **Table `categories`** (modifier)
   ```sql
   - Ajouter: boutique_id (required, foreign key)
   ```

7. **Table `mouvements_stock`** (modifier)
   ```sql
   - Ajouter: boutique_id (required, foreign key)
   ```

8. **Table `audit_logs`** (modifier)
   ```sql
   - Ajouter: boutique_id (nullable, foreign key)
   ```

9. **Table `boutique_settings`** (supprimer ou adapter)
   - À remplacer par la table `boutiques`

---

## 🔧 Modifications techniques

### 1. Migrations à créer

```php
// 1. Créer table boutiques
2026_06_02_000003_create_boutiques_table.php

// 2. Créer table pivot boutique_user
2026_06_02_000004_create_boutique_user_table.php

// 3. Ajouter current_boutique_id à users
2026_06_02_000005_add_current_boutique_to_users_table.php

// 4. Ajouter boutique_id aux tables existantes
2026_06_02_000006_add_boutique_to_produits_table.php
2026_06_02_000007_add_boutique_to_ventes_table.php
2026_06_02_000008_add_boutique_to_clients_table.php
2026_06_02_000009_add_boutique_to_categories_table.php
2026_06_02_000010_add_boutique_to_mouvements_stock_table.php
2026_06_02_000011_add_boutique_to_audit_logs_table.php

// 5. Modifier role enum dans users
2026_06_02_000012_update_user_role_enum.php

// 6. Supprimer boutique_settings (optionnel)
2026_06_02_000013_drop_boutique_settings_table.php
```

### 2. Modèles à modifier

```php
// User.php
- Ajouter relation: boutiques() (belongsToMany via pivot)
- Ajouter relation: currentBoutique() (belongsTo via current_boutique_id)
- Ajouter relation: boutiquesPossedees() (hasMany pour propriétaire)
- Modifier: estGerant(), estCaissier(), ajouter estProprietaire()
- Ajouter: current_boutique_id (nullable)

// Boutique.php (nouveau modèle)
- Ajouter relation: proprietaire() (belongsTo User)
- Ajouter relation: users() (belongsToMany via pivot)
- Ajouter relation: produits() (hasMany)
- Ajouter relation: ventes() (hasMany)
- Ajouter relation: clients() (hasMany)
- Ajouter relation: categories() (hasMany)

// BoutiqueUser.php (nouveau modèle pivot)
- belongsTo User
- belongsTo Boutique
- role_dans_boutique

// Produit.php
- Ajouter: boutique_id
- Ajouter relation: boutique()

// Vente.php
- Ajouter: boutique_id
- Ajouter relation: boutique()
- Modifier: génération numéro_vente (inclure boutique_id)

// Client.php
- Ajouter: boutique_id
- Ajouter relation: boutique()

// Categorie.php
- Ajouter: boutique_id
- Ajouter relation: boutique()

// MouvementStock.php
- Ajouter: boutique_id
- Ajouter relation: boutique()

// AuditLog.php
- Ajouter: boutique_id
- Ajouter relation: boutique()
```

### 3. Contrôleurs à modifier

```php
// AuthController.php
- Login: retourner boutiques disponibles si propriétaire
- Me: retourner boutique courante (current_boutique_id)
- SwitchBoutique: nouvelle méthode pour changer de boutique (propriétaire)

// ProduitController.php
- Index: filtrer par current_boutique_id de l'utilisateur
- Store: définir boutique_id automatiquement (current_boutique_id)

// VenteController.php
- Index: filtrer par current_boutique_id de l'utilisateur
- Store: définir boutique_id automatiquement (current_boutique_id)

// ClientController.php
- Index: filtrer par current_boutique_id de l'utilisateur
- Store: définir boutique_id automatiquement (current_boutique_id)

// CategorieController.php
- Index: filtrer par current_boutique_id de l'utilisateur
- Store: définir boutique_id automatiquement (current_boutique_id)

// MouvementStockController.php
- Index: filtrer par current_boutique_id de l'utilisateur
- Store: définir boutique_id automatiquement (current_boutique_id)

// UserController.php
- Index: filtrer par boutique (via pivot) pour propriétaire
- Store: définir boutique_id via pivot
- AssignBoutique: nouvelle méthode pour assigner utilisateur à boutique

// AnalyticsController.php
- Toutes les méthodes: filtrer par current_boutique_id

// BoutiqueController.php (nouveau)
- CRUD pour boutiques (réservé propriétaire)
- Index: retourner boutiques du propriétaire
- Store: créer nouvelle boutique pour le propriétaire
- Update: modifier boutique (si propriétaire)
- Destroy: supprimer boutique (si propriétaire)
```

### 4. Middlewares à créer

```php
// BoutiqueScopeMiddleware.php
- Ajouter automatiquement scope boutique aux requêtes (via current_boutique_id)
- Vérifier l'accès à la boutique
- Appliquer sur toutes les routes API (sauf auth)

// ProprietaireMiddleware.php
- Vérifier que l'utilisateur est propriétaire
- Pour les routes réservées aux propriétaires
```

### 5. Frontend modifications

```typescript
// types/index.ts
- Ajouter: Boutique interface
- Modifier: User interface (current_boutique_id, boutiques[], currentBoutique)

// contexts/AuthContext.tsx
- Ajouter: selectedBoutique state
- Ajouter: setSelectedBoutique function
- Ajouter: switchBoutique function
- Modifier: login pour gérer sélection boutique (si propriétaire)
- Modifier: me pour charger current_boutique

// components/AppShell.tsx
- Ajouter: BoutiqueSelector component (si propriétaire avec plusieurs boutiques)
- Afficher boutique courante

// pages/login/page.tsx
- Ajouter: sélection boutique (si propriétaire avec plusieurs boutiques)

// pages/parametres/page.tsx
- Ajouter: onglet "Mes Boutiques" (propriétaire)
- Modifier: gestion utilisateurs (assigner via pivot)

// pages/dashboard/page.tsx
- Afficher: boutique courante
- Filtrer: données par boutique (automatique via current_boutique_id)
```

---

## ⚠️ Points d'attention

### Données existantes
- **Produits**: Boutique par défaut pour les produits existants
- **Ventes**: Boutique par défaut pour les ventes existantes
- **Clients**: Boutique par défaut pour les clients existants
- **Utilisateurs**: Assigner boutique par défaut aux gérants/caissiers existants

### Numérotation des ventes
- Modifier pour inclure boutique_id: `VENT-{boutique_id}-{année}-{numéro}`
- Ou préfixe par boutique: `VENT-{boutique_code}-{année}-{numéro}`

### Analytics
- Filtrer toutes les analytics par boutique
- Propriétaire peut voir toutes ses boutiques ou une spécifique

### Notifications
- Filtrer par boutique
- Propriétaire peut voir notifications de toutes ses boutiques

---

## 📝 Plan d'action

### Phase 1: Base de données
1. ✅ Créer table `boutiques`
2. ✅ Ajouter `boutique_id` à toutes les tables
3. ✅ Modifier enum `role` dans `users`
4. ✅ Créer boutique par défaut
5. ✅ Migrer données existantes vers boutique par défaut

### Phase 2: Backend
1. ✅ Modifier modèles (relations)
2. ✅ Modifier contrôleurs (filtres boutique)
3. ✅ Créer middlewares (scope boutique)
4. ✅ Créer BoutiqueController
5. ✅ Modifier AuthController (sélection boutique)

### Phase 3: Frontend
1. ✅ Modifier types (Boutique interface)
2. ✅ Modifier AuthContext (sélection boutique)
3. ✅ Créer BoutiqueSelector component
4. ✅ Modifier pages (filtres boutique)
5. ✅ Modifier paramètres (gestion boutiques)

### Phase 4: Tests
1. ✅ Tester création boutique
2. ✅ Teste sélection boutique
3. ✅ Tester isolation des données
4. ✅ Tester analytics par boutique
5. ✅ Tester permissions (propriétaire vs gérant)

---

## 🚀 Avantages de cette architecture

1. **Scalabilité**: Facile d'ajouter de nouveaux propriétaires et boutiques
2. **Isolation**: Données isolées par propriétaire (multi-tenancy)
3. **Flexibilité**: Propriétaire peut gérer plusieurs boutiques
4. **Sécurité**: Contrôle d'accès granulaire (propriétaire ne voit que ses données)
5. **Analytics**: Analytics par boutique ou globales (pour un propriétaire)
6. **SaaS**: Plateforme SaaS prête pour l'expansion
