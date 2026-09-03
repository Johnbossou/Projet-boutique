<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PrivilegeTest extends TestCase
{
    use RefreshDatabase;

    private User $proprietaire;
    private User $gerant;
    private Boutique $boutique;

    protected function setUp(): void
    {
        parent::setUp();

        $this->proprietaire = User::create([
            'name' => 'Propriétaire',
            'email' => 'proprio@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'proprietaire',
            'est_actif' => true,
        ]);

        $this->boutique = Boutique::create([
            'nom' => 'Boutique Test',
            'devise' => 'XOF',
            'proprietaire_id' => $this->proprietaire->id,
        ]);
        $this->proprietaire->forceFill(['current_boutique_id' => $this->boutique->id])->save();

        $this->gerant = User::create([
            'name' => 'Gérant',
            'email' => 'gerant@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);
        $this->gerant->forceFill(['current_boutique_id' => $this->boutique->id])->save();
        // Rattachement pivot requis pour que le gérant soit reconnu membre de la boutique
        $this->boutique->rattacherUser($this->gerant->id, 'gerant');
    }

    public function test_gerant_ne_peut_pas_creer_un_proprietaire(): void
    {
        Sanctum::actingAs($this->gerant);

        $this->postJson('/api/users', [
            'name' => 'Faux Proprio',
            'email' => 'faux-proprio@sgci.bj',
            'password' => 'motdepasse-solide',
            'role' => 'proprietaire',
        ])->assertStatus(403);

        $this->assertDatabaseMissing('users', ['email' => 'faux-proprio@sgci.bj']);
    }

    public function test_proprietaire_peut_creer_un_proprietaire(): void
    {
        Sanctum::actingAs($this->proprietaire);

        $this->postJson('/api/users', [
            'name' => 'Co-Proprio',
            'email' => 'co-proprio@sgci.bj',
            'password' => 'motdepasse-solide',
            'role' => 'proprietaire',
        ])->assertCreated();
    }

    public function test_gerant_ne_peut_pas_promouvoir_vers_proprietaire(): void
    {
        Sanctum::actingAs($this->gerant);

        $caissier = User::create([
            'name' => 'Caissier',
            'email' => 'caissier-upgrade@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'caissier',
            'est_actif' => true,
        ]);

        $this->putJson("/api/users/{$caissier->id}", ['role' => 'proprietaire'])
            ->assertStatus(403);

        $this->assertSame('caissier', $caissier->fresh()->role);
    }

    public function test_personne_ne_modifie_son_propre_role(): void
    {
        Sanctum::actingAs($this->gerant);

        // Auto-promotion vers proprietaire : bloquée par l'anti-escalade (403)
        $this->putJson("/api/users/{$this->gerant->id}", ['role' => 'proprietaire'])
            ->assertStatus(403);

        // Auto-rétrogradation vers caissier : bloquée par la protection self-role (422)
        $this->putJson("/api/users/{$this->gerant->id}", ['role' => 'caissier'])
            ->assertStatus(422);

        $this->assertSame('gerant', $this->gerant->fresh()->role);
    }

    public function test_mots_de_passe_min_8_caracteres(): void
    {
        Sanctum::actingAs($this->gerant);

        $this->postJson('/api/users', [
            'name' => 'Court',
            'email' => 'court@sgci.bj',
            'password' => '7charss',
            'role' => 'caissier',
        ])->assertStatus(422)
          ->assertJsonValidationErrors(['password']);
    }

    public function test_proprietaire_passe_le_middleware_gerant(): void
    {
        // P2.6 : le propriétaire a les droits du gérant
        Sanctum::actingAs($this->proprietaire);

        $this->getJson('/api/users')->assertOk();
    }

    public function test_caissier_est_bloque_par_le_middleware_gerant(): void
    {
        $caissier = User::create([
            'name' => 'Caissier Bloque',
            'email' => 'caissier-bloque@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'caissier',
            'est_actif' => true,
        ]);
        $caissier->forceFill(['current_boutique_id' => $this->boutique->id])->save();

        Sanctum::actingAs($caissier);

        $this->getJson('/api/users')->assertStatus(403);
    }
}
