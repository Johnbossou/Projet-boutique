<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * La migration 2026_06_02_000013 inscrivant le propriétaire en pivot « gerant »
 * contredit AuthController et BoutiqueSeeder, qui utilisent « proprietaire ».
 * Cette migration réaligne les données existantes.
 */
class MigrationAlignementProprietairesTest extends TestCase
{
    use RefreshDatabase;

    private function migration(): object
    {
        $fichier = database_path('migrations/2026_10_02_000002_align_proprietaires_pivot_boutique.php');

        $this->assertFileExists($fichier);

        return require $fichier;
    }

    public function test_le_proprietaire_passe_de_gerant_a_proprietaire(): void
    {
        $owner = $this->utilisateur('Owner');
        $boutique = Boutique::create(['nom' => 'B1', 'proprietaire_id' => $owner->id]);
        DB::table('boutique_user')->insert([
            'boutique_id' => $boutique->id,
            'user_id' => $owner->id,
            'role_dans_boutique' => 'gerant',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->migration()->up();

        $this->assertSame(
            'proprietaire',
            DB::table('boutique_user')->where('boutique_id', $boutique->id)->value('role_dans_boutique')
        );
    }

    public function test_un_simple_gerant_nest_pas_touche(): void
    {
        $owner = $this->utilisateur('Owner');
        $gerant = $this->utilisateur('Gerant');
        $boutique = Boutique::create(['nom' => 'B2', 'proprietaire_id' => $owner->id]);

        DB::table('boutique_user')->insert([
            ['boutique_id' => $boutique->id, 'user_id' => $owner->id, 'role_dans_boutique' => 'gerant', 'created_at' => now(), 'updated_at' => now()],
            ['boutique_id' => $boutique->id, 'user_id' => $gerant->id, 'role_dans_boutique' => 'gerant', 'created_at' => now(), 'updated_at' => now()],
        ]);

        $this->migration()->up();

        $this->assertSame(
            'gerant',
            DB::table('boutique_user')->where('boutique_id', $boutique->id)->where('user_id', $gerant->id)->value('role_dans_boutique'),
            'Le gérant réel ne doit pas être promu propriétaire.'
        );
    }

    public function test_un_proprietaire_qui_gere_une_autre_boutique_conserve_gerant_ailleurs(): void
    {
        $owner = $this->utilisateur('Owner');
        $saBoutique = Boutique::create(['nom' => 'B3a', 'proprietaire_id' => $owner->id]);
        $autreBoutique = Boutique::create(['nom' => 'B3b', 'proprietaire_id' => $this->utilisateur('Autre')->id]);

        DB::table('boutique_user')->insert([
            ['boutique_id' => $saBoutique->id, 'user_id' => $owner->id, 'role_dans_boutique' => 'gerant', 'created_at' => now(), 'updated_at' => now()],
            ['boutique_id' => $autreBoutique->id, 'user_id' => $owner->id, 'role_dans_boutique' => 'gerant', 'created_at' => now(), 'updated_at' => now()],
        ]);

        $this->migration()->up();

        $this->assertSame('proprietaire', DB::table('boutique_user')->where('boutique_id', $saBoutique->id)->value('role_dans_boutique'));
        $this->assertSame(
            'gerant',
            DB::table('boutique_user')->where('boutique_id', $autreBoutique->id)->value('role_dans_boutique'),
            'users.role ne doit pas servir de critère : le rôle dépend de la boutique.'
        );
    }

    public function test_un_caissier_proprietaire_techniquement_nest_pas_realigne(): void
    {
        // Périmètre volontairement limité : la migration corrige l'incohérence
        // « gerant » induite par 000013. Un rôle « caissier » sur une boutique
        // que l'utilisateur possède reste un cas distinct, non traité ici.
        $owner = $this->utilisateur('Owner');
        $boutique = Boutique::create(['nom' => 'B4', 'proprietaire_id' => $owner->id]);
        DB::table('boutique_user')->insert([
            'boutique_id' => $boutique->id,
            'user_id' => $owner->id,
            'role_dans_boutique' => 'caissier',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->migration()->up();

        $this->assertSame('caissier', DB::table('boutique_user')->where('boutique_id', $boutique->id)->value('role_dans_boutique'));
    }

    public function test_la_migration_est_idempotente(): void
    {
        $owner = $this->utilisateur('Owner');
        $boutique = Boutique::create(['nom' => 'B5', 'proprietaire_id' => $owner->id]);
        DB::table('boutique_user')->insert([
            'boutique_id' => $boutique->id,
            'user_id' => $owner->id,
            'role_dans_boutique' => 'gerant',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->migration()->up();
        $this->migration()->up();
        $this->migration()->up();

        $this->assertSame('proprietaire', DB::table('boutique_user')->where('boutique_id', $boutique->id)->value('role_dans_boutique'));
        $this->assertSame(1, DB::table('boutique_user')->where('boutique_id', $boutique->id)->count());
    }

    public function test_down_restaure_l_etat_de_la_migration_historique(): void
    {
        $owner = $this->utilisateur('Owner');
        $boutique = Boutique::create(['nom' => 'B6', 'proprietaire_id' => $owner->id]);
        DB::table('boutique_user')->insert([
            'boutique_id' => $boutique->id,
            'user_id' => $owner->id,
            'role_dans_boutique' => 'gerant',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $migration = $this->migration();
        $migration->up();
        $migration->down();

        $this->assertSame(
            'gerant',
            DB::table('boutique_user')->where('boutique_id', $boutique->id)->value('role_dans_boutique')
        );
    }

    public function test_apres_alignement_la_promotion_du_gérant_reste_possible(): void
    {
        $owner = $this->utilisateur('Owner');
        $gerant = $this->utilisateur('Gerant');
        $boutique = Boutique::create(['nom' => 'B7', 'proprietaire_id' => $owner->id]);

        DB::table('boutique_user')->insert([
            ['boutique_id' => $boutique->id, 'user_id' => $owner->id, 'role_dans_boutique' => 'gerant', 'created_at' => now(), 'updated_at' => now()],
            ['boutique_id' => $boutique->id, 'user_id' => $gerant->id, 'role_dans_boutique' => 'caissier', 'created_at' => now(), 'updated_at' => now()],
        ]);

        $this->migration()->up();

        $resultat = $boutique->gererPromotionGerant($gerant->id, 'gerant');

        // gererPromotionGerant() arbitre : c'est a l'appelant d'appliquer la
        // promotion. On verifie donc qu'il ne signale pas de gerant en place.
        $this->assertTrue($resultat['ok'], 'Le proprietaire ne doit pas etre compte comme un gerant en place.');
        $this->assertSame('ok', $resultat['code']);
        $this->assertSame(
            'caissier',
            DB::table('boutique_user')->where('boutique_id', $boutique->id)->where('user_id', $gerant->id)->value('role_dans_boutique'),
            "L'arbitrage ne doit rien ecrire par lui-meme."
        );
        $this->assertSame(
            'proprietaire',
            DB::table('boutique_user')->where('boutique_id', $boutique->id)->where('user_id', $owner->id)->value('role_dans_boutique'),
            'Le propriétaire garde son rôle, il n\'est ni rétrogradé ni promu gérant.'
        );
    }

    private function utilisateur(string $nom): User
    {
        return User::create([
            'name' => $nom,
            'email' => str($nom)->slug().'@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);
    }
}
