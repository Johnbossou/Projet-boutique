<?php

namespace Tests\Feature;

use App\Http\Controllers\API\RetourVenteController;
use App\Models\Boutique;
use App\Models\Categorie;
use App\Models\LigneVente;
use App\Models\MouvementStock;
use App\Models\Produit;
use App\Models\RetourVente;
use App\Models\RetourVenteLigne;
use App\Models\User;
use App\Models\Vente;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Intégrité du stock lors de la validation et du refus d'un retour.
 *
 * Le quota n'est pas réservé à la création du retour : store() ne déduit que
 * les retours DÉJÀ validés, pour que plusieurs retours en attente puissent
 * chacun réclamer la totalité d'une même ligne. Ce fichier vérifie que la
 * validation est le point de contrôle qui protège réellement le stock, et que
 * le refus ne peut pas écraser une validation concurrente.
 */
class RetoursIntegriteStockTest extends TestCase
{
    use RefreshDatabase;

    private Boutique $boutique;

    private User $gerant;

    private Produit $produit;

    protected function setUp(): void
    {
        parent::setUp();

        $this->gerant = User::create([
            'name' => 'Gérant Intégrité',
            'email' => 'gerant-integrite-retours@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);

        $this->boutique = Boutique::create([
            'nom' => 'Boutique Intégrité Retours',
            'adresse' => 'Cotonou',
            'proprietaire_id' => $this->gerant->id,
        ]);

        $this->gerant->boutiques()->attach($this->boutique->id, ['role_dans_boutique' => 'gerant']);
        $this->gerant->update(['current_boutique_id' => $this->boutique->id]);
    }

    // -------------------------------------------------- cumul non revalidé

    public function test_deux_retours_en_attente_pour_la_meme_ligne_ne_peuvent_pas_etre_valides_tous_deux(): void
    {
        Sanctum::actingAs($this->gerant);

        $vente = $this->vente(2);
        $ligne = $vente->ligneVentes->first();

        // Le quota n'étant pas réservé, deux demandes de la totalité passent.
        $premier = $this->demanderRetour($vente, $ligne, 2);
        $second = $this->demanderRetour($vente, $ligne, 2);

        $premier->assertCreated();
        $second->assertCreated();

        // Stock initial 20, deux ventes de 2 => 18.
        $this->assertSame(18, $this->produit->fresh()->quantite_stock);

        $this->postJson("/api/retours/{$premier->json('data.id')}/valider")->assertOk();

        $this->assertSame(20, $this->produit->fresh()->quantite_stock);

        // Le second retour ne doit PAS réintégrer 2 unités de plus.
        $reponse = $this->postJson("/api/retours/{$second->json('data.id')}/valider");

        $reponse->assertStatus(422);
        $this->assertStringContainsString('reliquat', (string) $reponse->json('message'));

        $this->assertSame(20, $this->produit->fresh()->quantite_stock,
            'Le stock ne doit jamais dépasser la quantité vendue.');
        $this->assertSame('en_attente', RetourVente::find($second->json('data.id'))->statut);
    }

    public function test_un_retour_complementaire_apres_un_premier_valide_reste_validable(): void
    {
        Sanctum::actingAs($this->gerant);

        $vente = $this->vente(3);
        $ligne = $vente->ligneVentes->first();

        $premier = $this->demanderRetour($vente, $ligne, 2);
        $premier->assertCreated();
        $this->postJson("/api/retours/{$premier->json('data.id')}/valider")->assertOk();

        // 3 vendus, 2 déjà rendus : il reste 1, la revalidation ne doit pas
        // bloquer un retour qui tient dans le reliquat. Stock 17 → 19 → 20.
        $complementaire = $this->demanderRetour($vente, $ligne, 1);
        $complementaire->assertCreated();

        $this->postJson("/api/retours/{$complementaire->json('data.id')}/valider")->assertOk();

        $this->assertSame(20, $this->produit->fresh()->quantite_stock);
    }

    public function test_les_lignes_du_meme_retour_sont_cumulees_avant_comparaison(): void
    {
        Sanctum::actingAs($this->gerant);

        $vente = $this->vente(2);
        $ligne = $vente->ligneVentes->first();

        // store() refuse déjà un payload dont la somme dépasse le reliquat.
        // Ce contrôle est donc une défense en profondeur, à protéger contre des
        // lignes écrites hors API (import, script, reprise de données) : on
        // construit donc le retour directement.
        $retour = RetourVente::create([
            'vente_id' => $vente->id,
            'boutique_id' => $this->boutique->id,
            'user_id' => $this->gerant->id,
            'type' => 'partiel',
            'motif' => 'autre',
            'statut' => 'en_attente',
            'montant_rembourse' => 0,
        ]);

        foreach ([1, 2] as $quantite) {
            RetourVenteLigne::create([
                'retour_vente_id' => $retour->id,
                'ligne_vente_id' => $ligne->id,
                'produit_id' => $ligne->produit_id,
                'quantite_retournee' => $quantite,
                'prix_unitaire' => 5000,
                'montant_retourne' => $quantite * 5000,
            ]);
        }

        $this->postJson("/api/retours/{$retour->id}/valider")->assertStatus(422);

        $this->assertSame(18, $this->produit->fresh()->quantite_stock);
    }

    public function test_le_rollback_ne_laisse_aucun_mouvement_de_stock(): void
    {
        Sanctum::actingAs($this->gerant);

        $vente = $this->vente(2);
        $ligne = $vente->ligneVentes->first();

        $premier = $this->demanderRetour($vente, $ligne, 2);
        $second = $this->demanderRetour($vente, $ligne, 2);

        $this->postJson("/api/retours/{$premier->json('data.id')}/valider")->assertOk();
        $mouvementsAvant = MouvementStock::count();

        $this->postJson("/api/retours/{$second->json('data.id')}/valider")->assertStatus(422);

        $this->assertSame($mouvementsAvant, MouvementStock::count(),
            'Un retour refusé ne doit laisser aucune trace de mouvement de stock.');
    }

    // -------------------------------------------------- produit introuvable

    public function test_un_retour_ayant_un_produit_hors_boutique_est_refuse_entierement(): void
    {
        Sanctum::actingAs($this->gerant);

        $vente = $this->vente(2);
        $ligne = $vente->ligneVentes->first();

        $retour = $this->demanderRetour($vente, $ligne, 1);
        $retour->assertCreated();

        // Le produit « migre » vers un autre tenant après la création du retour.
        $autreBoutique = Boutique::create([
            'nom' => 'Boutique Voisine',
            'proprietaire_id' => $this->gerant->id,
        ]);

        $this->produit->update(['boutique_id' => $autreBoutique->id]);

        $reponse = $this->postJson("/api/retours/{$retour->json('data.id')}/valider");

        $reponse->assertStatus(422);
        $this->assertStringContainsString('hors boutique', (string) $reponse->json('message'));

        $this->assertSame(18, $this->produit->fresh()->quantite_stock);
        $this->assertSame('en_attente', RetourVente::find($retour->json('data.id'))->statut,
            'Le retour ne doit pas être marqué validé alors que rien n\'a été réintégré.');
    }

    public function test_un_produit_supprime_bloque_le_retour_plutot_que_de_leigner_le_stock(): void
    {
        Sanctum::actingAs($this->gerant);

        $vente = $this->vente(2);
        $ligne = $vente->ligneVentes->first();

        $retour = $this->demanderRetour($vente, $ligne, 1);
        $retour->assertCreated();

        $this->produit->delete();

        $this->postJson("/api/retours/{$retour->json('data.id')}/valider")->assertStatus(422);

        $this->assertSame('en_attente', RetourVente::find($retour->json('data.id'))->statut);
        $this->assertSame(0, MouvementStock::count());
    }

    // -------------------------------------------------- refus contre validation

    public function test_un_refus_ne_peut_pas_ecraser_une_validation_concurrente(): void
    {
        Sanctum::actingAs($this->gerant);

        $vente = $this->vente(2);
        $ligne = $vente->ligneVentes->first();

        $retour = $this->demanderRetour($vente, $ligne, 1);
        $retour->assertCreated();
        $id = $retour->json('data.id');

        // La validation passe d'abord…
        $this->postJson("/api/retours/{$id}/valider")->assertOk();
        $this->assertSame(19, $this->produit->fresh()->quantite_stock);

        // …puis un refus, concurrently, arrive après coup. Sans relecture sous
        // verrou, il écrasait « valide » par « refuse » : le stock resterait
        // réintégré alors que le retour serait annoncé comme refusé.
        $this->postJson("/api/retours/{$id}/refuser")->assertStatus(422);

        $this->assertSame('valide', RetourVente::find($id)->statut);
        $this->assertSame(19, $this->produit->fresh()->quantite_stock);
    }

    public function test_le_refus_sur_une_instance_perimee_renvoie_409_sans_ecraser_le_statut(): void
    {
        Sanctum::actingAs($this->gerant);

        $vente = $this->vente(2);
        $ligne = $vente->ligneVentes->first();

        $retour = $this->demanderRetour($vente, $ligne, 1);
        $retour->assertCreated();
        $id = $retour->json('data.id');

        $this->postJson("/api/retours/{$id}/valider")->assertOk();

        // La course réelle (binding de route, puis validation concurrente,
        // puis refus) n'est pas reproductible en un seul processus. On la
        // reproduit de façon déterministe en appelant refuser() avec
        // l'instance PÉRIMÉE qu'aurait le route model binding : elle dit
        // encore « en_attente » alors que la ligne est « valide ». C'est
        // exactement l'état dans lequel se trouve le refus concurrent réel.
        $perimee = (clone RetourVente::findOrFail($id))->forceFill(['statut' => 'en_attente']);

        $this->assertSame(
            'valide',
            RetourVente::findOrFail($id)->statut,
            'L\'instance de la course simulée diverge bien de la base.'
        );

        $reponse = app(RetourVenteController::class)->refuser(new Request, $perimee);

        $this->assertSame(409, $reponse->getStatusCode());
        $this->assertSame('valide', RetourVente::findOrFail($id)->statut,
            'Un refus concurrent ne doit jamais écraser une validation.');
        $this->assertSame(19, $this->produit->fresh()->quantite_stock,
            'Le stock reste cohérent avec le statut « valide ».');
    }

    public function test_un_refus_simple_ne_touche_pas_au_stock(): void
    {
        Sanctum::actingAs($this->gerant);

        $vente = $this->vente(2);
        $ligne = $vente->ligneVentes->first();

        $retour = $this->demanderRetour($vente, $ligne, 2);
        $retour->assertCreated();
        $id = $retour->json('data.id');

        $this->postJson("/api/retours/{$id}/refuser")->assertOk();

        $this->assertSame('refuse', RetourVente::find($id)->statut);
        $this->assertSame(18, $this->produit->fresh()->quantite_stock);
        $this->assertSame(0, MouvementStock::count());
    }

    public function test_un_retour_refuse_libere_le_reliquat_pour_un_retour_complementaire(): void
    {
        Sanctum::actingAs($this->gerant);

        $vente = $this->vente(2);
        $ligne = $vente->ligneVentes->first();

        $premier = $this->demanderRetour($vente, $ligne, 2);
        $premier->assertCreated();
        $this->postJson("/api/retours/{$premier->json('data.id')}/refuser")->assertOk();

        $second = $this->demanderRetour($vente, $ligne, 2);
        $second->assertCreated();

        $this->postJson("/api/retours/{$second->json('data.id')}/valider")->assertOk();

        $this->assertSame(20, $this->produit->fresh()->quantite_stock);
    }

    // -------------------------------------------------- règle de remboursement

    public function test_le_remboursement_suit_le_prix_unitaire_et_ignore_la_remise_globale(): void
    {
        Sanctum::actingAs($this->gerant);

        // 4 x 5 000 = 20 000. La remise est un MONTANT, pas un pourcentage
        // (VenteController::calculerMontantTotal fait somme - remise) :
        // 2 000 de remise, soit 10 %, laisse 18 000 réellement encaissés.
        $vente = $this->vente(4);
        $vente->update(['remise' => 2000, 'montant_total' => 18000]);
        $ligne = $vente->ligneVentes->first();

        $premier = $this->demanderRetour($vente, $ligne, 3);
        $premier->assertCreated();
        $this->postJson("/api/retours/{$premier->json('data.id')}/valider")->assertOk();

        // Règle arbitrée : prix unitaire x quantité. La remise n'est pas rendue.
        $this->assertSame(15000, (int) RetourVente::find($premier->json('data.id'))->montant_rembourse);
        $this->assertSame(
            15000,
            (int) RetourVenteLigne::where('retour_vente_id', $premier->json('data.id'))->value('montant_retourne')
        );

        $second = $this->demanderRetour($vente, $ligne, 1);
        $second->assertCreated();
        $this->postJson("/api/retours/{$second->json('data.id')}/valider")->assertOk();

        // Conséquence assumée, et NON un oubli : tous les articles rendus, on
        // rembourse 20 000 pour 18 000 encaissés. La remise reste due à la
        // boutique. Ce test verrouille ce choix pour qu'il soit explicite, et
        // signale si quelqu'un le change sans s'en rendre compte.
        $totalRembourse = (int) RetourVente::where('vente_id', $vente->id)
            ->where('statut', 'valide')
            ->sum('montant_rembourse');

        $encaisse = (int) $vente->fresh()->montant_total;
        $this->assertSame(18000, $encaisse);
        $this->assertSame(20000, $totalRembourse);
        $this->assertGreaterThan(
            $encaisse,
            $totalRembourse,
            'Conséquence assumée : 20 000 remboursés pour 18 000 encaissés.'
        );
    }

    // -------------------------------------------------- utilitaires

    // -------------------------------------------------- annulation de la vente

    public function test_une_vente_portant_un_retour_en_attente_ne_peut_pas_etre_annulee(): void
    {
        Sanctum::actingAs($this->gerant);

        $vente = $this->vente(5);
        $ligne = $vente->ligneVentes->first();

        $this->demanderRetour($vente, $ligne, 2)->assertCreated();

        $this->assertSame(15, $this->produit->fresh()->quantite_stock);

        $reponse = $this->postJson("/api/ventes/{$vente->id}/annuler");

        $reponse->assertStatus(409);
        $this->assertStringContainsString('retour', mb_strtolower((string) $reponse->json('message')));

        $this->assertSame('termine', $vente->fresh()->statut, 'La vente ne doit pas être annulée.');
        $this->assertSame(15, $this->produit->fresh()->quantite_stock, 'Aucun stock ne doit être restitué.');
    }

    public function test_annuler_une_vente_ne_restocke_pas_les_quantites_deja_rendues(): void
    {
        Sanctum::actingAs($this->gerant);

        $vente = $this->vente(10);
        $ligne = $vente->ligneVentes->first();

        // 4 unités rendues et validées : le stock est déjà remonté à 14.
        $this->demanderRetour($vente, $ligne, 4)->assertCreated();
        $this->postJson('/api/retours/'.RetourVente::latest('id')->value('id').'/valider')->assertOk();

        $this->assertSame(14, $this->produit->fresh()->quantite_stock);

        // L'annulation ne restitue que les 6 unités encore sorties du stock.
        $this->postJson("/api/ventes/{$vente->id}/annuler")->assertOk();

        $this->assertSame(20, $this->produit->fresh()->quantite_stock,
            'Restituer les 10 unités aurait crédité une seconde fois les 4 déjà rendues.');

        $mouvements = MouvementStock::where('raison', 'annulation_vente')
            ->where('produit_id', $this->produit->id)
            ->get();

        $this->assertCount(1, $mouvements);
        $this->assertSame(6, (int) $mouvements->first()->quantite,
            'Le mouvement compensateur doit porter le reliquat, pas la quantité vendue.');
    }

    public function test_une_vente_avec_un_retour_valide_reste_annulable(): void
    {
        Sanctum::actingAs($this->gerant);

        $vente = $this->vente(4);
        $ligne = $vente->ligneVentes->first();

        $this->demanderRetour($vente, $ligne, 2)->assertCreated();
        $this->postJson('/api/retours/'.RetourVente::latest('id')->value('id').'/valider')->assertOk();

        $this->postJson("/api/ventes/{$vente->id}/annuler")->assertOk();

        $this->assertSame('annule', $vente->fresh()->statut);
        $this->assertSame(20, $this->produit->fresh()->quantite_stock);
    }

    public function test_valider_un_retour_apres_annulation_de_la_vente_est_refuse(): void
    {
        Sanctum::actingAs($this->gerant);

        $vente = $this->vente(6);
        $ligne = $vente->ligneVentes->first();

        $retourId = $this->demanderRetour($vente, $ligne, 3)->json('data.id');

        // On force l'annulation sans passer par annuler(), qui refuse
        // justement ce cas : c'est l'état que des données antérieures ou
        // importées peuvent présenter.
        $vente->forceFill(['statut' => 'annule'])->save();
        $this->produit->update(['quantite_stock' => 20]);

        $reponse = $this->postJson("/api/retours/{$retourId}/valider");

        $reponse->assertStatus(409);
        $this->assertSame(20, $this->produit->fresh()->quantite_stock,
            'Le stock de la vente annulée a déjà été restitué : le valider créditerait une seconde fois.');
        $this->assertSame('en_attente', RetourVente::find($retourId)->statut);
        $this->assertSame(0, MouvementStock::where('raison', 'retour')->count());
    }

    // -------------------------------------------------- utilitaires

    private function vente(int $quantite): Vente
    {
        $categorie = Categorie::create([
            'nom' => 'Cat Intégrité '.uniqid(),
            'description' => 'D',
            'couleur' => '#000',
            'icone' => 'box',
        ]);

        $this->produit = Produit::create([
            'nom' => 'Produit Intégrité',
            'description' => 'Test',
            'prix' => 5000,
            'quantite_stock' => 20,
            'seuil_alerte' => 2,
            'categorie_id' => $categorie->id,
            'unite_mesure' => 'unite',
            'boutique_id' => $this->boutique->id,
        ]);

        $vente = Vente::create([
            'montant_total' => $quantite * 5000,
            'remise' => 0,
            'statut' => 'termine',
            'mode_paiement' => 'especes',
            'boutique_id' => $this->boutique->id,
            'user_id' => $this->gerant->id,
        ]);

        $ligne = $vente->ligneVentes()->create([
            'produit_id' => $this->produit->id,
            'quantite' => $quantite,
            'prix_unitaire' => 5000,
            'sous_total' => $quantite * 5000,
        ]);

        // La vente décrémente le stock : on repart de la valeur post-vente.
        $this->produit->update(['quantite_stock' => 20 - $quantite]);

        return $vente->fresh(['ligneVentes']);
    }

    private function demanderRetour(Vente $vente, LigneVente $ligne, int $quantite)
    {
        return $this->postJson('/api/retours', [
            'vente_id' => $vente->id,
            'type' => 'partiel',
            'motif' => 'defectueux',
            'lignes' => [
                ['ligne_vente_id' => $ligne->id, 'quantite_retournee' => $quantite],
            ],
        ]);
    }
}
