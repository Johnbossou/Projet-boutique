<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProgrammeFidelite extends Model
{
    use HasFactory;

    protected $fillable = [
        'boutique_id',
        'nom',
        'description',
        'points_par_achat',
        'valeur_point',
        'niveaux',
        'actif',
    ];

    protected $casts = [
        'niveaux' => 'array',
        'actif' => 'boolean',
        'valeur_point' => 'decimal:2',
    ];

    /**
     * Relation avec la boutique
     */
    public function boutique()
    {
        return $this->belongsTo(Boutique::class);
    }

    /**
     * Relation avec les clients fidèles
     */
    public function clientsFidelites()
    {
        return $this->hasMany(ClientFidelite::class);
    }

    /**
     * Relation avec les récompenses
     */
    public function recompenses()
    {
        return $this->hasMany(RecompenseFidelite::class);
    }

    /**
     * Scope pour les programmes actifs
     */
    public function scopeActifs($query)
    {
        return $query->where('actif', true);
    }

    /**
     * Calculer le niveau d'un client basé sur ses points
     */
    public function calculerNiveau(int $points): array
    {
        $niveaux = $this->niveaux ?? [];
        
        foreach ($niveaux as $index => $niveau) {
            if ($points >= $niveau['points_min'] && $points <= ($niveau['points_max'] ?? PHP_INT_MAX)) {
                return [
                    'nom' => $niveau['nom'],
                    'index' => $index,
                    'points_min' => $niveau['points_min'],
                    'remise_pourcentage' => $niveau['remise_pourcentage'] ?? 0,
                ];
            }
        }

        return [
            'nom' => 'Débutant',
            'index' => 0,
            'points_min' => 0,
            'remise_pourcentage' => 0,
        ];
    }

    /**
     * Calculer la valeur des points en FCFA
     */
    public function convertirPointsEnValeur(int $points): float
    {
        return $points * $this->valeur_point;
    }
}
