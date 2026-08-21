<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\CommandeFournisseur;
use App\Models\LigneCommandeFournisseur;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class CommandeFournisseurController extends Controller
{
    /**
     * Affiche la liste des commandes fournisseurs de la boutique courante
     */
    public function index(Request $request): JsonResponse
    {
        $query = CommandeFournisseur::where('boutique_id', $request->user()->current_boutique_id)
            ->with(['fournisseur', 'user', 'lignes.produit']);

        // Filtre par statut
        if ($request->has('statut') && $request->statut) {
            $query->where('statut', $request->statut);
        }

        // Filtre par fournisseur
        if ($request->has('fournisseur_id') && $request->fournisseur_id) {
            $query->where('fournisseur_id', $request->fournisseur_id);
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
     * Crée une nouvelle commande fournisseur
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'fournisseur_id' => 'required|exists:fournisseurs,id',
            'date_livraison_prevue' => 'nullable|date',
            'conditions_paiement' => 'nullable|string',
            'notes' => 'nullable|string',
            'lignes' => 'required|array|min:1',
            'lignes.*.produit_id' => 'required|exists:produits,id',
            'lignes.*.quantite_commandee' => 'required|integer|min:1',
            'lignes.*.prix_unitaire' => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($request, $validated) {
            $commande = CommandeFournisseur::create([
                'fournisseur_id' => $validated['fournisseur_id'],
                'boutique_id' => $request->user()->current_boutique_id,
                'date_commande' => now(),
                'date_livraison_prevue' => $validated['date_livraison_prevue'] ?? null,
                'statut' => 'en_attente',
                'conditions_paiement' => $validated['conditions_paiement'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'user_id' => $request->user()->id,
                'montant_total' => 0,
            ]);

            $montantTotal = 0;

            foreach ($validated['lignes'] as $ligneData) {
                $montantLigne = $ligneData['quantite_commandee'] * $ligneData['prix_unitaire'];
                $montantTotal += $montantLigne;

                LigneCommandeFournisseur::create([
                    'commande_fournisseur_id' => $commande->id,
                    'produit_id' => $ligneData['produit_id'],
                    'quantite_commandee' => $ligneData['quantite_commandee'],
                    'quantite_recue' => 0,
                    'prix_unitaire' => $ligneData['prix_unitaire'],
                    'montant_total' => $montantLigne,
                    'statut' => 'en_attente',
                ]);
            }

            $commande->update(['montant_total' => $montantTotal]);

            return response()->json([
                'message' => 'Commande fournisseur créée avec succès',
                'data' => $commande->load('fournisseur', 'lignes.produit'),
            ], 201);
        });
    }

    /**
     * Affiche une commande fournisseur spécifique
     */
    public function show(Request $request, CommandeFournisseur $commande): JsonResponse
    {
        // Vérifier que la commande appartient à la boutique courante
        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $commande->load(['fournisseur', 'user', 'lignes.produit']);

        return response()->json($commande);
    }

    /**
     * Met à jour une commande fournisseur
     */
    public function update(Request $request, CommandeFournisseur $commande): JsonResponse
    {
        // Vérifier que la commande appartient à la boutique courante
        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        // Seules les commandes en attente peuvent être modifiées
        if ($commande->statut !== 'en_attente') {
            return response()->json([
                'message' => 'Seules les commandes en attente peuvent être modifiées',
            ], 400);
        }

        $validated = $request->validate([
            'date_livraison_prevue' => 'nullable|date',
            'conditions_paiement' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        $commande->update($validated);

        return response()->json([
            'message' => 'Commande mise à jour avec succès',
            'data' => $commande,
        ]);
    }

    /**
     * Valide une commande fournisseur
     */
    public function valider(Request $request, CommandeFournisseur $commande): JsonResponse
    {
        // Vérifier que la commande appartient à la boutique courante
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
     * Annule une commande fournisseur
     */
    public function annuler(Request $request, CommandeFournisseur $commande): JsonResponse
    {
        // Vérifier que la commande appartient à la boutique courante
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
     * Supprime (soft delete) une commande fournisseur
     */
    public function destroy(Request $request, CommandeFournisseur $commande): JsonResponse
    {
        // Vérifier que la commande appartient à la boutique courante
        if ($commande->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if ($commande->statut !== 'en_attente') {
            return response()->json([
                'message' => 'Seules les commandes en attente peuvent être supprimées',
            ], 400);
        }

        $commande->delete();

        return response()->json(['message' => 'Commande supprimée avec succès']);
    }
}
