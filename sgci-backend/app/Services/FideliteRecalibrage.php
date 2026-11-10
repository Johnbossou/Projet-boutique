<?php

namespace App\Services;

use App\Models\ProgrammeFidelite;
use App\Models\RecompenseFidelite;
use App\Models\TransactionPoints;
use Illuminate\Support\Facades\DB;

/**
 * Recalage des seuils de récompenses quand un programme passe du mode
 * « points fixes par achat » au mode prorata du panier.
 *
 * Le problème : les seuils (`RecompenseFidelite.points_requis`) sont exprimés
 * en points, mais la façon de gagner des points change. En mode legacy, un
 * achat valait `points_par_achat` points quel que soit son montant ; en
 * prorata, il vaut `montant × points_par_100_fcfa / 100`. Sans recalage, une
 * récompense calibrée pour l'ancien mode devient soit impossible à atteindre,
 * soit nominations.
 *
 * Le recalage conserve la difficulté de chaque récompense :
 *
 *   legacy   : 1 achat = X points → seuil T atteint en T / X achats
 *   prorata  : 1 achat = P × panier_moyen / 100 points
 *              → seuil T' atteint en T' / (P × panier_moyen / 100) achats
 *
 * En imposant T' = T × P × panier_moyen / (100 × X), le nombre d'achats
 * nécessaire reste le même, et l'écart entre deux récompenses est conservé
 * (le facteur est le même pour toutes).
 *
 * Le panier moyen est mesuré sur l'historique réel du programme (les ventes
 * qui ont effectivement crédité des points), pas sur une constante : c'est la
 * seule donnée qui rende l'équivalence vraie pour cette boutique.
 */
class FideliteRecalibrage
{
    /**
     * Panier moyen HT des ventes qui ont crédité des points à ce programme.
     *
     * `null` si le programme n'a encore aucun historique de crédit : sans
     * panier moyen, l'équivalence legacy/prorata est indéterminée et aucun
     * recalage ne peut être proposé.
     */
    public function panierMoyen(ProgrammeFidelite $programme): ?float
    {
        $moyenne = TransactionPoints::query()
            ->where('type', 'gain')
            ->whereNotNull('vente_id')
            ->whereHas('clientFidelite', fn ($query) => $query->where('programme_fidelite_id', $programme->id))
            ->join('ventes', 'ventes.id', '=', 'transaction_points.vente_id')
            ->avg('ventes.montant_total');

        return $moyenne === null ? null : round((float) $moyenne, 2);
    }

    /**
     * Facteur à appliquer aux seuils existants, ou `null` si le recalage est
     * impossible (mode legacy, taux nul, pas d'historique).
     */
    public function facteur(ProgrammeFidelite $programme): ?float
    {
        $taux = (int) $programme->points_par_100_fcfa;
        $legacy = (int) $programme->points_par_achat;

        if ($taux <= 0 || $legacy <= 0) {
            return null;
        }

        $panier = $this->panierMoyen($programme);

        if (! $panier || $panier <= 0) {
            return null;
        }

        return ($taux * $panier) / (100 * $legacy);
    }

    /**
     * Taux de prorata qui reproduit exactement le comportement legacy.
     *
     * legacy : X points par achat ; prorata : P points pour 100 FCFA.
     * Équivalence : X = P × panier_moyen / 100, soit P = X × 100 / panier_moyen.
     *
     * C'est le taux que le gérant doit choisir s'il veut que la bascule ne
     * change rien pour ses clients.
     */
    public function tauxEquivalent(ProgrammeFidelite $programme): ?int
    {
        $legacy = (int) $programme->points_par_achat;

        if ($legacy <= 0) {
            return null;
        }

        $panier = $this->panierMoyen($programme);

        if (! $panier || $panier <= 0) {
            return null;
        }

        return max(1, (int) round($legacy * 100 / $panier));
    }

