<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\Categorie;
use App\Models\Client;
use App\Models\LigneVente;
use App\Models\MouvementStock;
use App\Models\Produit;
use App\Models\User;
use App\Models\Vente;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class VenteSecuriteTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Ce test contrôle lui-même les rattachements : on désactive la
     * provisionnement automatique de boutiques de test.
     */
    protected function setUp(): void
    {
        parent::setUp();

        $this->sansProvisionnerBoutique();
    }

    private function proprio(string $email = 'proprio@sgci.bj'): User
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

    private function caissierDe(Boutique $b, string $email): User
    {
        $c = User::create([
            'name' => 'Caissier', 'email' => $email,
            'password' => Hash::make('password'), 'role' => 'caissier', 'est_actif' => true,
        ]);
        $b->users()->attach($c->id, ['role_dans_boutique' => 'caissier']);
        $c->forceFill(['current_boutique_id' => $b->id])->save();

        return $c;
    }

    private function produitDans(Boutique $b, string $nom, int $stock = 10, float $prix = 1000): Produit
    {
        $cat = Categorie::first() ?? Categorie::create([
            'nom' => 'Cat '.$b->id, 'description' => 'x', 'couleur' => '#000', 'icone' => 'box',
        ]);

        return Produit::create([
            'nom' => $nom, 'description' => 'x', 'prix' => $prix,
            'quantite_stock' => $stock, 'seuil_alerte' => 2,
            'categorie_id' => $cat->id, 'unite_mesure' => 'unite',
            'boutique_id' => $b->id,
        ]);
    }

    // ------------------------------------------------ fuite inter-boutiques

    public function test_caissier_ne_peut_pas_vendre_un_produit_d_autre_boutique(): void
    {
        $pA = $this->proprio('pa@sgci.bj');
        $bA = $this->boutiqueDe($pA, 'Boutique A');
        $produitA = $this->produitDans($bA, 'Produit A', stock: 10, prix: 5000);

        $pB = $this->proprio('pb@sgci.bj');
        $bB = $this->boutiqueDe($pB, 'Boutique B');
        $caissierB = $this->caissierDe($bB, 'caissier-b@sgci.bj');

        Sanctum::actingAs($caissierB);

        // POST /ventes (direct)
        $this->postJson('/api/ventes', [
            'ligne_ventes' => [['produit_id' => $produitA->id, 'quantite' => 1]],
            'mode_paiement' => 'especes',
        ])->assertStatus(422)->assertJsonValidationErrors('ligne_ventes.0.produit_id');

        // POST /ventes/checkout (panier)
        $this->postJson('/api/ventes/checkout', [
            'ligne_ventes' => [['produit_id' => $produitA->id, 'quantite' => 1]],
        ])->assertStatus(422)->assertJsonValidationErrors('ligne_ventes.0.produit_id');

        $this->assertSame(0, Vente::count(), 'Aucune vente ne doit être créée.');
        $this->assertSame(10, $produitA->fresh()->quantite_stock,
            'Le stock de la boutique A ne doit pas être touché.');
        $this->assertSame(0, MouvementStock::count(), 'Aucun mouvement de stock ne doit être écrit.');
    }

    public function test_client_d_autre_boutique_est_refuse(): void
    {
        $pA = $this->proprio('pa@sgci.bj');
        $bA = $this->boutiqueDe($pA, 'Boutique A');
        $produitA = $this->produitDans($bA, 'Produit A');

        $clientA = Client::create([
            'nom' => 'Client A', 'email' => 'client-a@sgci.bj', 'telephone' => '90000000',
            'boutique_id' => $bA->id,
        ]);

        $pB = $this->proprio('pb@sgci.bj');
        $bB = $this->boutiqueDe($pB, 'Boutique B');
        $produitB = $this->produitDans($bB, 'Produit B');
        $caissierB = $this->caissierDe($bB, 'caissier-b@sgci.bj');

        Sanctum::actingAs($caissierB);

        $this->postJson('/api/ventes', [
            'ligne_ventes' => [['produit_id' => $produitB->id, 'quantite' => 1]],
            'client_id' => $clientA->id,
            'mode_paiement' => 'especes',
        ])->assertStatus(422)->assertJsonValidationErrors('client_id');

        $this->assertSame(0, Vente::count());
    }

    public function test_vente_d_autre_boutique_reste_invisible_et_inactionnable(): void
    {
        $pA = $this->proprio('pa@sgci.bj');
        $bA = $this->boutiqueDe($pA, 'Boutique A');
        $produitA = $this->produitDans($bA, 'Produit A', stock: 10);

        $venteA = $this->venteEnCours($pA, $bA, $produitA);

        $pB = $this->proprio('pb@sgci.bj');
        $bB = $this->boutiqueDe($pB, 'Boutique B');
        $caissierB = $this->caissierDe($bB, 'caissier-b@sgci.bj');

        Sanctum::actingAs($caissierB);

        // Invisible, donc inexploitable : 404 et non 403
        $this->getJson("/api/ventes/{$venteA->id}")->assertNotFound();
        $this->putJson("/api/ventes/{$venteA->id}", ['notes' => 'pirate'])->assertNotFound();
        $this->postJson("/api/ventes/{$venteA->id}/terminer", [])->assertNotFound();
        $this->postJson("/api/ventes/{$venteA->id}/annuler")->assertNotFound();
        $this->deleteJson("/api/ventes/{$venteA->id}")->assertNotFound();
        $this->getJson("/api/ventes/{$venteA->id}/facture")->assertNotFound();

        $this->getJson('/api/ventes')->assertOk()->assertJsonPath('total', 0);
        $this->assertSame(10, $produitA->fresh()->quantite_stock);
    }

    public function test_sync_offline_refuse_un_produit_d_autre_boutique(): void
    {
        $pA = $this->proprio('pa@sgci.bj');
        $bA = $this->boutiqueDe($pA, 'Boutique A');
        $produitA = $this->produitDans($bA, 'Produit A', stock: 10);

        $pB = $this->proprio('pb@sgci.bj');
        $bB = $this->boutiqueDe($pB, 'Boutique B');
        $caissierB = $this->caissierDe($bB, 'caissier-b@sgci.bj');

        Sanctum::actingAs($caissierB);

        // Un lot contenant un produit d'un autre tenant est rejeté en bloc :
        // une caisse légitime n'a aucune raison de produire cette référence.
        $this->postJson('/api/ventes/sync-offline-batch', [
            'ventes' => [[
                'idempotency_key' => 'off-1',
                'ligne_ventes' => [['produit_id' => $produitA->id, 'quantite' => 1]],
                'mode_paiement' => 'especes',
            ]],
        ])->assertStatus(422)->assertJsonValidationErrors('ventes.0.ligne_ventes.0.produit_id');

        $this->assertSame(0, Vente::count());
        $this->assertSame(10, $produitA->fresh()->quantite_stock);
    }

    public function test_sync_offline_accepte_un_lot_valide(): void
    {
        $p = $this->proprio('p@sgci.bj');
        $b = $this->boutiqueDe($p, 'Boutique A');
        $produit = $this->produitDans($b, 'Produit A', stock: 10, prix: 1000);
        $caissier = $this->caissierDe($b, 'caissier@sgci.bj');

        Sanctum::actingAs($caissier);

        $reponse = $this->postJson('/api/ventes/sync-offline-batch', [
            'ventes' => [[
                'idempotency_key' => 'off-ok-1',
                'ligne_ventes' => [['produit_id' => $produit->id, 'quantite' => 2]],
                'mode_paiement' => 'especes',
            ]],
        ])->assertOk();

        $this->assertSame(1, $reponse->json('succes'));
        $this->assertSame(0, $reponse->json('echecs'));
        $this->assertTrue($reponse->json('results.0.success'));
        $this->assertSame(8, $produit->fresh()->quantite_stock);
    }

    public function test_sync_offline_rejoue_le_meme_lot_sans_recreer_la_vente(): void
    {
        $p = $this->proprio('p@sgci.bj');
        $b = $this->boutiqueDe($p, 'Boutique A');
        $produit = $this->produitDans($b, 'Produit A', stock: 10, prix: 1000);
        $caissier = $this->caissierDe($b, 'caissier@sgci.bj');

        Sanctum::actingAs($caissier);

        $lot = [
            'ventes' => [[
                'idempotency_key' => 'off-rejeu-1',
                'ligne_ventes' => [['produit_id' => $produit->id, 'quantite' => 2]],
                'mode_paiement' => 'especes',
            ]],
        ];

        $premier = $this->postJson('/api/ventes/sync-offline-batch', $lot)->assertOk();
        $this->assertNotTrue($premier->json('results.0.idempotent'));
        $this->assertSame(8, $produit->fresh()->quantite_stock);

        // Rejeu reseau du meme lot : la vente ne doit pas etre recreee et le
        // stock ne doit surtout pas etre decremente une seconde fois.
        $second = $this->postJson('/api/ventes/sync-offline-batch', $lot)->assertOk();

        $this->assertSame(1, $second->json('succes'));
        $this->assertSame(0, $second->json('echecs'));
        $this->assertTrue($second->json('results.0.idempotent'));
        $this->assertSame(
            $premier->json('results.0.vente.id'),
            $second->json('results.0.vente.id'),
            'Le rejeu doit renvoyer la vente deja enregistree, pas une nouvelle.'
        );
        $this->assertSame(1, Vente::where('boutique_id', $b->id)->count());
        $this->assertSame(8, $produit->fresh()->quantite_stock,
            'Le rejeu ne doit pas decrementer le stock une seconde fois.');
    }

    // ------------------------------------------------ parcours nominal

    private function venteEnCours(User $actor, Boutique $b, Produit $produit): Vente
    {
        $vente = Vente::create([
            'user_id' => $actor->id,
            'boutique_id' => $b->id,
            'statut' => 'en_cours',
            'montant_total' => $produit->prix,
            'tva' => 0,
            'remise' => 0,
        ]);

        LigneVente::create([
            'vente_id' => $vente->id,
            'produit_id' => $produit->id,
            'quantite' => 1,
            'prix_unitaire' => $produit->prix,
            'sous_total' => $produit->prix,
        ]);

        return $vente;
    }

    public function test_checkout_puis_terminer_decremente_le_stock_une_seule_fois(): void
    {
        $p = $this->proprio('p@sgci.bj');
        $b = $this->boutiqueDe($p, 'Boutique A');
        $produit = $this->produitDans($b, 'Produit A', stock: 10, prix: 2000);
        $caissier = $this->caissierDe($b, 'caissier@sgci.bj');

        Sanctum::actingAs($caissier);

        $venteId = $this->postJson('/api/ventes/checkout', [
            'ligne_ventes' => [['produit_id' => $produit->id, 'quantite' => 3]],
        ])->assertCreated()->json('id');

        // Le checkout ne touche PAS au stock
        $this->assertSame(10, $produit->fresh()->quantite_stock,
            'Le checkout ne doit pas décrémenter le stock.');

        $this->postJson("/api/ventes/{$venteId}/terminer", [
            'mode_paiement' => 'especes',
            'montant_recu' => 10000,
        ])->assertOk();

        $this->assertSame(7, $produit->fresh()->quantite_stock);
        $this->assertSame('termine', Vente::find($venteId)->statut);

        $mouvement = MouvementStock::where('raison', 'vente')->firstOrFail();
        $this->assertSame($b->id, (int) $mouvement->boutique_id);
        $this->assertSame(10, (int) $mouvement->quantite_avant);
        $this->assertSame(7, (int) $mouvement->quantite_apres);

        // Re-terminer est refusé. 409 et non 422 : la vente existe, mais son
        // état n'est plus compatible — le même code que la double annulation,
        // puisque c'est la même situation vue sous un autre angle.
        $this->postJson("/api/ventes/{$venteId}/terminer", [])->assertStatus(409);
    }

    public function test_annulation_apres_terminer_restaure_le_stock(): void
    {
        $p = $this->proprio('p@sgci.bj');
        $b = $this->boutiqueDe($p, 'Boutique A');
        $produit = $this->produitDans($b, 'Produit A', stock: 10, prix: 2000);
        $caissier = $this->caissierDe($b, 'caissier@sgci.bj');

        Sanctum::actingAs($caissier);

        $venteId = $this->postJson('/api/ventes/checkout', [
            'ligne_ventes' => [['produit_id' => $produit->id, 'quantite' => 4]],
        ])->assertCreated()->json('id');

        $this->postJson("/api/ventes/{$venteId}/terminer", ['mode_paiement' => 'especes'])->assertOk();
        $this->assertSame(6, $produit->fresh()->quantite_stock);

        $this->postJson("/api/ventes/{$venteId}/annuler")->assertOk();

        $this->assertSame(10, $produit->fresh()->quantite_stock,
            'Une vente annulée doit restituer le stock.');

        // Le journal des mouvements doit se réconcilier avec le stock :
        // une sortie (vente) puis une entrée compensatrice (annulation).
        $this->assertSame(1, MouvementStock::where('raison', 'vente')->count());
        $this->assertSame(1, MouvementStock::where('raison', 'annulation_vente')->count());

        $annulation = MouvementStock::where('raison', 'annulation_vente')->firstOrFail();
        $this->assertSame('entree', $annulation->type);
        $this->assertSame(6, (int) $annulation->quantite_avant);
        $this->assertSame(10, (int) $annulation->quantite_apres);
        $this->assertSame($b->id, (int) $annulation->boutique_id);

        // Le cumul des mouvements doit égaler le delta de stock
        // (stock final - stock initial). Ici 10 - 10 = 0 : l'annulation
        // a bien annulé l'effet de la vente dans le journal.
        $cumul = MouvementStock::where('produit_id', $produit->id)->get()
            ->sum(fn ($m) => $m->type === 'sortie' ? -(int) $m->quantite : (int) $m->quantite);
        $this->assertSame(0, $cumul,
            'Sortie (-4) et entrée compensatrice (+4) doivent se neutraliser.');
    }

    public function test_la_reponse_dannulation_reflete_letat_reellement_ecrit(): void
    {
        $p = $this->proprio('p@sgci.bj');
        $b = $this->boutiqueDe($p, 'Boutique A');
        $produit = $this->produitDans($b, 'Produit A', stock: 10, prix: 2000);

        Sanctum::actingAs($this->caissierDe($b, 'caissier@sgci.bj'));

        $venteId = $this->postJson('/api/ventes/checkout', [
            'ligne_ventes' => [['produit_id' => $produit->id, 'quantite' => 4]],
        ])->assertCreated()->json('id');

        $this->postJson("/api/ventes/{$venteId}/terminer", ['mode_paiement' => 'especes'])->assertOk();

        $this->postJson("/api/ventes/{$venteId}/annuler")
            ->assertOk()
            ->assertJsonPath('vente.statut', 'annule');

        // Le piège ici n'était pas la base, qui était correcte, mais la
        // réponse : annuler() relit la vente sous verrou et travaille donc sur
        // une autre instance que celle fournie par le routeur. Sérialiser
        // l'instance d'origine renvoyait « termine » alors que la ligne était
        // bien « annule », et le client affichait une vente non annulée.
        $this->assertSame(
            'annule',
            Vente::find($venteId)->statut,
            'Le statut en base et celui renvoyé doivent convenir.'
        );
    }

    public function test_deux_annulations_sequentielles_refusent_la_seconde_en_409(): void
    {
        $p = $this->proprio('p@sgci.bj');
        $b = $this->boutiqueDe($p, 'Boutique A');
        $produit = $this->produitDans($b, 'Produit A', stock: 10, prix: 2000);

        Sanctum::actingAs($this->caissierDe($b, 'caissier@sgci.bj'));

        $venteId = $this->postJson('/api/ventes/checkout', [
            'ligne_ventes' => [['produit_id' => $produit->id, 'quantite' => 4]],
        ])->assertCreated()->json('id');

        $this->postJson("/api/ventes/{$venteId}/terminer", ['mode_paiement' => 'especes'])->assertOk();
        $this->postJson("/api/ventes/{$venteId}/annuler")->assertOk();

        $this->postJson("/api/ventes/{$venteId}/annuler")->assertStatus(409);

        $this->assertSame(10, $produit->fresh()->quantite_stock,
            'La seconde annulation ne doit rien rendre de plus.');
        $this->assertSame(1, MouvementStock::where('raison', 'annulation_vente')->count(),
            'Un seul mouvement compensateur, pas deux.');
    }

    public function test_le_delai_annulation_vient_de_la_boutique_de_la_vente(): void
    {
        // La boutique n'impose aucun délai : une vente ancienne reste
        // annulable. Avant le correctif, le délai lu venait du singleton
        // BoutiqueSetting (5 minutes par défaut), donc toute vente de plus de
        // 5 minutes était refusée quelle que soit la configuration de l'agence.
        $p = $this->proprio('p@sgci.bj');
        $b = $this->boutiqueDe($p, 'Boutique Sans Delai');
        $b->update(['delai_annulation_vente_minutes' => 0]);

        $produit = $this->produitDans($b, 'Produit A', stock: 10, prix: 2000);
        $caissier = $this->caissierDe($b, 'caissier@sgci.bj');

        Sanctum::actingAs($caissier);

        $venteId = $this->postJson('/api/ventes/checkout', [
            'ligne_ventes' => [['produit_id' => $produit->id, 'quantite' => 1]],
        ])->assertCreated()->json('id');

        $this->postJson("/api/ventes/{$venteId}/terminer", ['mode_paiement' => 'especes'])->assertOk();

        Vente::find($venteId)->forceFill(['created_at' => now()->subMinutes(120)])->save();

        $this->postJson("/api/ventes/{$venteId}/annuler")->assertOk();
        $this->assertSame('annule', Vente::find($venteId)->statut);
    }

    public function test_une_boutique_avec_un_delai_long_peut_annuler_au_dela_du_delai_par_defaut(): void
    {
        // Symétrique du test précédent : cette agence a 60 minutes de délai,
        // donc une vente de 30 minutes est annulable. Le singleton imposait 5
        // minutes et refusait à tort.
        $p = $this->proprio('p@sgci.bj');
        $b = $this->boutiqueDe($p, 'Boutique Delai Long');
        $b->update(['delai_annulation_vente_minutes' => 60]);

        $produit = $this->produitDans($b, 'Produit A', stock: 10, prix: 2000);
        $caissier = $this->caissierDe($b, 'caissier@sgci.bj');

        Sanctum::actingAs($caissier);

        $venteId = $this->postJson('/api/ventes/checkout', [
            'ligne_ventes' => [['produit_id' => $produit->id, 'quantite' => 1]],
        ])->assertCreated()->json('id');

        $this->postJson("/api/ventes/{$venteId}/terminer", ['mode_paiement' => 'especes'])->assertOk();

        Vente::find($venteId)->forceFill(['created_at' => now()->subMinutes(30)])->save();

        $this->postJson("/api/ventes/{$venteId}/annuler")->assertOk();
        $this->assertSame('annule', Vente::find($venteId)->statut);
    }

    public function test_le_delai_de_la_boutique_est_bien_applique_au_dela(): void
    {
        // Contrôle négatif : le délai de 60 minutes doit toujours bloquer.
        $p = $this->proprio('p@sgci.bj');
        $b = $this->boutiqueDe($p, 'Boutique Delai Long');
        $b->update(['delai_annulation_vente_minutes' => 60]);

        $produit = $this->produitDans($b, 'Produit A', stock: 10, prix: 2000);
        $caissier = $this->caissierDe($b, 'caissier@sgci.bj');

        Sanctum::actingAs($caissier);

        $venteId = $this->postJson('/api/ventes/checkout', [
            'ligne_ventes' => [['produit_id' => $produit->id, 'quantite' => 1]],
        ])->assertCreated()->json('id');

        $this->postJson("/api/ventes/{$venteId}/terminer", ['mode_paiement' => 'especes'])->assertOk();

        Vente::find($venteId)->forceFill(['created_at' => now()->subMinutes(90)])->save();

        $this->postJson("/api/ventes/{$venteId}/annuler")->assertStatus(422);
        $this->assertSame('termine', Vente::find($venteId)->statut);
    }

    public function test_stock_insuffisant_refuse_la_terminaison(): void
    {
        $p = $this->proprio('p@sgci.bj');
        $b = $this->boutiqueDe($p, 'Boutique A');
        $produit = $this->produitDans($b, 'Produit A', stock: 2, prix: 1000);
        $caissier = $this->caissierDe($b, 'caissier@sgci.bj');

        Sanctum::actingAs($caissier);

        // Le checkout refuse déjà de dépasser le stock
        $this->postJson('/api/ventes/checkout', [
            'ligne_ventes' => [['produit_id' => $produit->id, 'quantite' => 5]],
        ])->assertStatus(422);

        $this->assertSame(2, $produit->fresh()->quantite_stock);
    }

    public function test_idempotence_evite_le_double_encaissement(): void
    {
        $p = $this->proprio('p@sgci.bj');
        $b = $this->boutiqueDe($p, 'Boutique A');
        $produit = $this->produitDans($b, 'Produit A', stock: 10, prix: 1000);
        $caissier = $this->caissierDe($b, 'caissier@sgci.bj');

        Sanctum::actingAs($caissier);

        $payload = [
            'idempotency_key' => 'vente-unique-1',
            'ligne_ventes' => [['produit_id' => $produit->id, 'quantite' => 2]],
            'mode_paiement' => 'especes',
        ];

        $premiere = $this->postJson('/api/ventes', $payload)->assertCreated()->json('id');
        $this->assertSame(8, $produit->fresh()->quantite_stock);

        $seconde = $this->postJson('/api/ventes', $payload)->assertOk()->json('id');

        $this->assertSame($premiere, $seconde, 'La clé d\'idempotence doit renvoyer la vente existante.');
        $this->assertSame(1, Vente::count());
        $this->assertSame(8, $produit->fresh()->quantite_stock,
            'La rejouement ne doit pas décrémenter le stock une seconde fois.');
    }

    public function test_sync_offline_un_echec_isole_n_annule_pas_le_reste_du_lot(): void
    {
        $p = $this->proprio('p@sgci.bj');
        $b = $this->boutiqueDe($p, 'Boutique A');
        $ok = $this->produitDans($b, 'Produit OK', stock: 10, prix: 1000);
        $rupture = $this->produitDans($b, 'Produit Rupture', stock: 1, prix: 1000);
        $caissier = $this->caissierDe($b, 'caissier@sgci.bj');

        Sanctum::actingAs($caissier);

        $reponse = $this->postJson('/api/ventes/sync-offline-batch', [
            'ventes' => [
                [
                    'idempotency_key' => 'lot-1',
                    'ligne_ventes' => [['produit_id' => $ok->id, 'quantite' => 2]],
                    'mode_paiement' => 'especes',
                ],
                [
                    // Stock insuffisant : cette vente doit échouer proprement
                    'idempotency_key' => 'lot-2',
                    'ligne_ventes' => [['produit_id' => $rupture->id, 'quantite' => 5]],
                    'mode_paiement' => 'especes',
                ],
                [
                    'idempotency_key' => 'lot-3',
                    'ligne_ventes' => [['produit_id' => $ok->id, 'quantite' => 1]],
                    'mode_paiement' => 'especes',
                ],
            ],
        ])->assertOk();

        $this->assertSame(2, $reponse->json('succes'), 'Les ventes 1 et 3 doivent passer.');
        $this->assertSame(1, $reponse->json('echecs'), 'La vente 2 doit échouer.');

        $this->assertSame(2, Vente::count(), 'La vente en rupture ne doit pas laisser de ligne.');

        // Aucune vente fantôme pour le produit en rupture, et son stock intact
        $this->assertSame(0, LigneVente::where('produit_id', $rupture->id)->count());
        $this->assertSame(1, (int) $rupture->fresh()->quantite_stock);

        // Le produit sain : 2 + 1 décrémentés, pas plus
        $this->assertSame(7, (int) $ok->fresh()->quantite_stock);
    }

    public function test_cle_idempotence_ne_collide_pas_entre_boutiques(): void
    {
        $pA = $this->proprio('pa@sgci.bj');
        $bA = $this->boutiqueDe($pA, 'Boutique A');
        $produitA = $this->produitDans($bA, 'Produit A', stock: 10, prix: 1000);
        $caissierA = $this->caissierDe($bA, 'caissier-a@sgci.bj');

        Sanctum::actingAs($caissierA);
        $this->postJson('/api/ventes', [
            'idempotency_key' => 'cle-partagee',
            'ligne_ventes' => [['produit_id' => $produitA->id, 'quantite' => 1]],
            'mode_paiement' => 'especes',
        ])->assertCreated();

        $pB = $this->proprio('pb@sgci.bj');
        $bB = $this->boutiqueDe($pB, 'Boutique B');
        $produitB = $this->produitDans($bB, 'Produit B', stock: 10, prix: 1000);
        $caissierB = $this->caissierDe($bB, 'caissier-b@sgci.bj');

        Sanctum::actingAs($caissierB);

        // Même clé, autre boutique : la déduplication est par boutique,
        // donc la vente doit être créée et non rejetée par l'index unique.
        $reponse = $this->postJson('/api/ventes', [
            'idempotency_key' => 'cle-partagee',
            'ligne_ventes' => [['produit_id' => $produitB->id, 'quantite' => 1]],
            'mode_paiement' => 'especes',
        ]);

        $this->assertSame(201, $reponse->status(), json_encode($reponse->json()));

        $this->assertSame(2, Vente::count());
        $this->assertSame(9, (int) $produitA->fresh()->quantite_stock);
        $this->assertSame(9, (int) $produitB->fresh()->quantite_stock);
    }

    public function test_tva_et_entete_facture_sont_propres_a_la_boutique(): void
    {
        $pA = $this->proprio('pa@sgci.bj');
        $bA = $this->boutiqueDe($pA, 'Boutique A');
        $bA->update(['taux_tva' => 18, 'nom' => 'Boutique Alpha', 'adresse' => 'Cotonou']);
        $produitA = $this->produitDans($bA, 'Produit A', stock: 10, prix: 1000);

        $pB = $this->proprio('pb@sgci.bj');
        $bB = $this->boutiqueDe($pB, 'Boutique B');
        $bB->update(['taux_tva' => 0, 'nom' => 'Boutique Beta', 'adresse' => 'Parakou']);
        $caissierB = $this->caissierDe($bB, 'caissier-b@sgci.bj');

        Sanctum::actingAs($caissierB);

        $r = $this->postJson('/api/ventes', [
            'ligne_ventes' => [['produit_id' => $this->produitDans($bB, 'Produit B', stock: 10, prix: 1000)->id, 'quantite' => 1]],
            'mode_paiement' => 'especes',
        ])->assertCreated();

        $this->assertSame(0.0, (float) $r->json('tva'),
            'La TVA doit venir de la boutique B (0%), pas du réglage global (18%).');

        $venteB = Vente::findOrFail($r->json('id'));
        $facture = $this->getJson("/api/ventes/{$venteB->id}/facture")
            ->assertOk()
            ->assertJsonPath('boutique.nom', 'Boutique Beta')
            ->assertJsonPath('boutique.adresse', 'Parakou');

        $this->assertNotSame('Boutique Alpha', $facture->json('boutique.nom'));

        // La boutique A garde bien sa propre TVA
        Sanctum::actingAs($pA->fresh());
        $rA = $this->postJson('/api/ventes', [
            'ligne_ventes' => [['produit_id' => $produitA->id, 'quantite' => 1]],
            'mode_paiement' => 'especes',
        ])->assertCreated();

        $this->assertSame(180.0, (float) $rA->json('tva'), 'La boutique A reste à 18%.');
    }

    public function test_utilisateur_sans_boutique_ne_peut_pas_encaisser(): void
    {
        $orphelin = User::create([
            'name' => 'Orphelin', 'email' => 'orphelin@sgci.bj',
            'password' => Hash::make('password'), 'role' => 'caissier', 'est_actif' => true,
        ]);

        Sanctum::actingAs($orphelin);

        $this->getJson('/api/ventes')->assertStatus(403);
        $this->postJson('/api/ventes', [
            'ligne_ventes' => [['produit_id' => 1, 'quantite' => 1]],
        ])->assertStatus(403);
    }
}
