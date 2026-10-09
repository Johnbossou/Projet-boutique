<?php

namespace Tests\Feature;

use App\Exceptions\OperationRefusee;
use App\Models\Boutique;
use App\Models\Categorie;
use App\Models\LigneVente;
use App\Models\Produit;
use App\Models\RetourVente;
use App\Models\RetourVenteLigne;
use App\Models\User;
use App\Models\Vente;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabaseState;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Concurrence réelle, sur un moteur qui verrouille pour de vrai.
 *
 * Pourquoi ce fichier est séparé
 * ------------------------------
 * SQLite ignore `lockForUpdate()`. Toute la suite passait au vert en local
 * alors qu'aucun verrou n'était réellement appliqué : les correctifs de
 * concurrence ne pouvaient pas être prouvés. Ce fichier ouvre deux CONNEXIONS
 * distinctes vers le même serveur, ce qui reproduit ce que font deux caisses
 * ou deux onglets du même back, et se fait sauter sur un moteur sans verrous.
 *
 * Pourquoi migrate:fresh et non RefreshDatabase
 * --------------------------------------------
 * RefreshDatabase enveloppe chaque test dans une transaction non validée : ses
 * données sont invisibles depuis une autre connexion, et tout ce fichier repose
 * sur deux sessions concurrentes. migrate:fresh supprime les tables sans
 * appeler down(), ce qui évite aussi le refus volontaire de rollback de la
 * migration « motif transfert ».
 */
class ConcurrenceMySQLTest extends TestCase
{
    private const CONNEXION_SECONDAIRE = 'mysql2';

    private Boutique $boutique;

    private User $gerant;

    private Produit $produit;

