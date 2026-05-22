<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\API\ProduitController;
use App\Http\Controllers\API\CategorieController;
use App\Http\Controllers\API\VenteController;
use App\Http\Controllers\API\AnalyticsController;
use App\Http\Controllers\API\AIController;
use App\Http\Controllers\API\ClientController;
use App\Http\Controllers\API\MouvementStockController;
use App\Http\Controllers\API\UserController;
use App\Http\Controllers\API\BoutiqueController;
use App\Http\Controllers\API\NotificationController;

/*
|--------------------------------------------------------------------------
| API Routes — SGCI Bénin v1.2
|--------------------------------------------------------------------------
*/

Route::get('/health', function () {
    return response()->json([
        'status' => 'OK',
        'service' => 'SGCI Bénin API',
        'version' => '1.2.0',
        'timestamp' => now(),
    ]);
});

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

Route::middleware(['auth:sanctum', 'user.active'])->group(function () {

    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/refresh', [AuthController::class, 'refresh']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/me/profile', [AuthController::class, 'updateProfile']);
    Route::put('/me/password', [AuthController::class, 'updatePassword']);

    Route::get('/test', function () {
        return response()->json([
            'message' => 'API SGCI-Bénin est opérationnelle!',
            'timestamp' => now(),
            'user' => auth()->user()->name,
            'role' => auth()->user()->role,
        ]);
    });

    Route::get('/boutique/settings', [BoutiqueController::class, 'show']);
    Route::put('/boutique/settings', [BoutiqueController::class, 'update'])->middleware('role.gerant');

    Route::get('/users/caissiers', [UserController::class, 'caissiers']);
    Route::middleware('role.gerant')->prefix('users')->group(function () {
        Route::get('/', [UserController::class, 'index']);
        Route::post('/', [UserController::class, 'store']);
        Route::put('/{user}', [UserController::class, 'update']);
        Route::delete('/{user}', [UserController::class, 'destroy']);
    });

    Route::get('/produits/alerte-stock', [ProduitController::class, 'alerteStock']);
    Route::get('/produits/statistiques', [ProduitController::class, 'statistiques']);
    Route::get('/produits/search/{search}', [ProduitController::class, 'search']);
    Route::get('/produits/code/{code}', [ProduitController::class, 'findByCode']);
    Route::post('/produits/{produit}/image', [ProduitController::class, 'uploadImage']);
    Route::apiResource('produits', ProduitController::class)->except(['destroy']);
    Route::delete('/produits/{produit}', [ProduitController::class, 'destroy'])->middleware('role.gerant');

    Route::get('/categories/statistiques/overview', [CategorieController::class, 'statistiquesOverview']);
    Route::get('/categories/{id}/produits', [CategorieController::class, 'produits']);
    Route::apiResource('categories', CategorieController::class)->except(['destroy']);
    Route::delete('/categories/{categorie}', [CategorieController::class, 'destroy'])->middleware('role.gerant');

    Route::get('/mouvements-stock/statistiques', [MouvementStockController::class, 'statistiques']);
    Route::get('/mouvements-stock/export', [MouvementStockController::class, 'export']);
    Route::post('/mouvements-stock/{mouvement}/valider', [MouvementStockController::class, 'valider'])
        ->middleware('role.gerant');
    Route::post('/mouvements-stock/{mouvement}/rejeter', [MouvementStockController::class, 'rejeter'])
        ->middleware('role.gerant');
    Route::apiResource('mouvements-stock', MouvementStockController::class);

    Route::get('/ventes/aujourdhui/stats', [VenteController::class, 'statsVentesAujourdhui']);
    Route::get('/ventes/statistiques/general', [VenteController::class, 'statistiques']);
    Route::post('/ventes/checkout', [VenteController::class, 'checkout']);
    Route::post('/ventes/{vente}/terminer', [VenteController::class, 'terminer']);
    Route::post('/ventes/{vente}/annuler', [VenteController::class, 'annuler']);
    Route::get('/ventes/{vente}/facture', [VenteController::class, 'genererFacture']);
    Route::get('/ventes/{vente}/facture/pdf', [VenteController::class, 'genererFacturePdf']);
    Route::get('/ventes/{vente}/facture/html', [VenteController::class, 'genererFactureHtml']);
    Route::apiResource('ventes', VenteController::class);

    Route::prefix('notifications')->group(function () {
        Route::get('/', [NotificationController::class, 'index']);
        Route::get('/unread-count', [NotificationController::class, 'unreadCount']);
        Route::post('/mark-all-read', [NotificationController::class, 'markAllRead']);
        Route::post('/sync-stock-alerts', [NotificationController::class, 'syncStockAlerts'])
            ->middleware('role.gerant');
        Route::post('/{notification}/read', [NotificationController::class, 'markRead']);
    });

    Route::prefix('analytics')->group(function () {
        Route::get('/stats-globales', [AnalyticsController::class, 'statsGlobales']);
        Route::get('/ventes-quotidiennes', [AnalyticsController::class, 'ventesQuotidiennes']);
        Route::get('/ventes-mensuelles', [AnalyticsController::class, 'ventesMensuelles']);
        Route::get('/produits-populaires', [AnalyticsController::class, 'produitsPopulaires']);
        Route::get('/chiffre-affaires', [AnalyticsController::class, 'chiffreAffaires']);
        Route::get('/repartition-categories', [AnalyticsController::class, 'repartitionCategories']);
        Route::get('/export', [AnalyticsController::class, 'exportAnalytics']);
        Route::get('/alertes-stock', [AnalyticsController::class, 'alertesStock']);
    });

    Route::prefix('clients')->group(function () {
        Route::get('/statistiques/globales', [ClientController::class, 'statistiques']);
        Route::get('/export/data', [ClientController::class, 'export']);
        Route::get('/search/advanced', [ClientController::class, 'search']);
        Route::get('/', [ClientController::class, 'index']);
        Route::post('/', [ClientController::class, 'store']);
        Route::get('/{client}', [ClientController::class, 'show']);
        Route::put('/{client}', [ClientController::class, 'update']);
        Route::delete('/{client}', [ClientController::class, 'destroy']);
        Route::post('/{client}/promouvoir-vip', [ClientController::class, 'promouvoirVip']);
        Route::post('/{client}/retrograder-vip', [ClientController::class, 'retrograderVip']);
        Route::get('/{client}/commandes', [ClientController::class, 'commandes']);
    });

    Route::prefix('ia')->group(function () {
        Route::get('/predictions-demande', [AIController::class, 'predictionsDemande']);
        Route::get('/recommandations-promotions', [AIController::class, 'recommandationsPromotions']);
        Route::get('/metrics-performance', [AIController::class, 'metricsPerformance']);
        Route::post('/entrainer-modele', [AIController::class, 'entrainerModele']);
        Route::post('/recalculer-analyses', [AIController::class, 'entrainerModele']);
    });
});
