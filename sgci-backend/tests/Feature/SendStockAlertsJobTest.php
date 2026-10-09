<?php

namespace Tests\Feature;

use App\Jobs\SendStockAlertsJob;
use App\Models\Boutique;
use App\Models\Categorie;
use App\Models\Produit;
use App\Models\User;
use App\Services\EmailService;
use App\Services\FcmService;
use App\Services\SmsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

/**
 * Ces tests remplacent les deux « tests » de JobsTest qui affirmaient
 * assertTrue(true) sans rattacher le gérant à une boutique : le job n'avait
 * donc aucun destinataire et ne testait rien. Le job est le seul endroit où
 * l'on décide QUI reçoit une alerte de rupture, donc il mérite une couverture
 * réelle.
 */
class SendStockAlertsJobTest extends TestCase
{
    use RefreshDatabase;

    private User $proprietaire;

    /** @var array<int, array{canal:string, produit:string, destinataire:int}> */
    private array $envois = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->sansProvisionnerBoutique();
        $this->envois = [];

        $this->proprietaire = $this->utilisateur('Proprio', 'proprio@sgci.bj', 'proprietaire');
    }

    // -------------------------------------------------- harnais

    private function utilisateur(string $nom, string $email, string $role): User
    {
        return User::create([
            'name' => $nom,
            'email' => $email,
            'password' => Hash::make('password'),
            'role' => $role,
            'est_actif' => true,
        ]);
    }

    private function boutique(string $nom, ?User $gerant = null): Boutique
    {
        $boutique = Boutique::create([
            'nom' => $nom,
            'proprietaire_id' => $this->proprietaire->id,
        ]);
        $boutique->users()->attach($this->proprietaire->id, ['role_dans_boutique' => 'proprietaire']);

        if ($gerant) {
            $boutique->users()->attach($gerant->id, ['role_dans_boutique' => 'gerant']);
            $gerant->forceFill(['current_boutique_id' => $boutique->id])->save();
        }

        return $boutique;
    }

    private function produitEnAlerte(Boutique $boutique, string $nom, int $stock = 2): Produit
    {
        $categorie = Categorie::firstOrCreate(['nom' => 'Catégorie Test']);

        return Produit::create([
            'nom' => $nom,
            'description' => 'Description',
            'prix' => 1000,
            'quantite_stock' => $stock,
            'seuil_alerte' => 10,
            'categorie_id' => $categorie->id,
            'unite_mesure' => 'unite',
            'boutique_id' => $boutique->id,
        ]);
    }

    /**
     * Doublures d'enregistrement. Elles étendent les vrais services pour rester
     * interchangeables, et se contentent de noter l'envoi au lieu d'appeler
     * SMTP, FCM ou un fournisseur SMS. Un canal en échec est noté puis
     * relancé : seule une notification aboutie entre dans $this->envois.
     */
    private function email(?\Throwable $echec = null): EmailService
    {
        return new class($this, $echec) extends EmailService
        {
            public function __construct(private SendStockAlertsJobTest $test, private ?\Throwable $echec) {}

            public function sendStockAlert(User $user, string $productName, int $currentStock, int $threshold): array
            {
                if ($this->echec) {
                    throw $this->echec;
                }

                $this->test->enregistrer('email', $productName, $user->id);

                return ['success' => true, 'message' => 'ok'];
            }
        };
    }

    private function fcm(?\Throwable $echec = null): FcmService
    {
        return new class($this, $echec) extends FcmService
        {
            public function __construct(private SendStockAlertsJobTest $test, private ?\Throwable $echec) {}

            public function sendStockAlert(User $user, string $productName, int $currentStock): array
            {
                if ($this->echec) {
                    throw $this->echec;
                }

                $this->test->enregistrer('fcm', $productName, $user->id);

                return ['success' => true, 'message' => 'ok'];
            }
        };
    }

    private function sms(): SmsService
    {
        return new class extends SmsService
        {
            public function __construct() {}
        };
    }

    public function enregistrer(string $canal, string $produit, int $destinataire): void
    {
        $this->envois[] = compact('canal', 'produit', 'destinataire');
    }

    private function lancer(?EmailService $email = null, ?FcmService $fcm = null, ?SmsService $sms = null): void
    {
        (new SendStockAlertsJob)->handle(
            $email ?? $this->email(),
            $fcm ?? $this->fcm(),
            $sms ?? $this->sms(),
        );
    }

    private function canauxPour(string $produit): array
    {
        return array_values(array_filter(
            array_column(array_filter($this->envois, fn ($e) => $e['produit'] === $produit), 'canal'),
        ));
    }

    // -------------------------------------------------- tests

    public function test_le_gerant_est_bien_averti_pour_un_produit_en_rupture_de_sa_boutique(): void
    {
        $gerant = $this->utilisateur('Gérant A', 'gerant-a@sgci.bj', 'gerant');
        $boutique = $this->boutique('Agence Alpha', $gerant);

        $this->produitEnAlerte($boutique, 'Ciment', stock: 0);

        $this->lancer();

        // Email ET push, pour le gérant ET le propriétaire de la boutique.
        $this->assertSame(['email', 'fcm', 'email', 'fcm'], $this->canauxPour('Ciment'));

        // L'ordre des destinataires n'est pas garanti (pas de ORDER BY) : on
        // compare donc des ensembles triés.
        $attendus = [$gerant->id, $this->proprietaire->id];
        sort($attendus);

        $destinataires = array_values(array_unique(array_column($this->envois, 'destinataire')));
        sort($destinataires);

        $this->assertSame($attendus, $destinataires);
    }

    public function test_un_gerant_ne_recoit_rien_pour_les_produits_d_une_autre_boutique(): void
    {
        // Le job ne doit pas balancer le stock d'une agence au gérant d'une autre.
        $gerantA = $this->utilisateur('Gérant A', 'gerant-a@sgci.bj', 'gerant');
        $gerantB = $this->utilisateur('Gérant B', 'gerant-b@sgci.bj', 'gerant');

        $boutiqueA = $this->boutique('Agence Alpha', $gerantA);
        $boutiqueB = $this->boutique('Agence Beta', $gerantB);

        $this->produitEnAlerte($boutiqueA, 'Ciment');
        $this->produitEnAlerte($boutiqueB, 'Peinture');

        $this->lancer();

        $parDestinataire = [];
        foreach ($this->envois as $envoi) {
            $parDestinataire[$envoi['destinataire']][] = $envoi['produit'];
        }

        $this->assertSame(['Ciment'], array_values(array_unique($parDestinataire[$gerantA->id])));
        $this->assertSame(['Peinture'], array_values(array_unique($parDestinataire[$gerantB->id])));

        // Le propriétaire est destinataire des deux, puisqu'il détient les deux.
        $this->assertSame(['Ciment', 'Peinture'], array_values(array_unique($parDestinataire[$this->proprietaire->id])));
    }

    public function test_un_produit_sans_alerte_ne_donne_lieu_a_aucune_notification(): void
    {
        $gerant = $this->utilisateur('Gérant', 'gerant@sgci.bj', 'gerant');
        $boutique = $this->boutique('Agence', $gerant);

        $this->produitEnAlerte($boutique, 'Stock Suffisant', stock: 500);

        $this->lancer();

        $this->assertSame([], $this->envois);
    }

    public function test_un_produit_orphelin_ne_signale_nulle_part(): void
    {
        // Ni gérant au pivot, ni propriétaire actif : personne ne doit être
        // dérangé par un produit d'une boutique sans interlocuteur.
        $boutique = $this->boutique('Agence Sans Gérant');
        $this->produitEnAlerte($boutique, 'Ciment');

        $this->proprietaire->update(['est_actif' => false]);

        $this->lancer();

        $this->assertSame([], $this->envois);
    }

    public function test_le_proprietaire_est_bien_averti_quand_il_n_y_a_pas_de_gerant(): void
    {
        // Cas inverse : le propriétaire est le seul garant de l'information.
        $boutique = $this->boutique('Agence Sans Gérant');
        $this->produitEnAlerte($boutique, 'Ciment');

        $this->lancer();

        $this->assertSame(['email', 'fcm'], $this->canauxPour('Ciment'));
        $this->assertSame([$this->proprietaire->id, $this->proprietaire->id], array_column($this->envois, 'destinataire'));
    }

    public function test_un_gerant_inactif_est_exclu_mais_le_proprietaire_est_conserve(): void
    {
        $gerant = $this->utilisateur('Gérant Pâle', 'gerant-pale@sgci.bj', 'gerant');
        $boutique = $this->boutique('Agence', $gerant);
        $this->produitEnAlerte($boutique, 'Ciment');

        $gerant->update(['est_actif' => false]);

        $this->lancer();

        $destinataires = array_unique(array_column($this->envois, 'destinataire'));

        $this->assertNotContains($gerant->id, $destinataires);
        $this->assertContains($this->proprietaire->id, $destinataires);
    }

    // -------------------------------------------------- isolation

    public function test_un_push_en_echec_n_empeche_pas_l_email_ni_les_produits_suivants(): void
    {
        // Régression du défaut structurel : le try/catch global abandonnait tout
        // le lot dès le premier canal en panne, donc les ruptures suivantes
        // n'étaient jamais notifiées.
        $gerant = $this->utilisateur('Gérant', 'gerant@sgci.bj', 'gerant');
        $boutique = $this->boutique('Agence', $gerant);

        $this->produitEnAlerte($boutique, 'Premier', stock: 0);
        $this->produitEnAlerte($boutique, 'Second', stock: 1);
        $this->produitEnAlerte($boutique, 'Troisieme', stock: 3);

        $this->lancer(fcm: $this->fcm(new \RuntimeException('FCM indisponible')));

        // Les trois produits sont traités, et chacun par ses deux destinataires
        // (gérant + propriétaire), malgré la panne du push : aucun push n'est
        // arrivé à terme, aucun email n'a été perdu.
        $this->assertSame(['email', 'email'], $this->canauxPour('Premier'));
        $this->assertSame(['email', 'email'], $this->canauxPour('Second'));
        $this->assertSame(['email', 'email'], $this->canauxPour('Troisieme'));
        $this->assertSame(6, count($this->envois));
    }

    public function test_un_echec_est_trace_avec_le_produit_et_le_canal_concernes(): void
    {
        Log::spy();

        $gerant = $this->utilisateur('Gérant', 'gerant@sgci.bj', 'gerant');
        $boutique = $this->boutique('Agence', $gerant);
        $this->produitEnAlerte($boutique, 'Ciment');

        $this->lancer(fcm: $this->fcm(new \RuntimeException('FCM indisponible')));

        Log::shouldHaveReceived('error')
            ->withArgs(fn ($message, $contexte) => str_contains($message, 'fcm')
                && ($contexte['produit'] ?? null) === 'Ciment'
                && ($contexte['boutique_id'] ?? null) === $boutique->id);
    }

    public function test_le_sms_n_est_appele_que_si_le_canal_est_active(): void
    {
        config(['services.sms.enabled' => false]);

        $gerant = $this->utilisateur('Gérant', 'gerant@sgci.bj', 'gerant');
        $boutique = $this->boutique('Agence', $gerant);
        $this->produitEnAlerte($boutique, 'Ciment');

        $this->lancer();

        $this->assertNotContains('sms', $this->canauxPour('Ciment'));
    }

    public function test_un_produit_qui_echoue_completement_n_interrompt_pas_le_lot(): void
    {
        // Erreur au niveau produit (pas seulement au niveau canal) : le lot
        // doit continuer et le produit fautif être compté comme ignoré.
        Log::spy();

        $gerant = $this->utilisateur('Gérant', 'gerant@sgci.bj', 'gerant');
        $boutique = $this->boutique('Agence', $gerant);

        $this->produitEnAlerte($boutique, 'Premier');
        $this->produitEnAlerte($boutique, 'Second');

        $emailQuiExploseAuPremierProduit = new class($this) extends EmailService
        {
            private int $appels = 0;

            public function __construct(private SendStockAlertsJobTest $test) {}

            public function sendStockAlert(User $user, string $productName, int $currentStock, int $threshold): array
            {
                if ($this->appels++ === 0) {
                    throw new \RuntimeException('SMTP hors service');
                }

                $this->test->enregistrer('email', $productName, $user->id);

                return ['success' => true, 'message' => 'ok'];
            }
        };

        $this->lancer(email: $emailQuiExploseAuPremierProduit);

        // Le second produit a bien été notifié malgré l'échec du premier.
        $this->assertNotEmpty(array_filter($this->envois, fn ($e) => $e['produit'] === 'Second'));

        Log::shouldHaveReceived('error');
    }
}
