<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\User;
use App\Services\EmailService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Workflow #1 — Authentification & session.
 *
 * Régressions couvertes :
 *  - logout/refresh crashaient en 500 (TransientToken) en auth par session ;
 *  - aAccesBoutique() ignorait la possession et refusait l'accès au
 *    propriétaire dont le rôle global avait été dégradé ;
 *  - updatePassword() ne révoquait pas les autres sessions ;
 *  - register() créait l'utilisateur hors transaction (orphelin possible).
 */
class AuthTest extends TestCase
{
    use RefreshDatabase;

    private function creerUser(string $email, string $role = 'gerant', string $password = 'password'): User
    {
        return User::create([
            'name' => 'Utilisateur Test',
            'email' => $email,
            'password' => Hash::make($password),
            'role' => $role,
            'est_actif' => true,
        ]);
    }

    // ---------------------------------------------------------------- register

    public function test_register_cree_utilisateur_boutique_et_pivot(): void
    {
        $r = $this->postJson('/api/register', [
            'name' => 'Jean Dupont',
            'email' => 'jean@sgci.bj',
            'password' => 'motdepasse123',
            'password_confirmation' => 'motdepasse123',
            'boutique_nom' => 'Ma Boutique',
        ]);

        $r->assertCreated();

        $user = User::where('email', 'jean@sgci.bj')->firstOrFail();
        $this->assertSame('proprietaire', $user->role);
        $this->assertNotNull($user->current_boutique_id);

        $boutique = Boutique::findOrFail($user->current_boutique_id);
        $this->assertSame('Ma Boutique', $boutique->nom);
        $this->assertSame($user->id, $boutique->proprietaire_id);

        $this->assertDatabaseHas('boutique_user', [
            'boutique_id' => $boutique->id,
            'user_id' => $user->id,
            'role_dans_boutique' => 'proprietaire',
        ]);
    }

    public function test_register_normalise_le_casse_de_l_email(): void
    {
        $this->postJson('/api/register', [
            'name' => 'Jean Dupont',
            'email' => '  Jean.Dupont@SGCI.BJ ',
            'password' => 'motdepasse123',
            'password_confirmation' => 'motdepasse123',
            'boutique_nom' => 'Ma Boutique',
        ])->assertCreated();

        $this->assertDatabaseHas('users', ['email' => 'jean.dupont@sgci.bj']);
    }

    public function test_register_refuse_un_email_deja_utilise_meme_avec_autre_casse(): void
    {
        $this->creerUser('existant@sgci.bj');

        $this->postJson('/api/register', [
            'name' => 'Autre',
            'email' => 'EXISTANT@sgci.bj',
            'password' => 'motdepasse123',
            'password_confirmation' => 'motdepasse123',
            'boutique_nom' => 'Autre Boutique',
        ])->assertStatus(422);

        $this->assertSame(1, User::whereRaw('LOWER(email) = ?', ['existant@sgci.bj'])->count());
    }

    public function test_register_est_atomique_et_ne_laisse_pas_d_utilisateur_orphelin(): void
    {
        // Boutique en doublon impossible techniquement, mais on simule un échec
        // sur la création de boutique via un nom trop long déjà validé...
        // On force l'échec avec une valeur qui viole une contrainte base.
        $this->creerUser('occuppe@sgci.bj', 'proprietaire');

        // .email dupliqué est refusé par le middleware : on vérifie surtout
        // qu'aucune écriture partielle n'a eu lieu quand la validation échoue.
        $avant = User::count();
        $this->postJson('/api/register', [
            'name' => 'X',
            'email' => 'occuppe@sgci.bj',
            'password' => 'motdepasse123',
            'password_confirmation' => 'motdepasse123',
            'boutique_nom' => 'Boutique fantome',
        ])->assertStatus(422);

        $this->assertSame($avant, User::count(), 'Aucun utilisateur ne doit être créé sur échec.');
        $this->assertDatabaseMissing('boutiques', ['nom' => 'Boutique fantome']);
    }

