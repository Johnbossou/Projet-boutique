<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\Fournisseur;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FournisseurTest extends TestCase
{
    use RefreshDatabase;

    private Boutique $boutique;
    private User $gerant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->gerant = User::create([
            'name' => 'Gérant Fournisseur',
            'email' => 'gerant-fournisseur@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);

        $this->boutique = Boutique::create([
            'nom' => 'Boutique Fournisseur',
            'adresse' => 'Dassa',
            'proprietaire_id' => $this->gerant->id,
        ]);

        $this->gerant->boutiques()->attach($this->boutique->id);
        $this->gerant->update(['current_boutique_id' => $this->boutique->id]);
    }

    public function test_index_liste_les_fournisseurs_de_la_boutique_courante(): void
    {
        Sanctum::actingAs($this->gerant);

        Fournisseur::create(['nom' => 'Fournisseur A', 'boutique_id' => $this->boutique->id]);
        Fournisseur::create(['nom' => 'Fournisseur B', 'boutique_id' => $this->boutique->id]);

        $autreBoutique = Boutique::create([
            'nom' => 'Autre Boutique',
            'adresse' => 'Abomey',
            'proprietaire_id' => $this->gerant->id,
        ]);

        Fournisseur::create(['nom' => 'Fournisseur C', 'boutique_id' => $autreBoutique->id]);

        $this->getJson('/api/fournisseurs')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('total', 2);
    }

    public function test_store_creer_un_fournisseur(): void
    {
        Sanctum::actingAs($this->gerant);

        $this->postJson('/api/fournisseurs', [
            'nom' => 'Fournisseur Test',
            'email' => 'fournisseur@sgci.bj',
            'telephone' => '22997000000',
            'adresse' => 'Cotonou',
            'ville' => 'Cotonou',
            'pays' => 'Bénin',
            'contact_principal' => 'Jean',
            'email_contact' => 'contact@sgci.bj',
            'telephone_contact' => '22997000001',
            'conditions_paiement' => '30 jours',
            'delai_livraison' => 7,
            'notes' => 'Fournisseur principal',
            'actif' => true,
        ])
            ->assertCreated()
            ->assertJsonPath('data.boutique_id', $this->boutique->id);

        $this->assertDatabaseHas('fournisseurs', [
            'nom' => 'Fournisseur Test',
            'email' => 'fournisseur@sgci.bj',
            'boutique_id' => $this->boutique->id,
        ]);
    }

    public function test_store_validation_erreurs(): void
    {
        Sanctum::actingAs($this->gerant);

        $this->postJson('/api/fournisseurs', [
            'email' => 'invalid-email',
        ])->assertStatus(422);
    }

    public function test_show_fournisseur(): void
    {
        Sanctum::actingAs($this->gerant);

        $fournisseur = Fournisseur::create([
            'nom' => 'Fournisseur Show',
            'email' => 'show@sgci.bj',
            'boutique_id' => $this->boutique->id,
        ]);

        $this->getJson("/api/fournisseurs/{$fournisseur->id}")
            ->assertOk()
            ->assertJsonPath('id', $fournisseur->id)
            ->assertJsonPath('nom', 'Fournisseur Show');
    }

    public function test_update_fournisseur(): void
    {
        Sanctum::actingAs($this->gerant);

        $fournisseur = Fournisseur::create([
            'nom' => 'Fournisseur Update',
            'boutique_id' => $this->boutique->id,
        ]);

        $this->putJson("/api/fournisseurs/{$fournisseur->id}", [
            'nom' => 'Fournisseur Renommé',
            'email' => 'update@sgci.bj',
        ])
            ->assertOk()
            ->assertJsonPath('data.nom', 'Fournisseur Renommé');

        $this->assertDatabaseHas('fournisseurs', [
            'id' => $fournisseur->id,
            'nom' => 'Fournisseur Renommé',
            'email' => 'update@sgci.bj',
        ]);
    }

    public function test_destroy_fournisseur(): void
    {
        Sanctum::actingAs($this->gerant);

        $fournisseur = Fournisseur::create([
            'nom' => 'Fournisseur Delete',
            'boutique_id' => $this->boutique->id,
        ]);

        $this->deleteJson("/api/fournisseurs/{$fournisseur->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Fournisseur supprimé avec succès');

        $this->assertSoftDeleted('fournisseurs', ['id' => $fournisseur->id]);
    }

    public function test_fournisseur_dune_autre_boutique_est_invisible(): void
    {
        Sanctum::actingAs($this->gerant);

        $autreBoutique = Boutique::create([
            'nom' => 'Boutique B',
            'adresse' => 'Parakou',
            'proprietaire_id' => $this->gerant->id,
        ]);

        $fournisseur = Fournisseur::create([
            'nom' => 'Fournisseur Autre Boutique',
            'boutique_id' => $autreBoutique->id,
        ]);

        $this->getJson("/api/fournisseurs/{$fournisseur->id}")->assertStatus(403);
        $this->putJson("/api/fournisseurs/{$fournisseur->id}", ['nom' => 'Modifié'])->assertStatus(403);
        $this->deleteJson("/api/fournisseurs/{$fournisseur->id}")->assertStatus(403);
    }

    public function test_caissier_ne_peut_pas_creer_de_fournisseur(): void
    {
        $caissier = User::create([
            'name' => 'Caissier Fournisseur',
            'email' => 'caissier-fournisseur@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'caissier',
            'est_actif' => true,
        ]);

        $caissier->boutiques()->attach($this->boutique->id, ['role_dans_boutique' => 'caissier']);
        $caissier->update(['current_boutique_id' => $this->boutique->id]);

        Sanctum::actingAs($caissier);

        $this->postJson('/api/fournisseurs', [
            'nom' => 'Fournisseur Interdit',
        ])->assertStatus(403);
    }
}