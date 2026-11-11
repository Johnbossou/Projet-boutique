<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

/**
 * Seed en production.
 *
 * Les seeders creent des comptes de demonstration dont le mot de passe est
 * « password » : gerant@sgci.bj, proprietaire@sgci.bj, caissier@sgci.bj.
 * Sur une base neuve, le conteneur de deploiement les creait au premier
 * demarrage — n'importe qui pouvait alors se connecter a l'application avec
 * une adresse et un mot de passe connus.
 *
 * En production, aucun seed : le premier gerant se cree par la page
 * d inscription, qui cree aussi sa boutique.
 */
class SeedProductionTest extends TestCase
{
    use RefreshDatabase;

    public function test_le_seed_cree_les_comptes_en_developpement(): void
    {
        $this->assertNotSame('production', $this->app->environment());

        // `--force` : sans lui, `db:seed` demande une confirmation quand
        // l'environnement est production, et le test resterait bloque sur
        // une question.
        Artisan::call('db:seed', ['--force' => true]);

        $this->assertDatabaseHas('users', ['email' => 'gerant@sgci.bj']);
    }

    public function test_le_seed_ne_cree_aucun_compte_en_production(): void
    {
        $this->app['env'] = 'production';

        // `--force` : sans lui, `db:seed` demande une confirmation quand
        // l'environnement est production, et le test resterait bloque sur
        // une question.
        Artisan::call('db:seed', ['--force' => true]);

        $this->assertSame(0, User::count(), 'Aucun compte de demonstration ne doit exister en production.');
        $this->assertDatabaseCount('users', 0);
    }
}
