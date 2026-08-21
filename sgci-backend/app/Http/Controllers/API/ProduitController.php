<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\VerifieBoutique;
use App\Models\Produit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

class ProduitController extends Controller
{
    use VerifieBoutique;

    /**
     * Affiche la liste des produits avec pagination
     */
    public function index(Request $request): JsonResponse
    {
        $query = Produit::with('categorie');

        // Isolation multi-boutiques
        if ($request->user()->current_boutique_id) {
            $query->where('boutique_id', $request->user()->current_boutique_id);
        }

        // Recherche
        if ($request->has('search') && $request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('nom', 'like', '%' . $request->search . '%')
                  ->orWhere('code_qr', 'like', '%' . $request->search . '%');
            });
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

        // Pagination : per_page borné pour éviter les requêtes géantes
        $perPage = max(1, min(100, (int) $request->query('per_page', 20)));

        $produits = $query->orderBy('created_at', 'desc')->paginate($perPage);

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
            'image_url' => 'nullable|string|max:500',
            'code_qr' => 'nullable|string|max:255',
        ]);

        // Ajouter boutique_id automatiquement (multi-tenancy)
        $validated['boutique_id'] = $request->user()->current_boutique_id;

        // La catégorie doit appartenir à la même boutique (ou être partagée)
        if ($validated['boutique_id']) {
            $categorieValide = DB::table('categories')
                ->where('id', $validated['categorie_id'])
                ->where(function ($q) use ($validated) {
                    $q->whereNull('boutique_id')
                      ->orWhere('boutique_id', $validated['boutique_id']);
                })
                ->exists();

            if (!$categorieValide) {
                return response()->json([
                    'message' => 'La catégorie sélectionnée appartient à une autre boutique.',
                ], 422);
            }
        }

        $produit = Produit::create($validated);

        return response()->json($produit, 201);
    }

    /**
     * Affiche un produit spécifique
     */
    public function show(Produit $produit): JsonResponse
    {
        $this->verifierBoutiqueDe($produit);

        $produit->load('categorie');
        return response()->json($produit);
    }

    /**
     * Met à jour un produit
     */
    public function update(Request $request, Produit $produit): JsonResponse
    {
        $this->verifierBoutiqueDe($produit);

        $validated = $request->validate([
            'nom' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'prix' => 'sometimes|numeric|min:0',
            // Le stock est géré séparément via les mouvements de stock pour assurer traçabilité.
            'seuil_alerte' => 'sometimes|integer|min:0',
            'categorie_id' => 'sometimes|exists:categories,id',
            'est_perissable' => 'boolean',
            'unite_mesure' => 'sometimes|string|max:50',
            'image_url' => 'nullable|string|max:500',
            'code_qr' => 'nullable|string|max:255',
        ]);

        $produit->update($validated);

        return response()->json($produit);
    }

    /**
     * Supprime un produit
     */
    public function destroy(Produit $produit): JsonResponse
    {
        $this->verifierBoutiqueDe($produit);

        $produit->delete();

        return response()->json(['message' => 'Produit supprimé avec succès']);
    }

    /**
     * Liste des produits en alerte de stock
     */
    public function alerteStock()
    {
        try {
            $query = Produit::whereColumn('quantite_stock', '<', 'seuil_alerte')
                            ->where('quantite_stock', '>', 0)
                            ->with('categorie');

            if (auth()->user()->current_boutique_id) {
                $query->where('boutique_id', auth()->user()->current_boutique_id);
            }

            return response()->json($query->get());
        } catch (\Exception $e) {
            return response()->json(['error' => 'Erreur serveur'], 500);
        }
    }

    /**
     * Recherche de produits (nom / code QR), isolée par boutique.
     */
    public function search(string $search): JsonResponse
    {
        $query = Produit::with('categorie')
            ->where(function ($query) use ($search) {
                $query->where('nom', 'like', '%' . $search . '%')
                    ->orWhere('code_qr', 'like', '%' . $search . '%');
            });

        if (auth()->user()->current_boutique_id) {
            $query->where('boutique_id', auth()->user()->current_boutique_id);
        }

        return response()->json(
            $query->orderBy('nom')->limit(50)->get()
        );
    }

    /**
     * Scan code-barres / QR / ID produit (caisse).
     * Les conditions sont groupées AVANT application du filtre boutique :
     * un orWhere non groupé ferait fuiter les produits des autres boutiques.
     */
    public function findByCode(string $code): JsonResponse
    {
        $query = Produit::with('categorie')->where(function ($q) use ($code) {
            $q->where('code_qr', $code);

            if (ctype_digit($code)) {
                $q->orWhere('id', (int) $code);
            }
        });

        if ($boutiqueId = auth()->user()->current_boutique_id) {
            $query->where('boutique_id', $boutiqueId);
        }

        $produit = $query->first();

        if (!$produit) {
            return response()->json(['message' => 'Produit introuvable pour ce code'], 404);
        }

        return response()->json($produit);
    }

    /**
     * Upload image produit (jpeg, png, webp — max 5 Mo).
     */
    public function uploadImage(Request $request, Produit $produit): JsonResponse
    {
        $this->verifierBoutiqueDe($produit);

        $request->validate([
            'image' => 'required|image|mimes:jpeg,jpg,png,webp|max:5120',
        ]);

        $file = $request->file('image');
        $path = $file->store('produits/' . $produit->id, 'public');
        $url = rtrim(config('app.url'), '/') . Storage::disk('public')->url($path);

        $produit->update(['image_url' => $url]);

        return response()->json([
            'message' => 'Image enregistrée',
            'image_url' => $url,
            'produit' => $produit->fresh()->load('categorie'),
        ]);
    }

    public function statistiques(): JsonResponse
    {
        $boutiqueId = auth()->user()->current_boutique_id;

        $totalProduits = Produit::when($boutiqueId, fn ($q) => $q->where('boutique_id', $boutiqueId))->count();
        $produitsEnAlerte = Produit::enAlerte()
            ->when($boutiqueId, fn ($q) => $q->where('boutique_id', $boutiqueId))
            ->count();
        $produitsEnRupture = Produit::enRupture()
            ->when($boutiqueId, fn ($q) => $q->where('boutique_id', $boutiqueId))
            ->count();
        $valeurStockTotal = Produit::when($boutiqueId, fn ($q) => $q->where('boutique_id', $boutiqueId))
            ->sum(DB::raw('prix * quantite_stock'));

        return response()->json([
            'total_produits' => $totalProduits,
            'produits_en_alerte' => $produitsEnAlerte,
            'produits_en_rupture' => $produitsEnRupture,
            'valeur_stock_total' => $valeurStockTotal,
        ]);
    }
}
