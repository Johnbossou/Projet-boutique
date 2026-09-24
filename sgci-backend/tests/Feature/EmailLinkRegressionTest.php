<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\EmailService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class EmailLinkRegressionTest extends TestCase
{
    use RefreshDatabase;

    public function test_lien_reset_password_utilise_frontend_url_et_pas_lurl_backend(): void
    {
        Config::set('app.frontend_url', 'https://sgci-frontend.vercel.app');

        $user = User::create([
            'name' => 'Test Lien',
            'email' => 'lien@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);

        $this->spy(EmailService::class);

        $this->postJson('/api/forgot-password', ['email' => $user->email])
            ->assertOk();

        $emailService = $this->app[EmailService::class];

        $emailService->shouldHaveReceived('sendPasswordReset')
            ->once()
            ->withArgs(function ($emailUser, $resetUrl) {
                $this->assertSame($emailUser->email, 'lien@sgci.bj');

                $this->assertStringStartsWith(
                    'https://sgci-frontend.vercel.app/reset-password?token=',
                    $resetUrl,
                    'Le lien doit pointer vers le frontend (repro du bug 8200b01).'
                );

                $this->assertSame(
                    1,
                    substr_count($resetUrl, 'https://sgci-frontend.vercel.app/'),
                    'L\'URL frontend ne doit pas être dupliquée.'
                );

                return true;
            });
    }
}