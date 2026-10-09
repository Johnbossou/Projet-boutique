<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\Categorie;
use App\Models\CommandeFournisseur;
use App\Models\Fournisseur;
use App\Models\LigneCommandeFournisseur;
use App\Models\MouvementStock;
use App\Models\Produit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CommandeFournisseurTest extends TestCase
{
    use RefreshDatabase;

    private Boutique $boutique;

    private User $gerant;

    private Fournisseur $fournisseur;

    private Produit $produit;

    protected function setUp(): void
    {
        parent::setUp();

        $this->gerant = User::create([
            'name' => 'Gérant Commande Fournisseur',
            'email' => 'gerant-commande-fournisseur@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);

        $this->boutique = Boutique::create([
            'nom' => 'Boutique Commande Fournisseur',
            'adresse' => 'Dassa',
            'proprietaire_id' => $this->gerant->id,
        ]);

        $this->gerant->boutiques()->attach($this->boutique->id, ['role_dans_boutique' => 'gerant']);
        $this->gerant->update(['current_boutique_id' => $this->boutique->id]);

        $this->fournisseur = Fournisseur::create([
            'nom' => 'Fournisseur Principal',
            'email' => 'principal@sgci.bj',
            'telephone' => '22997000000',
            'actif' => true,
            'boutique_id' => $this->boutique->id,
        ]);

        $categorie = Categorie::create([
            'nom' => 'Catégorie Test',
            'boutique_id' => $this->boutique->id,
        ]);

        $this->produit = Produit::create([
            'nom' => 'Produit Test',
            'description' => 'Produit pour test',
            'prix' => 1000,
            'quantite_stock' => 5,
            'seuil_alerte' => 2,
            'categorie_id' => $categorie->id,
            'boutique_id' => $this->boutique->id,
            'unite_mesure' => 'piece',
        ]);
    }

    private function creerCommande(string $statut = 'en_attente', int $montant = 20000): CommandeFournisseur
    {
        $commande = CommandeFournisseur::create([
            'numero_commande' => 'CF-TEST-'.uniqid(),
            'fournisseur_id' => $this->fournisseur->id,
            'boutique_id' => $this->boutique->id,
            'date_commande' => now(),
            'statut' => $statut,
            'montant_total' => $montant,
            'montant_paye' => 0,
            'user_id' => $this->gerant->id,
        ]);

        LigneCommandeFournisseur::create([
            'commande_fournisseur_id' => $commande->id,
            'produit_id' => $this->produit->id,
            'quantite_commandee' => 2,
            'quantite_recue' => 0,
            'prix_unitaire' => 10000,
            'montant_total' => 20000,
            'statut' => 'en_attente',
        ]);

        return $commande;
    }

    public function test_store_creer_une_commande(): void
    {
        Sanctum::actingAs($this->gerant);

        $this->postJson('/api/commandes-fournisseurs', [
            'fournisseur_id' => $this->fournisseur->id,
            'date_livraison_prevue' => now()->addDays(7)->format('Y-m-d'),
            'notes' => 'Commande test',
            'lignes' => [
                [
                    'produit_id' => $this->produit->id,
                    'quantite_commandee' => 3,
                    'prix_unitaire' => 10000,
                ],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('data.statut', 'en_attente')
            ->assertJsonPath('data.montant_total', '30000.00');

        $this->assertDatabaseHas('commande_fournisseurs', [
            'fournisseur_id' => $this->fournisseur->id,
            'boutique_id' => $this->boutique->id,
            'statut' => 'en_attente',
            'montant_total' => 30000,
        ]);
    }

    public function test_store_validation_erreurs(): void
    {
        Sanctum::actingAs($this->gerant);

        $this->postJson('/api/commandes-fournisseurs', [])
            ->assertStatus(422);
    }

    public function test_index_liste_les_commandes_de_la_boutique_courante(): void
    {
        Sanctum::actingAs($this->gerant);

        $this->creerCommande();
        $this->creerCommande('en_cours');

        $autreBoutique = Boutique::create([
            'nom' => 'Boutique Autre',
            'adresse' => 'Abomey',
            'proprietaire_id' => $this->gerant->id,
        ]);

        CommandeFournisseur::create([
            'numero_commande' => 'CF-AUTRE-'.uniqid(),
            'fournisseur_id' => $this->fournisseur->id,
            'boutique_id' => $autreBoutique->id,
            'date_commande' => now(),
            'statut' => 'en_attente',
            'montant_total' => 10000,
            'montant_paye' => 0,
            'user_id' => $this->gerant->id,
        ]);

        $this->getJson('/api/commandes-fournisseurs')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('total', 2);
    }

    public function test_index_filtre_par_statut(): void
    {
        Sanctum::actingAs($this->gerant);

        $this->creerCommande('en_attente');
        $this->creerCommande('en_cours');

        $this->getJson('/api/commandes-fournisseurs?statut=en_cours')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.statut', 'en_cours');
    }

    public function test_show_commande(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande();

        $this->getJson("/api/commandes-fournisseurs/{$commande->id}")
            ->assertOk()
            ->assertJsonPath('id', $commande->id)
            ->assertJsonPath('statut', 'en_attente');
    }

    public function test_commande_dune_autre_boutique_est_invisible(): void
    {
        Sanctum::actingAs($this->gerant);

        $autreBoutique = Boutique::create([
            'nom' => 'Boutique B',
            'adresse' => 'Parakou',
            'proprietaire_id' => $this->gerant->id,
        ]);

        $commande = CommandeFournisseur::create([
            'numero_commande' => 'CF-AUTRE-'.uniqid(),
            'fournisseur_id' => $this->fournisseur->id,
            'boutique_id' => $autreBoutique->id,
            'date_commande' => now(),
            'statut' => 'en_attente',
            'montant_total' => 10000,
            'montant_paye' => 0,
            'user_id' => $this->gerant->id,
        ]);

        $this->getJson("/api/commandes-fournisseurs/{$commande->id}")->assertStatus(403);
        $this->putJson("/api/commandes-fournisseurs/{$commande->id}", ['notes' => 'Modifié'])->assertStatus(403);
        $this->deleteJson("/api/commandes-fournisseurs/{$commande->id}")->assertStatus(403);
    }

    public function test_update_commande(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande();

        $this->putJson("/api/commandes-fournisseurs/{$commande->id}", [
            'notes' => 'Notes mises à jour',
            'date_livraison_prevue' => now()->addDays(10)->format('Y-m-d'),
        ])
            ->assertOk()
            ->assertJsonPath('data.notes', 'Notes mises à jour');
    }

    public function test_valider_commande(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande();

        $this->postJson("/api/commandes-fournisseurs/{$commande->id}/valider")
            ->assertOk()
            ->assertJsonPath('data.statut', 'en_cours');
    }

    public function test_ne_peut_pas_valider_commande_deja_validee(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande('en_cours');

        $this->postJson("/api/commandes-fournisseurs/{$commande->id}/valider")
            ->assertStatus(409);
    }

    public function test_payer_commande(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande('en_cours', 20000);

        $this->postJson("/api/commandes-fournisseurs/{$commande->id}/payer", [
            'montant' => 15000,
        ])
            ->assertOk()
            ->assertJsonPath('data.montant_paye', '15000.00');

        $this->assertDatabaseHas('commande_fournisseurs', [
            'id' => $commande->id,
            'montant_paye' => 15000,
        ]);
    }

    public function test_paiement_depasse_le_reste_a_payer(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande('en_cours', 20000);

        $this->postJson("/api/commandes-fournisseurs/{$commande->id}/payer", [
            'montant' => 25000,
        ])->assertStatus(422);
    }

    public function test_les_reglements_successifs_cumulent_sans_perte(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande('en_cours', 20000);

        foreach ([6000, 6000, 6000] as $montant) {
            $this->postJson("/api/commandes-fournisseurs/{$commande->id}/payer", [
                'montant' => $montant,
            ])->assertOk();
        }

        // 18 000 : c'est le total réellement encaissé. Un += sur une instance
        // périmée perdrait des règlements et afficherait un solde inférieur au
        // cash réel versé au fournisseur.
        $this->assertSame(18000.0, (float) $commande->refresh()->montant_paye);

        // Le solde exact est dû : ni refusé, ni accepté au-delà.
        $this->postJson("/api/commandes-fournisseurs/{$commande->id}/payer", [
            'montant' => 2000,
        ])->assertOk();

        $this->assertSame(20000.0, (float) $commande->refresh()->montant_paye);
        $this->assertTrue($commande->refresh()->estPayee());
        $this->assertSame(0.0, (float) $commande->montant_restant);
    }

    public function test_une_commande_entierement_payee_refuse_un_reglement_supplementaire(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande('en_cours', 20000);

        $this->postJson("/api/commandes-fournisseurs/{$commande->id}/payer", ['montant' => 20000])
            ->assertOk();

        $this->postJson("/api/commandes-fournisseurs/{$commande->id}/payer", ['montant' => 1])
            ->assertStatus(409);

        $this->assertSame(20000.0, (float) $commande->refresh()->montant_paye);
    }

    public function test_un_reglement_est_refuse_sur_commande_annulee_ou_livree(): void
    {
        Sanctum::actingAs($this->gerant);

        foreach (['annule', 'livre'] as $statut) {
            $commande = $this->creerCommande($statut, 20000);

            $this->postJson("/api/commandes-fournisseurs/{$commande->id}/payer", ['montant' => 5000])
                ->assertStatus(409);

            $this->assertSame(
                0.0,
                (float) $commande->refresh()->montant_paye,
                "Un règlement ne doit pas s'accumuler sur une commande $statut."
            );
        }
    }

    public function test_receptionner_commande_augmente_le_stock(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande('en_cours');
        $stockAvant = $this->produit->quantite_stock;

        $ligne = $commande->lignes->first();

        $this->postJson("/api/commandes-fournisseurs/{$commande->id}/receptionner", [
            'lignes' => [
                [
                    'ligne_id' => $ligne->id,
                    'quantite_recue' => 2,
                ],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('data.commande.statut', 'livre');

        $this->assertDatabaseHas('produits', [
            'id' => $this->produit->id,
            'quantite_stock' => $stockAvant + 2,
        ]);

        $this->assertDatabaseHas('mouvements_stock', [
            'produit_id' => $this->produit->id,
            'type' => 'entree',
            'raison' => 'arrivage',
            'statut' => 'accepte',
        ]);
    }

    public function test_ne_peut_pas_receptionner_commande_en_attente(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande('en_attente');

        $ligne = $commande->lignes->first();

        $this->postJson("/api/commandes-fournisseurs/{$commande->id}/receptionner", [
            'lignes' => [
                [
                    'ligne_id' => $ligne->id,
                    'quantite_recue' => 1,
                ],
            ],
        ])->assertStatus(409);
    }

    /**
     * Régression : un fournisseur appartient à un tenant.
     *
     * Avant : fournisseur_id n'était validé que par exists:fournisseurs,id. Un
     * gérant pouvait attacher le fournisseur d'une autre boutique, et la
     * réponse de store renvoyait load('fournisseur') — donc le nom, l'email, le
     * téléphone, l'adresse et les contacts de l'autre tenant en clair.
     */
    public function test_refuse_un_fournisseur_d_autre_boutique(): void
    {
        Sanctum::actingAs($this->gerant);

        $autreGerant = User::create([
            'name' => 'Gérant Concurrent',
            'email' => 'gerant-concurrent@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);

        $autreBoutique = Boutique::create([
            'nom' => 'Boutique Concurrente',
            'adresse' => 'Cotonou',
            'proprietaire_id' => $autreGerant->id,
        ]);

        $fournisseurEtranger = Fournisseur::create([
            'nom' => 'Fournisseur Secret',
            'email' => 'secret@sgci.bj',
            'telephone' => '22990000000',
            'adresse' => 'Adresse confidentielle',
            'contact_principal' => 'Contact Confidentiel',
            'email_contact' => 'contact-secret@sgci.bj',
            'actif' => true,
            'boutique_id' => $autreBoutique->id,
        ]);

        $reponse = $this->postJson('/api/commandes-fournisseurs', [
            'fournisseur_id' => $fournisseurEtranger->id,
            'lignes' => [
                [
                    'produit_id' => $this->produit->id,
                    'quantite_commandee' => 5,
                    'prix_unitaire' => 1000,
                ],
            ],
        ])->assertStatus(422);

        $this->assertDatabaseMissing('commande_fournisseurs', [
            'fournisseur_id' => $fournisseurEtranger->id,
        ]);

        $corps = $reponse->getContent();
        foreach (['Secret', 'secret@sgci.bj', '22990000000', 'confidentielle', 'Confidentiel'] as $secret) {
            $this->assertStringNotContainsStringIgnoringCase($secret, $corps, 'Aucune donnée du fournisseur étranger ne doit fuiter.');
        }
    }

    public function test_store_refuse_un_produit_d_autre_boutique(): void
    {
        Sanctum::actingAs($this->gerant);

        $autreBoutique = Boutique::create([
            'nom' => 'Boutique Etranger Produits',
            'adresse' => 'Parakou',
            'proprietaire_id' => $this->gerant->id,
        ]);

        $categorieEtrangere = Categorie::create([
            'nom' => 'Catégorie Étrangère',
            'boutique_id' => $autreBoutique->id,
        ]);

        $produitEtranger = Produit::create([
            'nom' => 'Produit Etranger',
            'description' => 'Ne doit pas etre commandable',
            'prix' => 999,
            'quantite_stock' => 3,
            'seuil_alerte' => 1,
            'categorie_id' => $categorieEtrangere->id,
            'boutique_id' => $autreBoutique->id,
            'unite_mesure' => 'piece',
        ]);

        $this->postJson('/api/commandes-fournisseurs', [
            'fournisseur_id' => $this->fournisseur->id,
            'lignes' => [
                [
                    'produit_id' => $produitEtranger->id,
                    'quantite_commandee' => 2,
                    'prix_unitaire' => 500,
                ],
            ],
        ])->assertStatus(422)->assertJsonValidationErrors('lignes.0.produit_id');

        $this->assertDatabaseMissing('ligne_commande_fournisseurs', [
            'produit_id' => $produitEtranger->id,
        ]);
    }

    public function test_annuler_commande(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande();

        $this->postJson("/api/commandes-fournisseurs/{$commande->id}/annuler")
            ->assertOk()
            ->assertJsonPath('data.statut', 'annule');
    }

    public function test_ne_peut_pas_annuler_commande_livree(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande('livre');

        $this->postJson("/api/commandes-fournisseurs/{$commande->id}/annuler")
            ->assertStatus(409);
    }

    public function test_destroy_commande(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande();

        $this->deleteJson("/api/commandes-fournisseurs/{$commande->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Commande supprimée avec succès');

        $this->assertSoftDeleted('commande_fournisseurs', ['id' => $commande->id]);
    }

    public function test_ne_peut_pas_supprimer_une_commande_deja_validee(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande('en_cours');

        $this->deleteJson("/api/commandes-fournisseurs/{$commande->id}")
            ->assertStatus(409);

        $this->assertNotSoftDeleted('commande_fournisseurs', ['id' => $commande->id]);
    }

    public function test_caissier_ne_peut_pas_creer_de_commande(): void
    {
        $caissier = User::create([
            'name' => 'Caissier Commande Fournisseur',
            'email' => 'caissier-commande-fournisseur@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'caissier',
            'est_actif' => true,
        ]);

        $caissier->boutiques()->attach($this->boutique->id, ['role_dans_boutique' => 'caissier']);
        $caissier->update(['current_boutique_id' => $this->boutique->id]);

        Sanctum::actingAs($caissier);

        $this->postJson('/api/commandes-fournisseurs', [
            'fournisseur_id' => $this->fournisseur->id,
            'lignes' => [
                [
                    'produit_id' => $this->produit->id,
                    'quantite_commandee' => 1,
                    'prix_unitaire' => 1000,
                ],
            ],
        ])->assertStatus(403);
    }

    // ==================== ISOLATION MULTI-BOUTIQUE ====================

    /**
     * Produit d'une autre boutique, avec son stock initial.
     */
    private function produitEtranger(): Produit
    {
        $autreBoutique = Boutique::create([
            'nom' => 'Boutique Etrangere',
            'proprietaire_id' => $this->gerant->id,
        ]);

        $categorie = Categorie::create([
            'nom' => ' Categorie Etrangere',
            'boutique_id' => $autreBoutique->id,
        ]);

        return Produit::create([
            'nom' => 'Produit Etranger',
            'prix' => 1000,
            'quantite_stock' => 7,
            'seuil_alerte' => 2,
            'categorie_id' => $categorie->id,
            'boutique_id' => $autreBoutique->id,
            'unite_mesure' => 'piece',
        ]);
    }

    public function test_une_commande_ne_peut_pas_referencer_un_produit_d_une_autre_boutique(): void
    {
        Sanctum::actingAs($this->gerant);

        $etranger = $this->produitEtranger();

        $this->postJson('/api/commandes-fournisseurs', [
            'fournisseur_id' => $this->fournisseur->id,
            'lignes' => [
                [
                    'produit_id' => $etranger->id,
                    'quantite_commandee' => 5,
                    'prix_unitaire' => 1000,
                ],
            ],
        ])->assertStatus(422)->assertJsonValidationErrors('lignes.0.produit_id');

        $this->assertDatabaseCount('commande_fournisseurs', 0);
    }

    /**
     * Une ligne créée avant la correction (ou via un import) peut référencer un
     * produit devenu étranger. La réception doit refuser plutôt que d'augmenter
     * le stock de l'autre boutique.
     */
    public function test_receptionner_une_ligne_hors_tenant_refuse_sans_toucher_le_stock(): void
    {
        Sanctum::actingAs($this->gerant);

        $etranger = $this->produitEtranger();
        $stockEtrangerAvant = (int) $etranger->quantite_stock;

        $commande = $this->creerCommande('en_cours');
        $ligne = $commande->lignes->first();
        $ligne->update(['produit_id' => $etranger->id, 'quantite_commandee' => 5]);
        $ligne->refresh();

        $this->postJson("/api/commandes-fournisseurs/{$commande->id}/receptionner", [
            'lignes' => [
                ['ligne_id' => $ligne->id, 'quantite_recue' => 5],
            ],
        ])->assertStatus(422);

        $this->assertSame(
            $stockEtrangerAvant,
            (int) $etranger->fresh()->quantite_stock,
            'Le stock du produit d une autre boutique ne doit jamais bouger.'
        );

        $this->assertDatabaseMissing('mouvements_stock', ['produit_id' => $etranger->id]);
    }

    public function test_le_mouvement_de_reception_porte_le_boutique_du_produit_modifie(): void
    {
        Sanctum::actingAs($this->gerant);

        $commande = $this->creerCommande('en_cours');
        $ligne = $commande->lignes->first();
        $stockAvant = (int) $this->produit->quantite_stock;

        $this->postJson("/api/commandes-fournisseurs/{$commande->id}/receptionner", [
            'lignes' => [
                ['ligne_id' => $ligne->id, 'quantite_recue' => 2],
            ],
        ])->assertOk();

        $mouvement = MouvementStock::where('produit_id', $this->produit->id)
            ->latest('id')
            ->firstOrFail();

        // Le ledger doit désigner le tenant du produit modifié, pas celui de la
        // commande : c'est la seule façon de réconcilier mouvements_stock et
        // produits.quantite_stock.
        $this->assertSame(
            (int) $this->produit->boutique_id,
            (int) $mouvement->boutique_id,
            'Le mouvement doit pointer vers la boutique du produit incrémenté.'
        );
        $this->assertSame($stockAvant, (int) $mouvement->quantite_avant);
        $this->assertSame($stockAvant + 2, (int) $mouvement->quantite_apres);
    }
}
