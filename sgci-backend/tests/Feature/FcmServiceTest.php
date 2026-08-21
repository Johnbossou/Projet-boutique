<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\FcmToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FcmServiceTest extends TestCase
{
    use RefreshDatabase;

    private function createUser(string $email = 'test@example.com'): User
    {
        return User::create([
            'name' => 'Test User',
            'email' => $email,
            'password' => bcrypt('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);
    }

    public function test_can_register_fcm_token(): void
    {
        $user = $this->createUser();

        $response = $this->actingAs($user)
            ->postJson('/api/fcm/register', [
                'token' => 'test_fcm_token_12345',
                'device_name' => 'Test Device',
                'platform' => 'android',
            ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('fcm_tokens', [
            'user_id' => $user->id,
            'token' => 'test_fcm_token_12345',
        ]);
    }

    public function test_duplicate_token_is_updated_not_duplicated(): void
    {
        $user = $this->createUser();

        // Première inscription
        $this->actingAs($user)->postJson('/api/fcm/register', [
            'token' => 'test_token',
            'device_name' => 'Old Device',
        ]);

        // Ré-inscription du même token : mise à jour (200) et pas de doublon
        $response = $this->actingAs($user)
            ->postJson('/api/fcm/register', [
                'token' => 'test_token',
                'device_name' => 'New Device',
            ]);

        $response->assertStatus(200);

        $this->assertDatabaseHas('fcm_tokens', [
            'user_id' => $user->id,
            'token' => 'test_token',
            'device_name' => 'New Device',
        ]);

        $this->assertSame(1, FcmToken::where('user_id', $user->id)->count());
    }

    public function test_can_unregister_fcm_token(): void
    {
        $user = $this->createUser();

        FcmToken::create([
            'user_id' => $user->id,
            'token' => 'test_fcm_token_12345',
            'device_name' => 'Test Device',
        ]);

        $response = $this->actingAs($user)
            ->postJson('/api/fcm/unregister', ['token' => 'test_fcm_token_12345']);

        $response->assertStatus(200);

        $this->assertDatabaseMissing('fcm_tokens', [
            'token' => 'test_fcm_token_12345',
        ]);
    }

    public function test_unregister_unknown_token_returns_404(): void
    {
        $user = $this->createUser();

        $response = $this->actingAs($user)
            ->postJson('/api/fcm/unregister', ['token' => 'inconnu']);

        $response->assertStatus(404);
    }

    public function test_can_list_only_own_fcm_tokens(): void
    {
        $user1 = $this->createUser();
        $user2 = $this->createUser('other@example.com');

        FcmToken::create(['user_id' => $user1->id, 'token' => 'token1', 'device_name' => 'Device 1']);
        FcmToken::create(['user_id' => $user1->id, 'token' => 'token2', 'device_name' => 'Device 2']);
        FcmToken::create(['user_id' => $user2->id, 'token' => 'token3', 'device_name' => 'Device 3']);

        $response = $this->actingAs($user1)->getJson('/api/fcm/my-tokens');

        $response->assertStatus(200)
            ->assertJsonPath('count', 2);

        $tokens = $response->json('tokens');
        $this->assertSame(
            ['token1', 'token2'],
            collect($tokens)->pluck('token')->sort()->values()->all()
        );
    }
}
