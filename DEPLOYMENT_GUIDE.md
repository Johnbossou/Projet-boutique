# SGCI Deployment Guide

This guide provides comprehensive instructions for deploying the SGCI (Système de Gestion Commerciale Intelligente) system to production.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Backend Deployment](#backend-deployment)
- [Frontend Deployment](#frontend-deployment)
- [Mobile Deployment](#mobile-deployment)
- [Infrastructure Recommendations](#infrastructure-recommendations)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **PHP**: >= 8.2
- **Composer**: >= 2.0
- **Node.js**: >= 18.x
- **npm/yarn/pnpm**: Latest version
- **MySQL**: >= 8.0 or PostgreSQL >= 13
- **Redis**: >= 6.0 (for caching and queue)
- **Nginx** or **Apache**: Web server
- **SSL Certificate**: For HTTPS (Let's Encrypt recommended)

### Required Services

- Database server (MySQL/PostgreSQL)
- Redis server
- SMTP server (for emails, optional)
- File storage (local or cloud like AWS S3)

---

## Backend Deployment

### 1. Server Setup

#### Ubuntu/Debian

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install PHP and extensions
sudo apt install php8.2 php8.2-fpm php8.2-mysql php8.2-redis php8.2-mbstring php8.2-xml php8.2-curl php8.2-zip php8.2-bcmath php8.2-gd -y

# Install Composer
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer

# Install Nginx
sudo apt install nginx -y

# Install Redis
sudo apt install redis-server -y
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Install MySQL
sudo apt install mysql-server -y
sudo mysql_secure_installation
```

#### CentOS/RHEL

```bash
# Update system
sudo yum update -y

# Install PHP and extensions
sudo yum install php php-fpm php-mysqlnd php-pecl-redis php-mbstring php-xml php-curl php-zip php-bcmath php-gd -y

# Install Composer
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer

# Install Nginx
sudo yum install nginx -y

# Install Redis
sudo yum install redis -y
sudo systemctl enable redis
sudo systemctl start redis

# Install MySQL
sudo yum install mysql-server -y
sudo systemctl enable mysqld
sudo systemctl start mysqld
sudo mysql_secure_installation
```

### 2. Database Setup

```bash
# Login to MySQL
sudo mysql -u root -p

# Create database and user
CREATE DATABASE sgci CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'sgci_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON sgci.* TO 'sgci_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3. Deploy Application

```bash
# Clone repository
cd /var/www
git clone <repository-url> sgci-backend
cd sgci-backend

# Install dependencies
composer install --no-dev --optimize-autoloader

# Copy environment file
cp .env.example .env

# Edit environment file
nano .env
```

Update the following variables in `.env`:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-domain.com

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=sgci
DB_USERNAME=sgci_user
DB_PASSWORD=your_secure_password

CACHE_STORE=redis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

QUEUE_CONNECTION=redis
```

### 4. Run Migrations

```bash
# Generate application key
php artisan key:generate

# Run migrations
php artisan migrate --force

# Seed database (optional)
php artisan db:seed --force

# Clear and cache configurations
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### 5. Set Permissions

```bash
# Set ownership
sudo chown -R www-data:www-data /var/www/sgci-backend
sudo chmod -R 755 /var/www/sgci-backend
sudo chmod -R 775 /var/www/sgci-backend/storage
sudo chmod -R 775 /var/www/sgci-backend/bootstrap/cache
```

### 6. Configure Nginx

Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/sgci-backend
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name api.your-domain.com;
    root /var/www/sgci-backend/public;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    index index.php;

    charset utf-8;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/sgci-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7. Configure SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain SSL certificate
sudo certbot --nginx -d api.your-domain.com

# Auto-renewal is configured automatically
```

### 8. Configure Supervisor for Queue Workers

```bash
# Install Supervisor
sudo apt install supervisor -y

# Create queue worker configuration
sudo nano /etc/supervisor/conf.d/sgci-worker.conf
```

Add the following:

```ini
[program:sgci-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/sgci-backend/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/var/www/sgci-backend/storage/logs/worker.log
stopwaitsecs=3600
```

Start the supervisor:

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start sgci-worker:*
```

### 9. Configure Cron Jobs

```bash
sudo crontab -e
```

Add the following:

```cron
* * * * * cd /var/www/sgci-backend && php artisan schedule:run >> /dev/null 2>&1
```

---

## Frontend Deployment

### Option 1: Vercel (Recommended)

1. **Push to GitHub**

```bash
cd sgci-frontend
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo>
git push -u origin main
```

2. **Deploy to Vercel**

- Go to [vercel.com](https://vercel.com)
- Click "New Project"
- Import your GitHub repository
- Configure environment variables:
  - `NEXT_PUBLIC_API_URL`: Your backend API URL (e.g., `https://api.your-domain.com/api`)
  - `NEXT_PUBLIC_APP_URL`: Your frontend URL (e.g., `https://your-domain.com`)
- Click "Deploy"

3. **Configure Custom Domain**

- In Vercel project settings, add your custom domain
- Update DNS records as instructed by Vercel
- SSL is automatically configured

### Option 2: Docker

1. **Build Docker Image**

```bash
cd sgci-frontend
docker build -t sgci-frontend .
```

2. **Run Container**

```bash
docker run -d \
  -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=https://api.your-domain.com/api \
  -e NEXT_PUBLIC_APP_URL=https://your-domain.com \
  --name sgci-frontend \
  sgci-frontend
```

3. **Configure Nginx Reverse Proxy**

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Option 3: VPS Deployment

1. **Build for Production**

```bash
cd sgci-frontend
npm install
npm run build
```

2. **Install PM2**

```bash
npm install -g pm2
```

3. **Start with PM2**

```bash
pm2 start npm --name "sgci-frontend" -- start
pm2 save
pm2 startup
```

4. **Configure Nginx**

Same as Docker option above.

---

## Mobile Deployment

### Option 1: Expo EAS Build (Recommended)

1. **Configure EAS**

```bash
cd sgci-mobile/mobile-vs-emulator
npm install -g eas-cli
eas build:configure
```

2. **Update Environment Variables**

Update `.env`:

```env
EXPO_PUBLIC_API_URL=https://api.your-domain.com/api
```

3. **Build for iOS**

```bash
eas build --platform ios
```

4. **Build for Android**

```bash
eas build --platform android
```

5. **Submit to App Stores**

- **iOS**: Submit to App Store Connect via EAS Submit
- **Android**: Upload APK/AAB to Google Play Console

### Option 2: Standalone APK

1. **Build APK**

```bash
cd sgci-mobile/mobile-vs-emulator
eas build --platform android --profile preview
```

2. **Distribute APK**

- Download the APK from EAS
- Host on your server or distribute via email/link
- Users can install directly (requires "Install from unknown sources" permission)

### Option 3: Expo Go (Development Only)

For quick testing without building:

```bash
npx expo start
```

Users scan QR code with Expo Go app.

---

## Infrastructure Recommendations

### Production Architecture

```
┌─────────────────┐
│   Load Balancer │ (Nginx/Cloudflare)
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│ Front │ │ Backend│
│  end  │ │  API   │
└───┬───┘ └──┬─────┘
    │        │
    │    ┌───▼────┐
    │    │ Redis  │
    │    │  Cache │
    │    └────────┘
    │
┌───▼────────┐
│   MySQL     │
│  Database   │
└─────────────┘
```

### Recommended Hosting Providers

- **Backend**: DigitalOcean, AWS EC2, Linode, Hetzner
- **Frontend**: Vercel, Netlify, AWS CloudFront
- **Mobile**: Expo EAS Build
- **Database**: AWS RDS, DigitalOcean Managed Database
- **Redis**: Redis Labs, AWS ElastiCache

### Server Requirements

#### Minimum (Small Business)

- **CPU**: 2 cores
- **RAM**: 4 GB
- **Storage**: 40 GB SSD
- **Bandwidth**: 2 TB/month

#### Recommended (Growing Business)

- **CPU**: 4 cores
- **RAM**: 8 GB
- **Storage**: 80 GB SSD
- **Bandwidth**: 5 TB/month

#### High Performance (Enterprise)

- **CPU**: 8+ cores
- **RAM**: 16+ GB
- **Storage**: 200+ GB SSD
- **Bandwidth**: 10+ TB/month
- **CDN**: Cloudflare, AWS CloudFront

---

## Monitoring and Maintenance

### 1. Application Monitoring

#### Laravel Telescope (Development)

```bash
composer require laravel/telescope
php artisan telescope:install
php artisan migrate
```

#### Production Monitoring

- **Sentry**: Error tracking
- **New Relic**: APM monitoring
- **Datadog**: Infrastructure monitoring
- **Uptime Robot**: Uptime monitoring

### 2. Log Management

```bash
# View Laravel logs
tail -f /var/www/sgci-backend/storage/logs/laravel.log

# View Nginx logs
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log

# View PHP-FPM logs
tail -f /var/log/php8.2-fpm.log
```

### 3. Database Backups

#### Automated Backups

```bash
# Create backup script
sudo nano /usr/local/bin/backup-sgci.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/sgci"
mkdir -p $BACKUP_DIR

# Backup database
mysqldump -u sgci_user -p'your_password' sgci > $BACKUP_DIR/sgci_$DATE.sql

# Backup files
tar -czf $BACKUP_DIR/files_$DATE.tar.gz /var/www/sgci-backend/storage/app

# Keep only last 7 days
find $BACKUP_DIR -type f -mtime +7 -delete
```

```bash
# Make executable
sudo chmod +x /usr/local/bin/backup-sgci.sh

# Add to cron (daily at 2 AM)
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-sgci.sh
```

### 4. Security Updates

```bash
# Update system regularly
sudo apt update && sudo apt upgrade -y

# Update PHP dependencies
cd /var/www/sgci-backend
composer update

# Update Node dependencies
cd /var/www/sgci-frontend
npm update
```

### 5. SSL Certificate Renewal

Let's Encrypt auto-renews by default. Verify:

```bash
sudo certbot renew --dry-run
```

---

## Troubleshooting

### Backend Issues

#### 500 Internal Server Error

```bash
# Check Laravel logs
tail -f /var/www/sgci-backend/storage/logs/laravel.log

# Check Nginx error logs
tail -f /var/log/nginx/error.log

# Check PHP-FPM status
sudo systemctl status php8.2-fpm

# Clear Laravel cache
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear
```

#### Database Connection Failed

```bash
# Check MySQL status
sudo systemctl status mysql

# Test connection
mysql -u sgci_user -p sgci

# Check .env configuration
cat /var/www/sgci-backend/.env
```

#### Queue Not Processing

```bash
# Check Supervisor status
sudo supervisorctl status

# Restart queue worker
sudo supervisorctl restart sgci-worker:*

# Check queue logs
tail -f /var/www/sgci-backend/storage/logs/worker.log
```

### Frontend Issues

#### Build Fails

```bash
# Clear Next.js cache
rm -rf .next
rm -rf node_modules
npm install
npm run build
```

#### Environment Variables Not Loading

```bash
# Verify .env.local exists
ls -la .env.local

# Restart development server
npm run dev
```

### Mobile Issues

#### Build Fails

```bash
# Clear Expo cache
npx expo start -c

# Update dependencies
npm install
npx expo install --fix
```

#### API Connection Issues

- Verify `EXPO_PUBLIC_API_URL` is correct
- Check backend API is accessible
- Verify SSL certificate is valid
- Check network connectivity

---

## Security Best Practices

1. **Always use HTTPS** in production
2. **Keep dependencies updated** regularly
3. **Use strong passwords** for database and admin accounts
4. **Enable firewall** (UFW on Ubuntu)
5. **Disable root SSH login**
6. **Use SSH keys** instead of passwords
7. **Regular backups** with off-site storage
8. **Monitor logs** for suspicious activity
9. **Rate limit API endpoints**
10. **Implement CORS** properly

---

## Support

For deployment issues or questions, contact the development team.
