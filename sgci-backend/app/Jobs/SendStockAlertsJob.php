<?php

namespace App\Jobs;

use App\Events\StockAlerte;
use App\Models\Boutique;
use App\Models\BoutiqueUser;
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
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class SendStockAlertsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Services résolus par injection de méthode, pas dans le constructeur.
     *
     * Le constructeur est exécuté au moment du dispatch, donc il résolvait les
     * services trop tôt et les sérialisait dans le payload du job. Les
     * instances résolues à la construction gardent un conteneur d'une autre
     * requête (connexion fermée) une fois le worker arrivé sur le job.
     */
    public function handle(
        EmailService $emailService,
        FcmService $fcmService,
        SmsService $smsService,
    ): void {
        $productsInAlert = Produit::enAlerte()->with('categorie')->get();

        if ($productsInAlert->isEmpty()) {
            Log::info('Aucun produit en alerte de stock');

            return;
        }

        $alertsSent = 0;
        $produitsIgnores = 0;

        // try/catch par produit, et non autour de la boucle entière.
        //
        // Les canaux d'une alerte sont externes et indépendants : FCM, SMS,
        // SMTP et le broadcast. Avec un seul try/catch global, une panne FCM
        // sur le premier produit abandonnait silencieusement toutes les
        // alertes des produits suivants — dont celles qui signalent une rupture.
        foreach ($productsInAlert as $product) {
            try {
                $alertsSent += $this->alerterProduit($product, $emailService, $fcmService, $smsService);
            } catch (\Throwable $e) {
                $produitsIgnores++;

                Log::error('Alerte stock non envoyée pour ce produit, poursuite du lot', [
                    'produit_id' => $product->id,
                    'produit' => $product->nom,
                    'boutique_id' => $product->boutique_id,
                    'exception' => $e::class,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        Log::info("Alertes stock envoyées: {$alertsSent} notifications pour {$productsInAlert->count()} produits", [
            'produits_ignores' => $produitsIgnores,
        ]);
    }

    /**
     * Notifie les gérants d'une boutique qu'un produit est en alerte.
     *
     * @return int le nombre de destinataires effectivement notifiés
     */
    private function alerterProduit(
        Produit $product,
        EmailService $emailService,
        FcmService $fcmService,
        SmsService $smsService,
    ): int {
        $boutiqueId = $product->boutique_id ?? $product->boutiqueId;

        // Destinataires pour LA boutique de ce produit :
        // - les membres rattachés comme GÉRANT (via le pivot)
        // - le propriétaire de la boutique
        $destinataires = $this->destinataires($boutiqueId);

        if ($destinataires->isEmpty()) {
            return 0;
        }

        $niveau = $product->estEnRupture() ? 'rupture' : 'alerte';
        $envoyes = 0;

        foreach ($destinataires as $destinataire) {
            // Chaque canal est isolé : le SMS n'a pas le droit d'annuler
            // l'email et le push d'un même destinataire.
            $this->essayer('email', $product, $boutiqueId, fn () => $emailService->sendStockAlert(
                $destinataire,
                $product->nom,
                $product->quantite_stock,
                $product->seuil_alerte,
            ));

            $this->essayer('fcm', $product, $boutiqueId, fn () => $fcmService->sendStockAlert(
                $destinataire,
                $product->nom,
                $product->quantite_stock,
            ));

            $this->essayer('broadcast', $product, $boutiqueId, function () use ($product, $boutiqueId, $niveau) {
                if ($boutiqueId) {
                    broadcast(new StockAlerte($product, $boutiqueId, $niveau));
                }
            });

            // SMS seulement si configuré, sinon chaque alerte journaliserait
            // une erreur pour un canal volontairement coupé.
            if (config('services.sms.enabled', false)) {
                $this->essayer('sms', $product, $boutiqueId, fn () => $smsService->sendStockAlert(
                    $destinataire,
                    $product->nom,
                    $product->quantite_stock,
                ));
            }

            $envoyes++;
        }

        return $envoyes;
    }

    /**
     * Exécute un canal d'alerte sans propager l'échec.
     */
    private function essayer(string $canal, Produit $product, ?int $boutiqueId, callable $action): void
    {
        try {
            $action();
        } catch (\Throwable $e) {
            Log::error("Canal d'alerte stock en échec : {$canal}", [
                'canal' => $canal,
                'produit_id' => $product->id,
                'produit' => $product->nom,
                'boutique_id' => $boutiqueId,
                'exception' => $e::class,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Les gérants actifs du pivot, plus le propriétaire de la boutique.
     *
     * @return Collection<int, User>
     */
    private function destinataires(?int $boutiqueId)
    {
        if (! $boutiqueId) {
            return collect();
        }

        $ids = BoutiqueUser::forBoutique($boutiqueId)
            ->gerants()
            ->pluck('user_id')
            ->all();

        $proprietaireId = Boutique::whereKey($boutiqueId)->value('proprietaire_id');

        if ($proprietaireId) {
            $ids[] = $proprietaireId;
        }

        $ids = array_unique(array_filter($ids));

        if (empty($ids)) {
            return collect();
        }

        return User::whereIn('id', $ids)->where('est_actif', true)->get();
    }
}
