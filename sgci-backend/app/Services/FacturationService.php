<?php

namespace App\Services;

use App\Models\Vente;
use App\Models\CommandeClient;
use App\Models\Facture;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Barryvdh\DomPDF\Facade\Pdf;

class FacturationService
{
    /**
     * Génère automatiquement une facture pour une vente
     */
    public function genererFactureVente(Vente $vente): Facture
    {
        try {
            // Vérifier si une facture existe déjà
            $factureExistante = Facture::where('vente_id', $vente->id)->first();
            if ($factureExistante) {
                return $factureExistante;
            }

            // TVA basée sur le taux configuré dans la boutique (défaut 18%)
            $tauxTva = (float) ($vente->boutique?->taux_tva ?? 18);
            $diviseurTva = 1 + ($tauxTva / 100);
            $montantHt = $vente->montant_total / $diviseurTva;

            $facture = Facture::create([
                'numero_facture' => 'FAC-' . date('Ymd-His') . '-' . $vente->id,
                'vente_id' => $vente->id,
                'client_id' => $vente->client_id,
                'boutique_id' => $vente->boutique_id,
                'date_facture' => now(),
                'montant_ht' => $montantHt,
                'montant_tva' => $vente->montant_total - $montantHt,
                'montant_ttc' => $vente->montant_total,
                'statut' => 'paye',
                'envoyee' => false,
            ]);

            // Générer le PDF
            $this->genererPdfFacture($facture);

            Log::info('Facture générée automatiquement pour la vente', [
                'vente_id' => $vente->id,
                'facture_id' => $facture->id,
            ]);

            return $facture;
        } catch (\Exception $e) {
            Log::error('Erreur lors de la génération de la facture', [
                'vente_id' => $vente->id,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Génère automatiquement une facture pour une commande client
     */
    public function genererFactureCommande(CommandeClient $commande): Facture
    {
        try {
            // Vérifier si une facture existe déjà
            $factureExistante = Facture::where('commande_client_id', $commande->id)->first();
            if ($factureExistante) {
                return $factureExistante;
            }

            // TVA basée sur le taux configuré dans la boutique (défaut 18%)
            $tauxTva = (float) ($commande->boutique?->taux_tva ?? 18);
            $diviseurTva = 1 + ($tauxTva / 100);
            $montantHt = $commande->montant_total / $diviseurTva;

            $facture = Facture::create([
                'numero_facture' => 'FAC-' . date('Ymd-His') . '-' . $commande->id,
                'commande_client_id' => $commande->id,
                'client_id' => $commande->client_id,
                'boutique_id' => $commande->boutique_id,
                'date_facture' => now(),
                'montant_ht' => $montantHt,
                'montant_tva' => $commande->montant_total - $montantHt,
                'montant_ttc' => $commande->montant_total,
                'statut' => $commande->estPayee() ? 'paye' : 'en_attente',
                'envoyee' => false,
            ]);

            // Générer le PDF
            $this->genererPdfFacture($facture);

            Log::info('Facture générée automatiquement pour la commande', [
                'commande_id' => $commande->id,
                'facture_id' => $facture->id,
            ]);

            return $facture;
        } catch (\Exception $e) {
            Log::error('Erreur lors de la génération de la facture', [
                'commande_id' => $commande->id,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Génère le PDF d'une facture
     */
    private function genererPdfFacture(Facture $facture): void
    {
        try {
            $data = [
                'facture' => $facture,
                'boutique' => $facture->boutique,
                'client' => $facture->client,
                'lignes' => $facture->vente ? $facture->vente->ligneVentes : $facture->commandeClient->lignes,
            ];

            $pdf = Pdf::loadView('invoices.vente', $data);

            // Sauvegarder le PDF
            $filename = 'factures/' . $facture->numero_facture . '.pdf';
            Storage::disk('public')->put($filename, $pdf->output());

            // Mettre à jour le chemin du fichier
            $facture->update([
                'chemin_pdf' => $filename,
            ]);

            Log::info('PDF généré pour la facture', [
                'facture_id' => $facture->id,
                'filename' => $filename,
            ]);
        } catch (\Exception $e) {
            Log::error('Erreur lors de la génération du PDF', [
                'facture_id' => $facture->id,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Envoie une facture par email
     */
    public function envoyerFactureEmail(Facture $facture): bool
    {
        try {
            if (!$facture->client->email) {
                Log::warning('Client sans email, impossible d\'envoyer la facture', [
                    'facture_id' => $facture->id,
                    'client_id' => $facture->client_id,
                ]);
                return false;
            }

            // Envoyer l'email avec la facture en pièce jointe
            \Mail::to($facture->client->email)->send(new \App\Mail\EnvoyerFacture($facture));

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
     */
    public function genererEtEnvoyerFacturesDuJour(): array
    {
        $resultats = [
            'factures_generees' => 0,
            'factures_envoyees' => 0,
            'erreurs' => [],
        ];

        try {
            // Générer les factures pour les ventes du jour
            $ventesDuJour = Vente::whereDate('created_at', today())
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

            // Générer les factures pour les commandes livrées du jour
            $commandesLivrees = CommandeClient::whereDate('date_livraison_reelle', today())
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
