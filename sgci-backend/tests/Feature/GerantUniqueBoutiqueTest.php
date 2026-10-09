<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Règle métier « un seul gérant par boutique » (Boutique::gererPromotionGerant).
 *
 * Cette règle n'était couverte par aucun test, ce qui a laissé passer une
 * rétrogradation de propriétaire : les données migrées rangent le propriétaire
 * en pivot 'gerant' (il gère sa boutique par défaut), et il était donc pris
 * pour « le gérant déjà en place » puis rétrogradé en caissier — pivot ET rôle
 * global — dès qu'un membre était promu gérant à son tour.
 *
 * Le propriétaire n'est pas un gérant en concurrence : il est exclu de
 * l'arbitrage. C'est le comportement vérifié ici.
 */
class GerantUniqueBoutiqueTest extends TestCase
{
    use RefreshDatabase;

    private Boutique $boutique;

    private User $proprietaire;

    protected function setUp(): void
    {
        parent::setUp();

        // Ce test contrôle lui-même tous les rattachements.
        $this->sansProvisionnerBoutique();

        $this->proprietaire = $this->utilisateur('Proprietaire', 'proprietaire');
        $this->boutique = Boutique::create([
            'nom' => 'Boutique Gerant Unique',
            'proprietaire_id' => $this->proprietaire->id,
        ]);
    }

    public function test_le_proprietaire_gerant_ne_bloque_pas_la_promotion_dun_membre(): void
    {
        // Données migrées : le propriétaire est en pivot 'gerant'.
        $this->rattacher($this->proprietaire, 'gerant');
        $membre = $this->rattacher($this->utilisateur('Membre', 'caissier'), 'caissier');

        $resultat = $this->boutique->gererPromotionGerant($membre->id, 'gerant');

        $this->assertTrue($resultat['ok'], 'Le propriétaire ne doit pas être compté comme un gérant en place.');
        $this->assertSame('ok', $resultat['code']);
    }

    public function test_le_proprietaire_nest_jamais_retrograde_par_la_promotion(): void
    {
        $this->rattacher($this->proprietaire, 'gerant');
        $membre = $this->rattacher($this->utilisateur('Membre', 'caissier'), 'caissier');

        $resultat = $this->boutique->gererPromotionGerant($membre->id, 'gerant', true);

        $this->assertTrue($resultat['ok']);

        $this->assertSame('gerant', $this->pivotRole($this->proprietaire),
            'Le pivot du propriétaire ne doit jamais être rétrogradé.');
        $this->assertSame('proprietaire', $this->proprietaire->fresh()->role,
            'Le rôle global d\'un propriétaire ne doit jamais être rétrogradé.');
    }

    public function test_un_second_gerant_exige_une_confirmation(): void
    {
        $this->rattacher($this->proprietaire, 'gerant');
        $premier = $this->rattacher($this->utilisateur('Premier', 'gerant'), 'gerant');
        $second = $this->rattacher($this->utilisateur('Second', 'caissier'), 'caissier');

        $resultat = $this->boutique->gererPromotionGerant($second->id, 'gerant');

        $this->assertFalse($resultat['ok']);
        $this->assertSame('gerant_existant', $resultat['code']);
        $this->assertSame($premier->id, $resultat['gerant_actuel']['id'],
            'Le gérant en place doit être le vrai gérant, jamais le propriétaire.');

        $this->assertSame('caissier', $this->pivotRole($second),
            'Sans confirmation, rien ne doit être écrit.');
    }

    public function test_la_confirmation_retrograde_le_gerant_precedent(): void
    {
        $this->rattacher($this->proprietaire, 'gerant');
        $premier = $this->rattacher($this->utilisateur('Premier', 'gerant'), 'gerant');
        $second = $this->rattacher($this->utilisateur('Second', 'caissier'), 'caissier');

        $resultat = $this->boutique->gererPromotionGerant($second->id, 'gerant', true);

        $this->assertTrue($resultat['ok']);
        $this->assertSame('caissier', $this->pivotRole($premier));
        $this->assertSame('caissier', $premier->fresh()->role,
            'Un gérant sans autre boutique gérée doit perdre aussi son rôle global.');

        $this->assertSame('gerant', $this->pivotRole($this->proprietaire),
            'Le propriétaire reste gérant de sa boutique.');
    }

    public function test_un_gerant_qui_ger_autre_boutique_conserve_son_role_global(): void
    {
        $autreBoutique = Boutique::create([
            'nom' => 'Boutique Seconde',
            'proprietaire_id' => $this->proprietaire->id,
        ]);

        $this->rattacher($this->proprietaire, 'gerant');
        $premier = $this->rattacher($this->utilisateur('Premier', 'gerant'), 'gerant');
        $this->rattacher($premier, 'gerant', $autreBoutique);

        $second = $this->rattacher($this->utilisateur('Second', 'caissier'), 'caissier');

        $resultat = $this->boutique->gererPromotionGerant($second->id, 'gerant', true);

        $this->assertTrue($resultat['ok']);
        $this->assertSame('caissier', $this->pivotRole($premier, $this->boutique));
        $this->assertSame('gerant', $premier->fresh()->role,
            'Il gère encore une autre boutique : son rôle global doit être conservé.');
    }

    public function test_promouvoir_un_role_non_gerant_ne_declenche_aucun_controle(): void
    {
        $this->rattacher($this->proprietaire, 'gerant');
        $premier = $this->rattacher($this->utilisateur('Premier', 'gerant'), 'gerant');
        $membre = $this->rattacher($this->utilisateur('Membre', 'caissier'), 'caissier');

        $resultat = $this->boutique->gererPromotionGerant($membre->id, 'caissier');

        $this->assertTrue($resultat['ok']);
        $this->assertSame('pas_gerant', $resultat['code']);
        $this->assertSame('gerant', $this->pivotRole($premier));
    }

    public function test_promouvoir_le_gerant_deja_en_place_ne_declenche_rien(): void
    {
        $this->rattacher($this->proprietaire, 'gerant');
        $premier = $this->rattacher($this->utilisateur('Premier', 'gerant'), 'gerant');

        $resultat = $this->boutique->gererPromotionGerant($premier->id, 'gerant');

        $this->assertTrue($resultat['ok']);
        $this->assertSame('gerant', $this->pivotRole($premier));
    }

    // -------------------------------------------------- utilitaires

    private function utilisateur(string $nom, string $role): User
    {
        return User::create([
            'name' => $nom,
            'email' => str($nom.'-'.uniqid())->slug().'@sgci.bj',
            'password' => bcrypt('password'),
            'role' => $role,
            'est_actif' => true,
        ]);
    }

    private function rattacher(User $user, string $role, ?Boutique $boutique = null): User
    {
        $boutique ??= $this->boutique;

        $user->boutiques()->attach($boutique->id, ['role_dans_boutique' => $role]);
        $user->forceFill(['current_boutique_id' => $boutique->id])->save();

        return $user;
    }

    private function pivotRole(User $user, ?Boutique $boutique = null): ?string
    {
        $boutique ??= $this->boutique;

        return $user->boutiques()
            ->wherePivot('boutique_id', $boutique->id)
            ->first()
            ?->pivot?->role_dans_boutique;
    }
}
