<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\Boutique;
use App\Models\Categorie;
use App\Models\Produit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AlertsTest extends TestCase
{
    use RefreshDatabase;

    private User $gerant;
    private Boutique $boutique;

    protected function setUp(): void
    {
        parent::setUp();

        $proprietaire = User::create([
            'name' => 'Propriétaire',
            'email' => 'proprio@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'proprietaire',
            'est_actif' => true,
        ]);

        $this->boutique = Boutique::create([
            'nom' => 'Boutique Alertes',
            'devise' => 'XOF',
            'proprietaire_id' => $proprietaire->id,
        ]);
        $proprietaire->forceFill(['current_boutique_id' => $this->boutique->id])->save();
        $this->boutique->users()->attach($proprietaire->id, ['role_dans_boutique' => 'proprietaire']);

        $this->gerant = User::create([
            'name' => 'Gérant Alertes',
            'email' => 'gerant-alertes@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);
        $this->gerant->forceFill(['current_boutique_id' => $this->boutique->id])->save();
        $this->boutique->users()->attach($this->gerant->id, ['role_dans_boutique' => 'gerant']);

        Sanctum::actingAs($this->gerant);
    }

    private function createProduit(array $overrides = []): Produit
    {
        $categorie = Categorie::firstOrCreate([
            'nom' => 'Cat Alertes',
            'boutique_id' => $this->boutique->id,
        ]);

        return Produit::create(array_merge([
            'nom' => 'Produit ' . uniqid(),
            'prix' => 1000,
            'quantite_stock' => 50,
            'seuil_alerte' => 5,
            'categorie_id' => $categorie->id,
            'unite_mesure' => 'unite',
            'boutique_id' => $this->boutique->id,
        ], $overrides));
    }

    public function test_stock_alerts_check_cree_des_notifications_et_ne_plante_pas(): void
    {
        // Produit en alerte (stock sous le seuil) + produit en rupture
        $this->createProduit(['quantite_stock' => 2]);
        $this->createProduit(['quantite_stock' => 0]);

        $this->postJson('/api/stock-alerts/check')->assertOk()
            ->assertJsonPath('boutique_id', $this->boutique->id);

        $types = AppNotification::where('user_id', $this->gerant->id)
            ->pluck('type');

        $this->assertContains('stock_alert', $types);
        $this->assertContains('stock_rupture', $types);
    }

    public function test_peremption_check_cree_des_notifications_et_ne_plante_pas(): void
    {
        // Produit proche de la péremption + produit déjà périmé
        $this->createProduit([
            'nom' => 'Yaourt',
            'est_perissable' => true,
            'date_peremption' => now()->addDays(3),
        ]);
        $this->createProduit([
            'nom' => 'Lait',
            'est_perissable' => true,
            'date_peremption' => now()->subDay(),
        ]);

        $this->postJson('/api/peremption/check')->assertOk();

        $types = AppNotification::where('user_id', $this->gerant->id)
            ->pluck('type');

        $this->assertContains('peremption_alert', $types);
        $this->assertContains('peremption_expired', $types);
    }

    public function test_notifications_contiennent_donnees_structurees(): void
    {
        $produit = $this->createProduit(['quantite_stock' => 1]);

        $this->postJson('/api/stock-alerts/check')->assertOk();

        $notification = AppNotification::where('type', 'stock_alert')
            ->where('user_id', $this->gerant->id)
            ->firstOrFail();

        $this->assertSame($produit->id, $notification->data['produit_id']);
        $this->assertNotNull($notification->title);
        $this->assertNull($notification->read_at);
    }
}
