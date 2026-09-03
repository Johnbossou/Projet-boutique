<?php

namespace Tests\Feature;

use App\Models\Boutique;
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
            'type' => 'entree',
        ])->assertCreated();

        $id = $mouvement->json('mouvement.id');

        $this->postJson("/api/mouvements-stock/{$id}/valider")
            ->assertForbidden();
    }

    public function test_proprietaire_can_update_own_boutique(): void
    {
        $proprietaire = User::create([
            'name' => 'Proprietaire Test',
            'email' => 'proprietaire-boutique@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'proprietaire',
            'est_actif' => true,
        ]);

        $boutique = \App\Models\Boutique::create([
            'nom' => 'Ma Boutique',
            'adresse' => 'Adresse',
            'proprietaire_id' => $proprietaire->id,
        ]);

        Sanctum::actingAs($proprietaire);

        $this->putJson("/api/boutiques/{$boutique->id}", [
            'nom' => 'Nouveau Nom Boutique',
            'devise' => 'FCFA',
            'taux_tva' => 18,
        ])
            ->assertOk()
            ->assertJsonPath('boutique.nom', 'Nouveau Nom Boutique');
    }

    public function test_gerant_cannot_update_boutique_infos(): void
    {
        $gerant = $this->createGerant();
        $proprietaire = User::create([
            'name' => 'Proprietaire Test',
            'email' => 'proprietaire-gerant@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'proprietaire',
            'est_actif' => true,
        ]);

        $boutique = \App\Models\Boutique::create([
            'nom' => 'Boutique',
            'adresse' => 'Adresse',
            'proprietaire_id' => $proprietaire->id,
        ]);

        Sanctum::actingAs($gerant);

        $this->putJson("/api/boutiques/{$boutique->id}", [
            'nom' => 'Piraté',
        ])->assertForbidden();
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

    public function test_switch_boutique_updates_current_boutique(): void
    {
        $proprietaire = User::create([
            'name' => 'Proprietaire Test',
            'email' => 'proprietaire-test@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'proprietaire',
            'est_actif' => true,
        ]);

        $boutique1 = \App\Models\Boutique::create([
            'nom' => 'Boutique 1',
            'adresse' => 'Adresse 1',
            'proprietaire_id' => $proprietaire->id,
        ]);

        $boutique2 = \App\Models\Boutique::create([
            'nom' => 'Boutique 2',
            'adresse' => 'Adresse 2',
            'proprietaire_id' => $proprietaire->id,
        ]);

        $proprietaire->boutiques()->attach([$boutique1->id, $boutique2->id]);
        $proprietaire->update(['current_boutique_id' => $boutique1->id]);

        Sanctum::actingAs($proprietaire);

        $this->postJson('/api/switch-boutique', [
            'boutique_id' => $boutique2->id,
        ])
            ->assertOk()
            ->assertJsonPath('current_boutique_id', $boutique2->id);

        $proprietaire->refresh();
        $this->assertEquals($boutique2->id, $proprietaire->current_boutique_id);
    }

    public function test_proprietaire_cannot_switch_to_non_owned_boutique(): void
    {
        $proprietaire = User::create([
            'name' => 'Proprietaire Test',
            'email' => 'proprietaire-test@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'proprietaire',
            'est_actif' => true,
        ]);

        $otherProprietaire = User::create([
            'name' => 'Other Proprietaire',
            'email' => 'other@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'proprietaire',
            'est_actif' => true,
        ]);

        $otherBoutique = \App\Models\Boutique::create([
            'nom' => 'Other Boutique',
            'adresse' => 'Other Address',
            'proprietaire_id' => $otherProprietaire->id,
        ]);

        Sanctum::actingAs($proprietaire);

        $this->postJson('/api/switch-boutique', [
            'boutique_id' => $otherBoutique->id,
        ])
            ->assertStatus(403);
    }

    public function test_pagination_works_on_products_endpoint(): void
    {
        $gerant = $this->createGerant();
        Sanctum::actingAs($gerant);

        $categorie = Categorie::create([
            'nom' => 'Test Cat',
            'description' => 'Desc',
            'couleur' => '#3b82f6',
            'icone' => 'package',
        ]);

        // Create 25 products
        for ($i = 1; $i <= 25; $i++) {
            Produit::create([
                'nom' => "Produit {$i}",
                'description' => 'Test',
                'prix' => 1000,
                'quantite_stock' => 50,
                'seuil_alerte' => 5,
                'categorie_id' => $categorie->id,
                'unite_mesure' => 'unite',
            ]);
        }

        $response = $this->getJson('/api/produits?per_page=10');

        // Le contrôleur renvoie le paginateur sérialisé à plat
        $response->assertOk()
            ->assertJsonStructure([
                'data',
                'current_page',
                'last_page',
                'per_page',
                'total',
            ])
            ->assertJsonPath('per_page', 10)
            ->assertJsonPath('total', 25);

        $this->assertCount(10, $response->json('data'));
    }

    public function test_login_validation_requires_email(): void
    {
        $this->postJson('/api/login', [
            'password' => 'password',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_login_validation_requires_password(): void
    {
        $this->postJson('/api/login', [
            'email' => 'test@example.com',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
    }

    public function test_produit_validation_requires_nom(): void
    {
        $gerant = $this->createGerant();
        Sanctum::actingAs($gerant);

        $this->postJson('/api/produits', [
            'prix' => 1000,
            'quantite_stock' => 50,
            'seuil_alerte' => 5,
            'unite_mesure' => 'unite',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['nom']);
    }

    public function test_rate_limiting_on_login(): void
    {
        $this->createGerant();

        // Make 6 login attempts (limit is 5 per minute)
        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/api/login', [
                'email' => 'gerant-test@sgci.bj',
                'password' => 'wrongpassword',
            ]);
        }

        // The 6th attempt should be rate limited
        $this->postJson('/api/login', [
            'email' => 'gerant-test@sgci.bj',
            'password' => 'password',
        ])
            ->assertStatus(429);
    }

    // =====================================================================
    // Sécurité : réinitialisation de mot de passe
    // =====================================================================

    public function test_forgot_password_never_leaks_token(): void
    {
        $user = $this->createGerant();

        $response = $this->postJson('/api/forgot-password', [
            'email' => 'gerant-test@sgci.bj',
        ]);

        $response->assertOk()
            ->assertJsonMissing(['token'])
            ->assertJsonMissing(['reset_link']);

        // Réponse identique pour un email inconnu (pas d'énumération de comptes)
        $this->postJson('/api/forgot-password', ['email' => 'inconnu@sgci.bj'])
            ->assertOk()
            ->assertJsonPath('message', $response->json('message'));

        // Le token stocké doit être un hash, pas le token en clair
        $user->refresh();
        $this->assertNotNull($user->password_reset_token);
        $this->assertSame(64, strlen($user->password_reset_token)); // sha256 hex
    }

    public function test_reset_password_with_hashed_token_flow(): void
    {
        $user = $this->createGerant();

        // Simuler ce que forgotPassword stocke : le hash du token envoyé par email
        $plainToken = 'token-en-clair-envoye-par-email';
        $user->forceFill([
            'password_reset_token' => hash('sha256', $plainToken),
            'password_reset_expires_at' => now()->addHour(),
        ])->save();

        // Créer une vraie session Sanctum (pas actingAs, qui court-circuite
        // la vérification du token) pour tester son invalidation après reset.
        $oldToken = $user->createToken('session')->plainTextToken;

        // Token erroné refusé
        $this->postJson('/api/reset-password', [
            'token' => 'mauvais-token',
            'password' => 'nouveau-mot-de-passe',
            'password_confirmation' => 'nouveau-mot-de-passe',
        ])->assertStatus(422);

        // Bon token : mot de passe changé
        $this->postJson('/api/reset-password', [
            'token' => $plainToken,
            'password' => 'nouveau-mot-de-passe',
            'password_confirmation' => 'nouveau-mot-de-passe',
        ])->assertOk();

        $user->refresh();
        $this->assertNull($user->password_reset_token);

        // Le nouveau mot de passe fonctionne
        $this->assertTrue(Hash::check('nouveau-mot-de-passe', $user->password));

        // Les anciennes sessions ont été invalidées
        $this->assertDatabaseMissing('personal_access_tokens', [
            'tokenable_id' => $user->id,
            'name' => 'session',
        ]);
        $this->withHeader('Authorization', "Bearer {$oldToken}")
            ->getJson('/api/me')
            ->assertUnauthorized();
    }

    public function test_reset_password_requires_min_8_chars(): void
    {
        $this->postJson('/api/reset-password', [
            'token' => 'x',
            'password' => 'court7',
            'password_confirmation' => 'court7',
        ])->assertStatus(422)
          ->assertJsonValidationErrors(['password']);
    }

    public function test_register_cree_utilisateur_boutique_et_pivot(): void
    {        $this->postJson('/api/register', [
            'name' => 'Nouveau Proprio',
            'email' => 'nouveau@sgci.bj',
            'password' => 'password',
            'password_confirmation' => 'password',
            'boutique_nom' => 'Ma Boutique Test',
        ])->assertStatus(201)
          ->assertJsonPath('user.role', 'proprietaire')
          ->assertJsonPath('boutique.nom', 'Ma Boutique Test');

        $user = User::where('email', 'nouveau@sgci.bj')->firstOrFail();
        $boutique = Boutique::where('nom', 'Ma Boutique Test')->firstOrFail();

        $this->assertSame($boutique->id, $user->current_boutique_id);
        $this->assertSame($user->id, $boutique->proprietaire_id);
        // Pivot boutique_user rempli (requis pour whereHas('boutiques'))
        $this->assertTrue($boutique->users()->where('users.id', $user->id)->exists());
        $this->assertTrue($user->aAccesBoutique($boutique->id));
    }

    public function test_vente_avec_cle_idempotence_ne_est_pas_dupliquee(): void
    {
        $caissier = $this->createCaissier();
        Sanctum::actingAs($caissier);
        BoutiqueSetting::current();

        $produit = $this->seedProduit();
        $cle = 'offline_1700000000_abc123';

        $payload = [
            'ligne_ventes' => [
                ['produit_id' => $produit->id, 'quantite' => 2],
            ],
            'mode_paiement' => 'especes',
            'montant_recu' => 3000,
            'idempotency_key' => $cle,
        ];

        // Première soumission (vente offline créée)
        $premiere = $this->postJson('/api/ventes', $payload)
            ->assertCreated()
            ->assertJsonPath('idempotency_key', $cle);

        // Renvoi après perte de réseau : même clé → même vente, pas de doublon
        $renvoi = $this->postJson('/api/ventes', $payload)
            ->assertOk()
            ->assertJsonPath('idempotency_key', $cle);

        $this->assertSame($premiere->json('id'), $renvoi->json('id'));
        $this->assertSame(1, Vente::where('idempotency_key', $cle)->count());

        // Le stock n'est décrémenté qu'une seule fois
        $produit->refresh();
        $this->assertEquals(48, $produit->quantite_stock);
    }
}
