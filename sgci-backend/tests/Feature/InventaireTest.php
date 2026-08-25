<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\Categorie;
use App\Models\Inventaire;
use App\Models\InventaireLigne;
use App\Models\Produit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InventaireTest extends TestCase
{
    use RefreshDatabase;

    private Boutique $boutique;
    private User $gerant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->gerant = User::create([
            'name' => 'Gérant Inventaire',
            'email' => 'gerant-inv@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);

        $this->boutique = Boutique::create([
            'nom' => 'Boutique Inv',
            'adresse' => 'Porto-Novo',
            'proprietaire_id' => $this->gerant->id,
        ]);

        $this->gerant->boutiques()->attach($this->boutique->id);
        $this->gerant->update(['current_boutique_id' => $this->boutique->id]);
    }

    private function seedProduit(): Produit
    {
        $cat = Categorie::create(['nom' => 'Cat I', 'description' => 'D', 'couleur' => '#000', 'icone' => 'box']);
        return Produit::create([
            'nom' => 'Produit I',
            'description' => 'Test',
            'prix' => 2000,
            'quantite_stock' => 15,
            'seuil_alerte' => 3,
            'categorie_id' => $cat->id,
            'unite_mesure' => 'unite',
            'boutique_id' => $this->boutique->id,
        ]);
    }

    public function test_store_inventaire_cree_snapshot(): void
    {
        Sanctum::actingAs($this->gerant);
        $produit = $this->seedProduit();

        $response = $this->postJson('/api/inventaires');

        $response->assertCreated()
            ->assertJsonPath('data.statut', 'en_cours');

        $inventaire = Inventaire::first();
        $this->assertDatabaseHas('inventaire_lignes', [
            'inventaire_id' => $inventaire->id,
            'produit_id' => $produit->id,
            'quantite_systeme' => 15,
        ]);
    }

    public function test_compter_ecart_negatif(): void
    {
        Sanctum::actingAs($this->gerant);
        $this->seedProduit();
        $this->postJson('/api/inventaires');
        $inventaire = Inventaire::first();
        $ligne = $inventaire->lignes->first();

        $this->postJson("/api/inventaires/{$inventaire->id}/compter", [
            'lignes' => [
                ['inventaire_ligne_id' => $ligne->id, 'quantite_physique' => 12],
            ],
        ])->assertOk();

        $ligne->refresh();
        $this->assertEquals(12, $ligne->quantite_physique);
        $this->assertEquals(-3, $ligne->ecart);
        $this->assertEquals(1, $inventaire->refresh() ? $inventaire->ecarts_detectes : 0);
    }

    public function test_valider_inventaire_ajuste_stock(): void
    {
        Sanctum::actingAs($this->gerant);
        $produit = $this->seedProduit();
        $this->postJson('/api/inventaires');
        $inventaire = Inventaire::first();
        $ligne = $inventaire->lignes->first();

        $this->postJson("/api/inventaires/{$inventaire->id}/compter", [
            'lignes' => [
                ['inventaire_ligne_id' => $ligne->id, 'quantite_physique' => 10],
            ],
        ]);

        $this->postJson("/api/inventaires/{$inventaire->id}/valider")->assertOk();

        $produit->refresh();
        $this->assertEquals(10, $produit->quantite_stock);

        $this->assertDatabaseHas('mouvements_stock', [
            'produit_id' => $produit->id,
            'raison' => 'ajustement',
            'type' => 'sortie',
        ]);
    }

    public function test_annuler_inventaire(): void
    {
        Sanctum::actingAs($this->gerant);
        $this->postJson('/api/inventaires');
        $inventaire = Inventaire::first();

        $this->postJson("/api/inventaires/{$inventaire->id}/annuler")
            ->assertOk()
            ->assertJsonPath('data.statut', 'annule');
    }

    public function test_ecarts_endpoint(): void
    {
        Sanctum::actingAs($this->gerant);
        $produit = $this->seedProduit();
        $this->postJson('/api/inventaires');
        $inventaire = Inventaire::first();
        $ligne = $inventaire->lignes->first();

        $this->postJson("/api/inventaires/{$inventaire->id}/compter", [
            'lignes' => [
                ['inventaire_ligne_id' => $ligne->id, 'quantite_physique' => 20],
            ],
        ]);

        $response = $this->getJson("/api/inventaires/{$inventaire->id}/ecarts");

        $response->assertOk()
            ->assertJsonPath('ecarts_positifs', 1)
            ->assertJsonPath('ecarts_negatifs', 0);
    }

    public function test_compter_requiert_inventaire_en_cours(): void
    {
        Sanctum::actingAs($this->gerant);
        $produit = $this->seedProduit();
        $this->postJson('/api/inventaires');
        $inventaire = Inventaire::first();
        $ligne = $inventaire->lignes->first();

        $this->postJson("/api/inventaires/{$inventaire->id}/compter", [
            'lignes' => [['inventaire_ligne_id' => $ligne->id, 'quantite_physique' => 10]],
        ]);

        $this->postJson("/api/inventaires/{$inventaire->id}/compter", [
            'lignes' => [['inventaire_ligne_id' => $ligne->id, 'quantite_physique' => 15]],
        ])->assertStatus(422);
    }
}
