<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Categorie;

class CategoriesTableSeeder extends Seeder
{
    public function run()
    {
        $categories = [
            ['nom' => 'Alimentaire', 'description' => 'Produits alimentaires', 'couleur' => '#3B82F6', 'icone' => '🍔'],
            ['nom' => 'Boissons', 'description' => 'Boissons et jus', 'couleur' => '#EF4444', 'icone' => '🥤'],
            ['nom' => 'Électronique', 'description' => 'Appareils électroniques', 'couleur' => '#10B981', 'icone' => '📱'],
            ['nom' => 'Maison', 'description' => 'Articles pour la maison', 'couleur' => '#F59E0B', 'icone' => '🏠'],
            ['nom' => 'Hygiène', 'description' => 'Produits d\'hygiène', 'couleur' => '#8B5CF6', 'icone' => '🧴'],
        ];

        foreach ($categories as $categorie) {
            Categorie::create($categorie);
        }
    }
}
