<?php

use App\Jobs\GenerateWeeklyPredictionsJob;
use App\Jobs\SendDailyReportsJob;
use App\Jobs\SendPredictionAlertsJob;
use App\Jobs\SendStockAlertsJob;
use App\Jobs\ValidatePredictionsJob;
use App\Models\AiPrediction;
use App\Models\Devis;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Synchronisation des alertes de stock (toutes les heures)
Schedule::command('sgci:sync-stock-alerts')->hourly();

// Alertes stock automatiques tous les jours à 9h.
//
// Aucun réglage « alertes_stock_actives » n'existe : la colonne n'a jamais été
// dans la migration boutique_settings, et `$modele->colonne_absente ?? defaut`
// renvoyait toujours le défaut. La condition était donc toujours vraie, le
// `when()` ne servait à rien, et le commentaire annonçait une fonctionnalité
// inexistante. Si un jour ce réglage est nécessaire, il doit être une colonne
// réelle (table boutiques, comme devise et taux_tva) et non un attribut
// fantôme masqué par un ??.
Schedule::job(new SendStockAlertsJob)
    ->dailyAt('09:00')
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

// Rapport quotidien par email à 8h, une fois par boutique.
//
// Même situation que les alertes stock : « rapport_quotidien_actif » n'existe
// pas dans la table, et le ?? false faisait toujours evaluates à false. Ce job
// n'a donc jamais rien envoyé. La porte est retirée plutôt qu'aidée par une
// colonne fantôme : le rapport part.
//
// Le périmètre est désormais strict. Avant, le CA était calculé sans filtre et
// chaque gérant recevait le total de toutes les agences, et un gérant de deux
// agences recevait deux fois le même mail.
//
// La logique vit dans SendDailyReportsJob, pas dans une closure ici : une
// closure de scheduling n'est exerçable que par reflection, donc sa logique
// finit toujours par diverger des tests.
Schedule::job(new SendDailyReportsJob)
    ->dailyAt('08:00')
    ->description('Envoyer le rapport quotidien par boutique');

// Rattrapage des PDF de factures manquants, chaque nuit à 3h.
//
// Le PDF est rendu après le commit de la facture : une panne DomPDF ou un
// fichier effacé du stockage laisse une facture valable sans PDF. Sans ce
// rattrapage automatique, l'invariant tiendrait uniquement jusqu'à ce qu'un
// humain lise le log « PDF manquant ».
Schedule::command('sgci:regenerer-pdf-factures')
    ->dailyAt('03:00')
    ->description('Régénérer les PDF de factures absents du stockage');

// Expiration automatique des devis (toutes les heures)
Schedule::call(function () {
    try {
        $expires = Devis::expire()->update(['statut' => 'expire']);

        if ($expires > 0) {
            Log::info('Devis expirés automatiquement', ['count' => $expires]);
        }
    } catch (Throwable $e) {
        Log::error('Erreur expiration devis', ['error' => $e->getMessage()]);
    }
})->hourly()->description('Expire les devis dont la date de validité est dépassée');
