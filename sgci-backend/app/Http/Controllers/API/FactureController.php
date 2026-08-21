<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Facture;
use App\Services\FacturationService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class FactureController extends Controller
{
    protected $facturationService;

    public function __construct(FacturationService $facturationService)
    {
        $this->facturationService = $facturationService;
    }

    /**
     * Affiche la liste des factures de la boutique courante
     */
    public function index(Request $request): JsonResponse
    {
        $query = Facture::where('boutique_id', $request->user()->current_boutique_id)
            ->with(['client', 'vente', 'commandeClient']);

        // Filtre par statut
        if ($request->has('statut') && $request->statut) {
            $query->where('statut', $request->statut);
        }

        // Filtre par client
        if ($request->has('client_id') && $request->client_id) {
            $query->where('client_id', $request->client_id);
        }

        // Filtre par date
        if ($request->has('date_debut') && $request->date_debut) {
            $query->where('date_facture', '>=', $request->date_debut);
        }
        if ($request->has('date_fin') && $request->date_fin) {
            $query->where('date_facture', '<=', $request->date_fin);
        }

        $factures = $query->orderBy('date_facture', 'desc')->paginate(15);

        return response()->json([
            'data' => $factures->items(),
            'total' => $factures->total(),
            'per_page' => $factures->perPage(),
            'current_page' => $factures->currentPage(),
            'last_page' => $factures->lastPage(),
        ]);
    }

    /**
     * Affiche une facture spécifique
     */
    public function show(Request $request, Facture $facture): JsonResponse
    {
        if ($facture->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $facture->load(['client', 'boutique', 'vente.lignesVentes.produit', 'commandeClient.lignes.produit']);

        return response()->json($facture);
    }

    /**
     * Génère une facture pour une vente
     */
    public function genererPourVente(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'vente_id' => 'required|exists:ventes,id',
        ]);

        $vente = \App\Models\Vente::find($validated['vente_id']);

        if ($vente->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        try {
            $facture = $this->facturationService->genererFactureVente($vente);

            return response()->json([
                'message' => 'Facture générée avec succès',
                'data' => $facture,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur lors de la génération de la facture',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Génère une facture pour une commande client
     */
    public function genererPourCommande(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'commande_client_id' => 'required|exists:commande_clients,id',
        ]);

        $commande = \App\Models\CommandeClient::find($validated['commande_client_id']);

        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        try {
            $facture = $this->facturationService->genererFactureCommande($commande);

            return response()->json([
                'message' => 'Facture générée avec succès',
                'data' => $facture,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur lors de la génération de la facture',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Envoie une facture par email
     */
    public function envoyerEmail(Request $request, Facture $facture): JsonResponse
    {
        if ($facture->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $result = $this->facturationService->envoyerFactureEmail($facture);

        if ($result) {
            return response()->json([
                'message' => 'Facture envoyée par email avec succès',
            ]);
        }

        return response()->json([
            'message' => 'Erreur lors de l\'envoi de la facture',
        ], 500);
    }

    /**
     * Télécharge le PDF d'une facture
     */
    public function telechargerPdf(Request $request, Facture $facture)
    {
        if ($facture->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if (!$facture->chemin_pdf) {
            return response()->json(['message' => 'PDF non disponible'], 404);
        }

        return response()->download(
            storage_path('app/public/' . $facture->chemin_pdf),
            'facture-' . $facture->numero_facture . '.pdf'
        );
    }

    /**
     * Génère et envoie automatiquement les factures du jour
     */
    public function genererDuJour(Request $request): JsonResponse
    {
        if ($request->user()->role !== 'proprietaire') {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        try {
            $resultats = $this->facturationService->genererEtEnvoyerFacturesDuJour();

            return response()->json([
                'message' => 'Génération automatique terminée',
                'data' => $resultats,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur lors de la génération automatique',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
