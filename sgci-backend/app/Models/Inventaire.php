<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Inventaire extends Model
{
    use HasFactory;

    protected $fillable = [
        'boutique_id',
        'user_id',
        'reference',
        'notes',
        'statut',
        'total_produits',
        'ecarts_detectes',
    ];

    protected $casts = [
        'total_produits' => 'integer',
        'ecarts_detectes' => 'integer',
    ];

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function ($inventaire) {
            if (empty($inventaire->reference)) {
                // Suffixe aleatoire : deux inventaires lances dans la meme
                // seconde se heurtaient sur reference, qui est unique.
                $inventaire->reference = 'INV-'.date('Ymd-His').'-'
                    .strtoupper(bin2hex(random_bytes(3)));
            }
        });
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
        return $this->hasMany(InventaireLigne::class);
    }

    public function scopeEnCours($query)
    {
        return $query->where('statut', 'en_cours');
    }

    public function scopeTermines($query)
    {
        return $query->where('statut', 'termine');
    }

    public function scopeValides($query)
    {
        return $query->where('statut', 'valide');
    }
}
