<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use App\Models\Boutique;

class VerifyBoutiqueOwnership
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse)  $next
     * @return \Illuminate\Http\Response|\Illuminate\Http\RedirectResponse
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

        if ($boutiqueId) {
            // For proprietaires, verify they own the boutique
            if ($user->role === 'proprietaire') {
                $boutique = Boutique::where('id', $boutiqueId)
                    ->where('proprietaire_id', $user->id)
                    ->first();

                if (!$boutique) {
                    Log::warning('Unauthorized boutique access attempt', [
                        'user_id' => $user->id,
                        'user_email' => $user->email,
                        'boutique_id' => $boutiqueId,
                        'ip_address' => $request->ip(),
                    ]);

                    return response()->json([
                        'message' => 'Accès non autorisé',
                        'error' => 'Vous n\'êtes pas propriétaire de cette boutique',
                    ], 403);
                }
            }

            // For gerants and caissiers, verify they are assigned to the boutique
            if ($user->role === 'gerant' || $user->role === 'caissier') {
                $isAssigned = $user->boutiques()->where('boutiques.id', $boutiqueId)->exists();

                if (!$isAssigned) {
                    Log::warning('Unauthorized boutique access attempt', [
                        'user_id' => $user->id,
                        'user_email' => $user->email,
                        'user_role' => $user->role,
                        'boutique_id' => $boutiqueId,
                        'ip_address' => $request->ip(),
                    ]);

                    return response()->json([
                        'message' => 'Accès non autorisé',
                        'error' => 'Vous n\'êtes pas assigné à cette boutique',
                    ], 403);
                }
            }
        }

        return $next($request);
    }
}
