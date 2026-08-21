# SGCI Backend API

<p align="center">
  <a href="https://laravel.com" target="_blank"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="400" alt="Laravel Logo"></a>
</p>

<p align="center">
  Système de Gestion Commerciale Intelligente - Backend API
</p>

## About SGCI

SGCI (Système de Gestion Commerciale Intelligente) is a comprehensive commercial management system designed for retail businesses in Benin. This backend API provides:

- Multi-tenant boutique management
- Product inventory management
- Sales and transaction processing
- Customer relationship management
- Stock movement tracking
- Analytics and reporting
- User authentication and authorization
- Audit logging
- Rate limiting and security features

## Features

### Core Features
- **Multi-Tenancy**: Support for multiple boutiques with role-based access control
- **Authentication**: JWT-based authentication with Laravel Sanctum
- **Validation**: FormRequest validation for all endpoints
- **Error Handling**: Centralized error handling with consistent API responses
- **Audit Logging**: Comprehensive audit trail for sensitive actions
- **Rate Limiting**: Throttling on sensitive endpoints
- **Pagination**: Consistent pagination across all list endpoints
- **Soft Deletes**: Data recovery with soft delete functionality
- **Database Indexes**: Optimized queries with proper indexing
- **Caching**: Redis caching for analytics endpoints

### API Endpoints

#### Authentication
- `POST /api/login` - User login
- `POST /api/register` - User registration
- `POST /api/logout` - User logout
- `POST /api/refresh` - Refresh JWT token
- `POST /api/switch-boutique` - Switch active boutique

#### Products
- `GET /api/produits` - List products (paginated)
- `POST /api/produits` - Create product
- `GET /api/produits/{id}` - Get product details
- `PUT /api/produits/{id}` - Update product
- `DELETE /api/produits/{id}` - Delete product

#### Sales
- `GET /api/ventes` - List sales (paginated)
- `POST /api/ventes` - Create sale
- `GET /api/ventes/{id}` - Get sale details
- `POST /api/ventes/{id}/annuler` - Cancel sale

#### Customers
- `GET /api/clients` - List customers (paginated)
- `POST /api/clients` - Create customer
- `GET /api/clients/{id}` - Get customer details
- `PUT /api/clients/{id}` - Update customer
- `DELETE /api/clients/{id}` - Delete customer

#### Stock Movements
- `GET /api/mouvements-stock` - List stock movements (paginated)
- `POST /api/mouvements-stock` - Create stock movement
- `POST /api/mouvements-stock/{id}/valider` - Validate stock movement

#### Categories
- `GET /api/categories` - List categories (paginated)
- `POST /api/categories` - Create category
- `GET /api/categories/{id}` - Get category details
- `PUT /api/categories/{id}` - Update category
- `DELETE /api/categories/{id}` - Delete category

#### Users
- `GET /api/users` - List users (paginated)
- `POST /api/users` - Create user
- `GET /api/users/{id}` - Get user details
- `PUT /api/users/{id}` - Update user
- `DELETE /api/users/{id}` - Delete user

## Requirements

- PHP >= 8.2
- Composer
- MySQL >= 8.0 or PostgreSQL >= 13
- Redis (optional, for caching)
- Laravel 11.x

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd sgci-backend
```

2. Install dependencies:
```bash
composer install
```

3. Copy environment file:
```bash
cp .env.example .env
```

4. Generate application key:
```bash
php artisan key:generate
```

5. Configure database in `.env`:
```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=sgci
DB_USERNAME=your_username
DB_PASSWORD=your_password
```

6. Run migrations:
```bash
php artisan migrate
```

7. Seed the database:
```bash
php artisan db:seed
```

8. Start the development server:
```bash
php artisan serve
```

The API will be available at `http://localhost:8000`

## Testing

Run the test suite:
```bash
php artisan test
```

Run tests with coverage:
```bash
php artisan test --coverage
```

## Security Features

- **Rate Limiting**: Throttling on login, password reset, and sensitive endpoints
- **Authentication**: JWT tokens with Laravel Sanctum
- **Authorization**: Role-based access control (proprietaire, gerant, caissier)
- **Validation**: FormRequest validation on all endpoints
- **CSRF Protection**: Enabled for web routes
- **SQL Injection Prevention**: Eloquent ORM with parameter binding
- **XSS Protection**: Input sanitization and output escaping

## API Documentation

API documentation is available at `/api/documentation` (when Swagger is configured).

## Project Structure

```
app/
├── Http/
│   ├── Controllers/
│   │   └── API/          # API Controllers
│   ├── Middleware/        # Custom Middleware
│   ├── Requests/          # FormRequest Validation
│   └── Controllers/       # Base Controller
├── Models/                # Eloquent Models
├── Services/              # Business Logic Services
└── ...
database/
├── migrations/            # Database Migrations
└── seeders/               # Database Seeders
routes/
└── api.php               # API Routes
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

The SGCI project is proprietary software. All rights reserved.

## Support

For support, please contact the development team.
