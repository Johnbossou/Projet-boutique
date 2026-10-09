<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\Categorie;
use App\Models\MouvementStock;
use App\Models\Produit;
use App\Models\TransfertStock;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Transferts de stock entre boutiques.
 *
 * Cette zone n'avait aucun test. Trois défauts ont été corrigés :
 *  - le débit à la création et le crédit à la réception n'écrivaient aucune
 *    ligne dans mouvements_stock : un écart d'inventaire sur la source ou la
 *    destination était inexplicable, puisque transferts_stocks ne conserve ni
 *    quantite_avant ni quantite_apres ;
 *  - les statuts étaient testés hors transaction. Deux réceptions (ou deux
 *    annulations) concurrentes passaient la même garde et le stock était crédité
 *    ou restitué deux fois ;
 *  - la réception recopiait code_qr, unique globalement : tout transfert vers une
 *    boutique qui n'avait pas encore le produit échouait en erreur de doublon.
 *    Elle recopiait aussi categorie_id, référençant une catégorie de l'autre
 *    tenant, supprimée en cascade si la source la supprimait.
 */
class TransfertStockTest extends TestCase
{
    use RefreshDatabase;

    private Boutique $source;

    private Boutique $destination;

    private User $gerantSource;

    private User $gerantDestination;

    private Produit $produitSource;

    protected function setUp(): void
    {
        parent::setUp();

        $this->sansProvisionnerBoutique();

        $proprietaire = User::create([
            'name' => 'Proprietaire Transfert',
            'email' => 'proprio-transfert@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'proprietaire',
            'est_actif' => true,
        ]);

        $this->source = Boutique::create([
            'nom' => 'Boutique Source',
            'devise' => 'XOF',
            'proprietaire_id' => $proprietaire->id,
        ]);

        $this->destination = Boutique::create([
            'nom' => 'Boutique Destination',
            'devise' => 'XOF',
            'proprietaire_id' => $proprietaire->id,
        ]);

        // Le gérant source gère les deux boutiques (cas d'un groupe) : c'est
        // lui qui peut créer un transfert. Le gérant destination n'est que de
        // la r�ception, pour que la chaine ne soit pas faite par un seul compte.
        $this->gerantSource = $this->creerGerant('gerant-source@sgci.bj', $this->source);
        $this->gerantSource->boutiques()->attach($this->destination->id, [
            'role_dans_boutique' => 'gerant',
        ]);
        $this->gerantDestination = $this->creerGerant('gerant-dest@sgci.bj', $this->destination);

        $this->produitSource = $this->creerProduit($this->source, 'Riz', 20);
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

        $gerant->boutiques()->attach($boutique->id, ['role_dans_boutique' => 'gerant']);
        $gerant->update(['current_boutique_id' => $boutique->id]);

        return $gerant;
    }

    private function creerProduit(Boutique $boutique, string $nom, int $stock, ?string $codeQr = null): Produit
    {
        $categorie = Categorie::create([
            'nom' => "Cat $nom {$boutique->id}",
            'boutique_id' => $boutique->id,
        ]);

        return Produit::create([
            'nom' => $nom,
            'description' => 'desc',
            'prix' => 1000,
            'quantite_stock' => $stock,
            'seuil_alerte' => 2,
            'categorie_id' => $categorie->id,
            'boutique_id' => $boutique->id,
            'unite_mesure' => 'piece',
            'code_qr' => $codeQr,
        ]);
    }

    private function creerTransfert(int $quantite = 5, string $statut = 'en_attente'): TransfertStock
    {
        return TransfertStock::create([
            'boutique_source_id' => $this->source->id,
            'boutique_destination_id' => $this->destination->id,
            'produit_id' => $this->produitSource->id,
            'quantite' => $quantite,
            'statut' => $statut,
            'date_transfert' => now(),
            'user_source_id' => $this->gerantSource->id,
        ]);
    }

    // ==================== CRÉATION ====================

    public function test_creer_un_transfert_debite_la_source_et_trace_le_mouvement(): void
    {
        Sanctum::actingAs($this->gerantSource);

        $this->postJson('/api/transferts-stock', [
            'boutique_destination_id' => $this->destination->id,
            'produit_id' => $this->produitSource->id,
            'quantite' => 5,
        ])->assertCreated();

        $this->assertSame(15, (int) $this->produitSource->fresh()->quantite_stock);

        $mouvement = MouvementStock::where('produit_id', $this->produitSource->id)->firstOrFail();

        $this->assertSame('sortie', $mouvement->type);
        $this->assertSame('transfert', $mouvement->raison);
        $this->assertSame('accepte', $mouvement->statut);
        $this->assertSame(20, (int) $mouvement->quantite_avant);
        $this->assertSame(15, (int) $mouvement->quantite_apres);
        $this->assertSame((int) $this->source->id, (int) $mouvement->boutique_id);
    }

