<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class BoutiqueScopeMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Non authentifié'], 401);
        }

        // Si l'utilisateur n'a pas de boutique courante, essayer de lui en assigner une
        if (!$user->current_boutique_id) {
            if ($user->estProprietaire()) {
                // Assigner la première boutique possédée
                $firstBoutique = $user->boutiquesPossedees()->first();
                if ($firstBoutique) {
                    $user->current_boutique_id = $firstBoutique->id;
                    $user->save();
                }
            } else {
                // Assigner la première boutique assignée
                $firstBoutique = $user->boutiques()->first();
                if ($firstBoutique) {
                    $user->current_boutique_id = $firstBoutique->id;
                    $user->save();
                }
            }
        }

        return $next($request);
    }
}
