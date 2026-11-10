<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\Categorie;
use App\Models\Client;
use App\Models\Produit;
use App\Models\ProgrammeFidelite;
use App\Models\RecompenseFidelite;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Recalage des seuils de récompenses à la bascule du prorata.
 *
 * Le piège : les seuils (`points_requis`) sont en points, mais la façon de
 * gagner des points change quand on passe de « X points par achat » au
 * prorata du panier. Sans recalage, une récompense qui demandait 10 achats
 * en demande 2 (ou 50) — les clients ne savent plus ce qu'ils obtiennent.
 *
 * Le recalage conserve la difficulté : le seuil est mis à l'échelle du
 * panier moyen réel du programme, mesuré sur les ventes qui ont effectivement
 * crédité des points.
 */
class FideliteRecalibrageTest extends TestCase
{
    use RefreshDatabase;

    private User $proprietaire;

    private Boutique $boutique;

    private Client $client;

    protected function setUp(): void
    {
        parent::setUp();

        $this->sansProvisionnerBoutique();

        $this->proprietaire = User::create([
            'name' => 'Propriétaire Fidélité',
            'email' => 'proprio-recal@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'proprietaire',
            'est_actif' => true,
        ]);

        $this->boutique = Boutique::create([
            'nom' => 'Boutique Recalibrage',
            'devise' => 'XOF',
            'taux_tva' => 18,
            'proprietaire_id' => $this->proprietaire->id,
        ]);
        $this->boutique->users()->attach($this->proprietaire->id, ['role_dans_boutique' => 'proprietaire']);
        $this->proprietaire->forceFill(['current_boutique_id' => $this->boutique->id])->save();

        $this->client = Client::create([
            'nom' => 'Client Recalibrage',
            'email' => 'client-recal@sgci.bj',
            'telephone' => '22997000009',
            'boutique_id' => $this->boutique->id,
        ]);
    }

    // -------------------------------------------------- helpers

    private function programme(int $pointsParAchat = 10, int $pointsPar100Fcfa = 0): ProgrammeFidelite
    {
        return ProgrammeFidelite::create([
            'boutique_id' => $this->boutique->id,
            'nom' => 'Programme Recalibrage',
            'points_par_achat' => $pointsParAchat,
            'points_par_100_fcfa' => $pointsPar100Fcfa,
            'valeur_point' => 5,
            'niveaux' => [
                ['nom' => 'Débutant', 'points_min' => 0, 'remise_pourcentage' => 0],
                ['nom' => 'Silver', 'points_min' => 100, 'remise_pourcentage' => 5],
            ],
            'actif' => true,
        ]);
    }

    private function recompense(ProgrammeFidelite $programme, int $pointsRequis = 100): RecompenseFidelite
    {
        return RecompenseFidelite::create([
            'programme_fidelite_id' => $programme->id,
            'nom' => 'Récompense Réduction',
            'points_requis' => $pointsRequis,
            'type' => 'remise',
            'valeur' => 500,
            'actif' => true,
        ]);
    }

    private function produit(float $prix = 5000): Produit
    {
        $cat = Categorie::first() ?? Categorie::create([
            'nom' => 'Cat Recal', 'description' => 'x', 'couleur' => '#000', 'icone' => 'box',
        ]);

        return Produit::create([
            'nom' => 'Article',
            'description' => 'x',
            'prix' => $prix,
            'quantite_stock' => 50,
            'seuil_alerte' => 2,
            'categorie_id' => $cat->id,
            'unite_mesure' => 'unite',
            'boutique_id' => $this->boutique->id,
        ]);
    }

    /**
     * Une vente terminée qui crédite des points : c'est elle qui donne le
     * panier moyen.
     */
    private function venteCreditee(float $montant): void
    {
        $produit = $this->produit($montant);

        $this->postJson('/api/ventes', [
            'ligne_ventes' => [['produit_id' => $produit->id, 'quantite' => 1]],
            'client_id' => $this->client->id,
        ])->assertCreated();
    }

    /**
     * @return array<string, mixed>
     */
    private function payloadProgramme(int $pointsPar100Fcfa): array
    {
        return [
            'nom' => 'Programme Recalibrage',
            'description' => 'Test',
            'points_par_achat' => 10,
            'points_par_100_fcfa' => $pointsPar100Fcfa,
            'valeur_point' => 5,
            'niveaux' => [
                ['nom' => 'Débutant', 'points_min' => 0, 'remise_pourcentage' => 0],
                ['nom' => 'Silver', 'points_min' => 100, 'remise_pourcentage' => 5],
            ],
        ];
    }

    // -------------------------------------------------- tests

    public function test_un_programme_en_mode_legacy_ne_se_recale_pas(): void
    {
        Sanctum::actingAs($this->proprietaire);

        $programme = $this->programme();

        $this->getJson("/api/fidelite/{$programme->id}/recalibrage")
            ->assertOk()
            ->assertJsonPath('data.mode', 'legacy')
            ->assertJsonPath('data.possible', false);
    }

