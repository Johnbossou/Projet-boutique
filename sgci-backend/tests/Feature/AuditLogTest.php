<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Boutique;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuditLogTest extends TestCase
{
    use RefreshDatabase;

    private Boutique $boutique;
    private User $gerant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->gerant = User::create([
            'name' => 'Gérant Audit',
            'email' => 'gerant-audit@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);

        $this->boutique = Boutique::create([
            'nom' => 'Boutique Audit',
            'adresse' => 'Parakou',
            'proprietaire_id' => $this->gerant->id,
        ]);

        $this->gerant->boutiques()->attach($this->boutique->id);
        $this->gerant->update(['current_boutique_id' => $this->boutique->id]);
    }

    public function test_index_audit_logs(): void
    {
        Sanctum::actingAs($this->gerant);

        AuditLog::create([
            'user_id' => $this->gerant->id,
            'action' => 'create',
            'model' => 'Produit',
            'model_id' => 1,
            'new_values' => ['nom' => 'Test'],
            'boutique_id' => $this->boutique->id,
        ]);

        $this->getJson('/api/audit-logs')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_stats_audit_logs(): void
    {
        Sanctum::actingAs($this->gerant);

        AuditLog::create([
            'user_id' => $this->gerant->id,
            'action' => 'create',
            'model' => 'Produit',
            'model_id' => 1,
            'new_values' => ['nom' => 'Test'],
            'boutique_id' => $this->boutique->id,
        ]);

        $response = $this->getJson('/api/audit-logs/stats')->assertOk();

        $this->assertEquals(1, $response->json('total_logs'));
        $this->assertArrayHasKey('top_actions', $response->json());
        $this->assertArrayHasKey('top_users', $response->json());
    }

    public function test_stats_respecte_multitenancy(): void
    {
        Sanctum::actingAs($this->gerant);

        $otherBoutique = Boutique::create([
            'nom' => 'Autre',
            'adresse' => 'Abomey',
            'proprietaire_id' => $this->gerant->id,
        ]);

        AuditLog::create([
            'user_id' => $this->gerant->id,
            'action' => 'create',
            'model' => 'Produit',
            'model_id' => 1,
            'new_values' => [],
            'boutique_id' => $this->boutique->id,
        ]);

        AuditLog::create([
            'user_id' => $this->gerant->id,
            'action' => 'update',
            'model' => 'Produit',
            'model_id' => 2,
            'new_values' => [],
            'boutique_id' => $otherBoutique->id,
        ]);

        $response = $this->getJson('/api/audit-logs/stats')->assertOk();
        $this->assertEquals(1, $response->json('total_logs'));
    }

    public function test_export_audit_logs(): void
    {
        Sanctum::actingAs($this->gerant);

        AuditLog::create([
            'user_id' => $this->gerant->id,
            'action' => 'login',
            'model' => 'User',
            'model_id' => $this->gerant->id,
            'boutique_id' => $this->boutique->id,
        ]);

        $this->getJson('/api/audit-logs/export')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }
}
