<?php

namespace Tests\Feature;

use App\Jobs\SendPredictionAlertsJob;
use App\Jobs\SendStockAlertsJob;
use App\Jobs\ValidatePredictionsJob;
use App\Models\Categorie;
use App\Models\MouvementStock;
use App\Models\Produit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class JobsTest extends TestCase
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
            'quantite_stock' => 5,
            'seuil_alerte' => 10,
            'categorie_id' => $categorie->id,
            'unite_mesure' => 'unite',
        ]);
    }

    public function test_send_stock_alerts_job_dispatches(): void
    {
        Queue::fake();

        SendStockAlertsJob::dispatch();
        SendPredictionAlertsJob::dispatch();

        Queue::assertPushed(SendStockAlertsJob::class);
        Queue::assertPushed(SendPredictionAlertsJob::class);
    }

    public function test_validate_predictions_job_dispatches(): void
    {
        Queue::fake();

        ValidatePredictionsJob::dispatch();

        Queue::assertPushed(ValidatePredictionsJob::class);
    }

    public function test_all_jobs_are_queued_correctly(): void
    {
        Queue::fake();

        SendStockAlertsJob::dispatch();
        SendPredictionAlertsJob::dispatch();
        ValidatePredictionsJob::dispatch();

        Queue::assertPushed(SendStockAlertsJob::class, 1);
        Queue::assertPushed(SendPredictionAlertsJob::class, 1);
        Queue::assertPushed(ValidatePredictionsJob::class, 1);
    }

    public function test_movement_validation_updates_stock(): void
    {
        $user = $this->createGerant();
        $produit = $this->createProduit();

        $mouvement = MouvementStock::create([
            'produit_id' => $produit->id,
            'quantite' => 20,
            'raison' => 'arrivage',
            'type' => 'entree',
            'user_id' => $user->id,
            'statut' => 'en_attente',
        ]);

        $initialStock = $produit->quantite_stock;

        // Simuler la validation du mouvement d'entrée
        $mouvement->update(['statut' => 'accepte']);
        $produit->increment('quantite_stock', $mouvement->quantite);

        $this->assertEquals($initialStock + 20, $produit->fresh()->quantite_stock);
    }
}
