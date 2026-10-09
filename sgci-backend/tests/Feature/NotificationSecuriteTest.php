<?php

namespace Tests\Feature;

use App\Http\Controllers\API\NotificationController;
use App\Models\AppNotification;
use App\Models\Boutique;
use App\Models\Categorie;
use App\Models\Produit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Sécurité des notifications liées au stock.
 *
 * Deux fuites ont été corrigées ici :
 *  - index / unreadCount / markAllRead incluaient les notifications dont
 *    user_id est NULL, donc celles des autres comptes. Aucun service ne crée
 *    de notification broadcast, cette branche n'exposait que des données
 *    d'autrui (nom de produit, stock, seuil, y compris d'autres boutiques) ;
 *  - markRead n'autorisait rien : un identifiant deviné suffisait à lire et
 *    modifier la notification d'un autre compte.
 *
 * Et une fuite de masse : generateStockAlerts() sans boutique croisait tous les
 * gérants globaux avec tous les produits globaux, chaque heure, via
 * SyncStockAlertsCommand.
 */
class NotificationSecuriteTest extends TestCase
{
    use RefreshDatabase;

    private Boutique $boutiqueA;

    private Boutique $boutiqueB;

    private User $gerantA;

    private User $gerantB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->sansProvisionnerBoutique();

        $proprietaire = User::create([
            'name' => 'Propriétaire',
            'email' => 'proprio-notif@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'proprietaire',
            'est_actif' => true,
        ]);

        $this->boutiqueA = Boutique::create([
            'nom' => 'Boutique A',
            'devise' => 'XOF',
            'proprietaire_id' => $proprietaire->id,
        ]);

        $this->boutiqueB = Boutique::create([
            'nom' => 'Boutique B',
            'devise' => 'XOF',
            'proprietaire_id' => $proprietaire->id,
        ]);