    protected function setUp(): void
    {
        parent::setUp();

        if (DB::connection()->getDriverName() !== 'mysql') {
            $this->markTestSkipped(
                'Exige un moteur à verrous réels : SQLite ignore lockForUpdate().'
            );
        }

        Artisan::call('migrate:fresh', ['--force' => true]);

        // La seconde connexion est une copie exacte de la première : même base,
        // mêmes identifiants, mais session indépendante. C'est la seule façon
        // d'obtenir un vrai verrou InnoDB concurrent dans un seul processus.
        config([
            'database.connections.'.self::CONNEXION_SECONDAIRE => config('database.connections.mysql'),
        ]);

        $this->gerant = User::create([
            'name' => 'Gérant Concurrence',
            'email' => 'gerant-concurrence@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);

        $this->boutique = Boutique::create([
            'nom' => 'Boutique Concurrence',
            'adresse' => 'Porto-Novo',
            'proprietaire_id' => $this->gerant->id,
        ]);

        $this->gerant->boutiques()->attach($this->boutique->id, ['role_dans_boutique' => 'gerant']);
        $this->gerant->update(['current_boutique_id' => $this->boutique->id]);

        $categorie = Categorie::create([
            'nom' => 'Cat Concurrence',
            'description' => 'D',
            'couleur' => '#000',
            'icone' => 'box',
        ]);

        // Stock à 0 : la vente de 10 unités a tout sorti du stock.
        $this->produit = Produit::create([
            'nom' => 'Produit Concurrence',
            'description' => 'Test',
            'prix' => 1000,
            'quantite_stock' => 0,
            'seuil_alerte' => 2,
            'categorie_id' => $categorie->id,
            'unite_mesure' => 'unite',
            'boutique_id' => $this->boutique->id,
        ]);
    }

    protected function tearDown(): void
    {
        DB::setDefaultConnection('mysql');
        config(['database.default' => 'mysql']);
        DB::purge(self::CONNEXION_SECONDAIRE);

        // Ces tests valident nécessairement des données : ils ne peuvent pas
        // être enveloppés dans une transaction, sinon la seconde session ne les
        // voit pas. Les lignes sont donc réellement commitées et fuiraient vers
        // les tests suivants, qui agrègent les ventes du mois.
        //
        // On ne peut pas non plus se contenter de vider les tables : les autres
        // tests utilisent RefreshDatabase, qui garde en mémoire « base déjà
        // migrée » et ne rejoue donc pas les migrations. Il faut lever ce
        // drapeau pour que le prochain test reparte d'une base propre.
        RefreshDatabaseState::$migrated = false;

        parent::tearDown();
    }

    private function creerVenteTerminee(int $quantite = 10): Vente
    {
        $vente = Vente::create([
            'numero_vente' => 'VT-CONC-'.uniqid(),
            'montant_total' => $quantite * 1000,
            'tva' => 0,
            'remise' => 0,
            'user_id' => $this->gerant->id,
            'boutique_id' => $this->boutique->id,
            'statut' => 'termine',
        ]);

        LigneVente::create([
            'vente_id' => $vente->id,
            'produit_id' => $this->produit->id,
            'quantite' => $quantite,
            'prix_unitaire' => 1000,
            'prix_vente' => 1000,
            'montant_total' => $quantite * 1000,
        ]);

        return $vente;
    }

    /**
     * Bascule la connexion par défaut sur la seconde session.
     * Les façades (DB::transaction, DB::table) suivent : le code métier exécuté
     * ensuite part bien sur cette session.
     */
    private function basculerSurLaSecondeConnexion(): void
    {
        config(['database.default' => self::CONNEXION_SECONDAIRE]);
        DB::setDefaultConnection(self::CONNEXION_SECONDAIRE);
        DB::purge(self::CONNEXION_SECONDAIRE);
    }

    private function revenirSurLaConnexionPrincipale(): void
    {
        config(['database.default' => 'mysql']);
        DB::setDefaultConnection('mysql');
        DB::purge('mysql');
    }

    /**
     * Le vrai code métier, exécuté sur une session alors qu'une autre session
     * tient la vente verrouillée.
     *
     * Ce que ce test prouve : le chemin d'annulation se sérialise, et la
     * seconde tentative est refusée au lieu d'être rejouée. Retirer le
     * verrou fait échouer ce test.
     *
     * Ce qu'il ne prouve pas, et qu'il serait malhonnête de lui attribuer :
     * que le `lockForUpdate()` explicite est indispensable. L'UPDATE qui suit
     * dans la même transaction prend le même verrou exclusif en InnoDB, donc
     * retirer la lecture verrouillée ne change rien d'observable ici.
     * L'intérêt du `lockForUpdate()` est ailleurs — il transforme la lecture
     * du statut en lecture « courante » au lieu d'une lecture instantanée,
     * ce qui empêche le modèle perdu entre le SELECT et l'UPDATE. Vérifier
     * cela demande deux processus et un point d'interception au milieu de la
     * transaction, donc un outillage qui n'existe pas encore ici.
     */
    public function test_le_code_metier_bloque_tant_quune_autre_session_tient_la_vente(): void
    {
        $vente = $this->creerVenteTerminee(10);

        // Session 1 : verrou de ligne pris sur la vente, transaction ouverte.
        DB::connection('mysql')->beginTransaction();
        Vente::whereKey($vente->id)->lockForUpdate()->first();

        // Session 2 : délai court pour ne pas attendre 50 s.
        $this->basculerSurLaSecondeConnexion();
        DB::statement('SET SESSION innodb_lock_wait_timeout = 1');

        $t0 = microtime(true);
        $bloque = false;
        $autreErreur = null;

        try {
            // On appelle le VRAI code métier, pas une requête recopiée : c'est
            // la seule façon de prouver que l'implémentation, et non le test,
            // est sérialisée.
            Vente::findOrFail($vente->id)->annuler();
        } catch (QueryException $e) {
            $bloque = str_contains(strtolower($e->getMessage()), 'lock wait timeout');
            $autreErreur = $e->getMessage();
        }

        $duree = microtime(true) - $t0;

        DB::connection('mysql')->rollBack();

        $this->assertTrue(
            $bloque,
            "Vente::annuler() n'a pas attendu le verrou tenu par l'autre session : "
            .'rien n’est sérialisé, et deux annulations simultanées '
            .'restitueraient le stock deux fois. Erreur obtenue : '.($autreErreur ?? 'aucune')
        );
        $this->assertGreaterThanOrEqual(
            0.9,
            $duree,
            'L’échec doit venir de l’attente du verrou, pas d’une erreur immédiate.'
        );
    }

    public function test_mysql_serialise_bien_les_deux_sessions(): void
    {
        // Contrôle du harnais : si ce test échoue, c’est la fixture de
        // concurrence qui est fausse, pas le code applicatif. Sans lui, un
        // échec du test précédent pourrait venir d’un moteur qui ne verrouille
        // pas, et le diagnostic serait faux.
        $vente = $this->creerVenteTerminee(10);

        DB::connection('mysql')->beginTransaction();
        Vente::whereKey($vente->id)->lockForUpdate()->first();

        $this->basculerSurLaSecondeConnexion();
        DB::statement('SET SESSION innodb_lock_wait_timeout = 1');

        $bloque = false;

        try {
            Vente::whereKey($vente->id)->lockForUpdate()->first();
        } catch (QueryException $e) {
            $bloque = str_contains(strtolower($e->getMessage()), 'lock wait timeout');
        }

        DB::connection('mysql')->rollBack();

        $this->assertTrue($bloque, 'Le moteur de test ne verrouille pas : les assertions de concurrence sont sans valeur.');
    }

    public function test_deux_annulations_successives_ne_restituent_le_stock_qu_une_fois(): void
    {
        $vente = $this->creerVenteTerminee(10);

        Vente::findOrFail($vente->id)->annuler();

        $this->assertSame(10, (int) $this->produit->fresh()->quantite_stock);
        $this->assertSame('annule', $vente->fresh()->statut);

        // La même vente revient par une autre requête HTTP, sur une autre
        // session. L'état est relu sous verrou, donc la seconde passe est
        // refusée au lieu d'être rejouée.
        $this->basculerSurLaSecondeConnexion();

        $statutHttp = null;

        try {
            DB::transaction(function () use ($vente) {
                Vente::whereKey($vente->id)->lockForUpdate()->first();
                Vente::findOrFail($vente->id)->annuler();
            });
        } catch (OperationRefusee $e) {
            $statutHttp = $e->statutHttp();
        }

        $this->assertSame(
            409,
            $statutHttp,
            'La seconde annulation doit être refusée en 409 : « déjà annulée » lu sous verrou, pas dans une instance périmée.'
        );

        $this->revenirSurLaConnexionPrincipale();

        // Le contrôle décisif : 10 unités vendues, 10 rendues, pas 20.
        $this->assertSame(10, (int) $this->produit->fresh()->quantite_stock);
        $this->assertSame(
            1,
            DB::table('mouvements_stock')->where('raison', 'annulation_vente')->count(),
            'Un seul mouvement compensateur doit avoir été écrit.'
        );
    }

    public function test_le_cumul_des_retours_valides_est_relu_par_lannulation(): void
    {
        $vente = $this->creerVenteTerminee(10);
        $ligneVente = $vente->ligneVentes->first();

        $retour = RetourVente::create([
            'vente_id' => $vente->id,
            'boutique_id' => $this->boutique->id,
            'motif' => 'defectueux',
            'statut' => 'valide',
            'date_retour' => now(),
            'user_id' => $this->gerant->id,
        ]);

        RetourVenteLigne::create([
            'retour_vente_id' => $retour->id,
            'ligne_vente_id' => $ligneVente->id,
            'produit_id' => $this->produit->id,
            'quantite_retournee' => 4,
            'prix_unitaire' => 1000,
            'montant_retourne' => 4000,
        ]);

        // Le retour validé a déjà crédité 4 unités.
        $this->produit->update(['quantite_stock' => 4]);

        // Une autre session annule la vente : elle doit lire le cumul sous le
        // même verrou et ne restituer que le reliquat.
        $this->basculerSurLaSecondeConnexion();

        Vente::findOrFail($vente->id)->annuler();

        $this->revenirSurLaConnexionPrincipale();

        $this->assertSame(
            10,
            (int) $this->produit->fresh()->quantite_stock,
            '4 déjà rendues + 6 restituées = 10, pas 14.'
        );
        $this->assertSame(
            6,
            (int) DB::table('mouvements_stock')->where('raison', 'annulation_vente')->value('quantite'),
            'Seules les 6 unités encore sorties du stock doivent être restituées.'
        );
    }
}
