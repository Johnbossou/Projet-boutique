<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Vente;
use App\Models\LigneVente;
use App\Models\Produit;
use App\Models\User;
use App\Models\Client;
use Illuminate\Support\Facades\DB;

class VentesTableSeeder extends Seeder
{
    public function run()
    {
        // Nettoyer les ventes existantes
        DB::table('ligne_ventes')->delete();
        DB::table('ventes')->delete();

        // 🔥 RÉINITIALISER LES STOCKS AVANT DE COMMENCER
        $this->resetStocks();

        $caissiers = User::where('role', 'caissier')->get();
        $produits = Produit::all();
        $clients = Client::all(); // ⬅️ NOUVEAU : Récupérer les clients

        // Créer des ventes sur les 30 derniers jours
        for ($i = 0; $i < 200; $i++) {
            $dateVente = now()->subDays(rand(0, 30))->subHours(rand(0, 23))->subMinutes(rand(0, 59));

            // ⬅️ NOUVEAU : Assigner aléatoirement un client (ou null)
            $clientId = rand(0, 1) ? $clients->random()->id : null;

            $vente = Vente::create([
                'user_id' => $caissiers->random()->id,
                'client_id' => $clientId, // ⬅️ NOUVEAU : client_id ajouté
                'montant_total' => 0, // Sera calculé après
                'tva' => 0,
                'remise' => rand(0, 1) ? rand(100, 500) : 0,
                'statut' => 'termine',
                'notes' => $this->genererNotes($clientId), // ⬅️ AMÉLIORÉ : Notes contextuelles
                'created_at' => $dateVente,
                'updated_at' => $dateVente,
            ]);

            $montantTotal = 0;
            $nombreProduits = rand(1, 6);
            $produitsVendus = [];

            // Ajouter des lignes de vente
            for ($j = 0; $j < $nombreProduits; $j++) {
                do {
                    $produit = $produits->random();
                } while (in_array($produit->id, $produitsVendus));

                $produitsVendus[] = $produit->id;

                // VÉRIFIER LE STOCK DISPONIBLE AVANT DE VENDRE
                $quantiteMax = min(3, $produit->quantite_stock);
                $quantite = $quantiteMax > 0 ? rand(1, $quantiteMax) : 0;

                if ($quantite === 0) {
                    continue;
                }

                $prixUnitaire = $produit->prix;
                $sousTotal = $quantite * $prixUnitaire;

                LigneVente::create([
                    'vente_id' => $vente->id,
                    'produit_id' => $produit->id,
                    'quantite' => $quantite,
                    'prix_unitaire' => $prixUnitaire,
                    'sous_total' => $sousTotal,
                    'created_at' => $dateVente,
                    'updated_at' => $dateVente,
                ]);

                $montantTotal += $sousTotal;

                // ⬅️ AMÉLIORÉ : Utiliser la méthode diminuerStock du modèle
                $produit->diminuerStock($quantite);
            }

            // Si aucune ligne de vente valide, supprimer la vente
            if ($montantTotal === 0) {
                $vente->delete();
                continue;
            }

            // Appliquer la remise et TVA
            $montantTotal -= $vente->remise;
            $tva = $montantTotal * 0.18;

            $vente->update([
                'montant_total' => $montantTotal,
                'tva' => $tva,
            ]);

            // ⬅️ NOUVEAU : Mettre à jour les statistiques du client si applicable
            if ($vente->client_id) {
                $this->mettreAJourStatistiquesClient($vente->client_id);
            }
        }

        $this->command->info('✅ 200 ventes réalistes créées avec historique sur 30 jours !');
        $this->command->info('📊 Stocks mis à jour de façon réaliste !');
        $this->command->info('👥 Clients associés aux ventes !');
    }

    /**
     * 🔥 RÉINITIALISE LES STOCKS AVANT DE CRÉER LES VENTES
     */
    private function resetStocks()
    {
        $stocksInitiaux = [
            1 => 45,   // Riz Local 5kg
            2 => 28,   // Huile Végétale 1L
            3 => 3,    // Sucre 1kg (alerte)
            4 => 22,   // Farine de blé 2kg
            5 => 35,   // Sardines en boîte
            6 => 18,   // Jus d'Ananas 1L
            7 => 60,   // Eau Minérale 1.5L
            8 => 8,    // Soda Orange 33cl (alerte)
            9 => 5,    // Lait en poudre 400g (alerte)
            10 => 15,  // Câble USB Type-C
            11 => 8,   // Power Bank 10000mAh
            12 => 12,  // Écouteurs Bluetooth
            13 => 25,  // Savon de Marseille
            14 => 14,  // Détergent Liquide 1L
            15 => 20,  // Dentifrice 75ml
            16 => 16,  // Shampooing 400ml
            17 => 7,   // Déodorant Spray 150ml (alerte)
        ];

        foreach ($stocksInitiaux as $produitId => $stock) {
            Produit::where('id', $produitId)->update(['quantite_stock' => $stock]);
        }

        $this->command->info('🔄 Stocks réinitialisés avec succès !');
    }

    /**
     * 🆕 GÉNÈRE DES NOTES CONTEXTUELLES POUR LES VENTES
     */
    private function genererNotes(?int $clientId): ?string
    {
        if (!$clientId) {
            return rand(0, 1) ? 'Client anonyme' : null;
        }

        $notes = [
            'Client fidèle',
            'Paiement en espèces',
            'Paiement par carte',
            'Commande téléphonique',
            'Livraison à domicile',
            'Produits en promotion',
            'Client satisfait',
            'Nouveau client'
        ];

        return $notes[array_rand($notes)];
    }

    /**
     * 🆕 MET À JOUR LES STATISTIQUES DU CLIENT
     */
    private function mettreAJourStatistiquesClient(int $clientId): void
    {
        $client = Client::find($clientId);
        if ($client) {
            $client->mettreAJourStatistiques();
        }
    }
}
