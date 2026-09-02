#!/bin/bash
set -e

if [ -n "$MYSQL_URL" ]; then
    DB_HOST=$(echo "$MYSQL_URL" | sed -n 's|.*://[^:]*:[^@]*@\([^:]*\):.*|\1|p')
    DB_PORT=$(echo "$MYSQL_URL" | sed -n 's|.*@[^:]*:\([0-9]*\)/.*|\1|p')
    DB_DATABASE=$(echo "$MYSQL_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
    DB_USERNAME=$(echo "$MYSQL_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
    DB_PASSWORD=$(echo "$MYSQL_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')

    export DB_CONNECTION=mysql
    export DB_HOST="${DB_HOST:-mysql.railway.internal}"
    export DB_PORT="${DB_PORT:-3306}"
    export DB_DATABASE="${DB_DATABASE:-railway}"
    export DB_USERNAME="${DB_USERNAME:-railway}"
    export DB_PASSWORD="${DB_PASSWORD:-railway}"
fi

php artisan config:cache
php artisan route:cache
php artisan view:cache 2>/dev/null || true
php artisan migrate --force

# Seed uniquement sur une base de données fraîche (aucune table remplie),
# pour ne jamais écraser les données existantes à chaque redémarrage.
SEEDED=$(php artisan tinker --execute="echo \\App\\Models\\User::count();" 2>/dev/null || echo "-1")
if [ "$SEEDED" = "0" ] || [ "$SEEDED" = "-1" ]; then
    php artisan db:seed --force 2>/dev/null || true
fi

php artisan serve --host=0.0.0.0 --port=${PORT:-8000}
