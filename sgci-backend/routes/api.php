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

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// ==================== ROUTES PUBLIQUES ====================

// Route de santé de l'API (publique) - DOIT ÊTRE EN DEHORS DU GROUPE AUTH
Route::get('/health', function () {
    return response()->json([
        'status' => 'OK',
        'service' => 'SGCI Bénin API',
        'version' => '1.0.0',
        'timestamp' => now()
    ]);
});

// Authentification
Route::post('/login', [AuthController::class, 'login']);

// ==================== ROUTES PROTÉGÉES PAR SANCTUM ====================

Route::middleware('auth:sanctum')->group(function () {

    // === AUTHENTIFICATION ===
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/me/profile', [AuthController::class, 'updateProfile']);
    Route::put('/me/password', [AuthController::class, 'updatePassword']);

    // Route de test de l'API
    Route::get('/test', function () {
        return response()->json([
            'message' => 'API SGCI-Bénin est opérationnelle!',
            'timestamp' => now(),
            'user' => auth()->user()->name,
            'role' => auth()->user()->role
        ]);
    });

    // === ROUTES PRODUITS ===
    // 🔥 CORRECTION : Les routes spécifiques DOIVENT ÊTRE AVANT apiResource
    Route::get('/produits/alerte-stock', [ProduitController::class, 'alerteStock']);
    Route::get('/produits/statistiques', [ProduitController::class, 'statistiques']);
    Route::get('/produits/search/{search}', [ProduitController::class, 'search']);

    // === ROUTES MOUVEMENTS DE STOCK ===
    Route::get('/mouvements-stock/statistiques', [MouvementStockController::class, 'statistiques']);
    Route::get('/mouvements-stock/export', [MouvementStockController::class, 'export']);
    Route::post('/mouvements-stock/{mouvement}/valider', [MouvementStockController::class, 'valider']);
    Route::post('/mouvements-stock/{mouvement}/rejeter', [MouvementStockController::class, 'rejeter']);

    // ⚠️ apiResource DOIT ÊTRE APRÈS les routes spécifiques
    Route::apiResource('produits', ProduitController::class);
    Route::apiResource('mouvements-stock', MouvementStockController::class);

    // === ROUTES CATÉGORIES ===
    Route::get('/categories/statistiques/overview', [CategorieController::class, 'statistiquesOverview']);
    Route::get('/categories/{id}/produits', [CategorieController::class, 'produits']);
    Route::apiResource('categories', CategorieController::class);

    // === ROUTES VENTES ===
    Route::get('/ventes/aujourdhui/stats', [VenteController::class, 'statsVentesAujourdhui']);
    Route::get('/ventes/statistiques/general', [VenteController::class, 'statistiques']);
    Route::post('/ventes/checkout', [VenteController::class, 'checkout']);
    Route::post('/ventes/{vente}/terminer', [VenteController::class, 'terminer']);
    Route::post('/ventes/{vente}/annuler', [VenteController::class, 'annuler']);
    Route::get('/ventes/{vente}/facture', [VenteController::class, 'genererFacture']);
    Route::apiResource('ventes', VenteController::class);

    // === ROUTES ANALYTICS & RAPPORTS ===
    Route::prefix('analytics')->group(function () {
        // 🔄 ENDPOINTS EXISTANTS AVEC FILTRES AJOUTÉS
        Route::get('/stats-globales', [AnalyticsController::class, 'statsGlobales']);
        Route::get('/ventes-quotidiennes', [AnalyticsController::class, 'ventesQuotidiennes']);
        Route::get('/ventes-mensuelles', [AnalyticsController::class, 'ventesMensuelles']);
        Route::get('/produits-populaires', [AnalyticsController::class, 'produitsPopulaires']);
        Route::get('/chiffre-affaires', [AnalyticsController::class, 'chiffreAffaires']);

        // 🆕 NOUVEAUX ENDPOINTS POUR LA PAGE ANALYTICS
        Route::get('/repartition-categories', [AnalyticsController::class, 'repartitionCategories']);
        Route::get('/export', [AnalyticsController::class, 'exportAnalytics']);
        Route::get('/alertes-stock', [AnalyticsController::class, 'alertesStock']);
    });

    // === ROUTES UTILISATEURS ===
    Route::prefix('users')->group(function () {
        Route::get('/', function (Request $request) {
            $users = \App\Models\User::where('est_actif', true)
                ->select('id', 'name', 'email', 'role', 'telephone', 'derniere_connexion')
                ->get();
            return response()->json($users);
        });

        Route::get('/caissiers', function () {
            $caissiers = \App\Models\User::where('role', 'caissier')
                ->where('est_actif', true)
                ->select('id', 'name', 'email', 'telephone', 'derniere_connexion')
                ->get();
            return response()->json($caissiers);
        });
    });

    // === ROUTES CLIENTS - MISE À JOUR COMPLÈTE ===
    Route::prefix('clients')->group(function () {
        // 🎯 CORRECTION CRITIQUE : Routes spécifiques AVANT le pattern générique
        Route::get('/statistiques/globales', [ClientController::class, 'statistiques']);
        Route::get('/export/data', [ClientController::class, 'export']);
        Route::get('/search/advanced', [ClientController::class, 'search']);

        // 🔄 ROUTES EXISTANTES AVEC CORRECTIONS
        Route::get('/', [ClientController::class, 'index']);
        Route::post('/', [ClientController::class, 'store']);
        Route::get('/{client}', [ClientController::class, 'show']);
        Route::put('/{client}', [ClientController::class, 'update']);
        Route::delete('/{client}', [ClientController::class, 'destroy']);

        // 🆕 NOUVELLES ROUTES POUR LES FONCTIONNALITÉS AVANCÉES
        Route::post('/{client}/promouvoir-vip', [ClientController::class, 'promouvoirVip']);
        Route::post('/{client}/retrograder-vip', [ClientController::class, 'retrograderVip']);
        Route::get('/{client}/commandes', [ClientController::class, 'commandes']);
    });

    // === ROUTES POUR L'IA ===
    Route::prefix('ia')->group(function () {
        Route::get('/predictions-demande', [AIController::class, 'predictionsDemande']);
        Route::get('/recommandations-promotions', [AIController::class, 'recommandationsPromotions']);

        // ⬇️ AJOUTEZ CES DEUX ROUTES MANQUANTES ⬇️
        Route::get('/metrics-performance', [AIController::class, 'metricsPerformance']);
        Route::post('/entrainer-modele', [AIController::class, 'entrainerModele']);
        Route::post('/recalculer-analyses', [AIController::class, 'entrainerModele']);
    });
});
