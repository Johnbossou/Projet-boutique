<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\Categorie;
use App\Models\Produit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Workflow #2 — Multi-boutique & rôles : isolation inter-tenants.
 *
 * Régressions couvertes :
 *  - un membre retiré de l'équipe conservait l'accès COMPLET aux données
 *    de la boutique (current_boutique_id n'était ni réinitialisé ni
 *    revalidé, et les tokens n'étaient pas révoqués) ;
 *  - sans boutique courante, les contrôleurs à filtre conditionnel
 *    ne filtraient rien et renvoyaient les données de TOUTES les boutiques ;
 *  - /api/users/export exportait les utilisateurs de toutes les boutiques ;
 *  - un propriétaire au rôle global dégradé perdait la vue sur ses
 *    propres boutiques (les listes s'appuyaient sur le rôle global).
 */
class MultiBoutiqueSecuriteTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Ce test contrôle lui-même les rattachements : on désactive la
     * provisionnement automatique de boutiques de test.
     */
    protected function setUp(): void
    {
        parent::setUp();

        $this->sansProvisionnerBoutique();
    }

    private function proprio(string $email = 'proprio@sgci.bj'): User
    {
        return User::create([
            'name' => 'Propriétaire',
            'email' => $email,
            'password' => Hash::make('password'),
            'role' => 'proprietaire',
            'est_actif' => true,
        ]);
    }

    private function boutiqueDe(User $p, string $nom): Boutique
    {
        return Boutique::create([
            'nom' => $nom,
            'devise' => 'XOF',
            'proprietaire_id' => $p->id,
        ]);
    }

    private function produitDans(Boutique $b, string $nom): Produit
    {
        $cat = Categorie::create(['nom' => 'Cat '.$b->id, 'boutique_id' => $b->id]);

        return Produit::create([
            'nom' => $nom,
            'reference' => 'REF-'.$b->id,
            'prix' => 1000,
            'cout' => 500,
            'quantite' => 10,
            'seuil_alerte' => 2,
            'boutique_id' => $b->id,
            'categorie_id' => $cat->id,
        ]);
    }

    // ------------------------------------------------- révocation d'accès

    public function test_membre_retire_perd_l_acces_aux_donnees_de_la_boutique(): void
    {
        $p = $this->proprio();
        $b = $this->boutiqueDe($p, 'Boutique A');
        $this->produitDans($b, 'Produit secret A');

        $membre = User::create([
            'name' => 'Membre', 'email' => 'membre@sgci.bj',
            'password' => Hash::make('password'), 'role' => 'caissier', 'est_actif' => true,
        ]);
        $membre->forceFill(['current_boutique_id' => $b->id])->save();
        $b->users()->attach($membre->id, ['role_dans_boutique' => 'caissier']);

        // Avant retrait : accès normal
        Sanctum::actingAs($membre->fresh());
        $this->getJson('/api/produits')->assertOk();

        // Le propriétaire retire le membre
        Sanctum::actingAs($p);
        $this->deleteJson("/api/boutiques/{$b->id}/users/{$membre->id}")->assertOk();

        // Le membre ne doit plus rien voir
        Sanctum::actingAs($membre->fresh());
        $this->getJson('/api/produits')->assertStatus(403);
        $this->getJson('/api/boutique/settings')->assertStatus(403);
    }

    public function test_membre_retire_a_son_boutique_courante_reinitialisee(): void
    {
        $p = $this->proprio();
        $b = $this->boutiqueDe($p, 'Boutique A');

        $membre = User::create([
            'name' => 'Membre', 'email' => 'membre@sgci.bj',
            'password' => Hash::make('password'), 'role' => 'caissier', 'est_actif' => true,
        ]);
        $membre->forceFill(['current_boutique_id' => $b->id])->save();
        $b->users()->attach($membre->id, ['role_dans_boutique' => 'caissier']);

        Sanctum::actingAs($p);
        $this->deleteJson("/api/boutiques/{$b->id}/users/{$membre->id}")->assertOk();

        $this->assertNull($membre->fresh()->current_boutique_id);
    }

    public function test_membre_retire_avec_une_autre_boutique_y_bascule_automatiquement(): void
    {
        $p = $this->proprio();
        $b1 = $this->boutiqueDe($p, 'Boutique A');
        $b2 = $this->boutiqueDe($p, 'Boutique B');

        $membre = User::create([
            'name' => 'Membre', 'email' => 'membre@sgci.bj',
            'password' => Hash::make('password'), 'role' => 'caissier', 'est_actif' => true,
        ]);
        $membre->forceFill(['current_boutique_id' => $b1->id])->save();
        $b1->users()->attach($membre->id, ['role_dans_boutique' => 'caissier']);
        $b2->users()->attach($membre->id, ['role_dans_boutique' => 'gerant']);

        Sanctum::actingAs($p);
        $this->deleteJson("/api/boutiques/{$b1->id}/users/{$membre->id}")->assertOk();

        $this->assertSame($b2->id, $membre->fresh()->current_boutique_id,
            'Le membre doit être replié sur une boutique encore accessible.');
    }

    public function test_les_sessions_sont_revoquees_quand_plus_aucun_acces_ne_reste(): void
    {
        $p = $this->proprio();
        $b = $this->boutiqueDe($p, 'Boutique A');

        $membre = User::create([
            'name' => 'Membre', 'email' => 'membre@sgci.bj',
            'password' => Hash::make('password'), 'role' => 'caissier', 'est_actif' => true,
        ]);
        $membre->forceFill(['current_boutique_id' => $b->id])->save();
        $b->users()->attach($membre->id, ['role_dans_boutique' => 'caissier']);
        $membre->createToken('device-A');

        $this->assertSame(1, $membre->tokens()->count());

        Sanctum::actingAs($p);
        $this->deleteJson("/api/boutiques/{$b->id}/users/{$membre->id}")->assertOk();

        $this->assertSame(0, $membre->tokens()->count(),
            'Un utilisateur sans aucun accès doit voir ses sessions révoquées.');
    }

    public function test_retrait_membre_par_model_binding_revoke_les_sessions(): void
    {
        $p = $this->proprio();
        $b = $this->boutiqueDe($p, 'Boutique A');
        $this->produitDans($b, 'Produit A');

        $membre = User::create([
            'name' => 'Membre', 'email' => 'membre@sgci.bj',
            'password' => Hash::make('password'), 'role' => 'caissier', 'est_actif' => true,
        ]);
        $membre->forceFill(['current_boutique_id' => $b->id])->save();
        $b->users()->attach($membre->id, ['role_dans_boutique' => 'caissier']);

        Sanctum::actingAs($p);
        $this->deleteJson("/api/boutiques/{$b->id}/users/{$membre->id}")->assertOk();

        Sanctum::actingAs($membre->fresh());
        $this->getJson('/api/produits')->assertStatus(403);
    }

    public function test_remove_boutique_applique_la_meme_revocation(): void
    {
        $p = $this->proprio();
        $b = $this->boutiqueDe($p, 'Boutique A');
        $this->produitDans($b, 'Produit A');

        $membre = User::create([
            'name' => 'Membre', 'email' => 'membre@sgci.bj',
            'password' => Hash::make('password'), 'role' => 'caissier', 'est_actif' => true,
        ]);
        $membre->forceFill(['current_boutique_id' => $b->id])->save();
        $b->users()->attach($membre->id, ['role_dans_boutique' => 'caissier']);

        Sanctum::actingAs($p);
        $this->deleteJson("/api/users/{$membre->id}/boutiques/{$b->id}")->assertOk();

        $this->assertNull($membre->fresh()->current_boutique_id);

        Sanctum::actingAs($membre->fresh());
        $this->getJson('/api/produits')->assertStatus(403);
    }

    // ------------------------------------- utilisateur sans aucune boutique

    public function test_utilisateur_sans_boutique_est_refuse_sur_les_donnees(): void
    {
        $orphelin = User::create([
            'name' => 'Orphelin', 'email' => 'orphelin@sgci.bj',
            'password' => Hash::make('password'), 'role' => 'caissier', 'est_actif' => true,
        ]);

        Sanctum::actingAs($orphelin);

        $this->getJson('/api/produits')->assertStatus(403)
            ->assertJsonPath('code', 'aucune_boutique');
        $this->getJson('/api/ventes')->assertStatus(403);
        $this->getJson('/api/clients')->assertStatus(403);
    }

    public function test_utilisateur_sans_boutique_peut_tout_de_meme_consulter_son_profil(): void
    {
        $orphelin = User::create([
            'name' => 'Orphelin', 'email' => 'orphelin@sgci.bj',
            'password' => Hash::make('password'), 'role' => 'caissier', 'est_actif' => true,
        ]);

        Sanctum::actingAs($orphelin);

        $this->getJson('/api/me')->assertOk();
        $this->getJson('/api/mes-boutiques')->assertOk()->assertExactJson([]);
    }

    public function test_boutique_courante_obsolete_est_revalidee_automatiquement(): void
    {
        $p = $this->proprio();
        $b1 = $this->boutiqueDe($p, 'Boutique A');
        $b2 = $this->boutiqueDe($p, 'Boutique B');

        $membre = User::create([
            'name' => 'Membre', 'email' => 'membre@sgci.bj',
            'password' => Hash::make('password'), 'role' => 'caissier', 'est_actif' => true,
        ]);
        // Pointeur obsolète : boutique A, mais rattachement sur B uniquement
        $membre->forceFill(['current_boutique_id' => $b1->id])->save();
        $b2->users()->attach($membre->id, ['role_dans_boutique' => 'caissier']);

        Sanctum::actingAs($membre->fresh());
        $this->getJson('/api/produits')->assertOk();

        $this->assertSame($b2->id, $membre->fresh()->current_boutique_id,
            'Un pointeur invalide doit être replié sur une boutique accessible.');
    }

    // --------------------------------------------------- portée de l'export

    public function test_export_ne_fuit_pas_les_utilisateurs_d_autres_boutiques(): void
    {
        $pA = $this->proprio('pa@sgci.bj');
        $bA = $this->boutiqueDe($pA, 'Boutique A');

        $pB = $this->proprio('pb@sgci.bj');
        $bB = $this->boutiqueDe($pB, 'Boutique B');

        $membreA = User::create([
            'name' => 'Membre A', 'email' => 'membre-a@sgci.bj',
            'password' => Hash::make('password'), 'role' => 'gerant', 'est_actif' => true,
        ]);
        $bA->users()->attach($membreA->id, ['role_dans_boutique' => 'gerant']);
        $membreA->forceFill(['current_boutique_id' => $bA->id])->save();

        Sanctum::actingAs($membreA);
        $csv = $this->post('/api/users/export')->assertOk()->getContent();

        $this->assertStringContainsString('membre-a@sgci.bj', $csv, 'Son équipe doit être exportée.');
        $this->assertStringContainsString('pa@sgci.bj', $csv, 'Le propriétaire de sa boutique doit être exporté.');
        $this->assertStringNotContainsString('pb@sgci.bj', $csv, 'Fuite inter-boutiques !');
    }

    // ------------------------------------ propriétaire au rôle global dégradé

    public function test_proprietaire_ne_peut_pas_desactiver_un_utilisateur_d_autre_tenant(): void
    {
        $pA = $this->proprio('pa2@sgci.bj');
        $bA = $this->boutiqueDe($pA, 'Boutique A');

        $pB = $this->proprio('pb2@sgci.bj');
        $bB = $this->boutiqueDe($pB, 'Boutique B');

        $membreB = User::create([
            'name' => 'Membre B', 'email' => 'membre-b2@sgci.bj',
            'password' => Hash::make('password'), 'role' => 'caissier', 'est_actif' => true,
        ]);
        $bB->users()->attach($membreB->id, ['role_dans_boutique' => 'caissier']);
        $membreB->forceFill(['current_boutique_id' => $bB->id])->save();

        Sanctum::actingAs($pA);
        $this->deleteJson("/api/users/{$membreB->id}")->assertStatus(403);

        $this->assertTrue($membreB->fresh()->est_actif,
            'Un propriétaire ne doit pas pouvoir désactiver un compte d’un autre tenant.');

        // ... mais son propre équipe reste gérable
        $membreA = User::create([
            'name' => 'Membre A', 'email' => 'membre-a2@sgci.bj',
            'password' => Hash::make('password'), 'role' => 'caissier', 'est_actif' => true,
        ]);
        $bA->users()->attach($membreA->id, ['role_dans_boutique' => 'caissier']);
        $membreA->forceFill(['current_boutique_id' => $bA->id])->save();

        $this->deleteJson("/api/users/{$membreA->id}")->assertOk();
        $this->assertFalse($membreA->fresh()->est_actif);
    }

    public function test_proprietaire_au_role_global_degrade_garde_la_vue_sur_ses_boutiques(): void
    {
        $p = $this->proprio('degrade@sgci.bj');
        $b1 = $this->boutiqueDe($p, 'Boutique 1');
        $b2 = $this->boutiqueDe($p, 'Boutique 2');

        $p->forceFill(['role' => 'gerant', 'current_boutique_id' => null])->save();

        Sanctum::actingAs($p->fresh());

        $this->getJson('/api/boutiques')->assertOk()->assertJsonCount(2);
        $this->getJson('/api/mes-boutiques')->assertOk()->assertJsonCount(2);
        $this->getJson('/api/boutique/settings')->assertOk();
    }

    public function test_proprietaire_au_role_global_degrade_peut_toujours_gerer_ses_boutiques(): void
    {
        $p = $this->proprio('degrade2@sgci.bj');
        $b = $this->boutiqueDe($p, 'Boutique 1');

        $p->forceFill(['role' => 'gerant'])->save();

        Sanctum::actingAs($p->fresh());

        // Le middleware proprietaire doit reposer sur la possession, pas le rôle global
        $this->getJson('/api/boutiques')->assertOk();
        $this->putJson("/api/boutiques/{$b->id}", ['nom' => 'Renommée'])->assertOk();
    }

    // ------------------------------------------------- absence d'escalade

    public function test_caissier_ne_decouvre_aucune_autre_boutique(): void
    {
        $p = $this->proprio();
        $b1 = $this->boutiqueDe($p, 'Boutique A');
        $b2 = $this->boutiqueDe($p, 'Boutique B');
        $this->produitDans($b1, 'Produit A');
        $this->produitDans($b2, 'Produit B');

        $caissier = User::create([
            'name' => 'Caissier', 'email' => 'caisse@sgci.bj',
            'password' => Hash::make('password'), 'role' => 'caissier', 'est_actif' => true,
        ]);
        $caissier->forceFill(['current_boutique_id' => $b1->id])->save();
        $b1->users()->attach($caissier->id, ['role_dans_boutique' => 'caissier']);

        Sanctum::actingAs($caissier);

        $this->getJson('/api/produits')->assertOk()
            ->assertJsonPath('total', 1);

        $this->postJson('/api/switch-boutique', ['boutique_id' => $b2->id])->assertStatus(403);
        $this->getJson('/api/boutiques/'.$b2->id)->assertStatus(403);
    }

    public function test_caissier_ne_peut_pas_gerer_les_parametres_de_la_boutique(): void
    {
        $p = $this->proprio();
        $b = $this->boutiqueDe($p, 'Boutique A');

        $caissier = User::create([
            'name' => 'Caissier', 'email' => 'caisse@sgci.bj',
            'password' => Hash::make('password'), 'role' => 'caissier', 'est_actif' => true,
        ]);
        $caissier->forceFill(['current_boutique_id' => $b->id])->save();
        $b->users()->attach($caissier->id, ['role_dans_boutique' => 'caissier']);

        Sanctum::actingAs($caissier);

        $this->getJson('/api/boutique/settings')->assertOk();
        $this->putJson('/api/boutique/settings', ['nom' => 'Pirate'])->assertStatus(403);
    }
}
