<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\Categorie;
use App\Models\Client;
use App\Models\ClientFidelite;
use App\Models\Produit;
use App\Models\ProgrammeFidelite;
use App\Models\TransactionPoints;
use App\Models\User;
use App\Models\Vente;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Crédit des points fidélité à la vente (décision actée : « créditer à
 * l'achat », libellé UI « pts/achat » = montant fixe par vente).
 *
 * Couvre les 3 chemins de création/finalisation d'une vente
 * (store direct, checkout puis terminer, sync offline), l'idempotence par
 * `vente_id`, l'isolation entre boutiques et la reprise des points à
 * l'annulation.
 */
class FidelitePointsVenteTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->sansProvisionnerBoutique();
    }

    private function proprio(string $email = 'proprio-fid@sgci.bj'): User
    {
        return User::create([
            'name' => 'Propriétaire', 'email' => $email,
            'password' => Hash::make('password'), 'role' => 'proprietaire', 'est_actif' => true,
        ]);
    }

    private function boutiqueDe(User $p, string $nom): Boutique
    {
        $b = Boutique::create([
            'nom' => $nom, 'devise' => 'XOF', 'taux_tva' => 18,
            'proprietaire_id' => $p->id,
        ]);
        $b->users()->attach($p->id, ['role_dans_boutique' => 'proprietaire']);
        $p->forceFill(['current_boutique_id' => $b->id])->save();

        return $b;
    }

    private function clientDans(Boutique $b, string $email = 'client-fid@sgci.bj'): Client
    {
        return Client::create([
            'nom' => 'Client', 'email' => $email, 'telephone' => '22997000002',
            'boutique_id' => $b->id,
        ]);
    }

    private function produitDans(Boutique $b, int $stock = 10, float $prix = 1000): Produit
    {
        $cat = Categorie::first() ?? Categorie::create([
            'nom' => 'Cat '.$b->id, 'description' => 'x', 'couleur' => '#000', 'icone' => 'box',
        ]);

        return Produit::create([
            'nom' => 'Article', 'description' => 'x', 'prix' => $prix,
            'quantite_stock' => $stock, 'seuil_alerte' => 2,
            'categorie_id' => $cat->id, 'unite_mesure' => 'unite',
            'boutique_id' => $b->id,
        ]);
    }

    private function programmePour(Boutique $b, int $pointsParAchat = 10, bool $actif = true): ProgrammeFidelite
    {
        return ProgrammeFidelite::create([
            'boutique_id' => $b->id,
            'nom' => 'Programme '.$b->nom,
            'points_par_achat' => $pointsParAchat,
            'valeur_point' => 5,
            'niveaux' => [
                ['nom' => 'Débutant', 'points_min' => 0, 'remise_pourcentage' => 0],
                ['nom' => 'Silver', 'points_min' => 50, 'remise_pourcentage' => 5],
            ],
            'actif' => $actif,
        ]);
    }

    private function venteDirecte(Client $client, Produit $produit, int $quantite = 1): array
    {
        return [
            'ligne_ventes' => [['produit_id' => $produit->id, 'quantite' => $quantite]],
            'client_id' => $client->id,
        ];
    }

    private function pointsDe(Client $client, ProgrammeFidelite $programme): ?ClientFidelite
    {
        return ClientFidelite::where('programme_fidelite_id', $programme->id)
            ->where('client_id', $client->id)
            ->first();
    }

    // ------------------------------------------------- store (vente directe)

    public function test_store_credite_les_points_du_programme_et_inscrit_le_client(): void
    {
        $p = $this->proprio();
        $b = $this->boutiqueDe($p, 'Boutique Store');
        Sanctum::actingAs($p);

        $programme = $this->programmePour($b, pointsParAchat: 10);
        $client = $this->clientDans($b);
        $produit = $this->produitDans($b);

        $this->postJson('/api/ventes', $this->venteDirecte($client, $produit))
            ->assertCreated();

        $compte = $this->pointsDe($client, $programme);

        $this->assertNotNull($compte, 'Le client doit être inscrit au programme à son premier achat');
        $this->assertSame(10, $compte->points);

        // La transaction de crédit porte l'id de la vente : c'est elle qui
        // fonde l'idempotence et l'éventuelle reprise à l'annulation.
        $vente = Vente::where('client_id', $client->id)->firstOrFail();

        $this->assertDatabaseHas('transaction_points', [
            'client_fidelite_id' => $compte->id,
            'vente_id' => $vente->id,
            'type' => 'gain',
            'points' => 10,
        ]);
    }

    public function test_store_rejoue_avec_la_memcle_idempotence_ne_credite_qu_une_fois(): void
    {
        $p = $this->proprio();
        $b = $this->boutiqueDe($p, 'Boutique Idem');
        Sanctum::actingAs($p);

        $programme = $this->programmePour($b, pointsParAchat: 10);
        $client = $this->clientDans($b);
        $produit = $this->produitDans($b);

        $payload = $this->venteDirecte($client, $produit) + ['idempotency_key' => 'offline-001'];

        $this->postJson('/api/ventes', $payload)->assertCreated();
        // Rejeu réseau : même clé, vente retournée telle quelle.
        $this->postJson('/api/ventes', $payload)->assertOk();

        $this->assertSame(10, $this->pointsDe($client, $programme)->points);
        $this->assertSame(
            1,
            TransactionPoints::where('type', 'gain')->count(),
            'Un seul crédit pour une vente rejouée'
        );
    }

    public function test_store_sans_programme_actif_ne_credite_rien(): void
    {
        $p = $this->proprio();
        $b = $this->boutiqueDe($p, 'Boutique Sans Prog');
        Sanctum::actingAs($p);

        $this->programmePour($b, pointsParAchat: 10, actif: false);
        $client = $this->clientDans($b);
        $produit = $this->produitDans($b);

        $this->postJson('/api/ventes', $this->venteDirecte($client, $produit))
            ->assertCreated();

        $this->assertDatabaseCount('client_fidelites', 0);
        $this->assertDatabaseCount('transaction_points', 0);
    }

    public function test_store_sans_client_ne_credite_rien(): void
    {
        $p = $this->proprio();
        $b = $this->boutiqueDe($p, 'Boutique Anonyme');
        Sanctum::actingAs($p);

        $this->programmePour($b);
        $produit = $this->produitDans($b);

        $this->postJson('/api/ventes', [
            'ligne_ventes' => [['produit_id' => $produit->id, 'quantite' => 1]],
        ])->assertCreated();

        $this->assertDatabaseCount('client_fidelites', 0);
    }

    public function test_store_ne_credite_pas_avec_le_programme_d_une_autre_boutique(): void
    {
        $p = $this->proprio();
        $bA = $this->boutiqueDe($p, 'Boutique A');
        Sanctum::actingAs($p);

        // Programme actif, mais rattaché à une autre agence : aucun crédit.
        $programmeAutre = ProgrammeFidelite::create([
            'boutique_id' => $this->boutiqueDe($this->proprio('pb@sgci.bj'), 'Boutique B')->id,
            'nom' => 'Programme B',
            'points_par_achat' => 10,
            'valeur_point' => 5,
            'actif' => true,
        ]);

        $client = $this->clientDans($bA);
        $produit = $this->produitDans($bA);

        $this->postJson('/api/ventes', $this->venteDirecte($client, $produit))
            ->assertCreated();

        $this->assertNull($this->pointsDe($client, $programmeAutre));
        $this->assertDatabaseCount('transaction_points', 0);
    }

    // ------------------------------------------- checkout puis terminer

    public function test_terminer_credite_les_points(): void
    {
        $p = $this->proprio();
        $b = $this->boutiqueDe($p, 'Boutique Terminer');
        Sanctum::actingAs($p);

        $programme = $this->programmePour($b, pointsParAchat: 10);
        $client = $this->clientDans($b);
        $produit = $this->produitDans($b);

        $venteId = $this->postJson('/api/ventes/checkout', [
            'ligne_ventes' => [['produit_id' => $produit->id, 'quantite' => 1]],
            'client_id' => $client->id,
        ])->assertCreated()->json('id');

        // Vente « en cours » : rien n'est encore crédité.
        $this->assertNull($this->pointsDe($client, $programme));

        $this->postJson("/api/ventes/{$venteId}/terminer", [])->assertOk();

        $this->assertSame(10, $this->pointsDe($client, $programme)->points);
    }

    public function test_reterminer_apres_annulation_ne_recredite_pas(): void
    {
        // annuler() sur « en_cours » puis terminer() est refusé (409) : le
        // point de vigilance est que l'annulation d'une vente EN COURS ne
        // déclenche aucune reprise de points inexistant (no-op, pas d'erreur).
        $p = $this->proprio();
        $b = $this->boutiqueDe($p, 'Boutique Annul');
        Sanctum::actingAs($p);

        $programme = $this->programmePour($b);
        $client = $this->clientDans($b);
        $produit = $this->produitDans($b);

        $venteId = $this->postJson('/api/ventes/checkout', [
            'ligne_ventes' => [['produit_id' => $produit->id, 'quantite' => 1]],
            'client_id' => $client->id,
        ])->assertCreated()->json('id');

        $this->postJson("/api/ventes/{$venteId}/annuler", [])->assertOk();

        $this->assertDatabaseCount('transaction_points', 0);
        $this->assertNull($this->pointsDe($client, $programme));
    }

    // ------------------------------------------------------- sync offline

    public function test_sync_offline_credite_les_points(): void
    {
        $p = $this->proprio();
        $b = $this->boutiqueDe($p, 'Boutique Offline');
        Sanctum::actingAs($p);

        $programme = $this->programmePour($b, pointsParAchat: 7);
        $client = $this->clientDans($b);
        $produit = $this->produitDans($b);

        $this->postJson('/api/ventes/sync-offline-batch', [
            'ventes' => [[
                'ligne_ventes' => [['produit_id' => $produit->id, 'quantite' => 1]],
                'client_id' => $client->id,
                'idempotency_key' => 'batch-001',
                'created_at' => now()->toIso8601String(),
            ]],
        ])->assertOk();

        $this->assertSame(7, $this->pointsDe($client, $programme)->points);
    }

    // ------------------------------------------------------- annulation

    public function test_annulation_reprend_les_points_credits(): void
    {
        $p = $this->proprio();
        $b = $this->boutiqueDe($p, 'Boutique Reprise');
        Sanctum::actingAs($p);

        $programme = $this->programmePour($b, pointsParAchat: 10);
        $client = $this->clientDans($b);
        $produit = $this->produitDans($b);

        // Vente réelle (créée terminée et créditée par l'API), puis annulée
        // dans le délai : les 10 points doivent être repris.
        $venteId = $this->postJson('/api/ventes', $this->venteDirecte($client, $produit))
            ->assertCreated()
            ->json('id');

        $this->assertSame(10, $this->pointsDe($client, $programme)->points);

        $this->postJson("/api/ventes/{$venteId}/annuler", [])->assertOk();

        $compte = $this->pointsDe($client, $programme);

        $this->assertSame(0, $compte->points, 'Les points de l'.'achat annulé sont repris');
        $this->assertDatabaseHas('transaction_points', [
            'client_fidelite_id' => $compte->id,
            'vente_id' => $venteId,
            'type' => 'retrait',
            'points' => 10,
        ]);
    }

    public function test_annulation_reprise_bornee_au_solde_disponible(): void
    {
        // Le client a dépensé ses points entre le crédit et l'annulation :
        // la reprise est bornée, et l'annulation ne doit PAS échouer pour
        // autant (retirerPoints() refuserait sinon un retrait > solde).
        $p = $this->proprio();
        $b = $this->boutiqueDe($p, 'Boutique Bornage');
        Sanctum::actingAs($p);

        $programme = $this->programmePour($b, pointsParAchat: 10);
        $client = $this->clientDans($b);
        $produit = $this->produitDans($b);

        $venteId = $this->postJson('/api/ventes', $this->venteDirecte($client, $produit))
            ->assertCreated()
            ->json('id');

        // 10 points crédités par la vente, puis 8 dépensés : reste 2.
        $compte = $this->pointsDe($client, $programme);
        $compte->retirerPoints(8, 'Réclamation: test');

        $this->postJson("/api/ventes/{$venteId}/annuler", [])->assertOk();

        $this->assertSame(0, $compte->refresh()->points, 'Solde 2 - reprise bornée à 2');
        $this->assertDatabaseHas('transaction_points', [
            'vente_id' => $venteId,
            'type' => 'retrait',
            'points' => 2,
        ]);
    }

    public function test_annulation_sans_credit_precedent_est_un_no_op(): void
    {
        $p = $this->proprio();
        $b = $this->boutiqueDe($p, 'Boutique NoOp');
        Sanctum::actingAs($p);

        $programme = $this->programmePour($b, pointsParAchat: 10);
        $client = $this->clientDans($b);

        // Compte pré-existant avec 5 points d'une autre provenance.
        $compte = ClientFidelite::create([
            'programme_fidelite_id' => $programme->id,
            'client_id' => $client->id,
            'points' => 5,
            'niveau_actuel' => 'Débutant',
            'date_inscription' => now(),
        ]);

        $vente = Vente::create([
            'user_id' => $p->id,
            'client_id' => $client->id,
            'statut' => 'termine',
            'montant_total' => 1000,
            'tva' => 180,
            'mode_paiement' => 'especes',
            'boutique_id' => $b->id,
            'created_at' => now(),
        ]);

        $this->postJson("/api/ventes/{$vente->id}/annuler", [])->assertOk();

        // Aucun gain n'a été enregistré pour cette vente : rien à reprendre,
        // les 5 points d'origine restent intacts.
        $this->assertSame(5, $compte->refresh()->points);
    }

    public function test_double_annulation_ne_reprend_pas_deux_fois(): void
    {
        $p = $this->proprio();
        $b = $this->boutiqueDe($p, 'Boutique Double');
        Sanctum::actingAs($p);

        $programme = $this->programmePour($b, pointsParAchat: 10);
        $client = $this->clientDans($b);
        $produit = $this->produitDans($b);

        $venteId = $this->postJson('/api/ventes', $this->venteDirecte($client, $produit))
            ->assertCreated()
            ->json('id');

        $this->postJson("/api/ventes/{$venteId}/annuler", [])->assertOk();
        // Second appel : le modèle refuse déjà (409, statut « annule »).
        $this->postJson("/api/ventes/{$venteId}/annuler", [])->assertStatus(409);

        $compte = $this->pointsDe($client, $programme);

        $this->assertSame(0, $compte->points);
        $this->assertSame(
            1,
            TransactionPoints::where('vente_id', $venteId)->where('type', 'retrait')->count(),
            'Une seule transaction de retrait par vente'
        );
    }
}
