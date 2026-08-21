# ANALYSE DU PARCOURS UTILISATEUR - SGCI BÉNIN

**Date** : 13 juin 2026  
**Objectif** : Analyser le parcours utilisateur actuel vs souhaité et proposer les modifications

---

## PARCOURS SOUHAITÉ PAR L'UTILISATEUR

1. **Inscription** : Une personne qui s'inscrit est automatiquement un propriétaire
2. **Création boutique** : Il renseigne tout ce qu'il lui faut et crée sa première boutique
3. **Connexion** : Le propriétaire se connecte
4. **Sélection boutique** : Il arrive sur une page où il voit TOUTES ses boutiques
5. **Choix boutique** : Il choisit laquelle inspecter
6. **Dashboard boutique** : Cela l'amène sur le dashboard de la boutique appropriée avec les informations réelles de cette boutique
7. **Administration** : Il peut administrer sa boutique comme bon lui semble
8. **Gestion équipe** : Dans le menu paramètres, il peut voir son équipe et l'administrer
9. **Ajout membres** : Il peut ajouter d'autres personnes à son équipe selon le rôle qu'il veut leur donner
10. **Connexion membres** : Ces personnes se connectent et ont droit à ce que leur rôle leur donne
11. **Ajout boutique** : Le propriétaire peut ajouter une nouvelle boutique s'il veut avec toutes les obligations qui vont avec
12. **Objectif** : Chacun à son niveau selon son rôle a son plein potentiel

---

## ÉTAT ACTUEL DU SYSTÈME

### ✅ CE QUI EXISTE DÉJÀ

#### 1. Inscription automatique comme propriétaire
**Fichier** : `sgci-backend/app/Http/Controllers/AuthController.php` (lignes 26-79)

```php
public function register(Request $request)
{
    // Créer l'utilisateur
    $user = User::create([
        'name' => $validated['name'],
        'email' => $validated['email'],
        'telephone' => $validated['telephone'] ?? null,
        'password' => Hash::make($validated['password']),
        'role' => 'proprietaire', // ✅ Par défaut, le créateur est propriétaire
        'est_actif' => true,
        'derniere_connexion' => now(),
    ]);

    // Créer la boutique
    $boutique = \App\Models\Boutique::create([
        'nom' => $validated['boutique_nom'],
        'adresse' => $validated['boutique_adresse'] ?? null,
        'telephone' => $validated['boutique_telephone'] ?? null,
        'proprietaire_id' => $user->id,
        'devise' => 'XOF',
        'taux_tva' => 18,
    ]);

    // Associer l'utilisateur à sa boutique
    $user->current_boutique_id = $boutique->id;
    $user->save();
}
```

**Statut** : ✅ **FONCTIONNEL** - L'inscription crée automatiquement un propriétaire avec sa première boutique

---

#### 2. Page de sélection des boutiques
**Fichier** : `sgci-frontend/src/app/boutiques/page.tsx`

**Fonctionnalités** :
- Liste toutes les boutiques du propriétaire
- Affiche les stats (membres, produits, ventes)
- Création de nouvelle boutique
- Actions : Gérer, Équipe

**Statut** : ✅ **FONCTIONNEL** - La page existe et fonctionne

---

#### 3. Dashboard par boutique
**Fichier** : `sgci-frontend/src/app/dashboard/page.tsx`

