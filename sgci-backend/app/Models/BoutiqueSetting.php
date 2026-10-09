<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BoutiqueSetting extends Model
{
    protected $fillable = [
        'nom',
        'adresse',
        'telephone',
        'email',
        'devise',
        'taux_tva',
        'delai_annulation_vente_minutes',
    ];

    protected $casts = [
        'taux_tva' => 'decimal:2',
        'delai_annulation_vente_minutes' => 'integer',
    ];

    /**
     * Ligne legacy globale (table boutique_settings, une seule ligne).
     *
     * DÉPRÉCIÉ : la source de vérité des paramètres est la table boutiques,
     * qui porte devise / taux_tva / delai_annulation_vente_minutes en NOT NULL
     * avec des valeurs par défaut. Ne plus utiliser current() pour un calcul
     * métier.
     *
     * Réservé à deux usages :
     *  - les tâches planifiées en CLI, qui n'ont pas d'utilisateur authentifié ;
     *  - les documents rattachés à un modèle sans boutique (boutique_id
     *    nullable sur ventes) : sans propriétaire, aucune fuite entre agences
     *    n'est possible.
     *
     * Attention : firstOrCreate insère une ligne. Cette méthode a donc un
     * effet de bord en base sur une simple lecture.
     */
    public static function current(): self
    {
        return static::firstOrCreate([], [
            'nom' => 'SGCI Bénin',
            'devise' => 'FCFA',
            'taux_tva' => 18.00,
            'delai_annulation_vente_minutes' => config('sgci.delai_annulation_vente_minutes', 5),
        ]);
    }

    /**
     * Boutique à imprimer sur un document rattaché à un modèle (vente,
     * commande, facture).
     *
     * Point de résolution unique : l'expression « $modele->boutique ??
     * BoutiqueSetting::current() » était dupliquée dans VenteController et
     * FacturePdfService, et c'est sa duplication qui avait laissé le service
     * PDF sur le singleton alors que le contrôleur était corrigé.
     *
     * @param  Model  $model  doit exposer une relation boutique()
     * @return Boutique|self
     */
    public static function pourModele(Model $model)
    {
        return $model->boutique ?? static::current();
    }
}
