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

        if (!$user || $user->role !== 'gerant') {
            return response()->json([
                'message' => 'Accès réservé au gérant.',
            ], 403);
        }

        return $next($request);
    }
}
