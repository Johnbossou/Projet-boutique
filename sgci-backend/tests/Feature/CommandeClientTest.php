<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\Categorie;
use App\Models\Client;
use App\Models\CommandeClient;
use App\Models\Produit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CommandeClientTest extends TestCase
{
    use RefreshDatabase;

    private Boutique $boutique;

    private User $gerant;

    private Client $client;

    private Produit $produit;

    protected function setUp(): void
    {
        parent::setUp();

        $this->gerant = User::create([
            'name' => 'Gérant Commande',
            'email' => 'gerant-commande@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);

        $this->boutique = Boutique::create([
            'nom' => 'Boutique Commande',
            'adresse' => 'Dassa',
            'proprietaire_id' => $this->gerant->id,
        ]);

        $this->gerant->boutiques()->attach($this->boutique->id, ['role_dans_boutique' => 'gerant']);
        $this->gerant->update(['current_boutique_id' => $this->boutique->id]);

        $this->client = Client::create([
            'nom' => 'Client Commande',
            'email' => 'client-commande@sgci.bj',
            'telephone' => '22997000000',
            'boutique_id' => $this->boutique->id,
        ]);

        $cat = Categorie::create(['nom' => 'Cat C', 'description' => 'C', 'couleur' => '#000', 'icone' => 'box']);
        $this->produit = Produit::create([
            'nom' => 'Produit C',
            'description' => 'Test',
            'prix' => 10000,
            'quantite_stock' => 30,
            'seuil_alerte' => 5,
            'categorie_id' => $cat->id,
            'unite_mesure' => 'unite',
            'boutique_id' => $this->boutique->id,
        ]);
    }

    private function creerCommande(string $statut = 'en_attente', ?Boutique $boutique = null): CommandeClient
    {
        return CommandeClient::create([
            'numero_commande' => 'CMD-'.uniqid(),
            'client_id' => $this->client->id,
            'boutique_id' => $boutique ? $boutique->id : $this->boutique->id,
            'date_commande' => now(),
            'statut' => $statut,
            'montant_total' => 20000,
            'montant_paye' => 0,
            'mode_paiement' => 'especes',
            'notes' => 'test',
            'user_id' => $this->gerant->id,
        ]);
    }

    public function test_store_cree_commande_en_attente(): void
    {
        Sanctum::actingAs($this->gerant);

        $this->postJson('/api/commandes-clients', [
            'client_id' => $this->client->id,
            'date_livraison_prevue' => now()->addDays(15)->format('Y-m-d'),
            'mode_paiement' => 'especes',
            'notes' => 'Urgent',
            'lignes' => [
                [
                    'produit_id' => $this->produit->id,
                    'quantite' => 2,
                    'prix_unitaire' => 10000,
                    'remise_pourcentage' => 0,
                ],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('data.statut', 'en_attente')
            ->assertJsonPath('data.client_id', $this->client->id)
            ->assertJsonCount(1, 'data.lignes');

        $this->assertDatabaseHas('commande_clients', [
            'boutique_id' => $this->boutique->id,
            'client_id' => $this->client->id,
            'statut' => 'en_attente',
            'montant_total' => 20000.00,
        ]);

        $this->assertDatabaseHas('lignes_commande_clients', [
            'produit_id' => $this->produit->id,
            'quantite' => 2,
            'prix_unitaire' => 10000.00,
        ]);
    }

    public function test_store_errors_de_validation(): void
    {
        Sanctum::actingAs($this->gerant);

        $this->postJson('/api/commandes-clients', [
            'lignes' => [],
        ])
            ->assertStatus(422);

        $this->postJson('/api/commandes-clients', [
            'client_id' => $this->client->id,
            'lignes' => [
                ['produit_id' => $this->produit->id, 'quantite' => 0, 'prix_unitaire' => -5],
            ],
        ])
            ->assertStatus(422);

        $this->assertDatabaseCount('commande_clients', 0);
    }

    public function test_index_scope_a_la_boutique_courante(): void
    {
        Sanctum::actingAs($this->gerant);

        $this->creerCommande('en_attente');

        $otherBoutique = Boutique::create([
            'nom' => 'Autre',
            'adresse' => 'Abomey',
            'proprietaire_id' => $this->gerant->id,
        ]);
        $this->creerCommande('livre', $otherBoutique);

        $response = $this->getJson('/api/commandes-clients');

        $response->assertOk()
            ->assertJsonPath('total', 1);

        $ids = collect($response->json('data'))->pluck('id');
        $this->assertSame(
            CommandeClient::where('boutique_id', $this->boutique->id)->pluck('id')->all(),
            $ids->all()
        );
    }

    public function test_valider_transition(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande('en_attente');

        $this->postJson("/api/commandes-clients/{$commande->id}/valider")
            ->assertOk()
            ->assertJsonPath('data.statut', 'en_cours');

        $this->assertDatabaseHas('commande_clients', [
            'id' => $commande->id,
            'statut' => 'en_cours',
        ]);
    }

    public function test_livrer_transition(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande('en_cours');

        $this->postJson("/api/commandes-clients/{$commande->id}/livrer")
            ->assertOk()
            ->assertJsonPath('data.statut', 'livre');

        $this->assertDatabaseHas('commande_clients', [
            'id' => $commande->id,
            'statut' => 'livre',
        ]);

        $this->assertSame(
            30,
            $this->produit->fresh()->quantite_stock,
            'La livraison ne doit pas decrementer le stock'
        );
    }

    public function test_annuler_transition(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande('en_attente');

        $this->postJson("/api/commandes-clients/{$commande->id}/annuler")
            ->assertOk()
            ->assertJsonPath('data.statut', 'annule');

        $this->assertDatabaseHas('commande_clients', [
            'id' => $commande->id,
            'statut' => 'annule',
        ]);
    }

    public function test_annuler_signale_le_montant_encaisse(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande('en_cours');
        $commande->update(['montant_total' => 5000, 'montant_paye' => 5000]);

        // Une commande deja payee ne peut pas etre annulee sans que l'argent
        // encaisse soit signale : le rembordement effectif est une decision
        // metier, mais le silence ne doit pas etre l'etat par defaut.
        // Le message du premier appel doit signaler l'argent deja encaisse.
        $reponse = $this->postJson("/api/commandes-clients/{$commande->id}/annuler")
            ->assertOk()
            ->assertJsonPath('montant_paye', 5000)
            ->assertJsonPath('data.statut', 'annule');

        $this->assertStringContainsString(
            '5000',
            (string) $reponse->json('message')
        );
    }

    public function test_annuler_refuse_une_commande_deja_traitee(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande('en_cours');
        $commande->update(['statut' => 'livre']);

        // Le second appel doit etre refuse explicitement, pas accepte en
        // silence : c est ce qui distingue le comportement correct d une double
        // annulation concurrente.
        $this->postJson("/api/commandes-clients/{$commande->id}/annuler")
            ->assertStatus(409)
            ->assertJsonPath('statut', 'livre');
    }

    public function test_commande_dune_autre_boutique_inaccessible(): void
    {
        Sanctum::actingAs($this->gerant);

        $otherBoutique = Boutique::create([
            'nom' => 'Boutique Autre',
            'adresse' => 'Cotonou',
            'proprietaire_id' => $this->gerant->id,
        ]);

        $commande = $this->creerCommande('en_attente', $otherBoutique);

        $this->getJson("/api/commandes-clients/{$commande->id}")->assertStatus(403);
        $this->postJson("/api/commandes-clients/{$commande->id}/valider")->assertStatus(403);
        $this->postJson("/api/commandes-clients/{$commande->id}/annuler")->assertStatus(403);
        $this->postJson("/api/commandes-clients/{$commande->id}/livrer")->assertStatus(403);

        $this->assertDatabaseHas('commande_clients', [
            'id' => $commande->id,
            'statut' => 'en_attente',
        ]);
    }

    public function test_caissier_interdit_sur_store(): void
    {
        $caissier = User::create([
            'name' => 'Caissier',
            'email' => 'caissier-commande@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'caissier',
            'est_actif' => true,
        ]);
        $caissier->boutiques()->attach($this->boutique->id, ['role_dans_boutique' => 'caissier']);
        $caissier->update(['current_boutique_id' => $this->boutique->id]);

        Sanctum::actingAs($caissier);

        $this->postJson('/api/commandes-clients', [
            'client_id' => $this->client->id,
            'lignes' => [
                ['produit_id' => $this->produit->id, 'quantite' => 1, 'prix_unitaire' => 1000],
            ],
        ])
            ->assertStatus(403);

        $this->assertDatabaseCount('commande_clients', 0);
    }

    // --- TVA : même régime que la caisse -------------------------------
    // Sans cette ligne, le même produit était taxé à 18 % à la caisse et à
    // 0 % en commande : les clients contournaient la TVA en commandant.

    public function test_store_applique_la_tva_du_taux_boutique(): void
    {
        Sanctum::actingAs($this->gerant);

        $reponse = $this->postJson('/api/commandes-clients', [
            'client_id' => $this->client->id,
            'lignes' => [
                ['produit_id' => $this->produit->id, 'quantite' => 2, 'prix_unitaire' => 10000],
            ],
        ])->assertCreated();

        // base HT 20 000, TVA 18 % = 3 600, le client doit 23 600
        $this->assertDatabaseHas('commande_clients', [
            'boutique_id' => $this->boutique->id,
            'montant_total' => 20000.00,
            'tva' => 3600.00,
        ]);

        $commande = CommandeClient::firstOrFail();
        $this->assertSame(23600.0, (float) $commande->montant_a_payer);
        $this->assertArrayHasKey('montant_a_payer', $reponse->json('data'));
        $this->assertEquals(23600, $reponse->json('data.montant_a_payer'));
    }

    public function test_store_calcule_la_tva_sur_la_base_apres_remise(): void
    {
        Sanctum::actingAs($this->gerant);

        $this->postJson('/api/commandes-clients', [
            'client_id' => $this->client->id,
            'lignes' => [
                ['produit_id' => $this->produit->id, 'quantite' => 2, 'prix_unitaire' => 10000, 'remise_pourcentage' => 10],
            ],
        ])->assertCreated();

        // remise ligne 10 % → base 18 000, TVA calculée sur LA BASE RÉELLE
        // facturée (3 240), pas sur le prix d'appel
        $this->assertDatabaseHas('commande_clients', [
            'montant_total' => 18000.00,
            'tva' => 3240.00,
        ]);
    }

    public function test_store_respecte_le_taux_personnalise_de_la_boutique(): void
    {
        Sanctum::actingAs($this->gerant);

        $this->boutique->update(['taux_tva' => 10]);

        $this->postJson('/api/commandes-clients', [
            'client_id' => $this->client->id,
            'lignes' => [
                ['produit_id' => $this->produit->id, 'quantite' => 1, 'prix_unitaire' => 10000],
            ],
        ])->assertCreated();

        $this->assertDatabaseHas('commande_clients', [
            'montant_total' => 10000.00,
            'tva' => 1000.00,
        ]);
    }

    public function test_une_commande_sans_tva_reste_en_ht_egale_au_ttc(): void
    {
        // Création hors API (commandes antérieures à la colonne) : tva = 0,
        // a_payer = total — exactement ce qui a été encaissé, aucun rétroactif.
        $commande = $this->creerCommande();

        $this->assertSame(20000.0, (float) $commande->montant_a_payer);
        $this->assertSame(20000.0, (float) $commande->montant_restant);
        $this->assertFalse($commande->estPayee());

        $commande->update(['montant_paye' => 20000]);

        $this->assertTrue($commande->fresh()->estPayee());
    }

    public function test_est_payee_compare_au_ttc_et_non_a_la_base_ht(): void
    {
        $commande = $this->creerCommande();
        $commande->update(['tva' => 3600]); // dû : 23 600

        // Payer la base HT seule ne solde PAS la commande (11 800 restent
        // dûs sur une base de 10 000 au taux normal)
        $commande->update(['montant_paye' => 20000]);

        $this->assertFalse($commande->fresh()->estPayee());
        $this->assertSame(3600.0, (float) $commande->fresh()->montant_restant);

        $commande->update(['montant_paye' => 23600]);

        $this->assertTrue($commande->fresh()->estPayee());
        $this->assertSame(0.0, (float) $commande->fresh()->montant_restant);
    }
}
