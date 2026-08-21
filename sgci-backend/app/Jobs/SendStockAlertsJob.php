<?php

namespace App\Jobs;

use App\Models\Produit;
use App\Models\User;
use App\Services\EmailService;
use App\Services\FcmService;
use App\Services\SmsService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendStockAlertsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected EmailService $emailService;
    protected FcmService $fcmService;
    protected SmsService $smsService;

    public function __construct()
    {
        $this->emailService = app(EmailService::class);
        $this->fcmService = app(FcmService::class);
        $this->smsService = app(SmsService::class);
    }

    public function handle(): void
    {
        try {
            // Récupérer les produits en alerte de stock
            $productsInAlert = Produit::enAlerte()->with('categorie')->get();

            if ($productsInAlert->isEmpty()) {
                Log::info('Aucun produit en alerte de stock');
                return;
            }

            // Récupérer tous les gérants actifs
            $gerants = User::where('role', 'gerant')->where('est_actif', true)->get();

            if ($gerants->isEmpty()) {
                Log::warning('Aucun gérant actif trouvé pour envoyer les alertes');
                return;
            }

            $alertsSent = 0;

            foreach ($productsInAlert as $product) {
                foreach ($gerants as $gerant) {
                    // Envoyer email
                    $emailResult = $this->emailService->sendStockAlert(
                        $gerant,
                        $product->nom,
                        $product->quantite_stock,
                        $product->seuil_alerte
                    );

                    // Envoyer notification push FCM
                    $fcmResult = $this->fcmService->sendStockAlert(
                        $gerant,
                        $product->nom,
                        $product->quantite_stock
                    );

                    // Envoyer SMS (si configuré)
                    if (env('SMS_ENABLED', false)) {
                        $smsResult = $this->smsService->sendStockAlert(
                            $gerant,
                            $product->nom,
                            $product->quantite_stock
                        );
                    }

                    $alertsSent++;
                }
            }

            Log::info("Alertes stock envoyées: {$alertsSent} notifications pour {$productsInAlert->count()} produits");
        } catch (\Exception $e) {
            Log::error('Erreur lors de l\'envoi des alertes stock', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            
            // Relancer le job en cas d'erreur
            $this->release(300); // Relancer après 5 minutes
        }
    }
}
