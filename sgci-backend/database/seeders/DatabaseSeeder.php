<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run()
    {
        $this->call([
            UsersTableSeeder::class,
            CategoriesTableSeeder::class,
            ProduitsTableSeeder::class,
            ClientsTableSeeder::class,
            VentesTableSeeder::class, // ⬅️ AJOUT IMPORTANT !
            AIMetricsSeeder::class, // ← AJOUTEZ CETTE LIGNE

        ]);
    }
}
