<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Autorise la gestion (équipe) d'une boutique donnée au :
 * - propriétaire de cette boutique (possession), ou
 * - membre rattaché à cette boutique en tant que GÉRANT (pivot role_dans_boutique).
 */
class VerifyBoutiqueManage
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Non authentifié'], 401);
        }

        // Skip for admin (si présent)
        if ($user->role === 'admin') {
            return $next($request);
        }

        $boutique = $request->route('boutique');
        $boutiqueId = is_object($boutique) ? $boutique->id : $boutique;

        if (!$boutiqueId) {
            return $next($request);
        }

        // Propriétaire de la boutique (possession)
        if ($user->boutiquesPossedees()->where('id', $boutiqueId)->exists()) {
            return $next($request);
        }

        // Gérant de cette boutique (via le pivot)
        $estGerantDeBoutique = $user->boutiques()
            ->where('boutique_user.boutique_id', $boutiqueId)
            ->wherePivot('role_dans_boutique', 'gerant')
            ->exists();

        if ($estGerantDeBoutique) {
            return $next($request);
        }

        Log::warning('Unauthorized team management attempt', [
            'user_id' => $user->id,
            'user_email' => $user->email,
            'boutique_id' => $boutiqueId,
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Accès non autorisé',
            'error' => 'Vous n\'êtes pas autorisé à gérer l\'équipe de cette boutique',
        ], 403);
    }
}
