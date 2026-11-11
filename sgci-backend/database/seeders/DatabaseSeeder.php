<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run()
    {
        // En production, aucun seed.
        //
        // Les seeders creent des comptes de demonstration dont le mot de
        // passe est « password » : gerant@sgci.bj, proprietaire@sgci.bj...
        // Deployed sur une base neuve, le conteneur les creeait au premier
        // demarrage, et n'importe qui pouvait se connecter a l application
        // avec un mot de passe connu. Le premier gerant se cree par la page
        // d inscription, qui cree aussi sa boutique.
        if (app()->environment('production')) {
            $this->command?->info('Production : seed ignore (les comptes de demonstration ne doivent pas exister).');

            return;
        }

        $this->call([
            UsersTableSeeder::class,
            BoutiqueSettingsSeeder::class,
            CategoriesTableSeeder::class,
            ProduitsTableSeeder::class,
            ClientsTableSeeder::class,
            VentesTableSeeder::class,
            AIMetricsSeeder::class,
            BoutiqueSeeder::class,
        ]);
    }
}
