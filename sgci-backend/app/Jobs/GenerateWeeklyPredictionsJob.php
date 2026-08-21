<?php

namespace App\Jobs;

use App\Models\AiPrediction;
use App\Models\LigneVente;
use App\Models\Produit;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Génère les prédictions de demande hebdomadaires pour la semaine suivante.
 * Utilise la même formule pondérée que PredictionsController (moyennes
 * glissantes 7/30/90 jours + facteur périssable).
 */
class GenerateWeeklyPredictionsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        $datePrediction = now()->next('monday')->toDateString();

        $compte = 0;

        Produit::query()->chunkById(200, function ($produits) use ($datePrediction, &$compte) {
            foreach ($produits as $produit) {
                $ventes7Jours = $this->ventesPeriode($produit->id, 7);
                $ventes30Jours = $this->ventesPeriode($produit->id, 30);
                $ventes90Jours = $this->ventesPeriode($produit->id, 90);

                $demandePredite = (int) ceil(
                    ($ventes7Jours * 0.5)
                    + (($ventes30Jours / 4) * 0.3)
                    + (($ventes90Jours / 12) * 0.2)
                );

                AiPrediction::updateOrCreate(
                    [
                        'produit_id' => $produit->id,
                        'date_prediction' => $datePrediction,
                        'type_prediction' => 'demande_hebdo',
                    ],
                    [
                        'demande_predite' => $demandePredite,
                        'metadonnees' => [
                            'ventes_7j' => $ventes7Jours,
                            'ventes_30j' => $ventes30Jours,
                            'ventes_90j' => $ventes90Jours,
                            'mode_calcul' => 'job_hebdomadaire_v1',
                        ],
                    ]
                );

                $compte++;
            }
        });

        Log::info("Prédictions hebdomadaires générées pour {$compte} produits (semaine du {$datePrediction})");
    }

    private function ventesPeriode(int $produitId, int $jours): float
    {
        return (float) LigneVente::where('produit_id', $produitId)
            ->whereHas('vente', function ($q) use ($jours) {
                $q->where('created_at', '>=', now()->subDays($jours))
                    ->whereIn('statut', ['termine', 'en_cours']);
            })
            ->sum('quantite');
    }
}
