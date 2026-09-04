<?php

namespace App\Jobs;

use App\Models\Produit;
use App\Models\User;
use App\Services\EmailService;
use App\Services\FcmService;
use App\Services\SmsService;
use App\Events\StockAlerte;
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

            $alertsSent = 0;

            foreach ($productsInAlert as $product) {
                $boutiqueId = $product->boutique_id ?? $product->boutiqueId;

                // Destinataires pour LA boutique de ce produit :
                // - les membres rattachés comme GÉRANT (via le pivot)
                // - le propriétaire de la boutique
                $gerants = \App\Models\BoutiqueUser::forBoutique($boutiqueId)
                    ->gerants()
                    ->pluck('user_id')
                    ->all();

                if ($boutiqueId) {
                    $proprietaire = \App\Models\Boutique::where('id', $boutiqueId)->value('proprietaire_id');
                    if ($proprietaire) {
                        $gerants[] = $proprietaire;
                    }
                }

                $gerants = array_unique(array_filter($gerants));

                if (empty($gerants)) {
                    continue;
                }

                $destinataires = User::whereIn('id', $gerants)->where('est_actif', true)->get();

                foreach ($destinataires as $gerant) {
                    // Envoyer email
                    $this->emailService->sendStockAlert(
                        $gerant,
                        $product->nom,
                        $product->quantite_stock,
                        $product->seuil_alerte
                    );

                    // Envoyer notification push FCM
                    $this->fcmService->sendStockAlert(
                        $gerant,
                        $product->nom,
                        $product->quantite_stock
                    );

                    // Broadcast en temps réel via WebSocket
                    $niveau = $product->estEnRupture() ? 'rupture' : 'alerte';
                    if ($boutiqueId) {
                        broadcast(new StockAlerte($product, $boutiqueId, $niveau));
                    }

                    // Envoyer SMS (si configuré)
                    if (config('services.sms.enabled', false)) {
                        $this->smsService->sendStockAlert(
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
