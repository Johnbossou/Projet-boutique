<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsGerant
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Accès réservé au gérant.'], 403);
        }

        // Le rôle est évalué dans la boutique courante (multi-rôles) :
        // un compte gérant de la boutique A n'est pas gérant de la boutique B
        // où il serait caissier. Le propriétaire a tous les droits du gérant.
        $boutiqueId = $user->current_boutique_id;
        $roleDansBoutique = $user->roleDansBoutique($boutiqueId);

        if (!in_array($roleDansBoutique, ['gerant', 'proprietaire'], true)) {
            return response()->json([
                'message' => 'Accès réservé au gérant.',
            ], 403);
        }

        return $next($request);
    }
}
