<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\User;
use App\Models\Vente;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Statistiques des boutiques (chiffre d'affaires, activite, performance).
 *
 * L'interface de selection de boutique trie sur le chiffre d'affaires et
 * filtre sur la performance. Le backend n'envoyait aucun de ces champs :
 * le tri ne triait rien et le filtre ne laissait passer aucune boutique.
 */
class BoutiqueStatistiquesTest extends TestCase
{
    use RefreshDatabase;

    private User $gerant;

    private Boutique $boutiqueA;

    private Boutique $boutiqueB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->sansProvisionnerBoutique();

        $this->gerant = User::create([
            'name' => 'Gérant',
            'email' => 'gerant-stats@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);

        $this->boutiqueA = Boutique::create([
            'nom' => 'Boutique A',
            'devise' => 'XOF',
            'proprietaire_id' => $this->gerant->id,
        ]);

        $this->boutiqueB = Boutique::create([
            'nom' => 'Boutique B',
            'devise' => 'XOF',
            'proprietaire_id' => $this->gerant->id,
        ]);

        foreach ([$this->boutiqueA, $this->boutiqueB] as $boutique) {
            $this->gerant->boutiques()->attach($boutique->id, ['role_dans_boutique' => 'gerant']);
        }

        $this->gerant->update(['current_boutique_id' => $this->boutiqueA->id]);
    }

    public function test_le_chiffre_d_affaires_du_mois_est_renseigne(): void
    {
        $this->vente($this->boutiqueA, 10000);
        $this->vente($this->boutiqueA, 5000);
        $this->vente($this->boutiqueB, 2000);

        Sanctum::actingAs($this->gerant);

        $reponse = $this->getJson('/api/boutiques')->assertOk();

        $boutiques = collect($reponse->json())->keyBy('id');

        $this->assertSame(15000.0, (float) $boutiques[$this->boutiqueA->id]['chiffre_affaires_mois']);
        $this->assertSame(2000.0, (float) $boutiques[$this->boutiqueB->id]['chiffre_affaires_mois']);
    }

    public function test_une_vente_annulee_ne_compte_pas_dans_le_chiffre_d_affaires(): void
    {
        $this->vente($this->boutiqueA, 10000);
        $this->vente($this->boutiqueA, 7000, 'annule');

        Sanctum::actingAs($this->gerant);

        $reponse = $this->getJson('/api/boutiques')->assertOk();

        $boutiques = collect($reponse->json())->keyBy('id');

        $this->assertSame(10000.0, (float) $boutiques[$this->boutiqueA->id]['chiffre_affaires_mois'],
            'Une vente annulee n est pas du chiffre d affaires.');
    }

    public function test_les_ventes_du_mois_precedent_ne_comptent_pas(): void
    {
        $this->vente($this->boutiqueA, 90000, 'termine', now()->subMonths(2));

        Sanctum::actingAs($this->gerant);

        $reponse = $this->getJson('/api/boutiques')->assertOk();

        $boutiques = collect($reponse->json())->keyBy('id');

        $this->assertSame(0.0, (float) $boutiques[$this->boutiqueA->id]['chiffre_affaires_mois']);
    }

    public function test_la_performance_est_relative_a_la_moyenne_du_portefeuille(): void
    {
        // A : 30 000, B : 10 000 -> moyenne 20 000.
        // A vaut 1,5 fois la moyenne (excellente), B la moitié (moyenne).
        $this->vente($this->boutiqueA, 30000);
        $this->vente($this->boutiqueB, 10000);

        Sanctum::actingAs($this->gerant);

        $reponse = $this->getJson('/api/boutiques')->assertOk();

        $boutiques = collect($reponse->json())->keyBy('id');

        $this->assertSame('excellente', $boutiques[$this->boutiqueA->id]['performance']);
        $this->assertSame('moyenne', $boutiques[$this->boutiqueB->id]['performance']);
    }

    public function test_la_derniere_activite_est_renseignee(): void
    {
        $this->vente($this->boutiqueA, 10000, 'termine', now()->subDays(3));

        Sanctum::actingAs($this->gerant);

        $reponse = $this->getJson('/api/boutiques')->assertOk();

        $boutiques = collect($reponse->json())->keyBy('id');

        $this->assertNotNull($boutiques[$this->boutiqueA->id]['derniere_activite']);
        $this->assertNull($boutiques[$this->boutiqueB->id]['derniere_activite']);
    }

    public function test_un_membre_recoit_aussi_les_statistiques(): void
    {
        // Un gerant qui n'est pas proprietaire passe par /me : la page de
        // selection doit trouver les memes champs.
        $this->vente($this->boutiqueA, 12000);

        Sanctum::actingAs($this->gerant);

        $reponse = $this->getJson('/api/me')->assertOk();

        $boutiques = collect($reponse->json('user.boutiques'))->keyBy('id');

        $this->assertSame(12000.0, (float) $boutiques[$this->boutiqueA->id]['chiffre_affaires_mois']);
        $this->assertNotNull($boutiques[$this->boutiqueA->id]['performance']);
    }

    /**
     * @param  array<string, mixed>  $attributs
     */
    private function vente(
        Boutique $boutique,
        float $montant,
        string $statut = 'termine',
        ?Carbon $date = null
    ): Vente {
        $vente = Vente::create([
            'user_id' => $this->gerant->id,
            'boutique_id' => $boutique->id,
            'statut' => $statut,
            'montant_total' => $montant,
            'tva' => 0,
            'mode_paiement' => 'especes',
        ]);

        // Eloquent ignore `created_at` a la creation (il n est pas
        // fillable) : la date doit etre posee apres coup.
        if ($date) {
            $vente->forceFill(['created_at' => $date, 'updated_at' => $date])->save();
        }

        return $vente;
    }
}
