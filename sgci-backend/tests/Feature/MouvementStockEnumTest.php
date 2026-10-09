<?php

namespace Tests\Feature;

use App\Http\Controllers\API\MouvementStockController;
use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;

/**
 * Garde-fou statique : toute raison de mouvement écrite par le code applicatif
 * doit exister dans l'ENUM Declare par les migrations.
 *
 * Contexte : Vente::annuler() ecritait raison = 'annulation_vente', valeur
 * absente de l'ENUM mouvements_stock.raison. Le test unitaire passait car
 * SQLite n'applique pas les ENUM, mais sur MySQL/TiDB en mode strict l'INSERT
 * levait SQLSTATE 1265 et annulait toute la transaction : la vente restait
 * « termine » et le stock n'etait pas restitue.
 *
 * Ce test s'execute en lecture seule sur les sources : il tourne donc sur
 * n'importe quel moteur, y compris SQLite, et ne peut pas etre Trompe par
 * l'absence d'ENUM.
 */
class MouvementStockEnumTest extends TestCase
{
    /** Repertoire racine du projet Laravel. */
    private static function racine(): string
    {
        return dirname(__DIR__, 2);
    }

    /**
     * Toutes les listes enum('raison', [...]) declarees par les migrations,
     * dans l'ordre chronologique d'application.
     *
     * @return array<int, array<int, string>>
     */
    private function enumDeclaresParLesMigrations(): array
    {
        $fichiers = glob(self::racine().'/database/migrations/*.php') ?: [];
        sort($fichiers);

        $listes = [];

        foreach ($fichiers as $fichier) {
            $contenu = (string) file_get_contents($fichier);

            if (! preg_match("/enum\(\s*'raison'\s*,\s*\[(.*?)\]/s", $contenu, $m)) {
                continue;
            }

            preg_match_all("/'([^']+)'/", $m[1], $valeurs);
            $valeurs = $valeurs[1] ?? [];

            if ($valeurs !== []) {
                $listes[] = $valeurs;
            }
        }

        return $listes;
    }

    /** La derniere declaration d'ENUM gagne : c'est celle qui s'applique in fine. */
    private function enumEffectif(): array
    {
        $listes = $this->enumDeclaresParLesMigrations();

        $this->assertNotEmpty(
            $listes,
            "Aucun enum('raison', [...]) trouve dans database/migrations : "
            .'le scan de la colonne a change de forme, ce test doit etre adapte.'
        );

        return end($listes);
    }

    /**
     * Les raisons ecrites explicitement dans le code applicatif, sous la forme
     * 'raison' => 'valeur' (avec ou sans concatenation, ignoree).
     *
     * @return array<string, string> chemin du fichier => valeur trouvee
     */
    private function raisonsEcritesParLeCode(): array
    {
        $trouvees = [];

        $iterateur = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator(self::racine().'/app', RecursiveDirectoryIterator::SKIP_DOTS)
        );

        /** @var SplFileInfo $fichier */
        foreach ($iterateur as $fichier) {
            if (! $fichier->isFile() || $fichier->getExtension() !== 'php') {
                continue;
            }

            $contenu = (string) file_get_contents($fichier->getPathname());

            // Expression statique uniquement : on ne peut pas evaluer une
            // concatenation ou une variable, on ignore donc ces formes.
            if (! preg_match_all("/'raison'\s*=>\s*'([a-z_]+)'/", $contenu, $m)) {
                continue;
            }

            foreach ($m[1] as $raison) {
                $cle = $this->cheminRelatif($fichier->getPathname());

                // Un meme fichier peut ecrire plusieurs raisons.
                $trouvees[$cle.'#'.$raison] = $raison;
            }
        }

        return $trouvees;
    }

    private function cheminRelatif(string $absolu): string
    {
        return str_replace('\\', '/', str_replace(self::racine(), '', $absolu));
    }

    public function test_les_raisons_de_base_sont_toujours_declarees(): void
    {
        foreach (['arrivage', 'vente', 'ajustement', 'retour', 'casse'] as $raison) {
            $this->assertContains(
                $raison,
                $this->enumEffectif(),
                "La raison historique « $raison » a disparu de l'ENUM : "
                .'des mouvements existants deviendraient irrepresentables.'
            );
        }
    }

    public function test_chaque_raison_ecrite_par_le_code_existe_dans_l_enum(): void
    {
        $enum = $this->enumEffectif();
        $ecrites = $this->raisonsEcritesParLeCode();

        $this->assertNotEmpty(
            $ecrites,
            'Aucune raison trouvee dans app/ : le motif de scan a casse, ce test doit etre adapte.'
        );

        $manquantes = [];

        foreach ($ecrites as $origine => $raison) {
            if (! in_array($raison, $enum, true)) {
                $manquantes[] = sprintf('%s => %s', $origine, $raison);
            }
        }

        $this->assertSame(
            [],
            $manquantes,
            "Raison(s) de mouvement ecrites par le code mais absentes de l'ENUM "
            .'mouvements_stock.raison. Sur MySQL/TiDB strict cela leve SQLSTATE 1265 '
            ."et fait echouer l'operation entiere.\n".implode("\n", $manquantes)
        );
    }

    public function test_annulation_vente_est_une_raison_valide(): void
    {
        // Vente::annuler() ecrit cette valeur ; elle doit donc etre declarative.
        $this->assertContains('annulation_vente', $this->enumEffectif());
    }

    public function test_annulation_vente_n_est_pas_exposable_via_l_api_mouvements(): void
    {
        // Deliberement exclu de MouvementStockController::RAISONS : l'API ne doit
        // pas permettre de forger un mouvement de restitution de stock.
        // Seul Vente::annuler() (interne) est autorise a l'ecrire.
        $this->assertNotContains(
            'annulation_vente',
            MouvementStockController::RAISONS,
            'RAISONS alimente la validation de POST/PUT /mouvements-stock : '
            .'y ajouter annulation_vente permettrait de forger un credit de stock.'
        );
    }
}
