<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Reads the Sanctum token from an httpOnly cookie when no Bearer
 * header is present. This allows the web SPA to authenticate via
 * cookies (XSS-safe) while mobile clients keep using Bearer tokens.
 */
class SanctumCookieAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!$request->bearerToken() && $request->cookie('sgci_token')) {
            $request->headers->set('Authorization', 'Bearer ' . $request->cookie('sgci_token'));
        }

        return $next($request);
    }
}
