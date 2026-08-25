#!/bin/bash
# ============================================================================
# SGCI Bénin — Post-deploy hook (Forge / Deployer)
# ============================================================================
# Ce script tourne à chaque git push sur le serveur.
# Forge: le placer dans le "Deploy Script" de la site card.
# ============================================================================

cd /home/forge/your-site.com

# Installer les dépendances PHP
composer install --no-interaction --prefer-dist --optimize-autoloader

# Caches
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

# Migrations (sans interactif, en prod)
php artisan migrate --force

# Storage link
php artisan storage:link 2>/dev/null || true

# Redémarrer les workers
php artisan queue:restart

echo "✅ Deploy SGCI terminé !"
