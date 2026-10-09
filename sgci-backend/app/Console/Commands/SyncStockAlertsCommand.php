<?php

namespace App\Console\Commands;

use App\Http\Controllers\API\NotificationController;
use App\Models\Boutique;
use Illuminate\Console\Command;

class SyncStockAlertsCommand extends Command
{
    protected $signature = 'sgci:sync-stock-alerts';

    protected $description = 'Génère les notifications de stock bas et rupture pour les gérants';

    public function handle(): int
    {
        $total = 0;

        // La génération est volontairement par boutique : chaque gérant ne doit
        // recevoir que les alertes des produits de ses propres boutiques.
        Boutique::query()
            ->select('id', 'nom')
            ->orderBy('id')
            ->each(function (Boutique $boutique) use (&$total) {
                $created = NotificationController::generateStockAlerts($boutique->id);
                $total += $created;

                if ($created > 0) {
                    $this->line(sprintf('  %s : %d', $boutique->nom, $created));
                }
            });

        $this->info("Notifications créées : {$total}");

        return self::SUCCESS;
    }
}
