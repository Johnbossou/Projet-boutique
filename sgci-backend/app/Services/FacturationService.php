<?php

namespace App\Services;

use App\Mail\EnvoyerFacture;
use App\Models\CommandeClient;
use App\Models\Facture;
use App\Models\Vente;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class FacturationService
{
    /**
     * Génère automatiquement une facture pour une vente.
     *
     * Le PDF est produit APRÈS le commit, délibérément. Le garder dans la
     * transaction était un double défaut : DomPDF bloque le curseur de 100 à
     * 500 ms, donc le verrou sur la vente restait tenu pendant tout le rendu,
     * et si le commit échouait après coup le fichier était déjà écrit sur le
     * disque pour une facture qui n'existait pas.
     *
     * Ici la facture est d'abord garantie en base, le PDF ensuite. S'il
     * échoue, la facture reste valable sans PDF et l'incident est tracé pour
     * la commande de régénération.
     */
    public function genererFactureVente(Vente $vente): Facture
    {
        try {
            $facture = $this->verrouillerEtGenererFactureVente($vente);
        } catch (\Throwable $e) {
            // L'exception est relancée : la tracer ne doit jamais transformer un
            // échec en succès apparent. Elle porte l'ID de la vente d'origine,
            // pas celui de la ligne rechargée sous verrou.
            Log::error('Erreur lors de la génération de la facture de vente', [
                'vente_id' => $vente->id,
                'boutique_id' => $vente->boutique_id,
                'exception' => $e::class,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }

        $this->assurerPdf($facture, ['vente_id' => $vente->id]);

        return $facture;
    }

    private function verrouillerEtGenererFactureVente(Vente $vente): Facture
    {
        // Le verrou est pris sur la VENTE, pas sur la facture : verrouiller
        // la facture reviendrait à protéger une ligne qui n'existe pas encore.
        // Deux requêtes concurrentes sur la même vente sont donc sérialisées,
        // et la seconde voit la facture créée par la première.
        return DB::transaction(function () use ($vente) {
            $vente = Vente::whereKey($vente->id)->lockForUpdate()->firstOrFail();

            // Vérifier si une facture existe déjà
            $factureExistante = Facture::where('vente_id', $vente->id)->first();
            if ($factureExistante) {
                return $factureExistante;
            }

            // INVARIANT DE STOCKAGE (cf. VenteController::store/checkout) :
            // ventes.montant_total est la BASE HT après remise, ventes.tva est
            // la TVA effectivement calculée (base × taux boutique), et la
            // caisse encaisse la somme des deux (HT + TVA = TTC).
            //
            // Ancien calcul : montant_total / (1 + taux) — il traitait
            // montant_total comme du TTC : la facture annonçait un TTC égal au
            // HT stocké, un HT réduit de ~15 % et une TVA de ~15,25 % au lieu
            // de 18 %. On aligne la facture sur ce qui a réellement été
            // facturé et encaissé, avec la TVA enregistrée sur la vente (taux
            // modifié depuis, vente à 0 % : telle que facturée).
            $montantHt = (float) $vente->montant_total;
            $montantTva = (float) $vente->tva;
            $montantTtc = $montantHt + $montantTva;

            $facture = Facture::create([
                'numero_facture' => 'FAC-'.date('Ymd-His').'-'.$vente->id,
                'vente_id' => $vente->id,
                'client_id' => $vente->client_id,
                'boutique_id' => $vente->boutique_id,
                'date_facture' => now(),
                'montant_ht' => $montantHt,
                'montant_tva' => $montantTva,
                'montant_ttc' => $montantTtc,
                'statut' => 'paye',
                'envoyee' => false,
            ]);

            Log::info('Facture générée automatiquement pour la vente', [
                'vente_id' => $vente->id,
                'facture_id' => $facture->id,
            ]);

            return $facture;
        }, 3);
    }

    /**
     * Génère automatiquement une facture pour une commande client.
     *
     * Même séparation que pour la vente : commit d'abord, PDF ensuite.
     */
    public function genererFactureCommande(CommandeClient $commande): Facture
    {
        try {
            $facture = $this->verrouillerEtGenererFactureCommande($commande);
        } catch (\Throwable $e) {
            // Idem genererFactureVente : on trace puis on relance.
            Log::error('Erreur lors de la génération de la facture de commande', [
                'commande_id' => $commande->id,
                'boutique_id' => $commande->boutique_id,
                'exception' => $e::class,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }

        $this->assurerPdf($facture, ['commande_id' => $commande->id]);

        return $facture;
    }

    private function verrouillerEtGenererFactureCommande(CommandeClient $commande): Facture
    {
        // Verrou sur la COMMANDE, même raison que pour la vente : la facture
        // n'existe pas encore, la ligne à protéger est la commande source.
        return DB::transaction(function () use ($commande) {
            $commande = CommandeClient::whereKey($commande->id)->lockForUpdate()->firstOrFail();

            // Vérifier si une facture existe déjà
            $factureExistante = Facture::where('commande_client_id', $commande->id)->first();
            if ($factureExistante) {
                return $factureExistante;
            }

            // AUCUNE TVA sur les commandes clients : CommandeClientController
            // additionne les lignes sans aucun taux (pas de colonne tva, pas
            // de lecture de taux_tva), et le paiement (mobile money) compare
            // montant_paye à montant_total — le client paie le total tel quel.
            //
            // Ancien calcul : montant_total / (1 + 18 %) inventait une TVA
            // que personne n'avait versée et réduisait d'autant le HT. On
            // aligne la facture sur l'encaissement réel (HT = TTC, TVA 0)
            // plutôt que de facturer une somme que le client n'a pas payée.
            $montantHt = (float) $commande->montant_total;

            $facture = Facture::create([
                'numero_facture' => 'FAC-'.date('Ymd-His').'-'.$commande->id,
                'commande_client_id' => $commande->id,
                'client_id' => $commande->client_id,
                'boutique_id' => $commande->boutique_id,
                'date_facture' => now(),
                'montant_ht' => $montantHt,
                'montant_tva' => 0,
                'montant_ttc' => $montantHt,
                'statut' => $commande->estPayee() ? 'paye' : 'en_attente',
                'envoyee' => false,
            ]);

            Log::info('Facture générée automatiquement pour la commande', [
                'commande_id' => $commande->id,
                'facture_id' => $facture->id,
            ]);

            return $facture;
        }, 3);
    }

    /**
     * Produit le PDF s'il manque, sans jamais faire échouer la facturation.
     *
     * Une facture sans PDF est un incident réparable ; une vente sans facture
     * est de l'argent encaissé sans trace comptable. L'échec de rendu est donc
     * journalisé comme « PDF manquant » puis avalé ici : c'est la commande
     * sgci:regenerer-pdf-factures qui rattrape le fichier.
     *
     * L'opération est idempotente, donc l'appeler à chaque génération fait
     * aussi office de réparation quand une factureExistante est retournée.
     */
    private function assurerPdf(Facture $facture, array $origine): void
    {
        if ($this->pdfDejaPresente($facture)) {
            return;
        }

        try {
            $this->genererPdfFacture($facture);
        } catch (\Throwable $e) {
            Log::error('PDF manquant : la facture existe mais n\'a pas pu être rendue', [
                'facture_id' => $facture->id,
                'numero_facture' => $facture->numero_facture,
                'boutique_id' => $facture->boutique_id,
                ...$origine,
                'exception' => $e::class,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Le PDF est considéré présent si chemin_pdf est renseigné ET que le
     * fichier est réellement sur le disque : un chemin enregistré dont le
     * fichier a disparu (purge du stockage, déploiement) doit être repris.
     */
    private function pdfDejaPresente(Facture $facture): bool
    {
        $chemin = $facture->chemin_pdf;

        return filled($chemin) && Storage::disk('public')->exists($chemin);
    }

    /**
     * Régénère le PDF d'une facture existante.
     *
     * Utilisé par sgci:regenerer-pdf-factures. Ne masque pas l'erreur : la
     * commande doit pouvoir dire combien de factures restent sans PDF.
     */
    public function regenererPdf(Facture $facture): bool
    {
        $this->genererPdfFacture($facture);

        return $this->pdfDejaPresente($facture->fresh());
    }

    /**
     * Génère le PDF d'une facture
     */
    private function genererPdfFacture(Facture $facture): void
    {
        // Pas de try/catch ici, volontairement. Les appelants sont
        // `assurerPdf()` et `regenererPdf()`, qui journalisent déjà avec le
        // contexte complet (facture + vente ou commande d'origine). Un catch
        // intermédiaire ne relançait qu'après avoir écrit une seconde ligne de
        // log quasi identique : deux entrées par panne, une seule actionnable.
        if ($facture->commandeClient) {
            $data = [
                'facture' => $facture,
                'boutique' => $facture->boutique,
                'client' => $facture->client,
                'commande' => $facture->commandeClient->load(['lignes.produit']),
            ];
            $vue = 'invoices.commande';
        } else {
            $data = [
                'facture' => $facture,
                'boutique' => $facture->boutique,
                'client' => $facture->client,
                'vente' => $facture->vente->load(['ligneVentes.produit']),
            ];
            $vue = 'invoices.vente';
        }

        $pdf = Pdf::loadView($vue, $data);

        // Sauvegarder le PDF
        $filename = 'factures/'.$facture->numero_facture.'.pdf';
        Storage::disk('public')->put($filename, $pdf->output());

        // Mettre à jour le chemin du fichier
        $facture->update([
            'chemin_pdf' => $filename,
        ]);

        Log::info('PDF généré pour la facture', [
            'facture_id' => $facture->id,
            'filename' => $filename,
        ]);
    }

    /**
     * Envoie une facture par email
     */
    public function envoyerFactureEmail(Facture $facture): bool
    {
        try {
            if (! $facture->client->email) {
                Log::warning('Client sans email, impossible d\'envoyer la facture', [
                    'facture_id' => $facture->id,
                    'client_id' => $facture->client_id,
                ]);

                return false;
            }

            // Envoyer l'email avec la facture en pièce jointe
            \Mail::to($facture->client->email)->send(new EnvoyerFacture($facture));

            // Marquer comme envoyée
            $facture->update(['envoyee' => true]);

            Log::info('Facture envoyée par email', [
                'facture_id' => $facture->id,
                'client_email' => $facture->client->email,
            ]);

            return true;
        } catch (\Exception $e) {
            Log::error('Erreur lors de l\'envoi de la facture par email', [
                'facture_id' => $facture->id,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Génère et envoie automatiquement les factures du jour
     *
     * $boutiqueId est OBLIGATOIRE : sans lui la requêteBalayait toutes les
     * agences du tenant, créait des PDF et partait des emails chez des
     * clients d'autres boutiques. Le propriétaire déclenche depuis une
     * boutique courante, donc c'est ce périmètre qui doit être facturé.
     */
    public function genererEtEnvoyerFacturesDuJour(int $boutiqueId): array
    {
        $resultats = [
            'factures_generees' => 0,
            'factures_envoyees' => 0,
            'erreurs' => [],
        ];

        try {
            // Générer les factures pour les ventes du jour de CETTE boutique
            $ventesDuJour = Vente::where('boutique_id', $boutiqueId)
                ->whereDate('created_at', today())
                ->where('statut', 'termine')
                ->whereDoesntHave('facture')
                ->get();

            foreach ($ventesDuJour as $vente) {
                try {
                    $facture = $this->genererFactureVente($vente);
                    $resultats['factures_generees']++;

                    // Envoyer par email si configuré
                    if (config('facturation.envoi_auto', false)) {
                        if ($this->envoyerFactureEmail($facture)) {
                            $resultats['factures_envoyees']++;
                        }
                    }
                } catch (\Exception $e) {
                    $resultats['erreurs'][] = [
                        'type' => 'vente',
                        'id' => $vente->id,
                        'erreur' => $e->getMessage(),
                    ];
                }
            }

            // Générer les factures pour les commandes livrées du jour de CETTE boutique
            $commandesLivrees = CommandeClient::where('boutique_id', $boutiqueId)
                ->whereDate('date_livraison_reelle', today())
                ->where('statut', 'livre')
                ->whereDoesntHave('facture')
                ->get();

            foreach ($commandesLivrees as $commande) {
                try {
                    $facture = $this->genererFactureCommande($commande);
                    $resultats['factures_generees']++;

                    // Envoyer par email si configuré
                    if (config('facturation.envoi_auto', false)) {
                        if ($this->envoyerFactureEmail($facture)) {
                            $resultats['factures_envoyees']++;
                        }
                    }
                } catch (\Exception $e) {
                    $resultats['erreurs'][] = [
                        'type' => 'commande',
                        'id' => $commande->id,
                        'erreur' => $e->getMessage(),
                    ];
                }
            }

            Log::info('Génération automatique des factures du jour terminée', $resultats);

            return $resultats;
        } catch (\Exception $e) {
            Log::error('Erreur lors de la génération automatique des factures', [
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }
}
