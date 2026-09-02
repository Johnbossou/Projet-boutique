# Checklist de validation — Projet SGCI Bénin

> Objectif : vérifier module par module que l'app web **et** l'APK mobile fonctionnent de bout en bout.
> Backend cible : `https://sgci-backend-production.up.railway.app/api`
> Web : `https://sgci-frontend.vercel.app`
> APK : `C:\Users\Josué\Desktop\Projet Boutique\SGCI.apk` (installer à la main)

## Comptes de test
| Role | Email | Mot de passe | Boutique |
|------|-------|--------------|----------|
| Propriétaire (Josue) | `josuebossou95@gmail.com` | `Maygodbless` | SGCI Bossou (id 2) |
| Propriétaire (demo) | `proprietaire@sgci.bj` | `password` | — |
| Gérant (demo) | `gerant@sgci.bj` | `password` | — |
| Caissier (demo) | `caissier@sgci.bj` | `password` | — |

> ⚠️ Le seed remet la DB à zéro à chaque re-déploiement. Les objets créés pendant un test peuvent disparaître après un `railway up`.

---

## A. Connexion & choix boutique
- [ ] **Web** : ouvrir `https://sgci-frontend.vercel.app` → page login.
- [ ] Se connecter avec `josuebossou95@gmail.com` / `Maygodbless` → redirigé vers le tableau de bord (pas d'écran bloqué).
- [ ] Rôle reconnu comme **propriétaire** (menu propriétaire visible).
- [ ] **Web** : `/selection-boutique` → la boutique « SGCI Bossou » apparaît, sélectionnable.
- [ ] Après sélection, `current_boutique_id` pris en compte (les données filtrées sur la bonne boutique).
- [ ] **APK** : installer le fichier, ouvrir, se connecter avec le même compte → arrive sur le tableau de bord.
- [ ] **APK** : le sélecteur de boutique fonctionne (BoutiqueSelector).

## B. Tableau de bord
- [ ] **Web** : chiffres (CA du jour, nb ventes, nb clients, stock faible) s'affichent.
- [ ] **Web** : graphique « ventes mensuelles » se charge (analytics).
- [ ] **APK** : onglet accueil / tableau de bord affiche les KPIs sans erreur.

## C. Caisse (cœur)
- [ ] **Web** `/caisse` : ajouter un produit au panier (recherche par nom ou scan).
- [ ] Quantité modifiable, TVA appliquée (18% par défaut), calcul du total correct.
- [ ] Valider la vente (payer) → **vente enregistrée**, transaction **téléscopique OK** (stock décrémenté, statut `termine`).
- [ ] Ticket / facture généré (PDF consultable).
- [ ] **APK** `/caisse` : même test (recherche produit + vente).
- [ ] Mode **hors-ligne** : couper le réseau, faire une vente → mise en file d'attente (`offline-caisse`), puis resynchroniser au retour du réseau (`sync-offline-caisse`).
- [ ] **APK** : scan code-barres/Qté (expo-camera) ajoute le bon produit.

## D. Produits & stock
- [ ] **Web** `/produits` : liste des produits (nom, prix, stock).
- [ ] Créer un produit (nom, prix, stock, code-barres) → apparaît dans la liste.
- [ ] Modifier un produit (prix/stock) → mis à jour.
- [ ] Supprimer / désactiver un produit.
- [ ] **Web** `/stock` : le stock reflète la vente faite en §C (décrémenté).
- [ ] **Web** `/inventaire` : lancer un comptage, enregistrer, voir l'écart.
- [ ] **APK** `/produits` + `/stock` + `/inventaire` : mêmes manipulations de base.

## E. Équipe & rôles (nouveaux endpoints)
- [ ] **Web** `/boutiques/[id]/equipe` : Josue apparaît comme propriétaire.
- [ ] Ajouter un membre (ex. `caissier.temp@sgci.bj` / un mot de passe) → message « Membre ajouté à l'équipe ».
- [ ] Le nouveau membre apparaît dans la liste avec son rôle.
- [ ] Modifier son rôle (propriétaire/gerant/caissier).
- [ ] Supprimer/retirer le membre test → disparaît de la liste.
- [ ] **Web** `/parametres` (gestion d'équipe / UsersManagement) : inviter, exporter (CSV), importer.
- [ ] **APK** : `UsersManagement` → même vérification (ajouter/supprimer membre).

## F. Paramètres boutique
- [ ] **Web** `/parametres` : nom boutique = « SGCI Bossou », devise XOF, TVA 18%, délai annulation 5 min.
- [ ] Modifier une valeur (ex. TVA → 18.5) → sauvegardé.
- [ ] Recharger → la valeur modifiée est conservée (persistance).
- [ ] Remettre la valeur d'origine.
- [ ] **APK** `/parametres` : lecture des réglages (TVA/délai) cohérente.

## G. Clients
- [ ] **Web** `/clients` : liste des clients.
- [ ] Créer un client (nom, téléphone, email) → apparaît.
- [ ] Modifier / supprimer un client.
- [ ] Une vente (§C) peut être rattachée à un client.
- [ ] **APK** `/clients` : création + liste.

## H. Fidélité / programmes
- [ ] **Web** : consulter les programmes de fidélité (ex. « Test Pro » dispo).
- [ ] Créer un programme, définir seuils/récompenses.
- [ ] **APK** : consulter la fidélité d'un client.

## I. Devis
- [ ] **Web** `/devis` : créer un devis (produits, quantités, client).
- [ ] Statut initial correct (ex. `devis` / `en_attente`).
- [ ] Convertir un devis en vente → caisse créée.
- [ ] **APK** `/devis` : création de base.

## J. Retours
- [ ] **Web** `/retours` : créer un retour sur une vente → stock recrédité (mouvement `entree` / `accepte`).
- [ ] **APK** `/retours` : déclarer un retour.

## K. Arrivage & transferts de stock
- [ ] **Web** `/arrivage` : enregistrer un arrivage (produit reçu + quantité) → stock augmenté.
- [ ] **Web** : transfert de stock entre boutiques (si multi-boutiques).
- [ ] **APK** `/arrivage` : enregistrer un arrivage.

## L. Analytique
- [ ] **Web** `/analytics` : KPIs + « ventes mensuelles » s'affichent.
- [ ] **APK** `/analytics` : les graphiques/valeurs se chargent.

## M. IA
- [ ] **Web** `/ia` : la fonction IA (recommandations/prédiction) répond.
- [ ] **APK** `/ia` : charge sans erreur.

## N. Messages & notifications
- [ ] **Web** `/messages` : lister/envoyer un message.
- [ ] **APK** : notification push reçue (permission accordée) pour un événement (ex. commande).
- [ ] Cloche de notification (`NotificationBell`) fonctionne.

## O. Rôles / permissions
- [ ] Se déconnecter de Josue, se connecter avec `gerant@sgci.bj` → ne peut PAS faire les actions propriétaire (message 403 attendu).
- [ ] Se connecter avec `caissier@sgci.bj` → limité à la caisse (+ 403 sur les zones interdites).

## P. Déconnexion & persistance
- [ ] Se déconnecter → retour login.
- [ ] Se reconnecter → données conservées (token valide, pas d'écran vide).
- [ ] **APK** : couper/rétablir le réseau → l'app ne crashe pas, messages d'erreur propres.

---

## Bonus / Points durs
- [ ] **Paiement Mobile-Money (Paiement réel)** : si intégré, tester un paiement avec le flux MoMo (que retourne le backend ? 400 attendu sans creds réels, pas un 500).
- [ ] **Export CSV utilisateurs** (backend `/users/export`) : télécharger un CSV valide.
- [ ] **Import CSV utilisateurs** (backend `/users/import`) : fichier bien formé importé.
- [ ] **PDF facture (web)** : impression/téléchargement.
- [ ] **APK : taille 112 MB** — ok pour ton usage (Gradle Build interne) ; production = AAB léger pour Play Store.

## Comment signaler un bug
Note : module + page/onglet + écran (web/APK) + action + message/statut HTTP reçu + capture si possible.