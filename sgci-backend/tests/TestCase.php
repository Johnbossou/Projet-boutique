<?php

namespace Tests;

use App\Models\Boutique;
use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * En production, un utilisateur est TOUJOURS rattaché à une boutique
     * (register en crée une, l'ajout d'équipe rattache via le pivot).
     *
     * Les anciens tests créaient des utilisateurs sans aucune boutique.
     * Ce schéma est invalide : sans boutique courante, l'API refuse
     * l'accès aux données (guard-fou multi-tenants) au lieu de renvoyer
     * les lignes de tous les tenants.
     *
     * On rattache donc automatiquement chaque utilisateur créé sans
     * boutique à une boutique de test, sauf opt-out explicite.
     */
    protected static bool $provisionnerBoutique = true;

    /** Empêche la récursion quand la boutique de test doit créer son propriétaire. */
    private static bool $enProvisionnement = false;

    private static ?int $idProprietaireTest = null;

    protected function setUp(): void
    {
        parent::setUp();

        static::$provisionnerBoutique = true;
        static::$enProvisionnement = false;
        static::$idProprietaireTest = null;

        if (static::$provisionnerBoutique) {
            User::created(function (User $user) {
                if (! static::$provisionnerBoutique
                    || static::$enProvisionnement
                    || $user->current_boutique_id) {
                    return;
                }

                static::$enProvisionnement = true;

                try {
                    $proprietaireId = $user->role === 'proprietaire'
                        ? $user->id
                        : static::proprietaireDeTest();

                    $boutique = Boutique::withoutEvents(fn () => Boutique::create([
                        'nom' => 'Boutique Test',
                        'devise' => 'XOF',
                        'taux_tva' => 18,
                        'proprietaire_id' => $proprietaireId,
                    ]));

                    if ($user->role !== 'proprietaire') {
                        $boutique->users()->attach($user->id, [
                            'role_dans_boutique' => $user->role,
                        ]);
                    }

                    $user->forceFill(['current_boutique_id' => $boutique->id])->save();
                } finally {
                    static::$enProvisionnement = false;
                }
            });
        }
    }

    /**
     * boutiques.proprietaire_id est NOT NULL : il faut toujours un
     * propriétaire réel pour la boutique de test.
     */
    private static function proprietaireDeTest(): int
    {
        if (static::$idProprietaireTest !== null) {
            return static::$idProprietaireTest;
        }

        $existant = User::where('email', 'proprietaire-tests@sgci.bj')->first();

        if ($existant) {
            return static::$idProprietaireTest = $existant->id;
        }

        $proprietaire = User::create([
            'name' => 'Propriétaire Test',
            'email' => 'proprietaire-tests@sgci.bj',
            'password' => bcrypt('password'),
            'role' => 'proprietaire',
            'est_actif' => true,
        ]);

        return static::$idProprietaireTest = $proprietaire->id;
    }

    /**
     * Désactive le rattachement automatique pour ce test.
     * À utiliser quand le test veut contrôler lui-même les boutiques.
     */
    protected function sansProvisionnerBoutique(): void
    {
        static::$provisionnerBoutique = false;
    }
}
