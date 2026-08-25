<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RetourVenteLigne extends Model
{
    use HasFactory;

    protected $fillable = [
        'retour_vente_id',
        'ligne_vente_id',
        'produit_id',
        'quantite_retournee',
        'prix_unitaire',
        'montant_retourne',
    ];

    protected $casts = [
        'prix_unitaire' => 'decimal:2',
        'montant_retourne' => 'decimal:2',
    ];

    public function retourVente()
    {
        return $this->belongsTo(RetourVente::class);
    }

    public function ligneVente()
    {
        return $this->belongsTo(LigneVente::class);
    }

    public function produit()
    {
        return $this->belongsTo(Produit::class);
    }
}
