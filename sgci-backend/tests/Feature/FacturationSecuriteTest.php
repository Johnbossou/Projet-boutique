<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\Categorie;
use App\Models\Client;
use App\Models\CommandeClient;
use App\Models\Devis;
use App\Models\LigneDevis;
use App\Models\LigneVente;
use App\Models\Produit;
use App\Models\User;
use App\Models\Vente;
use App\Services\FacturationService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Couvre les correctifs du workflow Devis & facturation :
 * isolation boutique de la génération du jour, verrouillage des
 * générateurs et de la conversion, séquenceur DEV-, et non-divulgation
 * d'existence sur generer-vente.
 */
class FacturationSecuriteTest extends TestCase
{
    use RefreshDatabase;

    private Boutique $boutique;

    private Boutique $autreBoutique;

    private User $proprietaire;

    private User $gerant;

    private Client $client;

    private Client $clientAutre;

    private Produit $produit;

    protected function setUp(): void
    {
        parent::setUp();

        $this->proprietaire = User::create([
            'name' => 'Propriétaire Facturation',
            'email' => 'proprietaire-facturation@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'proprietaire',
            'est_actif' => true,
        ]);

        $this->gerant = User::create([
            'name' => 'Gérant Facturation',
            'email' => 'gerant-facturation@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);

        $this->boutique = Boutique::create([
            'nom' => 'Boutique Facturation',
            'adresse' => 'Dassa',
            'proprietaire_id' => $this->proprietaire->id,
        ]);

        $this->autreBoutique = Boutique::create([
            'nom' => 'Boutique Facturation 2',
            'adresse' => 'Abomey',
            'proprietaire_id' => $this->proprietaire->id,
        ]);

        // role_dans_boutique est obligatoire : User::roleDansBoutique() retombe
        // sur 'caissier' si le pivot est vide, et le middleware role.gerant
        // renvoie alors 403. Sans ce rôle, tous les appels /devis/*/convertir
        // sont refusés avant d'atteindre le contrôleur.
        $this->gerant->boutiques()->attach($this->boutique->id, [
            'role_dans_boutique' => 'gerant',
        ]);

        // Le propriétaire tire son rôle de la possession de la boutique
        // (User::roleDansBoutique étape 1), le pivot n'est pas nécessaire.
        $this->proprietaire->boutiques()->attach($this->boutique->id, ['role_dans_boutique' => 'proprietaire']);

        foreach ([$this->proprietaire, $this->gerant] as $user) {
            $user->forceFill(['current_boutique_id' => $this->boutique->id])->save();
        }

        // Le propriétaire contrôle aussi la seconde agence : c'est
        // exactement le cas qui fuyait avant le correctif.
        $this->proprietaire->boutiques()->attach($this->autreBoutique->id, ['role_dans_boutique' => 'proprietaire']);

        $this->client = Client::create([
            'nom' => 'Client Facturation',
            'email' => 'client-facturation@sgci.bj',
            'telephone' => '22997000000',
            'boutique_id' => $this->boutique->id,
        ]);

        $this->clientAutre = Client::create([
            'nom' => 'Client Autre Agence',
            'email' => 'client-autre-facturation@sgci.bj',
            'telephone' => '22997000001',
            'boutique_id' => $this->autreBoutique->id,
        ]);

        $cat = Categorie::create(['nom' => 'Cat FAC', 'description' => 'F', 'couleur' => '#000', 'icone' => 'box']);

        $this->produit = Produit::create([
            'nom' => 'Produit Facturation',
            'description' => 'Test',
            'prix' => 3000,
            'quantite_stock' => 30,
            'seuil_alerte' => 5,
            'categorie_id' => $cat->id,
            'unite_mesure' => 'unite',
            'boutique_id' => $this->boutique->id,
        ]);
    }

    private function creerVenteTerminee(?Boutique $boutique = null): Vente
    {
        $vente = Vente::create([
            'montant_total' => 3000,
            'user_id' => $this->gerant->id,
            'client_id' => $boutique === $this->autreBoutique ? $this->clientAutre->id : $this->client->id,
            'statut' => 'termine',
            'boutique_id' => ($boutique ?? $this->boutique)->id,
        ]);

        LigneVente::create([
            'vente_id' => $vente->id,
            'produit_id' => $this->produit->id,
            'quantite' => 1,
            'prix_unitaire' => 3000,
        ]);

        return $vente;
    }

    private function creerDevis(string $statut = 'accepte'): Devis
    {
        $devis = Devis::create([
            'client_id' => $this->client->id,
            'boutique_id' => $this->boutique->id,
            'date_devis' => now(),
            'date_validite' => now()->addDays(30),
            'statut' => $statut,
            'user_id' => $this->gerant->id,
            'montant_total' => 6000,
        ]);

        LigneDevis::create([
            'devis_id' => $devis->id,
            'produit_id' => $this->produit->id,
            'quantite' => 2,
            'prix_unitaire' => 3000,
            'remise_pourcentage' => 0,
            'montant_total' => 6000,
        ]);

        return $devis;
    }

    private function dompdfEstInstalle(): bool
    {
        return class_exists(Pdf::class);
    }

    // --- Isolation de la génération du jour -----------------------------

    public function test_generer_du_jour_ignore_les_ventes_d_une_autre_boutique(): void
    {
        $service = app(FacturationService::class);

        $venteCourante = $this->creerVenteTerminee($this->boutique);
        $venteAutre = $this->creerVenteTerminee($this->autreBoutique);

        $resultat = $service->genererEtEnvoyerFacturesDuJour($this->boutique->id);

        $this->assertDatabaseHas('factures', ['vente_id' => $venteCourante->id]);
        $this->assertDatabaseMissing('factures', ['vente_id' => $venteAutre->id]);

        $this->assertSame(1, $resultat['factures_generees']);
    }

    public function test_generer_du_jour_ignore_les_commandes_d_une_autre_boutique(): void
    {
        $service = app(FacturationService::class);

        $livree = CommandeClient::create([
            'client_id' => $this->client->id,
            'boutique_id' => $this->boutique->id,
            'date_commande' => now(),
            'date_livraison_reelle' => today(),
            'statut' => 'livre',
            'montant_total' => 5000,
            'montant_paye' => 5000,
            'user_id' => $this->gerant->id,
        ]);

        $livreeAutre = CommandeClient::create([
            'client_id' => $this->clientAutre->id,
            'boutique_id' => $this->autreBoutique->id,
            'date_commande' => now(),
            'date_livraison_reelle' => today(),
            'statut' => 'livre',
            'montant_total' => 7000,
            'montant_paye' => 7000,
            'user_id' => $this->gerant->id,
        ]);

        $service->genererEtEnvoyerFacturesDuJour($this->boutique->id);

        $this->assertDatabaseHas('factures', ['commande_client_id' => $livree->id]);
        $this->assertDatabaseMissing('factures', ['commande_client_id' => $livreeAutre->id]);
    }

    public function test_generer_du_jour_via_api_ne_touche_que_la_boutique_courante(): void
    {
        Sanctum::actingAs($this->proprietaire);

        $venteCourante = $this->creerVenteTerminee($this->boutique);
        $venteAutre = $this->creerVenteTerminee($this->autreBoutique);

        $reponse = $this->postJson('/api/factures/generer-du-jour');

        if ($this->dompdfEstInstalle()) {
            $reponse->assertOk();
        } else {
            $reponse->assertStatus(500);
        }

        $this->assertDatabaseHas('factures', ['vente_id' => $venteCourante->id]);
        $this->assertDatabaseMissing('factures', ['vente_id' => $venteAutre->id]);
    }

    public function test_generer_du_jour_ne_touche_a_aucune_autre_boutique_lorsque_la_courante_est_vide(): void
    {
        $service = app(FacturationService::class);

        $this->creerVenteTerminee($this->autreBoutique);

        $resultat = $service->genererEtEnvoyerFacturesDuJour($this->boutique->id);

        $this->assertSame(0, $resultat['factures_generees']);
        $this->assertDatabaseCount('factures', 0);
    }

    // --- Générateurs idempotents ----------------------------------------

    public function test_generer_deux_fois_pour_la_meme_vente_ne_cree_qu_une_facture(): void
    {
        $service = app(FacturationService::class);
        $vente = $this->creerVenteTerminee();

        $premiere = $service->genererFactureVente($vente);
        $seconde = $service->genererFactureVente($vente);

        $this->assertSame($premiere->id, $seconde->id);
        $this->assertDatabaseCount('factures', 1);
    }

    public function test_generer_deux_fois_pour_la_meme_commande_ne_cree_qu_une_facture(): void
    {
        $service = app(FacturationService::class);

        $commande = CommandeClient::create([
            'client_id' => $this->client->id,
            'boutique_id' => $this->boutique->id,
            'date_commande' => now(),
            'statut' => 'en_attente',
            'montant_total' => 5000,
            'montant_paye' => 0,
            'user_id' => $this->gerant->id,
        ]);

        $premiere = $service->genererFactureCommande($commande);
        $seconde = $service->genererFactureCommande($commande);

        $this->assertSame($premiere->id, $seconde->id);
        $this->assertDatabaseCount('factures', 1);
    }

    // --- Conversion de devis --------------------------------------------

    public function test_un_devis_ne_peut_etre_converti_qu_une_seule_fois(): void
    {
        Sanctum::actingAs($this->gerant);

        $devis = $this->creerDevis('accepte');

        $premiere = $this->postJson("/api/devis/{$devis->id}/convertir-commande");
        $seconde = $this->postJson("/api/devis/{$devis->id}/convertir-commande");

        $premiere->assertStatus(201);
        $seconde->assertStatus(409);

        $this->assertDatabaseCount('commande_clients', 1);
        $this->assertDatabaseHas('commande_clients', ['devis_id' => $devis->id]);
    }

    public function test_la_seconde_conversion_ne_duplique_pas_les_lignes(): void
    {
        Sanctum::actingAs($this->gerant);

        $devis = $this->creerDevis('accepte');

        $this->postJson("/api/devis/{$devis->id}/convertir-commande")->assertStatus(201);
        $this->postJson("/api/devis/{$devis->id}/convertir-commande")->assertStatus(409);

        $this->assertDatabaseCount('lignes_commande_clients', 1);
    }

    public function test_un_devis_refuse_ne_se_convertit_pas(): void
    {
        Sanctum::actingAs($this->gerant);

        $devis = $this->creerDevis('refuse');

        $this->postJson("/api/devis/{$devis->id}/convertir-commande")->assertStatus(409);

        $this->assertDatabaseCount('commande_clients', 0);
    }

    public function test_un_devis_en_attente_ne_se_convertit_pas(): void
    {
        Sanctum::actingAs($this->gerant);

        $devis = $this->creerDevis('en_attente');

        $this->postJson("/api/devis/{$devis->id}/convertir-commande")->assertStatus(409);

        $this->assertDatabaseCount('commande_clients', 0);
    }

    public function test_la_commande_convertie_reprend_le_montant_et_les_lignes_du_devis(): void
    {
        Sanctum::actingAs($this->gerant);

        $devis = $this->creerDevis('accepte');

        $this->postJson("/api/devis/{$devis->id}/convertir-commande")->assertStatus(201);

        $commande = CommandeClient::where('devis_id', $devis->id)->firstOrFail();

        $this->assertSame($devis->montant_total, $commande->montant_total);
        $this->assertSame(0.0, (float) $commande->montant_paye);
        $this->assertSame('en_attente', $commande->statut);
        $this->assertDatabaseCount('lignes_commande_clients', 1);
    }

    public function test_la_conversion_applique_la_tva_de_la_boutique(): void
    {
        Sanctum::actingAs($this->gerant);

        $devis = $this->creerDevis('accepte');

        $this->postJson("/api/devis/{$devis->id}/convertir-commande")->assertStatus(201);

        $commande = CommandeClient::where('devis_id', $devis->id)->firstOrFail();

        // Le devis reste une offre en HT (6 000) ; la commande convertie
        // applique le taux boutique : TVA 18 % = 1 080, le client doit
        // 7 080 — même régime que la caisse, sinon un devis accepté était
        // 18 % moins cher qu'un achat au comptoir.
        $this->assertSame(6000.0, (float) $commande->montant_total);
        $this->assertSame(1080.0, (float) $commande->tva);
        $this->assertSame(7080.0, (float) $commande->montant_a_payer);
    }

    // --- Séquenceur des devis ------------------------------------------

    public function test_les_devis_crees_dans_la_meme_seconde_ne_collident_pas(): void
    {
        $numeros = [
            Devis::create([
                'client_id' => $this->client->id,
                'boutique_id' => $this->boutique->id,
                'date_devis' => now(),
                'date_validite' => now()->addDays(30),
                'statut' => 'en_attente',
                'user_id' => $this->gerant->id,
                'montant_total' => 1000,
            ])->numero_devis,
            Devis::create([
                'client_id' => $this->client->id,
                'boutique_id' => $this->boutique->id,
                'date_devis' => now(),
                'date_validite' => now()->addDays(30),
                'statut' => 'en_attente',
                'user_id' => $this->gerant->id,
                'montant_total' => 1000,
            ])->numero_devis,
            Devis::create([
                'client_id' => $this->client->id,
                'boutique_id' => $this->boutique->id,
                'date_devis' => now(),
                'date_validite' => now()->addDays(30),
                'statut' => 'en_attente',
                'user_id' => $this->gerant->id,
                'montant_total' => 1000,
            ])->numero_devis,
        ];

        $this->assertCount(3, array_unique($numeros));

        foreach ($numeros as $numero) {
            $this->assertMatchesRegularExpression('/^DEV-\d{8}-\d{4}$/', $numero);
        }
    }

    // --- Non-divulgation d'existence ------------------------------------

    public function test_generer_vente_refuse_sans_divulguer_l_existence_d_une_vente_autre_boutique(): void
    {
        Sanctum::actingAs($this->gerant);

        $venteAutre = $this->creerVenteTerminee($this->autreBoutique);

        // 422 revealait qu'un id existe ailleurs ; on veut le même refus que
        // pour un id totalement inconnu.
        $reponse = $this->postJson('/api/factures/generer-vente', ['vente_id' => $venteAutre->id]);

        $this->assertContains($reponse->status(), [403, 404, 422]);
        $this->assertDatabaseCount('factures', 0);
    }

    public function test_generer_vente_refuse_un_id_inexistant_avec_le_meme_statut(): void
    {
        Sanctum::actingAs($this->gerant);

        $inexistant = $this->postJson('/api/factures/generer-vente', ['vente_id' => 999999])->status();

        $venteAutre = $this->creerVenteTerminee($this->autreBoutique);
        $existant = $this->postJson('/api/factures/generer-vente', ['vente_id' => $venteAutre->id])->status();

        $this->assertSame($inexistant, $existant);
    }

    public function test_generer_commande_refuse_sans_divulguer_l_existence_d_une_commande_autre_boutique(): void
    {
        Sanctum::actingAs($this->gerant);

        $commandeAutre = CommandeClient::create([
            'client_id' => $this->clientAutre->id,
            'boutique_id' => $this->autreBoutique->id,
            'date_commande' => now(),
            'statut' => 'en_attente',
            'montant_total' => 5000,
            'montant_paye' => 0,
            'user_id' => $this->gerant->id,
        ]);

        $reponse = $this->postJson('/api/factures/generer-commande', ['commande_client_id' => $commandeAutre->id]);

        $this->assertContains($reponse->status(), [403, 404, 422]);
        $this->assertDatabaseCount('factures', 0);
    }
}
