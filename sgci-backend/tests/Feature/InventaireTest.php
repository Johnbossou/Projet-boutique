<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\Categorie;
use App\Models\Inventaire;
use App\Models\MouvementStock;
use App\Models\Produit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InventaireTest extends TestCase
{
    use RefreshDatabase;

    private Boutique $boutique;

    private User $gerant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->gerant = User::create([
            'name' => 'Gérant Inventaire',
            'email' => 'gerant-inv@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);

        $this->boutique = Boutique::create([
            'nom' => 'Boutique Inv',
            'adresse' => 'Porto-Novo',
            'proprietaire_id' => $this->gerant->id,
        ]);

        $this->gerant->boutiques()->attach($this->boutique->id, ['role_dans_boutique' => 'gerant']);
        $this->gerant->update(['current_boutique_id' => $this->boutique->id]);
    }

    private function seedProduit(): Produit
    {
        $cat = Categorie::create(['nom' => 'Cat I', 'description' => 'D', 'couleur' => '#000', 'icone' => 'box']);

        return Produit::create([
            'nom' => 'Produit I',
            'description' => 'Test',
            'prix' => 2000,
            'quantite_stock' => 15,
            'seuil_alerte' => 3,
            'categorie_id' => $cat->id,
            'unite_mesure' => 'unite',
            'boutique_id' => $this->boutique->id,
        ]);
    }

    public function test_store_inventaire_cree_snapshot(): void
    {
        Sanctum::actingAs($this->gerant);
        $produit = $this->seedProduit();

        $response = $this->postJson('/api/inventaires');

        $response->assertCreated()
            ->assertJsonPath('data.statut', 'en_cours');

        $inventaire = Inventaire::first();
        $this->assertDatabaseHas('inventaire_lignes', [
            'inventaire_id' => $inventaire->id,
            'produit_id' => $produit->id,
            'quantite_systeme' => 15,
        ]);
    }

    public function test_compter_ecart_negatif(): void
    {
        Sanctum::actingAs($this->gerant);
        $this->seedProduit();
        $this->postJson('/api/inventaires');
        $inventaire = Inventaire::first();
        $ligne = $inventaire->lignes->first();

        $this->postJson("/api/inventaires/{$inventaire->id}/compter", [
            'lignes' => [
                ['inventaire_ligne_id' => $ligne->id, 'quantite_physique' => 12],
            ],
        ])->assertOk();

        $ligne->refresh();
        $this->assertEquals(12, $ligne->quantite_physique);
        $this->assertEquals(-3, $ligne->ecart);
        $this->assertEquals(1, $inventaire->refresh() ? $inventaire->ecarts_detectes : 0);
    }

    public function test_valider_inventaire_ajuste_stock(): void
    {
        Sanctum::actingAs($this->gerant);
        $produit = $this->seedProduit();
        $this->postJson('/api/inventaires');
        $inventaire = Inventaire::first();
        $ligne = $inventaire->lignes->first();

        $this->postJson("/api/inventaires/{$inventaire->id}/compter", [
            'lignes' => [
                ['inventaire_ligne_id' => $ligne->id, 'quantite_physique' => 10],
            ],
        ]);

        $this->postJson("/api/inventaires/{$inventaire->id}/valider")->assertOk();

        $produit->refresh();
        $this->assertEquals(10, $produit->quantite_stock);

        $this->assertDatabaseHas('mouvements_stock', [
            'produit_id' => $produit->id,
            'raison' => 'ajustement',
            'type' => 'sortie',
        ]);
    }

    public function test_annuler_inventaire(): void
    {
        Sanctum::actingAs($this->gerant);
        $this->postJson('/api/inventaires');
        $inventaire = Inventaire::first();

        $this->postJson("/api/inventaires/{$inventaire->id}/annuler")
            ->assertOk()
            ->assertJsonPath('data.statut', 'annule');
    }

    public function test_ecarts_endpoint(): void
    {
        Sanctum::actingAs($this->gerant);
        $produit = $this->seedProduit();
        $this->postJson('/api/inventaires');
        $inventaire = Inventaire::first();
        $ligne = $inventaire->lignes->first();

        $this->postJson("/api/inventaires/{$inventaire->id}/compter", [
            'lignes' => [
                ['inventaire_ligne_id' => $ligne->id, 'quantite_physique' => 20],
            ],
        ]);

        $response = $this->getJson("/api/inventaires/{$inventaire->id}/ecarts");

        $response->assertOk()
            ->assertJsonPath('ecarts_positifs', 1)
            ->assertJsonPath('ecarts_negatifs', 0);
    }

    /**
     * Régression : une vente intervenue APRÈS le relevé ne doit pas être
     * annulée par la validation.
     *
     * Avant : la validation écrasait le stock par la quantité physique absolue
     * (12), alors que le stock réel était descendu à 13 puis 10. Les 2 articles
     * vendus entre le relevé et la validation réapparaissaient en stock.
     */
    public function test_valider_preserve_les_ventes_survenues_apres_le_comptage(): void
    {
        Sanctum::actingAs($this->gerant);
        $produit = $this->seedProduit();

        $this->postJson('/api/inventaires');
        $inventaire = Inventaire::first();
        $ligne = $inventaire->lignes->first();

        // Le comptant relève 12 en rayon alors que le système affiche 15.
        $this->postJson("/api/inventaires/{$inventaire->id}/compter", [
            'lignes' => [
                ['inventaire_ligne_id' => $ligne->id, 'quantite_physique' => 12],
            ],
        ])->assertOk()->assertJsonPath('data.statut', 'en_cours');

        $ligne->refresh();
        $this->assertEquals(15, $ligne->quantite_systeme_comptage);
        $this->assertEquals(15, $ligne->quantite_systeme, 'La photo d\'ouverture doit rester la référence du rapport.');
        $this->assertEquals(-3, $ligne->ecart);

        // Le magasin vend 2 unités AVANT que le gérant ne valide.
        $produit->update(['quantite_stock' => 13]);

        $this->postJson("/api/inventaires/{$inventaire->id}/valider")->assertOk();

        $produit->refresh();
        // 13 - 3 = 10. L'ancien code écrivait 12 et recréait les 2 unités vendues.
        $this->assertEquals(10, $produit->quantite_stock);

        $mouvement = MouvementStock::where('raison', 'ajustement')->first();
        $this->assertEquals(13, $mouvement->quantite_avant);
        $this->assertEquals(10, $mouvement->quantite_apres);
    }

    /**
     * Régression : l'écart doit se mesurer sur le stock affiché au comptage, pas
     * sur la photo d'ouverture.
     *
     * Avant : une vente survenue avant le relevé rendait l'écart faux, et la
     * validation retirait de nouveau des articles qui avaient été vendus.
     */
    public function test_le_comptage_ignore_les_ventes_anterieures(): void
    {
        Sanctum::actingAs($this->gerant);
        $produit = $this->seedProduit();

        $this->postJson('/api/inventaires');
        $inventaire = Inventaire::first();
        $ligne = $inventaire->lignes->first();

        // Vente de 3 unités alors que l'inventaire est déjà ouvert.
        $produit->update(['quantite_stock' => 12]);

        // Le comptant relève 12 : le stock correspond, il n'y a aucun écart.
        $this->postJson("/api/inventaires/{$inventaire->id}/compter", [
            'lignes' => [
                ['inventaire_ligne_id' => $ligne->id, 'quantite_physique' => 12],
            ],
        ])->assertOk();

        $ligne->refresh();
        $this->assertEquals(12, $ligne->quantite_systeme_comptage, 'Le stock de référence doit être celui affiché au comptage.');
        $this->assertSame(0, $ligne->ecart, 'Le stock relevé correspond au système : aucun écart.');

        $this->postJson("/api/inventaires/{$inventaire->id}/valider")->assertOk();

        $this->assertSame(12, $produit->refresh()->quantite_stock, 'La vente intervenue avant le relevé doit être conservée.');
        $this->assertSame(0, MouvementStock::where('raison', 'ajustement')->count(), 'Aucun ajustement ne doit être généré.');
    }

    public function test_le_comptage_est_partiel_et_recompte_autorise(): void
    {
        Sanctum::actingAs($this->gerant);
        $this->seedProduit();
        Categorie::create(['nom' => 'Cat J', 'description' => 'D', 'couleur' => '#000', 'icone' => 'box']);
        $second = Produit::create([
            'nom' => 'Produit J',
            'description' => 'Test',
            'prix' => 1500,
            'quantite_stock' => 4,
            'seuil_alerte' => 2,
            'categorie_id' => Categorie::where('nom', 'Cat J')->value('id'),
            'unite_mesure' => 'unite',
            'boutique_id' => $this->boutique->id,
        ]);

        $this->postJson('/api/inventaires');
        $inventaire = Inventaire::first();
        $this->assertCount(2, $inventaire->lignes);

        $premiere = $inventaire->lignes->firstWhere('produit_id', $second->id);

        // Premier lot : une seule ligne comptée.
        $reponse = $this->postJson("/api/inventaires/{$inventaire->id}/compter", [
            'lignes' => [
                ['inventaire_ligne_id' => $premiere->id, 'quantite_physique' => 3],
            ],
        ])->assertOk();

        // Le lot partiel ne doit pas clore l'inventaire.
        $reponse->assertJsonPath('data.statut', 'en_cours')
            ->assertJsonPath('lignes_restantes', 1);

        // Un second lot est donc accepté, sur le même inventaire.
        $autre = $inventaire->lignes->firstWhere('produit_id', '!=', $second->id);
        $this->postJson("/api/inventaires/{$inventaire->id}/compter", [
            'lignes' => [
                ['inventaire_ligne_id' => $autre->id, 'quantite_physique' => 12],
            ],
        ])->assertOk()->assertJsonPath('lignes_restantes', 0);

        // Recompter une ligne déjà relevée est un geste normal en magasin.
        $this->postJson("/api/inventaires/{$inventaire->id}/compter", [
            'lignes' => [
                ['inventaire_ligne_id' => $autre->id, 'quantite_physique' => 11],
            ],
        ])->assertOk();
        $this->assertEquals(11, $autre->refresh()->quantite_physique);

        $this->postJson("/api/inventaires/{$inventaire->id}/valider")->assertOk();
    }

    public function test_valider_refuse_un_inventaire_incomplet(): void
    {
        Sanctum::actingAs($this->gerant);
        $this->seedProduit();
        Categorie::create(['nom' => 'Cat K', 'description' => 'D', 'couleur' => '#000', 'icone' => 'box']);
        Produit::create([
            'nom' => 'Produit K',
            'description' => 'Test',
            'prix' => 900,
            'quantite_stock' => 6,
            'seuil_alerte' => 1,
            'categorie_id' => Categorie::where('nom', 'Cat K')->value('id'),
            'unite_mesure' => 'unite',
            'boutique_id' => $this->boutique->id,
        ]);

        $this->postJson('/api/inventaires');
        $inventaire = Inventaire::first();
        $ligne = $inventaire->lignes->first();

        $this->postJson("/api/inventaires/{$inventaire->id}/compter", [
            'lignes' => [['inventaire_ligne_id' => $ligne->id, 'quantite_physique' => 10]],
        ])->assertOk();

        $this->postJson("/api/inventaires/{$inventaire->id}/valider")
            ->assertStatus(422);

        $this->assertEquals('en_cours', $inventaire->refresh()->statut);
    }

    public function test_un_comptage_a_zero_ajuste_le_stock_a_zero(): void
    {
        Sanctum::actingAs($this->gerant);
        $produit = $this->seedProduit();
        $this->postJson('/api/inventaires');
        $inventaire = Inventaire::first();
        $ligne = $inventaire->lignes->first();

        $this->postJson("/api/inventaires/{$inventaire->id}/compter", [
            'lignes' => [['inventaire_ligne_id' => $ligne->id, 'quantite_physique' => 0]],
        ])->assertOk();

        $ligne->refresh();
        $this->assertSame(0, $ligne->quantite_physique, 'Une rupture relevée en rayon doit être enregistrée.');
        $this->assertEquals(-15, $ligne->ecart);

        $this->postJson("/api/inventaires/{$inventaire->id}/valider")->assertOk();

        $this->assertSame(0, $produit->refresh()->quantite_stock);
        $this->assertDatabaseHas('mouvements_stock', [
            'produit_id' => $produit->id,
            'raison' => 'ajustement',
            'type' => 'sortie',
            'quantite' => 15,
        ]);
    }

    public function test_le_stock_ne_peut_pas_devenir_negatif_a_la_validation(): void
    {
        Sanctum::actingAs($this->gerant);
        $produit = $this->seedProduit();
        $this->postJson('/api/inventaires');
        $inventaire = Inventaire::first();
        $ligne = $inventaire->lignes->first();

        // Écart de -20 sur un stock de 15 : la validation borne à 0.
        $this->postJson("/api/inventaires/{$inventaire->id}/compter", [
            'lignes' => [['inventaire_ligne_id' => $ligne->id, 'quantite_physique' => 0]],
        ])->assertOk();

        // Le stock tombe encore après le comptage (vente concurrente).
        $produit->update(['quantite_stock' => 5]);
        $ligne->refresh();
        $ligne->update(['ecart' => -10]);

        $this->postJson("/api/inventaires/{$inventaire->id}/valider")->assertOk();

        $this->assertSame(0, $produit->refresh()->quantite_stock);
    }

    public function test_compter_refuse_un_inventaire_termine_ou_annule(): void
    {
        Sanctum::actingAs($this->gerant);
        $this->seedProduit();
        $this->postJson('/api/inventaires');
        $inventaire = Inventaire::first();
        $ligne = $inventaire->lignes->first();

        $inventaire->update(['statut' => 'annule']);

        $this->postJson("/api/inventaires/{$inventaire->id}/compter", [
            'lignes' => [['inventaire_ligne_id' => $ligne->id, 'quantite_physique' => 10]],
        ])->assertStatus(422);
    }

    public function test_valider_refuse_un_produit_hors_boutique_sans_ajuster_le_reste(): void
    {
        Sanctum::actingAs($this->gerant);
        $produitOk = $this->seedProduit();
        $produitRattache = Produit::create([
            'nom' => 'Produitcase',
            'description' => 'Test',
            'prix' => 500,
            'quantite_stock' => 20,
            'seuil_alerte' => 2,
            'categorie_id' => Categorie::first()->id,
            'unite_mesure' => 'unite',
            'boutique_id' => $this->boutique->id,
        ]);

        $this->postJson('/api/inventaires')->assertCreated();
        $inventaire = Inventaire::first();

        // Tous les produits sont comptés : rien ne doit bloquer la validation
        // pour un motif de saisie incomplète.
        $this->postJson("/api/inventaires/{$inventaire->id}/compter", [
            'lignes' => $inventaire->lignes->map(fn ($l) => [
                'inventaire_ligne_id' => $l->id,
                'quantite_physique' => 10,
            ])->all(),
        ])->assertOk();

        // Entre le comptage et la validation, le produit est rattaché à une
        // autre boutique (réorganisation, transfert, import).
        $autreBoutique = Boutique::create([
            'nom' => 'Boutique Etrangere',
            'adresse' => 'Cotonou',
            'proprietaire_id' => $this->gerant->id,
        ]);
        $produitRattache->update(['boutique_id' => $autreBoutique->id]);

        $reponse = $this->postJson("/api/inventaires/{$inventaire->id}/valider")
            ->assertStatus(422);

        // Le message doit nommer le produit fautif : « un écart n'a pas pu
        // être appliqué » sans dire lequel oblige le gérant à tout recompter.
        $this->assertStringContainsString('#'.$produitRattache->id, $reponse->getContent());

        // Point essentiel : aucun stock n'est ajusté, pas même pour le produit
        // parfaitement adjustmentnable. L'ancien code faisait un `continue`
        // silencieux : la validation renvoyait « stock ajusté » en ayant
        // appliqué la moitié des écarts seulement, et l'écart du produit
        // disparu n'était tracé nulle part.
        $this->assertSame(15, $produitOk->refresh()->quantite_stock);
        $this->assertSame('en_cours', $inventaire->refresh()->statut);
        $this->assertSame(0, MouvementStock::count());
    }

    public function test_valider_refuse_un_produit_supprime_sans_ajuster_le_reste(): void
    {
        Sanctum::actingAs($this->gerant);
        $produitOk = $this->seedProduit();
        $produitSupprime = Produit::create([
            'nom' => 'Produit Supprime',
            'description' => 'Test',
            'prix' => 500,
            'quantite_stock' => 20,
            'seuil_alerte' => 2,
            'categorie_id' => Categorie::first()->id,
            'unite_mesure' => 'unite',
            'boutique_id' => $this->boutique->id,
        ]);

        $this->postJson('/api/inventaires')->assertCreated();
        $inventaire = Inventaire::first();

        $this->postJson("/api/inventaires/{$inventaire->id}/compter", [
            'lignes' => $inventaire->lignes->map(fn ($l) => [
                'inventaire_ligne_id' => $l->id,
                'quantite_physique' => 10,
            ])->all(),
        ])->assertOk();

        $produitSupprime->delete();

        $reponse = $this->postJson("/api/inventaires/{$inventaire->id}/valider")
            ->assertStatus(422);

        $this->assertStringContainsString('#'.$produitSupprime->id, $reponse->getContent());

        $this->assertSame(15, $produitOk->refresh()->quantite_stock);
        $this->assertSame('en_cours', $inventaire->refresh()->statut);
        $this->assertSame(0, MouvementStock::count());
    }

    public function test_valider_deux_fois_n_applique_qu_un_seul_ajustement(): void
    {
        Sanctum::actingAs($this->gerant);
        $produit = $this->seedProduit();
        $this->postJson('/api/inventaires');
        $inventaire = Inventaire::first();
        $ligne = $inventaire->lignes->first();

        $this->postJson("/api/inventaires/{$inventaire->id}/compter", [
            'lignes' => [['inventaire_ligne_id' => $ligne->id, 'quantite_physique' => 18]],
        ])->assertOk();

        $this->assertSame(3, $ligne->refresh()->ecart);

        $this->postJson("/api/inventaires/{$inventaire->id}/valider")->assertOk();
        $this->assertSame(18, $produit->refresh()->quantite_stock);

        // Deuxième validation : refusée, et surtout sans réappliquer le delta.
        $this->postJson("/api/inventaires/{$inventaire->id}/valider")->assertStatus(409);

        $this->assertSame(18, $produit->refresh()->quantite_stock);
        $this->assertSame(1, MouvementStock::count());
        $this->assertSame('valide', $inventaire->refresh()->statut);
    }

    public function test_annuler_un_inventaire_valide_est_refuse_et_ne_touche_pas_au_stock(): void
    {
        Sanctum::actingAs($this->gerant);
        $produit = $this->seedProduit();
        $this->postJson('/api/inventaires');
        $inventaire = Inventaire::first();
        $ligne = $inventaire->lignes->first();

        $this->postJson("/api/inventaires/{$inventaire->id}/compter", [
            'lignes' => [['inventaire_ligne_id' => $ligne->id, 'quantite_physique' => 18]],
        ])->assertOk();

        $this->postJson("/api/inventaires/{$inventaire->id}/valider")->assertOk();
        $this->assertSame(18, $produit->refresh()->quantite_stock);

        // Annuler après coup laisserait un inventaire « annule » alors que le
        // stock a réellement été ajusté : l'annulation serait fausse, et
        // l'écart resterait appliqué sans contre-pas.
        $this->postJson("/api/inventaires/{$inventaire->id}/annuler")->assertStatus(422);

        $this->assertSame('valide', $inventaire->refresh()->statut);
        $this->assertSame(18, $produit->refresh()->quantite_stock);
    }
}
