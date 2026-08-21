<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Services\StockAlertService;

class StockAlertController extends Controller
{
    protected $stockAlertService;

    public function __construct(StockAlertService $stockAlertService)
    {
        $this->stockAlertService = $stockAlertService;
    }

    /**
     * Vérifie et envoie les alertes de stock pour la boutique courante
     */
    public function checkAlerts(Request $request): JsonResponse
    {
        try {
            $boutiqueId = $request->user()->current_boutique_id;
            
            if (!$boutiqueId) {
                return response()->json([
                    'message' => 'Aucune boutique sélectionnée',
                ], 400);
            }

            // Vérifier et envoyer les alertes
            $this->stockAlertService->checkAndSendAlerts($boutiqueId);
            $this->stockAlertService->checkAndSendRuptureAlerts($boutiqueId);

            return response()->json([
                'message' => 'Alertes de stock vérifiées avec succès',
                'boutique_id' => $boutiqueId,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur lors de la vérification des alertes',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Synchronise les alertes de stock pour la boutique courante
     */
    public function syncAlerts(Request $request): JsonResponse
    {
        try {
            $boutiqueId = $request->user()->current_boutique_id;
            
            if (!$boutiqueId) {
                return response()->json([
                    'message' => 'Aucune boutique sélectionnée',
                ], 400);
            }

            // Synchroniser les alertes
            $alerts = $this->stockAlertService->syncStockAlerts($boutiqueId);

            return response()->json([
                'message' => 'Alertes synchronisées avec succès',
                'data' => $alerts,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur lors de la synchronisation des alertes',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