**Fonctionnalités** :
- Stats en temps réel (chiffre d'affaires, ventes, produits, alertes)
- Alertes stock
- Produits populaires
- Données filtrées par boutique courante

**Statut** : ✅ **FONCTIONNEL** - Le dashboard affiche les données de la boutique courante

---

#### 4. Gestion de l'équipe dans paramètres
**Fichier** : `sgci-frontend/src/app/parametres/page.tsx`

**Fonctionnalités** :
- Onglet "Équipe" avec composant UsersManagement
- Création d'utilisateurs
- Assignation de rôles
- Assignation aux boutiques

**Statut** : ✅ **FONCTIONNEL** - La gestion de l'équipe existe

---

#### 5. Ajout de nouvelle boutique
**Fichier** : `sgci-frontend/src/app/boutiques/page.tsx` (lignes 343-428)

**Fonctionnalités** :
- Dialog de création de boutique
- Champs : nom, adresse, téléphone, email, devise, taux TVA
- API : POST /boutiques

**Statut** : ✅ **FONCTIONNEL** - L'ajout de boutique fonctionne

---

#### 6. Sélection de boutique après login
**Fichier** : `sgci-frontend/src/app/login/page.tsx` (lignes 78-80, 104-154)

**Fonctionnalités** :
- Si propriétaire avec plusieurs boutiques, affiche sélecteur
- Switch de boutique
- Redirection vers dashboard

**Statut** : ⚠️ **PARTIEL** - Ne s'affiche QUE si plusieurs boutiques

---

### ⚠️ CE QUI DOIT ÊTRE MODIFIÉ

#### 1. Redirection après connexion
**Problème actuel** :
- Si propriétaire avec 1 boutique → redirection directe vers dashboard
- Si propriétaire avec plusieurs boutiques → affiche sélecteur

**Ce qui est souhaité** :
- TOUJOURS afficher la page de sélection des boutiques pour le propriétaire
- Même s'il n'a qu'une boutique, il doit la voir et la sélectionner

**Modification nécessaire** :
- Modifier `login/page.tsx` pour TOUJOURS afficher le sélecteur pour les propriétaires
- Créer une page dédiée `/selection-boutique` après connexion

---

#### 2. Parcours après sélection de boutique
**Problème actuel** :
- Après sélection, redirection vers `/dashboard`
- Le dashboard affiche les données de la boutique courante

**Ce qui est souhaité** :
- ✅ C'est déjà correct - le dashboard affiche les données de la boutique sélectionnée

**Statut** : ✅ **FONCTIONNEL** - Pas de modification nécessaire

---

#### 3. Page de sélection des boutiques après connexion
**Problème actuel** :
- Le sélecteur est intégré dans la page de login
- Ce n'est pas une page dédiée

**Ce qui est souhaité** :
- Une page dédiée après connexion pour choisir sa boutique
- Plus clair et plus professionnel

**Modification nécessaire** :
- Créer une nouvelle page `/selection-boutique`
- Y déplacer la logique de sélection
- Rediriger vers cette page après login pour les propriétaires

---

## MODIFICATIONS À EFFECTUER

### 1. Créer une page de sélection de boutique dédiée

**Nouveau fichier** : `sgci-frontend/src/app/selection-boutique/page.tsx`

**Contenu** :
- Liste des boutiques du propriétaire
- Cartes avec informations de chaque boutique
- Stats rapides (membres, produits, ventes)
- Bouton "Sélectionner" pour chaque boutique
- Redirection vers dashboard après sélection

---

### 2. Modifier la page de login

**Fichier** : `sgci-frontend/src/app/login/page.tsx`

**Modifications** :
- Supprimer la logique de sélection de boutique (lignes 78-80, 104-154)
- Après login réussi, rediriger vers `/selection-boutique` pour les propriétaires
- Rediriger vers `/dashboard` pour les gérants et caissiers

---

### 3. Modifier le contexte d'authentification

**Fichier** : `sgci-frontend/src/contexts/AuthContext.tsx`

**Modifications** :
- Ajouter une logique de redirection après login
- Si rôle = propriétaire → `/selection-boutique`
- Si rôle = gérant ou caissier → `/dashboard`

---

### 4. Mettre à jour la page boutiques

**Fichier** : `sgci-frontend/src/app/boutiques/page.tsx`

**Modifications** :
- Garder la page actuelle pour la gestion des boutiques
- Ajouter un bouton "Retour au dashboard" pour revenir après sélection

---

## PARCOURS FINAL APRÈS MODIFICATIONS

### Pour le propriétaire

1. **Inscription** → Création automatique compte propriétaire + boutique
2. **Login** → Redirection vers `/selection-boutique`
3. **Sélection boutique** → Page dédiée avec liste des boutiques
4. **Choix boutique** → Clic sur "Sélectionner"
5. **Dashboard** → Dashboard avec données de la boutique sélectionnée
6. **Administration** → Gestion produits, ventes, stock, etc.
7. **Paramètres** → Gestion profil, boutique, équipe
8. **Équipe** → Ajout de membres avec rôles
9. **Ajout boutique** → Via page `/boutiques` ou dashboard
10. **Switch boutique** → Via sélecteur dans le header

### Pour le gérant

1. **Login** → Redirection vers `/dashboard`
2. **Dashboard** → Dashboard de la boutique courante
3. **Administration** → Selon permissions
4. **Équipe** → Gestion des caissiers (si autorisé)

### Pour le caissier

1. **Login** → Redirection vers `/dashboard`
2. **Dashboard** → Dashboard de la boutique courante
3. **Caisse** → Accès à la caisse uniquement

---

## RÉSUMÉ DES MODIFICATIONS

| Modification | Fichier | Priorité |
|--------------|---------|----------|
| Créer page `/selection-boutique` | `app/selection-boutique/page.tsx` | HAUTE |
| Modifier login redirection | `app/login/page.tsx` | HAUTE |
| Modifier AuthContext redirection | `contexts/AuthContext.tsx` | HAUTE |
| Mettre à jour page boutiques | `app/boutiques/page.tsx` | MOYENNE |

---

## ÉTAT FINAL APRÈS MODIFICATIONS

✅ **Fonctionnalités existantes** (ne nécessitent pas de modification) :
- Inscription automatique comme propriétaire
- Création de boutique lors de l'inscription
- Page de gestion des boutiques
- Dashboard par boutique
- Gestion de l'équipe dans paramètres
- Ajout de nouvelle boutique
- Switch de boutique
- Permissions par rôle

⚠️ **Fonctionnalités à modifier** :
- Redirection après login pour toujours afficher sélecteur aux propriétaires
- Création d'une page dédiée de sélection de boutique

---

## CONCLUSION

Le système actuel est **très proche** du parcours souhaité. Les fonctionnalités principales existent déjà. Seules quelques modifications mineures sont nécessaires pour aligner parfaitement le parcours utilisateur avec les attentes :

1. Créer une page dédiée de sélection de boutique
2. Modifier la redirection après login pour les propriétaires

Une fois ces modifications effectuées, le parcours sera exactement comme souhaité par l'utilisateur.

---

**Fin de l'analyse**
