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
     * Paramètres singleton (une seule boutique).
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
}
