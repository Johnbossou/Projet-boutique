<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Categorie;
use App\Models\Produit;
use App\Models\AiPrediction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AIServiceTest extends TestCase
{
    use RefreshDatabase;

    private function createGerant(): User
    {
        return User::create([
            'name' => 'Gerant Test',
            'email' => 'gerant@test.com',
            'password' => bcrypt('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);
    }

    private function createProduit(): Produit
    {
        $categorie = Categorie::create(['nom' => 'Categorie Test']);

        return Produit::create([
            'nom' => 'Produit Test',
            'description' => 'Description',
            'prix' => 1000,
            'quantite_stock' => 50,
            'seuil_alerte' => 10,
            'categorie_id' => $categorie->id,
            'unite_mesure' => 'unite',
        ]);
    }

    public function test_predictions_demande_returns_predictions(): void
    {
        $user = $this->createGerant();
        $this->createProduit();

        $response = $this->actingAs($user)
            ->getJson('/api/predictions/demande');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'predictions',
                'meta',
            ]);
    }

    public function test_predictions_reapprovisionnement_returns_200(): void
    {
        $user = $this->createGerant();
        $this->createProduit();

        $response = $this->actingAs($user)
            ->getJson('/api/predictions/reapprovisionnement');

        $response->assertStatus(200);
    }

    public function test_ia_recommandations_promotions(): void
    {
        $user = $this->createGerant();
        $this->createProduit();

        $response = $this->actingAs($user)
            ->getJson('/api/ia/recommandations-promotions');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'recommandations',
                'meta',
            ]);
    }

    public function test_ia_metrics_performance(): void
    {
        $user = $this->createGerant();

        $response = $this->actingAs($user)
            ->getJson('/api/ia/metrics-performance');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'precision',
                'impact_business',
                'historique',
                'statut_modele',
            ]);
    }

    public function test_entrainer_modele_creates_ai_metrics(): void
    {
        $user = $this->createGerant();

        $response = $this->actingAs($user)
            ->postJson('/api/ia/entrainer-modele');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('ai_metrics', [
            'type_entrainement' => 'recalcul_analyses',
            'statut' => 'termine',
        ]);
    }

    public function test_ai_prediction_model_uses_current_schema(): void
    {
        $user = $this->createGerant();
        $produit = $this->createProduit();

        AiPrediction::create([
            'produit_id' => $produit->id,
            'date_prediction' => now()->toDateString(),
            'demande_predite' => 12,
            'type_prediction' => 'demande_hebdo',
            'metadonnees' => ['source' => 'test'],
        ]);

        $this->assertDatabaseHas('ai_predictions', [
            'produit_id' => $produit->id,
            'demande_predite' => 12,
            'type_prediction' => 'demande_hebdo',
        ]);
    }
}
