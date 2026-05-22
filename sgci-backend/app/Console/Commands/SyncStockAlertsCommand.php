<?php

namespace App\Console\Commands;

use App\Http\Controllers\API\NotificationController;
use Illuminate\Console\Command;

class SyncStockAlertsCommand extends Command
{
    protected $signature = 'sgci:sync-stock-alerts';

    protected $description = 'Génère les notifications de stock bas et rupture pour les gérants';

    public function handle(): int
    {
        $created = NotificationController::generateStockAlerts();
        $this->info("Notifications créées : {$created}");

        return self::SUCCESS;
    }
}
