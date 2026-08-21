<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\TransfertStock;
use App\Models\Produit;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class TransfertStockController extends Controller
{
    /**
     * Affiche la liste des transferts de stock
     */
    public function index(Request $request): JsonResponse
    {
        $query = TransfertStock::with(['boutiqueSource', 'boutiqueDestination', 'produit', 'userSource', 'userDestination']);

        // Filtre par boutique source
        if ($request->has('boutique_source_id') && $request->boutique_source_id) {
            $query->where('boutique_source_id', $request->boutique_source_id);
        }

        // Filtre par boutique destination
        if ($request->has('boutique_destination_id') && $request->boutique_destination_id) {
            $query->where('boutique_destination_id', $request->boutique_destination_id);
        }

        // Filtre par statut
        if ($request->has('statut') && $request->statut) {
            $query->where('statut', $request->statut);
        }

        // Filtre par boutique courante (source ou destination)
        if ($request->user()->current_boutique_id) {
            $query->where(function ($q) use ($request) {
                $q->where('boutique_source_id', $request->user()->current_boutique_id)
                  ->orWhere('boutique_destination_id', $request->user()->current_boutique_id);
            });
        }

        $transferts = $query->orderBy('date_transfert', 'desc')->paginate(15);

        return response()->json([
            'data' => $transferts->items(),
            'total' => $transferts->total(),
            'per_page' => $transferts->perPage(),
            'current_page' => $transferts->currentPage(),
            'last_page' => $transferts->lastPage(),
        ]);
    }

    /**
     * Crée un nouveau transfert de stock
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'boutique_destination_id' => 'required|exists:boutiques,id',
            'produit_id' => 'required|exists:produits,id',
            'quantite' => 'required|integer|min:1',
            'motif' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        return DB::transaction(function () use ($request, $validated) {
            $boutiqueSourceId = $request->user()->current_boutique_id;
            $produit = Produit::where('id', $validated['produit_id'])
                ->where('boutique_id', $boutiqueSourceId)
                ->first();

            if (!$produit) {
                return response()->json([
                    'message' => 'Produit non trouvé dans la boutique source',
                ], 404);
            }

            if ($produit->quantite_stock < $validated['quantite']) {
                return response()->json([
                    'message' => 'Stock insuffisant pour le transfert',
                ], 400);
            }

            // Diminuer le stock de la boutique source
            $produit->diminuerStock($validated['quantite']);

            // Créer le transfert
            $transfert = TransfertStock::create([
                'boutique_source_id' => $boutiqueSourceId,
                'boutique_destination_id' => $validated['boutique_destination_id'],
                'produit_id' => $validated['produit_id'],
                'quantite' => $validated['quantite'],
                'statut' => 'en_attente',
                'date_transfert' => now(),
                'motif' => $validated['motif'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'user_source_id' => $request->user()->id,
            ]);

            return response()->json([
                'message' => 'Transfert de stock créé avec succès',
                'data' => $transfert->load(['boutiqueSource', 'boutiqueDestination', 'produit', 'userSource']),
            ], 201);
        });
    }

    /**
     * Affiche un transfert de stock spécifique
     */
    public function show(Request $request, TransfertStock $transfert): JsonResponse
    {
        // Vérifier que l'utilisateur a accès à ce transfert
        $boutiqueId = $request->user()->current_boutique_id;
        if ($transfert->boutique_source_id !== $boutiqueId && $transfert->boutique_destination_id !== $boutiqueId) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $transfert->load(['boutiqueSource', 'boutiqueDestination', 'produit', 'userSource', 'userDestination']);

        return response()->json($transfert);
    }

    /**
     * Annule un transfert de stock
     */
    public function annuler(Request $request, TransfertStock $transfert): JsonResponse
    {
        // Vérifier que l'utilisateur a accès à ce transfert
        $boutiqueId = $request->user()->current_boutique_id;
        if ($transfert->boutique_source_id !== $boutiqueId) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if (!$transfert->peutEtreAnnule()) {
            return response()->json([
                'message' => 'Ce transfert ne peut pas être annulé',
            ], 400);
        }

        return DB::transaction(function () use ($transfert) {
            // Remettre le stock dans la boutique source
            $produit = Produit::find($transfert->produit_id);
            if ($produit) {
                $produit->augmenterStock($transfert->quantite);
            }

            $transfert->update(['statut' => 'annule']);

            return response()->json([
                'message' => 'Transfert annulé avec succès',
                'data' => $transfert,
            ]);
        });
    }

    /**
     * Réceptionne un transfert de stock
     */
    public function recevoir(Request $request, TransfertStock $transfert): JsonResponse
    {
        // Vérifier que l'utilisateur a accès à ce transfert
        $boutiqueId = $request->user()->current_boutique_id;
        if ($transfert->boutique_destination_id !== $boutiqueId) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if ($transfert->statut !== 'en_attente' && $transfert->statut !== 'en_cours') {
            return response()->json([
                'message' => 'Ce transfert ne peut pas être reçu',
            ], 400);
        }

        return DB::transaction(function () use ($request, $transfert) {
            // Augmenter le stock de la boutique destination
            $produit = Produit::where('id', $transfert->produit_id)
                ->where('boutique_id', $transfert->boutique_destination_id)
                ->first();

            if (!$produit) {
                // Créer le produit dans la boutique destination s'il n'existe pas
                $produitOriginal = Produit::find($transfert->produit_id);
                $produit = Produit::create([
                    'nom' => $produitOriginal->nom,
                    'description' => $produitOriginal->description,
                    'prix' => $produitOriginal->prix,
                    'quantite_stock' => 0,
                    'seuil_alerte' => $produitOriginal->seuil_alerte,
                    'categorie_id' => $produitOriginal->categorie_id,
                    'est_perissable' => $produitOriginal->est_perissable,
                    'code_qr' => $produitOriginal->code_qr,
                    'unite_mesure' => $produitOriginal->unite_mesure,
                    'image_url' => $produitOriginal->image_url,
                    'boutique_id' => $transfert->boutique_destination_id,
                ]);
            }

            $produit->augmenterStock($transfert->quantite);

            $transfert->update([
                'statut' => 'termine',
                'date_reception' => now(),
                'user_destination_id' => $request->user()->id,
            ]);

            return response()->json([
                'message' => 'Transfert reçu avec succès',
                'data' => $transfert->load(['boutiqueSource', 'boutiqueDestination', 'produit', 'userDestination']),
            ]);
        });
    }

    /**
     * Statistiques des transferts
     */
    public function statistiques(Request $request): JsonResponse
    {
        $boutiqueId = $request->user()->current_boutique_id;

        $totalTransferts = TransfertStock::where(function ($q) use ($boutiqueId) {
            $q->where('boutique_source_id', $boutiqueId)
              ->orWhere('boutique_destination_id', $boutiqueId);
        })->count();

        $transfertsEnAttente = TransfertStock::where(function ($q) use ($boutiqueId) {
            $q->where('boutique_source_id', $boutiqueId)
              ->orWhere('boutique_destination_id', $boutiqueId);
        })->enAttente()->count();

        $transfertsEnCours = TransfertStock::where(function ($q) use ($boutiqueId) {
            $q->where('boutique_source_id', $boutiqueId)
              ->orWhere('boutique_destination_id', $boutiqueId);
        })->enCours()->count();

        $transfertsTermines = TransfertStock::where(function ($q) use ($boutiqueId) {
            $q->where('boutique_source_id', $boutiqueId)
              ->orWhere('boutique_destination_id', $boutiqueId);
        })->termine()->count();

        return response()->json([
            'total_transferts' => $totalTransferts,
            'transferts_en_attente' => $transfertsEnAttente,
            'transferts_en_cours' => $transfertsEnCours,
            'transferts_termines' => $transfertsTermines,
        ]);
    }
}
