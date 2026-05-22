<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        if (Auth::attempt($request->only('email', 'password'))) {
            $user = User::where('email', $request->email)->first();

            if (!$user->est_actif) {
                Auth::logout();
                throw ValidationException::withMessages([
                    'email' => ['Ce compte est désactivé. Contactez le gérant.'],
                ]);
            }

            // Mettre à jour la dernière connexion
            $user->update(['derniere_connexion' => now()]);

            $tokenData = $this->issueToken($user);

            return response()->json([
                'token' => $tokenData['token'],
                'expires_at' => $tokenData['expires_at'],
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'telephone' => $user->telephone,
                ]
            ]);
        }

        throw ValidationException::withMessages([
            'email' => ['Les identifiants sont incorrects.'],
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Déconnexion réussie']);
    }

    public function refresh(Request $request)
    {
        $user = $request->user();
        $request->user()->currentAccessToken()->delete();
        $tokenData = $this->issueToken($user);

        return response()->json([
            'token' => $tokenData['token'],
            'expires_at' => $tokenData['expires_at'],
            'user' => $this->formatUser($user),
        ]);
    }

    public function me(Request $request)
    {
        return response()->json([
            'user' => $this->formatUser($request->user()),
        ]);
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,' . $user->id,
            'telephone' => 'nullable|string|max:30',
        ]);

        $user->update($validated);

        return response()->json([
            'message' => 'Profil mis à jour',
            'user' => $this->formatUser($user->fresh()),
        ]);
    }

    public function updatePassword(Request $request)
    {
        $validated = $request->validate([
            'current_password' => 'required',
            'password' => 'required|string|min:6|confirmed',
        ]);

        $user = $request->user();

        if (!Auth::attempt(['email' => $user->email, 'password' => $validated['current_password']])) {
            throw ValidationException::withMessages([
                'current_password' => ['Le mot de passe actuel est incorrect.'],
            ]);
        }

        $user->update(['password' => Hash::make($validated['password'])]);

        return response()->json(['message' => 'Mot de passe mis à jour']);
    }

    private function formatUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'telephone' => $user->telephone,
        ];
    }

    private function issueToken(User $user): array
    {
        $ttlMinutes = config('sgci.token_ttl_minutes', 10080);
        $expiresAt = now()->addMinutes($ttlMinutes);

        $accessToken = $user->createToken(
            'auth-token',
            ['*'],
            $expiresAt
        );

        return [
            'token' => $accessToken->plainTextToken,
            'expires_at' => $expiresAt->toIso8601String(),
        ];
    }
}
