<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use App\Models\User;
use Illuminate\Validation\ValidationException;
use App\Services\TwoFactorAuthService;
use App\Services\AuditLogService;
use App\Services\EmailService;

class AuthController extends Controller
{
    protected $twoFactorService;
    protected $auditLogService;
    protected $emailService;

    public function __construct(TwoFactorAuthService $twoFactorService, AuditLogService $auditLogService, EmailService $emailService)
    {
        $this->twoFactorService = $twoFactorService;
        $this->auditLogService = $auditLogService;
        $this->emailService = $emailService;
    }

    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'telephone' => 'nullable|string|max:30',
            'password' => 'required|string|min:8|confirmed',
            'boutique_nom' => 'required|string|max:255',
            'boutique_adresse' => 'nullable|string|max:255',
            'boutique_telephone' => 'nullable|string|max:30',
        ]);

        // Créer l'utilisateur
        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'telephone' => $validated['telephone'] ?? null,
            'password' => Hash::make($validated['password']),
            'role' => 'proprietaire',
            'est_actif' => true,
            'derniere_connexion' => now(),
        ]);

        // Créer la boutique
        $boutique = \App\Models\Boutique::create([
            'nom' => $validated['boutique_nom'],
            'adresse' => $validated['boutique_adresse'] ?? null,
            'telephone' => $validated['boutique_telephone'] ?? null,
            'proprietaire_id' => $user->id,
            'devise' => 'XOF',
            'taux_tva' => 18,
        ]);

        // Associer l'utilisateur à sa boutique
        $user->current_boutique_id = $boutique->id;
        $user->save();

        // Attacher au pivot pour que les requêtes whereHas('boutiques')
        // (alertes stock, permissions par boutique) le trouvent aussi
        $boutique->users()->attach($user->id, ['role_dans_boutique' => 'proprietaire']);

        // Log l'inscription
        $this->auditLogService->logRegistration($user, $request);

        return response()->json([
            'message' => 'Inscription réussie ! Vous pouvez maintenant vous connecter.',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
            ],
            'boutique' => [
                'id' => $boutique->id,
                'nom' => $boutique->nom,
            ],
        ], 201);
    }

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

            // Vérifier si le 2FA est activé
            if ($user->two_factor_enabled) {
                // Si le code 2FA est fourni, le vérifier
                if ($request->has('two_factor_code')) {
                    if (!$this->twoFactorService->verifyCode($user, $request->two_factor_code)) {
                        Auth::logout();
                        throw ValidationException::withMessages([
                            'two_factor_code' => ['Code 2FA invalide.'],
                        ]);
                    }
                } else {
                    // Demander le code 2FA
                    Auth::logout();
                    return response()->json([
                        'message' => 'Code 2FA requis',
                        'requires_two_factor' => true,
                    ], 200);
                }
            }

            // Mettre à jour la dernière connexion
            $user->update(['derniere_connexion' => now()]);

            // Log la connexion
            $this->auditLogService->logLogin($user, $request);

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
                    'two_factor_enabled' => $user->two_factor_enabled,
                ]
            ]);
        }

        throw ValidationException::withMessages([
            'email' => ['Les identifiants sont incorrects.'],
        ]);
    }

    public function logout(Request $request)
    {
        $user = $request->user();
        
        // Log la déconnexion
        $this->auditLogService->logLogout($user, $request);
        
        $user->currentAccessToken()->delete();

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
            'password' => 'required|string|min:8|confirmed',
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
        $user->load('currentBoutique');
        
        $data = [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'telephone' => $user->telephone,
            'est_actif' => $user->est_actif,
            'derniere_connexion' => $user->derniere_connexion,
            'two_factor_enabled' => $user->two_factor_enabled,
            'current_boutique_id' => $user->current_boutique_id,
            'current_boutique' => $user->currentBoutique,
        ];

        if ($user->estProprietaire()) {
            $data['boutiques'] = $user->boutiquesPossedees;
        } else {
            $data['boutiques'] = $user->boutiques;
        }

        return $data;
    }

    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        // Réponse identique quel que soit le cas : ne pas révéler
        // si un compte existe (ni s'il est désactivé).
        $genericMessage = 'Si cet email existe, un lien de réinitialisation a été envoyé.';

        $user = User::where('email', $request->email)->first();

        if (!$user || !$user->est_actif) {
            return response()->json(['message' => $genericMessage]);
        }

        // Générer un token : seul son hash SHA-256 est stocké en base.
        // Le token en clair n'existe que dans l'email envoyé à l'utilisateur.
        $token = Str::random(60);
        $user->password_reset_token = hash('sha256', $token);
        $user->password_reset_expires_at = now()->addHour();
        $user->save();

        $resetUrl = config('app.url') . '/reset-password?token=' . $token;

        $this->emailService->sendPasswordReset($user, $resetUrl);

        return response()->json(['message' => $genericMessage]);
    }

    public function resetPassword(Request $request)
    {
        $request->validate([
            'token' => 'required',
            'password' => 'required|string|min:8|confirmed',
        ]);

        // Comparer le hash du token fourni avec celui stocké
        $user = User::where('password_reset_token', hash('sha256', $request->token))->first();

        if (!$user) {
            throw ValidationException::withMessages([
                'token' => ['Token invalide.'],
            ]);
        }

        if ($user->password_reset_expires_at < now()) {
            throw ValidationException::withMessages([
                'token' => ['Token expiré. Veuillez demander un nouveau lien.'],
            ]);
        }

        if (!$user->est_actif) {
            throw ValidationException::withMessages([
                'email' => ['Ce compte est désactivé. Contactez le gérant.'],
            ]);
        }

        // Assignation explicite : password_reset_token n'est volontairement
        // pas dans $fillable pour éviter toute injection masse-assignment.
        $user->password = Hash::make($request->password);
        $user->password_reset_token = null;
        $user->password_reset_expires_at = null;
        $user->save();

        // Invalider toutes les sessions existantes après changement de mot de passe
        $user->tokens()->delete();

        return response()->json([
            'message' => 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.',
        ]);
    }

    public function enableTwoFactor(Request $request)
    {
        $user = $request->user();

        // Générer un secret s'il n'existe pas ; sinon récupérer la version
        // en clair (déchiffrée) pour l'affichage QR — jamais le blob chiffré.
        $secret = $this->twoFactorService->getPlainSecret($user)
            ?? $this->twoFactorService->generateSecret($user);

        return response()->json([
            'secret' => $secret,
            'qr_code_uri' => $this->twoFactorService->getQRCodeUri($user),
        ]);
    }

    public function confirmTwoFactor(Request $request)
    {
        $request->validate([
            'code' => 'required|string',
        ]);

        $user = $request->user();

        if (!$user->two_factor_secret) {
            return response()->json(['message' => 'Secret 2FA non généré'], 400);
        }

        if ($this->twoFactorService->enableTwoFactor($user, $request->code)) {
            return response()->json(['message' => '2FA activé avec succès']);
        }

        return response()->json(['message' => 'Code 2FA invalide'], 422);
    }

    public function disableTwoFactor(Request $request)
    {
        $user = $request->user();

        $this->twoFactorService->disableTwoFactor($user);

        return response()->json(['message' => '2FA désactivé avec succès']);
    }

    public function switchBoutique(Request $request)
    {
        $request->validate([
            'boutique_id' => 'required|exists:boutiques,id',
        ]);

        $user = $request->user();

        if (!$user->aAccesBoutique($request->boutique_id)) {
            return response()->json(['message' => 'Accès non autorisé à cette boutique'], 403);
        }

        if ($user->switchBoutique($request->boutique_id)) {
            return response()->json([
                'message' => 'Boutique changée avec succès',
                'current_boutique_id' => $user->current_boutique_id,
                'current_boutique' => $user->currentBoutique,
            ]);
        }

        return response()->json(['message' => 'Erreur lors du changement de boutique'], 500);
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
