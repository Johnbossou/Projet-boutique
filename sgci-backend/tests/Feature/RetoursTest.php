<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\Categorie;
use App\Models\Client;
use App\Models\Produit;
use App\Models\RetourVente;
use App\Models\RetourVenteLigne;
use App\Models\User;
use App\Models\Vente;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RetoursTest extends TestCase
{
    use RefreshDatabase;

    private Boutique $boutique;
    private User $gerant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->gerant = User::create([
            'name' => 'Gérant Retours',
            'email' => 'gerant-retours@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);

        $this->boutique = Boutique::create([
            'nom' => 'Boutique Retours',
            'adresse' => 'Cotonou',
            'proprietaire_id' => $this->gerant->id,
        ]);

        $this->gerant->boutiques()->attach($this->boutique->id);
        $this->gerant->update(['current_boutique_id' => $this->boutique->id]);
    }

    private function seedVenteTerminee(): Vente
    {
        $categorie = Categorie::create(['nom' => 'Cat R', 'description' => 'D', 'couleur' => '#000', 'icone' => 'box']);
        $produit = Produit::create([
            'nom' => 'Produit R',
            'description' => 'Test',
            'prix' => 5000,
            'quantite_stock' => 20,
            'seuil_alerte' => 2,
            'categorie_id' => $categorie->id,
            'unite_mesure' => 'unite',
            'boutique_id' => $this->boutique->id,
        ]);

        $vente = Vente::create([
            'montant_total' => 10000,
            'remise' => 0,
            'statut' => 'termine',
            'mode_paiement' => 'especes',
            'boutique_id' => $this->boutique->id,
            'user_id' => $this->gerant->id,
        ]);

        $vente->ligneVentes()->create([
            'produit_id' => $produit->id,
            'quantite' => 2,
            'prix_unitaire' => 5000,
            'sous_total' => 10000,
        ]);

        return $vente;
    }

    public function test_index_retours(): void
    {
        Sanctum::actingAs($this->gerant);
        $this->getJson('/api/retours')->assertOk();
    }

    public function test_store_retour_partiel(): void
    {
        Sanctum::actingAs($this->gerant);
        $vente = $this->seedVenteTerminee();
        $ligne = $vente->ligneVentes->first();

        $response = $this->postJson('/api/retours', [
            'vente_id' => $vente->id,
            'type' => 'partiel',
            'motif' => 'defectueux',
            'lignes' => [
                ['ligne_vente_id' => $ligne->id, 'quantite_retournee' => 1],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.statut', 'en_attente');

        $this->assertDatabaseHas('retours_vente', [
            'vente_id' => $vente->id,
            'statut' => 'en_attente',
        ]);
    }

    public function test_store_retour_total(): void
    {
        Sanctum::actingAs($this->gerant);
        $vente = $this->seedVenteTerminee();

        $response = $this->postJson('/api/retours', [
            'vente_id' => $vente->id,
            'type' => 'total',
            'motif' => 'insatisfait',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.statut', 'en_attente')
            ->assertJsonPath('data.montant_rembourse', '10000.00');
    }

    public function test_valider_retour_remplit_stock(): void
    {
        Sanctum::actingAs($this->gerant);
        $vente = $this->seedVenteTerminee();
        $produit = Produit::where('boutique_id', $this->boutique->id)->first();
        $ligne = $vente->ligneVentes->first();

        $this->postJson('/api/retours', [
            'vente_id' => $vente->id,
            'type' => 'partiel',
            'motif' => 'defectueux',
            'lignes' => [['ligne_vente_id' => $ligne->id, 'quantite_retournee' => 1]],
        ]);

        $retour = RetourVente::first();

        $this->postJson("/api/retours/{$retour->id}/valider")->assertOk();

        $produit->refresh();
        $this->assertEquals(21, $produit->quantite_stock);

        $this->assertDatabaseHas('mouvements_stock', [
            'produit_id' => $produit->id,
            'raison' => 'retour',
            'type' => 'entree',
        ]);
    }

    public function test_refuser_retour(): void
    {
        Sanctum::actingAs($this->gerant);
        $vente = $this->seedVenteTerminee();
        $ligne = $vente->ligneVentes->first();

        $this->postJson('/api/retours', [
            'vente_id' => $vente->id,
            'type' => 'partiel',
            'motif' => 'autre',
            'lignes' => [['ligne_vente_id' => $ligne->id, 'quantite_retournee' => 1]],
        ]);

        $retour = RetourVente::first();

        $this->postJson("/api/retours/{$retour->id}/refuser")
            ->assertOk()
            ->assertJsonPath('data.statut', 'refuse');
    }

    public function test_ne_peut_pas_refaire_un_retour_deja_valide(): void
    {
        Sanctum::actingAs($this->gerant);
        $vente = $this->seedVenteTerminee();
        $ligne = $vente->ligneVentes->first();

        $this->postJson('/api/retours', [
            'vente_id' => $vente->id,
            'type' => 'partiel',
            'motif' => 'defectueux',
            'lignes' => [['ligne_vente_id' => $ligne->id, 'quantite_retournee' => 1]],
        ]);

        $retour = RetourVente::first();
        $this->postJson("/api/retours/{$retour->id}/valider");

        $this->postJson("/api/retours/{$retour->id}/valider")->assertStatus(422);
        $this->postJson("/api/retours/{$retour->id}/refuser")->assertStatus(422);
    }

    public function test_retour_requiert_vente_terminee(): void
    {
        Sanctum::actingAs($this->gerant);
        $vente = Vente::create([
            'montant_total' => 5000,
            'remise' => 0,
            'statut' => 'en_cours',
            'boutique_id' => $this->boutique->id,
            'user_id' => $this->gerant->id,
        ]);

        $this->postJson('/api/retours', [
            'vente_id' => $vente->id,
            'type' => 'total',
            'motif' => 'autre',
        ])->assertStatus(422);
    }
}
