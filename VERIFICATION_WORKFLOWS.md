# ✅ Checklist Vérification Workflows SGCI Bénin v2.0

## Pré-tests obligatoires

### 1. Backend
- [ ] Exécuter migrations: `php artisan migrate`
- [ ] Démarrer serveur: `php artisan serve`
- [ ] Vérifier API: `GET /api/health` → status OK
- [ ] Configurer Firebase (si FCM testé)

### 2. Frontend
- [ ] Démarrer: `npm run dev`
- [ ] Login: `gerant@sgci.bj` / `password`
- [ ] Vérifier dashboard affiche données
- [ ] Vérifier navigation fonctionne

### 3. Mobile
- [ ] Démarrer: `npx expo start`
- [ ] Login fonctionne
- [ ] Scan code-barres fonctionne

---

## Workflows à tester

### 🔐 Authentification
- [ ] Login réussi
- [ ] Logout fonctionne
- [ ] Token refresh automatique
- [ ] Protection routes (401 sans token)

### 🛒 Vente
- [ ] Créer brouillon vente
- [ ] Ajouter produits au panier
- [ ] Checkout avec paiement
- [ ] Finaliser vente (stock décrémenté)
- [ ] Annuler vente (stock restauré)
- [ ] Génération facture PDF

### 📦 Produits
- [ ] Liste produits affiche
- [ ] Créer produit (gérant)
- [ ] Modifier produit
- [ ] Supprimer produit (gérant)
- [ ] Scan code-barres produit
- [ ] Upload image produit

### 📊 Stock
- [ ] Créer mouvement entrée
- [ ] Créer mouvement sortie
- [ ] Valider arrivage (gérant)
- [ ] Rejeter arrivage (gérant)
- [ ] Alertes stock affichent

### 👥 Clients
- [ ] Créer client
- [ ] Modifier client
- [ ] Promouvoir VIP (gérant)
- [ ] Historique commandes

### 🤖 IA/Analytics
- [ ] Prédictions demande affichent
- [ ] Recommandations réapprovisionnement
- [ ] Cross-selling fonctionne
- [ ] Métriques performance IA

### 🔔 Notifications
- [ ] Notifications in-app affichent
- [ ] Marquer comme lu
- [ ] FCM register (si Firebase config)
- [ ] Alertes stock automatiques

### 📱 Offline (Mobile)
- [ ] Mode offline détecté
- [ ] Vente offline stockée
- [ ] Sync batch fonctionne
- [ ] Conflict resolution

---

## Points critiques

1. **Migrations**: 2 migrations en attente doivent être exécutées
2. **Firebase**: Configurer pour tester FCM (optionnel pour tests basiques)
3. **Scheduler**: Activer crontab pour tâches automatisées
4. **Queue**: Configurer Redis pour production

---

**Prêt pour tests?** Exécuter checklist complète avant de commencer.
