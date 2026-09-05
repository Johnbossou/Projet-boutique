<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\Categorie;
use App\Models\Client;
use App\Models\Produit;
use App\Models\User;
use App\Models\Vente;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MultiTenantTest extends TestCase
{
    use RefreshDatabase;

    private User $gerantA;
    private Boutique $boutiqueA;
    private Boutique $boutiqueB;

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

        $this->boutiqueA = Boutique::create([
            'nom' => 'Boutique A',
            'devise' => 'XOF',
            'proprietaire_id' => $proprietaire->id,
        ]);

        $this->boutiqueB = Boutique::create([
            'nom' => 'Boutique B',
            'devise' => 'XOF',
            'proprietaire_id' => $proprietaire->id,
        ]);

        // Gérant attaché à la boutique A uniquement
        $this->gerantA = User::create([
            'name' => 'Gérant A',
            'email' => 'gerant-a@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);
        $this->gerantA->forceFill(['current_boutique_id' => $this->boutiqueA->id])->save();
        $this->boutiqueA->users()->attach($this->gerantA->id, ['role_dans_boutique' => 'gerant']);

        Sanctum::actingAs($this->gerantA);
    }

    private function createProduitDans(Boutique $boutique, string $suffixe = ''): Produit
    {
        $categorie = Categorie::create([
            'nom' => "Cat {$boutique->id} $suffixe",
            'boutique_id' => $boutique->id,
        ]);

        return Produit::create([
            'nom' => "Produit $suffixe",
            'prix' => 1500,
            'quantite_stock' => 10,
            'seuil_alerte' => 2,
            'categorie_id' => $categorie->id,
            'unite_mesure' => 'unite',
            'code_qr' => "QR-{$boutique->id}-$suffixe",
            'boutique_id' => $boutique->id,
        ]);
    }

    private function createVenteDans(Boutique $boutique): Vente
    {
        return Vente::create([
            'montant_total' => 3000,
            'user_id' => $this->gerantA->id,
            'statut' => 'en_cours',
            'boutique_id' => $boutique->id,
        ]);
    }

    private function createClientDans(Boutique $boutique, string $suffixe): Client
    {
        return Client::create([
            'nom' => "Client $suffixe",
            'email' => "client-$suffixe-{$boutique->id}@test.bj",
            'boutique_id' => $boutique->id,
        ]);
    }

    public function test_produit_dune_autre_boutique_est_invisible(): void
    {
        $produitB = $this->createProduitDans($this->boutiqueB, 'B');

        $this->getJson("/api/produits/{$produitB->id}")->assertNotFound();
        $this->putJson("/api/produits/{$produitB->id}", ['nom' => 'Piraté'])->assertNotFound();
        $this->deleteJson("/api/produits/{$produitB->id}")->assertNotFound();
    }

    public function test_index_ne_liste_que_les_produits_de_la_boutique_courante(): void
    {
        $this->createProduitDans($this->boutiqueA, 'A1');
        $this->createProduitDans($this->boutiqueB, 'B1');

        $ids = collect($this->getJson('/api/produits')->json('data'))
            ->pluck('id');

        $this->assertCount(1, $ids);
        $this->assertSame(
            Produit::where('boutique_id', $this->boutiqueA->id)->value('id'),
            $ids->first()
        );
    }

    public function test_find_by_code_ne_fuit_pas_les_autres_boutiques(): void
    {
        $produitB = $this->createProduitDans($this->boutiqueB, 'SEC');

        // Par code QR d'une autre boutique : introuvable
        $this->getJson("/api/produits/code/{$produitB->code_qr}")->assertNotFound();

        // Par ID d'une autre boutique : introuvable (le orWhere ne doit pas fuiter)
        $this->getJson("/api/produits/code/{$produitB->id}")->assertNotFound();
    }

    public function test_vente_dune_autre_boutique_est_invisible(): void
    {
        $venteB = $this->createVenteDans($this->boutiqueB);

        $this->getJson("/api/ventes/{$venteB->id}")->assertNotFound();
        $this->postJson("/api/ventes/{$venteB->id}/annuler")->assertNotFound();
        $this->deleteJson("/api/ventes/{$venteB->id}")->assertNotFound();
    }

    public function test_client_dune_autre_boutique_est_invisible(): void
    {
        $clientB = $this->createClientDans($this->boutiqueB, 'b');

        $this->getJson("/api/clients/{$clientB->id}")->assertNotFound();
        $this->putJson("/api/clients/{$clientB->id}", ['nom' => 'Piraté'])->assertNotFound();
        $this->deleteJson("/api/clients/{$clientB->id}")->assertNotFound();
        $this->postJson("/api/clients/{$clientB->id}/promouvoir-vip")->assertNotFound();
    }

    public function test_categorie_dune_autre_boutique_est_invisible(): void
    {
        $categorieB = Categorie::create([
            'nom' => 'Catégorie B',
            'boutique_id' => $this->boutiqueB->id,
        ]);

        $this->getJson("/api/categories/{$categorieB->id}")->assertNotFound();
        $this->putJson("/api/categories/{$categorieB->id}", ['nom' => 'Piraté'])->assertNotFound();
        $this->deleteJson("/api/categories/{$categorieB->id}")->assertNotFound();
        $this->getJson("/api/categories/{$categorieB->id}/produits")->assertNotFound();
    }

    public function test_switch_boutique_via_api_change_la_boutique_courante(): void
    {
        $proprietaire = User::where('email', 'proprio@sgci.bj')->firstOrFail();

        // Le propriétaire possède les deux boutiques => accès aux deux.
        Sanctum::actingAs($proprietaire);

        $this->postJson('/api/switch-boutique', ['boutique_id' => $this->boutiqueB->id])
            ->assertOk()
            ->assertJsonPath('current_boutique_id', $this->boutiqueB->id);

        $this->assertSame(
            $this->boutiqueB->id,
            $proprietaire->fresh()->current_boutique_id
        );

        // Retour vers la boutique A.
        $this->postJson('/api/switch-boutique', ['boutique_id' => $this->boutiqueA->id])
            ->assertOk()
            ->assertJsonPath('current_boutique_id', $this->boutiqueA->id);
    }

    public function test_switch_boutique_refuse_une_boutique_non_accessible(): void
    {
        Sanctum::actingAs($this->gerantA);

        // Le gérant A n'est rattaché qu'à la boutique A => boutique B interdite.
        $this->postJson('/api/switch-boutique', ['boutique_id' => $this->boutiqueB->id])
            ->assertStatus(403);

        $this->assertSame(
            $this->boutiqueA->id,
            $this->gerantA->fresh()->current_boutique_id
        );
    }

    public function test_switch_boutique_apres_bascule_les_donnees_sont_scopees(): void
    {
        $proprietaire = User::where('email', 'proprio@sgci.bj')->firstOrFail();
        Sanctum::actingAs($proprietaire);

        $this->createProduitDans($this->boutiqueA, 'SWA');
        $this->createProduitDans($this->boutiqueB, 'SWB');

        // Sur la boutique A, on ne voit que le produit A.
        $this->postJson('/api/switch-boutique', ['boutique_id' => $this->boutiqueA->id]);
        $idsA = collect($this->getJson('/api/produits')->json('data'))->pluck('id');
        $this->assertCount(1, $idsA);
        $this->assertSame(
            Produit::where('boutique_id', $this->boutiqueA->id)->value('id'),
            $idsA->first()
        );

        // Après bascule vers la boutique B, on ne voit que le produit B.
        $this->postJson('/api/switch-boutique', ['boutique_id' => $this->boutiqueB->id]);
        $idsB = collect($this->getJson('/api/produits')->json('data'))->pluck('id');
        $this->assertCount(1, $idsB);
        $this->assertSame(
            Produit::where('boutique_id', $this->boutiqueB->id)->value('id'),
            $idsB->first()
        );
    }

    public function test_switch_boutique_validation_boutique_inexistante(): void
    {
        Sanctum::actingAs($this->gerantA);

        $this->postJson('/api/switch-boutique', ['boutique_id' => 999999])
            ->assertStatus(422);

        $this->postJson('/api/switch-boutique', [])
            ->assertStatus(422);
    }
}
