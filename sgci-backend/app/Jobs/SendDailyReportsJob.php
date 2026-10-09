<?php

namespace App\Jobs;

use App\Models\Boutique;
use App\Models\Vente;
use App\Services\EmailService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Envoie le rapport quotidien, une fois par boutique.
 *
 * Extrait de routes/console.php pour être testable : une closure déclarée dans
 * le fichier de scheduling n'est exerçable que par reflection, et sa logique
 * finit toujours par diverger des tests.
 *
 * Le périmètre est strictement par boutique. Le CA est calculé avec un filtre
 * boutique_id, et le destinataire est le gérant actif de CETTE boutique (à
 * défaut son propriétaire) : un gérant de deux agences reçoit deux rapports
 * distincts, et ne reçoit jamais le CA d'une autre agence.
 */
class SendDailyReportsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(EmailService $emailService): void
    {
        foreach (Boutique::with('proprietaire')->get() as $boutique) {
            $destinataire = $boutique->gerantActuel() ?? $boutique->proprietaire;

            if (! $destinataire || ! $destinataire->est_actif) {
                Log::info('Rapport quotidien ignoré : aucun destinataire actif', [
                    'boutique_id' => $boutique->id,
                ]);

                continue;
            }

            $ventesDuJour = Vente::terminees()
                ->duJour()
                ->where('boutique_id', $boutique->id);

            $stats = [
                'nombre_ventes' => (clone $ventesDuJour)->count(),
                'ca_total' => (clone $ventesDuJour)->sum('montant_total'),
                'panier_moyen' => (clone $ventesDuJour)->avg('montant_total'),
            ];

            $emailService->sendDailyReport($destinataire, $stats, $boutique);
        }
    }
}
