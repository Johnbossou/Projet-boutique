<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Boutique;

trait TauxTva
{
    /**
     * Taux de TVA de la boutique courante.
     *
     * La table boutiques porte taux_tva en NOT NULL avec un défaut de 18.00 :
     * le repli sur BoutiqueSetting::current() était donc inutile, et surtout
     * illegitimate — ce singleton renvoyait le taux d'une autre agence, et son
     * firstOrCreate([]) insérait une ligne depuis une simple lecture.
     *
     * Mutualisé (ventes, commandes clients, conversions de devis) parce que
     * le même produit ne peut pas être taxé différemment d'un canal à
     * l'autre : un seul endroit sait lire le taux.
     */
    private function tauxTva(?int $boutiqueId = null): float
    {
        $boutiqueId ??= auth()->user()?->current_boutique_id;

        $taux = $boutiqueId
            ? Boutique::where('id', $boutiqueId)->value('taux_tva')
            : null;

        $taux ??= 18;

        return $taux > 1 ? $taux / 100 : (float) $taux;
    }
}