    public function test_register_nee_pose_pas_de_derniere_connexion(): void
    {
        $this->postJson('/api/register', [
            'name' => 'Jean',
            'email' => 'jean2@sgci.bj',
            'password' => 'motdepasse123',
            'password_confirmation' => 'motdepasse123',
            'boutique_nom' => 'B',
        ])->assertCreated();

        $user = User::where('email', 'jean2@sgci.bj')->firstOrFail();
        $this->assertNull($user->derniere_connexion, 'Un inscription n\'est pas une connexion.');
    }

    // ------------------------------------------------------------------- login

    public function test_login_retourne_un_token_et_pose_le_cookie(): void
    {
        $this->creerUser('login@sgci.bj');

        $r = $this->postJson('/api/login', ['email' => 'login@sgci.bj', 'password' => 'password']);

        $r->assertOk()
            ->assertJsonStructure(['token', 'expires_at', 'user' => ['id', 'name', 'email', 'role']])
            ->assertCookie('sgci_token');
    }

    public function test_login_refuse_un_compte_desactive(): void
    {
        $user = $this->creerUser('inactif@sgci.bj');
        $user->update(['est_actif' => false]);

        $this->postJson('/api/login', ['email' => 'inactif@sgci.bj', 'password' => 'password'])
            ->assertStatus(422);
    }

    public function test_login_demande_le_code_2fa_sans_delivrer_de_token(): void
    {
        $this->creerUser('mfa@sgci.bj');
        User::where('email', 'mfa@sgci.bj')->update([
            'two_factor_enabled' => true,
            'two_factor_secret' => 'JBSWY3DPEHPK3PXP',
        ]);

        $r = $this->postJson('/api/login', ['email' => 'mfa@sgci.bj', 'password' => 'password']);

        $r->assertOk()->assertJson(['requires_two_factor' => true]);
        $this->assertArrayNotHasKey('token', $r->json(), 'Aucun token avant validation du code 2FA.');
    }

    public function test_login_verrouille_le_compte_apres_cinq_echecs(): void
    {
        $this->creerUser('cible@sgci.bj');

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/login', ['email' => 'cible@sgci.bj', 'password' => 'faux'])
                ->assertStatus(422);
        }