        $this->gerantA = $this->creerGerant('gerant-a-notif@sgci.bj', $this->boutiqueA);
        $this->gerantB = $this->creerGerant('gerant-b-notif@sgci.bj', $this->boutiqueB);
    }

    private function creerGerant(string $email, Boutique $boutique): User
    {
        $gerant = User::create([
            'name' => 'Gérant',
            'email' => $email,
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);

        $gerant->forceFill(['current_boutique_id' => $boutique->id])->save();
        $boutique->users()->attach($gerant->id, ['role_dans_boutique' => 'gerant']);

        return $gerant;
    }

    private function creerProduit(Boutique $boutique, string $nom, int $stock, int $seuil = 3): Produit
    {
        $categorie = Categorie::create([
            'nom' => "Cat {$boutique->id} $nom",
            'boutique_id' => $boutique->id,
        ]);

        return Produit::create([
            'nom' => $nom,
            'prix' => 1000,
            'prix_achat' => 1000,
            'prix_vente' => 1500,
            'quantite_stock' => $stock,
            'seuil_alerte' => $seuil,
            'categorie_id' => $categorie->id,
            'boutique_id' => $boutique->id,
        ]);
    }

    private function creerNotification(?User $destinataire, string $titre): AppNotification
    {
        return AppNotification::create([
            'user_id' => $destinataire?->id,
            'type' => 'workflow',
            'title' => $titre,
            'message' => 'contenu',
            'data' => [],
        ]);
    }

    // ==================== LISTE ====================

    public function test_la_liste_ne_contient_pas_les_notifications_d_un_autre_utilisateur(): void
    {
        $mienne = $this->creerNotification($this->gerantA, 'Ma notification');
        $autre = $this->creerNotification($this->gerantB, 'Notification de B');

        Sanctum::actingAs($this->gerantA);

        $reponse = $this->getJson('/api/notifications')->assertOk();
        $ids = collect($reponse->json('data'))->pluck('id');

        $this->assertTrue($ids->contains($mienne->id), 'Ma notification doit être visible.');
        $this->assertFalse($ids->contains($autre->id), 'La notification d un autre compte doit etre masquee.');
    }

    public function test_la_liste_ignore_les_notifications_broadcast_sans_destinataire(): void
    {
        $broadcast = $this->creerNotification(null, 'Diffusee a tout le monde');
        $mienne = $this->creerNotification($this->gerantA, 'Ma notification');

        Sanctum::actingAs($this->gerantA);

        $reponse = $this->getJson('/api/notifications')->assertOk();
        $ids = collect($reponse->json('data'))->pluck('id');

        $this->assertTrue($ids->contains($mienne->id));
        $this->assertFalse(
            $ids->contains($broadcast->id),
            'Une notification sans destinataire ne doit pas etre lue par un utilisateur au hasard.'
        );
    }

    public function test_le_compteur_de_non_lues_est_scope_a_l_utilisateur(): void
    {
        $this->creerNotification($this->gerantA, 'Non lue A');
        $this->creerNotification($this->gerantA, 'Non lue A 2');
        $this->creerNotification($this->gerantB, 'Non lue B');
        $this->creerNotification(null, 'Broadcast');

        Sanctum::actingAs($this->gerantA);

        $this->getJson('/api/notifications/unread-count')
            ->assertOk()
            ->assertJson(['count' => 2]);
    }

    public function test_tout_marquer_comme_lu_ne_touche_que_ses_notifications(): void
    {
        $mienne = $this->creerNotification($this->gerantA, 'A');
        $autre = $this->creerNotification($this->gerantB, 'B');
        $broadcast = $this->creerNotification(null, 'C');

        Sanctum::actingAs($this->gerantA);
        $this->postJson('/api/notifications/mark-all-read')->assertOk();

        $this->assertNotNull($mienne->fresh()->read_at);
        $this->assertNull($autre->fresh()->read_at, 'La notification d autrui ne doit pas etre modifiee.');
        $this->assertNull($broadcast->fresh()->read_at, 'La notification broadcast ne doit pas etre modifiee.');
    }

    // ==================== MARQUAGE UNIDIRECTIONNEL ====================

    public function test_on_peut_marquer_sa_propre_notification_comme_lue(): void
    {
        $mienne = $this->creerNotification($this->gerantA, 'A');

        Sanctum::actingAs($this->gerantA);
        $this->postJson("/api/notifications/{$mienne->id}/read")->assertOk();

        $this->assertNotNull($mienne->fresh()->read_at);
    }

    public function test_marquer_la_notification_d_autrui_comme_lue_est_refuse_et_sans_effet(): void
    {
        $autre = $this->creerNotification($this->gerantB, 'Notification de B');

        Sanctum::actingAs($this->gerantA);
        $this->postJson("/api/notifications/{$autre->id}/read")->assertNotFound();

        $this->assertNull(
            $autre->fresh()->read_at,
            'Une notification d un autre compte ne doit pas pouvoir etre modifiee.'
        );
    }

    public function test_marquer_une_notification_broadcast_comme_lue_est_refuse(): void
    {
        $broadcast = $this->creerNotification(null, 'Diffusee');

        Sanctum::actingAs($this->gerantA);
        $this->postJson("/api/notifications/{$broadcast->id}/read")->assertNotFound();

        $this->assertNull($broadcast->fresh()->read_at);
    }

    // ==================== GÉNÉRATION DES ALERTES ====================

    public function test_les_alertes_de_stock_ne_traversent_pas_les_boutiques(): void
    {
        $this->creerProduit($this->boutiqueA, 'Riz A', 2, seuil: 3);
        $this->creerProduit($this->boutiqueB, 'Riz B', 2, seuil: 3);

        $created = NotificationController::generateStockAlerts($this->boutiqueA->id);

        $this->assertSame(1, $created, 'Seul le produit de la boutique A doit alerter.');

        $this->assertSame(0, AppNotification::where('user_id', $this->gerantB->id)->count());
        $this->assertSame(1, AppNotification::where('user_id', $this->gerantA->id)->count());
    }

    public function test_une_alerte_porte_la_boutique_et_ne_divulgue_pas_le_stock_d_autre_tenant(): void
    {
        $produitA = $this->creerProduit($this->boutiqueA, 'Riz A', 2, seuil: 3);
        $produitSecret = $this->creerProduit($this->boutiqueB, 'Secret B', 1, seuil: 3);

        NotificationController::generateStockAlerts($this->boutiqueA->id);

        $alerte = AppNotification::where('user_id', $this->gerantA->id)->firstOrFail();

        $this->assertSame($this->boutiqueA->id, $alerte->data['boutique_id'] ?? null);
        $this->assertSame(
            $produitA->id,
            $alerte->data['produit_id'] ?? null,
            'L alerte doit pointer vers le produit de sa propre boutique.'
        );
        $this->assertStringContainsString($produitA->nom, $alerte->title);
        $this->assertStringNotContainsString(
            $produitSecret->nom,
            $alerte->title.' '.$alerte->message,
            'Le titre d une alerte ne doit pas mentionner un produit d une autre boutique.'
        );
    }

    public function test_la_generation_ne_cree_rien_pour_une_boutique_sans_gerant(): void
    {
        $this->creerProduit($this->boutiqueA, 'Riz A', 1, seuil: 3);

        $proprietaire = User::where('email', 'proprio-notif@sgci.bj')->firstOrFail();
        $this->boutiqueA->users()->detach($this->gerantA->id);

        $this->assertSame(0, NotificationController::generateStockAlerts($this->boutiqueA->id));
    }

    public function test_la_commande_planifiee_ne_ditribue_rien_hors_tenant(): void
    {
        $this->creerProduit($this->boutiqueA, 'Riz A', 2, seuil: 3);
        $this->creerProduit($this->boutiqueB, 'Riz B', 2, seuil: 3);

        // La commande est planifiee toutes les heures : c'est elle qui
        // declenchait la fuite en appelant generateStockAlerts() sans boutique.
        $this->artisan('sgci:sync-stock-alerts')->assertSuccessful();

        $this->assertSame(1, AppNotification::where('user_id', $this->gerantA->id)->count());
        $this->assertSame(1, AppNotification::where('user_id', $this->gerantB->id)->count());

        // Aucun gérant ne doit avoir reçu une alerte pour l'autre boutique.
        $alerteA = AppNotification::where('user_id', $this->gerantA->id)->firstOrFail();
        $alerteB = AppNotification::where('user_id', $this->gerantB->id)->firstOrFail();

        $this->assertSame($this->boutiqueA->id, $alerteA->data['boutique_id']);
        $this->assertSame($this->boutiqueB->id, $alerteB->data['boutique_id']);
    }

    public function test_la_generation_est_idempotente_pour_une_boutique(): void
    {
        $this->creerProduit($this->boutiqueA, 'Riz A', 2, seuil: 3);

        $premiere = NotificationController::generateStockAlerts($this->boutiqueA->id);
        $seconde = NotificationController::generateStockAlerts($this->boutiqueA->id);

        $this->assertSame(1, $premiere);
        $this->assertSame(0, $seconde, 'La commande tourne toutes les heures : pas de doublon.');
    }
}
