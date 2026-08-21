<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class ProprietaireMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (!$user || !$user->estProprietaire()) {
            return response()->json(['message' => 'Accès réservé aux propriétaires'], 403);
        }

        return $next($request);
    }
}
