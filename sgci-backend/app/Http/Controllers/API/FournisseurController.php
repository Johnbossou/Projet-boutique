<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Fournisseur;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class FournisseurController extends Controller
{
    /**
     * Affiche la liste des fournisseurs de la boutique courante
     */
    public function index(Request $request): JsonResponse
    {
        $query = Fournisseur::where('boutique_id', $request->user()->current_boutique_id);

        // Recherche
        if ($request->has('search') && $request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('nom', 'like', '%' . $request->search . '%')
                  ->orWhere('email', 'like', '%' . $request->search . '%')
                  ->orWhere('telephone', 'like', '%' . $request->search . '%');
            });
        }

        // Filtre par statut
        if ($request->has('actif')) {
            $query->where('actif', $request->boolean('actif'));
        }

        $fournisseurs = $query->orderBy('nom')->paginate(15);

        return response()->json([
            'data' => $fournisseurs->items(),
            'total' => $fournisseurs->total(),
            'per_page' => $fournisseurs->perPage(),
            'current_page' => $fournisseurs->currentPage(),
            'last_page' => $fournisseurs->lastPage(),
        ]);
    }

    /**
     * Crée un nouveau fournisseur
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nom' => 'required|string|max:255',
            'email' => 'nullable|email|max:255',
            'telephone' => 'nullable|string|max:20',
            'adresse' => 'nullable|string|max:255',
            'ville' => 'nullable|string|max:100',
            'pays' => 'nullable|string|max:100',
            'code_postal' => 'nullable|string|max:20',
            'contact_principal' => 'nullable|string|max:255',
            'email_contact' => 'nullable|email|max:255',
            'telephone_contact' => 'nullable|string|max:20',
            'conditions_paiement' => 'nullable|string',
            'delai_livraison' => 'nullable|integer',
            'notes' => 'nullable|string',
            'actif' => 'boolean',
        ]);

        $validated['boutique_id'] = $request->user()->current_boutique_id;

        $fournisseur = Fournisseur::create($validated);

        return response()->json([
            'message' => 'Fournisseur créé avec succès',
            'data' => $fournisseur,
        ], 201);
    }

    /**
     * Affiche un fournisseur spécifique
     */
    public function show(Request $request, Fournisseur $fournisseur): JsonResponse
    {
        // Vérifier que le fournisseur appartient à la boutique courante
        if ($fournisseur->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $fournisseur->load('commandesFournisseurs');

        return response()->json($fournisseur);
    }

    /**
     * Met à jour un fournisseur
     */
    public function update(Request $request, Fournisseur $fournisseur): JsonResponse
    {
        // Vérifier que le fournisseur appartient à la boutique courante
        if ($fournisseur->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'nom' => 'required|string|max:255',
            'email' => 'nullable|email|max:255',
            'telephone' => 'nullable|string|max:20',
            'adresse' => 'nullable|string|max:255',
            'ville' => 'nullable|string|max:100',
            'pays' => 'nullable|string|max:100',
            'code_postal' => 'nullable|string|max:20',
            'contact_principal' => 'nullable|string|max:255',
            'email_contact' => 'nullable|email|max:255',
            'telephone_contact' => 'nullable|string|max:20',
            'conditions_paiement' => 'nullable|string',
            'delai_livraison' => 'nullable|integer',
            'notes' => 'nullable|string',
            'actif' => 'boolean',
        ]);

        $fournisseur->update($validated);

        return response()->json([
            'message' => 'Fournisseur mis à jour avec succès',
            'data' => $fournisseur,
        ]);
    }

    /**
     * Supprime (soft delete) un fournisseur
     */
    public function destroy(Request $request, Fournisseur $fournisseur): JsonResponse
    {
        // Vérifier que le fournisseur appartient à la boutique courante
        if ($fournisseur->boutique_id !== $request->user()->current_boutique_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        // Vérifier s'il y a des commandes en cours
        if ($fournisseur->commandesFournisseurs()->whereIn('statut', ['en_attente', 'en_cours'])->exists()) {
            return response()->json([
                'message' => 'Impossible de supprimer un fournisseur avec des commandes en cours',
            ], 400);
        }

        $fournisseur->delete();

        return response()->json(['message' => 'Fournisseur supprimé avec succès']);
    }

    /**
     * Statistiques des fournisseurs
     */
    public function statistiques(Request $request): JsonResponse
    {
        $boutiqueId = $request->user()->current_boutique_id;

        $totalFournisseurs = Fournisseur::where('boutique_id', $boutiqueId)->count();
        $fournisseursActifs = Fournisseur::where('boutique_id', $boutiqueId)->actifs()->count();
        $fournisseursInactifs = Fournisseur::where('boutique_id', $boutiqueId)->inactifs()->count();

        return response()->json([
            'total_fournisseurs' => $totalFournisseurs,
            'fournisseurs_actifs' => $fournisseursActifs,
            'fournisseurs_inactifs' => $fournisseursInactifs,
        ]);
    }
}
