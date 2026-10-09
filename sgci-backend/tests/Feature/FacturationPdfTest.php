<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\Categorie;
use App\Models\Client;
use App\Models\Facture;
use App\Models\LigneVente;
use App\Models\Produit;
use App\Models\User;
use App\Models\Vente;
use App\Services\FacturationService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Le PDF est désormais rendu APRÈS le commit de la facture.
 *
 * L'invariant défendu ici : une vente encaissée doit TOUJOURS produire une
 * facture, même si DomPDF ou le stockage tombe en panne. L'inverse — une
 * facture sans PDF — est un incident rattrapable par la commande de
 * régénération. L'ancien code, qui rendait le PDF dans la transaction, faisait
 * l'inverse : un PDF raté supprimait la facture, et un commit raté laissait un
 * PDF orphelin sur le disque.
 */
class FacturationPdfTest extends TestCase
{
    use RefreshDatabase;

    private User $gerant;

    private Boutique $boutique;

    protected function setUp(): void
    {
        parent::setUp();

        $this->sansProvisionnerBoutique();

        // Disque en mémoire : le test porte sur la logique de décision, pas sur
        // DomPDF ni sur le système de fichiers.
        Storage::fake('public');

        $this->gerant = User::create([
            'name' => 'Gérant',
            'email' => 'gerant@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'gerant',
            'est_actif' => true,
        ]);

        $this->boutique = Boutique::create([
            'nom' => 'Agence',
            'proprietaire_id' => $this->gerant->id,
        ]);
        $this->boutique->users()->attach($this->gerant->id, ['role_dans_boutique' => 'gerant']);

        $client = Client::create([
            'nom' => 'Client',
            'email' => 'client@sgci.bj',
            'boutique_id' => $this->boutique->id,
        ]);

        $categorie = Categorie::create(['nom' => 'Catégorie']);
        $produit = Produit::create([
            'nom' => 'Ciment',
            'prix' => 3000,
            'quantite_stock' => 100,
            'seuil_alerte' => 10,
            'categorie_id' => $categorie->id,
            'unite_mesure' => 'unite',
            'boutique_id' => $this->boutique->id,
        ]);

        $vente = Vente::create([
            'montant_total' => 3000,
            'user_id' => $this->gerant->id,
            'client_id' => $client->id,
            'statut' => 'termine',
            'boutique_id' => $this->boutique->id,
        ]);

        LigneVente::create([
            'vente_id' => $vente->id,
            'produit_id' => $produit->id,
            'quantite' => 1,
            'prix_unitaire' => 3000,
        ]);

        $this->vente = $vente;

        $this->setUpPdf();
    }

    private Vente $vente;

    /** Bascule le rendu DomPDF entre succès et panne, sans recréer de mock. */
    private bool $pdfEnPanne = false;

    private int $rendusEffectues = 0;

    /**
     * Mock unique du rendu DomPDF.
     *
     * Pdf::shouldReceive() ne peut pas être rappelé deux fois dans un même
     * processus : Mockery générait une seconde classe au nom déjà déclaré et
     * levait un « Cannot redeclare ». D'où un seul mock, piloté par un
     * interrupteur, plutôt qu'un mock par état.
     *
     * loadView() a un type de retour déclaré (Barryvdh\DomPDF\PDF), donc le
     * substitut doit être un vrai PDF et pas une classe anonyme.
     */
    protected function setUpPdf(): void
    {
        $contenu = '%PDF-1.4 contenu de test';

        $pdf = \Mockery::mock(\Barryvdh\DomPDF\PDF::class);
        $pdf->shouldReceive('output')->andReturnUsing(fn () => $contenu);

        $this->pdfValide = $pdf;

        Pdf::shouldReceive('loadView')->andReturnUsing(function () {
            $this->rendusEffectues++;

            if ($this->pdfEnPanne) {
                throw new \RuntimeException('DomPDF: police introuvable');
            }

            return $this->pdfValide;
        });
    }

    /** @var \Barryvdh\DomPDF\PDF */
    private $pdfValide;

    private function faireEchouerLePdf(): void
    {
        $this->pdfEnPanne = true;
    }

    private function faireReussirLePdf(): void
    {
        $this->pdfEnPanne = false;
    }

    // -------------------------------------------------- nominal

    public function test_une_facture_nominale_est_commitée_avec_son_pdf(): void
    {
        $this->faireReussirLePdf();

        $facture = app(FacturationService::class)->genererFactureVente($this->vente);

        $this->assertTrue($facture->exists);
        $this->assertNotNull($facture->chemin_pdf);
        Storage::disk('public')->assertExists($facture->chemin_pdf);
    }

    // -------------------------------------------------- panne de rendu

    public function test_un_pdf_qui_echoue_ne_supprime_pas_la_facture(): void
    {
        // L'invariant central : de l'argent encaissé doit laisser une trace
        // comptable, quoi qu'il arrive au rendu.
        $this->faireEchouerLePdf();

        $facture = app(FacturationService::class)->genererFactureVente($this->vente);

        $this->assertTrue($facture->exists);
        $this->assertDatabaseHas('factures', [
            'id' => $facture->id,
            'vente_id' => $this->vente->id,
            'chemin_pdf' => null,
        ]);
    }

