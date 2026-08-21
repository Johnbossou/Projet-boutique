<?php

use App\Jobs\GenerateWeeklyPredictionsJob;
use App\Jobs\SendPredictionAlertsJob;
use App\Jobs\SendStockAlertsJob;
use App\Jobs\ValidatePredictionsJob;
use App\Models\AiPrediction;
use App\Models\BoutiqueSetting;
use App\Models\User;
use App\Models\Vente;
use App\Services\EmailService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Synchronisation des alertes de stock (toutes les heures)
Schedule::command('sgci:sync-stock-alerts')->hourly();

// Alertes stock automatiques tous les jours à 9h
// (respecte le réglage boutique alertes_stock_actives)
Schedule::job(new SendStockAlertsJob)
    ->dailyAt('09:00')
    ->when(function () {
        try {
            return BoutiqueSetting::current()->alertes_stock_actives ?? true;
        } catch (\Throwable) {
            return true; // Actif par défaut si erreur
        }
    })
    ->description('Envoyer alertes stock automatiques aux gérants');

// Validation des prédictions IA tous les jours à minuit
Schedule::job(new ValidatePredictionsJob)
    ->dailyAt('00:00')
    ->description('Valider les prédictions IA avec les ventes réelles');

// Alertes prédictions IA critiques tous les jours à 8h30
Schedule::job(new SendPredictionAlertsJob)
    ->dailyAt('08:30')
    ->description('Envoyer alertes basées sur prédictions IA critiques');

// Génération des prédictions hebdomadaires tous les dimanches à 22h
Schedule::job(new GenerateWeeklyPredictionsJob)
    ->sundays()
    ->at('22:00')
    ->description('Générer les prédictions de demande pour la semaine suivante');

// Nettoyage des anciennes prédictions (plus de 90 jours) tous les lundis à 2h
Schedule::call(function () {
    AiPrediction::where('date_validation', '<', now()->subDays(90))->delete();
})
    ->mondays()
    ->at('02:00')
    ->description('Nettoyer les anciennes prédictions IA');

// Rapport quotidien par email à 8h
Schedule::call(function () {
    try {
        $settings = BoutiqueSetting::current();

        if ($settings->rapport_quotidien_actif ?? false) {
            $gerants = User::where('role', 'gerant')
                ->where('est_actif', true)
                ->get();

            foreach ($gerants as $gerant) {
                $stats = [
                    'nombre_ventes' => Vente::terminees()->duJour()->count(),
                    'ca_total' => Vente::terminees()->duJour()->sum('montant_total'),
                    'panier_moyen' => Vente::terminees()->duJour()->avg('montant_total'),
                ];

                app(EmailService::class)->sendDailyReport($gerant, $stats);
            }
        }
    } catch (\Throwable $e) {
        Log::error('Erreur rapport quotidien', ['error' => $e->getMessage()]);
    }
})
    ->dailyAt('08:00')
    ->description('Envoyer rapport quotidien par email');
