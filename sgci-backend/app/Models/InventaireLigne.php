<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InventaireLigne extends Model
{
    use HasFactory;

    protected $fillable = [
        'inventaire_id',
        'produit_id',
        'quantite_systeme',
        'quantite_physique',
        'ecart',
        'notes',
    ];

    protected $casts = [
        'quantite_systeme' => 'integer',
        'quantite_physique' => 'integer',
        'ecart' => 'integer',
    ];

    public function inventaire()
    {
        return $this->belongsTo(Inventaire::class);
    }

    public function produit()
    {
        return $this->belongsTo(Produit::class);
    }
}
