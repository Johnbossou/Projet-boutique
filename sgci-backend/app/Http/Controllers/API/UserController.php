<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = User::query()->orderBy('name');

        if ($request->boolean('actifs_seulement', true)) {
            $query->where('est_actif', true);
        }

        if ($request->filled('role')) {
            $query->where('role', $request->role);
        }

        $users = $query->get(['id', 'name', 'email', 'role', 'telephone', 'est_actif', 'derniere_connexion', 'created_at']);

        return response()->json($users);
    }

    public function caissiers(): JsonResponse
    {
        $caissiers = User::where('role', 'caissier')
            ->where('est_actif', true)
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'telephone', 'derniere_connexion']);

        return response()->json($caissiers);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:6',
            'telephone' => 'nullable|string|max:30',
            'role' => ['required', Rule::in(['gerant', 'caissier'])],
        ]);

        // Un seul gérant actif recommandé — on autorise la création mais le seed garde le principal
        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'telephone' => $validated['telephone'] ?? null,
            'role' => $validated['role'],
            'est_actif' => true,
        ]);

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
            'role' => ['sometimes', Rule::in(['gerant', 'caissier'])],
            'password' => 'sometimes|string|min:6',
            'est_actif' => 'sometimes|boolean',
        ]);

        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }

        // Empêcher de se désactiver soi-même
        if (isset($validated['est_actif']) && $validated['est_actif'] === false && $user->id === $request->user()->id) {
            return response()->json(['message' => 'Vous ne pouvez pas désactiver votre propre compte.'], 422);
        }

        $user->update($validated);

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

        return response()->json(['message' => 'Utilisateur désactivé']);
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
