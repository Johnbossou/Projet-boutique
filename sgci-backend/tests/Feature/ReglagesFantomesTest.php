<?php

namespace Tests\Feature;

use App\Jobs\SendDailyReportsJob;
use App\Models\Boutique;
use App\Models\BoutiqueSetting;
use App\Models\CommandeClient;
use App\Models\User;
use App\Models\Vente;
use App\Services\EmailService;
use App\Services\FacturationService;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Deux régressions corrigées ensemble parce qu'elles se ressemblent : des
 * réglages invoqués via `$modele->colonne_inexistante ?? defaut`, qui rendent
 * toujours le défaut et laissent croire que la fonctionnalité existe.
 *
 *  - alertes_stock_actives    : ?? true   -> when() toujours vrai
 *  - rapport_quotidien_actif  : ?? false  -> job jamais exécuté
 */
class ReglagesFantomesTest extends TestCase
{
    use RefreshDatabase;

    private User $proprietaire;

    private \ArrayObject $rapportsRecus;

    protected function setUp(): void
    {
        parent::setUp();

        $this->sansProvisionnerBoutique();
        $this->rapportsRecus = new \ArrayObject;

        $this->proprietaire = User::create([
            'name' => 'Propriétaire',
            'email' => 'proprio@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'proprietaire',
            'est_actif' => true,
        ]);

        // Doublure d'enregistrement : on teste la portée et les chiffres
        // réellement calculés par le job, sans dépendre du rendu Blade. Et
        // surtout pas de Mail::assertSent avec closure : Laravel y lit le type
        // de la closure comme un NOM DE CLASSE de mailable, pas comme
        // l'instance envoyée.
        $recueil = $this->rapportsRecus;

        $this->app->bind(EmailService::class, fn () => new class($recueil) extends EmailService
        {
            public function __construct(private \ArrayObject $recueil) {}

            public function sendDailyReport(User $user, array $stats, ?Boutique $boutique = null): array
            {
                $this->recueil->append(['user' => $user, 'stats' => $stats, 'boutique' => $boutique]);

                return ['success' => true, 'message' => 'ok'];
            }
        });
    }

    private function boutique(string $nom, ?User $gerant = null): Boutique
    {
        $b = Boutique::create([
            'nom' => $nom,
            'proprietaire_id' => $this->proprietaire->id,
        ]);
        $b->users()->attach($this->proprietaire->id, ['role_dans_boutique' => 'proprietaire']);

        if ($gerant) {
            $b->users()->attach($gerant->id, ['role_dans_boutique' => 'gerant']);
            $gerant->forceFill(['current_boutique_id' => $b->id])->save();
        }

        return $b;
    }

