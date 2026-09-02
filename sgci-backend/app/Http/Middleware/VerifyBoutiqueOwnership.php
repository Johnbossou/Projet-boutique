<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class VerifyBoutiqueOwnership
{
    /**
     * Vérifie que l'utilisateur a bien accès à la boutique ciblée
     * (possession pour le propriétaire, ou rattachement via le pivot pour les membres).
     */
    public function handle(Request $request, Closure $next)
    {
        $user = auth()->user();

        // Skip for admin users (if any)
        if ($user->role === 'admin') {
            return $next($request);
        }

        // Get boutique ID from route parameter or request body
        $boutiqueId = $request->route('boutique') ?? $request->input('boutique_id') ?? $request->input('boutique');

        // Si pas de boutique ciblée, on ne bloque rien ici (préférence router vers le scope courant)
        if (!$boutiqueId) {
            return $next($request);
        }

        if (is_object($boutiqueId)) {
            $boutiqueId = $boutiqueId->id;
        }

        if (!$user->aAccesBoutique($boutiqueId)) {
            Log::warning('Unauthorized boutique access attempt', [
                'user_id' => $user->id,
                'user_email' => $user->email,
                'boutique_id' => $boutiqueId,
                'ip_address' => $request->ip(),
            ]);

            return response()->json([
                'message' => 'Accès non autorisé',
                'error' => 'Vous n\'avez pas accès à cette boutique',
            ], 403);
        }

        return $next($request);
    }
}
