<?php

namespace Database\Seeders;

use App\Models\BoutiqueSetting;
use Illuminate\Database\Seeder;

class BoutiqueSettingsSeeder extends Seeder
{
    public function run(): void
    {
        BoutiqueSetting::firstOrCreate([], [
            'nom' => 'SGCI Bénin',
            'adresse' => 'Cotonou, Bénin',
            'telephone' => '+229 00 00 00 00',
            'email' => 'contact@sgci.bj',
            'devise' => 'FCFA',
            'taux_tva' => 18.00,
            'delai_annulation_vente_minutes' => 5,
        ]);
    }
}
