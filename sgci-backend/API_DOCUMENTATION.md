# SGCI API Documentation

## Base URL

```
http://localhost:8000/api
```

## Authentication

All endpoints (except authentication endpoints) require a JWT token in the Authorization header:

```
Authorization: Bearer {token}
```

## Response Format

All API responses follow this format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "errors": { ... }
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "current_page": 1,
    "per_page": 20,
    "total": 100,
    "last_page": 5,
    "from": 1,
    "to": 20
  }
}
```

---

## Authentication Endpoints

### Login
**POST** `/login`

Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "user@example.com",
      "role": "proprietaire",
      "current_boutique_id": 1,
      "boutiques": [ ... ]
    }
  }
}
```

**Rate Limiting:** 5 requests per minute

---

### Register
**POST** `/register`

Register a new user.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "user@example.com",
  "password": "password",
  "password_confirmation": "password",
  "role": "gerant",
  "telephone": "+22912345678"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "John Doe",
    "email": "user@example.com",
    "role": "gerant"
  }
}
```

---

### Logout
**POST** `/logout`

Logout the authenticated user.

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully logged out"
}
```

---

### Refresh Token
**POST** `/refresh`

Refresh the JWT token.

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
  }
}
```

---

### Switch Boutique
**POST** `/switch-boutique`

Switch the active boutique for proprietaire users.

**Headers:**
```
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "boutique_id": 2
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "current_boutique_id": 2,
    "current_boutique": {
      "id": 2,
      "nom": "Boutique 2",
      "adresse": "123 Main St"
    }
  }
}
```

---

## Product Endpoints

### List Products
**GET** `/produits`

Get paginated list of products.

**Headers:**
```
Authorization: Bearer {token}
```

**Query Parameters:**
- `page` (integer, optional): Page number (default: 1)
- `per_page` (integer, optional): Items per page (default: 20, max: 100)
- `search` (string, optional): Search by name or code
- `categorie_id` (integer, optional): Filter by category
- `sort_by` (string, optional): Sort field (default: created_at)
- `sort_order` (string, optional): Sort direction (asc/desc, default: desc)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "nom": "Product Name",
      "description": "Product description",
      "prix": 10.50,
      "quantite_stock": 100,
      "seuil_alerte": 10,
      "categorie_id": 1,
      "est_perissable": false,
      "code_qr": "QR123456",
      "unite_mesure": "unit",
      "image_url": "https://example.com/image.jpg",
      "boutique_id": 1,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 20,
    "total": 100,
    "last_page": 5,
    "from": 1,
    "to": 20
  }
}
```

---

### Create Product
**POST** `/produits`

Create a new product.

**Headers:**
```
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "nom": "Product Name",
  "description": "Product description",
  "prix": 10.50,
  "quantite_stock": 100,
  "seuil_alerte": 10,
  "categorie_id": 1,
  "est_perissable": false,
  "code_qr": "QR123456",
  "unite_mesure": "unit",
  "image_url": "https://example.com/image.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nom": "Product Name",
    "prix": 10.50,
    "quantite_stock": 100
  }
}
```

---

### Get Product
**GET** `/produits/{id}`

Get details of a specific product.

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nom": "Product Name",
    "description": "Product description",
    "prix": 10.50,
    "quantite_stock": 100,
    "seuil_alerte": 10,
    "categorie_id": 1,
    "categorie": {
      "id": 1,
      "nom": "Category Name"
    },
    "boutique_id": 1,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

---

### Update Product
**PUT** `/produits/{id}`

Update a product.

**Headers:**
```
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "nom": "Updated Product Name",
  "description": "Updated description",
  "prix": 15.00,
  "quantite_stock": 150
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nom": "Updated Product Name",
    "prix": 15.00,
    "quantite_stock": 150
  }
}
```

---

### Delete Product
**DELETE** `/produits/{id}`

Soft delete a product.

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

---

## Sales Endpoints

### List Sales
**GET** `/ventes`

Get paginated list of sales.

**Headers:**
```
Authorization: Bearer {token}
```

