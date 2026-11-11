<?php

namespace Tests\Feature;

use App\Services\SmsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Canal SMS.
 *
 * Le canal etait fracture en deux : un service qui ignorait SMS_ENABLED et
 * SMS_SIMULATION, et une URL par defaut qui pointait vers un domaine
 * d'exemple. Aucun SMS n'aurait jamais pu partir, et l'echec etait muet.
 *
 * Le fournisseur configure est Africa's Talking : son URL porte le nom
 * d'utilisateur et son corps a une forme propre. Poster la structure d'un
 * autre fournisseur renvoyait une erreur incompréhensible.
 */
class SmsServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_un_canal_desactive_n_envoie_rien(): void
    {
        config()->set('services.sms.enabled', false);
        config()->set('services.sms.simulation', false);
        config()->set('services.sms.api_key', 'cle');

        Http::fake();

        $resultat = app(SmsService::class)->envoyer('97000000', 'Bonjour');

        $this->assertFalse($resultat['success']);
        Http::assertNothingSent();
    }

    public function test_le_mode_simulation_n_envoie_rien(): void
    {
        config()->set('services.sms.enabled', true);
        config()->set('services.sms.simulation', true);

        Http::fake();

        $resultat = app(SmsService::class)->envoyer('97000000', 'Bonjour');

        $this->assertTrue($resultat['success']);
        Http::assertNothingSent();
    }

    public function test_sans_cle_le_fournisseur_n_est_pas_appele(): void
    {
        config()->set('services.sms.enabled', true);
        config()->set('services.sms.simulation', false);
        config()->set('services.sms.api_key', '');

        Http::fake();

        $resultat = app(SmsService::class)->envoyer('97000000', 'Bonjour');

        $this->assertFalse($resultat['success']);
        Http::assertNothingSent();
    }

    public function test_l_envoi_reel_appelle_le_fournisseur_avec_son_format(): void
    {
        config()->set('services.sms.enabled', true);
        config()->set('services.sms.simulation', false);
        config()->set('services.sms.api_key', 'cle-fournisseur');
        config()->set('services.sms.service', 'africas_talking');
        config()->set('services.sms.username', 'sgci-benin');
        config()->set('services.sms.api_url', '');

        Http::fake(['*' => Http::response(['status' => 'Success'], 200)]);

        $resultat = app(SmsService::class)->envoyer('97000000', 'Alerte de stock');

        $this->assertTrue($resultat['success']);

        Http::assertSent(function (Request $requete) {
            // L'URL d'Africa's Talking porte le nom d'utilisateur.
            $this->assertStringContainsString('sgci-benin', $requete->url());
            $this->assertSame('cle-fournisseur', $requete['api_key']);
            // Le numero est normalise avec l'indicatif du Benin.
            $this->assertSame('+22997000000', $requete['to']);
            $this->assertSame('Alerte de stock', $requete['message']);

            return true;
        });
    }

    public function test_le_numero_est_normalise_avec_le_code_pays(): void
    {
        config()->set('services.sms.enabled', true);
        config()->set('services.sms.simulation', false);
        config()->set('services.sms.api_key', 'cle-fournisseur');
        config()->set('services.sms.service', 'africas_talking');
        config()->set('services.sms.username', 'sgci-benin');

        Http::fake(['*' => Http::response(['status' => 'Success'], 200)]);

        app(SmsService::class)->envoyer('97000000', 'Bonjour');

        Http::assertSent(function (Request $requete) {
            $this->assertSame('+22997000000', $requete['to']);

            return true;
        });
    }

    public function test_une_erreur_du_fournisseur_est_remontee(): void
    {
        config()->set('services.sms.enabled', true);
        config()->set('services.sms.simulation', false);
        config()->set('services.sms.api_key', 'cle-fournisseur');
        config()->set('services.sms.service', 'africas_talking');
        config()->set('services.sms.username', 'sgci-benin');

        Http::fake(['*' => Http::response(['status' => 'InvalidUser'], 400)]);

        $resultat = app(SmsService::class)->envoyer('97000000', 'Bonjour');

        $this->assertFalse($resultat['success']);
    }
}
