<?php

namespace Tests\Feature;

use App\Models\AppNotification;
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

/**
 * Couvre le workflow d'arrivage complet : création, correction, suppression,
 * validation (totale et partielle), rejet, sécurité multi-boutique et
 * idempotence.
 */
class ArrivageTest extends TestCase
{
    use RefreshDatabase;

    private User $gerant;

    private Boutique $boutiqueA;

    private Boutique $boutiqueB;

    private Produit $produitA;

    protected function setUp(): void
    {
        parent::setUp();

        $proprietaire = User::create([
            'name' => 'Propriétaire',
            'email' => 'proprio@sgci.bj',
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

        $this->gerant = User::create([
            'name' => 'Gérant A',
            'email' => 'gerant-a@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);
        $this->gerant->forceFill(['current_boutique_id' => $this->boutiqueA->id])->save();
        $this->boutiqueA->users()->attach($this->gerant->id, ['role_dans_boutique' => 'gerant']);

        $this->produitA = $this->createProduit($this->boutiqueA, 'Riz', 10);

        Sanctum::actingAs($this->gerant);
    }

    private function createProduit(Boutique $boutique, string $nom, int $stock): Produit
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
            'seuil_alerte' => 3,
            'categorie_id' => $categorie->id,
            'boutique_id' => $boutique->id,
        ]);
    }

    private function creerArrivage(array $override = []): MouvementStock
    {
        $reponse = $this->postJson('/api/mouvements-stock', array_merge([
            'produit_id' => $this->produitA->id,
            'quantite' => 50,
            'raison' => 'arrivage',
            'type' => 'entree',
            'reference_bon' => 'BON-001',
        ], $override));

        $reponse->assertCreated();

        return MouvementStock::findOrFail($reponse->json('mouvement.id'));
    }

    /**
     * Un vendeur rattaché à la boutique A : c'est lui qui saisit les demandes,
     * le gérant les valide.
     */
    private function actingAsVendeur(): User
    {
        $vendeur = User::create([
            'name' => 'Vendeur',
            'email' => 'vendeur@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'vendeur',
            'est_actif' => true,
        ]);
        $vendeur->forceFill(['current_boutique_id' => $this->boutiqueA->id])->save();
        $this->boutiqueA->users()->attach($vendeur->id, ['role_dans_boutique' => 'vendeur']);

        Sanctum::actingAs($vendeur);

        return $vendeur;
    }

    // ==================== CRÉATION ====================

    public function test_un_arrivage_est_cree_en_attente_sans_toucher_au_stock(): void
    {
        $mouvement = $this->creerArrivage();

        $this->assertSame('en_attente', $mouvement->statut);
        $this->assertNull($mouvement->valide_par);
        $this->assertNull($mouvement->valide_le);
        $this->assertSame(10, $this->produitA->fresh()->quantite_stock, 'Le stock ne bouge qu\'à la validation');
        $this->assertSame(10, $mouvement->quantite_avant);
    }

    public function test_le_gérant_est_notifié_d_une_demande_à_valider(): void
    {
        // La demande est saisie par un vendeur : c'est le gérant, autre
        // personne, qui doit être prévenu qu'une validation l'attend.
        $vendeur = $this->actingAsVendeur();

        $this->creerArrivage();

        $this->assertDatabaseHas('app_notifications', [
            'user_id' => $this->gerant->id,
            'type' => 'arrivage_a_valider',
        ]);

        $this->assertDatabaseMissing('app_notifications', [
            'user_id' => $vendeur->id,
            'type' => 'arrivage_a_valider',
        ]);
    }

    public function test_l_auteur_est_notifié_une_fois_la_validation(): void
    {
        $vendeur = $this->actingAsVendeur();
        $mouvement = $this->creerArrivage();

        Sanctum::actingAs($this->gerant);
        $this->postJson("/api/mouvements-stock/{$mouvement->id}/valider")->assertOk();

        $this->assertDatabaseHas('app_notifications', [
            'user_id' => $vendeur->id,
            'type' => 'arrivage_valide',
        ]);
    }

    public function test_un_produit_d_une_autre_boutique_est_refusé(): void
    {
        $produitB = $this->createProduit($this->boutiqueB, 'Produit B', 5);

        $this->postJson('/api/mouvements-stock', [
            'produit_id' => $produitB->id,
            'quantite' => 10,
            'raison' => 'arrivage',
            'type' => 'entree',
        ])->assertStatus(422);

        $this->assertDatabaseCount('mouvements_stock', 0);
    }

    public function test_une_requete_sans_boutique_courante_est_refusée(): void
    {
        // Utilisateur sans aucune boutique rattachée : le middleware
        // BoutiqueScope ne peut rien lui assigner, la boutique courante
        // reste donc nulle et la saisie doit être refusée.
        $sansBoutique = User::create([
            'name' => 'Sans boutique',
            'email' => 'sans-boutique@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'vendeur',
            'est_actif' => true,
        ]);

        Sanctum::actingAs($sansBoutique);

        $this->postJson('/api/mouvements-stock', [
            'produit_id' => $this->produitA->id,
            'quantite' => 10,
            'raison' => 'arrivage',
            'type' => 'entree',
        ])->assertStatus(422);

        $this->assertDatabaseCount('mouvements_stock', 0);
    }

    // ==================== IDEMPOTENCE ====================

    public function test_la_cle_d_idempotence_évite_les_doublons(): void
    {
        $this->creerArrivage(['idempotency_key' => 'scan-123']);
        $seconde = $this->postJson('/api/mouvements-stock', [
            'produit_id' => $this->produitA->id,
            'quantite' => 50,
            'raison' => 'arrivage',
            'type' => 'entree',
            'idempotency_key' => 'scan-123',
        ]);

        $seconde->assertOk();
        $this->assertTrue($seconde->json('doublon'));
        $this->assertDatabaseCount('mouvements_stock', 1);
    }

    // ==================== MODIFICATION / SUPPRESSION ====================

    public function test_un_arrivage_en_attente_peut_être_modifié(): void
    {
        $mouvement = $this->creerArrivage();

        $this->putJson("/api/mouvements-stock/{$mouvement->id}", [
            'quantite' => 75,
            'notes' => 'Correction après comptage',
        ])->assertOk()->assertJsonPath('mouvement.quantite', 75);

        $this->assertSame(75, $mouvement->fresh()->quantite);
    }

    public function test_un_arrivage_validé_ne_peut_plus_être_modifié(): void
    {
        $mouvement = $this->creerArrivage();
        $this->postJson("/api/mouvements-stock/{$mouvement->id}/valider")->assertOk();

        $this->putJson("/api/mouvements-stock/{$mouvement->id}", ['quantite' => 999])
            ->assertStatus(409);

        $this->assertSame(50, $mouvement->fresh()->quantite);
    }

    public function test_un_arrivage_validé_ne_peut_plus_être_supprimé(): void
    {
        $mouvement = $this->creerArrivage();
        $this->postJson("/api/mouvements-stock/{$mouvement->id}/valider")->assertOk();

        // 409 et non 400 : le mouvement a bien ete trouve, il n est simplement
        // plus annulable. La distinction 404 / 409 / 422 est ce qui permet au
        // client de dire « traite entre-temps » plutot que « erreur » — et c est
        // aussi ce qui rend une suppression concurrente detectable.
        $this->deleteJson("/api/mouvements-stock/{$mouvement->id}")->assertStatus(409);

        $this->assertDatabaseHas('mouvements_stock', ['id' => $mouvement->id]);
    }

    public function test_un_arrivage_en_attente_peut_être_supprimé(): void
    {
        $mouvement = $this->creerArrivage();

        $this->deleteJson("/api/mouvements-stock/{$mouvement->id}")->assertOk();

        $this->assertDatabaseMissing('mouvements_stock', ['id' => $mouvement->id]);
    }

    // ==================== VALIDATION ====================

    public function test_valider_une_entrée_met_à_jour_le_stock_et_trace_le_validateur(): void
    {
        $mouvement = $this->creerArrivage();

        $reponse = $this->postJson("/api/mouvements-stock/{$mouvement->id}/valider")->assertOk();

        $reponse->assertJsonPath('statut', null); // pas de statut global
        $this->assertFalse($reponse->json('partiel'));
        $this->assertSame(10, $reponse->json('stock_precedent'));
        $this->assertSame(60, $reponse->json('stock_nouveau'));

        $mouvement = $mouvement->fresh();
        $this->assertSame('accepte', $mouvement->statut);
        $this->assertSame(50, $mouvement->quantite_recue);
        $this->assertSame(60, $mouvement->quantite_apres);
        $this->assertSame($this->gerant->id, $mouvement->valide_par);
        $this->assertNotNull($mouvement->valide_le);
        $this->assertSame(60, $this->produitA->fresh()->quantite_stock);
    }

    public function test_valider_deux_fois_le_même_mouvement_est_refusé(): void
    {
        $mouvement = $this->creerArrivage();
        $this->postJson("/api/mouvements-stock/{$mouvement->id}/valider")->assertOk();

        $this->postJson("/api/mouvements-stock/{$mouvement->id}/valider")->assertStatus(409);

        // Le stock ne doit pas avoir été crédité deux fois.
        $this->assertSame(60, $this->produitA->fresh()->quantite_stock);
    }

    public function test_une_réception_partielle_ne_credite_que_la_quantité_reçue(): void
    {
        $mouvement = $this->creerArrivage(['quantite' => 50]);

        $reponse = $this->postJson("/api/mouvements-stock/{$mouvement->id}/valider", [
            'quantite_recue' => 20,
        ])->assertOk();

        $this->assertTrue($reponse->json('partiel'));
        $this->assertSame(30, $reponse->json('stock_nouveau'));
        $this->assertSame(30, $reponse->json('quantite_restante'));

        $mouvement = $mouvement->fresh();
        $this->assertSame('accepte', $mouvement->statut, 'Le stock a bien été mouvementé');
        $this->assertTrue($mouvement->estPartiel());
        $this->assertSame('Partiellement reçu', $mouvement->libelle_statut);
    }

    public function test_la_quantité_reçue_ne_peut_pas_dépasser_la_quantité_annoncée(): void
    {
        $mouvement = $this->creerArrivage(['quantite' => 50]);

        $this->postJson("/api/mouvements-stock/{$mouvement->id}/valider", [
            'quantite_recue' => 80,
        ])->assertStatus(422);

        $this->assertSame('en_attente', $mouvement->fresh()->statut);
        $this->assertSame(10, $this->produitA->fresh()->quantite_stock);
    }

    public function test_une_sortie_supérieure_au_stock_est_refusée_à_la_validation(): void
    {
        // Demande saisie alors que le stock suffisait, puis le stock a été
        // consommé entre-temps : la garde de validation doit malgré tout
        // empêcher un stock négatif.
        $mouvement = MouvementStock::create([
            'produit_id' => $this->produitA->id,
            'quantite' => 999,
            'raison' => 'casse',
            'type' => 'sortie',
            'user_id' => $this->gerant->id,
            'statut' => 'en_attente',
            'boutique_id' => $this->boutiqueA->id,
        ]);

        $this->postJson("/api/mouvements-stock/{$mouvement->id}/valider")->assertStatus(400);

        $this->assertSame(10, $this->produitA->fresh()->quantite_stock);
        $this->assertSame('en_attente', $mouvement->fresh()->statut);
    }

    public function test_une_sortie_plus_grande_que_le_stock_est_refusée_à_la_création(): void
    {
        $this->postJson('/api/mouvements-stock', [
            'produit_id' => $this->produitA->id,
            'quantite' => 999,
            'raison' => 'casse',
            'type' => 'sortie',
        ])->assertStatus(422);

        $this->assertDatabaseCount('mouvements_stock', 0);
    }

    // ==================== SÉCURITÉ MULTI-BOUTIQUE ====================

    public function test_un_gérant_ne_peut_pas_valider_un_mouvement_d_une_autre_boutique(): void
    {
        $produitB = $this->createProduit($this->boutiqueB, 'Produit B', 5);

        $mouvement = MouvementStock::create([
            'produit_id' => $produitB->id,
            'quantite' => 10,
            'raison' => 'arrivage',
            'type' => 'entree',
            'user_id' => $this->gerant->id,
            'statut' => 'en_attente',
            'boutique_id' => $this->boutiqueB->id,
        ]);

        $this->postJson("/api/mouvements-stock/{$mouvement->id}/valider")->assertStatus(403);
        $this->getJson("/api/mouvements-stock/{$mouvement->id}")->assertStatus(403);
        $this->postJson("/api/mouvements-stock/{$mouvement->id}/rejeter", [
            'raison_rejet' => 'x',
        ])->assertStatus(403);
        $this->deleteJson("/api/mouvements-stock/{$mouvement->id}")->assertStatus(403);

        $this->assertSame(5, $produitB->fresh()->quantite_stock);
        $this->assertSame('en_attente', $mouvement->fresh()->statut);
    }

    public function test_un_vendeur_ne_peut_pas_valider(): void
    {
        $vendeur = User::create([
            'name' => 'Vendeur',
            'email' => 'vendeur@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'vendeur',
            'est_actif' => true,
        ]);
        $vendeur->forceFill(['current_boutique_id' => $this->boutiqueA->id])->save();
        $this->boutiqueA->users()->attach($vendeur->id, ['role_dans_boutique' => 'vendeur']);

        $mouvement = $this->creerArrivage();

        Sanctum::actingAs($vendeur);
        $this->postJson("/api/mouvements-stock/{$mouvement->id}/valider")->assertStatus(403);
    }

    public function test_la_liste_ne_montre_que_sa_boutique(): void
    {
        $produitB = $this->createProduit($this->boutiqueB, 'Produit B', 5);

        $this->creerArrivage();

        MouvementStock::create([
            'produit_id' => $produitB->id,
            'quantite' => 5,
            'raison' => 'arrivage',
            'type' => 'entree',
            'user_id' => $this->gerant->id,
            'statut' => 'en_attente',
            'boutique_id' => $this->boutiqueB->id,
        ]);

        $reponse = $this->getJson('/api/mouvements-stock')->assertOk();

        $ids = collect($reponse->json('data'))->pluck('boutique_id')->unique()->all();
        $this->assertSame([$this->boutiqueA->id], $ids);
    }

    // ==================== REJET ====================

    public function test_le_rejet_exige_un_motif_et_notifie_l_auteur(): void
    {
        $mouvement = $this->creerArrivage();

        $this->postJson("/api/mouvements-stock/{$mouvement->id}/rejeter", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors('raison_rejet');

        $this->postJson("/api/mouvements-stock/{$mouvement->id}/rejeter", [
            'raison_rejet' => 'Marchandise endommagée',
        ])->assertOk();

        $mouvement = $mouvement->fresh();
        $this->assertSame('rejete', $mouvement->statut);
        $this->assertSame('Marchandise endommagée', $mouvement->motif_rejet);
        $this->assertSame($this->gerant->id, $mouvement->valide_par);
        $this->assertSame(10, $this->produitA->fresh()->quantite_stock, 'Un rejet ne touche pas au stock');
    }

    // ==================== PÉREMPTION ====================

    public function test_une_péremption_avant_la_fabrication_est_refusée(): void
    {
        $this->postJson('/api/mouvements-stock', [
            'produit_id' => $this->produitA->id,
            'quantite' => 10,
            'raison' => 'arrivage',
            'type' => 'entree',
            'date_fabrication' => '2026-05-01',
            'date_peremption' => '2026-04-01',
        ])->assertStatus(422)->assertJsonPath('errors.date_peremption', 'La date de péremption ne peut pas précéder la date de fabrication');
    }

    public function test_la_péremption_se_saisit_sans_date_de_fabrication(): void
    {
        $mouvement = $this->creerArrivage(['date_peremption' => '2027-01-31']);

        $this->assertSame('2027-01-31', $mouvement->fresh()->date_peremption->format('Y-m-d'));
    }

    public function test_la_validation_remonte_la_péremption_au_produit(): void
    {
        $mouvement = $this->creerArrivage([
            'date_fabrication' => '2026-05-01',
            'date_peremption' => '2027-05-01',
        ]);

        $this->postJson("/api/mouvements-stock/{$mouvement->id}/valider")->assertOk();

        $produit = $this->produitA->fresh();
        $this->assertTrue($produit->est_perissable);
        $this->assertSame('2027-05-01', $produit->date_peremption->format('Y-m-d'));
        $this->assertSame('2026-05-01', $produit->date_fabrication->format('Y-m-d'));
    }

    public function test_un_nouveau_lot_avec_une_péremption_plus_proche_prime(): void
    {
        $produit = $this->produitA;
        $produit->update(['est_perissable' => true, 'date_peremption' => '2027-01-01']);

        $mouvement = $this->creerArrivage(['date_peremption' => '2026-12-01']);
        $this->postJson("/api/mouvements-stock/{$mouvement->id}/valider")->assertOk();

        $this->assertSame('2026-12-01', $produit->fresh()->date_peremption->format('Y-m-d'));
    }

    // ==================== RAPPORT AVEC COMMANDE FOURNISSEUR ====================

    public function test_la_validation_report_la_quantité_sur_la_ligne_de_commande(): void
    {
        $commande = CommandeFournisseur::create([
            'numero_commande' => 'CF-001',
            'fournisseur_id' => $this->createFournisseur(),
            'boutique_id' => $this->boutiqueA->id,
            'statut' => 'en_cours',
            'date_commande' => now(),
        ]);

        $ligne = LigneCommandeFournisseur::create([
            'commande_fournisseur_id' => $commande->id,
            'produit_id' => $this->produitA->id,
            'quantite_commandee' => 50,
            'quantite_recue' => 0,
            'prix_unitaire' => 1000,
        ]);

        $mouvement = $this->creerArrivage([
            'quantite' => 50,
            'commande_fournisseur_id' => $commande->id,
            'ligne_commande_fournisseur_id' => $ligne->id,
        ]);

        $this->postJson("/api/mouvements-stock/{$mouvement->id}/valider", [
            'quantite_recue' => 20,
        ])->assertOk();

        $ligne = $ligne->fresh();
        $this->assertSame(20, $ligne->quantite_recue);
        $this->assertSame('partiel', $ligne->statut);
        $this->assertSame(30, $ligne->quantite_restante);
        $this->assertSame('en_cours', $commande->fresh()->statut);

        // Le reliquat se réceptionne dans un second mouvement.
        $second = $this->creerArrivage([
            'quantite' => 30,
            'commande_fournisseur_id' => $commande->id,
            'ligne_commande_fournisseur_id' => $ligne->id,
        ]);
        $this->postJson("/api/mouvements-stock/{$second->id}/valider")->assertOk();

        $ligne = $ligne->fresh();
        $this->assertSame(50, $ligne->quantite_recue);
        $this->assertSame('recu', $ligne->statut);

        $commande = $commande->fresh();
        $this->assertSame('livre', $commande->statut);
        $this->assertNotNull($commande->date_livraison_reelle);
    }

    private function createFournisseur(): int
    {
        return Fournisseur::create([
            'nom' => 'Fournisseur Test',
            'contact' => '+229 90 00 00 00',
            'boutique_id' => $this->boutiqueA->id,
        ])->id;
    }

    // ==================== ALERTES ET STATISTIQUES ====================

    public function test_une_alerte_de_stock_obsolète_est_résolue_par_une_entrée(): void
    {
        $produit = $this->produitA;
        $produit->update(['quantite_stock' => 1]);

        AppNotification::create([
            'user_id' => $this->gerant->id,
            'type' => 'stock_alert',
            'title' => 'Stock bas',
            'message' => 'Riz est en rupture',
            'data' => [
                'boutique_id' => $this->boutiqueA->id,
                'produit_id' => $produit->id,
            ],
        ]);

        $mouvement = $this->creerArrivage(['quantite' => 50]);
        $this->postJson("/api/mouvements-stock/{$mouvement->id}/valider")->assertOk();

        $alerte = AppNotification::where('type', 'stock_alert')->first();
        $this->assertNotNull($alerte->read_at, 'Une alerte de stock devenue fausse doit être close');
    }

    public function test_les_statistiques_comptent_les_réceptions_partielles(): void
    {
        $mouvement = $this->creerArrivage(['quantite' => 50]);
        $this->postJson("/api/mouvements-stock/{$mouvement->id}/valider", [
            'quantite_recue' => 20,
        ])->assertOk();

        $reponse = $this->getJson('/api/mouvements-stock/statistiques')->assertOk();

        $this->assertSame(20, $reponse->json('total_entrees'));
        $this->assertSame(1, $reponse->json('receptions_partielles'));
        $this->assertSame(0, $reponse->json('en_attente'));
    }
}
