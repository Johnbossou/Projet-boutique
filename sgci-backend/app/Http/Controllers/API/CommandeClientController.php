<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\CommandeClient;
use App\Models\LigneCommandeClient;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class CommandeClientController extends Controller
{
    /**
     * Affiche la liste des commandes clients de la boutique courante
     */
    public function index(Request $request): JsonResponse
    {
        $query = CommandeClient::where('boutique_id', $request->user()->current_boutique_id)
            ->with(['client', 'devis', 'user', 'lignes.produit', 'paiements']);

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
            $query->where('date_commande', '>=', $request->date_debut);
        }
        if ($request->has('date_fin') && $request->date_fin) {
            $query->where('date_commande', '<=', $request->date_fin);
        }

        $commandes = $query->orderBy('date_commande', 'desc')->paginate(15);

        return response()->json([
            'data' => $commandes->items(),
            'total' => $commandes->total(),
            'per_page' => $commandes->perPage(),
            'current_page' => $commandes->currentPage(),
            'last_page' => $commandes->lastPage(),
        ]);
    }

    /**
     * Crée une nouvelle commande client
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'client_id' => 'required|exists:clients,id',
            'devis_id' => 'nullable|exists:devis,id',
            'date_livraison_prevue' => 'nullable|date',
            'mode_paiement' => 'nullable|string',
            'notes' => 'nullable|string',
            'lignes' => 'required|array|min:1',
            'lignes.*.produit_id' => 'required|exists:produits,id',
            'lignes.*.quantite' => 'required|integer|min:1',
            'lignes.*.prix_unitaire' => 'required|numeric|min:0',
            'lignes.*.remise_pourcentage' => 'nullable|numeric|min:0|max:100',
        ]);

        return DB::transaction(function () use ($request, $validated) {
            $commande = CommandeClient::create([
                'client_id' => $validated['client_id'],
                'boutique_id' => $request->user()->current_boutique_id,
                'devis_id' => $validated['devis_id'] ?? null,
                'date_commande' => now(),
                'date_livraison_prevue' => $validated['date_livraison_prevue'] ?? null,
                'statut' => 'en_attente',
                'mode_paiement' => $validated['mode_paiement'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'user_id' => $request->user()->id,
                'montant_total' => 0,
                'montant_paye' => 0,
            ]);

            $montantTotal = 0;

            foreach ($validated['lignes'] as $ligneData) {
                $remise = $ligneData['remise_pourcentage'] ?? 0;
                $montantBase = $ligneData['quantite'] * $ligneData['prix_unitaire'];
                $montantLigne = $montantBase - ($montantBase * ($remise / 100));
                $montantTotal += $montantLigne;

                LigneCommandeClient::create([
                    'commande_client_id' => $commande->id,
                    'produit_id' => $ligneData['produit_id'],
                    'quantite' => $ligneData['quantite'],
                    'prix_unitaire' => $ligneData['prix_unitaire'],
                    'remise_pourcentage' => $remise,
                    'montant_total' => $montantLigne,
                ]);
            }

            $commande->update(['montant_total' => $montantTotal]);

            return response()->json([
                'message' => 'Commande client créée avec succès',
                'data' => $commande->load('client', 'lignes.produit'),
            ], 201);
        });
    }

    /**
     * Affiche une commande client spécifique
     */
    public function show(Request $request, CommandeClient $commande): JsonResponse
    {
        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $commande->load(['client', 'devis', 'user', 'lignes.produit', 'paiements']);

        return response()->json($commande);
    }

    /**
     * Met à jour une commande client
     */
    public function update(Request $request, CommandeClient $commande): JsonResponse
    {
        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if ($commande->statut !== 'en_attente') {
            return response()->json([
                'message' => 'Seules les commandes en attente peuvent être modifiées',
            ], 400);
        }

        $validated = $request->validate([
            'date_livraison_prevue' => 'nullable|date',
            'mode_paiement' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        $commande->update($validated);

        return response()->json([
            'message' => 'Commande mise à jour avec succès',
            'data' => $commande,
        ]);
    }

    /**
     * Valide une commande client
     */
    public function valider(Request $request, CommandeClient $commande): JsonResponse
    {
        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if ($commande->statut !== 'en_attente') {
            return response()->json([
                'message' => 'Seules les commandes en attente peuvent être validées',
            ], 400);
        }

        $commande->update(['statut' => 'en_cours']);

        return response()->json([
            'message' => 'Commande validée avec succès',
            'data' => $commande,
        ]);
    }

    /**
     * Annule une commande client
     */
    public function annuler(Request $request, CommandeClient $commande): JsonResponse
    {
        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if (!in_array($commande->statut, ['en_attente', 'en_cours'])) {
            return response()->json([
                'message' => 'Seules les commandes en attente ou en cours peuvent être annulées',
            ], 400);
        }

        $commande->update(['statut' => 'annule']);

        return response()->json([
            'message' => 'Commande annulée avec succès',
            'data' => $commande,
        ]);
    }

    /**
     * Marque une commande comme livrée
     */
    public function livrer(Request $request, CommandeClient $commande): JsonResponse
    {
        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if ($commande->statut !== 'en_cours') {
            return response()->json([
                'message' => 'Seules les commandes en cours peuvent être livrées',
            ], 400);
        }

        $commande->update([
            'statut' => 'livre',
            'date_livraison_reelle' => now(),
        ]);

        return response()->json([
            'message' => 'Commande livrée avec succès',
            'data' => $commande,
        ]);
    }
}
