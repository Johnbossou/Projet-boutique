<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * La colonne boutique_user.role_dans_boutique a un défaut SQL à 'caissier'.
 *
 * Conséquence : un `attach($id)` qui oublie le rôle ne lève AUCUNE erreur, il
 * crée silencieusement un caissier. Pour un gérant ou un propriétaire, c'est
 * une rétrogradation invisible : les tests passent quand ils ne devraient pas,
 * et le middleware role.gerant commence à renvoyer 403 en production sans
 * qu'aucune ligne de log n'explique pourquoi.
 *
 * Ces tests verrouillent l'invariant : toute écriture du pivot boutique_user
 * doit nommer son rôle, dans le code comme dans les tests. C'est un garde-fou
 * de source, pas de comportement — un comportement correct mais mal typé reste
 * un bug, précisément parce que le défaut SQL le rend invisible.
 */
class PivotRoleBoutiqueTest extends TestCase
{
    use RefreshDatabase;

    private const RACINE = __DIR__.'/../..';

    public function test_un_attach_sans_role_cree_bien_un_caissier_silencieusement(): void
    {
        // On démontre le danger au lieu de le supposer : c'est ce silence qui
        // rend l'erreur possible et invisible. Le défaut SQL est donc vérifié
        // par son effet, pas en lisant la table de métadonnées.
        $this->sansProvisionnerBoutique();

        $proprietaire = $this->utilisateur('Proprio', 'proprietaire');
        $gerant = $this->utilisateur('Gerant', 'gerant');
        $boutique = Boutique::create([
            'nom' => 'Boutique Pivot Role',
            'proprietaire_id' => $proprietaire->id,
        ]);

        $gerant->boutiques()->attach($boutique->id);

        $pivot = $gerant->boutiques()->first()->pivot;

        $this->assertSame('caissier', $pivot->role_dans_boutique,
            'La colonne a un défaut SQL à caissier : un attach sans rôle rétrograde en silence.');

        $this->assertNotSame('gerant', $gerant->roleDansBoutique($boutique->id),
            'Un rôle global gérant ne rattrape pas un pivot vide.');
    }

    /**
     * Toute écriture du pivot boutique_user doit nommer role_dans_boutique.
     */
    #[DataProvider('ecrituresDuPivot')]
    public function test_toute_ecriture_du_pivot_nomme_son_role(string $fichier): void
    {
        $lignes = preg_split('/\R/', (string) file_get_contents($fichier)) ?: [];
        $manquants = [];

        foreach ($lignes as $index => $ligne) {
            if (! preg_match('/->(attach|syncWithoutDetaching|updateExistingPivot)\s*\(/', $ligne)) {
                continue;
            }

            // Une écriture multi-lignes est saine si le rôle apparaît dans les
            // lignes qui suivent : on travaille donc sur une fenêtre glissante.
            $fenetre = implode("\n", array_slice($lignes, $index, 12));

            if (! $this->ecritLePivotBoutiqueUser($fenetre)) {
                continue;
            }

            if (! str_contains($fenetre, 'role_dans_boutique')) {
                $manquants[] = $index + 1;
            }
        }

        $this->assertSame([], $manquants,
            basename($fichier).' : écriture(s) du pivot boutique_user sans rôle explicite.');
    }

    /**
     * @return array<string, array{string}>
     */
    public static function ecrituresDuPivot(): array
    {
        $fichiers = [];

        foreach (['app', 'database/seeders', 'tests'] as $dossier) {
            foreach (self::phpFiles(self::RACINE.'/'.$dossier) as $fichier) {
                if (self::ecritLePivotBoutiqueUser((string) file_get_contents($fichier))) {
                    $fichiers[basename($fichier)] = [$fichier];
                }
            }
        }

        return $fichiers;
    }

    /**
     * conversation_chat et ses participants ont leur propre colonne 'role' :
     * ils sont hors périmètre de ce garde-fou.
     */
    private static function ecritLePivotBoutiqueUser(string $contenu): bool
    {
        if (! preg_match('/->(attach|syncWithoutDetaching|updateExistingPivot)\s*\(/', $contenu)) {
            return false;
        }

        return str_contains($contenu, 'boutique_user')
            || str_contains($contenu, 'boutiques()')
            || str_contains($contenu, 'boutique->users()')
            || str_contains($contenu, '->users()');
    }

    /**
     * @return list<string>
     */
    private static function phpFiles(string $racine): array
    {
        if (! is_dir($racine)) {
            return [];
        }

        $fichiers = [];
        $iterateur = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($racine));

        foreach ($iterateur as $entree) {
            if ($entree->isFile() && $entree->getExtension() === 'php') {
                $fichiers[] = str_replace('\\', '/', $entree->getPathname());
            }
        }

        sort($fichiers);

        return $fichiers;
    }

    // -------------------------------------------------- utilitaires

    private function utilisateur(string $nom, string $role): User
    {
        return User::create([
            'name' => $nom,
            'email' => str($nom.' '.$role)->slug().'@sgci.bj',
            'password' => bcrypt('password'),
            'role' => $role,
            'est_actif' => true,
        ]);
    }
}
