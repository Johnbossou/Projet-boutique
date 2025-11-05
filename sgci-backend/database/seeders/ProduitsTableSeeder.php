<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use App\Models\Produit;
use App\Models\Categorie;

class ProduitsTableSeeder extends Seeder
{
    public function run()
    {
        DB::beginTransaction();

        try {
            // Assurer l'existence des catégories (correspond au CategoriesTableSeeder fourni)
            $categoriesDef = [
                ['nom' => 'Alimentaire', 'description' => 'Produits alimentaires', 'couleur' => '#3B82F6', 'icone' => '🍔'],
                ['nom' => 'Boissons',    'description' => 'Boissons et jus',       'couleur' => '#EF4444', 'icone' => '🥤'],
                ['nom' => 'Électronique','description' => 'Appareils électroniques','couleur' => '#10B981','icone' => '📱'],
                ['nom' => 'Maison',      'description' => 'Articles pour la maison','couleur' => '#F59E0B','icone' => '🏠'],
                ['nom' => 'Hygiène',     'description' => 'Produits d\'hygiène',    'couleur' => '#8B5CF6', 'icone' => '🧴'],
            ];

            $categorieIds = [];
            foreach ($categoriesDef as $cat) {
                $c = Categorie::firstOrCreate(
                    ['nom' => $cat['nom']],
                    ['description' => $cat['description'], 'couleur' => $cat['couleur'], 'icone' => $cat['icone']]
                );
                $categorieIds[$cat['nom']] = $c->id;
            }

            // utilitaire : stocks autour de 400 (variation légère)
            $stockInit = function() {
                return rand(350, 450); // autour de 400
            };

            $produits = [
                // ---------- ALIMENTAIRE
                ['nom' => 'Riz Local 5kg',        'description' => 'Riz local de qualité supérieure, sac de 5kg',    'prix' => 2500, 'seuil_alerte' => 50, 'categorie' => 'Alimentaire', 'est_perissable' => false, 'unite_mesure' => 'sac'],
                ['nom' => 'Riz Basmati 5kg',      'description' => 'Riz basmati parfumé, sac 5kg',                    'prix' => 4200, 'seuil_alerte' => 40, 'categorie' => 'Alimentaire', 'est_perissable' => false, 'unite_mesure' => 'sac'],
                ['nom' => 'Huile Végétale 1L',    'description' => 'Huile végétale pour cuisine, bouteille 1L',      'prix' => 1200, 'seuil_alerte' => 60, 'categorie' => 'Alimentaire', 'est_perissable' => false, 'unite_mesure' => 'bouteille'],
                ['nom' => 'Sucre 1kg',            'description' => 'Sucre cristallisé raffiné, paquet de 1kg',       'prix' => 900,  'seuil_alerte' => 40, 'categorie' => 'Alimentaire', 'est_perissable' => false, 'unite_mesure' => 'kg'],
                ['nom' => 'Farine de blé 2kg',    'description' => 'Farine de blé tendre, idéale pour pâtisserie',   'prix' => 1800, 'seuil_alerte' => 45, 'categorie' => 'Alimentaire', 'est_perissable' => false, 'unite_mesure' => 'sachet'],
                ['nom' => 'Haricots rouges 1kg',  'description' => 'Haricots rouges secs, riches en protéines',      'prix' => 1300, 'seuil_alerte' => 40, 'categorie' => 'Alimentaire', 'est_perissable' => false, 'unite_mesure' => 'kg'],
                ['nom' => 'Sardines en boîte',    'description' => 'Sardines à l\'huile d\'olive, boîte 125g',       'prix' => 450,  'seuil_alerte' => 30, 'categorie' => 'Alimentaire', 'est_perissable' => false, 'unite_mesure' => 'boîte'],

                // ---------- BOISSONS
                ['nom' => 'Jus d\'Ananas 1L',     'description' => 'Jus d\'ananas naturel, bouteille 1L',            'prix' => 800,  'seuil_alerte' => 50, 'categorie' => 'Boissons', 'est_perissable' => true,  'unite_mesure' => 'bouteille'],
                ['nom' => 'Eau Minérale 1.5L',    'description' => 'Eau minérale naturelle, bouteille 1.5L',         'prix' => 350,  'seuil_alerte' => 60, 'categorie' => 'Boissons', 'est_perissable' => false, 'unite_mesure' => 'bouteille'],
                ['nom' => 'Soda Orange 33cl',    'description' => 'Soda à l\'orange, cannette 33cl',                'prix' => 300,  'seuil_alerte' => 50, 'categorie' => 'Boissons', 'est_perissable' => false, 'unite_mesure' => 'cannette'],
                ['nom' => 'Lait en poudre 400g', 'description' => 'Lait en poudre entier, boîte 400g',              'prix' => 1200, 'seuil_alerte' => 40, 'categorie' => 'Boissons', 'est_perissable' => false, 'unite_mesure' => 'boîte'],
                ['nom' => 'Café instantané 100g', 'description' => 'Café soluble pur arabica',                       'prix' => 2500, 'seuil_alerte' => 40, 'categorie' => 'Boissons', 'est_perissable' => false, 'unite_mesure' => 'bocal'],
                ['nom' => 'Thé noir 25 sachets', 'description' => 'Thé noir intense, boîte de 25 sachets',         'prix' => 1000, 'seuil_alerte' => 40, 'categorie' => 'Boissons', 'est_perissable' => false, 'unite_mesure' => 'boîte'],

                // ---------- ÉLECTRONIQUE
                ['nom' => 'Câble USB Type-C',     'description' => 'Câble de charge USB vers Type-C, 1m',            'prix' => 2500, 'seuil_alerte' => 40, 'categorie' => 'Électronique', 'est_perissable' => false, 'unite_mesure' => 'unité'],
                ['nom' => 'Chargeur Rapide 25W',  'description' => 'Chargeur rapide compatible Android et iPhone',   'prix' => 7000, 'seuil_alerte' => 40, 'categorie' => 'Électronique', 'est_perissable' => false, 'unite_mesure' => 'unité'],
                ['nom' => 'Power Bank 10000mAh',  'description' => 'Batterie externe portable, 10000mAh',           'prix' => 8500, 'seuil_alerte' => 30, 'categorie' => 'Électronique', 'est_perissable' => false, 'unite_mesure' => 'unité'],
                ['nom' => 'Écouteurs Bluetooth',  'description' => 'Écouteurs sans fil avec étui de charge',        'prix' => 4500, 'seuil_alerte' => 30, 'categorie' => 'Électronique', 'est_perissable' => false, 'unite_mesure' => 'paire'],
                ['nom' => 'Clé USB 32Go',         'description' => 'Clé USB haute vitesse 32Go',                   'prix' => 5000, 'seuil_alerte' => 40, 'categorie' => 'Électronique', 'est_perissable' => false, 'unite_mesure' => 'unité'],
                ['nom' => 'Casque Audio',         'description' => 'Casque filaire haute qualité',                  'prix' => 6000, 'seuil_alerte' => 30, 'categorie' => 'Électronique', 'est_perissable' => false, 'unite_mesure' => 'unité'],

                // ---------- MAISON
                ['nom' => 'Savon de Marseille',    'description' => 'Savon traditionnel, 300g',                      'prix' => 650,  'seuil_alerte' => 30, 'categorie' => 'Maison', 'est_perissable' => false, 'unite_mesure' => 'unité'],
                ['nom' => 'Détergent Liquide 1L', 'description' => 'Détergent multi-usages, bouteille 1L',         'prix' => 950,  'seuil_alerte' => 40, 'categorie' => 'Maison', 'est_perissable' => false, 'unite_mesure' => 'bouteille'],
                ['nom' => 'Eau de Javel 1L',      'description' => 'Eau de javel concentrée pour nettoyage',       'prix' => 800,  'seuil_alerte' => 30, 'categorie' => 'Maison', 'est_perissable' => false, 'unite_mesure' => 'bouteille'],
                ['nom' => 'Papier Hygiénique (6)', 'description' => 'Papier hygiénique doux et résistant (lot 6)',  'prix' => 2000, 'seuil_alerte' => 40, 'categorie' => 'Maison', 'est_perissable' => false, 'unite_mesure' => 'lot'],
                ['nom' => 'Ampoule LED 9W',        'description' => 'Ampoule LED économique 9W',                    'prix' => 700,  'seuil_alerte' => 30, 'categorie' => 'Maison', 'est_perissable' => false, 'unite_mesure' => 'unité'],
                ['nom' => 'Sac Poubelle 50L (10)', 'description' => 'Sac poubelle résistant, paquet 10',            'prix' => 900,  'seuil_alerte' => 50, 'categorie' => 'Maison', 'est_perissable' => false, 'unite_mesure' => 'paquet'],

                // ---------- HYGIÈNE
                ['nom' => 'Dentifrice 75ml',       'description' => 'Dentifrice protection caries, 75ml',           'prix' => 1200, 'seuil_alerte' => 30, 'categorie' => 'Hygiène', 'est_perissable' => false, 'unite_mesure' => 'tube'],
                ['nom' => 'Shampooing 400ml',     'description' => 'Shampooing revitalisant, 400ml',               'prix' => 1800, 'seuil_alerte' => 30, 'categorie' => 'Hygiène', 'est_perissable' => false, 'unite_mesure' => 'flacon'],
                ['nom' => 'Gel Hydroalcoolique',  'description' => 'Gel désinfectant mains 500ml',                 'prix' => 1500, 'seuil_alerte' => 25, 'categorie' => 'Hygiène', 'est_perissable' => false, 'unite_mesure' => 'bouteille'],
                ['nom' => 'Déodorant Spray 150ml', 'description' => 'Déodorant fraîcheur longue durée',             'prix' => 1500, 'seuil_alerte' => 30, 'categorie' => 'Hygiène', 'est_perissable' => false, 'unite_mesure' => 'spray'],
            ];

            $inserted = 0;
            $alertCount = 0;

            foreach ($produits as $p) {
                // assigne le stock initial autour de 400
                $p['quantite_stock'] = $stockInit();

                // récupérer l'id de la catégorie par nom (défini plus haut)
                $categorieNom = $p['categorie'];
                $p['categorie_id'] = $categorieIds[$categorieNom] ?? null;
                unset($p['categorie']);

                if (!$p['categorie_id']) {
                    // si la catégorie n'existe pas pour une raison quelconque, sauter ce produit
                    $this->command->warn("⚠️ Catégorie manquante pour le produit : {$p['nom']} (skipped)");
                    continue;
                }

                // create or update pour éviter doublons
                $produit = Produit::updateOrCreate(
                    ['nom' => $p['nom'], 'categorie_id' => $p['categorie_id']],
                    $p
                );

                $inserted++;

                if ($produit->quantite_stock <= $produit->seuil_alerte) {
                    $alertCount++;
                }
            }

            DB::commit();

            $this->command->info("✅ {$inserted} produits ajoutés / mis à jour (stocks autour de 400).");
            $this->command->info("🚨 {$alertCount} produits en alerte de stock (après création).");
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->command->error('Erreur pendant le seeding : ' . $e->getMessage());
            throw $e;
        }
    }
}
