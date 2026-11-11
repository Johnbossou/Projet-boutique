<?php

namespace App\Services;

use App\Models\Boutique;
use App\Models\Vente;
use Illuminate\Support\Collection;

/**
 * Statistiques des boutiques d'un meme utilisateur.
 *
 * L'interface de selection de boutique trie et filtre sur le chiffre
 * d'affaires du mois et sur une performance (« excellente », « bonne »…),
 * et la declare dans son modele TypeScript. Le backend, lui, n'envoyait
 * aucun de ces champs : le tri par chiffre d'affaires ne triait rien, et le
 * filtre par performance ne gardait que les boutiques sans performance —
 * c'est-a-dire aucune. La fonction avait l'air d'exister, et ne faisait
 * rien.
 *
 * La performance est RELATIVE : une boutique est jugee par rapport a la
 * moyenne des boutiques du meme gerant. Un seuil absolu (500 000 FCFA)
 * classerait la meme boutique differemment selon qu'elle est seule ou
 * accompagnee de six autres.
 */
class BoutiqueStatistiques
{
    /**
     * Complete une collection de boutiques (chiffre d'affaires du mois,
     * derniere activite, performance).
     *
     * @param  Collection<int, Boutique>  $boutiques
     * @return Collection<int, Boutique>
     */
    public function enrichir(Collection $boutiques): Collection
    {
        if ($boutiques->isEmpty()) {
            return $boutiques;
        }

        $ids = $boutiques->pluck('id')->all();

        $caParBoutique = Vente::query()
            ->whereIn('boutique_id', $ids)
            ->where('created_at', '>=', now()->startOfMonth())
            // Une vente annulee n'est pas du chiffre d'affaires : la
            // compter ferait passer une boutique qui a tout renvoye pour
            // une boutique qui vend.
            ->where('statut', '!=', 'annule')
            ->groupBy('boutique_id')
            ->selectRaw('boutique_id, SUM(montant_total) as chiffre_affaires')
            ->pluck('chiffre_affaires', 'boutique_id');

        $derniereActivite = Vente::query()
            ->whereIn('boutique_id', $ids)
            ->where('statut', '!=', 'annule')
            ->groupBy('boutique_id')
            ->selectRaw('boutique_id, MAX(created_at) as derniere_activite')
            ->pluck('derniere_activite', 'boutique_id');

        $moyenne = $caParBoutique->count() > 0
            ? (float) $caParBoutique->sum() / $caParBoutique->count()
            : 0.0;

        $boutiques->each(function (Boutique $boutique) use ($caParBoutique, $derniereActivite, $moyenne) {
            $ca = (float) ($caParBoutique[$boutique->id] ?? 0);

            $boutique->chiffre_affaires_mois = round($ca, 2);
            $boutique->derniere_activite = $derniereActivite[$boutique->id] ?? null;
            $boutique->performance = $this->performance($ca, $moyenne);
        });

        return $boutiques;
    }

    /**
     * Performance d'une boutique, rapportee a la moyenne du portefeuille.
     *
     * Faible : sous la moitie de la moyenne.
     * Moyenne : entre la moitie et la moyenne.
     * Bonne : entre la moyenne et une fois et demie la moyenne.
     * Excellente : au-dela d'une fois et demie la moyenne.
     */
    private function performance(float $ca, float $moyenne): string
    {
        if ($moyenne <= 0) {
            return $ca > 0 ? 'bonne' : 'faible';
        }

        return match (true) {
            $ca >= $moyenne * 1.5 => 'excellente',
            $ca >= $moyenne => 'bonne',
            $ca >= $moyenne * 0.5 => 'moyenne',
            default => 'faible',
        };
    }
}
