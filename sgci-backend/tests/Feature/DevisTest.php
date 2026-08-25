<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\Categorie;
use App\Models\Client;
use App\Models\Devis;
use App\Models\LigneDevis;
use App\Models\Produit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DevisTest extends TestCase
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
            'name' => 'Gérant Devis',
            'email' => 'gerant-devis@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);

        $this->boutique = Boutique::create([
            'nom' => 'Boutique Devis',
            'adresse' => 'Dassa',
            'proprietaire_id' => $this->gerant->id,
        ]);

        $this->gerant->boutiques()->attach($this->boutique->id);
        $this->gerant->update(['current_boutique_id' => $this->boutique->id]);

        $this->client = Client::create([
            'nom' => 'Client Devis',
            'email' => 'client-devis@sgci.bj',
            'telephone' => '22997000000',
            'boutique_id' => $this->boutique->id,
        ]);

        $cat = Categorie::create(['nom' => 'Cat D', 'description' => 'D', 'couleur' => '#000', 'icone' => 'box']);
        $this->produit = Produit::create([
            'nom' => 'Produit D',
            'description' => 'Test',
            'prix' => 10000,
            'quantite_stock' => 30,
            'seuil_alerte' => 5,
            'categorie_id' => $cat->id,
            'unite_mesure' => 'unite',
            'boutique_id' => $this->boutique->id,
        ]);
    }

    public function test_store_devis(): void
    {
        Sanctum::actingAs($this->gerant);

        $this->postJson('/api/devis', [
            'client_id' => $this->client->id,
            'date_validite' => now()->addDays(15)->format('Y-m-d'),
            'lignes' => [
                ['produit_id' => $this->produit->id, 'quantite' => 3, 'prix_unitaire' => 10000],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('data.statut', 'en_attente');

        $this->assertDatabaseHas('devis', ['boutique_id' => $this->boutique->id]);
    }

    public function test_accepter_devis(): void
    {
        Sanctum::actingAs($this->gerant);

        $devis = Devis::create([
            'numero_devis' => 'DEV-TEST01',
            'client_id' => $this->client->id,
            'boutique_id' => $this->boutique->id,
            'user_id' => $this->gerant->id,
            'date_devis' => now(),
            'date_validite' => now()->addDays(30),
            'montant_total' => 30000,
            'statut' => 'en_attente',
        ]);

        $this->postJson("/api/devis/{$devis->id}/accepter")
            ->assertOk()
            ->assertJsonPath('data.statut', 'accepte');
    }

    public function test_refuser_devis(): void
    {
        Sanctum::actingAs($this->gerant);

        $devis = Devis::create([
            'numero_devis' => 'DEV-TEST02',
            'client_id' => $this->client->id,
            'boutique_id' => $this->boutique->id,
            'user_id' => $this->gerant->id,
            'date_devis' => now(),
            'date_validite' => now()->addDays(30),
            'montant_total' => 30000,
            'statut' => 'en_attente',
        ]);

        $this->postJson("/api/devis/{$devis->id}/refuser")
            ->assertOk()
            ->assertJsonPath('data.statut', 'refuse');
    }

    public function test_ne_peut_pas_accepter_devis_refuse(): void
    {
        Sanctum::actingAs($this->gerant);

        $devis = Devis::create([
            'numero_devis' => 'DEV-TEST03',
            'client_id' => $this->client->id,
            'boutique_id' => $this->boutique->id,
            'user_id' => $this->gerant->id,
            'date_devis' => now(),
            'date_validite' => now()->addDays(30),
            'montant_total' => 30000,
            'statut' => 'refuse',
        ]);

        $this->postJson("/api/devis/{$devis->id}/accepter")->assertStatus(400);
    }

    public function test_pdf_endpoint(): void
    {
        if (!class_exists(\Barryvdh\DomPDF\Facade\Pdf::class)) {
            $this->markTestSkipped('DomPDF non installé');
        }

        Sanctum::actingAs($this->gerant);

        $devis = Devis::create([
            'numero_devis' => 'DEV-PDF01',
            'client_id' => $this->client->id,
            'boutique_id' => $this->boutique->id,
            'user_id' => $this->gerant->id,
            'date_devis' => now(),
            'date_validite' => now()->addDays(30),
            'montant_total' => 20000,
            'statut' => 'en_attente',
        ]);

        LigneDevis::create([
            'devis_id' => $devis->id,
            'produit_id' => $this->produit->id,
            'quantite' => 2,
            'prix_unitaire' => 10000,
            'montant_total' => 20000,
            'remise_pourcentage' => 0,
        ]);

        $response = $this->getJson("/api/devis/{$devis->id}/pdf");

        $response->assertOk()
            ->assertHeader('content-type', 'application/pdf');
    }

    public function test_devis_boutique_isolation(): void
    {
        $otherBoutique = Boutique::create([
            'nom' => 'Autre',
            'adresse' => 'Abomey',
            'proprietaire_id' => $this->gerant->id,
        ]);

        $devis = Devis::create([
            'numero_devis' => 'DEV-ISO01',
            'client_id' => $this->client->id,
            'boutique_id' => $otherBoutique->id,
            'user_id' => $this->gerant->id,
            'date_devis' => now(),
            'date_validite' => now()->addDays(30),
            'montant_total' => 5000,
            'statut' => 'en_attente',
        ]);

        // Set current boutique to the first one — should not see the other's devis
        $this->gerant->update(['current_boutique_id' => $this->boutique->id]);
        Sanctum::actingAs($this->gerant);

        $this->getJson("/api/devis/{$devis->id}")->assertStatus(403);
    }
}
