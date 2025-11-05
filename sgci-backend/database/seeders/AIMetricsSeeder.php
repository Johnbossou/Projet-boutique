<?php

// Fichier: database/seeders/AIMetricsSeeder.php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AIMetricsSeeder extends Seeder
{
    public function run()
    {
        // Données de démonstration pour les métriques IA
        DB::table('ai_metrics')->insert([
            [
                'type_entrainement' => 'modele_demande',
                'date_debut' => now()->subDays(2),
                'date_fin' => now()->subDays(2)->addHours(1),
                'statut' => 'termine',
                'precision' => 0.872,
                'loss' => 0.154321,
                'metrics' => json_encode([
                    'accuracy' => 0.872,
                    'f1_score' => 0.856,
                    'recall' => 0.841,
                    'precision_score' => 0.872
                ]),
                'erreur' => null,
                'created_at' => now()->subDays(2),
                'updated_at' => now()->subDays(2)->addHours(1),
            ],
            [
                'type_entrainement' => 'modele_promotions',
                'date_debut' => now()->subDays(1),
                'date_fin' => now()->subDays(1)->addMinutes(45),
                'statut' => 'termine',
                'precision' => 0.791,
                'loss' => 0.198765,
                'metrics' => json_encode([
                    'accuracy' => 0.791,
                    'roi_moyen' => 18.5,
                    'taux_succes' => 0.723
                ]),
                'erreur' => null,
                'created_at' => now()->subDays(1),
                'updated_at' => now()->subDays(1)->addMinutes(45),
            ]
        ]);

        $this->command->info('✅ Métriques IA de démonstration créées !');
        $this->command->info('📊 2 entraînements simulés avec données réalistes');
    }
}
