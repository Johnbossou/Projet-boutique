<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\TwoFactorAuthService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use ReflectionMethod;
use Tests\TestCase;

class TwoFactorTest extends TestCase
{
    use RefreshDatabase;

    private TwoFactorAuthService $service;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = new TwoFactorAuthService();
        $this->user = User::create([
            'name' => 'Utilisateur 2FA',
            'email' => '2fa@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);
    }

    /**
     * Génère le code TOTP d'un secret à un instant donné (utilitaire de test).
     */
    private function codeAt(string $plainSecret, int $unixTimestamp): string
    {
        $method = new ReflectionMethod($this->service, 'generateTOTP');
        $method->setAccessible(true);

        return $method->invoke($this->service, $plainSecret, intdiv($unixTimestamp, 30));
    }

    public function test_secret_est_genere_et_chiffre_en_base(): void
    {
        $plain = $this->service->generateSecret($this->user);
        $this->user->refresh();

        // Persisté…
        $this->assertNotNull($this->user->two_factor_secret);

        // …chiffré (≠ clair) et déchiffrable
        $this->assertNotSame($plain, $this->user->two_factor_secret);
        $this->assertSame($plain, Crypt::decryptString($this->user->two_factor_secret));
        $this->assertSame($plain, $this->service->getPlainSecret($this->user));

        // Base32 valide (RFC 4648)
        $this->assertMatchesRegularExpression('/^[A-Z2-7]{32}$/', $plain);
    }

    public function test_code_courant_est_accepte_et_mauvais_code_rejete(): void
    {
        $plain = $this->service->generateSecret($this->user);

        $code = $this->service->getCurrentCode($plain);
        $this->assertTrue($this->service->verifyCode($this->user, $code), 'Le code de la période courante doit être accepté');

        $mauvais = str_pad((string) ((int) $code === 999999 ? 0 : ((int) $code + 1) % 1000000), 6, '0', STR_PAD_LEFT);
        if ($mauvais === $code) {
            $mauvais = '000001';
        }

        $this->assertFalse($this->service->verifyCode($this->user, $mauvais));
        $this->assertFalse($this->service->verifyCode($this->user, 'abcdef'));
        $this->assertFalse($this->service->verifyCode($this->user, ''));
    }

    public function test_fenetre_de_tolerance_plus_minus_1_periode(): void
    {
        $plain = $this->service->generateSecret($this->user);

        $now = time();

        $this->assertTrue($this->service->verifyCode($this->user, $this->codeAt($plain, $now - 30)));
        $this->assertTrue($this->service->verifyCode($this->user, $this->codeAt($plain, $now + 30)));

        // Hors fenêtre : rejeté
        $this->assertFalse($this->service->verifyCode($this->user, $this->codeAt($plain, $now - 90)));
    }

    public function test_backdoor_123456_est_supprimee(): void
    {
        // Même en environnement local, "123456" ne doit JAMAIS être accepté
        $plain = $this->service->generateSecret($this->user);

        $code = $this->service->getCurrentCode($plain);
        if ($code !== '123456') { // improbable mais évacue le faux négatif
            $this->assertFalse($this->service->verifyCode($this->user, '123456'));
        }
    }

    public function test_conformite_rfc4228_vecteur_officiel(): void
    {
        // Vecteur officiel RFC 4226 (appendice D) pour le secret ASCII
        // "12345678901234567890" : compteur 1 → code HOTP 287082.
        // On valide notre troncature HMAC-SHA1 en injectant un compteur.
        $secretAscii = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // base32("12345678901234567890")

        $method = new ReflectionMethod($this->service, 'generateTOTP');
        $method->setAccessible(true);

        $this->assertSame('287082', $method->invoke($this->service, $secretAscii, 1));
        $this->assertSame('359152', $method->invoke($this->service, $secretAscii, 2));
        $this->assertSame('969429', $method->invoke($this->service, $secretAscii, 3));
    }

    public function test_activation_puis_verification_completes(): void
    {
        Sanctum::actingAs($this->user);

        // Étape 1 : génération du secret via l'API
        $response = $this->postJson('/api/2fa/enable')->assertOk();
        $secret = $response->json('secret');

        $this->assertNotEmpty($response->json('qr_code_uri'));
        $this->user->refresh();
        $this->assertNotSame($secret, $this->user->two_factor_secret, 'Le secret stocké doit être chiffré');

        // Étape 2 : confirmation avec un code invalide → refus
        $this->postJson('/api/2fa/confirm', ['code' => '000000'])
            ->assertStatus(422)
            ->assertJsonMissing(['message' => '2FA activé avec succès']);

        // Étape 3 : confirmation avec le bon code → activation
        $code = $this->service->getCurrentCode($secret);
        $this->postJson('/api/2fa/confirm', ['code' => $code])->assertOk()
            ->assertJsonPath('message', '2FA activé avec succès');

        $this->user->refresh();
        $this->assertTrue((bool) $this->user->two_factor_enabled);
    }
}
