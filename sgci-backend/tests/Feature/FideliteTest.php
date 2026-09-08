<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\Client;
use App\Models\ClientFidelite;
use App\Models\ProgrammeFidelite;
use App\Models\RecompenseFidelite;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FideliteTest extends TestCase
{
    use RefreshDatabase;

    private Boutique $boutique;
    private User $gerant;
    private Client $client;

    protected function setUp(): void
    {
        parent::setUp();

        $this->gerant = User::create([
            'name' => 'Gérant Fidélité',
            'email' => 'gerant-fidelite@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);

        $this->boutique = Boutique::create([
            'nom' => 'Boutique Fidélité',
            'adresse' => 'Cotonou',
            'proprietaire_id' => $this->gerant->id,
        ]);

        $this->gerant->boutiques()->attach($this->boutique->id);
        $this->gerant->update(['current_boutique_id' => $this->boutique->id]);

        $this->client = Client::create([
            'nom' => 'Client Fidélité',
            'email' => 'client-fidelite@sgci.bj',
            'telephone' => '22997000001',
            'boutique_id' => $this->boutique->id,
        ]);
    }

    private function payloadProgramme(): array
    {
        return [
            'nom' => 'Programme Fidélité',
            'description' => 'Test',
            'points_par_achat' => 10,
            'valeur_point' => 5,
            'niveaux' => [
                ['nom' => 'Bronze', 'points_min' => 0, 'remise_pourcentage' => 0],
                ['nom' => 'Silver', 'points_min' => 100, 'remise_pourcentage' => 5],
            ],
        ];
    }

    public function test_store_creer_un_programme(): void
    {
        Sanctum::actingAs($this->gerant);

        $this->postJson('/api/fidelite', $this->payloadProgramme())
            ->assertCreated()
            ->assertJsonPath('data.nom', 'Programme Fidélité');

        $this->assertDatabaseHas('programme_fidelites', [
            'nom' => 'Programme Fidélité',
            'boutique_id' => $this->boutique->id,
        ]);
    }

    public function test_store_validation_erreurs(): void
    {
        Sanctum::actingAs($this->gerant);

        $this->postJson('/api/fidelite', [])
            ->assertStatus(422);
    }

    public function test_index_liste_les_programmes_de_la_boutique_courante(): void
    {
        Sanctum::actingAs($this->gerant);

        $programme = ProgrammeFidelite::create([
            'boutique_id' => $this->boutique->id,
            'nom' => 'Programme A',
            'points_par_achat' => 5,
            'valeur_point' => 1,
            'niveaux' => [['nom' => 'Bronze', 'points_min' => 0, 'remise_pourcentage' => 0]],
            'actif' => true,
        ]);

        $otherBoutique = Boutique::create([
            'nom' => 'Autre Boutique',
            'adresse' => 'Abomey',
            'proprietaire_id' => $this->gerant->id,
        ]);

        ProgrammeFidelite::create([
            'boutique_id' => $otherBoutique->id,
            'nom' => 'Programme B',
            'points_par_achat' => 5,
            'valeur_point' => 1,
            'niveaux' => [['nom' => 'Bronze', 'points_min' => 0, 'remise_pourcentage' => 0]],
            'actif' => true,
        ]);

        $this->getJson('/api/fidelite')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $programme->id);
    }

    public function test_inscrire_client_au_programme(): void
    {
        Sanctum::actingAs($this->gerant);

        $programme = ProgrammeFidelite::create([
            'boutique_id' => $this->boutique->id,
            'nom' => 'Programme Fidélité',
            'points_par_achat' => 10,
            'valeur_point' => 5,
            'niveaux' => [['nom' => 'Bronze', 'points_min' => 0, 'remise_pourcentage' => 0]],
            'actif' => true,
        ]);

        $this->postJson('/api/fidelite/inscrire-client', [
            'programme_fidelite_id' => $programme->id,
            'client_id' => $this->client->id,
        ])
            ->assertCreated()
            ->assertJsonPath('data.points', 0);

        $this->assertDatabaseHas('client_fidelites', [
            'programme_fidelite_id' => $programme->id,
            'client_id' => $this->client->id,
            'points' => 0,
        ]);
    }

    public function test_points_client(): void
    {
        Sanctum::actingAs($this->gerant);

        $programme = ProgrammeFidelite::create([
            'boutique_id' => $this->boutique->id,
            'nom' => 'Programme Fidélité',
            'points_par_achat' => 10,
            'valeur_point' => 5,
            'niveaux' => [['nom' => 'Bronze', 'points_min' => 0, 'remise_pourcentage' => 0]],
            'actif' => true,
        ]);

        ClientFidelite::create([
            'programme_fidelite_id' => $programme->id,
            'client_id' => $this->client->id,
            'points' => 0,
            'niveau_actuel' => 'Débutant',
            'date_inscription' => now(),
        ]);

        $this->getJson('/api/fidelite/points-client?client_id=' . $this->client->id)
            ->assertOk()
            ->assertJsonPath('client_id', $this->client->id)
            ->assertJsonPath('points', 0);
    }

    public function test_store_recompense(): void
    {
        Sanctum::actingAs($this->gerant);

        $programme = ProgrammeFidelite::create([
            'boutique_id' => $this->boutique->id,
            'nom' => 'Programme Fidélité',
            'points_par_achat' => 10,
            'valeur_point' => 5,
            'niveaux' => [['nom' => 'Bronze', 'points_min' => 0, 'remise_pourcentage' => 0]],
            'actif' => true,
        ]);

        $this->postJson('/api/fidelite/recompenses', [
            'programme_fidelite_id' => $programme->id,
            'nom' => 'Réduction 10%',
            'description' => 'Test',
            'points_requis' => 50,
            'type' => 'remise',
            'valeur' => 10,
        ])
            ->assertCreated()
            ->assertJsonPath('data.nom', 'Réduction 10%');

        $this->assertDatabaseHas('recompense_fidelites', [
            'programme_fidelite_id' => $programme->id,
            'nom' => 'Réduction 10%',
            'points_requis' => 50,
        ]);
    }

    public function test_reclamer_recompense_avec_points_suffisants(): void
    {
        Sanctum::actingAs($this->gerant);

        $programme = ProgrammeFidelite::create([
            'boutique_id' => $this->boutique->id,
            'nom' => 'Programme Fidélité',
            'points_par_achat' => 10,
            'valeur_point' => 5,
            'niveaux' => [['nom' => 'Bronze', 'points_min' => 0, 'remise_pourcentage' => 0]],
            'actif' => true,
        ]);

        $recompense = RecompenseFidelite::create([
            'programme_fidelite_id' => $programme->id,
            'nom' => 'Réduction 10%',
            'points_requis' => 10,
            'type' => 'remise',
            'valeur' => 10,
            'actif' => true,
        ]);

        $clientFidelite = ClientFidelite::create([
            'programme_fidelite_id' => $programme->id,
            'client_id' => $this->client->id,
            'points' => 100,
            'niveau_actuel' => 'Débutant',
            'date_inscription' => now(),
        ]);

        $this->postJson('/api/fidelite/reclamer-recompense', [
            'recompense_fidelite_id' => $recompense->id,
            'client_id' => $this->client->id,
        ])
            ->assertOk()
            ->assertJsonPath('data.statut', 'valide');

        $this->assertDatabaseHas('reclamation_recompenses', [
            'recompense_fidelite_id' => $recompense->id,
            'client_fidelite_id' => $clientFidelite->id,
            'statut' => 'valide',
            'utilise' => false,
        ]);

        $this->assertDatabaseHas('client_fidelites', [
            'id' => $clientFidelite->id,
            'points' => 90,
        ]);
    }

    public function test_programme_dune_autre_boutique_est_invisible(): void
    {
        Sanctum::actingAs($this->gerant);

        $otherBoutique = Boutique::create([
            'nom' => 'Autre Boutique',
            'adresse' => 'Abomey',
            'proprietaire_id' => $this->gerant->id,
        ]);

        $programme = ProgrammeFidelite::create([
            'boutique_id' => $otherBoutique->id,
            'nom' => 'Programme Autre',
            'points_par_achat' => 5,
            'valeur_point' => 1,
            'niveaux' => [['nom' => 'Bronze', 'points_min' => 0, 'remise_pourcentage' => 0]],
            'actif' => true,
        ]);

        $this->getJson("/api/fidelite/{$programme->id}")->assertStatus(403);

        $this->putJson("/api/fidelite/{$programme->id}", $this->payloadProgramme())
            ->assertStatus(403);

        $this->deleteJson("/api/fidelite/{$programme->id}")->assertStatus(403);
    }

    public function test_caissier_ne_peut_pas_gerer_les_programmes(): void
    {
        $caissier = User::create([
            'name' => 'Caissier Fidélité',
            'email' => 'caissier-fidelite@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'caissier',
            'est_actif' => true,
        ]);

        $caissier->boutiques()->attach($this->boutique->id, ['role_dans_boutique' => 'caissier']);
        $caissier->update(['current_boutique_id' => $this->boutique->id]);

        Sanctum::actingAs($caissier);

        $this->postJson('/api/fidelite', $this->payloadProgramme())
            ->assertStatus(403);
    }
}