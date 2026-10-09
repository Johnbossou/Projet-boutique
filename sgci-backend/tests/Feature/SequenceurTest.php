<?php

namespace Tests\Feature;

use App\Models\Boutique;
use App\Models\Client;
use App\Models\CommandeClient;
use App\Models\CommandeFournisseur;
use App\Models\Fournisseur;
use App\Models\Paiement;
use App\Models\User;
use App\Services\Sequenceur;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SequenceurTest extends TestCase
{
    use RefreshDatabase;

    private Boutique $boutique;

    private User $user;

    private Client $client;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'name' => 'Caissier Séquence',
            'email' => 'caissier-sequenceur@sgci.bj',
            'password' => Hash::make('password'),
            'role' => 'caissier',
            'est_actif' => true,
        ]);

        $this->boutique = Boutique::create([
            'nom' => 'Boutique Séquence',
            'adresse' => 'Porto-Novo',
            'proprietaire_id' => $this->user->id,
        ]);

        $this->user->boutiques()->attach($this->boutique->id, ['role_dans_boutique' => 'caissier']);
        $this->user->update(['current_boutique_id' => $this->boutique->id]);

        $this->client = Client::create([
            'nom' => 'Client Séquence',
            'email' => 'client-sequenceur@sgci.bj',
            'telephone' => '22996000000',
            'boutique_id' => $this->boutique->id,
        ]);
    }

    private function creerCommande(): CommandeClient
    {
        return CommandeClient::create([
            'client_id' => $this->client->id,
            'boutique_id' => $this->boutique->id,
            'date_commande' => now(),
            'statut' => 'en_attente',
            'montant_total' => 10000,
            'montant_paye' => 0,
            'user_id' => $this->user->id,
        ]);
    }

    private function creerPaiement(): Paiement
    {
        return Paiement::create([
            'boutique_id' => $this->boutique->id,
            'montant' => 5000,
            'mode_paiement' => 'especes',
            'date_paiement' => now(),
            'statut' => 'en_attente',
            'user_id' => $this->user->id,
        ]);
    }

    public function test_les_commandes_creees_dans_la_meme_seconde_ne_collident_pas(): void
    {
        // Le bug d'origine : 'CMD-'.date('Ymd-His') resolvait à la seconde,
        // donc ces trois commandes partageaient le même numéro.
        $numeros = [
            $this->creerCommande()->numero_commande,
            $this->creerCommande()->numero_commande,
            $this->creerCommande()->numero_commande,
        ];

        $this->assertCount(3, array_unique($numeros));

        foreach ($numeros as $numero) {
            $this->assertMatchesRegularExpression(
                '/^CMD-\d{8}-\d{4}$/',
                $numero
            );
        }
    }

    public function test_le_suffixe_du_compteur_est_incremente(): void
    {
        $this->assertSame('CMD-'.now()->format('Ymd').'-0001', $this->creerCommande()->numero_commande);
        $this->assertSame('CMD-'.now()->format('Ymd').'-0002', $this->creerCommande()->numero_commande);
        $this->assertSame('CMD-'.now()->format('Ymd').'-0003', $this->creerCommande()->numero_commande);
    }

    public function test_le_compteur_est_global_et_non_scope_par_boutique(): void
    {
        $autre = Boutique::create([
            'nom' => 'Boutique Séquence 2',
            'adresse' => 'Abomey',
            'proprietaire_id' => $this->user->id,
        ]);

        $premier = $this->creerCommande()->numero_commande;

        $second = CommandeClient::create([
            'client_id' => $this->client->id,
            'boutique_id' => $autre->id,
            'date_commande' => now(),
            'statut' => 'en_attente',
            'montant_total' => 10000,
            'montant_paye' => 0,
            'user_id' => $this->user->id,
        ])->numero_commande;

        $this->assertNotSame($premier, $second);
        $this->assertSame('CMD-'.now()->format('Ymd').'-0001', $premier);
        $this->assertSame('CMD-'.now()->format('Ymd').'-0002', $second);
    }

    public function test_les_paiements_ne_collident_pus_entre_agences(): void
    {
        $autre = Boutique::create([
            'nom' => 'Boutique Paiement 2',
            'adresse' => 'Parakou',
            'proprietaire_id' => $this->user->id,
        ]);

        $a = $this->creerPaiement();
        $b = Paiement::create([
            'boutique_id' => $autre->id,
            'montant' => 7000,
            'mode_paiement' => 'especes',
            'date_paiement' => now(),
            'statut' => 'en_attente',
            'user_id' => $this->user->id,
        ]);

        $this->assertNotSame($a->numero_paiement, $b->numero_paiement);
        $this->assertSame('PAY-'.now()->format('Ymd').'-0001', $a->numero_paiement);
        $this->assertSame('PAY-'.now()->format('Ymd').'-0002', $b->numero_paiement);
    }

    public function test_les_commandes_fournisseur_utilisent_leur_propre_prefixe(): void
    {
        $fournisseur = Fournisseur::create([
            'nom' => 'Fournisseur Séquence',
            'boutique_id' => $this->boutique->id,
        ]);

        $commande = CommandeFournisseur::create([
            'fournisseur_id' => $fournisseur->id,
            'boutique_id' => $this->boutique->id,
            'date_commande' => now(),
            'statut' => 'en_attente',
            'montant_total' => 20000,
            'user_id' => $this->user->id,
        ]);

        $this->assertMatchesRegularExpression('/^CF-\d{8}-\d{4}$/', $commande->numero_commande);
        $this->assertSame('CF-'.now()->format('Ymd').'-0001', $commande->numero_commande);
    }

    public function test_chaque_prefixe_a_son_propre_compteur(): void
    {
        $a = Sequenceur::prochain('CMD');
        $b = Sequenceur::prochain('PAY');
        $c = Sequenceur::prochain('CF');

        $this->assertSame('CMD-'.now()->format('Ymd').'-0001', $a);
        $this->assertSame('PAY-'.now()->format('Ymd').'-0001', $b);
        $this->assertSame('CF-'.now()->format('Ymd').'-0001', $c);
    }

    public function test_un_rollback_remet_le_compteur_a_zero_et_le_numero_est_reutilisable(): void
    {
        try {
            DB::transaction(function () {
                Sequenceur::prochain('CMD');
                throw new \RuntimeException('échec métier');
            });
        } catch (\RuntimeException) {
            // attendu
        }

        $this->assertDatabaseMissing('compteurs', ['prefixe' => 'CMD-'.now()->format('Ymd')]);

        $this->assertSame('CMD-'.now()->format('Ymd').'-0001', $this->creerCommande()->numero_commande);
    }

    public function test_un_numero_explicite_ecrase_le_compteur(): void
    {
        $commande = CommandeClient::create([
            'numero_commande' => 'CMD-IMPORT-0001',
            'client_id' => $this->client->id,
            'boutique_id' => $this->boutique->id,
            'date_commande' => now(),
            'statut' => 'en_attente',
            'montant_total' => 10000,
            'montant_paye' => 0,
            'user_id' => $this->user->id,
        ]);

        $this->assertSame('CMD-IMPORT-0001', $commande->numero_commande);

        // Le compteur n'a pas été consommé par la commande importée.
        $this->assertSame('CMD-'.now()->format('Ymd').'-0001', $this->creerCommande()->numero_commande);
    }
}
