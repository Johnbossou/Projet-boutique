<?php

namespace App\Http\Controllers\Concerns;

trait VerifieBoutique
{
    /**
     * Isolation multi-boutiques : une ressource appartenant à une autre
     * boutique que la boutique courante est traitée comme inexistante
     * (404, pas 403) pour ne pas révéler son existence.
     */
    protected function verifierBoutiqueDe($modele): void
    {
        $boutiqueId = auth()->user()->current_boutique_id;

        if ($boutiqueId && $modele && (int) $modele->boutique_id !== (int) $boutiqueId) {
            abort(404);
        }
    }
}
