<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Boutique;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

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

    /**
     * Retourne les paramètres de la boutique courante (multi-tenancy).
     * Endpoint allégé utilisé par le frontend (caisse, paramètres).
     */
    public function settings(Request $request): JsonResponse
    {
        $boutique = $this->boutiqueCourante($request);

        return response()->json($boutique);
    }

    /**
     * Met à jour les paramètres de la boutique courante.
     */
    public function updateSettings(Request $request): JsonResponse
    {
        $boutique = $this->boutiqueCourante($request);

        $validated = $request->validate([
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
            'message' => 'Paramètres de la boutique mis à jour',
            'settings' => $boutique->fresh(),
        ]);
    }

    /**
     * Liste les utilisateurs membres d'une boutique (avec rôle dans la boutique).
     */
    public function equipe(Request $request, Boutique $boutique): JsonResponse
    {
        $user = Auth::user();

        if (!$boutique->estProprietaire($user)) {
            return response()->json(['message' => 'Accès non autorisé'], 403);
        }

        try {
            $membres = $boutique->users()
                ->withPivot('role_dans_boutique')
                ->get(['users.id', 'users.name', 'users.email', 'users.telephone', 'users.role', 'users.est_actif', 'users.derniere_connexion', 'users.created_at']);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('equipe error', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            throw $e;
        }

        $equipe = $membres->map(function ($membre) {
            return [
                'id' => $membre->id,
                'name' => $membre->name,
                'email' => $membre->email,
                'telephone' => $membre->telephone,
                'role' => $membre->role,
                'role_dans_boutique' => $membre->pivot->role_dans_boutique ?? $membre->role,
                'est_actif' => (bool) $membre->est_actif,
                'derniere_connexion' => $membre->derniere_connexion,
                'created_at' => $membre->created_at,
            ];
        });

        return response()->json($equipe);
    }

    /**
     * Ajoute un membre à l'équipe d'une boutique : crée l'utilisateur puis le rattache.
     */
    public function addMembre(Request $request, Boutique $boutique): JsonResponse
    {
        $user = Auth::user();

        if (!$boutique->estProprietaire($user)) {
            return response()->json(['message' => 'Accès non autorisé'], 403);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'telephone' => 'nullable|string|max:30',
            'role' => 'nullable|in:gerant,caissier',
            'role_dans_boutique' => 'nullable|in:gerant,caissier',
        ]);

        $role = $request->role ?? $request->role_dans_boutique ?? 'caissier';

        $membre = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'telephone' => $request->telephone ?? null,
            'role' => $role,
            'est_actif' => true,
        ]);

        $boutique->users()->attach($membre->id, [
            'role_dans_boutique' => $role,
        ]);

        return response()->json([
            'message' => 'Membre ajouté à l\'équipe',
            'membre' => [
                'id' => $membre->id,
                'name' => $membre->name,
                'email' => $membre->email,
                'telephone' => $membre->telephone,
                'role' => $membre->role,
                'role_dans_boutique' => $role,
                'est_actif' => (bool) $membre->est_actif,
            ],
        ], 201);
    }

    /**
     * Retire un utilisateur d'une boutique (par son id).
     */
    public function removeUserById(Request $request, Boutique $boutique, int $userId): JsonResponse
    {
        $user = Auth::user();

        if (!$boutique->estProprietaire($user)) {
            return response()->json(['message' => 'Accès non autorisé'], 403);
        }

        if (!User::whereKey($userId)->exists()) {
            return response()->json(['message' => 'Utilisateur introuvable'], 404);
        }

        $boutique->users()->detach($userId);

        return response()->json(['message' => 'Membre retiré de l\'équipe']);
    }

    /**
     * Boutique courante : celle sélectionnée par l'utilisateur, sinon sa première boutique.
     */
    private function boutiqueCourante(Request $request): Boutique
    {
        $user = $request->user();

        if ($user->current_boutique_id) {
            $boutique = Boutique::find($user->current_boutique_id);
            if ($boutique && $boutique->aAcces($user)) {
                return $boutique;
            }
        }

        $boutique = $user->estProprietaire()
            ? Boutique::forProprietaire($user->id)->first()
            : $user->boutiques()->first();

        if (!$boutique) {
            abort(404, 'Aucune boutique pour cet utilisateur');
        }

        return $boutique;
    }
}
