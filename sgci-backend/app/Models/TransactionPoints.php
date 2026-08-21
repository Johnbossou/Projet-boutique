<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TransactionPoints extends Model
{
    use HasFactory;

    protected $fillable = [
        'client_fidelite_id',
        'type',
        'points',
        'raison',
        'vente_id',
    ];

    protected $casts = [
        'points' => 'integer',
    ];

    /**
     * Relation avec le client fidélité
     */
    public function clientFidelite()
    {
        return $this->belongsTo(ClientFidelite::class);
    }

    /**
     * Relation avec la vente
     */
    public function vente()
    {
        return $this->belongsTo(Vente::class);
    }

    /**
     * Scope pour les gains de points
     */
    public function scopeGains($query)
    {
        return $query->where('type', 'gain');
    }

    /**
     * Scope pour les retraits de points
     */
    public function scopeRetraits($query)
    {
        return $query->where('type', 'retrait');
    }
}
