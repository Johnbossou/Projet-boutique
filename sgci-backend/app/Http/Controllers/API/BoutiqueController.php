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

        // Source de vérité : possessions + pivot (pas le rôle global).
        $boutiques = $user->boutiquesAccessibles()
            ->loadCount(['users', 'produits', 'ventes']);

        return response()->json($boutiques);
    }

    /**
     * Liste les boutiques rattachées au compte courant (propriétaire + rattachées).
     * Accessible à tout utilisateur authentifié, utile pour choisir une destination
     * lors d'un transfert de stock entre boutiques.
     */
    public function mesBoutiques(Request $request): JsonResponse
    {
        $boutiques = Auth::user()->boutiquesAccessibles();

        return response()->json($boutiques->load('proprietaire'));
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

        if (! $boutique->aAcces($user)) {
            return response()->json(['message' => 'Accès non autorisé'], 403);
        }

        return response()->json($boutique);
    }

    public function update(Request $request, Boutique $boutique): JsonResponse
    {
        $user = Auth::user();

        if (! $boutique->estProprietaire($user)) {
            return response()->json(['message' => 'Accès non autorisé'], 403);
        }

        $validated = $request->validate([
            'nom' => 'sometimes|string|max:255',
            'adresse' => 'nullable|string|max:500',
            'telephone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:255',
            'devise' => 'sometimes|string|max:10',
            'taux_tva' => 'sometimes|numeric|min:0|max:100',
            'delai_annulation_vente_minutes' => 'sometimes|integer|min:0|max:1440',
        ]);

        // $validated et non $request->only() : only() remonte tout ce qui est
        // présent dans le corps, y compris une clé qu'on aurait ajoutée à la
        // liste sans la déclarer dans les règles — elle passerait en base
        // sans validation.
        $boutique->update($validated);

        return response()->json([
            'message' => 'Boutique mise à jour',
            'boutique' => $boutique->fresh(),
        ]);
    }

    public function destroy(Boutique $boutique): JsonResponse
    {
        $user = Auth::user();

        if (! $boutique->estProprietaire($user)) {
            return response()->json(['message' => 'Accès non autorisé'], 403);
        }

        $boutique->delete();

        return response()->json(['message' => 'Boutique supprimée']);
    }

    public function assignUser(Request $request, Boutique $boutique): JsonResponse
    {
        $user = Auth::user();

        $request->validate([
            'user_id' => 'required|exists:users,id',
            'role_dans_boutique' => 'required|in:gerant,caissier',
        ]);

        // Règle métier : un seul gérant par boutique
        $verif = $boutique->gererPromotionGerant((int) $request->user_id, (string) $request->role_dans_boutique, (bool) $request->boolean('confirmer'));
        if (! $verif['ok'] && $verif['code'] === 'gerant_existant') {
            return response()->json([
                'message' => $verif['message'],
                'code' => 'gerant_existant',
                'gerant_actuel' => $verif['gerant_actuel'],
            ], 409);
        }

        $boutique->rattacherUser((int) $request->user_id, (string) $request->role_dans_boutique);

        return response()->json(['message' => 'Utilisateur affecté à la boutique']);
    }

    public function removeUser(Request $request, Boutique $boutique, User $user): JsonResponse
    {
        $boutique->users()->detach($user->id);
        $this->revoquerAccesReste($user, $boutique->id);

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

        // $validated et non $request->only() : only() remonte tout ce qui est
        // présent dans le corps, y compris une clé qu'on aurait ajoutée à la
        // liste sans la déclarer dans les règles — elle passerait en base
        // sans validation.
        $boutique->update($validated);

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

        $membres = $boutique->users()
            ->withPivot('role_dans_boutique')
            ->get(['users.id', 'users.name', 'users.email', 'users.telephone', 'users.role', 'users.est_actif', 'users.derniere_connexion', 'users.created_at']);

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

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'telephone' => 'nullable|string|max:30',
            'role' => 'nullable|in:gerant,caissier',
            'role_dans_boutique' => 'nullable|in:gerant,caissier',
        ]);

        $role = $request->role ?? $request->role_dans_boutique ?? 'caissier';

        // Règle métier : un seul gérant par boutique
        $verif = $boutique->gererPromotionGerant(0, $role, (bool) $request->boolean('confirmer'));
        if (! $verif['ok'] && $verif['code'] === 'gerant_existant') {
            return response()->json([
                'message' => $verif['message'],
                'code' => 'gerant_existant',
                'gerant_actuel' => $verif['gerant_actuel'],
            ], 409);
        }

        $membre = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'telephone' => $request->telephone ?? null,
            'role' => $role,
            'est_actif' => true,
        ]);

        // Rétrograder l'ancien gérant si le rôle gérant est confirmé
        if ($role === 'gerant') {
            $boutique->gererPromotionGerant($membre->id, $role, (bool) $request->boolean('confirmer'));
        }

        // Lier le nouveau membre et synchroniser son rôle global
        $boutique->rattacherUser($membre->id, $role);

        return response()->json([
            'message' => 'Membre ajouté à l\'équipe',
            'membre' => [
                'id' => $membre->id,
                'name' => $membre->name,
                'email' => $membre->email,
                'telephone' => $membre->telephone,
                'role' => $membre->fresh()->role,
                'role_dans_boutique' => $role,
                'est_actif' => (bool) $membre->est_actif,
            ],
        ], 201);
    }

    /**
     * Conséquence obligatoire d'un retrait d'accès : le membre ne doit
     * conserver ni la boutique en cours ni une session valide.
     *
     * Sans cela, current_boutique_id continue de pointer sur la boutique
     * retirée et l'utilisateur lit encore ses données (fuite inter-boutiques).
     */
    private function revoquerAccesReste(User $membre, int $boutiqueId): void
    {
        if ((int) $membre->current_boutique_id === $boutiqueId) {
            $repli = $membre->fresh()->boutiquesAccessibles()->first();
            $membre->forceFill(['current_boutique_id' => $repli?->id])->save();
        }

        // Plus aucun accès à cette boutique : les sessions sont caduques.
        if (! $membre->fresh()->aAccesBoutique($boutiqueId)) {
            $membre->tokens()->delete();
        }
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

        // Repli sur la première boutique réellement accessible (possession
        // ou pivot) : ne dépend plus du rôle global.
        $boutique = $user->boutiquesAccessibles()->first();

        if (! $boutique) {
            abort(404, 'Aucune boutique pour cet utilisateur');
        }

        return $boutique;
    }
}
