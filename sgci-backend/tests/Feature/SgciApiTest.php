<?php

namespace Tests\Feature;

use App\Models\BoutiqueSetting;
use App\Models\Categorie;
use App\Models\Produit;
use App\Models\User;
use App\Models\Vente;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SgciApiTest extends TestCase
{
    use RefreshDatabase;

    private function createGerant(): User
    {
        return User::create([
            'name' => 'Gérant Test',
            'email' => 'gerant-test@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);
    }

    private function createCaissier(): User
    {
        return User::create([
            'name' => 'Caissier Test',
            'email' => 'caissier-test@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'caissier',
            'est_actif' => true,
        ]);
    }

    private function seedProduit(): Produit
    {
        $categorie = Categorie::create([
            'nom' => 'Test Cat',
            'description' => 'Desc',
            'couleur' => '#3b82f6',
            'icone' => 'package',
        ]);

        return Produit::create([
            'nom' => 'Produit Test',
            'description' => 'Test',
            'prix' => 1000,
            'quantite_stock' => 50,
            'seuil_alerte' => 5,
            'categorie_id' => $categorie->id,
            'unite_mesure' => 'unite',
            'image_url' => 'https://example.com/img.jpg',
        ]);
    }

    public function test_health_endpoint_is_public(): void
    {
        $this->getJson('/api/health')
            ->assertOk()
            ->assertJsonPath('status', 'OK');
    }

    public function test_login_returns_token_for_valid_user(): void
    {
        $this->createGerant();

        $this->postJson('/api/login', [
            'email' => 'gerant-test@sgci.bj',
            'password' => 'password',
        ])
            ->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'email', 'role']]);
    }

    public function test_inactive_user_cannot_login(): void
    {
        User::create([
            'name' => 'Inactif',
            'email' => 'inactif@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'caissier',
            'est_actif' => false,
        ]);

        $this->postJson('/api/login', [
            'email' => 'inactif@sgci.bj',
            'password' => 'password',
        ])->assertStatus(422);
    }

    public function test_store_vente_with_payment_fields(): void
    {
        $caissier = $this->createCaissier();
        Sanctum::actingAs($caissier);
        BoutiqueSetting::current();

        $produit = $this->seedProduit();

        $response = $this->postJson('/api/ventes', [
            'ligne_ventes' => [
                ['produit_id' => $produit->id, 'quantite' => 2],
            ],
            'remise' => 0,
            'mode_paiement' => 'especes',
            'montant_recu' => 3000,
        ]);

        $response->assertCreated()
            ->assertJsonPath('statut', 'termine')
            ->assertJsonPath('mode_paiement', 'especes');

        $this->assertDatabaseHas('ventes', [
            'mode_paiement' => 'especes',
            'statut' => 'termine',
        ]);

        $produit->refresh();
        $this->assertEquals(48, $produit->quantite_stock);
    }

    public function test_annuler_vente_via_post_endpoint(): void
    {
        $caissier = $this->createCaissier();
        Sanctum::actingAs($caissier);
        BoutiqueSetting::current();

        $produit = $this->seedProduit();

        $create = $this->postJson('/api/ventes', [
            'ligne_ventes' => [
                ['produit_id' => $produit->id, 'quantite' => 1],
            ],
            'mode_paiement' => 'mtn',
            'numero_transaction' => 'MTN-123',
        ])->assertCreated();

        $venteId = $create->json('id');

        $this->postJson("/api/ventes/{$venteId}/annuler")
            ->assertOk()
            ->assertJsonPath('vente.statut', 'annule');

        $produit->refresh();
        $this->assertEquals(50, $produit->quantite_stock);
    }

    public function test_caissier_cannot_validate_stock_movement(): void
    {
        $caissier = $this->createCaissier();
        Sanctum::actingAs($caissier);
        $produit = $this->seedProduit();

        $mouvement = $this->postJson('/api/mouvements-stock', [
            'produit_id' => $produit->id,
            'quantite' => 10,
            'raison' => 'arrivage',
            'type' => 'entrée',
        ])->assertCreated();

        $id = $mouvement->json('mouvement.id');

        $this->postJson("/api/mouvements-stock/{$id}/valider")
            ->assertForbidden();
    }

    public function test_gerant_can_update_boutique_settings(): void
    {
        $gerant = $this->createGerant();
        Sanctum::actingAs($gerant);

        $this->putJson('/api/boutique/settings', [
            'nom' => 'Ma Boutique SGCI',
            'devise' => 'FCFA',
            'taux_tva' => 18,
        ])
            ->assertOk()
            ->assertJsonPath('settings.nom', 'Ma Boutique SGCI');
    }

    public function test_caissier_cannot_create_users(): void
    {
        $caissier = $this->createCaissier();
        Sanctum::actingAs($caissier);

        $this->postJson('/api/users', [
            'name' => 'Nouveau',
            'email' => 'nouveau@sgci.bj',
            'password' => 'password',
            'role' => 'caissier',
        ])->assertForbidden();
    }

    public function test_produit_accepts_image_url(): void
    {
        $gerant = $this->createGerant();
        Sanctum::actingAs($gerant);

        $categorie = Categorie::create([
            'nom' => 'Cat',
            'description' => 'D',
            'couleur' => '#000',
            'icone' => 'box',
        ]);

        $this->postJson('/api/produits', [
            'nom' => 'Avec image',
            'prix' => 500,
            'quantite_stock' => 10,
            'seuil_alerte' => 2,
            'categorie_id' => $categorie->id,
            'unite_mesure' => 'unite',
            'image_url' => 'https://cdn.example/p.jpg',
        ])
            ->assertCreated()
            ->assertJsonPath('image_url', 'https://cdn.example/p.jpg');
    }

    public function test_refresh_token_returns_new_token(): void
    {
        $gerant = $this->createGerant();
        Sanctum::actingAs($gerant);

        $response = $this->postJson('/api/refresh');

        $response->assertOk()
            ->assertJsonStructure(['token', 'expires_at', 'user']);
    }
}
