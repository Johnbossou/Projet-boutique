<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Traits\Auditable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    use Auditable;
    public function index(Request $request): JsonResponse
    {
        $query = User::query()->orderBy('name');

        // Filtre par boutique courante (multi-tenancy)
        if ($request->user()->current_boutique_id) {
            $query->whereHas('boutiques', function ($q) use ($request) {
                $q->where('boutique_id', $request->user()->current_boutique_id);
            });
        }

        if ($request->boolean('actifs_seulement', true)) {
            $query->where('est_actif', true);
        }

        if ($request->filled('role')) {
            $query->where('role', $request->role);
        }

        $perPage = min((int) ($request->per_page ?? 20), 100);
        $users = $query->paginate($perPage, ['id', 'name', 'email', 'role', 'telephone', 'est_actif', 'derniere_connexion', 'created_at']);

        return response()->json($users);
    }

    public function caissiers(): JsonResponse
    {
        $query = User::where('role', 'caissier')
            ->where('est_actif', true)
            ->orderBy('name');

        // Filtre par boutique courante (multi-tenancy)
        if (auth()->user()->current_boutique_id) {
            $query->whereHas('boutiques', function ($q) {
                $q->where('boutique_id', auth()->user()->current_boutique_id);
            });
        }

        $caissiers = $query->get(['id', 'name', 'email', 'telephone', 'derniere_connexion']);

        return response()->json($caissiers);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'telephone' => 'nullable|string|max:30',
            'role' => ['required', Rule::in(['proprietaire', 'gerant', 'caissier'])],
            'boutique_id' => 'nullable|exists:boutiques,id',
            'role_dans_boutique' => 'nullable|in:gerant,caissier',
        ]);

        // Anti-escalade : seul un propriétaire peut créer un autre propriétaire
        if ($validated['role'] === 'proprietaire' && $request->user()->role !== 'proprietaire') {
            return response()->json([
                'message' => 'Seul un propriétaire peut créer un compte propriétaire.',
            ], 403);
        }

        // Un seul gérant actif recommandé — on autorise la création mais le seed garde le principal
        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'telephone' => $validated['telephone'] ?? null,
            'role' => $validated['role'],
            'est_actif' => true,
        ]);

        // Assignation à une boutique via pivot (multi-tenancy)
        if (isset($validated['boutique_id']) && isset($validated['role_dans_boutique'])) {
            $user->boutiques()->attach($validated['boutique_id'], [
                'role_dans_boutique' => $validated['role_dans_boutique'],
            ]);
        }

        $this->auditCreate($user);

        return response()->json([
            'message' => 'Utilisateur créé',
            'user' => $this->formatUser($user),
        ], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'telephone' => 'nullable|string|max:30',
            'role' => ['sometimes', Rule::in(['proprietaire', 'gerant', 'caissier'])],
            'password' => 'sometimes|string|min:8',
            'est_actif' => 'sometimes|boolean',
        ]);

        $acteur = $request->user();

        // Anti-escalade : seul un propriétaire peut attribuer/promouvoir vers « proprietaire »
        if (($validated['role'] ?? null) === 'proprietaire' && $acteur->role !== 'proprietaire') {
            return response()->json([
                'message' => 'Seul un propriétaire peut attribuer le rôle propriétaire.',
            ], 403);
        }

        // Personne ne modifie son propre rôle (auto-promotion)
        if (isset($validated['role']) && $user->id === $acteur->id) {
            return response()->json([
                'message' => 'Vous ne pouvez pas modifier votre propre rôle.',
            ], 422);
        }

        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }

        // Empêcher de se désactiver soi-même
        if (isset($validated['est_actif']) && $validated['est_actif'] === false && $user->id === $request->user()->id) {
            return response()->json(['message' => 'Vous ne pouvez pas désactiver votre propre compte.'], 422);
        }

        $oldValues = $user->only(array_keys($validated));

        $user->update($validated);

        $this->auditUpdate($user, $oldValues);

        return response()->json([
            'message' => 'Utilisateur mis à jour',
            'user' => $this->formatUser($user->fresh()),
        ]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Vous ne pouvez pas supprimer votre propre compte.'], 422);
        }

        $user->update(['est_actif' => false]);

        $this->auditUpdate($user, ['est_actif' => true]);

        return response()->json(['message' => 'Utilisateur désactivé']);
    }

    public function assignBoutique(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'boutique_id' => 'required|exists:boutiques,id',
            'role_dans_boutique' => 'required|in:gerant,caissier',
        ]);

        // Vérifier que l'utilisateur a accès à cette boutique
        if (!$request->user()->aAccesBoutique($validated['boutique_id'])) {
            return response()->json(['message' => 'Accès non autorisé à cette boutique'], 403);
        }

        $user->boutiques()->attach($validated['boutique_id'], [
            'role_dans_boutique' => $validated['role_dans_boutique'],
        ]);

        return response()->json(['message' => 'Utilisateur assigné à la boutique']);
    }

    public function removeBoutique(Request $request, User $user, $boutiqueId): JsonResponse
    {
        // Vérifier que l'utilisateur a accès à cette boutique
        if (!$request->user()->aAccesBoutique($boutiqueId)) {
            return response()->json(['message' => 'Accès non autorisé à cette boutique'], 403);
        }

        $user->boutiques()->detach($boutiqueId);

        return response()->json(['message' => 'Utilisateur retiré de la boutique']);
    }

    private function formatUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'telephone' => $user->telephone,
            'est_actif' => $user->est_actif,
            'derniere_connexion' => $user->derniere_connexion,
        ];
    }
}
