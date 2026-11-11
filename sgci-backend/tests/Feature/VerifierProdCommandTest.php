<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Controle de mise en production.
 *
 * La commande doit dire ce qui manque, et le dire sans se tromper. Deux
 * erreurs opposees sont verifiees ici : ne pas voir un probleme, et en
 * inventer un.
 *
 * Les verifications portent sur le detail des points bloquants, pas sur le
 * libelle du controle : un libelle apparait dans la ligne « OK » comme dans
 * la ligne « KO », et c'est la presence du probleme qui compte.
 */
class VerifierProdCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_la_commande_sort_en_erreur_quand_un_point_bloquant_manque(): void
    {
        // L'environnement de test n'est pas une production : APP_ENV, la
        // base, les identifiants... la commande doit le signaler et
        // sortir en erreur.
        $this->artisan('sgci:verifier-prod')->assertFailed();
    }

    public function test_la_commande_signale_les_comptes_de_demonstration(): void
    {
        User::create([
            'name' => 'Gérant Demo',
            'email' => 'gerant@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);

        $this->artisan('sgci:verifier-prod')
            ->expectsOutputToContain('Ces comptes ont le mot de passe')
            ->assertFailed();
    }

    public function test_la_commande_ne_signale_pas_de_compte_quand_la_base_en_est_depourvue(): void
    {
        $this->artisan('sgci:verifier-prod')
            ->doesntExpectOutputToContain('Ces comptes ont le mot de passe')
            ->assertFailed();
    }

    public function test_la_commande_verifie_les_migrations_en_attente(): void
    {
        // Une migration presente sur le disque mais appliquee absente de la
        // table : l'application est servie avec un schema en retard et
        // echoue sur les ecrans qui touchent les colonnes recentes.
        $derniere = DB::table('migrations')->orderByDesc('id')->first();

        if ($derniere) {
            DB::table('migrations')->where('id', $derniere->id)->delete();
        }

        $this->artisan('sgci:verifier-prod')
            ->expectsOutputToContain('Lancez `php artisan migrate --force`')
            ->assertFailed();
    }
}
