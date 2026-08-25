<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class EnsureLoginAttemptsSafe
{
    private const MAX_ATTEMPTS = 5;
    private const LOCKOUT_MINUTES = 15;

    /**
     * Bloque l'authentification si le compteur d'échecs dépasse la limite.
     * Le contrôleur AuthController::login doit appeler recordFailure() / resetAttempts()
     * via les méthodes statiques de ce middleware.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $email = strtolower((string) $request->input('email', ''));
        $key = "login_attempts:{$email}";

        $attempts = (int) Cache::get($key, 0);

        if ($attempts >= self::MAX_ATTEMPTS) {
            $ttl = Cache::store('array')->has($key)
                ? Cache::get($key . ':ttl', self::LOCKOUT_MINUTES * 60)
                : self::LOCKOUT_MINUTES * 60;

            Log::warning('Login bloqué par anti brute-force', [
                'email' => $email,
                'ip' => $request->ip(),
                'tentatives' => $attempts,
            ]);

            return response()->json([
                'message' => "Trop de tentatives. Réessayez dans " . self::LOCKOUT_MINUTES . " minutes.",
                'locked_until' => now()->addSeconds($ttl)->toIso8601String(),
            ], 429);
        }

        $response = $next($request);

        // Si le login a échoué (401 ou 422), incrémenter le compteur
        if ($response->getStatusCode() === 401 || $response->getStatusCode() === 422) {
            $newAttempts = Cache::increment($key);
            if ($newAttempts === 1) {
                Cache::put($key, 1, now()->addMinutes(self::LOCKOUT_MINUTES));
            }

            if ($newAttempts >= self::MAX_ATTEMPTS) {
                Log::warning('Compte verrouillé par anti brute-force', [
                    'email' => $email,
                    'ip' => $request->ip(),
                    'tentatives' => $newAttempts,
                ]);
            }
        } elseif ($response->isOk() && $attempts > 0) {
            // Login réussi : réinitialiser le compteur
            Cache::forget($key);
        }

        return $response;
    }
}