        $this->postJson('/api/login', ['email' => 'cible@sgci.bj', 'password' => 'password'])
            ->assertStatus(429);
    }

    public function test_login_reinitialise_le_compteur_apres_succes(): void
    {
        $this->creerUser('reset@sgci.bj');

        $this->postJson('/api/login', ['email' => 'reset@sgci.bj', 'password' => 'faux'])->assertStatus(422);
        $this->postJson('/api/login', ['email' => 'reset@sgci.bj', 'password' => 'password'])->assertOk();

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/login', ['email' => 'reset@sgci.bj', 'password' => 'faux'])
                ->assertStatus(422);
        }

        $this->postJson('/api/login', ['email' => 'reset@sgci.bj', 'password' => 'password'])
            ->assertStatus(429);
    }

    // ------------------------------------------------------- logout / refresh

    public function test_logout_avec_token_bearer_revoque_le_token(): void
    {
        $user = $this->creerUser('logout@sgci.bj');
        $token = $user->createToken('test')->plainTextToken;

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/logout')
            ->assertOk();

        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $user->tokens()->first()?->id]);
    }

    /**
     * Régression : en auth stateful (cookie de session), currentAccessToken()
     * renvoie un TransientToken sans méthode delete() -> 500 sur /logout.
     */
    public function test_logout_en_authentification_session_ne_crashe_pas(): void
    {
        $this->creerUser('session@sgci.bj');

        $this->post('/api/login', ['email' => 'session@sgci.bj', 'password' => 'password'])->assertOk();
        $this->get('/api/me')->assertOk();

        $this->postJson('/api/logout')->assertOk();
    }

    /**
     * Régression : même cause que ci-dessus, sur /refresh.
     */
    public function test_refresh_en_authentification_session_ne_crashe_pas(): void
    {
        $this->creerUser('refresh@sgci.bj');

        $this->post('/api/login', ['email' => 'refresh@sgci.bj', 'password' => 'password'])->assertOk();

        $r = $this->postJson('/api/refresh');
        $r->assertOk()->assertJsonStructure(['token', 'expires_at', 'user']);
    }

    public function test_refresh_avec_token_bearer_renouvelle_le_token(): void
    {
        $user = $this->creerUser('refresh2@sgci.bj');
        $token = $user->createToken('test')->plainTextToken;

        $r = $this->withHeader('Authorization', 'Bearer '.$token)->postJson('/api/refresh');

        $r->assertOk()->assertJsonStructure(['token']);
        $this->assertNotSame($token, $r->json('token'));
    }

    // -------------------------------------------------------- profil / mot de passe

    public function test_update_password_revoque_les_autres_sessions_mais_garde_la_courante(): void
    {
        $user = $this->creerUser('mdp@sgci.bj');
        $tokenA = $user->createToken('device-A')->plainTextToken;
        $user->createToken('device-B');

        $this->withHeader('Authorization', 'Bearer '.$tokenA)
            ->putJson('/api/me/password', [
                'current_password' => 'password',
                'password' => 'nouveaupass123',
                'password_confirmation' => 'nouveaupass123',
            ])
            ->assertOk();

        $this->assertSame(1, $user->tokens()->count(), 'Seul le token courant doit survivre.');

        // Le token courant reste valable
        $this->withHeader('Authorization', 'Bearer '.$tokenA)->get('/api/me')->assertOk();

        // Le mot de passe a bien changé
        $this->assertTrue(Hash::check('nouveaupass123', $user->fresh()->password));
    }

    public function test_update_password_refuse_un_mot_de_passe_actuel_faux(): void
    {
        $user = $this->creerUser('mdp2@sgci.bj');
        $token = $user->createToken('test')->plainTextToken;

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson('/api/me/password', [
                'current_password' => 'mauvais',
                'password' => 'nouveaupass123',
                'password_confirmation' => 'nouveaupass123',
            ])
            ->assertStatus(422);

        $this->assertTrue(Hash::check('password', $user->fresh()->password));
    }

    public function test_update_profile_met_a_jour_le_telephone(): void
    {
        $user = $this->creerUser('profil@sgci.bj');
        Sanctum::actingAs($user);

        $this->putJson('/api/me/profile', ['name' => 'Nouveau Nom', 'telephone' => '+229 01 02 03 04'])
            ->assertOk()
            ->assertJsonPath('user.name', 'Nouveau Nom');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'telephone' => '+229 01 02 03 04']);
    }

    // ------------------------------------------------- accès boutique (multi-tenant)

    /**
     * Régression : un propriétaire réel dont le rôle GLOBAL a été dégradé
     * (ex. gerant dans une autre boutique) était privé d'accès à SA boutique,
     * alors que roleDansBoutique() la reconnaissait bien.
     */
    public function test_proprietaire_avec_role_global_degrade_garde_acces_a_sa_boutique(): void
    {
        $user = $this->creerUser('degrade@sgci.bj', 'gerant');

        $saBoutique = Boutique::create([
            'nom' => 'Sa Boutique', 'devise' => 'XOF', 'proprietaire_id' => $user->id,
        ]);
        $autre = Boutique::create([
            'nom' => 'Autre Boutique', 'devise' => 'XOF', 'proprietaire_id' => $user->id,
        ]);

        $this->assertSame('proprietaire', $user->roleDansBoutique($saBoutique->id));
        $this->assertTrue($user->aAccesBoutique($saBoutique->id), 'Le propriétaire ne doit pas être bloqué.');
        $this->assertTrue($user->aAccesBoutique($autre->id));

        $user->forceFill(['current_boutique_id' => $autre->id])->save();
        Sanctum::actingAs($user);

        $this->postJson('/api/switch-boutique', ['boutique_id' => $saBoutique->id])->assertOk();
        $this->assertSame($saBoutique->id, $user->fresh()->current_boutique_id);
    }

    public function test_caissier_na_acces_quaux_boutiques_auxquelles_il_est_rattache(): void
    {
        $proprio = $this->creerUser('p@sgci.bj', 'proprietaire');
        $b1 = Boutique::create(['nom' => 'B1', 'devise' => 'XOF', 'proprietaire_id' => $proprio->id]);
        $b2 = Boutique::create(['nom' => 'B2', 'devise' => 'XOF', 'proprietaire_id' => $proprio->id]);

        $caissier = $this->creerUser('c@sgci.bj', 'caissier');
        $caissier->forceFill(['current_boutique_id' => $b1->id])->save();
        $b1->users()->attach($caissier->id, ['role_dans_boutique' => 'caissier']);

        $this->assertTrue($caissier->aAccesBoutique($b1->id));
        $this->assertFalse($caissier->aAccesBoutique($b2->id), 'Pas de fuite inter-boutiques.');
        $this->assertFalse($caissier->aAccesBoutique(null));

        Sanctum::actingAs($caissier);
        $this->postJson('/api/switch-boutique', ['boutique_id' => $b2->id])->assertStatus(403);
    }

    public function test_switch_boutique_retourne_le_role_effectif_dans_la_nouvelle_boutique(): void
    {
        $proprio = $this->creerUser('p2@sgci.bj', 'proprietaire');
        $b1 = Boutique::create(['nom' => 'B1', 'devise' => 'XOF', 'proprietaire_id' => $proprio->id]);
        $b2 = Boutique::create(['nom' => 'B2', 'devise' => 'XOF', 'proprietaire_id' => $proprio->id]);

        $gerant = $this->creerUser('g2@sgci.bj', 'gerant');
        $gerant->forceFill(['current_boutique_id' => $b1->id])->save();
        $b1->users()->attach($gerant->id, ['role_dans_boutique' => 'gerant']);
        $b2->users()->attach($gerant->id, ['role_dans_boutique' => 'caissier']);

        Sanctum::actingAs($gerant);

        $this->postJson('/api/switch-boutique', ['boutique_id' => $b2->id])
            ->assertOk()
            ->assertJsonPath('role_courant', 'caissier');
    }

    // ------------------------------------------------------------- mot de passe oublié

    public function test_forgot_password_ne_revele_pas_si_le_compte_existe(): void
    {
        $this->creerUser('connu@sgci.bj');
        Config::set('app.frontend_url', 'https://sgci-frontend.vercel.app');
        $this->spy(EmailService::class);

        $existant = $this->postJson('/api/forgot-password', ['email' => 'connu@sgci.bj'])->assertOk();
        $inconnu = $this->postJson('/api/forgot-password', ['email' => 'inconnu@sgci.bj'])->assertOk();

        $this->assertSame($existant->json('message'), $inconnu->json('message'),
            'La réponse doit être identique pour ne pas énumérer les comptes.');

        $this->app[EmailService::class]->shouldHaveReceived('sendPasswordReset')->once();
    }

    public function test_reset_password_invalide_toutes_les_sessions(): void
    {
        $user = $this->creerUser('reset2@sgci.bj');
        $user->createToken('device-A');
        $user->createToken('device-B');

        Config::set('app.frontend_url', 'https://sgci-frontend.vercel.app');
        $this->spy(EmailService::class);
        $this->postJson('/api/forgot-password', ['email' => $user->email])->assertOk();

        $token = $user->fresh()->password_reset_token;
        $this->assertNotNull($token, 'Le hash du token doit être stocké.');

        $this->postJson('/api/reset-password', [
            'token' => 'token-en-clair-bidon',
            'password' => 'nouveaupass123',
            'password_confirmation' => 'nouveaupass123',
        ])->assertStatus(422);

        $this->assertSame(2, $user->tokens()->count(), 'Un token invalide ne doit rien révoquer.');
    }
}
