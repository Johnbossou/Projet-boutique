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

        // Boutique cible (rattachement multi-tenancy)
        $boutiqueId = $validated['boutique_id']
            ?? ($validated['role_dans_boutique'] ?? null ? $request->user()->current_boutique_id : null);
        $roleBoutique = $validated['role_dans_boutique'] ?? null;

        // Règle métier : un seul gérant par boutique
        if ($boutiqueId) {
            $boutique = \App\Models\Boutique::find($boutiqueId);
            if ($boutique && $boutique->aAcces($request->user())) {
                $verif = $boutique->gererPromotionGerant(0, (string) ($roleBoutique ?: $validated['role']), (bool) $request->boolean('confirmer'));
                if (!$verif['ok'] && $verif['code'] === 'gerant_existant') {
                    return response()->json([
                        'message' => $verif['message'],
                        'code' => 'gerant_existant',
                        'gerant_actuel' => $verif['gerant_actuel'],
                    ], 409);
                }
            }
        }

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'telephone' => $validated['telephone'] ?? null,
            'role' => $validated['role'],
            'est_actif' => true,
        ]);

        // Assignation à une boutique via pivot (multi-tenancy) + règle gérant
        if ($boutiqueId && $roleBoutique) {
            $boutique = \App\Models\Boutique::find($boutiqueId);
            if ($boutique && $boutique->aAcces($request->user())) {
                if ($roleBoutique === 'gerant') {
                    $boutique->gererPromotionGerant($user->id, 'gerant', (bool) $request->boolean('confirmer'));
                }
                $boutique->rattacherUser($user->id, $roleBoutique);
            } else {
                $user->boutiques()->attach($boutiqueId, ['role_dans_boutique' => $roleBoutique]);
            }
        }

        $this->auditCreate($user);

        return response()->json([
            'message' => 'Utilisateur créé',
            'user' => $this->formatUser($user->fresh()),
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

        // Règle métier : un seul gérant par boutique (promotion vers gérant)
        if (isset($validated['role']) && $validated['role'] === 'gerant' && $acteur->current_boutique_id) {
            $boutique = \App\Models\Boutique::find($acteur->current_boutique_id);
            if ($boutique && $boutique->aAcces($acteur)) {
                $verif = $boutique->gererPromotionGerant($user->id, 'gerant', (bool) $request->boolean('confirmer'));
                if (!$verif['ok'] && $verif['code'] === 'gerant_existant') {
                    return response()->json([
                        'message' => $verif['message'],
                        'code' => 'gerant_existant',
                        'gerant_actuel' => $verif['gerant_actuel'],
                    ], 409);
                }
                // Le user doit être rattaché à cette boutique
                if (!$boutique->users()->where('user_id', $user->id)->exists()) {
                    $boutique->rattacherUser($user->id, 'gerant');
                }
            }
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

        // Synchroniser le pivot de la boutique courante quand le rôle du membre change
        if (isset($validated['role']) && $acteur->current_boutique_id) {
            $boutique = \App\Models\Boutique::find($acteur->current_boutique_id);
            if ($boutique && $boutique->users()->where('user_id', $user->id)->exists() && $validated['role'] !== 'proprietaire') {
                $boutique->users()->updateExistingPivot($user->id, [
                    'role_dans_boutique' => $validated['role'] === 'gerant' ? 'gerant' : 'caissier',
                ]);
            }
        }

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

    /**
     * Invite un utilisateur par email (créé inactif, rattaché à la boutique courante s'il y a lieu).
     */
    public function invite(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'role' => 'nullable|in:gerant,caissier',
        ]);

        $role = $validated['role'] ?? 'caissier';

        // Si l'utilisateur existe déjà, on le rattache simplement à une boutique éligible.
        $existant = User::where('email', $validated['email'])->first();

        if ($existant) {
            $boutiqueId = $request->user()->current_boutique_id;
            if ($boutiqueId && $request->user()->aAccesBoutique($boutiqueId)) {
                $existant->boutiques()->syncWithoutDetaching([$boutiqueId => ['role_dans_boutique' => $role]]);
            }
            return response()->json(['message' => 'Utilisateur déjà présent, rattaché à la boutique'], 200);
        }

        $user = User::create([
            'name' => $validated['email'],
            'email' => $validated['email'],
            'password' => Hash::make(\Illuminate\Support\Str::random(32)),
            'role' => $role,
            'est_actif' => false,
        ]);

        return response()->json([
            'message' => 'Invitation envoyée',
            'user' => $this->formatUser($user),
        ], 201);
    }

    /**
     * Export CSV des utilisateurs.
     */
    public function export(Request $request): \Illuminate\Http\Response
    {
        $users = User::orderBy('name')->get(['id', 'name', 'email', 'role', 'telephone', 'est_actif', 'created_at']);

        $csv = fopen('php://temp', 'r+');
        fputcsv($csv, ['id', 'name', 'email', 'role', 'telephone', 'est_actif', 'created_at']);
        foreach ($users as $u) {
            fputcsv($csv, [
                $u->id, $u->name, $u->email, $u->role, $u->telephone,
                $u->est_actif ? '1' : '0', $u->created_at?->toDateTimeString(),
            ]);
        }
        rewind($csv);
        $content = stream_get_contents($csv);
        fclose($csv);

        return response($content, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="utilisateurs.csv"',
        ]);
    }

    /**
     * Import CSV des utilisateurs.
     */
    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt',
        ]);

        $file = $request->file('file');
        $handle = fopen($file->getRealPath(), 'r');
        $header = fgetcsv($handle);

        $imported = 0;
        while (($row = fgetcsv($handle)) !== false) {
            $data = array_combine($header ?: ['name', 'email', 'role', 'password'], $row ?: []);
            $email = $data['email'] ?? null;
            if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                continue;
            }
            if (User::where('email', $email)->exists()) {
                continue;
            }
            User::create([
                'name' => $data['name'] ?? $email,
                'email' => $email,
                'password' => Hash::make($data['password'] ?? \Illuminate\Support\Str::random(12)),
                'role' => in_array($data['role'] ?? null, ['proprietaire', 'gerant', 'caissier'], true) ? $data['role'] : 'caissier',
                'est_actif' => true,
            ]);
            $imported++;
        }
        fclose($handle);

        return response()->json(['imported' => $imported]);
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