    /**
     * Fige (ou libère) la référence de recalage des récompenses.
     *
     * Au moment du passage au prorata, le seuil courant de chaque récompense
     * est mémorisé en points « legacy » : c'est la seule valeur qui permet de
     * recalculer le seuil prorata sans cumuler les applications successives.
     *
     * En mode legacy, la référence est libérée : les seuils saisis par le
     * gérant font foi, et un nouveau passage au prorata rechargera la
     * référence sur ces mêmes seuils.
     */
    public function figerReferentiel(ProgrammeFidelite $programme, bool $modeProrata): void
    {
        $recompenses = $programme->recompenses()->get();

        if (! $modeProrata) {
            RecompenseFidelite::whereIn('id', $recompenses->pluck('id'))
                ->whereNotNull('points_requis_legacy')
                ->update(['points_requis_legacy' => null]);

            return;
        }

        foreach ($recompenses as $recompense) {
            if ($recompense->points_requis_legacy !== null) {
                continue;
            }

            // Récompense créée en mode prorata : son seuil est déjà exprimé
            // en points de prorata, il ne doit pas être rescalé.
            $programme->recompenses()
                ->whereKey($recompense->id)
                ->whereNull('points_requis_legacy')
                ->update(['points_requis_legacy' => $recompense->points_requis]);
        }
    }

    /**
     * Aperçu du recalage : ce que les seuils deviendront, sans rien écrire.
     */
    public function apercu(ProgrammeFidelite $programme): array
    {
        $facteur = $this->facteur($programme);
        $panier = $this->panierMoyen($programme);

        $recompenses = $programme->recompenses()
            ->orderBy('id')
            ->get()
            ->map(function (RecompenseFidelite $recompense) use ($facteur) {
                $reference = $recompense->points_requis_legacy;

                return [
                    'id' => $recompense->id,
                    'nom' => $recompense->nom,
                    'points_requis' => (int) $recompense->points_requis,
                    'points_requis_legacy' => $reference,
                    'points_requis_recalibre' => $facteur === null || $reference === null
                        ? null
                        : max(1, (int) round($reference * $facteur)),
                ];
            })
            ->values()
            ->all();

        return [
            'mode' => (int) $programme->points_par_100_fcfa > 0 ? 'prorata' : 'legacy',
            'points_par_achat' => (int) $programme->points_par_achat,
            'points_par_100_fcfa' => (int) $programme->points_par_100_fcfa,
            'panier_moyen' => $panier,
            'taux_equivalent' => $this->tauxEquivalent($programme),
            'facteur' => $facteur === null ? null : round($facteur, 4),
            'possible' => $facteur !== null,
            'raison' => $this->raison($programme, $facteur, $panier),
            'recompenses' => $recompenses,
        ];
    }

    /**
     * Applique le recalage aux récompenses du programme.
     *
     * Seules les récompenses qui ont une référence legacy sont concernées :
     * une récompense créée en mode prorata a déjà un seuil exprimé en points
     * de prorata.
     *
     * L'opération est atomique et idempotente : le seuil repart toujours de
     * la référence legacy, donc appliquer deux fois ne double pas les seuils.
     */
    public function appliquer(ProgrammeFidelite $programme): array
    {
        $apercu = $this->apercu($programme);

        if (! $apercu['possible']) {
            return $apercu;
        }

        DB::transaction(function () use ($apercu) {
            foreach ($apercu['recompenses'] as $recompense) {
                if ($recompense['points_requis_recalibre'] === null
                    || $recompense['points_requis'] === $recompense['points_requis_recalibre']) {
                    continue;
                }

                RecompenseFidelite::whereKey($recompense['id'])
                    ->update(['points_requis' => $recompense['points_requis_recalibre']]);
            }
        });

        return $apercu;
    }

    /**
     * Explication lisible quand le recalage est impossible ou sans objet.
     */
    private function raison(ProgrammeFidelite $programme, ?float $facteur, ?float $panier): ?string
    {
        if ((int) $programme->points_par_100_fcfa <= 0) {
            return 'Programme en mode « points fixes par achat » : rien à recaler tant que le prorata n\'est pas activé.';
        }

        if ((int) $programme->points_par_achat <= 0) {
            return 'Le taux « points par achat » est à 0 : impossible de convertir les seuils.';
        }

        if (! $panier || $panier <= 0) {
            return 'Aucune vente n\'a encore crédité de points à ce programme : le panier moyen est inconnu, le recalage serait arbitraire.';
        }

        if ($facteur !== null && abs($facteur - 1) < 0.0001) {
            return 'Les seuils actuels correspondent déjà au prorata : rien à changer.';
        }

        return null;
    }
}
