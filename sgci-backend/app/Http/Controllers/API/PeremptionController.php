<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Services\PeremptionService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class PeremptionController extends Controller
{
    protected $peremptionService;

    public function __construct(PeremptionService $peremptionService)
    {
        $this->peremptionService = $peremptionService;
    }

    /**
     * Vérifie et envoie les alertes de péremption pour la boutique courante
     */
    public function checkAlerts(Request $request): JsonResponse
    {
        try {
            $boutiqueId = $request->user()->current_boutique_id;
            $joursAvant = $request->input('jours_avant', 7);
            
            if (!$boutiqueId) {
                return response()->json([
                    'message' => 'Aucune boutique sélectionnée',
                ], 400);
            }

            // Vérifier et envoyer les alertes
            $this->peremptionService->checkAndSendAlerts($boutiqueId, $joursAvant);
            $this->peremptionService->checkAndSendExpiredAlerts($boutiqueId);

            return response()->json([
                'message' => 'Alertes de péremption vérifiées avec succès',
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
     * Synchronise les alertes de péremption pour la boutique courante
     */
    public function syncAlerts(Request $request): JsonResponse
    {
        try {
            $boutiqueId = $request->user()->current_boutique_id;
            $joursAvant = $request->input('jours_avant', 7);
            
            if (!$boutiqueId) {
                return response()->json([
                    'message' => 'Aucune boutique sélectionnée',
                ], 400);
            }

            // Synchroniser les alertes
            $alerts = $this->peremptionService->syncPeremptionAlerts($boutiqueId, $joursAvant);

            return response()->json([
                'message' => 'Alertes de péremption synchronisées avec succès',
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
