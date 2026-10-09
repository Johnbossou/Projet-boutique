<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class ProprietaireMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        // Base la possession réelle et non le rôle global : un propriétaire
        // dont le rôle global a été dégradé reste propriétaire de ses boutiques.
        if (! $user || ! $user->boutiquesPossedees()->exists()) {
            return response()->json(['message' => 'Accès réservé aux propriétaires'], 403);
        }

        return $next($request);
    }
}
