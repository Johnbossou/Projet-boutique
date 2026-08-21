<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class BoutiqueSeeder extends Seeder
{
    public function run(): void
    {
        // À exécuter en dernier : crée la boutique par défaut et y rattache
        // toutes les données créées par les autres seeders.

        $owner = DB::table('users')->where('role', 'proprietaire')->orderBy('id')->first();

        if (! $owner) {
            $this->command->warn('⚠ Aucun utilisateur proprietaire : BoutiqueSeeder ignoré.');

            return;
        }

        $boutiqueId = DB::table('boutiques')->insertGetId([
            'nom' => 'Boutique Centrale Cotonou',
            'adresse' => 'Cotonou, Bénin',
            'telephone' => '+229 21 00 00 00',
            'email' => 'contact@sgci.bj',
            'devise' => 'XOF',
            'taux_tva' => 18.00,
            'delai_annulation_vente_minutes' => 5,
            'proprietaire_id' => $owner->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Rattacher tous les utilisateurs à la boutique (pivot + boutique courante)
        foreach (DB::table('users')->get() as $user) {
            $roleDansBoutique = match ($user->role) {
                'proprietaire', 'gerant' => 'gerant',
                default => 'caissier',
            };

            DB::table('boutique_user')->insert([
                'boutique_id' => $boutiqueId,
                'user_id' => $user->id,
                'role_dans_boutique' => $roleDansBoutique,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('users')->where('id', $user->id)->update([
                'current_boutique_id' => $boutiqueId,
            ]);
        }

        // Rattacher les données métier créées sans boutique
        foreach (['produits', 'ventes', 'clients', 'categories', 'mouvements_stock', 'audit_logs'] as $table) {
            if (DB::getSchemaBuilder()->hasTable($table)) {
                DB::table($table)->whereNull('boutique_id')->update(['boutique_id' => $boutiqueId]);
            }
        }

        $this->command->info('✅ Boutique par défaut créée et données rattachées !');
    }
}
