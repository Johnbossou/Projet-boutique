<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Boutique;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class BoutiqueController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        $query = $user->estProprietaire() 
            ? Boutique::forProprietaire($user->id)
            : $user->boutiques();

        $perPage = min((int) ($request->per_page ?? 20), 100);
        $boutiques = $query->paginate($perPage);

        return response()->json($boutiques);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'nom' => 'required|string|max:255',
            'adresse' => 'nullable|string|max:500',
            'telephone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:255',
            'devise' => 'sometimes|string|max:10',
            'taux_tva' => 'sometimes|numeric|min:0|max:100',
            'delai_annulation_vente_minutes' => 'sometimes|integer|min:0|max:1440',
        ]);

        $boutique = Boutique::create([
            'nom' => $request->nom,
            'adresse' => $request->adresse,
            'telephone' => $request->telephone,
            'email' => $request->email,
            'devise' => $request->devise ?? 'XOF',
            'taux_tva' => $request->taux_tva ?? 18.00,
            'delai_annulation_vente_minutes' => $request->delai_annulation_vente_minutes ?? 5,
            'proprietaire_id' => Auth::id(),
        ]);

        return response()->json([
            'message' => 'Boutique créée avec succès',
            'boutique' => $boutique,
        ], 201);
    }

    public function show(Boutique $boutique): JsonResponse
    {
        $user = Auth::user();
        
        if (!$boutique->aAcces($user)) {
            return response()->json(['message' => 'Accès non autorisé'], 403);
        }

        return response()->json($boutique);
    }

    public function update(Request $request, Boutique $boutique): JsonResponse
    {
        $user = Auth::user();
        
        if (!$boutique->estProprietaire($user)) {
            return response()->json(['message' => 'Accès non autorisé'], 403);
        }

        $request->validate([
            'nom' => 'sometimes|string|max:255',
            'adresse' => 'nullable|string|max:500',
            'telephone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:255',
            'devise' => 'sometimes|string|max:10',
            'taux_tva' => 'sometimes|numeric|min:0|max:100',
            'delai_annulation_vente_minutes' => 'sometimes|integer|min:0|max:1440',
        ]);

        $boutique->update($request->only([
            'nom', 'adresse', 'telephone', 'email', 'devise', 'taux_tva', 'delai_annulation_vente_minutes'
        ]));

        return response()->json([
            'message' => 'Boutique mise à jour',
            'boutique' => $boutique->fresh(),
        ]);
    }

    public function destroy(Boutique $boutique): JsonResponse
    {
        $user = Auth::user();
        
        if (!$boutique->estProprietaire($user)) {
            return response()->json(['message' => 'Accès non autorisé'], 403);
        }

        $boutique->delete();

        return response()->json(['message' => 'Boutique supprimée']);
    }

    public function assignUser(Request $request, Boutique $boutique): JsonResponse
    {
        $user = Auth::user();
        
        if (!$boutique->estProprietaire($user)) {
            return response()->json(['message' => 'Accès non autorisé'], 403);
        }

        $request->validate([
            'user_id' => 'required|exists:users,id',
            'role_dans_boutique' => 'required|in:gerant,caissier',
        ]);

        $boutique->users()->attach($request->user_id, [
            'role_dans_boutique' => $request->role_dans_boutique,
        ]);

        return response()->json(['message' => 'Utilisateur assigné à la boutique']);
    }

    public function removeUser(Request $request, Boutique $boutique, User $user): JsonResponse
    {
        $currentUser = Auth::user();
        
        if (!$boutique->estProprietaire($currentUser)) {
            return response()->json(['message' => 'Accès non autorisé'], 403);
        }

        $boutique->users()->detach($user->id);

        return response()->json(['message' => 'Utilisateur retiré de la boutique']);
    }
}
