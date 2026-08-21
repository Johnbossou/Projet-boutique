<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\VerifieBoutique;
use App\Models\Categorie;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class CategorieController extends Controller
{
    use VerifieBoutique;

    /**
     * Affiche la liste des catégories
     */
    public function index(Request $request): JsonResponse
    {
        $query = Categorie::withCount('produits');

        // Filtre par boutique courante (multi-tenancy)
        if (auth()->user()->current_boutique_id) {
            $query->where('boutique_id', auth()->user()->current_boutique_id);
        }

        $perPage = min((int) ($request->per_page ?? 20), 100);
        $categories = $query->paginate($perPage);

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

        // Ajouter boutique_id automatiquement (multi-tenancy)
        $validated['boutique_id'] = $request->user()->current_boutique_id;

        $categorie = Categorie::create($validated);

        return response()->json($categorie, 201);
    }

    /**
     * Affiche une catégorie spécifique
     */
    public function show(Categorie $categorie): JsonResponse
    {
        $this->verifierBoutiqueDe($categorie);

        $categorie->load('produits');
        return response()->json($categorie);
    }

    /**
     * Met à jour une catégorie
     */
    public function update(Request $request, Categorie $categorie): JsonResponse
    {
        $this->verifierBoutiqueDe($categorie);

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
        $this->verifierBoutiqueDe($categorie);

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
    public function produits($id): JsonResponse
    {
        $categorie = Categorie::findOrFail($id);
        $this->verifierBoutiqueDe($categorie);

        $query = $categorie->produits()->with('categorie')->orderBy('nom');

        // Filtre par boutique courante (multi-tenancy)
        if (auth()->user()->current_boutique_id) {
            $query->where('boutique_id', auth()->user()->current_boutique_id);
        }

        $produits = $query->get();

        return response()->json($produits);
    }

    public function statistiquesOverview(): JsonResponse
    {
        return $this->statistiques();
    }

    public function statistiques(): JsonResponse
    {
        $query = Categorie::withCount('produits');

        // Filtre par boutique courante (multi-tenancy)
        if (auth()->user()->current_boutique_id) {
            $query->where('boutique_id', auth()->user()->current_boutique_id);
        }

        $categories = $query->get();

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
