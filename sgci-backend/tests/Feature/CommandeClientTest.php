<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\Categorie;
use App\Models\Client;
use App\Models\CommandeClient;
use App\Models\Produit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CommandeClientTest extends TestCase
{
    use RefreshDatabase;

    private Boutique $boutique;
    private User $gerant;
    private Client $client;
    private Produit $produit;

    protected function setUp(): void
    {
        parent::setUp();

        $this->gerant = User::create([
            'name' => 'Gérant Commande',
            'email' => 'gerant-commande@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);

        $this->boutique = Boutique::create([
            'nom' => 'Boutique Commande',
            'adresse' => 'Dassa',
            'proprietaire_id' => $this->gerant->id,
        ]);

        $this->gerant->boutiques()->attach($this->boutique->id);
        $this->gerant->update(['current_boutique_id' => $this->boutique->id]);

        $this->client = Client::create([
            'nom' => 'Client Commande',
            'email' => 'client-commande@sgci.bj',
            'telephone' => '22997000000',
            'boutique_id' => $this->boutique->id,
        ]);

        $cat = Categorie::create(['nom' => 'Cat C', 'description' => 'C', 'couleur' => '#000', 'icone' => 'box']);
        $this->produit = Produit::create([
            'nom' => 'Produit C',
            'description' => 'Test',
            'prix' => 10000,
            'quantite_stock' => 30,
            'seuil_alerte' => 5,
            'categorie_id' => $cat->id,
            'unite_mesure' => 'unite',
            'boutique_id' => $this->boutique->id,
        ]);
    }

    private function creerCommande(string $statut = 'en_attente', ?Boutique $boutique = null): CommandeClient
    {
        return CommandeClient::create([
            'numero_commande' => 'CMD-' . uniqid(),
            'client_id' => $this->client->id,
            'boutique_id' => $boutique ? $boutique->id : $this->boutique->id,
            'date_commande' => now(),
            'statut' => $statut,
            'montant_total' => 20000,
            'montant_paye' => 0,
            'mode_paiement' => 'especes',
            'notes' => 'test',
            'user_id' => $this->gerant->id,
        ]);
    }

    public function test_store_cree_commande_en_attente(): void
    {
        Sanctum::actingAs($this->gerant);

        $this->postJson('/api/commandes-clients', [
            'client_id' => $this->client->id,
            'date_livraison_prevue' => now()->addDays(15)->format('Y-m-d'),
            'mode_paiement' => 'especes',
            'notes' => 'Urgent',
            'lignes' => [
                [
                    'produit_id' => $this->produit->id,
                    'quantite' => 2,
                    'prix_unitaire' => 10000,
                    'remise_pourcentage' => 0,
                ],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('data.statut', 'en_attente')
            ->assertJsonPath('data.client_id', $this->client->id)
            ->assertJsonCount(1, 'data.lignes');

        $this->assertDatabaseHas('commande_clients', [
            'boutique_id' => $this->boutique->id,
            'client_id' => $this->client->id,
            'statut' => 'en_attente',
            'montant_total' => 20000.00,
        ]);

        $this->assertDatabaseHas('lignes_commande_clients', [
            'produit_id' => $this->produit->id,
            'quantite' => 2,
            'prix_unitaire' => 10000.00,
        ]);
    }

    public function test_store_errors_de_validation(): void
    {
        Sanctum::actingAs($this->gerant);

        $this->postJson('/api/commandes-clients', [
            'lignes' => [],
        ])
            ->assertStatus(422);

        $this->postJson('/api/commandes-clients', [
            'client_id' => $this->client->id,
            'lignes' => [
                ['produit_id' => $this->produit->id, 'quantite' => 0, 'prix_unitaire' => -5],
            ],
        ])
            ->assertStatus(422);

        $this->assertDatabaseCount('commande_clients', 0);
    }

    public function test_index_scope_a_la_boutique_courante(): void
    {
        Sanctum::actingAs($this->gerant);

        $this->creerCommande('en_attente');

        $otherBoutique = Boutique::create([
            'nom' => 'Autre',
            'adresse' => 'Abomey',
            'proprietaire_id' => $this->gerant->id,
        ]);
        $this->creerCommande('livre', $otherBoutique);

        $response = $this->getJson('/api/commandes-clients');

        $response->assertOk()
            ->assertJsonPath('total', 1);

        $ids = collect($response->json('data'))->pluck('id');
        $this->assertSame(
            CommandeClient::where('boutique_id', $this->boutique->id)->pluck('id')->all(),
            $ids->all()
        );
    }

    public function test_valider_transition(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande('en_attente');

        $this->postJson("/api/commandes-clients/{$commande->id}/valider")
            ->assertOk()
            ->assertJsonPath('data.statut', 'en_cours');

        $this->assertDatabaseHas('commande_clients', [
            'id' => $commande->id,
            'statut' => 'en_cours',
        ]);
    }

    public function test_livrer_transition(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande('en_cours');

        $this->postJson("/api/commandes-clients/{$commande->id}/livrer")
            ->assertOk()
            ->assertJsonPath('data.statut', 'livre');

        $this->assertDatabaseHas('commande_clients', [
            'id' => $commande->id,
            'statut' => 'livre',
        ]);

        $this->assertSame(
            30,
            $this->produit->fresh()->quantite_stock,
            'La livraison ne doit pas decrementer le stock'
        );
    }

    public function test_annuler_transition(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande('en_attente');

        $this->postJson("/api/commandes-clients/{$commande->id}/annuler")
            ->assertOk()
            ->assertJsonPath('data.statut', 'annule');

        $this->assertDatabaseHas('commande_clients', [
            'id' => $commande->id,
            'statut' => 'annule',
        ]);
    }

    public function test_commande_dune_autre_boutique_inaccessible(): void
    {
        Sanctum::actingAs($this->gerant);

        $otherBoutique = Boutique::create([
            'nom' => 'Boutique Autre',
            'adresse' => 'Cotonou',
            'proprietaire_id' => $this->gerant->id,
        ]);

        $commande = $this->creerCommande('en_attente', $otherBoutique);

        $this->getJson("/api/commandes-clients/{$commande->id}")->assertStatus(403);
        $this->postJson("/api/commandes-clients/{$commande->id}/valider")->assertStatus(403);
        $this->postJson("/api/commandes-clients/{$commande->id}/annuler")->assertStatus(403);
        $this->postJson("/api/commandes-clients/{$commande->id}/livrer")->assertStatus(403);

        $this->assertDatabaseHas('commande_clients', [
            'id' => $commande->id,
            'statut' => 'en_attente',
        ]);
    }

    public function test_caissier_interdit_sur_store(): void
    {
        $caissier = User::create([
            'name' => 'Caissier',
            'email' => 'caissier-commande@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'caissier',
            'est_actif' => true,
        ]);
        $caissier->boutiques()->attach($this->boutique->id);
        $caissier->update(['current_boutique_id' => $this->boutique->id]);

        Sanctum::actingAs($caissier);

        $this->postJson('/api/commandes-clients', [
            'client_id' => $this->client->id,
            'lignes' => [
                ['produit_id' => $this->produit->id, 'quantite' => 1, 'prix_unitaire' => 1000],
            ],
        ])
            ->assertStatus(403);

        $this->assertDatabaseCount('commande_clients', 0);
    }
}