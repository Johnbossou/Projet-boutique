<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Produit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

class ProduitController extends Controller
{
    /**
     * Affiche la liste des produits avec pagination
     */
    public function index(Request $request): JsonResponse
    {
        $query = Produit::with('categorie');

        // Recherche
        if ($request->has('search') && $request->search) {
            $query->where('nom', 'like', '%' . $request->search . '%');
        }

        // Filtre par catégorie
        if ($request->has('categorie_id') && $request->categorie_id) {
            $query->where('categorie_id', $request->categorie_id);
        }

        // Filtre par statut de stock
        if ($request->has('statut_stock')) {
            switch ($request->statut_stock) {
                case 'alerte':
                    $query->enAlerte();
                    break;
                case 'rupture':
                    $query->enRupture();
                    break;
                case 'perissable':
                    $query->perissables();
                    break;
            }
        }

        $produits = $query->orderBy('created_at', 'desc')->paginate(20);

        return response()->json($produits);
    }

    /**
     * Enregistre un nouveau produit
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nom' => 'required|string|max:255',
            'description' => 'nullable|string',
            'prix' => 'required|numeric|min:0',
            'quantite_stock' => 'required|integer|min:0',
            'seuil_alerte' => 'required|integer|min:0',
            'categorie_id' => 'required|exists:categories,id',
            'est_perissable' => 'boolean',
            'unite_mesure' => 'required|string|max:50',
        ]);

        $produit = Produit::create($validated);

        return response()->json($produit, 201);
    }

    /**
     * Affiche un produit spécifique
     */
    public function show(Produit $produit): JsonResponse
    {
        $produit->load('categorie');
        return response()->json($produit);
    }

    /**
     * Met à jour un produit
     */
    public function update(Request $request, Produit $produit): JsonResponse
    {
        $validated = $request->validate([
            'nom' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'prix' => 'sometimes|numeric|min:0',
            // Le stock est géré séparément via les mouvements de stock pour assurer traçabilité.
            'seuil_alerte' => 'sometimes|integer|min:0',
            'categorie_id' => 'sometimes|exists:categories,id',
            'est_perissable' => 'boolean',
            'unite_mesure' => 'sometimes|string|max:50',
        ]);

        $produit->update($validated);

        return response()->json($produit);
    }

    /**
     * Supprime un produit
     */
    public function destroy(Produit $produit): JsonResponse
    {
        $produit->delete();

        return response()->json(['message' => 'Produit supprimé avec succès']);
    }

    /**
     * Liste des produits en alerte de stock
     */
    public function alerteStock()
    {
        try {
            $produits = Produit::whereColumn('quantite_stock', '<', 'seuil_alerte')
                            ->where('quantite_stock', '>', 0)
                            ->with('categorie')
                            ->get();

            return response()->json($produits);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Erreur serveur'], 500);
        }
    }

    /**
     * Statistiques des produits
     */
    public function search(string $search): JsonResponse
    {
        $produits = Produit::with('categorie')
            ->where(function ($query) use ($search) {
                $query->where('nom', 'like', '%' . $search . '%')
                    ->orWhere('code_qr', 'like', '%' . $search . '%');
            })
            ->orderBy('nom')
            ->limit(50)
            ->get();

        return response()->json($produits);
    }

    public function statistiques(): JsonResponse
    {
        $totalProduits = Produit::count();
        $produitsEnAlerte = Produit::enAlerte()->count();
        $produitsEnRupture = Produit::enRupture()->count();
        $valeurStockTotal = Produit::sum(DB::raw('prix * quantite_stock'));

        return response()->json([
            'total_produits' => $totalProduits,
            'produits_en_alerte' => $produitsEnAlerte,
            'produits_en_rupture' => $produitsEnRupture,
            'valeur_stock_total' => $valeurStockTotal,
        ]);
    }
}