    private function gerant(string $email): User
    {
        return User::create([
            'name' => 'Gérant '.$email,
            'email' => $email,
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);
    }

    private function venteTerminee(Boutique $boutique, int $montant): Vente
    {
        return Vente::create([
            'montant_total' => $montant,
            'tva' => 0,
            'remise' => 0,
            'user_id' => $this->proprietaire->id,
            'statut' => 'termine',
            'boutique_id' => $boutique->id,
            'created_at' => now(),
        ]);
    }

    private function lancerLeJob(): void
    {
        app(SendDailyReportsJob::class)->handle(app(EmailService::class));
    }

    // -------------------------------------------------- colonnes absentes

    public function test_les_colonnes_de_reglage_citees_n_existent_vraiment_pas(): void
    {
        // Garde-fou : si quelqu'un ajoute un jour ces colonnes à la migration,
        // ce test échoue et l'oblige à revoir routes/console.php au lieu de
        // laisser un réglage fantôme repartir pour un tour.
        $colonnes = Schema::getColumnListing('boutique_settings');

        $this->assertNotContains('alertes_stock_actives', $colonnes);
        $this->assertNotContains('rapport_quotidien_actif', $colonnes);
    }

    public function test_un_attribut_absent_ne_leve_pas_et_ne_donne_pas_de_fausse_confiance(): void
    {
        // C'est le mécanisme qui rendait les deux bugs invisibles : l'accès
        // renvoie null silencieusement, et null ?? defaut redonne le défaut.
        $reglages = BoutiqueSetting::current();

        $this->assertNull($reglages->alertes_stock_actives);
        $this->assertNull($reglages->rapport_quotidien_actif);
    }

    public function test_le_code_du_schedule_ne_reference_plus_aucun_reglage_fantome(): void
    {
        // On retire les commentaires : ils mentionnent volontairement les
        // noms pour documenter la suppression, mais le code ne doit plus y
        // toucher.
        $code = $this->codeSansCommentaires(base_path('routes/console.php'));

        $this->assertStringNotContainsString('alertes_stock_actives', $code);
        $this->assertStringNotContainsString('rapport_quotidien_actif', $code);
        $this->assertStringNotContainsString('BoutiqueSetting', $code,
            'Le planning ne doit plus lire le singleton legacy.');
    }

    public function test_le_schedule_se_resout_entierement(): void
    {
        // schedule:list résout chaque événement. Si un closure référençait une
        // classe supprimée, ou un job un service renommé, c'est ici que ça
        // remonte — pas à 8h du matin en production.
        // On vérifie la commande et non la description : schedule:list affiche
        // « php artisan <commande> » pour un Schedule::command(), et n'affiche
        // la description que pour les Schedule::job().
        $this->artisan('schedule:list')
            ->expectsOutputToContain('Envoyer le rapport quotidien par boutique')
            ->expectsOutputToContain('Envoyer alertes stock automatiques aux gérants')
            ->expectsOutputToContain('php artisan sgci:regenerer-pdf-factures')
            ->assertSuccessful();
    }

    // -------------------------------------------------- rapport quotidien

    public function test_le_rapport_quotidien_est_bien_emise_par_boutique(): void
    {
        $gerantA = $this->gerant('gerant-a@sgci.bj');
        $gerantB = $this->gerant('gerant-b@sgci.bj');

        $boutiqueA = $this->boutique('Agence Alpha', $gerantA);
        $boutiqueB = $this->boutique('Agence Beta', $gerantB);

        $this->venteTerminee($boutiqueA, 10000);
        $this->venteTerminee($boutiqueB, 40000);

        $this->lancerLeJob();

        $this->assertCount(2, $this->rapportsRecus);

        $alpha = $this->rapportPour($gerantA->id);
        $beta = $this->rapportPour($gerantB->id);

        // Chaque gérant voit le CA de SA boutique, pas le total des deux.
        // C'était le bug d'origine : aucun filtre boutique_id.
        $this->assertSame(1, $alpha['stats']['nombre_ventes']);
        $this->assertEquals(10000, $alpha['stats']['ca_total']);
        $this->assertEquals(10000, $alpha['stats']['panier_moyen']);

        $this->assertSame(1, $beta['stats']['nombre_ventes']);
        $this->assertEquals(40000, $beta['stats']['ca_total']);
        $this->assertEquals(40000, $beta['stats']['panier_moyen']);

        // La boutique est transmise, pour que le mail soit nommé.
        $this->assertSame($boutiqueA->id, $alpha['boutique']->id);
        $this->assertSame($boutiqueB->id, $beta['boutique']->id);
    }

    public function test_un_gerant_de_deux_agences_recoit_deux_rapports_differents(): void
    {
        $gerant = $this->gerant('gerant-double@sgci.bj');

        $boutiqueA = $this->boutique('Agence Un', $gerant);
        $boutiqueB = $this->boutique('Agence Deux', $gerant);

        $this->venteTerminee($boutiqueA, 10000);
        $this->venteTerminee($boutiqueB, 40000);

        $this->lancerLeJob();

        $this->assertCount(2, $this->rapportsRecus);

        // Cast explicite : une colonne DECIMAL est renvoyée en chaîne par
        // MySQL/MariaDB (« 10000.00 ») et en flottant par SQLite. Sans ce
        // cast, l'assertion ne passe que sur le moteur qui a servi à
        // l'écrire, et le test devient un faux négatif de portabilité.
        $ca = array_map(fn ($r) => (float) $r['stats']['ca_total'], iterator_to_array($this->rapportsRecus));
        sort($ca);

        $this->assertSame([10000.0, 40000.0], $ca);

        // Régression de l'ancien code : il itérait sur les gérants globaux et
        // recalculait à chaque fois le total de TOUTES les agences, sans
        // filtre. Le gérant de deux agences recevait donc 50 000 deux fois.
        $caGlobal = Vente::terminees()->duJour()->sum('montant_total');
        $this->assertEquals(50000, $caGlobal);
        $this->assertNotContains($caGlobal, $ca);
    }

    public function test_une_boutique_sans_gerant_actif_reporte_a_son_proprietaire(): void
    {
        $this->boutique('Agence Sans Gerant');

        $this->lancerLeJob();

        $this->assertCount(1, $this->rapportsRecus);
        $this->assertSame($this->proprietaire->id, $this->rapportsRecus[0]['user']->id);
    }

    public function test_un_gerant_inactif_ne_bloque_pas_la_remise_au_proprietaire(): void
    {
        $gerant = $this->gerant('gerant-pale@sgci.bj');
        $gerant->update(['est_actif' => false]);

        $this->boutique('Agence Gerant Pale', $gerant);

        $this->lancerLeJob();

        $this->assertCount(1, $this->rapportsRecus);
        $this->assertSame($this->proprietaire->id, $this->rapportsRecus[0]['user']->id);
    }

    public function test_un_proprietaire_inactif_ne_recoit_pas_de_rapport(): void
    {
        $this->proprietaire->update(['est_actif' => false]);
        $this->boutique('Agence Orpheline');

        $this->lancerLeJob();

        $this->assertCount(0, $this->rapportsRecus);
    }

    public function test_les_ventes_hors_du_jour_sont_exclues_du_rapport(): void
    {
        $gerant = $this->gerant('gerant-boucage@sgci.bj');
        $boutique = $this->boutique('Agence Bouclée', $gerant);

        $this->venteTerminee($boutique, 10000);

        $ancienne = $this->venteTerminee($boutique, 999000);

        // created_at n'est pas fillable : il faut repasser par l'update, sinon
        // Eloquent le réécrit avec now() et le test ne teste rien.
        $ancienne->forceFill(['created_at' => now()->subDays(3)])->save();

        $this->lancerLeJob();

        $this->assertCount(1, $this->rapportsRecus);
        $this->assertSame(1, $this->rapportsRecus[0]['stats']['nombre_ventes']);
        $this->assertEquals(10000, $this->rapportsRecus[0]['stats']['ca_total']);
    }

    // -------------------------------------------------- contenu du mail

    public function test_le_rapport_est_envoye_avec_le_nom_de_la_boutique(): void
    {
        // Pas de Mail::fake() ici : MailFake::send() ignore tout ce qui n'est
        // pas une instance de Mailable, donc un Mail::send('vue', $data) y est
        // un no-op silencieux. Un assertSentCount aurait donc toujours passé
        // vert sans prouver quoi que ce soit. On intercepte l'appel réel.
        Mail::shouldReceive('send')
            ->once()
            ->withArgs(function ($vue, $donnees) {
                return $vue === 'emails.daily-report'
                    && $donnees['boutique_name'] === 'Agence Nominale'
                    && $donnees['nombre_ventes'] === 1
                    && $donnees['ca_total'] === 100;
            })
            ->andReturnNull();

        $boutique = $this->boutique('Agence Nominale');

        $res = (new EmailService)->sendDailyReport(
            $this->proprietaire,
            ['nombre_ventes' => 1, 'ca_total' => 100, 'panier_moyen' => 100],
            $boutique,
        );

        $this->assertTrue($res['success']);
    }

    public function test_le_rapport_revit_sur_le_nom_de_l_app_quand_la_boutique_est_absente(): void
    {
        Mail::shouldReceive('send')
            ->once()
            ->withArgs(function ($vue, $donnees) {
                return $vue === 'emails.daily-report'
                    && $donnees['boutique_name'] === config('app.name');
            })
            ->andReturnNull();

        $res = (new EmailService)->sendDailyReport(
            $this->proprietaire,
            ['nombre_ventes' => 0, 'ca_total' => 0, 'panier_moyen' => 0],
        );

        $this->assertTrue($res['success']);
    }

    public function test_un_echec_d_envoi_est_signale_sans_faire_echouer_le_job(): void
    {
        // Le mail ne doit pas interrompre la boucle sur les autres boutiques.
        Mail::shouldReceive('send')->once()->andThrow(new \RuntimeException('SMTP down'));

        $res = (new EmailService)->sendDailyReport(
            $this->proprietaire,
            ['nombre_ventes' => 1, 'ca_total' => 100, 'panier_moyen' => 100],
            $this->boutique('Agence SMTP'),
        );

        $this->assertFalse($res['success']);
        $this->assertStringContainsString('SMTP down', $res['error']);
    }

    public function test_la_vue_du_rapport_affiche_le_nom_de_la_boutique(): void
    {
        // Vérification du rendu réel : le nom vient bien de boutique_name, et
        // non d'un fallback codé en dur dans la vue.
        $html = view('emails.daily-report', [
            'user_name' => 'Gérard',
            'boutique_name' => 'Agence Nominale',
            'nombre_ventes' => 1,
            'ca_total' => 100,
            'panier_moyen' => 100,
            'date' => now()->format('d/m/Y'),
        ])->render();

        $this->assertStringContainsString('Agence Nominale', $html);
        $this->assertStringContainsString('Gérard', $html);
        $this->assertStringContainsString('100', $html);
    }

    // -------------------------------------------------- logs de facturation

    public function test_une_facturation_impossible_est_tracee_puis_relancee(): void
    {
        // Le catch ne doit jamais avaler l'exception : une facture non
        // générée qui renvoyait un succès apparent serait pire que l'absence
        // de log. On vise le premierOrFail() sous verrou, qui est le vrai
        // point d'échec quand la ligne a disparu entre-temps.
        Log::spy();

        $vente = $this->venteTerminee($this->boutique('Agence Facture'), 5000);
        $vente->delete();

        try {
            app(FacturationService::class)->genererFactureVente($vente);
            $this->fail('Une facturation impossible doit lever une exception.');
        } catch (\Throwable $e) {
            $this->assertInstanceOf(ModelNotFoundException::class, $e);
        }

        Log::shouldHaveReceived('error')
            ->withArgs(fn ($message, $context) => $message === 'Erreur lors de la génération de la facture de vente'
                && ($context['vente_id'] ?? null) === $vente->id);
    }

    public function test_une_facturation_de_commande_impossible_est_elle_aussi_tracee(): void
    {
        // Le même traitement doit couvrir les deux générateurs : une commande
        // facturée sans trace resterait invisible en support.
        Log::spy();

        $commande = new CommandeClient;

        try {
            app(FacturationService::class)->genererFactureCommande($commande);
            $this->fail('Une facturation impossible doit lever une exception.');
        } catch (\Throwable $e) {
            $this->assertInstanceOf(ModelNotFoundException::class, $e);
        }

        Log::shouldHaveReceived('error')
            ->withArgs(fn ($message) => $message === 'Erreur lors de la génération de la facture de commande');
    }

    // -------------------------------------------------- utilitaires

    private function rapportPour(int $userId): array
    {
        foreach ($this->rapportsRecus as $rapport) {
            if ($rapport['user']->id === $userId) {
                return $rapport;
            }
        }

        $this->fail("Aucun rapport reçu pour l'utilisateur {$userId}.");
    }

    private function codeSansCommentaires(string $chemin): string
    {
        $lignes = file($chemin, FILE_IGNORE_NEW_LINES);

        return implode("\n", array_filter($lignes, fn ($l) => ! str_starts_with(trim($l), '//')));
    }
}
