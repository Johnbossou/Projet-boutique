<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\BoutiqueSetting;
use App\Models\Categorie;
use App\Models\Client;
use App\Models\LigneVente;
use App\Models\Produit;
use App\Models\User;
use App\Models\Vente;
use App\Services\FacturePdfService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Le PDF de vente est généré par FacturePdfService, appelé directement par
 * /ventes/{id}/facture/pdf et /facture/html — sans passer par le contrôleur.
 *
 * Ce service lisait BoutiqueSetting::current(), un singleton firstOrCreate([])
 * sans boutique_id : il renvoyait toujours la première ligne créée. Toutes
 * les factures portaient donc l'en-tête de la même boutique, y compris quand
 * la vente appartenait à un autre tenant.
 */
class FacturePdfBoutiqueTest extends TestCase
{
    use RefreshDatabase;

    private Boutique $boutiqueA;

    private Boutique $boutiqueB;

    private User $proprietaire;

    private User $gerant;

    private Client $clientA;

    private Client $clientB;

    private Produit $produitA;

    protected function setUp(): void
    {
        parent::setUp();

        $this->proprietaire = User::create([
            'name' => 'Propriétaire PDF',
            'email' => 'proprietaire-pdf@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'proprietaire',
            'est_actif' => true,
        ]);

        $this->gerant = User::create([
            'name' => 'Gérant PDF',
            'email' => 'gerant-pdf@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);

        $this->boutiqueA = Boutique::create([
            'nom' => 'Boutique Alpha',
            'adresse' => 'Rue Alpha, Cotonou',
            'telephone' => '+229 21 30 00 01',
            'email' => 'contact@alpha.bj',
            'devise' => 'XOF',
            'taux_tva' => 18,
            'proprietaire_id' => $this->proprietaire->id,
        ]);

        $this->boutiqueB = Boutique::create([
            'nom' => 'Boutique Beta',
            'adresse' => 'Avenue Beta, Porto-Novo',
            'telephone' => '+229 21 30 00 02',
            'email' => 'contact@beta.bj',
            'devise' => 'XOF',
            'taux_tva' => 18,
            'proprietaire_id' => $this->proprietaire->id,
        ]);

        $this->gerant->boutiques()->attach($this->boutiqueA->id, [
            'role_dans_boutique' => 'gerant',
        ]);
        $this->gerant->forceFill(['current_boutique_id' => $this->boutiqueA->id])->save();

        $this->clientA = Client::create([
            'nom' => 'Client Alpha',
            'email' => 'client-alpha-pdf@sgci.bj',
            'telephone' => '22997000001',
            'boutique_id' => $this->boutiqueA->id,
        ]);

        $this->clientB = Client::create([
            'nom' => 'Client Beta',
            'email' => 'client-beta-pdf@sgci.bj',
            'telephone' => '22997000002',
            'boutique_id' => $this->boutiqueB->id,
        ]);

        $cat = Categorie::create(['nom' => 'Cat PDF', 'description' => 'P', 'couleur' => '#000', 'icone' => 'box']);

        $this->produitA = Produit::create([
            'nom' => 'Produit PDF',
            'description' => 'Test',
            'prix' => 5000,
            'quantite_stock' => 20,
            'seuil_alerte' => 5,
            'categorie_id' => $cat->id,
            'unite_mesure' => 'unite',
            'boutique_id' => $this->boutiqueA->id,
        ]);
    }

    private function creerVente(Boutique $boutique, Client $client): Vente
    {
        $vente = Vente::create([
            'montant_total' => 5000,
            'tva' => 762.71,
            'remise' => 0,
            'user_id' => $this->gerant->id,
            'client_id' => $client->id,
            'statut' => 'termine',
            'boutique_id' => $boutique->id,
        ]);

        LigneVente::create([
            'vente_id' => $vente->id,
            'produit_id' => $this->produitA->id,
            'quantite' => 1,
            'prix_unitaire' => 5000,
        ]);

        return $vente;
    }

    public function test_le_pdf_porte_la_boutique_de_la_vente(): void
    {
        $vente = $this->creerVente($this->boutiqueA, $this->clientA);

        $donnees = app(FacturePdfService::class)->buildViewData($vente);

        $this->assertSame('Boutique Alpha', $donnees['boutique']->nom);
        $this->assertSame('Rue Alpha, Cotonou', $donnees['boutique']->adresse);
    }

    public function test_le_pdf_ne_porte_pas_la_boutique_d_un_autre_tenant(): void
    {
        // La vente appartient à Beta, mais le gérant travaille chez Alpha :
        // c'est le cas qui fuyait, le singleton renvoyant la première
        // boutique créée.
        $vente = $this->creerVente($this->boutiqueB, $this->clientB);

        $donnees = app(FacturePdfService::class)->buildViewData($vente);

        $this->assertSame('Boutique Beta', $donnees['boutique']->nom);
        $this->assertSame('Avenue Beta, Porto-Novo', $donnees['boutique']->adresse);
        $this->assertSame('contact@beta.bj', $donnees['boutique']->email);

        // Aucune coordonnée de Alpha ne doit apparaître.
        $this->assertNotSame('Boutique Alpha', $donnees['boutique']->nom);
        $this->assertNotSame('Rue Alpha, Cotonou', $donnees['boutique']->adresse);
        $this->assertNotSame('contact@alpha.bj', $donnees['boutique']->email);
    }

    public function test_le_html_rend_l_en_tete_de_la_boutique_de_la_vente(): void
    {
        $vente = $this->creerVente($this->boutiqueB, $this->clientB);

        $html = app(FacturePdfService::class)->html($vente);

        $this->assertStringContainsString('Boutique Beta', $html);
        $this->assertStringNotContainsString('Boutique Alpha', $html);
    }

    public function test_le_singleton_boutique_setting_ne_fixe_plus_l_en_tete(): void
    {
        // Même en existant, le singleton ne doit plus décider de l'en-tête.
        BoutiqueSetting::create([
            'nom' => 'Réglages Globaux Anciens',
            'adresse' => 'Adresse Globale Poussière',
            'devise' => 'FCFA',
            'taux_tva' => 18.00,
        ]);

        $vente = $this->creerVente($this->boutiqueB, $this->clientB);

        $donnees = app(FacturePdfService::class)->buildViewData($vente);

        $this->assertSame('Boutique Beta', $donnees['boutique']->nom);
        $this->assertNotSame('Réglages Globaux Anciens', $donnees['boutique']->nom);
    }

    public function test_chaque_boutique_conserve_son_propre_taux_de_tva(): void
    {
        $this->boutiqueA->update(['taux_tva' => 18]);
        $this->boutiqueB->update(['taux_tva' => 10]);

        $venteA = $this->creerVente($this->boutiqueA, $this->clientA);
        $venteB = $this->creerVente($this->boutiqueB, $this->clientB);

        $donneesA = app(FacturePdfService::class)->buildViewData($venteA);
        $donneesB = app(FacturePdfService::class)->buildViewData($venteB);

        $this->assertSame(18.0, (float) $donneesA['boutique']->taux_tva);
        $this->assertSame(10.0, (float) $donneesB['boutique']->taux_tva);
    }
}