    public function test_un_pdf_qui_echoue_est_signale_pdf_manquant_et_non_autre_chose(): void
    {
        // Le log doit dire explicitement « PDF manquant » : c'est ce motif que
        // l'astreinte surveille pour relancer la commande de régénération.
        Log::spy();
        $this->faireEchouerLePdf();

        app(FacturationService::class)->genererFactureVente($this->vente);

        Log::shouldHaveReceived('error')
            ->withArgs(fn ($message, $contexte) => str_contains($message, 'PDF manquant')
                && ($contexte['vente_id'] ?? null) === $this->vente->id);
    }

    public function test_un_pdf_qui_echoue_ne_remonte_pas_d_exception(): void
    {
        $this->faireEchouerLePdf();

        // Pas de try/catch ici volontairement : si une exception remonte, le
        // test échoue et l'appelant (la caisse) verrait une vente en erreur
        // alors que la facture existe.
        $facture = app(FacturationService::class)->genererFactureVente($this->vente);

        $this->assertInstanceOf(Facture::class, $facture);
    }

    // -------------------------------------------------- auto-réparation

    public function test_un_second_appel_regenere_le_pdf_manquant_sans_dupliquer_la_facture(): void
    {
        $this->faireEchouerLePdf();
        $service = app(FacturationService::class);

        $premiere = $service->genererFactureVente($this->vente);
        $this->assertNull($premiere->chemin_pdf);

        // Le rendu redevient possible : la facture déjà enregistrée est renvoyée, et
        // le PDF manquant est rattrapé au passage.
        $this->faireReussirLePdf();

        $seconde = $service->genererFactureVente($this->vente);

        $this->assertSame($premiere->id, $seconde->id);
        $this->assertDatabaseCount('factures', 1);
        $this->assertNotNull($seconde->fresh()->chemin_pdf);
    }

    public function test_un_fichier_disparu_du_stockage_est_regenere(): void
    {
        // chemin_pdf renseigné mais fichier absent (purge du disque, déploiement
        // sur un nouveau bucket) : ce n'est pas un « PDF présent ».
        $this->faireReussirLePdf();
        $service = app(FacturationService::class);

        $facture = $service->genererFactureVente($this->vente);
        Storage::disk('public')->delete($facture->chemin_pdf);

        $this->faireReussirLePdf();
        $service->genererFactureVente($this->vente);

        Storage::disk('public')->assertExists($facture->chemin_pdf);
    }

    public function test_un_pdf_deja_present_n_est_pas_regenere_a_chaque_appel(): void
    {
        // Sans ce garde-fou, chaque réémission de facture au client
        // re-rendrait un PDF DomPDF, soit 100 à 500 ms par appel pour rien.
        // On compte les rendus réels plutôt que de remocker la façade.
        $this->faireReussirLePdf();

        $service = app(FacturationService::class);
        $service->genererFactureVente($this->vente);
        $service->genererFactureVente($this->vente);
        $service->genererFactureVente($this->vente);

        $this->assertSame(1, $this->rendusEffectues);
    }

    // -------------------------------------------------- commande de rattrapage

    public function test_la_commande_signale_et_repare_les_factures_sans_pdf(): void
    {
        $this->faireEchouerLePdf();
        app(FacturationService::class)->genererFactureVente($this->vente);

        $this->faireReussirLePdf();

        $this->artisan('sgci:regenerer-pdf-factures --dry-run')
            ->expectsOutputToContain('1 facture(s) à régénérer')
            ->assertSuccessful();

        // Le dry run ne doit rien écrire.
        $this->assertNull(Facture::first()->chemin_pdf);

        $this->artisan('sgci:regenerer-pdf-factures')
            ->expectsOutputToContain('PDF régénérés : 1')
            ->assertSuccessful();

        $this->assertNotNull(Facture::first()->chemin_pdf);
    }

    public function test_la_commande_ne_signale_rien_quand_tout_est_en_place(): void
    {
        $this->faireReussirLePdf();
        app(FacturationService::class)->genererFactureVente($this->vente);

        $this->artisan('sgci:regenerer-pdf-factures')
            ->expectsOutputToContain('Aucune facture sans PDF.')
            ->assertSuccessful();
    }

    public function test_la_commande_ne_touche_pas_aux_factures_d_une_autre_boutique(): void
    {
        // Le filtre --boutique ne doit pas laisser passer les factures sans chemin_pdf des
        // autres agences.
        $this->faireEchouerLePdf();
        app(FacturationService::class)->genererFactureVente($this->vente);

        $this->faireReussirLePdf();

        $this->artisan('sgci:regenerer-pdf-factures --boutique=999999')
            ->expectsOutputToContain('Aucune facture sans PDF.')
            ->assertSuccessful();

        $this->assertNull(Facture::first()->chemin_pdf);
    }
}
