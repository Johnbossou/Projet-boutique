<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\CommandeClient;
use App\Models\Paiement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Callback Mobile Money — le format reel des prestataires.
 *
 * Le callback attendait notre propre format de rappel : une signature
 * HMAC dans X-SGCI-Signature et une reference prestataire dans
 * transaction_id. Les prestataires ne parlent pas ce langage :
 *
 * - MTN rappelle avec l identifiant externe que NOUS lui avons transmis
 *   (notre numero de paiement) et l authentifie par sa cle d abonnement ;
 * - MTN ecrit son statut en majuscules (SUCCESSFUL, FAILED) ;
 * - MTN renvoie sa reference sous transactionId, pas transaction_id.
 *
 * Consequence avant le correctif : le callback reel du prestataire etait
 * rejete, et le paiement restait « en_attente » indefiniment — l argent
 * pren, la commande jamais soldee.
 */
class MobileMoneyCallbackFormatTest extends TestCase
{
    use RefreshDatabase;

    private const SECRET = 'secret-callback-prestataire';

    private Boutique $boutique;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->sansProvisionnerBoutique();

        config()->set('services.mobile_money.callback_secret', self::SECRET);
        config()->set('services.mtn_money.subscription_key', 'cle-abonnement-mtn');

        $proprietaire = User::create([
            'name' => 'Propriétaire',
            'email' => 'proprio-cb@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'proprietaire',
            'est_actif' => true,
        ]);

        $this->boutique = Boutique::create([
            'nom' => 'Boutique Callback',
            'devise' => 'XOF',
            'proprietaire_id' => $proprietaire->id,
        ]);

        $this->user = User::create([
            'name' => 'Gérant',
            'email' => 'gerant-cb@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);
        $this->user->forceFill(['current_boutique_id' => $this->boutique->id])->save();
        $this->boutique->users()->attach($this->user->id, ['role_dans_boutique' => 'gerant']);
    }

    public function test_le_callback_mtn_est_accepte_avec_sa_cle_et_son_format(): void
    {
        $commande = $this->commande();
        $paiement = $this->paiement($commande);

        // MTN rappelle avec NOTRE identifiant externe et sa clé d'abonnement.
        $this->appeler(
            '/api/mobile-money/callback',
            ['externalId' => $paiement->numero_paiement, 'status' => 'SUCCESSFUL'],
            ['Authorization' => 'Bearer cle-abonnement-mtn']
        )->assertOk();

        $this->assertSame('reussi', $paiement->fresh()->statut);
        $this->assertSame('5000.00', $commande->fresh()->montant_paye,
            'La commande doit etre creditee : l argent a ete encaisse.');
    }

    public function test_un_statut_mtn_en_majuscules_est_compris(): void
    {
        $commande = $this->commande();
        $paiement = $this->paiement($commande);

        $this->appeler(
            '/api/mobile-money/callback',
            ['externalId' => $paiement->numero_paiement, 'status' => 'FAILED'],
            ['Authorization' => 'Bearer cle-abonnement-mtn']
        )->assertOk();

        $this->assertSame('echoue', $paiement->fresh()->statut);
        $this->assertSame('0.00', $commande->fresh()->montant_paye);
    }

    public function test_le_callback_par_reference_prestataire_reste_accepte(): void
    {
        $commande = $this->commande();
        $paiement = $this->paiement($commande, ['reference_transaction' => 'TX-ORANGE-1']);

        $this->appeler(
            '/api/mobile-money/callback',
            ['transaction_id' => 'TX-ORANGE-1', 'status' => 'successful'],
            ['X-SGCI-Signature' => $this->signature('{"transaction_id":"TX-ORANGE-1","status":"successful"}')]
        )->assertOk();

        $this->assertSame('reussi', $paiement->fresh()->statut);
    }

    public function test_une_cle_inconnue_est_refusee(): void
    {
        $commande = $this->commande();
        $paiement = $this->paiement($commande);

        $this->appeler(
            '/api/mobile-money/callback',
            ['externalId' => $paiement->numero_paiement, 'status' => 'SUCCESSFUL'],
            ['Authorization' => 'Bearer cle-inventee']
        )->assertStatus(401);

        $this->assertSame('en_attente', $paiement->fresh()->statut,
            'Un appel non authentifie ne doit jamais solder une commande.');
    }

    public function test_une_signature_invalide_est_refusee(): void
    {
        $commande = $this->commande();
        $paiement = $this->paiement($commande);

        $this->appeler(
            '/api/mobile-money/callback',
            ['externalId' => $paiement->numero_paiement, 'status' => 'SUCCESSFUL'],
            ['X-SGCI-Signature' => 'signature-fabriquee']
        )->assertStatus(401);

        $this->assertSame('en_attente', $paiement->fresh()->statut);
    }

    public function test_un_statut_inconnu_est_refuse_sans_toucher_au_paiement(): void
    {
        $commande = $this->commande();
        $paiement = $this->paiement($commande);

        $this->appeler(
            '/api/mobile-money/callback',
            ['externalId' => $paiement->numero_paiement, 'status' => 'EN_ATTENTE'],
            ['Authorization' => 'Bearer cle-abonnement-mtn']
        )->assertStatus(400);

        $this->assertSame('en_attente', $paiement->fresh()->statut);
    }

    // -------------------------------------------------- helpers

    /**
     * @param  array<string, string>  $corps
     * @param  array<string, string>  $entetes
     */
    private function appeler(string $url, array $corps, array $entetes): TestResponse
    {
        $contenu = json_encode($corps);

        $entetesServeur = ['CONTENT_TYPE' => 'application/json'];

        foreach ($entetes as $nom => $valeur) {
            $entetesServeur[strtoupper(str_replace('-', '_', $nom))] = $valeur;
        }

        return $this->call(
            'POST',
            $url,
            [],
            [],
            [],
            $this->transformHeadersToServerVars($entetesServeur),
            $contenu
        );
    }

    private function signature(string $contenu): string
    {
        return hash_hmac('sha256', $contenu, self::SECRET);
    }

    private function commande(): CommandeClient
    {
        return CommandeClient::create([
            'boutique_id' => $this->boutique->id,
            'date_commande' => now(),
            'statut' => 'en_attente',
            'montant_total' => 5000,
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
            'montant' => 5000,
            'mode_paiement' => 'mobile_money_mtn',
            'telephone' => '97000000',
            'reference_transaction' => 'TX-MTN-1',
            'date_paiement' => now(),
            'statut' => 'en_attente',
            'user_id' => $this->user->id,
        ], $overrides));
    }
}
