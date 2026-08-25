#!/bin/bash
# ============================================================================
# SGCI Bénin — Script d'installation serveur Laravel Forge
# ============================================================================
# Ce script est exécuté sur le VPS après le premier deploy Forge.
# Il installe les dépendances système, configure PHP, Nginx, et la DB.
# ============================================================================

set -e

echo "🔧 SGCI Bénin — Installation serveur..."

# --- 1. Variables (à adapter) ---
DB_NAME="sgci"
DB_USER="sgci_user"
DB_PASS="CHANGEZ_MOI"  # Générer un mot de passe fort
APP_URL="https://votre-domaine.com"  # Ou l'IP du VPS

# --- 2. Mise à jour système ---
apt-get update -y && apt-get upgrade -y

# --- 3. PHP extensions nécessaires ---
apt-get install -y php8.2-mbstring php8.2-xml php8.2-curl php8.2-zip php8.2-gd php8.2-sqlite3 php8.2-bcmath php8.2-intl

# --- 4. Composer (si pas installé par Forge) ---
if ! command -v composer &> /dev/null; then
    curl -sS https://getcomposer.org/installer | php
    mv composer.phar /usr/local/bin/composer
fi

# --- 5. Node.js (pour frontend si servis depuis le même VPS) ---
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# --- 6. Redis (pour cache) ---
apt-get install -y redis-server
systemctl enable redis-server
systemctl start redis-server

# --- 7. Permissions ---
cd /home/forge/your-site.com  # Adapter le chemin Forge
chown -R www-data:www-data storage bootstrap/cache
chmod -R 775 storage bootstrap/cache

# --- 8. .env.production ---
if [ ! -f .env ]; then
    cp .env.example .env
    php artisan key:generate
fi

# --- 9. Migration + Seed ---
php artisan migrate --force
php artisan db:seed --force

# --- 10. Storage link ---
php artisan storage:link

# --- 11. Cache optimisé ---
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

# --- 12. Queue worker (systemd) ---
cat > /etc/systemd/system/sgci-worker.service << 'EOF'
[Unit]
Description=SGCI Queue Worker
After=mysql.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/home/forge/your-site.com
ExecStart=/usr/bin/php artisan queue:work --sleep=3 --tries=3 --max-time=3600
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable sgci-worker
systemctl start sgci-worker

# --- 13. Scheduler cron (Forge gère souvent ça, mais au cas) ---
# Forge ajoute déjà : * * * * * cd /path-to-project && php artisan schedule:run
# Vérifier que c'est en place :
(crontab -l 2>/dev/null | grep -q "schedule:run") || \
    echo "* * * * * cd /home/forge/your-site.com && php artisan schedule:run >> /dev/null 2>&1" | crontab -

echo ""
echo "✅ Serveur SGCI installé !"
echo ""
echo "📋 Prochaines étapes :"
echo "  1. Configurer le DNS (A record → IP du VPS)"
echo "  2. Ajouter le SSL (Let's Encrypt via Forge)"
echo "  3. Configurer les variables d'environnement dans Forge"
echo "  4. Connecter le repo GitHub dans Forge"
echo ""
