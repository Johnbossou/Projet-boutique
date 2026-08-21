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

        // Le propriétaire a tous les droits du gérant (et plus)
        if (!$user || !in_array($user->role, ['gerant', 'proprietaire'], true)) {
            return response()->json([
                'message' => 'Accès réservé au gérant.',
            ], 403);
        }

        return $next($request);
    }
}