**Query Parameters:**
- `page` (integer, optional): Page number (default: 1)
- `per_page` (integer, optional): Items per page (default: 20, max: 100)
- `date_from` (date, optional): Filter by date range start
- `date_to` (date, optional): Filter by date range end
- `statut` (string, optional): Filter by status (en_cours, payee, annule)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "numero_vente": "VTE-2024-001",
      "montant_total": 150.00,
      "tva": 25.00,
      "remise": 0.00,
      "statut": "payee",
      "mode_paiement": "especes",
      "user_id": 1,
      "client_id": 1,
      "boutique_id": 1,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

---

### Create Sale
**POST** `/ventes`

Create a new sale.

**Headers:**
```
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "client_id": 1,
  "montant_total": 150.00,
  "tva": 25.00,
  "remise": 0.00,
  "mode_paiement": "especes",
  "montant_recu": 150.00,
  "produits": [
    {
      "produit_id": 1,
      "quantite": 2,
      "prix_unitaire": 10.00
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "numero_vente": "VTE-2024-001",
    "montant_total": 150.00,
    "statut": "payee"
  }
}
```

---

### Get Sale
**GET** `/ventes/{id}`

Get details of a specific sale.

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "numero_vente": "VTE-2024-001",
    "montant_total": 150.00,
    "tva": 25.00,
    "remise": 0.00,
    "statut": "payee",
    "mode_paiement": "especes",
    "user": {
      "id": 1,
      "name": "John Doe"
    },
    "client": {
      "id": 1,
      "nom": "Client Name"
    },
    "ligne_ventes": [ ... ]
  }
}
```

---

### Cancel Sale
**POST** `/ventes/{id}/annuler`

Cancel a sale.

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "statut": "annule"
  }
}
```

---

## Customer Endpoints

### List Customers
**GET** `/clients`

Get paginated list of customers.

**Headers:**
```
Authorization: Bearer {token}
```

**Query Parameters:**
- `page` (integer, optional): Page number (default: 1)
- `per_page` (integer, optional): Items per page (default: 20, max: 100)
- `search` (string, optional): Search by name, email, or phone

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "nom": "Client Name",
      "email": "client@example.com",
      "telephone": "+22912345678",
      "adresse": "123 Main St",
      "ville": "Cotonou",
      "statut": "actif",
      "total_achats": 500.00,
      "nombre_commandes": 10,
      "boutique_id": 1
    }
  ],
  "pagination": { ... }
}
```

---

### Create Customer
**POST** `/clients`

Create a new customer.

**Headers:**
```
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "nom": "Client Name",
  "email": "client@example.com",
  "telephone": "+22912345678",
  "adresse": "123 Main St",
  "ville": "Cotonou"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nom": "Client Name",
    "email": "client@example.com"
  }
}
```

---

### Get Customer
**GET** `/clients/{id}`

Get details of a specific customer.

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nom": "Client Name",
    "email": "client@example.com",
    "telephone": "+22912345678",
    "adresse": "123 Main St",
    "ville": "Cotonou",
    "statut": "actif",
    "total_achats": 500.00,
    "nombre_commandes": 10,
    "boutique_id": 1
  }
}
```

---

### Update Customer
**PUT** `/clients/{id}`

Update a customer.

**Headers:**
```
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "nom": "Updated Client Name",
  "telephone": "+22987654321"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nom": "Updated Client Name",
    "telephone": "+22987654321"
  }
}
```

---

### Delete Customer
**DELETE** `/clients/{id}`

Soft delete a customer.

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Customer deleted successfully"
}
```

---

## Category Endpoints

### List Categories
**GET** `/categories`

Get paginated list of categories.

**Headers:**
```
Authorization: Bearer {token}
```

**Query Parameters:**
- `page` (integer, optional): Page number (default: 1)
- `per_page` (integer, optional): Items per page (default: 20, max: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "nom": "Category Name",
      "description": "Category description",
      "couleur": "#FF5733",
      "icone": "shopping-cart",
      "boutique_id": 1
    }
  ],
  "pagination": { ... }
}
```

---

### Create Category
**POST** `/categories`

Create a new category.

