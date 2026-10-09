<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\BoutiqueSetting;
use App\Models\Categorie;
use App\Models\Produit;
use App\Models\User;
use App\Models\Vente;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Les paramètres de boutique (devise, taux_tva, delai_annulation) vivent dans
 * la table boutiques, en NOT NULL avec valeurs par défaut. La table
 * boutique_settings n'en est qu'un vestige legacy, accessible par
 * BoutiqueSetting::current(), un firstOrCreate([]) sans boutique_id qui
 * renvoie toujours la première ligne créée.
 *
 * Ce test verrouille le fait que les calculs métier n'y touchent plus, et
 * qu'un calcul de TVA n'insère aucune ligne en base.
 */
class ParametresBoutiqueTest extends TestCase
{
    use RefreshDatabase;

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

    private function boutiqueDe(User $p, string $nom, int $delai = 5): Boutique
    {
        $b = Boutique::create([
            'nom' => $nom, 'devise' => 'XOF', 'taux_tva' => 18,
            'delai_annulation_vente_minutes' => $delai,
            'proprietaire_id' => $p->id,
        ]);
        $b->users()->attach($p->id, ['role_dans_boutique' => 'proprietaire']);

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

    private function produitDans(Boutique $b, string $nom, float $prix): Produit
    {
        $cat = Categorie::first() ?? Categorie::create([
            'nom' => 'Cat '.$b->id, 'description' => 'x', 'couleur' => '#000', 'icone' => 'box',
        ]);

        return Produit::create([
            'nom' => $nom, 'description' => 'x', 'prix' => $prix,
            'quantite_stock' => 50, 'seuil_alerte' => 2,
            'categorie_id' => $cat->id, 'unite_mesure' => 'unite',
            'boutique_id' => $b->id,
        ]);
    }

    // ------------------------------------------------ résolution de boutique

    public function test_pour_modele_retourne_la_boutique_du_modele(): void
    {
        $p = $this->proprio('p@sgci.bj');
        $b = $this->boutiqueDe($p, 'Boutique A');

        $vente = Vente::create([
            'montant_total' => 1000, 'user_id' => $p->id,
            'statut' => 'termine', 'boutique_id' => $b->id,
        ]);

        $resolu = BoutiqueSetting::pourModele($vente->fresh());

        $this->assertInstanceOf(Boutique::class, $resolu);
        $this->assertSame($b->id, $resolu->id);
        $this->assertSame('Boutique A', $resolu->nom);
    }

    public function test_pour_modele_ne_cree_aucune_ligne_legacy(): void
    {
        $p = $this->proprio('p@sgci.bj');
        $b = $this->boutiqueDe($p, 'Boutique A');

        $vente = Vente::create([
            'montant_total' => 1000, 'user_id' => $p->id,
            'statut' => 'termine', 'boutique_id' => $b->id,
        ]);

        BoutiqueSetting::pourModele($vente->fresh());

        $this->assertSame(0, BoutiqueSetting::count(),
            'Résoudre la boutique d’un modèle ne doit pas écrire dans boutique_settings.');
    }

    public function test_pour_modele_replie_sur_la_ligne_legacy_si_la_vente_n_a_pas_de_boutique(): void
    {
        // ventes.boutique_id est nullable : ces ventes historiques n'ont pas
        // de propriétaire, donc aucune fuite entre agences n'est possible et le
        // repli sur la ligne legacy reste acceptable.
        $p = $this->proprio('p@sgci.bj');

        $vente = Vente::create([
            'montant_total' => 1000, 'user_id' => $p->id,
            'statut' => 'termine', 'boutique_id' => null,
        ]);

        $resolu = BoutiqueSetting::pourModele($vente->fresh());

        $this->assertInstanceOf(BoutiqueSetting::class, $resolu);
    }

    // ------------------------------------------------ calcul de TVA

    public function test_un_calcul_de_tva_n_ecrit_pas_dans_la_table_legacy(): void
    {
        $p = $this->proprio('p@sgci.bj');
        $b = $this->boutiqueDe($p, 'Boutique A');
        $b->update(['taux_tva' => 10]);
        $produit = $this->produitDans($b, 'Produit A', prix: 1000);

        Sanctum::actingAs($this->caissierDe($b, 'caissier@sgci.bj'));

        $this->postJson('/api/ventes/checkout', [
            'ligne_ventes' => [['produit_id' => $produit->id, 'quantite' => 2]],
        ])->assertCreated();

        $this->assertSame(0, BoutiqueSetting::count(),
            'Calculer la TVA ne doit pas créer de ligne dans boutique_settings.');
    }

    public function test_la_tva_appliquee_est_celle_de_la_boutique_de_la_vente(): void
    {
        $p = $this->proprio('p@sgci.bj');
        $b = $this->boutiqueDe($p, 'Boutique Taux 10');
        $b->update(['taux_tva' => 10]);
        $produit = $this->produitDans($b, 'Produit A', prix: 1000);

        Sanctum::actingAs($this->caissierDe($b, 'caissier@sgci.bj'));

        $this->postJson('/api/ventes/checkout', [
            'ligne_ventes' => [['produit_id' => $produit->id, 'quantite' => 2]],
        ])->assertCreated();

        // 2 x 1000 = 2000 HT, TVA 10 % = 200. À 18 % on aurait eu 360.
        $this->assertSame(200.00, (float) Vente::latest('id')->first()->tva);
    }

    public function test_chaque_agence_conserve_son_propre_taux_de_tva_a_la_vente(): void
    {
        $p = $this->proprio('p@sgci.bj');
        $bA = $this->boutiqueDe($p, 'Agence A');
        $bB = $this->boutiqueDe($p, 'Agence B');
        $bA->update(['taux_tva' => 18]);
        $bB->update(['taux_tva' => 10]);

        $produitA = $this->produitDans($bA, 'Produit A', prix: 1000);
        $produitB = $this->produitDans($bB, 'Produit B', prix: 1000);

        $caissierA = $this->caissierDe($bA, 'caissier-a@sgci.bj');
        Sanctum::actingAs($caissierA);
        $this->postJson('/api/ventes/checkout', [
            'ligne_ventes' => [['produit_id' => $produitA->id, 'quantite' => 1]],
        ])->assertCreated();

        $caissierB = $this->caissierDe($bB, 'caissier-b@sgci.bj');
        Sanctum::actingAs($caissierB);
        $this->postJson('/api/ventes/checkout', [
            'ligne_ventes' => [['produit_id' => $produitB->id, 'quantite' => 1]],
        ])->assertCreated();

        $ventes = Vente::orderBy('id')->get();
        $this->assertCount(2, $ventes);
        $this->assertSame(180.00, (float) $ventes[0]->tva, 'Agence A à 18 %.');
        $this->assertSame(100.00, (float) $ventes[1]->tva, 'Agence B à 10 %.');
    }
}
