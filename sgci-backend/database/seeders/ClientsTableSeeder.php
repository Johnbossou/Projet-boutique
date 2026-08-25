<?php

namespace Database\Seeders;

use App\Models\Client;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class ClientsTableSeeder extends Seeder
{
    public function run()
    {
        $clients = [
            [
                'nom' => 'Koffi Mensah',
                'email' => 'koffi.mensah@email.com',
                'telephone' => '+229 01 02 03 04',
                'adresse' => '123 Rue du Commerce, Cotonou',
                'ville' => 'Cotonou',
                'statut' => 'vip',
                'notes' => 'Client fidèle depuis 2 ans, aime les produits locaux',
                'total_achats' => 1250000,
                'nombre_commandes' => 12,
                'derniere_commande' => now()->subDays(2),
            ],
            [
                'nom' => 'Aïcha Bello',
                'email' => 'aicha.bello@email.com',
                'telephone' => '+229 05 06 07 08',
                'adresse' => '456 Avenue des Martyrs, Porto-Novo',
                'ville' => 'Porto-Novo',
                'statut' => 'actif',
                'notes' => 'Préfère les produits bio et écologiques',
                'total_achats' => 450000,
                'nombre_commandes' => 5,
                'derniere_commande' => now()->subDays(5),
            ],
            [
                'nom' => 'Jean Dossou',
                'email' => 'jean.dossou@email.com',
                'telephone' => '+229 09 10 11 12',
                'adresse' => '789 Boulevard Steinmetz, Cotonou',
                'ville' => 'Cotonou',
                'statut' => 'actif',
                'total_achats' => 280000,
                'nombre_commandes' => 3,
                'derniere_commande' => now()->subDays(15),
            ],
            [
                'nom' => 'Marie Akplogan',
                'email' => 'marie.akplogan@email.com',
                'telephone' => '+229 13 14 15 16',
                'adresse' => '321 Route de l\'Aéroport, Calavi',
                'ville' => 'Calavi',
                'statut' => 'vip',
                'notes' => 'Client corporate, commandes régulières',
                'total_achats' => 890000,
                'nombre_commandes' => 8,
                'derniere_commande' => now()->subDays(8),
            ],
            [
                'nom' => 'David Soglo',
                'email' => 'david.soglo@email.com',
                'telephone' => '+229 17 18 19 20',
                'adresse' => '654 Rue des Pêcheurs, Ouidah',
                'ville' => 'Ouidah',
                'statut' => 'inactif',
                'total_achats' => 120000,
                'nombre_commandes' => 2,
                'derniere_commande' => now()->subDays(85),
            ],
            [
                'nom' => 'Fatouma Ibrahim',
                'email' => 'fatouma.ibrahim@email.com',
                'telephone' => '+229 21 22 23 24',
                'adresse' => '987 Avenue du Nouveau Pont, Cotonou',
                'ville' => 'Cotonou',
                'statut' => 'actif',
                'notes' => 'Nouvelle cliente très satisfaite',
                'total_achats' => 670000,
                'nombre_commandes' => 6,
                'derniere_commande' => now()->subDays(3),
            ],
            [
                'nom' => 'Samuel Adékambi',
                'email' => 'samuel.adekami@email.com',
                'telephone' => '+229 25 26 27 28',
                'adresse' => '147 Rue du Marché, Abomey-Calavi',
                'ville' => 'Abomey-Calavi',
                'statut' => 'actif',
                'total_achats' => 320000,
                'nombre_commandes' => 4,
                'derniere_commande' => now()->subDays(12),
            ],
            [
                'nom' => 'Chantal Zinsou',
                'email' => 'chantal.zinsou@email.com',
                'telephone' => '+229 29 30 31 32',
                'adresse' => '258 Allée des Cocotiers, Cotonou',
                'ville' => 'Cotonou',
                'statut' => 'vip',
                'notes' => 'Client premium, panier moyen élevé',
                'total_achats' => 2100000,
                'nombre_commandes' => 15,
                'derniere_commande' => now()->subDays(1),
            ]
        ];

        foreach ($clients as $client) {
            Client::firstOrCreate(['email' => $client['email']], $client);
        }

        $this->command->info('✅ 8 clients réalistes créés avec historique d\'achats !');
        $this->command->info('👑 3 clients VIP');
        $this->command->info('⚡ 4 clients actifs');
        $this->command->info('💤 1 client inactif');
    }
}