    public function test_le_ledger_du_transfert_se_reconcilie_avec_le_stock(): void
    {
        Sanctum::actingAs($this->gerantSource);

        $this->postJson('/api/transferts-stock', [
            'boutique_destination_id' => $this->destination->id,
            'produit_id' => $this->produitSource->id,
            'quantite' => 5,
        ])->assertCreated();

        // Le dernier mouvement doitToujours correspondre a l'etat du produit.
        $produit = $this->produitSource->fresh();
        $dernier = MouvementStock::where('produit_id', $produit->id)->latest('id')->firstOrFail();

        $this->assertSame(
            (int) $produit->quantite_stock,
            (int) $dernier->quantite_apres,
            'Le stock du produit doit etre reconciliable avec le journal.'
        );
    }

    public function test_un_transfert_vers_la_meme_boutique_est_refuse(): void
    {
        Sanctum::actingAs($this->gerantSource);

        $this->postJson('/api/transferts-stock', [
            'boutique_destination_id' => $this->source->id,
            'produit_id' => $this->produitSource->id,
            'quantite' => 5,
        ])->assertStatus(422);

        $this->assertSame(20, (int) $this->produitSource->fresh()->quantite_stock);
    }

    public function test_un_produit_d_une_autre_boutique_est_refuse_a_la_creation(): void
    {
        Sanctum::actingAs($this->gerantSource);
        $etranger = $this->creerProduit($this->destination, 'Produit Destination', 50);

        $this->postJson('/api/transferts-stock', [
            'boutique_destination_id' => $this->destination->id,
            'produit_id' => $etranger->id,
            'quantite' => 5,
        ])->assertStatus(422);

        $this->assertSame(50, (int) $etranger->fresh()->quantite_stock);
    }

    public function test_un_transfert_vers_une_boutique_inconnue_du_gerant_est_refuse(): void
    {
        Sanctum::actingAs($this->gerantSource);

        $tiers = Boutique::create([
            'nom' => 'Boutique Tiers',
            'devise' => 'XOF',
            'proprietaire_id' => $this->gerantDestination->id,
        ]);

        $this->postJson('/api/transferts-stock', [
            'boutique_destination_id' => $tiers->id,
            'produit_id' => $this->produitSource->id,
            'quantite' => 5,
        ])->assertStatus(422);

        $this->assertSame(20, (int) $this->produitSource->fresh()->quantite_stock);
    }

    public function test_un_transfert_superieur_au_stock_est_refuse_sans_ecriture(): void
    {
        Sanctum::actingAs($this->gerantSource);

        $this->postJson('/api/transferts-stock', [
            'boutique_destination_id' => $this->destination->id,
            'produit_id' => $this->produitSource->id,
            'quantite' => 999,
        ])->assertStatus(400);

        $this->assertSame(20, (int) $this->produitSource->fresh()->quantite_stock);
        $this->assertSame(0, MouvementStock::count(), 'Aucun mouvement ne doit etre ecrit.');
    }

    // ==================== RÉCEPTION ====================

    public function test_la_reception_credite_la_destination_et_trace_le_mouvement(): void
    {
        $transfert = $this->creerTransfert(5);
        $produitDestination = $this->creerProduit($this->destination, 'Riz', 3);

        Sanctum::actingAs($this->gerantDestination);

        $this->postJson("/api/transferts-stock/{$transfert->id}/recevoir")->assertOk();

        $this->assertSame(8, (int) $produitDestination->fresh()->quantite_stock);
        $this->assertSame('termine', $transfert->fresh()->statut);

        $mouvement = MouvementStock::where('produit_id', $produitDestination->id)->firstOrFail();

        $this->assertSame('entree', $mouvement->type);
        $this->assertSame('transfert', $mouvement->raison);
        $this->assertSame(3, (int) $mouvement->quantite_avant);
        $this->assertSame(8, (int) $mouvement->quantite_apres);
        $this->assertSame((int) $this->destination->id, (int) $mouvement->boutique_id);
    }

    public function test_la_reception_ne_peut_pas_crediter_deux_fois(): void
    {
        $transfert = $this->creerTransfert(5);
        $produitDestination = $this->creerProduit($this->destination, 'Riz', 3);

        Sanctum::actingAs($this->gerantDestination);

        $this->postJson("/api/transferts-stock/{$transfert->id}/recevoir")->assertOk();

        // Seconde réception : le transfert est « termine », il doit être refusé.
        $this->postJson("/api/transferts-stock/{$transfert->id}/recevoir")->assertStatus(409);

        $this->assertSame(
            8,
            (int) $produitDestination->fresh()->quantite_stock,
            'Une double réception ne doit pas doubler le stock.'
        );

        $this->assertSame(
            1,
            MouvementStock::where('produit_id', $produitDestination->id)->count(),
            'Une seule ligne de ledger pour une seule réception effective.'
        );
    }

