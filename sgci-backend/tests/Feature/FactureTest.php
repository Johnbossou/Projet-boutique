<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\Categorie;
use App\Models\Client;
use App\Models\CommandeClient;
use App\Models\Facture;
use App\Models\LigneVente;
use App\Models\Produit;
use App\Models\User;
use App\Models\Vente;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FactureTest extends TestCase
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
            'name' => 'Gérant Facture',
            'email' => 'gerant-facture@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);

        $this->boutique = Boutique::create([
            'nom' => 'Boutique Facture',
            'adresse' => 'Dassa',
            'proprietaire_id' => $this->gerant->id,
        ]);

        $this->gerant->boutiques()->attach($this->boutique->id);
        $this->gerant->update(['current_boutique_id' => $this->boutique->id]);

        $this->client = Client::create([
            'nom' => 'Client Facture',
            'email' => 'client-facture@sgci.bj',
            'telephone' => '22997000000',
            'boutique_id' => $this->boutique->id,
        ]);

        $cat = Categorie::create(['nom' => 'Cat F', 'description' => 'F', 'couleur' => '#000', 'icone' => 'box']);
        $this->produit = Produit::create([
            'nom' => 'Produit F',
            'description' => 'Test',
            'prix' => 10000,
            'quantite_stock' => 30,
            'seuil_alerte' => 5,
            'categorie_id' => $cat->id,
            'unite_mesure' => 'unite',
            'boutique_id' => $this->boutique->id,
        ]);
    }

    private function creerVenteAvecLigne(): Vente
    {
        $vente = Vente::create([
            'montant_total' => 3000,
            'user_id' => $this->gerant->id,
            'client_id' => $this->client->id,
            'statut' => 'termine',
            'boutique_id' => $this->boutique->id,
        ]);

        LigneVente::create([
            'vente_id' => $vente->id,
            'produit_id' => $this->produit->id,
            'quantite' => 1,
            'prix_unitaire' => 3000,
        ]);

        return $vente;
    }

    private function creerCommande(): CommandeClient
    {
        return CommandeClient::create([
            'client_id' => $this->client->id,
            'boutique_id' => $this->boutique->id,
            'date_commande' => now(),
            'statut' => 'livre',
            'montant_total' => 20000,
            'montant_paye' => 0,
            'mode_paiement' => 'especes',
            'user_id' => $this->gerant->id,
        ]);
    }

    private function creerFacture(?Boutique $boutique = null, string $numero = 'FAC-TEST'): Facture
    {
        return Facture::create([
            'numero_facture' => $numero,
            'client_id' => $this->client->id,
            'boutique_id' => $boutique ? $boutique->id : $this->boutique->id,
            'date_facture' => now(),
            'montant_ht' => 100,
            'montant_tva' => 18,
            'montant_ttc' => 118,
            'statut' => 'en_attente',
            'envoyee' => false,
        ]);
    }

    private function dompdfEstInstalle(): bool
    {
        return class_exists(\Barryvdh\DomPDF\Facade\Pdf::class);
    }

    public function test_generer_vente_cree_une_facture(): void
    {
        Sanctum::actingAs($this->gerant);

        $vente = $this->creerVenteAvecLigne();

        $response = $this->postJson('/api/factures/generer-vente', ['vente_id' => $vente->id]);

        $this->assertDatabaseHas('factures', [
            'vente_id' => $vente->id,
            'client_id' => $this->client->id,
            'boutique_id' => $this->boutique->id,
            'statut' => 'paye',
        ]);

        if ($this->dompdfEstInstalle()) {
            $response->assertOk();
        } else {
            $response->assertStatus(500);
        }
    }

    public function test_generer_commande_cree_une_facture(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande();

        $response = $this->postJson('/api/factures/generer-commande', ['commande_client_id' => $commande->id]);

        $this->assertDatabaseHas('factures', [
            'commande_client_id' => $commande->id,
            'client_id' => $this->client->id,
            'boutique_id' => $this->boutique->id,
            'statut' => 'en_attente',
        ]);

        if ($this->dompdfEstInstalle()) {
            $response->assertOk();
        } else {
            $response->assertStatus(500);
        }
    }

    public function test_index_scope_a_la_boutique_courante(): void
    {
        Sanctum::actingAs($this->gerant);

        $this->creerFacture(null, 'FAC-INDEX-1');

        $otherBoutique = Boutique::create([
            'nom' => 'Autre',
            'adresse' => 'Abomey',
            'proprietaire_id' => $this->gerant->id,
        ]);
        $this->creerFacture($otherBoutique, 'FAC-INDEX-2');

        $response = $this->getJson('/api/factures');

        $response->assertOk()
            ->assertJsonPath('total', 1);

        $ids = collect($response->json('data'))->pluck('id');
        $this->assertSame(
            Facture::where('boutique_id', $this->boutique->id)->pluck('id')->all(),
            $ids->all()
        );
    }

    public function test_show_facture_dune_autre_boutique_inaccessible(): void
    {
        Sanctum::actingAs($this->gerant);

        $otherBoutique = Boutique::create([
            'nom' => 'Boutique Autre',
            'adresse' => 'Cotonou',
            'proprietaire_id' => $this->gerant->id,
        ]);

        $facture = $this->creerFacture($otherBoutique, 'FAC-ISO-1');

        $this->getJson("/api/factures/{$facture->id}")->assertStatus(403);
    }

    public function test_generer_du_jour_reserve_au_proprietaire(): void
    {
        Sanctum::actingAs($this->gerant);

        $this->postJson('/api/factures/generer-du-jour')->assertStatus(403);

        $proprietaire = User::create([
            'name' => 'Propriétaire',
            'email' => 'proprio-facture@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'proprietaire',
            'est_actif' => true,
        ]);

        $boutiqueProprio = Boutique::create([
            'nom' => 'Boutique Proprio',
            'adresse' => 'Parakou',
            'proprietaire_id' => $proprietaire->id,
        ]);
        $proprietaire->update(['current_boutique_id' => $boutiqueProprio->id]);

        Sanctum::actingAs($proprietaire);

        $this->postJson('/api/factures/generer-du-jour')
            ->assertOk()
            ->assertJsonPath('data.factures_generees', 0);
    }

    public function test_telecharger_pdf(): void
    {
        Sanctum::actingAs($this->gerant);

        Storage::disk('public')->put('factures/FAC-TEST.pdf', 'pdf-content');

        $facture = $this->creerFacture(null, 'FAC-PDF-1');
        $facture->update(['chemin_pdf' => 'factures/FAC-TEST.pdf']);

        $this->get("/api/factures/{$facture->id}/telecharger-pdf")
            ->assertOk();
    }
}