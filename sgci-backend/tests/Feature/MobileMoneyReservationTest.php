<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\CommandeClient;
use App\Models\Paiement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Idempotence et issue des paiements Mobile Money.
 *
 * Le risque qui motive ce fichier est un double débit : sans barrière, un
 * timeout ou un double-tap créait une seconde ligne Paiement et déclenchait une
 * seconde demande de débit au prestataire. Le `external_id` envoyé n'y change
 * rien, puisqu'il était dérivé du numéro de la ligne qu'on venait de créer —
 * donc différent à chaque appel, et le prestataire ne pouvait rien dédoublonner.
 *
 * Second risque, symétrique : marquer « échoué » un paiement dont l'issue est
 * inconnue. Les transitions automatiques ne partant que d'un « en_attente », un
 * encaissement réel survenu après un timeout n'était jamais crédité sur la
 * commande — l'argent était pris, la dette restait ouverte.
 */
class MobileMoneyReservationTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Boutique $boutique;

    private User $proprietaire;

    protected function setUp(): void
    {
        parent::setUp();

        $this->sansProvisionnerBoutique();

        config()->set('services.mobile_money.callback_secret', 'secret-callback-test');

        $this->proprietaire = User::create([
            'name' => 'Propriétaire MoMo',
            'email' => 'proprio-idempotence@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'proprietaire',
            'est_actif' => true,
        ]);

        $this->boutique = Boutique::create([
            'nom' => 'Boutique Idempotence',
            'adresse' => 'Cotonou',
            'devise' => 'XOF',
            'proprietaire_id' => $this->proprietaire->id,
        ]);

        $this->user = User::create([
            'name' => 'Gérant MoMo',
            'email' => 'gerant-idempotence@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);
        $this->user->forceFill(['current_boutique_id' => $this->boutique->id])->save();
        $this->boutique->users()->attach($this->user->id, ['role_dans_boutique' => 'gerant']);
    }

    // -------------------------------------------------- idempotence

    public function test_le_rejeu_de_la_meme_cle_ne_declenche_pas_un_second_debit(): void
    {
        Http::fake([
            '*/oauth/token' => Http::response(['access_token' => 'token-test'], 200),
            '*' => Http::response(['transaction_id' => 'TX-IDEM'], 200),
        ]);

        Sanctum::actingAs($this->user);

        $premier = $this->postJson('/api/mobile-money/initiate', $this->charge([
            'idempotency_key' => 'caisse-1-paiement-42',
        ]));

        $premier->assertOk();

        $second = $this->postJson('/api/mobile-money/initiate', $this->charge([
            'idempotency_key' => 'caisse-1-paiement-42',
        ]));

        $second->assertOk()->assertJsonPath('idempotent', true);

        $this->assertSame(1, Paiement::count(), 'Le rejeu ne doit pas créer une seconde ligne.');

        // Le point central : un seul appel de débit au prestataire.
        $appelsDebit = collect(Http::recorded())
            ->filter(fn (array $e) => str_contains($e[0]->url(), '/payments'))
            ->count();

        $this->assertSame(1, $appelsDebit, 'Le prestataire ne doit être appelé qu\'une fois.');
        $this->assertSame(
            $premier->json('data.paiement.numero_paiement'),
            $second->json('data.paiement.numero_paiement'),
            'Le rejeu doit rendre le paiement d\'origine.',
        );
    }

    public function test_la_cle_ne_bloque_pas_les_autres_boutiques(): void
    {
        Http::fake([
            '*/oauth/token' => Http::response(['access_token' => 'token-test'], 200),
            '*' => Http::response(['transaction_id' => 'TX-IDEM'], 200),
        ]);

        $autre = Boutique::create([
            'nom' => 'Boutique Voisine',
            'devise' => 'XOF',
            'proprietaire_id' => $this->proprietaire->id,
        ]);

        $caissierAutre = User::create([
            'name' => 'Caissier Voisin',
            'email' => 'voisin-idempotence@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'caissier',
            'est_actif' => true,
        ]);
        $caissierAutre->forceFill(['current_boutique_id' => $autre->id])->save();
        $autre->users()->attach($caissierAutre->id, ['role_dans_boutique' => 'caissier']);

        $charge = $this->charge(['idempotency_key' => 'cle-partagee']);

        Sanctum::actingAs($this->user);
        $this->postJson('/api/mobile-money/initiate', $charge)->assertOk();

        Sanctum::actingAs($caissierAutre);
        $this->postJson('/api/mobile-money/initiate', $charge)->assertOk();

        $this->assertSame(2, Paiement::count(),
            'Une clé d\'idempotence est propre au client : elle ne doit pas bloquer un autre tenant.');
    }

    public function test_sans_cle_un_doublon_recent_est_reutilise(): void
    {
        Http::fake([
            '*/oauth/token' => Http::response(['access_token' => 'token-test'], 200),
            '*' => Http::response(['transaction_id' => 'TX-DOUBLON'], 200),
        ]);

        Sanctum::actingAs($this->user);

        $this->postJson('/api/mobile-money/initiate', $this->charge())->assertOk();
        $this->postJson('/api/mobile-money/initiate', $this->charge())
            ->assertOk()
            ->assertJsonPath('idempotent', true);

        $this->assertSame(1, Paiement::count());
        $this->assertSame(1, collect(Http::recorded())
            ->filter(fn (array $e) => str_contains($e[0]->url(), '/payments'))
            ->count());
    }

    public function test_sans_cle_hors_fenetre_deux_paiements_sont_legitimes(): void
    {
        Http::fake([
            '*/oauth/token' => Http::response(['access_token' => 'token-test'], 200),
            '*' => Http::response(['transaction_id' => 'TX-LEGIT'], 200),
        ]);

        Sanctum::actingAs($this->user);

        $this->postJson('/api/mobile-money/initiate', $this->charge())->assertOk();

        $this->travel(200)->seconds();

        $this->postJson('/api/mobile-money/initiate', $this->charge())
            ->assertOk()
            ->assertJsonPath('idempotent', null);

        $this->assertSame(2, Paiement::count(),
            'Deux encaissements identiques espacés sont deux paiements réels, pas un doublon.');
    }

    public function test_un_paiement_hors_fenetre_but_en_attente_ne_bloque_plus(): void
    {
        Http::fake([
            '*/oauth/token' => Http::response(['access_token' => 'token-test'], 200),
            '*' => Http::response(['transaction_id' => 'TX-ANCIEN'], 200),
        ]);

        Sanctum::actingAs($this->user);

        $this->postJson('/api/mobile-money/initiate', $this->charge())->assertOk();

        $this->travel(200)->seconds();
        $this->postJson('/api/mobile-money/initiate', $this->charge())->assertOk();

        $this->assertSame(2, Paiement::count());
    }

    public function test_deux_cles_differentes_donnent_deux_paiements(): void
    {
        Http::fake([
            '*/oauth/token' => Http::response(['access_token' => 'token-test'], 200),
            '*' => Http::response(['transaction_id' => 'TX-DISTINCT'], 200),
        ]);

        Sanctum::actingAs($this->user);

        $this->postJson('/api/mobile-money/initiate', $this->charge(['idempotency_key' => 'a']))->assertOk();
        $this->postJson('/api/mobile-money/initiate', $this->charge(['idempotency_key' => 'b']))->assertOk();

        $this->assertSame(2, Paiement::count());
    }

    public function test_la_course_entre_deux_requetes_ne_produit_pas_d_erreur_500(): void
    {
        Http::fake([
            '*/oauth/token' => Http::response(['access_token' => 'token-test'], 200),
            '*' => Http::response(['transaction_id' => 'TX-RACE'], 200),
        ]);

        Sanctum::actingAs($this->user);

        // Simule la requête perdante : la lecture préalable passe, puis une
        // requête concurrente insère la clé gagnante entre cette lecture et
        // l'INSERT. Seul l'index UNIQUE voit la collision.
        $concurrent = false;

        Paiement::creating(function () use (&$concurrent) {
            if ($concurrent) {
                return;
            }

            $concurrent = true;

            Paiement::withoutEvents(fn () => Paiement::create([
                'numero_paiement' => 'PAY-RACE-0001',
                'idempotency_key' => 'k-race',
                'boutique_id' => $this->boutique->id,
                'montant' => 5000,
                'mode_paiement' => 'mobile_money_orange',
                'telephone' => '97000000',
                'date_paiement' => now(),
                'statut' => 'en_attente',
                'user_id' => $this->user->id,
            ]));
        });

        $reponse = $this->postJson('/api/mobile-money/initiate', $this->charge([
            'idempotency_key' => 'k-race',
        ]));

        $reponse->assertOk()->assertJsonPath('idempotent', true);

        $this->assertSame('PAY-RACE-0001', $reponse->json('data.paiement.numero_paiement'),
            'La requête perdante doit rendre le paiement gagnant, pas une erreur.');
        $this->assertSame(1, Paiement::count());
    }

    // -------------------------------------------------- issue inconnue

    public function test_une_coupure_reseau_laisse_le_paiement_en_attente(): void
    {
        Http::fake([
            '*/oauth/token' => Http::response(['access_token' => 'token-test'], 200),
            '*' => Http::response(fn () => throw new ConnectionException('coupure réseau')),
        ]);

        Sanctum::actingAs($this->user);

        $this->postJson('/api/mobile-money/initiate', $this->charge())
            ->assertStatus(502)
            ->assertJsonPath('issue_connue', false);

        $this->assertSame('en_attente', Paiement::firstOrFail()->statut,
            'Un timeout ne prouve pas que le paiement a échoué : le clôturer perdrait un encaissement réel.');
    }

    public function test_une_erreur_serveur_laisse_le_paiement_en_attente(): void
    {
        Http::fake([
            '*/oauth/token' => Http::response(['access_token' => 'token-test'], 200),
            '*' => Http::response(['error' => 'upstream'], 500),
        ]);

        Sanctum::actingAs($this->user);

        $this->postJson('/api/mobile-money/initiate', $this->charge())
            ->assertStatus(502)
            ->assertJsonPath('issue_connue', false);

        $this->assertSame('en_attente', Paiement::firstOrFail()->statut);
    }

    public function test_un_refus_explicite_clot_le_paiement_et_la_cle_rejoue_le_meme_echec(): void
    {
        Http::fake([
            '*/oauth/token' => Http::response(['access_token' => 'token-test'], 200),
            '*' => Http::response(['error' => 'insufficient_funds'], 402),
        ]);

        Sanctum::actingAs($this->user);

        $this->postJson('/api/mobile-money/initiate', $this->charge(['idempotency_key' => 'k-402']))
            ->assertStatus(400);

        $this->assertSame('echoue', Paiement::firstOrFail()->statut);

        // La clé identifie l'opération, pas seulement son succès : la rejouer
        // rend le même échec sans redébit. Relancer un encaissement est une
        // nouvelle intention, donc une nouvelle clé.
        $rejeu = $this->postJson('/api/mobile-money/initiate', $this->charge(['idempotency_key' => 'k-402']));

        $rejeu->assertOk()->assertJsonPath('idempotent', true);
        $this->assertSame(1, Paiement::count());

        $this->postJson('/api/mobile-money/initiate', $this->charge(['idempotency_key' => 'k-402-bis']))
            ->assertStatus(400);

        $this->assertSame(2, Paiement::count());
    }

    public function test_apres_une_issue_inconnue_le_rejeu_ne_recharge_pas(): void
    {
        Http::fake([
            '*/oauth/token' => Http::response(['access_token' => 'token-test'], 200),
            '*' => Http::response(fn () => throw new ConnectionException('coupure réseau')),
        ]);

        Sanctum::actingAs($this->user);

        $this->postJson('/api/mobile-money/initiate', $this->charge(['idempotency_key' => 'k-inconnu']))
            ->assertStatus(502);

        $this->postJson('/api/mobile-money/initiate', $this->charge(['idempotency_key' => 'k-inconnu']))
            ->assertOk()
            ->assertJsonPath('idempotent', true);

        $this->assertSame(1, Paiement::count(),
            'Rejouer après un timeout est le moment où un second débit serait le plus probable.');
    }

    public function test_un_encaissement_tardif_reste_creditable(): void
    {
        // Le prestataire répond tard : l'API a rendu la main, mais le client
        // paie. Le callback de succès doit encore créditer la commande.
        Http::fake([
            '*/oauth/token' => Http::response(['access_token' => 'token-test'], 200),
            '*' => Http::response(fn () => throw new ConnectionException('délai dépassé')),
        ]);

        Sanctum::actingAs($this->user);

        $commande = $this->commande(10000);

        $this->postJson('/api/mobile-money/initiate', $this->charge([
            'commande_client_id' => $commande->id,
            'idempotency_key' => 'k-tardif',
        ]))->assertStatus(502);

        $paiement = Paiement::firstOrFail();
        $paiement->update(['reference_transaction' => 'TX-TARDIF']);

        $signature = hash_hmac('sha256', json_encode([
            'transaction_id' => 'TX-TARDIF',
            'status' => 'successful',
        ]), 'secret-callback-test');

        $this->call(
            'POST',
            '/api/mobile-money/callback',
            [],
            [],
            [],
            $this->transformHeadersToServerVars([
                'CONTENT_TYPE' => 'application/json',
                'X-SGCI-Signature' => $signature,
            ]),
            json_encode(['transaction_id' => 'TX-TARDIF', 'status' => 'successful'])
        )->assertOk();

        $this->assertSame('reussi', $paiement->fresh()->statut);
        $this->assertSame('5000.00', $commande->fresh()->montant_paye,
            'L\'argent a bien été pris : la commande doit être créditée.');
    }

    public function test_une_initiation_sans_reference_ne_clot_pas_le_paiement(): void
    {
        Http::fake([
            '*/oauth/token' => Http::response(['access_token' => 'token-test'], 200),
            '*' => Http::response(['status' => 'accepted'], 200),
        ]);

        Sanctum::actingAs($this->user);

        $reponse = $this->postJson('/api/mobile-money/initiate', $this->charge())->assertStatus(502);

        $this->assertStringContainsString('non traçable', (string) $reponse->json('message'));

        $paiement = Paiement::firstOrFail();

        $this->assertSame('en_attente', $paiement->statut);
        $this->assertNull($paiement->reference_transaction);
    }

    // -------------------------------------------------- bornes de montant

    public function test_un_montant_superieur_au_reste_a_payer_est_refuse(): void
    {
        Http::fake();
        Sanctum::actingAs($this->user);

        $commande = $this->commande(10000);
        $commande->update(['montant_paye' => 6000]);

        $this->postJson('/api/mobile-money/initiate', $this->charge([
            'amount' => 5000,
            'commande_client_id' => $commande->id,
        ]))
            ->assertStatus(400)
            ->assertJsonPath('reste_a_payer', 4000);

        $this->assertSame(0, Paiement::count(), 'Un refus de montant ne doit créer aucun paiement.');
        $this->assertSame('6000.00', $commande->fresh()->montant_paye);
    }

    public function test_un_montant_egal_au_reste_a_payer_est_accepte(): void
    {
        Http::fake([
            '*/oauth/token' => Http::response(['access_token' => 'token-test'], 200),
            '*' => Http::response(['transaction_id' => 'TX-SOLDE'], 200),
        ]);

        Sanctum::actingAs($this->user);

        $commande = $this->commande(10000);
        $commande->update(['montant_paye' => 6000]);

        $this->postJson('/api/mobile-money/initiate', $this->charge([
            'amount' => 4000,
            'commande_client_id' => $commande->id,
        ]))->assertOk();

        $this->assertSame(1, Paiement::count());
    }

    public function test_le_reste_a_payer_d_une_commande_inclut_la_tva(): void
    {
        Http::fake([
            '*/oauth/token' => Http::response(['access_token' => 'token-test'], 200),
            '*' => Http::response(['transaction_id' => 'TX-TTC'], 200),
        ]);

        Sanctum::actingAs($this->user);

        // base HT 10 000 + TVA 18 % (1 800) → le client doit 11 800.
        // Sans l'accesseur TTC, le garde lisait un reste de 10 000 et
        // refusait un paiement parfaitement normal (ou laissait passer un
        // paiement ne couvrant pas la dette).
        $commande = $this->commande(10000);
        $commande->update(['tva' => 1800]);

        $this->postJson('/api/mobile-money/initiate', $this->charge([
            'amount' => 11900,
            'commande_client_id' => $commande->id,
        ]))
            ->assertStatus(400)
            ->assertJsonPath('reste_a_payer', 11800);

        $this->assertSame(0, Paiement::count());

        // Le montant exact du TTC dû passe la garde.
        $this->postJson('/api/mobile-money/initiate', $this->charge([
            'amount' => 11800,
            'commande_client_id' => $commande->id,
        ]))->assertOk();

        $this->assertSame(1, Paiement::count());
    }

    public function test_le_montant_reste_libre_sans_commande_associate(): void
    {
        Http::fake([
            '*/oauth/token' => Http::response(['access_token' => 'token-test'], 200),
            '*' => Http::response(['transaction_id' => 'TX-LIBRE'], 200),
        ]);

        Sanctum::actingAs($this->user);

        $this->postJson('/api/mobile-money/initiate', $this->charge(['amount' => 250000]))->assertOk();

        $this->assertSame(1, Paiement::count());
    }

    public function test_payer_une_commande_annulee_est_refuse(): void
    {
        Http::fake();
        Sanctum::actingAs($this->user);

        $commande = $this->commande(10000);
        $commande->update(['statut' => 'annule']);

        $this->postJson('/api/mobile-money/initiate', $this->charge([
            'commande_client_id' => $commande->id,
        ]))->assertStatus(400);

        $this->assertSame(0, Paiement::count());
    }

    // -------------------------------------------------- références nulles

    public function test_check_status_refuse_un_paiement_sans_reference(): void
    {
        Http::fake();

        Sanctum::actingAs($this->user);

        $commande = $this->commande(10000);
        $paiement = $this->paiement($commande, ['reference_transaction' => null]);

        $this->getJson('/api/mobile-money/status/'.$paiement->numero_paiement)->assertStatus(409);

        $this->assertSame('en_attente', $paiement->fresh()->statut);
        $this->assertCount(0, Http::recorded(),
            'Aucun appel prestataire ne doit partir sur une référence vide.');
    }

    public function test_cancel_refuse_un_paiement_sans_reference(): void
    {
        Http::fake();

        Sanctum::actingAs($this->user);

        $commande = $this->commande(10000);
        $paiement = $this->paiement($commande, ['reference_transaction' => null]);

        $this->postJson('/api/mobile-money/cancel/'.$paiement->numero_paiement)->assertStatus(409);

        $this->assertSame('en_attente', $paiement->fresh()->statut);
        $this->assertCount(0, Http::recorded());
    }

    public function test_le_numero_debite_est_trace(): void
    {
        Http::fake([
            '*/oauth/token' => Http::response(['access_token' => 'token-test'], 200),
            '*' => Http::response(['transaction_id' => 'TX-AUDIT'], 200),
        ]);

        Sanctum::actingAs($this->user);

        $this->postJson('/api/mobile-money/initiate', $this->charge([
            'phone_number' => '97000000',
        ]))->assertOk();

        $this->assertSame('97000000', Paiement::firstOrFail()->telephone,
            'Sans le numéro débité, aucun rapprochement après incident n\'est possible.');
    }

    // -------------------------------------------------- reservation

    public function test_un_paiement_en_attente_reserve_le_reste_a_payer(): void
    {
        // Les paiements « en_attente » sont des réservations : tant qu'ils ne
        // sont ni confirmés ni échoués, leur montant immobilise la dette. Sinon
        // un second règlement (clé d'idempotence différente, donc non dédoublonné)
        // pouvait être initié sur le même reste et faire payer la commande deux
        // fois.
        Http::fake([
            '*/oauth/token' => Http::response(['access_token' => 'token-test'], 200),
            '*' => Http::response(['transaction_id' => 'TX-RESERVE'], 200),
        ]);

        Sanctum::actingAs($this->user);

        $commande = $this->commande(10000);

        $this->postJson('/api/mobile-money/initiate', $this->charge([
            'amount' => 6000,
            'commande_client_id' => $commande->id,
            'idempotency_key' => 'k-reserve-1',
        ]))->assertOk();

        // 6000 réservés + 5000 demandés = 11000 > 10000 : refus.
        $this->postJson('/api/mobile-money/initiate', $this->charge([
            'amount' => 5000,
            'commande_client_id' => $commande->id,
            'idempotency_key' => 'k-reserve-2',
        ]))
            ->assertStatus(400)
            ->assertJsonPath('reste_a_payer', 4000);

        $this->assertSame(1, Paiement::count(),
            'La réservation doit empêcher la seconde ligne de paiement.');
    }

    public function test_un_paiement_echoue_libere_la_reservation(): void
    {
        Http::fake([
            '*/oauth/token' => Http::response(['access_token' => 'token-test'], 200),
            '*' => Http::response(['transaction_id' => 'TX-LIBERE'], 200),
        ]);

        Sanctum::actingAs($this->user);

        $commande = $this->commande(10000);

        $this->postJson('/api/mobile-money/initiate', $this->charge([
            'amount' => 6000,
            'commande_client_id' => $commande->id,
            'idempotency_key' => 'k-libere-1',
        ]))->assertOk();

        // La tentative échoue : la réservation est libérée, le reste repasse à 10000.
        Paiement::firstOrFail()->update(['statut' => 'echoue']);

        $this->postJson('/api/mobile-money/initiate', $this->charge([
            'amount' => 10000,
            'commande_client_id' => $commande->id,
            'idempotency_key' => 'k-libere-2',
        ]))->assertOk();

        $this->assertSame(2, Paiement::count());
    }

    // -------------------------------------------------- utilitaires

    /**
     * @param  array<string, mixed>  $extra
     * @return array<string, mixed>
     */
    private function charge(array $extra = []): array
    {
        return array_merge([
            'amount' => 5000,
            'phone_number' => '97000000',
            'provider' => 'orange',
        ], $extra);
    }

    private function commande(float $montantTotal): CommandeClient
    {
        return CommandeClient::create([
            'boutique_id' => $this->boutique->id,
            'date_commande' => now(),
            'statut' => 'en_attente',
            'montant_total' => $montantTotal,
            'montant_paye' => 0,
        ]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function paiement(CommandeClient $commande, array $overrides = []): Paiement
    {
        return Paiement::create(array_merge([
            'commande_client_id' => $commande->id,
            'boutique_id' => $this->boutique->id,
            'montant' => 4000,
            'mode_paiement' => 'mobile_money_orange',
            'telephone' => '97000000',
            'reference_transaction' => 'TX-'.uniqid(),
            'date_paiement' => now(),
            'statut' => 'en_attente',
            'user_id' => $this->user->id,
        ], $overrides));
    }
}
