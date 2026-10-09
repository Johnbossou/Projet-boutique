<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\Categorie;
use App\Models\LigneVente;
use App\Models\MouvementStock;
use App\Models\Produit;
use App\Models\User;
use App\Models\Vente;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Archivage d'un produit (Produit utilise SoftDeletes).
 *
 * Le produit etant supprime logiquement, les lignes qui le referencent
 * survivent en base. Mais toute relation belongsTo(Produit::class) passe par le
 * scope par defaut, qui exclut les produits archives : une facture, un mouvement
 * de stock ou un snapshot d'inventaire d'une vente ancienne perdait alors le
 * nom du produit. Un ticket deja encaisse ne doit pas devenir illisible parce
 * qu'un produit a ete archive apres coup.
 */
class ProduitSuppressionTest extends TestCase
{
    use RefreshDatabase;

    private Boutique $boutique;

    private User $gerant;

    private Produit $produit;

    protected function setUp(): void
    {
        parent::setUp();

        $this->sansProvisionnerBoutique();

        $this->gerant = User::create([
            'name' => 'Gerant Suppression',
            'email' => 'gerant-suppression-produit@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);

        $this->boutique = Boutique::create([
            'nom' => 'Boutique Suppression',
            'devise' => 'XOF',
            'proprietaire_id' => $this->gerant->id,
        ]);

        $this->gerant->boutiques()->attach($this->boutique->id, ['role_dans_boutique' => 'gerant']);
        $this->gerant->update(['current_boutique_id' => $this->boutique->id]);

        $categorie = Categorie::create([
            'nom' => 'Categorie',
            'boutique_id' => $this->boutique->id,
        ]);

        $this->produit = Produit::create([
            'nom' => 'Produit Archive Test',
            'prix' => 1000,
            'quantite_stock' => 10,
            'seuil_alerte' => 2,
            'categorie_id' => $categorie->id,
            'boutique_id' => $this->boutique->id,
            'unite_mesure' => 'piece',
        ]);

        Sanctum::actingAs($this->gerant);
    }

    private function creerVenteAvecLigne(): Vente
    {
        $vente = Vente::create([
            'numero_vente' => 'VTE-ARCHIVE-1',
            'boutique_id' => $this->boutique->id,
            'user_id' => $this->gerant->id,
            'date_vente' => now(),
            'statut' => 'termine',
            'montant_total' => 2000,
            'montant_remise' => 0,
            'montant_ttc' => 2000,
        ]);

        LigneVente::create([
            'vente_id' => $vente->id,
            'produit_id' => $this->produit->id,
            'quantite' => 2,
            'prix_unitaire' => 1000,
            'montant_ligne' => 2000,
        ]);

        MouvementStock::create([
            'produit_id' => $this->produit->id,
            'boutique_id' => $this->boutique->id,
            'type' => 'sortie',
            'quantite' => 2,
            'raison' => 'vente',
            'statut' => 'accepte',
            'user_id' => $this->gerant->id,
            'quantite_avant' => 10,
            'quantite_apres' => 8,
        ]);

        return $vente;
    }

    public function test_les_mouvements_de_stock_survivent_a_l_archivage(): void
    {
        $this->creerVenteAvecLigne();

        $this->deleteJson("/api/produits/{$this->produit->id}")->assertOk();

        // Le produit est archive (soft delete), la ligne FK n'est donc pas
        // declenchee : le journal de stock doit rester complet.
        $this->assertSoftDeleted('produits', ['id' => $this->produit->id]);

        $this->assertSame(
            1,
            MouvementStock::where('produit_id', $this->produit->id)->count(),
            'Supprimer un produit ne doit jamais detruire son historique de stock.'
        );
    }

    public function test_une_ligne_de_vente_archivee_resout_encore_le_produit(): void
    {
        $vente = $this->creerVenteAvecLigne();
        $this->deleteJson("/api/produits/{$this->produit->id}")->assertOk();

        $ligne = LigneVente::findOrFail($vente->ligneVentes()->first()->id);

        $this->assertNotNull(
            $ligne->produit,
            'Une ligne de vente historique doit encore nommer son produit.'
        );
        $this->assertSame('Produit Archive Test', $ligne->produit->nom);
    }

    public function test_un_mouvement_de_stock_archive_resout_encore_le_produit(): void
    {
        $this->creerVenteAvecLigne();
        $this->deleteJson("/api/produits/{$this->produit->id}")->assertOk();

        $mouvement = MouvementStock::where('produit_id', $this->produit->id)->firstOrFail();

        $this->assertNotNull($mouvement->produit, 'Le journal de stock doit nommer le produit archive.');
        $this->assertSame('Produit Archive Test', $mouvement->produit->nom);
    }

    public function test_la_liste_des_mouvements_affiche_le_nom_du_produit_archive(): void
    {
        $this->creerVenteAvecLigne();
        $this->deleteJson("/api/produits/{$this->produit->id}")->assertOk();

        $this->getJson('/api/mouvements-stock')
            ->assertOk()
            ->assertJsonFragment(['nom' => 'Produit Archive Test']);
    }

    public function test_un_produit_archive_n_apparait_plus_dans_le_catalogue(): void
    {
        $this->deleteJson("/api/produits/{$this->produit->id}")->assertOk();

        $this->getJson('/api/produits')
            ->assertOk()
            ->assertJsonMissing(['nom' => 'Produit Archive Test']);
    }

    public function test_un_produit_archive_ne_peut_pas_etre_vendu(): void
    {
        $this->deleteJson("/api/produits/{$this->produit->id}")->assertOk();

        $this->postJson('/api/ventes', [
            'ligne_ventes' => [
                ['produit_id' => $this->produit->id, 'quantite' => 1],
            ],
            'mode_paiement' => 'especes',
        ])->assertStatus(422);
    }

    public function test_un_produit_archive_ne_peut_pas_recevoir_d_arrivage(): void
    {
        $this->deleteJson("/api/produits/{$this->produit->id}")->assertOk();

        $avant = MouvementStock::count();

        // Un produit archive est absent du catalogue : l'API doit refuser,
        // que ce soit par une erreur de validation ou un 404.
        $reponse = $this->postJson('/api/mouvements-stock', [
            'produit_id' => $this->produit->id,
            'quantite' => 10,
            'raison' => 'arrivage',
            'type' => 'entree',
        ]);

        $this->assertContains($reponse->status(), [404, 422]);
        $this->assertSame(
            $avant,
            MouvementStock::count(),
            'Aucun mouvement ne doit etre cree pour un produit archive.'
        );
    }
}
