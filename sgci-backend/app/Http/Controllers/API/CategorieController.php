<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Categorie;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class CategorieController extends Controller
{
    /**
     * Affiche la liste des catégories
     */
    public function index(): JsonResponse
    {
        $categories = Categorie::withCount('produits')->get();

        return response()->json($categories);
    }

    /**
     * Enregistre une nouvelle catégorie
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nom' => 'required|string|max:255|unique:categories,nom',
            'description' => 'nullable|string',
            'couleur' => 'nullable|string|max:7',
            'icone' => 'nullable|string|max:50',
        ]);

        $categorie = Categorie::create($validated);

        return response()->json($categorie, 201);
    }

    /**
     * Affiche une catégorie spécifique
     */
    public function show(Categorie $categorie): JsonResponse
    {
        $categorie->load('produits');
        return response()->json($categorie);
    }

    /**
     * Met à jour une catégorie
     */
    public function update(Request $request, Categorie $categorie): JsonResponse
    {
        $validated = $request->validate([
            'nom' => 'sometimes|string|max:255|unique:categories,nom,' . $categorie->id,
            'description' => 'nullable|string',
            'couleur' => 'nullable|string|max:7',
            'icone' => 'nullable|string|max:50',
        ]);

        $categorie->update($validated);

        return response()->json($categorie);
    }

    /**
     * Supprime une catégorie
     */
    public function destroy(Categorie $categorie): JsonResponse
    {
        // Vérifier si la catégorie a des produits
        if ($categorie->produits()->count() > 0) {
            return response()->json([
                'message' => 'Impossible de supprimer une catégorie qui contient des produits.'
            ], 422);
        }

        $categorie->delete();

        return response()->json(['message' => 'Catégorie supprimée avec succès']);
    }

    /**
     * Statistiques des catégories
     */
    public function statistiques(): JsonResponse
    {
        $categories = Categorie::withCount('produits')->get();

        $statistiques = $categories->map(function ($categorie) {
            return [
                'id' => $categorie->id,
                'nom' => $categorie->nom,
                'nombre_produits' => $categorie->produits_count,
                'couleur' => $categorie->couleur,
                'icone' => $categorie->icone,
            ];
        });

        return response()->json($statistiques);
    }
}
