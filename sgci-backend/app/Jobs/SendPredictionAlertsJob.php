<?php

namespace App\Jobs;

use App\Models\AiPrediction;
use App\Models\Produit;
use App\Models\User;
use App\Services\FcmService;
use App\Services\EmailService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendPredictionAlertsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected FcmService $fcmService;
    protected EmailService $emailService;

    public function __construct()
    {
        $this->fcmService = app(FcmService::class);
        $this->emailService = app(EmailService::class);
    }

    public function handle(): void
    {
        try {
            // Récupérer les prédictions critiques pour aujourd'hui
            $predictionsCritiques = AiPrediction::where('date_prediction', now()->toDateString())
                ->where('type_prediction', 'demande_hebdo')
                ->get()
                ->filter(function ($prediction) {
                    $produit = $prediction->produit;
                    $besoin = $prediction->demande_predite - $produit->quantite_stock;
                    return $besoin > $produit->seuil_alerte * 2; // Critique si besoin > 2x seuil
                });

            if ($predictionsCritiques->isEmpty()) {
                Log::info('Aucune prédiction critique à notifier');
                return;
            }

            // Récupérer tous les gérants actifs
            $gerants = User::where('role', 'gerant')->where('est_actif', true)->get();

            if ($gerants->isEmpty()) {
                Log::warning('Aucun gérant actif trouvé pour les alertes prédictions');
                return;
            }

            $alertsEnvoyees = 0;

            foreach ($predictionsCritiques as $prediction) {
                $produit = $prediction->produit;
                $besoin = $prediction->demande_predite - $produit->quantite_stock;
                $joursRestants = $produit->quantite_stock > 0 ? floor($produit->quantite_stock / ($prediction->demande_predite / 7)) : 0;

                foreach ($gerants as $gerant) {
                    // Envoyer notification push FCM
                    $this->fcmService->sendToUser(
                        $gerant,
                        'Alerte Prédiction IA',
                        "Le produit {$produit->nom} risque rupture (besoin: {$besoin} unités, {$joursRestants} jours restants)",
                        [
                            'type' => 'prediction_alert',
                            'produit_id' => $produit->id,
                            'produit_nom' => $produit->nom,
                            'besoin' => $besoin,
                            'jours_restants' => $joursRestants,
                            'demande_predite' => $prediction->demande_predite,
                            'confiance' => $prediction->metadonnees['confiance'] ?? 0.8,
                        ]
                    );

                    // Envoyer email pour alertes critiques
                    if ($besoin > $produit->seuil_alerte * 3) {
                        $this->emailService->sendStockAlert(
                            $gerant,
                            $produit->nom,
                            $produit->quantite_stock,
                            $produit->seuil_alerte
                        );
                    }

                    $alertsEnvoyees++;
                }
            }

            Log::info("Alertes prédictions envoyées: {$alertsEnvoyees} notifications pour {$predictionsCritiques->count()} produits critiques");

        } catch (\Exception $e) {
            Log::error('Erreur envoi alertes prédictions', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            
            $this->release(300); // Relancer après 5 minutes
        }
    }
}
