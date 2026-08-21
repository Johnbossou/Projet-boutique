<?php

namespace App\Jobs;

use App\Models\AiPrediction;
use App\Models\LigneVente;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class ValidatePredictionsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct()
    {
        //
    }

    public function handle(): void
    {
        try {
            // Récupérer toutes les prédictions non validées
            $predictions = AiPrediction::enAttente()
                ->where('date_prediction', '<=', now()->subDay()->toDateString())
                ->get();

            if ($predictions->isEmpty()) {
                Log::info('Aucune prédiction à valider');
                return;
            }

            $totalValidees = 0;
            $totalPrecises = 0;
            $resultatsParType = [];

            foreach ($predictions as $prediction) {
                $periodeJours = $this->getPeriodeJours($prediction->type_prediction);
                
                // Calculer les ventes réelles pour la période
                $ventesReelles = $this->calculerVentesReelles(
                    $prediction->produit_id,
                    $prediction->date_prediction,
                    $periodeJours
                );

                // Valider la prédiction
                $prediction->calculerErreur($ventesReelles);
                
                $totalValidees++;
                if ($prediction->estPrecise(20)) {
                    $totalPrecises++;
                }

                // Agréger par type
                $type = $prediction->type_prediction;
                if (!isset($resultatsParType[$type])) {
                    $resultatsParType[$type] = [
                        'total' => 0,
                        'precises' => 0,
                    ];
                }
                $resultatsParType[$type]['total']++;
                if ($prediction->estPrecise(20)) {
                    $resultatsParType[$type]['precises']++;
                }
            }

            $precisionGlobale = $totalValidees > 0 ? ($totalPrecises / $totalValidees) * 100 : 0;

            Log::info('Validation prédictions terminée', [
                'total_validees' => $totalValidees,
                'total_precises' => $totalPrecises,
                'precision_globale' => round($precisionGlobale, 2),
                'resultats_par_type' => $resultatsParType,
            ]);

        } catch (\Exception $e) {
            Log::error('Erreur validation prédictions', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            
            $this->release(300); // Relancer après 5 minutes
        }
    }

    private function calculerVentesReelles($produitId, $datePrediction, $periodeJours): int
    {
        $dateDebut = Carbon::parse($datePrediction);
        $dateFin = $dateDebut->copy()->addDays($periodeJours);

        return LigneVente::where('produit_id', $produitId)
            ->whereHas('vente', function($query) use ($dateDebut, $dateFin) {
                $query->terminees()
                    ->whereBetween('created_at', [$dateDebut, $dateFin]);
            })
            ->sum('quantite');
    }

    private function getPeriodeJours($typePrediction): int
    {
        return match($typePrediction) {
            'demande_hebdo' => 7,
            'demande_mensuelle' => 30,
            'reapprovisionnement' => 30,
            default => 7,
        };
    }
}
