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
use App\Http\Controllers\API\AuditLogController;
use App\Http\Controllers\API\NotificationController;
use App\Http\Controllers\API\FcmController;
use App\Http\Controllers\API\PredictionsController;
use App\Http\Controllers\API\StockAlertController;
use App\Http\Controllers\API\FournisseurController;
use App\Http\Controllers\API\CommandeFournisseurController;
use App\Http\Controllers\API\PeremptionController;
use App\Http\Controllers\API\TransfertStockController;
use App\Http\Controllers\API\DevisController;
use App\Http\Controllers\API\CommandeClientController;
use App\Http\Controllers\API\MobileMoneyController;
use App\Http\Controllers\API\FactureController;
use App\Http\Controllers\API\NotificationChannelController;
use App\Http\Controllers\API\ChatController;
use App\Http\Controllers\API\FideliteController;
use App\Http\Controllers\API\RetourVenteController;
use App\Http\Controllers\API\InventaireController;

/*
|--------------------------------------------------------------------------
| API Routes â€” SGCI BÃ©nin v1.2
|--------------------------------------------------------------------------
*/

Route::get('/health', function () {
    return response()->json([
        'status' => 'OK',
        'service' => 'SGCI BÃ©nin API',
        'version' => '1.2.0',
        'timestamp' => now(),
    ]);
});

Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
Route::post('/login', [AuthController::class, 'login'])->middleware(['throttle:30,1', 'login.safe']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:3,1');
Route::post('/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:3,1');

Route::middleware(['auth:sanctum', 'user.active'])->group(function () {

    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/refresh', [AuthController::class, 'refresh']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/me/profile', [AuthController::class, 'updateProfile']);
    Route::put('/me/password', [AuthController::class, 'updatePassword'])->middleware('throttle:3,1');
    
    // 2FA
    Route::post('/2fa/enable', [AuthController::class, 'enableTwoFactor'])->middleware('throttle:3,1');
    Route::post('/2fa/confirm', [AuthController::class, 'confirmTwoFactor'])->middleware('throttle:3,1');
    Route::post('/2fa/disable', [AuthController::class, 'disableTwoFactor'])->middleware('throttle:3,1');

    // Switch boutique
    Route::post('/switch-boutique', [AuthController::class, 'switchBoutique'])->middleware('throttle:10,1');

    Route::get('/test', function () {
        return response()->json([
            'message' => 'API SGCI-BÃ©nin est opÃ©rationnelle!',
            'timestamp' => now(),
            'user' => auth()->user()->name,
            'role' => auth()->user()->role,
        ]);
    });

    // Boutiques (multi-tenancy)
    Route::middleware('proprietaire')->prefix('boutiques')->group(function () {
        Route::get('/', [BoutiqueController::class, 'index']);
        Route::post('/', [BoutiqueController::class, 'store'])->middleware('throttle:10,1');
        Route::get('/{boutique}', [BoutiqueController::class, 'show']);
        Route::put('/{boutique}', [BoutiqueController::class, 'update'])->middleware('throttle:20,1');
        Route::delete('/{boutique}', [BoutiqueController::class, 'destroy'])->middleware('throttle:5,1');
        Route::post('/{boutique}/users/{user}', [BoutiqueController::class, 'assignUser'])->middleware('throttle:20,1');
        Route::delete('/{boutique}/users/{user}', [BoutiqueController::class, 'removeUser'])->middleware('throttle:20,1');
    });

    Route::get('/users/caissiers', [UserController::class, 'caissiers']);
    Route::middleware('role.gerant')->prefix('users')->group(function () {
        Route::get('/', [UserController::class, 'index']);
        Route::post('/', [UserController::class, 'store'])->middleware('throttle:10,1');
        Route::put('/{user}', [UserController::class, 'update'])->middleware('throttle:20,1');
        Route::delete('/{user}', [UserController::class, 'destroy'])->middleware('throttle:5,1');
        Route::post('/{user}/assign-boutique', [UserController::class, 'assignBoutique'])->middleware('throttle:20,1');
        Route::delete('/{user}/boutiques/{boutiqueId}', [UserController::class, 'removeBoutique'])->middleware('throttle:20,1');
    });

    Route::get('/produits/alerte-stock', [ProduitController::class, 'alerteStock']);
    Route::get('/produits/statistiques', [ProduitController::class, 'statistiques']);
    Route::get('/produits/search/{search}', [ProduitController::class, 'search']);
    Route::get('/produits/code/{code}', [ProduitController::class, 'findByCode']);
    Route::post('/produits/{produit}/image', [ProduitController::class, 'uploadImage'])->middleware('throttle:10,1');
    Route::apiResource('produits', ProduitController::class)->except(['destroy']);
    Route::delete('/produits/{produit}', [ProduitController::class, 'destroy'])->middleware('role.gerant')->middleware('throttle:5,1');

    Route::get('/categories/statistiques/overview', [CategorieController::class, 'statistiquesOverview']);
    Route::get('/categories/{id}/produits', [CategorieController::class, 'produits']);
    Route::apiResource('categories', CategorieController::class)->except(['destroy']);
    Route::delete('/categories/{categorie}', [CategorieController::class, 'destroy'])->middleware('role.gerant')->middleware('throttle:5,1');

    Route::get('/mouvements-stock/statistiques', [MouvementStockController::class, 'statistiques']);
    Route::get('/mouvements-stock/export', [MouvementStockController::class, 'export'])->middleware('throttle:5,1');
    Route::post('/mouvements-stock/{mouvement}/valider', [MouvementStockController::class, 'valider'])
        ->middleware('role.gerant')->middleware('throttle:20,1');
    Route::post('/mouvements-stock/{mouvement}/rejeter', [MouvementStockController::class, 'rejeter'])
        ->middleware('role.gerant')->middleware('throttle:20,1');
    Route::apiResource('mouvements-stock', MouvementStockController::class);

    Route::get('/ventes/aujourdhui/stats', [VenteController::class, 'statsVentesAujourdhui']);
    Route::get('/ventes/statistiques/general', [VenteController::class, 'statistiques']);
    Route::post('/ventes/checkout', [VenteController::class, 'checkout'])->middleware('throttle:30,1');
    Route::post('/ventes/{vente}/terminer', [VenteController::class, 'terminer'])->middleware('throttle:20,1');
    Route::post('/ventes/{vente}/annuler', [VenteController::class, 'annuler'])->middleware('throttle:10,1');
    Route::get('/ventes/{vente}/facture', [VenteController::class, 'genererFacture'])->middleware('throttle:10,1');
    Route::get('/ventes/{vente}/facture/pdf', [VenteController::class, 'genererFacturePdf'])->middleware('throttle:10,1');
    Route::get('/ventes/{vente}/facture/html', [VenteController::class, 'genererFactureHtml'])->middleware('throttle:10,1');
    Route::post('/ventes/sync-offline-batch', [VenteController::class, 'syncOfflineBatch'])->middleware('throttle:10,1');
    Route::apiResource('ventes', VenteController::class);

    Route::prefix('notifications')->group(function () {
        Route::get('/', [NotificationController::class, 'index']);
        Route::get('/unread-count', [NotificationController::class, 'unreadCount']);
        Route::post('/mark-all-read', [NotificationController::class, 'markAllRead'])->middleware('throttle:10,1');
        Route::post('/sync-stock-alerts', [NotificationController::class, 'syncStockAlerts'])
            ->middleware('role.gerant')->middleware('throttle:5,1');
        Route::post('/{notification}/read', [NotificationController::class, 'markRead'])->middleware('throttle:30,1');
    });

    // Alertes de stock automatiques
    Route::prefix('stock-alerts')->group(function () {
        Route::post('/check', [StockAlertController::class, 'checkAlerts'])->middleware('role.gerant')->middleware('throttle:5,1');
        Route::post('/sync', [StockAlertController::class, 'syncAlerts'])->middleware('throttle:10,1');
    });

    // Fournisseurs
    Route::prefix('fournisseurs')->group(function () {
        Route::get('/', [FournisseurController::class, 'index']);
        Route::get('/statistiques', [FournisseurController::class, 'statistiques']);
        Route::post('/', [FournisseurController::class, 'store'])->middleware('role.gerant')->middleware('throttle:10,1');
        Route::get('/{fournisseur}', [FournisseurController::class, 'show']);
        Route::put('/{fournisseur}', [FournisseurController::class, 'update'])->middleware('role.gerant')->middleware('throttle:20,1');
        Route::delete('/{fournisseur}', [FournisseurController::class, 'destroy'])->middleware('role.gerant')->middleware('throttle:5,1');
    });

    // Commandes fournisseurs
    Route::prefix('commandes-fournisseurs')->group(function () {
        Route::get('/suggestions', [CommandeFournisseurController::class, 'suggestions'])->middleware('role.gerant');
        Route::get('/', [CommandeFournisseurController::class, 'index']);
        Route::post('/', [CommandeFournisseurController::class, 'store'])->middleware('role.gerant')->middleware('throttle:10,1');
        Route::get('/{commande}', [CommandeFournisseurController::class, 'show']);
        Route::put('/{commande}', [CommandeFournisseurController::class, 'update'])->middleware('role.gerant')->middleware('throttle:20,1');
        Route::post('/{commande}/valider', [CommandeFournisseurController::class, 'valider'])->middleware('role.gerant')->middleware('throttle:20,1');
        Route::post('/{commande}/annuler', [CommandeFournisseurController::class, 'annuler'])->middleware('role.gerant')->middleware('throttle:10,1');
        Route::delete('/{commande}', [CommandeFournisseurController::class, 'destroy'])->middleware('role.gerant')->middleware('throttle:5,1');
    });

    // Gestion des dates de pÃ©remption
    Route::prefix('peremption')->group(function () {
        Route::post('/check', [PeremptionController::class, 'checkAlerts'])->middleware('role.gerant')->middleware('throttle:5,1');
        Route::post('/sync', [PeremptionController::class, 'syncAlerts'])->middleware('throttle:10,1');
    });

    // Transferts de stock entre boutiques
    Route::prefix('transferts-stock')->group(function () {
        Route::get('/', [TransfertStockController::class, 'index']);
        Route::get('/statistiques', [TransfertStockController::class, 'statistiques']);
        Route::post('/', [TransfertStockController::class, 'store'])->middleware('role.gerant')->middleware('throttle:10,1');
        Route::get('/{transfert}', [TransfertStockController::class, 'show']);
        Route::post('/{transfert}/annuler', [TransfertStockController::class, 'annuler'])->middleware('role.gerant')->middleware('throttle:10,1');
        Route::post('/{transfert}/recevoir', [TransfertStockController::class, 'recevoir'])->middleware('role.gerant')->middleware('throttle:10,1');
    });

    // Devis et commandes clients
    Route::prefix('devis')->group(function () {
        Route::get('/', [DevisController::class, 'index']);
        Route::post('/', [DevisController::class, 'store'])->middleware('role.gerant')->middleware('throttle:10,1');
        Route::get('/{devis}', [DevisController::class, 'show']);
        Route::put('/{devis}', [DevisController::class, 'update'])->middleware('role.gerant')->middleware('throttle:20,1');
        Route::post('/{devis}/accepter', [DevisController::class, 'accepter'])->middleware('role.gerant')->middleware('throttle:10,1');
        Route::post('/{devis}/refuser', [DevisController::class, 'refuser'])->middleware('role.gerant')->middleware('throttle:10,1');
        Route::post('/{devis}/convertir-commande', [DevisController::class, 'convertirEnCommande'])->middleware('role.gerant')->middleware('throttle:10,1');
        Route::get('/{devis}/pdf', [DevisController::class, 'pdf']);
    });

    Route::prefix('commandes-clients')->group(function () {
        Route::get('/', [CommandeClientController::class, 'index']);
        Route::post('/', [CommandeClientController::class, 'store'])->middleware('role.gerant')->middleware('throttle:10,1');
        Route::get('/{commande}', [CommandeClientController::class, 'show']);
        Route::put('/{commande}', [CommandeClientController::class, 'update'])->middleware('role.gerant')->middleware('throttle:20,1');
        Route::post('/{commande}/valider', [CommandeClientController::class, 'valider'])->middleware('role.gerant')->middleware('throttle:20,1');
        Route::post('/{commande}/annuler', [CommandeClientController::class, 'annuler'])->middleware('role.gerant')->middleware('throttle:10,1');
        Route::post('/{commande}/livrer', [CommandeClientController::class, 'livrer'])->middleware('role.gerant')->middleware('throttle:20,1');
    });

    // Mobile Money
    Route::prefix('mobile-money')->group(function () {
        Route::post('/initiate', [MobileMoneyController::class, 'initiatePayment'])->middleware('throttle:10,1');
        Route::get('/status/{paymentId}', [MobileMoneyController::class, 'checkStatus']);
        Route::post('/cancel/{paymentId}', [MobileMoneyController::class, 'cancelPayment'])->middleware('throttle:10,1');
        Route::post('/detect-provider', [MobileMoneyController::class, 'detectProvider']);
        Route::post('/callback', [MobileMoneyController::class, 'callback'])->name('mobile-money.callback')->withoutMiddleware(['auth:sanctum', 'user.active']);
    });

    // Facturation automatique
    Route::prefix('factures')->group(function () {
        Route::get('/', [FactureController::class, 'index']);
        Route::post('/generer-vente', [FactureController::class, 'genererPourVente'])->middleware('role.gerant')->middleware('throttle:10,1');
        Route::post('/generer-commande', [FactureController::class, 'genererPourCommande'])->middleware('role.gerant')->middleware('throttle:10,1');
        Route::get('/{facture}', [FactureController::class, 'show']);
        Route::post('/{facture}/envoyer-email', [FactureController::class, 'envoyerEmail'])->middleware('throttle:10,1');
        Route::get('/{facture}/telecharger-pdf', [FactureController::class, 'telechargerPdf']);
        Route::post('/generer-du-jour', [FactureController::class, 'genererDuJour'])->middleware('proprietaire')->middleware('throttle:5,1');
    });

    // Retours et remboursements
    Route::prefix('retours')->group(function () {
        Route::get('/', [RetourVenteController::class, 'index']);
        Route::post('/', [RetourVenteController::class, 'store'])->middleware('role.gerant')->middleware('throttle:10,1');
        Route::get('/{retour}', [RetourVenteController::class, 'show']);
        Route::post('/{retour}/valider', [RetourVenteController::class, 'valider'])->middleware('role.gerant')->middleware('throttle:10,1');
        Route::post('/{retour}/refuser', [RetourVenteController::class, 'refuser'])->middleware('role.gerant')->middleware('throttle:10,1');
    });

    // Inventaire physique
    Route::prefix('inventaires')->group(function () {
        Route::get('/', [InventaireController::class, 'index']);
        Route::post('/', [InventaireController::class, 'store'])->middleware('role.gerant')->middleware('throttle:5,1');
        Route::get('/{inventaire}', [InventaireController::class, 'show']);
        Route::post('/{inventaire}/compter', [InventaireController::class, 'compter'])->middleware('throttle:30,1');
        Route::post('/{inventaire}/valider', [InventaireController::class, 'valider'])->middleware('role.gerant')->middleware('throttle:5,1');
        Route::post('/{inventaire}/annuler', [InventaireController::class, 'annuler'])->middleware('role.gerant')->middleware('throttle:5,1');
        Route::get('/{inventaire}/ecarts', [InventaireController::class, 'ecarts']);
    });

    // Notifications par email et SMS
    Route::prefix('notifications-channels')->group(function () {
        Route::post('/test-email', [NotificationChannelController::class, 'sendTestEmail'])->middleware('throttle:5,1');
        Route::post('/test-sms', [NotificationChannelController::class, 'sendTestSms'])->middleware('throttle:5,1');
        Route::post('/test-multi', [NotificationChannelController::class, 'sendTestMultiChannel'])->middleware('throttle:5,1');
        Route::get('/preferences', [NotificationChannelController::class, 'getPreferences']);
        Route::put('/preferences', [NotificationChannelController::class, 'updatePreferences']);
    });

    // Chat interne
    Route::prefix('chat')->group(function () {
        Route::get('/', [ChatController::class, 'index']);
        Route::post('/', [ChatController::class, 'store'])->middleware('throttle:10,1');
        Route::get('/{conversation}', [ChatController::class, 'show']);
        Route::post('/{conversation}/message', [ChatController::class, 'sendMessage'])->middleware('throttle:30,1');
        Route::put('/{conversation}/message/{message}', [ChatController::class, 'editMessage'])->middleware('throttle:10,1');
        Route::delete('/{conversation}/message/{message}', [ChatController::class, 'deleteMessage'])->middleware('throttle:10,1');
        Route::post('/{conversation}/participants', [ChatController::class, 'addParticipant'])->middleware('throttle:10,1');
        Route::delete('/{conversation}/participants/{userId}', [ChatController::class, 'removeParticipant'])->middleware('throttle:10,1');
        Route::delete('/{conversation}', [ChatController::class, 'destroy'])->middleware('throttle:5,1');
    });

    // Programme de fidÃ©litÃ©
    Route::prefix('fidelite')->group(function () {
        Route::get('/', [FideliteController::class, 'index']);
        Route::post('/', [FideliteController::class, 'store'])->middleware('role.gerant')->middleware('throttle:10,1');
        Route::get('/{programme}', [FideliteController::class, 'show']);
        Route::put('/{programme}', [FideliteController::class, 'update'])->middleware('role.gerant')->middleware('throttle:20,1');
        Route::delete('/{programme}', [FideliteController::class, 'destroy'])->middleware('role.gerant')->middleware('throttle:5,1');
        Route::post('/inscrire-client', [FideliteController::class, 'inscrireClient'])->middleware('throttle:10,1');
        Route::get('/points-client', [FideliteController::class, 'pointsClient']);
        Route::post('/recompenses', [FideliteController::class, 'storeRecompense'])->middleware('role.gerant')->middleware('throttle:10,1');
        Route::post('/reclamer-recompense', [FideliteController::class, 'reclamerRecompense'])->middleware('throttle:10,1');
        Route::get('/statistiques', [FideliteController::class, 'statistiques']);
    });

    Route::prefix('fcm')->group(function () {
        Route::post('/register', [FcmController::class, 'registerToken'])->middleware('throttle:10,1');
        Route::post('/unregister', [FcmController::class, 'unregisterToken'])->middleware('throttle:10,1');
        Route::get('/my-tokens', [FcmController::class, 'myTokens']);
        Route::post('/test', [FcmController::class, 'testNotification'])->middleware('throttle:5,1');
    });

    Route::prefix('analytics')->group(function () {
        Route::get('/stats-globales', [AnalyticsController::class, 'statsGlobales']);
        Route::get('/ventes-quotidiennes', [AnalyticsController::class, 'ventesQuotidiennes']);
        Route::get('/ventes-mensuelles', [AnalyticsController::class, 'ventesMensuelles']);
        Route::get('/produits-populaires', [AnalyticsController::class, 'produitsPopulaires']);
        Route::get('/chiffre-affaires', [AnalyticsController::class, 'chiffreAffaires']);
        Route::get('/repartition-categories', [AnalyticsController::class, 'repartitionCategories']);
        Route::get('/export', [AnalyticsController::class, 'exportAnalytics'])->middleware('throttle:5,1');
        Route::get('/alertes-stock', [AnalyticsController::class, 'alertesStock']);
    });

    Route::prefix('predictions')->group(function () {
        Route::get('/demande', [PredictionsController::class, 'predictionsDemande']);
        Route::post('/valider', [PredictionsController::class, 'validerPredictions'])->middleware('throttle:10,1');
        Route::get('/metrics-performance', [PredictionsController::class, 'metricsPerformance']);
        Route::get('/recommandations-promotions', [PredictionsController::class, 'recommandationsPromotions']);
        Route::get('/reapprovisionnement', [PredictionsController::class, 'predictionsReapprovisionnement']);
        Route::post('/cross-selling', [PredictionsController::class, 'crossSelling'])->middleware('throttle:10,1');
    });

    Route::prefix('clients')->group(function () {
        Route::get('/statistiques/globales', [ClientController::class, 'statistiques']);
        Route::get('/export/data', [ClientController::class, 'export'])->middleware('throttle:5,1');
        Route::get('/search/advanced', [ClientController::class, 'search']);
        Route::get('/', [ClientController::class, 'index']);
        Route::post('/', [ClientController::class, 'store'])->middleware('throttle:20,1');
        Route::get('/{client}', [ClientController::class, 'show']);
        Route::put('/{client}', [ClientController::class, 'update'])->middleware('throttle:20,1');
        Route::delete('/{client}', [ClientController::class, 'destroy'])->middleware('throttle:5,1');
        Route::post('/{client}/promouvoir-vip', [ClientController::class, 'promouvoirVip'])->middleware('throttle:10,1');
        Route::post('/{client}/retrograder-vip', [ClientController::class, 'retrograderVip'])->middleware('throttle:10,1');
        Route::get('/{client}/commandes', [ClientController::class, 'commandes']);
    });

    Route::prefix('ia')->group(function () {
        Route::get('/predictions-demande', [AIController::class, 'predictionsDemande']);
        Route::get('/recommandations-promotions', [AIController::class, 'recommandationsPromotions']);
        Route::get('/metrics-performance', [AIController::class, 'metricsPerformance']);
        Route::post('/entrainer-modele', [AIController::class, 'entrainerModele'])->middleware('throttle:3,1');
        Route::post('/recalculer-analyses', [AIController::class, 'entrainerModele'])->middleware('throttle:3,1');
    });

    Route::prefix('audit-logs')->group(function () {
        Route::get('/', [AuditLogController::class, 'index'])->middleware('role.gerant');
        Route::get('/stats', [AuditLogController::class, 'stats'])->middleware('role.gerant');
        Route::get('/export', [AuditLogController::class, 'export'])->middleware('role.gerant');
        Route::get('/{id}', [AuditLogController::class, 'show'])->middleware('role.gerant');
    });
});
