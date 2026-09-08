<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\Categorie;
use App\Models\CommandeFournisseur;
use App\Models\Fournisseur;
use App\Models\LigneCommandeFournisseur;
use App\Models\MouvementStock;
use App\Models\Produit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CommandeFournisseurTest extends TestCase
{
    use RefreshDatabase;

    private Boutique $boutique;
    private User $gerant;
    private Fournisseur $fournisseur;
    private Produit $produit;

    protected function setUp(): void
    {
        parent::setUp();

        $this->gerant = User::create([
            'name' => 'Gérant Commande Fournisseur',
            'email' => 'gerant-commande-fournisseur@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);

        $this->boutique = Boutique::create([
            'nom' => 'Boutique Commande Fournisseur',
            'adresse' => 'Dassa',
            'proprietaire_id' => $this->gerant->id,
        ]);

        $this->gerant->boutiques()->attach($this->boutique->id);
        $this->gerant->update(['current_boutique_id' => $this->boutique->id]);

        $this->fournisseur = Fournisseur::create([
            'nom' => 'Fournisseur Principal',
            'email' => 'principal@sgci.bj',
            'telephone' => '22997000000',
            'actif' => true,
            'boutique_id' => $this->boutique->id,
        ]);

        $categorie = Categorie::create([
            'nom' => 'Catégorie Test',
            'boutique_id' => $this->boutique->id,
        ]);

        $this->produit = Produit::create([
            'nom' => 'Produit Test',
            'description' => 'Produit pour test',
            'prix' => 1000,
            'quantite_stock' => 5,
            'seuil_alerte' => 2,
            'categorie_id' => $categorie->id,
            'boutique_id' => $this->boutique->id,
            'unite_mesure' => 'piece',
        ]);
    }

    private function creerCommande(string $statut = 'en_attente', int $montant = 20000): CommandeFournisseur
    {
        $commande = CommandeFournisseur::create([
            'numero_commande' => 'CF-TEST-' . uniqid(),
            'fournisseur_id' => $this->fournisseur->id,
            'boutique_id' => $this->boutique->id,
            'date_commande' => now(),
            'statut' => $statut,
            'montant_total' => $montant,
            'montant_paye' => 0,
            'user_id' => $this->gerant->id,
        ]);

        LigneCommandeFournisseur::create([
            'commande_fournisseur_id' => $commande->id,
            'produit_id' => $this->produit->id,
            'quantite_commandee' => 2,
            'quantite_recue' => 0,
            'prix_unitaire' => 10000,
            'montant_total' => 20000,
            'statut' => 'en_attente',
        ]);

        return $commande;
    }

    public function test_store_creer_une_commande(): void
    {
        Sanctum::actingAs($this->gerant);

        $this->postJson('/api/commandes-fournisseurs', [
            'fournisseur_id' => $this->fournisseur->id,
            'date_livraison_prevue' => now()->addDays(7)->format('Y-m-d'),
            'notes' => 'Commande test',
            'lignes' => [
                [
                    'produit_id' => $this->produit->id,
                    'quantite_commandee' => 3,
                    'prix_unitaire' => 10000,
                ],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('data.statut', 'en_attente')
            ->assertJsonPath('data.montant_total', '30000.00');

        $this->assertDatabaseHas('commande_fournisseurs', [
            'fournisseur_id' => $this->fournisseur->id,
            'boutique_id' => $this->boutique->id,
            'statut' => 'en_attente',
            'montant_total' => 30000,
        ]);
    }

    public function test_store_validation_erreurs(): void
    {
        Sanctum::actingAs($this->gerant);

        $this->postJson('/api/commandes-fournisseurs', [])
            ->assertStatus(422);
    }

    public function test_index_liste_les_commandes_de_la_boutique_courante(): void
    {
        Sanctum::actingAs($this->gerant);

        $this->creerCommande();
        $this->creerCommande('en_cours');

        $autreBoutique = Boutique::create([
            'nom' => 'Boutique Autre',
            'adresse' => 'Abomey',
            'proprietaire_id' => $this->gerant->id,
        ]);

        CommandeFournisseur::create([
            'numero_commande' => 'CF-AUTRE-' . uniqid(),
            'fournisseur_id' => $this->fournisseur->id,
            'boutique_id' => $autreBoutique->id,
            'date_commande' => now(),
            'statut' => 'en_attente',
            'montant_total' => 10000,
            'montant_paye' => 0,
            'user_id' => $this->gerant->id,
        ]);

        $this->getJson('/api/commandes-fournisseurs')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('total', 2);
    }

    public function test_index_filtre_par_statut(): void
    {
        Sanctum::actingAs($this->gerant);

        $this->creerCommande('en_attente');
        $this->creerCommande('en_cours');

        $this->getJson('/api/commandes-fournisseurs?statut=en_cours')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.statut', 'en_cours');
    }

    public function test_show_commande(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande();

        $this->getJson("/api/commandes-fournisseurs/{$commande->id}")
            ->assertOk()
            ->assertJsonPath('id', $commande->id)
            ->assertJsonPath('statut', 'en_attente');
    }

    public function test_commande_dune_autre_boutique_est_invisible(): void
    {
        Sanctum::actingAs($this->gerant);

        $autreBoutique = Boutique::create([
            'nom' => 'Boutique B',
            'adresse' => 'Parakou',
            'proprietaire_id' => $this->gerant->id,
        ]);

        $commande = CommandeFournisseur::create([
            'numero_commande' => 'CF-AUTRE-' . uniqid(),
            'fournisseur_id' => $this->fournisseur->id,
            'boutique_id' => $autreBoutique->id,
            'date_commande' => now(),
            'statut' => 'en_attente',
            'montant_total' => 10000,
            'montant_paye' => 0,
            'user_id' => $this->gerant->id,
        ]);

        $this->getJson("/api/commandes-fournisseurs/{$commande->id}")->assertStatus(403);
        $this->putJson("/api/commandes-fournisseurs/{$commande->id}", ['notes' => 'Modifié'])->assertStatus(403);
        $this->deleteJson("/api/commandes-fournisseurs/{$commande->id}")->assertStatus(403);
    }

    public function test_update_commande(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande();

        $this->putJson("/api/commandes-fournisseurs/{$commande->id}", [
            'notes' => 'Notes mises à jour',
            'date_livraison_prevue' => now()->addDays(10)->format('Y-m-d'),
        ])
            ->assertOk()
            ->assertJsonPath('data.notes', 'Notes mises à jour');
    }

    public function test_valider_commande(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande();

        $this->postJson("/api/commandes-fournisseurs/{$commande->id}/valider")
            ->assertOk()
            ->assertJsonPath('data.statut', 'en_cours');
    }

    public function test_ne_peut_pas_valider_commande_deja_validee(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande('en_cours');

        $this->postJson("/api/commandes-fournisseurs/{$commande->id}/valider")
            ->assertStatus(400);
    }

    public function test_payer_commande(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande('en_cours', 20000);

        $this->postJson("/api/commandes-fournisseurs/{$commande->id}/payer", [
            'montant' => 15000,
        ])
            ->assertOk()
            ->assertJsonPath('data.montant_paye', '15000.00');

        $this->assertDatabaseHas('commande_fournisseurs', [
            'id' => $commande->id,
            'montant_paye' => 15000,
        ]);
    }

    public function test_paiement_depasse_le_reste_a_payer(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande('en_cours', 20000);

        $this->postJson("/api/commandes-fournisseurs/{$commande->id}/payer", [
            'montant' => 25000,
        ])->assertStatus(422);
    }

    public function test_receptionner_commande_augmente_le_stock(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande('en_cours');
        $stockAvant = $this->produit->quantite_stock;

        $ligne = $commande->lignes->first();

        $this->postJson("/api/commandes-fournisseurs/{$commande->id}/receptionner", [
            'lignes' => [
                [
                    'ligne_id' => $ligne->id,
                    'quantite_recue' => 2,
                ],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('data.commande.statut', 'livre');

        $this->assertDatabaseHas('produits', [
            'id' => $this->produit->id,
            'quantite_stock' => $stockAvant + 2,
        ]);

        $this->assertDatabaseHas('mouvements_stock', [
            'produit_id' => $this->produit->id,
            'type' => 'entree',
            'raison' => 'arrivage',
            'statut' => 'accepte',
        ]);
    }

    public function test_ne_peut_pas_receptionner_commande_en_attente(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande('en_attente');

        $ligne = $commande->lignes->first();

        $this->postJson("/api/commandes-fournisseurs/{$commande->id}/receptionner", [
            'lignes' => [
                [
                    'ligne_id' => $ligne->id,
                    'quantite_recue' => 1,
                ],
            ],
        ])->assertStatus(400);
    }

    public function test_annuler_commande(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande();

        $this->postJson("/api/commandes-fournisseurs/{$commande->id}/annuler")
            ->assertOk()
            ->assertJsonPath('data.statut', 'annule');
    }

    public function test_ne_peut_pas_annuler_commande_livree(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande('livre');

        $this->postJson("/api/commandes-fournisseurs/{$commande->id}/annuler")
            ->assertStatus(400);
    }

    public function test_destroy_commande(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande();

        $this->deleteJson("/api/commandes-fournisseurs/{$commande->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Commande supprimée avec succès');

        $this->assertSoftDeleted('commande_fournisseurs', ['id' => $commande->id]);
    }

    public function test_caissier_ne_peut_pas_creer_de_commande(): void
    {
        $caissier = User::create([
            'name' => 'Caissier Commande Fournisseur',
            'email' => 'caissier-commande-fournisseur@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'caissier',
            'est_actif' => true,
        ]);

        $caissier->boutiques()->attach($this->boutique->id, ['role_dans_boutique' => 'caissier']);
        $caissier->update(['current_boutique_id' => $this->boutique->id]);

        Sanctum::actingAs($caissier);

        $this->postJson('/api/commandes-fournisseurs', [
            'fournisseur_id' => $this->fournisseur->id,
            'lignes' => [
                [
                    'produit_id' => $this->produit->id,
                    'quantite_commandee' => 1,
                    'prix_unitaire' => 1000,
                ],
            ],
        ])->assertStatus(403);
    }
}