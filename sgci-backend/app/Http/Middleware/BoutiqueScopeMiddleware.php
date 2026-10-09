<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class BoutiqueScopeMiddleware
{
    /**
     * Endpoints qui doivent rester accessibles même sans boutique courante.
     * Ils servent justement à l'utilisateur pour découvrir ses boutiques,
     * en choisir une, ou terminer sa session.
     */
    private const ROUTES_SANS_BOUTIQUE = [
        'api/me',
        'api/logout',
        'api/refresh',
        'api/switch-boutique',
        'api/boutiques',
        'api/boutiques/*',
        'api/mes-boutiques',
    ];

    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Non authentifié'], 401);
        }

        // SÉCURITÉ : current_boutique_id est un simple pointeur en base.
        // S'il n'est pas revalidé à chaque requête, un membre retiré de
        // l'équipe (ou dont l'accès a été révoqué) conserve l'accès
        // COMPLET aux données de la boutique, car tout est scopé dessus.
        $couranteValide = $user->current_boutique_id
            && $user->aAccesBoutique($user->current_boutique_id);

        if (! $couranteValide) {
            $repli = $user->boutiquesAccessibles()->first();

            $user->forceFill([
                'current_boutique_id' => $repli?->id,
            ])->save();
        }

        // Garde-fou : sans boutique courante, les contrôleurs appliquent
        // des filtres conditionnels du type
        //     if ($user->current_boutique_id) { $query->where('boutique_id', ...) }
        // Ce schéma n'ajoute AUCUN filtre quand la valeur est nulle et
        // renvoie donc les données de TOUTES les boutiques.
        // On refuse donc l'appel tant qu'aucun tenant n'est résolu.
        if (! $user->current_boutique_id && ! $this->estRouteAutorisee($request)) {
            return response()->json([
                'message' => 'Aucune boutique accessible. Contactez le propriétaire pour être rattaché à une équipe.',
                'code' => 'aucune_boutique',
            ], 403);
        }

        return $next($request);
    }

    private function estRouteAutorisee(Request $request): bool
    {
        $path = ltrim($request->path(), '/');

        foreach (self::ROUTES_SANS_BOUTIQUE as $motif) {
            $motif = ltrim($motif, '/');

            if ($motif === $path) {
                return true;
            }

            if (str_contains($motif, '*') && fnmatch($motif, $path)) {
                return true;
            }
        }

        return false;
    }
}