    public function test_la_reception_duplique_le_produit_si_absent_de_la_destination(): void
    {
        $produitQr = $this->produitSource;
        $produitQr->update(['code_qr' => 'QR-UNIQUE-001']);

        $transfert = $this->creerTransfert(5);

        Sanctum::actingAs($this->gerantDestination);
        $this->postJson("/api/transferts-stock/{$transfert->id}/recevoir")->assertOk();

        $copie = Produit::where('boutique_id', $this->destination->id)
            ->where('nom', 'Riz')
            ->firstOrFail();

        $this->assertSame(5, (int) $copie->quantite_stock);
        $this->assertSame(
            (int) $this->destination->id,
            (int) $copie->boutique_id,
            'La copie doit appartenir a la destination.'
        );

        // code_qr est unique globalement : le recopier faisait echouer tout
        // transfert vers une boutique sans le produit.
        $this->assertNull($copie->code_qr, 'Le code QR de la source ne doit pas etre duplique.');

        // La categorie doit etre celle de la destination, pas celle de la source.
        $this->assertSame(
            (int) $this->destination->id,
            (int) $copie->categorie->boutique_id,
            'La categorie du produit copie ne doit pas provenir de la source.'
        );

        $this->assertDatabaseMissing('produits', [
            'code_qr' => 'QR-UNIQUE-001',
            'boutique_id' => $this->destination->id,
        ]);
    }

    public function test_la_destination_ne_peut_pas_recevoir_un_transfert_d_une_autre_boutique(): void
    {
        $tiers = Boutique::create([
            'nom' => 'Autre Destination',
            'devise' => 'XOF',
            'proprietaire_id' => $this->gerantSource->id,
        ]);

        $transfert = TransfertStock::create([
            'boutique_source_id' => $this->source->id,
            'boutique_destination_id' => $tiers->id,
            'produit_id' => $this->produitSource->id,
            'quantite' => 5,
            'statut' => 'en_attente',
            'date_transfert' => now(),
            'user_source_id' => $this->gerantSource->id,
        ]);

        $produitDestination = $this->creerProduit($this->destination, 'Riz', 3);

        Sanctum::actingAs($this->gerantDestination);
        $this->postJson("/api/transferts-stock/{$transfert->id}/recevoir")->assertStatus(403);

        $this->assertSame(3, (int) $produitDestination->fresh()->quantite_stock);
    }

    // ==================== ANNULATION ====================

    public function test_annuler_un_transfert_restitue_le_stock_source(): void
    {
        $transfert = $this->creerTransfert(5);
        $this->produitSource->update(['quantite_stock' => 15]);

        Sanctum::actingAs($this->gerantSource);
        $this->postJson("/api/transferts-stock/{$transfert->id}/annuler")->assertOk();

        $this->assertSame(20, (int) $this->produitSource->fresh()->quantite_stock);
        $this->assertSame('annule', $transfert->fresh()->statut);

        $restitution = MouvementStock::where('produit_id', $this->produitSource->id)
            ->where('type', 'entree')
            ->firstOrFail();

        $this->assertSame('transfert', $restitution->raison);
        $this->assertSame(15, (int) $restitution->quantite_avant);
        $this->assertSame(20, (int) $restitution->quantite_apres);
    }

    public function test_annuler_deux_fois_ne_restitue_qu_une_seule_fois(): void
    {
        $transfert = $this->creerTransfert(5);
        $this->produitSource->update(['quantite_stock' => 15]);

        Sanctum::actingAs($this->gerantSource);

        $this->postJson("/api/transferts-stock/{$transfert->id}/annuler")->assertOk();
        $this->postJson("/api/transferts-stock/{$transfert->id}/annuler")->assertStatus(409);

        $this->assertSame(
            20,
            (int) $this->produitSource->fresh()->quantite_stock,
            'Une double annulation ne doit pas surcrediter le stock source.'
        );
    }

    public function test_un_transfert_recu_ne_peut_plus_etre_annule_par_la_source(): void
    {
        $transfert = $this->creerTransfert(5, 'termine');
        $this->produitSource->update(['quantite_stock' => 15]);

        Sanctum::actingAs($this->gerantSource);
        $this->postJson("/api/transferts-stock/{$transfert->id}/annuler")->assertStatus(409);

        $this->assertSame(15, (int) $this->produitSource->fresh()->quantite_stock);
    }

    // ==================== LECTURE ====================

    public function test_un_gerant_ne_voit_pas_les_transferts_d_autres_boutiques(): void
    {
        $tiers = Boutique::create([
            'nom' => 'Boutique Tiers',
            'devise' => 'XOF',
            'proprietaire_id' => $this->gerantDestination->id,
        ]);

        $etranger = TransfertStock::create([
            'boutique_source_id' => $tiers->id,
            'boutique_destination_id' => $this->destination->id,
            'produit_id' => $this->creerProduit($tiers, 'X', 1)->id,
            'quantite' => 1,
            'statut' => 'en_attente',
            'date_transfert' => now(),
            'user_source_id' => $this->gerantDestination->id,
        ]);

        $mien = $this->creerTransfert(5);

        Sanctum::actingAs($this->gerantSource);
        $reponse = $this->getJson('/api/transferts-stock')->assertOk();
        $ids = collect($reponse->json('data'))->pluck('id');

        $this->assertTrue($ids->contains($mien->id));
        $this->assertFalse($ids->contains($etranger->id));
    }
}
