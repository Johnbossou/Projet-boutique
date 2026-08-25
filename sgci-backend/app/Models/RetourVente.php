<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RetourVente extends Model
{
    use HasFactory;

    protected $table = 'retours_vente';

    protected $fillable = [
        'vente_id',
        'boutique_id',
        'user_id',
        'type',
        'motif',
        'motif_detail',
        'montant_rembourse',
        'statut',
        'notes',
    ];

    protected $casts = [
        'montant_rembourse' => 'decimal:2',
    ];

    public function vente()
    {
        return $this->belongsTo(Vente::class);
    }

    public function boutique()
    {
        return $this->belongsTo(Boutique::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function lignes()
    {
        return $this->hasMany(RetourVenteLigne::class);
    }

    public function scopeEnAttente($query)
    {
        return $query->where('statut', 'en_attente');
    }

    public function scopeValides($query)
    {
        return $query->where('statut', 'valide');
    }
}
