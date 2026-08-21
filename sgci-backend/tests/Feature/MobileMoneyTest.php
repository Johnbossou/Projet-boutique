<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\CommandeClient;
use App\Models\Paiement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MobileMoneyTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private Boutique $boutique;
    private User $proprietaire;

    private const SECRET = 'secret-callback-test';

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('services.mobile_money.callback_secret', self::SECRET);

        $this->proprietaire = User::create([
            'name' => 'Propriétaire MoMo',
            'email' => 'proprio-momo@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'proprietaire',
            'est_actif' => true,
        ]);

        $this->boutique = Boutique::create([
            'nom' => 'Boutique Test',
            'adresse' => 'Cotonou',
            'telephone' => '+22990000000',
            'devise' => 'XOF',
            'proprietaire_id' => $this->proprietaire->id,
        ]);

        $this->user = User::create([
            'name' => 'Gérant MoMo',
            'email' => 'momo@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);
        $this->user->forceFill(['current_boutique_id' => $this->boutique->id])->save();
    }

    private function createCommande(float $montantTotal = 10000): CommandeClient
    {
        return CommandeClient::create([
            'client_id' => null,
            'boutique_id' => $this->boutique->id,
            'date_commande' => now(),
            'statut' => 'en_attente',
            'montant_total' => $montantTotal,
            'montant_paye' => 0,
        ]);
    }

    private function createPaiement(CommandeClient $commande, array $overrides = []): Paiement
    {
        return Paiement::create(array_merge([
            'commande_client_id' => $commande->id,
            'boutique_id' => $this->boutique->id,
            'montant' => 4000,
            'mode_paiement' => 'mobile_money_orange',
            'reference_transaction' => 'TX-' . uniqid(),
            'date_paiement' => now(),
            'statut' => 'en_attente',
            'user_id' => $this->user->id,
        ], $overrides));
    }

    private function postCallback(string $rawBody, ?string $signature = null)
    {
        $server = ['CONTENT_TYPE' => 'application/json'];
        if ($signature !== null) {
            $server['X-SGCI-Signature'] = $signature;
        }

        return $this->call(
            'POST',
            '/api/mobile-money/callback',
            [],
            [],
            [],
            $this->transformHeadersToServerVars($server),
            $rawBody
        );
    }

    public function test_initiate_creates_paiement_with_boutique_and_unique_numero(): void
    {
        Http::fake([
            '*/oauth/token' => Http::response(['access_token' => 'token-test'], 200),
            '*' => Http::response(['transaction_id' => 'TX-ABC'], 200),
        ]);
        Sanctum::actingAs($this->user);

        $this->postJson('/api/mobile-money/initiate', [
            'amount' => 5000,
            'phone_number' => '97000000',
            'provider' => 'orange',
        ])->assertOk();

        $paiement = Paiement::firstOrFail();

        $this->assertSame($this->boutique->id, $paiement->boutique_id);
        $this->assertSame($this->user->id, $paiement->user_id);
        $this->assertSame('TX-ABC', $paiement->reference_transaction);
        $this->assertMatchesRegularExpression('/^PAY-\d{8}-\d{4}$/', $paiement->numero_paiement);
        $this->assertSame('en_attente', $paiement->statut);
    }

    public function test_initiation_failure_marks_paiement_echoue(): void
    {
        Http::fake([
            '*/oauth/token' => Http::response(['access_token' => 'token-test'], 200),
            '*' => Http::response(['error' => 'insufficient_funds'], 402),
        ]);
        Sanctum::actingAs($this->user);

        $this->postJson('/api/mobile-money/initiate', [
            'amount' => 5000,
            'phone_number' => '97000000',
            'provider' => 'orange',
        ])->assertStatus(400);

        $this->assertSame('echoue', Paiement::firstOrFail()->statut);
    }

    public function test_callback_rejects_missing_or_invalid_signature(): void
    {
        $body = json_encode(['transaction_id' => 'TX-X', 'status' => 'successful']);

        // Signature manquante
        $this->postCallback($body)->assertStatus(401);

        // Signature calculée avec le mauvais secret
        $this->postCallback($body, hash_hmac('sha256', $body, 'mauvais-secret'))
            ->assertStatus(401);

        // Corps modifié après signature
        $this->postCallback($body, hash_hmac('sha256', '{"transaction_id":"TX-X","status":"failed"}', self::SECRET))
            ->assertStatus(401);

        $this->assertSame(0, Paiement::count());
    }

    public function test_callback_success_is_idempotent(): void
    {
        $commande = $this->createCommande();
        $paiement = $this->createPaiement($commande, ['reference_transaction' => 'TX-IDEM']);

        $body = json_encode(['transaction_id' => 'TX-IDEM', 'status' => 'successful']);
        $signature = hash_hmac('sha256', $body, self::SECRET);

        $this->postCallback($body, $signature)->assertOk();

        $this->assertSame('reussi', $paiement->fresh()->statut);
        $this->assertEquals(4000, (float) $commande->fresh()->montant_paye);

        // Rejouer le même callback ne doit rien changer
        $this->postCallback($body, $signature)->assertOk();

        $this->assertSame('reussi', $paiement->fresh()->statut);
        $this->assertEquals(4000, (float) $commande->fresh()->montant_paye);
    }

    public function test_callback_failed_status_does_not_increment_commande(): void
    {
        $commande = $this->createCommande();
        $paiement = $this->createPaiement($commande, ['reference_transaction' => 'TX-KO']);

        $body = json_encode(['transaction_id' => 'TX-KO', 'status' => 'cancelled']);
        $this->postCallback($body, hash_hmac('sha256', $body, self::SECRET))->assertOk();

        $this->assertSame('echoue', $paiement->fresh()->statut);
        $this->assertEquals(0, (float) $commande->fresh()->montant_paye);
    }

    public function test_check_status_transitions_once(): void
    {
        Http::fake([
            '*/oauth/token' => Http::response(['access_token' => 'token-test'], 200),
            '*' => Http::response(['status' => 'successful'], 200),
        ]);
        Sanctum::actingAs($this->user);

        $commande = $this->createCommande();
        $paiement = $this->createPaiement($commande, ['reference_transaction' => 'TX-ST']);

        $this->getJson("/api/mobile-money/status/{$paiement->numero_paiement}")
            ->assertOk();

        $this->assertSame('reussi', $paiement->fresh()->statut);
        $this->assertEquals(4000, (float) $commande->fresh()->montant_paye);

        // Reconsulter le statut ne doit pas ré-incrémenter la commande
        $this->getJson("/api/mobile-money/status/{$paiement->numero_paiement}")
            ->assertOk();

        $this->assertEquals(4000, (float) $commande->fresh()->montant_paye);
    }

    public function test_check_status_scoped_to_current_boutique(): void
    {
        Http::fake([
            '*/oauth/token' => Http::response(['access_token' => 'token-test'], 200),
            '*' => Http::response(['status' => 'successful'], 200),
        ]);
        Sanctum::actingAs($this->user);

        $autreBoutique = Boutique::create([
            'nom' => 'Autre Boutique',
            'devise' => 'XOF',
            'proprietaire_id' => $this->proprietaire->id,
        ]);

        $paiement = $this->createPaiement($this->createCommande(), [
            'boutique_id' => $autreBoutique->id,
        ]);

        $this->getJson("/api/mobile-money/status/{$paiement->numero_paiement}")
            ->assertStatus(404);

        $this->assertSame('en_attente', $paiement->fresh()->statut);
    }
}