    public function test_le_panier_moyen_repose_sur_les_ventes_reellement_creditees(): void
    {
        Sanctum::actingAs($this->proprietaire);

        $programme = $this->programme();

        $this->venteCreditee(5000);

        $this->getJson("/api/fidelite/{$programme->id}/recalibrage")
            ->assertOk()
            ->assertJsonPath('data.panier_moyen', 5000);
    }

    public function test_la_bascule_au_prorata_fige_la_reference_des_seuils(): void
    {
        Sanctum::actingAs($this->proprietaire);

        $programme = $this->programme();
        $recompense = $this->recompense($programme, 100);

        $this->venteCreditee(5000);

        $this->putJson("/api/fidelite/{$programme->id}", $this->payloadProgramme(1))
            ->assertOk()
            ->assertJsonPath('recalibrage.facteur', 5);

        $this->assertSame(100, $recompense->fresh()->points_requis_legacy,
            'Le seuil en points legacy doit être figé au moment de la bascule.');
    }

    public function test_le_recalage_conserve_la_difficulte_des_recompenses(): void
    {
        Sanctum::actingAs($this->proprietaire);

        $programme = $this->programme();
        $recompense = $this->recompense($programme, 100);

        $this->venteCreditee(5000);

        $this->putJson("/api/fidelite/{$programme->id}", $this->payloadProgramme(1))->assertOk();

        // En legacy : 10 points par achat, panier moyen 5 000 → 100 points
        // demandaient 10 achats, soit 50 000 FCFA.
        // En prorata (1 point / 100 FCFA) : 50 000 FCFA rapportent 500 points.
        // Le seuil doit donc passer à 500 pour exiger le même effort.
        $this->postJson("/api/fidelite/{$programme->id}/recalibrer")
            ->assertOk()
            ->assertJsonPath('data.recompenses.0.points_requis_recalibre', 500);

        $this->assertSame(500, $recompense->fresh()->points_requis);
    }

    public function test_le_recalage_est_idempotent(): void
    {
        Sanctum::actingAs($this->proprietaire);

        $programme = $this->programme();
        $recompense = $this->recompense($programme, 100);

        $this->venteCreditee(5000);

        $this->putJson("/api/fidelite/{$programme->id}", $this->payloadProgramme(1))->assertOk();

        $this->postJson("/api/fidelite/{$programme->id}/recalibrer")->assertOk();
        $this->postJson("/api/fidelite/{$programme->id}/recalibrer")->assertOk();

        $this->assertSame(500, $recompense->fresh()->points_requis,
            'Appliquer deux fois ne doit pas cumuler le facteur.');
    }

    public function test_sans_historique_le_recalage_est_refuse(): void
    {
        Sanctum::actingAs($this->proprietaire);

        $programme = $this->programme();
        $recompense = $this->recompense($programme, 100);

        $this->putJson("/api/fidelite/{$programme->id}", $this->payloadProgramme(1))->assertOk();

        $this->postJson("/api/fidelite/{$programme->id}/recalibrer")
            ->assertStatus(422);

        $this->assertSame(100, $recompense->fresh()->points_requis,
            'Sans panier moyen, le seuil doit rester tel quel.');
    }

    public function test_une_recompense_creee_en_prorata_n_est_pas_rescalee(): void
    {
        Sanctum::actingAs($this->proprietaire);

        $programme = $this->programme();

        $this->venteCreditee(5000);

        // Bascule avant toute récompense : les seuils saisis ensuite sont
        // déjà exprimés en points de prorata.
        $this->putJson("/api/fidelite/{$programme->id}", $this->payloadProgramme(1))->assertOk();

        $recompense = $this->recompense($programme, 50);

        $this->postJson("/api/fidelite/{$programme->id}/recalibrer")->assertOk();

        $this->assertSame(50, $recompense->fresh()->points_requis,
            'Une récompense créée en prorata ne doit pas être rescalée.');
    }

    public function test_le_programme_d_une_autre_boutique_est_refuse(): void
    {
        $autreProprio = User::create([
            'name' => 'Autre Proprio',
            'email' => 'autre-proprio-recal@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'proprietaire',
            'est_actif' => true,
        ]);

        $autreBoutique = Boutique::create([
            'nom' => 'Boutique Voisine',
            'devise' => 'XOF',
            'proprietaire_id' => $autreProprio->id,
        ]);

        $programme = ProgrammeFidelite::create([
            'boutique_id' => $autreBoutique->id,
            'nom' => 'Programme Voisin',
            'points_par_achat' => 10,
            'valeur_point' => 5,
            'niveaux' => [['nom' => 'Débutant', 'points_min' => 0, 'remise_pourcentage' => 0]],
            'actif' => true,
        ]);

        Sanctum::actingAs($this->proprietaire);

        $this->getJson("/api/fidelite/{$programme->id}/recalibrage")->assertStatus(403);
        $this->postJson("/api/fidelite/{$programme->id}/recalibrer")->assertStatus(403);
    }
}
