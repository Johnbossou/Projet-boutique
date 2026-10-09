<?php

namespace App\Services;

use App\Models\Compteur;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

class Sequenceur
{
    /**
     * Réserve le prochain numéro d'une séquence et le renvoie formaté.
     *
     * L'INSERT/UPDATE se fait dans une transaction avec verrou pessimiste :
     * deux caisses simultanées ne peuvent pas lire la même valeur. Le
     * compteur est GLOBAL par préfixe, jamais par boutique — les index
     * UNIQUE portent sur la colonne de numéro, pas sur (boutique, numéro).
     *
     * @param  string  $prefixe  Ex. 'CMD' produit CMD-20261001-0001
     * @param  string  $format  'date' pour suffixe par jour, sinon compteur continu
     * @param  int  $longueur  Nombre de chiffres du suffixe
     */
    public static function prochain(string $prefixe, string $format = 'date', int $longueur = 4): string
    {
        $cle = $format === 'date' ? $prefixe.'-'.now()->format('Ymd') : $prefixe;

        $valeur = DB::transaction(function () use ($cle) {
            $compteur = Compteur::where('prefixe', $cle)->lockForUpdate()->first();

            if ($compteur === null) {
                // Deux requêtes concurrentes peuvent toutes deux ne rien
                // trouver ; l'index UNIQUE sur prefixe départage et l'une
                // d'elles repart sur le chemin « increment ».
                try {
                    $compteur = Compteur::create([
                        'prefixe' => $cle,
                        'valeur' => 0,
                    ]);
                } catch (UniqueConstraintViolationException) {
                    $compteur = Compteur::where('prefixe', $cle)->lockForUpdate()->first();
                }
            }

            $compteur->increment('valeur');

            return (int) $compteur->fresh()->valeur;
        }, 3);

        $prefixeComplet = $format === 'date'
            ? $prefixe.'-'.now()->format('Ymd')
            : $prefixe;

        return $prefixeComplet.'-'.str_pad((string) $valeur, $longueur, '0', STR_PAD_LEFT);
    }
}