**Headers:**
```
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "nom": "Category Name",
  "description": "Category description",
  "couleur": "#FF5733",
  "icone": "shopping-cart"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nom": "Category Name",
    "description": "Category description"
  }
}
```

---

### Get Category
**GET** `/categories/{id}`

Get details of a specific category.

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nom": "Category Name",
    "description": "Category description",
    "couleur": "#FF5733",
    "icone": "shopping-cart",
    "boutique_id": 1,
    "produits_count": 50
  }
}
```

---

### Update Category
**PUT** `/categories/{id}`

Update a category.

**Headers:**
```
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "nom": "Updated Category Name",
  "description": "Updated description"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nom": "Updated Category Name",
    "description": "Updated description"
  }
}
```

---

### Delete Category
**DELETE** `/categories/{id}`

Soft delete a category.

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Category deleted successfully"
}
```

---

## Stock Movement Endpoints

### List Stock Movements
**GET** `/mouvements-stock`

Get paginated list of stock movements.

**Headers:**
```
Authorization: Bearer {token}
```

**Query Parameters:**
- `page` (integer, optional): Page number (default: 1)
- `per_page` (integer, optional): Items per page (default: 20, max: 100)
- `type` (string, optional): Filter by type (entree, sortie)
- `raison` (string, optional): Filter by reason
- `date_from` (date, optional): Filter by date range start
- `date_to` (date, optional): Filter by date range end

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "entree",
      "quantite": 50,
      "raison": "achat",
      "statut": "valide",
      "produit_id": 1,
      "user_id": 1,
      "boutique_id": 1,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

---

### Create Stock Movement
**POST** `/mouvements-stock`

Create a new stock movement.

**Headers:**
```
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "produit_id": 1,
  "type": "entree",
  "quantite": 50,
  "raison": "achat",
  "notes": "Stock replenishment"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "type": "entree",
    "quantite": 50,
    "raison": "achat",
    "statut": "en_attente"
  }
}
```

---

### Validate Stock Movement
**POST** `/mouvements-stock/{id}/valider`

Validate a stock movement.

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "statut": "valide"
  }
}
```

---

## User Endpoints

### List Users
**GET** `/users`

Get paginated list of users.

**Headers:**
```
Authorization: Bearer {token}
```

**Query Parameters:**
- `page` (integer, optional): Page number (default: 1)
- `per_page` (integer, optional): Items per page (default: 20, max: 100)
- `role` (string, optional): Filter by role (proprietaire, gerant, caissier)
- `search` (string, optional): Search by name or email

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "user@example.com",
      "role": "proprietaire",
      "telephone": "+22912345678",
      "est_actif": true,
      "current_boutique_id": 1,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

---

### Create User
**POST** `/users`

Create a new user.

**Headers:**
```
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "password",
  "password_confirmation": "password",
  "role": "gerant",
  "telephone": "+22912345678",
  "est_actif": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "gerant"
  }
}
```

---

### Get User
**GET** `/users/{id}`

Get details of a specific user.

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "user@example.com",
    "role": "proprietaire",
    "telephone": "+22912345678",
    "est_actif": true,
    "current_boutique_id": 1,
    "boutiques": [ ... ],
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

---

### Update User
**PUT** `/users/{id}`

Update a user.

**Headers:**
```
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "name": "Updated Name",
  "telephone": "+22987654321",
  "est_actif": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Updated Name",
    "telephone": "+22987654321",
    "est_actif": false
  }
}
```

---

### Delete User
**DELETE** `/users/{id}`

Soft delete a user.

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 422 | Validation Error - Invalid input data |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |

---

## Rate Limiting

The API implements rate limiting on sensitive endpoints:

- **Login**: 5 requests per minute
- **Password Reset**: 3 requests per hour
- **Switch Boutique**: 10 requests per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 1640995200
```

---

## Audit Logging

All sensitive actions are logged in the audit log:

- User creation, update, deletion
- Product creation, update, deletion
- Sale creation, cancellation
- Stock movements
- Boutique switching

Audit logs can be retrieved via the `/audit-logs` endpoint (admin only).
